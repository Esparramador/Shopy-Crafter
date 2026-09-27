import { useState, useEffect } from "react";
import { Palette, Download, Copy, Check, Search, Loader2, AlertCircle, X, Eye, Sparkles, FileText, LayoutTemplate } from "lucide-react";

const API_BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

interface ColorToken {
  name: string;
  hex: string;
  usage: string;
}

interface TypographyToken {
  role: string;
  family: string;
  size: string;
  weight: string;
}

interface DesignSystem {
  id: string;
  brand: string;
  industry: string;
  sector: string;
  primaryColor: string;
  secondaryColor: string;
  accentColor: string;
  backgroundColor: string;
  textColor: string;
  colorTokens: ColorToken[];
  typography: TypographyToken[];
  borderRadius: string;
  spacing: string;
  shadowStyle: string;
  tone: string;
  personality: string[];
  targetAudience: string;
  designPrinciples: string[];
  logoStyle: string;
  iconStyle: string;
  imageStyle: string;
  patternStyle: string;
  description: string;
  tags: string[];
  inspiration: string[];
}

const SECTOR_META: Record<string, { icon: string; color: string }> = {
  tech: { icon: "💻", color: "#60a5fa" },
  fashion: { icon: "👗", color: "#f472b6" },
  food: { icon: "🍽️", color: "#fb923c" },
  finance: { icon: "💰", color: "#4ade80" },
  beauty: { icon: "💄", color: "#e879f9" },
  travel: { icon: "✈️", color: "#22d3ee" },
  automotive: { icon: "🚗", color: "#94a3b8" },
  saas: { icon: "⚡", color: "#a78bfa" },
  ecommerce: { icon: "🛒", color: "#f59e0b" },
  health: { icon: "🏥", color: "#34d399" },
};

