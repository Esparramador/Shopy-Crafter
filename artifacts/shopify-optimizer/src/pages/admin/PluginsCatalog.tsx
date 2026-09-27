import { useState, useEffect, useCallback } from "react";
import { Puzzle, Play, Search, Copy, Check, Star, Loader2, AlertCircle, X, ChevronRight, Zap, Shield, ToggleLeft, ToggleRight, Settings, RefreshCw, CheckCircle, XCircle } from "lucide-react";

const API_BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

interface Plugin {
  id: string;
  name: string;
  category: string;
  description: string;
  version: string;
  author: string;
  tags: string[];
  pricing: "free" | "freemium" | "paid" | "enterprise";
  rating: number | null;
  installs: number | null;
  capabilities: string[];
  requiredKeys: string[];
  configSchema: Record<string, unknown>;
  isActive: boolean;
  isFeatured: boolean;
  lastUpdated: string;
  documentationUrl?: string;
  actions: string[];
}

const CATEGORY_META: Record<string, { icon: string; color: string; label: string }> = {
  analytics: { icon: "📊", color: "#60a5fa", label: "Analytics" },
  seo: { icon: "🔍", color: "#4ade80", label: "SEO" },
  marketing: { icon: "📣", color: "#fb923c", label: "Marketing" },
  inventory: { icon: "🗄️", color: "#a78bfa", label: "Inventario" },
  customer: { icon: "👥", color: "#34d399", label: "Clientes" },
  shipping: { icon: "🚚", color: "#22d3ee", label: "Envíos" },
  payments: { icon: "💳", color: "#f59e0b", label: "Pagos" },
  reviews: { icon: "⭐", color: "#fbbf24", label: "Reseñas" },
  automation: { icon: "⚡", color: "#f87171", label: "Automatización" },
  social: { icon: "📱", color: "#e879f9", label: "Social" },
  content: { icon: "✍️", color: "#94a3b8", label: "Contenido" },
  design: { icon: "🎨", color: "#f472b6", label: "Diseño" },
  email: { icon: "📧", color: "#34d399", label: "Email" },
  video: { icon: "🎬", color: "#f87171", label: "Video" },
  commerce: { icon: "🛒", color: "#fb923c", label: "Comercio" },
  "3d": { icon: "🧊", color: "#60a5fa", label: "3D" },
  code: { icon: "💻", color: "#4ade80", label: "Código" },
  ai: { icon: "🤖", color: "#8b5cf6", label: "IA" },
  crm: { icon: "🤝", color: "#22d3ee", label: "CRM" },
  integration: { icon: "🔌", color: "#a78bfa", label: "Integración" },
};

const PRICING_META = {
  free: { label: "Gratis", color: "#4ade80" },
  freemium: { label: "Freemium", color: "#fbbf24" },
  paid: { label: "De pago", color: "#fb923c" },
  enterprise: { label: "Enterprise", color: "#a78bfa" },
};

function StarRating({ rating }: { rating: number | null }) {
  // Sin valoraciones reales no se pinta nada (antes eran números aleatorios).
  if (rating === null || !Number.isFinite(rating)) return null;
  return (
    <span style={{ color: "#fbbf24", fontSize: 11 }}>
      {"★".repeat(Math.round(rating))}{"☆".repeat(5 - Math.round(rating))}
      <span style={{ color: "var(--t3)", marginLeft: 4 }}>{rating.toFixed(1)}</span>
    </span>
  );
}

// Mapa en memoria de plugins activos (persiste en sessionStorage)
const STORAGE_KEY = "sc_active_plugins";
function loadActivePlugins(): Record<string, boolean> {
  try { return JSON.parse(sessionStorage.getItem(STORAGE_KEY) || "{}"); } catch { return {}; }
}
function saveActivePlugins(m: Record<string, boolean>) {
  try { sessionStorage.setItem(STORAGE_KEY, JSON.stringify(m)); } catch {}
}

