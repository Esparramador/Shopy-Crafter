// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { cleanHtml, escapeHtml } from "./sanitize";

describe("sanitize", () => {
  it("escapeHtml deja el HTML como texto", () => {
    expect(escapeHtml(`<img src=x onerror="alert(1)">`)).toBe("&lt;img src=x onerror=&quot;alert(1)&quot;&gt;");
    expect(escapeHtml(null)).toBe("");
  });

  it("cleanHtml quita scripts y manejadores pero deja el formato", () => {
    const out = cleanHtml(`<p onclick="x()">Hola <strong>mundo</strong><script>alert(1)</script><img src=x onerror="y()"></p>`);
    expect(out).toContain("<strong>mundo</strong>");
    expect(out).not.toMatch(/script|onclick|onerror/);
  });
});
