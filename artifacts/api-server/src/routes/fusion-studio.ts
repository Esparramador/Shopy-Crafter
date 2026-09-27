import { Router, type Request, type Response } from "express";
import { clientOwnsProjectId } from "../lib/access.js";
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
import { generateVideoFromImage as runwayGenerateVideo, type RunwayModel, type RunwayDuration, type RunwayRatio } from "../lib/runway.js";
import { generateNanoBanana } from "../lib/nano-banana.js";
import {
  fetchToBuffer,
  generateVideoFromImage as fspGenerateVideo,
  VIDEO_MODELS as FSP_VIDEO_MODELS,
  modelSupportsTextToVideo,
  type VideoModel as FSPVideoModel,
} from "../lib/fusion-studio-pro.js";

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

/**
 * REAL try-on for accessories (watches, glasses, jewelry, hats, shoes, bags…)
 * via Gemini Nano Banana (gemini-3.1-flash-image) multi-image fusion.
 *
 * IDM-VTON only supports tops/bottoms/dresses. For everything else we use
 * Nano Banana, which understands spatial relationships and can convincingly
 * place a watch on a wrist, glasses on a face, a necklace on a neck, etc.
 *
 * Inputs are buffers (model + product) so we can call Gemini directly.
 * Output is a public Replicate-hosted URL (we upload via vault) or a data URI.
 */
function buildAccessoryTryonPrompt(
  productCategory: string,
  productSubcategory: string,
  componentsList: string,
  materialsList: string,
  colorsList: string,
  mode: string,
  extraPrompt?: string,
): string {
  const cat = `${productCategory} ${productSubcategory}`.toLowerCase();
  let placement = `the model wears or uses the product (image 2) naturally as it would be worn in real life`;
  let bodyPart = "the appropriate body part";

  if (cat.match(/watch|reloj|smartwatch/)) {
    placement = `The model wears the watch from image 2 on their LEFT wrist. The watch strap is fastened naturally and the dial faces the camera. The wrist is slightly raised in a casual, elegant pose so the watch is the focal point.`;
    bodyPart = "wrist";
  } else if (cat.match(/glasses|sunglasses|gafas|lentes|eyewear|spectacle/)) {
    placement = `The model wears the glasses from image 2 on their face. The frames sit correctly on the bridge of the nose, the temples extend behind the ears, the lenses align with the eyes. Front-facing portrait so the glasses are clearly visible.`;
    bodyPart = "face";
  } else if (cat.match(/necklace|collar|pendant|chain|cadena|colgante/)) {
    placement = `The model wears the necklace from image 2 around their neck. The pendant or chain hangs naturally on the chest, perfectly centered. Slight neckline visible.`;
    bodyPart = "neck";
  } else if (cat.match(/earring|pendiente|aro/)) {
    placement = `The model wears the earrings from image 2. Show a 3/4 portrait so at least one earring is clearly visible on the earlobe. The other features remain natural.`;
    bodyPart = "ears";
  } else if (cat.match(/ring|anillo|sortija/)) {
    placement = `The model wears the ring from image 2 on the appropriate finger (typically ring finger or index). Hand pose elegant, fingers slightly relaxed, ring clearly visible to camera.`;
    bodyPart = "finger";
  } else if (cat.match(/bracelet|pulsera|bangle|brazalete/)) {
    placement = `The model wears the bracelet from image 2 on their wrist. Wrist slightly raised in a natural elegant pose so the bracelet is fully visible.`;
    bodyPart = "wrist";
  } else if (cat.match(/hat|cap|gorra|sombrero|beanie/)) {
    placement = `The model wears the hat from image 2 on their head, fitted naturally over the hair, brim or shape correctly oriented.`;
    bodyPart = "head";
  } else if (cat.match(/shoe|sneaker|boot|zapato|zapatilla|botas/)) {
    placement = `The model wears the shoes from image 2 on their feet. Show full body or leg-down composition so the shoes are clearly visible. Laces tied and shoes worn naturally.`;
    bodyPart = "feet";
  } else if (cat.match(/bag|bolso|backpack|mochila|purse|cartera|handbag/)) {
    placement = `The model carries the bag from image 2 — over the shoulder, in hand, or on the back as appropriate for the bag type. The bag is clearly visible and worn naturally.`;
    bodyPart = "shoulder/hand";
  } else if (cat.match(/scarf|bufanda|fular|tie|corbata/)) {
    placement = `The model wears the scarf/tie from image 2 around their neck, draped naturally with realistic fabric folds.`;
    bodyPart = "neck";
  } else if (cat.match(/belt|cintur/)) {
    placement = `The model wears the belt from image 2 around their waist, fastened naturally through belt loops. Composition shows the waist clearly.`;
    bodyPart = "waist";
  } else if (cat.match(/makeup|lipstick|maquillaje|perfume|fragrance|cosmetic/)) {
    placement = `The model holds the product from image 2 elegantly, applying it or showcasing it naturally next to their face. Beauty editorial composition.`;
    bodyPart = "hand near face";
  }

  const sceneMod = mode === "tryon-back"
    ? "Capture from a 3/4 BACK angle so the product is still visible from behind."
    : mode === "tryon-lifestyle"
      ? "Lifestyle setting (urban street, café, outdoor) with golden-hour natural light, candid pose."
      : "Studio portrait composition, soft professional lighting, clean neutral background.";

  return `Photorealistic virtual try-on / product placement.

Image 1 = MODEL (the person).
Image 2 = PRODUCT (${productCategory}${productSubcategory ? ` — ${productSubcategory}` : ""}).

Task: ${placement}

ABSOLUTE RULES:
- Preserve the MODEL's identity, face, skin tone, hair and body proportions from image 1 EXACTLY.
- Preserve the PRODUCT's exact shape, materials (${materialsList}), colors (${colorsList}), components (${componentsList}) from image 2.
- Anatomically correct: 5 fingers per hand, natural proportions, realistic skin and shadows.
- The product is placed/worn on ${bodyPart} — never fused into the body, never floating, never deformed.
- Realistic contact shadows where the product touches the model.
- ${sceneMod}
- Output: ultra-high resolution, sharp focus, commercial fashion/lifestyle photography quality, professional color grading.
- Preserve EVERY existing letter, logo, dial marking and brand printed on the product (image 2) EXACTLY as visible — do not warp, morph or alter them. Do NOT add any new text, new logos, captions or watermarks to the scene.${extraPrompt ? `\n- Additional direction: ${extraPrompt}` : ""}`;
}

