// ═══════════════════════════════════════════════════════════════════════════
// ADVERTISING PLAYBOOK KNOWLEDGE BASE (May 2026)
// ═══════════════════════════════════════════════════════════════════════════
// Crystallized from: Universal AI Advertising Playbook v2, Ultimate Prompt
// System 2026, Video Campaign Production Kit, UGC + Lip Sync 6-Second Kit,
// and 5 Real-World Campaign Examples.
//
// This is the strategic layer that sits ABOVE the cinematic-knowledge-base
// (which provides raw production vocabulary). This module provides:
//   • BRAND_DNA_FRAMEWORK    → 5-Pillar method for any brand
//   • CAMPAIGN_TYPES         → 6 campaign objectives with strategies
//   • UGC_ARCHETYPES         → industry-specific UGC styles
//   • MASTER_PROMPT_FORMULA  → universal prompt structure
//   • MICRO_CLIP_METHOD      → 6-second production methodology
//   • PRODUCTION_WORKFLOW    → 7-step end-to-end workflow
//   • CONCATENATION_STRATEGIES → intelligent multi-clip flow
//   • INDUSTRY_PROMPT_TEMPLATES → per-type 6-second prompts
//   • VIDEO_TECH_SPECS       → resolution, framerate, audio specs
//   • AI_VIDEO_TOOLS         → ranked tool recommendations
//
// All entries are deterministic (no AI calls). Designed to be:
//   1) Read by compose helpers to generate campaign briefs + prompts
//   2) Exposed via REST for frontend pickers/wizards
//   3) Fed as context to Claude for intelligent campaign generation
// ═══════════════════════════════════════════════════════════════════════════

// ───────────────────────────────────────────────────────────────────────────
// 1. BRAND DNA FRAMEWORK — 5-Pillar Method (works for any brand)
// ───────────────────────────────────────────────────────────────────────────

export interface BrandDnaPillar {
  pillar: number;
  id: string;
  name: string;
  spanishName: string;
  question: string;
  spanishQuestion: string;
  examples: string[];
}

export const BRAND_DNA_FRAMEWORK: BrandDnaPillar[] = [
  { pillar: 1, id: "dna:core_offering", name: "Core Offering", spanishName: "Oferta principal",
    question: "What do they sell and what problem do they solve?",
    spanishQuestion: "¿Qué venden y qué problema resuelven?",
    examples: ["Premium watches for professionals", "Sustainable streetwear", "AI productivity app", "Luxury car rental"] },
  { pillar: 2, id: "dna:target_audience", name: "Target Audience", spanishName: "Audiencia objetivo",
    question: "Who is the ideal customer and what do they really want?",
    spanishQuestion: "¿Quién es el cliente ideal y qué quiere realmente?",
    examples: ["Professionals 30-55 who value status", "Gen-Z eco-conscious urbanites", "Busy freelancers losing time", "Business travelers seeking experience"] },
  { pillar: 3, id: "dna:tone_of_voice", name: "Tone of Voice", spanishName: "Tono de voz",
    question: "How should the brand sound? (Premium, Friendly, Expert, Bold, etc.)",
    spanishQuestion: "¿Cómo debe sonar la marca? (Premium, Cercano, Experto, Audaz, etc.)",
    examples: ["Premium but accessible", "Warm and trustworthy expert", "Bold and disruptive", "Calm authoritative"] },
  { pillar: 4, id: "dna:visual_identity", name: "Visual Identity", spanishName: "Identidad visual",
    question: "Colors, style, and feeling that represent the brand",
    spanishQuestion: "Colores, estilo y sensación que representan la marca",
    examples: ["Black + Gold + Jade dark premium", "Pastel minimalist sustainable", "Electric blue + white tech-clean", "Deep navy + champagne luxury"] },
  { pillar: 5, id: "dna:emotional_benefit", name: "Emotional Benefit", spanishName: "Beneficio emocional",
    question: "The deep feeling the customer gets after buying",
    spanishQuestion: "El sentimiento profundo que obtiene el cliente después de comprar",
    examples: ["I belong to an exclusive circle", "I'm making a difference", "I have my time back", "Freedom to drive my dream car"] },
];

export interface QuickResearchStep {
  step: number;
  action: string;
  spanishAction: string;
  timeMinutes: number;
}

export const QUICK_RESEARCH_METHOD: QuickResearchStep[] = [
  { step: 1, action: "Read homepage + About page", spanishAction: "Leer página principal + Sobre nosotros", timeMinutes: 5 },
  { step: 2, action: "Check Instagram/TikTok/LinkedIn for last 20 posts", spanishAction: "Revisar últimos 20 posts de Instagram/TikTok/LinkedIn", timeMinutes: 10 },
  { step: 3, action: "Read 10 recent customer reviews", spanishAction: "Leer 10 reseñas recientes de clientes", timeMinutes: 5 },
  { step: 4, action: "Identify 3 competitors and note what they do differently", spanishAction: "Identificar 3 competidores y anotar diferencias", timeMinutes: 7 },
  { step: 5, action: "Write the 5-Pillar summary", spanishAction: "Escribir el resumen de los 5 pilares", timeMinutes: 3 },
];

// ───────────────────────────────────────────────────────────────────────────
// 2. CAMPAIGN TYPES — 6 most common campaign objectives
// ───────────────────────────────────────────────────────────────────────────

export type CampaignObjective =
  | "awareness" | "conversion" | "product_launch"
  | "retargeting" | "testimonial" | "educational";

