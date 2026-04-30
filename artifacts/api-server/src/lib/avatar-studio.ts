import { logger } from "./logger.js";
import {
  generateImage,
  generateVideoFromImage,
  generateTTS,
  lipSyncVideoToAudio,
  transferMotionToImage,
  composeAd,
  fetchToBuffer,
  type VideoModel,
  type ImageGenModel,
} from "./fusion-studio-pro.js";

// ═════════════════════════════════════════════════════════════════════════
// AVATAR LIBRARY (Pollo-style preset talking heads grouped by niche)
// ═════════════════════════════════════════════════════════════════════════

export type AvatarNiche =
  | "beauty"
  | "health"
  | "fashion"
  | "tech"
  | "food"
  | "home"
  | "fitness"
  | "finance";

export type AvatarGender = "female" | "male" | "neutral";

export interface AvatarPreset {
  /** Stable id used by the frontend & APIs */
  id: string;
  /** Display name (e.g. "CHARMING ELENA") */
  name: string;
  niche: AvatarNiche;
  gender: AvatarGender;
  /** Language code for the default voice (e.g. "es", "en", "en-US") */
  defaultLanguage: string;
  /** ElevenLabs voice id (string of 20–32 chars). If null → caller must pass voiceId. */
  defaultVoiceId: string;
  /** Description of the persona (used as part of the keyframe prompt) */
  personaPrompt: string;
  /** Visual archetype for the headshot (used as fallback when no custom photo) */
  visualArchetype: string;
}

/**
 * Curated avatar library equivalent to Pollo.ai's "Public Avatars" panel.
 * Voice ids are ElevenLabs public/stock ids that ship with every account so
 * they work immediately without any voice cloning.
 *
 * Voice catalog reference (stock voices, available to every account):
 *  21m00Tcm4TlvDq8ikWAM  Rachel       (en, friendly female)
 *  EXAVITQu4vr4xnSDxMaL  Bella        (en, warm female)
 *  AZnzlk1XvdvUeBnXmlld  Domi         (en, energetic female)
 *  ThT5KcBeYPX3keUQqHPh  Dorothy      (en, soothing female)
 *  pNInz6obpgDQGcFmaJgB  Adam         (en, confident male)
 *  TxGEqnHWrfWFTfGW9XjX  Josh         (en, deep male)
 *  VR6AewLTigWG4xSOukaG  Arnold       (en, narrator male)
 *  yoZ06aMxZJJ28mfd3POQ  Sam          (en, casual male)
 */
