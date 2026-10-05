/**
 * stripe-commerce.ts — Catálogo, enlaces de pago, cupones, suscripciones,
 * facturas y pagos de la cuenta Stripe de cada proyecto.
 *
 *   /admin/stripe/project/:id/catalog …            productos + precios
 *   /admin/stripe/project/:id/payment-links …      enlaces de pago, QR, tarjeta, ventas
 *   /admin/stripe/project/:id/quick-link           cobro por importe libre
 *   /admin/stripe/project/:id/coupons …            cupones + códigos promocionales
 *   /admin/stripe/project/:id/subscriptions        alta de suscripción (factura por email)
 *   /admin/stripe/project/:id/invoices             factura multi-línea
 *   /admin/stripe/project/:id/payments …           pagos, asociación y devoluciones
 *
 * Siempre resolución ESTRICTA de la cuenta del proyecto (nunca la Master).
 * Las reglas que Stripe rechazaría se validan antes en lib/stripe-commerce.
 */
import { Router, type Request, type Response } from "express";
import Stripe from "stripe";
import QRCode from "qrcode";
import { requireAdmin } from "../lib/auth.js";
import { logger } from "../lib/logger.js";
import { resolveStripeForProject } from "../lib/stripe-tenant.js";
import {
  StripeRuleError, normalizePrice, normalizeImages, sanitizeMetadata, associationMetadata,
  planPaymentLink, normalizeCoupon, normalizePromoCode, toMinorUnits,
  type PriceInput, type LinkConfigInput, type LinkPrice, type CouponInput, type Interval,
} from "../lib/stripe-commerce.js";

const router = Router();
const BASE = "/admin/stripe/project/:id";

type Assoc = { type?: string; ref?: string } | null | undefined;

function pid(req: Request): number {
  const n = parseInt(String(req.params.id), 10);
  if (!Number.isFinite(n) || n <= 0) throw new StripeRuleError("Proyecto no válido");
  return n;
}

async function stripeFor(req: Request): Promise<Stripe> {
  return (await resolveStripeForProject(pid(req), { strict: true })).stripe;
}

function sendError(res: Response, err: unknown, fallback: string) {
  const e = err as { statusCode?: number; status?: number; message?: string; code?: string; param?: string; type?: string };
  const status = Number(e?.statusCode ?? e?.status) || 500;
  if (status >= 500) logger.error({ err }, `stripe-commerce: ${fallback}`);
  res.status(status >= 400 && status < 600 ? status : 500).json({
    error: e?.message ?? fallback,
    code: e?.code,
    param: e?.param,
  });
}

function str(v: unknown, max = 5000): string | undefined {
  if (v == null) return undefined;
  const s = String(v).trim();
  if (!s) return undefined;
  if (s.length > max) throw new StripeRuleError(`Texto demasiado largo (máx. ${max})`);
  return s;
}

function idOf(x: string | { id: string } | null | undefined): string | null {
  if (!x) return null;
  return typeof x === "string" ? x : x.id;
}

function priceView(p: Stripe.Price) {
  return {
    id: p.id,
    productId: idOf(p.product as string | { id: string }),
    unitAmount: p.unit_amount,
    currency: p.currency,
    type: p.type,
    interval: p.recurring?.interval ?? null,
    intervalCount: p.recurring?.interval_count ?? null,
    nickname: p.nickname,
    active: p.active,
    taxBehavior: p.tax_behavior,
    created: p.created,
    metadata: p.metadata,
  };
}

function productView(p: Stripe.Product, prices: Stripe.Price[]) {
  return {
    id: p.id,
    name: p.name,
    description: p.description,
    active: p.active,
    images: p.images,
    metadata: p.metadata,
    defaultPriceId: idOf(p.default_price as string | { id: string } | null),
    created: p.created,
    updated: p.updated,
    prices: prices.map(priceView),
  };
}

// ════════════════════════════════════════════════════════════════════════════
// CATÁLOGO
// ════════════════════════════════════════════════════════════════════════════

router.get(`${BASE}/catalog`, requireAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    const stripe = await stripeFor(req);
    const includeArchived = req.query.archived === "1";
    const [products, prices] = await Promise.all([
      stripe.products.list(includeArchived ? { limit: 100 } : { limit: 100, active: true }).autoPagingToArray({ limit: 1000 }),
      stripe.prices.list(includeArchived ? { limit: 100 } : { limit: 100, active: true }).autoPagingToArray({ limit: 3000 }),
    ]);
    const byProduct = new Map<string, Stripe.Price[]>();
    for (const pr of prices) {
      const k = idOf(pr.product as string | { id: string });
      if (!k) continue;
      if (!byProduct.has(k)) byProduct.set(k, []);
      byProduct.get(k)!.push(pr);
    }
    res.json({ data: products.map(p => productView(p, byProduct.get(p.id) ?? [])) });
  } catch (err) {
    sendError(res, err, "Error cargando el catálogo");
  }
});

function priceCreateParams(productId: string, input: PriceInput, metadata: Record<string, string>): Stripe.PriceCreateParams {
  const n = normalizePrice(input);
  const params: Stripe.PriceCreateParams = {
    product: productId,
    currency: n.currency,
    unit_amount: n.unitAmount,
    tax_behavior: n.taxBehavior as Stripe.PriceCreateParams.TaxBehavior,
    metadata,
  };
  if (n.nickname) params.nickname = n.nickname;
  if (n.recurring) params.recurring = { interval: n.recurring.interval, interval_count: n.recurring.intervalCount };
  return params;
}

