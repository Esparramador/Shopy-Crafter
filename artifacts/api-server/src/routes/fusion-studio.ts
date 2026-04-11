import { Router, type Request, type Response } from "express";
import { analyzeImageForFusion, researchBrandForFusion, autoSuggestPhotoSettings, detectGarmentSides, getGarmentCategory, buildModelPersonPrompt } from "../lib/fusion-studio.js";
import { askClaudeWithBrain, learnFromOperation } from "../lib/claude.js";
import { saveToVault } from "../lib/vault.js";
import { db, projectsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { logger } from "../lib/logger.js";
import multer from "multer";
import { enableLongRunning } from "../lib/long-running.js";
import { MODEL_MAP, COST_MAP, NEGATIVE_PROMPT } from "./images.js";
import { safeDecrypt } from "../lib/crypto.js";
import { checkProductionLimit, recordUsage } from "../lib/plan-limits.js";

const REPLICATE_TIMEOUT_MS = 5 * 60_000;
const TRYON_MODES = new Set(["tryon-front", "tryon-back", "tryon-lifestyle"]);
const TRYON_MODEL_COST = 0.04;
const TRYON_GARMENT_COST = 0.05;

function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  const timeout = new Promise<never>((_, reject) =>
    setTimeout(() => reject(new Error(`Timeout ${ms / 1000}s: ${label}`)), ms)
  );
  return Promise.race([promise, timeout]);
}

const FUSION_MODEL_MAP: Record<string, string> = {
  "hero": "black-forest-labs/flux-1.1-pro",
  "lifestyle": "black-forest-labs/flux-1.1-pro",
  "detail": "black-forest-labs/flux-dev",
  "flat-lay": "black-forest-labs/flux-1.1-pro",
  "model-fashion": "black-forest-labs/flux-1.1-pro",
  "model-holding": "black-forest-labs/flux-1.1-pro",
  "model-using": "black-forest-labs/flux-1.1-pro",
  "scale": "black-forest-labs/flux-dev",
  "packaging": "recraft-ai/recraft-v3",
  "multi-angle": "black-forest-labs/flux-1.1-pro",
  "ambient": "black-forest-labs/flux-1.1-pro",
  "ugc": "recraft-ai/recraft-v3",
  "social-ig": "black-forest-labs/flux-1.1-pro",
  "social-story": "black-forest-labs/flux-1.1-pro",
  "banner": "black-forest-labs/flux-1.1-pro",
  "comparison": "black-forest-labs/flux-dev",
};

const FORMAT_SIZE: Record<string, { width: number; height: number }> = {
  "1024x1024": { width: 1024, height: 1024 },
  "1024x1536": { width: 1024, height: 1536 },
  "1536x1024": { width: 1536, height: 1024 },
  "1440x1440": { width: 1440, height: 1440 },
  "1080x1350": { width: 1080, height: 1350 },
  "1080x1920": { width: 1080, height: 1920 },
  "1920x1080": { width: 1920, height: 1080 },
};

function getOutputSize(mode: string, format: string): { width: number; height: number } {
  if (format && FORMAT_SIZE[format]) return FORMAT_SIZE[format];
  if (mode === "social-story") return { width: 1080, height: 1920 };
  if (mode === "banner") return { width: 1920, height: 1080 };
  if (mode === "social-ig") return { width: 1080, height: 1080 };
  return { width: 1440, height: 1440 };
}

function isFashionProduct(analysis: any): boolean {
  const cat = `${analysis.product?.category ?? ""} ${analysis.product?.subcategory ?? ""}`.toLowerCase();
  return !!(
    analysis.sceneClassification?.isFashion ||
    cat.match(/apparel|fashion|clothing|ropa|moda|camiset|t-shirt|shirt|hoodie|jacket|sweater|polo|vest|pantal|jeans|shorts|dress|vestido/)
  );
}

function extractUrl(val: unknown): string {
  if (typeof val === "string") return val;
  if (val && typeof val === "object") {
    const s = val.toString();
    if (s.startsWith("http")) return s;
    if (typeof (val as any).url === "function") {
      const u = (val as any).url();
      return u?.href ?? String(u);
    }
    if (typeof (val as any).url === "string") return (val as any).url;
  }
  return String(val);
}

