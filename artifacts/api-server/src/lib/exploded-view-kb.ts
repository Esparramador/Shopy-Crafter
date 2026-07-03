// ═══════════════════════════════════════════════════════════════════════════
// EXPLODED VIEW STUDIO — Knowledge Base (May 2026)
// ═══════════════════════════════════════════════════════════════════════════
// Crystallized from real research on: Pollo.ai, Omneky, Seedance 2.0,
// Kling AI 3.0, Runway Gen-4.5, Google Veo 3.1, Wan 2.1 FLF2V,
// and professional product deconstruction/assembly video techniques.
//
// This module captures the COMPLETE exploded-view product video system:
//   - AI platform profiles with real capabilities & API modes
//   - Global State DNA templates for camera/lighting/physics lock
//   - 5-clip deconstruction + assembly prompt sequences
//   - Parallel & sequential generation architectures
//   - Product category presets with component maps
//   - Post-production pipeline for seamless concatenation
//
// All entries are deterministic (no AI calls). Designed to be:
//   1) Browsed via REST endpoints for frontend pickers
//   2) Fed as context to Claude for intelligent sequence generation
//   3) Used by compose helpers to generate brand-specific exploded sequences
// ═══════════════════════════════════════════════════════════════════════════

// ─────────────────────────────────────────────────────────────────────────
// 1. AI VIDEO PLATFORM PROFILES — Real capabilities from research
// ─────────────────────────────────────────────────────────────────────────

export interface PlatformProfile {
  id: string;
  name: string;
  developer: string;
  type: "aggregator" | "foundational" | "creative_suite" | "model";
  maxDurationSec: number;
  maxResolution: string;
  fps: number;
  apiModes: string[];
  strengths: string[];
  explodedViewRating: number;
  promptTips: string[];
  cameraControlMethod: string;
  pricingNote: string;
}

export const PLATFORM_PROFILES: PlatformProfile[] = [
  {
    id: "plt:seedance_2",
    name: "Seedance 2.0",
    developer: "ByteDance",
    type: "model",
    maxDurationSec: 10,
    maxResolution: "1080p",
    fps: 24,
    apiModes: ["text_to_video", "first_last_frames", "omni_reference"],
    strengths: [
      "Unified multimodal audio-video architecture",
      "First-Last-Frame mode (FLF) — ideal for seamless clip chaining",
      "Omni-reference mode: up to 12 mixed references (images+videos+audio)",
      "Best-in-class physics simulation and object permanence",
      "Native audio generation synchronized with video",
    ],
    explodedViewRating: 95,
    promptTips: [
      "Use first_last_frames mode for sequential clip chaining — 98% frame-match rate",
      "Specify exact spatial coordinates (Y-axis: +3 inches) for component positioning",
      "Include 'no morphing, rigid body physics, precise mechanical motion' for parts stability",
      "Omni-reference mode: provide product reference images for identity lock across clips",
    ],
    cameraControlMethod: "Prompt-driven + reference image anchoring. Specify 'static locked-off camera' explicitly.",
    pricingNote: "Available via fal.ai ($0.20-0.40/clip), Replicate, PiAPI, BytePlus official API",
  },
  {
    id: "plt:kling_3",
    name: "Kling 3.0",
    developer: "Kuaishou",
    type: "model",
    maxDurationSec: 15,
    maxResolution: "4K",
    fps: 30,
    apiModes: ["text_to_video", "image_to_video", "multi_shot", "element_binding", "motion_control"],
    strengths: [
      "Native 4K resolution output — highest among current AI video models",
      "Element Binding: lock product identity across multi-shot sequences",
      "Motion Control: transfer precise mechanical movements between clips",
      "Multi-shot consistency with character/object locking",
      "3D spatio-temporal attention for physics-accurate motion",
    ],
    explodedViewRating: 92,
    promptTips: [
      "Use Element Binding to lock product appearance across all 5 clips",
      "Motion Control mode: define start/end positions for each component",
      "Specify 'ease-in/ease-out kinetic curve' for smooth mechanical detachment",
      "Include 'zero-gravity suspension, absolute structural stability' for floating state",
    ],
    cameraControlMethod: "Dedicated camera control API parameters (pan, tilt, zoom, roll). Also supports prompt-based static lock.",
    pricingNote: "Kling API via official platform, also available through Pollo.ai aggregator",
  },
  {
    id: "plt:runway_gen45",
    name: "Runway Gen-4.5",
    developer: "Runway",
    type: "model",
    maxDurationSec: 10,
    maxResolution: "1080p",
    fps: 24,
    apiModes: ["text_to_video", "image_to_video"],
    strengths: [
      "#1 ranked on Artificial Analysis benchmark (Elo rating)",
      "Exceptional frame stability and temporal coherence",
      "Prompt-driven camera choreography with precise control",
      "Strong photorealistic material rendering (metals, glass, brushed steel)",
      "Consistent lighting across frames — critical for exploded views",
    ],
    explodedViewRating: 90,
    promptTips: [
      "Camera control is prompt-driven: 'static lock-off camera, zero drift'",
      "Excellent at metallic reflections — specify 'brushed steel, titanium, chrome'",
      "Use image-to-video with last frame of previous clip for seamless transitions",
      "Specify 'no morphing, rigid mechanical parts, precise physics' explicitly",
    ],
    cameraControlMethod: "Prompt-driven only (no API sliders). Write 'STATIC LOCK-OFF CAMERA, zero camera movement' in every prompt.",
    pricingNote: "Runway API direct, also via Replicate. Standard/Turbo tiers available.",
  },
  {
    id: "plt:veo_31",
    name: "Veo 3.1",
    developer: "Google DeepMind",
    type: "model",
    maxDurationSec: 8,
    maxResolution: "4K",
    fps: 24,
    apiModes: ["text_to_video", "image_to_video", "first_last_frame", "video_extension"],
    strengths: [
      "Best-in-class physics simulation — most realistic object interactions",
      "Native audio generation with environment-aware sound design",
      "First+Last Frame mode for controlled transitions",
      "Up to 3 reference asset images for style/product locking",
      "Video extension: chain clips by extending previous generation",
    ],
    explodedViewRating: 88,
    promptTips: [
      "Physics simulation excels at gravity, magnetic attraction, mechanical precision",
      "Use 'asset' type references (up to 3) to lock product identity",
      "Specify 'dramatic volumetric shadows, octane render style' for studio look",
      "Video extension mode: extend each clip from the previous for continuity",
    ],
    cameraControlMethod: "Prompt-driven. First+Last Frame mode provides strongest spatial anchoring.",
    pricingNote: "Google AI Studio / Vertex AI. Pricing per-second of generated video.",
  },
  {
    id: "plt:wan_21_flf",
    name: "Wan 2.1 FLF2V",
    developer: "Alibaba (Tongyi Wanxiang)",
    type: "model",
    maxDurationSec: 5,
    maxResolution: "720p",
    fps: 24,
    apiModes: ["first_last_frame_to_video"],
    strengths: [
      "98% first-last frame matching rate — industry leading",
      "CLIP semantic features + cross-attention: 37% less jitter than competitors",
      "Purpose-built for seamless clip-to-clip transitions",
      "Smooth kinetic interpolation between defined start/end states",
      "Affordable pricing ($0.20-0.40 per generation)",
    ],
    explodedViewRating: 85,
    promptTips: [
      "Design first frame = fully assembled product, last frame = fully exploded",
      "The model interpolates all intermediate frames automatically",
      "Combine with a text prompt describing the motion dynamics",
      "Best for the 'magnetic assembly' clip — provide exploded→assembled frames",
    ],
    cameraControlMethod: "Controlled via first/last frame images. Camera position is locked by frame consistency.",
    pricingNote: "$0.20 at 480p, $0.40 at 720p via fal.ai. Also available on DashScope (Alibaba Cloud).",
  },
  {
    id: "plt:pollo_ai",
    name: "Pollo.ai (Pollo 2.0)",
    developer: "COCOSOFT TECHNOLOGY PTE. LTD.",
    type: "aggregator",
    maxDurationSec: 10,
    maxResolution: "1080p",
    fps: 24,
    apiModes: ["text_to_video", "image_to_video", "video_agent", "multi_shot", "motion_control", "camera_control", "transitions"],
    strengths: [
      "Aggregator platform: access Kling, Seedance, Runway, Hailuo, Pika from ONE interface",
      "Multi-Shot mode: sequential clip generation with consistency preservation",
      "Pollo Transitions: built-in seamless transition effects between clips",
      "Video Agent (Beta): AI workflow that chains prompts automatically",
      "Pollo Motion + Camera Control: dedicated tools for precise movement",
    ],
    explodedViewRating: 88,
    promptTips: [
      "Universal prompt formula: [Subject] + [Action] + [Style] + [Camera] + [Lighting] + [Mood]",
      "Use Multi-Shot mode for consistent 5-clip exploded view sequences",
      "Pollo Transitions handles the concatenation smoothly between clips",
      "Video Agent can automate the entire sequence generation pipeline",
      "Select Kling or Seedance as backend model for best exploded view results",
    ],
    cameraControlMethod: "Dedicated Camera Control feature + prompt-based. Select 'Static' preset or write lock instructions.",
    pricingNote: "Credit-based system. Pro plan includes access to all integrated models.",
  },
  {
    id: "plt:omneky",
    name: "Omneky",
    developer: "Omneky Inc.",
    type: "creative_suite",
    maxDurationSec: 30,
    maxResolution: "1080p",
    fps: 30,
    apiModes: ["product_to_storyboard", "storyboard_to_video", "iterative_scene_regen", "omnichannel_launch"],
    strengths: [
      "Data-driven concepting: AI generates ad concepts from product analysis",
      "Multi-script generation from a single concept",
      "Iterative storyboarding: regenerate individual scenes until perfect",
      "AI avatars, music, voiceovers, transitions in integrated editor",
      "Direct launch to Meta, Google, TikTok, YouTube from platform",
    ],
    explodedViewRating: 78,
    promptTips: [
      "Best for complete ad production workflow, not just raw video generation",
      "Use iterative storyboard mode: generate exploded view as a 5-scene storyboard",
      "Regenerate individual scenes independently while keeping others locked",
      "Add voiceover narration describing the components during the exploded view",
      "Export optimized for each platform format (9:16 TikTok, 16:9 YouTube, 1:1 Instagram)",
    ],
    cameraControlMethod: "Storyboard-driven. Each scene has its own camera setup. Less granular than prompt-based models.",
    pricingNote: "Enterprise platform. Contact for pricing. Free tier available for small teams.",
  },
  {
    id: "plt:grok_aurora_15",
    name: "Grok Aurora 1.5 (xAI)",
    developer: "xAI",
    type: "model",
    maxDurationSec: 15,
    maxResolution: "1080p",
    fps: 24,
    apiModes: ["text_to_video", "image_to_video", "extend_from_frame"],
    strengths: [
      "#1 ranked on Image-to-Video Arena (ELO rating, July 2026)",
      "Aurora Engine: autorregresivo unificado — video + audio + SFX en un solo paso",
      "Timestamp Scene Narration nativa: [0-4s] → [4s transition] → [4-10s]",
      "Hasta 7 imágenes de referencia simultáneas con @image1–@image7",
      "Lip-sync, SFX y música ambiental generados junto con el video",
      "Extend from Frame: historias de 30s+ encadenando clips",
      "Velocidad de generación ~17s (la más rápida del mercado)",
    ],
    explodedViewRating: 88,
    promptTips: [
      "TIMESTAMP SYNTAX: [0-4s] Close shot of product intact. Audio: ambient hum. [4s transition] Smash cut. [4-10s] Components separate outward.",
      "I2V explode view: imagen del producto ensamblado → prompt 'disassemble into individual components, floating parts in 3D space'",
      "NO soporta negative prompts → usar lenguaje AFIRMATIVO ('crystal clear focus' en vez de 'no blur')",
      "Hasta 7 @imageN referencias para character lock cross-shot",
      "Sincroniza 'mechanical clicks', 'metallic clinks' automáticamente al detectar separación de piezas",
    ],
    cameraControlMethod: "Prompt-driven con timestamps: [0-Xs] describe acción + cámara. [Xs transition] Tipo de corte. [Xs-Ys] nueva acción.",
    pricingNote: "X Premium+ / SuperGrok o via API (pay-per-use). Disponible en fal.ai y WaveSpeedAI.",
  },
  {
    id: "plt:google_flow",
    name: "Google Flow (Veo 3)",
    developer: "Google DeepMind",
    type: "model",
    maxDurationSec: 15,
    maxResolution: "4K",
    fps: 24,
    apiModes: ["text_to_video", "image_to_video", "first_last_frame", "keyframe_interpolation"],
    strengths: [
      "LÍDER ABSOLUTO para First/Last Frame interpolation — ideal para explode views",
      "Keyframe Interpolation: sube imagen ensamblada (start) + imagen explotada (end) → IA calcula trayecto de cada pieza",
      "Audio contextual nativo sincronizado con el video",
      "4K nativo — la mayor resolución disponible",
      "Comprensión física 3D superior para componentes mecánicos complejos",
    ],
    explodedViewRating: 98,
    promptTips: [
      "TÉCNICA DEFINITIVA: render Blender frame 0 (ensamblado) + frame 120 (explotado) → subir como start/end frames",
      "La IA calcula automáticamente el trayecto físico de cada componente individual",
      "Funciona con fotos reales del producto + render del estado explotado",
      "Para assembled reverso: start=explotado, end=ensamblado → mismo workflow, dirección invertida",
      "Añadir 'satisfying mechanical click motion, physics-accurate, slow motion' al prompt",
    ],
    cameraControlMethod: "First/Last Frame + prompt descriptivo. La IA infiere el movimiento de cámara óptimo para la transición.",
    pricingNote: "Google AI Pro ($19.99/mes). API via Google Cloud Vertex AI.",
  },
];

