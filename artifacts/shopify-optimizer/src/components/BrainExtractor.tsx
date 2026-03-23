import { useState, useRef } from "react";
import { Brain, Loader2, Sparkles, ChevronDown, ChevronUp, Zap, Target, TrendingUp, Search } from "lucide-react";

const API_BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

interface BrainIntelligence {
  entityType?: string;
  brandName?: string;
  brandDNA?: {
    essence?: string;
    positioning?: string;
    tone?: string;
    personality?: string[];
    archetype?: string;
  };
  market?: {
    niche?: string;
    targetAudience?: string;
    geography?: string[];
    pricePoint?: string;
    competitors?: string[];
  };
  seo?: {
    primaryKeywords?: string[];
    longTailKeywords?: string[];
  };
  growth?: {
    opportunities?: string[];
    quickWins?: string[];
    scalingStrategy?: string;
  };
  intelligence?: {
    summary?: string;
    uniqueInsight?: string;
    confidenceScore?: number;
    dataQuality?: string;
  };
  autofill?: {
    storeNiche?: string;
    brandTone?: string;
    targetAudience?: string;
    storeMarkets?: string;
    projectName?: string;
  };
}

interface ExtractResult {
  ok: boolean;
  inputType: string;
  hasWebData: boolean;
  webTitle?: string;
  intelligence: BrainIntelligence;
}

interface BrainExtractorProps {
  value: string;
  fieldContext?: string;
  projectId?: number;
  onAutofill?: (data: Record<string, string>) => void;
  inline?: boolean;
}

