import { describe, expect, it, vi } from "vitest";
import { readLandingChatStream } from "./landing-chat-stream";

function streamFrom(chunks: string[]) {
  const encoder = new TextEncoder();
  return new ReadableStream<Uint8Array>({
    start(controller) {
      for (const chunk of chunks) controller.enqueue(encoder.encode(chunk));
      controller.close();
    },
  });
}

describe("readLandingChatStream", () => {
  it("joins split SSE frames and only succeeds after the done event", async () => {
    const onText = vi.fn();
    const result = await readLandingChatStream(
      streamFrom(['data: {"text":"Hola"}\n', '\ndata: {"text":" mundo"}\n\ndata: {"done":true}\n\n']),
      onText,
    );

    expect(result).toEqual({ content: "Hola mundo", complete: true });
    expect(onText).toHaveBeenLastCalledWith("Hola mundo");
  });

  it("treats a partial stream close as incomplete so the caller can use fallback", async () => {
    const result = await readLandingChatStream(
      streamFrom(['data: {"text":"Respuesta parcial"}\n\n']),
      vi.fn(),
    );

    expect(result).toMatchObject({ content: "Respuesta parcial", complete: false });
  });

  it("does not mark an errored stream complete even if it has partial content", async () => {
    const result = await readLandingChatStream(
      streamFrom(['data: {"text":"Mitad"}\n\ndata: {"error":"failed","done":true}\n\n']),
      vi.fn(),
    );

    expect(result.complete).toBe(false);
    expect(result.error).toBeTruthy();
  });
});