// ─────────────────────────────────────────────────────────────────────────
// 2. GLOBAL STATE DNA — The immutable prefix for parallel generation
// ─────────────────────────────────────────────────────────────────────────

export interface GlobalStateDNA {
  id: string;
  name: string;
  description: string;
  cameraSpec: string;
  lightingSpec: string;
  physicsSpec: string;
  qualitySpec: string;
  fullTemplate: string;
}

export const GLOBAL_STATE_TEMPLATES: GlobalStateDNA[] = [
  {
    id: "gs:studio_black",
    name: "Studio Black (Premium Product)",
    description: "Stark black seamless background with 3-point studio lighting. The gold standard for luxury product exploded views.",
    cameraSpec: "Static locked-off camera on a heavy tripod, zero camera drift, zero pan, zero zoom. Exact center framing. 100mm macro lens, f/8 aperture.",
    lightingSpec: "3-point studio lighting with dramatic volumetric shadows. Key light 45° upper-right, fill light 30° left, rim light behind subject.",
    physicsSpec: "Precise rigid-body physics, no morphing, no melting, no texture drift. Absolute structural stability for all floating components.",
    qualitySpec: "Ultra-photorealistic, 8k resolution, octane render style, macro probe lens, ultra-detailed metallic textures, deep depth of field.",
    fullTemplate: `GLOBAL STATE (DO NOT DEVIATE): Static locked-off camera on a heavy tripod, zero camera drift, zero pan, zero zoom. Exact center framing. 100mm macro lens, f/8 aperture. Lighting: 3-point studio lighting, stark black seamless background (#000000). Ultra-photorealistic, 8k resolution, precise rigid-body physics, no morphing, consistent volumetric shadows, deep depth of field.`,
  },
  {
    id: "gs:white_infinity",
    name: "White Infinity (Clean/Minimalist)",
    description: "Pure white infinity cove background. Clean, Apple-style product presentation.",
    cameraSpec: "Static locked-off camera, zero drift, exact center framing. 85mm lens, f/5.6 aperture, shallow depth of field on subject.",
    lightingSpec: "Soft diffused overhead lighting, minimal shadows, bright and clean. Subtle gradient from pure white (#FFFFFF) to soft gray.",
    physicsSpec: "Precise rigid-body physics, no morphing, no texture drift. Clean floating with subtle micro-shadows under components.",
    qualitySpec: "Ultra-photorealistic, 8k resolution, clean render, product photography aesthetic, no dust particles, pristine surfaces.",
    fullTemplate: `GLOBAL STATE (DO NOT DEVIATE): Static locked-off camera, zero drift, zero pan, zero zoom. Exact center framing. 85mm lens, f/5.6 aperture. Lighting: Soft diffused overhead, pure white infinity background (#FFFFFF). Ultra-photorealistic, 8k resolution, precise rigid-body physics, no morphing, clean pristine surfaces, minimal shadows.`,
  },
  {
    id: "gs:cinematic_dark",
    name: "Cinematic Dark (Moody/Dramatic)",
    description: "Dark moody environment with dramatic single-source lighting. Ideal for tech/gaming products.",
    cameraSpec: "Static locked-off camera on motion-control rig, zero drift. 50mm anamorphic lens, f/2.8 aperture, cinematic depth of field.",
    lightingSpec: "Single dramatic key light from upper-left, deep shadows, volumetric haze. Dark charcoal background (#1A1A1A) with subtle smoke wisps.",
    physicsSpec: "Precise rigid-body physics with micro dust particles catching light. No morphing, no melting. Structural integrity absolute.",
    qualitySpec: "Ultra-photorealistic, 8k resolution, anamorphic lens flares, film grain, cinematic color grading, dramatic contrast ratio.",
    fullTemplate: `GLOBAL STATE (DO NOT DEVIATE): Static locked-off camera, zero drift, zero pan, zero zoom. 50mm anamorphic lens, f/2.8. Single dramatic key light upper-left, deep volumetric shadows, dark charcoal background (#1A1A1A), subtle smoke wisps. Ultra-photorealistic, 8k, film grain, precise rigid-body physics, no morphing, cinematic contrast.`,
  },
  {
    id: "gs:gradient_luxury",
    name: "Gradient Luxury (Fashion/Beauty)",
    description: "Elegant gradient background with soft reflective surface. Perfect for fashion, beauty, and luxury accessories.",
    cameraSpec: "Static locked-off camera, zero drift. 105mm macro lens, f/4 aperture, creamy bokeh on background gradient.",
    lightingSpec: "Soft beauty lighting: two large softboxes 45° each side, subtle catch light on reflective surface. No harsh shadows.",
    physicsSpec: "Precise rigid-body physics with elegant floating. Components drift gently, no morphing. Subtle light refraction on glass/crystal elements.",
    qualitySpec: "Ultra-photorealistic, 8k resolution, beauty retouching aesthetic, perfect skin-like surface rendering, subtle glow and shimmer.",
    fullTemplate: `GLOBAL STATE (DO NOT DEVIATE): Static locked-off camera, zero drift, zero pan, zero zoom. 105mm macro lens, f/4. Soft beauty lighting, two large softboxes, elegant gradient background (dark to medium). Ultra-photorealistic, 8k, precise physics, no morphing, beauty aesthetic, reflective surface below subject.`,
  },
];

