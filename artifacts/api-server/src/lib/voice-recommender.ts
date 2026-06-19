/**
 * Smart voice recommender — analyses product + niche + language and picks the
 * optimal ElevenLabs voice for the spokesperson of the ad.
 *
 * Strategy:
 *  1. Fetch all available voices from ElevenLabs.
 *  2. Ask Claude to score and pick the best voice given:
 *       - product title, description, niche, audience
 *       - target language (es/en/fr/it/pt/de/ja/zh)
 *       - explicit gender preference (auto | F | M | youth)
 *  3. Always return a deterministic fallback if Claude/ElevenLabs fail.
 *
 * Coherence: when the user later requests a video try-on with the same
 * spokesperson, the same gender is propagated so the model on screen matches
 * the voice. See lib/video-tryon.ts.
 */
import { askClaudeJsonWithBrain } from "./claude.js";
import { listVoices } from "./elevenlabs.js";
import { logger } from "./logger.js";

export type VoiceGenderPref = "auto" | "female" | "male" | "youth_female" | "youth_male" | "youth" | "young" | "neutral";
export type VoiceLanguage = "auto" | "es" | "en" | "fr" | "it" | "pt" | "de" | "ja" | "zh";

export interface VoiceRecommendInput {
  projectId: number;
  productTitle: string;
  productDescription?: string;
  productType?: string;
  niche?: string;
  language: VoiceLanguage;
  genderPref?: VoiceGenderPref;
  /** If true, bias toward more energetic/young voices (Reels/TikTok). */
  shortFormat?: boolean;
}

export interface VoiceRecommendation {
  voiceId: string;
  voiceName: string;
  gender: "female" | "male" | "neutral";
  ageBucket: "youth" | "young_adult" | "adult" | "mature";
  tone: string;
  reason: string;
  /** Suggested ElevenLabs settings tuned for ads. */
  stability: number;
  style: number;
  /** Recommended character gender for try-on video so it matches the voice. */
  characterGender: "female" | "male" | "neutral";
  /** Other top picks to display in the dropdown. */
  alternatives: Array<{ voiceId: string; voiceName: string; gender: string; reason: string }>;
}

// Fallback estable cuando ElevenLabs no responde o está vacía.
// Los IDs son los públicos por defecto de ElevenLabs (no requieren clonación).
const HARDCODED_FALLBACKS: Record<string, VoiceRecommendation> = {
  female_es: {
    voiceId: "EXAVITQu4vr4xnSDxMaL", // Sarah - multilingual female warm
    voiceName: "Sarah",
    gender: "female", ageBucket: "young_adult",
    tone: "warm, clear, multilingual",
    reason: "Voz femenina cálida multilenguaje, fallback por defecto",
    stability: 0.5, style: 0.35,
    characterGender: "female",
    alternatives: [
      { voiceId: "FGY2WhTYpPnrIDTdsKH5", voiceName: "Laura", gender: "female", reason: "Entusiasta y con actitud" },
      { voiceId: "Xb7hH8MSUJpSbSDYk0k2", voiceName: "Alice", gender: "female", reason: "Educadora clara y atractiva" },
      { voiceId: "cgSgspJ2msm6clMCkdW9", voiceName: "Jessica", gender: "female", reason: "Alegre y brillante" },
      { voiceId: "hpp4J3VqNfWAUOO0d1Us", voiceName: "Bella", gender: "female", reason: "Profesional y cálida" },
      { voiceId: "pFZP5JQG7iQjIQuC4Bku", voiceName: "Lily", gender: "female", reason: "Voz aterciopelada" }
    ],
  },
  male_es: {
    voiceId: "851ejYcv2BoNPjrkw93G", // Tony - Expressive Spanish
    voiceName: "Tony",
    gender: "male", ageBucket: "adult",
    tone: "expressive, fast, spontaneous",
    reason: "Voz masculina expresiva en español peninsular",
    stability: 0.5, style: 0.4,
    characterGender: "male",
    alternatives: [
      { voiceId: "CdAqYBLnsNjmTqYgD5Ha", voiceName: "Dani", gender: "male", reason: "Natural y expresivo" },
      { voiceId: "IKne3meq5aSn9XLyUdCD", voiceName: "Charlie", gender: "male", reason: "Profundo y energético" },
      { voiceId: "TxGEqnHWrfWFTfGW9XjX", voiceName: "Josh", gender: "male", reason: "Clásico y versátil" },
      { voiceId: "TX3LPaxmHKxFdv7VOQHJ", voiceName: "Liam", gender: "male", reason: "Creador de contenido joven" },
      { voiceId: "cjVigY5qzO86Huf0OWal", voiceName: "Eric", gender: "male", reason: "Suave y confiable" },
      { voiceId: "nPczCjzI2devNBz1zQrb", voiceName: "Brian", gender: "male", reason: "Profundo y reconfortante" },
      { voiceId: "onwK4e9ZLuTAKqWW03F9", voiceName: "Daniel", gender: "male", reason: "Locutor estable" },
      { voiceId: "pqHfZKP75CvOlQylNhV4", voiceName: "Bill", gender: "male", reason: "Sabio y maduro" }
    ],
  },
};

