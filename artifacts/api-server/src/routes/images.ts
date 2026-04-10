import { Router } from "express";
import { db } from "@workspace/db";
import { projectsTable, productsTable, generationJobsTable } from "@workspace/db";
import { saveToVault } from "../lib/vault.js";
import { eq, and } from "drizzle-orm";
import { shopifyRequest } from "../lib/shopify";
import { askClaudeWithBrain, learnFromOperation } from "../lib/claude";
import { createBulkJob, updateJobProgress, completeJob, runAsync } from "../lib/bulk-queue";
import { checkProductionLimit, recordUsage } from "../lib/plan-limits.js";
import { enableLongRunning } from "../lib/long-running.js";

const router = Router();

// ── Constants ───────────────────────────────────────────────────────────────

export const MODEL_MAP: Record<string, string> = {
  hero: "black-forest-labs/flux-1.1-pro",
  lifestyle: "black-forest-labs/flux-1.1-pro",
  bundle: "black-forest-labs/flux-1.1-pro",
  process: "black-forest-labs/flux-1.1-pro",
  detail: "black-forest-labs/flux-dev",
  scale: "black-forest-labs/flux-dev",
  variant: "black-forest-labs/flux-dev",
  packaging: "recraft-ai/recraft-v3",
  ugc: "recraft-ai/recraft-v3",
  infographic: "svg_only",
};

export const COST_MAP: Record<string, number> = {
  "black-forest-labs/flux-1.1-pro": 0.04,
  "black-forest-labs/flux-dev": 0.025,
  "recraft-ai/recraft-v3": 0.022,
  svg_only: 0,
};

export const NEGATIVE_PROMPT =
  "blurry, low quality, pixelated, watermark, text overlay, logo, cartoon, illustration, distorted, ugly, bad lighting, amateur, overexposed, underexposed, duplicate, extra limbs, wrong product, unrelated object, flowers on non-flower product, animals on non-animal product, food on non-food product, random decorations unrelated to subject";

// Replicate can take up to 3 minutes for complex models — allow 5 min max
const REPLICATE_TIMEOUT_MS = 5 * 60_000;
// Fetching generated image to upload to Shopify
const FETCH_IMAGE_TIMEOUT_MS = 30_000;

// ── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Wraps a promise with a maximum timeout.
 * Rejects with a descriptive Error if the operation exceeds the limit.
 */
function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  const timeout = new Promise<never>((_, reject) =>
    setTimeout(() => reject(new Error(`Operation timed out after ${ms / 1000}s: ${label}`)), ms)
  );
  return Promise.race([promise, timeout]);
}

