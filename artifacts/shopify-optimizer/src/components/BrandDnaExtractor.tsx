import { useState, useEffect, useCallback } from "react";
import { Globe, Dna, Building2, Palette, Users, Megaphone, Brain, Zap, RefreshCw, Edit3, Check, X, ChevronDown, ChevronUp, Link, Instagram, Youtube, Linkedin } from "lucide-react";

const API_BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

interface SocialHandle { platform: string; handle: string }
interface ServiceItem { name: string; description?: string; category?: string }

interface FullBrandDna {
  companyInfo?: {
    name?: string; sector?: string; subsector?: string; description?: string;
    mission?: string; vision?: string; location?: string; languages?: string[];
  };
  services?: ServiceItem[];
  brandIdentity?: {
    archetype?: string; personality?: string[]; values?: string[]; tone?: string;
    voiceCharacteristics?: string[]; uniqueValueProposition?: string;
    taglines?: string[]; messagingPillars?: string[];
  };
  visualIdentity?: {
    primaryColors?: string[]; secondaryColors?: string[];
    typographyStyle?: string; layoutPattern?: string; photographyStyle?: string;
    visualDensity?: string; aestheticKeywords?: string[];
  };
  targetAudience?: {
    primary?: string;
    demographics?: { ageRange?: string; gender?: string; income?: string };
    psychographics?: string[]; painPoints?: string[]; desires?: string[]; geography?: string[];
  };
  marketPosition?: { pricePoint?: string; mainCompetitors?: string[]; competitiveAdvantage?: string };
  digitalPresence?: { socialHandles?: SocialHandle[]; contentTopics?: string[]; engagementStyle?: string };
  contentStrategy?: { contentPillars?: string[]; ctaStyle?: string; copywritingStyle?: string; keyMessages?: string[] };
  intelligence?: { summary?: string; uniqueInsights?: string[]; contentPersonalizationGuide?: string; confidenceScore?: number; dataQuality?: string };
}

interface BrandDnaExtractorProps {
  projectId: number;
  initialUrl?: string;
  projectName?: string;
  onDnaReady?: (dna: FullBrandDna) => void;
}

const EXTRACTION_STAGES = [
  { id: "web", icon: "🌐", label: "Rastreando sitio web", sub: "Extrayendo contenido de múltiples páginas en paralelo..." },
  { id: "company", icon: "🏢", label: "Identificando empresa", sub: "Sector, servicios, descripción, ubicación..." },
  { id: "identity", icon: "🎨", label: "Analizando identidad visual", sub: "Colores, tipografía, estética, fotografía..." },
  { id: "audience", icon: "🎯", label: "Perfilando audiencia", sub: "Demographics, psicografía, pain points..." },
  { id: "voice", icon: "🎭", label: "Extrayendo voz de marca", sub: "Tono, personalidad, arquetipo, valores..." },
  { id: "synthesis", icon: "🧬", label: "Sintetizando ADN completo", sub: "Integrando todos los bloques de identidad..." },
];

