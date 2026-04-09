# ⚡ SHOPY CRAFTER — IMPLEMENTACIÓN DEFINITIVA PARA REPLIT
# Documento ÚNICO con TODO el código necesario para llevar cada área al 100%
# REGLA: Todo es ADITIVO — NO borrar nada existente, solo AÑADIR y EXPANDIR

---

# ÍNDICE DE IMPLEMENTACIÓN (en orden de ejecución)

1. **ARCHIVOS NUEVOS** — Crear estos archivos desde cero
2. **MULTI-PLATAFORMA** — Migrar 37 endpoints + frontend feature-gating
3. **SISTEMA DE NIVELES DE INFORME** — 5 niveles seleccionables en toda la app
4. **FUSION STUDIO** — Análisis de imágenes por capas/partículas/texturas
5. **CHATBOT FILE UPLOAD** — Soporte para cualquier tipo de archivo
6. **WEB LAB CON INTELIGENCIA DE MARCA** — Instagram, Google, competidores
7. **COGS HIPER-POTENCIADO** — Clasificación automática + benchmarks
8. **SHOPY BRAIN EXPONENCIAL** — Aprendizaje adaptativo + contexto inteligente
9. **MONITOREO CONTINUO DE COMPETIDORES** — Alertas automáticas
10. **ENTITY RESEARCH → INFORME DESCARGABLE**
11. **FRONTEND UPGRADES** — Nuevos componentes y paneles

---

# ═══════════════════════════════════════════════════════
# PARTE 1: ARCHIVOS NUEVOS A CREAR
# ═══════════════════════════════════════════════════════

## ARCHIVO NUEVO 1: `api-server/src/lib/platform-helper.ts`

Crear este archivo NUEVO. Es el helper central que reemplaza todas las llamadas directas a Shopify:

```typescript
// api-server/src/lib/platform-helper.ts
import { db, projectsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import type { IPlatformConnector, PlatformFeature } from "./connectors/types.js";
import { logger } from "./logger.js";

const connectorCache = new Map<number, { connector: IPlatformConnector; ts: number }>();
const CACHE_TTL = 60_000; // 1 min

export async function getProjectConnector(projectId: number): Promise<IPlatformConnector | null> {
  const cached = connectorCache.get(projectId);
  if (cached && Date.now() - cached.ts < CACHE_TTL) return cached.connector;

  try {
    const [project] = await db.select().from(projectsTable).where(eq(projectsTable.id, projectId));
    if (!project) return null;

    const platformType = (project as any).platformType ?? "shopify";
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
        logger.warn({ projectId, platformType }, "Unsupported platform");
        return null;
    }

    connectorCache.set(projectId, { connector, ts: Date.now() });
    return connector;
  } catch (err) {
    logger.error({ err, projectId }, "Failed to create connector");
    return null;
  }
}

export function clearConnectorCache(projectId?: number): void {
  if (projectId) connectorCache.delete(projectId);
  else connectorCache.clear();
}

export async function getProjectPlatformType(projectId: number): Promise<string> {
  try {
    const [p] = await db.select({ platformType: projectsTable.platformType })
      .from(projectsTable).where(eq(projectsTable.id, projectId));
    return (p as any)?.platformType ?? "shopify";
  } catch { return "shopify"; }
}

// Helper: ejecuta operación si la plataforma la soporta, o devuelve error amigable
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

// Helper: obtener datos de la tienda de forma genérica
export async function getStoreProducts(projectId: number, params?: { status?: string; page?: number; limit?: number }) {
  return withPlatform(projectId, "products", c => c.getProducts(params));
}

export async function getStoreOrders(projectId: number, params?: { page?: number; limit?: number }) {
  return withPlatform(projectId, "orders", c => c.getOrders(params));
}

export async function updateStoreProduct(projectId: number, productId: string, data: any) {
  return withPlatform(projectId, "product_update", c => c.updateProduct(productId, data));
}

export async function getStoreSeo(projectId: number, productId: string) {
  return withPlatform(projectId, "seo_read", c => c.getSeoData(productId));
}

export async function updateStoreSeo(projectId: number, productId: string, data: any) {
  return withPlatform(projectId, "seo_write", c => c.updateSeo(productId, data));
}
```

