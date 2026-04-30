import { useState, useEffect, type ReactElement } from "react";
import {
  CheckCircle, AlertTriangle, RefreshCw, Brain, Store, Gauge, Server,
  ChevronDown, ChevronRight, Activity, Cpu, Clock, Database,
} from "lucide-react";

const API_BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

interface CapabilityItem {
  key: string;
  name: string;
  badge: string;
  description: string;
  envVars: string[];
  configured: boolean;
  uses: string[];
}

interface Category {
  id: string;
  name: string;
  icon: string;
  items: CapabilityItem[];
}

interface CapabilitiesResponse {
  generatedAt: string;
  summary: { total: number; configured: number; missing: number; coverage: number };
  categories: Category[];
  envSnapshot: Record<string, "set" | "missing">;
  runtime: { node: string; platform: string; uptimeSeconds: number; memoryMB: number; env: string };
}

const CATEGORY_ICON: Record<string, ReactElement> = {
  brain: <Brain size={16} />,
  store: <Store size={16} />,
  gauge: <Gauge size={16} />,
  server: <Server size={16} />,
};

export default function SystemHealth() {
  const [data, setData] = useState<CapabilitiesResponse | null>(null);
  const [apiOk, setApiOk] = useState<boolean | null>(null);
  const [apiLatency, setApiLatency] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [lastChecked, setLastChecked] = useState<Date | null>(null);
  const [expandedCats, setExpandedCats] = useState<Set<string>>(new Set(["ai", "ecommerce"]));
  const [expandedItem, setExpandedItem] = useState<string | null>(null);

  const checkHealth = async () => {
    setLoading(true);
    try {
      const start = Date.now();
      const healthRes = await fetch(`${API_BASE}/api/healthz`, { credentials: "include" });
      setApiLatency(Date.now() - start);
      setApiOk(healthRes.ok);
    } catch {
      setApiOk(false);
      setApiLatency(null);
    }

    try {
      const res = await fetch(`${API_BASE}/api/admin/system-capabilities`, { credentials: "include" });
      if (res.ok) {
        const json = await res.json();
        setData(json);
      }
    } catch {
      setData(null);
    }

    setLastChecked(new Date());
    setLoading(false);
  };

  useEffect(() => { checkHealth(); }, []);

  const toggleCat = (id: string) => {
    setExpandedCats(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const overall: "ok" | "warning" | "error" = !data
    ? "warning"
    : apiOk === false
      ? "error"
      : data.summary.coverage >= 90
        ? "ok"
        : data.summary.coverage >= 60
          ? "warning"
          : "error";

  const overallColor = overall === "ok" ? "var(--jade)" : overall === "error" ? "var(--crim)" : "var(--gold)";
  const overallLabel = overall === "ok" ? "Operativo" : overall === "error" ? "Degradado" : "Parcial";

  const fmtUptime = (s: number) => {
    const d = Math.floor(s / 86400);
    const h = Math.floor((s % 86400) / 3600);
    const m = Math.floor((s % 3600) / 60);
    if (d > 0) return `${d}d ${h}h`;
    if (h > 0) return `${h}h ${m}m`;
    return `${m}m`;
  };

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24, flexWrap: "wrap", gap: 12 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: "var(--t)" }}>System Health</h1>
          <p style={{ fontSize: 13, color: "var(--t3)", marginTop: 4 }}>
            Estado real de todas las APIs, motores IA, integraciones y servicios
            {lastChecked && ` · Última revisión: ${lastChecked.toLocaleTimeString()}`}
          </p>
        </div>
        <button
          className="btn-secondary"
          onClick={checkHealth}
          disabled={loading}
          style={{ display: "flex", alignItems: "center", gap: 6 }}
        >
          <RefreshCw size={14} style={{ animation: loading ? "spin 0.8s linear infinite" : "none" }} />
          {loading ? "Revisando..." : "Revisar ahora"}
        </button>
      </div>

      <div className="glass-card" style={{
        padding: "16px 20px", marginBottom: 20,
        borderColor: overallColor,
        background: overall === "ok"
          ? "rgba(80,200,120,0.05)"
          : overall === "error"
            ? "rgba(220,53,69,0.05)"
            : "rgba(200,168,75,0.05)",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
          <div style={{
            width: 12, height: 12, borderRadius: "50%",
            background: overallColor,
            boxShadow: `0 0 8px ${overallColor}`,
            animation: overall === "ok" ? "pulse 2s infinite" : "none",
          }} />
          <div style={{ flex: 1, minWidth: 220 }}>
            <p style={{ fontSize: 14, fontWeight: 700, color: "var(--t)" }}>
              Estado del sistema: <span style={{ color: overallColor }}>{overallLabel}</span>
            </p>
            <p style={{ fontSize: 12, color: "var(--t3)" }}>
              {data
                ? `${data.summary.configured} de ${data.summary.total} integraciones operativas (${data.summary.coverage}% cobertura)`
                : "Cargando capacidades..."}
            </p>
          </div>
          {apiLatency !== null && (
            <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: "var(--t3)" }}>
              <Activity size={13} /> API: {apiLatency}ms
            </div>
          )}
        </div>
      </div>

      {/* Resumen runtime */}
      {data && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(180px, 100%), 1fr))", gap: 12, marginBottom: 20 }}>
          <RuntimeCard icon={<Cpu size={14} />} label="Node.js" value={data.runtime.node} />
          <RuntimeCard icon={<Database size={14} />} label="Plataforma" value={data.runtime.platform} />
          <RuntimeCard icon={<Clock size={14} />} label="Uptime" value={fmtUptime(data.runtime.uptimeSeconds)} />
          <RuntimeCard icon={<Activity size={14} />} label="Memoria" value={`${data.runtime.memoryMB} MB`} />
          <RuntimeCard icon={<Server size={14} />} label="Entorno" value={data.runtime.env} />
        </div>
      )}

      {/* Categorías de capacidades */}
      {data?.categories.map(cat => {
        const okCount = cat.items.filter(i => i.configured).length;
        const isExpanded = expandedCats.has(cat.id);
        return (
          <div key={cat.id} className="glass-card" style={{ marginBottom: 14, overflow: "hidden" }}>
            <button
              type="button"
              onClick={() => toggleCat(cat.id)}
              style={{
                width: "100%", padding: "14px 18px", display: "flex", alignItems: "center", gap: 10,
                background: "none", border: "none", cursor: "pointer", color: "var(--t)",
                borderBottom: isExpanded ? "1px solid var(--ink3)" : "none",
              }}
            >
              <div style={{
                width: 32, height: 32, borderRadius: 8,
                background: "rgba(200,168,75,0.08)", border: "1px solid var(--bdr)",
                display: "flex", alignItems: "center", justifyContent: "center",
                color: "var(--gold)", flexShrink: 0,
              }}>
                {CATEGORY_ICON[cat.icon] ?? <Server size={16} />}
              </div>
              <div style={{ flex: 1, textAlign: "left" }}>
                <p style={{ fontSize: 14, fontWeight: 700, color: "var(--t)" }}>{cat.name}</p>
                <p style={{ fontSize: 11, color: "var(--t3)", marginTop: 2 }}>
                  {okCount} de {cat.items.length} activas
                </p>
              </div>
              <span style={{
                fontSize: 11, fontWeight: 700, padding: "3px 10px", borderRadius: 20,
                background: okCount === cat.items.length ? "rgba(80,200,120,0.12)" : "rgba(200,168,75,0.12)",
                color: okCount === cat.items.length ? "var(--jade)" : "var(--gold)",
              }}>
                {Math.round((okCount / cat.items.length) * 100)}%
              </span>
              {isExpanded ? <ChevronDown size={16} style={{ color: "var(--t3)" }} /> : <ChevronRight size={16} style={{ color: "var(--t3)" }} />}
            </button>

            {isExpanded && cat.items.map(item => {
              const itemId = `${cat.id}:${item.key}`;
              const isItemOpen = expandedItem === itemId;
              return (
                <div key={item.key} style={{ borderBottom: "1px solid var(--ink3)" }}>
                  <button
                    type="button"
                    onClick={() => setExpandedItem(isItemOpen ? null : itemId)}
                    style={{
                      width: "100%", padding: "12px 18px 12px 60px",
                      display: "flex", alignItems: "center", gap: 12, justifyContent: "space-between",
                      background: "none", border: "none", cursor: "pointer", color: "var(--t)", textAlign: "left",
                    }}
                  >
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 3, flexWrap: "wrap" }}>
                        <span style={{ fontSize: 13, fontWeight: 600, color: "var(--t)" }}>{item.name}</span>
                        <span style={{
                          fontSize: 10, padding: "1px 7px", borderRadius: 10, fontFamily: "var(--fm)",
                          background: "rgba(255,255,255,0.04)", border: "1px solid var(--bdr)",
                          color: "var(--t3)",
                        }}>
                          {item.badge}
                        </span>
                      </div>
                      <p style={{ fontSize: 11, color: "var(--t3)", lineHeight: 1.4 }}>{item.description}</p>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
                      {item.configured ? (
                        <>
                          <CheckCircle size={14} style={{ color: "var(--jade)" }} />
                          <span style={{ fontSize: 11, fontWeight: 700, color: "var(--jade)" }}>Activa</span>
                        </>
                      ) : (
                        <>
                          <AlertTriangle size={14} style={{ color: "var(--gold)" }} />
                          <span style={{ fontSize: 11, fontWeight: 700, color: "var(--gold)" }}>Sin clave</span>
                        </>
                      )}
                    </div>
                  </button>

                  {isItemOpen && (
                    <div style={{ padding: "0 18px 14px 60px", fontSize: 11, color: "var(--t3)", lineHeight: 1.5 }}>
                      {item.envVars.length > 0 && (
                        <div style={{ marginBottom: 10 }}>
                          <span style={{ color: "var(--t4)", fontWeight: 600, fontSize: 10, textTransform: "uppercase", letterSpacing: 1 }}>Variables de entorno</span>
                          <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 6 }}>
                            {item.envVars.map(ev => (
                              <span key={ev} style={{
                                fontSize: 10, fontFamily: "var(--fm)", padding: "2px 8px", borderRadius: 6,
                                background: "rgba(255,255,255,0.03)", border: "1px solid var(--bdr)",
                                color: data.envSnapshot[ev] === "set" ? "var(--jade)" : "var(--gold)",
                              }}>
                                {ev} {data.envSnapshot[ev] === "set" ? "✓" : "·"}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                      {item.uses.length > 0 && (
                        <div>
                          <span style={{ color: "var(--t4)", fontWeight: 600, fontSize: 10, textTransform: "uppercase", letterSpacing: 1 }}>Usado en</span>
                          <div style={{ display: "flex", flexWrap: "wrap", gap: 5, marginTop: 6 }}>
                            {item.uses.map(u => (
                              <span key={u} style={{
                                fontSize: 10, padding: "2px 8px", borderRadius: 10,
                                background: "rgba(200,168,75,0.06)", border: "1px solid rgba(200,168,75,0.18)",
                                color: "var(--gold)",
                              }}>
                                {u}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        );
      })}

      {/* Snapshot completo de variables de entorno */}
      {data && (
        <div className="glass-card" style={{ padding: 20, marginTop: 8 }}>
          <h3 style={{ fontSize: 14, fontWeight: 600, color: "var(--t)", marginBottom: 12 }}>Variables de Entorno (snapshot)</h3>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(min(280px, 100%), 1fr))", gap: 6 }}>
            {Object.entries(data.envSnapshot).map(([k, v]) => (
              <div key={k} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "4px 0" }}>
                <span style={{ fontSize: 11, fontFamily: "var(--fm)", color: "var(--t2)" }}>{k}</span>
                <span style={{
                  fontSize: 10, padding: "2px 8px", borderRadius: 20, fontWeight: 600,
                  background: v === "set" ? "rgba(80,200,120,0.15)" : "rgba(200,168,75,0.15)",
                  color: v === "set" ? "var(--jade)" : "var(--gold)",
                }}>
                  {v === "set" ? "✓ SET" : "⚠ MISSING"}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function RuntimeCard({ icon, label, value }: { icon: ReactElement; label: string; value: string }) {
  return (
    <div className="glass-card" style={{ padding: "12px 14px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 10, color: "var(--t4)", textTransform: "uppercase", letterSpacing: 1, marginBottom: 4, fontWeight: 600 }}>
        {icon} {label}
      </div>
      <div style={{ fontSize: 13, color: "var(--t)", fontWeight: 600, fontFamily: "var(--fm)" }}>{value}</div>
    </div>
  );
}
