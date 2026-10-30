/**
 * Tienda pública y su administración.
 *
 * Público (sin cuenta):
 *   GET  /shop/products            catálogo visible
 *   GET  /shop/products/:slug      ficha
 *   GET  /shop/settings            envío
 *   POST /shop/uploads             logo o fotos para personalizar (JPG, PNG, WebP o PDF; 20 MB)
 *   POST /shop/checkout            valida el carrito contra la BD, crea el pedido y la sesión de Stripe
 *   GET  /shop/checkout/verify     al volver de Stripe: confirma el pago (por si el webhook aún no llegó)
 *   GET  /shop/orders/:token       estado del pedido (solo con su token)
 * Admin:
 *   GET/POST/PUT /admin/shop/products…, POST /admin/shop/media, GET/PATCH /admin/shop/orders…,
 *   GET /admin/shop/uploads/:id, PUT /admin/shop/settings
 */
import { Router, type Request, type Response } from "express";
import multer from "multer";
import sharp from "sharp";
import { z } from "zod";
import { db } from "@workspace/db";
import { sql } from "drizzle-orm";
import { requireAdmin } from "../lib/auth.js";
import { logger } from "../lib/logger.js";
import { getStripe } from "../lib/stripe-billing.js";
import { publicAppUrl } from "../lib/account-tokens.js";
import { saveMedia } from "../lib/media-store.js";
import {
  priceLine, shippingFor, ShopValidationError, SHOP_CATEGORIES,
  variantSchema, addonSchema, fieldSchema, mediaSchema,
  type CartItemInput, type PricedLine, type ShopProduct,
} from "../lib/shop.js";
import {
  ensureShopTables, listProducts, productsBySlug, shippingSettings, sniffMime, saveUpload, getUpload,
  assertUploadsUsable, createOrder, setOrderSession, orderByToken, toPublicOrder, markShopOrderPaid, rowToProduct,
} from "../lib/shop-store.js";

const router = Router();
const customerUpload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 20 * 1024 * 1024, files: 12 } });
const adminUpload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 60 * 1024 * 1024, files: 12 } });

void ensureShopTables().catch(err => logger.warn({ err }, "tienda: no se pudieron preparar las tablas"));

/** Lo que ve el público de un producto (sin campos internos). */
function publicProduct(p: ShopProduct) {
  const { id: _id, visible: _v, ...rest } = p;
  return { ...rest, categoryLabel: SHOP_CATEGORIES[p.category] ?? p.category };
}

router.get("/shop/products", async (_req: Request, res: Response): Promise<void> => {
  try {
    const products = await listProducts();
    res.json({ products: products.map(publicProduct), categories: SHOP_CATEGORIES });
  } catch (err) {
    logger.error({ err }, "GET /shop/products");
    res.status(500).json({ error: "No se pudo cargar la tienda" });
  }
});

router.get("/shop/products/:slug", async (req: Request, res: Response): Promise<void> => {
  try {
    const p = (await productsBySlug([String(req.params.slug)])).get(String(req.params.slug));
    if (!p || !p.visible) { res.status(404).json({ error: "Producto no encontrado" }); return; }
    res.json(publicProduct(p));
  } catch (err) {
    logger.error({ err }, "GET /shop/products/:slug");
    res.status(500).json({ error: "Error" });
  }
});

router.get("/shop/settings", async (_req: Request, res: Response): Promise<void> => {
  try {
    res.json({ ...(await shippingSettings()), currency: "EUR", taxIncluded: true, payments: !!getStripe() });
  } catch {
    res.status(500).json({ error: "Error" });
  }
});

