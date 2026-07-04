import { Router } from "express";
import { requireAdmin } from "../lib/auth.js";
import { saveToVault } from "../lib/vault.js";
import {
  generateFreepikImage, freepikImageToImage, upscaleFreepikImage,
  recolorFreepikImage, removeFreepikBackground, expandFreepikImage,
  freepikVirtualModel, generateFreepikVideoTask, pollFreepikVideoTask,
  searchFreepikStock, getFreepikEngines, isFreepikAvailable,
} from "../lib/freepik.js";
import { logger } from "../lib/logger.js";

const router = Router();

// ─── STATUS ───────────────────────────────────────────────────────────────────
router.get("/freepik/status", requireAdmin, async (_req, res): Promise<void> => {
  const available = isFreepikAvailable();
  if (!available) { res.json({ available, error: "FREEPIK_API_KEY no configurada" }); return; }
  const engines = await getFreepikEngines();
  res.json({ available, engines_count: engines.length, engines });
});

// ─── ENGINES ──────────────────────────────────────────────────────────────────
router.get("/freepik/engines", requireAdmin, async (_req, res): Promise<void> => {
  try {
    const engines = await getFreepikEngines();
    res.json({ engines });
  } catch (err: unknown) {
    res.status(500).json({ error: (err as Error).message });
  }
});

// ─── GENERACIÓN DE IMAGEN T2I ─────────────────────────────────────────────────
router.post("/freepik/generate", requireAdmin, async (req, res): Promise<void> => {
  try {
    if (!isFreepikAvailable()) { res.status(503).json({ error: "FREEPIK_API_KEY no configurada" }); return; }
    const {
      prompt, negative_prompt, num_images = 1, width, height, aspect_ratio,
      model, style, color, lighting, framing, guidance_scale, num_inference_steps, seed,
      projectId, title,
    } = req.body as Record<string, unknown>;

    if (!prompt) { res.status(400).json({ error: "prompt requerido" }); return; }

    const results = await generateFreepikImage({
      prompt: String(prompt),
      negative_prompt: negative_prompt ? String(negative_prompt) : undefined,
      num_images: Number(num_images) || 1,
      width: width ? Number(width) : undefined,
      height: height ? Number(height) : undefined,
      aspect_ratio: aspect_ratio as string | undefined,
      model: model ? String(model) : undefined,
      style: style as string | undefined,
      color: color as string | undefined,
      lighting: lighting as string | undefined,
      framing: framing as string | undefined,
      guidance_scale: guidance_scale != null ? Number(guidance_scale) : undefined,
      num_inference_steps: num_inference_steps ? Number(num_inference_steps) : undefined,
      seed: seed != null ? Number(seed) : undefined,
    });

    const saved = await Promise.all(results.map(async (img, i) => {
      try {
        return await saveToVault({
          projectId: projectId ? Number(projectId) : 0,
          title:     `${title ?? prompt} (${i + 1})`,
          fileType:  "freepik-image",
          generatedBy: "freepik:text-to-image",
          content:   img.base64,
          mimeType:  img.mimeType,
          fileSizeBytes: Buffer.from(img.base64, "base64").length,
        });
      } catch { return null; }
    }));

    res.json({
      success: true,
      images: results.map((img, i) => ({
        base64:  img.base64,
        mimeType: img.mimeType,
        seed:    img.seed,
        vaultId: saved[i]?.id,
      })),
    });
  } catch (err: unknown) {
    logger.error({ err: (err as Error).message }, "Freepik generate error");
    res.status(500).json({ error: (err as Error).message });
  }
});

// ─── IMAGEN A IMAGEN ──────────────────────────────────────────────────────────
router.post("/freepik/image-to-image", requireAdmin, async (req, res): Promise<void> => {
  try {
    if (!isFreepikAvailable()) { res.status(503).json({ error: "FREEPIK_API_KEY no configurada" }); return; }
    const { prompt, imageBase64, strength, negative_prompt, aspect_ratio, num_images, projectId, title, seed } = req.body as Record<string, unknown>;
    if (!prompt || !imageBase64) { res.status(400).json({ error: "prompt e imageBase64 requeridos" }); return; }

    const results = await freepikImageToImage({
      prompt: String(prompt),
      imageBase64: String(imageBase64),
      strength: strength != null ? Number(strength) : undefined,
      negative_prompt: negative_prompt ? String(negative_prompt) : undefined,
      aspect_ratio: aspect_ratio as string | undefined,
      num_images: num_images ? Number(num_images) : 1,
      seed: seed != null ? Number(seed) : undefined,
    });

    const saved = await Promise.all(results.map(async (img, i) => {
      try {
        return await saveToVault({ projectId: projectId ? Number(projectId) : 0, title: `${title ?? prompt} (${i + 1})`, fileType: "freepik-i2i", generatedBy: "freepik:image-to-image", content: img.base64, mimeType: img.mimeType, fileSizeBytes: Buffer.from(img.base64, "base64").length });
      } catch { return null; }
    }));
    res.json({ success: true, images: results.map((img, i) => ({ base64: img.base64, mimeType: img.mimeType, vaultId: saved[i]?.id })) });
  } catch (err: unknown) {
    res.status(500).json({ error: (err as Error).message });
  }
});

