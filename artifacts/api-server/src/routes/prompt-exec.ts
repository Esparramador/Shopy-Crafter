/**
 * Prompt Library Execution Engine
 * ─────────────────────────────────────────────────────────────────────────────
 * Converts 6,230+ static prompt templates into live AI tools by:
 * 1. Loading the template from the master library
 * 2. Resolving {{VARIABLE}} placeholders with real Brand DNA from the project
 * 3. Calling Claude with the resolved prompt
 * 4. Streaming the result back to the frontend
 * 5. Saving the output to ShopyBrain memory (optional)
 */

import { Router, type Request, type Response } from "express";
import { db } from "@workspace/db";
import { projectsTable, brandDnaTable } from "@workspace/db";
import { eq, sql } from "drizzle-orm";
import { enableLongRunning } from "../lib/long-running.js";
import { getClaudeClient, buildBrandDnaContext, buildShopyBrainContext, CLAUDE_MODEL, learnFromOperation } from "../lib/claude.js";
import { logger } from "../lib/logger.js";
import { randomUUID } from "crypto";

const router = Router();

interface DnaVarMap {
  [key: string]: string;
}

// ─── Build variable map from Brand DNA ──────────────────────────────────────

async function buildDnaVariableMap(projectId: number): Promise<DnaVarMap> {
  const [project] = await db.select().from(projectsTable).where(eq(projectsTable.id, projectId));
  if (!project) return {};

  const dnaRows = await db.execute(
    sql`SELECT * FROM brand_dna WHERE project_id = ${projectId} ORDER BY extracted_at DESC LIMIT 1`
  );
  const dnaRow = dnaRows.rows[0] as Record<string, unknown> | undefined;

  let fullProfile: Record<string, unknown> | null = null;
  if (dnaRow?.full_profile_json) {
    try { fullProfile = JSON.parse(dnaRow.full_profile_json as string); } catch {}
  }

  const ci = (fullProfile as any)?.companyInfo ?? {};
  const bi = (fullProfile as any)?.brandIdentity ?? {};
  const vi = (fullProfile as any)?.visualIdentity ?? {};
  const ta = (fullProfile as any)?.targetAudience ?? {};
  const dp = (fullProfile as any)?.digitalPresence ?? {};
  const mp = (fullProfile as any)?.marketPosition ?? {};
  const cs = (fullProfile as any)?.contentStrategy ?? {};
  const intel = (fullProfile as any)?.intelligence ?? {};
  const services = Array.isArray((fullProfile as any)?.services) ? (fullProfile as any).services : [];

  const shopDomain = project.shopDomain ?? "";
  const shopUrl = shopDomain ? (shopDomain.includes("://") ? shopDomain : `https://${shopDomain}`) : "";

  const varMap: DnaVarMap = {
    CLIENT_NAME: ci.name ?? project.name ?? "La Marca",
    BRAND_NAME: ci.name ?? project.name ?? "La Marca",
    COMPANY_NAME: ci.name ?? project.name ?? "La Marca",
    MARCA: ci.name ?? project.name ?? "La Marca",

    SECTOR: ci.sector ?? project.storeNiche ?? "eCommerce",
    NICHE: ci.sector ?? project.storeNiche ?? "eCommerce",
    INDUSTRY: ci.sector ?? "eCommerce",
    SUBSECTOR: ci.subsector ?? ci.sector ?? "eCommerce",

    DESCRIPTION: ci.description ?? project.name ?? "Descripción de la empresa",
    COMPANY_DESCRIPTION: ci.description ?? "",
    MISSION: ci.mission ?? "",
    VISION: ci.vision ?? "",
    LOCATION: ci.location ?? "",

    ARCHETYPE: bi.archetype ?? "Creador",
    BRAND_ARCHETYPE: bi.archetype ?? "Creador",
    TONE: bi.tone ?? "profesional",
    BRAND_TONE: bi.tone ?? "profesional",
    VOICE: bi.voiceCharacteristics?.join(", ") ?? "auténtico, cercano",
    VOICE_CHARACTERISTICS: bi.voiceCharacteristics?.join(", ") ?? "",
    UVP: bi.uniqueValueProposition ?? "Calidad excepcional y servicio personalizado",
    UNIQUE_VALUE_PROPOSITION: bi.uniqueValueProposition ?? "",
    TAGLINE: bi.taglines?.[0] ?? "",
    TAGLINES: bi.taglines?.join(" | ") ?? "",
    VALUES: bi.values?.join(", ") ?? "",
    BRAND_VALUES: bi.values?.join(", ") ?? "",
    PERSONALITY: bi.personality?.join(", ") ?? "",

    PRIMARY_COLOR: vi.primaryColors?.[0] ?? "#000000",
    SECONDARY_COLOR: vi.secondaryColors?.[0] ?? "#ffffff",
    COLORS: [...(vi.primaryColors ?? []), ...(vi.secondaryColors ?? [])].slice(0, 5).join(", "),
    TYPOGRAPHY: vi.typographyDescription ?? vi.typographyStyle ?? "sans-serif moderna",
    TYPOGRAPHY_STYLE: vi.typographyStyle ?? "sans-serif",
    LAYOUT: vi.layoutPattern ?? "moderno",
    PHOTO_STYLE: vi.photographyStyle ?? "lifestyle",
    AESTHETIC: vi.aestheticKeywords?.join(", ") ?? "",

    TARGET: ta.primary ?? "Clientes potenciales",
    AUDIENCE: ta.primary ?? "Clientes potenciales",
    TARGET_AUDIENCE: ta.primary ?? "",
    AGE_RANGE: ta.demographics?.ageRange ?? "25-45",
    GENDER: ta.demographics?.gender ?? "todos",
    INCOME: ta.demographics?.income ?? "medio",
    PAIN_POINTS: ta.painPoints?.join(", ") ?? "",
    DESIRES: ta.desires?.join(", ") ?? "",

    PRICE_POINT: mp.pricePoint ?? "mid",
    COMPETITORS: mp.mainCompetitors?.join(", ") ?? "",
    COMPETITIVE_ADVANTAGE: mp.competitiveAdvantage ?? "",

    CONTENT_PILLARS: cs.contentPillars?.join(", ") ?? "",
    CTA_STYLE: cs.ctaStyle ?? "emocional",
    COPYWRITING_STYLE: cs.copywritingStyle ?? "",
    KEY_MESSAGES: cs.keyMessages?.join(" | ") ?? "",

    INSTAGRAM: dp.socialHandles?.find((h: any) => h.platform === "instagram")?.handle ?? "",
    FACEBOOK: dp.socialHandles?.find((h: any) => h.platform === "facebook")?.handle ?? "",
    TIKTOK: dp.socialHandles?.find((h: any) => h.platform === "tiktok")?.handle ?? "",
    TWITTER: dp.socialHandles?.find((h: any) => h.platform === "twitter")?.handle ?? "",
    YOUTUBE: dp.socialHandles?.find((h: any) => h.platform === "youtube")?.handle ?? "",
    LINKEDIN: dp.socialHandles?.find((h: any) => h.platform === "linkedin")?.handle ?? "",

    SERVICES: services.map((s: any) => s.name).join(", "),
    PRODUCTS: services.map((s: any) => s.name).join(", "),

    WEBSITE: shopUrl,
    DOMAIN: shopDomain,

    SUMMARY: intel.summary ?? "",
    PERSONALIZATION_GUIDE: intel.contentPersonalizationGuide ?? "",

    LANGUAGE: ci.languages?.[0] ?? "español",
    MARKET: ta.geography?.join(", ") ?? "España",
  };

  return varMap;
}

