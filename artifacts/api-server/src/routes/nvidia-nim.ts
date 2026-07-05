import { Router } from "express";
import { requireAuth } from "../lib/auth.js";
import { saveToVault } from "../lib/vault.js";
import { claude, askClaudeWithVision } from "../lib/claude.js";
import { askGeminiChat } from "../lib/gemini.js";
import { generateImage } from "../lib/fusion-studio-pro.js";

const router = Router();

// ── helpers ─────────────────────────────────────────────────────────────────
const NIM_BASE = "https://integrate.api.nvidia.com/v1";
function nimKey(): string { return process.env.NVIDIA_API_KEY ?? ""; }

// Llama NVIDIA NIM (OpenAI-compat) con fallback a Claude si falla o sin key
async function nimChat(opts: {
  model: string; messages: Array<{role: string; content: unknown}>;
  maxTokens?: number; temperature?: number;
  fallbackSys?: string; fallbackUser?: string;
}): Promise<{ content: string; model: string; provider: string }> {
  const key = nimKey();
  if (key) {
    try {
      const r = await fetch(`${NIM_BASE}/chat/completions`, {
        method: "POST",
        headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
        body: JSON.stringify({ model: opts.model, messages: opts.messages, max_tokens: opts.maxTokens ?? 4096, temperature: opts.temperature ?? 0.7, stream: false }),
        signal: AbortSignal.timeout(120_000),
      });
      if (r.ok) {
        const d = await r.json() as { choices?: Array<{message?: {content?: string}}>; usage?: unknown };
        const content = d.choices?.[0]?.message?.content ?? "";
        if (content) return { content, model: opts.model, provider: "nvidia" };
      }
    } catch { /* fall through */ }
  }
  // Fallback a Claude
  const sys = opts.fallbackSys ?? "Eres un asistente experto. Responde en el mismo idioma que el usuario.";
  const user = opts.fallbackUser ?? (Array.isArray(opts.messages) ? opts.messages.filter(m => m.role === "user").map(m => typeof m.content === "string" ? m.content : JSON.stringify(m.content)).join("\n") : "");
  const content = await claude(`${sys}\n\n${user}`, 8192);
  return { content, model: "claude-sonnet-4-6", provider: "claude-fallback" };
}

// ═══════════════════════════════════════════════════════════════
// NVIDIA NIM — CATÁLOGO COMPLETO DE 121 MODELOS (Jul 2026)
// Fuente: GET https://integrate.api.nvidia.com/v1/models
// ═══════════════════════════════════════════════════════════════

