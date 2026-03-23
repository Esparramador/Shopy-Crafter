import { Router } from "express";
import { db } from "@workspace/db";
import { projectsTable, productsTable, redesignsTable } from "@workspace/db";
import { eq, and, lte } from "drizzle-orm";
import { shopifyRequest } from "../lib/shopify";
import { askClaudeJsonWithBrain, SHOPIFY_EXPERT_SYSTEM } from "../lib/claude";
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

  const prompt = `Estás rediseñando un producto de Shopify para la tienda "${project.name}".
Nicho: ${project.storeNiche ?? "e-commerce"}
Audiencia: ${project.targetAudience ?? "adultos"}
Tono de marca: ${project.brandTone ?? "profesional"}
Mercados: ${project.storeMarkets ?? "España"}

DATOS REALES ACTUALES DEL PRODUCTO (extraídos de Shopify en tiempo real):
Título: ${product.title}
Tipo de producto: ${product.productType ?? "sin definir"}
Descripción actual: ${product.bodyHtml?.replace(/<[^>]+>/g, "").slice(0, 600) ?? "(vacía)"}
Precio actual: €${livePrice ?? "no configurado"}
Tags actuales: ${product.tags ?? "ninguno"}
Imágenes: ${product.imageCount}
Vendor: ${product.vendor ?? "no definido"}
${optionsSection ? `\nOpciones del producto:\n${optionsSection}` : ""}
${variantsSection ? `\nVariantes reales (IMPORTANTE: el precio sugerido debe ser coherente con estas variantes):\n${variantsSection}` : ""}

INSTRUCCIONES CRÍTICAS:
1. El título y descripción deben hacer referencia al producto EXACTO que ves arriba (no inventes otro tipo de producto)
2. Los photo_brief deben describir imágenes de "${product.title}" específicamente — NUNCA objetos no relacionados
3. El precio recomendado debe ser coherente con las variantes actuales del producto
4. La descripción HTML debe mencionar las opciones/variantes reales si las hay

Genera un rediseño COMPLETO y profesional. Devuelve SOLO un JSON con estos campos exactos:
{
  "title": "título SEO 55-65 chars, keyword principal primero",
  "body_html": "descripción HTML completa 500-700 palabras con hook emocional, lista de beneficios, características premium con ✓, bloque de confianza (garantía/envío/devolución), y CTA",
  "short_description": "descripción corta 50 palabras para meta",
  "price": "precio recomendado como string ej: '29.99' — debe ser coherente con el producto real",
  "compare_at_price": "precio tachado 25-40% más alto como string",
  "tags": "15 tags separados por coma mezcla español+inglés, relevantes para el producto exacto",
  "meta_title": "meta title 60 chars exactos con keyword del producto",
  "meta_description": "meta description 155 chars con keyword, precio, CTA",
  "photo_brief": ["brief foto 1: descripción detallada de cómo fotografiar ${product.title} específicamente", "brief foto 2", "brief foto 3", "brief foto 4"],
  "price_reasoning": "explicación del precio recomendado basada en el producto real"
}`;

  return await askClaudeJsonWithBrain<RedesignOutput>(projectId, prompt, SHOPIFY_EXPERT_SYSTEM, "redesign", project.storeNiche ?? undefined, 6000);
}

router.post("/projects/:projectId/products/:productId/redesign", async (req, res): Promise<void> => {
  const projectId = parseInt(Array.isArray(req.params.projectId) ? req.params.projectId[0] : req.params.projectId, 10);
  const shopifyProductId = Array.isArray(req.params.productId) ? req.params.productId[0] : req.params.productId;

  const [product] = await db
    .select()
    .from(productsTable)
    .where(and(eq(productsTable.projectId, projectId), eq(productsTable.shopifyProductId, shopifyProductId)));

  if (!product) {
    res.status(404).json({ error: "Producto no encontrado" });
    return;
  }

  const result = await doRedesign(projectId, shopifyProductId);

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
  const { fields } = req.body as { fields: string[]; redesignId?: number };

  const [project] = await db.select().from(projectsTable).where(eq(projectsTable.id, projectId));
  const [redesign] = await db
    .select()
    .from(redesignsTable)
    .where(and(eq(redesignsTable.projectId, projectId), eq(redesignsTable.shopifyProductId, shopifyProductId)))
    .orderBy(redesignsTable.createdAt)
    .limit(1);

  if (!project || !redesign) {
    res.status(404).json({ error: "Proyecto o rediseño no encontrado" });
    return;
  }

  const updateData: Record<string, unknown> = {};
  const metafields: Array<{ namespace: string; key: string; value: string; type: string }> = [];

  if (fields.includes("title")) updateData.title = redesign.newTitle;
  if (fields.includes("description")) updateData.body_html = redesign.newBodyHtml;
  if (fields.includes("tags")) updateData.tags = redesign.newTags;
  if (fields.includes("meta")) {
    metafields.push(
      { namespace: "seo", key: "title", value: redesign.metaTitle, type: "single_line_text_field" },
      { namespace: "seo", key: "description", value: redesign.metaDescription, type: "single_line_text_field" }
    );
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

  for (const mf of metafields) {
    await shopifyRequest(projectId, project.shopDomain, `/products/${shopifyProductId}/metafields.json`, {
      method: "POST",
      body: JSON.stringify({ metafield: mf }),
    });
    await new Promise((r) => setTimeout(r, 200));
  }

  await db
    .update(redesignsTable)
    .set({ appliedAt: new Date(), appliedFields: fields })
    .where(eq(redesignsTable.id, redesign.id));

  res.json({ success: true, message: "Cambios aplicados a Shopify correctamente" });
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