export const AVATAR_LIBRARY: AvatarPreset[] = [
  // ── Beauty ────────────────────────────────────────────────────────────
  {
    id: "charming-elena",
    name: "Charming Elena",
    niche: "beauty",
    gender: "female",
    defaultLanguage: "es",
    defaultVoiceId: "21m00Tcm4TlvDq8ikWAM",
    personaPrompt: "young charismatic beauty influencer, warm smile, soft natural makeup, Mediterranean look, friendly and confident energy",
    visualArchetype: "headshot of a beautiful 28-year-old woman with long brown wavy hair, glowing skin, soft natural makeup, looking directly into camera with a warm friendly smile, beauty studio lighting, clean cream background, shot on 85mm lens, magazine quality",
  },
  {
    id: "fresh-anna",
    name: "Fresh Anna",
    niche: "beauty",
    gender: "female",
    defaultLanguage: "en",
    defaultVoiceId: "EXAVITQu4vr4xnSDxMaL",
    personaPrompt: "fresh-faced skincare expert, dewy skin, calm and trustworthy, elegant minimalist look",
    visualArchetype: "headshot of a 26-year-old Scandinavian woman with shoulder-length blonde hair, dewy clean skin, no makeup look, soft white background, cinematic skincare ad lighting, looking warmly at camera, 85mm portrait",
  },
  {
    id: "makeup-emily",
    name: "Makeup Emily",
    niche: "beauty",
    gender: "female",
    defaultLanguage: "en",
    defaultVoiceId: "AZnzlk1XvdvUeBnXmlld",
    personaPrompt: "vibrant makeup artist, bold colorful eyeshadow, sparkling personality, gen-z energy",
    visualArchetype: "vibrant headshot of a 25-year-old woman with bold creative eye makeup, glossy lips, fashionable hairstyle, colorful gradient background, beauty editorial lighting, looking confidently at camera",
  },

  // ── Health & Medical ──────────────────────────────────────────────────
  {
    id: "care-leo",
    name: "Care Leo",
    niche: "health",
    gender: "male",
    defaultLanguage: "es",
    defaultVoiceId: "pNInz6obpgDQGcFmaJgB",
    personaPrompt: "trustworthy young doctor, warm bedside manner, calm and educated tone",
    visualArchetype: "professional headshot of a 35-year-old male doctor in a white medical coat with a stethoscope, warm friendly smile, hospital corridor blurred background, soft natural light, looking directly at camera",
  },
  {
    id: "professional-judy",
    name: "Professional Judy",
    niche: "health",
    gender: "female",
    defaultLanguage: "en",
    defaultVoiceId: "ThT5KcBeYPX3keUQqHPh",
    personaPrompt: "experienced female health professional, reassuring presence, mid-40s, articulate",
    visualArchetype: "professional headshot of a 42-year-old female doctor with neat short hair, white medical coat, clean modern clinic background, kind reassuring expression, soft daylight from the side",
  },

  // ── Fashion ───────────────────────────────────────────────────────────
  {
    id: "refined-matteo",
    name: "Refined Matteo",
    niche: "fashion",
    gender: "male",
    defaultLanguage: "en",
    defaultVoiceId: "TxGEqnHWrfWFTfGW9XjX",
    personaPrompt: "refined Italian male model, sharp jawline, sophisticated style, fashion editorial poise",
    visualArchetype: "editorial fashion headshot of a 32-year-old Italian male model with short dark hair, sharp jawline, wearing an elegant dark turtleneck, neutral grey studio background, dramatic Rembrandt lighting, looking directly into camera",
  },
  {
    id: "hazel-helen",
    name: "Hazel Helen",
    niche: "fashion",
    gender: "female",
    defaultLanguage: "en",
    defaultVoiceId: "EXAVITQu4vr4xnSDxMaL",
    personaPrompt: "elegant fashion stylist, hazel eyes, runway-ready, polished editorial energy",
    visualArchetype: "high-fashion headshot of a 30-year-old woman with hazel eyes, sleek brunette hair, minimal makeup, wearing a tailored blazer, soft beige background, magazine-cover lighting, confident gaze into camera",
  },

  // ── Tech ──────────────────────────────────────────────────────────────
  {
    id: "tech-evan",
    name: "Tech Evan",
    niche: "tech",
    gender: "male",
    defaultLanguage: "en",
    defaultVoiceId: "VR6AewLTigWG4xSOukaG",
    personaPrompt: "young tech-product reviewer, modern casual, articulate, energetic geek-chic vibe",
    visualArchetype: "modern headshot of a 28-year-old male tech reviewer with short hair, smart casual henley shirt, modern home-office background with soft purple accent lighting, friendly enthusiastic expression, looking at camera",
  },
  {
    id: "tech-mia",
    name: "Tech Mia",
    niche: "tech",
    gender: "female",
    defaultLanguage: "en",
    defaultVoiceId: "AZnzlk1XvdvUeBnXmlld",
    personaPrompt: "smart female tech founder, confident and bright, modern professional",
    visualArchetype: "modern headshot of a 30-year-old female tech founder with shoulder-length straight hair, smart minimalist outfit, gradient blue-purple studio background with subtle bokeh tech lights, confident warm expression",
  },

  // ── Food ──────────────────────────────────────────────────────────────
  {
    id: "chef-marco",
    name: "Chef Marco",
    niche: "food",
    gender: "male",
    defaultLanguage: "es",
    defaultVoiceId: "TxGEqnHWrfWFTfGW9XjX",
    personaPrompt: "passionate Mediterranean chef, warm welcoming energy, kitchen storyteller",
    visualArchetype: "warm headshot of a 40-year-old male chef with a neat beard wearing a clean white chef jacket, professional kitchen background slightly blurred, golden warm light, friendly inviting expression",
  },
  {
    id: "foodie-clara",
    name: "Foodie Clara",
    niche: "food",
    gender: "female",
    defaultLanguage: "es",
    defaultVoiceId: "21m00Tcm4TlvDq8ikWAM",
    personaPrompt: "joyful food creator, expressive, makes everything look delicious",
    visualArchetype: "bright headshot of a 27-year-old female food creator with a warm smile, casual chic apron, sunny kitchen background, natural window light, happy expressive look",
  },

  // ── Home & Lifestyle ──────────────────────────────────────────────────
  {
    id: "home-laura",
    name: "Home Laura",
    niche: "home",
    gender: "female",
    defaultLanguage: "es",
    defaultVoiceId: "EXAVITQu4vr4xnSDxMaL",
    personaPrompt: "calm interior-design enthusiast, soft-spoken, aspirational lifestyle vibe",
    visualArchetype: "headshot of a 33-year-old woman with natural makeup, soft sweater, scandinavian-style living room background with warm sunlight, calm peaceful expression",
  },

  // ── Fitness ───────────────────────────────────────────────────────────
  {
    id: "fit-rohan",
    name: "Fit Rohan",
    niche: "fitness",
    gender: "male",
    defaultLanguage: "en",
    defaultVoiceId: "VR6AewLTigWG4xSOukaG",
    personaPrompt: "athletic personal trainer, motivational, high-energy, peak physical condition",
    visualArchetype: "headshot of a 30-year-old athletic male trainer in a black sports tank top, defined jawline, modern gym background with motion-blur weights, motivational confident expression, dramatic key lighting",
  },

  // ── Finance ──────────────────────────────────────────────────────────
  {
    id: "finance-david",
    name: "Finance David",
    niche: "finance",
    gender: "male",
    defaultLanguage: "en",
    defaultVoiceId: "pNInz6obpgDQGcFmaJgB",
    personaPrompt: "credible finance analyst, sharp suit, articulate authoritative tone",
    visualArchetype: "professional headshot of a 38-year-old male finance analyst in a navy blue suit, modern downtown office background with skyline through floor-to-ceiling windows, confident authoritative expression",
  },
];

