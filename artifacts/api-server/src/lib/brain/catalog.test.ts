// Catálogo único de ShopyBrain: cada acción con runner tiene descripción, cada
// puerta tiene su lista blanca y lo que se abre a client/public no depende de la
// cookie de admin.
import { readFile } from "node:fs/promises";
import { describe, expect, it, vi } from "vitest";

// Importar el catálogo carga todos los runners; ninguno debe tocar la BD aquí.
vi.mock("@workspace/db", () => new Proxy({}, { has: () => true, get: (_t, k) => (k === "then" ? undefined : {}) }));
import { BRAIN_ACTIONS } from "../../routes/shopybrain/dispatch.js";
import { DESTRUCTIVE_ACTIONS } from "../shopybrain-helpers.js";
import { CATALOG_LINES } from "./catalog-docs.js";
import {
  GATE_ALLOWLIST, buildActionCatalogText, getBrainCatalog, isActionAllowed, isNativeAction,
} from "./catalog.js";

const documented = CATALOG_LINES.filter((l): l is readonly [string, string] => typeof l !== "string").map(l => l[0]);

describe("catálogo de acciones", () => {
  it("cada acción de BRAIN_ACTIONS tiene descripción y no hay descripciones sin runner", () => {
    expect(BRAIN_ACTIONS.filter(a => !documented.includes(a))).toEqual([]);
    expect(documented.filter(a => !BRAIN_ACTIONS.includes(a))).toEqual([]);
    expect(new Set(documented).size).toBe(documented.length);
    for (const a of getBrainCatalog()) expect(a.description, a.name).not.toBe("");
  });

  it("por defecto una acción es solo de admin", () => {
    const refund = getBrainCatalog().find(a => a.name === "stripe_create_refund")!;
    expect(refund.gates).toEqual(["admin"]);
    expect(refund.destructive).toBe(true);
    expect(isActionAllowed("stripe_create_refund", "public")).toBe(false);
    expect(isActionAllowed("stripe_create_refund", "client")).toBe(false);
    expect(isActionAllowed("list_users", "client")).toBe(false);
    expect(isActionAllowed("stripe_create_refund", "admin")).toBe(true);
  });

  it("listas blancas: public solo abre leads; client lee su tienda y pide al equipo", () => {
    expect(getBrainCatalog("public").map(a => a.name)).toEqual(["create_lead"]);
    expect(getBrainCatalog("client").map(a => a.name).sort()).toEqual([...GATE_ALLOWLIST.client].sort());
    expect(isActionAllowed("create_lead", "public")).toBe(true);
    expect(isActionAllowed("platform_get_orders", "client")).toBe(true);
    // Las propias de cada puerta no son del admin (tiene send_message y los leads del panel).
    expect(isActionAllowed("create_lead", "admin")).toBe(false);
    expect(isActionAllowed("request_team", "public")).toBe(false);
  });

  it("nada destructivo fuera de admin", () => {
    for (const gate of ["client", "public"] as const) {
      for (const a of GATE_ALLOWLIST[gate]) expect(DESTRUCTIVE_ACTIONS.has(a), `${gate}:${a}`).toBe(false);
    }
  });

  it("las acciones de runner abiertas a client/public no usan req ni la cookie de admin", async () => {
    const dir = new URL("../../routes/shopybrain/", import.meta.url);
    const files = ["actions-store.ts", "actions-theme.ts", "actions-platform.ts", "actions-growth.ts",
      "actions-creative.ts", "actions-knowledge.ts", "actions-admin.ts", "actions-commerce.ts"];
    const sources = await Promise.all(files.map(f => readFile(new URL(f, dir), "utf8")));
    const open = [...GATE_ALLOWLIST.client, ...GATE_ALLOWLIST.public].filter(a => !isNativeAction(a));
    expect(open.length).toBeGreaterThan(0);
    for (const action of open) {
      const src = sources.find(s => s.includes(`case "${action}":`));
      expect(src, action).toBeDefined();
      const start = src!.indexOf(`case "${action}":`);
      const next = src!.indexOf("\n        case \"", start + 1);
      const block = src!.slice(start, next === -1 ? undefined : next);
      expect(block, action).not.toMatch(/\breq\b|\bres\b|cookie|resolveStripeAccountId/);
    }
  });

  it("el texto del prompt: admin conserva el catálogo de siempre, public solo ve lo suyo", () => {
    const admin = buildActionCatalogText("admin");
    expect(admin).toContain("  - store_status: Ver estado de la tienda. Params: {projectId}");
    expect(admin).toContain("── 💳 STRIPE — Gestión completa");
    for (const a of BRAIN_ACTIONS) expect(admin).toContain(`  - ${a}: `);
    const pub = buildActionCatalogText("public");
    expect(pub).toContain("- create_lead:");
    expect(pub).not.toContain("stripe_");
    expect(pub.split("\n")).toHaveLength(1);
  });
});
