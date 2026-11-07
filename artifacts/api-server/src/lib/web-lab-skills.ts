// ══════════════════════════════════════════════════════════════════════════
// WEB LAB · SKILLS EJECUTABLES
//
// Catálogo único de las skills que el Web Lab deja SELECCIONAR y EJECUTAR de
// verdad: las de agencia (`.agents/skills`, leídas de disco) y las del
// catálogo de ciberseguridad (`data/cybersec-skills`, leídas de disco).
//
// "Ejecutar" aquí es lo mismo que hace ShopyBrain con agent_skill /
// security_skill, pero sin chat de por medio: se carga el SKILL.md REAL, se le
// da al motor de la plataforma (Claude por lib/claude.ts, Gemini con búsqueda
// por lib/gemini.ts) junto con lo que pide la skill (URL leída en pasivo,
// texto, imagen) y se devuelve el resultado utilizable: texto, una página HTML
// o un archivo de Office real (lib/office-document-generator.ts).
//
// Las skills que dependen de algo que la plataforma no tiene (un archivo de
// entrada que el Web Lab no recibe, un servicio externo sin clave, acceso a la
// máquina atacada…) se listan igual, marcadas como no ejecutables y con el
// motivo exacto. Nada se oculta.
// ══════════════════════════════════════════════════════════════════════════

import { getAgentSkillsCatalog, getAgentSkillContent } from "./agent-skills-knowledge.js";
import { getCybersecCatalog, getSkillContent as getCybersecSkillContent } from "./cybersec-knowledge.js";
import { askClaudeDetailed, askClaudeJson, askClaudeWithVision } from "./claude.js";
import { askGeminiWithSearch, isGeminiAvailable } from "./gemini.js";
import { generateOfficeDocument, type OfficeDocRequest } from "./office-document-generator.js";
import { safeFetch } from "./web-scraper.js";

export type SkillSource = "agency" | "cybersec";
export type SkillOutputKind = "markdown" | "html" | "document";
export type SkillEngine = "claude" | "claude-vision" | "gemini-search";
export type OfficeFormat = "docx" | "xlsx" | "pptx";

export interface SkillInputSpec {
  key: "text" | "url" | "imageUrl" | "format";
  label: string;
  kind: "textarea" | "url" | "select";
  required: boolean;
  placeholder?: string;
  options?: Array<{ value: string; label: string }>;
  defaultValue?: string;
}

export interface WebLabSkill {
  /** id único en el Web Lab: `agency:<id>` o `cybersec:<id>` */
  id: string;
  source: SkillSource;
  skillId: string;
  name: string;
  description: string;
  category: string;
  executable: boolean;
  /** Motivo exacto cuando no es ejecutable. */
  reason?: string;
  engine: SkillEngine;
  output: SkillOutputKind;
  inputs: SkillInputSpec[];
  /** Límite honesto de lo que hace la ejecución (p. ej. "análisis pasivo"). */
  note?: string;
}

export interface SkillRunInputs {
  text?: string;
  url?: string;
  imageUrl?: string;
  format?: string;
}

export interface SkillRunResult {
  skill: { id: string; name: string; source: SkillSource };
  output:
    | { kind: "markdown"; text: string }
    | { kind: "html"; html: string; text?: string }
    | { kind: "document"; file: { name: string; mimeType: string; base64: string; sizeBytes: number; vaultId: number | null }; outline: OfficeDocRequest };
  engine: { provider: "claude" | "gemini"; model: string; fallbackNote?: string };
  usage?: { inputTokens: number; outputTokens: number; costUsd: number };
  truncated: boolean;
  durationMs: number;
  fetched?: { url: string; status: number; bytes: number; contentType: string };
  sources?: string[];
}

/** Error con código HTTP y mensaje legible para el usuario. */
export class SkillRunError extends Error {
  constructor(public status: number, message: string, public code: string) {
    super(message);
    this.name = "SkillRunError";
  }
}

// ── Reglas de ejecutabilidad ─────────────────────────────────────────────────

