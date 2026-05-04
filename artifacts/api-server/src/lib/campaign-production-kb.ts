// ═══════════════════════════════════════════════════════════════════════════
// CAMPAIGN PRODUCTION KNOWLEDGE BASE (May 2026)
// ═══════════════════════════════════════════════════════════════════════════
// Crystallized from: ShopyCrafter Video Campaign Production Kit,
// 16:9 Prompts + Locution Brief, UGC + Lip Sync 6-Second Kit,
// Compact UGC Prompts, Storyboard Deck (10 slides), and 2 SRT files.
//
// This module captures the COMPLETE ShopyCrafter campaign production
// system — ready-to-use prompts, voice-over scripts, character locks,
// UGC micro-clips, master cut timeline, subtitles, and deliverables.
//
// All entries are deterministic (no AI calls). Designed to be:
//   1) Browsed via REST endpoints for frontend pickers
//   2) Fed as context to Claude for intelligent brand adaptation
//   3) Used by compose helpers to generate brand-specific campaign kits
// ═══════════════════════════════════════════════════════════════════════════

// ─────────────────────────────────────────────────────────────────────────
// 1. CHARACTER LOCK — Visual consistency across all AI-generated videos
// ─────────────────────────────────────────────────────────────────────────

export interface CharacterLock {
  id: string;
  name: string;
  variant: "holographic" | "ugc_real";
  description: string;
  promptFragment: string;
  usageTip: string;
}

export const CHARACTER_LOCKS: CharacterLock[] = [
  {
    id: "char:crafter_holographic",
    name: "Crafter (Holographic AI Entity)",
    variant: "holographic",
    description: "Futuristic AI persona for cinematic/cyberpunk campaign videos",
    promptFragment: "Sleek holographic AI woman, 30 years old, sharp cyberpunk tailored black suit with glowing cyan and neon-green circuit lines, short asymmetrical hair with vibrant neon-green highlights, confident professional expression, subtle holographic shimmer and edge glow, cinematic lighting, ultra-detailed face, premium corporate tech aesthetic.",
    usageTip: "Generate ONE reference image first. Then use 'Image Reference' / 'Character Lock' / 'IP-Adapter' in Kling/Runway/Luma for 100% consistency across all 6 videos.",
  },
  {
    id: "char:crafter_ugc",
    name: "Crafter (Real Woman UGC)",
    variant: "ugc_real",
    description: "Authentic talking-head persona for UGC-style lip-sync micro-clips",
    promptFragment: "Confident 30-year-old Spanish woman, modern professional look, black blazer with subtle neon green details, short hair with neon green highlights, warm and expert expression, natural skin texture, speaking directly to camera",
    usageTip: "Use the same reference photo in ALL clips. Add 'perfect lip sync, mouth moves naturally and exactly with the voice, realistic mouth movements, natural speaking' to every prompt.",
  },
];

// ─────────────────────────────────────────────────────────────────────────
// 2. VIDEO CAMPAIGNS — 6 production-ready video concepts
// ─────────────────────────────────────────────────────────────────────────

export interface VoiceOverCue {
  startSec: number;
  endSec: number;
  speaker: "narrator" | "crafter";
  text: string;
}

export interface VideoCampaign {
  id: string;
  index: number;
  title: string;
  slug: string;
  concept: string;
  durationSec: number;
  headline: string;
  musicCue: string;
  prompt916: string;
  prompt169: string;
  voiceOver: VoiceOverCue[];
}