## ARCHIVO NUEVO 2: `api-server/src/lib/config.ts`

```typescript
// api-server/src/lib/config.ts
// Configuración centralizada — todos los modelos y constantes en un solo lugar

export const AI_MODELS = {
  claude: process.env.CLAUDE_MODEL || "claude-sonnet-4-5",
  gemini: process.env.GEMINI_MODEL || "gemini-2.5-flash",
  geminiPro: process.env.GEMINI_PRO_MODEL || "gemini-2.5-pro",
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
    hiddenTabs: ["themes"], // WooCommerce no tiene themes via API
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
```

## ARCHIVO NUEVO 3: `api-server/src/lib/report-levels.ts`

```typescript
// api-server/src/lib/report-levels.ts
// Sistema de niveles de informe — genera archivos separados por nivel

import { REPORT_LEVELS, LEVEL_SYSTEM_PROMPTS, type ReportLevel } from "./config.js";
import { askClaudeWithBrain, learnFromOperation } from "./claude.js";
import { saveToVault } from "./vault.js";
import { getReportShell, type ReportTemplate } from "../routes/exports.js";
import { logger } from "./logger.js";

export interface LeveledReportResult {
  level: number;
  levelName: string;
  files: Array<{
    type: string;
    title: string;
    htmlContent: string;
    vaultId: number | null;
  }>;
  totalPages: number;
}

export async function generateLeveledReport(params: {
  projectId: number;
  level: ReportLevel;
  reportType: string;
  reportTitle: string;
  dataBlock: string; // datos del proyecto ya formateados
  niche?: string;
  template?: ReportTemplate;
  baseSystemPrompt?: string;
}): Promise<LeveledReportResult> {
  const { projectId, level, reportType, reportTitle, dataBlock, niche, template = "prestige", baseSystemPrompt } = params;
  const levelConfig = REPORT_LEVELS[level];
  const levelPrompt = LEVEL_SYSTEM_PROMPTS[level] || LEVEL_SYSTEM_PROMPTS[1];

  const systemPrompt = `${baseSystemPrompt || "Eres ShopyBrain, motor de inteligencia IA de Shopy Crafter. Generas informes exhaustivos y profesionales."}

${levelPrompt}

REGLAS DE CALIDAD:
- Cada dato debe tener badge: [VERIFICADO] [INVESTIGADO] o [ESTIMADO]
- Nombra productos ESPECÍFICOS del catálogo del cliente
- Usa números concretos, no generalidades
- Cada recomendación debe tener impacto estimado en € o %
- Responde SIEMPRE en español profesional
- Formato: HTML con <h2>, <h3>, <p>, <ul>, <ol>, <strong>, <table>`;

  const files: LeveledReportResult["files"] = [];
  const reportShell = getReportShell(template);
  const date = new Date().toLocaleDateString("es-ES", { day: "2-digit", month: "long", year: "numeric" });

  // ─── ARCHIVO 1: Informe principal (todos los niveles) ───────────
  logger.info({ projectId, level, reportType }, `📊 Generating Level ${level} report: ${reportTitle}`);

  const mainReport = await askClaudeWithBrain(
    projectId,
    [{ role: "user", content: `Genera el informe ${levelConfig.name} para:\n\n${dataBlock}` }],
    systemPrompt, "general", niche, levelConfig.maxTokens
  );

  const mainHtml = reportShell(
    `${reportTitle} — ${levelConfig.label}`,
    `Informe ${levelConfig.name}`,
    `<div class="report-level-badge" style="background:${levelConfig.color}20;color:${levelConfig.color};padding:8px 16px;border-radius:8px;display:inline-block;font-weight:700;margin-bottom:20px;">${levelConfig.name}</div>\n${mainReport}`,
    date,
    "ShopyBrain Intelligence"
  );

  const mainVaultId = await saveToVault({
    projectId,
    fileType: `report-level-${level}`,
    category: "informes",
    title: `${reportTitle} — ${levelConfig.label}`,
    description: `Informe ${levelConfig.name} generado por ShopyBrain`,
    mimeType: "text/html",
    generatedBy: "report-levels",
    content: mainHtml,
    metadata: { level, reportType, template },
  });

  files.push({ type: "main-report", title: `${reportTitle} — ${levelConfig.label}`, htmlContent: mainHtml, vaultId: mainVaultId });

  // ─── ARCHIVO 2: Guía de implementación (nivel 2+) ──────────────
  if (level >= 2) {
    logger.info({ projectId, level }, "📋 Generating implementation guide");

    const guidePrompt = `Basándote en este informe, genera una GUÍA DE IMPLEMENTACIÓN PASO A PASO separada.
