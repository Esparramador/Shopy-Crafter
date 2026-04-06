import { useState, useCallback } from "react";
import { useRoute } from "wouter";

const API_BASE = import.meta.env.BASE_URL?.replace(/\/$/, "") ?? "";

type ReportTemplate = "classic" | "elegance" | "prestige";

export function WebLabStandalone() {
  return <WebLabInner projectId={0} />;
}


interface WebLabAnalysis {
  overallScore: number;
  categories: {
    design: number;
    ux: number;
    responsive: number;
    accessibility: number;
    performance: number;
    consistency: number;
  };
  colorPalette: { current: string[]; improved: string[] };
  typography: { current: string[]; improved: string[] };
  structure: Array<{ section: string; element: string; issues: number }>;
  issues: Array<{
    selector: string;
    property: string;
    current: string;
    improved: string;
    severity: string;
    reason: string;
  }>;
  improvedCss: string;
  improvedHtmlFragments: Array<{ section: string; original: string; improved: string }>;
  summary: string;
}

interface AnalysisResult {
  analysis: WebLabAnalysis;
  reportHtml?: string;
  vaultIds: { report: number | null; css: number | null; html: number | null };
  pageSpeed: any;
  scraperData: any;
  url: string;
  template: string;
}

interface HistoryItem {
  id: number;
  title: string;
  description: string;
  originalUrl: string;
  createdAt: string;
  metadata: any;
}

const phases = [
  { label: "Extrayendo HTML + CSS", icon: "🔬" },
  { label: "PageSpeed Insights", icon: "⚡" },
  { label: "Estructura y SEO", icon: "🔍" },
  { label: "Análisis IA profundo", icon: "🧠" },
];

const categoryLabels: Record<string, string> = {
  design: "Diseño",
  ux: "UX",
  responsive: "Responsive",
  accessibility: "Accesibilidad",
  performance: "Performance",
  consistency: "Consistencia",
};

const categoryIcons: Record<string, string> = {
  design: "🎨",
  ux: "🖱️",
  responsive: "📱",
  accessibility: "♿",
  performance: "⚡",
  consistency: "🎯",
};

const sevColors: Record<string, string> = {
  critical: "#ef4444",
  high: "#f97316",
  medium: "#eab308",
  low: "#22c55e",
};

function scoreColor(s: number): string {
  if (s >= 80) return "#22c55e";
  if (s >= 60) return "#eab308";
  if (s >= 40) return "#f97316";
  return "#ef4444";
}

export default function WebLab() {
  const [, params] = useRoute("/projects/:id/web-lab");
  const projectId = params?.id ? parseInt(params.id) : 0;
  return <WebLabInner projectId={projectId} />;
}

