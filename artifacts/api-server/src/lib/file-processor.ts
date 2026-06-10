import { logger } from "./logger.js";

export interface ProcessedFile {
  type: string;
  filename: string;
  mimeType: string;
  textContent: string | null;
  base64Content: string | null;
  metadata: Record<string, unknown>;
}

const TEXT_EXTENSIONS = new Set([
  "txt", "md", "markdown", "csv", "tsv", "json", "jsonl", "ndjson", "xml",
  "html", "htm", "css", "scss", "sass", "less", "js", "mjs", "cjs", "ts",
  "tsx", "jsx", "vue", "svelte", "py", "rb", "php", "java", "kt", "c", "cpp",
  "cc", "h", "hpp", "cs", "go", "rs", "swift", "dart", "lua", "r", "scala",
  "yaml", "yml", "toml", "ini", "cfg", "conf", "env", "sh", "bash", "zsh",
  "sql", "graphql", "gql", "svg", "liquid", "ejs", "hbs", "pug", "log",
  "properties", "gradle", "dockerfile", "makefile", "bat", "ps1",
]);

const IMAGE_EXTENSIONS = new Set(["png", "jpg", "jpeg", "gif", "webp", "bmp", "ico", "svg", "avif", "tiff", "tif", "heic", "heif"]);
const AUDIO_EXTENSIONS = new Set(["mp3", "wav", "m4a", "aac", "ogg", "oga", "opus", "flac", "wma", "aiff", "aif"]);
const VIDEO_EXTENSIONS = new Set(["mp4", "webm", "mov", "avi", "mkv", "m4v", "wmv", "flv", "mpeg", "mpg", "3gp"]);

const MAX_TEXT_OUTPUT = 200_000;

function decodeXmlEntities(s: string): string {
  return s
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_m, d) => String.fromCodePoint(Number(d)))
    .replace(/&#x([0-9a-fA-F]+);/g, (_m, h) => String.fromCodePoint(parseInt(h, 16)));
}

/** Extract readable text from a .docx (Office Open XML, which is a zip of XML). */
async function extractDocxText(buffer: Buffer): Promise<{ text: string; paragraphs: number }> {
  const AdmZip = (await import("adm-zip")).default;
  const zip = new AdmZip(buffer);
  const parts = ["word/document.xml"];
  // Include headers/footers if present so nothing is lost.
  for (const e of zip.getEntries() as Array<{ entryName: string }>) {
    if (/^word\/(header|footer)\d*\.xml$/.test(e.entryName)) parts.push(e.entryName);
  }
  let out = "";
  for (const part of parts) {
    const entry = zip.getEntry(part);
    if (!entry) continue;
    let xml = entry.getData().toString("utf-8");
    xml = xml
      .replace(/<w:tab\b[^>]*\/>/g, "\t")
      .replace(/<w:br\b[^>]*\/>/g, "\n")
      .replace(/<\/w:p>/g, "\n");
    xml = xml.replace(/<[^>]+>/g, "");
    out += decodeXmlEntities(xml);
  }
  const text = out.replace(/\n{3,}/g, "\n\n").trim();
  return { text, paragraphs: text.split("\n").filter(Boolean).length };
}

/** Extract readable text from a .pptx, slide by slide. */
async function extractPptxText(buffer: Buffer): Promise<{ text: string; slides: number }> {
  const AdmZip = (await import("adm-zip")).default;
  const zip = new AdmZip(buffer);
  const slideEntries = (zip.getEntries() as Array<{ entryName: string; getData(): Buffer }>)
    .filter((e) => /^ppt\/slides\/slide\d+\.xml$/.test(e.entryName))
    .sort((a, b) => {
      const na = Number(a.entryName.match(/slide(\d+)\.xml$/)?.[1] ?? 0);
      const nb = Number(b.entryName.match(/slide(\d+)\.xml$/)?.[1] ?? 0);
      return na - nb;
    });
  const blocks: string[] = [];
  slideEntries.forEach((entry, idx) => {
    const xml = entry.getData().toString("utf-8");
    const texts = [...xml.matchAll(/<a:t>([\s\S]*?)<\/a:t>/g)].map((m) => decodeXmlEntities(m[1]).trim()).filter(Boolean);
    if (texts.length) blocks.push(`--- Diapositiva ${idx + 1} ---\n${texts.join("\n")}`);
  });
  return { text: blocks.join("\n\n"), slides: slideEntries.length };
}