const AGENCY_NOT_EXECUTABLE: Record<string, string> = {
  "agent-tools": "Necesita la CLI de inference.sh y su clave INFSH_API_KEY; ninguna de las dos está instalada en la plataforma.",
  "browser-use": "Necesita el navegador remoto de Browser Use y su clave BROWSER_USE_API_KEY; el Web Lab no tiene esa integración.",
  "video-editing": "Trabaja sobre un vídeo de entrada con FFmpeg; el Web Lab no recibe archivos de vídeo.",
  "photo-editor": "Edita una imagen de entrada (recortes, fondos, filtros); el Web Lab no recibe ni procesa imágenes.",
  "file-converter": "Convierte archivos de entrada (documentos, audio, imágenes); el Web Lab no recibe archivos.",
  "pdf": "Lee, une o rellena PDFs de entrada con sus scripts de Python; el Web Lab no recibe archivos.",
  "website-cloning": "Necesita Playwright para extraer la web y construir una app React + Vite en un repositorio; no cabe en una ejecución.",
  "web-artifacts-builder": "Necesita sus scripts de construcción (init y bundle con pnpm/parcel) dentro de un entorno de desarrollo.",
  "skill-creator": "Skill interna del agente de desarrollo: crea y evalúa skills en el repositorio, no produce un resultado aquí.",
  "skill-finder": "Skill interna del agente de desarrollo: recomienda skills de Replit al propio agente.",
  "find-skills": "Skill interna del agente de desarrollo: instala skills con la CLI de skills en el repositorio.",
  "executing-plans": "Skill interna del agente de desarrollo: ejecuta un plan de implementación sobre el repositorio.",
  "brainstorming": "Skill interna del agente de desarrollo: conversación por turnos antes de programar, no una ejecución de una vez.",
  "migrate-to-multi-artifact": "Skill interna del agente de desarrollo: reorganiza el repositorio del proyecto.",
  "replit-migration-guardrails": "Skill interna del agente de desarrollo: reglas para migrar repositorios a Replit.",
  "stitch-loop": "Bucle autónomo del agente con Google Stitch sobre el repositorio; para generar con Stitch usa «Stitch AI» del Web Lab.",
};

const AGENCY_DOCUMENT: Record<string, OfficeFormat> = {
  "docx": "docx",
  "xlsx": "xlsx",
  "excel-generator": "xlsx",
  "pptx": "pptx",
  "invoice-generator": "docx",
  "resume-maker": "docx",
};

const AGENCY_HTML = new Set([
  "canvas-design", "infographic-builder", "ad-creative", "3d-web-effects", "frontend-design",
  "threejs-animation", "threejs-fundamentals", "threejs-geometry", "threejs-interaction",
  "threejs-lighting", "threejs-loaders", "threejs-materials", "threejs-textures",
  "recreate-screenshot",
]);

const AGENCY_WEB_SEARCH = new Set([
  "deep-research", "competitive-analysis", "supplier-research", "personal-shopper", "ai-sdr",
  "github-solution-finder", "travel-assistant", "stock-analyzer",
]);

const AGENCY_NOTES: Record<string, string> = {
  "podcast-generator": "Se entrega el guion del episodio; el audio con ElevenLabs no se produce desde aquí.",
  "interview-prep": "Se entrega el simulador por escrito (preguntas, rúbrica y respuestas modelo), sin voz.",
  "stock-analyzer": "Análisis informativo con datos públicos; no es asesoramiento de inversión.",
};

const AGENCY_DEV_GUIDES = new Set([
  "vercel-composition-patterns", "vercel-react-best-practices", "vercel-react-native-skills",
  "web-component-design", "web-design-guidelines", "next-best-practices", "better-auth-best-practices",
  "supabase-postgres-best-practices", "remotion-best-practices", "ui-ux-pro-max", "frontend-design",
  "3d-web-effects", "threejs-animation", "threejs-fundamentals", "threejs-geometry", "threejs-interaction",
  "threejs-lighting", "threejs-loaders", "threejs-materials", "threejs-textures",
]);

