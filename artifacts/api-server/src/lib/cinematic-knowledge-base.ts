// ═══════════════════════════════════════════════════════════════════════════
// CINEMATIC KNOWLEDGE BASE (May 2026)
// ═══════════════════════════════════════════════════════════════════════════
// Permanent in-platform knowledge that powers the "Director de Cine
// Inteligente" layer. This module crystallizes the production-grade vocabulary
// of luxury / Tier-1 advertising (Apple, Dyson, Mercedes-Benz, Rolex, Richard
// Mille, Porsche, Patek, Omneky-style) into typed, queryable libraries:
//
//   • OPTICAL_TECHNIQUES  → 50+ camera/lens prompts (anamorphic, macro,
//                            tilt-shift, Schlieren, etc.)
//   • ACTION_TOKENS       → physics behaviors (SHATTER, ASSEMBLE, LIQUID,
//                            DISSOLVE, MAGNETIZE, REFRACT, …) for procedural
//                            prompt composition.
//   • CINEMATOGRAPHY_PRESETS → focal length + DOF + grading per intent
//                              (luxury, tech, sport, documentary).
//   • NEGATIVE_PROMPT_LIBRARY → canonical negative prompts per industry
//                                segment (watches, electronics, fragrance).
//   • PRESENTER_STYLES    → identity-lock blocks for host avatars
//                            (executive, fashion-editor, scientist).
//   • SHOT_VOCABULARY     → typed shot-type → camera-movement mapping.
//   • CONTINUITY_TOKENS   → Visual DNA Persistence (VDP) helpers — frame-to-
//                            frame consistency primitives for long-form ads.
//
// All entries are deterministic strings/objects (no IA call). They are
// intended to be:
//   1) Read by composers/templates to inject pro-grade language into prompts.
//   2) Exposed via REST so the frontend can offer pickers / autosuggest.
//   3) Used as the substrate for a future Semantic Translator that turns a
//      user's loose intent ("haz una explosión cinematográfica") into a
//      multi-token, layered, technically correct prompt.
//
// IMPORTANT: this is NOT a replacement for the cinematic-ad-templates library.
// Templates are *complete shooting scripts*; this knowledge base is *raw
// vocabulary* that templates and ad-hoc compositions can reference.
// ═══════════════════════════════════════════════════════════════════════════

// ───────────────────────────────────────────────────────────────────────────
// 1. OPTICAL TECHNIQUES — lens / camera / post-production effects.
// ───────────────────────────────────────────────────────────────────────────

export type OpticalCategory =
  | "lens_art"          // anamorphic, flares, bokeh
  | "macro_micro"       // micro-photography, schlieren
  | "depth_focus"       // rack focus, tilt-shift, focus pulls
  | "movement"          // dolly, crane, drone, gimbal
  | "lighting"          // softbox, rim, hard, top-down
  | "color_grading"     // teal-orange, gold-luxury, monochrome
  | "post_fx"           // particle, dust, lens flares burned in
  | "physical_capture"; // high-speed, slow-motion captures

export interface OpticalTechnique {
  id: string;
  category: OpticalCategory;
  name: string;            // Short visible label (Spanish)
  promptFragment: string;  // English fragment, ready to concatenate into a prompt
  bestFor: string[];       // ["watches", "fragrance", "tech", ...]
  tier: 1 | 2 | 3;         // 1 = baseline pro, 2 = senior, 3 = director-of-photography
}

