import { useState, useEffect } from "react";
import { BookOpen, Play, Search, Copy, Check, Star, Zap, Filter, Loader2, AlertCircle, ChevronRight, X } from "lucide-react";

const API_BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

interface Skill {
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
  outputFormat: string;
}

const CATEGORY_META: Record<string, { icon: string; color: string; label: string }> = {
  design: { icon: "🎨", color: "#f59e0b", label: "Diseño" },
  content: { icon: "✍️", color: "#60a5fa", label: "Contenido" },
  seo: { icon: "🔍", color: "#4ade80", label: "SEO" },
  social: { icon: "📱", color: "#a78bfa", label: "Social Media" },
  analytics: { icon: "📊", color: "#34d399", label: "Analytics" },
  commerce: { icon: "🛒", color: "#fb923c", label: "Commerce" },
  "3d": { icon: "🧊", color: "#22d3ee", label: "3D" },
  code: { icon: "💻", color: "#f87171", label: "Código" },
  email: { icon: "📧", color: "#c084fc", label: "Email" },
  video: { icon: "🎬", color: "#fbbf24", label: "Video" },
};

const DIFFICULTY_META = {
  beginner: { label: "Principiante", color: "#4ade80" },
  intermediate: { label: "Intermedio", color: "#fbbf24" },
  advanced: { label: "Avanzado", color: "#f87171" },
};