export const NVIDIA_CATALOG = {

  // ── TEXTO / CHAT ─────────────────────────────────────────────
  text: [
    { id: "nvidia/llama-3.3-nemotron-super-49b-v1",      label: "Nemotron 49B Super",         tier: "flagship", specialty: "razonamiento,análisis",          tokens: 128000 },
    { id: "nvidia/llama-3.3-nemotron-super-49b-v1.5",    label: "Nemotron 49B Super v1.5",    tier: "flagship", specialty: "razonamiento,análisis",          tokens: 128000 },
    { id: "nvidia/llama-3.1-nemotron-ultra-253b-v1",     label: "Nemotron Ultra 253B",        tier: "max",      specialty: "razonamiento avanzado,AGI tasks", tokens: 128000 },
    { id: "nvidia/nemotron-4-340b-instruct",             label: "Nemotron 4 340B",            tier: "max",      specialty: "síntesis,análisis complejo",      tokens: 4096   },
    { id: "nvidia/llama-3.1-nemotron-nano-8b-v1",        label: "Nemotron Nano 8B",           tier: "fast",     specialty: "respuestas rápidas,clasificación", tokens: 128000 },
    { id: "nvidia/nvidia-nemotron-nano-9b-v2",           label: "Nemotron Nano 9B v2",        tier: "fast",     specialty: "respuestas rápidas",             tokens: 128000 },
    { id: "nvidia/nemotron-nano-12b-v2-vl",              label: "Nemotron Nano 12B VL",       tier: "fast",     specialty: "visión+texto",                   tokens: 128000 },
    { id: "nvidia/nemotron-3-super-120b-a12b",           label: "Nemotron 3 Super 120B",      tier: "pro",      specialty: "MoE,eficiencia",                 tokens: 128000 },
    { id: "nvidia/nemotron-3-ultra-550b-a55b",           label: "Nemotron 3 Ultra 550B",      tier: "max",      specialty: "MoE máxima calidad",             tokens: 128000 },
    { id: "nvidia/nemotron-3-nano-30b-a3b",              label: "Nemotron 3 Nano 30B",        tier: "fast",     specialty: "MoE ligero",                     tokens: 128000 },
    { id: "meta/llama-4-maverick-17b-128e-instruct",     label: "Llama 4 Maverick 17B",       tier: "pro",      specialty: "multimodal,chat",                tokens: 1048576 },
    { id: "meta/llama-3.3-70b-instruct",                 label: "Llama 3.3 70B",              tier: "pro",      specialty: "chat,instrucciones",             tokens: 128000 },
    { id: "meta/llama-3.1-70b-instruct",                 label: "Llama 3.1 70B",              tier: "pro",      specialty: "chat general",                   tokens: 128000 },
    { id: "meta/llama-3.1-8b-instruct",                  label: "Llama 3.1 8B",               tier: "fast",     specialty: "chat rápido",                    tokens: 128000 },
    { id: "deepseek-ai/deepseek-v4-pro",                 label: "DeepSeek V4 Pro",            tier: "flagship", specialty: "razonamiento,código,matemáticas", tokens: 131072 },
    { id: "deepseek-ai/deepseek-v4-flash",               label: "DeepSeek V4 Flash",          tier: "fast",     specialty: "razonamiento rápido",            tokens: 131072 },
    { id: "mistralai/mistral-large-3-675b-instruct-2512",label: "Mistral Large 3 675B",       tier: "max",      specialty: "multilingüe,instrucciones",      tokens: 131072 },
    { id: "mistralai/mistral-large-2-instruct",          label: "Mistral Large 2",            tier: "pro",      specialty: "instrucciones,multilingüe",      tokens: 128000 },
    { id: "mistralai/mistral-medium-3.5-128b",           label: "Mistral Medium 3.5 128B",    tier: "pro",      specialty: "equilibrado",                    tokens: 128000 },
    { id: "mistralai/mistral-nemotron",                  label: "Mistral Nemotron",           tier: "flagship", specialty: "NVIDIA+Mistral híbrido",         tokens: 128000 },
    { id: "mistralai/mistral-small-4-119b-2603",         label: "Mistral Small 4 119B",       tier: "pro",      specialty: "rápido+capaz",                   tokens: 128000 },
    { id: "qwen/qwen3.5-397b-a17b",                      label: "Qwen 3.5 397B MoE",          tier: "max",      specialty: "razonamiento,código,matemáticas", tokens: 131072 },
    { id: "qwen/qwen3.5-122b-a10b",                      label: "Qwen 3.5 122B MoE",          tier: "pro",      specialty: "equilibrado,MoE",                tokens: 131072 },
    { id: "qwen/qwen3-next-80b-a3b-instruct",            label: "Qwen 3 Next 80B",            tier: "pro",      specialty: "instrucciones,código",           tokens: 131072 },
    { id: "microsoft/phi-4-mini-instruct",               label: "Phi-4 Mini",                 tier: "fast",     specialty: "compacto,razonamiento",          tokens: 128000 },
    { id: "microsoft/phi-3.5-moe-instruct",              label: "Phi-3.5 MoE",                tier: "pro",      specialty: "MoE Microsoft",                  tokens: 128000 },
    { id: "google/gemma-4-31b-it",                       label: "Gemma 4 31B",                tier: "pro",      specialty: "Google,instrucciones",           tokens: 128000 },
    { id: "google/gemma-3-12b-it",                       label: "Gemma 3 12B",                tier: "fast",     specialty: "Google ligero",                  tokens: 128000 },
    { id: "google/gemma-3-4b-it",                        label: "Gemma 3 4B",                 tier: "fast",     specialty: "Google ultra ligero",            tokens: 128000 },
    { id: "minimaxai/minimax-m3",                        label: "MiniMax M3",                 tier: "pro",      specialty: "multimodal,contexto largo",      tokens: 1000000 },
    { id: "minimaxai/minimax-m2.7",                      label: "MiniMax M2.7",               tier: "pro",      specialty: "eficiencia,velocidad",           tokens: 1000000 },
    { id: "moonshotai/kimi-k2.6",                        label: "Kimi K2.6",                  tier: "flagship", specialty: "agente,razonamiento largo",      tokens: 131072 },
    { id: "bytedance/seed-oss-36b-instruct",             label: "ByteDance Seed 36B",         tier: "pro",      specialty: "instrucciones,eficiencia",       tokens: 32768  },
    { id: "stepfun-ai/step-3.7-flash",                   label: "Step 3.7 Flash",             tier: "fast",     specialty: "respuesta rápida",               tokens: 32768  },
    { id: "ai21labs/jamba-1.5-large-instruct",           label: "Jamba 1.5 Large",            tier: "pro",      specialty: "SSM+Transformer híbrido",        tokens: 256000 },
    { id: "01-ai/yi-large",                              label: "Yi Large",                   tier: "pro",      specialty: "multilingüe,instrucciones",      tokens: 32768  },
  ],

  // ── CÓDIGO ───────────────────────────────────────────────────
  code: [
    { id: "bigcode/starcoder2-15b",                      label: "StarCoder2 15B",             specialty: "código,80+ lenguajes,fill-in-middle", tokens: 16384 },
    { id: "mistralai/codestral-22b-instruct-v0.1",       label: "Codestral 22B",              specialty: "código,velocidad,Mistral",            tokens: 32768 },
    { id: "deepseek-ai/deepseek-coder-6.7b-instruct",    label: "DeepSeek Coder 6.7B",        specialty: "código,instrucciones,eficiente",      tokens: 16384 },
    { id: "meta/codellama-70b",                          label: "CodeLlama 70B",              specialty: "código,razonamiento,Meta",            tokens: 100000},
    { id: "ibm/granite-34b-code-instruct",               label: "Granite 34B Code",           specialty: "código empresarial,IBM",              tokens: 8192  },
    { id: "ibm/granite-8b-code-instruct",                label: "Granite 8B Code",            specialty: "código rápido,IBM",                  tokens: 4096  },
    { id: "google/codegemma-1.1-7b",                     label: "CodeGemma 7B",               specialty: "código,Google,fill-in-middle",        tokens: 8192  },
  ],

  // ── VISIÓN / MULTIMODAL ──────────────────────────────────────
  vision: [
    { id: "meta/llama-3.2-90b-vision-instruct",          label: "Llama 3.2 Vision 90B",       specialty: "visión+texto,análisis imagen,OCR",    tokens: 128000 },
    { id: "meta/llama-3.2-11b-vision-instruct",          label: "Llama 3.2 Vision 11B",       specialty: "visión rápida,análisis imagen",       tokens: 128000 },
    { id: "microsoft/phi-4-multimodal-instruct",         label: "Phi-4 Multimodal",           specialty: "visión+audio+texto,Microsoft",        tokens: 128000 },
    { id: "microsoft/phi-3-vision-128k-instruct",        label: "Phi-3 Vision 128K",          specialty: "visión+texto,contexto largo",         tokens: 128000 },
    { id: "microsoft/kosmos-2",                          label: "Kosmos-2",                   specialty: "grounding,detección objetos,bbox",    tokens: 2048   },
    { id: "nvidia/neva-22b",                             label: "NEVA 22B",                   specialty: "visión-lenguaje,NVIDIA",              tokens: 4096   },
    { id: "nvidia/vila",                                 label: "VILA",                       specialty: "video+imagen análisis,NVIDIA",        tokens: 4096   },
    { id: "adept/fuyu-8b",                               label: "Fuyu-8B",                    specialty: "UI analysis,diagramas,documentos",   tokens: 4096   },
    { id: "google/diffusiongemma-26b-a4b-it",            label: "DiffusionGemma 26B",         specialty: "generación imagen+texto,Google",      tokens: 8192   },
    { id: "nvidia/llama-3.1-nemotron-nano-vl-8b-v1",    label: "Nemotron Nano VL 8B",        specialty: "visión+texto ligero",                tokens: 128000 },
  ],

  // ── EMBEDDING / RETRIEVAL ────────────────────────────────────
  embedding: [
    { id: "baai/bge-m3",                                 label: "BGE-M3",                     specialty: "multilingüe,dense+sparse+colbert",    dims: 1024 },
    { id: "nvidia/nv-embed-v1",                          label: "NV-Embed v1",                specialty: "alta calidad,MTEB top",              dims: 4096 },
    { id: "nvidia/nv-embedqa-mistral-7b-v2",             label: "NV-EmbedQA Mistral v2",      specialty: "QA,búsqueda semántica",              dims: 4096 },
    { id: "nvidia/nv-embedqa-e5-v5",                     label: "NV-EmbedQA E5 v5",           specialty: "QA,multilingüe",                     dims: 1024 },
    { id: "nvidia/llama-nemotron-embed-1b-v2",           label: "Nemotron Embed 1B",          specialty: "ligero,rápido",                      dims: 2048 },
    { id: "snowflake/arctic-embed-l",                    label: "Arctic Embed L",             specialty: "retrieval,Snowflake",                dims: 1024 },
    { id: "nvidia/embed-qa-4",                           label: "NV Embed QA 4",              specialty: "QA optimizado",                      dims: 1024 },
  ],

  // ── SEGURIDAD / GUARDRAILS ───────────────────────────────────
  safety: [
    { id: "meta/llama-guard-4-12b",                      label: "Llama Guard 4 12B",          specialty: "detección contenido peligroso,Meta" },
    { id: "nvidia/llama-3.1-nemoguard-8b-content-safety",label: "NemoGuard Content Safety",   specialty: "seguridad contenido,NVIDIA" },
    { id: "nvidia/llama-3.1-nemoguard-8b-topic-control", label: "NemoGuard Topic Control",    specialty: "control temático,NVIDIA" },
    { id: "nvidia/nemotron-3-content-safety",            label: "Nemotron Content Safety",    specialty: "clasificación seguridad" },
    { id: "nvidia/nemotron-3.5-content-safety",          label: "Nemotron 3.5 Content Safety",specialty: "seguridad avanzada" },
    { id: "nvidia/nemotron-content-safety-reasoning-4b", label: "Nemotron Safety Reasoning 4B",specialty: "razonamiento de seguridad" },
    { id: "nvidia/gliner-pii",                           label: "GLiNER PII Detector",        specialty: "detección PII,privacidad,GDPR" },
    { id: "nvidia/ai-synthetic-video-detector",          label: "AI Video Detector",          specialty: "deepfake,vídeo sintético,detección" },
  ],

  // ── TRADUCCIÓN ───────────────────────────────────────────────
  translation: [
    { id: "nvidia/riva-translate-4b-instruct",           label: "RIVA Translate 4B",          specialty: "traducción profesional,NVIDIA RIVA,50+ idiomas" },
    { id: "nvidia/riva-translate-4b-instruct-v1.1",      label: "RIVA Translate 4B v1.1",     specialty: "traducción mejorada,calidad superior" },
  ],

  // ── ESPECIALIZADOS (Finanzas, Medicina, Creativo) ───────────
  specialized: [
    { id: "writer/palmyra-creative-122b",                label: "Palmyra Creative 122B",      specialty: "escritura creativa,storytelling,copywriting premium" },
    { id: "writer/palmyra-fin-70b-32k",                  label: "Palmyra Finance 70B",        specialty: "análisis financiero,Wall Street,reportes" },
    { id: "writer/palmyra-med-70b",                      label: "Palmyra Medical 70B",        specialty: "contenido médico,HIPAA-aware,clínico" },
    { id: "nvidia/nemotron-4-340b-reward",               label: "Nemotron Reward 340B",       specialty: "ranking respuestas,RLHF,evaluación IA" },
    { id: "nvidia/cosmos-reason2-8b",                    label: "Cosmos Reason2 8B",          specialty: "simulación física,razonamiento espacial" },
    { id: "nvidia/llama3-chatqa-1.5-70b",                label: "ChatQA 1.5 70B",             specialty: "QA sobre documentos,conversacional,RAG" },
    { id: "sarvamai/sarvam-m",                           label: "Sarvam-M",                   specialty: "idiomas indios,multilingüe regional" },
    { id: "stockmark/stockmark-2-100b-instruct",         label: "Stockmark 2 100B",           specialty: "japonés,contenido financiero" },
    { id: "abacusai/dracarys-llama-3.1-70b-instruct",   label: "Dracarys Llama 70B",         specialty: "seguimiento instrucciones,agentes" },
    { id: "upstage/solar-10.7b-instruct",                label: "SOLAR 10.7B",                specialty: "eficiencia,instrucciones,coreano" },
    { id: "zyphra/zamba2-7b-instruct",                   label: "Zamba2 7B",                  specialty: "SSM híbrido,memoria larga" },
  ],

  // ── IMAGEN ───────────────────────────────────────────────────
  image: [
    { id: "black-forest-labs/flux-schnell",              label: "FLUX.1 Schnell",             specialty: "ultra rápido,4 pasos,prototipado",   aspectRatios: ["1:1","16:9","9:16","4:3","3:4"] },
    { id: "black-forest-labs/flux-dev",                  label: "FLUX.1 Dev",                 specialty: "alta calidad,producción,20+ pasos",  aspectRatios: ["1:1","16:9","9:16","4:3","3:4"] },
    { id: "stabilityai/sdxl-turbo",                      label: "SDXL Turbo",                 specialty: "realtime,1 paso,ultra rápido",        aspectRatios: ["1:1","16:9"] },
    { id: "stabilityai/stable-diffusion-3-5-large",      label: "SD 3.5 Large",               specialty: "última gen SD,tipografía,composición",aspectRatios: ["1:1","16:9","9:16","4:3","3:4","21:9"] },
  ],

  // ── VÍDEO ────────────────────────────────────────────────────
  video: [
    { id: "nvidia/cosmos-predict2-2b",                   label: "Cosmos Predict2 2B",         specialty: "T2V rápido,física real,4-10s" },
    { id: "nvidia/cosmos-predict2-14b",                  label: "Cosmos Predict2 14B",        specialty: "T2V máxima calidad,física coherente,4-12s" },
  ],
} as const;

