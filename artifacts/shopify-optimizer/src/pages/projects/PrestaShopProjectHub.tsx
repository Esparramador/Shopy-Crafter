import { useState, useEffect, useCallback } from "react";
import { useRoute } from "wouter";

type Tab = "overview" | "orders" | "products" | "categories" | "inventory" | "seo";

const PP = "#df0067";
const PL = "#ff4d8d";
const PD = "#8a0040";

const API = import.meta.env.BASE_URL.replace(/\/$/, "") + "/api";

const fmt = (n: number, currency = "EUR") =>
  new Intl.NumberFormat("es-ES", { style: "currency", currency, minimumFractionDigits: 2 }).format(n);

const fmtDate = (d: string) =>
  d ? new Date(d).toLocaleDateString("es-ES", { day: "2-digit", month: "short", year: "numeric" }) : "—";

const fmtDateShort = (d: string) =>
  d ? new Date(d).toLocaleDateString("es-ES", { day: "2-digit", month: "short" }) : "—";

function Badge({ status }: { status: string }) {
  const m: Record<string, { bg: string; c: string; label: string }> = {
    active:           { bg: "rgba(52,211,153,0.12)",  c: "#34d399", label: "✓ Activo" },
    "1":              { bg: "rgba(52,211,153,0.12)",  c: "#34d399", label: "✓ Activo" },
    enabled:          { bg: "rgba(52,211,153,0.12)",  c: "#34d399", label: "✓ Habilitado" },
    inactive:         { bg: "rgba(244,63,94,0.12)",   c: "#f43f5e", label: "✗ Inactivo" },
    "0":              { bg: "rgba(244,63,94,0.12)",   c: "#f43f5e", label: "✗ Inactivo" },
    disabled:         { bg: "rgba(244,63,94,0.12)",   c: "#f43f5e", label: "✗ Deshabilitado" },
    // PrestaShop order statuses
    payment_accepted: { bg: "rgba(52,211,153,0.12)",  c: "#34d399", label: "✓ Pago aceptado" },
    shipped:          { bg: "rgba(99,91,255,0.15)",   c: "#897eff", label: "🚚 Enviado" },
    delivered:        { bg: "rgba(52,211,153,0.12)",  c: "#34d399", label: "✓ Entregado" },
    pending:          { bg: "rgba(251,191,36,0.12)",  c: "#fbbf24", label: "⏳ Pendiente" },
    awaiting_check:   { bg: "rgba(251,191,36,0.12)",  c: "#fbbf24", label: "⏳ Verificación" },
    awaiting_payment: { bg: "rgba(251,146,60,0.12)",  c: "#fb923c", label: "💳 Esperando pago" },
    refunded:         { bg: "rgba(156,163,175,0.12)", c: "#9ca3af", label: "↩ Reembolsado" },
    cancelled:        { bg: "rgba(244,63,94,0.12)",   c: "#f43f5e", label: "✗ Cancelado" },
    on_backorder:     { bg: "rgba(251,146,60,0.12)",  c: "#fb923c", label: "⚠ Bajo pedido" },
    unknown:          { bg: "rgba(255,255,255,0.06)", c: "rgba(255,255,255,0.4)", label: "Desconocido" },
  };
  const s = m[status] ?? { bg: "rgba(255,255,255,0.06)", c: "rgba(255,255,255,0.5)", label: status };
  return (
    <span style={{ display:"inline-block", padding:"2px 10px", borderRadius:100, fontSize:11, fontWeight:700, background:s.bg, color:s.c, whiteSpace:"nowrap" }}>
      {s.label}
    </span>
  );
}

