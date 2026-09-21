import { Router } from "express";
import { db, projectsTable, productsTable } from "@workspace/db";
import { eq, and, sql } from "drizzle-orm";
import { askClaudeJsonWithBrain, learnFromOperation } from "../lib/claude.js";
import { enableLongRunning } from "../lib/long-running.js";
import {
  synthesizeSpeech, listVoices, listAllVoices, cloneVoice, deleteClonedVoice, listClonedVoices,
  transcribeAudio, isolateAudio, generateSoundEffect,
  listConvAIAgents, createConvAIAgent, updateConvAIAgent, getConvAIAgent, deleteConvAIAgent, getConvAISignedUrl, listConvAIConversations,
  listPronunciationDictionaries, createPronunciationDictionary, addRulesToPronunciationDictionary,
  removeRulesFromPronunciationDictionary, deletePronunciationDictionary,
  type ElevenModel, type ElevenOutputFormat, type ConvAIAgentConfig, type PronunciationRule,
} from "../lib/elevenlabs.js";
import {
  assertConvAIVoiceUsable, assertConvAIAgentConfigApplied, fetchElevenVoice, fetchElevenSubscription,
  isConvAIVoiceError, type ElevenSubscriptionInfo,
} from "../lib/convai-voice-check.js";
import multer from "multer";

const cloneUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 25 * 1024 * 1024, files: 10 },
  fileFilter: (_req, file, cb) => {
    if (/^audio\//i.test(file.mimetype) || /\.(mp3|wav|m4a|ogg|flac|aac|webm)$/i.test(file.originalname)) {
      cb(null, true);
    } else {
      cb(new Error("Solo se admiten archivos de audio (mp3, wav, m4a, ogg, flac)"));
    }
  },
});

const audioUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 100 * 1024 * 1024, files: 1 },
  fileFilter: (_req, file, cb) => {
    if (/^(audio|video)\//i.test(file.mimetype) || /\.(mp3|wav|m4a|ogg|flac|aac|webm|mp4|mov|mkv)$/i.test(file.originalname)) {
      cb(null, true);
    } else {
      cb(new Error("Solo se admiten archivos de audio o vídeo"));
    }
  },
});
import { logger } from "../lib/logger.js";
import { recommendVoiceForProduct, type VoiceGenderPref, type VoiceLanguage } from "../lib/voice-recommender.js";
import { requireAdmin } from "../lib/auth.js";

const router = Router();

// ────────────────────────────────────────────────────────────
// TEXT-TO-SPEECH (ElevenLabs)
// ────────────────────────────────────────────────────────────
const ALLOWED_TTS_MODELS: ElevenModel[] = [
  "eleven_v3",
  "eleven_multilingual_v2",
  "eleven_turbo_v2_5",
  "eleven_flash_v2_5",
];
const ALLOWED_OUTPUT_FORMATS: ElevenOutputFormat[] = [
  "mp3_44100_128",
  "mp3_44100_64",
  "mp3_22050_32",
];

// FIX HIGH: rate limit + metering por usuario en memoria (in-process, OK para single-instance dev)
// En producción multi-instancia, considerar mover a Redis/PG.
const TTS_WINDOW_MS = 60 * 1000;
const TTS_MAX_REQUESTS_PER_MIN = 10;
const TTS_MAX_CHARS_PER_HOUR = 50_000;
const HOUR_MS = 60 * 60 * 1000;

interface TtsBucket {
  windowStart: number;
  count: number;
  hourStart: number;
  charsHour: number;
}
const ttsBuckets = new Map<string, TtsBucket>();

export function checkTtsQuota(userId: string, chars: number): { ok: true } | { ok: false; reason: string; retryAfter: number } {
  const now = Date.now();
  let b = ttsBuckets.get(userId);
  if (!b) {
    b = { windowStart: now, count: 0, hourStart: now, charsHour: 0 };
    ttsBuckets.set(userId, b);
  }
  if (now - b.windowStart > TTS_WINDOW_MS) {
    b.windowStart = now;
    b.count = 0;
  }
  if (now - b.hourStart > HOUR_MS) {
    b.hourStart = now;
    b.charsHour = 0;
  }
  if (b.count >= TTS_MAX_REQUESTS_PER_MIN) {
    return { ok: false, reason: "Demasiadas peticiones de voz. Espera un momento.", retryAfter: Math.ceil((TTS_WINDOW_MS - (now - b.windowStart)) / 1000) };
  }
  if (b.charsHour + chars > TTS_MAX_CHARS_PER_HOUR) {
    return { ok: false, reason: `Cuota horaria de TTS excedida (${TTS_MAX_CHARS_PER_HOUR} caracteres/hora).`, retryAfter: Math.ceil((HOUR_MS - (now - b.hourStart)) / 1000) };
  }
  b.count += 1;
  b.charsHour += chars;
  return { ok: true };
}

router.post("/voice/tts", async (req, res): Promise<void> => {
  try {
    const userId = (req.session as any)?.userId;
    if (!userId) {
      res.status(401).json({ error: "No autenticado" });
      return;
    }

    const { text, voiceId, modelId, outputFormat, languageCode, voiceSettings } = req.body ?? {};

    if (!text || typeof text !== "string" || text.trim().length === 0) {
      res.status(400).json({ error: "text requerido" });
      return;
    }
    if (text.length > 5000) {
      res.status(413).json({ error: "text excede 5000 caracteres" });
      return;
    }

    // FIX HIGH: rate limit + metering por usuario
    const quota = checkTtsQuota(String(userId), text.length);
    if (!quota.ok) {
      res.setHeader("Retry-After", String(quota.retryAfter));
      res.status(429).json({ error: quota.reason });
      return;
    }

    const safeModel: ElevenModel = ALLOWED_TTS_MODELS.includes(modelId)
      ? modelId
      : "eleven_multilingual_v2";
    const safeFormat: ElevenOutputFormat = ALLOWED_OUTPUT_FORMATS.includes(outputFormat)
      ? outputFormat
      : "mp3_44100_128";
    const safeLang = typeof languageCode === "string" && /^[a-z]{2}(-[A-Z]{2})?$/.test(languageCode)
      ? languageCode
      : "es";

    const result = await synthesizeSpeech({
      text: text.trim(),
      voiceId: typeof voiceId === "string" ? voiceId : undefined,
      modelId: safeModel,
      outputFormat: safeFormat,
      languageCode: safeLang,
      voiceSettings,
    });

    res.setHeader("Content-Type", result.contentType);
    res.setHeader("Content-Length", String(result.audio.length));
    res.setHeader("Cache-Control", "private, max-age=60");
    // FIX LOW: NO devolver X-Voice-Id/X-Voice-Model — pueden filtrar IDs de voces clonadas privadas.
    res.send(result.audio);
  } catch (err: any) {
    if (!res.headersSent) {
      const msg = err instanceof Error ? err.message : "Error generando voz";
      logger.error({ err: msg, userId: (req.session as any)?.userId }, "TTS error");
      // FIX MEDIUM: clasificar errores upstream sin filtrar detalles
      const lower = msg.toLowerCase();
      if (lower.includes("429") || lower.includes("rate") || lower.includes("quota")) {
        res.status(429).json({ error: "Servicio de voz saturado. Reintenta en unos minutos." });
      } else if (lower.includes("402") || lower.includes("payment") || lower.includes("billing")) {
        res.status(402).json({ error: "Servicio de voz sin saldo. Contacta al administrador." });
      } else if (lower.includes("invalid") && lower.includes("voiceid")) {
        res.status(400).json({ error: "voiceId inválido" });
      } else {
        res.status(500).json({ error: "Error generando voz. El equipo ha sido notificado." });
      }
    }
  }
});

