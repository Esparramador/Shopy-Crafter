/**
 * Muscle Factory — Pipeline de anuncio ~32s con TIMELINE PROMPTING
 * ─────────────────────────────────────────────────────────────────
 * POST /api/muscle-factory/generate-ad
 *
 * Técnica: 2 vídeos de 15s con prompts temporales estilo Seedance/Kling
 *   "0-3s: ... 3-7s: ... 7-11s: ... 11-15s: ..."
 * → El modelo sabe exactamente qué ocurre en cada segundo → 0 alucinaciones.
 * → Ambos clips usan I2V desde la imagen real de los botes (preserva diseño 100%).
 *
 * Pipeline:
 *  V1 (15s) I2V: Intro botes → Gladiador1 emerge → bebe → UGC testimonial
 *  V2 (15s) I2V: Gladiador2 emerge → confrontación → CTA ambos juntos
 *  Title card (2s): imagen botes + drawtext MUSCLE FACTORY + URL
 *  TTS narración mezclada sobre el concat final
 *  Total: ~32 segundos
 */

import { Router, Request, Response } from "express";
import { requireAdmin } from "../lib/auth.js";
import { logger } from "../lib/logger.js";
import { saveToVault } from "../lib/vault.js";
import { execSync } from "child_process";
import fs from "fs";
import path from "path";
import os from "os";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname  = path.dirname(__filename);

const router = Router();

// ── Config ────────────────────────────────────────────────────────────────────

const XAI_KEY    = () => process.env.XAI_API_KEY ?? process.env.GROK_API_KEY ?? "";
const ELEVEN_KEY = () => process.env.ELEVENLABS_API_KEY ?? "";

const REF_IMAGE_PATH = path.join(__dirname, "../lib/muscle-factory-ref.jpg");
const FFMPEG = process.env.FFMPEG_PATH
  || (() => { try { return execSync("which ffmpeg", { stdio: "pipe" }).toString().trim(); } catch { return "ffmpeg"; } })();

// ── Timeline prompts (2×15s, I2V) ────────────────────────────────────────────
//
// TÉCNICA: cada timestamp le dice al modelo cuándo ocurre cada acción.
// → Sin timestamps el modelo inventa transiciones → alucinaciones.
// → Con timestamps el modelo planifica la secuencia → coherencia narrativa.
//
const VIDEO_1_PROMPT = `
0-3s: Two large black Warriors ISO protein containers rest side by side on an ancient stone altar. The left container shows the 'Forest Fruits' label with a Spartan warrior illustration, fresh red strawberries and blueberries scattered around it. The right container shows 'Pineapple Coconut' with tropical pineapple slices and coconut. The camera slowly orbits both bottles in a cinematic reveal. Dramatic split lighting: dark lush forest on the left, warm tropical sunset on the right.
3-7s: The Forest Fruits bottle label begins to glow with deep red magical energy. Slowly, a powerful Spartan gladiator in dark black armor materializes and physically steps out of the glowing label into the real world. Red magical particles, fresh strawberries, blueberries and raspberries swirl around him as he emerges. He holds a vivid red protein shake cup in his gauntleted fist. Dark dramatic arena backdrop with god-rays.
7-11s: The gladiator raises the red protein shake to his lips and takes a long, slow, satisfying sip. His eyes close with pure pleasure and satisfaction. Red berries float weightlessly around him in slow motion. Warm dramatic lighting on his armor.
11-15s: The gladiator opens his eyes and looks directly into the camera with a confident, satisfied expression. He holds the red shake toward the viewer. Medium close-up, UGC testimonial style. Photorealistic skin. No face distortion. No deformation.
`.trim();

const VIDEO_2_PROMPT = `
0-4s: The Pineapple Coconut bottle label glows with warm golden tropical energy. A second powerful Spartan gladiator in dark black armor materializes and steps out from the glowing bottle label. Tropical particles — pineapple chunks and coconut pieces — float and spin around him as he emerges. He holds a bright golden-yellow protein shake cup confidently.
4-8s: The second gladiator looks directly at the camera, raises his golden shake with a proud, challenging expression. He gestures toward his shake with confidence. A warm tropical glow surrounds him. In the mid-ground, both protein bottles are visible on the stone altar.
8-12s: Both Spartan gladiators now stand side by side in the arena, facing the camera together. The left gladiator holds the red Forest Fruits shake, the right holds the golden Pineapple Coconut shake. Both raise their shakes toward the viewer simultaneously, with powerful confident expressions. Grand epic arena backdrop.
12-15s: Slow dramatic zoom toward both gladiators as they hold their shakes raised high. Epic final tableau. Grand arena backdrop with dramatic lens flare and volumetric lighting. Bold, cinematic commercial climax. Real photorealistic faces. No distortion.
`.trim();

