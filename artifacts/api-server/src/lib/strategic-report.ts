/**
 * Informe Estratégico IA (POST /projects/:projectId/exports/generate-ai-report).
 *
 * Antes: 9 secciones de 3-5 párrafos de HTML dentro de UN JSON con max_tokens 8192
 * → la respuesta se cortaba, el JSON.parse fallaba y el texto crudo acababa en el
 * "Resumen ejecutivo". Ahora:
 *   - 3 llamadas pequeñas (por bloques de secciones) con salida JSON corta y
 *     validada con zod; el HTML se monta aquí, en el servidor.
 *   - Las secciones que dependen de datos que el proyecto no tiene (catálogo,
 *     ventas…) no se piden a la IA: se escribe "qué datos faltan", sin cifras.
 *   - El prompt se adapta al tipo de negocio (tienda con catálogo o no).
 */
import { z } from "zod";
import { sanitizeHtml } from "./html-escape.js";

export type StrategicSectionKey =
  | "executiveSummary"
  | "brandAnalysis"
  | "seoDeepAnalysis"
  | "pricingStrategy"
  | "financialAnalysis"
  | "productMixStrategy"
  | "competitivePosition"
  | "actionPlan30Days"
  | "revenueProjection";

export interface StrategicReportInput {
  project: {
    name: string;
    shopDomain: string | null;
    platformType: string | null;
    storeNiche: string | null;
    brandTone: string | null;
    targetAudience: string | null;
    storeMarkets: string | null;
    projectDescription: string | null;
  };
  catalog: {
    total: number;
    active: number;
    draft: number;
    archived: number;
    pricedCount: number;
    avgPrice: number;
    minPrice: number;
    maxPrice: number;
    medianPrice: number;
    productTypes: string[];
    /** Una línea por producto (hasta 25) con precio, estado, COGS, margen y SEO. */
    productLines: string[];
  };
  seo: {
    avgScore: number;
    grade: string;
    withMetaTitle: number;
    withMetaDesc: number;
    withSchema: number;
    withAltTexts: number;
    withCleanHandle: number;
    withLongDesc: number;
    worstLines: string[];
    bestLines: string[];
  };
  financial: {
    catalogValue: number;
    cogsTotal: number;
    cogsCount: number;
    avgMarginPct: number | null;
    revenue90d: number;
    orders90d: number;
  };
  abTests: { total: number; running: number; completed: number };
  competitors: string[];
  visualDna: string | null;
}

export interface StrategicDataProfile {
  hasCatalog: boolean;
  hasPrices: boolean;
  hasCogs: boolean;
  hasSales: boolean;
  hasCompetitors: boolean;
  businessKind: "tienda_con_catalogo" | "negocio_sin_catalogo";
}

export function profileFor(input: StrategicReportInput): StrategicDataProfile {
  const hasCatalog = input.catalog.total > 0;
  return {
    hasCatalog,
    hasPrices: input.catalog.pricedCount > 0,
    hasCogs: input.financial.cogsCount > 0,
    hasSales: input.financial.orders90d > 0,
    hasCompetitors: input.competitors.length > 0,
    businessKind: hasCatalog ? "tienda_con_catalogo" : "negocio_sin_catalogo",
  };
}

interface SectionDef {
  key: StrategicSectionKey;
  label: string;
  group: 1 | 2 | 3;
  /** Datos que faltan para poder escribir la sección con la IA ([] = se puede). */
  missing: (p: StrategicDataProfile) => string[];
  instructions: (p: StrategicDataProfile) => string;
  ordered?: boolean;
}

const NO_CATALOG = "Productos o servicios con precio sincronizados en el proyecto (ahora hay 0)";