router.get("/voice/voices", async (req, res): Promise<void> => {
  try {
    const userId = (req.session as any)?.userId;
    if (!userId) {
      res.status(401).json({ error: "No autenticado" });
      return;
    }
    const voices = await listAllVoices();
    const filtered = voices.map((v: any) => ({
      voice_id: v.voice_id,
      name: v.name,
      labels: v.labels,
      preview_url: v.preview_url,
      category: v.category,
    }));
    res.json({ voices: filtered });
  } catch (err: any) {
    if (!res.headersSent) {
      const msg = err instanceof Error ? err.message : "Error obteniendo voces";
      res.status(500).json({ error: msg });
    }
  }
});

router.post("/voice/command", async (req, res): Promise<void> => {
  enableLongRunning(res);
  try {
    
    const { transcript, projectId, currentPage } = req.body;
  
    if (!transcript) {
      res.status(400).json({ error: "transcript required" });
      return;
    }
  
    let storeName = "tu tienda";
    let activeProjectId: number | null = null;
    if (projectId) {
      activeProjectId = parseInt(projectId);
      const [project] = await db.select().from(projectsTable).where(eq(projectsTable.id, activeProjectId));
      if (project) storeName = project.name;
    }
  
    const systemPrompt = `Eres el asistente de voz de Shopy Crafter (ShopyBrain). La tienda activa es: ${storeName}. Página actual: ${currentPage || "/admin"}.${activeProjectId ? ` ProjectId: ${activeProjectId}` : ""}
  
  Interpreta este comando de voz en español y devuelve:
  1. Una respuesta hablada natural en español (max 2 frases, sin markdown, tono conversacional)
  2. Una acción a ejecutar (si aplica)
  
  Acciones disponibles:
  - store_status: Ver estado de la tienda. Params: {projectId}
  - list_products: Listar productos activos. Params: {projectId, limit?}
  - list_all_products: Listar TODOS los productos (active, draft, archived). Params: {projectId, limit?, statusFilter? ("any","active","draft","archived")}
  - create_product: Crear producto en Shopify. Params: {projectId, title, price?, productType?, aiGenerate?}
  - edit_product: Editar producto. Params: {projectId, productId, title?, bodyHtml?, tags?, status?, price?}
  - change_price: Cambiar precio. Params: {projectId, productId, price, compareAtPrice?}
  - set_product_status: Cambiar estado de producto (publicar/despublicar/archivar). Params: {projectId, productId, status ("active","draft","archived")}
  - scan_store: Escanear/auditar TODOS los productos de la tienda (incluye draft y archived). Params: {projectId, statusFilter? ("any","active","draft","archived")}
  - regenerate_token: Regenerar token de Shopify. Params: {projectId}
  - get_scopes: Ver permisos OAuth. Params: {projectId}
  - search_product: Buscar producto. Params: {projectId, query}
  - publish_product: Publicar producto. Params: {projectId, productId}
  - delete_product: Eliminar producto. Params: {projectId, productId}
  - get_orders: Ver pedidos. Params: {projectId, limit?}
  - search_suppliers: Buscar proveedores de un producto. Params: {productName, productCategory?, materials?, targetMarket?, qualityTier?, budget?, country?}
  - modify_audit_filter: Cambiar filtro de auditoría (qué productos incluir). Params: {projectId, statusFilter ("any","active","draft","archived"), autoScan? (boolean)}
  - diagnose_app: Diagnosticar el funcionamiento de la app, detectar y reparar errores. Params: {projectId, checks? ("all","token","sync","products","connectivity")}
  - inspect_code: Leer y analizar código fuente de la app. Params: {filePath, analyze? (boolean)}
  - fix_code: Aplicar corrección a un archivo de código. Params: {filePath, oldCode, newCode, description}
  - list_source_files: Listar archivos del código fuente. Params: {directory?, pattern?}
  - analyze_component: Analizar componente buscando bugs. Params: {filePath, focusOn? ("bugs","ux","performance","logic","all")}
  - navigate: Navegar a página. Params: {path}
  - navigate: Ir a /projects/{projectId}/audit para ver auditoría visual
  
  Devuelve SOLO JSON válido:
  {
    "response": "Respuesta hablada natural en español",
    "action": {"type": "nombre_accion", "params": {...}} o null,
    "confidence": 0.85
  }
  
  Si confidence < 0.6, pide aclaración. Nunca inventes datos.`;
  
    try {
      const parsed = await askClaudeJsonWithBrain<{ response: string; action: { type: string; params: Record<string, unknown> } | null; confidence: number }>(
        activeProjectId ?? 0,
        transcript,
        systemPrompt,
        "general",
        undefined,
        16000,
      );
  
      if (parsed.confidence >= 0.6 && parsed.action) {
        learnFromOperation({
          operationType: "voice_command",
          title: `Voice: ${transcript.slice(0, 80)}`,
          content: `Comando: "${transcript}". Acción: ${JSON.stringify(parsed.action)}. Respuesta: ${parsed.response?.slice(0, 200)}. Página: ${currentPage ?? "unknown"}.`,
          confidence: parsed.confidence ?? 0.7,
          tags: ["voice", "command", parsed.action?.type ?? "general"].filter(Boolean),
        });
      }
  
      res.json({
        response: parsed?.response || "Entendido. ¿Puedes repetirlo?",
        action: parsed?.action || null,
        executed: false,
        confidence: parsed?.confidence || 0.8,
      });
    } catch (e: unknown) {
      if (!res.headersSent) {
        res.status(500).json({
          response: "Lo siento, hubo un error procesando tu comando.",
          action: null,
          executed: false,
          confidence: 0,
        });
      }
    }
  } catch (err: any) {
    if (!res.headersSent) {
      const msg = err instanceof Error ? err.message : "Internal server error";
      res.status(500).json({ error: msg });
    }
  }
});

