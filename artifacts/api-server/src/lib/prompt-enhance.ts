// ═══════════════════════════════════════════════════════════════════════════
// PROMPT ENHANCE — Refinador IA del Prompt Lab
// ═══════════════════════════════════════════════════════════════════════════
// Toma el baseline determinista del Prompt Lab (subject + presets) y lo
// pasa por Claude con un system prompt PREMIUM específico al intent del
// usuario (ad / image / video / infographic / email / landing / seo / brand
// / ugc / multishot). Devuelve un prompt PRO listo para pegar en el modelo
// destino, además de un negativePrompt afinado y un breakdown legible.
// ═══════════════════════════════════════════════════════════════════════════

import { askClaudeJson } from "./claude.js";
import { logger } from "./logger.js";

export type EnhanceIntent =
  | "ad_cinematic"
  | "image_hero_product"
  | "ad_copy_meta"
  | "infographic_html"
  | "seo_product_100"
  | "brand_kit_ocr"
  | "email_marketing"
  | "landing_hero"
  | "ugc_video"
  | "multishot_director"
  | "image"
  | "video";

export interface EnhanceInput {
  intent: EnhanceIntent;
  baselinePrompt: string;
  subject: string;
  brand?: string | null;
  language?: "es" | "en";
  /** Opcional: contexto extra del usuario (audiencia, USP, restricciones). */
  extraContext?: string;
  /** projectId opcional para tracking. 0 = uso global del Prompt Lab. */
  projectId?: number;
}

export interface EnhanceResult {
  enhanced: string;
  negativePrompt: string;
  breakdown: Record<string, string>;
  intent: EnhanceIntent;
  model: "claude" | "fallback";
}

// ─── SYSTEM PROMPTS PREMIUM POR INTENT ──────────────────────────────────────
// Cada entrada espeja el system prompt que la app usa internamente para ese
// caso de uso, para que el output del Prompt Lab tenga la misma calidad que
// el motor de producción.

