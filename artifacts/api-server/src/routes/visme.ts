/**
 * Visme Effects Engine Routes
 * GET  /api/visme/stats          — conteos
 * GET  /api/visme/snippets       — 30 pre-built CSS/JS snippets
 * GET  /api/visme/templates      — 594 Visme templates (category/search/page)
 * POST /api/visme/generate       — SSE streaming custom effect generation
 * POST /api/visme/preview        — HTML preview with DNA applied
 */
import { Router, type Request, type Response } from "express";
import Anthropic from "@anthropic-ai/sdk";
import {
  EFFECT_SNIPPETS, loadVismeTemplates, loadEffectsPrompts, applyDna, buildDnaFromProject, buildEffectPreviewHtml,
  type DnaVars, DEFAULT_DNA,
} from "../lib/visme-effects.js";
import { streamHtmlClaude } from "../lib/web-designer.js";
import { logger } from "../lib/logger.js";

/** Same pattern as claude.ts getDefaultClient — prefers AI Integrations proxy */
function makeAnthropicClient(): Anthropic {
  if (process.env.AI_INTEGRATIONS_ANTHROPIC_BASE_URL && process.env.AI_INTEGRATIONS_ANTHROPIC_API_KEY) {
    return new Anthropic({
      baseURL: process.env.AI_INTEGRATIONS_ANTHROPIC_BASE_URL,
      apiKey: process.env.AI_INTEGRATIONS_ANTHROPIC_API_KEY,
    });
  }
  return new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
}

const router = Router();

// ── Effects prompts endpoint (used by Web Designer → Effects tab) ────────────
router.get("/prompts/effects", (_req: Request, res: Response) => {
  try {
    const data = loadEffectsPrompts();
    res.json({ templates: data, count: data.length });
  } catch (err: any) {
    logger.error({ err }, "prompts/effects error");
    res.status(500).json({ error: err.message });
  }
});

