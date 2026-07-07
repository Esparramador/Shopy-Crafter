import { logger } from "./logger.js";

const ELEVEN_BASE = "https://api.elevenlabs.io/v1";
const REQUEST_TIMEOUT_MS = 60_000;
const MAX_TEXT_LENGTH = 5000;

export type ElevenModel =
  | "eleven_v3"              // Jun-2026: latest, 74 idiomas, máxima calidad
  | "eleven_multilingual_v2" // 29 idiomas, calidad alta
  | "eleven_turbo_v2_5"      // 32 idiomas, baja latencia
  | "eleven_flash_v2_5"      // 32 idiomas, ultra-rápido, barato
  | "eleven_turbo_v2"        // Legacy turbo
  | "eleven_flash_v2";       // Fast v2

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

/**
 * List all available voices in the account.
 */
export async function listAllVoices(apiKey?: string): Promise<any[]> {
  const key = apiKey || getApiKey();
  const res = await fetch(`${ELEVEN_BASE}/voices`, {
    headers: { "xi-api-key": key },
  });
  if (!res.ok) throw new Error(`ElevenLabs list voices failed: ${res.status}`);
  const data = await res.json() as any;
  return (data.voices || []).map((v: any) => ({
    voice_id: v.voice_id,
    name: v.name,
    category: v.category,
    labels: v.labels,
    preview_url: v.preview_url,
    settings: v.settings,
  }));
}

/**
 * List available models, optionally filtered by capability.
 */
export async function getModels(apiKey?: string): Promise<any[]> {
  const key = apiKey || getApiKey();
  const res = await fetch(`${ELEVEN_BASE}/models`, {
    headers: { "xi-api-key": key },
  });
  if (!res.ok) throw new Error(`ElevenLabs list models failed: ${res.status}`);
  return await res.json() as any[];
}

/**
 * Get models specifically capable of sound effects or other non-TTS tasks.
 */
