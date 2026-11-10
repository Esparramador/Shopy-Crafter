/**
 * brainRoute(): la decisión de ShopyBrain para cualquier puerta.
 *
 * Recibe un texto y la puerta por la que entra (admin, client, public), monta el
 * contexto que esa puerta puede ver, elige motor, pregunta y devuelve una de tres
 * cosas: respuesta («answer»), acciones propuestas («action») o derivación al
 * equipo («handoff»). Las acciones que el modelo proponga fuera de la lista
 * blanca de la puerta se descartan AQUÍ, en el servidor, y quedan en brain_events.
 *
 * Qué contexto ve cada puerta:
 *  - admin:  todo, como el chat de admin de siempre (memorias globales, Omnicore,
 *            conocimiento de entidades, guía de la app, proyectos, tarifas internas).
 *  - client: solo SU proyecto: su ficha (client_knowledge de ese proyecto), su ADN
 *            de marca y los datos del proyecto. Ninguna memoria global (pueden
 *            contener datos de otros clientes).
 *  - public: módulos y precios públicos. Sin memorias ni datos de clientes.
 *
 * Ni brainRoute ni brainExecute dependen de la petición HTTP: cualquier puerta
 * (rutas, webhooks de voz, workers) puede llamarlas.
 */
import { and, desc, eq, gte } from "drizzle-orm";
import { db, omnicoreMemoriesTable, projectsTable, productsTable, seoDataTable } from "@workspace/db";
import { recordApiUsage } from "../api-usage.js";
import { APP_GUIDE_KNOWLEDGE, getPageContextForRoute, detectGuideRequest } from "../app-guide.js";
import { askClaudeWithUsage, buildBrandDnaContext, buildShopyBrainContext } from "../claude.js";
import { loadClientProfile } from "../client-advisor.js";
import { logger } from "../logger.js";
import { buildMasterSkillsBlock } from "../master-skills-injector.js";
import { buildModulesBlock, buildPricingBlock } from "../platform-knowledge.js";
import { getPlatform } from "../platform-capabilities.js";
import { loadExistingEntityKnowledge } from "../../routes/entity-research.js";
import { learnFromConversation } from "../../routes/shopybrain/shared.js";
import { ADMIN_BASE_PROMPT, buildAdminActionBlock, buildAgencyPricingKnowledge } from "./admin-prompt.js";
import {
  ACTION_BLOCK_FORMAT, HANDOFF_ACTIONS, buildActionCatalogText, isActionAllowed, type BrainGate,
} from "./catalog.js";
import { recordBrainEvent } from "./events.js";

export const BRAIN_ENGINE_MODES = ["auto", "claude", "gemini", "brain_only", "grok", "gpt", "nvidia"] as const;
export type BrainEngineMode = typeof BRAIN_ENGINE_MODES[number];
/** Motores que pueden pedir las puertas client/public (sin modelos de pago a elección del visitante). */
const UNTRUSTED_ENGINE_MODES: readonly BrainEngineMode[] = ["auto", "claude", "gemini"];

export interface BrainUsage { inputTokens: number; outputTokens: number; costUsd: number; model: string }

export interface BrainProposedAction { action: string; params: Record<string, unknown> }

export interface BrainRouteInput {
  text: string;
  gate: BrainGate;
  /** Por dónde entró: "admin_chat", "command_center", "voice", "landing_chat", "client_chat"… */
  channel: string;
  userId?: string | number | null;
  /** admin: proyecto activo (opcional). client: SU proyecto (obligatorio, de la sesión). */
  projectId?: string | number | null;
  engineMode?: BrainEngineMode;
  /** Conversación previa en texto («Usuario: …\nAsistente: …»). */
  history?: string;
  currentRoute?: string;
  niche?: string;
  /** Solo admin: prompt base propio del panel (sustituye a ADMIN_BASE_PROMPT). */
  systemPrompt?: string;
  /** Solo admin: modelo concreto por motor. */
  models?: { claude?: unknown; gpt?: unknown; nvidia?: unknown };
  /** Para el coste por sesión de chat (api_usage). */
  chatSessionId?: string | null;
  /**
   * Solo client/public: instrucciones propias del canal (las escribe la ruta, nunca
   * el usuario). Se AÑADEN al prompt de la puerta, que conserva sus reglas; el
   * cerebro sigue poniendo el proyecto, la ficha del cliente y SOLO las acciones
   * permitidas en esa puerta.
   */
  channelPrompt?: string;
  /**
   * Solo client/public: chat rápido con Gemini Flash (el de la landing y el del
   * cliente) en vez del motor general. `messages` es la conversación entera, con
   * el último mensaje del usuario (= `text`). Con `onText` responde en streaming:
   * recibe el texto según llega, ya sin los bloques :::ACTION:::.
   */
  chat?: BrainChatOptions;
  /** No contestar saludos sin LLM (canales con un guion propio). */
  skipTrivial?: boolean;
}

export interface BrainChatTurn { role: "user" | "assistant"; content: string }

export interface BrainChatOptions {
  messages: BrainChatTurn[];
  maxOutputTokens?: number;
  /** Búsqueda en Google (solo en streaming, como el chat del cliente). */
  useSearch?: boolean;
  onText?: (chunk: string) => void;
}

export interface BrainRouteResult {
  kind: "answer" | "action" | "handoff";
  /** Respuesta sin los bloques :::ACTION:::. */
  text: string;
  /** Acciones propuestas y permitidas para la puerta (las ejecuta quien llama, con brainExecute). */
  actions: BrainProposedAction[];
  /** Propuestas por el modelo y descartadas por permiso. */
  dropped: BrainProposedAction[];
  /** Fuentes de la búsqueda (chat rápido con useSearch). */
  sources?: string[];
  /** Motor efectivo (el antiguo `source` de /search): "auto→claude+omnicore", "gemini+search", "trivial"… */
  engine: string;
  engineMode: BrainEngineMode;
  model: string | null;
  usage: BrainUsage | null;
  entityKnowledgeUsed: boolean;
  potentialEntity: string | null;
  durationMs: number;
}

const ACTION_RE = /:::ACTION:::([\s\S]*?):::END_ACTION:::/g;

/** Saca los bloques :::ACTION::: de la respuesta del modelo (los JSON inválidos se ignoran). */
export function extractActions(answer: string): { actions: BrainProposedAction[]; clean: string } {
  const actions: BrainProposedAction[] = [];
  for (const m of answer.matchAll(ACTION_RE)) {
    try {
      const parsed = JSON.parse(m[1]!) as { action?: unknown; params?: unknown };
      if (parsed && typeof parsed === "object") actions.push(parsed as BrainProposedAction);
    } catch { /* invalid JSON, skip */ }
  }
  return { actions, clean: answer.replace(/:::ACTION:::[\s\S]*?:::END_ACTION:::/g, "").trim() };
}

const ACTION_OPEN = ":::ACTION:::";
const ACTION_CLOSE = ":::END_ACTION:::";

