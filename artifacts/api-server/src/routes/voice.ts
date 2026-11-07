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
import {
  CONVAI_TTS_DEFAULTS, CONVAI_TTS_KV_KEYS, CONVAI_TTS_LIMITS, CONVAI_TTS_PREVIEW_MAX_CHARS, CONVAI_TTS_PREVIEW_TEXT,
  ConvAITtsSettingsError, normalizeConvAITtsSettings, parseConvAITtsHistory, parseStoredConvAITtsSettings,
  type ConvAITtsSettings, type StoredConvAITtsSettings,
} from "../lib/convai-voice-settings.js";
import multer from "multer";

const cloneUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 25 * 1024 * 1024, files: 10 },
  fileFilter: (_req, file, cb) => {
    if (/^audio\//i.test(file.mimetype) || /\.(mp3|wav|m4a|ogg|flac|aac|webm)$/i.test(file.originalname)) {
      cb(null, true);
    } else {
      cb(uploadRejected("Solo se admiten archivos de audio (mp3, wav, m4a, ogg, flac)"));
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
      cb(uploadRejected("Solo se admiten archivos de audio o vídeo"));
    }
  },
});
import { logger } from "../lib/logger.js";
import { recommendVoiceForProduct, type VoiceGenderPref, type VoiceLanguage } from "../lib/voice-recommender.js";
import { requireAdmin } from "../lib/auth.js";
import { uploadRejected } from "../lib/upload-errors.js";
import { recordGeminiResponseUsage } from "../lib/api-usage.js";

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

// Cuota de TTS por usuario en PostgreSQL (antes en memoria: se reiniciaba con cada
// despliegue y cada instancia de autoscale llevaba su propia cuenta).
const TTS_WINDOW_MS = 60 * 1000;
const TTS_MAX_REQUESTS_PER_MIN = 10;
const TTS_MAX_CHARS_PER_HOUR = 50_000;
const HOUR_MS = 60 * 60 * 1000;

let ttsQuotaReady: Promise<unknown> | null = null;
function ensureTtsQuotaTable(): Promise<unknown> {
  ttsQuotaReady ??= db.execute(sql`
    CREATE TABLE IF NOT EXISTS tts_quota (
      user_key TEXT PRIMARY KEY,
      window_start TIMESTAMPTZ NOT NULL,
      count INTEGER NOT NULL,
      hour_start TIMESTAMPTZ NOT NULL,
      chars_hour INTEGER NOT NULL
    )
  `).catch(err => { ttsQuotaReady = null; throw err; });
  return ttsQuotaReady;
}

export async function checkTtsQuota(userId: string, chars: number): Promise<{ ok: true } | { ok: false; reason: string; retryAfter: number }> {
  await ensureTtsQuotaTable();
  // Una sola sentencia atómica: reinicia ventanas caducadas y suma solo si cabe.
  const r = await db.execute(sql`
    INSERT INTO tts_quota (user_key, window_start, count, hour_start, chars_hour)
    VALUES (${userId}, NOW(), 0, NOW(), 0)
    ON CONFLICT (user_key) DO UPDATE SET
      window_start = CASE WHEN tts_quota.window_start < NOW() - ${`${TTS_WINDOW_MS} milliseconds`}::interval THEN NOW() ELSE tts_quota.window_start END,
      count        = CASE WHEN tts_quota.window_start < NOW() - ${`${TTS_WINDOW_MS} milliseconds`}::interval THEN 0 ELSE tts_quota.count END,
      hour_start   = CASE WHEN tts_quota.hour_start < NOW() - ${`${HOUR_MS} milliseconds`}::interval THEN NOW() ELSE tts_quota.hour_start END,
      chars_hour   = CASE WHEN tts_quota.hour_start < NOW() - ${`${HOUR_MS} milliseconds`}::interval THEN 0 ELSE tts_quota.chars_hour END
    RETURNING count, chars_hour,
      EXTRACT(EPOCH FROM (window_start + ${`${TTS_WINDOW_MS} milliseconds`}::interval - NOW())) AS win_left,
      EXTRACT(EPOCH FROM (hour_start + ${`${HOUR_MS} milliseconds`}::interval - NOW())) AS hour_left
  `);
  const row = r.rows[0] as { count: number; chars_hour: number; win_left: string; hour_left: string };
  if (Number(row.count) >= TTS_MAX_REQUESTS_PER_MIN) {
    return { ok: false, reason: "Demasiadas peticiones de voz. Espera un momento.", retryAfter: Math.max(1, Math.ceil(Number(row.win_left))) };
  }
  if (Number(row.chars_hour) + chars > TTS_MAX_CHARS_PER_HOUR) {
    return { ok: false, reason: `Cuota horaria de TTS excedida (${TTS_MAX_CHARS_PER_HOUR} caracteres/hora).`, retryAfter: Math.max(1, Math.ceil(Number(row.hour_left))) };
  }
  await db.execute(sql`UPDATE tts_quota SET count = count + 1, chars_hour = chars_hour + ${chars} WHERE user_key = ${userId}`);
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
    const quota = await checkTtsQuota(String(userId), text.length);
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
      res.status(/no configurad/i.test(msg) ? 503 : 500).json({ error: msg });
    }
  }
});

