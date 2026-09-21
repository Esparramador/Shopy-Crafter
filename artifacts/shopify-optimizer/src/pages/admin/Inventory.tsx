import { useState, useEffect, ReactNode } from "react";
import { Package, AlertTriangle, CheckCircle, RefreshCw, Mail, Download } from "lucide-react";
import { useListProjects } from "@workspace/api-client-react";
import { ModalOverlay } from "@/components/ModalOverlay";

const API_BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

const STATUS_CONFIG: Record<string, { color: string; icon: ReactNode; label: string }> = {
  critical: { color: "var(--crim)", icon: <AlertTriangle size={12} />, label: "Crítico" },
  warning: { color: "var(--gold)", icon: <AlertTriangle size={12} />, label: "Alerta" },
  healthy: { color: "var(--jade)", icon: <CheckCircle size={12} />, label: "OK" },
};

export default function Inventory() {
  const { data: projects } = useListProjects();
  const [selectedProject, setSelectedProject] = useState<string>("");
  const [inventory, setInventory] = useState<any[]>([]);
  const [_orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [emailLoading, setEmailLoading] = useState<string | null>(null);
  const [emailModal, setEmailModal] = useState<any>(null);

  useEffect(() => {
    if (!selectedProject && projects && projects.length > 0) setSelectedProject(String(projects[0].id));
  }, [projects]);

  useEffect(() => {
    if (selectedProject) loadData();
  }, [selectedProject]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [invRes, ordRes] = await Promise.all([
        fetch(`${API_BASE}/api/inventory/tracking?projectId=${selectedProject}`, { credentials: "include" }),
        fetch(`${API_BASE}/api/inventory/restock-orders?projectId=${selectedProject}`, { credentials: "include" }),
      ]);
      setInventory(await invRes.json());
      setOrders(await ordRes.json());
    } finally {
      setLoading(false);
    }
  };

  const generateEmail = async (item: any) => {
    setEmailLoading(item.id);
    try {
      const res = await fetch(`${API_BASE}/api/inventory/restock-email`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          projectId: selectedProject,
          productId: item.productId,
          productTitle: item.productTitle,
          currentStock: item.currentStock,
          daysRemaining: item.daysRemaining,
          supplierEmail: item.supplierEmail,
        }),
      });
      const data = await res.json();
      setEmailModal(data);
    } finally {
      setEmailLoading(null);
    }
  };

  const exportCSV = () => {
    const rows = [["Producto", "Stock Actual", "Días Restantes", "Ventas/Día", "Estado"]];
    inventory.forEach(i => rows.push([
      i.productTitle || i.productId,
      i.currentStock, i.daysRemaining, i.avgDailySales?.toFixed(1) || "0",
      i.status,
    ]));
    const csv = rows.map(r => r.join(",")).join("\n");
    const a = document.createElement("a");
    a.href = "data:text/csv;charset=utf-8," + encodeURIComponent(csv);
    a.download = "inventory-restock.csv";
    a.click();
  };

  const critical = inventory.filter(i => i.status === "critical");
  const warning = inventory.filter(i => i.status === "warning");
  const healthy = inventory.filter(i => i.status === "healthy");

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24, flexWrap: "wrap", gap: 12 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: "var(--t)" }}>M7 Intelligent Inventory Engine</h1>
          <p style={{ fontSize: 13, color: "var(--t3)", marginTop: 4 }}>Control de stock predictivo con alertas automáticas</p>
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <select value={selectedProject} onChange={e => setSelectedProject(e.target.value)} className="input-field" style={{ width: "min(180px, 100%)" }}>
            {projects?.map((p: any) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
          <button className="btn-secondary" onClick={exportCSV} style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <Download size={14} /> CSV
          </button>
          <button className="btn-secondary" onClick={loadData} style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <RefreshCw size={14} /> Actualizar
          </button>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(200px, 100%), 1fr))", gap: 16, marginBottom: 24 }}>
        {[
          { label: "Total Productos", value: inventory.length, icon: "📦", color: "var(--t)" },
          { label: "Stock Crítico", value: critical.length, icon: "🚨", color: "var(--crim)" },
          { label: "Alerta", value: warning.length, icon: "⚠️", color: "var(--gold)" },
          { label: "Stock OK", value: healthy.length, icon: "✅", color: "var(--jade)" },
        ].map(stat => (
          <div key={stat.label} className="glass-card" style={{ padding: "20px 24px" }}>
            <div style={{ fontSize: 22 }}>{stat.icon}</div>
            <div style={{ fontSize: 28, fontWeight: 700, color: stat.color, marginTop: 8 }}>{stat.value}</div>
            <div style={{ fontSize: 11, color: "var(--t3)", marginTop: 4 }}>{stat.label}</div>
          </div>
        ))}
      </div>

      {loading ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {[1,2,3].map(i => <div key={i} className="skeleton" style={{ height: 60, borderRadius: 10 }} />)}
        </div>
      ) : inventory.length === 0 ? (
        <div className="glass-card" style={{ padding: 48, textAlign: "center" }}>
          <Package size={40} style={{ color: "var(--t4)", marginBottom: 12 }} />
          <h3 style={{ fontSize: 16, color: "var(--t2)", marginBottom: 8 }}>Sin datos de inventario</h3>
          <p style={{ fontSize: 13, color: "var(--t3)" }}>Conecta tu tienda Shopify para empezar a monitorear el stock.</p>
        </div>
      ) : (
        <div className="glass-card">
          <div style={{ padding: "16px 20px", borderBottom: "1px solid var(--ink3)" }}>
            <h3 style={{ fontSize: 14, fontWeight: 600, color: "var(--t)" }}>Inventario Detallado</h3>
          </div>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ borderBottom: "1px solid var(--ink3)" }}>
                  {["Producto", "Stock", "Días Restantes", "Ventas/Día", "Estado", "Acción"].map(h => (
                    <th key={h} style={{ padding: "10px 16px", textAlign: "left", fontSize: 11, fontWeight: 600, color: "var(--t3)", textTransform: "uppercase", letterSpacing: 0.5 }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {inventory.map(item => {
                  const cfg = STATUS_CONFIG[item.status] ?? STATUS_CONFIG.healthy;
                  return (
                    <tr key={item.id} style={{ borderBottom: "1px solid var(--ink3)" }}>
                      <td style={{ padding: "12px 16px", fontSize: 13, color: "var(--t)" }}>{item.productTitle || item.productId}</td>
                      <td style={{ padding: "12px 16px", fontSize: 13, fontWeight: 600, color: "var(--t)" }}>{item.currentStock ?? "—"}</td>
                      <td style={{ padding: "12px 16px" }}>
                        <span style={{ fontSize: 13, fontWeight: 700, color: cfg.color }}>
                          {item.daysRemaining === 999 ? "∞" : `${item.daysRemaining}d`}
                        </span>
                      </td>
                      <td style={{ padding: "12px 16px", fontSize: 13, color: "var(--t2)" }}>{item.avgDailySales?.toFixed(1) ?? "—"}</td>
                      <td style={{ padding: "12px 16px" }}>
                        <span style={{
                          display: "inline-flex", alignItems: "center", gap: 4,
                          padding: "3px 8px", borderRadius: 20, fontSize: 11, fontWeight: 600,
                          background: `${cfg.color}22`, color: cfg.color,
                        }}>
                          {cfg.icon} {cfg.label}
                        </span>
                      </td>
                      <td style={{ padding: "12px 16px" }}>
                        {item.status !== "healthy" && (
                          <button
                            className="btn-secondary"
                            onClick={() => generateEmail(item)}
                            disabled={emailLoading === item.id}
                            style={{ fontSize: 11, padding: "4px 10px", display: "inline-flex", alignItems: "center", gap: 4 }}
                          >
                            <Mail size={11} />
                            {emailLoading === item.id ? "Generando..." : "Email Proveedor"}
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
      )}

      {emailModal && (
        <ModalOverlay onClick={() => setEmailModal(null)}>
          <div style={{ background: "var(--ink2)", borderRadius: 16, padding: 28, maxWidth: 560, width: "90%", maxHeight: "80vh", overflowY: "auto" }}
            onClick={e => e.stopPropagation()}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 16 }}>
              <h3 style={{ fontSize: 16, fontWeight: 700, color: "var(--t)" }}>Email de Restock Generado</h3>
              <button onClick={() => setEmailModal(null)} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--t3)", fontSize: 18 }}>×</button>
            </div>
            <div style={{ marginBottom: 12 }}>
              <p style={{ fontSize: 11, color: "var(--t3)", marginBottom: 4 }}>ASUNTO</p>
              <p style={{ fontSize: 13, fontWeight: 600, color: "var(--t)", padding: "8px 12px", background: "var(--ink3)", borderRadius: 8 }}>{emailModal.subject}</p>
            </div>
            <div style={{ marginBottom: 16 }}>
              <p style={{ fontSize: 11, color: "var(--t3)", marginBottom: 4 }}>CUERPO</p>
              <pre style={{ fontSize: 12, color: "var(--t2)", padding: "12px", background: "var(--ink3)", borderRadius: 8, whiteSpace: "pre-wrap", lineHeight: 1.6 }}>{emailModal.body}</pre>
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <span style={{
                padding: "4px 10px", borderRadius: 20, fontSize: 11, fontWeight: 600,
                background: emailModal.urgency === "critical" ? "rgba(220,53,69,0.15)" : "rgba(200,168,75,0.15)",
                color: emailModal.urgency === "critical" ? "var(--crim)" : "var(--gold)",
              }}>{emailModal.urgency?.toUpperCase()}</span>
              <span style={{ padding: "4px 10px", borderRadius: 20, fontSize: 11, background: "var(--ink3)", color: "var(--t2)" }}>
                Sugerido: {emailModal.suggestedQuantity} unidades
              </span>
            </div>
          </div>
        </ModalOverlay>
      )}
    </div>
  );
}
