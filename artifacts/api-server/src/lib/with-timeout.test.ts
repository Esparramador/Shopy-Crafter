import { describe, expect, it } from "vitest";
import { withTimeout } from "./with-timeout";

describe("withTimeout", () => {
  it("devuelve el resultado si llega a tiempo", async () => {
    await expect(withTimeout(Promise.resolve(7), 1000, "x")).resolves.toBe(7);
  });
  it("falla con el nombre de la operación si tarda demasiado", async () => {
    await expect(withTimeout(new Promise(() => {}), 20, "subida")).rejects.toThrow(/Timeout .*subida/);
  });
});