const SYSTEMS: Record<EnhanceIntent, string> = {
  ad_cinematic: `Eres un director creativo y copywriter senior especializado en anuncios cinemáticos multi-shot (Seedance Pro / Kling v2.1 / Runway Gen-4 / Veo 3). ENRIQUECE Y EXPANDE el contenido existente del usuario en un PROMPT PROFESIONAL en INGLÉS de >=120 palabras estructurado en este orden: subject → composition → camera framing & lens → lighting setup (key/fill/rim, color temp) → color palette (3 hex aprox) → mood & texture → integración del producto. Cierra con descriptores técnicos ("shot on RED, 8k, photorealistic, ultra detailed"). REGLA ANTI-TEXTO: NUNCA incluyas nombres de marca, nombres de producto, CTA, precios o cualquier palabra que el modelo pueda intentar pintar como texto. La marca y CTA se sobreimprimen DESPUÉS con FFmpeg drawtext. MANDATORY: Preserve all specific product details, technical choices, and creative elements from the user's existing content — enhance quality, never replace unique specifics with generic descriptions. Devuelve JSON estricto.`,

  multishot_director: `Eres un director de cine y showrunner profesional con experiencia en spots largos premium (Apple, Tesla, Nike, A24). ENRIQUECE Y EXPANDE el contenido existente del usuario en una directiva PRO en INGLÉS para un anuncio multi-shot con UN SOLO arco narrativo coherente, continuidad estricta entre escenas (pose/iluminación/paleta/posición del producto) y preservación de identidad. MANDATORY: Preserve all timeline sequences (0-10, 0-1.5, 0-2, etc.), exploded-view stages, and assembly/disassembly details from the existing content — never discard user's specific creative structure. Devuelve JSON estricto.`,

  image_hero_product: `You are an elite commercial photographer and art director. ENHANCE AND BUILD UPON the user's existing prompt to produce a magazine-grade English image prompt (120-180 words, single dense paragraph). Cover: subject + materials + camera + lens + lighting (key/fill/rim, soft/hard) + color palette + mood + composition + negative space + post-grade aesthetic. ABSOLUTELY NO TEXT, NO LOGOS, NO WATERMARKS in the image. Preserve any text printed on the product itself EXACTLY. MANDATORY: Preserve all specific product details, materials, colors, and creative choices from the existing content. Output STRICT JSON only.`,

  image: `You are an elite commercial photographer and art director. ENHANCE AND BUILD UPON the user's existing prompt to produce a magazine-grade English image prompt (120-180 words, single dense paragraph). Cover: subject + materials + camera + lens + lighting + color palette + mood + composition + negative space. ABSOLUTELY NO TEXT, NO LOGOS, NO WATERMARKS. MANDATORY: Preserve all specific product details, technical parameters, and creative choices from the existing text. Output STRICT JSON only.`,

  video: `You are an elite cinematographer. ENHANCE AND BUILD UPON the user's existing video prompt to produce a professional English video prompt (80-140 words). Cover: opening frame (subject + composition + lens + lighting + palette) → camera movement with speed and easing → motion within the frame → atmosphere → closing beat. NO TEXT, NO LOGOS, NO WATERMARKS, NO TYPOGRAPHY in any frame. Strict design fidelity — the product never deconstructs, morphs or recolors mid-frame. MANDATORY: Preserve all timeline sequences (e.g. 0-10s, 0-1.5s), exploded-view stages, camera preset names, and technical specifics already written by the user. Do NOT replace specific content with generic descriptions. Output STRICT JSON only.`,

  ad_copy_meta: `You are an elite advertising copywriter for Meta/TikTok/Reels. Rewrite the user's baseline brief into a strategic JSON containing a hook (3-7 words, scroll-stopping), body (15-25 words, emotional), cta (3-5 words, action verb), tone (one word) and angle (benefit | problem | social_proof | curiosity | urgency). Avoid generic phrases like "check this out". Be specific and provocative. Output STRICT JSON only.`,

  infographic_html: `Eres un consultor estratégico senior. Reescribe el brief baseline del usuario en una sección de informe HTML semántica, con resumen ejecutivo (2-3 frases con cifras), 3 hallazgos clave (lista) y 3 acciones priorizadas (quick win 24-48h / medio plazo / estratégico). Usa <div class="ai-analysis">, <h3>, <ul>, <ol>. Devuelve JSON con { html: "<div>...</div>", title, summary }.`,

  seo_product_100: `Eres un SEO copywriter senior especializado en Shopify. Reescribe el baseline del usuario en una entrada de producto con SEO 100/100: title (50-65 chars), seoTitle, seoDescription, descripción HTML 200-400 palabras con hook+problema+solución+bullets+CTA, tags[5], schemaJsonLd Product completo, faqItems[3]. Devuelve JSON estricto.`,

  brand_kit_ocr: `You are a brand designer's analysis assistant. Rewrite the user's baseline brief into a structured brand kit JSON: brandName, brandNameAlternatives[], taglines[], socialHandles[], urls[], hexColors[], fontFamilies[], looksLikeLogo, logoStyle, industryGuess, toneGuess. Output STRICT JSON only.`,

  email_marketing: `Eres un email marketer senior DTC. Reescribe el baseline del usuario en un email JSON: subject (<50 chars), preheader (<90 chars), previewText, bodyHtml (responsive max-width 600px con un H1, 2-3 párrafos cortos, 1 CTA principal arriba, footer placeholder), ctaPrimary, ctaSecondary, abTestSubjectAlt. Sin spam-words. Devuelve JSON estricto.`,

  landing_hero: `Eres un CRO copywriter elite (Stripe, Notion, Linear). Reescribe el baseline en un hero de landing JSON: h1 (5-10 palabras benefit-driven con número o mecanismo), h1Variants[3], subHeadline (12-20 palabras), ctaPrimary (verbo acción), ctaSecondary, socialProof concreto, urgencyHook opcional, bullets[3] con métrica. Sin headlines genéricos. Devuelve JSON estricto.`,

  ugc_video: `Eres un guionista UGC de alta conversión para Meta/TikTok. Reescribe el baseline en un guion UGC JSON: title, hookFirstFrame, scenes[] con (idx, secs, what_creator_says, what_we_see, broll_idea), ctaSpoken (natural, no "compra ya"), captionSuggestion (3-5 hashtags relevantes). Tono coloquial, frases cortas, contracciones. Sin palabras de marketing. Devuelve JSON estricto.`,
};

// ─── ESQUEMAS DE OUTPUT POR INTENT ──────────────────────────────────────────
// Le decimos a Claude exactamente qué shape JSON queremos para cada intent,
// pero todos comparten un "enhanced" (string canónico para pegar en el modelo
// destino) y un "negativePrompt" (con defaults sensatos).

