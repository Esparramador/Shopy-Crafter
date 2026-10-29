import { db, usersTable, subscriptionsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import Stripe from "stripe";
import { logger } from "./logger.js";
import { subscriptionBlocksDeletion } from "./user-deletion.js";
import { stripeSubscriptionDashboardUrl } from "./stripe-dashboard-url.js";

export type CancelMode = "now" | "period_end";

export type CancelSubscriptionResult =
  | {
      ok: true;
      mode: CancelMode;
      /** La suscripción ya no facturaba (local o en Stripe) antes de esta llamada. */
      alreadyCanceled: boolean;
      /** Solo en modo period_end: Stripe ya la tenía programada para cancelarse al final del periodo. */
      alreadyScheduled: boolean;
      localUpdated: boolean;
      /** Solo en modo period_end: el usuario se ha desactivado (isActive=0) en vez de borrarse. */
      userDeactivated: boolean;
      stripeSubscriptionId: string | null;
      status: string;
      /** Fecha en la que Stripe dejará de facturar (modo period_end), si se conoce. */
      periodEnd: Date | null;
    }
  | { ok: false; status: 400 | 403 | 404 | 409 | 502 | 503; error: string; stripeDashboardUrl?: string };

// Estados de Stripe en los que la suscripción ya no factura (misma regla que el guard de borrado).
const STRIPE_NON_BILLING = new Set(["canceled", "incomplete_expired"]);

/** Vista mínima de una suscripción de Stripe que necesita la cancelación. */
export interface StripeSubscriptionSnapshot {
  status: string;
  cancelAtPeriodEnd: boolean;
  /** Fin del periodo pagado (cancel_at si está programada; si no, el mayor current_period_end de sus items). */
  periodEnd: Date | null;
}

/** Cliente Stripe mínimo que necesita la cancelación; inyectable en tests. */
export interface StripeSubscriptionClient {
  retrieve(subscriptionId: string): Promise<StripeSubscriptionSnapshot>;
  cancel(subscriptionId: string): Promise<StripeSubscriptionSnapshot>;
  /** subscriptions.update(id, { cancel_at_period_end: true }) */
  cancelAtPeriodEnd(subscriptionId: string): Promise<StripeSubscriptionSnapshot>;
}

function toSnapshot(s: Stripe.Subscription): StripeSubscriptionSnapshot {
  // Desde la API 2025-03 (Basil) current_period_end vive en cada item; cancel_at es el fin
  // efectivo cuando la cancelación está programada.
  const itemEnds = (s.items?.data ?? [])
    .map((it) => (it as { current_period_end?: number }).current_period_end)
    .filter((n): n is number => typeof n === "number" && n > 0);
  const epoch = s.cancel_at ?? (itemEnds.length ? Math.max(...itemEnds) : null);
  return {
    status: s.status,
    cancelAtPeriodEnd: Boolean(s.cancel_at_period_end),
    periodEnd: epoch ? new Date(epoch * 1000) : null,
  };
}

function defaultStripeClient(): StripeSubscriptionClient | null {
  const secret = process.env.STRIPE_SECRET_KEY;
  if (!secret) return null;
  // Sin apiVersion explícita: se usa la versión que el SDK instalado tipa y soporta.
  const stripe = new Stripe(secret);
  return {
    retrieve: (id) => stripe.subscriptions.retrieve(id).then(toSnapshot),
    cancel: (id) => stripe.subscriptions.cancel(id).then(toSnapshot),
    cancelAtPeriodEnd: (id) => stripe.subscriptions.update(id, { cancel_at_period_end: true }).then(toSnapshot),
  };
}

function stripeErrorInfo(err: unknown): { code?: string; message: string } {
  const e = err as { code?: string; message?: string } | undefined;
  return { code: e?.code, message: err instanceof Error ? err.message : String(err) };
}

export interface CancelSubscriptionOptions {
  /**
   * true → no se corta la facturación ya pagada: Stripe la cancela al final del periodo en curso
   * (cancel_at_period_end) y el usuario se DESACTIVA ahora (isActive=0) en vez de borrarse.
   * false/omitido → cancelación inmediata (comportamiento original); el usuario no se toca aquí.
   */
  atPeriodEnd?: boolean;
}

/**
 * Cancela en Stripe la suscripción de un usuario de rol "client".
 *
 *  - Modo "now" (por defecto): subscriptions.cancel y la fila local pasa a "canceled", de modo
 *    que deleteClientUser deje de devolver 409.
 *  - Modo "period_end" (atPeriodEnd=true): subscriptions.update({cancel_at_period_end:true}),
 *    la fila local marca cancel_at_period_end=1 + current_period_end, y el usuario se desactiva.
 *    La fila sigue bloqueando el borrado hasta que Stripe la deje realmente en "canceled".
 *
 * Política "fail closed": la fila local y el usuario solo se tocan cuando Stripe confirma de forma
 * autoritativa el estado (retrieve devuelve canceled/incomplete_expired, cancel() responde con éxito,
 * o update() devuelve cancel_at_period_end=true). Un `resource_missing` NO se considera prueba de
 * nada: Stripe devuelve ese mismo código cuando la clave configurada es de otro modo (test/live) u
 * otra cuenta, y en ese caso la suscripción real seguiría cobrando. Se devuelve 409 con enlace al
 * dashboard.
 */
export async function cancelClientSubscription(
  targetId: string,
  actorId: string,
  stripe: StripeSubscriptionClient | null = defaultStripeClient(),
  options: CancelSubscriptionOptions = {},
): Promise<CancelSubscriptionResult> {
  const mode: CancelMode = options.atPeriodEnd ? "period_end" : "now";
  if (targetId === actorId) return { ok: false, status: 400, error: "No puedes cancelar tu propia suscripción desde aquí" };

  const [user] = await db.select({ id: usersTable.id, role: usersTable.role })
    .from(usersTable).where(eq(usersTable.id, targetId)).limit(1);
  if (!user) return { ok: false, status: 404, error: "Usuario no encontrado" };
  if (user.role !== "client") return { ok: false, status: 403, error: "Solo se pueden cancelar suscripciones de usuarios de rol client" };

  const [sub] = await db.select({
    stripeSubscriptionId: subscriptionsTable.stripeSubscriptionId,
    status: subscriptionsTable.status,
    cancelAtPeriodEnd: subscriptionsTable.cancelAtPeriodEnd,
    currentPeriodEnd: subscriptionsTable.currentPeriodEnd,
  }).from(subscriptionsTable).where(eq(subscriptionsTable.userId, targetId)).limit(1);

  // Revocación de acceso: además de isActive=0 (las sesiones caen en revalidateSession) se anula
  // cualquier invitación pendiente: POST /auth/invite/:token/setup vuelve a poner isActive=1 e inicia
  // sesión, así que un enlace aún válido permitiría saltarse la revocación.
  const deactivateUser = async (): Promise<void> => {
    await db.update(usersTable)
      .set({ isActive: 0, inviteToken: null, inviteExpires: null })
      .where(eq(usersTable.id, targetId));
  };

  if (!subscriptionBlocksDeletion(sub)) {
    // Nada factura. En modo period_end el admin pidió además revocar el acceso: se desactiva igualmente.
    if (mode === "period_end") await deactivateUser();
    return {
      ok: true, mode, alreadyCanceled: true, alreadyScheduled: false, localUpdated: false,
      userDeactivated: mode === "period_end",
      stripeSubscriptionId: sub?.stripeSubscriptionId ?? null, status: sub?.status ?? "none", periodEnd: null,
    };
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
  let remote: StripeSubscriptionSnapshot;
  try {
    remote = await stripe.retrieve(stripeSubscriptionId);
  } catch (err: unknown) {
    const { code, message } = stripeErrorInfo(err);
    if (code === "resource_missing") {
      logger.warn({ targetId, stripeSubscriptionId, mode }, "Stripe: suscripción no visible con la clave configurada (¿modo/cuenta distinta?); no se cancela ni se borra");
      return {
        ok: false, status: 409, stripeDashboardUrl,
        error: "Stripe no encuentra esta suscripción con la clave configurada (puede ser de otro modo test/live u otra cuenta). Por seguridad no se marca como cancelada: revísala en el dashboard de Stripe.",
      };
    }
    logger.error({ targetId, stripeSubscriptionId, mode, err: message }, "Stripe: error consultando la suscripción");
    return { ok: false, status: 502, stripeDashboardUrl, error: `Stripe no respondió correctamente: ${message}` };
  }

  // 2a) Ya no factura en Stripe: sincronizamos la fila local como "canceled" sea cual sea el modo.
  if (STRIPE_NON_BILLING.has(remote.status)) {
    await db.update(subscriptionsTable)
      .set({ status: "canceled", cancelAtPeriodEnd: 0 })
      .where(eq(subscriptionsTable.userId, targetId));
    if (mode === "period_end") await deactivateUser();
    logger.info({ targetId, actorId, stripeSubscriptionId, mode, remoteStatus: remote.status }, "Suscripción Stripe ya cancelada: fila local sincronizada por admin");
    return {
      ok: true, mode, alreadyCanceled: true, alreadyScheduled: false, localUpdated: true,
      userDeactivated: mode === "period_end", stripeSubscriptionId, status: "canceled", periodEnd: null,
    };
  }

  // 2b) Modo period_end: programar la cancelación (o confirmar que ya lo está) y revocar acceso.
  if (mode === "period_end") {
    const alreadyScheduled = remote.cancelAtPeriodEnd;
    if (!alreadyScheduled) {
      try {
        remote = await stripe.cancelAtPeriodEnd(stripeSubscriptionId);
      } catch (err: unknown) {
        const { message } = stripeErrorInfo(err);
        logger.error({ targetId, stripeSubscriptionId, err: message }, "Stripe: error programando la cancelación al final del periodo");
        return { ok: false, status: 502, stripeDashboardUrl, error: `Stripe rechazó programar la cancelación: ${message}` };
      }
      if (!remote.cancelAtPeriodEnd && !STRIPE_NON_BILLING.has(remote.status)) {
        logger.error({ targetId, stripeSubscriptionId, remoteStatus: remote.status }, "Stripe: update() no dejó cancel_at_period_end=true");
        return { ok: false, status: 502, stripeDashboardUrl, error: `Stripe devolvió estado "${remote.status}" sin cancelación programada; no se cambia nada` };
      }
    }
    const periodEnd = remote.periodEnd ?? sub?.currentPeriodEnd ?? null;
    await db.update(subscriptionsTable)
      .set({ cancelAtPeriodEnd: 1, ...(periodEnd ? { currentPeriodEnd: periodEnd } : {}) })
      .where(eq(subscriptionsTable.userId, targetId));
    await deactivateUser();
    logger.info({ targetId, actorId, stripeSubscriptionId, periodEnd, alreadyScheduled }, "Suscripción Stripe programada para cancelarse al final del periodo; usuario desactivado por admin");
    return {
      ok: true, mode, alreadyCanceled: false, alreadyScheduled, localUpdated: true, userDeactivated: true,
      stripeSubscriptionId, status: remote.status, periodEnd,
    };
  }

  // 2c) Modo now: cancelación inmediata.
  let remoteStatus: string;
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

  await db.update(subscriptionsTable)
    .set({ status: "canceled", cancelAtPeriodEnd: 0 })
    .where(eq(subscriptionsTable.userId, targetId));

  logger.info({ targetId, actorId, stripeSubscriptionId, remoteStatus }, "Suscripción Stripe cancelada por admin");
  return {
    ok: true, mode, alreadyCanceled: false, alreadyScheduled: false, localUpdated: true, userDeactivated: false,
    stripeSubscriptionId, status: "canceled", periodEnd: null,
  };
}
