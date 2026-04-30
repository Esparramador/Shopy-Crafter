// ═══════════════════════════════════════════════════════════════════════════
// PROMPT TEMPLATES — Biblioteca profesional estilo pollo.ai
// ═══════════════════════════════════════════════════════════════════════════
// Genera prompts de calidad cinematográfica combinando presets de:
//   - cámara/lente, iluminación, paleta, mood, composición, estilo, movimiento
//   - + apps temáticas (matting, angles, transitions, motion, relight, etc.)
//   - + transiciones cinematográficas (Pollo Transitions)
// ═══════════════════════════════════════════════════════════════════════════

export type PromptKind = "image" | "video";

// ── Lentes / Cámara
export const LENS_PRESETS = {
  "35mm-wide":      "shot on 35mm wide-angle lens, slight environmental distortion, immersive depth, full context",
  "50mm-prime":     "shot on 50mm prime lens, natural perspective like the human eye, shallow but honest depth of field",
  "85mm-portrait":  "shot on 85mm portrait lens, creamy bokeh, compressed background, intimate framing",
  "135mm-tele":     "shot on 135mm telephoto, strong subject isolation, soft melted background",
  "anamorphic":     "anamorphic 2.39:1 cinematic lens, horizontal lens flares, oval bokeh, widescreen drama",
  "macro-100mm":    "shot on 100mm macro lens, hyper-detailed product surface, microscopic textures",
  "drone-aerial":   "captured by aerial drone camera, vertical top-down composition, parallax of the world below",
  "fisheye-8mm":    "8mm fisheye lens, exaggerated curvature, immersive POV",
  "tilt-shift":     "tilt-shift miniature effect, selective focus plane, toy-like world",
} as const;
export type LensPreset = keyof typeof LENS_PRESETS;

// ── Iluminación
export const LIGHTING_PRESETS = {
  "golden-hour":     "warm golden hour sunlight, long soft shadows, amber rim light, magic-hour atmosphere",
  "blue-hour":       "blue-hour twilight, cool ambient light, neon highlights starting to glow, contemplative",
  "soft-window":     "soft north-facing window light, gentle wraparound, editorial portrait quality",
  "hard-noon":       "hard midday sun, deep crisp shadows, high contrast, intense saturation",
  "neon-cyberpunk":  "neon cyberpunk lighting, magenta and cyan rim lights, wet reflective surfaces, Blade Runner mood",
  "candlelit":       "warm candlelight, intimate dancing flame, ambient amber glow, vintage warmth",
  "three-point":     "professional three-point studio lighting, key + fill + rim, clean commercial quality",
  "rim-only":        "dramatic rim lighting only, silhouette edged in light, deep blacks, mysterious mood",
  "volumetric-rays": "volumetric god rays piercing dust/fog, atmospheric depth, cinematic shafts of light",
  "softbox-beauty":  "beauty softbox lighting, flawless skin tones, no harsh shadows, magazine cover finish",
  "split-rembrandt": "Rembrandt split lighting, single triangle of light on cheek, painterly chiaroscuro",
  "moonlight":       "cool moonlight, deep blue ambient, soft silver rim, nocturnal calm",
} as const;
export type LightingPreset = keyof typeof LIGHTING_PRESETS;

// ── Paleta
export const PALETTE_PRESETS = {
  "teal-orange":     "complementary teal and orange palette, Hollywood blockbuster grade",
  "muted-pastel":    "muted pastel palette, dusty pinks, sage greens, washed cream",
  "high-contrast-bw":"high-contrast black and white, deep blacks, blown highlights, photojournalism",
  "warm-vintage":    "warm vintage palette, faded ochre, brick red, cream, Kodak Portra 400 grade",
  "cool-mono":       "cool monochrome blue palette, ice tones, single accent color",
  "neon-pop":        "neon pop palette, electric magenta, cyan, lime green on deep black",
  "earth-organic":   "organic earth palette, terracotta, moss, sand, raw linen",
  "noir-shadow":     "film noir palette, deep contrast, smoky greys, single source of light",
  "rose-gold":       "rose gold palette, blush, champagne, soft metallic luxury",
  "retro-80s":       "retro 80s palette, vaporwave purple, hot pink, sunset orange",
  "scandinavian":    "Scandinavian palette, white, ash grey, oak, single warm accent",
} as const;
export type PalettePreset = keyof typeof PALETTE_PRESETS;

