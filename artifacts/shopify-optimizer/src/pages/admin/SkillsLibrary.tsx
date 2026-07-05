import { useState, useEffect, useCallback } from "react";
import { BookOpen, Play, Search, Copy, Check, Loader2, AlertCircle, ChevronRight, X, Shield, ChevronLeft, ChevronDown } from "lucide-react";

const API_BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

// ── IA Skills ─────────────────────────────────────────────────────────────────
interface IASkill {
  id: string;
  name: string;
  category: string;
  description: string;
  promptTemplate: string;
  variables: string[];
  tags: string[];
  difficulty: "beginner" | "intermediate" | "advanced";
  useCase: string;
  aiModel: string;
}

// ── Cybersec Skills ────────────────────────────────────────────────────────────
interface CyberSkill {
  id: string;
  name: string;
  description: string;
  subdomain?: string;
  tags?: string[];
  severity?: string;
  mitre_attack?: string | string[];
  nist_csf?: string | string[];
}

interface CyberDomain { name: string; count: number; }

// ── Constants ─────────────────────────────────────────────────────────────────
const IA_CAT: Record<string, { icon: string; color: string; label: string }> = {
  design:    { icon: "🎨", color: "#f59e0b", label: "Diseño" },
  content:   { icon: "✍️", color: "#60a5fa", label: "Contenido" },
  seo:       { icon: "🔍", color: "#4ade80", label: "SEO" },
  social:    { icon: "📱", color: "#a78bfa", label: "Social Media" },
  analytics: { icon: "📊", color: "#34d399", label: "Analytics" },
  commerce:  { icon: "🛒", color: "#fb923c", label: "Commerce" },
  "3d":      { icon: "🧊", color: "#22d3ee", label: "3D" },
  code:      { icon: "💻", color: "#f87171", label: "Código" },
  email:     { icon: "📧", color: "#c084fc", label: "Email" },
  video:     { icon: "🎬", color: "#fbbf24", label: "Video" },
};

const DIFF_META = {
  beginner:     { label: "Principiante", color: "#4ade80" },
  intermediate: { label: "Intermedio",   color: "#fbbf24" },
  advanced:     { label: "Avanzado",     color: "#f87171" },
};

const SEV_COLOR: Record<string, string> = {
  critical: "#ef4444", high: "#f97316", medium: "#eab308",
  low: "#4ade80", info: "#60a5fa",
};

const PAGE_SIZE = 50;