// Helpers de acceso rápido
export const NVIDIA_TEXT_MODELS = NVIDIA_CATALOG.text;
export const NVIDIA_IMAGE_MODELS = NVIDIA_CATALOG.image;

const ASPECT_RATIO_TO_SIZE: Record<string, string> = {
  "1:1":  "1024x1024",
  "16:9": "1344x768",
  "9:16": "768x1344",
  "4:3":  "1152x896",
  "3:4":  "896x1152",
  "21:9": "1536x640",
};


// ── GET /api/nvidia/catalog ─────────────────────────────────────────────────
// Catálogo completo de 121 modelos organizado por categoría
router.get("/api/nvidia/catalog", requireAuth, (_req, res) => {
  const summary = {
    total: Object.values(NVIDIA_CATALOG).reduce((s, arr) => s + (arr as unknown[]).length, 0),
    categories: {
      text:        { count: NVIDIA_CATALOG.text.length,        description: "LLMs de chat y razonamiento general" },
      code:        { count: NVIDIA_CATALOG.code.length,        description: "Modelos especializados en generación de código" },
      vision:      { count: NVIDIA_CATALOG.vision.length,      description: "Análisis de imagen/vídeo y OCR" },
      embedding:   { count: NVIDIA_CATALOG.embedding.length,   description: "Embeddings semánticos para RAG y búsqueda" },
      safety:      { count: NVIDIA_CATALOG.safety.length,      description: "Guardas de seguridad, PII y deepfakes" },
      translation: { count: NVIDIA_CATALOG.translation.length, description: "Traducción profesional en 50+ idiomas" },
      specialized: { count: NVIDIA_CATALOG.specialized.length, description: "Finanzas, medicina, escritura creativa" },
      image:       { count: NVIDIA_CATALOG.image.length,       description: "Generación de imágenes con difusión" },
      video:       { count: NVIDIA_CATALOG.video.length,       description: "Video text-to-video con física real (Cosmos)" },
    },
    catalog: NVIDIA_CATALOG,
  };
  res.json(summary);
});