/** Strip an HTML document to readable text + key metadata using cheerio. */
async function extractHtmlText(html: string): Promise<{ text: string; title: string; meta: Record<string, string> }> {
  const cheerio = await import("cheerio");
  const $ = cheerio.load(html);
  $("script, style, noscript, svg, iframe").remove();
  const title = $("title").first().text().trim();
  const meta: Record<string, string> = {};
  $("meta").each((_i, el) => {
    const name = $(el).attr("name") || $(el).attr("property");
    const content = $(el).attr("content");
    if (name && content) meta[name] = content;
  });
  const text = $("body").text().replace(/[ \t]+/g, " ").replace(/\n\s*\n\s*\n+/g, "\n\n").trim();
  return { text, title, meta };
}

/** Transcribe an audio buffer using ElevenLabs Scribe (speech-to-text). Real, no mocks. */
async function transcribeAudio(buffer: Buffer, filename: string, mimeType: string): Promise<{ text: string; language?: string } | null> {
  const apiKey = process.env.ELEVENLABS_API_KEY;
  if (!apiKey) {
    logger.warn("ELEVENLABS_API_KEY no configurada — no se puede transcribir audio");
    return null;
  }
  const form = new FormData();
  const blob = new Blob([new Uint8Array(buffer)], { type: mimeType || "application/octet-stream" });
  form.append("file", blob, filename);
  form.append("model_id", "scribe_v1");
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 120_000);
  try {
    const res = await fetch("https://api.elevenlabs.io/v1/speech-to-text", {
      method: "POST",
      headers: { "xi-api-key": apiKey },
      body: form,
      signal: controller.signal,
    });
    if (!res.ok) {
      const errText = await res.text().catch(() => "");
      logger.warn({ status: res.status, errText: errText.slice(0, 300) }, "ElevenLabs STT falló");
      return null;
    }
    const data = (await res.json()) as { text?: string; language_code?: string };
    return { text: data.text ?? "", language: data.language_code };
  } catch (err) {
    logger.warn({ err: err instanceof Error ? err.message : String(err) }, "ElevenLabs STT error");
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

/** Extract the audio track of a video into an mp3 buffer using ffmpeg. Returns null if no audio. */
async function extractVideoAudio(buffer: Buffer, ext: string): Promise<{ mp3: Buffer | null; durationSec: number | null }> {
  const fs = await import("node:fs");
  const os = await import("node:os");
  const path = await import("node:path");
  const { execFile } = await import("node:child_process");
  const { promisify } = await import("node:util");
  const execFileP = promisify(execFile);

  let ffmpegPath = "ffmpeg";
  try {
    const p = (await import("ffmpeg-static")).default as unknown as string;
    if (p && fs.existsSync(p)) ffmpegPath = p;
  } catch { /* fall back to PATH */ }

  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "vid_"));
  const inPath = path.join(dir, `in.${ext || "mp4"}`);
  const outPath = path.join(dir, "out.mp3");
  let durationSec: number | null = null;
  let mp3: Buffer | null = null;
  try {
    fs.writeFileSync(inPath, buffer);
    try {
      await execFileP(
        ffmpegPath,
        ["-i", inPath, "-vn", "-ac", "1", "-ar", "16000", "-codec:a", "libmp3lame", "-q:a", "5", "-y", outPath],
        { timeout: 90_000, maxBuffer: 1024 * 1024 * 64 },
      );
    } catch (e: any) {
      // ffmpeg writes its report to stderr (incl. "no audio") and may exit non-zero.
      const stderr = String(e?.stderr ?? "");
      const m = stderr.match(/Duration:\s*(\d+):(\d+):(\d+\.\d+)/);
      if (m) durationSec = Number(m[1]) * 3600 + Number(m[2]) * 60 + Number(m[3]);
    }
    if (fs.existsSync(outPath) && fs.statSync(outPath).size > 256) {
      mp3 = fs.readFileSync(outPath);
    }
  } finally {
    try { fs.rmSync(dir, { recursive: true, force: true }); } catch { /* ignore */ }
  }
  return { mp3, durationSec };
}

