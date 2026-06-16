import { VIDEO_MODELS, IMAGE_MODELS, type VideoModel, type ImageGenModel } from "./fusion-studio-pro.js";
import { logger } from "./logger.js";

export type QualityTier = "draft" | "standard" | "premium" | "cinema";
export type ShotPurpose =
  | "intro"
  | "hero"
  | "model"
  | "product"
  | "lifestyle"
  | "transition"
  | "outro"
  | "ambient";

export interface ShotPlan {
  index: number;
  purpose: ShotPurpose;
  description: string;
  durationSec: number;
  recommendedModel: VideoModel;
  estimatedCostUsd: number;
  needsReferenceImage: boolean;
  preserveFaces: boolean;
  notes?: string;
}

export interface CampaignBudget {
  totalDurationSec: number;
  qualityTarget: QualityTier;
  hasReferenceImages: boolean;
  preserveFaces: boolean;
  audioTrack: "music" | "voiceover" | "both" | "none";
  ratio: "16:9" | "9:16" | "1:1";
  needsInfographic?: boolean;
  staticAdsCount?: number;
  budgetMaxUsd?: number;
}

export interface CampaignEstimate {
  shots: ShotPlan[];
  totals: {
    videoUsd: number;
    audioUsd: number;
    imagesUsd: number;
    grandTotalUsd: number;
    grandTotalEur: number;
    durationSec: number;
    shotCount: number;
  };
  modelMix: Record<string, { count: number; seconds: number; usd: number }>;
  warnings: string[];
  rules: string[];
}

const TIER_PRIORITY: Record<QualityTier, VideoModel[]> = {
  draft:    ["wan-2.7", "seedance-1-lite", "seedance-fast"],
  standard: ["seedance-fast", "seedance-pro", "runway-gen4.5", "kling-3.0-turbo"],
  premium:  ["seedance-pro", "kling-3.0-turbo", "runway-gen4.5", "kling-master"],
  cinema:   ["kling-3.0-master", "veo-3.1-fast", "runway-gen4.5", "kling-3.0-turbo"],
};

const PURPOSE_TIER_BIAS: Record<ShotPurpose, Partial<Record<QualityTier, VideoModel>>> = {
  intro:      { cinema: "kling-3.0-master",  premium: "kling-master",      standard: "kling-3.0-turbo",  draft: "wan-2.6" },
  hero:       { cinema: "kling-3.0-master",  premium: "runway-gen4.5",     standard: "runway-gen4.5",    draft: "seedance-fast" },
  model:      { cinema: "seedance-pro",       premium: "seedance-pro",      standard: "seedance-pro",     draft: "seedance-fast" },
  product:    { cinema: "runway-seedance2",    premium: "runway-gen4.5",     standard: "seedance-pro",     draft: "seedance-fast" },
  lifestyle:  { cinema: "seedance-pro",       premium: "seedance-pro",      standard: "kling-3.0-turbo",  draft: "seedance-fast" },
  transition: { cinema: "wan-2.6",            premium: "wan-2.6",           standard: "wan-2.6",          draft: "wan-2.6" },
  outro:      { cinema: "wan-2.6",            premium: "wan-2.6",           standard: "wan-2.6",          draft: "wan-2.6" },
  ambient:    { cinema: "wan-2.6",            premium: "wan-2.6",           standard: "wan-2.6",          draft: "wan-2.6" },
};

export function pickModelForShot(
  purpose: ShotPurpose,
  tier: QualityTier,
  ratio: "16:9" | "9:16" | "1:1",
  preserveFaces: boolean,
): VideoModel {
  if (preserveFaces && (purpose === "model" || purpose === "lifestyle")) {
    return "seedance-pro";
  }
  const bias = PURPOSE_TIER_BIAS[purpose]?.[tier];
  if (bias) {
    if (ratio !== "16:9" && bias === "veo-3-fast") {
      return tier === "cinema" ? "kling-master" : "runway-gen4.5";
    }
    return bias;
  }
  return TIER_PRIORITY[tier][0];
}

export function pickClipDuration(model: VideoModel, requestedSec: number): number {
  const cfg = VIDEO_MODELS[model];
  return Math.min(Math.max(Math.round(requestedSec), 3), cfg.maxDuration);
}

export function computeShotCost(model: VideoModel, durationSec: number): number {
  const cfg = VIDEO_MODELS[model];
  return +(cfg.costPerSec * durationSec).toFixed(4);
}

export interface ShotRequest {
  purpose: ShotPurpose;
  description: string;
  preferredDurationSec?: number;
  preserveFaces?: boolean;
  needsReferenceImage?: boolean;
  forceModel?: VideoModel;
}

