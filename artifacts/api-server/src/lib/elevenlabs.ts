import { logger } from "./logger.js";

const ELEVEN_BASE = "https://api.elevenlabs.io/v1";
const REQUEST_TIMEOUT_MS = 60_000;
const MAX_TEXT_LENGTH = 5000;

export type ElevenModel =
  | "eleven_multilingual_v2"
  | "eleven_turbo_v2_5"
  | "eleven_flash_v2_5";

export type ElevenOutputFormat =
  | "mp3_44100_128"
  | "mp3_44100_64"
  | "mp3_22050_32"
  | "pcm_16000"
  | "pcm_22050"
  | "pcm_24000";

export interface VoiceSettings {
  stability?: number;
  similarity_boost?: number;
  style?: number;
  use_speaker_boost?: boolean;
}

export interface SynthesizeRequest {
  text: string;
  voiceId?: string;
  modelId?: ElevenModel;
  outputFormat?: ElevenOutputFormat;
  voiceSettings?: VoiceSettings;
  languageCode?: string;
}

export interface SynthesizeResult {
  audio: Buffer;
  contentType: string;
  voiceId: string;
  modelId: ElevenModel;
  characters: number;
}

// Voz por defecto. Se sobreescribe con `ELEVENLABS_DEFAULT_VOICE_ID` si está
// definido en el entorno. Si no, usamos "Charlie" (IKne3meq5aSn9XLyUdCD), una
// voz multilingüe pública de ElevenLabs que suena natural en español
// castellano (mucho mejor que la antigua Rachel "21m00Tcm4TlvDq8ikWAM" inglesa).
// La detección dinámica intenta encontrar una voz con label "spanish"/"es"
// en el workspace del usuario y la cachea como fallback automático.
const FALLBACK_VOICE_ID = "IKne3meq5aSn9XLyUdCD";
const DEFAULT_VOICE_ID = (process.env.ELEVENLABS_DEFAULT_VOICE_ID || "").trim() || FALLBACK_VOICE_ID;

// Caché de la voz "auto" detectada por workspace. Cacheamos:
//  - el resultado (1h) para no consultar en cada TTS,
//  - la PROMESA en curso para que peticiones concurrentes iniciales no
//    disparen N llamadas a /voices a la vez (thundering herd).
// Si la auto-detección tarda > AUTO_VOICE_RESOLVE_TIMEOUT_MS, devolvemos el
// fallback estático y dejamos que la búsqueda termine en background y
// rellene la caché para próximas peticiones — NUNCA bloqueamos al usuario
// más de unos pocos segundos esperando ElevenLabs /voices.
let _autoVoiceCache: { voiceId: string; cachedAt: number } | null = null;
let _autoVoiceInflight: Promise<string> | null = null;
const AUTO_VOICE_TTL_MS = 60 * 60 * 1000;
const AUTO_VOICE_RESOLVE_TIMEOUT_MS = 2_500;

async function detectSpanishVoice(): Promise<string> {
  try {
    const voices = await listVoices();
    const spanishVoice =
      voices.find(v => Object.values(v.labels || {}).some(l => /spanish|español|castellano|\bes\b/i.test(String(l)))) ||
      voices.find(v => /spanish|español|castellano/i.test(v.name)) ||
      voices.find(v => Object.values(v.labels || {}).some(l => /multilingual|multilingüe|multilingue/i.test(String(l))));
    const chosen = spanishVoice?.voice_id ?? DEFAULT_VOICE_ID;
    _autoVoiceCache = { voiceId: chosen, cachedAt: Date.now() };
    if (spanishVoice?.voice_id) {
      logger.info({ voiceId: spanishVoice.voice_id, name: spanishVoice.name }, "ElevenLabs: voz por defecto auto-detectada");
    }
    return chosen;
  } catch (e) {
    logger.warn({ err: (e as Error).message }, "ElevenLabs: no se pudo auto-detectar voz por defecto, usando fallback");
    _autoVoiceCache = { voiceId: DEFAULT_VOICE_ID, cachedAt: Date.now() };
    return DEFAULT_VOICE_ID;
  } finally {
    _autoVoiceInflight = null;
  }
}

async function resolveDefaultVoiceId(): Promise<string> {
  // 1. Override explícito por env → siempre gana, sin red.
  if (process.env.ELEVENLABS_DEFAULT_VOICE_ID && process.env.ELEVENLABS_DEFAULT_VOICE_ID.trim()) {
    return process.env.ELEVENLABS_DEFAULT_VOICE_ID.trim();
  }
  // 2. Caché vigente.
  if (_autoVoiceCache && Date.now() - _autoVoiceCache.cachedAt < AUTO_VOICE_TTL_MS) {
    return _autoVoiceCache.voiceId;
  }
  // 3. Reutilizar promesa si ya hay una búsqueda en vuelo (evita thundering herd).
  const inflight = _autoVoiceInflight ?? (_autoVoiceInflight = detectSpanishVoice());
  // 4. No esperar más de AUTO_VOICE_RESOLVE_TIMEOUT_MS — si tarda, devolvemos
  //    el fallback estático y la búsqueda sigue en background poblando caché.
  return await Promise.race([
    inflight,
    new Promise<string>(resolve => setTimeout(() => resolve(DEFAULT_VOICE_ID), AUTO_VOICE_RESOLVE_TIMEOUT_MS)),
  ]);
}

