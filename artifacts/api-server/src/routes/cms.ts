import { Router, Request, Response } from "express";
import multer from "multer";
import sharp from "sharp";
import path from "path";
import fs from "fs";
import { v4 as uuidv4 } from "uuid";
import { db } from "@workspace/db";
import { cmsContent, cmsVersions } from "@workspace/db/schema";
import { eq, desc } from "drizzle-orm";
import { DEFAULT_CMS_CONTENT } from "../lib/cms-defaults.js";
import Anthropic from "@anthropic-ai/sdk";

const router = Router();
const anthropic = new Anthropic();

const MEDIA_DIR = path.join(process.cwd(), "../../artifacts/shopify-optimizer/public/media");
if (!fs.existsSync(MEDIA_DIR)) fs.mkdirSync(MEDIA_DIR, { recursive: true });

const storage = multer.memoryStorage();
const upload = multer({ storage, limits: { fileSize: 5 * 1024 * 1024 } });

const sseClients: Set<Response> = new Set();

function broadcast(event: string, data: unknown) {
  const msg = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
  sseClients.forEach(res => {
    try { res.write(msg); } catch { sseClients.delete(res); }
  });
}

function deepMergeDefaults(defaults: Record<string, unknown>, stored: Record<string, unknown>): Record<string, unknown> {
  const result = { ...stored };
  for (const key of Object.keys(defaults)) {
    if (!(key in result)) {
      result[key] = defaults[key];
    } else if (
      defaults[key] && typeof defaults[key] === "object" && !Array.isArray(defaults[key]) &&
      result[key] && typeof result[key] === "object" && !Array.isArray(result[key])
    ) {
      result[key] = deepMergeDefaults(defaults[key] as Record<string, unknown>, result[key] as Record<string, unknown>);
    }
  }
  return result;
}

async function getOrInitContent() {
  const rows = await db.select().from(cmsContent).limit(1);
  if (rows.length > 0) {
    const merged = deepMergeDefaults(DEFAULT_CMS_CONTENT as Record<string, unknown>, rows[0].content as Record<string, unknown>);
    return { ...rows[0], content: merged };
  }
  const [row] = await db.insert(cmsContent).values({ content: DEFAULT_CMS_CONTENT, version: 1 }).returning();
  return row;
}

function setNestedValue(obj: Record<string, unknown>, path: string, value: unknown): Record<string, unknown> {
  const keys = path.split(".");
  const BLOCKED = new Set(["__proto__", "constructor", "prototype"]);
  if (keys.some(k => BLOCKED.has(k))) throw new Error("Invalid path");
  const result = JSON.parse(JSON.stringify(obj));
  let current: Record<string, unknown> = result;
  for (let i = 0; i < keys.length - 1; i++) {
    const k = keys[i];
    if (BLOCKED.has(k)) throw new Error("Invalid path");
    if (!(k in current) || typeof current[k] !== "object") current[k] = {};
    current = current[k] as Record<string, unknown>; // nosemgrep: prototype-pollution-loop
  }
  const lastKey = keys[keys.length - 1];
  if (BLOCKED.has(lastKey)) throw new Error("Invalid path");
  current[lastKey] = value;
  return result;
}

async function saveVersion(content: unknown, version: number, savedBy: string) {
  await db.insert(cmsVersions).values({ content: content as Record<string, unknown>, version, savedBy, label: `v${version}` });
  const old = await db.select({ id: cmsVersions.id }).from(cmsVersions).orderBy(desc(cmsVersions.savedAt));
  if (old.length > 30) {
    const toDelete = old.slice(30);
    for (const v of toDelete) {
      await db.delete(cmsVersions).where(eq(cmsVersions.id, v.id));
    }
  }
}

router.get("/content", async (req: Request, res: Response) => {
  try {
    const row = await getOrInitContent();
    res.json(row.content);
  } catch (e) {
    res.status(500).json({ error: "Failed to load content" });
  }
});

router.patch("/content", async (req: Request, res: Response) => {
  try {
    const { path: fieldPath, value } = req.body as { path: string; value: unknown };
    const row = await getOrInitContent();
    await saveVersion(row.content, row.version, req.session?.userId?.toString() || "admin");
    const newContent = setNestedValue(row.content as Record<string, unknown>, fieldPath, value);
    const newVersion = row.version + 1;
    await db.update(cmsContent).set({ content: newContent, version: newVersion, updatedAt: new Date() }).where(eq(cmsContent.id, row.id));
    broadcast("content_updated", { path: fieldPath, value, version: newVersion });
    res.json({ success: true, version: newVersion });
  } catch (e) {
    res.status(500).json({ error: "Failed to update content" });
  }
});

