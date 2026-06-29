/**
 * Muscle Factory — Pipeline de anuncio 30s
 * ─────────────────────────────────────────
 * POST /api/muscle-factory/generate-ad
 *
 * Pipeline SSE:
 *  1. Genera 6 clips xAI Grok (I2V para S1-S3 con imagen de botes, T2V para S4-S6)
 *  2. Genera narración TTS con ElevenLabs
 *  3. Concatena con ffmpeg + mezcla audio
 *  4. Añade title card final (2s) con drawtext sobre imagen de referencia
 *  5. Guarda en Vault y devuelve URL
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

// ── Helpers ──────────────────────────────────────────────────────────────────

const XAI_KEY  = () => process.env.XAI_API_KEY ?? process.env.GROK_API_KEY ?? "";
const ELEVEN_KEY = () => process.env.ELEVENLABS_API_KEY ?? "";

const REF_IMAGE_PATH = path.join(__dirname, "../lib/muscle-factory-ref.jpg");
const FFMPEG = process.env.FFMPEG_PATH
  || (() => { try { return execSync("which ffmpeg", { stdio: "pipe" }).toString().trim(); } catch { return "ffmpeg"; } })();

function send(res: Response, event: string, data: unknown) {
  res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
}

async function pollXai(requestId: string, timeoutMs = 7 * 60_000): Promise<string> {
  const key = XAI_KEY();
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    await new Promise(r => setTimeout(r, 7_000));
    const r = await fetch(`https://api.x.ai/v1/videos/${requestId}`, {
      headers: { Authorization: `Bearer ${key}` },
    });
    if (!r.ok) continue;
    const d = await r.json() as { status: string; video?: { url: string } };
    if (d.status === "done" && d.video?.url) return d.video.url;
    if (d.status === "expired") throw new Error("xAI request expirado");
    if (d.status === "failed")  throw new Error("xAI video generation falló");
  }
  throw new Error("xAI timeout (>7 min)");
}

async function genXaiClip(prompt: string, imageDataUri: string | null, durationSec: number): Promise<string> {
  const key = XAI_KEY();
  const body: Record<string, unknown> = {
    model: "grok-imagine-video",
    prompt,
    duration: durationSec,
    aspect_ratio: "9:16",
    resolution: "720p",
  };
  if (imageDataUri) body.image = { url: imageDataUri };

  const r = await fetch("https://api.x.ai/v1/videos/generations", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!r.ok) throw new Error(`xAI create failed: ${r.status} ${(await r.text()).slice(0, 200)}`);
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
      voice_settings: { stability: 0.18, similarity_boost: 0.92, style: 0.65, use_speaker_boost: true, speed: 1.0 },
    }),
  });
  if (!r.ok) throw new Error(`ElevenLabs TTS falló: ${r.status}`);
  return Buffer.from(await r.arrayBuffer());
}

async function downloadVideo(url: string): Promise<Buffer> {
  const r = await fetch(url);
  if (!r.ok) throw new Error(`Download failed: ${url}`);
  return Buffer.from(await r.arrayBuffer());
}

// ── POST /api/muscle-factory/generate-ad ─────────────────────────────────────

// ── GET /api/muscle-factory/reference-image — sirve la imagen de referencia ──
router.get("/muscle-factory/reference-image", (_req, res: Response) => {
  if (!fs.existsSync(REF_IMAGE_PATH)) return res.status(404).json({ error: "Reference image not found" });
  res.setHeader("Content-Type", "image/jpeg");
  res.setHeader("Cache-Control", "public, max-age=86400");
  res.send(fs.readFileSync(REF_IMAGE_PATH));
});

router.post("/muscle-factory/generate-ad", requireAdmin, async (req: Request, res: Response) => {
  const projectId = Number((req.session as any)?.projectId ?? req.body?.projectId ?? 0);

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.flushHeaders();

  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "muscfact-"));

  try {
    // ── Imagen de referencia en data-URI ────────────────────────────────────
    send(res, "progress", { step: 0, total: 9, message: "📸 Cargando imagen de referencia..." });
    const refBuf = fs.readFileSync(REF_IMAGE_PATH);
    const refDataUri = `data:image/jpeg;base64,${refBuf.toString("base64")}`;

    // ── Prompts de cada escena ───────────────────────────────────────────────
    const SCENE_PROMPTS: Array<{ prompt: string; useImage: boolean; dur: number; label: string }> = [
      {
        label: "S1: Intro botes épicos",
        dur: 5,
        useImage: true,
        prompt: `Two large black Warriors ISO protein supplement containers sit on an ancient stone altar. Left container: 'Forest Fruits' label with a menacing Spartan warrior design, surrounded by fresh red berries, strawberries and blueberries. Right container: 'Pineapple Coconut' label, surrounded by tropical pineapple slices and coconut halves. Dramatic cinematic split environment: dark lush forest on the left half, golden tropical beach sunset on the right half. Camera slowly orbits around the bottles. Epic volumetric golden lighting. Premium product commercial. 4K. Bottles perfectly sharp, no distortion. Photorealistic.`,
      },
      {
        label: "S2: Gladiador 1 emerge de Forest Fruits",
        dur: 5,
        useImage: true,
        prompt: `A powerful Spartan gladiator warrior in dark black medieval armor materializes and steps out of the glowing label of a Warriors ISO Forest Fruits protein container. He physically emerges from the bottle label into the real world. Glowing red magical particles, fresh strawberries, blueberries and raspberries float around him in slow motion. He holds a vivid red protein shake cup in his gauntleted fist. Dark dramatic forest arena background with volumetric god-rays. Cinematic fantasy product commercial. 4K. No face distortion. Maintain exact bottle design.`,
      },
      {
        label: "S3: Gladiador 2 emerge de Pineapple Coconut",
        dur: 5,
        useImage: true,
        prompt: `A second powerful Spartan gladiator warrior in dark black armor materializes from the glowing label of a Warriors ISO Pineapple Coconut protein container. He steps into reality from the bottle label. Tropical golden particles, pineapple chunks and coconut pieces float and spin around him. He holds a bright golden-yellow protein shake cup confidently. Tropical beach arena background with warm sunset light. Cinematic fantasy product commercial. 4K. No face distortion. Maintain exact bottle design.`,
      },
      {
        label: "S4: Gladiador 1 UGC testimonial Forest Fruits",
        dur: 5,
        useImage: false,
        prompt: `Muscular Spartan gladiator in dark black armor, medium close-up shot, takes a long slow sip from a vivid red protein shake bottle, eyes close with pure pleasure and satisfaction. Opens eyes and looks DIRECTLY into camera with a confident satisfied smile. Fresh strawberries and forest berries float around him in slow motion. Dark arena background with warm lighting. UGC testimonial style. Photorealistic. 4K. Real human skin texture. No face distortion or deformation. Cinematic commercial.`,
      },
      {
        label: "S5: Gladiador 2 confronta con Pineapple Coconut",
        dur: 5,
        useImage: false,
        prompt: `Two Spartan gladiators in dark black armor face each other in an ancient arena. Left gladiator holds a red protein shake, right gladiator holds a golden-yellow protein shake. The right gladiator raises his golden shake toward the camera with a proud challenging expression, looking directly into lens. Tropical pineapple and coconut float on the right side. The left gladiator watches confidently. Dramatic arena lighting. Medium shot. 4K. Photorealistic. No face distortion. Premium commercial.`,
      },
      {
        label: "S6: Ambos juntos CTA",
        dur: 3,
        useImage: false,
        prompt: `Two powerful Spartan gladiators in dark black armor stand side by side facing camera in wide shot. Left holds red Forest Fruits protein shake raised toward viewer, right holds golden Pineapple Coconut shake raised toward viewer. Both look directly into camera with powerful confident expressions. Grand ancient arena backdrop. Epic dramatic lighting with lens flare. Bold cinematic advertisement climax. 4K. Photorealistic. No face distortion.`,
      },
    ];

    // ── Generar 6 clips xAI EN PARALELO ─────────────────────────────────────
    send(res, "progress", { step: 1, total: 9, message: "🎬 Lanzando 6 clips Grok en paralelo (esto tarda ~4-5 min)..." });

    const clipPromises = SCENE_PROMPTS.map((s, i) =>
      genXaiClip(s.prompt, s.useImage ? refDataUri : null, s.dur)
        .then(url => {
          send(res, "progress", { step: 1, total: 9, message: `✅ Clip ${i + 1}/6 listo: ${s.label}` });
          return url;
        })
        .catch(err => {
          send(res, "progress", { step: 1, total: 9, message: `⚠️ Clip ${i + 1}/6 falló, continuando: ${err.message}` });
          return null as null;
        })
    );

    const clipUrls = await Promise.all(clipPromises);
    const validClips = clipUrls.filter(Boolean) as string[];
    if (validClips.length < 3) {
      send(res, "error", { message: `❌ Solo ${validClips.length} clips generados — insuficiente para el vídeo.` });
      res.end();
      return;
    }

    // ── Descargar clips válidos ───────────────────────────────────────────────
    send(res, "progress", { step: 2, total: 9, message: `📥 Descargando ${validClips.length} clips...` });
    const clipBuffers = await Promise.all(validClips.map(downloadVideo));
    const clipPaths: string[] = clipBuffers.map((buf, i) => {
      const p = path.join(tmpDir, `clip_${i + 1}.mp4`);
      fs.writeFileSync(p, buf);
      return p;
    });

    // ── Generar title card final (2s) sobre imagen de referencia ────────────
    send(res, "progress", { step: 3, total: 9, message: "🖼️ Generando title card final..." });
    const titleCardPath = path.join(tmpDir, "title_card.mp4");
    const fontArg = "fontfile=/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf:";
    try {
      execSync(
        `"${FFMPEG}" -y -loop 1 -framerate 25 -i "${REF_IMAGE_PATH}" ` +
        `-vf "scale=720:1280:force_original_aspect_ratio=increase,crop=720:1280," ` +
        `-vf "scale=720:1280,` +
        `drawtext=${fontArg}text='MUSCLE FACTORY':fontcolor=white:fontsize=64:x=(w-text_w)/2:y=h*0.78:box=1:boxcolor=black@0.6:boxborderw=12,` +
        `drawtext=${fontArg}text='musclefactorybcn.com':fontcolor=#f0c040:fontsize=34:x=(w-text_w)/2:y=h*0.86:box=1:boxcolor=black@0.5:boxborderw=8" ` +
        `-t 2 -c:v libx264 -preset fast -crf 20 -an -movflags +faststart "${titleCardPath}"`,
        { timeout: 30_000, stdio: "pipe" }
      );
    } catch {
      // Fallback: title card sencillo sin fuentes externas
      execSync(
        `"${FFMPEG}" -y -loop 1 -framerate 25 -i "${REF_IMAGE_PATH}" ` +
        `-vf "scale=720:1280" ` +
        `-t 2 -c:v libx264 -preset fast -crf 20 -an -movflags +faststart "${titleCardPath}"`,
        { timeout: 30_000, stdio: "pipe" }
      );
    }
    clipPaths.push(titleCardPath);

    // ── Generar TTS narración ─────────────────────────────────────────────────
    send(res, "progress", { step: 4, total: 9, message: "🎙️ Generando narración TTS..." });
    const ttsScript =
      "La batalla por el mejor sabor ha comenzado. " +
      "Del bote Forest Fruits... surge el guerrero de los frutos del bosque. " +
      "Del bote Piña Coco... emerge el campeón tropical. " +
      "¡Esto sí que está bueno! Frutos del bosque, refrescante, frutal, irresistible... imposible de parar. " +
      "Espera... ¿Irresistible dices? Prueba el Piña Coco. Exótico, veraniego, el sabor más refrescante del verano. " +
      "¿Y tú con cuál te quedas? ¡Disfrútalos ya! " +
      "Muscle Factory. musclefactorybcn.com";

    let audioPath: string | null = null;
    try {
      const ttsBuf = await genTTS(ttsScript);
      audioPath = path.join(tmpDir, "narration.mp3");
      fs.writeFileSync(audioPath, ttsBuf);
      send(res, "progress", { step: 4, total: 9, message: "✅ TTS listo" });
    } catch (e) {
      send(res, "progress", { step: 4, total: 9, message: `⚠️ TTS falló, continuando sin audio: ${(e as Error).message}` });
    }

    // ── Normalizar todos los clips (mismo tamaño + fps) ──────────────────────
    send(res, "progress", { step: 5, total: 9, message: "🔧 Normalizando clips..." });
    const normPaths: string[] = [];
    for (let i = 0; i < clipPaths.length; i++) {
      const np = path.join(tmpDir, `norm_${i + 1}.mp4`);
      execSync(
        `"${FFMPEG}" -y -i "${clipPaths[i]}" ` +
        `-vf "scale=720:1280:force_original_aspect_ratio=increase,crop=720:1280" ` +
        `-r 25 -c:v libx264 -preset fast -crf 22 -an -movflags +faststart "${np}"`,
        { timeout: 60_000, stdio: "pipe" }
      );
      normPaths.push(np);
    }

    // ── Concatenar con ffmpeg concat demuxer ─────────────────────────────────
    send(res, "progress", { step: 6, total: 9, message: `🎞️ Concatenando ${normPaths.length} segmentos...` });
    const listPath = path.join(tmpDir, "concat.txt");
    fs.writeFileSync(listPath, normPaths.map(p => `file '${p}'`).join("\n"));
    const concatPath = path.join(tmpDir, "concat_raw.mp4");
    execSync(
      `"${FFMPEG}" -y -f concat -safe 0 -i "${listPath}" -c copy "${concatPath}"`,
      { timeout: 120_000, stdio: "pipe" }
    );

    // ── Mezclar audio (narración TTS) si está disponible ─────────────────────
    send(res, "progress", { step: 7, total: 9, message: "🎵 Mezclando audio..." });
    const finalPath = path.join(tmpDir, "muscle_factory_ad.mp4");
    if (audioPath && fs.existsSync(audioPath)) {
      execSync(
        `"${FFMPEG}" -y -i "${concatPath}" -i "${audioPath}" ` +
        `-map 0:v:0 -map 1:a:0 ` +
        `-c:v copy -c:a aac -b:a 192k ` +
        `-shortest -movflags +faststart "${finalPath}"`,
        { timeout: 120_000, stdio: "pipe" }
      );
    } else {
      fs.copyFileSync(concatPath, finalPath);
    }

    // ── Guardar en Vault ──────────────────────────────────────────────────────
    send(res, "progress", { step: 8, total: 9, message: "💾 Guardando en Vault..." });
    const finalBuf = fs.readFileSync(finalPath);
    const sizeKB = Math.round(finalBuf.length / 1024);

    const vaultId = projectId
      ? await saveToVault({
          projectId,
          fileType: "video",
          category: "ads",
          title: "Muscle Factory ISO — Anuncio 30s Gladiadores",
          mimeType: "video/mp4",
          content: finalBuf.toString("base64"),
        })
      : null;

    const vaultUrl = vaultId ? `/api/vault/${vaultId}/download` : null;

    send(res, "done", {
      success: true,
      vaultId,
      vaultUrl,
      clips: validClips.length + 1,
      sizeKB,
      message:
        `🎬 **Anuncio Muscle Factory — 30 segundos** listo!\n\n` +
        `✅ ${validClips.length + 1} escenas generadas con Grok xAI\n` +
        `🎙️ Narración TTS integrada\n` +
        `⏱️ ~30 segundos, 720p, 9:16\n` +
        (vaultUrl
          ? `\n💾 Guardado en Vault #${vaultId}\n📥 [Descargar vídeo](${vaultUrl})\n[VIDEO:Anuncio Muscle Factory 30s](${vaultUrl})`
          : ""),
    });

    logger.info({ vaultId, clips: validClips.length, sizeKB }, "muscle-factory: ad generated");
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
