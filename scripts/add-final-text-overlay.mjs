#!/usr/bin/env node
/**
 * Hanakaze v3 — Post-procesa el video final añadiendo texto tipográfico
 * NÍTIDO con ffmpeg drawtext, sustituyendo el texto basura del modelo IA.
 *
 *   HANAKAZE_PROJECT_ID=7 SOURCE_VAULT_ID=1340 node scripts/add-final-text-overlay.mjs
 *
 * Sin SOURCE_VAULT_ID lee el último concat-final-v3 desde logs/hanakaze-v3-result.json.
 * Genera en /tmp y sube al vault como nuevo asset video.
 *
 * Texto que añade:
 *   • intro 0-5s   → "HANAKAZE SERIGRAPHY" (negro sobre fondo blanco)
 *   • outro 55-60s → "HANAKAZE SERIGRAPHY" + "@hanakaze.serigraphy" + "HECHO A MANO · ESTAMPADO EN CASA" (blanco sobre navy)
 */
import { spawn } from "node:child_process";
import { promises as fs } from "node:fs";
import path from "node:path";
import { request } from "node:http";

const BASE = "http://127.0.0.1:8080";
const PROJECT_ID = parseInt(process.env.HANAKAZE_PROJECT_ID || "7", 10);
const EMAIL = process.env.HANAKAZE_ADMIN_EMAIL || "sadiagiljoan@gmail.com";
const PASSWORD = process.env.HANAKAZE_ADMIN_PASSWORD;
if (!PASSWORD) { console.error("ERROR: falta HANAKAZE_ADMIN_PASSWORD"); process.exit(2); }

const FONT = "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf";

let cookieJar = "";

function api(p, { method = "GET", json, headers = {} } = {}) {
  return new Promise((resolve, reject) => {
    const url = new URL(BASE + p);
    const body = json ? JSON.stringify(json) : null;
    const req = request({
      hostname: url.hostname, port: url.port, path: url.pathname + url.search, method,
      headers: {
        ...(json ? { "Content-Type": "application/json", "Content-Length": Buffer.byteLength(body) } : {}),
        ...(cookieJar ? { Cookie: cookieJar } : {}),
        ...headers,
      },
    }, (res) => {
      const chunks = [];
      res.on("data", c => chunks.push(c));
      res.on("end", () => {
        const setCookie = res.headers["set-cookie"];
        if (setCookie) cookieJar = setCookie.map(c => c.split(";")[0]).join("; ");
        resolve({ status: res.statusCode, ok: res.statusCode >= 200 && res.statusCode < 300, buffer: Buffer.concat(chunks) });
      });
    });
    req.on("error", reject);
    if (body) req.write(body);
    req.end();
  });
}

async function login() {
  console.log("[overlay] login admin…");
  const r = await api("/api/auth/login", { method: "POST", json: { email: EMAIL, password: PASSWORD } });
  if (!r.ok) throw new Error(`login HTTP ${r.status}: ${r.buffer.toString().slice(0,200)}`);
  console.log("[overlay] login OK");
}

async function downloadVault(vaultId) {
  console.log(`[overlay] descargando vault=${vaultId}…`);
  const r = await api(`/api/projects/${PROJECT_ID}/vault/${vaultId}/download`);
  if (!r.ok) throw new Error(`download HTTP ${r.status}`);
  console.log(`[overlay] descargado ${(r.buffer.length/1024/1024).toFixed(2)}MB`);
  return r.buffer;
}

async function uploadToVault(buffer, label) {
  console.log(`[overlay] subiendo a vault…`);
  const form = new FormData();
  form.append("file", new Blob([buffer], { type: "video/mp4" }), `${label}.mp4`);
  form.append("projectId", String(PROJECT_ID));
  form.append("fileType", "video");
  form.append("title", label);
  form.append("mimeType", "video/mp4");
  const r = await fetch(`${BASE}/api/fs-pro/save-to-vault`, {
    method: "POST", body: form,
    headers: cookieJar ? { Cookie: cookieJar } : {},
  });
  const txt = await r.text();
  if (!r.ok) throw new Error(`upload HTTP ${r.status}: ${txt.slice(0,300)}`);
  const j = JSON.parse(txt);
  console.log(`[overlay] subido vault=${j.vaultId}`);
  return j.vaultId;
}