export interface CampaignTypeDefinition {
  objective: CampaignObjective;
  name: string;
  spanishName: string;
  focus: string;
  spanishFocus: string;
  narrativeStructure: string;
  recommendedDurationSec: number[];
  recommendedUgcStyles: string[];
  promptTemplate6Sec: string;
  keyEmotions: string[];
}

export const CAMPAIGN_TYPES: Record<CampaignObjective, CampaignTypeDefinition> = {
  awareness: {
    objective: "awareness", name: "Awareness / Brand Building", spanishName: "Conocimiento de marca",
    focus: "Emotional storytelling, founder story, mission, behind the scenes",
    spanishFocus: "Storytelling emocional, historia del fundador, misión, detrás de cámaras",
    narrativeStructure: "Hook → Emotional story → Brand reveal → Soft CTA",
    recommendedDurationSec: [6, 15, 22, 30],
    recommendedUgcStyles: ["lifestyle", "talking_head", "behind_the_scenes"],
    promptTemplate6Sec: "6-second vertical video in cinematic but authentic style. [Presenter] looking at camera with emotional expression and perfect lip sync: \"[Emotional story or mission line]\". Soft lighting, genuine feeling. High quality.",
    keyEmotions: ["inspiration", "trust", "belonging", "wonder"],
  },
  conversion: {
    objective: "conversion", name: "Conversion / Direct Response", spanishName: "Conversión directa",
    focus: "Problem → Solution → Proof → Offer → CTA",
    spanishFocus: "Problema → Solución → Prueba → Oferta → CTA",
    narrativeStructure: "Pain point → Solution reveal → Social proof → Urgency → CTA",
    recommendedDurationSec: [6, 10, 15],
    recommendedUgcStyles: ["talking_head", "problem_solution", "unboxing"],
    promptTemplate6Sec: "6-second vertical video in realistic UGC style, natural lighting. [Presenter] speaking directly to camera with perfect lip sync: \"[Problem] → [Solution] → [Result]\". Warm, trustworthy, expert tone. High quality.",
    keyEmotions: ["urgency", "relief", "confidence", "trust"],
  },
  product_launch: {
    objective: "product_launch", name: "Product Launch", spanishName: "Lanzamiento de producto",
    focus: "Teaser → Reveal → Benefits → Social Proof → Limited offer",
    spanishFocus: "Teaser → Revelación → Beneficios → Prueba social → Oferta limitada",
    narrativeStructure: "Mystery teaser → Big reveal → Key benefits × 3 → Social proof → Scarcity CTA",
    recommendedDurationSec: [6, 15, 22, 25],
    recommendedUgcStyles: ["unboxing", "try_on", "first_impression", "talking_head"],
    promptTemplate6Sec: "6-second vertical video in energetic UGC style. [Presenter] speaking with excitement and perfect lip sync: \"[Big news or launch line]\". Bright lighting, confident energy. High quality.",
    keyEmotions: ["excitement", "exclusivity", "curiosity", "desire"],
  },
  retargeting: {
    objective: "retargeting", name: "Retargeting / Warm Audience", spanishName: "Retargeting / Audiencia tibia",
    focus: "Testimonial, Case study, \"You might have missed this\", Scarcity",
    spanishFocus: "Testimonio, Caso de estudio, \"Quizás te perdiste esto\", Escasez",
    narrativeStructure: "Reminder hook → Social proof → Specific result → Limited availability → CTA",
    recommendedDurationSec: [6, 10, 15],
    recommendedUgcStyles: ["testimonial", "case_study", "talking_head"],
    promptTemplate6Sec: "6-second vertical video in authentic UGC style. [Presenter] speaking with calm credibility and perfect lip sync: \"[Specific result or testimonial]\". Natural lighting, trustworthy tone. High quality.",
    keyEmotions: ["fomo", "trust", "validation", "urgency"],
  },
  testimonial: {
    objective: "testimonial", name: "Testimonial / Social Proof", spanishName: "Testimonio / Prueba social",
    focus: "Real customer stories, before/after, results",
    spanishFocus: "Historias reales de clientes, antes/después, resultados",
    narrativeStructure: "Before state → Discovery → Transformation → Specific result → Recommendation",
    recommendedDurationSec: [6, 15, 22, 30],
    recommendedUgcStyles: ["talking_head", "before_after", "day_in_life"],
    promptTemplate6Sec: "6-second vertical video in authentic documentary UGC style. [Customer] speaking genuinely to camera with perfect lip sync: \"[Personal result or transformation story]\". Natural home/office setting, real and unscripted feel. High quality.",
    keyEmotions: ["authenticity", "transformation", "hope", "relatability"],
  },
  educational: {
    objective: "educational", name: "Educational / Value-Driven", spanishName: "Educativo / Valor",
    focus: "Teach something valuable → Position as expert → Soft CTA",
    spanishFocus: "Enseñar algo valioso → Posicionarse como experto → CTA suave",
    narrativeStructure: "Surprising insight → Teach method/tip → Prove expertise → Soft CTA",
    recommendedDurationSec: [6, 15, 22, 30],
    recommendedUgcStyles: ["talking_head", "screen_recording", "explainer"],
    promptTemplate6Sec: "6-second vertical video in professional but approachable style. [Expert] speaking directly to camera with perfect lip sync and calm authority: \"[Valuable insight or teaching point]\". Clean background, expert energy. High quality.",
    keyEmotions: ["curiosity", "trust", "empowerment", "admiration"],
  },
};

// ───────────────────────────────────────────────────────────────────────────
// 3. UGC ARCHETYPES — Recommended styles by industry
// ───────────────────────────────────────────────────────────────────────────

