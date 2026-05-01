/**
 * CINEMATIC DIRECTOR
 * ─────────────────────────────────────────────────────────────────────────────
 * Replaces the simple per-scene script generator with a director-level
 * orchestrator that:
 *   1. Plans a NARRATIVE ARC matching the requested duration (acts/chapters)
 *   2. Distributes scenes across acts with continuity rules
 *   3. Builds prompts that anchor character + product identity in EVERY scene
 *   4. Supports compositionMode:
 *        - "narrative":         Cinematographic, camera and scene shift freely
 *        - "explainer-locked":  Subject anchored center-frame, ONLY the
 *                               background composition shifts (e.g. product
 *                               deconstructs into a blueprint behind the host)
 *        - "composite-pro":     Generates two layers per scene (host neutral
 *                               background + dynamic background) for FFmpeg
 *                               chroma-key composition (handled in compose
 *                               step, this director only marks the intent)
 *   5. Voiceover lines telling ONE coherent story (not 30 disjointed sentences)
 *
 * Output is a CinematicScript compatible with the existing pipeline so we
 * can drop it in without breaking the renderer.
 */

import { askClaudeJson } from "./claude.js";
import { logger } from "./logger.js";
import type { ProductDNA } from "./product-dna.js";
import type {
  CinematicScript,
  CinematicScene,
  CinematicAspect,
  CinematicStyle,
} from "./cinematic-multishot.js";

export type CompositionMode = "narrative" | "explainer-locked" | "composite-pro";

export interface DirectorRequest {
  projectId: number;
  productName: string;
  brand: string;
  niche?: string;
  audience?: string;
  language: string;
  totalDurationSec: number;
  scenesCount: number;
  sceneDurations: number[];
  aspect: CinematicAspect;
  style: CinematicStyle;
  customBrief?: string;
  compositionMode: CompositionMode;
  productDNA: ProductDNA;
  /** Optional: locked character (their identity block from character-loader). */
  character?: {
    name: string;
    identityPrompt: string;
  };
  ctaText?: string;
}

const DIRECTOR_SYSTEM = `Eres un DIRECTOR DE CINE Y SHOWRUNNER profesional, con experiencia en spots largos (1-20 min) de marcas premium (Apple, Tesla, Nike, A24, Riot Games, Netflix). Tu trabajo es planificar y guionizar anuncios LARGOS multi-shot que se renderizarán como ${"X"} clips concatenados. Reglas innegociables:
1. UN SOLO arco narrativo coherente del minuto 0 al final (no escenas sueltas).
2. CONTINUIDAD ESTRICTA escena a escena: pose, iluminación, paleta, ambientación, posición del producto.
3. PRESERVAR identidad del personaje y del producto en TODAS las escenas — usas el bloque de identidad textual sin desviarte.
4. Las voiceoverLine encadenan UN discurso fluido que un humano podría leer del tirón.
5. Devuelves SIEMPRE JSON válido, sin Markdown ni texto extra.`;

const ACT_TEMPLATES: Record<string, Array<{ name: string; pct: number; intent: string }>> = {
  // ≤90s: 3 actos clásicos
  short: [
    { name: "hook", pct: 0.15, intent: "Apertura impactante. Curiosity hook. Presenta promesa visual." },
    { name: "demo", pct: 0.65, intent: "Desarrollo. Producto en acción, beneficios reales, prueba social." },
    { name: "cta", pct: 0.20, intent: "Cierre con llamada a la acción y reveal final del producto/marca." },
  ],
  // 90-300s: 5 capítulos
  medium: [
    { name: "hook", pct: 0.10, intent: "Hook: pregunta o problema universal en 5-15s." },
    { name: "problem", pct: 0.20, intent: "Problema profundizado: por qué el espectador necesita esto." },
    { name: "demo", pct: 0.40, intent: "Demo extensa del producto: features, materiales, momentos de uso real." },
    { name: "proof", pct: 0.20, intent: "Prueba social, beneficios emocionales, transformación." },
    { name: "cta", pct: 0.10, intent: "CTA potente con reveal final + brand mark." },
  ],
  // >300s: 8 capítulos para explainers/discursos largos
  long: [
    { name: "cold-open", pct: 0.06, intent: "Cold open visual fuerte, 5-15s, frase memorable." },
    { name: "hook", pct: 0.08, intent: "Plantea la promesa central del vídeo." },
    { name: "context", pct: 0.12, intent: "Contexto: por qué esto importa, mercado/usuario/problema." },
    { name: "deep-demo", pct: 0.30, intent: "Demostración profunda: deconstrucción del producto, capas, materiales, exploded view." },
    { name: "story", pct: 0.18, intent: "Storytelling: usuarios reales, casos, transformación con el producto." },
    { name: "comparison", pct: 0.10, intent: "Comparación con alternativas o paradigma anterior." },
    { name: "vision", pct: 0.10, intent: "Visión de marca: para qué existe, hacia dónde va." },
    { name: "cta", pct: 0.06, intent: "CTA final + reveal de marca + tagline." },
  ],
};

