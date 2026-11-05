/**
 * woo-project.ts — WooCommerce Project Admin Hub API
 * ─────────────────────────────────────────────────────
 * Rutas de gestión admin por proyecto WooCommerce:
 *   GET  /admin/woo/project/:id/overview     → Ingresos y pedidos pagados de 30 días, productos, stock
 *   GET  /admin/woo/project/:id/orders       → Lista paginada de pedidos
 *   GET  /admin/woo/project/:id/products     → Catálogo de productos
 *   GET  /admin/woo/project/:id/customers    → Lista de clientes
 *   GET  /admin/woo/project/:id/coupons      → Cupones activos
 *   GET  /admin/woo/project/:id/inventory    → Alertas de stock
 *   PUT  /admin/woo/project/:id/products/:pid → Actualizar producto
 */

import { Router, type Request, type Response } from "express";
import { eq } from "drizzle-orm";
import { requireAdmin } from "../lib/auth.js";
import { logger } from "../lib/logger.js";
import { safeDecrypt } from "../lib/crypto.js";

const router = Router();

// ── Helper: carga proyecto WooCommerce y prepara clientes ────────────────────
async function resolveWoo(projectId: number) {
  const { db, projectsTable } = await import("@workspace/db");
  const project = await db.query.projectsTable.findFirst({
    where: eq(projectsTable.id, projectId),
  });
  if (!project) throw Object.assign(new Error("Proyecto no encontrado"), { status: 404 });
  if (project.platformType !== "woocommerce")
    throw Object.assign(new Error("Este proyecto no es WooCommerce"), { status: 400 });

  // Credenciales
  const consumerKey    = safeDecrypt(project.clientId)     || project.clientId;
  const consumerSecret = safeDecrypt(project.clientSecret) || project.clientSecret;
  const authHeader = `Basic ${Buffer.from(`${consumerKey}:${consumerSecret}`).toString("base64")}`;

  // Base URL
  let domain = (project.shopDomain || "").trim().replace(/\/+$/, "");
  if (!domain.startsWith("https://") && !domain.startsWith("http://")) domain = `https://${domain}`;
  if (domain.startsWith("http://")) domain = domain.replace("http://", "https://");
  const wcApi = `${domain}/wp-json/wc/v3`;

  async function wcGet<T>(path: string, signal?: AbortSignal): Promise<T> {
    const resp = await fetch(`${wcApi}${path}`, {
      headers: { Authorization: authHeader, "Content-Type": "application/json" },
      signal: signal ?? AbortSignal.timeout(30_000),
    });
    if (!resp.ok) {
      const body = await resp.text().catch(() => "");
      throw new Error(`WC ${resp.status}: ${body.slice(0, 200)}`);
    }
    return resp.json() as Promise<T>;
  }

  async function wcPut<T>(path: string, data: unknown): Promise<T> {
    const resp = await fetch(`${wcApi}${path}`, {
      method: "PUT",
      headers: { Authorization: authHeader, "Content-Type": "application/json" },
      body: JSON.stringify(data),
      signal: AbortSignal.timeout(30_000),
    });
    if (!resp.ok) {
      const body = await resp.text().catch(() => "");
      throw new Error(`WC PUT ${resp.status}: ${body.slice(0, 200)}`);
    }
    return resp.json() as Promise<T>;
  }

  // Recorre todas las páginas de un listado (X-WP-TotalPages) hasta `maxPages`.
  async function wcGetAll<T>(path: string, maxPages = 20): Promise<T[]> {
    const sep = path.includes("?") ? "&" : "?";
    const out: T[] = [];
    for (let page = 1; page <= maxPages; page++) {
      const resp = await fetch(`${wcApi}${path}${sep}per_page=100&page=${page}`, {
        headers: { Authorization: authHeader, "Content-Type": "application/json" },
        signal: AbortSignal.timeout(30_000),
      });
      if (!resp.ok) {
        const body = await resp.text().catch(() => "");
        throw new Error(`WC ${resp.status}: ${body.slice(0, 200)}`);
      }
      const batch = (await resp.json()) as T[];
      out.push(...batch);
      const totalPages = Number(resp.headers.get("x-wp-totalpages") || "1");
      if (!Array.isArray(batch) || batch.length < 100 || page >= totalPages) break;
    }
    return out;
  }

  return { project, wcGet, wcGetAll, wcPut, domain };
}

