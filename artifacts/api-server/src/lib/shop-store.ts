/**
 * Persistencia de la tienda: productos, pedidos y archivos que suben los clientes.
 * Tablas creadas de forma idempotente; el catálogo inicial se siembra una vez por versión.
 */
import { randomBytes } from "node:crypto";
import { db } from "@workspace/db";
import { sql } from "drizzle-orm";
import type Stripe from "stripe";
import { logger } from "./logger.js";
import {
  SHOP_SEED, SHOP_SEED_VERSION, DEFAULT_SHIPPING,
  type ShopProduct, type PricedLine, type ShippingSettings,
} from "./shop.js";
import { ensureAppSettingsTable } from "./app-settings-table.js";

let ready: Promise<void> | null = null;

export function ensureShopTables(): Promise<void> {
  ready ??= (async () => {
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS shop_products (
        id SERIAL PRIMARY KEY,
        slug TEXT UNIQUE NOT NULL,
        kind TEXT NOT NULL DEFAULT 'physical',
        category TEXT NOT NULL DEFAULT '',
        name TEXT NOT NULL,
        tagline TEXT NOT NULL DEFAULT '',
        description TEXT NOT NULL DEFAULT '',
        features JSONB NOT NULL DEFAULT '[]'::jsonb,
        media JSONB NOT NULL DEFAULT '[]'::jsonb,
        variants JSONB NOT NULL DEFAULT '[]'::jsonb,
        addons JSONB NOT NULL DEFAULT '[]'::jsonb,
        fields JSONB NOT NULL DEFAULT '[]'::jsonb,
        qty_options JSONB NOT NULL DEFAULT '[]'::jsonb,
        min_qty INTEGER NOT NULL DEFAULT 1,
        max_qty INTEGER NOT NULL DEFAULT 20,
        lead_days INTEGER NOT NULL DEFAULT 5,
        demo_url TEXT,
        featured BOOLEAN NOT NULL DEFAULT FALSE,
        visible BOOLEAN NOT NULL DEFAULT TRUE,
        sort_order INTEGER NOT NULL DEFAULT 0,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS shop_orders (
        id SERIAL PRIMARY KEY,
        token TEXT UNIQUE NOT NULL,
        status TEXT NOT NULL DEFAULT 'pending',
        email TEXT,
        name TEXT,
        phone TEXT,
        shipping JSONB,
        lines JSONB NOT NULL,
        subtotal_cents INTEGER NOT NULL,
        shipping_cents INTEGER NOT NULL DEFAULT 0,
        total_cents INTEGER NOT NULL,
        has_physical BOOLEAN NOT NULL DEFAULT FALSE,
        stripe_session_id TEXT UNIQUE,
        stripe_payment_intent TEXT,
        tracking TEXT,
        admin_notes TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        paid_at TIMESTAMPTZ,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS shop_orders_status ON shop_orders (status, created_at DESC)`);
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS shop_uploads (
        id TEXT PRIMARY KEY,
        mime TEXT NOT NULL,
        size INTEGER NOT NULL,
        bytes BYTEA NOT NULL,
        original_name TEXT,
        order_id INTEGER,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);
    // IP de quien sube (tope diario) e índice para la limpieza de huérfanas.
    await db.execute(sql`ALTER TABLE shop_uploads ADD COLUMN IF NOT EXISTS ip TEXT`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS shop_uploads_orphan ON shop_uploads (created_at) WHERE order_id IS NULL`);
    await ensureAppSettingsTable();
    await seedCatalog();
  })().catch(err => { ready = null; throw err; });
  return ready;
}

async function seedCatalog(): Promise<void> {
  const v = await db.execute(sql`SELECT value FROM app_settings WHERE key = 'shop_catalog_version'`);
  if ((v.rows[0] as { value?: string } | undefined)?.value === SHOP_SEED_VERSION) return;
  for (const p of SHOP_SEED) {
    await db.execute(sql`
      INSERT INTO shop_products (slug, kind, category, name, tagline, description, features, media, variants, addons, fields,
                                 qty_options, min_qty, max_qty, lead_days, demo_url, featured, visible, sort_order)
      VALUES (${p.slug}, ${p.kind}, ${p.category}, ${p.name}, ${p.tagline}, ${p.description},
              ${JSON.stringify(p.features)}::jsonb, ${JSON.stringify(p.media)}::jsonb, ${JSON.stringify(p.variants)}::jsonb,
              ${JSON.stringify(p.addons)}::jsonb, ${JSON.stringify(p.fields)}::jsonb, ${JSON.stringify(p.qtyOptions)}::jsonb,
              ${p.minQty}, ${p.maxQty}, ${p.leadDays}, ${p.demoUrl}, ${p.featured}, ${p.visible}, ${p.sortOrder})
      ON CONFLICT (slug) DO NOTHING
    `);
    // Un producto que nadie ha tocado desde el panel (updated_at = created_at) sigue al catálogo:
    // así llegan los cambios de precio o texto de una versión nueva sin pisar lo editado a mano.
    await db.execute(sql`
      UPDATE shop_products SET
        kind = ${p.kind}, category = ${p.category}, name = ${p.name}, tagline = ${p.tagline}, description = ${p.description},
        features = ${JSON.stringify(p.features)}::jsonb, media = ${JSON.stringify(p.media)}::jsonb,
        variants = ${JSON.stringify(p.variants)}::jsonb, addons = ${JSON.stringify(p.addons)}::jsonb,
        fields = ${JSON.stringify(p.fields)}::jsonb, qty_options = ${JSON.stringify(p.qtyOptions)}::jsonb,
        min_qty = ${p.minQty}, max_qty = ${p.maxQty}, lead_days = ${p.leadDays}, demo_url = ${p.demoUrl},
        featured = ${p.featured}, visible = ${p.visible}, sort_order = ${p.sortOrder}
      WHERE slug = ${p.slug} AND updated_at = created_at
    `);
  }
  await db.execute(sql`
    INSERT INTO app_settings (key, value) VALUES ('shop_catalog_version', ${SHOP_SEED_VERSION})
    ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()
  `);
  logger.info({ version: SHOP_SEED_VERSION }, "tienda: catálogo inicial aplicado");
}

const arr = <T>(v: unknown): T[] => (Array.isArray(v) ? (v as T[]) : []);

/** (a, b, c) para «IN»: cada valor va como parámetro. */
function inList(values: string[]) {
  return sql`(${sql.join(values.map(v => sql`${v}`), sql`, `)})`;
}

export function rowToProduct(r: Record<string, unknown>): ShopProduct {
  return {
    id: Number(r.id), slug: String(r.slug), kind: String(r.kind) as ShopProduct["kind"], category: String(r.category ?? ""),
    name: String(r.name), tagline: String(r.tagline ?? ""), description: String(r.description ?? ""),
    features: arr(r.features), media: arr(r.media), variants: arr(r.variants), addons: arr(r.addons), fields: arr(r.fields),
    qtyOptions: arr<number>(r.qty_options).map(Number), minQty: Number(r.min_qty ?? 1), maxQty: Number(r.max_qty ?? 20),
    leadDays: Number(r.lead_days ?? 0), demoUrl: (r.demo_url as string | null) ?? null,
    featured: !!r.featured, visible: !!r.visible, sortOrder: Number(r.sort_order ?? 0),
  };
}

export async function listProducts(opts: { includeHidden?: boolean } = {}): Promise<ShopProduct[]> {
  await ensureShopTables();
  const r = opts.includeHidden
    ? await db.execute(sql`SELECT * FROM shop_products ORDER BY sort_order ASC, id ASC`)
    : await db.execute(sql`SELECT * FROM shop_products WHERE visible = TRUE ORDER BY sort_order ASC, id ASC`);
  return (r.rows as Array<Record<string, unknown>>).map(rowToProduct);
}

export async function productsBySlug(slugs: string[]): Promise<Map<string, ShopProduct>> {
  await ensureShopTables();
  if (slugs.length === 0) return new Map();
  const r = await db.execute(sql`SELECT * FROM shop_products WHERE slug IN ${inList(slugs)}`);
  return new Map((r.rows as Array<Record<string, unknown>>).map(rowToProduct).map(p => [p.slug, p]));
}

export async function shippingSettings(): Promise<ShippingSettings> {
  await ensureShopTables();
  const r = await db.execute(sql`SELECT key, value FROM app_settings WHERE key IN ('shop_shipping_cents', 'shop_free_shipping_from_cents')`);
  const m = new Map((r.rows as Array<{ key: string; value: string }>).map(x => [x.key, Number(x.value)]));
  const ship = m.get("shop_shipping_cents"), free = m.get("shop_free_shipping_from_cents");
  return {
    shippingCents: Number.isFinite(ship) && ship! >= 0 ? ship! : DEFAULT_SHIPPING.shippingCents,
    freeFromCents: Number.isFinite(free) && free! >= 0 ? free! : DEFAULT_SHIPPING.freeFromCents,
  };
}

// ── Archivos de los clientes ─────────────────────────────────────────────────

/** Tipo real del archivo por su cabecera (no se confía en el nombre ni en el mime del navegador). */
export function sniffMime(buf: Buffer): string | null {
  if (buf.length < 12) return null;
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return "image/jpeg";
  if (buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return "image/png";
  if (buf.subarray(0, 4).toString("ascii") === "RIFF" && buf.subarray(8, 12).toString("ascii") === "WEBP") return "image/webp";
  if (buf.subarray(0, 5).toString("ascii") === "%PDF-") return "application/pdf";
  return null;
}

export async function saveUpload(buf: Buffer, mime: string, originalName: string, ip: string | null = null): Promise<string> {
  await ensureShopTables();
  const id = randomBytes(16).toString("hex");
  await db.execute(sql`
    INSERT INTO shop_uploads (id, mime, size, bytes, original_name, ip) VALUES (${id}, ${mime}, ${buf.length}, ${buf}, ${originalName.slice(0, 200)}, ${ip})
  `);
  return id;
}

/** Tope de bytes que una misma IP puede subir sin cuenta en 24 h. */
export const SHOP_UPLOAD_DAILY_BYTES = 600 * 1024 * 1024;

/** Bytes subidos por esta IP en las últimas 24 h. */
export async function uploadedBytesLastDay(ip: string): Promise<number> {
  await ensureShopTables();
  const r = await db.execute(sql`
    SELECT COALESCE(SUM(size), 0)::bigint AS total FROM shop_uploads
    WHERE ip = ${ip} AND created_at > NOW() - INTERVAL '24 hours'
  `);
  return Number((r.rows[0] as { total: string | number } | undefined)?.total ?? 0);
}

/**
 * Subidas que no acabaron en ningún pedido: se borran a los 3 días (el carrito
 * del navegador avisa de que hay que volver a subirlas). Sin esto, la tabla
 * crecía sin límite con archivos de visitantes anónimos.
 */
export async function purgeOrphanUploads(): Promise<number> {
  await ensureShopTables();
  const r = await db.execute(sql`DELETE FROM shop_uploads WHERE order_id IS NULL AND created_at < NOW() - INTERVAL '3 days'`);
  return r.rowCount ?? 0;
}

export async function getUpload(id: string): Promise<{ mime: string; bytes: Buffer; name: string } | null> {
  if (!/^[a-f0-9]{32}$/.test(id)) return null;
  await ensureShopTables();
  const r = await db.execute(sql`SELECT mime, bytes, original_name FROM shop_uploads WHERE id = ${id}`);
  const row = r.rows[0] as { mime: string; bytes: Buffer | Uint8Array; original_name: string | null } | undefined;
  return row ? { mime: row.mime, bytes: Buffer.from(row.bytes), name: row.original_name ?? id } : null;
}

/** Comprueba que los archivos citados existen y no pertenecen ya a otro pedido. */
export async function assertUploadsUsable(ids: string[]): Promise<void> {
  if (ids.length === 0) return;
  const r = await db.execute(sql`SELECT id, order_id FROM shop_uploads WHERE id IN ${inList(ids)}`);
  const found = new Map((r.rows as Array<{ id: string; order_id: number | null }>).map(x => [x.id, x.order_id]));
  for (const id of ids) {
    if (!found.has(id)) throw new Error("Uno de los archivos ya no está disponible: vuelve a subirlo.");
  }
}

// ── Pedidos ──────────────────────────────────────────────────────────────────

export interface NewOrder { lines: PricedLine[]; subtotalCents: number; shippingCents: number; totalCents: number; hasPhysical: boolean }

export async function createOrder(o: NewOrder): Promise<{ id: number; token: string }> {
  await ensureShopTables();
  const token = randomBytes(16).toString("hex");
  const r = await db.execute(sql`
    INSERT INTO shop_orders (token, status, lines, subtotal_cents, shipping_cents, total_cents, has_physical)
    VALUES (${token}, 'pending', ${JSON.stringify(o.lines)}::jsonb, ${o.subtotalCents}, ${o.shippingCents}, ${o.totalCents}, ${o.hasPhysical})
    RETURNING id
  `);
  const id = Number((r.rows[0] as { id: number }).id);
  const uploadIds = o.lines.flatMap(l => Object.values(l.fields).flatMap(v => (Array.isArray(v) ? v : [])));
  if (uploadIds.length) await db.execute(sql`UPDATE shop_uploads SET order_id = ${id} WHERE id IN ${inList(uploadIds)} AND order_id IS NULL`);
  return { id, token };
}

export async function setOrderSession(id: number, sessionId: string): Promise<void> {
  await db.execute(sql`UPDATE shop_orders SET stripe_session_id = ${sessionId}, updated_at = NOW() WHERE id = ${id}`);
}

export interface PublicOrder {
  token: string; status: string; createdAt: string; paidAt: string | null;
  lines: Array<{ name: string; variant: string; qty: number; totalCents: number; addons: string[] }>;
  subtotalCents: number; shippingCents: number; totalCents: number; hasPhysical: boolean; email: string | null;
}

export function toPublicOrder(r: Record<string, unknown>): PublicOrder {
  const lines = arr<PricedLine>(r.lines);
  return {
    token: String(r.token), status: String(r.status),
    createdAt: new Date(r.created_at as string).toISOString(),
    paidAt: r.paid_at ? new Date(r.paid_at as string).toISOString() : null,
    lines: lines.map(l => ({ name: l.productName, variant: l.variantName, qty: l.qty, totalCents: l.totalCents, addons: l.addons.map(a => a.name) })),
    subtotalCents: Number(r.subtotal_cents), shippingCents: Number(r.shipping_cents), totalCents: Number(r.total_cents),
    hasPhysical: !!r.has_physical, email: (r.email as string | null) ?? null,
  };
}

export async function orderByToken(token: string): Promise<Record<string, unknown> | null> {
  if (!/^[a-f0-9]{32}$/.test(token)) return null;
  await ensureShopTables();
  const r = await db.execute(sql`SELECT * FROM shop_orders WHERE token = ${token}`);
  return (r.rows[0] as Record<string, unknown> | undefined) ?? null;
}

const euros = (c: number) => (c / 100).toLocaleString("es-ES", { style: "currency", currency: "EUR" });
const escHtml = (s: unknown) => String(s ?? "").replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]!));

