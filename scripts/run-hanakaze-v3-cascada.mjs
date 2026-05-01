#!/usr/bin/env node
/**
 * Hanakaze CASCADA v3 — Anuncio 60s con virtual try-on real, deconstrucción,
 * perchero levitando y cascada de TODA la colección.
 *
 *   8 clips de 8s = ~60s totales (después de crossfade 0.35s)
 *   MIX HIPER-PRO (motores tope de gama, vertical 9:16):
 *     · 6× kling-master  ($0.18/s) → calidad 10, audio nativo, motion top
 *                                     intro, deconstrucción, try-on, mariposa,
 *                                     perchero, outro
 *     · 2× seedance-pro  ($0.07/s) → multi-ref hasta 9 imágenes,
 *                                     reveal-puesto + cascada-coleccion
 *                                     (donde necesitamos identidad real
 *                                      de los 2 modelos + las prendas)
 *   Coste estimado total ≈ $10-12 (vídeo + voz + música)
 *
 * Uso:
 *   HANAKAZE_PROJECT_ID=7 node scripts/run-hanakaze-v3-cascada.mjs
 *   HANAKAZE_PROJECT_ID=7 RESET=1 node scripts/run-hanakaze-v3-cascada.mjs
 *   HANAKAZE_PROJECT_ID=7 ONLY=c01,c02 node scripts/run-hanakaze-v3-cascada.mjs
 *
 * Reusa toda la infraestructura del v2 (cliente HTTP raw, state reanudable,
 * polling fallback, rehidratación de URLs públicas, ffmpeg local).
 */

import fs from "node:fs/promises";
import { unlinkSync } from "node:fs";
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

console.log("[boot] Hanakaze v3 CASCADA — virtual try-on + deconstrucción + perchero volador");

const PROJECT_ID = parseInt(process.env.HANAKAZE_PROJECT_ID || "7", 10);
const BASE = "http://localhost:8080";
const EMAIL = process.env.HANAKAZE_ADMIN_EMAIL || "sadiagiljoan@gmail.com";
const PASSWORD = process.env.HANAKAZE_ADMIN_PASSWORD;
if (!PASSWORD) {
  console.error("[FATAL] Falta HANAKAZE_ADMIN_PASSWORD en el entorno. Aborto para no exponer credenciales en código.");
  process.exit(2);
}
const RESET = process.env.RESET === "1";
const ONLY = (process.env.ONLY || "").split(",").map(s => s.trim()).filter(Boolean);
const LOG_FILE = "logs/hanakaze-v3.log";
const STATE_FILE = "logs/hanakaze-v3-state.json";
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
  // ANTI-HUÉRFANOS: marca el step como inFlight ANTES de empezar. Si el proceso muere,
  // la próxima ejecución verá la marca y avisará para que se audite Replicate manualmente.
  state.inFlight = state.inFlight || {};
  state.inFlight[key] = { startedAt: new Date().toISOString(), pid: process.pid };
  await saveState(state);
  try {
    const result = await fn();
    state.steps[key] = { ...result, completedAt: new Date().toISOString() };
    delete state.inFlight[key];
    await saveState(state);
    return result;
  } catch (err) {
    // Mantenemos la marca inFlight para auditoría posterior; otra instancia podrá ver
    // el clip que estaba en vuelo cuando murió este proceso.
    state.inFlight[key] = { ...state.inFlight[key], failedAt: new Date().toISOString(), error: String(err?.message || err).slice(0, 300) };
    await saveState(state);
    throw err;
  }
}

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

