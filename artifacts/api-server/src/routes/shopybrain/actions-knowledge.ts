// Acciones del cerebro — Cerebro, investigación, skills, catálogo de IA y documentos.
// Extraídas tal cual del switch de POST /shopybrain/execute-action (routes/shopybrain.ts).
/* eslint-disable @typescript-eslint/no-explicit-any */
import { db, omnicoreMemoriesTable, projectsTable } from "@workspace/db";
import { eq, desc, gte, sql } from "drizzle-orm";
import { logger } from "../../lib/logger.js";
import { saveToVault } from "../../lib/vault.js";
import {
  getSessionProjectId
} from "../../lib/shopybrain-helpers.js";

import { NOT_HANDLED, type BrainActionCtx, type BrainActionOutcome } from "./action-context.js";

export async function runKnowledgeActions(ctx: BrainActionCtx): Promise<BrainActionOutcome> {
  const { req, res, action, params, resolveStripeAccountId } = ctx;
  let result: Record<string, unknown> = {};
      switch (action) {
        case "brain_sync": {
          const syncUrl = params?.url as string;
          const syncApiKey = params?.apiKey as string | undefined;
          const syncSource = params?.source as string | undefined;
          if (!syncUrl) {
            result = { error: true, message: "URL requerida. Ejemplo: brain_sync {url: 'https://comic-crafter.myshopify.com', apiKey: 'sck_...'}" };
            break;
          }
          try {
            const { syncFromExternalBrain } = await import("../brain-sync.js");
            const syncResult = await syncFromExternalBrain(syncUrl, syncApiKey, syncSource);
            if (!syncResult.success) {
              result = { error: true, message: `❌ ${syncResult.error || "No se pudo sincronizar"}${syncResult.errors?.length ? `\n${syncResult.errors.join("\n")}` : ""}` };
              break;
            }
            const s = syncResult.stats!;
            result = {
              ...syncResult,
              message: `🧠 **Sincronización completada desde ${syncUrl}**\n📥 Importados: ${s.memoriesImported} memorias, ${s.insightsImported} insights, ${s.domainsImported} dominios, ${s.promptsImported} prompts\n⏭️ Duplicados saltados: ${s.duplicatesSkipped}\n📄 Páginas procesadas: ${syncResult.totalPages}`,
            };
          } catch (err) {
            result = { error: true, message: `❌ Error en brain_sync: ${err instanceof Error ? err.message : String(err)}` };
          }
          break;
        }

        case "brain_stats": {
          try {
            const { getBrainStats } = await import("../brain-sync.js");
            const stats = await getBrainStats();
            const memorySources = stats.memorySources as Record<string, number> || {};
            const insightsByDomain = stats.insightsByDomain as Record<string, number> || {};
            const topDomains = Object.entries(insightsByDomain).sort((a, b) => b[1] - a[1]).slice(0, 10);
            result = {
              ...stats,
              message: `🧠 **Estado de Shopy Crafter**\n\n📦 **${stats.totalMemories}** memorias\n💡 **${stats.totalInsights}** insights\n🏷️ **${stats.totalDomains}** dominios\n📝 **${stats.totalPrompts}** prompts\n🎯 **${stats.totalNicheProfiles}** perfiles de nicho\n🔗 **${stats.totalCrossConnections}** conexiones cruzadas\n\n📊 **Top dominios:**\n${topDomains.map(([d, c]) => `  • ${d}: ${c} insights`).join("\n")}\n\n🔍 **Fuentes de memorias:**\n${Object.entries(memorySources).map(([s, c]) => `  • ${s}: ${c}`).join("\n")}`,
            };
          } catch (err) {
            result = { error: true, message: `❌ Error obteniendo stats: ${err instanceof Error ? err.message : String(err)}` };
          }
          break;
        }

        case "brain_export": {
          try {
            const { getExportData } = await import("../brain-sync.js");
            const domain = params?.domain as string | undefined;
            const exportData = await getExportData({ domain });
            const s = exportData.stats;
            result = {
              exportData,
              message: `📤 **Exportación de Shopy Crafter**\n\n📦 Memorias: ${s.totalMemories}\n💡 Insights: ${s.totalInsights}\n🏷️ Dominios: ${s.totalDomains}\n📝 Prompts: ${s.totalPrompts}\n\n${domain ? `🔍 Filtrado por dominio: ${domain}` : "📋 Exportación completa"}`,
            };
          } catch (err) {
            result = { error: true, message: `❌ Error exportando: ${err instanceof Error ? err.message : String(err)}` };
          }
          break;
        }

        case "learn_from_url": {
          const url = params?.url as string;
          if (!url) { result = { error: true, message: "❌ Falta url" }; break; }
          try {
            const baseUrl = `http://localhost:${process.env.PORT || 8080}`;
            const resp = await fetch(`${baseUrl}/api/shopybrain/absorb-url`, {
              method: "POST",
              headers: { "Content-Type": "application/json", cookie: req.headers.cookie ?? "" },
              body: JSON.stringify({ url, label: params?.label }),
            });
            const data = await resp.json() as Record<string, unknown>;
            if (!resp.ok) throw new Error(String(data.error ?? "Error absorbiendo URL"));
            result = {
              ...data,
              message: `🧠 **URL absorbida con éxito**\n\nHe analizado y aprendido de: ${url}\n\n${data.title ? `**Título:** ${data.title}\n` : ""}${data.memoriesCreated ? `**Memorias creadas:** ${data.memoriesCreated}\n` : ""}Este conocimiento ya está integrado en mi cerebro y lo usaré en futuras respuestas.`,
            };
          } catch (err) { result = { error: true, message: `❌ Error absorbiendo URL: ${err instanceof Error ? err.message : String(err)}` }; }
          break;
        }

        case "learn_from_content": {
          const content = params?.content as string;
          if (!content) { result = { error: true, message: "❌ Falta content" }; break; }
          try {
            const baseUrl = `http://localhost:${process.env.PORT || 8080}`;
            const resp = await fetch(`${baseUrl}/api/shopybrain/absorb-text`, {
              method: "POST",
              headers: { "Content-Type": "application/json", cookie: req.headers.cookie ?? "" },
              body: JSON.stringify({ text: content, label: params?.label, contentType: params?.contentType }),
            });
            const data = await resp.json() as Record<string, unknown>;
            if (!resp.ok) throw new Error(String(data.error ?? "Error absorbiendo contenido"));
            result = {
              ...data,
              message: `🧠 **Contenido absorbido con éxito**\n\n${params?.label ? `**Tema:** ${params.label}\n` : ""}He procesado y memorizado ${String(content).length} caracteres de conocimiento.\nEsto ya forma parte de mi memoria permanente.`,
            };
          } catch (err) { result = { error: true, message: `❌ Error: ${err instanceof Error ? err.message : String(err)}` }; }
          break;
        }

        case "recall_knowledge": {
          const query = params?.query as string;
          if (!query) { result = { error: true, message: "❌ Falta query" }; break; }
          try {
            const limit = Math.min(Number(params?.limit) || 10, 30);
            const memories = await db.select().from(omnicoreMemoriesTable)
              .where(gte(omnicoreMemoriesTable.confidence, 0.3))
              .orderBy(desc(omnicoreMemoriesTable.confidence))
              .limit(200);
  
            const queryLower = query.toLowerCase();
            const queryTerms = queryLower.split(/\s+/).filter(t => t.length > 2);
            const scored = memories.map(m => {
              const text = `${m.title ?? ""} ${m.content ?? ""} ${m.memoryType ?? ""} ${m.tags ?? ""}`.toLowerCase();
              let score = 0;
              for (const term of queryTerms) {
                if (text.includes(term)) score += 1;
              }
              if (text.includes(queryLower)) score += 3;
              return { ...m, relevanceScore: score };
            }).filter(m => m.relevanceScore > 0).sort((a, b) => b.relevanceScore - a.relevanceScore).slice(0, limit);
  
            const formatted = scored.map((m, i) => `${i + 1}. **${m.title}** (${m.memoryType}, confianza: ${m.confidence})\n   ${String(m.content).slice(0, 300)}`).join("\n\n");
  
            result = {
              memories: scored.length,
              results: scored,
              message: `🔍 **${scored.length} memorias encontradas** para "${query}"\n\n${formatted || "No encontré memorias relevantes para esta búsqueda."}`,
            };
          } catch (err) { result = { error: true, message: `❌ Error: ${err instanceof Error ? err.message : String(err)}` }; }
          break;
        }

        case "brain_status": {
          try {
            const totalMemories = await db.select({ count: sql<number>`count(*)` }).from(omnicoreMemoriesTable);
            const byType = await db.select({
              memoryType: omnicoreMemoriesTable.memoryType,
              count: sql<number>`count(*)`,
              avgConfidence: sql<number>`round(avg(${omnicoreMemoriesTable.confidence})::numeric, 2)`,
            }).from(omnicoreMemoriesTable).groupBy(omnicoreMemoriesTable.memoryType).orderBy(desc(sql`count(*)`));
  
            const recentMemories = await db.select({
              title: omnicoreMemoriesTable.title,
              memoryType: omnicoreMemoriesTable.memoryType,
              confidence: omnicoreMemoriesTable.confidence,
              createdAt: omnicoreMemoriesTable.createdAt,
            }).from(omnicoreMemoriesTable).orderBy(desc(omnicoreMemoriesTable.createdAt)).limit(10);
  
            const total = Number(totalMemories[0]?.count ?? 0);
            const typeBreakdown = byType.map(t => `• **${t.memoryType}**: ${t.count} (confianza avg: ${t.avgConfidence})`).join("\n");
            const recentList = recentMemories.map((m, i) => `${i + 1}. ${m.title?.slice(0, 80)} (${m.memoryType})`).join("\n");
  
            result = {
              totalMemories: total,
              byType,
              recentMemories,
              message: `🧠 **Estado de Shopy Crafter**\n\n**Total memorias:** ${total.toLocaleString()}\n\n**Distribución por tipo:**\n${typeBreakdown}\n\n**Últimas 10 memorias aprendidas:**\n${recentList}\n\n💡 El cerebro crece con cada interacción. Cada acción, conversación y URL absorbida alimenta el conocimiento.`,
            };
          } catch (err) { result = { error: true, message: `❌ Error: ${err instanceof Error ? err.message : String(err)}` }; }
          break;
        }

        case "get_ai_models": {
          const { getAIModelMatrix, KNOWN_MODELS } = await import("../../lib/ai-models.js");
          const matrix = await getAIModelMatrix();
          result = {
            success: true,
            matrix,
            catalog: KNOWN_MODELS,
            message: "🧠 Matriz de modelos AI activa (claude/gemini × fast/smart/genius/vision).",
          };
          break;
        }

        case "set_ai_model": {
          const provider = String(params?.provider || "");
          const tier = String(params?.tier || "");
          const model = params?.model === null || params?.model === undefined ? null : String(params?.model);
          if (provider !== "claude" && provider !== "gemini" && provider !== "xai") {
            res.status(400).json({ error: "provider debe ser 'claude', 'gemini' o 'xai'" });
            return;
          }
          if (!["fast", "smart", "genius", "vision"].includes(tier)) {
            res.status(400).json({ error: "tier debe ser uno de fast|smart|genius|vision" });
            return;
          }
          const { setAIModelOverride, getAIModelMatrix } = await import("../../lib/ai-models.js");
          await setAIModelOverride(provider as any, tier as any, model);
          const matrix = await getAIModelMatrix();
          result = {
            success: true,
            provider, tier, model,
            matrix,
            message: model
              ? `✅ ${provider}.${tier} → ${model}`
              : `🧹 Override eliminado para ${provider}.${tier} (vuelve a env/default).`,
          };
          break;
        }

        case "upload_file": {
          const fileContext: string = params?.fileContext || "";
          const fileContent: string = (req.body as any)?.fileContent || (req.body as any)?.fileData || "";
          const fileName: string = (req.body as any)?.fileName || params?.fileName || "archivo";
          const fileType: string = (req.body as any)?.fileType || params?.fileType || "desconocido";

          if (!fileContent && !fileContext) {
            result = {
              error: false,
              message: "📎 Para procesar un archivo, adjúntalo al chat usando el botón de clip o indica qué archivo quieres subir.\n\n**Formatos soportados:** CSV, Excel (.xlsx), PDF, JSON, imágenes (PNG/JPG), TXT.\n\n¿Qué tipo de archivo quieres analizar?"
            };
            break;
          }

          try {
            const { askClaude } = await import("../../lib/claude.js");
            let analysisPrompt = "";

            if (fileContent) {
              // Tenemos contenido real del archivo
              const preview = fileContent.length > 8000 ? fileContent.slice(0, 8000) + "\n\n[... contenido truncado]" : fileContent;
              analysisPrompt = `Analiza el siguiente contenido de archivo "${fileName}" (tipo: ${fileType}):\n\n${preview}\n\n${fileContext ? `Contexto adicional del usuario: ${fileContext}` : ""}\n\nProporciona:\n1. Resumen de lo que contiene el archivo\n2. Estructura detectada (columnas, campos, secciones)\n3. Datos clave o insights relevantes\n4. Acciones recomendadas basadas en el contenido\n5. Si es CSV/Excel: estadísticas básicas (filas, columnas, valores únicos)`;
            } else {
              // Solo contexto textual, el usuario describe el archivo
              analysisPrompt = `El usuario quiere subir/procesar un archivo con la siguiente descripción: "${fileContext}"\n\nOrientale sobre:\n1. Cómo puede subir el archivo al chat\n2. Qué puede hacer el sistema con ese tipo de archivo\n3. Qué información puede extraer automáticamente`;
            }

            // Antes: askClaude(analysisPrompt, { maxTokens }) con los argumentos cambiados
            // (el texto como projectId): el análisis de archivos fallaba siempre.
            const analysis = await askClaude(getSessionProjectId(req, params), [{ role: "user", content: analysisPrompt }], undefined, 2000);

            result = {
              fileName,
              fileType,
              hasContent: !!fileContent,
              contentLength: fileContent.length,
              analysis,
              message: fileContent
                ? `📄 **${fileName}** procesado (${fileContent.length} caracteres)\n\n${analysis}`
                : analysis
            };
          } catch (e: any) {
            result = { error: e.message || "Error procesando el archivo" };
          }
          break;
        }

        case "browser_research": {
          const topic: string = params?.topic || params?.query || "investigación general";
          const projectId = params?.projectId ? Number(params.projectId) : (req.session as any)?.projectId;
          const reportTitle: string = params?.reportTitle || `Investigación: ${topic}`;
          const reportStyle: string = params?.style || "professional";

          // Construir queries de búsqueda inteligentes
          const queries: string[] = params?.queries?.length ? params.queries : [topic];
          if (queries.length === 1) {
            queries.push(`${topic} guía completa 2025 2026`);
            queries.push(`${topic} análisis expertos últimas noticias`);
          }

          try {
            // ── MOTOR DE BÚSQUEDA: Gemini Google Search Grounding ──────────────
            // Reemplaza Puppeteer (bloqueado por Google) con la API nativa de búsqueda.
            const { askGeminiWithSearch } = await import("../../lib/gemini.js");

            const geminiSystemPrompt = reportStyle === "fun"
              ? `Eres un investigador experto y redactor creativo. Busca información REAL y ACTUAL sobre el tema. Recopila el máximo de datos específicos, ejemplos, chistes, anécdotas o contenido relevante que encuentres. Devuelve los hallazgos en texto estructurado detallado en español.`
              : `Eres un investigador y analista experto. Busca información REAL, ACTUAL y VERIFICADA sobre el tema. Incluye datos concretos, estadísticas, ejemplos reales, expertos citados, tendencias actuales. Devuelve los hallazgos en texto estructurado detallado en español.`;

            // Lanzar 3 búsquedas en paralelo — una por query
            const searchResults = await Promise.allSettled(
              queries.slice(0, 3).map(q =>
                askGeminiWithSearch(
                  `Investiga exhaustivamente sobre: "${q}". Proporciona información detallada, actualizada y verificada. Incluye datos concretos, ejemplos, estadísticas y fuentes relevantes.`,
                  geminiSystemPrompt,
                )
              )
            );

            // Recopilar texto y fuentes de todas las búsquedas exitosas
            const allSources: string[] = [];
            const allSearchQueries: string[] = [];
            const rawParts: string[] = [];

            searchResults.forEach((r, i) => {
              if (r.status === "fulfilled" && r.value.text.length > 50) {
                rawParts.push(`### Búsqueda ${i + 1}: "${queries[i]}"\n\n${r.value.text}`);
                allSources.push(...r.value.sources);
                allSearchQueries.push(...r.value.queries);
              }
            });

            const rawContent = rawParts.join("\n\n---\n\n").slice(0, 50000);
            const uniqueSources = [...new Set(allSources)].filter(Boolean);

            if (!rawContent) {
              result = { error: true, message: `❌ No se encontró información sobre "${topic}". Intenta con un tema más específico.` };
              break;
            }

            // ── SÍNTESIS: Claude convierte investigación en informe HTML ──────
            const synthesisPrompt = reportStyle === "fun"
              ? `Eres un experto en redacción creativa y entretenimiento.
                 Con la siguiente información investigada sobre "${topic}", genera un RECOPILATORIO completo y entretenido.
                 Si son chistes o humor: preséntalo numerado "1. ..." "2. ..." con cada elemento en su propio párrafo claro.
                 Si es otro contenido: adapta el tono divertido con secciones temáticas.
                 IMPORTANTE: Usa TODO el contenido investigado real. No inventes datos que no estén en la investigación.
                 Formato: HTML limpio con <h2>, <p>, <ol>/<ul>, <blockquote>. Solo el cuerpo interior, sin DOCTYPE ni <html>.`
              : `Eres un analista experto con 20 años de experiencia.
                 Con la siguiente información REAL investigada sobre "${topic}", redacta un INFORME PROFESIONAL COMPLETO.
                 OBLIGATORIO:
                 - Usa los datos reales encontrados, cita fuentes específicas donde los hayas
                 - Mínimo 1500 palabras con contenido real, no genérico
                 - Incluye: Resumen ejecutivo, Contexto actual, Análisis por secciones (5+), Datos y estadísticas reales, Conclusiones
                 - Formato: HTML con <h2>, <h3>, <p>, <ul>, <ol>, <strong>, <blockquote>
                 - Solo el cuerpo interior, sin DOCTYPE ni <html>`;

            const { askClaude: ask } = await import("../../lib/claude.js");
            const synthesizedHtml = await ask(
              0,
              [{ role: "user" as const, content: rawContent }],
              synthesisPrompt,
              6000,
              undefined,
              { tier: "smart" as any },
            );

            // ── HTML COMPLETO ─────────────────────────────────────────────────
            const { buildCoverPage } = await import("../../lib/report-cover.js");
            const reportDate = new Date().toLocaleDateString("es-ES", { day: "2-digit", month: "long", year: "numeric" });
            const sourcesHtml = uniqueSources
              .slice(0, 20)
              .map(url => `<li><a href="${url}" target="_blank" style="color:#c4a55a;">${url}</a></li>`)
              .join("\n");

            const fullHtml = `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>${reportTitle}</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;600;700&family=Inter:wght@300;400;500;600&display=swap');
    *{box-sizing:border-box;margin:0;padding:0}
    body{background:#0d0d0d;color:#e8e0d0;font-family:'Inter',sans-serif;line-height:1.8;font-size:15px}
    .report-body{max-width:900px;margin:0 auto;padding:60px 40px}
    h1{font-family:'Playfair Display',serif;font-size:2.2rem;color:#c4a55a;margin-bottom:1rem;line-height:1.3}
    h2{font-family:'Playfair Display',serif;font-size:1.5rem;color:#c4a55a;margin:2.5rem 0 1rem;padding-bottom:0.5rem;border-bottom:1px solid rgba(196,165,90,0.3)}
    h3{font-size:1.1rem;color:#d4b870;margin:1.5rem 0 0.7rem;font-weight:600}
    p{margin-bottom:1.2rem;color:#d4ccc0}
    ul,ol{margin:1rem 0 1.2rem 2rem;color:#d4ccc0}
    li{margin-bottom:0.5rem}
    blockquote{border-left:3px solid #c4a55a;padding:1rem 1.5rem;margin:1.5rem 0;background:rgba(196,165,90,0.07);border-radius:0 8px 8px 0;font-style:italic;color:#c8b980}
    strong{color:#e8d898;font-weight:600}
    em{color:#b8d4b0}
    .meta-bar{background:rgba(196,165,90,0.08);border:1px solid rgba(196,165,90,0.2);border-radius:10px;padding:16px 24px;margin:2rem 0;display:flex;gap:24px;flex-wrap:wrap}
    .meta-item{font-size:12px;color:#8a8070}.meta-item span{color:#c4a55a;font-weight:600}
    .sources{background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.08);border-radius:10px;padding:24px;margin-top:3rem}
    .sources h2{color:#9a9080;font-size:1rem;border-bottom-color:rgba(154,144,128,0.3)}
    .sources ul{color:#7a7068;font-size:13px;list-style:none;margin-left:0}
    .sources li{word-break:break-all;margin-bottom:0.7rem}
    .footer-brand{text-align:center;padding:3rem 0 1rem;color:#4a4038;font-size:12px;border-top:1px solid rgba(255,255,255,0.05);margin-top:3rem}
    @media print{body{background:#fff;color:#000}.report-body{padding:20px}h1,h2,h3{color:#000}blockquote{border-left-color:#000;background:#f5f5f5}}
  </style>
</head>
<body>
${buildCoverPage({ reportTitle, reportSubtitle: `Investigación generada por IA — ${reportDate}`, companyName: "Shopy Crafter Research", date: reportDate, template: "prestige", includeBackCover: false })}
<div class="report-body">
  <div class="meta-bar">
    <div class="meta-item">📅 Fecha: <span>${reportDate}</span></div>
    <div class="meta-item">🔍 Fuentes: <span>${uniqueSources.length} fuentes web reales</span></div>
    <div class="meta-item">📊 Queries: <span>${queries.slice(0, 3).join(" | ")}</span></div>
    <div class="meta-item">🤖 IA: <span>Gemini Search + Claude Genius</span></div>
  </div>
  
  ${synthesizedHtml}
  
  ${sourcesHtml ? `<div class="sources"><h2>📚 Fuentes Consultadas (${uniqueSources.length})</h2><ul>${sourcesHtml}</ul></div>` : ""}
  
  <div class="footer-brand">
    Generado por Shopy Crafter Intelligence Engine · ${reportDate}<br>
    Investigación real con Google Search Grounding (Gemini) + síntesis con Claude AI.
  </div>
</div>
</body>
</html>`;

            // ── GUARDAR EN VAULT ──────────────────────────────────────────────
            let vaultId: number | null = null;
            let vaultUrl: string | undefined;
            if (projectId) {
              vaultId = await saveToVault({
                projectId,
                fileType: "report",
                category: "research",
                title: reportTitle,
                mimeType: "text/html",
                content: Buffer.from(fullHtml).toString("base64"),
              });
              if (vaultId) vaultUrl = `/api/vault/${vaultId}/download`;
            }

            result = {
              success: true,
              topic,
              reportTitle,
              sourcesCount: uniqueSources.length,
              queriesUsed: [...new Set(allSearchQueries)].slice(0, 6),
              vaultId,
              vaultUrl,
              htmlPreview: synthesizedHtml.slice(0, 500) + "...",
              message: vaultId
                ? `📊 **Informe de investigación generado y guardado**\n\n📋 **${reportTitle}**\n🔍 ${uniqueSources.length} fuentes web reales consultadas\n📁 Queries: ${queries.slice(0, 3).join(" | ")}\n\n💾 **Guardado en el Vault** (ID: ${vaultId})\n🌐 Ver informe: ${vaultUrl?.replace(/\/download$/, "/view")}\n📥 Descargar PDF: ${vaultUrl}?format=pdf`
                : `📊 **Informe de investigación generado**\n\n${synthesizedHtml.replace(/<[^>]+>/g, " ").slice(0, 800)}`,
            };
          } catch (err) {
            result = { error: true, message: `❌ Error en investigación: ${err instanceof Error ? err.message : String(err)}` };
          }
          break;
        }

        case "browser_action": {
          const { executeBrowserAgent, BrowserRecipes, extractYoutubeVideoId, resolveYoutubeWatchUrl } = await import("../../lib/browser-agent.js");
          const goal: string = params?.goal || "Navegar a una página web";
          let steps = params?.steps;

          const gLower = goal.toLowerCase();
          const rawDirectUrl: string | null = params?.url || (/^https?:\/\//i.test(goal.trim()) ? goal.trim() : null);
          // Solo permitimos http(s) — nunca javascript:/data:/file: etc.
          const isSafeHttpUrl = (u: unknown): u is string => {
            if (typeof u !== "string") return false;
            try { const p = new URL(u); return p.protocol === "http:" || p.protocol === "https:"; }
            catch { return false; }
          };
          const directUrl: string | null = isSafeHttpUrl(rawDirectUrl) ? rawDirectUrl : null;
          const wantsScrape = !!params?.scrapeUrl || /scrap|extrae|extraer|analiz|qué dice|que dice|contenido de|texto de/i.test(gLower);
          const hasExplicitSteps = Array.isArray(steps) && steps.length > 0;

          // ── FAST PATH 1: "abrir/poner/reproducir" en YouTube → resolver URL real
          // del vídeo vía HTML (sin Playwright ni YouTube Data API). El frontend
          // abre una pestaña real con reproducción automática.
          if (!hasExplicitSteps && /youtube/.test(gLower) && !wantsScrape) {
            const searchMatch = goal.match(/(?:busca?r?|search|pon|play|reproduce|abre?|encuentra?|escucha|quiero(?:\s+escuchar)?)\s+(?:en\s+youtube\s+)?(.+?)(?:\s+en\s+youtube)?$/i);
            const ytQuery = (searchMatch?.[1] || goal.replace(/\b(en\s+)?youtube\b/ig, "").replace(/\b(abre?|abrir|pon|reproduce|play|busca?r?|escucha)\b/ig, "").trim()) || goal;
            const yt = await resolveYoutubeWatchUrl(ytQuery);
            if (yt) {
              result = {
                success: true,
                goal,
                openUrl: yt.watchUrl,
                finalUrl: yt.watchUrl,
                youtubeEmbed: yt.embedUrl,
                title: yt.title,
                browserType: "fast-resolver",
                message: `▶️ **Abriendo en YouTube**: ${yt.title || ytQuery}\n\n🔗 ${yt.watchUrl}\n\nSe abre en una pestaña nueva con reproducción automática.`,
              };
              break;
            }
            // Si el resolver falla, caemos al agente Chromium como respaldo.
            steps = BrowserRecipes.youtubeSearch(ytQuery);
          }

          // ── FAST PATH 2: abrir una URL directa (sin scraping) → devolver openUrl
          if (!hasExplicitSteps && !steps && directUrl && !wantsScrape) {
            result = {
              success: true,
              goal,
              openUrl: directUrl,
              finalUrl: directUrl,
              browserType: "fast-resolver",
              message: `🌐 **Abriendo**: ${directUrl}\n\nSe abre en una pestaña nueva.`,
            };
            break;
          }

          // Si no vienen steps explícitos, usar recetas automáticas según goal
          if (!steps || !Array.isArray(steps) || steps.length === 0) {
            const g = goal.toLowerCase();
            if (/youtube/.test(g)) {
              // Extraer query de búsqueda del goal
              const searchMatch = goal.match(/(?:busca?r?|search|pon|play|reproduce|abre?|encuentra?)\s+(?:en\s+youtube\s+)?(.+?)(?:\s+en\s+youtube)?$/i);
              const ytQuery = searchMatch?.[1] || goal;
              steps = BrowserRecipes.youtubeSearch(ytQuery);
            } else if (/google|buscar|search/.test(g)) {
              const searchMatch = goal.match(/(?:busca?r?|search)\s+(?:en\s+google\s+)?(.+?)(?:\s+en\s+google)?$/i);
              const googleQuery = searchMatch?.[1] || goal;
              steps = BrowserRecipes.googleSearch(googleQuery);
            } else if (/^https?:\/\//.test(goal) || params?.url) {
              steps = BrowserRecipes.openUrl(params?.url || goal);
            } else if (params?.scrapeUrl) {
              steps = BrowserRecipes.webScrape(params.scrapeUrl, params?.selector);
            } else {
              // Búsqueda Google genérica
              steps = BrowserRecipes.googleSearch(goal);
            }
          }

          try {
            const agentResult = await executeBrowserAgent({
              goal,
              steps,
              viewport: params?.viewport,
              timeout: params?.timeout || 30000,
            });

            const screenshots = agentResult.screenshots.map((s: { label: string; base64: string }) => ({
              label: s.label,
              dataUrl: `data:image/jpeg;base64,${s.base64}`,
            }));

            // Si hay URL de YouTube, extraer video ID para embed
            let youtubeEmbed: string | undefined;
            if (agentResult.finalUrl) {
              const ytId = extractYoutubeVideoId(agentResult.finalUrl);
              if (ytId) youtubeEmbed = `https://www.youtube.com/embed/${ytId}`;
            }

            result = {
              success: agentResult.success,
              goal,
              finalUrl: agentResult.finalUrl,
              // Solo auto-abrimos en el navegador si NO era una tarea de scraping.
              openUrl: wantsScrape ? undefined : agentResult.finalUrl,
              screenshots,
              youtubeEmbed,
              extractedText: agentResult.extractedText?.slice(0, 2000),
              stepsExecuted: agentResult.steps.length,
              stepsOk: agentResult.steps.filter((s: { success: boolean }) => s.success).length,
              message: agentResult.success
                ? `🌐 **Tarea de navegación completada**\n\n${agentResult.summary}\n${agentResult.finalUrl ? `\n🔗 URL: ${agentResult.finalUrl}` : ""}${youtubeEmbed ? "\n\n▶️ Video encontrado — incrustado abajo." : ""}`
                : `❌ **Error en navegación**: ${agentResult.error}\n\n${agentResult.summary}`,
              browserType: "chromium",
            };
          } catch (err) {
            result = { error: true, message: `❌ Error al lanzar el agente de navegación: ${err instanceof Error ? err.message : String(err)}` };
          }
          break;
        }

        case "security_skill": {
          const { skillId, query: secQuery } = params as { skillId?: string; query?: string };
          if (!skillId) { result = { error: "skillId requerido. Usa security_skill_search para encontrar el ID exacto." }; break; }
          const { getSkillContent, getCybersecCatalog, searchCybersecSkills } = await import("../../lib/cybersec-knowledge.js");
          const content = getSkillContent(skillId);
          if (!content) {
            const suggestions = searchCybersecSkills(skillId, 6);
            result = { error: `Skill "${skillId}" no encontrada.`, suggestions: suggestions.map(s => ({ id: s.id, description: s.description, subdomain: s.subdomain })) };
            break;
          }
          const meta = getCybersecCatalog().find((s: any) => s.id === skillId);
          result = { skillId, name: meta?.name || skillId, description: meta?.description, subdomain: meta?.subdomain, tags: meta?.tags, mitre_attack: meta?.mitre_attack, overview: meta?.overview, when_to_use: meta?.when_to_use, content, queryContext: secQuery };
          break;
        }

        case "security_skill_search": {
          const { query: secQ, domain: secDomain } = params as { query?: string; domain?: string };
          const { searchCybersecSkills, getCybersecCatalog, getCybersecDomains } = await import("../../lib/cybersec-knowledge.js");
          let secResults = secQ ? searchCybersecSkills(secQ, 20) : getCybersecCatalog();
          if (secDomain) secResults = secResults.filter((s: any) => s.subdomain === secDomain);
          const domains = getCybersecDomains();
          result = {
            total: secResults.length,
            skills: secResults.slice(0, 15).map((s: any) => ({ id: s.id, name: s.name, description: s.description, subdomain: s.subdomain, tags: s.tags?.slice(0, 4), mitre_attack: s.mitre_attack?.slice(0, 3), when_to_use: s.when_to_use })),
            domains: domains.slice(0, 15),
            hint: "Usa security_skill con el id exacto para obtener la guía técnica completa.",
          };
          break;
        }

        case "agent_skill": {
          const { skillId: agSkillId, query: agQuery } = params as { skillId?: string; query?: string };
          if (!agSkillId) { result = { error: "skillId requerido. Usa agent_skill_search para encontrar el ID exacto." }; break; }
          const { getAgentSkillContent, getAgentSkillsCatalog, searchAgentSkills } = await import("../../lib/agent-skills-knowledge.js");
          const agContent = getAgentSkillContent(agSkillId);
          if (!agContent) {
            const agSuggestions = searchAgentSkills(agSkillId, 6);
            result = { error: `Skill "${agSkillId}" no encontrada.`, suggestions: agSuggestions.map(s => ({ id: s.id, description: s.description, category: s.category })) };
            break;
          }
          const agMeta = getAgentSkillsCatalog().find((s) => s.id === agSkillId);
          result = {
            skillId: agSkillId,
            name: agMeta?.name || agSkillId,
            description: agMeta?.description,
            category: agMeta?.category,
            content: agContent,
            queryContext: agQuery,
            instruction: "Sigue estas instrucciones REALES al pie de la letra para completar la tarea del usuario. Si la skill produce un documento de oficina (Word/Excel/PowerPoint), usa a continuación la acción generate_office_document para generar el archivo real.",
          };
          break;
        }

        case "agent_skill_search": {
          const { query: agQ, category: agCategory } = params as { query?: string; category?: string };
          const { searchAgentSkills, getAgentSkillsCatalog, getAgentSkillCategories } = await import("../../lib/agent-skills-knowledge.js");
          let agResults = agQ ? searchAgentSkills(agQ, 20) : getAgentSkillsCatalog().filter(s => s.category !== "meta");
          if (agCategory) agResults = agResults.filter((s) => s.category === agCategory);
          const agCategories = getAgentSkillCategories();
          result = {
            total: agResults.length,
            skills: agResults.slice(0, 15).map((s) => ({ id: s.id, name: s.name, description: s.description, category: s.category })),
            categories: agCategories,
            hint: "Usa agent_skill con el id exacto para obtener la guía completa y ejecutarla.",
          };
          break;
        }

        case "generate_office_document": {
          const {
            projectId: goProjectIdRaw, format: goFormat, title: goTitle, subtitle: goSubtitle, sections: goSections,
          } = params as { projectId?: number | string; format?: string; title?: string; subtitle?: string; sections?: any[] };
          const goProjectId = goProjectIdRaw ? parseInt(String(goProjectIdRaw), 10) : null;
          if (!goProjectId) { result = { error: "projectId requerido" }; break; }
          if (!goTitle || !Array.isArray(goSections) || goSections.length === 0) {
            result = { error: "title y sections (array de {heading, paragraphs?, bullets?, table?}) son requeridos" };
            break;
          }
          const goFmt = (["docx", "xlsx", "pptx"].includes(String(goFormat)) ? goFormat : "docx") as "docx" | "xlsx" | "pptx";
          try {
            const { generateOfficeDocument } = await import("../../lib/office-document-generator.js");
            const { buffer: goBuf, mimeType: goMime, extension: goExt } = await generateOfficeDocument(goFmt, {
              title: goTitle, subtitle: goSubtitle, sections: goSections,
            });
            const goVaultId = await saveToVault({
              projectId: goProjectId,
              fileType: `agent_skill_${goFmt}`,
              category: "agent_skills",
              title: goTitle,
              description: `Documento ${goFmt.toUpperCase()} generado por skill de agencia`,
              mimeType: goMime,
              fileSizeBytes: goBuf.length,
              content: goBuf.toString("base64"),
              generatedBy: "agent_skill:generate_office_document",
            });
            result = {
              ok: true,
              vaultId: goVaultId,
              format: goExt,
              sizeBytes: goBuf.length,
              message: `✅ Documento .${goExt} generado y guardado en el Vault del proyecto (${(goBuf.length / 1024).toFixed(1)} KB). Puedes descargarlo desde la sección Vault.`,
            };
          } catch (goErr: any) {
            result = { error: true, message: `❌ Error generando documento: ${goErr?.message || goErr}` };
          }
          break;
        }

        case "security_scan_website": {
          const projectId = parseInt(String(params?.projectId), 10);
          const [secProject] = await db.select().from(projectsTable).where(eq(projectsTable.id, projectId));
          if (!secProject) { result = { error: "Proyecto no encontrado" }; break; }

          const rawSecUrl = (params?.url as string | undefined) || secProject.shopDomain;
          const secUrl = rawSecUrl.startsWith("http") ? rawSecUrl : `https://${rawSecUrl}`;

          const { validateAuditUrl } = await import("../../lib/web-scraper.js");
          const secUrlError = validateAuditUrl(secUrl);
          if (secUrlError) { result = { error: secUrlError }; break; }

          const { runSecurityScan } = await import("../../lib/security-scanner.js");
          const scanResult = await runSecurityScan(secUrl);

          let savedScanId: number | null = null;
          try {
            const { securityScansTable } = await import("@workspace/db");
            const [savedScan] = await db.insert(securityScansTable).values({
              projectId,
              url: scanResult.url,
              score: scanResult.score,
              findings: scanResult.findings,
              techStack: scanResult.techStack,
              summary: `Score ${scanResult.score}/100 — ${scanResult.countsBySeverity.critical} críticos, ${scanResult.countsBySeverity.high} altos, ${scanResult.countsBySeverity.medium} medios, ${scanResult.countsBySeverity.low} bajos`,
            }).returning();
            savedScanId = savedScan.id;
          } catch (e) {
            logger.warn({ err: e }, "[security_scan_website] no se pudo persistir el escaneo");
          }

          result = {
            scanId: savedScanId,
            url: scanResult.url,
            score: scanResult.score,
            countsBySeverity: scanResult.countsBySeverity,
            techStack: scanResult.techStack,
            findings: scanResult.findings.map(f => ({
              severity: f.severity,
              category: f.category,
              title: f.title,
              description: f.description,
              evidence: f.evidence,
              attackerPerspective: f.attackerPerspective,
              hardeningSteps: f.hardeningSteps,
              mitreAttack: f.mitreAttack,
              nistCsf: f.nistCsf,
              relatedSkills: f.relatedSkills,
            })),
            instructions: "Narra estos hallazgos al usuario priorizados por severidad (critical > high > medium > low > info). Para cada uno explica brevemente 'cómo lo explotaría un atacante' (attackerPerspective) y luego el plan de blindaje (hardeningSteps). Cierra con un resumen ejecutivo y el score general.",
          };
          break;
        }

        case "ai_catalog_stats": {
          try {
            const { getCatalogStats } = await import("../../lib/ai-model-intelligence.js");
            const stats = await getCatalogStats();
            const byCategory = (stats.by_category as Array<{ category: string; cnt: string }>).map(r => `  • ${r.category}: ${r.cnt}`).join("\n");
            const byProvider = (stats.by_provider as Array<{ provider: string; cnt: string }>).map(r => `  • ${r.provider}: ${r.cnt}`).join("\n");
            result = { ...stats, message: `🤖 **Catálogo de Modelos IA**\n\n**Total activos:** ${stats.total}\n**Updates hoy:** ${stats.recent_updates}\n\n**Por categoría:**\n${byCategory}\n\n**Por proveedor:**\n${byProvider}` };
          } catch (err) { result = { error: true, message: `❌ Error: ${err instanceof Error ? err.message : String(err)}` }; }
          break;
        }

        case "ai_catalog_research": {
          try {
            const { runAiModelResearch } = await import("../../lib/ai-model-intelligence.js");
            runAiModelResearch()
              .then(s => logger.info({ summary: s }, "AI Model Research completado"))
              .catch(e => logger.error({ err: e }, "AI Model Research error"));
            result = { success: true, message: "🔬 **Investigación de modelos IA iniciada** en segundo plano.\n\nEl sistema está consultando:\n• Replicate (kwaivgi, black-forest-labs, minimax, stability-ai...)\n• OpenAI, Gemini, ElevenLabs, xAI, Freepik\n• Gemini Search para anuncios de nuevos modelos\n\nConsulta el estado con `ai_catalog_stats` en ~2 minutos." };
          } catch (err) { result = { error: true, message: `❌ Error: ${err instanceof Error ? err.message : String(err)}` }; }
          break;
        }

        case "ai_model_route": {
          const taskType = params?.task ?? params?.taskType;
          const budget   = params?.budget ?? "balanced";
          if (!taskType) { result = { error: true, message: "❌ Falta task (ej: product_photography, video_generation, text_to_speech)" }; break; }
          try {
            const { getBestModelForTask } = await import("../../lib/ai-model-intelligence.js");
            const recs = await getBestModelForTask(String(taskType), budget as "economy" | "balanced" | "quality");
            if (!recs.length) { result = { error: true, message: `❌ No hay reglas de routing para task: ${taskType}` }; break; }
            const lines = recs.map((r, i) => `${i === 0 ? "⭐" : "  "} **${r.display_name}** (${r.provider}) — ${r.cost_tier}${r.fallback ? ` · fallback: ${r.fallback}` : ""}`).join("\n");
            result = { recommendations: recs, message: `🎯 **Mejor modelo para "${taskType}" · ${budget}:**\n\n${lines}\n\n_Usa el primero (⭐) para el resultado óptimo._` };
          } catch (err) { result = { error: true, message: `❌ Error: ${err instanceof Error ? err.message : String(err)}` }; }
          break;
        }

        case "ai_catalog_list": {
          const category = params?.category;
          const budget   = params?.budget;
          const search   = params?.search ?? params?.query;
          try {
            const { getCatalogModels } = await import("../../lib/ai-model-intelligence.js");
            const models = await getCatalogModels({ category: category as string | undefined, budget: budget as "economy" | "balanced" | "quality" | undefined, search: search as string | undefined, limit: 30 });
            const lines = models.map(m => `• **${m.display_name}** (${m.provider}) — Q:${m.quality_score} S:${m.speed_score} E:${m.economy_score} · $${Number(m.cost_per_unit).toFixed(4)}/${m.cost_unit}`).join("\n");
            result = { models, total: models.length, message: `📋 **${models.length} modelos${category ? " · " + category : ""}${budget ? " · " + budget : ""}:**\n\n${lines || "(sin resultados)"}` };
          } catch (err) { result = { error: true, message: `❌ Error: ${err instanceof Error ? err.message : String(err)}` }; }
          break;
        }

        default:
          return NOT_HANDLED;
      }
  return result;
}
