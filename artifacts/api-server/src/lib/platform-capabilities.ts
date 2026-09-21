/**
 * platform-capabilities.ts — Registro central de capacidades por plataforma (backend)
 * ─────────────────────────────────────────────────────────────────────────────
 * Única fuente de verdad en el servidor para "qué puede gestionar cada plataforma".
 * Lo consumen: rutas de cliente (para rechazar recursos que la plataforma no tiene),
 * el chatbot (prompts rápidos + contexto) y GET /api/platforms.
 *
 * El frontend tiene su espejo en shopify-optimizer/src/lib/platform-capabilities.ts
 * (mismas claves de capacidad). Si añades una capacidad, añádela en ambos.
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

export interface PlatformDefinition {
  key: PlatformKey;
  label: string;
  icon: string;
  color: string;
  /** Cómo se llama la entidad principal para el cliente ("Tu tienda" vs "Tu cuenta Stripe") */
  entityLabel: string;
  /** Cómo se llama el hub de gestión admin */
  hubLabel: string;
  /** Qué credencial pide la plataforma (para mensajes de error y ayuda) */
  credentialHint: string;
  capabilities: Capability[];
  /** Prompts rápidos del chatbot cuando el proyecto activo es de esta plataforma */
  quickPrompts: Array<{ icon: string; label: string; prompt: string }>;
  /** Resumen en una línea para inyectar en el contexto del chatbot */
  chatbotContext: string;
}

const STORE_CAPS: Capability[] = ["products", "orders", "inventory", "seo_write", "web_audit", "customers"];

const STORE_PROMPTS = [
  { icon: "🏪", label: "Estado de la tienda", prompt: "Muéstrame el estado completo de la tienda: productos con score, pedidos recientes y estado de la conexión." },
  { icon: "🔍", label: "Auditoría rápida", prompt: "Haz una auditoría rápida de mi tienda: top-3 problemas críticos de SEO, conversión e imágenes con su impacto estimado en ventas." },
  { icon: "📊", label: "Analizar métricas", prompt: "Analiza las métricas clave de mi tienda: conversión, AOV, tasa de abandono y top productos. Detecta los cuellos de botella del funnel." },
  { icon: "💰", label: "Analizar precios", prompt: "Analiza los precios de mis productos: compáralos con el mercado y sugiere ajustes para maximizar margen y conversión." },
];

