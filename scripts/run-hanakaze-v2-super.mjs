#!/usr/bin/env node
/**
 * Campaña Hanakaze SUPER ANUNCIO v2 — pipeline pollo.ai-style.
 *
 *   12 clips dinámicos (≈75s) + voz off ES + música stable-audio + concat MP4 9:16.
 *
 * Mantiene el mismo patrón de robustez que v1:
 *   • cliente HTTP raw sin timeouts
 *   • estado persistente en logs/hanakaze-v2-state.json (reanudable)
 *   • polling fallback si el server tarda > X minutos en responder
 *   • rehidratación de URLs públicas para image-to-video
 *
 * Uso:
 *   HANAKAZE_PROJECT_ID=7 node scripts/run-hanakaze-v2-super.mjs
 *   HANAKAZE_PROJECT_ID=7 RESET=1 node scripts/run-hanakaze-v2-super.mjs
 *   HANAKAZE_PROJECT_ID=7 ONLY=c01,c02 node scripts/run-hanakaze-v2-super.mjs
 */

import fs from "node:fs/promises";
import path from "node:path";
import http from "node:http";
import { Buffer } from "node:buffer";
import { spawn } from "node:child_process";
import { tmpdir } from "node:os";

// ─────────────── HTTP cliente raw sin timeouts ───────────────────────────────
function rawRequest({ host = "localhost", port = 8080, path: urlPath, method = "POST", headers = {}, body = null, abortAfterMs = 0 }) {
  return new Promise((resolve, reject) => {
    const buf = body == null ? null : (Buffer.isBuffer(body) ? body : Buffer.from(body));
    const finalHeaders = { ...headers };
    if (buf) finalHeaders["Content-Length"] = buf.length;
    const req = http.request({ host, port, path: urlPath, method, headers: finalHeaders, timeout: 0, agent: false }, (res) => {
      const chunks = [];
      res.on("data", c => chunks.push(c));
      res.on("end", () => {
        if (abortTimer) clearTimeout(abortTimer);
        const text = Buffer.concat(chunks).toString("utf8");
        resolve({
          ok: res.statusCode >= 200 && res.statusCode < 400,
          status: res.statusCode,
          headers: res.headers,
          text: () => Promise.resolve(text),
          json: () => Promise.resolve(JSON.parse(text)),
          _text: text,
        });
      });
      res.on("error", reject);
    });
    req.setTimeout(0);
    req.on("socket", s => { s.setTimeout(0); s.setKeepAlive(true, 30_000); });
    req.on("error", (e) => { if (abortTimer) clearTimeout(abortTimer); reject(e); });
    let abortTimer = null;
    if (abortAfterMs > 0) {
      abortTimer = setTimeout(() => {
        try { req.destroy(new Error(`local-abort: sin respuesta tras ${abortAfterMs/1000}s`)); } catch {}
      }, abortAfterMs);
    }
    if (buf) req.write(buf);
    req.end();
  });
}

function rawRequestBinary({ host = "localhost", port = 8080, path: urlPath, method = "GET", headers = {} }) {
  return new Promise((resolve, reject) => {
    const req = http.request({ host, port, path: urlPath, method, headers, timeout: 0 }, (res) => {
      const chunks = [];
      res.on("data", c => chunks.push(c));
      res.on("end", () => resolve({
        ok: res.statusCode >= 200 && res.statusCode < 400,
        status: res.statusCode,
        headers: res.headers,
        buffer: Buffer.concat(chunks),
      }));
      res.on("error", reject);
    });
    req.setTimeout(0);
    req.on("socket", s => { s.setTimeout(0); s.setKeepAlive(true, 30_000); });
    req.on("error", reject);
    req.end();
  });
}

console.log("[boot] Hanakaze v2 SUPER — cliente HTTP raw + state reanudable");

const PROJECT_ID = parseInt(process.env.HANAKAZE_PROJECT_ID || "7", 10);
const BASE = "http://localhost:8080";
const EMAIL = "sadiagiljoan@gmail.com";
const PASSWORD = "Lara14032025#";
const RESET = process.env.RESET === "1";
const ONLY = (process.env.ONLY || "").split(",").map(s => s.trim()).filter(Boolean);
const LOG_FILE = "logs/hanakaze-v2.log";
const STATE_FILE = "logs/hanakaze-v2-state.json";
const startedAt = Date.now();
let cookieJar = "";

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

async function log(msg) {
  const line = `[${new Date().toISOString()}] ${msg}\n`;
  process.stdout.write(line);
  await fs.appendFile(LOG_FILE, line);
}

async function api(pathname, opts = {}) {
  const headers = { ...(opts.headers || {}) };
  if (cookieJar) headers["Cookie"] = cookieJar;
  let body = opts.body ?? null;
  if (opts.json !== undefined) {
    headers["Content-Type"] = "application/json";
    body = JSON.stringify(opts.json);
  }
  const res = await rawRequest({ path: pathname, method: opts.method || "GET", headers, body, abortAfterMs: opts.abortAfterMs || 0 });
  const setCookie = res.headers["set-cookie"];
  if (setCookie) {
    const first = Array.isArray(setCookie) ? setCookie[0] : setCookie;
    cookieJar = first.split(";")[0];
  }
  return res;
}

