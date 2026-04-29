/**
 * AdStudio templates — recipes that pre-curate prompts, voice style, music,
 * camera, transitions and caption styling for each genre of professional ad.
 *
 * Mirrors the genre selection of pollo.ai (UGC ads, viral clones, product
 * demos, explainers, news anchor, story cinematic, music video) but adapted
 * to our existing `runAdCampaign` pipeline (Claude → Nano Banana → Runway/
 * Replicate → ElevenLabs → FFmpeg). Each template is a pure data object so
 * the engine stays generic and templates can be added/edited without code
 * changes.
 */

export type AdTemplateKey =
  | "ugc_review"
  | "product_demo"
  | "explainer"
  | "news_anchor"
  | "story_cinematic"
  | "music_video"
  | "viral_hook";

export interface AdTemplate {
  key: AdTemplateKey;
  label: string;
  description: string;
  /** Extra system instruction merged into the copy prompt sent to Claude. */
  copySystemAddon: string;
  /** Style guide injected into the hero image generation prompt. */
  heroStyle: string;
  /** Camera preset key from CAMERA_PRESETS in fusion-studio-pro.ts. */
  cameraPreset: string;
  /** Suggested ElevenLabs voice "labels" (descriptive, used to filter UI). */
  voiceProfile: { gender?: "male" | "female" | "any"; age?: "young" | "mid" | "old"; tone: string };
  /** Music brief sent to Stable Audio (overridden by user if `addMusic=false`). */
  musicBrief: string;
  /** Transition preset key from TRANSITION_PRESETS — used when concatenating. */
  transitionPreset: string;
  /** Whether this template benefits from lip-sync post-processing. */
  recommendLipSync: boolean;
  /** Whether to burn subtitles by default. */
  burnSubsByDefault: boolean;
  /** Default aspect ratio recommendation. */
  defaultAspect: "9:16" | "16:9" | "1:1" | "4:5";
  /** Default duration in seconds. */
  defaultDurationSec: number;
}