function buildUserPrompt(input: EnhanceInput): string {
  const lang = input.language === "en" ? "English" : "Spanish";
  const brandLine = input.brand ? `\nBRAND: ${input.brand}` : "";
  const extraLine = input.extraContext ? `\nEXTRA CONTEXT: ${input.extraContext}` : "";

  const isVisual = ["ad_cinematic", "multishot_director", "image", "image_hero_product", "video", "ugc_video"].includes(input.intent);

  const schemaHint = isVisual
    ? `Output JSON: {
  "enhanced": "the rewritten dense prompt as a single string ready to paste into the model",
  "negativePrompt": "comma-separated negative prompt (text, watermark, blurry, deformed, low quality, etc.)",
  "breakdown": {
    "subject": "...",
    "composition": "...",
    "lighting": "...",
    "palette": "...",
    "mood": "...",
    "camera": "...",
    "quality": "..."
  }
}`
    : `Output JSON: {
  "enhanced": "the rewritten content (HTML / markdown / multi-line text as appropriate for the intent)",
  "negativePrompt": "constraints to avoid (e.g. spam words, generic phrases, banned topics)",
  "breakdown": { "key": "value" }
}`;

  return `ENHANCE this into a PROFESSIONAL ${input.intent.replace(/_/g, " ")} prompt/asset. BUILD UPON the existing content — preserve all specific details.

USER INTENT: ${input.intent}
SUBJECT / TOPIC: ${input.subject}${brandLine}${extraLine}
TARGET LANGUAGE OF OUTPUT: ${lang}

EXISTING USER CONTENT (enhance quality and detail — preserve ALL specific information):
"""
${input.baselinePrompt}
"""

CRITICAL RULE: Do NOT discard the user's specific product details, timeline sequences, technical parameters, camera choices, or creative elements. Enhance them — add professional cinematic/photographic language around them, but never replace unique specifics with generic placeholders.

${schemaHint}

DO NOT include any text outside the JSON. Do not wrap in markdown fences.`;
}

const FALLBACK_NEGATIVES = "low quality, blurry, deformed, extra limbs, watermark, text artifacts, amateur, lens dirt, noise, compression artifacts";

/** Best-effort enhance. If Claude fails, returns the baseline as-is. */
export async function enhancePrompt(input: EnhanceInput): Promise<EnhanceResult> {
  const sys = SYSTEMS[input.intent] || SYSTEMS["image"];
  const user = buildUserPrompt(input);
  const projectId = input.projectId && Number.isFinite(input.projectId) ? input.projectId : 0;

  try {
    const out = await askClaudeJson<any>(projectId, user, sys, 3072, 90_000);

    // Robust extraction: Claude may return our wrapper {enhanced,...}, OR the
    // raw structured asset (array of copy variants, infographic JSON, email
    // JSON, etc.) when the intent's system prompt asks for a domain shape. We
    // accept either: if 'enhanced' is missing, we stringify the whole payload
    // as the enhanced output so the user never loses Claude's work.
    let enhanced = "";
    let negativePrompt = "";
    let breakdown: Record<string, string> = { subject: input.subject };

    if (out && typeof out === "object" && !Array.isArray(out) && typeof out.enhanced === "string" && out.enhanced.trim().length >= 30) {
      enhanced = String(out.enhanced).trim();
      negativePrompt = String(out.negativePrompt || "").trim();
      if (out.breakdown && typeof out.breakdown === "object") breakdown = out.breakdown;
    } else if (out !== null && out !== undefined) {
      // Domain-shape response (array or object without `enhanced`).
      // Pretty-print as JSON so the user gets the structured asset directly.
      try {
        enhanced = JSON.stringify(out, null, 2);
      } catch {
        enhanced = String(out);
      }
      if (out && typeof out === "object" && typeof (out as any).negativePrompt === "string") {
        negativePrompt = String((out as any).negativePrompt);
      }
    }

    if (!enhanced || enhanced.trim().length < 30) {
      logger.warn({ intent: input.intent, len: enhanced.length }, "enhancePrompt: claude returned short output, falling back");
      return {
        enhanced: input.baselinePrompt,
        negativePrompt: negativePrompt || FALLBACK_NEGATIVES,
        breakdown,
        intent: input.intent,
        model: "fallback",
      };
    }

    return {
      enhanced,
      negativePrompt: (negativePrompt || FALLBACK_NEGATIVES).slice(0, 1200),
      breakdown,
      intent: input.intent,
      model: "claude",
    };
  } catch (err: any) {
    logger.warn({ err: err?.message, intent: input.intent }, "enhancePrompt failed, returning baseline");
    return {
      enhanced: input.baselinePrompt,
      negativePrompt: FALLBACK_NEGATIVES,
      breakdown: { subject: input.subject, baseline: "kept as-is (Claude unavailable)" },
      intent: input.intent,
      model: "fallback",
    };
  }
}
