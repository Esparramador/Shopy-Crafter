import { describe, expect, it } from "vitest";
import { cssFontName, escapeHtmlDeep } from "./html-escape";

describe("escapeHtmlDeep", () => {
  it("escapa cadenas anidadas y claves, conserva números y null", () => {
    const input = {
      name: '<img src=x onerror="alert(1)">',
      list: ["<b>ok</b>", 3, null],
      nested: { "<k>": "a & b" },
      score: 85,
    };
    expect(escapeHtmlDeep(input)).toEqual({
      name: "&lt;img src=x onerror=&quot;alert(1)&quot;&gt;",
      list: ["&lt;b&gt;ok&lt;/b&gt;", 3, null],
      nested: { "&lt;k&gt;": "a &amp; b" },
      score: 85,
    });
  });
});

describe("cssFontName", () => {
  it("deja solo caracteres seguros para CSS", () => {
    expect(cssFontName("Playfair Display")).toBe("Playfair Display");
    expect(cssFontName("Inter',serif;background:url(//evil)")).toBe("Interserifbackgroundurlevil");
    expect(cssFontName("Montserrat-Bold")).toBe("Montserrat-Bold");
  });
});