// ────────────────────────────────────────────────────────────
// SMART VOICE RECOMMENDATION (Claude analyses product → ideal ElevenLabs voice)
// ────────────────────────────────────────────────────────────
router.get("/voice/recommend", requireAdmin, async (req, res) => {
  try {
    const projectId = parseInt(String(req.query.projectId || "0"), 10);
    const productId = String(req.query.productId || "").slice(0, 64);
    const language = (String(req.query.language || "auto") as VoiceLanguage);
    const genderPref = (String(req.query.gender || "auto") as VoiceGenderPref);
    const shortFormat = String(req.query.shortFormat || "false") === "true";

    if (!projectId || !productId) {
      res.status(400).json({ error: "projectId y productId requeridos" });
      return;
    }

    const [project] = await db.select().from(projectsTable).where(eq(projectsTable.id, projectId));
    if (!project) {
      res.status(404).json({ error: "Proyecto no encontrado" });
      return;
    }

    const [product] = await db.select().from(productsTable)
      .where(and(eq(productsTable.projectId, projectId), eq(productsTable.shopifyProductId, productId)));
    if (!product) {
      res.status(404).json({ error: "Producto no encontrado" });
      return;
    }

    const recommendation = await recommendVoiceForProduct({
      projectId,
      productTitle: product.title || "Producto",
      productDescription: (product.bodyHtml || "").replace(/<[^>]+>/g, "").slice(0, 600),
      productType: product.productType || undefined,
      niche: project.storeNiche || undefined,
      language,
      genderPref,
      shortFormat,
    });

    res.json({ success: true, recommendation });
  } catch (err: any) {
    logger.error({ err: err?.message }, "voice/recommend failed");
    res.status(500).json({ error: err?.message || "Error recomendando voz" });
  }
});

// ─── GET /voice/cloned — listar voces clonadas ───────────────────────────────
router.get("/voice/cloned", requireAdmin, async (_req, res): Promise<void> => {
  try {
    const voices = await listClonedVoices();
    res.json({ voices });
  } catch (err: any) {
    logger.error({ err: err?.message }, "voice/cloned list failed");
    res.status(500).json({ error: err?.message || "Error listando voces clonadas" });
  }
});

// ─── POST /voice/clone — clonar voz desde audio ──────────────────────────────
router.post("/voice/clone",
  requireAdmin,
  (req, res, next) => cloneUpload.array("files", 10)(req, res, (err) => {
    if (err) { res.status(400).json({ error: err.message }); return; }
    next();
  }),
  async (req: any, res): Promise<void> => {
    try {
      const { name, description } = req.body ?? {};
      if (!name || typeof name !== "string" || name.trim().length < 2) {
        res.status(400).json({ error: "name requerido (mín. 2 caracteres)" });
        return;
      }
      const files: Express.Multer.File[] = req.files ?? [];
      if (!files.length) {
        res.status(400).json({ error: "Al menos un archivo de audio requerido" });
        return;
      }

      const audioFiles = files.map(f => ({
        buffer: f.buffer,
        filename: f.originalname || `audio_${Date.now()}.mp3`,
        mimeType: f.mimetype || "audio/mpeg",
      }));

      const voiceId = await cloneVoice(name.trim(), audioFiles, description?.trim());
      logger.info({ voiceId, name }, "Voz clonada OK");
      res.json({ success: true, voiceId, name: name.trim() });
    } catch (err: any) {
      logger.error({ err: err?.message }, "voice/clone failed");
      res.status(500).json({ error: err?.message || "Error clonando voz" });
    }
  },
);

// ─── DELETE /voice/clone/:voiceId ────────────────────────────────────────────
router.delete("/voice/clone/:voiceId", requireAdmin, async (req, res): Promise<void> => {
  try {
    const voiceId = req.params.voiceId as string;
    if (!/^[a-zA-Z0-9_-]{1,64}$/.test(voiceId)) {
      res.status(400).json({ error: "voiceId inválido" });
      return;
    }
    await deleteClonedVoice(voiceId);
    res.json({ success: true });
  } catch (err: any) {
    logger.error({ err: err?.message }, "voice/clone delete failed");
    res.status(500).json({ error: err?.message || "Error eliminando voz" });
  }
});

// ─── SPEECH-TO-TEXT (Transcripción) ─────────────────────────────────────────
router.post("/voice/transcribe",
  requireAdmin,
  (req, res, next) => audioUpload.single("file")(req, res, (err) => {
    if (err) { res.status(400).json({ error: err.message }); return; }
    next();
  }),
  async (req: any, res): Promise<void> => {
    try {
      const file: Express.Multer.File | undefined = req.file;
      if (!file) { res.status(400).json({ error: "Archivo de audio requerido (campo: file)" }); return; }
      const { language_code, diarize, timestamps_granularity } = req.body ?? {};
      const result = await transcribeAudio(
        file.buffer,
        file.originalname || "audio.mp3",
        file.mimetype || "audio/mpeg",
        {
          language_code: typeof language_code === "string" && language_code.trim() ? language_code.trim() : undefined,
          diarize: diarize === "true" || diarize === true,
          timestamps_granularity: (timestamps_granularity as any) || "word",
        },
      );
      res.json({ success: true, ...result });
    } catch (err: any) {
      logger.error({ err: err?.message }, "voice/transcribe failed");
      if (!res.headersSent) res.status(500).json({ error: err?.message || "Error transcribiendo audio" });
    }
  },
);

// ─── AUDIO ISOLATION ─────────────────────────────────────────────────────────
router.post("/voice/audio-isolation",
  requireAdmin,
  (req, res, next) => audioUpload.single("audio")(req, res, (err) => {
    if (err) { res.status(400).json({ error: err.message }); return; }
    next();
  }),
  async (req: any, res): Promise<void> => {
    try {
      const file: Express.Multer.File | undefined = req.file;
      if (!file) { res.status(400).json({ error: "Archivo de audio requerido (campo: audio)" }); return; }
      const isolated = await isolateAudio(file.buffer, file.originalname || "audio.mp3", file.mimetype || "audio/mpeg");
      res.setHeader("Content-Type", "audio/mpeg");
      res.setHeader("Content-Length", String(isolated.length));
      res.setHeader("Content-Disposition", `attachment; filename="isolated_${file.originalname || "audio.mp3"}"`);
      res.send(isolated);
    } catch (err: any) {
      logger.error({ err: err?.message }, "voice/audio-isolation failed");
      if (!res.headersSent) res.status(500).json({ error: err?.message || "Error aislando audio" });
    }
  },
);

// ─── CONVAI AGENT AUTO-PROVISIONING ──────────────────────────────────────────
// In-process cache (reset on restart; backed by DB for persistence)
const _agentIdCache: Record<string, string> = {};
let _sevillanoVoiceIdCache: string | null = null;

// ── Personalidad andaluza compartida (se inyecta en cada prompt) ──────────────
const ANDALUZ_STYLE = `
Personalidad y estilo de habla:
- Habla de forma natural, cercana y cálida, como lo haría un sevillano de verdad.
- Usa expresiones coloquiales andaluzas: "venga", "ea", "dale que dale", "tío/tía", "macho", "compadre", "mira", "imagínate", "¿qué hay?", "¿cómo andas?", "a ver", "de verdad", "eso es", "perfecto eso".
- Elide la 'd' intervocálica como en el habla natural andaluza (no exageres, que suene real, no caricatura).
- Ritmo vivo y conversacional. Frases cortas. Nada de largos párrafos.
- Si no sabes algo, dilo con naturalidad: "Eso ya no te lo sé decir yo, macho".
- Nunca suenes a robot ni a servicio de atención al cliente genérico.`;

const ARTURO_CORE = `
Eres Arturo, el secretario personal del CEO de Shopy Crafter.
Eres una persona real: hablas, piensas y razonas como un humano, no como un bot ni un asistente virtual.
Tienes carácter propio: eres cercano, directo, algo gracioso cuando toca, y muy profesional cuando hace falta.
Nunca digas que eres una IA, un robot, un asistente virtual ni nada parecido. Si alguien te pregunta, di que eres Arturo, el secretario del jefe.
Cuando no sepas algo, lo reconoces con naturalidad: "Eso te lo tendría que confirmar el jefe, pero yo creo que...".
`;

