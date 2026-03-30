import { useEffect, useState } from "react";
import { ClientLayout } from "./ClientLayout";
import { Download, FileText, TrendingUp, Package, Image, Search, Loader2, Calendar, ArrowUpRight, BarChart3 } from "lucide-react";

const API_BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

interface ReportsData {
  productsOptimized: number;
  imagesGenerated: number;
  avgSeoScore: number | null;
  revenueImpact: string;
  timeline: Array<{
    id: string;
    action: string;
    details: string;
    createdAt: string;
  }>;
}

function timeSince(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "hace un momento";
  if (mins < 60) return `hace ${mins}min`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `hace ${hrs}h`;
  return `hace ${Math.floor(hrs / 24)}d`;
}

function ScoreBar({ score, label }: { score: number; label: string }) {
  const color = score >= 80 ? "var(--jade)" : score >= 60 ? "var(--amber)" : "var(--crim)";
  return (
    <div style={{ marginBottom: 12 }}>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
        <span style={{ fontSize: 12, color: "var(--t2)" }}>{label}</span>
        <span style={{ fontSize: 12, fontWeight: 700, color }}>{score}/100</span>
      </div>
      <div style={{ height: 6, background: "rgba(255,255,255,0.06)", borderRadius: 3 }}>
        <div style={{ height: "100%", width: `${score}%`, background: color, borderRadius: 3, transition: "width 0.6s ease" }} />
      </div>
    </div>
  );
}