const CYBER_NOT_EXECUTABLE: Record<string, string> = {
  "red-teaming": "Técnica ofensiva sobre sistemas ajenos (post-explotación, robo de credenciales…). El Web Lab solo ejecuta análisis defensivos.",
  "red-team": "Técnica ofensiva sobre sistemas ajenos. El Web Lab solo ejecuta análisis defensivos.",
  "offensive-security": "Técnica ofensiva sobre sistemas ajenos. El Web Lab solo ejecuta análisis defensivos.",
  "purple-team": "Ejercicio de ataque y defensa sobre una infraestructura propia con herramientas de emulación; el Web Lab no tiene acceso a ella.",
  "penetration-testing": "Prueba activa con herramientas (nmap, Burp, Metasploit…) contra un objetivo autorizado; el Web Lab no lanza ataques.",
  "malware-analysis": "Necesita la muestra binaria y un sandbox de análisis (Cuckoo/CAPE, Ghidra…), que la plataforma no tiene.",
  "digital-forensics": "Necesita imágenes de disco o de memoria y herramientas forenses (Volatility, dd, Autopsy…), que la plataforma no tiene.",
  "hardware-firmware-security": "Necesita el dispositivo o el binario del firmware y herramientas como binwalk.",
  "firmware-security": "Necesita el binario del firmware y herramientas como binwalk.",
  "firmware-analysis": "Necesita el binario del firmware y herramientas como binwalk.",
  "wireless-security": "Necesita hardware de radio (adaptador en modo monitor o SDR).",
  "ot-ics-security": "Necesita acceso a la red industrial (PLC, SCADA) y sus protocolos.",
  "ot-security": "Necesita acceso a la red industrial (PLC, SCADA) y sus protocolos.",
  "mobile-security": "Necesita el APK/IPA o un dispositivo con Frida/MobSF.",
};

/** Subdominios cuyo objeto de trabajo es una web, una API o su código. */
const CYBER_WEB_SUBDOMAINS = new Set([
  "web-application-security", "api-security", "application-security", "devsecops",
  "supply-chain-security", "cryptography", "privacy-compliance", "data-protection",
  "phishing-defense", "social-engineering-defense", "vulnerability-management",
]);

const OFFICE_OPTIONS = [
  { value: "docx", label: "Word (.docx)" },
  { value: "xlsx", label: "Excel (.xlsx)" },
  { value: "pptx", label: "PowerPoint (.pptx)" },
];

const AGENCY_CATEGORY_LABEL: Record<string, string> = {
  document: "Documentos",
  media: "Creatividad y medios",
  marketing: "Marketing y SEO",
  business: "Negocio",
  dev: "Desarrollo web",
  internal: "Agente de desarrollo",
};

function humanize(id: string): string {
  return id.replace(/[-_]+/g, " ").replace(/\b\w/g, c => c.toUpperCase());
}

function textInput(required: boolean, placeholder: string): SkillInputSpec {
  return { key: "text", label: "Encargo y material", kind: "textarea", required, placeholder };
}
function urlInput(required: boolean, label = "URL a analizar (se lee en pasivo)"): SkillInputSpec {
  return { key: "url", label, kind: "url", required, placeholder: "https://ejemplo.com" };
}