export async function getSoundEffectsModels(apiKey?: string): Promise<any[]> {
  const models = await getModels(apiKey);
  return models.filter((m: any) => m.can_do_text_to_speech === false || m.model_id.includes("sfx"));
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

async function synthesizeSingleChunk(
  apiKey: string,
  text: string,
  voiceId: string,
  modelId: ElevenModel,
  outputFormat: ElevenOutputFormat,
  voice_settings: Record<string, unknown>,
  languageCode?: string,
): Promise<Buffer> {
  const body: Record<string, unknown> = {
    text,
    model_id: modelId,
    voice_settings,
  };
  if (languageCode && /^[a-z]{2}(-[A-Z]{2})?$/.test(languageCode)) {
    body.language_code = languageCode;
  }

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

  const ct = res.headers.get("content-type") ?? "";
  if (!ct.startsWith("audio/") && !ct.startsWith("application/octet-stream")) {
    const bodyPreview = await res.text().catch(() => "");
    throw new Error(`ElevenLabs devolvió Content-Type inesperado "${ct}": ${bodyPreview.slice(0, 200)}`);
  }

  return Buffer.from(await res.arrayBuffer());
}

function splitTextIntoChunks(text: string, maxLen: number): string[] {
  if (text.length <= maxLen) return [text];
  const chunks: string[] = [];
  let remaining = text;
  while (remaining.length > 0) {
    if (remaining.length <= maxLen) {
      chunks.push(remaining);
      break;
    }
    let splitAt = remaining.lastIndexOf(". ", maxLen);
    if (splitAt < maxLen * 0.3) splitAt = remaining.lastIndexOf("? ", maxLen);
    if (splitAt < maxLen * 0.3) splitAt = remaining.lastIndexOf("! ", maxLen);
    if (splitAt < maxLen * 0.3) splitAt = remaining.lastIndexOf(", ", maxLen);
    if (splitAt < maxLen * 0.3) splitAt = remaining.lastIndexOf(" ", maxLen);
    if (splitAt < maxLen * 0.3) splitAt = maxLen;
    else splitAt += 1;
    chunks.push(remaining.slice(0, splitAt).trim());
    remaining = remaining.slice(splitAt).trim();
  }
  return chunks.filter(c => c.length > 0);
}

export async function synthesizeSpeech(req: SynthesizeRequest): Promise<SynthesizeResult> {
  const apiKey = getApiKey();
  const text = (req.text ?? "").trim();
  if (!text) throw new Error("text requerido");
  if (text.length > MAX_TEXT_LENGTH * 10) {
    throw new Error(`text excede ${MAX_TEXT_LENGTH * 10} caracteres (límite máximo con auto-chunking)`);
  }

  const voiceId = ((req.voiceId ?? "").trim() || (await resolveDefaultVoiceId())).trim();
  validateVoiceId(voiceId);
  const modelId: ElevenModel = req.modelId ?? "eleven_v3";
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

  const chunks = splitTextIntoChunks(text, MAX_TEXT_LENGTH);
  logger.info({ voiceId, modelId, chars: text.length, chunks: chunks.length, outputFormat }, "ElevenLabs: TTS request");

  const audioBuffers: Buffer[] = [];
  for (const chunk of chunks) {
    const buf = await synthesizeSingleChunk(apiKey, chunk, voiceId, modelId, outputFormat, voice_settings, req.languageCode);
    audioBuffers.push(buf);
  }

  const audio = audioBuffers.length === 1 ? audioBuffers[0] : Buffer.concat(audioBuffers);

  logger.info({ voiceId, modelId, audioBytes: audio.length, chunks: chunks.length }, "ElevenLabs: audio generado");

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

// ─── VOICE CLONING ────────────────────────────────────────────────────────────

export interface ClonedVoice {
  voice_id: string;
  name: string;
  category: string;
  description?: string;
  preview_url?: string;
}

/**
 * Instant Voice Cloning via ElevenLabs /v1/voices/add.
 * Accepts 1-25 audio files (min 1s each, max 25MB total).
 * Returns the new voice_id.
 */
export async function cloneVoice(
  name: string,
  audioFiles: Array<{ buffer: Buffer; filename: string; mimeType?: string }>,
  description?: string,
): Promise<string> {
  const apiKey = getApiKey();
  if (!name || name.trim().length < 2) throw new Error("name requerido (mín. 2 caracteres)");
  if (!audioFiles.length) throw new Error("Al menos un archivo de audio requerido");
  if (audioFiles.length > 25) throw new Error("Máximo 25 archivos de audio");

  const form = new FormData();
  form.append("name", name.trim());
  if (description) form.append("description", description.trim());

  for (const af of audioFiles) {
    const blob = new Blob([af.buffer as unknown as ArrayBuffer], { type: af.mimeType || "audio/mpeg" });
    form.append("files", blob, af.filename);
  }

  const res = await fetch(`${ELEVEN_BASE}/voices/add`, {
    method: "POST",
    headers: { "xi-api-key": apiKey },
    body: form,
    signal: AbortSignal.timeout(60_000),
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => "");
    throw new Error(`ElevenLabs clone voice ${res.status}: ${errText.slice(0, 300)}`);
  }

  const data = (await res.json()) as { voice_id: string };
  logger.info({ voiceId: data.voice_id, name }, "ElevenLabs: voz clonada creada");
  return data.voice_id;
}

/**
 * Delete a cloned voice by voice_id.
 */
export async function deleteClonedVoice(voiceId: string): Promise<void> {
  const apiKey = getApiKey();
  validateVoiceId(voiceId);

  const res = await fetch(`${ELEVEN_BASE}/voices/${encodeURIComponent(voiceId)}`, {
    method: "DELETE",
    headers: { "xi-api-key": apiKey },
    signal: AbortSignal.timeout(15_000),
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => "");
    throw new Error(`ElevenLabs delete voice ${res.status}: ${errText.slice(0, 200)}`);
  }

  logger.info({ voiceId }, "ElevenLabs: voz clonada eliminada");
}

/**
 * List only cloned voices (category === "cloned") from the account.
 */
export async function listClonedVoices(): Promise<ClonedVoice[]> {
  const voices = await listAllVoices();
  return voices
    .filter((v: any) => v.category === "cloned" || v.category === "professional")
    .map((v: any) => ({
      voice_id: v.voice_id,
      name: v.name,
      category: v.category,
      description: v.description ?? "",
      preview_url: v.preview_url ?? "",
    }));
}

// ─── SPEECH-TO-TEXT (Transcripción) ───────────────────────────────────────────

export interface TranscribeResult {
  text: string;
  language_code?: string;
  language_probability?: number;
  words?: Array<{ text: string; start: number; end: number; type: string; speaker_id?: string }>;
}

/**
 * Transcribe an audio/video file to text using ElevenLabs Speech-to-Text API.
 * POST /v1/speech-to-text
 * Supported: mp3, mp4, wav, m4a, ogg, flac, webm (max 1GB, max 4.5h)
 */
export async function transcribeAudio(
  audioBuffer: Buffer,
  filename: string,
  mimeType: string,
  options?: {
    language_code?: string;
    diarize?: boolean;
    timestamps_granularity?: "word" | "character" | "none";
  },
): Promise<TranscribeResult> {
  const apiKey = getApiKey();

  const form = new FormData();
  const blob = new Blob([audioBuffer as unknown as ArrayBuffer], { type: mimeType || "audio/mpeg" });
  form.append("file", blob, filename);
  form.append("model_id", "scribe_v1");
  if (options?.language_code) form.append("language_code", options.language_code);
  if (options?.diarize !== undefined) form.append("diarize", String(options.diarize));
  if (options?.timestamps_granularity) form.append("timestamps_granularity", options.timestamps_granularity);

  const res = await fetch(`${ELEVEN_BASE}/speech-to-text`, {
    method: "POST",
    headers: { "xi-api-key": apiKey },
    body: form,
    signal: AbortSignal.timeout(120_000),
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => "");
    throw new Error(`ElevenLabs STT ${res.status}: ${errText.slice(0, 300)}`);
  }

  const data = await res.json() as any;
  return {
    text: data.text ?? "",
    language_code: data.language_code,
    language_probability: data.language_probability,
    words: data.words,
  };
}

// ─── AUDIO ISOLATION (Separar voz del ruido) ─────────────────────────────────

/**
 * Isolate voice from background noise using ElevenLabs Audio Isolation.
 * POST /v1/audio-isolation
 * Returns: Buffer with the isolated voice audio (mp3)
 */
export async function isolateAudio(
  audioBuffer: Buffer,
  filename: string,
  mimeType: string,
): Promise<Buffer> {
  const apiKey = getApiKey();

  const form = new FormData();
  const blob = new Blob([audioBuffer as unknown as ArrayBuffer], { type: mimeType || "audio/mpeg" });
  form.append("audio", blob, filename);

  const res = await fetch(`${ELEVEN_BASE}/audio-isolation`, {
    method: "POST",
    headers: { "xi-api-key": apiKey },
    body: form,
    signal: AbortSignal.timeout(120_000),
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => "");
    throw new Error(`ElevenLabs Audio Isolation ${res.status}: ${errText.slice(0, 300)}`);
  }

  return Buffer.from(await res.arrayBuffer());
}

// ─── CONVAI — Agentes Conversacionales con Voz ───────────────────────────────

export interface ConvAIAgent {
  agent_id: string;
  name: string;
  created_at_unix_secs?: number;
  conversation_config?: Record<string, unknown>;
}

export interface ConvAIVoiceSettings {
  stability?: number;
  similarity_boost?: number;
  style?: number;
  use_speaker_boost?: boolean;
}

export interface ConvAIAgentConfig {
  name: string;
  conversation_config?: {
    agent?: {
      prompt?: { prompt: string };
      first_message?: string;
      language?: string;
    };
    tts?: {
      voice_id?: string;
      model_id?: string;
      voice_settings?: ConvAIVoiceSettings;
      speed?: number;
      output_format?: string;
    };
  };
  platform_settings?: Record<string, unknown>;
}

/**
 * List all ConvAI agents in the account.
 */
export async function listConvAIAgents(): Promise<ConvAIAgent[]> {
  const apiKey = getApiKey();
  const res = await fetch(`${ELEVEN_BASE}/convai/agents`, {
    headers: { "xi-api-key": apiKey },
    signal: AbortSignal.timeout(30_000),
  });
  if (!res.ok) {
    const errText = await res.text().catch(() => "");
    throw new Error(`ElevenLabs ConvAI list ${res.status}: ${errText.slice(0, 200)}`);
  }
  const data = await res.json() as any;
  return (data.agents ?? []) as ConvAIAgent[];
}

/**
 * Create a new ConvAI agent.
 */
export async function createConvAIAgent(config: ConvAIAgentConfig): Promise<ConvAIAgent> {
  const apiKey = getApiKey();
  const res = await fetch(`${ELEVEN_BASE}/convai/agents/create`, {
    method: "POST",
    headers: { "xi-api-key": apiKey, "Content-Type": "application/json" },
    body: JSON.stringify(config),
    signal: AbortSignal.timeout(30_000),
  });
  if (!res.ok) {
    const errText = await res.text().catch(() => "");
    throw new Error(`ElevenLabs ConvAI create ${res.status}: ${errText.slice(0, 300)}`);
  }
  return await res.json() as ConvAIAgent;
}

/**
 * Get a ConvAI agent by ID.
 */
export async function getConvAIAgent(agentId: string): Promise<ConvAIAgent> {
  const apiKey = getApiKey();
  const res = await fetch(`${ELEVEN_BASE}/convai/agents/${encodeURIComponent(agentId)}`, {
    headers: { "xi-api-key": apiKey },
    signal: AbortSignal.timeout(15_000),
  });
  if (!res.ok) {
    const errText = await res.text().catch(() => "");
    throw new Error(`ElevenLabs ConvAI get ${res.status}: ${errText.slice(0, 200)}`);
  }
  return await res.json() as ConvAIAgent;
}

/**
 * Update (patch) an existing ConvAI agent.
 */
export async function updateConvAIAgent(agentId: string, config: Partial<ConvAIAgentConfig>): Promise<ConvAIAgent> {
  const apiKey = getApiKey();
  const res = await fetch(`${ELEVEN_BASE}/convai/agents/${encodeURIComponent(agentId)}`, {
    method: "PATCH",
    headers: { "xi-api-key": apiKey, "Content-Type": "application/json" },
    body: JSON.stringify(config),
    signal: AbortSignal.timeout(30_000),
  });
  if (!res.ok) {
    const errText = await res.text().catch(() => "");
    throw new Error(`ElevenLabs ConvAI update ${res.status}: ${errText.slice(0, 300)}`);
  }
  return await res.json() as ConvAIAgent;
}

/**
 * Delete a ConvAI agent by ID.
 */
export async function deleteConvAIAgent(agentId: string): Promise<void> {
  const apiKey = getApiKey();
  const res = await fetch(`${ELEVEN_BASE}/convai/agents/${encodeURIComponent(agentId)}`, {
    method: "DELETE",
    headers: { "xi-api-key": apiKey },
    signal: AbortSignal.timeout(15_000),
  });
  if (!res.ok) {
    const errText = await res.text().catch(() => "");
    throw new Error(`ElevenLabs ConvAI delete ${res.status}: ${errText.slice(0, 200)}`);
  }
}

/**
 * Get a signed URL to start a ConvAI conversation (for the web widget).
 */
export async function getConvAISignedUrl(agentId: string): Promise<string> {
  const apiKey = getApiKey();
  const res = await fetch(`${ELEVEN_BASE}/convai/conversation/get_signed_url?agent_id=${encodeURIComponent(agentId)}`, {
    headers: { "xi-api-key": apiKey },
    signal: AbortSignal.timeout(15_000),
  });
  if (!res.ok) {
    const errText = await res.text().catch(() => "");
    throw new Error(`ElevenLabs ConvAI signed URL ${res.status}: ${errText.slice(0, 200)}`);
  }
  const data = await res.json() as any;
  return data.signed_url as string;
}

/**
 * List recent ConvAI conversations.
 */
export async function listConvAIConversations(agentId?: string): Promise<any[]> {
  const apiKey = getApiKey();
  const url = agentId
    ? `${ELEVEN_BASE}/convai/conversations?agent_id=${encodeURIComponent(agentId)}`
    : `${ELEVEN_BASE}/convai/conversations`;
  const res = await fetch(url, {
    headers: { "xi-api-key": apiKey },
    signal: AbortSignal.timeout(15_000),
  });
  if (!res.ok) {
    const errText = await res.text().catch(() => "");
    throw new Error(`ElevenLabs ConvAI conversations ${res.status}: ${errText.slice(0, 200)}`);
  }
  const data = await res.json() as any;
  return data.conversations ?? [];
}

// ─── PRONUNCIATION DICTIONARIES ───────────────────────────────────────────────

export interface PronunciationRule {
  type: "alias" | "phoneme";
  string_to_replace: string;
  alias?: string;
  phoneme?: string;
  alphabet?: "ipa" | "cmu-arpabet";
}

export interface PronunciationDictionary {
  id: string;
  name: string;
  description?: string;
  version_id: string;
  created_at_unix?: number;
  rules?: PronunciationRule[];
}

/**
 * List all pronunciation dictionaries in the account.
 */
export async function listPronunciationDictionaries(): Promise<PronunciationDictionary[]> {
  const apiKey = getApiKey();
  const res = await fetch(`${ELEVEN_BASE}/pronunciation-dictionaries`, {
    headers: { "xi-api-key": apiKey },
    signal: AbortSignal.timeout(15_000),
  });
  if (!res.ok) {
    const errText = await res.text().catch(() => "");
    throw new Error(`ElevenLabs PronDict list ${res.status}: ${errText.slice(0, 200)}`);
  }
  const data = await res.json() as any;
  return (data.pronunciation_dictionaries ?? []) as PronunciationDictionary[];
}

/**
 * Create a new pronunciation dictionary with initial rules.
 */
export async function createPronunciationDictionary(
  name: string,
  rules: PronunciationRule[],
  description?: string,
): Promise<PronunciationDictionary> {
  const apiKey = getApiKey();

  const form = new FormData();
  form.append("name", name);
  if (description) form.append("description", description);

  const pls = buildPlsFromRules(name, rules);
  const blob = new Blob([pls], { type: "application/xml" });
  form.append("file", blob, `${name.replace(/\s+/g, "_")}.pls`);

  const res = await fetch(`${ELEVEN_BASE}/pronunciation-dictionaries/add-from-file`, {
    method: "POST",
    headers: { "xi-api-key": apiKey },
    body: form,
    signal: AbortSignal.timeout(30_000),
  });
  if (!res.ok) {
    const errText = await res.text().catch(() => "");
    throw new Error(`ElevenLabs PronDict create ${res.status}: ${errText.slice(0, 300)}`);
  }
  const data = await res.json() as any;
  return {
    id: data.id,
    name: data.name ?? name,
    description: data.description,
    version_id: data.version_id ?? "",
    created_at_unix: data.created_at_unix,
  };
}

/**
 * Add rules to an existing pronunciation dictionary.
 */
export async function addRulesToPronunciationDictionary(
  dictionaryId: string,
  rules: PronunciationRule[],
): Promise<{ version_id: string }> {
  const apiKey = getApiKey();
  const res = await fetch(`${ELEVEN_BASE}/pronunciation-dictionaries/${encodeURIComponent(dictionaryId)}/add-rules`, {
    method: "POST",
    headers: { "xi-api-key": apiKey, "Content-Type": "application/json" },
    body: JSON.stringify({ rules }),
    signal: AbortSignal.timeout(30_000),
  });
  if (!res.ok) {
    const errText = await res.text().catch(() => "");
    throw new Error(`ElevenLabs PronDict add-rules ${res.status}: ${errText.slice(0, 300)}`);
  }
  const data = await res.json() as any;
  return { version_id: data.version_id ?? "" };
}

/**
 * Remove rules from a pronunciation dictionary.
 */
export async function removeRulesFromPronunciationDictionary(
  dictionaryId: string,
  ruleStrings: string[],
): Promise<{ version_id: string }> {
  const apiKey = getApiKey();
  const res = await fetch(`${ELEVEN_BASE}/pronunciation-dictionaries/${encodeURIComponent(dictionaryId)}/remove-rules`, {
    method: "POST",
    headers: { "xi-api-key": apiKey, "Content-Type": "application/json" },
    body: JSON.stringify({ rule_strings: ruleStrings }),
    signal: AbortSignal.timeout(30_000),
  });
  if (!res.ok) {
    const errText = await res.text().catch(() => "");
    throw new Error(`ElevenLabs PronDict remove-rules ${res.status}: ${errText.slice(0, 300)}`);
  }
  const data = await res.json() as any;
  return { version_id: data.version_id ?? "" };
}

/**
 * Delete a pronunciation dictionary by ID.
 */
export async function deletePronunciationDictionary(dictionaryId: string): Promise<void> {
  const apiKey = getApiKey();
  const res = await fetch(`${ELEVEN_BASE}/pronunciation-dictionaries/${encodeURIComponent(dictionaryId)}`, {
    method: "DELETE",
    headers: { "xi-api-key": apiKey },
    signal: AbortSignal.timeout(15_000),
  });
  if (!res.ok) {
    const errText = await res.text().catch(() => "");
    throw new Error(`ElevenLabs PronDict delete ${res.status}: ${errText.slice(0, 200)}`);
  }
}

function buildPlsFromRules(name: string, rules: PronunciationRule[]): string {
  const entries = rules.map(r => {
    if (r.type === "alias") {
      return `  <lexeme><grapheme>${escapeXml(r.string_to_replace)}</grapheme><alias>${escapeXml(r.alias ?? "")}</alias></lexeme>`;
    }
    const alphabet = r.alphabet ?? "ipa";
    return `  <lexeme><grapheme>${escapeXml(r.string_to_replace)}</grapheme><phoneme alphabet="${alphabet}">${escapeXml(r.phoneme ?? "")}</phoneme></lexeme>`;
  }).join("\n");
  return `<?xml version="1.0" encoding="UTF-8"?>
<lexicon version="1.0" xmlns="http://www.w3.org/2005/01/pronunciation-lexicon" alphabet="ipa" xml:lang="es">
  <info><desc>${escapeXml(name)}</desc></info>
${entries}
</lexicon>`;
}

// ── Sound Effects (SFX) ──────────────────────────────────────────────────────
export interface SoundEffectResult {
  audio: Buffer;
  contentType: string;
  durationSeconds?: number;
}

export async function generateSoundEffect(
  text: string,
  durationSeconds?: number,
  promptInfluence?: number
): Promise<SoundEffectResult> {
  const key = process.env.ELEVENLABS_API_KEY;
  if (!key) throw new Error("ELEVENLABS_API_KEY not set");
  if (!text?.trim()) throw new Error("El texto del efecto de sonido no puede estar vacío");

  const body: Record<string, unknown> = { text: text.slice(0, 450) };
  if (durationSeconds && durationSeconds >= 0.5 && durationSeconds <= 22) {
    body.duration_seconds = durationSeconds;
  }
  if (promptInfluence !== undefined) {
    body.prompt_influence = Math.max(0, Math.min(1, promptInfluence));
  }

  const res = await fetch(`${ELEVEN_BASE}/sound-generation`, {
    method: "POST",
    headers: { "xi-api-key": key, "Content-Type": "application/json", "Accept": "audio/mpeg" },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => "");
    throw new Error(`ElevenLabs SFX ${res.status}: ${errText.slice(0, 200)}`);
  }

  const buffer = Buffer.from(await res.arrayBuffer());
  return { audio: buffer, contentType: "audio/mpeg", durationSeconds };
}

function escapeXml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&apos;");
}
