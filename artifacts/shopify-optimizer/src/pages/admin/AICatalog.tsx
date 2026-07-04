import { useState, useEffect, useCallback } from "react";
import {
  TrendingUp, RefreshCw, ChevronLeft, ChevronRight,
  Zap, Activity, Database, Settings, ShieldCheck,
  Search, Filter, Save, AlertCircle, CheckCircle,
  ExternalLink, ArrowRight, BarChart3, Clock,
  Layers, Cpu, DollarSign, Target, Award
} from "lucide-react";

const API_BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

interface Model {
  model_key: string;
  provider: string;
  category: string;
  display_name: string;
  cost_per_unit: number;
  cost_unit: string;
  quality_score: number;
  speed_score: number;
  economy_score: number;
  best_for: string[];
  capabilities: string[];
  is_active: boolean;
}

interface RoutingRule {
  task_type: string;
  budget: string;
  model_key: string;
  fallback_model: string | null;
  priority: number;
}

interface Stats {
  totalModels: number;
  activeModels: number;
  providers: number;
  routingRules: number;
  lastUpdate: string | null;
}

interface Update {
  id: number;
  discovered_at: string;
  provider: string;
  model_key: string;
  change_type: string;
  notes: string | null;
}

interface TaskInfo {
  id: string;
  label: string;
}

function Card({ children, style, className = "" }: { children: React.ReactNode; style?: React.CSSProperties; className?: string }) {
  return (
    <div className={className} style={{
      background: "var(--ink2,#1a1a2e)",
      border: "1px solid var(--border,rgba(255,255,255,0.08))",
      borderRadius: 12, padding: "20px 24px", ...style,
    }}>
      {children}
    </div>
  );
}

function Badge({ children, color = "var(--gold)" }: { children: React.ReactNode; color?: string }) {
  return (
    <span style={{
      padding: "2px 8px",
      borderRadius: 4,
      fontSize: 10,
      fontWeight: 700,
      textTransform: "uppercase",
      letterSpacing: "0.05em",
      background: `${color}20`,
      color: color,
      border: `1px solid ${color}40`,
      display: "inline-flex",
      alignItems: "center",
      gap: 4
    }}>
      {children}
    </span>
  );
}