export const VIDEO_CAMPAIGNS: VideoCampaign[] = [
  {
    id: "vc:command_center",
    index: 1,
    title: "Command Center",
    slug: "command-center",
    concept: "El cerebro que gestiona tu tienda",
    durationSec: 22,
    headline: "Si ShopyCrafter gestionara tu tienda",
    musicCue: "Dark cinematic synthwave hybrid 135 BPM pulsing sub-bass building tension with golden brass swells",
    prompt916: `Vertical 9:16 cinematic 8K photorealistic, dark cyberpunk corporate aesthetic, golden neon and glowing green accents. Futuristic command center. Massive holographic screen in center showing premium Shopify store wireframe being optimized by glowing digital tools and floating data streams. Slow smooth push-in from top to central hologram (0-7s). At 7s holographic AI entity "Crafter" (sleek woman cyberpunk black suit with cyan-green neon lines, short neon-green highlighted hair, confident professional expression, holographic shimmer) materializes on right side. Golden conversion metrics and green optimization lines appear (9-15s). Crafter raises hand and entire dashboard lights up in gold (15-18s). Large gold headline centered top readable on mobile: "Si ShopyCrafter gestionara tu tienda". ShopyCrafter logo + tagline "Ingeniería de E-commerce con IA" bottom safe zone (18-22s). Music: Dark cinematic synthwave hybrid 135 BPM pulsing sub-bass building tension with golden brass swells.`,
    prompt169: `16:9 cinematic 8K, dark cyberpunk corporate. Wide futuristic command center with massive holographic screen showing premium Shopify wireframe being optimized. Slow dolly-in from wide establishing shot to medium on central hologram (0-8s). Holographic Crafter (sleek woman, cyberpunk black suit with cyan-green neon lines, short neon-green hair, confident expression) appears on right at 7s. Golden metrics explode across the wide screen (9-15s). Crafter touches hologram and everything lights gold (15-18s). Large gold headline top center: 'Si ShopyCrafter gestionara tu tienda'. Logo + tagline bottom right (18-22s). Music: Dark synthwave hybrid 135 BPM building tension.`,
    voiceOver: [
      { startSec: 0, endSec: 4, speaker: "narrator", text: "Imagina que tu tienda Shopify tuviera un equipo completo de ingenieros de e-commerce trabajando 24/7…" },
      { startSec: 4, endSec: 9, speaker: "narrator", text: "…con IA que analiza, prueba y optimiza cada detalle sin parar." },
      { startSec: 15, endSec: 18, speaker: "crafter", text: "Esto es ShopyCrafter." },
    ],
  },
  {
    id: "vc:lupa",
    index: 2,
    title: "Lupa de Precisión",
    slug: "lupa",
    concept: "Análisis profundo, resultados inmediatos",
    durationSec: 20,
    headline: "Análisis profundo. Resultados reales.",
    musicCue: "Focused analytical electronic with rising golden hits and precise rhythmic elements",
    prompt916: `Vertical 9:16 sleek dark SaaS style. Beautiful Shopify product page displayed on floating vertical screen. Huge glowing digital magnifying glass sweeps slowly from top to bottom, revealing hidden glowing green code, heatmaps and conversion metrics underneath each section (0-11s). Crafter reflected inside the lens at 6s (same holographic woman, cyberpunk suit, neon-green hair). Conversion metric jumps dramatically 2.4% → 8.7% with golden particle explosion (11-16s). Gold headline top safe zone: "Análisis profundo. Resultados reales." Logo bottom (16-20s). Music: Focused analytical with rising golden hits.`,
    prompt169: `16:9 sleek dark SaaS style. Wide shot of beautiful Shopify product page. Huge glowing digital magnifying glass moves slowly from left to right across the layout, revealing glowing green code, heatmaps and conversion metrics underneath (0-11s). Crafter reflected inside the lens at 6s. Conversion number jumps 2.4% → 8.7% with golden particles (11-16s). Gold headline top: 'Análisis profundo. Resultados reales.'. Logo bottom right (16-20s). Music: Focused analytical with rising golden hits.`,
    voiceOver: [
      { startSec: 0, endSec: 5, speaker: "narrator", text: "Cada píxel. Cada palabra. Cada botón." },
      { startSec: 5, endSec: 11, speaker: "narrator", text: "ShopyCrafter no solo ve tu tienda… la disecciona, la entiende y la mejora en tiempo real." },
    ],
  },
  {
    id: "vc:robotic_blueprint",
    index: 3,
    title: "Robotic Blueprint",
    slug: "robotic-blueprint",
    concept: "No contratamos gente. Construimos inteligencia.",
    durationSec: 24,
    headline: "Construimos tu tienda perfecta",
    musicCue: "Robotic percussion with mechanical sounds building to triumphant orchestral swells",
    prompt916: `Vertical 9:16 premium 3D cinematic. Floating digital blueprint of Shopify store in dark studio space. Multiple high-tech robotic arms with cyan glow assembling store components in perfect sync from top to bottom (0-13s). Slow orbit around construction. Crafter (same character, holographic shimmer) appears at 9s directing the arms with subtle hand gestures. Golden light bursts on each finished section (13-20s). Gold headline: "Construimos tu tienda perfecta". Logo bottom safe zone (20-24s). Music: Robotic percussion + triumphant swells.`,
    prompt169: `16:9 premium 3D cinematic. Wide floating digital blueprint of Shopify store in dark studio. Multiple high-tech robotic arms with cyan glow assembling components across the wide frame in perfect sync (0-13s). Slow cinematic orbit. Crafter appears upper center at 9s directing arms. Golden light bursts on finished sections (13-20s). Gold headline: 'Construimos tu tienda perfecta'. Logo bottom (20-24s). Music: Robotic percussion + triumphant swells.`,
    voiceOver: [
      { startSec: 0, endSec: 6, speaker: "narrator", text: "No contratamos gente. Construimos inteligencia." },
      { startSec: 6, endSec: 12, speaker: "narrator", text: "ShopyCrafter ensambla y perfecciona tu tienda como 20 especialistas sin parar." },
    ],
  },
  {
    id: "vc:dashboard",
    index: 4,
    title: "Dashboard Dorado",
    slug: "dashboard",
    concept: "Resultados explosivos que hablan solos",
    durationSec: 18,
    headline: "+347% conversión en 90 días",
    musicCue: "Triumphant corporate with big brass hits and ascending golden melodic lines",
    prompt916: `Vertical 9:16 corporate tech. Sleek vertical dashboard filling screen with golden conversion graphs skyrocketing. Blurred high-end fashion storefront background. Slow push-in on main golden line graph (0-10s). Crafter appears left at 7s, arms crossed confidently. Big golden number appears center: "+347% conversión". Secondary metric "+89% revenue per session" fades in below (10-14s). Logo + "Pide tu diagnóstico gratis" (14-18s). Music: Triumphant with big brass hits.`,
    prompt169: `16:9 corporate tech. Wide sleek dashboard with golden conversion graphs skyrocketing across the screen. Blurred high-end fashion background. Slow push-in on main golden line (0-10s). Crafter appears left side at 7s, arms crossed. Big golden text center: '+347% conversión'. Logo + 'Pide tu diagnóstico gratis' (14-18s). Music: Triumphant with big brass hits.`,
    voiceOver: [
      { startSec: 0, endSec: 4, speaker: "narrator", text: "+347% de conversión en 90 días." },
      { startSec: 4, endSec: 9, speaker: "narrator", text: "+89% de ingresos por sesión." },
      { startSec: 9, endSec: 13, speaker: "narrator", text: "Esto es lo que pasa cuando la IA gestiona tu e-commerce." },
    ],
  },
  {
    id: "vc:split_screen",
    index: 5,
    title: "Split-Screen Transformation",
    slug: "split-screen",
    concept: "Antes vs Después — la diferencia es ingeniería",
    durationSec: 25,
    headline: "Antes. Después. ShopyCrafter.",
    musicCue: "Dramatic tension building to epic reveal with full orchestra and golden synths",
    prompt916: `Vertical 9:16 high-contrast dramatic split. Top 50%: glitching grey laggy Shopify storefront with visible loading errors, poor layout. Bottom 50%: glowing golden premium optimized Shopify store with perfect metrics. Horizontal golden light beam appears at center at 8s, sweeping upward transforming the grey section into gold (8-14s). Crafter walks through the beam (12-14s). Final full golden optimized store with metrics overlay (14-20s). Gold headline: "Antes. Después. ShopyCrafter." Logo + "Solicita tu diagnóstico gratuito de 48h" (20-25s). Music: Dramatic tension → epic reveal.`,
    prompt169: `16:9 high-contrast dramatic split. Left 50%: glitching grey laggy Shopify storefront. Right 50%: glowing golden optimized Shopify. Vertical golden light beam at 8s transforms left side as Crafter walks from left to right (8-14s). Final full golden store (14-20s). Gold headline: 'Antes. Después. ShopyCrafter.' Logo + CTA (20-25s). Music: Dramatic tension → epic reveal.`,
    voiceOver: [
      { startSec: 0, endSec: 7, speaker: "narrator", text: "Izquierda: tu tienda hoy." },
      { startSec: 7, endSec: 13, speaker: "narrator", text: "Derecha: tu tienda con ShopyCrafter." },
      { startSec: 13, endSec: 18, speaker: "narrator", text: "La diferencia no es magia. Es ingeniería con IA." },
    ],
  },
  {
    id: "vc:hero_cta",
    index: 6,
    title: "Hero CTA",
    slug: "hero-cta",
    concept: "El cierre poderoso — llamada a la acción final",
    durationSec: 20,
    headline: "Gestionamos tu Shopify. Tú solo vendes.",
    musicCue: "Emotional corporate with warm strings resolving to powerful brass finale and golden shimmer",
    prompt916: `Vertical 9:16 emotional corporate. Crafter (same character) standing centered in premium dark studio, warm golden volumetric light behind her. She looks directly at camera with confident inspiring expression (0-6s). Floating golden text cards appear around her: "24/7", "IA", "+347%", "0 equipo" (6-12s). She smiles and golden light envelops the frame (12-16s). Clean dark screen, large gold text: "Gestionamos tu Shopify. Tú solo vendes." Logo + "Solicita tu diagnóstico gratuito de 48h" + URL (16-20s). Music: Emotional corporate with warm strings resolving to powerful brass finale.`,
    prompt169: `16:9 emotional corporate. Wide shot of Crafter standing centered in premium dark studio with warm golden volumetric light. She looks at camera (0-6s). Floating golden text cards appear: "24/7", "IA", "+347%", "0 equipo" (6-12s). Golden light envelops (12-16s). Gold text: 'Gestionamos tu Shopify. Tú solo vendes.' Logo + CTA (16-20s). Music: Emotional corporate with powerful brass finale.`,
    voiceOver: [
      { startSec: 0, endSec: 6, speaker: "narrator", text: "ShopyCrafter no es otra herramienta." },
      { startSec: 6, endSec: 12, speaker: "narrator", text: "Es el equipo de e-commerce que siempre quisiste… pero con IA que nunca duerme." },
      { startSec: 12, endSec: 16, speaker: "narrator", text: "Gestionamos tu Shopify. Tú solo vendes." },
      { startSec: 16, endSec: 20, speaker: "narrator", text: "Solicita tu diagnóstico gratuito de 48 horas en shopycrafter.com" },
    ],
  },
];

// ─────────────────────────────────────────────────────────────────────────
// 3. UGC MICRO-CLIPS — 22 lip-sync clips for Grok Imagine
// ─────────────────────────────────────────────────────────────────────────

export interface UgcMicroClip {
  id: string;
  videoRef: string;
  videoIndex: number;
  clipIndex: number;
  clipLabel: string;
  timecode: string;
  startSec: number;
  endSec: number;
  purpose: string;
  dialogue: string;
  prompt: string;
}

