#!/usr/bin/env node
/**
 * Campaña Hanakaze Serigraphy — pipeline completo, REANUDABLE.
 *
 *   2 imágenes base + 6 clips de vídeo + voz off + 2 anuncios + 1 infografía + montaje.
 *
 * Sistema de robustez (clave para Replit donde la conexión cliente↔server puede
 * cortarse pero el server sigue procesando en background):
 *
 *   1. cliente HTTP raw (http.request) sin timeouts del lado cliente.
 *   2. estado persistente en logs/hanakaze-state.json — cada paso completado se
 *      guarda con su vaultId. Re-ejecutar el script salta lo ya hecho.
 *   3. pre-flight scan del vault del proyecto: si algún asset coincide con el
 *      fingerprint de un paso, se rescata automáticamente al state.
 *   4. polling fallback: si una llamada a la API falla o se cuelga, se hace
 *      polling al vault durante 5 minutos buscando el asset que el server SIGUE
 *      generando en background.
 *   5. rehydratePublicUrl: si reutilizamos un asset del vault como referencia
 *      para image-to-video, descargamos el binario y lo re-subimos para tener
 *      una URL HTTPS pública firmada fresca (1 h).
 *
 * Uso:
 *   HANAKAZE_PROJECT_ID=7 node scripts/run-hanakaze-campaign.mjs
 *   HANAKAZE_PROJECT_ID=7 RESET=1 node scripts/run-hanakaze-campaign.mjs   # ignora state previo
 */

import fs from "node:fs/promises";
import path from "node:path";
import http from "node:http";
import { Buffer } from "node:buffer";

// ──────────────────────────────────────────────────────────────────────────────
//  rawRequest: cliente HTTP de bajo nivel SIN timeouts.
//  No usamos `fetch()` global porque undici cierra el socket a ~5 s cuando el
//  server no responde nada (los endpoints fs-pro pueden tardar 30-60 s en mandar
//  el primer byte). Con http.request controlamos el socket a mano.
// ──────────────────────────────────────────────────────────────────────────────
function rawRequest({ host = "localhost", port = 8080, path: urlPath, method = "POST", headers = {}, body = null, abortAfterMs = 0 }) {
  return new Promise((resolve, reject) => {
    const buf = body == null ? null : (Buffer.isBuffer(body) ? body : Buffer.from(body));
    const finalHeaders = { ...headers };
    if (buf) finalHeaders["Content-Length"] = buf.length;
    // agent: false → socket dedicado sin pooling, evita keep-alive defaults sorpresa
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
    req.on("error", (e) => {
      if (abortTimer) clearTimeout(abortTimer);
      reject(e);
    });
    // Timeout local opcional: si supera abortAfterMs, abortamos y disparamos polling.
    let abortTimer = null;
    if (abortAfterMs > 0) {
      abortTimer = setTimeout(() => {
        try { req.destroy(new Error(`local-abort: sin respuesta del server tras ${abortAfterMs/1000}s, dispararé polling`)); } catch {}
      }, abortAfterMs);
    }
    if (buf) req.write(buf);
    req.end();
  });
}

// rawRequestBinary: igual pero devuelve un Buffer (para descargar binarios)
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

console.log("[boot] cliente HTTP raw activo (sin timeouts) + sistema reanudable");

const BASE = "http://localhost:8080";
const EMAIL = process.env.HANAKAZE_ADMIN_EMAIL || "craftershopy@gmail.com";
const PASSWORD = process.env.HANAKAZE_ADMIN_PASSWORD;
if (!PASSWORD) {
  console.error("[FATAL] Falta HANAKAZE_ADMIN_PASSWORD en el entorno. Aborto para no exponer credenciales en código.");
  process.exit(2);
}
const IMAGE_ENGINE = process.env.IMAGE_ENGINE || "runway";
const VIDEO_ENGINE = process.env.VIDEO_ENGINE || "runway"; // dispatcher por defecto
const RESET = process.env.RESET === "1";
const LOG_FILE = "logs/hanakaze-campaign.log";
const STATE_FILE = "logs/hanakaze-state.json";
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
  const res = await rawRequest({
    path: pathname,
    method: opts.method || "GET",
    headers,
    body,
    abortAfterMs: opts.abortAfterMs || 0,
  });
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
  const data = await jsonOrThrow(res, "login");
  await log(`Login OK ${JSON.stringify(data).slice(0, 120)}`);
}

