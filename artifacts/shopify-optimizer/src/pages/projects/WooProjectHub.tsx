import { useState, useEffect, useCallback } from "react";
import { useRoute } from "wouter";
import { toast } from "@/hooks/use-toast";

type Tab = "overview" | "orders" | "products" | "customers" | "coupons" | "inventory";

const WP = "#96588a";
const WL = "#b97ab5";
const WD = "#5b2d5f";

const API = import.meta.env.BASE_URL.replace(/\/$/, "") + "/api";

// Respuestas no-OK → error con el mensaje del API (antes se pintaban como datos: "NaN €", "undefined").
async function okJson(r: Response) {
  const d = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(d?.error ?? `HTTP ${r.status}`);
  return d;
}
const loadError = (e: Error) => toast({ title: "Error cargando datos", description: e.message, variant: "destructive" });
const saveError = (e: Error) => toast({ title: "No se pudo guardar", description: e.message, variant: "destructive" });

const fmt = (n: number, currency = "EUR") =>
  new Intl.NumberFormat("es-ES", { style: "currency", currency, minimumFractionDigits: 2 }).format(n);

const fmtDate = (d: string) =>
  d ? new Date(d).toLocaleDateString("es-ES", { day: "2-digit", month: "short", year: "numeric" }) : "—";

const fmtDateShort = (d: string) =>
  d ? new Date(d).toLocaleDateString("es-ES", { day: "2-digit", month: "short" }) : "—";

function Badge({ status }: { status: string }) {
  const m: Record<string, { bg: string; c: string; label: string }> = {
    processing:    { bg: "rgba(251,191,36,0.12)",  c: "#fbbf24", label: "⚙ Procesando" },
    pending:       { bg: "rgba(251,191,36,0.12)",  c: "#fbbf24", label: "⏳ Pendiente" },
    "on-hold":     { bg: "rgba(251,146,60,0.12)",  c: "#fb923c", label: "⏸ En espera" },
    completed:     { bg: "rgba(52,211,153,0.12)",  c: "#34d399", label: "✓ Completado" },
    cancelled:     { bg: "rgba(244,63,94,0.12)",   c: "#f43f5e", label: "✗ Cancelado" },
    refunded:      { bg: "rgba(156,163,175,0.12)", c: "#9ca3af", label: "↩ Devuelto" },
    failed:        { bg: "rgba(244,63,94,0.12)",   c: "#f43f5e", label: "✗ Fallido" },
    trash:         { bg: "rgba(244,63,94,0.12)",   c: "#f43f5e", label: "🗑 Papelera" },
    publish:       { bg: "rgba(52,211,153,0.12)",  c: "#34d399", label: "✓ Publicado" },
    draft:         { bg: "rgba(251,191,36,0.12)",  c: "#fbbf24", label: "📝 Borrador" },
    private:       { bg: "rgba(99,91,255,0.15)",   c: "#897eff", label: "🔒 Privado" },
    instock:       { bg: "rgba(52,211,153,0.12)",  c: "#34d399", label: "✓ En stock" },
    outofstock:    { bg: "rgba(244,63,94,0.12)",   c: "#f43f5e", label: "✗ Sin stock" },
    onbackorder:   { bg: "rgba(251,146,60,0.12)",  c: "#fb923c", label: "⚠ Bajo pedido" },
    percent:       { bg: "rgba(150,88,138,0.15)",  c: WL,        label: "%" },
    fixed_cart:    { bg: "rgba(150,88,138,0.15)",  c: WL,        label: "€ Fijo" },
    fixed_product: { bg: "rgba(150,88,138,0.15)",  c: WL,        label: "€ Producto" },
  };
  const s = m[status] ?? { bg: "rgba(255,255,255,0.06)", c: "rgba(255,255,255,0.5)", label: status };
  return (
    <span style={{ display:"inline-block", padding:"2px 10px", borderRadius:100, fontSize:11, fontWeight:700, background:s.bg, color:s.c, whiteSpace:"nowrap" }}>
      {s.label}
    </span>
  );
}

function KpiCard({ label, value, sub, icon, color = WP }: { label: string; value: string; sub?: string; icon: string; color?: string }) {
  return (
    <div style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 14, padding: "20px 22px", display: "flex", flexDirection: "column", gap: 6 }}>
      <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between" }}>
        <span style={{ fontSize:22 }}>{icon}</span>
        <span style={{ fontSize:11, color:"rgba(255,255,255,0.35)", fontWeight:600, textTransform:"uppercase", letterSpacing:0.5 }}>{label}</span>
      </div>
      <div style={{ fontSize:28, fontWeight:800, color, marginTop:4 }}>{value}</div>
      {sub && <div style={{ fontSize:12, color:"rgba(255,255,255,0.4)" }}>{sub}</div>}
    </div>
  );
}