export function listAvatarsByNiche(): Record<AvatarNiche, AvatarPreset[]> {
  const out: Partial<Record<AvatarNiche, AvatarPreset[]>> = {};
  for (const a of AVATAR_LIBRARY) {
    if (!out[a.niche]) out[a.niche] = [];
    out[a.niche]!.push(a);
  }
  return out as Record<AvatarNiche, AvatarPreset[]>;
}

export function findAvatar(id: string): AvatarPreset | null {
  return AVATAR_LIBRARY.find((a) => a.id === id) ?? null;
}

// ═════════════════════════════════════════════════════════════════════════
// TALKING AVATAR (Pollo "Avatar Videos")
// ═════════════════════════════════════════════════════════════════════════

export interface TalkingAvatarRequest {
  projectId: number;
  /** Use a preset id from AVATAR_LIBRARY */
  avatarId?: string;
  /** OR provide a custom face buffer (e.g. user's selfie) */
  customAvatarBuffer?: Buffer;
  customAvatarMime?: string;
  /** Script the avatar will speak (max ~1500 chars to fit a single TTS call) */
  script: string;
  /** Override the avatar's default voice */
  voiceId?: string;
  voiceModel?: "eleven_multilingual_v2" | "eleven_turbo_v2_5" | "eleven_flash_v2_5";
  language?: string;
  aspect?: "9:16" | "16:9" | "1:1";
  /** Image model used to render the avatar headshot when none is provided */
  imageModel?: ImageGenModel;
  /** Video model used to animate the avatar (default kling-master, top motion + lip-friendly) */
  videoModel?: VideoModel;
  /** Apply lip-sync (Replicate) on top of the generated video for better mouth alignment */
  applyLipSync?: boolean;
}

