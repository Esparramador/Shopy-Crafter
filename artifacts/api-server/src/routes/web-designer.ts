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
  getSession, saveSession, listSessions, deleteSession,
} from "../lib/web-designer.js";
import { safeFetch } from "../lib/web-scraper.js";
import { buildDnaFromProject } from "../lib/visme-effects.js";
import { logger } from "../lib/logger.js";
import { saveToVault } from "../lib/vault.js";
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

router.get("/web-designer/sessions", async (_req: Request, res: Response): Promise<void> => {
  try { res.json(await listSessions()); }
  catch (err: any) { logger.error({ err }, "web-designer/sessions"); res.status(500).json({ error: "No se pudieron cargar los diseños" }); }
});

router.get("/web-designer/sessions/:id", async (req: Request, res: Response): Promise<void> => {
  try {
    const s = await getSession(String(req.params.id));
    if (!s) { res.status(404).json({ error: "Diseño no encontrado" }); return; }
    res.json(s);
  } catch (err: any) { logger.error({ err }, "web-designer/session"); res.status(500).json({ error: "Error" }); }
});

router.post("/web-designer/sessions/:id", async (req: Request, res: Response): Promise<void> => {
  try {
    const { title, currentHtml, history, model, projectId } = req.body ?? {};
    res.json(await saveSession({
      id: String(req.params.id),
      ...(typeof title === "string" ? { title } : {}),
      ...(typeof currentHtml === "string" ? { currentHtml } : {}),
      ...(Array.isArray(history) ? { history } : {}),
      ...(typeof model === "string" ? { model } : {}),
      ...(Number.isInteger(Number(projectId)) && Number(projectId) > 0 ? { projectId: Number(projectId) } : {}),
    }));
  } catch (err: any) { logger.error({ err }, "web-designer/save"); res.status(500).json({ error: "No se pudo guardar" }); }
});

router.delete("/web-designer/sessions/:id", async (req: Request, res: Response): Promise<void> => {
  try { await deleteSession(String(req.params.id)); res.json({ ok: true }); }
  catch (err: any) { logger.error({ err }, "web-designer/delete"); res.status(500).json({ error: "No se pudo borrar" }); }
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
    let finish: { truncated: boolean; costUsd: number } = { truncated: false, costUsd: 0 };
    const heartbeat = setInterval(() => {
      try { res.write(": ping\n\n"); } catch {}
    }, 20000);

    try {
      const pid = projectId ? Number(projectId) : null;
      for await (const chunk of streamHtml(prompt, currentHtml, model, history, dna, {
        projectId: pid, onFinish: info => { finish = info; },
      })) {
        fullHtml += chunk;
        res.write(`data: ${JSON.stringify({ chunk })}\n\n`);
      }
      const cleanHtml = stripFences(fullHtml);
      if (!/<html[\s>]/i.test(cleanHtml)) throw new Error("El modelo no devolvió una página HTML. Reformula la petición.");
      const prev = await getSession(sid);
      const history2 = [...(prev?.history ?? []),
        { role: "user", content: prompt },
        { role: "assistant", content: finish.truncated ? "Página generada (cortada por longitud)" : `Página generada (${cleanHtml.length} caracteres)` },
      ];
      await saveSession({ id: sid, currentHtml: cleanHtml, history: history2, model, projectId: pid });

      res.write(`data: ${JSON.stringify({ done: true, html: cleanHtml, sessionId: sid, truncated: finish.truncated, costUsd: Number(finish.costUsd.toFixed(4)) })}\n\n`);
    } finally {
      clearInterval(heartbeat);
      res.end();
    }
  } catch (err: any) {
    logger.error({ err: err?.message }, "web-designer/generate error");
    const message = err?.status === 402 ? err.message : `No se pudo generar la página: ${err?.message ?? "error del proveedor de IA"}`;
    if (!res.headersSent) res.status(err?.status === 402 ? 402 : 500).json({ error: message });
    else { try { res.write(`data: ${JSON.stringify({ error: message })}\n\n`); res.end(); } catch {} }
  }
});

router.post("/web-designer/import-url", async (req: Request, res: Response): Promise<void> => {
  try {
    const { url } = req.body as { url: string };
    if (!url?.trim()) { res.status(400).json({ error: "url is required" }); return; }
    // safeFetch valida DNS y redirecciones: no se puede usar para leer la red interna.
    const resp = await safeFetch(url.trim(), {
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

    const pid = Number(projectId);
    if (!Number.isInteger(pid) || pid < 0) { res.status(400).json({ error: "projectId inválido" }); return; }
    // Antes: INSERT en `vault_files`, tabla que no existe (el botón siempre
    // fallaba). El vault real es project_files vía saveToVault.
    const vaultId = await saveToVault({
      projectId: pid,
      fileType: "html",
      category: "web-designer",
      title: `${pageName} — Web Designer`,
      mimeType: "text/html",
      content: html,
      generatedBy: "web-designer",
      metadata: { sessionId: sessionId ?? null, pageName, chars: html.length },
    });
    if (!vaultId) { res.status(500).json({ error: "No se pudo guardar en la bóveda" }); return; }

    res.json({ success: true, message: `"${pageName}" desplegado a la bóveda`, vaultId });
  } catch (err: any) {
    logger.error({ err }, "web-designer/deploy error");
    res.status(500).json({ error: err.message });
  }
});

export default router;
