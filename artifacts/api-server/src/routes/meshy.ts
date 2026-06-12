import { Router, type Request, type Response } from "express";
import multer from "multer";
import { createWriteStream, mkdirSync } from "fs";
import { unlink, writeFile, mkdir } from "fs/promises";
import { join } from "path";
import { randomUUID } from "crypto";
import { enableLongRunning } from "../lib/long-running.js";
import { logger } from "../lib/logger.js";

const router = Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 30 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (file.mimetype.startsWith("image/")) cb(null, true);
    else cb(new Error("Solo se aceptan imágenes"));
  },
});

// ── Constants ─────────────────────────────────────────────────────────────────

const MESHY_BASE = "https://api.meshy.ai/openapi/v2";
const POLL_INTERVAL_MS = 4_000;
const MAX_POLL_ATTEMPTS = 120; // 8 min max

// Paths for temp image hosting + GLB saving
const FRONTEND_PUBLIC = join(
  process.cwd(),
  "..",
  "..",
  "artifacts",
  "shopify-optimizer",
  "public"
);
const TEMP_DIR = join(FRONTEND_PUBLIC, "assets", "3d", "temp");
const MODELS_DIR = join(FRONTEND_PUBLIC, "assets", "3d", "models");

// ── Helpers ───────────────────────────────────────────────────────────────────

function getMeshyKey(): string {
  const key = process.env.MESHY_API_KEY;
  if (!key) throw new Error("MESHY_API_KEY no configurada. Añádela en los secretos del entorno.");
  return key;
}