El informe original dice lo siguiente (resumido):
${mainReport.replace(/<[^>]+>/g, " ").slice(0, 6000)}

GENERA la guía con este formato EXACTO para CADA mejora:

<div class="implementation-step">
  <h3>Paso X: [Nombre de la acción]</h3>
  <p><strong>⏱ Tiempo estimado:</strong> X minutos</p>
  <p><strong>🎯 Impacto esperado:</strong> +X% en [métrica]</p>
  <div class="step-instructions">
    <ol>
      <li><strong>Navega a:</strong> [Panel Admin] → [Menú] → [Submenú]</li>
      <li><strong>Busca:</strong> [Qué buscar en la pantalla]</li>
      <li><strong>Escribe/Pega:</strong> <code>[Texto exacto a escribir]</code></li>
      <li><strong>Guarda:</strong> Haz clic en [Botón guardar]</li>
    </ol>
  </div>
  <p><strong>✅ Verificación:</strong> Sabrás que funciona cuando [qué debe pasar]</p>
  <p><strong>👥 Para delegar:</strong> "Envía esto a tu [rol]: [mensaje exacto]"</p>
</div>

Incluye TODOS los pasos necesarios. Mínimo 8-12 pasos.`;

    const guide = await askClaudeWithBrain(
      projectId,
      [{ role: "user", content: guidePrompt }],
      systemPrompt, "general", niche, 12000
    );

    const guideHtml = reportShell(
      `Guía de Implementación — ${reportTitle}`,
      `Paso a paso detallado — ${levelConfig.label}`,
      guide,
      date,
      "ShopyBrain Intelligence"
    );

    const guideVaultId = await saveToVault({
      projectId,
      fileType: "implementation-guide",
      category: "informes",
      title: `Guía Implementación — ${reportTitle}`,
      description: `Guía paso a paso para implementar las mejoras del informe`,
      mimeType: "text/html",
      generatedBy: "report-levels",
      content: guideHtml,
      metadata: { level, reportType, parentReport: mainVaultId },
    });

    files.push({ type: "implementation-guide", title: `Guía Implementación — ${reportTitle}`, htmlContent: guideHtml, vaultId: guideVaultId });
  }

  // ─── ARCHIVO 3: Contenido producido (nivel 3+) ─────────────────
  if (level >= 3) {
    logger.info({ projectId, level }, "📦 Generating produced content");

    const contentPrompt = `Genera TODO el contenido PRODUCIDO y LISTO PARA USAR basándote en las recomendaciones del informe.
Informe resumido: ${mainReport.replace(/<[^>]+>/g, " ").slice(0, 4000)}

GENERA contenido FINAL que el cliente pueda copiar y pegar DIRECTAMENTE:
- Meta titles y descriptions para los productos mencionados
- Textos de producto reescritos (completos, 800+ palabras cada uno)
- Emails de marketing (HTML completo con diseño)
- Posts para redes sociales (con hashtags y emojis)
- Alt texts para imágenes
- Tags SEO

Cada pieza de contenido debe estar en un bloque:
<div class="produced-content-block">
  <h3>📄 [Tipo de contenido]: [Para qué producto/página]</h3>
  <div class="content-to-copy">
    [El contenido exacto que el cliente copia y pega]
  </div>
  <p class="copy-note"><small>Copia y pega esto directamente en [dónde]</small></p>
