// Acciones del cerebro — Código de la plataforma, CMS y diagnóstico.
// Extraídas tal cual del switch de POST /shopybrain/execute-action (routes/shopybrain.ts).
/* eslint-disable @typescript-eslint/no-explicit-any */
import { SHOPIFY_API_VERSION } from "../../lib/shopify.js";
import { db, projectsTable } from "@workspace/db";
import { eq, sql } from "drizzle-orm";
import { shopifyGraphQL, refreshToken, getShopifyHeaders, normalizeShopDomain } from "../../lib/shopify.js";
import { safeDecrypt } from "../../lib/crypto.js";
import { learnFromOperation, askClaudeJsonWithBrain, askClaudeWithBrain, buildShopyBrainContext } from "../../lib/claude.js";
import { askClaudeJsonValidated } from "../../lib/ai-json.js";
import { aiOutputErrorMessage, isAiOutputError } from "../../lib/ai-errors.js";
import { z } from "zod";
import {
  getSessionProjectId, validateFixCodePath,
  normalizeListDirectory
} from "../../lib/shopybrain-helpers.js";
import * as fs from "fs";
import * as path from "path";

import {
  WORKSPACE_ROOT,
  FRONTEND_ROOT,
  BACKEND_ROOT,
  FRONTEND_SRC, resolveFilePath,
  uiChangesSchema
} from "./shared.js";
import { NOT_HANDLED, type BrainActionCtx, type BrainActionOutcome } from "./action-context.js";

