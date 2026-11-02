// Acciones del cerebro — Marca, imagen, vídeo, personajes, anuncios y tarjetas.
// Extraídas tal cual del switch de POST /shopybrain/execute-action (routes/shopybrain.ts).
/* eslint-disable @typescript-eslint/no-explicit-any */
import { db, projectsTable, productsTable, charactersTable, projectFilesTable } from "@workspace/db";
import { eq, and, desc } from "drizzle-orm";
import { shopifyRequest } from "../../lib/shopify.js";
import { learnFromOperation, askClaudeDetailed, buildBrandDnaContext } from "../../lib/claude.js";
import { cssFontName, escapeHtmlDeep, sanitizeHtml } from "../../lib/html-escape.js";
import { generateAiJson } from "../../lib/ai-json.js";
import { aiOutputErrorMessage, isAiOutputError } from "../../lib/ai-errors.js";
import { saveToVault } from "../../lib/vault.js";
import { analyzeImageForFusion } from "../../lib/fusion-studio.js";
import {
  fetchImageWithSizeLimit
} from "../../lib/shopybrain-helpers.js";

import {
  parseTemplate, isPublicUrl, brandBookSchema
} from "./shared.js";
import { NOT_HANDLED, type BrainActionCtx, type BrainActionOutcome } from "./action-context.js";