export const UGC_MICRO_CLIPS: UgcMicroClip[] = [
  // ── VIDEO 1 — COMMAND CENTER ──
  {
    id: "ugc:v1_c1", videoRef: "command-center", videoIndex: 1, clipIndex: 1,
    clipLabel: "V1_C1", timecode: "0-6s", startSec: 0, endSec: 6,
    purpose: "Direct to camera introduction",
    dialogue: "Imagina que tu tienda Shopify tuviera un equipo completo de ingenieros de e-commerce trabajando 24 horas al día, 7 días a la semana…",
    prompt: `6-second vertical video in realistic UGC vlog style, natural lighting, slight handheld camera feel, authentic talking-head aesthetic. Confident 30-year-old Spanish woman (Crafter: modern professional look, black blazer with subtle neon green details, short hair with neon green highlights, warm and expert expression, natural skin texture) speaking directly to camera with perfect lip sync — her mouth moves naturally and exactly in sync with the voice. She looks at camera with energy and says: "Imagina que tu tienda Shopify tuviera un equipo completo de ingenieros de e-commerce trabajando 24 horas al día, 7 días a la semana…". Soft golden and green light accents in modern bright workspace background. Natural, trustworthy, expert vlog style, high quality.`,
  },
  {
    id: "ugc:v1_c2", videoRef: "command-center", videoIndex: 1, clipIndex: 2,
    clipLabel: "V1_C2", timecode: "6-12s", startSec: 6, endSec: 12,
    purpose: "Second line + subtle gesture",
    dialogue: "…con IA que analiza, prueba y optimiza cada detalle sin parar.",
    prompt: `6-second vertical video in realistic UGC vlog style. Same woman continues speaking directly to camera with perfect lip sync and natural hand gestures. She says with confidence: "…con IA que analiza, prueba y optimiza cada detalle sin parar." Slight natural camera movement, warm lighting, modern clean background with subtle golden reflections. Authentic expert vlog feel, realistic skin texture, high detail.`,
  },
  {
    id: "ugc:v1_c3", videoRef: "command-center", videoIndex: 1, clipIndex: 3,
    clipLabel: "V1_C3", timecode: "12-18s", startSec: 12, endSec: 18,
    purpose: "Powerful statement + smile",
    dialogue: "Esto es ShopyCrafter.",
    prompt: `6-second vertical video in realistic UGC vlog style. Woman speaks directly to camera with perfect lip sync, slight smile and confident expression: "Esto es ShopyCrafter." Natural head movement, warm authentic lighting. Subtle golden particles appear softly in background. Trustworthy, modern, professional vlog style.`,
  },
  {
    id: "ugc:v1_c4", videoRef: "command-center", videoIndex: 1, clipIndex: 4,
    clipLabel: "V1_C4", timecode: "18-22s", startSec: 18, endSec: 22,
    purpose: "Logo + call to action",
    dialogue: "Si ShopyCrafter gestionara tu tienda",
    prompt: `6-second vertical video in realistic UGC vlog style. Same woman smiles at camera. Large elegant gold text appears: "Si ShopyCrafter gestionara tu tienda". ShopyCrafter logo + tagline "Ingeniería de E-commerce con IA" appears bottom right with soft glow. Natural lighting, authentic ending feel. Premium but real UGC quality.`,
  },
  // ── VIDEO 2 — LUPA ──
  {
    id: "ugc:v2_c1", videoRef: "lupa", videoIndex: 2, clipIndex: 1,
    clipLabel: "V2_C1", timecode: "0-6s", startSec: 0, endSec: 6,
    purpose: "Precision opening",
    dialogue: "Cada píxel. Cada palabra. Cada botón.",
    prompt: `6-second vertical video in realistic UGC vlog style, natural lighting. Confident woman speaking directly to camera with perfect lip sync: "Cada píxel. Cada palabra. Cada botón." Natural expression, slight head tilt, modern workspace background with soft green and golden accents. Authentic vlog feel, high quality.`,
  },
  {
    id: "ugc:v2_c2", videoRef: "lupa", videoIndex: 2, clipIndex: 2,
    clipLabel: "V2_C2", timecode: "6-12s", startSec: 6, endSec: 12,
    purpose: "Analysis explanation",
    dialogue: "ShopyCrafter no solo ve tu tienda… la disecciona, la entiende y la mejora en tiempo real.",
    prompt: `6-second vertical video in realistic UGC vlog style. Same woman continues with perfect lip sync, more emphasis in voice and slight forward lean: "ShopyCrafter no solo ve tu tienda… la disecciona, la entiende y la mejora en tiempo real." Natural gestures, warm lighting, trustworthy expert tone. Realistic skin and hair movement.`,
  },
  {
    id: "ugc:v2_c3", videoRef: "lupa", videoIndex: 2, clipIndex: 3,
    clipLabel: "V2_C3", timecode: "12-18s", startSec: 12, endSec: 18,
    purpose: "Results display",
    dialogue: "2.4% → 8.7% de conversión",
    prompt: `6-second vertical video in realistic UGC vlog style. Woman speaks with energy and perfect lip sync: conversion numbers appear softly on screen as she says the line. She smiles confidently at the end. Golden light accents. Authentic, results-focused vlog style.`,
  },
  {
    id: "ugc:v2_c4", videoRef: "lupa", videoIndex: 2, clipIndex: 4,
    clipLabel: "V2_C4", timecode: "18-20s", startSec: 18, endSec: 20,
    purpose: "Logo ending",
    dialogue: "Análisis profundo. Resultados reales.",
    prompt: `6-second vertical video in realistic UGC vlog style. Woman smiles at camera. Gold headline: "Análisis profundo. Resultados reales." Logo + tagline appears naturally. Clean, professional but real UGC ending.`,
  },
  // ── VIDEO 3 — ROBOTIC BLUEPRINT ──
  {
    id: "ugc:v3_c1", videoRef: "robotic-blueprint", videoIndex: 3, clipIndex: 1,
    clipLabel: "V3_C1", timecode: "0-6s", startSec: 0, endSec: 6,
    purpose: "Bold statement",
    dialogue: "No contratamos gente. Construimos inteligencia.",
    prompt: `6-second vertical video in realistic UGC vlog style. Confident woman speaking directly to camera with perfect lip sync: "No contratamos gente. Construimos inteligencia." Natural expression, modern tech workspace, subtle green and golden lighting. Authentic expert vlog feel.`,
  },
  {
    id: "ugc:v3_c2", videoRef: "robotic-blueprint", videoIndex: 3, clipIndex: 2,
    clipLabel: "V3_C2", timecode: "6-12s", startSec: 6, endSec: 12,
    purpose: "Team metaphor",
    dialogue: "ShopyCrafter ensambla, prueba y perfecciona tu tienda como si tuvieras un equipo de 20 especialistas trabajando sin parar.",
    prompt: `6-second vertical video in realistic UGC vlog style. Same woman continues with perfect lip sync and natural hand movements: "ShopyCrafter ensambla, prueba y perfecciona tu tienda como si tuvieras un equipo de 20 especialistas trabajando sin parar." Warm lighting, modern workspace, golden reflections.`,
  },
  {
    id: "ugc:v3_c3", videoRef: "robotic-blueprint", videoIndex: 3, clipIndex: 3,
    clipLabel: "V3_C3", timecode: "12-18s", startSec: 12, endSec: 18,
    purpose: "Construction visual",
    dialogue: "Cada componente optimizado al milímetro.",
    prompt: `6-second vertical video in realistic UGC vlog style. Woman gestures expressively with perfect lip sync, describing construction. Warm golden light, modern workspace. Authentic expert energy.`,
  },
  {
    id: "ugc:v3_c4", videoRef: "robotic-blueprint", videoIndex: 3, clipIndex: 4,
    clipLabel: "V3_C4", timecode: "18-24s", startSec: 18, endSec: 24,
    purpose: "Logo + headline",
    dialogue: "Construimos tu tienda perfecta.",
    prompt: `6-second vertical video in realistic UGC vlog style. Woman smiles confidently. Gold text: "Construimos tu tienda perfecta." Logo appears with soft golden glow. Authentic UGC ending.`,
  },
  // ── VIDEO 4 — DASHBOARD ──
  {
    id: "ugc:v4_c1", videoRef: "dashboard", videoIndex: 4, clipIndex: 1,
    clipLabel: "V4_C1", timecode: "0-6s", startSec: 0, endSec: 6,
    purpose: "Explosive metric",
    dialogue: "+347% de conversión en 90 días.",
    prompt: `6-second vertical video in realistic UGC vlog style. Confident woman speaking directly to camera with perfect lip sync and excited energy: "+347% de conversión en 90 días." Golden accents, modern workspace. Trustworthy data-driven feel.`,
  },
  {
    id: "ugc:v4_c2", videoRef: "dashboard", videoIndex: 4, clipIndex: 2,
    clipLabel: "V4_C2", timecode: "6-12s", startSec: 6, endSec: 12,
    purpose: "Second metric + context",
    dialogue: "+89% de ingresos por sesión. Esto es lo que pasa cuando la IA gestiona tu e-commerce.",
    prompt: `6-second vertical video in realistic UGC vlog style. Same woman continues with perfect lip sync, emphasizing numbers with hand gestures: "+89% de ingresos por sesión. Esto es lo que pasa cuando la IA gestiona tu e-commerce." Warm lighting, expert tone.`,
  },
  {
    id: "ugc:v4_c3", videoRef: "dashboard", videoIndex: 4, clipIndex: 3,
    clipLabel: "V4_C3", timecode: "12-18s", startSec: 12, endSec: 18,
    purpose: "Logo + CTA",
    dialogue: "+347% conversión",
    prompt: `6-second vertical video in realistic UGC vlog style. Woman smiles proudly. Gold text: "+347% conversión". Logo + "Pide tu diagnóstico gratis". Authentic, results-focused UGC ending.`,
  },
  // ── VIDEO 5 — SPLIT-SCREEN ──
  {
    id: "ugc:v5_c1", videoRef: "split-screen", videoIndex: 5, clipIndex: 1,
    clipLabel: "V5_C1", timecode: "0-6s", startSec: 0, endSec: 6,
    purpose: "Before state",
    dialogue: "Izquierda: tu tienda hoy.",
    prompt: `6-second vertical video in realistic UGC vlog style. Confident woman speaking to camera with perfect lip sync, slightly concerned expression: "Izquierda: tu tienda hoy." She gestures to one side. Natural lighting, modern workspace.`,
  },
  {
    id: "ugc:v5_c2", videoRef: "split-screen", videoIndex: 5, clipIndex: 2,
    clipLabel: "V5_C2", timecode: "6-12s", startSec: 6, endSec: 12,
    purpose: "After state",
    dialogue: "Derecha: tu tienda con ShopyCrafter.",
    prompt: `6-second vertical video in realistic UGC vlog style. Same woman now smiling with perfect lip sync, gesturing to other side: "Derecha: tu tienda con ShopyCrafter." Golden light accents increase. Confident, inspiring tone.`,
  },
  {
    id: "ugc:v5_c3", videoRef: "split-screen", videoIndex: 5, clipIndex: 3,
    clipLabel: "V5_C3", timecode: "12-18s", startSec: 12, endSec: 18,
    purpose: "Key message",
    dialogue: "La diferencia no es magia. Es ingeniería con IA.",
    prompt: `6-second vertical video in realistic UGC vlog style. Woman speaks with conviction and perfect lip sync: "La diferencia no es magia. Es ingeniería con IA." Natural head movement, expert tone, warm lighting.`,
  },
  {
    id: "ugc:v5_c4", videoRef: "split-screen", videoIndex: 5, clipIndex: 4,
    clipLabel: "V5_C4", timecode: "18-25s", startSec: 18, endSec: 25,
    purpose: "Logo + final",
    dialogue: "Antes. Después. ShopyCrafter.",
    prompt: `6-second vertical video in realistic UGC vlog style. Woman smiles confidently. Gold text: "Antes. Después. ShopyCrafter." Logo appears naturally. Authentic, emotional, high-quality UGC ending.`,
  },
  // ── VIDEO 6 — HERO CTA ──
  {
    id: "ugc:v6_c1", videoRef: "hero-cta", videoIndex: 6, clipIndex: 1,
    clipLabel: "V6_C1", timecode: "0-6s", startSec: 0, endSec: 6,
    purpose: "Opening statement",
    dialogue: "ShopyCrafter no es otra herramienta.",
    prompt: `6-second vertical video in realistic UGC vlog style. Confident woman speaking directly to camera with perfect lip sync and warm expert tone: "ShopyCrafter no es otra herramienta." Natural expression, modern workspace, subtle golden lighting. Authentic vlog feel.`,
  },
  {
    id: "ugc:v6_c2", videoRef: "hero-cta", videoIndex: 6, clipIndex: 2,
    clipLabel: "V6_C2", timecode: "6-12s", startSec: 6, endSec: 12,
    purpose: "Emotional line + direct gaze",
    dialogue: "Es el equipo de e-commerce que siempre quisiste… pero con IA que nunca duerme.",
    prompt: `6-second vertical video in realistic UGC vlog style. Same woman continues with perfect lip sync, looking straight at camera with inspiring expression: "Es el equipo de e-commerce que siempre quisiste… pero con IA que nunca duerme." Natural, trustworthy, emotional but professional.`,
  },
  {
    id: "ugc:v6_c3", videoRef: "hero-cta", videoIndex: 6, clipIndex: 3,
    clipLabel: "V6_C3", timecode: "12-18s", startSec: 12, endSec: 18,
    purpose: "Final CTA + smile",
    dialogue: "Gestionamos tu Shopify. Tú solo vendes.",
    prompt: `6-second vertical video in realistic UGC vlog style. Woman smiles warmly and speaks with perfect lip sync: "Gestionamos tu Shopify. Tú solo vendes." Gold text appears elegantly. Logo + "Solicita tu diagnóstico gratuito de 48h". Authentic, high-converting UGC ending.`,
  },
  {
    id: "ugc:v6_c4", videoRef: "hero-cta", videoIndex: 6, clipIndex: 4,
    clipLabel: "V6_C4", timecode: "18-20s", startSec: 18, endSec: 20,
    purpose: "Optional logo hold",
    dialogue: "",
    prompt: `6-second vertical video in realistic UGC vlog style. Clean hold with ShopyCrafter logo centered, soft golden particles, tagline "Ingeniería de E-commerce con IA". Natural lighting, premium but real UGC quality.`,
  },
];