export default function BrainExtractor({ value, fieldContext, projectId, onAutofill, inline }: BrainExtractorProps) {
  const [state, setState] = useState<"idle" | "loading" | "done" | "error">("idle");
  const [result, setResult] = useState<ExtractResult | null>(null);
  const [expanded, setExpanded] = useState(true);
  const abortRef = useRef<AbortController | null>(null);

  const extract = async () => {
    if (!value?.trim() || state === "loading") return;
    abortRef.current?.abort();
    abortRef.current = new AbortController();
    setState("loading");
    setResult(null);

    try {
      const res = await fetch(`${API_BASE}/api/intelligence/extract-input`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        signal: abortRef.current.signal,
        body: JSON.stringify({ input: value.trim(), projectId, fieldContext }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Error");
      setResult(data);
      setState("done");
    } catch (e: any) {
      if (e.name !== "AbortError") setState("error");
    }
  };

  const applyAutofill = () => {
    if (result?.intelligence?.autofill && onAutofill) {
      const fillData: Record<string, string> = {};
      const af = result.intelligence.autofill;
      if (af.storeNiche) fillData.storeNiche = af.storeNiche;
      if (af.brandTone) fillData.brandTone = af.brandTone;
      if (af.targetAudience) fillData.targetAudience = af.targetAudience;
      if (af.storeMarkets) fillData.storeMarkets = af.storeMarkets;
      if (af.projectName) fillData.name = af.projectName;
      onAutofill(fillData);
    }
  };

  const conf = result?.intelligence?.intelligence?.confidenceScore ?? 0;
  const confColor = conf >= 0.8 ? "#22c55e" : conf >= 0.6 ? "#d4a017" : "#f59e0b";

  return (
    <div style={{ marginTop: 6 }}>
      {/* Trigger button */}
      {state === "idle" && value?.trim().length >= 2 && (
        <button
          type="button"
          onClick={extract}
          style={{
            display: "inline-flex", alignItems: "center", gap: 6,
            padding: "5px 12px", borderRadius: 20,
            background: "linear-gradient(135deg, rgba(212,160,23,0.15), rgba(33,197,94,0.1))",
            border: "1px solid rgba(212,160,23,0.4)",
            color: "var(--gold)", fontSize: 12, cursor: "pointer",
            fontFamily: "var(--fb)", transition: "all 0.2s",
          }}
          onMouseOver={e => { e.currentTarget.style.background = "linear-gradient(135deg, rgba(212,160,23,0.25), rgba(33,197,94,0.15))"; }}
          onMouseOut={e => { e.currentTarget.style.background = "linear-gradient(135deg, rgba(212,160,23,0.15), rgba(33,197,94,0.1))"; }}
        >
          <Brain size={13} />
          ShopyBrain: Analizar y extraer inteligencia
        </button>
      )}

      {/* Loading state */}
      {state === "loading" && (
        <div style={{
          display: "flex", alignItems: "center", gap: 10,
          padding: "10px 16px", borderRadius: 10,
          background: "rgba(212,160,23,0.07)", border: "1px solid rgba(212,160,23,0.25)",
        }}>
          <div style={{ position: "relative", width: 28, height: 28 }}>
            <div style={{
              position: "absolute", inset: 0, borderRadius: "50%",
              background: "rgba(212,160,23,0.2)", animation: "pulse 1.5s infinite",
            }} />
            <Brain size={16} style={{ position: "absolute", top: 6, left: 6, color: "var(--gold)" }} />
          </div>
          <div>
            <p style={{ fontSize: 12, color: "var(--gold)", fontFamily: "var(--fb)", margin: 0 }}>ShopyBrain procesando...</p>
            <p style={{ fontSize: 11, color: "var(--t3)", margin: 0 }}>Extrayendo inteligencia de marca, SEO y mercado</p>
          </div>
          <Loader2 size={14} style={{ color: "var(--gold)", marginLeft: "auto", animation: "spin 1s linear infinite" }} />
        </div>
      )}

      {/* Error */}
      {state === "error" && (
        <p style={{ fontSize: 11, color: "#ef4444", marginTop: 4 }}>
          No se pudo extraer inteligencia. Verifica que el valor sea válido.
        </p>
      )}

      {/* Results */}
      {state === "done" && result && (
        <div style={{
          borderRadius: 12, overflow: "hidden",
          border: "1px solid rgba(212,160,23,0.3)",
          background: "rgba(0,0,0,0.35)",
          backdropFilter: "blur(8px)",
        }}>
          {/* Header */}
          <div
            style={{
              display: "flex", alignItems: "center", gap: 10,
              padding: "10px 14px", cursor: "pointer",
              background: "linear-gradient(90deg, rgba(212,160,23,0.12), rgba(33,197,94,0.08))",
              borderBottom: expanded ? "1px solid rgba(212,160,23,0.2)" : "none",
            }}
            onClick={() => setExpanded(!expanded)}
          >
            <Brain size={15} style={{ color: "var(--gold)" }} />
            <div style={{ flex: 1 }}>
              <p style={{ fontSize: 12, color: "var(--gold)", fontFamily: "var(--fb)", margin: 0 }}>
                {result.intelligence?.brandName
                  ? `${result.intelligence.brandName} — Perfil extraído`
                  : "Inteligencia extraída"}
              </p>
              <p style={{ fontSize: 11, color: "var(--t3)", margin: 0 }}>
                {result.hasWebData ? "Datos web reales" : "Análisis por conocimiento"} ·{" "}
                <span style={{ color: confColor }}>
                  {Math.round(conf * 100)}% confianza
                </span>
                {result.inputType && ` · ${result.inputType}`}
              </p>
            </div>
            {expanded ? <ChevronUp size={14} style={{ color: "var(--t3)" }} /> : <ChevronDown size={14} style={{ color: "var(--t3)" }} />}
          </div>

          {expanded && (
            <div style={{ padding: "14px 16px" }}>
              {/* Summary */}
              {result.intelligence?.intelligence?.summary && (
                <div style={{ marginBottom: 14, padding: "10px 12px", background: "rgba(212,160,23,0.06)", borderRadius: 8, borderLeft: "3px solid var(--gold)" }}>
                  <p style={{ fontSize: 12, color: "var(--t)", margin: 0, lineHeight: 1.5 }}>
                    {result.intelligence.intelligence.summary}
                  </p>
                </div>
              )}

              {/* Grid of intel cards */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 12 }}>
                {/* Brand DNA */}
                {result.intelligence?.brandDNA && (
                  <IntelCard icon={<Sparkles size={13} />} title="ADN de Marca">
                    {result.intelligence.brandDNA.essence && <InfoRow label="Esencia" value={result.intelligence.brandDNA.essence} />}
                    {result.intelligence.brandDNA.positioning && <InfoRow label="Posición" value={result.intelligence.brandDNA.positioning} />}
                    {result.intelligence.brandDNA.tone && <InfoRow label="Tono" value={result.intelligence.brandDNA.tone} />}
                    {result.intelligence.brandDNA.archetype && <InfoRow label="Arquetipo" value={result.intelligence.brandDNA.archetype} />}
                    {result.intelligence.brandDNA.personality && result.intelligence.brandDNA.personality.length > 0 && (
                      <div style={{ marginTop: 6, display: "flex", flexWrap: "wrap", gap: 4 }}>
                        {result.intelligence.brandDNA.personality.slice(0, 4).map((p, i) => (
                          <span key={i} style={{ fontSize: 10, padding: "2px 7px", borderRadius: 10, background: "rgba(212,160,23,0.15)", color: "var(--gold)" }}>{p}</span>
                        ))}
                      </div>
                    )}
                  </IntelCard>
                )}

                {/* Market */}
                {result.intelligence?.market && (
                  <IntelCard icon={<Target size={13} />} title="Mercado & Audiencia">
                    {result.intelligence.market.niche && <InfoRow label="Nicho" value={result.intelligence.market.niche} />}
                    {result.intelligence.market.targetAudience && <InfoRow label="Audiencia" value={result.intelligence.market.targetAudience} />}
                    {result.intelligence.market.pricePoint && <InfoRow label="Precio" value={result.intelligence.market.pricePoint} />}
                    {result.intelligence.market.geography && result.intelligence.market.geography.length > 0 && (
                      <InfoRow label="Mercados" value={result.intelligence.market.geography.join(", ")} />
                    )}
                    {result.intelligence.market.competitors && result.intelligence.market.competitors.length > 0 && (
                      <InfoRow label="Competidores" value={result.intelligence.market.competitors.slice(0, 3).join(", ")} />
                    )}
                  </IntelCard>
                )}

                {/* SEO */}
                {result.intelligence?.seo && (
                  <IntelCard icon={<Search size={13} />} title="SEO Intelligence">
                    {result.intelligence.seo.primaryKeywords && result.intelligence.seo.primaryKeywords.length > 0 && (
                      <div>
                        <p style={{ fontSize: 10, color: "var(--t3)", marginBottom: 4 }}>Keywords principales</p>
                        <div style={{ display: "flex", flexWrap: "wrap", gap: 3 }}>
                          {result.intelligence.seo.primaryKeywords.slice(0, 6).map((k, i) => (
                            <span key={i} style={{ fontSize: 10, padding: "2px 6px", borderRadius: 8, background: "rgba(33,197,94,0.12)", color: "#22c55e" }}>{k}</span>
                          ))}
                        </div>
                      </div>
                    )}
                    {result.intelligence.seo.longTailKeywords && result.intelligence.seo.longTailKeywords.length > 0 && (
                      <div style={{ marginTop: 6 }}>
                        <p style={{ fontSize: 10, color: "var(--t3)", marginBottom: 4 }}>Long-tail</p>
                        <div style={{ display: "flex", flexWrap: "wrap", gap: 3 }}>
                          {result.intelligence.seo.longTailKeywords.slice(0, 4).map((k, i) => (
                            <span key={i} style={{ fontSize: 10, padding: "2px 6px", borderRadius: 8, background: "rgba(212,160,23,0.1)", color: "var(--t2)" }}>{k}</span>
                          ))}
                        </div>
                      </div>
                    )}
                  </IntelCard>
                )}

                {/* Growth */}
                {result.intelligence?.growth && (
                  <IntelCard icon={<TrendingUp size={13} />} title="Crecimiento">
                    {result.intelligence.growth.quickWins && result.intelligence.growth.quickWins.length > 0 && (
                      <div>
                        <p style={{ fontSize: 10, color: "var(--t3)", marginBottom: 4 }}>Quick wins</p>
                        {result.intelligence.growth.quickWins.slice(0, 2).map((w, i) => (
                          <p key={i} style={{ fontSize: 11, color: "var(--t2)", margin: "2px 0", paddingLeft: 8, borderLeft: "2px solid var(--gold)" }}>{w}</p>
                        ))}
                      </div>
                    )}
                    {result.intelligence.growth.scalingStrategy && (
                      <div style={{ marginTop: 6 }}>
                        <p style={{ fontSize: 10, color: "var(--t3)", marginBottom: 2 }}>Estrategia de escalado</p>
                        <p style={{ fontSize: 11, color: "var(--t2)", margin: 0 }}>{result.intelligence.growth.scalingStrategy}</p>
                      </div>
                    )}
                  </IntelCard>
                )}
              </div>

              {/* Unique insight */}
              {result.intelligence?.intelligence?.uniqueInsight && (
                <div style={{ marginBottom: 12, padding: "9px 12px", background: "rgba(33,197,94,0.07)", borderRadius: 8, borderLeft: "3px solid #22c55e" }}>
                  <p style={{ fontSize: 11, color: "var(--t3)", margin: "0 0 3px", fontFamily: "var(--fb)" }}>
                    <Zap size={11} style={{ display: "inline", verticalAlign: "middle", marginRight: 4, color: "#22c55e" }} />
                    Insight único de ShopyBrain
                  </p>
                  <p style={{ fontSize: 12, color: "var(--t)", margin: 0, lineHeight: 1.5 }}>
                    {result.intelligence.intelligence.uniqueInsight}
                  </p>
                </div>
              )}

              {/* Autofill action */}
              {onAutofill && result.intelligence?.autofill && (
                <div style={{ display: "flex", gap: 8, marginTop: 4 }}>
                  <button
                    type="button"
                    onClick={applyAutofill}
                    style={{
                      display: "flex", alignItems: "center", gap: 6,
                      padding: "7px 14px", borderRadius: 8,
                      background: "linear-gradient(135deg, var(--gold), #b8860b)",
                      border: "none", color: "#000", fontSize: 12,
                      cursor: "pointer", fontFamily: "var(--fb)",
                    }}
                  >
                    <Zap size={12} />
                    Aplicar inteligencia al formulario
                  </button>
                  <button
                    type="button"
                    onClick={() => { setState("idle"); setResult(null); }}
                    style={{
                      padding: "7px 12px", borderRadius: 8,
                      background: "transparent", border: "1px solid var(--bdr)",
                      color: "var(--t3)", fontSize: 12, cursor: "pointer",
                    }}
                  >
                    Cerrar
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function IntelCard({ icon, title, children }: { icon: React.ReactNode; title: string; children: React.ReactNode }) {
  return (
    <div style={{ padding: "10px 12px", borderRadius: 8, background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)" }}>
      <p style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 11, color: "var(--t3)", fontFamily: "var(--fb)", margin: "0 0 8px" }}>
        <span style={{ color: "var(--gold)" }}>{icon}</span>
        {title}
      </p>
      {children}
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ marginBottom: 5 }}>
      <span style={{ fontSize: 10, color: "var(--t3)", fontFamily: "var(--fb)" }}>{label}: </span>
      <span style={{ fontSize: 11, color: "var(--t2)" }}>{value}</span>
    </div>
  );
}
