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
  if (opts.json !== undefined) {
    headers["Content-Type"] = "application/json";
    opts.body = JSON.stringify(opts.json);
    delete opts.json;
  }
  const res = await fetch(url, { ...opts, headers });
  const setCookie = res.headers.get("set-cookie");
  if (setCookie) {
    cookieJar = setCookie.split(";")[0];
  }
  return res;
}

async function jsonOrThrow(res, label) {
  const text = await res.text();
  if (!res.ok) {
    throw new Error(`[${label}] HTTP ${res.status}: ${text.slice(0, 600)}`);
  }
  try { return JSON.parse(text); } catch { throw new Error(`[${label}] Invalid JSON: ${text.slice(0, 200)}`); }
}

async function login() {
  await log("Login admin…");
  const res = await api("/api/auth/login", { method: "POST", json: { email: EMAIL, password: PASSWORD } });
  const data = await jsonOrThrow(res, "login");
  await log(`Login OK ${JSON.stringify(data).slice(0, 120)}`);
}

// ─── RUNWAY: IMAGE-WITH-REFERENCE (gen4_image_turbo, $0.02). Runway requiere ≥1 referenceImage.
async function runwayImage({ projectId, prompt, ratio = "1080:1080", model = "gen4_image_turbo", referenceLocalPath, referenceUrl, referenceTag, label }) {
  await log(`▶ runway-image[${label}] ratio=${ratio} model=${model} ref=${referenceLocalPath ? path.basename(referenceLocalPath) : referenceUrl?.slice(0,40)}`);
  const t0 = Date.now();
  const form = new FormData();
  form.append("projectId", String(projectId));
  form.append("prompt", prompt);
  form.append("ratio", ratio);
  form.append("model", model);
  if (referenceTag) form.append("referenceTag", referenceTag);
  if (referenceLocalPath) {
    const buf = await fs.readFile(referenceLocalPath);
    const ext = path.extname(referenceLocalPath).toLowerCase();
    const mime = ext === ".png" ? "image/png" : "image/jpeg";
    form.append("referenceImage", new Blob([buf], { type: mime }), path.basename(referenceLocalPath));
  } else if (referenceUrl) {
    form.append("referenceImageUrl", referenceUrl);
  } else {
    throw new Error(`runway-image[${label}] necesita referenceLocalPath o referenceUrl`);
  }
  const headers = {};
  if (cookieJar) headers["Cookie"] = cookieJar;
  const res = await fetch(`${BASE}/api/fs-pro/runway-image`, { method: "POST", body: form, headers });
  const data = await jsonOrThrow(res, `runway-image:${label}`);
  await log(`✔ runway-image[${label}] vaultId=${data.vaultId} cost=$${data.cost} (${((Date.now() - t0)/1000).toFixed(1)}s)`);
  return { vaultId: data.vaultId, runwayUrl: data.runwayImageUrl };
}

// ─── RUNWAY: IMAGE-TO-VIDEO (gen4_turbo, $0.05/s)
//   imageSource: { runwayUrl?: string } | { localPath: string }
async function runwayVideo({ projectId, prompt, duration = 10, aspect = "9:16", imageSource, label }) {
  await log(`▶ runway-video[${label}] dur=${duration}s aspect=${aspect}`);
  const t0 = Date.now();
  const form = new FormData();
  form.append("projectId", String(projectId));
  form.append("model", "runway-gen4-turbo");
  form.append("prompt", prompt);
  form.append("duration", String(duration));
  form.append("aspect", aspect);
  if (imageSource.localPath) {
    const buf = await fs.readFile(imageSource.localPath);
    const ext = path.extname(imageSource.localPath).toLowerCase();
    const mime = ext === ".png" ? "image/png" : "image/jpeg";
    form.append("image", new Blob([buf], { type: mime }), path.basename(imageSource.localPath));
  } else if (imageSource.runwayUrl) {
    form.append("sourceImageUrl", imageSource.runwayUrl);
  } else {
    throw new Error(`runway-video[${label}] necesita localPath o runwayUrl`);
  }
  const headers = {};
  if (cookieJar) headers["Cookie"] = cookieJar;
  const res = await fetch(`${BASE}/api/fs-pro/generate-video`, { method: "POST", body: form, headers });
  const data = await jsonOrThrow(res, `runway-video:${label}`);
  await log(`✔ runway-video[${label}] vaultId=${data.vaultId} size=${(data.sizeBytes/1024/1024).toFixed(2)}MB (${((Date.now() - t0)/1000).toFixed(1)}s)`);
  return data.vaultId;
}

