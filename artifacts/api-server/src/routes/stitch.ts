/**
 * Google Stitch MCP — Backend Routes
 * ─────────────────────────────────────────────────────────────────────────────
 * Integrates Google Stitch (AI UI/UX generator) into ShopyBrain.
 * Stitch can:
 *   - Generate full HTML/Tailwind UI screens from text prompts
 *   - List and manage design projects
 *   - Download screen images and code
 *   - Iterate on designs rapidly
 *
 * All calls proxy through the Stitch MCP HTTP endpoint with auth injection.
 * Requires: STITCH_API_KEY secret (from stitch.withgoogle.com → Settings → API Keys)
 */

import { Router } from "express";
import { logger } from "../lib/logger.js";

const router = Router();

const STITCH_MCP_URL = "https://stitch.googleapis.com/mcp";

function getStitchKey(): string {
  return process.env.STITCH_API_KEY || process.env.GOOGLE_API_KEY || "";
}

function isStitchAvailable(): boolean {
  return !!getStitchKey();
}

async function callStitchMCP(method: string, params: Record<string, unknown> = {}) {
  const apiKey = getStitchKey();
  if (!apiKey) {
    throw new Error("STITCH_API_KEY not configured. Add it in Secrets from stitch.withgoogle.com.");
  }

  const payload = {
    jsonrpc: "2.0",
    id: Date.now(),
    method,
    params,
  };

  const resp = await fetch(STITCH_MCP_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Goog-Api-Key": apiKey,
    },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(300_000),
  });

  if (!resp.ok) {
    const errText = await resp.text().catch(() => resp.statusText);
    throw new Error(`Stitch MCP HTTP ${resp.status}: ${errText.slice(0, 300)}`);
  }

  const json = await resp.json() as { result?: unknown; error?: { message?: string } };
  if (json.error) {
    throw new Error(`Stitch MCP error: ${json.error.message ?? JSON.stringify(json.error)}`);
  }
  return json.result;
}

async function callStitchTool(toolName: string, toolArgs: Record<string, unknown> = {}) {
  return callStitchMCP("tools/call", { name: toolName, arguments: toolArgs });
}

router.get("/stitch/status", (req, res) => {
  const available = isStitchAvailable();
  res.json({
    available,
    configured: available,
    message: available
      ? "Stitch AI configurado y listo para generar interfaces."
      : "Stitch no configurado. Añade STITCH_API_KEY en Secrets (obtén la clave en stitch.withgoogle.com → Settings → API Keys).",
    endpoint: STITCH_MCP_URL,
  });
});

router.get("/stitch/tools", async (req, res) => {
  try {
    const result = await callStitchMCP("tools/list");
    res.json({ tools: result });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    logger.error({ err: msg }, "Stitch tools/list failed");
    res.status(503).json({ error: msg });
  }
});

router.get("/stitch/projects", async (req, res) => {
  try {
    const result = await callStitchTool("list_projects");
    res.json({ projects: result });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    logger.error({ err: msg }, "Stitch list_projects failed");
    res.status(503).json({ error: msg });
  }
});

router.post("/stitch/projects", async (req, res) => {
  const { name, description } = req.body as { name: string; description?: string };
  if (!name) { res.status(400).json({ error: "name requerido" }); return; }
  try {
    const result = await callStitchTool("create_project", { name, description });
    res.json({ project: result });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    res.status(503).json({ error: msg });
  }
});

router.get("/stitch/projects/:projectId", async (req, res) => {
  try {
    const result = await callStitchTool("get_project", { project_id: req.params.projectId });
    res.json({ project: result });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    res.status(503).json({ error: msg });
  }
});

router.get("/stitch/projects/:projectId/screens", async (req, res) => {
  try {
    const result = await callStitchTool("list_screens", { project_id: req.params.projectId });
    res.json({ screens: result });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    res.status(503).json({ error: msg });
  }
});