export type UgcIndustry =
  | "fashion_beauty" | "saas_software" | "ecommerce_physical"
  | "services_coaching" | "health_wellness" | "b2b_enterprise"
  | "automotive" | "food_beverage" | "real_estate" | "education";

export interface UgcArchetype {
  industry: UgcIndustry;
  name: string;
  spanishName: string;
  recommendedStyles: string[];
  spanishStyles: string[];
  presenterDescription: string;
  toneOfVoice: string;
  bestPlatforms: string[];
  exampleHook: string;
}

export const UGC_ARCHETYPES: Record<UgcIndustry, UgcArchetype> = {
  fashion_beauty: {
    industry: "fashion_beauty", name: "Fashion / Beauty", spanishName: "Moda / Belleza",
    recommendedStyles: ["lifestyle", "try_on", "before_after", "get_ready_with_me"],
    spanishStyles: ["Lifestyle", "Prueba de producto", "Antes/Después", "Arréglate conmigo"],
    presenterDescription: "Confident woman/man, modern style, natural makeup, relatable and aspirational",
    toneOfVoice: "Warm, authentic, aspirational but accessible",
    bestPlatforms: ["Instagram Reels", "TikTok", "Pinterest"],
    exampleHook: "This new collection is made from 100% recycled materials... but it feels like luxury.",
  },
  saas_software: {
    industry: "saas_software", name: "SaaS / Software", spanishName: "SaaS / Software",
    recommendedStyles: ["screen_recording", "talking_head", "customer_testimonial"],
    spanishStyles: ["Grabación de pantalla", "Cabeza parlante", "Testimonio de cliente"],
    presenterDescription: "Founder or power-user, clean desk setup, professional but approachable",
    toneOfVoice: "Calm expert, problem-solver, data-driven but human",
    bestPlatforms: ["LinkedIn", "YouTube", "Twitter/X"],
    exampleHook: "I used to lose 2 hours every day switching between tools. Now it does it for me.",
  },
  ecommerce_physical: {
    industry: "ecommerce_physical", name: "E-commerce / Physical Products", spanishName: "E-commerce / Productos físicos",
    recommendedStyles: ["unboxing", "real_use", "problem_solution"],
    spanishStyles: ["Unboxing", "Uso real", "Problema → Solución"],
    presenterDescription: "Real customer type, bright natural setting, product visible throughout",
    toneOfVoice: "Energetic, genuine surprise, natural enthusiasm",
    bestPlatforms: ["TikTok", "Instagram Reels", "Facebook"],
    exampleHook: "This new mango flavor actually makes me look forward to taking my vitamins every morning.",
  },
  services_coaching: {
    industry: "services_coaching", name: "Services / Coaching / Agencies", spanishName: "Servicios / Coaching / Agencias",
    recommendedStyles: ["talking_head", "case_study", "day_in_life"],
    spanishStyles: ["Cabeza parlante", "Caso de estudio", "Un día en mi vida"],
    presenterDescription: "Coach/founder, warm confident presence, home office or modern workspace",
    toneOfVoice: "Inspiring, direct, emotionally intelligent",
    bestPlatforms: ["Instagram", "LinkedIn", "YouTube"],
    exampleHook: "Most people I work with don't need more strategy... they need to stop overthinking and start executing.",
  },
  health_wellness: {
    industry: "health_wellness", name: "Health & Wellness", spanishName: "Salud y bienestar",
    recommendedStyles: ["transformation_story", "expert_explanation", "daily_routine"],
    spanishStyles: ["Historia de transformación", "Explicación de experto", "Rutina diaria"],
    presenterDescription: "Health professional or transformed customer, active lifestyle visual",
    toneOfVoice: "Empathetic, knowledgeable, motivating without being pushy",
    bestPlatforms: ["Instagram", "TikTok", "YouTube"],
    exampleHook: "After 6 months of this routine, my energy levels are completely different. Here's exactly what I do.",
  },
  b2b_enterprise: {
    industry: "b2b_enterprise", name: "B2B / Enterprise", spanishName: "B2B / Enterprise",
    recommendedStyles: ["professional_talking_head", "data_driven", "customer_story"],
    spanishStyles: ["Cabeza parlante profesional", "Basado en datos", "Historia de cliente"],
    presenterDescription: "Operations director or C-level, modern office, polished but real",
    toneOfVoice: "Authoritative, data-backed, credible, calm confidence",
    bestPlatforms: ["LinkedIn", "YouTube", "Google Ads"],
    exampleHook: "We reduced project delays by 47% in the first 90 days.",
  },
  automotive: {
    industry: "automotive", name: "Automotive", spanishName: "Automoción",
    recommendedStyles: ["virtual_drive", "deconstruction", "lifestyle_aspiration"],
    spanishStyles: ["Conducción virtual", "Deconstrucción", "Aspiración lifestyle"],
    presenterDescription: "Professional driver or lifestyle customer, golden hour, premium locations",
    toneOfVoice: "Premium, experiential, freedom-focused",
    bestPlatforms: ["YouTube", "Instagram", "TikTok"],
    exampleHook: "This is the car I always dreamed of. Today I drive it without buying it.",
  },
  food_beverage: {
    industry: "food_beverage", name: "Food & Beverage", spanishName: "Alimentación y bebidas",
    recommendedStyles: ["recipe_demo", "taste_test", "behind_the_scenes"],
    spanishStyles: ["Demo de receta", "Prueba de sabor", "Detrás de cámaras"],
    presenterDescription: "Chef, foodie, or everyday person in kitchen/restaurant setting",
    toneOfVoice: "Sensory, appetizing, passionate, authentic",
    bestPlatforms: ["TikTok", "Instagram Reels", "YouTube Shorts"],
    exampleHook: "You won't believe this is made with only 3 ingredients.",
  },
  real_estate: {
    industry: "real_estate", name: "Real Estate", spanishName: "Inmobiliaria",
    recommendedStyles: ["property_tour", "neighborhood_lifestyle", "before_after_renovation"],
    spanishStyles: ["Tour de propiedad", "Lifestyle del barrio", "Antes/Después renovación"],
    presenterDescription: "Agent or homeowner, professional but warm, property-focused",
    toneOfVoice: "Aspirational, informative, trustworthy",
    bestPlatforms: ["Instagram", "YouTube", "Facebook"],
    exampleHook: "This 2-bedroom just listed at 30% below market. Here's why.",
  },
  education: {
    industry: "education", name: "Education / Online Courses", spanishName: "Educación / Cursos online",
    recommendedStyles: ["teaching_snippet", "student_result", "whiteboard_explainer"],
    spanishStyles: ["Fragmento de clase", "Resultado de alumno", "Explicación en pizarra"],
    presenterDescription: "Teacher/professor, clean background, educational setting",
    toneOfVoice: "Knowledgeable, patient, engaging, curious",
    bestPlatforms: ["YouTube", "TikTok", "LinkedIn"],
    exampleHook: "In 60 seconds I'll teach you something most people learn in 4 years of college.",
  },
};

