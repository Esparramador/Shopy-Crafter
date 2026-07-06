import { useState, useEffect, useCallback } from "react";
import { useRoute } from "wouter";

type Tab = "overview" | "transactions" | "customers" | "subscriptions" | "products" | "invoices" | "payouts" | "acciones";

const SP = "#635bff";
const SL = "#897eff";
const SA = "#a78bfa";

const fmt = (amount: number, currency = "eur") =>
  new Intl.NumberFormat("es-ES", { style: "currency", currency: currency.toUpperCase(), minimumFractionDigits: 2 }).format(amount / 100);

const fmtDate = (ts: number) =>
  new Date(ts * 1000).toLocaleDateString("es-ES", { day: "2-digit", month: "short", year: "numeric" });

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { bg: string; color: string; label: string }> = {
    succeeded:  { bg: "rgba(52,211,153,0.12)", color: "#34d399", label: "✓ Exitoso" },
    success:    { bg: "rgba(52,211,153,0.12)", color: "#34d399", label: "✓ Exitoso" },
    paid:       { bg: "rgba(52,211,153,0.12)", color: "#34d399", label: "✓ Pagado" },
    active:     { bg: "rgba(52,211,153,0.12)", color: "#34d399", label: "● Activo" },
    trialing:   { bg: "rgba(99,91,255,0.15)",  color: SL,        label: "◈ Trial" },
    pending:    { bg: "rgba(251,191,36,0.12)", color: "#fbbf24", label: "⏳ Pendiente" },
    open:       { bg: "rgba(251,191,36,0.12)", color: "#fbbf24", label: "◎ Abierta" },
    in_transit: { bg: "rgba(251,191,36,0.12)", color: "#fbbf24", label: "→ En tránsito" },
    failed:     { bg: "rgba(244,63,94,0.12)",  color: "#f43f5e", label: "✗ Fallido" },
    canceled:   { bg: "rgba(244,63,94,0.12)",  color: "#f43f5e", label: "✗ Cancelado" },
    void:       { bg: "rgba(244,63,94,0.12)",  color: "#f43f5e", label: "✗ Anulada" },
    past_due:   { bg: "rgba(251,146,60,0.12)", color: "#fb923c", label: "⚠ Vencido" },
    refunded:   { bg: "rgba(156,163,175,0.12)",color: "#9ca3af", label: "↩ Devuelto" },
    incomplete: { bg: "rgba(251,146,60,0.12)", color: "#fb923c", label: "⚡ Incompleto" },
    paid_out:   { bg: "rgba(52,211,153,0.12)", color: "#34d399", label: "✓ Liquidado" },
  };
  const s = map[status] ?? { bg: "rgba(255,255,255,0.06)", color: "rgba(255,255,255,0.5)", label: status };
  return (
    <span style={{ display:"inline-block", padding:"2px 10px", borderRadius:100, fontSize:11, fontWeight:700, background:s.bg, color:s.color, whiteSpace:"nowrap" }}>
      {s.label}
    </span>
  );
}