// ─────────────────────────────────────────────────────────────────────────
// 3. PROMPT SEQUENCES — 5-Clip Deconstruction + Assembly
// ─────────────────────────────────────────────────────────────────────────

export interface ClipPrompt {
  clipIndex: number;
  clipName: string;
  timelineSec: string;
  phase: "deconstruction" | "suspension" | "assembly";
  logicDescription: string;
  startingState: string;
  action: string;
  endingState: string;
  motionCurve: string;
  prompt: string;
  parallelSafe: boolean;
  sequentialTip: string;
}

export interface PromptSequence {
  id: string;
  productName: string;
  productCategory: string;
  totalDurationSec: number;
  clipCount: number;
  globalStateId: string;
  globalStatePrefix: string;
  generationMode: "sequential" | "parallel";
  clips: ClipPrompt[];
  postProductionNotes: string[];
}

export const PROMPT_SEQUENCES: PromptSequence[] = [
  {
    id: "seq:watch_sequential",
    productName: "Reloj Mecánico Premium",
    productCategory: "luxury_watch",
    totalDurationSec: 10,
    clipCount: 5,
    globalStateId: "gs:studio_black",
    globalStatePrefix: `Cinematic lighting, 8k resolution, photorealistic, octane render style, macro probe lens, ultra-detailed metallic textures, dramatic volumetric shadows, deep depth of field, black studio background. Exact spatial consistency.`,
    generationMode: "sequential",
    clips: [
      {
        clipIndex: 1,
        clipName: "El Arranque",
        timelineSec: "0.0–2.0",
        phase: "deconstruction",
        logicDescription: "Transición del estado sólido al primer nivel de separación. Movimiento lineal puro en eje Y.",
        startingState: "Fully assembled luxury mechanical watch, perfectly centered, completely still.",
        action: "Front glass screen elegantly detaches and levitates exactly 2 inches upward on strict Y-axis. Metal bezel starts to unscrew autonomously.",
        endingState: "Glass floating 2 inches above, bezel partially unscrewed, main body immobile.",
        motionCurve: "ease-in/ease-out",
        prompt: `Macro extreme close-up of a luxury mechanical watch. The camera slowly tracks forward seamlessly. Suddenly, the front glass screen elegantly detaches and floats exactly 2 inches upwards in slow motion. The metal bezel starts to unscrew autonomously. Fluid, hyper-smooth motion. No morphing. Object: Premium mechanical watch with brushed titanium case and gold accents.`,
        parallelSafe: true,
        sequentialTip: "Text-to-Video or Image-to-Video with product reference photo.",
      },
      {
        clipIndex: 2,
        clipName: "La Explosión Controlada",
        timelineSec: "2.0–4.0",
        phase: "deconstruction",
        logicDescription: "Las piezas internas explotan hacia afuera en vista isométrica 3D. Gravedad cero.",
        startingState: "Glass floating above, bezel detached, internal mechanism visible.",
        action: "Internal gears, springs, and titanium screws burst outward into perfect 3D isometric exploded view. Components float in mid-air, zero gravity.",
        endingState: "All components suspended in symmetric exploded arrangement, 1 inch negative space between each.",
        motionCurve: "ease-out (explosive burst → decelerate to float)",
        prompt: `Starting exactly from the provided image, the internal gears, springs, and titanium screws of the watch burst outward into a perfect 3D isometric exploded view. The components float in mid-air, suspended in zero gravity. The camera begins a slow, perfectly horizontal pan to the right. Micro-details of dust particles catching the light. Object: Premium mechanical watch components.`,
        parallelSafe: true,
        sequentialTip: "Image-to-Video: use LAST FRAME of Clip 1 as starting image.",
      },
      {
        clipIndex: 3,
        clipName: "El Cenit y la Rotación",
        timelineSec: "4.0–6.0",
        phase: "suspension",
        logicDescription: "Mantenemos vista explosionada para asimilar complejidad. Micro-movimiento mecánico interno.",
        startingState: "All watch components fully separated, floating in mid-air in vertical exploded view.",
        action: "Components maintain exact spatial coordinates. Gears slowly spin on own axes. Lighting shifts dynamically to reveal brushed steel textures.",
        endingState: "Same exploded arrangement, gears have rotated ~45°, dynamic lighting reveals new surface details.",
        motionCurve: "linear (constant slow rotation)",
        prompt: `Starting exactly from the provided image of floating watch components. The camera slowly orbits 15 degrees around the suspended, exploded mechanical parts. The gears are slowly spinning on their own axes while floating. The lighting shifts dynamically to reveal the brushed steel textures. Absolute structural stability, no pieces melting or morphing. Object: Floating mechanical watch components.`,
        parallelSafe: true,
        sequentialTip: "Image-to-Video: use LAST FRAME of Clip 2 as starting image.",
      },
      {
        clipIndex: 4,
        clipName: "El Magnetismo",
        timelineSec: "6.0–8.0",
        phase: "assembly",
        logicDescription: "Inversión de entropía. Fuerza magnética que justifica velocidad y precisión del cierre.",
        startingState: "All components floating in exploded view arrangement.",
        action: "Powerful magnetic attraction violently but precisely pulls floating gears, screws, and hands back toward center core. Parts lock into mechanical places with satisfying precision.",
        endingState: "Internal mechanism fully assembled, only outer shell and glass still detached.",
        motionCurve: "ease-in (slow start → exponential acceleration)",
        prompt: `Starting exactly from the provided image. Time-lapse effect. A strong magnetic force violently but precisely pulls the floating gears, screws, and watch hands back towards the center core. The pieces lock into their mechanical places with satisfying precision. Camera slowly zooms out. Object: Mechanical watch components reassembling.`,
        parallelSafe: true,
        sequentialTip: "Image-to-Video: use LAST FRAME of Clip 3 as starting image.",
      },
      {
        clipIndex: 5,
        clipName: "El Cierre Hermético",
        timelineSec: "8.0–10.0",
        phase: "assembly",
        logicDescription: "Cierre total y asentamiento del producto para el fotograma final estático (packshot).",
        startingState: "Watch body assembled internally, bezel and glass still floating above.",
        action: "Outer titanium shell, bezel, and front glass snap forcefully back onto main body. Singular ray of dramatic studio light sweeps across glass face.",
        endingState: "Watch fully assembled, perfect product shot, dramatic lighting, absolute stillness.",
        motionCurve: "ease-in → hard stop",
        prompt: `Starting exactly from the provided image. The outer titanium shell, bezel, and front glass snap forcefully back onto the main watch body. The watch is fully assembled and perfectly intact. A singular ray of dramatic studio light sweeps across the glass face reflecting perfectly. Camera locks into a static, triumphant product shot. Object: Fully assembled luxury mechanical watch.`,
        parallelSafe: true,
        sequentialTip: "Image-to-Video: use LAST FRAME of Clip 4 as starting image.",
      },
    ],
    postProductionNotes: [
      "Apply Optical Flow (Flujo Óptico) or Morph Cut: 2-3 frame transition at each cut point dissolves micro-jumps",
      "1-Frame Overlap: overlap last frame of Clip N with first frame of Clip N+1 before applying Optical Flow",
      "Export final as single 10-second file at source resolution and frame rate",
    ],
  },
  {
    id: "seq:lens_parallel",
    productName: "Lente de Cámara de Cine Premium",
    productCategory: "camera_lens",
    totalDurationSec: 10,
    clipCount: 5,
    globalStateId: "gs:studio_black",
    globalStatePrefix: `GLOBAL STATE (DO NOT DEVIATE): Static locked-off camera on a heavy tripod, zero camera drift, zero pan, zero zoom. Exact center framing. 100mm macro lens, f/8 aperture. Lighting: 3-point studio lighting, stark black seamless background (#000000). Object: Matte black cinematic camera lens with gold accents. Ultra-photorealistic, 8k resolution, precise physics, no morphing, consistent volumetric shadows.`,
    generationMode: "parallel",
    clips: [
      {
        clipIndex: 1,
        clipName: "El Desenganche Inicial",
        timelineSec: "0.0–2.0",
        phase: "deconstruction",
        logicDescription: "Transición del estado sólido al primer nivel de separación. Movimiento lineal puro.",
        startingState: "Fully assembled camera lens, perfectly centered, completely still for 0.5 seconds.",
        action: "Front glass element and top metal ring cleanly detach and levitate exactly 3 inches upwards on strict Y-axis. Smooth ease-in/ease-out kinetic curve.",
        endingState: "Top ring and glass floating 3 inches above, lens body immobile below.",
        motionCurve: "ease-in/ease-out",
        prompt: `[GLOBAL STATE]. TIMELINE 0 to 2 seconds. The fully assembled camera lens remains perfectly still for 0.5 seconds. Then, the front glass element and the top metal ring cleanly detach and levitate exactly 3 inches upwards on the strict Y-axis. The movement is perfectly smooth with an ease-in/ease-out kinetic curve. The rest of the lens body remains completely immobile. Extreme precision, metallic reflections shifting accurately as the top piece moves. No melting parts.`,
        parallelSafe: true,
        sequentialTip: "In parallel mode: launches simultaneously with all other clips.",
      },
      {
        clipIndex: 2,
        clipName: "La Expansión Isotrópica",
        timelineSec: "2.0–4.0",
        phase: "deconstruction",
        logicDescription: "Las capas internas se separan. Todo flota en gravedad cero.",
        startingState: "Top ring already floating 3 inches above main body.",
        action: "Internal optical glass layers, titanium aperture blades, and gold focus rings simultaneously burst outward in slow-motion symmetric exploded view along Y and Z axes.",
        endingState: "All components suspended in mid-air, exactly 1 inch negative space between each.",
        motionCurve: "ease-out (burst → float)",
        prompt: `[GLOBAL STATE]. TIMELINE 2 to 4 seconds. Starting state: The top ring is already floating 3 inches above the main body. Action: The internal optical glass layers, titanium aperture blades, and gold focus rings simultaneously burst outward in a slow-motion, symmetrical exploded view along the Y and Z axes. The parts suspend in mid-air, separated by exactly 1 inch of negative space between each component. Absolute zero-gravity suspension. Photorealistic glass refraction, microscopic dust particles illuminated by the studio light. Perfectly rigid mechanical structures.`,
        parallelSafe: true,
        sequentialTip: "In parallel mode: specify exact starting state so it matches Clip 1 ending.",
      },
      {
        clipIndex: 3,
        clipName: "Suspensión y Rotación Interna",
        timelineSec: "4.0–6.0",
        phase: "suspension",
        logicDescription: "Vista explosionada mantenida. Micro-movimiento mecánico: apertura iris + rotación de anillos.",
        startingState: "All lens components fully separated and floating in mid-air in vertical exploded view.",
        action: "Components maintain exact spatial coordinates. Aperture blades slowly open and close (iris effect). Gold focus rings rotate precisely 45 degrees on own central axis.",
        endingState: "Same arrangement, aperture cycled once, rings rotated 45°.",
        motionCurve: "sinusoidal (aperture open/close) + linear (ring rotation)",
        prompt: `[GLOBAL STATE]. TIMELINE 4 to 6 seconds. Starting state: All lens components are fully separated and floating in mid-air in a vertical exploded view. Action: The components maintain their exact spatial coordinates (no drifting up or down). However, the internal aperture blades slowly open and close (iris effect), and the gold focus rings rotate precisely 45 degrees on their own central axis. Hyper-detailed mechanical friction. Sharp reflections on the brushed metal. The camera remains locked.`,
        parallelSafe: true,
        sequentialTip: "In parallel mode: static state with internal motion only — highly parallelizable.",
      },
      {
        clipIndex: 4,
        clipName: "El Colapso Magnético",
        timelineSec: "6.0–8.0",
        phase: "assembly",
        logicDescription: "Inversión de entropía. Fuerza magnética para justificar velocidad y precisión.",
        startingState: "Lens components floating in exploded view.",
        action: "Sudden powerful magnetic attraction pulls all internal glass layers, aperture blades, and focus rings back into central core. Surgical precision on exact Y-axis. Motion starts slow, accelerates exponentially.",
        endingState: "Lens body assembled internally, only top ring still floating above.",
        motionCurve: "ease-in (exponential acceleration)",
        prompt: `[GLOBAL STATE]. TIMELINE 6 to 8 seconds. Starting state: Lens components floating in exploded view. Action: A sudden, powerful magnetic attraction pulls all the internal glass layers, aperture blades, and focus rings back into the central core. The pieces slide into each other with rigid, surgical precision on the exact Y-axis. The motion starts slow and accelerates exponentially (ease-in curve). The parts lock together seamlessly without any visual clipping or morphing. The top front ring remains floating above.`,
        parallelSafe: true,
        sequentialTip: "In parallel mode: explicitly state starting and ending positions.",
      },
      {
        clipIndex: 5,
        clipName: "El Sello Final",
        timelineSec: "8.0–10.0",
        phase: "assembly",
        logicDescription: "Cierre total. Asentamiento para packshot final estático.",
        startingState: "Lens body assembled, only top front ring and glass element floating above.",
        action: "Top ring snaps forcefully down onto main body, sealing completely. Microscopic mechanical 'click' vibration. Single dramatic studio light sweeps across front glass creating circular lens flare.",
        endingState: "Fully assembled lens, centered, dramatic lighting, absolute stillness.",
        motionCurve: "ease-in → hard stop → stillness",
        prompt: `[GLOBAL STATE]. TIMELINE 8 to 10 seconds. Starting state: The lens body is assembled, only the top front ring and glass element are floating above it. Action: The top ring snaps forcefully down onto the main body, sealing the lens completely. A microscopic mechanical "click" vibration shudders through the metal body for a fraction of a second. The completely assembled lens rests flawlessly in the center of the frame. A single dramatic studio light sweeps across the front glass, creating a perfect circular lens flare. Absolute stillness at the end.`,
        parallelSafe: true,
        sequentialTip: "In parallel mode: the packshot ending is most critical — verify lens appearance matches Clip 1 start.",
      },
    ],
    postProductionNotes: [
      "Alignment: Place all 5 clips sequentially on timeline — all share identical camera position thanks to GLOBAL STATE",
      "1-Frame Overlap: overlap last frame of each clip with first frame of next clip (not hard cut)",
      "Optical Flow Fusion: apply 2-3 frame Optical Flow transition at each junction — black background (#000000) means the editor fuses only the metallic pixels, making AI parallel-generation jumps completely invisible",
      "For PARALLEL mode: if static camera shows micro-drift, use opacity crossfade (2 frames) as fallback",
    ],
  },
];