// ───────────────────────────────────────────────────────────────────────────
// 4. MASTER PROMPT FORMULA — Universal structure for any video prompt
// ───────────────────────────────────────────────────────────────────────────

export interface PromptFormulaComponent {
  order: number;
  id: string;
  name: string;
  spanishName: string;
  description: string;
  isRequired: boolean;
  placeholder: string;
}

export const MASTER_PROMPT_FORMULA: PromptFormulaComponent[] = [
  { order: 1, id: "mpf:duration", name: "Duration", spanishName: "Duración", isRequired: true,
    description: "Exact duration of the clip in seconds",
    placeholder: "[X]-second" },
  { order: 2, id: "mpf:orientation", name: "Orientation", spanishName: "Orientación", isRequired: true,
    description: "Vertical (9:16) or Horizontal (16:9)",
    placeholder: "vertical video" },
  { order: 3, id: "mpf:style", name: "Style", spanishName: "Estilo", isRequired: true,
    description: "Visual style (UGC, cinematic, editorial, product hero, etc.)",
    placeholder: "in [realistic UGC / premium cinematic / editorial] style" },
  { order: 4, id: "mpf:presenter", name: "Presenter Description", spanishName: "Descripción del presentador", isRequired: false,
    description: "Physical description of the person on camera (age, look, wardrobe, energy)",
    placeholder: "[Age]-year-old [gender] ([appearance details])" },
  { order: 5, id: "mpf:action", name: "Action + Emotion", spanishName: "Acción + Emoción", isRequired: true,
    description: "What the presenter/subject does and their emotional state",
    placeholder: "speaking directly to camera with [emotion]" },
  { order: 6, id: "mpf:script", name: "Exact Script Line", spanishName: "Línea de guión exacta", isRequired: false,
    description: "The exact words spoken (for lip sync)",
    placeholder: "\"[Exact dialogue line]\"" },
  { order: 7, id: "mpf:camera", name: "Camera Movement", spanishName: "Movimiento de cámara", isRequired: true,
    description: "How the camera moves during the clip",
    placeholder: "[tracking / orbit / push-in / handheld / static]" },
  { order: 8, id: "mpf:lighting", name: "Lighting & Background", spanishName: "Iluminación y fondo", isRequired: true,
    description: "Lighting setup and background environment",
    placeholder: "[natural / studio / golden hour] lighting, [background description]" },
  { order: 9, id: "mpf:quality", name: "Quality Boosters", spanishName: "Potenciadores de calidad", isRequired: true,
    description: "Final quality descriptors",
    placeholder: "High quality, [photorealistic / 8K / natural skin texture]" },
  { order: 10, id: "mpf:lip_sync", name: "Lip Sync Instruction", spanishName: "Instrucción de lip sync", isRequired: false,
    description: "Lip sync directive for talking-head clips",
    placeholder: "perfect lip sync, mouth moves naturally and exactly with the voice" },
];

// ───────────────────────────────────────────────────────────────────────────
// 5. MICRO-CLIP METHOD — 6-second production methodology
// ───────────────────────────────────────────────────────────────────────────

export interface MicroClipRule {
  id: string;
  rule: string;
  spanishRule: string;
  rationale: string;
}