export const OPTICAL_TECHNIQUES: OpticalTechnique[] = [
  // ── LENS ART ──
  { id: "opt:anamorphic_streak", category: "lens_art", name: "Anamorphic Streak",
    promptFragment: "shot on 2x anamorphic lens, horizontal blue flare streaks across highlights, oval bokeh, cinematic 2.39:1 framing",
    bestFor: ["luxury", "watches", "automotive"], tier: 2 },
  { id: "opt:vintage_flare", category: "lens_art", name: "Vintage Lens Flare",
    promptFragment: "Cooke S4 vintage lens character, warm amber halation around bright sources, organic chromatic aberration on edges",
    bestFor: ["fragrance", "fashion"], tier: 2 },
  { id: "opt:swirly_bokeh", category: "lens_art", name: "Swirly Bokeh (Petzval)",
    promptFragment: "Petzval-style swirly bokeh in the periphery, sharp center, painterly background separation",
    bestFor: ["jewelry", "fashion"], tier: 3 },
  { id: "opt:hexagonal_bokeh", category: "lens_art", name: "Hexagonal Bokeh",
    promptFragment: "hexagonal aperture bokeh from wide-open vintage glass, dreamy out-of-focus highlights",
    bestFor: ["jewelry", "perfume"], tier: 2 },
  { id: "opt:lens_breathing", category: "lens_art", name: "Cine Lens Breathing",
    promptFragment: "subtle focal-length breathing during focus pulls, true cinema-lens behavior",
    bestFor: ["product_hero"], tier: 3 },

  // ── MACRO / MICRO ──
  { id: "opt:macro_probe", category: "macro_micro", name: "Macro Probe Lens",
    promptFragment: "Laowa 24mm probe lens style ultra-macro, deep field through tiny aperture, water-droplet-level detail",
    bestFor: ["watches", "skincare", "electronics"], tier: 3 },
  { id: "opt:macro_fluid", category: "macro_micro", name: "Macro Fluid Capture",
    promptFragment: "high-speed macro capture of fluid in motion, 4000fps slow-motion, surface tension visible, refraction caustics",
    bestFor: ["fragrance", "beverages", "skincare"], tier: 3 },
  { id: "opt:schlieren", category: "macro_micro", name: "Schlieren Photography",
    promptFragment: "schlieren imaging revealing invisible air currents and density changes around the subject, scientific-grade aesthetic",
    bestFor: ["fragrance", "tech", "automotive"], tier: 3 },
  { id: "opt:cross_section_macro", category: "macro_micro", name: "Cross-Section Macro",
    promptFragment: "cross-section macro view revealing internal layers, technical drawing aesthetic with photographic realism",
    bestFor: ["watches", "skincare", "electronics"], tier: 3 },

  // ── DEPTH / FOCUS ──
  { id: "opt:rack_focus_hero", category: "depth_focus", name: "Rack Focus Hero",
    promptFragment: "smooth rack focus from background detail to product hero, f/1.4 shallow DOF, organic transition",
    bestFor: ["luxury", "fashion"], tier: 1 },
  { id: "opt:tilt_shift_miniature", category: "depth_focus", name: "Tilt-Shift Miniature",
    promptFragment: "tilt-shift lens producing miniature/diorama effect, narrow horizontal focus band, exaggerated DOF falloff",
    bestFor: ["lifestyle", "architecture"], tier: 2 },
  { id: "opt:hyperfocal_reveal", category: "depth_focus", name: "Hyperfocal Reveal",
    promptFragment: "hyperfocal stack from foreground to infinity, every plane razor sharp, large-format camera character",
    bestFor: ["lifestyle", "automotive"], tier: 2 },
  { id: "opt:bokeh_pull", category: "depth_focus", name: "Bokeh Pull",
    promptFragment: "focus pull from out-of-focus bokeh field into product clarity, magical reveal moment",
    bestFor: ["jewelry", "watches"], tier: 1 },

  // ── MOVEMENT ──
  { id: "opt:slow_orbit", category: "movement", name: "Slow Cinematic Orbit",
    promptFragment: "slow 360 orbit around subject on motion-controlled gimbal, perfectly smooth arc, 8 second revolution",
    bestFor: ["product_hero", "luxury"], tier: 1 },
  { id: "opt:dolly_zoom", category: "movement", name: "Vertigo Dolly Zoom",
    promptFragment: "Hitchcock dolly zoom — camera dollies forward while lens zooms out, background warps while subject scale stays constant",
    bestFor: ["dramatic_reveal"], tier: 3 },
  { id: "opt:crane_descent", category: "movement", name: "Crane Descent",
    promptFragment: "elegant crane descent from above into eye-level hero shot, smooth deceleration",
    bestFor: ["automotive", "luxury"], tier: 2 },
  { id: "opt:drone_top_down", category: "movement", name: "Drone Top-Down",
    promptFragment: "top-down drone reveal, perfectly perpendicular to surface, geometric composition",
    bestFor: ["lifestyle", "architecture"], tier: 1 },
  { id: "opt:handheld_organic", category: "movement", name: "Handheld Organic",
    promptFragment: "subtle handheld micro-movement, natural body breathing pattern, intimate documentary feel",
    bestFor: ["fashion", "lifestyle"], tier: 1 },
  { id: "opt:track_along", category: "movement", name: "Track-Along Slider",
    promptFragment: "smooth horizontal slider track-along at constant velocity, parallax separation between planes",
    bestFor: ["product_hero"], tier: 2 },

  // ── LIGHTING ──
  { id: "opt:rembrandt_lux", category: "lighting", name: "Rembrandt Luxury",
    promptFragment: "Rembrandt key light at 45° creating triangle highlight on cheek, deep dramatic shadows, museum-quality portrait lighting",
    bestFor: ["presenter", "fashion"], tier: 2 },
  { id: "opt:beauty_dish", category: "lighting", name: "Beauty Dish Glow",
    promptFragment: "beauty dish with grid creating soft wraparound highlight on subject, controlled spill, fashion-editorial polish",
    bestFor: ["fashion", "beauty"], tier: 1 },
  { id: "opt:rim_separation", category: "lighting", name: "Rim Light Separation",
    promptFragment: "hard rim light from behind separating subject from dark background, hair-light halo, cinematic depth",
    bestFor: ["presenter", "automotive"], tier: 1 },
  { id: "opt:hard_top_down", category: "lighting", name: "Hard Top-Down (Apple Style)",
    promptFragment: "hard single-source top-down studio light, sharp specular highlights, Apple product-keynote aesthetic",
    bestFor: ["tech", "watches"], tier: 1 },
  { id: "opt:hdri_environment", category: "lighting", name: "HDRI Environment",
    promptFragment: "HDRI dome lighting from luxury showroom environment, accurate reflections on metallic surfaces",
    bestFor: ["watches", "automotive", "jewelry"], tier: 2 },
  { id: "opt:caustic_water", category: "lighting", name: "Caustic Water Light",
    promptFragment: "caustic water-light patterns dancing across subject and background, refractive shimmer",
    bestFor: ["luxury", "skincare"], tier: 3 },

  // ── COLOR GRADING ──
  { id: "opt:teal_orange_classic", category: "color_grading", name: "Teal & Orange",
    promptFragment: "teal-orange complementary grade, lifted shadows toward teal, warm orange skin tones, blockbuster look",
    bestFor: ["lifestyle", "tech"], tier: 1 },
  { id: "opt:gold_luxury_grade", category: "color_grading", name: "Gold Luxury Grade",
    promptFragment: "warm gold grade with crushed shadows, champagne midtones, opulent watch-ad palette",
    bestFor: ["watches", "jewelry", "fragrance"], tier: 1 },
  { id: "opt:monochrome_editorial", category: "color_grading", name: "Monochrome Editorial",
    promptFragment: "high-contrast black-and-white editorial grade, deep blacks, Vogue-cover aesthetic",
    bestFor: ["fashion"], tier: 2 },
  { id: "opt:bleach_bypass", category: "color_grading", name: "Bleach Bypass",
    promptFragment: "bleach-bypass desaturated punchy grade, Saving Private Ryan-style metallic feel",
    bestFor: ["sport", "tech"], tier: 2 },
  { id: "opt:pastel_dream", category: "color_grading", name: "Pastel Dream",
    promptFragment: "pastel dream grade with lifted blacks, soft pinks and lavenders, Wes Anderson palette",
    bestFor: ["beauty", "lifestyle"], tier: 2 },

  // ── POST-FX ──
  { id: "opt:dust_motes", category: "post_fx", name: "Floating Dust Motes",
    promptFragment: "subtle floating dust motes catching backlight, atmospheric depth, never distracting",
    bestFor: ["luxury", "watches"], tier: 1 },
  { id: "opt:particle_storm", category: "post_fx", name: "Cinematic Particle Storm",
    promptFragment: "thousands of micro-particles swirling around subject, art-directed flow patterns, no chaos",
    bestFor: ["dramatic_reveal", "tech"], tier: 3 },
  { id: "opt:volumetric_god_rays", category: "post_fx", name: "Volumetric God Rays",
    promptFragment: "volumetric god rays piercing through atmospheric haze, cathedral-like light beams",
    bestFor: ["luxury", "fragrance"], tier: 2 },
  { id: "opt:ink_dispersion", category: "post_fx", name: "Ink-in-Water Dispersion",
    promptFragment: "elegant ink-in-water dispersion patterns reacting to subject motion, painterly diffusion",
    bestFor: ["fragrance", "beauty"], tier: 3 },
  { id: "opt:liquid_chrome", category: "post_fx", name: "Liquid Chrome Dispersion",
    promptFragment: "liquid chrome droplets dispersing and reforming around subject, mercury-like reflective surfaces",
    bestFor: ["tech", "automotive"], tier: 3 },

  // ── PHYSICAL CAPTURE ──
  { id: "opt:phantom_4kfps", category: "physical_capture", name: "Phantom 4000fps",
    promptFragment: "Phantom Flex 4K capture at 4000fps slow-motion, hyper-detailed micro-events visible",
    bestFor: ["dramatic_reveal", "fragrance"], tier: 3 },
  { id: "opt:time_remapping", category: "physical_capture", name: "Time Remapping",
    promptFragment: "speed ramp from real-time into extreme slow-motion at the apex moment, Edgar Wright pacing",
    bestFor: ["sport", "automotive"], tier: 2 },
  { id: "opt:medium_format_8k", category: "physical_capture", name: "Medium Format 8K",
    promptFragment: "shot on Phase One IQ4 medium-format 8K, extreme dynamic range, painterly tonality",
    bestFor: ["luxury", "fashion"], tier: 3 },
];

