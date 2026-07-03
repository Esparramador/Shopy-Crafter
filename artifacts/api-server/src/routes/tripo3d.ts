import { Router, type Request, type Response } from "express";
import multer from "multer";
import { existsSync, readdirSync, createWriteStream } from "fs";
import { mkdir, writeFile } from "fs/promises";
import { join } from "path";
import { pipeline } from "stream/promises";
import { enableLongRunning } from "../lib/long-running.js";
import { logger } from "../lib/logger.js";
import { askClaudeWithBrain } from "../lib/claude.js";
import { saveToVault } from "../lib/vault.js";

const router = Router();

const FRONTEND_PUBLIC = join(process.cwd(), "..", "..", "artifacts", "shopify-optimizer", "public");
const TRIPO3D_LOCAL_DIR = join(FRONTEND_PUBLIC, "assets", "3d", "tripo3d");

// Ensure directory exists
if (!existsSync(TRIPO3D_LOCAL_DIR)) {
  mkdir(TRIPO3D_LOCAL_DIR, { recursive: true }).catch(err => logger.error({ err }, "Error creating Tripo3D local dir"));
}

async function downloadAndSaveTripoModel(taskId: string, glbUrl: string) {
  try {
    const response = await fetch(glbUrl);
    if (!response.ok) throw new Error(`Failed to download GLB: ${response.statusText}`);
    const filePath = join(TRIPO3D_LOCAL_DIR, `${taskId}.glb`);
    const fileStream = createWriteStream(filePath);
    if (response.body) {
      await pipeline(response.body as any, fileStream);
      logger.info({ taskId, filePath }, "Tripo3D model saved locally");
    }
  } catch (error) {
    logger.error({ error, taskId, glbUrl }, "Error downloading/saving Tripo3D model");
  }
}

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 30 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (file.mimetype.startsWith("image/")) cb(null, true);
    else cb(new Error("Solo se aceptan imágenes"));
  },
});

const multiUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 30 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (file.mimetype.startsWith("image/")) cb(null, true);
    else cb(new Error("Solo se aceptan imágenes"));
  },
});

// ── Constants ───────────────────────────────────────────────────────────────

const TRIPO_BASE = "https://api.tripo3d.ai/v2/openapi";

const POLL_INTERVAL_MS = 3_000;
const MAX_POLL_ATTEMPTS = 120; // 6 min max

