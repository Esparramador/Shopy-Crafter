/**
 * Visme Effects Engine Routes
 * GET  /api/visme/stats          — conteos
 * GET  /api/visme/snippets       — 30 pre-built CSS/JS snippets
 * GET  /api/visme/templates      — 594 Visme templates (category/search/page)
 * POST /api/visme/generate       — SSE streaming custom effect generation
 * POST /api/visme/preview        — HTML preview with DNA applied
 */
import { Router, type Request, type Response } from "express";
import {
  EFFECT_SNIPPETS, loadVismeTemplates, applyDna, buildDnaFromProject, buildEffectPreviewHtml,
  type DnaVars, DEFAULT_DNA,
} from "../lib/visme-effects.js";
import { streamHtmlClaude } from "../lib/web-designer.js";
import { logger } from "../lib/logger.js";

const router = Router();

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

export default router;