// ── Mood / Aesthetic
export const MOOD_PRESETS = {
  "cinematic":           "cinematic mood, anamorphic widescreen feel, motion picture quality, deliberate",
  "editorial-fashion":   "high-end editorial fashion, Vogue-quality composition, confident elegant attitude",
  "documentary-real":    "documentary realism, candid handheld feel, natural unposed authenticity",
  "fantasy-ethereal":    "fantasy ethereal mood, dreamlike soft focus, magical atmosphere, otherworldly",
  "dark-academia":       "dark academia, vintage library, brass and leather, intellectual mystery",
  "scandi-minimal":      "Scandinavian minimal, lots of negative space, raw textures, calm restraint",
  "tropical-summer":     "tropical summer, sunlit palm shadows, salty breeze, vacation joy",
  "japanese-wabi-sabi":  "Japanese wabi-sabi, imperfect beauty, weathered textures, contemplative quiet",
  "brutalist-modern":    "brutalist modern, raw concrete, geometric severity, bold confidence",
  "retro-80s-arcade":    "retro 80s arcade, neon glow, CRT scanlines, synthwave nostalgia",
  "luxury-premium":      "luxury premium, gold accents, deep shadows, slow deliberate gravitas",
  "playful-pop":         "playful pop, bright primary colors, energetic kinetic composition, joyful",
  "noir-mystery":        "film noir mystery, hard shadows, rain-slicked streets, smoke and intrigue",
  "ugc-authentic":       "authentic UGC creator content, smartphone candid, natural unfiltered relatability",
} as const;
export type MoodPreset = keyof typeof MOOD_PRESETS;

// ── Composición
export const COMPOSITION_PRESETS = {
  "rule-of-thirds":      "rule of thirds composition, subject on intersection, breathing room",
  "centered-symmetry":   "perfect centered symmetry, mirror balance, Wes Anderson framing",
  "low-angle-hero":      "low-angle hero shot looking up, monumental and powerful",
  "high-angle-overview": "high-angle overview looking down, observational, contextual",
  "top-down-flatlay":    "top-down 90° flatlay, geometric arrangement, editorial product shot",
  "leading-lines":       "strong leading lines drawing the eye into the frame",
  "negative-space":      "dominant negative space, single subject offset, breathable composition",
  "rule-of-odds":        "rule of odds composition, three subjects in tension",
  "dutch-tilt":          "Dutch tilt camera angle, off-kilter dynamic energy",
  "frame-within-frame":  "frame-within-frame composition, layered depth, intentional focus",
  "shallow-depth":       "extremely shallow depth of field, subject sharp, world melted into bokeh",
  "deep-depth":          "deep focus, foreground to infinity all sharp, classical hyperfocal",
} as const;
export type CompositionPreset = keyof typeof COMPOSITION_PRESETS;

// ── Movimiento de cámara (solo vídeo)
export const CAMERA_MOVEMENT_PRESETS = {
  "static":         "locked-off static camera, no movement, deliberate stillness",
  "slow-push-in":   "slow cinematic push-in, gradual zoom toward subject, building intensity",
  "slow-pull-out":  "slow cinematic pull-out, revealing more of the world, grand reveal",
  "dolly-in":       "smooth dolly-in on tracks, parallax of background, classic cinematography",
  "dolly-out":      "smooth dolly-out on tracks, expanding context, poetic distance",
  "tracking-side":  "lateral tracking shot, subject moving with camera, perfect parallel",
  "crane-up":       "majestic crane up, rising above the scene, epic scale reveal",
  "crane-down":     "crane down from sky, descending into the action",
  "gimbal-walk":    "smooth handheld gimbal walking shot, immersive POV, organic glide",
  "fpv-drone":      "FPV drone first-person flythrough, swooping kinetic energy",
  "orbit":          "smooth 360° orbit around subject, hero reveal, cinematic showcase",
  "whip-pan":       "fast whip pan transition, motion blur, kinetic punch",
  "vertigo-zoom":   "Hitchcock vertigo dolly-zoom, background warps while subject stays fixed",
  "slow-motion":    "ultra slow motion, every detail visible, balletic and powerful",
  "hyperlapse":     "hyperlapse motion, time accelerates, world in fast-forward",
} as const;
export type CameraMovementPreset = keyof typeof CAMERA_MOVEMENT_PRESETS;