export const TRIPO_ANIMATIONS: Array<{
  id: string;
  label: string;
  category: string;
  description: string;
  looping: boolean;
  tags: string[];
}> = [
  // ── Locomotion ──────────────────────────────────────────────────────────
  { id: "walk",          label: "Caminar",           category: "locomotion", description: "Ciclo de caminata hacia adelante, perfecta para personajes en movimiento", looping: true,  tags: ["basic","loop","movement"] },
  { id: "run",           label: "Correr",            category: "locomotion", description: "Ciclo de carrera hacia adelante, alta energía", looping: true,  tags: ["basic","loop","movement","fast"] },
  { id: "jog",           label: "Trotar",            category: "locomotion", description: "Trote a ritmo medio entre caminar y correr", looping: true,  tags: ["loop","movement","sport"] },
  { id: "backward_walk", label: "Caminar atrás",     category: "locomotion", description: "Caminar hacia atrás con naturalidad", looping: true,  tags: ["loop","movement"] },
  { id: "sneak",         label: "Sigilo",            category: "locomotion", description: "Caminar en puntillas, movimiento sigiloso", looping: true,  tags: ["loop","stealth","game"] },
  { id: "jump",          label: "Saltar",            category: "locomotion", description: "Salto en el lugar con aterrizaje suave", looping: false, tags: ["basic","action","game"] },
  { id: "run_jump",      label: "Salto en carrera",  category: "locomotion", description: "Salto largo mientras corre, atletismo", looping: false, tags: ["action","sport","game"] },
  { id: "strafe_left",   label: "Paso lateral izq.", category: "locomotion", description: "Desplazamiento lateral hacia la izquierda", looping: true,  tags: ["loop","game","combat"] },
  { id: "strafe_right",  label: "Paso lateral der.", category: "locomotion", description: "Desplazamiento lateral hacia la derecha", looping: true,  tags: ["loop","game","combat"] },

  // ── Idle ────────────────────────────────────────────────────────────────
  { id: "idle",          label: "Reposo estándar",   category: "idle",       description: "Pose de reposo con respiración sutil — ideal como animación base de bucle", looping: true,  tags: ["basic","loop","default"] },
  { id: "idle_hip_hop",  label: "Reposo Hip Hop",    category: "idle",       description: "Reposo con bounce hip hop, ritmo y actitud", looping: true,  tags: ["loop","dance","casual"] },
  { id: "fidget",        label: "Inquieto",          category: "idle",       description: "Personaje inquieto, movimientos nerviosos sutiles", looping: true,  tags: ["loop","emotion","NPC"] },
  { id: "look_around",   label: "Mirar alrededor",   category: "idle",       description: "Personaje mira a los lados, detectando entorno", looping: false, tags: ["action","NPC","lookdev"] },

  // ── Gestures ────────────────────────────────────────────────────────────
  { id: "wave",          label: "Saludar con mano",  category: "gesture",    description: "Gesto amigable de saludo — perfecto para intros de personaje", looping: false, tags: ["social","greeting","friendly"] },
  { id: "wave_goodbye",  label: "Adiós",             category: "gesture",    description: "Gesto de despedida con la mano", looping: false, tags: ["social","goodbye"] },
  { id: "clap",          label: "Aplaudir",          category: "gesture",    description: "Palmadas de aplauso — celebración o aprobación", looping: false, tags: ["social","emotion","celebration"] },
  { id: "bow",           label: "Reverencia",        category: "gesture",    description: "Inclinación de respeto — saludos formales o japoneses", looping: false, tags: ["social","formal","greeting"] },
  { id: "nod",           label: "Asentir",           category: "gesture",    description: "Movimiento de cabeza afirmativo — sí", looping: false, tags: ["social","reaction","communication"] },
  { id: "shake_head",    label: "Negar",             category: "gesture",    description: "Movimiento de cabeza negativo — no", looping: false, tags: ["social","reaction","communication"] },
  { id: "point",         label: "Señalar",           category: "gesture",    description: "Señalar hacia adelante/arriba — llamada a la acción", looping: false, tags: ["action","direction","presentation"] },
  { id: "thumbs_up",     label: "Pulgar arriba",     category: "gesture",    description: "Gesto positivo universal — aprobación y optimismo", looping: false, tags: ["social","positive","emoji"] },
  { id: "think",         label: "Pensar",            category: "gesture",    description: "Pose pensativa con mano en mentón — reflexión o duda", looping: false, tags: ["emotion","intellectual","NPC"] },
  { id: "shrug",         label: "Encogerse de hombros", category: "gesture", description: "Expresión de desconocimiento o indiferencia", looping: false, tags: ["emotion","social","casual"] },

  // ── Dance ───────────────────────────────────────────────────────────────
  { id: "hip_hop_dance", label: "Baile Hip Hop",     category: "dance",      description: "Coreografía hip hop completa — enérgica y moderna", looping: true,  tags: ["dance","hiphop","party","loop"] },
  { id: "robot_dance",   label: "Baile Robot",       category: "dance",      description: "Movimientos mecánicos y robóticos al ritmo de la música", looping: true,  tags: ["dance","robot","fun","loop"] },
  { id: "salsa",         label: "Salsa",             category: "dance",      description: "Pasos básicos de salsa, movimiento de caderas y pies", looping: true,  tags: ["dance","latin","party","loop"] },
  { id: "breakdance",    label: "Breakdance",        category: "dance",      description: "Movimientos de street dance con giros y trabajo de piso", looping: false, tags: ["dance","street","athletic"] },
  { id: "gangnam_style", label: "Caballito",         category: "dance",      description: "El icónico movimiento de caballito del Gangnam Style", looping: true,  tags: ["dance","viral","fun","loop"] },

  // ── Emotes ──────────────────────────────────────────────────────────────
  { id: "angry",         label: "Enojado",           category: "emote",      description: "Expresión de enfado — postura agresiva con puños", looping: false, tags: ["emotion","combat-ready","NPC"] },
  { id: "cry",           label: "Llorar",            category: "emote",      description: "Animación de llanto — personaje triste y emotivo", looping: false, tags: ["emotion","sad","storytelling"] },
  { id: "think",         label: "Pensativo",         category: "emote",      description: "Postura de reflexión intensa, mano en la barbilla", looping: false, tags: ["emotion","intellectual"] },
  { id: "celebrate",     label: "Celebrar",          category: "emote",      description: "Celebración eufórica — brazos en alto, victoria", looping: false, tags: ["emotion","positive","victory","celebration"] },
  { id: "cheer",         label: "Animar",            category: "emote",      description: "Animar con energía — apoyo a un equipo o logro", looping: false, tags: ["emotion","positive","sport"] },
  { id: "surprise",      label: "Sorprendido",       category: "emote",      description: "Reacción de sorpresa genuina — manos en la cara", looping: false, tags: ["emotion","reaction","NPC"] },
  { id: "happy",         label: "Feliz",             category: "emote",      description: "Salto de alegría o expresión de felicidad intensa", looping: false, tags: ["emotion","positive","energetic"] },
  { id: "laugh",         label: "Reír",              category: "emote",      description: "Carcajada expresiva — personaje riendo a carcajadas", looping: false, tags: ["emotion","social","positive"] },
  { id: "scared",        label: "Asustado",          category: "emote",      description: "Reacción de miedo — retroceder y cubrirse", looping: false, tags: ["emotion","horror","NPC"] },

  // ── Combat ──────────────────────────────────────────────────────────────
  { id: "punch",         label: "Puñetazo",          category: "combat",     description: "Golpe directo de puño derecho — acción de combate básica", looping: false, tags: ["combat","game","action","attack"] },
  { id: "kick",          label: "Patada frontal",    category: "combat",     description: "Patada frontal al pecho — combate cuerpo a cuerpo", looping: false, tags: ["combat","game","martial-arts","attack"] },
  { id: "slash",         label: "Espadazo",          category: "combat",     description: "Ataque diagonal con espada o arma blanca", looping: false, tags: ["combat","game","weapon","attack"] },
  { id: "cast",          label: "Lanzar magia",      category: "combat",     description: "Gesto de lanzamiento de hechizo — fantasy/RPG", looping: false, tags: ["combat","magic","fantasy","RPG"] },
  { id: "hit",           label: "Recibir golpe",     category: "combat",     description: "Reacción de impacto — el personaje absorbe un golpe", looping: false, tags: ["combat","reaction","game"] },
  { id: "dodge",         label: "Esquivar",          category: "combat",     description: "Movimiento rápido de evasión lateral", looping: false, tags: ["combat","game","agile"] },
  { id: "die",           label: "Morir / Caer",      category: "combat",     description: "Caída de muerte hacia atrás — game over, cinemáticas", looping: false, tags: ["combat","game","death","cinematic"] },
  { id: "combat_idle",   label: "Guardia de combate",category: "combat",     description: "Postura de combate en alerta — listo para atacar", looping: true,  tags: ["combat","loop","game","stance"] },

  // ── Sit / Crouch ────────────────────────────────────────────────────────
  { id: "sit_down",      label: "Sentarse",          category: "sit",        description: "Acción de sentarse en una silla — animación de transición", looping: false, tags: ["activity","transition","casual"] },
  { id: "sit_idle",      label: "Sentado en reposo", category: "sit",        description: "Reposo sentado — espera o conversación en silla", looping: true,  tags: ["loop","casual","NPC","indoor"] },
  { id: "stand_up",      label: "Levantarse",        category: "sit",        description: "Levantarse desde posición sentada — transición inversa", looping: false, tags: ["activity","transition"] },
  { id: "crouch",        label: "Agacharse",         category: "sit",        description: "Postura agachada de combate o sigilo", looping: false, tags: ["game","stealth","combat"] },
  { id: "crouch_idle",   label: "Agachado en reposo",category: "sit",        description: "Reposo en cuclillas — sigilo mantenido", looping: true,  tags: ["loop","game","stealth"] },
  { id: "crouch_walk",   label: "Caminar agachado",  category: "sit",        description: "Avanzar sigilosamente agachado", looping: true,  tags: ["loop","game","stealth","movement"] },

  // ── Activities ──────────────────────────────────────────────────────────
  { id: "typing",        label: "Escribir teclado",  category: "activity",   description: "Personaje tecleando activamente — escenas de oficina/tech", looping: true,  tags: ["loop","work","tech","indoor"] },
  { id: "phone",         label: "Hablar por teléfono",category: "activity",  description: "Conversación telefónica con gesticulación natural", looping: true,  tags: ["loop","communication","work","casual"] },
  { id: "present",       label: "Presentar / Mostrar",category: "activity",  description: "Gesto de presentación formal — señalar, mostrar contenido", looping: false, tags: ["work","presentation","professional"] },
  { id: "push_up",       label: "Flexiones",         category: "activity",   description: "Ejercicio de push-ups — atletismo y fitness", looping: true,  tags: ["loop","sport","fitness"] },
  { id: "pick_up",       label: "Recoger objeto",    category: "activity",   description: "Agacharse y recoger algo del suelo", looping: false, tags: ["action","game","interactive"] },
  { id: "throw",         label: "Lanzar",            category: "activity",   description: "Lanzamiento de objeto — deporte o combate", looping: false, tags: ["action","sport","game"] },
  { id: "climb",         label: "Escalar",           category: "activity",   description: "Animación de escalada vertical", looping: true,  tags: ["action","movement","outdoor"] },
  { id: "swim",          label: "Nadar",             category: "activity",   description: "Estilo libre de natación", looping: true,  tags: ["action","movement","water"] },
  { id: "drive",         label: "Conducir",          category: "activity",   description: "Postura de conducción de vehículo", looping: true,  tags: ["action","vehicle","casual"] },
  { id: "yoga",          label: "Yoga",              category: "activity",   description: "Postura de meditación yoga", looping: true,  tags: ["action","relax","fitness"] },
];