// ─────────────────────────────────────────────────────────────────────────
// 4. PRODUCT CATEGORY PRESETS — Component maps for common products
// ─────────────────────────────────────────────────────────────────────────

export interface ProductComponent {
  name: string;
  material: string;
  separationAxis: "Y" | "X" | "Z" | "Y+Z" | "X+Y" | "radial";
  separationDistance: string;
  detachOrder: number;
  visualNote: string;
}

export interface ProductPreset {
  id: string;
  category: string;
  displayName: string;
  exampleProduct: string;
  components: ProductComponent[];
  recommendedGlobalState: string;
  recommendedPlatforms: string[];
  specialEffects: string[];
  promptSuffix: string;
}

export const PRODUCT_PRESETS: ProductPreset[] = [
  {
    id: "preset:luxury_watch",
    category: "luxury_watch",
    displayName: "Reloj Mecánico de Lujo",
    exampleProduct: "Reloj automático con caja de titanio, esfera skeleton, correa de cuero premium",
    components: [
      { name: "Cristal frontal (zafiro)", material: "Sapphire crystal glass", separationAxis: "Y", separationDistance: "2 inches", detachOrder: 1, visualNote: "Transparent, catches light refractions" },
      { name: "Bisel exterior", material: "Brushed titanium", separationAxis: "Y", separationDistance: "1.5 inches", detachOrder: 1, visualNote: "Rotating bezel unscrews autonomously" },
      { name: "Corona (stem)", material: "Polished steel with logo engraving", separationAxis: "X", separationDistance: "1 inch", detachOrder: 2, visualNote: "Small but critical detail piece" },
      { name: "Engranajes internos", material: "Gold-plated brass gears", separationAxis: "radial", separationDistance: "1 inch each", detachOrder: 3, visualNote: "Multiple gears spinning on own axes during suspension" },
      { name: "Resorte principal", material: "Spring steel coil", separationAxis: "Y+Z", separationDistance: "1.5 inches", detachOrder: 3, visualNote: "Coils unwind slightly as it separates" },
      { name: "Tornillos de titanio", material: "Titanium micro-screws", separationAxis: "radial", separationDistance: "2 inches", detachOrder: 3, visualNote: "Float outward symmetrically, catch light individually" },
      { name: "Manecillas (hora/minuto/segundo)", material: "Blued steel hands", separationAxis: "Y", separationDistance: "3 inches", detachOrder: 2, visualNote: "Float highest, dramatic silhouette against backlight" },
      { name: "Caja trasera", material: "Brushed titanium with exhibition caseback", separationAxis: "Y", separationDistance: "-2 inches (downward)", detachOrder: 4, visualNote: "Drops downward for symmetry in exploded view" },
    ],
    recommendedGlobalState: "gs:studio_black",
    recommendedPlatforms: ["plt:seedance_2", "plt:kling_3", "plt:runway_gen45"],
    specialEffects: ["Micro dust particles catching rim light", "Gear teeth meshing sound effect", "Sapphire crystal light refraction rainbows"],
    promptSuffix: "Object: Premium mechanical watch with brushed titanium case, gold-plated movement, blued steel hands, and sapphire crystal glass.",
  },
  {
    id: "preset:camera_lens",
    category: "camera_lens",
    displayName: "Lente Cinematográfica",
    exampleProduct: "Lente cinematográfica 50mm T1.5, cuerpo de aluminio anodizado negro, acentos dorados",
    components: [
      { name: "Elemento frontal (vidrio óptico)", material: "Multi-coated optical glass", separationAxis: "Y", separationDistance: "3 inches", detachOrder: 1, visualNote: "Purple/green anti-reflective coating shimmer" },
      { name: "Anillo frontal decorativo", material: "Anodized aluminum with gold text", separationAxis: "Y", separationDistance: "2 inches", detachOrder: 1, visualNote: "Brand markings and focal length text visible" },
      { name: "Capas internas de vidrio (3-5 elements)", material: "ED glass elements", separationAxis: "Y", separationDistance: "1 inch between each", detachOrder: 2, visualNote: "Multiple glass layers with different coatings" },
      { name: "Láminas de apertura (iris)", material: "Blackened titanium blades (9-blade)", separationAxis: "radial", separationDistance: "1.5 inches", detachOrder: 3, visualNote: "Open and close during suspension phase (iris effect)" },
      { name: "Anillos de enfoque (focus rings)", material: "Knurled aluminum with gold accents", separationAxis: "Y+Z", separationDistance: "1 inch", detachOrder: 2, visualNote: "Rotate 45° on own axis during suspension" },
      { name: "Motor de enfoque interno", material: "Micro-motor assembly, copper coils visible", separationAxis: "Z", separationDistance: "1.5 inches", detachOrder: 3, visualNote: "Tiny copper wire coils catch warm light" },
      { name: "Cuerpo principal (barrel)", material: "Matte black anodized aluminum", separationAxis: "Y", separationDistance: "stays center", detachOrder: 5, visualNote: "Remains as anchor point for the exploded view" },
      { name: "Montura trasera (mount)", material: "Chrome-plated brass mount", separationAxis: "Y", separationDistance: "-2 inches (downward)", detachOrder: 4, visualNote: "Electronic contacts visible, metallic shimmer" },
    ],
    recommendedGlobalState: "gs:studio_black",
    recommendedPlatforms: ["plt:seedance_2", "plt:kling_3", "plt:runway_gen45"],
    specialEffects: ["Aperture blade iris open/close animation", "Anti-reflective coating color shift", "Copper coil micro-detail catch light"],
    promptSuffix: "Object: Matte black cinematic camera lens with gold accents, multi-coated optical glass, and 9-blade aperture.",
  },
  {
    id: "preset:headphones",
    category: "headphones",
    displayName: "Auriculares Premium Over-Ear",
    exampleProduct: "Auriculares inalámbricos con diadema de aluminio, almohadillas de cuero, drivers de 40mm",
    components: [
      { name: "Almohadilla izquierda (ear cushion)", material: "Memory foam wrapped in protein leather", separationAxis: "X", separationDistance: "-2 inches (outward left)", detachOrder: 1, visualNote: "Soft material compression visible as it detaches" },
      { name: "Almohadilla derecha (ear cushion)", material: "Memory foam wrapped in protein leather", separationAxis: "X", separationDistance: "+2 inches (outward right)", detachOrder: 1, visualNote: "Mirror of left cushion separation" },
      { name: "Carcasas exteriores (cups)", material: "Brushed aluminum with logo engraving", separationAxis: "X+Y", separationDistance: "1.5 inches each side", detachOrder: 2, visualNote: "Logo catches dramatic rim light" },
      { name: "Drivers de 40mm (speakers)", material: "Neodymium magnet + Beryllium diaphragm", separationAxis: "X", separationDistance: "1 inch from cups", detachOrder: 3, visualNote: "Circular, technical component — the heart of the sound" },
      { name: "Placas de circuito (PCB)", material: "Green PCB with gold traces, micro-chips", separationAxis: "Y+Z", separationDistance: "1 inch below drivers", detachOrder: 4, visualNote: "Tiny LEDs and chips visible under macro light" },
      { name: "Diadema (headband)", material: "Spring steel core wrapped in leather", separationAxis: "Y", separationDistance: "3 inches upward", detachOrder: 2, visualNote: "Arc shape floating above all other components" },
      { name: "Batería (battery cell)", material: "Lithium polymer cell, silver foil wrapped", separationAxis: "Z", separationDistance: "1 inch backward", detachOrder: 4, visualNote: "Slim rectangular cell with tiny connector cable" },
      { name: "Cable de conexión interno", material: "Braided copper wire, thin flexible", separationAxis: "Y", separationDistance: "follows diadema path", detachOrder: 5, visualNote: "Thin wires trail gracefully between components" },
    ],
    recommendedGlobalState: "gs:cinematic_dark",
    recommendedPlatforms: ["plt:kling_3", "plt:seedance_2", "plt:veo_31"],
    specialEffects: ["Driver diaphragm micro-vibration (sound wave simulation)", "LED indicator glow on PCB", "Copper wire trailing between floating components"],
    promptSuffix: "Object: Premium over-ear wireless headphones with brushed aluminum cups, leather cushions, and 40mm Beryllium drivers.",
  },
  {
    id: "preset:sneaker",
    category: "sneaker",
    displayName: "Zapatilla Deportiva Premium",
    exampleProduct: "Zapatilla running con upper de flyknit, suela intermedia de espuma reactiva, suela exterior de caucho",
    components: [
      { name: "Upper (empeine de flyknit)", material: "Engineered woven flyknit mesh", separationAxis: "Y", separationDistance: "3 inches upward", detachOrder: 1, visualNote: "Flexible material holds shape like a ghost shoe" },
      { name: "Lengüeta (tongue)", material: "Padded neoprene with logo tag", separationAxis: "Y+Z", separationDistance: "2 inches up-forward", detachOrder: 1, visualNote: "Folds slightly as it floats" },
      { name: "Plantilla (insole)", material: "Molded OrthoLite foam with fabric top", separationAxis: "Y", separationDistance: "1 inch", detachOrder: 2, visualNote: "Anatomical shape visible from underside" },
      { name: "Suela intermedia (midsole)", material: "React/Boost foam, visible air unit", separationAxis: "Y", separationDistance: "-1 inch (stays near center)", detachOrder: 3, visualNote: "Cross-section reveals internal foam cell structure" },
      { name: "Unidad de aire / cápsula (air unit)", material: "Transparent TPU air capsule", separationAxis: "Y+Z", separationDistance: "1.5 inches below midsole", detachOrder: 4, visualNote: "Transparent — light passes through dramatically" },
      { name: "Suela exterior (outsole)", material: "Carbon rubber with traction pattern", separationAxis: "Y", separationDistance: "-3 inches (downward)", detachOrder: 4, visualNote: "Waffle/herringbone traction pattern detail under macro" },
      { name: "Ojales y cordones (eyelets + laces)", material: "Metal eyelets + woven flat laces", separationAxis: "Z", separationDistance: "2 inches forward", detachOrder: 1, visualNote: "Laces unfurl and float gracefully" },
      { name: "Refuerzo del talón (heel counter)", material: "Thermoplastic TPU shell", separationAxis: "Z", separationDistance: "-1.5 inches backward", detachOrder: 2, visualNote: "Structural piece that cups the heel — logo embossed" },
    ],
    recommendedGlobalState: "gs:white_infinity",
    recommendedPlatforms: ["plt:veo_31", "plt:seedance_2", "plt:kling_3"],
    specialEffects: ["Air unit transparency with light passing through", "Flyknit weave pattern detail under macro", "Foam cell structure cross-section visible"],
    promptSuffix: "Object: Premium running sneaker with engineered flyknit upper, reactive foam midsole, transparent air unit, and carbon rubber outsole.",
  },
  {
    id: "preset:perfume",
    category: "perfume",
    displayName: "Perfume de Lujo (Frasco de Diseño)",
    exampleProduct: "Frasco de perfume con vidrio tallado, tapa de metal chapado en oro, atomizador de precisión",
    components: [
      { name: "Tapa del frasco (cap)", material: "Gold-plated zamac metal, heavy weight", separationAxis: "Y", separationDistance: "3 inches upward", detachOrder: 1, visualNote: "Luxurious weight — rises slowly with dramatic gravitas" },
      { name: "Atomizador (spray nozzle)", material: "Precision metal nozzle + plastic tube", separationAxis: "Y", separationDistance: "2 inches", detachOrder: 2, visualNote: "Thin tube trails downward like a tendril" },
      { name: "Cuello del frasco (collar)", material: "Gold-plated metal collar ring", separationAxis: "Y", separationDistance: "1 inch", detachOrder: 2, visualNote: "Decorative ring catches light beautifully" },
      { name: "Frasco de vidrio (glass bottle)", material: "Hand-cut crystal glass, faceted", separationAxis: "Y", separationDistance: "stays center (anchor)", detachOrder: 5, visualNote: "Light refracts through amber liquid creating caustic patterns" },
      { name: "Líquido interior (perfume liquid)", material: "Amber/gold translucent liquid", separationAxis: "Y", separationDistance: "floats inside glass or rises slightly", detachOrder: 5, visualNote: "Liquid shimmers and catches light — hero visual element" },
      { name: "Base del frasco (bottom plate)", material: "Frosted glass or metal base", separationAxis: "Y", separationDistance: "-1.5 inches downward", detachOrder: 3, visualNote: "Reveals the underside profile rarely seen" },
    ],
    recommendedGlobalState: "gs:gradient_luxury",
    recommendedPlatforms: ["plt:runway_gen45", "plt:veo_31", "plt:seedance_2"],
    specialEffects: ["Liquid caustic light patterns through glass", "Gold plating reflections with warm light", "Mist spray particle simulation during assembly"],
    promptSuffix: "Object: Luxury designer perfume bottle with hand-cut crystal glass, gold-plated cap and collar, amber liquid, and precision atomizer.",
  },
];