export const STRATEGIC_SECTIONS: SectionDef[] = [
  {
    key: "executiveSummary", label: "Resumen Ejecutivo", group: 1,
    missing: () => [],
    instructions: () => "2-4 párrafos: estado general del negocio, hallazgos críticos, fortalezas y debilidades principales, citando las cifras del bloque DATOS. Si faltan datos importantes, dilo aquí de forma explícita.",
  },
  {
    key: "brandAnalysis", label: "Análisis de Marca", group: 1,
    missing: () => [],
    instructions: p => `2-3 párrafos: coherencia entre el nicho, la descripción, el tono y la audiencia declarados${p.hasCatalog ? " y el catálogo real" : ""}, y la identidad visual (Visual DNA / ADN de marca si existen). Si no hay nicho, tono ni audiencia definidos, usa "sin_datos" y enuméralos en missingData.`,
  },
  {
    key: "competitivePosition", label: "Posición Competitiva", group: 1,
    missing: () => [],
    instructions: p => p.hasCompetitors
      ? "1-3 párrafos: posicionamiento frente a los competidores registrados (solo esos, por su nombre). No inventes sus precios ni sus cifras: si no están en DATOS, dilo."
      : "No hay competidores registrados: NO nombres ninguno. Usa \"sin_datos\", explica en 1 párrafo qué habría que comparar para este tipo de negocio y lista en missingData qué registrar.",
  },
  {
    key: "seoDeepAnalysis", label: "Análisis SEO Profundo", group: 2,
    missing: p => p.hasCatalog ? [] : [
      NO_CATALOG + ": el SEO de fichas de producto no se puede auditar",
      "Para el SEO de la web (sin catálogo) usa la auditoría de Lab Web sobre la URL del negocio",
    ],
    instructions: () => "2-3 párrafos con los números exactos de SEO del bloque DATOS y, en items, 3-6 quick wins priorizados por impacto/esfuerzo (title = acción; detail = qué productos concretos del listado y qué les falta; effort).",
  },
  {
    key: "pricingStrategy", label: "Estrategia de Precios", group: 2,
    missing: p => p.hasPrices ? [] : [NO_CATALOG],
    instructions: p => `2-3 párrafos: estructura de precios (rango, mediana, coherencia por categoría) y, en items, 2-5 ajustes concretos sobre productos del listado.${p.hasSales ? "" : " No hay datos de ventas: no cuantifiques el impacto en ingresos, di que no se puede estimar todavía."}`,
  },
  {
    key: "financialAnalysis", label: "Análisis Financiero", group: 2,
    missing: p => (p.hasCatalog || p.hasSales) ? [] : [NO_CATALOG, "Histórico de pedidos e ingresos sincronizado"],
    instructions: p => p.hasCogs
      ? "2-3 párrafos: márgenes con los COGS registrados, productos del listado con margen crítico y con margen sano, y acciones para mejorar la rentabilidad."
      : "No hay COGS registrados: usa \"sin_datos\", explica en 1-2 párrafos por qué registrarlos es prioritario (sin inventar márgenes) y lista en missingData qué costes registrar.",
  },
  {
    key: "productMixStrategy", label: "Estrategia de Mix de Productos", group: 2,
    missing: p => p.hasCatalog ? [] : [NO_CATALOG],
    instructions: () => "2-3 párrafos sobre el mix (productos ancla y de entrada, AOV) y, en items, 2-5 bundles o ventas cruzadas usando SOLO productos que aparecen en el listado, con su nombre exacto. Si hay menos de 2 productos, usa \"sin_datos\".",
  },
  {
    key: "actionPlan30Days", label: "Plan de Acción 30 Días", group: 3, ordered: true,
    missing: () => [],
    instructions: p => `1 párrafo introductorio y, en items, 5-8 acciones ordenadas por impacto esperado (title = qué hacer; detail = sobre qué${p.hasCatalog ? " productos" : ""} y qué resultado se espera, sin cifras inventadas; effort). Solo acciones coherentes con los datos y con el tipo de negocio; incluye como acciones completar los datos que faltan si son prioritarios.`,
  },
  {
    key: "revenueProjection", label: "Proyección de Revenue", group: 3,
    missing: p => p.hasSales ? [] : ["Histórico de pedidos e ingresos de los últimos 90 días (ahora hay 0 pedidos): sin él cualquier proyección sería inventada"],
    instructions: () => "2-3 párrafos: escenarios pesimista/base/optimista a 30/60/90 días calculados a partir de los ingresos y pedidos de los últimos 90 días del bloque DATOS (explica el cálculo) y qué palancas mueven cada escenario.",
  },
];

