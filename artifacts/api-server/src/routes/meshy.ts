import { Router, type Request, type Response } from "express";
import multer from "multer";
import { createWriteStream, mkdirSync } from "fs";
import { unlink, writeFile, mkdir, readFile } from "fs/promises";
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

const MESHY_BASE_V1 = "https://api.meshy.ai/openapi/v1";
const MESHY_BASE_V2 = "https://api.meshy.ai/openapi/v2";
const POLL_INTERVAL_MS = 4_000;
const MAX_POLL_ATTEMPTS = 120; // 8 min max

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
const ANIMS_DIR = join(FRONTEND_PUBLIC, "assets", "3d", "animations");

// ── Helpers ───────────────────────────────────────────────────────────────────

function getMeshyKey(): string {
  const key = process.env.MESHY_API_KEY;
  if (!key) throw new Error("MESHY_API_KEY no configurada.");
  return key;
}

async function meshyFetch(path: string, options: RequestInit = {}, base = MESHY_BASE_V1): Promise<any> {
  const key = getMeshyKey();
  const res = await fetch(`${base}${path}`, {
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

// ── Catálogo de animaciones Meshy (action_ids 1-20 verificados activos) ───────
const ANIMATION_CATALOG = [
  // action_id 1-5: locomoción básica
  { action_id: 1,  name: "Walk",            label: "Caminar",             category: "locomotion",  looping: true  },
  { action_id: 2,  name: "Run",             label: "Correr",              category: "locomotion",  looping: true  },
  { action_id: 3,  name: "Jump",            label: "Saltar",              category: "locomotion",  looping: false },
  { action_id: 4,  name: "Idle",            label: "Reposo natural",      category: "waiting",     looping: true  },
  { action_id: 5,  name: "Idle_Breathing",  label: "Respirar",            category: "waiting",     looping: true  },
  // action_id 6-10: expresiones y saludos
  { action_id: 6,  name: "Wave",            label: "Saludar",             category: "emote",       looping: false },
  { action_id: 7,  name: "Thumbs_Up",       label: "Pulgar arriba",       category: "action",      looping: false },
  { action_id: 8,  name: "Clapping",        label: "Aplaudir",            category: "celebration", looping: false },
  { action_id: 9,  name: "Dance",           label: "Bailar",              category: "celebration", looping: true  },
  { action_id: 10, name: "Point_Forward",   label: "Señalar",             category: "action",      looping: false },
  // action_id 11-15: emociones
  { action_id: 11, name: "Thinking",        label: "Pensativo",           category: "waiting",     looping: true  },
  { action_id: 12, name: "Victory",         label: "Victoria",            category: "celebration", looping: false },
  { action_id: 13, name: "Sit",             label: "Sentarse",            category: "waiting",     looping: true  },
  { action_id: 14, name: "Look_Around",     label: "Mirar alrededor",     category: "waiting",     looping: true  },
  { action_id: 15, name: "Kick",            label: "Patear",              category: "action",      looping: false },
  // action_id 16-20: acción
  { action_id: 16, name: "Punch",           label: "Golpear",             category: "action",      looping: false },
  { action_id: 17, name: "Crouch",          label: "Agacharse",           category: "action",      looping: false },
  { action_id: 18, name: "Celebrate_Arms",  label: "Brazos celebración",  category: "celebration", looping: false },
  { action_id: 19, name: "Head_Nod",        label: "Asentir",             category: "emote",       looping: false },
  { action_id: 20, name: "Shake_Head",      label: "Negar",               category: "emote",       looping: false },
];

// ── Static data routes ────────────────────────────────────────────────────────

router.get("/api/meshy/animations", (_req, res) => {
  const CATEGORIES = [
    { id: "locomotion",  label: "Locomoción",          icon: "🚶" },
    { id: "waiting",     label: "Idle / Espera",        icon: "🧍" },
    { id: "action",      label: "Acción",               icon: "👆" },
    { id: "celebration", label: "Celebración",          icon: "🎉" },
    { id: "emote",       label: "Emociones",            icon: "😄" },
  ];
  res.json({ categories: CATEGORIES, clips: ANIMATION_CATALOG, total: ANIMATION_CATALOG.length });
});

router.get("/api/meshy/models-config", (_req, res) => {
  const models = [
    { id: "spiderman",        name: "Spider-Man",             category: "cartoon",   emoji: "🕷️", rigStatus: "pending" },
    { id: "bob_esponja",      name: "Bob Esponja",            category: "cartoon",   emoji: "🧽", rigStatus: "pending" },
    { id: "mickey_mouse",     name: "Mickey Mouse",           category: "cartoon",   emoji: "🐭", rigStatus: "pending" },
    { id: "payaso_plim_plim", name: "Payaso Plim Plim",       category: "cartoon",   emoji: "🤡", rigStatus: "pending" },
    { id: "minnie_mouse",     name: "Minnie Mouse",           category: "cartoon",   emoji: "🎀", rigStatus: "pending" },
    { id: "alec_monopoly",    name: "Alec Monopoly",          category: "cartoon",   emoji: "🎩", rigStatus: "rigged"  },
    { id: "batman",           name: "Batman",                 category: "cartoon",   emoji: "🦇", rigStatus: "rigged"  },
    { id: "bugs_bunny",       name: "Bugs Bunny",             category: "cartoon",   emoji: "🐰", rigStatus: "pending" },
    { id: "ted",              name: "TED (Oso)",              category: "cartoon",   emoji: "🐻", rigStatus: "rigged"  },
    { id: "pikachu",          name: "Pikachu",                category: "cartoon",   emoji: "⚡", rigStatus: "pending" },
    { id: "chica_ejecutiva",  name: "Mujer Ejecutiva",        category: "realistic", emoji: "👩‍💼", rigStatus: "pending" },
    { id: "chico_casual",     name: "Hombre Casual Tech",     category: "realistic", emoji: "👨‍💻", rigStatus: "rigged"  },
    { id: "chica_creativa",   name: "Mujer Creativa Agencia", category: "realistic", emoji: "👩‍🎨", rigStatus: "pending" },
    { id: "chico_formal",     name: "Hombre Traje Formal",    category: "realistic", emoji: "🤵", rigStatus: "rigged"  },
  ].map(m => ({
    ...m,
    glb_path: `/assets/3d/models/${m.id}.glb`,
    rigged_glb: m.rigStatus === "rigged" ? `/assets/3d/animations/${m.id}/rigged.glb` : null,
    walk_glb:   m.rigStatus === "rigged" ? `/assets/3d/animations/${m.id}/walk.glb`   : null,
    run_glb:    m.rigStatus === "rigged" ? `/assets/3d/animations/${m.id}/run.glb`    : null,
  }));
  res.json({ models, total: models.length });
});

router.get("/api/meshy/balance", async (_req, res) => {
  try {
    const data = await meshyFetch("/credits");
    res.json(data);
  } catch (e: any) {
    res.status(400).json({ error: e.message });
  }
});

router.get("/api/meshy/task/:type/:id", async (req, res) => {
  const { type, id } = req.params;
  const validTypes = ["text-to-3d", "image-to-3d", "rigging", "animations"];
  if (!validTypes.includes(type)) {
    res.status(400).json({ error: `type debe ser: ${validTypes.join(", ")}` });
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

router.post("/api/meshy/text-to-3d", async (req: Request, res: Response) => {
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  enableLongRunning(res);

  const {
    prompt, negative_prompt = "",
    art_style = "realistic",
    topology = "quad",
    target_polycount = 30000,
    should_remesh = true,
    symmetry = false,
  } = req.body ?? {};

  if (!prompt) { res.status(400).json({ error: "prompt requerido" }); return; }

  try {
    const created = await meshyFetch("/text-to-3d", {
      method: "POST",
      body: JSON.stringify({
        mode: "preview",
        prompt, negative_prompt, art_style,
        topology, target_polycount, should_remesh, symmetry,
      }),
    }, MESHY_BASE_V2);
    const taskId: string = created.result;
    sseWrite(res, { event: "started", task_id: taskId });

    let lastProgress = -1;
    for (let i = 0; i < MAX_POLL_ATTEMPTS; i++) {
      const data = await meshyFetch(`/text-to-3d/${taskId}`, {}, MESHY_BASE_V2);
      const status: string = data.status;
      const progress: number = data.progress ?? 0;
      if (progress !== lastProgress) {
        sseWrite(res, { event: "progress", task_id: taskId, progress, status });
        lastProgress = progress;
      }
      if (status === "SUCCEEDED") { sseWrite(res, { event: "done", task_id: taskId, output: data }); res.end(); return; }
      if (status === "FAILED" || status === "EXPIRED") { sseWrite(res, { event: "error", error: data.task_error?.message ?? status }); res.end(); return; }
      await new Promise(r => setTimeout(r, POLL_INTERVAL_MS));
    }
    sseWrite(res, { event: "timeout" }); res.end();
  } catch (e: any) {
    sseWrite(res, { event: "error", error: e.message }); res.end();
  }
});

// ── Image-to-3D ───────────────────────────────────────────────────────────────

router.post("/api/meshy/image-to-3d", upload.single("image"), async (req: Request, res: Response) => {
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  enableLongRunning(res);

  if (!req.file) { res.status(400).json({ error: "image requerida" }); return; }

  const {
    ai_model = "meshy-6",
    topology = "quad",
    target_polycount = 30000,
    should_remesh = "true",
  } = req.body ?? {};

  let tempPath: string | null = null;

  try {
    await mkdir(TEMP_DIR, { recursive: true });
    const ext = req.file.mimetype.includes("png") ? "png" : "jpg";
    const filename = `${randomUUID()}.${ext}`;
    tempPath = join(TEMP_DIR, filename);
    await writeFile(tempPath, req.file.buffer);

    const devDomain = process.env.REPLIT_DEV_DOMAIN ?? "localhost:19080";
    const imageUrl = `https://${devDomain}/assets/3d/temp/${filename}`;

    const created = await meshyFetch("/image-to-3d", {
      method: "POST",
      body: JSON.stringify({ image_url: imageUrl, ai_model, topology, target_polycount: Number(target_polycount), should_remesh: should_remesh !== "false" }),
    });
    const taskId: string = created.result;
    sseWrite(res, { event: "started", task_id: taskId });

    let lastProgress = -1;
    for (let i = 0; i < MAX_POLL_ATTEMPTS; i++) {
      const data = await meshyFetch(`/image-to-3d/${taskId}`);
      const status: string = data.status;
      const progress: number = data.progress ?? 0;
      if (progress !== lastProgress) { sseWrite(res, { event: "progress", task_id: taskId, progress, status }); lastProgress = progress; }
      if (status === "SUCCEEDED") { sseWrite(res, { event: "done", task_id: taskId, output: data }); res.end(); if (tempPath) unlink(tempPath).catch(() => {}); return; }
      if (status === "FAILED" || status === "EXPIRED") { sseWrite(res, { event: "error", error: data.task_error?.message ?? status }); res.end(); if (tempPath) unlink(tempPath).catch(() => {}); return; }
      await new Promise(r => setTimeout(r, POLL_INTERVAL_MS));
    }
    sseWrite(res, { event: "timeout" }); res.end(); if (tempPath) unlink(tempPath).catch(() => {});
  } catch (e: any) {
    sseWrite(res, { event: "error", error: e.message }); res.end(); if (tempPath) unlink(tempPath).catch(() => {});
  }
});

// ── Rigging ───────────────────────────────────────────────────────────────────

router.post("/api/meshy/rig", async (req: Request, res: Response) => {
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  enableLongRunning(res);

  const { input_task_id, model_url } = req.body ?? {};
  if (!input_task_id || !model_url) { res.status(400).json({ error: "input_task_id y model_url requeridos" }); return; }

  try {
    const created = await meshyFetch("/rigging", { method: "POST", body: JSON.stringify({ input_task_id, model_url }) });
    const rigTaskId: string = created.result;
    sseWrite(res, { event: "started", rig_task_id: rigTaskId });

    for (let i = 0; i < MAX_POLL_ATTEMPTS; i++) {
      const data = await meshyFetch(`/rigging/${rigTaskId}`);
      const status: string = data.status;
      const progress: number = data.progress ?? 0;
      sseWrite(res, { event: "progress", rig_task_id: rigTaskId, progress, status });
      if (status === "SUCCEEDED") {
        const r = data.result ?? {};
        sseWrite(res, { event: "done", rig_task_id: rigTaskId, rigged_glb_url: r.rigged_character_glb_url, basic_animations: r.basic_animations });
        res.end(); return;
      }
      if (status === "FAILED" || status === "EXPIRED") { sseWrite(res, { event: "error", error: data.task_error?.message ?? status }); res.end(); return; }
      await new Promise(r => setTimeout(r, POLL_INTERVAL_MS));
    }
    sseWrite(res, { event: "timeout" }); res.end();
  } catch (e: any) {
    sseWrite(res, { event: "error", error: e.message }); res.end();
  }
});

// ── Animations ────────────────────────────────────────────────────────────────

router.post("/api/meshy/animate", async (req: Request, res: Response) => {
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  enableLongRunning(res);

  const { rig_task_id, action_id } = req.body ?? {};
  if (!rig_task_id || action_id === undefined) { res.status(400).json({ error: "rig_task_id y action_id requeridos" }); return; }

  try {
    const created = await meshyFetch("/animations", { method: "POST", body: JSON.stringify({ rig_task_id, action_id: Number(action_id) }) });
    const animTaskId: string = created.result;
    sseWrite(res, { event: "started", anim_task_id: animTaskId, action_id });

    for (let i = 0; i < MAX_POLL_ATTEMPTS; i++) {
      const data = await meshyFetch(`/animations/${animTaskId}`);
      const status: string = data.status;
      const progress: number = data.progress ?? 0;
      sseWrite(res, { event: "progress", anim_task_id: animTaskId, progress, status });
      if (status === "SUCCEEDED") {
        const glbUrl = data.result?.animated_character_glb_url ?? "";
        sseWrite(res, { event: "done", anim_task_id: animTaskId, action_id, animated_glb_url: glbUrl });
        res.end(); return;
      }
      if (status === "FAILED" || status === "EXPIRED") { sseWrite(res, { event: "error", error: data.task_error?.message ?? status }); res.end(); return; }
      await new Promise(r => setTimeout(r, POLL_INTERVAL_MS));
    }
    sseWrite(res, { event: "timeout" }); res.end();
  } catch (e: any) {
    sseWrite(res, { event: "error", error: e.message }); res.end();
  }
});

// ── Fábrica de Personajes (Admin pipeline) ───────────────────────────────────

router.post("/api/meshy/generate-character", upload.single("image"), async (req: Request, res: Response) => {
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  enableLongRunning(res);

  if (!req.file) { res.status(400).json({ error: "image requerida" }); return; }
  const { characterId } = req.body ?? {};
  if (!characterId || !/^[a-z0-9_]+$/i.test(characterId)) { res.status(400).json({ error: "characterId inválido" }); return; }

  let tempPath: string | null = null;

  try {
    await mkdir(TEMP_DIR, { recursive: true });
    await mkdir(MODELS_DIR, { recursive: true });
    const ext = req.file.mimetype.includes("png") ? "png" : "jpg";
    const filename = `tmp_${characterId}_${Date.now()}.${ext}`;
    tempPath = join(TEMP_DIR, filename);
    await writeFile(tempPath, req.file.buffer);
    sseWrite(res, { event: "progress", phase: "upload", message: "Imagen cargada, iniciando Meshy..." });

    const devDomain = process.env.REPLIT_DEV_DOMAIN ?? "localhost:19080";
    const imageUrl = `https://${devDomain}/assets/3d/temp/${filename}`;

    // Phase 1: image-to-3d
    const created = await meshyFetch("/image-to-3d", {
      method: "POST",
      body: JSON.stringify({ image_url: imageUrl, ai_model: "meshy-6", topology: "quad", target_polycount: 30000, should_remesh: true }),
    });
    const taskId: string = created.result;
    sseWrite(res, { event: "started", task_id: taskId, character_id: characterId, phase: "generating" });

    let modelData: any = null;
    for (let i = 0; i < MAX_POLL_ATTEMPTS; i++) {
      const data = await meshyFetch(`/image-to-3d/${taskId}`);
      const status: string = data.status;
      const progress: number = data.progress ?? 0;
      sseWrite(res, { event: "progress", task_id: taskId, progress, status, phase: "generating", character_id: characterId });
      if (status === "SUCCEEDED") { modelData = data; break; }
      if (status === "FAILED" || status === "EXPIRED") {
        sseWrite(res, { event: "error", error: data.task_error?.message ?? status }); res.end();
        if (tempPath) unlink(tempPath).catch(() => {}); return;
      }
      await new Promise(r => setTimeout(r, POLL_INTERVAL_MS));
    }
    if (!modelData) { sseWrite(res, { event: "timeout" }); res.end(); if (tempPath) unlink(tempPath).catch(() => {}); return; }

    // Phase 2: download GLB
    sseWrite(res, { event: "progress", phase: "downloading", message: "Descargando GLB...", progress: 100 });
    const glbUrl: string = modelData.model_urls?.glb;
    if (!glbUrl) throw new Error("No GLB URL en respuesta Meshy");
    const glbDest = join(MODELS_DIR, `${characterId}.glb`);
    await downloadGlb(glbUrl, glbDest);
    if (tempPath) unlink(tempPath).catch(() => {});

    // Phase 3: auto-rig (best effort)
    try {
      sseWrite(res, { event: "progress", phase: "rigging", message: "Iniciando auto-rig..." });
      const rigCreated = await meshyFetch("/rigging", { method: "POST", body: JSON.stringify({ input_task_id: taskId, model_url: glbUrl }) });
      const rigTaskId: string = rigCreated.result;
      sseWrite(res, { event: "progress", rig_task_id: rigTaskId, phase: "rigging", message: "Procesando rig..." });

      for (let i = 0; i < 60; i++) {
        const rigData = await meshyFetch(`/rigging/${rigTaskId}`);
        const rigStatus: string = rigData.status;
        const rigProgress: number = rigData.progress ?? 0;
        sseWrite(res, { event: "progress", rig_task_id: rigTaskId, progress: rigProgress, status: rigStatus, phase: "rigging" });
        if (rigStatus === "SUCCEEDED") {
          const rigResult = rigData.result ?? {};
          sseWrite(res, {
            event: "done",
            task_id: taskId,
            rig_task_id: rigTaskId,
            character_id: characterId,
            glb_path: `/assets/3d/models/${characterId}.glb`,
            rigged_glb_url: rigResult.rigged_character_glb_url,
            basic_animations: rigResult.basic_animations,
            thumbnail_url: modelData.thumbnail_url,
            model_urls: modelData.model_urls,
          });
          res.end(); return;
        }
        if (rigStatus === "FAILED" || rigStatus === "EXPIRED") break;
        await new Promise(r => setTimeout(r, POLL_INTERVAL_MS));
      }
    } catch (_) {}

    // Done without rig
    sseWrite(res, {
      event: "done",
      task_id: taskId,
      character_id: characterId,
      glb_path: `/assets/3d/models/${characterId}.glb`,
      thumbnail_url: modelData.thumbnail_url,
      model_urls: modelData.model_urls,
      rig_skipped: true,
    });
    res.end();

  } catch (e: any) {
    logger.error({ err: e }, "meshy generate-character error");
    sseWrite(res, { event: "error", character_id: characterId, error: e.message });
    res.end();
    if (tempPath) unlink(tempPath).catch(() => {});
  }
});

export default router;