// ─────────────────────────────────────────────────────────────────────────
// 5. GENERATION ARCHITECTURE — Sequential vs Parallel strategies
// ─────────────────────────────────────────────────────────────────────────

export interface GenerationStrategy {
  id: string;
  name: string;
  mode: "sequential" | "parallel";
  description: string;
  howItWorks: string[];
  pros: string[];
  cons: string[];
  bestPlatforms: string[];
  criticalRule: string;
}

export const GENERATION_STRATEGIES: GenerationStrategy[] = [
  {
    id: "strat:sequential_flf",
    name: "Secuencial Last-Frame-First-Frame (LF→FF)",
    mode: "sequential",
    description: "Genera cada clip en orden. El último fotograma del Clip N se usa como imagen de inicio del Clip N+1. Máxima coherencia, pero más lento.",
    howItWorks: [
      "1. Genera Clip 1 con Text-to-Video o Image-to-Video (foto del producto)",
      "2. Extrae el ÚLTIMO FOTOGRAMA exacto del Clip 1 (frame final)",
      "3. Usa ese fotograma como imagen de inicio para Clip 2 (Image-to-Video)",
      "4. Repite el proceso: último frame Clip 2 → inicio Clip 3, etc.",
      "5. Resultado: transiciones perfectas frame-a-frame, coherencia matemática",
    ],
    pros: [
      "Coherencia frame-a-frame prácticamente perfecta (98%+ con Seedance FLF)",
      "Mínima necesidad de post-producción en los cortes",
      "Funciona con CUALQUIER modelo que soporte Image-to-Video",
      "Permite variación de cámara entre clips (zoom, pan) sin perder coherencia",
    ],
    cons: [
      "Lento: cada clip depende del anterior (generación en serie)",
      "Si un clip falla, hay que regenerar desde ese punto en adelante",
      "Tiempo total = 5× el tiempo de generar un solo clip",
    ],
    bestPlatforms: ["Seedance 2.0 (first_last_frames mode)", "Kling 3.0 (Image-to-Video)", "Runway Gen-4.5 (I2V)", "Wan 2.1 FLF2V"],
    criticalRule: "NUNCA modifiques el último fotograma extraído — úsalo tal cual como imagen de inicio del siguiente clip.",
  },
  {
    id: "strat:parallel_locked",
    name: "Paralelo con Cámara Bloqueada (Parallel Lock)",
    mode: "parallel",
    description: "Lanza TODOS los clips simultáneamente. La coherencia se logra bloqueando matemáticamente la cámara, iluminación y entorno en cada prompt.",
    howItWorks: [
      "1. Define un GLOBAL STATE idéntico para TODOS los prompts (cámara, luz, fondo)",
      "2. Cada prompt especifica su PUNTO A (estado inicial) y PUNTO B (estado final)",
      "3. Los puntos A/B se definen con coordenadas exactas (ejes X, Y, Z, distancias en pulgadas)",
      "4. Lanza los 5 prompts EN PARALELO al mismo motor de generación",
      "5. Post-producción: alinea + aplica Optical Flow de 2-3 frames en cada corte",
    ],
    pros: [
      "5× más rápido que secuencial (generación paralela)",
      "Si un clip falla, regeneras solo ese clip sin afectar los demás",
      "Escalable: puedes añadir clips extras sin rehacer la cadena completa",
      "Ideal para iteración rápida y producción de alto volumen",
    ],
    cons: [
      "Requiere GLOBAL STATE idéntico en cada prompt (disciplina de prompting)",
      "Posibles micro-saltos entre clips (la IA puede alucinar variaciones microscópicas)",
      "Necesita post-producción experta (Optical Flow, Morph Cut) para fusionar cortes",
      "Funciona mejor con fondo sólido (#000000, #FFFFFF) que con fondos complejos",
    ],
    bestPlatforms: ["Pollo.ai (Multi-Shot mode)", "Kling 3.0 (Element Binding)", "Seedance 2.0 (text_to_video)", "Runway Gen-4.5"],
    criticalRule: "Escribe 'STATIC LOCK-OFF CAMERA, zero camera movement' en TODOS los prompts. Sin excepción.",
  },
];

