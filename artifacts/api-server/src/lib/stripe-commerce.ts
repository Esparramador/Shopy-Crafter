/**
 * Reglas de Stripe para catálogo, enlaces de pago, cupones y facturas.
 *
 * Todo lo que aquí se valida es lo que Stripe rechazaría (o aceptaría con un
 * resultado distinto al esperado). Fuentes: OpenAPI oficial de Stripe
 * (spec 2026-09-30) y tipos del SDK stripe-node 22 (API 2026-05-27.dahlia).
 */

// ── Monedas ──────────────────────────────────────────────────────────────────
// https://docs.stripe.com/currencies#zero-decimal  ·  #three-decimal
const ZERO_DECIMAL = new Set([
  "bif", "clp", "djf", "gnf", "jpy", "kmf", "krw", "mga", "pyg", "rwf",
  "ugx", "vnd", "vuv", "xaf", "xof", "xpf",
]);
const THREE_DECIMAL = new Set(["bhd", "jod", "kwd", "omr", "tnd"]);

export const SUPPORTED_CURRENCIES = ["eur", "usd", "gbp", "mxn", "cop", "ars", "clp", "chf", "jpy"] as const;

export class StripeRuleError extends Error {
  status = 400;
}

export function currencyExponent(currency: string): number {
  const c = currency.toLowerCase();
  if (ZERO_DECIMAL.has(c)) return 0;
  if (THREE_DECIMAL.has(c)) return 3;
  return 2;
}

/** Importe decimal introducido por el usuario → unidades mínimas que espera Stripe. */
export function toMinorUnits(amount: unknown, currency: string): number {
  // Aritmética decimal sobre el texto (19.99 o 1,005): evita 1.005 * 100 = 100.4999…
  let txt = typeof amount === "number" ? (Number.isFinite(amount) ? String(amount) : "") : String(amount ?? "").trim().replace(",", ".");
  if (/e/i.test(txt)) txt = Number(txt).toFixed(10);
  const m = /^(\d+)(?:\.(\d*))?$/.exec(txt);
  if (!m) throw new StripeRuleError(`Importe no válido: ${String(amount)}`);
  const exp = currencyExponent(currency);
  const frac = (m[2] ?? "").padEnd(exp + 1, "0");
  let minor = Number(m[1]) * 10 ** exp + Number(frac.slice(0, exp) || "0");
  if (Number(frac[exp]) >= 5) minor += 1;
  if (!Number.isSafeInteger(minor)) throw new StripeRuleError(`Importe demasiado grande: ${String(amount)}`);
  // Stripe exige que los importes en monedas de 3 decimales acaben en 0.
  if (exp === 3) minor = Math.round(minor / 10) * 10;
  return minor;
}

export function fromMinorUnits(minor: number, currency: string): number {
  return minor / 10 ** currencyExponent(currency);
}

// ── Metadata (asociación de pagos / productos con lo que sea) ───────────────
// Límites de Stripe: 50 claves, clave ≤ 40 caracteres sin corchetes, valor ≤ 500.
export function sanitizeMetadata(input: unknown): Record<string, string> {
  if (input == null) return {};
  if (typeof input !== "object" || Array.isArray(input)) throw new StripeRuleError("metadata debe ser un objeto clave → valor");
  const out: Record<string, string> = {};
  for (const [rawKey, rawVal] of Object.entries(input as Record<string, unknown>)) {
    const key = rawKey.trim();
    if (!key) continue;
    if (key.length > 40) throw new StripeRuleError(`Clave de metadata demasiado larga (máx. 40): ${key}`);
    if (/[[\]]/.test(key)) throw new StripeRuleError(`La clave de metadata no puede contener corchetes: ${key}`);
    const val = rawVal == null ? "" : String(rawVal);
    if (val.length > 500) throw new StripeRuleError(`Valor de metadata demasiado largo (máx. 500) en ${key}`);
    out[key] = val;
  }
  if (Object.keys(out).length > 50) throw new StripeRuleError("Stripe admite como máximo 50 claves de metadata");
  return out;
}

/** Tipos de asociación que la UI ofrece; se guardan en metadata con prefijo sc_. */
export const ASSOCIATION_TYPES = ["cliente", "pedido", "servicio", "proyecto", "campaña", "evento", "otro"] as const;