router.post("/shop/uploads", customerUpload.array("files", 12), async (req: Request, res: Response): Promise<void> => {
  try {
    const files = (req.files as Express.Multer.File[] | undefined) ?? [];
    if (files.length === 0) { res.status(400).json({ error: "Elige al menos un archivo" }); return; }
    const out: Array<{ id: string; name: string; mime: string }> = [];
    for (const f of files) {
      const mime = sniffMime(f.buffer);
      if (!mime) { res.status(400).json({ error: `«${f.originalname}» no es JPG, PNG, WebP ni PDF` }); return; }
      out.push({ id: await saveUpload(f.buffer, mime, f.originalname), name: f.originalname, mime });
    }
    res.json({ files: out });
  } catch (err) {
    logger.error({ err }, "POST /shop/uploads");
    res.status(500).json({ error: "No se pudo subir el archivo" });
  }
});

const cartSchema = z.object({
  items: z.array(z.object({
    slug: z.string().max(80),
    variant: z.string().max(40),
    qty: z.number().int().min(1).max(10000),
    addons: z.array(z.string().max(40)).max(10).optional(),
    fields: z.record(z.string(), z.unknown()).optional(),
  })).min(1).max(20),
});

/** Carrito → líneas con precio del servidor. */
async function priceCart(items: CartItemInput[]): Promise<{ lines: PricedLine[]; subtotal: number; shipping: number; hasPhysical: boolean }> {
  const products = await productsBySlug([...new Set(items.map(i => i.slug))]);
  const lines = items.map(item => {
    const p = products.get(item.slug);
    if (!p) throw new ShopValidationError("Uno de los productos ya no existe");
    return priceLine(p, item);
  });
  await assertUploadsUsable(lines.flatMap(l => Object.values(l.fields).flatMap(v => (Array.isArray(v) ? v : []))))
    .catch(err => { throw new ShopValidationError(err instanceof Error ? err.message : "Archivo no disponible"); });
  const subtotal = lines.reduce((s, l) => s + l.totalCents, 0);
  const shipping = shippingFor(lines, await shippingSettings());
  return { lines, subtotal, shipping, hasPhysical: lines.some(l => l.kind === "physical") };
}

/** Presupuesto del carrito sin crear nada (el carrito lo muestra con los precios del servidor). */
router.post("/shop/quote", async (req: Request, res: Response): Promise<void> => {
  const parsed = cartSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: "Carrito no válido" }); return; }
  try {
    const { lines, subtotal, shipping } = await priceCart(parsed.data.items);
    res.json({
      lines: lines.map(l => ({ slug: l.slug, variant: l.variantKey, qty: l.qty, unitCents: l.unitCents, totalCents: l.totalCents })),
      subtotalCents: subtotal, shippingCents: shipping, totalCents: subtotal + shipping,
    });
  } catch (err) {
    if (err instanceof ShopValidationError) { res.status(400).json({ error: err.message }); return; }
    logger.error({ err }, "POST /shop/quote");
    res.status(500).json({ error: "Error" });
  }
});

const inclusiveTax = () => process.env.STRIPE_AUTOMATIC_TAX === "1";