export default function SkillsLibrary() {
  const [skills, setSkills] = useState<Skill[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterCategory, setFilterCategory] = useState("");
  const [selectedSkill, setSelectedSkill] = useState<Skill | null>(null);
  const [varValues, setVarValues] = useState<Record<string, string>>({});
  const [executing, setExecuting] = useState(false);
  const [execResult, setExecResult] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [stats, setStats] = useState<{ total: number; categories: Record<string, number> }>({ total: 0, categories: {} });

  useEffect(() => { fetchSkills(); }, []);

  async function fetchSkills() {
    try {
      const r = await fetch(`${API_BASE}/api/skills?limit=200`, { credentials: "include" });
      if (!r.ok) throw new Error("Error cargando skills");
      const data = await r.json();
      setSkills(data.skills || []);
      setStats(data.stats || { total: 0, categories: {} });
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Error desconocido");
    } finally {
      setLoading(false);
    }
  }

  async function executeSkill(skill: Skill) {
    setExecuting(true);
    setExecResult(null);
    try {
      const r = await fetch(`${API_BASE}/api/skills/${skill.id}/execute`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ variables: varValues }),
      });
      const data = await r.json();
      setExecResult(data.result || data.content || JSON.stringify(data, null, 2));
    } catch (e: unknown) {
      setExecResult(`Error: ${e instanceof Error ? e.message : "Desconocido"}`);
    } finally {
      setExecuting(false);
    }
  }

  function openSkill(skill: Skill) {
    setSelectedSkill(skill);
    setExecResult(null);
    const defaults: Record<string, string> = {};
    skill.variables.forEach(v => { defaults[v] = ""; });
    setVarValues(defaults);
  }

  function copyText(text: string, id: string) {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  }

  const categories = Object.keys(CATEGORY_META);
  const filtered = skills.filter(s => {
    const q = search.toLowerCase();
    return (
      (!filterCategory || s.category === filterCategory) &&
      (!q || s.name.toLowerCase().includes(q) || s.description.toLowerCase().includes(q) || s.tags.some(t => t.includes(q)))
    );
  });

  return (
    <div style={{ padding: "24px", maxWidth: 1400, margin: "0 auto" }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 24 }}>
        <div style={{ width: 44, height: 44, borderRadius: 12, background: "linear-gradient(135deg, #60a5fa, #2563eb)", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <BookOpen size={22} color="#fff" />
        </div>
        <div>
          <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700, color: "var(--t1)" }}>Librería de Skills IA</h1>
          <p style={{ margin: 0, fontSize: 13, color: "var(--t3)" }}>{stats.total || skills.length} skills profesionales en {Object.keys(stats.categories).length || categories.length} categorías</p>
        </div>
      </div>

      {error && (
        <div style={{ background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.3)", borderRadius: 10, padding: "12px 16px", marginBottom: 16, color: "#f87171", display: "flex", gap: 8 }}>
          <AlertCircle size={16} /> {error}
        </div>
      )}

      {/* Category pills */}
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 20 }}>
        <button
          onClick={() => setFilterCategory("")}
          style={{ padding: "7px 14px", borderRadius: 20, fontSize: 12, fontWeight: 600, cursor: "pointer", background: !filterCategory ? "var(--gold)" : "var(--s1)", color: !filterCategory ? "#000" : "var(--t2)", border: !filterCategory ? "none" : "1px solid var(--border)" }}
        >
          🌐 Todas ({skills.length})
        </button>
        {categories.map(cat => {
          const meta = CATEGORY_META[cat];
          const count = stats.categories[cat] || skills.filter(s => s.category === cat).length;
          if (!count) return null;
          return (
            <button
              key={cat}
              onClick={() => setFilterCategory(cat === filterCategory ? "" : cat)}
              style={{ padding: "7px 14px", borderRadius: 20, fontSize: 12, fontWeight: 600, cursor: "pointer", background: filterCategory === cat ? meta.color : "var(--s1)", color: filterCategory === cat ? "#000" : "var(--t2)", border: filterCategory === cat ? "none" : "1px solid var(--border)" }}
            >
              {meta.icon} {meta.label} ({count})
            </button>
          );
        })}
      </div>

      {/* Search */}
      <div style={{ position: "relative", marginBottom: 20 }}>
        <Search size={16} style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: "var(--t4)" }} />
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Buscar skill por nombre, descripción o etiqueta..."
          style={{ width: "100%", background: "var(--s1)", border: "1px solid var(--border)", borderRadius: 10, padding: "10px 12px 10px 38px", color: "var(--t1)", fontSize: 14, boxSizing: "border-box" }}
        />
        {search && (
          <button onClick={() => setSearch("")} style={{ position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", color: "var(--t4)" }}>
            <X size={14} />
          </button>
        )}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: selectedSkill ? "1fr 420px" : "1fr", gap: 20 }}>
        {/* Skills Grid */}
        <div>
          {loading ? (
            <div style={{ textAlign: "center", padding: "60px 0" }}>
              <Loader2 size={28} style={{ animation: "spin 0.6s linear infinite", color: "var(--gold)" }} />
              <div style={{ marginTop: 12, color: "var(--t3)" }}>Cargando skills...</div>
            </div>
          ) : (
            <>
              <div style={{ fontSize: 12, color: "var(--t3)", marginBottom: 12 }}>{filtered.length} skills encontrados</div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 12 }}>
                {filtered.map(skill => {
                  const meta = CATEGORY_META[skill.category] || { icon: "🔧", color: "var(--gold)", label: skill.category };
                  const diff = DIFFICULTY_META[skill.difficulty];
                  const isSelected = selectedSkill?.id === skill.id;
                  return (
                    <div
                      key={skill.id}
                      onClick={() => openSkill(skill)}
                      style={{
                        background: isSelected ? `${meta.color}11` : "var(--s1)",
                        border: isSelected ? `1.5px solid ${meta.color}` : "1px solid var(--border)",
                        borderRadius: 12, padding: 14, cursor: "pointer", transition: "all 0.15s",
                      }}
                    >
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
                        {skill.tags.slice(0, 3).map(tag => (
                          <span key={tag} style={{ background: "var(--s2)", borderRadius: 4, padding: "1px 6px", fontSize: 10, color: "var(--t3)" }}>#{tag}</span>
                        ))}
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 11 }}>
                        <span style={{ color: diff.color }}>{diff.label}</span>
                        {skill.variables.length > 0 && (
                          <span style={{ color: "var(--t4)" }}>· {skill.variables.length} variables</span>
                        )}
                        <span style={{ marginLeft: "auto", background: "var(--s2)", borderRadius: 4, padding: "1px 6px", color: "var(--t4)" }}>{skill.aiModel}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </div>

        {/* Detail Panel */}
        {selectedSkill && (
          <div style={{ background: "var(--s1)", border: "1px solid var(--border)", borderRadius: 14, overflow: "hidden", alignSelf: "start", position: "sticky", top: 20 }}>
            <div style={{ padding: "16px 18px", borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center", gap: 10 }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 700, fontSize: 15, color: "var(--t1)" }}>{selectedSkill.name}</div>
                <div style={{ fontSize: 12, color: "var(--t3)", marginTop: 2 }}>{selectedSkill.useCase}</div>
              </div>
              <button onClick={() => setSelectedSkill(null)} style={{ background: "var(--s2)", border: "none", borderRadius: 6, padding: 6, cursor: "pointer", color: "var(--t3)" }}>
                <X size={14} />
              </button>
            </div>
            <div style={{ padding: 18 }}>
              {/* Variables */}
              {selectedSkill.variables.length > 0 && (
                <div style={{ marginBottom: 16 }}>
                  <div style={{ fontSize: 12, color: "var(--t3)", fontWeight: 700, marginBottom: 10, textTransform: "uppercase", letterSpacing: "0.06em" }}>VARIABLES</div>
                  {selectedSkill.variables.map(v => (
                    <div key={v} style={{ marginBottom: 8 }}>
                      <div style={{ fontSize: 12, color: "var(--t2)", marginBottom: 4 }}>
                        <code style={{ background: "var(--s2)", borderRadius: 4, padding: "1px 6px", color: "var(--gold)" }}>{`{{${v}}}`}</code>
                      </div>
                      <input
                        value={varValues[v] || ""}
                        onChange={e => setVarValues(prev => ({ ...prev, [v]: e.target.value }))}
                        placeholder={`Valor para ${v}...`}
                        style={{ width: "100%", background: "var(--s2)", border: "1px solid var(--border)", borderRadius: 6, padding: "7px 10px", color: "var(--t1)", fontSize: 12, boxSizing: "border-box" }}
                      />
                    </div>
                  ))}
                </div>
              )}

              {/* Prompt Template */}
              <div style={{ marginBottom: 16 }}>
                <div style={{ fontSize: 12, color: "var(--t3)", fontWeight: 700, marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.06em" }}>TEMPLATE</div>
                <div style={{ background: "var(--s2)", borderRadius: 8, padding: 12, fontSize: 11.5, color: "var(--t2)", lineHeight: 1.6, maxHeight: 180, overflowY: "auto", whiteSpace: "pre-wrap", fontFamily: "monospace" }}>
                  {selectedSkill.promptTemplate}
                </div>
                <button
                  onClick={() => copyText(selectedSkill.promptTemplate, "template")}
                  style={{ marginTop: 6, background: "none", border: "none", color: "var(--t4)", cursor: "pointer", fontSize: 11, display: "flex", alignItems: "center", gap: 4 }}
                >
                  {copiedId === "template" ? <><Check size={10} color="var(--jade)" /> Copiado</> : <><Copy size={10} /> Copiar template</>}
                </button>
              </div>

              {/* Execute */}
              <button
                onClick={() => executeSkill(selectedSkill)}
                disabled={executing}
                style={{ width: "100%", background: "var(--gold)", color: "#000", border: "none", borderRadius: 8, padding: "11px 0", fontSize: 13, fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}
              >
                {executing ? <Loader2 size={14} style={{ animation: "spin 0.6s linear infinite" }} /> : <Play size={14} />}
                Ejecutar Skill
              </button>

              {/* Result */}
              {execResult && (
                <div style={{ marginTop: 14 }}>
                  <div style={{ fontSize: 12, color: "var(--t3)", fontWeight: 700, marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.06em" }}>RESULTADO</div>
                  <div style={{ background: "rgba(52,211,153,0.06)", border: "1px solid rgba(52,211,153,0.2)", borderRadius: 8, padding: 12, fontSize: 12.5, color: "var(--t1)", lineHeight: 1.6, maxHeight: 300, overflowY: "auto", whiteSpace: "pre-wrap" }}>
                    {execResult}
                  </div>
                  <button
                    onClick={() => copyText(execResult, "result")}
                    style={{ marginTop: 6, background: "none", border: "none", color: "var(--t4)", cursor: "pointer", fontSize: 11, display: "flex", alignItems: "center", gap: 4 }}
                  >
                    {copiedId === "result" ? <><Check size={10} color="var(--jade)" /> Copiado</> : <><Copy size={10} /> Copiar resultado</>}
                  </button>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
