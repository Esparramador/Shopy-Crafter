import { Router } from "express";
import { db } from "@workspace/db";
import { projectsTable, productsTable, redesignsTable } from "@workspace/db";
import { eq, and, lte, desc } from "drizzle-orm";
import { shopifyRequest } from "../lib/shopify";
import { askClaudeJsonWithBrain, learnFromOperation, SHOPIFY_EXPERT_SYSTEM } from "../lib/claude";
import { createBulkJob, updateJobProgress, completeJob, failJob, runAsync } from "../lib/bulk-queue";
import { saveToVault } from "../lib/vault.js";

const router = Router();

interface RedesignOutput {
  title: string;
  body_html: string;
  short_description: string;
  price: string;
  compare_at_price: string;
  tags: string;
  meta_title: string;
  meta_description: string;
  photo_brief: string[];
  price_reasoning: string;
}

async function doRedesign(projectId: number, shopifyProductId: string): Promise<RedesignOutput> {
  const [project] = await db.select().from(projectsTable).where(eq(projectsTable.id, projectId));
  const [product] = await db
    .select()
    .from(productsTable)
    .where(and(eq(productsTable.projectId, projectId), eq(productsTable.shopifyProductId, shopifyProductId)));

  if (!product || !project) throw new Error("Producto o proyecto no encontrado");

  let variantsSection = "";
  let optionsSection = "";
  let livePrice = product.price;

  try {
    const liveData = await shopifyRequest<{
      product: {
        variants: Array<{ id: number; title: string; price: string; compare_at_price: string | null; sku: string | null; option1: string | null; option2: string | null; option3: string | null }>;
        options: Array<{ name: string; values: string[] }>;
      }
    }>(projectId, project.shopDomain, `/products/${shopifyProductId}.json`);

    if (liveData?.product?.variants?.length) {
      livePrice = liveData.product.variants[0].price;
      optionsSection = liveData.product.options
        .map((o) => `${o.name}: ${o.values.join(", ")}`)
        .join("\n");
      variantsSection = liveData.product.variants
        .map((v) => `  - ${v.title} | Precio: €${v.price}${v.compare_at_price ? ` (antes €${v.compare_at_price})` : ""}${v.sku ? ` | SKU: ${v.sku}` : ""}`)
        .join("\n");
    }
  } catch {
    variantsSection = "";
  }

  const prompt = `Estás rediseñando un producto de Shopify para la tienda "${project.name}" al ESTÁNDAR DE CALIDAD 100/100 — el nivel de las mejores tiendas Shopify del mundo.

Nicho: ${project.storeNiche ?? "e-commerce"}
Audiencia: ${project.targetAudience ?? "adultos con gusto por la calidad"}
Tono de marca: ${project.brandTone ?? "profesional"}
Mercados: ${project.storeMarkets ?? "España/Europa"}

DATOS REALES ACTUALES DEL PRODUCTO:
Título: ${product.title}
Tipo de producto: ${product.productType ?? "sin definir"}
Descripción actual: ${product.bodyHtml?.replace(/<[^>]+>/g, "").slice(0, 800) ?? "(vacía)"}
Precio actual: €${livePrice ?? "no configurado"}
Tags actuales: ${product.tags ?? "ninguno"}
Imágenes actuales: ${product.imageCount}
Vendor: ${product.vendor ?? "no definido"}
${optionsSection ? `\nOpciones del producto:\n${optionsSection}` : ""}
${variantsSection ? `\nVariantes reales:\n${variantsSection}` : ""}

INSTRUCCIONES CRÍTICAS — CALIDAD 100/100:
1. El título y descripción DEBEN hacer referencia al producto EXACTO (no inventes otro)
2. Los photo_brief DEBEN describir imágenes de "${product.title}" específicamente

REQUISITOS DE CALIDAD ABSOLUTA:

TÍTULO (45-65 chars):
- Keyword principal AL INICIO
- Formato: [Keyword] — [Beneficio/Diferenciador] | [Detalle]

DESCRIPCIÓN HTML (800-1200 palabras MÍNIMO, 8 secciones obligatorias):
Sección 1: HERO HOOK — H2 emotivo + storytelling emocional (80-100 palabras)
Sección 2: BENEFICIOS CLAVE — H2 + lista ✅ con mínimo 8 beneficios concretos
Sección 3: ESPECIFICACIONES TÉCNICAS — H2 + tabla HTML (material, dimensiones, peso, color, origen)
Sección 4: ¿PARA QUIÉN ES PERFECTO? — H2 + 4-5 buyer personas con emojis
Sección 5: CUIDADO Y MANTENIMIENTO — H3 + instrucciones específicas
Sección 6: FAQ — H2 + 4-5 preguntas/respuestas que resuelven objeciones de compra
Sección 7: CTA Y CIERRE — Párrafo persuasivo con urgencia sutil
Sección 8: TRUST BADGES — 📦 Envío Seguro | 🔄 Devolución 30 días | ✅ Garantía | 🌿 Premium

USA: <h2>, <h3>, <ul>/<li>, <table>, <strong>, <p>. SIN estilos inline.

OPTIMIZACIÓN SEO AVANZADA (Metodología Semrush):
- KEYWORD DENSITY: Keyword principal 3-5 veces en la descripción (densidad 1.5-2.5%)
- KEYWORD PROMINENCE: Keyword principal en el PRIMER PÁRRAFO (Hero Hook) y en al menos 2 H2
- LSI KEYWORDS: 5-8 keywords semánticas relacionadas distribuidas naturalmente
- READABILITY: Frases 15-25 palabras. Párrafos 2-4 líneas. Voz activa. Score Flesch legible.
- FAQ SCHEMA-READY: Formato <strong>¿Pregunta?</strong> + <p>Respuesta</p> para Rich Snippets Google
- SEARCH INTENT: Todo el contenido orientado a intención TRANSACCIONAL (comprar, conseguir, pedir)

Devuelve SOLO JSON:
{
  "title": "título SEO 45-65 chars, keyword transaccional primero",
  "body_html": "<div class='product-description'>HTML 800-1200 palabras, 8 secciones, keyword density 1.5-2.5%, FAQ schema-ready</div>",
  "short_description": "50 palabras para meta/preview con keyword principal",
  "price": "precio con pricing psicológico (.99/.95)",
  "compare_at_price": "PVP tachado 20-35% superior",
  "tags": "22-28 tags: producto+material+intención transaccional+audiencia+estilo+long-tail+LSI+inglés",
  "meta_title": "40-60 chars: [Keyword] — [Beneficio] | [Marca]",
  "meta_description": "130-155 chars: [Beneficio]. [Keyword+detalle]. [CTA urgencia]. Responder intent en primeros 100 chars",
  "photo_brief": ["8 briefs: hero frontal", "lifestyle en contexto", "detalle/textura macro", "escala/tamaño con referencia", "packaging premium", "proceso/behind-the-scenes", "variante/color alternativo", "UGC/modelo real"],
  "price_reasoning": "justificación con análisis competitivo y posicionamiento de mercado"
}`;

  return await askClaudeJsonWithBrain<RedesignOutput>(projectId, prompt, SHOPIFY_EXPERT_SYSTEM, "redesign", project.storeNiche ?? undefined, 8000);
}