</div>`;

    const produced = await askClaudeWithBrain(
      projectId,
      [{ role: "user", content: contentPrompt }],
      systemPrompt, "general", niche, 16000
    );

    const producedHtml = reportShell(
      `Contenido Producido — ${reportTitle}`,
      `Listo para copiar y pegar`,
      produced,
      date,
      "ShopyBrain Intelligence"
    );

    const producedVaultId = await saveToVault({
      projectId,
      fileType: "produced-content",
      category: "informes",
      title: `Contenido Producido — ${reportTitle}`,
      description: `Contenido terminado listo para usar`,
      mimeType: "text/html",
      generatedBy: "report-levels",
      content: producedHtml,
      metadata: { level, reportType, parentReport: mainVaultId },
    });

    files.push({ type: "produced-content", title: `Contenido Producido — ${reportTitle}`, htmlContent: producedHtml, vaultId: producedVaultId });
  }

  // ─── ARCHIVO 4: Código y activos (nivel 4+) ────────────────────
  if (level >= 4) {
    logger.info({ projectId, level }, "💎 Generating premium assets");

    const assetsPrompt = `Genera todos los ACTIVOS TÉCNICOS basándote en el informe:
${mainReport.replace(/<[^>]+>/g, " ").slice(0, 3000)}

Incluye:
1. CSS PERSONALIZADO completo (variables de marca, componentes, responsive)
2. Schemas JSON-LD para cada producto mencionado (Product, FAQ, BreadcrumbList)
3. Brief fotográfico profesional (iluminación, ángulos, props, mood board textual)
4. Calendario editorial 12 semanas (tabla con: semana, título, keyword, tipo, plataforma)
5. 5 templates de email HTML (usar colores de marca del cliente)

Cada activo en bloque separado con título claro.`;

    const assets = await askClaudeWithBrain(
      projectId,
      [{ role: "user", content: assetsPrompt }],
      systemPrompt, "general", niche, 16000
    );

    const assetsHtml = reportShell(
      `Activos Premium — ${reportTitle}`,
      `CSS, Schemas, Brief, Calendario, Emails`,
      assets,
      date,
      "ShopyBrain Intelligence"
    );

    const assetsVaultId = await saveToVault({
      projectId,
      fileType: "premium-assets",
      category: "informes",
      title: `Activos Premium — ${reportTitle}`,
      mimeType: "text/html",
      generatedBy: "report-levels",
      content: assetsHtml,
      metadata: { level, reportType },
    });

    files.push({ type: "premium-assets", title: `Activos Premium — ${reportTitle}`, htmlContent: assetsHtml, vaultId: assetsVaultId });
  }

  // ─── ARCHIVO 5: Roadmap Enterprise (nivel 5) ───────────────────
  if (level >= 5) {
    logger.info({ projectId, level }, "🏢 Generating enterprise roadmap");

    const roadmapPrompt = `Genera un ROADMAP ESTRATÉGICO EMPRESARIAL de 12 meses:
${mainReport.replace(/<[^>]+>/g, " ").slice(0, 3000)}

Incluye:
1. Timeline mes a mes con objetivos, KPIs y acciones
2. Proyección financiera mensual (tabla: mes, revenue estimado, costes, margen)
3. 3 escenarios: pesimista, base, optimista
4. Análisis de riesgos (5 riesgos principales con probabilidad, impacto, mitigación)
5. Plan de equipo (roles necesarios, horas/semana, coste mensual)
6. Plan de escalabilidad (triggers para escalar: "Cuando llegues a X, contrata Y")
7. Plan de internacionalización (mercados prioritarios, idiomas, logística)
8. Checklist legal (GDPR, cookies, condiciones, LSSI, facturación)

