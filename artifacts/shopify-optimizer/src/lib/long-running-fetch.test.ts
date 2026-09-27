import { describe, expect, it } from "vitest";
import { restoreLateStatus } from "./long-running-fetch";

const mk = (body: string, headers: Record<string, string>, status = 200) => new Response(body, { status, headers });
const LR = { "X-Long-Running": "1", "Content-Type": "application/json; charset=utf-8" };

describe("restoreLateStatus", () => {
  it("recupera el código de error enviado tras el latido", async () => {
    const r = await restoreLateStatus(mk('   {"error":"falló","__httpStatus":500}', LR));
    expect(r.status).toBe(500);
    expect(r.ok).toBe(false);
    expect(await r.json()).toEqual({ error: "falló", __httpStatus: 500 });
  });

  it("deja intactas las respuestas correctas", async () => {
    const r = await restoreLateStatus(mk('  {"ok":true}', LR));
    expect(r.status).toBe(200);
    expect(await r.json()).toEqual({ ok: true });
  });

  it("no toca respuestas normales ni streams", async () => {
    const plain = mk('{"a":1}', { "Content-Type": "application/json" });
    expect(await restoreLateStatus(plain)).toBe(plain);
    const sse = mk("data: x\n\n", { "X-Long-Running": "1", "Content-Type": "text/event-stream" });
    expect(await restoreLateStatus(sse)).toBe(sse);
  });

  it("ignora valores de estado no válidos", async () => {
    const r = await restoreLateStatus(mk('{"__httpStatus":"hola"}', LR));
    expect(r.status).toBe(200);
  });
});
