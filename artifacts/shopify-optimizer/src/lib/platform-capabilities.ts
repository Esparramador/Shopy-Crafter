/**
 * platform-capabilities.ts — Registro central de capacidades por plataforma (frontend)
 * ─────────────────────────────────────────────────────────────────────────────
 * Única fuente de verdad en la UI para "qué gestiona cada plataforma y cómo se
 * presenta": colores, iconos, etiquetas, módulos del panel admin, navegación
 * del panel de cliente y pestañas ocultas.
 *
 * Espejo de api-server/src/lib/platform-capabilities.ts (mismas claves de
 * capacidad). Si añades una capacidad, añádela en ambos.
 */

export type PlatformKey =
  | "shopify"
  | "woocommerce"
  | "prestashop"
  | "wordpress"
  | "universal"
  | "stripe"
  | "tiendanube";

export type Capability =
  | "products"
  | "collections"
  | "orders"
  | "inventory"
  | "themes"
  | "seo_write"
  | "web_audit"
  | "customers"
  | "payments"
  | "subscriptions"
  | "invoices"
  | "refunds"
  | "payouts"
  | "balance";

export interface NavModule { id: string; label: string; icon: string }
export interface ClientNavItem { href: string; label: string; icon: string; requires?: Capability }

export interface PlatformDefinition {
  key: PlatformKey;
  label: string;
  icon: string;
  color: string;
  /** Entidad principal para el cliente ("Tu tienda" / "Tu cuenta Stripe") */
  entityLabel: string;
  /** Subtítulo por defecto bajo el nombre del proyecto en el panel cliente */
  panelLabel: string;
  hubLabel: string;
  credentialHint: string;
  capabilities: Capability[];
  /** Módulos de la barra lateral admin (id = sufijo de /projects/:id/<id>) */
  adminModules: NavModule[];
  /** Navegación del panel de cliente */
  clientNav: ClientNavItem[];
  /** Pestañas de proyecto que no aplican a esta plataforma */
  hiddenTabs: string[];
  /** ¿La plataforma trabaja con un access token de tienda (banner de token caducado, renovar token)? */
  usesStoreToken: boolean;
}

// ── Bloques reutilizables ─────────────────────────────────────────────────────
const STORE_CAPS: Capability[] = ["products", "orders", "inventory", "seo_write", "web_audit", "customers"];

const CREATIVE_MODULES: NavModule[] = [
  { id: "fusion-studio",     label: "Studio Foto IA",      icon: "🧬" },
  { id: "fusion-studio-pro", label: "Studio Vídeo IA",     icon: "⚡" },
  { id: "ad-studio",         label: "Studio Anuncios",     icon: "📺" },
  { id: "campaign-kit",      label: "Kit Campañas",        icon: "🎬" },
  { id: "generator",         label: "Generador IA",        icon: "✨" },
  { id: "vault",             label: "Repositorio",         icon: "🗄️" },
  { id: "exports",           label: "Informes / Exportar", icon: "📥" },
];

const STORE_OPTIMIZATION_MODULES: NavModule[] = [
  { id: "audit",       label: "Auditoría",      icon: "📊" },
  { id: "redesign",    label: "Rediseño IA",    icon: "✏️" },
  { id: "images",      label: "Imágenes IA",    icon: "🖼" },
  { id: "consistency", label: "Consistencia",   icon: "🎨" },
  { id: "ab-testing",  label: "A/B Testing",    icon: "📈" },
  { id: "pricing",     label: "Pricing Engine", icon: "💰" },
  { id: "seo",         label: "SEO Engine",     icon: "🔍" },
];

const STORE_CLIENT_NAV: ClientNavItem[] = [
  { href: "/client",           label: "Dashboard",    icon: "📊" },
  { href: "/client/products",  label: "Productos",    icon: "📦", requires: "products" },
  { href: "/client/approvals", label: "Aprobaciones", icon: "✅" },
  { href: "/client/messages",  label: "Mensajes",     icon: "💬" },
  { href: "/client/reports",   label: "Reportes",     icon: "📈" },
  { href: "/client/tienda",    label: "Mis Planes",   icon: "🛒" },
  { href: "/client/notebook",  label: "Cuaderno IA",  icon: "📋" },
];

