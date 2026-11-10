export const CONTACT_PREREPORT_SECTIONS = ["business", "market", "seo", "suppliers"] as const;

export type ContactPrereportSection = typeof CONTACT_PREREPORT_SECTIONS[number];
export type ContactPrereportResearchEngine =
  | "claude-anthropic"
  | "gemini-fallback"
  | "unavailable"
  | "unknown";
export type ContactPrereportFinalizationEngine = "claude-anthropic" | "raw-research" | "unknown";
export type ContactPrereportSupplementalEngine = "claude-anthropic" | "unavailable" | "unknown";
export type ContactPrereportEngineSummary =
  | "claude-anthropic"
  | "gemini-fallback"
  | "mixed"
  | "partial"
  | "failed"
  | "unknown";

export interface ContactPrereportEngineAttribution {
  summary: {
    overall: ContactPrereportEngineSummary;
    claudeSections: ContactPrereportSection[];
    geminiFallbackSections: ContactPrereportSection[];
    unavailableSections: ContactPrereportSection[];
    unknownSections: ContactPrereportSection[];
  };
  researchBySection: Record<ContactPrereportSection, ContactPrereportResearchEngine>;
  finalizationBySection: Record<ContactPrereportSection, ContactPrereportFinalizationEngine>;
  supplemental: {
    marketMetrics: ContactPrereportSupplementalEngine;
    productSample: ContactPrereportSupplementalEngine;
  };
}

export interface GeneratedContactPrereport {
  html: string;
  engineAttribution: ContactPrereportEngineAttribution;
}

const RESEARCH_ENGINES = new Set<ContactPrereportResearchEngine>([
  "claude-anthropic",
  "gemini-fallback",
  "unavailable",
  "unknown",
]);
const FINALIZATION_ENGINES = new Set<ContactPrereportFinalizationEngine>([
  "claude-anthropic",
  "raw-research",
  "unknown",
]);
const SUPPLEMENTAL_ENGINES = new Set<ContactPrereportSupplementalEngine>([
  "claude-anthropic",
  "unavailable",
  "unknown",
]);

export function createContactPrereportEngineAttribution(input: {
  researchBySection: Record<ContactPrereportSection, ContactPrereportResearchEngine>;
  finalizationBySection?: Partial<Record<ContactPrereportSection, ContactPrereportFinalizationEngine>>;
  supplemental?: Partial<ContactPrereportEngineAttribution["supplemental"]>;
}): ContactPrereportEngineAttribution {
  const claudeSections = CONTACT_PREREPORT_SECTIONS.filter(
    section => input.researchBySection[section] === "claude-anthropic",
  );
  const geminiFallbackSections = CONTACT_PREREPORT_SECTIONS.filter(
    section => input.researchBySection[section] === "gemini-fallback",
  );
  const unavailableSections = CONTACT_PREREPORT_SECTIONS.filter(
    section => input.researchBySection[section] === "unavailable",
  );
  const unknownSections = CONTACT_PREREPORT_SECTIONS.filter(
    section => input.researchBySection[section] === "unknown",
  );
  const knownEngines = new Set(
    [...claudeSections.map(() => "claude-anthropic"), ...geminiFallbackSections.map(() => "gemini-fallback")],
  );

  let overall: ContactPrereportEngineSummary;
  if (knownEngines.size === 0) {
    overall = unavailableSections.length > 0 ? "failed" : "unknown";
  } else if (unavailableSections.length > 0 || unknownSections.length > 0) {
    overall = "partial";
  } else if (knownEngines.size > 1) {
    overall = "mixed";
  } else if (knownEngines.has("claude-anthropic")) {
    overall = "claude-anthropic";
  } else if (knownEngines.has("gemini-fallback")) {
    overall = "gemini-fallback";
  } else {
    overall = "unknown";
  }

  return {
    summary: { overall, claudeSections, geminiFallbackSections, unavailableSections, unknownSections },
    researchBySection: { ...input.researchBySection },
    finalizationBySection: {
      business: input.finalizationBySection?.business ?? "unknown",
      market: input.finalizationBySection?.market ?? "unknown",
      seo: input.finalizationBySection?.seo ?? "unknown",
      suppliers: input.finalizationBySection?.suppliers ?? "unknown",
    },
    supplemental: {
      marketMetrics: input.supplemental?.marketMetrics ?? "unknown",
      productSample: input.supplemental?.productSample ?? "unknown",
    },
  };
}

export function unknownContactPrereportEngineAttribution(): ContactPrereportEngineAttribution {
  return createContactPrereportEngineAttribution({
    researchBySection: {
      business: "unknown",
      market: "unknown",
      seo: "unknown",
      suppliers: "unknown",
    },
    finalizationBySection: {
      business: "unknown",
      market: "unknown",
      seo: "unknown",
      suppliers: "unknown",
    },
    supplemental: { marketMetrics: "unknown", productSample: "unknown" },
  });
}

export function parseContactPrereportEngineAttribution(value: unknown): ContactPrereportEngineAttribution {
  if (!value || typeof value !== "object") return unknownContactPrereportEngineAttribution();
  const raw = value as Record<string, unknown>;
  const rawResearch = raw.researchBySection && typeof raw.researchBySection === "object"
    ? raw.researchBySection as Record<string, unknown>
    : {};
  const rawFinalization = raw.finalizationBySection && typeof raw.finalizationBySection === "object"
    ? raw.finalizationBySection as Record<string, unknown>
    : {};
  const rawSupplemental = raw.supplemental && typeof raw.supplemental === "object"
    ? raw.supplemental as Record<string, unknown>
    : {};

  const researchBySection = Object.fromEntries(CONTACT_PREREPORT_SECTIONS.map(section => [
    section,
    RESEARCH_ENGINES.has(rawResearch[section] as ContactPrereportResearchEngine)
      ? rawResearch[section]
      : "unknown",
  ])) as Record<ContactPrereportSection, ContactPrereportResearchEngine>;
  const finalizationBySection = Object.fromEntries(CONTACT_PREREPORT_SECTIONS.map(section => [
    section,
    FINALIZATION_ENGINES.has(rawFinalization[section] as ContactPrereportFinalizationEngine)
      ? rawFinalization[section]
      : "unknown",
  ])) as Record<ContactPrereportSection, ContactPrereportFinalizationEngine>;

  const supplementalValue = (key: keyof ContactPrereportEngineAttribution["supplemental"]) =>
    SUPPLEMENTAL_ENGINES.has(rawSupplemental[key] as ContactPrereportSupplementalEngine)
      ? rawSupplemental[key] as ContactPrereportSupplementalEngine
      : "unknown";

  return createContactPrereportEngineAttribution({
    researchBySection,
    finalizationBySection,
    supplemental: {
      marketMetrics: supplementalValue("marketMetrics"),
      productSample: supplementalValue("productSample"),
    },
  });
}