export function associationMetadata(projectId: number, assoc?: { type?: string; ref?: string } | null): Record<string, string> {
  const md: Record<string, string> = { sc_project_id: String(projectId) };
  if (assoc?.type) {
    if (!(ASSOCIATION_TYPES as readonly string[]).includes(assoc.type)) throw new StripeRuleError(`Tipo de asociación no válido: ${assoc.type}`);
    md.sc_ref_type = assoc.type;
  }
  if (assoc?.ref) {
    const ref = assoc.ref.trim();
    if (ref.length > 500) throw new StripeRuleError("La referencia asociada no puede superar 500 caracteres");
    md.sc_ref = ref;
  }
  return md;
}

// ── Precios ──────────────────────────────────────────────────────────────────
export type Interval = "day" | "week" | "month" | "year";
export const INTERVALS: Interval[] = ["day", "week", "month", "year"];

export interface PriceInput {
  amount: number | string;
  currency: string;
  /** Vacío/undefined = pago único. */
  interval?: Interval | "" | null;
  intervalCount?: number | null;
  nickname?: string;
  taxBehavior?: "inclusive" | "exclusive" | "unspecified";
}

/** Stripe: el periodo máximo es 3 años (36 meses, 156 semanas, 1095 días). */
const MAX_INTERVAL_COUNT: Record<Interval, number> = { day: 1095, week: 156, month: 36, year: 3 };

export function normalizePrice(p: PriceInput) {
  const currency = String(p.currency || "").toLowerCase();
  if (!/^[a-z]{3}$/.test(currency)) throw new StripeRuleError(`Moneda no válida: ${p.currency}`);
  const unitAmount = toMinorUnits(p.amount, currency);
  if (unitAmount <= 0) throw new StripeRuleError("El precio debe ser mayor que 0");
  const interval = p.interval || null;
  if (interval && !INTERVALS.includes(interval)) throw new StripeRuleError(`Intervalo no válido: ${interval}`);
  const intervalCount = interval ? Math.floor(Number(p.intervalCount ?? 1)) : null;
  if (interval && (!Number.isFinite(intervalCount!) || intervalCount! < 1 || intervalCount! > MAX_INTERVAL_COUNT[interval])) {
    throw new StripeRuleError(`Cada cuántos ${interval}: entre 1 y ${MAX_INTERVAL_COUNT[interval]} (máximo 3 años)`);
  }
  const taxBehavior = p.taxBehavior ?? "unspecified";
  if (!["inclusive", "exclusive", "unspecified"].includes(taxBehavior)) throw new StripeRuleError("tax_behavior no válido");
  return {
    currency,
    unitAmount,
    recurring: interval ? { interval, intervalCount: intervalCount! } : null,
    nickname: p.nickname?.trim() || undefined,
    taxBehavior,
  };
}

// ── Productos ────────────────────────────────────────────────────────────────
/** Stripe admite hasta 8 imágenes por producto y deben ser URLs públicas. */
export function normalizeImages(images: unknown): string[] {
  if (images == null) return [];
  if (!Array.isArray(images)) throw new StripeRuleError("images debe ser una lista de URLs");
  const urls = images.map(u => String(u).trim()).filter(Boolean);
  if (urls.length > 8) throw new StripeRuleError("Stripe admite como máximo 8 imágenes por producto");
  for (const u of urls) {
    let parsed: URL;
    try { parsed = new URL(u); } catch { throw new StripeRuleError(`URL de imagen no válida: ${u}`); }
    if (parsed.protocol !== "https:" && parsed.protocol !== "http:") throw new StripeRuleError(`La imagen debe ser una URL http(s): ${u}`);
    if (u.length > 2048) throw new StripeRuleError("URL de imagen demasiado larga");
  }
  return urls;
}

// ── Enlaces de pago ──────────────────────────────────────────────────────────
export interface LinkPrice {
  id: string;
  currency: string;
  active: boolean;
  recurring: { interval: Interval; interval_count: number } | null;
}

export interface LinkItemInput {
  priceId: string;
  quantity?: number;
  adjustable?: { enabled: boolean; minimum?: number; maximum?: number } | null;
}

export interface LinkConfigInput {
  items: LinkItemInput[];
  allowPromotionCodes?: boolean;
  billingAddress?: "auto" | "required";
  collectPhone?: boolean;
  shippingCountries?: string[];
  afterCompletion?: { type: "hosted_confirmation"; message?: string } | { type: "redirect"; url: string };
  maxCompletedSessions?: number | null;
  trialDays?: number | null;
  invoiceAfterPayment?: boolean;
  submitType?: "auto" | "pay" | "book" | "donate" | "subscribe";
  description?: string;
  inactiveMessage?: string;
}