// ── Helpers ────────────────────────────────────────────────────────────────────

function send(res: Response, event: string, data: unknown) {
  res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
}

async function pollXai(requestId: string, timeoutMs = 8 * 60_000): Promise<string> {
  const key = XAI_KEY();
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    await new Promise(r => setTimeout(r, 8_000));
    const r = await fetch(`https://api.x.ai/v1/videos/${requestId}`, {
      headers: { Authorization: `Bearer ${key}` },
    });
    if (!r.ok) continue;
    const d = await r.json() as { status: string; video?: { url: string } };
    if (d.status === "done"    && d.video?.url) return d.video.url;
    if (d.status === "expired") throw new Error("xAI request expirado");
    if (d.status === "failed")  throw new Error("xAI video generation falló");
  }
  throw new Error("xAI timeout (>8 min)");
}

async function genXaiI2V(prompt: string, imageDataUri: string, durationSec: number): Promise<string> {
  const key = XAI_KEY();
  if (!key) throw new Error("XAI_API_KEY no configurada");

  const body = {
    model: "grok-imagine-video",
    prompt,
    duration: Math.min(Math.max(durationSec, 5), 15),
    aspect_ratio: "9:16",
    resolution: "720p",
    image: { url: imageDataUri },
  };

  const r = await fetch("https://api.x.ai/v1/videos/generations", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!r.ok) {
    const err = await r.text();
    throw new Error(`xAI create failed: ${r.status} — ${err.slice(0, 300)}`);
  }
  const { request_id } = await r.json() as { request_id: string };
  return pollXai(request_id);
}

async function genTTS(script: string): Promise<Buffer> {
  const key = ELEVEN_KEY();
  if (!key) throw new Error("ELEVENLABS_API_KEY no configurada");
  const r = await fetch("https://api.elevenlabs.io/v1/text-to-speech/8m4O8qoFLrKBzbmsuL5T", {
    method: "POST",
    headers: { "xi-api-key": key, "Content-Type": "application/json" },
    body: JSON.stringify({
      text: script,
      model_id: "eleven_turbo_v2_5",
      voice_settings: {
        stability: 0.18, similarity_boost: 0.92, style: 0.65,
        use_speaker_boost: true, speed: 0.97,
      },
    }),
  });
  if (!r.ok) throw new Error(`ElevenLabs TTS falló: ${r.status}`);
  return Buffer.from(await r.arrayBuffer());
}

async function downloadBuf(url: string): Promise<Buffer> {
  const r = await fetch(url);
  if (!r.ok) throw new Error(`Download failed (${r.status}): ${url}`);
  return Buffer.from(await r.arrayBuffer());
}

function normalizeClip(src: string, dest: string) {
  execSync(
    `"${FFMPEG}" -y -i "${src}" ` +
    `-vf "scale=720:1280:force_original_aspect_ratio=increase,crop=720:1280" ` +
    `-r 25 -c:v libx264 -preset fast -crf 20 -an -movflags +faststart "${dest}"`,
    { timeout: 90_000, stdio: "pipe" }
  );
}

// ── GET /api/muscle-factory/reference-image ───────────────────────────────────
router.get("/muscle-factory/reference-image", (_req, res: Response) => {
  if (!fs.existsSync(REF_IMAGE_PATH)) return res.status(404).json({ error: "Imagen no encontrada" });
  res.setHeader("Content-Type", "image/jpeg");
  res.setHeader("Cache-Control", "public, max-age=86400");
  res.send(fs.readFileSync(REF_IMAGE_PATH));
});