router.post("/voice/command", requireAdmin, async (req, res): Promise<void> => {
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
    if (/no configurad/i.test(String(err?.message))) {
      res.json({ voices: [], configured: false, error: err.message });
      return;
    }
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

Datos reales y actuales de SU tienda (del panel de Shopy Crafter, solo de este cliente):
{{store_context}}
Usa EXCLUSIVAMENTE esos datos para cualquier cifra. Si algo no aparece ahí, dilo con naturalidad y no inventes números.

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

// ── Ajustes de voz de Arturo ──────────────────────────────────────────────────
// These are the fields ElevenLabs actually persists under conversation_config.tts
// (flat, not inside a voice_settings block). Verified on the live API.
// They live in platform_settings_kv (keys convai_tts_*) so the admin can tune
// them from the panel; CONVAI_TTS_DEFAULTS (0.5 / 0.8 / 1.2, chosen by the
// owner after A/B listening in Sept 2026) apply when nothing is stored.
// Cached in-process and invalidated on save; a short TTL covers edits made
// from another instance.
const TTS_SETTINGS_TTL_MS = 60 * 1000;
let _ttsSettingsCache: { at: number; value: StoredConvAITtsSettings } | null = null;
let _ttsSettingsRevision = 0;
const _agentSyncedRevision: Partial<Record<AgentType, number>> = {};
const _agentSyncedDatabaseRevision: Partial<Record<AgentType, string>> = {};

async function getConvAIDatabaseRevision(type: AgentType): Promise<string> {
  const keys = [...Object.values(CONVAI_TTS_KV_KEYS), `convai_${type}_agent_id`];
  const result = await db.execute(sql`
    SELECT md5(COALESCE(string_agg(
      key || ':' || COALESCE(value, '') || ':' || COALESCE(updated_at::text, ''),
      '|' ORDER BY key
    ), '')) AS revision
    FROM platform_settings_kv
    WHERE key IN (${sql.join(keys.map(key => sql`${key}`), sql`, `)})
  `);
  const revision = (result as any).rows?.[0]?.revision;
  if (typeof revision !== "string") throw new Error("No se pudo comprobar la versión compartida de la voz.");
  return revision;
}

async function getConvAITtsSettingsStored(): Promise<StoredConvAITtsSettings> {
  if (_ttsSettingsCache && Date.now() - _ttsSettingsCache.at < TTS_SETTINGS_TTL_MS) return _ttsSettingsCache.value;
  const revision = _ttsSettingsRevision;
  let rows: Array<{ key: string; value: string | null }> = [];
  try {
    await ensurePlatformSettingsKV();
    const keys = Object.values(CONVAI_TTS_KV_KEYS);
    const r = await db.execute(sql`
      SELECT key, value FROM platform_settings_kv
      WHERE key IN (${sql.join(keys.map(k => sql`${k}`), sql`, `)})
    `);
    rows = ((r as any).rows ?? (Array.isArray(r) ? r : [])) as Array<{ key: string; value: string | null }>;
  } catch (e) {
    // Sin BD seguimos con los defaults: una llamada de voz no debe caerse por esto.
    logger.warn({ err: (e as Error)?.message }, "ConvAI: could not read TTS settings from DB; using defaults");
  }
  const parsed = parseStoredConvAITtsSettings(rows);
  // A DB read started before a save must not repopulate the cache with old rows.
  if (revision !== _ttsSettingsRevision) return getConvAITtsSettingsStored();
  if (parsed.invalid.length) {
    logger.warn({ invalid: parsed.invalid }, "ConvAI: ignoring invalid stored TTS settings (using defaults for those keys)");
  }
  _ttsSettingsCache = { at: Date.now(), value: parsed };
  return parsed;
}

async function getConvAITtsSettings(): Promise<ConvAITtsSettings> {
  return (await getConvAITtsSettingsStored()).settings;
}

async function ensureConvAITtsHistoryTable(): Promise<void> {
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS convai_tts_settings_history (
      id BIGSERIAL PRIMARY KEY,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      user_id TEXT NOT NULL,
      user_name TEXT,
      user_email TEXT,
      settings JSONB NOT NULL
    )
  `);
}

/** Cambios recientes que muestra la tarjeta compacta. */
const CONVAI_TTS_HISTORY_CARD_SIZE = 5;
/** Página máxima del historial completo (#144). */
const CONVAI_TTS_HISTORY_MAX_PAGE = 50;

/**
 * Historial de cambios de voz, del más reciente al más antiguo. `before` es el
 * id de la última entrada de la página anterior (paginación por cursor sobre
 * created_at + id, estable aunque entren cambios nuevos mientras se navega).
 */
async function getConvAITtsHistoryPage(
  limit: number,
  before?: string,
): Promise<{ entries: ReturnType<typeof parseConvAITtsHistory>; hasMore: boolean }> {
  await ensureConvAITtsHistoryTable();
  const cursor = before
    ? sql`WHERE (created_at, id) < (SELECT created_at, id FROM convai_tts_settings_history WHERE id = ${before})`
    : sql``;
  const result = await db.execute(sql`
    SELECT id, created_at, user_id, user_name, user_email, settings
    FROM convai_tts_settings_history
    ${cursor}
    ORDER BY created_at DESC, id DESC
    LIMIT ${limit + 1}
  `);
  const rows = ((result as any).rows ?? (Array.isArray(result) ? result : [])) as Parameters<typeof parseConvAITtsHistory>[0];
  return { entries: parseConvAITtsHistory(rows.slice(0, limit)), hasMore: rows.length > limit };
}

async function getConvAITtsHistory(): Promise<ReturnType<typeof parseConvAITtsHistory>> {
  return (await getConvAITtsHistoryPage(CONVAI_TTS_HISTORY_CARD_SIZE)).entries;
}

/**
 * Versión de los ajustes de voz guardados (#145): huella de las tres filas
 * convai_tts_* con su updated_at. Cambia con cada guardado, aunque se guarden
 * los mismos valores, así que identifica "lo que el formulario cargó".
 */
async function getConvAITtsSettingsVersion(
  executor: { execute: typeof db.execute } = db,
): Promise<string> {
  const keys = Object.values(CONVAI_TTS_KV_KEYS);
  const result = await executor.execute(sql`
    SELECT md5(COALESCE(string_agg(
      key || ':' || COALESCE(value, '') || ':' || COALESCE(updated_at::text, ''),
      '|' ORDER BY key
    ), '')) AS revision
    FROM platform_settings_kv
    WHERE key IN (${sql.join(keys.map(key => sql`${key}`), sql`, `)})
  `);
  const revision = (result as any).rows?.[0]?.revision;
  if (typeof revision !== "string") throw new Error("No se pudo leer la versión de los ajustes de voz.");
  return revision;
}

/** Otro admin guardó la voz desde que este formulario cargó (#145). */
class ConvAITtsSettingsConflictError extends Error {
  readonly currentVersion: string;
  constructor(currentVersion: string) {
    super("Otro administrador ha cambiado la voz desde que abriste el formulario.");
    this.name = "ConvAITtsSettingsConflictError";
    this.currentVersion = currentVersion;
  }
}

async function saveConvAITtsSettingsWithHistory(
  settings: ConvAITtsSettings,
  actor: { userId: string; name: string; email: string },
  expectedVersion?: string,
): Promise<void> {
  await ensurePlatformSettingsKV();
  await ensureConvAITtsHistoryTable();
  await db.transaction(async (tx) => {
    await tx.execute(sql`SET LOCAL lock_timeout = '75000ms'`);
    // A settings save participates in the same cross-instance locks as agent
    // sync. This makes the save and a provider PATCH/readback serializable.
    for (const type of ["admin", "client", "landing"] as const) {
      await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtextextended(${"convai-agent-sync:" + type}, 0))`);
    }
    // Comprobación optimista bajo los mismos bloqueos: dos admins que guardan a
    // la vez quedan serializados y el segundo ve la versión del primero.
    if (expectedVersion !== undefined) {
      const currentVersion = await getConvAITtsSettingsVersion(tx as unknown as { execute: typeof db.execute });
      if (currentVersion !== expectedVersion) throw new ConvAITtsSettingsConflictError(currentVersion);
    }
    for (const key of Object.keys(CONVAI_TTS_KV_KEYS) as Array<keyof ConvAITtsSettings>) {
      await tx.execute(sql`
        INSERT INTO platform_settings_kv (key, value, updated_at)
        VALUES (${CONVAI_TTS_KV_KEYS[key]}, ${String(settings[key])}, NOW())
        ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()
      `);
    }
    await tx.execute(sql`
      INSERT INTO convai_tts_settings_history (user_id, user_name, user_email, settings)
      VALUES (${actor.userId}, ${actor.name}, ${actor.email}, ${JSON.stringify(settings)}::jsonb)
    `);
  });
  _ttsSettingsRevision++;
  _ttsSettingsCache = null;
  // Force the next voice call to sync the changed values to all ConvAI agents.
  for (const k of Object.keys(_agentIdCache)) delete _agentIdCache[k];
}

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
  // The expected voice settings come from the DB (panel-tunable), so the
  // post-sync verifier keeps detecting drift against what the admin saved.
  const [persisted, tts] = await Promise.all([getConvAIAgent(agentId), getConvAITtsSettings()]);
  assertConvAIAgentConfigApplied(persisted, {
    voiceId,
    modelId: CONVAI_SPANISH_MODEL,
    outputFormat: CONVAI_OUTPUT_FORMAT,
    inputFormat: CONVAI_INPUT_FORMAT,
    stability: tts.stability,
    similarityBoost: tts.similarityBoost,
    speed: tts.speed,
  });
}