// ─── UPSCALER ─────────────────────────────────────────────────────────────────
router.post("/freepik/upscale", requireAdmin, async (req, res): Promise<void> => {
  try {
    if (!isFreepikAvailable()) { res.status(503).json({ error: "FREEPIK_API_KEY no configurada" }); return; }
    const { imageBase64, mimeType = "image/jpeg", projectId, title } = req.body as Record<string, unknown>;
    if (!imageBase64) { res.status(400).json({ error: "imageBase64 requerido" }); return; }

    const upscaled = await upscaleFreepikImage(String(imageBase64), String(mimeType));
    const saved = await saveToVault({ projectId: projectId ? Number(projectId) : 0, title: String(title ?? "Upscaled 4×"), fileType: "freepik-upscale", generatedBy: "freepik:upscaler", content: upscaled, mimeType: String(mimeType), fileSizeBytes: Buffer.from(upscaled, "base64").length }).catch(() => null);
    res.json({ success: true, base64: upscaled, mimeType: String(mimeType), vaultId: saved?.id });
  } catch (err: unknown) {
    res.status(500).json({ error: (err as Error).message });
  }
});

// ─── RECOLOR ──────────────────────────────────────────────────────────────────
router.post("/freepik/recolor", requireAdmin, async (req, res): Promise<void> => {
  try {
    if (!isFreepikAvailable()) { res.status(503).json({ error: "FREEPIK_API_KEY no configurada" }); return; }
    const { imageBase64, prompt, projectId, title } = req.body as Record<string, unknown>;
    if (!imageBase64 || !prompt) { res.status(400).json({ error: "imageBase64 y prompt requeridos" }); return; }

    const results = await recolorFreepikImage(String(imageBase64), String(prompt));
    const saved = await Promise.all(results.map(async (img, i) =>
      saveToVault({ projectId: projectId ? Number(projectId) : 0, title: `${title ?? "Recolor"} (${i + 1})`, fileType: "freepik-recolor", generatedBy: "freepik:recolor", content: img.base64, mimeType: img.mimeType, fileSizeBytes: Buffer.from(img.base64, "base64").length }).catch(() => null)
    ));
    res.json({ success: true, images: results.map((img, i) => ({ base64: img.base64, mimeType: img.mimeType, vaultId: saved[i]?.id })) });
  } catch (err: unknown) {
    res.status(500).json({ error: (err as Error).message });
  }
});

// ─── ELIMINAR FONDO ───────────────────────────────────────────────────────────
router.post("/freepik/remove-background", requireAdmin, async (req, res): Promise<void> => {
  try {
    if (!isFreepikAvailable()) { res.status(503).json({ error: "FREEPIK_API_KEY no configurada" }); return; }
    const { imageBase64, mimeType = "image/jpeg", projectId, title } = req.body as Record<string, unknown>;
    if (!imageBase64) { res.status(400).json({ error: "imageBase64 requerido" }); return; }

    const result = await removeFreepikBackground(String(imageBase64), String(mimeType));
    const saved = await saveToVault({ projectId: projectId ? Number(projectId) : 0, title: String(title ?? "Sin Fondo"), fileType: "freepik-bg-removal", generatedBy: "freepik:background-removal", content: result, mimeType: "image/png", fileSizeBytes: Buffer.from(result, "base64").length }).catch(() => null);
    res.json({ success: true, base64: result, mimeType: "image/png", vaultId: saved?.id });
  } catch (err: unknown) {
    res.status(500).json({ error: (err as Error).message });
  }
});

// ─── EXPAND / OUTPAINTING ─────────────────────────────────────────────────────
router.post("/freepik/expand", requireAdmin, async (req, res): Promise<void> => {
  try {
    if (!isFreepikAvailable()) { res.status(503).json({ error: "FREEPIK_API_KEY no configurada" }); return; }
    const { imageBase64, prompt, width, height, top, bottom, left, right, projectId, title } = req.body as Record<string, unknown>;
    if (!imageBase64 || !width || !height) { res.status(400).json({ error: "imageBase64, width y height requeridos" }); return; }

    const result = await expandFreepikImage({ imageBase64: String(imageBase64), prompt: prompt ? String(prompt) : undefined, width: Number(width), height: Number(height), top: top != null ? Number(top) : undefined, bottom: bottom != null ? Number(bottom) : undefined, left: left != null ? Number(left) : undefined, right: right != null ? Number(right) : undefined });
    const saved = await saveToVault({ projectId: projectId ? Number(projectId) : 0, title: String(title ?? "Imagen Expandida"), fileType: "freepik-expand", generatedBy: "freepik:expand", content: result, mimeType: "image/jpeg", fileSizeBytes: Buffer.from(result, "base64").length }).catch(() => null);
    res.json({ success: true, base64: result, mimeType: "image/jpeg", vaultId: saved?.id });
  } catch (err: unknown) {
    res.status(500).json({ error: (err as Error).message });
  }
});