export const STRATEGIC_SECTION_LABELS: Record<StrategicSectionKey, string> =
  Object.fromEntries(STRATEGIC_SECTIONS.map(s => [s.key, s.label])) as Record<StrategicSectionKey, string>;

// ─── Esquema de salida ───────────────────────────────────────────────────────

export const strategicSectionSchema = z.object({
  status: z.enum(["ok", "sin_datos"]),
  paragraphs: z.array(z.string()),
  items: z.array(z.object({
    title: z.string(),
    detail: z.string().optional().default(""),
    // El modelo a veces escribe "Medio" o "medio-alto": se normaliza en vez de fallar.
    effort: z.preprocess(v => {
      const e = typeof v === "string" ? v.toLowerCase().trim() : "";
      return e === "bajo" || e === "medio" || e === "alto" ? e : null;
    }, z.enum(["bajo", "medio", "alto"]).nullable()),
  })).optional().default([]),
  missingData: z.array(z.string()).optional().default([]),
}).refine(s => s.paragraphs.length > 0 || s.items.length > 0, { message: "La sección está vacía" });

export type StrategicSection = z.infer<typeof strategicSectionSchema>;

export function groupSchema(keys: StrategicSectionKey[]) {
  const shape = Object.fromEntries(keys.map(k => [k, strategicSectionSchema])) as Record<string, typeof strategicSectionSchema>;
  return z.object({ sections: z.object(shape) });
}

// ─── Prompts ─────────────────────────────────────────────────────────────────

export const STRATEGIC_REPORT_SYSTEM = `Eres ShopyBrain, el motor de análisis de Shopy Crafter, una agencia independiente de optimización con IA para negocios online (NO somos Shopify). Redactas secciones de un informe estratégico para el cliente, en español profesional, claro y concreto.

REGLAS DE VERACIDAD (obligatorias):
1. Usa SOLO los datos del bloque DATOS. Toda cifra que escribas debe salir de ahí o ser un cálculo directo sobre ellas (di sobre cuáles).
2. Si una estimación es imprescindible, escribe "estimación" y el dato en que se basa. NUNCA inventes ventas, márgenes, tráfico, conversiones, precios, nombres de productos ni de competidores.
3. Si una sección no tiene datos suficientes, pon "status": "sin_datos", di en 1-2 párrafos lo que sí se puede afirmar y enumera en "missingData" los datos concretos que faltan.
4. Adapta el lenguaje al TIPO DE NEGOCIO. Si no es una tienda con catálogo (p. ej. un restaurante o un negocio de servicios), no hables de catálogo, SKUs ni fichas de producto.
5. Los textos van en texto plano: sin HTML ni Markdown (solo se permite **negrita**). Párrafos de 2-4 frases.

FORMATO: responde SOLO con un JSON válido, sin texto antes ni después.`;

function fmt(n: number): string {
  return n.toFixed(2);
}

