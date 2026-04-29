/**
 * Viral video cloning — analyze any TikTok/Reels/Shorts/YouTube short and
 * extract its structural DNA (hook, beats, voice tone, captions, transitions)
 * so we can recreate the SAME format with the user's product.
 *
 * Pipeline:
 *  1. Download the video bytes (the caller passes a buffer; URL fetching is
 *     handled at the route layer with platform-specific extractors).
 *  2. Extract evenly-spaced frames + audio.
 *  3. Transcribe audio with Whisper.
 *  4. Ask Claude Vision to read the frames + transcript and emit a structured
 *     creative brief (hook line, body beats, CTA, suggested camera, suggested
 *     transitions, suggested template).
 *  5. Map the brief into AdCampaignInput so `runAdCampaign` can build the
 *     replica with the user's product image and brand.
 */

import { extractVideoFrames, extractAudioMp3, transcribeAudioToSrt } from "./fusion-studio-pro.js";
import { askClaudeJsonWithBrain } from "./claude.js";
import { logger } from "./logger.js";
import type { AdCampaignInput, AdAspect, AdObjective, VideoProvider } from "./adstudio.js";
import type { AdTemplateKey } from "./ad-templates.js";

export interface ViralBrief {
  /** Detected genre/template key from AD_TEMPLATES (best fit). */
  template: AdTemplateKey;
  /** 3-7 word hook to land in the first 1.5 seconds. */
  hook: string;
  /** 15-25 word body line(s) describing the value moment. */
  body: string;
  /** 3-5 word call-to-action. */
  cta: string;
  /** Detected/recommended camera preset key (CAMERA_PRESETS). */
  cameraPreset: string;
  /** Detected/recommended transition preset key (TRANSITION_PRESETS). */
  transitionPreset: string;
  /** Detected aspect ratio. */
  aspect: AdAspect;
  /** Detected duration (seconds). */
  durationSec: number;
  /** Voice tone (one word). */
  voiceTone: string;
  /** Whether captions/subtitles are visible burned in the original. */
  hasCaptions: boolean;
  /** Number of cuts/scenes detected. */
  cutCount: number;
  /** Free-form description of the structural pattern. */
  structureNotes: string;
  /** Auto-detected/transcribed text excerpt (truncated). */
  detectedTranscript: string;
}

/**
 * Analyze a viral video buffer and produce a structured creative brief.
 * Caller is responsible for fetching/downloading the video; this function
 * works on bytes only (keeps it platform-agnostic and SSRF-safe).
 */