function normalizeText(s: string): string {
  return s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

function detectProductNature(productTitle: string, productType: string | null): "physical" | "digital" | "unknown" {
  const t = normalizeText(productTitle + " " + (productType ?? ""));
  const physicalPatterns = /resina|funko|3d.*impres|impresion 3d|camiseta|taza|poster|lienzo|canvas|figura.*3d|merchandising|calzado|zapato|zapatilla|bota|sandalia|joya|collar|anillo|pulsera|pendiente|crema|perfume|botella|serum|locion|cosmetica|maquillaje|comida|alimento|bebida|cafe|chocolate|vino|cerveza|snack|electronica|gadget|auricular|altavoz|cargador|phone|tablet|reloj|gafas|bolso|mochila|cartera|cinturon|sombrero|gorra|guantes|bufanda|libro|cuaderno|agenda|vela|incienso|planta|maceta|decoracion|mueble|lampara|alfombra|cojin|toalla|sabana|juguete|peluche|puzzle|herramienta|cuchillo|sarten|olla|vajilla|bicicleta|patinete|ropa|vestido|falda|pantalon|short|chaqueta|abrigo|sudadera|hoodie|polo|blusa|jersey|chaleco|swimwear|bikini|banador/i;
  const digitalPatterns = /saas|suscripcion|creditos|credits|software|servicio|auditoria|informe|analisis|seo|email marketing|optimizacion|consultoria|coaching|curso|ebook|template|plantilla|licencia|descarga|digital|virtual|online|api|plataforma|app|ia|inteligencia artificial|automatizacion|pack de servicios|rediseno|fotografia ia|setup/i;
  if (physicalPatterns.test(t)) return "physical";
  if (digitalPatterns.test(t)) return "digital";
  return "unknown";
}

const promptCache = new Map<string, { prompt: string; timestamp: number }>();
const PROMPT_CACHE_TTL = 30 * 60 * 1000;

function getCacheKey(projectId: number, productTitle: string, productType: string | null, imageType: string, storeNiche: string | null, brandTone: string | null): string {
  return `${projectId}::${productTitle}::${productType ?? ""}::${imageType}::${storeNiche ?? "default"}::${brandTone ?? "default"}`;
}

export async function buildImagePrompt(
  projectId: number,
  productTitle: string,
  productType: string | null,
  imageType: string,
  storeNiche: string | null,
  brandTone: string | null,
  productDescription?: string | null
): Promise<string> {
  const cacheKey = getCacheKey(projectId, productTitle, productType, imageType, storeNiche, brandTone);
  const cached = promptCache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < PROMPT_CACHE_TTL) {
    return cached.prompt;
  }

  const nature = detectProductNature(productTitle, productType);

  const imageTypeDescriptions: Record<string, string> = {
    hero: "HERO SHOT — The main product image. Must instantly communicate what this product IS and its value. This is the first image a customer sees — it must stop scrolling and create desire.",
    lifestyle: "LIFESTYLE/CONTEXT SHOT — Show the product being used, enjoyed, or experienced in its natural context. Must create an emotional connection and help the customer imagine owning/using it.",
    detail: "DETAIL/CLOSE-UP SHOT — Zoom into what makes this product special. Show quality, craftsmanship, unique features, or the transformative result the customer gets.",
    packaging: "UNBOXING/PACKAGING SHOT — The premium unboxing experience or how the product is delivered/presented.",
    ugc: "SOCIAL PROOF/UGC STYLE — Authentic-looking social media content showing real people enjoying the product.",
    scale: "SCALE REFERENCE — Show the product's size relative to everyday objects or human hands.",
    bundle: "BUNDLE/COLLECTION SHOT — Show what's included, complementary items, or the complete package.",
  };

  const shotDesc = imageTypeDescriptions[imageType] ?? imageTypeDescriptions.hero;
  const descriptionSnippet = productDescription ? productDescription.replace(/<[^>]+>/g, "").slice(0, 400) : "";

  const systemPrompt = `You are the world's TOP commercial photography art director and creative director. You have directed campaigns for Apple, Nike, Chanel, Marvel, Netflix, Adobe, and Shopify.

Your job: Write ONE hyper-specific, expert-level image generation prompt for a specific product. 

RULES:
1. Your prompt must be SPECIFIC to THIS exact product — not a generic category template. Analyze the product name, type, description, and store niche to understand EXACTLY what's being sold.
2. For PHYSICAL products (clothing, shoes, cosmetics, food, tech, figures, posters): Include a REAL PERSON/MODEL interacting with or wearing/using the product when appropriate. Specify model demographics, pose, expression, and setting.
3. For DIGITAL products/services: Create a conceptual visualization that communicates the VALUE and RESULT, not just the product. Show outcomes, transformations, or aspirational scenarios.
4. Include SPECIFIC technical photography/art direction: lens type, lighting setup, color grading, composition rules, mood, environment details.
5. The prompt must be in ENGLISH (image models work best in English).
6. Output ONLY the prompt text — no explanations, no markdown, no quotes around it.
7. Maximum 200 words. Every word must add visual direction.
8. NEVER include text/typography/logos/watermarks in the image.
9. Include negative guidance for what to AVOID (specific to this product).`;

  const userPrompt = `PRODUCT: "${productTitle}"
CATEGORY: ${productType || "General"}
STORE NICHE: ${storeNiche || "e-commerce"}
BRAND TONE: ${brandTone || "Professional"}
SHOT TYPE: ${shotDesc}
PRODUCT IS: ${nature === "physical" ? "PHYSICAL — can be photographed, held, worn, used. Include models/actors when appropriate." : nature === "digital" ? "DIGITAL — service, software, digital art, or intangible product. Focus on value visualization and outcomes." : "UNKNOWN — Analyze the product name and description to determine if it's physical or digital, then craft the prompt accordingly."}
${descriptionSnippet ? `PRODUCT DESCRIPTION: ${descriptionSnippet}` : ""}

Write the specialized prompt for this SPECIFIC product and shot type. Be an EXPERT in this product's industry.`;

  try {
    const { askClaudeWithBrain } = await import("../lib/claude.js");
    let prompt = await askClaudeWithBrain(projectId, [{ role: "user", content: userPrompt }], systemPrompt, "images", storeNiche ?? undefined);
    prompt = prompt.replace(/```[\s\S]*?```/g, "").replace(/```/g, "").replace(/^["']|["']$/g, "").replace(/^\*\*.*?\*\*\s*/gm, "").trim();
    if (prompt.length < 50) throw new Error("Prompt too short");
    const qualitySuffix = ", ultra high resolution 4K, commercial photography quality, sharp focus, professional color grading";
    const finalPrompt = prompt + qualitySuffix;
    promptCache.set(cacheKey, { prompt: finalPrompt, timestamp: Date.now() });
    return finalPrompt;
  } catch (err) {
    console.warn(`[IMG] AI prompt generation failed, using expert fallback: ${err instanceof Error ? err.message : String(err)}`);
    const effectiveNature = nature === "unknown" ? "digital" : nature;
    return buildFallbackPrompt(productTitle, productType, imageType, storeNiche, brandTone, effectiveNature);
  }
}

function buildFallbackPrompt(
  productTitle: string,
  productType: string | null,
  imageType: string,
  storeNiche: string | null,
  brandTone: string | null,
  nature: "physical" | "digital"
): string {
  const BASE_QUALITY = "ultra high resolution 4K, sharp focus, professional commercial quality, award-winning photography";
  const subject = `"${productTitle}"${productType ? ` (${productType})` : ""}`;

  if (nature === "physical") {
    const configs: Record<string, string> = {
      hero: `Professional studio product photography of ${subject}. Attractive model interacting with/wearing/holding the product. Clean background, 3-point lighting, Phase One quality, centered composition. ${BASE_QUALITY}`,
      lifestyle: `Editorial lifestyle photography featuring ${subject}. Real model using the product in an aspirational ${storeNiche ?? "lifestyle"} setting. Natural golden hour lighting, shallow depth of field, candid but styled. ${BASE_QUALITY}`,
      detail: `Extreme macro close-up of ${subject}. Focus on texture, craftsmanship, material quality. 100mm macro lens, shallow depth of field, dramatic side lighting. ${BASE_QUALITY}`,
    };
    return configs[imageType] ?? configs.hero;
  }

  const configs: Record<string, string> = {
    hero: `Stunning conceptual visualization for ${subject}. Cinematic composition showing the core value proposition. Dark premium background with dramatic lighting, floating elements, modern design aesthetic. Brand tone: ${brandTone ?? "professional"}. Store niche: ${storeNiche ?? "e-commerce"}. ${BASE_QUALITY}`,
    lifestyle: `Aspirational scene showing the transformation/result of using ${subject}. Professional person in modern environment experiencing the benefits. Success indicators visible. Brand tone: ${brandTone ?? "professional"}. ${BASE_QUALITY}`,
    detail: `Detailed feature showcase for ${subject}. Close-up on the key differentiator or unique value. Modern UI/visualization elements, clean data-driven design. ${BASE_QUALITY}`,
  };
  return configs[imageType] ?? configs.hero;
}

/**
 * Core image generation logic — shared by single and bulk generators.
 * Handles Replicate call with proper timeout, DB updates, vault save, and learning.
 */
export async function runImageGeneration(params: {
  job: { id: number };
  projectId: number;
  shopifyProductId: string;
  imageType: string;
  finalPrompt: string;
  model: string;
  estimatedCost: number;
  product: { title: string; productType: string | null };
  project: { storeNiche: string | null; brandTone: string | null; replicateApiToken: string | null };
  autoUploadToShopify?: boolean;
  shopDomain?: string;
}): Promise<{ success: boolean; imageUrl?: string; error?: string }> {
  const { job, projectId, shopifyProductId, imageType, finalPrompt, model, estimatedCost, product, project } = params;

  await db.update(generationJobsTable).set({ status: "generating" }).where(eq(generationJobsTable.id, job.id));

  if (!project.replicateApiToken) {
    const msg = "No hay Replicate API token configurado en el proyecto";
    await db.update(generationJobsTable)
      .set({ status: "failed", errorMessage: msg })
      .where(eq(generationJobsTable.id, job.id));
    return { success: false, error: msg };
  }

  try {
    const Replicate = (await import("replicate")).default;
    const { safeDecrypt } = await import("../lib/crypto.js");
    const replicateToken = safeDecrypt(project.replicateApiToken!) || project.replicateApiToken!;
    const replicate = new Replicate({ auth: replicateToken });

    const runWithRetry = async (attempt = 1): Promise<unknown> => {
      try {
        let runPromise: Promise<unknown>;
        if (model.includes("flux-1.1-pro")) {
          runPromise = replicate.run(model as `${string}/${string}`, {
            input: { prompt: finalPrompt, negative_prompt: NEGATIVE_PROMPT, width: 1440, height: 1440, num_outputs: 1, output_format: "png", output_quality: 100 },
          });
        } else if (model.includes("recraft")) {
          runPromise = replicate.run(model as `${string}/${string}`, {
            input: { prompt: finalPrompt, size: "1024x1024", style: "realistic_image" },
          });
        } else {
          runPromise = replicate.run(model as `${string}/${string}`, {
            input: { prompt: finalPrompt, negative_prompt: NEGATIVE_PROMPT, width: 1440, height: 1440, num_inference_steps: 35, guidance_scale: 3.5, output_format: "png" },
          });
        }
        return await withTimeout(runPromise, REPLICATE_TIMEOUT_MS, `Replicate ${model}`);
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        if (msg.includes("429") && attempt <= 5) {
          const delay = Math.min(15_000 * attempt, 60_000);
          await new Promise(r => setTimeout(r, delay));
          return runWithRetry(attempt + 1);
        }
        throw err;
      }
    };

    const output = await runWithRetry();

    function extractUrl(val: unknown): string {
      if (typeof val === "string") return val;
      if (val && typeof val === "object") {
        const s = val.toString();
        if (s.startsWith("http")) return s;
        if (typeof (val as Record<string, unknown>).url === "function") {
          const u = (val as { url: () => { href: string } }).url();
          return u?.href ?? String(u);
        }
        if (typeof (val as Record<string, unknown>).url === "string") {
          return (val as { url: string }).url;
        }
      }
      return String(val);
    }

    const raw = Array.isArray(output) ? output[0] : output;
    const imageUrl = extractUrl(raw);
    console.log(`[IMG] Replicate resolved URL: ${imageUrl?.slice(0, 120)}`);
    if (!imageUrl || !imageUrl.startsWith("http")) {
      throw new Error(`Replicate returned invalid image URL: ${String(raw).slice(0, 200)}`);
    }

    const altTextPrompt = `Write ONLY a plain text SEO alt text (max 125 characters) for a Shopify product image. No markdown, no code blocks, no backticks, no analysis — ONLY the alt text string itself, nothing else. Product: ${product.title}. Image type: ${imageType}. Store niche: ${project.storeNiche ?? "comics y arte digital"}. In Spanish.`;
    let altText = await askClaudeWithBrain(projectId, [{ role: "user", content: altTextPrompt }], undefined, "images", project.storeNiche ?? undefined);
    altText = altText.replace(/```[\s\S]*?```/g, "").replace(/```/g, "").replace(/\*\*[^*]*\*\*/g, "").replace(/^[\s\n]+|[\s\n]+$/g, "").split("\n")[0].trim();

    const statusUpdate: Record<string, unknown> = { status: "succeeded", imageUrl, altText: altText.slice(0, 125), completedAt: new Date() };
    if (params.autoUploadToShopify) statusUpdate.status = "uploading";
    await db.update(generationJobsTable)
      .set(statusUpdate)
      .where(eq(generationJobsTable.id, job.id));

    await saveToVault({
      projectId,
      fileType: "image",
      category: imageType,
      title: `${imageType.charAt(0).toUpperCase() + imageType.slice(1)} — ${product.title}`,
      description: altText.slice(0, 125),
      originalUrl: imageUrl,
      mimeType: "image/png",
      productId: shopifyProductId,
      productTitle: product.title,
      generatedBy: "images_motor",
      metadata: { model, prompt: finalPrompt, jobId: job.id, estimatedCost },
    });

    // ShopyBrain aprende del prompt de imagen exitoso (fire-and-forget)
    learnFromOperation({
      operationType: "images",
      niche: project.storeNiche ?? null,
      productType: product.productType ?? null,
      title: `Imagen ${imageType} exitosa: ${product.title}`,
      content: `Tipo: ${imageType}\nProducto: ${product.title}\nModelo: ${model}\nPrompt: ${finalPrompt.slice(0, 500)}\nAlt text: ${altText.slice(0, 125)}`,
      confidence: 0.70,
      tags: [imageType, project.storeNiche ?? "ecommerce", product.productType ?? "producto"].filter(Boolean),
    });

    if (params.autoUploadToShopify && params.shopDomain) {
      try {
        const uploadResult = await uploadGeneratedImageToShopify({
          projectId,
          shopDomain: params.shopDomain,
          shopifyProductId,
          jobId: job.id,
          imageUrl,
          altText: altText.slice(0, 125),
          imageType,
        });
        if (uploadResult.success) {
          await db.update(generationJobsTable).set({ status: "succeeded" }).where(eq(generationJobsTable.id, job.id));
        } else {
          await db.update(generationJobsTable).set({ status: "succeeded" }).where(eq(generationJobsTable.id, job.id));
          console.warn(`Auto-upload to Shopify failed for ${product.title} (${imageType}): ${uploadResult.error}`);
        }
      } catch (uploadErr) {
        await db.update(generationJobsTable).set({ status: "succeeded" }).where(eq(generationJobsTable.id, job.id));
        console.warn(`Auto-upload error for ${product.title}: ${uploadErr instanceof Error ? uploadErr.message : String(uploadErr)}`);
      }
    }

    return { success: true, imageUrl };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Error desconocido";
    await db.update(generationJobsTable)
      .set({ status: "failed", errorMessage: msg })
      .where(eq(generationJobsTable.id, job.id));
    return { success: false, error: msg };
  }
}

