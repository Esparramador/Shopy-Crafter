import { describe, expect, it } from "vitest";
import { EFFECT_SNIPPETS, buildEffectPreviewHtml, applyDna, DEFAULT_DNA } from "./visme-effects";

describe("efectos CSS/JS", () => {
  it("ningún efecto deja marcadores __X__ sin sustituir", () => {
    for (const s of EFFECT_SNIPPETS) {
      const html = buildEffectPreviewHtml(s);
      expect(html.match(/__[A-Z][A-Z0-9_]*__/g), s.id).toBeNull();
    }
  });

  it("los ES modules no se cargan como <script> clásico", () => {
    for (const s of EFFECT_SNIPPETS) {
      expect(buildEffectPreviewHtml(s), s.id).not.toMatch(/<script src="[^"]+\.module\.js">/);
    }
  });

  it("sin atributos HTML con comillas rotas", () => {
    for (const s of EFFECT_SNIPPETS) {
      expect(s.html, s.id).not.toMatch(/="[^"]*""/);
    }
  });

  it("el fondo de la vista previa va en <html> (no tapa fondos fixed con z-index -1)", () => {
    const html = buildEffectPreviewHtml(EFFECT_SNIPPETS[0]);
    expect(html).toMatch(/html\{background:/);
    expect(html).toMatch(/body\{background:transparent/);
  });

  it("precio y ADN de marca se sustituyen", () => {
    expect(applyDna("__PRICE__ __NAME__", { ...DEFAULT_DNA, price: "19,90 €", name: "Luna" })).toBe("19,90 € Luna");
  });
});