router.post("/shop/checkout", async (req: Request, res: Response): Promise<void> => {
  const parsed = cartSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: "Carrito no válido" }); return; }
  const stripe = getStripe();
  if (!stripe) { res.status(503).json({ error: "El pago con tarjeta no está disponible ahora mismo. Escríbenos y te mandamos el enlace de pago." }); return; }
  try {
    const { lines, subtotal, shipping, hasPhysical } = await priceCart(parsed.data.items);
    const order = await createOrder({ lines, subtotalCents: subtotal, shippingCents: shipping, totalCents: subtotal + shipping, hasPhysical });
    const APP = publicAppUrl() ?? `${req.protocol}://${req.get("host")}`;
    const tax = inclusiveTax() ? { tax_behavior: "inclusive" as const } : {};
    const lineItems = lines.flatMap(l => {
      const name = `${l.productName} · ${l.variantName}`.slice(0, 250);
      const base = {
        price_data: {
          currency: "eur",
          product_data: { name, ...(l.qty > 1 ? { description: `${l.qty} unidades a ${(l.unitCents / 100).toLocaleString("es-ES", { minimumFractionDigits: 2 })} €` } : {}) },
          unit_amount: l.baseCents, ...tax,
        },
        quantity: 1,
      };
      const extras = l.addons.map(a => ({
        price_data: { currency: "eur", product_data: { name: `${a.name} (${l.productName})`.slice(0, 250) }, unit_amount: a.cents, ...tax },
        quantity: 1,
      }));
      return [base, ...extras];
    });
    const metadata = { kind: "shop_order", orderToken: order.token, orderId: String(order.id) };
    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      line_items: lineItems,
      metadata,
      payment_intent_data: { metadata },
      invoice_creation: { enabled: true, invoice_data: { metadata } },
      customer_creation: "always",
      phone_number_collection: { enabled: true },
      billing_address_collection: "required",
      tax_id_collection: { enabled: true },
      ...(inclusiveTax() ? { automatic_tax: { enabled: true } } : {}),
      ...(hasPhysical ? {
        shipping_address_collection: { allowed_countries: ["ES"] },
        shipping_options: [{
          shipping_rate_data: {
            type: "fixed_amount",
            display_name: shipping === 0 ? "Envío gratis a España" : "Envío a España",
            fixed_amount: { amount: shipping, currency: "eur" },
            delivery_estimate: { minimum: { unit: "business_day", value: 3 }, maximum: { unit: "business_day", value: 7 } },
            ...tax,
          },
        }],
      } : {}),
      success_url: `${APP}/tienda/gracias?pedido=${order.token}&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${APP}/tienda/carrito?cancelado=1`,
      locale: "es",
    });
    if (!session.url) throw new Error("Stripe no devolvió la URL de pago");
    await setOrderSession(order.id, session.id);
    res.json({ url: session.url, order: order.token });
  } catch (err) {
    if (err instanceof ShopValidationError) { res.status(400).json({ error: err.message }); return; }
    logger.error({ err: err instanceof Error ? err.message : err }, "POST /shop/checkout");
    res.status(500).json({ error: "No se pudo iniciar el pago. Inténtalo de nuevo en un momento." });
  }
});

router.get("/shop/checkout/verify", async (req: Request, res: Response): Promise<void> => {
  const sessionId = String(req.query.session_id ?? "");
  const token = String(req.query.pedido ?? "");
  if (!/^cs_[A-Za-z0-9_]+$/.test(sessionId) || !/^[a-f0-9]{32}$/.test(token)) { res.status(400).json({ error: "Faltan datos del pago" }); return; }
  const stripe = getStripe();
  if (!stripe) { res.status(503).json({ error: "Pagos no disponibles" }); return; }
  try {
    const s = await stripe.checkout.sessions.retrieve(sessionId);
    if (s.metadata?.kind !== "shop_order" || s.metadata?.orderToken !== token) { res.status(403).json({ error: "El pago no corresponde a este pedido" }); return; }
    await markShopOrderPaid(s);
    const row = await orderByToken(token);
    if (!row) { res.status(404).json({ error: "Pedido no encontrado" }); return; }
    res.json(toPublicOrder(row));
  } catch (err) {
    logger.error({ err: err instanceof Error ? err.message : err }, "GET /shop/checkout/verify");
    res.status(500).json({ error: "No se pudo comprobar el pago" });
  }
});

router.get("/shop/orders/:token", async (req: Request, res: Response): Promise<void> => {
  const row = await orderByToken(String(req.params.token)).catch(() => null);
  if (!row) { res.status(404).json({ error: "Pedido no encontrado" }); return; }
  res.json(toPublicOrder(row));
});

// ── Admin ────────────────────────────────────────────────────────────────────