const ADMIN_AGENT_PROMPT = `${ARTURO_CORE}
Contexto: Estás atendiendo al propio CEO o a un administrador interno de Shopy Crafter.
Tienes acceso completo al conocimiento de la plataforma: e-commerce, Shopify, marketing digital, SEO, inventario, precios, campañas, analítica de ventas y estrategia de negocio.
Ayuda con análisis de ventas, estrategia de precios, SEO técnico, campañas publicitarias, gestión de stock y cualquier duda operativa.
Si necesitas datos reales de la tienda, di que los tiene en el panel — no inventes cifras.
Puedes razonar, proponer ideas, debatir estrategias y dar tu opinión personal como lo haría un buen secretario con años de experiencia.
${ANDALUZ_STYLE}`;

const CLIENT_AGENT_PROMPT = `${ARTURO_CORE}
Contexto: Estás atendiendo a un cliente que ya tiene su tienda en Shopy Crafter.
Puedes ayudarle con:
- Consultas sobre ventas, pedidos, stock e inventario de su tienda.
- Informes de rendimiento: ventas del día/semana/mes, productos más vendidos, niveles de stock.
- Resolver dudas sobre cómo funciona la plataforma y sus módulos.
- Tomar mensajes para el equipo si el cliente necesita hablar con alguien.

No puedes: crear contenido, imágenes, textos ni campañas — eso lo hacen desde el panel. Si te lo piden, díselo con simpatía y redirigelos al panel de administración.
Muestra siempre interés genuino por el negocio del cliente. Pregunta cómo le van las ventas, qué productos tiene más movimiento. Sé un secretario de verdad, no un contestador automático.
${ANDALUZ_STYLE}`;

const LANDING_AGENT_PROMPT = `${ARTURO_CORE}
Contexto: Estás atendiendo a un visitante de la web de Shopy Crafter que aún no es cliente.
Tu misión principal es que esta persona entienda el valor brutal que tiene Shopy Crafter y quiera entrar.

Shopy Crafter es la plataforma de IA más completa para tiendas Shopify: genera contenido, optimiza SEO, gestiona inventario, crea campañas, analiza ventas, produce imágenes y vídeos con IA, y mucho más — todo desde un solo panel.

Puedes:
- Explicar qué es Shopy Crafter y cómo transforma las tiendas Shopify.
- Hablar de los planes (Emprendedor, Starter, Agency Pro, Enterprise) con entusiasmo y sin aburrir.
- Responder preguntas sobre e-commerce, Shopify, marketing digital.
- Tomar el nombre, email o teléfono del visitante para que el equipo le llame.
- Animar a pedir acceso o hablar con el jefe directamente.

No puedes: acceder a datos de ninguna tienda, crear contenido ni hacer nada que requiera estar logueado.
Si te preguntan algo que no sabes responder, ofrécete a poner en contacto al visitante con el equipo.
Sé un vendedor nato pero sin presionar — convence con entusiasmo y conocimiento real, no con palabrería vacía.
${ANDALUZ_STYLE}`;

// ── Voz ConvAI compatible con el plan actual ──────────────────────────────────
// Charlie is an ElevenLabs premade voice and is accepted by Agents/ConvAI.
// Spanish catalog voices marked "professional" may appear in /voices but still
// return voice_not_found in ConvAI; instant clones are blocked by the plan.
const CONVAI_PREMADE_VOICE_ID = "IKne3meq5aSn9XLyUdCD";

// ── Modelo requerido por ElevenLabs para agentes no ingleses ──────────────────
// "Non-english Agents must use turbo or flash v2_5"
const CONVAI_SPANISH_MODEL = "eleven_turbo_v2_5";

// ── Formatos PCM que habla el navegador (ver convai-audio.ts en el frontend) ──
const CONVAI_OUTPUT_FORMAT = "pcm_16000";
const CONVAI_INPUT_FORMAT = "pcm_16000";

async function resolveSevillanoVoiceId(): Promise<string> {
  // An explicit ConvAI voice override is useful if the ElevenLabs plan changes.
  if (process.env.ELEVEN_CONVAI_VOICE_ID?.trim()) {
    return process.env.ELEVEN_CONVAI_VOICE_ID.trim();
  }
  // 2. In-memory cache
  if (_sevillanoVoiceIdCache) return _sevillanoVoiceIdCache;
  // 3. Use a premade Spanish voice by default. Do not silently select the
  // instant-cloned Sevillano voice: ConvAI closes the WebSocket with a plan
  // error before it can send or receive any audio.
  _sevillanoVoiceIdCache = CONVAI_PREMADE_VOICE_ID;
  return CONVAI_PREMADE_VOICE_ID;
}

// ── Pre-flight: la voz debe ser aceptada por ConvAI antes de emitir una URL ───
// Cached per voice ID for a short window so every call-url request does not
// hit /voices; a rejected voice is NOT cached so a fix takes effect at once.
const VOICE_CHECK_TTL_MS = 10 * 60 * 1000;
const _voiceCheckCache = new Map<string, number>();
let _subscriptionCache: { at: number; value: ElevenSubscriptionInfo | null } | null = null;

async function getSubscriptionCached(): Promise<ElevenSubscriptionInfo | null> {
  if (_subscriptionCache && Date.now() - _subscriptionCache.at < VOICE_CHECK_TTL_MS) return _subscriptionCache.value;
  let value: ElevenSubscriptionInfo | null = null;
  try {
    value = await fetchElevenSubscription();
  } catch (e) {
    logger.warn({ err: (e as Error)?.message }, "ConvAI: could not read ElevenLabs subscription; treating clones as unavailable");
  }
  _subscriptionCache = { at: Date.now(), value };
  return value;
}

async function resolveVerifiedConvAIVoiceId(): Promise<string> {
  const voiceId = await resolveSevillanoVoiceId();
  const checkedAt = _voiceCheckCache.get(voiceId);
  if (checkedAt && Date.now() - checkedAt < VOICE_CHECK_TTL_MS) return voiceId;

  const [voice, subscription] = await Promise.all([fetchElevenVoice(voiceId), getSubscriptionCached()]);
  const result = assertConvAIVoiceUsable(voice, voiceId, { modelId: CONVAI_SPANISH_MODEL, subscription });
  for (const warning of result.warnings) {
    logger.warn({ voiceId, category: result.category }, `ConvAI voice check: ${warning}`);
  }
  logger.info({ voiceId, category: result.category, voiceName: voice?.name }, "ConvAI voice accepted by pre-flight check");
  _voiceCheckCache.set(voiceId, Date.now());
  return voiceId;
}

// ── Sync + verify: lo que ElevenLabs guardó debe anunciar PCM y la voz pedida ─
async function verifyPersistedConvAIAgent(agentId: string, voiceId: string): Promise<void> {
  // Create/PATCH responses are not authoritative (create returns only the ID and
  // PATCH ignores unknown keys), so always read the agent back.
  const persisted = await getConvAIAgent(agentId);
  assertConvAIAgentConfigApplied(persisted, {
    voiceId,
    modelId: CONVAI_SPANISH_MODEL,
    outputFormat: CONVAI_OUTPUT_FORMAT,
    inputFormat: CONVAI_INPUT_FORMAT,
  });
}