export interface TalkingAvatarResult {
  finalVideo: Buffer;
  finalMime: string;
  avatarImage: Buffer;
  avatarMime: string;
  voiceover: Buffer;
  voiceoverMime: string;
  durationSec: number;
  avatar: AvatarPreset | null;
}

const TALK_VIDEO_PROMPT_TEMPLATE = (persona: string) =>
  `Talking head shot, ${persona}. The person is looking directly at camera and speaking confidently with natural mouth movement, subtle head nods, expressive eyes, and small natural facial micro-movements. Professional broadcast lighting, locked-off camera, sharp focus on the face, minimal background motion.`;

function aspectToImage(aspect: "9:16" | "16:9" | "1:1"): string {
  return aspect === "16:9" ? "16:9" : aspect === "1:1" ? "1:1" : "9:16";
}

/**
 * Generate a talking-avatar video Pollo-style:
 *  1. Use/generate a headshot image of the avatar
 *  2. Animate it with a lip-friendly video model (kling-master by default)
 *  3. Synthesize the voiceover with ElevenLabs
 *  4. Mux audio onto the video; optionally run lip-sync for tight mouth match
 */
export async function generateTalkingAvatar(req: TalkingAvatarRequest): Promise<TalkingAvatarResult> {
  if (!req.script || !req.script.trim()) throw new Error("script requerido");
  if (req.script.length > 1500) throw new Error("script demasiado largo (máx 1500 chars)");
  if (!req.avatarId && !req.customAvatarBuffer) {
    throw new Error("avatarId o customAvatarBuffer requerido");
  }

  const aspect = req.aspect || "9:16";
  const imageModel: ImageGenModel = req.imageModel || "nano-banana";
  const videoModel: VideoModel = req.videoModel || "kling-master";
  const preset = req.avatarId ? findAvatar(req.avatarId) : null;
  if (req.avatarId && !preset) throw new Error(`avatarId desconocido: ${req.avatarId}`);

  logger.info(
    { projectId: req.projectId, avatarId: req.avatarId, custom: !!req.customAvatarBuffer, scriptChars: req.script.length, videoModel, aspect },
    "🎤 TalkingAvatar: starting",
  );

  // 1. Avatar image (custom takes precedence)
  let avatarBuffer: Buffer;
  let avatarMime: string;
  if (req.customAvatarBuffer) {
    avatarBuffer = req.customAvatarBuffer;
    avatarMime = req.customAvatarMime || "image/png";
  } else if (preset) {
    const generated = await generateImage(imageModel, preset.visualArchetype, {
      aspectRatio: aspectToImage(aspect),
    });
    avatarBuffer = generated.buffer;
    avatarMime = generated.mimeType;
  } else {
    throw new Error("No avatar source");
  }

  // 2. Animate the avatar talking
  const personaText = preset ? preset.personaPrompt : "natural professional talking-head presenter";
  const videoPrompt = TALK_VIDEO_PROMPT_TEMPLATE(personaText);
  // Pick a duration close to the natural narration length (2.5 words/sec ~ ElevenLabs avg)
  const words = req.script.trim().split(/\s+/).length;
  const estimatedDur = Math.max(4, Math.min(10, Math.round(words / 2.5)));

  const animatedVideo = await generateVideoFromImage(videoModel, avatarBuffer, avatarMime, videoPrompt, {
    duration: estimatedDur,
    aspect,
  });
  logger.info({ animatedBytes: animatedVideo.length, estimatedDur }, "🎤 avatar animated");

  // 3. Voiceover
  const voiceId = req.voiceId || preset?.defaultVoiceId || "21m00Tcm4TlvDq8ikWAM";
  const language = req.language || preset?.defaultLanguage || "en";
  const voiceover = await generateTTS(req.script, {
    voiceId,
    modelId: req.voiceModel || "eleven_multilingual_v2",
    languageCode: language.length === 2 ? language : undefined,
  });
  logger.info({ voiceBytes: voiceover.length }, "🎤 voiceover ready");

  // 4. Mux + optional lip-sync
  let muxed = await composeAd({
    videoBuffer: animatedVideo,
    voiceBuffer: voiceover,
    voiceVolume: 1.0,
  });

  if (req.applyLipSync !== false) {
    try {
      muxed = await lipSyncVideoToAudio(muxed, voiceover);
      logger.info({ syncedBytes: muxed.length }, "🎤 lip-sync applied");
    } catch (err) {
      logger.warn({ err }, "🎤 lip-sync failed, returning muxed video without sync");
    }
  }

  return {
    finalVideo: muxed,
    finalMime: "video/mp4",
    avatarImage: avatarBuffer,
    avatarMime,
    voiceover,
    voiceoverMime: "audio/mpeg",
    durationSec: estimatedDur,
    avatar: preset,
  };
}

