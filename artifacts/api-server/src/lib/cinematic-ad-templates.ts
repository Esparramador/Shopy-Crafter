// ═══════════════════════════════════════════════════════════════════════════
// CINEMATIC AD TEMPLATES — Plantillas multi-segmento "Masterpiece"
// ═══════════════════════════════════════════════════════════════════════════
// Biblioteca de guiones cinematográficos profesionales (estilo Pollo AI / Kling /
// Seedance) que cubre los conceptos: Deconstrucción (Exploded View), Construcción
// (Magnetic Assembly Time-Lapse), Anatomía Completa (4-segmento incluyendo
// try-on), y Estilo Apple / Porsche / Richard Mille (PBR + cámara cinematográfica).
//
// Estos templates se siembran en omnicore_prompt_library con prefix
// "seed:cinematic_ad_*" y son consumidos por:
//   1. GET /api/fs-pro/cinematic-templates             (catálogo visual)
//   2. POST /api/fs-pro/cinematic-templates/:id/compose (rellena con producto real)
//   3. POST /api/fs-pro/cinematic-multishot             (genera vídeo real)
//
// Cada template define una estructura COMPLETA de CinematicScript:
//   - concept:       título conceptual (ej. "La Anatomía del Tiempo")
//   - segments[]:    cada uno con keyframePrompt + videoPrompt + screenText + audioCue
//   - masterConfig:  modelo IA recomendado, motion score, aspect, negative prompt
//
// Las variables {{PRODUCT_NAME}}, {{PRODUCT_MATERIALS}}, {{PRODUCT_COLORS}},
// {{BRAND}}, {{INDUSTRY}} se sustituyen al componer el preview con un producto
// real importado de Shopify.
// ═══════════════════════════════════════════════════════════════════════════

import { db, omnicorePromptLibraryTable } from "@workspace/db";
import { eq, inArray } from "drizzle-orm";
import {
  CINEMATOGRAPHY_PRESETS,
  CONTINUITY_TOKENS,
  NEGATIVE_PROMPT_LIBRARY,
  type CinematographyIntent,
  type IndustrySegment,
} from "./cinematic-knowledge-base";

export type CinematicTemplateCategory =
  | "deconstruction"
  | "construction"
  | "anatomy"
  | "exploded_view"
  | "apple_porsche"
  | "presenter_hybrid"
  | "lifestyle"
  | "personal_brand"
  | "action_pulse";

export interface CinematicTemplateSegment {
  /** Position in the timeline (1..N) */
  idx: number;
  /** Internal label for the segment */
  name: string;
  /** Seconds offset within the ad */
  startSec: number;
  endSec: number;
  /** Visual effect description in plain Spanish (for the UI preview) */
  effectDescription: string;
  /**
   * Keyframe prompt template (English, professional). The first frame the
   * image model will generate. Uses placeholders {{PRODUCT_NAME}}, etc.
   */
  keyframePrompt: string;
  /**
   * Video prompt template (English). Drives the per-clip motion model
   * (Kling / Seedance / Runway).
   */
  videoPrompt: string;
  /** On-screen text shown during the segment (Spanish, branded). */
  screenText: string;
  /** Brief audio direction (sound design + music). */
  audioCue: string;
  /**
   * Optional shot type. "presenter" = host on camera; "b_roll"/"product" =
   * product-only. Used by the engine to decide whether to apply the
   * character (presenter) lock for this specific scene.
   */
  shotType?: "presenter" | "b_roll" | "product";
  /**
   * Optional voiceover line (the long sentence the presenter actually says).
   * Distinct from screenText (which is a short overlay/CTA). When the
   * template is rendered with narration enabled, this string is used as the
   * scene's voiceoverLine.
   */
  voiceoverLine?: string;
}

export interface CinematicTemplateMasterConfig {
  /** Recommended video model id (matches VideoModel union in fusion-studio-pro). */
  recommendedVideoModel: string;
  /** Recommended image model for keyframes. */
  recommendedImageModel: string;
  /** 9:16 (vertical Reels/TikTok) | 16:9 (cinematográfico) | 1:1. */
  defaultAspect: "9:16" | "16:9" | "1:1";
  /** Motion intensity score (1-10). 5 = elegant. */
  motionScore: number;
  /** Unified negative prompt applied to every clip. */
  negativePrompt: string;
  /** "luxury" | "cinematic" | "editorial" | etc. */
  styleTag: string;
  /**
   * When true, this template needs a presenter (host avatar) image + a
   * narration voice to render correctly. The UI will show the presenter
   * upload + voice config block. Default false (product-only template).
   */
  requiresPresenter?: boolean;
  /**
   * Optional default presenter description used as identityPrompt when no
   * custom presenter is uploaded. The platform always lets the user
   * override this with their own face/style.
   */
  defaultPresenterPrompt?: string;
}

export interface CinematicAdTemplate {
  id: string;                        // seed:cinematic_ad_<category>
  category: CinematicTemplateCategory;
  name: string;                      // Visible (Spanish)
  shortDescription: string;          // Catálogo
  longDescription: string;           // Ficha técnica
  conceptName: string;               // ej. "La Anatomía del Tiempo"
  totalDurationSec: number;
  segments: CinematicTemplateSegment[];
  masterConfig: CinematicTemplateMasterConfig;
  variables: string[];               // Variables que el compositor debe rellenar
  /** Reference to the inspiration brand (Apple / Rolex / Porsche / Richard Mille). */
  inspirationReference?: string;
  /** Costs as a multiple of the multi-shot base cost (used in UI estimate). */
  estimatedCreditsHint?: number;
}

// ─── 1) Anatomía del Tiempo (4 segmentos × 5s = 20s) — el guión que pidió el usuario
const TPL_ANATOMY: CinematicAdTemplate = {
  id: "seed:cinematic_ad_anatomy",
  category: "anatomy",
  name: "🕰️ Anatomía Completa (4 segmentos × 5s)",
  shortDescription: "Deconstrucción → Corazón Mecánico → Re-construcción → Try-On Hero. 20s totales.",
  longDescription: "Guion técnico de nivel masterpiece. El producto se desintegra elegantemente, revela su mecanismo interno, se vuelve a ensamblar con destellos y termina con el producto en uso por una persona real. Diseñado para concatenarse perfectamente sin saltos visuales. Inspirado en comerciales de Rolex, Patek Philippe y Apple.",
  conceptName: "La Anatomía del {{PRODUCT_NAME}}",
  totalDurationSec: 20,
  inspirationReference: "Rolex Datejust 41mm (champagne diamond + Rolesor)",
  estimatedCreditsHint: 14,
  segments: [
    {
      idx: 1,
      name: "La Deconstrucción",
      startSec: 0,
      endSec: 5,
      effectDescription: "El producto se desintegra de forma controlada y elegante desde el centro hacia afuera.",
      keyframePrompt:
        "Extreme macro cinematic shot of a {{PRODUCT_NAME}} from {{BRAND}}, " +
        "{{PRODUCT_MATERIALS}} in {{PRODUCT_COLORS}}. The product begins to deconstruct, " +
        "with each component starting to detach in slow motion. Microscopic mechanical " +
        "internals and metallic dust particles begin floating in a zero-gravity vacuum. " +
        "Volumetric soft lighting, deep shadows, photorealistic textures, hyper-detailed " +
        "PBR materials, shot on RED Komodo with macro lens, 8k, Octane render quality.",
      videoPrompt:
        "The {{PRODUCT_NAME}} dramatically deconstructs in slow motion, components " +
        "detaching one by one and floating outward in zero gravity. Camera slowly orbits " +
        "around the suspended pieces. Volumetric lighting reveals each detail. Subtle " +
        "metallic dust particles drift through the frame. Cinematic depth of field, " +
        "high-end advertising aesthetic. NO TEXT in the video.",
      screenText: "La perfección…",
      audioCue: "Sonido de succión de aire (vacuum) → tintineo metálico cristalino sutil.",
    },
    {
      idx: 2,
      name: "El Corazón Mecánico",
      startSec: 5,
      endSec: 10,
      effectDescription: "Foco en el mecanismo interno y los materiales premium del producto.",
      keyframePrompt:
        "Hyper-detailed macro close-up of the inner mechanism of a {{PRODUCT_NAME}}. " +
        "Premium {{PRODUCT_MATERIALS}} in {{PRODUCT_COLORS}} fill the frame with " +
        "precision-engineered components. Caustic light reflections shimmer across " +
        "polished surfaces. Macro lens at f/2.8 with creamy bokeh. Luxury aesthetic, " +
        "high-speed cinematography, dust motes catching the light, museum-quality detail.",
      videoPrompt:
        "Slow precision rotation of the {{PRODUCT_NAME}}'s internal anatomy. Premium " +
        "components rotate with mechanical precision. Light caustics dance across " +
        "{{PRODUCT_COLORS}} surfaces. Shimmering particles float in shallow focus. " +
        "Camera performs a slow push-in revealing engineering depth. Luxury commercial " +
        "production. NO TEXT in the video.",
      screenText: "…reside en el interior.",
      audioCue: "Latido mecánico rítmico (tic-tac) que aumenta de intensidad.",
    },
    {
      idx: 3,
      name: "La Re-construcción",
      startSec: 10,
      endSec: 15,
      effectDescription: "Las piezas vuelan magnéticamente al centro y se ensamblan con destellos de luz.",
      keyframePrompt:
        "Cinematic assembly moment of a {{PRODUCT_NAME}} from {{BRAND}}. Components " +
        "made of {{PRODUCT_MATERIALS}} in {{PRODUCT_COLORS}} fly inward from off-screen, " +
        "snapping into place with magnetic precision. Intense anamorphic light flares " +
        "sweep across the metallic surfaces. Metallic sparks and glowing dust trail each " +
        "component. High-end commercial production, 8k Octane render, photorealistic.",
      videoPrompt:
        "Hyper-realistic assembly time-lapse of the {{PRODUCT_NAME}}. Components fly " +
        "into place from off-screen, locking together with audible magnetic snap. " +
        "Anamorphic light flares whip across the surface. Sparks and luminous dust " +
        "trail each piece. Camera slowly retreats as assembly completes. Premium " +
        "advertising aesthetic, sharp focus, metallic reflections. NO TEXT in the video.",
      screenText: "Ingeniería Eterna.",
      audioCue: "Sonidos metálicos pesados (\"clack\") sincronizados con el ensamblaje.",
    },
    {
      idx: 4,
      name: "Hero Shot / Try-On",
      startSec: 15,
      endSec: 20,
      effectDescription: "El producto terminado aparece en uso por una persona real, en contexto premium.",
      keyframePrompt:
        "Seamless transition to the finished {{PRODUCT_NAME}} from {{BRAND}} being used " +
        "naturally by a person. {{INDUSTRY}} setting with golden-hour natural lighting. " +
        "The {{PRODUCT_MATERIALS}} reflects warm sunset tones through a window. Soft " +
        "bokeh background, luxury lifestyle photography, cinematic color grading, " +
        "shallow depth of field, Cooke S4 anamorphic lens character.",
      videoPrompt:
        "The {{PRODUCT_NAME}} is now in use by a person in a premium {{INDUSTRY}} " +
        "setting. Natural human movement showcases the product. Sunset light bathes " +
        "the {{PRODUCT_MATERIALS}} surface. Camera holds steady with subtle parallax. " +
        "Soft bokeh background. Cinematic color grading, luxury lifestyle aesthetic. " +
        "NO TEXT in the video.",
      screenText: "{{PRODUCT_NAME}}. El icono. — {{BRAND}}",
      audioCue: "Música orquestal épica que alcanza su clímax y se desvanece.",
    },
  ],
  masterConfig: {
    recommendedVideoModel: "kling-3.0-turbo",
    recommendedImageModel: "flux-1.1-pro",
    defaultAspect: "9:16",
    motionScore: 5,
    negativePrompt:
      "low quality, blurry, distorted text, plastic look, deformed hands, messy background, " +
      "shaky motion, cartoonish, low resolution, watermark, signature, ugly, amateur",
    styleTag: "luxury",
  },
  variables: ["PRODUCT_NAME", "BRAND", "PRODUCT_MATERIALS", "PRODUCT_COLORS", "INDUSTRY"],
};

