import { useState } from "react";
import { Globe, Download, Code2, Loader2, AlertCircle, Copy, Check, Eye, Zap, RefreshCw } from "lucide-react";

const API_BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

const FRAME_TEMPLATES = [
  { id: "landing", label: "Landing Page", icon: "🚀", desc: "Página de aterrizaje con hero, features y CTA" },
  { id: "product", label: "Product Page", icon: "📦", desc: "Ficha de producto premium con galería y reseñas" },
  { id: "email", label: "Email Template", icon: "📧", desc: "Template de email responsivo para campañas" },
  { id: "collection", label: "Collection Page", icon: "🗂️", desc: "Página de colección/categoría con filtros" },
  { id: "story", label: "Brand Story", icon: "📖", desc: "Historia de marca con storytelling visual" },
  { id: "promo", label: "Promo Banner", icon: "🎯", desc: "Banner promocional animado para anuncios" },
  { id: "checkout", label: "Checkout UX", icon: "💳", desc: "Optimización de página de checkout" },
  { id: "review", label: "Reviews Section", icon: "⭐", desc: "Sección de reseñas y testimonios" },
];

const STYLE_PRESETS = [
  { id: "minimal-dark", label: "Minimal Dark", colors: ["#0a0a0a", "#1a1a1a", "#d4af37"] },
  { id: "luxury-gold", label: "Luxury Gold", colors: ["#1a1208", "#2d2010", "#d4af37"] },
  { id: "clean-white", label: "Clean White", colors: ["#ffffff", "#f8f8f8", "#1a1a1a"] },
  { id: "jade-tech", label: "Jade Tech", colors: ["#0a1a12", "#0f2818", "#3de8a0"] },
  { id: "sunset-warm", label: "Sunset Warm", colors: ["#1a0a08", "#2d1510", "#fb923c"] },
  { id: "ocean-blue", label: "Ocean Blue", colors: ["#080f1a", "#0d1a2d", "#60a5fa"] },
];

