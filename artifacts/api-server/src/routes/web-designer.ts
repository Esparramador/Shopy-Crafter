/**
 * AI Web Designer Routes
 * GET  /api/web-designer/templates            — 14+ design templates
 * GET  /api/web-designer/demos                — 26 reference demos list
 * GET  /api/web-designer/sessions             — list sessions
 * GET  /api/web-designer/sessions/:id         — get session
 * POST /api/web-designer/sessions/:id         — save/update session
 * POST /api/web-designer/generate             — SSE streaming HTML generation
 * POST /api/web-designer/deploy               — deploy HTML to project vault
 */
import { Router, type Request, type Response } from "express";
import {
  DESIGNER_TEMPLATES, streamHtml, stripFences,
  getSession, saveSession, listSessions,
} from "../lib/web-designer.js";
import { buildDnaFromProject } from "../lib/visme-effects.js";
import { logger } from "../lib/logger.js";
import { randomBytes } from "crypto";

const router = Router();

const DEMOS = [
  { id: "01", name: "Particle SaaS", category: "3d", file: "01-particle-saas.html" },
  { id: "02", name: "Cinematic Agency", category: "agency", file: "02-cinematic-agency.html" },
  { id: "03", name: "Glass Product 3D", category: "3d", file: "03-glass-product-3d.html" },
  { id: "04", name: "Disassembly Scroll", category: "3d", file: "04-disassembly-scroll.html" },
  { id: "05", name: "21st.dev Effects", category: "effects", file: "05-21stdev-effects.html" },
  { id: "06", name: "Shaders & Particles", category: "3d", file: "06-shaders-particles.html" },
  { id: "07", name: "Landing Sections", category: "landing", file: "07-landing-sections.html" },
  { id: "08", name: "Micro-Interactions", category: "ui", file: "08-micro-interactions.html" },
  { id: "09", name: "Video & Image Effects", category: "effects", file: "09-video-image-effects.html" },
  { id: "10", name: "3D Product Viewer", category: "3d", file: "10-3d-product-viewer.html" },
  { id: "11", name: "Immersive Scroll (Lenis)", category: "scroll", file: "11-immersive-scroll-lenis.html" },
  { id: "12", name: "Explode View GLB", category: "3d", file: "12-explode-view-glb.html" },
  { id: "13", name: "Scroll Media Expansion", category: "scroll", file: "13-scroll-media-expansion.html" },
  { id: "14", name: "3D Globe World", category: "3d", file: "14-3d-globe-world.html" },
  { id: "15", name: "UI Premium Components", category: "ui", file: "15-ui-premium-components.html" },
  { id: "16", name: "Spline Hero Fluid", category: "3d", file: "16-spline-hero-fluid.html" },
  { id: "17", name: "Morphing Text Particles", category: "effects", file: "17-morphing-text-particles.html" },
  { id: "18", name: "3D Scroll Narrative", category: "scroll", file: "18-3d-scroll-narrative.html" },
  { id: "19", name: "Gradient Mesh Backgrounds", category: "effects", file: "19-gradient-mesh-backgrounds.html" },
  { id: "20", name: "Magnetic Cursor Effects", category: "interactive", file: "20-magnetic-cursor-effects.html" },
  { id: "21", name: "Data Visualization", category: "charts", file: "21-data-visualization.html" },
  { id: "22", name: "3D Carousel Gallery", category: "3d", file: "22-3d-carousel-gallery.html" },
  { id: "23", name: "Page Transitions", category: "effects", file: "23-page-transitions.html" },
  { id: "24", name: "Infinite Scroll Feed", category: "scroll", file: "24-infinite-scroll-feed.html" },
  { id: "25", name: "Hero Sections", category: "landing", file: "25-hero-sections.html" },
  { id: "26", name: "Bento Grids", category: "ui", file: "26-bento-grids.html" },
  { id: "27", name: "Suburbia R3F Tricks + Physics", category: "3d", file: "27-suburbia-r3f-tricks.html" },
  { id: "28", name: "Noova Bento Tilt + Animated Words", category: "effects", file: "28-noova-bento-tilt.html" },
  { id: "29", name: "Medical Canvas 2D + Counters", category: "effects", file: "29-medical-canvas2d-counters.html" },
  { id: "30", name: "Ferrari GLB Lerp + Snap Scroll", category: "3d", file: "30-ferrari-glb-lerp-snap.html" },
];

router.get("/web-designer/templates", (_req: Request, res: Response) => {
  res.json(DESIGNER_TEMPLATES);
});

router.get("/web-designer/demos", (_req: Request, res: Response) => {
  res.json(DEMOS);
});

router.get("/web-designer/demo-html/:filename", async (req: Request, res: Response): Promise<void> => {
  const filename = String(req.params.filename);
  if (!/^[\w-]+\.html$/.test(filename)) {
    res.status(400).json({ error: "Invalid filename" });
    return;
  }
  try {
    const { readFileSync } = await import("fs");
    const { resolve, dirname } = await import("path");
    const { fileURLToPath } = await import("url");
    const __dir = dirname(fileURLToPath(import.meta.url as string));
    const demoPath = resolve(__dir, "../../../../shopify-optimizer/public/web-demos", filename);
    const html = readFileSync(demoPath, "utf-8");
    res.json({ ok: true, html, filename, chars: html.length });
  } catch {
    res.status(404).json({ error: "Demo not found", filename });
  }
});