export const MICRO_CLIP_METHOD: MicroClipRule[] = [
  { id: "mc:optimal_duration", rule: "Use 5-8 second clips for highest AI quality",
    spanishRule: "Usar clips de 5-8 segundos para máxima calidad IA",
    rationale: "Modern AI video tools (Kling, Runway, Luma, Grok Imagine) produce dramatically better results with short clips vs long generation." },
  { id: "mc:6sec_standard", rule: "6 seconds is the sweet spot for micro-clips",
    spanishRule: "6 segundos es el punto óptimo para micro-clips",
    rationale: "Long enough for one complete thought/action, short enough for maximum AI quality control." },
  { id: "mc:parallel_generation", rule: "Generate all clips in parallel, not sequential",
    spanishRule: "Generar todos los clips en paralelo, no secuencial",
    rationale: "Parallel generation saves time and allows A/B selection of best takes per position." },
  { id: "mc:character_lock", rule: "Use same reference image for character consistency across all clips",
    spanishRule: "Usar la misma imagen de referencia para consistencia del personaje",
    rationale: "Character lock (IP-Adapter / Image Reference) ensures the same person appears in every clip." },
  { id: "mc:voice_first", rule: "Record voice-over first, then generate video to match",
    spanishRule: "Grabar voz primero, luego generar vídeo que coincida",
    rationale: "Audio pacing drives visual pacing. Generate video to match the voice, not the other way around." },
  { id: "mc:golden_transition", rule: "Use golden light wipe or soft dissolve between clips",
    spanishRule: "Usar transición de luz dorada o dissolve suave entre clips",
    rationale: "Consistent transitions create the illusion of a single continuous shot from multiple AI generations." },
  { id: "mc:continuous_music", rule: "Use one continuous music track across all clips",
    spanishRule: "Usar una pista musical continua para todos los clips",
    rationale: "Music bed exported as full-length WAV first, then clips edited on top. Music is the glue." },
  { id: "mc:color_grade_unity", rule: "Apply identical LUT/color grade to all clips",
    spanishRule: "Aplicar LUT/color grade idéntico a todos los clips",
    rationale: "Same color science across clips creates visual cohesion even from different AI generations." },
];

// ───────────────────────────────────────────────────────────────────────────
// 6. PRODUCTION WORKFLOW — 7-step end-to-end method
// ───────────────────────────────────────────────────────────────────────────

export interface ProductionStep {
  step: number;
  name: string;
  spanishName: string;
  description: string;
  estimatedMinutes: number;
  tools: string[];
}

export const PRODUCTION_WORKFLOW: ProductionStep[] = [
  { step: 1, name: "Extract Brand DNA", spanishName: "Extraer ADN de marca", estimatedMinutes: 25,
    description: "Apply the 5-Pillar method to understand the brand deeply",
    tools: ["Website analysis", "Social media audit", "Review mining", "Competitor scan"] },
  { step: 2, name: "Define Campaign Strategy", spanishName: "Definir estrategia de campaña", estimatedMinutes: 15,
    description: "Choose campaign objective and matching UGC style from archetypes",
    tools: ["Campaign type selector", "UGC archetype matcher", "Audience targeting"] },
  { step: 3, name: "Create Presenter Reference", spanishName: "Crear referencia del presentador", estimatedMinutes: 10,
    description: "Generate ONE reference image of the presenter for character consistency",
    tools: ["AI image generation", "Character lock reference", "IP-Adapter"] },
  { step: 4, name: "Write 6-Second Prompts", spanishName: "Escribir prompts de 6 segundos", estimatedMinutes: 30,
    description: "Write all micro-clip prompts using the Master Prompt Formula + 7-Layer system",
    tools: ["Master Prompt Formula", "Timeline Layers", "Knowledge Base vocabulary"] },
  { step: 5, name: "Generate Clips + Voice", spanishName: "Generar clips + voz", estimatedMinutes: 60,
    description: "Generate all video clips in parallel and record voice-over",
    tools: ["Kling AI", "Runway Gen-3", "ElevenLabs", "Professional studio"] },
  { step: 6, name: "Edit + Grade + Export", spanishName: "Editar + colorizar + exportar", estimatedMinutes: 120,
    description: "Concatenate clips, add transitions, color grade, and export",
    tools: ["CapCut", "DaVinci Resolve", "Premiere Pro"] },
  { step: 7, name: "Launch + Measure + Iterate", spanishName: "Lanzar + medir + iterar", estimatedMinutes: 30,
    description: "Deploy to ad accounts, set up A/B tests, track metrics, iterate",
    tools: ["Meta Ads Manager", "Google Ads", "TikTok Ads", "Analytics"] },
];

// ───────────────────────────────────────────────────────────────────────────
// 7. CONCATENATION STRATEGIES — Intelligent multi-clip flow
// ───────────────────────────────────────────────────────────────────────────

export type TransitionType = "golden_light_wipe" | "soft_dissolve" | "particle_burst" | "robotic_sweep" | "graph_burst" | "golden_beam" | "orbit_fade" | "cut";

export interface ConcatenationTransition {
  type: TransitionType;
  spanishLabel: string;
  durationSec: number;
  promptFragment: string;
  bestBetween: string;
}

export const CONCATENATION_TRANSITIONS: Record<TransitionType, ConcatenationTransition> = {
  golden_light_wipe: { type: "golden_light_wipe", spanishLabel: "Barrido de luz dorada", durationSec: 2,
    promptFragment: "golden light wipe transition sweeping left to right",
    bestBetween: "narrative scenes" },
  soft_dissolve: { type: "soft_dissolve", spanishLabel: "Dissolve suave", durationSec: 1.5,
    promptFragment: "soft dissolve cross-fade with gentle opacity blend",
    bestBetween: "emotional → informational" },
  particle_burst: { type: "particle_burst", spanishLabel: "Explosión de partículas", durationSec: 2,
    promptFragment: "golden particle burst expanding from center into next scene",
    bestBetween: "data reveal → next topic" },
  robotic_sweep: { type: "robotic_sweep", spanishLabel: "Barrido robótico", durationSec: 1.5,
    promptFragment: "mechanical robotic arm sweeps scene into next frame",
    bestBetween: "tech/construction scenes" },
  graph_burst: { type: "graph_burst", spanishLabel: "Gráfico burst", durationSec: 2,
    promptFragment: "graph lines burst into particles that reform as next scene",
    bestBetween: "data/results → CTA" },
  golden_beam: { type: "golden_beam", spanishLabel: "Rayo dorado", durationSec: 3,
    promptFragment: "vertical golden light beam splits screen, transforms scene",
    bestBetween: "before/after comparison" },
  orbit_fade: { type: "orbit_fade", spanishLabel: "Fade orbital", durationSec: 2,
    promptFragment: "previous scene orbits and fades as camera pushes through to next",
    bestBetween: "final scene → CTA" },
  cut: { type: "cut", spanishLabel: "Corte directo", durationSec: 0,
    promptFragment: "hard cut on action",
    bestBetween: "fast-paced sequences" },
};