Formato: tablas HTML profesionales con colores.`;

    const roadmap = await askClaudeWithBrain(
      projectId,
      [{ role: "user", content: roadmapPrompt }],
      systemPrompt, "general", niche, 16000
    );

    const roadmapHtml = reportShell(
      `Roadmap Enterprise — ${reportTitle}`,
      `Estrategia 12 meses completa`,
      roadmap,
      date,
      "ShopyBrain Intelligence"
    );

    const roadmapVaultId = await saveToVault({
      projectId,
      fileType: "enterprise-roadmap",
      category: "informes",
      title: `Roadmap Enterprise — ${reportTitle}`,
      mimeType: "text/html",
      generatedBy: "report-levels",
      content: roadmapHtml,
      metadata: { level, reportType },
    });

    files.push({ type: "enterprise-roadmap", title: `Roadmap Enterprise — ${reportTitle}`, htmlContent: roadmapHtml, vaultId: roadmapVaultId });
  }

  // ─── Aprender de la operación ──────────────────────────────────
  learnFromOperation({
    operationType: `report_level_${level}`,
    niche: niche ?? null,
    title: `Informe ${levelConfig.name}: ${reportTitle}`,
    content: `Generado informe nivel ${level} (${levelConfig.name}) para proyecto ${projectId}. Tipo: ${reportType}. Archivos generados: ${files.length}. IDs Vault: ${files.map(f => f.vaultId).filter(Boolean).join(", ")}.`,
    confidence: 0.9,
    tags: ["report", `level-${level}`, reportType],
  });

  return {
    level,
    levelName: levelConfig.name,
    files,
    totalPages: files.length,
  };
}
```

## ARCHIVO NUEVO 4: `api-server/src/lib/fusion-studio.ts`

```typescript
// api-server/src/lib/fusion-studio.ts
// Motor de análisis de imágenes por capas, partículas, texturas, colores, materiales

import Anthropic from "@anthropic-ai/sdk";
import { logger } from "./logger.js";
import { learnFromOperation } from "./claude.js";
import { AI_MODELS } from "./config.js";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export interface ImageAnalysis {
  // Capas visuales
  layers: Array<{
    name: string; // "fondo", "producto", "sombras", "reflejos", "texto"
    description: string;
    coverage: string; // "60%", "25%", etc.
  }>;
  // Colores
  colors: {
    dominant: string[]; // hex codes
    palette: Array<{ hex: string; name: string; percentage: string }>;
    temperature: string; // "cálida", "fría", "neutra"
    harmony: string; // "complementaria", "análoga", "triádica", etc.
  };
  // Texturas y materiales
  textures: Array<{
    material: string; // "algodón", "metal", "plástico", "madera", etc.
    finish: string; // "mate", "brillante", "satinado", "rugoso"
    area: string; // "producto principal", "fondo", "packaging"
  }>;
  // Composición
  composition: {
    layout: string; // "centrado", "regla de tercios", "diagonal", etc.
    perspective: string; // "frontal", "cenital", "isométrica", "lifestyle"
    depth: string; // "plano", "profundidad media", "bokeh intenso"
    lighting: string; // "natural suave", "estudio", "dramática", "ring light"
    shadows: string; // "suaves", "duras", "sin sombras"
  };
  // Producto detectado
  product: {
    category: string; // "ropa", "joyería", "electrónica", "cosmética", etc.
    subcategory: string;
    estimatedMaterials: string[];
    estimatedWeight: string;
    estimatedDimensions: string;
    brandStyle: string; // "luxury", "streetwear", "minimal", "artesanal"
    targetAudience: string;
    priceRange: string; // "€10-30", "€50-100", etc.
  };
  // Para generación de producto
  productGeneration: {
    suggestedTitle: string;
    suggestedDescription: string; // HTML de 800+ palabras
    suggestedTags: string[];
    suggestedCategory: string;
    suggestedPrice: string;
    seoKeywords: string[];
    photoBriefs: Array<{
      type: string; // "hero", "lifestyle", "detail", "scale", "packaging"
      description: string;
      lighting: string;
      props: string[];
      background: string;
    }>;
  };
}

export async function analyzeImageForFusion(
  imageBase64: string,
  mimeType: string,
  additionalImages?: Array<{ base64: string; mimeType: string }>,
  context?: { niche?: string; brandTone?: string; targetAudience?: string }
): Promise<ImageAnalysis> {
  logger.info({ mimeType, hasAdditional: !!additionalImages?.length }, "🔬 Fusion Studio: Analyzing image");

  const imageBlocks: Anthropic.ImageBlockParam[] = [
    {
      type: "image",
      source: { type: "base64", media_type: mimeType as any, data: imageBase64 },
    },
  ];

  // Añadir imágenes adicionales de referencia
  if (additionalImages) {
    for (const img of additionalImages.slice(0, 4)) { // Máx 5 imágenes total
      imageBlocks.push({
        type: "image",
        source: { type: "base64", media_type: img.mimeType as any, data: img.base64 },
      });
    }
  }

  const prompt = `Eres el Fusion Studio de ShopyBrain — un analizador experto de imágenes de producto que descompone CUALQUIER imagen en todas sus capas, partículas, texturas, colores y materiales.