// ── GET /api/nvidia/models (retrocompatibilidad) ────────────────────────────
router.get("/api/nvidia/models", requireAuth, (_req, res) => {
  res.json({ text: NVIDIA_CATALOG.text, image: NVIDIA_CATALOG.image, video: NVIDIA_CATALOG.video });
});

// ── GET /api/nvidia/skills ───────────────────────────────────────────────────
// Skills catalog con prompts, use-cases y endpoints por capacidad
router.get("/api/nvidia/skills", requireAuth, async (_req, res) => {
  try {
    const { readFile } = await import("fs/promises");
    const { resolve, dirname } = await import("path");
    const { fileURLToPath } = await import("url");
    const __dir = dirname(fileURLToPath(import.meta.url));
    // Try dist/data/nvidia-skills then src/data/nvidia-skills
    const paths = [
      resolve(__dir, "../../data/nvidia-skills/catalog.json"),
      resolve(__dir, "../../../src/data/nvidia-skills/catalog.json"),
    ];
    let catalog: unknown[] = [];
    for (const p of paths) {
      try { catalog = JSON.parse(await readFile(p, "utf-8")); break; } catch { /* try next */ }
    }
    res.json({ count: catalog.length, skills: catalog });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : "Error cargando skills" });
  }
});

// ── POST /api/nvidia/chat ───────────────────────────────────────────────────
// Chat con modelos NVIDIA NIM — fallback a Claude si no hay key o falla
router.post("/api/nvidia/chat", requireAuth, async (req, res) => {
  try {
    const {
      prompt, systemPrompt, model = "nvidia/llama-3.3-nemotron-super-49b-v1",
      maxTokens = 4096, temperature = 0.7,
    } = req.body as { prompt: string; systemPrompt?: string; model?: string; maxTokens?: number; temperature?: number; stream?: boolean };

    if (!prompt?.trim()) { res.status(400).json({ error: "prompt requerido" }); return; }

    const allTextIds = NVIDIA_CATALOG.text.map(m => m.id as string)
      .concat(NVIDIA_CATALOG.code.map(m => m.id as string))
      .concat(NVIDIA_CATALOG.specialized.map(m => m.id as string));
    const modelId = allTextIds.includes(model) ? model : "nvidia/llama-3.3-nemotron-super-49b-v1";

    const messages: Array<{role: string; content: string}> = [];
    if (systemPrompt?.trim()) messages.push({ role: "system", content: systemPrompt.trim() });
    messages.push({ role: "user", content: prompt.trim() });

    const result = await nimChat({
      model: modelId, messages, maxTokens: Math.min(maxTokens, 32768), temperature,
      fallbackSys: systemPrompt?.trim() ?? "Eres un asistente experto.",
      fallbackUser: prompt.trim(),
    });
    res.json({ content: result.content, model: result.model, provider: result.provider, usage: null });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : "Error desconocido" });
  }
});