export default function HyperFrames() {
  const [activeTab, setActiveTab] = useState<"generate" | "export">("generate");
  const [template, setTemplate] = useState("landing");
  const [style, setStyle] = useState("minimal-dark");
  const [brandName, setBrandName] = useState("");
  const [productName, setProductName] = useState("");
  const [tagline, setTagline] = useState("");
  const [extraInstructions, setExtraInstructions] = useState("");
  const [generating, setGenerating] = useState(false);
  const [generatedHtml, setGeneratedHtml] = useState<string | null>(null);
  const [previewVisible, setPreviewVisible] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [exportFormat, setExportFormat] = useState<"html" | "pdf" | "mp4">("html");
  const [exporting, setExporting] = useState(false);

  const tpl = FRAME_TEMPLATES.find(t => t.id === template);
  const sty = STYLE_PRESETS.find(x => x.id === style);

  async function generateFrame() {
    if (!brandName.trim()) { setError("Escribe el nombre de la marca"); return; }
    setGenerating(true);
    setError(null);
    setGeneratedHtml(null);
    setPreviewVisible(false);

    try {
      const r = await fetch(`${API_BASE}/api/hyperframes/generate-html`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        // El API espera prompt/type/brandDna (antes 400 "prompt o brandDna requerido").
        body: JSON.stringify({
          prompt: [
            `${tpl?.label ?? template}: ${tpl?.desc ?? ""}`,
            `Marca: ${brandName.trim()}`,
            productName.trim() ? `Producto: ${productName.trim()}` : "",
            tagline.trim() ? `Tagline: ${tagline.trim()}` : "",
            `Estilo visual: ${sty?.label ?? style} (colores ${sty?.colors.join(", ") ?? ""})`,
            extraInstructions.trim() ? `Instrucciones extra: ${extraInstructions.trim()}` : "",
          ].filter(Boolean).join("\n"),
          type: template === "promo" ? "promo-video" : template === "story" ? "brand-intro" : template === "review" ? "testimonial" : "product-showcase",
          brandDna: { BRAND_NAME: brandName.trim(), PRIMARY_COLOR: sty?.colors[2] ?? "" },
        }),
      });
      if (!r.ok) {
        const err = await r.json();
        throw new Error(err.error || "Error generando frame");
      }
      const data = await r.json();
      setGeneratedHtml(data.html || "");
      setPreviewVisible(true);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Error desconocido");
    } finally {
      setGenerating(false);
    }
  }

  async function exportFrame(format: "html" | "pdf" | "mp4") {
    if (!generatedHtml) return;
    setExporting(true);
    setError(null);
    const base = `${brandName.replace(/\s+/g, "-")}-${template}`;
    const download = (blob: Blob, ext: string) => {
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${base}.${ext}`;
      a.click();
      URL.revokeObjectURL(url);
    };
    try {
      if (format === "html") {
        download(new Blob([generatedHtml], { type: "text/html" }), "html");
      } else if (format === "pdf") {
        // PDF desde el navegador (Guardar como PDF) sobre el HTML generado.
        const w = window.open("", "_blank");
        if (!w) throw new Error("El navegador bloqueó la ventana de impresión");
        w.document.write(generatedHtml);
        w.document.close();
        w.onload = () => w.print();
      } else {
        // MP4: render real en el servidor (Chromium + ffmpeg).
        const r = await fetch(`${API_BASE}/api/hyperframes/generate`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ html: generatedHtml, title: base }),
        });
        if (!r.ok) {
          const err = await r.json().catch(() => ({}));
          throw new Error((err as { error?: string }).error || `Error ${r.status} renderizando vídeo`);
        }
        download(await r.blob(), "mp4");
      }
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Error exportando");
    } finally {
      setExporting(false);
    }
  }

  function copyHtml() {
    if (!generatedHtml) return;
    navigator.clipboard.writeText(generatedHtml);
    setCopiedId("html");
    setTimeout(() => setCopiedId(null), 2000);
  }

  const selectedTemplate = FRAME_TEMPLATES.find(t => t.id === template);
  const selectedStyle = STYLE_PRESETS.find(s => s.id === style);

  return (
    <div style={{ padding: "24px", maxWidth: 1400, margin: "0 auto" }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 24 }}>
        <div style={{ width: 44, height: 44, borderRadius: 12, background: "linear-gradient(135deg, #22d3ee, #0891b2)", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <Globe size={22} color="#fff" />
        </div>
        <div>
          <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700, color: "var(--t1)" }}>HyperFrames Studio</h1>
          <p style={{ margin: 0, fontSize: 13, color: "var(--t3)" }}>Genera frames HTML, PDFs y presentaciones con IA</p>
        </div>
      </div>

      {error && (
        <div style={{ background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.3)", borderRadius: 10, padding: "12px 16px", marginBottom: 16, color: "#f87171", display: "flex", gap: 8, alignItems: "center" }}>
          <AlertCircle size={16} /> {error}
          <button onClick={() => setError(null)} style={{ marginLeft: "auto", background: "none", border: "none", cursor: "pointer", color: "#f87171" }}><X size={14} /></button>
        </div>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "380px 1fr", gap: 20 }}>
        {/* Config Panel */}
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          {/* Template */}
          <div style={{ background: "var(--s1)", border: "1px solid var(--border)", borderRadius: 12, padding: 16 }}>
            <div style={{ fontSize: 12, color: "var(--t3)", fontWeight: 700, marginBottom: 12, textTransform: "uppercase", letterSpacing: "0.06em" }}>TIPO DE FRAME</div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
              {FRAME_TEMPLATES.map(t => (
                <button
                  key={t.id}
                  onClick={() => setTemplate(t.id)}
                  style={{
                    background: template === t.id ? "rgba(212,175,55,0.15)" : "var(--s2)",
                    border: template === t.id ? "1.5px solid var(--gold)" : "1px solid var(--border)",
                    borderRadius: 8, padding: "10px 10px", cursor: "pointer", textAlign: "left",
                  }}
                >
                  <div style={{ fontSize: 16, marginBottom: 4 }}>{t.icon}</div>
                  <div style={{ fontSize: 11, fontWeight: 700, color: template === t.id ? "var(--gold)" : "var(--t1)" }}>{t.label}</div>
                  <div style={{ fontSize: 10, color: "var(--t4)", marginTop: 2, lineHeight: 1.4 }}>{t.desc}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Style */}
          <div style={{ background: "var(--s1)", border: "1px solid var(--border)", borderRadius: 12, padding: 16 }}>
            <div style={{ fontSize: 12, color: "var(--t3)", fontWeight: 700, marginBottom: 12, textTransform: "uppercase", letterSpacing: "0.06em" }}>ESTILO VISUAL</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {STYLE_PRESETS.map(s => (
                <button
                  key={s.id}
                  onClick={() => setStyle(s.id)}
                  style={{ background: style === s.id ? "rgba(212,175,55,0.1)" : "var(--s2)", border: style === s.id ? "1.5px solid var(--gold)" : "1px solid var(--border)", borderRadius: 8, padding: "8px 12px", cursor: "pointer", display: "flex", alignItems: "center", gap: 10 }}
                >
                  <div style={{ display: "flex", gap: 3 }}>
                    {s.colors.map((c, i) => (
                      <div key={i} style={{ width: 14, height: 14, borderRadius: 3, background: c }} />
                    ))}
                  </div>
                  <span style={{ fontSize: 12, color: style === s.id ? "var(--gold)" : "var(--t2)", fontWeight: 600 }}>{s.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Brand Info */}
          <div style={{ background: "var(--s1)", border: "1px solid var(--border)", borderRadius: 12, padding: 16 }}>
            <div style={{ fontSize: 12, color: "var(--t3)", fontWeight: 700, marginBottom: 12, textTransform: "uppercase", letterSpacing: "0.06em" }}>DATOS DE MARCA</div>
            {[
              { key: "brandName", label: "Nombre de Marca *", value: brandName, set: setBrandName, placeholder: "Ej: Lumière Cosmetics" },
              { key: "productName", label: "Producto / Colección", value: productName, set: setProductName, placeholder: "Ej: Sérum Anti-Aging Gold" },
              { key: "tagline", label: "Tagline / Slogan", value: tagline, set: setTagline, placeholder: "Ej: Redefine tu belleza" },
            ].map(field => (
              <div key={field.key} style={{ marginBottom: 10 }}>
                <div style={{ fontSize: 11, color: "var(--t3)", marginBottom: 4 }}>{field.label}</div>
                <input
                  value={field.value}
                  onChange={e => field.set(e.target.value)}
                  placeholder={field.placeholder}
                  style={{ width: "100%", background: "var(--s2)", border: "1px solid var(--border)", borderRadius: 7, padding: "8px 10px", color: "var(--t1)", fontSize: 12, boxSizing: "border-box" }}
                />
              </div>
            ))}
            <div style={{ marginBottom: 0 }}>
              <div style={{ fontSize: 11, color: "var(--t3)", marginBottom: 4 }}>Instrucciones adicionales</div>
              <textarea
                value={extraInstructions}
                onChange={e => setExtraInstructions(e.target.value)}
                placeholder="Cualquier detalle extra: colores específicos, secciones, elementos..."
                style={{ width: "100%", background: "var(--s2)", border: "1px solid var(--border)", borderRadius: 7, padding: "8px 10px", color: "var(--t1)", fontSize: 12, resize: "vertical", minHeight: 70, boxSizing: "border-box" }}
              />
            </div>
          </div>

          <button
            onClick={generateFrame}
            disabled={generating || !brandName.trim()}
            style={{ background: brandName.trim() ? "var(--gold)" : "var(--s2)", color: brandName.trim() ? "#000" : "var(--t3)", border: "none", borderRadius: 10, padding: "13px 0", fontSize: 14, fontWeight: 700, cursor: brandName.trim() ? "pointer" : "not-allowed", display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}
          >
            {generating ? <><Loader2 size={16} style={{ animation: "spin 0.6s linear infinite" }} /> Generando...</> : <><Zap size={16} /> Generar Frame</>}
          </button>
        </div>

        {/* Preview / Output */}
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          {!generatedHtml ? (
            <div style={{ background: "var(--s1)", border: "1px solid var(--border)", borderRadius: 14, flex: 1, display: "flex", alignItems: "center", justifyContent: "center", minHeight: 400, flexDirection: "column", gap: 16, color: "var(--t3)" }}>
              <Globe size={48} style={{ color: "var(--t4)", opacity: 0.5 }} />
              <div style={{ textAlign: "center" }}>
                <div style={{ fontWeight: 600, marginBottom: 6, color: "var(--t2)" }}>Tu Frame aparecerá aquí</div>
                <div style={{ fontSize: 13 }}>Selecciona un template, configura tu marca<br />y haz clic en "Generar Frame"</div>
              </div>
            </div>
          ) : (
            <>
              {/* Toolbar */}
              <div style={{ background: "var(--s1)", border: "1px solid var(--border)", borderRadius: 12, padding: "12px 16px", display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                <span style={{ fontWeight: 700, fontSize: 13, color: "var(--gold)" }}>✓ Frame generado</span>
                <span style={{ fontSize: 12, color: "var(--t3)" }}>{selectedTemplate?.icon} {selectedTemplate?.label} · {selectedStyle?.label}</span>
                <div style={{ marginLeft: "auto", display: "flex", gap: 8 }}>
                  <button onClick={copyHtml} style={{ background: "var(--s2)", border: "1px solid var(--border)", borderRadius: 7, padding: "6px 12px", fontSize: 12, cursor: "pointer", color: "var(--t2)", display: "flex", alignItems: "center", gap: 4 }}>
                    {copiedId === "html" ? <><Check size={12} color="var(--jade)" /> Copiado</> : <><Copy size={12} /> HTML</>}
                  </button>
                  <button onClick={() => exportFrame("html")} disabled={exporting} style={{ background: "var(--s2)", border: "1px solid var(--border)", borderRadius: 7, padding: "6px 12px", fontSize: 12, cursor: "pointer", color: "var(--t2)", display: "flex", alignItems: "center", gap: 4 }}>
                    <Download size={12} /> .html
                  </button>
                  <button onClick={() => exportFrame("pdf")} disabled={exporting} style={{ background: "var(--s2)", border: "1px solid var(--border)", borderRadius: 7, padding: "6px 12px", fontSize: 12, cursor: "pointer", color: "var(--t2)", display: "flex", alignItems: "center", gap: 4 }}>
                    <Download size={12} /> PDF
                  </button>
                  <button onClick={() => exportFrame("mp4")} disabled={exporting} style={{ background: "var(--gold)", border: "none", borderRadius: 7, padding: "6px 12px", fontSize: 12, cursor: "pointer", color: "#000", fontWeight: 700, display: "flex", alignItems: "center", gap: 4 }}>
                    <Download size={12} /> MP4
                  </button>
                  <button onClick={generateFrame} disabled={generating} style={{ background: "var(--s2)", border: "1px solid var(--border)", borderRadius: 7, padding: "6px 10px", fontSize: 12, cursor: "pointer", color: "var(--t2)" }}>
                    <RefreshCw size={12} />
                  </button>
                </div>
              </div>

              {/* Preview iframe */}
              <div style={{ background: "var(--s1)", border: "1px solid var(--border)", borderRadius: 14, overflow: "hidden", flex: 1 }}>
                <div style={{ background: "var(--s2)", padding: "8px 14px", borderBottom: "1px solid var(--border)", display: "flex", gap: 6, alignItems: "center" }}>
                  <div style={{ display: "flex", gap: 5 }}>
                    <div style={{ width: 10, height: 10, borderRadius: "50%", background: "#f87171" }} />
                    <div style={{ width: 10, height: 10, borderRadius: "50%", background: "#fbbf24" }} />
                    <div style={{ width: 10, height: 10, borderRadius: "50%", background: "#4ade80" }} />
                  </div>
                  <div style={{ flex: 1, background: "var(--s1)", borderRadius: 6, padding: "3px 10px", fontSize: 11, color: "var(--t4)" }}>
                    {brandName} · {selectedTemplate?.label}
                  </div>
                  <Eye size={12} color="var(--t4)" />
                </div>
                <iframe
                  srcDoc={generatedHtml}
                  style={{ width: "100%", height: "600px", border: "none" }}
                  sandbox="allow-scripts"
                  title="HyperFrame Preview"
                />
              </div>

              {/* Code view */}
              <details style={{ background: "var(--s1)", border: "1px solid var(--border)", borderRadius: 12 }}>
                <summary style={{ padding: "12px 16px", cursor: "pointer", fontSize: 13, color: "var(--t2)", fontWeight: 600, display: "flex", alignItems: "center", gap: 6 }}>
                  <Code2 size={14} /> Ver código HTML ({(generatedHtml.length / 1024).toFixed(1)} KB)
                </summary>
                <div style={{ borderTop: "1px solid var(--border)", padding: 16 }}>
                  <pre style={{ margin: 0, fontSize: 11, color: "var(--t2)", whiteSpace: "pre-wrap", fontFamily: "monospace", maxHeight: 300, overflowY: "auto", lineHeight: 1.5 }}>
                    {generatedHtml.substring(0, 3000)}{generatedHtml.length > 3000 ? "\n\n... (truncado - descarga el HTML para ver completo)" : ""}
                  </pre>
                </div>
              </details>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function X({ size }: { size: number }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path d="M18 6 6 18M6 6l12 12" /></svg>;
}