// ─── 2) Pure Deconstruction (1 segment, 5s) — exploded view sin re-ensamblaje
const TPL_DECONSTRUCTION: CinematicAdTemplate = {
  id: "seed:cinematic_ad_deconstruction",
  category: "deconstruction",
  name: "💥 Deconstrucción Pura (Exploded View · 5s)",
  shortDescription: "El producto explota en cámara lenta revelando su ingeniería. Single-shot dramático.",
  longDescription: "Single-shot de 5 segundos donde el producto se desensambla en exploded view, ideal como hook inicial de un anuncio o como contenido para Reels. Las piezas flotan en zero-gravity revelando la calidad y complejidad de la ingeniería. Inspirado en el estilo de Apple keynote technical reveals.",
  conceptName: "Anatomy of {{PRODUCT_NAME}}",
  totalDurationSec: 5,
  inspirationReference: "Apple iPhone exploded view + Porsche engine reveal",
  estimatedCreditsHint: 5,
  segments: [
    {
      idx: 1,
      name: "Exploded View",
      startSec: 0,
      endSec: 5,
      effectDescription: "El producto explota controladamente en sus piezas componentes en cámara lenta.",
      keyframePrompt:
        "Macro exploded view of a {{PRODUCT_NAME}} from {{BRAND}}, made of " +
        "{{PRODUCT_MATERIALS}} in {{PRODUCT_COLORS}}. Components detach in slow motion " +
        "and float in 3D space arranged in a precise technical schematic. High-tech " +
        "studio lighting with rim light separating each part. Dark seamless background, " +
        "professional product photography aesthetic, 8k, Octane render, hyper-detailed " +
        "PBR materials, shot on Phase One IQ4.",
      videoPrompt:
        "The {{PRODUCT_NAME}} performs a slow cinematic deconstruction. Each component " +
        "of {{PRODUCT_MATERIALS}} detaches with elegant slow motion and drifts outward " +
        "in zero gravity. Camera slowly orbits 30 degrees revealing the engineering. " +
        "Volumetric lighting catches metallic surfaces. Subtle dust particles drift. " +
        "Premium product reveal aesthetic, commercial-grade. NO TEXT in the video.",
      screenText: "{{BRAND}} — {{PRODUCT_NAME}}",
      audioCue: "Whoosh aéreo + tintineo cristalino sutil + base ambient cinematográfica.",
    },
  ],
  masterConfig: {
    recommendedVideoModel: "kling-3.0-turbo",
    recommendedImageModel: "flux-1.1-pro",
    defaultAspect: "9:16",
    motionScore: 5,
    negativePrompt:
      "low quality, blurry, distorted text, plastic look, messy background, " +
      "shaky motion, cartoonish, low resolution, watermark, ugly",
    styleTag: "cinematic",
  },
  variables: ["PRODUCT_NAME", "BRAND", "PRODUCT_MATERIALS", "PRODUCT_COLORS"],
};

// ─── 3) Pure Construction (1 segment, 5s) — magnetic assembly time-lapse
const TPL_CONSTRUCTION: CinematicAdTemplate = {
  id: "seed:cinematic_ad_construction",
  category: "construction",
  name: "🧲 Construcción Mágica (Magnetic Assembly · 5s)",
  shortDescription: "Las piezas vuelan al centro y forman el producto con destellos. Time-lapse de ensamblaje.",
  longDescription: "Inverso del exploded view: las piezas componentes vuelan magnéticamente desde fuera de cámara y se ensamblan con destellos para revelar el producto terminado. Ideal como reveal final o como teaser de lanzamiento. El último frame es el producto íntegro, perfecto para encadenar con un hero shot.",
  conceptName: "The Making of {{PRODUCT_NAME}}",
  totalDurationSec: 5,
  inspirationReference: "Apple AirPods reveal + Tesla part assembly",
  estimatedCreditsHint: 5,
  segments: [
    {
      idx: 1,
      name: "Magnetic Assembly",
      startSec: 0,
      endSec: 5,
      effectDescription: "Las piezas vuelan desde fuera de cámara y se ensamblan magnéticamente con destellos.",
      keyframePrompt:
        "Cinematic time-lapse moment of a {{PRODUCT_NAME}} from {{BRAND}} mid-assembly. " +
        "Premium components made of {{PRODUCT_MATERIALS}} in {{PRODUCT_COLORS}} fly inward " +
        "from off-screen and snap into place with magnetic precision. Anamorphic light " +
        "flares sweep across each surface as it locks. Metallic sparks and glowing dust " +
        "trail every component. Dark seamless studio background, 8k, photorealistic, " +
        "Octane render quality, premium advertising aesthetic.",
      videoPrompt:
        "Hyper-realistic assembly time-lapse of the {{PRODUCT_NAME}}. Components fly " +
        "into frame from all directions and lock into the body with magnetic precision. " +
        "Anamorphic light flares whip across surfaces. Sparks and luminous dust trail " +
        "each piece. Camera holds steady with a subtle slow push-in. Sharp focus, " +
        "metallic reflections, premium product reveal. NO TEXT in the video.",
      screenText: "Ingeniería en cada detalle.",
      audioCue: "Clicks magnéticos pesados sincronizados + crescendo orquestal corto.",
    },
  ],
  masterConfig: {
    recommendedVideoModel: "kling-3.0-turbo",
    recommendedImageModel: "flux-1.1-pro",
    defaultAspect: "9:16",
    motionScore: 6,
    negativePrompt:
      "low quality, blurry, distorted text, plastic look, messy background, " +
      "shaky motion, cartoonish, low resolution, watermark, ugly",
    styleTag: "cinematic",
  },
  variables: ["PRODUCT_NAME", "BRAND", "PRODUCT_MATERIALS", "PRODUCT_COLORS"],
};

// ─── 4) Exploded View Tech-Spec (2 segmentos × 5s) — schematic reveal
const TPL_EXPLODED_VIEW: CinematicAdTemplate = {
  id: "seed:cinematic_ad_exploded_view",
  category: "exploded_view",
  name: "📐 Exploded View Técnico (Reveal + Re-assembly · 10s)",
  shortDescription: "Schematic 3D explota → componentes etiquetables → re-ensamblaje suave. 10s.",
  longDescription: "Estilo CAD/blueprint cinematográfico: las piezas se separan formando un layout técnico ordenado, perfecto para producto tech, joyería de precisión, calzado deportivo o equipo industrial. El segundo segmento las re-ensambla limpiamente. Inspirado en presentaciones de producto de Dyson, Bose y Specialized.",
  conceptName: "{{PRODUCT_NAME}} — Engineered to Perfection",
  totalDurationSec: 10,
  inspirationReference: "Dyson airblade + Bose QC schematic + Specialized bike reveal",
  estimatedCreditsHint: 8,
  segments: [
    {
      idx: 1,
      name: "Technical Disassembly",
      startSec: 0,
      endSec: 5,
      effectDescription: "El producto se separa en sus componentes formando una composición técnica ordenada.",
      keyframePrompt:
        "Layer-by-layer technical exploded view of a {{PRODUCT_NAME}} from {{BRAND}}. " +
        "{{PRODUCT_MATERIALS}} components in {{PRODUCT_COLORS}} arranged in a precise " +
        "schematic layout floating in 3D space. Each layer separated by uniform spacing " +
        "as if in a technical blueprint. Studio softbox lighting from above, dark " +
        "matte background, ultra-clean composition, 8k, Octane render, photorealistic " +
        "PBR materials, blueprint-meets-product-photography aesthetic.",
      videoPrompt:
        "The {{PRODUCT_NAME}} cleanly disassembles into a technical exploded view. " +
        "Components separate vertically and horizontally in slow synchronized motion " +
        "forming a schematic layout. Each piece settles into position with precision. " +
        "Camera slowly pulls back revealing the full layout. Clean studio lighting, " +
        "minimalist aesthetic. NO TEXT in the video.",
      screenText: "Engineering. Visualised.",
      audioCue: "Clicks técnicos sutiles + base ambient minimalista.",
    },
    {
      idx: 2,
      name: "Re-Assembly",
      startSec: 5,
      endSec: 10,
      effectDescription: "Los componentes regresan con suavidad y se ensamblan formando el producto final.",
      keyframePrompt:
        "Cinematic re-assembly of a {{PRODUCT_NAME}} from {{BRAND}}. {{PRODUCT_MATERIALS}} " +
        "components in {{PRODUCT_COLORS}} smoothly converge from their schematic positions " +
        "back to the assembled product. Crisp studio lighting, dark matte background, " +
        "minimalist clean aesthetic, 8k, photorealistic PBR materials, sharp focus on " +
        "every micro-detail.",
      videoPrompt:
        "The exploded {{PRODUCT_NAME}} components glide smoothly back together, " +
        "assembling the final product with precision and elegance. Camera performs a " +
        "subtle dolly-in as the product completes. Clean studio lighting, minimalist, " +
        "premium tech aesthetic. NO TEXT in the video.",
      screenText: "{{BRAND}} — {{PRODUCT_NAME}}",
      audioCue: "Clicks técnicos + crescendo limpio + sello sonoro de marca.",
    },
  ],
  masterConfig: {
    recommendedVideoModel: "kling-3.0-turbo",
    recommendedImageModel: "flux-1.1-pro",
    defaultAspect: "16:9",
    motionScore: 4,
    negativePrompt:
      "low quality, blurry, distorted text, plastic look, messy background, " +
      "shaky motion, cartoonish, low resolution, watermark, busy background",
    styleTag: "editorial",
  },
  variables: ["PRODUCT_NAME", "BRAND", "PRODUCT_MATERIALS", "PRODUCT_COLORS"],
};