function buildAgencySkill(meta: { id: string; name: string; description: string; category: string }): WebLabSkill {
  const id = meta.id;
  const notExec = AGENCY_NOT_EXECUTABLE[id];
  const docFormat = AGENCY_DOCUMENT[id];
  const isInternal = !!notExec && /interna del agente|Bucle autónomo/.test(notExec);
  const category = isInternal ? "internal"
    : AGENCY_DEV_GUIDES.has(id) ? "dev"
    : meta.category === "meta" ? "dev"
    : meta.category;

  const engine: SkillEngine = id === "recreate-screenshot" ? "claude-vision"
    : AGENCY_WEB_SEARCH.has(id) ? "gemini-search"
    : "claude";
  const output: SkillOutputKind = docFormat ? "document" : AGENCY_HTML.has(id) ? "html" : "markdown";

  let inputs: SkillInputSpec[];
  if (engine === "claude-vision") {
    inputs = [
      { key: "imageUrl", label: "URL pública de la captura", kind: "url", required: true, placeholder: "https://…/captura.png" },
      textInput(false, "Detalles: qué partes recrear, tipografías, comportamiento…"),
    ];
  } else if (docFormat) {
    inputs = [
      textInput(true, "Qué documento quieres y con qué datos (nombres, cifras, apartados…)"),
      { key: "format", label: "Formato del archivo", kind: "select", required: true, options: OFFICE_OPTIONS, defaultValue: docFormat },
    ];
  } else {
    inputs = [
      textInput(false, "Qué quieres conseguir y el material de partida (texto, código, datos…)"),
      urlInput(false, "URL de referencia (opcional, se lee en pasivo)"),
    ];
  }

  return {
    id: `agency:${id}`,
    source: "agency",
    skillId: id,
    name: meta.name && meta.name !== id ? meta.name : humanize(id),
    description: meta.description || "",
    category: AGENCY_CATEGORY_LABEL[category] ?? humanize(category),
    executable: !notExec,
    reason: notExec,
    engine,
    output,
    inputs,
    note: AGENCY_NOTES[id],
  };
}

function buildCyberSkill(meta: { id: string; name: string; description: string; subdomain: string }): WebLabSkill {
  const sub = meta.subdomain || "otros";
  const notExec = CYBER_NOT_EXECUTABLE[sub];
  const webish = CYBER_WEB_SUBDOMAINS.has(sub);
  return {
    id: `cybersec:${meta.id}`,
    source: "cybersec",
    skillId: meta.id,
    name: humanize(meta.name || meta.id),
    description: meta.description || "",
    category: humanize(sub),
    executable: !notExec,
    reason: notExec,
    engine: "claude",
    output: "markdown",
    inputs: webish
      ? [urlInput(false), textInput(false, "O pega aquí el código, las cabeceras HTTP, la configuración o los logs a revisar")]
      : [textInput(true, "Pega la configuración, política, logs o descripción del sistema a revisar"), urlInput(false, "URL relacionada (opcional, se lee en pasivo)")],
    note: webish
      ? "Análisis pasivo: se lee la respuesta pública de la URL (cabeceras y HTML) o lo que pegues; no se envían cargas de ataque."
      : "Análisis defensivo sobre el material que pegues; la skill no se conecta a tus sistemas.",
  };
}

let _catalog: WebLabSkill[] | null = null;

/** Catálogo estático (no depende de claves); se cachea. */
function baseCatalog(): WebLabSkill[] {
  if (_catalog) return _catalog;
  const agency = getAgentSkillsCatalog().map(buildAgencySkill);
  const cyber = getCybersecCatalog().map(m => buildCyberSkill(m));
  _catalog = [...agency.sort((a, b) => a.name.localeCompare(b.name)), ...cyber.sort((a, b) => a.name.localeCompare(b.name))];
  return _catalog;
}

/** Solo para tests. */
export function _resetWebLabSkillsCache(): void { _catalog = null; }

export function isClaudeConfigured(): boolean {
  return !!(process.env.ANTHROPIC_API_KEY || (process.env.AI_INTEGRATIONS_ANTHROPIC_BASE_URL && process.env.AI_INTEGRATIONS_ANTHROPIC_API_KEY));
}

export interface EngineStatus { claude: boolean; gemini: boolean }

export function getEngineStatus(): EngineStatus {
  return { claude: isClaudeConfigured(), gemini: isGeminiAvailable() };
}