// ───────────────────────────────────────────────────────────────────────────
// 2. ACTION TOKENS — physics-of-matter behaviors for prompt composition.
// Each token expands into a verbose, technical prompt fragment when injected.
// ───────────────────────────────────────────────────────────────────────────

export type ActionToken =
  | "SHATTER" | "ASSEMBLE" | "LIQUID" | "DISSOLVE" | "MAGNETIZE"
  | "REFRACT" | "EXPLODE" | "IMPLODE" | "FLOAT" | "MORPH"
  | "RIPPLE" | "FRACTURE" | "CRYSTALLIZE" | "VAPORIZE" | "ORBIT"
  | "DECONSTRUCT" | "RECONSTRUCT" | "ROTATE_360";

export interface ActionTokenDefinition {
  token: ActionToken;
  spanishLabel: string;
  promptExpansion: string;
  recommendedDurationSec: [number, number];
  recommendedTier: 1 | 2 | 3;
}

export const ACTION_TOKENS: Record<ActionToken, ActionTokenDefinition> = {
  SHATTER: { token: "SHATTER", spanishLabel: "Romper en cristal", recommendedDurationSec: [3, 5], recommendedTier: 2,
    promptExpansion: "the subject shatters into 200+ glass-like fragments, fractal break pattern, fragments arc outward then freeze mid-flight" },
  ASSEMBLE: { token: "ASSEMBLE", spanishLabel: "Auto-ensamblaje", recommendedDurationSec: [4, 6], recommendedTier: 1,
    promptExpansion: "components fly in from the edges of the frame, magnetically snap into place with linear interpolation, final snap haptic flash" },
  LIQUID: { token: "LIQUID", spanishLabel: "Forma líquida", recommendedDurationSec: [4, 7], recommendedTier: 3,
    promptExpansion: "subject transforms into high-viscosity liquid, surface tension preserved, realistic refractions and caustics, smooth fluid simulation" },
  DISSOLVE: { token: "DISSOLVE", spanishLabel: "Desintegrar en partículas", recommendedDurationSec: [3, 5], recommendedTier: 2,
    promptExpansion: "subject dissolves into 50,000 luminous particles, gravity zero, slow elegant decay from edges inward" },
  MAGNETIZE: { token: "MAGNETIZE", spanishLabel: "Atracción magnética", recommendedDurationSec: [3, 5], recommendedTier: 2,
    promptExpansion: "all fragments accelerate toward a central anchor point, field-line trails visible, satisfying snap on contact" },
  REFRACT: { token: "REFRACT", spanishLabel: "Refracción cristalina", recommendedDurationSec: [3, 5], recommendedTier: 3,
    promptExpansion: "light refracts through subject creating prismatic spectrum across surfaces, caustic patterns dance on background" },
  EXPLODE: { token: "EXPLODE", spanishLabel: "Vista explotada", recommendedDurationSec: [4, 6], recommendedTier: 2,
    promptExpansion: "subject components separate radially in exploded-view diagram style, technical-illustration meets photoreal, components freeze at apex" },
  IMPLODE: { token: "IMPLODE", spanishLabel: "Implosión hacia el centro", recommendedDurationSec: [3, 4], recommendedTier: 3,
    promptExpansion: "all fragments implode inward at exponentially accelerating speed, vacuum-like collapse, micro shock-ring at impact" },
  FLOAT: { token: "FLOAT", spanishLabel: "Flotación ingrávida", recommendedDurationSec: [4, 8], recommendedTier: 1,
    promptExpansion: "subject floats in zero-gravity void, gentle vertical bob, slow rotation, no support visible" },
  MORPH: { token: "MORPH", spanishLabel: "Morfeo entre formas", recommendedDurationSec: [4, 6], recommendedTier: 3,
    promptExpansion: "seamless AI-grade morphing between forms, no visible cuts, geometry blends through intermediate shapes" },
  RIPPLE: { token: "RIPPLE", spanishLabel: "Onda expansiva", recommendedDurationSec: [2, 4], recommendedTier: 1,
    promptExpansion: "concentric ripple emanates outward from impact point, surface deforms in physical wave pattern, fades over distance" },
  FRACTURE: { token: "FRACTURE", spanishLabel: "Fractura controlada", recommendedDurationSec: [3, 5], recommendedTier: 2,
    promptExpansion: "fine crack lines propagate across surface following stress vectors, no full break, beautiful fault patterns" },
  CRYSTALLIZE: { token: "CRYSTALLIZE", spanishLabel: "Cristalización", recommendedDurationSec: [3, 5], recommendedTier: 3,
    promptExpansion: "subject grows crystalline structures from key points outward, geometric facets, semi-transparent gemstone aesthetic" },
  VAPORIZE: { token: "VAPORIZE", spanishLabel: "Vaporización elegante", recommendedDurationSec: [3, 5], recommendedTier: 2,
    promptExpansion: "subject vaporizes into a fragrant cloud, swirling smoke patterns rise upward, art-directed never chaotic" },
  ORBIT: { token: "ORBIT", spanishLabel: "Órbita planetaria", recommendedDurationSec: [4, 8], recommendedTier: 1,
    promptExpansion: "subject orbits a central anchor on a perfect circular path, planetary motion, smooth constant velocity" },
  DECONSTRUCT: { token: "DECONSTRUCT", spanishLabel: "Deconstrucción técnica", recommendedDurationSec: [4, 6], recommendedTier: 2,
    promptExpansion: "components separate one-by-one in choreographed sequence, technical-cutaway aesthetic, each layer labeled in space" },
  RECONSTRUCT: { token: "RECONSTRUCT", spanishLabel: "Re-construcción", recommendedDurationSec: [4, 6], recommendedTier: 2,
    promptExpansion: "components reassemble from scattered state into final form, reverse-deconstruction choreography, satisfying click on completion" },
  ROTATE_360: { token: "ROTATE_360", spanishLabel: "Rotación 360°", recommendedDurationSec: [4, 8], recommendedTier: 1,
    promptExpansion: "subject rotates a full 360° on a vertical axis at constant angular velocity, perfectly centered, museum-display aesthetic" },
};

