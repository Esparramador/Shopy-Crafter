import { useEffect, useState } from "react";
import { ClientLayout } from "./ClientLayout";
import { useAuth } from "@/contexts/AuthContext";
import { useClientPreview } from "./ClientPreviewContext";
import {
  StripeHeader, NotConnected, StatusPill, money, fmtDate, STRIPE_INDIGO, STRIPE_LIGHT,
  type StripeConnectionLite,
} from "./StripeDashboard";

const API = import.meta.env.BASE_URL.replace(/\/$/, "") + "/api";

type Tab = "charges" | "customers" | "subscriptions" | "invoices" | "payouts";
const TABS: Array<{ id: Tab; label: string; icon: string }> = [
  { id: "charges",       label: "Pagos",          icon: "💳" },
  { id: "customers",     label: "Clientes",       icon: "👥" },
  { id: "subscriptions", label: "Suscripciones",  icon: "🔁" },
  { id: "invoices",      label: "Facturas",       icon: "🧾" },
  { id: "payouts",       label: "Transferencias", icon: "🏦" },
];

const th: React.CSSProperties = { textAlign: "left", fontSize: 10, color: "var(--t3)", textTransform: "uppercase", letterSpacing: "0.08em", padding: "8px 10px", borderBottom: "1px solid rgba(255,255,255,0.06)", fontWeight: 600 };
const td: React.CSSProperties = { fontSize: 12, color: "var(--t)", padding: "9px 10px", borderBottom: "1px solid rgba(255,255,255,0.04)", verticalAlign: "middle" };

