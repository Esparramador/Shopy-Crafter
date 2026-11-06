export interface LandingChatStreamResult {
  content: string;
  complete: boolean;
  error?: string;
}

/**
 * Reads the landing advisor's SSE response. A clean socket close is not
 * considered success unless the server sent its explicit `done` event.
 */
export async function readLandingChatStream(
  body: ReadableStream<Uint8Array>,
  onText: (content: string) => void,
): Promise<LandingChatStreamResult> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let content = "";
  let complete = false;
  let error: string | undefined;

  const consumeFrame = (frame: string) => {
    const data = frame
      .split(/\r?\n/)
      .filter((line) => line.startsWith("data:"))
      .map((line) => line.slice(5).trimStart())
      .join("\n");
    if (!data) return;
    try {
      const event = JSON.parse(data) as { text?: unknown; done?: unknown; error?: unknown };
      if (typeof event.text === "string" && event.text) {
        content += event.text;
        onText(content);
      }
      if (event.error) error = "El flujo se interrumpió antes de completar la respuesta.";
      if (event.done === true && !event.error) complete = true;
    } catch {
      error = "El servidor devolvió una respuesta de chat no válida.";
    }
  };

  try {
    while (!complete && !error) {
      const { done, value } = await reader.read();
      if (done) {
        buffer += decoder.decode();
        if (buffer.trim()) consumeFrame(buffer);
        break;
      }
      buffer += decoder.decode(value, { stream: true });
      const frames = buffer.split(/\r?\n\r?\n/);
      buffer = frames.pop() ?? "";
      for (const frame of frames) {
        consumeFrame(frame);
        if (complete || error) break;
      }
    }
  } catch {
    error = "La conexión de streaming se interrumpió.";
  } finally {
    try { reader.releaseLock(); } catch {}
  }

  return { content, complete: complete && !error, ...(error ? { error } : {}) };
}