router.post("/projects/:projectId/products/:productId/redesign", async (req, res): Promise<void> => {
  const projectId = parseInt(Array.isArray(req.params.projectId) ? req.params.projectId[0] : req.params.projectId, 10);
  const shopifyProductId = Array.isArray(req.params.productId) ? req.params.productId[0] : req.params.productId;
  const parts: string[] | undefined = req.body?.parts;

  const [product] = await db
    .select()
    .from(productsTable)
    .where(and(eq(productsTable.projectId, projectId), eq(productsTable.shopifyProductId, shopifyProductId)));

  if (!product) {
    res.status(404).json({ error: "Producto no encontrado" });
    return;
  }

  const result = await doRedesign(projectId, shopifyProductId);

  if (parts && parts.length > 0 && parts.length < 6) {
    const allParts = ["title", "bodyHtml", "price", "tags", "metafields", "photoBriefs"];
    for (const key of allParts) {
      if (!parts.includes(key)) {
        if (key === "title") result.title = product.title;
        if (key === "bodyHtml" || key === "body_html") result.body_html = product.bodyHtml ?? "";
        if (key === "price") {
          result.price = product.price ?? "0";
          result.compare_at_price = "";
          result.price_reasoning = "Precio original mantenido (no incluido en rediseño parcial)";
        }
        if (key === "tags") result.tags = product.tags ?? "";
        if (key === "metafields") {
          result.meta_title = "";
          result.meta_description = "";
        }
        if (key === "photoBriefs") result.photo_brief = [];
      }
    }
  }

  await db.insert(redesignsTable).values({
    projectId,
    shopifyProductId,
    originalTitle: product.title,
    originalPrice: product.price,
    newTitle: result.title,
    newBodyHtml: result.body_html,
    newShortDescription: result.short_description,
    newPrice: result.price,
    newCompareAtPrice: result.compare_at_price,
    newTags: result.tags,
    metaTitle: result.meta_title,
    metaDescription: result.meta_description,
    photoBrief: result.photo_brief,
    priceReasoning: result.price_reasoning,
  });

  // ShopyBrain aprende del rediseño exitoso (fire-and-forget)
  const [redesignProj] = await db.select({ storeNiche: projectsTable.storeNiche }).from(projectsTable).where(eq(projectsTable.id, projectId)).catch(() => [null]);
  learnFromOperation({
    operationType: "redesign",
    niche: redesignProj?.storeNiche ?? null,
    productType: product.productType ?? null,
    title: `Rediseño exitoso: ${result.title}`,
    content: `Título optimizado: ${result.title}\nPrecio: €${result.price}\nRazonamiento: ${result.price_reasoning}\nMeta: ${result.meta_title}\nDescripción corta: ${result.short_description}\nTags: ${result.tags}`,
    confidence: 0.72,
    tags: result.tags ? result.tags.split(",").map(t => t.trim()).slice(0, 6) : [],
  });

  // Auto-guardar en vault: informe de rediseño completo
  saveToVault({
    projectId,
    fileType: "redesign",
    category: "full_redesign",
    title: `Rediseño — ${product.title}`,
    description: `Nuevo título: ${result.title} · Precio: €${result.price}`,
    mimeType: "application/json",
    productId: shopifyProductId,
    productTitle: product.title,
    generatedBy: "redesign_motor",
    metadata: {
      originalTitle: product.title,
      originalPrice: product.price,
      newTitle: result.title,
      newPrice: result.price,
      newCompareAtPrice: result.compare_at_price,
      metaTitle: result.meta_title,
      metaDescription: result.meta_description,
      photoBrief: result.photo_brief,
      priceReasoning: result.price_reasoning,
      body_html: result.body_html,
      short_description: result.short_description,
      tags: result.tags,
    },
  }).catch(() => {});

  res.json({
    productId: shopifyProductId,
    title: result.title,
    bodyHtml: result.body_html,
    shortDescription: result.short_description,
    price: result.price,
    compareAtPrice: result.compare_at_price,
    tags: result.tags,
    metaTitle: result.meta_title,
    metaDescription: result.meta_description,
    photoBrief: result.photo_brief,
    originalTitle: product.title,
    originalPrice: product.price ?? "0",
    priceReasoning: result.price_reasoning,
  });
});