function ffprobe(file) {
  return new Promise((resolve, reject) => {
    const p = spawn("ffprobe", ["-v","error","-select_streams","v:0","-show_entries","stream=width,height,duration","-of","json", file]);
    let out = ""; p.stdout.on("data", d => out += d);
    p.on("close", (c) => c === 0 ? resolve(JSON.parse(out).streams[0]) : reject(new Error("ffprobe fail")));
  });
}

function ffmpeg(args) {
  return new Promise((resolve, reject) => {
    console.log(`[overlay] ffmpeg ${args.slice(0,3).join(" ")}…`);
    const p = spawn("ffmpeg", ["-y", ...args]);
    let stderr = "";
    p.stderr.on("data", d => stderr += d.toString());
    p.on("close", (c) => c === 0 ? resolve() : reject(new Error("ffmpeg exit "+c+":\n"+stderr.slice(-600))));
  });
}

function escFf(s) {
  // ffmpeg drawtext espera escape de : ' \
  return s.replace(/\\/g,"\\\\").replace(/:/g,"\\:").replace(/'/g,"\\'");
}

function buildDrawtextChain({ width, height, totalDuration }) {
  // Asumimos vertical 9:16 — escalo en función de height
  const fIntroBrand = Math.round(height * 0.040);   // ~77px en 1920
  const fOutroBrand = Math.round(height * 0.052);   // ~100px
  const fOutroHandle = Math.round(height * 0.034);  // ~65px
  const fOutroTagline = Math.round(height * 0.022); // ~42px

  const introEnd = 5;
  const outroStart = Math.max(0, totalDuration - 5);
  const outroEnd = totalDuration;

  // Margen lateral mínimo (4% del ancho) — clampamos x para garantizar que el texto
  // jamás se salga del frame aunque text_w fuera mayor de lo esperado por la fuente.
  const margin = Math.round(width * 0.04);
  const xCenterClamped = `'max(${margin},min(w-text_w-${margin},(w-text_w)/2))'`;

  const filters = [];

  // INTRO 0-5s — texto NEGRO sobre fondo blanco, debajo del kanji
  filters.push([
    `drawtext=fontfile=${FONT}`,
    `text='${escFf("HANAKAZE SERIGRAPHY")}'`,
    `fontsize=${fIntroBrand}`,
    `fontcolor=black`,
    `x=${xCenterClamped}`,
    `y=h*0.72`,
    `enable='between(t,3,${introEnd})'`,
    `alpha='if(lt(t,3.3),(t-3)/0.3,1)'`,
  ].join(":"));

  // OUTRO outroStart-outroEnd — texto BLANCO sobre fondo navy
  filters.push([
    `drawtext=fontfile=${FONT}`,
    `text='${escFf("HANAKAZE SERIGRAPHY")}'`,
    `fontsize=${fOutroBrand}`,
    `fontcolor=white`,
    `x=${xCenterClamped}`,
    `y=h*0.55`,
    `enable='between(t,${outroStart + 1.2},${outroEnd})'`,
    `alpha='if(lt(t,${outroStart + 1.6}),(t-${outroStart + 1.2})/0.4,1)'`,
  ].join(":"));

  filters.push([
    `drawtext=fontfile=${FONT}`,
    `text='${escFf("@hanakaze.serigraphy")}'`,
    `fontsize=${fOutroHandle}`,
    `fontcolor=white`,
    `x=${xCenterClamped}`,
    `y=h*0.66`,
    `enable='between(t,${outroStart + 2.2},${outroEnd})'`,
    `alpha='if(lt(t,${outroStart + 2.6}),(t-${outroStart + 2.2})/0.4,1)'`,
  ].join(":"));

  filters.push([
    `drawtext=fontfile=${FONT}`,
    `text='${escFf("HECHO A MANO · ESTAMPADO EN CASA")}'`,
    `fontsize=${fOutroTagline}`,
    `fontcolor=white`,
    `x=${xCenterClamped}`,
    `y=h*0.74`,
    `enable='between(t,${outroStart + 3.0},${outroEnd})'`,
    `alpha='if(lt(t,${outroStart + 3.4}),(t-${outroStart + 3.0})/0.4,1)'`,
  ].join(":"));

  return filters.join(",");
}

async function main() {
  await login();

  // Resolver vaultId
  let sourceVaultId = parseInt(process.env.SOURCE_VAULT_ID || "0", 10);
  if (!sourceVaultId) {
    try {
      const summary = JSON.parse(await fs.readFile("logs/hanakaze-v3-result.json", "utf8"));
      sourceVaultId = summary.finalConcat;
      console.log(`[overlay] vaultId del resultado: ${sourceVaultId}`);
    } catch {
      throw new Error("Falta SOURCE_VAULT_ID o logs/hanakaze-v3-result.json");
    }
  }

  // Descargar
  const buf = await downloadVault(sourceVaultId);
  const tmpIn = `/tmp/hanakaze-final-${sourceVaultId}.mp4`;
  const tmpOut = `/tmp/hanakaze-final-${sourceVaultId}-overlay.mp4`;
  await fs.writeFile(tmpIn, buf);

  // Probar dimensiones/duración
  const probe = await ffprobe(tmpIn);
  const srcW = parseInt(probe.width, 10);
  const srcH = parseInt(probe.height, 10);
  const duration = parseFloat(probe.duration);
  console.log(`[overlay] video fuente ${srcW}x${srcH} ${duration.toFixed(2)}s`);

  // Resolución de salida (UPSCALE_RES=alto deseado en pixels, default = nativo)
  // Valores típicos vertical 9:16: 1920 (FHD nativo), 2560 (1440p), 3840 (4K UHD)
  const targetH = parseInt(process.env.UPSCALE_RES || String(srcH), 10);
  const targetW = Math.round((targetH / srcH) * srcW / 2) * 2; // par
  const willUpscale = targetH !== srcH;
  if (willUpscale) {
    console.log(`[overlay] UPSCALE → ${targetW}x${targetH} (lanczos)`);
  }

  // Calidad
  const CRF = process.env.CRF || "14"; // 14 = visualmente lossless H.264
  const PRESET = process.env.PRESET || "veryslow";
  console.log(`[overlay] x264 crf=${CRF} preset=${PRESET}`);

  // Construir filtro: scale (si upscale) → drawtext (con fontsize basado en altura final)
  const drawChain = buildDrawtextChain({ width: targetW, height: targetH, totalDuration: duration });
  const filter = willUpscale
    ? `scale=${targetW}:${targetH}:flags=lanczos+accurate_rnd+full_chroma_int,${drawChain}`
    : drawChain;

  // Detectar codec audio para decidir copy vs reencode
  const audioCodec = await new Promise((resolve) => {
    const p = spawn("ffprobe", ["-v","error","-select_streams","a:0","-show_entries","stream=codec_name","-of","default=nw=1:nk=1", tmpIn]);
    let o=""; p.stdout.on("data",d=>o+=d); p.on("close",()=>resolve(o.trim()));
  });
  const audioCanCopy = ["aac","mp3"].includes(audioCodec);
  console.log(`[overlay] audio codec=${audioCodec} → ${audioCanCopy ? "copy (sin recodificar)" : "aac 320k"}`);

  // Aplicar overlay con calidad MÁXIMA
  await ffmpeg([
    "-i", tmpIn,
    "-vf", filter,
    "-c:v", "libx264", "-preset", PRESET, "-crf", CRF,
    "-profile:v", "high", "-level", "5.1",
    "-pix_fmt", "yuv420p",
    "-x264-params", "ref=6:bframes=4:b-adapt=2:rc-lookahead=60:me=umh:subme=9:trellis=2:aq-mode=3",
    ...(audioCanCopy ? ["-c:a","copy"] : ["-c:a","aac","-b:a","320k","-ar","48000"]),
    "-movflags", "+faststart",
    tmpOut,
  ]);

  const outBuf = await fs.readFile(tmpOut);
  console.log(`[overlay] resultado ${(outBuf.length/1024/1024).toFixed(2)}MB`);

  const newVault = await uploadToVault(outBuf, `hanakaze-final-${sourceVaultId}-textoverlay`);

  // Cleanup
  await fs.unlink(tmpIn).catch(()=>{});
  await fs.unlink(tmpOut).catch(()=>{});

  console.log(`\n═══ OVERLAY OK ═══`);
  console.log(`  source vault: ${sourceVaultId}`);
  console.log(`  NEW vault:    ${newVault}`);
}

main().catch((e) => {
  console.error("✗ FATAL:", e.message);
  console.error(e.stack);
  process.exit(1);
});