// ── Routes ────────────────────────────────────────────────────────────────────

router.post("/projects/:projectId/build-image-prompt", async (req, res): Promise<void> => {
  try {
    const projectId = parseInt(Array.isArray(req.params.projectId) ? req.params.projectId[0] : req.params.projectId, 10);
    const { productId, imageType } = req.body as { productId: string; imageType: string };
  
    const [project] = await db.select().from(projectsTable).where(eq(projectsTable.id, projectId));
    const [product] = await db
      .select()
      .from(productsTable)
      .where(and(eq(productsTable.projectId, projectId), eq(productsTable.shopifyProductId, productId)));
  
    if (!project || !product) {
      res.status(404).json({ error: "Proyecto o producto no encontrado" });
      return;
    }
  
    const model = MODEL_MAP[imageType] ?? MODEL_MAP.hero;
    const imageCost = COST_MAP[model] ?? 0.04;
    const aiPromptCost = 0.005;
    const estimatedCost = parseFloat((imageCost + aiPromptCost).toFixed(3));
    const estimatedTime = model.includes("flux-dev") ? 25 : model.includes("recraft") ? 20 : 15;
  
    const prompt = await buildImagePrompt(
      projectId, product.title, product.productType, imageType, project.storeNiche, project.brandTone, product.bodyHtml
    );
  
    const modelReasons: Record<string, string> = {
      hero: "flux-1.1-pro para imágenes hero de alta calidad con fondo blanco",
      lifestyle: "flux-1.1-pro para fotografía lifestyle editorial",
      bundle: "flux-1.1-pro para flat lays premium",
      detail: "flux-dev para macros de detalle y textura",
      scale: "flux-dev para referencias de escala",
      packaging: "recraft-v3 para packaging y unboxing fotorrealista",
      ugc: "recraft-v3 para estilo UGC/social auténtico",
    };
  
    res.json({
      prompt,
      negativePrompt: NEGATIVE_PROMPT,
      model: model === "svg_only" ? "Claude SVG" : model,
      modelReason: modelReasons[imageType] ?? "Modelo óptimo para este tipo de imagen",
      estimatedTime,
      estimatedCost,
    });
  } catch (err: any) {
    const msg = err instanceof Error ? err.message : "Internal server error";
    res.status(500).json({ error: msg });
  }
});