// ─────────────────────────────────────────────────────────────────────────
// 4. MASTER CUT TIMELINE — concatenation table for the 2:10 epic film
// ─────────────────────────────────────────────────────────────────────────

export interface MasterCutSegment {
  index: number;
  videoRef: string;
  videoTitle: string;
  startTime: string;
  endTime: string;
  durationSec: number;
  transition: string;
  clipFiles: string[];
}

export const MASTER_CUT_TIMELINE: MasterCutSegment[] = [
  { index: 1, videoRef: "command-center", videoTitle: "Command Center",
    startTime: "0:00", endTime: "0:22", durationSec: 22,
    transition: "Golden light wipe",
    clipFiles: ["V1_C1", "V1_C2", "V1_C3", "V1_C4"] },
  { index: 2, videoRef: "lupa", videoTitle: "Lupa de Precisión",
    startTime: "0:22", endTime: "0:42", durationSec: 20,
    transition: "Robotic arm sweep",
    clipFiles: ["V2_C1", "V2_C2", "V2_C3", "V2_C4"] },
  { index: 3, videoRef: "robotic-blueprint", videoTitle: "Robotic Blueprint",
    startTime: "0:42", endTime: "1:06", durationSec: 24,
    transition: "Particle burst",
    clipFiles: ["V3_C1", "V3_C2", "V3_C3", "V3_C4"] },
  { index: 4, videoRef: "dashboard", videoTitle: "Dashboard Dorado",
    startTime: "1:06", endTime: "1:24", durationSec: 18,
    transition: "Golden beam extend",
    clipFiles: ["V4_C1", "V4_C2", "V4_C3"] },
  { index: 5, videoRef: "split-screen", videoTitle: "Split-Screen",
    startTime: "1:24", endTime: "1:49", durationSec: 25,
    transition: "Crafter orbit fade",
    clipFiles: ["V5_C1", "V5_C2", "V5_C3", "V5_C4"] },
  { index: 6, videoRef: "hero-cta", videoTitle: "Hero CTA",
    startTime: "1:49", endTime: "2:10", durationSec: 21,
    transition: "Extended logo zoom (final)",
    clipFiles: ["V6_C1", "V6_C2", "V6_C3", "V6_C4"] },
];

