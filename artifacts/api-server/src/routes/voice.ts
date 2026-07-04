import { Router } from "express";
import { db, projectsTable, productsTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import { askClaudeJsonWithBrain, learnFromOperation } from "../lib/claude.js";
import { enableLongRunning } from "../lib/long-running.js";
import {
  synthesizeSpeech, listVoices, listAllVoices, cloneVoice, deleteClonedVoice, listClonedVoices,
  transcribeAudio, isolateAudio, generateSoundEffect,
  listConvAIAgents, createConvAIAgent, getConvAIAgent, deleteConvAIAgent, getConvAISignedUrl, listConvAIConversations,
  listPronunciationDictionaries, createPronunciationDictionary, addRulesToPronunciationDictionary,
  removeRulesFromPronunciationDictionary, deletePronunciationDictionary,
  type ElevenModel, type ElevenOutputFormat, type ConvAIAgentConfig, type PronunciationRule,
} from "../lib/elevenlabs.js";
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

// ============================================================
// TEXT-TO-SPEECH (ElevenLabs)
// ============================================================
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

// ============================================================
// SMART VOICE RECOMMENDATION (Claude analyses product → ideal ElevenLabs voice)
// ============================================================
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

// ============================================================
// SOUND EFFECTS (ElevenLabs SFX)
// ============================================================
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
