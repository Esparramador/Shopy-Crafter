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

const DEFAULT_VOICE_ID = "21m00Tcm4TlvDq8ikWAM";

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

  const voiceId = (req.voiceId ?? DEFAULT_VOICE_ID).trim();
  validateVoiceId(voiceId);
  const modelId: ElevenModel = req.modelId ?? "eleven_multilingual_v2";
  const outputFormat: ElevenOutputFormat = req.outputFormat ?? "mp3_44100_128";

  const voice_settings = {
    stability: clamp01(req.voiceSettings?.stability, 0.45),
    similarity_boost: clamp01(req.voiceSettings?.similarity_boost, 0.75),
    style: clamp01(req.voiceSettings?.style, 0.0),
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