// ─────────────────────────────────────────────────────────────────────────
// 5. SUBTITLE TRACKS — structured SRT data
// ─────────────────────────────────────────────────────────────────────────

export interface SubtitleCue {
  index: number;
  startTime: string;
  endTime: string;
  startMs: number;
  endMs: number;
  text: string;
}

export interface SubtitleTrack {
  id: string;
  name: string;
  description: string;
  totalDurationMs: number;
  cues: SubtitleCue[];
}

export const SUBTITLE_TRACKS: SubtitleTrack[] = [
  {
    id: "srt:master_cut",
    name: "Master Cut Subtitles",
    description: "Subtitles for the 2:10 master brand film",
    totalDurationMs: 130000,
    cues: [
      { index: 1, startTime: "00:00:00,000", endTime: "00:00:04,000", startMs: 0, endMs: 4000, text: "Imagina que tu tienda Shopify tuviera un equipo completo de ingenieros de e-commerce trabajando 24 horas al día, 7 días a la semana…" },
      { index: 2, startTime: "00:00:04,500", endTime: "00:00:09,000", startMs: 4500, endMs: 9000, text: "…con IA que analiza, prueba y optimiza cada detalle sin parar." },
      { index: 3, startTime: "00:00:15,000", endTime: "00:00:18,000", startMs: 15000, endMs: 18000, text: "Esto es ShopyCrafter." },
      { index: 4, startTime: "00:00:22,000", endTime: "00:00:27,000", startMs: 22000, endMs: 27000, text: "Cada píxel. Cada palabra. Cada botón." },
      { index: 5, startTime: "00:00:27,500", endTime: "00:00:33,000", startMs: 27500, endMs: 33000, text: "ShopyCrafter no solo ve tu tienda… la disecciona, la entiende y la mejora en tiempo real." },
      { index: 6, startTime: "00:00:42,000", endTime: "00:00:48,000", startMs: 42000, endMs: 48000, text: "No contratamos gente. Construimos inteligencia." },
      { index: 7, startTime: "00:00:48,500", endTime: "00:00:55,000", startMs: 48500, endMs: 55000, text: "ShopyCrafter ensambla, prueba y perfecciona tu tienda como si tuvieras un equipo de 20 especialistas trabajando sin parar." },
      { index: 8, startTime: "00:01:06,000", endTime: "00:01:10,000", startMs: 66000, endMs: 70000, text: "+347% de conversión en 90 días." },
      { index: 9, startTime: "00:01:10,500", endTime: "00:01:15,000", startMs: 70500, endMs: 75000, text: "+89% de ingresos por sesión." },
      { index: 10, startTime: "00:01:15,500", endTime: "00:01:20,000", startMs: 75500, endMs: 80000, text: "Esto es lo que pasa cuando la IA gestiona tu e-commerce." },
      { index: 11, startTime: "00:01:24,000", endTime: "00:01:31,000", startMs: 84000, endMs: 91000, text: "Izquierda: tu tienda hoy." },
      { index: 12, startTime: "00:01:31,500", endTime: "00:01:38,000", startMs: 91500, endMs: 98000, text: "Derecha: tu tienda con ShopyCrafter." },
      { index: 13, startTime: "00:01:38,500", endTime: "00:01:45,000", startMs: 98500, endMs: 105000, text: "La diferencia no es magia. Es ingeniería con IA." },
      { index: 14, startTime: "00:01:49,000", endTime: "00:01:55,000", startMs: 109000, endMs: 115000, text: "ShopyCrafter no es otra herramienta." },
      { index: 15, startTime: "00:01:55,500", endTime: "00:02:01,000", startMs: 115500, endMs: 121000, text: "Es el equipo de e-commerce que siempre quisiste… pero con IA que nunca duerme." },
      { index: 16, startTime: "00:02:01,500", endTime: "00:02:07,000", startMs: 121500, endMs: 127000, text: "Gestionamos tu Shopify. Tú solo vendes." },
      { index: 17, startTime: "00:02:07,500", endTime: "00:02:10,000", startMs: 127500, endMs: 130000, text: "Solicita tu diagnóstico gratuito de 48 horas en shopycrafter.com" },
    ],
  },
  {
    id: "srt:6sec_female",
    name: "6-Second Female Voice Clips",
    description: "Individual subtitle cues for 22 UGC micro-clips (6 seconds each)",
    totalDurationMs: 130000,
    cues: [
      { index: 1, startTime: "00:00:00,000", endTime: "00:00:06,000", startMs: 0, endMs: 6000, text: "Imagina que tu tienda Shopify tuviera un equipo completo de ingenieros de e-commerce trabajando 24 horas al día, 7 días a la semana…" },
      { index: 2, startTime: "00:00:06,500", endTime: "00:00:12,000", startMs: 6500, endMs: 12000, text: "…con IA que analiza, prueba y optimiza cada detalle sin parar." },
      { index: 3, startTime: "00:00:12,500", endTime: "00:00:18,000", startMs: 12500, endMs: 18000, text: "Esto es ShopyCrafter." },
      { index: 4, startTime: "00:00:18,500", endTime: "00:00:22,000", startMs: 18500, endMs: 22000, text: "Si ShopyCrafter gestionara tu tienda." },
      { index: 5, startTime: "00:00:22,500", endTime: "00:00:28,000", startMs: 22500, endMs: 28000, text: "Cada píxel. Cada palabra. Cada botón." },
      { index: 6, startTime: "00:00:28,500", endTime: "00:00:34,000", startMs: 28500, endMs: 34000, text: "ShopyCrafter no solo ve tu tienda… la disecciona, la entiende y la mejora en tiempo real." },
      { index: 7, startTime: "00:00:34,500", endTime: "00:00:40,000", startMs: 34500, endMs: 40000, text: "Análisis profundo. Resultados reales." },
      { index: 8, startTime: "00:00:40,500", endTime: "00:00:46,000", startMs: 40500, endMs: 46000, text: "No contratamos gente. Construimos inteligencia." },
      { index: 9, startTime: "00:00:46,500", endTime: "00:00:52,000", startMs: 46500, endMs: 52000, text: "ShopyCrafter ensambla, prueba y perfecciona tu tienda como si tuvieras un equipo de 20 especialistas trabajando sin parar." },
      { index: 10, startTime: "00:00:52,500", endTime: "00:00:58,000", startMs: 52500, endMs: 58000, text: "Construimos tu tienda perfecta." },
      { index: 11, startTime: "00:00:58,500", endTime: "00:01:04,000", startMs: 58500, endMs: 64000, text: "+347% de conversión en 90 días." },
      { index: 12, startTime: "00:01:04,500", endTime: "00:01:10,000", startMs: 64500, endMs: 70000, text: "+89% de ingresos por sesión." },
      { index: 13, startTime: "00:01:10,500", endTime: "00:01:16,000", startMs: 70500, endMs: 76000, text: "+347% conversión." },
      { index: 14, startTime: "00:01:16,500", endTime: "00:01:22,000", startMs: 76500, endMs: 82000, text: "Izquierda: tu tienda hoy." },
      { index: 15, startTime: "00:01:22,500", endTime: "00:01:28,000", startMs: 82500, endMs: 88000, text: "Derecha: tu tienda con ShopyCrafter." },
      { index: 16, startTime: "00:01:28,500", endTime: "00:01:34,000", startMs: 88500, endMs: 94000, text: "La diferencia no es magia. Es ingeniería con IA." },
      { index: 17, startTime: "00:01:34,500", endTime: "00:01:40,000", startMs: 94500, endMs: 100000, text: "Antes. Después. ShopyCrafter." },
      { index: 18, startTime: "00:01:40,500", endTime: "00:01:46,000", startMs: 100500, endMs: 106000, text: "ShopyCrafter no es otra herramienta." },
      { index: 19, startTime: "00:01:46,500", endTime: "00:01:52,000", startMs: 106500, endMs: 112000, text: "Es el equipo de e-commerce que siempre quisiste… pero con IA que nunca duerme." },
      { index: 20, startTime: "00:01:52,500", endTime: "00:01:58,000", startMs: 112500, endMs: 118000, text: "Gestionamos tu Shopify. Tú solo vendes." },
      { index: 21, startTime: "00:01:58,500", endTime: "00:02:04,000", startMs: 118500, endMs: 124000, text: "Solicita tu diagnóstico gratuito de 48 horas en shopycrafter.com" },
      { index: 22, startTime: "00:02:04,500", endTime: "00:02:10,000", startMs: 124500, endMs: 130000, text: "Ingeniería de E-commerce con IA." },
    ],
  },
];