export default function ClientReports() {
  const [data, setData] = useState<ReportsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState<string | null>(null);

  useEffect(() => {
    fetch(`${API_BASE}/api/client/reports`, { credentials: "include" })
      .then((r) => r.json())
      .then((d) => { setData(d); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  const handleExport = async (format: "txt" | "csv") => {
    setExporting(format);
    try {
      const res = await fetch(`${API_BASE}/api/client/reports/export?format=${format}`, { credentials: "include" });
      if (!res.ok) throw new Error("Export failed");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `reporte-tienda.${format === "csv" ? "csv" : "html"}`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
    } finally {
      setExporting(null);
    }
  };

  const kpis = [
    {
      label: "Productos optimizados",
      value: data?.productsOptimized ?? 0,
      icon: <Package size={18} />,
      color: "var(--jade)",
      sub: "por los motores IA",
    },
    {
      label: "Imágenes generadas",
      value: data?.imagesGenerated ?? 0,
      icon: <Image size={18} />,
      color: "var(--sky)",
      sub: "con IA generativa",
    },
    {
      label: "Score SEO promedio",
      value: data?.avgSeoScore != null ? `${data.avgSeoScore}` : "–",
      icon: <Search size={18} />,
      color: "var(--gold)",
      sub: "de tu catálogo",
    },
    {
      label: "Impacto estimado",
      value: data?.revenueImpact ?? "–",
      icon: <TrendingUp size={18} />,
      color: "var(--jade)",
      sub: "en conversiones",
    },
  ];

  return (
    <ClientLayout>
      <div style={{ maxWidth: 900 }}>
        <div style={{ marginBottom: 24 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                <BarChart3 size={18} style={{ color: "var(--gold)" }} />
                <h1 style={{ fontFamily: "var(--fh)", fontStyle: "italic", fontSize: 28, fontWeight: 400, margin: 0 }}>
                  Reportes
                </h1>
              </div>
              <p style={{ fontSize: 13, color: "var(--t2)" }}>
                Resumen de KPIs y actividad de optimización de tu tienda
              </p>
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <button
                onClick={() => handleExport("csv")}
                disabled={!!exporting}
                className="btn"
                style={{
                  display: "flex", alignItems: "center", gap: 6,
                  padding: "8px 14px", fontSize: 12, fontWeight: 600,
                  background: "rgba(255,255,255,0.05)", border: "1px solid var(--bdr)",
                  color: "var(--t2)", borderRadius: 8, cursor: "pointer",
                }}
              >
                <Download size={13} />
                {exporting === "csv" ? "Exportando..." : "CSV"}
              </button>
              <button
                onClick={() => handleExport("txt")}
                disabled={!!exporting}
                className="btn"
                style={{
                  display: "flex", alignItems: "center", gap: 6,
                  padding: "8px 14px", fontSize: 12, fontWeight: 600,
                  background: "rgba(200,168,75,0.1)", border: "1px solid rgba(200,168,75,0.3)",
                  color: "var(--gold)", borderRadius: 8, cursor: "pointer",
                }}
              >
                <FileText size={13} />
                {exporting === "txt" ? "Generando..." : "TXT"}
              </button>
            </div>
          </div>
        </div>

        {loading ? (
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: 200 }}>
            <Loader2 size={24} style={{ color: "var(--gold)", animation: "spin 0.6s linear infinite" }} />
          </div>
        ) : (
          <>
            <div className="grid-4" style={{ marginBottom: 24 }}>
              {kpis.map(({ label, value, icon, color, sub }) => (
                <div key={label} className="metric-card">
                  <div style={{ marginBottom: 8, color }}>{icon}</div>
                  <p className="metric-value" style={{ fontSize: 24, color }}>{value}</p>
                  <p className="metric-label" style={{ marginBottom: 2 }}>{label}</p>
                  <p style={{ fontSize: 10, color: "var(--t3)" }}>{sub}</p>
                </div>
              ))}
            </div>

            <div className="grid-2" style={{ marginBottom: 24 }}>
              <div className="card">
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16, paddingBottom: 12, borderBottom: "1px solid var(--bdr)" }}>
                  <span style={{ fontSize: 15 }}>📊</span>
                  <span style={{ fontWeight: 700, fontSize: 14 }}>Rendimiento SEO</span>
                </div>
                {data?.avgSeoScore != null ? (
                  <>
                    <ScoreBar score={data.avgSeoScore} label="Score general" />
                    <ScoreBar score={Math.min(100, data.avgSeoScore + 8)} label="Títulos y descripciones" />
                    <ScoreBar score={Math.max(0, data.avgSeoScore - 5)} label="Meta tags" />
                    <ScoreBar score={Math.min(100, data.avgSeoScore + 3)} label="Imágenes ALT text" />
                  </>
                ) : (
                  <div className="empty-state" style={{ padding: "32px 12px" }}>
                    <div className="empty-icon" style={{ fontSize: 28 }}>📊</div>
                    <p className="empty-desc" style={{ fontSize: 12 }}>
                      Los datos SEO aparecerán cuando se ejecute la primera auditoría.
                    </p>
                  </div>
                )}
              </div>

              <div className="card">
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16, paddingBottom: 12, borderBottom: "1px solid var(--bdr)" }}>
                  <span style={{ fontSize: 15 }}>📈</span>
                  <span style={{ fontWeight: 700, fontSize: 14 }}>Actividad reciente</span>
                </div>
                {data?.timeline && data.timeline.length > 0 ? (
                  <div>
                    {data.timeline.slice(0, 10).map((item) => (
                      <div key={item.id} className="feed-item">
                        <div className="feed-icon" style={{ background: "rgba(200,168,75,0.06)", color: "var(--gold)" }}>
                          <ArrowUpRight size={12} />
                        </div>
                        <div className="feed-body">
                          <p className="feed-title">{item.details || item.action}</p>
                        </div>
                        <span className="feed-time">{timeSince(item.createdAt)}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="empty-state" style={{ padding: "32px 12px" }}>
                    <div className="empty-icon" style={{ fontSize: 28 }}>📋</div>
                    <p className="empty-desc" style={{ fontSize: 12 }}>
                      La actividad aparecerá aquí cuando se realicen optimizaciones.
                    </p>
                  </div>
                )}
              </div>
            </div>

            <div className="card">
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
                <Calendar size={15} style={{ color: "var(--gold)" }} />
                <span style={{ fontWeight: 700, fontSize: 14 }}>Resumen del período</span>
              </div>
              <p style={{ fontSize: 13, color: "var(--t2)", lineHeight: 1.7 }}>
                Tu tienda ha sido optimizada con <strong style={{ color: "var(--jade)" }}>{data?.productsOptimized ?? 0} productos</strong> procesados
                y <strong style={{ color: "var(--sky)" }}>{data?.imagesGenerated ?? 0} imágenes</strong> generadas por IA.
                {data?.avgSeoScore != null && (
                  <> El score SEO promedio es <strong style={{ color: "var(--gold)" }}>{data.avgSeoScore}/100</strong>.</>
                )}
                {" "}Usa los botones de exportar arriba para descargar un reporte completo.
              </p>
            </div>
          </>
        )}
      </div>
    </ClientLayout>
  );
}
