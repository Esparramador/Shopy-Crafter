// Acciones del cerebro — Tienda Shopify: productos, colecciones, variantes, precios, stock, páginas, imágenes.
// Extraídas tal cual del switch de POST /shopybrain/execute-action (routes/shopybrain.ts).
/* eslint-disable @typescript-eslint/no-explicit-any */
import { SHOPIFY_API_VERSION } from "../../lib/shopify.js";
import { db, projectsTable, seoDataTable, productsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { shopifyRequest, shopifyGraphQL, refreshToken, getShopifyHeaders, normalizeShopDomain } from "../../lib/shopify.js";
import { safeDecrypt } from "../../lib/crypto.js";
import { learnFromOperation, askClaudeJsonWithBrain, askClaudeWithBrain, SHOPIFY_EXPERT_SYSTEM as CLAUDE_EXPERT_SYSTEM } from "../../lib/claude.js";
import { auditProduct } from "../../lib/audit.js";
import { logger } from "../../lib/logger.js";
import { saveToVault } from "../../lib/vault.js";

import {
  researchRealPricing
} from "./shared.js";
import { NOT_HANDLED, type BrainActionCtx, type BrainActionOutcome } from "./action-context.js";

export async function runStoreActions(ctx: BrainActionCtx): Promise<BrainActionOutcome> {
  const { req, res, action, params, resolveStripeAccountId } = ctx;
  let result: Record<string, unknown> = {};
      switch (action) {
        case "store_status": {
          const projectId = params?.projectId;
          if (!projectId) { res.status(400).json({ error: "projectId requerido" }); return; }
          const [project] = await db.select().from(projectsTable).where(eq(projectsTable.id, parseInt(projectId)));
          if (!project) { res.status(404).json({ error: "Proyecto no encontrado" }); return; }
  
          const shop = await shopifyRequest<{ shop: Record<string, unknown> }>(parseInt(projectId), project.shopDomain, "/shop.json");
          const [activeCount, draftCount, archivedCount, publishedCount, unpublishedCount] = await Promise.all([
            shopifyRequest<{ count: number }>(parseInt(projectId), project.shopDomain, "/products/count.json?published_status=any&status=active"),
            shopifyRequest<{ count: number }>(parseInt(projectId), project.shopDomain, "/products/count.json?published_status=any&status=draft"),
            shopifyRequest<{ count: number }>(parseInt(projectId), project.shopDomain, "/products/count.json?published_status=any&status=archived"),
            shopifyRequest<{ count: number }>(parseInt(projectId), project.shopDomain, "/products/count.json?published_status=published"),
            shopifyRequest<{ count: number }>(parseInt(projectId), project.shopDomain, "/products/count.json?published_status=unpublished"),
          ]);
          const totalProducts = activeCount.count + draftCount.count + archivedCount.count;
          const ordersCount = await shopifyRequest<{ count: number }>(parseInt(projectId), project.shopDomain, "/orders/count.json?status=any");
  
          const tokenExpiry = project.tokenExpiresAt;
          const tokenValid = tokenExpiry ? new Date(tokenExpiry) > new Date() : false;
          const tokenHoursLeft = tokenExpiry ? Math.max(0, Math.round((new Date(tokenExpiry).getTime() - Date.now()) / 3600000 * 10) / 10) : 0;
  
          const publishWarning = unpublishedCount.count > 0 ? `\n⚠️ ¡ATENCIÓN! ${unpublishedCount.count} producto(s) NO PUBLICADOS — invisibles para los clientes` : "";
  
          result = {
            storeName: shop.shop?.name ?? project.name,
            domain: project.shopDomain,
            plan: (shop.shop as Record<string, unknown>)?.plan_name,
            currency: (shop.shop as Record<string, unknown>)?.currency,
            productsCount: totalProducts,
            activeProducts: activeCount.count,
            draftProducts: draftCount.count,
            archivedProducts: archivedCount.count,
            publishedProducts: publishedCount.count,
            unpublishedProducts: unpublishedCount.count,
            ordersCount: ordersCount.count,
            tokenStatus: tokenValid ? "valid" : "expired",
            tokenHoursLeft,
            tokenExpiresAt: tokenExpiry,
            message: `Tienda: ${shop.shop?.name ?? project.name} | ${totalProducts} productos (${activeCount.count} activos, ${draftCount.count} borradores, ${archivedCount.count} archivados) | 📢 Publicados: ${publishedCount.count} | 🔇 No publicados: ${unpublishedCount.count} | ${ordersCount.count} pedidos | Token: ${tokenValid ? `válido (${tokenHoursLeft}h restantes)` : "EXPIRADO"}${publishWarning}`,
          };
          break;
        }

        case "list_products": {
          const projectId = params?.projectId;
          if (!projectId) { res.status(400).json({ error: "projectId requerido" }); return; }
          const [project] = await db.select().from(projectsTable).where(eq(projectsTable.id, parseInt(projectId)));
          if (!project) { res.status(404).json({ error: "Proyecto no encontrado" }); return; }
  
          const limit = Math.min(params?.limit ?? 10, 50);
          const statusFilter = params?.statusFilter || "any";
          let allProducts: Array<Record<string, unknown>> = [];
          const fieldsToFetch = "id,title,handle,status,variants,images,tags,body_html,published_at,published_scope,metafields_global_title_tag,metafields_global_description_tag";
  
          if (statusFilter === "any") {
            for (const st of ["active", "draft", "archived"]) {
              const d = await shopifyRequest<{ products: Array<Record<string, unknown>> }>(
                parseInt(projectId), project.shopDomain, `/products.json?limit=${limit}&status=${st}&published_status=any&fields=${fieldsToFetch}`
              );
              allProducts = allProducts.concat(d.products || []);
            }
          } else {
            const d = await shopifyRequest<{ products: Array<Record<string, unknown>> }>(
              parseInt(projectId), project.shopDomain, `/products.json?limit=${limit}&status=${statusFilter}&published_status=any&fields=${fieldsToFetch}`
            );
            allProducts = d.products || [];
          }
  
          let unpublishedWarnings = 0;
          let noCompareWarnings = 0;
          let lowImageWarnings = 0;
          let shortDescWarnings = 0;
  
          const seoDataRows = await db.select().from(seoDataTable).where(eq(seoDataTable.projectId, parseInt(projectId)));
          const seoLookup = new Map(seoDataRows.map(s => [s.shopifyProductId, s]));
  
          const mappedProducts = allProducts.map((p: Record<string, unknown>) => {
            const variants = (p.variants as Array<Record<string, string>>) || [];
            const images = (p.images as Array<Record<string, unknown>>) || [];
            const bodyLen = (p.body_html as string || "").length;
            const tagsArr = ((p.tags as string) || "").split(",").filter((t: string) => t.trim());
            const hasCompare = !!variants[0]?.compare_at_price;
            const isPublished = !!p.published_at;
            const imgCount = images.length;
  
            const issues: string[] = [];
            if (!isPublished) { issues.push("NO PUBLICADO"); unpublishedWarnings++; }
            if (!hasCompare) { issues.push("sin compare_at_price"); noCompareWarnings++; }
            if (imgCount < 3) { issues.push(`pocas imágenes (${imgCount})`); lowImageWarnings++; }
            if (bodyLen < 500) { issues.push(`descripción corta (${bodyLen}ch)`); shortDescWarnings++; }
            if (tagsArr.length < 10) { issues.push(`pocos tags (${tagsArr.length})`); }
  
            let score = 0;
            if (imgCount >= 3) score += 25; else if (imgCount >= 1) score += 10;
            if (bodyLen >= 1000) score += 25; else if (bodyLen >= 500) score += 15; else if (bodyLen >= 200) score += 8;
            if (tagsArr.length >= 10) score += 25; else if (tagsArr.length >= 5) score += 15;
            if (hasCompare) score += 25;
  
            const grade = score >= 85 ? "A" : score >= 60 ? "B" : score >= 40 ? "C" : "D";
  
            const productSeo = seoLookup.get(String(p.id));
            const hasMetaTitle = !!(productSeo?.metaTitle && productSeo.metaTitle.length > 10);
            const hasMetaDesc = !!(productSeo?.metaDescription && productSeo.metaDescription.length > 10);
            if (!hasMetaTitle) issues.push("Sin meta title SEO — Google usará el título del producto por defecto");
            if (!hasMetaDesc) issues.push("Sin meta description — impacto crítico en CTR de Google (puede reducir clics un 30%)");
            const hasAltTexts = images.length > 0 && images.every((img: Record<string, unknown>) => !!img.alt);
            const handle = (p.handle as string) || "";
            const cleanHandleVal = !!handle && !handle.includes("_");
  
            return {
              id: p.id,
              title: p.title,
              status: p.status,
              price: variants[0]?.price ?? "0.00",
              compareAtPrice: variants[0]?.compare_at_price || null,
              variantCount: variants.length,
              imageCount: imgCount,
              imageUrl: images[0]?.src || null,
              tags: p.tags,
              tagsCount: tagsArr.length,
              descriptionLength: bodyLen,
              published: isPublished,
              publishedScope: p.published_scope || "unknown",
              auditScore: score,
              auditGrade: grade,
              hasComparePrice: hasCompare,
              hasMetaTitle,
              hasMetaDesc,
              hasAltTexts,
              cleanHandle: cleanHandleVal,
              issues: issues.length > 0 ? issues : undefined,
            };
          });
  
          let auditSummary = "";
          if (unpublishedWarnings > 0) auditSummary += `\n⚠️ ${unpublishedWarnings} producto(s) NO PUBLICADOS (invisibles)`;
          if (noCompareWarnings > 0) auditSummary += `\n⚠️ ${noCompareWarnings} producto(s) sin precio tachado (compare_at_price)`;
          if (lowImageWarnings > 0) auditSummary += `\n⚠️ ${lowImageWarnings} producto(s) con menos de 3 imágenes`;
          if (shortDescWarnings > 0) auditSummary += `\n⚠️ ${shortDescWarnings} producto(s) con descripción corta (<500ch)`;
  
          result = {
            products: mappedProducts,
            total: allProducts.length,
            auditWarnings: { unpublished: unpublishedWarnings, noCompare: noCompareWarnings, lowImages: lowImageWarnings, shortDesc: shortDescWarnings },
            message: `${allProducts.length} productos encontrados (${statusFilter === "any" ? "todos los estados" : statusFilter})${auditSummary}`,
          };
          break;
        }

        case "create_product": {
          const projectId = params?.projectId;
          if (!projectId) { res.status(400).json({ error: "projectId requerido" }); return; }
          const [project] = await db.select().from(projectsTable).where(eq(projectsTable.id, parseInt(projectId)));
          if (!project) { res.status(404).json({ error: "Proyecto no encontrado" }); return; }
  
          const title = params?.title;
          if (!title) { res.status(400).json({ error: "title requerido" }); return; }
  
          let finalTitle = title;
          let finalBody = params?.bodyHtml ?? "";
          let finalTags = params?.tags ?? "";
          let finalPrice = params?.price || "0.00";
          let finalCompareAt = params?.compareAtPrice || null;
          let pricingInfo = "";
          let seoTitle = "";
          let seoDescription = "";
  
          const storeNiche = project.storeNiche || "general";
          const plan = (project.plan ?? "starter") as string;
  
          const IMAGE_TYPES_BY_PLAN: Record<string, string[]> = {
            trial: ["hero", "lifestyle"],
            starter: ["hero", "lifestyle", "detail", "packaging"],
            agency_pro: ["hero", "lifestyle", "detail", "packaging", "ugc", "scale", "process", "variant"],
            enterprise: ["hero", "lifestyle", "detail", "packaging", "ugc", "scale", "process", "variant"],
            admin: ["hero", "lifestyle", "detail", "packaging", "ugc", "scale", "process", "variant"],
          };
  
          let aiContent: Record<string, unknown> | null = null;
          if (params?.aiGenerate !== false) {
            try {
              const [priceResearch, aiContentResult] = await Promise.all([
                (!params?.price || params?.price === "0.00")
                  ? researchRealPricing(title, params?.productType || "", storeNiche)
                  : Promise.resolve(null),
                askClaudeJsonWithBrain<{
                  title?: string;
                  description?: string;
                  tags?: string[];
                  seoTitle?: string;
                  seoDescription?: string;
                  suggestedPrice?: number;
                  suggestedCompareAtPrice?: number;
                  productType?: string;
                  category?: string;
                  metafields?: Array<{ namespace: string; key: string; value: string; type: string }>;
                  variants?: Array<{
                    optionValues: Record<string, string>;
                    sku?: string;
                    price?: number;
                    compareAtPrice?: number;
                    inventoryQuantity?: number;
                    weight?: number;
                    weightUnit?: string;
                    barcode?: string;
                    costPerItem?: number;
                  }>;
                  options?: Array<{ name: string; values: string[] }>;
                  inventoryPolicy?: string;
                }>(
                  parseInt(projectId),
                  `Genera contenido de CALIDAD ABSOLUTA 100/100 para un nuevo producto Shopify — al nivel de las mejores tiendas del mundo (Gymshark, Allbirds, Fenty Beauty, Skims).
  
  Título base: "${title}"
  Tipo de producto: ${params?.productType || "DETECTA el tipo de producto a partir del título"}
  Nicho: ${storeNiche}
  Tono de marca: ${project.brandTone || "profesional"}
  Audiencia: ${project.targetAudience || "adultos con gusto por la calidad"}
  Mercados: ${project.storeMarkets || "España/Europa"}
  Precio proporcionado: ${params?.price || "NO proporcionado — investiga y sugiere precio competitivo REAL"}
  
  ESTÁNDAR DE CALIDAD 100/100 — REQUISITOS OBLIGATORIOS:
  
  1. TÍTULO (45-65 chars):
     - Keyword principal AL INICIO del título
     - Incluye modificador emocional o beneficio clave
     - Formato: [Keyword Principal] — [Beneficio/Diferenciador] | [Material/Detalle]
     - Ejemplo perfecto: "Taza Cerámica Artesanal — Diseño Exclusivo Pintado a Mano | 350ml"
  
  2. DESCRIPCIÓN HTML (mínimo 800-1200 palabras, 8 secciones obligatorias):
     <div class="product-description">
     SECCIÓN 1 — HERO HOOK (H2 emotivo + párrafo apertura con storytelling 80-100 palabras):
     Conecta emocionalmente. Describe la EXPERIENCIA, no solo el producto. Pinta una escena vivida.
  
     SECCIÓN 2 — BENEFICIOS CLAVE (H2 + lista con ✅ emojis, mínimo 8 beneficios):
     Cada beneficio = resultado concreto para el comprador, no característica genérica.
  
     SECCIÓN 3 — ESPECIFICACIONES TÉCNICAS (H2 + tabla HTML):
     Tabla con: Material, Dimensiones, Peso, Color, Capacidad, Origen, Certificaciones.
  
     SECCIÓN 4 — ¿PARA QUIÉN ES PERFECTO? (H2 + 4-5 casos de uso con emojis):
     Buyer personas específicos con situaciones concretas de uso.
  
     SECCIÓN 5 — CUIDADO Y MANTENIMIENTO (H3 + instrucciones):
     Instrucciones claras de cuidado, limpieza, almacenamiento.
  
     SECCIÓN 6 — PREGUNTAS FRECUENTES (H2 "FAQ" + 4-5 Q&A con <strong> para preguntas):
     Resuelve objeciones de compra: envío, devoluciones, garantía, materiales.
  
     SECCIÓN 7 — CIERRE Y CTA (párrafo persuasivo + urgencia sutil):
     CTA claro, mención de stock limitado o edición especial si aplica.
  
     SECCIÓN 8 — TRUST BADGES (iconos de confianza):
     📦 Envío Seguro | 🔄 Devolución 30 días | ✅ Garantía de Calidad | 🌿 Materiales Premium
     </div>
  
     USA ESTILO PROFESIONAL: <h2>, <h3>, <ul>/<li>, <table>, <strong>, <p>. NO uses estilos inline.
  
  OPTIMIZACIÓN SEO AVANZADA (Metodología Semrush):
  - KEYWORD DENSITY: La keyword principal debe aparecer 3-5 veces en la descripción (densidad 1.5-2.5%)
  - KEYWORD PROMINENCE: La keyword principal DEBE aparecer en el PRIMER PÁRRAFO (Hero Hook)
  - LSI KEYWORDS: Incluye 5-8 keywords semánticas relacionadas distribuidas naturalmente en el texto
  - READABILITY: Frases de 15-25 palabras máximo. Párrafos de 2-4 líneas. Voz activa siempre.
  - FAQ SCHEMA-READY: La sección FAQ debe usar formato <strong>¿Pregunta?</strong> seguido de <p>Respuesta</p> para activar Rich Snippets en Google
  - INTERNAL LINKING: Si conoces otros productos de la tienda, sugiere enlaces internos con anchor text keyword-rich
  
  3. TAGS SEO (22-28 tags obligatorios en array):
     Categorías de tags que DEBES incluir (metodología Semrush Keyword Magic Tool):
     - Keyword principal + variaciones de cola corta (3-4 tags)
     - Material/composición/ingredientes (2-3 tags)
     - Intención de búsqueda: transaccional ("comprar X", "X online") (2-3 tags)
     - Audiencia target + buyer persona (2-3 tags)
     - Estilo/estética/categoría visual (2-3 tags)
     - Keywords long-tail en español con intención clara (3-4 tags)
     - Keywords en inglés para SEO internacional (2-3 tags)
     - Temporada/momento/ocasión si aplica (1-2 tags)
     - Nicho específico + keywords LSI semánticas (2-3 tags)
  
  4. META TITLE SEO (40-60 chars EXACTOS):
     Formato: [Keyword] — [Beneficio] | [Marca/Tienda]
     Keyword principal SIEMPRE al inicio. Debe coincidir con intención de búsqueda transaccional.
  
  5. META DESCRIPTION SEO (130-155 chars EXACTOS):
     Formato: [Beneficio principal]. [Keyword + detalle]. [CTA con urgencia]. Incluye precio si hay.
     Debe responder la intención de búsqueda del usuario en las primeras 100 chars (visible en SERP móvil).
  
  6. PRECIO:
     - Si no hay precio, sugiere basándote en el mercado real del nicho
     - SIEMPRE incluye suggestedCompareAtPrice (20-35% más alto que el precio)
     - Usa pricing psicológico: .99, .95, .90
  
  7. VARIANTES CON INVENTARIO COMPLETO (OBLIGATORIO — NUNCA crear producto sin variantes):
     Analiza el tipo de producto y genera TODAS las variantes reales que tendría en una tienda profesional.
     Cada variante DEBE tener inventoryQuantity (stock inicial realista: 10-50 unidades por variante).
  
     REGLAS POR TIPO DE PRODUCTO (ejemplos, aplica para CUALQUIER producto/servicio):
     - ROPA/MODA: options=[{name:"Talla",values:["XS","S","M","L","XL","XXL"]},{name:"Color",values:["Negro","Blanco","Azul",...]}]
     - CALZADO: options=[{name:"Número",values:["36","37","38","39","40","41","42","43","44","45"]},{name:"Color",values:[...]}]
     - JOYERÍA: options=[{name:"Material",values:["Plata 925","Oro 18k","Acero Quirúrgico"]},{name:"Medida",values:["15cm","17cm","19cm"]}]
     - ALIMENTACIÓN: options=[{name:"Peso",values:["250g","500g","1kg"]},{name:"Sabor",values:[...]}]
     - COSMÉTICA: options=[{name:"Tamaño",values:["30ml","50ml","100ml"]},{name:"Tono",values:[...]}]
     - ELECTRÓNICA: options=[{name:"Capacidad",values:["64GB","128GB","256GB"]},{name:"Color",values:[...]}]
     - HOGAR/DECORACIÓN: options=[{name:"Tamaño",values:["S","M","L"]},{name:"Color",values:[...]}]
     - BEBIDAS: options=[{name:"Pack",values:["1 unidad","Pack 6","Pack 12","Pack 24"]},{name:"Sabor",values:[...]}]
     - SERVICIOS DIGITALES: options=[{name:"Plan",values:["Básico","Pro","Enterprise"]},{name:"Duración",values:["1 mes","3 meses","12 meses"]}]
     - ARTE/PRINTS: options=[{name:"Tamaño",values:["A4","A3","A2","A1"]},{name:"Acabado",values:["Mate","Brillante","Canvas"]}]
     - MASCOTAS: options=[{name:"Talla",values:["XS","S","M","L","XL"]},{name:"Sabor/Tipo",values:[...]}]
     - LIBROS/PAPELERÍA: options=[{name:"Formato",values:["Tapa Blanda","Tapa Dura","eBook"]},{name:"Idioma",values:["Español","Inglés"]}]
     - SUPLEMENTOS: options=[{name:"Formato",values:["Cápsulas 60","Cápsulas 120","Polvo 500g"]},{name:"Sabor",values:[...]}]
     - CUALQUIER OTRO: Detecta las opciones lógicas del producto y genera variantes coherentes.
  
     Cada variante incluye:
     - optionValues: {"Talla":"M","Color":"Negro"} (las opciones que aplican)
     - sku: código único (formato: PREFIJO-OPT1-OPT2, ej: "CAM-M-NEG")
     - price: precio (puede variar si hay opciones premium como XXL, oro, etc.)
     - compareAtPrice: precio tachado
     - inventoryQuantity: stock inicial (15-50 unidades, variantes populares como M/L más stock)
     - weight: peso en kg
     - weightUnit: "kg"
     - costPerItem: coste estimado del producto (para calcular margen)
     - barcode: EAN/GTIN ficticio realista (13 dígitos)
  
     GENERA ENTRE 6-30 variantes según el tipo de producto.
     inventoryPolicy: "deny" (no vender sin stock) o "continue" (permitir pedidos sin stock para servicios/digital)
  
  8. CATEGORÍA SHOPIFY (OBLIGATORIO):
     Asigna la categoría correcta del Standard Product Taxonomy de Shopify.
     Ejemplos: "Apparel & Accessories > Clothing > Shirts & Tops", "Health & Beauty > Personal Care > Cosmetics",
     "Home & Garden > Kitchen & Dining > Drinkware", "Sporting Goods > Exercise & Fitness".
     USA la taxonomía oficial de Shopify — categorías en inglés separadas por " > ".
  
  9. METAFIELDS COMPLETOS (OBLIGATORIO — genera TODOS los que apliquen):
     Genera un array de metafields con namespace "custom" y los siguientes keys según el tipo de producto:
     - material: composición/material principal (type: "single_line_text_field")
     - color: color principal del producto (type: "single_line_text_field")
     - care_instructions: instrucciones de cuidado y mantenimiento (type: "multi_line_text_field")
     - origin_country: país de origen/fabricación (type: "single_line_text_field")
     - dimensions: dimensiones del producto (type: "single_line_text_field")
     - weight_info: peso detallado con unidades (type: "single_line_text_field")
     - ingredients: ingredientes/composición detallada si aplica (type: "multi_line_text_field")
     - certifications: certificaciones/sellos de calidad (type: "single_line_text_field")
     - warranty: información de garantía (type: "single_line_text_field")
     - age_group: grupo de edad recomendado si aplica (type: "single_line_text_field")
     - gender: género target si aplica (type: "single_line_text_field")
     - season: temporada/estación si aplica (type: "single_line_text_field")
     - style: estilo/colección si aplica (type: "single_line_text_field")
     NO incluyas metafields vacíos — solo los relevantes para este producto específico.
  
  Responde SOLO JSON válido:
  {"title":"...","description":"...HTML...","tags":[...22+ tags...],"seoTitle":"...","seoDescription":"...","suggestedPrice":XX.99,"suggestedCompareAtPrice":XX.99,"productType":"tipo","category":"Taxonomy > Path > Category","metafields":[{"namespace":"custom","key":"material","value":"Algodón orgánico 100%","type":"single_line_text_field"},...],"inventoryPolicy":"deny","options":[{"name":"Talla","values":["S","M","L","XL"]},{"name":"Color","values":["Negro","Blanco"]}],"variants":[{"optionValues":{"Talla":"S","Color":"Negro"},"sku":"CAM-S-NEG","price":29.99,"compareAtPrice":39.99,"inventoryQuantity":25,"weight":0.3,"weightUnit":"kg","costPerItem":12.50,"barcode":"8400000000001"},...]}`,
                  `Eres el equipo de producto de las tiendas Shopify más exitosas del mundo combinado con la inteligencia SEO de Semrush. Has estudiado qué hace que Gymshark, Allbirds, Fenty Beauty, Skims, y las 100 mejores tiendas Shopify del mundo tengan fichas de producto PERFECTAS. Aplicas metodología Semrush: keyword density 1.5-2.5%, keyword prominence (keyword en primer párrafo), LSI keywords semánticas, readability optimizada (frases 15-25 palabras), FAQ schema-ready para Rich Snippets, y tags con intención transaccional. Tu misión: generar fichas que puntuarían 100/100 en Semrush On-Page SEO Checker y en cualquier auditoría de calidad Shopify. Responde SOLO JSON válido.`,
                  "seo",
                  storeNiche || undefined,
                  8000
                ),
              ]);
  
              aiContent = aiContentResult as Record<string, unknown>;
  
              finalTitle = (aiContent.title as string) || title;
              finalBody = (aiContent.description as string) || finalBody;
              finalTags = Array.isArray(aiContent.tags) ? (aiContent.tags as string[]).join(", ") : finalTags;
              seoTitle = (aiContent.seoTitle as string) || "";
              seoDescription = (aiContent.seoDescription as string) || "";
  
              if (aiContent.productType && !params?.productType) {
                params.productType = aiContent.productType as string;
              }
  
              if (!params?.price || params?.price === "0.00") {
                if (priceResearch && priceResearch.suggestedPrice > 0) {
                  finalPrice = priceResearch.suggestedPrice.toFixed(2);
                  finalCompareAt = priceResearch.suggestedCompareAtPrice > 0
                    ? priceResearch.suggestedCompareAtPrice.toFixed(2)
                    : null;
                  pricingInfo = `\n💰 Precio investigado: ${finalPrice}€ (rango mercado: ${priceResearch.marketPriceRange.min}€-${priceResearch.marketPriceRange.max}€, ${priceResearch.competitorPrices.length} competidores analizados)`;
                } else if (aiContent.suggestedPrice && (aiContent.suggestedPrice as number) > 0) {
                  finalPrice = (aiContent.suggestedPrice as number).toFixed(2);
                  if (aiContent.suggestedCompareAtPrice) {
                    finalCompareAt = (aiContent.suggestedCompareAtPrice as number).toFixed(2);
                  }
                  pricingInfo = `\n💰 Precio sugerido por IA: ${finalPrice}€`;
                }
              }
            } catch { /* use original data */ }
          }
  
          const { checkProductionLimit: checkProdLimit, recordUsage: recProdUsage } = await import("../../lib/plan-limits.js");
          const prodLimitCheck = await checkProdLimit(parseInt(projectId), "product", 1);
          if (!prodLimitCheck.allowed) {
            result = { error: true, message: `❌ Límite de productos alcanzado para tu plan (${prodLimitCheck.planLabel}). Quedan ${prodLimitCheck.remaining.products} productos este mes.` };
            break;
          }
  
          const shopifyProduct: Record<string, unknown> = {
            title: finalTitle,
            body_html: finalBody,
            tags: finalTags,
            vendor: params?.vendor || undefined,
            product_type: params?.productType || undefined,
            status: "active",
            published: true,
            published_scope: "global",
          };
  
          const aiVariantsRaw = (params?.aiGenerate !== false && (aiContent as any)?.variants?.length) ? (aiContent as any).variants as any[] : null;
          const aiOptionsRaw = (params?.aiGenerate !== false && (aiContent as any)?.options?.length) ? (aiContent as any).options as any[] : null;
  
          if (aiOptionsRaw && aiOptionsRaw.length > 0) {
            shopifyProduct.options = aiOptionsRaw.map((o: { name: string; values: string[] }, i: number) => ({
              name: o.name,
              position: i + 1,
              values: o.values,
            }));
          }
  
          if (aiVariantsRaw && aiVariantsRaw.length > 0 && aiOptionsRaw && aiOptionsRaw.length > 0) {
            shopifyProduct.variants = aiVariantsRaw.map((v: Record<string, unknown>) => {
              const optVals = (v.optionValues || {}) as Record<string, string>;
              const variant: Record<string, unknown> = {
                price: String(v.price || finalPrice),
                compare_at_price: v.compareAtPrice ? String(v.compareAtPrice) : finalCompareAt,
                sku: v.sku || null,
                inventory_management: "shopify",
                inventory_quantity: v.inventoryQuantity ?? 25,
                inventory_policy: (aiContent as any)?.inventoryPolicy || "deny",
                weight: v.weight || null,
                weight_unit: v.weightUnit || "kg",
                barcode: v.barcode || null,
                requires_shipping: true,
                taxable: true,
              };
              if (aiOptionsRaw[0]) variant.option1 = optVals[aiOptionsRaw[0].name] || null;
              if (aiOptionsRaw[1]) variant.option2 = optVals[aiOptionsRaw[1].name] || null;
              if (aiOptionsRaw[2]) variant.option3 = optVals[aiOptionsRaw[2].name] || null;
              return variant;
            });
          } else {
            shopifyProduct.variants = [{
              title: "Default",
              price: finalPrice,
              compare_at_price: finalCompareAt,
              sku: params?.sku || null,
              inventory_management: "shopify",
              inventory_quantity: params?.quantity ?? 50,
              inventory_policy: "deny",
              requires_shipping: true,
              taxable: true,
            }];
          }
  
          if (seoTitle) shopifyProduct.metafields_global_title_tag = seoTitle;
          if (seoDescription) shopifyProduct.metafields_global_description_tag = seoDescription;
  
          const aiCategory = aiContent?.category as string | undefined;
          const aiMetafields = (aiContent?.metafields || []) as Array<{ namespace: string; key: string; value: string; type: string }>;
  
          const created = await shopifyRequest<{ product: Record<string, unknown> }>(
            parseInt(projectId), project.shopDomain, "/products.json",
            { method: "POST", body: JSON.stringify({ product: shopifyProduct }) }
          );
  
          const createdVariants = (created.product.variants || []) as Array<Record<string, unknown>>;
          const totalStock = createdVariants.reduce((sum: number, v: Record<string, unknown>) => sum + (Number(v.inventory_quantity) || 0), 0);
          if (createdVariants.length > 0) {
            const { inventoryTrackingTable: invTable } = await import("@workspace/db");
            const { randomUUID } = await import("crypto");
            const createdOptions = (created.product.options || []) as Array<{ name: string }>;
            for (const cv of createdVariants) {
              await db.insert(invTable).values({
                id: randomUUID(),
                projectId: String(projectId),
                productId: String(created.product.id),
                variantId: String(cv.id),
                productTitle: String(created.product.title),
                variantTitle: String(cv.title || "Default"),
                sku: cv.sku ? String(cv.sku) : null,
                barcode: cv.barcode ? String(cv.barcode) : null,
                option1Name: createdOptions[0]?.name || null,
                option1Value: cv.option1 ? String(cv.option1) : null,
                option2Name: createdOptions[1]?.name || null,
                option2Value: cv.option2 ? String(cv.option2) : null,
                option3Name: createdOptions[2]?.name || null,
                option3Value: cv.option3 ? String(cv.option3) : null,
                productType: String(created.product.product_type || params?.productType || ""),
                vendor: String(created.product.vendor || params?.vendor || ""),
                price: parseFloat(String(cv.price || finalPrice)),
                compareAtPrice: cv.compare_at_price ? parseFloat(String(cv.compare_at_price)) : null,
                currentStock: Number(cv.inventory_quantity) || 0,
                avgDailySales: 0,
                totalUnitsSold: 0,
                daysRemaining: 999,
                inventoryPolicy: String(cv.inventory_policy || "deny"),
                status: "healthy",
              }).catch(() => {});
            }
          }
  
          await recProdUsage(parseInt(projectId), "product", 1);
  
          const createdProductId = String(created.product.id);
          const createdTitle = String(created.product.title);
          const createdHandle = String(created.product.handle || "");
  
          let metafieldsPushed = 0;
          if (aiMetafields.length > 0) {
            for (const mf of aiMetafields) {
              if (!mf.value || !mf.key) continue;
              try {
                await shopifyRequest(parseInt(projectId), project.shopDomain, `/products/${createdProductId}/metafields.json`, {
                  method: "POST",
                  body: JSON.stringify({ metafield: { namespace: mf.namespace || "custom", key: mf.key, value: mf.value, type: mf.type || "single_line_text_field" } }),
                });
                metafieldsPushed++;
              } catch {}
              await new Promise(r => setTimeout(r, 150));
            }
          }
  
          if (aiCategory) {
            const categoryProductType = typeof aiCategory === "string" ? aiCategory : (params?.productType || (aiContent?.productType as string) || "");
            try {
              await shopifyRequest(parseInt(projectId), project.shopDomain, `/products/${createdProductId}.json`, {
                method: "PUT",
                body: JSON.stringify({ product: { id: createdProductId, product_type: categoryProductType } }),
              });
            } catch {}
          }
  
          if (seoTitle || seoDescription) {
            await db.insert(seoDataTable).values({
              projectId: parseInt(projectId),
              shopifyProductId: createdProductId,
              metaTitle: seoTitle || null,
              metaDescription: seoDescription || null,
            }).onConflictDoNothing().catch(() => {});
          }
  
          saveToVault({
            projectId: parseInt(projectId),
            fileType: "product_card",
            category: "product_creation",
            title: `Producto: ${createdTitle}`,
            description: finalBody ? String(finalBody).replace(/<[^>]*>/g, "").slice(0, 200) : undefined,
            productId: createdProductId,
            productTitle: createdTitle,
            generatedBy: "shopybrain_voice",
            metadata: {
              price: finalPrice,
              status: created.product.status,
              tags: finalTags,
              shopifyId: created.product.id,
              seoTitle,
              seoDescription,
            },
          }).catch(() => {});
  
          const variantSummary = createdVariants.map((v: Record<string, unknown>) =>
            `${v.option1 || ""}${v.option2 ? "/" + v.option2 : ""}${v.option3 ? "/" + v.option3 : ""}: ${v.inventory_quantity ?? 0} uds, ${v.price}€, SKU:${v.sku || "N/A"}`
          ).slice(0, 15).join("; ");
  
          learnFromOperation({
            operationType: "product_creation",
            niche: project.storeNiche,
            productType: params?.productType || null,
            title: `Producto creado: ${createdTitle} (${createdVariants.length} variantes, ${totalStock} uds stock total)`,
            content: JSON.stringify({
              title: createdTitle,
              description: finalBody ? String(finalBody).slice(0, 500) : "",
              tags: finalTags,
              price: finalPrice,
              handle: createdHandle,
              seoTitle,
              seoDescription,
              variantsCount: createdVariants.length,
              totalStock,
              options: aiContent?.options || [],
              inventoryPolicy: aiContent?.inventoryPolicy || "deny",
              variantSummary,
            }),
            confidence: 0.95,
          });
  
          const imageTypes = IMAGE_TYPES_BY_PLAN[plan] || IMAGE_TYPES_BY_PLAN.starter;
          let imagesGenerated = 0;
          let imagesUploaded = 0;
          const imageErrors: string[] = [];
  
          if (params?.aiGenerate !== false && params?.skipImages !== true) {
            const existingImages = await shopifyRequest<{ images: Array<{ id: number; src: string; alt: string }> }>(
              parseInt(projectId), project.shopDomain, `/products/${createdProductId}/images.json`
            ).catch(() => ({ images: [] }));
            const existingImageCount = existingImages.images?.length ?? 0;
  
            if (existingImageCount > 0) {
              logger.info({ productId: createdProductId, existingImages: existingImageCount }, "Producto ya tiene imágenes, omitiendo generación para evitar duplicados");
            }
  
            const hasReferenceImage = !!params?.referenceImageUrl;
  
            if (existingImageCount > 0) {
              /* skip — ya tiene imágenes */
            } else if (hasReferenceImage) {
              try {
                const { getScenesForProductType, downloadImageToBuffer, uploadBufferToShopify } = await import("../reference-images.js");
                const { editImageFromBuffer } = await import("@workspace/integrations-openai-ai-server/image");
                const { productsTable: pTable, generationJobsTable: gjTable } = await import("@workspace/db");
  
                const refMetafields: Array<{ namespace: string; key: string; value: string }> = [];
                if (seoTitle) refMetafields.push({ namespace: "seo", key: "title", value: seoTitle });
                if (seoDescription) refMetafields.push({ namespace: "seo", key: "description", value: seoDescription });
                const refAudit = auditProduct({
                  title: createdTitle, body_html: finalBody || "",
                  price: finalPrice, compare_at_price: finalCompareAt,
                  images: (created.product.images as Array<{ alt: string | null }>) || [],
                  tags: finalTags, metafields: refMetafields,
                });
  
                await db.insert(pTable).values({
                  projectId: parseInt(projectId),
                  shopifyProductId: createdProductId,
                  title: createdTitle,
                  handle: createdHandle,
                  bodyHtml: finalBody || null,
                  vendor: params?.vendor || null,
                  productType: params?.productType || null,
                  status: "active" as "active" | "draft" | "archived",
                  tags: finalTags || null,
                  price: finalPrice,
                  compareAtPrice: finalCompareAt,
                  imageCount: 0,
                  variantCount: 1,
                  auditScore: refAudit.overallScore,
                  auditGrade: refAudit.grade,
                  titleScore: refAudit.titleScore,
                  descriptionScore: refAudit.descriptionScore,
                  priceScore: refAudit.priceScore,
                  imageScore: refAudit.imageScore,
                  seoScore: refAudit.seoScore,
                  auditProblems: refAudit.problems,
                  lastAuditedAt: new Date(),
                }).onConflictDoNothing().catch(() => {});
  
                const referenceBuffer = await downloadImageToBuffer(String(params.referenceImageUrl));
                const scenes = getScenesForProductType(params?.productType || "", storeNiche);
  
                const limitCheck = await checkProdLimit(parseInt(projectId), "image", scenes.length);
                const allowedCount = limitCheck.allowed ? scenes.length : Math.max(0, limitCheck.remaining?.images ?? 0);
  
                if (allowedCount > 0) {
                  const finalScenes = scenes.slice(0, allowedCount);
                  let position = 0;
  
                  for (const scene of finalScenes) {
                    position++;
                    try {
                      const prompt = scene.promptTemplate(createdTitle, params?.productType || "", storeNiche);
                      const generatedBuffer = await editImageFromBuffer(referenceBuffer, prompt, "reference.png");
  
                      const altText = `${createdTitle} - ${scene.label}`;
                      const uploadResult = await uploadBufferToShopify({
                        projectId: parseInt(projectId),
                        shopDomain: project.shopDomain,
                        shopifyProductId: createdProductId,
                        imageBuffer: generatedBuffer,
                        altText,
                        position,
                      });
  
                      if (uploadResult.success) {
                        imagesGenerated++;
                        imagesUploaded++;
                        await recProdUsage(parseInt(projectId), "image", 1);
                      } else {
                        imageErrors.push(`${scene.label}: upload failed`);
                      }
  
                      await db.insert(gjTable).values({
                        projectId: parseInt(projectId),
                        shopifyProductId: createdProductId,
                        imageType: scene.key,
                        status: uploadResult.success ? "succeeded" : "failed",
                        prompt: prompt.slice(0, 2000),
                        model: "gpt-image-1",
                        estimatedCost: 0.04,
                        altText,
                        shopifyImageId: uploadResult.shopifyImageId ?? null,
                        completedAt: new Date(),
                      }).catch(() => {});
                    } catch (e: unknown) {
                      imageErrors.push(`${scene.label}: ${e instanceof Error ? e.message : "error"}`);
                    }
                  }
                }
              } catch (imgErr: unknown) {
                logger.error({ err: imgErr }, "Error en generación de imágenes desde referencia");
              }
            } else {
              try {
                const { productsTable: pTable, generationJobsTable: gjTable } = await import("@workspace/db");
                const { buildImagePrompt: buildPrompt, runImageGeneration: runGeneration, MODEL_MAP: modelMap, COST_MAP: costMap, NEGATIVE_PROMPT: negPrompt, uploadGeneratedImageToShopify: uploadImg } = await import("../images.js");
  
                const genMf: Array<{ namespace: string; key: string; value: string }> = [];
                if (seoTitle) genMf.push({ namespace: "seo", key: "title", value: seoTitle });
                if (seoDescription) genMf.push({ namespace: "seo", key: "description", value: seoDescription });
                const genAudit = auditProduct({
                  title: createdTitle, body_html: finalBody || "",
                  price: finalPrice, compare_at_price: finalCompareAt,
                  images: (created.product.images as Array<{ alt: string | null }>) || [],
                  tags: finalTags, metafields: genMf,
                });
  
                await db.insert(pTable).values({
                  projectId: parseInt(projectId),
                  shopifyProductId: createdProductId,
                  title: createdTitle,
                  handle: createdHandle,
                  bodyHtml: finalBody || null,
                  vendor: params?.vendor || null,
                  productType: params?.productType || null,
                  status: "active" as "active" | "draft" | "archived",
                  tags: finalTags || null,
                  price: finalPrice,
                  compareAtPrice: finalCompareAt,
                  imageCount: 0,
                  variantCount: 1,
                  auditScore: genAudit.overallScore,
                  auditGrade: genAudit.grade,
                  titleScore: genAudit.titleScore,
                  descriptionScore: genAudit.descriptionScore,
                  priceScore: genAudit.priceScore,
                  imageScore: genAudit.imageScore,
                  seoScore: genAudit.seoScore,
                  auditProblems: genAudit.problems,
                  lastAuditedAt: new Date(),
                }).onConflictDoNothing().catch(() => {});
  
                const limitCheck = await checkProdLimit(parseInt(projectId), "image", imageTypes.length);
                const allowedCount = limitCheck.allowed ? imageTypes.length : Math.max(0, limitCheck.remaining?.images ?? 0);
  
                if (allowedCount > 0) {
                  const typesToGenerate = imageTypes.slice(0, allowedCount);
  
                  let imagePosition = 0;
                  const generateAndUpload = async (imageType: string): Promise<void> => {
                    const position = ++imagePosition;
                    try {
                      const model = modelMap[imageType] ?? modelMap.hero;
                      const estimatedCost = costMap[model] ?? 0.04;
                      const prompt = await buildPrompt(
                        parseInt(projectId), createdTitle, params?.productType || null,
                        imageType, storeNiche, project.brandTone, finalBody || null
                      );
  
                      const [job] = await db.insert(gjTable).values({
                        projectId: parseInt(projectId),
                        shopifyProductId: createdProductId,
                        imageType,
                        status: "pending",
                        prompt,
                        negativePrompt: negPrompt,
                        model,
                        estimatedCost,
                      }).returning();
  
                      const genResult = await runGeneration({
                        job: { id: job.id },
                        projectId: parseInt(projectId),
                        shopifyProductId: createdProductId,
                        imageType,
                        finalPrompt: prompt,
                        model,
                        estimatedCost,
                        product: { title: createdTitle, productType: params?.productType || null },
                        project: { storeNiche: project.storeNiche, brandTone: project.brandTone, replicateApiToken: project.replicateApiToken },
                      });
  
                      if (genResult.success && genResult.imageUrl) {
                        imagesGenerated++;
                        await recProdUsage(parseInt(projectId), "image", 1);
  
                        const [updatedJob] = await db.select().from(gjTable).where(eq(gjTable.id, job.id));
                        const uploadResult = await uploadImg({
                          projectId: parseInt(projectId),
                          shopDomain: project.shopDomain,
                          shopifyProductId: createdProductId,
                          jobId: job.id,
                          imageUrl: genResult.imageUrl,
                          altText: updatedJob?.altText || `${createdTitle} - ${imageType}`,
                          imageType,
                          position,
                        });
                        if (uploadResult.success) imagesUploaded++;
                        else imageErrors.push(`${imageType}: upload failed`);
                      } else {
                        imageErrors.push(`${imageType}: ${genResult.error || "generation failed"}`);
                      }
                    } catch (e: unknown) {
                      imageErrors.push(`${imageType}: ${e instanceof Error ? e.message : "error"}`);
                    }
                  };
  
                  const heroType = typesToGenerate.find(t => t === "hero");
                  const otherTypes = typesToGenerate.filter(t => t !== "hero");
  
                  if (heroType) {
                    await generateAndUpload(heroType);
                  }
  
                  if (otherTypes.length > 0) {
                    const batchSize = 2;
                    for (let i = 0; i < otherTypes.length; i += batchSize) {
                      const batch = otherTypes.slice(i, i + batchSize);
                      await Promise.allSettled(batch.map(t => generateAndUpload(t)));
                    }
                  }
                }
              } catch (imgErr: unknown) {
                logger.error({ err: imgErr }, "Error en generación de imágenes para producto nuevo");
              }
            }
          }
  
          let imagesSummary = "";
          if (imagesGenerated > 0) {
            imagesSummary = `\n📸 ${imagesGenerated} imagen(es) generada(s) con IA`;
            if (imagesUploaded > 0) imagesSummary += `, ${imagesUploaded} subida(s) a Shopify`;
            if (imageErrors.length > 0) imagesSummary += ` (⚠️ ${imageErrors.length} con error: ${imageErrors.join(", ")})`;
          } else if (imageErrors.length > 0) {
            imagesSummary = `\n⚠️ Imágenes: ${imageErrors.length} error(es) — ${imageErrors.join(", ")}`;
          } else if (params?.skipImages === true) {
            imagesSummary = `\n📸 Imágenes omitidas (skipImages=true)`;
          } else if (params?.aiGenerate === false) {
            imagesSummary = "";
          } else {
            imagesSummary = `\n📸 Generación de imágenes no disponible (verifica Replicate API token)`;
          }
  
          let seoSummary = "";
          if (seoTitle || seoDescription) {
            seoSummary = `\n🔍 SEO: meta title y description configurados`;
          }
  
          try {
            const freshProduct = await shopifyRequest<{ product: Record<string, unknown> }>(
              parseInt(projectId), project.shopDomain, `/products/${createdProductId}.json`
            );
            const sp = freshProduct.product;
            const spImages = (sp.images as Array<Record<string, unknown>>) || [];
            const spVariants = (sp.variants as Array<Record<string, unknown>>) || [];
            const { productsTable: syncPT } = await import("@workspace/db");
            const { auditProduct: auditProd } = await import("../../lib/audit.js");
  
            const postMf: Array<{ namespace: string; key: string; value: string }> = [];
            if (seoTitle) postMf.push({ namespace: "seo", key: "title", value: seoTitle });
            if (seoDescription) postMf.push({ namespace: "seo", key: "description", value: seoDescription });
            if (postMf.length === 0) {
              try {
                const postSeoGql = `{ product(id: "gid://shopify/Product/${createdProductId}") { seo { title description } } }`;
                const postSeoRes = await shopifyGraphQL<{ product: { seo: { title: string | null; description: string | null } } }>(
                  parseInt(projectId), project.shopDomain, postSeoGql
                );
                if (postSeoRes.product?.seo?.title) postMf.push({ namespace: "seo", key: "title", value: postSeoRes.product.seo.title });
                if (postSeoRes.product?.seo?.description) postMf.push({ namespace: "seo", key: "description", value: postSeoRes.product.seo.description });
              } catch {}
            }
  
            const audit = auditProd({
              title: String(sp.title || ""),
              body_html: String(sp.body_html || ""),
              price: String((spVariants[0] as Record<string, unknown>)?.price || "0"),
              compare_at_price: (spVariants[0] as Record<string, unknown>)?.compare_at_price ? String((spVariants[0] as Record<string, unknown>).compare_at_price) : null,
              images: spImages.map(img => ({ alt: (img.alt as string) || null })),
              tags: String(sp.tags || ""),
              variants: spVariants.map((v: Record<string, unknown>) => ({ price: String(v.price || "0") })),
              metafields: postMf,
            });
            await db.insert(syncPT).values({
              projectId: parseInt(projectId),
              shopifyProductId: createdProductId,
              title: String(sp.title),
              handle: String(sp.handle || ""),
              bodyHtml: String(sp.body_html || ""),
              vendor: String(sp.vendor || ""),
              productType: String(sp.product_type || ""),
              status: String(sp.status || "draft") as "active" | "draft" | "archived",
              publishedAt: sp.published_at ? String(sp.published_at) : null,
              tags: String(sp.tags || ""),
              price: String((spVariants[0] as Record<string, unknown>)?.price || "0"),
              compareAtPrice: (spVariants[0] as Record<string, unknown>)?.compare_at_price ? String((spVariants[0] as Record<string, unknown>).compare_at_price) : null,
              imageCount: spImages.length,
              variantCount: spVariants.length,
              imagesJson: spImages,
              auditScore: audit.overallScore,
              auditGrade: audit.grade,
              titleScore: audit.titleScore,
              descriptionScore: audit.descriptionScore,
              priceScore: audit.priceScore,
              imageScore: audit.imageScore,
              seoScore: audit.seoScore,
              auditProblems: audit.problems,
              lastAuditedAt: new Date(),
            }).onConflictDoUpdate({
              target: [syncPT.projectId, syncPT.shopifyProductId],
              set: {
                title: String(sp.title), handle: String(sp.handle || ""), bodyHtml: String(sp.body_html || ""),
                status: String(sp.status || "draft") as "active" | "draft" | "archived",
                price: String((spVariants[0] as Record<string, unknown>)?.price || "0"),
                imageCount: spImages.length, variantCount: spVariants.length, imagesJson: spImages,
                auditScore: audit.overallScore, auditGrade: audit.grade,
                titleScore: audit.titleScore, descriptionScore: audit.descriptionScore,
                priceScore: audit.priceScore, imageScore: audit.imageScore, seoScore: audit.seoScore,
                auditProblems: audit.problems, lastAuditedAt: new Date(),
              },
            }).catch(() => {});
            logger.info({ productId: createdProductId, auditScore: audit.overallScore, grade: audit.grade, images: spImages.length }, "Post-creation audit completed");
          } catch (auditErr) {
            logger.warn({ err: auditErr, productId: createdProductId }, "Post-creation audit failed (non-critical)");
          }
  
          const optionNames = ((created.product.options || []) as Array<{ name: string; values?: string[] }>)
            .map(o => `${o.name} (${(o.values || []).length} valores)`)
            .join(", ");
          const variantStockSummary = createdVariants.length > 1
            ? `\n📊 Variantes: ${createdVariants.length} combinaciones | Stock total: ${totalStock} unidades`
            : "";
          const optionsSummary = optionNames ? `\n🎛️ Opciones: ${optionNames}` : "";
  
          result = {
            productId: created.product.id,
            title: createdTitle,
            status: created.product.status,
            handle: createdHandle,
            price: finalPrice,
            compareAtPrice: finalCompareAt,
            seoTitle,
            seoDescription,
            variantsCount: createdVariants.length,
            totalStock,
            options: (created.product.options || []) as Array<{ name: string; values?: string[] }>,
            imagesGenerated,
            imagesUploaded,
            imageTypes: (IMAGE_TYPES_BY_PLAN[plan] || []).slice(0, imagesGenerated),
            message: `✅ Producto "${createdTitle}" creado COMPLETO en Shopify (ID: ${created.product.id})
  
  📝 Contenido: Titulo SEO optimizado + descripcion profesional (400+ palabras)
  🏷️ Tags: ${finalTags ? finalTags.split(",").length : 0} tags SEO generados
  ${pricingInfo || `💰 Precio: ${finalPrice}€`}${finalCompareAt ? ` (antes: ${finalCompareAt}€)` : ""}${optionsSummary}${variantStockSummary}${seoSummary}${imagesSummary}
  📦 Estado: ${created.product.status} | Inventario: gestionado por Shopify
  🔗 Handle: ${createdHandle}
  
  Plan activo: ${plan} → ${(IMAGE_TYPES_BY_PLAN[plan] || []).length} tipos de imagen disponibles`,
          };
          break;
        }

        case "edit_product": {
          const projectId = params?.projectId;
          const productId = params?.productId;
          if (!projectId || !productId) { res.status(400).json({ error: "projectId y productId requeridos" }); return; }
          const [project] = await db.select().from(projectsTable).where(eq(projectsTable.id, parseInt(projectId)));
          if (!project) { res.status(404).json({ error: "Proyecto no encontrado" }); return; }
  
          const beforeEdit = await shopifyRequest<{ product: Record<string, unknown> }>(
            parseInt(projectId), project.shopDomain, `/products/${productId}.json?fields=id,title,status,variants,images,tags,body_html,published_at,published_scope,vendor,product_type`
          );
          const beforeProduct = beforeEdit.product;
          const beforeVariants = (beforeProduct.variants as Array<Record<string, unknown>>) || [];
          const beforeImages = (beforeProduct.images as unknown[]) || [];
          const beforeBodyLen = (beforeProduct.body_html as string || "").length;
          const beforeTags = ((beforeProduct.tags as string) || "").split(",").filter((t: string) => t.trim());
          const beforePublished = !!beforeProduct.published_at;
          const beforeCompare = beforeVariants[0]?.compare_at_price;
  
          const preAuditIssues: string[] = [];
          if (!beforePublished) preAuditIssues.push("NO PUBLICADO (invisible para clientes)");
          if (!beforeCompare) preAuditIssues.push("Sin compare_at_price");
          if (beforeImages.length < 3) preAuditIssues.push(`Pocas imágenes (${beforeImages.length})`);
          if (beforeBodyLen < 500) preAuditIssues.push(`Descripción corta (${beforeBodyLen}ch)`);
          if (beforeTags.length < 10) preAuditIssues.push(`Pocos tags (${beforeTags.length})`);
  
          const updates: Record<string, unknown> = { id: parseInt(productId) };
          if (params?.title) updates.title = params.title;
          if (params?.bodyHtml) updates.body_html = params.bodyHtml;
          if (params?.tags) updates.tags = params.tags;
          if (params?.status) updates.status = params.status;
          if (params?.vendor) updates.vendor = params.vendor;
          if (params?.productType) updates.product_type = params.productType;
          if (params?.seoTitle) updates.metafields_global_title_tag = params.seoTitle;
          if (params?.seoDescription) updates.metafields_global_description_tag = params.seoDescription;
          if (params?.publish === true) {
            updates.status = "active";
            updates.published = true;
            updates.published_scope = "global";
          }
  
          if (Object.keys(updates).length <= 1) {
            res.status(400).json({ error: "Se requiere al menos un campo a actualizar (title, bodyHtml, tags, status, price, vendor, productType, seoTitle, seoDescription, publish)" });
            return;
          }
  
          if (params?.price || params?.compareAtPrice) {
            const varId = params.variantId || beforeVariants[0]?.id;
            if (varId) {
              const variantUpdate: Record<string, unknown> = { id: varId };
              if (params?.price) variantUpdate.price = params.price;
              if (params?.compareAtPrice) variantUpdate.compare_at_price = params.compareAtPrice;
              updates.variants = [variantUpdate];
            }
          }
  
          const updated = await shopifyRequest<{ product: Record<string, unknown> }>(
            parseInt(projectId), project.shopDomain, `/products/${productId}.json`,
            { method: "PUT", body: JSON.stringify({ product: updates }) }
          );
  
          const afterVariants = (updated.product.variants as Array<Record<string, unknown>>) || [];
          const afterImages = (updated.product.images as unknown[]) || [];
          const afterBodyLen = (updated.product.body_html as string || "").length;
          const afterPublished = !!updated.product.published_at;
  
          const postAuditIssues: string[] = [];
          if (!afterPublished) postAuditIssues.push("⚠️ Sigue SIN PUBLICAR");
          if (!afterVariants[0]?.compare_at_price) postAuditIssues.push("⚠️ Sigue sin compare_at_price");
          if (afterImages.length < 3) postAuditIssues.push(`⚠️ Pocas imágenes (${afterImages.length})`);
          if (afterBodyLen < 500) postAuditIssues.push(`⚠️ Descripción corta (${afterBodyLen}ch)`);
  
          const preAuditText = preAuditIssues.length > 0 ? `\n\n🔍 Pre-auditoría: ${preAuditIssues.join(" | ")}` : "";
          const postAuditText = postAuditIssues.length > 0 ? `\n🔍 Post-auditoría: ${postAuditIssues.join(" | ")}` : "\n✅ Auditoría post-edición OK";
  
          result = {
            productId: updated.product.id,
            title: updated.product.title,
            status: updated.product.status,
            published: afterPublished,
            preAuditIssues,
            postAuditIssues,
            message: `Producto "${updated.product.title}" actualizado en Shopify${preAuditText}${postAuditText}`,
          };
          break;
        }

        case "change_price": {
          const projectId = params?.projectId;
          let productId = params?.productId;
          const productTitle = params?.title || params?.name;
          const newPrice = params?.price;
          if (!projectId || (!productId && !productTitle) || !newPrice) { res.status(400).json({ error: "projectId, (productId o title) y price requeridos" }); return; }
          const [project] = await db.select().from(projectsTable).where(eq(projectsTable.id, parseInt(projectId)));
          if (!project) { res.status(404).json({ error: "Proyecto no encontrado" }); return; }
  
          if (!productId && productTitle) {
            const cleanTitle = String(productTitle).trim();
            if (cleanTitle.length < 3) { res.status(400).json({ error: "El nombre del producto debe tener al menos 3 caracteres" }); return; }
            const catalog = await shopifyRequest<{ products: Array<Record<string, unknown>> }>(
              parseInt(projectId), project.shopDomain, "/products.json?limit=250&fields=id,title"
            );
            const searchName = cleanTitle.toLowerCase();
            const exactMatch = (catalog.products || []).find(p => String(p.title || "").toLowerCase() === searchName);
            const partialMatches = exactMatch ? [] : (catalog.products || []).filter(p => {
              const pTitle = String(p.title || "").toLowerCase();
              return pTitle.includes(searchName) || searchName.includes(pTitle);
            });
            const matched = exactMatch || (partialMatches.length === 1 ? partialMatches[0] : null);
            if (!matched && partialMatches.length > 1) {
              const candidates = partialMatches.slice(0, 5).map(p => `• ${p.title} (ID: ${p.id})`).join("\n");
              res.status(400).json({ error: `Varios productos coinciden con "${cleanTitle}":\n${candidates}\n\nEspecifica el nombre exacto o el productId.` }); return;
            }
            if (!matched) { res.status(404).json({ error: `Producto "${cleanTitle}" no encontrado en Shopify` }); return; }
            productId = String(matched.id);
          }
  
          const current = await shopifyRequest<{ product: { title: string; variants: Array<{ id: number; price: string }> } }>(
            parseInt(projectId), project.shopDomain, `/products/${productId}.json?fields=id,title,variants`
          );
          const variantId = current.product.variants?.[0]?.id;
          if (!variantId) { res.status(404).json({ error: "No se encontró variante" }); return; }
  
          await shopifyRequest(
            parseInt(projectId), project.shopDomain, `/variants/${variantId}.json`,
            { method: "PUT", body: JSON.stringify({ variant: { id: variantId, price: String(newPrice), compare_at_price: params?.compareAtPrice || null } }) }
          );
  
          result = {
            productId,
            oldPrice: current.product.variants[0].price,
            newPrice: String(newPrice),
            message: `Precio actualizado para "${current.product.title}": ${current.product.variants[0].price}€ → ${newPrice}€`,
          };
          break;
        }

        case "regenerate_token": {
          const projectId = params?.projectId;
          if (!projectId) { res.status(400).json({ error: "projectId requerido" }); return; }
          const [project] = await db.select().from(projectsTable).where(eq(projectsTable.id, parseInt(projectId)));
          if (!project) { res.status(404).json({ error: "Proyecto no encontrado" }); return; }
  
          const plainSecret = safeDecrypt(project.clientSecret) || project.clientSecret;
          const newToken = await refreshToken(parseInt(projectId), project.shopDomain, project.clientId, plainSecret);
          const [updated] = await db.select({ tokenExpiresAt: projectsTable.tokenExpiresAt }).from(projectsTable).where(eq(projectsTable.id, parseInt(projectId)));
  
          result = {
            success: true,
            tokenValid: !!newToken,
            expiresAt: updated?.tokenExpiresAt,
            hoursRemaining: updated?.tokenExpiresAt ? Math.round((new Date(updated.tokenExpiresAt).getTime() - Date.now()) / 3600000 * 10) / 10 : 0,
            message: `Token regenerado exitosamente. Válido por ${updated?.tokenExpiresAt ? Math.round((new Date(updated.tokenExpiresAt).getTime() - Date.now()) / 3600000) : 24} horas. Iniciando sincronización automática de datos…`,
            syncStarted: true,
          };

          // Auto-sync en background: sincronizar productos y SEO tras renovar token
          setImmediate(async () => {
            try {
              await fetch(`http://localhost:${process.env.PORT || 8080}/api/projects/${projectId}/products/sync?statusFilter=any`, {
                method: "POST",
                headers: { "Content-Type": "application/json", "Cookie": req.headers.cookie || "" },
                body: JSON.stringify({ statusFilter: "any" }),
              });
            } catch { /* fire-and-forget */ }
          });
          break;
        }

        case "get_scopes": {
          const projectId = params?.projectId;
          if (!projectId) { res.status(400).json({ error: "projectId requerido" }); return; }
          const [project] = await db.select().from(projectsTable).where(eq(projectsTable.id, parseInt(projectId)));
          if (!project) { res.status(404).json({ error: "Proyecto no encontrado" }); return; }
  
          try {
            const headers = await getShopifyHeaders(parseInt(projectId));
            const domain = normalizeShopDomain(project.shopDomain);
            const scopesRes = await fetch(`https://${domain}/admin/oauth/access_scopes.json`, { headers });
            if (!scopesRes.ok) throw new Error(`Scopes request failed: ${scopesRes.status}`);
            const scopesData = await scopesRes.json() as { access_scopes: Array<{ handle: string }> };
            const scopes = scopesData.access_scopes?.map(s => s.handle) ?? [];
            result = {
              scopes,
              total: scopes.length,
              hasWriteProducts: scopes.includes("write_products"),
              hasWriteInventory: scopes.includes("write_inventory"),
              hasWriteContent: scopes.includes("write_content"),
              hasReadOrders: scopes.includes("read_orders"),
              message: `${scopes.length} scopes activos: ${scopes.join(", ")}`,
            };
          } catch (e) {
            result = {
              scopes: ["read_products", "write_products", "read_orders", "write_orders", "read_all_orders", "read_customers", "write_customers", "read_analytics", "read_inventory", "write_inventory", "read_price_rules", "write_price_rules", "read_content", "write_content", "read_themes", "write_themes", "read_discounts", "write_discounts", "read_shipping", "write_shipping", "read_fulfillments", "write_fulfillments", "read_assigned_fulfillment_orders", "write_assigned_fulfillment_orders", "read_merchant_managed_fulfillment_orders", "write_merchant_managed_fulfillment_orders", "read_draft_orders", "write_draft_orders", "read_checkouts", "write_checkouts", "read_locations", "read_reports", "read_script_tags", "write_script_tags", "unauthenticated_read_product_listings"],
              total: 35,
              message: "35 scopes configurados en OAuth (todos los scopes del Admin API de Shopify)",
              note: "Error consultando scopes en vivo, mostrando scopes configurados",
            };
          }
          break;
        }

        case "delete_product": {
          const projectId = params?.projectId;
          const productId = params?.productId;
          if (!projectId || !productId) { res.status(400).json({ error: "projectId y productId requeridos" }); return; }
          if (!params?.confirmed) {
            res.json({ success: false, requiresConfirmation: true, action: "delete_product", productId, message: "⚠️ ¿Estás seguro de eliminar este producto? Envía la orden de nuevo para confirmar." });
            return;
          }
          const [project] = await db.select().from(projectsTable).where(eq(projectsTable.id, parseInt(projectId)));
          if (!project) { res.status(404).json({ error: "Proyecto no encontrado" }); return; }
  
          await shopifyRequest(
            parseInt(projectId), project.shopDomain, `/products/${productId}.json`,
            { method: "DELETE" }
          );
  
          result = { productId, message: `Producto ${productId} eliminado de Shopify` };
          break;
        }

        case "search_product": {
          const projectId = params?.projectId;
          const query = params?.query;
          if (!projectId || !query) { res.status(400).json({ error: "projectId y query requeridos" }); return; }
          const [project] = await db.select().from(projectsTable).where(eq(projectsTable.id, parseInt(projectId)));
          if (!project) { res.status(404).json({ error: "Proyecto no encontrado" }); return; }
  
          let allSearchResults: Array<Record<string, unknown>> = [];
          for (const st of ["active", "draft", "archived"]) {
            const d = await shopifyRequest<{ products: Array<Record<string, unknown>> }>(
              parseInt(projectId), project.shopDomain, `/products.json?title=${encodeURIComponent(query)}&limit=10&status=${st}&published_status=any&fields=id,title,handle,status,variants,images,tags,body_html,published_at,published_scope`
            );
            allSearchResults = allSearchResults.concat(d.products || []);
          }
  
          const searchSeoRows = await db.select().from(seoDataTable).where(eq(seoDataTable.projectId, parseInt(projectId)));
          const searchSeoLookup = new Map(searchSeoRows.map(s => [s.shopifyProductId, s]));
  
          result = {
            products: allSearchResults.map((p: Record<string, unknown>) => {
              const variants = (p.variants as Array<Record<string, string>>) || [];
              const images = (p.images as unknown[]) || [];
              const bodyLen = (p.body_html as string || "").length;
              const tagsArr = ((p.tags as string) || "").split(",").filter((t: string) => t.trim());
              const hasCompare = !!variants[0]?.compare_at_price;
              const isPublished = !!p.published_at;
              const imgCount = images.length;
  
              const issues: string[] = [];
              if (!isPublished) issues.push("NO PUBLICADO");
              if (!hasCompare) issues.push("sin compare_at_price");
              if (imgCount < 3) issues.push(`pocas imágenes (${imgCount})`);
              if (bodyLen < 500) issues.push(`descripción corta (${bodyLen}ch)`);
  
              let score = 0;
              if (imgCount >= 3) score += 25; else if (imgCount >= 1) score += 10;
              if (bodyLen >= 1000) score += 25; else if (bodyLen >= 500) score += 15; else if (bodyLen >= 200) score += 8;
              if (tagsArr.length >= 10) score += 25; else if (tagsArr.length >= 5) score += 15;
              if (hasCompare) score += 25;
  
              const spSeo = searchSeoLookup.get(String(p.id));
              const searchImages = (p.images as Array<Record<string, unknown>>) || [];
              const spHasAltTexts = searchImages.length > 0 && searchImages.every((img: Record<string, unknown>) => !!img.alt);
              const spHandle = (p.handle as string) || "";
              return {
                id: p.id, title: p.title, status: p.status,
                price: variants[0]?.price,
                compareAtPrice: variants[0]?.compare_at_price || null,
                imageCount: imgCount,
                imageUrl: searchImages[0]?.src || null,
                tagsCount: tagsArr.length,
                variantCount: variants.length,
                descriptionLength: bodyLen,
                published: isPublished,
                publishedScope: p.published_scope || "unknown",
                auditScore: score,
                auditGrade: score >= 85 ? "A" : score >= 60 ? "B" : score >= 40 ? "C" : "D",
                hasComparePrice: hasCompare,
                hasMetaTitle: !!(spSeo?.metaTitle && spSeo.metaTitle.length > 10),
                hasMetaDesc: !!(spSeo?.metaDescription && spSeo.metaDescription.length > 10),
                hasAltTexts: spHasAltTexts,
                cleanHandle: !!spHandle && !spHandle.includes("_"),
                issues: issues.length > 0 ? issues : undefined,
              };
            }),
            total: allSearchResults.length,
            message: `${allSearchResults.length} productos encontrados para "${query}"`,
          };
          break;
        }

        case "publish_product": {
          const projectId = params?.projectId;
          const productId = params?.productId;
          if (!projectId || !productId) { res.status(400).json({ error: "projectId y productId requeridos" }); return; }
          const [project] = await db.select().from(projectsTable).where(eq(projectsTable.id, parseInt(projectId)));
          if (!project) { res.status(404).json({ error: "Proyecto no encontrado" }); return; }
  
          const beforePub = await shopifyRequest<{ product: Record<string, unknown> }>(
            parseInt(projectId), project.shopDomain, `/products/${productId}.json?fields=id,title,status,published_at,published_scope,variants,images,tags,body_html`
          );
          const prevStatus = beforePub.product.status;
          const prevPublished = !!beforePub.product.published_at;
          const prevScope = beforePub.product.published_scope;
  
          const updated = await shopifyRequest<{ product: Record<string, unknown> }>(
            parseInt(projectId), project.shopDomain, `/products/${productId}.json`,
            { method: "PUT", body: JSON.stringify({ product: { id: productId, status: "active", published: true, published_scope: "global" } }) }
          );
  
          const variants = (updated.product.variants as Array<Record<string, unknown>>) || [];
          const images = (updated.product.images as unknown[]) || [];
          const bodyLen = (updated.product.body_html as string || "").length;
          const hasCompare = !!variants[0]?.compare_at_price;
          const issues: string[] = [];
          if (!hasCompare) issues.push("⚠️ Sin compare_at_price (precio tachado)");
          if (images.length < 3) issues.push(`⚠️ Pocas imágenes (${images.length})`);
          if (bodyLen < 500) issues.push(`⚠️ Descripción corta (${bodyLen}ch)`);
  
          const auditNote = issues.length > 0 ? `\n\n🔍 Auditoría post-publicación:\n${issues.join("\n")}` : "\n\n✅ Auditoría OK — producto completo";
  
          result = {
            productId,
            title: updated.product.title,
            status: "active",
            published: true,
            publishedScope: "global",
            previousStatus: prevStatus,
            wasPublished: prevPublished,
            previousScope: prevScope,
            auditIssues: issues,
            message: `✅ Producto "${updated.product.title}" publicado correctamente\n📢 Estado: active | Publicado: SÍ | Alcance: global\n📋 Antes: status=${prevStatus}, publicado=${prevPublished ? "sí" : "no"}, scope=${prevScope}${auditNote}`,
          };
          break;
        }

        case "get_orders": {
          const projectId = params?.projectId;
          if (!projectId) { res.status(400).json({ error: "projectId requerido" }); return; }
          const [project] = await db.select().from(projectsTable).where(eq(projectsTable.id, parseInt(projectId)));
          if (!project) { res.status(404).json({ error: "Proyecto no encontrado" }); return; }
  
          const limit = Math.min(params?.limit ?? 10, 50);
          const data = await shopifyRequest<{ orders: Array<Record<string, unknown>> }>(
            parseInt(projectId), project.shopDomain, `/orders.json?limit=${limit}&status=any&fields=id,name,total_price,financial_status,fulfillment_status,created_at,customer`
          );
  
          result = {
            orders: data.orders.map((o: Record<string, unknown>) => ({
              id: o.id, name: o.name, total: o.total_price,
              financial: o.financial_status, fulfillment: o.fulfillment_status,
              date: o.created_at,
              customer: (o.customer as Record<string, string>)?.first_name ? `${(o.customer as Record<string, string>).first_name} ${(o.customer as Record<string, string>).last_name}` : "Anónimo",
            })),
            total: data.orders.length,
            message: `${data.orders.length} pedidos recientes`,
          };
          break;
        }

        case "fix_unpublished": {
          const projectId = params?.projectId;
          if (!projectId) { res.status(400).json({ error: "projectId requerido" }); return; }
          const [project] = await db.select().from(projectsTable).where(eq(projectsTable.id, parseInt(projectId)));
          if (!project) { res.status(404).json({ error: "Proyecto no encontrado" }); return; }
  
          const gqlUnpubQuery = (cursor?: string) => `{
            products(first: 250${cursor ? `, after: "${cursor}"` : ""}) {
              edges {
                node {
                  id
                  title
                  status
                  publishedAt
                  onlineStoreUrl
                }
              }
              pageInfo { hasNextPage endCursor }
            }
          }`;
  
          let unpublishedProducts: Array<Record<string, unknown>> = [];
          try {
            let hasNext2 = true;
            let cursor2: string | undefined;
            const allUnpubEdges: Array<{ node: Record<string, unknown> }> = [];
            while (hasNext2) {
              const gqlUnpubData = await shopifyGraphQL<{ products: { edges: Array<{ node: Record<string, unknown> }>; pageInfo: { hasNextPage: boolean; endCursor: string } } }>(
                parseInt(projectId), project.shopDomain, gqlUnpubQuery(cursor2)
              );
              allUnpubEdges.push(...(gqlUnpubData.products?.edges || []));
              hasNext2 = gqlUnpubData.products?.pageInfo?.hasNextPage || false;
              cursor2 = gqlUnpubData.products?.pageInfo?.endCursor;
            }
            unpublishedProducts = allUnpubEdges
              .map(({ node }) => ({
                id: String(node.id || "").split("/").pop(),
                title: node.title,
                status: (node.status as string || "").toLowerCase(),
                published_at: node.publishedAt,
                published_scope: node.onlineStoreUrl ? "global" : null,
              }))
              .filter((p: Record<string, unknown>) => !p.published_at || p.status === "draft");
          } catch {
            for (const st of ["active", "draft", "archived"]) {
              const d = await shopifyRequest<{ products: Array<Record<string, unknown>> }>(
                parseInt(projectId), project.shopDomain, `/products.json?limit=250&status=${st}&published_status=unpublished&fields=id,title,status,published_at,published_scope`
              );
              unpublishedProducts = unpublishedProducts.concat(d.products || []);
            }
            for (const st of ["draft"]) {
              const d = await shopifyRequest<{ products: Array<Record<string, unknown>> }>(
                parseInt(projectId), project.shopDomain, `/products.json?limit=250&status=${st}&published_status=any&fields=id,title,status,published_at,published_scope`
              );
              for (const p of (d.products || [])) {
                if (!unpublishedProducts.find((u: Record<string, unknown>) => u.id === p.id)) {
                  unpublishedProducts.push(p);
                }
              }
            }
          }
  
          if (unpublishedProducts.length === 0) {
            result = { fixed: 0, message: "✅ No hay productos sin publicar — todos están visibles para los clientes" };
            break;
          }
  
          const fixed: Array<{ id: unknown; title: string; previousStatus: string; previousPublished: boolean }> = [];
          const errors: string[] = [];
  
          for (const p of unpublishedProducts) {
            try {
              await shopifyRequest(
                parseInt(projectId), project.shopDomain, `/products/${p.id}.json`,
                { method: "PUT", body: JSON.stringify({ product: { id: p.id, status: "active", published: true, published_scope: "global" } }) }
              );
              fixed.push({
                id: p.id,
                title: String(p.title),
                previousStatus: String(p.status),
                previousPublished: !!p.published_at,
              });
            } catch (e) {
              errors.push(`${p.title}: ${e instanceof Error ? e.message : "error"}`);
            }
          }
  
          result = {
            fixed: fixed.length,
            errors: errors.length,
            products: fixed,
            errorDetails: errors.length > 0 ? errors : undefined,
            message: `✅ ${fixed.length}/${unpublishedProducts.length} producto(s) publicados correctamente (status=active, published=true, scope=global)${errors.length > 0 ? `\n⚠️ ${errors.length} error(es): ${errors.join(", ")}` : ""}`,
          };
          break;
        }

        case "fix_missing_compare_prices": {
          const projectId = params?.projectId;
          if (!projectId) { res.status(400).json({ error: "projectId requerido" }); return; }
          const [project] = await db.select().from(projectsTable).where(eq(projectsTable.id, parseInt(projectId)));
          if (!project) { res.status(404).json({ error: "Proyecto no encontrado" }); return; }
  
          const gqlPriceQuery = (cursor?: string) => `{
            products(first: 250${cursor ? `, after: "${cursor}"` : ""}) {
              edges {
                node {
                  id
                  title
                  variants(first: 100) {
                    edges {
                      node { id price compareAtPrice }
                    }
                  }
                }
              }
              pageInfo { hasNextPage endCursor }
            }
          }`;
  
          let allPriceProducts: Array<Record<string, unknown>> = [];
          try {
            let hasNext3 = true;
            let cursor3: string | undefined;
            const allPriceEdges: Array<{ node: Record<string, unknown> }> = [];
            while (hasNext3) {
              const gqlPriceData = await shopifyGraphQL<{ products: { edges: Array<{ node: Record<string, unknown> }>; pageInfo: { hasNextPage: boolean; endCursor: string } } }>(
                parseInt(projectId), project.shopDomain, gqlPriceQuery(cursor3)
              );
              allPriceEdges.push(...(gqlPriceData.products?.edges || []));
              hasNext3 = gqlPriceData.products?.pageInfo?.hasNextPage || false;
              cursor3 = gqlPriceData.products?.pageInfo?.endCursor;
            }
            allPriceProducts = allPriceEdges.map(({ node }) => {
              const variantEdges = ((node.variants as Record<string, unknown>)?.edges as Array<{ node: Record<string, unknown> }>) || [];
              return {
                id: String(node.id || "").split("/").pop(),
                title: node.title,
                variants: variantEdges.map(({ node: v }) => {
                  const varGid = String(v.id || "");
                  return { id: varGid.includes("/") ? varGid.split("/").pop() : varGid, price: v.price, compare_at_price: v.compareAtPrice };
                }),
              };
            });
          } catch {
            for (const st of ["active", "draft", "archived"]) {
              const d = await shopifyRequest<{ products: Array<Record<string, unknown>> }>(
                parseInt(projectId), project.shopDomain, `/products.json?limit=250&status=${st}&published_status=any&fields=id,title,variants`
              );
              allPriceProducts = allPriceProducts.concat(d.products || []);
            }
          }
  
          const fixedVariants: Array<{ productTitle: string; variantId: unknown; price: string; compareAtPrice: string }> = [];
          const priceErrors: string[] = [];
  
          for (const p of allPriceProducts) {
            const variants = (p.variants as Array<Record<string, unknown>>) || [];
            for (const v of variants) {
              const price = parseFloat(String(v.price || "0"));
              const hasCompare = !!v.compare_at_price;
              if (!hasCompare && price >= 1) {
                const markup = price < 30 ? 1.30 : price < 100 ? 1.28 : price < 300 ? 1.25 : 1.22;
                const rawCompare = Math.round(price * markup) - 0.01;
                const comparePrice = (rawCompare > price ? rawCompare : price + 1).toFixed(2);
                try {
                  await shopifyRequest(
                    parseInt(projectId), project.shopDomain, `/variants/${v.id}.json`,
                    { method: "PUT", body: JSON.stringify({ variant: { id: v.id, compare_at_price: comparePrice } }) }
                  );
                  fixedVariants.push({ productTitle: String(p.title), variantId: v.id, price: String(v.price), compareAtPrice: comparePrice });
                } catch (e) {
                  priceErrors.push(`${p.title} (variant ${v.id}): ${e instanceof Error ? e.message : "error"}`);
                }
              }
            }
          }
  
          result = {
            fixed: fixedVariants.length,
            errors: priceErrors.length,
            variants: fixedVariants.slice(0, 30),
            errorDetails: priceErrors.length > 0 ? priceErrors : undefined,
            message: fixedVariants.length > 0
              ? `✅ ${fixedVariants.length} variante(s) actualizadas con compare_at_price (precio tachado visible)${priceErrors.length > 0 ? `\n⚠️ ${priceErrors.length} error(es)` : ""}`
              : "✅ Todos los productos ya tienen compare_at_price configurado",
          };
          break;
        }

        case "scan_store": {
          const projectId = params?.projectId;
          if (!projectId) { res.status(400).json({ error: "projectId requerido" }); return; }
          const [project] = await db.select().from(projectsTable).where(eq(projectsTable.id, parseInt(projectId)));
          if (!project) { res.status(404).json({ error: "Proyecto no encontrado" }); return; }
  
          const statusFilter = params?.statusFilter || "any";
          const storeUrlScan = project.shopDomain
            ? (project.shopDomain.includes("://") ? project.shopDomain : `https://${project.shopDomain}`)
            : "";
  
          const [syncRes, psRes] = await Promise.allSettled([
            fetch(`http://localhost:${process.env.PORT || 8080}/api/projects/${projectId}/products/sync?statusFilter=${statusFilter}`, {
              method: "POST",
              headers: { "Content-Type": "application/json", "Cookie": req.headers.cookie || "" },
              body: JSON.stringify({ statusFilter }),
            }),
            (async () => {
              if (!storeUrlScan) return null;
              const { runDualPageSpeed } = await import("../../lib/pagespeed.js");
              return runDualPageSpeed(storeUrlScan);
            })(),
          ]);
  
          if (syncRes.status === "rejected" || (syncRes.status === "fulfilled" && !syncRes.value.ok)) {
            const errText = syncRes.status === "fulfilled" ? await syncRes.value.text() : String(syncRes.reason);
            res.status(500).json({ error: `Error escaneando: ${errText}` });
            return;
          }
  
          const syncData = await syncRes.value.json() as Record<string, unknown>;
          const psData = psRes.status === "fulfilled" ? psRes.value : null;
  
          let psMessage = "";
          if (psData?.mobile || psData?.desktop) {
            const m = psData.mobile;
            const d = psData.desktop;
            psMessage = `\n\n📊 PageSpeed Insights:`;
            if (m) psMessage += `\n📱 Móvil: Rendimiento ${m.performanceScore}/100, SEO ${m.seoScore}/100, Accesibilidad ${m.accessibilityScore}/100`;
            if (d) psMessage += `\n🖥️ Escritorio: Rendimiento ${d.performanceScore}/100, SEO ${d.seoScore}/100, Accesibilidad ${d.accessibilityScore}/100`;
            const allIssues = [...(m?.issues ?? []), ...(d?.issues ?? [])];
            if (allIssues.length > 0) psMessage += `\n⚠️ Problemas: ${allIssues.slice(0, 3).join("; ")}`;
          }
  
          const scanProducts = await db.select().from(productsTable).where(eq(productsTable.projectId, parseInt(projectId)));
          const scanSeoRows = await db.select().from(seoDataTable).where(eq(seoDataTable.projectId, parseInt(projectId)));
          const scanSeoLookup = new Map(scanSeoRows.map(s => [s.shopifyProductId, s]));
          const scanCards = scanProducts.map((p: typeof productsTable.$inferSelect) => {
            const imgs = Array.isArray(p.imagesJson) ? p.imagesJson as Array<{ src?: string; alt?: string | null }> : [];
            const descLen = typeof p.bodyHtml === "string" ? p.bodyHtml.length : 0;
            const tagsList = typeof p.tags === "string" ? p.tags.split(",").filter((t: string) => t.trim()) : [];
            const scanSeo = scanSeoLookup.get(p.shopifyProductId);
            return {
              title: p.title ?? "Sin título",
              status: p.status ?? "active",
              price: p.price ?? "0",
              compareAtPrice: p.compareAtPrice ?? null,
              imageUrl: imgs[0]?.src ?? null,
              imageCount: p.imageCount ?? 0,
              variantCount: p.variantCount ?? 1,
              descriptionLength: descLen,
              tagsCount: tagsList.length,
              published: !!p.publishedAt,
              auditScore: p.auditScore ?? 0,
              auditGrade: p.auditGrade ?? "F",
              hasComparePrice: !!p.compareAtPrice,
              hasMetaTitle: !!(scanSeo?.metaTitle && scanSeo.metaTitle.length > 10),
              hasMetaDesc: !!(scanSeo?.metaDescription && scanSeo.metaDescription.length > 10),
              hasAltTexts: imgs.length > 0 && imgs.every((i: { alt?: string | null }) => !!i.alt),
              cleanHandle: !!p.handle && !p.handle.includes("_"),
            };
          });
  
          result = {
            ...syncData,
            products: scanCards,
            statusFilter,
            pageSpeed: psData ? { mobile: psData.mobile, desktop: psData.desktop } : null,
            message: `Escaneo completado (filtro: ${statusFilter}). ${syncData.synced ?? syncData.total ?? 0} productos analizados. Nota media: ${typeof syncData.avgScore === "number" ? syncData.avgScore.toFixed(0) : "N/A"}/100${psMessage}`,
          };
          break;
        }

        case "set_product_status": {
          const projectId = params?.projectId;
          const productId = params?.productId;
          const newStatus = params?.status;
          if (!projectId || !productId || !newStatus) { res.status(400).json({ error: "projectId, productId y status (active/draft/archived) requeridos" }); return; }
          if (!["active", "draft", "archived"].includes(newStatus)) { res.status(400).json({ error: "status debe ser: active, draft o archived" }); return; }
          const [project] = await db.select().from(projectsTable).where(eq(projectsTable.id, parseInt(projectId)));
          if (!project) { res.status(404).json({ error: "Proyecto no encontrado" }); return; }
  
          const updated = await shopifyRequest<{ product: Record<string, unknown> }>(
            parseInt(projectId), project.shopDomain, `/products/${productId}.json`,
            { method: "PUT", body: JSON.stringify({ product: { id: parseInt(productId), status: newStatus } }) }
          );
  
          result = {
            productId, title: updated.product.title, status: newStatus,
            message: `Producto "${updated.product.title}" cambiado a estado: ${newStatus}`,
          };
          break;
        }

        case "list_all_products": {
          const projectId = params?.projectId;
          if (!projectId) { res.status(400).json({ error: "projectId requerido" }); return; }
          const [project] = await db.select().from(projectsTable).where(eq(projectsTable.id, parseInt(projectId)));
          if (!project) { res.status(404).json({ error: "Proyecto no encontrado" }); return; }
  
          const limit = Math.min(params?.limit ?? 20, 50);
          const statusFilter = params?.statusFilter || "any";
          const statusesToQuery = statusFilter === "any"
            ? ["active", "draft", "archived"]
            : [statusFilter];
  
          let allProds: Array<Record<string, unknown>> = [];
          for (const st of statusesToQuery) {
            const d = await shopifyRequest<{ products: Array<Record<string, unknown>> }>(
              parseInt(projectId), project.shopDomain, `/products.json?limit=${limit}&status=${st}&published_status=any&fields=id,title,handle,status,published_at,variants,images,tags,product_type,body_html`
            );
            allProds = allProds.concat(d.products || []);
          }
          if (allProds.length > limit) allProds = allProds.slice(0, limit);
  
          const lapSeoRows = await db.select().from(seoDataTable).where(eq(seoDataTable.projectId, parseInt(projectId)));
          const lapSeoLookup = new Map(lapSeoRows.map(s => [s.shopifyProductId, s]));
  
          const byStatus: Record<string, number> = {};
          allProds.forEach((p: Record<string, unknown>) => {
            const s = String(p.status || "unknown");
            byStatus[s] = (byStatus[s] || 0) + 1;
          });
  
          const published = allProds.filter(p => !!p.published_at).length;
          const unpublished = allProds.length - published;
  
          result = {
            products: allProds.map((p: Record<string, unknown>) => {
              const variants = (p.variants as Array<Record<string, string>>) || [];
              const images = (p.images as Array<Record<string, unknown>>) || [];
              const bodyHtmlLap = (p.body_html as string) || "";
              const tagsStrLap = (p.tags as string) || "";
              const tagsArr = tagsStrLap.split(",").filter((t: string) => t.trim());
              const imgCount = images.length;
  
              const lapSeo = lapSeoLookup.get(String(p.id));
              const metafieldsLap: Array<{ namespace: string; key: string; value: string }> = [];
              if (lapSeo?.metaTitle) metafieldsLap.push({ namespace: "seo", key: "title", value: lapSeo.metaTitle });
              if (lapSeo?.metaDescription) metafieldsLap.push({ namespace: "seo", key: "description", value: lapSeo.metaDescription });
  
              const lapAudit = auditProduct({
                title: (p.title as string) || "",
                body_html: bodyHtmlLap,
                price: variants[0]?.price || null,
                compare_at_price: variants[0]?.compare_at_price || null,
                images: images.map((img: Record<string, unknown>) => ({ alt: (img.alt as string) || null })),
                tags: tagsStrLap,
                variants: variants.map(v => ({ price: v.price || "0" })),
                metafields: metafieldsLap,
              });
  
              const lapHandle = (p.handle as string) || "";
              const lapHasAltTexts = imgCount > 0 && images.every((img: Record<string, unknown>) => !!(img.alt as string)?.trim());
  
              return {
                id: p.id, title: p.title, status: p.status,
                published: !!p.published_at,
                price: variants[0]?.price ?? "0.00",
                compareAtPrice: variants[0]?.compare_at_price || null,
                variantCount: variants.length,
                imageCount: imgCount,
                imageUrl: images[0]?.src || null,
                tags: p.tags,
                tagsCount: tagsArr.length,
                descriptionLength: bodyHtmlLap.length,
                product_type: p.product_type || null,
                auditScore: lapAudit.overallScore,
                auditGrade: lapAudit.grade,
                titleScore: lapAudit.titleScore,
                descriptionScore: lapAudit.descriptionScore,
                imageScore: lapAudit.imageScore,
                seoScore: lapAudit.seoScore,
                hasComparePrice: !!variants[0]?.compare_at_price,
                hasMetaTitle: !!(lapSeo?.metaTitle && lapSeo.metaTitle.length > 10),
                hasMetaDesc: !!(lapSeo?.metaDescription && lapSeo.metaDescription.length > 10),
                hasAltTexts: lapHasAltTexts,
                cleanHandle: !!lapHandle && /^[a-z0-9-]+$/.test(lapHandle) && lapHandle.length <= 60,
                problems: lapAudit.problems.slice(0, 3),
                suggestions: lapAudit.suggestions.slice(0, 2),
              };
            }),
            total: allProds.length,
            byStatus,
            published,
            unpublished,
            statusFilter,
            message: `${allProds.length} productos (filtro: ${statusFilter}). Desglose: ${Object.entries(byStatus).map(([s, c]) => `${s}: ${c}`).join(", ")}. Publicados: ${published}, No publicados: ${unpublished}`,
          };
          break;
        }

        case "search_suppliers": {
          const pName = params?.productName;
          if (!pName) { res.status(400).json({ error: "productName requerido" }); return; }
  
          const supRes = await fetch(`http://localhost:${process.env.PORT || 8080}/api/shopybrain/supplier-research`, {
            method: "POST",
            headers: { "Content-Type": "application/json", "Cookie": req.headers.cookie || "" },
            body: JSON.stringify({
              productName: pName,
              productCategory: params?.productCategory,
              materials: params?.materials,
              targetMarket: params?.targetMarket,
              qualityTier: params?.qualityTier,
              budget: params?.budget,
              country: params?.country,
            }),
          });
  
          if (!supRes.ok) {
            const errText = await supRes.text();
            res.status(500).json({ error: `Error buscando proveedores: ${errText}` });
            return;
          }
  
          const supData = await supRes.json() as Record<string, unknown>;
          const suppliersList = ((supData.suppliers as Record<string, unknown>)?.suppliers as Array<{ name: string; priceRange: string; country: string; platform: string }>) || [];
          const synth = supData.synthesis as Record<string, unknown> || {};
          const topRec = synth.topRecommendation as Record<string, string> || {};
  
          result = {
            productName: pName,
            suppliersFound: suppliersList.length,
            topRecommendation: topRec.supplier ? `${topRec.supplier} — ${topRec.reason || ""}` : "Sin recomendación",
            topSuppliers: suppliersList.slice(0, 5).map(s => `${s.name} (${s.country}) — ${s.priceRange} [${s.platform}]`),
            strategy: synth.strategy || "N/A",
            risks: synth.risks || [],
            nextSteps: synth.nextSteps || [],
            costBreakdown: synth.costBreakdown || {},
            sourcesAnalyzed: supData.sourcesAnalyzed,
            memoryId: supData.memoryId,
            fullData: supData,
            message: `Investigación de proveedores completada: ${suppliersList.length} proveedores encontrados para "${pName}"`,
          };
          break;
        }

        case "optimize_product": {
          const projectId = params?.projectId;
          const productId = params?.productId;
          if (!projectId || !productId) { res.status(400).json({ error: "projectId y productId requeridos" }); return; }
          const [project] = await db.select().from(projectsTable).where(eq(projectsTable.id, parseInt(projectId)));
          if (!project) { res.status(404).json({ error: "Proyecto no encontrado" }); return; }
  
          const prodData = await shopifyRequest<{ product: Record<string, unknown> }>(
            parseInt(projectId), project.shopDomain, `/products/${productId}.json`
          );
          const prod = prodData.product;
          const images = (prod.images as Array<Record<string, unknown>>) || [];
          const variants = (prod.variants as Array<Record<string, unknown>>) || [];
          const currentTags = String(prod.tags || "");
          const currentTitle = String(prod.title || "");
          const currentDesc = String(prod.body_html || "");
          const vendor = String(prod.vendor || "");
          const productType = String(prod.product_type || "");
          const currentPrice = String(variants[0]?.price || "0");
          const currentCompareAt = String(variants[0]?.compare_at_price || "");
          const storeNiche = project.storeNiche || "comics y cultura pop";
  
          const tagsArr = currentTags.split(",").filter(t => t.trim());
          const imgCount = images.length;
          const bodyLen = currentDesc.length;
          const hasCompare = !!currentCompareAt;
          let optScore = 0;
          if (imgCount >= 3) optScore += 25; else if (imgCount >= 1) optScore += 10;
          if (bodyLen >= 1000) optScore += 25; else if (bodyLen >= 500) optScore += 15; else if (bodyLen >= 200) optScore += 8;
          if (tagsArr.length >= 10) optScore += 25; else if (tagsArr.length >= 5) optScore += 15;
          if (hasCompare) optScore += 25;
          const optGrade = optScore >= 85 ? "A" : optScore >= 60 ? "B" : optScore >= 40 ? "C" : "D";
  
          result = {
            status: "optimizing",
            productId,
            currentTitle,
            products: [{
              title: currentTitle,
              status: String(prod.status || "active"),
              price: currentPrice,
              compareAtPrice: currentCompareAt || null,
              imageCount: imgCount,
              imageUrl: images[0]?.src || null,
              variantCount: variants.length,
              descriptionLength: bodyLen,
              tagsCount: tagsArr.length,
              published: !!prod.published_at,
              auditScore: optScore,
              auditGrade: optGrade,
              hasComparePrice: hasCompare,
            }],
            message: `⏳ Optimización 10/10 iniciada para "${currentTitle}".\n\nEl ShopyBrain Dual AI (Gemini + Claude) está generando:\n📝 Descripción 400+ palabras\n🏷 22+ tags SEO\n🔍 Meta title + description\n🎯 Variantes inteligentes\n💰 Análisis de precios\n\nTarda ~90s. El producto se actualizará automáticamente en Shopify.`,
          };
  
          (async () => {
            try {
  
          const [priceResearch, _] = await Promise.all([
            researchRealPricing(currentTitle, productType, storeNiche, currentPrice),
            Promise.resolve(null),
          ]);
  
          const priceContextBlock = priceResearch.competitorPrices.length > 0
            ? `\n\nDATOS REALES DE MERCADO (investigados via Google Search):
  Rango de mercado: ${priceResearch.marketPriceRange.min}€ - ${priceResearch.marketPriceRange.max}€ (mediana: ${priceResearch.marketPriceRange.median}€)
  Precio actual del producto: ${currentPrice}€
  ${currentCompareAt ? `Precio de comparación actual: ${currentCompareAt}€` : ""}
  Competidores encontrados:
  ${priceResearch.competitorPrices.slice(0, 8).map(c => `• ${c.source}: ${c.price}€${c.url ? ` (${c.url})` : ""}`).join("\n")}
  Fuentes: ${priceResearch.sources.slice(0, 5).join(", ")}
  Estrategia sugerida: ${priceResearch.pricingStrategy}`
            : "";
  
          const existingOptions = (prod.options as Array<Record<string, unknown>>) || [];
          const hasRealVariants = variants.length > 1 || (existingOptions.length > 0 && existingOptions.some((o: Record<string, unknown>) => o.name !== "Title" && (o.values as string[] || []).length > 1));
  
          const variantsBlock = hasRealVariants
            ? `\n- Variantes actuales: ${variants.length} (${existingOptions.map((o: Record<string, unknown>) => `${o.name}: ${(o.values as string[] || []).join(", ")}`).join("; ")})\n  → Las variantes ya existen, NO generes nuevas options/variants en tu respuesta.`
            : `\n- Variantes: SOLO 1 variante por defecto (SIN opciones reales)\n  → DEBES generar variantes inteligentes según el tipo de producto (ver reglas abajo).`;
  
          const optimizePrompt = `Eres el mejor copywriter, experto SEO, estratega de pricing y Product Manager de Shopify del mundo. Optimiza este producto a CALIDAD 10/10.
  
  PRODUCTO ACTUAL:
  - Título: "${currentTitle}"
  - Descripción HTML actual: "${currentDesc.slice(0, 500)}"
  - Vendor: "${vendor}"
  - Tipo: "${productType}"
  - Tags actuales: "${currentTags}"
  - Precio actual: ${currentPrice}€
  ${currentCompareAt ? `- Precio de comparación: ${currentCompareAt}€` : ""}
  - Imágenes: ${images.length} fotos${variantsBlock}
  - Nicho de la tienda: ${storeNiche}
  - Tono de marca: ${project.brandTone || "profesional y apasionado"}
  ${priceContextBlock}
  
  GENERA UN JSON COMPLETO con TODOS estos campos:
  {
    "title": "Título optimizado SEO (40-70 chars, incluye keywords relevantes)",
    "bodyHtml": "Descripción HTML COMPLETA y profesional. Mínimo 400 palabras. Incluye: <h2> subtítulos, <ul><li> bullet points con beneficios, especificaciones técnicas, storytelling emocional sobre el producto, llamada a la acción. Usa <strong> para enfatizar. NO uses placeholder ni lorem ipsum. Contenido REAL basado en el producto.",
    "tags": ["tag1", "tag2", "...mínimo 22 tags..."],
    "seoTitle": "Meta title SEO optimizado (50-60 chars con keyword principal)",
    "seoDescription": "Meta description persuasiva (140-160 chars con CTA)",
    "altTexts": ["alt text descriptivo imagen 1", "alt text descriptivo imagen 2", "..."],
    "handle": "url-handle-optimizado-seo",
    "pricingSuggestion": {
      "suggestedPrice": XX.XX,
      "suggestedCompareAtPrice": XX.XX,
      "reasoning": "Por qué este precio basado en datos reales del mercado",
      "marketPosition": "budget|mid-range|premium|luxury",
      "competitorsAnalyzed": N
    },
    "options": [{"name":"NombreOpcion","values":["val1","val2",...]}],
    "variants": [{"optionValues":{"NombreOpcion":"val1"},"sku":"SKU-V1","price":XX.99,"compareAtPrice":XX.99,"inventoryQuantity":25,"weight":0.3,"weightUnit":"kg","costPerItem":XX.XX,"barcode":"8400000000001"}, ...],
    "inventoryPolicy": "deny"
  }
  
  REGLAS DE VARIANTES (OBLIGATORIO si el producto NO tiene variantes reales):
  Analiza el tipo de producto y genera TODAS las variantes que tendría una tienda profesional 10/10:
  - ROPA/MODA: Talla (XS-XXL) × Color (3-5 colores)
  - CALZADO: Número (36-45) × Color
  - JOYERÍA: Material (Plata 925, Oro 18k, Acero) × Medida
  - IMPRESIÓN 3D: Material (PLA, ABS, Resina, PETG, Nylon) × Color/Acabado (Mate, Brillante, Transparente)
  - COMICS/LIBROS: Formato (Digital, Tapa Blanda, Tapa Dura, Edición Limitada) × Idioma
  - ARTE/PRINTS: Tamaño (A4, A3, A2, A1) × Acabado (Mate, Brillante, Canvas, Enmarcado)
  - ELECTRÓNICA: Capacidad × Color
  - COSMÉTICA: Tamaño (30ml, 50ml, 100ml) × Tono
  - SERVICIOS DIGITALES: Plan (Básico, Pro, Enterprise) × Duración (1 mes, 3 meses, 12 meses)
  - PACK CONTENIDO: Cantidad (Pack 10, Pack 25, Pack 50, Pack 100) × Formato
  - DISEÑO/TATUAJES: Tamaño (Pequeño, Mediano, Grande) × Estilo (B&N, Color, Acuarela)
  - NFT/COLECCIONABLES: Rareza (Común, Raro, Épico, Legendario) × Edición
  - CUALQUIER OTRO: Detecta opciones lógicas y genera variantes coherentes.
  
  Cada variante: SKU único (PREFIJO-OPT), precio (premium +10-30% para opciones superiores), compare_at_price, inventoryQuantity (15-50, más stock en tallas populares M/L), weight, costPerItem, barcode (13 dígitos).
  Genera 6-30 variantes según tipo. inventoryPolicy: "deny" (productos físicos) o "continue" (digitales/servicios).
  
  Si el producto YA TIENE variantes reales, NO incluyas options ni variants en tu respuesta.
  
  REGLAS CRÍTICAS:
  - TODO el contenido debe ser REAL, específico para este producto exacto
  - La descripción debe contar una historia, no solo listar características
  - Tags: mínimo 22, cubrir categoría, material, estilo, público, uso, colección, tendencia, long-tail keywords
  - Alt texts deben describir lo que se VE en cada imagen, no genéricos
  - PRICING: Usa los datos REALES del mercado para sugerir un precio COMPETITIVO y RENTABLE
  - Responde SOLO el JSON, sin texto adicional`;
  
          const { dualAIJson } = await import("../../lib/dual-ai.js");
          const dualResult = await dualAIJson<{
            title: string;
            bodyHtml: string;
            tags: string[];
            seoTitle: string;
            seoDescription: string;
            altTexts?: string[];
            handle?: string;
            options?: Array<{ name: string; values: string[] }>;
            variants?: Array<Record<string, unknown>>;
            inventoryPolicy?: string;
            pricingSuggestion?: {
              suggestedPrice?: number;
              suggestedCompareAtPrice?: number;
              reasoning?: string;
              marketPosition?: string;
              competitorsAnalyzed?: number;
            };
          }>(parseInt(projectId), optimizePrompt, {
            mode: "parallel_synthesis",
            claudeSystemPrompt: CLAUDE_EXPERT_SYSTEM,
            useCase: "seo",
            niche: project.storeNiche || undefined,
            maxTokens: 16000,
          });
          const optimized = dualResult.data;
  
          const shopifyUpdate: Record<string, unknown> = { id: parseInt(productId) };
          if (optimized.title) shopifyUpdate.title = optimized.title;
          if (optimized.bodyHtml) shopifyUpdate.body_html = optimized.bodyHtml;
          if (optimized.tags && Array.isArray(optimized.tags)) shopifyUpdate.tags = optimized.tags.join(", ");
          if (optimized.handle) shopifyUpdate.handle = optimized.handle;
  
          if (optimized.seoTitle) shopifyUpdate.metafields_global_title_tag = optimized.seoTitle;
          if (optimized.seoDescription) shopifyUpdate.metafields_global_description_tag = optimized.seoDescription;
  
          if (optimized.altTexts && images.length > 0) {
            shopifyUpdate.images = images.map((img, i) => ({
              id: img.id,
              alt: optimized.altTexts?.[i] || String(img.alt || ""),
            }));
          }
  
          const priceSuggestion = optimized.pricingSuggestion;
          let priceUpdateMsg = "";
          let variantsMsg = "";
  
          if (!hasRealVariants && optimized.options && optimized.options.length > 0 && optimized.variants && optimized.variants.length > 0) {
            shopifyUpdate.options = optimized.options.map((o, i) => ({
              name: o.name,
              position: i + 1,
              values: o.values,
            }));
  
            shopifyUpdate.variants = optimized.variants.map((v: Record<string, unknown>) => {
              const optVals = (v.optionValues || {}) as Record<string, string>;
              const variant: Record<string, unknown> = {
                price: String(v.price || currentPrice),
                compare_at_price: v.compareAtPrice ? String(v.compareAtPrice) : currentCompareAt || null,
                sku: v.sku || null,
                inventory_management: "shopify",
                inventory_quantity: v.inventoryQuantity ?? 25,
                inventory_policy: optimized.inventoryPolicy || "deny",
                weight: v.weight || null,
                weight_unit: v.weightUnit || "kg",
                cost: v.costPerItem ? String(v.costPerItem) : null,
                barcode: v.barcode || null,
                requires_shipping: optimized.inventoryPolicy !== "continue",
                taxable: true,
              };
              const optNames = optimized.options!.map(o => o.name);
              optNames.forEach((name, idx) => {
                variant[`option${idx + 1}`] = optVals[name] || "";
              });
              return variant;
            });
  
            variantsMsg = `\n🎯 ${optimized.variants.length} variantes creadas (${optimized.options.map(o => `${o.name}: ${o.values.length}`).join(", ")})`;
          } else if (priceSuggestion?.suggestedPrice && priceSuggestion.suggestedPrice > 0) {
            const newPrice = priceSuggestion.suggestedPrice.toFixed(2);
            const newCompareAt = priceSuggestion.suggestedCompareAtPrice
              ? priceSuggestion.suggestedCompareAtPrice.toFixed(2)
              : null;
  
            if (variants.length > 0 && variants[0]?.id) {
              shopifyUpdate.variants = [{
                id: variants[0].id,
                price: newPrice,
                ...(newCompareAt ? { compare_at_price: newCompareAt } : {}),
              }];
              priceUpdateMsg = `\n💰 Precio: ${currentPrice}€ → ${newPrice}€${newCompareAt ? ` (antes ${newCompareAt}€)` : ""}`;
              priceUpdateMsg += `\n📊 ${priceSuggestion.reasoning || "Basado en análisis de mercado"}`;
              priceUpdateMsg += `\n🏪 Posición: ${priceSuggestion.marketPosition || "competitivo"}`;
              if (priceResearch.competitorPrices.length > 0) {
                priceUpdateMsg += ` (${priceResearch.competitorPrices.length} competidores analizados)`;
              }
            }
          }
  
          const updated = await shopifyRequest<{ product: Record<string, unknown> }>(
            parseInt(projectId), project.shopDomain, `/products/${productId}.json`,
            { method: "PUT", body: JSON.stringify({ product: shopifyUpdate }) }
          );
  
          const updatedVariants = (updated.product.variants as Array<Record<string, unknown>>) || [];
          const updatedOptions = (updated.product.options as Array<Record<string, unknown>>) || [];
  
          learnFromOperation({
            operationType: "product_optimization",
            niche: storeNiche,
            productType: productType || null,
            title: `Optimización 10/10: ${updated.product.title}`,
            content: JSON.stringify({
              previousTitle: currentTitle,
              newTitle: updated.product.title,
              tagsCount: optimized.tags?.length || 0,
              seoTitle: optimized.seoTitle,
              seoDescription: optimized.seoDescription,
              descLength: String(optimized.bodyHtml || "").length,
              priceBefore: currentPrice,
              priceAfter: priceSuggestion?.suggestedPrice || currentPrice,
              marketRange: priceResearch.marketPriceRange,
              competitorsFound: priceResearch.competitorPrices.length,
              variantsCreated: !hasRealVariants ? (optimized.variants?.length || 0) : 0,
              optionsCreated: !hasRealVariants ? (optimized.options?.map(o => `${o.name}(${o.values.length})`) || []) : [],
              totalVariantsNow: updatedVariants.length,
              handle: optimized.handle,
              altTextsCount: optimized.altTexts?.length || 0,
              imagesCount: images.length,
              qualityScore: "10/10",
            }),
            confidence: 0.95,
            tags: ["optimization", "seo", "ai_content", "pricing", "variants", "10_10_quality"],
          });
  
          learnFromOperation({
            operationType: "variant_strategy",
            niche: storeNiche,
            productType: productType || null,
            title: `Estrategia variantes: ${productType || currentTitle}`,
            content: `Producto "${updated.product.title}" (${productType}). ${!hasRealVariants && optimized.options ? `Opciones generadas: ${optimized.options.map(o => `${o.name}=[${o.values.join(",")}]`).join("; ")}. ${optimized.variants?.length || 0} variantes con SKUs, precios diferenciados, stock e inventario.` : `Ya tenía ${updatedVariants.length} variantes (${updatedOptions.map((o: Record<string, unknown>) => o.name).join(", ")}). No se modificaron.`} Inventario: ${optimized.inventoryPolicy || "deny"}. Nicho: ${storeNiche}.`,
            confidence: 0.9,
            tags: ["variants", "product_strategy", productType || "general"],
          });
  
          result = {
            productId: updated.product.id,
            title: updated.product.title,
            previousTitle: currentTitle,
            tagsCount: optimized.tags?.length || 0,
            descriptionLength: String(optimized.bodyHtml || "").length,
            seoTitle: optimized.seoTitle,
            altTextsGenerated: optimized.altTexts?.length || 0,
            variantsCreated: !hasRealVariants ? (optimized.variants?.length || 0) : 0,
            totalVariants: updatedVariants.length,
            options: updatedOptions.map((o: Record<string, unknown>) => ({ name: o.name, values: o.values })),
            pricingSuggestion: priceSuggestion,
            marketData: {
              priceRange: priceResearch.marketPriceRange,
              competitorsFound: priceResearch.competitorPrices.length,
              sources: priceResearch.sources.slice(0, 5),
            },
            message: `✅ Producto "${updated.product.title}" optimizado 10/10.\n📝 Descripción: ${String(optimized.bodyHtml || "").length} chars\n🏷 ${optimized.tags?.length || 0} tags SEO\n🔍 Meta title + description SEO\n🖼 ${optimized.altTexts?.length || 0} alt texts${variantsMsg}${priceUpdateMsg}`,
          };
          logger.info({ productId, title: updated.product.title, variantsCreated: !hasRealVariants ? (optimized.variants?.length || 0) : 0 }, "✅ optimize_product background completed");
            } catch (bgErr: unknown) {
              logger.error({ productId, error: (bgErr as Error).message }, "❌ optimize_product background failed");
            }
          })();
          break;
        }

        case "optimize_all_products": {
          const projectId = params?.projectId;
          if (!projectId) { res.status(400).json({ error: "projectId requerido" }); return; }
          const [project] = await db.select().from(projectsTable).where(eq(projectsTable.id, parseInt(projectId)));
          if (!project) { res.status(404).json({ error: "Proyecto no encontrado" }); return; }
  
          let allProds: Array<Record<string, unknown>> = [];
          for (const st of ["active", "draft"]) {
            const d = await shopifyRequest<{ products: Array<Record<string, unknown>> }>(
              parseInt(projectId), project.shopDomain, `/products.json?limit=250&status=${st}&published_status=any&fields=id,title,variants,status`
            );
            allProds = allProds.concat(d.products || []);
          }
  
          const skipAlreadyOptimized = params?.skipOptimized !== false;
          const optimizeLimit = Math.min(params?.limit ?? 50, 100);
          let toOptimize = allProds;
          if (skipAlreadyOptimized) {
            toOptimize = allProds.filter((p) => {
              const vs = (p.variants as Array<Record<string, unknown>>) || [];
              return vs.length <= 1;
            });
          }
          toOptimize = toOptimize.slice(0, optimizeLimit);
  
          result = {
            status: "batch_started",
            totalProducts: allProds.length,
            toOptimize: toOptimize.length,
            skipped: allProds.length - toOptimize.length,
            products: toOptimize.map((p) => ({ id: p.id, title: p.title })),
            message: `⏳ Optimización masiva 10/10 iniciada para ${toOptimize.length} productos (${allProds.length - toOptimize.length} ya optimizados).\n\nCada producto tarda ~90s (Dual AI: Gemini + Claude).\nTiempo estimado: ~${Math.ceil(toOptimize.length * 1.5)} minutos.\n\nProgreso visible en los logs del servidor.`,
          };
  
          (async () => {
            try {
            const batchResults: Array<{ id: unknown; title: string; status: string }> = [];
            const batchErrors: string[] = [];
            for (let i = 0; i < toOptimize.length; i++) {
              const prod = toOptimize[i];
              try {
                logger.info({ i: i + 1, total: toOptimize.length, productId: prod.id, title: prod.title }, "🔄 Batch optimize starting product");
  
                const pData = await shopifyRequest<{ product: Record<string, unknown> }>(
                  parseInt(projectId), project.shopDomain, `/products/${prod.id}.json`
                );
                const fullProd = pData.product;
                const pImages = (fullProd.images as Array<Record<string, unknown>>) || [];
                const pVariants = (fullProd.variants as Array<Record<string, unknown>>) || [];
                const pTitle = String(fullProd.title || "");
                const pDesc = String(fullProd.body_html || "");
                const pVendor = String(fullProd.vendor || "");
                const pType = String(fullProd.product_type || "");
                const pTags = String(fullProd.tags || "");
                const pPrice = String(pVariants[0]?.price || "0");
                const pCompareAt = String(pVariants[0]?.compare_at_price || "");
                const pNiche = project.storeNiche || "comics y cultura pop";
  
                const [pPriceResearch] = await Promise.all([
                  researchRealPricing(pTitle, pType, pNiche, pPrice),
                  Promise.resolve(null),
                ]);
  
                const pPriceContext = pPriceResearch.competitorPrices.length > 0
                  ? `\n\nDATOS REALES DE MERCADO:
  Rango: ${pPriceResearch.marketPriceRange.min}€ - ${pPriceResearch.marketPriceRange.max}€ (mediana: ${pPriceResearch.marketPriceRange.median}€)
  Competidores: ${pPriceResearch.competitorPrices.map((c: { source: string; price: string; url?: string }) => `${c.source}: ${c.price}€`).join(", ")}
  Recomendación: ${pPriceResearch.suggestedPrice}€`
                  : "";
  
                const hasRealVars = pVariants.length > 1 || (pVariants.length === 1 && String(pVariants[0].title || "Default Title") !== "Default Title");
  
                let variantInstructions = "";
                if (!hasRealVars) {
                  variantInstructions = `\n\n🎯 VARIANTES INTELIGENTES:
  El producto NO tiene variantes. Genera opciones+variantes según tipo:
  - Ropa → Talla (XS,S,M,L,XL,XXL) × Color
  - Impresión 3D → Material (PLA,ABS,Resina) × Acabado
  - Arte/Prints → Tamaño (A4,A3,A2,A1) × Material
  - Servicios → Plan (Básico,Pro,Premium) × Duración
  - NFT/Digital → Edición (Standard,Limited,Collector) × Formato
  Genera "options" y "variants" con precios diferenciados.`;
                }
  
                const batchPrompt = `Optimiza este producto Shopify al MÁXIMO nivel profesional 10/10.
  
  PRODUCTO:
  - Título actual: "${pTitle}"
  - Descripción actual: "${pDesc.slice(0, 500)}"
  - Vendor: "${pVendor}"
  - Tipo: "${pType}"
  - Tags: "${pTags}"
  - Precio: ${pPrice}€ ${pCompareAt ? `(antes: ${pCompareAt}€)` : ""}
  - Imágenes: ${pImages.length}
  - Variantes actuales: ${pVariants.length}
  - Nicho: ${pNiche}${pPriceContext}${variantInstructions}
  
  JSON RESPUESTA (SOLO JSON):
  {
    "title": "título SEO optimizado 40-70 chars",
    "bodyHtml": "<div>HTML profesional mínimo 400 palabras con <h2>, <ul><li>, <strong>, storytelling, beneficios, specs, CTA. Contenido REAL para ESTE producto.</div>",
    "tags": ["22+ tags SEO relevantes"],
    "seoTitle": "meta title 50-60 chars",
    "seoDescription": "meta description 140-160 chars con keywords y CTA",
    "altTexts": ["alt text SEO para cada imagen"],
    "handle": "url-seo-friendly-handle",
    "suggestedPrice": "precio sugerido basado en mercado"${!hasRealVars ? `,
    "options": [{"name":"NombreOpcion","values":["val1","val2","val3"]}],
    "variants": [{"option1":"val1","option2":"val2","price":"X.XX","sku":"SKU-001","inventory_policy":"continue"}]` : ""}
  }`;
  
                const { dualAIJson: batchDualAIJson } = await import("../../lib/dual-ai.js");
                const batchDualResult = await batchDualAIJson<{
                  title: string; bodyHtml: string; tags: string[];
                  seoTitle: string; seoDescription: string; altTexts?: string[];
                  handle?: string; suggestedPrice?: string;
                  options?: Array<{ name: string; values: string[] }>;
                  variants?: Array<Record<string, unknown>>;
                }>(parseInt(projectId), batchPrompt, {
                  mode: "parallel_synthesis",
                  claudeSystemPrompt: CLAUDE_EXPERT_SYSTEM,
                  useCase: "seo",
                  niche: pNiche,
                  maxTokens: 16000,
                });
                const batchOptimized = batchDualResult.data;
  
                const batchUpdate: Record<string, unknown> = { id: fullProd.id };
                if (batchOptimized.title) batchUpdate.title = batchOptimized.title;
                if (batchOptimized.bodyHtml) batchUpdate.body_html = batchOptimized.bodyHtml;
                if (batchOptimized.tags) batchUpdate.tags = batchOptimized.tags.join(", ");
                if (batchOptimized.handle) batchUpdate.handle = batchOptimized.handle;
                if (batchOptimized.seoTitle) batchUpdate.metafields_global_title_tag = batchOptimized.seoTitle;
                if (batchOptimized.seoDescription) batchUpdate.metafields_global_description_tag = batchOptimized.seoDescription;
                if (batchOptimized.altTexts && pImages.length > 0) {
                  batchUpdate.images = pImages.map((img, idx) => ({
                    id: img.id, alt: batchOptimized.altTexts?.[idx] || String(img.alt || ""),
                  }));
                }
                if (!hasRealVars && batchOptimized.options && batchOptimized.variants) {
                  batchUpdate.options = batchOptimized.options;
                  batchUpdate.variants = batchOptimized.variants;
                }
  
                await shopifyRequest(
                  parseInt(projectId), project.shopDomain, `/products/${fullProd.id}.json`,
                  { method: "PUT", body: JSON.stringify({ product: batchUpdate }) }
                );
  
                await saveToVault({
                  projectId: parseInt(projectId),
                  title: `Shopy Crafter: optimize_product — ${new Date().toLocaleDateString("es-ES")}`,
                  content: JSON.stringify({ productId: fullProd.id, optimized: batchOptimized }),
                  fileType: "brain_action",
                  description: `✅ Producto "${batchOptimized.title || pTitle}" optimizado 10/10.\n📝 Descripción: ${String(batchOptimized.bodyHtml || "").length} chars\n🏷 ${batchOptimized.tags?.length || 0} tags SEO\n🔍 Meta title + description SEO\n🖼 ${batchOptimized.altTexts?.length || 0} alt texts\n🎯 ${!hasRealVars ? (batchOptimized.variants?.length || 0) : 0} variantes creadas`,
                  category: "optimization",
                });
  
                learnFromOperation({
                  operationType: "optimization",
                  title: pTitle,
                  content: `Optimización 10/10: ${batchOptimized.tags?.length || 0} tags, ${String(batchOptimized.bodyHtml || "").length} chars desc, ${!hasRealVars ? (batchOptimized.variants?.length || 0) : 0} variantes`,
                  niche: pNiche,
                  productType: pType,
                });
  
                batchResults.push({ id: fullProd.id, title: batchOptimized.title || pTitle, status: "optimized" });
                logger.info({ i: i + 1, total: toOptimize.length, productId: fullProd.id, title: batchOptimized.title || pTitle, variants: !hasRealVars ? (batchOptimized.variants?.length || 0) : "kept" }, "✅ Batch optimize product completed");
              } catch (e) {
                const errMsg = e instanceof Error ? e.message : String(e);
                batchErrors.push(`${prod.title}: ${errMsg}`);
                logger.error({ productId: prod.id, title: prod.title, error: errMsg }, "❌ Batch optimize product failed");
              }
            }
            logger.info({ optimized: batchResults.length, failed: batchErrors.length, total: toOptimize.length }, "🏁 Batch optimization complete");
            } catch (outerErr: unknown) {
              logger.error({ error: (outerErr as Error).message }, "❌ Batch optimization IIFE crashed");
            }
          })();
  
          break;
        }

        case "create_collection": {
          const projectId = params?.projectId;
          if (!projectId) { res.status(400).json({ error: "projectId requerido" }); return; }
          const [project] = await db.select().from(projectsTable).where(eq(projectsTable.id, parseInt(projectId)));
          if (!project) { res.status(404).json({ error: "Proyecto no encontrado" }); return; }
  
          const title = params?.title;
          if (!title) { res.status(400).json({ error: "title requerido para la colección" }); return; }
  
          // ── CONFIRMATION GATE ──
          if (!params?.confirmed) {
            result = {
              success: false,
              requiresConfirmation: true,
              targetLabel: `colección "${title}"`,
              message: `⚠️ ¿Crear la colección **"${title}"** (${params?.type || "custom"}) en la tienda? Envía con \`confirmed: true\` para proceder.`,
            };
            break;
          }
  
          const collectionType = params?.type || "custom";
          let bodyHtml = params?.bodyHtml || "";
          let seoTitle = params?.seoTitle || "";
          let seoDescription = params?.seoDescription || "";
  
          if (params?.aiGenerate !== false) {
            try {
              const aiContent = await askClaudeJsonWithBrain<{
                bodyHtml: string; seoTitle: string; seoDescription: string; sortOrder: string;
              }>(parseInt(projectId), `Genera contenido profesional para una colección Shopify.
  Nombre: "${title}"
  Nicho: ${project.storeNiche || "general"}
  Tono: ${project.brandTone || "profesional"}
  
  JSON: {"bodyHtml":"HTML descriptiva profesional de la colección, mín 150 palabras, con <h2>, <p>, <ul><li> explicando qué encontrará el cliente, storytelling de marca, por qué esta colección es especial","seoTitle":"meta title 50-60 chars","seoDescription":"meta description 140-160 chars con CTA","sortOrder":"best-selling"}
  
  SOLO JSON, contenido REAL.`, CLAUDE_EXPERT_SYSTEM, "seo", project.storeNiche || undefined, 4096);
  
              bodyHtml = aiContent.bodyHtml || bodyHtml;
              seoTitle = aiContent.seoTitle || seoTitle;
              seoDescription = aiContent.seoDescription || seoDescription;
            } catch { /* use provided content */ }
          }
  
          if (collectionType === "smart") {
            const rules = params?.rules || [{ column: "tag", relation: "equals", condition: title.toLowerCase() }];
            const smartCollection = {
              title,
              body_html: bodyHtml,
              published: params?.published !== false,
              rules,
              disjunctive: params?.disjunctive || false,
              sort_order: params?.sortOrder || "best-selling",
            };
  
            const created = await shopifyRequest<{ smart_collection: Record<string, unknown> }>(
              parseInt(projectId), project.shopDomain, "/smart_collections.json",
              { method: "POST", body: JSON.stringify({ smart_collection: smartCollection }) }
            );
  
            result = {
              collectionId: created.smart_collection.id,
              title: created.smart_collection.title,
              type: "smart",
              rules,
              message: `✅ Colección inteligente "${title}" creada. Los productos se añaden automáticamente según las reglas.`,
            };
          } else {
            const customCollection: Record<string, unknown> = {
              title,
              body_html: bodyHtml,
              published: params?.published !== false,
              sort_order: params?.sortOrder || "best-selling",
            };
  
            const created = await shopifyRequest<{ custom_collection: Record<string, unknown> }>(
              parseInt(projectId), project.shopDomain, "/custom_collections.json",
              { method: "POST", body: JSON.stringify({ custom_collection: customCollection }) }
            );
  
            const collectionId = created.custom_collection.id;
  
            if (params?.productIds && Array.isArray(params.productIds)) {
              for (const pid of params.productIds) {
                try {
                  await shopifyRequest(
                    parseInt(projectId), project.shopDomain, "/collects.json",
                    { method: "POST", body: JSON.stringify({ collect: { collection_id: collectionId, product_id: parseInt(pid) } }) }
                  );
                } catch { /* skip failed product assignment */ }
              }
            }
  
            result = {
              collectionId,
              title: created.custom_collection.title,
              type: "custom",
              productsAdded: params?.productIds?.length || 0,
              message: `✅ Colección "${title}" creada${params?.productIds?.length ? ` con ${params.productIds.length} productos asignados` : ""}. Descripción y SEO generados por IA.`,
            };
          }
          break;
        }

        case "list_collections": {
          const projectId = params?.projectId;
          if (!projectId) { res.status(400).json({ error: "projectId requerido" }); return; }
          const [project] = await db.select().from(projectsTable).where(eq(projectsTable.id, parseInt(projectId)));
          if (!project) { res.status(404).json({ error: "Proyecto no encontrado" }); return; }
  
          const limit = Math.min(params?.limit ?? 20, 50);
  
          const [customData, smartData] = await Promise.all([
            shopifyRequest<{ custom_collections: Array<Record<string, unknown>> }>(
              parseInt(projectId), project.shopDomain, `/custom_collections.json?limit=${limit}`
            ),
            shopifyRequest<{ smart_collections: Array<Record<string, unknown>> }>(
              parseInt(projectId), project.shopDomain, `/smart_collections.json?limit=${limit}`
            ),
          ]);
  
          const allCollections: any[] = [
            ...((customData as any).custom_collections || []).map((c: any) => ({ ...c, type: "custom" })),
            ...((smartData as any).smart_collections || []).map((c: any) => ({ ...c, type: "smart" })),
          ];
  
          result = {
            collections: allCollections.map((c: any) => ({
              id: c.id, title: c.title, type: c.type,
              handle: c.handle, published: c.published_at != null,
              productsCount: c.products_count || 0,
              bodyLength: String(c.body_html || "").length,
            })),
            total: allCollections.length,
            message: `${allCollections.length} colecciones encontradas (${(customData as any).custom_collections?.length || 0} manuales + ${(smartData as any).smart_collections?.length || 0} inteligentes)`,
          };
          break;
        }

        case "add_to_collection": {
          const projectId = params?.projectId;
          if (!projectId) { res.status(400).json({ error: "projectId requerido" }); return; }
          const [project] = await db.select().from(projectsTable).where(eq(projectsTable.id, parseInt(projectId)));
          if (!project) { res.status(404).json({ error: "Proyecto no encontrado" }); return; }
          const collectionId = params?.collectionId;
          const productIds = params?.productIds;
          if (!collectionId || !productIds || !Array.isArray(productIds)) {
            res.status(400).json({ error: "collectionId y productIds[] requeridos" }); return;
          }
          const added: number[] = [];
          const failed: number[] = [];
          for (const pid of productIds) {
            try {
              await shopifyRequest(
                parseInt(projectId), project.shopDomain, "/collects.json",
                { method: "POST", body: JSON.stringify({ collect: { collection_id: parseInt(collectionId), product_id: parseInt(pid) } }) }
              );
              added.push(parseInt(pid));
            } catch { failed.push(parseInt(pid)); }
          }
          result = {
            collectionId: parseInt(collectionId),
            added: added.length,
            failed: failed.length,
            failedIds: failed,
            message: `✅ ${added.length} productos añadidos a la colección. ${failed.length > 0 ? `${failed.length} fallaron (posiblemente ya asignados).` : ""}`,
          };
          break;
        }

        case "edit_collection": {
          const projectId = params?.projectId;
          if (!projectId) { res.status(400).json({ error: "projectId requerido" }); return; }
          const [project] = await db.select().from(projectsTable).where(eq(projectsTable.id, parseInt(projectId)));
          if (!project) { res.status(404).json({ error: "Proyecto no encontrado" }); return; }
          const collectionId = params?.collectionId;
          const collectionType = params?.collectionType || "custom";
          if (!collectionId) { result = { error: true, message: "❌ Falta collectionId" }; break; }
          try {
            const updates: Record<string, unknown> = {};
            if (params?.title) updates.title = params.title;
            if (params?.bodyHtml) updates.body_html = params.bodyHtml;
            if (params?.sortOrder) updates.sort_order = params.sortOrder;
            if (params?.published !== undefined) updates.published = params.published;
            if (params?.seoTitle || params?.seoDescription) {
              updates.metafields_global_title_tag = params.seoTitle || undefined;
              updates.metafields_global_description_tag = params.seoDescription || undefined;
            }
            if (params?.image) updates.image = { src: params.image };
            if (Object.keys(updates).length === 0) { result = { error: true, message: "❌ No se proporcionaron campos para editar" }; break; }
  
            const endpoint = collectionType === "smart"
              ? `/smart_collections/${collectionId}.json`
              : `/custom_collections/${collectionId}.json`;
            const bodyKey = collectionType === "smart" ? "smart_collection" : "custom_collection";
  
            const updated = await shopifyRequest<Record<string, Record<string, unknown>>>(
              parseInt(projectId), project.shopDomain, endpoint,
              { method: "PUT", body: JSON.stringify({ [bodyKey]: updates }) }
            );
            const col = updated[bodyKey] || {};
            result = {
              collectionId: col.id, title: col.title, type: collectionType,
              message: `✅ Colección "${col.title}" actualizada — campos modificados: ${Object.keys(updates).join(", ")}`,
            };
          } catch (err) { result = { error: true, message: `❌ Error: ${err instanceof Error ? err.message : String(err)}` }; }
          break;
        }

        case "delete_collection": {
          const projectId = params?.projectId;
          if (!projectId) { res.status(400).json({ error: "projectId requerido" }); return; }
          const [project] = await db.select().from(projectsTable).where(eq(projectsTable.id, parseInt(projectId)));
          if (!project) { res.status(404).json({ error: "Proyecto no encontrado" }); return; }
          const collectionId = params?.collectionId;
          const collectionType = params?.collectionType || "custom";
          if (!collectionId) { result = { error: true, message: "❌ Falta collectionId" }; break; }
          try {
            const endpoint = collectionType === "smart"
              ? `/smart_collections/${collectionId}.json`
              : `/custom_collections/${collectionId}.json`;
            await shopifyRequest(parseInt(projectId), project.shopDomain, endpoint, { method: "DELETE" });
            result = { message: `🗑️ Colección ${collectionId} eliminada correctamente` };
          } catch (err) { result = { error: true, message: `❌ Error: ${err instanceof Error ? err.message : String(err)}` }; }
          break;
        }

        case "get_collection_products": {
          const projectId = params?.projectId;
          if (!projectId) { res.status(400).json({ error: "projectId requerido" }); return; }
          const [project] = await db.select().from(projectsTable).where(eq(projectsTable.id, parseInt(projectId)));
          if (!project) { res.status(404).json({ error: "Proyecto no encontrado" }); return; }
          const collectionId = params?.collectionId;
          if (!collectionId) { result = { error: true, message: "❌ Falta collectionId" }; break; }
          try {
            const limit = Math.min(params?.limit ?? 50, 250);
            const data = await shopifyRequest<{ products: Array<Record<string, unknown>> }>(
              parseInt(projectId), project.shopDomain,
              `/collections/${collectionId}/products.json?limit=${limit}&fields=id,title,status,product_type,vendor,tags,variants,images`
            );
            const products = data.products || [];
            const summary = products.map((p: Record<string, unknown>) => {
              const variants = p.variants as Array<Record<string, unknown>> | undefined;
              const totalStock = variants?.reduce((sum: number, v: Record<string, unknown>) => sum + (Number(v.inventory_quantity) || 0), 0) || 0;
              const imgs = p.images as Array<Record<string, unknown>> | undefined;
              return `• **${p.title}** (ID: ${p.id}) — ${p.status}, stock total: ${totalStock}, variantes: ${variants?.length || 0}, imágenes: ${imgs?.length || 0}`;
            }).join("\n");
            result = {
              collectionId: parseInt(String(collectionId)),
              products: products.map((p: Record<string, unknown>) => ({
                id: p.id, title: p.title, status: p.status,
                productType: p.product_type, vendor: p.vendor,
                variants: (p.variants as Array<Record<string, unknown>> | undefined)?.map((v: Record<string, unknown>) => ({
                  id: v.id, title: v.title, price: v.price,
                  inventoryQuantity: v.inventory_quantity, sku: v.sku,
                })),
                imageCount: (p.images as unknown[] | undefined)?.length || 0,
              })),
              total: products.length,
              message: `📦 **${products.length} productos en colección ${collectionId}**\n\n${summary || "(vacía)"}`,
            };
          } catch (err) { result = { error: true, message: `❌ Error: ${err instanceof Error ? err.message : String(err)}` }; }
          break;
        }

        case "list_variants": {
          const projectId = params?.projectId;
          const productId = params?.productId;
          if (!projectId || !productId) { result = { error: true, message: "❌ Falta projectId o productId" }; break; }
          try {
            const [project] = await db.select().from(projectsTable).where(eq(projectsTable.id, parseInt(String(projectId))));
            if (!project) { result = { error: true, message: "❌ Proyecto no encontrado" }; break; }
            const data = await shopifyRequest<{ product: Record<string, unknown> }>(
              parseInt(String(projectId)), project.shopDomain,
              `/products/${productId}.json?fields=id,title,variants,options`
            );
            const product = data.product;
            const variants = product.variants as Array<Record<string, unknown>> | undefined;
            const options = product.options as Array<Record<string, unknown>> | undefined;
            const summary = variants?.map((v: Record<string, unknown>) =>
              `• ${v.title} — Precio: ${v.price}€, Compare: ${v.compare_at_price || "—"}, Stock: ${v.inventory_quantity}, SKU: ${v.sku || "—"}, Barcode: ${v.barcode || "—"}`
            ).join("\n") || "(sin variantes)";
            const optionsSummary = options?.map((o: Record<string, unknown>) =>
              `  ${o.name}: ${(o.values as string[])?.join(", ")}`
            ).join("\n") || "";
            result = {
              productId, productTitle: product.title,
              options: options?.map((o: Record<string, unknown>) => ({ name: o.name, values: o.values })),
              variants: variants?.map((v: Record<string, unknown>) => ({
                id: v.id, title: v.title, price: v.price, compareAtPrice: v.compare_at_price,
                inventoryQuantity: v.inventory_quantity, sku: v.sku, barcode: v.barcode,
                inventoryItemId: v.inventory_item_id, option1: v.option1, option2: v.option2, option3: v.option3,
              })),
              totalVariants: variants?.length || 0,
              totalStock: variants?.reduce((s: number, v: Record<string, unknown>) => s + (Number(v.inventory_quantity) || 0), 0) || 0,
              message: `📊 **${product.title}** — ${variants?.length || 0} variantes\n\nOpciones:\n${optionsSummary}\n\nVariantes:\n${summary}`,
            };
          } catch (err) { result = { error: true, message: `❌ Error: ${err instanceof Error ? err.message : String(err)}` }; }
          break;
        }

        case "update_stock": {
          const projectId = params?.projectId;
          const productId = params?.productId;
          const variantId = params?.variantId;
          const quantity = params?.quantity;
          if (!projectId) { result = { error: true, message: "❌ Falta projectId" }; break; }
          if (quantity === undefined || quantity === null) { result = { error: true, message: "❌ Falta quantity (stock a establecer)" }; break; }
          try {
            const [project] = await db.select().from(projectsTable).where(eq(projectsTable.id, parseInt(String(projectId))));
            if (!project) { result = { error: true, message: "❌ Proyecto no encontrado" }; break; }
            const token = safeDecrypt(project.accessToken);
            const domain = project.shopDomain;
  
            let targetVariants: Array<{ variantId: string | number; inventoryItemId: string | number; title: string }> = [];
  
            if (variantId) {
              const vData = await shopifyRequest<{ variant: Record<string, unknown> }>(
                parseInt(String(projectId)), domain, `/variants/${variantId}.json?fields=id,title,inventory_item_id`
              );
              targetVariants = [{ variantId: vData.variant.id as number, inventoryItemId: vData.variant.inventory_item_id as number, title: String(vData.variant.title) }];
            } else if (productId) {
              const pData = await shopifyRequest<{ product: Record<string, unknown> }>(
                parseInt(String(projectId)), domain, `/products/${productId}.json?fields=variants`
              );
              const variants = pData.product.variants as Array<Record<string, unknown>>;
              targetVariants = variants.map(v => ({
                variantId: v.id as number, inventoryItemId: v.inventory_item_id as number, title: String(v.title),
              }));
            } else {
              result = { error: true, message: "❌ Falta productId o variantId para identificar qué stock actualizar" }; break;
            }
  
            const locationsResp = await fetch(`https://${domain}/admin/api/${SHOPIFY_API_VERSION}/locations.json`, {
              headers: { "X-Shopify-Access-Token": token, "Content-Type": "application/json" },
            });
            const locationsData = await locationsResp.json() as { locations: Array<{ id: number; name: string }> };
            const locationId = locationsData.locations?.[0]?.id;
            if (!locationId) { result = { error: true, message: "❌ No se encontró ubicación (location) en Shopify" }; break; }
  
            const updated: string[] = [];
            for (const tv of targetVariants) {
              const levelResp = await fetch(`https://${domain}/admin/api/${SHOPIFY_API_VERSION}/inventory_levels/set.json`, {
                method: "POST",
                headers: { "X-Shopify-Access-Token": token, "Content-Type": "application/json" },
                body: JSON.stringify({
                  location_id: locationId,
                  inventory_item_id: tv.inventoryItemId,
                  available: parseInt(String(quantity)),
                }),
              });
              if (levelResp.ok) {
                updated.push(`✅ ${tv.title}: stock → ${quantity}`);
              } else {
                const err = await levelResp.json().catch(() => ({})) as Record<string, unknown>;
                updated.push(`❌ ${tv.title}: ${err.errors || "error"}`);
              }
            }
            result = {
              updated: updated.length,
              locationId,
              message: `📦 **Stock actualizado**\n\n${updated.join("\n")}\n\n📍 Ubicación: ${locationsData.locations?.[0]?.name || locationId}`,
            };
          } catch (err) { result = { error: true, message: `❌ Error: ${err instanceof Error ? err.message : String(err)}` }; }
          break;
        }

        case "bulk_update_stock": {
          const projectId = params?.projectId;
          if (!projectId) { result = { error: true, message: "❌ Falta projectId" }; break; }
          const items = params?.items as Array<{ variantId?: string; productId?: string; quantity: number }> | undefined;
          if (!items || !Array.isArray(items) || items.length === 0) {
            result = { error: true, message: "❌ Falta items — array de {variantId o productId, quantity}" }; break;
          }
          try {
            const [project] = await db.select().from(projectsTable).where(eq(projectsTable.id, parseInt(String(projectId))));
            if (!project) { result = { error: true, message: "❌ Proyecto no encontrado" }; break; }
            const token = safeDecrypt(project.accessToken);
            const domain = project.shopDomain;
  
            const locationsResp = await fetch(`https://${domain}/admin/api/${SHOPIFY_API_VERSION}/locations.json`, {
              headers: { "X-Shopify-Access-Token": token, "Content-Type": "application/json" },
            });
            const locationsData = await locationsResp.json() as { locations: Array<{ id: number }> };
            const locationId = locationsData.locations?.[0]?.id;
            if (!locationId) { result = { error: true, message: "❌ No se encontró ubicación" }; break; }
  
            let successCount = 0;
            let failCount = 0;
            const details: string[] = [];
            for (const item of items) {
              try {
                let inventoryItemId: number | null = null;
                let label = "";
                if (item.variantId) {
                  const vData = await shopifyRequest<{ variant: Record<string, unknown> }>(
                    parseInt(String(projectId)), domain, `/variants/${item.variantId}.json?fields=id,title,inventory_item_id`
                  );
                  inventoryItemId = vData.variant.inventory_item_id as number;
                  label = String(vData.variant.title);
                } else if (item.productId) {
                  const pData = await shopifyRequest<{ product: Record<string, unknown> }>(
                    parseInt(String(projectId)), domain, `/products/${item.productId}.json?fields=title,variants`
                  );
                  const firstVariant = (pData.product.variants as Array<Record<string, unknown>>)?.[0];
                  inventoryItemId = firstVariant?.inventory_item_id as number;
                  label = String(pData.product.title);
                }
                if (!inventoryItemId) { failCount++; details.push(`❌ ${label || item.variantId || item.productId}: sin inventory_item_id`); continue; }
                const resp = await fetch(`https://${domain}/admin/api/${SHOPIFY_API_VERSION}/inventory_levels/set.json`, {
                  method: "POST",
                  headers: { "X-Shopify-Access-Token": token, "Content-Type": "application/json" },
                  body: JSON.stringify({ location_id: locationId, inventory_item_id: inventoryItemId, available: item.quantity }),
                });
                if (resp.ok) { successCount++; details.push(`✅ ${label}: stock → ${item.quantity}`); }
                else { failCount++; details.push(`❌ ${label}: error`); }
              } catch { failCount++; details.push(`❌ Item: error`); }
            }
            result = {
              success: successCount, failed: failCount,
              message: `📦 **Stock actualizado en lote**: ${successCount} exitosos, ${failCount} fallidos\n\n${details.join("\n")}`,
            };
          } catch (err) { result = { error: true, message: `❌ Error: ${err instanceof Error ? err.message : String(err)}` }; }
          break;
        }

        case "update_product_price": {
          const projectId = params?.projectId;
          if (!projectId) { result = { error: true, message: "❌ Falta projectId" }; break; }
          const price = params?.price;
          if (!price) { result = { error: true, message: "❌ Falta price" }; break; }
          try {
            const [project] = await db.select().from(projectsTable).where(eq(projectsTable.id, parseInt(String(projectId))));
            if (!project) { result = { error: true, message: "❌ Proyecto no encontrado" }; break; }
            const variantId = params?.variantId;
            const productIdParam = params?.productId;
            const compareAtPrice = params?.compareAtPrice;
  
            if (variantId) {
              const body: Record<string, unknown> = { price: String(price) };
              if (compareAtPrice) body.compare_at_price = String(compareAtPrice);
              const data = await shopifyRequest<{ variant: Record<string, unknown> }>(
                parseInt(String(projectId)), project.shopDomain,
                `/variants/${variantId}.json`,
                { method: "PUT", body: JSON.stringify({ variant: body }) }
              );
              result = {
                message: `💰 **Precio actualizado**\n\n- Variante: ${data.variant.title}\n- Nuevo precio: €${data.variant.price}${compareAtPrice ? `\n- Precio anterior (tachado): €${compareAtPrice}` : ""}\n\n✅ Cambio aplicado en Shopify`,
              };
            } else if (productIdParam) {
              const pData = await shopifyRequest<{ product: Record<string, unknown> }>(
                parseInt(String(projectId)), project.shopDomain,
                `/products/${productIdParam}.json?fields=title,variants`
              );
              const variants = pData.product.variants as Array<Record<string, unknown>> || [];
              const updated: string[] = [];
              for (const v of variants) {
                const body: Record<string, unknown> = { price: String(price) };
                if (compareAtPrice) body.compare_at_price = String(compareAtPrice);
                await shopifyRequest(
                  parseInt(String(projectId)), project.shopDomain,
                  `/variants/${v.id}.json`,
                  { method: "PUT", body: JSON.stringify({ variant: body }) }
                );
                updated.push(`✅ ${v.title}: €${price}`);
              }
              result = {
                message: `💰 **Precio actualizado** para "${pData.product.title}"\n\n${updated.join("\n")}\n\n✅ ${updated.length} variantes actualizadas`,
              };
            } else {
              result = { error: true, message: "❌ Necesito productId o variantId para saber qué producto actualizar" };
            }
          } catch (err) { result = { error: true, message: `❌ Error: ${err instanceof Error ? err.message : String(err)}` }; }
          break;
        }

        case "bulk_update_prices": {
          const projectId = params?.projectId;
          if (!projectId) { result = { error: true, message: "❌ Falta projectId" }; break; }
          const items = params?.items as Array<{ productId?: string; variantId?: string; title?: string; name?: string; price: string; compareAtPrice?: string }> | undefined;
          if (!items || !Array.isArray(items) || items.length === 0) {
            result = { error: true, message: "❌ Falta items — array de {productId o variantId o title, price, compareAtPrice?}" }; break;
          }
          try {
            const [project] = await db.select().from(projectsTable).where(eq(projectsTable.id, parseInt(String(projectId))));
            if (!project) { result = { error: true, message: "❌ Proyecto no encontrado" }; break; }
  
            let allProducts: Array<Record<string, unknown>> | null = null;
            const needsNameLookup = items.some(i => !i.productId && !i.variantId && (i.title || i.name));
            if (needsNameLookup) {
              const catalog = await shopifyRequest<{ products: Array<Record<string, unknown>> }>(
                parseInt(String(projectId)), project.shopDomain, "/products.json?limit=250&fields=id,title,variants"
              );
              allProducts = catalog.products || [];
            }
  
            let successCount = 0;
            let failCount = 0;
            const details: string[] = [];
            for (const item of items) {
              try {
                let vid = item.variantId;
                let label = vid || item.title || item.name || "";
  
                if (!vid && !item.productId && (item.title || item.name)) {
                  const cleanTitle = (item.title || item.name || "").trim();
                  if (cleanTitle.length < 3) { failCount++; details.push(`❌ "${cleanTitle}": nombre demasiado corto (mín 3 chars)`); continue; }
                  const searchName = cleanTitle.toLowerCase();
                  const exactMatch = allProducts?.find(p => String(p.title || "").toLowerCase() === searchName);
                  const partialMatches = exactMatch ? [] : (allProducts || []).filter(p => {
                    const pTitle = String(p.title || "").toLowerCase();
                    return pTitle.includes(searchName) || searchName.includes(pTitle);
                  });
                  const matched = exactMatch || (partialMatches.length === 1 ? partialMatches[0] : null);
                  if (!matched && partialMatches.length > 1) {
                    failCount++;
                    const candidates = partialMatches.slice(0, 3).map(p => String(p.title)).join(", ");
                    details.push(`❌ "${cleanTitle}": ambiguo (${partialMatches.length} coincidencias: ${candidates})`);
                    continue;
                  }
                  if (matched) {
                    const firstV = (matched.variants as Array<Record<string, unknown>>)?.[0];
                    vid = String(firstV?.id || "");
                    label = String(matched.title);
                  } else {
                    failCount++;
                    details.push(`❌ "${cleanTitle}": producto no encontrado en Shopify`);
                    continue;
                  }
                } else if (!vid && item.productId) {
                  const pData = await shopifyRequest<{ product: Record<string, unknown> }>(
                    parseInt(String(projectId)), project.shopDomain,
                    `/products/${item.productId}.json?fields=title,variants`
                  );
                  const firstV = (pData.product.variants as Array<Record<string, unknown>>)?.[0];
                  vid = String(firstV?.id || "");
                  label = String(pData.product.title);
                }
                if (!vid) { failCount++; details.push(`❌ ${label}: sin variante`); continue; }
                const body: Record<string, unknown> = { price: String(item.price) };
                if (item.compareAtPrice) body.compare_at_price = String(item.compareAtPrice);
                const data = await shopifyRequest<{ variant: Record<string, unknown> }>(
                  parseInt(String(projectId)), project.shopDomain,
                  `/variants/${vid}.json`,
                  { method: "PUT", body: JSON.stringify({ variant: body }) }
                );
                successCount++;
                details.push(`✅ ${data.variant.title || label}: €${item.price}`);
              } catch { failCount++; details.push(`❌ ${item.variantId || item.productId || item.title || item.name}: error`); }
            }
            result = {
              success: successCount, failed: failCount,
              message: `💰 **Precios actualizados en lote**: ${successCount} exitosos, ${failCount} fallidos\n\n${details.join("\n")}`,
            };
          } catch (err) { result = { error: true, message: `❌ Error: ${err instanceof Error ? err.message : String(err)}` }; }
          break;
        }

        case "list_products_with_prices": {
          const projectId = params?.projectId;
          if (!projectId) { result = { error: true, message: "❌ Falta projectId" }; break; }
          try {
            const [project] = await db.select().from(projectsTable).where(eq(projectsTable.id, parseInt(String(projectId))));
            if (!project) { result = { error: true, message: "❌ Proyecto no encontrado" }; break; }
            const data = await shopifyRequest<{ products: Array<Record<string, unknown>> }>(
              parseInt(String(projectId)), project.shopDomain, "/products.json?limit=250"
            );
            const products = data.products || [];
            const filter = params?.filter as string || "all";
  
            const categorized: Record<string, Array<{ title: string; price: string; compareAt: string; variantId: string; sku: string }>> = {
              subscriptions: [], services: [], creative: [], credits: []
            };
  
            for (const p of products) {
              const title = String(p.title || "");
              const variants = p.variants as Array<Record<string, unknown>> || [];
              const v = variants[0] || {};
              const entry = {
                title: title.substring(0, 70),
                price: String(v.price || "?"),
                compareAt: String(v.compare_at_price || ""),
                variantId: String(v.id || ""),
                sku: String(v.sku || ""),
              };
              const t = title.toLowerCase();
              if (["starter", "pro —", "agency pro", "growth studio", "performance lab", "enterprise"].some(k => t.includes(k))) {
                categorized.subscriptions.push(entry);
              } else if (["pack ilustr", "pack narr", "pack creador", "pack director", "pack estudio", "pack 4000"].some(k => t.includes(k))) {
                categorized.credits.push(entry);
              } else if (["auditoría", "informe", "photoshoot", "pack 20", "pack 30 prod", "pack 15", "pack 10", "pack 5", "pack catálogo", "creación prod", "rediseño", "pack 30 imág", "seo shopify", "setup email", "sesión estrat", "pack 30 post", "campañas"].some(k => t.includes(k))) {
                categorized.services.push(entry);
              } else {
                categorized.creative.push(entry);
              }
            }
  
            const sections: string[] = [];
            const formatList = (items: typeof categorized.subscriptions) =>
              items.map(i => `  €${i.price.padStart(7)} ${i.compareAt && i.compareAt !== "null" ? `(antes €${i.compareAt})` : "".padEnd(15)} | ${i.title}`).join("\n");
  
            if (filter === "all" || filter === "subscriptions") {
              sections.push(`📋 **PLANES SUSCRIPCIÓN (${categorized.subscriptions.length})**\n${formatList(categorized.subscriptions)}`);
            }
            if (filter === "all" || filter === "services") {
              sections.push(`🔧 **SERVICIOS ONE-SHOT (${categorized.services.length})**\n${formatList(categorized.services)}`);
            }
            if (filter === "all" || filter === "credits") {
              sections.push(`🎨 **CRÉDITOS IA (${categorized.credits.length})**\n${formatList(categorized.credits)}`);
            }
            if (filter === "all" || filter === "creative") {
              sections.push(`🎭 **PRODUCTOS CREATIVOS (${categorized.creative.length})**\n${formatList(categorized.creative)}`);
            }
  
            result = {
              total: products.length,
              message: `💰 **${products.length} productos en Shopify** (filtro: ${filter})\n\n${sections.join("\n\n")}`,
            };
          } catch (err) { result = { error: true, message: `❌ Error: ${err instanceof Error ? err.message : String(err)}` }; }
          break;
        }

        case "price_audit": {
          const projectId = params?.projectId;
          if (!projectId) { result = { error: true, message: "❌ Falta projectId" }; break; }
          try {
            const [project] = await db.select().from(projectsTable).where(eq(projectsTable.id, parseInt(String(projectId))));
            if (!project) { result = { error: true, message: "❌ Proyecto no encontrado" }; break; }
            const data = await shopifyRequest<{ products: Array<Record<string, unknown>> }>(
              parseInt(String(projectId)), project.shopDomain, "/products.json?limit=250"
            );
  
            const catalogPrices: Record<string, { price: number; name: string }> = {
              "shopy crafter starter": { price: 0, name: "Starter Free" },
              "shopy crafter pro": { price: 29, name: "Emprendedor" },
              "shopy crafter agency pro": { price: 149, name: "Agency Pro → Growth" },
              "growth studio": { price: 149, name: "Growth Studio" },
              "performance lab": { price: 397, name: "Performance Lab" },
              "shopy crafter enterprise": { price: 997, name: "Enterprise" },
              "auditoría seo shopify": { price: 97, name: "Auditoría SEO N1" },
              "auditoría shopify completa": { price: 97, name: "Auditoría 360° N1" },
              "informe competidores": { price: 97, name: "Informe Competidores N1" },
              "informe pricing": { price: 97, name: "Informe Pricing N1" },
              "informe proyección": { price: 97, name: "Informe Proyección N1" },
              "investigación de proveedores": { price: 97, name: "Investigación Proveedores N1" },
              "shopy crafter photoshoot": { price: 297, name: "Photoshoot Pro" },
              "pack 20 productos": { price: 397, name: "Pack 20 Productos" },
              "pack 30 productos": { price: 597, name: "Pack 30 Productos" },
              "pack 15 productos": { price: 297, name: "Pack 15 Productos" },
              "pack catálogo profesional 10": { price: 197, name: "Pack 10 Productos" },
              "pack 5 productos": { price: 97, name: "Pack 5 Productos" },
              "creación producto shopify unitario": { price: 29, name: "Producto Unitario" },
              "rediseño ia de 30": { price: 97, name: "Rediseño 30 Productos" },
              "pack 30 imágenes": { price: 49, name: "Pack 30 Imágenes" },
              "seo shopify experto": { price: 97, name: "SEO Experto" },
              "setup email marketing": { price: 147, name: "Setup Email" },
              "sesión estratégica": { price: 97, name: "Sesión Estratégica" },
              "pack 30 posts": { price: 49, name: "Pack 30 Posts" },
              "campañas virales": { price: 97, name: "Campañas Virales" },
            };
  
            const discrepancies: string[] = [];
            const correct: string[] = [];
            for (const p of data.products) {
              const title = String(p.title || "").toLowerCase();
              const v = (p.variants as Array<Record<string, unknown>>)?.[0];
              if (!v) continue;
              const currentPrice = parseFloat(String(v.price || "0"));
              for (const [key, catalog] of Object.entries(catalogPrices)) {
                if (title.includes(key)) {
                  if (Math.abs(currentPrice - catalog.price) > 0.5) {
                    discrepancies.push(`⚠️ **${catalog.name}**: €${currentPrice} → debería ser **€${catalog.price}** (VID:${v.id})`);
                  } else {
                    correct.push(`✅ ${catalog.name}: €${currentPrice}`);
                  }
                  break;
                }
              }
            }
  
            result = {
              total: data.products.length,
              discrepancies: discrepancies.length,
              correct: correct.length,
              message: discrepancies.length > 0
                ? `🔍 **Auditoría de precios**: ${discrepancies.length} discrepancias encontradas\n\n${discrepancies.join("\n")}\n\n${correct.length > 0 ? `\n✅ ${correct.length} productos con precios correctos` : ""}\n\n💡 Usa **sync_catalog_prices** para corregir automáticamente`
                : `✅ **Auditoría de precios perfecta**: todos los ${correct.length} productos del catálogo tienen precios correctos\n\n${correct.join("\n")}`,
            };
          } catch (err) { result = { error: true, message: `❌ Error: ${err instanceof Error ? err.message : String(err)}` }; }
          break;
        }

        case "sync_catalog_prices": {
          const projectId = params?.projectId;
          if (!projectId) { result = { error: true, message: "❌ Falta projectId" }; break; }
          // ── PROTECCIÓN: catálogo hardcoded de Shopy Crafter (no aplicar a tiendas de cliente) ──
          // dryRun por defecto ON salvo confirmación explícita
          const explicitWrite = params?.confirmed === true && (params?.dryRun === false || params?.dryRun === "false");
          const dryRun = !explicitWrite;
          if (!params?.confirmed) {
            result = {
              success: false,
              requiresConfirmation: true,
              warning: "⚠️ Esta acción usa el catálogo OFICIAL de Shopy Crafter. Sólo aplicar a la tienda matriz, NUNCA a tiendas de clientes.",
              message: "⚠️ ¿Sincronizar precios con el catálogo oficial Shopy Crafter? Por defecto se ejecuta en modo simulación. Para aplicar cambios reales envía `confirmed: true` y `dryRun: false`.",
            };
            break;
          }
          try {
            const [project] = await db.select().from(projectsTable).where(eq(projectsTable.id, parseInt(String(projectId))));
            if (!project) { result = { error: true, message: "❌ Proyecto no encontrado" }; break; }
            const data = await shopifyRequest<{ products: Array<Record<string, unknown>> }>(
              parseInt(String(projectId)), project.shopDomain, "/products.json?limit=250"
            );
  
            const catalogPrices: Record<string, { price: string; compareAt?: string }> = {
              "shopy crafter starter": { price: "0.00", compareAt: "34.99" },
              "shopy crafter pro": { price: "29.00" },
              "shopy crafter agency pro": { price: "149.00" },
              "growth studio": { price: "149.00", compareAt: "297.00" },
              "performance lab": { price: "397.00", compareAt: "797.00" },
              "shopy crafter enterprise": { price: "997.00", compareAt: "2497.00" },
              "auditoría seo shopify": { price: "97.00", compareAt: "197.00" },
              "auditoría shopify completa": { price: "97.00", compareAt: "197.00" },
              "informe competidores": { price: "97.00" },
              "informe pricing": { price: "97.00" },
              "informe proyección": { price: "97.00", compareAt: "127.00" },
              "investigación de proveedores": { price: "97.00" },
              "shopy crafter photoshoot": { price: "297.00", compareAt: "497.00" },
              "pack 20 productos": { price: "397.00", compareAt: "697.00" },
              "pack 30 productos": { price: "597.00", compareAt: "997.00" },
              "pack 15 productos": { price: "297.00", compareAt: "497.00" },
              "pack catálogo profesional 10": { price: "197.00", compareAt: "347.00" },
              "pack 5 productos": { price: "97.00", compareAt: "197.00" },
              "creación producto shopify unitario": { price: "29.00", compareAt: "47.00" },
              "rediseño ia de 30": { price: "97.00", compareAt: "147.00" },
              "pack 30 imágenes": { price: "49.00", compareAt: "89.00" },
              "seo shopify experto": { price: "97.00", compareAt: "147.00" },
              "setup email marketing": { price: "147.00", compareAt: "197.00" },
              "sesión estratégica": { price: "97.00", compareAt: "147.00" },
              "pack 30 posts": { price: "49.00", compareAt: "89.00" },
              "campañas virales": { price: "97.00", compareAt: "147.00" },
            };
  
            const changes: string[] = [];
            const noChange: string[] = [];
            let updatedCount = 0;
  
            for (const p of data.products) {
              const title = String(p.title || "");
              const titleLow = title.toLowerCase();
              const v = (p.variants as Array<Record<string, unknown>>)?.[0];
              if (!v) continue;
  
              for (const [key, catalog] of Object.entries(catalogPrices)) {
                if (titleLow.includes(key)) {
                  const currentPrice = String(v.price || "0");
                  if (Math.abs(parseFloat(currentPrice) - parseFloat(catalog.price)) > 0.5) {
                    if (!dryRun) {
                      const body: Record<string, unknown> = { price: catalog.price };
                      if (catalog.compareAt) body.compare_at_price = catalog.compareAt;
                      await shopifyRequest(
                        parseInt(String(projectId)), project.shopDomain,
                        `/variants/${v.id}.json`,
                        { method: "PUT", body: JSON.stringify({ variant: body }) }
                      );
                      updatedCount++;
                    }
                    changes.push(`${dryRun ? "🔄" : "✅"} ${title.substring(0, 50)}: €${currentPrice} → €${catalog.price}`);
                  } else {
                    noChange.push(`✅ ${title.substring(0, 50)}: €${currentPrice}`);
                  }
                  break;
                }
              }
            }
  
            result = {
              mode: dryRun ? "DRY RUN (simulación)" : "APLICADO",
              changes: changes.length,
              noChange: noChange.length,
              message: dryRun
                ? `🔍 **Simulación de sincronización** (sin cambios aplicados)\n\n${changes.length > 0 ? `**${changes.length} cambios pendientes:**\n${changes.join("\n")}` : "✅ Todos los precios ya están sincronizados"}\n\n${noChange.length > 0 ? `\n✅ ${noChange.length} precios correctos` : ""}\n\n💡 Para aplicar los cambios: "sincronizar precios" (sin dryRun)`
                : `✅ **Sincronización completada**: ${updatedCount} precios actualizados\n\n${changes.join("\n")}${noChange.length > 0 ? `\n\n✅ ${noChange.length} ya estaban correctos` : ""}`,
            };
          } catch (err) { result = { error: true, message: `❌ Error: ${err instanceof Error ? err.message : String(err)}` }; }
          break;
        }

        case "add_variant": {
          const projectId = params?.projectId;
          const productId = params?.productId;
          if (!projectId || !productId) { result = { error: true, message: "❌ Falta projectId o productId" }; break; }
          try {
            const [project] = await db.select().from(projectsTable).where(eq(projectsTable.id, parseInt(String(projectId))));
            if (!project) { result = { error: true, message: "❌ Proyecto no encontrado" }; break; }
            const variant: Record<string, unknown> = {};
            if (params?.option1) variant.option1 = params.option1;
            if (params?.option2) variant.option2 = params.option2;
            if (params?.option3) variant.option3 = params.option3;
            if (params?.price) variant.price = String(params.price);
            if (params?.compareAtPrice) variant.compare_at_price = String(params.compareAtPrice);
            if (params?.sku) variant.sku = params.sku;
            if (params?.barcode) variant.barcode = params.barcode;
            if (params?.weight) variant.weight = params.weight;
            if (params?.weightUnit) variant.weight_unit = params.weightUnit;
            variant.inventory_management = "shopify";
  
            const created = await shopifyRequest<{ variant: Record<string, unknown> }>(
              parseInt(String(projectId)), project.shopDomain, `/products/${productId}/variants.json`,
              { method: "POST", body: JSON.stringify({ variant }) }
            );
            const v = created.variant;
  
            if (params?.quantity !== undefined) {
              const token = safeDecrypt(project.accessToken);
              const locResp = await fetch(`https://${project.shopDomain}/admin/api/${SHOPIFY_API_VERSION}/locations.json`, {
                headers: { "X-Shopify-Access-Token": token, "Content-Type": "application/json" },
              });
              const locData = await locResp.json() as { locations: Array<{ id: number }> };
              const locId = locData.locations?.[0]?.id;
              if (locId && v.inventory_item_id) {
                await fetch(`https://${project.shopDomain}/admin/api/${SHOPIFY_API_VERSION}/inventory_levels/set.json`, {
                  method: "POST",
                  headers: { "X-Shopify-Access-Token": token, "Content-Type": "application/json" },
                  body: JSON.stringify({ location_id: locId, inventory_item_id: v.inventory_item_id, available: parseInt(String(params.quantity)) }),
                });
              }
            }
  
            result = {
              variantId: v.id, productId,
              title: v.title, price: v.price, sku: v.sku,
              inventoryQuantity: params?.quantity ?? v.inventory_quantity,
              message: `✅ **Variante creada**: ${v.title}\n💰 Precio: ${v.price}€\n📦 Stock: ${params?.quantity ?? v.inventory_quantity}\n🏷️ SKU: ${v.sku || "—"}`,
            };
          } catch (err) { result = { error: true, message: `❌ Error: ${err instanceof Error ? err.message : String(err)}` }; }
          break;
        }

        case "edit_variant": {
          const projectId = params?.projectId;
          const variantId = params?.variantId;
          if (!projectId || !variantId) { result = { error: true, message: "❌ Falta projectId o variantId" }; break; }
          try {
            const [project] = await db.select().from(projectsTable).where(eq(projectsTable.id, parseInt(String(projectId))));
            if (!project) { result = { error: true, message: "❌ Proyecto no encontrado" }; break; }
            const updates: Record<string, unknown> = {};
            if (params?.option1) updates.option1 = params.option1;
            if (params?.option2) updates.option2 = params.option2;
            if (params?.option3) updates.option3 = params.option3;
            if (params?.price) updates.price = String(params.price);
            if (params?.compareAtPrice) updates.compare_at_price = String(params.compareAtPrice);
            if (params?.sku) updates.sku = params.sku;
            if (params?.barcode) updates.barcode = params.barcode;
            if (params?.weight) updates.weight = params.weight;
            if (params?.weightUnit) updates.weight_unit = params.weightUnit;
  
            const updated = await shopifyRequest<{ variant: Record<string, unknown> }>(
              parseInt(String(projectId)), project.shopDomain, `/variants/${variantId}.json`,
              { method: "PUT", body: JSON.stringify({ variant: updates }) }
            );
            const v = updated.variant;
  
            if (params?.quantity !== undefined) {
              const token = safeDecrypt(project.accessToken);
              const locResp = await fetch(`https://${project.shopDomain}/admin/api/${SHOPIFY_API_VERSION}/locations.json`, {
                headers: { "X-Shopify-Access-Token": token, "Content-Type": "application/json" },
              });
              const locData = await locResp.json() as { locations: Array<{ id: number }> };
              const locId = locData.locations?.[0]?.id;
              if (locId && v.inventory_item_id) {
                await fetch(`https://${project.shopDomain}/admin/api/${SHOPIFY_API_VERSION}/inventory_levels/set.json`, {
                  method: "POST",
                  headers: { "X-Shopify-Access-Token": token, "Content-Type": "application/json" },
                  body: JSON.stringify({ location_id: locId, inventory_item_id: v.inventory_item_id, available: parseInt(String(params.quantity)) }),
                });
              }
            }
  
            result = {
              variantId: v.id, title: v.title, price: v.price,
              message: `✅ **Variante actualizada**: ${v.title}\n💰 Precio: ${v.price}€${params?.quantity !== undefined ? `\n📦 Stock: ${params.quantity}` : ""}\n🏷️ SKU: ${v.sku || "—"}`,
            };
          } catch (err) { result = { error: true, message: `❌ Error: ${err instanceof Error ? err.message : String(err)}` }; }
          break;
        }

        case "delete_variant": {
          const projectId = params?.projectId;
          const productId = params?.productId;
          const variantId = params?.variantId;
          if (!projectId || !productId || !variantId) { result = { error: true, message: "❌ Falta projectId, productId o variantId" }; break; }
          try {
            const [project] = await db.select().from(projectsTable).where(eq(projectsTable.id, parseInt(String(projectId))));
            if (!project) { result = { error: true, message: "❌ Proyecto no encontrado" }; break; }
            await shopifyRequest(
              parseInt(String(projectId)), project.shopDomain, `/products/${productId}/variants/${variantId}.json`,
              { method: "DELETE" }
            );
            result = { message: `🗑️ **Variante ${variantId} eliminada** del producto ${productId}` };
          } catch (err) { result = { error: true, message: `❌ Error: ${err instanceof Error ? err.message : String(err)}` }; }
          break;
        }

        case "auto_collections": {
          const projectId = params?.projectId;
          if (!projectId) { res.status(400).json({ error: "projectId requerido" }); return; }
          const [project] = await db.select().from(projectsTable).where(eq(projectsTable.id, parseInt(projectId)));
          if (!project) { res.status(404).json({ error: "Proyecto no encontrado" }); return; }
  
          let allProds: Array<Record<string, unknown>> = [];
          for (const st of ["active", "draft", "archived"]) {
            const d = await shopifyRequest<{ products: Array<Record<string, unknown>> }>(
              parseInt(projectId), project.shopDomain, `/products.json?limit=50&status=${st}&published_status=any&fields=id,title,product_type,vendor,tags`
            );
            allProds = allProds.concat(d.products || []);
          }
  
          const productSummary = allProds.map(p => ({
            id: p.id, title: p.title, type: p.product_type, vendor: p.vendor, tags: p.tags,
          }));
  
          const collectionsAi = await askClaudeJsonWithBrain<{
            collections: Array<{
              title: string; type: "smart" | "custom"; description: string;
              rules?: Array<{ column: string; relation: string; condition: string }>;
              productIds?: number[];
              sortOrder: string;
            }>;
          }>(parseInt(projectId), `Analiza estos ${allProds.length} productos y diseña las colecciones PERFECTAS para la tienda.
  
  PRODUCTOS:
  ${JSON.stringify(productSummary, null, 1)}
  
  Nicho: ${project.storeNiche || "general"}
  
  Crea colecciones que:
  1. Agrupen productos por categoría/tipo de forma lógica
  2. Incluyan colecciones temáticas atractivas para el comprador
  3. Tengan títulos SEO atractivos
  4. Usen smart collections cuando sea posible (basadas en tags o product_type)
  
  JSON: {"collections":[{"title":"Nombre","type":"smart o custom","description":"descripción HTML profesional","rules":[{"column":"tag","relation":"equals","condition":"valor"}],"productIds":[ids si es custom],"sortOrder":"best-selling"}]}`, CLAUDE_EXPERT_SYSTEM, "general", project.storeNiche || undefined, 6144);
  
          const created: Array<{ id: unknown; title: string; type: string }> = [];
          for (const col of collectionsAi.collections || []) {
            try {
              if (col.type === "smart" && col.rules) {
                const sc = await shopifyRequest<{ smart_collection: Record<string, unknown> }>(
                  parseInt(projectId), project.shopDomain, "/smart_collections.json",
                  { method: "POST", body: JSON.stringify({ smart_collection: { title: col.title, body_html: col.description, rules: col.rules, sort_order: col.sortOrder || "best-selling", published: true } }) }
                );
                created.push({ id: sc.smart_collection.id, title: String(sc.smart_collection.title), type: "smart" });
              } else {
                const cc = await shopifyRequest<{ custom_collection: Record<string, unknown> }>(
                  parseInt(projectId), project.shopDomain, "/custom_collections.json",
                  { method: "POST", body: JSON.stringify({ custom_collection: { title: col.title, body_html: col.description, sort_order: col.sortOrder || "best-selling", published: true } }) }
                );
                const ccId = cc.custom_collection.id;
                if (col.productIds) {
                  for (const pid of col.productIds) {
                    try {
                      await shopifyRequest(parseInt(projectId), project.shopDomain, "/collects.json",
                        { method: "POST", body: JSON.stringify({ collect: { collection_id: ccId, product_id: pid } }) });
                    } catch { /* skip */ }
                  }
                }
                created.push({ id: ccId, title: String(cc.custom_collection.title), type: "custom" });
              }
            } catch (e) {
              logger.warn({ collection: col.title, error: e instanceof Error ? e.message : String(e) }, "Failed to create collection");
            }
          }
  
          result = {
            collectionsCreated: created.length,
            collections: created,
            message: `✅ ${created.length} colecciones creadas automáticamente por IA basándose en tus ${allProds.length} productos.\n${created.map(c => `• ${c.title} (${c.type})`).join("\n")}`,
          };
          break;
        }

        case "create_page": {
          const projectId = params?.projectId;
          if (!projectId) { res.status(400).json({ error: "projectId requerido" }); return; }
          const [project] = await db.select().from(projectsTable).where(eq(projectsTable.id, parseInt(projectId)));
          if (!project) { res.status(404).json({ error: "Proyecto no encontrado" }); return; }
  
          const title = params?.title;
          const pageType = params?.pageType || "custom";
          if (!title && !pageType) { res.status(400).json({ error: "title o pageType requerido" }); return; }
  
          const pageTemplates: Record<string, string> = {
            about: "Sobre Nosotros / Quiénes Somos",
            contact: "Contacto",
            faq: "Preguntas Frecuentes (FAQ)",
            shipping: "Política de Envíos",
            returns: "Política de Devoluciones",
            privacy: "Política de Privacidad",
            terms: "Términos y Condiciones",
            size_guide: "Guía de Tallas",
          };
  
          const pageTitle = title || pageTemplates[pageType] || pageType;
  
          const pagePrompt = `Diseña la página "${pageTitle}" para una tienda Shopify PROFESIONAL.
  
  Tienda: ${project.name || "Tienda Online"}
  Nicho: ${project.storeNiche || "general"}
  Tono: ${project.brandTone || "profesional"}
  Dominio: ${project.shopDomain}
  Tipo de página: ${pageType}
  
  GENERA HTML COMPLETO y PROFESIONAL para esta página. Incluye:
  - Estructura con <h1>, <h2>, <h3> jerárquicos
  - Párrafos <p> con contenido REAL y específico para esta tienda
  - Listas <ul><li> donde corresponda
  - Formato con <strong>, <em> para énfasis
  - Si es FAQ, usa formato pregunta-respuesta claro
  - Si es Sobre Nosotros, cuenta la historia de la marca
  - Si es Envíos/Devoluciones/Privacidad, incluye políticas completas y profesionales
  - Contenido mínimo 500 palabras
  - TODO en español, profesional, listo para publicar
  - NO uses placeholders, lorem ipsum ni [insertar aquí]
  - Incluye CTAs relevantes
  
  Responde SOLO el HTML, sin envolver en \`\`\`html.`;
  
          const { dualAI } = await import("../../lib/dual-ai.js");
          const dualPage = await dualAI(parseInt(projectId), pagePrompt, {
            mode: "gemini_research_claude_redact",
            claudeSystemPrompt: CLAUDE_EXPERT_SYSTEM,
            geminiUseSearch: true,
            maxTokens: 16000,
            useCase: "ecommerce",
            niche: project.storeNiche || undefined,
          });
          const pageContent = dualPage.final;
  
          const handle = params?.handle || pageTitle.toLowerCase().replace(/[^a-z0-9áéíóúñü]+/gi, "-").replace(/^-|-$/g, "");
  
          const page = {
            title: pageTitle,
            body_html: pageContent,
            handle,
            published: params?.published !== false,
          };
  
          const created = await shopifyRequest<{ page: Record<string, unknown> }>(
            parseInt(projectId), project.shopDomain, "/pages.json",
            { method: "POST", body: JSON.stringify({ page }) }
          );
  
          result = {
            pageId: created.page.id,
            title: created.page.title,
            handle: created.page.handle,
            contentLength: String(pageContent).length,
            message: `✅ Página "${created.page.title}" creada y publicada en Shopify.\n📝 ${String(pageContent).length} caracteres de contenido profesional generado por IA.\n🔗 URL: /pages/${created.page.handle}`,
          };
          break;
        }

        case "update_page": {
          const projectId = params?.projectId;
          if (!projectId) { res.status(400).json({ error: "projectId requerido" }); return; }
          const pageId = params?.pageId;
          if (!pageId) { res.status(400).json({ error: "pageId requerido" }); return; }
          const [project] = await db.select().from(projectsTable).where(eq(projectsTable.id, parseInt(projectId)));
          if (!project) { res.status(404).json({ error: "Proyecto no encontrado" }); return; }
  
          const updateData: Record<string, unknown> = {};
          if (params?.title !== undefined) updateData.title = params.title;
          if (params?.bodyHtml !== undefined) updateData.body_html = params.bodyHtml;
          if (params?.handle !== undefined) updateData.handle = params.handle;
          if (params?.published !== undefined) updateData.published = params.published;
  
          const updated = await shopifyRequest<{ page: Record<string, unknown> }>(
            parseInt(projectId), project.shopDomain, `/pages/${pageId}.json`,
            { method: "PUT", body: JSON.stringify({ page: updateData }) }
          );
  
          result = {
            pageId: updated.page.id,
            title: updated.page.title,
            handle: updated.page.handle,
            published: updated.page.published_at != null,
            message: `✅ Página "${updated.page.title}" actualizada.\n📄 Publicada: ${updated.page.published_at != null ? 'Sí' : 'No'}\n🔗 URL: /pages/${updated.page.handle}`,
          };
          learnFromOperation({
            operationType: "page_update",
            title: `Page updated: ${updated.page.title}`,
            content: `Página "${updated.page.title}" (ID: ${pageId}) actualizada. Published: ${updated.page.published_at != null}. Handle: ${updated.page.handle}. Changes: ${Object.keys(updateData).join(", ")}`,
            confidence: 0.85,
            tags: ["page", "update", "shopify"],
          });
          break;
        }

        case "list_pages": {
          const projectId = params?.projectId;
          if (!projectId) { res.status(400).json({ error: "projectId requerido" }); return; }
          const [project] = await db.select().from(projectsTable).where(eq(projectsTable.id, parseInt(projectId)));
          if (!project) { res.status(404).json({ error: "Proyecto no encontrado" }); return; }
  
          const data = await shopifyRequest<{ pages: Array<Record<string, unknown>> }>(
            parseInt(projectId), project.shopDomain, "/pages.json?limit=50"
          );
  
          result = {
            pages: (data.pages || []).map(p => ({
              id: p.id, title: p.title, handle: p.handle,
              published: p.published_at != null,
              contentLength: String(p.body_html || "").length,
              createdAt: p.created_at,
            })),
            total: data.pages?.length || 0,
            message: `${data.pages?.length || 0} páginas en la tienda`,
          };
          break;
        }

        case "design_all_pages": {
          const projectId = params?.projectId;
          if (!projectId) { res.status(400).json({ error: "projectId requerido" }); return; }
          const [project] = await db.select().from(projectsTable).where(eq(projectsTable.id, parseInt(projectId)));
          if (!project) { res.status(404).json({ error: "Proyecto no encontrado" }); return; }
  
          const pageTypes = params?.pageTypes || ["about", "faq", "shipping", "returns", "contact"];
          const createdPages: Array<{ id: unknown; title: string; handle: string }> = [];
          const pageErrors: string[] = [];
  
          const pageTitles: Record<string, string> = {
            about: "Sobre Nosotros",
            contact: "Contacto",
            faq: "Preguntas Frecuentes",
            shipping: "Política de Envíos",
            returns: "Devoluciones y Reembolsos",
            privacy: "Política de Privacidad",
            terms: "Términos y Condiciones",
            size_guide: "Guía de Tallas",
          };
  
          for (const pageType of pageTypes) {
            try {
              const pageTitle = pageTitles[pageType] || pageType;
              const pageContent = await askClaudeWithBrain(
                parseInt(projectId),
                [{ role: "user", content: `Diseña la página "${pageTitle}" para la tienda Shopify "${project.name || "Tienda"}".
  Nicho: ${project.storeNiche || "general"}. Tono: ${project.brandTone || "profesional"}.
  Tipo: ${pageType}. Dominio: ${project.shopDomain}.
  
  HTML COMPLETO profesional, mín 400 palabras, con <h1>,<h2>,<h3>,<p>,<ul>,<li>,<strong>. Contenido REAL, NO placeholders. En español.
  ${pageType === "faq" ? "Incluye mínimo 10 preguntas frecuentes reales para este tipo de tienda." : ""}
  ${pageType === "about" ? "Cuenta una historia de marca inspiradora y profesional." : ""}
  ${pageType === "shipping" ? "Incluye zonas de envío, tiempos, costes y seguimiento." : ""}
  ${pageType === "returns" ? "Incluye plazos, condiciones, proceso paso a paso." : ""}
  ${pageType === "contact" ? "Incluye formulario HTML, email, horarios de atención." : ""}
  SOLO HTML.` }],
                CLAUDE_EXPERT_SYSTEM, "general", project.storeNiche || undefined, 6144
              );
  
              const handle = pageType.replace(/_/g, "-");
              const created = await shopifyRequest<{ page: Record<string, unknown> }>(
                parseInt(projectId), project.shopDomain, "/pages.json",
                { method: "POST", body: JSON.stringify({ page: { title: pageTitle, body_html: pageContent, handle, published: true } }) }
              );
              createdPages.push({ id: created.page.id, title: String(created.page.title), handle: String(created.page.handle) });
            } catch (e) {
              pageErrors.push(`${pageType}: ${e instanceof Error ? e.message : String(e)}`);
            }
          }
  
          result = {
            pagesCreated: createdPages.length,
            pages: createdPages,
            errors: pageErrors.length > 0 ? pageErrors : undefined,
            message: `✅ ${createdPages.length} páginas diseñadas y publicadas por IA:\n${createdPages.map(p => `• ${p.title} → /pages/${p.handle}`).join("\n")}${pageErrors.length > 0 ? `\n⚠️ ${pageErrors.length} errores` : ""}`,
          };
          break;
        }

        case "optimize_images": {
          const projectId = params?.projectId;
          if (!projectId) { res.status(400).json({ error: "projectId requerido" }); return; }
          const [project] = await db.select().from(projectsTable).where(eq(projectsTable.id, parseInt(projectId)));
          if (!project) { res.status(404).json({ error: "Proyecto no encontrado" }); return; }
  
          const productId = params?.productId;
          let productsToOptimize: Array<Record<string, unknown>> = [];
  
          if (productId) {
            const d = await shopifyRequest<{ product: Record<string, unknown> }>(
              parseInt(projectId), project.shopDomain, `/products/${productId}.json?fields=id,title,images,product_type,vendor`
            );
            productsToOptimize = [d.product];
          } else {
            for (const st of ["active", "draft", "archived"]) {
              const d = await shopifyRequest<{ products: Array<Record<string, unknown>> }>(
                parseInt(projectId), project.shopDomain, `/products.json?limit=50&status=${st}&published_status=any&fields=id,title,images,product_type,vendor`
              );
              productsToOptimize = productsToOptimize.concat(d.products || []);
            }
          }
  
          let totalImages = 0;
          let optimizedImages = 0;
          const prodResults: Array<{ id: unknown; title: string; imagesOptimized: number }> = [];
  
          for (const prod of productsToOptimize) {
            const images = (prod.images as Array<Record<string, unknown>>) || [];
            if (images.length === 0) continue;
  
            const missingAlt = images.filter(img => !img.alt || String(img.alt).trim() === "");
            if (missingAlt.length === 0) {
              totalImages += images.length;
              continue;
            }
  
            try {
              const { dualAIJson: dualImgJson } = await import("../../lib/dual-ai.js");
              const imgDual = await dualImgJson<{ alts: string[] }>(
                parseInt(projectId),
                `Genera alt texts SEO profesionales para las ${images.length} imágenes de este producto Shopify.
  
  Producto: "${prod.title}"
  Tipo: "${prod.product_type || "general"}"
  Marca: "${prod.vendor || ""}"
  
  Genera un alt text descriptivo y SEO para cada imagen. Los alt texts deben:
  - Describir lo que probablemente muestra la imagen del producto
  - Incluir el nombre del producto y keywords relevantes
  - Ser específicos (no genéricos como "imagen del producto")
  - Tener 80-125 caracteres cada uno
  - Estar en español
  
  JSON: {"alts":["alt text imagen 1","alt text imagen 2",...]}
  Genera exactamente ${images.length} alt texts.`,
                { claudeSystemPrompt: CLAUDE_EXPERT_SYSTEM, useCase: "images", niche: project.storeNiche || undefined, maxTokens: 16000 }
              );
              const altTexts = imgDual.data;
  
              if (altTexts.alts && altTexts.alts.length > 0) {
                const imageUpdates = images.map((img, i) => ({
                  id: img.id,
                  alt: altTexts.alts[i] || String(img.alt || `${prod.title} - imagen ${i + 1}`),
                }));
  
                await shopifyRequest(
                  parseInt(projectId), project.shopDomain, `/products/${prod.id}.json`,
                  { method: "PUT", body: JSON.stringify({ product: { id: prod.id, images: imageUpdates } }) }
                );
  
                optimizedImages += altTexts.alts.length;
                prodResults.push({ id: prod.id, title: String(prod.title), imagesOptimized: altTexts.alts.length });
              }
            } catch (e) {
              logger.warn({ productId: prod.id, error: e instanceof Error ? e.message : String(e) }, "Image alt optimization failed");
            }
  
            totalImages += images.length;
          }
  
          result = {
            productsProcessed: productsToOptimize.length,
            totalImages,
            optimizedImages,
            products: prodResults,
            message: `✅ Optimización de imágenes completada.\n🖼 ${optimizedImages} alt texts generados para ${prodResults.length} productos.\n📊 Total imágenes procesadas: ${totalImages}`,
          };
          break;
        }

        case "redesign_product": {
          const projectId = params?.projectId;
          const productId = params?.productId;
          if (!projectId || !productId) { result = { error: true, message: "❌ Falta projectId o productId" }; break; }
          try {
            const baseUrl = `http://localhost:${process.env.PORT || 8080}`;
            const resp = await fetch(`${baseUrl}/api/projects/${projectId}/products/${productId}/redesign`, {
              method: "POST", headers: { "Content-Type": "application/json", cookie: req.headers.cookie ?? "" },
              body: JSON.stringify({ parts: params?.parts }),
            });
            const data = await resp.json() as Record<string, unknown>;
            const rdTags = typeof data.tags === "string" ? data.tags.split(",").filter((t: string) => t.trim()) : [];
            const rdDescLen = typeof data.description === "string" ? (data.description as string).length : 0;
            result = {
              ...data,
              products: [{
                title: String(data.title ?? "(generado)"),
                status: "active",
                price: String(data.price ?? "0"),
                compareAtPrice: data.compare_at_price ? String(data.compare_at_price) : null,
                imageCount: Array.isArray(data.photo_brief) ? (data.photo_brief as unknown[]).length : 0,
                imageUrl: null,
                variantCount: 1,
                descriptionLength: rdDescLen,
                tagsCount: rdTags.length,
                published: true,
                auditScore: rdDescLen >= 500 && rdTags.length >= 10 ? 75 : 50,
                auditGrade: rdDescLen >= 500 && rdTags.length >= 10 ? "B" : "C",
                hasComparePrice: !!data.compare_at_price,
              }],
              message: `✅ **Rediseño 100/100 completado**\n\n📝 Nuevo título: ${data.title ?? "(generado)"}\n📊 Precio sugerido: €${data.price ?? "-"}\n🏷️ Tags: ${rdTags.length} tags\n📸 ${Array.isArray(data.photo_brief) ? (data.photo_brief as unknown[]).length : 0} photo briefs\n\n💡 Usa **apply_redesign** para aplicar estos cambios en Shopify.`,
            };
          } catch (err) { result = { error: true, message: `❌ Error en rediseño: ${err instanceof Error ? err.message : String(err)}` }; }
          break;
        }

        case "apply_redesign": {
          const projectId = params?.projectId;
          const productId = params?.productId;
          if (!projectId || !productId) { result = { error: true, message: "❌ Falta projectId o productId" }; break; }
          try {
            const baseUrl = `http://localhost:${process.env.PORT || 8080}`;
            const fields = params?.fields || ["title", "description", "tags", "meta"];
            const resp = await fetch(`${baseUrl}/api/projects/${projectId}/products/${productId}/apply-redesign`, {
              method: "POST", headers: { "Content-Type": "application/json", cookie: req.headers.cookie ?? "" },
              body: JSON.stringify({ fields }),
            });
            const data = await resp.json() as Record<string, unknown>;
            if (!resp.ok) { result = { error: true, message: `❌ ${data.error ?? "Error aplicando rediseño"}` }; break; }
            result = { ...data, message: `✅ **Rediseño aplicado en Shopify**\n\nCampos actualizados: ${(fields as string[]).join(", ")}` };
          } catch (err) { result = { error: true, message: `❌ Error aplicando rediseño: ${err instanceof Error ? err.message : String(err)}` }; }
          break;
        }

        case "bulk_redesign": {
          const projectId = params?.projectId;
          if (!projectId) { result = { error: true, message: "❌ Falta projectId" }; break; }
          try {
            const baseUrl = `http://localhost:${process.env.PORT || 8080}`;
            const mode = params?.mode || "all";
            const resp = await fetch(`${baseUrl}/api/projects/${projectId}/bulk-redesign`, {
              method: "POST", headers: { "Content-Type": "application/json", cookie: req.headers.cookie ?? "" },
              body: JSON.stringify({ mode }),
            });
            const data = await resp.json() as Record<string, unknown>;
            if (!resp.ok) { result = { error: true, message: `❌ ${data.error ?? "Error en bulk redesign"}` }; break; }
            result = { ...data, message: `🚀 **Rediseño en lote iniciado (modo: ${mode})**\n\n${data.totalItems ?? "?"} productos procesándose con calidad 100/100 Semrush.\nJob ID: ${data.jobId ?? "-"}` };
          } catch (err) { result = { error: true, message: `❌ Error: ${err instanceof Error ? err.message : String(err)}` }; }
          break;
        }

        case "setup_full_store": {
          const projectId = params?.projectId;
          if (!projectId) { result = { error: true, message: "❌ Falta projectId" }; break; }
          try {
            const baseUrl = `http://localhost:${process.env.PORT || 8080}`;
            const steps: string[] = [];
  
            const syncResp = await fetch(`${baseUrl}/api/projects/${projectId}/products/sync`, { method: "POST", headers: { "Content-Type": "application/json", cookie: req.headers.cookie ?? "" } });
            steps.push(syncResp.ok ? "✅ Productos sincronizados" : "⚠️ Sync parcial");
  
            const pagesResp = await fetch(`${baseUrl}/api/projects/${projectId}/seo/generate-metas`, { method: "POST", headers: { "Content-Type": "application/json", cookie: req.headers.cookie ?? "" } });
            steps.push(pagesResp.ok ? "✅ Meta tags SEO generados" : "⚠️ Metas parcial");
  
            const altResp = await fetch(`${baseUrl}/api/projects/${projectId}/seo/fix-alt-texts`, { method: "POST", headers: { "Content-Type": "application/json", cookie: req.headers.cookie ?? "" } });
            steps.push(altResp.ok ? "✅ Alt texts optimizados" : "⚠️ Alt texts parcial");
  
            const schemaResp = await fetch(`${baseUrl}/api/projects/${projectId}/seo/generate-schemas`, { method: "POST", headers: { "Content-Type": "application/json", cookie: req.headers.cookie ?? "" } });
            steps.push(schemaResp.ok ? "✅ Schemas JSON-LD generados" : "⚠️ Schemas parcial");
  
            result = { steps, message: `🏗️ **Setup Completo de Tienda ejecutado**\n\n${steps.join("\n")}\n\n💡 Para completar el setup, también puedes pedir:\n• **design_all_pages** → Crear páginas (About, FAQ, Shipping, Returns, Contact)\n• **auto_collections** → Crear colecciones automáticas\n• **optimize_all_products** → Optimizar todos los productos\n• **bulk_generate_images** → Generar imágenes IA` };
          } catch (err) { result = { error: true, message: `❌ Error: ${err instanceof Error ? err.message : String(err)}` }; }
          break;
        }

        case "remove_from_collection": {
          const projectId = params?.projectId;
          const collectionId = params?.collectionId;
          const productId = params?.productId;
          if (!projectId || !collectionId || !productId) {
            result = { error: true, message: "❌ Falta projectId, collectionId o productId" }; break;
          }
          try {
            const [project] = await db.select().from(projectsTable).where(eq(projectsTable.id, parseInt(String(projectId))));
            if (!project?.accessToken) { result = { error: true, message: "❌ Proyecto sin token de acceso" }; break; }
            const token = safeDecrypt(project.accessToken);
            const domain = project.shopDomain;
            const collectsResp = await fetch(`https://${domain}/admin/api/${SHOPIFY_API_VERSION}/collects.json?collection_id=${collectionId}&product_id=${productId}`, {
              headers: { "X-Shopify-Access-Token": token, "Content-Type": "application/json" },
            });
            const collectsData = await collectsResp.json() as { collects: Array<{ id: number }> };
            if (!collectsData.collects?.length) { result = { error: true, message: "❌ El producto no está en esa colección" }; break; }
            for (const c of collectsData.collects) {
              await fetch(`https://${domain}/admin/api/${SHOPIFY_API_VERSION}/collects/${c.id}.json`, {
                method: "DELETE", headers: { "X-Shopify-Access-Token": token },
              });
            }
            result = { message: `✅ **Producto ${productId} eliminado de la colección ${collectionId}**` };
          } catch (err) { result = { error: true, message: `❌ Error: ${err instanceof Error ? err.message : String(err)}` }; }
          break;
        }

        default:
          return NOT_HANDLED;
      }
  return result;
}
