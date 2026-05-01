/**
 * Super Ad Runner — orquestador backend genérico que reproduce el pipeline del
 * script scripts/run-hanakaze-v2-super.mjs para CUALQUIER marca/producto.
 *
 * Flujo:
 *   refs (vault) → N clips de video (i2v si refVaultId, t2v si no) →
 *   voz off TTS → música (1 ó 2 segmentos con crossfade ffmpeg local) →
 *   concat MP4 9:16 final → metadatos en bulkJobs + alimenta ShopyBrain.
 *
 * State persistente en bulk_jobs.{status, completedItems, totalItems, log[], result}.
 */

import { spawn } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";
import { tmpdir } from "node:os";
import { randomBytes } from "node:crypto";
import { eq } from "drizzle-orm";
import { db, bulkJobsTable, projectsTable, projectFilesTable } from "@workspace/db";
import { logger } from "./logger.js";
import {
  generateVideoFromImage, generateTTS, concatVideos,
  type VideoModel,
} from "./fusion-studio-pro.js";
import { saveToVaultSmart, getProjectReplicateToken, fetchVaultBufferById } from "./vault-smart.js";
import { learnFromOperation } from "./claude.js";

// ─── TYPES ────────────────────────────────────────────────────────────────────

export interface ClipSpec {
  key: string;
  model: VideoModel | string;
  duration: number;
  aspect: "9:16" | "16:9" | "1:1";
  prompt: string;
  refVaultId?: number;
}

export interface MusicPrompts {
  intro?: string;
  body?: string;
  single?: string;
}

export interface SuperAdStoryboard {
  brand: string;
  niche?: string;
  language: string;
  voiceId: string;
  voiceText: string;
  voiceModelId?: "eleven_multilingual_v2" | "eleven_turbo_v2_5" | "eleven_v3" | "eleven_flash_v2_5";
  musicPrompts: MusicPrompts;
  musicVolume?: number;
  voiceVolume?: number;
  width?: number;
  height?: number;
  fps?: number;
  crossfadeSec?: number;
  clips: ClipSpec[];
}

// ─── PERSISTENCIA EN BULK_JOBS ────────────────────────────────────────────────

async function appendLog(jobId: string, line: string): Promise<void> {
  const stamped = `[${new Date().toISOString()}] ${line}`;
  logger.info({ jobId }, `[super-ad] ${line}`);
  const [row] = await db.select({ log: bulkJobsTable.log }).from(bulkJobsTable).where(eq(bulkJobsTable.jobId, jobId));
  const newLog = [...(row?.log || []), stamped].slice(-500);
  await db.update(bulkJobsTable).set({ log: newLog, updatedAt: new Date() }).where(eq(bulkJobsTable.jobId, jobId));
}

async function setProgress(jobId: string, completed: number): Promise<void> {
  await db.update(bulkJobsTable).set({ completedItems: completed, updatedAt: new Date() }).where(eq(bulkJobsTable.jobId, jobId));
}

async function setStatus(jobId: string, status: "running" | "completed" | "failed", result?: any): Promise<void> {
  const update: any = { status, updatedAt: new Date() };
  if (result !== undefined) update.result = result;
  await db.update(bulkJobsTable).set(update).where(eq(bulkJobsTable.jobId, jobId));
}

// ─── HELPERS ──────────────────────────────────────────────────────────────────

function runFfmpeg(args: string[]): Promise<void> {
  return new Promise((resolve, reject) => {
    // FIX CRITICAL: stdio "ignore" para stdin+stdout (ffmpeg escribe a archivo, no a stdout),
    // solo capturamos stderr (donde van los logs/errores). Evita bloqueo por buffer pipe lleno.
    const ff = spawn("ffmpeg", args, { stdio: ["ignore", "ignore", "pipe"] });
    let stderr = "";
    ff.stderr.on("data", d => { stderr += d.toString(); });
    ff.on("error", reject);
    ff.on("close", code => code === 0 ? resolve() : reject(new Error(`ffmpeg exit ${code}: ${stderr.slice(-400)}`)));
  });
}

