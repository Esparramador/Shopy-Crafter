/**
 * Video Virtual Try-On — Spokesperson + Product fusion in motion.
 *
 * Pipeline:
 *  1. (Optional) Fuse model image + product image via gemini-2.5-flash-image
 *     to get a reference frame where the model already wears/holds the product.
 *  2. Feed that frame to a video model (Kling / Hailuo / Runway Gen-4) with a
 *     cinematic prompt describing the motion (effectStyle).
 *  3. Return the final MP4 buffer ready to persist to vault.
 *
 * Effect styles supported:
 *  - "natural_wear": camera orbit / model showcases naturally
 *  - "magical_dress": item flies in from off-camera and snaps onto body
 *  - "multishot_outfit_change": multi-pose changes (Kling-Master only)
 *  - "lifestyle_use": model uses the product (cosmetics applies makeup, etc.)
 */
import { generateVideoFromImage, type VideoModel } from "./fusion-studio-pro.js";
import { logger } from "./logger.js";

export type TryonProvider = "kling" | "hailuo" | "runway";
export type EffectStyle = "natural_wear" | "magical_dress" | "multishot_outfit_change" | "lifestyle_use";
export type CharacterGender = "female" | "male" | "neutral";

const PROVIDER_TO_MODEL: Record<TryonProvider, { primary: VideoModel; quality: VideoModel }> = {
  kling:  { primary: "kling-2.1",         quality: "kling-master" },
  hailuo: { primary: "hailuo-02",         quality: "hailuo-02" },
  runway: { primary: "runway-gen4.5", quality: "runway-gen4.5" },
};

export interface TryonVideoInput {
  provider: TryonProvider;
  /** Reference frame: model+product already fused (e.g. via tryon-quick). Required for I2V. */
  referenceImage: Buffer;
  referenceImageMime: string;
  productTitle: string;
  productType?: string;
  effectStyle: EffectStyle;
  characterGender: CharacterGender;
  language?: string;        // for any on-screen text hint, optional
  duration?: number;        // 3-10
  aspect?: string;          // "9:16" | "16:9" | "1:1"
  /** When true → use higher-quality variant (kling-master, costs more). */
  premium?: boolean;
  /** Replicate token for Replicate-backed providers. */
  replicateToken?: string;
  /** Optional camera preset. */
  cameraPreset?: string;
  /** Free-form extra description (will be appended to base prompt). */
  customNotes?: string;
}

const GENDER_DESCRIPTOR: Record<CharacterGender, string> = {
  female: "young female model",
  male:   "young male model",
  neutral: "person",
};

const EFFECT_PROMPTS: Record<EffectStyle, (i: TryonVideoInput) => string> = {
  natural_wear: (i) =>
    `${GENDER_DESCRIPTOR[i.characterGender]} confidently showcasing the ${i.productType || "product"} (${i.productTitle}), ` +
    `slow camera orbit 360°, soft natural lighting, photorealistic, cinematic ad quality, subtle hair and fabric motion, ` +
    `professional commercial production value, depth of field, shot on Sony Alpha 7R IV.`,

  magical_dress: (i) =>
    `Cinematic magical try-on: the ${i.productType || "garment"} (${i.productTitle}) flies in from the upper-left of the frame, ` +
    `swirling in slow-motion fabric ripples, then elegantly wraps and adheres seamlessly to the body of the ${GENDER_DESCRIPTOR[i.characterGender]}. ` +
    `Smooth physics, photorealistic, no glitches, sparkle particles dissolve as the garment locks in place. ` +
    `Camera glides around the figure as the transformation completes. Cinematic colour grading, professional ad film.`,

  multishot_outfit_change: (i) =>
    `Multi-shot outfit reveal: the ${GENDER_DESCRIPTOR[i.characterGender]} stands in a minimalist studio. ` +
    `Cut 1: the ${i.productType || "garment"} (${i.productTitle}) is tossed into the air in slow motion. ` +
    `Cut 2: the camera angle changes and the garment is now fitted on the model from a new angle, walking forward. ` +
    `Cut 3: a third angle showcases the back/side detail in motion. Smooth crossfade transitions, cinematic ad campaign quality.`,

  lifestyle_use: (i) =>
    `${GENDER_DESCRIPTOR[i.characterGender]} naturally using the ${i.productTitle} (${i.productType || "product"}) in a real-life moment. ` +
    `Authentic emotional expression, golden hour lighting, soft cinematic depth-of-field, hand-held documentary feel, ` +
    `subtle product close-up insert. Authentic micro-expressions, realistic skin and material texture, commercial photography quality.`,
};

const NEGATIVE_TAGS = [
  "deformed limbs", "extra fingers", "warped face", "low quality",
  "watermark", "blurry product", "missing product", "duplicate person",
  "cartoonish", "plastic skin", "subtitles", "text overlay",
];

export interface TryonVideoResult {
  buffer: Buffer;
  model: VideoModel;
  prompt: string;
  durationSec: number;
  costEstimateUsd: number;
}

export async function generateTryonVideo(input: TryonVideoInput): Promise<TryonVideoResult> {
  const providerCfg = PROVIDER_TO_MODEL[input.provider];
  if (!providerCfg) throw new Error(`Provider de try-on no soportado: ${input.provider}`);

  // multishot_outfit_change requires kling-master for true multi-shot
  let chosenModel: VideoModel = input.premium ? providerCfg.quality : providerCfg.primary;
  if (input.effectStyle === "multishot_outfit_change") {
    if (input.provider === "kling") chosenModel = "kling-master";
    else logger.warn({ provider: input.provider, effectStyle: input.effectStyle }, "video-tryon: multishot_outfit_change requested with non-kling provider — quality may be limited");
  }

  const basePrompt = EFFECT_PROMPTS[input.effectStyle](input);
  const negative = `Avoid: ${NEGATIVE_TAGS.join(", ")}.`;
  const customSuffix = input.customNotes ? ` ${input.customNotes.slice(0, 300)}` : "";
  const fullPrompt = `${basePrompt}${customSuffix} ${negative}`.slice(0, 1500);

  const duration = Math.max(3, Math.min(10, input.duration || 5));
  const aspect = input.aspect || "9:16";

  logger.info({ provider: input.provider, model: chosenModel, effectStyle: input.effectStyle, duration, aspect }, "video-tryon: starting generation");

  let buffer: Buffer;
  try {
    buffer = await generateVideoFromImage(
      chosenModel,
      input.referenceImage,
      input.referenceImageMime,
      fullPrompt,
      { duration, aspect, replicateToken: input.replicateToken, cameraPreset: input.cameraPreset },
    );
  } catch (e) {
    const msg = (e as Error)?.message || String(e);
    logger.error({ err: msg, provider: input.provider, model: chosenModel }, "video-tryon: primary model failed");
    throw new Error(`Video try-on falló (${chosenModel}): ${msg}`);
  }

  // Cost estimate: very rough — providers vary
  const costPerSec = chosenModel === "kling-master" ? 0.18 :
                     chosenModel === "kling-2.1" ? 0.09 :
                     chosenModel === "hailuo-02" ? 0.05 :
                     chosenModel === "runway-gen4.5" ? 0.06 : 0.07;
  const costEstimateUsd = +(costPerSec * duration).toFixed(3);

  return { buffer, model: chosenModel, prompt: fullPrompt, durationSec: duration, costEstimateUsd };
}