export default function AICatalog() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [models, setModels] = useState<Model[]>([]);
  const [rules, setRules] = useState<RoutingRule[]>([]);
  const [updates, setUpdates] = useState<Update[]>([]);
  const [tasks, setTasks] = useState<TaskInfo[]>([]);
  const [budgets, setBudgets] = useState<Array<{id: string, label: string}>>([]);
  
  const [loading, setLoading] = useState(true);
  const [researching, setResearching] = useState(false);
  const [toast, setToast] = useState<{ type: "ok" | "err"; msg: string } | null>(null);
  
  const [search, setSearch] = useState("");
  const [filterProvider, setFilterProvider] = useState("all");
  const [filterCategory, setFilterCategory] = useState("all");

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [sRes, mRes, tRes, uRes] = await Promise.all([
        fetch(`${API_BASE}/api/ai-catalog/stats`, { credentials: "include" }),
        fetch(`${API_BASE}/api/ai-catalog/models`, { credentials: "include" }),
        fetch(`${API_BASE}/api/ai-catalog/tasks`, { credentials: "include" }),
        fetch(`${API_BASE}/api/ai-catalog/updates?limit=10`, { credentials: "include" })
      ]);

      if (sRes.ok) setStats(await sRes.json());
      if (mRes.ok) {
        const data = await mRes.json();
        setModels(data.models || []);
      }
      if (tRes.ok) {
        const data = await tRes.json();
        setTasks(data.tasks || []);
        setBudgets(data.budgets || []);
      }
      if (uRes.ok) {
        const data = await uRes.json();
        setUpdates(data.updates || []);
      }
      
      // Load routing rules for each task and budget
      // This is a bit inefficient but the API seems designed for single rules
      // In a real scenario we'd want a get-all-rules endpoint
    } catch (err) {
      console.error("Error loading AI Catalog data:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleResearch = async () => {
    setResearching(true);
    setToast(null);
    try {
      const res = await fetch(`${API_BASE}/api/ai-catalog/research-sync`, {
        method: "POST",
        credentials: "include"
      });
      const data = await res.json();
      if (res.ok) {
        setToast({ type: "ok", msg: "✅ Investigación completada con éxito" });
        loadData();
      } else {
        throw new Error(data.error || "Error en la investigación");
      }
    } catch (err) {
      setToast({ type: "err", msg: `❌ Error: ${err instanceof Error ? err.message : String(err)}` });
    } finally {
      setResearching(false);
    }
  };

  const filteredModels = models.filter(m => {
    const matchesSearch = !search || 
      m.display_name.toLowerCase().includes(search.toLowerCase()) || 
      m.model_key.toLowerCase().includes(search.toLowerCase());
    const matchesProvider = filterProvider === "all" || m.provider === filterProvider;
    const matchesCategory = filterCategory === "all" || m.category === filterCategory;
    return matchesSearch && matchesProvider && matchesCategory;
  });

  const providers = Array.from(new Set(models.map(m => m.provider)));
  const categories = Array.from(new Set(models.map(m => m.category)));

  return (
    <div style={{ padding: "24px 28px", minHeight: "100vh", background: "var(--ink,#0f0f1a)" }}>
      {/* Toast */}
      {toast && (
        <div style={{
          position: "fixed", top: 20, right: 24, zIndex: 9999,
          display: "flex", alignItems: "center", gap: 10,
          background: toast.type === "ok" ? "rgba(45,212,159,0.12)" : "rgba(239,68,68,0.12)",
          border: `1px solid ${toast.type === "ok" ? "rgba(45,212,159,0.35)" : "rgba(239,68,68,0.35)"}`,
          borderRadius: 10, padding: "12px 18px", maxWidth: 460,
          boxShadow: "0 4px 24px rgba(0,0,0,0.4)",
          color: toast.type === "ok" ? "#2dd49f" : "#ef4444",
          fontSize: 13, fontWeight: 500,
        }}>
          {toast.type === "ok" ? <CheckCircle size={16} /> : <AlertCircle size={16} />}
          {toast.msg}
          <button onClick={() => setToast(null)} style={{ marginLeft: 8, background: "none", border: "none", cursor: "pointer", color: "inherit" }}>×</button>
        </div>
      )}

      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 28 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700, color: "var(--t,#fff)" }}>
            🧠 AI Model Intelligence System
          </h1>
          <p style={{ margin: "4px 0 0", fontSize: 13, color: "var(--t3,#666)" }}>
            Catálogo dinámico, routing inteligente e investigación automática de modelos
          </p>
        </div>
        <div style={{ display: "flex", gap: 12 }}>
          <button
            onClick={handleResearch}
            disabled={researching}
            style={{
              display: "flex", alignItems: "center", gap: 8,
              background: researching ? "rgba(245,158,11,0.1)" : "var(--gold, #f59e0b)",
              color: researching ? "var(--gold)" : "#000",
              border: researching ? "1px solid var(--gold)" : "none",
              borderRadius: 8, padding: "8px 16px",
              cursor: researching ? "not-allowed" : "pointer",
              fontSize: 13, fontWeight: 600,
              transition: "all 0.2s"
            }}
          >
            <RefreshCw size={16} className={researching ? "animate-spin" : ""} />
            {researching ? "Investigando..." : "Investigar ahora"}
          </button>
          <button
            onClick={loadData}
            style={{
              background: "rgba(255,255,255,0.05)",
              border: "1px solid rgba(255,255,255,0.1)",
              borderRadius: 8, padding: "8px", color: "var(--t2)"
            }}
          >
            <RefreshCw size={18} />
          </button>
        </div>
      </div>

      {/* Stats Grid */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 16, marginBottom: 24 }}>
        <Card style={{ padding: "16px 20px" }}>
          <div style={{ color: "var(--t3)", fontSize: 11, fontWeight: 600, textTransform: "uppercase", marginBottom: 8 }}>Total Modelos</div>
          <div style={{ fontSize: 24, fontWeight: 700, color: "var(--t)" }}>{stats?.totalModels || 0}</div>
          <div style={{ fontSize: 11, color: "#10b981", marginTop: 4 }}>{stats?.activeModels || 0} activos</div>
        </Card>
        <Card style={{ padding: "16px 20px" }}>
          <div style={{ color: "var(--t3)", fontSize: 11, fontWeight: 600, textTransform: "uppercase", marginBottom: 8 }}>Proveedores</div>
          <div style={{ fontSize: 24, fontWeight: 700, color: "var(--t)" }}>{stats?.providers || 0}</div>
          <div style={{ fontSize: 11, color: "var(--t3)", marginTop: 4 }}>Integrados en AMIS</div>
        </Card>
        <Card style={{ padding: "16px 20px" }}>
          <div style={{ color: "var(--t3)", fontSize: 11, fontWeight: 600, textTransform: "uppercase", marginBottom: 8 }}>Reglas de Routing</div>
          <div style={{ fontSize: 24, fontWeight: 700, color: "var(--t)" }}>{stats?.routingRules || 0}</div>
          <div style={{ fontSize: 11, color: "var(--t3)", marginTop: 4 }}>Decisiones inteligentes</div>
        </Card>
        <Card style={{ padding: "16px 20px" }}>
          <div style={{ color: "var(--t3)", fontSize: 11, fontWeight: 600, textTransform: "uppercase", marginBottom: 8 }}>Última Investigación</div>
          <div style={{ fontSize: 16, fontWeight: 700, color: "var(--t)", marginTop: 8 }}>
            {stats?.lastUpdate ? new Date(stats.lastUpdate).toLocaleString() : "Nunca"}
          </div>
          <div style={{ fontSize: 11, color: "var(--t3)", marginTop: 4 }}>Sync automático activo</div>
        </Card>
      </div>

      {/* Main Content Tabs (Simulated) */}
      <div style={{ display: "flex", gap: 24, marginBottom: 24 }}>
        <div style={{ flex: 1 }}>
          {/* Models Table */}
          <Card style={{ padding: 0, overflow: "hidden" }}>
            <div style={{ padding: "16px 24px", borderBottom: "1px solid rgba(255,255,255,0.05)", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 12, flex: 1 }}>
                <div style={{ position: "relative", flex: 1, maxWidth: 300 }}>
                  <Search size={14} style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: "var(--t3)" }} />
                  <input
                    type="text"
                    placeholder="Buscar modelo..."
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    style={{
                      width: "100%", background: "rgba(0,0,0,0.2)", border: "1px solid rgba(255,255,255,0.1)",
                      borderRadius: 6, padding: "6px 12px 6px 32px", color: "#fff", fontSize: 13
                    }}
                  />
                </div>
                <select
                  value={filterProvider}
                  onChange={e => setFilterProvider(e.target.value)}
                  style={{ background: "rgba(0,0,0,0.2)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 6, padding: "6px 12px", color: "#fff", fontSize: 13 }}
                >
                  <option value="all">Todos los proveedores</option>
                  {providers.map(p => <option key={p} value={p}>{p}</option>)}
                </select>
                <select
                  value={filterCategory}
                  onChange={e => setFilterCategory(e.target.value)}
                  style={{ background: "rgba(0,0,0,0.2)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 6, padding: "6px 12px", color: "#fff", fontSize: 13 }}
                >
                  <option value="all">Todas las categorías</option>
                  {categories.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div style={{ color: "var(--t3)", fontSize: 12 }}>{filteredModels.length} modelos</div>
            </div>

            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                <thead>
                  <tr style={{ textAlign: "left", background: "rgba(255,255,255,0.02)", color: "var(--t3)" }}>
                    <th style={{ padding: "12px 24px", fontWeight: 600 }}>Modelo</th>
                    <th style={{ padding: "12px 24px", fontWeight: 600 }}>Proveedor</th>
                    <th style={{ padding: "12px 24px", fontWeight: 600 }}>Categoría</th>
                    <th style={{ padding: "12px 24px", fontWeight: 600 }}>Scores (Q/S/E)</th>
                    <th style={{ padding: "12px 24px", fontWeight: 600 }}>Coste</th>
                    <th style={{ padding: "12px 24px", fontWeight: 600 }}>Capabilidades</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredModels.map(m => (
                    <tr key={m.model_key} style={{ borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
                      <td style={{ padding: "12px 24px" }}>
                        <div style={{ fontWeight: 600, color: "var(--t)" }}>{m.display_name}</div>
                        <div style={{ fontSize: 11, color: "var(--t3)", fontFamily: "monospace" }}>{m.model_key}</div>
                      </td>
                      <td style={{ padding: "12px 24px" }}>
                        <Badge color={m.provider === "freepik" ? "#3b82f6" : m.provider === "replicate" ? "#7c3aed" : "var(--gold)"}>
                          {m.provider}
                        </Badge>
                      </td>
                      <td style={{ padding: "12px 24px" }}>
                        <span style={{ color: "var(--t2)" }}>{m.category}</span>
                      </td>
                      <td style={{ padding: "12px 24px" }}>
                        <div style={{ display: "flex", gap: 4 }}>
                          <span title="Quality" style={{ color: m.quality_score >= 8 ? "#10b981" : "#f59e0b" }}>{m.quality_score}</span>
                          <span style={{ color: "rgba(255,255,255,0.2)" }}>/</span>
                          <span title="Speed" style={{ color: m.speed_score >= 8 ? "#10b981" : "#f59e0b" }}>{m.speed_score}</span>
                          <span style={{ color: "rgba(255,255,255,0.2)" }}>/</span>
                          <span title="Economy" style={{ color: m.economy_score >= 8 ? "#10b981" : "#f59e0b" }}>{m.economy_score}</span>
                        </div>
                      </td>
                      <td style={{ padding: "12px 24px" }}>
                        <div style={{ color: "#10b981", fontWeight: 600 }}>${m.cost_per_unit}</div>
                        <div style={{ fontSize: 10, color: "var(--t3)" }}>{m.cost_unit.replace("_", " ")}</div>
                      </td>
                      <td style={{ padding: "12px 24px" }}>
                        <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                          {m.capabilities.slice(0, 3).map(cap => (
                            <span key={cap} style={{ fontSize: 10, background: "rgba(255,255,255,0.05)", padding: "1px 6px", borderRadius: 4, color: "var(--t3)" }}>
                              {cap}
                            </span>
                          ))}
                          {m.capabilities.length > 3 && <span style={{ fontSize: 10, color: "var(--t4)" }}>+{m.capabilities.length - 3}</span>}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </div>

        <div style={{ width: 340, display: "flex", flexDirection: "column", gap: 24 }}>
          {/* Recent Updates */}
          <Card style={{ flex: 1 }}>
            <div style={{ fontWeight: 600, color: "var(--t)", marginBottom: 16, display: "flex", alignItems: "center", gap: 8 }}>
              <Clock size={16} style={{ color: "var(--gold)" }} />
              Actualizaciones Recientes
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {updates.length === 0 ? (
                <div style={{ color: "var(--t3)", fontSize: 12, textAlign: "center", padding: "20px 0" }}>No hay actualizaciones recientes</div>
              ) : (
                updates.map(u => (
                  <div key={u.id} style={{ paddingBottom: 12, borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                      <Badge color="#10b981">{u.change_type}</Badge>
                      <span style={{ fontSize: 10, color: "var(--t4)" }}>{new Date(u.discovered_at).toLocaleDateString()}</span>
                    </div>
                    <div style={{ fontSize: 13, color: "var(--t)", fontWeight: 500 }}>{u.model_key}</div>
                    <div style={{ fontSize: 11, color: "var(--t3)", marginTop: 2 }}>{u.notes || "Descubierto automáticamente"}</div>
                  </div>
                ))
              )}
            </div>
            {updates.length > 0 && (
              <button style={{ width: "100%", marginTop: 12, padding: "8px", background: "none", border: "1px dashed rgba(255,255,255,0.1)", borderRadius: 6, color: "var(--t3)", fontSize: 11 }}>
                Ver historial completo
              </button>
            )}
          </Card>

          {/* Quick Routing Test */}
          <Card>
            <div style={{ fontWeight: 600, color: "var(--t)", marginBottom: 16, display: "flex", alignItems: "center", gap: 8 }}>
              <ShieldCheck size={16} style={{ color: "#3b82f6" }} />
              Routing Smart Test
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <div>
                <label style={{ fontSize: 11, color: "var(--t3)", marginBottom: 4, display: "block" }}>Tarea</label>
                <select style={{ width: "100%", background: "rgba(0,0,0,0.2)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 6, padding: "8px", color: "#fff", fontSize: 13 }}>
                  {tasks.map(t => <option key={t.id} value={t.id}>{t.label}</option>)}
                </select>
              </div>
              <div>
                <label style={{ fontSize: 11, color: "var(--t3)", marginBottom: 4, display: "block" }}>Budget</label>
                <div style={{ display: "flex", gap: 4 }}>
                  {budgets.map(b => (
                    <button key={b.id} style={{ flex: 1, padding: "6px", fontSize: 11, borderRadius: 4, background: b.id === "balanced" ? "rgba(245,158,11,0.2)" : "rgba(255,255,255,0.05)", border: `1px solid ${b.id === "balanced" ? "var(--gold)" : "rgba(255,255,255,0.1)"}`, color: b.id === "balanced" ? "var(--gold)" : "var(--t3)" }}>
                      {b.label.split(" ")[0]}
                    </button>
                  ))}
                </div>
              </div>
              <button style={{ marginTop: 8, padding: "10px", background: "rgba(59,130,246,0.1)", border: "1px solid #3b82f6", borderRadius: 8, color: "#3b82f6", fontSize: 13, fontWeight: 600 }}>
                Calcular Ruta Óptima
              </button>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
