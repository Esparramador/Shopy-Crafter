const PCM16_FORMAT_RE = /^pcm_(\d+)$/i;

export function base64ToBytes(base64: string): Uint8Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

function decodePcm16Le(
  context: AudioContext,
  bytes: Uint8Array,
  sampleRate: number,
): AudioBuffer {
  const sampleCount = Math.floor(bytes.byteLength / 2);
  const audioBuffer = context.createBuffer(1, sampleCount, sampleRate);
  const channel = audioBuffer.getChannelData(0);
  const view = new DataView(bytes.buffer, bytes.byteOffset, sampleCount * 2);

  for (let i = 0; i < sampleCount; i += 1) {
    channel[i] = view.getInt16(i * 2, true) / 32768;
  }

  return audioBuffer;
}

export async function decodeConvAIAudio(
  context: AudioContext,
  base64: string,
  format = "pcm_16000",
): Promise<AudioBuffer> {
  const bytes = base64ToBytes(base64);
  const match = format.match(PCM16_FORMAT_RE);

  if (match) {
    const sampleRate = Number(match[1]);
    if (!Number.isFinite(sampleRate) || sampleRate <= 0) {
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