// ── Single image generation ──────────────────────────────────────────────────

router.post("/projects/:projectId/products/:productId/images/generate", async (req, res): Promise<void> => {
  try {
    const projectId = parseInt(Array.isArray(req.params.projectId) ? req.params.projectId[0] : req.params.projectId, 10);
    const shopifyProductId = Array.isArray(req.params.productId) ? req.params.productId[0] : req.params.productId;
    const { imageType: rawImageType, imageTypes, customPrompt } = req.body as { imageType?: string; imageTypes?: string[]; customPrompt?: string };
    const imageType = rawImageType || (Array.isArray(imageTypes) ? imageTypes[0] : null) || "hero";
  
    const [project] = await db.select().from(projectsTable).where(eq(projectsTable.id, projectId));
    const [product] = await db
      .select()
      .from(productsTable)
      .where(and(eq(productsTable.projectId, projectId), eq(productsTable.shopifyProductId, shopifyProductId)));
  
    if (!project || !product) {
      res.status(404).json({ error: "Proyecto o producto no encontrado" });
      return;
    }
  
    const limitCheck = await checkProductionLimit(projectId, "image", 1);
    if (!limitCheck.allowed) {
      res.status(403).json({ error: limitCheck.reason, planLimit: true, remaining: limitCheck.remaining, planLabel: limitCheck.planLabel });
      return;
    }
  
    const model = MODEL_MAP[imageType] ?? MODEL_MAP.hero;
    const estimatedCost = COST_MAP[model] ?? 0.04;
  
    const finalPrompt = customPrompt ?? await buildImagePrompt(
      projectId, product.title, product.productType, imageType, project.storeNiche, project.brandTone, product.bodyHtml
    );
  
    const [job] = await db.insert(generationJobsTable).values({
      projectId,
      shopifyProductId,
      imageType,
      status: "pending",
      prompt: finalPrompt,
      negativePrompt: NEGATIVE_PROMPT,
      model,
      estimatedCost,
    }).returning();
  
    // Respond immediately with job ID — client polls for completion
    res.json({
      id: String(job.id),
      projectId,
      productId: shopifyProductId,
      imageType,
      status: "pending",
      prompt: finalPrompt,
      model,
      imageUrl: null,
      shopifyImageId: null,
      altText: null,
      estimatedCost,
      errorMessage: null,
      createdAt: job.createdAt.toISOString(),
      completedAt: null,
    });
  
    runAsync(() =>
      runImageGeneration({
        job,
        projectId,
        shopifyProductId,
        imageType,
        finalPrompt,
        model,
        estimatedCost,
        product: { title: product.title, productType: product.productType },
        project: { storeNiche: project.storeNiche, brandTone: project.brandTone, replicateApiToken: project.replicateApiToken },
        autoUploadToShopify: true,
        shopDomain: project.shopDomain,
      }).then(() => {})
    );
  } catch (err: any) {
    const msg = err instanceof Error ? err.message : "Internal server error";
    res.status(500).json({ error: msg });
  }
});