router.get("/web-designer/sessions", (_req: Request, res: Response) => {
  res.json(listSessions());
});

router.get("/web-designer/sessions/:id", (req: Request, res: Response) => {
  res.json(getSession(String(req.params.id)));
});

router.post("/web-designer/sessions/:id", (req: Request, res: Response) => {
  const saved = saveSession({ ...req.body, id: req.params.id });
  res.json(saved);
});

router.post("/web-designer/generate", async (req: Request, res: Response): Promise<void> => {
  try {
    const { prompt, currentHtml = "", model = "claude-sonnet-4-5", history = [], sessionId, projectId } = req.body as {
      prompt: string; currentHtml?: string; model?: string;
      history?: Array<{role: string; content: string}>;
      sessionId?: string; projectId?: number;
    };

    if (!prompt?.trim()) { res.status(400).json({ error: "prompt is required" }); return; }

    let dna;
    if (projectId) {
      try {
        const { db, projectsTable } = await import("@workspace/db");
        const { eq } = await import("drizzle-orm");
        const [proj] = await db.select().from(projectsTable).where(eq(projectsTable.id, Number(projectId)));
        if (proj) dna = buildDnaFromProject(proj);
      } catch { /* use defaults */ }
    }

    res.setHeader("Content-Type", "text/event-stream; charset=utf-8");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    res.flushHeaders?.();

    const sid = sessionId ?? randomBytes(8).toString("hex");
    let fullHtml = "";
    const heartbeat = setInterval(() => {
      try { res.write(": ping\n\n"); } catch {}
    }, 20000);

    try {
      for await (const chunk of streamHtml(prompt, currentHtml, model, history, dna)) {
        fullHtml += chunk;
        res.write(`data: ${JSON.stringify({ chunk })}\n\n`);
      }
      const cleanHtml = stripFences(fullHtml);
      // Save session
      const session = getSession(sid);
      session.history.push({ role: "user", content: prompt });
      session.history.push({ role: "assistant", content: cleanHtml.slice(0, 2000) + (cleanHtml.length > 2000 ? "…" : "") });
      session.currentHtml = cleanHtml;
      session.model = model;
      if (projectId) session.projectId = projectId;
      saveSession(session);

      res.write(`data: ${JSON.stringify({ done: true, html: cleanHtml, sessionId: sid })}\n\n`);
    } finally {
      clearInterval(heartbeat);
      res.end();
    }
  } catch (err: any) {
    logger.error({ err }, "web-designer/generate error");
    if (!res.headersSent) res.status(500).json({ error: err.message });
    else { try { res.write(`data: ${JSON.stringify({ error: err.message })}\n\n`); res.end(); } catch {} }
  }
});

router.post("/web-designer/import-url", async (req: Request, res: Response): Promise<void> => {
  try {
    const { url } = req.body as { url: string };
    if (!url?.trim()) { res.status(400).json({ error: "url is required" }); return; }
    const resp = await fetch(url, {
      signal: AbortSignal.timeout(15_000),
      headers: { "User-Agent": "Mozilla/5.0 (compatible; ShopyCrafter/1.0 Web Designer)" },
    });
    if (!resp.ok) { res.status(400).json({ error: `HTTP ${resp.status} fetching URL` }); return; }
    const html = await resp.text();
    res.json({ ok: true, html: html.slice(0, 200_000), chars: html.length, url });
  } catch (err: any) {
    logger.error({ err }, "web-designer/import-url error");
    res.status(500).json({ error: err.message });
  }
});

router.post("/web-designer/deploy", async (req: Request, res: Response): Promise<void> => {
  try {
    const { html, projectId, pageName = "design", sessionId } = req.body as {
      html: string; projectId: number; pageName?: string; sessionId?: string;
    };
    if (!html) { res.status(400).json({ error: "html is required" }); return; }
    if (!projectId) { res.status(400).json({ error: "projectId is required" }); return; }

    const { db } = await import("@workspace/db");
    const { sql } = await import("drizzle-orm");
    const title = `${pageName} — Web Designer`;
    const tags = ["web-designer", pageName, sessionId ?? ""].filter(Boolean);

    const vaultRows = await db.execute(sql`
      INSERT INTO vault_files (project_id, title, category, file_type, content, metadata, generated_by, created_at)
      VALUES (${projectId}, ${title}, 'web-designer', 'html', ${html},
        ${JSON.stringify({ sessionId, pageName, chars: html.length })},
        'web-designer', NOW())
      ON CONFLICT DO NOTHING
      RETURNING id
    `);
    const vault = (vaultRows as unknown as any[])[0];

    res.json({ success: true, message: `"${pageName}" desplegado a la bóveda`, vaultId: (vault as any)?.id });
  } catch (err: any) {
    logger.error({ err }, "web-designer/deploy error");
    res.status(500).json({ error: err.message });
  }
});

export default router;