// ─── 5) Apple / Porsche / Richard Mille — high-end PBR cinematography
const TPL_APPLE_PORSCHE: CinematicAdTemplate = {
  id: "seed:cinematic_ad_apple_porsche",
  category: "apple_porsche",
  name: "🏎️ Estilo Apple / Porsche / Richard Mille (3 segmentos × 5s)",
  shortDescription: "Macro PBR + dirección fotográfica de comerciales premium. 15s.",
  longDescription: "El máximo nivel de producción: cámara con inercia cinematográfica, luz que baña el metal, polvo flotando con elegancia. Cada plano sigue convenciones de cinematografía de gama alta (Cooke anamorphic, sunset rim light, slow parallax). Adaptado para producto premium, joyería, automoción, electrónica de lujo. Inspirado en comerciales de Apple, Porsche y Richard Mille.",
  conceptName: "{{PRODUCT_NAME}} — Crafted",
  totalDurationSec: 15,
  inspirationReference: "Apple iPhone Pro reveal + Porsche 911 commercial + Richard Mille tourbillon",
  estimatedCreditsHint: 11,
  segments: [
    {
      idx: 1,
      name: "Surface Caress",
      startSec: 0,
      endSec: 5,
      effectDescription: "Macro extremo: la cámara recorre la superficie del producto sintiendo cada textura.",
      keyframePrompt:
        "Extreme macro cinematic shot of a {{PRODUCT_NAME}} from {{BRAND}}. " +
        "{{PRODUCT_MATERIALS}} in {{PRODUCT_COLORS}} fills the frame with hyper-detailed " +
        "PBR texture. Cooke S4 anamorphic lens character, sunset rim light from camera " +
        "right, deep matte black background, dust motes catching warm light. Color graded " +
        "for cinematic warmth. 8k, Octane render, photorealistic, museum-quality detail. " +
        "Style reference: Apple Pro reveal, Porsche commercial, Richard Mille tourbillon.",
      videoPrompt:
        "Camera performs a slow macro caress across the surface of the {{PRODUCT_NAME}}. " +
        "Light slowly travels across {{PRODUCT_MATERIALS}} surfaces revealing micro-textures. " +
        "Subtle parallax with cinematic inertia. Dust particles drift through warm rim " +
        "light. High-end commercial cinematography. NO TEXT in the video.",
      screenText: "",
      audioCue: "Pad sintético cálido + brisa sutil + reverb de cinema.",
    },
    {
      idx: 2,
      name: "Hero Reveal",
      startSec: 5,
      endSec: 10,
      effectDescription: "Pull-back revelando el producto entero con dirección de luz cinematográfica.",
      keyframePrompt:
        "Hero cinematic reveal of a {{PRODUCT_NAME}} from {{BRAND}}. The complete product " +
        "made of {{PRODUCT_MATERIALS}} in {{PRODUCT_COLORS}} centred in frame, three-point " +
        "lighting (key 5600K, fill 4200K, rim 3200K with warm sunset hue). Deep black " +
        "matte background with subtle gradient. Anamorphic depth of field, premium " +
        "advertising composition, 8k, photorealistic, Cooke anamorphic character.",
      videoPrompt:
        "Slow cinematic pull-back revealing the complete {{PRODUCT_NAME}}. Camera moves " +
        "with smooth inertia. Three-point lighting catches every premium detail. " +
        "Anamorphic flares whip subtly across {{PRODUCT_COLORS}} surfaces. The product " +
        "sits centred in elegant composition. NO TEXT in the video.",
      screenText: "Crafted, not assembled.",
      audioCue: "Crescendo orquestal contenido + golpe de timbal en frame final.",
    },
    {
      idx: 3,
      name: "Brand Mark",
      startSec: 10,
      endSec: 15,
      effectDescription: "Plano de cierre con el producto en negro absoluto y la marca minimalista.",
      keyframePrompt:
        "Final brand mark composition: {{PRODUCT_NAME}} from {{BRAND}} on a deep matte " +
        "black background. {{PRODUCT_MATERIALS}} in {{PRODUCT_COLORS}} catches a single " +
        "directional light source. Minimalist composition with negative space. Premium " +
        "luxury advertising aesthetic, 8k, Cooke anamorphic, photorealistic.",
      videoPrompt:
        "The {{PRODUCT_NAME}} sits in elegant stillness against deep black. Subtle " +
        "rim light slowly moves across the surface. Minimal motion, maximum premium " +
        "feel. Camera holds steady. Brand-defining final shot. NO TEXT in the video.",
      screenText: "{{BRAND}}",
      audioCue: "Pad sostenido suave + sello sonoro de marca al cerrar.",
    },
  ],
  masterConfig: {
    recommendedVideoModel: "kling-3.0-turbo",
    recommendedImageModel: "flux-1.1-pro",
    defaultAspect: "16:9",
    motionScore: 4,
    negativePrompt:
      "low quality, blurry, distorted text, plastic look, messy background, " +
      "shaky motion, cartoonish, low resolution, watermark, ugly, amateur, busy",
    styleTag: "luxury",
  },
  variables: ["PRODUCT_NAME", "BRAND", "PRODUCT_MATERIALS", "PRODUCT_COLORS"],
};