// ───────────────────────────────────────────────────────────────────────────
// 3. CINEMATOGRAPHY PRESETS — focal length + DOF + grading per intent.
// ───────────────────────────────────────────────────────────────────────────

export type CinematographyIntent =
  | "luxury" | "tech" | "sport" | "documentary" | "fashion"
  | "automotive" | "beauty" | "scientific";

export interface CinematographyPreset {
  intent: CinematographyIntent;
  focalLength: string;
  aperture: string;
  depthOfField: string;
  colorGrade: string;
  motionStyle: string;
  promptFragment: string;
}

export const CINEMATOGRAPHY_PRESETS: Record<CinematographyIntent, CinematographyPreset> = {
  luxury: { intent: "luxury", focalLength: "85mm", aperture: "f/1.8", depthOfField: "shallow",
    colorGrade: "warm gold + crushed shadows", motionStyle: "slow gimbal orbit",
    promptFragment: "shot on 85mm at f/1.8, shallow depth of field, warm gold grade with crushed shadows, slow gimbal orbit, museum-quality lighting" },
  tech: { intent: "tech", focalLength: "35mm anamorphic", aperture: "f/2.8", depthOfField: "medium",
    colorGrade: "teal-blue with high sharpening", motionStyle: "precise motion-control",
    promptFragment: "shot on 35mm anamorphic at f/2.8, teal-blue grade with high sharpening, precise motion-controlled camera, Apple keynote aesthetic" },
  sport: { intent: "sport", focalLength: "24-70mm zoom", aperture: "f/4", depthOfField: "deep",
    colorGrade: "high-contrast bleach bypass", motionStyle: "handheld + speed ramp",
    promptFragment: "shot on 24-70 zoom at f/4, deep DOF, bleach-bypass high-contrast grade, dynamic handheld with speed ramps, Nike-ad energy" },
  documentary: { intent: "documentary", focalLength: "35mm prime", aperture: "f/2", depthOfField: "natural",
    colorGrade: "neutral with gentle warmth", motionStyle: "subtle handheld",
    promptFragment: "shot on 35mm prime at f/2, natural DOF, neutral grade with gentle warmth, subtle handheld observational style" },
  fashion: { intent: "fashion", focalLength: "50mm or 105mm", aperture: "f/1.4", depthOfField: "extreme shallow",
    colorGrade: "editorial monochrome or pastel", motionStyle: "smooth slider",
    promptFragment: "shot on 50mm/105mm at f/1.4, extreme shallow DOF, editorial grade, smooth slider movement, Vogue cover aesthetic" },
  automotive: { intent: "automotive", focalLength: "24mm wide + 200mm tele", aperture: "f/8", depthOfField: "deep",
    colorGrade: "rich saturated with rim accents", motionStyle: "drone + crane",
    promptFragment: "wide 24mm establish + 200mm hero detail, f/8 deep DOF, rich saturated grade with rim accents, drone + crane choreography" },
  beauty: { intent: "beauty", focalLength: "100mm macro", aperture: "f/2.8", depthOfField: "shallow",
    colorGrade: "luminous pastel", motionStyle: "ultra-slow push-in",
    promptFragment: "shot on 100mm macro at f/2.8, shallow DOF, luminous pastel grade, ultra-slow push-in, dewy beauty aesthetic" },
  scientific: { intent: "scientific", focalLength: "60mm macro", aperture: "f/11", depthOfField: "deep",
    colorGrade: "neutral analytical", motionStyle: "locked-off",
    promptFragment: "shot on 60mm macro at f/11, deep DOF, neutral analytical grade, locked-off camera, laboratory documentation aesthetic" },
};