// ── Estilo / Format
export const STYLE_PRESETS = {
  "photoreal-commercial":  "hyper-photorealistic commercial photography, sharp 8K detail, magazine production",
  "cinematic-film":        "cinematic 35mm film aesthetic, organic film grain, anamorphic feel",
  "editorial-magazine":    "high-end editorial magazine photography, Harper's Bazaar quality",
  "ugc-iphone":            "raw iPhone UGC creator video, natural authenticity, smartphone candid",
  "broadcast-commercial":  "broadcast TV commercial quality, polished prime-time spot",
  "documentary":           "observational documentary cinematography, candid real moments",
  "music-video":           "music video aesthetic, kinetic stylized cuts, color-graded for impact",
  "fashion-film":          "fashion film aesthetic, slow contemplative, hero moments, designer attitude",
  "anime-illustration":    "anime illustration style, cel-shaded, vibrant detailed",
  "3d-render-octane":      "3D render with Octane / Cinema 4D, perfect studio lighting, marketing key visual",
  "minimal-product":       "minimal product photography, single hero subject, clean negative space",
  "lifestyle-warm":        "warm lifestyle photography, real people in real moments, aspirational",
} as const;
export type StylePreset = keyof typeof STYLE_PRESETS;

// ── Pollo Transitions (para vídeo entre clips)
export const POLLO_TRANSITIONS = {
  "hand-transition":           "hand sweeps across the frame, palm wipes the scene to reveal the next",
  "smoke-transition":          "thick smoke billows in, fully covers the frame, then dissipates revealing the next scene",
  "splash-water":              "splash of water crashes across the lens, droplets refract, scene transforms",
  "splash-paint":              "explosion of liquid paint covers the frame, drips peel away to reveal the next",
  "hellfire-dash":             "wall of hellfire engulfs the frame, embers swirl, fire parts to next scene",
  "origami-crane":             "origami paper folds across the frame forming a crane, unfolds into next scene",
  "stardust-antigravity":      "anti-gravity stardust swirls upward, particles assemble the new scene",
  "crimson-silk-wind":         "crimson silk fabric flows across the frame in slow motion, peels to reveal next",
  "raven-transition":          "flock of black ravens flies across the frame, wings cover and reveal the new scene",
  "bioluminescent-butterflies":"glowing bioluminescent butterflies swarm across the frame, transform the scene",
  "calligraphy-ink-flow":      "3D calligraphy ink flows across the frame in elegant strokes, scene transforms",
  "vertical-light-fall":       "vertical curtain of light falls top-to-bottom, washes the scene, reveals next",
  "shimmering-hydro-sphere":   "shimmering water sphere expands, refracts the world, contracts into next scene",
  "clockwork-mandala":         "clockwork mandala array spins into the frame, mechanical transition reveals next",
  "overhead-shadow-dust":      "overhead shadow with floating dust particles sweeps across, reveals next scene",
  "colossal-fireball":         "colossal fireball erupts and engulfs the frame, dissipates into the new scene",
} as const;
export type PolloTransitionPreset = keyof typeof POLLO_TRANSITIONS;

// ── Apps temáticas (Pollo Apps style)
export const POLLO_APPS = {
  "pollo-matting":         "subject perfectly cut out, transparent background, clean alpha edges",
  "pollo-angles":          "multiple cinematic camera angles of the same subject, 360° turntable feel",
  "birthday-video":        "celebratory birthday scene, confetti, candles, joyful atmosphere, bright cake hero",
  "video-reframe":         "smart reframing for vertical 9:16 social with subject always centered",
  "playing-instrument":    "subject expressively playing a musical instrument, performance energy",
  "pollo-shots":           "varied cinematographic shot scale: ECU, MCU, wide, drone, all of same subject",
  "club-dancing":          "dynamic club dancing, neon lights, fog machine, kinetic movement",
  "gaming-intro":          "epic gaming-channel intro, glitch effects, 3D logo reveal, electronic energy",
  "first-person-pov":      "immersive first-person POV, looking through subject's eyes, hands visible",
  "pollo-motion":          "natural physical motion, hair flow, fabric drape, leaves blow, breath visible",
  "pollo-relight":         "completely relit scene, new lighting direction, color, mood while preserving subject",
  "mini-world":            "tiny adorable miniature diorama version of the scene, tilt-shift, toy-like",
} as const;
export type PolloAppPreset = keyof typeof POLLO_APPS;