async function jsonOrThrow(res, label) {
  const text = res._text ?? (await res.text());
  if (!res.ok) throw new Error(`[${label}] HTTP ${res.status}: ${text.slice(0, 600)}`);
  try { return JSON.parse(text); } catch { throw new Error(`[${label}] Invalid JSON: ${text.slice(0, 200)}`); }
}

async function login() {
  await log("Login admin…");
  const res = await api("/api/auth/login", { method: "POST", json: { email: EMAIL, password: PASSWORD } });
  await jsonOrThrow(res, "login");
  await log("Login OK");
}

// ─────────────── Subida pública (URL HTTPS firmada 1h) ───────────────────────
async function uploadPublicAsset(localPath, label, bytesOrPath) {
  await log(`▶ upload-public[${label}] ${path.basename(localPath)}`);
  const buf = bytesOrPath || await fs.readFile(localPath);
  const ext = path.extname(localPath).toLowerCase();
  const mime = ext === ".png" ? "image/png"
              : ext === ".webp" ? "image/webp"
              : ext === ".mp4" ? "video/mp4"
              : ext === ".mp3" ? "audio/mpeg"
              : ext === ".wav" ? "audio/wav"
              : "image/jpeg";
  const form = new FormData();
  form.append("file", new Blob([buf], { type: mime }), path.basename(localPath));
  const headers = {};
  if (cookieJar) headers["Cookie"] = cookieJar;
  const res = await fetch(`${BASE}/api/fs-pro/upload-public-asset`, { method: "POST", body: form, headers });
  const text = await res.text();
  if (!res.ok) throw new Error(`[upload-public:${label}] HTTP ${res.status}: ${text.slice(0,300)}`);
  const data = JSON.parse(text);
  await log(`✔ upload-public[${label}] size=${(data.sizeBytes/1024).toFixed(1)}KB`);
  return data.signedUrl;
}

// ─────────────── Sube buffer arbitrario al vault ─────────────────────────────
async function saveBufferToVault({ projectId, buffer, fileType, mimeType, title, label }) {
  await log(`▶ save-to-vault[${label}] ${(buffer.length/1024/1024).toFixed(2)}MB type=${fileType}`);
  const form = new FormData();
  form.append("file", new Blob([buffer], { type: mimeType }), `${label}.${mimeType.split("/")[1] || "bin"}`);
  form.append("projectId", String(projectId));
  form.append("fileType", fileType);
  form.append("title", title);
  form.append("mimeType", mimeType);
  const headers = {};
  if (cookieJar) headers["Cookie"] = cookieJar;
  const res = await fetch(`${BASE}/api/fs-pro/save-to-vault`, { method: "POST", body: form, headers });
  const text = await res.text();
  if (!res.ok) throw new Error(`[save-to-vault:${label}] HTTP ${res.status}: ${text.slice(0,300)}`);
  const data = JSON.parse(text);
  await log(`✔ save-to-vault[${label}] vault=${data.vaultId}`);
  return data.vaultId;
}

// ─────────────── Descarga vault asset → buffer ───────────────────────────────
async function downloadVaultAsset(projectId, vaultId, label) {
  await log(`▶ download-vault[${label}] vault=${vaultId}`);
  const headers = {};
  if (cookieJar) headers["Cookie"] = cookieJar;
  const res = await rawRequestBinary({
    path: `/api/projects/${projectId}/vault/${vaultId}/download`,
    method: "GET", headers,
  });
  if (!res.ok) throw new Error(`[download-vault:${label}] HTTP ${res.status}`);
  await log(`✔ download-vault[${label}] ${(res.buffer.length/1024/1024).toFixed(2)}MB`);
  return res.buffer;
}

// ─────────────── STATE: persistencia + memoize ───────────────────────────────
async function loadState() {
  if (RESET) { await log("⚠ RESET=1 — ignorando state previo"); return { steps: {}, startedAt: new Date().toISOString() }; }
  try {
    const raw = await fs.readFile(STATE_FILE, "utf8");
    const s = JSON.parse(raw);
    const done = Object.keys(s.steps || {}).length;
    if (done) await log(`▷ state previo cargado: ${done} pasos completados`);
    return s;
  } catch {
    return { steps: {}, startedAt: new Date().toISOString() };
  }
}

async function saveState(state) {
  state.lastUpdate = new Date().toISOString();
  await fs.writeFile(STATE_FILE, JSON.stringify(state, null, 2));
}

async function memoize(state, key, fn) {
  if (state.steps[key]) {
    await log(`⊙ skip[${key}] ya completado vault=${state.steps[key].vaultId} (${state.steps[key].completedAt})`);
    return state.steps[key];
  }
  if (ONLY.length && !ONLY.some(o => key.includes(o))) {
    await log(`◌ filter[${key}] no está en ONLY=${ONLY.join(",")}, salto`);
    return null;
  }
  const result = await fn();
  state.steps[key] = { ...result, completedAt: new Date().toISOString() };
  await saveState(state);
  return result;
}