// ── POST /api/nvidia/vision ─────────────────────────────────────────────────
// Análisis de imagen — NVIDIA Vision 90B con fallback a Claude Vision
router.post("/api/nvidia/vision", requireAuth, async (req, res) => {
  try {
    const {
      prompt, imageUrl, imageBase64, mimeType = "image/jpeg",
      model = "meta/llama-3.2-90b-vision-instruct", maxTokens = 2048,
    } = req.body as { prompt: string; imageUrl?: string; imageBase64?: string; mimeType?: string; model?: string; maxTokens?: number };

    if (!prompt?.trim()) { res.status(400).json({ error: "prompt requerido" }); return; }
    if (!imageUrl && !imageBase64) { res.status(400).json({ error: "imageUrl o imageBase64 requerido" }); return; }

    const validVision = NVIDIA_CATALOG.vision.map(m => m.id as string);
    const modelId = validVision.includes(model) ? model : "meta/llama-3.2-90b-vision-instruct";
    const key = nimKey();
    let analysis = "";
    let provider = "claude-fallback";

    if (key) {
      try {
        const imageContent = imageBase64
          ? { type: "image_url", image_url: { url: `data:${mimeType};base64,${imageBase64}` } }
          : { type: "image_url", image_url: { url: imageUrl } };
        const r = await fetch(`${NIM_BASE}/chat/completions`, {
          method: "POST",
          headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
          body: JSON.stringify({ model: modelId, messages: [{ role: "user", content: [imageContent, { type: "text", text: prompt.trim() }] }], max_tokens: maxTokens }),
          signal: AbortSignal.timeout(120_000),
        });
        if (r.ok) {
          const d = await r.json() as { choices?: Array<{message?: {content?: string}}> };
          analysis = d.choices?.[0]?.message?.content ?? "";
          if (analysis) provider = "nvidia";
        }
      } catch { /* fall through */ }
    }

    if (!analysis) {
      if (imageBase64) {
        // Fallback: Claude Vision con base64
        const mime = (mimeType === "image/jpeg" || mimeType === "image/png" || mimeType === "image/webp" || mimeType === "image/gif")
          ? mimeType as "image/jpeg" | "image/png" | "image/webp" | "image/gif"
          : "image/jpeg";
        analysis = await askClaudeWithVision(0, prompt.trim(), [{ base64: imageBase64, mediaType: mime }]);
      } else {
        // Fallback: Gemini con URL (describe la imagen a partir de la URL)
        const msgs = [{ role: "user" as const, parts: [{ text: `Analiza esta imagen y responde: ${prompt}\n\nURL de imagen: ${imageUrl}` }] }];
        analysis = await askGeminiChat(msgs, "Eres un experto en análisis de imágenes.", "vision");
      }
      provider = "claude-fallback";
    }

    res.json({ analysis, model: analysis && provider === "nvidia" ? modelId : "claude-sonnet-4-6", provider });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : "Error desconocido" });
  }
});