export const ANIMATION_CATEGORIES = [
  { id: "locomotion", label: "Locomoción", icon: "🚶" },
  { id: "idle",       label: "Reposo",     icon: "🧍" },
  { id: "gesture",    label: "Gestos",     icon: "👋" },
  { id: "dance",      label: "Baile",      icon: "💃" },
  { id: "emote",      label: "Emociones",  icon: "😄" },
  { id: "combat",     label: "Combate",    icon: "⚔️"  },
  { id: "sit",        label: "Sentarse",   icon: "🪑" },
  { id: "activity",   label: "Actividad",  icon: "💻" },
];

// ── Tripo3D HTTP helpers ─────────────────────────────────────────────────────

function getTripoKey(): string {
  const key = process.env.TRIPO_API_KEY;
  if (!key) throw new Error("TRIPO_API_KEY no configurada. Añade la clave en los secretos del entorno.");
  return key;
}

async function tripoFetch(path: string, options: RequestInit = {}): Promise<any> {
  const key = getTripoKey();
  const res = await fetch(`${TRIPO_BASE}${path}`, {
    ...options,
    headers: {
      "Authorization": `Bearer ${key}`,
      "Content-Type": "application/json",
      ...options.headers,
    },
  });
  const data = await res.json() as any;
  if (!res.ok || data.code !== 0) {
    throw new Error(data.message || `Tripo3D error: HTTP ${res.status}`);
  }
  return data.data ?? data;
}

async function tripoUploadFile(buffer: Buffer, mimeType: string, filename: string): Promise<string> {
  const key = getTripoKey();
  const formData = new FormData();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const blob = new Blob([buffer as any], { type: mimeType });
  formData.append("file", blob, filename);

  const res = await fetch(`${TRIPO_BASE}/upload`, {
    method: "POST",
    headers: { "Authorization": `Bearer ${key}` },
    body: formData,
  });
  const data = await res.json() as any;
  if (!res.ok || data.code !== 0) {
    throw new Error(data.message || `Upload error: HTTP ${res.status}`);
  }
  return data.data.image_token as string;
}

async function tripoCreateTask(input: Record<string, any>): Promise<string> {
  const data = await tripoFetch("/task", {
    method: "POST",
    body: JSON.stringify(input),
  });
  return data.task_id as string;
}

async function tripoPollTask(taskId: string): Promise<any> {
  for (let i = 0; i < MAX_POLL_ATTEMPTS; i++) {
    const data = await tripoFetch(`/task/${taskId}`);
    const status: string = data.status;
    if (status === "success") return data;
    if (status === "failed" || status === "cancelled") {
      throw new Error(`Task ${taskId} ${status}`);
    }
    await new Promise(r => setTimeout(r, POLL_INTERVAL_MS));
  }
  throw new Error(`Task ${taskId} timed out after ${MAX_POLL_ATTEMPTS * POLL_INTERVAL_MS / 1000}s`);
}

// ── Routes ───────────────────────────────────────────────────────────────────

/* GET /api/tripo3d/animations — lista de presets con metadatos */
router.get("/api/tripo3d/animations", async (_req, res) => {
  res.json({
    animations: TRIPO_ANIMATIONS,
    categories: ANIMATION_CATEGORIES,
    total: TRIPO_ANIMATIONS.length,
  });
});

/* GET /api/tripo3d/balance — saldo Tripo3D */
router.get("/api/tripo3d/balance", async (_req, res) => {
  try {
    const data = await tripoFetch("/user/balance");
    res.json(data);
  } catch (e: any) {
    res.status(400).json({ error: e.message });
  }
});

/* GET /api/tripo3d/task/:taskId — poll task status */
router.get("/api/tripo3d/task/:taskId", async (req, res) => {
  try {
    const data = await tripoFetch(`/task/${req.params.taskId}`);
    res.json(data);
  } catch (e: any) {
    res.status(400).json({ error: e.message });
  }
});

/* POST /api/tripo3d/text-to-model — texto → 3D */
router.post("/api/tripo3d/text-to-model", async (req: Request, res: Response) => {
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  enableLongRunning(res);
  const { prompt, model_version = "v2.5", texture = true, pbr = true, face_limit, negative_prompt } = req.body ?? {};
  if (!prompt) { res.status(400).json({ error: "prompt requerido" }); return; }
  try {
    const taskId = await tripoCreateTask({
      type: "text_to_model",
      prompt,
      negative_prompt: negative_prompt || undefined,
      model_version, // Soporta v2.5 (junio 2026)
      texture,
      pbr,
      face_limit: face_limit ? Number(face_limit) : undefined,
    });
    res.write(`data: ${JSON.stringify({ event: "started", task_id: taskId })}\n\n`);

    let lastProgress = 0;
    for (let i = 0; i < MAX_POLL_ATTEMPTS; i++) {
      const data = await tripoFetch(`/task/${taskId}`);
      const status: string = data.status;
      const progress: number = data.progress ?? 0;
      if (progress !== lastProgress) {
        res.write(`data: ${JSON.stringify({ event: "progress", task_id: taskId, progress, status })}\n\n`);
        lastProgress = progress;
      }
      if (status === "success") {
        const glbUrl = data.output?.model || data.output?.glb;
        if (glbUrl) {
          downloadAndSaveTripoModel(taskId, glbUrl);
        }
        res.write(`data: ${JSON.stringify({ event: "done", task_id: taskId, output: data.output, progress: 100 })}\n\n`);
        res.end();
        return;
      }
      if (status === "failed" || status === "cancelled") {
        res.write(`data: ${JSON.stringify({ event: "error", task_id: taskId, error: `Task ${status}` })}\n\n`);
        res.end();
        return;
      }
      await new Promise(r => setTimeout(r, POLL_INTERVAL_MS));
    }
    res.write(`data: ${JSON.stringify({ event: "timeout", task_id: taskId })}\n\n`);
    res.end();
  } catch (e: any) {
    logger.error({ err: e }, "tripo3d text-to-model error");
    res.write(`data: ${JSON.stringify({ event: "error", error: e.message })}\n\n`);
    res.end();
  }
});

