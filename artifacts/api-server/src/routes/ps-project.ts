/**
 * ps-project.ts — PrestaShop Project Admin Hub API
 * ──────────────────────────────────────────────────
 * Rutas de gestión admin por proyecto PrestaShop:
 *   GET  /admin/ps/project/:id/overview      → Estado conexión, productos, pedidos
 *   GET  /admin/ps/project/:id/orders        → Lista paginada de pedidos
 *   GET  /admin/ps/project/:id/products      → Catálogo de productos
 *   GET  /admin/ps/project/:id/categories    → Árbol de categorías
 *   GET  /admin/ps/project/:id/inventory     → Alertas de stock
 *   GET  /admin/ps/project/:id/seo/:pid      → SEO metadata de un producto
 *   PUT  /admin/ps/project/:id/seo/:pid      → Actualizar SEO de un producto
 *   PUT  /admin/ps/project/:id/products/:pid → Actualizar producto
 */

import { Router, type Request, type Response } from "express";
import { eq } from "drizzle-orm";
import { requireAdmin } from "../lib/auth.js";
import { logger } from "../lib/logger.js";
import { PrestaShopConnector } from "../lib/connectors/prestashop.js";

const router = Router();

/** Express 5 tipa los params como string | string[]; en estas rutas siempre es uno. */
function routeParam(value: string | string[]): string {
  return Array.isArray(value) ? value[0] : value;
}

// ── Helper: carga proyecto PrestaShop y crea conector ───────────────────────
async function resolvePS(projectId: number) {
  const { db, projectsTable } = await import("@workspace/db");
  const project = await db.query.projectsTable.findFirst({
    where: eq(projectsTable.id, projectId),
  });
  if (!project) throw Object.assign(new Error("Proyecto no encontrado"), { status: 404 });
  if (project.platformType !== "prestashop")
    throw Object.assign(new Error("Este proyecto no es PrestaShop"), { status: 400 });

  const connector = new PrestaShopConnector(project);
  return { project, connector };
}

// ── GET /admin/ps/project/:id/overview ──────────────────────────────────────
router.get(
  "/admin/ps/project/:id/overview",
  requireAdmin,
  async (req: Request, res: Response): Promise<void> => {
    try {
      const projectId = Number(req.params.id);
      const { project, connector } = await resolvePS(projectId);

      const [connResult, productsResult, ordersResult, categoriesResult] = await Promise.allSettled([
        connector.testConnection(),
        connector.getProductCount(),
        connector.getOrders({ limit: 5 }),
        connector.getCategories(),
      ]);

      const conn       = connResult.status       === "fulfilled" ? connResult.value       : null;
      const productCount = productsResult.status === "fulfilled" ? productsResult.value   : 0;
      const orders     = ordersResult.status     === "fulfilled" ? ordersResult.value     : [];
      const categories = categoriesResult.status === "fulfilled" ? categoriesResult.value : [];

      // Calcular revenue de últimos pedidos
      const revenue30d = (orders as any[]).reduce((sum: number, o: any) => {
        const amount = parseFloat(String(o.totalPrice ?? o.total_price ?? 0));
        return sum + (isNaN(amount) ? 0 : amount);
      }, 0);

      res.json({
        connected:       conn?.connected ?? false,
        storeName:       conn?.storeName ?? "PrestaShop",
        // ConnectionTestResult no trae la URL (antes siempre salía ""): es la del proyecto.
        storeUrl:        project.shopDomain ? `https://${project.shopDomain.replace(/^https?:\/\//, "").replace(/\/+$/, "")}` : "",
        productCount,
        categoryCount:   categories.length,
        orderCount:      orders.length,
        revenue30d,
        resources:       conn?.resources ?? [],
        recentOrders: (orders as any[]).map((o: any) => ({
          id:           o.id,
          reference:    o.orderNumber ?? o.reference ?? `#${o.id}`,
          status:       o.status ?? o.orderStatus ?? "unknown",
          total:        parseFloat(String(o.totalPrice ?? o.total_price ?? 0)),
          currency:     o.currency ?? "EUR",
          customerName: o.customerName ?? o.customer_name ?? "—",
          date:         o.createdAt ?? o.created_at,
          itemCount:    o.lineItems?.length ?? o.line_items?.length ?? 0,
        })),
        categories: categories.slice(0, 10).map((c: any) => ({
          id:       c.id,
          name:     c.name,
          parentId: c.parentId,
        })),
      });
    } catch (err: any) {
      logger.error({ err }, "PS overview error");
      res.status(err.status ?? 500).json({ error: err.message });
    }
  }
);