/** Aplica el estado real de los motores: sin Claude, nada que dependa de él se ejecuta. */
function withEngineStatus(s: WebLabSkill, engines: EngineStatus): WebLabSkill {
  if (!s.executable) return s;
  const needsClaude = s.engine !== "gemini-search" || !engines.gemini;
  if (needsClaude && !engines.claude) {
    return { ...s, executable: false, reason: "El motor de IA no está configurado: falta ANTHROPIC_API_KEY (o la integración de Anthropic) en el servidor." };
  }
  return s;
}

export function listWebLabSkills(): { skills: WebLabSkill[]; engines: EngineStatus } {
  const engines = getEngineStatus();
  return { skills: baseCatalog().map(s => withEngineStatus(s, engines)), engines };
}

export function getWebLabSkill(id: string): WebLabSkill | null {
  const engines = getEngineStatus();
  const s = baseCatalog().find(x => x.id === id);
  return s ? withEngineStatus(s, engines) : null;
}

export function getWebLabSkillContent(skill: WebLabSkill): string | null {
  return skill.source === "agency" ? getAgentSkillContent(skill.skillId) : getCybersecSkillContent(skill.skillId);
}

// ── Ejecución ────────────────────────────────────────────────────────────────

const MAX_SKILL_CHARS = 45_000;
const MAX_PAGE_CHARS = 60_000;
const MAX_TEXT_CHARS = 60_000;

function normalizeUrl(raw: string): string {
  const t = raw.trim();
  return /^https?:\/\//i.test(t) ? t : `https://${t}`;
}

const INTERESTING_HEADERS = /^(server|x-powered-by|content-security-policy|strict-transport-security|x-frame-options|x-content-type-options|referrer-policy|permissions-policy|cross-origin-|access-control-|set-cookie|cache-control|content-type|x-xss-protection|via|cf-ray|x-generator)/i;

async function fetchPassive(rawUrl: string): Promise<{ url: string; status: number; contentType: string; headers: string; body: string; bytes: number }> {
  const url = normalizeUrl(rawUrl);
  try {
    new URL(url);
  } catch {
    throw new SkillRunError(400, `La URL «${rawUrl}» no es válida.`, "BAD_URL");
  }
  let resp: Response;
  try {
    resp = await safeFetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36",
        Accept: "text/html,application/xhtml+xml,application/json;q=0.9,*/*;q=0.8",
      },
      signal: AbortSignal.timeout(15_000),
    });
  } catch (e) {
    const cause = (e as { cause?: { code?: string } })?.cause?.code;
    const msg = cause === "ENOTFOUND" ? "el dominio no existe o no resuelve"
      : cause === "ECONNREFUSED" ? "el servidor rechazó la conexión"
      : cause && /CERT|SSL|TLS/.test(cause) ? `certificado TLS no válido (${cause})`
      : e instanceof Error && e.name === "TimeoutError" ? "no respondió en 15 s"
      : e instanceof Error ? e.message : String(e);
    throw new SkillRunError(422, `No se pudo leer ${url}: ${msg}`, "FETCH_FAILED");
  }
  const contentType = resp.headers.get("content-type") ?? "";
  const headerLines: string[] = [];
  resp.headers.forEach((v, k) => { if (INTERESTING_HEADERS.test(k)) headerLines.push(`${k}: ${v.slice(0, 600)}`); });
  let body = "";
  if (/text|json|xml|javascript/i.test(contentType) || !contentType) {
    body = await resp.text();
  } else {
    await resp.body?.cancel().catch(() => {});
  }
  return { url, status: resp.status, contentType, headers: headerLines.join("\n"), body: body.slice(0, MAX_PAGE_CHARS), bytes: body.length };
}