export function buildStrategicDataBlock(input: StrategicReportInput, p: StrategicDataProfile): string {
  const { project, catalog, seo, financial, abTests } = input;
  const lines: string[] = [
    "=== NEGOCIO ===",
    `Nombre: ${project.name}`,
    `Plataforma: ${project.platformType || "no indicada"}`,
    `Dominio: ${project.shopDomain || "sin dominio"}`,
    `Nicho / sector: ${project.storeNiche || "No definido"}`,
    `Descripción: ${project.projectDescription || "No definida"}`,
    `Tono de marca: ${project.brandTone || "No definido"}`,
    `Audiencia objetivo: ${project.targetAudience || "No definida"}`,
    `Mercados: ${project.storeMarkets || "No definidos"}`,
    `Visual DNA: ${input.visualDna ?? "No configurado"}`,
    "",
  ];

  if (p.hasCatalog) {
    lines.push(
      "=== CATALOGO ===",
      `Total productos: ${catalog.total} (${catalog.active} activos, ${catalog.draft} borradores, ${catalog.archived} archivados)`,
      p.hasPrices
        ? `Precio medio: ${fmt(catalog.avgPrice)}€ · Rango: ${fmt(catalog.minPrice)}€ – ${fmt(catalog.maxPrice)}€ · Mediana: ${fmt(catalog.medianPrice)}€`
        : "Precios: ningún producto tiene precio > 0",
      `Categorias: ${catalog.productTypes.join(", ") || "sin categorizar"}`,
      "",
      "=== SEO (fichas de producto) ===",
      `Score medio: ${seo.avgScore.toFixed(1)}/100 (Grade ${seo.grade})`,
      `Con meta title: ${seo.withMetaTitle}/${catalog.total} · meta description: ${seo.withMetaDesc}/${catalog.total} · Schema JSON-LD: ${seo.withSchema}/${catalog.total}`,
      `Con alt texts: ${seo.withAltTexts}/${catalog.total} · handle limpio: ${seo.withCleanHandle}/${catalog.total} · descripción +300 chars: ${seo.withLongDesc}/${catalog.total}`,
      "Peores 5 en SEO:",
      ...seo.worstLines,
      "Mejores 5 en SEO:",
      ...seo.bestLines,
      "",
    );
  } else {
    lines.push("=== CATALOGO ===", "Sin productos sincronizados (0). No hay datos de catálogo, precios ni SEO de producto.", "");
  }

  lines.push("=== FINANCIERO ===");
  if (p.hasCatalog) {
    lines.push(
      `Valor catalogo total: ${fmt(financial.catalogValue)}€`,
      `COGS registrados: ${financial.cogsCount}/${catalog.total} productos${p.hasCogs ? ` (total ${fmt(financial.cogsTotal)}€)` : ""}`,
      `Margen bruto medio: ${financial.avgMarginPct != null ? financial.avgMarginPct.toFixed(1) + "%" : "sin datos COGS"}`,
    );
  }
  lines.push(p.hasSales
    ? `Ingresos últimos 90 días: ${fmt(financial.revenue90d)}€ · Pedidos: ${financial.orders90d} · AOV: ${fmt(financial.revenue90d / financial.orders90d)}€`
    : "Ventas últimos 90 días: sin datos (0 pedidos sincronizados)");
  lines.push(
    "",
    "=== A/B TESTING ===",
    `Tests: ${abTests.total} (${abTests.running} activos, ${abTests.completed} completados)`,
    "",
    "=== COMPETIDORES REGISTRADOS ===",
    ...(p.hasCompetitors ? input.competitors : ["Ninguno"]),
  );

  if (p.hasCatalog && catalog.productLines.length > 0) {
    lines.push("", `=== DETALLE DE PRODUCTOS (${catalog.productLines.length} de ${catalog.total}) ===`, ...catalog.productLines);
  }
  return lines.join("\n");
}

function businessKindLabel(input: StrategicReportInput, p: StrategicDataProfile): string {
  if (p.businessKind === "tienda_con_catalogo") {
    return `Tienda online con catálogo (${input.project.platformType || "plataforma no indicada"}).`;
  }
  return `Negocio SIN catálogo online sincronizado (0 productos; p. ej. restaurante, negocio local o de servicios${input.project.storeNiche ? ` — sector declarado: ${input.project.storeNiche}` : ""}). No trates el negocio como una tienda online con catálogo.`;
}

export interface StrategicReportGroup {
  group: 1 | 2 | 3;
  keys: StrategicSectionKey[];
  prompt: string;
}

export interface StrategicReportPlan {
  profile: StrategicDataProfile;
  groups: StrategicReportGroup[];
  /** Secciones resueltas sin IA porque faltan los datos que necesitan. */
  missingSections: Array<{ key: StrategicSectionKey; missing: string[] }>;
}