// ─────────────────────────────────────────────────────────────────────────
// 6. PRODUCTION TIPS — best practices from all documents
// ─────────────────────────────────────────────────────────────────────────

export interface ProductionTip {
  id: string;
  category: "lip_sync" | "character_consistency" | "editing" | "ugc_style" | "color_grading" | "audio" | "delivery";
  title: string;
  description: string;
}

export const PRODUCTION_TIPS: ProductionTip[] = [
  { id: "tip:lip_sync_suffix", category: "lip_sync",
    title: "Sufijo obligatorio para lip sync",
    description: "Añade siempre al final del prompt: 'perfect lip sync, mouth moves naturally and exactly with the voice, realistic mouth movements, natural speaking'" },
  { id: "tip:character_ref", category: "character_consistency",
    title: "Foto de referencia única",
    description: "Usa la misma foto de referencia de la mujer (Crafter) en todos los clips. Esto es clave para que parezca la misma persona." },
  { id: "tip:transitions", category: "editing",
    title: "Transiciones suaves",
    description: "Usa transiciones Golden Light Wipe o Soft Dissolve entre clips. Nunca cortes bruscos." },
  { id: "tip:music_continuous", category: "editing",
    title: "Música continua",
    description: "Mantén la misma música de fondo continua en toda la concatenación. Exportar 2:10 bed primero." },
  { id: "tip:color_grading", category: "color_grading",
    title: "Color grading uniforme",
    description: "Aplica ligero color grading uniforme: golden highlights + natural skin tones. LUT recomendado: Dark teal shadows + golden highlights." },
  { id: "tip:handheld_feel", category: "ugc_style",
    title: "Movimiento handheld",
    description: "Ligero movimiento de cámara (handheld feel) para autenticidad UGC." },
  { id: "tip:natural_lighting", category: "ugc_style",
    title: "Iluminación natural",
    description: "Iluminación natural de ventana + luz suave para look UGC auténtico." },
  { id: "tip:real_expressions", category: "ugc_style",
    title: "Expresiones reales",
    description: "Expresiones faciales reales y sonrisas naturales. Pausas naturales y ritmo de habla real." },
  { id: "tip:audio_specs", category: "audio",
    title: "Especificaciones de audio",
    description: "48kHz 24-bit, -14 LUFS integrado, -1 dBTP máximo." },
  { id: "tip:character_lock_first", category: "character_consistency",
    title: "Generar referencia primero",
    description: "Genera UNA imagen de referencia de Crafter PRIMERO. Luego usa 'Image Reference' / 'Character Lock' / 'IP-Adapter' en Kling/Runway/Luma para 100% consistencia." },
  { id: "tip:parallel_generation", category: "delivery",
    title: "Generación en paralelo",
    description: "Ejecuta los 6 prompts en paralelo en tu herramienta AI preferida. Reduce tiempo de 6h a 1h." },
  { id: "tip:ab_testing", category: "delivery",
    title: "A/B testing recomendado",
    description: "A/B test Video 5 (Split-Screen) vs Video 6 (CTA) como standalone ads. Son los más efectivos para conversión directa." },
];

// ─────────────────────────────────────────────────────────────────────────
// 7. TECHNICAL SPECS — video/audio delivery specifications
// ─────────────────────────────────────────────────────────────────────────

export interface TechSpec {
  id: string;
  format: string;
  resolution: string;
  fps: number;
  codec: string;
  bitrateMbps: string;
  notes: string;
}

export const TECH_SPECS: TechSpec[] = [
  { id: "spec:primary_vertical", format: "Primary (9:16)", resolution: "1080×1920", fps: 30, codec: "H.264", bitrateMbps: "8-12", notes: "Reels, TikTok, Shorts" },
  { id: "spec:secondary_horizontal", format: "Secondary (16:9)", resolution: "1920×1080", fps: 30, codec: "H.264", bitrateMbps: "15-20", notes: "YouTube, Landing, LinkedIn" },
  { id: "spec:master_cut", format: "Master Cut", resolution: "1920×1080", fps: 24, codec: "H.264 + ProRes", bitrateMbps: "20-30", notes: "Letterbox 2.35:1, cinematic" },
  { id: "spec:audio", format: "Audio", resolution: "48kHz 24-bit", fps: 0, codec: "WAV + AAC", bitrateMbps: "N/A", notes: "-14 LUFS integrated, -1 dBTP max" },
];

// ─────────────────────────────────────────────────────────────────────────
// 8. DELIVERABLES CHECKLIST — agency handoff requirements
// ─────────────────────────────────────────────────────────────────────────

export interface Deliverable {
  id: string;
  category: "video" | "image" | "document" | "audio";
  description: string;
  quantity: number;
  format: string;
  dimensions: string;
}

export const DELIVERABLES_CHECKLIST: Deliverable[] = [
  { id: "del:vertical_videos", category: "video", description: "Videos verticales 9:16", quantity: 6, format: "MP4", dimensions: "1080×1920" },
  { id: "del:horizontal_videos", category: "video", description: "Videos horizontales 16:9", quantity: 6, format: "MP4", dimensions: "1920×1080" },
  { id: "del:master_film", category: "video", description: "Master Brand Film 2:10", quantity: 1, format: "MP4 + MOV ProRes", dimensions: "1920×1080" },
  { id: "del:vertical_thumbnails", category: "image", description: "Thumbnails verticales", quantity: 6, format: "PNG", dimensions: "1080×1920" },
  { id: "del:social_thumbnails", category: "image", description: "Thumbnails sociales", quantity: 6, format: "PNG", dimensions: "1200×628" },
  { id: "del:production_kit", category: "document", description: "PDF Kit de producción + SRT editables", quantity: 1, format: "PDF + SRT", dimensions: "N/A" },
  { id: "del:music_track", category: "audio", description: "Pista de música completa + stems", quantity: 1, format: "WAV + stems", dimensions: "N/A" },
];