// ─────────────── Subida pública (devuelve URL HTTPS firmada 1h) ───────────────
async function uploadPublicAsset(localPath, label, bytesOrPath) {
  await log(`▶ upload-public[${label}] ${path.basename(localPath)}`);
  const buf = bytesOrPath || await fs.readFile(localPath);
  const ext = path.extname(localPath).toLowerCase();
  const mime = ext === ".png" ? "image/png"
              : ext === ".webp" ? "image/webp"
              : ext === ".mp4" ? "video/mp4"
              : ext === ".mp3" ? "audio/mpeg"
              : "image/jpeg";
  // multipart/form-data raw para no depender de fetch global (undici timeout):
  // sin embargo, las subidas son pequeñas (<1s) y fetch funciona bien aquí.
  const form = new FormData();
  form.append("file", new Blob([buf], { type: mime }), path.basename(localPath));
  const headers = {};
  if (cookieJar) headers["Cookie"] = cookieJar;
  const res = await fetch(`${BASE}/api/fs-pro/upload-public-asset`, { method: "POST", body: form, headers });
  const text = await res.text();
  if (!res.ok) throw new Error(`[upload-public:${label}] HTTP ${res.status}: ${text.slice(0,300)}`);
  const data = JSON.parse(text);
  await log(`✔ upload-public[${label}] size=${(data.sizeBytes/1024).toFixed(1)}KB ttl=${data.ttlSec}s`);
  return data.signedUrl;
}

// ──────────────────────────────────────────────────────────────────────────────
//  STATE: persistencia + memoize + recovery
// ──────────────────────────────────────────────────────────────────────────────
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

// Wrapper: si el step ya está en state, lo devuelve. Si no, ejecuta fn y persiste.
async function memoize(state, key, fn) {
  if (state.steps[key]) {
    await log(`⊙ skip[${key}] ya completado vault=${state.steps[key].vaultId} (${state.steps[key].completedAt})`);
    return state.steps[key];
  }
  const result = await fn();
  state.steps[key] = { ...result, completedAt: new Date().toISOString() };
  await saveState(state);
  return result;
}

// Polling: busca un asset reciente (creado tras sinceMs) del fileType pedido,
// opcionalmente filtrado por substring en el title (fingerprint).
async function findRecentAsset({ projectId, fileType, sinceMs, titleFingerprint = null, timeoutMs = 300_000, intervalMs = 10_000 }) {
  const start = Date.now();
  let attempts = 0;
  while (Date.now() - start < timeoutMs) {
    attempts++;
    await sleep(intervalMs);
    try {
      const res = await api(`/api/projects/${projectId}/vault?fileType=${fileType}&limit=20`);
      const data = await jsonOrThrow(res, "vault-poll");
      const candidates = (data.files || []).filter(f => {
        const ts = new Date(f.createdAt).getTime();
        if (ts <= sinceMs) return false;
        if (titleFingerprint && !String(f.title || "").includes(titleFingerprint)) return false;
        return true;
      });
      if (candidates.length) {
        const fresh = candidates[0]; // más reciente (orden desc)
        await log(`✔ recovery[${fileType}] vault=${fresh.id} (poll #${attempts}, ${((Date.now()-start)/1000).toFixed(0)}s)`);
        return fresh;
      }
      await log(`  …polling[${fileType}] intento ${attempts}, sin novedades (${((Date.now()-start)/1000).toFixed(0)}s)`);
    } catch (e) {
      await log(`  …polling[${fileType}] error en intento ${attempts}: ${e.message}`);
    }
  }
  throw new Error(`Recovery timeout: no apareció ningún ${fileType} nuevo en ${timeoutMs/1000}s${titleFingerprint?` con fingerprint "${titleFingerprint}"`:""}`);
}

// Descarga el binario de un asset del vault y lo re-sube como upload-public-asset
// para conseguir una URL HTTPS pública fresca (1 h TTL). Usado cuando reutilizamos
// frames de runs anteriores como input para image-to-video.
async function rehydratePublicUrl(projectId, vaultId, label, ext = ".jpg") {
  await log(`▶ rehydrate[${label}] vault=${vaultId} → re-upload como ${ext}`);
  const headers = cookieJar ? { Cookie: cookieJar } : {};
  const res = await rawRequestBinary({ path: `/api/projects/${projectId}/vault/${vaultId}/download`, headers });
  if (!res.ok) throw new Error(`rehydrate[${label}]: HTTP ${res.status} al descargar vault=${vaultId}`);
  await log(`  bin descargado: ${(res.buffer.length/1024).toFixed(1)}KB`);
  // Subimos directo desde memoria
  const tmpName = `rehydrated-${label}${ext}`;
  return uploadPublicAsset(tmpName, label, res.buffer);
}

