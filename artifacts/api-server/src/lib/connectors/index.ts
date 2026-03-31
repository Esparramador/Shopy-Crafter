import type { Project } from "@workspace/db";
import type { IPlatformConnector } from "./types";
import { PlatformNotSupportedError } from "./types";
import { ShopifyConnector } from "./shopify";

export function getConnector(project: Project): IPlatformConnector {
  const platformType = (project as Project & { platformType?: string }).platformType ?? "shopify";

  switch (platformType) {
    case "shopify":
      return new ShopifyConnector(project);

    case "woocommerce":
      throw new PlatformNotSupportedError("woocommerce");

    case "prestashop":
      throw new PlatformNotSupportedError("prestashop");

    case "wordpress":
      throw new PlatformNotSupportedError("wordpress");

    case "universal":
      throw new PlatformNotSupportedError("universal");

    default:
      throw new PlatformNotSupportedError(platformType);
  }
}

export { ShopifyConnector } from "./shopify";
export { PlatformNotSupportedError, FeatureNotSupportedError } from "./types";
export type {
  IPlatformConnector,
  ConnectionTestResult,
  PlatformProduct,
  PlatformOrder,
  SeoData,
  InventoryData,
  PagedResult,
  PlatformFeature,
} from "./types";