// ─────────────── Polling fallback ────────────────────────────────────────────
async function findRecentAsset({ projectId, fileType, sinceMs, titleFingerprint = null, timeoutMs = 600_000, intervalMs = 10_000 }) {
  const start = Date.now();
  let attempts = 0;
  while (Date.now() - start < timeoutMs) {
    attempts++;
    try {
      const res = await api(`/api/projects/${projectId}/vault?fileType=${fileType}&limit=50`);
      const data = await jsonOrThrow(res, "vault-list");
      const files = (data.files || data || []).filter(f => {
        const t = new Date(f.createdAt || f.created_at).getTime();
        if (!t || t < sinceMs) return false;
        if (titleFingerprint && !(f.title || "").includes(titleFingerprint)) return false;
        return true;
      });
      if (files.length) {
        const latest = files.sort((a,b) => new Date(b.createdAt || b.created_at) - new Date(a.createdAt || a.created_at))[0];
        await log(`✔ polling found vault=${latest.id} (${attempts} intentos)`);
        return latest;
      }
    } catch (e) {
      await log(`  polling intento ${attempts} error: ${e.message.slice(0,100)}`);
    }
    await sleep(intervalMs);
  }
  throw new Error(`[polling] no se encontró asset ${fileType}/${titleFingerprint} en ${timeoutMs/1000}s`);
}

async function rehydratePublicUrl(projectId, vaultId, label, ext = ".png") {
  await log(`  rehidratando publicUrl para vault=${vaultId}`);
  const buf = await downloadVaultAsset(projectId, vaultId, `rehydrate-${label}`);
  const tmp = path.join(tmpdir(), `hk2-${label}-${Date.now()}${ext}`);
  await fs.writeFile(tmp, buf);
  const url = await uploadPublicAsset(tmp, `rehydrate-${label}`, buf);
  await fs.unlink(tmp).catch(()=>{});
  return url;
}

// ─────────────── ffmpeg helper local ─────────────────────────────────────────
function runFfmpeg(args) {
  return new Promise((resolve, reject) => {
    const ff = spawn("ffmpeg", args, { stdio: ["ignore", "pipe", "pipe"] });
    let stderr = "";
    ff.stderr.on("data", d => { stderr += d.toString(); });
    ff.on("error", reject);
    ff.on("close", code => {
      if (code === 0) resolve();
      else reject(new Error(`ffmpeg exit ${code}: ${stderr.slice(-500)}`));
    });
  });
}

// ─────────────── Generadores ─────────────────────────────────────────────────

async function genVideo({ projectId, prompt, duration = 5, aspect = "9:16", model = "kling-2.1", sourceImageUrl, label }) {
  await log(`▶ video[${model}:${label}] dur=${duration}s ${sourceImageUrl ? "(i2v)" : "(t2v)"}`);
  const t0 = Date.now();
  const fingerprint = prompt.slice(0, 60);
  try {
    const res = await api(`/api/fs-pro/generate-video`, {
      method: "POST",
      json: { projectId, model, prompt, duration, aspect, sourceImageUrl: sourceImageUrl || undefined },
      abortAfterMs: 480_000,
    });
    const data = await jsonOrThrow(res, `video:${model}:${label}`);
    const sizeMB = data.sizeBytes ? (data.sizeBytes/1024/1024).toFixed(2) : "?";
    await log(`✔ video[${model}:${label}] vault=${data.vaultId} size=${sizeMB}MB (${((Date.now()-t0)/1000).toFixed(1)}s)`);
    return { vaultId: data.vaultId, model, prompt };
  } catch (e) {
    // Si el fallo es validación 4xx o error 500 inmediato del proveedor, no hacemos
    // polling largo (el server NO está procesando nada en background). Si fue
    // local-abort por timeout, el server sigue → polling largo.
    const msg = e.message || "";
    const isImmediateFail = /HTTP (4\d\d|5\d\d)/i.test(msg) && !/local-abort/i.test(msg);
    if (isImmediateFail) {
      await log(`✗ video[${model}:${label}] fallo definitivo: ${msg.slice(0,200)}`);
      throw new Error(`video[${label}] ${msg.slice(0,300)}`);
    }
    await log(`✗ video[${model}:${label}] timeout cliente (${msg.slice(0,160)}) → polling vault 10min…`);
    const fresh = await findRecentAsset({ projectId, fileType: "fs-pro-video", sinceMs: t0 - 5000, titleFingerprint: fingerprint, timeoutMs: 600_000 });
    return { vaultId: fresh.id, model, prompt };
  }
}

async function tts({ projectId, voiceId, text, label, modelId = "eleven_multilingual_v2", stability = 0.42, similarity = 0.88, style = 0.50, speed = 0.96 }) {
  await log(`▶ tts[${label}] chars=${text.length}`);
  const t0 = Date.now();
  const fingerprint = text.slice(0, 50);
  try {
    const res = await api("/api/fs-pro/tts", {
      method: "POST",
      json: { projectId, voiceId, text, modelId, stability, similarity, style, speed },
      abortAfterMs: 180_000,
    });
    const data = await jsonOrThrow(res, `tts:${label}`);
    await log(`✔ tts[${label}] vault=${data.vaultId} (${((Date.now()-t0)/1000).toFixed(1)}s)`);
    return { vaultId: data.vaultId };
  } catch (e) {
    await log(`✗ tts[${label}] falló (${e.message.slice(0,160)}) → polling…`);
    const fresh = await findRecentAsset({ projectId, fileType: "fs-pro-audio", sinceMs: t0 - 5000, titleFingerprint: fingerprint });
    return { vaultId: fresh.id };
  }
}

