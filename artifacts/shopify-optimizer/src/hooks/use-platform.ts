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
}

const PLATFORM_MAP: Record<string, PlatformFeatures> = {
  shopify:     { platform: "shopify",     label: "Shopify",       icon: "🟢", color: "#95bf47", hasProducts: true,  hasThemes: true,  hasCollections: true,  hasOrders: true,  hasInventory: true,  hasSeoWrite: true,  hasGraphQL: true,  isAuditOnly: false, isStripe: false, hiddenTabs: [] },
  woocommerce: { platform: "woocommerce", label: "WooCommerce",   icon: "🟣", color: "#96588a", hasProducts: true,  hasThemes: false, hasCollections: false, hasOrders: true,  hasInventory: true,  hasSeoWrite: true,  hasGraphQL: false, isAuditOnly: false, isStripe: false, hiddenTabs: ["themes"] },
  prestashop:  { platform: "prestashop",  label: "PrestaShop",    icon: "🔴", color: "#df0067", hasProducts: true,  hasThemes: false, hasCollections: false, hasOrders: true,  hasInventory: true,  hasSeoWrite: true,  hasGraphQL: false, isAuditOnly: false, isStripe: false, hiddenTabs: ["themes"] },
  universal:   { platform: "universal",   label: "Auditoría Web", icon: "🌐", color: "#5b9bd5", hasProducts: false, hasThemes: false, hasCollections: false, hasOrders: false, hasInventory: false, hasSeoWrite: false, hasGraphQL: false, isAuditOnly: true,  isStripe: false, hiddenTabs: ["products", "pricing", "redesign", "images", "inventory", "emails", "ab-testing", "themes", "collections"] },
  stripe:      { platform: "stripe",      label: "Stripe",        icon: "💳", color: "#635bff", hasProducts: false, hasThemes: false, hasCollections: false, hasOrders: false, hasInventory: false, hasSeoWrite: false, hasGraphQL: false, isAuditOnly: false, isStripe: true,  hiddenTabs: ["redesign", "images", "consistency", "ab-testing", "pricing", "tripo3d", "meshy"] },
  tiendanube:  { platform: "tiendanube",  label: "Tienda Nube",   icon: "☁️", color: "#00a0e3", hasProducts: true,  hasThemes: false, hasCollections: true,  hasOrders: true,  hasInventory: true,  hasSeoWrite: true,  hasGraphQL: false, isAuditOnly: false, isStripe: false, hiddenTabs: ["themes"] },
};

export function usePlatformFeatures(platformType?: string | null): PlatformFeatures {
  return PLATFORM_MAP[platformType ?? "shopify"] ?? PLATFORM_MAP.shopify;
}
