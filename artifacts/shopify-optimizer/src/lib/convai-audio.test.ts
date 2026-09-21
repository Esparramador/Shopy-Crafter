import { describe, expect, it, vi } from "vitest";
import {
  base64ToBytes,
  createConvAIPlaybackQueue,
  decodeConvAIAudio,
  describeConvAIClose,
  float32ToPcm16Base64,
  parsePcmSampleRate,
  type ConvAIPlaybackContext,
} from "./convai-audio";

// ── Test doubles ──────────────────────────────────────────────────────────────

class FakeAudioBuffer {
  readonly numberOfChannels: number;
  readonly length: number;
  readonly sampleRate: number;
  readonly duration: number;
  private readonly channels: Float32Array[];

  constructor(channels: number, length: number, sampleRate: number) {
    this.numberOfChannels = channels;
    this.length = length;
    this.sampleRate = sampleRate;
    this.duration = length / sampleRate;
    this.channels = Array.from({ length: channels }, () => new Float32Array(length));
  }

  getChannelData(index: number): Float32Array {
    return this.channels[index];
  }
}

class FakeBufferSource {
  buffer: AudioBuffer | null = null;
  onended: (() => void) | null = null;
  started = false;
  stopped = false;
  startAt = -1;
  constructor(private readonly context: FakeAudioContext) {}
  connect(): void {}
  start(when = 0): void {
    if (this.context.failOnStart) throw new Error("start() rejected by fake graph");
    this.started = true;
    this.startAt = when;
    this.context.startedSources.push(this);
  }
  stop(): void {
    this.stopped = true;
  }
  /** Simulate the browser firing `ended` once playback finishes. */
  finish(): void {
    this.onended?.();
  }
}

class FakeAudioContext {
  state: AudioContextState = "running";
  currentTime = 0;
  destination = {} as AudioDestinationNode;
  startedSources: FakeBufferSource[] = [];
  failOnStart = false;
  decodeAudioDataCalls = 0;

  createBuffer(channels: number, length: number, sampleRate: number): AudioBuffer {
    return new FakeAudioBuffer(channels, length, sampleRate) as unknown as AudioBuffer;
  }

  createBufferSource(): AudioBufferSourceNode {
    return new FakeBufferSource(this) as unknown as AudioBufferSourceNode;
  }

  decodeAudioData(): Promise<AudioBuffer> {
    this.decodeAudioDataCalls += 1;
    return Promise.reject(new Error("fake decodeAudioData cannot decode headerless bytes"));
  }

  asPlaybackContext(): ConvAIPlaybackContext {
    return this as unknown as ConvAIPlaybackContext;
  }
}

function pcm16Base64(samples: number[]): string {
  const bytes = new Uint8Array(samples.length * 2);
  const view = new DataView(bytes.buffer);
  samples.forEach((sample, i) => view.setInt16(i * 2, sample, true));
  let binary = "";
  bytes.forEach((b) => { binary += String.fromCharCode(b); });
  return btoa(binary);
}

function int16SamplesFromBase64(base64: string): number[] {
  const bytes = base64ToBytes(base64);
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const out: number[] = [];
  for (let i = 0; i < bytes.byteLength; i += 2) out.push(view.getInt16(i, true));
  return out;
}

// ── Microphone: Float32 → PCM16 @ 16 kHz ───────────────────────────────────────