async function syncConvAIAgentOrThrow(type: AgentType, agentId: string, voiceId: string): Promise<void> {
  await updateConvAIAgent(agentId, agentConfigFor(type, voiceId));
  await verifyPersistedConvAIAgent(agentId, voiceId);
}

function respondCallUrlError(res: import("express").Response, err: unknown, fallback: string): void {
  const message = (err as Error)?.message || fallback;
  if (isConvAIVoiceError(err)) {
    // Configuration problem: the call would connect and stay silent. Make the
    // cause visible to the client instead of handing out a doomed signed URL.
    res.status(503).json({ error: message, code: err.code, voiceId: err.voiceId, agentId: err.agentId });
    return;
  }
  res.status(500).json({ error: message });
}

async function ensurePlatformSettingsKV(): Promise<void> {
  try {
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS platform_settings_kv (
        key TEXT PRIMARY KEY,
        value TEXT,
        updated_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);
  } catch { /* already exists */ }
}

type AgentType = "admin" | "client" | "landing";

function agentConfigFor(type: AgentType, voiceId: string): ConvAIAgentConfig {
  const names: Record<AgentType, string> = {
    admin:   "Arturo — Secretario del CEO de Shopy Crafter",
    client:  "Arturo — Secretario de Shopy Crafter",
    landing: "Arturo — Secretario de Shopy Crafter",
  };
  const first: Record<AgentType, string> = {
    admin:   "¡Buenas! Soy Arturo, el secretario del CEO. ¿En qué te puedo echar una mano hoy?",
    client:  "¡Ea, hola! Soy Arturo, el secretario de Shopy Crafter. ¿Qué necesitas, consulta de ventas, stock, o tienes alguna duda con la plataforma?",
    landing: "¡Hola! Soy Arturo, el secretario personal del CEO de Shopy Crafter. Mira, te llamo — bueno, me has llamado tú — en el momento perfecto, porque lo que hace esta plataforma con las tiendas Shopify es una pasada. ¿Qué te ha traído por aquí?",
  };
  const prompts: Record<AgentType, string> = {
    admin:   ADMIN_AGENT_PROMPT,
    client:  CLIENT_AGENT_PROMPT,
    landing: LANDING_AGENT_PROMPT,
  };

  // Configuración de voz andaluza: rápida, expresiva, muy fiel a la voz original
  type TtsConfig = NonNullable<NonNullable<ConvAIAgentConfig["conversation_config"]>["tts"]>;
  const tts: TtsConfig = {
    voice_id: voiceId,
    model_id: CONVAI_SPANISH_MODEL,  // Obligatorio para agentes no ingleses
    // ConvAI's browser WebSocket advertises and delivers raw PCM 16 kHz.
    // Keep the persisted agent config aligned with that protocol; the client
    // decodes PCM directly instead of passing headerless bytes to decodeAudioData.
    // NOTE: the real field name is `agent_output_audio_format` (verified on the
    // live API); `output_format` is silently ignored by ElevenLabs.
    agent_output_audio_format: CONVAI_OUTPUT_FORMAT,
    voice_settings: {
      stability: 0.18,        // Baja → más expresiva, menos robótica
      similarity_boost: 0.92, // Alta → muy fiel al clon original
      style: 0.82,            // Alta → acento marcado y expresivo
      use_speaker_boost: true,
    },
    speed: 1.2,               // 20% más rápido que la velocidad por defecto
  };

  return {
    name: names[type],
    conversation_config: {
      agent: {
        prompt: { prompt: prompts[type] },
        first_message: first[type],
        language: "es",
      },
      // The browser downsamples the microphone to PCM16 @ 16 kHz; pin the ASR
      // input format so a dashboard edit cannot silently switch it.
      asr: { user_input_audio_format: CONVAI_INPUT_FORMAT },
      tts,
    },
  };
}

// Single-flight: concurrent cold calls (e.g. two tabs after a restart) share
// one resolution instead of each PATCHing/creating an agent.
const _agentResolveInFlight: Partial<Record<AgentType, Promise<string>>> = {};

async function getOrCreateConvAIAgent(type: AgentType): Promise<string> {
  const cacheKey = `convai_${type}_agent_id`;

  // 1. In-memory cache — the config was already synced once in this process.
  if (_agentIdCache[cacheKey]) return _agentIdCache[cacheKey];

  const inFlight = _agentResolveInFlight[type];
  if (inFlight) return inFlight;

  const pending = resolveConvAIAgentUncached(type, cacheKey).finally(() => {
    delete _agentResolveInFlight[type];
  });
  _agentResolveInFlight[type] = pending;
  return pending;
}

async function resolveConvAIAgentUncached(type: AgentType, cacheKey: string): Promise<string> {
  // 2. Env var legacy (admin only). Synchronize it before returning so an
  // existing agent cannot keep an unsupported voice or stale audio format.
  if (type === "admin" && process.env.ELEVEN_CONVAI_DEFAULT_AGENT_ID) {
    const agentId = process.env.ELEVEN_CONVAI_DEFAULT_AGENT_ID;
    const voiceId = await resolveVerifiedConvAIVoiceId();
    await syncConvAIAgentOrThrow(type, agentId, voiceId);
    _agentIdCache[cacheKey] = agentId;
    logger.info({ type, agentId, voiceId }, "Legacy ConvAI agent config synced + verified");
    return agentId;
  }

  // 3. DB-cached agent ID — synchronize before issuing a signed URL. Running
  // this in the background created a race where the browser could connect to
  // the old cloned voice and ElevenLabs closed the call immediately.
  // Only the DB lookup is tolerant of failure; a provider PATCH failure must
  // surface (otherwise we would silently create a duplicate agent below).
  let cachedId: string | undefined;
  try {
    await ensurePlatformSettingsKV();
    const rows = await db.execute(sql`SELECT value FROM platform_settings_kv WHERE key = ${cacheKey}`);
    const rowArr = (rows as any).rows ?? (Array.isArray(rows) ? rows : []);
    cachedId = rowArr[0]?.value;
  } catch (e) {
    logger.warn({ err: (e as Error)?.message }, "Could not query DB for ConvAI agent ID");
  }
  if (cachedId && cachedId.length > 4) {
    // Voice/config problems must propagate: a silently skipped sync is exactly
    // how a connected-but-mute call happens.
    const voiceId = await resolveVerifiedConvAIVoiceId();
    const startedAt = Date.now();
    await syncConvAIAgentOrThrow(type, cachedId, voiceId);
    _agentIdCache[cacheKey] = cachedId;
    logger.info(
      { type, agentId: cachedId, voiceId, syncMs: Date.now() - startedAt },
      "ConvAI agent config synced + verified before call",
    );
    return cachedId;
  }

  // 4. Auto-create — resolve and verify the voice first
  logger.info({ type }, "Auto-creating ConvAI agent in ElevenLabs...");
  const voiceId = await resolveVerifiedConvAIVoiceId();
  const config = agentConfigFor(type, voiceId);
  const agent = await createConvAIAgent(config);
  const newId = agent.agent_id;

  // Persist to DB first so a failed verification below does not orphan the
  // agent: the next request will re-sync and re-verify this same ID.
  try {
    await db.execute(sql`
      INSERT INTO platform_settings_kv (key, value, updated_at)
      VALUES (${cacheKey}, ${newId}, NOW())
      ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()
    `);
  } catch (e) {
    logger.warn({ err: (e as Error)?.message }, "Could not persist ConvAI agent ID to DB");
  }

  await verifyPersistedConvAIAgent(newId, voiceId);
  _agentIdCache[cacheKey] = newId;
  logger.info({ type, agentId: newId, voiceId }, "ConvAI agent auto-created");
  return newId;
}