function SearchBar({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder: string }) {
  return (
    <input
      value={value}
      onChange={e => onChange(e.target.value)}
      placeholder={placeholder}
      style={{ background:"rgba(255,255,255,0.06)", border:"1px solid rgba(255,255,255,0.12)", borderRadius:8, padding:"8px 14px", color:"#fff", fontSize:13, outline:"none", width:260 }}
    />
  );
}

function Table({ cols, rows, emptyMsg }: { cols: string[]; rows: React.ReactNode[][]; emptyMsg: string }) {
  if (!rows.length) return (
    <div style={{ textAlign:"center", padding:"48px 0", color:"rgba(255,255,255,0.3)", fontSize:13 }}>
      {emptyMsg}
    </div>
  );
  return (
    <div style={{ overflowX:"auto" }}>
      <table style={{ width:"100%", borderCollapse:"collapse", fontSize:13 }}>
        <thead>
          <tr>
            {cols.map(c => (
              <th key={c} style={{ padding:"10px 14px", textAlign:"left", color:"rgba(255,255,255,0.4)", fontWeight:600, fontSize:11, textTransform:"uppercase", letterSpacing:0.5, borderBottom:"1px solid rgba(255,255,255,0.08)", whiteSpace:"nowrap" }}>{c}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i} style={{ borderBottom:"1px solid rgba(255,255,255,0.05)" }}>
              {row.map((cell, j) => (
                <td key={j} style={{ padding:"12px 14px", color:"rgba(255,255,255,0.85)", verticalAlign:"middle" }}>{cell}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Pagination({ page, onPage, hasMore }: { page: number; onPage: (p: number) => void; hasMore: boolean }) {
  return (
    <div style={{ display:"flex", gap:8, alignItems:"center", justifyContent:"center", padding:"16px 0" }}>
      <button onClick={() => onPage(page - 1)} disabled={page <= 1}
        style={{ background:"rgba(255,255,255,0.06)", border:"1px solid rgba(255,255,255,0.1)", borderRadius:6, padding:"6px 14px", color: page <= 1 ? "rgba(255,255,255,0.2)" : "#fff", cursor: page <= 1 ? "not-allowed" : "pointer", fontSize:13 }}>
        ← Anterior
      </button>
      <span style={{ color:"rgba(255,255,255,0.4)", fontSize:13 }}>Página {page}</span>
      <button onClick={() => onPage(page + 1)} disabled={!hasMore}
        style={{ background:"rgba(255,255,255,0.06)", border:"1px solid rgba(255,255,255,0.1)", borderRadius:6, padding:"6px 14px", color: !hasMore ? "rgba(255,255,255,0.2)" : "#fff", cursor: !hasMore ? "not-allowed" : "pointer", fontSize:13 }}>
        Siguiente →
      </button>
    </div>
  );
}

// ─── TAB: Overview ────────────────────────────────────────────────────────────
function OverviewTab({ projectId }: { projectId: string }) {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    fetch(`${API}/admin/woo/project/${projectId}/overview`, { credentials: "include" })
      .then(okJson)
      .then(d => { setData(d); setLoading(false); })
      .catch(e => { setError(e.message); setLoading(false); });
  }, [projectId]);

  if (loading) return <div style={{ textAlign:"center", padding:60, color:"rgba(255,255,255,0.4)" }}>Cargando datos WooCommerce…</div>;
  if (error) return <div style={{ padding:24, color:"#f43f5e", background:"rgba(244,63,94,0.08)", borderRadius:10, border:"1px solid rgba(244,63,94,0.2)" }}>⚠️ {error}</div>;
  if (!data) return null;

  return (
    <div style={{ display:"flex", flexDirection:"column", gap:24 }}>
      {/* KPIs */}
      <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit, minmax(180px, 1fr))", gap:12 }}>
        <KpiCard label="Ingresos 30d" value={fmt(data.revenue30d, data.currency)} sub={`${data.orders30d} pedidos`} icon="💰" />
        <KpiCard label="Ticket Medio" value={fmt(data.aov, data.currency)} sub="Este mes" icon="🎯" color={WL} />
        <KpiCard label="Productos" value={String(data.totalProducts)} sub="En catálogo" icon="📦" color="#34d399" />
        <KpiCard label="Sin Stock" value={String(data.lowStockCount)} sub="Alertas activas" icon="⚠️" color={data.lowStockCount > 0 ? "#f43f5e" : "#34d399"} />
        {data.refunds30d > 0 && <KpiCard label="Reembolsos" value={fmt(data.refunds30d, data.currency)} sub="Este mes" icon="↩" color="#fb923c" />}
      </div>

      {/* Últimos pedidos */}
      <div style={{ background:"rgba(255,255,255,0.03)", border:"1px solid rgba(255,255,255,0.07)", borderRadius:12, padding:"18px 20px" }}>
        <h3 style={{ margin:"0 0 16px", fontSize:15, fontWeight:700, color:"rgba(255,255,255,0.9)" }}>Últimos Pedidos</h3>
        <Table
          cols={["#", "Cliente", "Productos", "Total", "Estado", "Fecha"]}
          rows={(data.recentOrders ?? []).map((o: any) => [
            <span style={{ fontFamily:"monospace", color: WL }}>#{o.number}</span>,
            <div><div style={{ color:"#fff", fontWeight:600 }}>{o.customerName}</div><div style={{ fontSize:11, color:"rgba(255,255,255,0.35)" }}>{o.email}</div></div>,
            <span style={{ color:"rgba(255,255,255,0.5)" }}>{o.itemCount} art.</span>,
            <span style={{ fontWeight:700, color:WP }}>{fmt(o.total, o.currency)}</span>,
            <Badge status={o.status} />,
            <span style={{ color:"rgba(255,255,255,0.4)", fontSize:12 }}>{fmtDateShort(o.date)}</span>,
          ])}
          emptyMsg="No hay pedidos recientes"
        />
      </div>

      {/* Alertas stock */}
      {(data.stockAlerts ?? []).length > 0 && (
        <div style={{ background:"rgba(244,63,94,0.04)", border:"1px solid rgba(244,63,94,0.15)", borderRadius:12, padding:"18px 20px" }}>
          <h3 style={{ margin:"0 0 16px", fontSize:15, fontWeight:700, color:"#f43f5e" }}>⚠️ Alertas de Stock</h3>
          <Table
            cols={["Producto", "SKU", "Stock", "Estado", "Precio"]}
            rows={(data.stockAlerts ?? []).map((p: any) => [
              p.name,
              <span style={{ fontFamily:"monospace", fontSize:11, color:"rgba(255,255,255,0.4)" }}>{p.sku || "—"}</span>,
              <span style={{ fontWeight:700, color: (p.stock ?? 0) <= 0 ? "#f43f5e" : "#fb923c" }}>{p.stock ?? 0}</span>,
              <Badge status={p.status} />,
              fmt(p.price, data.currency),
            ])}
            emptyMsg=""
          />
        </div>
      )}
    </div>
  );
}

// ─── TAB: Pedidos ─────────────────────────────────────────────────────────────
function OrdersTab({ projectId }: { projectId: string }) {
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [expanded, setExpanded] = useState<number | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    let url = `${API}/admin/woo/project/${projectId}/orders?page=${page}&per_page=20`;
    if (search) url += `&search=${encodeURIComponent(search)}`;
    if (status) url += `&status=${status}`;
    fetch(url, { credentials: "include" })
      .then(okJson)
      .then(d => { setOrders(d.orders ?? []); setLoading(false); })
      .catch((e: Error) => { setLoading(false); loadError(e); });
  }, [projectId, page, search, status]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { setPage(1); }, [search, status]);

  const statuses = ["", "processing", "pending", "on-hold", "completed", "cancelled", "refunded", "failed"];

  return (
    <div style={{ display:"flex", flexDirection:"column", gap:16 }}>
      <div style={{ display:"flex", gap:10, flexWrap:"wrap", alignItems:"center" }}>
        <SearchBar value={search} onChange={setSearch} placeholder="Buscar por cliente, email…" />
        <select value={status} onChange={e => setStatus(e.target.value)}
          style={{ background:"rgba(255,255,255,0.06)", border:"1px solid rgba(255,255,255,0.12)", borderRadius:8, padding:"8px 12px", color:"#fff", fontSize:13, outline:"none" }}>
          {statuses.map(s => <option key={s} value={s} style={{ background:"#1a1a2e" }}>{s || "Todos los estados"}</option>)}
        </select>
      </div>

      {loading ? (
        <div style={{ textAlign:"center", padding:40, color:"rgba(255,255,255,0.4)" }}>Cargando pedidos…</div>
      ) : (
        <div style={{ background:"rgba(255,255,255,0.03)", border:"1px solid rgba(255,255,255,0.07)", borderRadius:12, overflow:"hidden" }}>
          <Table
            cols={["#", "Cliente", "Artículos", "Envío", "Total", "Estado", "Pago", "Fecha"]}
            rows={orders.map((o: any) => [
              <span style={{ fontFamily:"monospace", color:WL, cursor:"pointer" }} onClick={() => setExpanded(expanded === o.id ? null : o.id)}>
                #{o.number}
              </span>,
              <div>
                <div style={{ fontWeight:600 }}>{o.customerName}</div>
                <div style={{ fontSize:11, color:"rgba(255,255,255,0.35)" }}>{o.email}</div>
                {o.phone && <div style={{ fontSize:11, color:"rgba(255,255,255,0.25)" }}>{o.phone}</div>}
                {expanded === o.id && (
                  <div style={{ marginTop:10, background:"rgba(255,255,255,0.04)", borderRadius:8, padding:"10px 14px" }}>
                    {(o.items ?? []).map((li: any, i: number) => (
                      <div key={i} style={{ display:"flex", justifyContent:"space-between", fontSize:12, color:"rgba(255,255,255,0.7)", padding:"3px 0" }}>
                        <span>× {li.qty} {li.name}</span>
                        <span style={{ color:WL }}>{fmt(li.total)}</span>
                      </div>
                    ))}
                    {o.note && <div style={{ marginTop:8, fontSize:11, color:"rgba(255,255,255,0.35)", fontStyle:"italic" }}>📝 {o.note}</div>}
                  </div>
                )}
              </div>,
              <span style={{ color:"rgba(255,255,255,0.5)" }}>{o.itemCount}</span>,
              <span style={{ fontSize:12, color:"rgba(255,255,255,0.4)" }}>{fmt(o.shippingTotal)}</span>,
              <span style={{ fontWeight:700, color:WP }}>{fmt(o.total, o.currency)}</span>,
              <Badge status={o.status} />,
              <span style={{ fontSize:12, color:"rgba(255,255,255,0.4)" }}>{o.paymentMethod || "—"}</span>,
              <span style={{ fontSize:12, color:"rgba(255,255,255,0.4)" }}>{fmtDate(o.date)}</span>,
            ])}
            emptyMsg="No hay pedidos con estos filtros"
          />
          <Pagination page={page} onPage={setPage} hasMore={orders.length === 20} />
        </div>
      )}
    </div>
  );
}

// ─── TAB: Productos ───────────────────────────────────────────────────────────
function ProductsTab({ projectId }: { projectId: string }) {
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [editing, setEditing] = useState<any | null>(null);
  const [saving, setSaving] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    let url = `${API}/admin/woo/project/${projectId}/products?page=${page}&per_page=20`;
    if (search) url += `&search=${encodeURIComponent(search)}`;
    if (status) url += `&status=${status}`;
    fetch(url, { credentials: "include" })
      .then(okJson)
      .then(d => { setProducts(d.products ?? []); setLoading(false); })
      .catch((e: Error) => { setLoading(false); loadError(e); });
  }, [projectId, page, search, status]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { setPage(1); }, [search, status]);

  const saveProduct = async () => {
    if (!editing) return;
    setSaving(true);
    try {
      await fetch(`${API}/admin/woo/project/${projectId}/products/${editing.id}`, {
        method: "PUT", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: editing.name, regular_price: String(editing.price), status: editing.status }),
      }).then(okJson);
      setEditing(null);
      load();
    } catch (e) { saveError(e as Error); }
    finally { setSaving(false); }
  };

  return (
    <div style={{ display:"flex", flexDirection:"column", gap:16 }}>
      <div style={{ display:"flex", gap:10, flexWrap:"wrap", alignItems:"center" }}>
        <SearchBar value={search} onChange={setSearch} placeholder="Buscar productos…" />
        <select value={status} onChange={e => setStatus(e.target.value)}
          style={{ background:"rgba(255,255,255,0.06)", border:"1px solid rgba(255,255,255,0.12)", borderRadius:8, padding:"8px 12px", color:"#fff", fontSize:13, outline:"none" }}>
          {["", "publish", "draft", "private"].map(s => (
            <option key={s} value={s} style={{ background:"#1a1a2e" }}>{s || "Todos"}</option>
          ))}
        </select>
      </div>

      {editing && (
        <div style={{ background:"rgba(150,88,138,0.1)", border:`1px solid ${WP}`, borderRadius:12, padding:"20px 24px", display:"flex", flexDirection:"column", gap:12 }}>
          <div style={{ fontWeight:700, color:WL, marginBottom:4 }}>✏️ Editando producto #{editing.id}</div>
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:12 }}>
            <div>
              <label style={{ fontSize:11, color:"rgba(255,255,255,0.4)", display:"block", marginBottom:4 }}>Nombre</label>
              <input value={editing.name} onChange={e => setEditing({ ...editing, name: e.target.value })}
                style={{ width:"100%", background:"rgba(255,255,255,0.06)", border:"1px solid rgba(255,255,255,0.15)", borderRadius:8, padding:"8px 12px", color:"#fff", fontSize:13, outline:"none", boxSizing:"border-box" }} />
            </div>
            <div>
              <label style={{ fontSize:11, color:"rgba(255,255,255,0.4)", display:"block", marginBottom:4 }}>Precio (€)</label>
              <input type="number" value={editing.price} onChange={e => setEditing({ ...editing, price: parseFloat(e.target.value) })}
                style={{ width:"100%", background:"rgba(255,255,255,0.06)", border:"1px solid rgba(255,255,255,0.15)", borderRadius:8, padding:"8px 12px", color:"#fff", fontSize:13, outline:"none", boxSizing:"border-box" }} />
            </div>
            <div>
              <label style={{ fontSize:11, color:"rgba(255,255,255,0.4)", display:"block", marginBottom:4 }}>Estado</label>
              <select value={editing.status} onChange={e => setEditing({ ...editing, status: e.target.value })}
                style={{ width:"100%", background:"rgba(255,255,255,0.06)", border:"1px solid rgba(255,255,255,0.15)", borderRadius:8, padding:"8px 12px", color:"#fff", fontSize:13, outline:"none" }}>
                {["publish","draft","private"].map(s => <option key={s} value={s} style={{ background:"#1a1a2e" }}>{s}</option>)}
              </select>
            </div>
          </div>
          <div style={{ display:"flex", gap:8 }}>
            <button onClick={saveProduct} disabled={saving}
              style={{ background:WP, border:"none", borderRadius:8, padding:"8px 20px", color:"#fff", fontWeight:700, cursor:"pointer", opacity: saving ? 0.6 : 1 }}>
              {saving ? "Guardando…" : "Guardar"}
            </button>
            <button onClick={() => setEditing(null)}
              style={{ background:"rgba(255,255,255,0.07)", border:"1px solid rgba(255,255,255,0.12)", borderRadius:8, padding:"8px 16px", color:"rgba(255,255,255,0.6)", cursor:"pointer" }}>
              Cancelar
            </button>
          </div>
        </div>
      )}

      {loading ? (
        <div style={{ textAlign:"center", padding:40, color:"rgba(255,255,255,0.4)" }}>Cargando productos…</div>
      ) : (
        <div style={{ background:"rgba(255,255,255,0.03)", border:"1px solid rgba(255,255,255,0.07)", borderRadius:12, overflow:"hidden" }}>
          <Table
            cols={["Producto", "SKU", "Precio", "Stock", "Ventas", "Estado", "Variaciones", "Fecha", ""]}
            rows={products.map((p: any) => [
              <div style={{ display:"flex", alignItems:"center", gap:10 }}>
                {p.image && <img src={p.image} alt="" style={{ width:36, height:36, objectFit:"cover", borderRadius:6, border:"1px solid rgba(255,255,255,0.1)" }} />}
                <div>
                  <div style={{ fontWeight:600, color:"#fff" }}>{p.name}</div>
                  <div style={{ fontSize:11, color:"rgba(255,255,255,0.3)" }}>{(p.categories ?? []).join(", ") || "—"}</div>
                </div>
              </div>,
              <span style={{ fontFamily:"monospace", fontSize:11, color:"rgba(255,255,255,0.4)" }}>{p.sku || "—"}</span>,
              <div>
                <div style={{ fontWeight:700, color:WP }}>{fmt(p.price)}</div>
                {p.salePrice && <div style={{ fontSize:11, color:"#fb923c" }}>Oferta: {fmt(p.salePrice)}</div>}
              </div>,
              <Badge status={p.stockStatus} />,
              <span style={{ color:"rgba(255,255,255,0.5)" }}>{p.totalSales}</span>,
              <Badge status={p.status} />,
              <span style={{ color: p.variationCount > 0 ? WL : "rgba(255,255,255,0.2)", fontSize:12 }}>
                {p.variationCount > 0 ? `${p.variationCount} variaciones` : "—"}
              </span>,
              <span style={{ fontSize:11, color:"rgba(255,255,255,0.35)" }}>{fmtDateShort(p.date)}</span>,
              <button onClick={() => setEditing(p)}
                style={{ background:"rgba(150,88,138,0.15)", border:`1px solid ${WP}40`, borderRadius:6, padding:"4px 10px", color:WL, fontSize:11, cursor:"pointer" }}>
                Editar
              </button>,
            ])}
            emptyMsg="No hay productos con estos filtros"
          />
          <Pagination page={page} onPage={setPage} hasMore={products.length === 20} />
        </div>
      )}
    </div>
  );
}