// ── Poll job status ──────────────────────────────────────────────────────────

router.get("/projects/:projectId/generation-jobs/:jobId", async (req, res): Promise<void> => {
  try {
    const projectId = parseInt(Array.isArray(req.params.projectId) ? req.params.projectId[0] : req.params.projectId, 10);
    const jobIdParam = Array.isArray(req.params.jobId) ? req.params.jobId[0] : req.params.jobId;
    const jobId = parseInt(jobIdParam, 10);
  
    const [job] = await db
      .select()
      .from(generationJobsTable)
      .where(and(eq(generationJobsTable.id, jobId), eq(generationJobsTable.projectId, projectId)));
  
    if (!job) {
      res.status(404).json({ error: "Job no encontrado" });
      return;
    }
  
    res.json({
      id: String(job.id),
      projectId: job.projectId,
      productId: job.shopifyProductId,
      imageType: job.imageType,
      status: job.status,
      prompt: job.prompt,
      model: job.model,
      imageUrl: job.imageUrl,
      shopifyImageId: job.shopifyImageId,
      altText: job.altText,
      estimatedCost: job.estimatedCost,
      errorMessage: job.errorMessage,
      createdAt: job.createdAt.toISOString(),
      completedAt: job.completedAt?.toISOString() ?? null,
    });
  } catch (err: any) {
    const msg = err instanceof Error ? err.message : "Internal server error";
    res.status(500).json({ error: msg });
  }
});