// Pre-flight: escanea el vault del proyecto y rescata pasos completados que no
// estén en state (porque su run anterior se perdió pero el server completó).
async function preflightScan(projectId, state) {
  await log("\n━━━ PRE-FLIGHT: escaneando vault del proyecto ━━━");
  const res = await api(`/api/projects/${projectId}/vault?limit=200`);
  const data = await jsonOrThrow(res, "vault-preflight");
  const files = data.files || [];
  await log(`  vault total: ${data.total} files (${files.length} en página)`);

  // Mapping por fingerprint en el title (matchea con el prompt enviado).
  const FINGERPRINTS = {
    "frame:intro-kanji":          { fileType: "fs-pro-image", needle: "sumi-e ink kanji 華吹" },
    "frame:outro-logo":           { fileType: "fs-pro-image", needle: "Vertical 9:16 fashion brand sign-off" },
    "video:v1-intro":             { fileType: "fs-pro-video", needle: "kanji is slowly painted" },
    "video:v2-rack":              { fileType: "fs-pro-video", needle: "30-degree clockwise orbit" },
    "video:v3-model-1":           { fileType: "fs-pro-video", needle: "rotates 90 degrees to camera right" },
    "video:v4-model-2":           { fileType: "fs-pro-video", needle: "cinematic step toward the camera" },
    "video:v5-model-3":           { fileType: "fs-pro-video", needle: "samurai stance" },
    "video:v6-outro":             { fileType: "fs-pro-video", needle: "Golden ink calligraphy strokes" },
    "tts:voz-off":                { fileType: "fs-pro-audio", needle: "Hanakaze. En japonés" },
    "concat:final":               { fileType: "fs-pro-video", needle: "concat" }, // débil; concat usa otro título
    "ad:ad1-male-hoodie":         { fileType: "fs-pro-image", needle: "Japanese male model wearing a black Hanakaze" },
    "ad:ad2-tshirt-flatlay":      { fileType: "fs-pro-image", needle: "overhead flat-lay product photograph" },
    "image:infografia-proceso":   { fileType: "fs-pro-image", needle: "Frame divided into 4 horizontal sections" },
  };

  let recovered = 0;
  for (const [stepKey, { fileType, needle }] of Object.entries(FINGERPRINTS)) {
    if (state.steps[stepKey]) continue; // ya en state
    const match = files.find(f => f.fileType === fileType && String(f.title || "").includes(needle));
    if (match) {
      state.steps[stepKey] = {
        vaultId: match.id,
        recoveredAt: new Date().toISOString(),
        recoveredFrom: "preflight-scan",
        title: match.title,
        fileType: match.fileType,
      };
      recovered++;
      await log(`  ↻ rescatado[${stepKey}] vault=${match.id} (${match.title?.slice(0,60)}…)`);
    }
  }
  if (recovered) await saveState(state);
  await log(`  pre-flight terminado: ${recovered} pasos rescatados de runs anteriores\n`);
}

// ─────────────────── DISPATCHER: imagen (cualquier motor) ─────────────────────
async function genImage({ projectId, prompt, ratio = "1080:1920", referenceUrl, label, engine = IMAGE_ENGINE }) {
  if (engine === "runway") return runwayImage({ projectId, prompt, ratio, referenceUrl, label });
  if (engine === "replicate") return replicateImage({ projectId, prompt, ratio, referenceUrl, label });
  throw new Error(`Motor de imagen no soportado: ${engine}`);
}

async function runwayImage({ projectId, prompt, ratio, referenceUrl, label }) {
  await log(`▶ image[runway:${label}] ratio=${ratio} ref=${referenceUrl.slice(0, 60)}…`);
  const t0 = Date.now();
  const fingerprint = prompt.slice(0, 60); // trozo del prompt para identificar el asset
  try {
    const res = await api(`/api/fs-pro/runway-image`, {
      method: "POST",
      json: { projectId, prompt, ratio, model: "gen4_image_turbo", referenceImageUrl: referenceUrl },
      abortAfterMs: 240_000, // 4 min — si Runway tarda más, polling
    });
    const data = await jsonOrThrow(res, `image:runway:${label}`);
    await log(`✔ image[runway:${label}] vault=${data.vaultId} cost=$${data.cost} (${((Date.now()-t0)/1000).toFixed(1)}s)`);
    return { vaultId: data.vaultId, runwayUrl: data.runwayImageUrl };
  } catch (e) {
    await log(`✗ image[runway:${label}] llamada falló (${e.message}) → polling vault…`);
    const fresh = await findRecentAsset({ projectId, fileType: "fs-pro-image", sinceMs: t0 - 5000, titleFingerprint: fingerprint });
    return { vaultId: fresh.id, runwayUrl: null /* no disponible vía vault, se rehydratará si hace falta */ };
  }
}