router.post(`${BASE}/catalog/products`, requireAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    const projectId = pid(req);
    const body = req.body as {
      name?: string; description?: string; images?: unknown; metadata?: unknown;
      association?: Assoc; prices?: PriceInput[]; defaultIndex?: number; unitLabel?: string;
    };
    const name = str(body.name, 5000);
    if (!name) throw new StripeRuleError("El producto necesita nombre");
    const images = normalizeImages(body.images);
    const metadata = { ...sanitizeMetadata(body.metadata), ...associationMetadata(projectId, body.association) };
    const priceInputs = Array.isArray(body.prices) ? body.prices : [];
    // Validar todos los precios antes de crear nada en Stripe.
    priceInputs.forEach(p => normalizePrice(p));
    const unitLabel = str(body.unitLabel, 12);

    const stripe = await stripeFor(req);
    const product = await stripe.products.create({
      name,
      description: str(body.description, 40000),
      images,
      metadata,
      ...(unitLabel ? { unit_label: unitLabel } : {}),
    });
    const created: Stripe.Price[] = [];
    for (const p of priceInputs) created.push(await stripe.prices.create(priceCreateParams(product.id, p, { sc_project_id: String(projectId) })));
    let finalProduct = product;
    if (created.length > 0) {
      const idx = Math.min(Math.max(0, Number(body.defaultIndex ?? 0)), created.length - 1);
      finalProduct = await stripe.products.update(product.id, { default_price: created[idx].id });
    }
    res.json({ product: productView(finalProduct, created) });
  } catch (err) {
    sendError(res, err, "Error creando el producto");
  }
});

router.patch(`${BASE}/catalog/products/:productId`, requireAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    const projectId = pid(req);
    const body = req.body as {
      name?: string; description?: string | null; images?: unknown; metadata?: unknown;
      association?: Assoc; active?: boolean; defaultPriceId?: string;
    };
    const params: Stripe.ProductUpdateParams = {};
    if (body.name !== undefined) {
      const name = str(body.name, 5000);
      if (!name) throw new StripeRuleError("El nombre no puede quedar vacío");
      params.name = name;
    }
    // Cadena vacía = borrar la descripción en Stripe.
    if (body.description !== undefined) params.description = body.description ? str(body.description, 40000) ?? "" : "";
    if (body.images !== undefined) params.images = normalizeImages(body.images);
    if (body.metadata !== undefined || body.association !== undefined) {
      params.metadata = { ...sanitizeMetadata(body.metadata), ...associationMetadata(projectId, body.association) };
    }
    if (body.active !== undefined) params.active = Boolean(body.active);
    if (body.defaultPriceId) params.default_price = String(body.defaultPriceId);
    if (Object.keys(params).length === 0) throw new StripeRuleError("Nada que actualizar");
    const stripe = await stripeFor(req);
    const product = await stripe.products.update(String(req.params.productId), params);
    const prices = await stripe.prices.list({ product: product.id, limit: 100 }).autoPagingToArray({ limit: 500 });
    res.json({ product: productView(product, prices) });
  } catch (err) {
    sendError(res, err, "Error actualizando el producto");
  }
});

router.post(`${BASE}/catalog/products/:productId/prices`, requireAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    const projectId = pid(req);
    const body = req.body as PriceInput & { makeDefault?: boolean };
    const stripe = await stripeFor(req);
    const productId = String(req.params.productId);
    const price = await stripe.prices.create(priceCreateParams(productId, body, { sc_project_id: String(projectId) }));
    if (body.makeDefault) await stripe.products.update(productId, { default_price: price.id });
    res.json({ price: priceView(price) });
  } catch (err) {
    sendError(res, err, "Error creando el precio");
  }
});

// Los importes de un precio son inmutables en Stripe: para "cambiar" un precio
// se crea uno nuevo y se archiva el anterior. Aquí solo se archiva/reactiva o renombra.
router.patch(`${BASE}/catalog/prices/:priceId`, requireAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    const body = req.body as { active?: boolean; nickname?: string | null };
    const stripe = await stripeFor(req);
    const priceId = String(req.params.priceId);
    if (body.active === false) {
      const current = await stripe.prices.retrieve(priceId, { expand: ["product"] });
      const product = current.product as Stripe.Product | Stripe.DeletedProduct;
      if (!("deleted" in product) && idOf(product.default_price as string | { id: string } | null) === priceId) {
        throw new StripeRuleError("Es el precio por defecto del producto: elige otro precio por defecto antes de archivarlo");
      }
    }
    const params: Stripe.PriceUpdateParams = {};
    if (body.active !== undefined) params.active = Boolean(body.active);
    if (body.nickname !== undefined) params.nickname = body.nickname ? str(body.nickname, 5000) ?? "" : "";
    if (Object.keys(params).length === 0) throw new StripeRuleError("Nada que actualizar");
    const price = await stripe.prices.update(priceId, params);
    res.json({ price: priceView(price) });
  } catch (err) {
    sendError(res, err, "Error actualizando el precio");
  }
});

// ════════════════════════════════════════════════════════════════════════════
// ENLACES DE PAGO
// ════════════════════════════════════════════════════════════════════════════

function linkView(l: Stripe.PaymentLink) {
  const items = (l.line_items?.data ?? []).map(li => ({
    priceId: li.price?.id ?? null,
    productId: idOf(li.price?.product as string | { id: string } | undefined),
    description: li.description,
    quantity: li.quantity,
    amount: li.amount_total,
    currency: li.currency,
    interval: li.price?.recurring?.interval ?? null,
    intervalCount: li.price?.recurring?.interval_count ?? null,
  }));
  return {
    id: l.id,
    url: l.url,
    active: l.active,
    metadata: l.metadata,
    currency: l.currency,
    allowPromotionCodes: l.allow_promotion_codes,
    billingAddress: l.billing_address_collection,
    collectPhone: l.phone_number_collection?.enabled ?? false,
    shippingCountries: l.shipping_address_collection?.allowed_countries ?? [],
    afterCompletion: l.after_completion,
    maxCompletedSessions: l.restrictions?.completed_sessions?.limit ?? null,
    completedSessions: l.restrictions?.completed_sessions?.count ?? null,
    trialDays: l.subscription_data?.trial_period_days ?? null,
    invoiceAfterPayment: l.invoice_creation?.enabled ?? false,
    submitType: l.submit_type,
    items,
    mode: items.some(i => i.interval) ? "subscription" : "payment",
  };
}