// Música: usamos ElevenLabs Music API directo (mismo proveedor que la voz).
// Replicate stable-audio-open-1.0 ya no existe (404) y meta/musicgen requiere
// créditos extra. ElevenLabs Music devuelve mp3 directamente y compartimos el
// mismo plan que el TTS — más simple y barato.
async function genMusicSegment({ projectId, prompt, duration = 30, label }) {
  const lengthMs = Math.min(180_000, Math.max(5000, Math.round(duration * 1000)));
  await log(`▶ music[${label}] dur=${duration}s (elevenlabs music, ${lengthMs}ms)`);
  const t0 = Date.now();
  const ELK = process.env.ELEVENLABS_API_KEY;
  if (!ELK) throw new Error("ELEVENLABS_API_KEY no definido en env");

  const cr = await fetch("https://api.elevenlabs.io/v1/music", {
    method: "POST",
    headers: {
      "xi-api-key": ELK,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ prompt, music_length_ms: lengthMs }),
  });
  if (!cr.ok) {
    const t = await cr.text();
    throw new Error(`elevenlabs music HTTP ${cr.status}: ${t.slice(0,300)}`);
  }
  const audioBuf = Buffer.from(await cr.arrayBuffer());
  await log(`  · descargado ${(audioBuf.length/1024).toFixed(1)}KB`);

  // 5) Subir a vault como fs-pro-music vía multipart /fs-pro/save-to-vault
  const fd = new FormData();
  fd.append("projectId", String(projectId));
  fd.append("title", `Hanakaze Music ${label}`);
  fd.append("fileType", "fs-pro-music");
  fd.append("mimeType", "audio/mpeg");
  fd.append("generatedBy", "hanakaze-v2:musicgen");
  fd.append("file", new Blob([audioBuf], { type: "audio/mpeg" }), `music-${label}.mp3`);
  const sv = await fetch(`http://localhost:8080/api/fs-pro/save-to-vault`, {
    method: "POST",
    headers: { Cookie: cookieJar || "" },
    body: fd,
  });
  if (!sv.ok) {
    const t = await sv.text();
    throw new Error(`save-to-vault music HTTP ${sv.status}: ${t.slice(0,300)}`);
  }
  const data = await sv.json();
  await log(`✔ music[${label}] vault=${data.vaultId} size=${(audioBuf.length/1024/1024).toFixed(2)}MB (${((Date.now()-t0)/1000).toFixed(1)}s)`);
  return { vaultId: data.vaultId };
}

async function concatFinal({ projectId, videoVaultIds, voiceVaultId, musicVaultId }) {
  await log(`▶ concat ${videoVaultIds.length} clips + voz + música…`);
  const t0 = Date.now();
  try {
    const res = await api("/api/fs-pro/concat", {
      method: "POST",
      json: {
        projectId, videoVaultIds, voiceVaultId, musicVaultId,
        transitionPreset: "crossfade", crossfadeSec: 0.35,
        voiceVolume: 1.0, musicVolume: 0.18,
        width: 1080, height: 1920, fps: 30,
      },
      abortAfterMs: 600_000,
    });
    const data = await jsonOrThrow(res, "concat");
    await log(`✔ concat vault=${data.vaultId} size=${(data.sizeBytes/1024/1024).toFixed(2)}MB (${((Date.now()-t0)/1000).toFixed(1)}s)`);
    return { vaultId: data.vaultId };
  } catch (e) {
    await log(`✗ concat falló (${e.message.slice(0,160)}) → polling…`);
    const fresh = await findRecentAsset({ projectId, fileType: "fs-pro-concat", sinceMs: t0 - 5000, timeoutMs: 600_000 });
    return { vaultId: fresh.id };
  }
}

// ════════════════════════════════ DEFINICIÓN DEL ANUNCIO ═════════════════════
//  12 clips ≈ 75 s — flujo narrativo deconstrucción/construcción tipo Pollo.ai
// ═════════════════════════════════════════════════════════════════════════════