// ─── 6) Presenter Hybrid — Luxury Watch (5 segmentos = 22s)
//      Guion exacto: 3 planos presentador (medio + medio + primer plano) +
//      2 B-roll producto (deconstrucción + construcción/try-on). El motor
//      aplica character lock SOLO en escenas presenter; las B-roll son
//      producto puro.
const TPL_PRESENTER_HYBRID: CinematicAdTemplate = {
  id: "seed:cinematic_ad_presenter_hybrid",
  category: "presenter_hybrid",
  name: "🎙️ Presentador Híbrido — Luxury Watch (22s)",
  shortDescription: "5 segmentos: presentador medio → B-roll deconstrucción → B-roll construcción → presentador detalle/try-on → primer plano CTA. Inspirado en Omneky / Apple keynote / Rolex.",
  longDescription: "Formato Tier-1 para anuncios de relojería de lujo. Combina la autoridad de un presentador (host avatar) hablando a cámara con B-roll técnico cinematográfico del producto. Cada segmento tiene su voiceoverLine sincronizado con el motor TTS de ElevenLabs. El character lock se aplica SOLO a las escenas de presentador (idx 1, 4, 5); las B-roll (idx 2, 3) son producto puro sin la cara del host. Diseñado para Rolex Datejust 41mm pero parametrizado por variables Shopify.",
  conceptName: "{{PRODUCT_NAME}} — Presentado por {{BRAND}}",
  totalDurationSec: 22,
  inspirationReference: "Rolex Datejust 41mm Presenter Hybrid (Omneky/Apple keynote style)",
  estimatedCreditsHint: 17,
  segments: [
    {
      idx: 1,
      name: "Presentador (Medio) — Hook",
      startSec: 0,
      endSec: 3,
      shotType: "presenter",
      effectDescription: "Plano medio del presentador en boutique de lujo desenfocada, mirando a cámara con autoridad y sutil sonrisa. Apertura del anuncio.",
      keyframePrompt: "Medium shot of a charismatic 30-year-old male executive in a tailored charcoal grey suit and crisp white shirt, standing inside a softly blurred luxury watch boutique with warm amber boutique lighting in the background, looking directly into camera with confident calm authority and a subtle warm smile. Shot on 85mm at f/2, shallow depth of field separating presenter from boutique bokeh, Rembrandt 45-degree key light + soft rim, photorealistic 8K skin textures with natural pores, cinematic warm gold grade with crushed shadows, museum-quality portrait lighting, no on-screen text",
      videoPrompt: "The executive maintains a steady confident gaze at camera; subtle natural micro-gestures only — slight head tilt, gentle blink, micro smile shift. Camera locked-off on tripod, no movement at all. Subject performs only intimate breathing-level micro-motion within the frame. Boutique bokeh in background remains static. Cinematic warm gold grade preserved",
      voiceoverLine: "Hay objetos que miden el tiempo... y otros que definen quién eres.",
      screenText: "",
      audioCue: "Cinematic warm pad rises subtly under the voiceover; no music peaks until the next segment.",
    },
    {
      idx: 2,
      name: "B-Roll — Deconstrucción Producto",
      startSec: 3,
      endSec: 8,
      shotType: "b_roll",
      effectDescription: "El {{PRODUCT_NAME}} flota en negro absoluto y se deconstruye elegantemente en 200+ piezas microscópicas que orbitan suspendidas en el aire.",
      keyframePrompt: "Ultra-macro hero shot of {{PRODUCT_NAME}} in {{PRODUCT_MATERIALS}} floating in absolute pitch-black void, beginning to deconstruct into 200+ precision-machined micro-components that hang suspended in mid-air around the product like an exploded watchmaker diagram, individual gears bridges and screws visible at jewel-level detail, single hard top-down studio key light creating sharp specular highlights on metal surfaces, Phase One IQ4 medium-format 8K aesthetic, shot on 100mm macro at f/8, deep DOF, neutral analytical grade with warm gold accents, subtle floating dust motes catching backlight, no on-screen text",
      videoPrompt: "Smooth slow-motion deconstruction: components separate radially outward from center in choreographed sequence over 5 seconds, each piece slowly orbiting on its own axis as it drifts, gravity zero, surface tension preserved, Phantom Flex 4K 4000fps slow-motion aesthetic. Camera performs an ultra-slow micro push-in with cinematic inertia, anamorphic streaks crossing highlights. Maintain identical lighting and gold grade for visual continuity",
      voiceoverLine: "El {{PRODUCT_NAME}} no es solo ingeniería; es una sinfonía de 200 piezas en perfecta armonía.",
      screenText: "",
      audioCue: "Deep mechanical micro-tick layered over orchestral pad; subtle glass-shimmer on each component reveal.",
    },
    {
      idx: 3,
      name: "B-Roll — Construcción / Detalle",
      startSec: 8,
      endSec: 13,
      shotType: "b_roll",
      effectDescription: "Los componentes se reensamblan magnéticamente; revelación del bisel estriado en {{PRODUCT_MATERIALS}} y la esfera con detalles {{PRODUCT_COLORS}}.",
      keyframePrompt: "Ultra-macro hero shot of {{PRODUCT_NAME}} in {{PRODUCT_MATERIALS}} reassembling: scattered components magnetically snap back into position, final piece locking into place with a satisfying metallic click, fully formed product hero on absolute black void with the {{PRODUCT_COLORS}} dial fully visible, fluted bezel catching warm gold rim-light, jewel-level macro detail on every facet, hexagonal bokeh of distant rim-lights softly behind, shot on 100mm macro at f/2.8, shallow DOF on the dial center, warm gold luxury grade with crushed shadows, single beauty-dish key + amber rim, photorealistic Phase One IQ4 medium-format aesthetic, no on-screen text",
      videoPrompt: "Components fly back inward from the periphery in reverse-deconstruction choreography over 5 seconds, magnetically snapping into final assembled position with satisfying linear interpolation; final piece clicks into place with a micro shock-ring of light radiating outward; camera performs a slow elegant 90-degree macro orbit revealing the fluted bezel and the {{PRODUCT_COLORS}} dial in succession, subtle anamorphic horizontal flare sweeps across the bezel at apex. Maintain identical warm gold grade and lighting setup",
      voiceoverLine: "Desde el bisel estriado en {{PRODUCT_MATERIALS}} hasta su esfera {{PRODUCT_COLORS}}...",
      screenText: "",
      audioCue: "Magnetic snap-clicks rise to a single satisfying chime at the moment of full assembly; orchestral pad swells gently.",
    },
    {
      idx: 4,
      name: "Try-on / Detalle Humano",
      startSec: 13,
      endSec: 18,
      shotType: "b_roll",
      effectDescription: "Plano detalle del {{PRODUCT_NAME}} ya en una muñeca real (try-on lifestyle), bajo luz natural cálida.",
      keyframePrompt: "Extreme close-up insert shot of {{PRODUCT_NAME}} now worn on the wrist of an elegant adult, wrist resting naturally on a dark walnut surface with warm boutique ambient light spilling from the side, fluted bezel catching the warm directional key light, {{PRODUCT_COLORS}} dial perfectly readable, skin texture and fine wrist hair photographically rendered with natural realism, no face visible (hand and wrist only), shot on 100mm macro at f/2.8 shallow DOF, warm gold luxury grade with crushed shadows, soft caustic light highlights dancing across the bezel, no on-screen text",
      videoPrompt: "The wrist remains naturally still with imperceptible breathing micro-motion; camera performs an ultra-slow probe-lens push-in toward the {{PRODUCT_COLORS}} dial, ending on a perfectly framed extreme close-up of the dial center; warm gold grade preserved; subtle anamorphic flare sweeps once across the bezel as the camera reaches its final position",
      voiceoverLine: "...es el equilibrio exacto entre el legado y la modernidad.",
      screenText: "",
      audioCue: "Soft ambient room-tone with a single warm string sustain; orchestral pad continues underneath.",
    },
    {
      idx: 5,
      name: "Presentador (Primer Plano) — CTA",
      startSec: 18,
      endSec: 22,
      shotType: "presenter",
      effectDescription: "Primer plano del presentador con autoridad calmada cerrando con el llamado a la acción del {{BRAND}}.",
      keyframePrompt: "Tight close-up of the same charismatic 30-year-old male executive in tailored charcoal grey suit, the luxury watch boutique softly blurred behind him with warm amber boutique lighting, looking directly into camera with calm authority and the subtle warm smile of a brand spokesperson making a definitive statement, perfectly groomed dark hair, photorealistic 8K skin textures with natural pores. Shot on 105mm at f/1.8, extreme shallow depth of field, Rembrandt 45-degree key light producing the signature triangle highlight on his cheek + soft rim from behind separating him from the bokeh, warm gold luxury grade with crushed shadows, museum-quality portrait lighting, no on-screen text",
      videoPrompt: "The executive holds a steady confident gaze at camera and delivers the closing line with calm authority; subtle natural micro-gestures only — a single confident nod at the very end, gentle blink. Camera locked-off on tripod, no movement at all. Subject performs only intimate breathing-level micro-motion. Boutique bokeh in background remains static. Warm gold grade preserved with consistent lighting from segment 1",
      voiceoverLine: "{{BRAND}} {{PRODUCT_NAME}}. El icono, ahora en tu muñeca. Hazlo tuyo hoy.",
      screenText: "{{BRAND}}",
      audioCue: "Orchestral pad reaches its full warm sustain, then resolves into a clean single chord on the final word; brand chime closes the spot.",
    },
  ],
  masterConfig: {
    recommendedVideoModel: "kling-3.0-turbo",
    recommendedImageModel: "nano-banana",
    defaultAspect: "16:9",
    motionScore: 4,
    negativePrompt: "deformed dial, distorted hands, missing numerals, crooked bezel, plastic-looking metal, blurry crown, double face, asymmetric lugs, deformed face, asymmetric face, unnatural skin, plastic skin, garbled typography, text artifacts, watermark, low-resolution, cartoon, anime, illustration, double exposure",
    styleTag: "luxury",
    requiresPresenter: true,
    defaultPresenterPrompt: "A charismatic 30-year-old male executive, intelligent confident gaze, subtle warm smile, perfectly groomed dark hair, tailored charcoal grey suit and crisp white shirt, photorealistic 8K skin textures with natural pores, looking directly at camera with the calm authority of a luxury brand spokesperson",
  },
  variables: ["PRODUCT_NAME", "BRAND", "PRODUCT_MATERIALS", "PRODUCT_COLORS"],
};

// ─── 7) Lifestyle Orbit — Universal premium B-roll (3 segmentos = 18s)
//      Para Home / Decor / Fashion / Beauty / Cosmetics / Lifestyle products
//      donde la deconstrucción mecánica no encaja. Movimientos elegantes:
//      slow orbit + dolly-in + parallax pull-back. Sin presentador.
const TPL_LIFESTYLE_ORBIT: CinematicAdTemplate = {
  id: "seed:cinematic_ad_lifestyle_orbit",
  category: "lifestyle",
  name: "🌿 Lifestyle Orbit — Universal Premium B-roll (18s)",
  shortDescription: "3 segmentos: orbit hero → dolly-in detalle → parallax lifestyle. Para hogar, decoración, moda, belleza, cosmética y cualquier producto donde la deconstrucción mecánica no encaja.",
  longDescription: "Plantilla agnóstica de gama alta inspirada en spots Aesop / Le Labo / Vitra. Tres planos consecutivos sin presentador: hero orbit del producto en escena natural, dolly-in macro al detalle hero, parallax pull-back ambient. Funciona para velas, perfumes, sillones, prendas, productos de skincare, accesorios premium. Incluye toda la inteligencia del Knowledge Base (intent fashion, continuity LUT cálido).",
  conceptName: "{{PRODUCT_NAME}} — Crafted by {{BRAND}}",
  totalDurationSec: 18,
  inspirationReference: "Aesop / Le Labo / Vitra / Hermès lifestyle film",
  estimatedCreditsHint: 11,
  segments: [
    {
      idx: 1,
      name: "Hero Orbit",
      startSec: 0,
      endSec: 6,
      shotType: "product",
      effectDescription: "Plano hero del {{PRODUCT_NAME}} sobre superficie natural premium con luz lateral cálida; cámara orbita lentamente 90°.",
      keyframePrompt: "Hero shot of {{PRODUCT_NAME}} in {{PRODUCT_MATERIALS}} with {{PRODUCT_COLORS}} accents, placed on a warm walnut wood or honed marble surface in a softly blurred premium minimalist interior, natural side window light pouring from frame-left at golden-hour temperature creating long elegant shadows extending to frame-right, single key light + subtle bounce fill, atmospheric haze catching the light, shot on 50mm at f/2.8 with shallow depth of field, museum-quality composition with negative space top-right, warm natural cinematic grade, photorealistic Phase One IQ4 medium-format aesthetic, no on-screen text",
      videoPrompt: "Camera performs an ultra-slow 90-degree orbit around the {{PRODUCT_NAME}} from frame-left to behind-center over 6 seconds with cinematic inertia, the warm side light slowly raking across the {{PRODUCT_MATERIALS}} surface revealing texture and craftsmanship, atmospheric haze drifting subtly through the light, the product itself remains perfectly still on its pedestal, museum-quality slow reveal, no jump-cuts, no zoom",
      voiceoverLine: "{{PRODUCT_NAME}}. Hecho para quienes saben que el detalle define el resultado.",
      screenText: "",
      audioCue: "Soft acoustic guitar fingerpicking + warm room-tone; gentle field-recording ambience underneath.",
    },
    {
      idx: 2,
      name: "Macro Detail",
      startSec: 6,
      endSec: 12,
      shotType: "b_roll",
      effectDescription: "Macro extremo del detalle hero del {{PRODUCT_NAME}}: textura, costura, acabado, material o etiqueta — el alma del producto.",
      keyframePrompt: "Extreme macro detail shot of {{PRODUCT_NAME}}, focusing on the signature craftsmanship element (premium {{PRODUCT_MATERIALS}} surface texture, hand-finished edge, embossed brand mark, or fabric weave at thread level), filling the frame with rich tactile detail, single warm directional key light grazing the surface to maximize texture, shot on 100mm macro at f/4 with razor-thin depth of field, warm natural cinematic grade with crushed shadows, individual fibers / pores / grain photographically rendered, no on-screen text",
      videoPrompt: "Camera performs a slow elegant probe-lens dolly-in toward the hero detail over 6 seconds with cinematic inertia, focus pulls smoothly from front to the signature element, the warm directional light slowly shifts angle by a few degrees revealing micro-textures, atmospheric particles drift through the light, no shake, no rotation, pure dolly-in only",
      voiceoverLine: "Cada detalle de {{PRODUCT_MATERIALS}} ha sido pensado para durar.",
      screenText: "",
      audioCue: "Acoustic guitar swells gently; subtle foley on material texture (paper rustle / wood grain / soft fabric).",
    },
    {
      idx: 3,
      name: "Lifestyle Parallax + CTA",
      startSec: 12,
      endSec: 18,
      shotType: "b_roll",
      effectDescription: "Pull-back con parallax revelando el {{PRODUCT_NAME}} en su contexto lifestyle completo (interior premium / mesa servida / dressing room) y aparición elegante del logo {{BRAND}}.",
      keyframePrompt: "Wide lifestyle composition showing {{PRODUCT_NAME}} in {{PRODUCT_MATERIALS}} as the focal point of a premium minimalist interior scene tailored to {{INDUSTRY}} (a serene living room, an elegant dressing area, a curated kitchen, a spa-like bathroom — pick the most natural context), warm natural window light from frame-left, atmospheric haze, soft shadows, perfectly composed negative space top-right ready for a wordmark, shot on 35mm at f/2.8, warm natural cinematic grade, photorealistic medium-format aesthetic, no on-screen text yet",
      videoPrompt: "Camera performs a slow elegant pull-back with subtle parallax over 6 seconds revealing the full lifestyle context, the warm side light maintains its golden-hour direction, atmospheric particles drift gently, the {{PRODUCT_NAME}} remains the visual focal point throughout the pull-back, in the final second a clean serif wordmark of {{BRAND}} fades in elegantly into the negative space top-right with a soft cross-dissolve",
      voiceoverLine: "{{BRAND}}. {{PRODUCT_NAME}}.",
      screenText: "{{BRAND}}",
      audioCue: "Acoustic guitar resolves into a single warm sustained chord; brand chime closes the spot on the wordmark reveal.",
    },
  ],
  masterConfig: {
    recommendedVideoModel: "kling-3.0-turbo",
    recommendedImageModel: "nano-banana",
    defaultAspect: "16:9",
    motionScore: 3,
    negativePrompt: "harsh shadows, washed-out colors, plastic-looking texture, low resolution, oversaturated, neon, garbled typography, watermark, cartoon, illustration",
    styleTag: "lifestyle",
  },
  variables: ["PRODUCT_NAME", "BRAND", "PRODUCT_MATERIALS", "PRODUCT_COLORS", "INDUSTRY"],
};