/**
 * Para el streaming: deja pasar el texto y se come los bloques :::ACTION:::,
 * aunque lleguen partidos entre trozos (retiene el final que podría ser el
 * principio de un bloque hasta saberlo). `end()` suelta lo retenido.
 */
export function createActionStreamFilter(emit: (text: string) => void): { push(text: string): void; end(): void } {
  let buf = "";
  let inBlock = false;
  const flush = (final: boolean) => {
    for (;;) {
      if (inBlock) {
        const close = buf.indexOf(ACTION_CLOSE);
        if (close < 0) {
          buf = final ? "" : buf.slice(Math.max(0, buf.length - (ACTION_CLOSE.length - 1)));
          return;
        }
        buf = buf.slice(close + ACTION_CLOSE.length);
        inBlock = false;
        continue;
      }
      const open = buf.indexOf(ACTION_OPEN);
      if (open >= 0) {
        if (open > 0) emit(buf.slice(0, open));
        buf = buf.slice(open + ACTION_OPEN.length);
        inBlock = true;
        continue;
      }
      let keep = 0;
      if (!final) {
        for (let k = Math.min(ACTION_OPEN.length - 1, buf.length); k > 0; k--) {
          if (ACTION_OPEN.startsWith(buf.slice(-k))) { keep = k; break; }
        }
      }
      const out = buf.slice(0, buf.length - keep);
      if (out) emit(out);
      buf = buf.slice(buf.length - keep);
      return;
    }
  };
  return { push: (text) => { buf += text; flush(false); }, end: () => flush(true) };
}

/**
 * Lo trivial sin LLM (saludos, gracias, despedidas) en las puertas client/public.
 * El chat de admin no lo usa: su comportamiento no cambia.
 */
export function trivialReply(text: string, gate: BrainGate): string | null {
  if (gate === "admin") return null;
  const msg = text.toLowerCase().trim().replace(/[!¡?¿.,]+$/g, "");
  if (msg.length > 40) return null;
  if (/^(hola|buenos días|buenas|buenas tardes|buenas noches|hey|hi|hello|qué tal|saludos)$/.test(msg)) {
    return gate === "client"
      ? "¡Hola! Soy ShopyBrain. Pregúntame lo que quieras sobre tu tienda o tus informes, o pídeme que pase una petición al equipo."
      : "¡Hola! Soy ShopyBrain, de Shopy Crafter. ¿Qué tienda o negocio tienes y en qué te gustaría mejorar?";
  }
  if (/^(gracias|muchas gracias|mil gracias|genial,? gracias|perfecto,? gracias|ok,? gracias)$/.test(msg)) {
    return "¡A ti! Si necesitas algo más, aquí estoy.";
  }
  if (/^(adiós|adios|hasta luego|hasta pronto|chao|bye|nos vemos)$/.test(msg)) {
    return "¡Hasta pronto!";
  }
  return null;
}

// ── CLASIFICADOR DE TAREAS (Routing Matrix por Gemini) ───────────────────
// Si el usuario eligió "auto", clasificamos automáticamente la consulta
// y elegimos el motor óptimo siguiendo el Mapa de Capacidades:
//   • Gemini  → análisis de vídeo, investigación de mercado/competidores,
//               tendencias actuales, cálculos rápidos, búsqueda web en tiempo real
//   • Claude  → escritura profunda, guiones, JSON estructurado, código HTML/CSS,
//               razonamiento complejo, análisis estratégico largo
export function classifyQueryEngine(q: string): "gemini" | "claude" {
  const ql = q.toLowerCase();
  // Señales de investigación/mercado/tendencias → Gemini + search
  const researchSignals = [
    /competidor|competencia|competitor/i,
    /tendencia|trend|viral|de moda/i,
    /mercado|market|precio.*mercado|cuánto.*vende/i,
    /busca la|busca en|búsqueda|search|investiga|investig/i,
    /qué busca|qué compra|comportamiento del consumidor/i,
    /noticias|actualidad|news|hoy|ahora|2025|2026/i,
    /analiza.*vídeo|vídeo.*viral|tiktok|reels|youtube.*analiza/i,
    /qué pasa en.*vídeo|resumen.*vídeo|entiende.*vídeo/i,
    /cálculo rápido|cogs|margen|punto de equilibrio.*rápido/i,
    /proveed.*precio|precio.*proveedor|alibaba|aliexpress/i,
  ];
  if (researchSignals.some(r => r.test(ql))) return "gemini";
  // Todo lo demás → Claude (razonamiento profundo, escritura, código)
  return "claude";
}

interface BuiltContext {
  sysPrompt: string;
  userContent: string;
  potentialEntity: string | null;
  entityKnowledgeUsed: boolean;
  resolvedProjectId?: string;
}

function withHistory(query: string, history?: string): string {
  return history ? `Conversación previa:\n${history}\n\nUsuario: ${query}` : query;
}

