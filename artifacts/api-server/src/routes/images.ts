import { Router } from "express";
import { db } from "@workspace/db";
import { projectsTable, productsTable, generationJobsTable } from "@workspace/db";
import { saveToVault } from "../lib/vault.js";
import { eq, and } from "drizzle-orm";
import { shopifyRequest } from "../lib/shopify";
import { askClaudeWithBrain, learnFromOperation } from "../lib/claude";
import { createBulkJob, updateJobProgress, completeJob, runAsync } from "../lib/bulk-queue";
import { checkProductionLimit, recordUsage } from "../lib/plan-limits.js";

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

function detectProductCategory(productTitle: string, productType: string | null): "physical" | "digital_art" | "digital_service" | "credits" | "subscription" | "comic" | "audiobook" | "report" {
  const title = normalizeText(productTitle);
  const pType = normalizeText(productType ?? "");
  const combined = title + " " + pType;

  if (/audiobook/i.test(combined)) return "audiobook";

  if (/creditos|credits/i.test(title) || /pack de creditos/i.test(pType)) return "credits";

  if (/suscripcion|saas/i.test(pType)) return "subscription";
  if (/\b(starter|enterprise)\b/i.test(title) && /shopybrain|shopy/i.test(title)) return "subscription";
  if (/agency pro/i.test(title)) return "subscription";

  if (/resina|funko/i.test(combined)) return "physical";
  if (/impresion 3d/i.test(pType)) return "physical";

  if (/manga|pet comic/i.test(title)) return "comic";
  if (/comic personalizado|manga personalizado/i.test(pType)) return "comic";
  const titleNoStore = title.replace(/comic crafter/gi, "");
  if (/comic/i.test(titleNoStore)) return "comic";

  if (/pack de servicios|creacion producto|pack.*productos/i.test(combined)) return "digital_service";

  if (/informe|auditoria|analisis|seo shopify|email marketing|setup.*shopify|sesion.*shopify|investigacion|proyeccion|rediseno|optimizacion|campanas|consultoria/i.test(combined)) return "report";
  if (/optimizacion|auditoria|analisis|seo|email marketing|investigacion|proyeccion|rediseno|consultoria/i.test(pType)) return "report";

  if (/nft|arte digital|tatuaje|retrato|pop art|sticker|emoji|avatar|personaje 360|ilustracion|portada|storyboard|branding|logo|poster|canvas|album|cuento infantil|escape room|tcg|cartas/i.test(combined)) return "digital_art";

  if (/3d.*model|figura.*3d|merchandising|camiseta|taza/i.test(combined)) return "physical";

  if (/assets|videojuegos|modelos 3d|game/i.test(combined)) return "digital_art";
  if (/fotografia|photoshoot|imagenes/i.test(combined)) return "digital_service";

  return "digital_service";
}

