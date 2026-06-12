import { Router, type Request, type Response } from "express";
import multer from "multer";
import { createWriteStream, existsSync, readdirSync, statSync } from "fs";
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

const FRONTEND_PUBLIC = join(process.cwd(), "..", "..", "artifacts", "shopify-optimizer", "public");
const TEMP_DIR   = join(FRONTEND_PUBLIC, "assets", "3d", "temp");
const MODELS_DIR = join(FRONTEND_PUBLIC, "assets", "3d", "models");
const ANIMS_DIR  = join(FRONTEND_PUBLIC, "assets", "3d", "animations");

// ── Action ID → file name mapping (20 actions verified) ──────────────────────
const ACTION_MAP: Record<number, string> = {
  1:"walk", 2:"alert", 3:"arise", 4:"idle", 5:"idle_breath",
  6:"wave", 7:"thumbs_up", 8:"clap", 9:"dance", 10:"point",
  11:"think", 12:"victory", 13:"sit", 14:"look_around", 15:"kick",
  16:"punch", 17:"crouch", 18:"celebrate", 19:"nod", 20:"shake_head",
};

// ── Animation catalog with Visme-style metadata ───────────────────────────────
const ANIMATION_CATALOG = [
  { action_id:  1, id:"walk",        name:"Walk",           label:"🚶 Caminar",        label_short:"Walk",    category:"locomotion",  visme_phase:"transit",  looping:true,  duration_ms:1200 },
  { action_id:  2, id:"alert",       name:"Alert",          label:"⚠️ Alerta",          label_short:"Alert",   category:"action",      visme_phase:"interact", looping:false, duration_ms:1500 },
  { action_id:  3, id:"arise",       name:"Arise",          label:"⬆️ Levantarse",      label_short:"Arise",   category:"entrance",    visme_phase:"intro",    looping:false, duration_ms:1200 },
  { action_id:  4, id:"idle",        name:"Idle",           label:"🧍 Reposo",          label_short:"Idle",    category:"waiting",     visme_phase:"idle",     looping:true,  duration_ms:3000 },
  { action_id:  5, id:"idle_breath", name:"Idle_Breathing", label:"💨 Respirar",        label_short:"Breath",  category:"waiting",     visme_phase:"idle",     looping:true,  duration_ms:4000 },
  { action_id:  6, id:"wave",        name:"Wave",           label:"👋 Saludar",         label_short:"Wave",    category:"entrance",    visme_phase:"intro",    looping:false, duration_ms:1800 },
  { action_id:  7, id:"thumbs_up",   name:"Thumbs_Up",      label:"👍 Pulgar arriba",   label_short:"Thumbs",  category:"celebration", visme_phase:"success",  looping:false, duration_ms:1200 },
  { action_id:  8, id:"clap",        name:"Clapping",       label:"👏 Aplaudir",        label_short:"Clap",    category:"celebration", visme_phase:"success",  looping:false, duration_ms:2500 },
  { action_id:  9, id:"dance",       name:"Dance",          label:"💃 Bailar",          label_short:"Dance",   category:"celebration", visme_phase:"success",  looping:true,  duration_ms:4000 },
  { action_id: 10, id:"point",       name:"Point_Forward",  label:"☝️ Señalar",         label_short:"Point",   category:"action",      visme_phase:"interact", looping:false, duration_ms:1500 },
  { action_id: 11, id:"think",       name:"Thinking",       label:"🤔 Pensar",          label_short:"Think",   category:"waiting",     visme_phase:"idle",     looping:true,  duration_ms:5000 },
  { action_id: 12, id:"victory",     name:"Victory",        label:"🏆 Victoria",        label_short:"Victory", category:"celebration", visme_phase:"success",  looping:false, duration_ms:2000 },
  { action_id: 13, id:"sit",         name:"Sit",            label:"🪑 Sentarse",        label_short:"Sit",     category:"waiting",     visme_phase:"idle",     looping:true,  duration_ms:0    },
  { action_id: 14, id:"look_around", name:"Look_Around",    label:"👀 Mirar",           label_short:"Look",    category:"waiting",     visme_phase:"idle",     looping:true,  duration_ms:4000 },
  { action_id: 15, id:"kick",        name:"Kick",           label:"🦵 Patear",          label_short:"Kick",    category:"action",      visme_phase:"interact", looping:false, duration_ms:800  },
  { action_id: 16, id:"punch",       name:"Punch",          label:"👊 Golpear",         label_short:"Punch",   category:"action",      visme_phase:"interact", looping:false, duration_ms:700  },
  { action_id: 17, id:"crouch",      name:"Crouch",         label:"🦸 Agacharse",       label_short:"Crouch",  category:"entrance",    visme_phase:"intro",    looping:false, duration_ms:1000 },
  { action_id: 18, id:"celebrate",   name:"Celebrate_Arms", label:"🙌 Celebrar",        label_short:"Celeb",   category:"celebration", visme_phase:"success",  looping:false, duration_ms:2000 },
  { action_id: 19, id:"nod",         name:"Head_Nod",       label:"😌 Asentir",         label_short:"Nod",     category:"emotion",     visme_phase:"react",    looping:false, duration_ms:1000 },
  { action_id: 20, id:"shake_head",  name:"Shake_Head",     label:"😤 Negar",           label_short:"Shake",   category:"emotion",     visme_phase:"react",    looping:false, duration_ms:1000 },
  { action_id: 21, id:"run",         name:"Run",            label:"🏃 Correr",           label_short:"Run",     category:"locomotion",  visme_phase:"transit",  looping:true,  duration_ms:800  },
  { action_id: 22, id:"jump",        name:"Jump",           label:"⬆️ Saltar",           label_short:"Jump",    category:"locomotion",  visme_phase:"transit",  looping:false, duration_ms:900  },
];

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
    throw new Error(`Meshy HTTP ${res.status}: ${text.slice(0, 300)}`);
  }
  return res.json();
}

