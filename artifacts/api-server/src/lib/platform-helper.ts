import { db, projectsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import type { IPlatformConnector } from "./connectors/types.js";
import { logger } from "./logger.js";

export async function getProjectConnector(projectId: number): Promise<IPlatformConnector | null> {
  try {
    const [project] = await db.select().from(projectsTable).where(eq(projectsTable.id, projectId));
    if (!project) return null;

    const platformType = (project as any).platformType ?? "shopify";

    switch (platformType) {
      case "shopify": {
        const { ShopifyConnector } = await import("./connectors/shopify.js");
        return new ShopifyConnector(project);
      }
      case "woocommerce": {
        const { WooCommerceConnector } = await import("./connectors/woocommerce.js");
        return new WooCommerceConnector(project);
      }
      case "prestashop": {
        const { PrestaShopConnector } = await import("./connectors/prestashop.js");
        return new PrestaShopConnector(project);
      }
      case "universal": {
        const { UniversalAuditConnector } = await import("./connectors/universal.js");
        return new UniversalAuditConnector(project);
      }
      default:
        logger.warn({ projectId, platformType }, "Unsupported platform type");
        return null;
    }
  } catch (err) {
    logger.error({ err, projectId }, "Failed to get platform connector");
    return null;
  }
}

export async function withConnector<T>(
  projectId: number,
  feature: string,
  fn: (connector: IPlatformConnector) => Promise<T>
): Promise<{ success: true; data: T } | { success: false; error: string }> {
  const connector = await getProjectConnector(projectId);
  if (!connector) {
    return { success: false, error: "Proyecto no encontrado o plataforma no soportada" };
  }
  if (!connector.supportsFeature(feature as any)) {
    return { success: false, error: `La plataforma ${connector.platformType} no soporta "${feature}"` };
  }
  try {
    const data = await fn(connector);
    return { success: true, data };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Error desconocido";
    return { success: false, error: msg };
  }
}