function orderEmailHtml(o: PublicOrder, title: string, intro: string): string {
  const rows = o.lines.map(l => `<tr><td style="padding:6px 0">${escHtml(l.name)} · ${escHtml(l.variant)}${l.qty > 1 ? ` × ${l.qty}` : ""}${l.addons.length ? `<br><span style="color:#888;font-size:12px">${escHtml(l.addons.join(", "))}</span>` : ""}</td><td style="text-align:right;padding:6px 0">${euros(l.totalCents)}</td></tr>`).join("");
  return `<div style="font-family:Arial,sans-serif;max-width:560px;margin:auto;color:#222">
<h2 style="color:#8a6d1f">${escHtml(title)}</h2><p>${escHtml(intro)}</p>
<table style="width:100%;border-collapse:collapse">${rows}
<tr><td style="padding:6px 0;border-top:1px solid #ddd">Envío</td><td style="text-align:right;border-top:1px solid #ddd">${o.shippingCents ? euros(o.shippingCents) : o.hasPhysical ? "Gratis" : "—"}</td></tr>
<tr><td style="padding:6px 0"><strong>Total (IVA incluido)</strong></td><td style="text-align:right"><strong>${euros(o.totalCents)}</strong></td></tr></table>
<p style="font-size:13px;color:#555">Pedido ${escHtml(o.token.slice(0, 8).toUpperCase())}. Te escribiremos con la prueba de diseño antes de producir. Si necesitas algo, responde a este email.</p>
<p style="font-size:13px;color:#555">Shopy Crafter · @shopycrafter</p></div>`;
}