// ── POST /api/muscle-factory/generate-ad ─────────────────────────────────────
router.post("/muscle-factory/generate-ad", requireAdmin, async (req: Request, res: Response) => {
  const projectId = Number((req.session as any)?.projectId ?? req.body?.projectId ?? 0);

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.flushHeaders();

  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "muscfact-"));

  try {
    // ── 1. Cargar imagen de referencia ────────────────────────────────────────
    send(res, "progress", { step: 0, total: 8, message: "📸 Cargando imagen de referencia (botes Warriors ISO)..." });
    if (!fs.existsSync(REF_IMAGE_PATH)) throw new Error("Imagen de referencia no encontrada en el servidor");
    const refBuf = fs.readFileSync(REF_IMAGE_PATH);
    const refDataUri = `data:image/jpeg;base64,${refBuf.toString("base64")}`;
    send(res, "progress", { step: 0, total: 8, message: `✅ Imagen cargada (${Math.round(refBuf.length / 1024)} KB) → iniciando generación dual en paralelo...` });

    // ── 2. Generar los 2 vídeos de 15s EN PARALELO con timeline prompts ───────
    send(res, "progress", {
      step: 1, total: 8,
      message: "🎬 Lanzando 2 vídeos de 15s con TIMELINE PROMPTING (I2V Grok)...\n" +
               "  V1: Intro botes → Gladiador Forest Fruits emerge → bebe → UGC\n" +
               "  V2: Gladiador Pineapple Coconut emerge → confrontación → CTA\n" +
               "  ⏳ Tiempo estimado: ~6-8 min en paralelo",
    });

    const [url1, url2] = await Promise.all([
      genXaiI2V(VIDEO_1_PROMPT, refDataUri, 15)
        .then(u => { send(res, "progress", { step: 1, total: 8, message: "✅ V1 listo (15s) — Intro + Gladiador Forest Fruits" }); return u; })
        .catch(e => { send(res, "progress", { step: 1, total: 8, message: `⚠️ V1 falló: ${e.message}` }); return null as null; }),
      genXaiI2V(VIDEO_2_PROMPT, refDataUri, 15)
        .then(u => { send(res, "progress", { step: 1, total: 8, message: "✅ V2 listo (15s) — Gladiador Pineapple Coconut + CTA" }); return u; })
        .catch(e => { send(res, "progress", { step: 1, total: 8, message: `⚠️ V2 falló: ${e.message}` }); return null as null; }),
    ]);

    if (!url1 && !url2) throw new Error("Ambos vídeos fallaron — verifica créditos xAI y reintenta");
    const videoUrls = [url1, url2].filter(Boolean) as string[];
    send(res, "progress", { step: 1, total: 8, message: `✅ ${videoUrls.length}/2 vídeos generados con timeline prompting` });

    // ── 3. Descargar vídeos ───────────────────────────────────────────────────
    send(res, "progress", { step: 2, total: 8, message: "📥 Descargando vídeos desde xAI..." });
    const rawPaths: string[] = await Promise.all(
      videoUrls.map(async (url, i) => {
        const buf = await downloadBuf(url);
        const p   = path.join(tmpDir, `raw_${i + 1}.mp4`);
        fs.writeFileSync(p, buf);
        send(res, "progress", { step: 2, total: 8, message: `📥 V${i + 1} descargado (${Math.round(buf.length / 1024 / 1024 * 10) / 10} MB)` });
        return p;
      })
    );

    // ── 4. Title card final (2s) con imagen real + texto ─────────────────────
    send(res, "progress", { step: 3, total: 8, message: "🖼️ Generando title card final: MUSCLE FACTORY + musclefactorybcn.com..." });
    const titleCardPath = path.join(tmpDir, "title_card.mp4");
    const font = "fontfile=/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf:";
    const escText = (t: string) => t.replace(/'/g, "\\'").replace(/:/g, "\\:");
    try {
      execSync(
        `"${FFMPEG}" -y -loop 1 -framerate 25 -i "${REF_IMAGE_PATH}" ` +
        `-vf "scale=720:1280:force_original_aspect_ratio=increase,crop=720:1280,` +
        `drawtext=${font}text='${escText("MUSCLE FACTORY")}':fontcolor=white:fontsize=72:x=(w-text_w)/2:y=h*0.77:box=1:boxcolor=black@0.65:boxborderw=14,` +
        `drawtext=${font}text='${escText("musclefactorybcn.com")}':fontcolor=#f0c040:fontsize=36:x=(w-text_w)/2:y=h*0.87:box=1:boxcolor=black@0.5:boxborderw=8" ` +
        `-t 2 -c:v libx264 -preset fast -crf 18 -an -movflags +faststart "${titleCardPath}"`,
        { timeout: 30_000, stdio: "pipe" }
      );
    } catch {
      execSync(
        `"${FFMPEG}" -y -loop 1 -framerate 25 -i "${REF_IMAGE_PATH}" ` +
        `-vf "scale=720:1280:force_original_aspect_ratio=increase,crop=720:1280" ` +
        `-t 2 -c:v libx264 -preset fast -crf 18 -an -movflags +faststart "${titleCardPath}"`,
        { timeout: 30_000, stdio: "pipe" }
      );
    }
    send(res, "progress", { step: 3, total: 8, message: "✅ Title card generado (2s)" });

    // ── 5. Normalizar clips ───────────────────────────────────────────────────
    send(res, "progress", { step: 4, total: 8, message: "🔧 Normalizando clips (720×1280, 25fps, H.264)..." });
    const normPaths: string[] = [];
    for (let i = 0; i < rawPaths.length; i++) {
      const np = path.join(tmpDir, `norm_${i + 1}.mp4`);
      normalizeClip(rawPaths[i], np);
      normPaths.push(np);
      send(res, "progress", { step: 4, total: 8, message: `  ✅ V${i + 1} normalizado` });
    }
    // También normalizar el title card al mismo formato
    const normTitle = path.join(tmpDir, "norm_title.mp4");
    normalizeClip(titleCardPath, normTitle);
    normPaths.push(normTitle);

    // ── 6. Concatenar ─────────────────────────────────────────────────────────
    send(res, "progress", { step: 5, total: 8, message: `🎞️ Concatenando ${normPaths.length} segmentos (~${normPaths.length === 3 ? 32 : 17}s total)...` });
    const listPath   = path.join(tmpDir, "concat.txt");
    const concatPath = path.join(tmpDir, "concat_raw.mp4");
    fs.writeFileSync(listPath, normPaths.map(p => `file '${p}'`).join("\n"));
    execSync(
      `"${FFMPEG}" -y -f concat -safe 0 -i "${listPath}" -c copy "${concatPath}"`,
      { timeout: 120_000, stdio: "pipe" }
    );

    // ── 7. TTS narración + mezclar ────────────────────────────────────────────
    send(res, "progress", { step: 6, total: 8, message: "🎙️ Generando narración TTS (ElevenLabs)..." });
    const TTS_SCRIPT =
      "La batalla por el mejor sabor acaba de comenzar. " +
      "Del bote Forest Fruits... el guerrero emerge. " +
      "Sabor de frutos del bosque, refrescante, frutal... irresistible. " +
      "Y del bote Piña Coco... el campeón tropical hace su entrada. " +
      "Exótico, veraniego, el sabor más refrescante del verano. " +
      "¿Y tú con cuál te quedas? " +
      "¡Disfrútalos ya! " +
      "Muscle Factory. musclefactorybcn.com";

    const finalPath = path.join(tmpDir, "muscle_factory_ad_final.mp4");
    try {
      const ttsBuf  = await genTTS(TTS_SCRIPT);
      const audPath = path.join(tmpDir, "narration.mp3");
      fs.writeFileSync(audPath, ttsBuf);
      send(res, "progress", { step: 6, total: 8, message: "✅ TTS lista — mezclando audio con vídeo..." });
      execSync(
        `"${FFMPEG}" -y -i "${concatPath}" -i "${audPath}" ` +
        `-map 0:v:0 -map 1:a:0 ` +
        `-c:v copy -c:a aac -b:a 192k ` +
        `-shortest -movflags +faststart "${finalPath}"`,
        { timeout: 120_000, stdio: "pipe" }
      );
    } catch (ttsErr) {
      send(res, "progress", { step: 6, total: 8, message: `⚠️ TTS falló (${(ttsErr as Error).message}) — guardando vídeo sin narración` });
      fs.copyFileSync(concatPath, finalPath);
    }

    // ── 8. Guardar en Vault ───────────────────────────────────────────────────
    send(res, "progress", { step: 7, total: 8, message: "💾 Guardando en Vault..." });
    const finalBuf = fs.readFileSync(finalPath);
    const sizeMB   = Math.round(finalBuf.length / 1024 / 1024 * 10) / 10;

    let vaultId: number | null = null;
    let vaultUrl: string | null = null;
    if (projectId) {
      vaultId  = await saveToVault({
        projectId,
        fileType: "video",
        category: "ads",
        title: "Muscle Factory — Warriors ISO 30s (Timeline 2×15s)",
        mimeType: "video/mp4",
        content: finalBuf.toString("base64"),
      });
      vaultUrl = `/api/vault/${vaultId}/download`;
    }

    const clipCount = normPaths.length;
    send(res, "done", {
      success: true,
      vaultId,
      vaultUrl,
      clips: clipCount,
      sizeMB,
      technique: "2×15s timeline I2V prompting",
      message:
        `🏆 **Anuncio Muscle Factory ~${(clipCount - 1) * 15 + 2}s** listo con Timeline Prompting!\n\n` +
        `✅ Técnica: **2 vídeos de 15s con timestamps** (0-3s / 3-7s / 7-11s / 11-15s)\n` +
        `🎥 Motor: **Grok xAI grok-imagine-video** — I2V desde imagen real de botes\n` +
        `🎙️ Narración TTS mezclada\n` +
        `📐 Formato: 720p · 9:16 · ~${(clipCount - 1) * 15 + 2}s\n` +
        `📦 Tamaño: ${sizeMB} MB\n` +
        (vaultUrl
          ? `\n💾 Vault #${vaultId}\n📥 [Descargar vídeo](${vaultUrl})\n[VIDEO:Muscle Factory Warriors ISO](${vaultUrl})`
          : ""),
    });

    logger.info({ vaultId, clips: clipCount, sizeMB, technique: "2x15s-timeline-i2v" }, "muscle-factory: ad generated");

  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    logger.error({ err: msg }, "muscle-factory: pipeline error");
    send(res, "error", { message: `❌ Error en el pipeline: ${msg}` });
  } finally {
    try { fs.rmSync(tmpDir, { recursive: true, force: true }); } catch { /* ignore */ }
    res.end();
  }
});

export default router;