// ─── 8) Talking Head Direct — Personal Brand / Creator / Coach / Educator
//      4 segmentos = 24s. requiresPresenter. Para creators, educadores,
//      coaches, consultores, marca personal SIN producto físico. B-roll
//      conceptual con typography animada en lugar de producto.
const TPL_TALKING_HEAD_DIRECT: CinematicAdTemplate = {
  id: "seed:cinematic_ad_talking_head_direct",
  category: "personal_brand",
  name: "🎤 Talking Head Direct — Personal Brand / Creator (24s)",
  shortDescription: "4 segmentos: hook directo a cámara → B-roll conceptual con texto → desarrollo del beneficio → CTA primer plano. Para creators, coaches, educadores, consultores, marca personal sin producto físico.",
  longDescription: "Formato Tier-1 para Instagram Reels, TikTok, LinkedIn personal brand y YouTube Shorts. El presentador habla directamente a cámara en idx 1, 3, 4; el segmento idx 2 es un B-roll conceptual con typography animada que ilustra el {{PAIN_POINT}} o el {{CORE_BENEFIT}}. No requiere producto físico — solo el avatar del creator y su mensaje. El motor aplica character lock SOLO en escenas presenter; el B-roll es typography pura sin la cara del host.",
  conceptName: "{{BRAND}} — {{CORE_BENEFIT}}",
  totalDurationSec: 24,
  inspirationReference: "Alex Hormozi / Gary Vee / Steven Bartlett personal brand reel",
  estimatedCreditsHint: 14,
  segments: [
    {
      idx: 1,
      name: "Hook Directo",
      startSec: 0,
      endSec: 6,
      shotType: "presenter",
      effectDescription: "Plano medio del presentador en estudio premium minimalista, hablando directamente a cámara con energía y autoridad para enganchar a {{TARGET_AUDIENCE}}.",
      keyframePrompt: "Medium shot of a charismatic presenter in a premium minimalist studio with soft warm key light from frame-left and a deep teal/navy background with subtle vignette, looking directly into camera with confident energy and a focused expression, shot on 50mm at f/2.4, shallow depth of field separating presenter from the clean background, photorealistic 8K skin textures with natural pores, museum-quality portrait lighting with Rembrandt 45-degree key + soft rim, warm natural grade with crushed shadows, no on-screen text",
      videoPrompt: "The presenter speaks directly to camera with controlled energy and engaged facial expressions; subtle natural hand gesture entering frame from below at second 3 to emphasize the hook, gentle head movement for emphasis, blink and micro-smile shifts. Camera locked-off on tripod, no movement at all. Background remains static. Cinematic warm grade preserved with consistent lighting",
      voiceoverLine: "Si eres {{TARGET_AUDIENCE}} y aún luchas con {{PAIN_POINT}}, este vídeo va a cambiar cómo lo ves.",
      screenText: "",
      audioCue: "Subtle low cinematic pad rises with the hook; no music peaks until segment 4.",
    },
    {
      idx: 2,
      name: "B-Roll Conceptual + Typography",
      startSec: 6,
      endSec: 12,
      shotType: "b_roll",
      effectDescription: "B-roll abstracto con tipografía animada que ilustra el {{PAIN_POINT}} y la transformación hacia el {{CORE_BENEFIT}}.",
      keyframePrompt: "Abstract conceptual B-roll composition with elegant minimalist typography centered on a deep teal/navy gradient background, the words representing {{PAIN_POINT}} appearing in soft white serif letters with subtle motion blur, atmospheric particles floating slowly through the frame catching warm directional light from frame-left, museum-quality composition with deep negative space, shot on 50mm at f/4, warm cinematic grade with crushed shadows, photorealistic depth and texture, no other on-screen text",
      videoPrompt: "The {{PAIN_POINT}} typography fades in elegantly with a soft cross-dissolve over the first 2 seconds, holds for 2 seconds, then morphs / cross-dissolves smoothly into typography representing {{CORE_BENEFIT}} over the final 2 seconds, atmospheric particles drift slowly through the frame the entire time, camera performs a barely-perceptible slow push-in for kinetic feel, warm grade preserved",
      voiceoverLine: "El problema no es {{PAIN_POINT}}. Es que nadie te enseñó a transformarlo en {{CORE_BENEFIT}}.",
      screenText: "",
      audioCue: "Cinematic pad swells underneath; subtle whoosh on the typography morph at the midpoint.",
    },
    {
      idx: 3,
      name: "Desarrollo del Beneficio",
      startSec: 12,
      endSec: 18,
      shotType: "presenter",
      effectDescription: "Plano medio-corto del presentador desarrollando el cómo: explica la promesa de {{CORE_BENEFIT}} con energía controlada y gesticulación elegante.",
      keyframePrompt: "Medium-close shot of the same presenter in the same premium minimalist studio with the same warm key light setup and deep teal/navy background, leaning slightly forward with engaged confident expression conveying authority on {{CORE_BENEFIT}}, hand gesture mid-movement entering the frame, shot on 85mm at f/2 with shallow depth of field, photorealistic 8K skin textures with natural pores, Rembrandt 45-degree key light + soft rim, warm cinematic grade with crushed shadows, museum-quality portrait lighting consistent with segment 1, no on-screen text",
      videoPrompt: "The presenter speaks with measured energy explaining the path to {{CORE_BENEFIT}}, natural authoritative hand gestures entering and exiting frame, subtle head emphasis on key words, controlled blinks. Camera locked-off on tripod, no movement at all. Background remains static. Identical lighting and warm grade as segment 1 for visual continuity",
      voiceoverLine: "Lo que voy a darte hoy es exactamente lo que necesitas para conseguir {{CORE_BENEFIT}} sin perder más tiempo.",
      screenText: "",
      audioCue: "Cinematic pad continues with subtle harmonic shift; no music peaks until the CTA.",
    },
    {
      idx: 4,
      name: "CTA Primer Plano",
      startSec: 18,
      endSec: 24,
      shotType: "presenter",
      effectDescription: "Primer plano del presentador cerrando con el llamado a la acción {{CALL_TO_ACTION}} con autoridad calmada y un asentimiento final.",
      keyframePrompt: "Tight close-up of the same presenter, deep teal/navy background softly out of focus behind, looking directly into camera with calm authority and the subtle smile of someone making a definitive promise, the warm key light from frame-left producing the signature Rembrandt triangle highlight on the cheek + soft rim from behind, shot on 105mm at f/1.8 with extreme shallow depth of field, photorealistic 8K skin textures with natural pores, museum-quality portrait lighting with consistent setup from segments 1 and 3, warm cinematic grade with crushed shadows, no on-screen text yet",
      videoPrompt: "The presenter delivers the closing CTA line with calm confident authority, single confident nod at the very end, gentle blink, micro-smile shift. Camera locked-off on tripod, no movement at all. In the final second a clean serif wordmark of {{BRAND}} fades in elegantly bottom-center with a soft cross-dissolve, identical lighting and warm grade preserved from previous segments",
      voiceoverLine: "{{CALL_TO_ACTION}}. Te estoy esperando.",
      screenText: "{{BRAND}}",
      audioCue: "Cinematic pad reaches its full warm sustain, resolves into a single warm chord on the final word; brand chime closes the spot.",
    },
  ],
  masterConfig: {
    recommendedVideoModel: "kling-3.0-turbo",
    recommendedImageModel: "nano-banana",
    defaultAspect: "9:16",
    motionScore: 2,
    negativePrompt: "deformed face, asymmetric face, extra fingers, deformed hands, plastic skin, unnatural skin, garbled typography, text artifacts, watermark, low-resolution, cartoon, anime, illustration, double exposure",
    styleTag: "documentary",
    requiresPresenter: true,
    defaultPresenterPrompt: "A confident charismatic creator/educator in modern smart-casual attire (blazer over a quality t-shirt OR refined button-down), natural makeup, intelligent engaged gaze, subtle warm smile, perfectly groomed hair, photorealistic 8K skin textures with natural pores, looking directly at camera with the calm authority of someone speaking to their personal brand audience",
  },
  variables: ["BRAND", "PAIN_POINT", "CORE_BENEFIT", "TARGET_AUDIENCE", "CALL_TO_ACTION"],
};

