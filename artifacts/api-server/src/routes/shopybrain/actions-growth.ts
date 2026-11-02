// Acciones del cerebro — Auditorías, SEO, A/B, competencia, precios, finanzas, email, inventario e informes.
// Extraídas tal cual del switch de POST /shopybrain/execute-action (routes/shopybrain.ts).
/* eslint-disable @typescript-eslint/no-explicit-any */
import { db, projectsTable, seoDataTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import { shopifyRequest, shopifyGraphQL } from "../../lib/shopify.js";
import { learnFromOperation, askClaudeWithBrain } from "../../lib/claude.js";
import { auditProduct, scoreToGrade } from "../../lib/audit.js";
import { logger } from "../../lib/logger.js";
import { saveToVault } from "../../lib/vault.js";
import { buildCoverPage } from "../../lib/report-cover.js";
import { generateLeveledReport } from "../../lib/report-levels.js";
import {
  getSessionProjectId
} from "../../lib/shopybrain-helpers.js";

import {
  parseTemplate
} from "./shared.js";
import { NOT_HANDLED, type BrainActionCtx, type BrainActionOutcome } from "./action-context.js";

export async function runGrowthActions(ctx: BrainActionCtx): Promise<BrainActionOutcome> {
  const { req, res, action, params, resolveStripeAccountId } = ctx;
  let result: Record<string, unknown> = {};
      switch (action) {
        case "audit_store": {
          const projectId = params?.projectId;
          if (!projectId) { res.status(400).json({ error: "projectId requerido" }); return; }
          const [project] = await db.select().from(projectsTable).where(eq(projectsTable.id, parseInt(projectId)));
          if (!project) { res.status(404).json({ error: "Proyecto no encontrado" }); return; }
  
          const gqlAuditQuery = (cursor?: string) => `{
            products(first: 250${cursor ? `, after: "${cursor}"` : ""}) {
              edges {
                node {
                  id
                  title
                  handle
                  status
                  descriptionHtml
                  tags
                  publishedAt
                  onlineStoreUrl
                  totalInventory
                  seo { title description }
                  images(first: 20) { edges { node { id url altText } } }
                  variants(first: 100) {
                    edges {
                      node {
                        id
                        title
                        price
                        compareAtPrice
                        sku
                        barcode
                        inventoryQuantity
                        image { url }
                      }
                    }
                  }
                }
              }
              pageInfo { hasNextPage endCursor }
            }
          }`;
  
          interface AuditGqlNode {
            id: string;
            title: string;
            handle: string;
            status: string;
            descriptionHtml: string;
            tags: string[];
            publishedAt: string | null;
            onlineStoreUrl: string | null;
            totalInventory: number;
            seo: { title: string | null; description: string | null };
            images: { edges: Array<{ node: { id: string; url: string; altText: string | null } }> };
            variants: { edges: Array<{ node: { id: string; title: string; price: string; compareAtPrice: string | null; sku: string | null; barcode: string | null; inventoryQuantity: number | null; image: { url: string } | null } }> };
          }
  
          let allAuditProducts: Array<Record<string, unknown>> = [];
          try {
            let hasNext = true;
            let cursor: string | undefined;
            const allEdges: Array<{ node: AuditGqlNode }> = [];
            while (hasNext) {
              const gqlData = await shopifyGraphQL<{ products: { edges: Array<{ node: AuditGqlNode }>; pageInfo: { hasNextPage: boolean; endCursor: string } } }>(
                parseInt(projectId), project.shopDomain, gqlAuditQuery(cursor)
              );
              allEdges.push(...(gqlData.products?.edges || []));
              hasNext = gqlData.products?.pageInfo?.hasNextPage || false;
              cursor = gqlData.products?.pageInfo?.endCursor;
            }
            allAuditProducts = allEdges.map(({ node }) => {
              const gid = String(node.id || "");
              const numericId = gid.includes("/") ? gid.split("/").pop() : gid;
              const variantEdges = node.variants?.edges || [];
              const imageEdges = node.images?.edges || [];
              const seoTitle = node.seo?.title || null;
              const seoDesc = node.seo?.description || null;
              const metafields: Array<{ namespace: string; key: string; value: string }> = [];
              if (seoTitle) metafields.push({ namespace: "seo", key: "title", value: seoTitle });
              if (seoDesc) metafields.push({ namespace: "seo", key: "description", value: seoDesc });
  
              return {
                id: numericId,
                title: node.title,
                handle: node.handle,
                status: (node.status || "").toLowerCase(),
                body_html: node.descriptionHtml,
                tags: Array.isArray(node.tags) ? node.tags.join(", ") : node.tags,
                published_at: node.publishedAt,
                published_scope: node.onlineStoreUrl ? "global" : "web",
                totalInventory: node.totalInventory,
                seoTitle,
                seoDescription: seoDesc,
                metafields,
                images: imageEdges.map(({ node: img }) => ({
                  id: img.id,
                  src: img.url,
                  alt: img.altText,
                })),
                variants: variantEdges.map(({ node: v }) => ({
                  id: v.id,
                  title: v.title,
                  price: v.price,
                  compare_at_price: v.compareAtPrice,
                  sku: v.sku,
                  barcode: v.barcode,
                  inventory_quantity: v.inventoryQuantity,
                  image_url: v.image?.url || null,
                })),
              };
            });
          } catch (gqlErr) {
            logger.warn({ err: gqlErr }, "GraphQL failed, falling back to REST API for audit");
            for (const st of ["active", "draft", "archived"]) {
              const d = await shopifyRequest<{ products: Array<Record<string, unknown>> }>(
                parseInt(projectId), project.shopDomain, `/products.json?limit=250&status=${st}&published_status=any`
              );
              const restProducts = d.products || [];
              for (const rp of restProducts) {
                try {
                  const metaRes = await shopifyRequest<{ metafields: Array<{ namespace: string; key: string; value: string }> }>(
                    parseInt(projectId), project.shopDomain, `/products/${rp.id}/metafields.json?namespace=global`
                  );
                  const seoMeta = metaRes.metafields || [];
                  const seoTitleMeta = seoMeta.find((m: Record<string, string>) => m.key === "title_tag");
                  const seoDescMeta = seoMeta.find((m: Record<string, string>) => m.key === "description_tag");
                  const metafields: Array<{ namespace: string; key: string; value: string }> = [];
                  if (seoTitleMeta) metafields.push({ namespace: "seo", key: "title", value: seoTitleMeta.value });
                  if (seoDescMeta) metafields.push({ namespace: "seo", key: "description", value: seoDescMeta.value });
                  (rp as Record<string, unknown>).metafields = metafields;
                  (rp as Record<string, unknown>).seoTitle = seoTitleMeta?.value || null;
                  (rp as Record<string, unknown>).seoDescription = seoDescMeta?.value || null;
                } catch { /* metafields fetch failed, continue without */ }
                await new Promise(r => setTimeout(r, 100));
              }
              for (const rp2 of restProducts) {
                (rp2 as Record<string, unknown>).id = String(rp2.id);
              }
              allAuditProducts = allAuditProducts.concat(restProducts);
            }
          }
  
          let totalScore = 0;
          const criticalIssues: string[] = [];
          const warnings: string[] = [];
          let unpublishedCount = 0;
          let noCompareCount = 0;
          let lowImageCount = 0;
          let shortDescCount = 0;
          let lowTagsCount = 0;
          let draftCount = 0;
          let noMetaTitleCount = 0;
          let noMetaDescCount = 0;
          let noAltTextCount = 0;
          let noSkuCount = 0;
          let zeroStockCount = 0;
          let noHandleCount = 0;
  
          const productAudits = allAuditProducts.map((p: Record<string, unknown>) => {
            const variants = (p.variants as Array<Record<string, unknown>>) || [];
            const images = (p.images as Array<Record<string, unknown>>) || [];
            const bodyHtml = (p.body_html as string) || "";
            const bodyLen = bodyHtml.length;
            const tagsStr = (p.tags as string) || "";
            const tagsArr = tagsStr.split(",").filter((t: string) => t.trim());
            const hasCompare = variants.some(v => !!v.compare_at_price || !!v.compareAtPrice);
            const isPublished = !!p.published_at;
            const imgCount = images.length;
            const status = p.status as string;
            const handle = (p.handle as string) || "";
            const seoTitle = p.seoTitle as string | null;
            const seoDescription = p.seoDescription as string | null;
            const metafields = (p.metafields as Array<{ namespace: string; key: string; value: string }>) || [];
  
            const audit = auditProduct({
              title: (p.title as string) || "",
              body_html: bodyHtml,
              price: (variants[0]?.price as string) || null,
              compare_at_price: (variants[0]?.compare_at_price as string) || (variants[0]?.compareAtPrice as string) || null,
              images: images.map((img: Record<string, unknown>) => ({
                alt: (img.alt as string) || (img.altText as string) || null,
              })),
              tags: tagsStr,
              variants: variants.map(v => ({ price: (v.price as string) || "0" })),
              metafields,
            });
  
            const issues: string[] = [...audit.problems];
            if (!isPublished) { issues.push("NO PUBLICADO"); unpublishedCount++; }
            if (status === "draft") { issues.push("BORRADOR"); draftCount++; }
            if (!hasCompare) noCompareCount++;
            if (imgCount < 3) lowImageCount++;
            if (bodyLen < 500) shortDescCount++;
            if (tagsArr.length < 10) lowTagsCount++;
            if (!seoTitle && !metafields.some(m => m.namespace === "seo" && m.key === "title")) noMetaTitleCount++;
            if (!seoDescription && !metafields.some(m => m.namespace === "seo" && m.key === "description")) noMetaDescCount++;
            const hasAllAlt = imgCount > 0 && images.every((img: Record<string, unknown>) => {
              const alt = (img.alt as string) || (img.altText as string) || "";
              return alt.trim().length > 0;
            });
            if (imgCount > 0 && !hasAllAlt) noAltTextCount++;
            const allVariantsHaveSku = variants.every(v => !!(v.sku as string)?.trim());
            if (!allVariantsHaveSku && variants.length > 0) noSkuCount++;
            const totalInv = typeof p.totalInventory === "number" ? p.totalInventory : variants.reduce((sum, v) => sum + (typeof v.inventory_quantity === "number" ? v.inventory_quantity : 0), 0);
            if (totalInv <= 0 && status === "active") zeroStockCount++;
            if (!handle || handle.includes("_") || !/^[a-z0-9-]+$/.test(handle)) noHandleCount++;
  
            const variantDetails = variants.map((v: Record<string, unknown>) => ({
              title: v.title,
              price: v.price,
              compareAtPrice: v.compare_at_price || v.compareAtPrice || null,
              sku: v.sku || null,
              barcode: v.barcode || null,
              weight: v.weight || null,
              weightUnit: v.weight_unit || v.weightUnit || null,
              inventoryQuantity: v.inventory_quantity ?? v.inventoryQuantity ?? null,
              hasImage: !!(v.image_url || v.image),
            }));
  
            totalScore += audit.overallScore;
  
            const firstImg = images[0] as Record<string, unknown> | undefined;
            return {
              id: p.id,
              title: p.title,
              handle,
              status,
              published: isPublished,
              publishedScope: p.published_scope,
              score: audit.overallScore,
              grade: audit.grade,
              titleScore: audit.titleScore,
              descriptionScore: audit.descriptionScore,
              priceScore: audit.priceScore,
              imageScore: audit.imageScore,
              seoScore: audit.seoScore,
              contentQualityScore: audit.contentQualityScore,
              trustScore: audit.trustScore,
              imageCount: imgCount,
              imageUrl: firstImg?.src || firstImg?.url || null,
              descLength: bodyLen,
              tagsCount: tagsArr.length,
              variantCount: variants.length || 1,
              price: (variants[0]?.price as string) ?? "0",
              compareAtPrice: (variants[0]?.compare_at_price as string) || (variants[0]?.compareAtPrice as string) || null,
              hasCompare,
              hasComparePrice: hasCompare,
              hasMetaTitle: !!(seoTitle || metafields.some(m => m.namespace === "seo" && m.key === "title")),
              hasMetaDesc: !!(seoDescription || metafields.some(m => m.namespace === "seo" && m.key === "description")),
              hasAltTexts: hasAllAlt,
              cleanHandle: !!handle && /^[a-z0-9-]+$/.test(handle) && handle.length <= 60,
              totalInventory: totalInv,
              variants: variantDetails,
              problems: audit.problems,
              suggestions: audit.suggestions.slice(0, 5),
              issues: issues.length > 0 ? issues : undefined,
            };
          });
  
          if (unpublishedCount > 0) criticalIssues.push(`🚨 ${unpublishedCount} producto(s) NO PUBLICADOS — invisibles para clientes`);
          if (draftCount > 0) criticalIssues.push(`📝 ${draftCount} producto(s) en BORRADOR — no visibles en la tienda`);
          if (zeroStockCount > 0) criticalIssues.push(`📦 ${zeroStockCount} producto(s) ACTIVOS con stock 0 — no se pueden comprar`);
          if (noMetaTitleCount > 0) warnings.push(`🔍 ${noMetaTitleCount} producto(s) sin meta title SEO — Google usará el título por defecto`);
          if (noMetaDescCount > 0) warnings.push(`📋 ${noMetaDescCount} producto(s) sin meta description — impacto crítico en CTR de Google`);
          if (noCompareCount > 0) warnings.push(`💰 ${noCompareCount} producto(s) sin precio tachado (compare_at_price)`);
          if (lowImageCount > 0) warnings.push(`🖼 ${lowImageCount} producto(s) con menos de 3 imágenes`);
          if (noAltTextCount > 0) warnings.push(`🏷️ ${noAltTextCount} producto(s) con imágenes sin alt text — pierde SEO en Google Images`);
          if (shortDescCount > 0) warnings.push(`📝 ${shortDescCount} producto(s) con descripción corta (<500 caracteres)`);
          if (lowTagsCount > 0) warnings.push(`🏷 ${lowTagsCount} producto(s) con menos de 10 tags SEO`);
          if (noSkuCount > 0) warnings.push(`🔢 ${noSkuCount} producto(s) sin SKU en variantes — dificulta gestión de inventario`);
          if (noHandleCount > 0) warnings.push(`🔗 ${noHandleCount} producto(s) con URL handle no optimizada`);
  
          const avgScore = allAuditProducts.length > 0 ? Math.round(totalScore / allAuditProducts.length) : 0;
          const overallGrade = scoreToGrade(avgScore);
  
          let auditMessage = `🔍 AUDITORÍA PROFUNDA COMPLETA — ${project.shopDomain}\n\n`;
          auditMessage += `📊 Puntuación media: ${avgScore}/100 (${overallGrade})\n`;
          auditMessage += `📦 Total: ${allAuditProducts.length} productos\n`;
          auditMessage += `📢 Publicados: ${allAuditProducts.length - unpublishedCount} | 🔇 No publicados: ${unpublishedCount}\n\n`;
          auditMessage += `📐 Criterios evaluados: Título, Descripción, Precio, Imágenes (cantidad + alt texts), SEO (meta title + meta description + tags + handle), Calidad de contenido, Confianza, Variantes (stock + SKU + precio tachado).\n`;
          if (criticalIssues.length > 0) auditMessage += `\n🚨 PROBLEMAS CRÍTICOS:\n${criticalIssues.join("\n")}`;
          if (warnings.length > 0) auditMessage += `\n\n⚠️ ADVERTENCIAS:\n${warnings.join("\n")}`;
          if (criticalIssues.length === 0 && warnings.length === 0) auditMessage += `\n✅ ¡Todos los productos están en perfecto estado!`;
  
          const projIdInt = parseInt(projectId);
          for (const pa of productAudits) {
            const pid = String(pa.id);
            const seoT = (allAuditProducts.find(ap => ap.id === pid) as Record<string, unknown>)?.seoTitle as string | null;
            const seoD = (allAuditProducts.find(ap => ap.id === pid) as Record<string, unknown>)?.seoDescription as string | null;
            try {
              const seoValues = {
                metaTitle: seoT || null,
                metaDescription: seoD || null,
                hasAltTexts: !!pa.hasAltTexts,
                cleanHandle: !!pa.cleanHandle,
                seoScore: pa.seoScore as number,
                seoGrade: scoreToGrade(pa.seoScore as number),
                descriptionLength: pa.descLength as number,
                lastAuditedAt: new Date(),
              };
              const [existing] = await db.select({ id: seoDataTable.id }).from(seoDataTable)
                .where(and(eq(seoDataTable.projectId, projIdInt), eq(seoDataTable.shopifyProductId, pid)));
              if (existing) {
                await db.update(seoDataTable).set(seoValues).where(eq(seoDataTable.id, existing.id));
              } else {
                await db.insert(seoDataTable).values({ projectId: projIdInt, shopifyProductId: pid, ...seoValues });
              }
            } catch (seoSaveErr) {
              logger.warn({ err: seoSaveErr, productId: pid }, "Failed to save SEO data during audit");
            }
          }
  
          result = {
            totalProducts: allAuditProducts.length,
            averageScore: avgScore,
            overallGrade,
            publishedCount: allAuditProducts.length - unpublishedCount,
            unpublishedCount,
            draftCount,
            noCompareCount,
            lowImageCount,
            shortDescCount,
            lowTagsCount,
            noMetaTitleCount,
            noMetaDescCount,
            noAltTextCount,
            noSkuCount,
            zeroStockCount,
            noHandleCount,
            criticalIssues,
            warnings,
            criteriaEvaluated: ["Título (longitud, keywords, genérico)", "Descripción (longitud, estructura, H2/H3, bullets, FAQ)", "Precio (compare_at, pricing psicológico, variantes)", "Imágenes (cantidad, alt texts SEO)", "SEO (meta title, meta description, tags, handle URL)", "Calidad de contenido (beneficios, specs, FAQ, CTA, garantía)", "Confianza (garantía, imágenes, alt texts, FAQ, specs)", "Variantes (stock, SKU, precio tachado, imágenes)"],
            products: productAudits,
            message: auditMessage,
          };
          break;
        }

        case "run_leveled_report": {
          const projectId = params?.projectId;
          const reportType = params?.type;
          const level = Math.max(1, Math.min(5, parseInt(String(params?.level || 1))));
          if (!projectId || isNaN(Number(projectId))) { result = { error: true, message: "❌ Falta projectId válido" }; break; }
          if (!reportType) { result = { error: true, message: "❌ Falta type — indica qué tipo de informe (ej: seo_audit, brand_analysis, competitor_report)" }; break; }
          try {
            const [project] = await db.select().from(projectsTable).where(eq(projectsTable.id, parseInt(String(projectId))));
            if (!project) { result = { error: true, message: "❌ Proyecto no encontrado" }; break; }
            const template = parseTemplate(params?.template);
            const levelResult = await generateLeveledReport({
              projectId: parseInt(String(projectId)),
              reportType: String(reportType),
              reportTitle: `${String(reportType).replace(/_/g, " ")} — ${project.name}`,
              dataBlock: `Tienda: ${project.name}\nDominio: ${project.shopDomain}\nNicho: ${project.storeNiche || "eCommerce"}`,
              level: level as 1 | 2 | 3 | 4 | 5,
              template,
              niche: project.storeNiche || undefined,
            });
            const levelNames = ["", "Diagnóstico", "Guía Implementación", "Contenido Producido", "Premium Full", "Enterprise"];
            result = {
              message: `📊 **Informe Nivel ${level} — ${levelNames[level]}**\n\n` +
                `📋 **Tipo:** ${reportType}\n` +
                `🏪 **Tienda:** ${project.name}\n` +
                `📁 **Archivos generados:** ${levelResult.files.length}\n\n` +
                levelResult.files.map((f: { title: string; vaultId: number | null }, i: number) =>
                  `${i + 1}. 📄 ${f.title}${f.vaultId ? ` — /api/vault/download/${f.vaultId}` : ""}`
                ).join("\n") +
                `\n\n🗄️ Todo guardado en el Vault para descarga`,
            };
          } catch (err) {
            result = { error: true, message: `❌ Error generando informe nivel: ${err instanceof Error ? err.message : String(err)}` };
          }
          break;
        }

        case "generate_competitive_pricing": {
          const projectId = params?.projectId;
          const numPlans = Math.min(Math.max(parseInt(String(params?.numPlans ?? 6)), 3), 8);
          const industry = params?.industry || "Shopify agency / eCommerce SaaS";
          const syncToShopify = params?.syncToShopify !== false;
  
          try {
            const pricingPrompt = `INVESTIGA el mercado REAL de pricing para agencias y plataformas SaaS de optimización Shopify / eCommerce en 2025-2026.
  
  INDUSTRIA: ${industry}
  
  BUSCA precios REALES de:
  1. Agencias Shopify (servicios mensuales de optimización, SEO, imágenes, A/B testing)
  2. Plataformas SaaS de eCommerce (herramientas de optimización, pricing tools, image generation)
  3. Servicios de IA para eCommerce (Claude, ChatGPT wrappers, automated tools)
  4. Competidores directos: Shogun, PageFly, Privy, Klaviyo, Yotpo, Bold Commerce, Nosto, etc.
  
  Luego GENERA ${numPlans} PLANES DE PRECIO profesionales y competitivos para Shopy Crafter (agencia de optimización IA para tiendas Shopify, con 6 motores IA: imágenes, consistencia visual, A/B testing, auto-pilot, pricing financiero, SEO técnico).
  
  REQUISITOS:
  1. Los precios deben ser COMPETITIVOS con el mercado real investigado
  2. Incluye planes desde entrada hasta enterprise
  3. Cada plan debe tener un DIFERENCIADOR claro
  4. Features deben ser REALES — basados en capacidades reales de Shopy Crafter
  5. Usa pricing psicológico (precios que terminan en 7 o 9)
  6. Incluye al menos un plan "one-shot" o pago único
  7. El plan más popular debe ser el de mejor relación calidad/precio
  8. Incluye badges estratégicos ("MÁS POPULAR", "MEJOR VALOR", "SIN RETAINER", etc.)
  
  RESPONDE SOLO JSON válido con un array "plans":
  {
    "plans": [
      {
        "id": "plan-slug",
        "name": "Nombre del Plan",
        "price": "XX",
        "currency": "€",
        "period": "por mes · + €XXX setup único",
        "featured": false,
        "badge": null,
        "features": [{"text": "Feature description", "included": true}],
        "cta": {"label": "Solicitar Plan →", "style": "ghost"},
        "shopifyProductTitle": "Shopy Crafter - Nombre Plan (Mensual)",
        "shopifyProductDescription": "Descripción completa para Shopify..."
      }
    ],
    "strategy": "Explicación de la estrategia de pricing elegida",
    "marketPosition": "Dónde se posiciona Shopy Crafter vs competencia"
  }`;
  
            const { dualAIJson } = await import("../../lib/dual-ai.js");
            const dualPricing = await dualAIJson<{
              plans: Array<{
                id: string; name: string; price: string; currency: string; period: string;
                featured: boolean; badge: string | null;
                features: Array<{ text: string; included: boolean }>;
                cta: { label: string; style: string };
                shopifyProductTitle?: string;
                shopifyProductDescription?: string;
              }>;
              strategy?: string;
              marketPosition?: string;
            }>(projectId ? parseInt(String(projectId)) : 0, pricingPrompt, {
              mode: "gemini_research_claude_redact",
              claudeSystemPrompt: "Eres un consultor de pricing SaaS con 15 años de experiencia en agencias Shopify. Generas catálogos de precios que maximizan conversión y revenue. Responde SOLO JSON válido.",
              geminiUseSearch: true,
              useCase: "pricing",
              maxTokens: 16000,
            });
            const plansResult = dualPricing.data;
  
            if (!plansResult?.plans?.length) {
              result = { error: true, message: "No se pudieron generar planes de precio. Inténtalo de nuevo." };
              break;
            }
  
            const cookiePricing = req.headers.cookie ?? "";
            const cmsChanges: Array<{ path: string; value: unknown }> = [];
  
            plansResult.plans.forEach((plan, i) => {
              cmsChanges.push({ path: `pricing.plans.${i}`, value: {
                id: plan.id || `plan-${i}`,
                name: plan.name,
                price: plan.price,
                currency: plan.currency || "€",
                period: plan.period,
                featured: plan.featured || false,
                badge: plan.badge || null,
                features: plan.features,
                cta: plan.cta || { label: `Solicitar ${plan.name} →`, style: plan.featured ? "gold" : "ghost" },
              }});
            });
  
            const batchCmsRes = await fetch(`http://localhost:${process.env.PORT ?? 3001}/api/cms/content/batch`, {
              method: "POST",
              headers: { "Content-Type": "application/json", "Cookie": cookiePricing },
              body: JSON.stringify({ changes: cmsChanges }),
            });
  
            let shopifyProducts: Array<{ title: string; id: string; price: string }> = [];
  
            if (syncToShopify && projectId) {
              try {
                const [project] = await db.select().from(projectsTable).where(eq(projectsTable.id, parseInt(String(projectId))));
                if (project) {
                  for (const plan of plansResult.plans) {
                    try {
                      const shopifyProduct = {
                        title: plan.shopifyProductTitle || `Shopy Crafter — ${plan.name}`,
                        body_html: plan.shopifyProductDescription || `<h2>${plan.name}</h2><p>${plan.period}</p><ul>${plan.features.filter(f => f.included).map(f => `<li>✅ ${f.text}</li>`).join("")}</ul>`,
                        product_type: "Servicio SaaS",
                        tags: `shopybrain, plan, pricing, ${plan.name.toLowerCase()}, saas, agency`,
                        status: "active",
                        variants: [{
                          title: plan.name,
                          price: plan.price,
                          requires_shipping: false,
                          taxable: true,
                          sku: plan.id,
                        }],
                      };
  
                      const created = await shopifyRequest<{ product: Record<string, unknown> }>(
                        parseInt(String(projectId)),
                        project.shopDomain,
                        "/products.json",
                        { method: "POST", body: JSON.stringify({ product: shopifyProduct }) }
                      );
  
                      shopifyProducts.push({
                        title: String(created.product.title),
                        id: String(created.product.id),
                        price: plan.price,
                      });
                    } catch (shopErr) {
                      logger.warn({ plan: plan.name, error: shopErr }, "Failed to create plan in Shopify");
                    }
                  }
                }
              } catch { /* Shopify sync failed, CMS still updated */ }
            }
  
            result = {
              success: true,
              plansGenerated: plansResult.plans.length,
              plans: plansResult.plans.map(p => ({ name: p.name, price: `${p.price}${p.currency || "€"}`, featured: p.featured, badge: p.badge })),
              cmsUpdated: batchCmsRes.ok,
              shopifyProductsCreated: shopifyProducts.length,
              shopifyProducts,
              strategy: plansResult.strategy || "",
              marketPosition: plansResult.marketPosition || "",
              dualAIMode: dualPricing.mode,
              dualAITimings: dualPricing.timings,
              message: `🎯 ${plansResult.plans.length} planes generados y guardados en CMS${shopifyProducts.length > 0 ? ` + ${shopifyProducts.length} productos creados en Shopify` : ""}.\n\n📊 Planes:\n${plansResult.plans.map((p, i) => `${i + 1}. **${p.name}** — ${p.price}${p.currency || "€"} ${p.period}${p.badge ? ` [${p.badge}]` : ""}`).join("\n")}\n\n🧠 Estrategia: ${plansResult.strategy || "Pricing competitivo basado en investigación de mercado"}`,
            };
          } catch (err) {
            result = { error: true, message: `Error generando pricing: ${err instanceof Error ? err.message : String(err)}` };
          }
          break;
        }

        case "audit_app_offerings": {
          try {
            const cookieAudit = req.headers.cookie ?? "";
            const cmsReadRes = await fetch(`http://localhost:${process.env.PORT ?? 3001}/api/cms/content`, { headers: { "Cookie": cookieAudit } });
            const cmsData = cmsReadRes.ok ? await cmsReadRes.json() : {};
  
            const features = ((cmsData as any).features?.items as Array<{ title: string; description: string }>) ?? [];
            const plans = ((cmsData as any).pricing?.plans as Array<{ name: string; price: string; features: Array<{ text: string; included: boolean }> }>) ?? [];
  
            const auditPrompt = `Audita la oferta de Shopy Crafter basándote en lo que realmente ofrece la plataforma:
  
  MOTORES IA (features reales):
  ${features.map((f, i) => `${i + 1}. ${f.title}: ${f.description}`).join("\n")}
  
  PLANES DE PRECIO ACTUALES:
  ${plans.map(p => `${p.name} (${p.price}€): ${p.features?.filter(f => f.included).map(f => f.text).join(", ")}`).join("\n")}
  
  FUNCIONALIDADES REALES DE LA APP:
  - Shopy Crafter Brain (chatbot IA con 34 acciones: gestión Shopify, CMS, código, proveedores, diagnóstico)
  - 6 motores IA (imágenes, consistencia visual, A/B testing, auto-pilot, pricing financiero, SEO técnico)
  - Panel de cliente read-only con dashboard, productos, aprobaciones, mensajes, reportes
  - Panel admin completo con CRM, auditoría, rediseño IA, vault, exports
  - Email marketing con templates IA y Klaviyo
  - Sistema de proveedores con investigación IA
  - Generación de imágenes con Replicate (Flux + Recraft)
  - Investigación de mercado con Gemini (Google Search grounding)
  - Auto-pilot 24/7 con cron jobs
  - Encriptación AES-256, RGPD compliant
  
  ANALIZA:
  1. ¿El pricing refleja el valor real de la plataforma?
  2. ¿Los features listados cubren todo lo que hace la app?
  3. ¿Falta algo en la landing que debería estar?
  4. ¿Cómo se compara con la competencia?
  5. Recomendaciones específicas de mejora
  
  Responde en español, de forma directa y accionable.`;
  
            const auditOfferingsProjectId = getSessionProjectId(req, params);
            const auditText = await askClaudeWithBrain(
              auditOfferingsProjectId,
              [{ role: "user", content: auditPrompt }],
              "Eres un consultor de negocio SaaS especializado en agencias Shopify. Auditas productos y generas recomendaciones concretas y accionables.",
              "general",
              undefined,
              3000
            );
  
            learnFromOperation({
              operationType: "app_offerings_audit",
              title: "Auditoría de oferta comercial",
              content: auditText,
              confidence: 0.8,
              tags: ["business_audit", "pricing", "features"],
            });
  
            result = {
              success: true,
              featuresCount: features.length,
              plansCount: plans.length,
              audit: auditText,
              message: `🔍 **Auditoría de la oferta de Shopy Crafter:**\n\n${auditText}`,
            };
          } catch (err) {
            result = { error: true, message: `Error en auditoría: ${err instanceof Error ? err.message : String(err)}` };
          }
          break;
        }

        case "create_ab_test": {
          const projectId = params?.projectId;
          const productId = params?.productId;
          if (!projectId || !productId) { result = { error: true, message: "❌ Falta projectId o productId" }; break; }
          try {
            const baseUrl = `http://localhost:${process.env.PORT || 8080}`;
            const resp = await fetch(`${baseUrl}/api/projects/${projectId}/ab-tests`, {
              method: "POST", headers: { "Content-Type": "application/json", cookie: req.headers.cookie ?? "" },
              body: JSON.stringify({ productId, testType: params?.testType || "image", variantA: params?.variantA, variantB: params?.variantB }),
            });
            const data = await resp.json() as Record<string, unknown>;
            result = { ...data, message: data.error ? `❌ ${data.error}` : `⚗️ **Test A/B creado**\n\nTipo: ${params?.testType || "image"}\nProducto: ${productId}\n\nEl test está activo y recopilando datos.` };
          } catch (err) { result = { error: true, message: `❌ Error: ${err instanceof Error ? err.message : String(err)}` }; }
          break;
        }

        case "list_ab_tests": {
          const projectId = params?.projectId;
          if (!projectId) { result = { error: true, message: "❌ Falta projectId" }; break; }
          try {
            const baseUrl = `http://localhost:${process.env.PORT || 8080}`;
            const resp = await fetch(`${baseUrl}/api/projects/${projectId}/ab-tests`, { headers: { cookie: req.headers.cookie ?? "" } });
            if (!resp.ok) { result = { error: true, message: "❌ Error obteniendo tests A/B" }; break; }
            const tests = await resp.json() as Array<Record<string, unknown>>;
            const active = tests.filter((t) => t.status === "running").length;
            const completed = tests.filter((t) => t.status === "completed" || t.status === "winner_applied").length;
            result = { tests, message: `⚗️ **Tests A/B**\n\n🟢 Activos: ${active}\n✅ Completados: ${completed}\n📊 Total: ${tests.length}${tests.length > 0 ? "\n\n" + tests.slice(0, 5).map((t) => `• ${t.productTitle || t.productId} — ${t.testType} — ${t.status}${t.winner ? ` (ganador: ${t.winner})` : ""}`).join("\n") : ""}` };
          } catch (err) { result = { error: true, message: `❌ Error: ${err instanceof Error ? err.message : String(err)}` }; }
          break;
        }

        case "declare_winner": {
          const projectId = params?.projectId;
          const testId = params?.testId;
          if (!projectId || !testId) { result = { error: true, message: "❌ Falta projectId o testId" }; break; }
          try {
            const baseUrl = `http://localhost:${process.env.PORT || 8080}`;
            const resp = await fetch(`${baseUrl}/api/projects/${projectId}/ab-tests/${testId}/declare-winner`, {
              method: "POST", headers: { "Content-Type": "application/json", cookie: req.headers.cookie ?? "" },
              body: JSON.stringify({ winner: params?.winner || "A" }),
            });
            const data = await resp.json() as Record<string, unknown>;
            result = { ...data, message: data.error ? `❌ ${data.error}` : `🏆 **Ganador declarado: Variante ${params?.winner || "A"}**\n\nLos cambios se han aplicado al producto.` };
          } catch (err) { result = { error: true, message: `❌ Error: ${err instanceof Error ? err.message : String(err)}` }; }
          break;
        }

        case "seo_full_audit": {
          const projectId = params?.projectId;
          if (!projectId) { result = { error: true, message: "❌ Falta projectId" }; break; }
          try {
            const baseUrl = `http://localhost:${process.env.PORT || 8080}`;
            const resp = await fetch(`${baseUrl}/api/projects/${projectId}/seo/audit`, {
              method: "POST", headers: { "Content-Type": "application/json", cookie: req.headers.cookie ?? "" },
            });
            const data = await resp.json() as { avgScore?: number; storeGrade?: string; products?: Array<Record<string, unknown>>; criticalIssues?: Array<Record<string, unknown>> };
            const critical = data.criticalIssues?.length ?? 0;
            result = { ...data, message: `🔍 **Auditoría SEO Semrush-Level Completa**\n\n📊 Puntuación media: ${Math.round(data.avgScore ?? 0)}/100\n🏆 Grado tienda: ${data.storeGrade ?? "?"}\n📦 Productos auditados: ${Array.isArray(data.products) ? data.products.length : "?"}\n⚠️ Issues críticos: ${critical}\n\n16 criterios evaluados: meta title, meta desc, structured data, alt texts, URL, internal linking, content depth, PageSpeed, title optimization, images, tags, structured content, keyword consistency, readability, social meta, FAQ optimization.` };
          } catch (err) { result = { error: true, message: `❌ Error: ${err instanceof Error ? err.message : String(err)}` }; }
          break;
        }

        case "keyword_intelligence": {
          const projectId = params?.projectId;
          const keyword = params?.keyword;
          if (!projectId || !keyword) { result = { error: true, message: "❌ Falta projectId o keyword" }; break; }
          try {
            const baseUrl = `http://localhost:${process.env.PORT || 8080}`;
            const resp = await fetch(`${baseUrl}/api/projects/${projectId}/seo/keyword-intelligence`, {
              method: "POST", headers: { "Content-Type": "application/json", cookie: req.headers.cookie ?? "" },
              body: JSON.stringify({ keyword }),
            });
            const data = await resp.json() as Record<string, unknown>;
            result = { ...data, message: data.error ? `❌ ${data.error}` : `🔑 **Investigación de Keyword: "${keyword}"**\n\n${JSON.stringify(data).length > 200 ? "Análisis completo generado con Google Search — incluye volumen, dificultad, intención, autocomplete, People Also Ask y competidores SERP." : "Datos recopilados."}` };
          } catch (err) { result = { error: true, message: `❌ Error: ${err instanceof Error ? err.message : String(err)}` }; }
          break;
        }

        case "blog_strategy": {
          const projectId = params?.projectId;
          if (!projectId) { result = { error: true, message: "❌ Falta projectId" }; break; }
          try {
            const baseUrl = `http://localhost:${process.env.PORT || 8080}`;
            const resp = await fetch(`${baseUrl}/api/projects/${projectId}/seo/blog-strategy`, {
              method: "POST", headers: { "Content-Type": "application/json", cookie: req.headers.cookie ?? "" },
            });
            const data = await resp.json() as Record<string, unknown>;
            result = { ...data, message: `📝 **Estrategia de Blog generada**\n\nPillar content + cluster topics basados en tus productos y nicho. Incluye calendario editorial y keywords objetivo.` };
          } catch (err) { result = { error: true, message: `❌ Error: ${err instanceof Error ? err.message : String(err)}` }; }
          break;
        }

        case "generate_blog_post": {
          const projectId = params?.projectId;
          const topic = params?.topic;
          if (!projectId || !topic) { result = { error: true, message: "❌ Falta projectId o topic" }; break; }
          try {
            const baseUrl = `http://localhost:${process.env.PORT || 8080}`;
            const resp = await fetch(`${baseUrl}/api/projects/${projectId}/seo/generate-blog-post`, {
              method: "POST", headers: { "Content-Type": "application/json", cookie: req.headers.cookie ?? "" },
              body: JSON.stringify({ topic, targetKeyword: params?.targetKeyword, wordCount: params?.wordCount || 1500 }),
            });
            const data = await resp.json() as Record<string, unknown>;
            result = { ...data, message: `📄 **Artículo de Blog SEO generado**\n\nTema: ${topic}\n${params?.targetKeyword ? `Keyword objetivo: ${params.targetKeyword}` : ""}\n\nOptimizado para posicionamiento en Google con metodología Semrush.` };
          } catch (err) { result = { error: true, message: `❌ Error: ${err instanceof Error ? err.message : String(err)}` }; }
          break;
        }

        case "generate_schemas": {
          const projectId = params?.projectId;
          if (!projectId) { result = { error: true, message: "❌ Falta projectId" }; break; }
          try {
            const baseUrl = `http://localhost:${process.env.PORT || 8080}`;
            const resp = await fetch(`${baseUrl}/api/projects/${projectId}/seo/generate-schemas`, {
              method: "POST", headers: { "Content-Type": "application/json", cookie: req.headers.cookie ?? "" },
              body: JSON.stringify({ productId: params?.productId }),
            });
            const data = await resp.json() as Record<string, unknown>;
            result = { ...data, message: `📋 **Schemas JSON-LD generados**\n\nProduct, FAQ, Organization schema para Rich Snippets en Google.` };
          } catch (err) { result = { error: true, message: `❌ Error: ${err instanceof Error ? err.message : String(err)}` }; }
          break;
        }

        case "generate_all_metas": {
          const projectId = params?.projectId;
          if (!projectId) { result = { error: true, message: "❌ Falta projectId" }; break; }
          try {
            const baseUrl = `http://localhost:${process.env.PORT || 8080}`;
            const resp = await fetch(`${baseUrl}/api/projects/${projectId}/seo/generate-metas`, {
              method: "POST", headers: { "Content-Type": "application/json", cookie: req.headers.cookie ?? "" },
              body: JSON.stringify({ applyToShopify: true }),
            });
            const data = await resp.json() as Record<string, unknown>;
            result = { ...data, message: `🏷️ **Meta tags SEO generados**\n\nMeta titles (40-60 chars) + meta descriptions (130-155 chars) optimizados para todos los productos.` };
          } catch (err) { result = { error: true, message: `❌ Error: ${err instanceof Error ? err.message : String(err)}` }; }
          break;
        }

        case "fix_all_alt_texts": {
          const projectId = params?.projectId;
          if (!projectId) { result = { error: true, message: "❌ Falta projectId" }; break; }
          try {
            const baseUrl = `http://localhost:${process.env.PORT || 8080}`;
            const resp = await fetch(`${baseUrl}/api/projects/${projectId}/seo/fix-alt-texts`, {
              method: "POST", headers: { "Content-Type": "application/json", cookie: req.headers.cookie ?? "" },
            });
            const data = await resp.json() as Record<string, unknown>;
            result = { ...data, message: `🖼️ **Alt texts SEO corregidos**\n\nTodas las imágenes ahora tienen alt text descriptivo con keywords para Google Images.` };
          } catch (err) { result = { error: true, message: `❌ Error: ${err instanceof Error ? err.message : String(err)}` }; }
          break;
        }

        case "audit_page_speed": {
          const projectId = params?.projectId;
          if (!projectId) { result = { error: true, message: "❌ Falta projectId" }; break; }
          try {
            const baseUrl = `http://localhost:${process.env.PORT || 8080}`;
            const resp = await fetch(`${baseUrl}/api/projects/${projectId}/seo/audit-page-speed`, {
              method: "POST", headers: { "Content-Type": "application/json", cookie: req.headers.cookie ?? "" },
            });
            const data = await resp.json() as Record<string, unknown>;
            result = { ...data, message: `⚡ **Auditoría PageSpeed completada**\n\nCore Web Vitals analizados: LCP, CLS, FID/INP. Incluye puntuación móvil y desktop.` };
          } catch (err) { result = { error: true, message: `❌ Error: ${err instanceof Error ? err.message : String(err)}` }; }
          break;
        }

        case "generate_sitemap": {
          const projectId = params?.projectId;
          if (!projectId) { result = { error: true, message: "❌ Falta projectId" }; break; }
          try {
            const baseUrl = `http://localhost:${process.env.PORT || 8080}`;
            const resp = await fetch(`${baseUrl}/api/projects/${projectId}/seo/generate-sitemap`, {
              method: "POST", headers: { "Content-Type": "application/json", cookie: req.headers.cookie ?? "" },
            });
            const data = await resp.json() as Record<string, unknown>;
            result = { ...data, message: `🗺️ **Sitemap XML generado**\n\nPing enviado a Google para indexación acelerada.` };
          } catch (err) { result = { error: true, message: `❌ Error: ${err instanceof Error ? err.message : String(err)}` }; }
          break;
        }

        case "scan_competitor": {
          const projectId = params?.projectId;
          const competitorId = params?.competitorId;
          if (!projectId || !competitorId) { result = { error: true, message: "❌ Falta projectId o competitorId" }; break; }
          try {
            const baseUrl = `http://localhost:${process.env.PORT || 8080}`;
            const resp = await fetch(`${baseUrl}/api/competitors/scan`, {
              method: "POST", headers: { "Content-Type": "application/json", cookie: req.headers.cookie ?? "" },
              body: JSON.stringify({ projectId, competitorId }),
            });
            const data = await resp.json() as Record<string, unknown>;
            if (!resp.ok) { result = { error: true, message: `❌ ${data.error ?? "Error escaneando competidor"}` }; break; }
            result = { ...data, message: `🔍 **Competidor escaneado**\n\nPrecios, productos, promociones y nivel de amenaza analizados con IA.` };
          } catch (err) { result = { error: true, message: `❌ Error: ${err instanceof Error ? err.message : String(err)}` }; }
          break;
        }

        case "discover_competitors": {
          const projectId = params?.projectId;
          if (!projectId) { result = { error: true, message: "❌ Falta projectId" }; break; }
          try {
            const baseUrl = `http://localhost:${process.env.PORT || 8080}`;
            const resp = await fetch(`${baseUrl}/api/competitors/auto-discover`, {
              method: "POST", headers: { "Content-Type": "application/json", cookie: req.headers.cookie ?? "" },
              body: JSON.stringify({ projectId }),
            });
            const data = await resp.json() as Record<string, unknown>;
            if (!resp.ok) { result = { error: true, message: `❌ ${data.error ?? "Error descubriendo competidores"}` }; break; }
            const discovered = (data.discovered as Array<{ name: string; url: string; type: string; reason: string }>) || [];
            const summary = discovered.map((c, i) => `${i + 1}. **${c.name}** (${c.type})\n   ${c.url}\n   _${c.reason}_`).join("\n\n");
            result = { ...data, message: `🔍 **Competidores descubiertos automáticamente**\n\n${discovered.length} competidores encontrados via Google Search:\n\n${summary || "No se encontraron nuevos competidores."}` };
          } catch (err) { result = { error: true, message: `❌ Error: ${err instanceof Error ? err.message : String(err)}` }; }
          break;
        }

        case "analyze_competitor_product": {
          const projectId = params?.projectId;
          const productId = params?.productId;
          if (!projectId || !productId) { result = { error: true, message: "❌ Falta projectId o productId" }; break; }
          try {
            const baseUrl = `http://localhost:${process.env.PORT || 8080}`;
            const resp = await fetch(`${baseUrl}/api/projects/${projectId}/products/${productId}/analyze-competitors`, {
              method: "POST", headers: { "Content-Type": "application/json", cookie: req.headers.cookie ?? "" },
            });
            const data = await resp.json() as Record<string, unknown>;
            result = { ...data, message: `📊 **Análisis competitivo del producto**\n\nPosicionamiento de precio vs competidores del mercado analizado.` };
          } catch (err) { result = { error: true, message: `❌ Error: ${err instanceof Error ? err.message : String(err)}` }; }
          break;
        }

        case "calculate_optimal_price": {
          const projectId = params?.projectId;
          const productId = params?.productId;
          if (!projectId || !productId) { result = { error: true, message: "❌ Falta projectId o productId" }; break; }
          try {
            const baseUrl = `http://localhost:${process.env.PORT || 8080}`;
            const resp = await fetch(`${baseUrl}/api/projects/${projectId}/products/${productId}/calculate-optimal-price`, {
              method: "POST", headers: { "Content-Type": "application/json", cookie: req.headers.cookie ?? "" },
            });
            const data = await resp.json() as Record<string, unknown>;
            result = { ...data, message: `💰 **Precio óptimo calculado**\n\nAnálisis de elasticidad precio-demanda, márgenes y competencia completado.` };
          } catch (err) { result = { error: true, message: `❌ Error: ${err instanceof Error ? err.message : String(err)}` }; }
          break;
        }

        case "estimate_cogs": {
          const projectId = params?.projectId;
          const productId = params?.productId;
          if (!projectId || !productId) { result = { error: true, message: "❌ Falta projectId o productId" }; break; }
          try {
            const baseUrl = `http://localhost:${process.env.PORT || 8080}`;
            const resp = await fetch(`${baseUrl}/api/projects/${projectId}/products/${productId}/ai-estimate-cogs`, {
              method: "POST", headers: { "Content-Type": "application/json", cookie: req.headers.cookie ?? "" },
            });
            const data = await resp.json() as Record<string, unknown>;
            result = { ...data, message: `📦 **COGS estimado con IA**\n\nMateriales, producción, envío y márgenes calculados.` };
          } catch (err) { result = { error: true, message: `❌ Error: ${err instanceof Error ? err.message : String(err)}` }; }
          break;
        }

        case "auto_estimate_all_cogs": {
          interface ProductItem { id?: string | number; shopifyId?: string | number; title?: string; cogs?: { totalCost?: number } }
          const projectId = params?.projectId;
          if (!projectId) { result = { error: true, message: "❌ Falta projectId" }; break; }
          try {
            const baseUrl = `http://localhost:${process.env.PORT || 8080}`;
            const productsResp = await fetch(`${baseUrl}/api/projects/${projectId}/products`, {
              headers: { cookie: req.headers.cookie ?? "" },
            });
            const productsData: unknown = await productsResp.json();
            const products: ProductItem[] = Array.isArray(productsData)
              ? productsData
              : (productsData !== null && typeof productsData === "object" && Array.isArray((productsData as Record<string, unknown>).products))
                ? (productsData as Record<string, ProductItem[]>).products
                : [];
            if (products.length === 0) {
              result = { error: true, message: "❌ No se encontraron productos en este proyecto." };
              break;
            }
  
            const productsWithoutCogs = products.filter(p => !p.cogs || (p.cogs.totalCost ?? 0) === 0);
            const toEstimate = productsWithoutCogs.length > 0 ? productsWithoutCogs : products;
            const maxProducts = Math.min(toEstimate.length, 10);
  
            const results: Array<{ productId: string; title: string; success: boolean; error?: string }> = [];
            for (let i = 0; i < maxProducts; i++) {
              const product = toEstimate[i];
              const pid = String(product.shopifyId ?? product.id ?? "");
              const ptitle = product.title ?? "";
              try {
                const resp = await fetch(`${baseUrl}/api/projects/${projectId}/products/${pid}/ai-estimate-cogs`, {
                  method: "POST",
                  headers: { "Content-Type": "application/json", cookie: req.headers.cookie ?? "" },
                });
                results.push({ productId: pid, title: ptitle, success: resp.ok, error: resp.ok ? undefined : `HTTP ${resp.status}` });
              } catch (e) {
                results.push({ productId: pid, title: ptitle, success: false, error: String(e) });
              }
            }
  
            const successCount = results.filter(r => r.success).length;
            const failCount = results.filter(r => !r.success).length;
            let msg = `📦 **COGS estimados en lote**\n\n✅ ${successCount} productos estimados correctamente\n`;
            if (failCount > 0) msg += `❌ ${failCount} productos con error\n`;
            msg += `\n📊 Productos procesados:\n${results.map(r => `${r.success ? "✅" : "❌"} ${r.title}`).join("\n")}`;
            if (toEstimate.length > maxProducts) msg += `\n\n⚠️ Limitado a ${maxProducts} productos. Quedan ${toEstimate.length - maxProducts} por estimar.`;
  
            result = { success: true, results, message: msg, total: products.length, estimated: successCount, errors: failCount };
          } catch (err) { result = { error: true, message: `❌ Error: ${err instanceof Error ? err.message : String(err)}` }; }
          break;
        }

        case "price_simulator": {
          const projectId = params?.projectId;
          const productId = params?.productId;
          const newPrice = params?.newPrice;
          if (!projectId || !productId || !newPrice) { result = { error: true, message: "❌ Falta projectId, productId o newPrice" }; break; }
          try {
            const baseUrl = `http://localhost:${process.env.PORT || 8080}`;
            const resp = await fetch(`${baseUrl}/api/projects/${projectId}/products/${productId}/price-simulator`, {
              method: "POST", headers: { "Content-Type": "application/json", cookie: req.headers.cookie ?? "" },
              body: JSON.stringify({ newPrice: parseFloat(String(newPrice)), unitsPerMonth: params?.unitsPerMonth || 30 }),
            });
            const data = await resp.json() as Record<string, unknown>;
            if (!resp.ok) { result = { error: true, message: `❌ ${data.error ?? "Error en simulador"}` }; break; }
            result = { ...data, message: `📈 **Simulación de precio: €${newPrice}**\n\nEscenarios pesimista/base/optimista calculados con impacto en revenue, margen y conversión.` };
          } catch (err) { result = { error: true, message: `❌ Error: ${err instanceof Error ? err.message : String(err)}` }; }
          break;
        }

        case "financial_forecast": {
          const projectId = params?.projectId;
          if (!projectId) { result = { error: true, message: "❌ Falta projectId" }; break; }
          try {
            const baseUrl = `http://localhost:${process.env.PORT || 8080}`;
            const resp = await fetch(`${baseUrl}/api/projects/${projectId}/financial-forecast`, {
              method: "POST", headers: { "Content-Type": "application/json", cookie: req.headers.cookie ?? "" },
              body: JSON.stringify({ months: params?.months || 6 }),
            });
            const data = await resp.json() as Record<string, unknown>;
            result = { ...data, message: `📊 **Forecast Financiero generado**\n\nProyección a ${params?.months || 6} meses con escenarios optimista, realista y pesimista.` };
          } catch (err) { result = { error: true, message: `❌ Error: ${err instanceof Error ? err.message : String(err)}` }; }
          break;
        }

        case "financial_dashboard": {
          const projectId = params?.projectId;
          if (!projectId) { result = { error: true, message: "❌ Falta projectId" }; break; }
          try {
            const baseUrl = `http://localhost:${process.env.PORT || 8080}`;
            const resp = await fetch(`${baseUrl}/api/projects/${projectId}/financial-dashboard`, { headers: { cookie: req.headers.cookie ?? "" } });
            const data = await resp.json() as Record<string, unknown>;
            result = { ...data, message: `💹 **Dashboard Financiero**\n\nMárgenes, COGS, revenue y métricas clave del proyecto.` };
          } catch (err) { result = { error: true, message: `❌ Error: ${err instanceof Error ? err.message : String(err)}` }; }
          break;
        }

        case "generate_email_flow": {
          const projectId = params?.projectId;
          const flowType = params?.flowType || "welcome";
          if (!projectId) { result = { error: true, message: "❌ Falta projectId" }; break; }
          try {
            const [project] = await db.select().from(projectsTable).where(eq(projectsTable.id, parseInt(String(projectId))));
            if (!project) { result = { error: true, message: "❌ Proyecto no encontrado" }; break; }
            const baseUrl = `http://localhost:${process.env.PORT || 8080}`;
            const resp = await fetch(`${baseUrl}/api/klaviyo-ai/generate-workflow`, {
              method: "POST", headers: { "Content-Type": "application/json", cookie: req.headers.cookie ?? "" },
              body: JSON.stringify({ shopDomain: project.shopDomain, storeName: project.name, niche: project.storeNiche || "ecommerce", market: "es", storeContext: params?.customTopic || "" }),
            });
            const data = await resp.json() as Record<string, unknown>;
            if (!resp.ok) { result = { error: true, message: `❌ ${data.error ?? "Error generando flujo email"}` }; break; }
            result = { ...data, message: `📧 **Flujo de Email Marketing generado**\n\nTipo: ${flowType}\nTienda: ${project.name}\n\nFlujo completo con secuencia de emails, asuntos, contenido y timing optimizado.` };
          } catch (err) { result = { error: true, message: `❌ Error: ${err instanceof Error ? err.message : String(err)}` }; }
          break;
        }

        case "generate_email": {
          const projectId = params?.projectId;
          if (!projectId) { result = { error: true, message: "❌ Falta projectId" }; break; }
          try {
            const [project] = await db.select().from(projectsTable).where(eq(projectsTable.id, parseInt(String(projectId))));
            if (!project) { result = { error: true, message: "❌ Proyecto no encontrado" }; break; }
            const baseUrl = `http://localhost:${process.env.PORT || 8080}`;
            const flowType = params?.emailType || "promotional";
            const resp = await fetch(`${baseUrl}/api/klaviyo-ai/generate-email`, {
              method: "POST", headers: { "Content-Type": "application/json", cookie: req.headers.cookie ?? "" },
              body: JSON.stringify({ flowType, emailPosition: 1, storeName: project.name, shopDomain: project.shopDomain, niche: project.storeNiche || "ecommerce", market: "es", projectId }),
            });
            const data = await resp.json() as Record<string, unknown>;
            if (!resp.ok) { result = { error: true, message: `❌ ${data.error ?? "Error generando email"}` }; break; }
            result = { ...data, message: `✉️ **Email de marketing generado**\n\nTipo: ${flowType}\nContenido HTML profesional listo para enviar.` };
          } catch (err) { result = { error: true, message: `❌ Error: ${err instanceof Error ? err.message : String(err)}` }; }
          break;
        }

        case "inventory_sync": {
          const projectId = params?.projectId;
          if (!projectId) { result = { error: true, message: "❌ Falta projectId" }; break; }
          try {
            const baseUrl = `http://localhost:${process.env.PORT || 8080}`;
            const resp = await fetch(`${baseUrl}/api/inventory/sync`, {
              method: "POST", headers: { "Content-Type": "application/json", cookie: req.headers.cookie ?? "" },
              body: JSON.stringify({ projectId }),
            });
            const data = await resp.json() as Record<string, unknown>;
            result = { ...data, message: `📦 **Inventario sincronizado**\n\nStock actualizado desde Shopify.` };
          } catch (err) { result = { error: true, message: `❌ Error: ${err instanceof Error ? err.message : String(err)}` }; }
          break;
        }

        case "inventory_alerts": {
          const projectId = params?.projectId;
          if (!projectId) { result = { error: true, message: "❌ Falta projectId" }; break; }
          try {
            const baseUrl = `http://localhost:${process.env.PORT || 8080}`;
            const resp = await fetch(`${baseUrl}/api/inventory/alerts?projectId=${projectId}`, { headers: { cookie: req.headers.cookie ?? "" } });
            if (!resp.ok) { result = { error: true, message: "❌ Error obteniendo alertas de inventario" }; break; }
            const alerts = await resp.json() as Array<Record<string, unknown>>;
            const alertLines = alerts.slice(0, 10).map((a) => {
              const opts = [a.option1Value, a.option2Value, a.option3Value].filter(Boolean).join("/");
              return `• ${a.productTitle || "?"} ${opts ? `(${opts})` : ""} SKU:${a.sku || "N/A"}: ${a.currentStock ?? "?"} uds — ${a.daysRemaining ?? "?"} dias`;
            }).join("\n");
            result = { alerts, message: `🚨 **Alertas de Inventario**\n\n${alerts.length > 0 ? `${alerts.length} variantes con stock bajo (≤14 dias).\n\n${alertLines}` : "✅ Sin alertas — todo el stock esta en niveles saludables."}` };
          } catch (err) { result = { error: true, message: `❌ Error: ${err instanceof Error ? err.message : String(err)}` }; }
          break;
        }

        case "inventory_deep_report": {
          const projectId = params?.projectId;
          if (!projectId) { result = { error: true, message: "❌ Falta projectId" }; break; }
          try {
            const baseUrl = `http://localhost:${process.env.PORT || 8080}`;
            const resp = await fetch(`${baseUrl}/api/inventory/deep-report?projectId=${projectId}`, { headers: { cookie: req.headers.cookie ?? "" } });
            if (!resp.ok) { result = { error: true, message: "❌ Error obteniendo informe de inventario" }; break; }
            const report = await resp.json() as Record<string, unknown>;
            const summary = report.summary as Record<string, unknown>;
            const byOption = report.byOption as Record<string, Record<string, { stock: number; sold: number }>>;
            const outOfStock = (report.outOfStock || []) as Array<Record<string, unknown>>;
            let optionBreakdown = "";
            for (const [optName, values] of Object.entries(byOption || {})) {
              const topValues = Object.entries(values).sort(([, a], [, b]) => b.sold - a.sold).slice(0, 5);
              optionBreakdown += `\n**${optName}**: ${topValues.map(([v, d]) => `${v}(${d.stock} stock/${d.sold} vendidos)`).join(", ")}`;
            }
            const oosLines = outOfStock.slice(0, 5).map((o) => `• ${o.productTitle} ${[o.option1, o.option2, o.option3].filter(Boolean).join("/")}`).join("\n");
            result = { ...report, message: `📦 **Informe Profundo de Inventario**\n\n📊 Resumen:\n• ${summary.uniqueProducts} productos, ${summary.totalVariants} variantes\n• Stock total: ${summary.totalStock} unidades\n• Vendido total: ${summary.totalSold} unidades\n• Valor stock: ${summary.totalStockValue}€\n• Margen estimado: ${summary.estimatedMargin}%\n• Agotados: ${summary.outOfStockCount} | Criticos: ${summary.criticalCount} | Alerta: ${summary.warningCount} | Sanos: ${summary.healthyCount}\n${optionBreakdown ? `\n📐 Desglose por opcion:${optionBreakdown}` : ""}${oosLines ? `\n\n🔴 Agotados:\n${oosLines}` : ""}` };
  
            learnFromOperation({
              operationType: "inventory_deep_report",
              title: `Informe inventario: ${summary.uniqueProducts} productos, ${summary.totalVariants} variantes, ${summary.totalStock} uds stock, ${summary.totalSold} vendidos`,
              content: JSON.stringify({ summary, optionBreakdown: Object.keys(byOption || {}), outOfStockCount: outOfStock.length }),
              confidence: 0.85,
            });
          } catch (err) { result = { error: true, message: `❌ Error: ${err instanceof Error ? err.message : String(err)}` }; }
          break;
        }

        case "inventory_sync_orders": {
          const projectId = params?.projectId;
          if (!projectId) { result = { error: true, message: "❌ Falta projectId" }; break; }
          try {
            const baseUrl = `http://localhost:${process.env.PORT || 8080}`;
            const resp = await fetch(`${baseUrl}/api/inventory/sync-orders`, {
              method: "POST", headers: { "Content-Type": "application/json", cookie: req.headers.cookie ?? "" },
              body: JSON.stringify({ projectId }),
            });
            const data = await resp.json() as Record<string, unknown>;
            if (!resp.ok) { result = { error: true, message: `❌ ${data.error ?? "Error sincronizando pedidos"}` }; break; }
            result = { ...data, message: `📋 **Pedidos sincronizados**\n\n• ${data.ordersProcessed} pedidos procesados\n• ${data.lineItemsInserted} lineas de venta importadas${(data.lineItemsFailed as number) > 0 ? `\n• ${data.lineItemsFailed} errores de insercion` : ""}\n\nAhora puedes ver analytics detallados con **inventory_sales_analytics** o el historial de un cliente con **inventory_customer_history**.` };
          } catch (err) { result = { error: true, message: `❌ Error: ${err instanceof Error ? err.message : String(err)}` }; }
          break;
        }

        case "inventory_sales_analytics": {
          const projectId = params?.projectId;
          if (!projectId) { result = { error: true, message: "❌ Falta projectId" }; break; }
          try {
            const baseUrl = `http://localhost:${process.env.PORT || 8080}`;
            const resp = await fetch(`${baseUrl}/api/inventory/sales-analytics?projectId=${projectId}`, { headers: { cookie: req.headers.cookie ?? "" } });
            if (!resp.ok) { result = { error: true, message: "❌ Error obteniendo analytics de ventas" }; break; }
            const analytics = await resp.json() as Record<string, unknown>;
            const topProds = ((analytics.topProducts || []) as Array<Record<string, unknown>>).slice(0, 5).map((p) => `• ${p.title}: ${p.qty} uds — ${p.revenue}€`).join("\n");
            const topVars = ((analytics.topVariants || []) as Array<Record<string, unknown>>).slice(0, 5).map((v) => `• ${v.title} (${[v.option1, v.option2, v.option3].filter(Boolean).join("/")}): ${v.qty} uds`).join("\n");
            const topCusts = ((analytics.topCustomers || []) as Array<Record<string, unknown>>).slice(0, 5).map((c) => `• ${c.name || c.email}: ${c.orders} pedidos, ${c.items} items — ${c.revenue}€`).join("\n");
            const salesByOpt = analytics.salesByOption as Record<string, Record<string, { qty: number; revenue: number }>> || {};
            let optSales = "";
            for (const [optName, values] of Object.entries(salesByOpt)) {
              const sorted = Object.entries(values).sort(([, a], [, b]) => b.qty - a.qty).slice(0, 5);
              optSales += `\n**${optName}**: ${sorted.map(([v, d]) => `${v}(${d.qty})`).join(", ")}`;
            }
            result = { ...analytics, message: `📈 **Analytics de Ventas**\n\n📊 General:\n• ${analytics.totalOrders} pedidos | ${analytics.totalItems} items\n• Revenue total: ${analytics.totalRevenue}€\n• Ticket medio: ${analytics.avgOrderValue}€\n\n🏆 Top Productos:\n${topProds || "Sin datos"}\n\n🎯 Top Variantes (talla/color/etc):\n${topVars || "Sin datos"}\n\n👥 Top Clientes:\n${topCusts || "Sin datos"}${optSales ? `\n\n📐 Ventas por opcion:${optSales}` : ""}` };
  
            learnFromOperation({
              operationType: "inventory_sales_analytics",
              title: `Analytics ventas: ${analytics.totalOrders} pedidos, ${analytics.totalRevenue}€ revenue, ticket medio ${analytics.avgOrderValue}€`,
              content: JSON.stringify({ totalOrders: analytics.totalOrders, totalRevenue: analytics.totalRevenue, topProducts: (analytics.topProducts as Array<Record<string, unknown>>)?.slice(0, 3) }),
              confidence: 0.9,
            });
          } catch (err) { result = { error: true, message: `❌ Error: ${err instanceof Error ? err.message : String(err)}` }; }
          break;
        }

        case "sales_report": {
          const projectId = params?.projectId;
          if (!projectId) { result = { error: true, message: "❌ Falta projectId" }; break; }
          try {
            const baseUrl = `http://localhost:${process.env.PORT || 8080}`;
            const resp = await fetch(`${baseUrl}/api/inventory/sales-report?projectId=${projectId}&format=json`, { headers: { cookie: req.headers.cookie ?? "" } });
            if (!resp.ok) { result = { error: true, message: "❌ Error generando informe de ventas" }; break; }
            const report = await resp.json() as Record<string, unknown>;
            const summary = report.summary as Record<string, unknown>;
            const prods = (report.products as Array<Record<string, unknown>>)?.slice(0, 10) || [];
            let prodsMsg = "";
            for (const p of prods) {
              const variants = (p.variants as Array<Record<string, unknown>>)?.slice(0, 5) || [];
              const varMsg = variants.map((v: Record<string, unknown>) => {
                const opts = (v.options as string[])?.join(" · ") || v.variantTitle;
                return `    · ${opts}: ${v.qtySold} vendidos, stock ${v.currentStock}`;
              }).join("\n");
              prodsMsg += `\n📦 **${p.title}**: ${p.totalQtySold} uds vendidas, ${p.totalRevenue}€, stock actual: ${p.totalCurrentStock}\n${varMsg}\n`;
            }
            const downloadUrl = `/api/inventory/sales-report?projectId=${projectId}`;
            result = { ...report, message: `📊 **Informe de Ventas y Stock**\n\n📈 Resumen General:\n• ${summary.totalOrders} pedidos | ${summary.totalItems} artículos vendidos\n• Revenue total: ${summary.totalRevenue}€\n• Ticket medio: ${summary.avgTicket}€\n• Stock total actual: ${summary.totalStock} unidades\n• ${summary.totalProducts} productos\n\n🏆 Top Productos (por ventas):\n${prodsMsg || "Sin datos de ventas — sincroniza pedidos primero con inventory_sync_orders"}\n\n📥 Descarga el informe completo:\n• [HTML](${downloadUrl})\n• [PDF](${downloadUrl}&format=pdf)` };
            learnFromOperation({
              operationType: "sales_report",
              title: `Informe ventas: ${summary.totalProducts} productos, ${summary.totalItems} items, ${summary.totalRevenue}€`,
              content: JSON.stringify({ totalOrders: summary.totalOrders, totalRevenue: summary.totalRevenue, totalProducts: summary.totalProducts }),
              confidence: 0.9,
            });
          } catch (err) { result = { error: true, message: `❌ Error: ${err instanceof Error ? err.message : String(err)}` }; }
          break;
        }

        case "inventory_customer_history": {
          const projectId = params?.projectId;
          const customerId = params?.customerId;
          const customerEmail = params?.customerEmail;
          if (!projectId) { result = { error: true, message: "❌ Falta projectId" }; break; }
          if (!customerId && !customerEmail) { result = { error: true, message: "❌ Falta customerId o customerEmail" }; break; }
          try {
            const baseUrl = `http://localhost:${process.env.PORT || 8080}`;
            const qs = customerId ? `customerId=${customerId}` : `customerEmail=${encodeURIComponent(String(customerEmail))}`;
            const resp = await fetch(`${baseUrl}/api/inventory/customer-history?projectId=${projectId}&${qs}`, { headers: { cookie: req.headers.cookie ?? "" } });
            if (!resp.ok) { result = { error: true, message: "❌ Error obteniendo historial de cliente" }; break; }
            const history = await resp.json() as Record<string, unknown>;
            const customer = history.customer as Record<string, unknown>;
            const preferences = history.preferences as Record<string, string>;
            const purchases = ((history.purchases || []) as Array<Record<string, unknown>>).slice(0, 10);
            const prefLines = Object.entries(preferences || {}).map(([k, v]) => `• ${k}: ${v}`).join("\n");
            const purchaseLines = purchases.map((p) => `• ${p.orderNumber}: ${p.productTitle} ${[p.option1, p.option2, p.option3].filter(Boolean).join(" ")} x${p.quantity} — ${p.totalPrice}€`).join("\n");
            result = { ...history, message: `👤 **Historial de Cliente: ${customer.name || customer.email}**\n\n📊 Resumen:\n• ${history.totalOrders} pedidos | ${history.totalItems} items\n• Gasto total: ${history.totalSpent}€\n• Ticket medio: ${history.avgOrderValue}€\n\n🎯 Preferencias detectadas:\n${prefLines || "Sin datos suficientes"}\n\n🛒 Ultimas compras:\n${purchaseLines || "Sin compras registradas"}` };
          } catch (err) { result = { error: true, message: `❌ Error: ${err instanceof Error ? err.message : String(err)}` }; }
          break;
        }

        case "agency_quote": {
          const projectId = params?.projectId;
          if (!projectId) { result = { error: true, message: "❌ Falta projectId" }; break; }
          try {
            const baseUrl = `http://localhost:${process.env.PORT || 8080}`;
            const resp = await fetch(`${baseUrl}/api/agency/quote`, {
              method: "POST", headers: { "Content-Type": "application/json", cookie: req.headers.cookie ?? "" },
              body: JSON.stringify({ projectId, services: params?.services, clientName: params?.clientName }),
            });
            const data = await resp.json() as Record<string, unknown>;
            result = { ...data, message: `💼 **Presupuesto generado**\n\nCotización profesional lista para enviar al cliente.` };
          } catch (err) { result = { error: true, message: `❌ Error: ${err instanceof Error ? err.message : String(err)}` }; }
          break;
        }

        case "generate_budget": {
          try {
            const escHtml = (s: string) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
            const clampNum = (v: unknown, min: number, max: number, fallback: number) => { const n = Number(v); return Number.isFinite(n) ? Math.max(min, Math.min(max, n)) : fallback; };
  
            const services = params?.services || [];
            const clientName = escHtml(String(params?.clientName || "Cliente").slice(0, 200));
            const projectName = escHtml(String(params?.projectName || "Proyecto Shopify").slice(0, 200));
            const clientEmail = escHtml(String(params?.clientEmail || "").slice(0, 200));
            const clientPhone = escHtml(String(params?.clientPhone || "").slice(0, 200));
            const clientCompany = escHtml(String(params?.clientCompany || "").slice(0, 200));
            const discount = clampNum(params?.discount, 0, 100, 0);
            const notes = escHtml(String(params?.notes || "").slice(0, 1000));
            const deliveryDays = clampNum(params?.deliveryDays, 1, 365, 7);
            const paymentTerms = escHtml(String(params?.paymentTerms || "50% al inicio, 50% a la entrega").slice(0, 300));
            const validDays = clampNum(params?.validDays, 1, 365, 30);
            const budgetDate = new Date().toLocaleDateString("es-ES", { day: "2-digit", month: "long", year: "numeric" });
            const budgetId = `SC-${Date.now().toString(36).toUpperCase()}`;
  
            interface BudgetCategory { name: string; services: typeof parsedServices; subtotal: number }
            const parsedServices = (services as Array<{name: string, quantity: number, unitPrice: number, category?: string, description?: string, recurring?: boolean, level?: string}>).map((s) => {
              const sName = escHtml(String(s.name || "Servicio").slice(0, 200));
              const qty = clampNum(s.quantity, 0, 9999, 1);
              const price = clampNum(s.unitPrice, 0, 999999, 0);
              const sub = qty * price;
              return {
                name: sName,
                qty,
                price,
                sub,
                category: String(s.category || "Servicios").slice(0, 100),
                description: escHtml(String(s.description || "").slice(0, 300)),
                recurring: !!s.recurring,
                level: escHtml(String(s.level || "").slice(0, 50)),
              };
            });
  
            const categories: Record<string, BudgetCategory> = {};
            let subtotalOneTime = 0;
            let subtotalRecurring = 0;
            for (const s of parsedServices) {
              const catKey = s.category;
              if (!categories[catKey]) { categories[catKey] = { name: catKey, services: [], subtotal: 0 }; }
              categories[catKey].services.push(s);
              categories[catKey].subtotal += s.sub;
              if (s.recurring) { subtotalRecurring += s.sub; } else { subtotalOneTime += s.sub; }
            }
  
            const totalBeforeDiscount = subtotalOneTime + subtotalRecurring;
            const discountAmount = totalBeforeDiscount * (discount / 100);
            const totalAfterDiscount = totalBeforeDiscount - discountAmount;
            const iva = totalAfterDiscount * 0.21;
            const totalFinal = totalAfterDiscount + iva;
  
            const categoryBlocks = Object.values(categories).map((cat) => `
              <div class="cat-block">
                <div class="cat-header">
                  <span class="cat-icon">${cat.name.includes("SEO") ? "🔍" : cat.name.includes("Diseño") || cat.name.includes("Theme") ? "🎨" : cat.name.includes("Producto") ? "📦" : cat.name.includes("Email") || cat.name.includes("Marketing") ? "📧" : cat.name.includes("Informe") || cat.name.includes("Análisis") || cat.name.includes("Auditoría") ? "📊" : cat.name.includes("Imagen") || cat.name.includes("Foto") ? "📸" : "⚡"}</span>
                  <span class="cat-title">${escHtml(cat.name)}</span>
                  <span class="cat-total">€${cat.subtotal.toFixed(2)}</span>
                </div>
                <table>
                  <thead><tr>
                    <th style="width:40%">Servicio</th>
                    <th style="width:15%;text-align:center">Nivel</th>
                    <th style="width:10%;text-align:center">Cant.</th>
                    <th style="width:15%;text-align:right">Precio/ud</th>
                    <th style="width:20%;text-align:right">Subtotal</th>
                  </tr></thead>
                  <tbody>
                    ${cat.services.map((s) => `<tr>
                      <td>
                        <div class="svc-name">${s.name}</div>
                        ${s.description ? `<div class="svc-desc">${s.description}</div>` : ""}
                      </td>
                      <td style="text-align:center">${s.level ? `<span class="level-badge ${s.level.includes("3") || s.level.includes("Premium") ? "level-3" : s.level.includes("2") || s.level.includes("Guía") ? "level-2" : "level-1"}">${s.level}</span>` : '<span class="level-badge level-1">Estándar</span>'}</td>
                      <td style="text-align:center">${s.qty}</td>
                      <td style="text-align:right">€${s.price.toFixed(2)}</td>
                      <td style="text-align:right;font-weight:600;color:#c8a84b">€${s.sub.toFixed(2)}${s.recurring ? '<small class="recur">/mes</small>' : ''}</td>
                    </tr>`).join("\n")}
                  </tbody>
                </table>
              </div>`).join("\n");
  
            const budgetHtml = `<!DOCTYPE html>
  <html lang="es"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
  <title>Presupuesto ${budgetId} — Shopy Crafter</title>
  <style>
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&display=swap');
  *{margin:0;padding:0;box-sizing:border-box}
  body{font-family:'Inter',sans-serif;background:#08080e;color:#e0e0e0}
  .budget-doc{max-width:900px;margin:0 auto;background:#0a0a14}
  .doc-header{padding:48px 56px 40px;background:linear-gradient(135deg,#0c0c1a 0%,#141428 50%,#0c0c1a 100%);border-bottom:3px solid #c8a84b;position:relative;overflow:hidden}
  .doc-header::before{content:'';position:absolute;top:-60px;right:-60px;width:200px;height:200px;background:radial-gradient(circle,rgba(200,168,75,0.08) 0%,transparent 70%);border-radius:50%}
  .doc-header::after{content:'';position:absolute;bottom:-40px;left:-40px;width:150px;height:150px;background:radial-gradient(circle,rgba(200,168,75,0.05) 0%,transparent 70%);border-radius:50%}
  .brand-row{display:flex;justify-content:space-between;align-items:flex-start;position:relative;z-index:1}
  .brand-logo{font-size:32px;font-weight:800;color:#c8a84b;letter-spacing:-1px}
  .brand-logo span{color:#ffffff;font-weight:300}
  .brand-tag{font-size:11px;color:#8b8b9e;margin-top:4px;letter-spacing:2px;text-transform:uppercase}
  .budget-badge{background:linear-gradient(135deg,#c8a84b,#dfc06a);color:#0a0a14;padding:8px 20px;border-radius:24px;font-size:12px;font-weight:700;letter-spacing:1px}
  .doc-title{margin-top:32px;position:relative;z-index:1}
  .doc-title h1{font-size:28px;font-weight:800;color:#ffffff;letter-spacing:-0.5px}
  .doc-title .subtitle{font-size:14px;color:#8b8b9e;margin-top:6px}
  .client-grid{display:grid;grid-template-columns:1fr 1fr;gap:32px;padding:36px 56px;background:#0c0c18;border-bottom:1px solid rgba(200,168,75,0.1)}
  .client-card{background:#111120;border:1px solid rgba(200,168,75,0.1);border-radius:12px;padding:20px 24px}
  .client-card h4{font-size:10px;color:#c8a84b;text-transform:uppercase;letter-spacing:2px;margin-bottom:10px;font-weight:700}
  .client-card .field{display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px solid rgba(255,255,255,0.03);font-size:13px}
  .client-card .field:last-child{border-bottom:none}
  .client-card .label{color:#8b8b9e}
  .client-card .value{color:#e0e0e0;font-weight:500}
  .services-section{padding:36px 56px}
  .section-title{font-size:18px;font-weight:700;color:#ffffff;margin-bottom:24px;display:flex;align-items:center;gap:10px}
  .section-title::after{content:'';flex:1;height:1px;background:linear-gradient(90deg,rgba(200,168,75,0.3),transparent)}
  .cat-block{margin-bottom:28px;background:#0e0e1c;border:1px solid rgba(200,168,75,0.08);border-radius:14px;overflow:hidden}
  .cat-header{display:flex;align-items:center;gap:10px;padding:14px 20px;background:rgba(200,168,75,0.04);border-bottom:1px solid rgba(200,168,75,0.08)}
  .cat-icon{font-size:18px}
  .cat-title{font-size:14px;font-weight:700;color:#e0e0e0;flex:1}
  .cat-total{font-size:15px;font-weight:700;color:#c8a84b}
  table{width:100%;border-collapse:collapse}
  thead th{padding:10px 16px;text-align:left;color:#8b8b9e;font-size:10px;text-transform:uppercase;letter-spacing:1px;font-weight:600;border-bottom:1px solid rgba(200,168,75,0.06)}
  tbody td{padding:12px 16px;border-bottom:1px solid rgba(255,255,255,0.02);font-size:13px;color:#d0d0d8}
  tbody tr:hover td{background:rgba(200,168,75,0.02)}
  .svc-name{font-weight:600;color:#e0e0e0}
  .svc-desc{font-size:11px;color:#8b8b9e;margin-top:3px}
  .level-badge{display:inline-block;padding:2px 8px;border-radius:10px;font-size:10px;font-weight:600}
  .level-1{background:rgba(200,168,75,0.1);color:#c8a84b}
  .level-2{background:rgba(59,130,246,0.1);color:#60a5fa}
  .level-3{background:rgba(168,85,247,0.1);color:#c084fc}
  .recur{color:#8b8b9e;font-weight:400;margin-left:2px}
  .totals-section{padding:32px 56px;background:linear-gradient(135deg,#0e0e1c,#12122a);border-top:2px solid rgba(200,168,75,0.15)}
  .totals-grid{max-width:400px;margin-left:auto}
  .total-line{display:flex;justify-content:space-between;padding:8px 0;font-size:14px;color:#d0d0d8}
  .total-line.discount{color:#4ade80}
  .total-line.iva{color:#8b8b9e;font-size:13px}
  .total-line.grand{font-size:26px;font-weight:800;color:#c8a84b;padding:16px 0 0;margin-top:12px;border-top:3px solid #c8a84b}
  .savings-note{background:rgba(74,222,128,0.06);border:1px solid rgba(74,222,128,0.15);border-radius:10px;padding:12px 16px;margin-top:16px;font-size:12px;color:#4ade80;text-align:center}
  .conditions-section{padding:36px 56px;background:#0c0c18;border-top:1px solid rgba(200,168,75,0.08)}
  .cond-grid{display:grid;grid-template-columns:1fr 1fr;gap:16px}
  .cond-item{display:flex;gap:10px;padding:12px 16px;background:#111120;border-radius:10px;border:1px solid rgba(200,168,75,0.06)}
  .cond-icon{font-size:18px;flex-shrink:0}
  .cond-text{font-size:12px;color:#8b8b9e;line-height:1.5}
  .cond-text strong{color:#d0d0d8;display:block;margin-bottom:2px;font-size:12px}
  ${notes ? `.notes-box{margin-top:20px;background:rgba(200,168,75,0.04);border:1px solid rgba(200,168,75,0.1);border-radius:10px;padding:16px 20px;font-size:13px;color:#d0d0d8;line-height:1.6}` : ""}
  .cta-section{padding:36px 56px;text-align:center;background:linear-gradient(135deg,#0c0c1a,#141428)}
  .cta-box{background:linear-gradient(135deg,rgba(200,168,75,0.08),rgba(200,168,75,0.02));border:2px solid rgba(200,168,75,0.2);border-radius:16px;padding:32px;max-width:500px;margin:0 auto}
  .cta-box h3{font-size:18px;font-weight:700;color:#c8a84b;margin-bottom:8px}
  .cta-box p{font-size:13px;color:#8b8b9e;margin-bottom:16px}
  .cta-btn{display:inline-block;background:linear-gradient(135deg,#c8a84b,#dfc06a);color:#0a0a14;padding:12px 32px;border-radius:24px;font-size:14px;font-weight:700;text-decoration:none;letter-spacing:0.5px}
  .doc-footer{padding:24px 56px;background:#08080e;border-top:1px solid rgba(200,168,75,0.08);text-align:center;font-size:11px;color:#666}
  .doc-footer .brand-foot{color:#c8a84b;font-weight:600}
  @media print{body{background:white;color:#111}.budget-doc{background:white}.doc-header{background:#f8f6f0!important;border-color:#c8a84b}.doc-header::before,.doc-header::after{display:none}.brand-logo{color:#c8a84b}.brand-logo span{color:#333}.budget-badge{background:#c8a84b}.client-grid{background:#fafafa}.client-card{background:#f5f5f5;border-color:#eee}.services-section{background:white}.cat-block{background:#fafafa;border-color:#eee}.cat-header{background:#f5f5f5}.totals-section{background:#f8f6f0}thead th{color:#666;border-color:#ddd}tbody td{color:#333;border-color:#eee}.svc-name{color:#111}.total-line{color:#333}.total-line.grand{color:#c8a84b;border-color:#c8a84b}.conditions-section{background:#fafafa}.cond-item{background:#f5f5f5;border-color:#eee}.doc-footer{background:#fafafa}}
  </style></head><body>
  ${buildCoverPage({ reportTitle: `Presupuesto Profesional`, reportSubtitle: `${budgetId} — ${projectName}`, companyName: clientName, date: budgetDate, template: "prestige" })}
  <div class="budget-doc">
    <div class="doc-header">
      <div class="brand-row">
        <div>
          <div class="brand-logo">Shopy <span>Crafter</span></div>
          <div class="brand-tag">Agencia de Optimización IA para Shopify</div>
        </div>
        <div class="budget-badge">PRESUPUESTO ${budgetId}</div>
      </div>
      <div class="doc-title">
        <h1>${projectName}</h1>
        <div class="subtitle">Presupuesto personalizado · ${budgetDate} · Válido ${validDays} días</div>
      </div>
    </div>
  
    <div class="client-grid">
      <div class="client-card">
        <h4>Datos del Cliente</h4>
        <div class="field"><span class="label">Nombre</span><span class="value">${clientName}</span></div>
        ${clientCompany ? `<div class="field"><span class="label">Empresa</span><span class="value">${clientCompany}</span></div>` : ""}
        ${clientEmail ? `<div class="field"><span class="label">Email</span><span class="value">${clientEmail}</span></div>` : ""}
        ${clientPhone ? `<div class="field"><span class="label">Teléfono</span><span class="value">${clientPhone}</span></div>` : ""}
      </div>
      <div class="client-card">
        <h4>Detalles del Presupuesto</h4>
        <div class="field"><span class="label">Referencia</span><span class="value">${budgetId}</span></div>
        <div class="field"><span class="label">Fecha</span><span class="value">${budgetDate}</span></div>
        <div class="field"><span class="label">Entrega estimada</span><span class="value">${deliveryDays} días laborables</span></div>
        <div class="field"><span class="label">Validez</span><span class="value">${validDays} días</span></div>
      </div>
    </div>
  
    <div class="services-section">
      <div class="section-title">Servicios Contratados</div>
      ${categoryBlocks}
    </div>
  
    <div class="totals-section">
      <div class="section-title">Resumen Económico</div>
      <div class="totals-grid">
        ${subtotalOneTime > 0 ? `<div class="total-line"><span>Servicios puntuales</span><span>€${subtotalOneTime.toFixed(2)}</span></div>` : ''}
        ${subtotalRecurring > 0 ? `<div class="total-line"><span>Servicios recurrentes</span><span>€${subtotalRecurring.toFixed(2)}/mes</span></div>` : ''}
        ${(discount as number) > 0 ? `<div class="total-line discount"><span>Descuento especial (${discount}%)</span><span>-€${discountAmount.toFixed(2)}</span></div>` : ''}
        <div class="total-line"><span>Subtotal sin IVA</span><span>€${totalAfterDiscount.toFixed(2)}</span></div>
        <div class="total-line iva"><span>IVA (21%)</span><span>€${iva.toFixed(2)}</span></div>
        <div class="total-line grand"><span>TOTAL</span><span>€${totalFinal.toFixed(2)}</span></div>
        ${(discount as number) > 0 ? `<div class="savings-note">💰 Ahorro total aplicado: €${discountAmount.toFixed(2)}</div>` : ''}
      </div>
    </div>
  
    <div class="conditions-section">
      <div class="section-title">Condiciones</div>
      <div class="cond-grid">
        <div class="cond-item"><span class="cond-icon">💳</span><div class="cond-text"><strong>Forma de pago</strong>${paymentTerms}</div></div>
        <div class="cond-item"><span class="cond-icon">⏱️</span><div class="cond-text"><strong>Plazo de entrega</strong>${deliveryDays} días laborables desde la aceptación</div></div>
        <div class="cond-item"><span class="cond-icon">🔄</span><div class="cond-text"><strong>Revisiones incluidas</strong>1 ronda de revisiones. Adicionales: €47/hora</div></div>
        <div class="cond-item"><span class="cond-icon">📋</span><div class="cond-text"><strong>Validez</strong>Presupuesto válido durante ${validDays} días desde ${budgetDate}</div></div>
        <div class="cond-item"><span class="cond-icon">🔒</span><div class="cond-text"><strong>Confidencialidad</strong>Este documento es confidencial entre las partes</div></div>
        <div class="cond-item"><span class="cond-icon">💶</span><div class="cond-text"><strong>Moneda</strong>Todos los importes en EUR. IVA 21% incluido en total</div></div>
      </div>
      ${notes ? `<div class="notes-box"><strong style="color:#c8a84b">📝 Notas:</strong><br>${notes}</div>` : ""}
    </div>
  
    <div class="cta-section">
      <div class="cta-box">
        <h3>¿Listo para empezar?</h3>
        <p>Acepta este presupuesto para comenzar a trabajar en tu proyecto</p>
        <a class="cta-btn" href="mailto:craftershopy@gmail.com?subject=Acepto presupuesto ${budgetId}">Aceptar Presupuesto</a>
      </div>
    </div>
  
    <div class="doc-footer">
      <span class="brand-foot">Shopy Crafter</span> · shopycrafter.com · craftershopy@gmail.com<br>
      Agencia de Optimización IA para Shopify · NIF: [A completar] · © ${new Date().getFullYear()}<br>
      <span style="color:#444;font-size:10px">Documento generado automáticamente · ${budgetId}</span>
    </div>
  </div></body></html>`;
  
            const activeProjectId = params?.projectId || null;
            if (activeProjectId) {
              try {
                const baseUrl = `http://localhost:${process.env.PORT || 8080}`;
                await fetch(`${baseUrl}/api/projects/${activeProjectId}/vault/save-report`, {
                  method: "POST",
                  headers: { "Content-Type": "application/json", cookie: req.headers.cookie ?? "" },
                  body: JSON.stringify({
                    title: `Presupuesto ${budgetId} — ${clientName}`,
                    content: budgetHtml,
                    fileType: "budget",
                  }),
                });
              } catch {}
            }
  
            result = {
              budgetId,
              totalBeforeDiscount: totalBeforeDiscount.toFixed(2),
              discount: `${discount}%`,
              totalAfterDiscount: totalAfterDiscount.toFixed(2),
              iva: iva.toFixed(2),
              totalFinal: totalFinal.toFixed(2),
              html: budgetHtml,
              message: `💼 **Presupuesto ${budgetId} generado**\n\n` +
                `**Cliente:** ${clientName}${clientCompany ? ` (${clientCompany})` : ""}\n**Proyecto:** ${projectName}\n\n` +
                `| Servicio | Nivel | Cant. | Precio/ud | Subtotal |\n|---|---|---|---|---|\n` +
                parsedServices.map((s) => {
                  return `| ${s.name.replace(/[|]/g, "\\|")} | ${s.level || "Estándar"} | ${s.qty} | €${s.price.toFixed(2)} | €${s.sub.toFixed(2)}${s.recurring ? "/mes" : ""} |`;
                }).join("\n") +
                `\n\n${discount > 0 ? `🏷️ **Descuento ${discount}%:** -€${discountAmount.toFixed(2)}\n` : ''}` +
                `**Subtotal:** €${totalAfterDiscount.toFixed(2)}\n**IVA (21%):** €${iva.toFixed(2)}\n**💰 TOTAL:** €${totalFinal.toFixed(2)}\n\n` +
                `📄 Presupuesto guardado en el Vault — descargable en HTML y PDF.\n⏱️ Entrega: ${deliveryDays} días laborables · Validez: ${validDays} días`
            };
          } catch (err) { result = { error: true, message: `❌ Error generando presupuesto: ${err instanceof Error ? err.message : String(err)}` }; }
          break;
        }

        case "generate_platform_report": {
          try {
            const escHtml = (s: string) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
            const clientName = escHtml(String(params?.clientName || "Shopy Crafter").slice(0, 200));
            const reportDate = new Date().toLocaleDateString("es-ES", { day: "2-digit", month: "long", year: "numeric" });
            const reportId = `CAP-${Date.now().toString(36).toUpperCase()}`;
  
            const platformReportHtml = `<!DOCTYPE html>
  <html lang="es"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
  <title>Informe de Capacidades — Shopy Crafter</title>
  <style>
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&display=swap');
  *{margin:0;padding:0;box-sizing:border-box}
  body{font-family:'Inter',sans-serif;background:#08080e;color:#e0e0e0}
  .report{max-width:900px;margin:0 auto;background:#0a0a14}
  .r-header{padding:48px 56px;background:linear-gradient(135deg,#0c0c1a,#141428);border-bottom:3px solid #c8a84b;position:relative;overflow:hidden}
  .r-header::before{content:'';position:absolute;top:-60px;right:-60px;width:200px;height:200px;background:radial-gradient(circle,rgba(200,168,75,0.08),transparent 70%);border-radius:50%}
  .r-brand{font-size:32px;font-weight:800;color:#c8a84b;letter-spacing:-1px;position:relative;z-index:1}
  .r-brand span{color:#fff;font-weight:300}
  .r-tag{font-size:11px;color:#8b8b9e;letter-spacing:2px;text-transform:uppercase;margin-top:4px;position:relative;z-index:1}
  .r-title{margin-top:28px;position:relative;z-index:1}
  .r-title h1{font-size:26px;font-weight:800;color:#fff}
  .r-title .sub{font-size:13px;color:#8b8b9e;margin-top:6px}
  .section{padding:36px 56px;border-bottom:1px solid rgba(200,168,75,0.06)}
  .s-title{font-size:18px;font-weight:700;color:#c8a84b;margin-bottom:20px;display:flex;align-items:center;gap:10px}
  .s-title::after{content:'';flex:1;height:1px;background:linear-gradient(90deg,rgba(200,168,75,0.3),transparent)}
  .cap-grid{display:grid;grid-template-columns:1fr 1fr;gap:14px}
  .cap-card{background:#0e0e1c;border:1px solid rgba(200,168,75,0.08);border-radius:12px;padding:18px 20px;transition:border-color .2s}
  .cap-card:hover{border-color:rgba(200,168,75,0.2)}
  .cap-card .icon{font-size:22px;margin-bottom:8px}
  .cap-card h4{font-size:14px;font-weight:700;color:#e0e0e0;margin-bottom:4px}
  .cap-card p{font-size:12px;color:#8b8b9e;line-height:1.5}
  .cap-card .price{display:inline-block;margin-top:8px;background:rgba(200,168,75,0.1);color:#c8a84b;padding:3px 10px;border-radius:12px;font-size:11px;font-weight:600}
  .full-table{width:100%;border-collapse:collapse;margin-top:12px}
  .full-table thead th{padding:10px 14px;text-align:left;color:#c8a84b;font-size:10px;text-transform:uppercase;letter-spacing:1px;border-bottom:2px solid rgba(200,168,75,0.15);font-weight:700}
  .full-table tbody td{padding:10px 14px;border-bottom:1px solid rgba(255,255,255,0.02);font-size:12px;color:#d0d0d8}
  .full-table tbody tr:hover td{background:rgba(200,168,75,0.02)}
  .tier-badge{display:inline-block;padding:2px 8px;border-radius:10px;font-size:10px;font-weight:600}
  .t1{background:rgba(200,168,75,0.1);color:#c8a84b}
  .t2{background:rgba(59,130,246,0.1);color:#60a5fa}
  .t3{background:rgba(168,85,247,0.1);color:#c084fc}
  .highlight-box{background:rgba(200,168,75,0.04);border:1px solid rgba(200,168,75,0.12);border-radius:12px;padding:20px 24px;margin:16px 0}
  .highlight-box h4{color:#c8a84b;font-size:14px;margin-bottom:8px}
  .highlight-box ul{list-style:none;padding:0}
  .highlight-box li{padding:4px 0;font-size:13px;color:#d0d0d8}
  .highlight-box li::before{content:'✓ ';color:#4ade80;font-weight:700}
  .stat-row{display:grid;grid-template-columns:repeat(4,1fr);gap:14px;margin:16px 0}
  .stat-card{background:#111120;border:1px solid rgba(200,168,75,0.08);border-radius:10px;padding:16px;text-align:center}
  .stat-card .num{font-size:28px;font-weight:800;color:#c8a84b}
  .stat-card .lab{font-size:10px;color:#8b8b9e;text-transform:uppercase;letter-spacing:1px;margin-top:4px}
  .r-footer{padding:24px 56px;background:#08080e;border-top:1px solid rgba(200,168,75,0.08);text-align:center;font-size:11px;color:#666}
  @media print{body{background:white;color:#111}.report{background:white}.r-header{background:#f8f6f0!important;border-color:#c8a84b}.r-brand{color:#c8a84b}.r-brand span{color:#333}.section{background:white}.cap-card{background:#fafafa;border-color:#eee}.full-table thead th{color:#666;border-color:#ddd}.full-table tbody td{color:#333;border-color:#eee}.highlight-box{background:#f9f9f9;border-color:#ddd}.stat-card{background:#f5f5f5;border-color:#eee}}
  </style></head><body>
  ${buildCoverPage({ reportTitle: "Informe de Capacidades", reportSubtitle: "Catálogo Completo de Servicios y Herramientas IA", companyName: clientName, date: reportDate, template: "prestige" })}
  <div class="report">
    <div class="r-header">
      <div class="r-brand">Shopy <span>Crafter</span></div>
      <div class="r-tag">Agencia de Optimización IA para Shopify</div>
      <div class="r-title">
        <h1>Informe Completo de Capacidades</h1>
        <div class="sub">Todos los servicios, herramientas y precios · ${reportDate} · Ref: ${reportId}</div>
      </div>
    </div>
  
    <div class="section">
      <div class="s-title">Resumen de la Plataforma</div>
      <div class="stat-row">
        <div class="stat-card"><div class="num">130+</div><div class="lab">Acciones IA</div></div>
        <div class="stat-card"><div class="num">6</div><div class="lab">Informes Especializados</div></div>
        <div class="stat-card"><div class="num">57+</div><div class="lab">Servicios en Catálogo</div></div>
        <div class="stat-card"><div class="num">3</div><div class="lab">Niveles de Profundidad</div></div>
      </div>
      <div class="highlight-box">
        <h4>¿Qué es Shopy Crafter?</h4>
        <p style="font-size:13px;color:#d0d0d8;line-height:1.6;margin-bottom:12px">
          Shopy Crafter es una agencia de optimización IA especializada en tiendas Shopify. Combinamos inteligencia artificial avanzada (Claude AI, DALL-E 3, análisis de datos) con experiencia en eCommerce para ofrecer servicios que PRODUCEN resultados listos para usar — no solo recomendaciones.
        </p>
        <ul>
          <li>IA que produce contenido TERMINADO: textos, CSS, emails, schemas</li>
          <li>Integración directa con Shopify API para aplicar cambios al instante</li>
          <li>Informes profesionales descargables en HTML y PDF</li>
          <li>Chatbot IA con 130+ acciones especializadas</li>
          <li>Sistema de aprendizaje continuo 24/7</li>
          <li>Presupuestos automáticos con IVA español</li>
        </ul>
      </div>
    </div>
  
    <div class="section">
      <div class="s-title">🎨 Servicios de Diseño Web / Theme Shopify</div>
      <div class="cap-grid">
        <div class="cap-card"><div class="icon">🖌️</div><h4>Diseño CSS Completo del Theme</h4><p>Rediseño total del CSS/SCSS de la tienda Shopify con estilo profesional y responsive</p><div class="price">€497 — €997</div></div>
        <div class="cap-card"><div class="icon">🏠</div><h4>Rediseño Homepage</h4><p>Hero section, secciones de contenido, footer, navegación y CTA</p><div class="price">€347</div></div>
        <div class="cap-card"><div class="icon">📐</div><h4>Secciones Liquid Custom</h4><p>Diseño y desarrollo de secciones personalizadas para Shopify</p><div class="price">€97/sección</div></div>
        <div class="cap-card"><div class="icon">📱</div><h4>Responsive Fixes</h4><p>Optimización móvil/tablet completa de la tienda</p><div class="price">€147</div></div>
        <div class="cap-card"><div class="icon">📄</div><h4>Páginas Personalizadas</h4><p>About Us, FAQ, Contact, Landing pages</p><div class="price">€97/página</div></div>
        <div class="cap-card"><div class="icon">⚙️</div><h4>Configuración Theme</h4><p>Settings completos: colores, tipografía, logo, menús, footer</p><div class="price">€97</div></div>
      </div>
    </div>
  
    <div class="section">
      <div class="s-title">📦 Servicios de Productos</div>
      <table class="full-table">
        <thead><tr><th>Servicio</th><th>Descripción</th><th style="text-align:right">Precio</th></tr></thead>
        <tbody>
          <tr><td><strong>Producto completo desde cero</strong></td><td>Título SEO + descripción 800-1200 palabras + tags + categoría + variantes + 3 imágenes IA</td><td style="text-align:right;color:#c8a84b;font-weight:600">€47/ud</td></tr>
          <tr><td><strong>Rediseño TOTAL producto</strong></td><td>Título + descripción + SEO + imágenes nuevas + categoría + variantes + stock</td><td style="text-align:right;color:#c8a84b;font-weight:600">€29/ud</td></tr>
          <tr><td><strong>Rediseño PARCIAL</strong></td><td>Solo título + descripción + SEO (sin imágenes)</td><td style="text-align:right;color:#c8a84b;font-weight:600">€14.90/ud</td></tr>
          <tr><td><strong>Solo imágenes nuevas</strong></td><td>3 imágenes IA profesionales por producto</td><td style="text-align:right;color:#c8a84b;font-weight:600">€9.90/ud</td></tr>
          <tr><td><strong>Solo SEO</strong></td><td>Meta title + meta description + alt texts + tags</td><td style="text-align:right;color:#c8a84b;font-weight:600">€9.90/ud</td></tr>
          <tr><td><strong>Pack 5 Productos</strong></td><td>5 productos completos con todo incluido</td><td style="text-align:right;color:#c8a84b;font-weight:600">€197</td></tr>
          <tr><td><strong>Pack 10 Productos</strong></td><td>10 productos + SEO + copywriting + imágenes</td><td style="text-align:right;color:#c8a84b;font-weight:600">€347</td></tr>
          <tr><td><strong>Pack 20 Productos</strong></td><td>Catálogo completo profesional</td><td style="text-align:right;color:#c8a84b;font-weight:600">€697</td></tr>
          <tr><td><strong>Pack 30 Productos</strong></td><td>Catálogo enterprise completo</td><td style="text-align:right;color:#c8a84b;font-weight:600">€997</td></tr>
          <tr><td><strong>Pack 50 Productos</strong></td><td>Gran catálogo con descuento volumen</td><td style="text-align:right;color:#c8a84b;font-weight:600">€1,497</td></tr>
        </tbody>
      </table>
      <div class="highlight-box" style="margin-top:16px">
        <h4>Descuentos automáticos por volumen</h4>
        <ul>
          <li>+20 productos → 15% descuento en creación/rediseño</li>
          <li>+50 productos → 25% descuento en creación/rediseño</li>
          <li>+100 productos → 35% descuento en creación/rediseño</li>
        </ul>
      </div>
    </div>
  
    <div class="section">
      <div class="s-title">📊 Informes Especializados — 3 Niveles</div>
      <table class="full-table">
        <thead><tr><th>Informe</th><th style="text-align:center"><span class="tier-badge t1">Nivel 1</span><br>Diagnóstico</th><th style="text-align:center"><span class="tier-badge t2">Nivel 2</span><br>+ Guía Impl.</th><th style="text-align:center"><span class="tier-badge t3">Nivel 3</span><br>+ Contenido Prod.</th></tr></thead>
        <tbody>
          <tr><td><strong>Auditoría SEO Completa</strong><br><small style="color:#8b8b9e">16 criterios Semrush-level</small></td><td style="text-align:center">€197</td><td style="text-align:center;color:#60a5fa">€347</td><td style="text-align:center;color:#c084fc">€497</td></tr>
          <tr><td><strong>Auditoría Shopify 360°</strong><br><small style="color:#8b8b9e">Productos + SEO + COGS + configuración</small></td><td style="text-align:center">€197</td><td style="text-align:center;color:#60a5fa">€347</td><td style="text-align:center;color:#c084fc">€497</td></tr>
          <tr><td><strong>Informe Competidores</strong><br><small style="color:#8b8b9e">Análisis estratégico competencia</small></td><td style="text-align:center">€97</td><td style="text-align:center;color:#60a5fa">€177</td><td style="text-align:center;color:#c084fc">€247</td></tr>
          <tr><td><strong>Informe Pricing y Márgenes</strong><br><small style="color:#8b8b9e">COGS real, márgenes, precios</small></td><td style="text-align:center">€97</td><td style="text-align:center;color:#60a5fa">€177</td><td style="text-align:center;color:#c084fc">€247</td></tr>
          <tr><td><strong>Informe Inventario</strong><br><small style="color:#8b8b9e">Stock, rotación, proveedores</small></td><td style="text-align:center">€97</td><td style="text-align:center;color:#60a5fa">€177</td><td style="text-align:center;color:#c084fc">€247</td></tr>
          <tr><td><strong>Informe Consistencia Visual</strong><br><small style="color:#8b8b9e">Marca, colores, tipografía</small></td><td style="text-align:center">€97</td><td style="text-align:center;color:#60a5fa">€177</td><td style="text-align:center;color:#c084fc">€347</td></tr>
          <tr><td><strong>Informe Revenue y Crecimiento</strong><br><small style="color:#8b8b9e">Retención, email, funnels</small></td><td style="text-align:center">€127</td><td style="text-align:center;color:#60a5fa">€197</td><td style="text-align:center;color:#c084fc">€397</td></tr>
          <tr><td><strong>Informe Proyección Ventas</strong><br><small style="color:#8b8b9e">Forecast 3-6 meses</small></td><td style="text-align:center">€127</td><td style="text-align:center;color:#60a5fa">€197</td><td style="text-align:center;color:#c084fc">€247</td></tr>
        </tbody>
      </table>
      <div class="highlight-box" style="margin-top:16px">
        <h4>Packs de 6 informes completos</h4>
        <ul>
          <li>Pack 6 informes Nivel 1 (solo diagnóstico): €697 <small style="color:#4ade80">(ahorro €112)</small></li>
          <li>Pack 6 informes Nivel 2 (+ guías implementación): €1,197 <small style="color:#4ade80">(ahorro €285)</small></li>
          <li>Pack 6 informes Nivel 3 (+ contenido producido): €1,797 <small style="color:#4ade80">(ahorro €537)</small></li>
        </ul>
      </div>
    </div>
  
    <div class="section">
      <div class="s-title">📸 Servicios de Imágenes IA</div>
      <div class="cap-grid">
        <div class="cap-card"><div class="icon">🎨</div><h4>Imágenes IA por Producto</h4><p>3 imágenes profesionales (Hero, Lifestyle, Detalle) generadas con DALL-E 3</p><div class="price">€9.90/producto</div></div>
        <div class="cap-card"><div class="icon">📷</div><h4>Pack 30 Imágenes</h4><p>Sesión completa de 30 fotos profesionales IA</p><div class="price">€89</div></div>
        <div class="cap-card"><div class="icon">🌟</div><h4>Photoshoot Pro 120 imgs</h4><p>Sesión completa: 4 variantes × 30 SKUs</p><div class="price">€497</div></div>
        <div class="cap-card"><div class="icon">👗</div><h4>Virtual Try-On</h4><p>Probador virtual con modelo IA para ropa y accesorios</p><div class="price">€14.90/imagen</div></div>
        <div class="cap-card"><div class="icon">🔄</div><h4>Imágenes desde Referencia</h4><p>Mejorar/regenerar imágenes a partir de foto real del producto</p><div class="price">€14.90/imagen</div></div>
        <div class="cap-card"><div class="icon">⚡</div><h4>Generación Masiva</h4><p>Bulk: imágenes para todos los productos de una vez</p><div class="price">€9.90/producto</div></div>
      </div>
    </div>
  
    <div class="section">
      <div class="s-title">🔍 Servicios SEO y Marketing</div>
      <table class="full-table">
        <thead><tr><th>Servicio</th><th>Qué incluye</th><th style="text-align:right">Precio</th></tr></thead>
        <tbody>
          <tr><td><strong>Implementación SEO Completa</strong></td><td>Meta tags + Schema JSON-LD + keywords + alt texts para toda la tienda</td><td style="text-align:right;color:#c8a84b;font-weight:600">€147</td></tr>
          <tr><td><strong>Blog Strategy + 5 Artículos</strong></td><td>Estrategia de contenido + 5 artículos SEO optimizados</td><td style="text-align:right;color:#c8a84b;font-weight:600">€247</td></tr>
          <tr><td><strong>Keyword Intelligence Report</strong></td><td>Investigación de palabras clave con volumen y dificultad</td><td style="text-align:right;color:#c8a84b;font-weight:600">€97</td></tr>
          <tr><td><strong>Setup Google Analytics + Pixel</strong></td><td>Configuración GA4 + Meta Pixel + eventos</td><td style="text-align:right;color:#c8a84b;font-weight:600">€97</td></tr>
          <tr><td><strong>Email Marketing Setup</strong></td><td>Klaviyo + 4 flujos automáticos completos</td><td style="text-align:right;color:#c8a84b;font-weight:600">€197</td></tr>
          <tr><td><strong>30 Posts Redes Sociales</strong></td><td>Contenido profesional para Instagram/TikTok</td><td style="text-align:right;color:#c8a84b;font-weight:600">€89</td></tr>
          <tr><td><strong>Campañas Virales 360°</strong></td><td>Instagram + TikTok marketing automatizado</td><td style="text-align:right;color:#c8a84b;font-weight:600">desde €147</td></tr>
        </tbody>
      </table>
    </div>
  
    <div class="section">
      <div class="s-title">🤖 Acciones del Chatbot IA (130+)</div>
      <div class="cap-grid">
        <div class="cap-card"><div class="icon">📦</div><h4>Gestión de Productos</h4><p>Crear, editar, rediseñar, eliminar, buscar productos. Importación masiva, variantes, precios, tags, colecciones.</p></div>
        <div class="cap-card"><div class="icon">🎨</div><h4>Diseño y Theme</h4><p>Editar CSS, Liquid, secciones, settings del theme. Crear secciones custom. Auditoría de theme.</p></div>
        <div class="cap-card"><div class="icon">📊</div><h4>Análisis e Informes</h4><p>Generar auditorías, informes de competidores, pricing, proyecciones, inventario, revenue.</p></div>
        <div class="cap-card"><div class="icon">📸</div><h4>Imágenes y Media</h4><p>Generar imágenes IA, virtual try-on, bulk images, imágenes desde referencia, optimización alt texts.</p></div>
        <div class="cap-card"><div class="icon">📧</div><h4>Email Marketing</h4><p>Generar emails, newsletters, campañas, flujos automáticos, secuencias de retención.</p></div>
        <div class="cap-card"><div class="icon">💰</div><h4>Presupuestos y Pricing</h4><p>Calcular precios, generar presupuestos PDF, propuestas comerciales, auditar oferta.</p></div>
        <div class="cap-card"><div class="icon">📦</div><h4>Inventario y Ventas</h4><p>Sync stock, alertas, analytics ventas, historial clientes, informes por variante/talla/color.</p></div>
        <div class="cap-card"><div class="icon">🔍</div><h4>SEO Avanzado</h4><p>Meta tags, schemas JSON-LD, keywords, PageSpeed, análisis competencia, bulk optimize.</p></div>
        <div class="cap-card"><div class="icon">🏪</div><h4>Análisis Externo</h4><p>Analizar tiendas de competidores sin conexión Shopify. Pre-informes para captación de clientes.</p></div>
        <div class="cap-card"><div class="icon">📋</div><h4>CMS y Contenido</h4><p>Editar textos de la landing, hero, pricing, testimonios, features. Batch updates.</p></div>
      </div>
    </div>
  
    <div class="section">
      <div class="s-title">🎯 Packs Combinados</div>
      <table class="full-table">
        <thead><tr><th>Pack</th><th>Incluye</th><th style="text-align:right">Precio</th><th style="text-align:right;color:#4ade80">Ahorro</th></tr></thead>
        <tbody>
          <tr><td><strong>Pack Setup Básico</strong></td><td>Theme CSS + 5 productos + SEO</td><td style="text-align:right;color:#c8a84b;font-weight:600">€797</td><td style="text-align:right;color:#4ade80">€91</td></tr>
          <tr><td><strong>Pack Lanzamiento</strong></td><td>Theme + 10 productos + SEO + Email</td><td style="text-align:right;color:#c8a84b;font-weight:600">€1,247</td><td style="text-align:right;color:#4ade80">€184</td></tr>
          <tr><td><strong>Pack Profesional</strong></td><td>Theme + 20 prods + SEO + Email + Auditoría + Competidores</td><td style="text-align:right;color:#c8a84b;font-weight:600">€1,997</td><td style="text-align:right;color:#4ade80">€387</td></tr>
          <tr><td><strong>Pack Enterprise</strong></td><td>Theme custom + 30 prods + SEO completo + Email + Auditoría + 3 informes</td><td style="text-align:right;color:#c8a84b;font-weight:600">€2,997</td><td style="text-align:right;color:#4ade80">€594</td></tr>
        </tbody>
      </table>
    </div>
  
    <div class="section">
      <div class="s-title">⏱️ Tarifas Horarias (Servicios No Catalogados)</div>
      <table class="full-table">
        <thead><tr><th>Tipo de Trabajo</th><th>Descripción</th><th style="text-align:right">Tarifa/hora</th></tr></thead>
        <tbody>
          <tr><td><strong>Trabajo IA Automatizado</strong></td><td>Generación de contenido, imágenes, SEO con IA</td><td style="text-align:right;color:#c8a84b;font-weight:600">€47/h</td></tr>
          <tr><td><strong>Consultoría Estratégica</strong></td><td>Análisis, planificación, informes personalizados</td><td style="text-align:right;color:#c8a84b;font-weight:600">€97/h</td></tr>
          <tr><td><strong>Diseño Web/Theme</strong></td><td>CSS, Liquid, secciones, diseño visual</td><td style="text-align:right;color:#c8a84b;font-weight:600">€97/h</td></tr>
          <tr><td><strong>Desarrollo Custom</strong></td><td>APIs, integraciones, código personalizado</td><td style="text-align:right;color:#c8a84b;font-weight:600">€127/h</td></tr>
          <tr><td><strong>Dirección Creativa</strong></td><td>Branding, fotografía, vídeo, dirección artística</td><td style="text-align:right;color:#c8a84b;font-weight:600">€77/h</td></tr>
        </tbody>
      </table>
    </div>
  
    <div class="section" style="background:linear-gradient(135deg,#0c0c1a,#141428)">
      <div class="s-title">💶 Política de Precios</div>
      <div class="highlight-box">
        <h4>Información Fiscal</h4>
        <ul>
          <li>Todos los precios están expresados en EUR (€)</li>
          <li>IVA 21% (España) se añade al subtotal en todos los presupuestos</li>
          <li>Clientes fuera de la UE: posible exención IVA (intracomunitario/exportación)</li>
          <li>Forma de pago estándar: 50% al inicio, 50% a la entrega</li>
          <li>Presupuestos válidos 30 días desde la fecha de emisión</li>
          <li>Descuento fidelización -5% en proyectos superiores a €2,000</li>
          <li>Pack de 3+ informes: descuento automático -10%</li>
        </ul>
      </div>
    </div>
  
    <div class="r-footer">
      <span style="color:#c8a84b;font-weight:600">Shopy Crafter</span> · shopycrafter.com · craftershopy@gmail.com<br>
      Agencia de Optimización IA para Shopify · © ${new Date().getFullYear()}<br>
      <span style="color:#444;font-size:10px">Informe de capacidades ${reportId} · Generado el ${reportDate}</span>
    </div>
  </div></body></html>`;
  
            const activeProjectId = params?.projectId || null;
            if (activeProjectId) {
              try {
                const baseUrl = `http://localhost:${process.env.PORT || 8080}`;
                await fetch(`${baseUrl}/api/projects/${activeProjectId}/vault/save-report`, {
                  method: "POST",
                  headers: { "Content-Type": "application/json", cookie: req.headers.cookie ?? "" },
                  body: JSON.stringify({
                    title: `Informe de Capacidades — ${reportId}`,
                    content: platformReportHtml,
                    fileType: "platform_report",
                  }),
                });
              } catch {}
            }
  
            result = {
              reportId,
              html: platformReportHtml,
              message: `📋 **Informe de Capacidades de la Plataforma generado** (${reportId})\n\n` +
                `El informe incluye:\n` +
                `• 🤖 **130+ acciones del chatbot IA** documentadas\n` +
                `• 📊 **6 informes especializados** con 3 niveles de profundidad\n` +
                `• 💰 **57+ servicios** con precios reales del catálogo\n` +
                `• 📦 Packs combinados con ahorros\n` +
                `• ⏱️ Tarifas horarias para servicios custom\n` +
                `• 💶 Política de precios, IVA y descuentos\n\n` +
                `📄 Guardado en el Vault — descargable en HTML y PDF.`
            };
          } catch (err) { result = { error: true, message: `❌ Error: ${err instanceof Error ? err.message : String(err)}` }; }
          break;
        }

        case "agency_proposal": {
          const projectId = params?.projectId;
          if (!projectId) { result = { error: true, message: "❌ Falta projectId" }; break; }
          try {
            const baseUrl = `http://localhost:${process.env.PORT || 8080}`;
            const resp = await fetch(`${baseUrl}/api/agency/proposal`, {
              method: "POST", headers: { "Content-Type": "application/json", cookie: req.headers.cookie ?? "" },
              body: JSON.stringify({ projectId, clientName: params?.clientName, clientUrl: params?.clientUrl }),
            });
            const data = await resp.json() as Record<string, unknown>;
            result = { ...data, message: `📋 **Propuesta comercial generada**\n\nAnálisis completo + estrategia + presupuesto listo para presentar al cliente.` };
          } catch (err) { result = { error: true, message: `❌ Error: ${err instanceof Error ? err.message : String(err)}` }; }
          break;
        }

        case "analyze_external_store":
        case "external_pre_report": {
          const storeUrl = params?.url || params?.storeUrl || params?.shopUrl;
          const instagram = params?.instagram || params?.ig;
          const niche = params?.niche || params?.nicho;
          const storeName = params?.name || params?.storeName || params?.empresa;
          const projectId = params?.projectId ? parseInt(params.projectId) : 0;
  
          if (!storeUrl && !storeName && !instagram) {
            result = { error: true, message: "❌ Necesito al menos una URL, nombre de empresa o Instagram para investigar." };
            break;
          }
  
          let validatedUrl = storeUrl;
          if (validatedUrl) {
            try {
              const parsed = new URL(validatedUrl.startsWith("http") ? validatedUrl : `https://${validatedUrl}`);
              if (!["http:", "https:"].includes(parsed.protocol) || parsed.hostname === "localhost" || parsed.hostname.startsWith("127.") || parsed.hostname.startsWith("10.") || parsed.hostname.startsWith("192.168.") || parsed.hostname.startsWith("172.") || parsed.hostname === "0.0.0.0") {
                result = { error: true, message: "❌ URL inválida — solo se permiten URLs públicas (http/https)." };
                break;
              }
              validatedUrl = parsed.toString();
            } catch {
              result = { error: true, message: "❌ URL mal formada. Ejemplo: https://tienda.com" };
              break;
            }
          }
  
          const identifier = validatedUrl || storeName || instagram || "unknown";
          const sections: Record<string, string> = {};
          const errors: string[] = [];
  
          try {
            if (validatedUrl) {
              try {
                const { runDualPageSpeed } = await import("../../lib/pagespeed.js");
                const ps = await runDualPageSpeed(validatedUrl);
                sections.pagespeed = `📊 PageSpeed: Mobile ${ps.mobile?.performanceScore ?? "N/A"}/100, Desktop ${ps.desktop?.performanceScore ?? "N/A"}/100\n` +
                  `FCP: ${ps.mobile?.coreWebVitals?.fcp?.value ?? "?"}, LCP: ${ps.mobile?.coreWebVitals?.lcp?.value ?? "?"}, CLS: ${ps.mobile?.coreWebVitals?.cls?.value ?? "?"}\n` +
                  `Speed Index: ${ps.mobile?.coreWebVitals?.si?.value ?? "?"}`;
              } catch (e) { errors.push(`PageSpeed: ${e instanceof Error ? e.message : String(e)}`); }
            }
  
            if (validatedUrl) {
              try {
                const resp = await fetch(validatedUrl, {
                  headers: { "User-Agent": "Mozilla/5.0 (compatible; ShopyCrafter-Analyzer/1.0)" },
                  signal: AbortSignal.timeout(20_000),
                });
                const raw = await resp.text();
                const cleaned = raw.replace(/<script[\s\S]*?<\/script>/gi, "").replace(/<style[\s\S]*?<\/style>/gi, "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").slice(0, 30000);
                const titleMatch = raw.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
                const metaDescMatch = raw.match(/<meta[^>]*name=["']description["'][^>]*content=["']([^"']+)["']/i);
                sections.webContent = `🌐 Web: ${titleMatch?.[1]?.trim() ?? "Sin título"}\nMeta: ${metaDescMatch?.[1]?.trim() ?? "Sin meta descripción"}\nContenido: ${cleaned.slice(0, 15000)}`;
                const isShopify = raw.includes("cdn.shopify.com") || raw.includes("Shopify.theme") || raw.includes("myshopify");
                sections.platform = isShopify ? "🛒 Plataforma: Shopify detectado" : "🛒 Plataforma: No-Shopify (posible WooCommerce/Wix/custom)";
              } catch (e) { errors.push(`Scraping: ${e instanceof Error ? e.message : String(e)}`); }
            }
  
            const geminiInput = `${storeName || ""} ${storeUrl || ""} ${instagram ? `@${instagram}` : ""}`.trim();
            if (geminiInput) {
              try {
                const { askGeminiWithSearch } = await import("../../lib/gemini.js");
                const [brandRes, productsRes, socialRes, pricingRes] = await Promise.allSettled([
                  askGeminiWithSearch(`Complete brand overview, history, founding, team, and mission of: ${geminiInput}. Niche: ${niche || "ecommerce"}`, "brand intelligence"),
                  askGeminiWithSearch(`All products, services, catalog, and pricing of: ${geminiInput}. Include real prices found online.`, "products catalog"),
                  askGeminiWithSearch(`Social media presence, followers, engagement, and content strategy of: ${geminiInput}. Check Instagram, TikTok, Facebook, YouTube, Twitter/X.`, "social media"),
                  askGeminiWithSearch(`Pricing strategy, price range, promotions, and offers of: ${geminiInput}. Include real prices.`, "pricing"),
                ]);
                if (brandRes.status === "fulfilled") sections.brand = `🏢 Marca:\n${brandRes.value.text.slice(0, 12000)}`;
                if (productsRes.status === "fulfilled") sections.products = `📦 Productos:\n${productsRes.value.text.slice(0, 12000)}`;
                if (socialRes.status === "fulfilled") sections.social = `📱 Redes Sociales:\n${socialRes.value.text.slice(0, 8000)}`;
                if (pricingRes.status === "fulfilled") sections.pricing = `💰 Precios:\n${pricingRes.value.text.slice(0, 8000)}`;
              } catch (e) { errors.push(`Gemini research: ${e instanceof Error ? e.message : String(e)}`); }
            }
  
            const allResearch = Object.entries(sections).map(([k, v]) => `=== ${k.toUpperCase()} ===\n${v}`).join("\n\n");
            let aiSummary = "";
            try {
              aiSummary = await askClaudeWithBrain(
                projectId,
                [{ role: "user", content: `Analiza esta tienda/empresa externa y genera un informe completo.\n\nDatos recopilados:\n${allResearch}\n\nErrores de recopilación: ${errors.length > 0 ? errors.join("; ") : "Ninguno"}\n\nGenera un informe profesional con:\n1. Resumen ejecutivo\n2. Análisis de marca y posicionamiento\n3. Catálogo y estrategia de productos\n4. Análisis de precios\n5. Presencia digital y SEO\n6. Oportunidades y recomendaciones\n7. Nivel de amenaza competitiva (si aplica)` }],
                "You are Shopy Crafter, an expert e-commerce analyst. Generate a comprehensive, actionable report about this external store/business. Use ALL the data provided. Be specific with numbers and recommendations.",
                "general",
                niche ?? undefined,
                4096
              );
            } catch { aiSummary = "⚠️ No se pudo generar análisis IA. Los datos recopilados están disponibles arriba."; }
  
            const fullReport = {
              identifier,
              storeUrl: validatedUrl, instagram, niche, storeName,
              sections, errors,
              aiSummary,
              analyzedAt: new Date().toISOString(),
            };
  
            if (projectId > 0) {
              const reportContent = JSON.stringify(fullReport, null, 2);
              saveToVault({
                projectId,
                fileType: "research",
                category: "external_store_analysis",
                title: `Análisis Externo: ${storeName || storeUrl || instagram}`,
                description: `${Object.keys(sections).length} secciones analizadas, ${errors.length} errores`,
                mimeType: "application/json",
                fileSizeBytes: Buffer.from(reportContent).length,
                generatedBy: "shopybrain_external",
                content: reportContent,
                metadata: { storeUrl: validatedUrl, instagram, niche, storeName, analyzedAt: new Date().toISOString() },
              }).catch(() => {});
            }
  
            let msg = `🔍 **ANÁLISIS EXTERNO: ${storeName || validatedUrl || instagram}**\n\n`;
            if (sections.platform) msg += `${sections.platform}\n`;
            if (sections.pagespeed) msg += `\n${sections.pagespeed}\n`;
            msg += `\n📊 **Secciones analizadas:** ${Object.keys(sections).length}\n`;
            if (errors.length > 0) msg += `⚠️ **Errores menores:** ${errors.length}\n`;
            msg += `\n${aiSummary}`;
            if (projectId > 0) msg += `\n\n💾 Informe guardado en el vault del proyecto.`;
  
            result = { ...fullReport, message: msg, savedToVault: projectId > 0 };
          } catch (err) {
            result = { error: true, message: `❌ Error en análisis externo: ${err instanceof Error ? err.message : String(err)}` };
          }
          break;
        }

        case "send_restock_email": {
          const projectId = params?.projectId;
          const productId = params?.productId;
          if (!projectId || !productId) { result = { error: true, message: "❌ Falta projectId o productId" }; break; }
          try {
            const baseUrl = `http://localhost:${process.env.PORT || 8080}`;
            const resp = await fetch(`${baseUrl}/api/inventory/restock-email`, {
              method: "POST", headers: { "Content-Type": "application/json", cookie: req.headers.cookie ?? "" },
              body: JSON.stringify({
                projectId, productId,
                productTitle: params?.productTitle || "",
                currentStock: params?.currentStock || 0,
                daysRemaining: params?.daysRemaining || 7,
                supplierEmail: params?.supplierEmail || "",
              }),
            });
            const data = await resp.json() as Record<string, unknown>;
            if (!resp.ok) { result = { error: true, message: `❌ ${data.error ?? "Error generando email de restock"}` }; break; }
            result = { ...data, message: `📦 **Email de restock generado**\n\n📧 Asunto: ${data.subject}\n⚡ Urgencia: ${data.urgency}\n📊 Cantidad sugerida: ${data.suggestedQuantity} unidades\n\n${data.body}` };
          } catch (err) { result = { error: true, message: `❌ Error: ${err instanceof Error ? err.message : String(err)}` }; }
          break;
        }

        case "restock_orders": {
          const projectId = params?.projectId;
          if (!projectId) { result = { error: true, message: "❌ Falta projectId" }; break; }
          try {
            const baseUrl = `http://localhost:${process.env.PORT || 8080}`;
            const resp = await fetch(`${baseUrl}/api/inventory/restock-orders?projectId=${projectId}`, { headers: { cookie: req.headers.cookie ?? "" } });
            const orders = await resp.json() as Array<Record<string, unknown>>;
            if (!resp.ok) { result = { error: true, message: "❌ Error al consultar órdenes de restock" }; break; }
            const summary = (orders as Array<Record<string, unknown>>).map((o: Record<string, unknown>) =>
              `• ${o.productTitle} — ${o.quantitySuggested} uds, urgencia: ${o.urgency}, estado: ${o.status || "pending"}`
            ).join("\n");
            result = { orders, total: orders.length, message: `📦 **${orders.length} órdenes de restock**\n\n${summary || "(sin órdenes)"}` };
          } catch (err) { result = { error: true, message: `❌ Error: ${err instanceof Error ? err.message : String(err)}` }; }
          break;
        }

        case "generate_export": {
          const projectId = params?.projectId;
          const reportType = params?.reportType || "complete-report";
          if (!projectId) { result = { error: true, message: "❌ Falta projectId" }; break; }
          const validTypes = ["seo-audit", "product-catalog", "financial", "brand-brief", "ab-tests", "images-gallery", "competitors", "consistency", "inventory", "redesigns", "revenue", "complete-report", "shopybrain", "csv/products"];
          if (!validTypes.includes(reportType)) {
            result = { error: true, message: `❌ Tipo de reporte inválido. Tipos válidos: ${validTypes.join(", ")}` }; break;
          }
          try {
            const baseUrl = `http://localhost:${process.env.PORT || 8080}`;
            const resp = await fetch(`${baseUrl}/api/projects/${projectId}/exports/${reportType}`, { headers: { cookie: req.headers.cookie ?? "" } });
            if (!resp.ok) {
              const errData = await resp.json().catch(() => ({})) as Record<string, unknown>;
              result = { error: true, message: `❌ ${errData.error ?? "Error generando reporte"}` }; break;
            }
            const contentType = resp.headers.get("content-type") || "";
            if (contentType.includes("text/html")) {
              result = { message: `📊 **Reporte "${reportType}" generado correctamente** (HTML)\n\nEl reporte está disponible en:\n🔗 HTML: /api/projects/${projectId}/exports/${reportType}\n📄 PDF: /api/projects/${projectId}/exports/${reportType}?format=pdf\n\nPuedes verlo desde el panel de admin → Exports.` };
            } else if (contentType.includes("text/csv")) {
              result = { message: `📊 **CSV "${reportType}" generado** — disponible en /api/projects/${projectId}/exports/${reportType}` };
            } else {
              const data = await resp.json() as Record<string, unknown>;
              result = { ...data, message: `📊 **Reporte "${reportType}" generado correctamente**` };
            }
          } catch (err) { result = { error: true, message: `❌ Error: ${err instanceof Error ? err.message : String(err)}` }; }
          break;
        }

        case "run_full_audit_report": {
          const projectId = params?.projectId;
          if (!projectId) { result = { error: true, message: "❌ Falta projectId" }; break; }
          try {
            const baseUrl = `http://localhost:${process.env.PORT || 8080}`;
            const resp = await fetch(`${baseUrl}/api/projects/${projectId}/exports/run-full-audit`, {
              method: "POST", headers: { "Content-Type": "application/json", cookie: req.headers.cookie ?? "" },
            });
            if (!resp.ok) {
              const errData = await resp.json().catch(() => ({})) as Record<string, unknown>;
              result = { error: true, message: `❌ ${errData.error ?? "Error ejecutando auditoría completa"}` }; break;
            }
            result = { message: `📊 **Auditoría completa ejecutada y guardada**\n\nEl informe completo está disponible en:\n🔗 /api/projects/${projectId}/exports/complete-report\n\nIncluye: SEO, productos, financiero, competidores, inventario, A/B tests, imágenes.` };
          } catch (err) { result = { error: true, message: `❌ Error: ${err instanceof Error ? err.message : String(err)}` }; }
          break;
        }

        case "generate_ai_report": {
          const projectId = params?.projectId;
          if (!projectId) { result = { error: true, message: "❌ Falta projectId" }; break; }
          try {
            const baseUrl = `http://localhost:${process.env.PORT || 8080}`;
            const resp = await fetch(`${baseUrl}/api/projects/${projectId}/exports/generate-ai-report`, {
              method: "POST", headers: { "Content-Type": "application/json", cookie: req.headers.cookie ?? "" },
              body: JSON.stringify({ sections: params?.sections }),
            });
            if (!resp.ok) {
              const errData = await resp.json().catch(() => ({})) as Record<string, unknown>;
              result = { error: true, message: `❌ ${errData.error ?? "Error generando informe IA"}` }; break;
            }
            const contentType = resp.headers.get("content-type") || "";
            if (contentType.includes("text/html")) {
              result = { message: `🤖 **Informe IA generado**\n\nDisponible en el panel de exports.` };
            } else {
              const data = await resp.json() as Record<string, unknown>;
              result = { ...data, message: `🤖 **Informe IA generado correctamente**` };
            }
          } catch (err) { result = { error: true, message: `❌ Error: ${err instanceof Error ? err.message : String(err)}` }; }
          break;
        }

        default:
          return NOT_HANDLED;
      }
  return result;
}