export default function DesignSystems() {
  const [systems, setSystems] = useState<DesignSystem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterSector, setFilterSector] = useState("");
  const [selected, setSelected] = useState<DesignSystem | null>(null);
  const [generating, setGenerating] = useState(false);
  const [generatedMd, setGeneratedMd] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [applying, setApplying] = useState(false);
  const [applyMsg, setApplyMsg] = useState<string | null>(null);

  useEffect(() => { fetchSystems(); }, []);

  async function fetchSystems() {
    try {
      const r = await fetch(`${API_BASE}/api/design-systems?limit=200`, { credentials: "include" });
      if (!r.ok) throw new Error("Error cargando sistemas de diseño");
      const data = await r.json();
      setSystems(data.systems || []);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Error desconocido");
    } finally {
      setLoading(false);
    }
  }

  async function generateDesignMd(ds: DesignSystem) {
    setGenerating(true);
    setGeneratedMd(null);
    try {
      // El DESIGN.md de un sistema existente lo sirve GET /design-systems/:id/design-md
      // (antes POST /design-systems/:id/generate, que no existe).
      const r = await fetch(`${API_BASE}/api/design-systems/${ds.id}/design-md`, { credentials: "include" });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error || `Error ${r.status}`);
      setGeneratedMd(data.markdown || "");
    } catch (e: unknown) {
      setGeneratedMd(`Error: ${e instanceof Error ? e.message : "Desconocido"}`);
    } finally {
      setGenerating(false);
    }
  }

  async function applySystem(ds: DesignSystem) {
    setApplying(true);
    setApplyMsg(null);
    try {
      const r = await fetch(`${API_BASE}/api/design-systems/${ds.id}/apply`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({}),
      });
      const data = await r.json();
      setApplyMsg(data.message || "Sistema aplicado correctamente");
    } catch (e: unknown) {
      setApplyMsg(`Error: ${e instanceof Error ? e.message : "Desconocido"}`);
    } finally {
      setApplying(false);
    }
  }

  function copyText(text: string, id: string) {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  }

  function downloadMd(ds: DesignSystem, md: string) {
    const blob = new Blob([md], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `DESIGN-${ds.brand.replace(/\s+/g, "-")}.md`;
    a.click();
    URL.revokeObjectURL(url);
  }

  const sectors = [...new Set(systems.map(s => s.sector))].filter(s => SECTOR_META[s]);
  const filtered = systems.filter(s => {
    const q = search.toLowerCase();
    return (
      (!filterSector || s.sector === filterSector) &&
      (!q || s.brand.toLowerCase().includes(q) || s.industry.toLowerCase().includes(q) || s.tone.toLowerCase().includes(q) || s.tags.some(t => t.includes(q)))
    );
  });

  return (
    <div style={{ padding: "24px", maxWidth: 1400, margin: "0 auto" }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 24 }}>
        <div style={{ width: 44, height: 44, borderRadius: 12, background: "linear-gradient(135deg, #e879f9, #a21caf)", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <Palette size={22} color="#fff" />
        </div>
        <div>
          <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700, color: "var(--t1)" }}>Design Systems</h1>
          <p style={{ margin: 0, fontSize: 13, color: "var(--t3)" }}>{systems.length} sistemas de diseño de marcas globales — genera tu DESIGN.md</p>
        </div>
      </div>

      {error && (
        <div style={{ background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.3)", borderRadius: 10, padding: "12px 16px", marginBottom: 16, color: "#f87171", display: "flex", gap: 8 }}>
          <AlertCircle size={16} /> {error}
        </div>
      )}

      {/* Sector filters */}
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 16 }}>
        <button onClick={() => setFilterSector("")} style={{ padding: "7px 14px", borderRadius: 20, fontSize: 12, fontWeight: 600, cursor: "pointer", background: !filterSector ? "var(--gold)" : "var(--s1)", color: !filterSector ? "#000" : "var(--t2)", border: !filterSector ? "none" : "1px solid var(--border)" }}>
          🌐 Todos ({systems.length})
        </button>
        {sectors.map(sec => {
          const meta = SECTOR_META[sec] || { icon: "🏢", color: "var(--gold)" };
          const count = systems.filter(s => s.sector === sec).length;
          return (
            <button key={sec} onClick={() => setFilterSector(sec === filterSector ? "" : sec)} style={{ padding: "7px 14px", borderRadius: 20, fontSize: 12, fontWeight: 600, cursor: "pointer", background: filterSector === sec ? meta.color : "var(--s1)", color: filterSector === sec ? "#000" : "var(--t2)", border: filterSector === sec ? "none" : "1px solid var(--border)" }}>
              {meta.icon} {sec} ({count})
            </button>
          );
        })}
      </div>

      {/* Search */}
      <div style={{ position: "relative", marginBottom: 20 }}>
        <Search size={16} style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: "var(--t4)" }} />
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar marca, industria, tono..." style={{ width: "100%", background: "var(--s1)", border: "1px solid var(--border)", borderRadius: 10, padding: "10px 12px 10px 38px", color: "var(--t1)", fontSize: 14, boxSizing: "border-box" }} />
        {search && <button onClick={() => setSearch("")} style={{ position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", color: "var(--t4)" }}><X size={14} /></button>}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: selected ? "1fr 460px" : "1fr", gap: 20 }}>
        {/* Grid */}
        <div>
          {loading ? (
            <div style={{ textAlign: "center", padding: "60px 0" }}>
              <Loader2 size={28} style={{ animation: "spin 0.6s linear infinite", color: "var(--gold)" }} />
              <div style={{ marginTop: 12, color: "var(--t3)" }}>Cargando sistemas de diseño...</div>
            </div>
          ) : (
            <>
              <div style={{ fontSize: 12, color: "var(--t3)", marginBottom: 12 }}>{filtered.length} sistemas encontrados</div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: 12 }}>
                {filtered.map(ds => {
                  const secMeta = SECTOR_META[ds.sector] || { icon: "🏢", color: "var(--gold)" };
                  const isSelected = selected?.id === ds.id;
                  return (
                    <div
                      key={ds.id}
                      onClick={() => { setSelected(ds); setGeneratedMd(null); setApplyMsg(null); }}
                      style={{ background: isSelected ? `${ds.primaryColor}11` : "var(--s1)", border: isSelected ? `2px solid ${ds.primaryColor}` : "1px solid var(--border)", borderRadius: 12, padding: 14, cursor: "pointer", transition: "all 0.15s" }}
                    >
                      {/* Color strip */}
                      <div style={{ display: "flex", gap: 3, marginBottom: 10, borderRadius: 6, overflow: "hidden", height: 8 }}>
                        <div style={{ flex: 1, background: ds.primaryColor }} />
                        <div style={{ flex: 1, background: ds.secondaryColor }} />
                        <div style={{ flex: 1, background: ds.accentColor }} />
                        <div style={{ flex: 1, background: ds.backgroundColor }} />
                      </div>
                      <div style={{ fontWeight: 700, fontSize: 14, color: "var(--t1)", marginBottom: 4 }}>{ds.brand}</div>
                      <div style={{ fontSize: 11, color: secMeta.color, fontWeight: 600, marginBottom: 6 }}>{secMeta.icon} {ds.industry}</div>
                      <div style={{ fontSize: 11.5, color: "var(--t3)", marginBottom: 8, lineHeight: 1.5 }}>{ds.description}</div>
                      <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                        {ds.personality.slice(0, 3).map(p => (
                          <span key={p} style={{ background: "var(--s2)", borderRadius: 4, padding: "1px 6px", fontSize: 10, color: "var(--t3)" }}>{p}</span>
                        ))}
                      </div>
                      <div style={{ marginTop: 8, fontSize: 11, color: "var(--t4)" }}>Tono: {ds.tone}</div>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </div>

        {/* Detail Panel */}
        {selected && (
          <div style={{ background: "var(--s1)", border: "1px solid var(--border)", borderRadius: 14, overflow: "hidden", alignSelf: "start", position: "sticky", top: 20 }}>
            <div style={{ height: 6, background: `linear-gradient(90deg, ${selected.primaryColor}, ${selected.secondaryColor}, ${selected.accentColor})` }} />
            <div style={{ padding: "16px 18px", borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center", gap: 10 }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 700, fontSize: 16, color: "var(--t1)" }}>{selected.brand}</div>
                <div style={{ fontSize: 12, color: "var(--t3)" }}>{selected.industry} · {selected.sector}</div>
              </div>
              <button onClick={() => setSelected(null)} style={{ background: "var(--s2)", border: "none", borderRadius: 6, padding: 6, cursor: "pointer", color: "var(--t3)" }}><X size={14} /></button>
            </div>
            <div style={{ padding: 18, maxHeight: "70vh", overflowY: "auto" }}>
              {/* Colors */}
              <div style={{ marginBottom: 16 }}>
                <div style={{ fontSize: 11, color: "var(--t4)", fontWeight: 700, marginBottom: 8, textTransform: "uppercase", letterSpacing: "0.06em" }}>PALETA</div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
                  {selected.colorTokens.slice(0, 6).map(ct => (
                    <div key={ct.name} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <div style={{ width: 20, height: 20, borderRadius: 4, background: ct.hex, border: "1px solid rgba(255,255,255,0.1)", flexShrink: 0 }} />
                      <div>
                        <div style={{ fontSize: 10, color: "var(--t1)", fontWeight: 600 }}>{ct.name}</div>
                        <div style={{ fontSize: 9, color: "var(--t4)" }}>{ct.hex}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              {/* Typography */}
              <div style={{ marginBottom: 16 }}>
                <div style={{ fontSize: 11, color: "var(--t4)", fontWeight: 700, marginBottom: 8, textTransform: "uppercase", letterSpacing: "0.06em" }}>TIPOGRAFÍA</div>
                {selected.typography.map(t => (
                  <div key={t.role} style={{ display: "flex", justifyContent: "space-between", marginBottom: 4, fontSize: 12 }}>
                    <span style={{ color: "var(--t3)" }}>{t.role}</span>
                    <span style={{ color: "var(--t1)", fontWeight: 600 }}>{t.family}</span>
                  </div>
                ))}
              </div>
              {/* Principles */}
              <div style={{ marginBottom: 16 }}>
                <div style={{ fontSize: 11, color: "var(--t4)", fontWeight: 700, marginBottom: 8, textTransform: "uppercase", letterSpacing: "0.06em" }}>PRINCIPIOS</div>
                {selected.designPrinciples.map(p => (
                  <div key={p} style={{ display: "flex", gap: 6, marginBottom: 4, fontSize: 12, color: "var(--t2)" }}>
                    <span style={{ color: selected.primaryColor }}>◆</span> {p}
                  </div>
                ))}
              </div>

              {/* Actions */}
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                <button
                  onClick={() => generateDesignMd(selected)}
                  disabled={generating}
                  style={{ background: "var(--gold)", color: "#000", border: "none", borderRadius: 8, padding: "10px 0", fontSize: 13, fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}
                >
                  {generating ? <Loader2 size={14} style={{ animation: "spin 0.6s linear infinite" }} /> : <Sparkles size={14} />}
                  Generar DESIGN.md
                </button>
                <button
                  onClick={() => applySystem(selected)}
                  disabled={applying}
                  style={{ background: "var(--jade)", color: "#fff", border: "none", borderRadius: 8, padding: "10px 0", fontSize: 13, fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}
                >
                  {applying ? <Loader2 size={14} style={{ animation: "spin 0.6s linear infinite" }} /> : <Eye size={14} />}
                  Aplicar Sistema
                </button>
              </div>

              {applyMsg && (
                <div style={{ marginTop: 10, background: "rgba(52,211,153,0.1)", border: "1px solid rgba(52,211,153,0.3)", borderRadius: 8, padding: "10px 12px", fontSize: 12, color: "#34d399" }}>
                  ✓ {applyMsg}
                </div>
              )}

              {/* Generated Markdown */}
              {generatedMd && (
                <div style={{ marginTop: 14 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                    <div style={{ fontSize: 11, color: "var(--t4)", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em" }}>DESIGN.md</div>
                    <div style={{ display: "flex", gap: 6 }}>
                      <button onClick={() => copyText(generatedMd, "md")} style={{ background: "var(--s2)", border: "1px solid var(--border)", borderRadius: 5, padding: "4px 8px", cursor: "pointer", color: "var(--t2)", fontSize: 11, display: "flex", alignItems: "center", gap: 3 }}>
                        {copiedId === "md" ? <><Check size={10} color="var(--jade)" /> Copiado</> : <><Copy size={10} /> Copiar</>}
                      </button>
                      <button onClick={() => downloadMd(selected, generatedMd)} style={{ background: "var(--s2)", border: "1px solid var(--border)", borderRadius: 5, padding: "4px 8px", cursor: "pointer", color: "var(--t2)", fontSize: 11, display: "flex", alignItems: "center", gap: 3 }}>
                        <Download size={10} /> .md
                      </button>
                    </div>
                  </div>
                  <pre style={{ background: "var(--s2)", borderRadius: 8, padding: 12, fontSize: 11, color: "var(--t2)", whiteSpace: "pre-wrap", fontFamily: "monospace", maxHeight: 300, overflowY: "auto", lineHeight: 1.5 }}>
                    {generatedMd}
                  </pre>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* ── Plantillas de Portada / Informe ──────────────────────────────────── */}
      <div style={{ marginTop: 36, background: "var(--s1)", border: "1px solid var(--border)", borderRadius: 14, overflow: "hidden" }}>
        <div style={{ padding: "16px 20px", borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center", gap: 10 }}>
          <LayoutTemplate size={18} style={{ color: "#a78bfa" }} />
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 700, fontSize: 15, color: "var(--t1)" }}>Plantillas de Portada e Informe</div>
            <div style={{ fontSize: 12, color: "var(--t3)", marginTop: 1 }}>Portadas, contraportadas e índices dinámicos — sin texto hardcodeado. Se adaptan a la marca seleccionada.</div>
          </div>
        </div>
        <div style={{ padding: 20 }}>
          <ReportTemplateBuilder selectedSystem={selected} />
        </div>
      </div>
    </div>
  );
}

function ReportTemplateBuilder({ selectedSystem }: { selectedSystem: DesignSystem | null }) {
  const [fields, setFields] = useState({
    titulo: "", subtitulo: "", empresa: "", fecha: new Date().toLocaleDateString("es-ES", { year: "numeric", month: "long" }),
    autor: "", version: "1.0", confidencial: false,
  });
  const [activeTemplate, setActiveTemplate] = useState<"portada" | "contraportada" | "indice">("portada");
  const [downloading, setDownloading] = useState(false);

  const primary = selectedSystem?.primaryColor || "#c8a84b";
  const secondary = selectedSystem?.secondaryColor || "#1e293b";
  const accent = selectedSystem?.accentColor || "#f5f5f7";
  const brand = selectedSystem?.brand || fields.empresa || "Tu Marca";

  function downloadHtml() {
    setDownloading(true);
    const html = generateHtml();
    const blob = new Blob([html], { type: "text/html" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${activeTemplate}-${(fields.titulo || brand).replace(/\s+/g, "-").toLowerCase()}.html`;
    a.click();
    URL.revokeObjectURL(url);
    setTimeout(() => setDownloading(false), 1000);
  }

  function generateHtml(): string {
    const titulo = fields.titulo || "Informe Estratégico";
    const subtitulo = fields.subtitulo || "Análisis y Recomendaciones";
    const empresa = fields.empresa || brand;
    const fecha = fields.fecha;
    const autor = fields.autor;
    const version = fields.version;

    if (activeTemplate === "portada") {
      return `<!DOCTYPE html>
<html lang="es">
<head><meta charset="UTF-8"><style>
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;600;700;900&display=swap');
  * { margin:0; padding:0; box-sizing:border-box; }
  body { font-family:'Inter',sans-serif; width:210mm; height:297mm; background:${secondary}; color:${accent}; display:flex; flex-direction:column; }
  .bar { height:6px; background:${primary}; }
  .main { flex:1; padding:60px 56px 40px; display:flex; flex-direction:column; justify-content:space-between; }
  .brand { font-size:13px; letter-spacing:0.12em; text-transform:uppercase; color:${primary}; font-weight:600; margin-bottom:60px; }
  .title-block { flex:1; display:flex; flex-direction:column; justify-content:center; }
  h1 { font-size:48px; font-weight:900; line-height:1.1; letter-spacing:-0.03em; margin-bottom:18px; }
  .subtitle { font-size:20px; font-weight:300; opacity:0.7; }
  .accent-line { width:64px; height:4px; background:${primary}; margin:28px 0; border-radius:2px; }
  .meta { display:flex; justify-content:space-between; align-items:flex-end; padding-top:40px; border-top:1px solid rgba(255,255,255,0.12); }
  .meta-left { font-size:13px; opacity:0.5; line-height:1.8; }
  .meta-right { font-size:12px; text-align:right; opacity:0.45; }
  .confidencial { display:inline-block; border:1px solid ${primary}; color:${primary}; font-size:10px; letter-spacing:0.1em; padding:4px 10px; border-radius:2px; margin-top:8px; }
</style></head>
<body>
  <div class="bar"></div>
  <div class="main">
    <div class="brand">${empresa}</div>
    <div class="title-block">
      <h1>${titulo}</h1>
      <div class="accent-line"></div>
      <p class="subtitle">${subtitulo}</p>
    </div>
    <div class="meta">
      <div class="meta-left">${fecha ? `<span>${fecha}</span><br>` : ""}${autor ? `<span>${autor}</span><br>` : ""}${version ? `<span>v${version}</span>` : ""}</div>
      <div class="meta-right">${fields.confidencial ? '<span class="confidencial">CONFIDENCIAL</span>' : ""}</div>
    </div>
  </div>
</body></html>`;
    }

    if (activeTemplate === "contraportada") {
      return `<!DOCTYPE html>
<html lang="es">
<head><meta charset="UTF-8"><style>
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;600;700&display=swap');
  * { margin:0; padding:0; box-sizing:border-box; }
  body { font-family:'Inter',sans-serif; width:210mm; height:297mm; background:${primary}; color:${secondary}; display:flex; flex-direction:column; align-items:center; justify-content:center; text-align:center; padding:60px; }
  h2 { font-size:32px; font-weight:700; line-height:1.2; margin-bottom:16px; }
  p { font-size:15px; font-weight:300; opacity:0.75; max-width:420px; line-height:1.6; }
  .divider { width:50px; height:3px; background:${secondary}; opacity:0.4; margin:28px auto; border-radius:2px; }
  .brand { font-size:12px; letter-spacing:0.15em; text-transform:uppercase; font-weight:700; opacity:0.6; margin-top:40px; }
  .year { font-size:11px; opacity:0.4; margin-top:8px; }
</style></head>
<body>
  <h2>${titulo}</h2>
  <div class="divider"></div>
  <p>${subtitulo}</p>
  <div class="brand">${empresa}</div>
  <div class="year">${fecha}${version ? ` · v${version}` : ""}</div>
</body></html>`;
    }

    return `<!DOCTYPE html>
<html lang="es">
<head><meta charset="UTF-8"><style>
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;600;700&display=swap');
  * { margin:0; padding:0; box-sizing:border-box; }
  body { font-family:'Inter',sans-serif; width:210mm; min-height:297mm; background:#fff; color:#111; padding:56px; }
  .header { border-bottom:3px solid ${primary}; padding-bottom:16px; margin-bottom:32px; display:flex; justify-content:space-between; align-items:flex-end; }
  .header h1 { font-size:28px; font-weight:700; color:${primary}; }
  .header .brand { font-size:11px; color:#888; letter-spacing:0.08em; text-transform:uppercase; }
  .section { margin-bottom:14px; display:flex; gap:16px; align-items:baseline; padding:10px 0; border-bottom:1px solid #f0f0f0; }
  .num { font-size:13px; font-weight:700; color:${primary}; min-width:28px; }
  .entry { font-size:14px; color:#222; flex:1; }
  .page { font-size:13px; color:#999; min-width:30px; text-align:right; }
  .sub { margin-left:28px; font-size:12px; color:#666; padding:4px 0; }
</style></head>
<body>
  <div class="header">
    <h1>Índice de Contenidos</h1>
    <span class="brand">${empresa} · ${fecha}</span>
  </div>
  ${[
    { n: "01", t: "Resumen Ejecutivo", p: "3" },
    { n: "02", t: "Análisis de Situación", p: "7" },
    { n: "03", t: "Estrategia y Objetivos", p: "14" },
    { n: "04", t: "Plan de Acción", p: "22" },
    { n: "05", t: "KPIs y Métricas", p: "31" },
    { n: "06", t: "Conclusiones", p: "38" },
  ].map(s => `<div class="section"><span class="num">${s.n}</span><span class="entry">${s.t}</span><span class="page">${s.p}</span></div>`).join("\n  ")}
</body></html>`;
  }

  return (
    <div>
      {/* Template tabs */}
      <div style={{ display: "flex", gap: 8, marginBottom: 20 }}>
        {([
          { id: "portada" as const, label: "Portada", icon: "📄" },
          { id: "contraportada" as const, label: "Contraportada", icon: "🔙" },
          { id: "indice" as const, label: "Índice", icon: "📋" },
        ]).map(t => (
          <button key={t.id} onClick={() => setActiveTemplate(t.id)} style={{
            padding: "7px 16px", borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: "pointer",
            border: activeTemplate === t.id ? "2px solid #a78bfa" : "1px solid var(--border)",
            background: activeTemplate === t.id ? "rgba(167,139,250,0.12)" : "var(--s2)",
            color: activeTemplate === t.id ? "#a78bfa" : "var(--t3)",
          }}>
            {t.icon} {t.label}
          </button>
        ))}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 280px", gap: 20, alignItems: "start" }}>
        {/* Fields */}
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {[
            { key: "titulo", label: "Título principal", placeholder: "Informe Estratégico Q3 2026" },
            { key: "subtitulo", label: "Subtítulo / descripción", placeholder: "Análisis y Recomendaciones" },
            { key: "empresa", label: "Empresa / Marca", placeholder: selectedSystem?.brand || "Tu Empresa" },
            { key: "autor", label: "Autor / Equipo", placeholder: "Equipo de Consultoría" },
            { key: "fecha", label: "Fecha / Período", placeholder: "Julio 2026" },
            { key: "version", label: "Versión", placeholder: "1.0" },
          ].map(f => (
            <div key={f.key}>
              <div style={{ fontSize: 11, color: "var(--t3)", marginBottom: 4, fontWeight: 600 }}>{f.label}</div>
              <input
                value={(fields as any)[f.key]}
                onChange={e => setFields(prev => ({ ...prev, [f.key]: e.target.value }))}
                placeholder={f.placeholder}
                style={{ width: "100%", background: "var(--s2)", border: "1px solid var(--border)", borderRadius: 8, padding: "8px 12px", color: "var(--t1)", fontSize: 13, boxSizing: "border-box" }}
              />
            </div>
          ))}
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 4 }}>
            <input type="checkbox" id="confidencial" checked={fields.confidencial} onChange={e => setFields(prev => ({ ...prev, confidencial: e.target.checked }))} style={{ cursor: "pointer" }} />
            <label htmlFor="confidencial" style={{ fontSize: 13, color: "var(--t2)", cursor: "pointer" }}>Marcar como Confidencial</label>
          </div>
        </div>

        {/* Preview + actions */}
        <div>
          <div style={{ fontSize: 11, color: "var(--t3)", marginBottom: 8, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em" }}>Vista previa</div>
          <div style={{
            width: "100%", aspectRatio: "0.707", borderRadius: 10, overflow: "hidden",
            border: "1px solid var(--border)", background: activeTemplate === "contraportada" ? primary : activeTemplate === "portada" ? secondary : "#fff",
            display: "flex", flexDirection: "column", alignItems: "center", justifyContent: activeTemplate === "indice" ? "flex-start" : "center",
            padding: 20, gap: 8, boxSizing: "border-box",
          }}>
            {activeTemplate === "portada" && (
              <>
                <div style={{ width: "100%", height: 3, background: primary, borderRadius: 1, marginBottom: 8 }} />
                <div style={{ fontSize: 8, color: primary, letterSpacing: "0.1em", textTransform: "uppercase", fontWeight: 700, alignSelf: "flex-start" }}>{fields.empresa || brand}</div>
                <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "center", width: "100%" }}>
                  <div style={{ fontSize: 18, fontWeight: 900, color: accent, lineHeight: 1.1, letterSpacing: "-0.03em" }}>{fields.titulo || "Título del informe"}</div>
                  <div style={{ width: 20, height: 2, background: primary, margin: "8px 0", borderRadius: 1 }} />
                  <div style={{ fontSize: 9, color: accent, opacity: 0.6 }}>{fields.subtitulo || "Subtítulo"}</div>
                </div>
                <div style={{ width: "100%", borderTop: "1px solid rgba(255,255,255,0.12)", paddingTop: 8, fontSize: 8, color: accent, opacity: 0.4 }}>
                  {fields.fecha} {fields.autor && `· ${fields.autor}`} {fields.version && `· v${fields.version}`}
                </div>
              </>
            )}
            {activeTemplate === "contraportada" && (
              <>
                <div style={{ fontSize: 14, fontWeight: 700, color: secondary, textAlign: "center" }}>{fields.titulo || "Título"}</div>
                <div style={{ width: 20, height: 2, background: secondary, opacity: 0.4, borderRadius: 1 }} />
                <div style={{ fontSize: 8, color: secondary, opacity: 0.7, textAlign: "center" }}>{fields.subtitulo}</div>
                <div style={{ fontSize: 7, color: secondary, opacity: 0.5, marginTop: 8, letterSpacing: "0.1em", textTransform: "uppercase" }}>{fields.empresa || brand}</div>
              </>
            )}
            {activeTemplate === "indice" && (
              <div style={{ width: "100%", padding: 4 }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: primary, borderBottom: `2px solid ${primary}`, paddingBottom: 4, marginBottom: 8 }}>Índice de Contenidos</div>
                {["01 · Resumen Ejecutivo", "02 · Análisis", "03 · Estrategia", "04 · Plan de Acción", "05 · KPIs", "06 · Conclusiones"].map((s, i) => (
                  <div key={i} style={{ display: "flex", justifyContent: "space-between", fontSize: 7, color: "#333", padding: "3px 0", borderBottom: "1px solid #f0f0f0" }}>
                    <span>{s}</span><span style={{ color: "#999" }}>{3 + i * 7}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
          <div style={{ marginTop: 12, display: "flex", flexDirection: "column", gap: 8 }}>
            {selectedSystem && (
              <div style={{ fontSize: 11, color: "var(--t3)", padding: "6px 10px", background: "var(--s2)", borderRadius: 6, textAlign: "center" }}>
                🎨 Colores de <strong style={{ color: "var(--t1)" }}>{selectedSystem.brand}</strong> aplicados
              </div>
            )}
            <button
              onClick={downloadHtml}
              disabled={downloading}
              style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 6, padding: "10px 0", borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: "pointer", background: "#a78bfa", color: "#fff", border: "none" }}
            >
              {downloading ? <Loader2 size={14} style={{ animation: "spin 0.6s linear infinite" }} /> : <Download size={14} />}
              Descargar HTML
            </button>
            <button
              onClick={() => {
                const html = generateHtml();
                const w = window.open("", "_blank");
                if (w) { w.document.write(html); w.document.close(); }
              }}
              style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 6, padding: "9px 0", borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: "pointer", background: "var(--s2)", color: "var(--t2)", border: "1px solid var(--border)" }}
            >
              <Eye size={13} /> Vista previa completa
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