function pickActs(totalSec: number) {
  if (totalSec <= 90) return ACT_TEMPLATES.short;
  if (totalSec <= 300) return ACT_TEMPLATES.medium;
  return ACT_TEMPLATES.long;
}

interface ScenePlan {
  idx: number;
  act: string;
  actIntent: string;
  startSec: number;
  endSec: number;
  durationSec: number;
}

/**
 * Distribute the N scenes across the chosen narrative arc proportionally to
 * each act's pct. Each act gets at least 1 scene if pct > 0.
 */
function planScenesAcrossActs(req: DirectorRequest): ScenePlan[] {
  const acts = pickActs(req.totalDurationSec);
  // First pass: compute scenes per act by pct, with min 1 each (only if scenesCount allows).
  const minPerAct = req.scenesCount >= acts.length ? 1 : 0;
  const targetByAct = acts.map((a) => Math.max(minPerAct, Math.round(a.pct * req.scenesCount)));
  // Adjust to hit exactly scenesCount total.
  let sum = targetByAct.reduce((s, n) => s + n, 0);
  // Shrink: only decrement if a slot is actually decremented (avoid infinite loop / over-shrink).
  while (sum > req.scenesCount) {
    const i = targetByAct.indexOf(Math.max(...targetByAct));
    if (targetByAct[i] > minPerAct) {
      targetByAct[i]--;
      sum--;
    } else {
      // All acts already at floor; cannot shrink further → break to avoid infinite loop.
      break;
    }
  }
  while (sum < req.scenesCount) {
    let bestIdx = 0;
    let bestPct = -Infinity;
    for (let i = 0; i < acts.length; i++) if (acts[i].pct > bestPct) { bestPct = acts[i].pct; bestIdx = i; }
    targetByAct[bestIdx]++;
    sum++;
  }

  const plan: ScenePlan[] = [];
  let sceneIdx = 0;
  let cumulSec = 0;
  for (let a = 0; a < acts.length; a++) {
    const act = acts[a];
    for (let s = 0; s < targetByAct[a]; s++) {
      const dur = req.sceneDurations[sceneIdx] ?? 5;
      plan.push({
        idx: sceneIdx + 1,
        act: act.name,
        actIntent: act.intent,
        startSec: cumulSec,
        endSec: cumulSec + dur,
        durationSec: dur,
      });
      cumulSec += dur;
      sceneIdx++;
    }
  }
  return plan;
}

const COMPOSITION_DIRECTIVES: Record<CompositionMode, string> = {
  "narrative": "Estilo narrativo libre: la cámara y la escena cambian con cada plano, pero la identidad del personaje y del producto se preserva en cada escena (usa el bloque de identidad).",
  "explainer-locked": "MUY IMPORTANTE: el personaje (host/presenter) DEBE permanecer ANCLADO en la composición — misma posición, misma pose general, mirando a cámara o al producto. SOLO el FONDO y los ELEMENTOS DETRÁS del personaje cambian dinámicamente entre escenas (deconstrucciones, infografías, exploded views, partículas, transiciones gráficas). El personaje nunca desaparece. Cuando el guion muestra deconstrucción del producto: el host queda fijo en primer plano, y el producto deconstruido orbita/flota en el plano de fondo con etiquetas blueprint estilo Apple Product Page.",
  "composite-pro": "El personaje se renderiza en una capa separada con fondo NEUTRO PLANO (chroma-key compatible: cyclorama gris medio sin sombras duras, o fondo verde croma puro #00B140). En 'sceneDescription' incluye DOS sub-bloques: [FOREGROUND]: descripción del host con fondo croma; [BACKGROUND]: descripción independiente del fondo dinámico (deconstrucciones, escenarios). El renderer compondrá ambas capas en post.",
};