// ───────────────────────────────────────────────────────────────────────────
// 4. NEGATIVE PROMPT LIBRARY — canonical negative prompts per industry.
// ───────────────────────────────────────────────────────────────────────────

export type IndustrySegment =
  | "watches" | "jewelry" | "electronics" | "fragrance" | "beauty"
  | "fashion" | "automotive" | "lifestyle" | "general";

export const NEGATIVE_PROMPT_LIBRARY: Record<IndustrySegment, string> = {
  watches:    "deformed dial, distorted hands, missing numerals, crooked bezel, plastic-looking metal, blurry crown, double face, asymmetric lugs, cartoon, low-resolution, watermark, text artifacts",
  jewelry:    "deformed gemstones, asymmetric facets, missing prongs, plastic-looking metal, fake-looking diamonds, garish reflections, cartoon, low-resolution, watermark",
  electronics:"distorted screen, asymmetric body, fake buttons, plastic-looking aluminum, broken proportions, cartoon, low-resolution, watermark, text artifacts",
  fragrance:  "deformed bottle, asymmetric cap, distorted label text, double bottle, broken proportions, cartoon, low-resolution, watermark",
  beauty:     "distorted skin texture, plastic skin, asymmetric face, deformed packaging, garish makeup, cartoon, low-resolution, watermark",
  fashion:    "distorted body proportions, deformed hands, missing fingers, asymmetric face, cartoon, low-resolution, watermark, text artifacts",
  automotive: "distorted body lines, asymmetric wheels, deformed badges, broken proportions, cartoon, low-resolution, watermark, fake reflections",
  lifestyle:  "distorted body proportions, deformed hands, asymmetric face, cluttered background, cartoon, low-resolution, watermark",
  general:    "deformed, distorted, asymmetric, broken proportions, cartoon, anime, illustration, low-resolution, watermark, text artifacts, double exposure, motion blur where unwanted",
};