// Estado de salud real de una integración (ping al backend)
type HealthStatus = "unknown" | "checking" | "ok" | "error";

export default function PluginsCatalog() {
  const [plugins, setPlugins] = useState<Plugin[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterCategory, setFilterCategory] = useState("");
  const [filterPricing, setFilterPricing] = useState("");
  const [selected, setSelected] = useState<Plugin | null>(null);
  const [executing, setExecuting] = useState<string | null>(null);
  const [execResults, setExecResults] = useState<Record<string, string>>({});
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [stats, setStats] = useState<{ total: number; categories: Record<string, number> }>({ total: 0, categories: {} });
  const [showFeatured, setShowFeatured] = useState(false);
  // Activación real
  const [activePlugins, setActivePlugins] = useState<Record<string, boolean>>(loadActivePlugins);
  const [healthMap, setHealthMap] = useState<Record<string, HealthStatus>>({});
  const [showConfigId, setShowConfigId] = useState<string | null>(null);
  const [configInputs, setConfigInputs] = useState<Record<string, string>>({});

  useEffect(() => { fetchPlugins(); }, []);

  async function fetchPlugins() {
    try {
      const r = await fetch(`${API_BASE}/api/plugins?limit=300`, { credentials: "include" });
      if (!r.ok) throw new Error("Error cargando plugins");
      const data = await r.json();
      setPlugins(data.plugins || []);
      setStats(data.stats || { total: 0, categories: {} });
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Error desconocido");
    } finally {
      setLoading(false);
    }
  }

  const togglePlugin = useCallback(async (pluginId: string) => {
    const next = !activePlugins[pluginId];
    const updated = { ...activePlugins, [pluginId]: next };
    setActivePlugins(updated);
    saveActivePlugins(updated);

    if (next) {
      // Verificar salud: ejecutar acción ping/health del plugin
      setHealthMap(h => ({ ...h, [pluginId]: "checking" }));
      try {
        const r = await fetch(`${API_BASE}/api/plugins/${pluginId}/execute`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ action: "health_check", config: configInputs }),
        });
        const data = await r.json();
        setHealthMap(h => ({ ...h, [pluginId]: r.ok && !data.error ? "ok" : "error" }));
        if (r.ok && !data.error && data.output) {
          setExecResults(prev => ({ ...prev, [`${pluginId}:health`]: data.output }));
        }
      } catch {
        setHealthMap(h => ({ ...h, [pluginId]: "error" }));
      }
    } else {
      setHealthMap(h => ({ ...h, [pluginId]: "unknown" }));
    }
  }, [activePlugins, configInputs]);

  async function executeAction(pluginId: string, action: string) {
    const key = `${pluginId}:${action}`;
    setExecuting(key);
    try {
      const r = await fetch(`${API_BASE}/api/plugins/${pluginId}/execute`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ action, config: configInputs }),
      });
      const data = await r.json();
      setExecResults(prev => ({ ...prev, [key]: data.output || data.result || data.message || JSON.stringify(data, null, 2) }));
    } catch (e: unknown) {
      setExecResults(prev => ({ ...prev, [key]: `Error: ${e instanceof Error ? e.message : "Desconocido"}` }));
    } finally {
      setExecuting(null);
    }
  }

  function healthIcon(id: string) {
    const s = healthMap[id];
    if (!activePlugins[id]) return null;
    if (s === "checking") return <Loader2 size={11} style={{ animation: "spin 0.6s linear infinite", color: "#fbbf24" }} />;
    if (s === "ok") return <CheckCircle size={11} color="#4ade80" />;
    if (s === "error") return <XCircle size={11} color="#f87171" />;
    return <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#4ade80", display: "inline-block" }} />;
  }

  function copyText(text: string, id: string) {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  }

  const categories = Object.keys(stats.categories).length > 0
    ? Object.keys(stats.categories).filter(c => CATEGORY_META[c])
    : Object.keys(CATEGORY_META);
  const filtered = plugins.filter(p => {
    const q = search.toLowerCase();
    return (
      (!filterCategory || p.category === filterCategory) &&
      (!filterPricing || p.pricing === filterPricing) &&
      (!showFeatured || p.isFeatured) &&
      (!q || p.name.toLowerCase().includes(q) || p.description.toLowerCase().includes(q) || p.tags.some(t => t.includes(q)))
    );
  });

  return (
    <div style={{ padding: "24px", maxWidth: 1400, margin: "0 auto" }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 24 }}>
        <div style={{ width: 44, height: 44, borderRadius: 12, background: "linear-gradient(135deg, #a78bfa, #7c3aed)", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <Puzzle size={22} color="#fff" />
        </div>
        <div>
          <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700, color: "var(--t1)" }}>Catálogo de Plugins</h1>
          <p style={{ margin: 0, fontSize: 13, color: "var(--t3)" }}>{stats.total || plugins.length} plugins de Shopify en {Object.keys(stats.categories).length} categorías</p>
        </div>
      </div>

      {error && (
        <div style={{ background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.3)", borderRadius: 10, padding: "12px 16px", marginBottom: 16, color: "#f87171", display: "flex", gap: 8 }}>
          <AlertCircle size={16} /> {error}
        </div>
      )}

      {/* Category filters */}
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 14 }}>
        <button onClick={() => setFilterCategory("")} style={{ padding: "7px 14px", borderRadius: 20, fontSize: 12, fontWeight: 600, cursor: "pointer", background: !filterCategory ? "var(--gold)" : "var(--s1)", color: !filterCategory ? "#000" : "var(--t2)", border: !filterCategory ? "none" : "1px solid var(--border)" }}>
          🌐 Todos ({plugins.length})
        </button>
        {categories.map(cat => {
          const meta = CATEGORY_META[cat];
          const count = stats.categories[cat] || plugins.filter(p => p.category === cat).length;
          if (!count) return null;
          return (
            <button key={cat} onClick={() => setFilterCategory(cat === filterCategory ? "" : cat)} style={{ padding: "7px 14px", borderRadius: 20, fontSize: 12, fontWeight: 600, cursor: "pointer", background: filterCategory === cat ? meta.color : "var(--s1)", color: filterCategory === cat ? "#000" : "var(--t2)", border: filterCategory === cat ? "none" : "1px solid var(--border)" }}>
              {meta.icon} {meta.label} ({count})
            </button>
          );
        })}
      </div>

      {/* Filters row */}
      <div style={{ display: "flex", gap: 10, marginBottom: 16, flexWrap: "wrap" }}>
        <div style={{ position: "relative", flex: 1, minWidth: 200 }}>
          <Search size={16} style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: "var(--t4)" }} />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar plugin..." style={{ width: "100%", background: "var(--s1)", border: "1px solid var(--border)", borderRadius: 10, padding: "9px 12px 9px 36px", color: "var(--t1)", fontSize: 13, boxSizing: "border-box" }} />
          {search && <button onClick={() => setSearch("")} style={{ position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", color: "var(--t4)" }}><X size={12} /></button>}
        </div>
        <select value={filterPricing} onChange={e => setFilterPricing(e.target.value)} style={{ background: "var(--s1)", border: "1px solid var(--border)", borderRadius: 8, padding: "9px 12px", color: "var(--t1)", fontSize: 13 }}>
          <option value="">Todos los precios</option>
          {Object.entries(PRICING_META).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
        </select>
        <button
          onClick={() => setShowFeatured(!showFeatured)}
          style={{ padding: "9px 14px", borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: "pointer", background: showFeatured ? "#fbbf24" : "var(--s1)", color: showFeatured ? "#000" : "var(--t2)", border: showFeatured ? "none" : "1px solid var(--border)" }}
        >
          ⭐ Destacados
        </button>
        <span style={{ alignSelf: "center", fontSize: 12, color: "var(--t3)" }}>{filtered.length} plugins</span>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: selected ? "1fr 400px" : "1fr", gap: 20 }}>
        {/* Grid */}
        <div>
          {loading ? (
            <div style={{ textAlign: "center", padding: "60px 0" }}>
              <Loader2 size={28} style={{ animation: "spin 0.6s linear infinite", color: "var(--gold)" }} />
              <div style={{ marginTop: 12, color: "var(--t3)" }}>Cargando plugins...</div>
            </div>
          ) : (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(270px, 1fr))", gap: 12 }}>
              {filtered.map(plugin => {
                const catMeta = CATEGORY_META[plugin.category] || { icon: "🔧", color: "var(--gold)", label: plugin.category };
                const priceMeta = PRICING_META[plugin.pricing];
                const isSelected = selected?.id === plugin.id;
                const isActive = !!activePlugins[plugin.id];
                const health = healthMap[plugin.id];
                return (
                  <div
                    key={plugin.id}
                    style={{ background: isActive ? `${catMeta.color}11` : isSelected ? "var(--s2)" : "var(--s1)", border: isActive ? `1.5px solid ${catMeta.color}` : isSelected ? "1.5px solid var(--border)" : "1px solid var(--border)", borderRadius: 12, padding: 14, transition: "all 0.15s", position: "relative", cursor: "pointer" }}
                    onClick={() => setSelected(plugin)}
                  >
                    {/* Toggle Activar */}
                    <button
                      title={isActive ? "Desactivar plugin" : "Activar plugin"}
                      onClick={e => { e.stopPropagation(); togglePlugin(plugin.id); }}
                      style={{ position: "absolute", top: 10, right: 10, background: isActive ? catMeta.color : "var(--s2)", border: "none", borderRadius: 20, padding: "3px 10px", fontSize: 11, fontWeight: 700, cursor: "pointer", color: isActive ? "#000" : "var(--t3)", display: "flex", alignItems: "center", gap: 4 }}
                    >
                      {health === "checking"
                        ? <Loader2 size={10} style={{ animation: "spin 0.6s linear infinite" }} />
                        : isActive ? <ToggleRight size={12} /> : <ToggleLeft size={12} />}
                      {isActive ? "Activo" : "Activar"}
                    </button>
                    {/* Health indicator */}
                    {isActive && health !== "checking" && (
                      <div style={{ position: "absolute", top: 10, right: 74, display: "flex", alignItems: "center" }}>
                        {health === "ok" && <CheckCircle size={12} color="#4ade80" aria-label="Operativo" />}
                        {health === "error" && <XCircle size={12} color="#f87171" aria-label="Error de conexión" />}
                      </div>
                    )}
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                      <div style={{ fontSize: 22 }}>{catMeta.icon}</div>
                      <div>
                        <div style={{ fontWeight: 700, fontSize: 13, color: "var(--t1)" }}>{plugin.name}</div>
                        <div style={{ fontSize: 10, color: "var(--t4)" }}>v{plugin.version} · {plugin.author}</div>
                      </div>
                    </div>
                    <div style={{ fontSize: 12, color: "var(--t3)", marginBottom: 8, lineHeight: 1.5 }}>{plugin.description}</div>
                    <div style={{ display: "flex", gap: 4, marginBottom: 8, flexWrap: "wrap" }}>
                      {plugin.capabilities.slice(0, 2).map(c => (
                        <span key={c} style={{ background: "var(--s2)", borderRadius: 4, padding: "1px 6px", fontSize: 10, color: "var(--t3)" }}>{c}</span>
                      ))}
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 11 }}>
                      <StarRating rating={plugin.rating} />
                      {plugin.rating !== null && <span style={{ color: "var(--t4)" }}>·</span>}
                      <span style={{ color: priceMeta.color, fontWeight: 600 }}>{priceMeta.label}</span>
                      {plugin.installs !== null && <span style={{ marginLeft: "auto", color: "var(--t4)" }}>{plugin.installs.toLocaleString()} installs</span>}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Detail Panel */}
        {selected && (() => {
          const isActive = !!activePlugins[selected.id];
          const health = healthMap[selected.id];
          const catMeta = CATEGORY_META[selected.category] || { icon: "🔧", color: "var(--gold)", label: selected.category };
          return (
          <div style={{ background: "var(--s1)", border: `1px solid ${isActive ? catMeta.color : "var(--border)"}`, borderRadius: 14, overflow: "hidden", alignSelf: "start", position: "sticky", top: 20 }}>
            <div style={{ padding: "16px 18px", borderBottom: "1px solid var(--border)", display: "flex", gap: 10, alignItems: "flex-start" }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 700, fontSize: 15, color: "var(--t1)" }}>{selected.name}</div>
                <div style={{ fontSize: 12, color: "var(--t3)", marginTop: 2 }}>{selected.author} · v{selected.version}</div>
                <div style={{ marginTop: 6, display: "flex", alignItems: "center", gap: 8 }}>
                  <StarRating rating={selected.rating} />
                  {isActive && (
                    <span style={{ fontSize: 10, background: catMeta.color + "22", color: catMeta.color, padding: "2px 8px", borderRadius: 20, fontWeight: 700, display: "flex", alignItems: "center", gap: 4 }}>
                      {health === "checking" ? <Loader2 size={9} style={{ animation: "spin 0.6s linear infinite" }} /> : health === "ok" ? <CheckCircle size={9} /> : health === "error" ? <XCircle size={9} /> : null}
                      {health === "ok" ? "Operativo" : health === "error" ? "Error" : health === "checking" ? "Verificando…" : "Activo"}
                    </span>
                  )}
                </div>
              </div>
              <button onClick={() => setSelected(null)} style={{ background: "var(--s2)", border: "none", borderRadius: 6, padding: 6, cursor: "pointer", color: "var(--t3)" }}><X size={14} /></button>
            </div>
            <div style={{ padding: 18, maxHeight: "70vh", overflowY: "auto" }}>
              <div style={{ fontSize: 13, color: "var(--t2)", marginBottom: 14, lineHeight: 1.6 }}>{selected.description}</div>

              {/* Botón Activar/Desactivar principal */}
              <button
                onClick={() => togglePlugin(selected.id)}
                style={{
                  width: "100%", marginBottom: 14, padding: "10px 16px", borderRadius: 10, fontSize: 13, fontWeight: 700, cursor: "pointer",
                  background: isActive ? "rgba(239,68,68,0.1)" : `linear-gradient(135deg,${catMeta.color},${catMeta.color}cc)`,
                  border: isActive ? "1px solid rgba(239,68,68,0.3)" : "none",
                  color: isActive ? "#f87171" : "#000",
                  display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                }}
              >
                {health === "checking"
                  ? <><Loader2 size={14} style={{ animation: "spin 0.6s linear infinite" }} /> Verificando conexión…</>
                  : isActive
                  ? <><ToggleRight size={16} /> Desactivar plugin</>
                  : <><ToggleLeft size={16} /> Activar plugin</>
                }
              </button>

              {/* Config panel (API keys si tiene) */}
              {selected.requiredKeys.length > 0 && (
                <div style={{ marginBottom: 14 }}>
                  <button
                    onClick={() => setShowConfigId(showConfigId === selected.id ? null : selected.id)}
                    style={{ display: "flex", alignItems: "center", gap: 6, background: "none", border: "none", color: "var(--t3)", fontSize: 11, cursor: "pointer", fontWeight: 700, marginBottom: 6 }}
                  >
                    <Settings size={12} />
                    {showConfigId === selected.id ? "▲ Ocultar configuración" : "⚙️ Configurar credenciales"}
                  </button>
                  {showConfigId === selected.id && (
                    <div style={{ background: "rgba(251,191,36,0.05)", border: "1px solid rgba(251,191,36,0.2)", borderRadius: 8, padding: 12 }}>
                      {selected.requiredKeys.map(k => (
                        <div key={k} style={{ marginBottom: 8 }}>
                          <label style={{ fontSize: 11, color: "var(--t3)", display: "flex", alignItems: "center", gap: 4, marginBottom: 4 }}>
                            <Shield size={10} color="#fbbf24" /> <code style={{ background: "var(--s2)", padding: "1px 6px", borderRadius: 4 }}>{k}</code>
                          </label>
                          <input
                            type="password"
                            placeholder={`Introduce ${k}…`}
                            value={configInputs[k] || ""}
                            onChange={e => setConfigInputs(prev => ({ ...prev, [k]: e.target.value }))}
                            style={{ width: "100%", background: "var(--s2)", border: "1px solid var(--border)", borderRadius: 6, padding: "7px 10px", fontSize: 12, color: "var(--t1)", boxSizing: "border-box" }}
                          />
                        </div>
                      ))}
                      {execResults[`${selected.id}:health`] && (
                        <div style={{ marginTop: 8, fontSize: 11, color: "#4ade80", background: "rgba(74,222,128,0.05)", borderRadius: 6, padding: "6px 10px", border: "1px solid rgba(74,222,128,0.2)" }}>
                          ✅ {execResults[`${selected.id}:health`]}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* Capabilities */}
              <div style={{ marginBottom: 14 }}>
                <div style={{ fontSize: 11, color: "var(--t4)", fontWeight: 700, marginBottom: 8, textTransform: "uppercase", letterSpacing: "0.06em" }}>CAPACIDADES</div>
                {selected.capabilities.map(c => (
                  <div key={c} style={{ display: "flex", gap: 6, marginBottom: 4, fontSize: 12, color: "var(--t2)" }}>
                    <Zap size={12} color="var(--gold)" style={{ flexShrink: 0, marginTop: 1 }} /> {c}
                  </div>
                ))}
              </div>

              {/* Actions — solo si está activo */}
              <div style={{ marginBottom: 14 }}>
                <div style={{ fontSize: 11, color: "var(--t4)", fontWeight: 700, marginBottom: 8, textTransform: "uppercase", letterSpacing: "0.06em" }}>
                  ACCIONES {!isActive && <span style={{ fontWeight: 400, color: "var(--t4)", textTransform: "none" }}>— activa el plugin para ejecutar</span>}
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  {selected.actions.map(action => {
                    const key = `${selected.id}:${action}`;
                    const isRunning = executing === key;
                    const result = execResults[key];
                    return (
                      <div key={action}>
                        <button
                          onClick={() => executeAction(selected.id, action)}
                          disabled={!!executing || !isActive}
                          title={!isActive ? "Activa el plugin primero" : `Ejecutar: ${action}`}
                          style={{ width: "100%", background: isActive ? "var(--s2)" : "var(--s1)", border: "1px solid var(--border)", borderRadius: 8, padding: "8px 12px", fontSize: 12, color: isActive ? "var(--t1)" : "var(--t4)", cursor: isActive ? "pointer" : "not-allowed", display: "flex", alignItems: "center", gap: 6, textAlign: "left", opacity: isActive ? 1 : 0.5 }}
                        >
                          {isRunning ? <Loader2 size={12} style={{ animation: "spin 0.6s linear infinite" }} /> : <Play size={12} color={isActive ? "var(--jade)" : "var(--t4)"} />}
                          {action}
                        </button>
                        {result && (
                          <div style={{ marginTop: 4, background: "rgba(52,211,153,0.05)", border: "1px solid rgba(52,211,153,0.2)", borderRadius: 6, padding: "8px 10px", fontSize: 11, color: "var(--t2)", whiteSpace: "pre-wrap", maxHeight: 200, overflowY: "auto" }}>
                            {result}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Tags */}
              <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                {selected.tags.map(t => (
                  <span key={t} style={{ background: "var(--s2)", borderRadius: 4, padding: "2px 7px", fontSize: 10, color: "var(--t3)" }}>#{t}</span>
                ))}
              </div>
            </div>
          </div>
          );
        })()}
      </div>
    </div>
  );
}