// ─────────────────────────────────────────────────────────────────────────
// 9. AI VIDEO TOOLS — ranked recommendations
// ─────────────────────────────────────────────────────────────────────────

export interface AiVideoTool {
  rank: number;
  name: string;
  bestFor: string;
  notes: string;
}

export const AI_VIDEO_TOOLS: AiVideoTool[] = [
  { rank: 1, name: "Kling AI 1.6", bestFor: "Character consistency + motion", notes: "Best for maintaining Crafter across clips" },
  { rank: 2, name: "Runway Gen-3 Alpha", bestFor: "Prompt adherence + cinematic", notes: "Most faithful to detailed prompts" },
  { rank: 3, name: "Luma Dream Machine", bestFor: "3D/robotic elements", notes: "Ideal for Blueprint video robotic arms" },
  { rank: 4, name: "Pika Labs 2.1", bestFor: "Fastest iteration", notes: "Best for rapid draft previews" },
];

// ─────────────────────────────────────────────────────────────────────────
// 10. STORYBOARD STRUCTURE — 10-slide deck flow
// ─────────────────────────────────────────────────────────────────────────

export interface StoryboardSlide {
  slideNumber: number;
  title: string;
  content: string;
}

export const STORYBOARD_SLIDES: StoryboardSlide[] = [
  { slideNumber: 1, title: "Cover", content: "SHOPYCRAFTER VIDEO CAMPAIGN STORYBOARD DECK — Concepto 4: Si nosotros gestionáramos [tu tienda]. 6 Videos 9:16 + Master Cut 2:10 + Todos los Assets de Producción." },
  { slideNumber: 2, title: "Campaign Strategy", content: "Objetivo: Posicionar ShopyCrafter como socio premium de ingeniería de e-commerce con IA. Mensaje clave: 'Si ShopyCrafter gestionara tu tienda… tus resultados serían otros.' Estructura: Mystery → Deep Analysis → Construction → Explosive Results → Transformation → CTA." },
  { slideNumber: 3, title: "Character Reference — Crafter (Lock 100%)", content: "Descripción exacta para copy-paste en generadores IA. Paso crítico: generar imagen de referencia PRIMERO, luego usar como Character Lock/IP-Adapter en todos los generadores." },
  { slideNumber: 4, title: "Video 01 — Command Center (22s)", content: "Futuristic command center. Crafter appears. Golden metrics explode. Headline: Si ShopyCrafter gestionara tu tienda." },
  { slideNumber: 5, title: "Video 02 — Lupa de Precisión (20s)", content: "Magnifying glass reveals optimized code & metrics. Conversion jumps 2.4% → 8.7%. Headline: Análisis profundo. Resultados reales." },
  { slideNumber: 6, title: "Video 03 — Robotic Blueprint (24s)", content: "Robotic arms build Shopify store blueprint. Crafter directs. Golden light burst. Headline: Construimos tu tienda perfecta." },
  { slideNumber: 7, title: "Video 04 — Dashboard Dorado (18s)", content: "Golden conversion graphs skyrocketing. +347% in 90 days. Headline: +347% conversión en 90 días." },
  { slideNumber: 8, title: "Video 05 — Split-Screen (25s)", content: "Before (grey laggy) vs After (golden optimized). Crafter walks across the beam. Headline: Antes. Después. ShopyCrafter." },
  { slideNumber: 9, title: "Intelligent Master Cut — 2:10 Epic Film", content: "Los 6 vídeos concatenados con flujo emocional perfecto. Herramientas: CapCut/Premiere/DaVinci. Música continua. Color: Dark teal + golden highlights LUT." },
  { slideNumber: 10, title: "Technical Specs & Next Steps", content: "Specs técnicos completos + herramientas IA recomendadas + pasos de ejecución en 24-48h." },
];

// ═══════════════════════════════════════════════════════════════════════════
// QUERY HELPERS — deterministic lookups (no AI)
// ═══════════════════════════════════════════════════════════════════════════

export function getVideoBySlug(slug: string): VideoCampaign | undefined {
  return VIDEO_CAMPAIGNS.find(v => v.slug === slug);
}

export function getClipsByVideo(videoRef: string): UgcMicroClip[] {
  return UGC_MICRO_CLIPS.filter(c => c.videoRef === videoRef);
}

export function getSubtitleTrack(trackId: string): SubtitleTrack | undefined {
  return SUBTITLE_TRACKS.find(t => t.id === trackId);
}

export function exportSrt(trackId: string): string | null {
  const track = getSubtitleTrack(trackId);
  if (!track) return null;
  return track.cues.map(c =>
    `${c.index}\n${c.startTime} --> ${c.endTime}\n${c.text}\n`
  ).join("\n");
}

// ═══════════════════════════════════════════════════════════════════════════
// SUMMARY HELPERS — for REST endpoints
// ═══════════════════════════════════════════════════════════════════════════

export interface CampaignProductionSummary {
  totalVideos: number;
  totalUgcClips: number;
  totalDurationSec: number;
  masterCutDuration: string;
  characterVariants: number;
  subtitleTracks: number;
  deliverables: number;
  productionTips: number;
  sections: string[];
}

export function getCampaignProductionSummary(): CampaignProductionSummary {
  return {
    totalVideos: VIDEO_CAMPAIGNS.length,
    totalUgcClips: UGC_MICRO_CLIPS.length,
    totalDurationSec: VIDEO_CAMPAIGNS.reduce((s, v) => s + v.durationSec, 0),
    masterCutDuration: "2:10",
    characterVariants: CHARACTER_LOCKS.length,
    subtitleTracks: SUBTITLE_TRACKS.length,
    deliverables: DELIVERABLES_CHECKLIST.length,
    productionTips: PRODUCTION_TIPS.length,
    sections: [
      "CHARACTER_LOCKS",
      "VIDEO_CAMPAIGNS",
      "UGC_MICRO_CLIPS",
      "MASTER_CUT_TIMELINE",
      "SUBTITLE_TRACKS",
      "PRODUCTION_TIPS",
      "TECH_SPECS",
      "DELIVERABLES_CHECKLIST",
      "AI_VIDEO_TOOLS",
      "STORYBOARD_SLIDES",
    ],
  };
}

export function getFullCampaignProduction() {
  return {
    characterLocks: CHARACTER_LOCKS,
    videoCampaigns: VIDEO_CAMPAIGNS,
    ugcMicroClips: UGC_MICRO_CLIPS,
    masterCutTimeline: MASTER_CUT_TIMELINE,
    subtitleTracks: SUBTITLE_TRACKS,
    productionTips: PRODUCTION_TIPS,
    techSpecs: TECH_SPECS,
    deliverablesChecklist: DELIVERABLES_CHECKLIST,
    aiVideoTools: AI_VIDEO_TOOLS,
    storyboardSlides: STORYBOARD_SLIDES,
    platformAdaptationTemplates: PLATFORM_ADAPTATION_TEMPLATES,
  };
}

// ─────────────────────────────────────────────────────────────────────────
// 11. PLATFORM-SPECIFIC PROMPT ADAPTATION — Optimized per AI video engine
// ─────────────────────────────────────────────────────────────────────────

