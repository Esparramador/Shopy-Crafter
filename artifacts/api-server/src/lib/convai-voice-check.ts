/**
 * ConvAI pre-flight checks.
 *
 * A ConvAI call can "connect" and stay silent when ElevenLabs rejects the
 * agent's voice (voice_not_found, instant clone blocked by the plan) or when
 * the agent's audio formats drift away from the PCM16 protocol the browser
 * speaks. These helpers make those failures explicit BEFORE a signed URL is
 * handed to the browser. They are pure functions over API payloads so they can
 * be unit-tested; the network wrappers live at the bottom of this file.
 */

export type ConvAIVoiceErrorCode =
  | "voice_not_found"
  | "voice_not_allowed_on_plan"
  | "voice_lookup_failed"
  | "agent_config_mismatch";

export class ConvAIVoiceError extends Error {
  readonly code: ConvAIVoiceErrorCode;
  readonly voiceId?: string;
  readonly agentId?: string;

  constructor(code: ConvAIVoiceErrorCode, message: string, ctx: { voiceId?: string; agentId?: string } = {}) {
    super(message);
    this.name = "ConvAIVoiceError";
    this.code = code;
    this.voiceId = ctx.voiceId;
    this.agentId = ctx.agentId;
  }
}

export function isConvAIVoiceError(err: unknown): err is ConvAIVoiceError {
  return err instanceof ConvAIVoiceError
    || (typeof err === "object" && err !== null && (err as { name?: string }).name === "ConvAIVoiceError");
}

/** Subset of GET /v1/voices/{voice_id} we rely on. */
export interface ElevenVoiceInfo {
  voice_id: string;
  name?: string;
  category?: string; // "premade" | "cloned" | "generated" | "professional" | ...
  high_quality_base_model_ids?: string[];
  labels?: Record<string, string>;
}

/** Subset of GET /v1/user/subscription we rely on. */
export interface ElevenSubscriptionInfo {
  tier?: string;
  can_use_instant_voice_cloning?: boolean;
  can_use_professional_voice_cloning?: boolean;
}

export interface VoiceUsabilityOptions {
  /** ConvAI model the agent is configured with (e.g. eleven_turbo_v2_5). */
  modelId: string;
  /**
   * Subscription info, when known. If omitted the check is conservative and
   * treats instant clones as unavailable (matches the failures seen live).
   */
  subscription?: ElevenSubscriptionInfo | null;
}

export interface VoiceUsabilityResult {
  voiceId: string;
  category: string;
  warnings: string[];
}

/**
 * Decide whether ElevenLabs Agents will accept `voice` for a live call.
 * Throws ConvAIVoiceError with an actionable Spanish message when it will not.
 */
export function assertConvAIVoiceUsable(
  voice: ElevenVoiceInfo | null | undefined,
  voiceId: string,
  opts: VoiceUsabilityOptions,
): VoiceUsabilityResult {
  if (!voice) {
    throw new ConvAIVoiceError(
      "voice_not_found",
      `La voz ConvAI "${voiceId}" no existe en la cuenta de ElevenLabs (voice_not_found). ` +
        "Configura ELEVEN_CONVAI_VOICE_ID con una voz premade válida o elimina la variable para usar la voz por defecto.",
      { voiceId },
    );
  }

  const category = (voice.category ?? "unknown").toLowerCase();
  const warnings: string[] = [];

  if (category === "cloned") {
    const allowed = opts.subscription?.can_use_instant_voice_cloning === true;
    if (!allowed) {
      const tier = opts.subscription?.tier ? ` (plan actual: ${opts.subscription.tier})` : "";
      throw new ConvAIVoiceError(
        "voice_not_allowed_on_plan",
        `La voz "${voice.name ?? voiceId}" es un clon instantáneo y el plan de ElevenLabs no permite usarla en ConvAI${tier}. ` +
          "ElevenLabs cerraría la llamada sin audio. Usa una voz premade o sube de plan.",
        { voiceId },
      );
    }
  }

  if (category === "professional") {
    const allowed = opts.subscription?.can_use_professional_voice_cloning === true;
    if (!allowed) {
      warnings.push(
        `La voz "${voice.name ?? voiceId}" es "professional" y el plan no incluye clonación profesional; ` +
          "algunas voces de catálogo con esa categoría devuelven voice_not_found en ConvAI.",
      );
    }
  }

  // Premade voices list the models they were tuned for. A voice that does not
  // list the ConvAI model is a strong hint the agent will fall back to silence,
  // but the list is not authoritative for every category, so warn loudly
  // instead of blocking the call.
  const supportedModels = Array.isArray(voice.high_quality_base_model_ids) ? voice.high_quality_base_model_ids : [];
  if (supportedModels.length > 0 && !supportedModels.includes(opts.modelId)) {
    warnings.push(
      `La voz "${voice.name ?? voiceId}" no declara soporte para el modelo ${opts.modelId} ` +
        `(declara: ${supportedModels.join(", ")}). Si la llamada queda muda, cambia de voz.`,
    );
  }

  return { voiceId, category, warnings };
}

