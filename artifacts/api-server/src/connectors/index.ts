import type { Project } from "@workspace/db";
import type { IPlatformConnector } from "./types.js";
import { PlatformNotSupportedError } from "./types.js";
import { ShopifyConnector } from "./shopify.js";

export function getConnector(project: Project): IPlatformConnector {
  const platformType = project.platformType ?? "shopify";

  switch (platformType) {
    case "shopify":
      return new ShopifyConnector(project);
    case "woocommerce":
    case "prestashop":
    case "wordpress":
    case "universal":
      throw new PlatformNotSupportedError(platformType);
    default:
      throw new PlatformNotSupportedError(platformType);
  }
}

export { ShopifyConnector } from "./shopify.js";
export { PlatformNotSupportedError } from "./types.js";
export type {
  IPlatformConnector,
  ConnectionTestResult,
  PagedResult,
  PlatformProduct,
  PlatformVariant,
  PlatformImage,
  PlatformOption,
  SeoData,
  InventoryData,
  ImageResult,
  PlatformFeature,
} from "./types.js";