/* POST /api/tripo3d/image-to-model — imagen → 3D */
router.post("/api/tripo3d/image-to-model", upload.single("image"), async (req: Request, res: Response) => {
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  enableLongRunning(res);
  if (!req.file) { res.status(400).json({ error: "image requerida" }); return; }
  const { model_version = "v2.5", texture = true, pbr = true, face_limit } = req.body ?? {};
  try {
    const imageToken = await tripoUploadFile(req.file.buffer, req.file.mimetype, req.file.originalname);
    const taskId = await tripoCreateTask({
      type: "image_to_model",
      file: { type: "jpg", file_token: imageToken },
      model_version, // Soporta v2.5
      texture: texture !== "false",
      pbr: pbr !== "false",
      face_limit: face_limit ? Number(face_limit) : undefined,
    });
    res.write(`data: ${JSON.stringify({ event: "started", task_id: taskId })}\n\n`);

    for (let i = 0; i < MAX_POLL_ATTEMPTS; i++) {
      const data = await tripoFetch(`/task/${taskId}`);
      const status: string = data.status;
      const progress: number = data.progress ?? 0;
      res.write(`data: ${JSON.stringify({ event: "progress", task_id: taskId, progress, status })}\n\n`);
      if (status === "success") {
        const glbUrl = data.output?.model || data.output?.glb;
        if (glbUrl) {
          downloadAndSaveTripoModel(taskId, glbUrl);
        }
        res.write(`data: ${JSON.stringify({ event: "done", task_id: taskId, output: data.output, progress: 100 })}\n\n`);
        res.end();
        return;
      }
      if (status === "failed" || status === "cancelled") {
        res.write(`data: ${JSON.stringify({ event: "error", task_id: taskId, error: `Task ${status}` })}\n\n`);
        res.end();
        return;
      }
      await new Promise(r => setTimeout(r, POLL_INTERVAL_MS));
    }
    res.write(`data: ${JSON.stringify({ event: "timeout", task_id: taskId })}\n\n`);
    res.end();
  } catch (e: any) {
    logger.error({ err: e }, "tripo3d image-to-model error");
    res.write(`data: ${JSON.stringify({ event: "error", error: e.message })}\n\n`);
    res.end();
  }
});

/* POST /api/tripo3d/multiview-to-model — 4 imágenes → 3D */
router.post(
  "/api/tripo3d/multiview-to-model",
  multiUpload.fields([
    { name: "front", maxCount: 1 },
    { name: "left",  maxCount: 1 },
    { name: "back",  maxCount: 1 },
    { name: "right", maxCount: 1 },
  ]),
  async (req: Request, res: Response) => {
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    enableLongRunning(res);
    const files = req.files as Record<string, Express.Multer.File[]>;
    if (!files?.front?.[0]) { res.status(400).json({ error: "Al menos la imagen frontal es requerida" }); return; }
    const { model_version = "default", texture = true, pbr = true } = req.body ?? {};
    try {
      const uploadView = async (f: Express.Multer.File | undefined) => {
        if (!f) return null;
        const token = await tripoUploadFile(f.buffer, f.mimetype, f.originalname);
        return { type: "jpg", file_token: token };
      };
      const [frontTk, leftTk, backTk, rightTk] = await Promise.all([
        uploadView(files.front?.[0]),
        uploadView(files.left?.[0]),
        uploadView(files.back?.[0]),
        uploadView(files.right?.[0]),
      ]);
      const fileTokens = [frontTk, leftTk, backTk, rightTk].filter(Boolean);
      const taskId = await tripoCreateTask({
        type: "multiview_to_model",
        files: fileTokens,
        model_version,
        texture: texture !== "false",
        pbr: pbr !== "false",
      });
      res.write(`data: ${JSON.stringify({ event: "started", task_id: taskId })}\n\n`);

      for (let i = 0; i < MAX_POLL_ATTEMPTS; i++) {
        const data = await tripoFetch(`/task/${taskId}`);
        const status: string = data.status;
        const progress: number = data.progress ?? 0;
        res.write(`data: ${JSON.stringify({ event: "progress", task_id: taskId, progress, status })}\n\n`);
        if (status === "success") {
          res.write(`data: ${JSON.stringify({ event: "done", task_id: taskId, output: data.output, progress: 100 })}\n\n`);
          res.end();
          return;
        }
        if (status === "failed" || status === "cancelled") {
          res.write(`data: ${JSON.stringify({ event: "error", task_id: taskId, error: `Task ${status}` })}\n\n`);
          res.end();
          return;
        }
        await new Promise(r => setTimeout(r, POLL_INTERVAL_MS));
      }
      res.write(`data: ${JSON.stringify({ event: "timeout", task_id: taskId })}\n\n`);
      res.end();
    } catch (e: any) {
      logger.error({ err: e }, "tripo3d multiview-to-model error");
      res.write(`data: ${JSON.stringify({ event: "error", error: e.message })}\n\n`);
      res.end();
    }
  }
);

/* POST /api/tripo3d/refine — refinar borrador */
router.post("/api/tripo3d/refine", async (req: Request, res: Response) => {
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  enableLongRunning(res);
  const { draft_model_task_id, texture = true, pbr = true, face_limit } = req.body ?? {};
  if (!draft_model_task_id) { res.status(400).json({ error: "draft_model_task_id requerido" }); return; }
  try {
    const taskId = await tripoCreateTask({
      type: "refine_model",
      draft_model_task_id,
      texture,
      pbr,
      face_limit: face_limit ? Number(face_limit) : undefined,
    });
    res.write(`data: ${JSON.stringify({ event: "started", task_id: taskId })}\n\n`);
    const data = await tripoPollTask(taskId);
    res.write(`data: ${JSON.stringify({ event: "done", task_id: taskId, output: data.output })}\n\n`);
    res.end();
  } catch (e: any) {
    res.write(`data: ${JSON.stringify({ event: "error", error: e.message })}\n\n`);
    res.end();
  }
});

/* POST /api/tripo3d/prerig — comprobar si el modelo puede ser rigueado */
router.post("/api/tripo3d/prerig", async (req: Request, res: Response) => {
  const { original_model_task_id } = req.body ?? {};
  if (!original_model_task_id) { res.status(400).json({ error: "original_model_task_id requerido" }); return; }
  try {
    const taskId = await tripoCreateTask({
      type: "animate_prerigcheck",
      original_model_task_id,
    });
    // Prerig check es rápido, hacemos poll síncrono
    const data = await tripoPollTask(taskId);
    res.json({ task_id: taskId, output: data.output, status: data.status });
  } catch (e: any) {
    res.status(400).json({ error: e.message });
  }
});