// ── Normaliza formato de moneda ──────────────────────────────────────────────
function fmtMoney(val: unknown): number {
  const n = parseFloat(String(val ?? "0"));
  return isNaN(n) ? 0 : n;
}

// ── GET /admin/woo/project/:id/overview ─────────────────────────────────────
router.get(
  "/admin/woo/project/:id/overview",
  requireAdmin,
  async (req: Request, res: Response): Promise<void> => {
    try {
      const projectId = Number(req.params.id);
      const { wcGet, wcGetAll } = await resolveWoo(projectId);

      // Últimos 30 días. /reports/sales devuelve un ARRAY y va por mes natural:
      // las cifras salen de los pedidos pagados del periodo (processing + completed).
      const desde = new Date(Date.now() - 30 * 864e5).toISOString().slice(0, 19);
      const camposPedido = "id,status,total,total_tax,shipping_total,currency,refunds";
      // stock_status solo acepta UN valor (instock | outofstock | onbackorder): dos llamadas.
      const camposStock = "id,name,sku,stock_quantity,stock_status,price,status";
      const [salesResult, ordersResult, productsResult, stockResult, backorderResult] = await Promise.allSettled([
        wcGetAll<any>(`/orders?status=processing,completed&after=${desde}&_fields=${camposPedido}`),
        wcGet<any[]>("/orders?per_page=5&orderby=date&order=desc"),
        wcGet<any[]>("/reports/products/totals"),
        wcGetAll<any>(`/products?stock_status=outofstock&status=publish&_fields=${camposStock}`, 5),
        wcGetAll<any>(`/products?stock_status=onbackorder&status=publish&_fields=${camposStock}`, 5),
      ]);

      const settled = [salesResult, ordersResult, productsResult, stockResult, backorderResult];
      const failures = settled
        .filter((r): r is PromiseRejectedResult => r.status === "rejected")
        .map(r => String(r.reason?.message ?? r.reason ?? "error"));
      // Si no responde ninguna llamada, la tienda no es accesible: error explícito, no ceros.
      if (failures.length === settled.length) {
        res.status(502).json({ error: `No se pudo conectar con WooCommerce: ${failures[0]}` });
        return;
      }

      const paid      = salesResult.status    === "fulfilled" ? salesResult.value    : null;
      const orders    = ordersResult.status   === "fulfilled" ? ordersResult.value   : [];
      const prodTotals= productsResult.status === "fulfilled" ? productsResult.value : [];
      const outStock  = stockResult.status    === "fulfilled" ? stockResult.value    : [];
      const backorder = backorderResult.status === "fulfilled" ? backorderResult.value : [];
      const lowStock  = [...outStock, ...backorder];

      const revenue  = paid ? paid.reduce((s: number, o: any) => s + fmtMoney(o.total), 0) : 0;
      const refunds  = paid ? paid.reduce((s: number, o: any) => s + (o.refunds ?? []).reduce((r: number, x: any) => r + Math.abs(fmtMoney(x.total)), 0), 0) : 0;
      const nOrders  = paid ? paid.length : 0;
      const round2   = (n: number) => Math.round(n * 100) / 100;

      // Calcular total de productos
      const totalProducts = Array.isArray(prodTotals)
        ? prodTotals.reduce((s: number, t: any) => s + (t.total ?? 0), 0)
        : 0;

      res.json({
        revenue30d:    round2(revenue),
        orders30d:     nOrders,
        aov:           nOrders ? round2(revenue / nOrders) : 0,
        refunds30d:    round2(refunds),
        totalProducts,
        lowStockCount: lowStock.length,
        outOfStockCount: outStock.length,
        backorderCount:  backorder.length,
        currency:      paid?.[0]?.currency ?? (orders as any[])[0]?.currency ?? "EUR",
        // Datos que WooCommerce no devolvió (las cifras afectadas no son fiables).
        warnings:      failures,
        recentOrders:  (orders as any[]).map((o: any) => ({
          id:           o.id,
          number:       o.number,
          status:       o.status,
          total:        fmtMoney(o.total),
          currency:     o.currency,
          customerName: `${o.billing?.first_name ?? ""} ${o.billing?.last_name ?? ""}`.trim() || "—",
          email:        o.billing?.email ?? "",
          date:         o.date_created,
          itemCount:    o.line_items?.length ?? 0,
        })),
        stockAlerts: (lowStock as any[]).slice(0, 8).map((p: any) => ({
          id:        p.id,
          name:      p.name,
          sku:       p.sku,
          stock:     p.stock_quantity,
          status:    p.stock_status,
          price:     fmtMoney(p.price),
        })),
      });
    } catch (err: any) {
      logger.error("WOO overview error", err);
      res.status(err.status ?? 500).json({ error: err.message });
    }
  }
);