const productSchema = z.object({
  slug: z.string().regex(/^[a-z0-9-]{2,80}$/),
  kind: z.enum(["physical", "digital", "quote"]),
  category: z.string().max(40),
  name: z.string().min(1).max(120),
  tagline: z.string().max(300),
  description: z.string().max(5000),
  features: z.array(z.string().min(1).max(160)).max(12),
  media: z.array(mediaSchema).max(20),
  variants: z.array(variantSchema).min(1).max(10),
  addons: z.array(addonSchema).max(10),
  fields: z.array(fieldSchema).max(20),
  qtyOptions: z.array(z.number().int().min(1).max(10000)).max(10),
  minQty: z.number().int().min(1).max(10000),
  maxQty: z.number().int().min(1).max(10000),
  leadDays: z.number().int().min(0).max(120),
  demoUrl: z.string().max(300).refine(u => u.startsWith("/") && !u.startsWith("//"), "Solo rutas del propio sitio").nullable(),
  featured: z.boolean(),
  visible: z.boolean(),
  sortOrder: z.number().int().min(0).max(10000),
}).refine(p => p.minQty <= p.maxQty, "La cantidad mínima no puede superar la máxima");

router.get("/admin/shop/products", requireAdmin, async (_req: Request, res: Response): Promise<void> => {
  try { res.json({ products: await listProducts({ includeHidden: true }), categories: SHOP_CATEGORIES }); }
  catch (err) { res.status(500).json({ error: err instanceof Error ? err.message : "Error" }); }
});

async function writeProduct(res: Response, body: unknown, id: number | null): Promise<void> {
  const parsed = productSchema.safeParse(body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues.map(i => `${i.path.join(".") || "producto"}: ${i.message}`).join(" · ") });
    return;
  }
  const p = parsed.data;
  await ensureShopTables();
  const values = sql`${p.slug}, ${p.kind}, ${p.category}, ${p.name}, ${p.tagline}, ${p.description},
    ${JSON.stringify(p.features)}::jsonb, ${JSON.stringify(p.media)}::jsonb, ${JSON.stringify(p.variants)}::jsonb,
    ${JSON.stringify(p.addons)}::jsonb, ${JSON.stringify(p.fields)}::jsonb, ${JSON.stringify(p.qtyOptions)}::jsonb,
    ${p.minQty}, ${p.maxQty}, ${p.leadDays}, ${p.demoUrl}, ${p.featured}, ${p.visible}, ${p.sortOrder}`;
  try {
    const r = id === null
      ? await db.execute(sql`
          INSERT INTO shop_products (slug, kind, category, name, tagline, description, features, media, variants, addons, fields,
                                     qty_options, min_qty, max_qty, lead_days, demo_url, featured, visible, sort_order)
          VALUES (${values}) RETURNING *`)
      : await db.execute(sql`
          UPDATE shop_products SET (slug, kind, category, name, tagline, description, features, media, variants, addons, fields,
                                    qty_options, min_qty, max_qty, lead_days, demo_url, featured, visible, sort_order) = (${values}),
            updated_at = NOW()
          WHERE id = ${id} RETURNING *`);
    const row = r.rows[0] as Record<string, unknown> | undefined;
    if (!row) { res.status(404).json({ error: "Producto no encontrado" }); return; }
    res.json(rowToProduct(row));
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Error";
    res.status(/unique|duplicate/i.test(msg) ? 409 : 500).json({ error: /unique|duplicate/i.test(msg) ? "Ya existe un producto con esa URL (slug)" : msg });
  }
}

router.post("/admin/shop/products", requireAdmin, (req: Request, res: Response) => { void writeProduct(res, req.body, null); });
router.put("/admin/shop/products/:id", requireAdmin, (req: Request, res: Response) => {
  const id = parseInt(String(req.params.id), 10);
  if (!Number.isFinite(id)) { res.status(400).json({ error: "Id no válido" }); return; }
  void writeProduct(res, req.body, id);
});