async function replicateImage({ projectId, prompt, ratio, referenceUrl, label }) {
  await log(`▶ image[replicate:${label}]`);
  const t0 = Date.now();
  const fingerprint = prompt.slice(0, 60);
  try {
    const res = await api("/api/fs-pro/generate-image", {
      method: "POST",
      json: { projectId, prompt, model: "flux-1.1-pro", aspect_ratio: ratio.replace(":", "_"), num_outputs: 1, image: referenceUrl },
      abortAfterMs: 240_000,
    });
    const data = await jsonOrThrow(res, `image:replicate:${label}`);
    await log(`✔ image[replicate:${label}] vault=${data.vaultId} (${((Date.now()-t0)/1000).toFixed(1)}s)`);
    return { vaultId: data.vaultId, runwayUrl: data.imageUrl };
  } catch (e) {
    await log(`✗ image[replicate:${label}] falló (${e.message}) → polling…`);
    const fresh = await findRecentAsset({ projectId, fileType: "fs-pro-image", sinceMs: t0 - 5000, titleFingerprint: fingerprint });
    return { vaultId: fresh.id, runwayUrl: null };
  }
}

// ─────────────────── DISPATCHER: vídeo ────────────────────────────────────────
async function genVideo({ projectId, prompt, duration = 10, aspect = "9:16", imageSource, label, model = "runway-gen4-turbo" }) {
  let sourceImageUrl = imageSource.publicUrl || imageSource.runwayUrl;
  // Si el frame fue recuperado del vault (sin runwayUrl), rehidratamos
  if (!sourceImageUrl && imageSource.vaultId) {
    sourceImageUrl = await rehydratePublicUrl(projectId, imageSource.vaultId, `${label}-ref`, ".png");
  }
  if (!sourceImageUrl) throw new Error(`video[${label}] necesita publicUrl, runwayUrl o vaultId`);
  await log(`▶ video[${model}:${label}] dur=${duration}s aspect=${aspect}`);
  const t0 = Date.now();
  const fingerprint = prompt.slice(0, 60);
  try {
    const res = await api(`/api/fs-pro/generate-video`, {
      method: "POST",
      json: { projectId, model, prompt, duration, aspect, sourceImageUrl },
      abortAfterMs: 360_000, // 6 min — vídeo tarda más
    });
    const data = await jsonOrThrow(res, `video:${model}:${label}`);
    const sizeMB = data.sizeBytes ? (data.sizeBytes/1024/1024).toFixed(2) : "?";
    await log(`✔ video[${model}:${label}] vault=${data.vaultId} size=${sizeMB}MB (${((Date.now()-t0)/1000).toFixed(1)}s)`);
    return { vaultId: data.vaultId };
  } catch (e) {
    await log(`✗ video[${model}:${label}] falló (${e.message}) → polling vault (10 min)…`);
    const fresh = await findRecentAsset({ projectId, fileType: "fs-pro-video", sinceMs: t0 - 5000, titleFingerprint: fingerprint, timeoutMs: 600_000 });
    return { vaultId: fresh.id };
  }
}

// ──────────────── ELEVENLABS TTS ────────────────────────────────────────────
async function tts({ projectId, voiceId, text, modelId = "eleven_multilingual_v2", stability = 0.40, similarity = 0.88, style = 0.45, speed = 0.95, label }) {
  await log(`▶ tts[${label}] chars=${text.length}`);
  const t0 = Date.now();
  const fingerprint = text.slice(0, 50);
  try {
    const res = await api("/api/fs-pro/tts", {
      method: "POST",
      json: { projectId, voiceId, text, modelId, stability, similarity, style, speed },
      abortAfterMs: 120_000,
    });
    const data = await jsonOrThrow(res, `tts:${label}`);
    await log(`✔ tts[${label}] vault=${data.vaultId} (${((Date.now()-t0)/1000).toFixed(1)}s)`);
    return { vaultId: data.vaultId };
  } catch (e) {
    await log(`✗ tts[${label}] falló (${e.message}) → polling vault…`);
    const fresh = await findRecentAsset({ projectId, fileType: "fs-pro-audio", sinceMs: t0 - 5000, titleFingerprint: fingerprint });
    return { vaultId: fresh.id };
  }
}