/* POST /api/tripo3d/rig — esqueleto y rigging automático */
router.post("/api/tripo3d/rig", async (req: Request, res: Response) => {
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  enableLongRunning(res);
  const { original_model_task_id } = req.body ?? {};
  if (!original_model_task_id) { res.status(400).json({ error: "original_model_task_id requerido" }); return; }
  try {
    const taskId = await tripoCreateTask({
      type: "animate_rig",
      original_model_task_id,
    });
    res.write(`data: ${JSON.stringify({ event: "started", task_id: taskId })}\n\n`);

    for (let i = 0; i < MAX_POLL_ATTEMPTS; i++) {
      const data = await tripoFetch(`/task/${taskId}`);
      const status: string = data.status;
      const progress: number = data.progress ?? 0;
      res.write(`data: ${JSON.stringify({ event: "progress", task_id: taskId, progress, status })}\n\n`);
      if (status === "success") {
        res.write(`data: ${JSON.stringify({ event: "done", task_id: taskId, output: data.output })}\n\n`);
        res.end();
        return;
      }
      if (status === "failed" || status === "cancelled") {
        res.write(`data: ${JSON.stringify({ event: "error", task_id: taskId, error: `Rig ${status}` })}\n\n`);
        res.end();
        return;
      }
      await new Promise(r => setTimeout(r, POLL_INTERVAL_MS));
    }
    res.write(`data: ${JSON.stringify({ event: "timeout", task_id: taskId })}\n\n`);
    res.end();
  } catch (e: any) {
    res.write(`data: ${JSON.stringify({ event: "error", error: e.message })}\n\n`);
    res.end();
  }
});

/* POST /api/tripo3d/retarget — aplicar animación preset a modelo rigueado */
router.post("/api/tripo3d/retarget", async (req: Request, res: Response) => {
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  enableLongRunning(res);
  const { original_model_task_id, animation, out_format = "glb" } = req.body ?? {};
  if (!original_model_task_id || !animation) {
    res.status(400).json({ error: "original_model_task_id y animation requeridos" });
    return;
  }
  const validFormats = ["glb", "fbx", "mp4"];
  const fmt = validFormats.includes(out_format) ? out_format : "glb";
  try {
    const taskId = await tripoCreateTask({
      type: "animate_retarget",
      original_model_task_id,
      animation,
      out_format: fmt,
    });
    res.write(`data: ${JSON.stringify({ event: "started", task_id: taskId, animation, out_format: fmt })}\n\n`);

    for (let i = 0; i < MAX_POLL_ATTEMPTS; i++) {
      const data = await tripoFetch(`/task/${taskId}`);
      const status: string = data.status;
      const progress: number = data.progress ?? 0;
      res.write(`data: ${JSON.stringify({ event: "progress", task_id: taskId, progress, status })}\n\n`);
      if (status === "success") {
        res.write(`data: ${JSON.stringify({ event: "done", task_id: taskId, output: data.output, animation, out_format: fmt })}\n\n`);
        res.end();
        return;
      }
      if (status === "failed" || status === "cancelled") {
        res.write(`data: ${JSON.stringify({ event: "error", task_id: taskId, error: `Retarget ${status}` })}\n\n`);
        res.end();
        return;
      }
      await new Promise(r => setTimeout(r, POLL_INTERVAL_MS));
    }
    res.write(`data: ${JSON.stringify({ event: "timeout", task_id: taskId })}\n\n`);
    res.end();
  } catch (e: any) {
    res.write(`data: ${JSON.stringify({ event: "error", error: e.message })}\n\n`);
    res.end();
  }
});

/* POST /api/tripo3d/batch — hasta 10 modelos simultáneos (imagen→3D en lote) */
router.post(
  "/api/tripo3d/batch",
  multiUpload.array("images", 10),
  async (req: Request, res: Response) => {
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    enableLongRunning(res);
    const files = req.files as Express.Multer.File[];
    if (!files || files.length === 0) { res.status(400).json({ error: "Al menos 1 imagen requerida" }); return; }
    const { model_version = "default", texture = true, pbr = true } = req.body ?? {};
    try {
      res.write(`data: ${JSON.stringify({ event: "batch_started", total: files.length })}\n\n`);

      const results: Array<{ index: number; filename: string; task_id?: string; output?: any; error?: string }> = [];

      // Upload all files and create tasks in parallel
      const uploadPromises = files.map(async (file, idx) => {
        try {
          const token = await tripoUploadFile(file.buffer, file.mimetype, file.originalname);
          const taskId = await tripoCreateTask({
            type: "image_to_model",
            file: { type: "jpg", file_token: token },
            model_version,
            texture: texture !== "false",
            pbr: pbr !== "false",
          });
          res.write(`data: ${JSON.stringify({ event: "task_created", index: idx, filename: file.originalname, task_id: taskId })}\n\n`);
          return { index: idx, filename: file.originalname, task_id: taskId };
        } catch (e: any) {
          res.write(`data: ${JSON.stringify({ event: "task_error", index: idx, filename: file.originalname, error: e.message })}\n\n`);
          return { index: idx, filename: file.originalname, error: e.message };
        }
      });

      const tasks = await Promise.all(uploadPromises);

      // Poll all active tasks until all complete
      const activeTasks = tasks.filter(t => t.task_id);
      const completed = new Set<string>();

      while (completed.size < activeTasks.length) {
        await new Promise(r => setTimeout(r, POLL_INTERVAL_MS));
        for (const task of activeTasks) {
          if (!task.task_id || completed.has(task.task_id)) continue;
          try {
            const data = await tripoFetch(`/task/${task.task_id}`);
            const status: string = data.status;
            const progress: number = data.progress ?? 0;
            res.write(`data: ${JSON.stringify({ event: "progress", index: task.index, task_id: task.task_id, progress, status })}\n\n`);
            if (status === "success") {
              completed.add(task.task_id);
              results.push({ index: task.index, filename: task.filename, task_id: task.task_id, output: data.output });
              res.write(`data: ${JSON.stringify({ event: "task_done", index: task.index, task_id: task.task_id, output: data.output, completed: completed.size, total: activeTasks.length })}\n\n`);
            } else if (status === "failed" || status === "cancelled") {
              completed.add(task.task_id);
              results.push({ index: task.index, filename: task.filename, task_id: task.task_id, error: status });
              res.write(`data: ${JSON.stringify({ event: "task_error", index: task.index, task_id: task.task_id, error: status })}\n\n`);
            }
          } catch (e: any) {
            completed.add(task.task_id);
          }
        }
      }

      res.write(`data: ${JSON.stringify({ event: "batch_done", results, total: files.length, succeeded: results.filter(r => r.output).length })}\n\n`);
      res.end();
    } catch (e: any) {
      logger.error({ err: e }, "tripo3d batch error");
      res.write(`data: ${JSON.stringify({ event: "error", error: e.message })}\n\n`);
      res.end();
    }
  }
);

/* POST /api/tripo3d/convert — convertir formato del modelo
   Acepta: original_model_task_id (Tripo SDK nativo) o taskId (alias corto) */