// ─── TAB: Clientes ────────────────────────────────────────────────────────────
function CustomersTab({ projectId }: { projectId: string }) {
  const [customers, setCustomers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");

  const load = useCallback(() => {
    setLoading(true);
    let url = `${API}/admin/woo/project/${projectId}/customers?page=${page}&per_page=20`;
    if (search) url += `&search=${encodeURIComponent(search)}`;
    fetch(url, { credentials: "include" })
      .then(okJson)
      .then(d => { setCustomers(d.customers ?? []); setLoading(false); })
      .catch((e: Error) => { setLoading(false); loadError(e); });
  }, [projectId, page, search]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { setPage(1); }, [search]);

  return (
    <div style={{ display:"flex", flexDirection:"column", gap:16 }}>
      <SearchBar value={search} onChange={setSearch} placeholder="Buscar por nombre, email…" />
      {loading ? (
        <div style={{ textAlign:"center", padding:40, color:"rgba(255,255,255,0.4)" }}>Cargando clientes…</div>
      ) : (
        <div style={{ background:"rgba(255,255,255,0.03)", border:"1px solid rgba(255,255,255,0.07)", borderRadius:12, overflow:"hidden" }}>
          <Table
            cols={["Cliente", "Email", "Pedidos", "Total Gastado", "Localidad", "Registrado"]}
            rows={customers.map((c: any) => [
              <div style={{ display:"flex", alignItems:"center", gap:10 }}>
                {c.avatarUrl ? (
                  <img src={c.avatarUrl} alt="" style={{ width:32, height:32, borderRadius:"50%", border:`1px solid ${WP}50` }} />
                ) : (
                  <div style={{ width:32, height:32, borderRadius:"50%", background:`linear-gradient(135deg, ${WD}, ${WP})`, display:"flex", alignItems:"center", justifyContent:"center", fontSize:14, fontWeight:700 }}>
                    {(c.name || "?")[0].toUpperCase()}
                  </div>
                )}
                <div>
                  <div style={{ fontWeight:600 }}>{c.name}</div>
                  <div style={{ fontSize:11, color:"rgba(255,255,255,0.3)" }}>{c.role}</div>
                </div>
              </div>,
              <span style={{ fontSize:12, color:"rgba(255,255,255,0.6)" }}>{c.email}</span>,
              <span style={{ fontWeight:700, color:WL }}>{c.ordersCount}</span>,
              <span style={{ fontWeight:700, color:WP }}>{fmt(c.totalSpent)}</span>,
              <span style={{ fontSize:12, color:"rgba(255,255,255,0.4)" }}>{[c.city, c.country].filter(Boolean).join(", ") || "—"}</span>,
              <span style={{ fontSize:12, color:"rgba(255,255,255,0.35)" }}>{fmtDate(c.dateCreated)}</span>,
            ])}
            emptyMsg="No hay clientes con estos filtros"
          />
          <Pagination page={page} onPage={setPage} hasMore={customers.length === 20} />
        </div>
      )}
    </div>
  );
}

// ─── TAB: Cupones ─────────────────────────────────────────────────────────────
function CouponsTab({ projectId }: { projectId: string }) {
  const [coupons, setCoupons] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    fetch(`${API}/admin/woo/project/${projectId}/coupons`, { credentials: "include" })
      .then(okJson)
      .then(d => { setCoupons(d.coupons ?? []); setLoading(false); })
      .catch((e: Error) => { setLoading(false); loadError(e); });
  }, [projectId]);

  return (
    <div style={{ display:"flex", flexDirection:"column", gap:16 }}>
      {loading ? (
        <div style={{ textAlign:"center", padding:40, color:"rgba(255,255,255,0.4)" }}>Cargando cupones…</div>
      ) : (
        <div style={{ background:"rgba(255,255,255,0.03)", border:"1px solid rgba(255,255,255,0.07)", borderRadius:12, overflow:"hidden" }}>
          <Table
            cols={["Código", "Tipo", "Descuento", "Usos", "Límite", "Envío Gratis", "Expira", "Mín. Compra"]}
            rows={coupons.map((c: any) => [
              <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                <span style={{ fontFamily:"monospace", fontWeight:700, color:WL, background:"rgba(150,88,138,0.15)", padding:"3px 10px", borderRadius:6, fontSize:12, letterSpacing:1 }}>
                  {c.code}
                </span>
                {c.individualUse && <span style={{ fontSize:10, color:"rgba(255,255,255,0.3)", background:"rgba(255,255,255,0.05)", padding:"2px 6px", borderRadius:4 }}>Solo</span>}
              </div>,
              <Badge status={c.discountType} />,
              <span style={{ fontWeight:700, color:WP }}>
                {c.discountType === "percent" ? `${c.amount}%` : fmt(c.amount)}
              </span>,
              <span style={{ color: (c.usageLimit && c.usageCount >= c.usageLimit) ? "#f43f5e" : WL, fontWeight:600 }}>
                {c.usageCount}{c.usageLimit ? ` / ${c.usageLimit}` : ""}
              </span>,
              <span style={{ fontSize:12, color:"rgba(255,255,255,0.4)" }}>{c.usageLimitUser ?? "∞"} / usuario</span>,
              c.freeShipping
                ? <span style={{ color:"#34d399", fontWeight:700 }}>✓ Sí</span>
                : <span style={{ color:"rgba(255,255,255,0.2)" }}>No</span>,
              <span style={{ fontSize:12, color: c.dateExpiry && new Date(c.dateExpiry) < new Date() ? "#f43f5e" : "rgba(255,255,255,0.5)" }}>
                {c.dateExpiry ? fmtDate(c.dateExpiry) : "Sin expiración"}
              </span>,
              <span style={{ fontSize:12, color:"rgba(255,255,255,0.4)" }}>
                {c.minimumAmount ? fmt(c.minimumAmount) : "—"}
              </span>,
            ])}
            emptyMsg="No hay cupones en esta tienda"
          />
        </div>
      )}
    </div>
  );
}