function buildSystemPrompt(skill: WebLabSkill, skillMd: string): string {
  const guard = skill.source === "cybersec"
    ? `\n\nLÍMITES (obligatorios): solo análisis DEFENSIVO y pasivo sobre el material aportado. No generes cargas de explotación listas para usar contra terceros. Si la guía pide herramientas que no tienes (curl, Burp, nmap…), aplica sus comprobaciones al material aportado y di claramente qué no se pudo comprobar sin ellas.`
    : "";
  const md = skillMd.length > MAX_SKILL_CHARS ? `${skillMd.slice(0, MAX_SKILL_CHARS)}\n\n[… SKILL.md recortado …]` : skillMd;
  return `Eres el ejecutor de skills del Web Lab de Shopy Crafter. Vas a EJECUTAR la skill «${skill.skillId}» siguiendo su SKILL.md al pie de la letra y entregar el RESULTADO FINAL utilizable, no una descripción de lo que harías.

Reglas:
- Responde en español (salvo que el encargo pida otro idioma o el resultado sea código).
- Usa solo los datos aportados (encargo, URL leída, imagen). No inventes cifras, nombres ni hallazgos: si falta un dato, dilo y sigue con lo demás.
- Si la skill describe pasos con herramientas o scripts que aquí no existen, hazlo con el razonamiento y los datos aportados, y avisa en una línea de lo que no se pudo ejecutar.
- Sin preámbulos: empieza directamente por el resultado.${guard}

═══ SKILL.md (${skill.skillId}) ═══
${md}`;
}

function buildUserPrompt(skill: WebLabSkill, inputs: SkillRunInputs, page: Awaited<ReturnType<typeof fetchPassive>> | null): string {
  const parts: string[] = [];
  const text = (inputs.text ?? "").trim();
  parts.push(`ENCARGO:\n${text ? text.slice(0, MAX_TEXT_CHARS) : `Ejecuta la skill «${skill.skillId}» sobre la URL aportada y entrega su resultado completo.`}`);
  if (page) {
    parts.push(`URL LEÍDA: ${page.url}\nEstado HTTP: ${page.status}\nContent-Type: ${page.contentType}\n\nCABECERAS RELEVANTES:\n${page.headers || "(ninguna de las relevantes)"}\n\nCUERPO (${page.bytes} caracteres${page.bytes > MAX_PAGE_CHARS ? `, recortado a ${MAX_PAGE_CHARS}` : ""}):\n${page.body}`);
  }
  if (skill.output === "html") {
    parts.push(`FORMATO DE SALIDA: un único documento HTML completo y autocontenido (<!DOCTYPE html> … </html>) dentro de un bloque \`\`\`html. CSS y JS en línea; librerías solo desde cdnjs.cloudflare.com o cdn.jsdelivr.net con versión exacta. Después del bloque, como mucho 5 líneas explicando las decisiones.`);
  } else {
    parts.push("FORMATO DE SALIDA: Markdown claro (títulos, listas, tablas y bloques de código cuando toque).");
  }
  return parts.join("\n\n────────\n\n");
}

export function extractHtmlDocument(text: string): string | null {
  const fenced = text.match(/```html\s*\n([\s\S]*?)```/i);
  const candidate = fenced ? fenced[1] : text;
  const start = candidate.search(/<!DOCTYPE html|<html[\s>]/i);
  if (start === -1) return null;
  const endIdx = candidate.toLowerCase().lastIndexOf("</html>");
  return (endIdx === -1 ? candidate.slice(start) : candidate.slice(start, endIdx + 7)).trim();
}

function friendlyEngineError(err: unknown): SkillRunError {
  if (err instanceof SkillRunError) return err;
  const e = err as { status?: number; name?: string; message?: string; code?: string };
  const msg = e?.message ?? String(err);
  if (e?.name === "AiBudgetExceededError" || e?.code === "AI_BUDGET_EXCEEDED") return new SkillRunError(402, msg, "AI_BUDGET_EXCEEDED");
  if (e?.name === "AiTruncatedError") return new SkillRunError(502, "La respuesta del modelo se cortó antes de terminar; prueba con un encargo más concreto.", "AI_TRUNCATED");
  if (e?.name === "AiJsonError") return new SkillRunError(502, "El modelo no devolvió el esquema del documento; vuelve a intentarlo.", "AI_BAD_JSON");
  if (e?.name === "GeminiUnavailableError") return new SkillRunError(503, "Gemini no responde por ninguna vía ahora mismo.", "GEMINI_UNAVAILABLE");
  if (e?.status === 401 || /invalid x-api-key|authentication_error/i.test(msg)) return new SkillRunError(502, "La clave del motor de IA no es válida o ha caducado (Anthropic respondió 401).", "AI_AUTH");
  if (e?.status === 429 || /rate.?limit|overloaded/i.test(msg)) return new SkillRunError(429, "El motor de IA está saturado o con límite de peticiones; espera un minuto y repite.", "AI_RATE_LIMIT");
  if (/timeout|aborted/i.test(msg)) return new SkillRunError(504, "El motor de IA tardó demasiado en responder.", "AI_TIMEOUT");
  return new SkillRunError(500, `Fallo al ejecutar la skill: ${msg.slice(0, 300)}`, "RUN_FAILED");
}