router.post("/projects/:projectId/products/:productId/apply-redesign", async (req, res): Promise<void> => {
  const projectId = parseInt(Array.isArray(req.params.projectId) ? req.params.projectId[0] : req.params.projectId, 10);
  const shopifyProductId = Array.isArray(req.params.productId) ? req.params.productId[0] : req.params.productId;
  const { fields: rawFields } = req.body as { fields?: string[]; redesignId?: number };
  const fields = Array.isArray(rawFields) && rawFields.length > 0 ? rawFields : ["title", "description", "tags", "meta", "price"];

  const [project] = await db.select().from(projectsTable).where(eq(projectsTable.id, projectId));
  const [redesign] = await db
    .select()
    .from(redesignsTable)
    .where(and(eq(redesignsTable.projectId, projectId), eq(redesignsTable.shopifyProductId, shopifyProductId)))
    .orderBy(desc(redesignsTable.createdAt))
    .limit(1);

  if (!project || !redesign) {
    res.status(404).json({ error: "Proyecto o rediseño no encontrado" });
    return;
  }

  const updateData: Record<string, unknown> = {};

  if (fields.includes("title")) updateData.title = redesign.newTitle;
  if (fields.includes("description")) updateData.body_html = redesign.newBodyHtml;
  if (fields.includes("tags")) updateData.tags = redesign.newTags;
  if (fields.includes("meta")) {
    if (redesign.metaTitle) updateData.metafields_global_title_tag = redesign.metaTitle;
    if (redesign.metaDescription) updateData.metafields_global_description_tag = redesign.metaDescription;
    if (redesign.metaTitle || redesign.metaDescription) {
      const { seoDataTable } = await import("@workspace/db");
      await db.insert(seoDataTable).values({
        projectId,
        shopifyProductId,
        metaTitle: redesign.metaTitle || null,
        metaDescription: redesign.metaDescription || null,
      }).onConflictDoNothing().catch(() => {});
      await db.update(seoDataTable)
        .set({ metaTitle: redesign.metaTitle || undefined, metaDescription: redesign.metaDescription || undefined, lastAuditedAt: new Date() })
        .where(and(eq(seoDataTable.projectId, projectId), eq(seoDataTable.shopifyProductId, shopifyProductId)))
        .catch(() => {});
    }
  }

  if (fields.includes("price")) {
    try {
      const liveProduct = await shopifyRequest<{ product: { variants: Array<{ id: number }> } }>(
        projectId, project.shopDomain, `/products/${shopifyProductId}.json`
      );
      const variantIds = liveProduct?.product?.variants?.map((v) => v.id) ?? [];
      if (variantIds.length > 0) {
        updateData.variants = variantIds.map((id) => ({
          id,
          price: redesign.newPrice,
          compare_at_price: redesign.newCompareAtPrice ?? null,
        }));
      } else {
        updateData.variants = [{ price: redesign.newPrice, compare_at_price: redesign.newCompareAtPrice }];
      }
    } catch {
      updateData.variants = [{ price: redesign.newPrice, compare_at_price: redesign.newCompareAtPrice }];
    }
  }

  if (Object.keys(updateData).length > 0) {
    await shopifyRequest(projectId, project.shopDomain, `/products/${shopifyProductId}.json`, {
      method: "PUT",
      body: JSON.stringify({ product: updateData }),
    });
  }

  await db
    .update(redesignsTable)
    .set({ appliedAt: new Date(), appliedFields: fields })
    .where(eq(redesignsTable.id, redesign.id));

  let imagesGenerated = 0;
  let imageErrors: string[] = [];
  const shouldGenerateImages = fields.includes("images") || fields.includes("photos");

  if (shouldGenerateImages) {
    try {
      const existingImages = await shopifyRequest<{ images: Array<{ id: number; src: string; alt: string }> }>(
        projectId, project.shopDomain, `/products/${shopifyProductId}/images.json`
      ).catch(() => ({ images: [] }));

      const referenceImageUrl = existingImages.images?.[0]?.src;

      if (referenceImageUrl) {
        const { getScenesForProductType, downloadImageToBuffer, uploadBufferToShopify, generateDynamicCreativeScenes } = await import("./reference-images.js");
        const { editImageFromBuffer } = await import("@workspace/integrations-openai-ai-server/image");
        const { checkProductionLimit, recordUsage } = await import("../lib/plan-limits.js");

        const [product] = await db.select().from(productsTable).where(and(eq(productsTable.projectId, projectId), eq(productsTable.shopifyProductId, shopifyProductId)));
        const productType = product?.productType || "";
        const storeNiche = project.storeNiche || "general";

        const standardScenes = getScenesForProductType(productType, storeNiche);
        const dynamicScenes = await generateDynamicCreativeScenes(projectId, redesign.newTitle, productType, storeNiche, standardScenes.length);
        const allScenes = [...standardScenes, ...dynamicScenes];

        const limitCheck = await checkProductionLimit(projectId, "image", allScenes.length);
        const allowedCount = limitCheck.allowed ? allScenes.length : Math.max(0, limitCheck.remaining?.images ?? 0);

        if (allowedCount > 0) {
          const referenceBuffer = await downloadImageToBuffer(referenceImageUrl);
          const scenesToGenerate = allScenes.slice(0, allowedCount);
          const existingImageCount = existingImages.images?.length ?? 0;

          for (let i = 0; i < scenesToGenerate.length; i++) {
            const scene = scenesToGenerate[i];
            try {
              const prompt = scene.promptTemplate(redesign.newTitle, productType, storeNiche);
              const generatedBuffer = await editImageFromBuffer(referenceBuffer, prompt, "reference.png");
              const altText = `${redesign.newTitle} - ${scene.label}`;
              const uploadResult = await uploadBufferToShopify({
                projectId,
                shopDomain: project.shopDomain,
                shopifyProductId,
                imageBuffer: generatedBuffer,
                altText,
                position: existingImageCount + i + 1,
              });
              if (uploadResult.success) {
                imagesGenerated++;
                await recordUsage(projectId, "image", 1);
              } else {
                imageErrors.push(`${scene.label}: upload failed`);
              }
            } catch (e: unknown) {
              imageErrors.push(`${scene.label}: ${e instanceof Error ? e.message : "error"}`);
            }
          }
        }
      }
    } catch (imgErr: unknown) {
      imageErrors.push(`Error general: ${imgErr instanceof Error ? imgErr.message : "error"}`);
    }
  }

  res.json({
    success: true,
    message: shouldGenerateImages
      ? `Cambios aplicados correctamente. ${imagesGenerated > 0 ? `${imagesGenerated} imágenes creativas generadas desde la foto de referencia.` : ""}${imageErrors.length > 0 ? ` ${imageErrors.length} errores en imágenes.` : ""}`
      : "Cambios aplicados correctamente en tu tienda",
    imagesGenerated,
    imageErrors: imageErrors.length > 0 ? imageErrors : undefined,
  });
});

