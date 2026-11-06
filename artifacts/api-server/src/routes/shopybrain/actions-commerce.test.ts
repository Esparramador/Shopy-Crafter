import { beforeEach, describe, expect, it, vi } from "vitest";

const withPlatform = vi.fn();

vi.mock("../../lib/platform-helper.js", () => ({
  withPlatform: (...args: unknown[]) => withPlatform(...args),
  getProjectPlatformType: vi.fn(),
}));

import { runCommerceActions } from "./actions-commerce.js";

function context(action: string, params: Record<string, unknown>) {
  return {
    action,
    params,
    req: { headers: {}, session: {} },
    res: {},
    resolveStripeAccountId: vi.fn(),
  } as any;
}

describe("acciones de tienda de ShopyBrain con connector simulado", () => {
  beforeEach(() => withPlatform.mockReset());

  it("no llama al conector sin confirmación", async () => {
    const result = await runCommerceActions(context("platform_create_product", {
      projectId: "41",
      title: "Producto de prueba",
    }));

    expect(result).toMatchObject({ requiresConfirmation: true });
    expect(withPlatform).not.toHaveBeenCalled();
  });
});
