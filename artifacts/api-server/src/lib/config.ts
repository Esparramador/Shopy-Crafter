export const AI_CONFIG = {
  claude: {
    model: process.env.CLAUDE_MODEL || "claude-sonnet-4-5",
    maxTokensDefault: 4096,
    maxTokensLong: 16000,
    timeoutMs: 180_000,
  },
  gemini: {
    model: process.env.GEMINI_MODEL || "gemini-2.5-flash",
    proModel: process.env.GEMINI_PRO_MODEL || "gemini-2.5-pro",
    maxOutputTokens: 65_536,
  },
};

export const AI_MODELS = {
  claude: AI_CONFIG.claude.model,
  gemini: AI_CONFIG.gemini.model,
  geminiPro: AI_CONFIG.gemini.proModel,
};

export const REPORT_LEVELS = {
  1: { id: 1, name: "Nivel 1 — Diagnóstico", label: "Diagnóstico", description: "Análisis y recomendaciones generales", color: "#c8a84b", maxTokens: 8192 },
  2: { id: 2, name: "Nivel 2 — Guía Implementación", label: "Guía Implementación", description: "Diagnóstico + guía paso a paso detallada", color: "#60a5fa", maxTokens: 12000 },
  3: { id: 3, name: "Nivel 3 — Contenido Producido", label: "Contenido Producido", description: "Diagnóstico + guía + contenido listo para copiar/pegar", color: "#c084fc", maxTokens: 16000 },
  4: { id: 4, name: "Nivel 4 — Premium Full", label: "Premium Full", description: "Todo lo anterior + código, CSS, schemas, emails, posts, brief foto", color: "#f472b6", maxTokens: 16000 },
  5: { id: 5, name: "Nivel 5 — Enterprise", label: "Enterprise", description: "Todo + roadmap 12 meses + dashboard personalizado + sesión 1:1", color: "#fbbf24", maxTokens: 16000 },
} as const;

export type ReportLevel = keyof typeof REPORT_LEVELS;

export const LEVEL_SYSTEM_PROMPTS: Record<number, string> = {
  1: `NIVEL 1 — DIAGNÓSTICO:
Genera un informe de análisis con datos reales del cliente.
Incluye: estado actual, problemas detectados, oportunidades, recomendaciones priorizadas.
Di QUÉ mejorar y POR QUÉ, con números concretos.
NO incluyas guías de implementación ni contenido producido.
Cada dato debe indicar si es [VERIFICADO] (de la plataforma) o [INVESTIGADO] (de Google) o [ESTIMADO].
Extensión: 4-6 páginas.`,

  2: `NIVEL 2 — DIAGNÓSTICO + GUÍA DE IMPLEMENTACIÓN PASO A PASO:
Genera TODO lo de Nivel 1 MÁS una sección completa titulada "📋 GUÍA DE IMPLEMENTACIÓN":
Para CADA mejora recomendada, incluye:
- Paso 1, 2, 3... con instrucciones EXACTAS
- Ruta en el panel de administración: "Ve a [Menú] → [Submenú] → [Botón]"
- Qué texto escribir o copiar exactamente
- Screenshots textuales de cada pantalla relevante
- Test de verificación: "Sabrás que funciona cuando veas X"
- Tiempo estimado de cada paso
- Herramientas externas necesarias (con URLs reales)
- Mensajes para delegar al equipo: "Envía esto a tu diseñador/dev/marketer: ..."
La guía debe ser tan detallada que alguien SIN conocimientos técnicos pueda seguirla.
Extensión: 10-15 páginas.`,

  3: `NIVEL 3 — DIAGNÓSTICO + GUÍA + CONTENIDO PRODUCIDO:
Genera TODO lo de Nivel 2 MÁS una sección titulada "📦 CONTENIDO PRODUCIDO — LISTO PARA USAR":
Genera el contenido REAL terminado para cada mejora:
- Meta titles y descriptions ESCRITOS para cada producto mencionado
- Textos de producto REESCRITOS (800+ palabras, 8 secciones, FAQ)
- Emails de marketing COMPLETOS en HTML
- Posts para redes sociales ESCRITOS con hashtags
- Alt texts de imágenes ESCRITOS
- Tags SEO GENERADOS
TODO debe ser FINAL — el cliente copia y pega sin editar.
Extensión: 18-25 páginas.`,

  4: `NIVEL 4 — PREMIUM FULL (TODO LO ANTERIOR + CÓDIGO Y ACTIVOS):
Genera TODO lo de Nivel 3 MÁS:
- CSS personalizado completo adaptado a la marca del cliente
- Schemas JSON-LD listos para pegar (Product, FAQ, Organization, BreadcrumbList)
- Código Liquid/HTML para secciones custom (si aplica)
- Brief fotográfico profesional completo (iluminación, ángulos, props, mood)
- Calendario editorial 12 semanas con títulos, keywords y fechas
- 5 templates de email HTML (bienvenida, carrito abandonado, post-compra, newsletter, oferta)
- Plantilla de presupuesto personalizada para el cliente
Extensión: 30-40 páginas + archivos adjuntos.`,

  5: `NIVEL 5 — ENTERPRISE (PAQUETE ESTRATÉGICO COMPLETO):
Genera TODO lo de Nivel 4 MÁS:
- Roadmap estratégico 12 meses desglosado por mes con KPIs
- Proyección financiera mensual con 3 escenarios (pesimista/base/optimista)
- Análisis de riesgo y plan de contingencia
- Propuesta de equipo necesario (roles, horas estimadas, coste)
- Plan de escalabilidad (qué hacer cuando lleguen a X ventas/mes)
- Benchmarks del sector actualizados
- Plan de internacionalización (si aplica)
- Análisis legal básico (GDPR, cookies, condiciones de venta)
Extensión: 45-60 páginas — documento de consultoría completo.`,
};

export const PLATFORM_FEATURES: Record<string, {
  label: string;
  icon: string;
  color: string;
  features: string[];
  hiddenTabs: string[];
}> = {
  shopify: {
    label: "Shopify",
    icon: "🟢",
    color: "#95bf47",
    features: ["products", "product_create", "product_update", "product_delete", "variants", "images", "image_upload_url", "seo_read", "seo_write", "orders", "inventory", "themes", "graphql", "audit"],
    hiddenTabs: [],
  },
  woocommerce: {
    label: "WooCommerce",
    icon: "🟣",
    color: "#96588a",
    features: ["products", "product_create", "product_update", "product_delete", "variants", "images", "image_upload_url", "seo_read", "seo_write", "orders", "inventory", "audit"],
    hiddenTabs: ["themes"],
  },
  prestashop: {
    label: "PrestaShop",
    icon: "🔴",
    color: "#df0067",
    features: ["products", "product_create", "product_update", "product_delete", "variants", "images", "image_upload_file", "seo_read", "seo_write", "orders", "inventory", "audit"],
    hiddenTabs: ["themes"],
  },
  universal: {
    label: "Auditoría Web",
    icon: "🌐",
    color: "#5b9bd5",
    features: ["audit", "seo_read"],
    hiddenTabs: ["products", "pricing", "redesign", "images", "inventory", "emails", "ab-testing", "themes", "collections"],
  },
};