export interface LinkPlan {
  mode: "payment" | "subscription";
  currency: string;
}

/**
 * Reglas de Stripe para enlaces de pago:
 *  - 1 a 20 líneas, cada precio activo y todos en la misma moneda.
 *  - Con algún precio recurrente el enlace crea una suscripción; todos los
 *    recurrentes deben tener el mismo intervalo (salvo billing flexible).
 *  - payment_intent_data / invoice_creation / customer_creation: solo pago único.
 *  - subscription_data (prueba gratis): solo con precio recurrente.
 *  - Cantidad ajustable: mínimo ≥ 0, máximo ≤ 999 999, cantidad dentro del rango.
 */
export function planPaymentLink(cfg: LinkConfigInput, prices: Map<string, LinkPrice>): LinkPlan {
  if (!Array.isArray(cfg.items) || cfg.items.length === 0) throw new StripeRuleError("Añade al menos un precio al enlace");
  if (cfg.items.length > 20) throw new StripeRuleError("Stripe admite como máximo 20 líneas por enlace de pago");
  const seen = new Set<string>();
  let currency = "";
  let recurringKey: string | null = null;
  for (const it of cfg.items) {
    const p = prices.get(it.priceId);
    if (!p) throw new StripeRuleError(`Precio no encontrado en Stripe: ${it.priceId}`);
    if (!p.active) throw new StripeRuleError(`El precio ${it.priceId} está archivado`);
    if (seen.has(it.priceId)) throw new StripeRuleError("No repitas el mismo precio en dos líneas: usa la cantidad");
    seen.add(it.priceId);
    if (currency && p.currency !== currency) throw new StripeRuleError("Todos los precios del enlace deben estar en la misma moneda");
    currency = p.currency;
    if (p.recurring) {
      const key = `${p.recurring.interval}:${p.recurring.interval_count}`;
      if (recurringKey && key !== recurringKey) throw new StripeRuleError("Todos los precios recurrentes del enlace deben tener la misma periodicidad");
      recurringKey = key;
    }
    const q = it.quantity ?? 1;
    if (!Number.isInteger(q) || q < 1) throw new StripeRuleError("La cantidad debe ser un entero ≥ 1");
    if (it.adjustable?.enabled) {
      const min = it.adjustable.minimum ?? 0;
      const max = it.adjustable.maximum ?? 99;
      if (!Number.isInteger(min) || min < 0) throw new StripeRuleError("Cantidad mínima no válida");
      if (!Number.isInteger(max) || max < 1 || max > 999_999) throw new StripeRuleError("Cantidad máxima entre 1 y 999 999");
      if (min > max) throw new StripeRuleError("La cantidad mínima no puede superar la máxima");
      if (q < min || q > max) throw new StripeRuleError("La cantidad inicial debe estar entre el mínimo y el máximo");
    }
  }
  const mode = recurringKey ? "subscription" : "payment";
  if (cfg.trialDays != null && cfg.trialDays !== 0) {
    if (mode !== "subscription") throw new StripeRuleError("La prueba gratuita solo se aplica a precios recurrentes");
    if (!Number.isInteger(cfg.trialDays) || cfg.trialDays < 1 || cfg.trialDays > 730) throw new StripeRuleError("Días de prueba entre 1 y 730");
  }
  if (cfg.invoiceAfterPayment && mode !== "payment") throw new StripeRuleError("La factura posterior es para pagos únicos; las suscripciones ya generan factura");
  if (cfg.maxCompletedSessions != null && (!Number.isInteger(cfg.maxCompletedSessions) || cfg.maxCompletedSessions < 1)) {
    throw new StripeRuleError("El límite de ventas debe ser un entero ≥ 1");
  }
  if (cfg.afterCompletion?.type === "redirect") {
    let u: URL;
    try { u = new URL(cfg.afterCompletion.url); } catch { throw new StripeRuleError("URL de redirección no válida"); }
    if (u.protocol !== "https:" && u.protocol !== "http:") throw new StripeRuleError("La redirección debe ser http(s)");
  }
  if (cfg.submitType && cfg.submitType !== "auto") {
    if (mode === "subscription" && cfg.submitType !== "subscribe") throw new StripeRuleError("En suscripciones el botón solo puede ser «Suscribirse»");
    if (mode === "payment" && cfg.submitType === "subscribe") throw new StripeRuleError("«Suscribirse» solo aplica a precios recurrentes");
  }
  if (cfg.afterCompletion?.type === "hosted_confirmation" && (cfg.afterCompletion.message?.length ?? 0) > 500) {
    throw new StripeRuleError("El mensaje de confirmación admite 500 caracteres");
  }
  for (const c of cfg.shippingCountries ?? []) {
    if (!/^[A-Z]{2}$/.test(c)) throw new StripeRuleError(`País de envío no válido (ISO 2 letras): ${c}`);
  }
  return { mode, currency };
}