// ─── ELEVENLABS TTS
async function tts({ projectId, voiceId, text, modelId = "eleven_multilingual_v2", stability = 0.40, similarity = 0.88, style = 0.45, speed = 1.0, label }) {
  await log(`▶ tts[${label}] chars=${text.length}`);
  const t0 = Date.now();
  const res = await api("/api/fs-pro/tts", {
    method: "POST",
    json: { projectId, voiceId, text, modelId, stability, similarity, style, speed },
  });
  const data = await jsonOrThrow(res, `tts:${label}`);
  await log(`✔ tts[${label}] vaultId=${data.vaultId} (${((Date.now() - t0)/1000).toFixed(1)}s)`);
  return data.vaultId;
}

// ─── FFMPEG CONCAT (server-side)
async function concatFinal({ projectId, videoVaultIds, voiceVaultId }) {
  await log(`▶ concat ${videoVaultIds.length} clips + voz off…`);
  const t0 = Date.now();
  const res = await api("/api/fs-pro/concat", {
    method: "POST",
    json: {
      projectId, videoVaultIds, voiceVaultId,
      transitionPreset: "crossfade",
      crossfadeSec: 0.4,
      voiceVolume: 1.0,
      width: 1080, height: 1920, fps: 30,
    },
  });
  const data = await jsonOrThrow(res, "concat");
  await log(`✔ concat vaultId=${data.vaultId} size=${(data.sizeBytes/1024/1024).toFixed(2)}MB (${((Date.now() - t0)/1000).toFixed(1)}s)`);
  return data.vaultId;
}