// ───────────────────────────────────────────────────────────────────────────
// 5. PRESENTER STYLES — identity-lock blocks for host avatars.
// ───────────────────────────────────────────────────────────────────────────

export type PresenterArchetype =
  | "executive_male"     // 30s, charcoal suit, watch boutique
  | "executive_female"   // 30s, structured blazer, modern showroom
  | "fashion_editor"     // 40s, monochrome editorial, bright neutral set
  | "scientist_expert"   // 40s, lab coat, clinical environment
  | "lifestyle_creator"; // 20s, casual chic, natural lighting

export interface PresenterStyleDefinition {
  archetype: PresenterArchetype;
  spanishLabel: string;
  identityPrompt: string;
  recommendedLighting: string;
  recommendedWardrobe: string;
}

export const PRESENTER_STYLES: Record<PresenterArchetype, PresenterStyleDefinition> = {
  executive_male: {
    archetype: "executive_male",
    spanishLabel: "Ejecutivo (Hombre)",
    identityPrompt: "A charismatic 30-year-old male executive, intelligent confident gaze, subtle warm smile, perfectly groomed dark hair, photorealistic skin textures with natural pores, 8K detail, looking directly at camera with the calm authority of a luxury brand spokesperson",
    recommendedLighting: "Rembrandt 45° key + soft rim",
    recommendedWardrobe: "tailored charcoal grey or midnight navy suit, crisp white shirt, no tie or knit tie",
  },
  executive_female: {
    archetype: "executive_female",
    spanishLabel: "Ejecutiva (Mujer)",
    identityPrompt: "A poised 30-year-old female executive, intelligent warm gaze, subtle confident smile, sleek modern hair, photorealistic skin textures with natural luminosity, 8K detail, looking directly at camera with the elegant authority of a luxury brand spokesperson",
    recommendedLighting: "beauty dish + grid + soft fill",
    recommendedWardrobe: "structured cream or charcoal blazer, minimalist jewelry, monochrome palette",
  },
  fashion_editor: {
    archetype: "fashion_editor",
    spanishLabel: "Editora de Moda",
    identityPrompt: "A sophisticated 40-year-old fashion editor, sharp intelligent gaze, refined neutral expression, signature monochrome styling, photorealistic skin textures with editorial polish, 8K detail, the air of a Vogue editor",
    recommendedLighting: "high-contrast editorial with hard key",
    recommendedWardrobe: "all-black or all-cream tailored monochrome, statement glasses optional",
  },
  scientist_expert: {
    archetype: "scientist_expert",
    spanishLabel: "Experto/Científico",
    identityPrompt: "A credible 40-year-old expert, intelligent analytical gaze, calm neutral expression, photorealistic skin textures with documentary realism, 8K detail, the trustworthy presence of a domain expert",
    recommendedLighting: "neutral soft frontal + ambient fill",
    recommendedWardrobe: "lab coat over neutral shirt OR clean technical knit, no logos",
  },
  lifestyle_creator: {
    archetype: "lifestyle_creator",
    spanishLabel: "Creador Lifestyle",
    identityPrompt: "An engaging 25-year-old lifestyle creator, warm authentic gaze, genuine smile, natural hair and skin, photorealistic skin textures with documentary warmth, 8K detail, the relatable energy of a top creator",
    recommendedLighting: "natural daylight + soft fill, golden hour aesthetic",
    recommendedWardrobe: "casual chic neutrals, minimal accessories",
  },
};

