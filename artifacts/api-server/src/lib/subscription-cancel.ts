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

/**
 * ¿Indica el error de Stripe que la suscripción YA estaba cancelada cuando intentamos mutarla?
 * Stripe lo expresa de varias formas según endpoint/versión: "This subscription has already been
 * canceled", "A canceled subscription can only update its cancellation_details", o directamente
 * `resource_missing` (cancel sobre una suscripción cancelada). Solo sirve como PISTA: el estado
 * se confirma siempre con un retrieve posterior antes de tocar la fila local.
 */
export function isStripeAlreadyCanceledError(err: unknown): boolean {
  const { code, message } = stripeErrorInfo(err);
  if (code === "resource_missing") return true;
  return /already (?:been )?cancel+ed|canceled subscription can only update|subscription (?:is|was) (?:already )?cancel+ed/i.test(message);
}

/**
 * Sincroniza la fila local `subscriptions` con un evento de Stripe
 * (`customer.subscription.deleted` / `customer.subscription.updated`) recibido por webhook.
 * Solo actúa cuando Stripe dice que la suscripción ha dejado de facturar (deleted, o status
 * canceled/incomplete_expired): la fila con ese `stripe_subscription_id` pasa a "canceled" y así
 * el guard de borrado de usuario deja de devolver 409. Devuelve si se aplicó el cambio.
 */
export async function syncLocalSubscriptionFromStripeEvent(input: {
  stripeSubscriptionId: string | null | undefined;
  status: string | null | undefined;
  deleted: boolean;
}): Promise<{ applied: boolean; reason: "no_id" | "still_billing" | "synced" }> {
  const id = input.stripeSubscriptionId?.trim();
  if (!id) return { applied: false, reason: "no_id" };
  const remoteStatus = String(input.status ?? "").toLowerCase();
  if (!input.deleted && !STRIPE_NON_BILLING.has(remoteStatus)) return { applied: false, reason: "still_billing" };
  await db.update(subscriptionsTable)
    .set({ status: "canceled", cancelAtPeriodEnd: 0 })
    .where(eq(subscriptionsTable.stripeSubscriptionId, id));
  logger.info({ stripeSubscriptionId: id, remoteStatus: input.deleted ? "deleted" : remoteStatus }, "Stripe webhook: suscripción cancelada en Stripe → fila local marcada como canceled");
  return { applied: true, reason: "synced" };
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

  // Stripe ya no factura esta suscripción: la fila local pasa a "canceled" sea cual sea el modo.
  const syncAlreadyCanceled = async (remoteStatus: string, via: "retrieve" | "already_canceled_error"): Promise<CancelSubscriptionResult> => {
    await db.update(subscriptionsTable)
      .set({ status: "canceled", cancelAtPeriodEnd: 0 })
      .where(eq(subscriptionsTable.userId, targetId));
    if (mode === "period_end") await deactivateUser();
    logger.info({ targetId, actorId, stripeSubscriptionId, mode, remoteStatus, via }, "Suscripción Stripe ya cancelada: fila local sincronizada por admin");
    return {
      ok: true, mode, alreadyCanceled: true, alreadyScheduled: false, localUpdated: true,
      userDeactivated: mode === "period_end", stripeSubscriptionId, status: "canceled", periodEnd: null,
    };
  };

  // Stripe rechazó la mutación diciendo que la suscripción ya estaba cancelada (p. ej. cancelada
  // desde el dashboard entre nuestro retrieve y el cancel). Se trata como éxito SOLO si un retrieve
  // posterior lo confirma; si no se puede confirmar, se devuelve null y el llamador falla cerrado.
  const confirmCanceledAfterError = async (err: unknown): Promise<CancelSubscriptionResult | null> => {
    if (!isStripeAlreadyCanceledError(err)) return null;
    let check: StripeSubscriptionSnapshot;
    try {
      check = await stripe.retrieve(stripeSubscriptionId);
    } catch (checkErr: unknown) {
      logger.warn({ targetId, stripeSubscriptionId, mode, err: stripeErrorInfo(checkErr).message }, "Stripe: 'already canceled' no confirmable con retrieve; no se toca la fila local");
      return null;
    }
    if (!STRIPE_NON_BILLING.has(check.status)) return null;
    return syncAlreadyCanceled(check.status, "already_canceled_error");
  };

  // 2a) Ya no factura en Stripe según el retrieve.
  if (STRIPE_NON_BILLING.has(remote.status)) {
    return syncAlreadyCanceled(remote.status, "retrieve");
  }

  // 2b) Modo period_end: programar la cancelación (o confirmar que ya lo está) y revocar acceso.
  if (mode === "period_end") {
    const alreadyScheduled = remote.cancelAtPeriodEnd;
    if (!alreadyScheduled) {
      try {
        remote = await stripe.cancelAtPeriodEnd(stripeSubscriptionId);
      } catch (err: unknown) {
        const confirmed = await confirmCanceledAfterError(err);
        if (confirmed) return confirmed;
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
    const confirmed = await confirmCanceledAfterError(err);
    if (confirmed) return confirmed;
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