// ── GET /admin/woo/project/:id/orders ───────────────────────────────────────
router.get(
  "/admin/woo/project/:id/orders",
  requireAdmin,
  async (req: Request, res: Response): Promise<void> => {
    try {
      const projectId = Number(req.params.id);
      const { wcGet } = await resolveWoo(projectId);
      const page     = Math.max(1, Number(req.query.page) || 1);
      const perPage  = Math.min(100, Math.max(1, Number(req.query.per_page) || 20));
      const status   = String(req.query.status ?? "").replace(/[^a-z,-]/gi, "");
      const search   = req.query.search   ?? "";

      let path = `/orders?page=${page}&per_page=${perPage}&orderby=date&order=desc`;
      if (status) path += `&status=${status}`;
      if (search) path += `&search=${encodeURIComponent(String(search))}`;

      const orders = await wcGet<any[]>(path);

      res.json({
        orders: orders.map((o: any) => ({
          id:           o.id,
          number:       o.number,
          status:       o.status,
          total:        fmtMoney(o.total),
          currency:     o.currency,
          customerName: `${o.billing?.first_name ?? ""} ${o.billing?.last_name ?? ""}`.trim() || "—",
          email:        o.billing?.email ?? "",
          phone:        o.billing?.phone ?? "",
          date:         o.date_created,
          datePaid:     o.date_paid,
          paymentMethod:o.payment_method_title ?? "",
          itemCount:    o.line_items?.length ?? 0,
          items:        (o.line_items ?? []).map((li: any) => ({
            name:     li.name,
            qty:      li.quantity,
            total:    fmtMoney(li.total),
          })),
          shippingTotal: fmtMoney(o.shipping_total),
          note:          o.customer_note ?? "",
        })),
      });
    } catch (err: any) {
      logger.error("WOO orders error", err);
      res.status(err.status ?? 500).json({ error: err.message });
    }
  }
);

// ── GET /admin/woo/project/:id/products ─────────────────────────────────────
router.get(
  "/admin/woo/project/:id/products",
  requireAdmin,
  async (req: Request, res: Response): Promise<void> => {
    try {
      const projectId = Number(req.params.id);
      const { wcGet } = await resolveWoo(projectId);
      const page    = Math.max(1, Number(req.query.page) || 1);
      const perPage = Math.min(100, Math.max(1, Number(req.query.per_page) || 20));
      const search  = req.query.search   ?? "";
      const status  = String(req.query.status ?? "").replace(/[^a-z-]/gi, "");

      let path = `/products?page=${page}&per_page=${perPage}&orderby=date&order=desc`;
      if (search) path += `&search=${encodeURIComponent(String(search))}`;
      if (status) path += `&status=${status}`;

      const products = await wcGet<any[]>(path);

      res.json({
        products: products.map((p: any) => ({
          id:             p.id,
          name:           p.name,
          sku:            p.sku,
          status:         p.status,
          stockStatus:    p.stock_status,
          stockQuantity:  p.stock_quantity,
          price:          fmtMoney(p.price),
          regularPrice:   fmtMoney(p.regular_price),
          salePrice:      p.sale_price ? fmtMoney(p.sale_price) : null,
          type:           p.type,
          categories:     (p.categories ?? []).map((c: any) => c.name),
          totalSales:     p.total_sales ?? 0,
          date:           p.date_created,
          image:          p.images?.[0]?.src ?? null,
          variationCount: p.variations?.length ?? 0,
          permalink:      p.permalink ?? "",
        })),
      });
    } catch (err: any) {
      logger.error("WOO products error", err);
      res.status(err.status ?? 500).json({ error: err.message });
    }
  }
);

