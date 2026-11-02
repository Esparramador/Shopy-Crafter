import { describe, it, expect } from "vitest";
import { ADMIN_NAV_SECTIONS, buildAdminNav, sectionForPath } from "./admin-nav";

// Todos los enlaces que tenía el menú antes de reorganizarlo: no se pierde ninguno.
const PREVIOUS_HREFS = [
  "/admin/shopybrain", "/admin/command-center", "/admin/shopybrain/memories", "/admin/shopybrain/insights",
  "/admin/brain-sync", "/admin/shopybrain/study", "/admin/my-pricing", "/admin/emails", "/admin/email-flows",
  "/admin/cms", "/admin/prompt-library", "/web-lab", "/web-designer", "/effects-studio", "/fusion-studio",
  "/fusion-studio-pro", "/ad-studio", "/cards", "/campaign-kit", "/exploded-view", "/generator", "/exports",
  "/suppliers", "/admin/vault", "/admin/search", "/admin/template-studio", "/admin/avatar-studio",
  "/admin/youtube-studio", "/admin/calendar", "/admin/meshy-studio", "/tripo3d", "/admin/mcp-manager",
  "/admin/security-lab", "/admin/amr-studio", "/admin/skills-library", "/admin/design-systems",
  "/admin/plugins-catalog", "/admin/hyperframes", "/admin/deck-builder", "/home", "/audit", "/redesign",
  "/images", "/consistency", "/ab-testing", "/pricing", "/seo", "/vault", "/client", "/admin/clients",
  "/admin/messages", "/admin/group-chat", "/admin/products", "/admin/abtests", "/admin/automations",
  "/admin/revenue", "/admin/billing", "/admin/tienda", "/admin/portfolio", "/admin/shop", "/admin/stripe",
  "/admin/stripe-master", "/admin/api-keys", "/admin/agency-billing", "/admin/intelligence",
  "/admin/gemini-intel", "/admin/inventory", "/admin/competitors", "/admin/forecast", "/admin/achievements",
  "/admin/roadmap", "/admin/apk", "/tienda", "/admin/ai-catalog", "/admin/api-usage", "/admin/system",
  "/help/connections",
];

describe("menú del panel", () => {
  const hrefs = ADMIN_NAV_SECTIONS.flatMap(s => s.items.map(i => i.href));

  it("conserva todos los enlaces anteriores, cada uno una sola vez", () => {
    expect(new Set(hrefs).size).toBe(hrefs.length);
    expect([...PREVIOUS_HREFS].sort()).toEqual([...hrefs].sort());
  });

  it("el CMS renombra, oculta y añade enlaces propios en «Más»", () => {
    const nav = buildAdminNav([
      [{ label: "IA Brain", icon: "🤖", href: "/admin/shopybrain" }, { label: "── X ──", href: "#", divider: true }],
      [{ label: "Logros", href: "/admin/achievements", hidden: true }, { label: "Mi enlace", href: "/admin/otra" }],
    ]);
    const all = nav.flatMap(s => s.items);
    expect(all.find(i => i.href === "/admin/shopybrain")).toMatchObject({ label: "IA Brain", icon: "🤖" });
    expect(all.some(i => i.href === "/admin/achievements")).toBe(false);
    expect(nav.at(-1)).toMatchObject({ id: "mas", items: [{ href: "/admin/otra", label: "Mi enlace" }] });
    expect(all.some(i => i.href === "#")).toBe(false);
  });

  it("abre la sección de la ruta actual (la coincidencia más larga)", () => {
    expect(sectionForPath(ADMIN_NAV_SECTIONS, "/admin/shopybrain/memories")).toBe("cerebro");
    expect(sectionForPath(ADMIN_NAV_SECTIONS, "/admin/stripe-master")).toBe("ventas");
    expect(sectionForPath(ADMIN_NAV_SECTIONS, "/nada")).toBeNull();
  });
});
