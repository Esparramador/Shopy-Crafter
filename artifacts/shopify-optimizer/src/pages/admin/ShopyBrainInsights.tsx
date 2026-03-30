import { useState, useEffect } from "react";
import { Brain, Zap, TrendingUp, AlertTriangle, Lightbulb, Link } from "lucide-react";

const API_BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

const DOMAIN_ICONS: Record<string, string> = {
  ecommerce: "🛒", shopify_technical: "⚙️", financial_analysis: "💰",
  trading_markets: "📈", investment: "💎", marketing: "📣",
  sales: "🎯", design_ux: "🎨", merchandising: "🏪",
  seo_content: "🔍", logistics: "📦", paid_media: "💸",
  consumer_psychology: "🧠", pricing_science: "💱",
};

const INSIGHT_TYPE_CONFIG: Record<string, { color: string; icon: any; label: string }> = {
  principle: { color: "#c8a84b", icon: Lightbulb, label: "Principio" },
  pattern: { color: "#5b4eff", icon: TrendingUp, label: "Patrón" },
  correlation: { color: "#06b6d4", icon: Link, label: "Correlación" },
  prediction: { color: "#2dd49f", icon: Zap, label: "Predicción" },
  opportunity: { color: "#f97316", icon: TrendingUp, label: "Oportunidad" },
  warning: { color: "#e84558", icon: AlertTriangle, label: "Alerta" },
  contradiction: { color: "#8b5cf6", icon: Brain, label: "Contradicción" },
};

interface Domain {
  id: string; domain: string; label: string; knowledgeDepth: number;
  totalInsights: number; verifiedInsights: number;
}
interface Insight {
  id: string; domain: string; insightType: string; title: string;
  insight: string; evidence?: string; confidence: number; impactScore: number;
  timesApplied: number; successRate: number;
}

export default function ShopyBrainInsights() {
  const [domains, setDomains] = useState<Domain[]>([]);
  const [insights, setInsights] = useState<Insight[]>([]);
  const [selectedDomain, setSelectedDomain] = useState<string>("");
  const [loading, setLoading] = useState(true);

  const load = (domain?: string) => {
    setLoading(true);
    const params = domain ? `?domain=${domain}` : "";
    fetch(`${API_BASE}/api/shopybrain/insights${params}`, { credentials: "include" })
      .then(r => r.json())
      .then(d => {
        setDomains(d.domains ?? []);
        setInsights(d.insights ?? []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const handleDomainSelect = (domain: string) => {
    const next = selectedDomain === domain ? "" : domain;
    setSelectedDomain(next);
    load(next || undefined);
  };

  return (
    <div style={{ maxWidth: 1100, margin: "0 auto" }}>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 22, fontWeight: 800 }}>⚡ Knowledge Domains</h1>
        <p style={{ fontSize: 13, color: "var(--t2)", marginTop: 3 }}>
          14 áreas de expertise donde Shopy Crafter acumula conocimiento profundo
        </p>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))", gap: 10, marginBottom: 24 }}>
        {domains.map(d => (
          <button
            key={d.domain}
            onClick={() => handleDomainSelect(d.domain)}
            style={{
              background: selectedDomain === d.domain ? "rgba(200,168,75,0.12)" : "var(--ink2)",
              border: `1px solid ${selectedDomain === d.domain ? "var(--gold)" : "var(--bdr)"}`,
              borderRadius: 10, padding: "12px 14px", cursor: "pointer", textAlign: "left",
              transition: "all 0.15s",
            }}
          >
            <div style={{ fontSize: 20, marginBottom: 6 }}>{DOMAIN_ICONS[d.domain] ?? "🧩"}</div>
            <div style={{ fontSize: 11, fontWeight: 700, marginBottom: 4, lineHeight: 1.3 }}>{d.label}</div>
            <div style={{ height: 3, background: "var(--ink4)", borderRadius: 2, overflow: "hidden", marginBottom: 4 }}>
              <div style={{ height: "100%", background: "linear-gradient(90deg, var(--gold), var(--jade))", width: `${d.knowledgeDepth ?? 0}%` }} />
            </div>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span style={{ fontSize: 10, color: "var(--t3)" }}>{d.knowledgeDepth ?? 0}% exp.</span>
              <span style={{ fontSize: 10, color: "var(--jade)" }}>{d.totalInsights ?? 0} ins.</span>
            </div>
          </button>
        ))}
      </div>

      <div className="glass-card">
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
          <h3 style={{ fontSize: 14, fontWeight: 700 }}>
            {selectedDomain
              ? `Insights: ${domains.find(d => d.domain === selectedDomain)?.label ?? selectedDomain}`
              : "Todos los insights"}
          </h3>
          <span style={{ fontSize: 12, color: "var(--t3)" }}>{insights.length} insights</span>
        </div>

        {loading ? (
          <div style={{ textAlign: "center", padding: "40px 0", color: "var(--t3)" }}>Cargando...</div>
        ) : insights.length === 0 ? (
          <div style={{ textAlign: "center", padding: "40px 0" }}>
            <Brain size={40} style={{ opacity: 0.3, marginBottom: 12, display: "block", margin: "0 auto 12px" }} />
            <p style={{ color: "var(--t3)", fontSize: 13 }}>
              Sin insights para este dominio aún.<br />
              Lanza una sesión de estudio desde el dashboard de Shopy Crafter.
            </p>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {insights.map(ins => {
              const cfg = INSIGHT_TYPE_CONFIG[ins.insightType] ?? INSIGHT_TYPE_CONFIG.principle;
              const Icon = cfg.icon;
              return (
                <div key={ins.id} style={{ padding: "14px 16px", background: "var(--ink3)", borderRadius: 8, borderLeft: `3px solid ${cfg.color}` }}>
                  <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
                    <Icon size={16} color={cfg.color} style={{ marginTop: 2, flexShrink: 0 }} />
                    <div style={{ flex: 1 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                        <span style={{ fontSize: 13, fontWeight: 700 }}>{ins.title}</span>
                        <span style={{ fontSize: 10, padding: "2px 6px", borderRadius: 4, background: `${cfg.color}22`, color: cfg.color }}>{cfg.label}</span>
                        <span style={{ marginLeft: "auto", fontSize: 11, color: ins.confidence >= 0.7 ? "var(--jade)" : "var(--t3)" }}>
                          {Math.round(ins.confidence * 100)}% conf.
                        </span>
                      </div>
                      <p style={{ fontSize: 12, color: "var(--t)", lineHeight: 1.6, marginBottom: 4 }}>{ins.insight}</p>
                      {ins.evidence && (
                        <p style={{ fontSize: 11, color: "var(--t3)", fontStyle: "italic" }}>📎 {ins.evidence}</p>
                      )}
                      <div style={{ display: "flex", gap: 12, marginTop: 6 }}>
                        <span style={{ fontSize: 10, color: "var(--t3)" }}>Impacto: {Math.round(ins.impactScore * 100)}%</span>
                        <span style={{ fontSize: 10, color: "var(--t3)" }}>Dominio: {ins.domain}</span>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