export const AD_TEMPLATES: Record<AdTemplateKey, AdTemplate> = {
  ugc_review: {
    key: "ugc_review",
    label: "UGC Review",
    description: "Avatar-creator hablando a cámara reseñando el producto, estilo TikTok orgánico.",
    copySystemAddon:
      "Tono UGC sincero, primera persona, lenguaje casual, hook conversacional en los 3 primeros segundos. CTA suave (link en bio / código en descripción).",
    heroStyle:
      "Foto vertical estilo selfie de creador de contenido sosteniendo el producto, iluminación ring-light suave, fondo de habitación real, autenticidad por encima de perfección publicitaria.",
    cameraPreset: "handheld",
    voiceProfile: { gender: "any", age: "young", tone: "conversacional, cercano, energía media-alta" },
    musicBrief:
      "Música lo-fi suave de fondo, beat sutil, tipo TikTok ambient, máximo 60 BPM, sin elementos dominantes",
    transitionPreset: "hard_cut",
    recommendLipSync: true,
    burnSubsByDefault: true,
    defaultAspect: "9:16",
    defaultDurationSec: 8,
  },
  product_demo: {
    key: "product_demo",
    label: "Product Demo",
    description: "Demostración cinematográfica del producto en uso, con motion overlays y planos detalle.",
    copySystemAddon:
      "Tono profesional, narración descriptiva del valor del producto. Estructura: problema → producto → beneficio → CTA. Frases cortas para voiceover.",
    heroStyle:
      "Foto de producto cinematográfica, iluminación de estudio, fondo gradiente o bokeh, composición rule-of-thirds, color grading premium tipo Apple ad.",
    cameraPreset: "dolly_in",
    voiceProfile: { gender: "any", age: "mid", tone: "profesional, claro, autoridad cálida" },
    musicBrief:
      "Música corporativa moderna, build-up sutil hacia el CTA, percusión electrónica suave, tipo Apple keynote",
    transitionPreset: "cross_dissolve",
    recommendLipSync: false,
    burnSubsByDefault: true,
    defaultAspect: "16:9",
    defaultDurationSec: 10,
  },
  explainer: {
    key: "explainer",
    label: "Explainer",
    description: "Vídeo explicativo con narración guiando visuales que ilustran un concepto.",
    copySystemAddon:
      "Tono didáctico, narrador explicando paso a paso. Estructura: 'Qué es' → 'Cómo funciona' → 'Por qué importa' → CTA. Frases declarativas, una idea por frase.",
    heroStyle:
      "Composición clara y limpia mostrando el producto en contexto de uso, iconografía sutil, paleta sobria, estilo SaaS landing-page.",
    cameraPreset: "push_in",
    voiceProfile: { gender: "any", age: "mid", tone: "didáctico, calmo, articulado" },
    musicBrief:
      "Música ambient cinematic instructiva, tipo TED talk intro, piano + pads, energía contenida",
    transitionPreset: "white_flash",
    recommendLipSync: false,
    burnSubsByDefault: true,
    defaultAspect: "16:9",
    defaultDurationSec: 10,
  },
  news_anchor: {
    key: "news_anchor",
    label: "News Anchor",
    description: "Presentador estilo broadcast anunciando el producto como noticia.",
    copySystemAddon:
      "Tono informativo de noticiero, tercera persona, frases declarativas con autoridad. 'Hoy presentamos...', 'Análisis exclusivo...'. CTA tipo 'Más información en...'.",
    heroStyle:
      "Encuadre tipo broadcast TV, presentador en plano medio sobre fondo de estudio con pantalla LED del producto detrás, iluminación direccional, look profesional periodístico.",
    cameraPreset: "static",
    voiceProfile: { gender: "any", age: "mid", tone: "broadcast, autoritario, articulación clara" },
    musicBrief:
      "Música de breaking news, fanfarria corta de apertura, percusión orquestal sutil de fondo, tipo CNN intro",
    transitionPreset: "white_flash",
    recommendLipSync: true,
    burnSubsByDefault: true,
    defaultAspect: "16:9",
    defaultDurationSec: 10,
  },
  story_cinematic: {
    key: "story_cinematic",
    label: "Story Cinematic",
    description: "Mini-historia cinematográfica de 8-15s que conecta emocionalmente con el producto.",
    copySystemAddon:
      "Tono narrativo emocional, micro-historia con arc dramático en pocos segundos. Personaje → conflicto → producto resuelve → resolución emotiva. Voiceover poético, frases con peso.",
    heroStyle:
      "Plano cinematográfico anamórfico simulado, color grading tipo film, contraste alto, narrativa visual implícita, calidad de fotograma de cortometraje.",
    cameraPreset: "crane_up",
    voiceProfile: { gender: "any", age: "mid", tone: "emotivo, íntimo, susurro controlado" },
    musicBrief:
      "Música cinematográfica orquestal mínima, cuerdas + piano, build emocional gradual, tipo trailer indie",
    transitionPreset: "fade_to_black",
    recommendLipSync: false,
    burnSubsByDefault: false,
    defaultAspect: "16:9",
    defaultDurationSec: 12,
  },
  music_video: {
    key: "music_video",
    label: "Music Video",
    description: "Clip estilo videoclip musical, sincronizado con beat, alta energía visual.",
    copySystemAddon:
      "Letra/lyrics cortas y punchy, ritmo marcado. Estructura: gancho repetitivo → verso del producto → coro CTA. Lenguaje urbano/streetwear si aplica.",
    heroStyle:
      "Estética videoclip moderno, color grading saturado/duotone, modelos cool con producto, iluminación neón o golden hour, energía cinética.",
    cameraPreset: "orbit_left",
    voiceProfile: { gender: "any", age: "young", tone: "rítmico, expresivo, alta energía" },
    musicBrief:
      "Beat hip-hop/electro pop con drop marcado, tempo 110-130 BPM, drums punchy, melódico pegadizo",
    transitionPreset: "zoom_punch",
    recommendLipSync: true,
    burnSubsByDefault: true,
    defaultAspect: "9:16",
    defaultDurationSec: 12,
  },
  viral_hook: {
    key: "viral_hook",
    label: "Viral Hook",
    description: "Formato reels/shorts con hook brutal en 1.5s, diseñado para retención completa.",
    copySystemAddon:
      "HOOK extremo en los primeros 1.5 segundos: pregunta provocadora, dato impactante o reveal visual. Resto = pago de la promesa del hook + CTA en último segundo.",
    heroStyle:
      "Composición vertical agresiva, foco central marcado, color contrastado, texto grande tipo meme overlay sugerido, estética viral TikTok.",
    cameraPreset: "crash_zoom",
    voiceProfile: { gender: "any", age: "young", tone: "alta energía, urgencia, exclamativo" },
    musicBrief:
      "Trending audio tipo TikTok viral, beat percutido, drop en segundo 2, tempo alto 140+ BPM",
    transitionPreset: "zoom_punch",
    recommendLipSync: true,
    burnSubsByDefault: true,
    defaultAspect: "9:16",
    defaultDurationSec: 6,
  },
};

export function getTemplate(key?: string | null): AdTemplate | null {
  if (!key) return null;
  return AD_TEMPLATES[key as AdTemplateKey] ?? null;
}

export function listTemplates(): AdTemplate[] {
  return Object.values(AD_TEMPLATES);
}