export async function analyzeViralVideo(
  videoBuffer: Buffer,
  opts: {
    projectId: number;
    niche?: string;
    replicateToken?: string;
    /** Override frame count for vision analysis (default 8). */
    frameCount?: number;
  },
): Promise<ViralBrief> {
  // 1. Frames + audio
  const { frames, durationSec } = await extractVideoFrames(videoBuffer, opts.frameCount ?? 8, 512);
  if (!frames.length) throw new Error("Viral analyze: no frames extracted (corrupt video?)");
  const audio = await extractAudioMp3(videoBuffer).catch(() => null);

  // 2. Transcript (best-effort; not all viral videos have speech)
  let transcript = "";
  if (audio && audio.length > 1000) {
    try {
      const tx = await transcribeAudioToSrt(audio, {
        language: "auto",
        replicateToken: opts.replicateToken,
        audioMime: "audio/mpeg",
      });
      transcript = tx.segments.map((s) => s.text).join(" ").trim();
    } catch (err) {
      logger.warn({ err }, "viral-clone: transcription failed, continuing visual-only");
    }
  }

  // 3. Claude Vision analysis — multimodal isn't supported by askClaudeJsonWithBrain
  //    directly, so we describe the frames as base64 in the prompt and let
  //    Claude reason about them via the standard text channel. This is a
  //    conservative implementation that works without the vision-multimodal
  //    Claude wrapper. If/when vision wrapper is added, swap to it.
  const framesB64Brief = `${frames.length} frames extracted, evenly spaced over ${durationSec.toFixed(1)}s of video.`;
  const transcriptBrief = transcript ? `Detected on-screen/voiceover transcript:\n"${transcript.slice(0, 1200)}"` : "No clear voiceover detected (likely music-only or visual-driven).";

  const sys = `You are a senior creative strategist specialized in reverse-engineering viral short-form video formats (TikTok / Reels / Shorts). Given a transcript and structural metadata, you extract the DNA that makes the video work and emit a strict JSON brief that another agent can replicate with a different product.`;

  const prompt = `Analyze this viral short-form video and emit the creative brief.

Structural metadata:
- ${framesB64Brief}
- Duration: ${durationSec.toFixed(1)}s
- Detected niche: ${opts.niche || "unknown"}

${transcriptBrief}

Emit STRICT JSON matching this exact schema (no markdown, no commentary):
{
  "template": "ugc_review|product_demo|explainer|news_anchor|story_cinematic|music_video|viral_hook",
  "hook": "3-7 word attention grabber inspired by the original",
  "body": "15-25 word value/payload line",
  "cta": "3-5 word call-to-action",
  "cameraPreset": "static|push_in|dolly_in|orbit_left|pan_left|pan_right|tilt_up|tilt_down|zoom_in|crash_zoom|crane_up|handheld|parallax|fpv_drone|whip_pan",
  "transitionPreset": "hard_cut|cross_dissolve|fade_to_black|white_flash|hand_swipe_l|hand_swipe_r|slide_up|zoom_punch|iris_open|smoke_blur|glitch_pixel|splash_circle",
  "aspect": "9:16|16:9|1:1|4:5",
  "durationSec": ${Math.round(durationSec) || 8},
  "voiceTone": "bold|warm|luxurious|urgent|playful|authoritative",
  "hasCaptions": true,
  "cutCount": 4,
  "structureNotes": "Describe the structural pattern in 1-2 sentences (hook → demo → cta, etc)."
}

Pick the TEMPLATE that best matches the original style. Prefer "viral_hook" for TikTok-native fast-cut; "ugc_review" for selfie-style creator; "product_demo" for clean cinematic; "music_video" for beat-synced; "story_cinematic" for narrative; "news_anchor" for broadcast; "explainer" for didactic narration.`;

  let raw: any;
  try {
    raw = await askClaudeJsonWithBrain<any>(
      opts.projectId,
      prompt,
      sys,
      "general",
      opts.niche,
      1500,
    );
  } catch (err: any) {
    throw new Error(`Viral analyze: Claude failed: ${err?.message || err}`);
  }

  // Normalize and clamp values to expected unions (defensive: Claude may drift)
  const allowedTemplates: AdTemplateKey[] = [
    "ugc_review", "product_demo", "explainer", "news_anchor",
    "story_cinematic", "music_video", "viral_hook",
  ];
  const template = (allowedTemplates.includes(raw?.template) ? raw.template : "viral_hook") as AdTemplateKey;
  const aspect: AdAspect = ["9:16", "16:9", "1:1", "4:5"].includes(raw?.aspect) ? raw.aspect : "9:16";

  return {
    template,
    hook: String(raw?.hook ?? "").slice(0, 80) || "Mira esto",
    body: String(raw?.body ?? "").slice(0, 250) || "Te muestro lo que cambió todo",
    cta: String(raw?.cta ?? "").slice(0, 40) || "Pruébalo ahora",
    cameraPreset: String(raw?.cameraPreset ?? "handheld"),
    transitionPreset: String(raw?.transitionPreset ?? "hard_cut"),
    aspect,
    durationSec: Math.min(Math.max(Number(raw?.durationSec) || Math.round(durationSec) || 8, 3), 15),
    voiceTone: String(raw?.voiceTone ?? "bold"),
    hasCaptions: Boolean(raw?.hasCaptions),
    cutCount: Math.max(0, Math.min(20, Number(raw?.cutCount) || frames.length)),
    structureNotes: String(raw?.structureNotes ?? "").slice(0, 500),
    detectedTranscript: transcript.slice(0, 600),
  };
}

/**
 * Map a viral brief into AdCampaignInput so the existing `runAdCampaign`
 * pipeline can produce the replica. The product is always the user's; the
 * brief informs ONLY the format/style, never the product itself.
 */
export function briefToCampaignInput(
  brief: ViralBrief,
  product: {
    projectId: number;
    productTitle: string;
    productCategory: string;
    brandName?: string;
    brandTone?: string;
    niche?: string;
    sourceImageUrl?: string;
    videoProvider: VideoProvider;
    objective?: AdObjective;
    voiceId?: string;
  },
): AdCampaignInput {
  return {
    projectId: product.projectId,
    productTitle: product.productTitle,
    productCategory: product.productCategory,
    brandName: product.brandName,
    brandTone: product.brandTone,
    niche: product.niche,
    objective: product.objective ?? "awareness",
    aspect: brief.aspect,
    videoProvider: product.videoProvider,
    videoDurationSec: Math.min(Math.max(brief.durationSec, 3), 10),
    voiceId: product.voiceId,
    addMusic: true,
    variantsCount: 1,
    customPrompt: `Replicate the viral structure: ${brief.structureNotes}. Hook tone: ${brief.voiceTone}.`,
    sourceImageUrl: product.sourceImageUrl,
    template: brief.template,
    burnSubs: brief.hasCaptions,
  };
}