// Refs reales de la colección Hanakaze Serigraphy (8 imágenes en attached_assets)
//   modelo1 = sudadera AZUL MARINO + mariposa blanca espalda (dos modelos)
//   modelo2 = sudadera AZUL ROYAL + mariposa blanca grande espalda
//   modelo3 = sudadera AZUL ROYAL + kanji 華吹 BLANCO sello pecho (frontal sonriendo)
//   modelo4 = camiseta BLANCA + samurái líneas negras y kimono dorado espalda
//   modelo5 = HOODIE NEGRO + mariposa blanca espalda
//   modeloDuo = dos modelos: izq mariposa azul marino, dcha kanji blanco azul marino
//   samuraiDetalle = camiseta blanca samurái colgada en percha (vista detalle producto)
//   burroPercha = perchero metálico con varias prendas colgadas (azul royal, hoodies negros, blanca)
const REF_FILES = {
  modelo1:        "attached_assets/IMG-20260414-WA0010_1777547033700.jpg",
  modelo2:        "attached_assets/IMG-20260414-WA0011_1777547033708.jpg",
  modelo3:        "attached_assets/IMG-20260414-WA0012_1777547033709.jpg",
  modelo4:        "attached_assets/IMG-20260414-WA0013_1777547033712.jpg",
  modelo5:        "attached_assets/IMG-20260414-WA0016_1777547033717.jpg",
  modeloDuo:     "attached_assets/IMG-20260414-WA0017_1777547033718.jpg",
  samuraiDetalle: "attached_assets/PXL_20260410_171731994.RAW-01_1777547033722.jpg",
  burroPercha:   "attached_assets/PXL_20260410_171704986.RAW-01_1777547033721.jpg",
};

// Voz off ES — guion FIEL a la colección real (mariposa, sello kanji, samurái)
// Calculado a ~175wpm × 0.96 speed → ≈ 70-74 segundos
const VOICE_TEXT = `Hanakaze Serigraphy. Estudio artesanal de serigrafía donde cada prenda nace hecha a mano.
Te presentamos los nuevos modelos de la colección.
Sudaderas oversize en azul marino y azul cobalto, con nuestra mariposa serigrafiada en blanco sobre la espalda.
Camisetas blancas con el sello kanji 華吹 estampado en oro o en negro al pecho.
Y nuestra pieza estrella: la camiseta del samurái, dibujada a mano y entintada en negro y dorado, con su katana al hombro.
Cada estampado lo imprimimos uno por uno en nuestro propio taller. Edición limitada. Hechas con paciencia.
Hanakaze Serigraphy. Ese toque handmade que marca la diferencia.
Encuéntranos en shopycrafter punto com.`;

// Voice ID — la misma que v1 (Bella ES, multilingual)
const VOICE_ID = "21m00Tcm4TlvDq8ikWAM";

// Música: 2 segmentos complementarios (intro 38s + body 38s = 76s)
const MUSIC_PROMPTS = {
  intro: "Cinematic Japanese ambient intro: shakuhachi flute solo, soft sustained koto string, faint wind chimes, mysterious mood, slow build, no drums, 80 bpm, instrumental",
  body:  "Cinematic Japanese fashion documentary track: deep taiko drum heartbeat, koto strings, ethereal pad, modern hybrid orchestra, emotional crescendo, 110 bpm, instrumental, no vocals",
};