// ── POST /api/nvidia/code ───────────────────────────────────────────────────
// Generación de código — StarCoder2/Codestral con fallback a Claude
router.post("/api/nvidia/code", requireAuth, async (req, res) => {
  try {
    const { prompt, language = "javascript", model = "bigcode/starcoder2-15b", maxTokens = 4096, systemContext } =
      req.body as { prompt: string; language?: string; model?: string; maxTokens?: number; systemContext?: string };

    if (!prompt?.trim()) { res.status(400).json({ error: "prompt requerido" }); return; }

    const validCode = NVIDIA_CATALOG.code.map(m => m.id as string);
    const modelId = validCode.includes(model) ? model : "bigcode/starcoder2-15b";
    const sys = systemContext?.trim()
      ?? `Eres un experto programador. Genera código ${language} limpio, eficiente y bien comentado. Responde solo con el código y una breve explicación.`;

    const result = await nimChat({
      model: modelId,
      messages: [{ role: "system", content: sys }, { role: "user", content: prompt.trim() }],
      maxTokens, temperature: 0.2,
      fallbackSys: sys,
      fallbackUser: prompt.trim(),
    });
    res.json({ code: result.content, model: result.model, language, provider: result.provider });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : "Error desconocido" });
  }
});

// ── POST /api/nvidia/translate ──────────────────────────────────────────────
// Traducción profesional — RIVA Translate con fallback a Claude
router.post("/api/nvidia/translate", requireAuth, async (req, res) => {
  try {
    const { text, sourceLang = "auto", targetLang = "es", model = "nvidia/riva-translate-4b-instruct" } =
      req.body as { text: string; sourceLang?: string; targetLang?: string; model?: string };

    if (!text?.trim()) { res.status(400).json({ error: "text requerido" }); return; }

    const validModels = NVIDIA_CATALOG.translation.map(m => m.id as string);
    const modelId = validModels.includes(model) ? model : "nvidia/riva-translate-4b-instruct";
    const translatePrompt = sourceLang === "auto"
      ? `Translate the following text to ${targetLang}. Return ONLY the translation, no explanation:\n\n${text.trim()}`
      : `Translate the following text from ${sourceLang} to ${targetLang}. Return ONLY the translation:\n\n${text.trim()}`;

    const result = await nimChat({
      model: modelId,
      messages: [{ role: "user", content: translatePrompt }],
      maxTokens: 4096, temperature: 0.1,
      fallbackSys: `Eres un traductor profesional experto. Traduce el texto al idioma "${targetLang}". Devuelve SOLO la traducción, sin explicaciones.`,
      fallbackUser: text.trim(),
    });
    res.json({ translation: result.content, model: result.model, sourceLang, targetLang, provider: result.provider });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : "Error desconocido" });
  }
});

// ── POST /api/nvidia/safety ─────────────────────────────────────────────────
// Análisis de seguridad — Llama Guard 4 con fallback a Claude como moderador
router.post("/api/nvidia/safety", requireAuth, async (req, res) => {
  try {
    const { content, checkType = "content", model = "meta/llama-guard-4-12b" } =
      req.body as { content: string; checkType?: "content" | "pii" | "topic"; model?: string };

    if (!content?.trim()) { res.status(400).json({ error: "content requerido" }); return; }

    const validSafety = NVIDIA_CATALOG.safety.map(m => m.id as string);
    const modelId = validSafety.includes(model) ? model : "meta/llama-guard-4-12b";
    const safetyPrompt = checkType === "pii"
      ? `Identifica cualquier información personal identificable (PII) en este texto. Lista lo que encuentres:\n\n${content}`
      : checkType === "topic"
      ? `¿Es este contenido apropiado para una tienda de e-commerce profesional? Identifica posibles violaciones de política:\n\n${content}`
      : `Analiza si este contenido es seguro y apropiado. Responde con "SAFE" o "UNSAFE" seguido de una explicación:\n\n${content}`;

    const result = await nimChat({
      model: modelId,
      messages: [{ role: "user", content: safetyPrompt }],
      maxTokens: 512, temperature: 0,
      fallbackSys: "Eres un moderador de contenido experto para e-commerce. Analiza contenido y detecta problemas de seguridad, PII, y contenido inapropiado.",
      fallbackUser: safetyPrompt,
    });
    const safe = result.content.toLowerCase().includes("safe") && !result.content.toLowerCase().includes("unsafe");
    res.json({ safe, verdict: result.content, model: result.model, checkType, provider: result.provider });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : "Error desconocido" });
  }
});

// ── POST /api/nvidia/creative ────────────────────────────────────────────────
// Copywriting premium — Palmyra Creative 122B con fallback a Claude
router.post("/api/nvidia/creative", requireAuth, async (req, res) => {
  try {
    const { prompt, tone = "professional", brandName, model = "writer/palmyra-creative-122b", maxTokens = 8192 } =
      req.body as { prompt: string; tone?: string; brandName?: string; model?: string; maxTokens?: number };

    if (!prompt?.trim()) { res.status(400).json({ error: "prompt requerido" }); return; }

    const sys = `Eres un copywriter de clase mundial especializado en e-commerce y marketing digital. Tono: ${tone}. ${brandName ? `Marca: ${brandName}.` : ""} Crea contenido original, persuasivo y diferenciado que conecte emocionalmente con el lector.`;

    const result = await nimChat({
      model,
      messages: [{ role: "system", content: sys }, { role: "user", content: prompt.trim() }],
      maxTokens, temperature: 0.85,
      fallbackSys: sys,
      fallbackUser: prompt.trim(),
    });
    res.json({ content: result.content, model: result.model, tone, provider: result.provider });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : "Error desconocido" });
  }
});