router.post("/api/tripo3d/convert", async (req: Request, res: Response) => {
  const { taskId: taskIdAlias, original_model_task_id, format = "glb", quad, face_limit, texture_size, pivot_to_center_bottom } = req.body ?? {};
  const sourceTaskId = original_model_task_id || taskIdAlias;
  if (!sourceTaskId) { res.status(400).json({ error: "original_model_task_id (o taskId) requerido" }); return; }
  try {
    const newTaskId = await tripoCreateTask({
      type: "convert_model",
      original_model_task_id: sourceTaskId,
      format: (format as string).toLowerCase(),
      quad: quad ?? undefined,
      face_limit: face_limit ? Number(face_limit) : undefined,
      texture_size: texture_size ? Number(texture_size) : undefined,
      pivot_to_center_bottom: pivot_to_center_bottom ?? undefined,
    });
    const data = await tripoPollTask(newTaskId);
    res.json({ task_id: newTaskId, output: data.output, status: data.status });
  } catch (e: any) {
    res.status(400).json({ error: e.message });
  }
});

/* POST /api/tripo3d/stylize — aplicar estilo artístico */
router.post("/api/tripo3d/stylize", async (req: Request, res: Response) => {
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  enableLongRunning(res);
  const { original_model_task_id, style, block_size } = req.body ?? {};
  if (!original_model_task_id || !style) {
    res.status(400).json({ error: "original_model_task_id y style requeridos" });
    return;
  }
  try {
    const taskId = await tripoCreateTask({
      type: "stylize_model",
      original_model_task_id,
      style,
      block_size: block_size ? Number(block_size) : undefined,
    });
    res.write(`data: ${JSON.stringify({ event: "started", task_id: taskId })}\n\n`);
    for (let i = 0; i < MAX_POLL_ATTEMPTS; i++) {
      const data = await tripoFetch(`/task/${taskId}`);
      const status: string = data.status;
      const progress: number = data.progress ?? 0;
      res.write(`data: ${JSON.stringify({ event: "progress", task_id: taskId, progress, status })}\n\n`);
      if (status === "success") {
        res.write(`data: ${JSON.stringify({ event: "done", task_id: taskId, output: data.output })}\n\n`);
        res.end();
        return;
      }
      if (status === "failed" || status === "cancelled") {
        res.write(`data: ${JSON.stringify({ event: "error", error: `Stylize ${status}` })}\n\n`);
        res.end();
        return;
      }
      await new Promise(r => setTimeout(r, POLL_INTERVAL_MS));
    }
    res.write(`data: ${JSON.stringify({ event: "timeout" })}\n\n`);
    res.end();
  } catch (e: any) {
    res.write(`data: ${JSON.stringify({ event: "error", error: e.message })}\n\n`);
    res.end();
  }
});

/* POST /api/tripo3d/auto-generate
 * Genera modelo 3D automáticamente desde un producto:
 *  - Si imageUrl → descarga imagen → image_to_model
 *  - Si no hay imagen → Claude genera prompt inteligente → text_to_model
 * Streams SSE progress y guarda en vault al finalizar.
 */