export function planCampaign(
  budget: CampaignBudget,
  shots: ShotRequest[],
): CampaignEstimate {
  const warnings: string[] = [];
  const rules: string[] = [
    "Cobro por segundo: clips largos ≡ clips cortos al mismo coste, usar pocos cortes para fluidez.",
    "Preservar caras reales → seedance-pro multi-ref.",
    "Intros/outros/transiciones → wan-2.6 (open-source rápido y barato).",
    "Hero shots de producto → runway-seedance2 (Seedance 2.0 vía Runway, mayo 2026) o runway-gen4.5.",
    "Si hay fotos de modelo+producto, saltar virtual try-on → ahorra ~$0.04-15/img.",
  ];

  const totalRequestedSec = shots.reduce((acc, s) => acc + (s.preferredDurationSec || 5), 0);
  if (Math.abs(totalRequestedSec - budget.totalDurationSec) > 2) {
    warnings.push(`Suma de duraciones (${totalRequestedSec}s) no cuadra con totalDurationSec (${budget.totalDurationSec}s). Ajustando proporcionalmente.`);
  }

  const scale = budget.totalDurationSec / Math.max(totalRequestedSec, 1);
  const shotPlans: ShotPlan[] = shots.map((s, i) => {
    const model = s.forceModel ?? pickModelForShot(s.purpose, budget.qualityTarget, budget.ratio, s.preserveFaces ?? budget.preserveFaces);
    const cfg = VIDEO_MODELS[model];
    const targetDur = (s.preferredDurationSec || 5) * scale;
    const durationSec = pickClipDuration(model, targetDur);
    if (targetDur > cfg.maxDuration) {
      warnings.push(`Shot ${i + 1} (${s.purpose}): duración solicitada ${targetDur.toFixed(1)}s recortada a ${durationSec}s por límite del modelo ${model}.`);
    }
    return {
      index: i + 1,
      purpose: s.purpose,
      description: s.description,
      durationSec,
      recommendedModel: model,
      estimatedCostUsd: computeShotCost(model, durationSec),
      needsReferenceImage: s.needsReferenceImage ?? (s.purpose === "model" || s.purpose === "product"),
      preserveFaces: s.preserveFaces ?? budget.preserveFaces,
    };
  });

  const videoUsd = +shotPlans.reduce((acc, s) => acc + s.estimatedCostUsd, 0).toFixed(4);
  const audioUsd = +({
    music:      0.05,
    voiceover:  0.06,
    both:       0.10,
    none:       0,
  }[budget.audioTrack]).toFixed(4);

  let imagesUsd = 0;
  if (budget.staticAdsCount && budget.staticAdsCount > 0) imagesUsd += budget.staticAdsCount * 0.04;
  if (budget.needsInfographic) imagesUsd += 0.06;
  imagesUsd = +imagesUsd.toFixed(4);

  const totalsRaw = videoUsd + audioUsd + imagesUsd;
  const totalDur = shotPlans.reduce((acc, s) => acc + s.durationSec, 0);

  const modelMix: CampaignEstimate["modelMix"] = {};
  for (const sp of shotPlans) {
    const k = sp.recommendedModel;
    if (!modelMix[k]) modelMix[k] = { count: 0, seconds: 0, usd: 0 };
    modelMix[k].count += 1;
    modelMix[k].seconds += sp.durationSec;
    modelMix[k].usd = +(modelMix[k].usd + sp.estimatedCostUsd).toFixed(4);
  }

  if (budget.budgetMaxUsd && totalsRaw > budget.budgetMaxUsd) {
    warnings.push(`Coste estimado $${totalsRaw.toFixed(2)} excede presupuesto $${budget.budgetMaxUsd.toFixed(2)}. Considera bajar qualityTarget o reducir duración total.`);
  }

  const grandTotalUsd = +totalsRaw.toFixed(4);
  const grandTotalEur = +(grandTotalUsd * 0.93).toFixed(4);

  logger.info({ shotCount: shotPlans.length, videoUsd, audioUsd, imagesUsd, grandTotalUsd, modelMix }, "campaign-planner: plan computed");

  return {
    shots: shotPlans,
    totals: { videoUsd, audioUsd, imagesUsd, grandTotalUsd, grandTotalEur, durationSec: totalDur, shotCount: shotPlans.length },
    modelMix,
    warnings,
    rules,
  };
}

export function estimateImageCost(model: ImageGenModel, count: number): number {
  const cfg = IMAGE_MODELS[model];
  return +(cfg.costPerImage * count).toFixed(4);
}
