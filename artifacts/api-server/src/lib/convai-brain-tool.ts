/**
 * Arturo (ElevenLabs ConvAI) consulta a ShopyBrain.
 *
 * Cada agente (admin, client, landing) lleva una herramienta de servidor (webhook)
 * «consultar_shopybrain» con un parámetro `peticion`. ElevenLabs la llama en
 * POST /api/voice/convai/brain-tool/<tipo> y aquí se decide la puerta:
 *
 *   admin   → puerta admin   (necesita un brain_token firmado para un admin)
 *   client  → puerta client  (brain_token firmado con SU proyecto: el proyecto sale
 *                             del token, nunca del texto ni de otro campo)
 *   landing → puerta public  (sin token: el visitante es anónimo)
 *
 * Quién llama: cada tipo tiene su propia cabecera secreta (HMAC del secreto
 * ELEVEN_BRAIN_TOOL_SECRET con el tipo). La cabecera del agente landing no abre
 * la puerta admin. El brain_token lo emiten /voice/convai/call-url y
 * /voice/client-call-url como dynamic_variable de la conversación; el agente lo
 * reenvía tal cual (ElevenLabs lo rellena, no el modelo) y aquí se comprueba la
 * firma. Un cliente que manipule sus dynamic_variables no puede inventarse otro
 * proyecto: no tiene el secreto.
 *
 * Por voz no se ejecuta nada destructivo: se responde que se confirme en el panel.
 * Sin ELEVEN_BRAIN_TOOL_SECRET o sin URL pública, la herramienta no se instala y
 * Arturo sigue como antes.
 */
import { createHmac, timingSafeEqual } from "node:crypto";
import { sql } from "drizzle-orm";
import { db } from "@workspace/db";
import { publicAppUrl } from "./account-tokens.js";
import { logger } from "./logger.js";
import { DESTRUCTIVE_ACTIONS } from "./shopybrain-helpers.js";
import { isActionAllowed, type BrainGate } from "./brain/catalog.js";
import { recordBrainEvent } from "./brain/events.js";
import { pickModelSync } from "./ai-models.js";
import type { BrainProposedAction } from "./brain/router.js";

// brainRoute/brainExecute se cargan al usarse: execute.ts arrastra módulos con
// efectos al importarse (limitadores en Postgres) que voice.ts no necesita al arrancar.
export const loadBrain = async () => ({
  brainRoute: (await import("./brain/router.js")).brainRoute,
  brainExecute: (await import("./brain/execute.js")).brainExecute,
});

export type ConvAIAgentKind = "admin" | "client" | "landing";
export const CONVAI_AGENT_KINDS: readonly ConvAIAgentKind[] = ["admin", "client", "landing"];

export const BRAIN_TOOL_NAME = "consultar_shopybrain";
export const BRAIN_TOOL_HEADER = "x-shopybrain-secret";
const BRAIN_TOKEN_VAR = "brain_token";
const BRAIN_TOKEN_TTL_MS = 3 * 60 * 60 * 1000;
const MAX_PETICION_CHARS = 1000;
const MAX_SPOKEN_CHARS = 700;
const MAX_ACTIONS_PER_CALL = 2;
const ELEVEN_BASE = "https://api.elevenlabs.io/v1";

export const GATE_FOR_AGENT: Record<ConvAIAgentKind, BrainGate> = { admin: "admin", client: "client", landing: "public" };

export function isConvAIAgentKind(v: unknown): v is ConvAIAgentKind {
  return typeof v === "string" && (CONVAI_AGENT_KINDS as readonly string[]).includes(v);
}

/** Secreto compartido (Replit → Secrets). null = herramienta desactivada. */
export function brainToolSecret(): string | null {
  const s = process.env.ELEVEN_BRAIN_TOOL_SECRET?.trim();
  return s && s.length >= 24 ? s : null;
}

function hmac(key: string, msg: string): string {
  return createHmac("sha256", key).update(msg).digest("hex");
}

function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  return ab.length === bb.length && timingSafeEqual(ab, bb);
}

/** Valor de la cabecera secreta de un tipo de agente (uno distinto por tipo). */
export function brainToolHeaderValue(kind: ConvAIAgentKind, secret = brainToolSecret()): string | null {
  return secret ? hmac(secret, `convai-brain-tool:${kind}`) : null;
}

export interface BrainTokenPayload { k: ConvAIAgentKind; p?: number; u?: string; e: number }

/** Token para la dynamic_variable brain_token: tipo de agente + proyecto/usuario + caducidad. */
export function signBrainToken(data: { kind: ConvAIAgentKind; projectId?: number | null; userId?: string | number | null }, now = Date.now()): string | null {
  const secret = brainToolSecret();
  if (!secret) return null;
  const payload: BrainTokenPayload = { k: data.kind, e: now + BRAIN_TOKEN_TTL_MS };
  if (data.projectId && data.projectId > 0) payload.p = data.projectId;
  if (data.userId !== null && data.userId !== undefined) payload.u = String(data.userId).slice(0, 120);
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return `${body}.${hmac(secret, `convai-brain-token:${body}`)}`;
}