// ── Alias: /api/designer/effects (fallback from Claude Designer HTML) ─────────
router.get("/designer/effects", (_req: Request, res: Response) => {
  try {
    const data = loadEffectsPrompts();
    res.json({ templates: data, count: data.length });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.get("/visme/stats", (_req: Request, res: Response) => {
  const templates = loadVismeTemplates();
  const cats = new Set(templates.map(t => t.category));
  res.json({
    builtinSnippets: EFFECT_SNIPPETS.length,
    vismeTemplates: templates.length,
    categories: cats.size,
    snippetCategories: [...new Set(EFFECT_SNIPPETS.map(s => s.category))],
    vismeCategories: [...cats].sort(),
  });
});

router.get("/visme/snippets", async (req: Request, res: Response): Promise<void> => {
  try {
    const { category, search, projectId } = req.query as Record<string, string>;
    let snippets = [...EFFECT_SNIPPETS];
    if (category && category !== "all") snippets = snippets.filter(s => s.category === category);
    if (search) {
      const q = search.toLowerCase();
      snippets = snippets.filter(s => s.name.toLowerCase().includes(q) || s.description.toLowerCase().includes(q) || s.category.toLowerCase().includes(q));
    }

    let dna: DnaVars = DEFAULT_DNA;
    if (projectId) {
      try {
        const { db, projectsTable } = await import("@workspace/db");
        const { eq } = await import("drizzle-orm");
        const [proj] = await db.select().from(projectsTable).where(eq(projectsTable.id, Number(projectId)));
        if (proj) dna = buildDnaFromProject(proj);
      } catch { /* use defaults */ }
    }

    res.json({
      items: snippets.map(s => ({
        id: s.id,
        name: s.name,
        category: s.category,
        description: s.description,
        source: "builtin",
        libs: s.libs,
        hasJs: !!s.js,
        previewCss: applyDna(s.css, dna).slice(0, 400),
      })),
      total: snippets.length,
      dna,
    });
  } catch (err: any) {
    logger.error({ err }, "visme/snippets error");
    res.status(500).json({ error: err.message });
  }
});

router.get("/visme/snippets/:id", async (req: Request, res: Response): Promise<void> => {
  try {
    const { projectId } = req.query as Record<string, string>;
    const snippet = EFFECT_SNIPPETS.find(s => s.id === req.params.id);
    if (!snippet) { res.status(404).json({ error: "Snippet not found" }); return; }

    let dna: DnaVars = DEFAULT_DNA;
    if (projectId) {
      try {
        const { db, projectsTable } = await import("@workspace/db");
        const { eq } = await import("drizzle-orm");
        const [proj] = await db.select().from(projectsTable).where(eq(projectsTable.id, Number(projectId)));
        if (proj) dna = buildDnaFromProject(proj);
      } catch { /* use defaults */ }
    }

    res.json({
      ...snippet,
      html: applyDna(snippet.html, dna),
      css: applyDna(snippet.css, dna),
      js: applyDna(snippet.js, dna),
      previewHtml: buildEffectPreviewHtml(snippet, dna),
      dna,
    });
  } catch (err: any) {
    logger.error({ err }, "visme/snippets/:id error");
    res.status(500).json({ error: err.message });
  }
});

router.get("/visme/templates", async (req: Request, res: Response): Promise<void> => {
  try {
    const { category, search, page = "1", limit = "24" } = req.query as Record<string, string>;
    const allTemplates = loadVismeTemplates();
    let filtered = allTemplates;
    if (category && category !== "all") filtered = filtered.filter(t => t.category === category);
    if (search) {
      const q = search.toLowerCase();
      filtered = filtered.filter(t =>
        t.name.toLowerCase().includes(q) ||
        t.description?.toLowerCase().includes(q) ||
        t.category.toLowerCase().includes(q) ||
        t.tags?.some((tag: string) => tag.includes(q))
      );
    }
    const pageNum = Math.max(1, parseInt(page));
    const limitNum = Math.min(100, Math.max(1, parseInt(limit)));
    const start = (pageNum - 1) * limitNum;
    res.json({
      items: filtered.slice(start, start + limitNum),
      total: filtered.length,
      page: pageNum,
      pages: Math.ceil(filtered.length / limitNum),
    });
  } catch (err: any) {
    logger.error({ err }, "visme/templates error");
    res.status(500).json({ error: err.message });
  }
});

router.post("/visme/generate", async (req: Request, res: Response): Promise<void> => {
  try {
    const { prompt, projectId, includeSnippets = true } = req.body as {
      prompt: string;
      projectId?: number;
      includeSnippets?: boolean;
    };
    if (!prompt?.trim()) { res.status(400).json({ error: "prompt is required" }); return; }

    let dna: DnaVars = DEFAULT_DNA;
    if (projectId) {
      try {
        const { db, projectsTable } = await import("@workspace/db");
        const { eq } = await import("drizzle-orm");
        const [proj] = await db.select().from(projectsTable).where(eq(projectsTable.id, Number(projectId)));
        if (proj) dna = buildDnaFromProject(proj);
      } catch { /* use defaults */ }
    }

    const snippetHints = includeSnippets
      ? `\nAvailable pre-built snippets you can combine: ${EFFECT_SNIPPETS.map(s => s.id).join(", ")}`
      : "";

    const dnaStr = `\nBrand DNA: primary=${dna.primary}, secondary=${dna.secondary}, bg=${dna.bg}, font=${dna.font}, name="${dna.name}"`;
    const fullPrompt = `${prompt}${dnaStr}${snippetHints}\n\nGenerate a complete, production-ready HTML component/effect using the brand colors. Include all CSS and JS inline. Output ONLY HTML.`;

    res.setHeader("Content-Type", "text/event-stream; charset=utf-8");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    res.flushHeaders?.();

    let fullHtml = "";
    const heartbeat = setInterval(() => {
      try { res.write(": ping\n\n"); } catch {}
    }, 20000);

    try {
      for await (const chunk of streamHtmlClaude(fullPrompt, "", "claude-sonnet-4-5", [], dna)) {
        fullHtml += chunk;
        res.write(`data: ${JSON.stringify({ chunk })}\n\n`);
      }
      // Send final complete HTML
      const { stripFences } = await import("../lib/web-designer.js");
      res.write(`data: ${JSON.stringify({ done: true, html: stripFences(fullHtml) })}\n\n`);
    } finally {
      clearInterval(heartbeat);
      res.end();
    }
  } catch (err: any) {
    logger.error({ err }, "visme/generate error");
    if (!res.headersSent) res.status(500).json({ error: err.message });
    else { try { res.write(`data: ${JSON.stringify({ error: err.message })}\n\n`); res.end(); } catch {} }
  }
});

/**
 * POST /api/visme/adapt
 * Adapts ANY prompt (from master library, Visme, or custom) to a specific client
 * using Brand DNA injection via Claude streaming.
 * Body: { prompt, projectId?, outputType?, clientContext? }
 */
router.post("/visme/adapt", async (req: Request, res: Response): Promise<void> => {
  try {
    const { prompt, projectId, outputType = "copy", clientContext = "" } = req.body as {
      prompt: string; projectId?: number; outputType?: string; clientContext?: string;
    };
    if (!prompt?.trim()) { res.status(400).json({ error: "prompt is required" }); return; }

    let dna: DnaVars = DEFAULT_DNA;
    let projectName = "tu marca";
    let sector = "e-commerce";
    if (projectId) {
      try {
        const { db, projectsTable } = await import("@workspace/db");
        const { eq } = await import("drizzle-orm");
        const [proj] = await db.select().from(projectsTable).where(eq(projectsTable.id, Number(projectId)));
        if (proj) {
          dna = buildDnaFromProject(proj);
          projectName = (proj as any).name ?? projectName;
          sector = (proj as any).sector ?? sector;
        }
      } catch { /* use defaults */ }
    }

    const dnaContext = `
BRAND DNA — ${projectName}:
- Colores: primario=${dna.primary}, secundario=${dna.secondary}, fondo=${dna.bg}
- Tipografía: ${dna.font}
- Sector: ${sector}
- Headline de marca: "${dna.headline}"
- Tagline: "${dna.tagline}"
- CTA principal: "${dna.cta}"
- USP: ${dna.usp1 || "propuesta de valor única"}
${clientContext ? `\nContexto adicional del cliente: ${clientContext}` : ""}`;

    const outputTypeInstructions: Record<string, string> = {
      copy: "Reescribe este prompt adaptándolo para generar COPY/TEXTO persuasivo de marketing para esta marca. Devuelve el prompt adaptado listo para usar en Claude/GPT.",
      html: "Reescribe este prompt adaptándolo para generar un COMPONENTE HTML/CSS/JS completo para esta marca. Incluye instrucciones de colores, tipografía y estilo de marca. Devuelve el prompt adaptado.",
      image: "Reescribe este prompt adaptándolo para generar IMÁGENES con IA (Flux/Midjourney/Ideogram) para esta marca. Incluye paleta de colores, estilo visual y estética. Devuelve el prompt de imagen adaptado.",
      video: "Reescribe este prompt adaptándolo para generar un VÍDEO/SCRIPT para esta marca. Adapta el tono, estilo y mensajes a la identidad de marca. Devuelve el prompt adaptado.",
      social: "Reescribe este prompt adaptándolo para generar CONTENIDO SOCIAL MEDIA para esta marca. Adapta el tono, hashtags sugeridos y estilo de comunicación. Devuelve el prompt adaptado.",
      email: "Reescribe este prompt adaptándolo para generar un EMAIL MARKETING para esta marca. Adapta el asunto, tono y estructura. Devuelve el prompt adaptado.",
    };
    const instruction = outputTypeInstructions[outputType] ?? outputTypeInstructions.copy;

    const systemPrompt = `Eres un experto en marketing digital y branding especializado en adaptar prompts de IA para marcas específicas.
Tu tarea: tomar un prompt genérico y adaptarlo con el DNA de la marca para que el output generado refleje perfectamente la identidad, colores, tono y valores de la marca.
REGLAS:
- Mantén la esencia y objetivo del prompt original
- Inyecta los colores de marca en referencias visuales
- Usa el tono y voz de la marca
- Incluye el nombre de la marca donde sea natural
- Adapta referencias de sector/industria
- El output DEBE SER el prompt adaptado DIRECTAMENTE (no expliques, no añadas comentarios extra)
- Escribe en español si el original está en español, en inglés si está en inglés`;

    const userPrompt = `PROMPT ORIGINAL:
${prompt}

${dnaContext}

TAREA: ${instruction}

PROMPT ADAPTADO PARA ${projectName.toUpperCase()}:`;

    res.setHeader("Content-Type", "text/event-stream; charset=utf-8");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    res.flushHeaders?.();

    let fullText = "";
    const heartbeat = setInterval(() => { try { res.write(": ping\n\n"); } catch {} }, 20000);

    try {
      const client = makeAnthropicClient();
      const stream = await client.messages.stream({
        model: "claude-haiku-4-5",
        max_tokens: 2048,
        system: systemPrompt,
        messages: [{ role: "user", content: userPrompt }],
      });
      for await (const event of stream) {
        if (event.type === "content_block_delta" && event.delta.type === "text_delta") {
          fullText += event.delta.text;
          res.write(`data: ${JSON.stringify({ chunk: event.delta.text })}\n\n`);
        }
      }
      res.write(`data: ${JSON.stringify({ done: true, adapted: fullText, dna })}\n\n`);
    } finally {
      clearInterval(heartbeat);
      res.end();
    }
  } catch (err: any) {
    logger.error({ err }, "visme/adapt error");
    if (!res.headersSent) res.status(500).json({ error: err.message });
    else { try { res.write(`data: ${JSON.stringify({ error: err.message })}\n\n`); res.end(); } catch {} }
  }
});

router.post("/visme/preview", async (req: Request, res: Response): Promise<void> => {
  try {
    const { snippetId, html, css, js, projectId } = req.body as {
      snippetId?: string; html?: string; css?: string; js?: string; projectId?: number;
    };

    let dna: DnaVars = DEFAULT_DNA;
    if (projectId) {
      try {
        const { db, projectsTable } = await import("@workspace/db");
        const { eq } = await import("drizzle-orm");
        const [proj] = await db.select().from(projectsTable).where(eq(projectsTable.id, Number(projectId)));
        if (proj) dna = buildDnaFromProject(proj);
      } catch { /* use defaults */ }
    }

    if (snippetId) {
      const snippet = EFFECT_SNIPPETS.find(s => s.id === snippetId);
      if (!snippet) { res.status(404).json({ error: "Snippet not found" }); return; }
      res.json({ html: buildEffectPreviewHtml(snippet, dna), dna });
      return;
    }

    if (html !== undefined) {
      const previewHtml = applyDna(html, dna);
      const previewCss = applyDna(css ?? "", dna);
      const previewJs = applyDna(js ?? "", dna);
      res.json({
        html: `<!DOCTYPE html><html><head><meta charset="UTF-8"><style>*{margin:0;padding:0;box-sizing:border-box}body{background:${dna.bg};color:${dna.text};font-family:'${dna.font}',sans-serif;padding:40px}${previewCss}</style></head><body>${previewHtml}${previewJs ? `<script>${previewJs}</script>` : ""}</body></html>`,
        dna,
      });
      return;
    }
    res.status(400).json({ error: "snippetId or html is required" });
  } catch (err: any) {
    logger.error({ err }, "visme/preview error");
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/visme/compose
 * Multi-effect composer: combines selected snippets into a full page with Claude.
 * Body: { effect_ids: string[], dna?: {...}, page_type?: string }
 * Returns: { ok: true, html: string }
 */
router.post("/visme/compose", async (req: Request, res: Response): Promise<void> => {
  try {
    const { effect_ids, dna: bodyDna, page_type = "landing", projectId } = req.body as {
      effect_ids: string[];
      dna?: Record<string, string>;
      page_type?: string;
      projectId?: number;
    };

    if (!effect_ids?.length) { res.status(400).json({ error: "effect_ids is required" }); return; }
    const ids = effect_ids.slice(0, 8);

    let dna: DnaVars = DEFAULT_DNA;
    if (projectId) {
      try {
        const { db, projectsTable } = await import("@workspace/db");
        const { eq } = await import("drizzle-orm");
        const [proj] = await db.select().from(projectsTable).where(eq(projectsTable.id, Number(projectId)));
        if (proj) dna = buildDnaFromProject(proj);
      } catch { /* use defaults */ }
    }
    // Body DNA overrides project DNA
    if (bodyDna) {
      if (bodyDna.primary_color)   dna = { ...dna, primary: bodyDna.primary_color };
      if (bodyDna.secondary_color) dna = { ...dna, secondary: bodyDna.secondary_color };
      if (bodyDna.bg_color)        dna = { ...dna, bg: bodyDna.bg_color };
      if (bodyDna.font)            dna = { ...dna, font: bodyDna.font };
      if (bodyDna.name)            dna = { ...dna, name: bodyDna.name };
      if (bodyDna.headline)        dna = { ...dna, headline: bodyDna.headline };
      if (bodyDna.tagline)         dna = { ...dna, tagline: bodyDna.tagline };
      if (bodyDna.cta)             dna = { ...dna, cta: bodyDna.cta };
    }

    // Build snippet summaries for the prompt
    const foundSnippets = ids
      .map(id => EFFECT_SNIPPETS.find(s => s.id === id))
      .filter(Boolean) as typeof EFFECT_SNIPPETS;

    const snippetSummaries = foundSnippets.map(s => {
      const cssLen = s.css?.length ?? 0;
      const jsLen  = s.js?.length ?? 0;
      return `- ${s.id} (${s.category}): ${s.description ?? s.name}  [css:${cssLen}ch, js:${jsLen}ch]`;
    }).join("\n");

    // Inline code for small snippets (≤4KB each) to let Claude understand the techniques
    const inlineCode = foundSnippets.slice(0, 4).map(s => {
      const parts: string[] = [`/* == ${s.id} == */`];
      if (s.css?.trim()) parts.push(`/* CSS */\n${s.css.slice(0, 800)}`);
      if (s.js?.trim())  parts.push(`/* JS */\n${s.js.slice(0, 800)}`);
      return parts.join("\n");
    }).join("\n\n");

    const brandBlock = `
BRAND DNA — ${dna.name}:
  Primary: ${dna.primary}  Secondary: ${dna.secondary}  Background: ${dna.bg}
  Font: ${dna.font}
  Headline: "${dna.headline}"  Tagline: "${dna.tagline}"  CTA: "${dna.cta}"`;

    const composePrompt = `You are a senior creative front-end developer. Compose a complete, production-ready ${page_type} page in HTML that authentically integrates the following ${foundSnippets.length} visual effects.

${brandBlock}

EFFECTS TO INTEGRATE (${foundSnippets.length}):
${snippetSummaries}

REFERENCE CODE (for technique guidance):
${inlineCode}

REQUIREMENTS:
1. One self-contained HTML file with all CSS and JS inline — NO external imports except Google Fonts.
2. Apply the brand DNA: use the exact colors, font, and copy provided.
3. Each effect must be clearly visible and correctly implemented.
4. The page must be visually stunning and feel premium — agency-quality.
5. Full height sections, smooth animations, polished typography.
6. Output ONLY the raw HTML — no markdown, no code fences, no explanation.`;

    const ant = makeAnthropicClient();
    const msg = await ant.messages.create({
      model: "claude-sonnet-4-5",
      max_tokens: 8000,
      messages: [{ role: "user", content: composePrompt }],
    });

    const raw = (msg.content[0] as any)?.text ?? "";
    const { stripFences } = await import("../lib/web-designer.js");
    const html = stripFences(raw);

    if (!html.includes("<")) {
      res.status(500).json({ ok: false, error: "Claude returned no HTML" });
      return;
    }
    res.json({ ok: true, html, effects: foundSnippets.map(s => s.id) });
  } catch (err: any) {
    logger.error({ err }, "visme/compose error");
    res.status(500).json({ ok: false, error: err.message });
  }
});

export default router;