export async function processUploadedFile(
  buffer: Buffer,
  filename: string,
  mimeType: string
): Promise<ProcessedFile> {
  const ext = filename.split(".").pop()?.toLowerCase() ?? "";

  // ─── Word (.docx) ────────────────────────────────────────────────────────
  if (ext === "docx" || mimeType === "application/vnd.openxmlformats-officedocument.wordprocessingml.document") {
    try {
      const { text, paragraphs } = await extractDocxText(buffer);
      return {
        type: "document",
        filename,
        mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        textContent: text.slice(0, MAX_TEXT_OUTPUT) || null,
        base64Content: null,
        metadata: { format: "docx", paragraphs, chars: text.length },
      };
    } catch (err) {
      logger.warn({ err: err instanceof Error ? err.message : String(err), filename }, "docx parse falló");
      return { type: "document", filename, mimeType, textContent: null, base64Content: null, metadata: { format: "docx", error: true } };
    }
  }

  // ─── PowerPoint (.pptx) ──────────────────────────────────────────────────
  if (ext === "pptx" || mimeType === "application/vnd.openxmlformats-officedocument.presentationml.presentation") {
    try {
      const { text, slides } = await extractPptxText(buffer);
      return {
        type: "presentation",
        filename,
        mimeType: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
        textContent: text.slice(0, MAX_TEXT_OUTPUT) || null,
        base64Content: null,
        metadata: { format: "pptx", slides, chars: text.length },
      };
    } catch (err) {
      logger.warn({ err: err instanceof Error ? err.message : String(err), filename }, "pptx parse falló");
      return { type: "presentation", filename, mimeType, textContent: null, base64Content: null, metadata: { format: "pptx", error: true } };
    }
  }

  // ─── HTML (clean to readable text) ───────────────────────────────────────
  if (ext === "html" || ext === "htm" || mimeType === "text/html") {
    try {
      const raw = buffer.toString("utf-8");
      const { text, title, meta } = await extractHtmlText(raw);
      const head = [title ? `Título: ${title}` : "", meta.description ? `Descripción: ${meta.description}` : ""].filter(Boolean).join("\n");
      const combined = [head, text].filter(Boolean).join("\n\n");
      return {
        type: "html",
        filename,
        mimeType: "text/html",
        textContent: combined.slice(0, MAX_TEXT_OUTPUT),
        base64Content: null,
        metadata: { title, meta, chars: combined.length },
      };
    } catch {
      const text = buffer.toString("utf-8");
      return { type: "text", filename, mimeType, textContent: text.slice(0, MAX_TEXT_OUTPUT), base64Content: null, metadata: { lines: text.split("\n").length } };
    }
  }

  // ─── Plain text / source code ────────────────────────────────────────────
  if (TEXT_EXTENSIONS.has(ext) || mimeType.startsWith("text/")) {
    const text = buffer.toString("utf-8");
    return {
      type: "text",
      filename,
      mimeType,
      textContent: text.slice(0, MAX_TEXT_OUTPUT),
      base64Content: null,
      metadata: { lines: text.split("\n").length, chars: text.length },
    };
  }

  // ─── Images ──────────────────────────────────────────────────────────────
  if (IMAGE_EXTENSIONS.has(ext) || mimeType.startsWith("image/")) {
    const base64 = buffer.toString("base64");
    return {
      type: "image",
      filename,
      mimeType: mimeType || `image/${ext === "jpg" ? "jpeg" : ext}`,
      textContent: null,
      base64Content: base64,
      metadata: { sizeKB: Math.round(buffer.length / 1024) },
    };
  }

  // ─── Audio (transcribe with ElevenLabs) ──────────────────────────────────
  if (AUDIO_EXTENSIONS.has(ext) || mimeType.startsWith("audio/")) {
    const result = await transcribeAudio(buffer, filename, mimeType);
    const transcript = result?.text?.trim();
    return {
      type: "audio",
      filename,
      mimeType: mimeType || `audio/${ext}`,
      textContent: transcript
        ? `Transcripción del audio "${filename}"${result?.language ? ` (idioma: ${result.language})` : ""}:\n\n${transcript}`
        : null,
      base64Content: null,
      metadata: { sizeKB: Math.round(buffer.length / 1024), transcribed: !!transcript, language: result?.language },
    };
  }

  // ─── Video (extract audio → transcribe + metadata) ───────────────────────
  if (VIDEO_EXTENSIONS.has(ext) || mimeType.startsWith("video/")) {
    try {
      const { mp3, durationSec } = await extractVideoAudio(buffer, ext);
      let transcript: string | null = null;
      let language: string | undefined;
      if (mp3) {
        const result = await transcribeAudio(mp3, `${filename}.mp3`, "audio/mpeg");
        if (result?.text?.trim()) { transcript = result.text.trim(); language = result.language; }
      }
      const parts: string[] = [`Vídeo "${filename}"`];
      if (durationSec) parts.push(`Duración: ${Math.round(durationSec)}s`);
      if (transcript) parts.push(`\nTranscripción del audio${language ? ` (idioma: ${language})` : ""}:\n${transcript}`);
      else parts.push("(sin pista de audio o sin habla detectable)");
      return {
        type: "video",
        filename,
        mimeType: mimeType || `video/${ext}`,
        textContent: parts.join("\n"),
        base64Content: null,
        metadata: { sizeKB: Math.round(buffer.length / 1024), durationSec, transcribed: !!transcript, language },
      };
    } catch (err) {
      logger.warn({ err: err instanceof Error ? err.message : String(err), filename }, "video parse falló");
      return { type: "video", filename, mimeType, textContent: `Vídeo "${filename}" (no se pudo extraer audio)`, base64Content: null, metadata: { sizeKB: Math.round(buffer.length / 1024) } };
    }
  }

  // ─── PDF ─────────────────────────────────────────────────────────────────
  if (ext === "pdf" || mimeType === "application/pdf") {
    try {
      const { execSync } = await import("child_process");
      const fs = await import("fs");
      const tmpPath = `/tmp/upload_${Date.now()}.pdf`;
      fs.writeFileSync(tmpPath, buffer);
      const text = execSync(`pdftotext -layout "${tmpPath}" - 2>/dev/null || echo "PDF text extraction not available"`, { timeout: 15000, maxBuffer: 1024 * 1024 * 32 }).toString();
      try { fs.unlinkSync(tmpPath); } catch { /* ignore */ }

      return {
        type: "pdf",
        filename,
        mimeType: "application/pdf",
        textContent: text.length > 50 ? text.slice(0, MAX_TEXT_OUTPUT) : null,
        base64Content: buffer.toString("base64"),
        metadata: { sizeKB: Math.round(buffer.length / 1024), textExtracted: text.length > 50 },
      };
    } catch {
      return {
        type: "pdf",
        filename,
        mimeType: "application/pdf",
        textContent: null,
        base64Content: buffer.toString("base64"),
        metadata: { sizeKB: Math.round(buffer.length / 1024) },
      };
    }
  }

  // ─── ZIP (list + extract text and office docs inside) ────────────────────
  if (ext === "zip" || mimeType === "application/zip" || mimeType === "application/x-zip-compressed") {
    try {
      const AdmZip = (await import("adm-zip")).default;
      const zip = new AdmZip(buffer);
      const entries = zip.getEntries();
      const fileList = entries.map((e) => e.entryName).join("\n");
      const extracted: string[] = [];
      let totalChars = 0;
      let processedCount = 0;

      for (const entry of entries) {
        if (entry.isDirectory || processedCount >= 40 || totalChars >= MAX_TEXT_OUTPUT) continue;
        const entName = entry.entryName;
        if (entName.startsWith("__MACOSX/")) continue;
        const entExt = entName.split(".").pop()?.toLowerCase() ?? "";
        try {
          if (TEXT_EXTENSIONS.has(entExt)) {
            const data = entry.getData();
            if (data.length > 0 && data.length < 200_000) {
              const content = data.toString("utf-8");
              extracted.push(`\n=== ${entName} ===\n${content}`);
              totalChars += content.length;
              processedCount++;
            }
          } else if (entExt === "docx") {
            const { text } = await extractDocxText(entry.getData());
            extracted.push(`\n=== ${entName} (Word) ===\n${text.slice(0, 20000)}`);
            totalChars += text.length; processedCount++;
          } else if (entExt === "pptx") {
            const { text } = await extractPptxText(entry.getData());
            extracted.push(`\n=== ${entName} (PowerPoint) ===\n${text.slice(0, 20000)}`);
            totalChars += text.length; processedCount++;
          }
        } catch { /* skip unreadable entry */ }
      }

      return {
        type: "zip",
        filename,
        mimeType: "application/zip",
        textContent: `Archivos en el ZIP (${entries.length}):\n${fileList}\n\nContenido extraído:\n${extracted.join("\n")}`.slice(0, MAX_TEXT_OUTPUT),
        base64Content: null,
        metadata: { fileCount: entries.length, files: entries.map((e) => e.entryName).slice(0, 200), extractedCount: processedCount },
      };
    } catch {
      return { type: "zip", filename, mimeType, textContent: null, base64Content: null, metadata: {} };
    }
  }

  // ─── Excel (.xlsx / .xls) ────────────────────────────────────────────────
  if (ext === "xlsx" || ext === "xls" || mimeType.includes("spreadsheet") || mimeType.includes("excel")) {
    try {
      const ExcelJS = (await import("exceljs")).default;
      const workbook = new ExcelJS.Workbook();
      await workbook.xlsx.load(buffer as unknown as ArrayBuffer);
      const sheets: string[] = [];

      workbook.eachSheet((worksheet) => {
        const rows: string[] = [];
        rows.push(`\n=== Hoja: ${worksheet.name} ===`);
        worksheet.eachRow({ includeEmpty: false }, (row, rowNum) => {
          if (rowNum > 500) return;
          const vals = (row.values as unknown[]).slice(1).map((v) => String(v ?? ""));
          rows.push(vals.join("\t"));
        });
        sheets.push(rows.join("\n"));
      });

      return {
        type: "spreadsheet",
        filename,
        mimeType,
        textContent: sheets.join("\n").slice(0, MAX_TEXT_OUTPUT),
        base64Content: null,
        metadata: { sheets: workbook.worksheets.length },
      };
    } catch {
      return { type: "spreadsheet", filename, mimeType, textContent: null, base64Content: null, metadata: {} };
    }
  }

  if (mimeType === "application/json" || ext === "json") {
    const text = buffer.toString("utf-8");
    return {
      type: "json",
      filename,
      mimeType: "application/json",
      textContent: text.slice(0, MAX_TEXT_OUTPUT),
      base64Content: null,
      metadata: { sizeKB: Math.round(buffer.length / 1024) },
    };
  }

  logger.info({ filename, mimeType, ext }, "Unsupported file type — returning as binary");
  return {
    type: "binary",
    filename,
    mimeType,
    textContent: null,
    base64Content: buffer.toString("base64"),
    metadata: { sizeKB: Math.round(buffer.length / 1024) },
  };
}

export function filesToClaudeContent(files: ProcessedFile[]): Array<Record<string, unknown>> {
  const blocks: Array<Record<string, unknown>> = [];

  for (const file of files) {
    if (file.type === "image" && file.base64Content) {
      blocks.push({
        type: "image",
        source: { type: "base64", media_type: file.mimeType, data: file.base64Content },
      });
      blocks.push({ type: "text", text: `[Imagen subida: ${file.filename}]` });
    } else if (file.type === "pdf" && file.base64Content) {
      blocks.push({
        type: "document",
        source: { type: "base64", media_type: "application/pdf", data: file.base64Content },
      });
      if (file.textContent) {
        blocks.push({ type: "text", text: `[PDF: ${file.filename}]\nTexto extraído:\n${file.textContent.slice(0, 15000)}` });
      }
    } else if (file.textContent) {
      blocks.push({
        type: "text",
        text: `[Archivo: ${file.filename} (${file.type})]\n${file.textContent.slice(0, 30000)}`,
      });
    } else {
      blocks.push({
        type: "text",
        text: `[Archivo recibido: ${file.filename} (${file.type}) — no se pudo extraer contenido textual]`,
      });
    }
  }

  return blocks;
}