async function syncConvAIAgentOrThrow(type: AgentType, agentId: string, voiceId: string): Promise<void> {
  // Keep ownership of the same flight while catching up with saves. Readback
  // can succeed against old settings if it started before the save committed.
  for (;;) {
    const revision = _ttsSettingsRevision;
    try {
      await updateConvAIAgent(agentId, await agentConfigFor(type, voiceId));
      await verifyPersistedConvAIAgent(agentId, voiceId);
    } catch (err) {
      if (revision !== _ttsSettingsRevision) continue;
      throw err;
    }
    if (revision !== _ttsSettingsRevision) continue;
    _agentSyncedRevision[type] = revision;
    _agentSyncedDatabaseRevision[type] = await getConvAIDatabaseRevision(type);
    return;
  }
}

async function verifyCreatedConvAIAgent(
  type: AgentType, agentId: string, voiceId: string, createdRevision: number,
): Promise<void> {
  try {
    await verifyPersistedConvAIAgent(agentId, voiceId);
  } catch (err) {
    if (createdRevision === _ttsSettingsRevision) throw err;
  }
  if (createdRevision !== _ttsSettingsRevision) {
    await syncConvAIAgentOrThrow(type, agentId, voiceId);
  } else {
    _agentSyncedRevision[type] = createdRevision;
    _agentSyncedDatabaseRevision[type] = await getConvAIDatabaseRevision(type);
  }
}