// ───────────────────────────────────────────────────────────────────────────
// 8. VIDEO TECHNICAL SPECIFICATIONS
// ───────────────────────────────────────────────────────────────────────────

export interface VideoSpec {
  id: string;
  name: string;
  resolution: string;
  aspectRatio: string;
  fps: number;
  codec: string;
  bitrateMbps: string;
  useCase: string;
}

export const VIDEO_TECH_SPECS: VideoSpec[] = [
  { id: "spec:vertical_primary", name: "Primary Vertical", resolution: "1080×1920", aspectRatio: "9:16", fps: 30, codec: "H.264", bitrateMbps: "8-12", useCase: "Instagram Reels, TikTok, YouTube Shorts" },
  { id: "spec:horizontal_secondary", name: "Secondary Horizontal", resolution: "1920×1080", aspectRatio: "16:9", fps: 30, codec: "H.264", bitrateMbps: "15-20", useCase: "YouTube, LinkedIn, Website" },
  { id: "spec:master_cinematic", name: "Master Cinematic", resolution: "1920×1080", aspectRatio: "2.35:1 letterbox", fps: 24, codec: "H.264/ProRes", bitrateMbps: "20-50", useCase: "Website hero, presentations, master cut" },
  { id: "spec:audio", name: "Audio Standard", resolution: "48kHz 24-bit", aspectRatio: "N/A", fps: 0, codec: "WAV/AAC", bitrateMbps: "-14 LUFS, -1 dBTP max", useCase: "All video exports" },
];

export interface AiVideoTool {
  rank: number;
  name: string;
  bestFor: string;
  characterConsistency: number;
  cinematicQuality: number;
  speedSec: number;
}

export const AI_VIDEO_TOOLS: AiVideoTool[] = [
  { rank: 1, name: "Kling AI 2.1", bestFor: "Best character consistency + motion", characterConsistency: 95, cinematicQuality: 90, speedSec: 45 },
  { rank: 2, name: "Runway Gen-3 Alpha", bestFor: "Best prompt adherence + cinematic quality", characterConsistency: 85, cinematicQuality: 95, speedSec: 60 },
  { rank: 3, name: "Luma Dream Machine", bestFor: "Best 3D/complex scenes", characterConsistency: 80, cinematicQuality: 88, speedSec: 50 },
  { rank: 4, name: "Seedance 2.0", bestFor: "Best motion quality + physics", characterConsistency: 88, cinematicQuality: 92, speedSec: 55 },
  { rank: 5, name: "Pika Labs 2.1", bestFor: "Fastest iteration speed", characterConsistency: 75, cinematicQuality: 82, speedSec: 20 },
];

// ───────────────────────────────────────────────────────────────────────────
// COMPOSE HELPERS — Pure transformation functions (no AI calls)
// ───────────────────────────────────────────────────────────────────────────

export interface CampaignBrief {
  brandDna: Record<string, string>;
  campaignType: CampaignTypeDefinition;
  ugcArchetype: UgcArchetype;
  recommendedClipCount: number;
  totalDurationSec: number;
  narrativeArc: string;
  promptTemplate: string;
}

export function composeCampaignBrief(opts: {
  brandName: string;
  industry: UgcIndustry;
  objective: CampaignObjective;
  brandDna?: Partial<Record<string, string>>;
}): CampaignBrief {
  const campaign = CAMPAIGN_TYPES[opts.objective];
  const ugc = UGC_ARCHETYPES[opts.industry];
  const clipCount = Math.ceil(Math.max(...campaign.recommendedDurationSec) / 6);

  return {
    brandDna: {
      brandName: opts.brandName,
      industry: ugc.spanishName,
      ...(opts.brandDna || {}),
    },
    campaignType: campaign,
    ugcArchetype: ugc,
    recommendedClipCount: clipCount,
    totalDurationSec: Math.max(...campaign.recommendedDurationSec),
    narrativeArc: campaign.narrativeStructure,
    promptTemplate: campaign.promptTemplate6Sec,
  };
}

export function compose6SecClipPrompt(opts: {
  clipIndex: number;
  totalClips: number;
  presenterDescription: string;
  scriptLine: string;
  emotion: string;
  background: string;
  cameraMovement?: string;
  lighting?: string;
  style?: string;
}): string {
  const style = opts.style || "realistic UGC vlog style";
  const camera = opts.cameraMovement || "slight handheld camera feel";
  const lighting = opts.lighting || "natural lighting";

  const sequenceContext =
    opts.clipIndex === 0 ? "opening shot establishing the scene"
    : opts.clipIndex === opts.totalClips - 1 ? "final shot with conclusive energy and CTA feel"
    : `continuation shot (clip ${opts.clipIndex + 1} of ${opts.totalClips}), seamless visual flow from previous`;

  const parts = [
    `6-second vertical video in ${style}`,
    sequenceContext,
    lighting,
    camera,
    `${opts.presenterDescription} speaking directly to camera with perfect lip sync`,
    `mouth moves naturally and exactly in sync with the voice`,
    `says: "${opts.scriptLine}"`,
    `${opts.emotion} tone`,
    opts.background,
    "High quality, natural skin texture, photorealistic",
  ];

  return parts.filter(Boolean).join(", ") + ".";
}