// ─────────────────────────────────────────────────────────────────────────
// 6. POST-PRODUCTION PIPELINE — Seamless concatenation techniques
// ─────────────────────────────────────────────────────────────────────────

export interface PostProductionStep {
  id: string;
  order: number;
  name: string;
  description: string;
  toolSuggestions: string[];
  parameters: string;
  criticalNote: string;
}

export const POST_PRODUCTION_PIPELINE: PostProductionStep[] = [
  {
    id: "pp:timeline_alignment",
    order: 1,
    name: "Alineación en Timeline",
    description: "Coloca los 5 clips secuencialmente en tu editor de vídeo. Verifica que la resolución y FPS coincidan en todos los clips.",
    toolSuggestions: ["DaVinci Resolve (gratuito)", "Adobe Premiere Pro", "Final Cut Pro"],
    parameters: "Secuencia: match source resolution, match source FPS (24fps/30fps). No resampling.",
    criticalNote: "Si los clips tienen resoluciones diferentes, escala al menor denominador común ANTES de aplicar transiciones.",
  },
  {
    id: "pp:one_frame_overlap",
    order: 2,
    name: "Solape de 1 Fotograma (1-Frame Overlap)",
    description: "En lugar de un corte duro, solapa el último fotograma del Clip N con el primer fotograma del Clip N+1. Esto proporciona los píxeles de referencia que el motor de interpolación necesita.",
    toolSuggestions: ["DaVinci Resolve: drag clip overlap", "Premiere: Trim + Slip tool"],
    parameters: "Overlap: exactamente 1 frame (no más, no menos). En DaVinci: arrastrar bordes de clips hasta que se solapen 1 frame.",
    criticalNote: "NO uses más de 2-3 frames de overlap — demasiado solape crea 'ghosting' fantasma entre estados.",
  },
  {
    id: "pp:optical_flow",
    order: 3,
    name: "Fusión por Flujo Óptico (Optical Flow)",
    description: "Aplica una transición de Flujo Óptico de 2-3 fotogramas exactos en cada punto de corte. El motor analiza el movimiento de píxeles entre frames y genera interpolación inteligente.",
    toolSuggestions: ["DaVinci Resolve: Optical Flow retiming", "Premiere Pro: Morph Cut", "After Effects: Pixel Motion Blur"],
    parameters: "Duración de transición: 2-3 frames exactos (no más). Calidad: Best/Optical Flow. Speed Warp en DaVinci: Optical Flow mode.",
    criticalNote: "Con fondo negro (#000000) idéntico en todos los clips, el motor de Optical Flow SOLO fusiona los píxeles del producto metálico, haciendo las transiciones literalmente invisibles.",
  },
  {
    id: "pp:color_match",
    order: 4,
    name: "Igualación de Color (Color Match)",
    description: "Si hay variación de color/temperatura entre clips generados en paralelo, iguala usando el Clip 1 como referencia.",
    toolSuggestions: ["DaVinci Resolve: Color Match (auto)", "Premiere: Lumetri Auto Match", "Manual: Match curves/levels"],
    parameters: "Referencia: siempre el Clip 1 (primer clip de la secuencia). Tolerance: ±5% en luminancia, ±3% en saturación.",
    criticalNote: "Prioriza igualar el tono de las superficies metálicas — el ojo humano detecta inconsistencias metálicas antes que cualquier otra cosa.",
  },
  {
    id: "pp:audio_design",
    order: 5,
    name: "Diseño de Audio (Sound Design)",
    description: "Añade efectos de sonido sincronizados con las acciones mecánicas: detach, float, magnetic pull, snap-lock.",
    toolSuggestions: ["Freesound.org (free SFX)", "Artlist.io", "Epidemic Sound", "AI SFX: ElevenLabs Sound Effects"],
    parameters: "Key sounds: mechanical click (detach), whoosh (float), magnetic hum (acceleration), satisfying snap (lock), dramatic reveal sweep.",
    criticalNote: "El audio es el 50% de la percepción de calidad. Un click metálico preciso en el momento exacto del enganche transforma un buen vídeo en un vídeo premium.",
  },
  {
    id: "pp:final_export",
    order: 6,
    name: "Exportación Final",
    description: "Exporta como archivo único con la duración total de la secuencia. Formatos recomendados para máxima calidad.",
    toolSuggestions: ["ProRes 422 HQ (master)", "H.265 CRF 18 (distribución)", "H.264 CRF 20 (web)"],
    parameters: "Resolución: source (4K/1080p). FPS: source (24/30). Codec: ProRes para master, H.265 para delivery. Audio: AAC 320kbps.",
    criticalNote: "NUNCA exportes a menor resolución que la fuente como paso intermedio — siempre trabaja en resolución nativa hasta la exportación final.",
  },
];