// ── Upload generated image to Shopify ────────────────────────────────────────

export async function uploadGeneratedImageToShopify(opts: {
  projectId: number;
  shopDomain: string;
  shopifyProductId: string;
  jobId: number;
  imageUrl: string;
  altText: string | null;
  imageType: string;
  position?: number;
}): Promise<{ success: boolean; shopifyImageId?: number; error?: string }> {
  try {
    if (!/^https?:\/\//.test(opts.imageUrl)) {
      return { success: false, error: "URL de imagen inválida" };
    }

    const imgResp = await fetch(opts.imageUrl, { signal: AbortSignal.timeout(FETCH_IMAGE_TIMEOUT_MS) });
    if (!imgResp.ok) return { success: false, error: `No se pudo descargar la imagen (${imgResp.status})` };

    const buffer = await imgResp.arrayBuffer();
    const base64 = Buffer.from(buffer).toString("base64");

    const uploadData = await shopifyRequest<{ image: { id: number } }>(
      opts.projectId, opts.shopDomain,
      `/products/${opts.shopifyProductId}/images.json`,
      { method: "POST", body: JSON.stringify({ image: { attachment: base64, alt: opts.altText ?? opts.imageType, position: opts.position ?? 1 } }) }
    );

    await db.update(generationJobsTable).set({ shopifyImageId: uploadData.image.id }).where(eq(generationJobsTable.id, opts.jobId));
    return { success: true, shopifyImageId: uploadData.image.id };
  } catch (e: unknown) {
    return { success: false, error: e instanceof Error ? e.message : "Error subiendo imagen" };
  }
}

router.post("/projects/:projectId/products/:productId/images/:imageId/upload-to-shopify", async (req, res): Promise<void> => {
  try {
    const projectId = parseInt(Array.isArray(req.params.projectId) ? req.params.projectId[0] : req.params.projectId, 10);
    const shopifyProductId = Array.isArray(req.params.productId) ? req.params.productId[0] : req.params.productId;
    const imageJobId = parseInt(Array.isArray(req.params.imageId) ? req.params.imageId[0] : req.params.imageId, 10);
  
    const [project] = await db.select().from(projectsTable).where(eq(projectsTable.id, projectId));
    const [job] = await db.select().from(generationJobsTable).where(eq(generationJobsTable.id, imageJobId));
  
    if (!project || !job || !job.imageUrl) {
      res.status(404).json({ error: "Imagen no encontrada o aún no generada" });
      return;
    }
  
    const uploadResult = await uploadGeneratedImageToShopify({
      projectId, shopDomain: project.shopDomain, shopifyProductId,
      jobId: imageJobId, imageUrl: job.imageUrl, altText: job.altText, imageType: job.imageType,
    });
  
    if (!uploadResult.success) {
      res.status(502).json({ error: uploadResult.error });
      return;
    }
  
    res.json({ success: true, message: "Imagen subida a Shopify correctamente" });
  } catch (err: any) {
    const msg = err instanceof Error ? err.message : "Internal server error";
    res.status(500).json({ error: msg });
  }
});

