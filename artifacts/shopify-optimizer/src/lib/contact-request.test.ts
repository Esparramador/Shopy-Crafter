import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { clearContactRequestKey, sendContactRequest } from "./contact-request";

const SCOPE = "contact-test";
const values = new Map<string, string>();
const storage = {
  getItem: (key: string) => values.get(key) ?? null,
  setItem: (key: string, value: string) => { values.set(key, value); },
  removeItem: (key: string) => { values.delete(key); },
};

beforeEach(() => {
  values.clear();
  vi.stubGlobal("sessionStorage", storage);
  clearContactRequestKey(SCOPE);
});

afterEach(() => { clearContactRequestKey(SCOPE); vi.unstubAllGlobals(); vi.useRealTimers(); });

describe("contact request confirmation", () => {
  it("accepts only an explicit API confirmation", async () => {
    const fetcher = vi.fn().mockResolvedValue(new Response('{"success":true}'));
    vi.stubGlobal("fetch", fetcher);
    await expect(sendContactRequest("/api/contact", { method: "POST", body: "payload" }, SCOPE)).resolves.toBeUndefined();
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(fetcher.mock.calls[0][1]).toMatchObject({ method: "POST", body: "payload", signal: expect.any(AbortSignal) });
    expect(new Headers(fetcher.mock.calls[0][1]?.headers).get("Idempotency-Key")).toMatch(KEY_RE);
    expect(values.size).toBe(0);
  });

  it.each([200, 503])("does not leak JSON parse errors or report success for HTML (%s)", async status => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("<html>Proxy error</html>", { status })));
    await expect(sendContactRequest("/api/contact", {}, SCOPE)).rejects.toThrow(/confirmar/);
  });

  it("shows actionable API validation errors", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response('{"error":"Email inválido"}', { status: 400 })));
    await expect(sendContactRequest("/api/contact", {}, SCOPE)).rejects.toThrow("Email inválido");
  });

  it("does not expose server internals for a 500 response", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response('{"error":"private SQL detail"}', { status: 500 })));
    await expect(sendContactRequest("/api/contact", {}, SCOPE)).rejects.not.toThrow("private SQL detail");
  });

  it("does not automatically resend when the network fails", async () => {
    const fetcher = vi.fn().mockRejectedValue(new TypeError("Failed to fetch"));
    vi.stubGlobal("fetch", fetcher);
    await expect(sendContactRequest("/api/contact", {}, SCOPE)).rejects.toThrow("Revisa tu conexión");
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it("reuses the same key after a lost response and keeps it across page reloads", async () => {
    const keys: string[] = [];
    const fetcher = vi.fn(async (_url, init) => {
      keys.push(new Headers(init.headers).get("Idempotency-Key")!);
      if (keys.length === 1) throw new TypeError("The response was lost");
      return new Response('{"success":true}');
    });
    vi.stubGlobal("fetch", fetcher);
    await expect(sendContactRequest("/api/contact", { method: "POST", body: '{"email":"test"}' }, SCOPE))
      .rejects.toThrow("Revisa tu conexión");
    const savedKey = values.get("shopycrafter:contact-idempotency:contact-test");
    expect(savedKey).toBe(keys[0]);
    await expect(sendContactRequest("/api/contact", { method: "POST", body: '{"email":"test"}' }, SCOPE))
      .resolves.toBeUndefined();
    expect(keys).toEqual([savedKey, savedKey]);
    expect(fetcher).toHaveBeenCalledTimes(2);
    expect(values.size).toBe(0);
  });

  it("rotates a stale key once when a visitor resubmits changed form data", async () => {
    const keys: string[] = [];
    const fetcher = vi.fn(async (_url, init) => {
      keys.push(new Headers(init.headers).get("Idempotency-Key")!);
      return keys.length === 1
        ? new Response('{"code":"IDEMPOTENCY_KEY_REUSED","error":"Clave reutilizada"}', { status: 409 })
        : new Response('{"success":true}');
    });
    vi.stubGlobal("fetch", fetcher);
    await expect(sendContactRequest("/api/contact", { method: "POST", body: '{"email":"changed"}' }, SCOPE))
      .resolves.toBeUndefined();
    expect(keys).toHaveLength(2);
    expect(keys[0]).not.toBe(keys[1]);
    expect(fetcher).toHaveBeenCalledTimes(2);
    expect(values.size).toBe(0);
  });

  it("preserves multipart uploads while adding the idempotency header", async () => {
    const form = new FormData();
    form.append("name", "Test");
    const fetcher = vi.fn().mockResolvedValue(new Response('{"success":true}'));
    vi.stubGlobal("fetch", fetcher);
    await sendContactRequest("/api/contact", { method: "POST", body: form }, SCOPE);
    expect(fetcher.mock.calls[0][1]?.body).toBe(form);
    expect(fetcher.mock.calls[0][1]?.headers).toBeInstanceOf(Headers);
    expect((fetcher.mock.calls[0][1]?.headers as Headers).has("Content-Type")).toBe(false);
  });

  it("bounds an unresponsive submission instead of leaving the button busy forever", async () => {
    vi.useFakeTimers();
    vi.stubGlobal("fetch", vi.fn((_url, init) => new Promise((_resolve, reject) => {
      init.signal.addEventListener("abort", () => reject(new DOMException("Aborted", "AbortError")));
    })));
    const assertion = expect(sendContactRequest("/api/contact", {}, SCOPE)).rejects.toThrow("ha tardado demasiado");
    await vi.advanceTimersByTimeAsync(30_000);
    await assertion;
  });
});

const KEY_RE = /^[A-Za-z0-9._~-]{16,128}$/;
