import { afterEach, describe, expect, it, vi } from "vitest";
import { sendContactRequest } from "./contact-request";

afterEach(() => { vi.unstubAllGlobals(); vi.useRealTimers(); });

describe("contact request confirmation", () => {
  it("accepts only an explicit API confirmation", async () => {
    const fetcher = vi.fn().mockResolvedValue(new Response('{"success":true}'));
    vi.stubGlobal("fetch", fetcher);
    await expect(sendContactRequest("/api/contact", { method: "POST", body: "payload" })).resolves.toBeUndefined();
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(fetcher.mock.calls[0][1]).toMatchObject({ method: "POST", body: "payload", signal: expect.any(AbortSignal) });
  });

  it.each([200, 503])("does not leak JSON parse errors or report success for HTML (%s)", async status => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("<html>Proxy error</html>", { status })));
    await expect(sendContactRequest("/api/contact", {})).rejects.toThrow(/confirmar/);
  });

  it("shows actionable API validation errors", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response('{"error":"Email inválido"}', { status: 400 })));
    await expect(sendContactRequest("/api/contact", {})).rejects.toThrow("Email inválido");
  });

  it("does not expose server internals for a 500 response", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response('{"error":"private SQL detail"}', { status: 500 })));
    await expect(sendContactRequest("/api/contact", {})).rejects.not.toThrow("private SQL detail");
  });

  it("does not automatically resend when the network fails", async () => {
    const fetcher = vi.fn().mockRejectedValue(new TypeError("Failed to fetch"));
    vi.stubGlobal("fetch", fetcher);
    await expect(sendContactRequest("/api/contact", {})).rejects.toThrow("Revisa tu conexión");
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it("bounds an unresponsive submission instead of leaving the button busy forever", async () => {
    vi.useFakeTimers();
    vi.stubGlobal("fetch", vi.fn((_url, init) => new Promise((_resolve, reject) => {
      init.signal.addEventListener("abort", () => reject(new DOMException("Aborted", "AbortError")));
    })));
    const assertion = expect(sendContactRequest("/api/contact", {})).rejects.toThrow("ha tardado demasiado");
    await vi.advanceTimersByTimeAsync(30_000);
    await assertion;
  });
});
