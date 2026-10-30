import { describe, expect, it } from "vitest";
import { buildSiteThemeCss, extractSiteTheme } from "./site-theme";

describe("tema del CMS como CSS", () => {
  it("genera variables de app y landing con colores válidos", () => {
    const css = buildSiteThemeCss({ primaryColor: "#c9a961", accentColor: "#2a7a4b" });
    expect(css).toContain("--gold: #c9a961;");
    expect(css).toContain("--l-gold: #c9a961;");
    expect(css).toContain("--jade: #2a7a4b;");
    expect(css).not.toContain("@import");
  });

  it("ignora valores que no son colores ni nombres de fuente (no inyecta CSS)", () => {
    const css = buildSiteThemeCss({ primaryColor: "red;} body{display:none", font_heading: "x'); @import url(evil" });
    expect(css).not.toMatch(/display:none|evil/);
    expect(css).toContain("Tema por defecto");
  });

  it("carga las fuentes elegidas", () => {
    const css = buildSiteThemeCss(extractSiteTheme({ site: { font_heading: "Playfair Display", font_body: "Inter" } }));
    expect(css).toContain("family=Playfair+Display");
    expect(css).toContain("--fb: 'Inter', sans-serif;");
  });
});