// ── MRR ──────────────────────────────────────────────────────────────────────
export interface MrrItem {
  unitAmount: number | null;
  quantity: number | null;
  interval: Interval | null;
  intervalCount: number | null;
}

/** Importe mensual equivalente de una línea de suscripción (unidades mínimas). */
export function monthlyAmount(it: MrrItem): number {
  if (!it.unitAmount || !it.interval) return 0;
  const total = it.unitAmount * (it.quantity ?? 1);
  const count = it.intervalCount && it.intervalCount > 0 ? it.intervalCount : 1;
  const perMonth: Record<Interval, number> = { day: 365 / 12, week: 52 / 12, month: 1, year: 1 / 12 };
  return (total * perMonth[it.interval]) / count;
}

// ── Cupones ──────────────────────────────────────────────────────────────────
export interface CouponInput {
  name?: string;
  percentOff?: number | string | null;
  amountOff?: number | string | null;
  currency?: string;
  duration?: "once" | "repeating" | "forever";
  durationInMonths?: number | null;
  maxRedemptions?: number | null;
  redeemBy?: number | null;
  code?: string;
}

export function normalizeCoupon(c: CouponInput) {
  const hasPct = c.percentOff != null && c.percentOff !== "";
  const hasAmt = c.amountOff != null && c.amountOff !== "";
  if (hasPct === hasAmt) throw new StripeRuleError("Indica un porcentaje o un importe fijo (solo uno)");
  const duration = c.duration ?? "once";
  if (!["once", "repeating", "forever"].includes(duration)) throw new StripeRuleError("Duración no válida");
  const out: {
    name?: string; percent_off?: number; amount_off?: number; currency?: string;
    duration: "once" | "repeating" | "forever"; duration_in_months?: number;
    max_redemptions?: number; redeem_by?: number;
  } = { duration };
  if (c.name?.trim()) {
    if (c.name.trim().length > 40) throw new StripeRuleError("El nombre del cupón admite 40 caracteres");
    out.name = c.name.trim();
  }
  if (hasPct) {
    const pct = Number(c.percentOff);
    if (!Number.isFinite(pct) || pct <= 0 || pct > 100) throw new StripeRuleError("El porcentaje debe estar entre 0 y 100");
    out.percent_off = Math.round(pct * 100) / 100;
  } else {
    const cur = String(c.currency || "").toLowerCase();
    if (!/^[a-z]{3}$/.test(cur)) throw new StripeRuleError("Un descuento fijo necesita moneda");
    out.amount_off = toMinorUnits(c.amountOff, cur);
    if (out.amount_off <= 0) throw new StripeRuleError("El descuento debe ser mayor que 0");
    out.currency = cur;
  }
  if (duration === "repeating") {
    const m = Number(c.durationInMonths);
    if (!Number.isInteger(m) || m < 1) throw new StripeRuleError("Indica durante cuántos meses se aplica");
    out.duration_in_months = m;
  }
  if (c.maxRedemptions != null) {
    if (!Number.isInteger(c.maxRedemptions) || c.maxRedemptions < 1) throw new StripeRuleError("Usos máximos: entero ≥ 1");
    out.max_redemptions = c.maxRedemptions;
  }
  if (c.redeemBy != null) {
    const now = Math.floor(Date.now() / 1000);
    if (c.redeemBy <= now) throw new StripeRuleError("La fecha límite debe ser futura");
    if (c.redeemBy > now + 5 * 365 * 86400) throw new StripeRuleError("La fecha límite no puede superar 5 años");
    out.redeem_by = c.redeemBy;
  }
  return out;
}

/** Código promocional: letras, números y guiones (Stripe: a-z A-Z 0-9 y -), máx. 500. */
export function normalizePromoCode(code: string | undefined): string | undefined {
  const v = code?.trim();
  if (!v) return undefined;
  if (!/^[A-Za-z0-9-]+$/.test(v)) throw new StripeRuleError("El código solo admite letras, números y guiones");
  if (v.length > 500) throw new StripeRuleError("Código demasiado largo");
  return v;
}
