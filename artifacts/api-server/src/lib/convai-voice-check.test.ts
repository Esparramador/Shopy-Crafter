import { afterEach, describe, expect, it, vi } from "vitest";
import {
  ConvAIVoiceError,
  assertConvAIAgentConfigApplied,
  assertConvAIVoiceUsable,
  fetchElevenVoice,
  isConvAIVoiceError,
  readConvAIAgentAudioConfig,
} from "./convai-voice-check";

const MODEL = "eleven_turbo_v2_5";

// Shapes copied from live ElevenLabs responses (Sept 2026).
const premadeCharlie = {
  voice_id: "IKne3meq5aSn9XLyUdCD",
  name: "Charlie - Deep, Confident, Energetic",
  category: "premade",
  high_quality_base_model_ids: ["eleven_flash_v2", "eleven_turbo_v2_5", "eleven_multilingual_v2"],
};

const instantCloneSevillano = {
  voice_id: "8m4O8qoFLrKBzbmsuL5T",
  name: "Sevillano",
  category: "cloned",
  high_quality_base_model_ids: [] as string[],
};

const paygPlan = { tier: "payg", can_use_instant_voice_cloning: false, can_use_professional_voice_cloning: false };
const creatorPlan = { tier: "creator", can_use_instant_voice_cloning: true, can_use_professional_voice_cloning: false };

describe("assertConvAIVoiceUsable (voice pre-flight)", () => {
  it("accepts a premade voice that supports the Spanish ConvAI model", () => {
    const result = assertConvAIVoiceUsable(premadeCharlie, premadeCharlie.voice_id, { modelId: MODEL, subscription: paygPlan });
    expect(result.category).toBe("premade");
    expect(result.warnings).toEqual([]);
  });

  it("rejects an unknown voice with a voice_not_found error and a fix hint", () => {
    let caught: unknown;
    try {
      assertConvAIVoiceUsable(null, "doesnotexist123", { modelId: MODEL, subscription: paygPlan });
    } catch (err) {
      caught = err;
    }
    expect(isConvAIVoiceError(caught)).toBe(true);
    const err = caught as ConvAIVoiceError;
    expect(err.code).toBe("voice_not_found");
    expect(err.voiceId).toBe("doesnotexist123");
    expect(err.message).toMatch(/doesnotexist123/);
    expect(err.message).toMatch(/ELEVEN_CONVAI_VOICE_ID/);
  });

  it("rejects an instant clone when the plan cannot use instant voice cloning", () => {
    expect(() => assertConvAIVoiceUsable(instantCloneSevillano, instantCloneSevillano.voice_id, { modelId: MODEL, subscription: paygPlan }))
      .toThrowError(expect.objectContaining({ code: "voice_not_allowed_on_plan" }));
    try {
      assertConvAIVoiceUsable(instantCloneSevillano, instantCloneSevillano.voice_id, { modelId: MODEL, subscription: paygPlan });
    } catch (err) {
      expect((err as Error).message).toMatch(/Sevillano/);
      expect((err as Error).message).toMatch(/payg/);
      expect((err as Error).message).toMatch(/sin audio/);
    }
  });

  it("is conservative when the subscription is unknown: instant clones are rejected", () => {
    expect(() => assertConvAIVoiceUsable(instantCloneSevillano, instantCloneSevillano.voice_id, { modelId: MODEL }))
      .toThrowError(expect.objectContaining({ code: "voice_not_allowed_on_plan" }));
  });

  it("accepts an instant clone when the plan explicitly allows it", () => {
    const result = assertConvAIVoiceUsable(instantCloneSevillano, instantCloneSevillano.voice_id, { modelId: MODEL, subscription: creatorPlan });
    expect(result.category).toBe("cloned");
  });

  it("warns (does not block) when a voice does not list the ConvAI model", () => {
    const voice = { ...premadeCharlie, high_quality_base_model_ids: ["eleven_multilingual_v2"] };
    const result = assertConvAIVoiceUsable(voice, voice.voice_id, { modelId: MODEL, subscription: paygPlan });
    expect(result.warnings).toHaveLength(1);
    expect(result.warnings[0]).toMatch(new RegExp(MODEL));
  });

  it("warns about professional catalog voices on plans without professional cloning", () => {
    const voice = { voice_id: "pro1", name: "Catalog Pro", category: "professional" };
    const result = assertConvAIVoiceUsable(voice, "pro1", { modelId: MODEL, subscription: paygPlan });
    expect(result.warnings.some((w) => /voice_not_found/.test(w))).toBe(true);
  });
});

describe("readConvAIAgentAudioConfig", () => {
  it("reads the fields ElevenLabs actually persists (agent_output_audio_format / asr.user_input_audio_format)", () => {
    // Shape copied from a live GET /v1/convai/agents/{id}.
    const agent = {
      agent_id: "agent_x",
      conversation_config: {
        tts: { model_id: MODEL, voice_id: premadeCharlie.voice_id, agent_output_audio_format: "pcm_16000", speed: 1.2 },
        asr: { quality: "high", provider: "scribe_realtime", user_input_audio_format: "pcm_16000" },
        agent: { language: "es" },
      },
    };
    expect(readConvAIAgentAudioConfig(agent)).toEqual({
      voiceId: premadeCharlie.voice_id,
      modelId: MODEL,
      outputFormat: "pcm_16000",
      inputFormat: "pcm_16000",
    });
  });

  it("returns nulls instead of crashing on a partial payload", () => {
    expect(readConvAIAgentAudioConfig({})).toEqual({ voiceId: null, modelId: null, outputFormat: null, inputFormat: null });
    expect(readConvAIAgentAudioConfig({ conversation_config: { tts: { voice_id: "  " } } }).voiceId).toBeNull();
  });
});

