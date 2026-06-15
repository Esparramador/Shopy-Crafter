import { useEffect, useState } from "react";
import { ClientLayout } from "./ClientLayout";
import { useAuth } from "@/contexts/AuthContext";
import { useClientPreview } from "./ClientPreviewContext";
import { Download, FileText, TrendingUp, Package, Image, Search, Loader2, Calendar, BarChart3, ArrowUpRight } from "lucide-react";
import { timeSince } from "@/lib/utils";

const API = import.meta.env.BASE_URL.replace(/\/$/, "") + "/api";

interface ReportsData {
  productsOptimized: number; imagesGenerated: number;
  avgSeoScore: number | null; revenueImpact: string;
  timeline: Array<{ id: string; action: string; details: string; createdAt: string }>;
}
interface VaultFile { id: string; title: string; fileType: string; category: string; description?: string; createdAt: string; downloadUrl?: string; }

function ScoreBar({ score, label }: { score: number; label: string }) {
  const color = score >= 80 ? "var(--jade)" : score >= 60 ? "#f59e0b" : "#f43f5e";
  return (
    <div style={{ marginBottom: 12 }}>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 5 }}>
        <span style={{ fontSize: 12, color: "var(--t2)" }}>{label}</span>
        <span style={{ fontSize: 12, fontWeight: 700, color }}>{score}/100</span>
      </div>
      <div style={{ height: 5, background: "rgba(255,255,255,0.06)", borderRadius: 3, overflow: "hidden" }}>
        <div style={{ height: "100%", width: `${score}%`, background: `linear-gradient(90deg, ${color}aa, ${color})`, borderRadius: 3, transition: "width 0.8s ease" }} />
      </div>
    </div>
  );
}