export function verifyBrainToken(token: unknown, kind: ConvAIAgentKind, now = Date.now()): BrainTokenPayload | null {
  const secret = brainToolSecret();
  if (!secret || typeof token !== "string" || token.length > 1000) return null;
  const [body, sig] = token.split(".");
  if (!body || !sig || !safeEqual(sig, hmac(secret, `convai-brain-token:${body}`))) return null;
  try {
    const p = JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as BrainTokenPayload;
    if (p.k !== kind || typeof p.e !== "number" || p.e < now) return null;
    return p;
  } catch { return null; }
}

/** Línea del prompt de Arturo: cuándo usar la herramienta. */
export const BRAIN_TOOL_PROMPT_LINE: Record<ConvAIAgentKind, string> = {
  admin: `\n\nHerramienta ${BRAIN_TOOL_NAME}: úsala cuando el jefe te pida datos reales de la plataforma o de una tienda, o una orden (revisar, crear, lanzar algo). Pásale en "peticion" lo que ha pedido, entero y en sus palabras, y cuéntale la respuesta con las tuyas. Si te dice que hay que confirmarlo en el panel, díselo así; nunca digas que algo está hecho si la herramienta no lo dice.`,
  client: `\n\nHerramienta ${BRAIN_TOOL_NAME}: úsala cuando el cliente pregunte por datos de su tienda que no veas arriba (productos, pedidos, informes) o quiera pasar un recado o una petición al equipo. Pásale en "peticion" lo que ha pedido, entero, y cuéntale la respuesta con tus palabras. Nunca digas que algo está hecho si la herramienta no lo dice.`,
  landing: `\n\nHerramienta ${BRAIN_TOOL_NAME}: úsala cuando el visitante pregunte por servicios o precios que no sepas con seguridad, o cuando quiera que le contacte el equipo (antes pídele nombre y email y pásalos en la petición). Pásale en "peticion" lo que ha pedido, entero, y cuéntale la respuesta con tus palabras.`,
};

/** tool_config de ElevenLabs para un tipo de agente (POST/PATCH /v1/convai/tools). */
export function brainToolConfig(kind: ConvAIAgentKind, baseUrl: string, headerValue: string): Record<string, unknown> {
  const properties: Record<string, unknown> = {
    peticion: {
      type: "string",
      description: "Lo que la persona ha pedido o preguntado, entero y en sus palabras (con nombres, cifras y datos de contacto si los ha dado).",
    },
    conversation_id: { type: "string", dynamic_variable: "system__conversation_id" },
  };
  if (kind !== "landing") properties[BRAIN_TOKEN_VAR] = { type: "string", dynamic_variable: BRAIN_TOKEN_VAR };
  return {
    type: "webhook",
    name: BRAIN_TOOL_NAME,
    description: kind === "landing"
      ? "Consulta a ShopyBrain, el cerebro de Shopy Crafter: servicios, precios orientativos y abrir una solicitud de contacto para el visitante."
      : "Consulta a ShopyBrain, el cerebro de Shopy Crafter: datos reales, informes y órdenes. Devuelve una respuesta breve para decir en voz alta.",
    response_timeout_secs: 30,
    api_schema: {
      url: `${baseUrl}/api/voice/convai/brain-tool/${kind}`,
      method: "POST",
      request_headers: { "X-ShopyBrain-Secret": headerValue },
      request_body_schema: {
        type: "object",
        description: "Petición para ShopyBrain",
        required: ["peticion"],
        properties,
      },
    },
  };
}

// ── Alta de la herramienta en ElevenLabs (una por tipo, id en platform_settings_kv) ──

const toolIdCache: Partial<Record<ConvAIAgentKind, string>> = {};
/** Tipos cuya herramienta ya se actualizó (URL y cabecera) en este proceso. */
const toolRefreshed = new Set<ConvAIAgentKind>();

