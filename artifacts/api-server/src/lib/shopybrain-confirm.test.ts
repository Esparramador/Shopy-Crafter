import { describe, expect, it } from "vitest";
import { requireConfirmation, type ConfirmSession } from "./shopybrain-helpers";

const preview = { summary: "borrar" };

describe("confirmación humana de acciones destructivas", () => {
  it("confirmed:true sin token (lo que podría escribir la IA) no basta", () => {
    const session: ConfirmSession = {};
    const r = requireConfirmation({ confirmed: true }, "delete_product", preview, session);
    expect(r?.requiresConfirmation).toBe(true);
    expect(r?.confirmToken).toMatch(/^[a-f0-9]{36}$/);
  });

  it("con el token emitido pasa una sola vez y solo para esa acción", () => {
    const session: ConfirmSession = {};
    const token = requireConfirmation({}, "delete_product", preview, session)!.confirmToken;
    expect(requireConfirmation({ confirmed: true, confirmToken: token }, "fix_code", preview, session)?.requiresConfirmation).toBe(true);
    const t2 = requireConfirmation({}, "delete_product", preview, session)!.confirmToken;
    expect(requireConfirmation({ confirmed: true, confirmToken: t2 }, "delete_product", preview, session)).toBeNull();
    expect(requireConfirmation({ confirmed: true, confirmToken: t2 }, "delete_product", preview, session)?.requiresConfirmation).toBe(true);
  });

  it("acciones no destructivas no piden nada", () => {
    expect(requireConfirmation({}, "list_products", preview, {})).toBeNull();
  });
});