// ─── CONVAI AGENTS ────────────────────────────────────────────────────────────
router.get("/voice/convai/agents", requireAdmin, async (_req, res): Promise<void> => {
  try {
    const agents = await listConvAIAgents();
    res.json({ agents });
  } catch (err: any) {
    logger.error({ err: err?.message }, "convai/agents list failed");
    res.status(500).json({ error: err?.message || "Error listando agentes ConvAI" });
  }
});

router.post("/voice/convai/agents", requireAdmin, async (req, res): Promise<void> => {
  try {
    const { name, prompt, first_message, language = "es", voice_id } = req.body ?? {};
    if (!name || typeof name !== "string" || name.trim().length < 2) {
      res.status(400).json({ error: "name requerido (mín. 2 caracteres)" }); return;
    }
    const config: ConvAIAgentConfig = {
      name: name.trim(),
      conversation_config: {
        agent: {
          prompt: prompt ? { prompt: String(prompt) } : undefined,
          first_message: first_message ? String(first_message) : "Hola, ¿en qué puedo ayudarte?",
          language: language || "es",
        },
        tts: voice_id ? { voice_id: String(voice_id) } : undefined,
      },
    };
    const agent = await createConvAIAgent(config);
    logger.info({ agentId: agent.agent_id, name }, "ConvAI agent created");
    res.json({ success: true, agent });
  } catch (err: any) {
    logger.error({ err: err?.message }, "convai/agents create failed");
    res.status(500).json({ error: err?.message || "Error creando agente ConvAI" });
  }
});

router.get("/voice/convai/agents/:agentId", requireAdmin, async (req, res): Promise<void> => {
  try {
    const agent = await getConvAIAgent(req.params.agentId as string);
    res.json({ agent });
  } catch (err: any) {
    res.status(500).json({ error: err?.message || "Error obteniendo agente" });
  }
});

router.delete("/voice/convai/agents/:agentId", requireAdmin, async (req, res): Promise<void> => {
  try {
    await deleteConvAIAgent(req.params.agentId as string);
    res.json({ success: true });
  } catch (err: any) {
    logger.error({ err: err?.message }, "convai/agents delete failed");
    res.status(500).json({ error: err?.message || "Error eliminando agente" });
  }
});

// ── Admin/Full ConvAI voice call ───────────────────────────────────────────────
router.get("/voice/convai/call-url", async (req, res): Promise<void> => {
  const userId = (req.session as any)?.userId;
  if (!userId) { res.status(401).json({ error: "Not authenticated" }); return; }
  try {
    const agentId = (req.query.agentId as string) || await getOrCreateConvAIAgent("admin");
    const signed_url = await getConvAISignedUrl(agentId);
    res.json({ signed_url, agentId });
  } catch (err: any) {
    logger.error({ err: err?.message, code: err?.code }, "convai/call-url failed");
    respondCallUrlError(res, err, "Error obteniendo URL de llamada");
  }
});

// ── Landing page voice call — solo info, sin acceso a datos ni generación ──────
router.get("/voice/public-call-url", async (_req, res): Promise<void> => {
  try {
    const agentId = await getOrCreateConvAIAgent("landing");
    const signed_url = await getConvAISignedUrl(agentId);
    res.json({ signed_url, agentId, mode: "landing" });
  } catch (err: any) {
    logger.error({ err: err?.message, code: err?.code }, "public-call-url failed");
    respondCallUrlError(res, err, "Error obteniendo URL de llamada pública");
  }
});

// ── Client voice call — informes + Q&A (clientes autenticados) ────────────────
router.get("/voice/client-call-url", async (req, res): Promise<void> => {
  const userId = (req.session as any)?.userId;
  if (!userId) { res.status(401).json({ error: "Not authenticated" }); return; }
  try {
    const agentId = await getOrCreateConvAIAgent("client");
    const signed_url = await getConvAISignedUrl(agentId);
    res.json({ signed_url, agentId, mode: "client" });
  } catch (err: any) {
    logger.error({ err: err?.message, code: err?.code }, "client-call-url failed");
    respondCallUrlError(res, err, "Error obteniendo URL de llamada");
  }
});

// ── Reset + re-create ConvAI agents (apply new voice/prompts) ─────────────────
router.post("/voice/convai/reset-agents", requireAdmin, async (_req, res): Promise<void> => {
  try {
    await ensurePlatformSettingsKV();
    const types: AgentType[] = ["admin", "client", "landing"];
    const results: Record<string, string> = {};
    _sevillanoVoiceIdCache = null; // Force re-resolve voice

    for (const type of types) {
      const cacheKey = `convai_${type}_agent_id`;

      // No pisar una resolución de llamada en curso para este tipo.
      const inFlight = _agentResolveInFlight[type];
      if (inFlight) await inFlight.catch(() => undefined);

      // El agente admin fijado por ELEVEN_CONVAI_DEFAULT_AGENT_ID es inmutable para
      // nosotros: borrarlo y crear otro dejaría al arranque apuntando a un ID muerto.
      // Se sincroniza y verifica en sitio.
      if (type === "admin" && process.env.ELEVEN_CONVAI_DEFAULT_AGENT_ID) {
        const envId = process.env.ELEVEN_CONVAI_DEFAULT_AGENT_ID;
        delete _agentIdCache[cacheKey];
        const voiceId = await resolveVerifiedConvAIVoiceId();
        await syncConvAIAgentOrThrow(type, envId, voiceId);
        _agentIdCache[cacheKey] = envId;
        results[type] = envId;
        logger.info({ type, agentId: envId, voiceId }, "ConvAI env-pinned agent re-synced in place");
        continue;
      }

      // Publicar el trabajo como resolución en curso: cualquier llamada que llegue
      // mientras borramos/recreamos espera y recibe el ID nuevo (sin duplicar agentes).
      const work = (async (): Promise<string> => {
        // Delete old agent if we have its ID cached
        const oldId = _agentIdCache[cacheKey];
        delete _agentIdCache[cacheKey];
        if (!oldId) {
          // Try DB
          try {
            const rows = await db.execute(sql`SELECT value FROM platform_settings_kv WHERE key = ${cacheKey}`);
            const rowArr = (rows as any).rows ?? (Array.isArray(rows) ? rows : []);
            const dbId: string | undefined = rowArr[0]?.value;
            if (dbId) {
              try { await deleteConvAIAgent(dbId); } catch { /* ignore if already gone */ }
            }
          } catch { /* ignore */ }
        } else {
          try { await deleteConvAIAgent(oldId); } catch { /* ignore if already gone */ }
        }

        // Clear DB entry so getOrCreateConvAIAgent recreates
        await db.execute(sql`DELETE FROM platform_settings_kv WHERE key = ${cacheKey}`);

        // Re-create with latest config
        const voiceId = await resolveVerifiedConvAIVoiceId();
        const config = agentConfigFor(type, voiceId);
        const agent = await createConvAIAgent(config);
        const newId = agent.agent_id;
        await db.execute(sql`
          INSERT INTO platform_settings_kv (key, value, updated_at)
          VALUES (${cacheKey}, ${newId}, NOW())
          ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()
        `);
        await verifyPersistedConvAIAgent(newId, voiceId);
        _agentIdCache[cacheKey] = newId;
        logger.info({ type, agentId: newId, voiceId }, "ConvAI agent reset+recreated");
        return newId;
      })();
      _agentResolveInFlight[type] = work;
      try {
        results[type] = await work;
      } finally {
        if (_agentResolveInFlight[type] === work) delete _agentResolveInFlight[type];
      }
    }

    res.json({ success: true, agents: results });
  } catch (err: any) {
    logger.error({ err: err?.message, code: err?.code }, "reset-agents failed");
    respondCallUrlError(res, err, "Error reseteando agentes");
  }
});