// ─── 9) Action Pulse — High Energy / Sport / Fitness / Automotive (16s)
//      4 segmentos × 4s = 16s. Cortes rápidos, alta intensidad. Sin presentador.
//      Para fitness, sport, automotive, energy drinks, performance products.
const TPL_ACTION_PULSE: CinematicAdTemplate = {
  id: "seed:cinematic_ad_action_pulse",
  category: "action_pulse",
  name: "⚡ Action Pulse — High Energy (16s)",
  shortDescription: "4 segmentos × 4s: tensión inicial → liberación de energía → impacto hero → CTA. Para fitness, sport, automotive, energy drinks y productos de performance.",
  longDescription: "Plantilla de alta energía con cortes rápidos inspirada en spots Nike / Red Bull / Porsche / Ferrari. Cuatro planos consecutivos sin presentador, cada uno con un movimiento de cámara cinético distinto (whip-pan, rack-zoom, crash-zoom, parallax pull-back). Pensada para productos donde la elegancia museum-quality no encaja: zapatillas de running, suplementos, coches, bebidas energéticas, equipamiento deportivo. Music score sincronizado con drop en idx 3.",
  conceptName: "{{PRODUCT_NAME}} — Built for {{INDUSTRY}}",
  totalDurationSec: 16,
  inspirationReference: "Nike / Red Bull / Porsche / Gymshark performance reel",
  estimatedCreditsHint: 12,
  segments: [
    {
      idx: 1,
      name: "Tensión Inicial",
      startSec: 0,
      endSec: 4,
      shotType: "product",
      effectDescription: "Macro contenido del {{PRODUCT_NAME}} en penumbra dramática con un único haz de luz lateral; tensión visual antes del estallido.",
      keyframePrompt: "Dramatic macro close-up of {{PRODUCT_NAME}} in {{PRODUCT_MATERIALS}} with {{PRODUCT_COLORS}} accents, partially lit by a single hard rim-light from frame-right slicing through deep shadows, the rest of the frame in moody darkness with subtle teal-to-orange split-tone, atmospheric haze catching the rim-light revealing texture, shot on 100mm macro at f/4, sharp focus on the hero detail, high-contrast cinematic grade with crushed blacks and bright specular highlights, photorealistic Phantom Flex aesthetic with film grain, no on-screen text",
      videoPrompt: "Camera performs a slow tense push-in toward the hero detail of {{PRODUCT_NAME}} over 4 seconds, the rim-light slowly intensifies from 60% to 100% suggesting accumulating energy, atmospheric haze drifts through the light, focus stays razor-sharp on the central detail, no shake, building tension only — no movement of the product itself",
      voiceoverLine: "Cuando todo lo demás se rinde...",
      screenText: "",
      audioCue: "Sub-bass drone rises in pitch and intensity, single percussion hit at second 3.5 telegraphing the drop.",
    },
    {
      idx: 2,
      name: "Liberación de Energía",
      startSec: 4,
      endSec: 8,
      shotType: "b_roll",
      effectDescription: "Estallido visual: el {{PRODUCT_NAME}} cobra vida con un crash-zoom dinámico y partículas de energía explotando en alta velocidad.",
      keyframePrompt: "High-energy dynamic shot of {{PRODUCT_NAME}} in {{PRODUCT_MATERIALS}}, captured at the apex of an explosive moment, surrounded by directional energy particles streaking outward (sand kicked up / water droplets / sparks / dust shockwave depending on {{INDUSTRY}}), high-contrast teal-to-orange split-tone grade with crushed blacks and bright specular highlights, motion-blur on the particles, sharp focus on the product, shot on 35mm at f/2.8, Phantom Flex 4K 1000fps aesthetic, no on-screen text",
      videoPrompt: "Aggressive crash-zoom-in toward the {{PRODUCT_NAME}} at the start, then the camera locks and the directional energy particles continue to streak outward in slow-motion across the entire 4-second clip, the {{PRODUCT_NAME}} itself remains sharply focused at the center, micro-motion blur trails on every particle, high-contrast teal-orange grade preserved",
      voiceoverLine: "...{{PRODUCT_NAME}} se libera.",
      screenText: "",
      audioCue: "MUSIC DROP — punchy electronic kick + bass + filtered synth lead enters at full intensity.",
    },
    {
      idx: 3,
      name: "Impacto Hero",
      startSec: 8,
      endSec: 12,
      shotType: "product",
      effectDescription: "Plano hero del {{PRODUCT_NAME}} en pleno uso/movimiento — pies del runner / volante del coche / atleta — capturando el momento de máximo rendimiento.",
      keyframePrompt: "Dynamic action hero shot of {{PRODUCT_NAME}} in {{PRODUCT_MATERIALS}} captured in the middle of intense real-world use appropriate to {{INDUSTRY}} (a runner's foot mid-stride, an athlete's grip, a steering wheel mid-corner, a hand crushing a can), with motion-blur trails on the surrounding environment indicating high speed, the product itself razor-sharp in the center, deep teal-to-orange split-tone grade with crushed blacks and saturated mid-tones, atmospheric haze catching directional rim-light, shot on 50mm at f/2 with motion blur on background, photorealistic Phantom Flex 4K aesthetic with subtle film grain, no on-screen text",
      videoPrompt: "Camera performs a fast whip-pan that locks instantly onto the {{PRODUCT_NAME}} hero moment, motion-blur trails on the surrounding environment continue across the entire 4-second clip indicating sustained high-speed action, the product itself is razor-sharp at the center with crisp edges, the directional rim-light shifts angle by a few degrees revealing material texture, high-contrast teal-orange grade preserved with consistent specular highlights",
      voiceoverLine: "Para los que entrenan duro. Para los que no se conforman.",
      screenText: "",
      audioCue: "Music score continues at full intensity with rhythmic percussion + driving bass; subtle whoosh foley on the whip-pan.",
    },
    {
      idx: 4,
      name: "CTA Logo",
      startSec: 12,
      endSec: 16,
      shotType: "b_roll",
      effectDescription: "Resolución cinética: pull-back con parallax revelando el {{PRODUCT_NAME}} centrado en composición limpia y aparición del logo {{BRAND}} con un flash de luz.",
      keyframePrompt: "Clean hero composition of {{PRODUCT_NAME}} in {{PRODUCT_MATERIALS}} centered on a deep matte-black background with subtle teal-to-orange directional rim-light from frame-right and frame-left simultaneously creating a dramatic dual-rim outline, atmospheric haze catching both rim-lights, shot on 50mm at f/2.8 with deep DOF for product clarity, high-contrast cinematic grade with crushed blacks and saturated highlights, museum-quality central composition with negative space top for the wordmark, photorealistic medium-format aesthetic, no on-screen text yet",
      videoPrompt: "Camera performs a controlled parallax pull-back from the {{PRODUCT_NAME}} over the first 2 seconds settling at a clean wide composition, then in the final 2 seconds a clean bold sans-serif {{BRAND}} wordmark fades in elegantly into the negative space top-center with a single bright lens-flare flash punctuating its appearance, the dual rim-lights remain consistent, atmospheric haze drifts through the light, high-contrast teal-orange grade preserved",
      voiceoverLine: "{{BRAND}}. {{PRODUCT_NAME}}.",
      screenText: "{{BRAND}}",
      audioCue: "Music score crescendos and resolves on the wordmark reveal with a single low impact hit + brand sting.",
    },
  ],
  masterConfig: {
    recommendedVideoModel: "kling-3.0-turbo",
    recommendedImageModel: "nano-banana",
    defaultAspect: "9:16",
    motionScore: 5,
    negativePrompt: "static, lifeless, washed-out, low contrast, low resolution, blurry, garbled typography, watermark, cartoon, anime, illustration",
    styleTag: "sport",
  },
  variables: ["PRODUCT_NAME", "BRAND", "PRODUCT_MATERIALS", "PRODUCT_COLORS", "INDUSTRY"],
};

export const CINEMATIC_AD_TEMPLATES: CinematicAdTemplate[] = [
  TPL_ANATOMY,
  TPL_DECONSTRUCTION,
  TPL_CONSTRUCTION,
  TPL_EXPLODED_VIEW,
  TPL_APPLE_PORSCHE,
  TPL_PRESENTER_HYBRID,
  TPL_LIFESTYLE_ORBIT,
  TPL_TALKING_HEAD_DIRECT,
  TPL_ACTION_PULSE,
];

const CINEMATIC_TEMPLATE_USECASE = "cinematic_ad_template";

/**
 * Idempotent insert of all cinematic templates into omnicore_prompt_library.
 * Each template is stored as a row with id "seed:cinematic_ad_<category>".
 * The full template structure (segments + masterConfig + concept) is serialised
 * into promptTemplate as JSON for retrieval by the compose endpoint.
 */