// ───────────────────────────────────────────────────────────────────────────
// 6. SHOT VOCABULARY — typed shot-type → camera-movement mapping.
// ───────────────────────────────────────────────────────────────────────────

export type ShotSize =
  | "extreme_wide" | "wide" | "medium_wide" | "medium" | "medium_close"
  | "close_up" | "extreme_close_up" | "macro" | "insert" | "over_the_shoulder";

export interface ShotDefinition {
  size: ShotSize;
  spanishLabel: string;
  recommendedFocalLength: string;
  defaultMovement: string;
  bestForShotType: ("presenter" | "b_roll" | "product")[];
}

export const SHOT_VOCABULARY: Record<ShotSize, ShotDefinition> = {
  extreme_wide:    { size: "extreme_wide",    spanishLabel: "Plano general extremo",  recommendedFocalLength: "16-24mm", defaultMovement: "drone aerial",                      bestForShotType: ["b_roll"] },
  wide:            { size: "wide",            spanishLabel: "Plano general",          recommendedFocalLength: "24-35mm", defaultMovement: "slow crane descent",                bestForShotType: ["presenter", "b_roll"] },
  medium_wide:     { size: "medium_wide",     spanishLabel: "Plano americano",        recommendedFocalLength: "35-50mm", defaultMovement: "subtle handheld",                   bestForShotType: ["presenter"] },
  medium:          { size: "medium",          spanishLabel: "Plano medio",            recommendedFocalLength: "50-85mm", defaultMovement: "locked-off with micro-bob",         bestForShotType: ["presenter"] },
  medium_close:    { size: "medium_close",    spanishLabel: "Plano medio corto",      recommendedFocalLength: "85mm",    defaultMovement: "ultra-slow push-in",                bestForShotType: ["presenter"] },
  close_up:        { size: "close_up",        spanishLabel: "Primer plano",           recommendedFocalLength: "85-105mm",defaultMovement: "static lock-off",                   bestForShotType: ["presenter", "product"] },
  extreme_close_up:{ size: "extreme_close_up",spanishLabel: "Primerísimo primer plano",recommendedFocalLength: "100-200mm",defaultMovement: "rack focus pull",                  bestForShotType: ["presenter", "product"] },
  macro:           { size: "macro",           spanishLabel: "Macro",                  recommendedFocalLength: "100mm macro",defaultMovement: "slow probe-lens push",          bestForShotType: ["product", "b_roll"] },
  insert:          { size: "insert",          spanishLabel: "Plano detalle (inserto)",recommendedFocalLength: "60-100mm", defaultMovement: "static",                            bestForShotType: ["product", "b_roll"] },
  over_the_shoulder:{size: "over_the_shoulder",spanishLabel: "Sobre el hombro",       recommendedFocalLength: "50mm",    defaultMovement: "subtle parallax",                   bestForShotType: ["presenter"] },
};

// ───────────────────────────────────────────────────────────────────────────
// 7. CONTINUITY TOKENS — Visual DNA Persistence helpers.
// Tiny prompt fragments that get appended to every clip in a long-form ad to
// keep the look LOCKED across cuts (the "stitch logic" idea).
// ───────────────────────────────────────────────────────────────────────────

export interface ContinuityToken {
  id: string;
  spanishLabel: string;
  fragment: string;
}