router.post("/projects/:projectId/bulk-redesign", async (req, res): Promise<void> => {
  const projectId = parseInt(Array.isArray(req.params.projectId) ? req.params.projectId[0] : req.params.projectId, 10);
  const { mode } = req.body as { mode: string; minGrade?: string };

  let products;
  if (mode === "weak") {
    products = await db
      .select()
      .from(productsTable)
      .where(and(eq(productsTable.projectId, projectId), lte(productsTable.auditScore, 74)));
  } else {
    products = await db
      .select()
      .from(productsTable)
      .where(eq(productsTable.projectId, projectId));
  }

  const jobId = await createBulkJob(projectId, "bulk_redesign", products.length);

  res.json({
    jobId,
    status: "running",
    totalItems: products.length,
    message: `Procesando ${products.length} productos...`,
  });

  runAsync(async () => {
    let completed = 0;
    let failed = 0;
    for (const product of products) {
      try {
        await doRedesign(projectId, product.shopifyProductId);
        completed++;
        await updateJobProgress(jobId, completed, failed, `✓ ${product.title}`);
      } catch (err) {
        failed++;
        const msg = err instanceof Error ? err.message : "Error";
        await updateJobProgress(jobId, completed, failed, `✗ ${product.title}: ${msg}`);
      }
      await new Promise((r) => setTimeout(r, 1000));
    }
    await completeJob(jobId, { completed, failed });
  });
});

export default router;