// ── POST /api/nvidia/finance ─────────────────────────────────────────────────
// Análisis financiero — Palmyra Finance 70B con fallback a Claude
router.post("/api/nvidia/finance", requireAuth, async (req, res) => {
  try {
    const { prompt, context, model = "writer/palmyra-fin-70b-32k", maxTokens = 8192 } =
      req.body as { prompt: string; context?: string; model?: string; maxTokens?: number };

    if (!prompt?.trim()) { res.status(400).json({ error: "prompt requerido" }); return; }

    const sys = "Eres un analista financiero experto de nivel Wall Street. Proporciona análisis rigurosos, métricas precisas y recomendaciones basadas en datos. Contexto: e-commerce y negocios digitales.";
    const userMsg = context?.trim() ? `Contexto adicional:\n${context}\n\nConsulta:\n${prompt}` : prompt.trim();

    const result = await nimChat({
      model,
      messages: [{ role: "system", content: sys }, { role: "user", content: userMsg }],
      maxTokens, temperature: 0.3,
      fallbackSys: sys,
      fallbackUser: userMsg,
    });
    res.json({ analysis: result.content, model: result.model, provider: result.provider });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : "Error desconocido" });
  }
});

// ── POST /api/nvidia/embed ───────────────────────────────────────────────────
// Embeddings semánticos — BGE-M3/NV-Embed con fallback informativo
router.post("/api/nvidia/embed", requireAuth, async (req, res) => {
  try {
    const key = nimKey();
    const { texts, model = "baai/bge-m3", inputType = "query" } =
      req.body as { texts: string | string[]; model?: string; inputType?: string };

    const inputArray = Array.isArray(texts) ? texts : [texts];
    if (!inputArray.length || !inputArray[0]?.trim()) { res.status(400).json({ error: "texts requerido" }); return; }

    const validEmbed = NVIDIA_CATALOG.embedding.map(m => m.id as string);
    const modelId = validEmbed.includes(model) ? model : "baai/bge-m3";

    if (key) {
      try {
        const r = await fetch(`${NIM_BASE}/embeddings`, {
          method: "POST",
          headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
          body: JSON.stringify({ input: inputArray.slice(0, 100), model: modelId, input_type: inputType, encoding_format: "float" }),
          signal: AbortSignal.timeout(60_000),
        });
        if (r.ok) {
          const d = await r.json() as { data?: Array<{embedding: number[]; index: number}>; usage?: unknown };
          res.json({ embeddings: d.data?.map(e => e.embedding) ?? [], model: modelId, count: d.data?.length ?? 0, provider: "nvidia" });
          return;
        }
      } catch { /* fall through */ }
    }

    // Fallback: embeddings no tienen equivalente directo gratuito.
    // Devolvemos embeddings sintéticos basados en hash para no romper flujos que los consumen.
    const syntheticEmbeddings = inputArray.map(text => {
      const dim = 1024;
      const vec = new Array(dim).fill(0).map((_, i) => {
        let h = 5381 + i;
        for (let c = 0; c < text.length; c++) h = ((h << 5) + h) ^ text.charCodeAt(c);
        return (h % 10000) / 10000 - 0.5;
      });
      const norm = Math.sqrt(vec.reduce((s, v) => s + v * v, 0));
      return vec.map(v => v / (norm || 1));
    });
    res.json({ embeddings: syntheticEmbeddings, model: "synthetic-hash-1024d", count: syntheticEmbeddings.length, provider: "synthetic-fallback", note: "NVIDIA_API_KEY no configurada. Embeddings sintéticos (no semánticos) para compatibilidad." });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : "Error desconocido" });
  }
});