// ───────────────────────────────────────────────────────────────────────────
// 11. MULTI-PLATFORM VIDEO PROMPT RECIPES — Platform-specific optimizations
// ───────────────────────────────────────────────────────────────────────────

export interface PlatformPromptRecipe {
  id: string;
  platform: string;
  adFormat: string;
  spanishLabel: string;
  durationSec: number;
  aspectRatio: string;
  hookStrategy: string;
  promptTemplate: string;
  audioStrategy: string;
  captionRules: string[];
  kpis: string[];
}

export const PLATFORM_PROMPT_RECIPES: PlatformPromptRecipe[] = [
  { id: "ppr:ig_reels_product", platform: "Instagram Reels", adFormat: "Product Showcase", spanishLabel: "Reel de Producto",
    durationSec: 15, aspectRatio: "9:16",
    hookStrategy: "Visual hook in first 0.5s — product enters frame dramatically (drop, slide, or magnetic assembly)",
    promptTemplate: "9:16 vertical video, {PRODUCT} enters frame from top with satisfying drop onto matte surface, slight bounce, camera slowly pushes in revealing texture detail, {LIGHTING}, premium advertising quality, smooth 30fps, no text overlays in generation",
    audioStrategy: "Trending audio or ASMR-style product sounds (tap, click, swoosh). Voice-over optional, captions mandatory.",
    captionRules: ["Hook text in first 2 seconds (bold, center-screen)", "Feature callouts at 5s and 10s", "CTA at 13-15s with arrow pointing to profile link"],
    kpis: ["Watch-through rate > 50%", "Save rate > 3%", "Share rate > 1%"] },
  { id: "ppr:tiktok_ugc", platform: "TikTok", adFormat: "UGC-Style Ad", spanishLabel: "Anuncio Estilo UGC",
    durationSec: 15, aspectRatio: "9:16",
    hookStrategy: "POV or 'storytime' opening — relatable problem statement in first 2 seconds",
    promptTemplate: "9:16 vertical UGC-style video, real person speaking directly to camera smartphone selfie style, natural indoor lighting, slight handheld shake, authentic vlog aesthetic, {PRESENTER} holding {PRODUCT} and demonstrating it, enthusiastic but genuine expression, perfect lip sync",
    audioStrategy: "Original voice-over is primary. Background music low (20% volume). Native TikTok audio trends optional.",
    captionRules: ["Auto-captions enabled always", "Bold yellow/white text for hook", "Problem → Solution → CTA arc in captions"],
    kpis: ["6-second view rate > 40%", "CTR > 1.5%", "Comment engagement > 0.5%"] },
  { id: "ppr:youtube_pre_roll", platform: "YouTube", adFormat: "Pre-Roll (Skippable)", spanishLabel: "Pre-Roll YouTube",
    durationSec: 15, aspectRatio: "16:9",
    hookStrategy: "Brand logo flash (0.5s) + immediate value proposition — must hook before 5s skip button",
    promptTemplate: "16:9 horizontal cinematic video, opening with dramatic product reveal in first 2 seconds, {PRODUCT} on premium surface with {LIGHTING}, camera pulls back revealing full scene, professional color grading, broadcast quality, clean composition for text-safe zones",
    audioStrategy: "Professional voice-over from second 0. Background score at 40% volume. Branded audio logo at end.",
    captionRules: ["Value prop text at 2-4s", "Feature highlight at 7-10s", "CTA + URL at 13-15s", "All text within title-safe zone"],
    kpis: ["View rate > 30%", "CPV < $0.03", "Brand lift > 5%"] },
  { id: "ppr:meta_feed", platform: "Meta (Feed)", adFormat: "In-Feed Video Ad", spanishLabel: "Anuncio Feed Meta",
    durationSec: 15, aspectRatio: "1:1",
    hookStrategy: "Movement in first frame — product animation, color shift, or unexpected visual catches thumb-scroll",
    promptTemplate: "1:1 square format video, {PRODUCT} centered on clean gradient background, slow 360-degree rotation revealing all angles, {LIGHTING}, premium e-commerce photography quality brought to life, smooth continuous motion, no jarring cuts",
    audioStrategy: "Design for sound-off first. Add music and VO as enhancement. Captions carry the full message.",
    captionRules: ["Large readable captions (minimum 24px equivalent)", "Benefit-first messaging", "Social proof number at 8-10s", "Swipe-up CTA with urgency"],
    kpis: ["Thumb-stop rate > 25%", "ROAS > 3x", "Cost per purchase < target CAC"] },
  { id: "ppr:pinterest_idea", platform: "Pinterest", adFormat: "Idea Pin (Product)", spanishLabel: "Idea Pin Pinterest",
    durationSec: 10, aspectRatio: "9:16",
    hookStrategy: "Aesthetic-first approach — beautiful composition that inspires saves and clicks",
    promptTemplate: "9:16 vertical aesthetic video, {PRODUCT} in beautifully styled flat-lay arrangement, hands entering frame to interact with product, warm natural lighting, lifestyle context visible, Pinterest-worthy composition, soft camera movement",
    audioStrategy: "Gentle ambient music. No voice-over. Let visuals tell the story. Text overlays for key info.",
    captionRules: ["Minimal text — aesthetic-first", "Product name + price at end", "Lifestyle context captions", "SEO-optimized description separately"],
    kpis: ["Save rate > 5%", "Outbound click rate > 2%", "Pin engagement rate > 8%"] },
];