export async function runCreativeActions(ctx: BrainActionCtx): Promise<BrainActionOutcome> {
  const { req, res, action, params, resolveStripeAccountId } = ctx;
  let result: Record<string, unknown> = {};
      switch (action) {
        case "generate_brand_css": {
          const projectId = params?.projectId;
          if (!projectId || isNaN(Number(projectId))) { result = { error: true, message: "❌ Falta projectId válido (número)" }; break; }
          try {
            const { fetchBrandProfile: fbp, generateBrandCss: gbc } = await import("../../lib/brand-css-generator.js");
            const profile = await fbp(parseInt(String(projectId)));
            if (!profile) { result = { error: true, message: "❌ Proyecto no encontrado" }; break; }
            const css = gbc(profile);
            const lines = css.split("\n").length;
            result = {
              message: `🎨 **CSS personalizado generado** para ${profile.shopName || "tu marca"}\n\n` +
                `📄 **${lines} líneas** de CSS adaptado a tu ADN de marca\n` +
                `🎯 Colores: ${(profile.primaryColors || []).join(", ") || "detectados de tu tienda"}\n` +
                `🔤 Tipografía: ${profile.typographyStyle || "Inter (por defecto)"}\n\n` +
                `**Secciones incluidas:**\n` +
                `✅ Variables CSS (--brand-primary, --brand-accent, etc.)\n` +
                `✅ Header / Navegación\n` +
                `✅ Hero / Banner\n` +
                `✅ Botones CTA\n` +
                `✅ Grid y tarjetas de producto\n` +
                `✅ Página de producto\n` +
                `✅ Trust badges\n` +
                `✅ Testimonios\n` +
                `✅ FAQ\n` +
                `✅ Footer\n` +
                `✅ Newsletter\n` +
                `✅ Carrito\n` +
                `✅ Responsive mobile\n` +
                `✅ Animaciones\n\n` +
                `📥 **Descárgalo:** /api/exports/brand-css/${projectId}\n` +
                `📥 **Con IA avanzada:** /api/exports/brand-css/${projectId}?mode=ai\n` +
                `📥 **Kit completo ZIP:** /api/exports/brand-kit/${projectId}`,
            };
          } catch (err) { result = { error: true, message: `❌ Error: ${err instanceof Error ? err.message : String(err)}` }; }
          break;
        }

        case "generate_brand_kit": {
          const projectId = params?.projectId;
          if (!projectId || isNaN(Number(projectId))) { result = { error: true, message: "❌ Falta projectId válido (número)" }; break; }
          try {
            const { fetchBrandProfile: fbp } = await import("../../lib/brand-css-generator.js");
            const profile = await fbp(parseInt(String(projectId)));
            if (!profile) { result = { error: true, message: "❌ Proyecto no encontrado" }; break; }
            result = {
              message: `📋 **Brand Kit disponible** para ${profile.shopName || "tu marca"}\n\n` +
                `El Brand Kit incluye:\n` +
                `📁 **css/theme-custom.css** — CSS personalizado completo\n` +
                `📄 **guia-de-marca.html** — Manual de identidad visual\n` +
                `📄 **brand-tokens.json** — Tokens de diseño para desarrolladores\n` +
                `📁 **shopify/sections/brand-section.liquid** — Sección Liquid personalizada\n` +
                `📄 **LEEME.txt** — Instrucciones de instalación\n\n` +
                `📥 **Descargar Brand Kit básico:** /api/exports/brand-kit/${projectId}\n` +
                `📥 **Descargar Brand Kit Premium + IA:** /api/exports/brand-kit-full/${projectId}\n\n` +
                `💡 El kit Premium incluye CSS avanzado generado por IA con animaciones y efectos personalizados.`,
            };
          } catch (err) { result = { error: true, message: `❌ Error: ${err instanceof Error ? err.message : String(err)}` }; }
          break;
        }

        case "generate_brand_guide": {
          const projectId = params?.projectId;
          if (!projectId || isNaN(Number(projectId))) { result = { error: true, message: "❌ Falta projectId válido (número)" }; break; }
          try {
            const { fetchBrandProfile: fbp } = await import("../../lib/brand-css-generator.js");
            const profile = await fbp(parseInt(String(projectId)));
            if (!profile) { result = { error: true, message: "❌ Proyecto no encontrado" }; break; }
            result = {
              message: `📖 **Guía de marca disponible** para ${profile.shopName || "tu marca"}\n\n` +
                `La guía incluye:\n` +
                `🎨 Paleta de colores completa con códigos hex\n` +
                `🔤 Tipografías (títulos, cuerpo, precios) con tamaños\n` +
                `🧩 Componentes visuales (botón CTA, tarjeta producto)\n` +
                `📸 Estilo fotográfico (fondo, iluminación, temperatura)\n` +
                `🗣️ Tono de voz y personalidad de marca\n` +
                `📐 Espaciado y layout\n\n` +
                `📥 **HTML:** /api/exports/brand-guide/${projectId}\n` +
                `📥 **PDF:** /api/exports/brand-guide/${projectId}?format=pdf`,
            };
          } catch (err) { result = { error: true, message: `❌ Error: ${err instanceof Error ? err.message : String(err)}` }; }
          break;
        }

        case "generate_brand_story": {
          const projectId = params?.projectId;
          const format = (params?.format as string) || "manifesto";
          const productId = params?.productId as string | undefined;
          const language = (params?.language as string) || "es";
          if (!projectId || isNaN(Number(projectId))) { result = { error: true, message: "❌ Falta projectId válido" }; break; }
          try {
            const [proj] = await db.select().from(projectsTable).where(eq(projectsTable.id, parseInt(String(projectId))));
            if (!proj) { result = { error: true, message: "❌ Proyecto no encontrado" }; break; }
            let productContext = "";
            if (productId) {
              const [prod] = await db.select().from(productsTable)
                .where(and(eq(productsTable.projectId, parseInt(String(projectId))), eq(productsTable.shopifyProductId, String(productId))));
              if (prod) productContext = `\nPRODUCTO FOCAL: "${prod.title}" (${prod.productType || "general"})${prod.bodyHtml ? `\nDescripción: ${prod.bodyHtml.replace(/<[^>]+>/g, " ").slice(0, 400)}` : ""}`;
            }
            const brandContext = `MARCA: ${proj.name}\nNICHO: ${proj.storeNiche || "general"}\nTONO: ${proj.brandTone || "profesional"}\nAUDIENCIA: ${proj.targetAudience || "general"}${productContext}`;
            const langLabel = language === "en" ? "inglés" : language === "fr" ? "francés" : language === "pt" ? "portugués" : language === "it" ? "italiano" : language === "de" ? "alemán" : "español";
            const STORY_FORMATS: Record<string, { name: string; prompt: string }> = {
              manifesto: { name: "Brand Manifesto", prompt: `Escribe un BRAND MANIFESTO poderoso y emocional (300-400 palabras). Estructura: apertura audaz (qué creemos), el problema que resuelven, nuestra visión, nuestra promesa, llamada a la comunidad. Tono: inspirador, auténtico, memorable. Sin clichés. En ${langLabel}.` },
              founder: { name: "Historia del Fundador", prompt: `Escribe la HISTORIA DEL FUNDADOR (400-500 palabras) en formato narrativo de primera persona. Estructura: momento inicial (el problema que vivió en carne propia), el punto de inflexión, el proceso de creación, la visión de futuro. Tono: honesto, vulnerable, inspirador. En ${langLabel}.` },
              product: { name: "Historia del Producto", prompt: `Escribe la HISTORIA DEL PRODUCTO (350-450 palabras). Estructura: origen de la idea, el proceso de creación/craftsmanship, los materiales/ingredientes/tecnología que lo hacen único, el impacto en el cliente. Tono: apasionado, educativo, sensorial. En ${langLabel}.` },
              email: { name: "Email Storytelling", prompt: `Escribe una SECUENCIA DE 3 EMAILS de storytelling para bienvenida de nuevos clientes. Email 1: La historia de origen (por qué existimos). Email 2: Cómo hacemos lo que hacemos (proceso, valores, craftsmanship). Email 3: Tu primer paso con nosotros (CTA suave hacia compra). Cada email: asunto atractivo, 200-250 palabras, tono conversacional. En ${langLabel}.` },
              social: { name: "Pack Contenido Social", prompt: `Crea un PACK DE 6 POSTS para redes sociales con storytelling de marca. 2x Instagram caption larga (historias), 2x Twitter/X thread (7 tweets c/u), 2x LinkedIn post (reflexión de negocio). Cada formato con hook, historia, CTA. Total: pack completo listo para usar. En ${langLabel}.` },
              press: { name: "Nota de Prensa", prompt: `Escribe una NOTA DE PRENSA profesional (500-600 palabras) con estructura periodística: titular impactante, subtítulo, primer párrafo (quién/qué/cuándo/dónde/por qué), historia de la marca en 3 párrafos, cita del fundador, datos de contacto ficticios. Tono: objetivo, periodístico, informativo. En ${langLabel}.` },
            };
            const fmt = STORY_FORMATS[format] || STORY_FORMATS.manifesto;
            const { askClaudeWithBrain: acwb } = await import("../../lib/claude.js");
            const storyContent = await acwb(parseInt(String(projectId)), [{ role: "user", content: `${brandContext}\n\n${fmt.prompt}` }], `Eres un copywriter de marca de élite especializado en storytelling auténtico. Tu trabajo es crear narrativas que conecten emocionalmente, no textos de marketing genéricos.`, "brand_analysis", proj.storeNiche ?? undefined, 4000);
            result = {
              message: `✍️ **${fmt.name}** generado para **${proj.name}**\n\n---\n\n${storyContent}\n\n---\n\n💡 *Disponible como DOCX descargable — usa \`generate_office_document\` con el contenido anterior para crear el archivo.*`,
              storyContent,
              format,
              brandName: proj.name,
            };
            // Antes: learnFromOperation(projectId, texto, tipo), firma inexistente → TypeError
            // después de generar la historia, y el usuario veía "❌ Error".
            learnFromOperation({
              operationType: "brand_story",
              niche: proj.storeNiche ?? undefined,
              title: `Brand Story generado: ${fmt.name} en ${langLabel}`,
              content: storyContent.slice(0, 4000),
              sourceProjectId: parseInt(String(projectId)),
            });
          } catch (err) { result = { error: true, message: `❌ Error: ${err instanceof Error ? err.message : String(err)}` }; }
          break;
        }

        case "run_universal_generator": {
          const projectId = params?.projectId;
          const generatorType = params?.generatorType;
          if (!projectId || isNaN(Number(projectId))) { result = { error: true, message: "❌ Falta projectId válido" }; break; }
          if (!generatorType) {
            result = {
              message: `✨ **Generador Universal de Shopy Crafter** — 41 herramientas IA\n\n` +
                `Dime qué tipo de contenido quieres generar:\n\n` +
                `🔍 **SEO**: seo-audit, seo-metas, seo-schemas, seo-alt-texts, seo-keywords, blog-strategy, blog-post\n` +
                `📊 **Informes**: complete-report, financial-report, inventory-report, consistency-report, revenue-analysis\n` +
                `🎨 **Marca**: brand-css, brand-css-ai, brand-guide, brand-kit, brand-kit-premium, photo-brief, social-kit\n` +
                `💰 **Finanzas**: pricing-optimal, margin-waterfall, financial-forecast\n` +
                `🕵️ **Competencia**: competitor-scan, market-research\n` +
                `✍️ **Contenido**: product-redesign, email-templates, email-flow, social-posts, landing-design\n` +
                `📦 **Datos**: data-csv, data-xlsx, data-json, data-zip\n` +
                `💼 **Agencia**: agency-proposal, agency-budget\n` +
                `🌍 **Externo**: external-audit (+ url)\n\n` +
                `📱 **O ve a la página del Generador:** /projects/${projectId}/generator`,
            };
            break;
          }
          try {
            const { runGeneratorDirect } = await import("../generator.js");
            const genData = await runGeneratorDirect(generatorType, {
              projectId: parseInt(String(projectId)),
              url: params?.url,
              format: "html",
              template: parseTemplate(params?.template),
              extraParams: {},
            });
            result = {
              message: `✅ ${genData.message || "Contenido generado"}\n\n` +
                (genData.vaultSaved ? `🗄️ Guardado en Vault (ID: ${genData.vaultId})\n` : "") +
                (genData.brainLearned ? `🧠 ShopyBrain ha aprendido de esta generación\n` : "") +
                (genData.redirect ? `📥 **Descargar:** ${genData.redirect}\n` : "") +
                (genData.downloadUrl ? `📥 **Descargar:** ${genData.downloadUrl}\n` : "") +
                (genData.vaultId ? `📥 **Desde Vault:** /api/generator/download/${genData.vaultId}\n` : ""),
            };
          } catch (err) { result = { error: true, message: `❌ Error: ${err instanceof Error ? err.message : String(err)}` }; }
          break;
        }

        case "analyze_web_design": {
          const projectId = params?.projectId;
          const targetUrl = params?.url;
          if (!projectId || isNaN(Number(projectId))) { result = { error: true, message: "❌ Falta projectId válido" }; break; }
          if (!targetUrl) {
            result = {
              message: `🔬 **Lab Web — Análisis de Diseño Profesional**\n\n` +
                `Necesito la URL de la página web que quieres analizar.\n\n` +
                `Escribe la URL completa (ej: https://ejemplo.com) y haré:\n` +
                `• Extracción del HTML + CSS reales\n` +
                `• Análisis PageSpeed (móvil + escritorio)\n` +
                `• Análisis IA profundo del diseño\n` +
                `• CSS mejorado listo para copiar/pegar\n` +
                `• Informe profesional descargable\n\n` +
                `📱 **O ve directamente a:** /projects/${projectId}/web-lab`,
            };
            break;
          }
          try {
            const { runWebLabAnalysis } = await import("../web-lab.js");
            const labResult = await runWebLabAnalysis(
              String(targetUrl),
              parseInt(String(projectId)),
              parseTemplate(params?.template)
            );
            const a = labResult.analysis;
            const cats = a.categories;
            result = {
              message: `🔬 **Lab Web — Análisis Completado**\n\n` +
                `🎯 **Score General: ${a.overallScore}/100**\n\n` +
                `📊 **Categorías:**\n` +
                `• 🎨 Diseño: ${cats.design}/100\n` +
                `• 🖱️ UX: ${cats.ux}/100\n` +
                `• 📱 Responsive: ${cats.responsive}/100\n` +
                `• ♿ Accesibilidad: ${cats.accessibility}/100\n` +
                `• ⚡ Performance: ${cats.performance}/100\n` +
                `• 🎯 Consistencia: ${cats.consistency}/100\n\n` +
                `📋 **Resumen:** ${a.summary}\n\n` +
                `⚠️ **Issues encontrados:** ${a.issues?.length || 0}\n\n` +
                `📥 **Descargas disponibles:**\n` +
                (labResult.vaultIds.report ? `• 📄 Informe: /api/web-lab/download-report/${labResult.vaultIds.report}\n` : "") +
                (labResult.vaultIds.css ? `• 💻 CSS mejorado: /api/web-lab/download-css/${labResult.vaultIds.css}\n` : "") +
                (labResult.vaultIds.html ? `• 🏗️ HTML mejorado: /api/web-lab/download-html/${labResult.vaultIds.html}\n` : "") +
                (labResult.vaultIds.report ? `• 📦 Pack completo: /api/web-lab/download-pack/${labResult.vaultIds.report}\n` : "") +
                `\n🗄️ Todo guardado en Vault | 🧠 ShopyBrain ha aprendido del análisis`,
            };
          } catch (err) {
            result = { error: true, message: `❌ Error en Lab Web: ${err instanceof Error ? err.message : String(err)}` };
          }
          break;
        }

        case "fusion_analyze": {
          const imageUrl = params?.imageUrl;
          if (!imageUrl) { result = { error: true, message: "❌ Falta imageUrl — proporciona la URL de la imagen a analizar" }; break; }
          if (!isPublicUrl(String(imageUrl))) { result = { error: true, message: "❌ La URL debe ser pública (https). No se permiten URLs internas." }; break; }
          try {
            // FIX CRIT-4: límite de 15MB con check de content-length para prevenir DoS
            const { buffer: imgBuf, mimeType } = await fetchImageWithSizeLimit(String(imageUrl), 15 * 1024 * 1024);
            const analysis = await analyzeImageForFusion(imgBuf.toString("base64"), mimeType);
            const colorList = analysis.colors.palette.map(c => `${c.name} (${c.hex}) ${c.percentage}`).join(", ");
            const textureList = analysis.textures.map(t => `${t.material} (${t.finish})`).join(", ");
            result = {
              message: `🎨 **Fusion Studio — Análisis Completado**\n\n` +
                `📷 **Imagen analizada:** ${imageUrl}\n\n` +
                `🎨 **Colores:** ${colorList}\n` +
                `🧵 **Texturas:** ${textureList}\n` +
                `🏷️ **Categoría:** ${analysis.product.category} / ${analysis.product.subcategory}\n` +
                `📝 **Estilo:** ${analysis.product.brandStyle}\n` +
                `👥 **Audiencia:** ${analysis.product.targetAudience}\n` +
                `💰 **Rango precio:** ${analysis.product.priceRange}\n` +
                `📐 **Composición:** ${analysis.composition.layout} · ${analysis.composition.lighting}\n\n` +
                `📦 **Sugerencia producto:**\n` +
                `• Título: ${analysis.productGeneration.suggestedTitle}\n` +
                `• Precio: ${analysis.productGeneration.suggestedPrice}\n` +
                `• Tags: ${analysis.productGeneration.suggestedTags.join(", ")}`,
            };
          } catch (err) {
            result = { error: true, message: `❌ Error en Fusion Studio: ${err instanceof Error ? err.message : String(err)}` };
          }
          break;
        }

        case "fusion_create_product": {
          const projectId = params?.projectId;
          const imageUrl = params?.imageUrl;
          if (!projectId || isNaN(Number(projectId))) { result = { error: true, message: "❌ Falta projectId válido" }; break; }
          if (!imageUrl) { result = { error: true, message: "❌ Falta imageUrl — proporciona la URL de la imagen" }; break; }
          if (!isPublicUrl(String(imageUrl))) { result = { error: true, message: "❌ La URL debe ser pública (https). No se permiten URLs internas." }; break; }
          try {
            // FIX CRIT-4: límite de 15MB con check de content-length para prevenir DoS
            const { buffer: imgBuf, mimeType: imgMime } = await fetchImageWithSizeLimit(String(imageUrl), 15 * 1024 * 1024);
            const analysis = await analyzeImageForFusion(imgBuf.toString("base64"), imgMime);
            const title = params?.title || analysis.productGeneration.suggestedTitle || "Producto Fusion";
            const price = params?.price || analysis.productGeneration.suggestedPrice || "29.99";
            const productData = {
              product: {
                title: String(title),
                body_html: analysis.productGeneration.suggestedDescription || "Producto creado con Fusion Studio",
                vendor: "Shopy Crafter",
                product_type: analysis.product.category || "General",
                tags: (analysis.productGeneration.suggestedTags || []).join(", "),
                status: "draft",
                variants: [{ price: String(price), inventory_management: "shopify" }],
                images: [{ src: String(imageUrl) }],
              }
            };
            const [project] = await db.select().from(projectsTable).where(eq(projectsTable.id, parseInt(String(projectId))));
            if (!project) { result = { error: true, message: "❌ Proyecto no encontrado" }; break; }
            const created = await shopifyRequest<{ product: { id: number; title: string; handle: string } }>(
              parseInt(String(projectId)), project.shopDomain, "/products.json",
              { method: "POST", body: JSON.stringify(productData) }
            );
            result = {
              message: `🎨✅ **Producto creado con Fusion Studio**\n\n` +
                `📦 **${created.product.title}** (ID: ${created.product.id})\n` +
                `💰 Precio: ${price}€\n` +
                `🏷️ Tags: ${(analysis.productGeneration.suggestedTags || []).join(", ")}\n` +
                `📊 Estado: Borrador\n\n` +
                `🔗 Handle: ${created.product.handle}\n` +
                `💡 El producto está en borrador. Publícalo cuando esté listo.`,
            };
          } catch (err) {
            result = { error: true, message: `❌ Error creando producto con Fusion: ${err instanceof Error ? err.message : String(err)}` };
          }
          break;
        }

        case "create_montage_video": {
          // Crea un vídeo conjunto (montaje cinematográfico) concatenando varios
          // clips ya existentes en el vault del proyecto, con voz y música opcionales
          // y transiciones profesionales entre escenas. Reutiliza /fs-pro/concat.
          const projectId = params?.projectId;
          if (!projectId || isNaN(Number(projectId))) {
            result = { error: true, message: "❌ Falta projectId válido" }; break;
          }
          // Validación: enteros positivos únicos, entre 2 y 32 clips (anuncios largos)
          const rawIds = Array.isArray(params?.clipVaultIds) ? params!.clipVaultIds : [];
          const clipVaultIds = Array.from(new Set(
            rawIds.map((x: any) => Number(x)).filter((x: number) => Number.isInteger(x) && x > 0)
          )) as number[];
          if (clipVaultIds.length < 2 || clipVaultIds.length > 32) {
            result = { error: true, message: "❌ Necesitas entre 2 y 32 clipVaultIds (enteros positivos únicos)" }; break;
          }
          const ALLOWED_TRANSITIONS = new Set([
            "hard_cut","cross_dissolve","fade_to_black","white_flash","dissolve_grain",
            "hand_swipe_l","hand_swipe_r","slide_up","slide_down","zoom_punch",
            "iris_open","iris_close","smoke_blur","glitch_pixel","splash_circle",
            "diagonal_tl","cover_left","reveal_right",
          ]);
          const transitionPreset = ALLOWED_TRANSITIONS.has(String(params?.transitionPreset))
            ? String(params!.transitionPreset)
            : "cross_dissolve";
          const clamp01to2 = (v: any, def: number) => {
            const n = Number(v);
            if (!Number.isFinite(n)) return def;
            return Math.max(0, Math.min(2, n));
          };
          const voiceVolume = clamp01to2(params?.voiceVolume, 1.0);
          const musicVolume = clamp01to2(params?.musicVolume, 0.18);
          const toPosInt = (v: any) => {
            const n = Number(v);
            return Number.isInteger(n) && n > 0 ? n : undefined;
          };
          const voiceVaultId = toPosInt(params?.voiceVaultId);
          const musicVaultId = toPosInt(params?.musicVaultId);
          try {
            const [project] = await db.select().from(projectsTable).where(eq(projectsTable.id, parseInt(String(projectId))));
            if (!project) { result = { error: true, message: "❌ Proyecto no encontrado" }; break; }
            // SECURITY: URL interna fija (NUNCA host del request → evita SSRF + cookie leak)
            const internalPort = process.env.PORT || 8080;
            const cookieHeader = (req.headers.cookie as string) || "";
            const concatRes = await fetch(`http://localhost:${internalPort}/api/fs-pro/concat`, {
              method: "POST",
              headers: { "Content-Type": "application/json", Cookie: cookieHeader },
              body: JSON.stringify({
                projectId: Number(projectId),
                videoVaultIds: clipVaultIds,
                voiceVaultId, musicVaultId,
                transitionPreset,
                voiceVolume, musicVolume,
                width: 1920, height: 1080, fps: 30,
              }),
              signal: AbortSignal.timeout(4 * 60 * 1000), // 4 min hard cap
            });
            const concatData = await concatRes.json() as { success?: boolean; vaultId?: number; sizeBytes?: number; clipsCount?: number; error?: string };
            if (!concatRes.ok || !concatData.success || !concatData.vaultId) {
              result = { error: true, message: `❌ Error montando vídeo: ${concatData.error || `HTTP ${concatRes.status}`}` };
              break;
            }
            const sizeMB = ((concatData.sizeBytes || 0) / 1024 / 1024).toFixed(2);
            result = {
              vaultId: concatData.vaultId,
              projectId: Number(projectId),
              videoUrl: `/api/projects/${Number(projectId)}/vault/${concatData.vaultId}/download`,
              clipsCount: concatData.clipsCount,
              sizeBytes: concatData.sizeBytes,
              message: `🎬✅ **Vídeo montaje creado**\n\n` +
                `📦 Vault ID: **${concatData.vaultId}**\n` +
                `🎞️ Clips concatenados: ${concatData.clipsCount}\n` +
                `🎚️ Transición: ${transitionPreset}\n` +
                `🎙️ Voz: ${voiceVaultId ? `vault ${voiceVaultId}` : "sin voz"}\n` +
                `🎵 Música: ${musicVaultId ? `vault ${musicVaultId} (volumen ${musicVolume})` : "sin música"}\n` +
                `💾 Tamaño: ${sizeMB} MB\n\n` +
                `🔗 Disponible en el vault del proyecto, sección Fusion Studio Pro.`,
            };
          } catch (err) {
            result = { error: true, message: `❌ Error creando montaje: ${err instanceof Error ? err.message : String(err)}` };
          }
          break;
        }

        case "list_vault_videos": {
          const projectId = params?.projectId;
          if (!projectId || isNaN(Number(projectId))) {
            result = { error: true, message: "❌ Falta projectId válido" }; break;
          }
          try {
            const rows = await db
              .select({
                id: projectFilesTable.id,
                title: projectFilesTable.title,
                mimeType: projectFilesTable.mimeType,
              })
              .from(projectFilesTable)
              .where(
                and(
                  eq(projectFilesTable.projectId, Number(projectId)),
                )
              );
            const videos = rows.filter(r =>
              r.mimeType && (r.mimeType.startsWith("video/") || r.mimeType === "application/octet-stream")
            );
            if (videos.length === 0) {
              result = {
                videos: [],
                message: `📭 No hay vídeos en la bóveda del proyecto ${projectId} todavía.\n\n` +
                  `Para añadir vídeos:\n` +
                  `1️⃣ Ve a **Fusion Studio Pro → Video Studio** (exporta un montaje)\n` +
                  `2️⃣ O pídeme **generar un vídeo IA** con generate_video\n` +
                  `3️⃣ O **sube tus propios clips** desde Video Studio (botón "+")`,
              };
            } else {
              const list = videos.map(v =>
                `• **${v.title || `Clip sin título`}** — Vault ID: \`${v.id}\` (${v.mimeType || "video"})`
              ).join("\n");
              result = {
                videos,
                count: videos.length,
                message: `🎬 **${videos.length} vídeo(s) en la bóveda** del proyecto ${projectId}:\n\n${list}\n\n` +
                  `💡 Para concatenarlos dime: *"Monta los clips con IDs X, Y, Z"*\n` +
                  `📥 Descarga: \`/api/projects/${projectId}/vault/<vaultId>/download\``,
              };
            }
          } catch (err) {
            result = { error: true, message: `❌ Error listando vídeos: ${err instanceof Error ? err.message : String(err)}` };
          }
          break;
        }

        case "trim_video": {
          const { projectId, vaultId, startSec, endSec, title } = params || {};
          if (!projectId || !vaultId || startSec == null) {
            result = { error: true, message: "❌ Necesito: projectId, vaultId, startSec (y opcionalmente endSec)" }; break;
          }
          try {
            const internalPort = process.env.PORT || 8080;
            const r = await fetch(`http://localhost:${internalPort}/api/fs-pro/trim`, {
              method: "POST", headers: { "Content-Type": "application/json", Cookie: (req.headers.cookie as string) || "" },
              body: JSON.stringify({ projectId: Number(projectId), vaultId: Number(vaultId), startSec: Number(startSec), endSec: endSec != null ? Number(endSec) : undefined, title }),
              signal: AbortSignal.timeout(3 * 60_000),
            });
            const d = await r.json() as any;
            if (!r.ok || !d.success) { result = { error: true, message: `❌ Error recortando: ${d.error || `HTTP ${r.status}`}` }; break; }
            result = {
              vaultId: d.vaultId, projectId: Number(projectId),
              videoUrl: `/api/projects/${Number(projectId)}/vault/${d.vaultId}/download`,
              message: `✂️✅ **Clip recortado**\n\n` +
                `⏱️ Rango: ${startSec}s → ${endSec != null ? `${endSec}s` : "final"}\n` +
                `📦 Vault ID: \`${d.vaultId}\`\n💾 ${((d.sizeBytes||0)/1024/1024).toFixed(2)} MB\n\n` +
                `🔗 Descarga: \`/api/projects/${Number(projectId)}/vault/${d.vaultId}/download\``,
            };
          } catch (err) { result = { error: true, message: `❌ Error: ${err instanceof Error ? err.message : String(err)}` }; }
          break;
        }

        case "trim_concat": {
          const { projectId, segments, script, voiceId, musicVaultId, transitionPreset, title } = params || {};
          if (!projectId || !Array.isArray(segments) || segments.length < 1) {
            result = { error: true, message: "❌ Necesito projectId y segments:[{vaultId,startSec,endSec}] (mín 1 segmento)" }; break;
          }
          try {
            const internalPort = process.env.PORT || 8080;
            const r = await fetch(`http://localhost:${internalPort}/api/fs-pro/trim-concat`, {
              method: "POST", headers: { "Content-Type": "application/json", Cookie: (req.headers.cookie as string) || "" },
              body: JSON.stringify({ projectId: Number(projectId), segments, script, voiceId, musicVaultId, transitionPreset, title }),
              signal: AbortSignal.timeout(8 * 60_000),
            });
            const d = await r.json() as any;
            if (!r.ok || !d.success) { result = { error: true, message: `❌ Error en montaje: ${d.error || `HTTP ${r.status}`}` }; break; }
            const segs = segments.map((s: any) => `  • Vault ${s.vaultId}: ${s.startSec}s → ${s.endSec}s`).join("\n");
            result = {
              vaultId: d.vaultId, projectId: Number(projectId),
              videoUrl: `/api/projects/${Number(projectId)}/vault/${d.vaultId}/download`,
              message: `🎬✅ **Montaje inteligente creado**\n\n` +
                `📋 Fragmentos:\n${segs}\n` +
                `⏱️ Duración total: ${d.totalSec?.toFixed(1)}s\n` +
                `${script ? `🎙️ Narración IA: sincronizada exactamente\n` : ""}` +
                `📦 Vault ID: \`${d.vaultId}\`\n💾 ${((d.sizeBytes||0)/1024/1024).toFixed(2)} MB\n\n` +
                `🔗 \`/api/projects/${Number(projectId)}/vault/${d.vaultId}/download\``,
            };
          } catch (err) { result = { error: true, message: `❌ Error: ${err instanceof Error ? err.message : String(err)}` }; }
          break;
        }

        case "extract_audio": {
          const { projectId, vaultId, title } = params || {};
          if (!projectId || !vaultId) { result = { error: true, message: "❌ Necesito projectId y vaultId" }; break; }
          try {
            const internalPort = process.env.PORT || 8080;
            const r = await fetch(`http://localhost:${internalPort}/api/fs-pro/extract-audio`, {
              method: "POST", headers: { "Content-Type": "application/json", Cookie: (req.headers.cookie as string) || "" },
              body: JSON.stringify({ projectId: Number(projectId), vaultId: Number(vaultId), title }),
              signal: AbortSignal.timeout(3 * 60_000),
            });
            const d = await r.json() as any;
            if (!r.ok || !d.success) { result = { error: true, message: `❌ Error extrayendo audio: ${d.error || `HTTP ${r.status}`}` }; break; }
            result = {
              vaultId: d.vaultId, projectId: Number(projectId),
              audioUrl: `/api/projects/${Number(projectId)}/vault/${d.vaultId}/download`,
              message: `🎵✅ **Audio extraído como MP3**\n\n` +
                `📦 Vault ID: \`${d.vaultId}\`\n💾 ${((d.sizeBytes||0)/1024/1024).toFixed(2)} MB\n\n` +
                `🔗 \`/api/projects/${Number(projectId)}/vault/${d.vaultId}/download\`\n\n` +
                `💡 Puedes usar este audio en create_montage_video como voiceVaultId o musicVaultId`,
            };
          } catch (err) { result = { error: true, message: `❌ Error: ${err instanceof Error ? err.message : String(err)}` }; }
          break;
        }

        case "strip_audio": {
          const { projectId, vaultIds, title } = params || {};
          const ids = Array.isArray(vaultIds) ? vaultIds : (vaultIds ? [vaultIds] : []);
          if (!projectId || ids.length === 0) { result = { error: true, message: "❌ Necesito projectId y vaultIds (array de IDs)" }; break; }
          try {
            const internalPort = process.env.PORT || 8080;
            const r = await fetch(`http://localhost:${internalPort}/api/fs-pro/strip-audio`, {
              method: "POST", headers: { "Content-Type": "application/json", Cookie: (req.headers.cookie as string) || "" },
              body: JSON.stringify({ projectId: Number(projectId), vaultIds: ids.map(Number), title }),
              signal: AbortSignal.timeout(3 * 60_000),
            });
            const d = await r.json() as any;
            if (!r.ok || !d.success) { result = { error: true, message: `❌ Error: ${d.error || `HTTP ${r.status}`}` }; break; }
            const list = (d.results||[]).map((x: any) => `  • Vault ${x.vaultId} → nuevo Vault \`${x.newVaultId}\``).join("\n");
            result = {
              results: d.results, projectId: Number(projectId),
              message: `🔇✅ **Audio eliminado de ${d.count} clip(s)**\n\n${list}\n\n💡 Los clips originales siguen intactos en la bóveda.`,
            };
          } catch (err) { result = { error: true, message: `❌ Error: ${err instanceof Error ? err.message : String(err)}` }; }
          break;
        }

        case "add_voice_to_video": {
          const { projectId, vaultId, script, voiceId, musicVaultId, musicVolume, title } = params || {};
          if (!projectId || !vaultId || !script?.trim()) {
            result = { error: true, message: "❌ Necesito projectId, vaultId y script (texto de la narración)" }; break;
          }
          try {
            const internalPort = process.env.PORT || 8080;
            const r = await fetch(`http://localhost:${internalPort}/api/fs-pro/add-voice`, {
              method: "POST", headers: { "Content-Type": "application/json", Cookie: (req.headers.cookie as string) || "" },
              body: JSON.stringify({ projectId: Number(projectId), vaultId: Number(vaultId), script, voiceId, musicVaultId, musicVolume, title }),
              signal: AbortSignal.timeout(5 * 60_000),
            });
            const d = await r.json() as any;
            if (!r.ok || !d.success) { result = { error: true, message: `❌ Error: ${d.error || `HTTP ${r.status}`}` }; break; }
            result = {
              vaultId: d.vaultId, projectId: Number(projectId),
              videoUrl: `/api/projects/${Number(projectId)}/vault/${d.vaultId}/download`,
              message: `🎙️✅ **Voz sincronizada al vídeo**\n\n` +
                `📝 Script: "${String(script).slice(0, 80)}..."\n` +
                `🎵 Música: ${musicVaultId ? `vault ${musicVaultId}` : "sin música"}\n` +
                `📦 Vault ID: \`${d.vaultId}\`\n💾 ${((d.sizeBytes||0)/1024/1024).toFixed(2)} MB\n\n` +
                `🔗 \`/api/projects/${Number(projectId)}/vault/${d.vaultId}/download\``,
            };
          } catch (err) { result = { error: true, message: `❌ Error: ${err instanceof Error ? err.message : String(err)}` }; }
          break;
        }

        case "burn_text_video": {
          const { projectId, vaultId, mode, text, srt, style, startSec, endSec, title } = params || {};
          if (!projectId || !vaultId || !mode) {
            result = { error: true, message: "❌ Necesito projectId, vaultId y mode (text|subtitles|auto-subtitles|watermark|tiktok-caption|intro|outro)" }; break;
          }
          if (mode === "auto-subtitles") {
            // No extra params needed — inform user
          } else if (mode === "subtitles" && !srt) {
            result = { error: true, message: "❌ mode=subtitles requiere el parámetro srt (texto en formato SRT)" }; break;
          } else if (["text","watermark","tiktok-caption","intro","outro"].includes(mode) && !text) {
            result = { error: true, message: `❌ mode=${mode} requiere el parámetro text (el texto a mostrar)` }; break;
          }
          try {
            const internalPort = process.env.PORT || 8080;
            const r = await fetch(`http://localhost:${internalPort}/api/fs-pro/burn-text`, {
              method: "POST", headers: { "Content-Type": "application/json", Cookie: (req.headers.cookie as string) || "" },
              body: JSON.stringify({ projectId: Number(projectId), vaultId: Number(vaultId), mode, text, srt, style, startSec, endSec, title }),
              signal: AbortSignal.timeout(5 * 60_000),
            });
            const d = await r.json() as any;
            if (!r.ok || !d.success) { result = { error: true, message: `❌ Error: ${d.error || `HTTP ${r.status}`}` }; break; }
            const modeLabels: Record<string,string> = {
              "text":"Texto superpuesto","subtitles":"Subtítulos quemados","auto-subtitles":"Subtítulos automáticos IA",
              "watermark":"Marca de agua","tiktok-caption":"Caption TikTok","intro":"Intro","outro":"Outro",
            };
            result = {
              vaultId: d.vaultId, projectId: Number(projectId),
              videoUrl: `/api/projects/${Number(projectId)}/vault/${d.vaultId}/download`,
              message: `📝✅ **${modeLabels[mode] || mode} aplicado**\n\n` +
                `${text ? `✏️ Texto: "${text.slice(0,60)}${text.length>60?"...":""}"\n` : ""}` +
                `📦 Vault ID: \`${d.vaultId}\`\n💾 ${((d.sizeBytes||0)/1024/1024).toFixed(2)} MB\n\n` +
                `🔗 \`/api/projects/${Number(projectId)}/vault/${d.vaultId}/download\``,
            };
          } catch (err) { result = { error: true, message: `❌ Error: ${err instanceof Error ? err.message : String(err)}` }; }
          break;
        }

        case "face_swap_video": {
          const { projectId, videoVaultId, faceImageVaultId, faceImageUrl, title } = params || {};
          if (!projectId || !videoVaultId || (!faceImageVaultId && !faceImageUrl)) {
            result = { error: true, message: "❌ Necesito: projectId, videoVaultId y (faceImageVaultId o faceImageUrl con la cara a aplicar)" }; break;
          }
          try {
            const internalPort = process.env.PORT || 8080;
            const r = await fetch(`http://localhost:${internalPort}/api/fs-pro/face-swap-video`, {
              method: "POST", headers: { "Content-Type": "application/json", Cookie: (req.headers.cookie as string) || "" },
              body: JSON.stringify({ projectId: Number(projectId), videoVaultId: Number(videoVaultId), faceImageVaultId: faceImageVaultId ? Number(faceImageVaultId) : undefined, faceImageUrl, title }),
              signal: AbortSignal.timeout(8 * 60_000),
            });
            const d = await r.json() as any;
            if (!r.ok || !d.success) { result = { error: true, message: `❌ Error en face swap: ${d.error || `HTTP ${r.status}`}` }; break; }
            result = {
              vaultId: d.vaultId, projectId: Number(projectId),
              videoUrl: `/api/projects/${Number(projectId)}/vault/${d.vaultId}/download`,
              message: `👤✅ **Face Swap aplicado al vídeo**\n\n` +
                `📦 Vault ID: \`${d.vaultId}\`\n💾 ${((d.sizeBytes||0)/1024/1024).toFixed(2)} MB\n\n` +
                `🔗 \`/api/projects/${Number(projectId)}/vault/${d.vaultId}/download\``,
            };
          } catch (err) { result = { error: true, message: `❌ Error: ${err instanceof Error ? err.message : String(err)}` }; }
          break;
        }

        case "generate_product_images": {
          const projectId = params?.projectId;
          const productId = params?.productId;
          if (!projectId || !productId) { result = { error: true, message: "❌ Falta projectId o productId" }; break; }
          try {
            const baseUrl = `http://localhost:${process.env.PORT || 8080}`;
            const imageTypesToGen = params?.imageTypes ?? ["hero", "lifestyle", "detail", "packaging"];
            const results: Array<{ type: string; status: string }> = [];
            for (const iType of imageTypesToGen) {
              try {
                const resp = await fetch(`${baseUrl}/api/projects/${projectId}/products/${productId}/images/generate`, {
                  method: "POST", headers: { "Content-Type": "application/json", cookie: req.headers.cookie ?? "" },
                  body: JSON.stringify({ imageType: iType }),
                });
                const data = await resp.json() as Record<string, unknown>;
                results.push({ type: iType, status: data.error ? "error" : "pending" });
              } catch { results.push({ type: iType, status: "error" }); }
            }
            const ok = results.filter(r => r.status === "pending").length;
            result = { jobs: results, message: `🖼️ **${ok}/${imageTypesToGen.length} imágenes IA generándose**\n\nTipos: ${imageTypesToGen.join(", ")}.` };
          } catch (err) { result = { error: true, message: `❌ Error: ${err instanceof Error ? err.message : String(err)}` }; }
          break;
        }

        case "generate_images_from_reference": {
          const projectId = params?.projectId;
          const productId = params?.productId;
          const referenceImageUrl = params?.referenceImageUrl;
          if (!projectId || !productId) { result = { error: true, message: "❌ Falta projectId o productId" }; break; }
          if (!referenceImageUrl) { result = { error: true, message: "❌ Falta referenceImageUrl — necesito la URL de la imagen de referencia del producto" }; break; }
          try {
            const baseUrl = `http://localhost:${process.env.PORT || 8080}`;
            const formData = new FormData();
            formData.append("referenceImageUrl", String(referenceImageUrl));
            if (params?.productTitle) formData.append("productTitle", String(params.productTitle));
            if (params?.productType) formData.append("productType", String(params.productType));
            if (params?.scenes) formData.append("scenes", JSON.stringify(params.scenes));
            formData.append("autoUpload", String(params?.autoUpload ?? "true"));
  
            const resp = await fetch(`${baseUrl}/api/projects/${projectId}/products/${productId}/images/generate-from-reference`, {
              method: "POST",
              headers: { cookie: req.headers.cookie ?? "" },
              body: formData,
            });
  
            if (!resp.ok) {
              const errData = await resp.json() as Record<string, unknown>;
              result = { error: true, message: `❌ ${errData.error ?? "Error generando imágenes desde referencia"}` };
              break;
            }
  
            const text = await resp.text();
            const lines = text.split("\n").filter(l => l.startsWith("data: "));
            let summary = { total: 0, success: 0, failed: 0 };
            const sceneResults: string[] = [];
            for (const line of lines) {
              try {
                const data = JSON.parse(line.slice(6)) as Record<string, unknown>;
                if (data.type === "done") {
                  summary = data.summary as typeof summary;
                }
                if (data.type === "completed" && data.success) {
                  sceneResults.push(`✅ ${data.label}`);
                }
                if (data.type === "error") {
                  sceneResults.push(`❌ ${data.label}: ${data.error}`);
                }
              } catch {}
            }
  
            result = {
              message: `🖼️ **Imágenes generadas desde referencia**\n\n📸 ${summary.success}/${summary.total} fotos profesionales creadas:\n${sceneResults.join("\n")}\n\n${summary.success > 0 ? "✅ Imágenes subidas automáticamente a Shopify" : "⚠️ Algunas imágenes no se pudieron generar"}`,
              imagesGenerated: summary.success,
              imagesFailed: summary.failed,
            };
          } catch (err) { result = { error: true, message: `❌ Error: ${err instanceof Error ? err.message : String(err)}` }; }
          break;
        }

        case "virtual_tryon": {
          const projectId = params?.projectId;
          const productId = params?.productId;
          const modelImageUrl = params?.modelImageUrl;
          const productImageUrls = params?.productImageUrls as string[] | undefined;
          if (!projectId || !productId) { result = { error: true, message: "❌ Falta projectId o productId" }; break; }
          if (!modelImageUrl) { result = { error: true, message: "❌ Falta modelImageUrl — necesito la URL de la foto de la persona/modelo" }; break; }
          if (!productImageUrls || !productImageUrls.length) { result = { error: true, message: "❌ Falta productImageUrls — necesito al menos una URL de foto del producto (ropa, calzado, accesorio, etc)" }; break; }
          try {
            const baseUrl = `http://localhost:${process.env.PORT || 8080}`;
            const formData = new FormData();
            formData.append("modelImageUrl", String(modelImageUrl));
            formData.append("productImageUrls", JSON.stringify(productImageUrls));
            if (params?.productTitle) formData.append("productTitle", String(params.productTitle));
            if (params?.productType) formData.append("productType", String(params.productType));
            if (params?.scenes) formData.append("scenes", JSON.stringify(params.scenes));
            formData.append("autoUpload", String(params?.autoUpload ?? "true"));
  
            const resp = await fetch(`${baseUrl}/api/projects/${projectId}/products/${productId}/images/virtual-tryon`, {
              method: "POST",
              headers: { cookie: req.headers.cookie ?? "" },
              body: formData,
            });
  
            if (!resp.ok) {
              const errData = await resp.json() as Record<string, unknown>;
              result = { error: true, message: `❌ ${errData.error ?? "Error en virtual try-on"}` };
              break;
            }
  
            const text = await resp.text();
            const lines = text.split("\n").filter(l => l.startsWith("data: "));
            let summary = { total: 0, success: 0, failed: 0 };
            const sceneResults: string[] = [];
            for (const line of lines) {
              try {
                const data = JSON.parse(line.slice(6)) as Record<string, unknown>;
                if (data.type === "done") summary = data.summary as typeof summary;
                if (data.type === "completed" && data.success) sceneResults.push(`✅ ${data.label}`);
                if (data.type === "error") sceneResults.push(`❌ ${data.label}: ${data.error}`);
              } catch {}
            }
  
            result = {
              message: `👗 **Virtual Try-On completado**\n\n📸 ${summary.success}/${summary.total} fotos profesionales generadas:\n${sceneResults.join("\n")}\n\n${summary.success > 0 ? "✅ Imágenes subidas automáticamente a Shopify\n\n🎯 Tipo: Modelo real vistiendo los productos de la tienda" : "⚠️ Algunas imágenes no se pudieron generar"}`,
              imagesGenerated: summary.success,
              imagesFailed: summary.failed,
            };
          } catch (err) { result = { error: true, message: `❌ Error: ${err instanceof Error ? err.message : String(err)}` }; }
          break;
        }

        case "bulk_generate_images": {
          const projectId = params?.projectId;
          if (!projectId) { result = { error: true, message: "❌ Falta projectId" }; break; }
          try {
            const productIds = params?.productIds as string[] | undefined;
            const imageTypes = params?.imageTypes || ["hero", "lifestyle", "detail"];
            if (!productIds || !productIds.length) {
              result = { error: true, message: "❌ Falta productIds (array de IDs de productos). Usa list_products primero para obtener los IDs." }; break;
            }
            const baseUrl = `http://localhost:${process.env.PORT || 8080}`;
            const resp = await fetch(`${baseUrl}/api/projects/${projectId}/bulk-generate-images`, {
              method: "POST", headers: { "Content-Type": "application/json", cookie: req.headers.cookie ?? "" },
              body: JSON.stringify({ productIds, imageTypes }),
            });
            const data = await resp.json() as Record<string, unknown>;
            if (!resp.ok) { result = { error: true, message: `❌ ${data.error ?? "Error generando imágenes"}` }; break; }
            result = { ...data, message: `🎨 **Generación de imágenes en lote iniciada**\n\n${productIds.length} productos × ${(imageTypes as string[]).length} tipos = ${productIds.length * (imageTypes as string[]).length} imágenes.\nTipos: ${(imageTypes as string[]).join(", ")}` };
          } catch (err) { result = { error: true, message: `❌ Error: ${err instanceof Error ? err.message : String(err)}` }; }
          break;
        }

        case "list_characters": {
          const projectId = parseInt(String(params?.projectId || ""), 10);
          if (!projectId) { res.status(400).json({ error: "projectId requerido" }); return; }
          const rows = await db
            .select({
              id: charactersTable.id,
              name: charactersTable.name,
              gender: charactersTable.gender,
              ageRange: charactersTable.ageRange,
              identityDescription: charactersTable.identityDescription,
              voiceId: charactersTable.voiceId,
              voiceLanguage: charactersTable.voiceLanguage,
              styleNotes: charactersTable.styleNotes,
              createdAt: charactersTable.createdAt,
            })
            .from(charactersTable)
            .where(eq(charactersTable.projectId, projectId))
            .orderBy(desc(charactersTable.createdAt))
            .limit(50);
          result = {
            count: rows.length,
            characters: rows,
            message: rows.length
              ? `📚 ${rows.length} personaje(s) bloqueados disponibles para anuncios.`
              : `Aún no hay personajes guardados. Crea uno desde Brain Studio → Personajes.`,
          };
          break;
        }

        case "get_character": {
          const projectId = parseInt(String(params?.projectId || ""), 10);
          const cid = parseInt(String(params?.characterId || params?.id || ""), 10);
          if (!projectId || !cid) { res.status(400).json({ error: "projectId y characterId requeridos" }); return; }
          const [ch] = await db
            .select()
            .from(charactersTable)
            .where(and(eq(charactersTable.projectId, projectId), eq(charactersTable.id, cid)));
          if (!ch) { res.status(404).json({ error: "Personaje no encontrado" }); return; }
          result = {
            id: ch.id,
            name: ch.name,
            gender: ch.gender,
            ageRange: ch.ageRange,
            identityDescription: ch.identityDescription,
            voiceId: ch.voiceId,
            voiceLanguage: ch.voiceLanguage,
            styleNotes: ch.styleNotes,
            hasReferenceImage: Boolean(ch.refVaultFileId),
            message: `🎭 Personaje "${ch.name}" cargado.`,
          };
          break;
        }

        case "delete_character": {
          const projectId = parseInt(String(params?.projectId || ""), 10);
          const cid = parseInt(String(params?.characterId || params?.id || ""), 10);
          if (!projectId || !cid) { res.status(400).json({ error: "projectId y characterId requeridos" }); return; }
          const [deleted] = await db
            .delete(charactersTable)
            .where(and(eq(charactersTable.projectId, projectId), eq(charactersTable.id, cid)))
            .returning({ id: charactersTable.id, name: charactersTable.name });
          if (!deleted) { res.status(404).json({ error: "Personaje no encontrado" }); return; }
          result = { id: deleted.id, name: deleted.name, message: `🗑️ Personaje "${deleted.name}" eliminado.` };
          break;
        }

        case "build_product_dna": {
          const projectId = parseInt(String(params?.projectId || ""), 10);
          const productIdParam = String(params?.productId || "");
          if (!projectId || !productIdParam) {
            res.status(400).json({ error: "projectId y productId requeridos" });
            return;
          }
          const [project] = await db.select().from(projectsTable).where(eq(projectsTable.id, projectId));
          if (!project) { res.status(404).json({ error: "Proyecto no encontrado" }); return; }
          // Resolver producto por id numérico interno o por shopifyProductId
          const numericPid = /^\d+$/.test(productIdParam) ? parseInt(productIdParam, 10) : null;
          const productConditions = [eq(productsTable.projectId, projectId)];
          const [product] = await db
            .select()
            .from(productsTable)
            .where(
              numericPid
                ? and(...productConditions, eq(productsTable.id, numericPid))
                : and(...productConditions, eq(productsTable.shopifyProductId, productIdParam)),
            )
            .limit(1);
          if (!product) { res.status(404).json({ error: "Producto no encontrado" }); return; }

          // Obtener primera imagen del producto desde Shopify (la más fiable)
          let productImageUrl: string | null = null;
          try {
            const sp = await shopifyRequest<{ product: { image?: { src: string } } }>(
              projectId,
              project.shopDomain,
              `/products/${product.shopifyProductId}.json?fields=image`,
            );
            productImageUrl = sp.product?.image?.src || null;
          } catch (_) { /* fallthrough a fallback de texto */ }

          const { fetchToBuffer } = await import("../../lib/fusion-studio-pro.js");
          const { buildProductDNA } = await import("../../lib/product-dna.js");
          const stripHtmlLocal = (s: string | null | undefined): string =>
            (s || "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();

          let images: Array<{ buffer: Buffer; mime: "image/jpeg" | "image/png" | "image/webp" }> = [];
          if (productImageUrl) {
            try {
              const buf = await fetchToBuffer(productImageUrl);
              const lower = productImageUrl.toLowerCase();
              const mime: "image/jpeg" | "image/png" | "image/webp" = lower.includes(".png")
                ? "image/png" : lower.includes(".webp") ? "image/webp" : "image/jpeg";
              images = [{ buffer: buf, mime }];
            } catch (_) { /* ignore */ }
          }
          const dna = await buildProductDNA({
            projectId,
            productName: product.title || "Producto",
            brand: project.name || undefined,
            category: project.storeNiche || undefined,
            description: stripHtmlLocal(product.bodyHtml).slice(0, 1500) || undefined,
            images,
          });
          result = {
            productName: dna.productName,
            brand: dna.brand,
            category: dna.category,
            visualSummary: dna.visualSummary,
            materialsCount: dna.materials.length,
            materials: dna.materials,
            layers: dna.layers,
            textures: dna.textures,
            hardware: dna.hardware,
            palette: dna.palette,
            keyFeatures: dna.keyFeatures,
            visibleClaims: dna.visibleClaims,
            deconstructionPoints: dna.deconstructionPoints,
            identityLockBlock: dna.identityLockBlock,
            message: `🧬 Product DNA listo: ${dna.materials.length} materiales, ${dna.deconstructionPoints.length} capas para deconstrucción.`,
          };
          break;
        }

        case "create_long_ad": {
          const projectId = parseInt(String(params?.projectId || ""), 10);
          const productIdParam = String(params?.productId || "");
          if (!projectId || !productIdParam) {
            res.status(400).json({ error: "projectId y productId requeridos" });
            return;
          }
          const totalDurationSec = Math.max(60, Math.min(1800, Number(params?.totalDurationSec) || Number(params?.durationSec) || 180));
          const scenesCount = Math.max(2, Math.min(240, Number(params?.scenesCount) || Math.round(totalDurationSec / 6)));
          const compositionMode: "narrative" | "explainer-locked" | "composite-pro" | "locked-shot" =
            params?.compositionMode === "explainer-locked" || params?.compositionMode === "composite-pro" || params?.compositionMode === "locked-shot"
              ? params.compositionMode
              : "narrative";
          const characterId = params?.characterId ? parseInt(String(params.characterId), 10) : undefined;
          const ctaText = typeof params?.ctaText === "string" ? params.ctaText : undefined;
          const customNotes = typeof params?.customNotes === "string" ? params.customNotes : undefined;
          const aspect = (params?.aspect === "16:9" || params?.aspect === "1:1") ? params.aspect : "9:16";
          const language = typeof params?.language === "string" ? params.language : "es";
          const videoModel = typeof params?.videoModel === "string" ? params.videoModel : "kling-3.0-turbo";
          const savedPromptId = typeof params?.savedPromptId === "string" && params.savedPromptId.trim()
            ? params.savedPromptId.trim()
            : undefined;

          // Llamada interna al endpoint smart-cinematic (mantiene un único flujo).
          const port = process.env.PORT || "8080";
          const cookie = req.headers.cookie || "";
          const url = `http://127.0.0.1:${port}/api/projects/${projectId}/products/${encodeURIComponent(productIdParam)}/ads/smart-cinematic`;
          const body = {
            scenesCount,
            totalDurationSec,
            longForm: true,
            compositionMode,
            characterId,
            ctaText,
            customNotes,
            aspect,
            language,
            videoModel,
            addMusic: params?.addMusic !== false,
            savedPromptId,
          };
          let resp: Response;
          try {
            resp = await fetch(url, {
              method: "POST",
              headers: { "Content-Type": "application/json", cookie },
              body: JSON.stringify(body),
            });
          } catch (e: any) {
            res.status(502).json({ error: `No se pudo invocar smart-cinematic: ${e?.message || e}` });
            return;
          }
          const data = await resp.json().catch(() => ({})) as Record<string, unknown>;
          if (!resp.ok) {
            result = { error: true, status: resp.status, ...data, message: `❌ Generación falló: ${(data as any)?.error || resp.statusText}` };
          } else {
            // smart-cinematic responde { success, result: { videoUrl, vaultId, durationSec, scenesCount, ... }, ... }
            const inner = ((data as any)?.result || data) as Record<string, unknown>;
            const vId = (inner as any)?.vaultId ?? (data as any)?.vaultId ?? null;
            const vUrl = (inner as any)?.videoUrl ?? (inner as any)?.finalVideoUrl ?? (data as any)?.url ?? null;
            const dSec = (inner as any)?.durationSec ?? (data as any)?.durationSec ?? totalDurationSec;
            const sCnt = (inner as any)?.scenesCount ?? (data as any)?.scenesCount ?? scenesCount;
            result = {
              ok: true,
              vaultId: vId,
              videoUrl: vUrl,
              durationSec: dSec,
              scenesCount: sCnt,
              compositionMode,
              longForm: true,
              message: `🎬 Anuncio largo generado (${dSec}s, ${sCnt} escenas, modo ${compositionMode}). Vault #${vId ?? "?"}.`,
            };
          }
          break;
        }

        case "create_brand_ad": {
          const projectId = parseInt(String(params?.projectId || ""), 10);
          if (!projectId) { result = { error: true, message: "❌ Falta projectId válido" }; break; }
          const brand = String(params?.brand || "").trim().slice(0, 200);
          const productName = String(params?.productName || params?.subject || "").trim().slice(0, 200);
          if (!brand || !productName) { result = { error: true, message: "❌ Faltan brand y productName/subject" }; break; }
          const refVaultId = Number(params?.referenceImageVaultId || params?.productVaultId || 0);
          if (!Number.isInteger(refVaultId) || refVaultId <= 0) {
            result = { error: true, message: "❌ Necesitas referenceImageVaultId (id de imagen ya en vault — usa absorb-image antes o pásamelo)" }; break;
          }
          const scenesCount = Math.max(2, Math.min(24, Number(params?.scenesCount) || 6));
          const totalDurationSec = Math.max(6, Math.min(240, Number(params?.totalDurationSec) || (scenesCount * 8)));
          const aspect = (params?.aspect === "16:9" || params?.aspect === "1:1") ? params.aspect : "9:16";
          const language = typeof params?.language === "string" ? params.language : "es";
          const videoModel = typeof params?.videoModel === "string" ? params.videoModel : "kling-3.0-turbo";
          const imageModel = typeof params?.imageModel === "string" ? params.imageModel : undefined;
          const style = typeof params?.style === "string" ? params.style : "cinematic";
          const customBrief = typeof params?.customBrief === "string" ? params.customBrief : (typeof params?.customNotes === "string" ? params.customNotes : undefined);
          const narrationEnabled = params?.narrationEnabled !== false;
          const narrationVoiceId = typeof params?.narrationVoiceId === "string" ? params.narrationVoiceId : undefined;
          const musicEnabled = params?.musicEnabled !== false;
          const musicPrompt = typeof params?.musicPrompt === "string" ? params.musicPrompt : undefined;
          try {
            const [project] = await db.select().from(projectsTable).where(eq(projectsTable.id, projectId));
            if (!project) { result = { error: true, message: "❌ Proyecto no encontrado" }; break; }
            // Carga la referencia desde el vault y llama directo a la lib (sin loopback HTTP/multipart).
            const { generateCinematicMultiShot } = await import("../../lib/cinematic-multishot.js");
            const { saveToVaultSmart, readVaultContent } = await import("../fs-pro.js");
            const [refRow] = await db.select().from(projectFilesTable).where(and(
              eq(projectFilesTable.projectId, projectId),
              eq(projectFilesTable.id, refVaultId),
            ));
            if (!refRow) { result = { error: true, message: `❌ Referencia vault #${refVaultId} no encontrada en este proyecto` }; break; }
            const productImage = await readVaultContent(refRow);
            if (!productImage) { result = { error: true, message: `❌ No se pudo leer el contenido del vault #${refVaultId}` }; break; }
            const productMime = refRow.mimeType || "image/png";
            const adResult = await generateCinematicMultiShot({
              projectId, productImage, productMime,
              brand, productName,
              niche: project.storeNiche || undefined,
              language, scenesCount, totalDurationSec,
              aspect: aspect as any, videoModel,
              imageModel: imageModel as any,
              style: style as any,
              customBrief,
              narration: narrationEnabled ? { enabled: true, voiceId: narrationVoiceId, voiceVolume: 1.0 } : undefined,
              music: musicEnabled ? { enabled: true, prompt: musicPrompt, volume: 0.22 } : undefined,
              // Deterministic brand overlay (text + logo). Auto-builds a
              // 3-segment overlay from the chatbot params if brandKit is given.
              brandOverlay: (params as any)?.brandOverlay,
              brandKit: (params as any)?.brandKit,
            });
            const finalVaultId = await saveToVaultSmart({
              projectId, fileType: "fs-pro-multishot", category: "fusion-studio-pro",
              title: `Brand Ad: ${brand} — ${productName} (${adResult.durationSec}s, ${adResult.script.scenes.length} escenas)`,
              mimeType: adResult.finalMime, generatedBy: `chatbot:create_brand_ad:${videoModel}`,
              buffer: adResult.finalVideo,
            });
            const scriptVaultId = await saveToVaultSmart({
              projectId, fileType: "fs-pro-script", category: "fusion-studio-pro",
              title: `Brand Ad Script: ${brand} — ${productName}`,
              mimeType: "application/json", generatedBy: "chatbot:create_brand_ad:script",
              buffer: Buffer.from(JSON.stringify(adResult.script, null, 2), "utf-8"),
            });
            const sizeMB = (adResult.finalVideo.length / 1024 / 1024).toFixed(2);
            result = {
              ok: true, vaultId: finalVaultId, scriptVaultId,
              projectId,
              videoUrl: `/api/projects/${projectId}/vault/${finalVaultId}/download`,
              durationSec: adResult.durationSec,
              scenesCount: adResult.script.scenes.length,
              sizeBytes: adResult.finalVideo.length,
              message: `🎬✅ **Anuncio de marca generado**\n\n` +
                `📦 Vault #${finalVaultId} (vídeo final, ${sizeMB} MB)\n` +
                `📜 Vault #${scriptVaultId} (script reusable)\n` +
                `⏱️ Duración: ${adResult.durationSec}s · 🎞️ Escenas: ${adResult.script.scenes.length}\n` +
                `🎙️ Voz: ${narrationEnabled ? "ES Bella" : "sin voz"} · 🎵 Música: ${musicEnabled ? "ElevenLabs" : "sin música"}\n` +
                `📐 ${aspect} · 🎬 ${videoModel} · 🎨 ${style}`,
            };
          } catch (err) {
            result = { error: true, message: `❌ Error generando anuncio brand: ${err instanceof Error ? err.message : String(err)}` };
          }
          break;
        }

        case "create_business_card": {
          const projectId = parseInt(String(params?.projectId || ""), 10);
          if (!projectId) { result = { error: true, message: "❌ projectId requerido" }; break; }
          const port = process.env.PORT || "8080";
          const cookie = req.headers.cookie || "";
          const cardPayload = {
            projectId,
            name: String(params?.name || "Mi tarjeta").slice(0, 80),
            fullName: params?.fullName ? String(params.fullName) : undefined,
            jobTitle: params?.jobTitle ? String(params.jobTitle) : undefined,
            companyName: params?.companyName ? String(params.companyName) : undefined,
            tagline: params?.tagline ? String(params.tagline) : undefined,
            email: params?.email ? String(params.email) : undefined,
            phone: params?.phone ? String(params.phone) : undefined,
            website: params?.website ? String(params.website) : undefined,
            socialHandle: params?.socialHandle ? String(params.socialHandle) : undefined,
            address: params?.address ? String(params.address) : undefined,
            templateId: params?.templateId ? String(params.templateId) : "elite-executive",
            layout: params?.layout ? String(params.layout) : undefined, // sin layout: el de la plantilla
            qrUrl: params?.qrUrl ? String(params.qrUrl) : undefined,
          };
          if (!cardPayload.fullName) { result = { error: true, message: "❌ Falta fullName (nombre que aparece en la tarjeta)" }; break; }
          try {
            const createRes = await fetch(`http://127.0.0.1:${port}/api/projects/${projectId}/cards`, {
              method: "POST",
              headers: { "Content-Type": "application/json", "cookie": cookie },
              body: JSON.stringify(cardPayload),
            });
            if (!createRes.ok) {
              const err = await createRes.json().catch(() => ({} as any)) as any;
              result = { error: true, message: `❌ Error creando tarjeta: ${err.error || createRes.statusText}` };
              break;
            }
            const card = await createRes.json() as any;
            const shouldGenerate = params?.generateCard !== false;
            if (shouldGenerate) {
              const genRes = await fetch(`http://127.0.0.1:${port}/api/cards/${card.id}/generate`, {
                method: "POST",
                headers: { "Content-Type": "application/json", "cookie": cookie },
                body: JSON.stringify({ backgroundModel: params?.backgroundModel }),
              });
              if (genRes.ok) {
                const genData = await genRes.json() as any;
                result = {
                  ok: true, cardId: card.id,
                  frontImageUrl: genData.card?.frontImageUrl,
                  backImageUrl: genData.card?.backImageUrl,
                  cost: genData.cost,
                  message: `🃏✅ **Tarjeta de presentación creada y generada**\n\n📋 Card #${card.id}: "${card.name}"\n👤 ${cardPayload.fullName || "(sin nombre)"} · ${cardPayload.jobTitle || ""} · ${cardPayload.companyName || ""}\n💰 Coste generación: $${genData.cost?.toFixed(4) || "0.00"}\n\n➡️ Ve a **Card Studio** para ver y descargar (PNG + PDF): /projects/${projectId}/cards`,
                };
              } else {
                result = { ok: true, cardId: card.id, message: `🃏 **Tarjeta creada** (Card #${card.id}: "${card.name}"). La generación de imagen falló — ve a **Card Studio** para generarla: /projects/${projectId}/cards` };
              }
            } else {
              result = { ok: true, cardId: card.id, message: `🃏✅ **Tarjeta creada** (Card #${card.id}: "${card.name}"). Usa generate_business_card_image para generar la imagen cuando quieras.` };
            }
          } catch (err) {
            result = { error: true, message: `❌ Error: ${err instanceof Error ? err.message : String(err)}` };
          }
          break;
        }

        case "list_business_cards": {
          const projectId = parseInt(String(params?.projectId || ""), 10);
          if (!projectId) { result = { error: true, message: "❌ projectId requerido" }; break; }
          const port = process.env.PORT || "8080";
          const cookie = req.headers.cookie || "";
          try {
            const listRes = await fetch(`http://127.0.0.1:${port}/api/projects/${projectId}/cards`, {
              headers: { "cookie": cookie },
            });
            if (!listRes.ok) { result = { error: true, message: "❌ Error listando tarjetas" }; break; }
            const cards = ((await listRes.json() as { cards?: any[] }).cards ?? []);
            result = {
              ok: true, count: cards.length, cards,
              message: cards.length === 0
                ? `🃏 No hay tarjetas de presentación en el proyecto ${projectId}. Usa create_business_card para crear una.`
                : `🃏 **${cards.length} tarjeta(s) de presentación**:\n\n${cards.slice(0, 10).map((c: any) => `• Card #${c.id}: "${c.name}" — ${c.fullName || "Sin nombre"} · ${c.companyName || "Sin empresa"} · Template: ${c.templateId}`).join("\n")}\n\n➡️ Card Studio: /projects/${projectId}/cards`,
            };
          } catch (err) {
            result = { error: true, message: `❌ Error: ${err instanceof Error ? err.message : String(err)}` };
          }
          break;
        }

        case "generate_business_card_image": {
          const projectId = parseInt(String(params?.projectId || ""), 10);
          const cardId = parseInt(String(params?.cardId || ""), 10);
          if (!cardId) { result = { error: true, message: "❌ cardId requerido" }; break; }
          const port = process.env.PORT || "8080";
          const cookie = req.headers.cookie || "";
          try {
            const genRes = await fetch(`http://127.0.0.1:${port}/api/cards/${cardId}/generate`, {
              method: "POST",
              headers: { "Content-Type": "application/json", "cookie": cookie },
              body: JSON.stringify({ backgroundModel: params?.backgroundModel }),
            });
            if (!genRes.ok) {
              const err = await genRes.json().catch(() => ({} as any)) as any;
              result = { error: true, message: `❌ Error generando imagen: ${err.error || genRes.statusText}` };
              break;
            }
            const genData = await genRes.json() as any;
            result = {
              ok: true, cardId,
              cost: genData.cost,
              frontImageUrl: genData.card?.frontImageUrl,
              backImageUrl: genData.card?.backImageUrl,
              message: `🃏✅ **Imagen generada** para Card #${cardId}\n💰 Coste: $${genData.cost?.toFixed(4) || "0.00"}\n\n➡️ Card Studio${projectId ? ` /projects/${projectId}/cards` : ""} para ver y descargar (PNG + PDF).`,
            };
          } catch (err) {
            result = { error: true, message: `❌ Error: ${err instanceof Error ? err.message : String(err)}` };
          }
          break;
        }

        case "create_character": {
          const projectId = parseInt(String(params?.projectId || ""), 10);
          const name = String(params?.name || "").trim().slice(0, 80);
          const identityDescription = String(params?.identityDescription || "").trim().slice(0, 1500);
          if (!projectId || !name || !identityDescription) {
            res.status(400).json({ error: "projectId, name e identityDescription son requeridos" });
            return;
          }
          const [project] = await db.select().from(projectsTable).where(eq(projectsTable.id, projectId));
          if (!project) { res.status(404).json({ error: "Proyecto no encontrado" }); return; }

          const refImageUrl = typeof params?.refImageUrl === "string" ? params.refImageUrl : null;
          const refImageBase64 = typeof params?.refImageBase64 === "string" ? params.refImageBase64 : null;
          if (!refImageUrl && !refImageBase64) {
            res.status(400).json({ error: "refImageUrl o refImageBase64 requerido" });
            return;
          }
          const ALLOWED_IMG_MIMES = new Set(["image/png", "image/jpeg", "image/webp"]);
          const MAX_REF_BYTES = 12 * 1024 * 1024; // 12MB
          let imgBuffer: Buffer | null = null;
          let imgMime = "image/png";
          if (refImageBase64) {
            const m = /^data:([^;]+);base64,([A-Za-z0-9+/=\s]+)$/.exec(refImageBase64);
            if (m) {
              const declared = m[1].toLowerCase();
              if (!ALLOWED_IMG_MIMES.has(declared)) {
                res.status(400).json({ error: `MIME no permitido: ${declared}. Permitidos: image/png, image/jpeg, image/webp.` });
                return;
              }
              imgMime = declared;
              imgBuffer = Buffer.from(m[2].replace(/\s+/g, ""), "base64");
            } else if (/^[A-Za-z0-9+/=\s]+$/.test(refImageBase64)) {
              imgBuffer = Buffer.from(refImageBase64.replace(/\s+/g, ""), "base64");
            } else {
              res.status(400).json({ error: "refImageBase64 inválido (debe ser data URI o base64 puro)" });
              return;
            }
            if (imgBuffer.length > MAX_REF_BYTES) {
              res.status(413).json({ error: `Imagen demasiado grande (${imgBuffer.length} bytes). Máximo ${MAX_REF_BYTES} bytes.` });
              return;
            }
          } else if (refImageUrl) {
            try {
              const { fetchToBuffer } = await import("../../lib/fusion-studio-pro.js");
              imgBuffer = await fetchToBuffer(refImageUrl);
              if (imgBuffer.length > MAX_REF_BYTES) {
                res.status(413).json({ error: `Imagen demasiado grande (${imgBuffer.length} bytes). Máximo ${MAX_REF_BYTES} bytes.` });
                return;
              }
              const lower = refImageUrl.toLowerCase();
              imgMime = lower.includes(".png") ? "image/png"
                : lower.includes(".webp") ? "image/webp"
                : lower.includes(".jpg") || lower.includes(".jpeg") ? "image/jpeg"
                : "image/png";
            } catch (e: any) {
              res.status(400).json({ error: `No se pudo descargar refImageUrl: ${e?.message || e}` });
              return;
            }
          }
          if (!imgBuffer || imgBuffer.length === 0) {
            res.status(400).json({ error: "Imagen de referencia vacía" });
            return;
          }
          // Validación de magic bytes para prevenir spoof de MIME
          const hdr = imgBuffer.subarray(0, 12);
          const isPng = hdr[0] === 0x89 && hdr[1] === 0x50 && hdr[2] === 0x4e && hdr[3] === 0x47;
          const isJpg = hdr[0] === 0xff && hdr[1] === 0xd8 && hdr[2] === 0xff;
          const isWebp = hdr[0] === 0x52 && hdr[1] === 0x49 && hdr[2] === 0x46 && hdr[3] === 0x46 && hdr[8] === 0x57 && hdr[9] === 0x45 && hdr[10] === 0x42 && hdr[11] === 0x50;
          if (!isPng && !isJpg && !isWebp) {
            res.status(400).json({ error: "Formato no reconocido. Solo PNG, JPEG o WEBP." });
            return;
          }
          imgMime = isPng ? "image/png" : isJpg ? "image/jpeg" : "image/webp";
          const vaultId = await saveToVault({
            projectId,
            fileType: "image",
            category: "character_reference",
            title: `Character ref — ${name}`,
            description: `Imagen de referencia del personaje "${name}". ${identityDescription.slice(0, 200)}`,
            mimeType: imgMime,
            generatedBy: "chatbot.create_character",
            content: imgBuffer.toString("base64"),
            metadata: { characterName: name, source: refImageUrl ? "url" : "base64", uploadedAt: new Date().toISOString() },
          });
          if (!vaultId) {
            res.status(500).json({ error: "No se pudo guardar la imagen del personaje" });
            return;
          }
          const gender = typeof params?.gender === "string" ? params.gender.slice(0, 30) : null;
          const ageRange = typeof params?.ageRange === "string" ? params.ageRange.slice(0, 30) : null;
          const voiceId = typeof params?.voiceId === "string" ? params.voiceId.slice(0, 80) : null;
          const voiceGender = typeof params?.voiceGender === "string" ? params.voiceGender.slice(0, 30) : null;
          const voiceLanguage = typeof params?.voiceLanguage === "string" ? params.voiceLanguage.slice(0, 10) : null;
          const styleNotes = typeof params?.styleNotes === "string" ? params.styleNotes.slice(0, 800) : null;
          const [created] = await db.insert(charactersTable).values({
            projectId,
            name,
            gender,
            ageRange,
            identityDescription,
            voiceId,
            voiceGender,
            voiceLanguage,
            refVaultFileId: vaultId,
            refMimeType: imgMime,
            styleNotes,
          }).returning();
          result = {
            ok: true,
            character: { ...created, imageUrl: `/api/projects/${projectId}/characters/${created.id}/image` },
            message: `🎭 Personaje "${name}" creado (id ${created.id}). Úsalo en create_long_ad pasando characterId=${created.id}.`,
          };
          break;
        }

        case "update_character": {
          const projectId = parseInt(String(params?.projectId || ""), 10);
          const cid = parseInt(String(params?.characterId || params?.id || ""), 10);
          if (!projectId || !cid) {
            res.status(400).json({ error: "projectId y characterId requeridos" });
            return;
          }
          const editable = ["name", "gender", "ageRange", "identityDescription", "voiceId", "voiceGender", "voiceLanguage", "styleNotes"] as const;
          const updates: Record<string, unknown> = {};
          for (const f of editable) {
            if (params && Object.prototype.hasOwnProperty.call(params, f)) {
              const max = f === "identityDescription" ? 1500 : f === "styleNotes" ? 800 : 80;
              const v = params[f];
              updates[f] = v == null ? null : String(v).slice(0, max);
            }
          }
          if (Object.keys(updates).length === 0) {
            res.status(400).json({ error: "Nada que actualizar" });
            return;
          }
          const [updated] = await db
            .update(charactersTable)
            .set(updates)
            .where(and(eq(charactersTable.projectId, projectId), eq(charactersTable.id, cid)))
            .returning();
          if (!updated) { res.status(404).json({ error: "Personaje no encontrado" }); return; }
          result = { ok: true, character: updated, message: `✏️ Personaje "${updated.name}" actualizado.` };
          break;
        }

        case "persist_cinematic_script": {
          const projectId = parseInt(String(params?.projectId || ""), 10);
          const script = params?.script as any;
          if (!projectId || !script || typeof script !== "object" || !Array.isArray(script.scenes)) {
            res.status(400).json({ error: "projectId y script.scenes[] son requeridos" });
            return;
          }
          const [project] = await db.select().from(projectsTable).where(eq(projectsTable.id, projectId));
          if (!project) { res.status(404).json({ error: "Proyecto no encontrado" }); return; }
          const { persistCinematicScript } = await import("../../lib/cinematic-multishot.js");
          const totalDurationSec = Math.max(6, Math.min(1800, Number(params?.totalDurationSec) || script.scenes.reduce((s: number, sc: any) => s + (sc.timeEndSec - sc.timeStartSec || 5), 0) || 60));
          const scenesCount = script.scenes.length;
          const savedId = await persistCinematicScript({
            script,
            config: {
              projectId,
              brand: typeof params?.brand === "string" ? params.brand : (project.name || "brand"),
              productName: typeof params?.productName === "string" ? params.productName : "product",
              niche: typeof params?.niche === "string" ? params.niche : (project.storeNiche || undefined),
              audience: typeof params?.audience === "string" ? params.audience : undefined,
              language: typeof params?.language === "string" ? params.language : "es",
              scenesCount,
              totalDurationSec,
              aspect: (params?.aspect === "16:9" || params?.aspect === "1:1" || params?.aspect === "9:16") ? params.aspect : "9:16",
              videoModel: typeof params?.videoModel === "string" ? params.videoModel : "kling-3.0-turbo",
              imageModel: typeof params?.imageModel === "string" ? params.imageModel : undefined,
              style: typeof params?.style === "string" ? params.style : "cinematic",
              customBrief: typeof params?.customBrief === "string" ? params.customBrief : undefined,
              narration: undefined,
              music: undefined,
            },
            source: "edited",
          });
          result = {
            ok: true,
            scriptId: savedId,
            message: `📝 Script cinematográfico guardado (id ${savedId}). Reutilízalo en create_long_ad pasando savedPromptId="${savedId}".`,
          };
          break;
        }

        case "generate_brand_book": {
          const projectId = params?.projectId ? Number(params.projectId) : null;
          const brandName: string = params?.brandName || "Tu Marca";
          const industry: string = params?.industry || "";
          const customNotes: string = params?.notes || "";

          try {
            // Cargar Brand DNA si existe
            let brandContext = "";
            if (projectId) {
              try {
                brandContext = await buildBrandDnaContext(projectId);
              } catch { /* no hay DNA, continuar */ }
            }

            const { buildCoverPage } = await import("../../lib/report-cover.js");
            const reportDate = new Date().toLocaleDateString("es-ES", { day: "2-digit", month: "long", year: "numeric" });

            // Claude genera el contenido del brand book en JSON estructurado
            const brandBookSystem = `Eres un director creativo de alto nivel con 20 años de experiencia en branding global (Nike, Apple, Zara, etc.).
Tu tarea es crear un BRAND BOOK / BRAND DNA completo y profesional similar al que genera Google AI Studio.

Responde SIEMPRE en formato JSON válido con esta estructura exacta:
{
  "brandName": "nombre de la marca",
  "tagline": "eslogan principal",
  "mission": "misión de la marca (2-3 frases)",
  "vision": "visión (2-3 frases)",
  "brandStory": "historia de la marca (3-4 párrafos narrativos)",
  "values": [{"name": "valor", "description": "descripción breve", "icon": "emoji"}],
  "archetype": {"name": "arquetipo", "description": "explicación", "examples": ["marca1","marca2"]},
  "personality": ["rasgo1", "rasgo2", "rasgo3", "rasgo4", "rasgo5"],
  "toneOfVoice": {"primary": "tono principal", "description": "explicación", "dos": ["hacer1","hacer2","hacer3"], "donts": ["evitar1","evitar2","evitar3"]},
  "colorPalette": [{"name": "nombre color", "hex": "#XXXXXX", "rgb": "rgb(x,y,z)", "usage": "uso principal", "psychology": "qué transmite"}],
  "typography": {"primary": {"name": "fuente", "weights": ["400","600","700"], "usage": "titulares"}, "secondary": {"name": "fuente", "weights": ["300","400","500"], "usage": "cuerpo"}, "accent": {"name": "fuente", "weights": ["400"], "usage": "detalles"}},
  "logoGuidelines": {"clearSpace": "descripción espacio mínimo", "minSize": "tamaño mínimo", "backgrounds": ["fondos correctos"], "prohibitions": ["prohibiciones"], "variations": ["variación principal","variación secundaria","versión monocroma"]},
  "imagery": {"style": "estilo fotográfico", "composition": "descripción composición", "mood": "estado de ánimo visual", "avoidances": ["evitar1","evitar2"], "examples": ["tipo imagen 1","tipo imagen 2","tipo imagen 3"]},
  "contentPillars": [{"pillar": "pilar temático", "description": "qué contenido incluye", "percentage": "% del contenido", "examples": ["ejemplo1","ejemplo2"]}],
  "targetAudience": {"primary": {"name": "segmento", "age": "rango edad", "profile": "descripción", "painPoints": ["dolor1","dolor2"], "desires": ["deseo1","deseo2"]}, "secondary": {"name": "segmento secundario", "profile": "descripción breve"}},
  "socialMedia": {"instagram": {"tone": "tono", "contentTypes": ["tipo1","tipo2"], "hashtags": ["#tag1","#tag2","#tag3","#tag4","#tag5"], "frequency": "frecuencia"}, "tiktok": {"tone": "tono", "format": "formato de vídeo"}, "linkedin": {"tone": "tono", "contentFocus": "enfoque"}},
  "messagingFramework": {"valueProposition": "propuesta de valor principal", "keyMessages": ["mensaje1","mensaje2","mensaje3"], "elevator": "pitch de 30 segundos", "headlines": ["titular1","titular2","titular3"]},
  "competitivePositioning": {"position": "posicionamiento diferencial", "differentiators": ["diferenciador1","diferenciador2","diferenciador3"], "competitors": [{"name": "competidor", "difference": "cómo nos diferenciamos"}]}
}`;
            const brandBookPrompt = `Genera un brand book completo para:
Marca: ${brandName}
Sector: ${industry || "e-commerce / Shopify"}
${customNotes ? `Información adicional: ${customNotes}` : ""}
${brandContext ? `\nBrand DNA extraído de la empresa:\n${brandContext.slice(0, 3000)}` : ""}

Genera contenido específico, detallado y profesional. NO uses placeholders genéricos.`;

            // Antes: 4000 tokens para todo el JSON (se cortaba) y, si no parseaba, se
            // renderizaba y guardaba en el Vault un brand book vacío con solo el nombre.
            const bbRaw: Record<string, any> = await generateAiJson({
              prompt: brandBookPrompt,
              maxTokens: 8000,
              retryMaxTokens: 16000,
              schema: brandBookSchema,
              expect: "object",
              label: "shopybrain/generate_brand_book",
              call: async ({ prompt, maxTokens }) => {
                const r = await askClaudeDetailed(projectId || 0, [{ role: "user", content: prompt }], brandBookSystem, maxTokens, undefined, { tier: "smart" }, "generate_brand_book");
                return { text: r.text, truncated: r.truncated };
              },
            });

            // ─── Render HTML del Brand Book ───────────────────────────────
            // Todo lo que viene de la IA o del usuario se escapa antes de entrar en el
            // HTML (se guarda en el Vault y se sirve como text/html). La portada ya
            // escapa por su cuenta, así que a buildCoverPage se le pasan los valores crudos.
            const bb: Record<string, any> = escapeHtmlDeep(bbRaw);
            const safeBrandName = sanitizeHtml(brandName);
            const colors = (bb.colorPalette || []) as Array<{hex:string;name:string;usage:string;psychology:string}>;
            const values = (bb.values || []) as Array<{icon:string;name:string;description:string}>;
            const pillars = (bb.contentPillars || []) as Array<{pillar:string;percentage:string;description:string;examples:string[]}>;

            const colorSwatches = colors.map(c => `
              <div style="text-align:center">
                <div style="width:80px;height:80px;border-radius:50%;background:${c.hex};margin:0 auto 10px;border:2px solid rgba(255,255,255,0.1)"></div>
                <div style="font-size:13px;font-weight:600;color:#e8d898">${c.name}</div>
                <div style="font-size:11px;color:#c4a55a;font-family:monospace">${c.hex}</div>
                <div style="font-size:11px;color:#8a8070;margin-top:3px">${c.usage}</div>
                <div style="font-size:10px;color:#6a6058;font-style:italic;margin-top:3px">${c.psychology}</div>
              </div>`).join("");

            const valuesCards = values.map(v => `
              <div style="background:rgba(196,165,90,0.06);border:1px solid rgba(196,165,90,0.2);border-radius:12px;padding:20px;text-align:center">
                <div style="font-size:2rem;margin-bottom:10px">${v.icon}</div>
                <div style="font-size:14px;font-weight:700;color:#c4a55a;margin-bottom:8px">${v.name}</div>
                <div style="font-size:12px;color:#a09880;line-height:1.6">${v.description}</div>
              </div>`).join("");

            const pillarCards = pillars.map(p => `
              <div style="background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.08);border-radius:12px;padding:20px">
                <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px">
                  <span style="font-size:14px;font-weight:700;color:#c4a55a">${p.pillar}</span>
                  <span style="font-size:12px;color:#64a87c;font-weight:600">${p.percentage}</span>
                </div>
                <div style="font-size:12px;color:#9a9080;margin-bottom:12px">${p.description}</div>
                <div style="display:flex;flex-wrap:wrap;gap:6px">
                  ${(p.examples || []).map((e: string) => `<span style="font-size:11px;padding:3px 8px;background:rgba(196,165,90,0.08);border:1px solid rgba(196,165,90,0.15);border-radius:4px;color:#b8a868">${e}</span>`).join("")}
                </div>
              </div>`).join("");

            const msgs = bb.messagingFramework || {};
            const keyMsgs = (msgs.keyMessages || []).map((m: string) => `<li>${m}</li>`).join("");
            const headlines = (msgs.headlines || []).map((h: string) => `<div style="padding:14px 18px;background:rgba(196,165,90,0.05);border-left:3px solid #c4a55a;border-radius:0 8px 8px 0;margin-bottom:10px;font-size:14px;color:#d4c888;font-style:italic">"${h}"</div>`).join("");

            const ton = bb.toneOfVoice || {};
            const dosList = (ton.dos || []).map((d: string) => `<li style="color:#64a87c">✓ ${d}</li>`).join("");
            const dontsList = (ton.donts || []).map((d: string) => `<li style="color:#c86464">✗ ${d}</li>`).join("");

            const sm = bb.socialMedia || {};
            const smCards = Object.entries(sm).map(([net, data]: [string, any]) => `
              <div style="background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.08);border-radius:10px;padding:16px">
                <div style="font-size:13px;font-weight:700;color:#c4a55a;margin-bottom:8px;text-transform:capitalize">${net}</div>
                <div style="font-size:12px;color:#8a8070;margin-bottom:8px">${data.tone || data.format || ""}</div>
                ${data.hashtags ? `<div style="display:flex;flex-wrap:wrap;gap:4px">${(data.hashtags || []).map((h: string) => `<span style="font-size:11px;color:#64a87c;background:rgba(100,168,124,0.08);padding:2px 6px;border-radius:4px">${h}</span>`).join("")}</div>` : ""}
                ${data.contentTypes ? `<div style="font-size:11px;color:#7a7068;margin-top:8px">${(data.contentTypes || []).join(" · ")}</div>` : ""}
              </div>`).join("");

            const brandBookHtml = `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>Brand Book — ${bb.brandName || safeBrandName}</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,400;0,600;0,700;1,400&family=Inter:wght@300;400;500;600;700&display=swap');
    *{box-sizing:border-box;margin:0;padding:0}
    body{background:#0a0a0a;color:#e0d8cc;font-family:'Inter',sans-serif;line-height:1.7}
    .bb-section{max-width:960px;margin:0 auto;padding:60px 40px}
    .section-divider{border:none;border-top:1px solid rgba(196,165,90,0.15);margin:50px 0}
    .section-tag{font-size:11px;color:#c4a55a;font-weight:600;letter-spacing:3px;text-transform:uppercase;margin-bottom:12px}
    h1{font-family:'Playfair Display',serif;font-size:3rem;color:#fff;margin-bottom:16px;line-height:1.2}
    h2{font-family:'Playfair Display',serif;font-size:1.8rem;color:#c4a55a;margin-bottom:20px}
    h3{font-size:1rem;font-weight:600;color:#d4b870;margin-bottom:12px;text-transform:uppercase;letter-spacing:1px}
    p{color:#b8b0a0;margin-bottom:14px;font-size:14px;max-width:700px}
    .hero{background:linear-gradient(135deg,#0a0a0a 0%,#141008 50%,#0a0a0a 100%);padding:100px 40px;text-align:center;position:relative;overflow:hidden}
    .hero::before{content:'';position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);width:600px;height:600px;background:radial-gradient(circle,rgba(196,165,90,0.08) 0%,transparent 70%);pointer-events:none}
    .tagline{font-size:1.1rem;color:#c4a55a;font-style:italic;font-family:'Playfair Display',serif;margin-bottom:30px}
    .grid-2{display:grid;grid-template-columns:1fr 1fr;gap:24px}
    .grid-3{display:grid;grid-template-columns:repeat(3,1fr);gap:20px}
    .grid-auto{display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:20px}
    .card{background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.08);border-radius:14px;padding:24px}
    .card-gold{background:rgba(196,165,90,0.06);border:1px solid rgba(196,165,90,0.2);border-radius:14px;padding:24px}
    .quote-block{border-left:3px solid #c4a55a;padding:16px 20px;margin:20px 0;background:rgba(196,165,90,0.05);border-radius:0 10px 10px 0;font-style:italic;color:#c8b880;font-size:14px}
    .personality-tag{display:inline-block;padding:8px 16px;background:rgba(196,165,90,0.1);border:1px solid rgba(196,165,90,0.3);border-radius:20px;font-size:12px;color:#c4a55a;font-weight:500;margin:4px}
    .do-dont{display:grid;grid-template-columns:1fr 1fr;gap:20px;margin-top:16px}
    .do-box{background:rgba(100,168,124,0.06);border:1px solid rgba(100,168,124,0.2);border-radius:10px;padding:16px}
    .dont-box{background:rgba(200,100,100,0.06);border:1px solid rgba(200,100,100,0.2);border-radius:10px;padding:16px}
    .do-box h4{color:#64a87c;font-size:12px;margin-bottom:10px;text-transform:uppercase;letter-spacing:1px}
    .dont-box h4{color:#c86464;font-size:12px;margin-bottom:10px;text-transform:uppercase;letter-spacing:1px}
    ul.styled{list-style:none;padding:0}
    ul.styled li{padding:5px 0;font-size:13px;border-bottom:1px solid rgba(255,255,255,0.04)}
    ul.styled li:last-child{border:none}
    .font-sample{font-size:2rem;color:#e0d8cc;margin:8px 0;line-height:1.3}
    .font-meta{font-size:11px;color:#6a6058}
    .competitor-card{background:rgba(255,255,255,0.02);border:1px solid rgba(255,255,255,0.06);border-radius:10px;padding:16px;display:flex;justify-content:space-between;align-items:center;gap:16px;margin-bottom:10px}
    .footer-bb{text-align:center;padding:40px;color:#3a3028;font-size:11px;border-top:1px solid rgba(255,255,255,0.05);margin-top:60px}
    @media print{body{background:#fff;color:#000}h1,h2,h3{color:#000}.hero{background:#f0ede8;padding:60px 40px}.card,.card-gold{border:1px solid #ddd;background:#fafafa}}
  </style>
</head>
<body>

<!-- ── PORTADA ── -->
${buildCoverPage({ reportTitle: `Brand Book`, reportSubtitle: `${bbRaw.brandName || brandName} · Manual de Identidad de Marca`, companyName: bbRaw.brandName || brandName, date: reportDate, template: "prestige", includeBackCover: false })}

<!-- ── HERO ── -->
<div class="hero">
  <div class="bb-section" style="padding:0;max-width:800px">
    <div class="section-tag">Brand Book · Identidad de Marca</div>
    <h1>${bb.brandName || safeBrandName}</h1>
    <div class="tagline">"${bb.tagline || ""}"</div>
    <p style="max-width:600px;margin:0 auto;text-align:center;font-size:15px;color:#9a9080">${sanitizeHtml((bbRaw.mission || "").slice(0, 200))}</p>
  </div>
</div>

<div class="bb-section">

  <!-- ── 1. HISTORIA Y PROPÓSITO ── -->
  <div class="section-tag">01 · Propósito</div>
  <h2>Misión, Visión & Origen</h2>
  <div class="grid-2" style="margin-bottom:30px">
    <div class="card-gold">
      <h3>Misión</h3>
      <p style="max-width:none">${bb.mission || ""}</p>
    </div>
    <div class="card">
      <h3>Visión</h3>
      <p style="max-width:none">${bb.vision || ""}</p>
    </div>
  </div>
  <div class="quote-block">${(bb.brandStory || "").split("\n").slice(0, 2).join(" ")}</div>
  <p>${(bb.brandStory || "").split("\n").slice(2).join(" ")}</p>

  <hr class="section-divider"/>

  <!-- ── 2. VALORES ── -->
  <div class="section-tag">02 · Valores</div>
  <h2>Los Pilares de la Marca</h2>
  <div class="grid-3" style="margin-bottom:10px">${valuesCards}</div>

  <hr class="section-divider"/>

  <!-- ── 3. ARQUETIPO & PERSONALIDAD ── -->
  <div class="section-tag">03 · Personalidad</div>
  <h2>Arquetipo de Marca</h2>
  <div class="grid-2" style="margin-bottom:30px">
    <div class="card-gold">
      <h3>Arquetipo: ${(bb.archetype || {}).name || ""}</h3>
      <p style="max-width:none">${(bb.archetype || {}).description || ""}</p>
      <div style="margin-top:12px;font-size:12px;color:#8a8070">Marcas similares: ${((bb.archetype || {}).examples || []).join(", ")}</div>
    </div>
    <div class="card">
      <h3>Rasgos de Personalidad</h3>
      <div style="margin-top:8px">${(bb.personality || []).map((t: string) => `<span class="personality-tag">${t}</span>`).join("")}</div>
    </div>
  </div>

  <hr class="section-divider"/>

  <!-- ── 4. TONO DE VOZ ── -->
  <div class="section-tag">04 · Comunicación</div>
  <h2>Tono de Voz</h2>
  <div class="card-gold" style="margin-bottom:20px">
    <h3>${ton.primary || "Tono Principal"}</h3>
    <p style="max-width:none">${ton.description || ""}</p>
  </div>
  <div class="do-dont">
    <div class="do-box"><h4>✓ Hacer</h4><ul class="styled">${dosList}</ul></div>
    <div class="dont-box"><h4>✗ Evitar</h4><ul class="styled">${dontsList}</ul></div>
  </div>

  <hr class="section-divider"/>

  <!-- ── 5. PALETA DE COLOR ── -->
  <div class="section-tag">05 · Identidad Visual</div>
  <h2>Paleta de Color</h2>
  <div class="grid-auto" style="margin-bottom:30px">${colorSwatches || "<p>Paleta a definir</p>"}</div>

  <!-- ── 6. TIPOGRAFÍA ── -->
  <div style="margin-top:40px">
    <h3>Sistema Tipográfico</h3>
    <div class="grid-3">
      ${(bb.typography?.primary ? `<div class="card"><div class="section-tag">Principal</div><div class="font-sample" style="font-family:'${cssFontName(bbRaw.typography.primary.name)}',serif">${bb.typography.primary.name}</div><div class="font-meta">Pesos: ${(bb.typography.primary.weights||[]).join(", ")}<br>${bb.typography.primary.usage}</div></div>` : "")}
      ${(bb.typography?.secondary ? `<div class="card"><div class="section-tag">Secundaria</div><div class="font-sample" style="font-family:'${cssFontName(bbRaw.typography.secondary.name)}',sans-serif;font-size:1.5rem">${bb.typography.secondary.name}</div><div class="font-meta">Pesos: ${(bb.typography.secondary.weights||[]).join(", ")}<br>${bb.typography.secondary.usage}</div></div>` : "")}
      ${(bb.typography?.accent ? `<div class="card"><div class="section-tag">Acento</div><div class="font-sample" style="font-family:'${cssFontName(bbRaw.typography.accent.name)}',cursive;font-size:1.5rem">${bb.typography.accent.name}</div><div class="font-meta">${bb.typography.accent.usage}</div></div>` : "")}
    </div>
  </div>

  <hr class="section-divider"/>

  <!-- ── 7. LOGO & USOS ── -->
  <div class="section-tag">06 · Logo</div>
  <h2>Directrices del Logotipo</h2>
  <div class="grid-2">
    <div class="card">
      <h3>Variaciones</h3>
      <ul class="styled">${((bb.logoGuidelines||{}).variations||[]).map((v: string) => `<li>${v}</li>`).join("")}</ul>
    </div>
    <div class="card">
      <h3>Normas de Uso</h3>
      <p style="max-width:none;font-size:13px">Espacio mínimo: ${(bb.logoGuidelines||{}).clearSpace || "–"}</p>
      <p style="max-width:none;font-size:13px">Tamaño mínimo: ${(bb.logoGuidelines||{}).minSize || "–"}</p>
      <p style="max-width:none;font-size:13px;color:#c86464;margin-top:8px">Prohibido: ${((bb.logoGuidelines||{}).prohibitions||[]).join(", ")}</p>
    </div>
  </div>

  <hr class="section-divider"/>

  <!-- ── 8. AUDIENCIA ── -->
  <div class="section-tag">07 · Audiencia</div>
  <h2>Público Objetivo</h2>
  <div class="grid-2">
    ${bb.targetAudience?.primary ? `<div class="card-gold">
      <h3>Primario: ${bb.targetAudience.primary.name || ""}</h3>
      <p style="max-width:none;font-size:13px;color:#c4a55a">${bb.targetAudience.primary.age || ""}</p>
      <p style="max-width:none;font-size:13px">${bb.targetAudience.primary.profile || ""}</p>
      <div style="margin-top:12px"><h4 style="font-size:11px;color:#c86464;text-transform:uppercase;letter-spacing:1px;margin-bottom:6px">Pain Points</h4><ul class="styled">${(bb.targetAudience.primary.painPoints||[]).map((p: string) => `<li>${p}</li>`).join("")}</ul></div>
      <div style="margin-top:12px"><h4 style="font-size:11px;color:#64a87c;text-transform:uppercase;letter-spacing:1px;margin-bottom:6px">Deseos</h4><ul class="styled">${(bb.targetAudience.primary.desires||[]).map((d: string) => `<li>${d}</li>`).join("")}</ul></div>
    </div>` : ""}
    ${bb.targetAudience?.secondary ? `<div class="card">
      <h3>Secundario: ${bb.targetAudience.secondary.name || ""}</h3>
      <p style="max-width:none;font-size:13px">${bb.targetAudience.secondary.profile || ""}</p>
    </div>` : ""}
  </div>

  <hr class="section-divider"/>

  <!-- ── 9. PILARES DE CONTENIDO ── -->
  <div class="section-tag">08 · Contenido</div>
  <h2>Pilares de Contenido</h2>
  <div class="grid-2" style="margin-bottom:20px">${pillarCards}</div>

  <!-- ── 10. REDES SOCIALES ── -->
  <div style="margin-top:40px">
    <h3>Estrategia en Redes Sociales</h3>
    <div class="grid-3">${smCards}</div>
  </div>

  <hr class="section-divider"/>

  <!-- ── 11. MENSAJERÍA ── -->
  <div class="section-tag">09 · Mensajes Clave</div>
  <h2>Marco de Mensajería</h2>
  <div class="card-gold" style="margin-bottom:24px">
    <h3>Propuesta de Valor</h3>
    <p style="max-width:none;font-size:15px;color:#e8d898">${msgs.valueProposition || ""}</p>
  </div>
  <div class="card" style="margin-bottom:24px">
    <h3>Elevator Pitch (30 segundos)</h3>
    <p style="max-width:none;font-style:italic;color:#c4a55a">"${msgs.elevator || ""}"</p>
  </div>
  <h3 style="margin-bottom:12px">Mensajes Clave</h3>
  <ul class="styled" style="margin-bottom:24px">${keyMsgs}</ul>
  <h3 style="margin-bottom:12px">Titulares de Marca</h3>
  ${headlines}

  <hr class="section-divider"/>

  <!-- ── 12. POSICIONAMIENTO ── -->
  <div class="section-tag">10 · Posicionamiento</div>
  <h2>Ventaja Competitiva</h2>
  <div class="card-gold" style="margin-bottom:20px">
    <h3>Posición Única</h3>
    <p style="max-width:none">${(bb.competitivePositioning || {}).position || ""}</p>
    <div style="display:flex;flex-wrap:wrap;gap:8px;margin-top:12px">
      ${((bb.competitivePositioning || {}).differentiators || []).map((d: string) => `<span class="personality-tag">${d}</span>`).join("")}
    </div>
  </div>
  ${((bb.competitivePositioning || {}).competitors || []).map((c: {name:string;difference:string}) => `<div class="competitor-card"><span style="font-size:13px;font-weight:600;color:#c4a55a;min-width:120px">${c.name}</span><span style="font-size:13px;color:#8a8070">${c.difference}</span></div>`).join("")}

  <!-- ── FOOTER ── -->
  <div class="footer-bb">
    Brand Book · ${bb.brandName || safeBrandName} · Generado por Shopy Crafter Intelligence Engine · ${reportDate}<br>
    Documento confidencial — uso interno y para agencias autorizadas.
  </div>
</div>
</body>
</html>`;

            // Guardar en Vault
            let vaultId: number | null = null;
            if (projectId) {
              vaultId = await saveToVault({
                projectId,
                fileType: "brand_book",
                category: "branding",
                title: `Brand Book — ${bbRaw.brandName || brandName}`,
                mimeType: "text/html",
                content: Buffer.from(brandBookHtml).toString("base64"),
              });
            }

            result = {
              success: true,
              brandName: bbRaw.brandName || brandName,
              tagline: bbRaw.tagline || "",
              archetype: (bbRaw.archetype || {}).name || "",
              colorsCount: bbRaw.colorPalette.length,
              valuesCount: bbRaw.values.length,
              vaultId,
              vaultUrl: vaultId ? `/api/vault/${vaultId}/download` : undefined,
              message: vaultId
                ? `📖 **Brand Book generado y guardado**\n\n🏷️ **${bbRaw.brandName || brandName}** — "${bbRaw.tagline}"\n🎭 Arquetipo: **${(bbRaw.archetype||{}).name}**\n🎨 ${bbRaw.colorPalette.length} colores | 💡 ${bbRaw.values.length} valores | 📣 ${(bbRaw.contentPillars || []).length} pilares de contenido\n\n💾 **Guardado en el Vault** (ID: ${vaultId})\n🌐 Ver Brand Book: /api/vault/${vaultId}/view\n📥 Descargar PDF: /api/vault/${vaultId}/download?format=pdf`
                : `📖 **Brand Book generado**\n\n🏷️ **${bbRaw.brandName || brandName}** — "${bbRaw.tagline}"\n🎭 Arquetipo: **${(bbRaw.archetype||{}).name}**\n🎨 ${bbRaw.colorPalette.length} colores | 💡 ${bbRaw.values.length} valores\n\n⚠️ No se pudo guardar en vault (falta projectId)`,
            };
          } catch (err) {
            const reason = isAiOutputError(err) ? aiOutputErrorMessage(err) : err instanceof Error ? err.message : String(err);
            result = { error: true, message: `❌ Error generando Brand Book: ${reason}` };
          }
          break;
        }

        case "generate_comedian_video": {
          const { script: ysScript, voiceId: ysVoiceId, style: ysStyle, voiceSettings: ysVs } = params || {};
          if (!ysScript) { res.json({ error: "script requerido para generar vídeo" }); return; }
          const port = process.env.PORT || 8080;
          const ytR = await fetch(`http://localhost:${port}/api/youtube/modelo/comedian-gen`, {
            method: "POST",
            headers: { "Content-Type": "application/json", "Cookie": req.headers.cookie || "" },
            body: JSON.stringify({ script: ysScript, voiceId: ysVoiceId || "8m4O8qoFLrKBzbmsuL5T", style: ysStyle || "monologo", voiceSettings: ysVs }),
          });
          const ytD = await ytR.json() as any;
          result = ytD.error
            ? { error: true, message: `❌ Error generando vídeo comedian: ${ytD.error}` }
            : { success: true, savedAs: ytD.savedAs, publicUrl: ytD.publicUrl, audioDuration: ytD.audioDuration, clipsGenerated: ytD.clipsGenerated, message: `🎬 Vídeo monologuista generado: ${ytD.clipsGenerated} clips Seedance I2V, ${ytD.audioDuration?.toFixed(1)}s, guardado: ${ytD.savedAs}` };
          break;
        }

        case "list_modelo_voices": {
          const port = process.env.PORT || 8080;
          const vR = await fetch(`http://localhost:${port}/api/youtube/modelo/voices`, {
            headers: { "Cookie": req.headers.cookie || "" },
          });
          const vD = await vR.json() as any;
          result = { voices: vD.voices, message: `🎙️ ${vD.voices?.length || 0} voces disponibles en ElevenLabs:\n${(vD.voices || []).map((v: any) => `• ${v.name}${v.category === "cloned" ? " ★" : ""} (${v.voice_id})`).join("\n")}` };
          break;
        }

        case "speech_to_speech_dub": {
          const { referenceVideoUrl: stsUrl, voiceId: stsVoiceId, doFaceSwap: stsFaceSwap } = params || {};
          if (!stsUrl) { res.json({ error: "referenceVideoUrl requerido" }); return; }
          result = { message: `⚠️ El dubbing STS requiere que el vídeo de referencia sea subido desde la UI de YouTube Studio → tab 'Modelo IA' → Pipeline B → 🎙️ Dubbing Real STS.\n\nVoiceId a usar: ${stsVoiceId || "8m4O8qoFLrKBzbmsuL5T"}, Face-swap: ${stsFaceSwap ? "sí" : "no"}` };
          break;
        }

        case "generate_video": {
          const projectId = params?.projectId;
          const prompt = params?.prompt;
          if (!projectId) { result = { error: "projectId requerido para generar vídeo" }; break; }
          if (!prompt) { result = { error: "prompt requerido — describe el vídeo que quieres crear" }; break; }
          const vidModel = params?.model ?? "grok-imagine-video";
          const vidDuration = Math.min(Math.max(Number(params?.duration ?? 5), 5), 10);
          const vidAspect = params?.aspect ?? "9:16";
          const vidImageUrl = params?.imageUrl ?? "";
          const port = process.env.PORT || 8080;
          const vidRes = await fetch(`http://localhost:${port}/api/fusion-studio/generate-video`, {
            method: "POST",
            headers: { "Content-Type": "application/json", cookie: req.headers.cookie || "" },
            body: JSON.stringify({
              projectId: parseInt(projectId),
              promptText: prompt,
              model: vidModel,
              duration: vidDuration,
              ratio: vidAspect,
              imageUrl: vidImageUrl,
            }),
          });
          const vidData = await vidRes.json() as any;
          if (!vidRes.ok || vidData.error) {
            result = { error: true, message: `❌ Error generando vídeo: ${vidData.error || vidRes.statusText}` };
            break;
          }
          const vidUrl = vidData.videoUrl || vidData.url || "";
          result = {
            videoUrl: vidUrl,
            vaultId: vidData.vaultId,
            model: vidData.model || vidModel,
            durationSec: vidData.durationSec || vidDuration,
            aspect: vidAspect,
            message: `🎬 **Vídeo generado** con ${vidData.model || vidModel}\n⏱️ ${vidData.durationSec || vidDuration}s · ${vidAspect}${vidUrl ? `\n📥 [Descargar vídeo](${vidUrl})\n[VIDEO:Vídeo IA](${vidUrl})` : ""}${vidData.vaultId ? `\n💾 Guardado en Vault #${vidData.vaultId}` : ""}`,
          };
          break;
        }

        default:
          return NOT_HANDLED;
      }
  return result;
}