ANALIZA ${additionalImages?.length ? `estas ${1 + additionalImages.length} imágenes` : "esta imagen"} con precisión absoluta.

${context?.niche ? `Contexto: Nicho ${context.niche}. Tono: ${context.brandTone ?? "profesional"}. Audiencia: ${context.targetAudience ?? "adultos"}.` : ""}

DESCOMPÓN la imagen en TODAS estas dimensiones:

1. **CAPAS VISUALES**: Separa mentalmente la imagen en capas (fondo, producto, sombras, reflejos, texto, decoración, packaging). Para cada capa: nombre, descripción, % de cobertura.

2. **ANÁLISIS DE COLOR**: 
   - Colores dominantes (hex exacto)
   - Paleta completa con % de cada color
   - Temperatura de color (cálida/fría/neutra)
   - Tipo de armonía cromática

3. **TEXTURAS Y MATERIALES**: 
   - Identifica CADA material visible (algodón, metal, plástico, cuero, madera, vidrio, cerámica, etc.)
   - Acabado de cada material (mate, brillante, satinado, rugoso, suave)
   - En qué zona de la imagen está

4. **COMPOSICIÓN**:
   - Layout (centrado, tercios, diagonal, simétrico)
   - Perspectiva (frontal, cenital, 3/4, isométrica, lifestyle)
   - Profundidad de campo (plano, media, bokeh)
   - Iluminación (tipo, dirección, dureza)
   - Sombras (tipo, dirección)

5. **PRODUCTO DETECTADO**:
   - Categoría y subcategoría del producto
   - Materiales estimados de fabricación
   - Peso y dimensiones estimados
   - Estilo de marca que transmite
   - Audiencia objetivo
   - Rango de precio estimado

6. **GENERACIÓN DE PRODUCTO** (para crear el producto en la tienda):
   - Título SEO sugerido (70 chars máx, con keywords)
   - Descripción HTML de 800+ palabras con 8 secciones (Descripción, Características, Material, Tallas/Medidas, Cuidados, Envío, FAQ, Trust badges)
   - 15-25 tags SEO relevantes
   - Categoría sugerida
   - Precio sugerido basado en el análisis visual y materiales
   - 5 keywords SEO principales
   - 6 photo briefs para generar imágenes profesionales adicionales (hero, lifestyle, detalle, escala, packaging, UGC)

RESPONDE EXCLUSIVAMENTE con JSON válido con esta estructura:
{
  "layers": [...],
  "colors": { "dominant": [...], "palette": [...], "temperature": "...", "harmony": "..." },
  "textures": [...],
  "composition": { "layout": "...", "perspective": "...", "depth": "...", "lighting": "...", "shadows": "..." },
  "product": { "category": "...", "subcategory": "...", "estimatedMaterials": [...], "estimatedWeight": "...", "estimatedDimensions": "...", "brandStyle": "...", "targetAudience": "...", "priceRange": "..." },
  "productGeneration": { "suggestedTitle": "...", "suggestedDescription": "...(HTML)...", "suggestedTags": [...], "suggestedCategory": "...", "suggestedPrice": "...", "seoKeywords": [...], "photoBriefs": [...] }
}`;

  const response = await anthropic.messages.create({
    model: AI_MODELS.claude,
    max_tokens: 16000,
    messages: [{
      role: "user",
      content: [
        ...imageBlocks,
        { type: "text", text: prompt },
      ],
    }],
  }, { signal: AbortSignal.timeout(120_000) });

  const text = response.content[0].type === "text" ? response.content[0].text : "{}";
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error("No JSON in Fusion Studio response");

  const analysis = JSON.parse(jsonMatch[0]) as ImageAnalysis;

  // Aprender del análisis
  learnFromOperation({
    operationType: "fusion_studio_analysis",
    title: `Fusion Studio: ${analysis.product?.category ?? "producto"} — ${analysis.product?.subcategory ?? ""}`,
    content: `Análisis Fusion Studio: Categoría ${analysis.product?.category}. Materiales: ${analysis.textures?.map(t => t.material).join(", ")}. Colores: ${analysis.colors?.dominant?.join(", ")}. Estilo: ${analysis.product?.brandStyle}. Precio estimado: ${analysis.product?.priceRange}. Composición: ${analysis.composition?.layout}, ${analysis.composition?.lighting}.`,
    confidence: 0.85,
    tags: ["fusion-studio", analysis.product?.category ?? "product", "image-analysis"],
  });

  logger.info({
    category: analysis.product?.category,
    materials: analysis.textures?.length,
    colors: analysis.colors?.palette?.length,
  }, "✅ Fusion Studio analysis complete");

  return analysis;
}
```