export default function ClientStripe() {
  const { user } = useAuth();
  const { previewPid } = useClientPreview();
  const isAdmin = user?.role === "admin";
  const apid = (url: string) => isAdmin && previewPid ? `${url}${url.includes("?") ? "&" : "?"}pid=${encodeURIComponent(previewPid)}` : url;

  const [conn, setConn] = useState<StripeConnectionLite | null>(null);
  const [tab, setTab] = useState<Tab>("charges");
  const [rows, setRows] = useState<any[]>([]);
  const [extra, setExtra] = useState<any>(null);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [q, setQ] = useState("");

  useEffect(() => {
    fetch(apid(`${API}/client/stripe/connection`), { credentials: "include" })
      .then(r => r.json()).then(setConn).catch(() => setConn({ connected: false, keyMode: null, displayName: null, email: null, country: null, currency: null, connectedAt: null }));
  }, [previewPid]);

  useEffect(() => {
    if (!conn?.connected) { setLoading(false); return; }
    let alive = true;
    setLoading(true); setError(null); setRows([]); setExtra(null);
    const qs = tab === "customers" && q.trim() ? `?q=${encodeURIComponent(q.trim())}` : "";
    fetch(apid(`${API}/client/stripe/${tab}${qs}`), { credentials: "include" })
      .then(async r => {
        const d = await r.json();
        if (!alive) return;
        if (!r.ok) { setError(d?.error ?? "Error cargando datos"); return; }
        setRows(d.data ?? []); setHasMore(!!d.hasMore); setExtra(d);
      })
      .catch(e => alive && setError(e?.message ?? "Error de red"))
      .finally(() => alive && setLoading(false));
    return () => { alive = false; };
  }, [tab, conn?.connected, previewPid, q]);

  const cur = conn?.currency ?? "eur";

  return (
    <ClientLayout>
      <div style={{ maxWidth: 1020 }}>
        <style>{`@keyframes stripe-in{from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:translateY(0)}} .stripe-row:hover{background:rgba(99,91,255,0.07)!important;}`}</style>
        <StripeHeader conn={conn} subtitle="Actividad completa de tu cuenta · solo lectura" />

        {conn && !conn.connected && <NotConnected />}

        {conn?.connected && (
          <>
            <div style={{ display: "flex", gap: 6, marginBottom: 14, flexWrap: "wrap" }}>
              {TABS.map(t => (
                <button key={t.id} onClick={() => setTab(t.id)} style={{ background: tab === t.id ? `${STRIPE_INDIGO}22` : "var(--srf)", border: `1px solid ${tab === t.id ? STRIPE_INDIGO : "rgba(255,255,255,0.08)"}`, color: tab === t.id ? "#fff" : "var(--t2)", borderRadius: 10, padding: "7px 14px", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>
                  {t.icon} {t.label}
                </button>
              ))}
              {tab === "customers" && (
                <input value={q} onChange={e => setQ(e.target.value)} placeholder="Buscar por email o nombre…" style={{ marginLeft: "auto", background: "var(--srf)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 10, padding: "7px 12px", color: "#fff", fontSize: 12, minWidth: 220 }} />
              )}
            </div>

            {tab === "payouts" && extra?.balance && (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(200px,1fr))", gap: 12, marginBottom: 14 }}>
                <div style={{ background: "var(--srf)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 14, padding: "14px 18px" }}>
                  <div style={{ fontSize: 10, color: "var(--t3)", textTransform: "uppercase", letterSpacing: "0.1em" }}>Disponible</div>
                  <div style={{ fontSize: 22, fontWeight: 800, color: "#34d399" }}>{money(extra.balance.available, extra.balance.currency)}</div>
                </div>
                <div style={{ background: "var(--srf)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 14, padding: "14px 18px" }}>
                  <div style={{ fontSize: 10, color: "var(--t3)", textTransform: "uppercase", letterSpacing: "0.1em" }}>Pendiente</div>
                  <div style={{ fontSize: 22, fontWeight: 800, color: "#f59e0b" }}>{money(extra.balance.pending, extra.balance.currency)}</div>
                </div>
              </div>
            )}

            <div style={{ background: "var(--srf)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 14, overflow: "hidden", animation: "stripe-in 0.3s ease" }}>
              {error && <div style={{ padding: 16, fontSize: 12, color: "#f43f5e" }}>{error}</div>}
              {loading && <div style={{ padding: 24, fontSize: 12, color: "var(--t3)", textAlign: "center" }}>Cargando desde Stripe…</div>}
              {!loading && !error && rows.length === 0 && <div style={{ padding: 24, fontSize: 12, color: "var(--t3)", textAlign: "center" }}>No hay registros todavía.</div>}

              {!loading && !error && rows.length > 0 && (
                <div style={{ overflowX: "auto" }}>
                  <table style={{ width: "100%", borderCollapse: "collapse" }}>
                    {tab === "charges" && (
                      <>
                        <thead><tr><th style={th}>Fecha</th><th style={th}>Concepto</th><th style={th}>Método</th><th style={th}>Estado</th><th style={{ ...th, textAlign: "right" }}>Importe</th></tr></thead>
                        <tbody>{rows.map(c => (
                          <tr key={c.id} className="stripe-row">
                            <td style={td}>{fmtDate(c.created, true)}</td>
                            <td style={{ ...td, maxWidth: 320, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                              {c.description || c.receiptEmail || c.id}
                              {c.failureMessage && <div style={{ fontSize: 10, color: "#f43f5e" }}>{c.failureMessage}</div>}
                            </td>
                            <td style={td}>{c.cardBrand ? `${c.cardBrand} •••• ${c.last4}` : (c.paymentMethod ?? "—")}</td>
                            <td style={td}><StatusPill status={c.refunded ? "refunded" : c.status} /></td>
                            <td style={{ ...td, textAlign: "right", fontWeight: 700 }}>
                              {money(c.amount, c.currency)}
                              {c.amountRefunded > 0 && <div style={{ fontSize: 10, color: "#94a3b8" }}>−{money(c.amountRefunded, c.currency)} reemb.</div>}
                              {c.receiptUrl && <a href={c.receiptUrl} target="_blank" rel="noreferrer" style={{ display: "block", fontSize: 10, color: STRIPE_LIGHT }}>Recibo ↗</a>}
                            </td>
                          </tr>
                        ))}</tbody>
                      </>
                    )}
                    {tab === "customers" && (
                      <>
                        <thead><tr><th style={th}>Cliente</th><th style={th}>Email</th><th style={th}>Alta</th><th style={th}>Estado</th><th style={{ ...th, textAlign: "right" }}>Saldo</th></tr></thead>
                        <tbody>{rows.map(c => (
                          <tr key={c.id} className="stripe-row">
                            <td style={{ ...td, fontWeight: 600 }}>{c.name || "—"}</td>
                            <td style={td}>{c.email || "—"}</td>
                            <td style={td}>{fmtDate(c.created)}</td>
                            <td style={td}>{c.delinquent ? <StatusPill status="past_due" /> : <StatusPill status="active" />}</td>
                            <td style={{ ...td, textAlign: "right" }}>{c.balance ? money(-c.balance, c.currency ?? cur) : "—"}</td>
                          </tr>
                        ))}</tbody>
                      </>
                    )}
                    {tab === "subscriptions" && (
                      <>
                        <thead><tr><th style={th}>Cliente</th><th style={th}>Plan</th><th style={th}>Estado</th><th style={th}>Renueva</th><th style={{ ...th, textAlign: "right" }}>Importe</th></tr></thead>
                        <tbody>{rows.map(s => (
                          <tr key={s.id} className="stripe-row">
                            <td style={td}>{s.customerName || s.customerEmail || s.customerId || "—"}{s.customerName && s.customerEmail && <div style={{ fontSize: 10, color: "var(--t3)" }}>{s.customerEmail}</div>}</td>
                            <td style={td}>{s.productName || s.priceNickname || "—"}{s.quantity > 1 ? ` ×${s.quantity}` : ""}</td>
                            <td style={td}><StatusPill status={s.status} />{s.cancelAtPeriodEnd && <div style={{ fontSize: 10, color: "#f59e0b" }}>se cancela al final del periodo</div>}</td>
                            <td style={td}>{fmtDate(s.currentPeriodEnd)}</td>
                            <td style={{ ...td, textAlign: "right", fontWeight: 700 }}>{s.amount != null ? `${money(s.amount, s.currency)}${s.interval ? ` / ${s.interval === "month" ? "mes" : s.interval === "year" ? "año" : s.interval}` : ""}` : "—"}</td>
                          </tr>
                        ))}</tbody>
                      </>
                    )}
                    {tab === "invoices" && (
                      <>
                        <thead><tr><th style={th}>Nº</th><th style={th}>Cliente</th><th style={th}>Fecha</th><th style={th}>Estado</th><th style={{ ...th, textAlign: "right" }}>Importe</th></tr></thead>
                        <tbody>{rows.map(i => (
                          <tr key={i.id} className="stripe-row">
                            <td style={{ ...td, fontFamily: "monospace" }}>{i.number || i.id.slice(0, 12)}</td>
                            <td style={td}>{i.customerName || i.customerEmail || "—"}</td>
                            <td style={td}>{fmtDate(i.created)}{i.dueDate && i.status === "open" && <div style={{ fontSize: 10, color: "#f59e0b" }}>vence {fmtDate(i.dueDate)}</div>}</td>
                            <td style={td}><StatusPill status={i.status ?? "draft"} /></td>
                            <td style={{ ...td, textAlign: "right", fontWeight: 700 }}>
                              {money(i.amountDue, i.currency)}
                              {i.amountRemaining > 0 && i.status === "open" && <div style={{ fontSize: 10, color: "#f59e0b" }}>pendiente {money(i.amountRemaining, i.currency)}</div>}
                              {(i.hostedInvoiceUrl || i.invoicePdf) && <a href={i.invoicePdf || i.hostedInvoiceUrl} target="_blank" rel="noreferrer" style={{ display: "block", fontSize: 10, color: STRIPE_LIGHT }}>{i.invoicePdf ? "PDF ↗" : "Ver ↗"}</a>}
                            </td>
                          </tr>
                        ))}</tbody>
                      </>
                    )}
                    {tab === "payouts" && (
                      <>
                        <thead><tr><th style={th}>Llegada</th><th style={th}>Creada</th><th style={th}>Método</th><th style={th}>Estado</th><th style={{ ...th, textAlign: "right" }}>Importe</th></tr></thead>
                        <tbody>{rows.map(p => (
                          <tr key={p.id} className="stripe-row">
                            <td style={td}>{fmtDate(p.arrivalDate)}</td>
                            <td style={td}>{fmtDate(p.created)}</td>
                            <td style={td}>{p.method}{p.type ? ` · ${p.type}` : ""}</td>
                            <td style={td}><StatusPill status={p.status} />{p.failureMessage && <div style={{ fontSize: 10, color: "#f43f5e" }}>{p.failureMessage}</div>}</td>
                            <td style={{ ...td, textAlign: "right", fontWeight: 700 }}>{money(p.amount, p.currency)}</td>
                          </tr>
                        ))}</tbody>
                      </>
                    )}
                  </table>
                </div>
              )}
              {!loading && hasMore && <div style={{ padding: "8px 12px", fontSize: 10.5, color: "var(--t3)", borderTop: "1px solid rgba(255,255,255,0.05)" }}>Mostrando los más recientes. Para el histórico completo, consulta tu Dashboard de Stripe.</div>}
            </div>
          </>
        )}
      </div>
    </ClientLayout>
  );
}