async function applyAccessoryTryon(
  modelImageBuffer: Buffer,
  modelMimeType: string,
  productImageBuffer: Buffer,
  productMimeType: string,
  productCategory: string,
  productSubcategory: string,
  componentsList: string,
  materialsList: string,
  colorsList: string,
  mode: string,
  replicateToken: string,
  extraPrompt?: string,
  aspectRatio: string = "3:4",
): Promise<{ buffer: Buffer; mimeType: string; provider: string }> {
  const prompt = buildAccessoryTryonPrompt(productCategory, productSubcategory, componentsList, materialsList, colorsList, mode, extraPrompt);

  logger.info({
    category: productCategory,
    promptLen: prompt.length,
    aspectRatio,
  }, "Fusion Studio TryOn: Applying REAL accessory try-on via Nano Banana multi-image fusion");

  const result = await generateNanoBanana(prompt, {
    aspectRatio,
    references: [
      { buffer: modelImageBuffer, mimeType: modelMimeType },
      { buffer: productImageBuffer, mimeType: productMimeType },
    ],
    replicateToken,
    outputFormat: "png",
  });

  logger.info({ provider: result.provider, bytes: result.buffer.length }, "Fusion Studio TryOn: Accessory try-on complete");
  return result;
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

    const projectId = parseInt(req.body.projectId ?? "", 10);
    if (isNaN(projectId)) { res.status(400).json({ error: "projectId requerido" }); return; }

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
      referenceStyles,
      engineOverride,
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

    let parsedRefStyles: string[] = [];
    try {
      parsedRefStyles = referenceStyles ? (typeof referenceStyles === "string" ? JSON.parse(referenceStyles) : referenceStyles) : [];
    } catch { parsedRefStyles = []; }

    const referenceBlock = parsedRefStyles.length > 0 ? `
[STYLE REFERENCES — ${parsedRefStyles.length} images provided by user]
CRITICAL: Match the visual style, lighting, composition, color grading, and mood of these reference images.
Adapt the product photography to feel cohesive with these reference styles while maintaining product accuracy.
` : "";

    const contextBlock = `${subjectProtocol}${foodProtocol}${brandBlock}${visualDnaBlock}${referenceBlock}`;

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
            model: "cuuupid/idm-vton",
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
            model: "cuuupid/idm-vton",
            cost: 0,
            error: err instanceof Error ? err.message : String(err),
            tryonPipeline: true,
          });
        }
      }
    } else if (tryonPlan.length > 0) {
      logger.info({ tryonModes: tryonModesSelected, tryonCount: tryonPlan.length, category: analysis.product?.category }, "Fusion Studio TryOn: Starting REAL accessory try-on via Nano Banana (non-fashion product)");

      const productFile = productFiles[0];
      const productMimeType = productFile.mimetype;
      const productBuffer = productFile.buffer;

      const modelFile = hasModel === "true" && files.length > productFiles.length
        ? files[files.length - 1] : null;

      const componentsListNB = (analysis.componentBreakdown || []).slice(0, 8).map(c => `${c.partName} (${c.material})`).join(", ");
      const materialsListNB = (analysis.textures || []).map(t => `${t.material}/${t.finish}`).join(", ") || analysis.product?.estimatedMaterials?.join(", ") || "";
      const colorsListNB = (analysis.colors?.dominant || []).join(", ");
      const productCategoryNB = analysis.product?.category || "accessory";
      const productSubcategoryNB = analysis.product?.subcategory || "";

      const aspectRatioMap: Record<string, string> = {
        "1024x1024": "1:1", "1080x1080": "1:1",
        "1024x1536": "2:3", "1080x1350": "4:5",
        "1080x1920": "9:16", "1536x1024": "3:2", "1920x1080": "16:9",
      };
      const aspectRatioNB = aspectRatioMap[outputFormat || ""] || "3:4";

      for (const item of tryonPlan) {
        try {
          let modelImageBuffer: Buffer;
          let modelImageMimeType: string;

          if (modelFile) {
            modelImageBuffer = modelFile.buffer;
            modelImageMimeType = modelFile.mimetype;
            logger.info("Fusion Studio TryOn (NB): Using uploaded model photo");
          } else {
            const modelPrompt = buildModelPersonPrompt(item.mode, analysis, parsedBrandDna, extraPrompt || undefined);
            const size = getOutputSize(item.mode, outputFormat || "");
            const modelUrl = await generateModelPerson(replicate, modelPrompt, size.width, size.height);
            modelImageBuffer = await fetchToBuffer(modelUrl);
            modelImageMimeType = "image/png";
            logger.info({ bytes: modelImageBuffer.length }, "Fusion Studio TryOn (NB): Generated AI model person");
          }

          const tryonResult = await applyAccessoryTryon(
            modelImageBuffer,
            modelImageMimeType,
            productBuffer,
            productMimeType,
            productCategoryNB,
            productSubcategoryNB,
            componentsListNB,
            materialsListNB,
            colorsListNB,
            item.mode,
            replicateToken,
            extraPrompt || undefined,
            aspectRatioNB,
          );

          const pngBase64 = tryonResult.buffer.toString("base64");
          const dataUri = `data:${tryonResult.mimeType};base64,${pngBase64}`;
          const finalUrl = dataUri;

          const totalItemCost = (modelFile ? 0 : TRYON_MODEL_COST) + 0.04;

          if (pid > 0) {
            try {
              await saveToVault({
                projectId: pid,
                fileType: "image",
                category: `fusion-${item.mode}`,
                title: `Fusion ${item.mode} — ${productCategoryNB} (Real Try-On Nano Banana)`,
                content: pngBase64,
                mimeType: tryonResult.mimeType,
                generatedBy: "fusion-studio-tryon-nb",
                metadata: {
                  model: `gemini-3.1-flash-image (${tryonResult.provider})`,
                  productCategory: productCategoryNB,
                  productSubcategory: productSubcategoryNB,
                  cost: totalItemCost,
                  mode: item.mode,
                  pipeline: "real-accessory-tryon-nano-banana",
                  tags: ["fusion-studio", "tryon", "nano-banana", "accessory"],
                },
              });
            } catch (e) {
              logger.warn({ err: e instanceof Error ? e.message : String(e) }, "Fusion Studio TryOn (NB): vault save failed (non-fatal)");
            }
          }

          generatedImages.push({
            mode: item.mode,
            index: item.index,
            imageUrl: finalUrl,
            prompt: `REAL accessory try-on (${productCategoryNB} on model)`,
            model: `gemini-3.1-flash-image (${tryonResult.provider})`,
            cost: totalItemCost,
            tryonPipeline: true,
          });

          logger.info({ mode: item.mode, index: item.index, provider: tryonResult.provider }, "Fusion Studio TryOn (NB): Real accessory try-on complete");
        } catch (err) {
          logger.error({ mode: item.mode, err: err instanceof Error ? err.message : String(err) }, "Fusion Studio TryOn (NB): Accessory try-on failed");
          generatedImages.push({
            mode: item.mode,
            index: item.index,
            imageUrl: null,
            prompt: "",
            model: "gemini-3.1-flash-image",
            cost: 0,
            error: err instanceof Error ? err.message : String(err),
            tryonPipeline: true,
          });
        }
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
              32000,
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
            const defaultModel = FUSION_MODEL_MAP[item.mode] || "black-forest-labs/flux-1.1-pro";
            const model = (engineOverride && typeof engineOverride === "string" && COST_MAP[engineOverride]) ? engineOverride : defaultModel;
            const cost = COST_MAP[model] ?? 0.04;
            const size = getOutputSize(item.mode, outputFormat || "");

            logger.info({ mode: item.mode, index: item.index, model }, "Fusion Studio: Generating image");

            const output = await replicateWithRetry(() => {
              let runPromise: Promise<unknown>;
              const ar = size.width >= size.height ? `${size.width}:${size.height}` : `${size.width}:${size.height}`;
              if (model.includes("flux-1.1-pro")) {
                runPromise = replicate.run(model as `${string}/${string}`, {
                  input: { prompt: item.replicatePrompt, negative_prompt: NEGATIVE_PROMPT, width: size.width, height: size.height, num_outputs: 1, output_format: "png", output_quality: 100 },
                });
              } else if (model.includes("flux-kontext")) {
                runPromise = replicate.run(model as `${string}/${string}`, {
                  input: { prompt: item.replicatePrompt, aspect_ratio: ar, output_format: "png" },
                });
              } else if (model.includes("recraft")) {
                runPromise = replicate.run(model as `${string}/${string}`, {
                  input: { prompt: item.replicatePrompt, size: `${size.width}x${size.height}`, style: "realistic_image" },
                });
              } else if (model.includes("ideogram")) {
                runPromise = replicate.run(model as `${string}/${string}`, {
                  input: { prompt: item.replicatePrompt, aspect_ratio: ar, magic_prompt_option: "AUTO" },
                });
              } else if (model.includes("imagen")) {
                runPromise = replicate.run(model as `${string}/${string}`, {
                  input: { prompt: item.replicatePrompt, aspect_ratio: ar, output_format: "png" },
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

// ============================================================
// VIDEO GENERATION — Multi-platform (Runway integrado + plataformas externas)
// ============================================================
const ALLOWED_RATIOS: RunwayRatio[] = [
  "1280:768", "768:1280", "1104:832", "832:1104", "960:960", "1584:672",
];

router.get("/fusion-studio/video-models", (_req: Request, res: Response): void => {
  res.json({
    models: [
      // ── Google Veo ──────────────────────────────────────────────────────────
      {
        key: "veo_4",
        label: "Veo 4 (Google · 2026)",
        description: "Última generación Google — coherencia narrativa máxima, audio nativo (8s).",
        costPerSec: 1.00,
        provider: "gemini",
        badge: "NUEVO ★",
        integrated: true,
        maxDuration: 8,
        maxResolution: "1080p",
        supportsT2V: true,
        strengths: ["Coherencia máxima", "Audio nativo", "T2V + I2V", "2026"],
      },
      {
        key: "veo_4_fast",
        label: "Veo 4 Fast (Google · 2026)",
        description: "Veo 4 rápido y más barato, audio nativo (8s).",
        costPerSec: 0.55,
        provider: "gemini",
        badge: "NUEVO",
        integrated: true,
        maxDuration: 8,
        maxResolution: "1080p",
        supportsT2V: true,
        strengths: ["Audio nativo", "Rápido", "T2V + I2V"],
      },
      {
        key: "veo_31",
        label: "Veo 3.1 (Google DeepMind)",
        description: "Google Veo 3.1 — última gen estable + audio nativo, 16:9 / 9:16.",
        costPerSec: 0.75,
        provider: "gemini",
        badge: "PREMIUM",
        integrated: true,
        maxDuration: 8,
        maxResolution: "1080p",
        supportsT2V: true,
        strengths: ["Audio nativo", "Física líder", "Google quality", "I2V + T2V"],
      },
      {
        key: "veo_31_fast",
        label: "Veo 3.1 Fast (Google DeepMind)",
        description: "Google Veo 3.1 rápido con audio nativo.",
        costPerSec: 0.40,
        provider: "gemini",
        badge: "INTEGRADO",
        integrated: true,
        maxDuration: 8,
        maxResolution: "1080p",
        supportsT2V: true,
        strengths: ["Audio nativo", "Rápido", "Google quality", "I2V + T2V"],
      },
      {
        key: "veo_3",
        label: "Veo 3 (Google DeepMind)",
        description: "Máxima calidad Google, audio nativo ambiental, 16:9. Vía Gemini API directa.",
        costPerSec: 0.75,
        provider: "gemini",
        badge: "INTEGRADO",
        integrated: true,
        maxDuration: 8,
        maxResolution: "1080p",
        supportsT2V: true,
        strengths: ["Audio nativo", "Física líder", "Google quality", "I2V + T2V"],
      },
      {
        key: "veo_3_fast",
        label: "Veo 3 Fast (Google DeepMind)",
        description: "Google Veo 3 rápido con audio nativo, 16:9.",
        costPerSec: 0.40,
        provider: "gemini",
        badge: "INTEGRADO",
        integrated: true,
        maxDuration: 8,
        maxResolution: "1080p",
        supportsT2V: true,
        strengths: ["Audio nativo", "Rápido", "Google quality", "I2V + T2V"],
      },
      {
        key: "veo_2",
        label: "Veo 2 (Google DeepMind)",
        description: "Soporta 9:16 y 16:9, hasta 8s. Sin audio. Vía Gemini API directa.",
        costPerSec: 0.35,
        provider: "gemini",
        badge: "INTEGRADO",
        integrated: true,
        maxDuration: 8,
        maxResolution: "1080p",
        supportsT2V: true,
        strengths: ["9:16 + 16:9", "Buen precio Gemini", "I2V + T2V"],
      },
      // ── Kling (Kuaishou) ────────────────────────────────────────────────────
      {
        key: "kling_30_omni",
        label: "Kling V3.0 Omni (multimodal)",
        description: "Multimodal: texto + imagen + refs + audio nativo. Hasta 15s, 1080p. Vía Replicate.",
        costPerSec: 0.22,
        provider: "replicate",
        badge: "NUEVO ★",
        integrated: true,
        maxDuration: 15,
        maxResolution: "1080p",
        supportsT2V: true,
        strengths: ["Multimodal", "Audio nativo", "15s", "Estilo transfer"],
      },
      {
        key: "kling_30_master",
        label: "Kling V3.0 Master",
        description: "Máxima calidad cinemática V3.0, hasta 15s, 1080p. Vía Replicate.",
        costPerSec: 0.22,
        provider: "replicate",
        badge: "PREMIUM",
        integrated: true,
        maxDuration: 15,
        maxResolution: "1080p",
        supportsT2V: true,
        strengths: ["Top motion quality", "Audio nativo", "Multi-shot", "I2V + T2V"],
      },
      {
        key: "kling_30_turbo",
        label: "Kling V3.0 Turbo",
        description: "Versión rápida de Kling V3.0, alta calidad, audio nativo. Vía Replicate.",
        costPerSec: 0.14,
        provider: "replicate",
        badge: "INTEGRADO",
        integrated: true,
        maxDuration: 15,
        maxResolution: "1080p",
        supportsT2V: true,
        strengths: ["Rápido", "V3.0 quality", "Audio nativo", "I2V + T2V"],
      },
      {
        key: "kling_master",
        label: "Kling Master (alias V3.0 Omni)",
        description: "Alias de Kling V3.0 Omni — máxima calidad, multimodal, audio nativo, hasta 15s.",
        costPerSec: 0.22,
        provider: "replicate",
        badge: "PREMIUM",
        integrated: true,
        maxDuration: 15,
        maxResolution: "1080p",
        supportsT2V: true,
        strengths: ["Top motion quality", "Audio nativo", "Multi-shot", "I2V + T2V"],
      },
      {
        key: "kling_21",
        label: "Kling v2.1 (legado → V3.0)",
        description: "Alias legado — redirigido a Kling V3.0 Turbo actual. Vía Replicate.",
        costPerSec: 0.14,
        provider: "replicate",
        badge: "LEGADO",
        integrated: true,
        maxDuration: 15,
        maxResolution: "1080p",
        supportsT2V: true,
        strengths: ["1080p realista", "Buen precio", "I2V + T2V"],
      },
      // ── Runway ──────────────────────────────────────────────────────────────
      {
        key: "runway_seedance2",
        label: "Runway Seedance 2.0",
        description: "Nueva generación ByteDance vía Runway — calidad cinematográfica, mayo 2026.",
        costPerSec: 0.10,
        provider: "runway",
        badge: "NUEVO ★",
        integrated: true,
        maxDuration: 10,
        maxResolution: "1080p",
        supportsT2V: false,
        strengths: ["Cinematográfico", "Alta calidad", "Motion suave"],
      },
      {
        key: "runway_gen45",
        label: "Runway Gen-4.5",
        description: "Nueva generación Runway — mejor motion y detalle que Gen-4.",
        costPerSec: 0.06,
        provider: "runway",
        badge: "PREMIUM",
        integrated: true,
        maxDuration: 10,
        maxResolution: "1080p",
        supportsT2V: false,
        strengths: ["Motion máximo", "Control fino", "Detalle real"],
      },
      {
        key: "runway_seedance2_fast",
        label: "Runway Seedance 2 Fast",
        description: "Seedance 2 rápido vía Runway — más barato, calidad pro.",
        costPerSec: 0.06,
        provider: "runway",
        badge: "INTEGRADO",
        integrated: true,
        maxDuration: 10,
        maxResolution: "1080p",
        supportsT2V: false,
        strengths: ["Rápido", "Calidad pro", "Económico"],
      },
      {
        key: "gen4_turbo",
        label: "Runway Gen-4 Turbo",
        description: "Mayor coherencia, físicas realistas, control de cámara por prompt.",
        costPerSec: 0.05,
        provider: "runway",
        badge: "INTEGRADO",
        integrated: true,
        maxDuration: 10,
        maxResolution: "1080p",
        supportsT2V: false,
        strengths: ["#1 Artificial Analysis", "Materiales fotorrealistas", "Estabilidad excepcional"],
      },
      {
        key: "gen3a_turbo",
        label: "Runway Gen-3 Alpha (legado)",
        description: "Modelo legado Runway — reemplazado por Gen-4.5 y Gen-5.",
        costPerSec: 0.03,
        provider: "runway",
        badge: "LEGADO",
        integrated: true,
        maxDuration: 10,
        maxResolution: "1080p",
        supportsT2V: false,
        strengths: ["Económico", "I2V"],
      },
      // ── Seedance (ByteDance) ─────────────────────────────────────────────────
      {
        key: "seedance_pro",
        label: "Seedance Pro (ByteDance)",
        description: "Calidad cinema, soporte multi-referencia (9 imágenes). Vía Replicate.",
        costPerSec: 0.07,
        provider: "replicate",
        badge: "INTEGRADO",
        integrated: true,
        maxDuration: 10,
        maxResolution: "1080p",
        supportsT2V: true,
        strengths: ["Cinema quality", "Multi-reference", "I2V + T2V", "Física precisa"],
      },
      {
        key: "seedance_fast",
        label: "Seedance Fast (ByteDance)",
        description: "Versión rápida y económica de Seedance. Calidad profesional. Vía Replicate.",
        costPerSec: 0.05,
        provider: "replicate",
        badge: "INTEGRADO",
        integrated: true,
        maxDuration: 10,
        maxResolution: "1080p",
        supportsT2V: true,
        strengths: ["Rápido", "Económico", "I2V + T2V", "Calidad pro"],
      },
      {
        key: "seedance_1_lite",
        label: "Seedance 1 Lite",
        description: "Versión económica de Seedance — ideal para bocetos y volumen.",
        costPerSec: 0.03,
        provider: "replicate",
        badge: "ECONÓMICO",
        integrated: true,
        maxDuration: 10,
        maxResolution: "1080p",
        supportsT2V: false,
        strengths: ["Muy barato", "I2V", "Bocetos"],
      },
      // ── Hailuo / MiniMax ─────────────────────────────────────────────────────
      {
        key: "hailuo_23",
        label: "Hailuo 2.3 (MiniMax)",
        description: "Última gen MiniMax — 1080p, T2V + I2V, mejora sobre Hailuo 02. Vía Replicate.",
        costPerSec: 0.06,
        provider: "replicate",
        badge: "NUEVO",
        integrated: true,
        maxDuration: 10,
        maxResolution: "1080p",
        supportsT2V: true,
        strengths: ["1080p", "T2V + I2V", "Última gen MiniMax"],
      },
      {
        key: "hailuo_02",
        label: "Hailuo 02 (MiniMax)",
        description: "Buen balance velocidad/calidad, hasta 6s. Vía Replicate.",
        costPerSec: 0.05,
        provider: "replicate",
        badge: "INTEGRADO",
        integrated: true,
        maxDuration: 6,
        maxResolution: "1080p",
        supportsT2V: true,
        strengths: ["Velocidad", "Balance calidad/precio", "I2V + T2V"],
      },
      {
        key: "hailuo_02_fast",
        label: "Hailuo 02 Fast (MiniMax)",
        description: "Hailuo 02 variante rápida y barata. Vía Replicate.",
        costPerSec: 0.03,
        provider: "replicate",
        badge: "ECONÓMICO",
        integrated: true,
        maxDuration: 6,
        maxResolution: "1080p",
        supportsT2V: true,
        strengths: ["Ultra rápido", "Muy barato", "I2V + T2V"],
      },
      // ── Wan (Open Source) ─────────────────────────────────────────────────────
      {
        key: "wan_27",
        label: "Wan 2.7 (Open Source · última gen)",
        description: "Última gen open-source wan-video — T2V + I2V + R2V, hasta 15s y 1080p.",
        costPerSec: 0.05,
        provider: "replicate",
        badge: "NUEVO ★",
        integrated: true,
        maxDuration: 15,
        maxResolution: "1080p",
        supportsT2V: true,
        strengths: ["T2V + I2V + R2V", "1080p", "15s", "Open-source"],
      },
      {
        key: "wan_25",
        label: "Wan 2.5 I2V (Open Source)",
        description: "Open-source de calidad. Image-to-video. Vía Replicate.",
        costPerSec: 0.04,
        provider: "replicate",
        badge: "INTEGRADO",
        integrated: true,
        maxDuration: 5,
        maxResolution: "720p",
        supportsT2V: false,
        strengths: ["Calidad", "Open-source", "I2V"],
      },
      {
        key: "wan_25_t2v",
        label: "Wan 2.5 T2V (Open Source)",
        description: "Wan 2.5 Text-to-Video puro — sin imagen origen.",
        costPerSec: 0.025,
        provider: "replicate",
        badge: "ECONÓMICO",
        integrated: true,
        maxDuration: 5,
        maxResolution: "720p",
        supportsT2V: true,
        strengths: ["T2V puro", "Open-source", "Barato"],
      },
      // ── OpenAI / xAI ─────────────────────────────────────────────────────────
      {
        key: "sora_2",
        label: "OpenAI Sora 2",
        description: "Narrativa cinematográfica de OpenAI, hasta 12s, T2V + I2V. Vía Replicate.",
        costPerSec: 0.30,
        provider: "replicate",
        badge: "PREMIUM",
        integrated: true,
        maxDuration: 12,
        maxResolution: "1080p",
        supportsT2V: true,
        strengths: ["Narrativa", "12s", "T2V + I2V", "OpenAI quality"],
      },
      {
        key: "grok_video_15",
        label: "Grok Video 1.5 Preview (xAI)",
        description: "xAI Grok Imagine Video 1.5 — mayor calidad, 720p, hasta 15s.",
        costPerSec: 0.14,
        provider: "xai",
        badge: "NUEVO",
        integrated: true,
        maxDuration: 15,
        maxResolution: "720p",
        supportsT2V: true,
        strengths: ["xAI quality", "T2V + I2V", "15s"],
      },
      {
        key: "grok_video",
        label: "Grok Video (xAI)",
        description: "xAI Grok Imagine Video — T2V / I2V, hasta 15s, 720p.",
        costPerSec: 0.07,
        provider: "xai",
        badge: "INTEGRADO",
        integrated: true,
        maxDuration: 15,
        maxResolution: "720p",
        supportsT2V: true,
        strengths: ["T2V + I2V", "15s", "Económico"],
      },
    ],
    ratios: [
      { key: "9:16", label: "9:16 vertical (Reels/TikTok)", resolution: "768:1280", runway: "768:1280" },
      { key: "16:9", label: "16:9 horizontal (YouTube)", resolution: "1280:768", runway: "1280:768" },
      { key: "1:1", label: "1:1 cuadrado (feed)", resolution: "960:960", runway: "960:960" },
      { key: "4:3", label: "4:3 retrato", resolution: "832:1104", runway: "832:1104" },
    ],
    durations: [5, 10],
  });
});

router.post("/fusion-studio/generate-video", async (req: Request, res: Response): Promise<void> => {
  enableLongRunning(res);
  try {
    const userId = (req.session as any)?.userId;
    if (!userId) {
      res.status(401).json({ error: "No autenticado" });
      return;
    }

    const {
      projectId,
      imageUrl,
      promptText,
      model,
      duration,
      ratio,
      seed,
    } = req.body ?? {};

    const pid = Number.parseInt(String(projectId ?? ""), 10);
    if (!Number.isFinite(pid) || pid < 0) {
      res.status(400).json({ error: "projectId inválido" });
      return;
    }
    if (!promptText || typeof promptText !== "string" || promptText.trim().length < 3) {
      res.status(400).json({ error: "promptText requerido (mín. 3 caracteres)" });
      return;
    }

    // ACL: el cliente solo accede al proyecto de su invitación (session.clientId
    // = id de proyecto; projects.client_id es la credencial OAuth de la tienda).
    const [project] = await db.select().from(projectsTable).where(eq(projectsTable.id, pid));
    if (!project) {
      res.status(404).json({ error: "Proyecto no encontrado" });
      return;
    }
    const sessionRole = (req.session as any)?.role;
    const sessionClientId = (req.session as any)?.clientId;
    if (sessionRole !== "admin") {
      if (sessionRole !== "client" || !clientOwnsProjectId(sessionClientId, pid)) {
        res.status(403).json({ error: "Sin acceso a este proyecto" });
        return;
      }
    }

    const safeDuration = Math.min(Math.max(Number(duration) || 5, 5), 10);
    const videoImageCredits = safeDuration === 10 ? 12 : 6;
    const limitCheck = await checkProductionLimit(pid, "image", videoImageCredits);
    if (!limitCheck.allowed) {
      res.status(429).json({ error: limitCheck.reason || "Límite de plan alcanzado" });
      return;
    }

    const FSP_MODEL_MAP: Record<string, FSPVideoModel> = {
      // Kling
      kling_30_omni:    "kling-3.0-omni",
      kling_30_master:  "kling-3.0-master",
      kling_30_turbo:   "kling-3.0-turbo",
      kling_master:     "kling-master",
      kling_25_turbo:   "kling-2.5-turbo",
      kling_21:         "kling-3.0-turbo",
      // Seedance
      seedance_pro:     "seedance-pro",
      seedance_fast:    "seedance-fast",
      seedance_1_lite:  "seedance-1-lite",
      // Hailuo
      hailuo_23:        "hailuo-2.3",
      hailuo_02:        "hailuo-02",
      hailuo_02_fast:   "hailuo-02-fast",
      // Wan
      wan_27:           "wan-2.7",
      wan_25:           "wan-2.7",
      wan_25_hq:        "wan-2.5",
      wan_25_t2v:       "wan-2.5-t2v",
      // Veo (Gemini)
      veo_4:            "veo-4",
      veo_4_fast:       "veo-4-fast",
      veo_31:           "veo-3.1",
      veo_31_fast:      "veo-3.1-fast",
      veo_3_fast:       "veo-3-fast",
      veo_3:            "veo-3",
      veo_2:            "veo-2",
      // OpenAI / xAI
      sora_2:           "sora-2",
      grok_video_15:    "grok-imagine-video-1.5",
      grok_video:       "grok-imagine-video",
      // Runway (via FSP generateVideoFromImage — includes gen4.5, seedance2)
      runway_gen45:           "runway-gen4.5",
      runway_seedance2:       "runway-seedance2",
      runway_seedance2_fast:  "runway-seedance2-fast",
    };

    const isRunway = model === "gen3a_turbo" || model === "gen4_turbo";
    const fspModel = FSP_MODEL_MAP[model as string];
    const isReplicate = !!fspModel;

    if (!isRunway && !isReplicate) {
      res.status(400).json({ error: `Modelo desconocido: ${model}. Modelos disponibles: veo_4, veo_31, veo_3, veo_2, kling_30_omni, kling_30_master, kling_30_turbo, kling_master, seedance_pro, seedance_fast, seedance_1_lite, hailuo_23, hailuo_02, wan_27, wan_25_t2v, sora_2, grok_video, runway_gen45, runway_seedance2, gen4_turbo.` });
      return;
    }

    const safeRatio: RunwayRatio = ALLOWED_RATIOS.includes(ratio) ? ratio : "1280:768";
    const safeSeed = typeof seed === "number" && Number.isFinite(seed) ? Math.floor(seed) : undefined;
    const aspectMap: Record<string, string> = { "1280:768": "16:9", "768:1280": "9:16", "960:960": "1:1", "1104:832": "4:3", "832:1104": "3:4", "1584:672": "21:9" };
    const aspect = aspectMap[safeRatio] || "9:16";

    logger.info({ pid, model, provider: isRunway ? "runway" : "replicate/gemini", duration: safeDuration, ratio: safeRatio }, "Fusion Studio: generando video");

    let videoUrl: string;
    let finalModel: string;
    let finalDuration: number;
    let cost: number;
    let taskId: string | undefined;

    if (isRunway) {
      const safeModel: RunwayModel = model === "gen4_turbo" ? "gen4_turbo" : "gen3a_turbo";
      const rwDuration: RunwayDuration = safeDuration >= 8 ? 10 : 5;
      const result = await runwayGenerateVideo({
        promptImage: imageUrl,
        promptText: promptText.trim(),
        model: safeModel,
        duration: rwDuration,
        ratio: safeRatio,
        seed: safeSeed,
      });
      videoUrl = result.videoUrl;
      finalModel = result.model;
      finalDuration = result.durationSec;
      cost = result.cost;
      taskId = result.taskId;
    } else {
      let imageBuffer: Buffer | null = null;
      const imageMime = "image/jpeg";
      if (imageUrl && imageUrl.startsWith("http")) {
        try { imageBuffer = await fetchToBuffer(imageUrl); } catch (e: any) {
          logger.warn({ err: e?.message }, "Could not fetch source image, trying T2V");
        }
      }
      if (!imageBuffer && !modelSupportsTextToVideo(fspModel!)) {
        res.status(400).json({ error: `Modelo ${model} requiere imagen origen (no soporta text-to-video puro)` });
        return;
      }
      const videoBuffer = await fspGenerateVideo(fspModel!, imageBuffer, imageMime, promptText.trim(), { duration: safeDuration, aspect });
      const b64Content = videoBuffer.toString("base64");
      const vaultId = await saveToVault({
        projectId: pid,
        fileType: "video",
        category: "fusion-video",
        title: `Fusion Video — ${promptText.trim().slice(0, 60)}`,
        content: b64Content,
        mimeType: "video/mp4",
        fileSizeBytes: videoBuffer.length,
        generatedBy: fspModel!,
        metadata: {
          model: fspModel,
          durationSec: safeDuration,
          ratio: safeRatio,
          promptText: promptText.trim().slice(0, 500),
          sourceImage: imageUrl?.slice(0, 500) || "text-to-video",
          provider: FSP_VIDEO_MODELS[fspModel!]?.provider,
        },
      });
      videoUrl = "";
      if (vaultId) {
        videoUrl = `${req.protocol}://${req.get("host")}/api/projects/${pid}/vault/${vaultId}/download`;
      }
      finalModel = fspModel!;
      finalDuration = safeDuration;
      cost = (FSP_VIDEO_MODELS[fspModel!]?.costPerSec || 0.05) * safeDuration;
      taskId = undefined;
    }

    if (isRunway) {
      await saveToVault({
        projectId: pid,
        fileType: "video",
        category: "fusion-video",
        title: `Fusion Video — ${promptText.trim().slice(0, 60)}`,
        originalUrl: videoUrl,
        mimeType: "video/mp4",
        generatedBy: "runway",
        metadata: {
          model: finalModel,
          durationSec: finalDuration,
          ratio: safeRatio,
          promptText: promptText.trim().slice(0, 500),
          sourceImage: imageUrl.slice(0, 500),
          cost,
          taskId,
        },
      });
    }

    try {
      await recordUsage(pid, "image", videoImageCredits);
    } catch (err) {
      logger.error({ err, pid, videoImageCredits, taskId }, "CRITICAL: recordUsage falló tras generar video — créditos NO descontados");
    }

    learnFromOperation({
      operationType: "fusion_video_generated",
      title: `Video generado: ${promptText.trim().slice(0, 80)}`,
      content: `Video ${finalModel} ${finalDuration}s ${safeRatio}. Coste $${cost.toFixed(2)}. Prompt: ${promptText.trim().slice(0, 200)}`,
      confidence: 0.9,
      tags: ["fusion-studio", "video", finalModel],
    });

    res.json({
      success: true,
      videoUrl,
      durationSec: finalDuration,
      model: finalModel,
      ratio: safeRatio,
      cost,
      taskId,
    });
  } catch (err: any) {
    if (!res.headersSent) {
      const msg = err instanceof Error ? err.message : "Error generando video";
      logger.error({ err: msg }, "Fusion video error");
      // FIX MEDIUM: clasificar errores upstream (429/quota/timeout) sin filtrar detalles
      const lower = msg.toLowerCase();
      if (lower.includes("429") || lower.includes("rate") || lower.includes("quota")) {
        res.status(429).json({ error: "Servicio de video temporalmente saturado. Reintenta en unos minutos." });
      } else if (lower.includes("402") || lower.includes("payment") || lower.includes("billing")) {
        res.status(402).json({ error: "Servicio de video sin saldo. Contacta al administrador." });
      } else if (lower.includes("timeout")) {
        res.status(504).json({ error: "El generador de video tardó demasiado. Intenta de nuevo." });
      } else {
        res.status(500).json({ error: "Error generando video. El equipo ha sido notificado." });
      }
    }
  }
});

export default router;