// ── Component ─────────────────────────────────────────────────────────────────
export default function SkillsLibrary() {
  const [mode, setMode] = useState<"ia" | "cyber">("ia");

  // ── IA state ────────────────────────────────────────────────────────────────
  const [iaSkills, setIaSkills]         = useState<IASkill[]>([]);
  const [iaLoading, setIaLoading]       = useState(true);
  const [iaError, setIaError]           = useState<string | null>(null);
  const [iaStats, setIaStats]           = useState<{ total: number; categories: Record<string, number> }>({ total: 0, categories: {} });
  const [iaCat, setIaCat]               = useState("");
  const [iaSearch, setIaSearch]         = useState("");
  const [selectedIA, setSelectedIA]     = useState<IASkill | null>(null);
  const [varValues, setVarValues]       = useState<Record<string, string>>({});
  const [executing, setExecuting]       = useState(false);
  const [execResult, setExecResult]     = useState<string | null>(null);
  const [copiedId, setCopiedId]         = useState<string | null>(null);

  // ── Cyber state ─────────────────────────────────────────────────────────────
  const [cyberSkills, setCyberSkills]   = useState<CyberSkill[]>([]);
  const [cyberTotal, setCyberTotal]     = useState(0);
  const [cyberDomains, setCyberDomains] = useState<CyberDomain[]>([]);
  const [cyberLoading, setCyberLoading] = useState(false);
  const [cyberError, setCyberError]     = useState<string | null>(null);
  const [cyberDomain, setCyberDomain]   = useState("");
  const [cyberSearch, setCyberSearch]   = useState("");
  const [cyberPage, setCyberPage]       = useState(0);
  const [selectedCyber, setSelectedCyber] = useState<CyberSkill | null>(null);
  const [cyberDetail, setCyberDetail]   = useState<string | null>(null);
  const [cyberDetailLoading, setCyberDetailLoading] = useState(false);
  const [domainOpen, setDomainOpen]     = useState(false);

  // ── Load IA skills ───────────────────────────────────────────────────────────
  useEffect(() => {
    (async () => {
      try {
        const r = await fetch(`${API_BASE}/api/skills?limit=200`, { credentials: "include" });
        if (!r.ok) throw new Error("Error cargando skills IA");
        const data = await r.json();
        setIaSkills(data.skills || []);
        setIaStats(data.stats || { total: 0, categories: {} });
      } catch (e: unknown) {
        setIaError(e instanceof Error ? e.message : "Error desconocido");
      } finally {
        setIaLoading(false);
      }
    })();
  }, []);

  // ── Load Cybersec skills ─────────────────────────────────────────────────────
  const loadCyber = useCallback(async (domain: string, search: string, page: number) => {
    setCyberLoading(true);
    setCyberError(null);
    try {
      const params = new URLSearchParams({ limit: String(PAGE_SIZE), offset: String(page * PAGE_SIZE) });
      if (search) params.set("q", search);
      else if (domain) params.set("domain", domain);
      const r = await fetch(`${API_BASE}/api/cybersec/catalog?${params}`, { credentials: "include" });
      if (!r.ok) throw new Error("Error cargando catálogo");
      const data = await r.json();
      setCyberSkills(data.skills || []);
      setCyberTotal(data.total || 0);
      if (data.domains) setCyberDomains(data.domains);
    } catch (e: unknown) {
      setCyberError(e instanceof Error ? e.message : "Error");
    } finally {
      setCyberLoading(false);
    }
  }, []);

  useEffect(() => {
    if (mode === "cyber") loadCyber(cyberDomain, cyberSearch, cyberPage);
  }, [mode, cyberDomain, cyberSearch, cyberPage, loadCyber]);

  // ── Cyber detail ─────────────────────────────────────────────────────────────
  async function openCyber(skill: CyberSkill) {
    setSelectedCyber(skill);
    setCyberDetail(null);
    setCyberDetailLoading(true);
    try {
      const r = await fetch(`${API_BASE}/api/cybersec/skill/${encodeURIComponent(skill.id)}`, { credentials: "include" });
      const data = await r.json();
      setCyberDetail(data.content || null);
    } catch { /* silent */ } finally {
      setCyberDetailLoading(false);
    }
  }

  // ── IA execute ───────────────────────────────────────────────────────────────
  async function executeSkill(skill: IASkill) {
    setExecuting(true); setExecResult(null);
    try {
      const r = await fetch(`${API_BASE}/api/skills/${skill.id}/execute`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        credentials: "include", body: JSON.stringify({ variables: varValues }),
      });
      const data = await r.json();
      setExecResult(data.result || data.content || JSON.stringify(data, null, 2));
    } catch (e: unknown) {
      setExecResult(`Error: ${e instanceof Error ? e.message : "Desconocido"}`);
    } finally {
      setExecuting(false);
    }
  }

  function openIA(skill: IASkill) {
    setSelectedIA(skill); setExecResult(null);
    const d: Record<string, string> = {};
    skill.variables.forEach(v => { d[v] = ""; });
    setVarValues(d);
  }

  function copyText(text: string, id: string) {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  }

  // ── Filtered IA ──────────────────────────────────────────────────────────────
  const iaFiltered = iaSkills.filter(s => {
    const q = iaSearch.toLowerCase();
    return (
      (!iaCat || s.category === iaCat) &&
      (!q || s.name.toLowerCase().includes(q) || s.description.toLowerCase().includes(q) || s.tags.some(t => t.includes(q)))
    );
  });

  const cyberPages = Math.ceil(cyberTotal / PAGE_SIZE);
  const totalSkills = (iaStats.total || iaSkills.length) + 817;

  // ── Render ───────────────────────────────────────────────────────────────────
  return (
    <div style={{ padding: "24px", maxWidth: 1400, margin: "0 auto" }}>

      {/* ── Header ── */}
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 20 }}>
        <div style={{ width: 44, height: 44, borderRadius: 12, background: "linear-gradient(135deg, #60a5fa, #7c3aed)", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <BookOpen size={22} color="#fff" />
        </div>
        <div>
          <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700, color: "var(--t1)" }}>Librería de Skills</h1>
          <p style={{ margin: 0, fontSize: 13, color: "var(--t3)" }}>{totalSkills.toLocaleString()} skills totales — IA profesionales + Ciberseguridad</p>
        </div>
      </div>

      {/* ── Mode tabs ── */}
      <div style={{ display: "flex", gap: 4, background: "var(--s2)", borderRadius: 10, padding: 4, marginBottom: 20, width: "fit-content" }}>
        <button
          onClick={() => { setMode("ia"); setSelectedCyber(null); }}
          style={{ padding: "8px 18px", borderRadius: 7, fontSize: 13, fontWeight: 700, cursor: "pointer", border: "none",
            background: mode === "ia" ? "var(--gold)" : "transparent",
            color: mode === "ia" ? "#000" : "var(--t3)" }}
        >
          🤖 Skills IA &nbsp;<span style={{ fontWeight: 400, opacity: 0.7 }}>({iaStats.total || iaSkills.length})</span>
        </button>
        <button
          onClick={() => { setMode("cyber"); setSelectedIA(null); setExecResult(null); }}
          style={{ padding: "8px 18px", borderRadius: 7, fontSize: 13, fontWeight: 700, cursor: "pointer", border: "none",
            background: mode === "cyber" ? "#ef4444" : "transparent",
            color: mode === "cyber" ? "#fff" : "var(--t3)" }}
        >
          🔐 Ciberseguridad &nbsp;<span style={{ fontWeight: 400, opacity: 0.8 }}>({cyberTotal || 817})</span>
        </button>
      </div>

      {/* ══════════════════════════ IA MODE ══════════════════════════ */}
      {mode === "ia" && (
        <>
          {iaError && (
            <div style={{ background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.3)", borderRadius: 10, padding: "12px 16px", marginBottom: 16, color: "#f87171", display: "flex", gap: 8 }}>
              <AlertCircle size={16} /> {iaError}
            </div>
          )}

          {/* Category pills */}
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 14 }}>
            <button onClick={() => setIaCat("")}
              style={{ padding: "6px 13px", borderRadius: 20, fontSize: 11.5, fontWeight: 600, cursor: "pointer",
                background: !iaCat ? "var(--gold)" : "var(--s1)", color: !iaCat ? "#000" : "var(--t2)",
                border: !iaCat ? "none" : "1px solid var(--border)" }}>
              🌐 Todas ({iaSkills.length})
            </button>
            {Object.entries(IA_CAT).map(([cat, meta]) => {
              const cnt = iaStats.categories[cat] || iaSkills.filter(s => s.category === cat).length;
              if (!cnt) return null;
              return (
                <button key={cat} onClick={() => setIaCat(iaCat === cat ? "" : cat)}
                  style={{ padding: "6px 13px", borderRadius: 20, fontSize: 11.5, fontWeight: 600, cursor: "pointer",
                    background: iaCat === cat ? meta.color : "var(--s1)", color: iaCat === cat ? "#000" : "var(--t2)",
                    border: iaCat === cat ? "none" : "1px solid var(--border)" }}>
                  {meta.icon} {meta.label} ({cnt})
                </button>
              );
            })}
          </div>

          {/* Search */}
          <div style={{ position: "relative", marginBottom: 20 }}>
            <Search size={14} style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: "var(--t4)" }} />
            <input value={iaSearch} onChange={e => setIaSearch(e.target.value)}
              placeholder="Buscar skill por nombre, descripción o etiqueta..."
              style={{ width: "100%", background: "var(--s1)", border: "1px solid var(--border)", borderRadius: 10, padding: "9px 12px 9px 36px", color: "var(--t1)", fontSize: 13, boxSizing: "border-box" }} />
            {iaSearch && <button onClick={() => setIaSearch("")} style={{ position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", color: "var(--t4)" }}><X size={13} /></button>}
          </div>

          <div style={{ display: "grid", gridTemplateColumns: selectedIA ? "1fr 420px" : "1fr", gap: 20 }}>
            {/* Grid */}
            <div>
              {iaLoading ? (
                <div style={{ textAlign: "center", padding: "60px 0" }}>
                  <Loader2 size={28} style={{ animation: "spin 0.6s linear infinite", color: "var(--gold)" }} />
                  <div style={{ marginTop: 12, color: "var(--t3)" }}>Cargando skills...</div>
                </div>
              ) : (
                <>
                  <div style={{ fontSize: 12, color: "var(--t3)", marginBottom: 12 }}>{iaFiltered.length} skills encontrados</div>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(270px, 1fr))", gap: 10 }}>
                    {iaFiltered.map(skill => {
                      const meta = IA_CAT[skill.category] || { icon: "🔧", color: "var(--gold)", label: skill.category };
                      const diff = DIFF_META[skill.difficulty] || { label: "—", color: "var(--t3)" };
                      const sel = selectedIA?.id === skill.id;
                      return (
                        <div key={skill.id} onClick={() => openIA(skill)} style={{
                          background: sel ? `${meta.color}11` : "var(--s1)",
                          border: sel ? `1.5px solid ${meta.color}` : "1px solid var(--border)",
                          borderRadius: 12, padding: 14, cursor: "pointer", transition: "all 0.15s",
                        }}>
                          <div style={{ display: "flex", alignItems: "flex-start", gap: 10, marginBottom: 8 }}>
                            <div style={{ fontSize: 20, lineHeight: 1 }}>{meta.icon}</div>
                            <div style={{ flex: 1 }}>
                              <div style={{ fontWeight: 700, fontSize: 13, color: "var(--t1)", lineHeight: 1.3 }}>{skill.name}</div>
                              <div style={{ fontSize: 11, color: meta.color, fontWeight: 600, marginTop: 2 }}>{meta.label}</div>
                            </div>
                            <ChevronRight size={14} color="var(--t4)" />
                          </div>
                          <div style={{ fontSize: 12, color: "var(--t3)", marginBottom: 10, lineHeight: 1.5 }}>{skill.description}</div>
                          <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginBottom: 8 }}>
                            {(skill.tags || []).slice(0, 3).map(tag => (
                              <span key={tag} style={{ background: "var(--s2)", borderRadius: 4, padding: "1px 6px", fontSize: 10, color: "var(--t3)" }}>#{tag}</span>
                            ))}
                          </div>
                          <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 11 }}>
                            <span style={{ color: diff.color }}>{diff.label}</span>
                            {skill.variables.length > 0 && <span style={{ color: "var(--t4)" }}>· {skill.variables.length} vars</span>}
                            <span style={{ marginLeft: "auto", background: "var(--s2)", borderRadius: 4, padding: "1px 6px", color: "var(--t4)" }}>{skill.aiModel}</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </>
              )}
            </div>

            {/* IA Detail Panel */}
            {selectedIA && (
              <div style={{ background: "var(--s1)", border: "1px solid var(--border)", borderRadius: 14, overflow: "hidden", alignSelf: "start", position: "sticky", top: 20 }}>
                <div style={{ padding: "14px 16px", borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center", gap: 10 }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 700, fontSize: 15, color: "var(--t1)" }}>{selectedIA.name}</div>
                    <div style={{ fontSize: 12, color: "var(--t3)", marginTop: 2 }}>{selectedIA.useCase}</div>
                  </div>
                  <button onClick={() => setSelectedIA(null)} style={{ background: "var(--s2)", border: "none", borderRadius: 6, padding: 6, cursor: "pointer", color: "var(--t3)" }}><X size={13} /></button>
                </div>
                <div style={{ padding: 16 }}>
                  {selectedIA.variables.length > 0 && (
                    <div style={{ marginBottom: 14 }}>
                      <div style={{ fontSize: 11, color: "var(--t3)", fontWeight: 700, marginBottom: 8, textTransform: "uppercase", letterSpacing: "0.06em" }}>VARIABLES</div>
                      {selectedIA.variables.map(v => (
                        <div key={v} style={{ marginBottom: 7 }}>
                          <div style={{ fontSize: 11, color: "var(--t2)", marginBottom: 3 }}>
                            <code style={{ background: "var(--s2)", borderRadius: 4, padding: "1px 6px", color: "var(--gold)" }}>{`{{${v}}}`}</code>
                          </div>
                          <input value={varValues[v] || ""} onChange={e => setVarValues(p => ({ ...p, [v]: e.target.value }))}
                            placeholder={`Valor para ${v}...`}
                            style={{ width: "100%", background: "var(--s2)", border: "1px solid var(--border)", borderRadius: 6, padding: "6px 10px", color: "var(--t1)", fontSize: 12, boxSizing: "border-box" }} />
                        </div>
                      ))}
                    </div>
                  )}
                  <div style={{ marginBottom: 14 }}>
                    <div style={{ fontSize: 11, color: "var(--t3)", fontWeight: 700, marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.06em" }}>TEMPLATE</div>
                    <div style={{ background: "var(--s2)", borderRadius: 8, padding: 10, fontSize: 11, color: "var(--t2)", lineHeight: 1.6, maxHeight: 160, overflowY: "auto", whiteSpace: "pre-wrap", fontFamily: "monospace" }}>
                      {selectedIA.promptTemplate}
                    </div>
                    <button onClick={() => copyText(selectedIA.promptTemplate, "template")}
                      style={{ marginTop: 5, background: "none", border: "none", color: "var(--t4)", cursor: "pointer", fontSize: 11, display: "flex", alignItems: "center", gap: 4 }}>
                      {copiedId === "template" ? <><Check size={10} color="var(--jade)" /> Copiado</> : <><Copy size={10} /> Copiar template</>}
                    </button>
                  </div>
                  <button onClick={() => executeSkill(selectedIA)} disabled={executing}
                    style={{ width: "100%", background: "var(--gold)", color: "#000", border: "none", borderRadius: 8, padding: "10px 0", fontSize: 13, fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
                    {executing ? <Loader2 size={13} style={{ animation: "spin 0.6s linear infinite" }} /> : <Play size={13} />}
                    Ejecutar Skill
                  </button>
                  {execResult && (
                    <div style={{ marginTop: 12 }}>
                      <div style={{ fontSize: 11, color: "var(--t3)", fontWeight: 700, marginBottom: 5, textTransform: "uppercase", letterSpacing: "0.06em" }}>RESULTADO</div>
                      <div style={{ background: "rgba(52,211,153,0.06)", border: "1px solid rgba(52,211,153,0.2)", borderRadius: 8, padding: 10, fontSize: 12, color: "var(--t1)", lineHeight: 1.6, maxHeight: 280, overflowY: "auto", whiteSpace: "pre-wrap" }}>
                        {execResult}
                      </div>
                      <button onClick={() => copyText(execResult, "result")}
                        style={{ marginTop: 5, background: "none", border: "none", color: "var(--t4)", cursor: "pointer", fontSize: 11, display: "flex", alignItems: "center", gap: 4 }}>
                        {copiedId === "result" ? <><Check size={10} color="var(--jade)" /> Copiado</> : <><Copy size={10} /> Copiar resultado</>}
                      </button>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </>
      )}

      {/* ══════════════════════════ CYBER MODE ══════════════════════════ */}
      {mode === "cyber" && (
        <>
          <div style={{ display: "flex", gap: 10, marginBottom: 14, alignItems: "center", flexWrap: "wrap" }}>
            {/* Domain dropdown */}
            <div style={{ position: "relative" }}>
              <button onClick={() => setDomainOpen(o => !o)}
                style={{ display: "flex", alignItems: "center", gap: 6, padding: "7px 14px", background: cyberDomain ? "rgba(239,68,68,0.15)" : "var(--s1)", border: `1px solid ${cyberDomain ? "#ef4444" : "var(--border)"}`, borderRadius: 8, color: cyberDomain ? "#ef4444" : "var(--t2)", fontSize: 12, fontWeight: 600, cursor: "pointer" }}>
                <Shield size={13} />
                {cyberDomain ? (cyberDomains.find(d => d.name === cyberDomain)?.name || cyberDomain) : "Todos los dominios"}
                <ChevronDown size={12} />
              </button>
              {domainOpen && (
                <div style={{ position: "absolute", top: "100%", left: 0, zIndex: 100, background: "var(--ink)", border: "1px solid var(--border)", borderRadius: 10, padding: 6, minWidth: 220, maxHeight: 300, overflowY: "auto", marginTop: 4, boxShadow: "0 8px 32px rgba(0,0,0,0.4)" }}>
                  <button onClick={() => { setCyberDomain(""); setCyberPage(0); setDomainOpen(false); }}
                    style={{ display: "block", width: "100%", textAlign: "left", padding: "7px 12px", background: !cyberDomain ? "rgba(239,68,68,0.15)" : "none", border: "none", borderRadius: 6, color: !cyberDomain ? "#ef4444" : "var(--t2)", fontSize: 12, cursor: "pointer" }}>
                    🌐 Todos los dominios ({cyberTotal || 817})
                  </button>
                  {cyberDomains.map(d => (
                    <button key={d.name} onClick={() => { setCyberDomain(d.name); setCyberPage(0); setDomainOpen(false); }}
                      style={{ display: "flex", justifyContent: "space-between", alignItems: "center", width: "100%", textAlign: "left", padding: "7px 12px", background: cyberDomain === d.name ? "rgba(239,68,68,0.15)" : "none", border: "none", borderRadius: 6, color: cyberDomain === d.name ? "#ef4444" : "var(--t2)", fontSize: 12, cursor: "pointer" }}>
                      <span>{d.name}</span>
                      <span style={{ fontSize: 10, background: "var(--s2)", borderRadius: 10, padding: "1px 7px", color: "var(--t4)" }}>{d.count}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Search */}
            <div style={{ position: "relative", flex: 1, minWidth: 200 }}>
              <Search size={13} style={{ position: "absolute", left: 11, top: "50%", transform: "translateY(-50%)", color: "var(--t4)" }} />
              <input value={cyberSearch} onChange={e => { setCyberSearch(e.target.value); setCyberPage(0); setCyberDomain(""); }}
                placeholder="Buscar en 817 skills de ciberseguridad..."
                style={{ width: "100%", background: "var(--s1)", border: "1px solid var(--border)", borderRadius: 8, padding: "7px 10px 7px 32px", color: "var(--t1)", fontSize: 12, boxSizing: "border-box" }} />
              {cyberSearch && <button onClick={() => { setCyberSearch(""); setCyberPage(0); }} style={{ position: "absolute", right: 9, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", color: "var(--t4)" }}><X size={12} /></button>}
            </div>

            {/* Pagination info */}
            {cyberTotal > 0 && (
              <div style={{ fontSize: 12, color: "var(--t4)", whiteSpace: "nowrap" }}>
                {cyberPage * PAGE_SIZE + 1}–{Math.min((cyberPage + 1) * PAGE_SIZE, cyberTotal)} de {cyberTotal}
              </div>
            )}
            <div style={{ display: "flex", gap: 4 }}>
              <button onClick={() => setCyberPage(p => Math.max(0, p - 1))} disabled={cyberPage === 0}
                style={{ background: "var(--s1)", border: "1px solid var(--border)", borderRadius: 6, padding: "5px 9px", cursor: cyberPage === 0 ? "not-allowed" : "pointer", color: "var(--t3)", opacity: cyberPage === 0 ? 0.4 : 1 }}>
                <ChevronLeft size={13} />
              </button>
              <button onClick={() => setCyberPage(p => Math.min(cyberPages - 1, p + 1))} disabled={cyberPage >= cyberPages - 1}
                style={{ background: "var(--s1)", border: "1px solid var(--border)", borderRadius: 6, padding: "5px 9px", cursor: cyberPage >= cyberPages - 1 ? "not-allowed" : "pointer", color: "var(--t3)", opacity: cyberPage >= cyberPages - 1 ? 0.4 : 1 }}>
                <ChevronRight size={13} />
              </button>
            </div>
          </div>

          {cyberError && (
            <div style={{ background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.3)", borderRadius: 10, padding: "12px 16px", marginBottom: 14, color: "#f87171", display: "flex", gap: 8 }}>
              <AlertCircle size={15} /> {cyberError}
            </div>
          )}

          {/* Info strip */}
          <div style={{ background: "rgba(239,68,68,0.06)", border: "1px solid rgba(239,68,68,0.15)", borderRadius: 8, padding: "8px 14px", marginBottom: 14, fontSize: 11, color: "var(--t4)", display: "flex", gap: 16 }}>
            <span>🛡️ <strong style={{ color: "var(--t3)" }}>817 skills</strong> · MITRE ATT&CK v19.1</span>
            <span>📋 NIST CSF 2.0</span>
            <span>🗂️ 30 dominios</span>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: selectedCyber ? "1fr 420px" : "1fr", gap: 20 }}>
            {/* Cyber Grid */}
            <div>
              {cyberLoading ? (
                <div style={{ textAlign: "center", padding: "60px 0" }}>
                  <Loader2 size={28} style={{ animation: "spin 0.6s linear infinite", color: "#ef4444" }} />
                  <div style={{ marginTop: 12, color: "var(--t3)" }}>Cargando catálogo de ciberseguridad...</div>
                </div>
              ) : (
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(270px, 1fr))", gap: 10 }}>
                  {cyberSkills.map(skill => {
                    const sev = (skill.severity ?? "info").toLowerCase();
                    const sevColor = SEV_COLOR[sev] || "#60a5fa";
                    const sel = selectedCyber?.id === skill.id;
                    const mitre = Array.isArray(skill.mitre_attack) ? skill.mitre_attack : (skill.mitre_attack ? [skill.mitre_attack] : []);
                    const tags = Array.isArray(skill.tags) ? skill.tags : [];
                    return (
                      <div key={skill.id} onClick={() => openCyber(skill)} style={{
                        background: sel ? "rgba(239,68,68,0.08)" : "var(--s1)",
                        border: sel ? "1.5px solid #ef4444" : "1px solid var(--border)",
                        borderRadius: 12, padding: 14, cursor: "pointer", transition: "all 0.15s",
                      }}>
                        <div style={{ display: "flex", alignItems: "flex-start", gap: 8, marginBottom: 7 }}>
                          <Shield size={16} color={sevColor} style={{ marginTop: 1, flexShrink: 0 }} />
                          <div style={{ flex: 1 }}>
                            <div style={{ fontWeight: 700, fontSize: 12.5, color: "var(--t1)", lineHeight: 1.3 }}>{skill.name}</div>
                            <div style={{ fontSize: 10, color: "var(--t4)", marginTop: 2 }}>{skill.subdomain || "General"}</div>
                          </div>
                          <span style={{ fontSize: 9, fontWeight: 700, padding: "2px 7px", borderRadius: 10, background: `${sevColor}22`, color: sevColor, textTransform: "uppercase", flexShrink: 0 }}>{sev}</span>
                        </div>
                        <div style={{ fontSize: 11.5, color: "var(--t3)", marginBottom: 9, lineHeight: 1.5, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
                          {skill.description}
                        </div>
                        {mitre.length > 0 && (
                          <div style={{ display: "flex", flexWrap: "wrap", gap: 3, marginBottom: 6 }}>
                            {mitre.slice(0, 2).map((m: string) => (
                              <span key={m} style={{ background: "rgba(239,68,68,0.1)", borderRadius: 4, padding: "1px 6px", fontSize: 9.5, color: "#f87171", fontWeight: 600 }}>{m}</span>
                            ))}
                          </div>
                        )}
                        <div style={{ display: "flex", flexWrap: "wrap", gap: 3 }}>
                          {tags.slice(0, 3).map((tag: string) => (
                            <span key={tag} style={{ background: "var(--s2)", borderRadius: 4, padding: "1px 6px", fontSize: 9.5, color: "var(--t4)" }}>#{tag}</span>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Cyber Detail Panel */}
            {selectedCyber && (
              <div style={{ background: "var(--s1)", border: "1px solid rgba(239,68,68,0.3)", borderRadius: 14, overflow: "hidden", alignSelf: "start", position: "sticky", top: 20 }}>
                <div style={{ padding: "14px 16px", borderBottom: "1px solid var(--border)", display: "flex", alignItems: "flex-start", gap: 10, background: "rgba(239,68,68,0.06)" }}>
                  <Shield size={18} color="#ef4444" style={{ marginTop: 2, flexShrink: 0 }} />
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 700, fontSize: 14, color: "var(--t1)" }}>{selectedCyber.name}</div>
                    <div style={{ fontSize: 11, color: "var(--t4)", marginTop: 2 }}>{selectedCyber.subdomain || "General"}</div>
                  </div>
                  <button onClick={() => setSelectedCyber(null)} style={{ background: "var(--s2)", border: "none", borderRadius: 6, padding: 6, cursor: "pointer", color: "var(--t3)", flexShrink: 0 }}><X size={13} /></button>
                </div>
                <div style={{ padding: 16 }}>
                  <div style={{ fontSize: 12, color: "var(--t3)", lineHeight: 1.6, marginBottom: 12 }}>{selectedCyber.description}</div>

                  {/* Severity + MITRE + NIST badges */}
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 14 }}>
                    {selectedCyber.severity && (
                      <span style={{ fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 10, background: `${SEV_COLOR[(selectedCyber.severity).toLowerCase()] || "#60a5fa"}22`, color: SEV_COLOR[(selectedCyber.severity).toLowerCase()] || "#60a5fa", textTransform: "uppercase" }}>
                        {selectedCyber.severity}
                      </span>
                    )}
                    {(Array.isArray(selectedCyber.mitre_attack) ? selectedCyber.mitre_attack : (selectedCyber.mitre_attack ? [selectedCyber.mitre_attack] : [])).map((m: string) => (
                      <span key={m} style={{ fontSize: 10, padding: "2px 8px", borderRadius: 10, background: "rgba(239,68,68,0.12)", color: "#f87171", fontWeight: 600 }}>{m}</span>
                    ))}
                    {(Array.isArray(selectedCyber.nist_csf) ? selectedCyber.nist_csf : (selectedCyber.nist_csf ? [selectedCyber.nist_csf] : [])).map((n: string) => (
                      <span key={n} style={{ fontSize: 10, padding: "2px 8px", borderRadius: 10, background: "rgba(96,165,250,0.12)", color: "#60a5fa", fontWeight: 600 }}>NIST: {n}</span>
                    ))}
                  </div>

                  {/* Script content */}
                  <div style={{ fontSize: 11, color: "var(--t3)", fontWeight: 700, marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.06em" }}>SCRIPT / CONTENIDO</div>
                  {cyberDetailLoading ? (
                    <div style={{ textAlign: "center", padding: "20px 0" }}><Loader2 size={18} style={{ animation: "spin 0.6s linear infinite", color: "#ef4444" }} /></div>
                  ) : cyberDetail ? (
                    <>
                      <div style={{ background: "var(--s2)", borderRadius: 8, padding: 10, fontSize: 11, color: "var(--t2)", lineHeight: 1.6, maxHeight: 280, overflowY: "auto", whiteSpace: "pre-wrap", fontFamily: "monospace" }}>
                        {cyberDetail}
                      </div>
                      <button onClick={() => copyText(cyberDetail, "cyberContent")}
                        style={{ marginTop: 6, background: "none", border: "none", color: "var(--t4)", cursor: "pointer", fontSize: 11, display: "flex", alignItems: "center", gap: 4 }}>
                        {copiedId === "cyberContent" ? <><Check size={10} color="var(--jade)" /> Copiado</> : <><Copy size={10} /> Copiar script</>}
                      </button>
                    </>
                  ) : (
                    <div style={{ color: "var(--t4)", fontSize: 12 }}>No hay contenido de script disponible para este skill.</div>
                  )}
                </div>
              </div>
            )}
          </div>
        </>
      )}

      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