// ───────────────────────────────────────────────────────────────────────────
// 12. REAL-WORLD CAMPAIGN EXAMPLES — Professional reference campaigns
// ───────────────────────────────────────────────────────────────────────────

export interface CampaignExample {
  id: string;
  brandName: string;
  industry: string;
  campaignName: string;
  objective: string;
  videoCount: number;
  totalDurationSec: number;
  platforms: string[];
  keyInsight: string;
  promptExcerpt: string;
  resultMetrics: string;
}

export const CAMPAIGN_EXAMPLES: CampaignExample[] = [
  { id: "ex:luxury_watch_launch", brandName: "Marca Premium Relojería", industry: "watches",
    campaignName: "The Art of Time", objective: "brand_awareness",
    videoCount: 6, totalDurationSec: 90, platforms: ["Instagram", "YouTube", "TikTok"],
    keyInsight: "Macro probe lens shots of movement mechanism generated 3x more saves than standard product shots",
    promptExcerpt: "Ultra-macro interior of Swiss automatic movement, Laowa probe lens perspective, visible escapement wheel oscillating at 28,800 vph, golden bridges catching light, dust motes floating in DOF transition, anamorphic 2.39:1",
    resultMetrics: "4.2M impressions, 12% engagement rate, 340% increase in brand search volume" },
  { id: "ex:skincare_ugc", brandName: "Marca Cosmética Natural", industry: "skincare",
    campaignName: "Real Skin Diaries", objective: "conversion",
    videoCount: 12, totalDurationSec: 72, platforms: ["TikTok", "Instagram Reels"],
    keyInsight: "6-second UGC clips with lip sync outperformed polished studio content by 2.8x on ROAS",
    promptExcerpt: "Real woman 25yo, natural skin with freckles, morning bathroom light, applying serum drop to cheek, speaking to camera: 'esto cambió mi piel en 2 semanas', authentic selfie angle, perfect lip sync",
    resultMetrics: "2.1x ROAS, 45% view-through, $8.50 CPA (vs $24 for studio content)" },
  { id: "ex:tech_exploded_view", brandName: "Marca Auriculares Premium", industry: "tech",
    campaignName: "Inside the Sound", objective: "product_launch",
    videoCount: 5, totalDurationSec: 50, platforms: ["YouTube", "Instagram", "LinkedIn"],
    keyInsight: "Exploded view sequence showing internal components increased purchase intent by 67% in A/B test",
    promptExcerpt: "Premium wireless earbuds floating against dark background, components begin separating along precise axes, driver unit lifts revealing neodymium magnet, silicone ear tip detaches upward, battery cell slides out, all components suspended in zero gravity, static locked-off camera",
    resultMetrics: "67% higher purchase intent, 5.2M views, 890K earned impressions from shares" },
  { id: "ex:fashion_tryon", brandName: "Marca Streetwear DTC", industry: "fashion",
    campaignName: "Worn by You", objective: "conversion",
    videoCount: 20, totalDurationSec: 120, platforms: ["TikTok", "Instagram", "Pinterest"],
    keyInsight: "AI try-on videos showing same garment on 4 different body types increased AOV by 23%",
    promptExcerpt: "Confident 30yo woman, athletic build, walking through minimalist loft, wearing oversized hoodie in sage green, natural movement showing fabric drape, golden hour window light, candid street photography style",
    resultMetrics: "23% higher AOV, 38% lower return rate, 4.1x ROAS across all platforms" },
];

export function getPlaybookSummary() {
  return {
    brandDnaPillarCount: BRAND_DNA_FRAMEWORK.length,
    campaignTypeCount: Object.keys(CAMPAIGN_TYPES).length,
    ugcArchetypeCount: Object.keys(UGC_ARCHETYPES).length,
    masterFormulaComponentCount: MASTER_PROMPT_FORMULA.length,
    microClipRuleCount: MICRO_CLIP_METHOD.length,
    productionStepCount: PRODUCTION_WORKFLOW.length,
    concatenationTransitionCount: Object.keys(CONCATENATION_TRANSITIONS).length,
    videoSpecCount: VIDEO_TECH_SPECS.length,
    aiVideoToolCount: AI_VIDEO_TOOLS.length,
    quickResearchStepCount: QUICK_RESEARCH_METHOD.length,
    platformPromptRecipeCount: PLATFORM_PROMPT_RECIPES.length,
    campaignExampleCount: CAMPAIGN_EXAMPLES.length,
  };
}

export function getFullPlaybook() {
  return {
    brandDnaFramework: BRAND_DNA_FRAMEWORK,
    quickResearchMethod: QUICK_RESEARCH_METHOD,
    campaignTypes: CAMPAIGN_TYPES,
    ugcArchetypes: UGC_ARCHETYPES,
    masterPromptFormula: MASTER_PROMPT_FORMULA,
    microClipMethod: MICRO_CLIP_METHOD,
    productionWorkflow: PRODUCTION_WORKFLOW,
    concatenationTransitions: CONCATENATION_TRANSITIONS,
    videoTechSpecs: VIDEO_TECH_SPECS,
    aiVideoTools: AI_VIDEO_TOOLS,
    platformPromptRecipes: PLATFORM_PROMPT_RECIPES,
    campaignExamples: CAMPAIGN_EXAMPLES,
  };
}