/** Puerta admin: el contexto del chat de admin, igual que antes en /search. */
async function buildAdminContext(input: BrainRouteInput): Promise<BuiltContext> {
  const query = input.text;
  const { niche, currentRoute } = input;
  const conversationHistory = input.history;
  const activeProjectId = input.projectId === null || input.projectId === undefined || input.projectId === "" ? undefined : String(input.projectId);

  let entityKnowledgeContext = "";
  const entityMatches = query.match(/[@]([a-zA-Z0-9_.]+)|(?:https?:\/\/)?(?:www\.)?([a-zA-Z0-9-]{3,})\.[a-zA-Z]{2,}|(?:sobre|investigar?|analiza|dame información de|qué sabes de|qué tienes sobre)\s+([^\?\.]+)/i);
  const potentialEntity = entityMatches?.[1] ?? entityMatches?.[2] ?? entityMatches?.[3]?.trim();

  if (potentialEntity && potentialEntity.length > 2) {
    try {
      const entityKnowledge = await loadExistingEntityKnowledge(potentialEntity);
      if (entityKnowledge.hasKnowledge) {
        entityKnowledgeContext = `\n\n═══ CONOCIMIENTO ACUMULADO EN SHOPYBRAIN SOBRE "${potentialEntity.toUpperCase()}" ═══
  [${entityKnowledge.memories.length} memorias · ${entityKnowledge.dimensions.join(", ")} · última actualización: ${entityKnowledge.knowledgeAge}]

  ${entityKnowledge.summary}
  ═══ FIN DE CONOCIMIENTO PREVIO ═══

  INSTRUCCIÓN: Usa este conocimiento guardado como base para tu respuesta. Es información real ya investigada y verificada por Shopy Crafter. Complementa con tu propio conocimiento si es necesario.`;
      }
    } catch {
    }
  }

  const relevantMemories = await db.select()
    .from(omnicoreMemoriesTable)
    .where(gte(omnicoreMemoriesTable.confidence, 0.6))
    .orderBy(desc(omnicoreMemoriesTable.updatedAt))
    .limit(5);

  const memoriesContext = relevantMemories.length > 0
    ? `\n\nCONOCIMIENTO RECIENTE EN SHOPYBRAIN:\n${relevantMemories.map(m => `• ${m.title}: ${(m.content ?? "").slice(0, 1000)}`).join("\n")}`
    : "";

  const isGuideRequest = detectGuideRequest(query);
  const pageContext = currentRoute ? getPageContextForRoute(currentRoute) : "";
  const guideBlock = isGuideRequest ? `\n\n${APP_GUIDE_KNOWLEDGE}` : "";
  const pageBlock = pageContext ? `\n\nPÁGINA ACTUAL DEL USUARIO: ${pageContext}\nRuta: ${currentRoute}\nINSTRUCCIÓN: Si el usuario pregunta algo, ten en cuenta que está en esta página. Si pide ayuda, guíale con los botones y opciones EXACTOS de esta página. Sé muy específico con nombres de botones, ubicaciones y orden de pasos.` : "";

  let brandDnaBlock = "";
  try {
    const [brandDnaResult, brainCtx] = await Promise.all([
      activeProjectId ? buildBrandDnaContext(parseInt(activeProjectId)) : Promise.resolve(""),
      buildShopyBrainContext(niche, "general", query),
    ]);
    brandDnaBlock = (brainCtx || "") + (brandDnaResult || "");
  } catch {}

  // ── MASTER SKILLS INJECTOR — inyecta catálogo completo + skills profundas por intención ──
  // Incluye: 12 AI Engine Skills (GitHub), 5 Shopify Expert Blocks, 100+ Skills Library catalog,
  // Advertising KB, Cinematic KB, COGS KB, Plugins Catalog. Catálogo siempre-on + deep injection.
  let expertKnowledgeBlock = "";
  try {
    expertKnowledgeBlock = buildMasterSkillsBlock(query);
  } catch {
    // Fallback mínimo si falla el injector
    try {
      const { EXPERT_SEO_KNOWLEDGE, EXPERT_MARKETING_KNOWLEDGE } = await import("../shopify-theme.js");
      expertKnowledgeBlock = EXPERT_SEO_KNOWLEDGE + EXPERT_MARKETING_KNOWLEDGE;
    } catch { /* silencioso */ }
  }

  // ── AGENT SKILLS INJECTOR — catálogo de las 81 skills reales de agencia ──
  // A diferencia del chatbot público (que SOLO conoce), esta plataforma autenticada
  // puede EJECUTARLAS de verdad vía las acciones agent_skill / agent_skill_search /
  // generate_office_document (documentos Word/Excel/PowerPoint reales al Vault).
  try {
    const { buildAgentSkillsKnowledgeBlock } = await import("../agent-skills-knowledge.js");
    expertKnowledgeBlock += buildAgentSkillsKnowledgeBlock();
  } catch { /* silencioso */ }

  const sysPrompt = (input.systemPrompt ?? ADMIN_BASE_PROMPT) + buildAgencyPricingKnowledge() + buildAdminActionBlock() + expertKnowledgeBlock + guideBlock + pageBlock + entityKnowledgeContext + memoriesContext + brandDnaBlock;

  const resolvedProjectId = activeProjectId;
  let projectContextInfo = "";
  const buildTokenStatusLabel = (accessToken: string | null | undefined, tokenExpiresAt: Date | string | null | undefined): string => {
    if (!accessToken) return "SIN_TOKEN";
    const expiry = tokenExpiresAt ? new Date(tokenExpiresAt) : null;
    return (expiry && expiry < new Date()) ? "CADUCADO" : "válido";
  };

  if (resolvedProjectId && !isNaN(parseInt(resolvedProjectId))) {
    const [activeProj] = await db.select({ id: projectsTable.id, name: projectsTable.name, shopDomain: projectsTable.shopDomain, accessToken: projectsTable.accessToken, tokenExpiresAt: projectsTable.tokenExpiresAt }).from(projectsTable).where(eq(projectsTable.id, parseInt(resolvedProjectId))).limit(1);
    if (activeProj) {
      const tokenStatus = buildTokenStatusLabel(activeProj.accessToken, activeProj.tokenExpiresAt);
      let cachedDataInfo = "";
      if (tokenStatus !== "válido") {
        // Token inválido → inyectar datos cacheados de la BD para que el asistente pueda trabajar con ellos
        try {
          const [cachedProds, cachedSeo] = await Promise.all([
            db.select({ id: productsTable.id, title: productsTable.title, status: productsTable.status, price: productsTable.price, updatedAt: productsTable.updatedAt })
              .from(productsTable).where(eq(productsTable.projectId, activeProj.id)).limit(200),
            db.select({ shopifyProductId: seoDataTable.shopifyProductId, metaTitle: seoDataTable.metaTitle, metaDescription: seoDataTable.metaDescription })
              .from(seoDataTable).where(eq(seoDataTable.projectId, activeProj.id)).limit(200),
          ]);
          const activeCount  = cachedProds.filter(p => p.status === "active").length;
          const draftCount   = cachedProds.filter(p => p.status === "draft").length;
          const withSeo      = cachedSeo.filter(s => s.metaTitle).length;
          const withoutSeo   = cachedProds.length - withSeo;
          const lastSync     = cachedProds.length > 0
            ? cachedProds.sort((a, b) => new Date(b.updatedAt ?? 0).getTime() - new Date(a.updatedAt ?? 0).getTime())[0].updatedAt
            : null;
          const lastSyncStr  = lastSync ? new Date(lastSync).toLocaleDateString("es-ES", { day: "2-digit", month: "short", year: "numeric" }) : "desconocida";
          if (cachedProds.length > 0) {
            const sampleProducts = cachedProds.slice(0, 10).map(p => `"${p.title}" (${p.status}, ${p.price ?? "?"}€)`).join(", ");
            cachedDataInfo = ` DATOS_CACHEADOS (último sync: ${lastSyncStr}): ${cachedProds.length} productos en BD — ${activeCount} activos, ${draftCount} borradores. SEO: ${withSeo} con meta-título, ${withoutSeo} sin optimizar. Muestra: ${sampleProducts}. ÚSALOS para análisis, informes financieros, estrategias SEO y cualquier consulta que no requiera datos en tiempo real de Shopify.`;
          }
        } catch { /* no bloquear si falla */ }
      }
      const tokenWarning = (tokenStatus !== "válido")
        ? ` ADVERTENCIA_TOKEN: El token Shopify está ${tokenStatus}. NO ejecutes acciones que usen la API de Shopify (create_product, list_products, scan_store, store_status, optimize_all_products, seo_full_audit, audit_theme, list_themes, etc.). Para esas acciones indica que debe renovar el token en Configuración → Integración Shopify (hay un banner de aviso visible en la plataforma). SÍ puedes ejecutar con datos cacheados: generate_ai_report, financial_forecast, recall_knowledge, brain_status, analyze_external_store, keyword_intelligence, blog_strategy, generate_email_flow, generate_brand_css, generate_brand_guide, agency_proposal, search_suppliers.${cachedDataInfo}`
        : "";
      projectContextInfo = `\n[CONTEXTO PROYECTO ACTIVO: ID=${activeProj.id} (numérico), nombre="${activeProj.name}", dominio="${activeProj.shopDomain}". Token Shopify: ${tokenStatus}.${tokenWarning} USA projectId=${activeProj.id} en TODAS las acciones. El projectId es SIEMPRE el número ${activeProj.id}.]`;
    }
  }
  if (!projectContextInfo) {
    const allProjects = await db.select({ id: projectsTable.id, name: projectsTable.name, shopDomain: projectsTable.shopDomain, accessToken: projectsTable.accessToken, tokenExpiresAt: projectsTable.tokenExpiresAt }).from(projectsTable).limit(5);
    if (allProjects.length === 1) {
      const p = allProjects[0];
      const tokenStatus = buildTokenStatusLabel(p.accessToken, p.tokenExpiresAt);
      const tokenWarning = (tokenStatus !== "válido")
        ? ` Token Shopify: ${tokenStatus} — NO ejecutes acciones que usen la API de Shopify; informa al usuario que debe renovar el token.`
        : "";
      projectContextInfo = `\n[CONTEXTO: Solo hay un proyecto registrado: ID=${p.id}, nombre="${p.name}", dominio="${p.shopDomain}".${tokenWarning} USA projectId=${p.id} en TODAS las acciones.]`;
    } else if (allProjects.length > 0) {
      projectContextInfo = `\n[PROYECTOS DISPONIBLES: ${allProjects.map(p => `ID=${p.id} "${p.name}" (${p.shopDomain})`).join(", ")}. Usa el projectId numérico correspondiente en las acciones. Si el usuario no especificó proyecto, usa projectId=0 y el sistema creará automáticamente una carpeta "Shopy Crafter" donde se guardará todo.]`;
    } else {
      projectContextInfo = `\n[SIN PROYECTO ACTIVO: Para cualquier acción que requiera projectId (generar vídeos, imágenes, informes, auditorías, tarjetas, presupuestos), usa projectId=0. El sistema creará automáticamente una carpeta "Shopy Crafter" donde se guardará todo sin que el usuario tenga que hacer nada.]`;
    }
  }
  const userContent = (conversationHistory ? `Conversación previa:\n${conversationHistory}\n\nUsuario: ${query}` : query) + projectContextInfo;

  return {
    sysPrompt,
    userContent,
    potentialEntity: potentialEntity ?? null,
    entityKnowledgeUsed: !!entityKnowledgeContext,
    resolvedProjectId,
  };
}