async function replicateWithRetry(fn: () => Promise<unknown>, label: string, maxRetries = 5): Promise<unknown> {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      const isRetryable = msg.includes("429") || msg.includes("500") || msg.includes("502") || msg.includes("503") || msg.includes("529") || msg.includes("overloaded") || msg.includes("rate");
      if (isRetryable && attempt < maxRetries) {
        const delay = Math.min(15_000 * attempt, 60_000);
        logger.warn({ attempt, maxRetries, delay, label, errorSnippet: msg.slice(0, 120) }, "Fusion Studio: Replicate transient error, retrying");
        await new Promise(r => setTimeout(r, delay));
        continue;
      }
      throw err;
    }
  }
  throw new Error(`${label}: max retries exceeded`);
}

async function generateModelPerson(
  replicate: any,
  prompt: string,
  width: number,
  height: number,
): Promise<string> {
  logger.info({ promptPreview: prompt.slice(0, 100) }, "Fusion Studio TryOn: Generating AI model person");
  const output = await replicateWithRetry(
    () => withTimeout(
      replicate.run("black-forest-labs/flux-1.1-pro" as `${string}/${string}`, {
        input: {
          prompt,
          width: Math.min(width, 1024),
          height: Math.min(height, 1536),
          num_outputs: 1,
          output_format: "png",
          output_quality: 95,
        },
      }),
      REPLICATE_TIMEOUT_MS,
      "Flux model-person generation",
    ),
    "generateModelPerson",
  );
  const raw = Array.isArray(output) ? output[0] : output;
  const url = extractUrl(raw);
  if (!url?.startsWith("http")) throw new Error(`Invalid model person URL: ${String(raw).slice(0, 200)}`);
  logger.info({ url: url.slice(0, 80) }, "Fusion Studio TryOn: Model person generated");
  return url;
}