// ─── TAB: Inventario ─────────────────────────────────────────────────────────
function InventoryTab({ projectId }: { projectId: string }) {
  const [inv, setInv] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    fetch(`${API}/admin/woo/project/${projectId}/inventory`, { credentials: "include" })
      .then(okJson)
      .then(d => { setInv(d); setLoading(false); })
      .catch((e: Error) => { setLoading(false); loadError(e); });
  }, [projectId]);

  if (loading) return <div style={{ textAlign:"center", padding:40, color:"rgba(255,255,255,0.4)" }}>Cargando inventario…</div>;
  if (!inv) return null;

  return (
    <div style={{ display:"flex", flexDirection:"column", gap:20 }}>
      <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit, minmax(160px, 1fr))", gap:12 }}>
        <KpiCard label="Sin Stock" value={String(inv.outOfStockCount)} sub="Requieren reposición" icon="❌" color="#f43f5e" />
        <KpiCard label="Stock Bajo" value={String(inv.lowStockCount)} sub="Menos de 5 unidades" icon="⚠️" color="#fb923c" />
        <KpiCard label="Con Seguimiento" value={String(inv.totalTracked)} sub="Productos gestionados" icon="📊" color={WL} />
      </div>

      {inv.outOfStock?.length > 0 && (
        <div style={{ background:"rgba(244,63,94,0.04)", border:"1px solid rgba(244,63,94,0.15)", borderRadius:12, padding:"18px 20px" }}>
          <h3 style={{ margin:"0 0 16px", fontSize:14, fontWeight:700, color:"#f43f5e" }}>❌ Sin Stock ({inv.outOfStockCount})</h3>
          <Table
            cols={["Producto", "SKU", "Stock", "Estado", "Precio"]}
            rows={(inv.outOfStock ?? []).map((p: any) => [
              p.name,
              <span style={{ fontFamily:"monospace", fontSize:11, color:"rgba(255,255,255,0.4)" }}>{p.sku || "—"}</span>,
              <span style={{ fontWeight:700, color:"#f43f5e" }}>{p.stockQuantity ?? 0}</span>,
              <Badge status={p.stockStatus} />,
              fmt(p.price),
            ])}
            emptyMsg=""
          />
        </div>
      )}

      {inv.lowStock?.length > 0 && (
        <div style={{ background:"rgba(251,146,60,0.04)", border:"1px solid rgba(251,146,60,0.15)", borderRadius:12, padding:"18px 20px" }}>
          <h3 style={{ margin:"0 0 16px", fontSize:14, fontWeight:700, color:"#fb923c" }}>⚠️ Stock Bajo ({inv.lowStockCount})</h3>
          <Table
            cols={["Producto", "SKU", "Stock", "Precio"]}
            rows={(inv.lowStock ?? []).map((p: any) => [
              p.name,
              <span style={{ fontFamily:"monospace", fontSize:11, color:"rgba(255,255,255,0.4)" }}>{p.sku || "—"}</span>,
              <span style={{ fontWeight:700, color:"#fb923c" }}>{p.stockQuantity}</span>,
              fmt(p.price),
            ])}
            emptyMsg=""
          />
        </div>
      )}
    </div>
  );
}