router.post("/api/tripo3d/auto-generate", async (req: Request, res: Response) => {
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  enableLongRunning(res);

  const { projectId, productId, productTitle, productType, bodyHtml, imageUrl } = req.body ?? {};

  const send = (payload: object) => {
    if (!res.writableEnded) res.write(`data: ${JSON.stringify(payload)}\n\n`);
  };

  try {
    let taskId: string;

    if (imageUrl && typeof imageUrl === "string" && imageUrl.startsWith("http")) {
      // ── Modo imagen: descargar del CDN del producto y enviar a Tripo3D ─────
      send({ event: "status", message: "Descargando imagen del producto..." });

      const imgRes = await fetch(imageUrl);
      if (!imgRes.ok) throw new Error(`No se pudo descargar la imagen: HTTP ${imgRes.status}`);
      const contentType = imgRes.headers.get("content-type") || "image/jpeg";
      const imgBuffer = Buffer.from(await imgRes.arrayBuffer());
      const ext = contentType.includes("png") ? "png" : contentType.includes("webp") ? "webp" : "jpg";

      send({ event: "status", message: "Subiendo imagen a Tripo3D AI..." });
      const imageToken = await tripoUploadFile(imgBuffer, contentType, `product.${ext}`);

      send({ event: "status", message: "Iniciando generación de modelo 3D desde imagen..." });
      taskId = await tripoCreateTask({
        type: "image_to_model",
        file: { type: ext, file_token: imageToken },
        texture: true,
        pbr: true,
      });
    } else {
      // ── Modo texto: Claude genera prompt profesional → text_to_model ────────
      send({ event: "status", message: "Analizando producto con IA para crear prompt 3D..." });

      const systemPrompt = `Eres un experto en diseño 3D y visualización de productos. Crea prompts técnicos y profesionales para generar modelos 3D con Tripo3D AI.
El prompt debe:
- Describir el objeto 3D que mejor represente visualmente el producto o servicio
- Ser específico sobre materiales, formas, estilos y acabados
- Incluir detalles: studio lighting, clean background, PBR materials, high quality 3D render
- Si es un servicio sin objeto físico, crear un objeto icónico que lo simbolice (ej: consultoría → maletín elegante de cuero marrón)
- Máximo 150 palabras, en inglés técnico de modelado 3D
- Solo devuelve el prompt, sin comillas ni explicaciones`;

      const userMsg = `Crea un prompt para Tripo3D AI que genere un modelo 3D representando este producto/servicio:
Nombre: ${productTitle || "Producto"}
Tipo: ${productType || "General"}
Descripción: ${bodyHtml ? bodyHtml.replace(/<[^>]+>/g, "").slice(0, 500) : "Sin descripción disponible"}

El modelo 3D debe representar visualmente el valor del producto/servicio de forma atractiva y profesional.`;

      let prompt = "";
      try {
        const result = await askClaudeWithBrain(
          Number(projectId) || 0,
          [{ role: "user", content: userMsg }],
          systemPrompt,
          "general",
          productType || "ecommerce",
          300,
        );
        prompt = String(result).trim().replace(/^["']|["']$/g, "");
      } catch {
        // Fallback prompt si Claude falla
        prompt = `A high-quality 3D product model of ${productTitle || "a commercial product"}, professional studio lighting, clean white background, PBR materials, detailed surface textures, photorealistic rendering, 8k resolution`;
      }

      send({ event: "prompt_generated", prompt, message: "Prompt 3D generado. Iniciando modelado..." });

      taskId = await tripoCreateTask({
        type: "text_to_model",
        prompt,
        model_version: "default",
        texture: true,
        pbr: true,
      });
    }

    send({ event: "started", task_id: taskId, message: "Modelo 3D en proceso (2-5 min)..." });

    // ── Polling de progreso ────────────────────────────────────────────────
    let finalData: any = null;
    for (let i = 0; i < MAX_POLL_ATTEMPTS; i++) {
      await new Promise(r => setTimeout(r, POLL_INTERVAL_MS));
      const data = await tripoFetch(`/task/${taskId}`);
      const status: string = data.status;
      const progress: number = data.progress ?? 0;

      if (status === "success") {
        finalData = data;
        send({ event: "progress", task_id: taskId, progress: 100, status });
        break;
      }
      if (status === "failed" || status === "cancelled") {
        throw new Error(`La tarea ${status === "failed" ? "falló" : "fue cancelada"}`);
      }
      send({ event: "progress", task_id: taskId, progress, status });
    }

    if (!finalData) throw new Error("Tiempo de espera agotado (6 min). El modelo puede seguir procesándose.");

    // ── Guardar en Vault ───────────────────────────────────────────────────
    const modelUrl: string | undefined =
      finalData.output?.model || finalData.output?.pbr_model || finalData.output?.rendered_image;
    const previewUrl: string | undefined =
      finalData.output?.rendered_image || modelUrl;

    let vaultId: number | null = null;
    if (modelUrl && Number(projectId) > 0) {
      try {
        vaultId = await saveToVault({
          projectId: Number(projectId),
          fileType: "3d_model",
          category: "tripo3d",
          title: `Modelo 3D: ${productTitle || "Producto"}`,
          description: `Modelo 3D generado automáticamente con Tripo3D AI`,
          productId: productId ? String(productId) : undefined,
          productTitle: productTitle || undefined,
          originalUrl: modelUrl,
          mimeType: "model/gltf-binary",
          generatedBy: "tripo3d-auto",
          metadata: { taskId, output: finalData.output, imageMode: !!(imageUrl) },
        });
      } catch (vaultErr: any) {
        logger.warn({ err: vaultErr?.message, taskId }, "tripo3d/auto-generate: vault save failed (non-fatal)");
      }
    }

    send({
      event: "done",
      task_id: taskId,
      output: finalData.output,
      model_url: modelUrl,
      preview_url: previewUrl,
      vault_id: vaultId,
    });
  } catch (e: any) {
    logger.error({ err: e.message }, "tripo3d/auto-generate error");
    send({ event: "error", error: e.message || "Error desconocido" });
  }

  res.end();
});

/* GET /api/tripo3d/local-models — lista los GLBs guardados localmente */
router.get("/api/tripo3d/local-models", async (_req, res) => {
  try {
    if (!existsSync(TRIPO3D_LOCAL_DIR)) {
      res.json({ models: [] });
      return;
    }
    const files = readdirSync(TRIPO3D_LOCAL_DIR);
    const glbs = files.filter(f => f.endsWith(".glb")).map(f => ({
      taskId: f.replace(".glb", ""),
      url: `/assets/3d/tripo3d/${f}`,
      filename: f
    }));
    res.json({ models: glbs });
  } catch (e: any) {
    res.status(400).json({ error: e.message });
  }
});

/* POST /api/tripo3d/text-to-model-advanced — prompt, style, quality, seed, multiview */
router.post("/api/tripo3d/text-to-model-advanced", async (req: Request, res: Response) => {
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  enableLongRunning(res);
  const { prompt, style, quality, seed, multiview, model_version = "v2.5" } = req.body ?? {};
  if (!prompt) { res.status(400).json({ error: "prompt requerido" }); return; }
  
  try {
    const taskId = await tripoCreateTask({
      type: "text_to_model",
      prompt,
      model_version: multiview ? "v2.5" : model_version,
      style,
      quality,
      seed,
    });
    res.write(`data: ${JSON.stringify({ event: "started", task_id: taskId })}\n\n`);

    let lastProgress = 0;
    for (let i = 0; i < MAX_POLL_ATTEMPTS; i++) {
      const data = await tripoFetch(`/task/${taskId}`);
      const status: string = data.status;
      const progress: number = data.progress ?? 0;
      if (progress !== lastProgress) {
        res.write(`data: ${JSON.stringify({ event: "progress", task_id: taskId, progress, status })}\n\n`);
        lastProgress = progress;
      }
      if (status === "success") {
        const glbUrl = data.output?.model || data.output?.glb;
        if (glbUrl) downloadAndSaveTripoModel(taskId, glbUrl);
        res.write(`data: ${JSON.stringify({ event: "done", task_id: taskId, output: data.output, progress: 100 })}\n\n`);
        res.end();
        return;
      }
      if (status === "failed" || status === "cancelled") {
        res.write(`data: ${JSON.stringify({ event: "error", task_id: taskId, error: `Task ${status}` })}\n\n`);
        res.end();
        return;
      }
      await new Promise(r => setTimeout(r, POLL_INTERVAL_MS));
    }
    res.write(`data: ${JSON.stringify({ event: "timeout", task_id: taskId })}\n\n`);
    res.end();
  } catch (e: any) {
    logger.error({ err: e }, "tripo3d text-to-model-advanced error");
    res.write(`data: ${JSON.stringify({ event: "error", error: e.message })}\n\n`);
    res.end();
  }
});

/* POST /api/tripo3d/segment — segmentar modelo 3D en partes semánticas
   Tripo3D divide el modelo en componentes (cuerpo, ruedas, cabello, ropa…) */
router.post("/api/tripo3d/segment", async (req: Request, res: Response) => {
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  enableLongRunning(res);
  const { original_model_task_id } = req.body ?? {};
  if (!original_model_task_id) {
    res.status(400).json({ error: "original_model_task_id requerido" }); return;
  }
  try {
    const taskId = await tripoCreateTask({
      type: "segment_model",
      original_model_task_id,
    });
    res.write(`data: ${JSON.stringify({ event: "started", task_id: taskId })}\n\n`);
    for (let i = 0; i < MAX_POLL_ATTEMPTS; i++) {
      const data = await tripoFetch(`/task/${taskId}`);
      const status: string = data.status;
      const progress: number = data.progress ?? 0;
      res.write(`data: ${JSON.stringify({ event: "progress", task_id: taskId, progress, status })}\n\n`);
      if (status === "success") {
        res.write(`data: ${JSON.stringify({ event: "done", task_id: taskId, output: data.output, segments: data.output?.segments ?? [] })}\n\n`);
        res.end(); return;
      }
      if (status === "failed" || status === "cancelled") {
        res.write(`data: ${JSON.stringify({ event: "error", task_id: taskId, error: `Segment ${status}` })}\n\n`);
        res.end(); return;
      }
      await new Promise(r => setTimeout(r, POLL_INTERVAL_MS));
    }
    res.write(`data: ${JSON.stringify({ event: "timeout", task_id: taskId })}\n\n`);
    res.end();
  } catch (e: any) {
    logger.error({ err: e }, "tripo3d segment error");
    res.write(`data: ${JSON.stringify({ event: "error", error: e.message })}\n\n`);
    res.end();
  }
});

/* POST /api/tripo3d/image-to-multiview
   Dado un archivo imagen, genera 4 renders angulares (front/left/back/right)
   usando visión IA (Gemini) para describir el objeto, luego xAI Aurora para renderizar */
router.post(
  "/api/tripo3d/image-to-multiview",
  upload.single("image"),
  async (req: Request, res: Response): Promise<any> => {
    if (!req.file) return res.status(400).json({ error: "Imagen requerida" });
    const xaiKey = process.env.XAI_API_KEY ?? process.env.GROK_API_KEY;
    const geminiKey = process.env.GEMINI_API_KEY;
    if (!xaiKey) return res.status(503).json({ error: "XAI_API_KEY no configurada" });

    try {
      // 1. Describe the object in the image via Gemini vision (or basic fallback)
      let objectDescription = "the object in the image";
      if (geminiKey) {
        const base64 = req.file.buffer.toString("base64");
        const mime = req.file.mimetype || "image/jpeg";
        const gemRes = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${geminiKey}`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              contents: [{
                parts: [
                  { text: "Describe this 3D object in 1-2 sentences for product photography. Focus on the object type, material, color, and style. Be concise and specific. Use English only." },
                  { inline_data: { mime_type: mime, data: base64 } },
                ],
              }],
              generationConfig: { temperature: 0.3, maxOutputTokens: 120 },
            }),
          }
        );
        if (gemRes.ok) {
          const gd = await gemRes.json();
          const desc = gd.candidates?.[0]?.content?.parts?.[0]?.text;
          if (desc) objectDescription = desc.trim();
        }
      }

      // 2. Generate 4 angles using xAI Aurora
      const angles = [
        { key: "front", desc: "front view, facing camera directly" },
        { key: "left",  desc: "left side view, 90 degrees" },
        { key: "back",  desc: "back view, rear" },
        { key: "right", desc: "right side view, 90 degrees" },
      ];

      const generate = async (angleDesc: string): Promise<string> => {
        const fullPrompt = `${angleDesc} of ${objectDescription}, product photography, clean white background, studio lighting, centered, high quality 3D render`;
        const r = await fetch("https://api.x.ai/v1/images/generations", {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${xaiKey}` },
          body: JSON.stringify({ model: "aurora", prompt: fullPrompt, n: 1 }),
        });
        if (!r.ok) throw new Error(`xAI ${r.status}: ${(await r.text()).slice(0, 120)}`);
        const d = await r.json();
        const item = d.data?.[0];
        if (!item) throw new Error("No image from xAI");
        if (item.url)      return item.url;
        if (item.b64_json) return `data:image/jpeg;base64,${item.b64_json}`;
        throw new Error("Unknown xAI response format");
      };

      const results = await Promise.allSettled(angles.map(a => generate(a.desc)));
      const views: Record<string, string> = {};
      angles.forEach((a, i) => {
        const r = results[i];
        if (r.status === "fulfilled") views[a.key] = r.value;
      });

      if (!views.front) {
        const err = (results.find(r => r.status === "rejected") as PromiseRejectedResult)?.reason;
        return res.status(500).json({ error: (err as Error)?.message ?? "Error generating views" });
      }
      return res.json({ views, description: objectDescription });
    } catch (e: any) {
      logger.error({ err: e }, "tripo3d image-to-multiview error");
      return res.status(500).json({ error: e.message });
    }
  }
);