async function withConvAIAgentLock<T>(type: AgentType, action: () => Promise<T>): Promise<T> {
  await ensurePlatformSettingsKV();
  return db.transaction(async (tx) => {
    // If another process dies, Postgres rolls back its transaction and releases
    // the advisory lock. Waiting requests fail explicitly rather than hanging
    // forever if a live owner stops making progress.
    await tx.execute(sql`SET LOCAL lock_timeout = '75000ms'`);
    await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtextextended(${"convai-agent-sync:" + type}, 0))`);
    // Another API instance may have saved settings while this process's cache
    // was warm. Refresh only after owning the lock.
    _ttsSettingsCache = null;
    return action();
  });
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

async function agentConfigFor(type: AgentType, voiceId: string): Promise<ConvAIAgentConfig> {
  const ttsSettings = await getConvAITtsSettings();
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

  // Configuración de voz: platform_settings_kv convai_tts_* (editable en el panel),
  // con CONVAI_TTS_DEFAULTS si no hay nada guardado.
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
    // NOTE: ConvAI expects these as FLAT fields under `tts`. A nested
    // `tts.voice_settings{...}` block is silently ignored (verified live: the
    // agent kept stability 0.5 / similarity_boost 0.8 for months). `style` and
    // `use_speaker_boost` do not exist in the persisted agent schema at all.
    stability: ttsSettings.stability,
    similarity_boost: ttsSettings.similarityBoost,
    speed: ttsSettings.speed,
  };

  return {
    name: names[type],
    conversation_config: {
      agent: {
        prompt: { prompt: prompts[type] },
        first_message: first[type],
        language: "es",
        ...(type === "client"
          ? { dynamic_variables: { dynamic_variable_placeholders: { store_context: "Sin datos disponibles de la tienda en este momento." } } }
          : {}),
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

  // A voice-apply may be syncing a cached agent right now. Check the shared
  // work before the ID cache, otherwise a call can receive a URL for the old
  // config while that PATCH + verification is still in progress.
  for (;;) {
    const inFlight = _agentResolveInFlight[type];
    if (inFlight) {
      const agentId = await inFlight;
      if (_agentSyncedRevision[type] === _ttsSettingsRevision) return agentId;
      continue;
    }

    let pending: Promise<string>;
    pending = withConvAIAgentLock(type, async () => {
      // Check shared state under the lock even for a warm local cache: another
      // worker may have saved settings or replaced the persisted agent ID.
      if (_agentIdCache[cacheKey] && _agentSyncedRevision[type] === _ttsSettingsRevision
        && _agentSyncedDatabaseRevision[type] === await getConvAIDatabaseRevision(type)) {
        return _agentIdCache[cacheKey];
      }
      delete _agentIdCache[cacheKey];
      return resolveConvAIAgentUncached(type, cacheKey);
    }).finally(() => {
      if (_agentResolveInFlight[type] === pending) delete _agentResolveInFlight[type];
    });
    _agentResolveInFlight[type] = pending;
    const agentId = await pending;
    if (_agentSyncedRevision[type] === _ttsSettingsRevision) return agentId;
  }
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
  const createdRevision = _ttsSettingsRevision;
  const config = await agentConfigFor(type, voiceId);
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

  await verifyCreatedConvAIAgent(type, newId, voiceId, createdRevision);
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
// Solo admin: el agente "admin" tiene contexto de toda la agencia (todos los
// clientes). Antes cualquier cliente autenticado obtenía su URL firmada, o la de
// cualquier agentId de la cuenta pasándolo por query.
router.get("/voice/convai/call-url", requireAdmin, async (req, res): Promise<void> => {
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

/** Resumen compacto y real del proyecto para el agente de voz del cliente. */
async function buildClientStoreContext(pid: number): Promise<string> {
  const q = async (query: ReturnType<typeof sql>): Promise<any[]> => {
    try { const r = await db.execute(query); return ((r as any).rows ?? []) as any[]; }
    catch (err) { logger.warn({ err, pid }, "voice store context query failed"); return []; }
  };
  const [proj] = await q(sql`SELECT name, shop_domain, platform_type FROM projects WHERE id = ${pid}`);
  if (!proj) return "Sin proyecto vinculado.";
  const [prod] = await q(sql`SELECT COUNT(*)::int AS n FROM products WHERE project_id = ${pid}`);
  const [rev] = await q(sql`
    SELECT COALESCE(SUM(revenue),0)::float AS revenue, COALESCE(SUM(orders),0)::int AS orders, COUNT(*)::int AS days
    FROM revenue_snapshots WHERE project_id = ${String(pid)} AND date >= to_char(NOW() - INTERVAL '30 days', 'YYYY-MM-DD')`);
  const [appr] = await q(sql`SELECT COUNT(*)::int AS n FROM approvals WHERE project_id = ${String(pid)} AND status = 'pending'`);
  const stock = await q(sql`
    SELECT product_title, current_stock FROM inventory_tracking
    WHERE project_id = ${String(pid)} AND status IN ('critical','warning')
    ORDER BY days_remaining ASC NULLS LAST LIMIT 5`);
  const [audit] = await q(sql`SELECT overall_score, audited_at FROM audit_results WHERE project_id = ${pid} ORDER BY audited_at DESC LIMIT 1`);
  const lines = [
    `Tienda: ${proj.name ?? "—"} (${proj.shop_domain ?? "—"}, ${proj.platform_type ?? "shopify"}).`,
    `Productos en catálogo: ${prod?.n ?? 0}.`,
    rev && rev.days > 0
      ? `Últimos 30 días (${rev.days} días con datos): ventas ${Number(rev.revenue).toFixed(2)} €, ${rev.orders} pedidos.`
      : "Ventas últimos 30 días: sin datos sincronizados todavía.",
    `Propuestas pendientes de aprobar: ${appr?.n ?? 0}.`,
    stock.length
      ? `Stock bajo: ${stock.map(s => `${s.product_title} (${s.current_stock ?? "?"} uds)`).join("; ")}.`
      : "Sin alertas de stock.",
    audit ? `Última auditoría web: ${Math.round(Number(audit.overall_score ?? 0))}/100.` : "Sin auditoría web registrada.",
  ];
  return lines.join("\n");
}

// ── Client voice call — informes + Q&A (clientes autenticados) ────────────────
router.get("/voice/client-call-url", async (req, res): Promise<void> => {
  const userId = (req.session as any)?.userId;
  if (!userId) { res.status(401).json({ error: "Not authenticated" }); return; }
  try {
    const agentId = await getOrCreateConvAIAgent("client");
    const signed_url = await getConvAISignedUrl(agentId);
    // Datos reales del proyecto de la sesión (antes el agente prometía ventas y
    // stock pero no recibía ningún dato: respondía a ciegas).
    const session = req.session as any;
    const pid = Number(session.role === "admin" ? req.query.pid : session.clientId);
    const store_context = Number.isInteger(pid) && pid > 0 ? await buildClientStoreContext(pid) : "Sin proyecto vinculado.";
    res.json({ signed_url, agentId, mode: "client", dynamic_variables: { store_context } });
  } catch (err: any) {
    logger.error({ err: err?.message, code: err?.code }, "client-call-url failed");
    respondCallUrlError(res, err, "Error obteniendo URL de llamada");
  }
});

// ── Reset + re-create ConvAI agents (apply new voice/prompts) ─────────────────
router.post("/voice/convai/reset-agents", requireAdmin, async (req, res): Promise<void> => {
  const allTypes: AgentType[] = ["admin", "client", "landing"];
  const requestedTypes = req.body?.agentTypes;
  if (
    requestedTypes !== undefined
    && (!Array.isArray(requestedTypes)
      || requestedTypes.length === 0
      || requestedTypes.some((type: unknown) => !allTypes.includes(type as AgentType))
      || new Set(requestedTypes).size !== requestedTypes.length)
  ) {
    res.status(400).json({ error: "agentTypes debe ser una lista no vacía de tipos de agente válidos, sin duplicados." });
    return;
  }
  const types: AgentType[] = requestedTypes ?? allTypes;

  try {
    await ensurePlatformSettingsKV();
    const results: Record<string, string> = {};
    _sevillanoVoiceIdCache = null; // Force re-resolve voice

    for (const type of types) {
      const cacheKey = `convai_${type}_agent_id`;

      // Publicar el reset antes de esperar cualquier trabajo previo. Así, tanto
      // llamadas como voice-settings/apply que lleguen durante el reinicio esperan
      // también a la verificación del agente, incluido el admin fijado por entorno.
      const previous = _agentResolveInFlight[type];
      const work = Promise.resolve().then(async (): Promise<string> => {
        if (previous) await previous.catch(() => undefined);

        return withConvAIAgentLock(type, async (): Promise<string> => {
          if (type === "admin" && process.env.ELEVEN_CONVAI_DEFAULT_AGENT_ID) {
            const envId = process.env.ELEVEN_CONVAI_DEFAULT_AGENT_ID;
            delete _agentIdCache[cacheKey];
            const voiceId = await resolveVerifiedConvAIVoiceId();
            await syncConvAIAgentOrThrow(type, envId, voiceId);
            _agentIdCache[cacheKey] = envId;
            logger.info({ type, agentId: envId, voiceId }, "ConvAI env-pinned agent re-synced in place");
            return envId;
          }
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
          const createdRevision = _ttsSettingsRevision;
          const config = await agentConfigFor(type, voiceId);
          const agent = await createConvAIAgent(config);
          const newId = agent.agent_id;
          await db.execute(sql`
            INSERT INTO platform_settings_kv (key, value, updated_at)
            VALUES (${cacheKey}, ${newId}, NOW())
            ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()
          `);
          await verifyCreatedConvAIAgent(type, newId, voiceId, createdRevision);
          _agentIdCache[cacheKey] = newId;
          logger.info({ type, agentId: newId, voiceId }, "ConvAI agent reset+recreated");
          return newId;
        });
      });
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

// ── Agentes ConvAI huérfanos / duplicados (#88) ───────────────────────────────
// Restos de resets antiguos ("Arturo — Secretario…" repetidos, "ShopyBrain —
// Asistente Admin") que ya no reciben las sincronizaciones de voz/prompt. Se
// listan con vista previa y solo se borran con confirmación explícita del admin.
// NUNCA se borra un agente referenciado en platform_settings_kv (cualquier clave)
// ni el fijado por ELEVEN_CONVAI_DEFAULT_AGENT_ID, ni agentes creados a mano.
const MANAGED_AGENT_NAME_PREFIXES = ["Arturo — Secretario", "ShopyBrain —"];

function isPlatformManagedAgentName(name: unknown): boolean {
  return typeof name === "string" && MANAGED_AGENT_NAME_PREFIXES.some(prefix => name.startsWith(prefix));
}

export type ConvAIAgentAuditEntry = {
  agentId: string;
  name: string;
  createdAt: string | null;
  /** Claves de platform_settings_kv (o "env:ELEVEN_CONVAI_DEFAULT_AGENT_ID") que lo usan. */
  references: string[];
  /** in_use: referenciado · orphan: de la plataforma y sin referencia · custom: creado a mano. */
  status: "in_use" | "orphan" | "custom";
};

async function auditConvAIAgents(executor: { execute: typeof db.execute } = db): Promise<ConvAIAgentAuditEntry[]> {
  const agents = await listConvAIAgents();
  const ids = agents.map(agent => agent.agent_id).filter((id): id is string => typeof id === "string" && id.length > 0);
  const references = new Map<string, string[]>();
  const addRef = (id: string, ref: string) => references.set(id, [...(references.get(id) ?? []), ref]);
  if (ids.length) {
    await ensurePlatformSettingsKV();
    const rows = await executor.execute(sql`
      SELECT key, value FROM platform_settings_kv
      WHERE value IN (${sql.join(ids.map(id => sql`${id}`), sql`, `)})
    `);
    for (const row of ((rows as any).rows ?? []) as Array<{ key: string; value: string }>) addRef(row.value, row.key);
  }
  const pinned = process.env.ELEVEN_CONVAI_DEFAULT_AGENT_ID?.trim();
  if (pinned) addRef(pinned, "env:ELEVEN_CONVAI_DEFAULT_AGENT_ID");
  for (const [key, id] of Object.entries(_agentIdCache)) {
    if (id && !(references.get(id) ?? []).includes(key)) addRef(id, key);
  }
  return agents.map(agent => {
    const refs = references.get(agent.agent_id) ?? [];
    return {
      agentId: agent.agent_id,
      name: agent.name ?? "",
      createdAt: typeof agent.created_at_unix_secs === "number" ? new Date(agent.created_at_unix_secs * 1000).toISOString() : null,
      references: refs,
      status: refs.length ? "in_use" : isPlatformManagedAgentName(agent.name) ? "orphan" : "custom",
    };
  });
}

router.get("/voice/convai/orphans", requireAdmin, async (_req, res): Promise<void> => {
  try {
    const agents = await auditConvAIAgents();
    const byName = new Map<string, number>();
    for (const agent of agents) byName.set(agent.name, (byName.get(agent.name) ?? 0) + 1);
    res.json({
      agents,
      orphanIds: agents.filter(agent => agent.status === "orphan").map(agent => agent.agentId),
      duplicateNames: [...byName].filter(([, count]) => count > 1).map(([name, count]) => ({ name, count })),
    });
  } catch (err: any) {
    logger.error({ err: err?.message }, "convai/orphans audit failed");
    res.status(500).json({ error: err?.message || "Error revisando los agentes de ElevenLabs" });
  }
});

router.post("/voice/convai/orphans/delete", requireAdmin, async (req, res): Promise<void> => {
  const agentIds = req.body?.agentIds;
  if (req.body?.confirm !== true) {
    res.status(400).json({ error: "Falta la confirmación explícita (confirm: true)." });
    return;
  }
  if (!Array.isArray(agentIds) || agentIds.length === 0 || agentIds.length > 50
    || agentIds.some((id: unknown) => typeof id !== "string" || !id.trim())
    || new Set(agentIds).size !== agentIds.length) {
    res.status(400).json({ error: "agentIds debe ser una lista no vacía (máx. 50) de IDs distintos." });
    return;
  }
  try {
    await ensurePlatformSettingsKV();
    type DeleteResult = { agentId: string; status: "deleted" | "error"; error?: string };
    const outcome = await db.transaction(async (tx) => {
      await tx.execute(sql`SET LOCAL lock_timeout = '75000ms'`);
      // Mismos bloqueos que reset/llamadas: ningún agente puede pasar a estar en
      // uso entre la comprobación y el borrado.
      for (const type of ["admin", "client", "landing"] as const) {
        await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtextextended(${"convai-agent-sync:" + type}, 0))`);
      }
      const audit = await auditConvAIAgents(tx as unknown as { execute: typeof db.execute });
      const byId = new Map(audit.map(agent => [agent.agentId, agent]));
      const refused = (agentIds as string[])
        .map(id => ({ agentId: id, agent: byId.get(id) }))
        .filter(({ agent }) => agent?.status !== "orphan")
        .map(({ agentId, agent }) => ({
          agentId,
          reason: !agent ? "not_found" : agent.status === "in_use" ? "referenced" : "custom",
          references: agent?.references ?? [],
        }));
      const results: DeleteResult[] = [];
      // La vista previa estaba desactualizada: no se borra NADA.
      if (refused.length) return { refused, results };
      for (const id of agentIds as string[]) {
        try {
          await deleteConvAIAgent(id);
          results.push({ agentId: id, status: "deleted" });
        } catch (err: any) {
          results.push({ agentId: id, status: "error", error: err?.message || "Error borrando el agente" });
        }
      }
      return { refused, results };
    });
    if (outcome.refused.length) {
      res.status(409).json({
        error: "Algunos agentes ya no son huérfanos o no existen; no se ha borrado ninguno. Vuelve a revisar.",
        refused: outcome.refused,
      });
      return;
    }
    logger.info({ results: outcome.results }, "ConvAI orphan agents cleanup");
    const failed = outcome.results.some(result => result.status === "error");
    res.status(failed ? 502 : 200).json({ success: !failed, results: outcome.results });
  } catch (err: any) {
    logger.error({ err: err?.message }, "convai/orphans delete failed");
    res.status(500).json({ error: err?.message || "Error borrando agentes huérfanos" });
  }
});