function getApiKey(): string {
  const key = process.env.ELEVENLABS_API_KEY;
  if (!key || key.trim().length < 10) {
    throw new Error("ELEVENLABS_API_KEY no configurado");
  }
  return key.trim();
}

function clamp01(n: unknown, fallback: number): number {
  const v = typeof n === "number" ? n : Number(n);
  if (!Number.isFinite(v)) return fallback;
  return Math.max(0, Math.min(1, v));
}

function validateVoiceId(id: string): void {
  if (!/^[a-zA-Z0-9_-]{1,64}$/.test(id)) {
    throw new Error("voiceId inválido");
  }
}

function contentTypeForFormat(fmt: ElevenOutputFormat): string {
  if (fmt.startsWith("mp3")) return "audio/mpeg";
  if (fmt.startsWith("pcm")) return "audio/L16";
  return "application/octet-stream";
}

export async function synthesizeSpeech(req: SynthesizeRequest): Promise<SynthesizeResult> {
  const apiKey = getApiKey();
  const text = (req.text ?? "").trim();
  if (!text) throw new Error("text requerido");
  if (text.length > MAX_TEXT_LENGTH) {
    throw new Error(`text excede ${MAX_TEXT_LENGTH} caracteres`);
  }

  const voiceId = ((req.voiceId ?? "").trim() || (await resolveDefaultVoiceId())).trim();
  validateVoiceId(voiceId);
  const modelId: ElevenModel = req.modelId ?? "eleven_multilingual_v2";
  const outputFormat: ElevenOutputFormat = req.outputFormat ?? "mp3_44100_128";

  // Defaults ajustados para sonar natural en español:
  // - stability 0.40 → variación humana sin descontrolarse
  // - similarity_boost 0.85 → cercano al timbre de la voz original
  // - style 0.40 → expresividad real (antes 0.0 = monótono robótico)
  const voice_settings = {
    stability: clamp01(req.voiceSettings?.stability, 0.40),
    similarity_boost: clamp01(req.voiceSettings?.similarity_boost, 0.85),
    style: clamp01(req.voiceSettings?.style, 0.40),
    use_speaker_boost: req.voiceSettings?.use_speaker_boost ?? true,
  };

  const body: Record<string, unknown> = {
    text,
    model_id: modelId,
    voice_settings,
  };
  if (req.languageCode && /^[a-z]{2}(-[A-Z]{2})?$/.test(req.languageCode)) {
    body.language_code = req.languageCode;
  }

  logger.info({ voiceId, modelId, chars: text.length, outputFormat }, "ElevenLabs: TTS request");

  const url = `${ELEVEN_BASE}/text-to-speech/${encodeURIComponent(voiceId)}?output_format=${encodeURIComponent(outputFormat)}`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "xi-api-key": apiKey,
      "Content-Type": "application/json",
      "Accept": contentTypeForFormat(outputFormat),
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => "");
    throw new Error(`ElevenLabs ${res.status}: ${errText.slice(0, 300)}`);
  }

  const arrayBuffer = await res.arrayBuffer();
  const audio = Buffer.from(arrayBuffer);

  logger.info({ voiceId, modelId, audioBytes: audio.length }, "ElevenLabs: audio generado");

  try {
    const { recordApiUsage, calcElevenLabsCost } = await import("./api-usage.js");
    void recordApiUsage({
      provider: "elevenlabs",
      operation: "tts",
      model: modelId,
      inputUnits: text.length,
      unitsLabel: "chars",
      costUsd: calcElevenLabsCost(text.length),
      metadata: { voiceId, audioBytes: audio.length },
    });
  } catch { /* nunca bloquea */ }

  return {
    audio,
    contentType: contentTypeForFormat(outputFormat),
    voiceId,
    modelId,
    characters: text.length,
  };
}

export async function listVoices(): Promise<Array<{ voice_id: string; name: string; labels?: Record<string, string> }>> {
  const apiKey = getApiKey();
  const res = await fetch(`${ELEVEN_BASE}/voices`, {
    headers: { "xi-api-key": apiKey },
    signal: AbortSignal.timeout(15_000),
  });
  if (!res.ok) {
    throw new Error(`ElevenLabs voices ${res.status}`);
  }
  const data = (await res.json()) as { voices?: Array<{ voice_id: string; name: string; labels?: Record<string, string> }> };
  return data.voices ?? [];
}