router.get(`${BASE}/payment-links`, requireAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    const stripe = await stripeFor(req);
    const params: Stripe.PaymentLinkListParams = { limit: 100, expand: ["data.line_items"] };
    if (req.query.active === "1") params.active = true;
    const links = await stripe.paymentLinks.list(params).autoPagingToArray({ limit: 500 });
    res.json({ data: links.map(linkView) });
  } catch (err) {
    sendError(res, err, "Error cargando los enlaces de pago");
  }
});

async function loadLinkPrices(stripe: Stripe, ids: string[]): Promise<Map<string, LinkPrice>> {
  const map = new Map<string, LinkPrice>();
  await Promise.all([...new Set(ids)].map(async id => {
    try {
      const p = await stripe.prices.retrieve(id);
      map.set(id, {
        id: p.id, currency: p.currency, active: p.active,
        recurring: p.recurring ? { interval: p.recurring.interval as Interval, interval_count: p.recurring.interval_count } : null,
      });
    } catch (err) {
      const e = err as { statusCode?: number };
      if (e?.statusCode !== 404) throw err;
    }
  }));
  return map;
}

function buildLinkParams(cfg: LinkConfigInput, mode: "payment" | "subscription", metadata: Record<string, string>): Stripe.PaymentLinkCreateParams {
  const params: Stripe.PaymentLinkCreateParams = {
    line_items: cfg.items.map(it => {
      const li: Stripe.PaymentLinkCreateParams.LineItem = { price: it.priceId, quantity: it.quantity ?? 1 };
      if (it.adjustable?.enabled) {
        li.adjustable_quantity = { enabled: true, minimum: it.adjustable.minimum ?? 0, maximum: it.adjustable.maximum ?? 99 };
      }
      return li;
    }),
    metadata,
    allow_promotion_codes: Boolean(cfg.allowPromotionCodes),
    billing_address_collection: cfg.billingAddress === "required" ? "required" : "auto",
  };
  if (cfg.collectPhone) params.phone_number_collection = { enabled: true };
  if (cfg.shippingCountries?.length) {
    params.shipping_address_collection = {
      allowed_countries: cfg.shippingCountries as Stripe.PaymentLinkCreateParams.ShippingAddressCollection.AllowedCountry[],
    };
  }
  if (cfg.afterCompletion?.type === "redirect") {
    params.after_completion = { type: "redirect", redirect: { url: cfg.afterCompletion.url } };
  } else if (cfg.afterCompletion?.type === "hosted_confirmation" && cfg.afterCompletion.message) {
    params.after_completion = { type: "hosted_confirmation", hosted_confirmation: { custom_message: cfg.afterCompletion.message } };
  }
  if (cfg.maxCompletedSessions) params.restrictions = { completed_sessions: { limit: cfg.maxCompletedSessions } };
  if (cfg.submitType && cfg.submitType !== "auto") params.submit_type = cfg.submitType;
  if (cfg.inactiveMessage) params.inactive_message = str(cfg.inactiveMessage, 500);

  if (mode === "payment") {
    // La asociación viaja al PaymentIntent de cada venta: así cada pago queda vinculado.
    params.payment_intent_data = { metadata, ...(cfg.description ? { description: str(cfg.description, 1000) } : {}) };
    params.customer_creation = "always";
    if (cfg.invoiceAfterPayment) params.invoice_creation = { enabled: true, invoice_data: { metadata } };
  } else {
    params.subscription_data = {
      metadata,
      ...(cfg.description ? { description: str(cfg.description, 500) } : {}),
      ...(cfg.trialDays ? { trial_period_days: cfg.trialDays } : {}),
    };
  }
  return params;
}

router.post(`${BASE}/payment-links`, requireAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    const projectId = pid(req);
    const body = req.body as LinkConfigInput & { association?: Assoc; metadata?: unknown };
    const stripe = await stripeFor(req);
    const prices = await loadLinkPrices(stripe, (body.items ?? []).map(i => String(i.priceId)));
    const plan = planPaymentLink(body, prices);
    const metadata = { ...sanitizeMetadata(body.metadata), ...associationMetadata(projectId, body.association) };
    const link = await stripe.paymentLinks.create(buildLinkParams(body, plan.mode, metadata));
    const full = await stripe.paymentLinks.retrieve(link.id, { expand: ["line_items"] });
    res.json({ link: linkView(full) });
  } catch (err) {
    sendError(res, err, "Error creando el enlace de pago");
  }
});

// Cobro por importe libre: crea el producto en línea dentro del enlace.
router.post(`${BASE}/quick-link`, requireAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    const projectId = pid(req);
    const body = req.body as { amount?: number | string; currency?: string; concept?: string; association?: Assoc; invoiceAfterPayment?: boolean; singleUse?: boolean };
    const currency = String(body.currency || "eur").toLowerCase();
    const unitAmount = toMinorUnits(body.amount, currency);
    if (unitAmount <= 0) throw new StripeRuleError("El importe debe ser mayor que 0");
    const concept = str(body.concept, 250);
    if (!concept) throw new StripeRuleError("Indica el concepto del cobro (aparece en la página de pago y en el recibo)");
    const metadata = associationMetadata(projectId, body.association);
    const stripe = await stripeFor(req);
    const params: Stripe.PaymentLinkCreateParams = {
      line_items: [{ quantity: 1, price_data: { currency, unit_amount: unitAmount, product_data: { name: concept, metadata } } }],
      metadata,
      payment_intent_data: { metadata, description: concept },
      customer_creation: "always",
    };
    if (body.invoiceAfterPayment) params.invoice_creation = { enabled: true, invoice_data: { metadata } };
    if (body.singleUse) params.restrictions = { completed_sessions: { limit: 1 } };
    const link = await stripe.paymentLinks.create(params);
    const full = await stripe.paymentLinks.retrieve(link.id, { expand: ["line_items"] });
    res.json({ link: linkView(full) });
  } catch (err) {
    sendError(res, err, "Error creando el cobro");
  }
});

