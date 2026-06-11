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
    const result = await callStitchTool("stitch.list_projects");
    res.json({ projects: result });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    logger.error({ err: msg }, "Stitch list_projects failed");
    res.status(503).json({ error: msg });
  }
});

router.get("/stitch/projects/:projectId", async (req, res) => {
  try {
    const result = await callStitchTool("stitch.get_project", { project_id: req.params.projectId });
    res.json({ project: result });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    res.status(503).json({ error: msg });
  }
});

router.get("/stitch/projects/:projectId/screens", async (req, res) => {
  try {
    const result = await callStitchTool("stitch.get_screens", { project_id: req.params.projectId });
    res.json({ screens: result });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    res.status(503).json({ error: msg });
  }
});

router.get("/stitch/projects/:projectId/screens/:screenId/html", async (req, res) => {
  try {
    const result = await callStitchTool("stitch.download_asset", {
      project_id: req.params.projectId,
      screen_id: req.params.screenId,
      asset_type: "html",
    });
    res.json({ html: result });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    res.status(503).json({ error: msg });
  }
});

router.get("/stitch/projects/:projectId/screens/:screenId/image", async (req, res) => {
  try {
    const result = await callStitchTool("stitch.download_asset", {
      project_id: req.params.projectId,
      screen_id: req.params.screenId,
      asset_type: "image",
    });
    res.json({ image: result });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    res.status(503).json({ error: msg });
  }
});

router.post("/stitch/generate", async (req, res) => {
  const {
    prompt,
    projectId,
    projectName,
    model = "gemini-3-flash",
    imageUrl,
  } = req.body as {
    prompt: string;
    projectId?: string;
    projectName?: string;
    model?: string;
    imageUrl?: string;
  };

  if (!prompt || typeof prompt !== "string") {
    res.status(400).json({ error: "prompt requerido" });
    return;
  }

  try {
    const args: Record<string, unknown> = { prompt, model };
    if (projectId) args.project_id = projectId;
    if (projectName) args.project_name = projectName;
    if (imageUrl) args.image_url = imageUrl;

    const result = await callStitchTool("stitch.generate_screen", args);
    res.json({ result });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    logger.error({ err: msg, prompt: prompt.slice(0, 100) }, "Stitch generate_screen failed");
    res.status(503).json({ error: msg });
  }
});

router.post("/stitch/generate/shopify-product", async (req, res) => {
  const { product, projectId, style = "modern ecommerce" } = req.body as {
    product: { title?: string; description?: string; price?: number; category?: string };
    projectId?: string;
    style?: string;
  };

  if (!product?.title) {
    res.status(400).json({ error: "product.title requerido" });
    return;
  }

  const prompt = [
    `Design a high-converting Shopify product page for "${product.title}".`,
    product.category ? `Category: ${product.category}.` : "",
    product.description ? `Description: ${product.description.slice(0, 200)}.` : "",
    product.price ? `Price: €${product.price}.` : "",
    `Style: ${style}, dark professional UI, gold accent colors (#C8A84B), mobile-responsive.`,
    "Include: hero image, product title, price, CTA button, description, reviews section.",
    "Use Tailwind CSS. Generate production-ready HTML.",
  ].filter(Boolean).join(" ");

  try {
    const args: Record<string, unknown> = { prompt, model: "gemini-3-pro" };
    if (projectId) args.project_id = projectId;

    const result = await callStitchTool("stitch.generate_screen", args);
    res.json({ result, prompt });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    logger.error({ err: msg }, "Stitch generate Shopify product page failed");
    res.status(503).json({ error: msg });
  }
});

export default router;
