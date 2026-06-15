import { Router } from "express";
import { AMR_MODELS, askAMR, streamAMR, getAvailableModels, buildMessages, getModelById } from "../lib/amr.js";

const router = Router();

// GET /api/amr/models — list all models with availability
router.get("/amr/models", (_req, res) => {
  const available = getAvailableModels().map(m => m.id);
  res.json({
    models: AMR_MODELS.map(m => ({
      ...m,
      isAvailable: available.includes(m.id),
    })),
    availableCount: available.length,
    totalCount: AMR_MODELS.length,
  });
});

// POST /api/amr/generate — non-streaming generation
router.post("/amr/generate", async (req, res) => {
  const { modelId, system, prompt, messages, maxTokens } = req.body as {
    modelId?: string;
    system?: string;
    prompt?: string;
    messages?: Array<{ role: string; content: string }>;
    maxTokens?: number;
  };

  if (!modelId) { res.status(400).json({ error: "modelId requerido" }); return; }

  const model = getModelById(modelId);
  if (!model) { res.status(404).json({ error: `Modelo '${modelId}' no encontrado` }); return; }

  const msgs = messages ?? (system && prompt
    ? buildMessages(system, prompt)
    : prompt
      ? [{ role: "user", content: prompt }]
      : []);

  if (!msgs.length) { res.status(400).json({ error: "Se requiere prompt o messages" }); return; }

  try {
    const text = await askAMR(msgs, modelId, { maxTokens: maxTokens ?? 4096 });
    res.json({ text, model: model.name, provider: model.provider });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: msg });
  }
});

// POST /api/amr/stream — SSE streaming generation
router.post("/amr/stream", async (req, res) => {
  const { modelId, system, prompt, messages } = req.body as {
    modelId?: string;
    system?: string;
    prompt?: string;
    messages?: Array<{ role: string; content: string }>;
  };

  if (!modelId) {
    res.setHeader("Content-Type", "text/event-stream");
    res.write(`data: ${JSON.stringify({ error: "modelId requerido" })}\n\n`);
    res.end();
    return;
  }

  const msgs = messages ?? (system && prompt
    ? buildMessages(system, prompt)
    : prompt
      ? [{ role: "user", content: prompt }]
      : []);

  if (!msgs.length) {
    res.setHeader("Content-Type", "text/event-stream");
    res.write(`data: ${JSON.stringify({ error: "Se requiere prompt o messages" })}\n\n`);
    res.end();
    return;
  }

  await streamAMR(msgs, modelId, res);
});

// POST /api/amr/compare — run same prompt across multiple models
router.post("/amr/compare", async (req, res) => {
  const { modelIds, system, prompt } = req.body as {
    modelIds: string[];
    system?: string;
    prompt: string;
  };

  if (!Array.isArray(modelIds) || !modelIds.length) {
    res.status(400).json({ error: "modelIds array requerido" }); return;
  }
  if (!prompt) { res.status(400).json({ error: "prompt requerido" }); return; }

  const msgs = buildMessages(system ?? "You are a helpful assistant.", prompt);

  const results = await Promise.allSettled(
    modelIds.slice(0, 5).map(async (id) => {
      const text = await askAMR(msgs, id, { maxTokens: 2048 });
      const model = getModelById(id);
      return { modelId: id, modelName: model?.name ?? id, text };
    })
  );

  res.json({
    prompt,
    results: results.map((r, i) =>
      r.status === "fulfilled"
        ? r.value
        : { modelId: modelIds[i], error: r.reason?.message ?? "Error desconocido" }
    ),
  });
});

export default router;
