import { describe, expect, it } from "vitest";
import {
  createContactPrereportEngineAttribution,
  parseContactPrereportEngineAttribution,
  unknownContactPrereportEngineAttribution,
} from "./contact-prereport-attribution.js";

describe("contact pre-report engine attribution", () => {
  it("summarizes the actual research engine by section", () => {
    const attribution = createContactPrereportEngineAttribution({
      researchBySection: {
        business: "claude-anthropic",
        market: "gemini-fallback",
        seo: "claude-anthropic",
        suppliers: "gemini-fallback",
      },
    });

    expect(attribution.summary).toEqual({
      overall: "mixed",
      claudeSections: ["business", "seo"],
      geminiFallbackSections: ["market", "suppliers"],
      unavailableSections: [],
      unknownSections: [],
    });
  });

  it("marks an incomplete report when a section had no provider response", () => {
    const attribution = createContactPrereportEngineAttribution({
      researchBySection: {
        business: "claude-anthropic",
        market: "gemini-fallback",
        seo: "unavailable",
        suppliers: "claude-anthropic",
      },
    });

    expect(attribution.summary.overall).toBe("partial");
    expect(attribution.summary.unavailableSections).toEqual(["seo"]);
  });

  it("recomputes summary when parsing stored metadata and ignores invalid values", () => {
    const attribution = parseContactPrereportEngineAttribution({
      summary: { overall: "claude-anthropic", claudeSections: ["business"] },
      researchBySection: {
        business: "gemini-fallback",
        market: "invalid-provider",
        seo: "claude-anthropic",
        suppliers: "claude-anthropic",
      },
      finalizationBySection: { business: "raw-research", market: "claude-anthropic" },
      supplemental: { productSample: "claude-anthropic" },
    });

    expect(attribution.summary.overall).toBe("partial");
    expect(attribution.summary.unknownSections).toEqual(["market"]);
    expect(attribution.summary.claudeSections).toEqual(["seo", "suppliers"]);
    expect(attribution.researchBySection.market).toBe("unknown");
    expect(attribution.finalizationBySection.business).toBe("raw-research");
    expect(attribution.finalizationBySection.seo).toBe("unknown");
  });

  it("marks reports created before attribution was stored as unknown", () => {
    expect(unknownContactPrereportEngineAttribution().summary.overall).toBe("unknown");
    expect(parseContactPrereportEngineAttribution(null).researchBySection.business).toBe("unknown");
  });
});
