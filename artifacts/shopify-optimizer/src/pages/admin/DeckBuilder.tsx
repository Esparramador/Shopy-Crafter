import { useState } from "react";
import { LayoutTemplate, Download, Loader2, AlertCircle, ChevronLeft, ChevronRight, Plus, Trash2, Sparkles, Eye } from "lucide-react";

const API_BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

interface DeckSlide {
  title: string;
  content: string;
  type: "cover" | "agenda" | "content" | "data" | "quote" | "cta" | "team" | "closing";
  notes?: string;
}

const DECK_TYPES = [
  { id: "pitch", label: "Pitch Deck", icon: "🚀", desc: "Presentación para inversores o clientes" },
  { id: "product", label: "Product Demo", icon: "📦", desc: "Demostración de producto o servicio" },
  { id: "marketing", label: "Marketing Plan", icon: "📣", desc: "Plan de marketing y estrategia" },
  { id: "quarterly", label: "Quarterly Review", icon: "📊", desc: "Reporte trimestral de resultados" },
  { id: "brand", label: "Brand Guidelines", icon: "🎨", desc: "Manual de marca e identidad visual" },
  { id: "proposal", label: "Proposal", icon: "📋", desc: "Propuesta comercial para clientes" },
  { id: "case-study", label: "Case Study", icon: "📖", desc: "Caso de éxito y resultados" },
  { id: "workshop", label: "Workshop", icon: "🎓", desc: "Presentación educativa o taller" },
];

const THEME_PRESETS = [
  { id: "dark-gold", label: "Dark Gold", bg: "#0a0a0a", text: "#ffffff", accent: "#d4af37" },
  { id: "jade-tech", label: "Jade Tech", bg: "#0a1a12", text: "#ffffff", accent: "#3de8a0" },
  { id: "corporate-blue", label: "Corporate Blue", bg: "#0a0f1a", text: "#ffffff", accent: "#60a5fa" },
  { id: "luxury-dark", label: "Luxury Dark", bg: "#12080a", text: "#ffffff", accent: "#e879f9" },
  { id: "clean-white", label: "Clean White", bg: "#ffffff", text: "#1a1a1a", accent: "#2563eb" },
  { id: "warm-brand", label: "Warm Brand", bg: "#1a0a08", text: "#ffffff", accent: "#fb923c" },
];

const SLIDE_TYPE_META = {
  cover: { label: "Portada", icon: "🏠", color: "#d4af37" },
  agenda: { label: "Agenda", icon: "📋", color: "#60a5fa" },
  content: { label: "Contenido", icon: "📝", color: "#4ade80" },
  data: { label: "Datos", icon: "📊", color: "#a78bfa" },
  quote: { label: "Cita", icon: "💬", color: "#34d399" },
  cta: { label: "CTA", icon: "🎯", color: "#fb923c" },
  team: { label: "Equipo", icon: "👥", color: "#22d3ee" },
  closing: { label: "Cierre", icon: "✅", color: "#f59e0b" },
};

