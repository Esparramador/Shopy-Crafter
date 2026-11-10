import { beforeEach, describe, expect, it, vi } from "vitest";
import { FALLBACK_ACTION_CATALOG, formatActionCatalog, loadAdminActionCatalog, resetActionCatalogCache } from "./brain-catalog";

const ok = (body: unknown) => Promise.resolve(new Response(JSON.stringify(body), { status: 200, headers: { "Content-Type": "application/json" } }));

beforeEach(() => resetActionCatalogCache());

describe("formatActionCatalog", () => {
  it("una línea por acción, con las destructivas marcadas", () => {
    const text = formatActionCatalog({ gate: "admin", actions: [
      { name: "generate_video", description: "Vídeo corto. Params: {projectId, prompt}", destructive: false, gates: ["admin"] },
      { name: "delete_product", description: "Borrar producto", destructive: true, gates: ["admin"] },
    ] });
    expect(text).toContain("(catálogo de ShopyBrain, 2)");
    expect(text).toContain("- generate_video → Vídeo corto. Params: {projectId, prompt}");
    expect(text).toMatch(/- delete_product → Borrar producto \[DESTRUCTIVA/);
  });

  it("null si no hay acciones válidas", () => {
    expect(formatActionCatalog(null)).toBeNull();
    expect(formatActionCatalog({ actions: [] })).toBeNull();
    expect(formatActionCatalog({ actions: [{ description: "sin nombre" }] })).toBeNull();
    expect(formatActionCatalog({ error: "No autorizado" })).toBeNull();
  });
});

describe("loadAdminActionCatalog", () => {
  it("usa el catálogo del cerebro y lo pide una sola vez", async () => {
    const f = vi.fn(() => ok({ actions: [{ name: "create_product", description: "Crear producto" }] }));
    const a = await loadAdminActionCatalog(f as unknown as typeof fetch);
    const b = await loadAdminActionCatalog(f as unknown as typeof fetch);
    expect(a).toContain("- create_product → Crear producto");
    expect(b).toBe(a);
    expect(f).toHaveBeenCalledTimes(1);
    expect(String((f.mock.calls[0] as unknown[])[0])).toContain("/api/shopybrain/catalog?gate=admin");
  });

  it("respaldo si la API falla, responde 401 o trae basura, y reintenta la próxima vez", async () => {
    const down = vi.fn(() => Promise.reject(new Error("offline")));
    expect(await loadAdminActionCatalog(down as unknown as typeof fetch)).toBe(FALLBACK_ACTION_CATALOG);
    const unauthorized = vi.fn(() => Promise.resolve(new Response("{}", { status: 401 })));
    expect(await loadAdminActionCatalog(unauthorized as unknown as typeof fetch)).toBe(FALLBACK_ACTION_CATALOG);
    const junk = vi.fn(() => ok({ actions: "nope" }));
    expect(await loadAdminActionCatalog(junk as unknown as typeof fetch)).toBe(FALLBACK_ACTION_CATALOG);
    expect([down, unauthorized, junk].every(f => f.mock.calls.length === 1)).toBe(true);
  });
});
