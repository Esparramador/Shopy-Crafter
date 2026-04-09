import { REPORT_LEVELS, LEVEL_SYSTEM_PROMPTS, type ReportLevel } from "./config.js";
import { askClaudeWithBrain, learnFromOperation } from "./claude.js";
import { saveToVault } from "./vault.js";
import { getReportShell, type ReportTemplate } from "../routes/exports.js";
import { logger } from "./logger.js";

export interface LeveledReportResult {
  level: number;
  levelName: string;
  files: Array<{
    type: string;
    title: string;
    htmlContent: string;
    vaultId: number | null;
  }>;
  totalPages: number;
}

export async function generateLeveledReport(params: {
  projectId: number;
  level: ReportLevel;
  reportType: string;
  reportTitle: string;
  dataBlock: string;
  niche?: string;
  template?: ReportTemplate;
  baseSystemPrompt?: string;
}): Promise<LeveledReportResult> {
  const { projectId, level, reportType, reportTitle, dataBlock, niche, template = "prestige", baseSystemPrompt } = params;
  const levelConfig = REPORT_LEVELS[level];
  const levelPrompt = LEVEL_SYSTEM_PROMPTS[level] || LEVEL_SYSTEM_PROMPTS[1];

  const systemPrompt = `${baseSystemPrompt || "Eres ShopyBrain, motor de inteligencia IA de Shopy Crafter. Generas informes exhaustivos y profesionales."}

${levelPrompt}

REGLAS DE CALIDAD:
- Cada dato debe tener badge: [VERIFICADO] [INVESTIGADO] o [ESTIMADO]
- Nombra productos ESPECÍFICOS del catálogo del cliente
- Usa números concretos, no generalidades
- Cada recomendación debe tener impacto estimado en € o %
- Responde SIEMPRE en español profesional
- Formato: HTML con <h2>, <h3>, <p>, <ul>, <ol>, <strong>, <table>`;

  const files: LeveledReportResult["files"] = [];
  const reportShell = getReportShell(template);
  const date = new Date().toLocaleDateString("es-ES", { day: "2-digit", month: "long", year: "numeric" });

  logger.info({ projectId, level, reportType }, `Generating Level ${level} report: ${reportTitle}`);

  const mainReport = await askClaudeWithBrain(
    projectId,
    [{ role: "user", content: `Genera el informe ${levelConfig.name} para:\n\n${dataBlock}` }],
    systemPrompt, "general", niche, levelConfig.maxTokens
  );

  const mainHtml = reportShell(
    `${reportTitle} — ${levelConfig.label}`,
    `Informe ${levelConfig.name}`,
    `<div class="report-level-badge" style="background:${levelConfig.color}20;color:${levelConfig.color};padding:8px 16px;border-radius:8px;display:inline-block;font-weight:700;margin-bottom:20px;">${levelConfig.name}</div>\n${mainReport}`,
    date,
    "ShopyBrain Intelligence"
  );

  const mainVaultId = await saveToVault({
    projectId,
    fileType: `report-level-${level}`,
    category: "informes",
    title: `${reportTitle} — ${levelConfig.label}`,
    description: `Informe ${levelConfig.name} generado por ShopyBrain`,
    mimeType: "text/html",
    generatedBy: "report-levels",
    content: mainHtml,
    metadata: { level, reportType, template },
  });

  files.push({ type: "main-report", title: `${reportTitle} — ${levelConfig.label}`, htmlContent: mainHtml, vaultId: mainVaultId });

  if (level >= 2) {
    logger.info({ projectId, level }, "Generating implementation guide");

    const guidePrompt = `Basándote en este informe, genera una GUÍA DE IMPLEMENTACIÓN PASO A PASO separada.
El informe original dice lo siguiente (resumido):
${mainReport.replace(/<[^>]+>/g, " ").slice(0, 6000)}

GENERA la guía con este formato EXACTO para CADA mejora:

<div class="implementation-step">
  <h3>Paso X: [Nombre de la acción]</h3>
  <p><strong>Tiempo estimado:</strong> X minutos</p>
  <p><strong>Impacto esperado:</strong> +X% en [métrica]</p>
  <div class="step-instructions">
    <ol>
      <li><strong>Navega a:</strong> [Panel Admin] → [Menú] → [Submenú]</li>
      <li><strong>Busca:</strong> [Qué buscar en la pantalla]</li>
      <li><strong>Escribe/Pega:</strong> <code>[Texto exacto a escribir]</code></li>
      <li><strong>Guarda:</strong> Haz clic en [Botón guardar]</li>
    </ol>
  </div>
  <p><strong>Verificación:</strong> Sabrás que funciona cuando [qué debe pasar]</p>
  <p><strong>Para delegar:</strong> "Envía esto a tu [rol]: [mensaje exacto]"</p>
</div>

Incluye TODOS los pasos necesarios. Mínimo 8-12 pasos.`;

    const guide = await askClaudeWithBrain(
      projectId,
      [{ role: "user", content: guidePrompt }],
      systemPrompt, "general", niche, 12000
    );

    const guideHtml = reportShell(
      `Guía de Implementación — ${reportTitle}`,
      `Paso a paso detallado — ${levelConfig.label}`,
      guide,
      date,
      "ShopyBrain Intelligence"
    );

    const guideVaultId = await saveToVault({
      projectId,
      fileType: "implementation-guide",
      category: "informes",
      title: `Guía Implementación — ${reportTitle}`,
      description: `Guía paso a paso para implementar las mejoras del informe`,
      mimeType: "text/html",
      generatedBy: "report-levels",
      content: guideHtml,
      metadata: { level, reportType, parentReport: mainVaultId },
    });

    files.push({ type: "implementation-guide", title: `Guía Implementación — ${reportTitle}`, htmlContent: guideHtml, vaultId: guideVaultId });
  }

  if (level >= 3) {
    logger.info({ projectId, level }, "Generating produced content");

    const contentPrompt = `Genera TODO el contenido PRODUCIDO y LISTO PARA USAR basándote en las recomendaciones del informe.
Informe resumido: ${mainReport.replace(/<[^>]+>/g, " ").slice(0, 4000)}

GENERA contenido FINAL que el cliente pueda copiar y pegar DIRECTAMENTE:
- Meta titles y descriptions para los productos mencionados
- Textos de producto reescritos (completos, 800+ palabras cada uno)
- Emails de marketing (HTML completo con diseño)
- Posts para redes sociales (con hashtags y emojis)
- Alt texts para imágenes
- Tags SEO

Cada pieza de contenido debe estar en un bloque:
<div class="produced-content-block">
  <h3>[Tipo de contenido]: [Para qué producto/página]</h3>
  <div class="content-to-copy">
    [El contenido exacto que el cliente copia y pega]
  </div>
  <p class="copy-note"><small>Copia y pega esto directamente en [dónde]</small></p>
</div>`;

    const produced = await askClaudeWithBrain(
      projectId,
      [{ role: "user", content: contentPrompt }],
      systemPrompt, "general", niche, 16000
    );

    const producedHtml = reportShell(
      `Contenido Producido — ${reportTitle}`,
      `Listo para copiar y pegar`,
      produced,
      date,
      "ShopyBrain Intelligence"
    );

    const producedVaultId = await saveToVault({
      projectId,
      fileType: "produced-content",
      category: "informes",
      title: `Contenido Producido — ${reportTitle}`,
      description: `Contenido terminado listo para usar`,
      mimeType: "text/html",
      generatedBy: "report-levels",
      content: producedHtml,
      metadata: { level, reportType, parentReport: mainVaultId },
    });

    files.push({ type: "produced-content", title: `Contenido Producido — ${reportTitle}`, htmlContent: producedHtml, vaultId: producedVaultId });
  }

  if (level >= 4) {
    logger.info({ projectId, level }, "Generating premium assets");

    const assetsPrompt = `Genera todos los ACTIVOS TÉCNICOS basándote en el informe:
${mainReport.replace(/<[^>]+>/g, " ").slice(0, 3000)}

Incluye:
1. CSS PERSONALIZADO completo (variables de marca, componentes, responsive)
2. Schemas JSON-LD para cada producto mencionado (Product, FAQ, BreadcrumbList)
3. Brief fotográfico profesional (iluminación, ángulos, props, mood board textual)
4. Calendario editorial 12 semanas (tabla con: semana, título, keyword, tipo, plataforma)
5. 5 templates de email HTML (usar colores de marca del cliente)

Cada activo en bloque separado con título claro.`;

    const assets = await askClaudeWithBrain(
      projectId,
      [{ role: "user", content: assetsPrompt }],
      systemPrompt, "general", niche, 16000
    );

    const assetsHtml = reportShell(
      `Activos Premium — ${reportTitle}`,
      `CSS, Schemas, Brief, Calendario, Emails`,
      assets,
      date,
      "ShopyBrain Intelligence"
    );

    const assetsVaultId = await saveToVault({
      projectId,
      fileType: "premium-assets",
      category: "informes",
      title: `Activos Premium — ${reportTitle}`,
      mimeType: "text/html",
      generatedBy: "report-levels",
      content: assetsHtml,
      metadata: { level, reportType },
    });

    files.push({ type: "premium-assets", title: `Activos Premium — ${reportTitle}`, htmlContent: assetsHtml, vaultId: assetsVaultId });
  }

  if (level >= 5) {
    logger.info({ projectId, level }, "Generating enterprise roadmap");

    const roadmapPrompt = `Genera un ROADMAP ESTRATÉGICO EMPRESARIAL de 12 meses:
${mainReport.replace(/<[^>]+>/g, " ").slice(0, 3000)}

Incluye:
1. Timeline mes a mes con objetivos, KPIs y acciones
2. Proyección financiera mensual (tabla: mes, revenue estimado, costes, margen)
3. 3 escenarios: pesimista, base, optimista
4. Análisis de riesgos (5 riesgos principales con probabilidad, impacto, mitigación)
5. Plan de equipo (roles necesarios, horas/semana, coste mensual)
6. Plan de escalabilidad (triggers para escalar: "Cuando llegues a X, contrata Y")
7. Plan de internacionalización (mercados prioritarios, idiomas, logística)
8. Checklist legal (GDPR, cookies, condiciones, LSSI, facturación)

Formato: tablas HTML profesionales con colores.`;

    const roadmap = await askClaudeWithBrain(
      projectId,
      [{ role: "user", content: roadmapPrompt }],
      systemPrompt, "general", niche, 16000
    );

    const roadmapHtml = reportShell(
      `Roadmap Enterprise — ${reportTitle}`,
      `Estrategia 12 meses completa`,
      roadmap,
      date,
      "ShopyBrain Intelligence"
    );

    const roadmapVaultId = await saveToVault({
      projectId,
      fileType: "enterprise-roadmap",
      category: "informes",
      title: `Roadmap Enterprise — ${reportTitle}`,
      mimeType: "text/html",
      generatedBy: "report-levels",
      content: roadmapHtml,
      metadata: { level, reportType },
    });

    files.push({ type: "enterprise-roadmap", title: `Roadmap Enterprise — ${reportTitle}`, htmlContent: roadmapHtml, vaultId: roadmapVaultId });
  }

  learnFromOperation({
    operationType: `report_level_${level}`,
    niche: niche ?? null,
    title: `Informe ${levelConfig.name}: ${reportTitle}`,
    content: `Generado informe nivel ${level} (${levelConfig.name}) para proyecto ${projectId}. Tipo: ${reportType}. Archivos generados: ${files.length}. IDs Vault: ${files.map(f => f.vaultId).filter(Boolean).join(", ")}.`,
    confidence: 0.9,
    tags: ["report", `level-${level}`, reportType],
  });

  return {
    level,
    levelName: levelConfig.name,
    files,
    totalPages: files.length,
  };
}