export const CONTINUITY_TOKENS: ContinuityToken[] = [
  { id: "cnt:light_lock_top_right",  spanishLabel: "Luz fija top-right 45°",   fragment: "key light fixed at top-right 45° softbox throughout, consistent shadow direction" },
  { id: "cnt:dust_motes_low",        spanishLabel: "Dust motes baja densidad", fragment: "consistent floating dust motes at 0.05 density, identical particle behavior" },
  { id: "cnt:focal_85_product",      spanishLabel: "85mm para producto",       fragment: "85mm focal length locked for product shots, identical compression" },
  { id: "cnt:gold_lut",              spanishLabel: "LUT oro maestro",          fragment: "Master Gold LUT applied for color continuity, identical white balance and tonality" },
  { id: "cnt:teal_lut",              spanishLabel: "LUT teal maestro",         fragment: "Master Teal LUT applied for color continuity, identical white balance and tonality" },
  { id: "cnt:micro_reflections",     spanishLabel: "Micro-reflejos persistentes", fragment: "preserve identical micro-reflections on subject across cuts, frame-to-frame matching" },
  { id: "cnt:atmospheric_haze_low",  spanishLabel: "Bruma atmosférica baja",   fragment: "subtle atmospheric haze at 5% density, consistent throughout sequence" },
];

// ───────────────────────────────────────────────────────────────────────────
// PUBLIC ACCESS API — used by REST endpoints and templates.
// ───────────────────────────────────────────────────────────────────────────

export interface KnowledgeBaseSummary {
  opticalTechniqueCount: number;
  actionTokenCount: number;
  cinematographyPresetCount: number;
  presenterStyleCount: number;
  shotVocabularyCount: number;
  continuityTokenCount: number;
  industrySegments: IndustrySegment[];
}

export function getKnowledgeBaseSummary(): KnowledgeBaseSummary {
  return {
    opticalTechniqueCount: OPTICAL_TECHNIQUES.length,
    actionTokenCount: Object.keys(ACTION_TOKENS).length,
    cinematographyPresetCount: Object.keys(CINEMATOGRAPHY_PRESETS).length,
    presenterStyleCount: Object.keys(PRESENTER_STYLES).length,
    shotVocabularyCount: Object.keys(SHOT_VOCABULARY).length,
    continuityTokenCount: CONTINUITY_TOKENS.length,
    industrySegments: Object.keys(NEGATIVE_PROMPT_LIBRARY) as IndustrySegment[],
  };
}

export function getFullKnowledgeBase() {
  return {
    opticalTechniques: OPTICAL_TECHNIQUES,
    actionTokens: ACTION_TOKENS,
    cinematographyPresets: CINEMATOGRAPHY_PRESETS,
    negativePromptLibrary: NEGATIVE_PROMPT_LIBRARY,
    presenterStyles: PRESENTER_STYLES,
    shotVocabulary: SHOT_VOCABULARY,
    continuityTokens: CONTINUITY_TOKENS,
  };
}

/**
 * Compose a "director-grade" prompt fragment by combining picks from the
 * knowledge base. Pure transformation, no IA call. Safe to call from
 * anywhere (templates, ad-hoc compositions, REST endpoint).
 *
 * The returned fragment is meant to be CONCATENATED to a base subject prompt
 * (e.g. "Rolex Datejust 41mm in champagne with diamond hour markers") — it
 * provides only the cinematic layer (lens, lighting, grade, motion).
 */
export function composeProfessionalPromptFragment(opts: {
  intent: CinematographyIntent;
  industry: IndustrySegment;
  opticalTechniqueIds?: string[];
  continuityTokenIds?: string[];
  actionTokens?: ActionToken[];
}): { promptFragment: string; negativePrompt: string } {
  const preset = CINEMATOGRAPHY_PRESETS[opts.intent];
  const optical = (opts.opticalTechniqueIds || [])
    .map(id => OPTICAL_TECHNIQUES.find(o => o.id === id)?.promptFragment)
    .filter((s): s is string => !!s);
  const continuity = (opts.continuityTokenIds || [])
    .map(id => CONTINUITY_TOKENS.find(c => c.id === id)?.fragment)
    .filter((s): s is string => !!s);
  const actions = (opts.actionTokens || [])
    .map(t => ACTION_TOKENS[t]?.promptExpansion)
    .filter((s): s is string => !!s);

  const parts = [preset.promptFragment, ...optical, ...actions, ...continuity];
  return {
    promptFragment: parts.filter(Boolean).join(". "),
    negativePrompt: NEGATIVE_PROMPT_LIBRARY[opts.industry] || NEGATIVE_PROMPT_LIBRARY.general,
  };
}
