#!/usr/bin/env node
import fs from "node:fs/promises";
import path from "node:path";

const BASE = "http://localhost:8080";
const EMAIL = "sadiagiljoan@gmail.com";
const PASSWORD = "Lara14032025#";

const LOG_FILE = path.resolve("logs/hanakaze-campaign.log");

let cookieJar = "";
const startedAt = Date.now();

async function log(msg) {
  const stamp = new Date().toISOString();
  const line = `[${stamp}] ${msg}\n`;
  process.stdout.write(line);
  await fs.appendFile(LOG_FILE, line);
}

async function api(pathname, opts = {}) {
  const url = `${BASE}${pathname}`;
  const headers = { ...(opts.headers || {}) };
  if (cookieJar) headers["Cookie"] = cookieJar;
  if (opts.json) {
    headers["Content-Type"] = "application/json";
    opts.body = JSON.stringify(opts.json);
    delete opts.json;
  }
  const res = await fetch(url, { ...opts, headers });
  const setCookie = res.headers.get("set-cookie");
  if (setCookie) {
    const sessionCookie = setCookie.split(";")[0];
    cookieJar = sessionCookie;
  }
  return res;
}

async function jsonOrThrow(res, label) {
  const text = await res.text();
  if (!res.ok) {
    throw new Error(`[${label}] HTTP ${res.status}: ${text.slice(0, 500)}`);
  }
  try { return JSON.parse(text); } catch { throw new Error(`[${label}] Invalid JSON: ${text.slice(0, 200)}`); }
}

async function login() {
  await log("Login admin…");
  const res = await api("/api/auth/login", { method: "POST", json: { email: EMAIL, password: PASSWORD } });
  const data = await jsonOrThrow(res, "login");
  await log(`Login OK userId=${data.user?.id} role=${data.user?.role}`);
}

async function generateImage({ projectId, model, prompt, aspectRatio = "1:1", label }) {
  await log(`▶ image[${label}] model=${model} ar=${aspectRatio}`);
  const t0 = Date.now();
  const res = await api("/api/fs-pro/generate-image", {
    method: "POST",
    json: { projectId, model, prompt, aspectRatio },
  });
  const data = await jsonOrThrow(res, `image:${label}`);
  await log(`✔ image[${label}] vaultId=${data.vaultId} (${((Date.now() - t0)/1000).toFixed(1)}s)`);
  return data.vaultId;
}

async function generateVideo({ projectId, model, prompt, duration, aspect, imagePath, label }) {
  await log(`▶ video[${label}] model=${model} dur=${duration}s ${imagePath ? "img→vid" : "txt→vid"}`);
  const t0 = Date.now();
  const form = new FormData();
  form.append("projectId", String(projectId));
  form.append("model", model);
  form.append("prompt", prompt);
  form.append("duration", String(duration));
  form.append("aspect", aspect);
  if (imagePath) {
    const buf = await fs.readFile(imagePath);
    const blob = new Blob([buf], { type: "image/jpeg" });
    form.append("image", blob, path.basename(imagePath));
  }
  const headers = {};
  if (cookieJar) headers["Cookie"] = cookieJar;
  const res = await fetch(`${BASE}/api/fs-pro/generate-video`, { method: "POST", body: form, headers });
  const data = await jsonOrThrow(res, `video:${label}`);
  await log(`✔ video[${label}] vaultId=${data.vaultId} size=${(data.sizeBytes/1024/1024).toFixed(2)}MB (${((Date.now() - t0)/1000).toFixed(1)}s)`);
  return data.vaultId;
}

async function generateTTS({ projectId, voiceId, text, modelId = "eleven_multilingual_v2", stability = 0.40, similarity = 0.88, style = 0.45, speed = 1.0, label }) {
  await log(`▶ tts[${label}] chars=${text.length} voice=${voiceId}`);
  const t0 = Date.now();
  const res = await api("/api/fs-pro/tts", {
    method: "POST",
    json: { projectId, voiceId, text, modelId, stability, similarity, style, speed },
  });
  const data = await jsonOrThrow(res, `tts:${label}`);
  await log(`✔ tts[${label}] vaultId=${data.vaultId} (${((Date.now() - t0)/1000).toFixed(1)}s)`);
  return data.vaultId;
}

async function concatVideos({ projectId, videoVaultIds, voiceVaultId, transitionPreset = "crossfade", crossfadeSec = 0.5, voiceVolume = 1.0 }) {
  await log(`▶ concat ${videoVaultIds.length} clips + voz off…`);
  const t0 = Date.now();
  const res = await api("/api/fs-pro/concat", {
    method: "POST",
    json: { projectId, videoVaultIds, voiceVaultId, transitionPreset, crossfadeSec, voiceVolume,
            width: 1080, height: 1920, fps: 30 },
  });
  const data = await jsonOrThrow(res, "concat");
  await log(`✔ concat vaultId=${data.vaultId} size=${(data.sizeBytes/1024/1024).toFixed(2)}MB (${((Date.now() - t0)/1000).toFixed(1)}s)`);
  return data.vaultId;
}