/**
 * Marca pagado un pedido a partir de su sesión de Stripe (webhook o verificación al volver).
 * Idempotente: solo el primer paso de «pending» a «paid» envía los avisos.
 */
export async function markShopOrderPaid(s: Stripe.Checkout.Session): Promise<boolean> {
  if (s.payment_status !== "paid") return false;
  await ensureShopTables();
  const token = s.metadata?.orderToken ?? "";
  const cd = s.customer_details;
  const shipping = (s as unknown as { collected_information?: { shipping_details?: unknown } }).collected_information?.shipping_details
    ?? (s as unknown as { shipping_details?: unknown }).shipping_details ?? null;
  const pi = typeof s.payment_intent === "string" ? s.payment_intent : s.payment_intent?.id ?? null;
  const r = await db.execute(sql`
    UPDATE shop_orders SET status = 'paid', paid_at = NOW(), updated_at = NOW(),
      email = ${cd?.email ?? null}, name = ${cd?.name ?? null}, phone = ${cd?.phone ?? null},
      shipping = ${shipping ? JSON.stringify(shipping) : null}::jsonb, stripe_payment_intent = ${pi},
      stripe_session_id = COALESCE(stripe_session_id, ${s.id})
    WHERE token = ${token} AND status = 'pending' AND (stripe_session_id IS NULL OR stripe_session_id = ${s.id})
    RETURNING *
  `);
  const row = r.rows[0] as Record<string, unknown> | undefined;
  if (!row) return false;
  const o = toPublicOrder(row);
  logger.info({ orderId: row.id, total: o.totalCents }, "🛍️ Tienda: pedido pagado");
  try {
    const { sendEmail } = await import("./gmail.js");
    if (o.email) await sendEmail(o.email, "Hemos recibido tu pedido — Shopy Crafter", orderEmailHtml(o, "¡Gracias por tu pedido!", "Ya está pagado y lo tenemos en marcha."));
    const admin = process.env.ADMIN_EMAIL || "craftershopy@gmail.com";
    await sendEmail(admin, `Nuevo pedido en la tienda: ${euros(o.totalCents)}`, orderEmailHtml(o, "Nuevo pedido pagado", `${o.email ?? "Cliente"} · revisa la personalización en Admin → Tienda.`));
  } catch (err) {
    logger.warn({ err }, "tienda: email de pedido fallido");
  }
  try {
    const { sendPushToAdmins } = await import("./push-helper.js");
    await sendPushToAdmins("Nuevo pedido en la tienda", `${o.lines.map(l => l.name).join(", ")} · ${euros(o.totalCents)}`, "/admin/shop");
  } catch { /* push opcional */ }
  return true;
}

export async function markShopOrderExpired(s: Stripe.Checkout.Session): Promise<void> {
  await ensureShopTables();
  await db.execute(sql`UPDATE shop_orders SET status = 'expired', updated_at = NOW() WHERE stripe_session_id = ${s.id} AND status = 'pending'`);
}
