import { useState, useEffect } from "react";
import { TrendingUp, Users, DollarSign, BarChart3, Edit3, Check, X, ExternalLink, Plus } from "lucide-react";

const API = import.meta.env.BASE_URL.replace(/\/$/, "");

type ServiceLevel = "none" | "maintenance" | "active" | "premium";
type ClientStatus = "active" | "paused" | "completed";

interface Project {
  id: number;
  name: string;
  shop_domain: string;
  service_level: ServiceLevel;
  service_start_date: string;
  service_monthly_value: number;
  service_notes: string;
  client_contact_name: string;
  client_contact_email: string;
  client_contact_phone: string;
  status?: ClientStatus;
  created_at: string;
}

const SERVICE_LABELS: Record<ServiceLevel, string> = {
  none: "Sin servicio",
  maintenance: "Mantenimiento",
  active: "Gestión Activa",
  premium: "Gestión Premium",
};

const SERVICE_COLORS: Record<ServiceLevel, string> = {
  none: "#555",
  maintenance: "#3b82f6",
  active: "#10b981",
  premium: "#c8a84b",
};

const STATUS_LABELS: Record<ClientStatus, string> = {
  active: "Activo",
  paused: "Pausado",
  completed: "Completado",
};

const STATUS_COLORS: Record<ClientStatus, string> = {
  active: "#10b981",
  paused: "#f59e0b",
  completed: "#6b7280",
};