// ═════════════════════════════════════════════════════════════════════════
// PRODUCT AVATAR (Pollo "Product Avatar" — presenter holding/showing product)
// ═════════════════════════════════════════════════════════════════════════

export interface ProductAvatarRequest {
  projectId: number;
  productImage: Buffer;
  productMime: string;
  /** Either a preset OR a custom presenter image */
  avatarId?: string;
  customPresenterBuffer?: Buffer;
  customPresenterMime?: string;
  script: string;
  voiceId?: string;
  voiceModel?: "eleven_multilingual_v2" | "eleven_turbo_v2_5" | "eleven_flash_v2_5";
  language?: string;
  aspect?: "9:16" | "16:9" | "1:1";
  /** Image model used to render presenter holding product (default nano-banana) */
  imageModel?: ImageGenModel;
  videoModel?: VideoModel;
  applyLipSync?: boolean;
}

export interface ProductAvatarResult {
  finalVideo: Buffer;
  finalMime: string;
  fusedImage: Buffer;
  fusedMime: string;
  voiceover: Buffer;
  durationSec: number;
}

/**
 * Pollo "Product Avatar": fuse a presenter (preset or custom) holding/showing
 * the product → animate them speaking → voiceover.
 *
 * Uses an image-edit model (default nano-banana) to insert the product into
 * the presenter's hands while keeping both consistent. Then animates with the
 * same talking-head pipeline.
 */