// ── Ajustes de voz de Arturo (stability / similarity_boost / speed) ───────────
// Persistidos en platform_settings_kv para afinar la voz desde el panel sin
// redesplegar. Guardar invalida la caché; "Guardar y aplicar ahora" sincroniza
// los agentes existentes en sitio y verifica lo persistido en ElevenLabs.
// ── Último informe de "aplicar a los agentes" (#150) ──────────────────────────
// Se guarda en platform_settings_kv para que el admin, al volver al panel, vea
// qué agentes fallaron y pueda reintentar solo esos sin volver a guardar. Solo
// vale para la versión de ajustes con la que se generó: tras un guardado nuevo
// el informe antiguo deja de mostrarse.
const CONVAI_APPLY_REPORT_KEY = "convai_voice_apply_report";

type VoiceApplyAgentResult = {
  agentId: string | null;
  status: "applied" | "not_created" | "error";
  error?: string;
  sharedFlight?: boolean;
  /** Momento en que se obtuvo este resultado concreto (un reintento solo actualiza los suyos). */
  at?: string;
};

export interface ConvAIVoiceApplyReport {
  settingsVersion: string;
  updatedAt: string;
  updatedBy: string;
  agents: Partial<Record<AgentType, VoiceApplyAgentResult>>;
}

async function readConvAIVoiceApplyReport(): Promise<ConvAIVoiceApplyReport | null> {
  try {
    await ensurePlatformSettingsKV();
    const rows = await db.execute(sql`SELECT value FROM platform_settings_kv WHERE key = ${CONVAI_APPLY_REPORT_KEY}`);
    const raw = ((rows as any).rows ?? [])[0]?.value;
    if (typeof raw !== "string" || !raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed.settingsVersion !== "string" || typeof parsed.agents !== "object" || !parsed.agents) return null;
    return parsed as ConvAIVoiceApplyReport;
  } catch (err) {
    logger.warn({ err: (err as Error)?.message }, "ConvAI: could not read the last voice apply report");
    return null;
  }
}