// ── SVG Infographic ──────────────────────────────────────────────────────────

router.post("/projects/:projectId/products/:productId/images/generate-infographic", async (req, res): Promise<void> => {
  enableLongRunning(res);
  try {
    
    const projectId = parseInt(Array.isArray(req.params.projectId) ? req.params.projectId[0] : req.params.projectId, 10);
    const shopifyProductId = Array.isArray(req.params.productId) ? req.params.productId[0] : req.params.productId;
  
    const [project] = await db.select().from(projectsTable).where(eq(projectsTable.id, projectId));
    const [product] = await db
      .select()
      .from(productsTable)
      .where(and(eq(productsTable.projectId, projectId), eq(productsTable.shopifyProductId, shopifyProductId)));
  
    if (!project || !product) {
      res.status(404).json({ error: "Producto no encontrado" });
      return;
    }
  
    const prompt = `Genera una infografía SVG profesional para el producto "${product.title}" de la tienda "${project.name}" (nicho: ${project.storeNiche ?? "e-commerce"}).
  
  El SVG debe incluir:
  - Fondo degradado oscuro premium (de #08080f a #1a1a2e)
  - Nombre del producto como titular grande en blanco
  - 6 características/beneficios clave del producto con iconos SVG (checkmarks o símbolos relevantes) en color violeta (#5b4eff)
  - Badge de calidad premium
  - Tipografía limpia, minimalista y profesional
  - Dimensiones: 1080x1080px (viewBox="0 0 1080 1080")
  
  Devuelve SOLO el SVG completo, sin markdown, sin explicaciones. Empieza con <svg y termina con </svg>.`;
  
    const svgContent = await askClaudeWithBrain(projectId, [{ role: "user", content: prompt }], undefined, "general", project.storeNiche ?? undefined, 4000);
    const cleanSvg = svgContent.includes("<svg") ? svgContent.substring(svgContent.indexOf("<svg")) : svgContent;
  
    learnFromOperation({
      operationType: "svg_generation",
      title: `SVG generado: ${req.body.type || "logo"} para ${project.name}`,
      content: `Tipo: ${req.body.type}, Estilo: ${req.body.style || "brand"}, Nicho: ${project.storeNiche}`,
      confidence: 0.7,
      tags: ["svg", "brand_asset", "design"],
    });
  
    res.json({ svgContent: cleanSvg, pngBase64: null, uploaded: false });
  } catch (err: any) {
    const msg = err instanceof Error ? err.message : "Internal server error";
    res.status(500).json({ error: msg });
  }
});

// ── Bulk image generation (FIXED: actually runs Replicate per product) ───────