/** What we require the persisted agent to announce for a PCM16 browser call. */
export interface ExpectedConvAIAgentAudio {
  voiceId: string;
  modelId: string;
  /** e.g. "pcm_16000" */
  outputFormat: string;
  /** e.g. "pcm_16000" */
  inputFormat: string;
}

/**
 * Read the fields ElevenLabs actually persisted for an agent. The PATCH API
 * silently ignores unknown keys, so the only reliable check is to read back
 * `conversation_config.tts.agent_output_audio_format` and
 * `conversation_config.asr.user_input_audio_format`.
 */
export function readConvAIAgentAudioConfig(agent: { conversation_config?: unknown }): {
  voiceId: string | null;
  modelId: string | null;
  outputFormat: string | null;
  inputFormat: string | null;
} {
  const cc = (agent.conversation_config ?? {}) as Record<string, unknown>;
  const tts = (cc.tts ?? {}) as Record<string, unknown>;
  const asr = (cc.asr ?? {}) as Record<string, unknown>;
  const str = (v: unknown): string | null => (typeof v === "string" && v.trim() ? v.trim() : null);
  return {
    voiceId: str(tts.voice_id),
    modelId: str(tts.model_id),
    outputFormat: str(tts.agent_output_audio_format) ?? str(tts.output_format),
    inputFormat: str(asr.user_input_audio_format),
  };
}

const PCM_FORMAT_RE = /^pcm_\d+$/i;

/**
 * Verify the agent ElevenLabs returned matches what we just synchronized.
 * Throws ConvAIVoiceError("agent_config_mismatch") describing every drift.
 */
export function assertConvAIAgentConfigApplied(
  agent: { agent_id?: string; conversation_config?: unknown },
  expected: ExpectedConvAIAgentAudio,
): void {
  const actual = readConvAIAgentAudioConfig(agent);
  const problems: string[] = [];

  if (actual.voiceId !== expected.voiceId) {
    problems.push(`voz esperada ${expected.voiceId}, ElevenLabs guardó ${actual.voiceId ?? "(ninguna)"}`);
  }
  if (actual.modelId !== expected.modelId) {
    problems.push(`modelo esperado ${expected.modelId}, ElevenLabs guardó ${actual.modelId ?? "(ninguno)"}`);
  }
  if (!actual.outputFormat || !PCM_FORMAT_RE.test(actual.outputFormat) || actual.outputFormat.toLowerCase() !== expected.outputFormat.toLowerCase()) {
    problems.push(`formato de salida esperado ${expected.outputFormat}, el agente anuncia ${actual.outputFormat ?? "(ninguno)"}`);
  }
  if (!actual.inputFormat || !PCM_FORMAT_RE.test(actual.inputFormat) || actual.inputFormat.toLowerCase() !== expected.inputFormat.toLowerCase()) {
    problems.push(`formato de micrófono esperado ${expected.inputFormat}, el agente anuncia ${actual.inputFormat ?? "(ninguno)"}`);
  }

  if (problems.length > 0) {
    throw new ConvAIVoiceError(
      "agent_config_mismatch",
      `El agente ConvAI ${agent.agent_id ?? ""} no quedó configurado para audio PCM: ${problems.join("; ")}. ` +
        "La llamada conectaría sin audio. Re-sincroniza los agentes o revisa la voz configurada.",
      { agentId: agent.agent_id, voiceId: expected.voiceId },
    );
  }
}

// ── Network wrappers ──────────────────────────────────────────────────────────

const ELEVEN_BASE = "https://api.elevenlabs.io/v1";

function apiKey(): string {
  const key = process.env.ELEVENLABS_API_KEY;
  if (!key || key.trim().length < 10) throw new Error("ELEVENLABS_API_KEY no configurado");
  return key.trim();
}

/**
 * GET /v1/voices/{voice_id}. Returns null when ElevenLabs reports
 * voice_not_found (it answers 400 or 404 for that); throws for other failures.
 */
export async function fetchElevenVoice(voiceId: string): Promise<ElevenVoiceInfo | null> {
  const res = await fetch(`${ELEVEN_BASE}/voices/${encodeURIComponent(voiceId)}`, {
    headers: { "xi-api-key": apiKey() },
    signal: AbortSignal.timeout(15_000),
  });
  if (res.ok) return (await res.json()) as ElevenVoiceInfo;

  const text = await res.text().catch(() => "");
  if (res.status === 404 || /voice_not_found/i.test(text)) return null;
  throw new ConvAIVoiceError(
    "voice_lookup_failed",
    `No se pudo comprobar la voz ConvAI "${voiceId}" en ElevenLabs (HTTP ${res.status}): ${text.slice(0, 200)}`,
    { voiceId },
  );
}

export async function fetchElevenSubscription(): Promise<ElevenSubscriptionInfo | null> {
  const res = await fetch(`${ELEVEN_BASE}/user/subscription`, {
    headers: { "xi-api-key": apiKey() },
    signal: AbortSignal.timeout(15_000),
  });
  if (!res.ok) return null;
  return (await res.json()) as ElevenSubscriptionInfo;
}