/** Builds the master prompt for Claude that returns the full script. */
function buildDirectorPrompt(req: DirectorRequest, plan: ScenePlan[]): string {
  const acts = pickActs(req.totalDurationSec);
  const actSummary = acts.map((a) => `- ${a.name}: ${(a.pct * 100).toFixed(0)}% — ${a.intent}`).join("\n");
  const sceneTimings = plan.map((s) => `Escena ${s.idx} [${s.act}]: ${s.startSec}s → ${s.endSec}s (${s.durationSec}s) — ${s.actIntent}`).join("\n");
  const styleHint = req.style.toUpperCase();
  const compositionDirective = COMPOSITION_DIRECTIVES[req.compositionMode];

  const characterBlock = req.character
    ? `\nCHARACTER LOCK ACTIVADO — el personaje "${req.character.name}" aparece en TODAS las escenas con humanos. NUNCA cambia. Bloque de identidad textual:\n${req.character.identityPrompt}\n`
    : "";

  const productDNA = req.productDNA;
  const productBlock = `
PRODUCT DNA (NUNCA inventes nada que no esté aquí, usa este bloque LITERALMENTE):
${productDNA.identityLockBlock}

Materiales reales: ${productDNA.materials.map((m) => `${m.name}@${m.location}`).join("; ") || "—"}
Capas para deconstrucción/exploded view: ${productDNA.deconstructionPoints.map((d) => `${d.layer}: ${d.explanation}`).join(" | ") || "—"}
Texto visible en producto (preserva ORTOGRAFÍA exacta): ${productDNA.branding.visibleText.join('", "') || "—"}
`;

  return `Diseña el GUION DIRECTORIAL completo de un anuncio largo de ${req.totalDurationSec} segundos (${(req.totalDurationSec / 60).toFixed(1)} min) para "${productDNA.productName}" de la marca "${req.brand}".

ARCO NARRATIVO (${acts.length} actos):
${actSummary}

DISTRIBUCIÓN DE ESCENAS POR ACTO (respeta exactamente el orden y los timings):
${sceneTimings}

BRIEF:
- Nicho: ${req.niche || "ecommerce premium"}
- Audiencia: ${req.audience || `consumidores hispanohablantes (${req.language})`}
- Idioma del voiceover: ${req.language}
- Estilo visual: ${styleHint}
- Aspecto: ${req.aspect}
- CTA específica: ${req.ctaText || "—"}
- Brief adicional: ${req.customBrief || "—"}
- Modo composición: ${req.compositionMode.toUpperCase()}
${compositionDirective}
${characterBlock}
${productBlock}

REGLAS DE CONTINUIDAD (críticas):
- Cada escena hereda paleta, iluminación e intención del acto anterior. NO saltos arbitrarios.
- El personaje mantiene su identidad EXACTA (ver Character Lock arriba).
- El producto mantiene su identidad EXACTA (ver Product DNA arriba).
- El "voiceoverLine" de cada escena CONTINÚA la frase de la escena anterior — leído en orden, suena como UN discurso humano fluido. Debe sumar ~${Math.round(req.totalDurationSec * 2.5)} palabras totales.
- En el modo "explainer-locked": el HOST está siempre en primer plano y nunca se mueve significativamente; las transiciones entre escenas se notan SOLO en el fondo.
- En el modo "composite-pro": cada sceneDescription tiene formato "[FOREGROUND] ... [BACKGROUND] ..." con dos descripciones independientes.

Devuelve este JSON exacto:
{
  "title": "Título corto del anuncio (≤80 chars)",
  "hook": "Frase del primer hook en ${req.language}",
  "cta": "Frase CTA final en ${req.language}",
  "closingLine": "Tagline final con marca",
  "narrativeArc": [
    ${acts.map((a) => `{ "act": "${a.name}", "intent": "${a.intent.replace(/"/g, "'")}", "scenes": [/*ids*/] }`).join(",\n    ")}
  ],
  "scenes": [
    /* EXACTAMENTE ${plan.length} objetos en este orden (idx 1..${plan.length}). Para CADA objeto sigue ESTE shape (no lo repito por escena para ahorrar tokens):
       { "idx": <int>, "act": "<actName>", "timeStartSec": <int>, "timeEndSec": <int>,
         "sceneDescription": "${req.compositionMode === "composite-pro" ? "[FOREGROUND] ... [BACKGROUND] ..." : "narrativa de la escena, integrando directrices de composición"}",
         "cameraMovement": "movimiento exacto (dolly-in lento, orbit, push-in macro, static lock-off, whip-pan, etc.)",
         "keyframePrompt": "prompt EN INGLÉS >=90 palabras (subject+composition+camera+lighting+palette+product DNA literal+8k photoreal)${req.compositionMode === "explainer-locked" ? ". Incluir: 'host anchored center-frame, static foreground, dynamic background composition'" : ""}",
         "videoPrompt": "prompt EN INGLÉS 40-90 palabras (cámara+easing+movimiento intra-plano+atmósfera)${req.compositionMode === "explainer-locked" ? ". Forzar 'character static, only background composition shifts'" : ""}",
         "voiceoverLine": "frase en ${req.language} (~${Math.round(req.totalDurationSec * 2.5 / plan.length)} palabras), ENCADENADA con la anterior" }

       Usa estos timings EXACTOS por idx: ${plan.map((s) => `${s.idx}=[${s.startSec}-${s.endSec},act:${s.act}]`).join("; ")}
    */
  ]
}