/** Fotos y vídeos de producto: se guardan en la BD y se sirven en /api/media/:id. */
router.post("/admin/shop/media", requireAdmin, adminUpload.array("files", 12), async (req: Request, res: Response): Promise<void> => {
  try {
    const files = (req.files as Express.Multer.File[] | undefined) ?? [];
    const out: Array<{ type: "image" | "video"; url: string; alt: string }> = [];
    for (const f of files) {
      const alt = f.originalname.replace(/\.[^.]+$/, "").slice(0, 160);
      if (/^image\//.test(f.mimetype)) {
        const img = await sharp(f.buffer).rotate().resize({ width: 2000, withoutEnlargement: true }).webp({ quality: 84 }).toBuffer({ resolveWithObject: true });
        const { url } = await saveMedia(img.data, "image/webp", { width: img.info.width, height: img.info.height, originalName: f.originalname });
        out.push({ type: "image", url, alt });
      } else if (f.mimetype === "video/mp4" || f.mimetype === "video/webm") {
        const { url } = await saveMedia(f.buffer, f.mimetype, { originalName: f.originalname });
        out.push({ type: "video", url, alt });
      }
    }
    if (!out.length) { res.status(400).json({ error: "Sube imágenes o vídeos MP4/WebM" }); return; }
    res.json({ media: out });
  } catch (err) {
    logger.error({ err }, "POST /admin/shop/media");
    res.status(500).json({ error: "No se pudo subir" });
  }
});

const ORDER_STATUSES = ["pending", "paid", "in_production", "shipped", "delivered", "cancelled", "expired"] as const;

router.get("/admin/shop/orders", requireAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    await ensureShopTables();
    const status = String(req.query.status ?? "");
    const r = ORDER_STATUSES.includes(status as typeof ORDER_STATUSES[number])
      ? await db.execute(sql`SELECT * FROM shop_orders WHERE status = ${status} ORDER BY created_at DESC LIMIT 200`)
      : await db.execute(sql`SELECT * FROM shop_orders WHERE status <> 'pending' AND status <> 'expired' ORDER BY created_at DESC LIMIT 200`);
    res.json({ orders: r.rows });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : "Error" });
  }
});

router.patch("/admin/shop/orders/:id", requireAdmin, async (req: Request, res: Response): Promise<void> => {
  const id = parseInt(String(req.params.id), 10);
  const body = z.object({
    status: z.enum(ORDER_STATUSES).optional(),
    tracking: z.string().max(300).nullable().optional(),
    adminNotes: z.string().max(4000).nullable().optional(),
  }).safeParse(req.body);
  if (!Number.isFinite(id) || !body.success) { res.status(400).json({ error: "Datos no válidos" }); return; }
  try {
    const b = body.data;
    const r = await db.execute(sql`
      UPDATE shop_orders SET
        status = COALESCE(${b.status ?? null}, status),
        tracking = CASE WHEN ${b.tracking !== undefined} THEN ${b.tracking ?? null} ELSE tracking END,
        admin_notes = CASE WHEN ${b.adminNotes !== undefined} THEN ${b.adminNotes ?? null} ELSE admin_notes END,
        updated_at = NOW()
      WHERE id = ${id} RETURNING *
    `);
    if (!r.rows[0]) { res.status(404).json({ error: "Pedido no encontrado" }); return; }
    res.json(r.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : "Error" });
  }
});

router.get("/admin/shop/uploads/:id", requireAdmin, async (req: Request, res: Response): Promise<void> => {
  const f = await getUpload(String(req.params.id)).catch(() => null);
  if (!f) { res.status(404).json({ error: "Archivo no encontrado" }); return; }
  res.setHeader("Content-Type", f.mime);
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("Content-Disposition", `${req.query.download ? "attachment" : "inline"}; filename="${encodeURIComponent(f.name)}"`);
  res.send(f.bytes);
});

router.put("/admin/shop/settings", requireAdmin, async (req: Request, res: Response): Promise<void> => {
  const b = z.object({
    shippingCents: z.number().int().min(0).max(100000),
    freeFromCents: z.number().int().min(0).max(10_000_000),
  }).safeParse(req.body);
  if (!b.success) { res.status(400).json({ error: "Datos no válidos" }); return; }
  await ensureShopTables();
  for (const [k, v] of [["shop_shipping_cents", b.data.shippingCents], ["shop_free_shipping_from_cents", b.data.freeFromCents]] as const) {
    await db.execute(sql`INSERT INTO app_settings (key, value) VALUES (${k}, ${String(v)}) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()`);
  }
  res.json(await shippingSettings());
});

export default router;