// ──────────────── FFMPEG CONCAT ─────────────────────────────────────────────
async function concatFinal({ projectId, videoVaultIds, voiceVaultId }) {
  await log(`▶ concat ${videoVaultIds.length} clips + voz off…`);
  const t0 = Date.now();
  try {
    const res = await api("/api/fs-pro/concat", {
      method: "POST",
      json: {
        projectId, videoVaultIds, voiceVaultId,
        transitionPreset: "crossfade", crossfadeSec: 0.4,
        voiceVolume: 1.0, width: 1080, height: 1920, fps: 30,
      },
      abortAfterMs: 480_000, // 8 min para ffmpeg
    });
    const data = await jsonOrThrow(res, "concat");
    await log(`✔ concat vault=${data.vaultId} size=${(data.sizeBytes/1024/1024).toFixed(2)}MB (${((Date.now()-t0)/1000).toFixed(1)}s)`);
    return { vaultId: data.vaultId };
  } catch (e) {
    await log(`✗ concat falló (${e.message}) → polling vault (10 min)…`);
    // concat genera un único vídeo nuevo después de t0 — buscamos el más reciente
    const fresh = await findRecentAsset({ projectId, fileType: "fs-pro-video", sinceMs: t0 - 5000, timeoutMs: 600_000 });
    return { vaultId: fresh.id };
  }
}