REGLAS DURAS:
- EXACTAMENTE ${plan.length} escenas en el array.
- timeStartSec/timeEndSec respetan exactamente las duraciones indicadas arriba.
- voiceoverLine en ${req.language}; keyframePrompt y videoPrompt en INGLÉS.
- NUNCA cambies la identidad del personaje ni del producto (usa los bloques de identidad).
- NO devuelvas Markdown, NO devuelvas explicaciones — solo el JSON.`;
}

/**
 * Director-level cinematic script generator. Returns a CinematicScript that
 * the multi-shot pipeline can render directly.
 */
export async function generateDirectedScript(req: DirectorRequest): Promise<CinematicScript & { narrativeArc?: any[] }> {
  const plan = planScenesAcrossActs(req);
  logger.info({
    projectId: req.projectId,
    totalSec: req.totalDurationSec,
    scenes: req.scenesCount,
    acts: pickActs(req.totalDurationSec).map((a) => a.name),
    compositionMode: req.compositionMode,
    productDNA: { materials: req.productDNA.materials.length, layers: req.productDNA.deconstructionPoints.length },
    characterLocked: Boolean(req.character),
  }, "🎬 Director: planning narrative arc");

  const prompt = buildDirectorPrompt(req, plan);
  const sysWithN = DIRECTOR_SYSTEM.replace("${\"X\"}", String(req.scenesCount));
  // Long scripts can grow large. Each scene needs ~250-350 output tokens.
  // Claude Sonnet 4 supports up to 64k output; cap at 32k to keep latency
  // reasonable. Floor at 4096 for tiny scripts.
  const maxTokens = Math.max(4096, Math.min(32_000, 2048 + req.scenesCount * 280));
  // Director-grade reasoning: pick the "genius" tier (Opus 4.1 by default,
  // configurable from admin UI). Long-form arcs with 80+ scenes benefit
  // dramatically from a stronger reasoner.
  const script = await askClaudeJson<CinematicScript & { narrativeArc?: any[] }>(
    req.projectId,
    prompt,
    sysWithN,
    maxTokens,
    240_000,
    { tier: req.scenesCount >= 30 || req.totalDurationSec >= 180 ? "genius" : "smart" },
  );

  if (!Array.isArray(script.scenes) || script.scenes.length === 0) {
    throw new Error("Director: Claude no devolvió escenas válidas");
  }

  // Defensive normalization: enforce exact scenesCount and re-stamp timings
  // from our plan (Claude sometimes drifts on long-form).
  const planById = new Map(plan.map((p) => [p.idx, p]));
  script.scenes = script.scenes.slice(0, req.scenesCount).map((s: CinematicScene, i: number) => {
    const planScene = plan[i] || planById.get(s.idx) || plan[plan.length - 1];
    return {
      ...s,
      idx: i + 1,
      timeStartSec: planScene.startSec,
      timeEndSec: planScene.endSec,
      // Pin act metadata for downstream UI/analytics
      cameraPreset: s.cameraPreset,
    } as CinematicScene;
  });

  // Pad if Claude returned fewer scenes than requested (rare edge case).
  while (script.scenes.length < req.scenesCount) {
    const i = script.scenes.length;
    const planScene = plan[i];
    const last = script.scenes[script.scenes.length - 1];
    script.scenes.push({
      ...last,
      idx: i + 1,
      timeStartSec: planScene.startSec,
      timeEndSec: planScene.endSec,
      voiceoverLine: last.voiceoverLine || "",
    } as CinematicScene);
  }

  // Validate semantic completeness per scene. If Claude truncated/skipped
  // any prompt field on long-form (>~110 scenes the JSON can be partial),
  // attempt a single batched repair call for ONLY the broken indices instead
  // of failing the whole render.
  const broken: number[] = [];
  for (let i = 0; i < script.scenes.length; i++) {
    const s: any = script.scenes[i];
    const ok =
      typeof s.keyframePrompt === "string" && s.keyframePrompt.length > 40 &&
      typeof s.videoPrompt === "string" && s.videoPrompt.length > 30 &&
      typeof s.voiceoverLine === "string" && s.voiceoverLine.length > 4;
    if (!ok) broken.push(i);
  }
  if (broken.length > 0 && broken.length < script.scenes.length) {
    logger.warn({ projectId: req.projectId, brokenCount: broken.length, total: script.scenes.length }, "🩹 Director: repairing incomplete scenes");
    try {
      const lang = req.language;
      const idsList = broken.map((i) => script.scenes[i].idx).join(",");
      const ctx = broken.slice(0, 25).map((i) => {
        const p = plan[i] || plan[plan.length - 1];
        const prev: any = script.scenes[i - 1] || {};
        const next: any = script.scenes[i + 1] || {};
        return `idx=${script.scenes[i].idx} act=${p.act} dur=${p.durationSec}s prev_VO="${(prev.voiceoverLine || "").slice(0, 80)}" next_VO="${(next.voiceoverLine || "").slice(0, 80)}"`;
      }).join("\n");
      const repairPrompt = `Repara SOLO las escenas marcadas (idx ${idsList}) del anuncio "${script.title}". Devuelve JSON: { "scenes": [ { "idx": <id>, "keyframePrompt": "...EN INGLÉS >=90 palabras...", "videoPrompt": "...EN INGLÉS 40-90 palabras...", "voiceoverLine": "...frase en ${lang}, encadenada..." } ] }. Anchor character + product DNA en cada keyframePrompt. Contexto:\n${ctx}\n\nProduct DNA:\n${req.productDNA.identityLockBlock}`;
      const repaired = await askClaudeJson<{ scenes: Array<{ idx: number; keyframePrompt?: string; videoPrompt?: string; voiceoverLine?: string }> }>(
        req.projectId,
        repairPrompt,
        DIRECTOR_SYSTEM.replace("${\"X\"}", String(broken.length)),
        Math.max(2048, broken.length * 320),
        120_000,
      );
      const byIdx = new Map(repaired.scenes.map((r) => [r.idx, r]));
      for (const i of broken) {
        const fix = byIdx.get(script.scenes[i].idx);
        if (!fix) continue;
        const s: any = script.scenes[i];
        if (fix.keyframePrompt) s.keyframePrompt = fix.keyframePrompt;
        if (fix.videoPrompt) s.videoPrompt = fix.videoPrompt;
        if (fix.voiceoverLine) s.voiceoverLine = fix.voiceoverLine;
      }
    } catch (e: any) {
      logger.warn({ err: e?.message }, "Director: repair pass failed (continuing with partial scenes)");
    }
  }

  logger.info({
    projectId: req.projectId,
    scenes: script.scenes.length,
    title: script.title,
  }, "🎬 Director: script ready");

  return script;
}