export const PLATFORMS: Record<PlatformKey, PlatformDefinition> = {
  shopify: {
    key: "shopify", label: "Shopify", icon: "🟢", color: "#95bf47",
    entityLabel: "Tu tienda", hubLabel: "Panel de tienda",
    credentialHint: "Client ID y Client Secret de la app Shopify",
    capabilities: [...STORE_CAPS, "collections", "themes"],
    quickPrompts: STORE_PROMPTS,
    chatbotContext: "Plataforma Shopify: puedes leer/editar productos, colecciones, pedidos, inventario, temas y SEO mediante las acciones de tienda.",
  },
  woocommerce: {
    key: "woocommerce", label: "WooCommerce", icon: "🟣", color: "#96588a",
    entityLabel: "Tu tienda", hubLabel: "WooCommerce Hub",
    credentialHint: "Consumer Key (ck_) y Consumer Secret (cs_) de WooCommerce",
    capabilities: STORE_CAPS,
    quickPrompts: STORE_PROMPTS,
    chatbotContext: "Plataforma WooCommerce: productos, pedidos, inventario y SEO vía REST API. No hay temas ni colecciones gestionables.",
  },
  prestashop: {
    key: "prestashop", label: "PrestaShop", icon: "🔴", color: "#df0067",
    entityLabel: "Tu tienda", hubLabel: "PrestaShop Hub",
    credentialHint: "Clave API de PrestaShop (32 caracteres)",
    capabilities: STORE_CAPS,
    quickPrompts: STORE_PROMPTS,
    chatbotContext: "Plataforma PrestaShop: productos, pedidos, inventario y SEO vía Webservice. No hay temas gestionables.",
  },
  wordpress: {
    key: "wordpress", label: "WordPress", icon: "🔵", color: "#21759b",
    entityLabel: "Tu web", hubLabel: "Panel web",
    credentialHint: "Usuario y contraseña de aplicación de WordPress",
    capabilities: ["web_audit", "seo_write"],
    quickPrompts: [
      { icon: "🔍", label: "Auditoría web", prompt: "Audita mi web WordPress: rendimiento, SEO técnico y accesibilidad. Prioriza por impacto." },
    ],
    chatbotContext: "Plataforma WordPress: auditoría web y SEO. No hay catálogo de productos.",
  },
  universal: {
    key: "universal", label: "Auditoría Web", icon: "🌐", color: "#5b9bd5",
    entityLabel: "Tu web", hubLabel: "Panel de auditoría",
    credentialHint: "Solo la URL pública (sin credenciales)",
    capabilities: ["web_audit"],
    quickPrompts: [
      { icon: "🔍", label: "Auditoría web", prompt: "Audita mi web: rendimiento, SEO técnico, accesibilidad y seguridad. Prioriza por impacto." },
    ],
    chatbotContext: "Proyecto de auditoría web (sin credenciales): solo análisis de la URL pública.",
  },
  stripe: {
    key: "stripe", label: "Stripe", icon: "💳", color: "#635bff",
    entityLabel: "Tu cuenta Stripe", hubLabel: "Stripe Hub",
    credentialHint: "Clave secreta de Stripe (sk_test_… o sk_live_…)",
    capabilities: ["customers", "payments", "subscriptions", "invoices", "refunds", "payouts", "balance", "products", "web_audit"],
    quickPrompts: [
      { icon: "💳", label: "Resumen de la cuenta", prompt: "Dame el resumen de mi cuenta Stripe: balance disponible y pendiente, volumen de los últimos 30 días, MRR y suscripciones activas." },
      { icon: "⚡", label: "Últimos cobros", prompt: "Lista los últimos cobros de mi cuenta Stripe con importe, estado y cliente. Señala los fallidos o disputados." },
      { icon: "🔁", label: "Suscripciones", prompt: "Analiza mis suscripciones Stripe: activas, en prueba, canceladas y pagos fallidos. ¿Qué MRR estoy perdiendo?" },
      { icon: "📄", label: "Facturas pendientes", prompt: "Muéstrame las facturas Stripe abiertas o vencidas y propón un plan de cobro." },
      { icon: "📊", label: "Análisis de fees", prompt: "Analiza mis costes de procesamiento en Stripe. ¿Cuál es mi tasa efectiva y cómo puedo reducirla?" },
      { icon: "🛡", label: "Riesgo y disputas", prompt: "Revisa disputas y reembolsos de mi cuenta Stripe. ¿Estoy por debajo del umbral del 0,75%? ¿Qué reglas de Radar debería activar?" },
    ],
    chatbotContext: "Plataforma Stripe: la cuenta del cliente es una cuenta de pagos, NO una tienda. Usa las acciones stripe_* (stripe_account_overview, stripe_list_charges, stripe_list_customers, stripe_list_subscriptions, stripe_list_invoices, stripe_list_payouts, stripe_create_customer, stripe_create_invoice, stripe_refund…) pasando projectId. No hay productos de catálogo, pedidos, inventario ni temas; no propongas auditorías de producto ni acciones Shopify.",
  },
  tiendanube: {
    key: "tiendanube", label: "Tienda Nube", icon: "☁️", color: "#00a0e3",
    entityLabel: "Tu tienda", hubLabel: "Panel de tienda",
    credentialHint: "Access token de Tienda Nube",
    capabilities: [...STORE_CAPS, "collections"],
    quickPrompts: STORE_PROMPTS,
    chatbotContext: "Plataforma Tienda Nube: productos, categorías, pedidos e inventario.",
  },
};

export function getPlatform(key?: string | null): PlatformDefinition {
  return PLATFORMS[(key ?? "shopify") as PlatformKey] ?? PLATFORMS.shopify;
}

export function platformHas(key: string | null | undefined, cap: Capability): boolean {
  return getPlatform(key).capabilities.includes(cap);
}

/** Lista serializable (sin funciones) para GET /api/platforms */
export function listPlatforms(): PlatformDefinition[] {
  return Object.values(PLATFORMS);
}