// ── GET /admin/woo/project/:id/customers ────────────────────────────────────
router.get(
  "/admin/woo/project/:id/customers",
  requireAdmin,
  async (req: Request, res: Response): Promise<void> => {
    try {
      const projectId = Number(req.params.id);
      const { wcGet, wcGetAll } = await resolveWoo(projectId);
      const page    = Math.max(1, Number(req.query.page) || 1);
      const perPage = Math.min(100, Math.max(1, Number(req.query.per_page) || 20));
      const search  = req.query.search   ?? "";

      let path = `/customers?page=${page}&per_page=${perPage}&orderby=registered_date&order=desc`;
      if (search) path += `&search=${encodeURIComponent(String(search))}`;

      const customers = await wcGet<any[]>(path);

      // WooCommerce 8+ ya no incluye orders_count ni total_spent en /customers:
      // se calculan con los pedidos pagados de cada cliente (5 a la vez).
      const stats = new Map<number, { n: number; spent: number }>();
      const pending = (customers as any[]).filter(c => c.orders_count == null || c.total_spent == null);
      for (let i = 0; i < pending.length; i += 5) {
        await Promise.all(pending.slice(i, i + 5).map(async (c: any) => {
          try {
            const os = await wcGetAll<any>(`/orders?customer=${Number(c.id)}&status=processing,completed&_fields=id,total`, 5);
            stats.set(c.id, { n: os.length, spent: os.reduce((s: number, o: any) => s + fmtMoney(o.total), 0) });
          } catch (e) {
            logger.warn?.("WOO customer stats error", e);
          }
        }));
      }

      res.json({
        customers: customers.map((c: any) => ({
          id:            c.id,
          name:          `${c.first_name ?? ""} ${c.last_name ?? ""}`.trim() || c.username || "—",
          email:         c.email,
          username:      c.username,
          role:          c.role,
          ordersCount:   c.orders_count ?? stats.get(c.id)?.n ?? 0,
          totalSpent:    c.total_spent != null ? fmtMoney(c.total_spent) : Math.round((stats.get(c.id)?.spent ?? 0) * 100) / 100,
          dateCreated:   c.date_created,
          dateModified:  c.date_modified,
          avatarUrl:     c.avatar_url ?? null,
          city:          c.billing?.city ?? "",
          country:       c.billing?.country ?? "",
        })),
      });
    } catch (err: any) {
      logger.error("WOO customers error", err);
      res.status(err.status ?? 500).json({ error: err.message });
    }
  }
);

// ── GET /admin/woo/project/:id/coupons ──────────────────────────────────────
router.get(
  "/admin/woo/project/:id/coupons",
  requireAdmin,
  async (req: Request, res: Response): Promise<void> => {
    try {
      const projectId = Number(req.params.id);
      const { wcGetAll } = await resolveWoo(projectId);

      const coupons = await wcGetAll<any>("/coupons?orderby=date&order=desc", 10);

      res.json({
        coupons: coupons.map((c: any) => ({
          id:             c.id,
          code:           c.code,
          discountType:   c.discount_type,
          amount:         fmtMoney(c.amount),
          description:    c.description ?? "",
          dateExpiry:     c.date_expires ?? null,
          usageCount:     c.usage_count ?? 0,
          usageLimit:     c.usage_limit ?? null,
          usageLimitUser: c.usage_limit_per_user ?? null,
          freeShipping:   c.free_shipping ?? false,
          minimumAmount:  c.minimum_amount ? fmtMoney(c.minimum_amount) : null,
          maximumAmount:  c.maximum_amount ? fmtMoney(c.maximum_amount) : null,
          individualUse:  c.individual_use ?? false,
          emailRestrictions: c.email_restrictions ?? [],
          productIds:     c.product_ids ?? [],
          excludedProductIds: c.excluded_product_ids ?? [],
          dateCreated:    c.date_created,
        })),
      });
    } catch (err: any) {
      logger.error("WOO coupons error", err);
      res.status(err.status ?? 500).json({ error: err.message });
    }
  }
);