export async function seedCinematicAdTemplates(): Promise<{ inserted: number; total: number }> {
  let inserted = 0;
  for (const tpl of CINEMATIC_AD_TEMPLATES) {
    const [existing] = await db
      .select({ id: omnicorePromptLibraryTable.id })
      .from(omnicorePromptLibraryTable)
      .where(eq(omnicorePromptLibraryTable.id, tpl.id))
      .limit(1);
    if (existing) continue;

    // Race-safe insert: two concurrent calls may both miss the SELECT and
    // attempt INSERT; swallow PK conflicts so the second one is a no-op
    // instead of a 500.
    try {
      await db.insert(omnicorePromptLibraryTable).values({
        id: tpl.id,
        name: tpl.name,
        description: tpl.shortDescription,
        niche: null,
        useCase: CINEMATIC_TEMPLATE_USECASE,
        promptTemplate: JSON.stringify({
          kind: "cinematic_ad_template",
          category: tpl.category,
          conceptName: tpl.conceptName,
          longDescription: tpl.longDescription,
          totalDurationSec: tpl.totalDurationSec,
          segments: tpl.segments,
          masterConfig: tpl.masterConfig,
          inspirationReference: tpl.inspirationReference,
          estimatedCreditsHint: tpl.estimatedCreditsHint,
        }),
        variables: JSON.stringify(tpl.variables),
        avgQualityScore: 1.0,
        useCount: 0,
        createdBy: "system:seed:cinematic",
        isPublic: 1,
      });
      inserted++;
    } catch (e: any) {
      const msg = String(e?.message || "");
      if (!/duplicate key|unique constraint/i.test(msg)) throw e;
    }
  }
  return { inserted, total: CINEMATIC_AD_TEMPLATES.length };
}

/**
 * Ensures cinematic templates exist AND are up to date with the latest in-code
 * definitions. Called on Prompt Lab open + on /catalog GET. Idempotent.
 *
 * Strategy:
 *   1. Insert any missing ids via seedCinematicAdTemplates().
 *   2. For every expected id, re-serialize the in-code template payload and
 *      UPDATE the row if its persisted JSON differs (e.g. older runs sowed
 *      provider modelIds like "kwaivgi/kling-v2.1" instead of canonical
 *      VideoModel keys like "kling-2.1"; this auto-heals them).
 */
export async function ensureCinematicAdTemplatesExist(): Promise<void> {
  // 1) Insert missing rows.
  await seedCinematicAdTemplates();

  // 2) Self-heal stale rows: re-serialize from CINEMATIC_AD_TEMPLATES and
  //    overwrite if drift is detected. This guarantees the DB always reflects
  //    the latest in-code definitions without needing manual migrations.
  const expectedIds = CINEMATIC_AD_TEMPLATES.map(t => t.id);
  const rows = await db
    .select({
      id: omnicorePromptLibraryTable.id,
      promptTemplate: omnicorePromptLibraryTable.promptTemplate,
    })
    .from(omnicorePromptLibraryTable)
    .where(inArray(omnicorePromptLibraryTable.id, expectedIds));
  const byId = new Map(rows.map(r => [r.id, r.promptTemplate]));
  for (const tpl of CINEMATIC_AD_TEMPLATES) {
    const want = JSON.stringify({
      kind: "cinematic_ad_template",
      category: tpl.category,
      conceptName: tpl.conceptName,
      longDescription: tpl.longDescription,
      totalDurationSec: tpl.totalDurationSec,
      segments: tpl.segments,
      masterConfig: tpl.masterConfig,
      inspirationReference: tpl.inspirationReference,
      estimatedCreditsHint: tpl.estimatedCreditsHint,
    });
    const have = byId.get(tpl.id);
    if (have !== want) {
      await db
        .update(omnicorePromptLibraryTable)
        .set({
          name: tpl.name,
          description: tpl.shortDescription,
          promptTemplate: want,
          variables: JSON.stringify(tpl.variables),
        })
        .where(eq(omnicorePromptLibraryTable.id, tpl.id));
    }
  }
}

/** Resolve a template from the library, returning the parsed structure or null. */
export async function loadCinematicTemplate(id: string): Promise<CinematicAdTemplate | null> {
  const [row] = await db
    .select()
    .from(omnicorePromptLibraryTable)
    .where(eq(omnicorePromptLibraryTable.id, id))
    .limit(1);
  if (!row) return null;
  if (row.useCase !== CINEMATIC_TEMPLATE_USECASE) return null;
  try {
    const data = JSON.parse(String(row.promptTemplate));
    if (data?.kind !== "cinematic_ad_template") return null;
    return {
      id: row.id,
      category: data.category,
      name: row.name,
      shortDescription: row.description || "",
      longDescription: data.longDescription || "",
      conceptName: data.conceptName,
      totalDurationSec: data.totalDurationSec,
      segments: data.segments,
      masterConfig: data.masterConfig,
      inspirationReference: data.inspirationReference,
      estimatedCreditsHint: data.estimatedCreditsHint,
      variables: row.variables ? JSON.parse(row.variables) : [],
    };
  } catch {
    return null;
  }
}

export interface ComposeVariables {
  productName: string;
  brand: string;
  productMaterials?: string;
  productColors?: string;
  industry?: string;
  // Service / personal-brand / educator variables. Used by `lifestyle`,
  // `personal_brand`, and `action_pulse` templates so the same compose
  // pipeline serves physical-product ads AND services / creators / coaches
  // / Instagram personal brands without Shopify.
  painPoint?: string;
  coreBenefit?: string;
  targetAudience?: string;
  callToAction?: string;
}

export interface ComposedCinematicScript {
  templateId: string;
  templateName: string;
  conceptName: string;
  totalDurationSec: number;
  aspect: "9:16" | "16:9" | "1:1";
  recommendedVideoModel: string;
  recommendedImageModel: string;
  motionScore: number;
  negativePrompt: string;
  styleTag: string;
  /** When true, the UI must show the presenter (host) upload + voice block. */
  requiresPresenter: boolean;
  /** Default presenter description (identityPrompt) used when none is uploaded. */
  defaultPresenterPrompt?: string;
  segments: Array<{
    idx: number;
    name: string;
    startSec: number;
    endSec: number;
    effectDescription: string;
    keyframePrompt: string;       // ← variables already substituted
    videoPrompt: string;          // ← variables already substituted
    screenText: string;           // ← variables already substituted
    audioCue: string;
    shotType?: "presenter" | "b_roll" | "product";
    voiceoverLine?: string;       // ← variables already substituted (long line)
  }>;
  /**
   * A CinematicScript object directly compatible with `presetScript` of
   * /fs-pro/cinematic-multishot. Drop-in ready for the existing render engine.
   */
  cinematicScriptForRenderer: {
    title: string;
    hook: string;
    cta: string;
    closingLine: string;
    negativePrompt?: string;
    scenes: Array<{
      idx: number;
      timeStartSec: number;
      timeEndSec: number;
      sceneDescription: string;
      cameraMovement: string;
      keyframePrompt: string;
      videoPrompt: string;
      voiceoverLine: string;
      shotType?: "presenter" | "b_roll" | "product";
      useCharacter?: boolean;
    }>;
  };
}

/**
 * Substitute {{VARIABLE}} placeholders in a template string with actual values.
 * Missing variables are replaced with a neutral placeholder so the LLM/IA never
 * sees raw `{{...}}` syntax (which would degrade the result).
 *
 * Supports BOTH product-style variables (PRODUCT_NAME, BRAND, PRODUCT_MATERIALS,
 * PRODUCT_COLORS, INDUSTRY) and service/personal-brand variables (PAIN_POINT,
 * CORE_BENEFIT, TARGET_AUDIENCE, CALL_TO_ACTION) so the same templating layer
 * powers physical-product ads AND service/educator/personal-brand ads.
 */
function substituteVariables(
  template: string,
  vars: Record<string, string>,
): string {
  return template.replace(/\{\{([A-Z_]+)\}\}/g, (_match, key: string) => {
    const v = vars[key];
    if (v && v.trim().length > 0) return v.trim();
    // Fallbacks for missing optional fields — keep prompt natural.
    if (key === "PRODUCT_MATERIALS")  return "premium materials";
    if (key === "PRODUCT_COLORS")     return "elegant tones";
    if (key === "INDUSTRY")           return "premium lifestyle";
    if (key === "BRAND")              return "the brand";
    if (key === "PRODUCT_NAME")       return "the product";
    if (key === "PAIN_POINT")         return "the everyday challenge";
    if (key === "CORE_BENEFIT")       return "a meaningful transformation";
    if (key === "TARGET_AUDIENCE")    return "people who care about excellence";
    if (key === "CALL_TO_ACTION")     return "Discover more";
    return key.toLowerCase().replace(/_/g, " ");
  });
}

// ───────────────────────────────────────────────────────────────────────────
// KNOWLEDGE-BASE AUTO-INJECTION HELPERS
// ───────────────────────────────────────────────────────────────────────────
// These helpers automatically enrich every composed script with the right
// cinematic intent preset, industry-specific negative prompt, and Visual-DNA
// continuity tokens — without requiring the user to know about the KB. This
// is what gives the platform Pollo/Omneky-grade output by default.

/**
 * Map a template category to its best-fit cinematography intent. The preset's
 * promptFragment (lens / lighting / grade / motion language) is appended to
 * each scene's videoPrompt so the IA producer always speaks the right
 * professional vocabulary.
 */
function inferIntentFromCategory(category: CinematicTemplateCategory): CinematographyIntent {
  switch (category) {
    case "anatomy":          return "luxury";
    case "deconstruction":   return "scientific";
    case "construction":     return "scientific";
    case "exploded_view":    return "scientific";
    case "apple_porsche":    return "luxury";
    case "presenter_hybrid": return "luxury";
    case "lifestyle":        return "fashion";
    case "personal_brand":   return "documentary";
    case "action_pulse":     return "sport";
    default:                 return "luxury";
  }
}

/**
 * Map a free-form industry string (whatever the user types) to a canonical
 * IndustrySegment of the negative-prompt library. Falls back to "general".
 */