export interface PlatformAdaptationTemplate {
  id: string;
  platform: string;
  spanishLabel: string;
  promptPrefix: string;
  promptSuffix: string;
  cameraLock: string;
  physicsTokens: string[];
  identityLock: string;
  maxClipDuration: number;
  chainingMethod: string;
  negativeTokens: string[];
}

export const PLATFORM_ADAPTATION_TEMPLATES: PlatformAdaptationTemplate[] = [
  { id: "adapt:runway", platform: "Runway Gen-3/4", spanishLabel: "Adaptación Runway",
    promptPrefix: "",
    promptSuffix: "cinematic quality, smooth camera motion, photorealistic materials, professional advertising production",
    cameraLock: "STATIC LOCK-OFF CAMERA, zero camera movement, zero drift, fixed focal point",
    physicsTokens: ["no morphing", "rigid mechanical parts", "precise physics", "accurate material properties"],
    identityLock: "Use image-to-video with product reference frame. Last frame of clip N = first frame input of clip N+1.",
    maxClipDuration: 10,
    chainingMethod: "Sequential image-to-video: extract last frame of previous clip, use as input for next clip generation",
    negativeTokens: ["no text", "no watermark", "no UI elements", "no morphing between objects"] },
  { id: "adapt:seedance", platform: "Seedance 2.0", spanishLabel: "Adaptación Seedance",
    promptPrefix: "",
    promptSuffix: "rigid body physics, precise mechanical motion, no morphing, studio-quality render",
    cameraLock: "static locked-off camera, zero camera drift, fixed angle throughout entire generation",
    physicsTokens: ["rigid body physics", "precise mechanical motion", "no morphing", "accurate gravity and inertia", "natural material deformation only"],
    identityLock: "Use omni_reference mode with up to 12 mixed references (images + videos). Provide product reference images for 100% identity lock.",
    maxClipDuration: 10,
    chainingMethod: "first_last_frames mode: provide first frame + last frame, model interpolates all intermediate frames with 98% frame-match rate",
    negativeTokens: ["no morphing", "no object transformation", "no teleportation", "no floating artifacts"] },
  { id: "adapt:kling", platform: "Kling 3.0", spanishLabel: "Adaptación Kling",
    promptPrefix: "",
    promptSuffix: "4K resolution, cinematic quality, precise mechanical motion, studio lighting",
    cameraLock: "Use dedicated camera control API: set pan=0, tilt=0, zoom=0, roll=0 for static shot",
    physicsTokens: ["ease-in/ease-out kinetic curve", "smooth mechanical detachment", "zero-gravity suspension", "absolute structural stability"],
    identityLock: "Element Binding: upload product reference image, system locks appearance across all generated clips in multi-shot sequence.",
    maxClipDuration: 15,
    chainingMethod: "Multi-shot mode with Element Binding for consistency. Motion Control transfers precise movements between clips.",
    negativeTokens: ["no face deformation", "no object blending", "no color shift between clips"] },
  { id: "adapt:pollo", platform: "Pollo.ai 2.0", spanishLabel: "Adaptación Pollo.ai",
    promptPrefix: "",
    promptSuffix: "professional advertising quality, consistent visual style, smooth transitions",
    cameraLock: "Select 'Static' camera preset in Camera Control panel, or write 'static locked camera' in prompt",
    physicsTokens: ["natural physics", "realistic motion", "consistent lighting", "smooth movement curves"],
    identityLock: "Multi-Shot mode preserves object/character consistency across sequential clips automatically.",
    maxClipDuration: 10,
    chainingMethod: "Multi-Shot mode + Pollo Transitions for seamless clip-to-clip flow. Video Agent (Beta) can automate entire pipeline.",
    negativeTokens: ["no watermark", "no morphing", "no style drift between clips"] },
  { id: "adapt:veo", platform: "Veo 3.1", spanishLabel: "Adaptación Veo",
    promptPrefix: "",
    promptSuffix: "dramatic volumetric shadows, octane render style, physics-accurate motion, studio-grade lighting",
    cameraLock: "Use First+Last Frame mode for strongest spatial anchoring. Specify 'static camera, no movement' in text prompt.",
    physicsTokens: ["accurate gravity", "magnetic attraction", "mechanical precision", "fluid dynamics", "realistic material interaction"],
    identityLock: "Upload up to 3 reference images as 'asset' type. System locks product identity across generation.",
    maxClipDuration: 8,
    chainingMethod: "Video extension mode: extend each clip from the end of the previous clip for temporal continuity",
    negativeTokens: ["no text generation", "no UI overlay", "no unrealistic physics"] },
];

// ═══════════════════════════════════════════════════════════════════════════
// AI-POWERED COMPOSE HELPERS — use Claude to adapt for any brand
// ═══════════════════════════════════════════════════════════════════════════

export interface BrandAdaptationInput {
  brandName: string;
  industry: string;
  coreOffering: string;
  targetAudience: string;
  toneOfVoice: string;
  visualIdentity: string;
  emotionalBenefit: string;
  primaryColor: string;
  accentColor: string;
}

export interface AdaptedCampaign {
  brandName: string;
  characterDescription: string;
  videos: Array<{
    index: number;
    title: string;
    headline: string;
    prompt916: string;
    voiceOverScript: string;
  }>;
}

export function buildAdaptationSystemPrompt(): string {
  return `Eres un director creativo de producción de video publicitario de clase mundial.
Tu trabajo es adaptar el kit de producción de campaña de ShopyCrafter para una marca diferente.

REGLAS ESTRICTAS:
1. Mantén la MISMA estructura narrativa de 6 vídeos (Mystery → Analysis → Construction → Results → Transformation → CTA)
2. Adapta TODOS los prompts visuales al estilo, colores e industria de la nueva marca
3. Reescribe TODOS los voice-over scripts para la nueva marca
4. Adapta el personaje "Crafter" a la estética de la nueva marca
5. Mantén la calidad cinematográfica y los timings exactos
6. Responde SIEMPRE en español
7. Genera prompts COMPLETOS listos para copiar-pegar en herramientas IA de video
8. Incluye SIEMPRE las indicaciones de cámara, iluminación y música

FORMATO DE RESPUESTA: JSON válido con la estructura AdaptedCampaign.`;
}

export function buildAdaptationUserPrompt(input: BrandAdaptationInput): string {
  const reference = VIDEO_CAMPAIGNS.map(v => ({
    index: v.index,
    title: v.title,
    duration: v.durationSec,
    concept: v.concept,
    headline: v.headline,
    prompt916: v.prompt916,
    voiceOver: v.voiceOver.map(vo => vo.text).join(" "),
    musicCue: v.musicCue,
  }));

  return `MARCA A ADAPTAR:
- Nombre: ${input.brandName}
- Industria: ${input.industry}
- Oferta principal: ${input.coreOffering}
- Audiencia objetivo: ${input.targetAudience}
- Tono de voz: ${input.toneOfVoice}
- Identidad visual: ${input.visualIdentity}
- Beneficio emocional: ${input.emotionalBenefit}
- Color primario: ${input.primaryColor}
- Color acento: ${input.accentColor}

CAMPAÑA DE REFERENCIA (adapta esto):
${JSON.stringify(reference, null, 2)}

Genera la campaña adaptada completa como JSON válido con esta estructura:
{
  "brandName": "...",
  "characterDescription": "... (descripción del personaje adaptado a la marca)",
  "videos": [
    {
      "index": 1,
      "title": "...",
      "headline": "...",
      "prompt916": "... (prompt COMPLETO 9:16 adaptado)",
      "voiceOverScript": "... (script completo de voz)"
    }
  ]
}`;
}