// ════════════════════════════════ MAIN ═══════════════════════════════════════
async function main() {
  await fs.appendFile(LOG_FILE, ""); // crea si no existe
  await log("=== CAMPAÑA HANAKAZE SERIGRAPHY — INICIO ===");
  await log(`engines: image=${IMAGE_ENGINE} video=${VIDEO_ENGINE} reset=${RESET}`);

  const PROJECT_ID = parseInt(process.env.HANAKAZE_PROJECT_ID || "0", 10);
  if (!PROJECT_ID) throw new Error("HANAKAZE_PROJECT_ID env requerido");
  await log(`projectId=${PROJECT_ID}`);

  await login();

  // ─── Cargar state previo + pre-flight scan del vault ───
  const state = await loadState();
  await preflightScan(PROJECT_ID, state);

  // ─── FASE 0 — Subida de fotos cliente al Object Storage ───
  // Memoizada: si las URLs ya están en state, las reutilizamos.
  const refs = await memoize(state, "refs:photos-uploaded", async () => {
    await log("\n━━━ FASE 0: SUBIDA DE FOTOS A OBJECT STORAGE ━━━");
    const ASSETS = "attached_assets";
    const [PHOTO_BURRO, PHOTO_MODEL_1, PHOTO_MODEL_2, PHOTO_MODEL_3] = await Promise.all([
      uploadPublicAsset(`${ASSETS}/PXL_20260410_171731994.RAW-01_1777547033722.jpg`, "burro"),
      uploadPublicAsset(`${ASSETS}/IMG-20260414-WA0010_1777547033700.jpg`, "model-1"),
      uploadPublicAsset(`${ASSETS}/IMG-20260414-WA0011_1777547033708.jpg`, "model-2"),
      uploadPublicAsset(`${ASSETS}/IMG-20260414-WA0012_1777547033709.jpg`, "model-3"),
    ]);
    return { PHOTO_BURRO, PHOTO_MODEL_1, PHOTO_MODEL_2, PHOTO_MODEL_3 };
  });
  // OJO: las signed URLs caducan en 1 h. Si el state es viejo, regenera in-line.
  // (Antes recursábamos a main() y eso duplicaba estado en logs/handlers.)
  let refsFresh = refs;
  const refsCompletedAt = new Date(state.steps["refs:photos-uploaded"].completedAt).getTime();
  const refsAgeMin = (Date.now() - refsCompletedAt) / 60_000;
  if (refsAgeMin > 50) {
    await log(`⚠ refs photos tienen ${refsAgeMin.toFixed(1)} min (TTL 60 min) — regenerando in-line…`);
    delete state.steps["refs:photos-uploaded"];
    await saveState(state);
    refsFresh = await memoize(state, "refs:photos-uploaded", async () => {
      await log("\n━━━ FASE 0 (RE-RUN): SUBIDA DE FOTOS A OBJECT STORAGE ━━━");
      const ASSETS = "attached_assets";
      const [PHOTO_BURRO, PHOTO_MODEL_1, PHOTO_MODEL_2, PHOTO_MODEL_3] = await Promise.all([
        uploadPublicAsset(`${ASSETS}/PXL_20260410_171731994.RAW-01_1777547033722.jpg`, "burro"),
        uploadPublicAsset(`${ASSETS}/IMG-20260414-WA0010_1777547033700.jpg`, "model-1"),
        uploadPublicAsset(`${ASSETS}/IMG-20260414-WA0011_1777547033708.jpg`, "model-2"),
        uploadPublicAsset(`${ASSETS}/IMG-20260414-WA0012_1777547033709.jpg`, "model-3"),
      ]);
      return { PHOTO_BURRO, PHOTO_MODEL_1, PHOTO_MODEL_2, PHOTO_MODEL_3 };
    });
  }
  const { PHOTO_BURRO, PHOTO_MODEL_1, PHOTO_MODEL_2, PHOTO_MODEL_3 } = refsFresh;

  const result = {
    references: { PHOTO_BURRO, PHOTO_MODEL_1, PHOTO_MODEL_2, PHOTO_MODEL_3 },
    imagesIntro: null, imagesOutro: null,
    videoClips: [], voiceOff: null, finalVideo: null,
    staticAds: [], infographic: null,
  };

  // ─── FASE 1 — Frames base (intro + outro) ────────────────────────────────
  await log("\n━━━ FASE 1: FRAMES BASE 9:16 ━━━");

  const intro = await memoize(state, "frame:intro-kanji", () => genImage({
    projectId: PROJECT_ID,
    label: "intro-kanji",
    ratio: "1080:1920",
    referenceUrl: PHOTO_BURRO,
    prompt:
      "A single black sumi-e ink kanji 華吹 painted on warm-cream washi paper, character occupies 60% of the frame and is centered. " +
      "Visible dry-brush bristle marks, ink halo bleeding into paper fibres, micro-cracks where the ink dried. " +
      "Background: macro shot of natural washi rice paper with golden gampi flecks scattered in the middle layer. " +
      "Lighting: hard rim light from upper-left at 45 degrees, soft warm fill from below, deep contact shadow. " +
      "Palette: ivory #F2EBDA base, ink absolute black, gold flecks #C9A961. " +
      "Lens: 85mm f/2.8 portrait, shallow depth of field, paper grain in focus. " +
      "Editorial fashion campaign opening frame. Vertical 9:16. No text overlays, no watermarks, no logos.",
  }));
  result.imagesIntro = intro.vaultId;

  // OUTRO: usamos Replicate (flux-1.1-pro) porque Runway gen4_image_turbo
  // rechaza este prompt con "An unexpected error occurred" (filtro server-side
  // imposible de saltar: probado con/sin texto literal, con/sin hex codes).
  // Flux genera placas minimalistas con detalle excelente.
  const outro = await memoize(state, "frame:outro-logo", () => genImage({
    projectId: PROJECT_ID,
    label: "outro-logo",
    ratio: "1080:1920",
    referenceUrl: PHOTO_BURRO,
    engine: "replicate",
    prompt:
      "Vertical 9:16 minimal art poster. Pure deep black background with subtle vignette and fine film grain. " +
      "Centered: a single elegant gold sumi-e brushstroke arc, painted with visible bristle drag and ink halo, occupying about thirty percent of the width. " +
      "Lower third filled with floating gold particle dust in soft bokeh at varying focal depths. " +
      "Lighting from upper left reveals the gold leaf grain on the brushstroke. Large negative space top and bottom. " +
      "Premium editorial atmosphere, no text, no letters, no logos.",
  }));
  result.imagesOutro = outro.vaultId;

  // ─── FASE 2 — 6 vídeos (image-to-video, mezcla de motores) ──────────────
  await log("\n━━━ FASE 2: 6 CLIPS DE VÍDEO 10s ━━━");

  const v1 = await memoize(state, "video:v1-intro", () => genVideo({
    projectId: PROJECT_ID, label: "v1-intro", duration: 10, aspect: "9:16",
    model: "runway-gen4-turbo",
    imageSource: { runwayUrl: intro.runwayUrl, vaultId: intro.vaultId },
    prompt:
      "The kanji is slowly painted by an invisible brush moving stroke by stroke. " +
      "Wet ink spreads through washi paper fibres in capillary motion. " +
      "Gold flecks drift across at varying focal depths, slight forward push-in 5%. " +
      "Speed 0.5x slow motion, vertical 9:16, no text, no UI elements.",
  }));
  result.videoClips.push(v1.vaultId);

  const v2 = await memoize(state, "video:v2-rack", () => genVideo({
    projectId: PROJECT_ID, label: "v2-rack", duration: 10, aspect: "9:16",
    model: "seedance-pro",
    imageSource: { publicUrl: PHOTO_BURRO },
    prompt:
      "Smooth 30-degree clockwise orbit around a steel garment rack of premium hoodies. " +
      "Hoodies on wooden hangers gently sway as a passing breeze crosses the rack. " +
      "Warm tungsten edge-light rakes across the knit fabric, dust motes catch the light beam. " +
      "Depth of field f/4, anamorphic flare, 1.0x natural speed, vertical 9:16.",
  }));
  result.videoClips.push(v2.vaultId);

  const v3 = await memoize(state, "video:v3-model-1", () => genVideo({
    projectId: PROJECT_ID, label: "v3-model-1", duration: 10, aspect: "9:16",
    model: "kling-2.1",
    imageSource: { publicUrl: PHOTO_MODEL_1 },
    prompt:
      "The model rotates 90 degrees to camera right at 0.7x speed, head turns first then shoulders follow. " +
      "Hoodie fabric folds and creases naturally, eye-line drops then returns to camera at the end. " +
      "Side rim light camera-left, neutral charcoal seamless backdrop, anamorphic 2.39:1 letterbox crop within 9:16. No text.",
  }));
  result.videoClips.push(v3.vaultId);

  const v4 = await memoize(state, "video:v4-model-2", () => genVideo({
    projectId: PROJECT_ID, label: "v4-model-2", duration: 10, aspect: "9:16",
    model: "seedance-pro",
    imageSource: { publicUrl: PHOTO_MODEL_2 },
    prompt:
      "The model takes one cinematic step toward the camera. Hoodie fabric pulses with the movement. " +
      "Foreground: light rain particles falling at 60% opacity. Background: blurred neon Tokyo street, reflections in a puddle below frame. " +
      "Teal-orange Kodak 2383 grade, slow motion 0.5x, anamorphic flare, vertical 9:16. No text.",
  }));
  result.videoClips.push(v4.vaultId);

  const v5 = await memoize(state, "video:v5-model-3", () => genVideo({
    projectId: PROJECT_ID, label: "v5-model-3", duration: 10, aspect: "9:16",
    model: "kling-2.1",
    imageSource: { publicUrl: PHOTO_MODEL_3 },
    prompt:
      "The model holds a poised samurai stance, one foot forward, gaze level. " +
      "30 cherry-blossom petals drift and swirl around at varied depths, soft pink rim light catches each petal. " +
      "Slight wind ruffles the fabric. 0.5x slow motion. Premium fashion film aesthetic, vertical 9:16. No text.",
  }));
  result.videoClips.push(v5.vaultId);

  const v6 = await memoize(state, "video:v6-outro", () => genVideo({
    projectId: PROJECT_ID, label: "v6-outro", duration: 10, aspect: "9:16",
    model: "runway-gen4-turbo",
    imageSource: { runwayUrl: outro.runwayUrl, vaultId: outro.vaultId },
    prompt:
      "An invisible brush slowly paints the gold sumi-e arc onto the black background, stroke moving from left to right at 0.8x speed. " +
      "Gold particles trail behind the brush tip and disperse into the bokeh below. " +
      "Gentle 3% forward push-in. Slow shimmer reveals the gold leaf texture. Vertical 9:16, no text, no UI.",
  }));
  result.videoClips.push(v6.vaultId);

  // ─── FASE 3 — Voz off (ElevenLabs Antoni multilingual_v2) ────────────────
  await log("\n━━━ FASE 3: VOZ OFF ━━━");
  const script =
    "Hanakaze. En japonés, viento de flores. " +
    "Cada prenda nace de un trazo de tinta, " +
    "de una pieza serigrafiada a mano en nuestro taller. " +
    "No fabricamos en serie. Tiramos ediciones limitadas. " +
    "Algodón premium, tinta al agua, alma japonesa. " +
    "Hanakaze Serigraphy. Arte vestible desde Tokio.";
  const voz = await memoize(state, "tts:voz-off", () => tts({
    projectId: PROJECT_ID,
    voiceId: "ErXwobaYiN019PkySvjV",
    text: script,
    stability: 0.40, similarity: 0.88, style: 0.45, speed: 0.95,
    label: "voz-off",
  }));
  result.voiceOff = voz.vaultId;

  // ─── FASE 4 — Montaje final ──────────────────────────────────────────────
  await log("\n━━━ FASE 4: MONTAJE FINAL ━━━");
  const finalV = await memoize(state, "concat:final", () => concatFinal({
    projectId: PROJECT_ID,
    videoVaultIds: result.videoClips,
    voiceVaultId: result.voiceOff,
  }));
  result.finalVideo = finalV.vaultId;

  // ─── FASE 5 — 2 anuncios estáticos 1:1 ───────────────────────────────────
  await log("\n━━━ FASE 5: ANUNCIOS ESTÁTICOS 1:1 ━━━");

  const ad1 = await memoize(state, "ad:ad1-male-hoodie", () => genImage({
    projectId: PROJECT_ID,
    label: "ad1-male-hoodie",
    ratio: "1080:1080",
    referenceUrl: PHOTO_MODEL_1,
    engine: "replicate",
    prompt:
      "1:1 square magazine cover layout. Center-right: Japanese male model wearing a black Hanakaze hoodie, three-quarter view, cropped at chest. " +
      "Backdrop: clean dark navy #0E1A2C seamless. " +
      "Upper-right corner: large translucent gold kanji 華吹 floating at 30% opacity, occupying 25% of frame. " +
      "Top-left 35% of frame: deliberate negative space reserved for headline copy (do NOT add any text). " +
      "Lighting: hard side rim from camera-left, octa softbox fill, deep shadow on right cheek. " +
      "Lens: 85mm f/2 medium-format aesthetic, Kodak Portra 400 grade. No text overlay, no UI, no watermark.",
  }));
  result.staticAds.push(ad1.vaultId);

  const ad2 = await memoize(state, "ad:ad2-tshirt-flatlay", () => genImage({
    projectId: PROJECT_ID,
    label: "ad2-tshirt-flatlay",
    ratio: "1080:1080",
    referenceUrl: PHOTO_BURRO,
    engine: "replicate",
    prompt:
      "1:1 overhead flat-lay product photograph. Center: a folded Hanakaze t-shirt on dark washi paper background #1A1612. " +
      "Top-right of folded fabric: the sumi-e cherry-blossom print is partially visible. " +
      "Three asymmetric gold ink splatter accents at 25% opacity in the corners. " +
      "A single fresh bonsai branch with green leaves crosses top-right at a 15-degree angle. " +
      "Lighting: single overhead diffused softbox 90 degrees, soft shadow under fabric. " +
      "Bottom 25% of frame is intentionally empty (do NOT add text). Studio product photography, no UI, no watermark.",
  }));
  result.staticAds.push(ad2.vaultId);

  // ─── FASE 6 — Infografía vertical 9:16 ───────────────────────────────────
  await log("\n━━━ FASE 6: INFOGRAFÍA 9:16 ━━━");
  const info = await memoize(state, "image:infografia-proceso", () => genImage({
    projectId: PROJECT_ID,
    label: "infografia-proceso",
    ratio: "1080:1920",
    referenceUrl: PHOTO_BURRO,
    engine: "replicate",
    prompt:
      "Vertical 9:16 brand storytelling poster on ultra-dark charcoal background #0F0F0F. " +
      "Frame divided into 4 horizontal sections by thin gold sumi-e ink strokes. Each section depicts one stage of artisan serigraphy in editorial product-photography style: " +
      "1) ink mixing in a handmade ceramic bowl with a bamboo brush; " +
      "2) silk-screen exposure under amber UV light; " +
      "3) hand-printing onto dark cotton fabric with a pulled squeegee; " +
      "4) final folded garment with a woven brand label visible. " +
      "Left margin of each section: large numbered gold kanji 一 二 三 四 (one, two, three, four). " +
      "Soft golden particles connecting the sections. No other text, no UI, no watermark.",
  }));
  result.infographic = info.vaultId;

  // ─── REPORT FINAL ────────────────────────────────────────────────────────
  await log("\n━━━ RESULTADO ━━━");
  await log(JSON.stringify(result, null, 2));
  await log(`\n✓ COMPLETADO en ${((Date.now() - startedAt)/1000/60).toFixed(1)} min`);
  await fs.writeFile("logs/hanakaze-result.json", JSON.stringify(result, null, 2));
  state.completedAt = new Date().toISOString();
  state.result = result;
  await saveState(state);
}

process.on("uncaughtException", async (err) => {
  await log(`✗ uncaughtException: ${err.message}\n${err.stack}`);
  process.exit(2);
});
process.on("unhandledRejection", async (reason) => {
  await log(`✗ unhandledRejection: ${reason?.message || reason}\n${reason?.stack || ""}`);
  process.exit(3);
});

main().catch(async (err) => {
  await log(`✗ ERROR: ${err.message}\n${err.stack}`);
  process.exit(1);
});
