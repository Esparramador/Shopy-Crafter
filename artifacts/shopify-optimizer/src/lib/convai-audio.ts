const PCM16_FORMAT_RE = /^pcm_(\d+)$/i;

/**
 * Returns the sample rate announced by a ConvAI `pcm_<rate>` format string,
 * or null when the format is not raw PCM16 (mp3_*, ulaw_8000, ...).
 */
export function parsePcmSampleRate(format: string | null | undefined): number | null {
  if (typeof format !== "string") return null;
  const match = format.trim().match(PCM16_FORMAT_RE);
  if (!match) return null;
  const sampleRate = Number(match[1]);
  return Number.isFinite(sampleRate) && sampleRate > 0 ? sampleRate : null;
}

export function base64ToBytes(base64: string): Uint8Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

/** Minimal AudioContext surface needed to decode ConvAI audio (testable). */
export type ConvAIDecodeContext = Pick<BaseAudioContext, "createBuffer" | "decodeAudioData">;

/** Minimal AudioContext surface needed to play decoded audio (testable). */
export type ConvAIPlaybackContext = ConvAIDecodeContext &
  Pick<BaseAudioContext, "createBufferSource" | "destination" | "state" | "currentTime">;

function decodePcm16Le(
  context: ConvAIDecodeContext,
  bytes: Uint8Array,
  sampleRate: number,
): AudioBuffer {
  const sampleCount = Math.floor(bytes.byteLength / 2);
  if (sampleCount === 0) {
    throw new Error("El chunk de audio PCM recibido está vacío");
  }
  const audioBuffer = context.createBuffer(1, sampleCount, sampleRate);
  const channel = audioBuffer.getChannelData(0);
  const view = new DataView(bytes.buffer, bytes.byteOffset, sampleCount * 2);

  for (let i = 0; i < sampleCount; i += 1) {
    channel[i] = view.getInt16(i * 2, true) / 32768;
  }

  return audioBuffer;
}

export async function decodeConvAIAudio(
  context: ConvAIDecodeContext,
  base64: string,
  format = "pcm_16000",
): Promise<AudioBuffer> {
  const bytes = base64ToBytes(base64);

  if (PCM16_FORMAT_RE.test(format.trim())) {
    const sampleRate = parsePcmSampleRate(format);
    if (sampleRate === null) {
      throw new Error(`Formato PCM inválido: ${format}`);
    }
    return decodePcm16Le(context, bytes, sampleRate);
  }

  // Encoded formats (for example MP3) still go through the browser decoder.
  // Copy the bytes so decodeAudioData owns a standalone ArrayBuffer.
  const copy = new Uint8Array(bytes);
  return context.decodeAudioData(copy.buffer);
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
  }
  return btoa(binary);
}

export function float32ToPcm16Base64(
  input: Float32Array,
  inputSampleRate: number,
  outputSampleRate = 16000,
): string {
  if (!Number.isFinite(inputSampleRate) || inputSampleRate <= 0) {
    throw new Error(`Sample rate de entrada inválido: ${inputSampleRate}`);
  }
  if (!Number.isFinite(outputSampleRate) || outputSampleRate <= 0) {
    throw new Error(`Sample rate de salida inválido: ${outputSampleRate}`);
  }

  const ratio = inputSampleRate / outputSampleRate;
  const outputLength = Math.max(1, Math.floor(input.length / ratio));
  const buffer = new ArrayBuffer(outputLength * 2);
  const view = new DataView(buffer);

  for (let outputIndex = 0; outputIndex < outputLength; outputIndex += 1) {
    const start = Math.floor(outputIndex * ratio);
    const end = Math.min(input.length, Math.max(start + 1, Math.floor((outputIndex + 1) * ratio)));
    let sum = 0;
    for (let inputIndex = start; inputIndex < end; inputIndex += 1) {
      sum += input[inputIndex];
    }
    const average = sum / (end - start);
    const clipped = Math.max(-1, Math.min(1, average));
    view.setInt16(outputIndex * 2, clipped < 0 ? clipped * 32768 : clipped * 32767, true);
  }

  return bytesToBase64(new Uint8Array(buffer));
}

// ── Ordered, gapless playback queue ──────────────────────────────────────────

export interface ConvAIPlaybackHandlers {
  /** Fired when the agent starts (true) or stops (false) being audible. */
  onSpeakingChange?: (speaking: boolean) => void;
  /** Fired when a chunk could not be decoded. `format` is the announced format. */
  onDecodeError?: (error: unknown, format: string) => void;
  /** Fired when a decoded chunk could not be started on the audio graph. */
  onPlaybackError?: (error: unknown) => void;
}

export interface ConvAIPlaybackOptions {
  /**
   * Small jitter buffer before the first chunk of an utterance plays, in
   * seconds. Later chunks are scheduled sample-contiguously after it.
   */
  leadSeconds?: number;
}