export default function Revenue() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editData, setEditData] = useState<Partial<Project>>({});
  const [saving, setSaving] = useState(false);
  const [filter, setFilter] = useState<ServiceLevel | "all">("all");

  useEffect(() => { fetchProjects(); }, []);

  async function fetchProjects() {
    try {
      const res = await fetch(`${API}/api/projects`, { credentials: "include" });
      const data = await res.json();
      setProjects(data.projects || data || []);
    } catch { }
    setLoading(false);
  }

  async function saveEdit(id: number) {
    setSaving(true);
    try {
      await fetch(`${API}/api/projects/${id}`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editData),
      });
      setProjects(prev => prev.map(p => p.id === id ? { ...p, ...editData } : p));
      setEditingId(null);
      setEditData({});
    } catch { }
    setSaving(false);
  }

  const filtered = filter === "all" ? projects : projects.filter(p => p.service_level === filter);
  const activeProjects = projects.filter(p => p.service_level !== "none" && (!p.status || p.status === "active"));
  const totalMRR = activeProjects.reduce((sum, p) => sum + (p.service_monthly_value || 0), 0);
  const avgRevenue = activeProjects.length ? totalMRR / activeProjects.length : 0;

  const byLevel: Record<ServiceLevel, number> = { none: 0, maintenance: 0, active: 0, premium: 0 };
  projects.forEach(p => { byLevel[p.service_level || "none"]++; });

  if (loading) return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: 400, color: "var(--t2)" }}>
      Cargando...
    </div>
  );

  return (
    <div className="page-inner">
      <div className="flex-header" style={{ marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, margin: 0 }}>Revenue & CRM</h1>
          <p style={{ color: "var(--t2)", margin: "4px 0 0", fontSize: 13 }}>
            Seguimiento de clientes y servicios mensuales
          </p>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid-r4" style={{ marginBottom: 24 }}>
        {[
          { label: "MRR Total", value: `€${totalMRR.toLocaleString("es", { minimumFractionDigits: 0 })}`, icon: <DollarSign size={20} />, color: "#c8a84b" },
          { label: "Clientes activos", value: activeProjects.length, icon: <Users size={20} />, color: "#10b981" },
          { label: "Ticket medio", value: `€${Math.round(avgRevenue)}`, icon: <TrendingUp size={20} />, color: "#3b82f6" },
          { label: "Total proyectos", value: projects.length, icon: <BarChart3 size={20} />, color: "#a78bfa" },
        ].map((k, i) => (
          <div key={i} style={{
            background: "var(--ink2)", border: "1px solid var(--bdr)",
            borderRadius: 14, padding: "20px 24px",
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
              <span style={{ color: k.color }}>{k.icon}</span>
              <span style={{ fontSize: 12, color: "var(--t2)", fontWeight: 500 }}>{k.label}</span>
            </div>
            <div style={{ fontSize: 28, fontWeight: 700, color: "var(--t1)" }}>{k.value}</div>
          </div>
        ))}
      </div>

      {/* Service breakdown */}
      <div className="grid-r4" style={{ marginBottom: 20 }}>
        {(Object.entries(byLevel) as [ServiceLevel, number][]).map(([level, count]) => (
          <button
            key={level}
            onClick={() => setFilter(filter === level ? "all" : level)}
            style={{
              background: filter === level ? `${SERVICE_COLORS[level]}22` : "var(--ink2)",
              border: `1px solid ${filter === level ? SERVICE_COLORS[level] : "var(--bdr)"}`,
              borderRadius: 10, padding: "12px 16px", cursor: "pointer", textAlign: "left",
              transition: "all 0.2s",
            }}
          >
            <div style={{ fontSize: 11, color: "var(--t2)", marginBottom: 4 }}>{SERVICE_LABELS[level]}</div>
            <div style={{ fontSize: 20, fontWeight: 700, color: SERVICE_COLORS[level] }}>{count}</div>
          </button>
        ))}
      </div>

      {/* Clients table */}
      <div style={{ background: "var(--ink2)", border: "1px solid var(--bdr)", borderRadius: 16, overflow: "hidden" }}>
        <div style={{ padding: "16px 24px", borderBottom: "1px solid var(--bdr)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <span style={{ fontWeight: 600, color: "var(--t1)", fontSize: 15 }}>
            Clientes {filter !== "all" ? `— ${SERVICE_LABELS[filter]}` : ""}
            <span style={{ color: "var(--t3)", fontWeight: 400, marginLeft: 8, fontSize: 13 }}>({filtered.length})</span>
          </span>
        </div>

        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ borderBottom: "1px solid var(--bdr)" }}>
                {["Cliente", "Tienda", "Servicio", "€/mes", "Desde", "Contacto", "Notas", ""].map(h => (
                  <th key={h} style={{ padding: "12px 16px", textAlign: "left", fontSize: 11, fontWeight: 600, color: "var(--t3)", textTransform: "uppercase", letterSpacing: "0.04em", whiteSpace: "nowrap" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={8} style={{ padding: "48px 24px", textAlign: "center", color: "var(--t3)", fontSize: 14 }}>
                    No hay proyectos con este filtro.
                  </td>
                </tr>
              )}
              {filtered.map(p => {
                const isEditing = editingId === p.id;
                const d = isEditing ? { ...p, ...editData } : p;
                return (
                  <tr key={p.id} style={{ borderBottom: "1px solid var(--bdr)", transition: "background 0.15s" }}
                    onMouseEnter={e => (e.currentTarget.style.background = "var(--ink3)")}
                    onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
                  >
                    <td style={{ padding: "14px 16px", minWidth: 140 }}>
                      {isEditing ? (
                        <input value={d.client_contact_name || ""} onChange={e => setEditData(prev => ({ ...prev, client_contact_name: e.target.value }))}
                          style={{ background: "var(--ink)", border: "1px solid var(--bdr2)", borderRadius: 6, padding: "4px 8px", color: "var(--t1)", fontSize: 13, width: "100%" }} />
                      ) : (
                        <div>
                          <div style={{ fontWeight: 600, color: "var(--t1)", fontSize: 14 }}>{p.client_contact_name || p.name}</div>
                          <div style={{ fontSize: 11, color: "var(--t3)" }}>{p.name}</div>
                        </div>
                      )}
                    </td>
                    <td style={{ padding: "14px 16px" }}>
                      <a href={`https://${p.shop_domain}`} target="_blank" rel="noreferrer"
                        style={{ color: "var(--t2)", fontSize: 12, display: "flex", alignItems: "center", gap: 4, textDecoration: "none" }}>
                        {p.shop_domain} <ExternalLink size={10} />
                      </a>
                    </td>
                    <td style={{ padding: "14px 16px", minWidth: 140 }}>
                      {isEditing ? (
                        <select value={d.service_level || "none"} onChange={e => setEditData(prev => ({ ...prev, service_level: e.target.value as ServiceLevel }))}
                          style={{ background: "var(--ink)", border: "1px solid var(--bdr2)", borderRadius: 6, padding: "4px 8px", color: "var(--t1)", fontSize: 13 }}>
                          {Object.entries(SERVICE_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                        </select>
                      ) : (
                        <span style={{ fontSize: 12, padding: "3px 10px", borderRadius: 20, background: `${SERVICE_COLORS[p.service_level || "none"]}22`, color: SERVICE_COLORS[p.service_level || "none"], fontWeight: 600 }}>
                          {SERVICE_LABELS[p.service_level || "none"]}
                        </span>
                      )}
                    </td>
                    <td style={{ padding: "14px 16px", minWidth: 90 }}>
                      {isEditing ? (
                        <input type="number" value={d.service_monthly_value || 0} onChange={e => setEditData(prev => ({ ...prev, service_monthly_value: Number(e.target.value) }))}
                          style={{ background: "var(--ink)", border: "1px solid var(--bdr2)", borderRadius: 6, padding: "4px 8px", color: "var(--t1)", fontSize: 13, width: 80 }} />
                      ) : (
                        <span style={{ fontWeight: 700, color: p.service_monthly_value ? "#c8a84b" : "var(--t3)", fontSize: 15 }}>
                          {p.service_monthly_value ? `€${p.service_monthly_value}` : "—"}
                        </span>
                      )}
                    </td>
                    <td style={{ padding: "14px 16px", minWidth: 100 }}>
                      {isEditing ? (
                        <input type="date" value={d.service_start_date || ""} onChange={e => setEditData(prev => ({ ...prev, service_start_date: e.target.value }))}
                          style={{ background: "var(--ink)", border: "1px solid var(--bdr2)", borderRadius: 6, padding: "4px 8px", color: "var(--t1)", fontSize: 12 }} />
                      ) : (
                        <span style={{ fontSize: 12, color: "var(--t2)" }}>
                          {p.service_start_date ? new Date(p.service_start_date).toLocaleDateString("es") : "—"}
                        </span>
                      )}
                    </td>
                    <td style={{ padding: "14px 16px", minWidth: 160 }}>
                      {isEditing ? (
                        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                          <input placeholder="Email" value={d.client_contact_email || ""} onChange={e => setEditData(prev => ({ ...prev, client_contact_email: e.target.value }))}
                            style={{ background: "var(--ink)", border: "1px solid var(--bdr2)", borderRadius: 6, padding: "3px 7px", color: "var(--t1)", fontSize: 12, width: "100%" }} />
                          <input placeholder="Teléfono" value={d.client_contact_phone || ""} onChange={e => setEditData(prev => ({ ...prev, client_contact_phone: e.target.value }))}
                            style={{ background: "var(--ink)", border: "1px solid var(--bdr2)", borderRadius: 6, padding: "3px 7px", color: "var(--t1)", fontSize: 12, width: "100%" }} />
                        </div>
                      ) : (
                        <div>
                          {p.client_contact_email && <div style={{ fontSize: 11, color: "var(--t2)" }}>{p.client_contact_email}</div>}
                          {p.client_contact_phone && <div style={{ fontSize: 11, color: "var(--t3)" }}>{p.client_contact_phone}</div>}
                          {!p.client_contact_email && !p.client_contact_phone && <span style={{ color: "var(--t3)", fontSize: 12 }}>—</span>}
                        </div>
                      )}
                    </td>
                    <td style={{ padding: "14px 16px", minWidth: 180 }}>
                      {isEditing ? (
                        <input value={d.service_notes || ""} onChange={e => setEditData(prev => ({ ...prev, service_notes: e.target.value }))}
                          placeholder="Notas del servicio..."
                          style={{ background: "var(--ink)", border: "1px solid var(--bdr2)", borderRadius: 6, padding: "4px 8px", color: "var(--t1)", fontSize: 12, width: "100%" }} />
                      ) : (
                        <span style={{ fontSize: 12, color: "var(--t2)" }}>{p.service_notes || "—"}</span>
                      )}
                    </td>
                    <td style={{ padding: "14px 16px" }}>
                      {isEditing ? (
                        <div style={{ display: "flex", gap: 6 }}>
                          <button onClick={() => saveEdit(p.id)} disabled={saving}
                            style={{ background: "#10b981", border: "none", borderRadius: 6, padding: "6px 10px", cursor: "pointer", color: "white", display: "flex", alignItems: "center" }}>
                            <Check size={14} />
                          </button>
                          <button onClick={() => { setEditingId(null); setEditData({}); }}
                            style={{ background: "var(--ink)", border: "1px solid var(--bdr)", borderRadius: 6, padding: "6px 10px", cursor: "pointer", color: "var(--t2)", display: "flex", alignItems: "center" }}>
                            <X size={14} />
                          </button>
                        </div>
                      ) : (
                        <button onClick={() => { setEditingId(p.id); setEditData({}); }}
                          style={{ background: "none", border: "1px solid var(--bdr)", borderRadius: 6, padding: "6px 10px", cursor: "pointer", color: "var(--t3)", display: "flex", alignItems: "center", transition: "all 0.2s" }}
                          onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.borderColor = "var(--gold)"; (e.currentTarget as HTMLButtonElement).style.color = "var(--gold)"; }}
                          onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.borderColor = "var(--bdr)"; (e.currentTarget as HTMLButtonElement).style.color = "var(--t3)"; }}>
                          <Edit3 size={14} />
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <p style={{ fontSize: 12, color: "var(--t3)", marginTop: 20, textAlign: "center" }}>
        La facturación real se gestiona directamente con cada cliente · Este panel es solo de seguimiento
      </p>
    </div>
  );
}