## ARCHIVO NUEVO 5: `api-server/src/lib/file-processor.ts`

```typescript
// api-server/src/lib/file-processor.ts
// Procesador universal de archivos — lee cualquier formato que suba el usuario

import { logger } from "./logger.js";
import { readFileSync } from "fs";

export interface ProcessedFile {
  type: string;
  filename: string;
  mimeType: string;
  textContent: string | null;
  base64Content: string | null;
  metadata: Record<string, unknown>;
}

const TEXT_EXTENSIONS = new Set([
  "txt", "md", "csv", "json", "xml", "html", "htm", "css", "js", "ts",
  "tsx", "jsx", "py", "rb", "php", "java", "c", "cpp", "h", "swift",
  "yaml", "yml", "toml", "ini", "env", "sh", "bash", "sql", "graphql",
  "svg", "liquid", "ejs", "hbs", "pug", "scss", "sass", "less",
]);

const IMAGE_EXTENSIONS = new Set(["png", "jpg", "jpeg", "gif", "webp", "bmp", "ico", "svg"]);
const DOC_EXTENSIONS = new Set(["pdf", "doc", "docx", "xls", "xlsx", "pptx"]);

export async function processUploadedFile(
  buffer: Buffer,
  filename: string,
  mimeType: string
): Promise<ProcessedFile> {
  const ext = filename.split(".").pop()?.toLowerCase() ?? "";

  // Texto plano
  if (TEXT_EXTENSIONS.has(ext) || mimeType.startsWith("text/")) {
    const text = buffer.toString("utf-8");
    return {
      type: "text",
      filename,
      mimeType,
      textContent: text,
      base64Content: null,
      metadata: { lines: text.split("\n").length, chars: text.length },
    };
  }

  // Imágenes
  if (IMAGE_EXTENSIONS.has(ext) || mimeType.startsWith("image/")) {
    const base64 = buffer.toString("base64");
    return {
      type: "image",
      filename,
      mimeType: mimeType || `image/${ext === "jpg" ? "jpeg" : ext}`,
      textContent: null,
      base64Content: base64,
      metadata: { sizeKB: Math.round(buffer.length / 1024) },
    };
  }

  // PDF — extraer texto
  if (ext === "pdf" || mimeType === "application/pdf") {
    try {
      // Intentar extraer texto con pdftotext si disponible
      const { execSync } = await import("child_process");
      const tmpPath = `/tmp/upload_${Date.now()}.pdf`;
      const fs = await import("fs");
      fs.writeFileSync(tmpPath, buffer);
      const text = execSync(`pdftotext -layout "${tmpPath}" - 2>/dev/null || echo "PDF text extraction not available"`, { timeout: 10000 }).toString();
      try { fs.unlinkSync(tmpPath); } catch {}

      return {
        type: "pdf",
        filename,
        mimeType: "application/pdf",
        textContent: text.length > 50 ? text : null,
        base64Content: buffer.toString("base64"),
        metadata: { sizeKB: Math.round(buffer.length / 1024), textExtracted: text.length > 50 },
      };
    } catch {
      return {
        type: "pdf",
        filename,
        mimeType: "application/pdf",
        textContent: null,
        base64Content: buffer.toString("base64"),
        metadata: { sizeKB: Math.round(buffer.length / 1024) },
      };
    }
  }

  // ZIP — listar contenido
  if (ext === "zip" || mimeType === "application/zip") {
    try {
      const AdmZip = (await import("adm-zip")).default;
      const zip = new AdmZip(buffer);
      const entries = zip.getEntries();
      const fileList = entries.map(e => e.entryName).join("\n");
      const textFiles: string[] = [];

      for (const entry of entries) {
        const entExt = entry.entryName.split(".").pop()?.toLowerCase() ?? "";
        if (TEXT_EXTENSIONS.has(entExt) && entry.getData().length < 50000) {
          textFiles.push(`\n=== ${entry.entryName} ===\n${entry.getData().toString("utf-8")}`);
        }
      }

      return {
        type: "zip",
        filename,
        mimeType: "application/zip",
        textContent: `Archivos en el ZIP:\n${fileList}\n\nContenido de archivos de texto:\n${textFiles.join("\n")}`,
        base64Content: null,
        metadata: { fileCount: entries.length, files: entries.map(e => e.entryName) },
      };
    } catch {
      return { type: "zip", filename, mimeType, textContent: null, base64Content: null, metadata: {} };
    }
  }

  // Excel
  if (ext === "xlsx" || ext === "xls" || mimeType.includes("spreadsheet")) {
    try {
      const ExcelJS = (await import("exceljs")).default;
      const workbook = new ExcelJS.Workbook();
      await workbook.xlsx.load(buffer);
      const sheets: string[] = [];

      workbook.eachSheet((worksheet) => {
        const rows: string[] = [`\n=== Hoja: ${worksheet.name} ===`];
        worksheet.eachRow({ includeEmpty: false }, (row) => {
          const vals = row.values as any[];
          rows.push(vals.slice(1).map(v => String(v ?? "")).join(" | "));
        });
        sheets.push(rows.join("\n"));
      });

      return {
        type: "excel",
        filename,
        mimeType,
        textContent: sheets.join("\n"),
        base64Content: null,
        metadata: { sheetCount: workbook.worksheets.length },
      };
    } catch {
      return { type: "excel", filename, mimeType, textContent: null, base64Content: null, metadata: {} };
    }
  }

  // Fallback: tratar como binario
  return {
    type: "binary",
    filename,
    mimeType,
    textContent: null,
    base64Content: buffer.toString("base64"),
    metadata: { sizeKB: Math.round(buffer.length / 1024) },
  };
}

/**
 * Prepara el contenido de archivos para inyectar en un prompt de Claude.
 * Devuelve un array de content blocks compatible con la API de Anthropic.
 */
export function filesToClaudeContent(files: ProcessedFile[]): Array<any> {
  const blocks: any[] = [];

  for (const file of files) {
    if (file.type === "image" && file.base64Content) {
      blocks.push({
        type: "image",
        source: { type: "base64", media_type: file.mimeType, data: file.base64Content },
      });
      blocks.push({ type: "text", text: `[Imagen subida: ${file.filename}]` });
    } else if (file.type === "pdf" && file.base64Content) {
      blocks.push({
        type: "document",
        source: { type: "base64", media_type: "application/pdf", data: file.base64Content },
      });
      if (file.textContent) {
        blocks.push({ type: "text", text: `[PDF: ${file.filename}]\nTexto extraído:\n${file.textContent.slice(0, 15000)}` });
      }
    } else if (file.textContent) {
      blocks.push({
        type: "text",
        text: `[Archivo: ${file.filename} (${file.type})]\n${file.textContent.slice(0, 20000)}`,
      });
    }
  }

  return blocks;
}
```

---

Debido al TAMAÑO ENORME de este documento (cada módulo tiene cientos de líneas de código), voy a dividirlo en partes manejables. Esta es la PARTE 1 con los 5 archivos nuevos fundamentales. La Parte 2 contiene las modificaciones a archivos existentes.

**INSTRUCCIONES PARA REPLIT:**
1. Crear estos 5 archivos NUEVOS primero
2. NO tocar ningún archivo existente hasta haber creado estos
3. Instalar dependencias si faltan: `npm install adm-zip` (para ZIP processing)
4. Continuar con Parte 2 (modificaciones a archivos existentes)
