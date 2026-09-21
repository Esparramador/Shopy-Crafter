import {
  db, usersTable, platformSettingsTable, onboardingProgressTable, achievementsTable, subscriptionsTable,
  affiliatesTable, referralTrackingTable, reportTemplatesTable, youtubeTokensTable,
} from "@workspace/db";
import { eq, inArray, sql } from "drizzle-orm";

export type DeleteUserResult =
  | { ok: true; deleted: { id: string; email: string } }
  | { ok: false; status: 400 | 403 | 404 | 409; error: string; subscription?: { plan: string | null; status: string | null; stripeSubscriptionId: string } };

// Estados de Stripe en los que la suscripción ya no cobra. Cualquier otro estado
// con stripe_subscription_id significa que Stripe seguiría facturando tras borrar
// la fila local, así que el borrado se rechaza hasta que se cancele.
const NON_BILLING_STATUSES = new Set(["canceled", "cancelled", "incomplete_expired"]);

export function subscriptionBlocksDeletion(sub: { stripeSubscriptionId: string | null; status: string | null } | undefined): boolean {
  if (!sub?.stripeSubscriptionId) return false;
  return !NON_BILLING_STATUSES.has((sub.status ?? "").toLowerCase());
}

/**
 * Borra definitivamente un usuario de rol "client". Reglas:
 *  - nunca el propio actor ni un admin;
 *  - nunca con una suscripción de Stripe que siga facturando (409);
 *  - no hay FKs hacia users en la BD, así que las filas que le pertenecen se
 *    limpian a mano en una transacción; el audit_log se conserva.
 */
export async function deleteClientUser(targetId: string, actorId: string): Promise<DeleteUserResult> {
  if (targetId === actorId) return { ok: false, status: 400, error: "No puedes borrar tu propio usuario" };

  const [user] = await db.select({ id: usersTable.id, email: usersTable.email, role: usersTable.role })
    .from(usersTable).where(eq(usersTable.id, targetId)).limit(1);
  if (!user) return { ok: false, status: 404, error: "Usuario no encontrado" };
  if (user.role !== "client") return { ok: false, status: 403, error: "Solo se pueden borrar usuarios de rol client" };

  const [sub] = await db.select({
    stripeSubscriptionId: subscriptionsTable.stripeSubscriptionId,
    status: subscriptionsTable.status,
    plan: subscriptionsTable.plan,
  }).from(subscriptionsTable).where(eq(subscriptionsTable.userId, targetId)).limit(1);
  if (subscriptionBlocksDeletion(sub)) {
    return {
      ok: false, status: 409,
      error: "El usuario tiene una suscripción de Stripe activa; cancélala antes de borrarlo",
      subscription: { plan: sub!.plan, status: sub!.status, stripeSubscriptionId: sub!.stripeSubscriptionId! },
    };
  }

  await db.transaction(async (tx) => {
    // Sesiones activas (express-session guarda userId dentro de sess). La
    // revalidación global cubre además las sesiones que se creen en paralelo.
    await tx.execute(sql`DELETE FROM user_sessions WHERE sess->>'userId' = ${targetId}`);
    await tx.delete(onboardingProgressTable).where(eq(onboardingProgressTable.userId, targetId));
    await tx.delete(achievementsTable).where(eq(achievementsTable.userId, targetId));
    await tx.delete(subscriptionsTable).where(eq(subscriptionsTable.userId, targetId));
    // Suscripción push (platform_settings, clave push_sub::<userId>).
    await tx.delete(platformSettingsTable).where(eq(platformSettingsTable.key, `push_sub::${targetId}`));
    // Afiliados: si otro afiliado lo refirió se conserva su comisión sin enlace
    // al usuario; los referidos de su propio código se eliminan antes que él.
    await tx.update(referralTrackingTable).set({ referredUserId: null })
      .where(eq(referralTrackingTable.referredUserId, targetId));
    await tx.delete(referralTrackingTable).where(inArray(
      referralTrackingTable.affiliateId,
      tx.select({ id: affiliatesTable.id }).from(affiliatesTable).where(eq(affiliatesTable.userId, targetId)),
    ));
    await tx.delete(affiliatesTable).where(eq(affiliatesTable.userId, targetId));
    await tx.delete(reportTemplatesTable).where(eq(reportTemplatesTable.userId, targetId));
    await tx.delete(youtubeTokensTable).where(eq(youtubeTokensTable.userId, targetId));
    // calendar_tokens se crea con SQL crudo bajo demanda; puede no existir aún.
    const reg = await tx.execute(sql`SELECT to_regclass('public.calendar_tokens') AS t`);
    if ((reg.rows[0] as { t: string | null } | undefined)?.t) {
      await tx.execute(sql`DELETE FROM calendar_tokens WHERE user_id = ${targetId}`);
    }
    await tx.delete(usersTable).where(eq(usersTable.id, targetId));
  });

  return { ok: true, deleted: { id: user.id, email: user.email } };
}