function WebLabInner({ projectId }: { projectId: number }) {
  const [url, setUrl] = useState("");
  const [template, setTemplate] = useState<ReportTemplate>("prestige");
  const [loading, setLoading] = useState(false);
  const [phase, setPhase] = useState(0);
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [error, setError] = useState("");
  const [tab, setTab] = useState<"summary" | "css" | "html" | "preview">("summary");
  const [copied, setCopied] = useState("");
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const [previewMode, setPreviewMode] = useState<"original" | "improved">("improved");

  const loadHistory = useCallback(async () => {
    if (!projectId) return;
    try {
      const res = await fetch(`${API_BASE}/api/web-lab/history/${projectId}`, { credentials: "include" });
      const data = await res.json();
      setHistory(data.items || []);
    } catch {}
  }, [projectId]);

  const analyze = async () => {
    if (!url.trim()) return;
    setLoading(true);
    setError("");
    setResult(null);
    setPhase(0);

    const phaseInterval = setInterval(() => {
      setPhase((p) => (p < 3 ? p + 1 : p));
    }, 8000);

    try {
      const res = await fetch(`${API_BASE}/api/web-lab/analyze`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ url: url.trim(), projectId, template }),
      });

      clearInterval(phaseInterval);

      if (!res.ok) {
        const data = await res.json().catch(() => ({ error: "Error desconocido" }));
        throw new Error(data.error || `Error ${res.status}`);
      }

      const data = await res.json();
      setResult(data);
      setTab("summary");
      setPhase(4);
      loadHistory();
    } catch (err: any) {
      clearInterval(phaseInterval);
      setError(err.message || "Error en el análisis");
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = async (text: string, label: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(label);
      setTimeout(() => setCopied(""), 2000);
    } catch {}
  };

  const downloadFile = (content: string, filename: string, mime: string) => {
    const blob = new Blob([content], { type: mime });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  const downloadFromVault = (path: string) => {
    window.open(`${API_BASE}/api/${path}`, "_blank");
  };

  const a = result?.analysis;

  return (
    <div style={{ padding: "24px 32px", maxWidth: 1200, margin: "0 auto" }}>
      <div style={{ marginBottom: 32 }}>
        <h1 style={{ fontSize: 28, fontWeight: 800, color: "var(--gold, #d4a843)", marginBottom: 4, display: "flex", alignItems: "center", gap: 10 }}>
          🔬 Lab Web
        </h1>
        <p style={{ color: "var(--t2, #aaa)", fontSize: 14 }}>
          Analiza cualquier página web — Shopify, WooCommerce, WordPress, custom o cualquier CMS.
          Extrae el código real y genera CSS/HTML mejorado listo para tu equipo de desarrollo.
        </p>
      </div>

      <div style={{ background: "var(--card, #111)", borderRadius: 16, padding: 24, marginBottom: 24, border: "1px solid var(--border, #222)" }}>
        <div style={{ display: "flex", gap: 12, alignItems: "flex-end", flexWrap: "wrap" }}>
          <div style={{ flex: 1, minWidth: 300 }}>
            <label style={{ fontSize: 12, color: "var(--t2, #888)", display: "block", marginBottom: 6 }}>URL a analizar</label>
            <input
              type="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://ejemplo.com"
              disabled={loading}
              onKeyDown={(e) => e.key === "Enter" && !loading && analyze()}
              style={{
                width: "100%",
                padding: "12px 16px",
                background: "var(--ink, #0a0a0a)",
                border: "1px solid var(--border, #333)",
                borderRadius: 10,
                color: "var(--t1, #eee)",
                fontSize: 15,
                outline: "none",
              }}
            />
          </div>
          <div>
            <label style={{ fontSize: 12, color: "var(--t2, #888)", display: "block", marginBottom: 6 }}>Plantilla informe</label>
            <select
              value={template}
              onChange={(e) => setTemplate(e.target.value as ReportTemplate)}
              disabled={loading}
              style={{
                padding: "12px 16px",
                background: "var(--ink, #0a0a0a)",
                border: "1px solid var(--border, #333)",
                borderRadius: 10,
                color: "var(--t1, #eee)",
                fontSize: 14,
              }}
            >
              <option value="prestige">🥇 Prestige</option>
              <option value="elegance">🥈 Elegance</option>
              <option value="classic">🥉 Classic</option>
            </select>
          </div>
          <button
            onClick={analyze}
            disabled={loading || !url.trim()}
            style={{
              padding: "12px 28px",
              background: loading ? "#333" : "linear-gradient(135deg, #d4a843, #b8860b)",
              border: "none",
              borderRadius: 10,
              color: "#000",
              fontWeight: 700,
              fontSize: 15,
              cursor: loading ? "not-allowed" : "pointer",
              whiteSpace: "nowrap",
            }}
          >
            {loading ? "Analizando..." : "🔬 Analizar"}
          </button>
          {projectId > 0 && <button
            onClick={() => { setShowHistory(!showHistory); if (!showHistory) loadHistory(); }}
            style={{
              padding: "12px 16px",
              background: "transparent",
              border: "1px solid var(--border, #333)",
              borderRadius: 10,
              color: "var(--t2, #aaa)",
              cursor: "pointer",
              fontSize: 13,
            }}
          >
            📜 Historial
          </button>}
        </div>
      </div>

      {loading && (
        <div style={{ background: "var(--card, #111)", borderRadius: 16, padding: 32, marginBottom: 24, border: "1px solid var(--border, #222)" }}>
          <div style={{ display: "flex", gap: 16, justifyContent: "center" }}>
            {phases.map((p, i) => (
              <div key={i} style={{ textAlign: "center", opacity: i <= phase ? 1 : 0.3, transition: "opacity 0.5s" }}>
                <div style={{
                  width: 56, height: 56, borderRadius: "50%",
                  background: i < phase ? "#22c55e22" : i === phase ? "#d4a84333" : "#222",
                  border: `2px solid ${i < phase ? "#22c55e" : i === phase ? "#d4a843" : "#333"}`,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: 24, margin: "0 auto 8px",
                  animation: i === phase ? "pulse 1.5s infinite" : "none",
                }}>
                  {i < phase ? "✅" : p.icon}
                </div>
                <div style={{ fontSize: 11, color: i <= phase ? "var(--t1, #eee)" : "#555", maxWidth: 90 }}>{p.label}</div>
              </div>
            ))}
          </div>
          <style>{`@keyframes pulse { 0%,100% { transform: scale(1); } 50% { transform: scale(1.08); } }`}</style>
        </div>
      )}

      {error && (
        <div style={{ background: "#2a0000", border: "1px solid #4a1111", borderRadius: 12, padding: 16, marginBottom: 24, color: "#fca5a5" }}>
          ❌ {error}
        </div>
      )}

      {showHistory && history.length > 0 && (
        <div style={{ background: "var(--card, #111)", borderRadius: 16, padding: 20, marginBottom: 24, border: "1px solid var(--border, #222)" }}>
          <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 12, color: "var(--t1, #eee)" }}>📜 Análisis anteriores</h3>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {history.map((h) => {
              const meta = typeof h.metadata === "string" ? JSON.parse(h.metadata) : h.metadata;
              return (
                <div
                  key={h.id}
                  onClick={() => downloadFromVault(`web-lab/download-report/${h.id}?template=${template}`)}
                  style={{
                    display: "flex", justifyContent: "space-between", alignItems: "center",
                    padding: "10px 14px", background: "#0a0a14", borderRadius: 8, cursor: "pointer",
                    border: "1px solid #222", transition: "border-color 0.2s",
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.borderColor = "#d4a843")}
                  onMouseLeave={(e) => (e.currentTarget.style.borderColor = "#222")}
                >
                  <div>
                    <div style={{ fontSize: 13, color: "var(--t1, #eee)" }}>{h.originalUrl || h.title}</div>
                    <div style={{ fontSize: 11, color: "#666", marginTop: 2 }}>
                      {new Date(h.createdAt).toLocaleDateString("es-ES")} — Score: {meta?.score ?? "?"}
                    </div>
                  </div>
                  <span style={{ fontSize: 20, fontWeight: 700, color: scoreColor(meta?.score ?? 0) }}>{meta?.score ?? "?"}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {a && result && (
        <>
          <div style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap" }}>
            {(["summary", "css", "html", "preview"] as const).map((t) => {
              const labels = { summary: "📊 Resumen", css: "💻 Código CSS", html: "🏗️ HTML", preview: "👁️ Preview" };
              return (
                <button
                  key={t}
                  onClick={() => setTab(t)}
                  style={{
                    padding: "10px 20px",
                    background: tab === t ? "linear-gradient(135deg, #d4a843, #b8860b)" : "var(--card, #111)",
                    border: tab === t ? "none" : "1px solid var(--border, #333)",
                    borderRadius: 10,
                    color: tab === t ? "#000" : "var(--t2, #aaa)",
                    fontWeight: tab === t ? 700 : 400,
                    cursor: "pointer",
                    fontSize: 14,
                  }}
                >
                  {labels[t]}
                </button>
              );
            })}
          </div>

          <div style={{ background: "var(--card, #111)", borderRadius: 16, padding: 24, marginBottom: 24, border: "1px solid var(--border, #222)" }}>
            {tab === "summary" && (
              <div>
                <div style={{ textAlign: "center", marginBottom: 32 }}>
                  <div style={{
                    display: "inline-flex", alignItems: "center", justifyContent: "center",
                    width: 120, height: 120, borderRadius: "50%",
                    border: `5px solid ${scoreColor(a.overallScore)}`,
                  }}>
                    <span style={{ fontSize: 40, fontWeight: 800, color: scoreColor(a.overallScore) }}>{a.overallScore}</span>
                  </div>
                  <p style={{ marginTop: 8, fontSize: 13, color: "var(--t2, #888)" }}>Score General /100</p>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))", gap: 12, marginBottom: 28 }}>
                  {a.categories && Object.entries(a.categories).map(([key, val]) => (
                    <div key={key} style={{
                      background: "#0a0a14", padding: 16, borderRadius: 12, textAlign: "center",
                      border: `1px solid ${scoreColor(val as number)}33`,
                    }}>
                      <div style={{ fontSize: 14, marginBottom: 4 }}>{categoryIcons[key]}</div>
                      <div style={{ fontSize: 26, fontWeight: 700, color: scoreColor(val as number) }}>{val as number}</div>
                      <div style={{ fontSize: 11, color: "var(--t2, #888)", marginTop: 2 }}>{categoryLabels[key] || key}</div>
                    </div>
                  ))}
                </div>

                <div style={{ marginBottom: 24 }}>
                  <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 8 }}>📋 Resumen Ejecutivo</h3>
                  <p style={{ color: "var(--t2, #ccc)", lineHeight: 1.7, fontSize: 14 }}>{a.summary}</p>
                </div>

                {a.colorPalette && (
                  <div style={{ marginBottom: 24 }}>
                    <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 12 }}>🎨 Paleta de Colores</h3>
                    <div style={{ display: "flex", gap: 32 }}>
                      <div>
                        <p style={{ fontSize: 12, color: "#888", marginBottom: 6 }}>Actual</p>
                        <div style={{ display: "flex", gap: 6 }}>
                          {(a.colorPalette.current || []).map((c, i) => (
                            <div
                              key={i}
                              title={c}
                              onClick={() => copyToClipboard(c, c)}
                              style={{ width: 40, height: 40, borderRadius: 8, background: c, border: "1px solid #333", cursor: "pointer" }}
                            />
                          ))}
                        </div>
                      </div>
                      <div>
                        <p style={{ fontSize: 12, color: "#888", marginBottom: 6 }}>Mejorada</p>
                        <div style={{ display: "flex", gap: 6 }}>
                          {(a.colorPalette.improved || []).map((c, i) => (
                            <div
                              key={i}
                              title={c}
                              onClick={() => copyToClipboard(c, c)}
                              style={{ width: 40, height: 40, borderRadius: 8, background: c, border: "1px solid #333", cursor: "pointer" }}
                            />
                          ))}
                        </div>
                      </div>
                    </div>
                    {copied && <p style={{ fontSize: 11, color: "#22c55e", marginTop: 6 }}>✅ {copied} copiado</p>}
                  </div>
                )}

                {a.typography && (
                  <div style={{ marginBottom: 24 }}>
                    <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 8 }}>🔤 Tipografía</h3>
                    <div style={{ display: "flex", gap: 32 }}>
                      <div>
                        <p style={{ fontSize: 12, color: "#888" }}>Actual</p>
                        <p style={{ color: "#ccc", fontSize: 14 }}>{(a.typography.current || []).join(", ") || "—"}</p>
                      </div>
                      <div>
                        <p style={{ fontSize: 12, color: "#888" }}>Recomendada</p>
                        <p style={{ color: "#ccc", fontSize: 14 }}>{(a.typography.improved || []).join(", ") || "—"}</p>
                      </div>
                    </div>
                  </div>
                )}

                {result.pageSpeed && (
                  <div>
                    <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 12 }}>⚡ PageSpeed</h3>
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(120px, 1fr))", gap: 10 }}>
                      {Object.entries(result.pageSpeed.mobile || {}).map(([k, v]) => (
                        <div key={k} style={{ background: "#0a0a14", padding: 10, borderRadius: 8, textAlign: "center" }}>
                          <div style={{ fontSize: 22, fontWeight: 700, color: scoreColor(v as number) }}>{v as number}</div>
                          <div style={{ fontSize: 11, color: "#888" }}>{k}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {tab === "css" && (
              <div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
                  <div>
                    <h3 style={{ fontSize: 18, fontWeight: 700 }}>💻 CSS Mejorado</h3>
                    <p style={{ fontSize: 12, color: "var(--t2, #888)", marginTop: 4 }}>
                      Listo para copiar/pegar — compatible con Shopify, WooCommerce y cualquier CMS
                    </p>
                  </div>
                  <div style={{ display: "flex", gap: 8 }}>
                    <button
                      onClick={() => copyToClipboard(a.improvedCss, "CSS")}
                      style={{
                        padding: "8px 16px",
                        background: copied === "CSS" ? "#22c55e22" : "#1a1a2e",
                        border: `1px solid ${copied === "CSS" ? "#22c55e" : "#333"}`,
                        borderRadius: 8, color: copied === "CSS" ? "#22c55e" : "#ccc",
                        cursor: "pointer", fontSize: 13,
                      }}
                    >
                      {copied === "CSS" ? "✅ Copiado" : "📋 Copiar CSS"}
                    </button>
                    <button
                      onClick={() => downloadFile(a.improvedCss, "improved-styles.css", "text/css")}
                      style={{
                        padding: "8px 16px",
                        background: "#1a1a2e",
                        border: "1px solid #333",
                        borderRadius: 8, color: "#ccc",
                        cursor: "pointer", fontSize: 13,
                      }}
                    >
                      💾 Descargar .css
                    </button>
                  </div>
                </div>
                <pre style={{
                  background: "#0d1117",
                  border: "1px solid #30363d",
                  borderRadius: 10,
                  padding: 20,
                  overflow: "auto",
                  maxHeight: 600,
                  fontSize: 13,
                  lineHeight: 1.6,
                  color: "#c9d1d9",
                  fontFamily: "'Fira Code', 'Cascadia Code', monospace",
                }}>
                  <code>{a.improvedCss}</code>
                </pre>
              </div>
            )}

            {tab === "html" && (
              <div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
                  <div>
                    <h3 style={{ fontSize: 18, fontWeight: 700 }}>🏗️ HTML Mejorado</h3>
                    <p style={{ fontSize: 12, color: "var(--t2, #888)", marginTop: 4 }}>
                      Fragmentos HTML semánticos y accesibles — antes/después por sección
                    </p>
                  </div>
                  <div style={{ display: "flex", gap: 8 }}>
                    <button
                      onClick={() => {
                        const all = (a.improvedHtmlFragments || []).map(f => `<!-- ${f.section} -->\n${f.improved}`).join("\n\n");
                        copyToClipboard(all, "HTML");
                      }}
                      style={{
                        padding: "8px 16px",
                        background: copied === "HTML" ? "#22c55e22" : "#1a1a2e",
                        border: `1px solid ${copied === "HTML" ? "#22c55e" : "#333"}`,
                        borderRadius: 8, color: copied === "HTML" ? "#22c55e" : "#ccc",
                        cursor: "pointer", fontSize: 13,
                      }}
                    >
                      {copied === "HTML" ? "✅ Copiado" : "📋 Copiar HTML"}
                    </button>
                    <button
                      onClick={() => {
                        const all = (a.improvedHtmlFragments || []).map(f => `<!-- ${f.section} -->\n${f.improved}`).join("\n\n");
                        downloadFile(all, "improved-fragments.html", "text/html");
                      }}
                      style={{
                        padding: "8px 16px",
                        background: "#1a1a2e",
                        border: "1px solid #333",
                        borderRadius: 8, color: "#ccc",
                        cursor: "pointer", fontSize: 13,
                      }}
                    >
                      💾 Descargar .html
                    </button>
                  </div>
                </div>

                {a.issues && a.issues.length > 0 && (
                  <div style={{ marginBottom: 24 }}>
                    <h4 style={{ fontSize: 14, fontWeight: 600, marginBottom: 10, color: "var(--t2, #aaa)" }}>
                      ⚠️ Problemas detectados ({a.issues.length})
                    </h4>
                    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                      {a.issues.map((issue, i) => (
                        <div key={i} style={{
                          display: "grid", gridTemplateColumns: "80px 1fr 1fr 100px 100px",
                          gap: 8, padding: "8px 12px", background: "#0a0a14", borderRadius: 8,
                          fontSize: 12, alignItems: "center", border: "1px solid #1a1a2e",
                        }}>
                          <span style={{
                            background: (sevColors[issue.severity] || "#888") + "22",
                            color: sevColors[issue.severity] || "#888",
                            padding: "2px 8px", borderRadius: 4, fontSize: 11, textAlign: "center",
                          }}>
                            {issue.severity}
                          </span>
                          <span style={{ fontFamily: "monospace", color: "#e0e0e0", fontSize: 11 }}>{issue.selector}</span>
                          <span style={{ color: "#aaa" }}>{issue.property}: <span style={{ color: "#f87171" }}>{issue.current}</span></span>
                          <span style={{ color: "#4ade80", fontFamily: "monospace", fontSize: 11 }}>{issue.improved}</span>
                          <span title={issue.reason} style={{ color: "#666", fontSize: 11, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                            {issue.reason}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {(a.improvedHtmlFragments || []).map((frag, i) => (
                  <div key={i} style={{ marginBottom: 20 }}>
                    <h4 style={{ color: "#d4a843", marginBottom: 8, fontSize: 14 }}>📌 {frag.section}</h4>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                      <div>
                        <p style={{ fontSize: 11, color: "#ef4444", marginBottom: 4 }}>❌ Original</p>
                        <pre style={{
                          background: "#1a0000", border: "1px solid #4a1111", borderRadius: 8,
                          padding: 12, fontSize: 11, overflow: "auto", maxHeight: 250, color: "#fca5a5",
                          fontFamily: "'Fira Code', monospace",
                        }}>
                          <code>{frag.original}</code>
                        </pre>
                      </div>
                      <div>
                        <p style={{ fontSize: 11, color: "#22c55e", marginBottom: 4 }}>✅ Mejorado</p>
                        <pre style={{
                          background: "#001a00", border: "1px solid #114a11", borderRadius: 8,
                          padding: 12, fontSize: 11, overflow: "auto", maxHeight: 250, color: "#86efac",
                          fontFamily: "'Fira Code', monospace",
                        }}>
                          <code>{frag.improved}</code>
                        </pre>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {tab === "preview" && (
              <div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
                  <h3 style={{ fontSize: 18, fontWeight: 700 }}>👁️ Preview Visual</h3>
                  <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                    <span style={{ fontSize: 13, color: previewMode === "original" ? "#ef4444" : "#888" }}>Original</span>
                    <button
                      onClick={() => setPreviewMode(previewMode === "original" ? "improved" : "original")}
                      style={{
                        width: 48, height: 26, borderRadius: 13, border: "none", cursor: "pointer",
                        background: previewMode === "improved" ? "#22c55e" : "#333",
                        position: "relative", transition: "background 0.3s",
                      }}
                    >
                      <div style={{
                        width: 20, height: 20, borderRadius: "50%", background: "#fff",
                        position: "absolute", top: 3,
                        left: previewMode === "improved" ? 25 : 3,
                        transition: "left 0.3s",
                      }} />
                    </button>
                    <span style={{ fontSize: 13, color: previewMode === "improved" ? "#22c55e" : "#888" }}>Mejorado</span>
                  </div>
                </div>
                <iframe
                  sandbox="allow-same-origin"
                  style={{
                    width: "100%",
                    height: 600,
                    border: `2px solid ${previewMode === "improved" ? "#22c55e33" : "#ef444433"}`,
                    borderRadius: 12,
                    background: "#fff",
                  }}
                  srcDoc={
                    previewMode === "improved"
                      ? `<!DOCTYPE html><html><head><style>${a.improvedCss || ""}</style></head><body>${(a.improvedHtmlFragments || []).map(f => f.improved).join("\n")}</body></html>`
                      : `<!DOCTYPE html><html><head></head><body>${(a.improvedHtmlFragments || []).map(f => f.original).join("\n")}</body></html>`
                  }
                />
              </div>
            )}
          </div>

          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            {result.vaultIds?.report ? (
              <button
                onClick={() => downloadFromVault(`web-lab/download-report/${result.vaultIds.report}?template=${template}`)}
                style={{
                  padding: "10px 20px",
                  background: "linear-gradient(135deg, #d4a843, #b8860b)",
                  border: "none", borderRadius: 10, color: "#000",
                  fontWeight: 700, cursor: "pointer", fontSize: 13,
                }}
              >
                📄 Descargar Informe ({template})
              </button>
            ) : result.reportHtml ? (
              <button
                onClick={() => downloadFile(result.reportHtml!, "web-lab-report.html", "text/html")}
                style={{
                  padding: "10px 20px",
                  background: "linear-gradient(135deg, #d4a843, #b8860b)",
                  border: "none", borderRadius: 10, color: "#000",
                  fontWeight: 700, cursor: "pointer", fontSize: 13,
                }}
              >
                📄 Descargar Informe ({template})
              </button>
            ) : null}
            {result.vaultIds?.css ? (
              <button
                onClick={() => downloadFromVault(`web-lab/download-css/${result.vaultIds.css}`)}
                style={{
                  padding: "10px 20px",
                  background: "#1a1a2e", border: "1px solid #333",
                  borderRadius: 10, color: "#ccc", cursor: "pointer", fontSize: 13,
                }}
              >
                📋 Descargar CSS
              </button>
            ) : a?.improvedCss ? (
              <button
                onClick={() => downloadFile(a.improvedCss, "improved-styles.css", "text/css")}
                style={{
                  padding: "10px 20px",
                  background: "linear-gradient(135deg, #d4a843, #b8860b)",
                  border: "none", borderRadius: 10, color: "#000",
                  fontWeight: 700, cursor: "pointer", fontSize: 13,
                }}
              >
                📋 Descargar CSS Mejorado
              </button>
            ) : null}
            {result.vaultIds?.html ? (
              <button
                onClick={() => downloadFromVault(`web-lab/download-html/${result.vaultIds.html}`)}
                style={{
                  padding: "10px 20px",
                  background: "#1a1a2e", border: "1px solid #333",
                  borderRadius: 10, color: "#ccc", cursor: "pointer", fontSize: 13,
                }}
              >
                🏗️ Descargar HTML
              </button>
            ) : a?.improvedHtmlFragments?.length ? (
              <button
                onClick={() => downloadFile(
                  a.improvedHtmlFragments.map(f => `<!-- ${f.section} -->\n${f.improved}`).join("\n\n"),
                  "improved-fragments.html", "text/html"
                )}
                style={{
                  padding: "10px 20px",
                  background: "#1a1a2e", border: "1px solid #333",
                  borderRadius: 10, color: "#ccc", cursor: "pointer", fontSize: 13,
                }}
              >
                🏗️ Descargar HTML Mejorado
              </button>
            ) : null}
            {result.vaultIds?.report && (
              <button
                onClick={() => downloadFromVault(`web-lab/download-pack/${result.vaultIds.report}`)}
                style={{
                  padding: "10px 20px",
                  background: "#0a2a0a", border: "1px solid #22c55e33",
                  borderRadius: 10, color: "#22c55e", cursor: "pointer", fontSize: 13,
                }}
              >
                📦 Descargar Pack Completo (ZIP)
              </button>
            )}
          </div>
        </>
      )}
    </div>
  );
}