export async function buildImagePrompt(
  projectId: number,
  productTitle: string,
  productType: string | null,
  imageType: string,
  storeNiche: string | null,
  brandTone: string | null
): Promise<string> {
  const category = detectProductCategory(productTitle, productType);
  const BASE_QUALITY = "high resolution 4k, sharp focus, professional commercial quality";

  const physicalConfigs: Record<string, { prefix: string; scene: string; suffix: string }> = {
    hero: {
      prefix: "Professional studio product photo,",
      scene: "pure white background, 3-point lighting setup, soft shadows, centered composition",
      suffix: "e-commerce hero shot, Phase One quality, no reflections",
    },
    lifestyle: {
      prefix: "Lifestyle product photography,",
      scene: "aspirational real-world context matching brand aesthetic, natural lighting, shallow depth of field",
      suffix: "editorial magazine quality, authentic atmosphere",
    },
    detail: {
      prefix: "Extreme macro product photography,",
      scene: "close-up texture detail, micro-lens quality, bokeh background, emphasizing material quality",
      suffix: "luxury brand detail shot, 100mm macro lens look",
    },
  };

  const digitalArtConfigs: Record<string, { prefix: string; scene: string; suffix: string }> = {
    hero: {
      prefix: "Stunning digital artwork showcase,",
      scene: "the artwork displayed on a sleek modern device screen or gallery wall, dramatic cinematic lighting, rich vibrant colors",
      suffix: "digital art portfolio quality, Behance featured project aesthetic",
    },
    lifestyle: {
      prefix: "Creative professional workspace scene,",
      scene: "artist using a tablet/screen showing the digital artwork, modern creative studio environment, warm ambient lighting, inspiration boards in background",
      suffix: "aspirational creative lifestyle, editorial magazine quality",
    },
    detail: {
      prefix: "Close-up of digital artwork details,",
      scene: "zoomed-in view showing intricate artistic details, color palette, brushwork/vector precision, on high-resolution retina display",
      suffix: "artistic detail showcase, gallery exhibition quality",
    },
  };

  const comicConfigs: Record<string, { prefix: string; scene: string; suffix: string }> = {
    hero: {
      prefix: "Epic comic book cover illustration,",
      scene: "dynamic action pose, bold comic book colors, dramatic perspective, speech bubbles, halftone dots pattern, panel borders visible",
      suffix: "professional comic book art, Marvel/DC cover quality, vibrant and eye-catching",
    },
    lifestyle: {
      prefix: "Person enjoying reading a custom comic book,",
      scene: "cozy reading nook, the comic book open showing colorful illustrated pages, warm lighting, excited expression, immersive storytelling moment",
      suffix: "editorial lifestyle photography, authentic reading experience, comic collector atmosphere",
    },
    detail: {
      prefix: "Detailed comic book page layout,",
      scene: "multiple panels showing sequential art, expressive character faces, dynamic action lines, professional lettering, rich ink work",
      suffix: "professional comic interior art quality, clear panel composition, engaging visual narrative",
    },
  };

  const audiobookConfigs: Record<string, { prefix: string; scene: string; suffix: string }> = {
    hero: {
      prefix: "Premium audiobook listening experience,",
      scene: "stylish headphones with glowing sound waves emanating, comic book pages floating and transforming into audio waveforms, dark atmospheric background with neon accents",
      suffix: "premium audio product visual, Audible-quality promotional art",
    },
    lifestyle: {
      prefix: "Person immersed in audiobook experience,",
      scene: "wearing premium headphones with eyes closed, enjoying the story, comic characters subtly appearing as imagination visuals around them, warm cozy environment",
      suffix: "aspirational audio lifestyle, emotional storytelling moment",
    },
    detail: {
      prefix: "Audio waveform visualization art,",
      scene: "beautiful sound wave pattern with comic art elements integrated, character silhouettes within the waveform, vibrant frequency spectrum colors, play button icon",
      suffix: "modern audio tech aesthetic, premium digital product visual",
    },
  };

  const creditConfigs: Record<string, { prefix: string; scene: string; suffix: string }> = {
    hero: {
      prefix: "Premium digital credit pack promotional graphic,",
      scene: "glowing golden/neon credit tokens floating in space, futuristic holographic interface, quantity numbers displayed prominently, sleek dark background with gradient accents",
      suffix: "premium SaaS product visual, modern fintech aesthetic",
    },
    lifestyle: {
      prefix: "Creative professional using AI generation platform,",
      scene: "person at modern workstation generating amazing digital art with AI tools, multiple stunning outputs visible on screens, creative energy and productivity",
      suffix: "aspirational creator economy lifestyle, productivity showcase",
    },
    detail: {
      prefix: "Infographic showing credit pack value breakdown,",
      scene: "clean modern infographic design showing what credits unlock: comics, 3D models, art, animations — each with small icon, value proposition clear, premium pricing card design",
      suffix: "modern SaaS pricing visual, clear value communication",
    },
  };

  const subscriptionConfigs: Record<string, { prefix: string; scene: string; suffix: string }> = {
    hero: {
      prefix: "Premium SaaS platform dashboard showcase,",
      scene: "sleek modern dashboard interface with analytics, AI automation indicators, multiple store management panels, dark mode UI with accent colors, floating holographic elements",
      suffix: "enterprise software visual, professional SaaS product hero",
    },
    lifestyle: {
      prefix: "Business owner managing multiple Shopify stores with AI,",
      scene: "confident entrepreneur at modern desk, multiple screens showing store analytics and AI optimizations, success metrics rising, professional office environment",
      suffix: "business success lifestyle, aspirational entrepreneur visual",
    },
    detail: {
      prefix: "AI automation feature showcase,",
      scene: "detailed view of AI engine processing product optimizations, neural network visualization, before/after product improvements, performance metrics graphs",
      suffix: "tech product feature detail, enterprise software quality",
    },
  };

  const reportConfigs: Record<string, { prefix: string; scene: string; suffix: string }> = {
    hero: {
      prefix: "Professional business report/service deliverable,",
      scene: "elegant report document mockup on tablet/laptop screen showing charts and insights, clean data visualization, professional consulting aesthetic, dark premium background",
      suffix: "consulting deliverable visual, McKinsey-quality presentation",
    },
    lifestyle: {
      prefix: "Business professional reviewing strategic analysis,",
      scene: "professional in modern office analyzing data on screen, charts showing growth trends, strategic planning session, confident decision-making moment",
      suffix: "business consulting lifestyle, professional service visual",
    },
    detail: {
      prefix: "Data analytics dashboard detail,",
      scene: "close-up of professional charts, KPI metrics, conversion funnels, SEO performance graphs, clean modern data visualization design, actionable insights highlighted",
      suffix: "business intelligence visual, data-driven decision aesthetic",
    },
  };

  const serviceConfigs: Record<string, { prefix: string; scene: string; suffix: string }> = {
    hero: {
      prefix: "Professional service package promotional visual,",
      scene: "elegant service offering display with included deliverables shown as floating elements, premium badge/seal, modern gradient background, trust indicators",
      suffix: "professional service visual, premium offering aesthetic",
    },
    lifestyle: {
      prefix: "Happy client reviewing their optimized Shopify store,",
      scene: "entrepreneur excitedly looking at improved store on laptop, visible sales notifications, modern workspace, growth metrics on screen",
      suffix: "client success story visual, service results showcase",
    },
    detail: {
      prefix: "Service deliverables breakdown visual,",
      scene: "clean infographic showing each included component: images, SEO, copywriting, optimization — with checkmarks, professional icons, modern card design",
      suffix: "service inclusions detail, premium package visual",
    },
  };

  const configMap: Record<string, Record<string, { prefix: string; scene: string; suffix: string }>> = {
    physical: physicalConfigs,
    digital_art: digitalArtConfigs,
    comic: comicConfigs,
    audiobook: audiobookConfigs,
    credits: creditConfigs,
    subscription: subscriptionConfigs,
    report: reportConfigs,
    digital_service: serviceConfigs,
  };

  const configs = configMap[category] ?? serviceConfigs;
  const config = configs[imageType] ?? configs.hero;
  const subjectAnchor = `SUBJECT: "${productTitle}"${productType ? ` (category: ${productType})` : ""}`;

  return `${config.prefix} ${subjectAnchor}, ${config.scene}, store niche: ${storeNiche ?? "comics and digital art"}, brand tone: ${brandTone ?? "professional creative"}, ${BASE_QUALITY}, ${config.suffix}`;
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
  const estimatedCost = COST_MAP[model] ?? 0.04;
  const estimatedTime = model.includes("flux-dev") ? 20 : model.includes("recraft") ? 15 : 10;

  const prompt = await buildImagePrompt(
    projectId, product.title, product.productType, imageType, project.storeNiche, project.brandTone
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
});

// ── Single image generation ──────────────────────────────────────────────────

router.post("/projects/:projectId/products/:productId/images/generate", async (req, res): Promise<void> => {
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
    projectId, product.title, product.productType, imageType, project.storeNiche, project.brandTone
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
});

// ── Poll job status ──────────────────────────────────────────────────────────

router.get("/projects/:projectId/generation-jobs/:jobId", async (req, res): Promise<void> => {
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
});

// ── SVG Infographic ──────────────────────────────────────────────────────────

router.post("/projects/:projectId/products/:productId/images/generate-infographic", async (req, res): Promise<void> => {
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
});

// ── Bulk image generation (FIXED: actually runs Replicate per product) ───────

router.post("/projects/:projectId/bulk-generate-images", async (req, res): Promise<void> => {
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
            project.storeNiche, project.brandTone
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
});

router.post("/projects/:projectId/bulk-upload-generated-images", async (req, res): Promise<void> => {
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
});

export default router;
