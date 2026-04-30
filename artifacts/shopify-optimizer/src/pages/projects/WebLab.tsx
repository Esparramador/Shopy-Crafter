import { useState, useCallback } from "react";
import { useRoute } from "wouter";
import { scoreColor } from "@/lib/utils";
import { LiveOperation } from "@/components/LiveOperation";

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

export default function WebLab() {
  const [, params] = useRoute("/projects/:id/web-lab");
  const projectId = params?.id ? parseInt(params.id) : 0;
  return <WebLabInner projectId={projectId} />;
}

function WebLabInner({ projectId }: { projectId: number }) {
  const [url, setUrl] = useState("");
  const [instagram, setInstagram] = useState("");
  const [brandName, setBrandName] = useState("");
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
  const [previewDevice, setPreviewDevice] = useState<"desktop" | "tablet" | "mobile">("desktop");
  const [changeRequest, setChangeRequest] = useState("");
  const [iterating, setIterating] = useState(false);
  const [iterError, setIterError] = useState("");

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
        body: JSON.stringify({ url: url.trim(), projectId, template, instagram: instagram.replace("@", "").trim() || undefined, brandName: brandName.trim() || undefined }),
      });

      clearInterval(phaseInterval);

      const rawText = await res.text();
      let data;
      try { data = JSON.parse(rawText.trim()); } catch { throw new Error(`Error ${res.status}: respuesta inválida`); }

      if (!res.ok || data.error) {
        throw new Error(data.error || `Error ${res.status}`);
      }

      if (!data.success) {
        throw new Error(data.error || "El análisis no devolvió resultados válidos");
      }

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

  /**
   * Build a self-contained HTML document for the iframe preview.
   * - Adds <meta charset> + viewport so it renders correctly at any size.
   * - Adds <base target="_blank"> so external links open in a new tab
   *   (so the user doesn't navigate away from the preview).
   * - Injects a normalize/reset so the preview LOOKS like a real site,
   *   not unstyled HTML.
   * - Injects a tiny script that intercepts in-page anchor clicks
   *   ("#section") and smooth-scrolls inside the iframe — making the
   *   preview behave like a real navigable web page.
   *
   * SECURITY: el iframe se monta SIN `allow-same-origin` (ver más abajo),
   * por lo que cualquier script presente en el HTML/CSS generado por
   * Claude o extraído del sitio externo se ejecuta en un origen opaco
   * y NO puede leer cookies/localStorage/fetch /api/* de Shopy Crafter.
   * Aun así, añadimos un meta CSP conservador para limitar destinos de
   * red dentro del propio iframe.
   */
  const buildPreviewSrcDoc = (mode: "original" | "improved"): string => {
    if (!a) return "";
    const fragments = a.improvedHtmlFragments || [];
    const body = mode === "improved"
      ? fragments.map(f => f.improved).join("\n")
      : fragments.map(f => f.original).join("\n");
    const css = mode === "improved" ? (a.improvedCss || "") : "";

    const normalize = `
      *, *::before, *::after { box-sizing: border-box; }
      html { -webkit-text-size-adjust: 100%; scroll-behavior: smooth; }
      body { margin: 0; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif; line-height: 1.5; color: #1a1a1a; background: #fff; }
      img, video { max-width: 100%; height: auto; display: block; }
      a { color: inherit; }
      h1, h2, h3, h4, h5, h6 { margin: 0.5em 0; line-height: 1.2; }
      p { margin: 0.5em 0; }
      button, input, select, textarea { font: inherit; }
    `;

    const navScript = `
      (function() {
        document.addEventListener('click', function(e) {
          var a = e.target.closest && e.target.closest('a');
          if (!a) return;
          var href = a.getAttribute('href') || '';
          // Internal anchor: smooth-scroll inside the preview iframe.
          if (href.startsWith('#') && href.length > 1) {
            e.preventDefault();
            var target = document.getElementById(href.slice(1)) ||
                         document.querySelector('[name="' + href.slice(1) + '"]');
            if (target) target.scrollIntoView({ behavior: 'smooth', block: 'start' });
            return;
          }
          // Empty href or just '#': prevent navigation.
          if (href === '' || href === '#') { e.preventDefault(); return; }
          // Anything else (full URLs) opens in a new tab via <base target="_blank">.
        }, true);
      })();
    `;

    // CSP defensivo dentro del iframe — bloquea cualquier intento del HTML
    // generado por Claude/sitio externo de hacer fetch a /api/* o exfiltrar
    // datos. Sólo permitimos imágenes y fuentes (data:, https:) y CSS inline.
    // 'unsafe-inline' es necesario porque inyectamos <style> y nuestro
    // navScript de scroll interno.
    const csp = "default-src 'none'; img-src data: https: http:; font-src data: https:; style-src 'unsafe-inline' https:; script-src 'unsafe-inline'; connect-src 'none'; frame-src 'none'; object-src 'none'; form-action 'none';";

    return `<!DOCTYPE html><html lang="es"><head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta http-equiv="Content-Security-Policy" content="${csp}">
<base target="_blank">
<title>Preview</title>
<style>${normalize}</style>
${css ? `<style>${css}</style>` : ""}
</head><body>
${body || '<div style="padding:40px;text-align:center;color:#888;font-family:sans-serif">No hay contenido para mostrar.</div>'}
<script>${navScript}<\/script>
</body></html>`;
  };

  const openPreviewFullscreen = () => {
    if (!a) return;
    const html = buildPreviewSrcDoc(previewMode);
    // SECURITY: usamos data: URL en vez de blob: porque blob: es same-origin
    // con la app Shopy Crafter, y eso permitiría a scripts del HTML generado
    // por Claude leer cookies/localStorage/hacer fetch a /api/*. data: URL
    // crea un origen opaco aislado.
    const dataUrl = "data:text/html;charset=utf-8;base64," + btoa(unescape(encodeURIComponent(html)));
    window.open(dataUrl, "_blank", "noopener,noreferrer");
  };

  const iterate = async () => {
    if (!a || !result || !changeRequest.trim()) return;
    setIterating(true);
    setIterError("");
    try {
      const res = await fetch(`${API_BASE}/api/web-lab/iterate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          projectId,
          url: result.url,
          previousCss: a.improvedCss,
          previousFragments: a.improvedHtmlFragments,
          changeRequest: changeRequest.trim(),
          brandName: brandName.trim() || undefined,
        }),
      });
      const text = await res.text();
      let data: any;
      try { data = JSON.parse(text.trim()); } catch { throw new Error(`Error ${res.status}: respuesta inválida`); }
      // 402 = sin créditos: mensaje específico con el plan actual y CTA a /admin/billing
      if (res.status === 402) {
        const plan = data.planLabel ? ` (plan: ${data.planLabel})` : "";
        const remaining = data.remaining
          ? ` Te quedan ${data.remaining.products ?? 0} productos / ${data.remaining.images ?? 0} imágenes este mes.`
          : "";
        throw new Error(
          `${data.error || "Sin créditos suficientes para iterar el diseño."}${plan}.${remaining} Recarga créditos desde Facturación para seguir iterando.`
        );
      }
      if (!res.ok || data.error) throw new Error(data.error || `Error ${res.status}`);
      setResult(prev => prev ? {
        ...prev,
        analysis: {
          ...prev.analysis,
          improvedCss: data.improvedCss || prev.analysis.improvedCss,
          improvedHtmlFragments: data.improvedHtmlFragments || prev.analysis.improvedHtmlFragments,
          summary: data.summary || prev.analysis.summary,
        },
      } : prev);
      setChangeRequest("");
    } catch (e: any) {
      setIterError(e?.message || "Error aplicando los cambios");
    } finally {
      setIterating(false);
    }
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
          <div style={{ flex: 1, minWidth: "min(300px, 100%)" }}>
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
            <div style={{ display: "flex", gap: 12, marginTop: 12 }}>
              <input
                value={instagram}
                onChange={(e) => setInstagram(e.target.value)}
                placeholder="Instagram de la marca (ej: @zara) — opcional"
                disabled={loading}
                style={{
                  flex: 1,
                  padding: "10px 14px",
                  background: "var(--ink, #0a0a0a)",
                  border: "1px solid var(--border, #333)",
                  borderRadius: 8,
                  color: "var(--t1, #eee)",
                  fontSize: 13,
                  outline: "none",
                }}
              />
              <input
                value={brandName}
                onChange={(e) => setBrandName(e.target.value)}
                placeholder="Nombre de la marca (ej: Zara) — opcional"
                disabled={loading}
                style={{
                  flex: 1,
                  padding: "10px 14px",
                  background: "var(--ink, #0a0a0a)",
                  border: "1px solid var(--border, #333)",
                  borderRadius: 8,
                  color: "var(--t1, #eee)",
                  fontSize: 13,
                  outline: "none",
                }}
              />
            </div>
            <p style={{ fontSize: 12, color: "var(--t3, #666)", marginTop: 4 }}>
              Si proporcionas el Instagram o nombre, ShopyBrain investigará la identidad visual de la marca para generar un CSS 100% alineado con su estética.
            </p>
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
              let meta: Record<string, unknown> = {};
              try { meta = typeof h.metadata === "string" ? JSON.parse(h.metadata) : (h.metadata ?? {}); } catch { meta = {}; }
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
                      {new Date(h.createdAt).toLocaleDateString("es-ES")} — Score: {String(meta?.score ?? "?")}
                    </div>
                  </div>
                  <span style={{ fontSize: 20, fontWeight: 700, color: scoreColor(Number(meta?.score) || 0) }}>{String(meta?.score ?? "?")}</span>
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
                    <button
                      onClick={() => {
                        const fragments = (a.improvedHtmlFragments || []).map((f: any) => f.improved).join("\n");
                        const toolbarCss = `.shopy-preview-toolbar{position:fixed;bottom:0;left:0;right:0;z-index:99999;background:linear-gradient(135deg,#0a0a1a,#1a1a2e);border-top:2px solid #d4a843;padding:10px 24px;display:flex;align-items:center;justify-content:space-between;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:#ccc;font-size:12px;box-shadow:0 -4px 20px rgba(0,0,0,0.5)}.shopy-preview-toolbar a{color:#d4a843;text-decoration:none;font-weight:600}`;
                        const toolbar = `<div class="shopy-preview-toolbar"><div style="display:flex;align-items:center;gap:8px"><span style="font-size:14px;font-weight:700;background:linear-gradient(135deg,#d4a843,#b8860b);-webkit-background-clip:text;-webkit-text-fill-color:transparent">Shopy Crafter</span><span style="font-size:11px;color:#888">Preview Visual — CSS Mejorado</span></div><div><span style="color:#888">Fuente: ${url}</span> · <a href="https://shopycrafter.com" target="_blank">shopycrafter.com</a></div></div>`;
                        const fullHtml = `<!DOCTYPE html>\n<html lang="es">\n<head>\n<meta charset="UTF-8">\n<meta name="viewport" content="width=device-width, initial-scale=1.0">\n<title>Preview Visual — CSS Mejorado</title>\n<style>\n${a.improvedCss}\nbody{margin:0;padding:0;min-height:100vh}\n${toolbarCss}\n</style>\n</head>\n<body>\n${fragments}\n${toolbar}\n</body>\n</html>`;
                        downloadFile(fullHtml, "preview-visual.html", "text/html");
                      }}
                      style={{
                        padding: "8px 16px",
                        background: "linear-gradient(135deg, #22c55e22, #16a34a22)",
                        border: "1px solid #22c55e44",
                        borderRadius: 8, color: "#22c55e",
                        cursor: "pointer", fontSize: 13,
                      }}
                    >
                      👁️ Descargar Preview HTML
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
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16, flexWrap: "wrap", gap: 12 }}>
                  <h3 style={{ fontSize: 18, fontWeight: 700 }}>👁️ Preview Visual</h3>
                  <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
                    {/* Device selector */}
                    <div style={{ display: "flex", gap: 4, padding: 3, background: "#1a1a1a", borderRadius: 8 }}>
                      {(["desktop", "tablet", "mobile"] as const).map(d => (
                        <button
                          key={d}
                          onClick={() => setPreviewDevice(d)}
                          title={d}
                          style={{
                            padding: "5px 10px", borderRadius: 6, border: "none",
                            background: previewDevice === d ? "#d4a843" : "transparent",
                            color: previewDevice === d ? "#000" : "#888",
                            fontSize: 11, fontWeight: 700, cursor: "pointer", textTransform: "capitalize",
                          }}
                        >{d === "desktop" ? "🖥️" : d === "tablet" ? "📱" : "📱"} {d}</button>
                      ))}
                    </div>
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
                    <button
                      onClick={openPreviewFullscreen}
                      style={{ padding: "6px 12px", background: "#1a1a2e", border: "1px solid #333", borderRadius: 8, color: "#ccc", cursor: "pointer", fontSize: 12 }}
                    >🔗 Abrir en pestaña</button>
                  </div>
                </div>
                {/* Device-sized preview frame */}
                <div style={{ display: "flex", justifyContent: "center", padding: 16, background: "#0a0a0a", borderRadius: 12 }}>
                  <iframe
                    sandbox="allow-scripts allow-popups allow-popups-to-escape-sandbox"
                    title="Preview de la página mejorada"
                    style={{
                      width: previewDevice === "desktop" ? "100%" : previewDevice === "tablet" ? 768 : 390,
                      maxWidth: "100%",
                      height: 720,
                      border: `2px solid ${previewMode === "improved" ? "#22c55e33" : "#ef444433"}`,
                      borderRadius: 12,
                      background: "#fff",
                      transition: "width 0.25s ease",
                    }}
                    srcDoc={buildPreviewSrcDoc(previewMode)}
                  />
                </div>

                {/* ── Iteración: sugerir cambios sobre lo ya generado ── */}
                <div style={{ marginTop: 24, padding: 18, background: "#0c0c0e", border: "1px solid #1f1f24", borderRadius: 12 }}>
                  <h4 style={{ fontSize: 14, fontWeight: 700, color: "#e6c668", marginBottom: 8 }}>💬 Sugerir cambios sobre el diseño actual</h4>
                  <p style={{ fontSize: 12, color: "#888", marginBottom: 12, lineHeight: 1.5 }}>
                    Describe en lenguaje natural lo que quieres cambiar. La IA tomará el HTML/CSS actual como punto de partida y generará una nueva versión. Ejemplos: "haz el hero más oscuro y añade un degradado dorado", "cambia la tipografía a algo más editorial estilo Vogue", "el botón principal debe ser verde menta y más grande".
                  </p>
                  <textarea
                    rows={3}
                    value={changeRequest}
                    onChange={(e) => setChangeRequest(e.target.value)}
                    placeholder="Describe el cambio que quieres aplicar…"
                    disabled={iterating}
                    style={{
                      width: "100%", padding: "10px 14px",
                      background: "#0a0a0a", border: "1px solid #2a2a30", borderRadius: 10,
                      color: "#eee", fontSize: 13, outline: "none", resize: "vertical",
                      fontFamily: "inherit", boxSizing: "border-box",
                    }}
                  />
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 10, gap: 12, flexWrap: "wrap" }}>
                    <small style={{ color: "#666", fontSize: 11 }}>
                      {iterError ? <span style={{ color: "#ef4444" }}>⚠ {iterError}</span> : "El cambio reemplaza la versión mejorada actual y conserva el original como referencia."}
                    </small>
                    <button
                      onClick={iterate}
                      disabled={iterating || !changeRequest.trim()}
                      style={{
                        padding: "9px 18px",
                        background: iterating || !changeRequest.trim() ? "#2a2a30" : "linear-gradient(135deg, #d4a843, #b8860b)",
                        border: "none", borderRadius: 10,
                        color: iterating || !changeRequest.trim() ? "#666" : "#000",
                        fontWeight: 700, fontSize: 13,
                        cursor: iterating || !changeRequest.trim() ? "not-allowed" : "pointer",
                      }}
                    >{iterating ? "Aplicando…" : "✨ Aplicar cambio"}</button>
                  </div>
                  <LiveOperation
                    active={iterating}
                    title="Aplicando tu cambio sobre la web generada"
                    estimatedSec={35}
                    messages={[
                      "Enviando contexto previo + tu petición a Claude…",
                      "Reescribiendo CSS sin perder coherencia con la marca…",
                      "Actualizando fragmentos HTML afectados…",
                      "Validando uniqueness y rechazando placeholders…",
                      "Refrescando la vista previa con el resultado…",
                    ]}
                    className="w-full mt-3"
                  />
                </div>
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
