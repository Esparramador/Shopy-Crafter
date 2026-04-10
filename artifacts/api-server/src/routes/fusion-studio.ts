import { Router, type Request, type Response } from "express";
import { analyzeImageForFusion, researchBrandForFusion, autoSuggestPhotoSettings } from "../lib/fusion-studio.js";
import { learnFromOperation } from "../lib/claude.js";
import { saveToVault } from "../lib/vault.js";
import { db, projectsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { logger } from "../lib/logger.js";
import multer from "multer";
import { enableLongRunning } from "../lib/long-running.js";

const router = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 20 * 1024 * 1024, files: 10 } });

router.post("/fusion-studio/analyze", upload.array("images", 5), async (req: Request, res: Response) => {
  enableLongRunning(res);
  
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
  enableLongRunning(res);
  
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

router.post("/fusion-studio/brand-research", async (req: Request, res: Response) => {
  enableLongRunning(res);

  try {
    const { url, instagram, companyName, niche, brandStyle, colors } = req.body;

    if (!url && !instagram && !companyName) {
      res.status(400).json({ error: "Proporciona al menos URL, Instagram o nombre de empresa" });
      return;
    }

    logger.info({ url, instagram, companyName, niche }, "Fusion Studio: Starting brand research");

    const brandDna = await researchBrandForFusion({ url, instagram, companyName, niche, brandStyle, colors });

    learnFromOperation({
      operationType: "fusion_studio_brand_research",
      title: `Brand research: ${companyName || instagram || url}`,
      content: `Fusion Studio brand DNA: ${JSON.stringify(brandDna).substring(0, 500)}`,
      confidence: 0.85,
      tags: ["fusion-studio", "brand-research", companyName || instagram || "unknown"],
    });

    res.json({ success: true, brandDna });
  } catch (err) {
    logger.error({ err }, "Fusion Studio brand research failed");
    res.status(500).json({ error: err instanceof Error ? err.message : "Error en investigación de marca" });
  }
});

router.post("/fusion-studio/auto-suggest", async (req: Request, res: Response) => {
  enableLongRunning(res);

  try {
    const { productAnalysis, brandDna } = req.body;
    if (!productAnalysis) {
      res.status(400).json({ error: "productAnalysis requerido" });
      return;
    }
    const suggestions = await autoSuggestPhotoSettings(productAnalysis, brandDna);
    res.json({ success: true, suggestions });
  } catch (err) {
    logger.error({ err }, "Fusion Studio auto-suggest failed");
    res.status(500).json({ error: err instanceof Error ? err.message : "Error en sugerencias" });
  }
});

router.post("/fusion-studio/generate-photos", upload.array("images", 10), async (req: Request, res: Response) => {
  enableLongRunning(res);

  try {
    const files = req.files as Express.Multer.File[] | undefined;
    if (!files || files.length === 0) {
      res.status(400).json({ error: "Se requiere al menos 1 imagen" });
      return;
    }

    const {
      projectId,
      modes,
      lighting,
      background,
      perspective,
      quantity,
      brandDna,
      extraPrompt,
      outputFormat,
      customScene,
      hasModel,
    } = req.body;

    let parsedModes: string[];
    try {
      parsedModes = typeof modes === "string" ? JSON.parse(modes) : modes;
    } catch {
      res.status(400).json({ error: "modes debe ser un JSON array válido" });
      return;
    }
    if (!Array.isArray(parsedModes) || parsedModes.length === 0) {
      res.status(400).json({ error: "Se requiere al menos 1 modo de foto" });
      return;
    }

    let parsedBrandDna: any = null;
    try {
      parsedBrandDna = brandDna ? (typeof brandDna === "string" ? JSON.parse(brandDna) : brandDna) : null;
    } catch {
      parsedBrandDna = null;
    }

    const qty = Math.min(Math.max(parseInt(quantity || "1") || 1, 1), 4);
    const pid = parseInt(projectId || "0") || 0;

    logger.info({
      modes: parsedModes, lighting, background, quantity: qty,
      hasModel: hasModel === "true", imageCount: files.length
    }, "Fusion Studio: Starting photo generation");

    const productFiles = hasModel === "true" ? files.slice(0, -1) : files;
    if (productFiles.length === 0) {
      res.status(400).json({ error: "Se requiere al menos 1 imagen de producto (separada de la imagen del modelo)" });
      return;
    }

    const mainBase64 = productFiles[0].buffer.toString("base64");
    const additionalImages = productFiles.slice(1).map(f => ({
      base64: f.buffer.toString("base64"),
      mimeType: f.mimetype,
    }));

    const analysis = await analyzeImageForFusion(
      mainBase64, productFiles[0].mimetype, additionalImages,
      { niche: parsedBrandDna?.sector, brandTone: parsedBrandDna?.style }
    );

    const sceneType = analysis.sceneClassification?.type || "product_only";
    const componentsList = (analysis.componentBreakdown || []).map(c => `${c.partName} (${c.material})`).join(", ");
    const visualDna = analysis.visualDna || { styleFingerprint: "", moodBoard: [], photographySchool: "", editingStyle: "", emotionalTone: "", luxuryScore: 5 };

    const brandBlock = parsedBrandDna ? `
[BRAND DNA — EVERY generated photo MUST reflect this brand identity]
Brand: ${parsedBrandDna.brandInfo?.name || ""}
Style: ${parsedBrandDna.brandInfo?.style || ""}
Colors: ${JSON.stringify(parsedBrandDna.brandInfo?.colors || [])}
Photography ref: ${parsedBrandDna.instagramInfo?.photoLighting || ""}, ${parsedBrandDna.instagramInfo?.photoBackgrounds?.join(", ") || ""}
Competitor photo standards: ${parsedBrandDna.competitorPhotography?.competitors?.map((c: any) => c.photoStyle).join("; ") || ""}
` : "";

    const visualDnaBlock = visualDna ? `
[VISUAL DNA — Preserve this aesthetic fingerprint]
Style: ${visualDna.styleFingerprint || ""}
Photography school: ${visualDna.photographySchool || ""}
Editing: ${visualDna.editingStyle || ""}
Mood: ${visualDna.moodBoard?.join(", ") || ""}
Emotional tone: ${visualDna.emotionalTone || ""}
Luxury level: ${visualDna.luxuryScore || 5}/10
` : "";

    const foodProtocol = analysis.foodAnalysis?.detected ? `
[FOOD PHOTOGRAPHY PROTOCOL — CRITICAL]
Cuisine: ${analysis.foodAnalysis.cuisineType}. Dish: ${analysis.foodAnalysis.dishName}.
Ingredients: ${analysis.foodAnalysis.ingredients?.join(", ")}.
Cooking: ${analysis.foodAnalysis.cookingTechnique}. Plating: ${analysis.foodAnalysis.plating}.
Temperature: ${analysis.foodAnalysis.temperature}. Garnishes: ${analysis.foodAnalysis.garnishes?.join(", ")}.
RULES: Food MUST look appetizing, fresh, and at the right temperature. Show steam if hot, frost if cold.
Ingredients must be identifiable. Colors must be vibrant and natural. No artificial-looking food.
` : "";

    const modelProtocol = analysis.modelAnalysis?.detected || hasModel === "true" ? `
[CRITICAL MODEL + PRODUCT PROTOCOL]
Image 1 = PRODUCT (${analysis.product?.category} — ${componentsList}).
Last image = MODEL.
${analysis.modelAnalysis ? `Model reference: ${analysis.modelAnalysis.gender}, ${analysis.modelAnalysis.ageRange}, ${analysis.modelAnalysis.pose}` : ""}
ABSOLUTE RULES:
- The MODEL holds/wears/uses the PRODUCT naturally. They INTERACT, never FUSE.
- Product keeps EXACT shape, EXACT materials (${analysis.textures?.map(t => `${t.material}/${t.finish}`).join(", ")}), EXACT colors (${analysis.colors?.dominant?.join(", ")})
- Person: anatomically correct — 5 fingers per hand, natural proportions, realistic skin
- NEVER merge product into body or body into product
- Product components preserved: ${componentsList}
` : "";

    const subjectProtocol = hasModel === "true" || analysis.modelAnalysis?.detected ? modelProtocol : `
[PRODUCT INTEGRITY PROTOCOL]
Scene type: ${sceneType}
Product: ${analysis.product?.category} — ${analysis.product?.subcategory}
Components (preserve ALL): ${componentsList}
Materials (preserve EXACT): ${analysis.textures?.map(t => `${t.material}/${t.finish}`).join(", ")}
Colors (preserve EXACT): ${analysis.colors?.dominant?.join(", ")}
Quality level: ${analysis.product?.qualityLevel || "premium"}
Manufacturing: ${analysis.product?.manufacturingProcess || "professional"}
Only the ENVIRONMENT changes — the product itself remains IDENTICAL to the reference.
`;

    const generationPlan = parsedModes.flatMap((mode: string) =>
      Array.from({ length: qty }, (_, i) => ({
        mode,
        index: i,
        prompt: `${subjectProtocol}${foodProtocol}${brandBlock}${visualDnaBlock}
[PHOTO MODE: ${mode}]
[LIGHTING: ${lighting}]
[BACKGROUND: ${background === "scene-custom" ? customScene : background}]
[PERSPECTIVE: ${perspective}]
${extraPrompt ? `[ADDITIONAL DIRECTION: ${extraPrompt}]` : ""}
[OUTPUT SIZE: ${outputFormat || "1024x1024"}]
Generate a world-class professional ${mode} photograph. Think Apple, Vogue, Bon Appétit quality.`,
      }))
    );

    if (pid > 0) {
      await saveToVault({
        projectId: pid,
        fileType: "fusion-studio-session",
        category: "fusion-studio",
        title: `Fusion Session: ${analysis.product?.category} — ${parsedModes.length} modos × ${qty}`,
        mimeType: "application/json",
        generatedBy: "fusion-studio",
        content: JSON.stringify({ analysis, brandDna: parsedBrandDna, generationPlan, settings: { lighting, background, perspective, quantity: qty } }, null, 2),
        metadata: { modes: parsedModes, photoCount: generationPlan.length },
      });
    }

    res.json({
      success: true,
      analysis,
      generationPlan,
      totalPhotos: generationPlan.length,
      settings: { lighting, background, perspective, quantity: qty, outputFormat },
    });
  } catch (err) {
    logger.error({ err }, "Fusion Studio generate-photos failed");
    res.status(500).json({ error: err instanceof Error ? err.message : "Error generando fotos" });
  }
});

export default router;