async function applyVirtualTryon(
  replicate: any,
  modelImageUrl: string,
  garmentDataUri: string,
  category: "tops" | "bottoms" | "one-pieces",
  garmentDescription?: string,
): Promise<string> {
  const catMap: Record<string, string> = { tops: "upper_body", bottoms: "lower_body", "one-pieces": "dresses" };
  const idmCategory = catMap[category] || "upper_body";

  logger.info({ category: idmCategory }, "Fusion Studio TryOn: Applying virtual try-on via IDM-VTON");
  const output = await replicateWithRetry(
    () => withTimeout(
      replicate.run("cuuupid/idm-vton:0513734a452173b8173e907e3a59d19a36266e55b48528559432bd21c7d7e985" as `${string}/${string}:${string}`, {
        input: {
          human_img: modelImageUrl,
          garm_img: garmentDataUri,
          garment_des: garmentDescription || "Short sleeve t-shirt",
          category: idmCategory,
          crop: true,
          steps: 30,
          seed: 42,
        },
      }),
      REPLICATE_TIMEOUT_MS,
      "IDM-VTON virtual try-on",
    ),
    "applyVirtualTryon",
  );
  const raw = Array.isArray(output) ? output[0] : output;
  const url = extractUrl(raw);
  if (!url?.startsWith("http")) throw new Error(`Invalid try-on URL: ${String(raw).slice(0, 200)}`);
  logger.info({ url: url.slice(0, 80) }, "Fusion Studio TryOn: Virtual try-on complete");
  return url;
}

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
      res.status(400).json({ error: "Se requiere al menos 1 imagen de producto" });
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

    const contextBlock = `${subjectProtocol}${foodProtocol}${brandBlock}${visualDnaBlock}`;

    const regularModes = parsedModes.filter((m: string) => !TRYON_MODES.has(m));
    const tryonModesSelected = parsedModes.filter((m: string) => TRYON_MODES.has(m));

    const generationPlan = regularModes.flatMap((mode: string) =>
      Array.from({ length: qty }, (_, i) => ({
        mode,
        index: i,
        contextPrompt: `${contextBlock}
[PHOTO MODE: ${mode}]
[LIGHTING: ${lighting}]
[BACKGROUND: ${background === "scene-custom" ? customScene : background}]
[PERSPECTIVE: ${perspective}]
${extraPrompt ? `[ADDITIONAL DIRECTION: ${extraPrompt}]` : ""}
[OUTPUT SIZE: ${outputFormat || "1024x1024"}]
Generate a world-class professional ${mode} photograph. Think Apple, Vogue, Bon Appétit quality.`,
      }))
    );

    const tryonPlan = tryonModesSelected.flatMap((mode: string) =>
      Array.from({ length: qty }, (_, i) => ({ mode, index: i }))
    );

    const totalPhotos = generationPlan.length + tryonPlan.length;

    let project: { replicateApiToken: string | null; storeNiche: string | null; brandTone: string | null } | null = null;
    if (pid > 0) {
      const [p] = await db.select().from(projectsTable).where(eq(projectsTable.id, pid));
      project = p ?? null;
    }

    if (!project?.replicateApiToken) {
      logger.warn("Fusion Studio: No Replicate token — returning plan only");
      res.json({
        success: true,
        analysis,
        generationPlan: [...generationPlan.map(p => ({ mode: p.mode, index: p.index, prompt: p.contextPrompt })), ...tryonPlan.map(p => ({ mode: p.mode, index: p.index, prompt: `Virtual try-on: ${p.mode}` }))],
        generatedImages: [],
        totalPhotos,
        settings: { lighting, background, perspective, quantity: qty, outputFormat },
        warning: "No hay token de Replicate configurado — solo se generó el plan de fotos sin imágenes reales. Configura tu Replicate API token en Ajustes del proyecto.",
      });
      return;
    }

    const limitCheck = await checkProductionLimit(pid, "image", totalPhotos);
    if (!limitCheck.allowed) {
      res.json({
        success: true,
        analysis,
        generationPlan: generationPlan.map(p => ({ mode: p.mode, index: p.index, prompt: p.contextPrompt })),
        generatedImages: [],
        totalPhotos,
        settings: { lighting, background, perspective, quantity: qty, outputFormat },
        warning: `Límite de imágenes alcanzado: ${limitCheck.reason}`,
      });
      return;
    }

    const Replicate = (await import("replicate")).default;
    const replicateToken = safeDecrypt(project.replicateApiToken!) || project.replicateApiToken!;
    const replicate = new Replicate({ auth: replicateToken });

    const generatedImages: Array<{
      mode: string;
      index: number;
      imageUrl: string | null;
      prompt: string;
      model: string;
      cost: number;
      error?: string;
      tryonPipeline?: boolean;
    }> = [];

    if (tryonPlan.length > 0 && isFashionProduct(analysis)) {
      logger.info({ tryonModes: tryonModesSelected, tryonCount: tryonPlan.length }, "Fusion Studio TryOn: Starting virtual try-on pipeline");

      const garmentSides = await detectGarmentSides(
        productFiles.map(f => ({ buffer: f.buffer, mimetype: f.mimetype })),
        analysis.product?.category,
      );
      const garmentCat = getGarmentCategory(analysis.product?.category || "", analysis.product?.subcategory || "");

      const frontIndex = garmentSides.find(s => s.side === "front")?.imageIndex ?? 0;
      const backIndex = garmentSides.find(s => s.side === "back")?.imageIndex ?? (productFiles.length > 1 ? 1 : 0);

      logger.info({ frontIndex, backIndex, garmentCat, sides: garmentSides }, "Fusion Studio TryOn: Garment sides mapped");

      const modelFile = hasModel === "true" && files.length > productFiles.length
        ? files[files.length - 1] : null;

      for (const item of tryonPlan) {
        try {
          const isFrontView = item.mode !== "tryon-back";
          const garmentFileIdx = isFrontView ? frontIndex : backIndex;
          const garmentFile = productFiles[garmentFileIdx] || productFiles[0];
          const garmentDataUri = `data:${garmentFile.mimetype};base64,${garmentFile.buffer.toString("base64")}`;

          let modelImageUrl: string;
          if (modelFile) {
            modelImageUrl = `data:${modelFile.mimetype};base64,${modelFile.buffer.toString("base64")}`;
            logger.info("Fusion Studio TryOn: Using uploaded model photo");
          } else {
            const modelPrompt = buildModelPersonPrompt(item.mode, analysis, parsedBrandDna, extraPrompt || undefined);
            const size = getOutputSize(item.mode, outputFormat || "");
            modelImageUrl = await generateModelPerson(replicate, modelPrompt, size.width, size.height);
          }

          const garmentDesc = `${analysis.product?.category || "Garment"} - ${analysis.product?.subcategory || "clothing item"}`;
          const tryonUrl = await applyVirtualTryon(replicate, modelImageUrl, garmentDataUri, garmentCat, garmentDesc);
          const totalItemCost = (modelFile ? 0 : TRYON_MODEL_COST) + TRYON_GARMENT_COST;

          if (pid > 0) {
            await saveToVault({
              projectId: pid,
              fileType: "image",
              category: `fusion-${item.mode}`,
              title: `Fusion ${item.mode} — ${analysis.product?.category || "Producto"} (Virtual Try-On)`,
              originalUrl: tryonUrl,
              mimeType: "image/png",
              generatedBy: "fusion-studio-tryon",
              metadata: {
                model: "cuuupid/idm-vton",
                garmentSide: isFrontView ? "front" : "back",
                cost: totalItemCost,
                mode: item.mode,
                pipeline: "virtual-tryon",
              },
            });
          }

          generatedImages.push({
            mode: item.mode,
            index: item.index,
            imageUrl: tryonUrl,
            prompt: `Virtual try-on (${isFrontView ? "front" : "back"} garment)`,
            model: "fashn/tryon",
            cost: totalItemCost,
            tryonPipeline: true,
          });

          logger.info({ mode: item.mode, index: item.index, url: tryonUrl.slice(0, 80) }, "Fusion Studio TryOn: Try-on image complete");
        } catch (err) {
          logger.error({ mode: item.mode, err }, "Fusion Studio TryOn: Try-on generation failed");
          generatedImages.push({
            mode: item.mode,
            index: item.index,
            imageUrl: null,
            prompt: `Virtual try-on failed`,
            model: "fashn/tryon",
            cost: 0,
            error: err instanceof Error ? err.message : String(err),
            tryonPipeline: true,
          });
        }
      }
    } else if (tryonPlan.length > 0) {
      logger.warn("Fusion Studio: Try-on modes selected but product is not fashion — skipping try-on");
      for (const item of tryonPlan) {
        generatedImages.push({
          mode: item.mode,
          index: item.index,
          imageUrl: null,
          prompt: "",
          model: "fashn/tryon",
          cost: 0,
          error: "Virtual try-on solo funciona con productos de moda/ropa. Sube una prenda y selecciona estos modos.",
        });
      }
    }

    if (generationPlan.length > 0) {
      logger.info({ totalPhotos: generationPlan.length }, "Fusion Studio: Converting prompts to Replicate-ready via Claude");

      const replicatePrompts = await Promise.all(
        generationPlan.map(async (item) => {
          try {
            let prompt = await askClaudeWithBrain(
              pid,
              [{ role: "user", content: `Convert the following Fusion Studio art direction into a SINGLE, concise image generation prompt (max 200 words, English only). Output ONLY the prompt — no explanations:\n\n${item.contextPrompt}` }],
              "You are an expert image prompt engineer for Flux and Stable Diffusion models. Convert detailed art direction into concise, effective prompts. Include specific details: subject, lighting, composition, materials, colors, background. Always add: ultra high resolution 4K, commercial photography quality, sharp focus, professional color grading. Never include text, watermarks, or logos.",
              "images",
              project!.storeNiche ?? undefined,
              8192,
            );
            prompt = prompt.replace(/```[\s\S]*?```/g, "").replace(/```/g, "").replace(/^["']|["']$/g, "").replace(/^\*\*.*?\*\*\s*/gm, "").trim();
            if (prompt.length < 30) throw new Error("Prompt too short");
            return { ...item, replicatePrompt: prompt };
          } catch (err) {
            logger.warn({ mode: item.mode, err }, "Fusion Studio: Claude prompt conversion failed, using fallback");
            const productDesc = analysis.product?.category || "product";
            return {
              ...item,
              replicatePrompt: `Professional ${item.mode} photograph of ${productDesc}. ${lighting} lighting, ${background} background, ${perspective} perspective. Ultra high resolution 4K, commercial photography quality, sharp focus, professional color grading.`,
            };
          }
        })
      );

      logger.info({ totalPhotos: replicatePrompts.length }, "Fusion Studio: Generating images with Replicate");

      const MAX_PARALLEL = 3;

      for (let batch = 0; batch < replicatePrompts.length; batch += MAX_PARALLEL) {
        const chunk = replicatePrompts.slice(batch, batch + MAX_PARALLEL);
        const results = await Promise.allSettled(
          chunk.map(async (item) => {
            const model = FUSION_MODEL_MAP[item.mode] || "black-forest-labs/flux-1.1-pro";
            const cost = COST_MAP[model] ?? 0.04;
            const size = getOutputSize(item.mode, outputFormat || "");

            logger.info({ mode: item.mode, index: item.index, model }, "Fusion Studio: Generating image");

            const output = await replicateWithRetry(() => {
              let runPromise: Promise<unknown>;
              if (model.includes("flux-1.1-pro")) {
                runPromise = replicate.run(model as `${string}/${string}`, {
                  input: { prompt: item.replicatePrompt, negative_prompt: NEGATIVE_PROMPT, width: size.width, height: size.height, num_outputs: 1, output_format: "png", output_quality: 100 },
                });
              } else if (model.includes("recraft")) {
                runPromise = replicate.run(model as `${string}/${string}`, {
                  input: { prompt: item.replicatePrompt, size: `${size.width}x${size.height}`, style: "realistic_image" },
                });
              } else {
                runPromise = replicate.run(model as `${string}/${string}`, {
                  input: { prompt: item.replicatePrompt, negative_prompt: NEGATIVE_PROMPT, width: size.width, height: size.height, num_inference_steps: 35, guidance_scale: 3.5, output_format: "png" },
                });
              }
              return withTimeout(runPromise, REPLICATE_TIMEOUT_MS, `Replicate ${model} (${item.mode})`);
            }, `fusion-${item.mode}`);
            const raw = Array.isArray(output) ? output[0] : output;
            const imageUrl = extractUrl(raw);

            if (!imageUrl || !imageUrl.startsWith("http")) {
              throw new Error(`Invalid image URL: ${String(raw).slice(0, 200)}`);
            }

            logger.info({ mode: item.mode, index: item.index, url: imageUrl.slice(0, 80) }, "Fusion Studio: Image generated");

            if (pid > 0) {
              await saveToVault({
                projectId: pid,
                fileType: "image",
                category: `fusion-${item.mode}`,
                title: `Fusion ${item.mode} — ${analysis.product?.category || "Producto"}`,
                originalUrl: imageUrl,
                mimeType: "image/png",
                generatedBy: "fusion-studio",
                metadata: { model, prompt: item.replicatePrompt.slice(0, 500), cost, mode: item.mode },
              });
            }

            return { mode: item.mode, index: item.index, imageUrl, prompt: item.replicatePrompt, model, cost };
          })
        );

        for (const r of results) {
          if (r.status === "fulfilled") {
            generatedImages.push(r.value);
          } else {
            const failedItem = chunk[results.indexOf(r)];
            logger.error({ mode: failedItem?.mode, err: r.reason }, "Fusion Studio: Image generation failed");
            generatedImages.push({
              mode: failedItem?.mode || "unknown",
              index: failedItem?.index || 0,
              imageUrl: null,
              prompt: failedItem?.replicatePrompt || "",
              model: FUSION_MODEL_MAP[failedItem?.mode || "hero"] || "unknown",
              cost: 0,
              error: r.reason instanceof Error ? r.reason.message : String(r.reason),
            });
          }
        }
      }
    }

    const totalCost = generatedImages.reduce((sum, img) => sum + (img.imageUrl ? img.cost : 0), 0);
    const successCount = generatedImages.filter(i => i.imageUrl).length;

    if (pid > 0 && successCount > 0) {
      await recordUsage(pid, "image", successCount);
    }

    if (pid > 0) {
      await saveToVault({
        projectId: pid,
        fileType: "fusion-studio-session",
        category: "fusion-studio",
        title: `Fusion Session: ${analysis.product?.category} — ${successCount}/${totalPhotos} fotos generadas`,
        mimeType: "application/json",
        generatedBy: "fusion-studio",
        content: JSON.stringify({ analysis, brandDna: parsedBrandDna, generatedImages, settings: { lighting, background, perspective, quantity: qty } }, null, 2),
        metadata: { modes: parsedModes, photoCount: totalPhotos, successCount, totalCost, hasTryon: tryonPlan.length > 0 },
      });
    }

    learnFromOperation({
      operationType: "images",
      niche: project.storeNiche ?? null,
      productType: analysis.product?.category ?? null,
      title: `Fusion Studio session: ${successCount}/${totalPhotos} fotos${tryonPlan.length > 0 ? " (incl. try-on)" : ""}`,
      content: `Modos: ${parsedModes.join(", ")}. Modelos: ${[...new Set(generatedImages.map(i => i.model))].join(", ")}. Costo total: $${totalCost.toFixed(3)}`,
      confidence: successCount === totalPhotos ? 0.85 : 0.5,
      tags: ["fusion-studio", ...parsedModes, ...(tryonPlan.length > 0 ? ["virtual-tryon"] : [])],
    });

    logger.info({ successCount, totalPhotos, totalCost, tryonCount: tryonPlan.length }, "Fusion Studio: Generation complete");

    res.json({
      success: true,
      analysis,
      generatedImages,
      totalPhotos,
      successCount,
      totalCost,
      settings: { lighting, background, perspective, quantity: qty, outputFormat },
    });
  } catch (err) {
    logger.error({ err }, "Fusion Studio generate-photos failed");
    res.status(500).json({ error: err instanceof Error ? err.message : "Error generando fotos" });
  }
});

export default router;