/* POST /api/tripo3d/text-to-texture — aplicar textura basada en texto a modelo existente */
router.post("/api/tripo3d/text-to-texture", async (req: Request, res: Response) => {
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  enableLongRunning(res);
  const { original_model_task_id, prompt, texture_quality = "standard" } = req.body ?? {};
  if (!original_model_task_id || !prompt) {
    res.status(400).json({ error: "original_model_task_id y prompt requeridos" }); return;
  }
  try {
    const taskId = await tripoCreateTask({
      type: "text_to_texture",
      original_model_task_id,
      prompt,
      texture_quality,
    });
    res.write(`data: ${JSON.stringify({ event: "started", task_id: taskId })}\n\n`);
    for (let i = 0; i < MAX_POLL_ATTEMPTS; i++) {
      const data = await tripoFetch(`/task/${taskId}`);
      const status: string = data.status;
      const progress: number = data.progress ?? 0;
      res.write(`data: ${JSON.stringify({ event: "progress", task_id: taskId, progress, status })}\n\n`);
      if (status === "success") {
        res.write(`data: ${JSON.stringify({ event: "done", task_id: taskId, output: data.output })}\n\n`);
        res.end(); return;
      }
      if (status === "failed" || status === "cancelled") {
        res.write(`data: ${JSON.stringify({ event: "error", task_id: taskId, error: `Text-to-texture ${status}` })}\n\n`);
        res.end(); return;
      }
      await new Promise(r => setTimeout(r, POLL_INTERVAL_MS));
    }
    res.write(`data: ${JSON.stringify({ event: "timeout", task_id: taskId })}\n\n`);
    res.end();
  } catch (e: any) {
    logger.error({ err: e }, "tripo3d text-to-texture error");
    res.write(`data: ${JSON.stringify({ event: "error", error: e.message })}\n\n`);
    res.end();
  }
});

/* POST /api/tripo3d/generate-views — text prompt → 4 angle images via xAI Aurora */
router.post("/api/tripo3d/generate-views", async (req: Request, res: Response): Promise<any> => {
  const { prompt } = req.body ?? {};
  if (!prompt || typeof prompt !== "string") {
    return res.status(400).json({ error: "Se requiere un prompt" });
  }
  const apiKey = process.env.XAI_API_KEY ?? process.env.GROK_API_KEY;
  if (!apiKey) {
    return res.status(503).json({ error: "XAI_API_KEY no configurada" });
  }
  const angles = [
    { key: "front", desc: "frontal view, facing camera" },
    { key: "left",  desc: "left side view, profile" },
    { key: "back",  desc: "back view, rear" },
    { key: "right", desc: "right side view, profile" },
  ] as const;

  const generate = async (desc: string): Promise<string> => {
    const fullPrompt = `${desc} of ${prompt}, product photography, clean white background, studio lighting, centered, high quality`;
    const r = await fetch("https://api.x.ai/v1/images/generations", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({ model: "aurora", prompt: fullPrompt, n: 1 }),
    });
    if (!r.ok) {
      const txt = await r.text();
      throw new Error(`xAI ${r.status}: ${txt.slice(0, 200)}`);
    }
    const d = await r.json();
    const item = d.data?.[0];
    if (!item) throw new Error("No se recibió imagen de xAI");
    if (item.url)      return item.url;
    if (item.b64_json) return `data:image/jpeg;base64,${item.b64_json}`;
    throw new Error("Formato de respuesta xAI desconocido");
  };

  try {
    const results = await Promise.allSettled(angles.map(a => generate(a.desc)));
    const views: Record<string, string> = {};
    angles.forEach((a, i) => {
      const r = results[i];
      if (r.status === "fulfilled") views[a.key] = r.value;
    });
    if (!views.front) {
      const firstErr = results.find(r => r.status === "rejected") as PromiseRejectedResult | undefined;
      return res.status(500).json({ error: (firstErr?.reason as Error)?.message ?? "Error generando vistas" });
    }
    return res.json({ views });
  } catch (e: any) {
    logger.error({ err: e }, "tripo3d generate-views error");
    return res.status(500).json({ error: e.message ?? "Error generando vistas" });
  }
});

export default router;
