import { db, usersTable, subscriptionsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import Stripe from "stripe";
import { logger } from "./logger.js";
import { subscriptionBlocksDeletion } from "./user-deletion.js";
import { stripeSubscriptionDashboardUrl } from "./stripe-dashboard-url.js";

export type CancelSubscriptionResult =
  | { ok: true; alreadyCanceled: boolean; localUpdated: boolean; stripeSubscriptionId: string | null; status: string }
  | { ok: false; status: 400 | 403 | 404 | 409 | 502 | 503; error: string; stripeDashboardUrl?: string };

// Estados de Stripe en los que la suscripción ya no factura (misma regla que el guard de borrado).
const STRIPE_NON_BILLING = new Set(["canceled", "incomplete_expired"]);

/** Cliente Stripe mínimo que necesita la cancelación; inyectable en tests. */
export interface StripeSubscriptionClient {
  retrieve(subscriptionId: string): Promise<{ status: string }>;
  cancel(subscriptionId: string): Promise<{ status: string }>;
}

function defaultStripeClient(): StripeSubscriptionClient | null {
  const secret = process.env.STRIPE_SECRET_KEY;
  if (!secret) return null;
  // Sin apiVersion explícita: se usa la versión que el SDK instalado tipa y soporta.
  const stripe = new Stripe(secret);
  return {
    retrieve: (id) => stripe.subscriptions.retrieve(id).then((s) => ({ status: s.status })),
    cancel: (id) => stripe.subscriptions.cancel(id).then((s) => ({ status: s.status })),
  };
}

function stripeErrorInfo(err: unknown): { code?: string; message: string } {
  const e = err as { code?: string; message?: string } | undefined;
  return { code: e?.code, message: err instanceof Error ? err.message : String(err) };
}

/**
 * Cancela en Stripe la suscripción de un usuario de rol "client" y refleja "canceled" en la fila
 * local, de modo que deleteClientUser deje de devolver 409.
 *
 * Política "fail closed": la fila local solo se marca cancelada cuando Stripe confirma de forma
 * autoritativa que la suscripción ya no factura (retrieve devuelve canceled/incomplete_expired, o
 * cancel() responde con éxito). Un `resource_missing` NO se considera prueba de nada: Stripe
 * devuelve ese mismo código cuando la clave configurada es de otro modo (test/live) u otra cuenta,
 * y en ese caso la suscripción real seguiría cobrando. Se devuelve 409 con enlace al dashboard.
 */
export async function cancelClientSubscription(
  targetId: string,
  actorId: string,
  stripe: StripeSubscriptionClient | null = defaultStripeClient(),
): Promise<CancelSubscriptionResult> {
  if (targetId === actorId) return { ok: false, status: 400, error: "No puedes cancelar tu propia suscripción desde aquí" };

  const [user] = await db.select({ id: usersTable.id, role: usersTable.role })
    .from(usersTable).where(eq(usersTable.id, targetId)).limit(1);
  if (!user) return { ok: false, status: 404, error: "Usuario no encontrado" };
  if (user.role !== "client") return { ok: false, status: 403, error: "Solo se pueden cancelar suscripciones de usuarios de rol client" };

  const [sub] = await db.select({
    stripeSubscriptionId: subscriptionsTable.stripeSubscriptionId,
    status: subscriptionsTable.status,
  }).from(subscriptionsTable).where(eq(subscriptionsTable.userId, targetId)).limit(1);

  if (!subscriptionBlocksDeletion(sub)) {
    return { ok: true, alreadyCanceled: true, localUpdated: false, stripeSubscriptionId: sub?.stripeSubscriptionId ?? null, status: sub?.status ?? "none" };
  }
  const stripeSubscriptionId = sub!.stripeSubscriptionId!;
  const stripeDashboardUrl = stripeSubscriptionDashboardUrl(stripeSubscriptionId);

  if (!stripe) {
    return {
      ok: false, status: 503, stripeDashboardUrl,
      error: "Stripe no está configurado (falta STRIPE_SECRET_KEY); cancela la suscripción desde el dashboard de Stripe",
    };
  }

  // 1) Verificación autoritativa del estado remoto.
  let remoteStatus: string;
  try {
    remoteStatus = (await stripe.retrieve(stripeSubscriptionId)).status;
  } catch (err: unknown) {
    const { code, message } = stripeErrorInfo(err);
    if (code === "resource_missing") {
      logger.warn({ targetId, stripeSubscriptionId }, "Stripe: suscripción no visible con la clave configurada (¿modo/cuenta distinta?); no se cancela ni se borra");
      return {
        ok: false, status: 409, stripeDashboardUrl,
        error: "Stripe no encuentra esta suscripción con la clave configurada (puede ser de otro modo test/live u otra cuenta). Por seguridad no se marca como cancelada: revísala en el dashboard de Stripe.",
      };
    }
    logger.error({ targetId, stripeSubscriptionId, err: message }, "Stripe: error consultando la suscripción");
    return { ok: false, status: 502, stripeDashboardUrl, error: `Stripe no respondió correctamente: ${message}` };
  }

  // 2) Cancelación (solo si sigue facturando en Stripe).
  let alreadyCanceled = false;
  if (STRIPE_NON_BILLING.has(remoteStatus)) {
    alreadyCanceled = true;
  } else {
    try {
      remoteStatus = (await stripe.cancel(stripeSubscriptionId)).status;
    } catch (err: unknown) {
      const { message } = stripeErrorInfo(err);
      logger.error({ targetId, stripeSubscriptionId, err: message }, "Stripe: error cancelando suscripción");
      return { ok: false, status: 502, stripeDashboardUrl, error: `Stripe rechazó la cancelación: ${message}` };
    }
    if (!STRIPE_NON_BILLING.has(remoteStatus)) {
      logger.error({ targetId, stripeSubscriptionId, remoteStatus }, "Stripe: cancel() no dejó la suscripción en un estado sin facturación");
      return { ok: false, status: 502, stripeDashboardUrl, error: `Stripe devolvió estado "${remoteStatus}" tras cancelar; no se marca como cancelada` };
    }
  }

  await db.update(subscriptionsTable)
    .set({ status: "canceled", cancelAtPeriodEnd: 0 })
    .where(eq(subscriptionsTable.userId, targetId));

  logger.info({ targetId, actorId, stripeSubscriptionId, remoteStatus, alreadyCanceled }, "Suscripción Stripe cancelada/confirmada por admin");
  return { ok: true, alreadyCanceled, localUpdated: true, stripeSubscriptionId, status: "canceled" };
}
