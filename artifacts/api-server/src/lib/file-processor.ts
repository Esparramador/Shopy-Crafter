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
  "txt", "md", "csv", "json", "xml", "html", "htm", "css", "js", "ts",
  "tsx", "jsx", "py", "rb", "php", "java", "c", "cpp", "h", "swift",
  "yaml", "yml", "toml", "ini", "env", "sh", "bash", "sql", "graphql",
  "svg", "liquid", "ejs", "hbs", "pug", "scss", "sass", "less",
]);

const IMAGE_EXTENSIONS = new Set(["png", "jpg", "jpeg", "gif", "webp", "bmp", "ico", "svg"]);

export async function processUploadedFile(
  buffer: Buffer,
  filename: string,
  mimeType: string
): Promise<ProcessedFile> {
  const ext = filename.split(".").pop()?.toLowerCase() ?? "";

  if (TEXT_EXTENSIONS.has(ext) || mimeType.startsWith("text/")) {
    const text = buffer.toString("utf-8");
    return {
      type: "text",
      filename,
      mimeType,
      textContent: text,
      base64Content: null,
      metadata: { lines: text.split("\n").length, chars: text.length },
    };
  }

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

  if (ext === "pdf" || mimeType === "application/pdf") {
    try {
      const { execSync } = await import("child_process");
      const fs = await import("fs");
      const tmpPath = `/tmp/upload_${Date.now()}.pdf`;
      fs.writeFileSync(tmpPath, buffer);
      const text = execSync(`pdftotext -layout "${tmpPath}" - 2>/dev/null || echo "PDF text extraction not available"`, { timeout: 10000 }).toString();
      try { fs.unlinkSync(tmpPath); } catch { /* ignore */ }

      return {
        type: "pdf",
        filename,
        mimeType: "application/pdf",
        textContent: text.length > 50 ? text : null,
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

  if (ext === "zip" || mimeType === "application/zip") {
    try {
      const AdmZip = (await import("adm-zip")).default;
      const zip = new AdmZip(buffer);
      const entries = zip.getEntries();
      const fileList = entries.map(e => e.entryName).join("\n");
      const textFiles: string[] = [];

      for (const entry of entries) {
        const entExt = entry.entryName.split(".").pop()?.toLowerCase() ?? "";
        if (TEXT_EXTENSIONS.has(entExt) && entry.getData().length < 50000) {
          textFiles.push(`\n=== ${entry.entryName} ===\n${entry.getData().toString("utf-8")}`);
        }
      }

      return {
        type: "zip",
        filename,
        mimeType: "application/zip",
        textContent: `Archivos en el ZIP:\n${fileList}\n\nContenido de archivos de texto:\n${textFiles.join("\n")}`,
        base64Content: null,
        metadata: { fileCount: entries.length, files: entries.map(e => e.entryName) },
      };
    } catch {
      return { type: "zip", filename, mimeType, textContent: null, base64Content: null, metadata: {} };
    }
  }

  if (ext === "xlsx" || ext === "xls" || mimeType.includes("spreadsheet")) {
    try {
      const ExcelJS = (await import("exceljs")).default;
      const workbook = new ExcelJS.Workbook();
      await workbook.xlsx.load(buffer as unknown as ArrayBuffer);
      const sheets: string[] = [];

      workbook.eachSheet((worksheet) => {
        const rows: string[] = [];
        rows.push(`\n=== Hoja: ${worksheet.name} ===`);
        worksheet.eachRow({ includeEmpty: false }, (row, rowNum) => {
          if (rowNum > 200) return;
          const vals = (row.values as unknown[]).slice(1).map(v => String(v ?? ""));
          rows.push(vals.join("\t"));
        });
        sheets.push(rows.join("\n"));
      });

      return {
        type: "spreadsheet",
        filename,
        mimeType,
        textContent: sheets.join("\n"),
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
      textContent: text,
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
        text: `[Archivo: ${file.filename} (${file.type})]\n${file.textContent.slice(0, 20000)}`,
      });
    }
  }

  return blocks;
}
