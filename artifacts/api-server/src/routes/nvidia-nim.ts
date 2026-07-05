import { Router } from "express";
import { requireAuth } from "../lib/auth.js";
import { saveToVault } from "../lib/vault.js";

const router = Router();

// ── NVIDIA NIM TEXT MODELS (reference) ───────────────────────────────────────
export const NVIDIA_TEXT_MODELS = [
  { id: "nvidia/llama-3.3-nemotron-super-49b-v1", label: "Nemotron 49B",      tier: "flagship" },
  { id: "meta/llama-3.3-70b-instruct",            label: "Llama 3.3 70B",    tier: "pro"      },
  { id: "meta/llama-3.1-405b-instruct",           label: "Llama 3.1 405B",   tier: "max"      },
  { id: "microsoft/phi-4",                        label: "Phi-4",            tier: "fast"     },
  { id: "qwen/qwen3-235b-a22b",                   label: "Qwen3 235B",       tier: "max"      },
  { id: "mistralai/mistral-large-2-instruct",     label: "Mistral Large 2",  tier: "pro"      },
  { id: "nvidia/mistral-nemo-minitron-8b-8k-instruct", label: "NeMo 8B",     tier: "fast"     },
  { id: "google/gemma-3-27b-it",                  label: "Gemma 3 27B",      tier: "pro"      },
] as const;

// ── NVIDIA NIM IMAGE MODELS ───────────────────────────────────────────────────
export const NVIDIA_IMAGE_MODELS = [
  {
    id: "black-forest-labs/flux-schnell",
    label: "FLUX Schnell",
    description: "Más rápido • 4 pasos • Ideal para prototipos rápidos",
    aspectRatios: ["1:1", "16:9", "9:16", "4:3", "3:4"],
    maxPromptLength: 512,
  },
  {
    id: "black-forest-labs/flux-dev",
    label: "FLUX Dev",
    description: "Alta calidad • 20+ pasos • Mejor para producción",
    aspectRatios: ["1:1", "16:9", "9:16", "4:3", "3:4"],
    maxPromptLength: 512,
  },
  {
    id: "stabilityai/sdxl-turbo",
    label: "SDXL Turbo",
    description: "Realtime diffusion • 1 paso • Ultra rápido",
    aspectRatios: ["1:1", "16:9"],
    maxPromptLength: 256,
  },
  {
    id: "stabilityai/stable-diffusion-3-5-large",
    label: "SD 3.5 Large",
    description: "Última generación SD • Tipografía precisa • Composición perfecta",
    aspectRatios: ["1:1", "16:9", "9:16", "4:3", "3:4", "21:9"],
    maxPromptLength: 1024,
  },
] as const;

type NvidiaImageModelId = typeof NVIDIA_IMAGE_MODELS[number]["id"];

const ASPECT_RATIO_TO_SIZE: Record<string, string> = {
  "1:1":  "1024x1024",
  "16:9": "1344x768",
  "9:16": "768x1344",
  "4:3":  "1152x896",
  "3:4":  "896x1152",
  "21:9": "1536x640",
};

// ── GET /api/nvidia/models ────────────────────────────────────────────────────
router.get("/api/nvidia/models", requireAuth, (_req, res) => {
  res.json({
    text: NVIDIA_TEXT_MODELS,
    image: NVIDIA_IMAGE_MODELS,
  });
});