async function persistConvAIVoiceApplyReport(
  agents: Partial<Record<AgentType, VoiceApplyAgentResult>>,
  partial: boolean,
  actor: string,
): Promise<ConvAIVoiceApplyReport | null> {
  try {
    const settingsVersion = await getConvAITtsSettingsVersion();
    const previous = partial ? await readConvAIVoiceApplyReport() : null;
    const at = new Date().toISOString();
    const stamped = Object.fromEntries(
      Object.entries(agents).map(([type, result]) => [type, { ...result, at }]),
    ) as ConvAIVoiceApplyReport["agents"];
    const report: ConvAIVoiceApplyReport = {
      settingsVersion,
      updatedAt: at,
      updatedBy: actor,
      // Un reintento de los fallidos conserva los que ya se aplicaron con ESTA versión.
      agents: previous && previous.settingsVersion === settingsVersion ? { ...previous.agents, ...stamped } : stamped,
    };
    await db.execute(sql`
      INSERT INTO platform_settings_kv (key, value, updated_at)
      VALUES (${CONVAI_APPLY_REPORT_KEY}, ${JSON.stringify(report)}, NOW())
      ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()
    `);
    return report;
  } catch (err) {
    // El informe es una ayuda del panel: no convertir un apply correcto en error.
    logger.warn({ err: (err as Error)?.message }, "ConvAI: could not persist the voice apply report");
    return null;
  }
}

async function respondTtsSettings(res: import("express").Response, extra: Record<string, unknown> = {}): Promise<void> {
  const stored = await getConvAITtsSettingsStored();
  const [history, version, lastApply] = await Promise.all([
    getConvAITtsHistory(),
    getConvAITtsSettingsVersion(),
    readConvAIVoiceApplyReport(),
  ]);
  res.json({
    settings: stored.settings,
    source: stored.source,
    invalid: stored.invalid,
    history,
    version,
    lastApply: lastApply && lastApply.settingsVersion === version ? lastApply : null,
    defaults: CONVAI_TTS_DEFAULTS,
    limits: CONVAI_TTS_LIMITS,
    voiceId: await resolveSevillanoVoiceId(),
    modelId: CONVAI_SPANISH_MODEL,
    previewText: CONVAI_TTS_PREVIEW_TEXT,
    ...extra,
  });
}

router.get("/voice/convai/voice-settings", requireAdmin, async (_req, res): Promise<void> => {
  try {
    _ttsSettingsCache = null; // el panel debe ver lo que hay en BD ahora mismo
    await respondTtsSettings(res);
  } catch (err: any) {
    logger.error({ err: err?.message }, "convai/voice-settings read failed");
    res.status(500).json({ error: err?.message || "Error leyendo los ajustes de voz" });
  }
});

