import { Router } from "express";
import {
  PLUGINS_CATALOG, PLUGIN_CATEGORIES,
  getPluginById, getPluginsByCategory, searchPlugins,
  getNewPlugins,
} from "../lib/plugins-catalog.js";
import { askAMR, streamAMR } from "../lib/amr.js";

const router = Router();

// GET /api/plugins — list all plugins
router.get("/plugins", (req, res) => {
  const { q, category, premium, action, isNew } = req.query as Record<string, string>;

  let plugins = q ? searchPlugins(q) : [...PLUGINS_CATALOG];
  if (category) plugins = plugins.filter(p => p.category === category);
  if (premium === "true")  plugins = plugins.filter(p => p.isPremium);
  if (premium === "false") plugins = plugins.filter(p => !p.isPremium);
  if (action)   plugins = plugins.filter(p => p.action === action);
  if (isNew === "true") plugins = plugins.filter(p => p.isNew);

  res.json({
    plugins,
    total: plugins.length,
    categories: PLUGIN_CATEGORIES,
    newCount: getNewPlugins().length,
  });
});

// GET /api/plugins/categories — list categories with counts
router.get("/plugins/categories", (_req, res) => {
  res.json({ categories: PLUGIN_CATEGORIES });
});

// GET /api/plugins/new — newly added plugins
router.get("/plugins/new", (_req, res) => {
  res.json({ plugins: getNewPlugins() });
});

// GET /api/plugins/:id — get a single plugin
router.get("/plugins/:id", (req, res) => {
  const plugin = getPluginById(req.params.id);
  if (!plugin) { res.status(404).json({ error: "Plugin no encontrado" }); return; }
  res.json(plugin);
});

// GET /api/plugins/by-category/:category
router.get("/plugins/by-category/:category", (req, res) => {
  const plugins = getPluginsByCategory(req.params.category);
  res.json({ plugins, category: req.params.category });
});

// POST /api/plugins/:id/execute — execute a plugin
router.post("/plugins/:id/execute", async (req, res) => {
  const plugin = getPluginById(req.params.id);
  if (!plugin) { res.status(404).json({ error: "Plugin no encontrado" }); return; }

  const { context, modelId, brandDna } = req.body as {
    context?: Record<string, string>;
    modelId?: string;
    brandDna?: Record<string, string>;
  };

  // Build prompt from plugin template or description
  const vars = { ...brandDna, ...context };
  let prompt = plugin.promptTemplate ?? "";
  if (!prompt) {
    prompt = `Ejecuta la siguiente tarea como experto en ${plugin.category}:\n\n${plugin.description}\n\nContexto del negocio: ${JSON.stringify(vars)}`;
  } else {
    for (const [key, value] of Object.entries(vars)) {
      prompt = prompt.replaceAll(`{{${key}}}`, String(value));
    }
  }

  const model = modelId ?? "claude-sonnet";

  // Streaming
  if (req.headers.accept?.includes("text/event-stream")) {
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    await streamAMR(
      [{ role: "system", content: `Eres un experto en ${plugin.category}. Sé directo y genera contenido de alta calidad.` },
       { role: "user", content: prompt }],
      model, res
    );
    return;
  }

  try {
    const output = await askAMR(
      [{ role: "system", content: `Eres un experto en ${plugin.category}. Sé directo y genera contenido de alta calidad.` },
       { role: "user", content: prompt }],
      model,
      { maxTokens: 3000 }
    );

    res.json({ output, plugin: { id: plugin.id, name: plugin.name, category: plugin.category }, model });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: msg });
  }
});

// POST /api/plugins/suggest — AI suggests relevant plugins for a brand
router.post("/plugins/suggest", async (req, res) => {
  const { sector, goals, currentTools } = req.body as {
    sector?: string;
    goals?: string[];
    currentTools?: string[];
  };

  // Simple heuristic-based suggestion (no AI needed)
  const goalKeywords: Record<string, string[]> = {
    "aumentar conversión": ["commerce-pdp-optimizer", "commerce-checkout-opt", "analytics-cro-audit", "design-cta-section"],
    "seo": ["seo-title-gen", "seo-meta-gen", "seo-schema-product", "seo-schema-faq", "seo-keyword-cluster"],
    "email": ["email-welcome", "email-abandoned-cart", "email-subject-lines", "int-klaviyo"],
    "social media": ["social-ig-pack", "social-tiktok-scripts", "social-twitter-thread", "social-hashtag"],
    "analytics": ["analytics-kpi-dash", "analytics-ga4-events", "analytics-funnel", "analytics-ab-test"],
    "automatización": ["auto-order-webhook", "auto-email-trigger", "int-zapier", "auto-low-stock"],
  };

  const suggested = new Set<string>();
  for (const goal of goals ?? []) {
    for (const [key, ids] of Object.entries(goalKeywords)) {
      if (goal.toLowerCase().includes(key.toLowerCase())) {
        ids.forEach(id => suggested.add(id));
      }
    }
  }

  // Also add by sector
  if (sector?.toLowerCase().includes("moda") || sector?.toLowerCase().includes("fashion")) {
    ["commerce-bundles", "social-ig-pack", "content-size-guide", "seo-schema-product"].forEach(id => suggested.add(id));
  }
  if (sector?.toLowerCase().includes("restaurante") || sector?.toLowerCase().includes("food")) {
    ["seo-schema-local", "int-google-analytics", "social-ig-pack", "content-seasonal"].forEach(id => suggested.add(id));
  }

  const pluginIds = Array.from(suggested).slice(0, 12);
  const plugins = pluginIds.map(id => getPluginById(id)).filter(Boolean);

  res.json({ plugins, count: plugins.length });
});

export default router;