async function main() {
  await fs.writeFile(LOG_FILE, "");
  await log("=== CAMPAÑA HANAKAZE SERIGRAPHY (RUNWAY DIRECT) — INICIO ===");

  const PROJECT_ID = parseInt(process.env.HANAKAZE_PROJECT_ID || "0", 10);
  if (!PROJECT_ID) throw new Error("HANAKAZE_PROJECT_ID env requerido");
  await log(`projectId=${PROJECT_ID}`);

  await login();

  const ASSETS = "attached_assets";
  const PHOTO_BURRO  = `${ASSETS}/PXL_20260410_171731994.RAW-01_1777547033722.jpg`;
  const PHOTO_MODEL_1 = `${ASSETS}/IMG-20260414-WA0010_1777547033700.jpg`;
  const PHOTO_MODEL_2 = `${ASSETS}/IMG-20260414-WA0011_1777547033708.jpg`;
  const PHOTO_MODEL_3 = `${ASSETS}/IMG-20260414-WA0012_1777547033709.jpg`;

  const result = {
    backplates: [], imagesIntro: null, imagesOutro: null,
    videoClips: [], voiceOff: null, finalVideo: null,
    staticAds: [], infographic: null, timings: {},
  };

  // ─── FASE 1 — IMÁGENES BASE (Runway gen4_image_turbo, 1080:1920 vertical)
  await log("\n━━━ FASE 1: IMÁGENES BASE PARA VÍDEO ━━━");

  // Frame intro (kanji 華吹) — usa foto del burro como referencia de marca
  const intro = await runwayImage({
    projectId: PROJECT_ID,
    prompt: "Cinematic vertical shot, traditional Japanese washi paper background with subtle texture. A single black sumi-e ink kanji 華吹 (Hanakaze) painted with calligraphic brush strokes in the center, golden leaf flecks scattered around. Dramatic side lighting, deep shadows, premium luxury fashion brand opening frame, no text overlays, no watermarks, magazine-quality 4k. Inspired by the @brand mood.",
    ratio: "1080:1920",
    referenceLocalPath: PHOTO_BURRO,
    referenceTag: "brand",
    label: "intro-kanji-frame",
  });
  result.imagesIntro = intro.vaultId;

  // Frame outro (logo)
  const outro = await runwayImage({
    projectId: PROJECT_ID,
    prompt: "Vertical 9:16 frame, pure deep matte black background. Center: elegant golden brushstroke calligraphy logotype reading 'HANAKAZE SERIGRAPHY' in modern minimal serif fused with japanese sumi-e style. Below in smaller letters: 'Worn art from Tokyo'. Subtle gold particle shimmer. Premium luxury fashion brand outro card. Inspired by the @brand aesthetic.",
    ratio: "1080:1920",
    referenceLocalPath: PHOTO_BURRO,
    referenceTag: "brand",
    label: "outro-logo-frame",
  });
  result.imagesOutro = outro.vaultId;

  // ─── FASE 2 — VÍDEO 6 CLIPS (Runway gen4-turbo, image-to-video, 10s)
  await log("\n━━━ FASE 2: VÍDEO 6 CLIPS (image-to-video Runway) ━━━");

  // Clip 1 — INTRO animado desde frame
  result.videoClips.push(await runwayVideo({
    projectId: PROJECT_ID,
    prompt: "The kanji slowly forms with sumi-e ink dripping and spreading across the washi paper, gold leaf particles drift gently in the air, soft side light reveals texture, premium fashion brand intro animation, no camera movement, 9:16 vertical.",
    duration: 10, aspect: "9:16",
    imageSource: { runwayUrl: intro.runwayUrl },
    label: "intro",
  }));

  // Clip 2 — Burro de ropa real (foto del usuario)
  result.videoClips.push(await runwayVideo({
    projectId: PROJECT_ID,
    prompt: "Camera slowly orbits around the clothing rack displaying premium Hanakaze hoodies, soft warm light leak crosses the frame, dust particles float, cinematic shallow depth of field, premium streetwear b-roll, 9:16 vertical, no text.",
    duration: 10, aspect: "9:16",
    imageSource: { localPath: PHOTO_BURRO },
    label: "burro-ropa",
  }));

  // Clip 3 — Modelo 1
  result.videoClips.push(await runwayVideo({
    projectId: PROJECT_ID,
    prompt: "The model slowly turns 90 degrees showing the back of the Hanakaze hoodie, cinematic motion blur, soft side light, fashion editorial campaign, 9:16, no text.",
    duration: 10, aspect: "9:16",
    imageSource: { localPath: PHOTO_MODEL_1 },
    label: "model-1",
  }));

  // Clip 4 — Modelo 2
  result.videoClips.push(await runwayVideo({
    projectId: PROJECT_ID,
    prompt: "The model takes one slow cinematic step toward camera, fabric of the hoodie moves naturally, light rain particles in foreground, neon Tokyo street reflection, teal-orange grade, 9:16, no text.",
    duration: 10, aspect: "9:16",
    imageSource: { localPath: PHOTO_MODEL_2 },
    label: "model-2",
  }));

  // Clip 5 — Modelo 3
  result.videoClips.push(await runwayVideo({
    projectId: PROJECT_ID,
    prompt: "The model holds a poised samurai stance, soft cherry blossom petals drift and swirl around them, slow motion, premium fashion film aesthetic, anamorphic look, 9:16, no text.",
    duration: 10, aspect: "9:16",
    imageSource: { localPath: PHOTO_MODEL_3 },
    label: "model-3",
  }));

  // Clip 6 — OUTRO logo animado
  result.videoClips.push(await runwayVideo({
    projectId: PROJECT_ID,
    prompt: "Golden sumi-e ink calligraphy strokes elegantly draw the brand logotype HANAKAZE SERIGRAPHY from left to right, subtle gold particle shimmer follows each stroke, premium luxury outro animation, slow reveal, 9:16 vertical.",
    duration: 10, aspect: "9:16",
    imageSource: { runwayUrl: outro.runwayUrl },
    label: "outro",
  }));

  // ─── FASE 3 — VOZ OFF (ElevenLabs Antoni multilingual v2)
  await log("\n━━━ FASE 3: VOZ OFF ━━━");
  const script =
    "Hanakaze. En japonés, viento de flores. " +
    "Cada prenda nace de un trazo de tinta, " +
    "de una pieza serigrafiada a mano en nuestro taller. " +
    "No fabricamos en serie. Tiramos ediciones limitadas. " +
    "Algodón premium, tinta al agua, alma japonesa. " +
    "Hanakaze Serigraphy. Arte vestible desde Tokio.";

  result.voiceOff = await tts({
    projectId: PROJECT_ID,
    voiceId: "ErXwobaYiN019PkySvjV", // Antoni — cálida natural masculina
    text: script,
    stability: 0.40, similarity: 0.88, style: 0.45, speed: 0.95,
    label: "voz-off",
  });

  // ─── FASE 4 — CONCAT FINAL
  await log("\n━━━ FASE 4: MONTAJE FINAL ━━━");
  result.finalVideo = await concatFinal({
    projectId: PROJECT_ID,
    videoVaultIds: result.videoClips,
    voiceVaultId: result.voiceOff,
  });

  // ─── FASE 5 — 2 ANUNCIOS ESTÁTICOS (Runway gen4_image_turbo, 1080:1080)
  await log("\n━━━ FASE 5: ANUNCIOS ESTÁTICOS ━━━");
  const ad1 = await runwayImage({
    projectId: PROJECT_ID,
    prompt: "Premium fashion editorial poster 1:1, Japanese male model wearing a Hanakaze hoodie with sumi-e flower wind print. Dramatic side lighting, deep navy background. Large translucent gold kanji 華吹 in upper-right corner. Clean negative space top-left for headline copy. Magazine quality, ultra cinematic, high contrast, no text overlays, leave room for headline. Inspired by the @model styling.",
    ratio: "1080:1080",
    referenceLocalPath: PHOTO_MODEL_1,
    referenceTag: "model",
    label: "ad1-male-hoodie",
  });
  result.staticAds.push(ad1.vaultId);

  const ad2 = await runwayImage({
    projectId: PROJECT_ID,
    prompt: "Premium fashion product poster 1:1, flat-lay overhead shot of a folded Hanakaze t-shirt on black washi paper, sumi-e cherry blossom print partially visible on fabric, subtle gold ink splatter accents, single bonsai branch in top-right corner. Magazine editorial composition, professional product photography, no text, clean space at bottom for copy. Inspired by the @brand product line.",
    ratio: "1080:1080",
    referenceLocalPath: PHOTO_BURRO,
    referenceTag: "brand",
    label: "ad2-tshirt-flatlay",
  });
  result.staticAds.push(ad2.vaultId);

  // ─── FASE 6 — INFOGRAFÍA VERTICAL (Runway, 1080:1920)
  await log("\n━━━ FASE 6: INFOGRAFÍA ━━━");
  const info = await runwayImage({
    projectId: PROJECT_ID,
    prompt: "Vertical 9:16 brand storytelling poster, dark premium background. 4 horizontal stacked sections separated by golden sumi-e ink lines, each showing one stage of artisan serigraphy: 1) ink mixing in a ceramic bowl 2) silk screen exposure 3) hand-printing on dark fabric 4) the final folded garment with brand label. Traditional Japanese aesthetic with gold accents, magazine quality. Numbers 1-4 visible as gold kanji, but no other text overlays. Inspired by the @brand product range.",
    ratio: "1080:1920",
    referenceLocalPath: PHOTO_BURRO,
    referenceTag: "brand",
    label: "infografia-proceso",
  });
  result.infographic = info.vaultId;

  // ─── REPORT FINAL
  await log("\n━━━ RESULTADO ━━━");
  await log(JSON.stringify(result, null, 2));
  await log(`\n✓ COMPLETADO en ${((Date.now() - startedAt)/1000/60).toFixed(1)} min`);

  await fs.writeFile("logs/hanakaze-result.json", JSON.stringify(result, null, 2));
}

main().catch(async (err) => {
  await log(`✗ ERROR: ${err.message}\n${err.stack}`);
  process.exit(1);
});
