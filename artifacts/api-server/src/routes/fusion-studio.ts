import { Router, type Request, type Response } from "express";
import { analyzeImageForFusion } from "../lib/fusion-studio.js";
import { learnFromOperation } from "../lib/claude.js";
import { saveToVault } from "../lib/vault.js";
import { db, projectsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { logger } from "../lib/logger.js";
import multer from "multer";

const router = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 20 * 1024 * 1024, files: 5 } });

router.post("/fusion-studio/analyze", upload.array("images", 5), async (req: Request, res: Response) => {
  try {
    const files = req.files as Express.Multer.File[] | undefined;
    if (!files || files.length === 0) {
      res.status(400).json({ error: "Se requiere al menos 1 imagen" });
      return;
    }

    const projectId = parseInt(req.body.projectId || "0");
    const niche = req.body.niche || undefined;
    const brandTone = req.body.brandTone || undefined;

    const mainImage = files[0];
    const mainBase64 = mainImage.buffer.toString("base64");

    const additionalImages = files.slice(1).map(f => ({
      base64: f.buffer.toString("base64"),
      mimeType: f.mimetype,
    }));

    logger.info({ imageCount: files.length, projectId }, "Fusion Studio: Starting analysis");

    const analysis = await analyzeImageForFusion(
      mainBase64, mainImage.mimetype, additionalImages,
      { niche, brandTone }
    );

    let vaultId: number | null = null;
    if (projectId > 0) {
      vaultId = await saveToVault({
        projectId,
        fileType: "fusion-studio-analysis",
        category: "fusion-studio",
        title: `Fusion Studio: ${analysis.product?.category ?? "producto"} — ${analysis.product?.subcategory ?? ""}`,
        description: `Análisis completo: ${analysis.layers?.length ?? 0} capas, ${analysis.textures?.length ?? 0} texturas, ${analysis.colors?.palette?.length ?? 0} colores`,
        mimeType: "application/json",
        generatedBy: "fusion-studio",
        content: JSON.stringify(analysis, null, 2),
        metadata: { imageCount: files.length },
      });
    }

    res.json({ success: true, analysis, vaultId });
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : "Error en análisis Fusion Studio";
    logger.error({ err }, "Fusion Studio analysis failed");
    res.status(500).json({ error: errMsg });
  }
});

router.post("/fusion-studio/create-product", upload.array("images", 5), async (req: Request, res: Response) => {
  try {
    const files = req.files as Express.Multer.File[] | undefined;
    if (!files || files.length === 0) {
      res.status(400).json({ error: "Se requiere al menos 1 imagen del producto" });
      return;
    }

    const projectId = parseInt(req.body.projectId || "0");
    if (!projectId) { res.status(400).json({ error: "projectId requerido" }); return; }

    const [project] = await db.select().from(projectsTable).where(eq(projectsTable.id, projectId));
    if (!project) { res.status(404).json({ error: "Proyecto no encontrado" }); return; }

    const mainBase64 = files[0].buffer.toString("base64");
    const additionalImages = files.slice(1).map(f => ({
      base64: f.buffer.toString("base64"),
      mimeType: f.mimetype,
    }));

    const analysis = await analyzeImageForFusion(
      mainBase64, files[0].mimetype, additionalImages,
      { niche: project.storeNiche ?? undefined, brandTone: undefined }
    );

    const { getProjectConnector } = await import("../lib/platform-helper.js");
    const connector = await getProjectConnector(projectId);
    if (!connector || !connector.supportsFeature("product_create")) {
      res.status(400).json({ error: "Plataforma no soporta creación de productos" });
      return;
    }

    const pg = analysis.productGeneration;
    const createdProduct = await connector.createProduct({
      title: pg.suggestedTitle,
      bodyHtml: pg.suggestedDescription,
      productType: analysis.product?.subcategory || analysis.product?.category || "",
      tags: pg.suggestedTags.join(", "),
      price: pg.suggestedPrice?.replace(/[^0-9.]/g, "") || null,
      images: [],
      variants: [{ platformId: "", title: "Default", price: pg.suggestedPrice?.replace(/[^0-9.]/g, "") || "0" }],
    });

    for (const file of files) {
      try {
        const dataUrl = `data:${file.mimetype};base64,${file.buffer.toString("base64")}`;
        await connector.uploadImage(createdProduct.platformId, dataUrl, pg.suggestedTitle);
      } catch (imgErr) {
        logger.warn({ err: imgErr }, "Failed to upload image to product");
      }
    }

    await saveToVault({
      projectId,
      fileType: "fusion-studio-product",
      category: "fusion-studio",
      title: `Producto Fusion: ${pg.suggestedTitle}`,
      mimeType: "application/json",
      generatedBy: "fusion-studio",
      content: JSON.stringify({ analysis, createdProduct }, null, 2),
    });

    learnFromOperation({
      operationType: "fusion_studio_create_product",
      niche: project.storeNiche ?? null,
      title: `Fusion Studio → Producto: ${pg.suggestedTitle}`,
      content: `Producto creado via Fusion Studio. Categoría: ${analysis.product?.category}. Materiales: ${analysis.textures?.map(t => t.material).join(", ")}. Precio sugerido: ${pg.suggestedPrice}. Tags: ${pg.suggestedTags.slice(0, 5).join(", ")}.`,
      confidence: 0.88,
      tags: ["fusion-studio", "product-creation", analysis.product?.category ?? "general"],
    });

    res.json({
      success: true,
      product: createdProduct,
      analysis,
      message: `Producto "${pg.suggestedTitle}" creado con ${files.length} imágenes`,
    });
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : "Error creando producto";
    logger.error({ err }, "Fusion Studio create-product failed");
    res.status(500).json({ error: errMsg });
  }
});

export default router;
