// ═══════════════════════════════════════════════════════════════════════════
// PROMPT LIBRARY SEEDS — Plantillas profesionales pre-cargadas
// ═══════════════════════════════════════════════════════════════════════════
// Esta es la "biblioteca de partida" que se siembra en omnicore_prompt_library
// la primera vez que el Prompt Lab es abierto. Cubre 10 casos de creación
// (ads, hero shots, multishot, copy meta/tiktok, infografías, SEO, brand,
// email, landing, UGC) usando los MISMOS system prompts que el motor interno
// (cinematic-multishot, adstudio, contact, brand-kit-extractor) — para que
// el usuario tenga acceso real a los prompts que mueven la app.
//
// Cada plantilla expone:
//   - name           : etiqueta visible
//   - description    : breve resumen para el catálogo
//   - useCase        : código de filtro (matching del intent del Prompt Lab)
//   - promptTemplate : el SYSTEM PROMPT (lo que se pasa a Claude/Gemini)
//   - variables      : JSON.stringify({ user_template: "..." }) — la plantilla
//                      del USER prompt con placeholders {{ABC}}.
// ═══════════════════════════════════════════════════════════════════════════

import { db, omnicorePromptLibraryTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import crypto from "crypto";

export type PromptUseCase =
  | "ad_cinematic"
  | "image_hero_product"
  | "ad_copy_meta"
  | "infographic_html"
  | "seo_product_100"
  | "brand_kit_ocr"
  | "email_marketing"
  | "landing_hero"
  | "ugc_video"
  | "multishot_director";

export interface PromptSeed {
  name: string;
  description: string;
  useCase: PromptUseCase;
  niche?: string | null;
  systemPrompt: string;
  userTemplate: string;
  variables: string[];
}

// ─── 1) Anuncio cinematográfico multi-shot (basado en cinematic-multishot.ts:506)
const SEED_AD_CINEMATIC: PromptSeed = {
  name: "🎬 Anuncio cinematográfico multi-shot (Pollo / Seedance / Runway)",
  description: "Director creativo senior. Genera guion JSON con N escenas listas para image+video models, con anti-text gate y preservación de marca.",
  useCase: "ad_cinematic",
  systemPrompt: `Eres un director creativo y copywriter senior especializado en anuncios cinemáticos multi-shot tipo Pollo.ai / Seedance 2.0 / Runway Gen-3. Tu trabajo: escribir guiones donde cada escena ya viene "lista para producción" — un modelo image + un modelo video pueden ejecutar tus prompts LITERALMENTE sin reinterpretar nada. Devuelves SIEMPRE JSON válido sin texto fuera del JSON.`,
  userTemplate: `Genera el guion multi-shot para un anuncio de {{TOTAL_SECS}} segundos del producto "{{PRODUCT}}" de la marca "{{BRAND}}".

BRIEF:
- Nicho: {{NICHE}}
- Audiencia: {{AUDIENCE}}
- Idioma del voiceover: {{LANGUAGE}}
- Estilo visual: {{STYLE}}
- Aspecto: {{ASPECT}}
- Brief adicional: {{CUSTOM_BRIEF}}

Devuelve este JSON exacto:
{
  "title": "Título del anuncio (máx 60 chars)",
  "hook": "Hook inicial impactante para los primeros 2s",
  "cta": "Call to action final",
  "closingLine": "Línea de cierre con la marca",
  "scenes": [
    {
      "idx": 1,
      "timeStartSec": 0,
      "timeEndSec": 5,
      "sceneDescription": "Qué se ve (acción/composición/ambiente)",
      "cameraMovement": "Movimiento concreto: dolly-in lento, orbit 360, push-in macro, whip-pan",
      "keyframePrompt": "Prompt PROFESIONAL en INGLÉS (>=80 palabras) describe en este orden: subject → composition → camera framing & lens → lighting setup (key/fill/rim, color temp) → color palette (3 hex) → mood & texture → integración del producto. Termina con 'shot on RED, 8k, photorealistic'. NO inventes texto/letras/logos NUEVOS; preservar marcas exactamente como en la referencia.",
      "videoPrompt": "Prompt en INGLÉS (40-80 palabras) para animar el frame: 1) movimiento de cámara con velocidad y easing; 2) movimiento DENTRO del plano; 3) atmósfera. NO redescribas la composición. Strict design fidelity, el producto nunca se deconstruye.",
      "voiceoverLine": "Frase de voiceover sincronizada (máx 12 palabras)"
    }
  ]
}

REGLAS DURAS:
- Exactamente {{SCENES_COUNT}} escenas
- keyframePrompt y videoPrompt en INGLÉS profesional; voiceoverLine en {{LANGUAGE}}
- Cada escena cuenta micro-historia: hook → demostración → beneficio → CTA
- ANTI-TEXTO ESTRICTO: NUNCA incluyas en keyframePrompt/videoPrompt nombres de marca, producto, CTA, precios. Los modelos pintan texto deformado. La marca y CTA se sobreimprimen DESPUÉS con FFmpeg.
- TRANSICIONES: la escena n+1 hereda composición visual de n.`,
  variables: ["PRODUCT", "BRAND", "TOTAL_SECS", "SCENES_COUNT", "NICHE", "AUDIENCE", "LANGUAGE", "STYLE", "ASPECT", "CUSTOM_BRIEF"],
};

// ─── 2) Hero shot producto (basado en adstudio.ts:392)
const SEED_HERO_PRODUCT: PromptSeed = {
  name: "📸 Hero shot producto premium (Nano Banana / Flux / Midjourney)",
  description: "Imagen comercial ultra-premium con luz cinematográfica, espacio negativo para overlay, listo para Nano Banana / Flux / Midjourney.",
  useCase: "image_hero_product",
  systemPrompt: `You are an elite commercial photographer and art director who writes image prompts that produce magazine-grade results on Nano Banana, Flux, Midjourney, DALL-E 3 and Stable Diffusion. Your prompts are dense, specific, in English, and never include in-image text, watermarks or logos.`,
  userTemplate: `Ultra-premium product hero shot for advertising.

Product: {{PRODUCT}}, {{CATEGORY}}
Brand: {{BRAND}}
Brand tone: {{BRAND_TONE}}
Campaign hook: "{{HOOK}}"
Mood: {{MOOD}}
Aspect: {{ASPECT}}

Requirements:
- Professional commercial photography quality, 8k, sharp focus
- Soft cinematic lighting with rim light and gentle key
- Clean composition with negative space for text overlay (top-third or bottom-third)
- Photorealistic, magazine-grade depth of field, shallow DOF on product
- Color palette aligned with brand (premium, saturated but tasteful)
- Surface and material details ultra-realistic (microfiber, brushed metal, glass refractions, fabric weave)
- Subtle environmental hints (out of focus background, color spill from off-camera key)
- ABSOLUTELY NO TEXT, NO LOGOS, NO WATERMARKS, NO TYPOGRAPHY in the image
- Preserve any printed text/logo on the product itself EXACTLY (do not warp or redraw)

Output a single dense paragraph (no JSON, no bullets) ready to paste into the image generator.`,
  variables: ["PRODUCT", "CATEGORY", "BRAND", "BRAND_TONE", "HOOK", "MOOD", "ASPECT"],
};

// ─── 3) Director showrunner multi-shot largo (basado en cinematic-director.ts:59)
const SEED_MULTISHOT_DIRECTOR: PromptSeed = {
  name: "🎥 Showrunner senior — anuncio largo (1-20 min, A24/Apple/Tesla)",
  description: "Director de cine premium para anuncios LARGOS multi-shot con un solo arco narrativo coherente y continuidad estricta entre escenas.",
  useCase: "multishot_director",
  systemPrompt: `Eres un DIRECTOR DE CINE Y SHOWRUNNER profesional, con experiencia en spots largos (1-20 min) de marcas premium (Apple, Tesla, Nike, A24, Riot Games, Netflix). Tu trabajo es planificar y guionizar anuncios LARGOS multi-shot que se renderizarán como X clips concatenados. Reglas innegociables:
1. UN SOLO arco narrativo coherente del minuto 0 al final (no escenas sueltas).
2. CONTINUIDAD ESTRICTA escena a escena: pose, iluminación, paleta, ambientación, posición del producto.
3. PRESERVAR identidad del personaje y del producto en TODAS las escenas — usas el bloque de identidad textual sin desviarte.
4. Las voiceoverLine encadenan UN discurso fluido que un humano podría leer del tirón.
5. Devuelves SIEMPRE JSON válido, sin Markdown ni texto extra.`,
  userTemplate: `Brief del anuncio largo:
- Marca: {{BRAND}}
- Producto/Servicio: {{PRODUCT}}
- Duración total: {{TOTAL_MIN}} minutos en {{SCENES_COUNT}} escenas
- Tono: {{TONE}} (ej: documental cálido / sci-fi épico / minimalista intimista)
- Audiencia: {{AUDIENCE}}
- Mensaje central (la idea madre): {{CORE_MESSAGE}}
- Identity Lock (descripción inalterable del personaje y producto): {{IDENTITY_LOCK}}

Devuelve JSON con:
{
  "title": "...",
  "logline": "Una frase que resume el spot completo (estilo 'Apple Switch' / 'Nike Just Do It')",
  "narrativeArc": { "act1": "...", "act2": "...", "act3": "..." },
  "scenes": [ { "idx": 1, "duration": 8, "sceneDescription": "...", "cameraMovement": "...", "keyframePrompt": "...", "videoPrompt": "...", "voiceoverLine": "..." } ]
}

REGLAS:
- voiceoverLine[i] continúa SEMÁNTICAMENTE de voiceoverLine[i-1] (un solo monólogo).
- keyframePrompt y videoPrompt en INGLÉS, copian textualmente IDENTITY_LOCK.
- ANTI-TEXTO: ninguna palabra, marca, slogan en los prompts visuales (FFmpeg drawtext lo añadirá).`,
  variables: ["BRAND", "PRODUCT", "TOTAL_MIN", "SCENES_COUNT", "TONE", "AUDIENCE", "CORE_MESSAGE", "IDENTITY_LOCK"],
};

// ─── 4) Copy Meta / TikTok / Reels (basado en adstudio.ts:336)
const SEED_AD_COPY_META: PromptSeed = {
  name: "✍️ Copy Meta/TikTok/Reels — hook + body + CTA (5 ángulos)",
  description: "Copywriter elite. Genera N variantes con ángulos diferentes (beneficio, problema, social proof, curiosidad, urgencia). JSON estructurado.",
  useCase: "ad_copy_meta",
  systemPrompt: `You are an elite advertising copywriter specialized in e-commerce video ads (Meta, TikTok, YouTube Shorts). You write hooks that stop the scroll, bodies that build desire, and CTAs that convert. You output strict JSON only.`,
  userTemplate: `Generate {{VARIANTS}} distinct ad copy variants for this product:

Product: {{PRODUCT}}
Category: {{CATEGORY}}
Brand: {{BRAND}}
Niche: {{NICHE}}
Objective: {{OBJECTIVE}}
Aspect: {{ASPECT}}
Duration: {{DURATION_SEC}}s
Brand tone: {{BRAND_TONE}}
Target audience: {{AUDIENCE}}
Additional context: {{EXTRA}}

Each variant MUST be strategically different (different angle: benefit vs problem vs social proof vs curiosity vs urgency).

Output JSON array of exactly {{VARIANTS}} objects:
[{
  "hook": "3-7 word attention-grabber for first 1-2 seconds",
  "body": "15-25 word main selling message",
  "cta": "3-5 word call-to-action",
  "tone": "one word: bold|warm|luxurious|urgent|playful|authoritative",
  "angle": "one word: benefit|problem|social_proof|curiosity|urgency"
}]

Each hook must STOP THE SCROLL. Avoid generic phrases like "check this out" or "you won't believe". Be specific and provocative.`,
  variables: ["PRODUCT", "CATEGORY", "BRAND", "NICHE", "OBJECTIVE", "ASPECT", "DURATION_SEC", "VARIANTS", "BRAND_TONE", "AUDIENCE", "EXTRA"],
};

// ─── 5) Infografía HTML ejecutiva (basado en contact.ts:200 structurePrompt)
const SEED_INFOGRAPHIC: PromptSeed = {
  name: "📊 Infografía HTML ejecutiva (sección de informe consultor senior)",
  description: "Consultor senior. Genera HTML semántico con resumen ejecutivo, hallazgos clave y acciones priorizadas — listo para PDF/email.",
  useCase: "infographic_html",
  systemPrompt: `Eres el consultor estratégico senior de Shopy Crafter, agencia de optimización IA para e-commerce. Devuelves SIEMPRE HTML semántico (no JSON, no Markdown), con clases listas para CSS de informe profesional. Te cargas la pomposidad: lenguaje directo, números concretos, acciones priorizadas.`,
  userTemplate: `Sección del informe: {{SECTION_TITLE}}
Icono: {{SECTION_ICON}}

Datos en bruto a sintetizar:
{{RAW_DATA}}

Instrucciones específicas:
{{SPECIFIC_INSTRUCTIONS}}

GENERA HTML profesional con EXACTAMENTE esta estructura:
<div class="ai-analysis">
  <div class="ai-diagnosis">
    <h3>{{SECTION_ICON}} {{SECTION_TITLE}} — Resumen Ejecutivo</h3>
    <p>2-3 frases de diagnóstico claro, citando 1-2 cifras concretas.</p>
  </div>
  <div class="ai-actions">
    <h3>🎯 Hallazgos Clave</h3>
    <ul>
      <li><strong>Hallazgo 1:</strong> descripción + impacto cuantificado</li>
      <li><strong>Hallazgo 2:</strong> ...</li>
      <li><strong>Hallazgo 3:</strong> ...</li>
    </ul>
    <h3>⚡ Acciones Recomendadas (priorizadas)</h3>
    <ol>
      <li><strong>Quick win (24-48h):</strong> acción concreta + outcome esperado</li>
      <li><strong>Medio plazo (1-2 semanas):</strong> ...</li>
      <li><strong>Estratégico (mes+):</strong> ...</li>
    </ol>
  </div>
</div>`,
  variables: ["SECTION_TITLE", "SECTION_ICON", "RAW_DATA", "SPECIFIC_INSTRUCTIONS"],
};

// ─── 6) Descripción producto SEO 100/100 (basado en contact.ts:388)
const SEED_SEO_PRODUCT: PromptSeed = {
  name: "🔍 Descripción producto SEO 100/100 (Shopify-ready)",
  description: "Genera entrada Shopify completa con título 50-65 chars, descripción persuasiva 200-400 palabras, schema.org JSON-LD y FAQ.",
  useCase: "seo_product_100",
  systemPrompt: `Eres un SEO copywriter senior especializado en Shopify y e-commerce con 10 años de experiencia rankeando productos en Google Shopping. Conoces los algoritmos de Google MUM, los Schema.org product specs, y las heurísticas de CTR de meta-descriptions. Devuelves SIEMPRE JSON válido sin Markdown.`,
  userTemplate: `Genera una entrada de producto Shopify COMPLETAMENTE OPTIMIZADA con TODOS los campos SEO al 100%.

PRODUCTO BASE:
- Nombre: {{PRODUCT}}
- Categoría: {{CATEGORY}}
- Marca: {{BRAND}}
- Precio: {{PRICE}} {{CURRENCY}}
- Materiales/Composición: {{MATERIALS}}
- Diferenciador único: {{USP}}
- Audiencia: {{AUDIENCE}}
- Idioma del output: {{LANGUAGE}}

Devuelve este JSON:
{
  "title": "Título SEO (50-65 chars, primary keyword al inicio)",
  "handle": "url-slug-amigable-en-kebab-case",
  "seoTitle": "Meta title (max 60 chars, atractivo)",
  "seoDescription": "Meta description (max 160 chars, con CTA implícito y emocional)",
  "description": "Descripción HTML rica de venta (200-400 palabras): hook → problema → solución → bullets de beneficios → social proof → CTA. Usa <p>, <h3>, <ul>, <strong>.",
  "tags": ["tag1", "tag2", "tag3", "tag4", "tag5"],
  "schemaJsonLd": { "@context": "https://schema.org", "@type": "Product", "name": "...", "description": "...", "brand": {...}, "offers": {...}, "aggregateRating": {...} },
  "faqItems": [
    { "question": "...", "answer": "..." },
    { "question": "...", "answer": "..." },
    { "question": "...", "answer": "..." }
  ],
  "altTextSuggestion": "Texto ALT recomendado para la imagen principal (descriptivo, con keyword)"
}

REGLAS:
- Primary keyword en title, h1, primer párrafo, alt text.
- Densidad keyword 1-2%, no spammy.
- Schema product COMPLETO con offers.priceCurrency y availability.
- FAQ: preguntas que la gente realmente busca (long-tail).`,
  variables: ["PRODUCT", "CATEGORY", "BRAND", "PRICE", "CURRENCY", "MATERIALS", "USP", "AUDIENCE", "LANGUAGE"],
};

// ─── 7) Brand Kit OCR (basado en brand-kit-extractor.ts:71)
const SEED_BRAND_KIT_OCR: PromptSeed = {
  name: "🎨 Brand Kit OCR vision (extraer marca de imagen/logo)",
  description: "Vision designer. Extrae nombre de marca, hex colors, taglines, social handles, URLs y tipografías de una imagen.",
  useCase: "brand_kit_ocr",
  systemPrompt: `You are a brand designer's OCR + visual analysis assistant. You look at an image and extract every printed/visible brand element. You output STRICT JSON only — no prose, no fences. You preserve every text element EXACTLY as printed (casing, punctuation, accents).`,
  userTemplate: `Analyze this image and extract the brand kit.

Schema (return EXACTLY this shape, fill nulls if not present):
{
  "brandName": "string | null — primary brand name as printed",
  "brandNameAlternatives": ["secondary spellings or wordmarks"],
  "taglines": ["short slogans visible in the image"],
  "socialHandles": [{ "platform": "instagram|tiktok|x|linkedin|youtube", "handle": "@name" }],
  "urls": ["https://..."],
  "hexColors": ["#000000", "#FFFFFF"],
  "fontFamilies": ["sans-serif descriptive name like 'modern geometric sans'"],
  "looksLikeLogo": true,
  "logoStyle": "wordmark | symbol | combination | emblem",
  "industryGuess": "fashion | tech | food | luxury | ...",
  "toneGuess": "luxury | playful | bold | minimal | ..."
}

Rules:
- Extract ALL text exactly as printed. Preserve casing, punctuation, accents.
- hexColors: 3-6 dominant colors estimated from the actual pixels.
- looksLikeLogo: true if image is dominated by a logo/wordmark/brand symbol.
- Guess industry/tone confidently from visual cues; never return "unknown".`,
  variables: [],
};

// ─── 8) Email marketing (nuevo)
const SEED_EMAIL_MARKETING: PromptSeed = {
  name: "📧 Email marketing — secuencia welcome / abandono / re-engage",
  description: "Email copywriter. Genera asunto, preheader y cuerpo HTML para Klaviyo / Mailchimp con CTA principal y secundario.",
  useCase: "email_marketing",
  systemPrompt: `Eres un email marketer senior especializado en e-commerce DTC (Klaviyo, Mailchimp). Escribes emails que la gente abre (asuntos < 50 chars, preheader complementario), lee (cuerpo escaneable, párrafos cortos, un solo CTA principal arriba) y convierten (CTA específico + scarcity natural). Devuelves SIEMPRE JSON estricto.`,
  userTemplate: `Email para la secuencia: {{FLOW_TYPE}} (welcome / abandoned_cart / win_back / post_purchase / launch)
Marca: {{BRAND}}
Producto/Promo principal: {{PRODUCT}}
Audiencia: {{AUDIENCE}}
Tono: {{TONE}}
Idioma: {{LANGUAGE}}
Discount/Incentive (opcional): {{INCENTIVE}}

Devuelve JSON:
{
  "subject": "asunto (max 50 chars, sin spam-words)",
  "preheader": "preheader complementario (max 90 chars, no repite el subject)",
  "previewText": "primera línea visible en inbox",
  "bodyHtml": "<table cellpadding=0 cellspacing=0 width=100% style='font-family: Inter, Arial, sans-serif; max-width: 600px;'><tr><td>... HTML responsive con un H1, 2-3 párrafos cortos, CTA principal en botón, opcional CTA secundario en texto, footer con dirección física y unsubscribe (placeholder).</td></tr></table>",
  "ctaPrimary": { "label": "...", "href": "{{CTA_URL}}" },
  "ctaSecondary": { "label": "...", "href": "..." },
  "abTestSubjectAlt": "asunto alternativo para A/B test"
}

REGLAS:
- Subject < 50 chars, sin "GRATIS!!", sin emojis abusivos.
- Cuerpo escaneable (párrafos < 3 líneas).
- Mobile-first (max-width 600px).
- 1 CTA principal arriba del scroll, opcional secundario abajo.`,
  variables: ["FLOW_TYPE", "BRAND", "PRODUCT", "AUDIENCE", "TONE", "LANGUAGE", "INCENTIVE", "CTA_URL"],
};

// ─── 9) Landing Page Hero (nuevo)
const SEED_LANDING_HERO: PromptSeed = {
  name: "🚀 Landing page hero — H1, sub-headline, CTA, social proof",
  description: "CRO copywriter. Genera el bloque hero de una landing con value prop clara, sub-headline, CTA principal, urgencia y social proof.",
  useCase: "landing_hero",
  systemPrompt: `Eres un CRO (conversion rate optimization) copywriter elite que ha escrito landings para Stripe, Notion, Linear y Webflow. Tus headlines son específicos (no abstractos), benefit-driven (no feature-driven), con números siempre que sea posible. Devuelves JSON estricto.`,
  userTemplate: `Landing hero para:
Producto/SaaS: {{PRODUCT}}
Marca: {{BRAND}}
Categoría: {{CATEGORY}}
Audiencia exacta: {{AUDIENCE}}
Problema que resuelve: {{PROBLEM}}
Diferenciador (USP): {{USP}}
Plan de pricing: {{PRICING}}
Idioma: {{LANGUAGE}}
Tono: {{TONE}}

Devuelve JSON:
{
  "h1": "Headline principal (5-10 palabras, benefit-driven, específico)",
  "h1Variants": ["3 alternativas para A/B testing"],
  "subHeadline": "Sub-headline 12-20 palabras que explica el cómo y para quién",
  "ctaPrimary": "Texto botón principal (2-4 palabras, verbo de acción)",
  "ctaSecondary": "Texto link secundario (ej: 'Ver demo', 'Cómo funciona')",
  "socialProof": "Una línea de social proof concreto (número de usuarios / testimonio breve / logos)",
  "urgencyHook": "Línea opcional de urgencia (limitado, lanzamiento, etc.)",
  "bullets": ["bullet 1 — beneficio + métrica", "bullet 2 — beneficio + métrica", "bullet 3 — beneficio + métrica"]
}

REGLAS:
- H1 NO genérico ("la mejor herramienta…" prohibido); usa números, mecanismo o comparación.
- subHeadline responde: ¿qué hace? + ¿para quién? + ¿cómo de rápido/fácil?
- CTA verbo de acción ("Crear mi cuenta gratis" > "Empezar").`,
  variables: ["PRODUCT", "BRAND", "CATEGORY", "AUDIENCE", "PROBLEM", "USP", "PRICING", "LANGUAGE", "TONE"],
};

// ─── 10) UGC Auténtico (nuevo, basado en STYLE_PRESETS.ugc-iphone)
const SEED_UGC_VIDEO: PromptSeed = {
  name: "📱 UGC auténtico (creator iPhone / TikTok hablado)",
  description: "Guionista UGC. Genera script para creator hablado a cámara estilo iPhone candid: hook problema → demo producto → reacción genuina → CTA suave.",
  useCase: "ugc_video",
  systemPrompt: `Eres un guionista de contenido UGC (User Generated Content) de alta conversión para Meta y TikTok Ads. Sabes que los UGC ganadores parecen vídeos reales de un amigo recomendando algo, NO un anuncio pulido. Tono coloquial, frases cortas, una idea por shot. Devuelves SIEMPRE JSON estricto.`,
  userTemplate: `Genera un guion UGC para:
Producto: {{PRODUCT}}
Marca: {{BRAND}}
Categoría: {{CATEGORY}}
Audiencia (avatar concreto): {{AUDIENCE}}
Problema/dolor que resuelve: {{PROBLEM}}
Hook angle: {{HOOK_ANGLE}} (problema | sorpresa | ritual | reacción genuina | comparación)
Duración objetivo: {{DURATION_SEC}}s
Idioma: {{LANGUAGE}}

Devuelve JSON:
{
  "title": "...",
  "hookFirstFrame": "Frame 0: lo que se ve y se oye en el primer segundo",
  "scenes": [
    {
      "idx": 1,
      "secs": "0-3",
      "what_creator_says": "Lo que el creator dice a cámara (palabras EXACTAS, casual)",
      "what_we_see": "Lo que la cámara muestra (B-roll, producto, gesto)",
      "broll_idea": "Sugerencia de shot adicional opcional"
    }
  ],
  "ctaSpoken": "Frase final hablada por el creator (NO 'compra ya' — algo natural tipo 'el link te lo dejo en bio')",
  "captionSuggestion": "Caption para el post (con 3-5 hashtags relevantes, no spammy)"
}

REGLAS:
- Frases cortas, contracciones, "rollo amigo".
- Sin palabras de marketing ("revolucionario", "cambia tu vida", "increíble").
- Una idea por shot. Cortes cada 2-4s.
- El producto se MUESTRA en uso, no se describe.`,
  variables: ["PRODUCT", "BRAND", "CATEGORY", "AUDIENCE", "PROBLEM", "HOOK_ANGLE", "DURATION_SEC", "LANGUAGE"],
};

export const PROMPT_LIBRARY_SEEDS: PromptSeed[] = [
  SEED_AD_CINEMATIC,
  SEED_HERO_PRODUCT,
  SEED_MULTISHOT_DIRECTOR,
  SEED_AD_COPY_META,
  SEED_INFOGRAPHIC,
  SEED_SEO_PRODUCT,
  SEED_BRAND_KIT_OCR,
  SEED_EMAIL_MARKETING,
  SEED_LANDING_HERO,
  SEED_UGC_VIDEO,
];

const SEED_PREFIX = "seed:";

/**
 * Insert all seeds idempotently. We mark each seed row with id "seed:<useCase>"
 * so that re-seeding doesn't duplicate. If a row with the same id exists, skip.
 * Returns the number of newly inserted rows.
 */
export async function seedPromptLibrary(): Promise<{ inserted: number; total: number }> {
  let inserted = 0;
  for (const seed of PROMPT_LIBRARY_SEEDS) {
    const id = `${SEED_PREFIX}${seed.useCase}`;
    const [existing] = await db
      .select({ id: omnicorePromptLibraryTable.id })
      .from(omnicorePromptLibraryTable)
      .where(eq(omnicorePromptLibraryTable.id, id))
      .limit(1);
    if (existing) continue;

    await db.insert(omnicorePromptLibraryTable).values({
      id,
      name: seed.name,
      description: seed.description,
      niche: seed.niche || null,
      useCase: seed.useCase,
      promptTemplate: JSON.stringify({
        systemPrompt: seed.systemPrompt,
        userTemplate: seed.userTemplate,
      }),
      variables: JSON.stringify(seed.variables),
      avgQualityScore: 1.0,
      useCount: 0,
      createdBy: "system:seed",
      isPublic: 1,
    });
    inserted++;
  }
  const all = await db.select({ id: omnicorePromptLibraryTable.id }).from(omnicorePromptLibraryTable);
  return { inserted, total: all.length };
}

/**
 * Convenience: ensures the seed prompts exist. Safe to call on every Prompt
 * Lab open — it short-circuits if all seed ids are already present.
 */
export async function ensureSeedsExist(): Promise<void> {
  const seedIds = PROMPT_LIBRARY_SEEDS.map(s => `${SEED_PREFIX}${s.useCase}`);
  const existing = await db
    .select({ id: omnicorePromptLibraryTable.id })
    .from(omnicorePromptLibraryTable);
  const existingIds = new Set(existing.map(r => r.id));
  const missing = seedIds.filter(id => !existingIds.has(id));
  if (missing.length === 0) return;
  await seedPromptLibrary();
}
