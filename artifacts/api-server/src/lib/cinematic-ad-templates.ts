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

export type CinematicTemplateCategory =
  | "deconstruction"
  | "construction"
  | "anatomy"
  | "exploded_view"
  | "apple_porsche"
  | "presenter_hybrid";

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
    recommendedVideoModel: "kling-2.1",
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
    recommendedVideoModel: "kling-2.1",
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
    recommendedVideoModel: "kling-2.1",
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
    recommendedVideoModel: "kling-2.1",
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
    recommendedVideoModel: "kling-2.1",
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
    recommendedVideoModel: "kling-2.1",
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

export const CINEMATIC_AD_TEMPLATES: CinematicAdTemplate[] = [
  TPL_ANATOMY,
  TPL_DECONSTRUCTION,
  TPL_CONSTRUCTION,
  TPL_EXPLODED_VIEW,
  TPL_APPLE_PORSCHE,
  TPL_PRESENTER_HYBRID,
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
 */
function substituteVariables(
  template: string,
  vars: Record<string, string>,
): string {
  return template.replace(/\{\{([A-Z_]+)\}\}/g, (_match, key: string) => {
    const v = vars[key];
    if (v && v.trim().length > 0) return v.trim();
    // Fallbacks for missing optional fields — keep prompt natural.
    if (key === "PRODUCT_MATERIALS") return "premium materials";
    if (key === "PRODUCT_COLORS") return "elegant tones";
    if (key === "INDUSTRY") return "premium lifestyle";
    if (key === "BRAND") return "the brand";
    if (key === "PRODUCT_NAME") return "the product";
    return key.toLowerCase().replace(/_/g, " ");
  });
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
  };

  const aspect = overrides?.aspect ?? template.masterConfig.defaultAspect;

  const composedSegments = template.segments.map(seg => ({
    idx: seg.idx,
    name: seg.name,
    startSec: seg.startSec,
    endSec: seg.endSec,
    effectDescription: seg.effectDescription,
    keyframePrompt: substituteVariables(seg.keyframePrompt, subVars),
    videoPrompt: substituteVariables(seg.videoPrompt, subVars),
    screenText: substituteVariables(seg.screenText, subVars),
    audioCue: seg.audioCue,
    shotType: seg.shotType,
    voiceoverLine: seg.voiceoverLine ? substituteVariables(seg.voiceoverLine, subVars) : undefined,
  }));

  const composedTitle = substituteVariables(template.conceptName, subVars);

  // Defensive: if persisted DB row has an obsolete provider modelId
  // (e.g. "kwaivgi/kling-v2.1") that is NOT a canonical VideoModel key,
  // fall back to "kling-2.1". This guarantees /cinematic-multishot
  // never receives an unknown videoModel.
  const KNOWN_VIDEO_MODELS = new Set([
    "kling-master", "kling-2.1", "seedance-pro", "seedance-fast",
    "veo-3", "veo-3-fast", "veo-2",
    "runway-gen3-alpha", "runway-gen4-turbo", "runway-aleph",
  ]);
  const safeVideoModel = KNOWN_VIDEO_MODELS.has(template.masterConfig.recommendedVideoModel)
    ? template.masterConfig.recommendedVideoModel
    : "kling-2.1";

  return {
    templateId: template.id,
    templateName: template.name,
    conceptName: composedTitle,
    totalDurationSec: template.totalDurationSec,
    aspect,
    recommendedVideoModel: safeVideoModel,
    recommendedImageModel: template.masterConfig.recommendedImageModel,
    motionScore: template.masterConfig.motionScore,
    negativePrompt: template.masterConfig.negativePrompt,
    styleTag: template.masterConfig.styleTag,
    segments: composedSegments,
    cinematicScriptForRenderer: {
      title: composedTitle,
      hook: composedSegments[0]?.effectDescription ?? composedTitle,
      cta: composedSegments[composedSegments.length - 1]?.screenText || `${vars.brand}`,
      closingLine: composedSegments[composedSegments.length - 1]?.screenText || `${vars.brand}`,
      negativePrompt: template.masterConfig.negativePrompt,
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