export default function DeckBuilder() {
  const [deckType, setDeckType] = useState("pitch");
  const [theme, setTheme] = useState("dark-gold");
  const [brandName, setBrandName] = useState("");
  const [deckTitle, setDeckTitle] = useState("");
  const [audience, setAudience] = useState("");
  const [numSlides, setNumSlides] = useState(10);
  const [generating, setGenerating] = useState(false);
  const [slides, setSlides] = useState<DeckSlide[]>([]);
  const [currentSlide, setCurrentSlide] = useState(0);
  const [exporting, setExporting] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [editingSlide, setEditingSlide] = useState<number | null>(null);

  const selectedTheme = THEME_PRESETS.find(t => t.id === theme) || THEME_PRESETS[0];

  async function generateDeck() {
    if (!brandName.trim() || !deckTitle.trim()) {
      setError("Rellena la marca y el título del deck");
      return;
    }
    setGenerating(true);
    setError(null);
    setSlides([]);

    try {
      const r = await fetch(`${API_BASE}/api/hyperframes/deck/slides`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ deckType, theme, brandName, deckTitle, audience, numSlides }),
      });
      if (!r.ok) {
        const err = await r.json();
        throw new Error(err.error || "Error generando deck");
      }
      const data = await r.json();
      setSlides(data.slides || []);
      setCurrentSlide(0);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Error desconocido");
    } finally {
      setGenerating(false);
    }
  }

  async function exportDeck(format: "pptx" | "pdf") {
    if (slides.length === 0) return;
    setExporting(format);
    try {
      if (format === "pdf") {
        // PDF: documento imprimible con las diapositivas (Guardar como PDF del navegador).
        const esc = (t: string) => t.replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));
        const t = selectedTheme;
        const html = `<!doctype html><html><head><meta charset="utf-8"><title>${esc(deckTitle)}</title><style>
@page{size:1280px 720px;margin:0}body{margin:0;font-family:Arial,sans-serif}
.s{width:1280px;height:720px;box-sizing:border-box;padding:80px;background:${t.bg};color:${t.text};page-break-after:always;display:flex;flex-direction:column;justify-content:center}
h1{color:${t.accent};font-size:48px;margin:0 0 32px}p{font-size:26px;line-height:1.5;white-space:pre-line;margin:0}
</style></head><body>${slides.map(s => `<section class="s"><h1>${esc(s.title)}</h1><p>${esc(s.content)}</p></section>`).join("")}
<script>window.onload=()=>{window.print()}</script></body></html>`;
        const w = window.open("", "_blank");
        if (!w) throw new Error("El navegador bloqueó la ventana de impresión");
        w.document.write(html);
        w.document.close();
        return;
      }
      const r = await fetch(`${API_BASE}/api/hyperframes/pptx/export`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ slides, deckTitle, themeColors: { bg: selectedTheme.bg, text: selectedTheme.text, accent: selectedTheme.accent } }),
      });
      if (!r.ok) {
        const err = await r.json().catch(() => ({}));
        throw new Error((err as { error?: string }).error || "Error exportando");
      }
      const blob = await r.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${brandName.replace(/\s+/g, "-")}-${deckTitle.replace(/\s+/g, "-")}.pptx`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Error exportando");
    } finally {
      setExporting(null);
    }
  }

  function updateSlide(idx: number, updates: Partial<DeckSlide>) {
    setSlides(prev => prev.map((s, i) => i === idx ? { ...s, ...updates } : s));
  }

  function addSlide() {
    const newSlide: DeckSlide = { title: "Nueva Diapositiva", content: "Contenido aquí...", type: "content" };
    setSlides(prev => [...prev, newSlide]);
    setCurrentSlide(slides.length);
  }

  function deleteSlide(idx: number) {
    if (slides.length <= 1) return;
    setSlides(prev => prev.filter((_, i) => i !== idx));
    setCurrentSlide(prev => Math.min(prev, slides.length - 2));
  }

  const slide = slides[currentSlide];
  const slideTypeMeta = slide ? SLIDE_TYPE_META[slide.type] || SLIDE_TYPE_META.content : null;

  return (
    <div style={{ padding: "24px", maxWidth: 1400, margin: "0 auto" }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 24 }}>
        <div style={{ width: 44, height: 44, borderRadius: 12, background: "linear-gradient(135deg, #fb923c, #c2410c)", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <LayoutTemplate size={22} color="#fff" />
        </div>
        <div>
          <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700, color: "var(--t1)" }}>Deck Builder</h1>
          <p style={{ margin: 0, fontSize: 13, color: "var(--t3)" }}>Genera presentaciones profesionales con IA — exporta a PPTX o PDF</p>
        </div>
        {slides.length > 0 && (
          <div style={{ marginLeft: "auto", display: "flex", gap: 8 }}>
            <button
              onClick={() => exportDeck("pptx")}
              disabled={!!exporting}
              style={{ background: "var(--gold)", color: "#000", border: "none", borderRadius: 8, padding: "9px 16px", fontSize: 13, fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", gap: 6 }}
            >
              {exporting === "pptx" ? <Loader2 size={14} style={{ animation: "spin 0.6s linear infinite" }} /> : <Download size={14} />}
              PPTX
            </button>
            <button
              onClick={() => exportDeck("pdf")}
              disabled={!!exporting}
              style={{ background: "var(--s1)", color: "var(--t2)", border: "1px solid var(--border)", borderRadius: 8, padding: "9px 16px", fontSize: 13, fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", gap: 6 }}
            >
              {exporting === "pdf" ? <Loader2 size={14} style={{ animation: "spin 0.6s linear infinite" }} /> : <Download size={14} />}
              PDF
            </button>
          </div>
        )}
      </div>

      {error && (
        <div style={{ background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.3)", borderRadius: 10, padding: "12px 16px", marginBottom: 16, color: "#f87171", display: "flex", gap: 8, alignItems: "center" }}>
          <AlertCircle size={16} /> {error}
          <button onClick={() => setError(null)} style={{ marginLeft: "auto", background: "none", border: "none", cursor: "pointer", color: "#f87171" }}>✕</button>
        </div>
      )}

      {slides.length === 0 ? (
        /* Config View */
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
          {/* Left: Type + Theme */}
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            {/* Deck Type */}
            <div style={{ background: "var(--s1)", border: "1px solid var(--border)", borderRadius: 12, padding: 18 }}>
              <div style={{ fontSize: 12, color: "var(--t3)", fontWeight: 700, marginBottom: 14, textTransform: "uppercase", letterSpacing: "0.06em" }}>TIPO DE PRESENTACIÓN</div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                {DECK_TYPES.map(dt => (
                  <button
                    key={dt.id}
                    onClick={() => setDeckType(dt.id)}
                    style={{ background: deckType === dt.id ? "rgba(212,175,55,0.15)" : "var(--s2)", border: deckType === dt.id ? "1.5px solid var(--gold)" : "1px solid var(--border)", borderRadius: 8, padding: "10px", cursor: "pointer", textAlign: "left" }}
                  >
                    <div style={{ fontSize: 18, marginBottom: 4 }}>{dt.icon}</div>
                    <div style={{ fontSize: 12, fontWeight: 700, color: deckType === dt.id ? "var(--gold)" : "var(--t1)" }}>{dt.label}</div>
                    <div style={{ fontSize: 10, color: "var(--t4)", marginTop: 2, lineHeight: 1.4 }}>{dt.desc}</div>
                  </button>
                ))}
              </div>
            </div>

            {/* Theme */}
            <div style={{ background: "var(--s1)", border: "1px solid var(--border)", borderRadius: 12, padding: 18 }}>
              <div style={{ fontSize: 12, color: "var(--t3)", fontWeight: 700, marginBottom: 14, textTransform: "uppercase", letterSpacing: "0.06em" }}>TEMA VISUAL</div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                {THEME_PRESETS.map(t => (
                  <button
                    key={t.id}
                    onClick={() => setTheme(t.id)}
                    style={{ background: theme === t.id ? `${t.accent}22` : "var(--s2)", border: theme === t.id ? `1.5px solid ${t.accent}` : "1px solid var(--border)", borderRadius: 8, padding: "10px", cursor: "pointer", display: "flex", alignItems: "center", gap: 8 }}
                  >
                    <div style={{ width: 28, height: 20, borderRadius: 4, background: t.bg, border: "1px solid rgba(255,255,255,0.1)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                      <div style={{ width: 10, height: 10, borderRadius: 2, background: t.accent }} />
                    </div>
                    <span style={{ fontSize: 11, fontWeight: 600, color: theme === t.id ? t.accent : "var(--t2)" }}>{t.label}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Right: Brand Info */}
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <div style={{ background: "var(--s1)", border: "1px solid var(--border)", borderRadius: 12, padding: 18 }}>
              <div style={{ fontSize: 12, color: "var(--t3)", fontWeight: 700, marginBottom: 14, textTransform: "uppercase", letterSpacing: "0.06em" }}>INFORMACIÓN DEL DECK</div>
              {[
                { key: "brandName", label: "Nombre de Empresa / Marca *", value: brandName, set: setBrandName, placeholder: "Ej: ShopyCrafter" },
                { key: "deckTitle", label: "Título de la Presentación *", value: deckTitle, set: setDeckTitle, placeholder: "Ej: Estrategia de Marketing Q3 2026" },
                { key: "audience", label: "Audiencia objetivo", value: audience, set: setAudience, placeholder: "Ej: Inversores, Clientes enterprise, Equipo interno..." },
              ].map(f => (
                <div key={f.key} style={{ marginBottom: 12 }}>
                  <div style={{ fontSize: 11, color: "var(--t3)", marginBottom: 4 }}>{f.label}</div>
                  <input value={f.value} onChange={e => f.set(e.target.value)} placeholder={f.placeholder} style={{ width: "100%", background: "var(--s2)", border: "1px solid var(--border)", borderRadius: 7, padding: "9px 11px", color: "var(--t1)", fontSize: 13, boxSizing: "border-box" }} />
                </div>
              ))}
              <div style={{ marginBottom: 0 }}>
                <div style={{ fontSize: 11, color: "var(--t3)", marginBottom: 4 }}>Número de slides: <strong style={{ color: "var(--gold)" }}>{numSlides}</strong></div>
                <input
                  type="range" min={5} max={20} value={numSlides}
                  onChange={e => setNumSlides(Number(e.target.value))}
                  style={{ width: "100%", accentColor: "var(--gold)" }}
                />
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10, color: "var(--t4)", marginTop: 2 }}>
                  <span>5</span><span>10</span><span>15</span><span>20</span>
                </div>
              </div>
            </div>

            {/* Preview card */}
            <div style={{ background: selectedTheme.bg, border: "1px solid var(--border)", borderRadius: 12, padding: 24, flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minHeight: 160 }}>
              <div style={{ fontSize: 11, color: selectedTheme.accent, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 8 }}>VISTA PREVIA DEL TEMA</div>
              <div style={{ fontSize: 20, fontWeight: 900, color: selectedTheme.text, textAlign: "center", marginBottom: 6 }}>
                {brandName || "Tu Marca"}
              </div>
              <div style={{ fontSize: 13, color: selectedTheme.accent, textAlign: "center" }}>
                {deckTitle || "Título de la Presentación"}
              </div>
              <div style={{ width: 40, height: 2, background: selectedTheme.accent, borderRadius: 1, marginTop: 12 }} />
            </div>

            <button
              onClick={generateDeck}
              disabled={generating || !brandName.trim() || !deckTitle.trim()}
              style={{ background: brandName.trim() && deckTitle.trim() ? "var(--gold)" : "var(--s2)", color: brandName.trim() && deckTitle.trim() ? "#000" : "var(--t3)", border: "none", borderRadius: 10, padding: "14px 0", fontSize: 14, fontWeight: 700, cursor: brandName.trim() && deckTitle.trim() ? "pointer" : "not-allowed", display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}
            >
              {generating ? <><Loader2 size={16} style={{ animation: "spin 0.6s linear infinite" }} /> Generando {numSlides} slides...</> : <><Sparkles size={16} /> Generar Deck con IA</>}
            </button>
          </div>
        </div>
      ) : (
        /* Editor View */
        <div style={{ display: "grid", gridTemplateColumns: "220px 1fr 300px", gap: 16 }}>
          {/* Slide List */}
          <div style={{ background: "var(--s1)", border: "1px solid var(--border)", borderRadius: 12, padding: 12, maxHeight: "80vh", overflowY: "auto" }}>
            <div style={{ fontSize: 11, color: "var(--t4)", fontWeight: 700, marginBottom: 10, textTransform: "uppercase", letterSpacing: "0.06em" }}>SLIDES ({slides.length})</div>
            {slides.map((s, idx) => {
              const meta = SLIDE_TYPE_META[s.type] || SLIDE_TYPE_META.content;
              return (
                <button
                  key={idx}
                  onClick={() => { setCurrentSlide(idx); setEditingSlide(null); }}
                  style={{ width: "100%", textAlign: "left", background: currentSlide === idx ? "rgba(212,175,55,0.15)" : "transparent", border: currentSlide === idx ? "1px solid var(--gold)" : "1px solid transparent", borderRadius: 7, padding: "8px 10px", cursor: "pointer", marginBottom: 4 }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <span style={{ fontSize: 10, color: "var(--t4)" }}>{idx + 1}</span>
                    <span style={{ fontSize: 12 }}>{meta.icon}</span>
                    <span style={{ fontSize: 11, color: currentSlide === idx ? "var(--gold)" : "var(--t2)", fontWeight: 600, flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{s.title}</span>
                  </div>
                </button>
              );
            })}
            <button
              onClick={addSlide}
              style={{ width: "100%", background: "var(--s2)", border: "1px dashed var(--border)", borderRadius: 7, padding: "8px 10px", cursor: "pointer", color: "var(--t3)", fontSize: 11, display: "flex", alignItems: "center", gap: 4, marginTop: 8 }}
            >
              <Plus size={12} /> Agregar slide
            </button>
          </div>

          {/* Slide Preview */}
          <div>
            {/* Nav */}
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
              <button onClick={() => setCurrentSlide(Math.max(0, currentSlide - 1))} disabled={currentSlide === 0} style={{ background: "var(--s1)", border: "1px solid var(--border)", borderRadius: 7, padding: "6px 10px", cursor: "pointer", color: "var(--t2)" }}>
                <ChevronLeft size={16} />
              </button>
              <span style={{ fontSize: 13, color: "var(--t2)", flex: 1, textAlign: "center" }}>Slide {currentSlide + 1} de {slides.length}</span>
              <button onClick={() => setCurrentSlide(Math.min(slides.length - 1, currentSlide + 1))} disabled={currentSlide === slides.length - 1} style={{ background: "var(--s1)", border: "1px solid var(--border)", borderRadius: 7, padding: "6px 10px", cursor: "pointer", color: "var(--t2)" }}>
                <ChevronRight size={16} />
              </button>
            </div>

            {/* Slide canvas */}
            {slide && (
              <div style={{ background: selectedTheme.bg, borderRadius: 14, padding: "48px 56px", minHeight: 360, display: "flex", flexDirection: "column", justifyContent: slide.type === "cover" ? "center" : "flex-start", position: "relative", border: "1px solid var(--border)" }}>
                <div style={{ position: "absolute", top: 16, right: 20, fontSize: 10, color: selectedTheme.accent, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em" }}>
                  {brandName}
                </div>
                <div style={{ position: "absolute", bottom: 16, right: 20, fontSize: 10, color: `${selectedTheme.accent}66` }}>
                  {currentSlide + 1} / {slides.length}
                </div>

                {slide.type === "cover" ? (
                  <div style={{ textAlign: "center" }}>
                    <div style={{ width: 3, height: 40, background: selectedTheme.accent, margin: "0 auto 20px" }} />
                    <div style={{ fontSize: 32, fontWeight: 900, color: selectedTheme.text, marginBottom: 12, lineHeight: 1.2 }}>{slide.title}</div>
                    <div style={{ fontSize: 16, color: selectedTheme.accent, marginBottom: 20 }}>{slide.content}</div>
                    <div style={{ width: 60, height: 2, background: selectedTheme.accent, margin: "0 auto" }} />
                  </div>
                ) : (
                  <>
                    <div style={{ fontSize: 10, color: selectedTheme.accent, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 12 }}>
                      {slideTypeMeta?.icon} {slideTypeMeta?.label}
                    </div>
                    <div style={{ fontSize: 24, fontWeight: 800, color: selectedTheme.text, marginBottom: 20, lineHeight: 1.3 }}>{slide.title}</div>
                    <div style={{ width: 40, height: 3, background: selectedTheme.accent, borderRadius: 2, marginBottom: 20 }} />
                    <div style={{ fontSize: 14, color: `${selectedTheme.text}cc`, lineHeight: 1.8, whiteSpace: "pre-wrap" }}>{slide.content}</div>
                  </>
                )}
              </div>
            )}
          </div>

          {/* Edit Panel */}
          {slide && (
            <div style={{ background: "var(--s1)", border: "1px solid var(--border)", borderRadius: 12, padding: 16, maxHeight: "80vh", overflowY: "auto" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
                <div style={{ fontSize: 12, color: "var(--t3)", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em" }}>EDITAR SLIDE</div>
                <button onClick={() => deleteSlide(currentSlide)} style={{ background: "rgba(239,68,68,0.1)", border: "none", borderRadius: 6, padding: "4px 8px", cursor: "pointer", color: "#f87171" }}>
                  <Trash2 size={12} />
                </button>
              </div>

              <div style={{ marginBottom: 10 }}>
                <div style={{ fontSize: 11, color: "var(--t3)", marginBottom: 4 }}>Tipo</div>
                <select
                  value={slide.type}
                  onChange={e => updateSlide(currentSlide, { type: e.target.value as DeckSlide["type"] })}
                  style={{ width: "100%", background: "var(--s2)", border: "1px solid var(--border)", borderRadius: 7, padding: "7px 10px", color: "var(--t1)", fontSize: 12 }}
                >
                  {Object.entries(SLIDE_TYPE_META).map(([k, v]) => (
                    <option key={k} value={k}>{v.icon} {v.label}</option>
                  ))}
                </select>
              </div>

              <div style={{ marginBottom: 10 }}>
                <div style={{ fontSize: 11, color: "var(--t3)", marginBottom: 4 }}>Título</div>
                <input
                  value={slide.title}
                  onChange={e => updateSlide(currentSlide, { title: e.target.value })}
                  style={{ width: "100%", background: "var(--s2)", border: "1px solid var(--border)", borderRadius: 7, padding: "7px 10px", color: "var(--t1)", fontSize: 12, boxSizing: "border-box" }}
                />
              </div>

              <div style={{ marginBottom: 10 }}>
                <div style={{ fontSize: 11, color: "var(--t3)", marginBottom: 4 }}>Contenido</div>
                <textarea
                  value={slide.content}
                  onChange={e => updateSlide(currentSlide, { content: e.target.value })}
                  rows={10}
                  style={{ width: "100%", background: "var(--s2)", border: "1px solid var(--border)", borderRadius: 7, padding: "7px 10px", color: "var(--t1)", fontSize: 12, resize: "vertical", boxSizing: "border-box", lineHeight: 1.6 }}
                />
              </div>

              <div>
                <div style={{ fontSize: 11, color: "var(--t3)", marginBottom: 4 }}>Notas del presentador</div>
                <textarea
                  value={slide.notes || ""}
                  onChange={e => updateSlide(currentSlide, { notes: e.target.value })}
                  placeholder="Notas privadas para el presentador..."
                  rows={4}
                  style={{ width: "100%", background: "var(--s2)", border: "1px solid var(--border)", borderRadius: 7, padding: "7px 10px", color: "var(--t1)", fontSize: 11, resize: "vertical", boxSizing: "border-box", lineHeight: 1.6 }}
                />
              </div>

              <div style={{ marginTop: 14, display: "flex", gap: 6 }}>
                <button
                  onClick={() => exportDeck("pptx")}
                  disabled={!!exporting}
                  style={{ flex: 1, background: "var(--gold)", color: "#000", border: "none", borderRadius: 7, padding: "9px 0", fontSize: 12, fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 4 }}
                >
                  {exporting === "pptx" ? <Loader2 size={12} style={{ animation: "spin 0.6s linear infinite" }} /> : <Download size={12} />}
                  PPTX
                </button>
                <button
                  onClick={() => exportDeck("pdf")}
                  disabled={!!exporting}
                  style={{ flex: 1, background: "var(--s2)", color: "var(--t2)", border: "1px solid var(--border)", borderRadius: 7, padding: "9px 0", fontSize: 12, fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 4 }}
                >
                  {exporting === "pdf" ? <Loader2 size={12} style={{ animation: "spin 0.6s linear infinite" }} /> : <Download size={12} />}
                  PDF
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