// ─────────────────────────────────────────────────────────────────────────
// 7. QUALITY RULES — The non-negotiable principles
// ─────────────────────────────────────────────────────────────────────────

export interface QualityRule {
  id: string;
  category: "prompt" | "physics" | "camera" | "post" | "workflow";
  rule: string;
  rationale: string;
  severity: "critical" | "important" | "recommended";
}

export const QUALITY_RULES: QualityRule[] = [
  { id: "qr:no_morphing", category: "physics", rule: "Incluir 'no morphing, no melting, no texture drift' en CADA prompt", rationale: "Sin esta instrucción, las IAs tienden a fundir o deformar piezas metálicas durante transiciones — destruye la ilusión de precisión mecánica.", severity: "critical" },
  { id: "qr:rigid_body", category: "physics", rule: "Especificar 'rigid-body physics, absolute structural stability' para componentes flotantes", rationale: "Los componentes mecánicos deben mantener su forma exacta mientras flotan — no pueden doblarse, ondular ni estirarse.", severity: "critical" },
  { id: "qr:exact_distances", category: "prompt", rule: "Definir distancias EXACTAS en pulgadas/centímetros para cada separación (ej: 'exactly 3 inches upward on Y-axis')", rationale: "Las instrucciones vagas como 'float up' producen resultados inconsistentes entre clips. Las distancias exactas fuerzan la coherencia espacial.", severity: "critical" },
  { id: "qr:global_state", category: "camera", rule: "El GLOBAL STATE debe ser IDÉNTICO palabra por palabra en todos los prompts de una secuencia", rationale: "Cualquier variación en la descripción de cámara/luz/fondo entre prompts introduce inconsistencias visuales que ni Optical Flow puede corregir.", severity: "critical" },
  { id: "qr:ease_curves", category: "prompt", rule: "Especificar curvas de movimiento (ease-in, ease-out, linear) para cada acción", rationale: "Sin curvas definidas, la IA usa movimiento lineal por defecto — que se siente robótico. Las curvas ease dan sensación orgánica y profesional.", severity: "important" },
  { id: "qr:starting_state", category: "prompt", rule: "En modo PARALELO, cada prompt debe describir explícitamente su estado inicial y final", rationale: "En paralelo, no hay frame anterior de referencia. El prompt debe contener toda la información espacial para reconstruir la escena.", severity: "critical" },
  { id: "qr:material_spec", category: "prompt", rule: "Nombrar materiales específicos (brushed titanium, sapphire crystal, anodized aluminum) — nunca genéricos", rationale: "Los materiales específicos producen texturas fotorrealistas. 'Metal' produce resultados genéricos; 'brushed titanium with satin finish' produce fotorrealismo.", severity: "important" },
  { id: "qr:optical_flow_limit", category: "post", rule: "Transición Optical Flow NUNCA más de 3 frames de duración", rationale: "Más de 3 frames de Optical Flow crea artefactos de 'ghosting' donde las piezas se duplican semitransparentemente.", severity: "important" },
  { id: "qr:black_bg_parallel", category: "workflow", rule: "Para generación PARALELA, usar fondo negro sólido (#000000) — no fondos complejos", rationale: "El fondo negro es pixel-perfect idéntico en todos los clips, lo que hace que Optical Flow solo fusione los píxeles del producto.", severity: "important" },
  { id: "qr:reference_image", category: "workflow", rule: "Generar UNA imagen de referencia del producto primero y usarla como input en todos los clips", rationale: "La imagen de referencia ancla la identidad visual del producto. Sin ella, cada clip puede mostrar un producto ligeramente diferente.", severity: "recommended" },
  { id: "qr:audio_sync", category: "post", rule: "Sincronizar efectos de sonido con el frame EXACTO de cada acción mecánica", rationale: "Un desajuste de más de 2 frames entre un 'snap' visual y su sonido rompe la inmersión. Zoom in en la forma de onda para colocar al frame.", severity: "recommended" },
  { id: "qr:one_product_per_seq", category: "workflow", rule: "Una secuencia = un producto. No mezclar productos diferentes en la misma secuencia de 5 clips", rationale: "La coherencia visual se rompe si cambias de producto a mitad de secuencia. Genera secuencias separadas para cada producto.", severity: "recommended" },
];

