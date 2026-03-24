import { Router } from "express";
import { db } from "@workspace/db";
import { projectsTable, productsTable, generationJobsTable } from "@workspace/db";
import { saveToVault } from "../lib/vault.js";
import { eq, and } from "drizzle-orm";
import { shopifyRequest } from "../lib/shopify";
import { askClaude, askClaudeWithBrain, learnFromOperation } from "../lib/claude";
import { createBulkJob, updateJobProgress, completeJob, runAsync } from "../lib/bulk-queue";
import { checkProductionLimit, recordUsage } from "../lib/plan-limits.js";

const router = Router();

// ── Constants ───────────────────────────────────────────────────────────────

const MODEL_MAP: Record<string, string> = {
  hero: "black-forest-labs/flux-1.1-pro",
  lifestyle: "black-forest-labs/flux-1.1-pro",
  bundle: "black-forest-labs/flux-1.1-pro",
  detail: "black-forest-labs/flux-dev",
  scale: "black-forest-labs/flux-dev",
  packaging: "recraft-ai/recraft-v3",
  ugc: "recraft-ai/recraft-v3",
  infographic: "svg_only",
};

const COST_MAP: Record<string, number> = {
  "black-forest-labs/flux-1.1-pro": 0.04,
  "black-forest-labs/flux-dev": 0.025,
  "recraft-ai/recraft-v3": 0.022,
  svg_only: 0,
};

const NEGATIVE_PROMPT =
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

async function buildImagePrompt(
  projectId: number,
  productTitle: string,
  productType: string | null,
  imageType: string,
  storeNiche: string | null,
  brandTone: string | null
): Promise<string> {
  const typeConfigs: Record<string, { prefix: string; scene: string; suffix: string }> = {
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
    packaging: {
      prefix: "Premium unboxing photography,",
      scene: "branded packaging on neutral surface, tissue paper, branded elements visible, flatlay composition",
      suffix: "luxury unboxing experience, clean minimal setup",
    },
    ugc: {
      prefix: "Candid lifestyle social media photo,",
      scene: "authentic user-generated content style, real person context, slightly imperfect composition, genuine feel",
      suffix: "Instagram organic post quality, trustworthy and relatable",
    },
    scale: {
      prefix: "Product scale reference photography,",
      scene: "product next to human hand or common everyday object (smartphone, coffee cup), showing exact proportions",
      suffix: "clean background, clear size comparison, informative composition",
    },
    bundle: {
      prefix: "Product bundle flat lay photography,",
      scene: "main product with 2-3 complementary items, styled arrangement, overhead shot, consistent aesthetic",
      suffix: "cross-selling visual, premium styled flatlay",
    },
  };

  const config = typeConfigs[imageType] ?? typeConfigs.hero;
  const BASE_QUALITY = "professional product photography, commercial quality, sharp focus, high resolution 4k";
  const subjectAnchor = `SUBJECT: ${productTitle}${productType ? ` (${productType})` : ""}`;

  return `${config.prefix} ${subjectAnchor}, ${config.scene}, niche: ${storeNiche ?? "e-commerce"}, brand tone: ${brandTone ?? "professional"}, ${BASE_QUALITY}, ${config.suffix}`;
}

/**
 * Core image generation logic — shared by single and bulk generators.
 * Handles Replicate call with proper timeout, DB updates, vault save, and learning.
 */
async function runImageGeneration(params: {
  job: { id: number };
  projectId: number;
  shopifyProductId: string;
  imageType: string;
  finalPrompt: string;
  model: string;
  estimatedCost: number;
  product: { title: string; productType: string | null };
  project: { storeNiche: string | null; brandTone: string | null; replicateApiToken: string | null };
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

    let runPromise: Promise<unknown>;
    if (model.includes("flux-1.1-pro")) {
      runPromise = replicate.run(model as `${string}/${string}`, {
        input: { prompt: finalPrompt, negative_prompt: NEGATIVE_PROMPT, width: 1440, height: 1440, num_outputs: 1, output_format: "png", output_quality: 100 },
      });
    } else if (model.includes("recraft")) {
      runPromise = replicate.run(model as `${string}/${string}`, {
        input: { prompt: finalPrompt, size: "1365x1365", style: "realistic_image" },
      });
    } else {
      runPromise = replicate.run(model as `${string}/${string}`, {
        input: { prompt: finalPrompt, negative_prompt: NEGATIVE_PROMPT, width: 1440, height: 1440, num_inference_steps: 35, guidance_scale: 3.5, output_format: "png" },
      });
    }

    // ── Replicate timeout (5 minutes) ───────────────────────────────────────
    const output = await withTimeout(runPromise, REPLICATE_TIMEOUT_MS, `Replicate ${model}`);
    const imageUrl = Array.isArray(output) ? (output[0] as string) : (output as string);

    const altTextPrompt = `Generate a concise SEO alt text (max 125 chars) for a Shopify product image. Product: ${product.title}. Image type: ${imageType}. Store niche: ${project.storeNiche ?? "e-commerce"}. Include main keyword naturally. In Spanish.`;
    const altText = await askClaudeWithBrain(projectId, [{ role: "user", content: altTextPrompt }], undefined, "images", project.storeNiche ?? undefined);

    await db.update(generationJobsTable)
      .set({ status: "succeeded", imageUrl, altText: altText.slice(0, 125), completedAt: new Date() })
      .where(eq(generationJobsTable.id, job.id));

    // Auto-guardar en el vault del proyecto
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
  const { imageType, customPrompt } = req.body as { imageType: string; customPrompt?: string };

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

  // Run generation in background — fully async
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

  // ── Fetch generated image with timeout ──────────────────────────────────
  const imgResp = await fetch(job.imageUrl, {
    signal: AbortSignal.timeout(FETCH_IMAGE_TIMEOUT_MS),
  });

  if (!imgResp.ok) {
    res.status(502).json({ error: `No se pudo descargar la imagen generada (${imgResp.status})` });
    return;
  }

  const buffer = await imgResp.arrayBuffer();
  const base64 = Buffer.from(buffer).toString("base64");

  const uploadData = await shopifyRequest<{ image: { id: number } }>(
    projectId,
    project.shopDomain,
    `/products/${shopifyProductId}/images.json`,
    {
      method: "POST",
      body: JSON.stringify({
        image: { attachment: base64, alt: job.altText ?? job.imageType, position: 1 },
      }),
    }
  );

  await db.update(generationJobsTable)
    .set({ shopifyImageId: uploadData.image.id })
    .where(eq(generationJobsTable.id, imageJobId));

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

  const svgContent = await askClaude(projectId, [{ role: "user", content: prompt }]);
  const cleanSvg = svgContent.includes("<svg") ? svgContent.substring(svgContent.indexOf("<svg")) : svgContent;

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

          // Actually run Replicate generation
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

        // Small delay between Replicate calls to avoid rate limiting
        await new Promise((r) => setTimeout(r, 500));
      }
    }

    await completeJob(jobId, { completed, failed, total: totalItems });
  });
});

export default router;