function inferIndustrySegment(industry?: string): IndustrySegment {
  if (!industry) return "general";
  const norm = industry.toLowerCase().trim();
  const segments = Object.keys(NEGATIVE_PROMPT_LIBRARY) as IndustrySegment[];
  // 1) Exact match
  if ((segments as string[]).includes(norm)) return norm as IndustrySegment;
  // 2) Substring / synonym match
  if (/(watch|jewel|jewell|gold|diamond|silver|chrono|luxury watch)/.test(norm))      return "watches";
  if (/(beauty|cosme|skin|makeup|fragrance|perfume)/.test(norm))                       return "beauty";
  if (/(fashion|apparel|cloth|wardrob|outfit|shoe|sneaker|bag|hand-?bag)/.test(norm))  return "fashion";
  if (/(tech|gadget|electronic|phone|laptop|drone|head-?phone|ear-?bud)/.test(norm))   return "tech";
  if (/(food|drink|beverage|snack|kitchen|culinary|gastro|recipe)/.test(norm))         return "food";
  if (/(auto|car|vehicle|motor|moto|bike|cycl)/.test(norm))                            return "automotive";
  if (/(home|decor|furniture|interior|kitchenware|tableware|household)/.test(norm))    return "home";
  if (/(fitness|workout|gym|sport|athletic|performance|run|yoga)/.test(norm))          return "fitness";
  if (/(jewel|jewell)/.test(norm))                                                      return "jewelry";
  return "general";
}

/**
 * Append the inferred industry's negative prompt to the template's own
 * negative prompt. Both layers (template-author intent + industry-segment
 * library) are preserved — duplicates are merged.
 */
function mergeNegativePrompt(templateNegative: string, industry?: string): string {
  const fromKB = NEGATIVE_PROMPT_LIBRARY[inferIndustrySegment(industry)] || "";
  if (!fromKB) return templateNegative;
  const seen = new Set<string>();
  const tokens = [
    ...templateNegative.split(/,\s*/),
    ...fromKB.split(/,\s*/),
  ]
    .map(t => t.trim().toLowerCase())
    .filter(Boolean)
    .filter(t => {
      if (seen.has(t)) return false;
      seen.add(t);
      return true;
    });
  return tokens.join(", ");
}

/**
 * Build a "Visual DNA" continuity fragment that gets appended to every
 * keyframePrompt in the composed script. The token mix is derived from the
 * template's intent so a luxury watch ad gets the gold LUT + 85mm lock + soft
 * dust motes, while a sport/fitness ad gets the teal LUT + atmospheric haze.
 *
 * This is the "stitch logic" called out in the specs (Manual de Ingeniería de
 * Continuidad y Recuperación Autónoma) — the same Visual DNA constants are
 * forced into every clip so the look stays locked frame-to-frame.
 */
function buildContinuityFragment(intent: CinematographyIntent): string {
  const tokensByIntent: Record<CinematographyIntent, string[]> = {
    luxury:       ["cnt:gold_lut", "cnt:focal_85_product", "cnt:dust_motes_low",       "cnt:micro_reflections"],
    tech:         ["cnt:teal_lut", "cnt:focal_85_product", "cnt:micro_reflections"],
    sport:        ["cnt:teal_lut", "cnt:atmospheric_haze_low"],
    documentary:  ["cnt:light_lock_top_right", "cnt:micro_reflections"],
    fashion:      ["cnt:gold_lut", "cnt:micro_reflections"],
    automotive:   ["cnt:teal_lut", "cnt:atmospheric_haze_low", "cnt:micro_reflections"],
    beauty:       ["cnt:gold_lut", "cnt:focal_85_product", "cnt:micro_reflections"],
    scientific:   ["cnt:light_lock_top_right", "cnt:focal_85_product"],
  };
  const ids = tokensByIntent[intent] || tokensByIntent.luxury;
  const fragments = ids
    .map(id => CONTINUITY_TOKENS.find(c => c.id === id)?.fragment)
    .filter((s): s is string => !!s);
  return fragments.join(". ");
}

/**
 * Derive the cinematic intent's prompt fragment (focal / lighting / grade /
 * motion vocabulary) for a given template category. Used to enrich every
 * scene's videoPrompt with the right professional language.
 */
function buildIntentFragment(category: CinematicTemplateCategory): string {
  return CINEMATOGRAPHY_PRESETS[inferIntentFromCategory(category)].promptFragment;
}

/**
 * Compose a cinematic script from a template + product variables.
 * Pure transformation (no IA call, no DB write). Returns a structure ready for:
 *   - UI preview (segments[])
 *   - Direct rendering (cinematicScriptForRenderer)
 */
export function composeCinematicScript(
  template: CinematicAdTemplate,
  vars: ComposeVariables,
  overrides?: { aspect?: "9:16" | "16:9" | "1:1" },
): ComposedCinematicScript {
  const subVars: Record<string, string> = {
    PRODUCT_NAME: vars.productName,
    BRAND: vars.brand,
    PRODUCT_MATERIALS: vars.productMaterials || "",
    PRODUCT_COLORS: vars.productColors || "",
    INDUSTRY: vars.industry || "",
    // Service / personal-brand / educator variables — the same templating
    // layer powers physical-product ads AND non-product ads.
    PAIN_POINT:         (vars as any).painPoint        || "",
    CORE_BENEFIT:       (vars as any).coreBenefit      || "",
    TARGET_AUDIENCE:    (vars as any).targetAudience   || "",
    CALL_TO_ACTION:     (vars as any).callToAction     || "",
  };

  const aspect = overrides?.aspect ?? template.masterConfig.defaultAspect;

  // ──── KNOWLEDGE-BASE AUTO-INJECTION ────────────────────────────────────
  // Every composed script is automatically enriched with:
  //  1. Industry-specific negative prompt (merged with the template's own)
  //  2. Visual-DNA continuity fragment appended to every keyframePrompt
  //  3. Cinematography intent fragment appended to every videoPrompt
  // This is what gives every render Pollo/Omneky-grade quality by default,
  // without requiring the user to manually pick technical tokens.
  const intentFragment      = buildIntentFragment(template.category);
  const continuityFragment  = buildContinuityFragment(inferIntentFromCategory(template.category));
  const enrichedNegative    = mergeNegativePrompt(template.masterConfig.negativePrompt, vars.industry);

  const composedSegments = template.segments.map(seg => {
    const baseKeyframe = substituteVariables(seg.keyframePrompt, subVars);
    const baseVideo    = substituteVariables(seg.videoPrompt, subVars);
    // Talking-head presenter shots don't need product-grade continuity (focal
    // 85mm for product, micro-reflections, etc.) — they need consistent host
    // lighting only. So we still inject the continuity fragment for ALL shot
    // types but the model will weight it appropriately given the shot context.
    return {
      idx: seg.idx,
      name: seg.name,
      startSec: seg.startSec,
      endSec: seg.endSec,
      effectDescription: seg.effectDescription,
      keyframePrompt: continuityFragment ? `${baseKeyframe}. ${continuityFragment}` : baseKeyframe,
      videoPrompt:    intentFragment     ? `${baseVideo}. ${intentFragment}`        : baseVideo,
      screenText: substituteVariables(seg.screenText, subVars),
      audioCue: seg.audioCue,
      shotType: seg.shotType,
      voiceoverLine: seg.voiceoverLine ? substituteVariables(seg.voiceoverLine, subVars) : undefined,
    };
  });

  const composedTitle = substituteVariables(template.conceptName, subVars);

  // Defensive: if persisted DB row has an obsolete provider modelId
  // (e.g. "kwaivgi/kling-v2.1") that is NOT a canonical VideoModel key,
  // fall back to "kling-2.1". This guarantees /cinematic-multishot
  // never receives an unknown videoModel.
  const KNOWN_VIDEO_MODELS = new Set([
    "kling-3.0-master", "kling-3.0-turbo", "kling-master", "kling-2.5-turbo", "kling-2.1",
    "seedance-pro", "seedance-fast", "seedance-1-lite",
    "veo-3.1", "veo-3.1-fast", "veo-3", "veo-3-fast", "veo-2",
    "sora-2",
    "runway-gen4.5", "runway-seedance2", "runway-seedance2-fast", "runway-gen4-turbo",
    "hailuo-02", "hailuo-02-fast", "hailuo-2.3",
    "wan-2.7", "wan-2.6", "wan-2.5", "wan-2.5-fast", "wan-2.5-t2v",
    "kling-3.0-omni",
    "veo-4", "veo-4-fast",
    "grok-imagine-video", "grok-imagine-video-1.5",
  ]);
  const safeVideoModel = KNOWN_VIDEO_MODELS.has(template.masterConfig.recommendedVideoModel)
    ? template.masterConfig.recommendedVideoModel
    : "kling-3.0-turbo";

  return {
    templateId: template.id,
    templateName: template.name,
    conceptName: composedTitle,
    totalDurationSec: template.totalDurationSec,
    aspect,
    recommendedVideoModel: safeVideoModel,
    recommendedImageModel: template.masterConfig.recommendedImageModel,
    motionScore: template.masterConfig.motionScore,
    negativePrompt: enrichedNegative,
    styleTag: template.masterConfig.styleTag,
    segments: composedSegments,
    cinematicScriptForRenderer: {
      title: composedTitle,
      hook: composedSegments[0]?.effectDescription ?? composedTitle,
      cta: composedSegments[composedSegments.length - 1]?.screenText || `${vars.brand}`,
      closingLine: composedSegments[composedSegments.length - 1]?.screenText || `${vars.brand}`,
      negativePrompt: enrichedNegative,
      scenes: composedSegments.map(seg => ({
        idx: seg.idx,
        timeStartSec: seg.startSec,
        timeEndSec: seg.endSec,
        sceneDescription: seg.effectDescription,
        cameraMovement:
          seg.idx === 1 ? "slow macro orbit with cinematic inertia" :
          seg.idx === 2 ? "slow push-in with subtle parallax" :
          seg.idx === 3 ? "magnetic snap with anamorphic flare sweep" :
          "soft pull-back with shallow focus",
        keyframePrompt: seg.keyframePrompt,
        videoPrompt: seg.videoPrompt,
        // Long presenter line wins; otherwise fall back to the on-screen text
        // so the engine still has something to read for non-presenter ads.
        voiceoverLine: seg.voiceoverLine || seg.screenText || "",
        shotType: seg.shotType,
        // Hint for the renderer: skip character lock on B-roll / product-only
        // scenes even when a presenter image is supplied.
        useCharacter: seg.shotType === "b_roll" || seg.shotType === "product" ? false : undefined,
      })),
    },
    requiresPresenter: Boolean(template.masterConfig.requiresPresenter),
    defaultPresenterPrompt: template.masterConfig.defaultPresenterPrompt,
  };
}

export const CINEMATIC_TEMPLATE_USE_CASE = CINEMATIC_TEMPLATE_USECASE;