export async function generateProductAvatar(req: ProductAvatarRequest): Promise<ProductAvatarResult> {
  if (!req.script.trim()) throw new Error("script requerido");
  if (!req.avatarId && !req.customPresenterBuffer) throw new Error("avatarId o customPresenterBuffer requerido");

  const aspect = req.aspect || "9:16";
  const imageModel: ImageGenModel = req.imageModel || "nano-banana";
  const videoModel: VideoModel = req.videoModel || "kling-master";
  const preset = req.avatarId ? findAvatar(req.avatarId) : null;
  if (req.avatarId && !preset) throw new Error(`avatarId desconocido: ${req.avatarId}`);

  logger.info(
    { projectId: req.projectId, avatarId: req.avatarId, custom: !!req.customPresenterBuffer, aspect, videoModel },
    "🛍️ ProductAvatar: starting",
  );

  // 1. Build a presenter description (preset archetype OR custom photo as ref)
  const presenterDescription = preset
    ? preset.visualArchetype
    : "professional adult presenter with friendly approachable look";

  // 2. Generate the fused presenter+product image with nano-banana / Gemini.
  // We pass the PRODUCT image as the visual reference and describe both the
  // presenter and how they should be holding the product. This produces a
  // single fused image where the product is recognizable and integrated.
  const fusionPrompt = `${presenterDescription}. The person is naturally holding the product shown in the reference image up next to their face or in front of them, presenting it to the camera. Keep the product 100% recognizable, sharp, and well-lit (use the reference image as the exact product look). Photorealistic professional shot, broadcast lighting, ${aspect} aspect ratio, ready for a social-media product ad. The person looks straight at the camera with a confident friendly expression.`;

  // If the user supplied a CUSTOM presenter photo, prefer using it as the
  // reference (so the avatar looks like THEIR person). Otherwise reference
  // the product itself so the model nails the product shape.
  const refBuffer = req.customPresenterBuffer || req.productImage;
  const refMime = req.customPresenterBuffer ? (req.customPresenterMime || "image/png") : req.productMime;

  const fused = await generateImage(imageModel, fusionPrompt, {
    aspectRatio: aspectToImage(aspect),
    referenceImage: refBuffer,
    referenceMime: refMime,
  });
  logger.info({ fusedBytes: fused.buffer.length }, "🛍️ presenter+product fused");

  // 3. Animate speaking
  const videoPrompt = `${preset?.personaPrompt || "professional product presenter"}, holding the product, talking enthusiastically to camera about it, natural hand gestures, expressive face, slight head movement. Locked-off broadcast camera, sharp focus on face and product.`;
  const words = req.script.trim().split(/\s+/).length;
  const estimatedDur = Math.max(4, Math.min(10, Math.round(words / 2.5)));
  const animated = await generateVideoFromImage(videoModel, fused.buffer, fused.mimeType, videoPrompt, {
    duration: estimatedDur,
    aspect,
  });

  // 4. Voiceover + mux + lip-sync
  const voiceId = req.voiceId || preset?.defaultVoiceId || "21m00Tcm4TlvDq8ikWAM";
  const language = req.language || preset?.defaultLanguage || "en";
  const voiceover = await generateTTS(req.script, {
    voiceId,
    modelId: req.voiceModel || "eleven_multilingual_v2",
    languageCode: language.length === 2 ? language : undefined,
  });

  let muxed = await composeAd({
    videoBuffer: animated,
    voiceBuffer: voiceover,
    voiceVolume: 1.0,
  });
  if (req.applyLipSync !== false) {
    try {
      muxed = await lipSyncVideoToAudio(muxed, voiceover);
    } catch (err) {
      logger.warn({ err }, "🛍️ product avatar lip-sync failed");
    }
  }

  return {
    finalVideo: muxed,
    finalMime: "video/mp4",
    fusedImage: fused.buffer,
    fusedMime: fused.mimeType,
    voiceover,
    durationSec: estimatedDur,
  };
}

// ═════════════════════════════════════════════════════════════════════════
// MIMIC MOTION (thin wrapper over transferMotionToImage)
// ═════════════════════════════════════════════════════════════════════════

export interface MimicMotionRequest {
  projectId: number;
  /** Source video URL whose motion will be mimicked (https only) */
  sourceVideoUrl: string;
  /** Target still image to animate */
  targetImage: Buffer;
  targetMime: string;
}

export interface MimicMotionResult {
  finalVideo: Buffer;
  finalMime: string;
}

export async function generateMimicMotion(req: MimicMotionRequest): Promise<MimicMotionResult> {
  if (!/^https:\/\//i.test(req.sourceVideoUrl)) {
    throw new Error("sourceVideoUrl debe ser HTTPS");
  }
  logger.info({ projectId: req.projectId, src: req.sourceVideoUrl.slice(0, 80) }, "🪄 MimicMotion: starting");

  // Pre-fetch the source video so transferMotionToImage receives a buffer and
  // we keep SSRF protection consistent with the rest of the pipeline.
  const srcBuffer = await fetchToBuffer(req.sourceVideoUrl);

  // transferMotionToImage signature: (imageBuffer, drivingVideoBuffer, { imageMime, videoMime })
  const out = await transferMotionToImage(req.targetImage, srcBuffer, {
    imageMime: req.targetMime,
    videoMime: "video/mp4",
  });
  return { finalVideo: out, finalMime: "video/mp4" };
}