// ─── MODELO VIRTUAL ───────────────────────────────────────────────────────────
router.post("/freepik/virtual-model", requireAdmin, async (req, res): Promise<void> => {
  try {
    if (!isFreepikAvailable()) { res.status(503).json({ error: "FREEPIK_API_KEY no configurada" }); return; }
    const { faceImageBase64, garmentImageBase64, prompt, num_images = 1, projectId, title } = req.body as Record<string, unknown>;
    if (!faceImageBase64 || !prompt) { res.status(400).json({ error: "faceImageBase64 y prompt requeridos" }); return; }

    const results = await freepikVirtualModel({ faceImageBase64: String(faceImageBase64), garmentImageBase64: garmentImageBase64 ? String(garmentImageBase64) : undefined, prompt: String(prompt), num_images: Number(num_images) });
    const saved = await Promise.all(results.map(async (img, i) =>
      saveToVault({ projectId: projectId ? Number(projectId) : 0, title: `${title ?? "Virtual Model"} (${i + 1})`, fileType: "freepik-virtual-model", generatedBy: "freepik:virtual-model", content: img.base64, mimeType: img.mimeType, fileSizeBytes: Buffer.from(img.base64, "base64").length }).catch(() => null)
    ));
    res.json({ success: true, images: results.map((img, i) => ({ base64: img.base64, mimeType: img.mimeType, vaultId: saved[i]?.id })) });
  } catch (err: unknown) {
    res.status(500).json({ error: (err as Error).message });
  }
});

// ─── GENERACIÓN DE VÍDEO ──────────────────────────────────────────────────────
router.post("/freepik/video", requireAdmin, async (req, res): Promise<void> => {
  try {
    if (!isFreepikAvailable()) { res.status(503).json({ error: "FREEPIK_API_KEY no configurada" }); return; }
    const { prompt, negative_prompt, image_url, image_tail_url, aspect_ratio, duration, engine, wait = false } = req.body as Record<string, unknown>;
    if (!prompt) { res.status(400).json({ error: "prompt requerido" }); return; }

    const taskIdOrUrl = await generateFreepikVideoTask({
      prompt: String(prompt),
      negative_prompt: negative_prompt ? String(negative_prompt) : undefined,
      image_url: image_url ? String(image_url) : undefined,
      image_tail_url: image_tail_url ? String(image_tail_url) : undefined,
      aspect_ratio: (aspect_ratio as "16:9" | "9:16" | "1:1") ?? "16:9",
      duration: duration ? (Number(duration) as 5 | 10) : 5,
      engine: engine ? String(engine) : undefined,
    });

    // Si es una URL directa (vídeo ya disponible)
    if (taskIdOrUrl.startsWith("http")) {
      res.json({ success: true, status: "completed", video_url: taskIdOrUrl });
      return;
    }

    // Es un task_id — si wait=true, hacer polling; si no, devolver task_id para polling manual
    if (wait) {
      const videoUrl = await pollFreepikVideoTask(taskIdOrUrl);
      res.json({ success: true, status: "completed", task_id: taskIdOrUrl, video_url: videoUrl });
    } else {
      res.json({ success: true, status: "pending", task_id: taskIdOrUrl, poll_url: `/api/freepik/video-status/${taskIdOrUrl}` });
    }
  } catch (err: unknown) {
    logger.error({ err: (err as Error).message }, "Freepik video error");
    res.status(500).json({ error: (err as Error).message });
  }
});

router.get("/freepik/video-status/:taskId", requireAdmin, async (req, res): Promise<void> => {
  try {
    if (!isFreepikAvailable()) { res.status(503).json({ error: "FREEPIK_API_KEY no configurada" }); return; }
    const videoUrl = await pollFreepikVideoTask(req.params.taskId, 30_000); // short poll
    res.json({ success: true, status: "completed", video_url: videoUrl });
  } catch (err: unknown) {
    if ((err as Error).message.includes("timeout")) {
      res.json({ success: true, status: "pending", message: "Aún procesando, vuelve a intentarlo" });
    } else {
      res.status(500).json({ error: (err as Error).message });
    }
  }
});

// ─── BÚSQUEDA EN STOCK ────────────────────────────────────────────────────────
router.get("/freepik/search", requireAdmin, async (req, res): Promise<void> => {
  try {
    if (!isFreepikAvailable()) { res.status(503).json({ error: "FREEPIK_API_KEY no configurada" }); return; }
    const { q, type, limit = "20", page = "1", orientation, color } = req.query as Record<string, string>;
    if (!q) { res.status(400).json({ error: "q (query) requerido" }); return; }

    const results = await searchFreepikStock(q, {
      type: type as "photo" | "vector" | "psd" | "icon" | "video" | undefined,
      limit: Number(limit),
      page:  Number(page),
      orientation: orientation as "horizontal" | "vertical" | "square" | undefined,
      color,
    });
    res.json({ results, total: results.length });
  } catch (err: unknown) {
    res.status(500).json({ error: (err as Error).message });
  }
});

export default router;