function KpiCard({ label, value, sub, icon, color = PP }: { label: string; value: string; sub?: string; icon: string; color?: string }) {
  return (
    <div style={{ background:"rgba(255,255,255,0.04)", border:"1px solid rgba(255,255,255,0.08)", borderRadius:14, padding:"20px 22px", display:"flex", flexDirection:"column", gap:6 }}>
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
    fetch(`${API}/admin/ps/project/${projectId}/overview`, { credentials: "include" })
      .then(r => r.json())
      .then(d => {
        if (d.error) { setError(d.error); setLoading(false); return; }
        setData(d); setLoading(false);
      })
      .catch(e => { setError(e.message); setLoading(false); });
  }, [projectId]);

  if (loading) return <div style={{ textAlign:"center", padding:60, color:"rgba(255,255,255,0.4)" }}>Conectando con PrestaShop…</div>;
  if (error) return (
    <div style={{ padding:24, color:"#f43f5e", background:"rgba(244,63,94,0.08)", borderRadius:10, border:"1px solid rgba(244,63,94,0.2)" }}>
      <div style={{ fontWeight:700, marginBottom:8 }}>⚠️ Error de conexión</div>
      <div style={{ fontSize:13 }}>{error}</div>
      <div style={{ marginTop:12, fontSize:12, color:"rgba(255,255,255,0.35)" }}>
        Verifica que la API key de PrestaShop esté activa y tenga los permisos necesarios (products, categories, orders, images, stock_availables).
      </div>
    </div>
  );
  if (!data) return null;

  return (
    <div style={{ display:"flex", flexDirection:"column", gap:24 }}>
      {/* Estado de conexión */}
      <div style={{ display:"flex", alignItems:"center", gap:12, padding:"14px 18px", background: data.connected ? "rgba(52,211,153,0.06)" : "rgba(244,63,94,0.06)", border:`1px solid ${data.connected ? "rgba(52,211,153,0.2)" : "rgba(244,63,94,0.2)"}`, borderRadius:12 }}>
        <span style={{ fontSize:20 }}>{data.connected ? "✅" : "❌"}</span>
        <div>
          <div style={{ fontWeight:700, color: data.connected ? "#34d399" : "#f43f5e" }}>
            {data.connected ? `Conectado — ${data.storeName}` : "Sin conexión"}
          </div>
          {data.storeUrl && <div style={{ fontSize:12, color:"rgba(255,255,255,0.35)", marginTop:2 }}>{data.storeUrl}</div>}
        </div>
        <div style={{ marginLeft:"auto", display:"flex", gap:8, flexWrap:"wrap" }}>
          {(data.resources ?? []).slice(0, 8).map((r: string) => (
            <span key={r} style={{ background:"rgba(223,0,103,0.12)", border:"1px solid rgba(223,0,103,0.25)", borderRadius:12, padding:"2px 10px", fontSize:11, color:PL }}>
              /{r}
            </span>
          ))}
        </div>
      </div>

      {/* KPIs */}
      <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit, minmax(160px, 1fr))", gap:12 }}>
        <KpiCard label="Productos" value={String(data.productCount)} sub="En catálogo" icon="📦" />
        <KpiCard label="Categorías" value={String(data.categoryCount)} sub="En árbol" icon="🗂️" color={PL} />
        <KpiCard label="Pedidos (recientes)" value={String(data.orderCount)} sub="Últimos cargados" icon="📋" color="#34d399" />
        <KpiCard label="Revenue (recientes)" value={fmt(data.revenue30d)} sub="Suma pedidos cargados" icon="💰" color={PP} />
      </div>

      {/* Últimos pedidos */}
      <div style={{ background:"rgba(255,255,255,0.03)", border:"1px solid rgba(255,255,255,0.07)", borderRadius:12, padding:"18px 20px" }}>
        <h3 style={{ margin:"0 0 16px", fontSize:15, fontWeight:700, color:"rgba(255,255,255,0.9)" }}>Últimos Pedidos</h3>
        <Table
          cols={["Referencia", "Cliente", "Artículos", "Total", "Estado", "Pago", "Fecha"]}
          rows={(data.recentOrders ?? []).map((o: any) => [
            <span style={{ fontFamily:"monospace", color:PL, fontWeight:700 }}>{o.reference}</span>,
            o.customerName,
            <span style={{ color:"rgba(255,255,255,0.5)" }}>{o.itemCount} art.</span>,
            <span style={{ fontWeight:700, color:PP }}>{fmt(o.total, o.currency)}</span>,
            <Badge status={o.status} />,
            <span style={{ fontSize:12, color:"rgba(255,255,255,0.4)" }}>{o.paymentMethod || "—"}</span>,
            <span style={{ fontSize:12, color:"rgba(255,255,255,0.35)" }}>{fmtDateShort(o.date)}</span>,
          ])}
          emptyMsg="No hay pedidos recientes"
        />
      </div>

      {/* Categorías top */}
      {(data.categories ?? []).length > 0 && (
        <div style={{ background:"rgba(255,255,255,0.03)", border:"1px solid rgba(255,255,255,0.07)", borderRadius:12, padding:"18px 20px" }}>
          <h3 style={{ margin:"0 0 14px", fontSize:14, fontWeight:700, color:"rgba(255,255,255,0.8)" }}>🗂️ Categorías principales</h3>
          <div style={{ display:"flex", flexWrap:"wrap", gap:8 }}>
            {(data.categories ?? []).map((c: any) => (
              <span key={c.id} style={{ background:"rgba(223,0,103,0.1)", border:"1px solid rgba(223,0,103,0.2)", borderRadius:20, padding:"4px 14px", fontSize:12, color:PL }}>
                {c.name}
              </span>
            ))}
          </div>
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
  const [expanded, setExpanded] = useState<number | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    fetch(`${API}/admin/ps/project/${projectId}/orders?page=${page}&limit=20`, { credentials: "include" })
      .then(r => r.json())
      .then(d => { setOrders(d.orders ?? []); setLoading(false); })
      .catch(() => setLoading(false));
  }, [projectId, page]);

  useEffect(() => { load(); }, [load]);

  return (
    <div style={{ display:"flex", flexDirection:"column", gap:16 }}>
      {loading ? (
        <div style={{ textAlign:"center", padding:40, color:"rgba(255,255,255,0.4)" }}>Cargando pedidos PrestaShop…</div>
      ) : (
        <div style={{ background:"rgba(255,255,255,0.03)", border:"1px solid rgba(255,255,255,0.07)", borderRadius:12, overflow:"hidden" }}>
          <Table
            cols={["Referencia", "Cliente", "Email", "Artículos", "Envío", "Total", "Estado", "Pago", "Fecha"]}
            rows={orders.map((o: any) => [
              <span style={{ fontFamily:"monospace", color:PL, cursor:"pointer", fontWeight:700 }}
                onClick={() => setExpanded(expanded === o.id ? null : o.id)}>
                {o.reference}
              </span>,
              <div>
                <div style={{ fontWeight:600 }}>{o.customerName}</div>
                {expanded === o.id && (
                  <div style={{ marginTop:10, background:"rgba(255,255,255,0.04)", borderRadius:8, padding:"10px 14px" }}>
                    {(o.items ?? []).map((li: any, i: number) => (
                      <div key={i} style={{ display:"flex", justifyContent:"space-between", fontSize:12, color:"rgba(255,255,255,0.7)", padding:"3px 0" }}>
                        <span>× {li.qty} {li.name}</span>
                        <span style={{ color:PL }}>{fmt(li.price)}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>,
              <span style={{ fontSize:12, color:"rgba(255,255,255,0.4)" }}>{o.email || "—"}</span>,
              <span style={{ color:"rgba(255,255,255,0.5)" }}>{o.itemCount}</span>,
              <span style={{ fontSize:12, color:"rgba(255,255,255,0.4)" }}>{fmt(o.shippingTotal)}</span>,
              <span style={{ fontWeight:700, color:PP }}>{fmt(o.total, o.currency)}</span>,
              <Badge status={o.status} />,
              <span style={{ fontSize:12, color:"rgba(255,255,255,0.4)" }}>{o.paymentMethod || "—"}</span>,
              <span style={{ fontSize:12, color:"rgba(255,255,255,0.35)" }}>{fmtDate(o.date)}</span>,
            ])}
            emptyMsg="No hay pedidos disponibles"
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

  const load = useCallback(() => {
    setLoading(true);
    let url = `${API}/admin/ps/project/${projectId}/products?page=${page}&limit=20`;
    if (search) url += `&search=${encodeURIComponent(search)}`;
    fetch(url, { credentials: "include" })
      .then(r => r.json())
      .then(d => { setProducts(d.products ?? []); setLoading(false); })
      .catch(() => setLoading(false));
  }, [projectId, page, search]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { setPage(1); }, [search]);

  return (
    <div style={{ display:"flex", flexDirection:"column", gap:16 }}>
      <SearchBar value={search} onChange={setSearch} placeholder="Buscar productos…" />
      {loading ? (
        <div style={{ textAlign:"center", padding:40, color:"rgba(255,255,255,0.4)" }}>Cargando catálogo PrestaShop…</div>
      ) : (
        <div style={{ background:"rgba(255,255,255,0.03)", border:"1px solid rgba(255,255,255,0.07)", borderRadius:12, overflow:"hidden" }}>
          <Table
            cols={["Producto", "SKU", "Precio", "Stock", "Estado", "Meta Title", "Fecha"]}
            rows={products.map((p: any) => [
              <div style={{ display:"flex", alignItems:"center", gap:10 }}>
                {(p.images ?? [])[0] && (
                  <img src={p.images[0]} alt="" style={{ width:36, height:36, objectFit:"cover", borderRadius:6, border:"1px solid rgba(255,255,255,0.1)" }} />
                )}
                <div>
                  <div style={{ fontWeight:600 }}>{p.name}</div>
                  <div style={{ fontSize:11, color:"rgba(255,255,255,0.3)" }}>ID: {p.platformId}</div>
                </div>
              </div>,
              <span style={{ fontFamily:"monospace", fontSize:11, color:"rgba(255,255,255,0.4)" }}>{p.sku || "—"}</span>,
              <span style={{ fontWeight:700, color:PP }}>{fmt(p.price)}</span>,
              <span style={{ fontWeight:700, color: p.quantity <= 0 ? "#f43f5e" : p.quantity < 5 ? "#fb923c" : "#34d399" }}>
                {p.quantity}
              </span>,
              p.active
                ? <span style={{ color:"#34d399", fontSize:11, fontWeight:700 }}>✓ Activo</span>
                : <span style={{ color:"rgba(255,255,255,0.3)", fontSize:11 }}>✗ Inactivo</span>,
              <span style={{ fontSize:11, color:"rgba(255,255,255,0.35)", maxWidth:200, display:"block", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>
                {p.metaTitle || "—"}
              </span>,
              <span style={{ fontSize:11, color:"rgba(255,255,255,0.3)" }}>{fmtDateShort(p.date)}</span>,
            ])}
            emptyMsg="No hay productos en el catálogo"
          />
          <Pagination page={page} onPage={setPage} hasMore={products.length === 20} />
        </div>
      )}
    </div>
  );
}

// ─── TAB: Categorías ──────────────────────────────────────────────────────────
function CategoryNode({ node, depth = 0 }: { node: any; depth?: number }) {
  const [open, setOpen] = useState(depth < 2);
  const hasChildren = (node.children ?? []).length > 0;

  return (
    <div style={{ marginLeft: depth * 20 }}>
      <div
        onClick={() => hasChildren && setOpen(!open)}
        style={{
          display:"flex", alignItems:"center", gap:8, padding:"8px 12px",
          background: depth === 0 ? "rgba(255,255,255,0.04)" : "transparent",
          border: depth === 0 ? "1px solid rgba(255,255,255,0.07)" : "none",
          borderRadius:8, marginBottom:3, cursor: hasChildren ? "pointer" : "default",
          color: depth === 0 ? "#fff" : "rgba(255,255,255,0.7)", fontSize: 14 - depth,
        }}>
        {hasChildren ? (open ? "▼" : "▶") : "•"}
        <span style={{ fontWeight: depth === 0 ? 700 : 500 }}>{node.name}</span>
        <span style={{ fontSize:11, color:"rgba(255,255,255,0.3)", marginLeft:"auto" }}>ID: {node.id}</span>
        {hasChildren && (
          <span style={{ fontSize:11, background:"rgba(223,0,103,0.15)", color:PL, padding:"1px 8px", borderRadius:10 }}>
            {(node.children ?? []).length} subcategorías
          </span>
        )}
      </div>
      {open && hasChildren && (
        <div>
          {(node.children ?? []).map((child: any) => (
            <CategoryNode key={child.id} node={child} depth={depth + 1} />
          ))}
        </div>
      )}
    </div>
  );
}

function CategoriesTab({ projectId }: { projectId: string }) {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    fetch(`${API}/admin/ps/project/${projectId}/categories`, { credentials: "include" })
      .then(r => r.json())
      .then(d => { setData(d); setLoading(false); })
      .catch(() => setLoading(false));
  }, [projectId]);

  if (loading) return <div style={{ textAlign:"center", padding:40, color:"rgba(255,255,255,0.4)" }}>Cargando árbol de categorías…</div>;
  if (!data) return null;

  return (
    <div style={{ display:"flex", flexDirection:"column", gap:16 }}>
      <div style={{ display:"flex", alignItems:"center", gap:12, padding:"12px 16px", background:"rgba(223,0,103,0.06)", border:"1px solid rgba(223,0,103,0.15)", borderRadius:10 }}>
        <span style={{ fontSize:20 }}>🗂️</span>
        <span style={{ color:"rgba(255,255,255,0.7)", fontSize:13 }}>
          <strong style={{ color:PL }}>{data.total}</strong> categorías en total — Árbol jerárquico de PrestaShop
        </span>
      </div>
      <div style={{ display:"flex", flexDirection:"column", gap:4 }}>
        {(data.tree ?? []).map((node: any) => (
          <CategoryNode key={node.id} node={node} depth={0} />
        ))}
        {(data.tree ?? []).length === 0 && (
          <div style={{ textAlign:"center", padding:48, color:"rgba(255,255,255,0.3)" }}>
            No se han encontrado categorías. Verifica que el recurso /categories esté habilitado en la API key.
          </div>
        )}
      </div>
    </div>
  );
}

// ─── TAB: Inventario ──────────────────────────────────────────────────────────
function InventoryTab({ projectId }: { projectId: string }) {
  const [inv, setInv] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    fetch(`${API}/admin/ps/project/${projectId}/inventory`, { credentials: "include" })
      .then(r => r.json())
      .then(d => { setInv(d); setLoading(false); })
      .catch(() => setLoading(false));
  }, [projectId]);

  if (loading) return <div style={{ textAlign:"center", padding:40, color:"rgba(255,255,255,0.4)" }}>Cargando inventario PrestaShop…</div>;
  if (!inv) return null;

  return (
    <div style={{ display:"flex", flexDirection:"column", gap:20 }}>
      <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit, minmax(160px, 1fr))", gap:12 }}>
        <KpiCard label="Sin Stock" value={String(inv.outOfStockCount)} sub="Reposición urgente" icon="❌" color="#f43f5e" />
        <KpiCard label="Stock Bajo" value={String(inv.lowStockCount)} sub="Menos de 5 uds." icon="⚠️" color="#fb923c" />
        <KpiCard label="Rastreados" value={String(inv.totalTracked)} sub="Productos analizados" icon="📊" color={PL} />
      </div>

      {inv.outOfStock?.length > 0 && (
        <div style={{ background:"rgba(244,63,94,0.04)", border:"1px solid rgba(244,63,94,0.15)", borderRadius:12, padding:"18px 20px" }}>
          <h3 style={{ margin:"0 0 16px", fontSize:14, fontWeight:700, color:"#f43f5e" }}>❌ Sin Stock ({inv.outOfStockCount})</h3>
          <Table
            cols={["Producto", "SKU", "ID PS", "Stock", "Precio", "Activo"]}
            rows={inv.outOfStock.map((p: any) => [
              p.name,
              <span style={{ fontFamily:"monospace", fontSize:11, color:"rgba(255,255,255,0.4)" }}>{p.sku || "—"}</span>,
              <span style={{ fontFamily:"monospace", fontSize:11, color:"rgba(255,255,255,0.3)" }}>{p.platformId}</span>,
              <span style={{ fontWeight:700, color:"#f43f5e" }}>{p.quantity}</span>,
              fmt(p.price),
              p.active
                ? <span style={{ color:"#34d399", fontSize:11 }}>✓</span>
                : <span style={{ color:"#f43f5e", fontSize:11 }}>✗</span>,
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
            rows={inv.lowStock.map((p: any) => [
              p.name,
              <span style={{ fontFamily:"monospace", fontSize:11, color:"rgba(255,255,255,0.4)" }}>{p.sku || "—"}</span>,
              <span style={{ fontWeight:700, color:"#fb923c" }}>{p.quantity}</span>,
              fmt(p.price),
            ])}
            emptyMsg=""
          />
        </div>
      )}

      {inv.outOfStockCount === 0 && inv.lowStockCount === 0 && (
        <div style={{ textAlign:"center", padding:48, color:"#34d399", fontSize:15 }}>
          ✅ Todo el inventario está en niveles correctos
        </div>
      )}
    </div>
  );
}

// ─── TAB: SEO ─────────────────────────────────────────────────────────────────
function SeoTab({ projectId }: { projectId: string }) {
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editData, setEditData] = useState<{ metaTitle: string; metaDescription: string }>({ metaTitle: "", metaDescription: "" });
  const [seoCache, setSeoCache] = useState<Record<string, any>>({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setLoading(true);
    fetch(`${API}/admin/ps/project/${projectId}/products?page=1&limit=30`, { credentials: "include" })
      .then(r => r.json())
      .then(d => { setProducts(d.products ?? []); setLoading(false); })
      .catch(() => setLoading(false));
  }, [projectId]);

  const loadSeo = async (platformId: string) => {
    if (seoCache[platformId]) {
      const s = seoCache[platformId];
      setEditData({ metaTitle: s.metaTitle ?? "", metaDescription: s.metaDescription ?? "" });
      setEditingId(platformId);
      return;
    }
    const r = await fetch(`${API}/admin/ps/project/${projectId}/seo/${platformId}`, { credentials: "include" });
    const d = await r.json();
    setSeoCache(prev => ({ ...prev, [platformId]: d.seo ?? {} }));
    setEditData({ metaTitle: d.seo?.metaTitle ?? "", metaDescription: d.seo?.metaDescription ?? "" });
    setEditingId(platformId);
  };

  const saveSeo = async () => {
    if (!editingId) return;
    setSaving(true);
    await fetch(`${API}/admin/ps/project/${projectId}/seo/${editingId}`, {
      method: "PUT", credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(editData),
    });
    setSeoCache(prev => ({ ...prev, [editingId]: editData }));
    setSaving(false);
    setEditingId(null);
  };

  return (
    <div style={{ display:"flex", flexDirection:"column", gap:16 }}>
      <div style={{ padding:"12px 16px", background:"rgba(223,0,103,0.06)", border:"1px solid rgba(223,0,103,0.15)", borderRadius:10, fontSize:13, color:"rgba(255,255,255,0.6)" }}>
        🔍 Edita los meta title y meta description de cada producto para mejorar el SEO en PrestaShop.
        Los cambios se escriben directamente vía la API de PrestaShop (XML).
      </div>

      {editingId && (
        <div style={{ background:"rgba(223,0,103,0.1)", border:`1px solid ${PP}`, borderRadius:12, padding:"20px 24px", display:"flex", flexDirection:"column", gap:12 }}>
          <div style={{ fontWeight:700, color:PL, marginBottom:4 }}>✏️ Editando SEO — Producto ID {editingId}</div>
          <div>
            <label style={{ fontSize:11, color:"rgba(255,255,255,0.4)", display:"block", marginBottom:4 }}>
              Meta Title <span style={{ color: editData.metaTitle.length > 60 ? "#f43f5e" : "rgba(255,255,255,0.25)" }}>({editData.metaTitle.length}/60)</span>
            </label>
            <input value={editData.metaTitle} onChange={e => setEditData(p => ({ ...p, metaTitle: e.target.value }))}
              placeholder="Título para buscadores…"
              style={{ width:"100%", background:"rgba(255,255,255,0.06)", border:"1px solid rgba(255,255,255,0.15)", borderRadius:8, padding:"8px 12px", color:"#fff", fontSize:13, outline:"none", boxSizing:"border-box" }} />
          </div>
          <div>
            <label style={{ fontSize:11, color:"rgba(255,255,255,0.4)", display:"block", marginBottom:4 }}>
              Meta Description <span style={{ color: editData.metaDescription.length > 160 ? "#f43f5e" : "rgba(255,255,255,0.25)" }}>({editData.metaDescription.length}/160)</span>
            </label>
            <textarea value={editData.metaDescription} onChange={e => setEditData(p => ({ ...p, metaDescription: e.target.value }))}
              placeholder="Descripción para buscadores…" rows={3}
              style={{ width:"100%", background:"rgba(255,255,255,0.06)", border:"1px solid rgba(255,255,255,0.15)", borderRadius:8, padding:"8px 12px", color:"#fff", fontSize:13, outline:"none", boxSizing:"border-box", resize:"vertical" }} />
          </div>
          <div style={{ display:"flex", gap:8 }}>
            <button onClick={saveSeo} disabled={saving}
              style={{ background:PP, border:"none", borderRadius:8, padding:"8px 20px", color:"#fff", fontWeight:700, cursor:"pointer", opacity: saving ? 0.6 : 1 }}>
              {saving ? "Guardando…" : "Guardar SEO"}
            </button>
            <button onClick={() => setEditingId(null)}
              style={{ background:"rgba(255,255,255,0.07)", border:"1px solid rgba(255,255,255,0.12)", borderRadius:8, padding:"8px 16px", color:"rgba(255,255,255,0.6)", cursor:"pointer" }}>
              Cancelar
            </button>
          </div>
        </div>
      )}

      {loading ? (
        <div style={{ textAlign:"center", padding:40, color:"rgba(255,255,255,0.4)" }}>Cargando productos para SEO…</div>
      ) : (
        <div style={{ background:"rgba(255,255,255,0.03)", border:"1px solid rgba(255,255,255,0.07)", borderRadius:12, overflow:"hidden" }}>
          <Table
            cols={["Producto", "ID", "Meta Title actual", "Stock", "Precio", ""]}
            rows={products.map((p: any) => [
              <div style={{ fontWeight:600 }}>{p.name}</div>,
              <span style={{ fontFamily:"monospace", fontSize:11, color:"rgba(255,255,255,0.3)" }}>{p.platformId}</span>,
              <span style={{ fontSize:11, color: p.metaTitle ? "rgba(255,255,255,0.6)" : "rgba(255,255,255,0.2)", fontStyle: p.metaTitle ? "normal" : "italic" }}>
                {p.metaTitle || "Sin meta title"}
              </span>,
              <span style={{ fontWeight:600, color: p.quantity <= 0 ? "#f43f5e" : "rgba(255,255,255,0.6)" }}>{p.quantity}</span>,
              fmt(p.price),
              <button onClick={() => loadSeo(p.platformId)}
                style={{ background:"rgba(223,0,103,0.15)", border:`1px solid ${PP}40`, borderRadius:6, padding:"4px 10px", color:PL, fontSize:11, cursor:"pointer" }}>
                Editar SEO
              </button>,
            ])}
            emptyMsg="No hay productos disponibles"
          />
        </div>
      )}
    </div>
  );
}

// ─── MAIN HUB ─────────────────────────────────────────────────────────────────
export default function PrestaShopProjectHub() {
  const [, params] = useRoute("/projects/:id/ps-hub");
  const projectId = params?.id ?? "";
  const [tab, setTab] = useState<Tab>("overview");

  const tabs: { id: Tab; label: string; icon: string }[] = [
    { id: "overview",    label: "Overview",    icon: "📊" },
    { id: "orders",      label: "Pedidos",     icon: "📋" },
    { id: "products",    label: "Productos",   icon: "📦" },
    { id: "categories",  label: "Categorías",  icon: "🗂️" },
    { id: "inventory",   label: "Inventario",  icon: "📈" },
    { id: "seo",         label: "SEO",         icon: "🔍" },
  ];

  return (
    <div style={{ minHeight:"100vh", background:"linear-gradient(135deg, #1a0010 0%, #0f000a 50%, #180010 100%)", color:"#fff", fontFamily:"system-ui, sans-serif" }}>
      {/* Header */}
      <div style={{ background:"rgba(223,0,103,0.07)", borderBottom:`1px solid ${PP}30`, padding:"20px 28px" }}>
        <div style={{ display:"flex", alignItems:"center", gap:14 }}>
          <div style={{ width:44, height:44, borderRadius:12, background:`linear-gradient(135deg, ${PD}, ${PP})`, display:"flex", alignItems:"center", justifyContent:"center", fontSize:22, boxShadow:`0 4px 20px ${PP}50` }}>
            🔴
          </div>
          <div>
            <div style={{ fontSize:22, fontWeight:800, color:"#fff" }}>PrestaShop Hub</div>
            <div style={{ fontSize:13, color:"rgba(255,255,255,0.45)", marginTop:2 }}>Panel de gestión — Proyecto #{projectId}</div>
          </div>
          <div style={{ marginLeft:"auto", background:`${PP}22`, border:`1px solid ${PP}50`, borderRadius:20, padding:"4px 16px", fontSize:12, color:PL, fontWeight:700 }}>
            PS Web Services API
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ background:"rgba(0,0,0,0.2)", borderBottom:"1px solid rgba(255,255,255,0.06)", padding:"0 28px", display:"flex", gap:2 }}>
        {tabs.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            style={{
              background: tab === t.id ? `${PP}20` : "transparent",
              border:"none", borderBottom: tab === t.id ? `2px solid ${PP}` : "2px solid transparent",
              color: tab === t.id ? PL : "rgba(255,255,255,0.4)",
              fontWeight: tab === t.id ? 700 : 400,
              padding:"14px 18px", cursor:"pointer", fontSize:13, display:"flex", alignItems:"center", gap:6, transition:"all 0.15s",
            }}>
            {t.icon} {t.label}
          </button>
        ))}
      </div>

      {/* Content */}
      <div style={{ padding:"28px 28px 60px" }}>
        {tab === "overview"   && <OverviewTab    projectId={projectId} />}
        {tab === "orders"     && <OrdersTab      projectId={projectId} />}
        {tab === "products"   && <ProductsTab    projectId={projectId} />}
        {tab === "categories" && <CategoriesTab  projectId={projectId} />}
        {tab === "inventory"  && <InventoryTab   projectId={projectId} />}
        {tab === "seo"        && <SeoTab         projectId={projectId} />}
      </div>
    </div>
  );
}
