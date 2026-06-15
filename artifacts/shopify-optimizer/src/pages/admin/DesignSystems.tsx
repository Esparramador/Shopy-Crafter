import { useState, useEffect } from "react";
import { Palette, Download, Copy, Check, Search, Loader2, AlertCircle, X, Eye, Sparkles } from "lucide-react";

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
      const r = await fetch(`${API_BASE}/api/design-systems/${ds.id}/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({}),
      });
      const data = await r.json();
      setGeneratedMd(data.designMd || data.markdown || "");
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
    </div>
  );
}