// 12 clips ≈ 75s — describen los DISEÑOS Y COLORES REALES de la colección.
//   Diseños reales: mariposa blanca serigrafiada, sello kanji 華吹 octogonal (blanco/oro),
//   samurái línea negra + kimono dorado, pegatinas circulares.
//   Colores reales: azul marino, azul royal/cobalto, blanco, negro.
//   Escenario real: rooftop barcelonés, suelo terracota, pared crema, toldo verde, pádel azul.
function buildClips({ refs }) {
  return [
    {
      // INTRO LETTERING — branding de marca con la mariposa real y kanji sello
      key: "c01-intro-lettering",
      model: "seedance-pro", duration: 5, aspect: "9:16",
      prompt: "Pure deep navy blue background. A large white silkscreen-style butterfly print materializes from scattered ink droplets in the center of the frame, drawn with rough hand-printed texture exactly like a serigraphy print on cotton fabric. Below the butterfly, the brand word HANAKAZE appears in clean white sans-serif typography, then a small octagonal stamp containing the Japanese kanji 華吹 in white fades in beside it. Subtle paper-fabric grain texture overlay. Cinematic 4K, ultra clean, handmade serigraphy aesthetic, streetwear brand intro.",
    },
    {
      // LETTERING NUEVOS MODELOS sobre fondo cobalto con sello kanji real
      key: "c02-nuevos-modelos",
      model: "seedance-pro", duration: 5, aspect: "9:16",
      prompt: "Vibrant cobalt royal blue background with subtle cotton fabric weave texture. The Spanish text 'NUEVOS MODELOS' appears in bold clean white sans-serif typography centered in the frame, drawn with a slightly imperfect silkscreen-print edge. Above the text, a white octagonal stamp containing the Japanese kanji 華吹 (Hanakaze) silkscreens itself onto the fabric in white ink. Camera slowly pushes in. Authentic handmade screen-print aesthetic, no gold, no luxury aesthetic, urban streetwear fashion drop reveal, cinematic 4K vertical.",
    },
    {
      // MODELO 1 — sudadera AZUL MARINO + mariposa blanca espalda (dos modelos paralelos)
      key: "c03-modelo-marino-mariposa",
      model: "seedance-pro", duration: 6, aspect: "9:16",
      prompt: "Cinematic slow tracking shot on a sunny rooftop terrace with terracotta floor tiles and cream-colored painted walls. A young man with short brown hair stands back-to-camera wearing a NAVY BLUE crewneck sweatshirt with a large WHITE silkscreen-printed butterfly design centered on the back. The sweatshirt is loose oversize fit, the butterfly print has authentic hand-printed serigraphy texture. He is holding a broom, looking down. Soft mid-day natural sunlight, casual lifestyle fashion campaign, photorealistic 4K vertical, hand-held documentary feel. Keep the exact garment design and color identical to the reference image.",
      refKey: "modelo1",
    },
    {
      // MODELO 2 — sudadera AZUL ROYAL + mariposa blanca enorme (modelo barbudo de espalda)
      key: "c04-modelo-royal-mariposa",
      model: "seedance-pro", duration: 6, aspect: "9:16",
      prompt: "Slow cinematic dolly shot. A young man with long curly dark hair stands back-to-camera on a rooftop terrace with a rustic brick wall and green awning visible behind him. He wears a vibrant ROYAL COBALT BLUE crewneck sweatshirt, oversize fit, with a LARGE WHITE silkscreen-printed butterfly design covering most of the back, drawn with rough handmade serigraphy texture exactly as in the reference. He turns his head slightly toward camera. Natural sunlight, lifestyle fashion campaign, photorealistic 4K vertical. Preserve the exact royal blue color and the white butterfly print design from the reference image — do not change the print.",
      refKey: "modelo2",
    },
    {
      // MODELO 3 — sudadera AZUL ROYAL + sello kanji blanco frontal sonriendo
      key: "c05-modelo-royal-kanji-frontal",
      model: "seedance-pro", duration: 6, aspect: "9:16",
      prompt: "Medium shot of a young man with curly dark hair and a full beard, smiling and laughing at the camera, hands in his pockets. He wears a ROYAL COBALT BLUE crewneck sweatshirt with a small WHITE octagonal stamp printed on the left chest containing the Japanese kanji 華吹 in white silkscreen ink. Background: rooftop terrace with cream-painted wall and green awning, white plastic chairs visible. Natural sunlight, authentic lifestyle vibe, candid laughing energy, photorealistic 4K vertical. Keep the garment color, fit and chest stamp design identical to the reference image.",
      refKey: "modelo3",
    },
    {
      // SAMURAI DETALLE — camiseta blanca samurái colgada en percha (producto)
      key: "c06-detalle-samurai",
      model: "seedance-pro", duration: 5, aspect: "9:16",
      prompt: "Slow cinematic push-in macro shot of a WHITE cotton t-shirt held on a wooden hanger by a hand. On the front of the t-shirt, a hand-drawn samurai illustration in BLACK LINE-ART with mustard YELLOW-GOLD color fills on his kimono and obi belt — the samurai wears a wide conical straw hat, has a katana sword at his side, and stands in a fighting pose. The line art is detailed Japanese ukiyo-e style. Background: outdoor market stand with palm trees and blue padel court fence blurred. Natural daylight, product showcase, photorealistic 4K vertical. Keep the samurai illustration exactly as drawn in the reference image — black outlines + yellow-gold kimono fills only, no other colors.",
      refKey: "samuraiDetalle",
    },
    {
      // MODELO 4 — camiseta blanca con samurái espalda
      key: "c07-modelo-samurai-espalda",
      model: "seedance-pro", duration: 7, aspect: "9:16",
      prompt: "Cinematic slow dolly shot. A young man with short brown hair stands back-to-camera on a rooftop terrace with antennas, brick chimney and overcast sky behind him. He wears a loose WHITE cotton t-shirt with a large hand-drawn samurai illustration printed across the back — black line-art samurai with conical straw hat, katana sword, and mustard YELLOW-GOLD color fills on the kimono robe and obi belt, ukiyo-e style. He wears light blue jeans. Natural daylight, candid lifestyle fashion campaign, photorealistic 4K vertical. Keep the samurai print, the colors and the white t-shirt color identical to the reference image — do not invent new design elements.",
      refKey: "modelo4",
    },
    {
      // PROCESO ARTESANAL — manos serigrafiando la mariposa blanca sobre tela azul royal
      key: "c08-proceso-serigrafia",
      model: "seedance-pro", duration: 8, aspect: "9:16",
      prompt: "Extreme close-up cinematic shot from above of a craftsman's hands holding a wooden screen-print squeegee. They drag thick WHITE textile ink across a silkscreen mesh frame onto a flat piece of vibrant ROYAL COBALT BLUE cotton sweatshirt fabric on a wooden workbench. The screen slowly lifts to reveal a freshly printed WHITE butterfly silkscreen design with rough hand-printed texture and slight ink imperfections. Natural daylight from a window, dust particles floating, authentic small-workshop atmosphere — wooden tables, paint-stained apron sleeves, white ink jar visible. No gold ink, no luxury atelier, no shoji screens. Real Spanish indie streetwear print studio. Photorealistic 4K vertical.",
    },
    {
      // PERCHERO con varias prendas reales — la auténtica colección colgada
      key: "c09-perchero-coleccion",
      model: "seedance-pro", duration: 8, aspect: "9:16",
      prompt: "Slow cinematic dolly-along shot of a black metal clothing rack standing on a sunny outdoor terrace, with a blue padel court and palm trees blurred in the background. Hanging on wooden hangers from left to right: a BLACK hoodie with a white butterfly print, a WHITE t-shirt, then a vibrant ROYAL COBALT BLUE sweatshirt with a small white octagonal kanji stamp on the chest, then more BLACK hoodies, and a WHITE t-shirt at the end. The garments sway gently in the breeze. The complete real Hanakaze Serigraphy collection on display at an outdoor pop-up market. Natural sunlight, photorealistic 4K vertical, retail showcase. Preserve the exact garments, colors and arrangement from the reference image.",
      refKey: "burroPercha",
    },
    {
      // MODELO 5 — hoodie NEGRO con mariposa blanca espalda
      key: "c10-hoodie-negro-mariposa",
      model: "seedance-pro", duration: 6, aspect: "9:16",
      prompt: "Cinematic medium shot. A young man with short brown hair stands back-to-camera on a rooftop terrace, the wind softly moving his hood. He wears a BLACK heavy cotton hoodie, hood up, with a LARGE WHITE silkscreen-printed butterfly design centered on the back, hand-printed serigraphy texture with slight imperfections — exactly the same butterfly graphic as the reference. Background: cream-painted wall, antennas, distant brick buildings. Natural daylight, oversize streetwear fit, photorealistic 4K vertical lifestyle campaign. Keep the black hoodie color and the white butterfly print identical to the reference image — do not modify the design.",
      refKey: "modelo5",
    },
    {
      // DUO — dos modelos juntos (espalda mariposa + frontal kanji) NAVY BLUE
      key: "c11-duo-modelos",
      model: "seedance-pro", duration: 6, aspect: "9:16",
      prompt: "Cinematic medium-wide shot. Two young men stand on a sunny rooftop terrace with terracotta floor tiles and cream-painted walls. The man on the left stands back-to-camera, looking down, wearing a NAVY BLUE crewneck sweatshirt with a WHITE silkscreen butterfly print on the back. The man on the right faces camera with a neutral confident expression, hands relaxed at his sides, wearing a NAVY BLUE crewneck sweatshirt with a small WHITE octagonal stamp containing the Japanese kanji 華吹 on the left chest. Both garments are loose oversize fit. Natural mid-day sunlight, authentic candid lifestyle, photorealistic 4K vertical. Keep both garment designs, colors, and the friends' poses exactly as in the reference image.",
      refKey: "modeloDuo",
    },
    {
      // OUTRO CTA — fondo cobalto con sello kanji blanco + URL
      key: "c12-outro-cta",
      model: "seedance-pro", duration: 7, aspect: "9:16",
      prompt: "Vibrant cobalt royal blue background with subtle cotton-weave fabric texture. Centered: a large white octagonal silkscreen stamp containing the Japanese kanji 華吹 fades in. Below it, the brand text 'HANAKAZE SERIGRAPHY' appears in bold clean white sans-serif typography. Below that, the tagline 'HECHO A MANO · ESTAMPADO EN CASA' fades in smaller. At the bottom, the URL 'shopycrafter.com' appears in clean modern white font. Authentic handmade serigraphy aesthetic, slight ink texture, no gold, no luxury feel, indie streetwear brand outro. Cinematic 4K vertical.",
    },
  ];
}