export async function runPlatformActions(ctx: BrainActionCtx): Promise<BrainActionOutcome> {
  const { req, res, action, params, resolveStripeAccountId } = ctx;
  let result: Record<string, unknown> = {};
      switch (action) {
        case "modify_audit_filter": {
          const projectId = params?.projectId;
          if (!projectId) { res.status(400).json({ error: "projectId requerido" }); return; }
          const [project] = await db.select().from(projectsTable).where(eq(projectsTable.id, parseInt(projectId)));
          if (!project) { res.status(404).json({ error: "Proyecto no encontrado" }); return; }
  
          const statusFilter = params?.statusFilter || "any";
          const validFilters = ["any", "active", "draft", "archived"];
          if (!validFilters.includes(statusFilter)) {
            res.status(400).json({ error: `statusFilter debe ser: ${validFilters.join(", ")}` });
            return;
          }
  
          const autoScan = params?.autoScan !== false;
          let scanResult: Record<string, unknown> = {};
  
          if (autoScan) {
            const syncRes = await fetch(`http://localhost:${process.env.PORT || 8080}/api/projects/${projectId}/products/sync`, {
              method: "POST",
              headers: { "Content-Type": "application/json", "Cookie": req.headers.cookie || "" },
              body: JSON.stringify({ statusFilter }),
            });
            if (syncRes.ok) {
              scanResult = await syncRes.json() as Record<string, unknown>;
            }
          }
  
          const filterLabels: Record<string, string> = {
            any: "TODOS (activos + borradores + archivados)",
            active: "Solo productos ACTIVOS (publicados)",
            draft: "Solo productos en BORRADOR",
            archived: "Solo productos ARCHIVADOS",
          };
  
          result = {
            filterApplied: statusFilter,
            filterDescription: filterLabels[statusFilter] || statusFilter,
            autoScanExecuted: autoScan,
            ...(autoScan ? scanResult : {}),
            message: `Filtro de auditoría cambiado a: ${filterLabels[statusFilter]}. ${autoScan ? `Se re-escanearon ${scanResult.synced ?? 0} productos con el nuevo filtro. Score medio: ${typeof scanResult.avgScore === "number" ? Math.round(scanResult.avgScore) : "N/A"}/100.` : "No se ejecutó escaneo automático."}`,
          };
          break;
        }

        case "diagnose_app": {
          const projectId = params?.projectId;
          if (!projectId) { res.status(400).json({ error: "projectId requerido" }); return; }
          const [project] = await db.select().from(projectsTable).where(eq(projectsTable.id, parseInt(projectId)));
          if (!project) { res.status(404).json({ error: "Proyecto no encontrado" }); return; }
  
          const checksParam = params?.checks || "all";
          const issues: Array<{ component: string; status: "ok" | "warning" | "error"; detail: string; autoFixed?: boolean }> = [];
          let fixesApplied = 0;
  
          const runCheck = (name: string) => checksParam === "all" || checksParam === name;
  
          if (runCheck("token")) {
            try {
              const { validateToken: vt } = await import("../../lib/shopify.js");
              const tokenValid = project.accessToken ? await vt(project.shopDomain, project.accessToken) : false;
  
              if (!project.accessToken) {
                issues.push({ component: "Token Shopify", status: "error", detail: "No hay token de acceso configurado. Necesitas reconectar la tienda." });
              } else if (!tokenValid) {
                const plainSecret = safeDecrypt(project.clientSecret) || project.clientSecret;
                try {
                  await refreshToken(parseInt(projectId), project.shopDomain, project.clientId, plainSecret);
                  issues.push({ component: "Token Shopify", status: "warning", detail: "Token estaba expirado — se ha regenerado automáticamente.", autoFixed: true });
                  fixesApplied++;
                } catch {
                  issues.push({ component: "Token Shopify", status: "error", detail: "Token expirado y no se pudo regenerar. Verifica clientId/clientSecret." });
                }
              } else {
                const hoursLeft = project.tokenExpiresAt ? Math.round((new Date(project.tokenExpiresAt).getTime() - Date.now()) / 3600000 * 10) / 10 : "desconocido";
                issues.push({ component: "Token Shopify", status: "ok", detail: `Token válido. Expira en ${hoursLeft} horas.` });
              }
            } catch (e) {
              issues.push({ component: "Token Shopify", status: "error", detail: `Error verificando token: ${e instanceof Error ? e.message : String(e)}` });
            }
          }
  
          if (runCheck("connectivity")) {
            try {
              const headers = await getShopifyHeaders(parseInt(projectId));
              const domain = normalizeShopDomain(project.shopDomain);
              const shopRes = await fetch(`https://${domain}/admin/api/${SHOPIFY_API_VERSION}/shop.json`, {
                headers,
                signal: AbortSignal.timeout(10000),
              });
              if (shopRes.ok) {
                const shopData = await shopRes.json() as { shop: { name: string; plan_name: string; domain: string } };
                issues.push({ component: "Conexión Shopify", status: "ok", detail: `Conectado a "${shopData.shop?.name}" (plan: ${shopData.shop?.plan_name}, dominio: ${shopData.shop?.domain})` });
              } else {
                issues.push({ component: "Conexión Shopify", status: "error", detail: `Shopify devolvió error ${shopRes.status}. Posible problema de permisos o token.` });
              }
            } catch (e) {
              issues.push({ component: "Conexión Shopify", status: "error", detail: `No se pudo conectar con Shopify: ${e instanceof Error ? e.message : "timeout"}` });
            }
          }
  
          if (runCheck("products")) {
            try {
              const { productsTable } = await import("@workspace/db");
              const productRows = await db.select({
                total: sql<number>`count(*)`,
                avgScore: sql<number>`avg(${productsTable.auditScore})`,
                withoutScore: sql<number>`count(*) filter (where ${productsTable.auditScore} is null)`,
                active: sql<number>`count(*) filter (where ${productsTable.status} = 'active')`,
                draft: sql<number>`count(*) filter (where ${productsTable.status} = 'draft')`,
                archived: sql<number>`count(*) filter (where ${productsTable.status} = 'archived')`,
              }).from(productsTable).where(eq(productsTable.projectId, parseInt(projectId)));
  
              const stats = productRows[0];
              if (!stats || Number(stats.total) === 0) {
                issues.push({ component: "Productos en BD", status: "warning", detail: "No hay productos sincronizados. Ejecuta un escaneo de tienda para importarlos." });
              } else {
                issues.push({
                  component: "Productos en BD",
                  status: "ok",
                  detail: `${stats.total} productos en BD (activos: ${stats.active}, borradores: ${stats.draft}, archivados: ${stats.archived}). Score medio: ${stats.avgScore ? Math.round(Number(stats.avgScore)) : "N/A"}/100. Sin score: ${stats.withoutScore}.`,
                });
              }
  
              if (stats && Number(stats.withoutScore) > 0) {
                issues.push({ component: "Auditoría pendiente", status: "warning", detail: `${stats.withoutScore} productos sin auditar. Re-escanea la tienda para calcular sus scores.` });
              }
            } catch (e) {
              issues.push({ component: "Productos en BD", status: "error", detail: `Error consultando productos: ${e instanceof Error ? e.message : String(e)}` });
            }
          }
  
          if (runCheck("sync")) {
            try {
              const headers = await getShopifyHeaders(parseInt(projectId));
              const domain = normalizeShopDomain(project.shopDomain);
              const countRes = await fetch(`https://${domain}/admin/api/${SHOPIFY_API_VERSION}/products/count.json`, {
                headers,
                signal: AbortSignal.timeout(10000),
              });
              if (countRes.ok) {
                const countData = await countRes.json() as { count: number };
                const shopifyCount = countData.count;
                const localCount = project.productCount || 0;
                const diff = Math.abs(shopifyCount - localCount);
  
                if (diff > 0) {
                  const syncRes = await fetch(`http://localhost:${process.env.PORT || 8080}/api/projects/${projectId}/products/sync`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json", "Cookie": req.headers.cookie || "" },
                    body: JSON.stringify({ statusFilter: "any" }),
                  });
                  if (syncRes.ok) {
                    const syncData = await syncRes.json() as Record<string, unknown>;
                    issues.push({
                      component: "Sincronización",
                      status: "warning",
                      detail: `Había ${diff} productos desincronizados (Shopify: ${shopifyCount}, BD local: ${localCount}). Se re-sincronizaron ${syncData.synced} productos automáticamente.`,
                      autoFixed: true,
                    });
                    fixesApplied++;
                  } else {
                    issues.push({ component: "Sincronización", status: "error", detail: `${diff} productos desincronizados. El re-escaneo automático falló.` });
                  }
                } else {
                  issues.push({ component: "Sincronización", status: "ok", detail: `BD sincronizada con Shopify (${shopifyCount} productos en ambos).` });
                }
              }
            } catch (e) {
              issues.push({ component: "Sincronización", status: "warning", detail: `No se pudo verificar sincronización: ${e instanceof Error ? e.message : String(e)}` });
            }
          }
  
          const errors = issues.filter(i => i.status === "error").length;
          const warnings = issues.filter(i => i.status === "warning").length;
          const oks = issues.filter(i => i.status === "ok").length;
  
          const statusEmoji = errors > 0 ? "🔴" : warnings > 0 ? "🟡" : "🟢";
          const overallStatus = errors > 0 ? "PROBLEMAS DETECTADOS" : warnings > 0 ? "ADVERTENCIAS" : "TODO OK";
  
          result = {
            overallStatus,
            issues,
            summary: { errors, warnings, ok: oks, fixesApplied },
            message: `${statusEmoji} Diagnóstico: ${overallStatus}. ${errors} errores, ${warnings} advertencias, ${oks} ok. ${fixesApplied > 0 ? `Se aplicaron ${fixesApplied} reparaciones automáticas.` : ""}
  ${issues.map(i => `  ${i.status === "ok" ? "✅" : i.status === "warning" ? "⚠️" : "❌"} ${i.component}: ${i.detail}${i.autoFixed ? " [AUTO-REPARADO]" : ""}`).join("\n")}`,
          };
          break;
        }

        case "list_source_files": {
          const directory = params?.directory || "";
          const pattern = params?.pattern || "";
  
          const listDir = (root: string, dir: string, prefix: string): string[] => {
            const results: string[] = [];
            const fullPath = path.join(root, dir);
            if (!fs.existsSync(fullPath)) return results;
            try {
              const entries = fs.readdirSync(fullPath, { withFileTypes: true });
              for (const entry of entries) {
                if (entry.name.startsWith(".") || entry.name === "node_modules" || entry.name === "dist") continue;
                const relPath = path.join(dir, entry.name);
                if (entry.isDirectory()) {
                  results.push(`📁 ${prefix}${relPath}/`);
                  if (relPath.split("/").length < 4) {
                    results.push(...listDir(root, relPath, prefix));
                  }
                } else if (!pattern || entry.name.endsWith(pattern)) {
                  const stat = fs.statSync(path.join(root, relPath));
                  const sizeKb = Math.round(stat.size / 1024);
                  results.push(`📄 ${prefix}${relPath} (${sizeKb}KB)`);
                }
              }
            } catch { /* ignore */ }
            return results;
          };
  
          // FIX CRIT-5: rechazar rutas traversal y normalizar path
          const dirStr = String(directory).trim();
          if (dirStr.includes("..") || path.isAbsolute(dirStr) || dirStr.includes("\0")) {
            result = { error: true, message: "🚫 Path inválido: no se permiten rutas con '..', absolutas ni caracteres nulos." };
            break;
          }
          const frontendDir = normalizeListDirectory(dirStr, FRONTEND_ROOT);
          const backendDir = normalizeListDirectory(dirStr, BACKEND_ROOT);
          if (!frontendDir || !backendDir) {
            result = { error: true, message: "🚫 Directory fuera del workspace permitido. Solo se pueden listar subdirectorios de src/." };
            break;
          }
          const frontendFiles = listDir(FRONTEND_ROOT, frontendDir, "[frontend] ");
          const backendFiles = listDir(BACKEND_ROOT, backendDir, "[backend] ");
  
          result = {
            frontend: frontendFiles.slice(0, 60),
            backend: backendFiles.slice(0, 60),
            totalFrontend: frontendFiles.length,
            totalBackend: backendFiles.length,
            message: `📂 Estructura del código:\n\n**Frontend (${frontendFiles.length} items):**\n${frontendFiles.slice(0, 30).join("\n")}\n\n**Backend (${backendFiles.length} items):**\n${backendFiles.slice(0, 30).join("\n")}`,
          };
          break;
        }

        case "inspect_code": {
          const filePath = params?.filePath;
          if (!filePath) { res.status(400).json({ error: "filePath requerido (ej: src/pages/projects/Audit.tsx)" }); return; }
          if (String(filePath).includes("..") || path.isAbsolute(String(filePath))) { res.status(400).json({ error: "Path inválido: no se permiten rutas absolutas ni '..'." }); return; }
  
          const resolvedPath = resolveFilePath(String(filePath));
          if (!resolvedPath) {
            res.status(404).json({ error: `Archivo no encontrado: ${filePath}. Prueba con list_source_files para ver los archivos disponibles.` });
            return;
          }
          const fileContent = fs.readFileSync(resolvedPath, "utf-8");
  
          const lines = fileContent.split("\n").length;
          const truncated = fileContent.length > 15000 ? fileContent.slice(0, 15000) + "\n\n// ... [truncado, archivo demasiado largo]" : fileContent;
          let analysis = "";
  
          if (params?.analyze !== false) {
            try {
              const inspectProjectId = getSessionProjectId(req, params);
              analysis = await askClaudeWithBrain(
                inspectProjectId,
                [{
                  role: "user",
                  content: `Analiza este archivo de código fuente de una app Shopify (React+TypeScript frontend, Express+Node backend).
  Identifica: bugs, errores lógicos, problemas de UX, funciones rotas, imports faltantes, handlers sin error handling, y cualquier otro problema.
  Responde en español, sé concreto y directo. Para cada problema indica la línea aproximada y el fix sugerido.
  
  Archivo: ${filePath}
  \`\`\`
  ${truncated}
  \`\`\``,
                }],
                undefined,
                "general",
                undefined,
                2000
              );
              learnFromOperation({
                operationType: "code_analysis",
                title: `Análisis de código: ${filePath}`,
                content: analysis.slice(0, 500),
                confidence: 0.7,
                tags: ["code_analysis", "inspect_code"],
              });
            } catch {
              analysis = "No se pudo ejecutar el análisis con IA.";
            }
          }
  
          result = {
            filePath,
            resolvedPath: resolvedPath.replace(WORKSPACE_ROOT, ""),
            lines,
            sizeBytes: fileContent.length,
            content: truncated,
            analysis: analysis || undefined,
            message: `📄 **${filePath}** (${lines} líneas, ${Math.round(fileContent.length / 1024)}KB)\n\n${analysis ? `🔍 **Análisis:**\n${analysis}` : "Contenido leído correctamente."}`,
          };
          break;
        }

        case "analyze_component": {
          const filePath = params?.filePath;
          if (!filePath) { res.status(400).json({ error: "filePath requerido" }); return; }
          if (String(filePath).includes("..") || path.isAbsolute(String(filePath))) { res.status(400).json({ error: "Path inválido: no se permiten rutas absolutas ni '..'." }); return; }
          const focusOn = params?.focusOn || "all";
  
          const resolvedAnalyzePath = resolveFilePath(String(filePath));
          if (!resolvedAnalyzePath) {
            res.status(404).json({ error: `Archivo no encontrado: ${filePath}. Prueba con list_source_files para ver los archivos disponibles.` });
            return;
          }
          const fileContent = fs.readFileSync(resolvedAnalyzePath, "utf-8");
  
          const truncated = fileContent.length > 18000 ? fileContent.slice(0, 18000) + "\n// ... [truncado]" : fileContent;
  
          const focusPrompts: Record<string, string> = {
            bugs: "Busca SOLO bugs, errores de runtime, null pointer exceptions, funciones que fallan, imports rotos, variables undefined.",
            ux: "Busca SOLO problemas de UX: botones que no funcionan, feedback faltante al usuario, estados de loading no manejados, errores silenciosos sin mensaje.",
            performance: "Busca SOLO problemas de rendimiento: re-renders innecesarios, llamadas API sin cache, loops ineficientes, memory leaks.",
            logic: "Busca SOLO errores de lógica de negocio: cálculos incorrectos, condiciones mal escritas, estados inconsistentes, race conditions.",
            all: "Haz un análisis COMPLETO: bugs, errores lógicos, UX, rendimiento, seguridad. Prioriza por severidad (crítico > alto > medio > bajo).",
          };
  
          try {
            const componentProjectId = getSessionProjectId(req, params);
            const componentAnalysis = await askClaudeWithBrain(
              componentProjectId,
              [{
                role: "user",
                content: `Eres un senior developer auditando código de producción de una app Shopify (React+Vite frontend, Express+Node backend, PostgreSQL, Drizzle ORM).
  
  ENFOQUE: ${focusPrompts[focusOn] || focusPrompts.all}
  
  Para CADA problema encontrado, responde con este formato exacto:
  🔴 CRÍTICO / 🟡 ALTO / 🟢 MEDIO / ⚪ BAJO
  **Línea ~N**: Descripción del problema
  **Fix**: Código exacto para corregirlo (old → new)
  
  Si no encuentras problemas, di "✅ Sin problemas detectados".
  Responde en español.
  
  Archivo: ${filePath}
  \`\`\`typescript
  ${truncated}
  \`\`\``,
              }],
              undefined,
              "general",
              undefined,
              4000
            );
  
            const criticalCount = (componentAnalysis.match(/🔴/g) || []).length;
            const highCount = (componentAnalysis.match(/🟡/g) || []).length;
            const mediumCount = (componentAnalysis.match(/🟢/g) || []).length;
            const lowCount = (componentAnalysis.match(/⚪/g) || []).length;
            const totalIssues = criticalCount + highCount + mediumCount + lowCount;
  
            learnFromOperation({
              operationType: "component_analysis",
              title: `Análisis de componente: ${filePath} (${focusOn})`,
              content: `${totalIssues} problemas encontrados: ${criticalCount} críticos, ${highCount} altos. ${componentAnalysis.slice(0, 300)}`,
              confidence: 0.75,
              tags: ["code_audit", "analyze_component", focusOn],
            });
  
            result = {
              filePath,
              focusOn,
              analysis: componentAnalysis,
              issueCount: { critical: criticalCount, high: highCount, medium: mediumCount, low: lowCount, total: totalIssues },
              message: `🔍 **Análisis de ${filePath}** (enfoque: ${focusOn})\n📊 ${totalIssues} problemas: ${criticalCount} críticos, ${highCount} altos, ${mediumCount} medios, ${lowCount} bajos\n\n${componentAnalysis}`,
            };
          } catch (e) {
            result = { error: true, message: `Error analizando: ${e instanceof Error ? e.message : String(e)}` };
          }
          break;
        }

        case "fix_code": {
          const filePath = params?.filePath;
          const oldCode = params?.oldCode;
          const newCode = params?.newCode;
          const description = params?.description || "Fix aplicado por Shopy Crafter";
          const confirmed = params?.confirmed === true || params?.confirmed === "true";
  
          if (!filePath || !oldCode || newCode === undefined) {
            res.status(400).json({ error: "filePath, oldCode y newCode son requeridos" });
            return;
          }
          if (String(filePath).includes("..") || path.isAbsolute(String(filePath))) { res.status(400).json({ error: "Path inválido: no se permiten rutas absolutas ni '..'." }); return; }

          // FIX CRIT-1: whitelist estricta de paths modificables
          const pathError = validateFixCodePath(String(filePath));
          if (pathError) {
            result = { error: true, message: `🚫 ${pathError}` };
            break;
          }

          // FIX CRIT-6: confirmación explícita requerida para acciones destructivas
          if (!confirmed) {
            result = {
              requiresConfirmation: true,
              action: "fix_code",
              filePath,
              description,
              preview: {
                summary: `Modificar código en ${filePath}: ${description}`,
                before: String(oldCode).slice(0, 300),
                after: String(newCode).slice(0, 300),
              },
              message: `⚠️ **Confirmación requerida para fix_code en \`${filePath}\`**\n\n` +
                       `**Descripción:** ${description}\n` +
                       `**Cambio:** ${String(newCode).split("\n").length} líneas modificadas\n\n` +
                       `Re-envía la acción con \`"confirmed": true\` para aplicar el cambio.`,
            };
            break;
          }

          const resolvedPath = resolveFilePath(String(filePath));
          if (!resolvedPath) {
            res.status(404).json({ error: `Archivo no encontrado: ${filePath}. Prueba con list_source_files para ver los archivos disponibles.` });
            return;
          }
          let fileContent = fs.readFileSync(resolvedPath, "utf-8");
  
          if (!fileContent.includes(oldCode)) {
            result = {
              success: false,
              message: `❌ No se encontró el código a reemplazar en ${filePath}. Verifica que el texto es exacto. Usa inspect_code para ver el contenido actual del archivo.`,
            };
            break;
          }
  
          const backupPath = `${resolvedPath}.bak.${Date.now()}`;
          fs.writeFileSync(backupPath, fileContent, "utf-8");
  
          // Función como reemplazo: con una cadena, "$&", "$'" o "$1" del código nuevo
          // se interpretaban como patrones de String.replace y corrompían el archivo.
          const newContent = fileContent.replace(oldCode, () => newCode);
          fs.writeFileSync(resolvedPath, newContent, "utf-8");
  
          const changedLines = newCode.split("\n").length;
  
          result = {
            success: true,
            filePath,
            resolvedPath: resolvedPath.replace(WORKSPACE_ROOT, ""),
            description,
            linesChanged: changedLines,
            backupCreated: backupPath.replace(WORKSPACE_ROOT, ""),
            message: `✅ **Fix aplicado en ${filePath}**\n📝 ${description}\n📊 ${changedLines} líneas modificadas\n💾 Backup creado automáticamente\n\n⚠️ **Nota:** Los cambios se aplican al código fuente. Reinicia el servidor para que tengan efecto.`,
          };
          break;
        }

        case "read_cms": {
          const cookieH = req.headers.cookie ?? "";
          const cmsReadRes = await fetch(`http://localhost:${process.env.PORT ?? 3001}/api/cms/content`, { headers: { "Cookie": cookieH } });
          if (!cmsReadRes.ok) { res.status(500).json({ error: "Error al leer CMS" }); return; }
          const cmsData = await cmsReadRes.json();
          const sectionToRead = params?.section;
          if (sectionToRead && typeof sectionToRead === "string") {
            const parts = sectionToRead.split(".");
            let val: unknown = cmsData;
            for (const p of parts) { val = (val as Record<string, unknown>)?.[p]; if (val === undefined) break; }
            result = { section: sectionToRead, value: val ?? null, message: `CMS sección "${sectionToRead}": ${JSON.stringify(val).slice(0, 500)}` };
          } else {
            const sections = Object.keys(cmsData as Record<string, unknown>).filter(k => k !== "meta");
            result = { sections, totalSections: sections.length, message: `CMS tiene ${sections.length} secciones: ${sections.join(", ")}` };
          }
          break;
        }

        case "update_cms": {
          const fieldPath = params?.path;
          const value = params?.value;
          if (!fieldPath || value === undefined) { res.status(400).json({ error: "path y value requeridos" }); return; }
          const cookieHeader = req.headers.cookie ?? "";
          const cmsRes = await fetch(`http://localhost:${process.env.PORT ?? 3001}/api/cms/content`, { method: "PATCH", headers: { "Content-Type": "application/json", "Cookie": cookieHeader }, body: JSON.stringify({ path: fieldPath, value }) });
          if (!cmsRes.ok) { res.status(500).json({ error: "Error al actualizar CMS" }); return; }
          result = { success: true, path: fieldPath, value, message: `CMS actualizado: ${fieldPath} = ${typeof value === "string" ? value : JSON.stringify(value)}` };
          break;
        }

        case "update_cms_batch": {
          const changes = params?.changes as Array<{ path: string; value: unknown }>;
          if (!Array.isArray(changes) || !changes.length) { res.status(400).json({ error: "changes[] requerido con {path, value}" }); return; }
          const cookieBatch = req.headers.cookie ?? "";
          const batchRes = await fetch(`http://localhost:${process.env.PORT ?? 3001}/api/cms/content/batch`, { method: "POST", headers: { "Content-Type": "application/json", "Cookie": cookieBatch }, body: JSON.stringify({ changes }) });
          if (!batchRes.ok) { res.status(500).json({ error: "Error al actualizar CMS batch" }); return; }
          result = { success: true, changesApplied: changes.length, paths: changes.map(c => c.path), message: `CMS batch: ${changes.length} campos actualizados (${changes.map(c => c.path).join(", ")})` };
          break;
        }

        case "reset_cms": {
          const cookieReset = req.headers.cookie ?? "";
          const resetRes = await fetch(`http://localhost:${process.env.PORT ?? 3001}/api/cms/content/reset`, { method: "POST", headers: { "Content-Type": "application/json", "Cookie": cookieReset }, body: JSON.stringify({}) });
          if (!resetRes.ok) { res.status(500).json({ error: "Error al resetear CMS" }); return; }
          result = { success: true, message: "CMS reseteado a valores por defecto. Todos los textos vuelven a su estado original." };
          break;
        }

        case "modify_ui": {
          const target = params?.target;
          const change = params?.change;
          if (!target || !change) { res.status(400).json({ error: "target y change requeridos (ej: target='pricing carousel', change='hacer scroll horizontal en móvil')" }); return; }
          if (String(target).includes("..") || path.isAbsolute(String(target))) { res.status(400).json({ error: "Target inválido" }); return; }
  
          try {
            const relevantFiles: { path: string; content: string }[] = [];
            const scanDirs = [
              { root: FRONTEND_SRC, prefix: "" },
              { root: path.resolve(FRONTEND_ROOT, "public"), prefix: "public/" },
              { root: path.resolve(BACKEND_ROOT, "src"), prefix: "[backend] " },
            ];
            const targetLower = String(target).toLowerCase();
            for (const { root, prefix } of scanDirs) {
              if (!fs.existsSync(root)) continue;
              const scanRecursive = (dir: string, depth: number) => {
                if (depth > 3 || relevantFiles.length >= 6) return;
                try {
                  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
                    if (entry.name.startsWith(".") || entry.name === "node_modules" || entry.name === "dist") continue;
                    const full = path.join(dir, entry.name);
                    if (entry.isDirectory()) { scanRecursive(full, depth + 1); continue; }
                    if (!/\.(tsx?|css)$/.test(entry.name)) continue;
                    const relPath = path.relative(root, full);
                    const nameLower = entry.name.toLowerCase().replace(/\.(tsx?|css)$/, "");
                    if (targetLower.includes(nameLower) || nameLower.includes("landing") || nameLower.includes("index") || nameLower === "app") {
                      const fc = fs.readFileSync(full, "utf-8");
                      relevantFiles.push({ path: `${prefix}${relPath}`, content: fc.length > 8000 ? fc.slice(0, 8000) + "\n// ... [truncado]" : fc });
                    }
                  }
                } catch { /* skip */ }
              };
              scanRecursive(root, 0);
            }
  
            const fileListForPrompt = relevantFiles.map(f => `--- ${f.path} ---\n${f.content}`).join("\n\n");
  
            const analyzePrompt = `Eres un experto frontend React+TypeScript+CSS. El usuario quiere hacer este cambio visual/UI:
  
  TARGET: ${target}
  CAMBIO DESEADO: ${change}
  
  Estos son los archivos del proyecto (path relativo desde src/):
  
  ${fileListForPrompt}
  
  Necesito que me digas:
  1. Qué archivo(s) hay que modificar (path relativo desde src/, ej: "pages/Landing.tsx", "pages/landing.css")
  2. Qué código hay que buscar (oldCode exacto, copiado del archivo)
  3. Qué código nuevo poner (newCode)
  
  IMPORTANTE: Los paths deben ser relativos desde src/ SIN incluir "src/" al inicio.
  Ejemplo correcto: "pages/Landing.tsx"
  Ejemplo INCORRECTO: "src/pages/Landing.tsx"
  
  Responde SOLO JSON:
  {
    "files": [
      {
        "filePath": "pages/Landing.tsx",
        "changes": [
          {"oldCode": "código exacto a reemplazar", "newCode": "código nuevo", "description": "qué hace este cambio"}
        ]
      }
    ],
    "summary": "resumen del cambio"
  }`;
  
            const modifyUiProjectId = getSessionProjectId(req, params);
            // Antes: 3000 tokens (el JSON de cambios se cortaba) y una cascada de
            // JSON.parse/regex. Ahora esquema (oldCode no vacío: con "" el replace
            // insertaba el código al principio del archivo), reintento y error tipado.
            let uiJson: z.output<typeof uiChangesSchema>;
            try {
              uiJson = await askClaudeJsonValidated(
                modifyUiProjectId,
                analyzePrompt,
                "Eres un experto frontend senior. Responde SOLO JSON válido. Los paths de archivo son relativos desde src/ sin incluir src/ al inicio.",
                { schema: uiChangesSchema, useCase: "general", maxTokens: 8000, label: "shopybrain/modify_ui" },
              );
            } catch (aiErr) {
              if (!isAiOutputError(aiErr)) throw aiErr;
              result = { error: true, message: `❌ ${aiOutputErrorMessage(aiErr)} No se ha modificado ningún archivo.` };
              break;
            }

            let changesApplied = 0;
            const appliedFiles: string[] = [];
            const failedFiles: string[] = [];
            const failedChanges: string[] = [];
  
            {
              for (const file of uiJson.files) {
                const rawPath = file.filePath.replace(/^src\//, "");

                // FIX CRIT-1 bis: aplicar también whitelist en modify_ui (no solo fix_code)
                const pathToValidate = rawPath.startsWith("src/") ? rawPath : `src/${rawPath}`;
                const pathError = validateFixCodePath(pathToValidate);
                if (pathError) {
                  failedFiles.push(`${file.filePath} (🚫 ${pathError})`);
                  continue;
                }

                const fullPath = resolveFilePath(`src/${rawPath}`) || resolveFilePath(rawPath);
                if (!fullPath) {
                  failedFiles.push(`${file.filePath} (intentado: src/${rawPath}, ${rawPath})`);
                  continue;
                }
                if (!fullPath.startsWith(FRONTEND_ROOT) && !fullPath.startsWith(BACKEND_ROOT)) {
                  failedFiles.push(`${file.filePath} (solo se permiten cambios en frontend/backend)`);
                  continue;
                }
                let content = fs.readFileSync(fullPath, "utf-8");
                let fileChanged = false;
                for (const ch of file.changes) {
                  if (content.includes(ch.oldCode)) {
                    // Función como reemplazo: con una cadena, "$&", "$'" o "$1" del código
                    // nuevo se interpretaban como patrones especiales de String.replace.
                    content = content.replace(ch.oldCode, () => ch.newCode);
                    changesApplied++;
                    fileChanged = true;
                  } else {
                    failedChanges.push(`${file.filePath}: ${(ch.description || ch.oldCode?.slice(0, 50) || "cambio desconocido")}`);
                  }
                }
                if (fileChanged) {
                  fs.writeFileSync(fullPath, content, "utf-8");
                  appliedFiles.push(file.filePath);
                }
              }
            }
  
            let msg = "";
            if (changesApplied > 0) {
              msg = `✅ **Cambio UI aplicado:** ${uiJson.summary || change}\n📁 Archivos: ${appliedFiles.join(", ")}\n🔧 ${changesApplied} cambios aplicados\n⚠️ Recarga la página para ver los cambios.`;
            } else {
              msg = `⚠️ No se pudieron aplicar los cambios automáticamente.`;
            }
            if (failedFiles.length > 0) {
              msg += `\n❌ Archivos no encontrados: ${failedFiles.join(", ")}`;
            }
            if (failedChanges.length > 0) {
              msg += `\n⚠️ Cambios no coincidieron: ${failedChanges.join("; ")}`;
            }
  
            result = {
              success: changesApplied > 0,
              changesApplied,
              files: appliedFiles,
              failedFiles,
              failedChanges,
              summary: uiJson.summary || "Cambio UI aplicado",
              message: msg,
            };
          } catch (err) {
            result = { error: true, message: `Error modificando UI: ${err instanceof Error ? err.message : String(err)}` };
          }
          break;
        }

        case "copyright_audit": {
          const projectId = params?.projectId;
          if (!projectId) { result = { error: true, message: "❌ Falta projectId" }; break; }
          try {
            const [project] = await db.select().from(projectsTable).where(eq(projectsTable.id, Number(projectId))).limit(1);
            if (!project) { result = { error: true, message: "❌ Proyecto no encontrado" }; break; }
  
            const productsRes = await shopifyGraphQL<{ products: { edges: { node: { id: string; title: string; descriptionHtml: string; tags: string[]; vendor: string; productType: string } }[] } }>(
              Number(projectId),
              project.shopDomain,
              `{ products(first: 50) { edges { node { id title descriptionHtml tags vendor productType } } } }`
            );
  
            const products = productsRes.products?.edges?.map(e => e.node) ?? [];
  
            const brainCtx = await buildShopyBrainContext(undefined, "general", "copyright trademark intellectual property brand names");
            const auditResult = await askClaudeJsonWithBrain<{
              totalProducts: number;
              riskProducts: { title: string; risks: string[]; severity: "alta" | "media" | "baja"; suggestion: string }[];
              generalRisks: string[];
              recommendations: string[];
              safeProducts: number;
            }>(
              parseInt(projectId),
              `Realiza una auditoría de copyright y propiedad intelectual de los siguientes productos de una tienda Shopify.
  
  PRODUCTOS (${products.length}):
  ${products.map((p, i) => `${i + 1}. Título: "${p.title}" | Vendor: ${p.vendor} | Tipo: ${p.productType} | Tags: ${p.tags?.join(", ") || "ninguno"} | Descripción: ${(p.descriptionHtml || "").replace(/<[^>]*>/g, "").slice(0, 200)}`).join("\n")}
  
  ANALIZA CADA PRODUCTO buscando:
  1. **Marcas registradas**: Nombres como "Funko", "Disney", "Marvel", "Nintendo", "LEGO", "Pokémon", "Star Wars", etc. que son marcas registradas
  2. **Derechos de autor**: Personajes protegidos, diseños con copyright, logos de terceros
  3. **Denominaciones engañosas**: Usar nombres de marca sin autorización oficial (ej: "Funko Pop" sin licencia = infracción)
  4. **Sugerencias de alternativas**: Para cada producto con riesgo, sugiere un nombre alternativo que no infrinja derechos
  
  Responde SOLO con JSON válido (sin markdown):
  {
    "totalProducts": number,
    "riskProducts": [{ "title": "nombre actual", "risks": ["riesgo 1", "riesgo 2"], "severity": "alta|media|baja", "suggestion": "nombre alternativo sugerido" }],
    "generalRisks": ["riesgo general 1"],
    "recommendations": ["recomendación 1"],
    "safeProducts": number
  }`,
              brainCtx, "general"
            );
  
            let msg = `⚖️ **Auditoría de Copyright completada**\n\n`;
            msg += `📦 **${auditResult.totalProducts}** productos analizados\n`;
            msg += `✅ **${auditResult.safeProducts}** productos sin riesgos\n`;
            msg += `⚠️ **${auditResult.riskProducts.length}** productos con riesgos detectados\n\n`;
  
            if (auditResult.riskProducts.length > 0) {
              msg += `### Productos con riesgo:\n`;
              for (const p of auditResult.riskProducts) {
                const icon = p.severity === "alta" ? "🔴" : p.severity === "media" ? "🟡" : "🟢";
                msg += `\n${icon} **${p.title}** (${p.severity})\n`;
                msg += `  Riesgos: ${p.risks.join(", ")}\n`;
                msg += `  💡 Sugerencia: _${p.suggestion}_\n`;
              }
            }
  
            if (auditResult.generalRisks.length > 0) {
              msg += `\n### Riesgos generales:\n${auditResult.generalRisks.map(r => `  ⚠️ ${r}`).join("\n")}\n`;
            }
            if (auditResult.recommendations.length > 0) {
              msg += `\n### Recomendaciones:\n${auditResult.recommendations.map((r, i) => `  ${i + 1}. ${r}`).join("\n")}\n`;
            }
  
            result = { ...auditResult, message: msg };
          } catch (err) {
            result = { error: true, message: `❌ Error en auditoría de copyright: ${err instanceof Error ? err.message : String(err)}` };
          }
          break;
        }

        default:
          return NOT_HANDLED;
      }
  return result;
}