// ── Registro ──────────────────────────────────────────────────────────────────
export const PLATFORMS: Record<PlatformKey, PlatformDefinition> = {
  shopify: {
    key: "shopify", label: "Shopify", icon: "🟢", color: "#95bf47",
    entityLabel: "Tu tienda", panelLabel: "Panel de tienda", hubLabel: "Panel de tienda",
    credentialHint: "Client ID y Client Secret de la app Shopify",
    capabilities: [...STORE_CAPS, "collections", "themes"],
    adminModules: [
      { id: "audit",       label: "Auditoría",    icon: "📊" },
      { id: "redesign",    label: "Rediseño IA",  icon: "✏️" },
      { id: "images",      label: "Imágenes IA",  icon: "🖼" },
      { id: "consistency", label: "Consistencia", icon: "🎨" },
      { id: "ab-testing",  label: "A/B Testing",  icon: "📈" },
      { id: "pricing",     label: "Pricing",      icon: "💰" },
      { id: "seo",         label: "SEO Engine",   icon: "🔍" },
      { id: "vault",       label: "Repositorio",  icon: "🗄️" },
      { id: "tripo3d",     label: "Tripo 3D Studio", icon: "🧊" },
      { id: "meshy",       label: "Meshy Characters", icon: "🧊✨" },
    ],
    clientNav: STORE_CLIENT_NAV,
    hiddenTabs: [],
    usesStoreToken: true,
  },
  woocommerce: {
    key: "woocommerce", label: "WooCommerce", icon: "🟣", color: "#96588a",
    entityLabel: "Tu tienda", panelLabel: "Panel de tienda", hubLabel: "WooCommerce Hub",
    credentialHint: "Consumer Key (ck_) y Consumer Secret (cs_)",
    capabilities: STORE_CAPS,
    adminModules: [{ id: "woo-hub", label: "WooCommerce Hub", icon: "🟣" }, ...STORE_OPTIMIZATION_MODULES, ...CREATIVE_MODULES],
    clientNav: STORE_CLIENT_NAV,
    hiddenTabs: ["themes"],
    usesStoreToken: true,
  },
  prestashop: {
    key: "prestashop", label: "PrestaShop", icon: "🔴", color: "#df0067",
    entityLabel: "Tu tienda", panelLabel: "Panel de tienda", hubLabel: "PrestaShop Hub",
    credentialHint: "Clave API de PrestaShop (32 caracteres)",
    capabilities: STORE_CAPS,
    adminModules: [{ id: "ps-hub", label: "PrestaShop Hub", icon: "🔴" }, ...STORE_OPTIMIZATION_MODULES, ...CREATIVE_MODULES],
    clientNav: STORE_CLIENT_NAV,
    hiddenTabs: ["themes"],
    usesStoreToken: true,
  },
  wordpress: {
    key: "wordpress", label: "WordPress", icon: "🔵", color: "#21759b",
    entityLabel: "Tu web", panelLabel: "Panel web", hubLabel: "Panel web",
    credentialHint: "Usuario y contraseña de aplicación",
    capabilities: ["web_audit", "seo_write"],
    adminModules: [
      { id: "audit", label: "Auditoría Web", icon: "📊" },
      { id: "seo",   label: "SEO Engine",    icon: "🔍" },
      ...CREATIVE_MODULES,
    ],
    clientNav: STORE_CLIENT_NAV,
    hiddenTabs: ["products", "pricing", "redesign", "images", "inventory", "ab-testing", "themes", "collections"],
    usesStoreToken: true,
  },
  universal: {
    key: "universal", label: "Auditoría Web", icon: "🌐", color: "#5b9bd5",
    entityLabel: "Tu web", panelLabel: "Panel de auditoría", hubLabel: "Panel de auditoría",
    credentialHint: "Solo la URL pública",
    capabilities: ["web_audit"],
    adminModules: [
      { id: "audit", label: "Auditoría Web", icon: "📊" },
      ...CREATIVE_MODULES,
    ],
    clientNav: STORE_CLIENT_NAV,
    hiddenTabs: ["products", "pricing", "redesign", "images", "inventory", "emails", "ab-testing", "themes", "collections"],
    usesStoreToken: false,
  },
  stripe: {
    key: "stripe", label: "Stripe", icon: "💳", color: "#635bff",
    entityLabel: "Tu cuenta Stripe", panelLabel: "Panel de pagos", hubLabel: "Stripe Hub",
    credentialHint: "Clave secreta de Stripe (sk_test_… o sk_live_…)",
    capabilities: ["customers", "payments", "subscriptions", "invoices", "refunds", "payouts", "balance", "products", "web_audit"],
    adminModules: [
      { id: "stripe-hub",    label: "Stripe Hub",      icon: "💳" },
      { id: "audit",         label: "Auditoría Web",   icon: "📊" },
      { id: "vault",         label: "Repositorio",     icon: "🗄️" },
      { id: "fusion-studio", label: "Studio Foto",     icon: "🧬" },
      { id: "ad-studio",     label: "Studio Anuncios", icon: "📺" },
    ],
    clientNav: [
      { href: "/client",           label: "Dashboard",     icon: "📊" },
      { href: "/client/stripe",    label: "Actividad",     icon: "💳" },
      { href: "/client/approvals", label: "Aprobaciones",  icon: "✅" },
      { href: "/client/messages",  label: "Mensajes",      icon: "💬" },
      { href: "/client/tienda",    label: "Mis Planes",    icon: "🛒" },
      { href: "/client/notebook",  label: "Cuaderno IA",   icon: "📋" },
    ],
    hiddenTabs: ["redesign", "images", "consistency", "ab-testing", "pricing", "tripo3d", "meshy"],
    usesStoreToken: false,
  },
  tiendanube: {
    key: "tiendanube", label: "Tienda Nube", icon: "☁️", color: "#00a0e3",
    entityLabel: "Tu tienda", panelLabel: "Panel de tienda", hubLabel: "Panel de tienda",
    credentialHint: "Access token de Tienda Nube",
    capabilities: [...STORE_CAPS, "collections"],
    adminModules: [...STORE_OPTIMIZATION_MODULES, ...CREATIVE_MODULES],
    clientNav: STORE_CLIENT_NAV,
    hiddenTabs: ["themes"],
    usesStoreToken: true,
  },
};

export function getPlatform(key?: string | null): PlatformDefinition {
  return PLATFORMS[(key ?? "shopify") as PlatformKey] ?? PLATFORMS.shopify;
}

export function platformHas(key: string | null | undefined, cap: Capability): boolean {
  return getPlatform(key).capabilities.includes(cap);
}

/** Navegación de cliente filtrada por capacidades reales de la plataforma */
export function getClientNav(key?: string | null): ClientNavItem[] {
  const def = getPlatform(key);
  return def.clientNav.filter(item => !item.requires || def.capabilities.includes(item.requires));
}