router.get("/stitch/projects/:projectId/screens/:screenId", async (req, res) => {
  try {
    const result = await callStitchTool("get_screen", {
      project_id: req.params.projectId,
      screen_id: req.params.screenId,
    });
    res.json({ screen: result });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    res.status(503).json({ error: msg });
  }
});

router.post("/stitch/projects/:projectId/screens/:screenId/edit", async (req, res) => {
  const { prompt } = req.body as { prompt: string };
  if (!prompt) { res.status(400).json({ error: "prompt requerido" }); return; }
  try {
    const result = await callStitchTool("edit_screens", {
      project_id: req.params.projectId,
      screen_ids: [req.params.screenId],
      prompt,
    });
    res.json({ result });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    res.status(503).json({ error: msg });
  }
});

router.post("/stitch/projects/:projectId/screens/:screenId/variants", async (req, res) => {
  const { prompt, count = 3 } = req.body as { prompt?: string; count?: number };
  try {
    const result = await callStitchTool("generate_variants", {
      project_id: req.params.projectId,
      screen_id: req.params.screenId,
      prompt,
      count,
    });
    res.json({ variants: result });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    res.status(503).json({ error: msg });
  }
});

router.get("/stitch/projects/:projectId/design-systems", async (req, res) => {
  try {
    const result = await callStitchTool("list_design_systems", { project_id: req.params.projectId });
    res.json({ designSystems: result });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    res.status(503).json({ error: msg });
  }
});

router.post("/stitch/projects/:projectId/design-systems", async (req, res) => {
  const { name, description, colors, fonts } = req.body as Record<string, unknown>;
  try {
    const result = await callStitchTool("create_design_system", {
      project_id: req.params.projectId, name, description, colors, fonts,
    });
    res.json({ designSystem: result });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    res.status(503).json({ error: msg });
  }
});

router.post("/stitch/generate", async (req, res) => {
  const {
    prompt,
    projectId,
    model = "gemini-2.5-flash",
  } = req.body as {
    prompt: string;
    projectId?: string;
    model?: string;
  };

  if (!prompt || typeof prompt !== "string") {
    res.status(400).json({ error: "prompt requerido" });
    return;
  }
  if (!projectId) {
    res.status(400).json({ error: "projectId requerido. Crea un proyecto primero con POST /stitch/projects" });
    return;
  }

  try {
    const args: Record<string, unknown> = { prompt, project_id: projectId, model };
    const result = await callStitchTool("generate_screen_from_text", args);
    res.json({ result });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    logger.error({ err: msg, prompt: prompt.slice(0, 100) }, "Stitch generate_screen_from_text failed");
    res.status(503).json({ error: msg });
  }
});

router.post("/stitch/generate/shopify-product", async (req, res) => {
  const { product, projectId, style = "modern ecommerce dark" } = req.body as {
    product: { title?: string; description?: string; price?: number; category?: string };
    projectId?: string;
    style?: string;
  };

  if (!product?.title) {
    res.status(400).json({ error: "product.title requerido" });
    return;
  }
  if (!projectId) {
    res.status(400).json({ error: "projectId requerido. Crea un proyecto primero con POST /stitch/projects" });
    return;
  }

  const prompt = [
    `Design a high-converting Shopify product page for "${product.title}".`,
    product.category ? `Category: ${product.category}.` : "",
    product.description ? `Description: ${product.description.slice(0, 200)}.` : "",
    product.price ? `Price: €${product.price}.` : "",
    `Style: ${style}, professional UI, gold accent colors (#C8A84B), mobile-first responsive.`,
    "Include: hero image placeholder, product title, price, CTA button, description, star reviews, related products row.",
    "Use Tailwind CSS CDN. Generate production-ready HTML.",
  ].filter(Boolean).join(" ");

  try {
    const result = await callStitchTool("generate_screen_from_text", {
      prompt,
      project_id: projectId,
      model: "gemini-2.5-pro",
    });
    res.json({ result, prompt });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    logger.error({ err: msg }, "Stitch generate Shopify product page failed");
    res.status(503).json({ error: msg });
  }
});

export default router;