// ── GET /admin/ps/project/:id/orders ────────────────────────────────────────
router.get(
  "/admin/ps/project/:id/orders",
  requireAdmin,
  async (req: Request, res: Response): Promise<void> => {
    try {
      const projectId = Number(req.params.id);
      const { connector } = await resolvePS(projectId);
      const page    = parseInt(String(req.query.page    ?? "1"), 10);
      const limit   = parseInt(String(req.query.limit   ?? "20"), 10);

      const orders = await connector.getOrders({ page, limit });

      res.json({
        orders: orders.map((o: any) => ({
          id:           o.id,
          reference:    o.orderNumber ?? o.reference ?? `#${o.id}`,
          status:       o.status ?? o.orderStatus ?? "unknown",
          total:        parseFloat(String(o.totalPrice ?? o.total_price ?? 0)),
          currency:     o.currency ?? "EUR",
          customerName: o.customerName ?? o.customer_name ?? "—",
          email:        o.email ?? "",
          date:         o.createdAt ?? o.created_at,
          datePaid:     o.datePaid ?? o.date_paid ?? null,
          paymentMethod:o.paymentMethod ?? o.payment ?? "",
          itemCount:    o.lineItems?.length ?? o.line_items?.length ?? 0,
          items:        (o.lineItems ?? o.line_items ?? []).map((li: any) => ({
            name:  li.name ?? li.product_name ?? "",
            qty:   li.quantity ?? 1,
            price: parseFloat(String(li.unitPrice ?? li.unit_price_tax_incl ?? 0)),
          })),
          shippingTotal: parseFloat(String(o.totalShipping ?? o.total_shipping ?? 0)),
        })),
      });
    } catch (err: any) {
      logger.error({ err }, "PS orders error");
      res.status(err.status ?? 500).json({ error: err.message });
    }
  }
);

// ── GET /admin/ps/project/:id/products ──────────────────────────────────────
router.get(
  "/admin/ps/project/:id/products",
  requireAdmin,
  async (req: Request, res: Response): Promise<void> => {
    try {
      const projectId = Number(req.params.id);
      const { connector } = await resolvePS(projectId);
      const page   = parseInt(String(req.query.page  ?? "1"), 10);
      const limit  = parseInt(String(req.query.limit ?? "20"), 10);

      const products = await connector.getProducts({ page, limit });

      res.json({
        products: products.map((p: any) => ({
          id:            p.id,
          platformId:    p.platformProductId ?? String(p.id),
          name:          p.title ?? p.name ?? "—",
          sku:           p.sku ?? "",
          status:        p.status ?? "active",
          price:         parseFloat(String(p.price ?? 0)),
          comparePrice:  p.compareAtPrice ? parseFloat(String(p.compareAtPrice)) : null,
          quantity:      p.inventory ?? p.quantity ?? 0,
          categories:    p.categories ?? [],
          images:        p.images ?? [],
          metaTitle:     p.metaTitle ?? "",
          metaDesc:      p.metaDescription ?? "",
          date:          p.createdAt ?? "",
          active:        p.status === "active" || p.status === "1",
        })),
      });
    } catch (err: any) {
      logger.error({ err }, "PS products error");
      res.status(err.status ?? 500).json({ error: err.message });
    }
  }
);