async function main() {
  await fs.writeFile(LOG_FILE, "");
  await log("=== CAMPAÑA HANAKAZE SERIGRAPHY — INICIO ===");

  // Project ID se pasa por env, o se busca por nombre
  const PROJECT_ID = parseInt(process.env.HANAKAZE_PROJECT_ID || "0", 10);
  if (!PROJECT_ID) throw new Error("HANAKAZE_PROJECT_ID env requerido");
  await log(`projectId=${PROJECT_ID}`);

  await login();

  const ASSETS = "attached_assets";
  const PHOTO_BURRO = `${ASSETS}/PXL_20260410_171731994.RAW-01_1777547033722.jpg`;
  const PHOTO_MODEL_1 = `${ASSETS}/IMG-20260414-WA0010_1777547033700.jpg`;
  const PHOTO_MODEL_2 = `${ASSETS}/IMG-20260414-WA0011_1777547033708.jpg`;
  const PHOTO_MODEL_3 = `${ASSETS}/IMG-20260414-WA0012_1777547033709.jpg`;

  const result = {
    backplates: [],
    videoClips: [],
    voiceOff: null,
    finalVideo: null,
    staticAds: [],
    infographic: null,
    timings: {},
  };

  // ─── 1. BACKPLATES (2× Flux Schnell, fondos cinematográficos)
  await log("\n━━━ FASE 1: BACKPLATES ━━━");
  result.backplates.push(await generateImage({
    projectId: PROJECT_ID,
    model: "flux-schnell",
    prompt: "Cinematic Japanese washi paper background, sumi-e ink stains, gold leaf accents, soft tokyo dusk lighting, 9:16, dark moody premium serigraphy aesthetic, no text, no watermarks",
    aspectRatio: "9:16",
    label: "washi-bg",
  }));
  result.backplates.push(await generateImage({
    projectId: PROJECT_ID,
    model: "flux-schnell",
    prompt: "Premium photo studio backdrop, cyclorama, deep neutral charcoal grey, single soft key light from above, ultra clean, ready for product composite, 1:1 square, no objects",
    aspectRatio: "1:1",
    label: "studio-neutral",
  }));

  // ─── 2. VÍDEO MULTISHOT (6 clips × 10s)
  await log("\n━━━ FASE 2: VÍDEO 6 CLIPS ━━━");

  // Clip 1 — INTRO (text-to-video, kling-master, premium)
  result.videoClips.push(await generateVideo({
    projectId: PROJECT_ID,
    model: "kling-master",
    prompt: "Cinematic opening shot: a single drop of black sumi-e ink falls onto traditional Japanese washi paper in slow motion. As the ink hits, it ripples and morphs into the kanji 華吹 (Hanakaze) — flower wind. Gold leaf particles drift in the air. Dramatic side lighting, shallow depth of field, cinematic 4k, premium fashion brand intro, no text overlays, no watermarks.",
    duration: 10,
    aspect: "9:16",
    label: "intro-kanji",
  }));

  // Clip 2 — BURRO DE ROPA (image-to-video, runway-gen4-turbo, real product)
  result.videoClips.push(await generateVideo({
    projectId: PROJECT_ID,
    model: "runway-gen4-turbo",
    prompt: "Camera slowly orbits around a clothing rack displaying premium Hanakaze hoodies and t-shirts with Japanese serigraphy prints. Soft warm light leak crosses the frame, dust particles float in the air, cinematic shallow depth of field, premium streetwear brand b-roll, 9:16 vertical, no text.",
    duration: 10,
    aspect: "9:16",
    imagePath: PHOTO_BURRO,
    label: "burro-ropa",
  }));

  // Clip 3 — MODELO 1 (image-to-video, seedance-pro)
  result.videoClips.push(await generateVideo({
    projectId: PROJECT_ID,
    model: "seedance-pro",
    prompt: "The model slowly rotates 90 degrees showing the back print of the Hanakaze hoodie, fashion editorial style, cinematic motion blur, soft side light, premium brand campaign, 9:16, no text.",
    duration: 10,
    aspect: "9:16",
    imagePath: PHOTO_MODEL_1,
    label: "model-rotate-1",
  }));

  // Clip 4 — MODELO 2
  result.videoClips.push(await generateVideo({
    projectId: PROJECT_ID,
    model: "seedance-pro",
    prompt: "The model takes one slow step toward the camera, fabric of the hoodie moves naturally, rain particles fall in foreground, neon tokyo street reflection, cinematic teal-orange grade, 9:16, no text.",
    duration: 10,
    aspect: "9:16",
    imagePath: PHOTO_MODEL_2,
    label: "model-walk-2",
  }));

  // Clip 5 — MODELO 3
  result.videoClips.push(await generateVideo({
    projectId: PROJECT_ID,
    model: "seedance-pro",
    prompt: "The model holds a samurai-like pose, soft cherry blossom petals fall and swirl around them, slow motion, cinematic anamorphic look, premium fashion film aesthetic, 9:16, no text.",
    duration: 10,
    aspect: "9:16",
    imagePath: PHOTO_MODEL_3,
    label: "model-samurai-3",
  }));

  // Clip 6 — CIERRE LOGO (text-to-video, wan-2.5-fast)
  result.videoClips.push(await generateVideo({
    projectId: PROJECT_ID,
    model: "wan-2.5-fast",
    prompt: "Black background. Golden sumi-e ink strokes elegantly draw the brand logotype 'HANAKAZE SERIGRAPHY' from left to right with calligraphic motion. Subtle gold particle shimmer follows each stroke. Below appears the tagline 'Worn art from Tokyo'. Premium luxury fashion brand outro, cinematic, 9:16.",
    duration: 10,
    aspect: "9:16",
    label: "outro-logo",
  }));

  // ─── 3. VOZ OFF (ElevenLabs multilingual v2, voz Antoni cálida natural)
  await log("\n━━━ FASE 3: VOZ OFF ━━━");
  const voiceOverScript =
    "Hanakaze. En japonés, viento de flores. " +
    "Cada prenda nace de un trazo de tinta, " +
    "de una pieza serigrafiada a mano en nuestro taller. " +
    "No fabricamos en serie. Tiramos ediciones limitadas. " +
    "Algodón premium, tinta al agua, alma japonesa. " +
    "Hanakaze Serigraphy. Arte vestible desde Tokio.";

  result.voiceOff = await generateTTS({
    projectId: PROJECT_ID,
    voiceId: "ErXwobaYiN019PkySvjV", // Antoni — cálida, natural, perfecta para anuncios
    text: voiceOverScript,
    modelId: "eleven_multilingual_v2",
    stability: 0.40,
    similarity: 0.88,
    style: 0.45,
    speed: 0.95,
    label: "voz-off-comercial",
  });

  // ─── 4. CONCAT FINAL (6 clips + voz off, 9:16 1080x1920)
  await log("\n━━━ FASE 4: MONTAJE FINAL ━━━");
  result.finalVideo = await concatVideos({
    projectId: PROJECT_ID,
    videoVaultIds: result.videoClips,
    voiceVaultId: result.voiceOff,
    transitionPreset: "crossfade",
    crossfadeSec: 0.4,
    voiceVolume: 1.0,
  });

  // ─── 5. ANUNCIOS ESTÁTICOS (2× Flux Schnell, 1:1, listos para Meta/IG)
  await log("\n━━━ FASE 5: ANUNCIOS ESTÁTICOS ━━━");
  result.staticAds.push(await generateImage({
    projectId: PROJECT_ID,
    model: "flux-schnell",
    prompt: "Premium fashion ad poster, Japanese male model wearing Hanakaze hoodie with sumi-e flower wind print, dramatic side light, deep navy background with gold kanji 華吹 large in corner, headline space top, magazine-quality 1:1, no text overlays, leave room for headline, ultra cinematic, editorial, high contrast",
    aspectRatio: "1:1",
    label: "ad-1-male-hoodie",
  }));
  result.staticAds.push(await generateImage({
    projectId: PROJECT_ID,
    model: "flux-schnell",
    prompt: "Premium fashion ad, flat lay overhead shot of Hanakaze t-shirt folded with sumi-e cherry blossom print visible, on black washi paper background, gold ink splatter accents, single bonsai branch top corner, magazine editorial 1:1, professional product photography, no text, leave space for copy",
    aspectRatio: "1:1",
    label: "ad-2-tshirt-flatlay",
  }));

  // ─── 6. INFOGRAFÍA VERTICAL (Flux Schnell)
  await log("\n━━━ FASE 6: INFOGRAFÍA ━━━");
  result.infographic = await generateImage({
    projectId: PROJECT_ID,
    model: "flux-schnell",
    prompt: "Vertical infographic style poster, Hanakaze brand storytelling, 4 horizontal sections separated by sumi-e ink lines, each showing a stage of artisan serigraphy: 1) ink mixing 2) screen exposure 3) printing on fabric 4) final folded garment. Premium dark background, gold accents, traditional japanese aesthetic, leave space for captions, 9:16 vertical, no text overlays just the imagery sections, magazine quality",
    aspectRatio: "9:16",
    label: "infografia-proceso",
  });

  // ─── REPORT
  await log("\n━━━ RESULTADO ━━━");
  await log(JSON.stringify(result, null, 2));
  await log(`\n✓ COMPLETADO en ${((Date.now() - startedAt)/1000/60).toFixed(1)} min`);

  await fs.writeFile("logs/hanakaze-result.json", JSON.stringify(result, null, 2));
}

main().catch(async (err) => {
  await log(`✗ ERROR: ${err.message}\n${err.stack}`);
  process.exit(1);
});