describe("float32ToPcm16Base64 (microphone encoder)", () => {
  it("downsamples 48 kHz input to 16 kHz by a factor of 3", () => {
    const input = new Float32Array(4800); // 100 ms @ 48 kHz
    const base64 = float32ToPcm16Base64(input, 48000, 16000);
    const bytes = base64ToBytes(base64);
    expect(bytes.byteLength).toBe(1600 * 2); // 100 ms @ 16 kHz, 2 bytes per sample
  });

  it("encodes signed little-endian PCM16 with full-scale clipping", () => {
    const input = new Float32Array([0, 1, -1, 0.5, -0.5, 2, -2]);
    const samples = int16SamplesFromBase64(float32ToPcm16Base64(input, 16000, 16000));
    expect(samples).toEqual([0, 32767, -32768, 16383, -16384, 32767, -32768]);
  });

  it("is little-endian on the wire (low byte first)", () => {
    const bytes = base64ToBytes(float32ToPcm16Base64(new Float32Array([1]), 16000, 16000));
    expect(Array.from(bytes)).toEqual([0xff, 0x7f]); // 32767 = 0x7fff
  });

  it("averages the samples it collapses so downsampling does not alias", () => {
    // 3 input samples per output sample; the mean of [0.3, 0.6, 0.9] is 0.6.
    const input = new Float32Array([0.3, 0.6, 0.9, -0.3, -0.6, -0.9]);
    const samples = int16SamplesFromBase64(float32ToPcm16Base64(input, 48000, 16000));
    expect(samples).toHaveLength(2);
    expect(samples[0]).toBe(Math.trunc(0.6 * 32767));
    expect(samples[1]).toBe(Math.trunc(-0.6 * 32768));
  });

  it("passes 16 kHz input through sample-for-sample", () => {
    const input = new Float32Array(1024).fill(0.25);
    const samples = int16SamplesFromBase64(float32ToPcm16Base64(input, 16000, 16000));
    expect(samples).toHaveLength(1024);
    expect(new Set(samples)).toEqual(new Set([Math.trunc(0.25 * 32767)]));
  });

  it("supports non-integer ratios (44.1 kHz → 16 kHz)", () => {
    const input = new Float32Array(44100); // 1 s
    const bytes = base64ToBytes(float32ToPcm16Base64(input, 44100, 16000));
    expect(bytes.byteLength).toBe(16000 * 2);
  });

  it("rejects invalid sample rates loudly instead of sending garbage", () => {
    expect(() => float32ToPcm16Base64(new Float32Array(10), 0, 16000)).toThrow(/entrada/);
    expect(() => float32ToPcm16Base64(new Float32Array(10), 48000, NaN)).toThrow(/salida/);
  });
});

// ── Agent audio: PCM16 decode ─────────────────────────────────────────────────

describe("parsePcmSampleRate", () => {
  it("extracts the rate from pcm_<rate> formats", () => {
    expect(parsePcmSampleRate("pcm_16000")).toBe(16000);
    expect(parsePcmSampleRate(" PCM_24000 ")).toBe(24000);
  });

  it("returns null for encoded or unknown formats", () => {
    expect(parsePcmSampleRate("mp3_44100_128")).toBeNull();
    expect(parsePcmSampleRate("ulaw_8000")).toBeNull();
    expect(parsePcmSampleRate(undefined)).toBeNull();
    expect(parsePcmSampleRate("pcm_0")).toBeNull();
  });
});

describe("decodeConvAIAudio (agent PCM16 decoder)", () => {
  it("decodes PCM16 little-endian bytes into a mono buffer at the announced rate", async () => {
    const ctx = new FakeAudioContext();
    const buffer = await decodeConvAIAudio(ctx, pcm16Base64([0, 32767, -32768, 16384]), "pcm_16000");
    expect(buffer.numberOfChannels).toBe(1);
    expect(buffer.sampleRate).toBe(16000);
    expect(buffer.length).toBe(4);
    const data = Array.from(buffer.getChannelData(0));
    expect(data[0]).toBe(0);
    expect(data[1]).toBeCloseTo(32767 / 32768, 6);
    expect(data[2]).toBe(-1);
    expect(data[3]).toBe(0.5);
    // Raw PCM must never be routed through decodeAudioData (it has no container).
    expect(ctx.decodeAudioDataCalls).toBe(0);
  });

  it("honours a different announced PCM rate", async () => {
    const ctx = new FakeAudioContext();
    const buffer = await decodeConvAIAudio(ctx, pcm16Base64([1, 2, 3]), "pcm_24000");
    expect(buffer.sampleRate).toBe(24000);
    expect(buffer.length).toBe(3);
  });

  it("ignores a trailing odd byte instead of reading past the buffer", async () => {
    const ctx = new FakeAudioContext();
    const oddBytes = btoa(String.fromCharCode(0x00, 0x40, 0x7f)); // 1.5 samples
    const buffer = await decodeConvAIAudio(ctx, oddBytes, "pcm_16000");
    expect(buffer.length).toBe(1);
    expect(buffer.getChannelData(0)[0]).toBe(0.5);
  });

  it("fails loudly on an empty PCM chunk", async () => {
    const ctx = new FakeAudioContext();
    await expect(decodeConvAIAudio(ctx, "", "pcm_16000")).rejects.toThrow(/vacío/);
  });

  it("falls back to decodeAudioData for encoded formats", async () => {
    const ctx = new FakeAudioContext();
    await expect(decodeConvAIAudio(ctx, pcm16Base64([1, 2]), "mp3_44100_128")).rejects.toThrow(/decodeAudioData/);
    expect(ctx.decodeAudioDataCalls).toBe(1);
  });
});