// ─── Resolve {{VARIABLES}} in template ──────────────────────────────────────

function resolveTemplate(template: string, vars: DnaVarMap): {
  resolved: string;
  usedVars: string[];
  unresolvedVars: string[];
} {
  const allVars = [...template.matchAll(/\{\{([A-Z_]+)\}\}/g)].map(m => m[1]);
  const usedVars: string[] = [];
  const unresolvedVars: string[] = [];

  let resolved = template.replace(/\{\{([A-Z_]+)\}\}/g, (_, varName) => {
    const value = vars[varName];
    if (value !== undefined && value !== "") {
      usedVars.push(varName);
      return value;
    }
    unresolvedVars.push(varName);
    return `[${varName}]`;
  });

  return { resolved, usedVars, unresolvedVars };
}

// ─── POST /api/prompt-library/execute ───────────────────────────────────────

router.post("/prompt-library/execute", async (req: Request, res: Response): Promise<void> => {
  enableLongRunning(res);
  const opId = randomUUID();

  try {
    const {
      template,
      projectId,
      customVars = {},
      model = CLAUDE_MODEL,
      maxTokens = 4096,
      saveToMemory = false,
      systemOverride,
    } = req.body as {
      template: string;
      projectId?: number;
      customVars?: Record<string, string>;
      model?: string;
      maxTokens?: number;
      saveToMemory?: boolean;
      systemOverride?: string;
    };

    if (!template?.trim()) {
      res.status(400).json({ error: "template requerido" });
      return;
    }

    let dnaVars: DnaVarMap = {};
    let brandDnaContext = "";

    if (projectId) {
      try {
        [dnaVars, brandDnaContext] = await Promise.all([
          buildDnaVariableMap(projectId),
          buildBrandDnaContext(projectId),
        ]);
      } catch (e) {
        logger.warn({ e, projectId }, "prompt-exec: could not load DNA — proceeding without");
      }
    }

    const mergedVars: DnaVarMap = { ...dnaVars, ...customVars };
    const { resolved, usedVars, unresolvedVars } = resolveTemplate(template, mergedVars);

    const brainCtx = projectId
      ? await buildShopyBrainContext(undefined, undefined, resolved.slice(0, 200))
      : "";

    const systemPrompt = systemOverride ??
      `Eres ShopyBrain, el motor de inteligencia artificial más avanzado para eCommerce y marketing de marca.
Ejecutas prompts de la Librería Maestra de Shopy Crafter con precisión y creatividad excepcional.
Personaliza el 100% de tu respuesta al ADN de marca inyectado. NUNCA generes contenido genérico.
${brandDnaContext}${brainCtx}`;

    const client = await getClaudeClient(0);

    res.writeHead(200, {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
    });

    let fullResult = "";

    const stream = await client.messages.stream({
      model,
      max_tokens: maxTokens,
      system: systemPrompt,
      messages: [{ role: "user", content: resolved }],
    });

    res.write(`data: ${JSON.stringify({ type: "meta", usedVars, unresolvedVars, resolvedPrompt: resolved.slice(0, 500) })}\n\n`);

    for await (const chunk of stream) {
      if (chunk.type === "content_block_delta" && chunk.delta.type === "text_delta") {
        fullResult += chunk.delta.text;
        res.write(`data: ${JSON.stringify({ type: "delta", text: chunk.delta.text })}\n\n`);
      }
    }

    // Si se cortó por max_tokens se dice en el evento final y no se aprende de un
    // resultado a medias.
    const truncated = (await stream.finalMessage()).stop_reason === "max_tokens";
    if (truncated) logger.warn({ opId, maxTokens, outputLength: fullResult.length }, "prompt-exec: salida cortada por max_tokens");
    res.write(`data: ${JSON.stringify({ type: "done", totalLength: fullResult.length, truncated })}\n\n`);
    res.end();

    if (saveToMemory && projectId && fullResult.length > 100 && !truncated) {
      learnFromOperation({
        operationType: "prompt_library_execution",
        sourceProjectId: typeof projectId === "number" ? projectId : undefined,
        title: "prompt_exec",
        content: fullResult.slice(0, 500),
      });
    }

    logger.info({ opId, projectId, usedVars: usedVars.length, outputLength: fullResult.length }, "prompt-exec: completed");
  } catch (err: any) {
    logger.error({ err, opId }, "prompt-exec: error");
    if (!res.headersSent) {
      res.status(500).json({ error: err.message ?? "Error ejecutando prompt" });
    } else {
      res.write(`data: ${JSON.stringify({ type: "error", message: err.message ?? "Error" })}\n\n`);
      res.end();
    }
  }
});

// ─── POST /api/prompt-library/preview-vars ───────────────────────────────────
// Returns which {{VARIABLES}} in a template will resolve with a given project's DNA

router.post("/prompt-library/preview-vars", async (req: Request, res: Response): Promise<void> => {
  try {
    const { template, projectId } = req.body as { template: string; projectId?: number };
    if (!template) { res.status(400).json({ error: "template requerido" }); return; }

    const allVars = [...template.matchAll(/\{\{([A-Z_]+)\}\}/g)].map(m => m[1]);
    const uniqueVars = [...new Set(allVars)];

    if (!projectId) {
      res.json({ vars: uniqueVars.map(v => ({ name: v, value: null, resolved: false })) });
      return;
    }

    const dnaVars = await buildDnaVariableMap(projectId);
    const result = uniqueVars.map(v => ({
      name: v,
      value: dnaVars[v] ?? null,
      resolved: !!(dnaVars[v]),
    }));

    res.json({ vars: result, totalVars: uniqueVars.length, resolvedCount: result.filter(v => v.resolved).length });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