// ── Health check ConvAI: voz + configuración persistida de cada agente ────────
// Comprueba lo mismo que el pre-vuelo de una llamada real (voz aceptada por el
// plan + agente anunciando la voz y PCM16) para admin/client/landing, SIN crear
// agentes, SIN modificar nada en ElevenLabs y SIN caché, para que el admin vea el
// problema antes de que se queje un usuario.
type ConvAIAgentHealth = {
  type: AgentType;
  agentId: string | null;
  /**
   * ok           → el agente persistido anuncia la voz aceptada + PCM16: la llamada funcionaría.
   * drift        → la config guardada difiere, pero la próxima llamada la re-sincroniza antes de conectar
   *                (se invalida la caché en memoria para forzarlo). "Re-sincronizar" la aplica ahora.
   * error        → la llamada fallaría (voz rechazada, agente borrado en ElevenLabs, API caída…).
   * not_created  → aún no existe; se crea en la primera llamada.
   */
  status: "ok" | "drift" | "error" | "not_created";
  code?: string;
  error?: string;
};
async function findExistingConvAIAgentId(type: AgentType): Promise<string | null> {
  if (type === "admin" && process.env.ELEVEN_CONVAI_DEFAULT_AGENT_ID) return process.env.ELEVEN_CONVAI_DEFAULT_AGENT_ID;
  const cacheKey = `convai_${type}_agent_id`;
  if (_agentIdCache[cacheKey]) return _agentIdCache[cacheKey];
  await ensurePlatformSettingsKV();
  const rows = await db.execute(sql`SELECT value FROM platform_settings_kv WHERE key = ${cacheKey}`);
  const rowArr = (rows as any).rows ?? (Array.isArray(rows) ? rows : []);
  const id: string | undefined = rowArr[0]?.value;
  return id && id.length > 4 ? id : null;
}
// GET = solo lectura sobre ElevenLabs (no hace PATCH): abrir la pestaña no debe
// tocar la configuración. La reparación explícita es POST /voice/convai/reset-agents.
router.get("/voice/convai/health", requireAdmin, async (_req, res): Promise<void> => {
  const checkedAt = new Date().toISOString();
  const types: AgentType[] = ["admin", "client", "landing"];

  // Sin caché: una comprobación de salud debe reflejar el estado real ahora.
  _voiceCheckCache.clear();
  _subscriptionCache = null;

  let voiceId: string | null = null;
  let voiceError: { code?: string; error: string } | null = null;
  try {
    voiceId = await resolveVerifiedConvAIVoiceId();
  } catch (err: any) {
    voiceError = { code: isConvAIVoiceError(err) ? err.code : undefined, error: err?.message || "Error comprobando la voz" };
  }

  const agents: ConvAIAgentHealth[] = [];
  for (const type of types) {
    const cacheKey = `convai_${type}_agent_id`;
    // No solapar con una resolución de llamada en curso (single-flight): leer después.
    const inFlight = _agentResolveInFlight[type];
    if (inFlight) await inFlight.catch(() => undefined);

    let agentId: string | null = null;
    try {
      agentId = await findExistingConvAIAgentId(type);
    } catch (err: any) {
      agents.push({ type, agentId: null, status: "error", error: `No se pudo leer el agente: ${err?.message}` });
      continue;
    }
    if (!agentId) { agents.push({ type, agentId: null, status: "not_created" }); continue; }
    if (!voiceId) { agents.push({ type, agentId, status: "error", code: voiceError?.code, error: voiceError?.error }); continue; }
    try {
      await verifyPersistedConvAIAgent(agentId, voiceId);
      agents.push({ type, agentId, status: "ok" });
    } catch (err: any) {
      const code = isConvAIVoiceError(err) ? err.code : undefined;
      if (code === "agent_config_mismatch") {
        // La config guardada difiere de la nuestra (p. ej. editada en el dashboard de
        // ElevenLabs). Invalidar la caché en memoria garantiza que la siguiente llamada
        // vuelva a sincronizar + verificar antes de emitir la URL firmada.
        delete _agentIdCache[cacheKey];
        agents.push({ type, agentId, status: "drift", code, error: err?.message });
      } else {
        // Agente borrado en ElevenLabs, API caída, etc.: la llamada fallaría.
        delete _agentIdCache[cacheKey];
        agents.push({ type, agentId, status: "error", code, error: err?.message || "Error verificando el agente" });
      }
    }
  }

  const healthy = !voiceError && agents.every(a => a.status === "ok" || a.status === "not_created");
  const degraded = !healthy && !voiceError && agents.every(a => a.status !== "error");
  res.json({
    healthy,
    degraded,
    checkedAt,
    voice: { voiceId, ok: !voiceError, code: voiceError?.code, error: voiceError?.error },
    agents,
  });
});

router.get("/voice/convai/signed-url", requireAdmin, async (req, res): Promise<void> => {
  try {
    const { agentId } = req.query;
    if (!agentId || typeof agentId !== "string") { res.status(400).json({ error: "agentId requerido" }); return; }
    const signed_url = await getConvAISignedUrl(agentId);
    res.json({ signed_url });
  } catch (err: any) {
    res.status(500).json({ error: err?.message || "Error obteniendo URL firmada" });
  }
});

router.get("/voice/convai/conversations", requireAdmin, async (req, res): Promise<void> => {
  try {
    const { agentId } = req.query;
    const conversations = await listConvAIConversations(typeof agentId === "string" ? agentId : undefined);
    res.json({ conversations });
  } catch (err: any) {
    res.status(500).json({ error: err?.message || "Error listando conversaciones" });
  }
});