async function elevenTools(method: "POST" | "PATCH", path: string, body: unknown): Promise<{ ok: boolean; status: number; data: { id?: string } }> {
  const apiKey = process.env.ELEVENLABS_API_KEY?.trim();
  if (!apiKey) throw new Error("ELEVENLABS_API_KEY no configurado");
  const r = await fetch(`${ELEVEN_BASE}${path}`, {
    method,
    headers: { "xi-api-key": apiKey, "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(20_000),
  });
  const data = await r.json().catch(() => ({})) as { id?: string };
  return { ok: r.ok, status: r.status, data };
}

async function readToolId(kind: ConvAIAgentKind): Promise<string | null> {
  const rows = await db.execute(sql`SELECT value FROM platform_settings_kv WHERE key = ${`convai_${kind}_brain_tool_id`}`);
  const v = ((rows as { rows?: Array<{ value?: string }> }).rows ?? [])[0]?.value;
  return v && v.length > 4 ? v : null;
}

async function saveToolId(kind: ConvAIAgentKind, id: string): Promise<void> {
  await db.execute(sql`
    INSERT INTO platform_settings_kv (key, value, updated_at)
    VALUES (${`convai_${kind}_brain_tool_id`}, ${id}, NOW())
    ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()
  `);
}

/**
 * Id de la herramienta del tipo, creándola si no existe. null si está desactivada
 * (sin secreto o sin URL pública). Se llama desde agentConfigFor, que ya corre bajo
 * el candado del tipo de agente: no se crean dos herramientas a la vez.
 */
export async function ensureConvAIBrainTool(kind: ConvAIAgentKind): Promise<string | null> {
  const secret = brainToolSecret();
  const baseUrl = publicAppUrl();
  if (!secret || !baseUrl) return null;
  const config = brainToolConfig(kind, baseUrl, brainToolHeaderValue(kind, secret)!);

  let id = toolIdCache[kind] ?? await readToolId(kind);
  if (id && !toolRefreshed.has(kind)) {
    // Una vez por proceso: URL y cabecera al día (cambio de dominio o de secreto).
    const up = await elevenTools("PATCH", `/convai/tools/${encodeURIComponent(id)}`, { tool_config: config });
    if (up.status === 404) id = null;
    else if (!up.ok) throw new Error(`ElevenLabs tools update ${up.status}`);
  }
  if (!id) {
    const created = await elevenTools("POST", "/convai/tools", { tool_config: config });
    if (!created.ok || !created.data.id) throw new Error(`ElevenLabs tools create ${created.status}`);
    id = created.data.id;
    await saveToolId(kind, id);
    logger.info({ kind, toolId: id }, "ConvAI: herramienta consultar_shopybrain creada");
  }
  toolIdCache[kind] = id;
  toolRefreshed.add(kind);
  return id;
}

/** Solo pruebas. */
export function _resetBrainToolCache(): void {
  for (const k of CONVAI_AGENT_KINDS) delete toolIdCache[k];
  toolRefreshed.clear();
}

// ── El webhook ────────────────────────────────────────────────────────────────

/** Prompt base de voz para la puerta admin (respuestas cortas, sin markdown). */
export const VOICE_ADMIN_PROMPT = `Eres ShopyBrain, el cerebro de Shopy Crafter, y te hablan por VOZ: tu respuesta se va a leer en voz alta.
Responde en español, en una o dos frases, sin markdown, sin listas, sin emojis ni URLs. Directo y natural.
El texto viene de un reconocedor de voz y puede traer errores: interpreta la intención; si no la entiendes, pide que lo repitan y no propongas acciones.
Si la petición es una acción del catálogo, propón SOLO la principal con su bloque de acción. Nunca inventes datos ni digas que algo está hecho: lo hace la acción.`;

/** Modelo rápido para la voz (latencia antes que profundidad): el tier «fast»
 *  de Claude que se elige en el panel de modelos, salvo VOICE_BRAIN_CLAUDE_MODEL. */
export function voiceClaudeModel(): string {
  return process.env.VOICE_BRAIN_CLAUDE_MODEL?.trim() || pickModelSync("claude", "fast");
}

/** Texto apto para voz: sin markdown y corto, cortado en una frase. */
export function toSpoken(text: string, max = MAX_SPOKEN_CHARS): string {
  const plain = text
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/!\[[^\]]*\]\([^)]*\)/g, " ")
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
    .replace(/[*_`#>|]+/g, "")
    .replace(/^\s*[-•]\s+/gm, "")
    .replace(/\s+/g, " ")
    .trim();
  if (plain.length <= max) return plain;
  const cut = plain.slice(0, max);
  const end = Math.max(cut.lastIndexOf(". "), cut.lastIndexOf("? "), cut.lastIndexOf("! "));
  return end > max / 3 ? cut.slice(0, end + 1) : `${cut.trimEnd()}…`;
}

function resultLine(action: string, status: number, body: Record<string, unknown>): string {
  if (body.requiresConfirmation) return `Para ${action} necesito que lo confirmes en el panel.`;
  const msg = typeof body.message === "string" ? body.message : typeof body.error === "string" ? body.error : "";
  if (status >= 400 || body.error || body.success === false) return msg ? `No se pudo: ${toSpoken(msg, 200)}` : `No se pudo completar ${action}.`;
  return msg ? toSpoken(msg, 300) : "Hecho.";
}

export interface BrainToolCallInput {
  kind: string;
  /** Cabecera X-ShopyBrain-Secret tal cual llegó. */
  secretHeader: string | undefined;
  body: unknown;
}

export interface BrainToolCallResult { status: number; body: { respuesta: string } | { error: string } }

export async function handleBrainToolCall(input: BrainToolCallInput): Promise<BrainToolCallResult> {
  const secret = brainToolSecret();
  if (!secret) return { status: 503, body: { error: "Herramienta no configurada" } };
  if (!isConvAIAgentKind(input.kind)) return { status: 404, body: { error: "Agente desconocido" } };
  const kind = input.kind;
  const expected = brainToolHeaderValue(kind, secret)!;
  if (typeof input.secretHeader !== "string" || !safeEqual(input.secretHeader, expected)) {
    logger.warn({ kind }, "ConvAI brain-tool: llamada sin cabecera secreta válida");
    return { status: 401, body: { error: "No autorizado" } };
  }

  const gate = GATE_FOR_AGENT[kind];
  const channel = `voice-convai-${kind}`;
  const b = (input.body && typeof input.body === "object" ? input.body : {}) as Record<string, unknown>;
  const peticion = typeof b.peticion === "string" ? b.peticion.trim().slice(0, MAX_PETICION_CHARS) : "";
  if (!peticion) return { status: 400, body: { error: "Falta peticion" } };
  const conversationId = typeof b.conversation_id === "string" ? b.conversation_id.slice(0, 80) : "";

  // Puerta por el agente que llama; proyecto y usuario, del token firmado.
  let projectId: number | null = null;
  let userId: string | null = null;
  if (kind !== "landing") {
    const tok = verifyBrainToken(b[BRAIN_TOKEN_VAR], kind);
    if (!tok || (kind === "client" && !(tok.p && tok.p > 0))) {
      void recordBrainEvent({ gate, channel, input: peticion, kind: "answer", status: "denied", detail: "brain_token ausente, caducado o de otro agente" });
      return { status: 403, body: { respuesta: "Ahora mismo no puedo consultar los datos. Cuelga y vuelve a abrir la llamada desde el panel." } };
    }
    projectId = kind === "client" ? tok.p! : null;
    userId = tok.u ?? null;
  }

  const { brainRoute, brainExecute } = await loadBrain();
  let routed;
  try {
    routed = await brainRoute({
      text: peticion,
      gate,
      channel,
      userId,
      projectId,
      ...(gate === "admin"
        ? { engineMode: "claude" as const, models: { claude: voiceClaudeModel() }, systemPrompt: VOICE_ADMIN_PROMPT }
        : {}),
    });
  } catch (err) {
    logger.warn({ kind, err: err instanceof Error ? err.message : String(err) }, "ConvAI brain-tool: brainRoute falló");
    return { status: 200, body: { respuesta: "Ahora mismo no puedo consultarlo. Prueba en un momento o míralo en el panel." } };
  }

  const lines: string[] = [];
  const spoken = toSpoken(routed.text);
  if (spoken) lines.push(spoken);

  const proposed: BrainProposedAction[] = routed.actions.slice(0, MAX_ACTIONS_PER_CALL);
  for (const a of proposed) {
    const action = String(a.action ?? "");
    if (!action) continue;
    if (action === "navigate") continue; // por teléfono no hay pantalla que mover
    // Defensa en profundidad: brainRoute ya filtra por puerta y brainExecute vuelve a mirarlo.
    if (gate !== "admin" && !isActionAllowed(action, gate)) continue;
    if (DESTRUCTIVE_ACTIONS.has(action)) {
      void recordBrainEvent({
        gate, channel, userId, projectId, input: action, kind: "execute",
        actions: [{ action, params: a.params }], status: "needs_confirmation",
        detail: "Destructiva por voz: no se ejecuta, se confirma en el panel",
      });
      lines.push(`Eso (${action}) no lo hago por voz: confírmalo en el panel.`);
      continue;
    }
    try {
      const out = await brainExecute({
        action,
        params: a.params && typeof a.params === "object" ? a.params : {},
        gate,
        channel,
        userId,
        userName: kind === "client" ? "Cliente (llamada con Arturo)" : null,
        projectId,
        // Límite de leads por conversación (lo rellena ElevenLabs, no el modelo).
        ip: kind === "landing" ? `convai:${conversationId || "sin-id"}` : null,
      });
      if (out.kind === "result") lines.push(resultLine(action, out.status, out.body));
    } catch (err) {
      logger.warn({ kind, action, err: err instanceof Error ? err.message : String(err) }, "ConvAI brain-tool: brainExecute falló");
      lines.push(`No pude completar ${action}; prueba desde el panel.`);
    }
  }

  return { status: 200, body: { respuesta: toSpoken(lines.join(" "), MAX_SPOKEN_CHARS + 300) || "No tengo nada que añadir." } };
}