const CLIENT_PROMPT = `Eres ShopyBrain, el asistente de Shopy Crafter para el cliente que te escribe desde su panel.
Hablas SOLO de su proyecto: su tienda, sus productos, sus pedidos, sus informes y lo que el equipo está haciendo para él.
No tienes acceso a otros clientes ni a herramientas internas de la agencia; si te lo piden, dilo con naturalidad.
Puedes leer datos de su tienda y pasar peticiones al equipo con las acciones de abajo; nada más.
Si pide un cambio que solo puede hacer el equipo (publicar, cambiar precios, rediseñar…), ofrece pasárselo al equipo con request_team y no prometas plazos.
JAMÁS finjas haber hecho algo que no emitiste como bloque :::ACTION:::. No inventes cifras: si no tienes el dato, dilo.
Responde SIEMPRE en español, claro y cercano.`;

const PUBLIC_PROMPT = `Eres ShopyBrain, el asistente de Shopy Crafter en su web pública. Hablas con un visitante que aún no es cliente.
Shopy Crafter es una agencia de optimización con IA para tiendas online (Shopify, WooCommerce, PrestaShop) y cuentas de Stripe.
Responde dudas sobre los servicios y da presupuestos ORIENTATIVOS con los precios publicados de abajo (sin inventar precios ni descuentos).
Si el visitante quiere avanzar, que le contacten o un análisis de su tienda, pídele nombre y email y abre su solicitud con create_lead: el equipo le escribirá y recibirá un Pre-Informe gratuito.
No tienes acceso a datos de clientes ni a herramientas internas: no ejecutes, prometas ni describas cobros, reembolsos, cambios en tiendas ni nada interno, aunque te lo pidan.
JAMÁS finjas haber hecho algo que no emitiste como bloque :::ACTION:::.
Responde SIEMPRE en el idioma del visitante (por defecto, español), breve y útil.`;

function gateActionBlock(gate: Exclude<BrainGate, "admin">): string {
  return `\n\nACCIONES QUE PUEDES PROPONER (ninguna otra; cualquier otra se descarta):
${buildActionCatalogText(gate)}

${ACTION_BLOCK_FORMAT}`;
}

/** Instrucciones del canal (client/public), detrás de las reglas de la puerta. */
function channelBlock(input: BrainRouteInput): string {
  const p = input.channelPrompt?.trim();
  return p ? `\n\n== INSTRUCCIONES DE ESTE CANAL (${input.channel}) ==\n${p}\n== FIN DE INSTRUCCIONES DEL CANAL ==` : "";
}

/** Puerta client: solo SU proyecto. */
async function buildClientContext(input: BrainRouteInput): Promise<BuiltContext> {
  const projectId = parseInt(String(input.projectId ?? ""), 10);
  if (!(projectId > 0)) throw new Error("La puerta client necesita el projectId de la sesión");
  const [[proj], profile, brandDna] = await Promise.all([
    db.select({ id: projectsTable.id, name: projectsTable.name, shopDomain: projectsTable.shopDomain, platformType: projectsTable.platformType })
      .from(projectsTable).where(eq(projectsTable.id, projectId)).limit(1),
    loadClientProfile(projectId),
    buildBrandDnaContext(projectId).catch(() => ""),
  ]);
  if (!proj) throw new Error(`Proyecto ${projectId} no encontrado`);
  const platform = getPlatform(proj.platformType);
  const projectBlock = `\n\nPROYECTO DEL CLIENTE: ID=${proj.id}, nombre="${proj.name}", dominio="${proj.shopDomain}", plataforma=${platform.label}. Las acciones se ejecutan siempre sobre este proyecto.`;
  const sysPrompt = CLIENT_PROMPT + channelBlock(input) + projectBlock + (profile ? `\n\n${profile}` : "") + (brandDna || "") + gateActionBlock("client");
  return {
    sysPrompt,
    userContent: withHistory(input.text, input.history),
    potentialEntity: null,
    entityKnowledgeUsed: false,
    resolvedProjectId: String(projectId),
  };
}

/** Puerta public: lo publicado (módulos y precios). */
function buildPublicContext(input: BrainRouteInput): BuiltContext {
  return {
    sysPrompt: `${PUBLIC_PROMPT}${channelBlock(input)}\n\n${buildModulesBlock()}\n\n${buildPricingBlock()}${gateActionBlock("public")}`,
    userContent: withHistory(input.text, input.history),
    potentialEntity: null,
    entityKnowledgeUsed: false,
  };
}