describe("assertConvAIAgentConfigApplied (post-sync verification)", () => {
  const expected = { voiceId: premadeCharlie.voice_id, modelId: MODEL, outputFormat: "pcm_16000", inputFormat: "pcm_16000" };
  const goodAgent = {
    agent_id: "agent_ok",
    conversation_config: {
      tts: { model_id: MODEL, voice_id: premadeCharlie.voice_id, agent_output_audio_format: "pcm_16000" },
      asr: { user_input_audio_format: "pcm_16000" },
    },
  };

  it("passes when voice, model and both PCM formats match", () => {
    expect(() => assertConvAIAgentConfigApplied(goodAgent, expected)).not.toThrow();
  });

  it("fails when ElevenLabs kept a different voice than the one we synced", () => {
    const agent = structuredClone(goodAgent);
    agent.conversation_config.tts.voice_id = instantCloneSevillano.voice_id;
    expect(() => assertConvAIAgentConfigApplied(agent, expected))
      .toThrowError(expect.objectContaining({ code: "agent_config_mismatch", agentId: "agent_ok" }));
    try { assertConvAIAgentConfigApplied(agent, expected); } catch (err) {
      expect((err as Error).message).toMatch(new RegExp(`voz esperada ${premadeCharlie.voice_id}`));
      expect((err as Error).message).toMatch(new RegExp(instantCloneSevillano.voice_id));
    }
  });

  it("fails when the agent announces a non-PCM output format (e.g. mp3)", () => {
    const agent = structuredClone(goodAgent);
    agent.conversation_config.tts.agent_output_audio_format = "mp3_44100_128";
    expect(() => assertConvAIAgentConfigApplied(agent, expected)).toThrowError(/formato de salida esperado pcm_16000/);
  });

  it("fails when the microphone input format drifted (e.g. ulaw_8000)", () => {
    const agent = structuredClone(goodAgent);
    agent.conversation_config.asr.user_input_audio_format = "ulaw_8000";
    expect(() => assertConvAIAgentConfigApplied(agent, expected)).toThrowError(/formato de micrófono esperado pcm_16000/);
  });

  it("fails when the PCM rate differs from the one the browser decodes", () => {
    const agent = structuredClone(goodAgent);
    agent.conversation_config.tts.agent_output_audio_format = "pcm_44100";
    expect(() => assertConvAIAgentConfigApplied(agent, expected)).toThrowError(/pcm_44100/);
  });

  it("fails when the Spanish model was not applied", () => {
    const agent = structuredClone(goodAgent);
    agent.conversation_config.tts.model_id = "eleven_multilingual_v2";
    expect(() => assertConvAIAgentConfigApplied(agent, expected)).toThrowError(/modelo esperado eleven_turbo_v2_5/);
  });

  it("lists every drift in one message so nothing is hidden", () => {
    const agent = { agent_id: "agent_empty", conversation_config: {} };
    try {
      assertConvAIAgentConfigApplied(agent, expected);
      throw new Error("should have thrown");
    } catch (err) {
      const message = (err as Error).message;
      expect(message).toMatch(/voz esperada/);
      expect(message).toMatch(/modelo esperado/);
      expect(message).toMatch(/formato de salida/);
      expect(message).toMatch(/formato de micrófono/);
    }
  });
});

describe("fetchElevenVoice (HTTP mapping)", () => {
  const originalFetch = globalThis.fetch;
  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.unstubAllEnvs();
  });

  function stubFetch(status: number, body: unknown) {
    globalThis.fetch = vi.fn(async () => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } })) as unknown as typeof fetch;
  }

  it("maps ElevenLabs' 400 voice_not_found payload to null (live API answers 400, not 404)", async () => {
    vi.stubEnv("ELEVENLABS_API_KEY", "test-key-1234567890");
    stubFetch(400, { detail: { status: "voice_not_found", message: "A voice with ID 'x' was not found." } });
    await expect(fetchElevenVoice("x")).resolves.toBeNull();
  });

  it("maps a 404 to null as well", async () => {
    vi.stubEnv("ELEVENLABS_API_KEY", "test-key-1234567890");
    stubFetch(404, { detail: "Not Found" });
    await expect(fetchElevenVoice("x")).resolves.toBeNull();
  });

  it("returns the voice payload on success", async () => {
    vi.stubEnv("ELEVENLABS_API_KEY", "test-key-1234567890");
    stubFetch(200, premadeCharlie);
    await expect(fetchElevenVoice(premadeCharlie.voice_id)).resolves.toMatchObject({ category: "premade" });
  });

  it("does not swallow other failures (e.g. 401 bad key)", async () => {
    vi.stubEnv("ELEVENLABS_API_KEY", "test-key-1234567890");
    stubFetch(401, { detail: { status: "invalid_api_key" } });
    await expect(fetchElevenVoice("x")).rejects.toThrowError(expect.objectContaining({ code: "voice_lookup_failed" }));
  });

  it("fails loudly when the API key is missing", async () => {
    vi.stubEnv("ELEVENLABS_API_KEY", "");
    await expect(fetchElevenVoice("x")).rejects.toThrow(/ELEVENLABS_API_KEY/);
  });
});