router.patch(`${BASE}/payment-links/:linkId`, requireAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    const projectId = pid(req);
    const body = req.body as { active?: boolean; association?: Assoc; metadata?: unknown };
    const params: Stripe.PaymentLinkUpdateParams = {};
    if (body.active !== undefined) params.active = Boolean(body.active);
    if (body.metadata !== undefined || body.association !== undefined) {
      params.metadata = { ...sanitizeMetadata(body.metadata), ...associationMetadata(projectId, body.association) };
    }
    if (Object.keys(params).length === 0) throw new StripeRuleError("Nada que actualizar");
    const stripe = await stripeFor(req);
    await stripe.paymentLinks.update(String(req.params.linkId), params);
    const full = await stripe.paymentLinks.retrieve(String(req.params.linkId), { expand: ["line_items"] });
    res.json({ link: linkView(full) });
  } catch (err) {
    sendError(res, err, "Error actualizando el enlace");
  }
});

router.get(`${BASE}/payment-links/:linkId/qr`, requireAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    const stripe = await stripeFor(req);
    const link = await stripe.paymentLinks.retrieve(String(req.params.linkId));
    const dataUrl = await QRCode.toDataURL(link.url, { errorCorrectionLevel: "M", margin: 2, width: 512 });
    res.json({ url: link.url, dataUrl });
  } catch (err) {
    sendError(res, err, "Error generando el QR");
  }
});

// Ventas completadas de un enlace (cada Checkout Session con su cliente e importe).
router.get(`${BASE}/payment-links/:linkId/sales`, requireAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    const stripe = await stripeFor(req);
    const sessions = await stripe.checkout.sessions
      .list({ payment_link: String(req.params.linkId), status: "complete", limit: 100 })
      .autoPagingToArray({ limit: 500 });
    res.json({
      data: sessions.map(s => ({
        id: s.id,
        created: s.created,
        amountTotal: s.amount_total,
        currency: s.currency,
        paymentStatus: s.payment_status,
        email: s.customer_details?.email ?? null,
        name: s.customer_details?.name ?? null,
        customerId: idOf(s.customer as string | { id: string } | null),
        paymentIntentId: idOf(s.payment_intent as string | { id: string } | null),
        subscriptionId: idOf(s.subscription as string | { id: string } | null),
      })),
    });
  } catch (err) {
    sendError(res, err, "Error cargando las ventas del enlace");
  }
});

// ── Tarjeta compartible (SVG con imagen, precio y QR incrustados) ─────────────
function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function wrap(text: string, maxChars: number, maxLines: number): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let cur = "";
  for (const w of words) {
    const next = cur ? `${cur} ${w}` : w;
    if (next.length > maxChars && cur) { lines.push(cur); cur = w; } else cur = next;
    if (lines.length === maxLines) break;
  }
  if (lines.length < maxLines && cur) lines.push(cur);
  if (lines.length === maxLines && words.join(" ").length > lines.join(" ").length) {
    lines[maxLines - 1] = lines[maxLines - 1].replace(/\s*\S*$/, "") + "…";
  }
  return lines;
}

const INTERVAL_ES: Record<string, [string, string]> = {
  day: ["día", "días"], week: ["semana", "semanas"], month: ["mes", "meses"], year: ["año", "años"],
};

function priceLabel(amount: number | null, currency: string | null, interval: string | null, count: number | null): string {
  if (amount == null || !currency) return "";
  const exp = ["bif", "clp", "djf", "gnf", "jpy", "kmf", "krw", "mga", "pyg", "rwf", "ugx", "vnd", "vuv", "xaf", "xof", "xpf"].includes(currency) ? 0
    : ["bhd", "jod", "kwd", "omr", "tnd"].includes(currency) ? 3 : 2;
  const money = new Intl.NumberFormat("es-ES", { style: "currency", currency: currency.toUpperCase() }).format(amount / 10 ** exp);
  if (!interval) return money;
  const [one, many] = INTERVAL_ES[interval] ?? [interval, interval];
  return count && count > 1 ? `${money} cada ${count} ${many}` : `${money} / ${one}`;
}

async function imageAsDataUri(url: string): Promise<string | null> {
  try {
    const u = new URL(url);
    if (u.protocol !== "https:") return null;
    const r = await fetch(u, { signal: AbortSignal.timeout(8000) });
    if (!r.ok) return null;
    const type = r.headers.get("content-type") ?? "";
    if (!/^image\/(png|jpe?g|webp|gif)/.test(type)) return null;
    const buf = Buffer.from(await r.arrayBuffer());
    if (buf.length > 4 * 1024 * 1024) return null;
    return `data:${type.split(";")[0]};base64,${buf.toString("base64")}`;
  } catch {
    return null;
  }
}

