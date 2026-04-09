import { db, projectsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import type { IPlatformConnector, PlatformFeature } from "./connectors/types.js";
import { logger } from "./logger.js";

const connectorCache = new Map<number, { connector: IPlatformConnector; ts: number }>();
const CACHE_TTL = 60_000;

export async function getProjectConnector(projectId: number): Promise<IPlatformConnector | null> {
  const cached = connectorCache.get(projectId);
  if (cached && Date.now() - cached.ts < CACHE_TTL) return cached.connector;

  try {
    const [project] = await db.select().from(projectsTable).where(eq(projectsTable.id, projectId));
    if (!project) return null;

    const platformType = (project as Record<string, unknown>).platformType ?? "shopify";
    let connector: IPlatformConnector;

    switch (platformType) {
      case "shopify": {
        const { ShopifyConnector } = await import("./connectors/shopify.js");
        connector = new ShopifyConnector(project);
        break;
      }
      case "woocommerce": {
        const { WooCommerceConnector } = await import("./connectors/woocommerce.js");
        connector = new WooCommerceConnector(project);
        break;
      }
      case "prestashop": {
        const { PrestaShopConnector } = await import("./connectors/prestashop.js");
        connector = new PrestaShopConnector(project);
        break;
      }
      case "universal": {
        const { UniversalAuditConnector } = await import("./connectors/universal.js");
        connector = new UniversalAuditConnector(project);
        break;
      }
      default:
        logger.warn({ projectId, platformType }, "Unsupported platform type");
        return null;
    }

    connectorCache.set(projectId, { connector, ts: Date.now() });
    return connector;
  } catch (err) {
    logger.error({ err, projectId }, "Failed to get platform connector");
    return null;
  }
}

export function clearConnectorCache(projectId?: number): void {
  if (projectId) connectorCache.delete(projectId);
  else connectorCache.clear();
}

export async function getProjectPlatformType(projectId: number): Promise<string> {
  try {
    const [p] = await db.select().from(projectsTable).where(eq(projectsTable.id, projectId));
    return ((p as Record<string, unknown>)?.platformType as string) ?? "shopify";
  } catch { return "shopify"; }
}

export async function withPlatform<T>(
  projectId: number,
  feature: PlatformFeature,
  fn: (connector: IPlatformConnector) => Promise<T>
): Promise<{ ok: true; data: T } | { ok: false; error: string; code: string }> {
  const connector = await getProjectConnector(projectId);
  if (!connector) return { ok: false, error: "Proyecto no encontrado o plataforma no configurada", code: "NO_CONNECTOR" };
  if (!connector.supportsFeature(feature)) {
    return { ok: false, error: `${connector.platformType} no soporta "${feature}". Funciones disponibles: productos, SEO, pedidos.`, code: "FEATURE_NOT_SUPPORTED" };
  }
  try {
    const data = await fn(connector);
    return { ok: true, data };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Error desconocido", code: "PLATFORM_ERROR" };
  }
}

export async function getStoreProducts(projectId: number, params?: { status?: string; page?: number; limit?: number }) {
  return withPlatform(projectId, "products", c => c.getProducts(params));
}

export async function getStoreOrders(projectId: number, params?: { page?: number; limit?: number; after?: string }) {
  return withPlatform(projectId, "orders", c => c.getOrders(params));
}

export async function updateStoreProduct(projectId: number, productId: string, data: Record<string, unknown>) {
  return withPlatform(projectId, "product_update", c => c.updateProduct(productId, data));
}

export async function getStoreSeo(projectId: number, productId: string) {
  return withPlatform(projectId, "seo_read", c => c.getSeoData(productId));
}

export async function updateStoreSeo(projectId: number, productId: string, data: Record<string, unknown>) {
  return withPlatform(projectId, "seo_write", c => c.updateSeo(productId, data));
}

export async function withConnector<T>(
  projectId: number,
  feature: string,
  fn: (connector: IPlatformConnector) => Promise<T>
): Promise<{ success: true; data: T } | { success: false; error: string }> {
  const result = await withPlatform(projectId, feature as PlatformFeature, fn);
  if (result.ok) return { success: true, data: result.data };
  return { success: false, error: result.error };
}
