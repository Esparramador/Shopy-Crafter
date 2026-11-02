// Acciones del cerebro — Temas de Shopify.
// Extraídas tal cual del switch de POST /shopybrain/execute-action (routes/shopybrain.ts).
/* eslint-disable @typescript-eslint/no-explicit-any */
import { db, projectsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { learnFromOperation } from "../../lib/claude.js";

import { NOT_HANDLED, type BrainActionCtx, type BrainActionOutcome } from "./action-context.js";

export async function runThemeActions(ctx: BrainActionCtx): Promise<BrainActionOutcome> {
  const { req, res, action, params, resolveStripeAccountId } = ctx;
  let result: Record<string, unknown> = {};
      switch (action) {
        case "list_themes": {
          const projectId = params?.projectId;
          if (!projectId) { res.status(400).json({ error: "projectId requerido" }); return; }
          const [proj] = await db.select().from(projectsTable).where(eq(projectsTable.id, parseInt(projectId)));
          if (!proj) { res.status(404).json({ error: "Proyecto no encontrado" }); return; }
          const { listThemes } = await import("../../lib/shopify-theme.js");
          const themes = await listThemes(parseInt(projectId), proj.shopDomain);
          result = {
            themes: themes.map(t => ({ id: t.id, name: t.name, role: t.role, updated: t.updated_at })),
            activeTheme: themes.find(t => t.role === "main")?.name ?? "ninguno",
            message: `📋 **${themes.length} themes encontrados:**\n${themes.map(t => `• ${t.name} (${t.role === "main" ? "🟢 ACTIVO" : t.role}) — ID: ${t.id}`).join("\n")}`,
          };
          break;
        }

        case "list_theme_files": {
          const projectId = params?.projectId;
          if (!projectId) { res.status(400).json({ error: "projectId requerido" }); return; }
          const [proj] = await db.select().from(projectsTable).where(eq(projectsTable.id, parseInt(projectId)));
          if (!proj) { res.status(404).json({ error: "Proyecto no encontrado" }); return; }
          const { getActiveTheme, getThemeStructureSummary } = await import("../../lib/shopify-theme.js");
          let themeId = params?.themeId ? parseInt(params.themeId) : undefined;
          if (!themeId) {
            const active = await getActiveTheme(parseInt(projectId), proj.shopDomain);
            if (!active) { res.status(404).json({ error: "No se encontró theme activo" }); return; }
            themeId = active.id;
          }
          const structureSummary = await getThemeStructureSummary(parseInt(projectId), proj.shopDomain, themeId);
          const directory = params?.directory as string | undefined;
          let filteredFiles: string[] = [];
          if (directory) {
            const tree = structureSummary.fileTree;
            filteredFiles = (tree as unknown as Record<string, string[]>)[directory] ?? [];
          }
          result = {
            themeId,
            ...structureSummary,
            filteredFiles: directory ? filteredFiles : undefined,
            message: directory
              ? `📁 **${filteredFiles.length} archivos en ${directory}/:**\n${filteredFiles.map(f => `• ${f}`).join("\n")}`
              : `🗂️ **Estructura del theme (${structureSummary.totalFiles} archivos):**\n${structureSummary.summary}`,
          };
          break;
        }

        case "read_theme_file": {
          const projectId = params?.projectId;
          const assetKey = params?.assetKey as string;
          if (!projectId || !assetKey) { res.status(400).json({ error: "projectId y assetKey requeridos (ej: assetKey='sections/header.liquid')" }); return; }
          const [proj] = await db.select().from(projectsTable).where(eq(projectsTable.id, parseInt(projectId)));
          if (!proj) { res.status(404).json({ error: "Proyecto no encontrado" }); return; }
          const { getActiveTheme, readThemeFile, analyzeThemeFileContent, categorizeFile } = await import("../../lib/shopify-theme.js");
          let themeId = params?.themeId ? parseInt(params.themeId) : undefined;
          if (!themeId) {
            const active = await getActiveTheme(parseInt(projectId), proj.shopDomain);
            if (!active) { res.status(404).json({ error: "No se encontró theme activo" }); return; }
            themeId = active.id;
          }
          const asset = await readThemeFile(parseInt(projectId), proj.shopDomain, themeId, assetKey);
          if (!asset || !asset.value) {
            result = { error: true, message: `❌ No se pudo leer el archivo '${assetKey}'. Verifica que existe con list_theme_files.` };
            break;
          }
          const fileInfo = categorizeFile(assetKey);
          const analysis = analyzeThemeFileContent(assetKey, asset.value);
          const fullContent = asset.value;
          const preview = fullContent.length > 4000 ? fullContent.slice(0, 4000) + "\n\n... [vista previa truncada, archivo completo tiene " + analysis.lineCount + " líneas]" : fullContent;
          result = {
            assetKey,
            themeId,
            fileType: fileInfo.type,
            fileDescription: fileInfo.description,
            lineCount: analysis.lineCount,
            analysis: {
              liquidTags: analysis.liquidTags,
              includes: analysis.includes,
              sections: analysis.sections,
              schemaBlocks: analysis.schemaBlocks,
              cssSelectors: analysis.cssSelectors.slice(0, 20),
              warnings: analysis.warnings,
            },
            content: fullContent,
            preview,
            message: `📄 **${assetKey}** (${fileInfo.description}, ${analysis.lineCount} líneas)\n${analysis.warnings.length > 0 ? `⚠️ ${analysis.warnings.join("; ")}` : "✅ Sin advertencias"}\n${analysis.liquidTags.length > 0 ? `🏷️ Liquid tags: ${analysis.liquidTags.join(", ")}` : ""}\n${analysis.includes.length > 0 ? `📎 Incluye: ${analysis.includes.join(", ")}` : ""}\n${analysis.schemaBlocks.length > 0 ? `🔧 Schema: ${analysis.schemaBlocks.join(", ")}` : ""}`,
          };
          break;
        }

        case "edit_theme_file": {
          const projectId = params?.projectId;
          const assetKey = params?.assetKey as string;
          const editType = (params?.editType as string) ?? "smart_edit";
          const oldCode = params?.oldCode as string | undefined;
          const newCode = params?.newCode as string;
          const description = params?.description as string;
          if (!projectId || !assetKey || !newCode) { res.status(400).json({ error: "projectId, assetKey y newCode requeridos" }); return; }
          const [proj] = await db.select().from(projectsTable).where(eq(projectsTable.id, parseInt(projectId)));
          if (!proj) { res.status(404).json({ error: "Proyecto no encontrado" }); return; }
          const { getActiveTheme, readThemeFile, writeThemeFile, categorizeFile, intelligentMerge } = await import("../../lib/shopify-theme.js");
          let themeId = params?.themeId ? parseInt(params.themeId) : undefined;
          if (!themeId) {
            const active = await getActiveTheme(parseInt(projectId), proj.shopDomain);
            if (!active) { res.status(404).json({ error: "No se encontró theme activo" }); return; }
            themeId = active.id;
          }
  
          const currentAsset = await readThemeFile(parseInt(projectId), proj.shopDomain, themeId, assetKey);
          const currentContent = currentAsset?.value ?? "";
          const fileInfo = categorizeFile(assetKey);
          let finalContent = newCode;
          const changeLog: string[] = [];
  
          if (editType === "replace_block" && oldCode) {
            if (!currentContent.includes(oldCode)) {
              result = { error: true, message: `❌ No se encontró el bloque a reemplazar en '${assetKey}'. Usa read_theme_file para ver el contenido actual y copia el texto EXACTO.` };
              break;
            }
            finalContent = currentContent.replace(oldCode, () => newCode);
            changeLog.push(`Bloque reemplazado (${oldCode.length} chars → ${newCode.length} chars)`);
          } else if (editType === "add_css") {
            finalContent = currentContent.trimEnd() + "\n\n/* " + (description ?? "Añadido por Shopy Crafter") + " */\n" + newCode.trim() + "\n";
            changeLog.push("CSS añadido al final del archivo");
          } else if (editType === "modify_section") {
            if (oldCode && currentContent.includes(oldCode)) {
              finalContent = currentContent.replace(oldCode, () => newCode);
              changeLog.push("Sección modificada (replace_block)");
            } else {
              const mergeResult = intelligentMerge(currentContent, description ?? "", newCode, fileInfo.type);
              finalContent = mergeResult.merged;
              changeLog.push(...mergeResult.changes);
            }
          } else if (editType === "update_settings") {
            const mergeResult = intelligentMerge(currentContent, description ?? "", newCode, "json");
            finalContent = mergeResult.merged;
            changeLog.push(...mergeResult.changes);
          } else if (editType === "full_replace") {
            finalContent = newCode;
            changeLog.push("Contenido reemplazado completamente");
          } else {
            if (oldCode && currentContent.includes(oldCode)) {
              finalContent = currentContent.replace(oldCode, () => newCode);
              changeLog.push("Smart edit: bloque encontrado y reemplazado");
            } else if (fileInfo.type === "css") {
              finalContent = currentContent.trimEnd() + "\n\n" + newCode.trim() + "\n";
              changeLog.push("Smart edit: CSS añadido al final");
            } else if (fileInfo.type === "json") {
              const mergeResult = intelligentMerge(currentContent, description ?? "", newCode, "json");
              finalContent = mergeResult.merged;
              changeLog.push(...mergeResult.changes);
            } else if (oldCode && !currentContent.includes(oldCode)) {
              result = { error: true, message: `❌ No se encontró el bloque a reemplazar en '${assetKey}'. Usa read_theme_file para ver el contenido actual y copia el texto EXACTO. Para reemplazar todo el archivo, usa editType="full_replace".` };
              break;
            } else if (!currentContent) {
              finalContent = newCode;
              changeLog.push("Smart edit: archivo nuevo/vacío, contenido escrito");
            } else {
              result = { error: true, message: `❌ Smart edit requiere oldCode para archivos Liquid/JS. Proporciona el bloque exacto a reemplazar, o usa editType="full_replace" para reemplazar todo el contenido.` };
              break;
            }
          }
  
          const written = await writeThemeFile(parseInt(projectId), proj.shopDomain, themeId, assetKey, finalContent);
          if (!written) {
            result = { error: true, message: `❌ Error escribiendo '${assetKey}' en el theme. Verifica permisos (scope write_themes).` };
            break;
          }
          result = {
            assetKey, themeId, editType, changesApplied: changeLog,
            originalLength: currentContent.length,
            newLength: finalContent.length,
            message: `✅ **Archivo editado:** ${assetKey}\n📝 ${description ?? "Cambio aplicado"}\n🔧 ${changeLog.join("; ")}\n📊 ${currentContent.length} → ${finalContent.length} chars`,
          };
          learnFromOperation({
            operationType: "theme_edit",
            title: `Theme edit: ${assetKey}`,
            content: `Editado ${assetKey} (${editType}): ${description ?? changeLog.join("; ")}. ${currentContent.length}→${finalContent.length} chars.`,
            confidence: 0.85,
            tags: ["theme", "edit", assetKey.split("/")[0], fileInfo.type],
          });
          break;
        }

        case "create_theme_section": {
          const projectId = params?.projectId;
          const sectionName = params?.sectionName as string;
          const sectionContent = params?.sectionContent as string;
          if (!projectId || !sectionName || !sectionContent) { res.status(400).json({ error: "projectId, sectionName y sectionContent requeridos" }); return; }
          const [proj] = await db.select().from(projectsTable).where(eq(projectsTable.id, parseInt(projectId)));
          if (!proj) { res.status(404).json({ error: "Proyecto no encontrado" }); return; }
          const { getActiveTheme, writeThemeFile, readThemeFile } = await import("../../lib/shopify-theme.js");
          let themeId = params?.themeId ? parseInt(params.themeId) : undefined;
          if (!themeId) {
            const active = await getActiveTheme(parseInt(projectId), proj.shopDomain);
            if (!active) { res.status(404).json({ error: "No se encontró theme activo" }); return; }
            themeId = active.id;
          }
          const assetKey = `sections/${sectionName.replace(/\.liquid$/, "")}.liquid`;
          const existing = await readThemeFile(parseInt(projectId), proj.shopDomain, themeId, assetKey);
          if (existing?.value) {
            result = { error: true, message: `⚠️ La sección '${sectionName}' ya existe. Usa edit_theme_file para modificarla o elige otro nombre.` };
            break;
          }
          const written = await writeThemeFile(parseInt(projectId), proj.shopDomain, themeId, assetKey, sectionContent);
          if (!written) {
            result = { error: true, message: `❌ Error creando sección '${sectionName}'. Verifica permisos.` };
            break;
          }
          result = {
            assetKey, themeId, sectionName,
            message: `✅ **Sección creada:** ${assetKey}\n📐 ${sectionContent.length} chars\n💡 Para añadirla a una página, edita el template JSON correspondiente con edit_theme_file.`,
          };
          break;
        }

        case "audit_theme": {
          const projectId = params?.projectId;
          if (!projectId) { res.status(400).json({ error: "projectId requerido" }); return; }
          const [proj] = await db.select().from(projectsTable).where(eq(projectsTable.id, parseInt(projectId)));
          if (!proj) { res.status(404).json({ error: "Proyecto no encontrado" }); return; }
          const { getActiveTheme, getThemeStructureSummary, readThemeFile, analyzeThemeFileContent } = await import("../../lib/shopify-theme.js");
          let themeId = params?.themeId ? parseInt(params.themeId) : undefined;
          if (!themeId) {
            const active = await getActiveTheme(parseInt(projectId), proj.shopDomain);
            if (!active) { res.status(404).json({ error: "No se encontró theme activo" }); return; }
            themeId = active.id;
          }
          const structure = await getThemeStructureSummary(parseInt(projectId), proj.shopDomain, themeId);
          const criticalFiles = ["layout/theme.liquid", "config/settings_schema.json", "templates/index.json", "templates/product.json", "templates/collection.json"];
          const fileAnalyses: Record<string, unknown> = {};
          const allWarnings: string[] = [];
          const seoIssues: string[] = [];
          const performanceIssues: string[] = [];
  
          for (const key of criticalFiles) {
            if ([...structure.fileTree.layout, ...structure.fileTree.templates, ...structure.fileTree.config].includes(key)) {
              const file = await readThemeFile(parseInt(projectId), proj.shopDomain, themeId, key);
              if (file?.value) {
                const analysis = analyzeThemeFileContent(key, file.value);
                fileAnalyses[key] = { lineCount: analysis.lineCount, liquidTags: analysis.liquidTags.length, warnings: analysis.warnings };
                allWarnings.push(...analysis.warnings.map(w => `${key}: ${w}`));
  
                if (key === "layout/theme.liquid") {
                  if (!file.value.includes("canonical_url")) seoIssues.push("❌ Falta canonical URL en layout");
                  if (!file.value.includes("page_description")) seoIssues.push("❌ Falta meta description en layout");
                  if (!file.value.includes("content_for_header")) allWarnings.push("⚠️ Falta content_for_header en layout (crítico)");
                  if (!file.value.includes("preconnect")) performanceIssues.push("⚡ Falta preconnect a CDN en layout");
                  if (!file.value.includes("preload")) performanceIssues.push("⚡ No hay preload de recursos críticos");
                }
              }
            }
          }
  
          for (const sectionKey of structure.fileTree.sections.slice(0, 15)) {
            const file = await readThemeFile(parseInt(projectId), proj.shopDomain, themeId, sectionKey);
            if (file?.value) {
              const analysis = analyzeThemeFileContent(sectionKey, file.value);
              if (!file.value.includes("{% schema %}")) allWarnings.push(`${sectionKey}: Sin schema (no configurable en Theme Editor)`);
              if (file.value.includes("{% include ")) allWarnings.push(`${sectionKey}: Usa {% include %} (legacy, migrar a {% render %})`);
              allWarnings.push(...analysis.warnings.map(w => `${sectionKey}: ${w}`));
            }
          }
  
          if (structure.fileTree.sections.length < 5) allWarnings.push("⚠️ Pocas secciones — theme con funcionalidad limitada");
          if (structure.fileTree.snippets.length < 3) allWarnings.push("⚠️ Pocos snippets — código posiblemente duplicado");
  
          let pageSpeedSummary = "";
          try {
            const { runDualPageSpeed } = await import("../../lib/pagespeed.js");
            const storeUrl = proj.shopDomain.includes("://") ? proj.shopDomain : `https://${proj.shopDomain}`;
            const ps = await runDualPageSpeed(storeUrl);
            pageSpeedSummary = ps.summary;
          } catch {}
  
          const auditPrompt = `Analiza esta auditoría de theme Shopify y genera un informe profesional:
  
  ESTRUCTURA: ${structure.summary}
  ARCHIVOS CRÍTICOS ANALIZADOS: ${JSON.stringify(fileAnalyses, null, 2)}
  ADVERTENCIAS: ${allWarnings.join("\n")}
  SEO ISSUES: ${seoIssues.join("\n") || "Ninguno detectado"}
  PERFORMANCE: ${performanceIssues.join("\n") || "Ninguno detectado"}
  ${pageSpeedSummary ? `PAGESPEED: ${pageSpeedSummary}` : ""}
  
  Genera un informe con: puntuación global /100, resumen ejecutivo, problemas críticos, oportunidades SEO, mejoras de rendimiento, y plan de acción prioritizado.`;
  
          let aiAudit = "";
          try {
            const { dualAI } = await import("../../lib/dual-ai.js");
            const dualResult = await dualAI(parseInt(projectId), auditPrompt, {
              mode: "gemini_research_claude_redact",
              claudeSystemPrompt: "Eres un auditor experto de themes Shopify con 10+ años de experiencia. Genera informes detallados y accionables.",
              geminiUseSearch: true,
              maxTokens: 16000,
              useCase: "intelligence",
            });
            aiAudit = dualResult.final;
          } catch {
            aiAudit = `Estructura: ${structure.summary}\nAdvertencias: ${allWarnings.length}\nSEO Issues: ${seoIssues.length}\nPerformance: ${performanceIssues.length}`;
          }
  
          result = {
            themeId,
            structure: structure.summary,
            totalFiles: structure.totalFiles,
            editableFiles: structure.editableFiles,
            warnings: allWarnings,
            seoIssues,
            performanceIssues,
            fileAnalyses,
            aiAudit,
            message: `🔍 **Auditoría del theme completada**\n\n${aiAudit}`,
          };
          learnFromOperation({
            operationType: "seo",
            title: `Theme audit: ${proj.shopDomain}`,
            content: `Auditoría: ${structure.totalFiles} archivos, ${allWarnings.length} advertencias, ${seoIssues.length} SEO issues, ${performanceIssues.length} performance issues.`,
            confidence: 0.9,
            tags: ["theme", "audit", proj.shopDomain],
          });
          break;
        }

        case "edit_theme_css": {
          const projectId = params?.projectId;
          const cssCode = params?.cssCode as string;
          const cssAction = (params?.action as string) ?? "add";
          const selector = params?.selector as string | undefined;
          if (!projectId || !cssCode) { res.status(400).json({ error: "projectId y cssCode requeridos" }); return; }
          const [proj] = await db.select().from(projectsTable).where(eq(projectsTable.id, parseInt(projectId)));
          if (!proj) { res.status(404).json({ error: "Proyecto no encontrado" }); return; }
          const { getActiveTheme, listThemeAssets, readThemeFile, writeThemeFile } = await import("../../lib/shopify-theme.js");
          let themeId = params?.themeId ? parseInt(params.themeId) : undefined;
          if (!themeId) {
            const active = await getActiveTheme(parseInt(projectId), proj.shopDomain);
            if (!active) { res.status(404).json({ error: "No se encontró theme activo" }); return; }
            themeId = active.id;
          }
          let cssFile = params?.cssFile as string | undefined;
          if (!cssFile) {
            const assets = await listThemeAssets(parseInt(projectId), proj.shopDomain, themeId);
            const cssFiles = assets.filter(a => a.key.startsWith("assets/") && (a.key.endsWith(".css") || a.key.endsWith(".scss")));
            const mainCss = cssFiles.find(f => f.key.includes("base") || f.key.includes("main") || f.key.includes("theme") || f.key.includes("custom") || f.key.includes("style"));
            cssFile = mainCss?.key ?? cssFiles[0]?.key;
            if (!cssFile) {
              cssFile = "assets/custom-shopybrain.css";
            }
          }
  
          const current = await readThemeFile(parseInt(projectId), proj.shopDomain, themeId, cssFile);
          let currentContent = current?.value ?? "";
          let finalCss = currentContent;
  
          if (cssAction === "add") {
            finalCss = currentContent.trimEnd() + "\n\n/* Shopy Crafter edit */\n" + cssCode.trim() + "\n";
          } else if (cssAction === "replace" && selector) {
            const escapedSelector = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
            const selectorRegex = new RegExp(`(${escapedSelector}\\s*\\{[^}]*\\})`, "g");
            if (selectorRegex.test(currentContent)) {
              finalCss = currentContent.replace(selectorRegex, cssCode.trim());
            } else {
              finalCss = currentContent.trimEnd() + "\n\n/* Shopy Crafter: selector not found, added new */\n" + cssCode.trim() + "\n";
            }
          } else if (cssAction === "remove_and_add" && selector) {
            const escapedSelector = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
            const selectorRegex = new RegExp(`${escapedSelector}\\s*\\{[^}]*\\}\\s*`, "g");
            finalCss = currentContent.replace(selectorRegex, "").trimEnd() + "\n\n" + cssCode.trim() + "\n";
          }
  
          const written = await writeThemeFile(parseInt(projectId), proj.shopDomain, themeId, cssFile, finalCss);
          result = {
            cssFile, themeId, action: cssAction,
            success: !!written,
            originalLength: currentContent.length,
            newLength: finalCss.length,
            message: written
              ? `✅ **CSS actualizado:** ${cssFile}\n📝 Acción: ${cssAction}${selector ? ` (selector: ${selector})` : ""}\n📊 ${currentContent.length} → ${finalCss.length} chars`
              : `❌ Error escribiendo CSS en ${cssFile}`,
          };
          break;
        }

        case "edit_theme_settings": {
          const projectId = params?.projectId;
          const settingsPath = params?.settingsPath as string;
          const value = params?.value;
          if (!projectId || !settingsPath || value === undefined) { res.status(400).json({ error: "projectId, settingsPath y value requeridos" }); return; }
          const [proj] = await db.select().from(projectsTable).where(eq(projectsTable.id, parseInt(projectId)));
          if (!proj) { res.status(404).json({ error: "Proyecto no encontrado" }); return; }
          const { getActiveTheme, readThemeFile, writeThemeFile } = await import("../../lib/shopify-theme.js");
          let themeId = params?.themeId ? parseInt(params.themeId) : undefined;
          if (!themeId) {
            const active = await getActiveTheme(parseInt(projectId), proj.shopDomain);
            if (!active) { res.status(404).json({ error: "No se encontró theme activo" }); return; }
            themeId = active.id;
          }
          const settingsFile = await readThemeFile(parseInt(projectId), proj.shopDomain, themeId, "config/settings_data.json");
          if (!settingsFile?.value) {
            result = { error: true, message: "❌ No se pudo leer settings_data.json" };
            break;
          }
          try {
            const settings = JSON.parse(settingsFile.value);
            const pathParts = settingsPath.split(".");
            let target: Record<string, unknown> = settings;
            for (let i = 0; i < pathParts.length - 1; i++) {
              const part = pathParts[i];
              if (!(part in target) || typeof target[part] !== "object") {
                target[part] = {};
              }
              target = target[part] as Record<string, unknown>;
            }
            const lastKey = pathParts[pathParts.length - 1];
            const oldValue = target[lastKey];
            if (value && typeof value === "object" && !Array.isArray(value) && oldValue && typeof oldValue === "object" && !Array.isArray(oldValue)) {
              const deepMergeSettings = (a: Record<string, unknown>, b: Record<string, unknown>): Record<string, unknown> => {
                const result = { ...a };
                for (const k of Object.keys(b)) {
                  if (b[k] && typeof b[k] === "object" && !Array.isArray(b[k]) && result[k] && typeof result[k] === "object" && !Array.isArray(result[k])) {
                    result[k] = deepMergeSettings(result[k] as Record<string, unknown>, b[k] as Record<string, unknown>);
                  } else {
                    result[k] = b[k];
                  }
                }
                return result;
              };
              target[lastKey] = deepMergeSettings(oldValue as Record<string, unknown>, value as Record<string, unknown>);
            } else {
              target[lastKey] = value;
            }
            const newSettingsJson = JSON.stringify(settings, null, 2);
            const written = await writeThemeFile(parseInt(projectId), proj.shopDomain, themeId, "config/settings_data.json", newSettingsJson);
            result = {
              settingsPath, oldValue, newValue: value, themeId,
              success: !!written,
              message: written
                ? `✅ **Settings actualizado:** ${settingsPath}\n📝 ${JSON.stringify(oldValue)} → ${JSON.stringify(value)}`
                : `❌ Error escribiendo settings_data.json`,
            };
          } catch (err) {
            result = { error: true, message: `❌ Error parseando settings_data.json: ${err instanceof Error ? err.message : String(err)}` };
          }
          learnFromOperation({
            operationType: "theme_settings_edit",
            title: `Theme settings: ${settingsPath}`,
            content: `Editado setting ${settingsPath} = ${JSON.stringify(value)}`,
            confidence: 0.85,
            tags: ["theme", "settings", "configuration"],
          });
          break;
        }

        case "sync_store_theme": {
          const projectId = params?.projectId;
          if (!projectId) { res.status(400).json({ error: "projectId requerido" }); return; }
          const [proj] = await db.select().from(projectsTable).where(eq(projectsTable.id, parseInt(projectId)));
          if (!proj) { res.status(404).json({ error: "Proyecto no encontrado" }); return; }
  
          const { getActiveTheme, readThemeFile, writeThemeFile } = await import("../../lib/shopify-theme.js");
          let themeId = params?.themeId ? parseInt(params.themeId) : undefined;
          if (!themeId) {
            const active = await getActiveTheme(parseInt(projectId), proj.shopDomain);
            if (!active) { res.status(404).json({ error: "No se encontró theme activo" }); return; }
            themeId = active.id;
          }
  
          const { DEFAULT_CMS_CONTENT } = await import("../../lib/cms-defaults.js");
          const { cmsContent: cmsContentTable } = await import("@workspace/db/schema");
          const cmsRows = await db.select().from(cmsContentTable).limit(1);
          const storedContent = cmsRows.length > 0 ? (cmsRows[0].content as Record<string, unknown>) : {};
          const mergedCms = { ...DEFAULT_CMS_CONTENT, ...storedContent };
          if (DEFAULT_CMS_CONTENT.storeTheme && !storedContent.storeTheme) {
            (mergedCms as Record<string, unknown>).storeTheme = DEFAULT_CMS_CONTENT.storeTheme;
          }
          const storeTheme = (mergedCms as Record<string, unknown>).storeTheme as Record<string, unknown> | undefined;
          if (!storeTheme) {
            result = { message: "⚠️ No hay configuración storeTheme en el CMS. Edita la sección 'storeTheme' del CMS primero." };
            break;
          }
  
          const header = storeTheme.header as Record<string, unknown>;
          const hero = storeTheme.hero as Record<string, unknown>;
          const announcement = storeTheme.announcementBar as Record<string, unknown>;
          const changes: string[] = [];
  
          if (header) {
            const navLinks = (header.navLinks as Array<Record<string, unknown>>) || [];
            const visibleLinks = navLinks.filter((l: Record<string, unknown>) => l.visible !== false);
            const loginBtn = header.loginButton as Record<string, unknown>;
            const accountBtn = header.accountButton as Record<string, unknown>;
  
            const desktopNav = visibleLinks.map((l: Record<string, unknown>) =>
              `      <a href="${l.href}" class="cc-header__link{% if page.handle == '${String(l.href).replace('/pages/','')}' %} cc-header__link--active{% endif %}">${l.label}</a>`
            ).join("\n");
  
            const mobileNav = visibleLinks.map((l: Record<string, unknown>) =>
              `  <a href="${l.href}" class="cc-mobile-menu__link">${l.label}</a>`
            ).join("\n");
  
            const headerLiquid = `<header class="cc-header">
    <div class="cc-header__inner">
      <a href="/" class="cc-header__logo">
        <img src="{{ 'logo-app.png' | asset_url }}" alt="{{ shop.name }}" />
        <span class="cc-header__logo-text">{{ shop.name }}</span>
      </a>
  
      <nav class="cc-header__nav">
  ${desktopNav}
      </nav>
  
      <div class="cc-header__actions">
        <a href="/cart" class="cc-header__cart" aria-label="Carrito">
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/></svg>
          {% if cart.item_count > 0 %}
            <span class="cc-header__cart-count">{{ cart.item_count }}</span>
          {% endif %}
        </a>
        {% if customer %}
          <a href="${accountBtn?.href || '/account'}" class="cc-header__link cc-header__link--active" style="background:linear-gradient(135deg,var(--cc-purple),var(--cc-pink));color:#fff;padding:0.5rem 1rem;border-radius:var(--cc-radius-full);font-weight:700;font-size:0.8125rem;">${accountBtn?.label || 'Mi Cuenta'}</a>
        {% else %}
          <a href="${loginBtn?.href || '/account/login'}" class="cc-header__link cc-header__link--active" style="background:linear-gradient(135deg,var(--cc-purple),var(--cc-pink));color:#fff;padding:0.5rem 1rem;border-radius:var(--cc-radius-full);font-weight:700;font-size:0.8125rem;">${loginBtn?.label || 'Iniciar Sesión'}</a>
        {% endif %}
        <button class="cc-header__menu-toggle" aria-label="Abrir menú" onclick="document.querySelector('.cc-mobile-menu').classList.toggle('active')">
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="18" x2="21" y2="18"/></svg>
        </button>
      </div>
    </div>
  </header>
  
  <nav class="cc-mobile-menu">
  ${mobileNav}
    {% if customer %}
      <a href="${accountBtn?.href || '/account'}" class="cc-mobile-menu__link cc-mobile-menu__link--cta">${accountBtn?.label || 'Mi Cuenta'}</a>
    {% else %}
      <a href="${loginBtn?.href || '/account/login'}" class="cc-mobile-menu__link cc-mobile-menu__link--cta">${loginBtn?.label || 'Iniciar Sesión'}</a>
    {% endif %}
  </nav>`;
  
            await writeThemeFile(parseInt(projectId), proj.shopDomain, themeId!, "snippets/header.liquid", headerLiquid);
            changes.push(`Header: ${visibleLinks.length} links, login="${loginBtn?.label}", account="${accountBtn?.label}"`);
          }
  
          if (hero) {
            const indexFile = await readThemeFile(parseInt(projectId), proj.shopDomain, themeId!, "templates/index.json");
            if (indexFile?.value) {
              try {
                const indexSettings = JSON.parse(indexFile.value);
                if (indexSettings.sections?.hero?.settings) {
                  const hs = indexSettings.sections.hero.settings;
                  if (hero.eyebrow) hs.eyebrow = hero.eyebrow;
                  if (hero.title) hs.title = hero.title;
                  if (hero.titleGradient) hs.title_gradient = hero.titleGradient;
                  if (hero.subtitle) hs.subtitle = hero.subtitle;
                  const ctaPrimary = hero.ctaPrimary as Record<string, unknown>;
                  const ctaSecondary = hero.ctaSecondary as Record<string, unknown>;
                  if (ctaPrimary) { hs.cta_text = ctaPrimary.label; hs.cta_url = ctaPrimary.href; }
                  if (ctaSecondary) { hs.cta2_text = ctaSecondary.label; hs.cta2_url = ctaSecondary.href; }
                  await writeThemeFile(parseInt(projectId), proj.shopDomain, themeId!, "templates/index.json", JSON.stringify(indexSettings, null, 2));
                  changes.push(`Hero: title="${hero.title}", CTA="${(hero.ctaPrimary as Record<string, unknown>)?.label}"`);
                }
              } catch {}
            }
          }
  
          if (announcement) {
            const settingsFile = await readThemeFile(parseInt(projectId), proj.shopDomain, themeId!, "config/settings_data.json");
            if (settingsFile?.value) {
              try {
                const settings = JSON.parse(settingsFile.value);
                const announcementSection = settings.current?.sections?.["announcement-bar"];
                if (announcementSection?.settings) {
                  announcementSection.settings.show_announcement = !!(announcement.enabled);
                  if (announcement.text) announcementSection.settings.announcement_text = announcement.text;
                  await writeThemeFile(parseInt(projectId), proj.shopDomain, themeId!, "config/settings_data.json", JSON.stringify(settings, null, 2));
                  changes.push(`Announcement: enabled=${announcement.enabled}, text="${String(announcement.text).substring(0,50)}..."`);
                }
              } catch {}
            }
          }
  
          result = {
            synced: changes,
            message: `✅ Store theme sincronizado desde CMS:\n${changes.map(c => `• ${c}`).join("\n")}\n\n📝 Cambios aplicados al theme activo del proyecto.`,
          };
          learnFromOperation({
            operationType: "store_theme_sync",
            title: "CMS → Store theme sync",
            content: `Sincronizado storeTheme del CMS al theme Shopify: ${changes.join("; ")}`,
            confidence: 0.9,
            tags: ["theme", "sync", "cms", "store"],
          });
          break;
        }

        default:
          return NOT_HANDLED;
      }
  return result;
}