router.get(`${BASE}/payment-links/:linkId/card`, requireAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    const stripe = await stripeFor(req);
    const link = await stripe.paymentLinks.retrieve(String(req.params.linkId), { expand: ["line_items.data.price.product"] });
    const first = link.line_items?.data?.[0];
    const product = first?.price?.product as Stripe.Product | undefined;
    const title = product && !("deleted" in product) ? product.name : first?.description ?? "Pago";
    const desc = product && !("deleted" in product) ? product.description ?? "" : "";
    const imgUrl = product && !("deleted" in product) ? product.images?.[0] : undefined;
    const extra = (link.line_items?.data?.length ?? 1) - 1;
    const price = first
      ? priceLabel(first.price?.unit_amount ?? first.amount_total, first.currency, first.price?.recurring?.interval ?? null, first.price?.recurring?.interval_count ?? null)
      : "";
    const brand = str(req.query.brand, 60) ?? "";
    const accent = /^#[0-9a-fA-F]{6}$/.test(String(req.query.accent ?? "")) ? String(req.query.accent) : "#635bff";
    const [qr, img] = await Promise.all([
      QRCode.toDataURL(link.url, { errorCorrectionLevel: "M", margin: 1, width: 360 }),
      imgUrl ? imageAsDataUri(imgUrl) : Promise.resolve(null),
    ]);
    const W = 1080, H = 1350;
    // El precio no puede invadir el QR: ancho útil 1080 − 72 − 300 − 72 − 30 ≈ 606 px
    // (Helvetica bold ≈ 0,6 em por carácter).
    const priceSize = Math.max(34, Math.min(70, Math.floor(606 / (Math.max(price.length, 1) * 0.6))));
    const titleLines = wrap(title, 26, 2);
    const descLines = desc ? wrap(desc, 48, 3) : [];
    const imgH = 620;
    const yTitle = imgH + 110;
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#14141f"/><stop offset="1" stop-color="#0b0b12"/></linearGradient>
    <clipPath id="ic"><rect x="0" y="0" width="${W}" height="${imgH}"/></clipPath>
  </defs>
  <rect width="${W}" height="${H}" fill="url(#bg)"/>
  ${img
    ? `<image href="${img}" x="0" y="0" width="${W}" height="${imgH}" preserveAspectRatio="xMidYMid slice" clip-path="url(#ic)"/>`
    : `<rect x="0" y="0" width="${W}" height="${imgH}" fill="${accent}" opacity="0.18"/><text x="${W / 2}" y="${imgH / 2 + 30}" text-anchor="middle" font-family="Helvetica, Arial, sans-serif" font-size="96" font-weight="800" fill="${accent}">${esc(title.slice(0, 1).toUpperCase())}</text>`}
  <rect x="0" y="${imgH - 4}" width="${W}" height="8" fill="${accent}"/>
  ${brand ? `<text x="72" y="${imgH + 52}" font-family="Helvetica, Arial, sans-serif" font-size="28" font-weight="700" letter-spacing="4" fill="${accent}">${esc(brand.toUpperCase())}</text>` : ""}
  ${titleLines.map((l, i) => `<text x="72" y="${yTitle + i * 72}" font-family="Helvetica, Arial, sans-serif" font-size="62" font-weight="800" fill="#ffffff">${esc(l)}</text>`).join("\n  ")}
  ${descLines.map((l, i) => `<text x="72" y="${yTitle + titleLines.length * 72 + 20 + i * 42}" font-family="Helvetica, Arial, sans-serif" font-size="32" fill="#b9b6c8">${esc(l)}</text>`).join("\n  ")}
  <text x="72" y="${H - 150}" font-family="Helvetica, Arial, sans-serif" font-size="${priceSize}" font-weight="800" fill="${accent}">${esc(price)}</text>
  ${extra > 0 ? `<text x="72" y="${H - 100}" font-family="Helvetica, Arial, sans-serif" font-size="28" fill="#b9b6c8">+ ${extra} artículo${extra > 1 ? "s" : ""} más</text>` : ""}
  <text x="72" y="${H - 56}" font-family="Helvetica, Arial, sans-serif" font-size="26" fill="#8a879a">Paga de forma segura con Stripe · Escanea el QR</text>
  <rect x="${W - 72 - 300}" y="${H - 72 - 300}" width="300" height="300" rx="18" fill="#ffffff"/>
  <image href="${qr}" x="${W - 72 - 290}" y="${H - 72 - 290}" width="280" height="280"/>
</svg>`;
    res.setHeader("Content-Type", "image/svg+xml; charset=utf-8");
    res.setHeader("Cache-Control", "no-store");
    res.send(svg);
  } catch (err) {
    sendError(res, err, "Error generando la tarjeta");
  }
});

// ════════════════════════════════════════════════════════════════════════════
// CUPONES Y CÓDIGOS PROMOCIONALES
// ════════════════════════════════════════════════════════════════════════════

router.get(`${BASE}/coupons`, requireAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    const stripe = await stripeFor(req);
    const [coupons, codes] = await Promise.all([
      stripe.coupons.list({ limit: 100 }).autoPagingToArray({ limit: 500 }),
      stripe.promotionCodes.list({ limit: 100 }).autoPagingToArray({ limit: 1000 }),
    ]);
    const codesByCoupon = new Map<string, Stripe.PromotionCode[]>();
    for (const c of codes) {
      const couponId = idOf(c.promotion?.coupon as string | { id: string } | null | undefined);
      if (!couponId) continue;
      if (!codesByCoupon.has(couponId)) codesByCoupon.set(couponId, []);
      codesByCoupon.get(couponId)!.push(c);
    }
    res.json({
      data: coupons.map(c => ({
        id: c.id, name: c.name, percentOff: c.percent_off, amountOff: c.amount_off, currency: c.currency,
        duration: c.duration, durationInMonths: c.duration_in_months, maxRedemptions: c.max_redemptions,
        timesRedeemed: c.times_redeemed, redeemBy: c.redeem_by, valid: c.valid, created: c.created,
        codes: (codesByCoupon.get(c.id) ?? []).map(pc => ({
          id: pc.id, code: pc.code, active: pc.active, timesRedeemed: pc.times_redeemed,
          maxRedemptions: pc.max_redemptions, expiresAt: pc.expires_at,
          firstTimeOnly: pc.restrictions?.first_time_transaction ?? false,
        })),
      })),
    });
  } catch (err) {
    sendError(res, err, "Error cargando cupones");
  }
});

router.post(`${BASE}/coupons`, requireAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    const projectId = pid(req);
    const body = req.body as CouponInput & { firstTimeOnly?: boolean; codeMaxRedemptions?: number | null; minimumAmount?: number | string | null };
    const couponParams = normalizeCoupon(body);
    const code = normalizePromoCode(body.code);
    const stripe = await stripeFor(req);
    const coupon = await stripe.coupons.create({ ...couponParams, metadata: { sc_project_id: String(projectId) } });
    let promotionCode: Stripe.PromotionCode | null = null;
    if (code) {
      const restrictions: Stripe.PromotionCodeCreateParams.Restrictions = {};
      if (body.firstTimeOnly) restrictions.first_time_transaction = true;
      if (body.minimumAmount != null && body.minimumAmount !== "") {
        const cur = couponParams.currency ?? "eur";
        restrictions.minimum_amount = toMinorUnits(body.minimumAmount, cur);
        restrictions.minimum_amount_currency = cur;
      }
      try {
        promotionCode = await stripe.promotionCodes.create({
          promotion: { type: "coupon", coupon: coupon.id },
          code,
          ...(body.codeMaxRedemptions ? { max_redemptions: Number(body.codeMaxRedemptions) } : {}),
          ...(Object.keys(restrictions).length ? { restrictions } : {}),
          metadata: { sc_project_id: String(projectId) },
        });
      } catch (err) {
        // Sin código el cupón suelto no sirve en enlaces de pago: se deshace.
        await stripe.coupons.del(coupon.id).catch(() => undefined);
        throw err;
      }
    }
    res.json({ coupon, promotionCode });
  } catch (err) {
    sendError(res, err, "Error creando el cupón");
  }
});

router.post(`${BASE}/coupons/:couponId/codes`, requireAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    const projectId = pid(req);
    const body = req.body as { code?: string; maxRedemptions?: number | null; firstTimeOnly?: boolean };
    const code = normalizePromoCode(body.code);
    if (!code) throw new StripeRuleError("Indica el código");
    const stripe = await stripeFor(req);
    const promotionCode = await stripe.promotionCodes.create({
      promotion: { type: "coupon", coupon: String(req.params.couponId) },
      code,
      ...(body.maxRedemptions ? { max_redemptions: Number(body.maxRedemptions) } : {}),
      ...(body.firstTimeOnly ? { restrictions: { first_time_transaction: true } } : {}),
      metadata: { sc_project_id: String(projectId) },
    });
    res.json({ promotionCode });
  } catch (err) {
    sendError(res, err, "Error creando el código");
  }
});

router.patch(`${BASE}/promotion-codes/:codeId`, requireAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    const stripe = await stripeFor(req);
    const promotionCode = await stripe.promotionCodes.update(String(req.params.codeId), { active: Boolean((req.body as { active?: boolean }).active) });
    res.json({ promotionCode });
  } catch (err) {
    sendError(res, err, "Error actualizando el código");
  }
});

// Borrar un cupón impide nuevos usos; los descuentos ya aplicados se mantienen.
router.delete(`${BASE}/coupons/:couponId`, requireAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    const stripe = await stripeFor(req);
    const deleted = await stripe.coupons.del(String(req.params.couponId));
    res.json({ deleted: deleted.deleted });
  } catch (err) {
    sendError(res, err, "Error borrando el cupón");
  }
});

// ════════════════════════════════════════════════════════════════════════════
// SUSCRIPCIONES (alta desde el panel: Stripe envía la factura por email)
// ════════════════════════════════════════════════════════════════════════════

router.post(`${BASE}/subscriptions`, requireAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    const projectId = pid(req);
    const body = req.body as {
      customerId?: string; items?: Array<{ priceId: string; quantity?: number }>;
      daysUntilDue?: number; trialDays?: number | null; couponId?: string; association?: Assoc;
    };
    const customerId = str(body.customerId, 255);
    if (!customerId) throw new StripeRuleError("Elige el cliente");
    const items = Array.isArray(body.items) ? body.items : [];
    if (items.length === 0) throw new StripeRuleError("Añade al menos un precio recurrente");
    if (items.length > 20) throw new StripeRuleError("Máximo 20 precios por suscripción");
    const daysUntilDue = Math.floor(Number(body.daysUntilDue ?? 7));
    if (!Number.isFinite(daysUntilDue) || daysUntilDue < 1 || daysUntilDue > 365) throw new StripeRuleError("Días para pagar: entre 1 y 365");
    const trialDays = body.trialDays ? Math.floor(Number(body.trialDays)) : 0;
    if (trialDays && (trialDays < 1 || trialDays > 730)) throw new StripeRuleError("Días de prueba entre 1 y 730");

    const stripe = await stripeFor(req);
    const prices = await loadLinkPrices(stripe, items.map(i => String(i.priceId)));
    let key: string | null = null;
    let currency = "";
    for (const it of items) {
      const p = prices.get(String(it.priceId));
      if (!p) throw new StripeRuleError(`Precio no encontrado: ${it.priceId}`);
      if (!p.active) throw new StripeRuleError(`El precio ${it.priceId} está archivado`);
      if (!p.recurring) throw new StripeRuleError("Una suscripción solo admite precios recurrentes; usa una factura para cobros únicos");
      const k = `${p.recurring.interval}:${p.recurring.interval_count}`;
      if (key && k !== key) throw new StripeRuleError("Todos los precios de la suscripción deben tener la misma periodicidad");
      if (currency && p.currency !== currency) throw new StripeRuleError("Todos los precios deben estar en la misma moneda");
      key = k; currency = p.currency;
      const q = it.quantity ?? 1;
      if (!Number.isInteger(q) || q < 1) throw new StripeRuleError("Cantidad: entero ≥ 1");
    }
    const customer = await stripe.customers.retrieve(customerId);
    if ("deleted" in customer && customer.deleted) throw new StripeRuleError("El cliente está eliminado");
    if (!("deleted" in customer) && !customer.email) throw new StripeRuleError("El cliente necesita email: Stripe le envía ahí la factura de cada periodo");

    const metadata = associationMetadata(projectId, body.association);
    const sub = await stripe.subscriptions.create({
      customer: customerId,
      items: items.map(i => ({ price: String(i.priceId), quantity: i.quantity ?? 1 })),
      collection_method: "send_invoice",
      days_until_due: daysUntilDue,
      ...(trialDays ? { trial_period_days: trialDays } : {}),
      ...(body.couponId ? { discounts: [{ coupon: String(body.couponId) }] } : {}),
      metadata,
    });
    res.json({ subscription: { id: sub.id, status: sub.status } });
  } catch (err) {
    sendError(res, err, "Error creando la suscripción");
  }
});

router.patch(`${BASE}/subscriptions/:subId`, requireAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    const body = req.body as { cancelAtPeriodEnd?: boolean };
    if (body.cancelAtPeriodEnd === undefined) throw new StripeRuleError("Nada que actualizar");
    const stripe = await stripeFor(req);
    const sub = await stripe.subscriptions.update(String(req.params.subId), { cancel_at_period_end: Boolean(body.cancelAtPeriodEnd) });
    res.json({ subscription: { id: sub.id, status: sub.status, cancelAtPeriodEnd: sub.cancel_at_period_end } });
  } catch (err) {
    sendError(res, err, "Error actualizando la suscripción");
  }
});

// ════════════════════════════════════════════════════════════════════════════
// FACTURAS
// ════════════════════════════════════════════════════════════════════════════
//
// Orden correcto: factura en borrador → líneas con `invoice` → finalizar.
// Crear las líneas antes (pending invoice items) deja la factura VACÍA: desde
// la API 2022-08-01 `pending_invoice_items_behavior` es `exclude` por defecto.

type InvoiceLine = { priceId?: string; quantity?: number; description?: string; amount?: number | string };

router.post(`${BASE}/invoices`, requireAdmin, async (req: Request, res: Response): Promise<void> => {
  let draftId: string | null = null;
  let stripe: Stripe | null = null;
  try {
    const projectId = pid(req);
    const body = req.body as {
      customerId?: string; lines?: InvoiceLine[]; currency?: string; daysUntilDue?: number | string;
      autoSend?: boolean; couponId?: string; footer?: string; memo?: string; association?: Assoc;
    };
    const customerId = str(body.customerId, 255);
    if (!customerId) throw new StripeRuleError("Elige el cliente");
    const lines = Array.isArray(body.lines) ? body.lines : [];
    if (lines.length === 0) throw new StripeRuleError("Añade al menos una línea");
    if (lines.length > 250) throw new StripeRuleError("Máximo 250 líneas por factura");
    const daysUntilDue = Math.floor(Number(body.daysUntilDue ?? 30));
    if (!Number.isFinite(daysUntilDue) || daysUntilDue < 1 || daysUntilDue > 365) throw new StripeRuleError("Días hasta vencimiento: entre 1 y 365");

    stripe = await stripeFor(req);
    const prices = await loadLinkPrices(stripe, lines.filter(l => l.priceId).map(l => String(l.priceId)));
    let currency = body.currency ? String(body.currency).toLowerCase() : "";
    for (const l of lines) {
      if (l.priceId) {
        const p = prices.get(String(l.priceId));
        if (!p) throw new StripeRuleError(`Precio no encontrado: ${l.priceId}`);
        if (p.recurring) throw new StripeRuleError("Las facturas sueltas solo admiten precios de pago único; para cobros periódicos crea una suscripción");
        if (currency && p.currency !== currency) throw new StripeRuleError("Todas las líneas deben estar en la misma moneda");
        currency = p.currency;
      }
    }
    if (!currency) currency = "eur";
    for (const l of lines) {
      if (!l.priceId) {
        if (!str(l.description, 500)) throw new StripeRuleError("Cada línea libre necesita concepto");
        if (toMinorUnits(l.amount, currency) <= 0) throw new StripeRuleError("Cada línea libre necesita un importe mayor que 0");
      }
      const q = l.quantity ?? 1;
      if (!Number.isInteger(q) || q < 1) throw new StripeRuleError("Cantidad: entero ≥ 1");
    }
    const customer = await stripe.customers.retrieve(customerId);
    if ("deleted" in customer && customer.deleted) throw new StripeRuleError("El cliente está eliminado");
    if (!("deleted" in customer) && !customer.email) throw new StripeRuleError("El cliente necesita email para recibir la factura");

    const metadata = associationMetadata(projectId, body.association);
    const draft = await stripe.invoices.create({
      customer: customerId,
      currency,
      collection_method: "send_invoice",
      days_until_due: daysUntilDue,
      auto_advance: false,
      pending_invoice_items_behavior: "exclude",
      metadata,
      ...(body.couponId ? { discounts: [{ coupon: String(body.couponId) }] } : {}),
      ...(str(body.footer, 5000) ? { footer: str(body.footer, 5000) } : {}),
      ...(str(body.memo, 1500) ? { description: str(body.memo, 1500) } : {}),
    });
    draftId = draft.id ?? null;
    if (!draftId) throw new Error("Stripe no devolvió el id de la factura");
    for (const l of lines) {
      const quantity = l.quantity ?? 1;
      if (l.priceId) {
        await stripe.invoiceItems.create({ customer: customerId, invoice: draftId, pricing: { price: String(l.priceId) }, quantity, metadata });
      } else {
        const unit = toMinorUnits(l.amount, currency);
        await stripe.invoiceItems.create({
          customer: customerId, invoice: draftId, currency,
          description: str(l.description, 500)!,
          ...(quantity > 1 ? { quantity, unit_amount_decimal: Stripe.Decimal.from(unit) } : { amount: unit }),
          metadata,
        });
      }
    }
    const finalized = await stripe.invoices.finalizeInvoice(draftId);
    draftId = null;
    const sent = body.autoSend && finalized.id ? await stripe.invoices.sendInvoice(finalized.id) : finalized;
    res.json({
      invoice: {
        id: sent.id, number: sent.number, status: sent.status, amountDue: sent.amount_due,
        currency: sent.currency, hostedInvoiceUrl: sent.hosted_invoice_url, pdfUrl: sent.invoice_pdf,
      },
    });
  } catch (err) {
    // No dejar borradores huérfanos si algo falla antes de finalizar.
    if (draftId && stripe) await stripe.invoices.del(draftId).catch(() => undefined);
    sendError(res, err, "Error creando la factura");
  }
});

// Borradores: Stripe no permite anularlos (solo facturas abiertas); se emiten o se borran.
router.post(`${BASE}/invoices/:invId/finalize`, requireAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    const stripe = await stripeFor(req);
    const inv = await stripe.invoices.finalizeInvoice(String(req.params.invId));
    res.json({ status: inv.status, number: inv.number, hostedInvoiceUrl: inv.hosted_invoice_url });
  } catch (err) {
    sendError(res, err, "Error emitiendo la factura");
  }
});

router.delete(`${BASE}/invoices/:invId`, requireAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    const stripe = await stripeFor(req);
    const inv = await stripe.invoices.retrieve(String(req.params.invId));
    if (inv.status !== "draft") throw new StripeRuleError("Solo se pueden borrar borradores; una factura emitida se anula");
    const deleted = await stripe.invoices.del(String(req.params.invId));
    res.json({ deleted: deleted.deleted });
  } catch (err) {
    sendError(res, err, "Error borrando el borrador");
  }
});

// ════════════════════════════════════════════════════════════════════════════
// PAGOS: listado, asociación y devoluciones
// ════════════════════════════════════════════════════════════════════════════

router.get(`${BASE}/payments`, requireAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    const stripe = await stripeFor(req);
    const limit = Math.min(Math.max(1, parseInt(String(req.query.limit ?? "50"), 10) || 50), 100);
    const list = await stripe.paymentIntents.list({ limit, expand: ["data.latest_charge", "data.customer"] });
    res.json({
      data: list.data.map(pi => {
        const ch = pi.latest_charge && typeof pi.latest_charge === "object" ? pi.latest_charge : null;
        const cu = pi.customer && typeof pi.customer === "object" && !("deleted" in pi.customer) ? pi.customer : null;
        return {
          id: pi.id,
          amount: pi.amount,
          amountReceived: pi.amount_received,
          amountRefunded: ch?.amount_refunded ?? 0,
          currency: pi.currency,
          status: pi.status,
          description: pi.description,
          created: pi.created,
          email: ch?.billing_details?.email ?? ch?.receipt_email ?? cu?.email ?? null,
          customerName: cu?.name ?? ch?.billing_details?.name ?? null,
          customerId: cu?.id ?? idOf(pi.customer as string | null),
          method: ch?.payment_method_details?.type ?? null,
          receiptUrl: ch?.receipt_url ?? null,
          disputed: ch?.disputed ?? false,
          metadata: pi.metadata,
        };
      }),
      hasMore: list.has_more,
    });
  } catch (err) {
    sendError(res, err, "Error cargando pagos");
  }
});

router.patch(`${BASE}/payments/:piId/association`, requireAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    const projectId = pid(req);
    const body = req.body as { association?: Assoc; note?: string };
    const metadata: Record<string, string> = { ...associationMetadata(projectId, body.association) };
    // Quitar la asociación: Stripe borra una clave al recibir valor vacío.
    if (!body.association?.type) metadata.sc_ref_type = "";
    if (!body.association?.ref) metadata.sc_ref = "";
    if (body.note !== undefined) metadata.sc_note = str(body.note, 500) ?? "";
    const stripe = await stripeFor(req);
    const pi = await stripe.paymentIntents.update(String(req.params.piId), { metadata });
    res.json({ metadata: pi.metadata });
  } catch (err) {
    sendError(res, err, "Error guardando la asociación");
  }
});

router.post(`${BASE}/payments/:piId/refund`, requireAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    const body = req.body as { amount?: number | string | null; reason?: string };
    const reasons = ["requested_by_customer", "duplicate", "fraudulent"] as const;
    const reason = (reasons as readonly string[]).includes(String(body.reason)) ? (body.reason as typeof reasons[number]) : "requested_by_customer";
    const stripe = await stripeFor(req);
    const pi = await stripe.paymentIntents.retrieve(String(req.params.piId));
    if (pi.status !== "succeeded") throw new StripeRuleError("Solo se pueden devolver pagos completados");
    const params: Stripe.RefundCreateParams = { payment_intent: pi.id, reason };
    if (body.amount != null && body.amount !== "") {
      const amount = toMinorUnits(body.amount, pi.currency);
      if (amount <= 0 || amount > pi.amount_received) throw new StripeRuleError("El importe a devolver debe estar entre 0 y lo cobrado");
      params.amount = amount;
    }
    const refund = await stripe.refunds.create(params);
    res.json({ refund: { id: refund.id, status: refund.status, amount: refund.amount, currency: refund.currency } });
  } catch (err) {
    sendError(res, err, "Error procesando la devolución");
  }
});

export default router;
