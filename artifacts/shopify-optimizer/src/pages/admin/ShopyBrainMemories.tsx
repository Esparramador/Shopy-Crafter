import { useState, useEffect } from "react";
import { Database, Plus, Trash2, Filter, Search, Star } from "lucide-react";

const API_BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

const MEMORY_TYPES = ["niche_keyword", "pricing_pattern", "image_pattern", "prompt_template", "competitor_intel", "ab_insight", "seasonal_pattern", "web_research", "general"];
const NICHES = ["moda", "tecnologia", "deporte", "hogar", "belleza", "alimentacion", "mascotas", "juguetes", "motor", "salud"];

const TYPE_COLORS: Record<string, string> = {
  niche_keyword: "#c8a84b", pricing_pattern: "#2dd49f", image_pattern: "#5b4eff",
  prompt_template: "#e84558", competitor_intel: "#f97316", ab_insight: "#06b6d4",
  seasonal_pattern: "#8b5cf6", web_research: "#2dd49f", general: "#6b7280",
};

interface Memory {
  id: string; title: string; content: string; memoryType: string;
  niche?: string; confidence: number; useCount: number; successRate: number;
  sourceType?: string; isVerified: number; createdAt: string;
}

export default function ShopyBrainMemories() {
  const [memories, setMemories] = useState<Memory[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterNiche, setFilterNiche] = useState("");
  const [filterType, setFilterType] = useState("");
  const [searchQ, setSearchQ] = useState("");
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({ title: "", content: "", memoryType: "niche_keyword", niche: "", confidence: 0.7, tags: "" });
  const [saving, setSaving] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);

  const load = () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (filterNiche) params.set("niche", filterNiche);
    if (filterType) params.set("type", filterType);
    fetch(`${API_BASE}/api/shopybrain/memories?${params}`, { credentials: "include" })
      .then(r => r.json())
      .then(d => { setMemories(d); setLoading(false); })
      .catch(() => setLoading(false));
  };

  useEffect(() => { load(); }, [filterNiche, filterType]);

  const save = async () => {
    setSaving(true);
    await fetch(`${API_BASE}/api/shopybrain/memories`, {
      method: "POST", credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    setSaving(false);
    setShowAdd(false);
    setForm({ title: "", content: "", memoryType: "niche_keyword", niche: "", confidence: 0.7, tags: "" });
    load();
  };

  const del = async (id: string) => {
    if (!confirm("¿Eliminar esta memoria?")) return;
    await fetch(`${API_BASE}/api/shopybrain/memories/${id}`, { method: "DELETE", credentials: "include" });
    load();
  };

  const filtered = memories.filter(m =>
    !searchQ || m.title.toLowerCase().includes(searchQ.toLowerCase()) || m.content.toLowerCase().includes(searchQ.toLowerCase())
  );

  return (
    <div className="page-inner">
      <div className="flex-header" style={{ marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 800 }}>🧠 Memorias del Cerebro IA</h1>
          <p style={{ fontSize: 13, color: "var(--t2)", marginTop: 3 }}>Conocimiento acumulado que hace más inteligente cada respuesta</p>
        </div>
        <button onClick={() => setShowAdd(!showAdd)} className="btn-primary">
          <Plus size={14} /> Nueva memoria
        </button>
      </div>

      {showAdd && (
        <div className="glass-card" style={{ marginBottom: 20, borderColor: "var(--gold)" }}>
          <h3 style={{ fontSize: 14, fontWeight: 700, marginBottom: 16 }}>Añadir memoria manual</h3>
          <div className="grid-r2" style={{ marginBottom: 12 }}>
            <div>
              <label style={{ fontSize: 11, color: "var(--t2)", display: "block", marginBottom: 4 }}>TIPO</label>
              <select className="input-field" value={form.memoryType} onChange={e => setForm(f => ({ ...f, memoryType: e.target.value }))}>
                {MEMORY_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div>
              <label style={{ fontSize: 11, color: "var(--t2)", display: "block", marginBottom: 4 }}>NICHO</label>
              <select className="input-field" value={form.niche} onChange={e => setForm(f => ({ ...f, niche: e.target.value }))}>
                <option value="">Universal</option>
                {NICHES.map(n => <option key={n} value={n}>{n}</option>)}
              </select>
            </div>
          </div>
          <div style={{ marginBottom: 12 }}>
            <label style={{ fontSize: 11, color: "var(--t2)", display: "block", marginBottom: 4 }}>TÍTULO</label>
            <input className="input-field" placeholder="Ej: Keyword que convierte en moda urbana" value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} />
          </div>
          <div style={{ marginBottom: 12 }}>
            <label style={{ fontSize: 11, color: "var(--t2)", display: "block", marginBottom: 4 }}>CONTENIDO</label>
            <textarea className="input-field" rows={4} placeholder="El conocimiento específico..." value={form.content} onChange={e => setForm(f => ({ ...f, content: e.target.value }))} />
          </div>
          <div className="grid-r2" style={{ marginBottom: 16 }}>
            <div>
              <label style={{ fontSize: 11, color: "var(--t2)", display: "block", marginBottom: 4 }}>CONFIANZA ({Math.round(form.confidence * 100)}%)</label>
              <input type="range" min={0} max={1} step={0.05} value={form.confidence} onChange={e => setForm(f => ({ ...f, confidence: parseFloat(e.target.value) }))} style={{ width: "100%" }} />
            </div>
            <div>
              <label style={{ fontSize: 11, color: "var(--t2)", display: "block", marginBottom: 4 }}>TAGS (separados por coma)</label>
              <input className="input-field" placeholder="keyword, conversión, moda" value={form.tags} onChange={e => setForm(f => ({ ...f, tags: e.target.value }))} />
            </div>
          </div>
          <div style={{ display: "flex", gap: 10 }}>
            <button onClick={save} disabled={!form.title || !form.content || saving} className="btn-primary">
              {saving ? "Guardando..." : "Guardar memoria"}
            </button>
            <button onClick={() => setShowAdd(false)} className="btn-secondary">Cancelar</button>
          </div>
        </div>
      )}

      <div style={{ display: "flex", gap: 10, marginBottom: 18, flexWrap: "wrap" }}>
        <div style={{ position: "relative", flex: 1, minWidth: 200 }}>
          <Search size={14} style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: "var(--t3)" }} />
          <input className="input-field" placeholder="Buscar memorias..." value={searchQ} onChange={e => setSearchQ(e.target.value)} style={{ paddingLeft: 32 }} />
        </div>
        <select className="input-field" value={filterNiche} onChange={e => setFilterNiche(e.target.value)} style={{ width: 160 }}>
          <option value="">Todos los nichos</option>
          {NICHES.map(n => <option key={n} value={n}>{n}</option>)}
        </select>
        <select className="input-field" value={filterType} onChange={e => setFilterType(e.target.value)} style={{ width: 180 }}>
          <option value="">Todos los tipos</option>
          {MEMORY_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
        </select>
      </div>

      {loading ? (
        <div style={{ textAlign: "center", padding: "60px 0", color: "var(--t3)" }}>Cargando memorias...</div>
      ) : filtered.length === 0 ? (
        <div style={{ textAlign: "center", padding: "60px 0", color: "var(--t3)" }}>
          <Database size={40} style={{ opacity: 0.3, marginBottom: 12 }} />
          <p>Sin memorias{filterNiche || filterType ? " con estos filtros" : " aún"}.</p>
          <p style={{ fontSize: 12, marginTop: 6 }}>Lanza una sesión de estudio o añade memorias manualmente.</p>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <p style={{ fontSize: 12, color: "var(--t3)", marginBottom: 4 }}>{filtered.length} memorias</p>
          {filtered.map(m => (
            <div key={m.id} className="glass-card" style={{ padding: "14px 16px" }}>
              <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
                <div style={{
                  width: 10, height: 10, borderRadius: "50%", marginTop: 5, flexShrink: 0,
                  background: TYPE_COLORS[m.memoryType] ?? "var(--t3)",
                }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                    <span style={{ fontSize: 13, fontWeight: 700 }}>{m.title}</span>
                    {m.isVerified ? <Star size={12} color="var(--gold)" fill="var(--gold)" /> : null}
                  </div>
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 6 }}>
                    <span style={{ fontSize: 10, padding: "2px 7px", borderRadius: 4, background: `${TYPE_COLORS[m.memoryType]}22`, color: TYPE_COLORS[m.memoryType] }}>{m.memoryType}</span>
                    {m.niche && <span style={{ fontSize: 10, padding: "2px 7px", borderRadius: 4, background: "var(--ink4)", color: "var(--t2)" }}>{m.niche}</span>}
                    <span style={{ fontSize: 10, padding: "2px 7px", borderRadius: 4, background: "var(--ink4)", color: m.confidence >= 0.7 ? "var(--jade)" : "var(--t2)" }}>
                      {Math.round(m.confidence * 100)}% confianza
                    </span>
                  </div>
                  <p
                    style={{ fontSize: 12, color: "var(--t2)", lineHeight: 1.5, cursor: "pointer" }}
                    onClick={() => setExpanded(expanded === m.id ? null : m.id)}
                  >
                    {expanded === m.id ? m.content : m.content.slice(0, 120) + (m.content.length > 120 ? "..." : "")}
                  </p>
                </div>
                <button onClick={() => del(m.id)} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--t3)", padding: 4, flexShrink: 0 }}><Trash2 size={14} /></button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