async function genElevenMusicSegment(prompt: string, durationSec: number): Promise<Buffer> {
  const lengthMs = Math.min(180_000, Math.max(5000, Math.round(durationSec * 1000)));
  const ELK = process.env.ELEVENLABS_API_KEY;
  if (!ELK) throw new Error("ELEVENLABS_API_KEY no definido");
  const r = await fetch("https://api.elevenlabs.io/v1/music", {
    method: "POST",
    headers: { "xi-api-key": ELK, "Content-Type": "application/json" },
    body: JSON.stringify({ prompt, music_length_ms: lengthMs }),
  });
  if (!r.ok) throw new Error(`ElevenLabs Music HTTP ${r.status}: ${(await r.text()).slice(0, 300)}`);
  return Buffer.from(await r.arrayBuffer());
}

// ─── PUBLIC: crear job + arrancar worker ──────────────────────────────────────

export async function createSuperAdJob(projectId: number, storyboard: SuperAdStoryboard): Promise<string> {
  const jobId = `super-ad-${Date.now()}-${randomBytes(4).toString("hex")}`;
  const musicSteps = (storyboard.musicPrompts.intro && storyboard.musicPrompts.body) ? 3
                    : (storyboard.musicPrompts.single ? 1 : 0);
  const total = storyboard.clips.length + 1 + musicSteps + 1; // clips + voice + music + concat

  await db.insert(bulkJobsTable).values({
    jobId,
    projectId,
    jobType: "super-ad",
    status: "pending",
    totalItems: total,
    completedItems: 0,
    log: [`[${new Date().toISOString()}] Job creado · ${storyboard.clips.length} clips · brand="${storyboard.brand}"`],
    result: { storyboard } as any,
  });

  // Fire-and-forget worker
  setImmediate(() => {
    runSuperAdJob(jobId, projectId, storyboard).catch(err => {
      logger.error({ err, jobId }, "[super-ad] worker fatal");
      appendLog(jobId, `✗ FATAL: ${err?.message || String(err)}`).catch(() => {});
      setStatus(jobId, "failed", { error: err?.message || String(err) }).catch(() => {});
    });
  });

  return jobId;
}

// ─── WORKER ───────────────────────────────────────────────────────────────────