router.post("/content/batch", async (req: Request, res: Response) => {
  try {
    const { changes } = req.body as { changes: Array<{ path: string; value: unknown }> };
    const row = await getOrInitContent();
    await saveVersion(row.content, row.version, req.session?.userId?.toString() || "admin");
    let newContent = row.content as Record<string, unknown>;
    for (const change of changes) {
      newContent = setNestedValue(newContent, change.path, change.value);
    }
    const newVersion = row.version + 1;
    await db.update(cmsContent).set({ content: newContent, version: newVersion, updatedAt: new Date() }).where(eq(cmsContent.id, row.id));
    broadcast("content_updated", { batch: true, version: newVersion });
    res.json({ success: true, version: newVersion });
  } catch (e) {
    res.status(500).json({ error: "Failed to batch update" });
  }
});

router.post("/content/reset", async (req: Request, res: Response) => {
  try {
    const row = await getOrInitContent();
    await saveVersion(row.content, row.version, "admin");
    await db.update(cmsContent).set({ content: DEFAULT_CMS_CONTENT, version: row.version + 1, updatedAt: new Date() }).where(eq(cmsContent.id, row.id));
    broadcast("content_updated", { reset: true });
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: "Failed to reset" });
  }
});

router.post("/media/upload", upload.single("file"), async (req: Request, res: Response) => {
  try {
    if (!req.file) { res.status(400).json({ error: "No file uploaded" }); return; }
    const filename = `${uuidv4()}.webp`;
    const filepath = path.join(MEDIA_DIR, filename);
    await sharp(req.file.buffer).resize({ width: 2400, withoutEnlargement: true }).webp({ quality: 85 }).toFile(filepath);
    const meta = await sharp(filepath).metadata();
    broadcast("media_uploaded", { filename });
    res.json({ url: `/media/${filename}`, width: meta.width, height: meta.height });
  } catch (e) {
    res.status(500).json({ error: "Upload failed" });
  }
});

router.delete("/media/:filename", async (req: Request, res: Response) => {
  try {
    const rawName = String(req.params.filename);
    const filename = path.basename(rawName);
    if (filename !== rawName || filename.includes("..")) {
      res.status(400).json({ error: "Invalid filename" });
      return;
    }
    const filepath = path.resolve(MEDIA_DIR, filename); // nosemgrep: path-join-resolve-traversal, express-path-join-resolve-traversal
    if (!filepath.startsWith(path.resolve(MEDIA_DIR))) {
      res.status(400).json({ error: "Path traversal detected" });
      return;
    }
    if (fs.existsSync(filepath)) fs.unlinkSync(filepath); // nosemgrep: detect-non-literal-fs-filename
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: "Delete failed" });
  }
});

router.get("/versions", async (req: Request, res: Response) => {
  try {
    const versions = await db.select({ id: cmsVersions.id, version: cmsVersions.version, savedAt: cmsVersions.savedAt, savedBy: cmsVersions.savedBy, label: cmsVersions.label }).from(cmsVersions).orderBy(desc(cmsVersions.savedAt)).limit(30);
    res.json(versions);
  } catch (e) {
    res.status(500).json({ error: "Failed to load versions" });
  }
});

router.post("/versions/:id/restore", async (req: Request, res: Response) => {
  try {
    const id = parseInt(String(req.params.id));
    const [ver] = await db.select().from(cmsVersions).where(eq(cmsVersions.id, id));
    if (!ver) { res.status(404).json({ error: "Version not found" }); return; }
    const row = await getOrInitContent();
    await saveVersion(row.content, row.version, "admin");
    await db.update(cmsContent).set({ content: ver.content as Record<string, unknown>, version: row.version + 1, updatedAt: new Date() }).where(eq(cmsContent.id, row.id));
    broadcast("version_restored", { id, version: ver.version });
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: "Restore failed" });
  }
});

router.post("/ai/improve", async (req: Request, res: Response) => {
  try {
    const { text, instruction, context } = req.body as { text: string; instruction: string; context?: string };
    const systemPrompt = `Eres un copywriter experto para plataformas SaaS de marketing digital en español. Recibes un texto y una instrucción, y devuelves el texto mejorado. Contexto de la marca: ShopyBrain — plataforma de agencia Shopify con OmniCore Brain (IA acumulativa). Tono: profesional, persuasivo, premium, moderno. IMPORTANTE: devuelve SOLO el texto mejorado, sin explicaciones, sin comillas extra.`;
    const userPrompt = `Texto original: "${text}"\n\nInstrucción: ${instruction}\n${context ? `\nContexto adicional: ${context}` : ""}\n\nDevuelve solo el texto mejorado:`;
    const message = await anthropic.messages.create({ model: "claude-sonnet-4-5", max_tokens: 1024, messages: [{ role: "user", content: userPrompt }], system: systemPrompt });
    const improved = message.content[0].type === "text" ? message.content[0].text.trim() : text;
    res.json({ improved });
  } catch (e) {
    res.status(500).json({ error: "AI improvement failed" });
  }
});

router.get("/events", (req: Request, res: Response) => {
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.write("event: connected\ndata: {}\n\n");
  sseClients.add(res);
  req.on("close", () => sseClients.delete(res));
});

export default router;