async function meshyFetch(path: string, options: RequestInit = {}): Promise<any> {
  const key = getMeshyKey();
  const res = await fetch(`${MESHY_BASE}${path}`, {
    ...options,
    headers: {
      "Authorization": `Bearer ${key}`,
      "Content-Type": "application/json",
      ...options.headers,
    },
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Meshy error HTTP ${res.status}: ${text.slice(0, 300)}`);
  }
  return res.json();
}

async function meshyPollTask(type: "text-to-3d" | "image-to-3d", taskId: string): Promise<any> {
  for (let i = 0; i < MAX_POLL_ATTEMPTS; i++) {
    const data = await meshyFetch(`/${type}/${taskId}`);
    const status: string = data.status;
    if (status === "SUCCEEDED") return data;
    if (status === "FAILED" || status === "EXPIRED") {
      throw new Error(`Task ${taskId} ${status}: ${data.task_error?.message ?? ""}`);
    }
    await new Promise(r => setTimeout(r, POLL_INTERVAL_MS));
  }
  throw new Error(`Task ${taskId} timed out`);
}

async function downloadGlb(url: string, dest: string): Promise<void> {
  await mkdir(MODELS_DIR, { recursive: true });
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Download GLB error: HTTP ${res.status}`);
  const buf = Buffer.from(await res.arrayBuffer());
  await writeFile(dest, buf);
}

function sseWrite(res: Response, payload: object) {
  res.write(`data: ${JSON.stringify(payload)}\n\n`);
}

// ── Static data routes ────────────────────────────────────────────────────────

/* GET /api/meshy/animations — devuelve la librería maestra de animaciones */
router.get("/api/meshy/animations", (_req, res) => {
  const CATEGORIES = [
    { id: "entrance",    label: "Entradas",           icon: "🎬" },
    { id: "waiting",     label: "Idle / Espera",       icon: "🧍" },
    { id: "action",      label: "Acción / Formulario", icon: "👆" },
    { id: "celebration", label: "Celebración",         icon: "🎉" },
    { id: "locomotion",  label: "Locomoción",          icon: "🚶" },
    { id: "emote",       label: "Emociones",           icon: "😄" },
  ];
  const CLIPS = [
    // Entradas
    { id: "entrance_drop_in",       name: "Drop_In",              label: "Caída dramática",          category: "entrance",    looping: false, durationMs: 1200 },
    { id: "entrance_walk_in_wave",  name: "Walk_In_Wave",          label: "Caminar y saludar",        category: "entrance",    looping: false, durationMs: 2400 },
    { id: "entrance_jump_in",       name: "Jump_In",               label: "Salto de entrada",         category: "entrance",    looping: false, durationMs: 900  },
    { id: "entrance_slide_right",   name: "Slide_Right",           label: "Deslizarse",               category: "entrance",    looping: false, durationMs: 800  },
    // Idle
    { id: "idle_breathing",         name: "Idle_Breathing",        label: "Respiración natural",      category: "waiting",     looping: true,  durationMs: 3000 },
    { id: "idle_look_watch",        name: "Look_Watch",            label: "Mirar el reloj",           category: "waiting",     looping: true,  durationMs: 4200 },
    { id: "idle_thinking",          name: "Thinking_Hand_On_Chin", label: "Pensativo",                category: "waiting",     looping: true,  durationMs: 5000 },
    { id: "idle_impatient_tap",     name: "Impatient_Tap",         label: "Repiqueteo impaciente",    category: "waiting",     looping: true,  durationMs: 2000 },
    // Acción
    { id: "action_point_button",    name: "Point_At_Button",       label: "Señalar botón",            category: "action",      looping: false, durationMs: 1500 },
    { id: "action_presenting_palm", name: "Presenting_Palm_Up",    label: "Presentar con palma",      category: "action",      looping: false, durationMs: 2000 },
    { id: "action_thumbs_up",       name: "Thumbs_Up",             label: "Pulgar arriba",            category: "action",      looping: false, durationMs: 1200 },
    // Celebración
    { id: "celebration_dance_joy",  name: "Dance_Joy",             label: "Baile de alegría",         category: "celebration", looping: false, durationMs: 4000 },
    { id: "celebration_clapping",   name: "Clapping",              label: "Aplauso",                  category: "celebration", looping: false, durationMs: 2500 },
    { id: "celebration_victory",    name: "Victory_Fist",          label: "Puño de victoria",         category: "celebration", looping: false, durationMs: 1800 },
    { id: "celebration_backflip",   name: "Backflip",              label: "Salto mortal",             category: "celebration", looping: false, durationMs: 1500 },
    // Locomoción
    { id: "loco_walk",              name: "walk",                  label: "Caminar",                  category: "locomotion",  looping: true,  durationMs: 1200 },
    { id: "loco_run",               name: "run",                   label: "Correr",                   category: "locomotion",  looping: true,  durationMs: 700  },
    { id: "loco_jump",              name: "jump",                  label: "Saltar",                   category: "locomotion",  looping: false, durationMs: 1000 },
    // Emociones
    { id: "emote_wave",             name: "wave",                  label: "Saludar",                  category: "emote",       looping: false, durationMs: 1500 },
    { id: "emote_celebrate",        name: "celebrate",             label: "Celebrar",                 category: "emote",       looping: false, durationMs: 2000 },
    { id: "emote_nod",              name: "nod",                   label: "Asentir",                  category: "emote",       looping: false, durationMs: 800  },
  ];
  res.json({ categories: CATEGORIES, clips: CLIPS, total: CLIPS.length });
});

/* GET /api/meshy/models-config — catálogo de 14 personajes */
router.get("/api/meshy/models-config", (_req, res) => {
  const models = [
    { id: "spiderman",        name: "Spider-Man",            category: "cartoon",   emoji: "🕷️", available: false },
    { id: "bob_esponja",      name: "Bob Esponja",           category: "cartoon",   emoji: "🧽", available: false },
    { id: "mickey_mouse",     name: "Mickey Mouse",          category: "cartoon",   emoji: "🐭", available: false },
    { id: "payaso_plim_plim", name: "Payaso Plim Plim",      category: "cartoon",   emoji: "🤡", available: false },
    { id: "minnie_mouse",     name: "Minnie Mouse",          category: "cartoon",   emoji: "🎀", available: false },
    { id: "alec_monopoly",    name: "Alec Monopoly",         category: "cartoon",   emoji: "🎩", available: false },
    { id: "batman",           name: "Batman",                category: "cartoon",   emoji: "🦇", available: false },
    { id: "bugs_bunny",       name: "Bugs Bunny",            category: "cartoon",   emoji: "🐰", available: false },
    { id: "ted",              name: "TED (Oso)",             category: "cartoon",   emoji: "🐻", available: false },
    { id: "pikachu",          name: "Pikachu",               category: "cartoon",   emoji: "⚡", available: false },
    { id: "chica_ejecutiva",  name: "Mujer Ejecutiva",       category: "realistic", emoji: "👩‍💼", available: false },
    { id: "chico_casual",     name: "Hombre Casual Tech",    category: "realistic", emoji: "👨‍💻", available: false },
    { id: "chica_creativa",   name: "Mujer Creativa Agencia",category: "realistic", emoji: "👩‍🎨", available: false },
    { id: "chico_formal",     name: "Hombre Traje Formal",   category: "realistic", emoji: "🤵", available: false },
  ].map(m => ({
    ...m,
    path: `/assets/3d/models/${m.id}.glb`,
    glbExists: false, // client will check via HEAD request
  }));
  res.json({ models, total: models.length });
});

/* GET /api/meshy/balance — créditos disponibles */
router.get("/api/meshy/balance", async (_req, res) => {
  try {
    const data = await meshyFetch("/credits");
    res.json(data);
  } catch (e: any) {
    res.status(400).json({ error: e.message });
  }
});

/* GET /api/meshy/task/:type/:id — estado de tarea */
router.get("/api/meshy/task/:type/:id", async (req, res) => {
  const { type, id } = req.params;
  if (type !== "text-to-3d" && type !== "image-to-3d") {
    res.status(400).json({ error: "type debe ser text-to-3d o image-to-3d" });
    return;
  }
  try {
    const data = await meshyFetch(`/${type}/${id}`);
    res.json(data);
  } catch (e: any) {
    res.status(400).json({ error: e.message });
  }
});

// ── Text-to-3D ────────────────────────────────────────────────────────────────

/* POST /api/meshy/text-to-3d — modo preview (rápido, bajo detalle) */
router.post("/api/meshy/text-to-3d", async (req: Request, res: Response) => {
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  enableLongRunning(res);

  const {
    prompt, negative_prompt = "",
    art_style = "realistic",
    ai_model = "meshy-4",
    topology = "quad",
    target_polycount = 30000,
    should_remesh = true,
    symmetry = false,
  } = req.body ?? {};

  if (!prompt) { res.status(400).json({ error: "prompt requerido" }); return; }

  try {
    const body: Record<string, any> = {
      mode: "preview",
      prompt,
      negative_prompt,
      art_style,
      ai_model,
      topology,
      target_polycount,
      should_remesh,
      symmetry,
    };

    const created = await meshyFetch("/text-to-3d", { method: "POST", body: JSON.stringify(body) });
    const taskId: string = created.result;
    sseWrite(res, { event: "started", task_id: taskId });

    let lastProgress = -1;
    for (let i = 0; i < MAX_POLL_ATTEMPTS; i++) {
      const data = await meshyFetch(`/text-to-3d/${taskId}`);
      const status: string = data.status;
      const progress: number = data.progress ?? 0;

      if (progress !== lastProgress) {
        sseWrite(res, { event: "progress", task_id: taskId, progress, status });
        lastProgress = progress;
      }

      if (status === "SUCCEEDED") {
        sseWrite(res, { event: "done", task_id: taskId, output: data, progress: 100 });
        res.end(); return;
      }
      if (status === "FAILED" || status === "EXPIRED") {
        sseWrite(res, { event: "error", task_id: taskId, error: data.task_error?.message ?? status });
        res.end(); return;
      }
      await new Promise(r => setTimeout(r, POLL_INTERVAL_MS));
    }
    sseWrite(res, { event: "timeout", task_id: taskId });
    res.end();
  } catch (e: any) {
    logger.error({ err: e }, "meshy text-to-3d error");
    sseWrite(res, { event: "error", error: e.message });
    res.end();
  }
});

/* POST /api/meshy/text-to-3d/refine — refinar preview a alta calidad */
router.post("/api/meshy/text-to-3d/refine", async (req: Request, res: Response) => {
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  enableLongRunning(res);

  const { preview_task_id, texture_richness = "high" } = req.body ?? {};
  if (!preview_task_id) { res.status(400).json({ error: "preview_task_id requerido" }); return; }

  try {
    const created = await meshyFetch("/text-to-3d", {
      method: "POST",
      body: JSON.stringify({ mode: "refine", preview_task_id, texture_richness }),
    });
    const taskId: string = created.result;
    sseWrite(res, { event: "started", task_id: taskId, mode: "refine" });

    let lastProgress = -1;
    for (let i = 0; i < MAX_POLL_ATTEMPTS; i++) {
      const data = await meshyFetch(`/text-to-3d/${taskId}`);
      const status: string = data.status;
      const progress: number = data.progress ?? 0;
      if (progress !== lastProgress) {
        sseWrite(res, { event: "progress", task_id: taskId, progress, status });
        lastProgress = progress;
      }
      if (status === "SUCCEEDED") {
        sseWrite(res, { event: "done", task_id: taskId, output: data, progress: 100 });
        res.end(); return;
      }
      if (status === "FAILED" || status === "EXPIRED") {
        sseWrite(res, { event: "error", task_id: taskId, error: data.task_error?.message ?? status });
        res.end(); return;
      }
      await new Promise(r => setTimeout(r, POLL_INTERVAL_MS));
    }
    sseWrite(res, { event: "timeout", task_id: taskId });
    res.end();
  } catch (e: any) {
    sseWrite(res, { event: "error", error: e.message });
    res.end();
  }
});

// ── Image-to-3D ───────────────────────────────────────────────────────────────

/* POST /api/meshy/image-to-3d — imagen → modelo 3D */
router.post("/api/meshy/image-to-3d", upload.single("image"), async (req: Request, res: Response) => {
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  enableLongRunning(res);

  if (!req.file) { res.status(400).json({ error: "image requerida" }); return; }

  const {
    enable_pbr = "true",
    ai_model = "meshy-4",
    topology = "quad",
    target_polycount = 30000,
    should_remesh = "true",
  } = req.body ?? {};

  let tempPath: string | null = null;

  try {
    // Save temp image so Meshy can fetch it via HTTPS
    await mkdir(TEMP_DIR, { recursive: true });
    const ext = req.file.mimetype.includes("png") ? "png" : "jpg";
    const filename = `${randomUUID()}.${ext}`;
    tempPath = join(TEMP_DIR, filename);
    await writeFile(tempPath, req.file.buffer);

    const devDomain = process.env.REPLIT_DEV_DOMAIN ?? "localhost:19080";
    const imageUrl = `https://${devDomain}/assets/3d/temp/${filename}`;

    const created = await meshyFetch("/image-to-3d", {
      method: "POST",
      body: JSON.stringify({
        image_url: imageUrl,
        enable_pbr: enable_pbr !== "false",
        ai_model,
        topology,
        target_polycount: Number(target_polycount),
        should_remesh: should_remesh !== "false",
      }),
    });
    const taskId: string = created.result;
    sseWrite(res, { event: "started", task_id: taskId });

    let lastProgress = -1;
    for (let i = 0; i < MAX_POLL_ATTEMPTS; i++) {
      const data = await meshyFetch(`/image-to-3d/${taskId}`);
      const status: string = data.status;
      const progress: number = data.progress ?? 0;
      if (progress !== lastProgress) {
        sseWrite(res, { event: "progress", task_id: taskId, progress, status });
        lastProgress = progress;
      }
      if (status === "SUCCEEDED") {
        sseWrite(res, { event: "done", task_id: taskId, output: data, progress: 100 });
        res.end();
        // Clean up temp
        if (tempPath) unlink(tempPath).catch(() => {});
        return;
      }
      if (status === "FAILED" || status === "EXPIRED") {
        sseWrite(res, { event: "error", task_id: taskId, error: data.task_error?.message ?? status });
        res.end();
        if (tempPath) unlink(tempPath).catch(() => {});
        return;
      }
      await new Promise(r => setTimeout(r, POLL_INTERVAL_MS));
    }
    sseWrite(res, { event: "timeout", task_id: taskId });
    res.end();
    if (tempPath) unlink(tempPath).catch(() => {});
  } catch (e: any) {
    logger.error({ err: e }, "meshy image-to-3d error");
    sseWrite(res, { event: "error", error: e.message });
    res.end();
    if (tempPath) unlink(tempPath).catch(() => {});
  }
});

// ── Fábrica de Personajes (Admin) ─────────────────────────────────────────────

/**
 * POST /api/meshy/generate-character
 * Pipeline completo: imagen → Meshy Image-to-3D → download GLB → save a /public/assets/3d/models/{characterId}.glb
 * Streaming SSE con progress events
 */
router.post("/api/meshy/generate-character", upload.single("image"), async (req: Request, res: Response) => {
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  enableLongRunning(res);

  if (!req.file) { res.status(400).json({ error: "image requerida" }); return; }
  const { characterId, art_style = "realistic" } = req.body ?? {};
  if (!characterId) { res.status(400).json({ error: "characterId requerido" }); return; }

  // Validate characterId to prevent path traversal
  if (!/^[a-z0-9_]+$/i.test(characterId)) {
    res.status(400).json({ error: "characterId inválido" }); return;
  }

  let tempPath: string | null = null;

  try {
    // 1. Save temp image
    await mkdir(TEMP_DIR, { recursive: true });
    const ext = req.file.mimetype.includes("png") ? "png" : "jpg";
    const filename = `tmp_${characterId}_${Date.now()}.${ext}`;
    tempPath = join(TEMP_DIR, filename);
    await writeFile(tempPath, req.file.buffer);
    sseWrite(res, { event: "progress", phase: "upload", message: "Imagen cargada, iniciando Meshy..." });

    const devDomain = process.env.REPLIT_DEV_DOMAIN ?? "localhost:19080";
    const imageUrl = `https://${devDomain}/assets/3d/temp/${filename}`;

    // 2. Create Meshy image-to-3D task
    const created = await meshyFetch("/image-to-3d", {
      method: "POST",
      body: JSON.stringify({
        image_url: imageUrl,
        enable_pbr: true,
        ai_model: "meshy-4",
        topology: "quad",
        target_polycount: 30000,
        should_remesh: true,
      }),
    });
    const taskId: string = created.result;
    sseWrite(res, { event: "started", task_id: taskId, character_id: characterId, phase: "generating" });

    // 3. Poll until done
    let lastProgress = -1;
    for (let i = 0; i < MAX_POLL_ATTEMPTS; i++) {
      const data = await meshyFetch(`/image-to-3d/${taskId}`);
      const status: string = data.status;
      const progress: number = data.progress ?? 0;

      if (progress !== lastProgress) {
        sseWrite(res, { event: "progress", task_id: taskId, progress, status, phase: "generating", character_id: characterId });
        lastProgress = progress;
      }

      if (status === "SUCCEEDED") {
        sseWrite(res, { event: "progress", phase: "downloading", message: "Descargando GLB...", progress: 100 });

        // 4. Download GLB
        const glbUrl: string = data.model_urls?.glb;
        if (!glbUrl) throw new Error("No GLB URL en la respuesta de Meshy");

        const glbDest = join(MODELS_DIR, `${characterId}.glb`);
        await downloadGlb(glbUrl, glbDest);

        // 5. Cleanup temp
        if (tempPath) unlink(tempPath).catch(() => {});

        sseWrite(res, {
          event: "done",
          task_id: taskId,
          character_id: characterId,
          glb_path: `/assets/3d/models/${characterId}.glb`,
          thumbnail_url: data.thumbnail_url,
          video_url: data.video_url,
          model_urls: data.model_urls,
        });
        res.end();
        return;
      }

      if (status === "FAILED" || status === "EXPIRED") {
        sseWrite(res, { event: "error", task_id: taskId, character_id: characterId, error: data.task_error?.message ?? status });
        res.end();
        if (tempPath) unlink(tempPath).catch(() => {});
        return;
      }

      await new Promise(r => setTimeout(r, POLL_INTERVAL_MS));
    }

    sseWrite(res, { event: "timeout", task_id: taskId, character_id: characterId });
    res.end();
    if (tempPath) unlink(tempPath).catch(() => {});

  } catch (e: any) {
    logger.error({ err: e }, "meshy generate-character error");
    sseWrite(res, { event: "error", character_id: characterId, error: e.message });
    res.end();
    if (tempPath) unlink(tempPath).catch(() => {});
  }
});

export default router;
