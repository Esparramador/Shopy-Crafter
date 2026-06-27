import { useState, useEffect, useCallback } from "react";

const API_BASE = import.meta.env.BASE_URL?.replace(/\/$/, "") ?? "";

function apiFetch(path: string, opts?: RequestInit) {
  return fetch(`${API_BASE}/api${path}`, {
    credentials: "include",
    headers: { "Content-Type": "application/json", ...(opts?.headers ?? {}) },
    ...opts,
  });
}

function fmtMoney(amount: number, currency = "eur") {
  return new Intl.NumberFormat("es-ES", {
    style: "currency",
    currency: currency.toUpperCase(),
    minimumFractionDigits: 2,
  }).format(amount / 100);
}

function fmtDate(ts: number) {
  return new Date(ts * 1000).toLocaleDateString("es-ES", { day: "2-digit", month: "short", year: "numeric" });
}

function fmtDatetime(ts: number) {
  return new Date(ts * 1000).toLocaleString("es-ES", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
}

type Tab = "overview" | "transactions" | "customers" | "subscriptions" | "products" | "invoices" | "payouts" | "charges" | "draft-order";

interface StripeAccount {
  id: number;
  project_id: number | null;
  account_id: string;
  display_name: string | null;
  email: string | null;
  country: string;
  currency: string;
  onboarding_complete: boolean;
  account_type: string;
  connected_at: string;
  last_synced_at: string | null;
  project_name?: string;
}

interface Overview {
  balance: { available: number; pending: number; currency: string };
  metrics: { grossVolume: number; netVolume: number; totalFees: number; successCount: number; failedCount: number; period: string };
  recentCharges: any[];
  payouts: any[];
}

interface DraftOrderForm {
  amount: string;
  currency: string;
  description: string;
  customerEmail: string;
  note: string;
}

const BLANK_DRAFT: DraftOrderForm = {
  amount: "",
  currency: "EUR",
  description: "",
  customerEmail: "",
  note: "",
};

// ── Styles ─────────────────────────────────────────────────────────────────────
const S: Record<string, React.CSSProperties> = {
  page: { padding: "32px", maxWidth: "1200px", margin: "0 auto", color: "#f0ede6", fontFamily: "'Inter', sans-serif" },
  header: { display: "flex", alignItems: "center", gap: "16px", marginBottom: "28px" },
  title: { fontSize: "22px", fontWeight: 700, color: "#f0ede6", margin: 0 },
  subtitle: { fontSize: "13px", color: "rgba(240,237,230,0.55)", marginTop: "3px" },
  btn: { padding: "9px 18px", borderRadius: "8px", border: "none", cursor: "pointer", fontSize: "13px", fontWeight: 600, transition: "opacity .15s" },
  btnGold: { background: "linear-gradient(135deg,#c8a84b,#e8c96a)", color: "#0f0f0f" },
  btnGhost: { background: "rgba(255,255,255,0.06)", color: "#f0ede6", border: "1px solid rgba(255,255,255,0.12)" },
  btnDanger: { background: "rgba(239,68,68,0.12)", color: "#f87171", border: "1px solid rgba(239,68,68,0.2)" },
  btnSm: { padding: "5px 12px", fontSize: "12px" },
  card: { background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: "12px", padding: "20px" },
  metricCard: { background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: "12px", padding: "20px 24px" },
  metricLabel: { fontSize: "11px", color: "rgba(240,237,230,0.5)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: "6px" },
  metricValue: { fontSize: "26px", fontWeight: 700, color: "#f0ede6" },
  metricSub: { fontSize: "12px", color: "rgba(240,237,230,0.45)", marginTop: "4px" },
  tabs: { display: "flex", gap: "4px", marginBottom: "24px", background: "rgba(255,255,255,0.03)", borderRadius: "10px", padding: "4px" },
  tab: { padding: "8px 16px", borderRadius: "7px", border: "none", cursor: "pointer", fontSize: "13px", fontWeight: 500, transition: "all .15s", color: "rgba(240,237,230,0.6)", background: "transparent" },
  tabActive: { background: "rgba(200,168,75,0.15)", color: "#c8a84b" },
  table: { width: "100%", borderCollapse: "collapse" as const, fontSize: "13px" },
  th: { padding: "10px 12px", textAlign: "left" as const, fontSize: "11px", color: "rgba(240,237,230,0.45)", textTransform: "uppercase" as const, letterSpacing: "0.06em", borderBottom: "1px solid rgba(255,255,255,0.06)" },
  td: { padding: "12px", borderBottom: "1px solid rgba(255,255,255,0.04)", color: "#f0ede6" },
  badge: { display: "inline-block", padding: "3px 8px", borderRadius: "100px", fontSize: "11px", fontWeight: 600 },
  select: { background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.12)", borderRadius: "8px", color: "#f0ede6", padding: "9px 12px", fontSize: "13px", cursor: "pointer" },
  input: { background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.12)", borderRadius: "8px", color: "#f0ede6", padding: "9px 12px", fontSize: "13px", width: "100%", boxSizing: "border-box" as const },
  label: { fontSize: "12px", color: "rgba(240,237,230,0.55)", marginBottom: "5px", display: "block" },
  grid2: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" },
  grid4: { display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: "16px", marginBottom: "24px" },
  emptyState: { textAlign: "center" as const, padding: "60px 20px", color: "rgba(240,237,230,0.4)" },
  accountCard: { background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: "12px", padding: "18px 20px", cursor: "pointer", transition: "all .15s" },
  accountCardActive: { border: "1px solid rgba(200,168,75,0.4)", background: "rgba(200,168,75,0.06)" },
  notice: { background: "rgba(200,168,75,0.08)", border: "1px solid rgba(200,168,75,0.2)", borderRadius: "10px", padding: "16px 20px", marginBottom: "24px", fontSize: "13px", color: "rgba(240,237,230,0.8)", lineHeight: 1.6 },
  successBanner: { background: "rgba(45,212,159,0.08)", border: "1px solid rgba(45,212,159,0.25)", borderRadius: "10px", padding: "14px 18px", marginBottom: "16px", fontSize: "13px", color: "#2dd49f" },
  errBanner: { background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.2)", borderRadius: "10px", padding: "14px 18px", marginBottom: "16px", fontSize: "13px", color: "#f87171" },
};

function statusBadge(status: string) {
  const map: Record<string, { bg: string; color: string; label: string }> = {
    succeeded: { bg: "rgba(45,212,159,0.12)", color: "#2dd49f", label: "✓ Exitoso" },
    failed: { bg: "rgba(239,68,68,0.12)", color: "#f87171", label: "✗ Fallido" },
    pending: { bg: "rgba(200,168,75,0.12)", color: "#c8a84b", label: "⏳ Pendiente" },
    active: { bg: "rgba(45,212,159,0.12)", color: "#2dd49f", label: "✓ Activo" },
    canceled: { bg: "rgba(239,68,68,0.12)", color: "#f87171", label: "✗ Cancelado" },
    trialing: { bg: "rgba(99,102,241,0.12)", color: "#a5b4fc", label: "◈ Trial" },
    past_due: { bg: "rgba(251,146,60,0.12)", color: "#fb923c", label: "⚠ Vencido" },
    paid: { bg: "rgba(45,212,159,0.12)", color: "#2dd49f", label: "✓ Pagado" },
    unpaid: { bg: "rgba(239,68,68,0.12)", color: "#f87171", label: "✗ Impagado" },
  };
  const s = map[status] ?? { bg: "rgba(255,255,255,0.06)", color: "rgba(240,237,230,0.6)", label: status };
  return <span style={{ ...S.badge, background: s.bg, color: s.color }}>{s.label}</span>;
}

// ────────────────────────────────────────────────────────────────────────────
export default function StripeManager() {
  const [accounts, setAccounts] = useState<StripeAccount[]>([]);
  const [selectedAccount, setSelectedAccount] = useState<StripeAccount | null>(null);
  const [tab, setTab] = useState<Tab>("overview");
  const [overview, setOverview] = useState<Overview | null>(null);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [customers, setCustomers] = useState<any[]>([]);
  const [subscriptions, setSubscriptions] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [invoices, setInvoices] = useState<any[]>([]);
  const [payouts, setPayouts] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [oauthConfig, setOauthConfig] = useState<{ configured: boolean; mode: string } | null>(null);
  const [draftForm, setDraftForm] = useState<DraftOrderForm>(BLANK_DRAFT);
  const [draftResult, setDraftResult] = useState<any>(null);
  const [draftLoading, setDraftLoading] = useState(false);
  const [err, setErr] = useState("");
  const [msg, setMsg] = useState("");

  // Forms for new tabs
  const [chargeForm, setChargeForm] = useState({ amount: "", currency: "eur", description: "", customerId: "", receiptEmail: "" });
  const [refundForm, setRefundForm] = useState({ paymentIntentId: "", amount: "", reason: "requested_by_customer" });
  const [productForm, setProductForm] = useState({ name: "", description: "", price: "", currency: "eur", interval: "" });
  const [customerForm, setCustomerForm] = useState({ email: "", name: "", phone: "", description: "" });
  const [invoiceForm, setInvoiceForm] = useState({ customerId: "", description: "", daysUntilDue: "30", lineItemDesc: "", lineItemAmount: "" });
  const [actionLoading, setActionLoading] = useState(false);
  const [actionResult, setActionResult] = useState<any>(null);

  // Check OAuth config
  useEffect(() => {
    apiFetch("/stripe/oauth/check")
      .then(r => r.json())
      .then(setOauthConfig)
      .catch(() => {});
  }, []);

  // Load accounts
  const loadAccounts = useCallback(() => {
    setLoading(true);
    apiFetch("/stripe/accounts")
      .then(r => r.json())
      .then((data: StripeAccount[]) => {
        setAccounts(Array.isArray(data) ? data : []);
        if (!selectedAccount && data.length > 0) setSelectedAccount(data[0]);
      })
      .catch(() => setErr("Error cargando cuentas Stripe"))
      .finally(() => setLoading(false));
  }, [selectedAccount]);

  useEffect(() => { loadAccounts(); }, []);

  // Load tab data when account or tab changes
  useEffect(() => {
    if (!selectedAccount) return;
    const id = selectedAccount.account_id;

    if (tab === "overview") {
      setLoading(true);
      apiFetch(`/stripe/accounts/${id}/overview`)
        .then(r => r.json())
        .then(setOverview)
        .catch(() => setErr("Error cargando overview"))
        .finally(() => setLoading(false));
    } else if (tab === "transactions") {
      setLoading(true);
      apiFetch(`/stripe/accounts/${id}/transactions?limit=25`)
        .then(r => r.json())
        .then(d => setTransactions(d.data ?? []))
        .catch(() => setErr("Error cargando transacciones"))
        .finally(() => setLoading(false));
    } else if (tab === "customers") {
      setLoading(true);
      apiFetch(`/stripe/accounts/${id}/customers?limit=25`)
        .then(r => r.json())
        .then(d => setCustomers(d.data ?? []))
        .catch(() => setErr("Error cargando clientes"))
        .finally(() => setLoading(false));
    } else if (tab === "subscriptions") {
      setLoading(true);
      apiFetch(`/stripe/accounts/${id}/subscriptions?limit=25`)
        .then(r => r.json())
        .then(d => setSubscriptions(d.data ?? []))
        .catch(() => setErr("Error cargando suscripciones"))
        .finally(() => setLoading(false));
    } else if (tab === "products") {
      setLoading(true);
      apiFetch(`/stripe/accounts/${id}/products?limit=50`)
        .then(r => r.json())
        .then(d => setProducts(d.data ?? []))
        .catch(() => setErr("Error cargando productos"))
        .finally(() => setLoading(false));
    } else if (tab === "invoices") {
      setLoading(true);
      apiFetch(`/stripe/accounts/${id}/invoices?limit=25`)
        .then(r => r.json())
        .then(d => setInvoices(d.data ?? []))
        .catch(() => setErr("Error cargando facturas"))
        .finally(() => setLoading(false));
    } else if (tab === "payouts") {
      setLoading(true);
      apiFetch(`/stripe/accounts/${id}/payouts?limit=25`)
        .then(r => r.json())
        .then(d => setPayouts(d.data ?? []))
        .catch(() => setErr("Error cargando payouts"))
        .finally(() => setLoading(false));
    }
  }, [selectedAccount, tab]);

  async function connectStripe() {
    setErr("");
    const r = await apiFetch(`/stripe/oauth/start?projectId=0`);
    const data = await r.json();
    if (data.authUrl) window.location.href = data.authUrl;
    else setErr(data.error ?? "Error iniciando OAuth");
  }

  async function syncAccount() {
    if (!selectedAccount) return;
    setSyncing(true);
    try {
      const r = await apiFetch(`/stripe/accounts/${selectedAccount.account_id}/sync`, { method: "POST" });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error);
      setMsg("✓ Cuenta sincronizada");
      loadAccounts();
      setTimeout(() => setMsg(""), 3000);
    } catch (e: any) {
      setErr(e.message);
    } finally {
      setSyncing(false);
    }
  }

  async function doAction(path: string, method: string, body?: any) {
    if (!selectedAccount) return;
    setActionLoading(true);
    setActionResult(null);
    setErr("");
    try {
      const r = await apiFetch(path, { method, body: body ? JSON.stringify(body) : undefined });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || "Error en la operación");
      setActionResult(d);
      setMsg(d.message || "✓ Operación completada");
      setTimeout(() => setMsg(""), 4000);
      // Reload current tab data
      if (tab === "products") apiFetch(`/stripe/accounts/${selectedAccount.account_id}/products?limit=50`).then(r2 => r2.json()).then(d2 => setProducts(d2.data ?? [])).catch(() => {});
      if (tab === "invoices") apiFetch(`/stripe/accounts/${selectedAccount.account_id}/invoices?limit=25`).then(r2 => r2.json()).then(d2 => setInvoices(d2.data ?? [])).catch(() => {});
      if (tab === "customers") apiFetch(`/stripe/accounts/${selectedAccount.account_id}/customers?limit=25`).then(r2 => r2.json()).then(d2 => setCustomers(d2.data ?? [])).catch(() => {});
    } catch (e: any) {
      setErr(e.message);
    } finally {
      setActionLoading(false);
    }
  }

  async function disconnectAccount() {
    if (!selectedAccount) return;
    if (!confirm(`¿Desconectar la cuenta ${selectedAccount.display_name ?? selectedAccount.account_id}?`)) return;
    const r = await apiFetch(`/stripe/accounts/${selectedAccount.account_id}/disconnect`, { method: "DELETE" });
    const d = await r.json();
    if (!r.ok) { setErr(d.error); return; }
    setSelectedAccount(null);
    setOverview(null);
    loadAccounts();
    setMsg("Cuenta desconectada");
  }

  async function createDraftOrder() {
    setDraftLoading(true);
    setDraftResult(null);
    setErr("");
    try {
      const amountCents = Math.round(parseFloat(draftForm.amount) * 100);
      if (isNaN(amountCents) || amountCents <= 0) throw new Error("Introduce un importe válido");
      const r = await apiFetch("/stripe/draft-order", {
        method: "POST",
        body: JSON.stringify({
          amount: amountCents,
          currency: draftForm.currency,
          description: draftForm.description,
          customerEmail: draftForm.customerEmail,
          note: draftForm.note,
        }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error);
      setDraftResult(d);
    } catch (e: any) {
      setErr(e.message);
    } finally {
      setDraftLoading(false);
    }
  }

  // ── No Stripe configured notice ───────────────────────────────────────────
  if (oauthConfig && !oauthConfig.configured) {
    return (
      <div style={S.page}>
        <div style={S.header}>
          <div style={{ width: 44, height: 44, background: "linear-gradient(135deg,#635bff,#7c74ff)", borderRadius: 12, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22 }}>💳</div>
          <div>
            <h1 style={S.title}>Stripe Manager</h1>
            <p style={S.subtitle}>Gestión profesional de cuentas Stripe conectadas</p>
          </div>
        </div>
        <div style={S.notice}>
          <strong style={{ color: "#c8a84b" }}>⚙️ Configuración requerida</strong><br />
          Para conectar cuentas Stripe necesitas añadir los secrets en el entorno de Replit:<br /><br />
          <code style={{ background: "rgba(0,0,0,0.3)", padding: "2px 6px", borderRadius: 4, fontFamily: "monospace" }}>STRIPE_SECRET_KEY</code> — tu clave secreta de Stripe (<code>sk_test_...</code> o <code>sk_live_...</code>)<br />
          <code style={{ background: "rgba(0,0,0,0.3)", padding: "2px 6px", borderRadius: 4, fontFamily: "monospace", marginTop: 4, display: "inline-block" }}>STRIPE_CLIENT_ID</code> — el Client ID de tu aplicación en <a href="https://dashboard.stripe.com/settings/connect" target="_blank" rel="noreferrer" style={{ color: "#c8a84b" }}>Stripe Connect Settings</a><br /><br />
          Una vez añadidos, recarga esta página.
        </div>
      </div>
    );
  }

  return (
    <div style={S.page}>
      {/* Header */}
      <div style={S.header}>
        <div style={{ width: 44, height: 44, background: "linear-gradient(135deg,#635bff,#7c74ff)", borderRadius: 12, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22 }}>💳</div>
        <div style={{ flex: 1 }}>
          <h1 style={S.title}>Stripe Manager</h1>
          <p style={S.subtitle}>
            {oauthConfig?.mode === "test" ? "🧪 Modo TEST — " : oauthConfig?.mode === "live" ? "🟢 Modo LIVE — " : ""}
            Gestión profesional de cuentas Stripe conectadas
          </p>
        </div>
        <button style={{ ...S.btn, ...S.btnGold }} onClick={connectStripe}>+ Conectar cuenta Stripe</button>
      </div>

      {err && <div style={S.errBanner}>{err} <button onClick={() => setErr("")} style={{ float: "right", background: "none", border: "none", color: "#f87171", cursor: "pointer" }}>✕</button></div>}
      {msg && <div style={S.successBanner}>{msg}</div>}

      <div style={{ display: "grid", gridTemplateColumns: "280px 1fr", gap: "20px" }}>
        {/* Account list */}
        <div>
          <div style={{ fontSize: "11px", color: "rgba(240,237,230,0.45)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: "10px" }}>
            Cuentas conectadas ({accounts.length})
          </div>
          {accounts.length === 0 && !loading && (
            <div style={{ ...S.card, textAlign: "center", padding: "32px 16px", color: "rgba(240,237,230,0.4)", fontSize: "13px" }}>
              <div style={{ fontSize: 32, marginBottom: 8 }}>💳</div>
              Sin cuentas Stripe.<br />Conecta una para empezar.
            </div>
          )}
          {accounts.map(acc => (
            <div
              key={acc.account_id}
              style={{ ...S.accountCard, ...(selectedAccount?.account_id === acc.account_id ? S.accountCardActive : {}), marginBottom: 8 }}
              onClick={() => { setSelectedAccount(acc); setTab("overview"); setOverview(null); }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <div style={{ width: 36, height: 36, background: "rgba(99,91,255,0.15)", borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, flexShrink: 0 }}>💳</div>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontWeight: 600, fontSize: "13px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {acc.display_name ?? acc.account_id}
                  </div>
                  <div style={{ fontSize: "11px", color: "rgba(240,237,230,0.45)", marginTop: 2 }}>{acc.email ?? acc.account_id}</div>
                </div>
              </div>
              <div style={{ display: "flex", gap: 6, marginTop: 10, alignItems: "center" }}>
                {acc.onboarding_complete
                  ? <span style={{ ...S.badge, background: "rgba(45,212,159,0.1)", color: "#2dd49f", fontSize: 10 }}>✓ Activa</span>
                  : <span style={{ ...S.badge, background: "rgba(251,146,60,0.1)", color: "#fb923c", fontSize: 10 }}>⚠ Pendiente</span>}
                <span style={{ ...S.badge, background: "rgba(255,255,255,0.05)", color: "rgba(240,237,230,0.5)", fontSize: 10 }}>{acc.country}</span>
                <span style={{ ...S.badge, background: "rgba(255,255,255,0.05)", color: "rgba(240,237,230,0.5)", fontSize: 10 }}>{acc.currency.toUpperCase()}</span>
              </div>
              {acc.project_name && (
                <div style={{ fontSize: "11px", color: "rgba(240,237,230,0.35)", marginTop: 6 }}>📦 {acc.project_name}</div>
              )}
            </div>
          ))}

          {/* Draft Order card in sidebar */}
          <div style={{ marginTop: 16 }}>
            <button
              style={{ ...S.btn, ...S.btnGhost, width: "100%", marginBottom: 4 }}
              onClick={() => { setSelectedAccount(null); setTab("draft-order"); }}
            >
              🧾 Crear cobro / Draft Order
            </button>
          </div>
        </div>

        {/* Main panel */}
        <div>
          {!selectedAccount && tab !== "draft-order" && (
            <div style={{ ...S.card, ...S.emptyState }}>
              <div style={{ fontSize: 48, marginBottom: 12 }}>💳</div>
              <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 6 }}>Selecciona una cuenta Stripe</div>
              <div style={{ fontSize: 13, color: "rgba(240,237,230,0.4)" }}>O conecta una nueva con el botón de arriba</div>
            </div>
          )}

          {/* Draft Order form */}
          {tab === "draft-order" && (
            <div style={S.card}>
              <h3 style={{ margin: "0 0 20px", fontSize: 16 }}>🧾 Crear cobro via Shopify Draft Order</h3>
              <p style={{ fontSize: 13, color: "rgba(240,237,230,0.55)", marginBottom: 20, lineHeight: 1.6 }}>
                Genera un link de pago usando la pasarela de tu tienda Shopify vinculada. El cliente paga en tu propio checkout de Shopify (con Shopify Payments, Stripe, o lo que tengas configurado en tu tienda).
              </p>
              {draftResult && (
                <div style={S.successBanner}>
                  ✓ Draft Order creado — <strong>Total: {draftResult.totalPrice} {draftResult.currency}</strong><br />
                  <a href={draftResult.invoiceUrl} target="_blank" rel="noreferrer" style={{ color: "#2dd49f", fontWeight: 700 }}>
                    🔗 {draftResult.invoiceUrl}
                  </a>
                  <div style={{ marginTop: 8, display: "flex", gap: 8 }}>
                    <button style={{ ...S.btn, ...S.btnGold, ...S.btnSm }} onClick={() => navigator.clipboard.writeText(draftResult.invoiceUrl)}>📋 Copiar link</button>
                    <a href={draftResult.adminUrl} target="_blank" rel="noreferrer" style={{ ...S.btn, ...S.btnGhost, ...S.btnSm, textDecoration: "none" }}>Ver en Shopify →</a>
                  </div>
                </div>
              )}
              <div style={S.grid2}>
                <div>
                  <label style={S.label}>Importe (€)</label>
                  <input style={S.input} type="number" min="0.01" step="0.01" placeholder="49.00" value={draftForm.amount} onChange={e => setDraftForm(f => ({ ...f, amount: e.target.value }))} />
                </div>
                <div>
                  <label style={S.label}>Moneda</label>
                  <select style={{ ...S.select, width: "100%" }} value={draftForm.currency} onChange={e => setDraftForm(f => ({ ...f, currency: e.target.value }))}>
                    <option value="EUR">EUR — Euro</option>
                    <option value="USD">USD — Dólar</option>
                    <option value="GBP">GBP — Libra</option>
                  </select>
                </div>
                <div>
                  <label style={S.label}>Descripción del servicio</label>
                  <input style={S.input} placeholder="Consultoría SEO — Junio 2026" value={draftForm.description} onChange={e => setDraftForm(f => ({ ...f, description: e.target.value }))} />
                </div>
                <div>
                  <label style={S.label}>Email del cliente</label>
                  <input style={S.input} type="email" placeholder="cliente@empresa.com" value={draftForm.customerEmail} onChange={e => setDraftForm(f => ({ ...f, customerEmail: e.target.value }))} />
                </div>
                <div style={{ gridColumn: "1 / -1" }}>
                  <label style={S.label}>Nota interna</label>
                  <input style={S.input} placeholder="Referencia de proyecto, factura #..." value={draftForm.note} onChange={e => setDraftForm(f => ({ ...f, note: e.target.value }))} />
                </div>
              </div>
              <div style={{ display: "flex", gap: 10, marginTop: 20 }}>
                <button style={{ ...S.btn, ...S.btnGold }} onClick={createDraftOrder} disabled={draftLoading}>
                  {draftLoading ? "⏳ Generando..." : "🧾 Generar link de cobro"}
                </button>
                <button style={{ ...S.btn, ...S.btnGhost }} onClick={() => { setDraftForm(BLANK_DRAFT); setDraftResult(null); }}>Limpiar</button>
              </div>
            </div>
          )}

          {selectedAccount && (
            <>
              {/* Account header */}
              <div style={{ ...S.card, marginBottom: 16, display: "flex", alignItems: "center", gap: 16 }}>
                <div style={{ width: 48, height: 48, background: "linear-gradient(135deg,#635bff22,#635bff44)", borderRadius: 12, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 24, flexShrink: 0 }}>💳</div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 700, fontSize: 16 }}>{selectedAccount.display_name ?? selectedAccount.account_id}</div>
                  <div style={{ fontSize: 12, color: "rgba(240,237,230,0.5)", marginTop: 2 }}>
                    {selectedAccount.email} · {selectedAccount.account_id} · {selectedAccount.country.toUpperCase()}
                    {selectedAccount.last_synced_at && ` · Sync: ${new Date(selectedAccount.last_synced_at).toLocaleString("es-ES")}`}
                  </div>
                </div>
                <div style={{ display: "flex", gap: 8 }}>
                  <button style={{ ...S.btn, ...S.btnGhost, ...S.btnSm }} onClick={syncAccount} disabled={syncing}>
                    {syncing ? "⏳" : "🔄"} Sincronizar
                  </button>
                  <a
                    href={`https://dashboard.stripe.com/${selectedAccount.account_id}`}
                    target="_blank" rel="noreferrer"
                    style={{ ...S.btn, ...S.btnGhost, ...S.btnSm, textDecoration: "none" }}
                  >↗ Stripe Dashboard</a>
                  <button style={{ ...S.btn, ...S.btnDanger, ...S.btnSm }} onClick={disconnectAccount}>Desconectar</button>
                </div>
              </div>

              {/* Tabs */}
              <div style={{ ...S.tabs, flexWrap: "wrap" as const }}>
                {(["overview", "transactions", "customers", "subscriptions", "products", "invoices", "payouts", "charges"] as const).map(t => (
                  <button key={t} style={{ ...S.tab, ...(tab === t ? S.tabActive : {}) }} onClick={() => { setTab(t); setActionResult(null); }}>
                    {{ overview: "📊 Overview", transactions: "💰 Cobros", customers: "👥 Clientes", subscriptions: "🔄 Suscripciones", products: "📦 Productos", invoices: "🧾 Facturas", payouts: "🏦 Payouts", charges: "⚡ Acciones" }[t]}
                  </button>
                ))}
              </div>

              {loading && <div style={{ textAlign: "center", padding: "40px", color: "rgba(240,237,230,0.4)" }}>⏳ Cargando datos de Stripe...</div>}

              {/* Overview */}
              {!loading && tab === "overview" && overview && (
                <>
                  <div style={S.grid4}>
                    <div style={S.metricCard}>
                      <div style={S.metricLabel}>Saldo disponible</div>
                      <div style={S.metricValue}>{fmtMoney(overview.balance.available, overview.balance.currency)}</div>
                    </div>
                    <div style={S.metricCard}>
                      <div style={S.metricLabel}>Saldo pendiente</div>
                      <div style={S.metricValue}>{fmtMoney(overview.balance.pending, overview.balance.currency)}</div>
                    </div>
                    <div style={S.metricCard}>
                      <div style={S.metricLabel}>Volumen bruto</div>
                      <div style={S.metricValue}>{fmtMoney(overview.metrics.grossVolume, overview.balance.currency)}</div>
                      <div style={S.metricSub}>{overview.metrics.period}</div>
                    </div>
                    <div style={S.metricCard}>
                      <div style={S.metricLabel}>Pagos exitosos</div>
                      <div style={S.metricValue}>{overview.metrics.successCount}</div>
                      <div style={S.metricSub}>{overview.metrics.failedCount} fallidos</div>
                    </div>
                  </div>

                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
                    <div style={S.card}>
                      <h4 style={{ margin: "0 0 14px", fontSize: 13, color: "rgba(240,237,230,0.7)" }}>Últimos cobros</h4>
                      {overview.recentCharges.length === 0 && <div style={{ color: "rgba(240,237,230,0.35)", fontSize: 13 }}>Sin cobros recientes</div>}
                      {overview.recentCharges.slice(0, 5).map((c: any) => (
                        <div key={c.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 0", borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
                          <div>
                            <div style={{ fontSize: 13 }}>{c.description ?? c.id}</div>
                            <div style={{ fontSize: 11, color: "rgba(240,237,230,0.4)", marginTop: 2 }}>{fmtDatetime(c.created)}</div>
                          </div>
                          <div style={{ textAlign: "right" }}>
                            <div style={{ fontWeight: 600 }}>{fmtMoney(c.amount, c.currency)}</div>
                            <div style={{ marginTop: 3 }}>{statusBadge(c.status)}</div>
                          </div>
                        </div>
                      ))}
                    </div>

                    <div style={S.card}>
                      <h4 style={{ margin: "0 0 14px", fontSize: 13, color: "rgba(240,237,230,0.7)" }}>Últimos payouts</h4>
                      {overview.payouts.length === 0 && <div style={{ color: "rgba(240,237,230,0.35)", fontSize: 13 }}>Sin payouts recientes</div>}
                      {overview.payouts.map((p: any) => (
                        <div key={p.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 0", borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
                          <div>
                            <div style={{ fontSize: 13 }}>Payout #{p.id.slice(-6)}</div>
                            <div style={{ fontSize: 11, color: "rgba(240,237,230,0.4)", marginTop: 2 }}>Llegada: {fmtDate(p.arrivalDate)}</div>
                          </div>
                          <div style={{ textAlign: "right" }}>
                            <div style={{ fontWeight: 600 }}>{fmtMoney(p.amount, p.currency)}</div>
                            <div style={{ marginTop: 3 }}>{statusBadge(p.status)}</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </>
              )}

              {/* Transactions */}
              {!loading && tab === "transactions" && (
                <div style={S.card}>
                  <h4 style={{ margin: "0 0 16px", fontSize: 14 }}>💰 Transacciones</h4>
                  {transactions.length === 0 && <div style={S.emptyState}>Sin transacciones</div>}
                  {transactions.length > 0 && (
                    <table style={S.table}>
                      <thead>
                        <tr>
                          <th style={S.th}>ID</th>
                          <th style={S.th}>Cliente</th>
                          <th style={S.th}>Descripción</th>
                          <th style={S.th}>Importe</th>
                          <th style={S.th}>Estado</th>
                          <th style={S.th}>Fecha</th>
                          <th style={S.th}>Recibo</th>
                        </tr>
                      </thead>
                      <tbody>
                        {transactions.map(tx => (
                          <tr key={tx.id}>
                            <td style={{ ...S.td, fontFamily: "monospace", fontSize: 11, color: "rgba(240,237,230,0.5)" }}>{tx.id.slice(-8)}</td>
                            <td style={S.td}>{tx.customerEmail ?? tx.customer ?? "—"}</td>
                            <td style={{ ...S.td, maxWidth: 180, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{tx.description ?? "—"}</td>
                            <td style={{ ...S.td, fontWeight: 600 }}>{fmtMoney(tx.amount, tx.currency)}</td>
                            <td style={S.td}>{statusBadge(tx.status)}</td>
                            <td style={{ ...S.td, color: "rgba(240,237,230,0.55)", fontSize: 12 }}>{fmtDatetime(tx.created)}</td>
                            <td style={S.td}>
                              {tx.receiptUrl && <a href={tx.receiptUrl} target="_blank" rel="noreferrer" style={{ color: "#c8a84b", fontSize: 12 }}>↗ Ver</a>}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              )}

              {/* Customers */}
              {!loading && tab === "customers" && (
                <div style={S.card}>
                  <h4 style={{ margin: "0 0 16px", fontSize: 14 }}>👥 Clientes</h4>
                  {customers.length === 0 && <div style={S.emptyState}>Sin clientes</div>}
                  {customers.length > 0 && (
                    <table style={S.table}>
                      <thead>
                        <tr>
                          <th style={S.th}>ID</th>
                          <th style={S.th}>Nombre</th>
                          <th style={S.th}>Email</th>
                          <th style={S.th}>Teléfono</th>
                          <th style={S.th}>Balance</th>
                          <th style={S.th}>Moneda</th>
                          <th style={S.th}>Alta</th>
                        </tr>
                      </thead>
                      <tbody>
                        {customers.map(c => (
                          <tr key={c.id}>
                            <td style={{ ...S.td, fontFamily: "monospace", fontSize: 11, color: "rgba(240,237,230,0.5)" }}>{c.id.slice(-10)}</td>
                            <td style={S.td}>{c.name ?? "—"}</td>
                            <td style={S.td}>{c.email ?? "—"}</td>
                            <td style={S.td}>{c.phone ?? "—"}</td>
                            <td style={{ ...S.td, fontWeight: 600 }}>{fmtMoney(c.balance ?? 0, c.currency ?? "eur")}</td>
                            <td style={S.td}>{c.currency?.toUpperCase() ?? "—"}</td>
                            <td style={{ ...S.td, color: "rgba(240,237,230,0.55)", fontSize: 12 }}>{fmtDate(c.created)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              )}

              {/* Subscriptions */}
              {!loading && tab === "subscriptions" && (
                <div style={S.card}>
                  <h4 style={{ margin: "0 0 16px", fontSize: 14 }}>🔄 Suscripciones</h4>
                  {subscriptions.length === 0 && <div style={S.emptyState}>Sin suscripciones</div>}
                  {subscriptions.length > 0 && (
                    <table style={S.table}>
                      <thead><tr>
                        <th style={S.th}>ID</th><th style={S.th}>Cliente</th><th style={S.th}>Estado</th>
                        <th style={S.th}>Importe</th><th style={S.th}>Próxima renovación</th><th style={S.th}>Acción</th>
                      </tr></thead>
                      <tbody>
                        {subscriptions.map(s => (
                          <tr key={s.id}>
                            <td style={{ ...S.td, fontFamily: "monospace", fontSize: 11, color: "rgba(240,237,230,0.5)" }}>{s.id.slice(-12)}</td>
                            <td style={S.td}>{s.customer ?? "—"}</td>
                            <td style={S.td}>{statusBadge(s.status)}</td>
                            <td style={{ ...S.td, fontWeight: 600 }}>{s.items?.[0] ? fmtMoney(s.items[0].amount ?? 0, s.items[0].currency ?? "eur") : "—"}</td>
                            <td style={{ ...S.td, color: "rgba(240,237,230,0.55)", fontSize: 12 }}>
                              {s.currentPeriodEnd ? fmtDate(s.currentPeriodEnd) : "—"}
                              {s.cancelAtPeriodEnd && <span style={{ color: "#fb923c", marginLeft: 6 }}>⚠ Cancela</span>}
                            </td>
                            <td style={S.td}>
                              {s.status === "active" && !s.cancelAtPeriodEnd && (
                                <button style={{ ...S.btn, ...S.btnDanger, ...S.btnSm }} onClick={() => {
                                  if (confirm("¿Cancelar suscripción al final del período?"))
                                    doAction(`/stripe/accounts/${selectedAccount!.account_id}/subscriptions/${s.id}`, "DELETE");
                                }}>Cancelar</button>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              )}

              {/* Products — catálogo de precios/productos Stripe */}
              {!loading && tab === "products" && (
                <div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 16 }}>
                    <div style={S.card}>
                      <h4 style={{ margin: "0 0 14px", fontSize: 14 }}>➕ Nuevo Producto</h4>
                      <div style={{ display: "flex", flexDirection: "column" as const, gap: 10 }}>
                        <div><label style={S.label}>Nombre del producto *</label><input style={S.input} placeholder="Plan Pro · Consultoría SEO..." value={productForm.name} onChange={e => setProductForm(f => ({ ...f, name: e.target.value }))} /></div>
                        <div><label style={S.label}>Descripción</label><input style={S.input} placeholder="Descripción breve" value={productForm.description} onChange={e => setProductForm(f => ({ ...f, description: e.target.value }))} /></div>
                        <div style={S.grid2}>
                          <div><label style={S.label}>Precio (€)</label><input style={S.input} type="number" min="0" step="0.01" placeholder="49.00" value={productForm.price} onChange={e => setProductForm(f => ({ ...f, price: e.target.value }))} /></div>
                          <div><label style={S.label}>Facturación</label>
                            <select style={{ ...S.select, width: "100%" }} value={productForm.interval} onChange={e => setProductForm(f => ({ ...f, interval: e.target.value }))}>
                              <option value="">Pago único</option><option value="month">Mensual</option><option value="year">Anual</option><option value="week">Semanal</option>
                            </select>
                          </div>
                        </div>
                        <button style={{ ...S.btn, ...S.btnGold }} disabled={actionLoading || !productForm.name} onClick={() => {
                          doAction(`/stripe/accounts/${selectedAccount!.account_id}/products`, "POST", { name: productForm.name, description: productForm.description, price: parseFloat(productForm.price) || undefined, currency: "eur", interval: productForm.interval || undefined });
                          setProductForm({ name: "", description: "", price: "", currency: "eur", interval: "" });
                        }}>
                          {actionLoading ? "⏳ Creando..." : "📦 Crear producto en Stripe"}
                        </button>
                      </div>
                    </div>
                    <div style={S.card}>
                      <h4 style={{ margin: "0 0 14px", fontSize: 14 }}>👤 Nuevo Cliente</h4>
                      <div style={{ display: "flex", flexDirection: "column" as const, gap: 10 }}>
                        <div><label style={S.label}>Email *</label><input style={S.input} type="email" placeholder="cliente@empresa.com" value={customerForm.email} onChange={e => setCustomerForm(f => ({ ...f, email: e.target.value }))} /></div>
                        <div><label style={S.label}>Nombre</label><input style={S.input} placeholder="Nombre del cliente" value={customerForm.name} onChange={e => setCustomerForm(f => ({ ...f, name: e.target.value }))} /></div>
                        <div><label style={S.label}>Teléfono</label><input style={S.input} placeholder="+34 600..." value={customerForm.phone} onChange={e => setCustomerForm(f => ({ ...f, phone: e.target.value }))} /></div>
                        <button style={{ ...S.btn, ...S.btnGold }} disabled={actionLoading || !customerForm.email} onClick={() => {
                          doAction(`/stripe/accounts/${selectedAccount!.account_id}/customers`, "POST", customerForm);
                          setCustomerForm({ email: "", name: "", phone: "", description: "" });
                        }}>
                          {actionLoading ? "⏳ Creando..." : "👤 Crear cliente en Stripe"}
                        </button>
                      </div>
                    </div>
                  </div>
                  <div style={S.card}>
                    <h4 style={{ margin: "0 0 16px", fontSize: 14 }}>📦 Catálogo de Productos ({products.length})</h4>
                    {products.length === 0 && <div style={S.emptyState}>Sin productos. Crea uno arriba.</div>}
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(260px,1fr))", gap: 12 }}>
                      {products.map(p => (
                        <div key={p.id} style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 10, padding: 14 }}>
                          <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 4 }}>{p.name}</div>
                          {p.description && <div style={{ fontSize: 11, color: "rgba(240,237,230,0.5)", marginBottom: 8 }}>{p.description}</div>}
                          {(p.prices || []).map((pr: any) => (
                            <div key={pr.id} style={{ fontSize: 12, color: "#c8a84b", fontWeight: 600 }}>
                              {pr.amount ? fmtMoney(pr.amount, pr.currency) : "—"}{pr.interval ? `/${pr.interval}` : ""}
                            </div>
                          ))}
                          <div style={{ display: "flex", gap: 6, marginTop: 10 }}>
                            <span style={{ ...S.badge, background: p.active ? "rgba(45,212,159,0.1)" : "rgba(239,68,68,0.1)", color: p.active ? "#2dd49f" : "#f87171", fontSize: 10 }}>{p.active ? "✓ Activo" : "⛔ Archivado"}</span>
                            {p.active && <button style={{ ...S.btn, ...S.btnDanger, ...S.btnSm, marginLeft: "auto" }} onClick={() => { if (confirm("¿Archivar producto?")) doAction(`/stripe/accounts/${selectedAccount!.account_id}/products/${p.id}`, "DELETE"); }}>Archivar</button>}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* Invoices — facturas */}
              {!loading && tab === "invoices" && (
                <div>
                  <div style={{ ...S.card, marginBottom: 16 }}>
                    <h4 style={{ margin: "0 0 14px", fontSize: 14 }}>🧾 Nueva Factura</h4>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                      <div><label style={S.label}>Customer ID de Stripe *</label><input style={S.input} placeholder="cus_XXXXXXXXX" value={invoiceForm.customerId} onChange={e => setInvoiceForm(f => ({ ...f, customerId: e.target.value }))} /></div>
                      <div><label style={S.label}>Días hasta vencimiento</label><input style={S.input} type="number" min="1" value={invoiceForm.daysUntilDue} onChange={e => setInvoiceForm(f => ({ ...f, daysUntilDue: e.target.value }))} /></div>
                      <div><label style={S.label}>Descripción de línea</label><input style={S.input} placeholder="Servicio de consultoría..." value={invoiceForm.lineItemDesc} onChange={e => setInvoiceForm(f => ({ ...f, lineItemDesc: e.target.value }))} /></div>
                      <div><label style={S.label}>Importe (€)</label><input style={S.input} type="number" min="0" step="0.01" placeholder="150.00" value={invoiceForm.lineItemAmount} onChange={e => setInvoiceForm(f => ({ ...f, lineItemAmount: e.target.value }))} /></div>
                      <div style={{ gridColumn: "1 / -1" }}>
                        <label style={S.label}>Descripción de factura</label><input style={S.input} placeholder="Factura Junio 2026" value={invoiceForm.description} onChange={e => setInvoiceForm(f => ({ ...f, description: e.target.value }))} />
                      </div>
                    </div>
                    <div style={{ display: "flex", gap: 10, marginTop: 14 }}>
                      <button style={{ ...S.btn, ...S.btnGold }} disabled={actionLoading || !invoiceForm.customerId} onClick={() => {
                        const lineItems = invoiceForm.lineItemDesc && invoiceForm.lineItemAmount ? [{ description: invoiceForm.lineItemDesc, amount: parseFloat(invoiceForm.lineItemAmount), currency: "eur" }] : undefined;
                        doAction(`/stripe/accounts/${selectedAccount!.account_id}/invoices`, "POST", { customerId: invoiceForm.customerId, description: invoiceForm.description, daysUntilDue: parseInt(invoiceForm.daysUntilDue), lineItems });
                        setInvoiceForm({ customerId: "", description: "", daysUntilDue: "30", lineItemDesc: "", lineItemAmount: "" });
                      }}>
                        {actionLoading ? "⏳ Creando..." : "🧾 Crear factura"}
                      </button>
                    </div>
                    {actionResult?.invoice && (
                      <div style={S.successBanner}>
                        ✓ Factura creada: <strong>{actionResult.invoice.number || actionResult.invoice.id}</strong> — Estado: {actionResult.invoice.status}
                        {actionResult.invoice.hostedUrl && <> — <a href={actionResult.invoice.hostedUrl} target="_blank" rel="noreferrer" style={{ color: "#2dd49f" }}>Ver online</a></>}
                        <br /><button style={{ ...S.btn, ...S.btnGold, ...S.btnSm, marginTop: 8 }} onClick={() => doAction(`/stripe/accounts/${selectedAccount!.account_id}/invoices/${actionResult.invoice.id}/send`, "POST")}>📬 Enviar al cliente</button>
                      </div>
                    )}
                  </div>
                  <div style={S.card}>
                    <h4 style={{ margin: "0 0 16px", fontSize: 14 }}>🧾 Facturas ({invoices.length})</h4>
                    {invoices.length === 0 && <div style={S.emptyState}>Sin facturas aún</div>}
                    {invoices.length > 0 && (
                      <table style={S.table}>
                        <thead><tr>
                          <th style={S.th}>Número</th><th style={S.th}>Cliente</th><th style={S.th}>Importe</th>
                          <th style={S.th}>Estado</th><th style={S.th}>Vence</th><th style={S.th}>Acciones</th>
                        </tr></thead>
                        <tbody>
                          {invoices.map(inv => (
                            <tr key={inv.id}>
                              <td style={{ ...S.td, fontFamily: "monospace", fontSize: 12 }}>{inv.number || inv.id.slice(-10)}</td>
                              <td style={{ ...S.td, fontSize: 12 }}>{inv.customerEmail || inv.customerName || inv.customer || "—"}</td>
                              <td style={{ ...S.td, fontWeight: 600 }}>{fmtMoney(inv.amountDue ?? 0, inv.currency ?? "eur")}</td>
                              <td style={S.td}>{statusBadge(inv.status ?? "draft")}</td>
                              <td style={{ ...S.td, fontSize: 11, color: "rgba(240,237,230,0.5)" }}>{inv.dueDate ? fmtDate(inv.dueDate) : "—"}</td>
                              <td style={S.td}>
                                <div style={{ display: "flex", gap: 6 }}>
                                  {inv.hostedUrl && <a href={inv.hostedUrl} target="_blank" rel="noreferrer" style={{ ...S.btn, ...S.btnGhost, ...S.btnSm, textDecoration: "none" }}>Ver</a>}
                                  {(inv.status === "draft" || inv.status === "open") && <button style={{ ...S.btn, ...S.btnGold, ...S.btnSm }} onClick={() => doAction(`/stripe/accounts/${selectedAccount!.account_id}/invoices/${inv.id}/send`, "POST")}>📬 Enviar</button>}
                                  {inv.pdfUrl && <a href={inv.pdfUrl} target="_blank" rel="noreferrer" style={{ ...S.btn, ...S.btnGhost, ...S.btnSm, textDecoration: "none" }}>PDF</a>}
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

              {/* Payouts — transferencias bancarias */}
              {!loading && tab === "payouts" && (
                <div style={S.card}>
                  <h4 style={{ margin: "0 0 16px", fontSize: 14 }}>🏦 Payouts — Transferencias bancarias ({payouts.length})</h4>
                  <p style={{ fontSize: 12, color: "rgba(240,237,230,0.5)", marginBottom: 16 }}>Los payouts son transferencias automáticas de Stripe a la cuenta bancaria vinculada.</p>
                  {payouts.length === 0 && <div style={S.emptyState}>Sin payouts aún</div>}
                  {payouts.length > 0 && (
                    <table style={S.table}>
                      <thead><tr>
                        <th style={S.th}>ID</th><th style={S.th}>Importe</th><th style={S.th}>Estado</th>
                        <th style={S.th}>Método</th><th style={S.th}>Llegada</th><th style={S.th}>Descripción</th>
                      </tr></thead>
                      <tbody>
                        {payouts.map(p => (
                          <tr key={p.id}>
                            <td style={{ ...S.td, fontFamily: "monospace", fontSize: 11, color: "rgba(240,237,230,0.5)" }}>{p.id.slice(-10)}</td>
                            <td style={{ ...S.td, fontWeight: 600, color: p.status === "paid" ? "#2dd49f" : "inherit" }}>{fmtMoney(p.amount ?? 0, p.currency ?? "eur")}</td>
                            <td style={S.td}>{statusBadge(p.status ?? "pending")}</td>
                            <td style={{ ...S.td, fontSize: 12 }}>{p.method} · {p.type}</td>
                            <td style={{ ...S.td, fontSize: 12 }}>{p.arrivalDate ? fmtDate(p.arrivalDate) : "—"}</td>
                            <td style={{ ...S.td, fontSize: 12, color: "rgba(240,237,230,0.55)" }}>{p.description || "—"}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              )}

              {/* Charges — crear cobros, reembolsos, clientes */}
              {!loading && tab === "charges" && (
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
                  {/* Create PaymentIntent */}
                  <div style={S.card}>
                    <h4 style={{ margin: "0 0 14px", fontSize: 14 }}>⚡ Crear Cobro (PaymentIntent)</h4>
                    <p style={{ fontSize: 12, color: "rgba(240,237,230,0.5)", marginBottom: 14 }}>Crea un PaymentIntent. El cliente lo completa en el frontend con su método de pago.</p>
                    <div style={{ display: "flex", flexDirection: "column" as const, gap: 10 }}>
                      <div style={S.grid2}>
                        <div><label style={S.label}>Importe (€) *</label><input style={S.input} type="number" min="0.01" step="0.01" placeholder="99.00" value={chargeForm.amount} onChange={e => setChargeForm(f => ({ ...f, amount: e.target.value }))} /></div>
                        <div><label style={S.label}>Moneda</label>
                          <select style={{ ...S.select, width: "100%" }} value={chargeForm.currency} onChange={e => setChargeForm(f => ({ ...f, currency: e.target.value }))}>
                            <option value="eur">EUR</option><option value="usd">USD</option><option value="gbp">GBP</option>
                          </select>
                        </div>
                      </div>
                      <div><label style={S.label}>Descripción</label><input style={S.input} placeholder="Servicio de marketing..." value={chargeForm.description} onChange={e => setChargeForm(f => ({ ...f, description: e.target.value }))} /></div>
                      <div><label style={S.label}>Customer ID (opcional)</label><input style={S.input} placeholder="cus_XXXXXXXXX" value={chargeForm.customerId} onChange={e => setChargeForm(f => ({ ...f, customerId: e.target.value }))} /></div>
                      <div><label style={S.label}>Email recibo (opcional)</label><input style={S.input} type="email" placeholder="cliente@email.com" value={chargeForm.receiptEmail} onChange={e => setChargeForm(f => ({ ...f, receiptEmail: e.target.value }))} /></div>
                      <button style={{ ...S.btn, ...S.btnGold }} disabled={actionLoading || !chargeForm.amount} onClick={() => {
                        const amtCents = Math.round(parseFloat(chargeForm.amount) * 100);
                        doAction(`/stripe/accounts/${selectedAccount!.account_id}/charges`, "POST", { amount: amtCents, currency: chargeForm.currency, description: chargeForm.description, customerId: chargeForm.customerId || undefined, receiptEmail: chargeForm.receiptEmail || undefined });
                        setChargeForm({ amount: "", currency: "eur", description: "", customerId: "", receiptEmail: "" });
                      }}>{actionLoading ? "⏳ Creando..." : "⚡ Crear PaymentIntent"}</button>
                      {actionResult?.paymentIntent && (
                        <div style={S.successBanner}>
                          ✓ <strong>{actionResult.paymentIntent.id}</strong><br />
                          Estado: {actionResult.paymentIntent.status} · {fmtMoney(actionResult.paymentIntent.amount, actionResult.paymentIntent.currency)}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Refund */}
                  <div style={S.card}>
                    <h4 style={{ margin: "0 0 14px", fontSize: 14 }}>↩️ Crear Reembolso</h4>
                    <p style={{ fontSize: 12, color: "rgba(240,237,230,0.5)", marginBottom: 14 }}>Reembolsa un cobro existente total o parcialmente.</p>
                    <div style={{ display: "flex", flexDirection: "column" as const, gap: 10 }}>
                      <div><label style={S.label}>PaymentIntent ID *</label><input style={S.input} placeholder="pi_XXXXX o ch_XXXXX" value={refundForm.paymentIntentId} onChange={e => setRefundForm(f => ({ ...f, paymentIntentId: e.target.value }))} /></div>
                      <div><label style={S.label}>Importe a reembolsar (€, vacío = total)</label><input style={S.input} type="number" min="0.01" step="0.01" placeholder="Dejar vacío para reembolso total" value={refundForm.amount} onChange={e => setRefundForm(f => ({ ...f, amount: e.target.value }))} /></div>
                      <div><label style={S.label}>Motivo</label>
                        <select style={{ ...S.select, width: "100%" }} value={refundForm.reason} onChange={e => setRefundForm(f => ({ ...f, reason: e.target.value }))}>
                          <option value="requested_by_customer">Solicitado por cliente</option>
                          <option value="duplicate">Pago duplicado</option>
                          <option value="fraudulent">Fraudulento</option>
                        </select>
                      </div>
                      <button style={{ ...S.btn, ...S.btnDanger }} disabled={actionLoading || !refundForm.paymentIntentId} onClick={() => {
                        const amtCents = refundForm.amount ? Math.round(parseFloat(refundForm.amount) * 100) : undefined;
                        const isCharge = refundForm.paymentIntentId.startsWith("ch_");
                        doAction(`/stripe/accounts/${selectedAccount!.account_id}/refunds`, "POST", { [isCharge ? "chargeId" : "paymentIntentId"]: refundForm.paymentIntentId, amount: amtCents, reason: refundForm.reason });
                        setRefundForm({ paymentIntentId: "", amount: "", reason: "requested_by_customer" });
                      }}>{actionLoading ? "⏳ Procesando..." : "↩️ Emitir reembolso"}</button>
                      {actionResult?.refund && (
                        <div style={S.successBanner}>
                          ✓ Reembolso <strong>{actionResult.refund.id}</strong> — {fmtMoney(actionResult.refund.amount, actionResult.refund.currency)} — {actionResult.refund.status}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
