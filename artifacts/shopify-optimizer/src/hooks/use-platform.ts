import { getPlatform, type PlatformDefinition } from "@/lib/platform-capabilities";

/**
 * Vista derivada del registro central de plataformas (src/lib/platform-capabilities.ts).
 * Mantiene la forma histórica `PlatformFeatures` para los componentes que la usan.
 */
export interface PlatformFeatures {
  platform: string;
  label: string;
  icon: string;
  color: string;
  hasProducts: boolean;
  hasThemes: boolean;
  hasCollections: boolean;
  hasOrders: boolean;
  hasInventory: boolean;
  hasSeoWrite: boolean;
  hasGraphQL: boolean;
  isAuditOnly: boolean;
  isStripe: boolean;
  hiddenTabs: string[];
  definition: PlatformDefinition;
}

export function toPlatformFeatures(def: PlatformDefinition): PlatformFeatures {
  const has = (c: PlatformDefinition["capabilities"][number]) => def.capabilities.includes(c);
  return {
    platform: def.key,
    label: def.label,
    icon: def.icon,
    color: def.color,
    hasProducts: has("products"),
    hasThemes: has("themes"),
    hasCollections: has("collections"),
    hasOrders: has("orders"),
    hasInventory: has("inventory"),
    hasSeoWrite: has("seo_write"),
    hasGraphQL: def.key === "shopify",
    isAuditOnly: def.capabilities.length === 1 && has("web_audit"),
    isStripe: def.key === "stripe",
    hiddenTabs: def.hiddenTabs,
    definition: def,
  };
}

export function usePlatformFeatures(platformType?: string | null): PlatformFeatures {
  return toPlatformFeatures(getPlatform(platformType));
}