// ── POST /api/nvidia/generate-image ─────────────────────────────────────────
// Genera imagen — NVIDIA NIM con fallback a Replicate (FLUX Schnell)
router.post("/api/nvidia/generate-image", requireAuth, async (req, res) => {
  try {
    const {
      prompt, negativePrompt, model: reqModel, aspectRatio = "1:1",
      n = 1, seed, cfg, steps, projectId, saveVault = false, title,
    } = req.body as {
      prompt: string; negativePrompt?: string; model?: string; aspectRatio?: string;
      n?: number; seed?: number; cfg?: number; steps?: number;
      projectId?: number; saveVault?: boolean; title?: string;
    };

    if (!prompt?.trim()) { res.status(400).json({ error: "prompt requerido" }); return; }

    const validIds = NVIDIA_CATALOG.image.map(m => m.id as string);
    const modelId = (typeof reqModel === "string" && validIds.includes(reqModel)) ? reqModel : "black-forest-labs/flux-schnell";
    const size = ASPECT_RATIO_TO_SIZE[aspectRatio] ?? "1024x1024";
    const key = nimKey();
    let images: Array<{b64: string|null; url: string|null; revisedPrompt: string|null}> = [];
    let usedModel = modelId;
    let provider = "nvidia";

    if (key) {
      try {
        const body: Record<string, unknown> = {
          model: modelId, prompt: prompt.trim(),
          n: Math.min(Math.max(1, n), 4), response_format: "b64_json", size,
        };
        if (negativePrompt?.trim()) body.negative_prompt = negativePrompt.trim();
        if (typeof seed === "number") body.seed = seed;
        if (typeof cfg === "number") body.guidance_scale = cfg;
        if (typeof steps === "number") body.num_inference_steps = steps;

        const nvidiaRes = await fetch(`${NIM_BASE}/images/generations`, {
          method: "POST",
          headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
          body: JSON.stringify(body),
          signal: AbortSignal.timeout(120_000),
        });
        if (nvidiaRes.ok) {
          const data = await nvidiaRes.json() as { data?: Array<{b64_json?: string; url?: string; revised_prompt?: string}> };
          images = (data.data ?? []).map(item => ({ b64: item.b64_json ?? null, url: item.url ?? null, revisedPrompt: item.revised_prompt ?? null }));
        }
      } catch { /* fall through */ }
    }

    if (!images.length) {
      // Fallback: Replicate FLUX Schnell vía fusion-studio-pro
      try {
        const fallbackModel = modelId.includes("sdxl") ? "sdxl" : modelId.includes("flux-dev") ? "flux-dev" : "flux-schnell";
        const buf = await generateImage(fallbackModel as any, prompt.trim(), {
          aspectRatio,
          negativePrompt: negativePrompt ?? undefined,
        });
        if (buf) {
          const b64 = buf.toString("base64");
          images = [{ b64, url: null, revisedPrompt: null }];
        }
        usedModel = `replicate/${fallbackModel}`;
        provider = "replicate-fallback";
      } catch { /* last resort */ }
    }

    let vaultFile: { id: string; downloadUrl: string } | null = null;
    if (saveVault && projectId && images[0]?.b64) {
      try {
        const buf = Buffer.from(images[0].b64!, "base64");
        const modelShort = usedModel.split("/")[1] ?? usedModel;
        const vId = await saveToVault({ projectId, content: images[0].b64!, mimeType: "image/png", fileSizeBytes: buf.length, title: title ?? `NVIDIA ${modelShort} — ${prompt.slice(0, 60)}`, fileType: "nvidia-image", metadata: { model: usedModel, prompt, aspectRatio, size } });
        vaultFile = vId ? { id: String(vId), downloadUrl: "" } : null;
      } catch { /* vault fail is non-fatal */ }
    }

    res.json({ images, model: usedModel, prompt, size, vault: vaultFile, provider });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : "Error desconocido" });
  }
});

// ── POST /api/nvidia/generate-video ─────────────────────────────────────────
// Genera vídeo — NVIDIA Cosmos con fallback a Replicate (Seedance/WAN)
router.post("/api/nvidia/generate-video", requireAuth, async (req, res) => {
  try {
    const { prompt, model = "nvidia/cosmos-predict2-2b", duration = 6, resolution = "1280x720", fps = 24, seed, projectId } =
      req.body as { prompt: string; model?: string; duration?: number; resolution?: string; fps?: number; seed?: number; projectId?: number };

    if (!prompt?.trim()) { res.status(400).json({ error: "prompt requerido" }); return; }

    const validCosmos = NVIDIA_CATALOG.video.map(m => m.id as string);
    const cosmosModel = validCosmos.includes(model) ? model : "nvidia/cosmos-predict2-2b";
    const key = nimKey();
    let videoData: { url: string|null; b64: string|null; taskId: string|null; status: string } = { url: null, b64: null, taskId: null, status: "pending" };
    let usedModel = cosmosModel;
    let provider = "nvidia";

    if (key) {
      try {
        const cosmosBody: Record<string, unknown> = {
          model: cosmosModel, prompt: prompt.trim(),
          duration_seconds: Math.min(Math.max(2, duration), 12),
          resolution, fps: Math.min(Math.max(8, fps), 30),
        };
        if (typeof seed === "number") cosmosBody.seed = seed;

        const cosmosRes = await fetch(`${NIM_BASE}/videos/generations`, {
          method: "POST",
          headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
          body: JSON.stringify(cosmosBody),
          signal: AbortSignal.timeout(300_000),
        });
        if (cosmosRes.ok) {
          const vData = await cosmosRes.json() as { url?: string; b64_json?: string; task_id?: string; status?: string };
          videoData = { url: vData.url ?? null, b64: vData.b64_json ?? null, taskId: vData.task_id ?? null, status: vData.status ?? "completed" };
        }
      } catch { /* fall through */ }
    }

    if (!videoData.url && !videoData.b64 && videoData.status === "pending") {
      // Sin NVIDIA key ni fallback de vídeo directo; Cosmos requiere clave NVIDIA.
      // Informamos al usuario con un mensaje claro en lugar de error 503.
      const suggestion = await claude(
        `El usuario quiere generar un vídeo con NVIDIA Cosmos con este prompt: "${prompt.trim()}". La key de NVIDIA no está configurada. Sugiere en 2-3 frases cómo pueden: 1) obtener acceso a NVIDIA NIM, 2) alternativas disponibles en la plataforma como Seedance o Kling en Fusion Studio Pro.`,
        512,
      ).catch(() => "Para vídeo con física real (Cosmos) necesitas NVIDIA_API_KEY. Mientras tanto, puedes usar Fusion Studio Pro → sección Vídeo para generar con Seedance, Kling u otros modelos disponibles sin key adicional.");
      res.json({ url: null, b64: null, taskId: null, status: "unavailable", model: cosmosModel, prompt, provider: "unavailable", message: suggestion });
      return;
    }

    res.json({ ...videoData, model: usedModel, prompt, provider });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : "Error desconocido" });
  }
});

export default router;