const S = {
  wrap: { fontFamily: "var(--fb, system-ui)", color: "var(--t1, #fff)" } as React.CSSProperties,
  card: { background: "rgba(10,10,10,0.8)", border: "1px solid rgba(212,160,23,0.2)", borderRadius: 16, overflow: "hidden" } as React.CSSProperties,
  header: { background: "linear-gradient(135deg, rgba(212,160,23,0.12) 0%, rgba(0,168,107,0.06) 100%)", borderBottom: "1px solid rgba(212,160,23,0.15)", padding: "18px 22px", display: "flex", alignItems: "center", gap: 12 } as React.CSSProperties,
  body: { padding: "20px 22px" } as React.CSSProperties,
  urlRow: { display: "flex", gap: 10, marginBottom: 16 } as React.CSSProperties,
  urlInput: { flex: 1, background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 10, padding: "10px 14px", color: "#fff", fontSize: 13, outline: "none" } as React.CSSProperties,
  btn: (color: string) => ({ background: `rgba(${color},0.15)`, border: `1px solid rgba(${color},0.35)`, borderRadius: 10, padding: "10px 18px", color: `rgb(${color})`, fontWeight: 700, fontSize: 13, cursor: "pointer", display: "flex", alignItems: "center", gap: 7, whiteSpace: "nowrap" }) as React.CSSProperties,
  stageRow: { display: "flex", alignItems: "center", gap: 10, padding: "10px 12px", borderRadius: 10, marginBottom: 6, transition: "all 0.3s" } as React.CSSProperties,
  blockTitle: { fontSize: 11, fontWeight: 700, textTransform: "uppercase" as const, letterSpacing: 1.2, color: "var(--gold, #d4a017)", marginBottom: 10, display: "flex", alignItems: "center", gap: 6 },
  tag: (color = "212,160,23") => ({ display: "inline-block", padding: "3px 9px", borderRadius: 20, fontSize: 11, fontWeight: 600, background: `rgba(${color},0.12)`, border: `1px solid rgba(${color},0.25)`, color: `rgb(${color})`, margin: "2px" }) as React.CSSProperties,
  swatch: (hex: string) => ({ width: 28, height: 28, borderRadius: 8, background: hex, border: "2px solid rgba(255,255,255,0.1)", display: "inline-block", margin: "2px", cursor: "default", title: hex }) as React.CSSProperties,
  label: { fontSize: 11, color: "var(--t3, #666)", marginBottom: 4, fontWeight: 600 } as React.CSSProperties,
  value: { fontSize: 13, color: "var(--t1, #fff)", lineHeight: 1.5 } as React.CSSProperties,
  grid2: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginBottom: 14 } as React.CSSProperties,
  grid3: { display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 14, marginBottom: 14 } as React.CSSProperties,
  divider: { borderTop: "1px solid rgba(255,255,255,0.06)", margin: "16px 0" } as React.CSSProperties,
  confidence: (score: number) => ({
    display: "inline-flex", alignItems: "center", gap: 5, padding: "4px 10px", borderRadius: 20, fontSize: 11, fontWeight: 700,
    background: score >= 0.7 ? "rgba(0,168,107,0.15)" : score >= 0.5 ? "rgba(212,160,23,0.15)" : "rgba(255,80,80,0.15)",
    border: `1px solid ${score >= 0.7 ? "rgba(0,168,107,0.3)" : score >= 0.5 ? "rgba(212,160,23,0.3)" : "rgba(255,80,80,0.3)"}`,
    color: score >= 0.7 ? "#00a86b" : score >= 0.5 ? "#d4a017" : "#ff5050",
  }) as React.CSSProperties,
};

function platformIcon(p: string) {
  if (p === "instagram") return <Instagram size={12} />;
  if (p === "youtube") return <Youtube size={12} />;
  if (p === "linkedin") return <Linkedin size={12} />;
  return <Link size={12} />;
}

function ColorSwatch({ hex }: { hex: string }) {
  const [hover, setHover] = useState(false);
  return (
    <span
      title={hex}
      style={{ ...S.swatch(hex), position: "relative" }}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
    >
      {hover && (
        <span style={{ position: "absolute", bottom: "110%", left: "50%", transform: "translateX(-50%)", background: "#000", color: "#fff", fontSize: 10, padding: "2px 6px", borderRadius: 4, whiteSpace: "nowrap", zIndex: 10 }}>{hex}</span>
      )}
    </span>
  );
}