router.post("/projects/:projectId/bulk-generate-images", async (req, res): Promise<void> => {
  try {
    const projectId = parseInt(Array.isArray(req.params.projectId) ? req.params.projectId[0] : req.params.projectId, 10);
    const { productIds, imageTypes } = req.body as { productIds: string[]; imageTypes: string[] };
  
    if (!productIds?.length || !imageTypes?.length) {
      res.status(400).json({ error: "Se requiere al menos un producto y un tipo de imagen" });
      return;
    }
  
    const totalItems = productIds.length * imageTypes.length;
  
    const bulkLimitCheck = await checkProductionLimit(projectId, "image", totalItems);
    if (!bulkLimitCheck.allowed) {
      res.status(403).json({ error: bulkLimitCheck.reason, planLimit: true, remaining: bulkLimitCheck.remaining, planLabel: bulkLimitCheck.planLabel });
      return;
    }
  
    const jobId = await createBulkJob(projectId, "bulk_image_generation", totalItems);
  
    res.json({
      jobId,
      status: "running",
      totalItems,
      message: `Generando ${totalItems} imágenes para ${productIds.length} productos...`,
    });
  
    // ── Background: actually generate each image ──────────────────────────────
    runAsync(async () => {
      const [project] = await db.select().from(projectsTable).where(eq(projectsTable.id, projectId));
      if (!project) {
        await completeJob(jobId, { error: "Proyecto no encontrado" });
        return;
      }
  
      if (!project.replicateApiToken) {
        await completeJob(jobId, { error: "No hay Replicate API token configurado" });
        return;
      }
  
      let completed = 0;
      let failed = 0;
  
      for (const productId of productIds) {
        const [product] = await db
          .select()
          .from(productsTable)
          .where(and(eq(productsTable.projectId, projectId), eq(productsTable.shopifyProductId, productId)));
  
        if (!product) {
          failed += imageTypes.length;
          await updateJobProgress(jobId, completed, failed, `✗ Producto ${productId} no encontrado`);
          continue;
        }
  
        for (const imageType of imageTypes) {
          const model = MODEL_MAP[imageType] ?? MODEL_MAP.hero;
          const estimatedCost = COST_MAP[model] ?? 0.04;
  
          try {
            const finalPrompt = await buildImagePrompt(
              projectId, product.title, product.productType, imageType,
              project.storeNiche, project.brandTone, product.bodyHtml
            );
  
            // Insert the job record
            const [genJob] = await db.insert(generationJobsTable).values({
              projectId,
              shopifyProductId: productId,
              imageType,
              status: "pending",
              prompt: finalPrompt,
              negativePrompt: NEGATIVE_PROMPT,
              model,
              estimatedCost,
            }).returning();
  
            const result = await runImageGeneration({
              job: genJob,
              projectId,
              shopifyProductId: productId,
              imageType,
              finalPrompt,
              model,
              estimatedCost,
              product: { title: product.title, productType: product.productType },
              project: {
                storeNiche: project.storeNiche,
                brandTone: project.brandTone,
                replicateApiToken: project.replicateApiToken,
              },
              autoUploadToShopify: true,
              shopDomain: project.shopDomain,
            });
  
            if (result.success) {
              completed++;
              await recordUsage(projectId, "image", 1);
              await updateJobProgress(jobId, completed, failed, `✓ ${product.title} — ${imageType}`);
            } else {
              failed++;
              await updateJobProgress(jobId, completed, failed, `✗ ${product.title} — ${imageType}: ${result.error}`);
            }
          } catch (err) {
            failed++;
            const msg = err instanceof Error ? err.message : "Error desconocido";
            await updateJobProgress(jobId, completed, failed, `✗ ${product.title} — ${imageType}: ${msg}`);
          }
  
          await new Promise((r) => setTimeout(r, 12_000));
        }
      }
  
      await completeJob(jobId, { completed, failed, total: totalItems });
    });
  } catch (err: any) {
    const msg = err instanceof Error ? err.message : "Internal server error";
    res.status(500).json({ error: msg });
  }
});

router.post("/projects/:projectId/bulk-upload-generated-images", async (req, res): Promise<void> => {
  try {
    const projectId = parseInt(Array.isArray(req.params.projectId) ? req.params.projectId[0] : req.params.projectId, 10);
  
    const [project] = await db.select().from(projectsTable).where(eq(projectsTable.id, projectId));
    if (!project) { res.status(404).json({ error: "Proyecto no encontrado" }); return; }
    if (!project.shopDomain) { res.status(400).json({ error: "Proyecto sin dominio Shopify configurado" }); return; }
    if (!project.accessToken) { res.status(400).json({ error: "Proyecto sin token Shopify configurado" }); return; }
  
    const pendingJobs = await db.select().from(generationJobsTable)
      .where(and(
        eq(generationJobsTable.projectId, projectId),
        eq(generationJobsTable.status, "succeeded"),
      ));
  
    const notUploaded = pendingJobs.filter(j => !j.shopifyImageId && j.imageUrl);
  
    if (notUploaded.length === 0) {
      res.json({ message: "No hay imágenes pendientes de subir a Shopify", uploaded: 0 });
      return;
    }
  
    const jobId = await createBulkJob(projectId, "bulk_image_upload", notUploaded.length);
    res.json({ jobId, message: `Subiendo ${notUploaded.length} imágenes a Shopify...`, total: notUploaded.length });
  
    runAsync(async () => {
      let uploaded = 0;
      let failed = 0;
      for (const job of notUploaded) {
        try {
          const uploadResult = await uploadGeneratedImageToShopify({
            projectId,
            shopDomain: project.shopDomain,
            shopifyProductId: job.shopifyProductId,
            jobId: job.id,
            imageUrl: job.imageUrl!,
            altText: job.altText,
            imageType: job.imageType,
          });
          if (uploadResult.success) {
            uploaded++;
            await updateJobProgress(jobId, uploaded, failed, `✓ Subida imagen ${job.imageType} para producto ${job.shopifyProductId}`);
          } else {
            failed++;
            await updateJobProgress(jobId, uploaded, failed, `✗ ${uploadResult.error}`);
          }
        } catch {
          failed++;
          await updateJobProgress(jobId, uploaded, failed, `✗ Error subiendo imagen`);
        }
        await new Promise(r => setTimeout(r, 2000));
      }
      await completeJob(jobId, { uploaded, failed, total: notUploaded.length });
    });
  } catch (err: any) {
    const msg = err instanceof Error ? err.message : "Internal server error";
    res.status(500).json({ error: msg });
  }
});

export default router;