// ── GET /admin/woo/project/:id/inventory ────────────────────────────────────
router.get(
  "/admin/woo/project/:id/inventory",
  requireAdmin,
  async (req: Request, res: Response): Promise<void> => {
    try {
      const projectId = Number(req.params.id);
      const { wcGetAll } = await resolveWoo(projectId);

      // Todas las páginas (no solo 50). En el REST de WooCommerce no hay filtro manage_stock:
      // los productos con unidades controladas se separan aquí.
      const campos = "id,name,sku,stock_status,stock_quantity,manage_stock,low_stock_amount,price,status";
      const [inStock, outOfStock, backorder] = await Promise.all([
        wcGetAll<any>(`/products?stock_status=instock&status=publish&_fields=${campos}`),
        wcGetAll<any>(`/products?stock_status=outofstock&status=publish&_fields=${campos}`),
        wcGetAll<any>(`/products?stock_status=onbackorder&status=publish&_fields=${campos}`),
      ]);
      const highStock = [...inStock, ...outOfStock, ...backorder];

      // Stock bajo: con unidades controladas y por debajo de su umbral (o de 5 si no tiene)
      const lowStockFiltered = (inStock as any[]).filter(p =>
        p.manage_stock && p.stock_quantity != null && p.stock_quantity < (Number(p.low_stock_amount) || 5)
      );

      res.json({
        outOfStock: (outOfStock as any[]).map(p => ({
          id: p.id, name: p.name, sku: p.sku,
          stockStatus: p.stock_status,
          stockQuantity: p.stock_quantity,
          price: fmtMoney(p.price),
        })),
        lowStock: lowStockFiltered.map(p => ({
          id: p.id, name: p.name, sku: p.sku,
          stockQuantity: p.stock_quantity,
          price: fmtMoney(p.price),
        })),
        backorder: (backorder as any[]).map(p => ({
          id: p.id, name: p.name, sku: p.sku,
          stockStatus: p.stock_status,
          stockQuantity: p.stock_quantity,
          price: fmtMoney(p.price),
        })),
        totalTracked: (highStock as any[]).filter(p => p.manage_stock).length,
        outOfStockCount: (outOfStock as any[]).length,
        backorderCount:  (backorder as any[]).length,
        lowStockCount:   lowStockFiltered.length,
      });
    } catch (err: any) {
      logger.error("WOO inventory error", err);
      res.status(err.status ?? 500).json({ error: err.message });
    }
  }
);

// ── PUT /admin/woo/project/:id/products/:pid ────────────────────────────────
router.put(
  "/admin/woo/project/:id/products/:pid",
  requireAdmin,
  async (req: Request, res: Response): Promise<void> => {
    try {
      const projectId = Number(req.params.id);
      const productId = Number(req.params.pid);
      const { wcPut } = await resolveWoo(projectId);
      const updated = await wcPut<any>(`/products/${productId}`, req.body);
      res.json({ success: true, product: { id: updated.id, name: updated.name, status: updated.status } });
    } catch (err: any) {
      logger.error("WOO product update error", err);
      res.status(err.status ?? 500).json({ error: err.message });
    }
  }
);

// ── GET /admin/woo/project/:id/reports/sales ────────────────────────────────
router.get(
  "/admin/woo/project/:id/reports/sales",
  requireAdmin,
  async (req: Request, res: Response): Promise<void> => {
    try {
      const projectId = Number(req.params.id);
      const { wcGet } = await resolveWoo(projectId);
      const period = ["week", "month", "last_month", "year"].includes(String(req.query.period)) ? String(req.query.period) : "month";
      const [salesReport, ordersTotals] = await Promise.all([
        wcGet<any>(`/reports/sales?period=${period}`),
        wcGet<any[]>("/reports/orders/totals"),
      ]);
      res.json({ sales: salesReport, orderTotals: ordersTotals });
    } catch (err: any) {
      logger.error("WOO reports error", err);
      res.status(err.status ?? 500).json({ error: err.message });
    }
  }
);

export default router;