// ─── MAIN HUB ─────────────────────────────────────────────────────────────────
export default function WooProjectHub() {
  const [, params] = useRoute("/projects/:id/woo-hub");
  const projectId = params?.id ?? "";
  const [tab, setTab] = useState<Tab>("overview");

  const tabs: { id: Tab; label: string; icon: string }[] = [
    { id: "overview",   label: "Overview",   icon: "📊" },
    { id: "orders",     label: "Pedidos",    icon: "📋" },
    { id: "products",   label: "Productos",  icon: "📦" },
    { id: "customers",  label: "Clientes",   icon: "👥" },
    { id: "coupons",    label: "Cupones",    icon: "🏷️" },
    { id: "inventory",  label: "Inventario", icon: "📈" },
  ];

  return (
    <div style={{ minHeight:"100vh", background:"linear-gradient(135deg, #1a0f20 0%, #0f0a14 50%, #120a18 100%)", color:"#fff", fontFamily:"system-ui, sans-serif" }}>
      {/* Header */}
      <div style={{ background:"rgba(150,88,138,0.08)", borderBottom:`1px solid ${WP}30`, padding:"20px 28px" }}>
        <div style={{ display:"flex", alignItems:"center", gap:14 }}>
          <div style={{ width:44, height:44, borderRadius:12, background:`linear-gradient(135deg, ${WD}, ${WP})`, display:"flex", alignItems:"center", justifyContent:"center", fontSize:22, boxShadow:`0 4px 20px ${WP}40` }}>
            🟣
          </div>
          <div>
            <div style={{ fontSize:22, fontWeight:800, color:"#fff" }}>WooCommerce Hub</div>
            <div style={{ fontSize:13, color:"rgba(255,255,255,0.45)", marginTop:2 }}>Panel de gestión — Proyecto #{projectId}</div>
          </div>
          <div style={{ marginLeft:"auto", background:`${WP}22`, border:`1px solid ${WP}50`, borderRadius:20, padding:"4px 16px", fontSize:12, color:WL, fontWeight:700 }}>
            WooCommerce REST API v3
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ background:"rgba(0,0,0,0.2)", borderBottom:"1px solid rgba(255,255,255,0.06)", padding:"0 28px", display:"flex", gap:2 }}>
        {tabs.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            style={{
              background: tab === t.id ? `${WP}20` : "transparent",
              border: "none", borderBottom: tab === t.id ? `2px solid ${WP}` : "2px solid transparent",
              color: tab === t.id ? WL : "rgba(255,255,255,0.4)",
              fontWeight: tab === t.id ? 700 : 400,
              padding: "14px 18px", cursor: "pointer", fontSize: 13, display: "flex", alignItems: "center", gap: 6, transition: "all 0.15s",
            }}>
            {t.icon} {t.label}
          </button>
        ))}
      </div>

      {/* Content */}
      <div style={{ padding:"28px 28px 60px" }}>
        {tab === "overview"  && <OverviewTab   projectId={projectId} />}
        {tab === "orders"    && <OrdersTab     projectId={projectId} />}
        {tab === "products"  && <ProductsTab   projectId={projectId} />}
        {tab === "customers" && <CustomersTab  projectId={projectId} />}
        {tab === "coupons"   && <CouponsTab    projectId={projectId} />}
        {tab === "inventory" && <InventoryTab  projectId={projectId} />}
      </div>
    </div>
  );
}