// ── POST /api/nvidia/generate-image ──────────────────────────────────────────
router.post("/api/nvidia/generate-image", requireAuth, async (req, res) => {
  try {
    const nvidiaKey = process.env.NVIDIA_API_KEY;
    if (!nvidiaKey) {
      res.status(503).json({ error: "NVIDIA_API_KEY no configurada. Añade la clave en Configuración → Secretos del proyecto." });
      return;
    }

    const {
      prompt,
      negativePrompt,
      model: reqModel,
      aspectRatio = "1:1",
      n = 1,
      seed,
      cfg,
      steps,
      projectId,
      saveVault = false,
      title,
    } = req.body as {
      prompt: string;
      negativePrompt?: string;
      model?: string;
      aspectRatio?: string;
      n?: number;
      seed?: number;
      cfg?: number;
      steps?: number;
      projectId?: number;
      saveVault?: boolean;
      title?: string;
    };

    if (!prompt?.trim()) {
      res.status(400).json({ error: "El campo 'prompt' es obligatorio." });
      return;
    }

    const validModelIds = NVIDIA_IMAGE_MODELS.map(m => m.id) as string[];
    const modelId: NvidiaImageModelId = (typeof reqModel === "string" && validModelIds.includes(reqModel))
      ? reqModel as NvidiaImageModelId
      : "black-forest-labs/flux-schnell";

    const size = ASPECT_RATIO_TO_SIZE[aspectRatio] ?? "1024x1024";

    const body: Record<string, unknown> = {
      model: modelId,
      prompt: prompt.trim(),
      n: Math.min(Math.max(1, n), 4),
      response_format: "b64_json",
      size,
    };
    if (negativePrompt?.trim()) body.negative_prompt = negativePrompt.trim();
    if (typeof seed === "number") body.seed = seed;
    if (typeof cfg === "number") body.guidance_scale = cfg;
    if (typeof steps === "number") body.num_inference_steps = steps;

    const nvidiaRes = await fetch("https://integrate.api.nvidia.com/v1/images/generations", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${nvidiaKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(120_000),
    });

    if (!nvidiaRes.ok) {
      const errText = await nvidiaRes.text().catch(() => "");
      const parsed = (() => { try { return JSON.parse(errText); } catch { return null; } })();
      const msg = parsed?.detail ?? parsed?.message ?? parsed?.error ?? errText.slice(0, 300);
      res.status(nvidiaRes.status).json({ error: `NVIDIA NIM: ${msg}` });
      return;
    }

    const data = await nvidiaRes.json() as {
      data?: Array<{ b64_json?: string; url?: string; revised_prompt?: string }>;
    };

    const images = (data.data ?? []).map(item => ({
      b64: item.b64_json ?? null,
      url: item.url ?? null,
      revisedPrompt: item.revised_prompt ?? null,
    }));

    // Optionally save first image to vault
    let vaultFile: { id: string; downloadUrl: string } | null = null;
    if (saveVault && projectId && images[0]?.b64) {
      try {
        const buf = Buffer.from(images[0].b64, "base64");
        const modelShort = modelId.split("/")[1] ?? modelId;
        const vId = await saveToVault({
          projectId,
          content: images[0].b64,
          mimeType: "image/png",
          fileSizeBytes: buf.length,
          title: title ?? `NVIDIA ${modelShort} — ${prompt.slice(0, 60)}`,
          fileType: "nvidia-image",
          metadata: { model: modelId, prompt, aspectRatio, size },
        });
        vaultFile = vId ? { id: String(vId), downloadUrl: "" } : null;
      } catch (e) {
        console.warn("nvidia-nim: vault save failed", e);
      }
    }

    res.json({
      images,
      model: modelId,
      prompt,
      size,
      vault: vaultFile,
    });

  } catch (err) {
    const msg = err instanceof Error ? err.message : "Error desconocido";
    console.error("nvidia-nim generate-image error:", err);
    res.status(500).json({ error: msg });
  }
});

// ── POST /api/nvidia/generate-video — NVIDIA Cosmos T2V ──────────────────────
// Cosmos is available via the AI Catalog Inference endpoint.
// Currently accessed through the legacy NVCF gateway; expose as SSE progress.
router.post("/api/nvidia/generate-video", requireAuth, async (req, res) => {
  try {
    const nvidiaKey = process.env.NVIDIA_API_KEY;
    if (!nvidiaKey) {
      res.status(503).json({ error: "NVIDIA_API_KEY no configurada." });
      return;
    }

    const {
      prompt,
      model = "nvidia/cosmos-predict2-2b",
      duration = 6,
      resolution = "1280x720",
      fps = 24,
      seed,
    } = req.body as {
      prompt: string;
      model?: string;
      duration?: number;
      resolution?: string;
      fps?: number;
      seed?: number;
    };

    if (!prompt?.trim()) {
      res.status(400).json({ error: "El campo 'prompt' es obligatorio." });
      return;
    }

    const VALID_COSMOS = [
      "nvidia/cosmos-predict2-2b",
      "nvidia/cosmos-predict2-14b",
    ];
    const cosmosModel = VALID_COSMOS.includes(model) ? model : "nvidia/cosmos-predict2-2b";

    const cosmosBody: Record<string, unknown> = {
      model: cosmosModel,
      prompt: prompt.trim(),
      duration_seconds: Math.min(Math.max(2, duration), 12),
      resolution,
      fps: Math.min(Math.max(8, fps), 30),
    };
    if (typeof seed === "number") cosmosBody.seed = seed;

    const cosmosRes = await fetch("https://integrate.api.nvidia.com/v1/videos/generations", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${nvidiaKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(cosmosBody),
      signal: AbortSignal.timeout(300_000),
    });

    if (!cosmosRes.ok) {
      const errText = await cosmosRes.text().catch(() => "");
      const parsed = (() => { try { return JSON.parse(errText); } catch { return null; } })();
      const msg = parsed?.detail ?? parsed?.message ?? parsed?.error ?? errText.slice(0, 300);
      res.status(cosmosRes.status).json({ error: `NVIDIA Cosmos: ${msg}` });
      return;
    }

    const vData = await cosmosRes.json() as {
      url?: string;
      b64_json?: string;
      task_id?: string;
      status?: string;
    };

    res.json({
      url: vData.url ?? null,
      b64: vData.b64_json ?? null,
      taskId: vData.task_id ?? null,
      status: vData.status ?? "completed",
      model: cosmosModel,
      prompt,
    });

  } catch (err) {
    const msg = err instanceof Error ? err.message : "Error desconocido";
    console.error("nvidia-nim generate-video error:", err);
    res.status(500).json({ error: msg });
  }
});

export default router;