export function planStrategicReport(input: StrategicReportInput): StrategicReportPlan {
  const profile = profileFor(input);
  const dataBlock = buildStrategicDataBlock(input, profile);
  const kind = businessKindLabel(input, profile);
  const missingSections: StrategicReportPlan["missingSections"] = [];
  const byGroup = new Map<1 | 2 | 3, SectionDef[]>();

  for (const def of STRATEGIC_SECTIONS) {
    const missing = def.missing(profile);
    if (missing.length > 0) { missingSections.push({ key: def.key, missing }); continue; }
    byGroup.set(def.group, [...(byGroup.get(def.group) ?? []), def]);
  }

  const groups: StrategicReportGroup[] = [...byGroup.entries()].map(([group, defs]) => {
    const keys = defs.map(d => d.key);
    const example = Object.fromEntries(keys.map(k => [k, {
      status: "ok", paragraphs: ["..."], items: [{ title: "...", detail: "...", effort: "bajo" }], missingData: [],
    }]));
    const prompt = `TIPO DE NEGOCIO: ${kind}

DATOS:
${dataBlock}

Genera SOLO estas secciones del informe:
${defs.map(d => `- "${d.key}" (${d.label}): ${d.instructions(profile)}`).join("\n")}

"items" solo cuando la sección pide una lista; si no, []. "effort" es "bajo", "medio" o "alto".
"missingData" vacío salvo que falten datos.

Estructura EXACTA de la respuesta:
${JSON.stringify({ sections: example })}`;
    return { group, keys, prompt };
  }).sort((a, b) => a.group - b.group);

  return { profile, groups, missingSections };
}

// ─── Montaje del HTML ────────────────────────────────────────────────────────

/** Texto plano del modelo → HTML seguro (solo se respeta **negrita**). */
function inline(text: string): string {
  return sanitizeHtml(text.trim()).replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
}

function missingList(missing: string[]): string {
  if (missing.length === 0) return "";
  return `<p><strong>Datos que faltan para completar este análisis:</strong></p>\n<ul>${missing.map(m => `<li>${inline(m)}</li>`).join("")}</ul>`;
}

export function renderStrategicSection(key: StrategicSectionKey, section: StrategicSection): string {
  const def = STRATEGIC_SECTIONS.find(s => s.key === key);
  const parts: string[] = section.paragraphs.slice(0, 6).map(p => `<p>${inline(p)}</p>`);
  const items = section.items.slice(0, 10);
  if (items.length > 0) {
    const tag = def?.ordered ? "ol" : "ul";
    parts.push(`<${tag}>${items.map(it => {
      const detail = it.detail ? ` — ${inline(it.detail)}` : "";
      const effort = it.effort ? ` <em>(esfuerzo: ${it.effort})</em>` : "";
      return `<li><strong>${inline(it.title)}</strong>${detail}${effort}</li>`;
    }).join("")}</${tag}>`);
  }
  parts.push(missingList(section.missingData));
  return parts.filter(Boolean).join("\n");
}

export function renderMissingSection(missing: string[]): string {
  return `<p>No hay datos suficientes para este apartado, así que no se incluye ninguna cifra ni recomendación que habría que inventar.</p>\n${missingList(missing)}`;
}

/**
 * Une los resultados de la IA y las secciones sin datos en el orden canónico.
 * Devuelve el mismo formato que antes (clave → HTML) para aiReportJson / preview.
 */
export function assembleStrategicReport(
  plan: StrategicReportPlan,
  generated: Partial<Record<StrategicSectionKey, StrategicSection>>,
): Record<StrategicSectionKey, string> {
  const out = {} as Record<StrategicSectionKey, string>;
  for (const def of STRATEGIC_SECTIONS) {
    const missing = plan.missingSections.find(m => m.key === def.key);
    if (missing) { out[def.key] = renderMissingSection(missing.missing); continue; }
    const section = generated[def.key];
    if (!section) throw new Error(`Falta la sección generada "${def.key}"`);
    out[def.key] = renderStrategicSection(def.key, section);
  }
  return out;
}
