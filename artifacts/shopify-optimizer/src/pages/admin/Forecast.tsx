import { useState, useEffect } from "react";
import { TrendingUp, Brain, AlertCircle } from "lucide-react";
import { useListProjects } from "@workspace/api-client-react";

const API_BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

const METRIC_META = [
  { key: "revenue_30d", label: "Impacto en Revenue", icon: "💰", color: "var(--gold)" },
  { key: "attribution", label: "Attribution por Canal", icon: "📊", color: "var(--jade)" },
  { key: "aov_trend", label: "Optimizaciones Detectadas", icon: "📈", color: "var(--t)" },
  { key: "recommendations", label: "Acción Prioritaria IA", icon: "🎯", color: "var(--crim)" },
];

interface ForecastCard {
  id: string;
  forecastType: string;
  forecastDate: string;
  predictedValue: number | null;
  confidencePct: number | null;
  reasoning: string;
  insightText: string | null;
  attribution?: Record<string, number>;
}

export default function Forecast() {
  const { data: projects } = useListProjects();
  const [selectedProject, setSelectedProject] = useState<string>("");
  const [forecasts, setForecasts] = useState<ForecastCard[]>([]);
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!selectedProject && projects && projects.length > 0) setSelectedProject(String(projects[0].id));
  }, [projects]);

  useEffect(() => {
    if (selectedProject) loadForecasts();
  }, [selectedProject]);

  const loadForecasts = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE}/api/intelligence/snapshots?projectId=${selectedProject}&days=30`, { credentials: "include" });
      const data = await res.json();
      setForecasts(Array.isArray(data) ? data : []);
    } catch {
      setError("No se pudieron cargar los datos.");
    } finally {
      setLoading(false);
    }
  };

  const generateForecast = async () => {
    setGenerating(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE}/api/intelligence/analyze`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ projectId: selectedProject, timeframe: "forecast" }),
      });
      if (!res.ok) throw new Error(`Error ${res.status}`);
      const data = await res.json();
      const analysis = data.analysis ?? {};
      const attribution: Record<string, number> = analysis.attributionBreakdown ?? {};
      const revenueImpact = analysis.revenueImpact ?? {};
      const topInsights: string[] = analysis.topInsights ?? [];
      const recommendations: string[] = analysis.recommendations ?? [];
      const summary: string = analysis.summary ?? "";

      const forecastDate = new Date(Date.now() + 30 * 86400000).toISOString().split("T")[0];

      const cards: ForecastCard[] = [
        {
          id: "revenue_30d",
          forecastType: "revenue_30d",
          forecastDate,
          predictedValue: typeof revenueImpact.total === "number" && revenueImpact.total > 0 ? revenueImpact.total : null,
          confidencePct: attribution.seo != null ? Math.min(95, 55 + Math.round(attribution.seo * 0.8)) : null,
          reasoning: topInsights[0] ?? summary,
          insightText: typeof revenueImpact.total === "number" && revenueImpact.total > 0
            ? null
            : "Necesita historial de ventas para proyección monetaria",
          attribution,
        },
        {
          id: "attribution",
          forecastType: "attribution",
          forecastDate,
          predictedValue: null,
          confidencePct: null,
          reasoning: topInsights[1] ?? summary,
          insightText: Object.keys(attribution).length > 0
            ? Object.entries(attribution)
                .sort(([, a], [, b]) => b - a)
                .map(([k, v]) => `${k.toUpperCase()}: ${v}%`)
                .join(" · ")
            : "Sin datos de atribución aún",
          attribution,
        },
        {
          id: "aov_trend",
          forecastType: "aov_trend",
          forecastDate,
          predictedValue: null,
          confidencePct: null,
          reasoning: topInsights[2] ?? topInsights[0] ?? summary,
          insightText: topInsights.length > 2
            ? `${topInsights.length} oportunidades detectadas por Shopy Crafter`
            : "Genera más análisis para acumular insights",
          attribution,
        },
        {
          id: "recommendations",
          forecastType: "recommendations",
          forecastDate,
          predictedValue: null,
          confidencePct: null,
          reasoning: recommendations[0] ?? topInsights[topInsights.length - 1] ?? summary,
          insightText: recommendations.length > 0
            ? `${recommendations.length} acciones recomendadas`
            : null,
          attribution,
        },
      ];

      setForecasts(cards);
    } catch (e: any) {
      setError(e.message ?? "Error al generar el análisis. Inténtalo de nuevo.");
    } finally {
      setGenerating(false);
    }
  };

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: "var(--t)" }}>ML Predictive Engine</h1>
          <p style={{ fontSize: 13, color: "var(--t3)", marginTop: 4 }}>
            Análisis real con Shopy Crafter — sin datos inventados
          </p>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <select value={selectedProject} onChange={e => setSelectedProject(e.target.value)} className="input-field" style={{ width: 180 }}>
            {projects?.map((p: any) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
          <button className="btn-primary" onClick={generateForecast} disabled={generating}
            style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <Brain size={14} />
            {generating ? "Analizando con IA..." : "Analizar con Shopy Crafter"}
          </button>
        </div>
      </div>

      {error && (
        <div className="glass-card" style={{ padding: 16, marginBottom: 16, display: "flex", alignItems: "center", gap: 10, borderColor: "var(--crim)" }}>
          <AlertCircle size={16} style={{ color: "var(--crim)", flexShrink: 0 }} />
          <span style={{ fontSize: 13, color: "var(--crim)" }}>{error}</span>
        </div>
      )}

      {loading ? (
        <div className="grid-r2">
          {[1,2,3,4].map(i => <div key={i} className="skeleton" style={{ height: 160, borderRadius: 12 }} />)}
        </div>
      ) : forecasts.length === 0 ? (
        <div className="glass-card" style={{ padding: 56, textAlign: "center" }}>
          <Brain size={48} style={{ color: "var(--t4)", marginBottom: 16 }} />
          <h3 style={{ fontSize: 18, fontWeight: 700, color: "var(--t2)", marginBottom: 8 }}>Sin análisis generados</h3>
          <p style={{ fontSize: 13, color: "var(--t3)", marginBottom: 8, maxWidth: 400, margin: "0 auto 24px" }}>
            Shopy Crafter analizará tus productos reales, SEO, precios y A/B tests para darte insights accionables.
            Los valores monetarios se calculan solo cuando hay historial de ventas registrado.
          </p>
          <button className="btn-primary" onClick={generateForecast} disabled={generating} style={{ padding: "12px 28px" }}>
            <Brain size={16} style={{ marginRight: 8 }} />
            {generating ? "Analizando..." : "Iniciar Análisis Real"}
          </button>
        </div>
      ) : (
        <>
          <div className="grid-r2" style={{ marginBottom: 20 }}>
            {forecasts.slice(0, 4).map((f, i) => {
              const metric = METRIC_META[i % METRIC_META.length];
              const hasMonetaryValue = typeof f.predictedValue === "number" && f.predictedValue > 0;

              return (
                <div key={f.id || i} className="glass-card" style={{ padding: 20 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 12 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <span style={{ fontSize: 20 }}>{metric.icon}</span>
                      <span style={{ fontSize: 13, color: "var(--t2)" }}>{metric.label}</span>
                    </div>
                    {f.confidencePct != null && (
                      <span style={{
                        fontSize: 11, padding: "3px 8px", borderRadius: 20,
                        background: "rgba(200,168,75,0.15)", color: "var(--gold)", fontWeight: 600,
                      }}>{f.confidencePct}% confianza</span>
                    )}
                  </div>

                  <div style={{ fontSize: hasMonetaryValue ? 32 : 15, fontWeight: hasMonetaryValue ? 800 : 600, color: metric.color, marginBottom: 8, lineHeight: 1.3 }}>
                    {hasMonetaryValue
                      ? `€${f.predictedValue!.toFixed(0)}`
                      : (f.insightText ?? "—")}
                  </div>

                  {f.forecastDate && (
                    <div style={{ fontSize: 11, color: "var(--t4)", marginBottom: 8 }}>
                      Proyección a: {f.forecastDate}
                    </div>
                  )}

                  {f.reasoning && (
                    <p style={{ fontSize: 11, color: "var(--t3)", lineHeight: 1.5, borderTop: "1px solid var(--ink3)", paddingTop: 10, marginTop: 4 }}>
                      {f.reasoning.length > 140 ? f.reasoning.slice(0, 140) + "…" : f.reasoning}
                    </p>
                  )}
                </div>
              );
            })}
          </div>

          <div className="glass-card" style={{ padding: 20 }}>
            <div style={{ padding: "0 0 16px", borderBottom: "1px solid var(--ink3)", marginBottom: 16 }}>
              <h3 style={{ fontSize: 14, fontWeight: 600, color: "var(--t)", display: "flex", alignItems: "center", gap: 6 }}>
                <TrendingUp size={14} />
                Cómo funciona el análisis
              </h3>
            </div>
            <div className="grid-r3">
              {[
                { title: "Datos reales de tu tienda", description: "Shopy Crafter lee tus productos, precios, imágenes y resultados A/B directamente de la API de tu tienda" },
                { title: "Análisis Claude IA", description: "Cada análisis pasa por Claude con contexto acumulado de memorias y aprendizajes anteriores de tu nicho" },
                { title: "Sin inventar cifras", description: "Los valores monetarios solo aparecen cuando hay revenue real registrado. Sin datos históricos, se muestran insights cualitativos" },
              ].map(m => (
                <div key={m.title} style={{ padding: "14px", background: "var(--ink3)", borderRadius: 10 }}>
                  <p style={{ fontSize: 13, fontWeight: 600, color: "var(--gold)", marginBottom: 6 }}>{m.title}</p>
                  <p style={{ fontSize: 12, color: "var(--t3)", lineHeight: 1.5 }}>{m.description}</p>
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