export interface ConvAIPlaybackQueue {
  /** Record the agent output format announced in conversation_initiation_metadata. */
  setFormat: (format: string) => void;
  getFormat: () => string;
  /**
   * Decode a base64 chunk and schedule it. Decoding is serialized and each
   * chunk starts exactly where the previous one ends on the AudioContext
   * timeline, so network jitter can neither reorder speech nor leave gaps.
   * Resolves once the chunk has been decoded (or its failure reported).
   */
  enqueue: (context: ConvAIPlaybackContext, base64: string) => Promise<void>;
  /** Number of scheduled chunks that have not finished playing yet. */
  pendingCount: () => number;
  /** Stop everything scheduled (user barged in) but keep the announced format. */
  interrupt: () => void;
  /** Stop playback, drop in-flight decodes and forget the announced format. */
  reset: () => void;
}

export function createConvAIPlaybackQueue(
  handlers: ConvAIPlaybackHandlers = {},
  options: ConvAIPlaybackOptions = {},
): ConvAIPlaybackQueue {
  const lead = Math.max(0, options.leadSeconds ?? 0.06);
  let format = "pcm_16000";
  let chain: Promise<void> = Promise.resolve();
  let generation = 0;
  let nextStartTime = 0;
  const active = new Set<AudioBufferSourceNode>();

  const schedule = (context: ConvAIPlaybackContext, buffer: AudioBuffer) => {
    if (context.state === "closed") return;
    const startedGeneration = generation;
    let source: AudioBufferSourceNode | null = null;
    try {
      source = context.createBufferSource();
      source.buffer = buffer;
      source.connect(context.destination);
      const startAt = Math.max(nextStartTime, context.currentTime + lead);
      const node = source;
      node.onended = () => {
        active.delete(node);
        if (startedGeneration !== generation) return;
        if (active.size === 0) handlers.onSpeakingChange?.(false);
      };
      const wasSilent = active.size === 0;
      active.add(node);
      node.start(startAt);
      nextStartTime = startAt + buffer.duration;
      if (wasSilent) handlers.onSpeakingChange?.(true);
    } catch (error) {
      if (source) active.delete(source);
      handlers.onPlaybackError?.(error);
    }
  };

  const stopAll = () => {
    generation += 1;
    for (const source of active) {
      source.onended = null;
      try { source.stop(); } catch { /* already stopped */ }
    }
    active.clear();
    chain = Promise.resolve();
    nextStartTime = 0;
  };

  return {
    setFormat: (next) => {
      if (typeof next === "string" && next.trim()) format = next.trim();
    },
    getFormat: () => format,
    enqueue: (context, base64) => {
      const enqueuedGeneration = generation;
      const enqueuedFormat = format;
      chain = chain.then(async () => {
        if (enqueuedGeneration !== generation) return;
        try {
          const decoded = await decodeConvAIAudio(context, base64, enqueuedFormat);
          if (enqueuedGeneration !== generation) return;
          schedule(context, decoded);
        } catch (error) {
          if (enqueuedGeneration !== generation) return;
          handlers.onDecodeError?.(error, enqueuedFormat);
        }
      });
      return chain;
    },
    pendingCount: () => active.size,
    interrupt: () => {
      const wasSpeaking = active.size > 0;
      stopAll();
      if (wasSpeaking) handlers.onSpeakingChange?.(false);
    },
    reset: () => {
      stopAll();
      format = "pcm_16000";
    },
  };
}

// ── Close-reason diagnostics ──────────────────────────────────────────────────

/**
 * Translate a ConvAI WebSocket close event into a message a user can act on.
 * Returns null for a normal close (code 1000 without reason) so callers can
 * treat it as a regular hang-up.
 */
export function describeConvAIClose(code: number, reason: string | null | undefined): string | null {
  const text = (reason ?? "").trim();
  const lower = text.toLowerCase();

  if (lower.includes("voice_not_found") || lower.includes("voice not found")) {
    return `ElevenLabs rechazó la voz configurada para el agente (voice_not_found). Cambia ELEVEN_CONVAI_VOICE_ID por una voz premade o re-sincroniza los agentes. Detalle: ${text}`;
  }
  if (lower.includes("subscription") || lower.includes("plan") || lower.includes("instant voice cloning") || lower.includes("payment")) {
    return `ElevenLabs cerró la llamada por límites del plan (la voz o función no está disponible en la suscripción actual). Detalle: ${text}`;
  }
  if (lower.includes("audio_format") || lower.includes("audio format") || lower.includes("pcm")) {
    return `ElevenLabs cerró la llamada por un formato de audio incompatible. Detalle: ${text}`;
  }
  if (lower.includes("agent") && (lower.includes("not found") || lower.includes("does not exist"))) {
    return `El agente ConvAI configurado ya no existe en ElevenLabs. Re-sincroniza los agentes desde el panel. Detalle: ${text}`;
  }
  if (code === 1000 && !text) return null;
  if (code === 1006) {
    return "La conexión con ElevenLabs se cortó de forma inesperada (código 1006) antes de recibir audio.";
  }
  return text
    ? `ElevenLabs cerró la llamada (código ${code}): ${text}`
    : `ElevenLabs cerró la llamada de forma anómala (código ${code}).`;
}