// ── GET /admin/ps/project/:id/categories ────────────────────────────────────
router.get(
  "/admin/ps/project/:id/categories",
  requireAdmin,
  async (req: Request, res: Response): Promise<void> => {
    try {
      const projectId = Number(req.params.id);
      const { connector } = await resolvePS(projectId);

      const categories = await connector.getCategories();

      // Construir árbol jerárquico
      const map: Record<number, any> = {};
      categories.forEach((c: any) => {
        map[c.id] = { ...c, children: [] };
      });
      const roots: any[] = [];
      categories.forEach((c: any) => {
        if (c.parentId && map[c.parentId]) {
          map[c.parentId].children.push(map[c.id]);
        } else {
          roots.push(map[c.id]);
        }
      });

      res.json({ categories, tree: roots, total: categories.length });
    } catch (err: any) {
      logger.error({ err }, "PS categories error");
      res.status(err.status ?? 500).json({ error: err.message });
    }
  }
);

// ── GET /admin/ps/project/:id/inventory ─────────────────────────────────────
router.get(
  "/admin/ps/project/:id/inventory",
  requireAdmin,
  async (req: Request, res: Response): Promise<void> => {
    try {
      const projectId = Number(req.params.id);
      const { connector } = await resolvePS(projectId);

      const products = await connector.getProducts({ limit: 100 });

      const outOfStock = products.filter((p: any) => (p.inventory ?? p.quantity ?? 0) <= 0);
      const lowStock   = products.filter((p: any) => {
        const q = p.inventory ?? p.quantity ?? 0;
        return q > 0 && q < 5;
      });

      res.json({
        outOfStock: outOfStock.map((p: any) => ({
          id:       p.id,
          platformId: p.platformProductId ?? String(p.id),
          name:     p.title ?? p.name,
          sku:      p.sku ?? "",
          quantity: p.inventory ?? p.quantity ?? 0,
          price:    parseFloat(String(p.price ?? 0)),
          active:   p.status === "active",
        })),
        lowStock: lowStock.map((p: any) => ({
          id:       p.id,
          platformId: p.platformProductId ?? String(p.id),
          name:     p.title ?? p.name,
          sku:      p.sku ?? "",
          quantity: p.inventory ?? p.quantity ?? 0,
          price:    parseFloat(String(p.price ?? 0)),
        })),
        outOfStockCount: outOfStock.length,
        lowStockCount:   lowStock.length,
        totalTracked:    products.length,
      });
    } catch (err: any) {
      logger.error({ err }, "PS inventory error");
      res.status(err.status ?? 500).json({ error: err.message });
    }
  }
);

// ── GET /admin/ps/project/:id/seo/:pid ──────────────────────────────────────
router.get(
  "/admin/ps/project/:id/seo/:pid",
  requireAdmin,
  async (req: Request, res: Response): Promise<void> => {
    try {
      const projectId = Number(req.params.id);
      const productId = routeParam(req.params.pid);
      const { connector } = await resolvePS(projectId);
      const seo = await connector.getSeoData(productId);
      res.json({ seo });
    } catch (err: any) {
      logger.error({ err }, "PS seo get error");
      res.status(err.status ?? 500).json({ error: err.message });
    }
  }
);

// ── PUT /admin/ps/project/:id/seo/:pid ──────────────────────────────────────
router.put(
  "/admin/ps/project/:id/seo/:pid",
  requireAdmin,
  async (req: Request, res: Response): Promise<void> => {
    try {
      const projectId = Number(req.params.id);
      const productId = routeParam(req.params.pid);
      const { connector } = await resolvePS(projectId);
      const { metaTitle, metaDescription } = req.body;
      const updated = await connector.updateSeo(productId, { metaTitle, metaDescription });
      res.json({ success: true, seo: updated });
    } catch (err: any) {
      logger.error({ err }, "PS seo update error");
      res.status(err.status ?? 500).json({ error: err.message });
    }
  }
);

// ── PUT /admin/ps/project/:id/products/:pid ─────────────────────────────────
router.put(
  "/admin/ps/project/:id/products/:pid",
  requireAdmin,
  async (req: Request, res: Response): Promise<void> => {
    try {
      const projectId = Number(req.params.id);
      const productId = routeParam(req.params.pid);
      const { connector } = await resolvePS(projectId);
      const updated = await connector.updateProduct(productId, req.body);
      res.json({ success: true, product: updated });
    } catch (err: any) {
      logger.error({ err }, "PS product update error");
      res.status(err.status ?? 500).json({ error: err.message });
    }
  }
);

export default router;