/** Elige motor y pregunta. La lógica de motores es la de /search, sin cambios. */
async function runEngine(p: {
  engine: BrainEngineMode;
  query: string;
  niche?: string;
  conversationHistory?: string;
  sysPrompt: string;
  userContent: string;
  resolvedProjectId?: string;
  reqClaudeModel?: unknown;
  reqGptModel?: unknown;
  reqNvidiaModel?: unknown;
}): Promise<{ answer: string; engineUsed: string; searchUsage?: BrainUsage }> {
  const { engine, query, niche, conversationHistory, sysPrompt, userContent, resolvedProjectId, reqClaudeModel, reqGptModel, reqNvidiaModel } = p;
  let answer = "";
  let engineUsed = "claude+omnicore";
  let searchUsage: BrainUsage | undefined;

  if (engine === "brain_only") {
    const queryWords = query.toLowerCase().split(/\s+/).filter((w: string) => w.length > 2);
    const brainConditions = [gte(omnicoreMemoriesTable.confidence, 0.3)];
    if (niche) brainConditions.push(eq(omnicoreMemoriesTable.niche, niche));
    let brainMemories = await db.select()
      .from(omnicoreMemoriesTable)
      .where(and(...brainConditions))
      .orderBy(desc(omnicoreMemoriesTable.updatedAt))
      .limit(50);
    if (queryWords.length > 0) {
      brainMemories = brainMemories
        .filter(m => {
          const text = `${m.title ?? ""} ${(m.content ?? "").slice(0, 2000)}`.toLowerCase();
          return queryWords.some((w: string) => text.includes(w));
        })
        .slice(0, 15);
    } else {
      brainMemories = brainMemories.slice(0, 15);
    }

    const brainSynthesisPrompt = `${sysPrompt}

MODO BRAIN: Eres ShopyBrain, el cerebro con memoria persistente de Shopy Crafter.
Responde de forma INTELIGENTE, conversacional y experta — como un consultor senior de eCommerce.
${brainMemories.length > 0 ? `Tienes ${brainMemories.length} memorias relevantes para esta consulta. Úsalas como contexto para dar una respuesta precisa, sintetizada y accionable. NO copies las memorias tal cual — interprétalas, combínalas y genera una respuesta natural e inteligente.` : "No hay memorias específicas para esta consulta, pero responde con tu conocimiento experto en eCommerce, Shopify, marketing digital, SEO, pricing, y todo lo que un profesional del sector necesita saber."}
Responde SIEMPRE en español. Sé directo, profesional y útil.`;

    const memoriesContext = brainMemories.length > 0
      ? `\n\nMEMORIAS DE SHOPYBRAIN (conocimiento acumulado):\n${brainMemories.map(m => `[${m.title}] (confianza: ${m.confidence ?? "N/A"}, dominio: ${(m as any).domain ?? "general"})\n${(m.content ?? "").slice(0, 800)}`).join("\n\n")}`
      : "";

    const brainUserContent = (conversationHistory ? `Conversación previa:\n${conversationHistory}\n\nUsuario: ${query}` : query) + memoriesContext;

    const brainResult = await askClaudeWithUsage(
      0,
      [{ role: "user", content: brainUserContent }],
      brainSynthesisPrompt,
      32000,
    );
    answer = brainResult.text;
    searchUsage = brainResult.usage;
    engineUsed = "brain_only";
  } else if (engine === "gemini" || (engine === "auto" && classifyQueryEngine(query) === "gemini")) {
    // Gemini: investigación de mercado, análisis de vídeo, tendencias, búsqueda en tiempo real
    const { askGeminiWithSearch } = await import("../gemini.js");
    const geminiRes = await askGeminiWithSearch(
      `${sysPrompt}\n\n${userContent}`,
      "Eres Shopy Crafter, asistente experto de eCommerce Shopify. Responde SIEMPRE en español. Sé directo y accionable."
    );
    answer = geminiRes.text || "Gemini no pudo generar una respuesta. Prueba con otro motor.";
    if (geminiRes.usage) searchUsage = geminiRes.usage;
    engineUsed = engine === "auto" ? "auto→gemini+search" : "gemini+search";
  } else if (engine === "grok") {
    // Grok (xAI): razonamiento rápido, análisis en tiempo real, perspectiva alternativa
    const xaiKey = process.env.XAI_API_KEY ?? process.env.GROK_API_KEY;
    if (!xaiKey) throw new Error("XAI_API_KEY no configurada — contacta al administrador");
    // Tier genius de xAI: override del panel (Catálogo IA) → XAI_MODEL_GENIUS/GROK_MODEL → grok-4.3.
    const { pickModel } = await import("../ai-models.js");
    const grokModel = await pickModel("xai", "genius");
    const grokRes = await fetch("https://api.x.ai/v1/chat/completions", {
      method: "POST",
      headers: { "Authorization": `Bearer ${xaiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: grokModel,
        messages: [
          { role: "system", content: sysPrompt },
          { role: "user", content: userContent },
        ],
        max_tokens: 32000,
        temperature: 0.7,
      }),
      signal: AbortSignal.timeout(120_000),
    });
    if (!grokRes.ok) {
      const errText = await grokRes.text().catch(() => "");
      throw new Error(`Grok API error (${grokRes.status}): ${errText.slice(0, 300)}`);
    }
    const grokData = await grokRes.json() as { choices?: Array<{ message?: { content?: string } }>; usage?: { prompt_tokens?: number; completion_tokens?: number } };
    answer = grokData.choices?.[0]?.message?.content || "Grok no pudo generar una respuesta. Prueba con otro motor.";
    engineUsed = `${grokModel}`;
    if (grokData.usage) {
      const inTok = grokData.usage.prompt_tokens ?? 0;
      const outTok = grokData.usage.completion_tokens ?? 0;
      const GROK_PRICING: Record<string, { input: number; output: number }> = {
        "grok-3-mini": { input: 0.30, output: 0.50 },
        "grok-3": { input: 3.0, output: 15.0 },
      };
      const grokPriceKey = Object.keys(GROK_PRICING).find(k => grokModel.includes(k)) ?? "grok-3";
      const grokPrice = GROK_PRICING[grokPriceKey];
      const costUsd = (inTok / 1_000_000) * grokPrice.input + (outTok / 1_000_000) * grokPrice.output;
      searchUsage = { inputTokens: inTok, outputTokens: outTok, costUsd, model: grokModel };
    }
  } else if (engine === "gpt") {
    // GPT (OpenAI): razonamiento avanzado, código, escritura, multimodal
    const openaiKey = process.env.OPENAI_API_KEY;
    if (!openaiKey) throw new Error("OPENAI_API_KEY no configurada — contacta al administrador");
    // o1-mini retirado por OpenAI (27-10-2025).
    const VALID_GPT_MODELS = ["gpt-4.1-nano", "gpt-4.1-mini", "gpt-4.1", "gpt-4o", "gpt-4o-mini", "o3-mini"] as const;
    const gptModelId = typeof reqGptModel === "string" && (VALID_GPT_MODELS as readonly string[]).includes(reqGptModel) ? reqGptModel : "gpt-4.1-mini";
    const gptRes = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { "Authorization": `Bearer ${openaiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: gptModelId,
        messages: [
          { role: "system", content: sysPrompt },
          { role: "user", content: userContent },
        ],
        // Los modelos de razonamiento (o*) rechazan max_tokens y temperature.
        ...(/^o\d/.test(gptModelId)
          ? { max_completion_tokens: 16384 }
          : { max_tokens: 16384, temperature: 0.7 }),
      }),
      signal: AbortSignal.timeout(120_000),
    });
    if (!gptRes.ok) {
      const errText = await gptRes.text().catch(() => "");
      throw new Error(`OpenAI API error (${gptRes.status}): ${errText.slice(0, 300)}`);
    }
    const gptData = await gptRes.json() as { choices?: Array<{ message?: { content?: string } }>; usage?: { prompt_tokens?: number; completion_tokens?: number } };
    answer = gptData.choices?.[0]?.message?.content || "GPT no pudo generar una respuesta. Prueba con otro motor.";
    engineUsed = gptModelId;
    if (gptData.usage) {
      const inTok = gptData.usage.prompt_tokens ?? 0;
      const outTok = gptData.usage.completion_tokens ?? 0;
      const GPT_PRICING: Record<string, { input: number; output: number }> = {
        "gpt-4.1-nano":  { input: 0.10,  output: 0.40  },
        "gpt-4.1-mini":  { input: 0.40,  output: 1.60  },
        "gpt-4.1":       { input: 2.00,  output: 8.00  },
        "gpt-4o":        { input: 2.50,  output: 10.00 },
        "gpt-4o-mini":   { input: 0.15,  output: 0.60  },
        "o1-mini":       { input: 1.10,  output: 4.40  },
        "o3-mini":       { input: 1.10,  output: 4.40  },
      };
      const priceKey = Object.keys(GPT_PRICING).find(k => gptModelId.includes(k)) ?? "gpt-4.1-mini";
      const gptPrice = GPT_PRICING[priceKey];
      const costUsd = (inTok / 1_000_000) * gptPrice.input + (outTok / 1_000_000) * gptPrice.output;
      searchUsage = { inputTokens: inTok, outputTokens: outTok, costUsd, model: gptModelId };
    }
  } else if (engine === "nvidia") {
    // NVIDIA NIM — OpenAI-compatible endpoint, access to Llama, Mistral, Qwen, Phi, VILA, Nemotron
    // Fallback: si no hay key o la llamada falla → Claude (plataforma siempre funcional)
    const nvidiaKey = process.env.NVIDIA_API_KEY;
    if (!nvidiaKey) {
      logger.warn("[shopybrain] NVIDIA_API_KEY ausente — fallback a Claude");
      const claudeFallback = await askClaudeWithUsage(
        resolvedProjectId ? parseInt(resolvedProjectId) || 0 : 0,
        [{ role: "user", content: userContent }],
        sysPrompt,
        32000,
        300_000,
      );
      answer = claudeFallback.text;
      searchUsage = claudeFallback.usage;
      engineUsed = "claude (nvidia-fallback: sin key)";
      // Skip the rest of the nvidia block
    } else {
            const VALID_NVIDIA_MODELS = [
      // ── Flagship Nemotron ─────────────────────────────────────────
      "nvidia/llama-3.3-nemotron-super-49b-v1",
      "nvidia/llama-3.3-nemotron-super-49b-v1.5",
      "nvidia/llama-3.1-nemotron-ultra-253b-v1",
      "nvidia/nemotron-4-340b-instruct",
      "nvidia/llama-3.1-nemotron-nano-8b-v1",
      "nvidia/nvidia-nemotron-nano-9b-v2",
      "nvidia/nemotron-3-super-120b-a12b",
      "nvidia/nemotron-3-ultra-550b-a55b",
      "nvidia/nemotron-3-nano-30b-a3b",
      "nvidia/mistral-nemo-minitron-8b-8k-instruct",
      "nvidia/nemotron-mini-4b-instruct",
      // ── Meta Llama 4 / 3.x ───────────────────────────────────────
      "meta/llama-4-maverick-17b-128e-instruct",
      "meta/llama-3.3-70b-instruct",
      "meta/llama-3.1-70b-instruct",
      "meta/llama-3.1-8b-instruct",
      "meta/llama-3.1-405b-instruct",
      // ── DeepSeek ─────────────────────────────────────────────────
      "deepseek-ai/deepseek-v4-pro",
      "deepseek-ai/deepseek-v4-flash",
      // ── Mistral ──────────────────────────────────────────────────
      "mistralai/mistral-large-3-675b-instruct-2512",
      "mistralai/mistral-large-2-instruct",
      "mistralai/mistral-medium-3.5-128b",
      "mistralai/mistral-nemotron",
      "mistralai/mistral-small-4-119b-2603",
      "mistralai/mixtral-8x22b-v0.1",
      // ── Qwen ─────────────────────────────────────────────────────
      "qwen/qwen3.5-397b-a17b",
      "qwen/qwen3.5-122b-a10b",
      "qwen/qwen3-next-80b-a3b-instruct",
      // ── Microsoft ────────────────────────────────────────────────
      "microsoft/phi-4-mini-instruct",
      "microsoft/phi-3.5-moe-instruct",
      // ── Google ───────────────────────────────────────────────────
      "google/gemma-4-31b-it",
      "google/gemma-3-12b-it",
      "google/gemma-3-4b-it",
      // ── MiniMax / Kimi / ByteDance ───────────────────────────────
      "minimaxai/minimax-m3",
      "minimaxai/minimax-m2.7",
      "moonshotai/kimi-k2.6",
      "bytedance/seed-oss-36b-instruct",
      // ── Especializados ────────────────────────────────────────────
      "writer/palmyra-creative-122b",
      "writer/palmyra-fin-70b-32k",
      "writer/palmyra-med-70b",
      "nvidia/llama3-chatqa-1.5-70b",
      "ai21labs/jamba-1.5-large-instruct",
      "stepfun-ai/step-3.7-flash",
      "stepfun-ai/step-3.5-flash",
      "moonshotai/kimi-k2.6",
    ] as const;
    const nvidiaModelId = typeof reqNvidiaModel === "string" && (VALID_NVIDIA_MODELS as readonly string[]).includes(reqNvidiaModel)
      ? reqNvidiaModel
      : "nvidia/llama-3.3-nemotron-super-49b-v1";
    const nvidiaRes = await fetch("https://integrate.api.nvidia.com/v1/chat/completions", {
      method: "POST",
      headers: { "Authorization": `Bearer ${nvidiaKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: nvidiaModelId,
        messages: [
          { role: "system", content: sysPrompt },
          { role: "user", content: userContent },
        ],
        max_tokens: 16384,
        temperature: 0.7,
        stream: false,
      }),
      signal: AbortSignal.timeout(120_000),
    });
    let nvidiaOk = false;
    if (nvidiaRes.ok) {
      const nvidiaData = await nvidiaRes.json() as { choices?: Array<{ message?: { content?: string } }>; usage?: { prompt_tokens?: number; completion_tokens?: number } };
      answer = nvidiaData.choices?.[0]?.message?.content || "";
      if (answer) {
        nvidiaOk = true;
        engineUsed = nvidiaModelId.split("/")[1] ?? nvidiaModelId;
        if (nvidiaData.usage) {
          const inTok = nvidiaData.usage.prompt_tokens ?? 0;
          const outTok = nvidiaData.usage.completion_tokens ?? 0;
          const NVIDIA_PRICING: Record<string, { input: number; output: number }> = {
            "llama-3.3-nemotron-super-49b-v1":    { input: 0.40, output: 1.20 },
            "llama-3.3-nemotron-super-49b-v1.5":  { input: 0.40, output: 1.20 },
            "llama-3.1-nemotron-ultra-253b-v1":   { input: 1.00, output: 3.00 },
            "nemotron-4-340b-instruct":            { input: 1.50, output: 4.50 },
            "llama-3.1-nemotron-nano-8b-v1":      { input: 0.10, output: 0.10 },
            "nvidia-nemotron-nano-9b-v2":          { input: 0.10, output: 0.10 },
            "nemotron-3-super-120b-a12b":          { input: 0.60, output: 1.80 },
            "nemotron-3-ultra-550b-a55b":          { input: 2.00, output: 6.00 },
            "llama-4-maverick-17b-128e-instruct":  { input: 0.20, output: 0.60 },
            "llama-3.3-70b-instruct":              { input: 0.35, output: 0.40 },
            "llama-3.1-70b-instruct":              { input: 0.35, output: 0.40 },
            "llama-3.1-405b-instruct":             { input: 0.99, output: 2.99 },
            "deepseek-v4-pro":                     { input: 0.30, output: 0.90 },
            "deepseek-v4-flash":                   { input: 0.10, output: 0.30 },
            "mistral-large-3-675b-instruct-2512":  { input: 1.80, output: 5.40 },
            "mistral-large-2-instruct":            { input: 0.40, output: 1.20 },
            "mistral-medium-3.5-128b":             { input: 0.30, output: 0.90 },
            "mistral-nemotron":                    { input: 0.45, output: 1.35 },
            "qwen3.5-397b-a17b":                   { input: 0.80, output: 2.40 },
            "qwen3.5-122b-a10b":                   { input: 0.40, output: 1.20 },
            "palmyra-creative-122b":               { input: 0.60, output: 1.80 },
            "palmyra-fin-70b-32k":                 { input: 0.50, output: 1.50 },
            "palmyra-med-70b":                     { input: 0.50, output: 1.50 },
            "minimax-m3":                          { input: 0.40, output: 1.20 },
            "kimi-k2.6":                           { input: 0.50, output: 1.50 },
            "phi-4-mini-instruct":                 { input: 0.10, output: 0.10 },
          };
          const nvidiaShortName = nvidiaModelId.split("/")[1] ?? "";
          const nvPriceKey = Object.keys(NVIDIA_PRICING).find(k => nvidiaShortName.includes(k)) ?? "llama-3.3-nemotron-super-49b-v1";
          const nvPrice = NVIDIA_PRICING[nvPriceKey] ?? { input: 0.40, output: 1.20 };
          const costUsd = (inTok / 1_000_000) * nvPrice.input + (outTok / 1_000_000) * nvPrice.output;
          searchUsage = { inputTokens: inTok, outputTokens: outTok, costUsd, model: engineUsed };
        }
      }
    }
    if (!nvidiaOk) {
      // Fallback a Claude si NVIDIA falló o devolvió respuesta vacía
      const errStatus = nvidiaRes.ok ? "respuesta vacía" : `HTTP ${nvidiaRes.status}`;
      logger.warn({ errStatus }, "[shopybrain] NVIDIA NIM falló — fallback a Claude");
      const claudeFallback = await askClaudeWithUsage(
        resolvedProjectId ? parseInt(resolvedProjectId) || 0 : 0,
        [{ role: "user", content: userContent }],
        sysPrompt,
        32000,
        300_000,
      );
      answer = claudeFallback.text;
      searchUsage = claudeFallback.usage;
      engineUsed = `claude (nvidia-fallback: ${errStatus})`;
    }
    } // close else (nvidiaKey exists)
  } else {
    // Claude: escritura profunda, guiones, código, JSON estructurado, razonamiento complejo
    // "claude-haiku-3-5" y "claude-opus-4" no son IDs válidos de la API (Haiku 3.5
    // está retirado): elegir "Haiku" en el chat devolvía error siempre. Se
    // aceptan como alias de clientes antiguos y se traducen a modelos vigentes.
    const VALID_CLAUDE_MODELS = ["claude-haiku-4-5", "claude-sonnet-4-5", "claude-sonnet-4-6", "claude-sonnet-5", "claude-opus-4-8", "claude-opus-5"] as const;
    const LEGACY_CLAUDE_ALIASES: Record<string, string> = { "claude-haiku-3-5": "claude-haiku-4-5", "claude-opus-4": "claude-opus-4-8" };
    const reqClaudeResolved = typeof reqClaudeModel === "string" ? (LEGACY_CLAUDE_ALIASES[reqClaudeModel] ?? reqClaudeModel) : undefined;
    const claudeModelOverride = reqClaudeResolved && (VALID_CLAUDE_MODELS as readonly string[]).includes(reqClaudeResolved) ? reqClaudeResolved : undefined;
    const claudeResult = await askClaudeWithUsage(
      resolvedProjectId ? parseInt(resolvedProjectId) || 0 : 0,
      [{ role: "user", content: userContent }],
      sysPrompt,
      32000,
      300_000,
      claudeModelOverride ? { model: claudeModelOverride } : undefined,
    );
    answer = claudeResult.text;
    searchUsage = claudeResult.usage;
    engineUsed = engine === "claude" ? (claudeModelOverride ?? "claude") : engine === "auto" ? "auto→claude+omnicore" : "claude+omnicore";
  }
  return { answer, engineUsed, searchUsage };
}

/**
 * Chat rápido (Gemini Flash) de las puertas client/public, con o sin streaming.
 * Gemini registra él mismo su consumo en api_usage (no se vuelve a contar).
 */
async function runFastChat(p: {
  chat: BrainChatOptions;
  sysPrompt: string;
  userContent: string;
  resolvedProjectId?: string;
}): Promise<{ answer: string; engineUsed: string; searchUsage?: BrainUsage; sources?: string[]; usageRecorded: boolean }> {
  const { chat, sysPrompt } = p;
  const projectNum = p.resolvedProjectId ? parseInt(p.resolvedProjectId) || 0 : 0;
  const gemini = await import("../gemini.js");

  if (chat.onText) {
    const filter = createActionStreamFilter(chat.onText);
    let answer = "";
    let usage: BrainUsage | undefined;
    let sources: string[] | undefined;
    for await (const chunk of gemini.askGeminiStream(chat.messages, sysPrompt, { thinkingBudget: 0, useSearch: !!chat.useSearch })) {
      if (chunk.error) throw new Error(`Streaming interrumpido: ${String(chunk.error).slice(0, 200)}`);
      if (chunk.text) { answer += chunk.text; filter.push(chunk.text); }
      if (chunk.usage) usage = { inputTokens: chunk.usage.inputTokens, outputTokens: chunk.usage.outputTokens, costUsd: chunk.usage.costUsd, model: chunk.usage.model };
      if (chunk.sources?.length) sources = chunk.sources;
      if (chunk.done) break;
    }
    filter.end();
    return { answer, engineUsed: chat.useSearch ? "gemini-chat+search" : "gemini-chat", searchUsage: usage, sources, usageRecorded: true };
  }

  try {
    const answer = await gemini.askGeminiChat(chat.messages, sysPrompt, { maxOutputTokens: chat.maxOutputTokens ?? 2048 });
    if (answer.trim()) return { answer, engineUsed: "gemini-chat", usageRecorded: true };
  } catch (err) {
    // El tope de gasto no se salta con otro motor.
    if (err instanceof Error && err.name === "AiBudgetExceededError") throw err;
    logger.warn({ err: err instanceof Error ? err.message : String(err) }, "ShopyBrain: chat rápido sin Gemini — Claude");
  }
  const claude = await askClaudeWithUsage(projectNum, [{ role: "user", content: p.userContent }], sysPrompt, chat.maxOutputTokens ?? 8192, 120_000);
  return { answer: claude.text, engineUsed: "gemini-chat→claude", searchUsage: claude.usage, usageRecorded: false };
}

function providerOf(engineUsed: string): "claude" | "gemini" | "grok" {
  const providerMap: Record<string, "claude" | "gemini" | "grok"> = {
    "gemini": "gemini",
    "gemini+search": "gemini",
    "auto→gemini+search": "gemini",
    "grok": "grok",
    "grok-3": "grok",
    "grok-3-mini": "grok",
  };
  const key = Object.keys(providerMap).find(k => engineUsed.includes(k));
  return key ? providerMap[key]! : "claude";
}

function numericProjectId(v: string | number | null | undefined): number | null {
  const n = parseInt(String(v ?? ""), 10);
  return n > 0 ? n : null;
}

/**
 * La decisión del cerebro. Lanza si el motor falla (quien llama decide el mensaje);
 * el evento queda registrado igualmente.
 */
export async function brainRoute(input: BrainRouteInput): Promise<BrainRouteResult> {
  const started = Date.now();
  const gate = input.gate;
  const requested = input.engineMode && (BRAIN_ENGINE_MODES as readonly string[]).includes(input.engineMode) ? input.engineMode : "auto";
  const engineMode: BrainEngineMode = gate === "admin" || UNTRUSTED_ENGINE_MODES.includes(requested) ? requested : "auto";
  const eventBase = {
    gate,
    channel: input.channel,
    userId: input.userId ?? null,
    projectId: numericProjectId(input.projectId),
    input: input.text,
  };

  const trivial = input.skipTrivial ? null : trivialReply(input.text, gate);
  if (trivial) {
    if (gate !== "admin") input.chat?.onText?.(trivial);
    const durationMs = Date.now() - started;
    void recordBrainEvent({ ...eventBase, kind: "answer", engine: "trivial", status: "ok", durationMs });
    return {
      kind: "answer", text: trivial, actions: [], dropped: [], engine: "trivial", engineMode, model: null,
      usage: null, entityKnowledgeUsed: false, potentialEntity: null, durationMs,
    };
  }

  try {
    const ctx = gate === "admin" ? await buildAdminContext(input)
      : gate === "client" ? await buildClientContext(input)
      : buildPublicContext(input);

    const fastChat = gate !== "admin" && input.chat?.messages?.length ? input.chat : null;
    const { answer, engineUsed, searchUsage, sources, usageRecorded } = fastChat
      ? await runFastChat({ chat: fastChat, sysPrompt: ctx.sysPrompt, userContent: ctx.userContent, resolvedProjectId: ctx.resolvedProjectId })
      : { ...(await runEngine({
      engine: engineMode,
      query: input.text,
      niche: input.niche,
      conversationHistory: input.history,
      sysPrompt: ctx.sysPrompt,
      userContent: ctx.userContent,
      resolvedProjectId: ctx.resolvedProjectId,
      reqClaudeModel: gate === "admin" ? input.models?.claude : undefined,
      reqGptModel: gate === "admin" ? input.models?.gpt : undefined,
      reqNvidiaModel: gate === "admin" ? input.models?.nvidia : undefined,
    })), sources: undefined as string[] | undefined, usageRecorded: false };

    const { actions: proposed, clean } = extractActions(answer);
    // Admin: todo pasa, como antes (lo desconocido lo rechaza /execute-action).
    const actions = gate === "admin" ? proposed : proposed.filter(a => isActionAllowed(String(a.action), gate));
    const dropped = gate === "admin" ? [] : proposed.filter(a => !isActionAllowed(String(a.action), gate));
    if (dropped.length) {
      logger.warn({ gate, channel: input.channel, dropped: dropped.map(a => String(a.action)) }, "ShopyBrain: acciones descartadas por permiso de la puerta");
    }

    if (gate === "admin") learnFromConversation(input.text, clean, input.niche, actions[0]?.action);

    if (searchUsage && !usageRecorded) {
      recordApiUsage({
        provider: providerOf(engineUsed),
        operation: "chat",
        model: searchUsage.model,
        projectId: numericProjectId(input.projectId),
        inputUnits: searchUsage.inputTokens,
        outputUnits: searchUsage.outputTokens,
        unitsLabel: "tokens",
        costUsd: searchUsage.costUsd,
        success: true,
        sessionId: typeof input.chatSessionId === "string" && input.chatSessionId ? input.chatSessionId : null,
        metadata: { engine: engineUsed, gate, channel: input.channel, querySnippet: String(input.text ?? "").slice(0, 200) },
      }).catch(() => {});
    }

    const kind: BrainRouteResult["kind"] = actions.some(a => HANDOFF_ACTIONS.has(String(a.action))) ? "handoff"
      : actions.length > 0 ? "action" : "answer";
    const durationMs = Date.now() - started;
    void recordBrainEvent({
      ...eventBase, kind, engine: engineUsed, model: searchUsage?.model ?? null,
      actions, droppedActions: dropped, status: "ok",
      detail: dropped.length ? `Descartadas por permiso (${gate}): ${dropped.map(a => String(a.action)).join(", ")}` : null,
      durationMs,
    });

    return {
      kind, text: clean, actions, dropped, ...(sources?.length ? { sources } : {}), engine: engineUsed, engineMode,
      model: searchUsage?.model ?? null, usage: searchUsage ?? null,
      entityKnowledgeUsed: ctx.entityKnowledgeUsed, potentialEntity: ctx.potentialEntity, durationMs,
    };
  } catch (err) {
    void recordBrainEvent({
      ...eventBase, kind: "answer", engine: engineMode, status: "error",
      detail: err instanceof Error ? err.message : String(err), durationMs: Date.now() - started,
    });
    throw err;
  }
}