async function genVideo({ projectId, prompt, duration = 8, aspect = "9:16", model = "seedance-pro", sourceImageUrl, label }) {
  await log(`▶ video[${model}:${label}] dur=${duration}s ${sourceImageUrl ? "(i2v)" : "(t2v)"}`);
  const t0 = Date.now();
  const fingerprint = prompt.slice(0, 60);
  try {
    const res = await api(`/api/fs-pro/generate-video`, {
      method: "POST",
      json: { projectId, model, prompt, duration, aspect, sourceImageUrl: sourceImageUrl || undefined },
      abortAfterMs: 600_000,
    });
    const data = await jsonOrThrow(res, `video:${model}:${label}`);
    const sizeMB = data.sizeBytes ? (data.sizeBytes/1024/1024).toFixed(2) : "?";
    await log(`✔ video[${model}:${label}] vault=${data.vaultId} size=${sizeMB}MB (${((Date.now()-t0)/1000).toFixed(1)}s)`);
    return { vaultId: data.vaultId, model, prompt };
  } catch (e) {
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

async function genMusicSegment({ projectId, prompt, duration = 60, label }) {
  const lengthMs = Math.min(180_000, Math.max(5000, Math.round(duration * 1000)));
  await log(`▶ music[${label}] dur=${duration}s (elevenlabs music, ${lengthMs}ms)`);
  const t0 = Date.now();
  const ELK = process.env.ELEVENLABS_API_KEY;
  if (!ELK) throw new Error("ELEVENLABS_API_KEY no definido en env");

  const cr = await fetch("https://api.elevenlabs.io/v1/music", {
    method: "POST",
    headers: { "xi-api-key": ELK, "Content-Type": "application/json" },
    body: JSON.stringify({ prompt, music_length_ms: lengthMs }),
  });
  if (!cr.ok) {
    const t = await cr.text();
    throw new Error(`elevenlabs music HTTP ${cr.status}: ${t.slice(0,300)}`);
  }
  const audioBuf = Buffer.from(await cr.arrayBuffer());
  await log(`  · descargado ${(audioBuf.length/1024).toFixed(1)}KB`);

  const fd = new FormData();
  fd.append("projectId", String(projectId));
  fd.append("title", `Hanakaze v3 Music ${label}`);
  fd.append("fileType", "fs-pro-music");
  fd.append("mimeType", "audio/mpeg");
  fd.append("generatedBy", "hanakaze-v3:musicgen");
  fd.append("file", new Blob([audioBuf], { type: "audio/mpeg" }), `music-${label}.mp3`);
  const sv = await fetch(`http://localhost:8080/api/fs-pro/save-to-vault`, {
    method: "POST", headers: { Cookie: cookieJar || "" }, body: fd,
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
//  8 clips × 7-8s = ~60s — cascada de toda la colección Hanakaze
//  Each prompt has internal timeline (0-2s / 3-5s / 6-8s) for cinematic detail
// ═════════════════════════════════════════════════════════════════════════════

// Refs reales — sufijo _1777652964* son las MÁS recientes subidas (1 mayo 2026)
const REF_FILES = {
  // foto1+2 = manos sosteniendo camisetas blancas (modelo A)
  modeloA_blanca:    "attached_assets/PXL_20260501_161039286.RAW-01_1777652964795.jpg",
  modeloA_someulp:   "attached_assets/PXL_20260501_161028998.RAW-01_1777652964846.jpg",
  // foto3+4 = modelo barbudo con kanji + camiseta mariposa
  modeloB_kanji:     "attached_assets/PXL_20260501_161003312.RAW-01_1777652964865.jpg",
  modeloB_mariposa:  "attached_assets/PXL_20260501_160956327.RAW-01_1777652964880.jpg",
  // foto5+6 = los DOS modelos sentados detrás de mesa con todas las prendas extendidas (estante)
  estante_modelos1:  "attached_assets/PXL_20260501_160859926.RAW-01_1777652964896.jpg",
  estante_modelos2:  "attached_assets/PXL_20260501_160857925.RAW-01_1777652964913.jpg",
  // foto7 = perchero con sudadera azul + camisetas blancas (con precios 14€/18€)
  perchero:          "attached_assets/PXL_20260501_160841573.RAW-01_1777652964930.jpg",
  // foto8+9 = camiseta blanca espectral + samurái
  prenda_espectral:  "attached_assets/PXL_20260410_171739653.RAW-01_1777652964951.jpg",
  prenda_samurai:    "attached_assets/PXL_20260410_171731994.RAW-01_1777652964970.jpg",
};

// Voz off ES — guion ~150 palabras × 175wpm × 0.96 speed → ~52-55 segundos
// (encaja en 60s de vídeo dejando 5s de cola para outro)
const VOICE_TEXT = `Hanakaze Serigraphy. Cada prenda nace en nuestro taller, hecha a mano.
Mira lo que pasa cuando el algodón cobra vida.
La camiseta del samurái se desteje en hilos negros y dorados que vuelven a unirse sobre tu piel.
La mariposa estampada despega del perchero y se posa en tu espalda.
El sello kanji 華吹 aparece, trazo a trazo, sobre cada pieza.
Sudaderas en azul cobalto. Camisetas blancas. Hoodies negros con mariposa.
Edición limitada. Estampada una a una. Sin moldes industriales.
Hanakaze Serigraphy. Ese toque handmade que se nota.
Síguenos en Instagram, arroba hanakaze punto serigraphy.`;

// Voice ID — Bella ES multilingual (misma que v2, ya validada)
const VOICE_ID = "21m00Tcm4TlvDq8ikWAM";

// Música: 1 segmento de 60s (más simple que v2, encaja exacto con vídeo)
const MUSIC_PROMPTS = {
  full: "Cinematic Japanese fashion documentary track, 60 seconds: opens with a soft shakuhachi flute solo and faint koto strings creating mysterious atmosphere, then around the 15s mark a deep taiko drum heartbeat enters subtly, ethereal pad layer, modern hybrid orchestra with restrained emotion, slow build to gentle crescendo at 40s, instrumental, no vocals, 90 bpm",
};

// 8 CLIPS — cada uno con timeline interno hiper-detallado.
// Mix de motores optimizado por tipo de escena (coste/calidad).
function buildClips() {
  return [
    {
      // CLIP 1 — INTRO: kanji 華吹 se serigrafía sobre tela blanca (t2v puro)
      // kling-master: calidad 10 + audio nativo (sonido suave de tela/ink)
      key: "c01-intro-kanji-stamp",
      model: "kling-master", duration: 5, aspect: "9:16",
      prompt: "Cinematic 4K vertical 9:16 5-second intro on a pure white cotton fabric background with subtle weave texture. TIMELINE: 0-1s the camera holds steady on the empty fabric, slight breathing motion, dust particles floating in soft natural daylight. 1-3s thick black silkscreen ink rapidly drips from above and spreads across the fabric in elegant brush strokes, forming a black octagonal stamp containing the Japanese kanji 華吹 (Hanakaze) — the strokes appear quickly one after another as if printed by an invisible silkscreen squeegee. 3-5s the freshly printed kanji stamp dries with authentic hand-printed ink texture and slight imperfections on the edges, the camera holds completely steady on the finished stamp until the end. STRICT RULES: no Latin alphabet text, no English words, no brand name written, no typography, no logos, no labels, no signs — only the black octagonal stamp containing the kanji 華吹 must appear on the fabric. Indie streetwear handmade aesthetic, no luxury feel, no gold ink. Subtle ambient sound of fabric and ink.",
    },
    {
      // CLIP 2 — REVEAL del puesto con los 2 modelos y todas las prendas extendidas
      key: "c02-reveal-puesto",
      model: "seedance-pro", duration: 5, aspect: "9:16",
      prompt: "Cinematic 4K vertical 9:16 5-second reveal at an outdoor pop-up market stand on a wooden rooftop terrace in Barcelona. TIMELINE: 0-2s slow dolly push-in from a high angle revealing a wooden table covered with a brown checkered cloth, on top neatly folded WHITE t-shirts and NAVY BLUE sweatshirts arranged in 4 rows of 2 with small octagonal kanji 華吹 stamps visible on chests, plus a round black-and-red sticker pile in the center. 2-4s the camera continues forward and lowers smoothly to eye level, revealing two bearded young men sitting behind the table — one on the left with a beige cap and beige hoodie, the other on the right with a beige cap, sunglasses and a white t-shirt with the small kanji chest stamp. They smile slightly at the camera. 4-5s subtle hand-held drift settles, sun glare on the wooden table, palm trees and stacked metal chairs blurred in background. Authentic candid streetwear documentary style, photorealistic, natural mid-day sunlight. Keep the two real models, the table arrangement, the fold pattern of the garments, and the stamp designs identical to the reference image.",
      refKey: "estante_modelos1",
    },
    {
      // CLIP 3 — DECONSTRUCCIÓN: la camiseta samurái se desteje en hilos
      // kling-master: VFX hero + audio nativo (sonido de hilos/partículas)
      key: "c03-deconstruccion-samurai",
      model: "kling-master", duration: 10, aspect: "9:16",
      prompt: "Cinematic 4K vertical 9:16 10-second hero VFX sequence. TIMELINE: 0-2s a WHITE cotton t-shirt held on a wooden hanger by a hand floats in front of a softly blurred outdoor terrace background. The front of the t-shirt features a hand-drawn samurai illustration in BLACK LINE-ART with mustard YELLOW-GOLD kimono fills, conical straw hat, katana at the side, ukiyo-e style. The camera slowly pushes in toward the print. 2-4s the t-shirt fabric begins to deconstruct from the bottom up — individual cotton threads detach and rise upward in slow motion like glowing strings, while the printed samurai illustration starts breaking apart into BLACK and GOLD ink particles that begin swirling. 4-7s the deconstruction reaches the top of the garment — thousands of threads and ink particles swirl mid-air in an elegant tornado, the wooden hanger remains perfectly static, the empty space behind starts becoming visible. 7-10s the threads and ink particles continue spiraling upward and outward, slowly thinning out, leaving only the hanger floating empty in the frame as the last sparkles fade. Soft natural daylight, magical realism, photorealistic textures, slow motion, particle physics, art-direction inspired by Apple Vision ad campaigns. Preserve the exact samurai illustration design and the white t-shirt appearance from the reference image — only the deconstruction effect is added. Subtle ambient sound of soft fabric tearing and shimmering particles.",
      refKey: "prenda_samurai",
    },
    {
      // CLIP 4 — TRY-ON real: hilos vuelven y forman camiseta kanji sobre el modelo barbudo
      // kling-master: máxima fidelidad al rostro real (character lock natural) + audio
      key: "c04-tryon-kanji-modelo",
      model: "kling-master", duration: 10, aspect: "9:16",
      prompt: "Cinematic 4K vertical 9:16 10-second virtual try-on. The reference image shows the FINAL look: a man wearing a plain WHITE oversized t-shirt with one small BLACK octagonal kanji 華吹 stamp on the LEFT CHEST. Match this exactly. TIMELINE: 0-2s the same young man with curly dark hair and long thick beard stands on a sunny rooftop terrace facing the camera with a calm relaxed expression, bare-chested or in a plain white undershirt, palm trees blurred behind him. 2-4s a soft halo of warm sunlight builds around his torso and a fast wipe of glowing white cotton particles sweeps from his shoulders down to his waist. 4-5s the white t-shirt APPEARS on his body in one clean magical fade-in already fully formed, already with the small black octagonal kanji 華吹 stamp printed on the LEFT chest exactly as in the reference image — the stamp is pre-existing on the garment, NEVER drawn in-frame, NEVER animated, NEVER silkscreened live. 5-9s the man relaxes, his shoulders settle into the t-shirt naturally with realistic cotton drape, he looks down at the chest stamp with a subtle smile, then up to the camera, with one hand briefly touching the fabric. 9-10s steady hold on his portrait wearing the finished garment. STRICT FIDELITY RULES: the t-shirt is PURE WHITE with NO other graphics, NO back print, NO front large print, NO additional text — only the single small black octagonal kanji 華吹 stamp on the LEFT chest. The stamp design, position, size, color must be IDENTICAL to the reference image at EVERY frame; no recoloring, no redrawing, no reinterpretation, no extra ink, no gold, no luxury feel. Character lock: face, beard, hair, skin tone, pose identical to reference. Photorealistic, natural mid-day sunlight, indie streetwear. Subtle ambient sound of cotton fabric.",
      refKey: "modeloB_kanji",
    },
    {
      // CLIP 5 — TRY-ON 2: la mariposa estampada vuela y se posa en otra prenda blanca
      // kling-master: motion biológico realista + audio nativo (aleteo)
      key: "c05-tryon-mariposa-vuela",
      model: "kling-master", duration: 10, aspect: "9:16",
      prompt: "Cinematic 4K vertical 9:16 10-second magical VFX sequence with a SINGLE white t-shirt. The reference image shows the t-shirt: PURE WHITE cotton with one BLACK silkscreen-printed butterfly+face design on the back, NO other graphics. Match this design exactly. TIMELINE: 0-2s the WHITE t-shirt is held flat in mid-air by two invisible hands, back-side facing the camera, in soft sunlight with floating dust particles, the BLACK butterfly+face print is fully visible and centered on the back. 2-4s the printed butterfly slowly detaches from the fabric like a 3D layer lifting off — it remains BLACK ink with the EXACT same wing shape, antennae and face design from the reference, just becoming a real flapping creature. The fabric below where the print was is now plain white. 4-7s the black ink butterfly flies in a graceful slow-motion arc across the frame, wings flapping smoothly, leaving a faint trail of dissolving black ink particles, the camera tracks its flight against a softly blurred outdoor terrace background. 7-9s the butterfly returns toward the SAME white t-shirt and slowly descends onto the back fabric in the original print position. 9-10s the butterfly settles flat onto the cotton and becomes a hand-printed silkscreen design again, IDENTICAL to the reference image, with authentic textile ink texture. STRICT FIDELITY RULES: only ONE white t-shirt in the entire shot, never two; the butterfly+face print design, color (pure black ink), shape, proportions and final position must remain IDENTICAL to the reference at every frame; no recoloring, no extra wings, no extra graphics on the t-shirt, no front print, no kanji, no text, no gold. Soft natural daylight, magical realism, slow motion, photorealistic. Subtle ambient sound of soft butterfly wing flutters.",
      refKey: "modeloB_mariposa",
    },
    {
      // CLIP 6 — PERCHERO → CUERPO: la sudadera azul vuela del perchero y se adhiere al modelo
      // kling-master: física de tela top + audio nativo (viento + tela)
      key: "c06-perchero-levita",
      model: "kling-master", duration: 10, aspect: "9:16",
      prompt: "Cinematic 4K vertical 9:16 10-second hero shot. The reference image shows the EXACT garment that must appear: a NAVY BLUE crewneck sweatshirt hanging on a wooden hanger on a black metal rack — match this sweatshirt's exact color, exact print design and exact stitching at every frame. TIMELINE: 0-2s the black metal clothing rack stands on a wooden outdoor terrace floor with several WHITE t-shirts hanging on the left and the same NAVY BLUE Hanakaze crewneck sweatshirt hanging in the center exactly as in the reference image. To the right stands a young man with curly dark hair and a long thick beard, calm relaxed expression, wearing a plain white undershirt and dark pants, palm trees blurred behind. 2-4s the NAVY BLUE sweatshirt LIFTS OFF its wooden hanger smoothly as ONE complete rigid garment — it never comes apart, never deconstructs into threads, never changes color, never changes print, the print and stitching stay perfectly intact and identical to the reference at every single frame. The empty wooden hanger sways gently. 4-7s the navy blue sweatshirt floats gracefully through the air toward the man as a SOLID garment with realistic gentle fabric ripple, holding its exact original shape, color and print. The camera tracks it smoothly. 7-9s the sweatshirt arrives in front of him, its collar slips over his head and his arms slide naturally into the sleeves like he is putting on real clothing — NOT magical stitching, NOT dissolving threads, just a normal smooth clothing motion. The garment settles onto his body in its full original design. 9-10s he adjusts the sleeves once with his hands, looks down at his chest, smiles softly and looks up at the camera now wearing the navy blue sweatshirt. STRICT FIDELITY RULES: throughout the entire 10 seconds the sweatshirt is ALWAYS the same NAVY BLUE color and the same Hanakaze print and stitching from the reference image — no recoloring, no redrawing, no new graphics added, no print changes mid-flight, no extra text, no kanji added, no color shift to royal/cobalt/turquoise/black. The garment is solid and continuous, never broken into particles or threads. Character lock: face, beard, hair identical to reference. Photorealistic, soft mid-day sunlight, magical realism, real fabric physics. Subtle ambient sound of soft wind and fabric draping.",
      refKey: "perchero",
    },
    {
      // CLIP 7 — CASCADA: 4 prendas distintas se materializan en cascada vertical
      key: "c07-cascada-coleccion",
      model: "seedance-pro", duration: 5, aspect: "9:16",
      prompt: "Cinematic 4K vertical 9:16 5-second cascade sequence on a soft cream-painted wall background with subtle wooden terrace floor visible at the bottom. TIMELINE: 0-1s a folded WHITE t-shirt with a small BLACK octagonal kanji 華吹 stamp on the left chest materializes at the top of the frame from a swirl of white cotton particles. 1-2s a folded WHITE t-shirt with a black SAMURAI illustration in line-art with yellow-gold kimono materializes just below it from black and gold ink particles. 2-3s a folded NAVY BLUE crewneck sweatshirt with a small WHITE octagonal kanji stamp on the chest materializes below from blue fabric particles. 3-4s a folded WHITE t-shirt with a black butterfly+face print materializes at the bottom from black ink particles, completing a perfect vertical cascade of 4 different garments — all the real Hanakaze Serigraphy designs stacked from top to bottom. 4-5s the camera holds steady on the full cascade as the last particles dissolve, each garment with authentic hand-printed serigraphy texture clearly visible. Subtle soft sunlight from the right, photorealistic textures, indie streetwear collection showcase. Each design must remain faithful to the references — no invented graphics.",
      refKey: "estante_modelos2",
    },
    {
      // CLIP 8 — OUTRO CTA: kanji + brand + Instagram handle (LEGIBLE)
      // kling-master: tipografía/render limpio + audio cierre suave
      key: "c08-outro-cta",
      model: "kling-master", duration: 5, aspect: "9:16",
      prompt: "Cinematic 4K vertical 9:16 5-second outro background plate. Deep NAVY BLUE solid background with subtle cotton fabric weave texture, completely STATIC camera (no zoom, no motion). TIMELINE: 0-1s the navy fabric background sits empty in soft warm light. 1-2s a large WHITE octagonal silkscreen stamp containing the Japanese kanji 華吹 fades in centered in the UPPER THIRD of the frame, with crisp clean serigraphy edges and authentic hand-printed white ink texture on the navy fabric. 2-5s the kanji stamp holds perfectly still in the upper third, the lower two thirds of the frame remain EMPTY navy fabric (intentionally empty for post-production text overlay), no movement, no extra elements. STRICT RULES: NO Latin alphabet text, NO English words, NO brand name written in any language, NO typography, NO logos, NO Instagram handles, NO labels, NO signs, NO icons — the ONLY visual element is the single white octagonal kanji 華吹 stamp in the upper third. The lower two thirds must stay completely clean navy fabric. No gold ink, no luxury aesthetic. Subtle ambient sound of soft fabric and a final quiet bell tone.",
    },
  ];
}

// ════════════════════════════════ MAIN ═══════════════════════════════════════
const PID_FILE = "logs/hanakaze-v3.pid";

async function acquireLock() {
  try {
    const prev = await fs.readFile(PID_FILE, "utf8").then(s => parseInt(s.trim(), 10)).catch(() => 0);
    if (prev > 0 && prev !== process.pid) {
      try {
        process.kill(prev, 0); // signal 0 = solo comprobar si vive
        // Si llegamos aquí, el PID anterior sigue vivo → ABORTAR para no duplicar gasto
        console.error(`[lock] OTRA INSTANCIA ya corriendo PID=${prev}. Abortando para no duplicar Replicate.`);
        process.exit(2);
      } catch {
        // PID muerto, podemos tomar el lock
      }
    }
  } catch {}
  await fs.writeFile(PID_FILE, String(process.pid));
  const release = async () => { try { await fs.unlink(PID_FILE); } catch {} };
  process.on("exit", () => { try { unlinkSync(PID_FILE); } catch {} });
  process.on("SIGTERM", async () => { await release(); process.exit(143); });
  process.on("SIGINT", async () => { await release(); process.exit(130); });
}

async function main() {
  await fs.mkdir("logs", { recursive: true }).catch(()=>{});
  await acquireLock();
  await fs.appendFile(LOG_FILE, "");
  await log("=== HANAKAZE CASCADA v3 — INICIO ===");
  await log(`projectId=${PROJECT_ID} reset=${RESET} only=${ONLY.join(",") || "(all)"} pid=${process.pid}`);

  await login();
  const state = await loadState();

  // ─── 0) AUDITORÍA HUÉRFANOS: avisar si hay steps en vuelo de una corrida muerta ────
  if (state.inFlight && Object.keys(state.inFlight).length) {
    for (const [k, v] of Object.entries(state.inFlight)) {
      await log(`⚠️ ANTI-HUÉRFANOS: step '${k}' quedó EN VUELO el ${v.startedAt} (PID muerto ${v.pid}). Audita Replicate /v1/predictions filtrando por created_at >= ${v.startedAt} antes de continuar — puede haber un clip succeeded sin guardar al vault. Limpia state.inFlight['${k}'] manualmente cuando hayas auditado.`);
    }
  }

  // ─── 1) Subir refs (9 imágenes) → URLs HTTPS firmadas (1h) ─────────
  const refs = {};
  for (const [name, p] of Object.entries(REF_FILES)) {
    refs[name] = await memoize(state, `ref-${name}`, async () => {
      const url = await uploadPublicAsset(p, `ref-${name}`);
      return { publicUrl: url, refLocal: p };
    });
  }

  // ─── 2) Generar 8 clips ───────────────────────────────────────────
  const clips = buildClips();
  const clipResults = {};
  for (const c of clips) {
    const sourceImageUrl = c.refKey ? refs[c.refKey]?.publicUrl : undefined;
    clipResults[c.key] = await memoize(state, c.key, async () => {
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

  // ─── 3) Voz off ────────────────────────────────────────────────────
  const voice = await memoize(state, "voice-off-v3", async () => {
    return await tts({ projectId: PROJECT_ID, voiceId: VOICE_ID, text: VOICE_TEXT, label: "voice-off-v3" });
  });

  // ─── 4) Música 60s ─────────────────────────────────────────────────
  const music = await memoize(state, "music-full-60s", () => genMusicSegment({
    projectId: PROJECT_ID, prompt: MUSIC_PROMPTS.full, duration: 60, label: "music-full",
  }));

  // ─── 5) CONCAT FINAL — 8 clips + voz + música ─────────────────────
  const final = await memoize(state, "concat-final-v3", async () => {
    const orderedKeys = clips.map(c => c.key);
    const videoVaultIds = orderedKeys.map(k => clipResults[k]?.vaultId).filter(Boolean);
    if (videoVaultIds.length !== 8) {
      throw new Error(`Concat estricto: se requieren 8 clips, solo ${videoVaultIds.length} disponibles. Faltan: ${orderedKeys.filter(k => !clipResults[k]?.vaultId).join(", ")}`);
    }
    return await concatFinal({
      projectId: PROJECT_ID,
      videoVaultIds,
      voiceVaultId: voice.vaultId,
      musicVaultId: music.vaultId,
    });
  });

  // ─── 6) Resumen final ─────────────────────────────────────────────
  const elapsed = ((Date.now() - startedAt) / 1000).toFixed(1);
  const summary = {
    completedAt: new Date().toISOString(),
    elapsedSec: elapsed,
    refs: Object.fromEntries(Object.entries(refs).map(([k,v]) => [k, v?.publicUrl ? "uploaded" : null])),
    clips: clips.map(c => ({ key: c.key, model: c.model, duration: c.duration, vaultId: clipResults[c.key]?.vaultId })),
    voice: voice.vaultId,
    music: music.vaultId,
    finalConcat: final.vaultId,
    estimatedDurationSec: clips.reduce((a,c) => a + c.duration, 0),
  };
  await fs.writeFile("logs/hanakaze-v3-result.json", JSON.stringify(summary, null, 2));
  await log(`\n═══ HANAKAZE CASCADA v3 COMPLETO en ${elapsed}s ═══`);
  await log(`  • clips:        ${clips.length} (≈${summary.estimatedDurationSec}s)`);
  await log(`  • voz off:      vault=${voice.vaultId}`);
  await log(`  • música:       vault=${music.vaultId}`);
  await log(`  • CONCAT FINAL: vault=${final.vaultId}`);
  await log(`Resumen: logs/hanakaze-v3-result.json`);
}

main().catch(async (e) => {
  await log(`✗ FATAL: ${e.message}`);
  await log(e.stack || "");
  process.exit(1);
});