export default function BrandDnaExtractor({ projectId, initialUrl, projectName, onDnaReady }: BrandDnaExtractorProps) {
  const [url, setUrl] = useState(initialUrl ?? "");
  const [state, setState] = useState<"idle" | "loading" | "done" | "error">("idle");
  const [activeStage, setActiveStage] = useState(0);
  const [stagesDone, setStagesDone] = useState<Set<number>>(new Set());
  const [profile, setProfile] = useState<FullBrandDna | null>(null);
  const [error, setError] = useState("");
  const [pagesScraped, setPagesScraped] = useState(0);
  const [collapsed, setCollapsed] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (initialUrl) setUrl(initialUrl);
  }, [initialUrl]);

  useEffect(() => {
    let timer: ReturnType<typeof setInterval>;
    if (state === "loading") {
      let stage = 0;
      setActiveStage(0);
      setStagesDone(new Set());
      timer = setInterval(() => {
        stage = Math.min(stage + 1, EXTRACTION_STAGES.length - 1);
        setActiveStage(stage);
        setStagesDone(prev => { const n = new Set(prev); n.add(stage - 1); return n; });
      }, 5500);
    }
    return () => clearInterval(timer);
  }, [state]);

  const extract = useCallback(async () => {
    if (!url.trim()) return;
    setState("loading");
    setError("");
    setProfile(null);
    setStagesDone(new Set());
    setActiveStage(0);
    setCollapsed(false);

    try {
      const res = await fetch(`${API_BASE}/api/projects/${projectId}/brand-dna/extract-full`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ websiteUrl: url.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Error en extracción");

      setStagesDone(new Set([0, 1, 2, 3, 4, 5]));
      setActiveStage(5);
      setProfile(data.profile);
      setPagesScraped(data.pagesScraped ?? 0);
      setState("done");
      if (onDnaReady) onDnaReady(data.profile);
    } catch (e: any) {
      setError(e.message ?? "Error desconocido");
      setState("error");
    }
  }, [url, projectId, onDnaReady]);

  const loadExisting = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/api/projects/${projectId}/brand-dna`, { credentials: "include" });
      const data = await res.json();
      if (data.fullProfile) {
        setProfile(data.fullProfile);
        setState("done");
        if (onDnaReady) onDnaReady(data.fullProfile);
        if (data.brandDna?.website_url) setUrl(data.brandDna.website_url);
      }
    } catch { /* ignore */ }
  }, [projectId, onDnaReady]);

  useEffect(() => { loadExisting(); }, [loadExisting]);

  const saveDna = async () => {
    if (!profile) return;
    setSaving(true);
    try {
      await fetch(`${API_BASE}/api/projects/${projectId}/brand-dna`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ fullProfile: profile }),
      });
    } catch { /* ignore */ }
    finally { setSaving(false); setEditMode(false); }
  };

  const ci = profile?.companyInfo;
  const bi = profile?.brandIdentity;
  const vi = profile?.visualIdentity;
  const ta = profile?.targetAudience;
  const mp = profile?.marketPosition;
  const dp = profile?.digitalPresence;
  const cs = profile?.contentStrategy;
  const intel = profile?.intelligence;

  return (
    <div style={S.wrap}>
      <div style={S.card}>
        <div style={S.header}>
          <Dna size={22} color="#d4a017" />
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 800, fontSize: 15, color: "#d4a017" }}>ADN de Marca — Extracción Real</div>
            <div style={{ fontSize: 11, color: "var(--t3, #888)", marginTop: 2 }}>
              Extrae la identidad completa de la marca desde su web: sector, servicios, voz, visual, audiencia y valores
            </div>
          </div>
          {state === "done" && (
            <button onClick={() => setCollapsed(c => !c)} style={{ background: "none", border: "none", cursor: "pointer", color: "#888", display: "flex", alignItems: "center" }}>
              {collapsed ? <ChevronDown size={18} /> : <ChevronUp size={18} />}
            </button>
          )}
        </div>

        <div style={S.body}>
          {/* URL Input */}
          <div style={S.urlRow}>
            <div style={{ position: "relative", flex: 1 }}>
              <Globe size={14} style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: "#888" }} />
              <input
                value={url}
                onChange={e => setUrl(e.target.value)}
                onKeyDown={e => e.key === "Enter" && state !== "loading" && extract()}
                placeholder="https://tu-marca.com — o pega la URL del sitio web"
                style={{ ...S.urlInput, paddingLeft: 34, width: "100%", boxSizing: "border-box" as const }}
              />
            </div>
            <button
              onClick={extract}
              disabled={state === "loading" || !url.trim()}
              style={{ ...S.btn("212,160,23"), opacity: state === "loading" || !url.trim() ? 0.5 : 1 }}
            >
              {state === "loading" ? <RefreshCw size={14} className="animate-spin" style={{ animation: "spin 1s linear infinite" }} /> : <Dna size={14} />}
              {state === "loading" ? "Extrayendo..." : state === "done" ? "Re-extraer" : "🧬 Extraer ADN Real"}
            </button>
          </div>

          {/* Loading stages */}
          {state === "loading" && (
            <div style={{ marginTop: 8 }}>
              {EXTRACTION_STAGES.map((stage, i) => {
                const done = stagesDone.has(i);
                const active = activeStage === i;
                return (
                  <div key={stage.id} style={{ ...S.stageRow, background: done ? "rgba(0,168,107,0.08)" : active ? "rgba(212,160,23,0.08)" : "rgba(255,255,255,0.02)", border: `1px solid ${done ? "rgba(0,168,107,0.2)" : active ? "rgba(212,160,23,0.2)" : "rgba(255,255,255,0.05)"}` }}>
                    <span style={{ fontSize: 18, width: 28, textAlign: "center" }}>{stage.icon}</span>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 12, fontWeight: 700, color: done ? "#00a86b" : active ? "#d4a017" : "#555" }}>{stage.label}</div>
                      {active && <div style={{ fontSize: 10, color: "#888", marginTop: 2 }}>{stage.sub}</div>}
                    </div>
                    {done ? (
                      <Check size={14} color="#00a86b" />
                    ) : active ? (
                      <div style={{ width: 14, height: 14, borderRadius: "50%", border: "2px solid #d4a017", borderTop: "2px solid transparent", animation: "spin 0.8s linear infinite" }} />
                    ) : (
                      <div style={{ width: 14, height: 14, borderRadius: "50%", background: "rgba(255,255,255,0.05)" }} />
                    )}
                  </div>
                );
              })}
              <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
            </div>
          )}

          {/* Error */}
          {state === "error" && (
            <div style={{ padding: "12px 16px", borderRadius: 10, background: "rgba(255,80,80,0.08)", border: "1px solid rgba(255,80,80,0.2)", color: "#ff6b6b", fontSize: 13 }}>
              <X size={14} style={{ marginRight: 6 }} />
              {error}
            </div>
          )}

          {/* Results */}
          {state === "done" && profile && !collapsed && (
            <div>
              {/* Header summary */}
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 18, padding: "14px 16px", borderRadius: 12, background: "linear-gradient(135deg, rgba(212,160,23,0.08), rgba(0,168,107,0.06))", border: "1px solid rgba(212,160,23,0.15)" }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 800, fontSize: 16, color: "#d4a017" }}>{ci?.name ?? projectName ?? "Marca analizada"}</div>
                  <div style={{ fontSize: 12, color: "#00a86b", marginTop: 2, fontWeight: 600 }}>{ci?.sector}</div>
                  {intel?.summary && <div style={{ fontSize: 11, color: "#888", marginTop: 4, lineHeight: 1.5 }}>{intel.summary}</div>}
                </div>
                <div style={{ display: "flex", flexDirection: "column" as const, alignItems: "flex-end", gap: 6 }}>
                  {intel?.confidenceScore && (
                    <span style={S.confidence(intel.confidenceScore)}>
                      <Brain size={10} /> {Math.round(intel.confidenceScore * 100)}% confianza
                    </span>
                  )}
                  {pagesScraped > 0 && (
                    <span style={{ fontSize: 10, color: "#555" }}>{pagesScraped} páginas escaneadas</span>
                  )}
                </div>
              </div>

              {/* Edit / Save controls */}
              <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
                {editMode ? (
                  <>
                    <button onClick={saveDna} disabled={saving} style={{ ...S.btn("0,168,107"), fontSize: 12 }}>
                      {saving ? <RefreshCw size={12} /> : <Check size={12} />} Guardar cambios
                    </button>
                    <button onClick={() => setEditMode(false)} style={{ ...S.btn("255,100,100"), fontSize: 12 }}>
                      <X size={12} /> Cancelar
                    </button>
                  </>
                ) : (
                  <button onClick={() => setEditMode(true)} style={{ ...S.btn("255,255,255"), fontSize: 12, border: "1px solid rgba(255,255,255,0.1)", color: "#888" }}>
                    <Edit3 size={12} /> Editar ADN
                  </button>
                )}
              </div>

              {/* BLOQUE: Empresa y Sector */}
              <div style={{ marginBottom: 16, padding: "16px", borderRadius: 12, background: "rgba(255,255,255,0.025)", border: "1px solid rgba(255,255,255,0.06)" }}>
                <div style={S.blockTitle}><Building2 size={12} /> 🏢 Empresa y Sector</div>
                <div style={S.grid2}>
                  <div>
                    <div style={S.label}>Sector específico</div>
                    {editMode ? (
                      <input value={ci?.sector ?? ""} onChange={e => setProfile(p => p && { ...p, companyInfo: { ...p.companyInfo, sector: e.target.value } })} style={{ ...S.urlInput, fontSize: 12, padding: "6px 10px" }} />
                    ) : (
                      <div style={{ ...S.value, color: "#00a86b", fontWeight: 700 }}>{ci?.sector ?? "—"}</div>
                    )}
                  </div>
                  <div>
                    <div style={S.label}>Ubicación</div>
                    <div style={S.value}>{ci?.location ?? "—"}</div>
                  </div>
                </div>
                <div style={{ marginBottom: 10 }}>
                  <div style={S.label}>Descripción de la empresa</div>
                  {editMode ? (
                    <textarea value={ci?.description ?? ""} onChange={e => setProfile(p => p && { ...p, companyInfo: { ...p.companyInfo, description: e.target.value } })} rows={3} style={{ ...S.urlInput, fontSize: 12, padding: "8px 10px", width: "100%", boxSizing: "border-box" as const, resize: "vertical" as const }} />
                  ) : (
                    <div style={{ ...S.value, fontSize: 12, lineHeight: 1.6, color: "var(--t2, #ccc)" }}>{ci?.description ?? "—"}</div>
                  )}
                </div>
                {profile?.services && profile.services.length > 0 && (
                  <div>
                    <div style={S.label}>Servicios / Productos</div>
                    <div style={{ display: "flex", flexWrap: "wrap" as const, gap: 4 }}>
                      {profile.services.map((s, i) => (
                        <span key={i} style={S.tag("0,168,107")} title={s.description}>{s.name}</span>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* BLOQUE: Identidad de Marca */}
              <div style={{ marginBottom: 16, padding: "16px", borderRadius: 12, background: "rgba(255,255,255,0.025)", border: "1px solid rgba(255,255,255,0.06)" }}>
                <div style={S.blockTitle}><Zap size={12} /> 🎭 Identidad y Personalidad</div>
                <div style={S.grid3}>
                  <div>
                    <div style={S.label}>Arquetipo</div>
                    <div style={{ ...S.value, fontWeight: 700, color: "#d4a017" }}>{bi?.archetype ?? "—"}</div>
                  </div>
                  <div>
                    <div style={S.label}>Tono de Voz</div>
                    <div style={S.value}>{bi?.tone ?? "—"}</div>
                  </div>
                  <div>
                    <div style={S.label}>Punto de Precio</div>
                    <span style={S.tag("212,160,23")}>{mp?.pricePoint ?? "—"}</span>
                  </div>
                </div>
                {bi?.uniqueValueProposition && (
                  <div style={{ marginBottom: 10 }}>
                    <div style={S.label}>Propuesta de Valor Única (UVP)</div>
                    <div style={{ ...S.value, fontStyle: "italic", color: "#d4a017", fontSize: 13, borderLeft: "3px solid rgba(212,160,23,0.4)", paddingLeft: 10 }}>
                      "{bi.uniqueValueProposition}"
                    </div>
                  </div>
                )}
                {bi?.taglines && bi.taglines.length > 0 && (
                  <div style={{ marginBottom: 10 }}>
                    <div style={S.label}>Taglines / Slogans detectados</div>
                    <div style={{ display: "flex", flexWrap: "wrap" as const, gap: 4 }}>
                      {bi.taglines.map((t, i) => <span key={i} style={{ ...S.tag("212,160,23"), fontStyle: "italic" }}>"{t}"</span>)}
                    </div>
                  </div>
                )}
                {bi?.personality && bi.personality.length > 0 && (
                  <div style={{ marginBottom: 10 }}>
                    <div style={S.label}>Personalidad de Marca</div>
                    <div style={{ display: "flex", flexWrap: "wrap" as const, gap: 4 }}>
                      {bi.personality.map((p, i) => <span key={i} style={S.tag("255,200,100")}>{p}</span>)}
                    </div>
                  </div>
                )}
                {bi?.values && bi.values.length > 0 && (
                  <div>
                    <div style={S.label}>Valores de Marca</div>
                    <div style={{ display: "flex", flexWrap: "wrap" as const, gap: 4 }}>
                      {bi.values.map((v, i) => <span key={i} style={S.tag("100,180,255")}>{v}</span>)}
                    </div>
                  </div>
                )}
              </div>

              {/* BLOQUE: Identidad Visual */}
              <div style={{ marginBottom: 16, padding: "16px", borderRadius: 12, background: "rgba(255,255,255,0.025)", border: "1px solid rgba(255,255,255,0.06)" }}>
                <div style={S.blockTitle}><Palette size={12} /> 🎨 Identidad Visual</div>
                <div style={S.grid3}>
                  <div>
                    <div style={S.label}>Tipografía</div>
                    <div style={S.value}>{vi?.typographyStyle ?? "—"}</div>
                  </div>
                  <div>
                    <div style={S.label}>Layout</div>
                    <div style={S.value}>{vi?.layoutPattern ?? "—"}</div>
                  </div>
                  <div>
                    <div style={S.label}>Fotografía</div>
                    <div style={S.value}>{vi?.photographyStyle ?? "—"}</div>
                  </div>
                </div>
                {vi?.primaryColors && vi.primaryColors.length > 0 && (
                  <div style={{ marginBottom: 10 }}>
                    <div style={S.label}>Colores primarios detectados</div>
                    <div style={{ display: "flex", gap: 6, flexWrap: "wrap" as const, alignItems: "center" }}>
                      {vi.primaryColors.filter(c => /^#[0-9a-fA-F]{6}$/.test(c)).map((c, i) => (
                        <div key={i} style={{ display: "flex", alignItems: "center", gap: 5 }}>
                          <ColorSwatch hex={c} />
                          <span style={{ fontSize: 11, color: "#666", fontFamily: "monospace" }}>{c}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                {vi?.aestheticKeywords && vi.aestheticKeywords.length > 0 && (
                  <div>
                    <div style={S.label}>Palabras clave estéticas</div>
                    <div style={{ display: "flex", flexWrap: "wrap" as const, gap: 4 }}>
                      {vi.aestheticKeywords.map((k, i) => <span key={i} style={S.tag("180,120,255")}>{k}</span>)}
                    </div>
                  </div>
                )}
              </div>

              {/* BLOQUE: Audiencia Objetivo */}
              <div style={{ marginBottom: 16, padding: "16px", borderRadius: 12, background: "rgba(255,255,255,0.025)", border: "1px solid rgba(255,255,255,0.06)" }}>
                <div style={S.blockTitle}><Users size={12} /> 🎯 Audiencia Objetivo</div>
                {ta?.primary && (
                  <div style={{ marginBottom: 10 }}>
                    <div style={S.label}>Cliente ideal (ICP)</div>
                    <div style={{ ...S.value, fontSize: 12, lineHeight: 1.6, color: "var(--t2, #ccc)" }}>{ta.primary}</div>
                  </div>
                )}
                {ta?.demographics && (
                  <div style={{ ...S.grid3, marginBottom: 10 }}>
                    <div><div style={S.label}>Edad</div><div style={S.value}>{ta.demographics.ageRange ?? "—"}</div></div>
                    <div><div style={S.label}>Género</div><div style={S.value}>{ta.demographics.gender ?? "—"}</div></div>
                    <div><div style={S.label}>Poder adquisitivo</div><div style={S.value}>{ta.demographics.income ?? "—"}</div></div>
                  </div>
                )}
                {ta?.painPoints && ta.painPoints.length > 0 && (
                  <div style={{ marginBottom: 10 }}>
                    <div style={S.label}>Pain points que resuelve</div>
                    <div style={{ display: "flex", flexWrap: "wrap" as const, gap: 4 }}>
                      {ta.painPoints.map((p, i) => <span key={i} style={S.tag("255,100,100")}>{p}</span>)}
                    </div>
                  </div>
                )}
                {ta?.desires && ta.desires.length > 0 && (
                  <div>
                    <div style={S.label}>Aspiraciones que evoca</div>
                    <div style={{ display: "flex", flexWrap: "wrap" as const, gap: 4 }}>
                      {ta.desires.map((d, i) => <span key={i} style={S.tag("100,220,160")}>{d}</span>)}
                    </div>
                  </div>
                )}
              </div>

              {/* BLOQUE: Presencia Digital */}
              {dp && (dp.socialHandles?.length || dp.contentTopics?.length) ? (
                <div style={{ marginBottom: 16, padding: "16px", borderRadius: 12, background: "rgba(255,255,255,0.025)", border: "1px solid rgba(255,255,255,0.06)" }}>
                  <div style={S.blockTitle}><Globe size={12} /> 🌐 Presencia Digital</div>
                  {dp.socialHandles && dp.socialHandles.length > 0 && (
                    <div style={{ marginBottom: 10 }}>
                      <div style={S.label}>Redes sociales detectadas</div>
                      <div style={{ display: "flex", flexWrap: "wrap" as const, gap: 8 }}>
                        {dp.socialHandles.map((sh, i) => (
                          <span key={i} style={{ display: "inline-flex", alignItems: "center", gap: 5, padding: "4px 10px", borderRadius: 20, fontSize: 12, background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", color: "#ccc" }}>
                            {platformIcon(sh.platform)}
                            <span style={{ fontWeight: 600, color: "#d4a017", fontSize: 11 }}>{sh.platform}</span>
                            {sh.handle}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                  {dp.contentTopics && dp.contentTopics.length > 0 && (
                    <div>
                      <div style={S.label}>Temas de contenido</div>
                      <div style={{ display: "flex", flexWrap: "wrap" as const, gap: 4 }}>
                        {dp.contentTopics.map((t, i) => <span key={i} style={S.tag("100,150,255")}>{t}</span>)}
                      </div>
                    </div>
                  )}
                </div>
              ) : null}

              {/* BLOQUE: Estrategia de Contenido */}
              {cs && (cs.contentPillars?.length || cs.keyMessages?.length) ? (
                <div style={{ marginBottom: 16, padding: "16px", borderRadius: 12, background: "rgba(255,255,255,0.025)", border: "1px solid rgba(255,255,255,0.06)" }}>
                  <div style={S.blockTitle}><Megaphone size={12} /> 📣 Estrategia de Contenido</div>
                  <div style={S.grid2}>
                    <div>
                      <div style={S.label}>CTA Style</div>
                      <div style={S.value}>{cs.ctaStyle ?? "—"}</div>
                    </div>
                    <div>
                      <div style={S.label}>Estilo de copy</div>
                      <div style={{ ...S.value, fontSize: 11, lineHeight: 1.5 }}>{cs.copywritingStyle ?? "—"}</div>
                    </div>
                  </div>
                  {cs.contentPillars && cs.contentPillars.length > 0 && (
                    <div style={{ marginBottom: 10 }}>
                      <div style={S.label}>Pilares de contenido</div>
                      <div style={{ display: "flex", flexWrap: "wrap" as const, gap: 4 }}>
                        {cs.contentPillars.map((p, i) => <span key={i} style={S.tag("212,160,23")}>{p}</span>)}
                      </div>
                    </div>
                  )}
                  {cs.keyMessages && cs.keyMessages.length > 0 && (
                    <div>
                      <div style={S.label}>Mensajes clave de la marca</div>
                      {cs.keyMessages.map((m, i) => (
                        <div key={i} style={{ fontSize: 11, color: "#aaa", padding: "4px 0", borderBottom: "1px solid rgba(255,255,255,0.04)" }}>• {m}</div>
                      ))}
                    </div>
                  )}
                </div>
              ) : null}

              {/* BLOQUE: Insights de Inteligencia */}
              {intel?.uniqueInsights && intel.uniqueInsights.length > 0 && (
                <div style={{ padding: "16px", borderRadius: 12, background: "rgba(212,160,23,0.05)", border: "1px solid rgba(212,160,23,0.15)" }}>
                  <div style={S.blockTitle}><Brain size={12} /> 💡 Insights de Inteligencia</div>
                  {intel.contentPersonalizationGuide && (
                    <div style={{ marginBottom: 12, padding: "10px 12px", borderRadius: 8, background: "rgba(0,168,107,0.08)", border: "1px solid rgba(0,168,107,0.15)" }}>
                      <div style={S.label}>Guía de personalización de contenido</div>
                      <div style={{ fontSize: 11, color: "#aaa", lineHeight: 1.6 }}>{intel.contentPersonalizationGuide}</div>
                    </div>
                  )}
                  {intel.uniqueInsights.map((ins, i) => (
                    <div key={i} style={{ fontSize: 11, color: "#ccc", padding: "5px 0", borderBottom: "1px solid rgba(255,255,255,0.04)", display: "flex", gap: 8 }}>
                      <span style={{ color: "#d4a017", fontWeight: 700 }}>{i + 1}.</span>
                      {ins}
                    </div>
                  ))}
                  <div style={{ marginTop: 10, display: "flex", justifyContent: "flex-end" }}>
                    <span style={S.confidence(intel.confidenceScore ?? 0)}>
                      {intel.dataQuality ?? "real"} · {Math.round((intel.confidenceScore ?? 0) * 100)}% confianza
                    </span>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