// ─────────────────────────────────────────────────────────────────────────
// 8. DETERMINISTIC QUERY HELPERS
// ─────────────────────────────────────────────────────────────────────────

export function getExplodedViewSummary() {
  return {
    totalPlatforms: PLATFORM_PROFILES.length,
    totalGlobalStates: GLOBAL_STATE_TEMPLATES.length,
    totalSequences: PROMPT_SEQUENCES.length,
    totalProductPresets: PRODUCT_PRESETS.length,
    totalStrategies: GENERATION_STRATEGIES.length,
    totalPostSteps: POST_PRODUCTION_PIPELINE.length,
    totalQualityRules: QUALITY_RULES.length,
    sections: [
      "Plataformas de IA Video",
      "Global State DNA Templates",
      "Secuencias de Prompts (5 clips)",
      "Presets de Producto",
      "Estrategias de Generación",
      "Pipeline de Post-Producción",
      "Reglas de Calidad",
    ],
    platforms: PLATFORM_PROFILES.map(p => p.name),
    productCategories: PRODUCT_PRESETS.map(p => p.displayName),
  };
}

export function getFullExplodedViewKB() {
  return {
    platforms: PLATFORM_PROFILES,
    globalStates: GLOBAL_STATE_TEMPLATES,
    sequences: PROMPT_SEQUENCES,
    productPresets: PRODUCT_PRESETS,
    strategies: GENERATION_STRATEGIES,
    postProduction: POST_PRODUCTION_PIPELINE,
    qualityRules: QUALITY_RULES,
  };
}

export function getPlatformById(id: string): PlatformProfile | undefined {
  return PLATFORM_PROFILES.find(p => p.id === id);
}

export function getPlatformByName(name: string): PlatformProfile | undefined {
  const lower = name.toLowerCase();
  return PLATFORM_PROFILES.find(p => p.name.toLowerCase().includes(lower));
}

export function getPresetByCategory(category: string): ProductPreset | undefined {
  return PRODUCT_PRESETS.find(p => p.category === category);
}

export function getSequenceById(id: string): PromptSequence | undefined {
  return PROMPT_SEQUENCES.find(s => s.id === id);
}

export function getGlobalStateById(id: string): GlobalStateDNA | undefined {
  return GLOBAL_STATE_TEMPLATES.find(g => g.id === id);
}

export function getStrategyByMode(mode: "sequential" | "parallel"): GenerationStrategy | undefined {
  return GENERATION_STRATEGIES.find(s => s.mode === mode);
}

export function getRulesByCategory(category: QualityRule["category"]): QualityRule[] {
  return QUALITY_RULES.filter(r => r.category === category);
}

export function getRulesBySeverity(severity: QualityRule["severity"]): QualityRule[] {
  return QUALITY_RULES.filter(r => r.severity === severity);
}

export function buildPromptWithGlobalState(globalStateId: string, clipPrompt: string): string {
  const gs = GLOBAL_STATE_TEMPLATES.find(g => g.id === globalStateId);
  if (!gs) return clipPrompt;
  return clipPrompt.replace("[GLOBAL STATE]", gs.fullTemplate);
}

export function getRecommendedPlatformsForCategory(category: string): PlatformProfile[] {
  const preset = PRODUCT_PRESETS.find(p => p.category === category);
  if (!preset) return PLATFORM_PROFILES.slice(0, 3);
  return preset.recommendedPlatforms
    .map(id => PLATFORM_PROFILES.find(p => p.id === id))
    .filter((p): p is PlatformProfile => !!p);
}
