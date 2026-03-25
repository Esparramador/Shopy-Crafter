import { useState, useEffect, useCallback } from "react";
import {
  Zap, RefreshCw, Package, ShoppingCart, Key, Shield, Plus, Search,
  Trash2, CheckCircle, AlertTriangle, Loader2, Eye, DollarSign, Send
} from "lucide-react";

const API = import.meta.env.BASE_URL.replace(/\/$/, "");

interface ActionResult {
  success?: boolean;
  error?: string;
  message?: string;
  [key: string]: unknown;
}

interface Project {
  id: number;
  name: string;
  shopDomain: string;
}

export default function CommandCenter() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedProject, setSelectedProject] = useState<number | null>(null);
  const [loading, setLoading] = useState<string | null>(null);
  const [results, setResults] = useState<Record<string, ActionResult>>({});
  const [createTitle, setCreateTitle] = useState("");
  const [createPrice, setCreatePrice] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [customCommand, setCustomCommand] = useState("");

  useEffect(() => {
    fetch(`${API}/api/projects`, { credentials: "include" })
      .then(r => r.json())
      .then(data => {
        const list = Array.isArray(data) ? data : data.projects ?? [];
        setProjects(list);
        if (list.length > 0) setSelectedProject(list[0].id);
      })
      .catch(() => {});
  }, []);

  const executeAction = useCallback(async (action: string, params: Record<string, unknown> = {}) => {
    if (!selectedProject && action !== "custom") return;
    setLoading(action);
    setResults(r => ({ ...r, [action]: {} }));
    try {
      if (action === "custom") {
        const res = await fetch(`${API}/api/shopybrain/search`, {
          method: "POST", credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            query: customCommand, returnRaw: true, activeProjectId: selectedProject,
          }),
        });
        const data = await res.json();
        let result: ActionResult = { success: true, message: data.answer };
        if (data.detectedAction) {
          const actionRes = await fetch(`${API}/api/shopybrain/execute-action`, {
            method: "POST", credentials: "include",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ action: data.detectedAction.action, params: data.detectedAction.params }),
          });
          const actionData = await actionRes.json();
          result = { ...result, ...actionData, message: (data.answer || "") + "\n\n" + (actionData.message || "") };
        }
        setResults(r => ({ ...r, custom: result }));
      } else {
        const res = await fetch(`${API}/api/shopybrain/execute-action`, {
          method: "POST", credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action, params: { projectId: selectedProject, ...params } }),
        });
        const data = await res.json();
        setResults(r => ({ ...r, [action]: data }));
      }
    } catch (e) {
      setResults(r => ({ ...r, [action]: { error: `Error: ${e instanceof Error ? e.message : "Desconocido"}` } }));
    } finally {
      setLoading(null);
    }
  }, [selectedProject, customCommand]);

  const ResultCard = ({ actionKey, label }: { actionKey: string; label: string }) => {
    const r = results[actionKey];
    if (!r || (!r.message && !r.error)) return null;
    return (
      <div style={{
        background: r.error ? "rgba(220,53,69,0.1)" : "rgba(0,200,150,0.08)",
        border: `1px solid ${r.error ? "rgba(220,53,69,0.3)" : "rgba(0,200,150,0.2)"}`,
        borderRadius: 10, padding: "12px 16px", marginTop: 10,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
          {r.error ? <AlertTriangle size={13} style={{ color: "var(--crim)" }} /> : <CheckCircle size={13} style={{ color: "var(--jade)" }} />}
          <span style={{ fontSize: 11, fontWeight: 700, color: r.error ? "var(--crim)" : "var(--jade)", textTransform: "uppercase" }}>{label}</span>
        </div>
        <pre style={{
          fontSize: 12, color: "var(--t2)", lineHeight: 1.5, margin: 0,
          whiteSpace: "pre-wrap", wordBreak: "break-word", fontFamily: "inherit",
        }}>
          {r.error || r.message || JSON.stringify(r, null, 2)}
        </pre>
        {(r as ActionResult & { products?: Array<{ title: string; id: number; price: string; status: string }> }).products && (
          <div style={{ marginTop: 8 }}>
            {((r as ActionResult & { products: Array<{ title: string; id: number; price: string; status: string }> }).products).map((p, i) => (
              <div key={i} style={{
                display: "flex", justifyContent: "space-between", alignItems: "center",
                padding: "6px 0", borderTop: i > 0 ? "1px solid var(--bdr)" : "none",
                fontSize: 12, color: "var(--t)",
              }}>
                <span style={{ fontWeight: 600 }}>{p.title}</span>
                <span style={{ color: "var(--gold)" }}>{p.price}€ ({p.status})</span>
              </div>
            ))}
          </div>
        )}
        {(r as ActionResult & { orders?: Array<{ name: string; total: string; customer: string; financial: string }> }).orders && (
          <div style={{ marginTop: 8 }}>
            {((r as ActionResult & { orders: Array<{ name: string; total: string; customer: string; financial: string }> }).orders).map((o, i) => (
              <div key={i} style={{
                display: "flex", justifyContent: "space-between", alignItems: "center",
                padding: "6px 0", borderTop: i > 0 ? "1px solid var(--bdr)" : "none",
                fontSize: 12, color: "var(--t)",
              }}>
                <span style={{ fontWeight: 600 }}>{o.name}</span>
                <span>{o.customer} — <span style={{ color: "var(--gold)" }}>{o.total}€</span> ({o.financial})</span>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  };

  const isLoading = (key: string) => loading === key;

  const ActionButton = ({ icon, label, actionKey, onClick, variant }: {
    icon: React.ReactNode; label: string; actionKey: string;
    onClick: () => void; variant?: "gold" | "jade" | "default" | "danger";
  }) => {
    const bg = variant === "gold" ? "linear-gradient(135deg, #c8a84b, #e6c668)"
      : variant === "jade" ? "linear-gradient(135deg, #00c896, #00a67e)"
      : variant === "danger" ? "linear-gradient(135deg, #dc3545, #c82333)"
      : "var(--ink3)";
    const color = variant && variant !== "default" ? "#000" : "var(--t)";

    return (
      <button
        onClick={onClick}
        disabled={!!loading}
        style={{
          display: "flex", alignItems: "center", gap: 8,
          padding: "12px 18px", borderRadius: 10,
          background: bg, border: "none",
          color, fontWeight: 600, fontSize: 13,
          cursor: loading ? "wait" : "pointer",
          opacity: loading && loading !== actionKey ? 0.5 : 1,
          transition: "all 0.2s", width: "100%",
          boxShadow: variant === "gold" ? "0 2px 12px rgba(200,168,75,0.3)" : "none",
        }}
      >
        {isLoading(actionKey) ? <Loader2 size={15} className="spin" /> : icon}
        {label}
      </button>
    );
  };

  return (
    <div style={{ maxWidth: 900, margin: "0 auto", padding: "24px 16px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 24 }}>
        <div style={{
          width: 40, height: 40, borderRadius: 10,
          background: "linear-gradient(135deg, #c8a84b, #e6c668)",
          display: "flex", alignItems: "center", justifyContent: "center",
        }}>
          <Zap size={20} style={{ color: "#0a0a0f" }} />
        </div>
        <div>
          <h1 style={{ margin: 0, fontSize: 22, fontWeight: 800, color: "var(--t)" }}>Centro de Comando</h1>
          <p style={{ margin: 0, fontSize: 12, color: "var(--t4)" }}>Ejecuta acciones directas en Shopify con ShopyBrain</p>
        </div>
      </div>

      <div style={{
        display: "flex", alignItems: "center", gap: 10, marginBottom: 20,
        background: "var(--ink2)", borderRadius: 10, padding: "10px 16px",
        border: "1px solid var(--bdr)",
      }}>
        <label style={{ fontSize: 12, fontWeight: 700, color: "var(--gold)", whiteSpace: "nowrap" }}>Tienda:</label>
        <select
          value={selectedProject ?? ""}
          onChange={e => setSelectedProject(parseInt(e.target.value))}
          style={{
            flex: 1, background: "var(--ink3)", border: "1px solid var(--bdr)",
            borderRadius: 8, padding: "8px 12px", color: "var(--t)",
            fontSize: 13, fontWeight: 600,
          }}
        >
          {projects.map(p => (
            <option key={p.id} value={p.id}>{p.name} ({p.shopDomain})</option>
          ))}
        </select>
      </div>

      <div style={{
        background: "var(--ink2)", borderRadius: 12, padding: 16,
        border: "1px solid var(--bdr)", marginBottom: 20,
      }}>
        <h3 style={{ margin: "0 0 12px", fontSize: 14, fontWeight: 700, color: "var(--gold)", display: "flex", alignItems: "center", gap: 6 }}>
          <Send size={14} /> Comando directo (texto libre)
        </h3>
        <div style={{ display: "flex", gap: 8 }}>
          <input
            value={customCommand}
            onChange={e => setCustomCommand(e.target.value)}
            onKeyDown={e => e.key === "Enter" && customCommand.trim() && executeAction("custom")}
            placeholder='Ej: "Crea un producto llamado Camiseta Premium a 29.99€" o "Regenera el token"'
            style={{
              flex: 1, background: "var(--ink3)", border: "1px solid var(--bdr)",
              borderRadius: 8, padding: "10px 14px", color: "var(--t)",
              fontSize: 13,
            }}
          />
          <button
            onClick={() => customCommand.trim() && executeAction("custom")}
            disabled={!customCommand.trim() || !!loading}
            style={{
              background: "linear-gradient(135deg, #c8a84b, #e6c668)",
              border: "none", borderRadius: 8, padding: "10px 18px",
              fontWeight: 700, fontSize: 13, color: "#0a0a0f", cursor: "pointer",
              opacity: !customCommand.trim() || loading ? 0.5 : 1,
            }}
          >
            {isLoading("custom") ? <Loader2 size={14} className="spin" /> : <Zap size={14} />}
          </button>
        </div>
        <ResultCard actionKey="custom" label="Resultado" />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 16 }}>
        <div style={{ background: "var(--ink2)", borderRadius: 12, padding: 16, border: "1px solid var(--bdr)" }}>
          <h3 style={{ margin: "0 0 12px", fontSize: 14, fontWeight: 700, color: "var(--t)" }}>Estado & Monitoreo</h3>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <ActionButton icon={<Eye size={15} />} label="Estado de la tienda" actionKey="store_status"
              onClick={() => executeAction("store_status")} variant="gold" />
            <ActionButton icon={<Package size={15} />} label="Listar productos" actionKey="list_products"
              onClick={() => executeAction("list_products", { limit: 20 })} />
            <ActionButton icon={<ShoppingCart size={15} />} label="Ver pedidos" actionKey="get_orders"
              onClick={() => executeAction("get_orders", { limit: 15 })} />
            <ActionButton icon={<Shield size={15} />} label="Ver scopes OAuth" actionKey="get_scopes"
              onClick={() => executeAction("get_scopes")} />
          </div>
          <ResultCard actionKey="store_status" label="Estado" />
          <ResultCard actionKey="list_products" label="Productos" />
          <ResultCard actionKey="get_orders" label="Pedidos" />
          <ResultCard actionKey="get_scopes" label="Scopes" />
        </div>

        <div style={{ background: "var(--ink2)", borderRadius: 12, padding: 16, border: "1px solid var(--bdr)" }}>
          <h3 style={{ margin: "0 0 12px", fontSize: 14, fontWeight: 700, color: "var(--t)" }}>Token & Seguridad</h3>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <ActionButton icon={<Key size={15} />} label="Regenerar token ahora" actionKey="regenerate_token"
              onClick={() => executeAction("regenerate_token")} variant="jade" />
          </div>
          <ResultCard actionKey="regenerate_token" label="Token" />

          <h3 style={{ margin: "16px 0 12px", fontSize: 14, fontWeight: 700, color: "var(--t)" }}>Buscar producto</h3>
          <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
            <input
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              onKeyDown={e => e.key === "Enter" && searchQuery.trim() && executeAction("search_product", { query: searchQuery })}
              placeholder="Buscar por nombre..."
              style={{
                flex: 1, background: "var(--ink3)", border: "1px solid var(--bdr)",
                borderRadius: 8, padding: "8px 12px", color: "var(--t)", fontSize: 12,
              }}
            />
            <button
              onClick={() => searchQuery.trim() && executeAction("search_product", { query: searchQuery })}
              disabled={!searchQuery.trim() || !!loading}
              style={{
                background: "var(--ink3)", border: "1px solid var(--bdr)", borderRadius: 8,
                padding: "8px 12px", cursor: "pointer", color: "var(--t)",
              }}
            >
              <Search size={14} />
            </button>
          </div>
          <ResultCard actionKey="search_product" label="Resultados" />
        </div>

        <div style={{ background: "var(--ink2)", borderRadius: 12, padding: 16, border: "1px solid var(--bdr)" }}>
          <h3 style={{ margin: "0 0 12px", fontSize: 14, fontWeight: 700, color: "var(--t)" }}>Crear producto con IA</h3>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <input
              value={createTitle}
              onChange={e => setCreateTitle(e.target.value)}
              placeholder="Nombre del producto..."
              style={{
                background: "var(--ink3)", border: "1px solid var(--bdr)",
                borderRadius: 8, padding: "8px 12px", color: "var(--t)", fontSize: 12,
              }}
            />
            <input
              value={createPrice}
              onChange={e => setCreatePrice(e.target.value)}
              placeholder="Precio (ej: 29.99)"
              type="number" step="0.01"
              style={{
                background: "var(--ink3)", border: "1px solid var(--bdr)",
                borderRadius: 8, padding: "8px 12px", color: "var(--t)", fontSize: 12,
              }}
            />
            <ActionButton
              icon={<Plus size={15} />}
              label="Crear producto"
              actionKey="create_product"
              onClick={() => createTitle.trim() && executeAction("create_product", {
                title: createTitle, price: createPrice || "0.00", aiGenerate: true,
              })}
              variant="jade"
            />
          </div>
          <ResultCard actionKey="create_product" label="Producto creado" />
        </div>
      </div>

      <style>{`
        .spin { animation: spin 1s linear infinite; }
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}