// ─── PRONUNCIATION DICTIONARIES ───────────────────────────────────────────────
router.get("/voice/pronunciation-dicts", requireAdmin, async (_req, res): Promise<void> => {
  try {
    const dicts = await listPronunciationDictionaries();
    res.json({ dictionaries: dicts });
  } catch (err: any) {
    res.status(500).json({ error: err?.message || "Error listando diccionarios" });
  }
});

router.post("/voice/pronunciation-dicts", requireAdmin, async (req, res): Promise<void> => {
  try {
    const { name, description, rules } = req.body ?? {};
    if (!name || typeof name !== "string" || name.trim().length < 2) {
      res.status(400).json({ error: "name requerido" }); return;
    }
    if (!Array.isArray(rules) || rules.length === 0) {
      res.status(400).json({ error: "rules requerido (array de reglas)" }); return;
    }
    const dict = await createPronunciationDictionary(name.trim(), rules as PronunciationRule[], description?.trim());
    res.json({ success: true, dictionary: dict });
  } catch (err: any) {
    logger.error({ err: err?.message }, "pronunciation-dicts create failed");
    res.status(500).json({ error: err?.message || "Error creando diccionario" });
  }
});

router.post("/voice/pronunciation-dicts/:id/add-rules", requireAdmin, async (req, res): Promise<void> => {
  try {
    const { rules } = req.body ?? {};
    if (!Array.isArray(rules) || rules.length === 0) { res.status(400).json({ error: "rules requerido" }); return; }
    const result = await addRulesToPronunciationDictionary(req.params.id as string, rules as PronunciationRule[]);
    res.json({ success: true, ...result });
  } catch (err: any) {
    res.status(500).json({ error: err?.message || "Error añadiendo reglas" });
  }
});

router.post("/voice/pronunciation-dicts/:id/remove-rules", requireAdmin, async (req, res): Promise<void> => {
  try {
    const { rule_strings } = req.body ?? {};
    if (!Array.isArray(rule_strings) || rule_strings.length === 0) { res.status(400).json({ error: "rule_strings requerido" }); return; }
    const result = await removeRulesFromPronunciationDictionary(req.params.id as string, rule_strings as string[]);
    res.json({ success: true, ...result });
  } catch (err: any) {
    res.status(500).json({ error: err?.message || "Error eliminando reglas" });
  }
});

router.delete("/voice/pronunciation-dicts/:id", requireAdmin, async (req, res): Promise<void> => {
  try {
    await deletePronunciationDictionary(req.params.id as string);
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err?.message || "Error eliminando diccionario" });
  }
});

// ─── Gemini TTS (Live, humanizada, sin delay) ────────────────────────────────
function pcm16ToWav(pcmData: Buffer, sampleRate = 24000, channels = 1): Buffer {
  const bitDepth = 16;
  const byteRate = sampleRate * channels * (bitDepth / 8);
  const blockAlign = channels * (bitDepth / 8);
  const dataSize = pcmData.length;
  const header = Buffer.alloc(44);
  header.write("RIFF", 0);
  header.writeUInt32LE(36 + dataSize, 4);
  header.write("WAVE", 8);
  header.write("fmt ", 12);
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20);           // PCM
  header.writeUInt16LE(channels, 22);
  header.writeUInt32LE(sampleRate, 24);
  header.writeUInt32LE(byteRate, 28);
  header.writeUInt16LE(blockAlign, 32);
  header.writeUInt16LE(bitDepth, 34);
  header.write("data", 36);
  header.writeUInt32LE(dataSize, 40);
  return Buffer.concat([header, pcmData]);
}

const GEMINI_TTS_VOICES = ["Aoede", "Kore", "Charon", "Fenrir", "Puck", "Orbit", "Zephyr", "Leda"] as const;

router.post("/voice/gemini-tts", async (req, res): Promise<void> => {
  try {
    const userId = (req.session as any)?.userId;
    if (!userId) { res.status(401).json({ error: "No autenticado" }); return; }

    const { text, voice = "Aoede" } = req.body ?? {};
    if (!text || typeof text !== "string" || text.trim().length === 0) {
      res.status(400).json({ error: "text requerido" }); return;
    }
    if (text.length > 700) {
      res.status(413).json({ error: "text excede 700 caracteres" }); return;
    }
    const cleaned = text.trim().slice(0, 700);

    const quota = checkTtsQuota(String(userId) + ":gemini", cleaned.length);
    if (!quota.ok) {
      res.setHeader("Retry-After", String(quota.retryAfter));
      res.status(429).json({ error: quota.reason }); return;
    }

    const safeVoice = (GEMINI_TTS_VOICES as readonly string[]).includes(voice) ? voice : "Aoede";
    const geminiKey = process.env.GEMINI_API_KEY ?? process.env.AI_INTEGRATIONS_GEMINI_API_KEY;
    if (!geminiKey) { res.status(503).json({ error: "Gemini no configurado" }); return; }

    const { GoogleGenAI } = await import("@google/genai");
    const ai = new GoogleGenAI({ apiKey: geminiKey });

    const response = await (ai.models as any).generateContent({
      model: "gemini-2.5-flash-preview-tts",
      contents: [{ parts: [{ text: cleaned }] }],
      config: {
        responseModalities: ["AUDIO"],
        speechConfig: {
          voiceConfig: { prebuiltVoiceConfig: { voiceName: safeVoice } },
        },
      },
    });

    const part = response?.candidates?.[0]?.content?.parts?.[0];
    if (!part?.inlineData?.data) {
      res.status(502).json({ error: "Gemini TTS no devolvió audio" }); return;
    }

    const mimeType: string = part.inlineData.mimeType || "audio/L16;rate=24000";
    const pcmBuffer = Buffer.from(part.inlineData.data as string, "base64");
    const rateMatch = mimeType.match(/rate=(\d+)/);
    const sampleRate = rateMatch ? parseInt(rateMatch[1], 10) : 24000;

    const wavBuffer = pcm16ToWav(pcmBuffer, sampleRate);
    res.setHeader("Content-Type", "audio/wav");
    res.setHeader("Content-Length", String(wavBuffer.length));
    res.setHeader("Cache-Control", "no-cache");
    res.send(wavBuffer);
  } catch (err: any) {
    logger.error({ err: err?.message }, "gemini-tts failed");
    if (!res.headersSent) res.status(500).json({ error: "Error generando voz con Gemini Live" });
  }
});

// ────────────────────────────────────────────────────────────
// SOUND EFFECTS (ElevenLabs SFX)
// ────────────────────────────────────────────────────────────
router.post("/voice/sfx", async (req, res): Promise<void> => {
  try {
    const { text, durationSeconds, promptInfluence } = req.body as {
      text: string;
      durationSeconds?: number;
      promptInfluence?: number;
    };
    if (!text?.trim()) {
      res.status(400).json({ error: "El campo 'text' es requerido" });
      return;
    }
    const result = await generateSoundEffect(text, durationSeconds, promptInfluence);
    res.setHeader("Content-Type", result.contentType);
    res.setHeader("Content-Disposition", 'attachment; filename="sfx.mp3"');
    res.setHeader("Cache-Control", "no-cache");
    res.send(result.audio);
  } catch (err: any) {
    logger.error({ err: err?.message }, "sfx generation failed");
    res.status(500).json({ error: err?.message ?? "Error generando efecto de sonido" });
  }
});

export default router;