// ── Ordered playback queue ────────────────────────────────────────────────────

describe("createConvAIPlaybackQueue (ordered, gapless playback)", () => {
  const LEAD = 0.06;

  it("schedules chunks in arrival order, each starting exactly where the previous ends", async () => {
    const ctx = new FakeAudioContext();
    const speaking: boolean[] = [];
    const queue = createConvAIPlaybackQueue({ onSpeakingChange: (s) => speaking.push(s) }, { leadSeconds: LEAD });
    queue.setFormat("pcm_16000");

    // 16 kHz → 160 samples = 10 ms, 320 = 20 ms, 480 = 30 ms.
    const chunks = [[100, ...new Array(159).fill(0)], [200, ...new Array(319).fill(0)], [300, ...new Array(479).fill(0)]];
    await Promise.all(chunks.map((c) => queue.enqueue(ctx.asPlaybackContext(), pcm16Base64(c))));

    expect(ctx.startedSources).toHaveLength(3);
    expect(queue.pendingCount()).toBe(3);
    const playedSamples = ctx.startedSources.map((s) => Math.round(s.buffer!.getChannelData(0)[0] * 32768));
    expect(playedSamples).toEqual([100, 200, 300]);

    const starts = ctx.startedSources.map((s) => s.startAt);
    expect(starts[0]).toBeCloseTo(LEAD, 6);
    expect(starts[1]).toBeCloseTo(LEAD + 0.01, 6);
    expect(starts[2]).toBeCloseTo(LEAD + 0.01 + 0.02, 6);

    // Speaking flips on once, and off only when the last chunk ends.
    expect(speaking).toEqual([true]);
    ctx.startedSources[0].finish();
    ctx.startedSources[1].finish();
    expect(speaking).toEqual([true]);
    ctx.startedSources[2].finish();
    expect(speaking).toEqual([true, false]);
    expect(queue.pendingCount()).toBe(0);
  });

  it("never schedules a chunk in the past when the timeline has moved on", async () => {
    const ctx = new FakeAudioContext();
    const queue = createConvAIPlaybackQueue({}, { leadSeconds: LEAD });
    await queue.enqueue(ctx.asPlaybackContext(), pcm16Base64(new Array(160).fill(0)));
    // Silence for a while: the clock advances past the end of the first chunk.
    ctx.currentTime = 5;
    await queue.enqueue(ctx.asPlaybackContext(), pcm16Base64(new Array(160).fill(0)));
    expect(ctx.startedSources[1].startAt).toBeCloseTo(5 + LEAD, 6);
  });

  it("keeps order even when decoding is asynchronous and interleaved", async () => {
    const ctx = new FakeAudioContext();
    const queue = createConvAIPlaybackQueue();
    const order: number[] = [];
    const originalCreateBuffer = ctx.createBuffer.bind(ctx);
    ctx.createBuffer = (channels, length, rate) => {
      const buffer = originalCreateBuffer(channels, length, rate);
      order.push(length);
      return buffer;
    };

    const promises = [1, 2, 3, 4, 5].map((n) => queue.enqueue(ctx.asPlaybackContext(), pcm16Base64(new Array(n).fill(0))));
    await Promise.all(promises);
    expect(order).toEqual([1, 2, 3, 4, 5]);
    expect(ctx.startedSources.map((s) => s.buffer!.length)).toEqual([1, 2, 3, 4, 5]);
    const starts = ctx.startedSources.map((s) => s.startAt);
    for (let i = 1; i < starts.length; i += 1) expect(starts[i]).toBeGreaterThan(starts[i - 1]);
  });

  it("reports decode failures instead of swallowing them and keeps playing later chunks", async () => {
    const ctx = new FakeAudioContext();
    const onDecodeError = vi.fn();
    const queue = createConvAIPlaybackQueue({ onDecodeError });
    queue.setFormat("mp3_44100_128"); // cannot be decoded by the fake context

    await queue.enqueue(ctx.asPlaybackContext(), pcm16Base64([1]));
    expect(onDecodeError).toHaveBeenCalledTimes(1);
    expect(onDecodeError.mock.calls[0][1]).toBe("mp3_44100_128");

    queue.setFormat("pcm_16000");
    await queue.enqueue(ctx.asPlaybackContext(), pcm16Base64([1]));
    expect(ctx.startedSources).toHaveLength(1);
  });

  it("reports playback failures", async () => {
    const ctx = new FakeAudioContext();
    ctx.failOnStart = true;
    const onPlaybackError = vi.fn();
    const queue = createConvAIPlaybackQueue({ onPlaybackError });
    await queue.enqueue(ctx.asPlaybackContext(), pcm16Base64([1]));
    expect(onPlaybackError).toHaveBeenCalledTimes(1);
    expect(queue.pendingCount()).toBe(0);
  });

  it("interrupt() stops everything scheduled, keeps the format and reports silence", async () => {
    const ctx = new FakeAudioContext();
    const speaking: boolean[] = [];
    const queue = createConvAIPlaybackQueue({ onSpeakingChange: (s) => speaking.push(s) });
    queue.setFormat("pcm_24000");
    await queue.enqueue(ctx.asPlaybackContext(), pcm16Base64([1, 2, 3]));
    await queue.enqueue(ctx.asPlaybackContext(), pcm16Base64([4, 5, 6]));
    queue.interrupt();
    expect(ctx.startedSources.every((s) => s.stopped)).toBe(true);
    expect(queue.pendingCount()).toBe(0);
    expect(queue.getFormat()).toBe("pcm_24000");
    expect(speaking).toEqual([true, false]);

    // A stale `ended` from a stopped source must not flip state again.
    ctx.startedSources[0].finish();
    expect(speaking).toEqual([true, false]);

    // The next utterance starts a fresh timeline.
    await queue.enqueue(ctx.asPlaybackContext(), pcm16Base64([7]));
    expect(ctx.startedSources[2].startAt).toBeCloseTo(0.06, 6);
  });

  it("drops queued audio and ignores in-flight decodes after reset()", async () => {
    const ctx = new FakeAudioContext();
    const queue = createConvAIPlaybackQueue();
    queue.setFormat("pcm_24000");
    const pending = queue.enqueue(ctx.asPlaybackContext(), pcm16Base64([1]));
    queue.reset();
    await pending;
    expect(ctx.startedSources).toHaveLength(0);
    expect(queue.pendingCount()).toBe(0);
    expect(queue.getFormat()).toBe("pcm_16000");
  });

  it("does not start audio on a closed context", async () => {
    const ctx = new FakeAudioContext();
    ctx.state = "closed";
    const queue = createConvAIPlaybackQueue();
    await queue.enqueue(ctx.asPlaybackContext(), pcm16Base64([1]));
    expect(ctx.startedSources).toHaveLength(0);
  });
});

// ── Close-reason diagnostics ──────────────────────────────────────────────────

describe("describeConvAIClose", () => {
  it("treats a clean close as a normal hang-up", () => {
    expect(describeConvAIClose(1000, "")).toBeNull();
    expect(describeConvAIClose(1000, undefined)).toBeNull();
  });

  it("explains a rejected voice", () => {
    const msg = describeConvAIClose(1008, "voice_not_found: A voice with ID 'x' was not found");
    expect(msg).toMatch(/voice_not_found/);
    expect(msg).toMatch(/ELEVEN_CONVAI_VOICE_ID/);
  });

  it("explains plan/subscription rejections", () => {
    expect(describeConvAIClose(1008, "Instant voice cloning is not available on your plan")).toMatch(/plan/i);
  });

  it("explains audio format rejections", () => {
    expect(describeConvAIClose(1003, "Unsupported audio_format")).toMatch(/formato de audio/i);
  });

  it("never returns an empty message for abnormal closes", () => {
    expect(describeConvAIClose(1006, "")).toMatch(/1006/);
    expect(describeConvAIClose(1011, "internal error")).toMatch(/1011.*internal error/);
  });
});
