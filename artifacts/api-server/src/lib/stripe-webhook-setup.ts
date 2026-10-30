/**
 * Alta automática del webhook de cobros en la cuenta Stripe de la plataforma (STRIPE_SECRET_KEY).
 *
 * - Si ya existe un endpoint que apunta a <APP>/api/billing/stripe/webhook, le añade los eventos
 *   que faltan (sin tocar su secreto) y lo reactiva si estaba desactivado.
 * - Si no existe, lo crea y guarda su secreto de firma, cifrado, como STRIPE_BILLING_WEBHOOK_SECRET
 *   en las claves del panel. No pisa STRIPE_WEBHOOK_SECRET, que puede ser de otro endpoint.
 * Varias instancias arrancando a la vez: un advisory lock de Postgres evita endpoints duplicados.
 */
import type Stripe from "stripe";
import { db } from "@workspace/db";
import { sql } from "drizzle-orm";
import { logger } from "./logger.js";
import { getStripe, STRIPE_API_VERSION } from "./stripe-billing.js";
import { publicAppUrl } from "./account-tokens.js";

export const BILLING_WEBHOOK_PATH = "/api/billing/stripe/webhook";
export const BILLING_WEBHOOK_SECRET_KEY = "STRIPE_BILLING_WEBHOOK_SECRET";

/** Eventos que procesa handleStripeEvent (stripe-billing.ts). */
export const BILLING_WEBHOOK_EVENTS: Stripe.WebhookEndpointCreateParams.EnabledEvent[] = [
  "checkout.session.completed",
  "checkout.session.async_payment_succeeded",
  "checkout.session.expired",
  "invoice.paid",
  "invoice.payment_failed",
  "customer.subscription.updated",
  "customer.subscription.deleted",
];

const LOCK_ID = 774_021_455; // constante arbitraria para pg_advisory_xact_lock

export interface WebhookSetupResult {
  status: "created" | "updated" | "ok" | "skipped";
  url?: string;
  endpointId?: string;
  added?: string[];
  reason?: string;
}

/** URL pública del webhook o null si no hay un dominio https real (local, sin APP_URL…). */
export function billingWebhookUrl(): string | null {
  const base = publicAppUrl();
  if (!base) return null;
  let u: URL;
  try { u = new URL(base); } catch { return null; }
  if (u.protocol !== "https:" || /^(localhost|127\.|0\.0\.0\.0)/.test(u.hostname)) return null;
  return `${u.origin}${BILLING_WEBHOOK_PATH}`;
}

function sameEndpoint(a: string, b: string): boolean {
  try {
    const x = new URL(a), y = new URL(b);
    return x.host.toLowerCase() === y.host.toLowerCase() && x.pathname.replace(/\/+$/, "") === y.pathname.replace(/\/+$/, "");
  } catch { return false; }
}

export async function ensureBillingWebhook(stripe: Stripe | null = getStripe()): Promise<WebhookSetupResult> {
  if (!stripe) return { status: "skipped", reason: "Falta STRIPE_SECRET_KEY" };
  const url = billingWebhookUrl();
  if (!url) return { status: "skipped", reason: "No hay dominio público https (APP_URL / REPLIT_DOMAINS)" };

  return db.transaction(async (tx) => {
    await tx.execute(sql`SELECT pg_advisory_xact_lock(${LOCK_ID})`);
    const existing: Stripe.WebhookEndpoint[] = [];
    for await (const ep of stripe.webhookEndpoints.list({ limit: 100 })) if (sameEndpoint(ep.url, url)) existing.push(ep);

    if (existing.length > 0) {
      const ep = existing.find(e => e.status === "enabled") ?? existing[0];
      const has = new Set(ep.enabled_events);
      const added = has.has("*") ? [] : BILLING_WEBHOOK_EVENTS.filter(e => !has.has(e));
      if (added.length === 0 && ep.status === "enabled") return { status: "ok", url, endpointId: ep.id, added: [] };
      const events = has.has("*") ? undefined : ([...ep.enabled_events, ...added] as Stripe.WebhookEndpointUpdateParams.EnabledEvent[]);
      await stripe.webhookEndpoints.update(ep.id, { ...(events ? { enabled_events: events } : {}), disabled: false });
      logger.info({ endpointId: ep.id, added }, "stripe webhook: eventos añadidos al endpoint existente");
      return { status: "updated", url, endpointId: ep.id, added };
    }

    const ep = await stripe.webhookEndpoints.create({
      url,
      enabled_events: BILLING_WEBHOOK_EVENTS,
      api_version: STRIPE_API_VERSION,
      description: "Shopy Crafter — packs, servicios y pedidos de la tienda",
    });
    if (!ep.secret) throw new Error("Stripe no devolvió el secreto del webhook creado");
    const { storeGeneratedApiKey } = await import("../routes/api-keys.js");
    await storeGeneratedApiKey("stripe", BILLING_WEBHOOK_SECRET_KEY, ep.secret, `Firma del webhook ${ep.id} (creado automáticamente)`);
    logger.info({ endpointId: ep.id, url }, "stripe webhook: endpoint creado y secreto guardado");
    return { status: "created", url, endpointId: ep.id, added: [...BILLING_WEBHOOK_EVENTS] };
  });
}

/** Secretos válidos para verificar la firma: el del endpoint creado por la plataforma y el configurado a mano. */
export function billingWebhookSecrets(): string[] {
  return [process.env[BILLING_WEBHOOK_SECRET_KEY], process.env.STRIPE_WEBHOOK_SECRET]
    .map(s => s?.trim() ?? "").filter((s, i, a) => s && a.indexOf(s) === i);
}