router.put("/voice/convai/voice-settings", requireAdmin, async (req, res): Promise<void> => {
  let settings: ConvAITtsSettings;
  try {
    settings = normalizeConvAITtsSettings(req.body);
  } catch (err: any) {
    if (err instanceof ConvAITtsSettingsError) {
      res.status(400).json({ error: err.message, field: err.field });
      return;
    }
    res.status(400).json({ error: err?.message || "Ajustes de voz inválidos" });
    return;
  }
  // Versión que cargó el formulario (#145). Sin ella (scripts, clientes antiguos)
  // se guarda como antes; el panel la envía siempre.
  const rawVersion = req.body?.expectedVersion ?? req.get("If-Match")?.replace(/^W\//, "").replace(/"/g, "");
  if (rawVersion !== undefined && (typeof rawVersion !== "string" || !rawVersion.trim())) {
    res.status(400).json({ error: "expectedVersion debe ser la versión devuelta al cargar los ajustes." });
    return;
  }
  const expectedVersion = typeof rawVersion === "string" ? rawVersion.trim() : undefined;
  try {
    await saveConvAITtsSettingsWithHistory(settings, {
      userId: req.session.userId!,
      name: req.session.name || "Admin",
      email: req.session.email || "",
    }, expectedVersion);
    logger.info({ settings }, "ConvAI TTS settings saved from admin panel; agent cache invalidated");
    await respondTtsSettings(res, { saved: true });
  } catch (err: any) {
    if (err instanceof ConvAITtsSettingsConflictError) {
      // No se guarda nada: el admin decide si recarga o confirma sobre lo nuevo.
      _ttsSettingsCache = null;
      try {
        const stored = await getConvAITtsSettingsStored();
        const [history, version] = await Promise.all([getConvAITtsHistory(), getConvAITtsSettingsVersion()]);
        res.status(409).json({
          error: err.message,
          code: "voice_settings_conflict",
          current: { settings: stored.settings, source: stored.source, version, lastChange: history[0] ?? null },
        });
      } catch (readErr: any) {
        res.status(409).json({ error: err.message, code: "voice_settings_conflict", current: { version: err.currentVersion } });
      }
      return;
    }
    logger.error({ err: err?.message }, "convai/voice-settings save failed");
    res.status(500).json({ error: err?.message || "Error guardando los ajustes de voz" });
  }
});

// Historial completo de cambios de voz (#144), paginado por cursor.
// La tarjeta sigue mostrando los 5 últimos; esto es para ver y restaurar los
// anteriores (la restauración usa el PUT validado normal).
router.get("/voice/convai/voice-settings/history", requireAdmin, async (req, res): Promise<void> => {
  const rawLimit = req.query.limit === undefined ? 20 : Number(req.query.limit);
  if (!Number.isInteger(rawLimit) || rawLimit < 1 || rawLimit > CONVAI_TTS_HISTORY_MAX_PAGE) {
    res.status(400).json({ error: `limit debe ser un entero entre 1 y ${CONVAI_TTS_HISTORY_MAX_PAGE}` });
    return;
  }
  const before = typeof req.query.before === "string" && req.query.before.trim() ? req.query.before.trim() : undefined;
  if (before !== undefined && !/^\d{1,19}$/.test(before)) {
    res.status(400).json({ error: "before debe ser el id de un cambio del historial" });
    return;
  }
  try {
    const page = await getConvAITtsHistoryPage(rawLimit, before);
    const last = page.entries[page.entries.length - 1];
    res.json({ entries: page.entries, nextCursor: page.hasMore && last ? last.id : null });
  } catch (err: any) {
    logger.error({ err: err?.message }, "convai/voice-settings history failed");
    res.status(500).json({ error: err?.message || "Error leyendo el historial de la voz" });
  }
});

// Aplica los ajustes guardados a los agentes que ya existen, sin recrearlos.
// Las llamadas en curso comparten el mismo single-flight para evitar carreras.
router.post("/voice/convai/voice-settings/apply", requireAdmin, async (req, res): Promise<void> => {
  const allTypes: AgentType[] = ["admin", "client", "landing"];
  const requestedTypes = req.body?.agentTypes;
  if (
    requestedTypes !== undefined
    && (!Array.isArray(requestedTypes)
      || requestedTypes.length === 0
      || requestedTypes.some((type: unknown) => !allTypes.includes(type as AgentType))
      || new Set(requestedTypes).size !== requestedTypes.length)
  ) {
    res.status(400).json({ error: "agentTypes debe ser una lista no vacía de tipos de agente válidos, sin duplicados." });
    return;
  }
  const types: AgentType[] = requestedTypes ?? allTypes;
  const agents: Partial<Record<AgentType, VoiceApplyAgentResult>> = {};
  let failed = false;

  for (const type of types) {
    const inFlight = _agentResolveInFlight[type];
    if (inFlight) {
      try {
        // A call already owns the sync+verify for this agent. Reuse that
        // result instead of issuing a second PATCH/verification immediately.
        const agentId = await inFlight;
        if (_agentSyncedRevision[type] === _ttsSettingsRevision) {
          agents[type] = { agentId, status: "applied", sharedFlight: true };
          continue;
        }
      } catch {
        // A call may have raced a settings save and correctly failed stale
        // verification. Resolve the existing ID and retry with current settings.
      }
    }

    const cacheKey = `convai_${type}_agent_id`;
    let resolvedAgentId: string | null = null;
    try {
      const agentId = await findExistingConvAIAgentId(type);
      if (!agentId) {
        agents[type] = { agentId: null, status: "not_created" };
        continue;
      }
      resolvedAgentId = agentId;

      const voiceId = await resolveVerifiedConvAIVoiceId();
      let appliedAgentId: string | null = null;
      let sharedFlight = false;
      while (!appliedAgentId) {
        const concurrent = _agentResolveInFlight[type];
        if (concurrent) {
          try {
            const concurrentId = await concurrent;
            if (_agentSyncedRevision[type] === _ttsSettingsRevision) {
              appliedAgentId = concurrentId;
              sharedFlight = true;
              break;
            }
          } catch {
            // Retry below with the latest settings; do not accept a failed
            // or stale in-flight verification as an applied result.
          }
          const latestAgentId = await findExistingConvAIAgentId(type);
          if (!latestAgentId) {
            agents[type] = { agentId: null, status: "not_created" };
            break;
          }
          resolvedAgentId = latestAgentId;
          continue;
        }

        const work = withConvAIAgentLock(type, async (): Promise<string> => {
          // A reset in another process may have changed the ID while this
          // request was waiting for the cross-instance lock.
          delete _agentIdCache[cacheKey];
          const latestAgentId = await findExistingConvAIAgentId(type);
          if (!latestAgentId) throw new Error("El agente cambió mientras se esperaba; vuelve a aplicar los ajustes.");
          resolvedAgentId = latestAgentId;
          await syncConvAIAgentOrThrow(type, resolvedAgentId!, voiceId);
          _agentIdCache[cacheKey] = resolvedAgentId!;
          return resolvedAgentId!;
        });
        _agentResolveInFlight[type] = work;
        try {
          const syncedId = await work;
          if (_agentSyncedRevision[type] === _ttsSettingsRevision) appliedAgentId = syncedId;
        } finally {
          if (_agentResolveInFlight[type] === work) delete _agentResolveInFlight[type];
        }
      }
      if (appliedAgentId) agents[type] = { agentId: appliedAgentId, status: "applied", ...(sharedFlight ? { sharedFlight: true } : {}) };
    } catch (err: any) {
      failed = true;
      agents[type] = {
        agentId: type === "admin" && process.env.ELEVEN_CONVAI_DEFAULT_AGENT_ID
          ? process.env.ELEVEN_CONVAI_DEFAULT_AGENT_ID
          : resolvedAgentId ?? _agentIdCache[cacheKey] ?? null,
        status: "error",
        error: err?.message || "No se pudo aplicar la configuración",
      };
      logger.error({ type, err: err?.message, code: err?.code }, "ConvAI voice settings apply failed");
    }
  }

  // Se persiste también un fallo parcial: es justo lo que el admin necesita
  // recuperar al volver al panel para reintentar solo los fallidos.
  const report = await persistConvAIVoiceApplyReport(
    agents,
    requestedTypes !== undefined,
    String(req.session?.email || req.session?.name || req.session?.userId || "admin"),
  );

  if (failed) {
    res.status(502).json({ success: false, error: "No se pudieron aplicar los ajustes a todos los agentes.", agents, report });
    return;
  }
  res.json({ success: true, agents, report });
});

// Muestra corta con la MISMA voz y modelo que usa Arturo, con los valores del
// formulario (sin guardarlos). Devuelve audio/mpeg.
router.post("/voice/convai/voice-settings/preview", requireAdmin, async (req, res): Promise<void> => {
  let settings: ConvAITtsSettings;
  try {
    settings = normalizeConvAITtsSettings(req.body);
  } catch (err: any) {
    res.status(400).json({ error: err?.message || "Ajustes de voz inválidos", field: err?.field });
    return;
  }
  const rawText = typeof req.body?.text === "string" ? req.body.text.trim() : "";
  const text = rawText || CONVAI_TTS_PREVIEW_TEXT;
  if (text.length > CONVAI_TTS_PREVIEW_MAX_CHARS) {
    res.status(413).json({ error: `El texto de muestra no puede superar ${CONVAI_TTS_PREVIEW_MAX_CHARS} caracteres` });
    return;
  }
  const userId = String((req.session as any)?.userId ?? "admin");
  const quota = await checkTtsQuota(userId, text.length);
  if (!quota.ok) {
    res.setHeader("Retry-After", String(quota.retryAfter));
    res.status(429).json({ error: quota.reason });
    return;
  }
  try {
    const voiceId = await resolveSevillanoVoiceId();
    const result = await synthesizeSpeech({
      text,
      voiceId,
      modelId: CONVAI_SPANISH_MODEL,
      outputFormat: "mp3_44100_64",
      languageCode: "es",
      // El agente ConvAI no tiene `style`: 0 deja el TTS lo más parecido posible.
      voiceSettings: { stability: settings.stability, similarity_boost: settings.similarityBoost, speed: settings.speed, style: 0, use_speaker_boost: true },
    });
    res.setHeader("Content-Type", result.contentType);
    res.setHeader("Content-Length", String(result.audio.length));
    res.setHeader("Cache-Control", "no-store");
    res.send(result.audio);
  } catch (err: any) {
    logger.error({ err: err?.message }, "convai/voice-settings preview failed");
    if (!res.headersSent) res.status(502).json({ error: err?.message || "No se pudo generar la muestra de voz" });
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
export interface ConvAIHealthReport {
  healthy: boolean;
  degraded: boolean;
  checkedAt: string;
  voice: { voiceId: string | null; ok: boolean; code?: string; error?: string };
  agents: ConvAIAgentHealth[];
}

/**
 * Comprobación de salud de las llamadas de voz, reutilizable fuera de la ruta
 * (barra global de Motores IA y aviso horario por email). Solo lectura sobre
 * ElevenLabs: 1 consulta de la voz (+ suscripción) y 1 GET por agente existente.
 * Nunca hace PATCH ni crea agentes.
 */
export async function checkConvAIHealth(): Promise<ConvAIHealthReport> {
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
  return {
    healthy,
    degraded,
    checkedAt,
    voice: { voiceId, ok: !voiceError, code: voiceError?.code, error: voiceError?.error },
    agents,
  };
}

// GET = solo lectura sobre ElevenLabs (no hace PATCH): abrir la pestaña no debe
// tocar la configuración. La reparación explícita es POST /voice/convai/reset-agents.
router.get("/voice/convai/health", requireAdmin, async (_req, res): Promise<void> => {
  try {
    res.json(await checkConvAIHealth());
  } catch (err: any) {
    logger.error({ err: err?.message }, "convai/health failed");
    res.status(500).json({ error: err?.message || "Error comprobando la salud de ConvAI" });
  }
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

    const quota = await checkTtsQuota(String(userId) + ":gemini", cleaned.length);
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

    recordGeminiResponseUsage("voice-gemini-tts", "gemini-2.5-flash-preview-tts", response?.usageMetadata);
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
router.post("/voice/sfx", requireAdmin, async (req, res): Promise<void> => {
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