function MiniChart({ data, color = SP }: { data: Array<{ amount: number }>; color?: string }) {
  if (!data || data.length < 2) return <div style={{ height:56, display:"flex", alignItems:"center", justifyContent:"center", color:"rgba(255,255,255,0.2)", fontSize:11 }}>Sin datos</div>;
  const max = Math.max(...data.map(d => d.amount), 1);
  const W = 100, H = 56;
  const pts = data.map((d, i) => `${(i / (data.length - 1)) * W},${H - (d.amount / max) * (H - 6) - 3}`).join(" ");
  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width:"100%", height:H, overflow:"visible" }}>
      <defs>
        <linearGradient id="sg" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.3" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <polygon points={`0,${H} ${pts} ${W},${H}`} fill="url(#sg)" />
      <polyline points={pts} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function TrendBadge({ value }: { value: number }) {
  const up = value >= 0;
  return (
    <span style={{ display:"inline-flex", alignItems:"center", gap:3, fontSize:11, fontWeight:700, padding:"2px 8px", borderRadius:100, background: up ? "rgba(52,211,153,0.12)" : "rgba(244,63,94,0.12)", color: up ? "#34d399" : "#f43f5e" }}>
      {up ? "↑" : "↓"} {Math.abs(value).toFixed(1)}%
    </span>
  );
}

const S: Record<string, React.CSSProperties> = {
  page:  { padding:"28px 32px", maxWidth:1280, margin:"0 auto", color:"#f0ede6", fontFamily:"'Inter',sans-serif" },
  card:  { background:"rgba(255,255,255,0.04)", border:"1px solid rgba(255,255,255,0.08)", borderRadius:14, padding:"20px 24px" },
  kcard: { background:"rgba(99,91,255,0.08)", border:"1px solid rgba(99,91,255,0.2)", borderRadius:14, padding:"20px 24px" },
  tabs:  { display:"flex", gap:3, padding:"4px", background:"rgba(255,255,255,0.03)", borderRadius:12, marginBottom:24 },
  tab:   { padding:"8px 16px", borderRadius:9, border:"none", cursor:"pointer", fontSize:13, fontWeight:500, color:"rgba(240,237,230,0.55)", background:"transparent", transition:"all .15s" },
  tabA:  { background:`rgba(99,91,255,0.18)`, color:SP, fontWeight:700 },
  th:    { padding:"10px 14px", textAlign:"left" as const, fontSize:11, color:"rgba(240,237,230,0.4)", textTransform:"uppercase" as const, letterSpacing:"0.07em", borderBottom:"1px solid rgba(255,255,255,0.06)", fontWeight:700 },
  td:    { padding:"13px 14px", borderBottom:"1px solid rgba(255,255,255,0.04)", color:"#f0ede6", fontSize:13 },
  inp:   { background:"rgba(255,255,255,0.06)", border:"1px solid rgba(255,255,255,0.12)", borderRadius:9, color:"#f0ede6", padding:"9px 13px", fontSize:13, width:"100%", boxSizing:"border-box" as const },
  sel:   { background:"rgba(255,255,255,0.06)", border:"1px solid rgba(255,255,255,0.12)", borderRadius:9, color:"#f0ede6", padding:"9px 13px", fontSize:13, cursor:"pointer" },
  lbl:   { fontSize:11, color:"rgba(240,237,230,0.5)", marginBottom:5, display:"block", textTransform:"uppercase" as const, letterSpacing:"0.06em" },
  btn:   { padding:"9px 20px", borderRadius:9, border:"none", cursor:"pointer", fontSize:13, fontWeight:700, transition:"opacity .15s" },
  btnP:  { background:`linear-gradient(135deg,${SP},${SL})`, color:"#fff", boxShadow:`0 4px 18px ${SP}45` },
  btnG:  { background:"rgba(255,255,255,0.07)", color:"#f0ede6", border:"1px solid rgba(255,255,255,0.12)" },
  btnD:  { background:"rgba(244,63,94,0.1)", color:"#f43f5e", border:"1px solid rgba(244,63,94,0.2)" },
  btnSm: { padding:"5px 13px", fontSize:12 },
  grid4: { display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:16, marginBottom:24 },
  grid2: { display:"grid", gridTemplateColumns:"1fr 1fr", gap:16 },
  grid3: { display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:16 },
  empty: { textAlign:"center" as const, padding:"64px 20px", color:"rgba(240,237,230,0.3)" },
  err:   { background:"rgba(244,63,94,0.08)", border:"1px solid rgba(244,63,94,0.2)", borderRadius:10, padding:"12px 18px", fontSize:13, color:"#f87171", marginBottom:16 },
  ok:    { background:"rgba(52,211,153,0.08)", border:"1px solid rgba(52,211,153,0.2)", borderRadius:10, padding:"12px 18px", fontSize:13, color:"#34d399", marginBottom:16 },
};

const TABS: { id: Tab; label: string; icon: string }[] = [
  { id:"overview",       label:"Overview",       icon:"📊" },
  { id:"transactions",   label:"Transacciones",  icon:"⚡" },
  { id:"customers",      label:"Clientes",       icon:"👥" },
  { id:"subscriptions",  label:"Suscripciones",  icon:"🔁" },
  { id:"products",       label:"Productos",      icon:"📦" },
  { id:"invoices",       label:"Facturas",       icon:"📄" },
  { id:"payouts",        label:"Payouts",        icon:"💸" },
  { id:"acciones",       label:"Acciones",       icon:"🛠️" },
];

export default function StripeProjectHub() {
  const [, params] = useRoute<{ id: string }>("/projects/:id/stripe-hub");
  const projectId = parseInt(params?.id ?? "0", 10);
  const API = import.meta.env.BASE_URL.replace(/\/$/, "") + "/api";

  const [tab, setTab] = useState<Tab>("overview");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");
  const [msg, setMsg] = useState("");
  const [actionLoading, setActionLoading] = useState(false);
  const [actionResult, setActionResult] = useState<any>(null);

  const [overview, setOverview] = useState<any>(null);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [customers, setCustomers] = useState<any[]>([]);
  const [subscriptions, setSubscriptions] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [invoices, setInvoices] = useState<any[]>([]);
  const [payouts, setPayouts] = useState<any[]>([]);
  const [balance, setBalance] = useState<any>(null);

  const [customerForm, setCustomerForm] = useState({ email:"", name:"", phone:"", description:"" });
  const [invoiceForm, setInvoiceForm] = useState({ customerId:"", description:"", amount:"", currency:"eur", daysUntilDue:"30", autoSend:false });
  const [productForm, setProductForm] = useState({ name:"", description:"", amount:"", currency:"eur", interval:"" });
  const [chargeForm, setChargeForm] = useState({ amount:"", currency:"eur", description:"", customerEmail:"" });
  const [refundForm, setRefundForm] = useState({ chargeId:"", amount:"", reason:"requested_by_customer" });

  const apiFetch = useCallback((path: string, opts?: RequestInit) =>
    fetch(`${API}${path}`, { credentials:"include", ...opts }), [API]);

  useEffect(() => {
    if (!projectId) return;
    setErr(""); setMsg("");
    setLoading(true);
    const base = `/admin/stripe/project/${projectId}`;
    const fetchers: Record<Tab, () => Promise<void>> = {
      overview: () => apiFetch(`${base}/overview`).then(r => r.json()).then(setOverview),
      transactions: () => apiFetch(`${base}/transactions?limit=50`).then(r => r.json()).then(d => setTransactions(d.data ?? [])),
      customers: () => apiFetch(`${base}/customers?limit=50`).then(r => r.json()).then(d => setCustomers(d.data ?? [])),
      subscriptions: () => apiFetch(`${base}/subscriptions?limit=50`).then(r => r.json()).then(d => setSubscriptions(d.data ?? [])),
      products: () => apiFetch(`${base}/products`).then(r => r.json()).then(d => setProducts(d.data ?? [])),
      invoices: () => apiFetch(`${base}/invoices?limit=50`).then(r => r.json()).then(d => setInvoices(d.data ?? [])),
      payouts: () => apiFetch(`${base}/payouts`).then(r => r.json()).then(d => { setPayouts(d.data ?? []); setBalance(d.balance ?? null); }),
      acciones: async () => {},
    };
    fetchers[tab]()
      .catch(() => setErr(`Error cargando ${tab}`))
      .finally(() => setLoading(false));
  }, [tab, projectId]);

  const mode = overview?.mode;

  async function handleCreateCustomer() {
    if (!customerForm.email) { setErr("Email requerido"); return; }
    setActionLoading(true); setErr(""); setActionResult(null);
    try {
      const r = await apiFetch(`/admin/stripe/project/${projectId}/customers`, {
        method:"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify(customerForm),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error);
      setActionResult(d.customer);
      setMsg(`✓ Cliente creado: ${d.customer.email}`);
      setCustomerForm({ email:"", name:"", phone:"", description:"" });
    } catch(e:any) { setErr(e.message); }
    finally { setActionLoading(false); }
  }

  async function handleCreateInvoice() {
    if (!invoiceForm.customerId || !invoiceForm.amount) { setErr("Customer ID y Amount requeridos"); return; }
    setActionLoading(true); setErr(""); setActionResult(null);
    try {
      const r = await apiFetch(`/admin/stripe/project/${projectId}/invoices`, {
        method:"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify(invoiceForm),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error);
      setActionResult(d.invoice);
      setMsg(`✓ Factura creada: ${d.invoice.number ?? d.invoice.id}`);
      setInvoiceForm({ customerId:"", description:"", amount:"", currency:"eur", daysUntilDue:"30", autoSend:false });
    } catch(e:any) { setErr(e.message); }
    finally { setActionLoading(false); }
  }

  async function handleCreateProduct() {
    if (!productForm.name || !productForm.amount) { setErr("Nombre y precio requeridos"); return; }
    setActionLoading(true); setErr(""); setActionResult(null);
    try {
      const r = await apiFetch(`/admin/stripe/project/${projectId}/products`, {
        method:"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify(productForm),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error);
      setActionResult(d);
      setMsg(`✓ Producto creado: ${d.product.name}`);
      setProductForm({ name:"", description:"", amount:"", currency:"eur", interval:"" });
    } catch(e:any) { setErr(e.message); }
    finally { setActionLoading(false); }
  }

  async function handleRefund() {
    if (!refundForm.chargeId) { setErr("Charge ID requerido"); return; }
    setActionLoading(true); setErr(""); setActionResult(null);
    try {
      const r = await apiFetch(`/admin/stripe/project/${projectId}/refunds`, {
        method:"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify(refundForm),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error);
      setActionResult(d.refund);
      setMsg(`✓ Devolución procesada: ${d.refund.id}`);
      setRefundForm({ chargeId:"", amount:"", reason:"requested_by_customer" });
    } catch(e:any) { setErr(e.message); }
    finally { setActionLoading(false); }
  }

  async function handleCancelSub(subId: string) {
    if (!confirm("¿Cancelar esta suscripción?")) return;
    try {
      const r = await apiFetch(`/admin/stripe/project/${projectId}/subscriptions/${subId}`, { method:"DELETE" });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error);
      setSubscriptions(prev => prev.map(s => s.id === subId ? { ...s, status:"canceled" } : s));
      setMsg("✓ Suscripción cancelada");
    } catch(e:any) { setErr((e as any).message); }
  }

  async function handleSendInvoice(invId: string) {
    try {
      const r = await apiFetch(`/admin/stripe/project/${projectId}/invoices/${invId}/send`, { method:"POST" });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error);
      setMsg("✓ Factura enviada al cliente");
    } catch(e:any) { setErr((e as any).message); }
  }

  async function handleVoidInvoice(invId: string) {
    if (!confirm("¿Anular esta factura?")) return;
    try {
      const r = await apiFetch(`/admin/stripe/project/${projectId}/invoices/${invId}/void`, { method:"POST" });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error);
      setInvoices(prev => prev.map(i => i.id === invId ? { ...i, status:"void" } : i));
      setMsg("✓ Factura anulada");
    } catch(e:any) { setErr((e as any).message); }
  }

  return (
    <div style={S.page}>
      <style>{`
        @keyframes sh-in{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:none}}
        .sh-card{animation:sh-in .35s ease both}
        .sh-row:hover{background:rgba(99,91,255,0.06)!important}
        .sh-tab:hover{background:rgba(99,91,255,0.1)!important;color:${SL}!important}
        .sh-btn:hover{opacity:0.85}
        .sh-kcard:hover{transform:translateY(-2px);box-shadow:0 12px 36px rgba(99,91,255,0.2)}
        .sh-kcard{transition:transform .2s,box-shadow .2s}
      `}</style>

      {/* ── HEADER ── */}
      <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:24 }}>
        <div style={{ display:"flex", alignItems:"center", gap:14 }}>
          <div style={{ width:46, height:46, borderRadius:13, background:`linear-gradient(135deg,${SP},${SL})`, display:"flex", alignItems:"center", justifyContent:"center", fontSize:24, boxShadow:`0 4px 20px ${SP}50` }}>💳</div>
          <div>
            <h1 style={{ margin:0, fontSize:22, fontWeight:800, color:"#fff" }}>Stripe Project Hub</h1>
            <div style={{ display:"flex", alignItems:"center", gap:8, marginTop:3 }}>
              <span style={{ fontSize:12, color:"rgba(240,237,230,0.5)" }}>Gestión completa de la cuenta Stripe del cliente</span>
              {mode && (
                <span style={{ fontSize:10, fontWeight:800, padding:"2px 8px", borderRadius:100, background: mode==="live" ? "rgba(52,211,153,0.12)" : "rgba(251,191,36,0.12)", color: mode==="live" ? "#34d399" : "#fbbf24", border:`1px solid ${mode==="live" ? "rgba(52,211,153,0.25)" : "rgba(251,191,36,0.25)"}`, textTransform:"uppercase", letterSpacing:"0.07em" }}>
                  {mode}
                </span>
              )}
            </div>
          </div>
        </div>
        <button className="sh-btn" style={{ ...S.btn, ...S.btnG, ...S.btnSm }} onClick={() => { setLoading(true); setTab(t => t); }}>
          ↻ Actualizar
        </button>
      </div>

      {/* ── ALERTS ── */}
      {err && <div style={S.err}>{err} <button onClick={() => setErr("")} style={{ float:"right", background:"none", border:"none", color:"inherit", cursor:"pointer", fontSize:14 }}>✕</button></div>}
      {msg && <div style={S.ok}>{msg} <button onClick={() => setMsg("")} style={{ float:"right", background:"none", border:"none", color:"inherit", cursor:"pointer", fontSize:14 }}>✕</button></div>}

      {/* ── TAB NAV ── */}
      <div style={S.tabs}>
        {TABS.map(t => (
          <button key={t.id} className="sh-tab" onClick={() => setTab(t.id)}
            style={{ ...S.tab, ...(tab === t.id ? S.tabA : {}) }}>
            {t.icon} {t.label}
          </button>
        ))}
      </div>

      {loading && (
        <div style={{ display:"flex", alignItems:"center", justifyContent:"center", padding:"60px 0", color:"rgba(255,255,255,0.3)" }}>
          <div style={{ width:32, height:32, border:`2px solid rgba(99,91,255,0.3)`, borderTopColor:SP, borderRadius:"50%", animation:"spin 0.7s linear infinite", marginRight:12 }} />
          Cargando datos Stripe...
        </div>
      )}

      {/* ══ OVERVIEW ══════════════════════════════════════════════════════════ */}
      {!loading && tab === "overview" && overview && (
        <div className="sh-card">
          {/* KPI Grid */}
          <div style={S.grid4}>
            {[
              { label:"Volumen 30d",    value:fmt(overview.volume30 ?? 0, overview.balance?.currency), icon:"💰", color:SP, trend:overview.trend },
              { label:"Transacciones",  value:String(overview.count30 ?? 0),                           icon:"⚡", color:SL },
              { label:"Ticket Medio",   value:fmt(overview.aov ?? 0, overview.balance?.currency),      icon:"📊", color:SA },
              { label:"Suscripciones",  value:String(overview.activeSubCount ?? 0),                    icon:"🔁", color:"#34d399" },
            ].map(kpi => (
              <div key={kpi.label} className="sh-kcard" style={{ ...S.kcard }}>
                <div style={{ fontSize:22, marginBottom:8 }}>{kpi.icon}</div>
                <div style={{ fontSize:11, color:"rgba(240,237,230,0.45)", textTransform:"uppercase", letterSpacing:"0.08em", marginBottom:4 }}>{kpi.label}</div>
                <div style={{ fontSize:26, fontWeight:800, color:"#fff" }}>{kpi.value}</div>
                {kpi.trend !== undefined && <div style={{ marginTop:6 }}><TrendBadge value={kpi.trend} /></div>}
              </div>
            ))}
          </div>

          <div style={S.grid2}>
            {/* Revenue Chart */}
            <div style={S.card}>
              <div style={{ fontSize:13, fontWeight:700, color:"rgba(240,237,230,0.7)", marginBottom:12 }}>📈 Volumen diario (30 días)</div>
              <MiniChart data={overview.dailyChart ?? []} color={SP} />
            </div>
            {/* Balance */}
            <div style={S.card}>
              <div style={{ fontSize:13, fontWeight:700, color:"rgba(240,237,230,0.7)", marginBottom:16 }}>💳 Balance de la cuenta</div>
              {overview.balance ? (
                <div style={{ display:"flex", flexDirection:"column", gap:12 }}>
                  {[
                    { label:"Disponible",  value:fmt(overview.balance.available, overview.balance.currency), color:"#34d399" },
                    { label:"Pendiente",   value:fmt(overview.balance.pending,   overview.balance.currency), color:"#fbbf24" },
                    { label:"MRR (est.)",  value:fmt(overview.mrr ?? 0, overview.balance.currency),          color:SL },
                  ].map(row => (
                    <div key={row.label} style={{ display:"flex", justifyContent:"space-between", alignItems:"center", padding:"10px 14px", background:"rgba(255,255,255,0.03)", borderRadius:9 }}>
                      <span style={{ fontSize:13, color:"rgba(240,237,230,0.6)" }}>{row.label}</span>
                      <span style={{ fontSize:16, fontWeight:800, color:row.color }}>{row.value}</span>
                    </div>
                  ))}
                </div>
              ) : <div style={{ color:"rgba(255,255,255,0.3)", fontSize:13 }}>Sin balance disponible</div>}
            </div>
          </div>

          {/* Recent charges */}
          {(overview.recentCharges ?? []).length > 0 && (
            <div style={{ marginTop:20 }}>
              <div style={{ fontSize:13, fontWeight:700, color:"rgba(240,237,230,0.7)", marginBottom:12 }}>⚡ Últimos pagos</div>
              <table style={{ width:"100%", borderCollapse:"collapse" as const }}>
                <thead>
                  <tr>
                    {["ID","Importe","Estado","Descripción","Fecha"].map(h => <th key={h} style={S.th}>{h}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {overview.recentCharges.map((c: any) => (
                    <tr key={c.id} className="sh-row">
                      <td style={S.td}><code style={{ fontSize:11, color:"rgba(255,255,255,0.4)" }}>{c.id.slice(0,20)}…</code></td>
                      <td style={{ ...S.td, fontWeight:700, color:SP }}>{fmt(c.amount, c.currency)}</td>
                      <td style={S.td}><StatusBadge status={c.status} /></td>
                      <td style={{ ...S.td, color:"rgba(240,237,230,0.6)" }}>{c.description ?? "—"}</td>
                      <td style={{ ...S.td, color:"rgba(240,237,230,0.45)", fontSize:12 }}>{fmtDate(c.created)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ══ TRANSACTIONS ══════════════════════════════════════════════════════ */}
      {!loading && tab === "transactions" && (
        <div className="sh-card" style={S.card}>
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:16 }}>
            <div style={{ fontWeight:700, fontSize:15 }}>⚡ Transacciones ({transactions.length})</div>
          </div>
          {transactions.length === 0 ? <div style={S.empty}>Sin transacciones</div> : (
            <table style={{ width:"100%", borderCollapse:"collapse" as const }}>
              <thead><tr>{["ID","Importe","Estado","Método","Descripción","Email","Fecha"].map(h => <th key={h} style={S.th}>{h}</th>)}</tr></thead>
              <tbody>
                {transactions.map(c => (
                  <tr key={c.id} className="sh-row">
                    <td style={S.td}><code style={{ fontSize:11, color:"rgba(255,255,255,0.35)" }}>{c.id.slice(0,18)}…</code></td>
                    <td style={{ ...S.td, fontWeight:800, color: c.refunded ? "#9ca3af" : SP }}>{fmt(c.amount, c.currency)}{c.refunded ? " ↩" : ""}</td>
                    <td style={S.td}><StatusBadge status={c.status} /></td>
                    <td style={{ ...S.td, fontSize:12, color:"rgba(255,255,255,0.45)" }}>{c.paymentMethod}</td>
                    <td style={{ ...S.td, color:"rgba(240,237,230,0.6)" }}>{c.description ?? "—"}</td>
                    <td style={{ ...S.td, fontSize:12, color:"rgba(240,237,230,0.5)" }}>{c.receiptEmail ?? "—"}</td>
                    <td style={{ ...S.td, fontSize:12, color:"rgba(240,237,230,0.4)" }}>{fmtDate(c.created)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* ══ CUSTOMERS ═════════════════════════════════════════════════════════ */}
      {!loading && tab === "customers" && (
        <div>
          <div style={{ ...S.card, marginBottom:16 }}>
            <div style={{ fontWeight:700, fontSize:14, marginBottom:14, color:SL }}>➕ Nuevo cliente</div>
            <div style={S.grid2}>
              {[
                { key:"email",       label:"Email *",       type:"email" },
                { key:"name",        label:"Nombre",        type:"text" },
                { key:"phone",       label:"Teléfono",      type:"tel" },
                { key:"description", label:"Descripción",   type:"text" },
              ].map(f => (
                <div key={f.key}>
                  <label style={S.lbl}>{f.label}</label>
                  <input type={f.type} style={S.inp} value={(customerForm as any)[f.key]}
                    onChange={e => setCustomerForm(p => ({ ...p, [f.key]:e.target.value }))} />
                </div>
              ))}
            </div>
            <button className="sh-btn" style={{ ...S.btn, ...S.btnP, marginTop:14 }} onClick={handleCreateCustomer} disabled={actionLoading}>
              {actionLoading ? "Creando…" : "Crear cliente"}
            </button>
          </div>

          <div className="sh-card" style={S.card}>
            <div style={{ fontWeight:700, fontSize:15, marginBottom:14 }}>👥 Clientes ({customers.length})</div>
            {customers.length === 0 ? <div style={S.empty}>Sin clientes</div> : (
              <table style={{ width:"100%", borderCollapse:"collapse" as const }}>
                <thead><tr>{["Email","Nombre","Suscripciones","Balance","Creado"].map(h => <th key={h} style={S.th}>{h}</th>)}</tr></thead>
                <tbody>
                  {customers.map(c => (
                    <tr key={c.id} className="sh-row">
                      <td style={{ ...S.td, fontWeight:600, color:"#a5b4fc" }}>{c.email ?? "—"}</td>
                      <td style={S.td}>{c.name ?? "—"}</td>
                      <td style={{ ...S.td, textAlign:"center" as const }}>
                        <span style={{ fontSize:12, padding:"2px 9px", borderRadius:100, background:"rgba(99,91,255,0.12)", color:SL, fontWeight:700 }}>
                          {c.subscriptionCount}
                        </span>
                      </td>
                      <td style={{ ...S.td, color: c.balance < 0 ? "#f43f5e" : "rgba(240,237,230,0.6)" }}>
                        {c.balance !== 0 ? fmt(c.balance, c.currency ?? "eur") : "—"}
                      </td>
                      <td style={{ ...S.td, fontSize:12, color:"rgba(240,237,230,0.4)" }}>{fmtDate(c.created)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      {/* ══ SUBSCRIPTIONS ═════════════════════════════════════════════════════ */}
      {!loading && tab === "subscriptions" && (
        <div className="sh-card" style={S.card}>
          <div style={{ fontWeight:700, fontSize:15, marginBottom:14 }}>🔁 Suscripciones ({subscriptions.length})</div>
          {subscriptions.length === 0 ? <div style={S.empty}>Sin suscripciones</div> : (
            <table style={{ width:"100%", borderCollapse:"collapse" as const }}>
              <thead><tr>{["Cliente","Producto","Precio","Estado","Próximo cobro","Acciones"].map(h => <th key={h} style={S.th}>{h}</th>)}</tr></thead>
              <tbody>
                {subscriptions.map(s => (
                  <tr key={s.id} className="sh-row">
                    <td style={{ ...S.td }}>
                      <div style={{ fontSize:13, color:"#a5b4fc" }}>{s.customer?.email ?? "—"}</div>
                      <div style={{ fontSize:11, color:"rgba(255,255,255,0.3)" }}>{s.customer?.name ?? ""}</div>
                    </td>
                    <td style={{ ...S.td, fontWeight:600 }}>{s.productName}</td>
                    <td style={{ ...S.td, color:SP, fontWeight:700 }}>
                      {fmt(s.priceAmount, s.priceCurrency)} / {s.priceInterval}
                    </td>
                    <td style={S.td}><StatusBadge status={s.status} /></td>
                    <td style={{ ...S.td, fontSize:12, color:"rgba(240,237,230,0.5)" }}>
                      {s.cancelAtPeriodEnd
                        ? <span style={{ color:"#fb923c" }}>Cancela {fmtDate(s.currentPeriodEnd)}</span>
                        : fmtDate(s.currentPeriodEnd)}
                    </td>
                    <td style={S.td}>
                      {s.status !== "canceled" && (
                        <button className="sh-btn" style={{ ...S.btn, ...S.btnD, ...S.btnSm }} onClick={() => handleCancelSub(s.id)}>
                          Cancelar
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* ══ PRODUCTS ══════════════════════════════════════════════════════════ */}
      {!loading && tab === "products" && (
        <div>
          <div style={{ ...S.card, marginBottom:16 }}>
            <div style={{ fontWeight:700, fontSize:14, marginBottom:14, color:SL }}>➕ Nuevo producto</div>
            <div style={S.grid2}>
              <div>
                <label style={S.lbl}>Nombre *</label>
                <input style={S.inp} value={productForm.name} onChange={e => setProductForm(p => ({ ...p, name:e.target.value }))} />
              </div>
              <div>
                <label style={S.lbl}>Descripción</label>
                <input style={S.inp} value={productForm.description} onChange={e => setProductForm(p => ({ ...p, description:e.target.value }))} />
              </div>
              <div>
                <label style={S.lbl}>Precio * (ej: 29.99)</label>
                <input type="number" style={S.inp} value={productForm.amount} onChange={e => setProductForm(p => ({ ...p, amount:e.target.value }))} />
              </div>
              <div>
                <label style={S.lbl}>Moneda</label>
                <select style={S.sel} value={productForm.currency} onChange={e => setProductForm(p => ({ ...p, currency:e.target.value }))}>
                  {["eur","usd","gbp","mxn","cop","ars"].map(c => <option key={c} value={c}>{c.toUpperCase()}</option>)}
                </select>
              </div>
              <div>
                <label style={S.lbl}>Recurrencia (vacío = pago único)</label>
                <select style={S.sel} value={productForm.interval} onChange={e => setProductForm(p => ({ ...p, interval:e.target.value }))}>
                  <option value="">Pago único</option>
                  <option value="day">Diario</option>
                  <option value="week">Semanal</option>
                  <option value="month">Mensual</option>
                  <option value="year">Anual</option>
                </select>
              </div>
            </div>
            <button className="sh-btn" style={{ ...S.btn, ...S.btnP, marginTop:14 }} onClick={handleCreateProduct} disabled={actionLoading}>
              {actionLoading ? "Creando…" : "Crear producto"}
            </button>
          </div>

          <div className="sh-card" style={S.card}>
            <div style={{ fontWeight:700, fontSize:15, marginBottom:14 }}>📦 Productos activos ({products.length})</div>
            {products.length === 0 ? <div style={S.empty}>Sin productos</div> : (
              <div style={{ display:"flex", flexDirection:"column", gap:12 }}>
                {products.map(p => (
                  <div key={p.id} style={{ background:"rgba(255,255,255,0.03)", border:"1px solid rgba(255,255,255,0.07)", borderRadius:12, padding:"14px 18px" }}>
                    <div style={{ display:"flex", justifyContent:"space-between", alignItems:"start" }}>
                      <div>
                        <div style={{ fontWeight:700, fontSize:14 }}>{p.name}</div>
                        {p.description && <div style={{ fontSize:12, color:"rgba(240,237,230,0.5)", marginTop:2 }}>{p.description}</div>}
                      </div>
                      <div style={{ display:"flex", gap:8, flexWrap:"wrap" as const }}>
                        {(p.prices ?? []).map((pr: any) => (
                          <span key={pr.id} style={{ fontSize:12, padding:"3px 10px", borderRadius:100, background:"rgba(99,91,255,0.12)", color:SL, fontWeight:700 }}>
                            {fmt(pr.unitAmount, pr.currency)}{pr.interval ? ` / ${pr.interval}` : " único"}
                          </span>
                        ))}
                      </div>
                    </div>
                    <div style={{ marginTop:6, fontSize:11, color:"rgba(255,255,255,0.25)" }}>{p.id}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ══ INVOICES ══════════════════════════════════════════════════════════ */}
      {!loading && tab === "invoices" && (
        <div>
          <div style={{ ...S.card, marginBottom:16 }}>
            <div style={{ fontWeight:700, fontSize:14, marginBottom:14, color:SL }}>➕ Nueva factura</div>
            <div style={S.grid2}>
              <div>
                <label style={S.lbl}>Customer ID (cus_xxx) *</label>
                <input style={S.inp} value={invoiceForm.customerId} onChange={e => setInvoiceForm(p => ({ ...p, customerId:e.target.value }))} placeholder="cus_…" />
              </div>
              <div>
                <label style={S.lbl}>Descripción</label>
                <input style={S.inp} value={invoiceForm.description} onChange={e => setInvoiceForm(p => ({ ...p, description:e.target.value }))} />
              </div>
              <div>
                <label style={S.lbl}>Importe * (ej: 150.00)</label>
                <input type="number" style={S.inp} value={invoiceForm.amount} onChange={e => setInvoiceForm(p => ({ ...p, amount:e.target.value }))} />
              </div>
              <div>
                <label style={S.lbl}>Moneda</label>
                <select style={S.sel} value={invoiceForm.currency} onChange={e => setInvoiceForm(p => ({ ...p, currency:e.target.value }))}>
                  {["eur","usd","gbp","mxn"].map(c => <option key={c} value={c}>{c.toUpperCase()}</option>)}
                </select>
              </div>
              <div>
                <label style={S.lbl}>Días hasta vencimiento</label>
                <input type="number" style={S.inp} value={invoiceForm.daysUntilDue} onChange={e => setInvoiceForm(p => ({ ...p, daysUntilDue:e.target.value }))} />
              </div>
              <div style={{ display:"flex", alignItems:"center", gap:10, paddingTop:24 }}>
                <input type="checkbox" id="auto-send" checked={invoiceForm.autoSend} onChange={e => setInvoiceForm(p => ({ ...p, autoSend:e.target.checked }))} />
                <label htmlFor="auto-send" style={{ fontSize:13, color:"rgba(240,237,230,0.7)", cursor:"pointer" }}>Enviar automáticamente al cliente</label>
              </div>
            </div>
            <button className="sh-btn" style={{ ...S.btn, ...S.btnP, marginTop:14 }} onClick={handleCreateInvoice} disabled={actionLoading}>
              {actionLoading ? "Creando…" : "Crear factura"}
            </button>
          </div>

          <div className="sh-card" style={S.card}>
            <div style={{ fontWeight:700, fontSize:15, marginBottom:14 }}>📄 Facturas ({invoices.length})</div>
            {invoices.length === 0 ? <div style={S.empty}>Sin facturas</div> : (
              <table style={{ width:"100%", borderCollapse:"collapse" as const }}>
                <thead><tr>{["Número","Cliente","Importe","Estado","Vence","Acciones"].map(h => <th key={h} style={S.th}>{h}</th>)}</tr></thead>
                <tbody>
                  {invoices.map(inv => (
                    <tr key={inv.id} className="sh-row">
                      <td style={{ ...S.td, fontWeight:700, color:SP }}>{inv.number ?? inv.id.slice(0,14)}</td>
                      <td style={S.td}>
                        <div style={{ fontSize:13 }}>{inv.customerName ?? "—"}</div>
                        <div style={{ fontSize:11, color:"rgba(255,255,255,0.35)" }}>{inv.customerEmail ?? ""}</div>
                      </td>
                      <td style={{ ...S.td, fontWeight:800 }}>{fmt(inv.amountDue, inv.currency)}</td>
                      <td style={S.td}><StatusBadge status={inv.status ?? "open"} /></td>
                      <td style={{ ...S.td, fontSize:12, color:"rgba(240,237,230,0.45)" }}>{inv.dueDate ? fmtDate(inv.dueDate) : "—"}</td>
                      <td style={{ ...S.td }}>
                        <div style={{ display:"flex", gap:6 }}>
                          {inv.hostedInvoiceUrl && (
                            <a href={inv.hostedInvoiceUrl} target="_blank" rel="noopener noreferrer"
                              style={{ ...S.btn, ...S.btnG, ...S.btnSm, textDecoration:"none", display:"inline-block" }}>🔗</a>
                          )}
                          {inv.status === "open" && (
                            <button className="sh-btn" style={{ ...S.btn, ...S.btnP, ...S.btnSm }} onClick={() => handleSendInvoice(inv.id)}>Enviar</button>
                          )}
                          {(inv.status === "open" || inv.status === "draft") && (
                            <button className="sh-btn" style={{ ...S.btn, ...S.btnD, ...S.btnSm }} onClick={() => handleVoidInvoice(inv.id)}>Anular</button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      {/* ══ PAYOUTS ═══════════════════════════════════════════════════════════ */}
      {!loading && tab === "payouts" && (
        <div>
          {balance && (
            <div style={{ ...S.grid2, marginBottom:16 }}>
              {[
                { label:"Balance disponible", value:fmt(balance.available, balance.currency), color:"#34d399", icon:"✅" },
                { label:"Balance pendiente",  value:fmt(balance.pending,   balance.currency), color:"#fbbf24", icon:"⏳" },
              ].map(row => (
                <div key={row.label} style={{ ...S.kcard, borderRadius:14, padding:"20px 24px" }} className="sh-kcard">
                  <div style={{ fontSize:22, marginBottom:6 }}>{row.icon}</div>
                  <div style={{ fontSize:11, color:"rgba(240,237,230,0.45)", textTransform:"uppercase" as const, letterSpacing:"0.08em", marginBottom:4 }}>{row.label}</div>
                  <div style={{ fontSize:28, fontWeight:800, color:row.color }}>{row.value}</div>
                </div>
              ))}
            </div>
          )}
          <div className="sh-card" style={S.card}>
            <div style={{ fontWeight:700, fontSize:15, marginBottom:14 }}>💸 Payouts ({payouts.length})</div>
            {payouts.length === 0 ? <div style={S.empty}>Sin payouts registrados</div> : (
              <table style={{ width:"100%", borderCollapse:"collapse" as const }}>
                <thead><tr>{["ID","Importe","Estado","Método","Llegada estimada","Descripción"].map(h => <th key={h} style={S.th}>{h}</th>)}</tr></thead>
                <tbody>
                  {payouts.map(p => (
                    <tr key={p.id} className="sh-row">
                      <td style={S.td}><code style={{ fontSize:11, color:"rgba(255,255,255,0.35)" }}>{p.id}</code></td>
                      <td style={{ ...S.td, fontWeight:800, color:SP }}>{fmt(p.amount, p.currency)}</td>
                      <td style={S.td}><StatusBadge status={p.status} /></td>
                      <td style={{ ...S.td, fontSize:12, color:"rgba(240,237,230,0.5)" }}>{p.method}</td>
                      <td style={{ ...S.td, fontSize:12, color:"rgba(240,237,230,0.5)" }}>{p.arrivalDate ? fmtDate(p.arrivalDate) : "—"}</td>
                      <td style={{ ...S.td, color:"rgba(240,237,230,0.6)" }}>{p.description ?? "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      {/* ══ ACCIONES ══════════════════════════════════════════════════════════ */}
      {!loading && tab === "acciones" && (
        <div style={S.grid2}>
          {/* Crear cargo / Payment Intent */}
          <div style={S.card}>
            <div style={{ fontWeight:700, fontSize:14, marginBottom:14, color:SL }}>⚡ Crear Payment Intent</div>
            <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
              <div>
                <label style={S.lbl}>Importe * (ej: 99.00)</label>
                <input type="number" style={S.inp} value={chargeForm.amount} onChange={e => setChargeForm(p => ({ ...p, amount:e.target.value }))} />
              </div>
              <div>
                <label style={S.lbl}>Moneda</label>
                <select style={S.sel} value={chargeForm.currency} onChange={e => setChargeForm(p => ({ ...p, currency:e.target.value }))}>
                  {["eur","usd","gbp","mxn"].map(c => <option key={c} value={c}>{c.toUpperCase()}</option>)}
                </select>
              </div>
              <div>
                <label style={S.lbl}>Descripción</label>
                <input style={S.inp} value={chargeForm.description} onChange={e => setChargeForm(p => ({ ...p, description:e.target.value }))} />
              </div>
              <div>
                <label style={S.lbl}>Email recibo</label>
                <input type="email" style={S.inp} value={chargeForm.customerEmail} onChange={e => setChargeForm(p => ({ ...p, customerEmail:e.target.value }))} />
              </div>
              <button className="sh-btn" style={{ ...S.btn, ...S.btnP }} disabled={actionLoading}
                onClick={async () => {
                  if (!chargeForm.amount) { setErr("Importe requerido"); return; }
                  setActionLoading(true); setErr(""); setActionResult(null);
                  try {
                    const r = await apiFetch(`/admin/stripe/project/${projectId}/charges`, {
                      method:"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify(chargeForm),
                    });
                    const d = await r.json();
                    if (!r.ok) throw new Error(d.error);
                    setActionResult(d);
                    setMsg(`✓ Payment Intent creado: ${d.paymentIntentId}`);
                    setChargeForm({ amount:"", currency:"eur", description:"", customerEmail:"" });
                  } catch(e:any) { setErr(e.message); }
                  finally { setActionLoading(false); }
                }}>
                {actionLoading ? "Procesando…" : "Crear Payment Intent"}
              </button>
            </div>
          </div>

          {/* Devolución */}
          <div style={S.card}>
            <div style={{ fontWeight:700, fontSize:14, marginBottom:14, color:"#f87171" }}>↩ Procesar devolución</div>
            <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
              <div>
                <label style={S.lbl}>Charge ID * (ch_xxx o pi_xxx)</label>
                <input style={S.inp} value={refundForm.chargeId} onChange={e => setRefundForm(p => ({ ...p, chargeId:e.target.value }))} placeholder="ch_…" />
              </div>
              <div>
                <label style={S.lbl}>Importe parcial (vacío = total)</label>
                <input type="number" style={S.inp} value={refundForm.amount} onChange={e => setRefundForm(p => ({ ...p, amount:e.target.value }))} />
              </div>
              <div>
                <label style={S.lbl}>Motivo</label>
                <select style={S.sel} value={refundForm.reason} onChange={e => setRefundForm(p => ({ ...p, reason:e.target.value }))}>
                  <option value="requested_by_customer">Solicitado por el cliente</option>
                  <option value="duplicate">Duplicado</option>
                  <option value="fraudulent">Fraudulento</option>
                </select>
              </div>
              <button className="sh-btn" style={{ ...S.btn, ...S.btnD }} disabled={actionLoading} onClick={handleRefund}>
                {actionLoading ? "Procesando…" : "Procesar devolución"}
              </button>
            </div>
          </div>

          {/* Action result */}
          {actionResult && (
            <div style={{ gridColumn:"1 / -1", ...S.card, borderColor:"rgba(99,91,255,0.3)" }}>
              <div style={{ fontSize:12, fontWeight:700, color:SL, marginBottom:8 }}>Resultado</div>
              <pre style={{ fontSize:11, color:"rgba(240,237,230,0.6)", overflowX:"auto" as const, margin:0 }}>
                {JSON.stringify(actionResult, null, 2)}
              </pre>
            </div>
          )}
        </div>
      )}

      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );
}