async function runSuperAdJob(jobId: string, projectId: number, storyboard: SuperAdStoryboard): Promise<void> {
  const startedAt = Date.now();
  await setStatus(jobId, "running");
  await appendLog(jobId, `▶ Worker arrancado · ${storyboard.clips.length} clips · brand=${storyboard.brand}`);

  const [project] = await db.select().from(projectsTable).where(eq(projectsTable.id, projectId));
  if (!project) throw new Error(`Proyecto ${projectId} no encontrado`);
  const replicateToken = getProjectReplicateToken(project);

  let completed = 0;
  const clipVaults: Record<string, number> = {};

  // 1) CLIPS DE VIDEO ─────────────────────────────────────────────────────────
  for (let i = 0; i < storyboard.clips.length; i++) {
    const c = storyboard.clips[i];
    const t0 = Date.now();
    await appendLog(jobId, `▶ clip[${i + 1}/${storyboard.clips.length}] ${c.key} · ${c.model} · ${c.duration}s${c.refVaultId ? " (i2v)" : " (t2v)"}`);

    let refBuf: Buffer | null = null;
    let refMime = "image/png";
    if (c.refVaultId) {
      refBuf = await fetchVaultBufferById(projectId, c.refVaultId);
      const [refRow] = await db.select().from(projectFilesTable).where(eq(projectFilesTable.id, c.refVaultId));
      refMime = refRow?.mimeType || "image/png";
    }

    const out = await generateVideoFromImage(c.model as VideoModel, refBuf, refMime, c.prompt, {
      duration: c.duration,
      aspect: c.aspect,
      replicateToken,
    });

    const vaultId = await saveToVaultSmart({
      projectId,
      fileType: "fs-pro-video",
      category: "super-ad",
      title: `Super Ad ${storyboard.brand}: ${c.key} — ${c.prompt.slice(0, 50)}`,
      mimeType: "video/mp4",
      generatedBy: `super-ad:${c.model}`,
      buffer: out,
    });
    clipVaults[c.key] = vaultId;
    const sec = ((Date.now() - t0) / 1000).toFixed(1);
    await appendLog(jobId, `✔ clip ${c.key} vault=${vaultId} (${(out.length / 1024 / 1024).toFixed(1)}MB · ${sec}s)`);
    completed++;
    await setProgress(jobId, completed);
  }

  // 2) VOZ OFF TTS ────────────────────────────────────────────────────────────
  let voiceVaultId: number | undefined;
  {
    const t0 = Date.now();
    await appendLog(jobId, `▶ voice off (${storyboard.voiceText.length} chars · voiceId=${storyboard.voiceId})`);
    const voiceBuf = await generateTTS(storyboard.voiceText, {
      voiceId: storyboard.voiceId,
      modelId: storyboard.voiceModelId || "eleven_multilingual_v2",
      stability: 0.42,
      similarity: 0.88,
      style: 0.50,
      speed: 0.96,
    });
    voiceVaultId = await saveToVaultSmart({
      projectId,
      fileType: "fs-pro-audio",
      category: "super-ad",
      title: `Super Ad ${storyboard.brand}: voice off`,
      mimeType: "audio/mpeg",
      generatedBy: `super-ad:elevenlabs-tts`,
      buffer: voiceBuf,
    });
    const sec = ((Date.now() - t0) / 1000).toFixed(1);
    await appendLog(jobId, `✔ voice vault=${voiceVaultId} (${(voiceBuf.length / 1024).toFixed(0)}KB · ${sec}s)`);
    completed++;
    await setProgress(jobId, completed);
  }

  // 3) MÚSICA ─────────────────────────────────────────────────────────────────
  let musicVaultId: number | undefined;
  const totalDurationSec = storyboard.clips.reduce((a, c) => a + c.duration, 0);
  const targetMusicSec = Math.max(20, totalDurationSec + 5);

  if (storyboard.musicPrompts.intro && storyboard.musicPrompts.body) {
    const halfA = Math.max(20, Math.round(targetMusicSec / 2) + 3);
    const halfB = Math.max(20, targetMusicSec - Math.round(targetMusicSec / 2) + 3);

    await appendLog(jobId, `▶ music intro (${halfA}s)`);
    const introBuf = await genElevenMusicSegment(storyboard.musicPrompts.intro, halfA);
    completed++; await setProgress(jobId, completed);

    await appendLog(jobId, `▶ music body (${halfB}s)`);
    const bodyBuf = await genElevenMusicSegment(storyboard.musicPrompts.body, halfB);
    completed++; await setProgress(jobId, completed);

    await appendLog(jobId, `▶ music mix (ffmpeg crossfade 2s)`);
    const tmpDir = path.join(tmpdir(), `super-ad-${jobId}`);
    await fs.mkdir(tmpDir, { recursive: true });
    try {
      const introPath = path.join(tmpDir, "intro.mp3");
      const bodyPath = path.join(tmpDir, "body.mp3");
      const outPath = path.join(tmpDir, "mix.mp3");
      await fs.writeFile(introPath, introBuf);
      await fs.writeFile(bodyPath, bodyBuf);
      await runFfmpeg([
        "-y", "-i", introPath, "-i", bodyPath,
        "-filter_complex",
        `[0:a]afade=t=in:st=0:d=1.5[a0];[1:a]afade=t=out:st=${Math.max(2, halfB - 4)}:d=2[a1];[a0][a1]acrossfade=d=2:c1=tri:c2=tri[out]`,
        "-map", "[out]", "-c:a", "libmp3lame", "-b:a", "192k", outPath,
      ]);
      const mixBuf = await fs.readFile(outPath);
      musicVaultId = await saveToVaultSmart({
        projectId,
        fileType: "fs-pro-music",
        category: "super-ad",
        title: `Super Ad ${storyboard.brand}: music mix`,
        mimeType: "audio/mpeg",
        generatedBy: `super-ad:elevenlabs-music+ffmpeg`,
        buffer: mixBuf,
      });
      completed++; await setProgress(jobId, completed);
      await appendLog(jobId, `✔ music vault=${musicVaultId} (${(mixBuf.length / 1024).toFixed(0)}KB)`);
    } finally {
      // FIX CRITICAL: cleanup garantizado del tmpDir incluso si falla ffmpeg/readFile/saveToVault.
      await fs.rm(tmpDir, { recursive: true, force: true }).catch(() => {});
    }
  } else if (storyboard.musicPrompts.single) {
    await appendLog(jobId, `▶ music single (${targetMusicSec}s)`);
    const buf = await genElevenMusicSegment(storyboard.musicPrompts.single, targetMusicSec);
    musicVaultId = await saveToVaultSmart({
      projectId,
      fileType: "fs-pro-music",
      category: "super-ad",
      title: `Super Ad ${storyboard.brand}: music`,
      mimeType: "audio/mpeg",
      generatedBy: `super-ad:elevenlabs-music`,
      buffer: buf,
    });
    completed++; await setProgress(jobId, completed);
    await appendLog(jobId, `✔ music vault=${musicVaultId}`);
  }

  // 4) CONCAT FINAL ───────────────────────────────────────────────────────────
  const t0 = Date.now();
  await appendLog(jobId, `▶ concat ${storyboard.clips.length} clips + voz + música`);
  const videoBuffers = await Promise.all(
    storyboard.clips.map(c => fetchVaultBufferById(projectId, clipVaults[c.key])),
  );
  const voiceBuf = voiceVaultId ? await fetchVaultBufferById(projectId, voiceVaultId) : undefined;
  const musicBuf = musicVaultId ? await fetchVaultBufferById(projectId, musicVaultId) : undefined;

  const finalBuf = await concatVideos({
    videoBuffers,
    width: storyboard.width || 1080,
    height: storyboard.height || 1920,
    fps: storyboard.fps || 30,
    crossfadeSec: storyboard.crossfadeSec ?? 0.35,
    transitionPreset: "crossfade",
    voiceBuffer: voiceBuf,
    musicBuffer: musicBuf,
    voiceVolume: storyboard.voiceVolume ?? 1.0,
    musicVolume: storyboard.musicVolume ?? 0.18,
  });
  const finalVaultId = await saveToVaultSmart({
    projectId,
    fileType: "fs-pro-concat",
    category: "super-ad",
    title: `Super Ad ${storyboard.brand}: FINAL`,
    mimeType: "video/mp4",
    generatedBy: `super-ad:final`,
    buffer: finalBuf,
  });
  const sec = ((Date.now() - t0) / 1000).toFixed(1);
  await appendLog(jobId, `✔ FINAL vault=${finalVaultId} (${(finalBuf.length / 1024 / 1024).toFixed(1)}MB · ${sec}s)`);
  completed++;
  await setProgress(jobId, completed);

  // 5) APRENDIZAJE SHOPYBRAIN ────────────────────────────────────────────────
  const elapsedSec = ((Date.now() - startedAt) / 1000).toFixed(0);
  const summary = {
    jobId,
    brand: storyboard.brand,
    niche: storyboard.niche,
    clipCount: storyboard.clips.length,
    totalDurationSec,
    elapsedSec,
    voiceModel: storyboard.voiceModelId || "eleven_multilingual_v2",
    finalVaultId,
    clipVaults,
    voiceVaultId,
    musicVaultId,
    storyboard,
  };

  try {
    learnFromOperation({
      operationType: "super_ad_generation",
      niche: storyboard.niche || null,
      title: `Super Ad ${storyboard.brand} — ${storyboard.clips.length} clips, ${totalDurationSec}s`,
      content: `Generado anuncio profesional 9:16 para "${storyboard.brand}". ${storyboard.clips.length} clips i2v/t2v, voz off "${storyboard.voiceText.slice(0, 200)}", música ElevenLabs. Tiempo total: ${elapsedSec}s. Modelos video: ${[...new Set(storyboard.clips.map(c => c.model))].join(", ")}. Final vault=${finalVaultId}.`,
      confidence: 0.85,
      tags: ["super_ad", "video", "advertising", storyboard.brand.toLowerCase().replace(/\s+/g, "_"), ...(storyboard.niche ? [storyboard.niche] : [])],
      structuredData: { storyboard, summary },
      sourceProjectId: projectId,
      metrics: { clipCount: storyboard.clips.length, totalDurationSec, elapsedSec: parseFloat(elapsedSec) },
    });
  } catch (err) {
    logger.warn({ err, jobId }, "[super-ad] learnFromOperation failed (non-fatal)");
  }

  await setStatus(jobId, "completed", summary);
  await appendLog(jobId, `═══ COMPLETADO en ${elapsedSec}s · final vault=${finalVaultId} ═══`);
}