// ════════════════════════════════ MAIN ═══════════════════════════════════════
async function main() {
  await fs.mkdir("logs", { recursive: true }).catch(()=>{});
  await fs.appendFile(LOG_FILE, "");
  await log("=== HANAKAZE SUPER ANUNCIO v2 — INICIO ===");
  await log(`projectId=${PROJECT_ID} reset=${RESET} only=${ONLY.join(",") || "(all)"}`);

  await login();
  const state = await loadState();

  // ─── 1) Subir refs (3 modelos + burro) → URLs HTTPS firmadas (1h) ─────────
  const refs = {};
  for (const [name, p] of Object.entries(REF_FILES)) {
    if (name === "previo") continue;
    refs[name] = await memoize(state, `ref-${name}`, async () => {
      const url = await uploadPublicAsset(p, `ref-${name}`);
      return { publicUrl: url, refLocal: p };
    });
  }

  // ─── 2) Generar 12 clips ───────────────────────────────────────────────────
  const clips = buildClips({ refs });
  const clipResults = {};
  for (const c of clips) {
    const sourceImageUrl = c.refKey ? refs[c.refKey]?.publicUrl : undefined;
    clipResults[c.key] = await memoize(state, c.key, async () => {
      // Si el ref se subió hace mucho (>50min), re-subimos para evitar URL expirada
      let url = sourceImageUrl;
      if (url && refs[c.refKey]?.completedAt) {
        const ageMin = (Date.now() - new Date(refs[c.refKey].completedAt).getTime()) / 60_000;
        if (ageMin > 50) {
          await log(`  ↻ ref ${c.refKey} viejo (${ageMin.toFixed(1)}min) → re-subo`);
          url = await uploadPublicAsset(REF_FILES[c.refKey], `ref-${c.refKey}-fresh`);
        }
      }
      return await genVideo({
        projectId: PROJECT_ID, prompt: c.prompt, duration: c.duration,
        aspect: c.aspect, model: c.model, sourceImageUrl: url, label: c.key,
      });
    });
  }

  // ─── 3) Voz off ─────────────────────────────────────────────────────────────
  const voice = await memoize(state, "voice-off-v2", async () => {
    return await tts({ projectId: PROJECT_ID, voiceId: VOICE_ID, text: VOICE_TEXT, label: "voice-off-v2" });
  });

  // ─── 4) Música (2 segmentos + concat local + subir como fs-pro-music) ─────
  const musicIntro = await memoize(state, "music-intro", () => genMusicSegment({
    projectId: PROJECT_ID, prompt: MUSIC_PROMPTS.intro, duration: 40, label: "music-intro",
  }));
  const musicBody = await memoize(state, "music-body", () => genMusicSegment({
    projectId: PROJECT_ID, prompt: MUSIC_PROMPTS.body, duration: 40, label: "music-body",
  }));

  const musicMixed = await memoize(state, "music-mixed-76s", async () => {
    await log("▶ mezclo música intro+body con ffmpeg local…");
    const tmpDir = path.join(tmpdir(), `hk2-music-${Date.now()}`);
    await fs.mkdir(tmpDir, { recursive: true });
    const introBuf = await downloadVaultAsset(PROJECT_ID, musicIntro.vaultId, "music-intro");
    const bodyBuf = await downloadVaultAsset(PROJECT_ID, musicBody.vaultId, "music-body");
    const introPath = path.join(tmpDir, "intro.wav");
    const bodyPath = path.join(tmpDir, "body.wav");
    const outPath = path.join(tmpDir, "music-76s.mp3");
    await fs.writeFile(introPath, introBuf);
    await fs.writeFile(bodyPath, bodyBuf);
    // Crossfade de 2s entre los dos segmentos + fade-out 2s al final
    await runFfmpeg([
      "-y",
      "-i", introPath,
      "-i", bodyPath,
      "-filter_complex",
      "[0:a]afade=t=in:st=0:d=1.5[a0];[1:a]afade=t=out:st=36:d=2[a1];[a0][a1]acrossfade=d=2:c1=tri:c2=tri[out]",
      "-map", "[out]",
      "-c:a", "libmp3lame", "-b:a", "192k",
      outPath,
    ]);
    const mp3Buf = await fs.readFile(outPath);
    await log(`✔ música mezclada: ${(mp3Buf.length/1024/1024).toFixed(2)}MB`);
    const vaultId = await saveBufferToVault({
      projectId: PROJECT_ID, buffer: mp3Buf, fileType: "fs-pro-music",
      mimeType: "audio/mpeg", title: "FS Pro Music: Hanakaze Super 76s mix",
      label: "music-mixed-76s",
    });
    // limpieza
    await fs.rm(tmpDir, { recursive: true, force: true }).catch(()=>{});
    return { vaultId };
  });

  // ─── 6) CONCAT FINAL — 12 clips + voz + música ────────────────────────────
  const final = await memoize(state, "concat-final-v2", async () => {
    const orderedKeys = clips.map(c => c.key);
    const videoVaultIds = orderedKeys.map(k => clipResults[k]?.vaultId).filter(Boolean);
    if (videoVaultIds.length < 8) {
      throw new Error(`Faltan clips: solo ${videoVaultIds.length} de 12 disponibles`);
    }
    return await concatFinal({
      projectId: PROJECT_ID,
      videoVaultIds,
      voiceVaultId: voice.vaultId,
      musicVaultId: musicMixed.vaultId,
    });
  });

  // ─── 7) Resumen final ─────────────────────────────────────────────────────
  const elapsed = ((Date.now() - startedAt) / 1000).toFixed(1);
  const summary = {
    completedAt: new Date().toISOString(),
    elapsedSec: elapsed,
    refs: Object.fromEntries(Object.entries(refs).map(([k,v]) => [k, v?.publicUrl ? "uploaded" : null])),
    clips: clips.map(c => ({ key: c.key, model: c.model, duration: c.duration, vaultId: clipResults[c.key]?.vaultId })),
    voice: voice.vaultId,
    musicIntro: musicIntro.vaultId,
    musicBody: musicBody.vaultId,
    musicMixed: musicMixed.vaultId,
    finalConcat: final.vaultId,
    estimatedDurationSec: clips.reduce((a,c) => a + c.duration, 0),
  };
  await fs.writeFile("logs/hanakaze-v2-result.json", JSON.stringify(summary, null, 2));
  await log(`\n═══ HANAKAZE SUPER v2 COMPLETO en ${elapsed}s ═══`);
  await log(`  • clips:        ${clips.length} (≈${summary.estimatedDurationSec}s)`);
  await log(`  • voz off:      vault=${voice.vaultId}`);
  await log(`  • música mix:   vault=${musicMixed.vaultId}`);
  await log(`  • CONCAT FINAL: vault=${final.vaultId}`);
  await log(`Resumen: logs/hanakaze-v2-result.json`);
}

main().catch(async (e) => {
  await log(`✗ FATAL: ${e.message}`);
  await log(e.stack || "");
  process.exit(1);
});