function pickHardFallback(genderPref?: VoiceGenderPref): VoiceRecommendation {
  if (genderPref === "male" || genderPref === "youth_male") return HARDCODED_FALLBACKS.male_es;
  return HARDCODED_FALLBACKS.female_es;
}

/**
 * Map ElevenLabs voice labels to our normalized fields.
 * ElevenLabs labels typically include: gender, age, accent, description, use_case.
 */
function normalizeVoice(v: { voice_id: string; name: string; labels?: Record<string, string> }) {
  const lbl = v.labels || {};
  const gender = (lbl.gender || lbl.Gender || "").toLowerCase();
  const age = (lbl.age || lbl.Age || "").toLowerCase();
  return {
    voice_id: v.voice_id,
    name: v.name,
    gender: gender.includes("female") ? "female" : gender.includes("male") ? "male" : "neutral",
    age: age.includes("young") ? "youth" : age.includes("middle") ? "adult" : age.includes("old") ? "mature" : "young_adult",
    accent: (lbl.accent || lbl.Accent || "").toLowerCase(),
    description: lbl.description || lbl.Description || "",
    use_case: lbl.use_case || lbl["use case"] || "",
  };
}

export async function recommendVoiceForProduct(input: VoiceRecommendInput): Promise<VoiceRecommendation> {
  // Normalize aliases: "young"/"youth" → "youth_female" by default (overridden by AI later if needed)
  let genderPref: VoiceGenderPref = input.genderPref || "auto";
  if (genderPref === "young" || genderPref === "youth") genderPref = "youth_female";

  // 1) Fetch voices from ElevenLabs
  let allVoices: ReturnType<typeof normalizeVoice>[] = [];
  try {
    const raw = await listVoices();
    allVoices = raw.map(normalizeVoice);
  } catch (e) {
    logger.warn({ err: (e as Error)?.message }, "voice-recommender: listVoices failed, using hard fallback");
    return pickHardFallback(genderPref);
  }
  if (allVoices.length === 0) {
    logger.warn("voice-recommender: 0 voices returned, using hard fallback");
    return pickHardFallback(genderPref);
  }

  // 2) Pre-filter by gender preference (if explicit)
  let candidates = allVoices;
  if (genderPref === "female" || genderPref === "youth_female") {
    candidates = allVoices.filter(v => v.gender === "female");
  } else if (genderPref === "male" || genderPref === "youth_male") {
    candidates = allVoices.filter(v => v.gender === "male");
  } else if (genderPref === "neutral") {
    candidates = allVoices.filter(v => v.gender === "neutral");
  }
  if (genderPref === "youth_female" || genderPref === "youth_male") {
    const youth = candidates.filter(v => v.age === "youth");
    if (youth.length > 0) candidates = youth;
  }
  if (candidates.length === 0) candidates = allVoices; // never starve

  // Cap to top 30 to keep prompt small
  const slim = candidates.slice(0, 30).map(v => ({
    id: v.voice_id, name: v.name, gender: v.gender, age: v.age,
    accent: v.accent, desc: v.description.slice(0, 80), use_case: v.use_case.slice(0, 40),
  }));

  // 3) Ask Claude to pick + justify
  const lang = input.language === "auto" ? "es" : input.language;
  const prompt = `Eres un director de casting publicitario experto. Elige la voz IDEAL para el anuncio de este producto:

PRODUCTO: ${input.productTitle}
DESCRIPCIÓN: ${(input.productDescription || "").slice(0, 400)}
TIPO: ${input.productType || "general"}
NICHO: ${input.niche || "general"}
IDIOMA: ${lang}
PREFERENCIA GÉNERO USUARIO: ${genderPref}
FORMATO: ${input.shortFormat ? "corto (Reels/TikTok 15-30s, energético)" : "estándar (45-60s, persuasivo)"}

CANDIDATOS DISPONIBLES (ya pre-filtrados por género si el usuario lo pidió):
${JSON.stringify(slim)}

TAREA: Elige la voz más coherente con el producto/nicho/audiencia/idioma. Considera:
- Cosmética/belleza/moda femenina → voz femenina cálida adulta o juvenil
- Tech/herramientas/automoción → voz masculina firme adulta
- Infantil/juguetes → voz juvenil enérgica
- Lujo/joyería → voz adulta sofisticada
- Fitness → voz enérgica joven

Responde SOLO con JSON válido:
{
  "voiceId": "<id elegido>",
  "voiceName": "<name>",
  "gender": "female|male|neutral",
  "ageBucket": "youth|young_adult|adult|mature",
  "tone": "<2-4 adjetivos: ej. cálida, juvenil, enérgica>",
  "reason": "<1-2 frases por qué encaja con el producto>",
  "stability": <0.3-0.7 — más bajo = más expresivo, alto = más estable>,
  "style": <0.0-0.6 — más alto = más exageración estilística>,
  "alternatives": [
    {"voiceId":"<id2>","voiceName":"<n2>","gender":"...","reason":"<1 frase>"},
    {"voiceId":"<id3>","voiceName":"<n3>","gender":"...","reason":"<1 frase>"}
  ]
}`;

  try {
    const systemPrompt = "Eres un director de casting publicitario experto en producción de anuncios. Devuelves SOLO JSON válido sin markdown, sin texto adicional.";
    const result = await askClaudeJsonWithBrain<{
      voiceId: string; voiceName: string;
      gender: "female" | "male" | "neutral";
      ageBucket: "youth" | "young_adult" | "adult" | "mature";
      tone: string; reason: string;
      stability: number; style: number;
      alternatives?: Array<{ voiceId: string; voiceName: string; gender: string; reason: string }>;
    }>(
      input.projectId,
      prompt,
      systemPrompt,
      "general",
      input.niche,
      2000,
      60_000,
    );

    // Validate Claude's pick exists in candidate list
    const pickedExists = slim.some(v => v.id === result.voiceId);
    if (!pickedExists) {
      logger.warn({ pickedId: result.voiceId }, "voice-recommender: Claude returned voice not in candidates, falling back to first candidate");
      const fallbackPick = slim[0];
      return {
        voiceId: fallbackPick.id, voiceName: fallbackPick.name,
        gender: (fallbackPick.gender as "female" | "male" | "neutral"),
        ageBucket: (fallbackPick.age as "youth" | "young_adult" | "adult" | "mature"),
        tone: "estable, neutro",
        reason: "Claude eligió un ID inexistente, se usó el primer candidato como respaldo",
        stability: 0.5, style: 0.35,
        characterGender: (fallbackPick.gender as "female" | "male" | "neutral"),
        alternatives: [],
      };
    }

    return {
      voiceId: result.voiceId,
      voiceName: result.voiceName,
      gender: result.gender,
      ageBucket: result.ageBucket,
      tone: result.tone,
      reason: result.reason,
      stability: Math.max(0.3, Math.min(0.7, Number(result.stability) || 0.5)),
      style: Math.max(0, Math.min(0.6, Number(result.style) || 0.35)),
      characterGender: result.gender,
      alternatives: (result.alternatives || []).slice(0, 4),
    };
  } catch (e) {
    logger.error({ err: (e as Error)?.message }, "voice-recommender: Claude failed, returning hard fallback");
    return pickHardFallback(genderPref);
  }
}