export interface RunOptions {
  projectId?: number;
  /** Guarda el archivo generado en el Vault (solo si hay proyecto). */
  saveFile?: (file: { title: string; mimeType: string; buffer: Buffer; format: string; skillId: string }) => Promise<number | null>;
}

export async function runWebLabSkill(id: string, inputs: SkillRunInputs, opts: RunOptions = {}): Promise<SkillRunResult> {
  const t0 = Date.now();
  const projectId = opts.projectId && opts.projectId > 0 ? opts.projectId : 0;
  const skill = getWebLabSkill(id);
  if (!skill) throw new SkillRunError(404, `La skill «${id}» no existe en el catálogo.`, "NOT_FOUND");
  if (!skill.executable) throw new SkillRunError(409, skill.reason ?? "Esta skill no se puede ejecutar desde el Web Lab.", "NOT_EXECUTABLE");

  for (const spec of skill.inputs) {
    const v = (inputs as Record<string, string | undefined>)[spec.key];
    if (spec.required && !(v ?? "").trim()) throw new SkillRunError(400, `Falta «${spec.label}».`, "MISSING_INPUT");
  }
  const hasText = !!inputs.text?.trim();
  const hasUrl = !!inputs.url?.trim();
  if (skill.engine !== "claude-vision" && !hasText && !hasUrl) {
    throw new SkillRunError(400, "Escribe el encargo o indica una URL para ejecutar la skill.", "MISSING_INPUT");
  }

  const skillMd = getWebLabSkillContent(skill);
  if (!skillMd) throw new SkillRunError(500, `No se encontró el SKILL.md de «${skill.skillId}» en el servidor.`, "SKILL_FILE_MISSING");

  const page = hasUrl && skill.engine !== "claude-vision" ? await fetchPassive(inputs.url!) : null;
  const system = buildSystemPrompt(skill, skillMd);
  const user = buildUserPrompt(skill, inputs, page);
  const base = { skill: { id: skill.id, name: skill.name, source: skill.source } };
  const fetched = page ? { url: page.url, status: page.status, bytes: page.bytes, contentType: page.contentType } : undefined;

  try {
    // ── Documento de Office real ──
    if (skill.output === "document") {
      const fmt = (["docx", "xlsx", "pptx"].includes(inputs.format ?? "") ? inputs.format : AGENCY_DOCUMENT[skill.skillId] ?? "docx") as OfficeFormat;
      const outline = await askClaudeJson<OfficeDocRequest>(
        projectId,
        `${user}\n\n────────\n\nDevuelve SOLO un JSON con esta forma exacta (será un archivo .${fmt} real):\n{"title": string, "subtitle"?: string, "sections": [{"heading"?: string, "paragraphs"?: string[], "bullets"?: string[], "table"?: {"headers": string[], "rows": string[][]}}]}\nEn ${fmt === "xlsx" ? "Excel cada sección es una hoja: pon los datos en table" : fmt === "pptx" ? "PowerPoint cada sección es una diapositiva: titular corto y 3-6 viñetas" : "Word usa párrafos, listas y tablas según pida el documento"}.`,
        system,
        16000,
        240_000,
      );
      if (!outline || typeof outline.title !== "string" || !Array.isArray(outline.sections) || outline.sections.length === 0) {
        throw new SkillRunError(502, "El modelo no devolvió título y secciones para el documento; vuelve a intentarlo.", "AI_BAD_JSON");
      }
      const { buffer, mimeType, extension } = await generateOfficeDocument(fmt, outline);
      const safeName = outline.title.replace(/[^\p{L}\p{N} _-]+/gu, "").trim().slice(0, 60) || skill.skillId;
      let vaultId: number | null = null;
      if (projectId && opts.saveFile) {
        vaultId = await opts.saveFile({ title: outline.title, mimeType, buffer, format: extension, skillId: skill.skillId }).catch(() => null);
      }
      return {
        ...base,
        output: { kind: "document", outline, file: { name: `${safeName}.${extension}`, mimeType, base64: buffer.toString("base64"), sizeBytes: buffer.length, vaultId } },
        engine: { provider: "claude", model: "claude (tier smart)" },
        truncated: false,
        durationMs: Date.now() - t0,
        fetched,
      };
    }

    // ── Visión (captura → HTML) ──
    if (skill.engine === "claude-vision") {
      const imageUrl = normalizeUrl(inputs.imageUrl!);
      const text = await askClaudeWithVision(projectId, user, [{ url: imageUrl }], system, 16000, 240_000);
      const html = extractHtmlDocument(text);
      if (!html) throw new SkillRunError(502, "El modelo no devolvió un documento HTML; vuelve a intentarlo.", "AI_NO_HTML");
      return { ...base, output: { kind: "html", html, text: text.replace(/```html[\s\S]*?```/i, "").trim() }, engine: { provider: "claude", model: "claude (tier vision)" }, truncated: false, durationMs: Date.now() - t0 };
    }

    // ── Investigación con búsqueda web (Gemini) ──
    if (skill.engine === "gemini-search" && isGeminiAvailable()) {
      const r = await askGeminiWithSearch(user, system, page ? [page.url] : undefined);
      if (r.text.trim()) {
        return {
          ...base,
          output: { kind: "markdown", text: r.text },
          engine: { provider: "gemini", model: r.usage?.model ?? "gemini + Google Search" },
          usage: r.usage ? { inputTokens: r.usage.inputTokens, outputTokens: r.usage.outputTokens, costUsd: r.usage.costUsd } : undefined,
          truncated: false,
          durationMs: Date.now() - t0,
          fetched,
          sources: r.sources,
        };
      }
    }
    const fallbackNote = skill.engine === "gemini-search"
      ? "Sin búsqueda web en vivo (Gemini no está disponible): Claude ha trabajado solo con lo aportado y su conocimiento."
      : undefined;

    // ── Texto / HTML con Claude ──
    const r = await askClaudeDetailed(projectId, [{ role: "user", content: user }], system, skill.output === "html" ? 20000 : 12000, 240_000, { tier: "smart" }, `web_lab_skill:${skill.skillId}`);
    const usage = { inputTokens: r.usage.inputTokens, outputTokens: r.usage.outputTokens, costUsd: r.usage.costUsd };
    if (skill.output === "html") {
      const html = extractHtmlDocument(r.text);
      if (!html) {
        return { ...base, output: { kind: "markdown", text: r.text }, engine: { provider: "claude", model: r.usage.model, fallbackNote: "El modelo no devolvió una página HTML; se muestra su respuesta en texto." }, usage, truncated: r.truncated, durationMs: Date.now() - t0, fetched };
      }
      return { ...base, output: { kind: "html", html, text: r.text.replace(/```html[\s\S]*?```/i, "").trim() }, engine: { provider: "claude", model: r.usage.model }, usage, truncated: r.truncated, durationMs: Date.now() - t0, fetched };
    }
    return { ...base, output: { kind: "markdown", text: r.text }, engine: { provider: "claude", model: r.usage.model, fallbackNote }, usage, truncated: r.truncated, durationMs: Date.now() - t0, fetched };
  } catch (err) {
    throw friendlyEngineError(err);
  }
}