async function downloadToFile(url: string, dest: string): Promise<void> {
  await mkdir(MODELS_DIR, { recursive: true });
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Download error: HTTP ${res.status}`);
  const buf = Buffer.from(await res.arrayBuffer());
  await writeFile(dest, buf);
}

function sseWrite(res: Response, payload: object) {
  res.write(`data: ${JSON.stringify(payload)}\n\n`);
}

// Scan filesystem and return real animation status per character
function getCharStatus(): Record<string, { animations: string[]; has_rig: boolean; model_exists: boolean }> {
  const result: Record<string, { animations: string[]; has_rig: boolean; model_exists: boolean }> = {};
  try {
    const chars = readdirSync(ANIMS_DIR);
    for (const char of chars) {
      const charDir = join(ANIMS_DIR, char);
      if (!statSync(charDir).isDirectory()) continue;
      const files = readdirSync(charDir).filter(f => f.endsWith(".glb"));
      const animations = files.filter(f => f !== "rigged.glb").map(f => f.replace(".glb", ""));
      const hasRig = files.includes("rigged.glb");
      const modelExists = existsSync(join(MODELS_DIR, `${char}.glb`));
      result[char] = { animations, has_rig: hasRig, model_exists: modelExists };
    }
  } catch {}
  return result;
}

// ── Static catalog routes ─────────────────────────────────────────────────────

router.get("/meshy/animations", (_req, res) => {
  const categories = [
    { id:"entrance",    label:"🎬 Entrada",        icon:"🎬" },
    { id:"waiting",     label:"🧍 Idle / Espera",  icon:"🧍" },
    { id:"action",      label:"👆 Acción",          icon:"👆" },
    { id:"celebration", label:"🎉 Celebración",     icon:"🎉" },
    { id:"locomotion",  label:"🚶 Locomoción",      icon:"🚶" },
    { id:"emotion",     label:"😄 Emociones",       icon:"😄" },
  ];
  res.json({ categories, clips: ANIMATION_CATALOG, total: ANIMATION_CATALOG.length });
});

router.get("/meshy/models-config", (_req, res) => {
  const charStatus = getCharStatus();
  const models = [
    { id:"batman",          name:"Batman",              emoji:"🦇", category:"cartoon"   },
    { id:"alec_monopoly",   name:"Alec Monopoly",       emoji:"🎩", category:"cartoon"   },
    { id:"ted",             name:"TED (Oso)",            emoji:"🐻", category:"cartoon"   },
    { id:"chico_casual",    name:"Hombre Casual Tech",   emoji:"👨‍💻", category:"realistic" },
    { id:"chico_formal",    name:"Hombre Traje Formal",  emoji:"🤵", category:"realistic" },
    { id:"spiderman",       name:"Spider-Man",           emoji:"🕷️", category:"cartoon"   },
    { id:"mickey_mouse",    name:"Mickey Mouse",         emoji:"🐭", category:"cartoon"   },
    { id:"minnie_mouse",    name:"Minnie Mouse",         emoji:"🎀", category:"cartoon"   },
    { id:"bugs_bunny",      name:"Bugs Bunny",           emoji:"🐰", category:"cartoon"   },
    { id:"pikachu",         name:"Pikachu",              emoji:"⚡", category:"cartoon"   },
    { id:"bob_esponja",     name:"Bob Esponja",          emoji:"🧽", category:"cartoon"   },
    { id:"payaso_plim_plim",name:"Plim Plim",            emoji:"🤡", category:"cartoon"   },
    { id:"chica_ejecutiva", name:"Mujer Ejecutiva",      emoji:"👩‍💼", category:"realistic" },
    { id:"chica_creativa",  name:"Mujer Creativa",       emoji:"👩‍🎨", category:"realistic" },
  ].map(m => {
    const st = charStatus[m.id] ?? { animations: [], has_rig: false, model_exists: existsSync(join(MODELS_DIR, `${m.id}.glb`)) };
    const rigStatus = st.has_rig && st.animations.length > 0 ? "rigged" : st.model_exists ? "pending" : "missing";
    return {
      ...m,
      rig_status: rigStatus,
      animation_count: st.animations.length,
      animations: st.animations,
      glb_path: st.model_exists ? `/assets/3d/models/${m.id}.glb` : null,
      rigged_glb: st.has_rig ? `/assets/3d/animations/${m.id}/rigged.glb` : null,
    };
  });
  res.json({ models, total: models.length, rigged: models.filter(m => m.rig_status === "rigged").length });
});

router.get("/meshy/balance", async (_req, res) => {
  try {
    const data = await meshyFetch("/credits");
    res.json(data);
  } catch (e: any) { res.status(400).json({ error: e.message }); }
});

router.get("/meshy/task/:type/:id", async (req, res) => {
  const { type, id } = req.params;
  const validTypes = ["text-to-3d", "image-to-3d", "rigging", "animations"];
  if (!validTypes.includes(type)) { res.status(400).json({ error: `type: ${validTypes.join(",")}` }); return; }
  try {
    const base = type === "text-to-3d" ? MESHY_BASE_V2 : MESHY_BASE_V1;
    const data = await meshyFetch(`/${type}/${id}`, {}, base);
    res.json(data);
  } catch (e: any) { res.status(400).json({ error: e.message }); }
});

// Real-time char status from filesystem
router.get("/meshy/admin/char-status", (_req, res) => {
  const status = getCharStatus();
  const total_anims = Object.values(status).reduce((s, v) => s + v.animations.length, 0);
  res.json({ chars: status, total_animations: total_anims, total_chars: Object.keys(status).length });
});

// ── Text-to-3D ────────────────────────────────────────────────────────────────

router.post("/meshy/text-to-3d", async (req: Request, res: Response) => {
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  enableLongRunning(res);

  const { prompt, negative_prompt = "", art_style = "realistic", topology = "quad", target_polycount = 30000, should_remesh = true } = req.body ?? {};
  if (!prompt) { sseWrite(res, { event: "error", error: "prompt requerido" }); res.end(); return; }

  try {
    const created = await meshyFetch("/text-to-3d", {
      method: "POST",
      body: JSON.stringify({ mode: "preview", prompt, negative_prompt, art_style, topology, target_polycount, should_remesh, symmetry: false }),
    }, MESHY_BASE_V2);
    const taskId: string = created.result;
    sseWrite(res, { event: "started", task_id: taskId });

    let lastProgress = -1;
    for (let i = 0; i < MAX_POLL_ATTEMPTS; i++) {
      const data = await meshyFetch(`/text-to-3d/${taskId}`, {}, MESHY_BASE_V2);
      const progress: number = data.progress ?? 0;
      if (progress !== lastProgress) { sseWrite(res, { event: "progress", task_id: taskId, progress, status: data.status }); lastProgress = progress; }
      if (data.status === "SUCCEEDED") { sseWrite(res, { event: "done", task_id: taskId, output: data }); res.end(); return; }
      if (data.status === "FAILED" || data.status === "EXPIRED") { sseWrite(res, { event: "error", error: data.task_error?.message ?? data.status }); res.end(); return; }
      await new Promise(r => setTimeout(r, POLL_INTERVAL_MS));
    }
    sseWrite(res, { event: "timeout" }); res.end();
  } catch (e: any) { sseWrite(res, { event: "error", error: e.message }); res.end(); }
});

router.post("/meshy/text-to-3d/refine", async (req: Request, res: Response) => {
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  enableLongRunning(res);

  const { preview_task_id, texture_richness = "high" } = req.body ?? {};
  if (!preview_task_id) { sseWrite(res, { event: "error", error: "preview_task_id requerido" }); res.end(); return; }

  try {
    const created = await meshyFetch("/text-to-3d", {
      method: "POST",
      body: JSON.stringify({ mode: "refine", preview_task_id, texture_richness }),
    }, MESHY_BASE_V2);
    const taskId: string = created.result;
    sseWrite(res, { event: "started", task_id: taskId });

    let lastProgress = -1;
    for (let i = 0; i < MAX_POLL_ATTEMPTS; i++) {
      const data = await meshyFetch(`/text-to-3d/${taskId}`, {}, MESHY_BASE_V2);
      const progress: number = data.progress ?? 0;
      if (progress !== lastProgress) { sseWrite(res, { event: "progress", task_id: taskId, progress }); lastProgress = progress; }
      if (data.status === "SUCCEEDED") { sseWrite(res, { event: "done", task_id: taskId, output: data }); res.end(); return; }
      if (data.status === "FAILED" || data.status === "EXPIRED") { sseWrite(res, { event: "error", error: data.task_error?.message ?? data.status }); res.end(); return; }
      await new Promise(r => setTimeout(r, POLL_INTERVAL_MS));
    }
    sseWrite(res, { event: "timeout" }); res.end();
  } catch (e: any) { sseWrite(res, { event: "error", error: e.message }); res.end(); }
});

// ── Text-to-3D + Auto-Rig + Save pipeline (admin use) ────────────────────────

router.post("/meshy/pipeline/text-rig", async (req: Request, res: Response) => {
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  enableLongRunning(res);

  const { char_id, prompt, negative_prompt = "", art_style = "realistic" } = req.body ?? {};
  if (!char_id || !prompt) { sseWrite(res, { event: "error", error: "char_id y prompt requeridos" }); res.end(); return; }
  if (!/^[a-z0-9_]+$/i.test(char_id)) { sseWrite(res, { event: "error", error: "char_id inválido" }); res.end(); return; }

  try {
    // Phase 1: text-to-3d preview
    sseWrite(res, { event: "phase", phase: "text_to_3d", message: "Generando modelo 3D desde texto…" });
    const created = await meshyFetch("/text-to-3d", {
      method: "POST",
      body: JSON.stringify({ mode: "preview", prompt, negative_prompt, art_style, topology: "quad", target_polycount: 30000, should_remesh: true }),
    }, MESHY_BASE_V2);
    const taskId: string = created.result;
    sseWrite(res, { event: "started", task_id: taskId, char_id });

    let modelData: any = null;
    for (let i = 0; i < MAX_POLL_ATTEMPTS; i++) {
      const data = await meshyFetch(`/text-to-3d/${taskId}`, {}, MESHY_BASE_V2);
      sseWrite(res, { event: "progress", phase: "text_to_3d", task_id: taskId, progress: data.progress ?? 0 });
      if (data.status === "SUCCEEDED") { modelData = data; break; }
      if (data.status === "FAILED" || data.status === "EXPIRED") {
        sseWrite(res, { event: "error", error: data.task_error?.message ?? data.status }); res.end(); return;
      }
      await new Promise(r => setTimeout(r, POLL_INTERVAL_MS));
    }
    if (!modelData) { sseWrite(res, { event: "timeout", phase: "text_to_3d" }); res.end(); return; }

    // Phase 2: Download model GLB
    const glbUrl: string = modelData.model_urls?.glb ?? "";
    if (glbUrl) {
      await mkdir(MODELS_DIR, { recursive: true });
      await downloadToFile(glbUrl, join(MODELS_DIR, `${char_id}.glb`));
      sseWrite(res, { event: "progress", phase: "downloaded", char_id, glb_path: `/assets/3d/models/${char_id}.glb` });
    }

    // Phase 3: Auto-rig
    sseWrite(res, { event: "phase", phase: "rigging", message: "Aplicando auto-rig…" });
    const rigCreated = await meshyFetch("/rigging", {
      method: "POST",
      body: JSON.stringify({ input_task_id: taskId, model_url: glbUrl }),
    });
    const rigTaskId: string = rigCreated.result;
    sseWrite(res, { event: "progress", phase: "rigging", rig_task_id: rigTaskId });

    let rigData: any = null;
    for (let i = 0; i < 90; i++) {
      const rd = await meshyFetch(`/rigging/${rigTaskId}`);
      sseWrite(res, { event: "progress", phase: "rigging", rig_task_id: rigTaskId, progress: rd.progress ?? 0 });
      if (rd.status === "SUCCEEDED") { rigData = rd; break; }
      if (rd.status === "FAILED" || rd.status === "EXPIRED") {
        // No rig but model saved — still report done
        sseWrite(res, {
          event: "done", char_id, task_id: taskId,
          glb_path: `/assets/3d/models/${char_id}.glb`,
          thumbnail_url: modelData.thumbnail_url,
          rig_failed: true, rig_error: rd.task_error?.message,
        });
        res.end(); return;
      }
      await new Promise(r => setTimeout(r, POLL_INTERVAL_MS));
    }

    // Phase 4: Download rigged GLB + save rig_task_id
    let riggedGlbPath: string | null = null;
    if (rigData) {
      const riggedGlbUrl: string = rigData.result?.rigged_character_glb_url ?? "";
      if (riggedGlbUrl) {
        const charAnimDir = join(ANIMS_DIR, char_id);
        await mkdir(charAnimDir, { recursive: true });
        riggedGlbPath = `/assets/3d/animations/${char_id}/rigged.glb`;
        await downloadToFile(riggedGlbUrl, join(charAnimDir, "rigged.glb"));
      }

      // Save rig task ID for later animation use
      const metaPath = join(ANIMS_DIR, char_id, "meta.json");
      const meta = { char_id, rig_task_id: rigTaskId, t2d_task_id: taskId, created_at: new Date().toISOString() };
      await writeFile(metaPath, JSON.stringify(meta, null, 2));
    }

    sseWrite(res, {
      event: "done", char_id, task_id: taskId, rig_task_id: rigTaskId,
      glb_path: `/assets/3d/models/${char_id}.glb`,
      rigged_glb_path: riggedGlbPath,
      thumbnail_url: modelData.thumbnail_url,
      model_urls: modelData.model_urls,
    });
    res.end();
  } catch (e: any) {
    logger.error({ err: e }, "pipeline/text-rig error");
    sseWrite(res, { event: "error", error: e.message }); res.end();
  }
});

// ── Image-to-3D ───────────────────────────────────────────────────────────────

router.post("/meshy/image-to-3d", upload.single("image"), async (req: Request, res: Response) => {
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  enableLongRunning(res);

  if (!req.file) { sseWrite(res, { event: "error", error: "image requerida" }); res.end(); return; }

  const { topology = "quad", target_polycount = 30000, should_remesh = "true" } = req.body ?? {};
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
      body: JSON.stringify({ image_url: imageUrl, ai_model: "meshy-6", topology, target_polycount: Number(target_polycount), should_remesh: should_remesh !== "false" }),
    });
    const taskId: string = created.result;
    sseWrite(res, { event: "started", task_id: taskId });

    let lastProgress = -1;
    for (let i = 0; i < MAX_POLL_ATTEMPTS; i++) {
      const data = await meshyFetch(`/image-to-3d/${taskId}`);
      const progress: number = data.progress ?? 0;
      if (progress !== lastProgress) { sseWrite(res, { event: "progress", task_id: taskId, progress, status: data.status }); lastProgress = progress; }
      if (data.status === "SUCCEEDED") {
        sseWrite(res, { event: "done", task_id: taskId, output: data });
        res.end(); if (tempPath) unlink(tempPath).catch(() => {}); return;
      }
      if (data.status === "FAILED" || data.status === "EXPIRED") {
        sseWrite(res, { event: "error", error: data.task_error?.message ?? data.status });
        res.end(); if (tempPath) unlink(tempPath).catch(() => {}); return;
      }
      await new Promise(r => setTimeout(r, POLL_INTERVAL_MS));
    }
    sseWrite(res, { event: "timeout" }); res.end(); if (tempPath) unlink(tempPath).catch(() => {});
  } catch (e: any) {
    sseWrite(res, { event: "error", error: e.message }); res.end(); if (tempPath) unlink(tempPath).catch(() => {});
  }
});

// ── Manual Rigging ────────────────────────────────────────────────────────────

router.post("/meshy/rig", async (req: Request, res: Response) => {
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  enableLongRunning(res);

  const { input_task_id, model_url } = req.body ?? {};
  if (!input_task_id || !model_url) { sseWrite(res, { event: "error", error: "input_task_id y model_url requeridos" }); res.end(); return; }

  try {
    const created = await meshyFetch("/rigging", { method: "POST", body: JSON.stringify({ input_task_id, model_url }) });
    const rigTaskId: string = created.result;
    sseWrite(res, { event: "started", rig_task_id: rigTaskId });

    for (let i = 0; i < MAX_POLL_ATTEMPTS; i++) {
      const data = await meshyFetch(`/rigging/${rigTaskId}`);
      sseWrite(res, { event: "progress", rig_task_id: rigTaskId, progress: data.progress ?? 0, status: data.status });
      if (data.status === "SUCCEEDED") {
        const r = data.result ?? {};
        sseWrite(res, { event: "done", rig_task_id: rigTaskId, rigged_glb_url: r.rigged_character_glb_url, basic_animations: r.basic_animations });
        res.end(); return;
      }
      if (data.status === "FAILED" || data.status === "EXPIRED") {
        sseWrite(res, { event: "error", error: data.task_error?.message ?? data.status }); res.end(); return;
      }
      await new Promise(r => setTimeout(r, POLL_INTERVAL_MS));
    }
    sseWrite(res, { event: "timeout" }); res.end();
  } catch (e: any) { sseWrite(res, { event: "error", error: e.message }); res.end(); }
});

// ── Animate single (SSE) ──────────────────────────────────────────────────────

router.post("/meshy/animate", async (req: Request, res: Response) => {
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  enableLongRunning(res);

  const { rig_task_id, action_id, char_id, save_to_disk = false } = req.body ?? {};
  if (!rig_task_id || action_id === undefined) { sseWrite(res, { event: "error", error: "rig_task_id y action_id requeridos" }); res.end(); return; }

  try {
    const created = await meshyFetch("/animations", { method: "POST", body: JSON.stringify({ rig_task_id, action_id: Number(action_id) }) });
    const animTaskId: string = created.result;
    sseWrite(res, { event: "started", anim_task_id: animTaskId, action_id });

    for (let i = 0; i < MAX_POLL_ATTEMPTS; i++) {
      const data = await meshyFetch(`/animations/${animTaskId}`);
      sseWrite(res, { event: "progress", anim_task_id: animTaskId, progress: data.progress ?? 0, status: data.status });
      if (data.status === "SUCCEEDED") {
        // FIX: correct result key is animation_glb_url
        const glbUrl: string = data.result?.animation_glb_url ?? data.result?.animated_character_glb_url ?? "";
        let savedPath: string | null = null;
        if (save_to_disk && char_id && glbUrl) {
          const animName = ACTION_MAP[Number(action_id)] ?? `action_${action_id}`;
          const charAnimDir = join(ANIMS_DIR, char_id);
          await mkdir(charAnimDir, { recursive: true });
          const dest = join(charAnimDir, `${animName}.glb`);
          await downloadToFile(glbUrl, dest);
          savedPath = `/assets/3d/animations/${char_id}/${animName}.glb`;
        }
        sseWrite(res, { event: "done", anim_task_id: animTaskId, action_id, animated_glb_url: glbUrl, saved_path: savedPath });
        res.end(); return;
      }
      if (data.status === "FAILED" || data.status === "EXPIRED") {
        sseWrite(res, { event: "error", error: data.task_error?.message ?? data.status }); res.end(); return;
      }
      await new Promise(r => setTimeout(r, POLL_INTERVAL_MS));
    }
    sseWrite(res, { event: "timeout" }); res.end();
  } catch (e: any) { sseWrite(res, { event: "error", error: e.message }); res.end(); }
});

// ── Admin: Bulk-animate (launch all missing action_ids for a char) ────────────

router.post("/meshy/admin/bulk-animate", async (req: Request, res: Response) => {
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  enableLongRunning(res);

  const { char_id, rig_task_id } = req.body ?? {};
  if (!char_id || !rig_task_id) { sseWrite(res, { event: "error", error: "char_id y rig_task_id requeridos" }); res.end(); return; }

  const charAnimDir = join(ANIMS_DIR, char_id);
  await mkdir(charAnimDir, { recursive: true });

  // Find which action_ids are missing
  const existing = new Set<string>();
  try {
    for (const f of readdirSync(charAnimDir)) {
      if (f.endsWith(".glb") && f !== "rigged.glb") existing.add(f.replace(".glb", ""));
    }
  } catch {}

  const missing = Object.entries(ACTION_MAP).filter(([, name]) => !existing.has(name));
  sseWrite(res, { event: "started", char_id, missing_count: missing.length, missing_ids: missing.map(([id]) => Number(id)) });

  if (missing.length === 0) {
    sseWrite(res, { event: "done", char_id, message: "Todas las animaciones ya existen", downloaded: 0 }); res.end(); return;
  }

  // Launch all missing tasks in parallel
  const taskMap: Record<string, { action_id: number; anim_name: string }> = {};
  await Promise.all(
    missing.map(async ([actionIdStr, animName]) => {
      const action_id = Number(actionIdStr);
      try {
        const created = await meshyFetch("/animations", { method: "POST", body: JSON.stringify({ rig_task_id, action_id }) });
        const tid: string = created.result ?? "";
        if (tid) taskMap[tid] = { action_id, anim_name: animName };
      } catch (e: any) {
        sseWrite(res, { event: "launch_error", action_id, error: e.message });
      }
    })
  );

  sseWrite(res, { event: "tasks_launched", count: Object.keys(taskMap).length });

  // Poll and download as they complete
  let pending = { ...taskMap };
  let downloaded = 0;
  const MAX_BULK_POLLS = 150;

  for (let attempt = 0; attempt < MAX_BULK_POLLS && Object.keys(pending).length > 0; attempt++) {
    await new Promise(r => setTimeout(r, 5000));
    const stillPending: typeof pending = {};

    await Promise.all(
      Object.entries(pending).map(async ([tid, task]) => {
        try {
          const data = await meshyFetch(`/animations/${tid}`);
          if (data.status === "SUCCEEDED") {
            const glbUrl: string = data.result?.animation_glb_url ?? data.result?.animated_character_glb_url ?? "";
            if (glbUrl) {
              const dest = join(charAnimDir, `${task.anim_name}.glb`);
              await downloadToFile(glbUrl, dest);
              downloaded++;
              sseWrite(res, { event: "animation_ready", char_id, action_id: task.action_id, anim_name: task.anim_name, glb_path: `/assets/3d/animations/${char_id}/${task.anim_name}.glb` });
            }
          } else if (data.status === "FAILED" || data.status === "EXPIRED") {
            sseWrite(res, { event: "animation_failed", char_id, action_id: task.action_id, anim_name: task.anim_name });
          } else {
            stillPending[tid] = task;
          }
        } catch {
          stillPending[tid] = task;
        }
      })
    );

    pending = stillPending;
    sseWrite(res, { event: "poll", attempt, remaining: Object.keys(pending).length, downloaded });
  }

  sseWrite(res, { event: "done", char_id, downloaded, remaining: Object.keys(pending).length });
  res.end();
});

// ── Fábrica de Personajes (imagen → GLB → rig → animaciones) ─────────────────

router.post("/meshy/generate-character", upload.single("image"), async (req: Request, res: Response) => {
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  enableLongRunning(res);

  if (!req.file) { sseWrite(res, { event: "error", error: "image requerida" }); res.end(); return; }
  const { characterId } = req.body ?? {};
  if (!characterId || !/^[a-z0-9_]+$/i.test(characterId)) { sseWrite(res, { event: "error", error: "characterId inválido" }); res.end(); return; }

  let tempPath: string | null = null;

  try {
    await mkdir(TEMP_DIR, { recursive: true });
    await mkdir(MODELS_DIR, { recursive: true });
    const ext = req.file.mimetype.includes("png") ? "png" : "jpg";
    const filename = `tmp_${characterId}_${Date.now()}.${ext}`;
    tempPath = join(TEMP_DIR, filename);
    await writeFile(tempPath, req.file.buffer);
    sseWrite(res, { event: "progress", phase: "upload", message: "Imagen cargada, iniciando Meshy…", progress: 5 });

    const devDomain = process.env.REPLIT_DEV_DOMAIN ?? "localhost:19080";
    const imageUrl = `https://${devDomain}/assets/3d/temp/${filename}`;

    // Phase 1: image-to-3d
    sseWrite(res, { event: "phase", phase: "image_to_3d", message: "Generando modelo 3D…" });
    const created = await meshyFetch("/image-to-3d", {
      method: "POST",
      body: JSON.stringify({ image_url: imageUrl, ai_model: "meshy-6", topology: "quad", target_polycount: 30000, should_remesh: true }),
    });
    const taskId: string = created.result;
    sseWrite(res, { event: "started", task_id: taskId, character_id: characterId });

    let modelData: any = null;
    for (let i = 0; i < MAX_POLL_ATTEMPTS; i++) {
      const data = await meshyFetch(`/image-to-3d/${taskId}`);
      sseWrite(res, { event: "progress", task_id: taskId, progress: data.progress ?? 0, status: data.status, phase: "image_to_3d", character_id: characterId });
      if (data.status === "SUCCEEDED") { modelData = data; break; }
      if (data.status === "FAILED" || data.status === "EXPIRED") {
        sseWrite(res, { event: "error", error: data.task_error?.message ?? data.status }); res.end();
        if (tempPath) unlink(tempPath).catch(() => {}); return;
      }
      await new Promise(r => setTimeout(r, POLL_INTERVAL_MS));
    }
    if (!modelData) { sseWrite(res, { event: "timeout" }); res.end(); if (tempPath) unlink(tempPath).catch(() => {}); return; }

    // Phase 2: Download GLB
    sseWrite(res, { event: "phase", phase: "downloading", message: "Descargando GLB…", progress: 100 });
    const glbUrl: string = modelData.model_urls?.glb ?? "";
    if (!glbUrl) throw new Error("No GLB URL en respuesta Meshy");
    await downloadToFile(glbUrl, join(MODELS_DIR, `${characterId}.glb`));
    if (tempPath) { unlink(tempPath).catch(() => {}); tempPath = null; }

    // Phase 3: Auto-rig
    sseWrite(res, { event: "phase", phase: "rigging", message: "Iniciando auto-rig…" });
    try {
      const rigCreated = await meshyFetch("/rigging", { method: "POST", body: JSON.stringify({ input_task_id: taskId, model_url: glbUrl }) });
      const rigTaskId: string = rigCreated.result;
      sseWrite(res, { event: "progress", rig_task_id: rigTaskId, phase: "rigging", message: "Procesando rig…" });

      for (let i = 0; i < 90; i++) {
        const rigData = await meshyFetch(`/rigging/${rigTaskId}`);
        sseWrite(res, { event: "progress", rig_task_id: rigTaskId, progress: rigData.progress ?? 0, status: rigData.status, phase: "rigging" });
        if (rigData.status === "SUCCEEDED") {
          const rigResult = rigData.result ?? {};
          // Download rigged GLB
          const riggedGlbUrl: string = rigResult.rigged_character_glb_url ?? "";
          const charAnimDir = join(ANIMS_DIR, characterId);
          await mkdir(charAnimDir, { recursive: true });
          if (riggedGlbUrl) {
            await downloadToFile(riggedGlbUrl, join(charAnimDir, "rigged.glb"));
          }
          // Save meta for bulk-animate
          const meta = { char_id: characterId, rig_task_id: rigTaskId, i2d_task_id: taskId, created_at: new Date().toISOString() };
          await writeFile(join(charAnimDir, "meta.json"), JSON.stringify(meta, null, 2));

          sseWrite(res, {
            event: "done", task_id: taskId, rig_task_id: rigTaskId, character_id: characterId,
            glb_path: `/assets/3d/models/${characterId}.glb`,
            rigged_glb_path: `/assets/3d/animations/${characterId}/rigged.glb`,
            thumbnail_url: modelData.thumbnail_url, model_urls: modelData.model_urls,
            can_animate: true,
          });
          res.end(); return;
        }
        if (rigData.status === "FAILED" || rigData.status === "EXPIRED") break;
        await new Promise(r => setTimeout(r, POLL_INTERVAL_MS));
      }
    } catch (_) {}

    // Done without rig
    sseWrite(res, {
      event: "done", task_id: taskId, character_id: characterId,
      glb_path: `/assets/3d/models/${characterId}.glb`,
      thumbnail_url: modelData.thumbnail_url, model_urls: modelData.model_urls,
      rig_skipped: true, can_animate: false,
    });
    res.end();

  } catch (e: any) {
    logger.error({ err: e }, "generate-character error");
    sseWrite(res, { event: "error", character_id: characterId, error: e.message }); res.end();
    if (tempPath) unlink(tempPath).catch(() => {});
  }
});

export default router;