// ─────────────────────────────────────────────────────────────────────────
// CONSTRUCTOR DE PROMPT — combina presets en un prompt cinematográfico
// ─────────────────────────────────────────────────────────────────────────

export interface BuildPromptOptions {
  kind: PromptKind;                     // "image" | "video"
  subject: string;                      // descripción base del sujeto/escena
  style?: StylePreset;
  lens?: LensPreset;
  lighting?: LightingPreset;
  palette?: PalettePreset;
  mood?: MoodPreset;
  composition?: CompositionPreset;
  cameraMovement?: CameraMovementPreset;// solo vídeo
  app?: PolloAppPreset;                 // app temática
  brandKeywords?: string[];             // palabras de marca a incluir
  negativeHints?: string[];             // qué evitar (low-quality, blurry, etc.)
  language?: "es" | "en";               // idioma del output
}

const NEGATIVE_DEFAULTS = [
  "low quality", "blurry", "deformed", "extra limbs", "watermark", "text artifacts",
  "amateur", "lens dirt", "noise", "compression artifacts",
];

export function buildProPrompt(opts: BuildPromptOptions): { prompt: string; negativePrompt: string; breakdown: Record<string, string> } {
  const breakdown: Record<string, string> = { subject: opts.subject };
  const parts: string[] = [opts.subject.trim()];

  if (opts.style) {
    const v = STYLE_PRESETS[opts.style];
    parts.push(v); breakdown.style = v;
  }
  if (opts.lens) {
    const v = LENS_PRESETS[opts.lens];
    parts.push(v); breakdown.lens = v;
  }
  if (opts.lighting) {
    const v = LIGHTING_PRESETS[opts.lighting];
    parts.push(v); breakdown.lighting = v;
  }
  if (opts.palette) {
    const v = PALETTE_PRESETS[opts.palette];
    parts.push(v); breakdown.palette = v;
  }
  if (opts.composition) {
    const v = COMPOSITION_PRESETS[opts.composition];
    parts.push(v); breakdown.composition = v;
  }
  if (opts.mood) {
    const v = MOOD_PRESETS[opts.mood];
    parts.push(v); breakdown.mood = v;
  }
  if (opts.cameraMovement && opts.kind === "video") {
    const v = CAMERA_MOVEMENT_PRESETS[opts.cameraMovement];
    parts.push(v); breakdown.cameraMovement = v;
  }
  if (opts.app) {
    const v = POLLO_APPS[opts.app];
    parts.push(v); breakdown.app = v;
  }
  if (opts.brandKeywords && opts.brandKeywords.length > 0) {
    const v = `branded with: ${opts.brandKeywords.slice(0, 8).join(", ")}`;
    parts.push(v); breakdown.brandKeywords = v;
  }

  // Quality boost final que pollo.ai añade siempre
  const qualityTail = opts.kind === "video"
    ? "ultra-detailed 4K, smooth 24fps motion, professional color grading, no flicker, broadcast quality"
    : "ultra-detailed 8K, sharp focus, professional color grading, magazine-quality finish";
  parts.push(qualityTail);

  const negative = [...NEGATIVE_DEFAULTS, ...(opts.negativeHints || [])].filter(Boolean);

  return {
    prompt: parts.filter(Boolean).join(", "),
    negativePrompt: negative.join(", "),
    breakdown,
  };
}

// ─────────────────────────────────────────────────────────────────────────
// Catálogo plano para frontend (UI dropdowns)
// ─────────────────────────────────────────────────────────────────────────

export function getPromptCatalog() {
  const toEntries = <T extends Record<string, string>>(o: T) =>
    Object.entries(o).map(([k, v]) => ({ key: k, label: prettyKey(k), description: v }));
  return {
    style: toEntries(STYLE_PRESETS),
    lens: toEntries(LENS_PRESETS),
    lighting: toEntries(LIGHTING_PRESETS),
    palette: toEntries(PALETTE_PRESETS),
    mood: toEntries(MOOD_PRESETS),
    composition: toEntries(COMPOSITION_PRESETS),
    cameraMovement: toEntries(CAMERA_MOVEMENT_PRESETS),
    apps: toEntries(POLLO_APPS),
    transitions: toEntries(POLLO_TRANSITIONS),
  };
}

function prettyKey(k: string): string {
  return k.split(/[-_]/).map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(" ");
}