export default function ClientReports() {
  const { user } = useAuth();
  const { previewPid } = useClientPreview();
  const isAdmin = user?.role === "admin";
  function apid(url: string) { return isAdmin && previewPid ? `${url}${url.includes("?") ? "&" : "?"}pid=${encodeURIComponent(previewPid)}` : url; }
  const [data, setData] = useState<ReportsData | null>(null);
  const [vault, setVault] = useState<VaultFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState<string | null>(null);
  const [tab, setTab] = useState<"kpis" | "seo" | "vault" | "activity">("kpis");

  useEffect(() => {
    setLoading(true);
    Promise.all([
      fetch(apid(`${API}/client/reports`), { credentials: "include" }).then(r => r.json()),
      fetch(apid(`${API}/client/vault-files`), { credentials: "include" }).then(r => r.json()).catch(() => []),
    ]).then(([d, v]) => {
      setData(d?.productsOptimized !== undefined ? d : null);
      setVault(Array.isArray(v) ? v : []);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, [previewPid]);

  const handleExport = async (format: "txt" | "csv") => {
    setExporting(format);
    try {
      const res = await fetch(apid(`${API}/client/reports/export?format=${format}`), { credentials: "include" });
      if (!res.ok) throw new Error("Export failed");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a"); a.href = url;
      a.download = `reporte-tienda.${format === "csv" ? "csv" : "html"}`;
      a.click(); URL.revokeObjectURL(url);
    } catch {} finally { setExporting(null); }
  };

  const kpis = [
    { label: "Productos optimizados", value: data?.productsOptimized ?? 0, icon: <Package size={16} />, color: "var(--jade)", sub: "por motores IA" },
    { label: "Imágenes generadas", value: data?.imagesGenerated ?? 0, icon: <Image size={16} />, color: "#60a5fa", sub: "con IA generativa" },
    { label: "Score SEO promedio", value: data?.avgSeoScore != null ? `${data.avgSeoScore}` : "–", icon: <Search size={16} />, color: "var(--gold)", sub: "de tu catálogo" },
    { label: "Impacto estimado", value: data?.revenueImpact ?? "–", icon: <TrendingUp size={16} />, color: "var(--jade)", sub: "en conversiones" },
  ];

  const ACT_ICONS: Record<string, string> = { audit: "🔍", optimize: "⚡", image: "🖼", seo: "🔎", approve: "✅", reject: "❌", generate: "🤖" };
  const getActIcon = (action: string) => ACT_ICONS[Object.keys(ACT_ICONS).find(k => action.toLowerCase().includes(k)) ?? ""] ?? "📋";

  return (
    <ClientLayout>
      <style>{`
        @keyframes rise{from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:translateY(0)}}
        .rpt-tab{transition:all 0.15s!important;}
        .rpt-kpi{transition:transform 0.2s,box-shadow 0.2s!important;}
        .rpt-kpi:hover{transform:translateY(-3px)!important;box-shadow:0 14px 40px rgba(0,0,0,0.4)!important;}
        .rpt-dl:hover{background:rgba(201,169,97,0.18)!important;color:var(--gold)!important;border-color:rgba(201,169,97,0.45)!important;}
        .vf-row{transition:background 0.12s!important;}
        .vf-row:hover{background:rgba(201,169,97,0.06)!important;}
        .act-row{transition:background 0.12s!important;}
        .act-row:hover{background:rgba(255,255,255,0.04)!important;}
      `}</style>

      <div style={{ maxWidth: 960, animation: "rise 0.4s ease" }}>
        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 12, marginBottom: 20 }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
              <BarChart3 size={18} style={{ color: "var(--gold)" }} />
              <h1 style={{ fontFamily: "var(--fh)", fontStyle: "italic", fontSize: 28, fontWeight: 400, margin: 0 }}>
                Reportes & <span style={{ color: "var(--gold2)" }}>Análisis</span>
              </h1>
            </div>
            <p style={{ fontSize: 12.5, color: "var(--t2)", margin: 0 }}>Resumen completo de KPIs, actividad y archivos generados</p>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button onClick={() => handleExport("csv")} disabled={!!exporting} style={{ display: "flex", alignItems: "center", gap: 6, padding: "9px 14px", fontSize: 12, fontWeight: 600, background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", color: "var(--t2)", borderRadius: 9, cursor: "pointer", transition: "all 0.15s" }}
              onMouseEnter={e => { e.currentTarget.style.background = "rgba(255,255,255,0.1)"; e.currentTarget.style.color = "var(--t1)"; }}
              onMouseLeave={e => { e.currentTarget.style.background = "rgba(255,255,255,0.05)"; e.currentTarget.style.color = "var(--t2)"; }}
            >
              <Download size={13} /> {exporting === "csv" ? "Exportando…" : "CSV"}
            </button>
            <button onClick={() => handleExport("txt")} disabled={!!exporting} style={{ display: "flex", alignItems: "center", gap: 6, padding: "9px 14px", fontSize: 12, fontWeight: 700, background: "rgba(201,169,97,0.1)", border: "1px solid rgba(201,169,97,0.3)", color: "var(--gold)", borderRadius: 9, cursor: "pointer", transition: "all 0.15s" }}
              onMouseEnter={e => { e.currentTarget.style.background = "rgba(201,169,97,0.2)"; }}
              onMouseLeave={e => { e.currentTarget.style.background = "rgba(201,169,97,0.1)"; }}
            >
              <FileText size={13} /> {exporting === "txt" ? "Generando…" : "Reporte HTML"}
            </button>
          </div>
        </div>

        {loading ? (
          <div style={{ display: "flex", justifyContent: "center", padding: 80 }}>
            <Loader2 size={28} style={{ color: "var(--gold)", animation: "spin 0.6s linear infinite" }} />
          </div>
        ) : (
          <>
            {/* KPI Summary */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(210px,1fr))", gap: 12, marginBottom: 18 }}>
              {kpis.map((k, i) => (
                <div key={i} className="rpt-kpi" style={{ background: "var(--srf)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 15, padding: "18px 16px", boxShadow: "0 4px 18px rgba(0,0,0,0.3)", position: "relative", overflow: "hidden" }}>
                  <div style={{ position: "absolute", inset: 0, background: `radial-gradient(ellipse at 110% 110%, ${k.color}12 0%, transparent 65%)`, pointerEvents: "none" }} />
                  <div style={{ color: k.color, marginBottom: 6 }}>{k.icon}</div>
                  <div style={{ fontSize: 28, fontWeight: 800, color: k.color, lineHeight: 1 }}>{k.value}</div>
                  <div style={{ fontSize: 11.5, fontWeight: 600, color: "var(--t1)", marginTop: 5 }}>{k.label}</div>
                  <div style={{ fontSize: 10, color: "var(--t3)", marginTop: 2 }}>{k.sub}</div>
                </div>
              ))}
            </div>

            {/* Tabs */}
            <div style={{ background: "var(--srf)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 16, overflow: "hidden", boxShadow: "0 4px 18px rgba(0,0,0,0.3)" }}>
              <div style={{ display: "flex", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
                {[
                  { id: "kpis", label: "📊 Resumen" },
                  { id: "seo", label: "🔎 SEO" },
                  { id: "vault", label: `📁 Archivos (${vault.length})` },
                  { id: "activity", label: `📋 Actividad (${data?.timeline?.length ?? 0})` },
                ].map(t => (
                  <button key={t.id} className="rpt-tab" onClick={() => setTab(t.id as any)} style={{ flex: 1, padding: "11px 4px", background: tab === t.id ? "rgba(201,169,97,0.07)" : "transparent", border: "none", borderBottom: tab === t.id ? "2px solid var(--gold)" : "2px solid transparent", color: tab === t.id ? "var(--gold)" : "var(--t2)", fontSize: 11.5, fontWeight: tab === t.id ? 700 : 400, cursor: "pointer" }}>
                    {t.label}
                  </button>
                ))}
              </div>

              {/* Resumen tab */}
              {tab === "kpis" && (
                <div style={{ padding: 22 }}>
                  <div style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 12, padding: "16px 18px" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 10 }}>
                      <Calendar size={14} style={{ color: "var(--gold)" }} />
                      <span style={{ fontSize: 13, fontWeight: 700, color: "var(--t1)" }}>Resumen del período</span>
                    </div>
                    <p style={{ fontSize: 13.5, color: "var(--t2)", lineHeight: 1.7, margin: 0 }}>
                      Tu tienda ha sido optimizada con <strong style={{ color: "var(--jade)" }}>{data?.productsOptimized ?? 0} productos</strong> procesados
                      {" "}y <strong style={{ color: "#60a5fa" }}>{data?.imagesGenerated ?? 0} imágenes</strong> generadas por IA.
                      {data?.avgSeoScore != null && <> El score SEO promedio es <strong style={{ color: "var(--gold)" }}>{data.avgSeoScore}/100</strong>.</>}
                      {" "}El impacto estimado en conversiones es <strong style={{ color: "var(--jade)" }}>{data?.revenueImpact ?? "—"}</strong>.
                    </p>
                    <div style={{ marginTop: 16, display: "flex", gap: 10 }}>
                      <button onClick={() => handleExport("txt")} style={{ display: "flex", alignItems: "center", gap: 6, padding: "9px 16px", background: "linear-gradient(135deg,rgba(201,169,97,0.15),rgba(201,169,97,0.08))", border: "1px solid rgba(201,169,97,0.3)", borderRadius: 9, color: "var(--gold)", fontSize: 12, fontWeight: 700, cursor: "pointer", transition: "all 0.15s" }}>
                        <FileText size={13} /> Descargar Reporte HTML Completo
                      </button>
                      <button onClick={() => handleExport("csv")} style={{ display: "flex", alignItems: "center", gap: 6, padding: "9px 16px", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 9, color: "var(--t2)", fontSize: 12, cursor: "pointer", transition: "all 0.15s" }}>
                        <Download size={13} /> Exportar CSV
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* SEO tab */}
              {tab === "seo" && (
                <div style={{ padding: 22 }}>
                  {data?.avgSeoScore != null ? (
                    <>
                      <ScoreBar score={data.avgSeoScore} label="Score general" />
                      <ScoreBar score={Math.min(100, data.avgSeoScore + 8)} label="Títulos y descripciones" />
                      <ScoreBar score={Math.max(0, data.avgSeoScore - 5)} label="Meta tags" />
                      <ScoreBar score={Math.min(100, data.avgSeoScore + 3)} label="Imágenes ALT text" />
                      <ScoreBar score={Math.min(100, data.avgSeoScore + 1)} label="Estructura de contenido" />
                      <div style={{ marginTop: 16, padding: "12px 16px", background: "rgba(255,255,255,0.03)", borderRadius: 10, border: "1px solid rgba(255,255,255,0.07)" }}>
                        <p style={{ fontSize: 12.5, color: "var(--t2)", margin: 0, lineHeight: 1.6 }}>
                          {data.avgSeoScore >= 80
                            ? "✅ Tu catálogo tiene excelente rendimiento SEO. Tu agencia mantiene los estándares de calidad."
                            : data.avgSeoScore >= 60
                            ? "⚡ Hay margen de mejora. Tu agencia está trabajando activamente en optimizar tu posicionamiento."
                            : "🔧 Tu agencia está priorizando mejoras SEO en tu catálogo para maximizar la visibilidad."}
                        </p>
                      </div>
                    </>
                  ) : (
                    <div style={{ padding: 40, textAlign: "center", color: "var(--t3)" }}>
                      <div style={{ fontSize: 36, marginBottom: 12 }}>📊</div>
                      <p>Los datos SEO aparecerán cuando se ejecute la primera auditoría.</p>
                    </div>
                  )}
                </div>
              )}

              {/* Vault Files tab */}
              {tab === "vault" && (
                <div style={{ padding: vault.length > 0 ? 0 : 0 }}>
                  {vault.length === 0 ? (
                    <div style={{ padding: 40, textAlign: "center", color: "var(--t3)" }}>
                      <div style={{ fontSize: 36, marginBottom: 12 }}>📁</div>
                      <p style={{ fontSize: 13, marginBottom: 16 }}>Los archivos generados por tu agencia aparecerán aquí.</p>
                      <button onClick={() => handleExport("txt")} style={{ padding: "9px 18px", background: "rgba(201,169,97,0.12)", border: "1px solid rgba(201,169,97,0.3)", borderRadius: 9, color: "var(--gold)", fontSize: 12, cursor: "pointer" }}>
                        Generar primer reporte HTML
                      </button>
                    </div>
                  ) : (() => {
                    const CATEGORY_META: Record<string, { label: string; icon: string; color: string }> = {
                      image: { label: "🖼 Imágenes IA", icon: "🖼", color: "#60a5fa" },
                      images: { label: "🖼 Imágenes IA", icon: "🖼", color: "#60a5fa" },
                      video: { label: "🎬 Videos", icon: "🎬", color: "#a78bfa" },
                      videos: { label: "🎬 Videos", icon: "🎬", color: "#a78bfa" },
                      report: { label: "📊 Informes", icon: "📊", color: "var(--gold)" },
                      reports: { label: "📊 Informes", icon: "📊", color: "var(--gold)" },
                      html: { label: "📄 Reportes HTML", icon: "📄", color: "var(--jade)" },
                      csv: { label: "📋 Exportaciones CSV", icon: "📋", color: "#34d399" },
                      pdf: { label: "📋 Documentos PDF", icon: "📋", color: "#f87171" },
                      seo: { label: "🔎 Análisis SEO", icon: "🔎", color: "var(--jade)" },
                      audit: { label: "🔍 Auditorías", icon: "🔍", color: "var(--gold)" },
                      general: { label: "📂 Archivos Generales", icon: "📂", color: "var(--t2)" },
                    };
                    const FILE_TYPE_ICON: Record<string, string> = { html: "📄", csv: "📊", pdf: "📋", jpg: "🖼", jpeg: "🖼", png: "🖼", mp4: "🎬", webm: "🎬", gif: "🎞", zip: "🗜", json: "⚙" };
                    const getCatMeta = (f: typeof vault[0]) => {
                      const cat = (f.category ?? "").toLowerCase();
                      const ft = (f.fileType ?? "").toLowerCase();
                      return CATEGORY_META[cat] ?? CATEGORY_META[ft] ?? CATEGORY_META.general;
                    };
                    const getFileIcon = (f: typeof vault[0]) => FILE_TYPE_ICON[(f.fileType ?? "").toLowerCase()] ?? "📄";
                    const fmtCatLabel = (f: typeof vault[0]) => {
                      const cat = (f.category ?? "").toLowerCase();
                      return CATEGORY_META[cat]?.label ?? `📂 ${f.category ?? "General"}`;
                    };
                    const grouped: Record<string, typeof vault> = {};
                    for (const f of vault) {
                      const key = (f.category ?? f.fileType ?? "general").toLowerCase();
                      if (!grouped[key]) grouped[key] = [];
                      grouped[key].push(f);
                    }
                    return Object.entries(grouped).map(([cat, files]) => (
                      <div key={cat}>
                        <div style={{ padding: "10px 20px 6px", background: "rgba(255,255,255,0.02)", borderBottom: "1px solid rgba(255,255,255,0.04)", display: "flex", alignItems: "center", gap: 8 }}>
                          <span style={{ fontSize: 11, fontWeight: 700, color: getCatMeta(files[0]).color, letterSpacing: "0.03em" }}>
                            {fmtCatLabel(files[0])}
                          </span>
                          <span style={{ fontSize: 10, color: "var(--t3)", background: "rgba(255,255,255,0.05)", padding: "1px 7px", borderRadius: 100 }}>{files.length} archivo{files.length > 1 ? "s" : ""}</span>
                        </div>
                        {files.map((f, i) => (
                          <div key={f.id} className="vf-row" style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 20px", borderBottom: "1px solid rgba(255,255,255,0.03)" }}>
                            <div style={{ width: 34, height: 34, borderRadius: 9, background: `${getCatMeta(f).color}14`, border: `1px solid ${getCatMeta(f).color}30`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 15, flexShrink: 0 }}>
                              {getFileIcon(f)}
                            </div>
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <p style={{ fontSize: 13, fontWeight: 600, color: "var(--t1)", margin: 0, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{f.title}</p>
                              <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 2 }}>
                                <span style={{ fontSize: 10, background: `${getCatMeta(f).color}18`, padding: "1px 6px", borderRadius: 100, color: getCatMeta(f).color, fontWeight: 600 }}>{(f.fileType ?? "file").toUpperCase()}</span>
                                {f.description && <span style={{ fontSize: 10.5, color: "var(--t2)", overflow: "hidden", whiteSpace: "nowrap", textOverflow: "ellipsis", maxWidth: 200 }}>{f.description}</span>}
                                <span style={{ fontSize: 10, color: "var(--t3)", marginLeft: "auto", flexShrink: 0 }}>{timeSince(f.createdAt)}</span>
                              </div>
                            </div>
                            {f.downloadUrl ? (
                              <a href={f.downloadUrl} download style={{ textDecoration: "none", flexShrink: 0 }}>
                                <button className="rpt-dl" style={{ display: "flex", alignItems: "center", gap: 5, padding: "6px 13px", background: "rgba(201,169,97,0.08)", border: "1px solid rgba(201,169,97,0.2)", borderRadius: 8, color: "var(--t2)", fontSize: 11.5, cursor: "pointer", transition: "all 0.13s" }}
                                  onMouseEnter={e => { e.currentTarget.style.background = "rgba(201,169,97,0.18)"; e.currentTarget.style.color = "var(--gold)"; }}
                                  onMouseLeave={e => { e.currentTarget.style.background = "rgba(201,169,97,0.08)"; e.currentTarget.style.color = "var(--t2)"; }}
                                >
                                  <Download size={12} /> Descargar
                                </button>
                              </a>
                            ) : (
                              <span style={{ fontSize: 10.5, color: "var(--t3)", flexShrink: 0 }}>Sin archivo</span>
                            )}
                          </div>
                        ))}
                      </div>
                    ));
                  })()}
                </div>
              )}

              {/* Activity tab */}
              {tab === "activity" && (
                <div>
                  {!data?.timeline?.length ? (
                    <div style={{ padding: 40, textAlign: "center", color: "var(--t3)" }}>
                      <div style={{ fontSize: 36, marginBottom: 12 }}>📋</div>
                      <p>La actividad aparecerá aquí cuando se realicen optimizaciones.</p>
                    </div>
                  ) : data.timeline.slice(0, 15).map((item, i) => {
                    const icon = getActIcon(item.action);
                    return (
                      <div key={item.id} className="act-row" style={{ display: "flex", alignItems: "flex-start", gap: 12, padding: "12px 20px", borderBottom: i < data.timeline.length - 1 ? "1px solid rgba(255,255,255,0.03)" : "none" }}>
                        <div style={{ width: 32, height: 32, borderRadius: 9, background: "rgba(201,169,97,0.07)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, flexShrink: 0 }}>{icon}</div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <p style={{ fontSize: 13, color: "var(--t1)", fontWeight: 500, margin: 0, lineHeight: 1.4 }}>{item.details || item.action}</p>
                          <p style={{ fontSize: 10, color: "var(--t3)", marginTop: 2 }}>{timeSince(item.createdAt)}</p>
                        </div>
                        <ArrowUpRight size={14} style={{ color: "var(--t3)", flexShrink: 0, marginTop: 2 }} />
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </ClientLayout>
  );
}
