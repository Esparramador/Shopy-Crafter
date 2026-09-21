import { useState, useEffect } from "react";
import { Link } from "wouter";

const API = import.meta.env.BASE_URL.replace(/\/$/, "") + "/api";

export interface StripeOverview {
  connected: boolean;
  currency: string;
  warnings: string[];
  balance: { available: number; pending: number } | null;
  volume30: number;
  count30: number;
  failed30: number;
  refunded30: number;
  aov: number;
  trend: number;
  mrr: number;
  activeSubCount: number;
  pastDueSubCount: number;
  customerCount: number;
  customerHasMore: boolean;
  openInvoiceCount: number;
  openInvoiceAmount: number;
  dailyChart: Array<{ date: string; amount: number; count: number }>;
  recentCharges: Array<{ id: string; amount: number; currency: string; status: string; description: string | null; created: number; receiptEmail: string | null; refunded: boolean; amountRefunded: number; paymentMethod: string | null }>;
  nextPayouts: Array<{ id: string; amount: number; currency: string; status: string; arrivalDate: number }>;
}

export interface StripeConnectionLite {
  connected: boolean;
  keyMode: "live" | "test" | null;
  displayName: string | null;
  email: string | null;
  country: string | null;
  currency: string | null;
  connectedAt: string | null;
}

export const STRIPE_INDIGO = "#635bff";
export const STRIPE_LIGHT = "#897eff";

export function money(cents: number | null | undefined, currency = "eur"): string {
  const v = (cents ?? 0) / 100;
  try {
    return v.toLocaleString("es-ES", { style: "currency", currency: currency.toUpperCase(), maximumFractionDigits: 2 });
  } catch {
    return `${v.toFixed(2)} ${currency.toUpperCase()}`;
  }
}

export function fmtDate(ts: number | string | null | undefined, withTime = false): string {
  if (!ts) return "—";
  const d = typeof ts === "number" ? new Date(ts * 1000) : new Date(ts);
  return d.toLocaleString("es-ES", withTime
    ? { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }
    : { day: "2-digit", month: "short", year: "numeric" });
}

export const STATUS_COLOR: Record<string, string> = {
  succeeded: "#34d399", paid: "#34d399", active: "#34d399", trialing: "#60a5fa",
  pending: "#f59e0b", open: "#f59e0b", in_transit: "#f59e0b", past_due: "#f97316", unpaid: "#f97316",
  failed: "#f43f5e", canceled: "#94a3b8", void: "#94a3b8", uncollectible: "#f43f5e", draft: "#94a3b8",
  incomplete: "#f59e0b", incomplete_expired: "#94a3b8", paused: "#94a3b8", refunded: "#94a3b8",
};

export function StatusPill({ status }: { status: string }) {
  const c = STATUS_COLOR[status] ?? "var(--t2)";
  return (
    <span style={{ fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 100, background: `${c}18`, color: c, border: `1px solid ${c}35`, textTransform: "uppercase", letterSpacing: "0.04em", whiteSpace: "nowrap" }}>
      {status.replace(/_/g, " ")}
    </span>
  );
}

function MiniChart({ data, color }: { data: Array<{ amount: number }>; color: string }) {
  if (!data || data.length < 2 || data.every(d => d.amount === 0)) {
    return <div style={{ height: 56, display: "flex", alignItems: "center", justifyContent: "center", color: "rgba(255,255,255,0.25)", fontSize: 11 }}>Sin pagos en los últimos 30 días</div>;
  }
  const max = Math.max(...data.map(d => d.amount), 1);
  const w = 100, h = 56;
  const pts = data.map((d, i) => `${(i / (data.length - 1)) * w},${h - (d.amount / max) * (h - 4) - 2}`).join(" ");
  return (
    <svg viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" style={{ width: "100%", height: h, overflow: "visible" }}>
      <defs>
        <linearGradient id="sg-stripe" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.35" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <polygon points={`0,${h} ${pts} ${w},${h}`} fill="url(#sg-stripe)" />
      <polyline points={pts} fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
    </svg>
  );
}

function TrendBadge({ value }: { value: number }) {
  const up = value >= 0;
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 3, fontSize: 11, fontWeight: 700, padding: "2px 8px", borderRadius: 100, background: up ? "rgba(52,211,153,0.12)" : "rgba(244,63,94,0.12)", color: up ? "#34d399" : "#f43f5e", border: `1px solid ${up ? "rgba(52,211,153,0.25)" : "rgba(244,63,94,0.25)"}` }}>
      {up ? "↑" : "↓"} {Math.abs(value).toFixed(1)}% vs 30d ant.
    </span>
  );
}

export function StripeHeader({ conn, subtitle, right }: { conn: StripeConnectionLite | null; subtitle: string; right?: React.ReactNode }) {
  return (
    <div style={{ background: "linear-gradient(135deg,#0d0d1f 0%,#10102a 40%,#0a0a1f 100%)", border: `1px solid ${STRIPE_INDIGO}35`, borderRadius: 16, padding: "20px 24px 16px", marginBottom: 16, position: "relative", overflow: "hidden", animation: "stripe-in 0.4s ease" }}>
      <div style={{ position: "absolute", top: -60, right: -60, width: 200, height: 200, borderRadius: "50%", background: `radial-gradient(circle,${STRIPE_INDIGO}20 0%,transparent 70%)`, pointerEvents: "none" }} />
      <div style={{ display: "flex", alignItems: "center", gap: 12, position: "relative", zIndex: 1, flexWrap: "wrap" }}>
        <div style={{ width: 42, height: 42, borderRadius: 12, background: `linear-gradient(135deg,${STRIPE_INDIGO},${STRIPE_LIGHT})`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22, boxShadow: `0 4px 16px ${STRIPE_INDIGO}50` }}>💳</div>
        <div style={{ minWidth: 0 }}>
          <h2 style={{ margin: 0, fontSize: 20, fontWeight: 800, color: "#fff" }}>{conn?.displayName || "Tu cuenta Stripe"}</h2>
          <p style={{ margin: 0, fontSize: 11.5, color: "rgba(255,255,255,0.45)", marginTop: 2 }}>
            {subtitle}{conn?.email ? ` · ${conn.email}` : ""}{conn?.country ? ` · ${conn.country}` : ""}
          </p>
        </div>
        <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 10 }}>
          {right}
          {conn?.connected ? (
            <>
              {conn.keyMode && (
                <span style={{ fontSize: 10, fontWeight: 800, padding: "3px 9px", borderRadius: 100, letterSpacing: "0.06em", background: conn.keyMode === "live" ? "rgba(52,211,153,0.14)" : "rgba(245,158,11,0.14)", color: conn.keyMode === "live" ? "#34d399" : "#f59e0b", border: `1px solid ${conn.keyMode === "live" ? "rgba(52,211,153,0.3)" : "rgba(245,158,11,0.3)"}` }}>
                  {conn.keyMode === "live" ? "LIVE" : "MODO TEST"}
                </span>
              )}
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <div style={{ width: 6, height: 6, borderRadius: "50%", background: "#34d399", boxShadow: "0 0 8px #34d399" }} />
                <span style={{ fontSize: 10.5, color: "#34d399", fontWeight: 600, letterSpacing: "0.05em", textTransform: "uppercase" }}>Conectado</span>
              </div>
            </>
          ) : conn === null ? (
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <div style={{ width: 6, height: 6, borderRadius: "50%", background: "rgba(255,255,255,0.35)" }} />
              <span style={{ fontSize: 10.5, color: "rgba(255,255,255,0.45)", fontWeight: 600, letterSpacing: "0.05em", textTransform: "uppercase" }}>Comprobando…</span>
            </div>
          ) : (
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <div style={{ width: 6, height: 6, borderRadius: "50%", background: "#f43f5e" }} />
              <span style={{ fontSize: 10.5, color: "#f43f5e", fontWeight: 600, letterSpacing: "0.05em", textTransform: "uppercase" }}>Sin vincular</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export function NotConnected() {
  return (
    <div style={{ background: "rgba(244,63,94,0.06)", border: "1px solid rgba(244,63,94,0.25)", borderRadius: 14, padding: "22px 24px", textAlign: "center" }}>
      <div style={{ fontSize: 30, marginBottom: 8 }}>🔌</div>
      <p style={{ margin: "0 0 6px", fontSize: 14, fontWeight: 700, color: "#fff" }}>Tu cuenta Stripe todavía no está vinculada</p>
      <p style={{ margin: 0, fontSize: 12, color: "var(--t2)", lineHeight: 1.5 }}>
        Tu agencia debe añadir la clave secreta de tu cuenta Stripe en el proyecto. En cuanto lo haga, aquí verás
        saldo, pagos, clientes, suscripciones y facturas en tiempo real.
      </p>
      <Link href="/client/messages">
        <span style={{ display: "inline-block", marginTop: 12, fontSize: 12, fontWeight: 700, color: STRIPE_LIGHT, cursor: "pointer" }}>Escribir a mi agencia →</span>
      </Link>
    </div>
  );
}

export function useStripeClient(apid: (url: string) => string) {
  const [conn, setConn] = useState<StripeConnectionLite | null>(null);
  const [overview, setOverview] = useState<StripeOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const c = await fetch(apid(`${API}/client/stripe/connection`), { credentials: "include" }).then(r => r.json());
        if (!alive) return;
        setConn(c);
        if (!c?.connected) { setLoading(false); return; }
        const r = await fetch(apid(`${API}/client/stripe/overview`), { credentials: "include" });
        const d = await r.json();
        if (!alive) return;
        if (!r.ok) setError(d?.error ?? "No se pudo cargar la actividad de Stripe");
        else setOverview(d);
      } catch (e: any) {
        if (alive) setError(e?.message ?? "Error de red");
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, []);

  return { conn, overview, loading, error };
}

export default function StripeDashboard({ apid }: { apid: (url: string) => string }) {
  const { conn, overview: data, loading, error } = useStripeClient(apid);
  const cur = data?.currency ?? conn?.currency ?? "eur";

  const kpis = [
    { label: "Cobrado 30d", value: loading ? "—" : money(data?.volume30, cur), icon: "💳", color: STRIPE_INDIGO, trend: data?.trend, sub: `${data?.count30 ?? 0} pagos correctos` },
    { label: "Saldo disponible", value: loading ? "—" : money(data?.balance?.available, cur), icon: "🏦", color: "#34d399", trend: null, sub: `${money(data?.balance?.pending, cur)} pendiente` },
    { label: "MRR", value: loading ? "—" : money(data?.mrr, cur), icon: "🔁", color: STRIPE_LIGHT, trend: null, sub: `${data?.activeSubCount ?? 0} suscripciones activas` },
    { label: "Ticket medio", value: loading ? "—" : money(data?.aov, cur), icon: "📊", color: "#a78bfa", trend: null, sub: `${data?.customerCount ?? 0}${data?.customerHasMore ? "+" : ""} clientes` },
  ];

  const alerts: Array<{ icon: string; text: string; color: string }> = [];
  if ((data?.failed30 ?? 0) > 0) alerts.push({ icon: "⚠️", text: `${data!.failed30} pago(s) fallido(s) en 30 días`, color: "#f43f5e" });
  if ((data?.pastDueSubCount ?? 0) > 0) alerts.push({ icon: "⏰", text: `${data!.pastDueSubCount} suscripción(es) con pago atrasado`, color: "#f97316" });
  if ((data?.openInvoiceCount ?? 0) > 0) alerts.push({ icon: "🧾", text: `${data!.openInvoiceCount} factura(s) abierta(s) · ${money(data!.openInvoiceAmount, cur)}`, color: "#f59e0b" });
  if ((data?.refunded30 ?? 0) > 0) alerts.push({ icon: "↩️", text: `${money(data!.refunded30, cur)} reembolsados en 30 días`, color: "#94a3b8" });

  return (
    <div>
      <style>{`
        @keyframes stripe-in{from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:translateY(0)}}
        .stripe-card{transition:transform 0.2s,box-shadow 0.2s!important;}
        .stripe-card:hover{transform:translateY(-3px)!important;box-shadow:0 14px 40px rgba(99,91,255,0.25)!important;}
        .stripe-row:hover{background:rgba(99,91,255,0.07)!important;}
      `}</style>

      <StripeHeader conn={conn} subtitle="Saldo, pagos y suscripciones en tiempo real desde Stripe" />

      {!loading && conn && !conn.connected && <NotConnected />}
      {error && (
        <div style={{ background: "rgba(244,63,94,0.08)", border: "1px solid rgba(244,63,94,0.3)", borderRadius: 12, padding: "12px 16px", marginBottom: 16, fontSize: 12, color: "#f43f5e" }}>{error}</div>
      )}

      {(loading || data) && (
        <>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(200px,1fr))", gap: 12, marginBottom: 16 }}>
            {kpis.map((k, i) => (
              <div key={k.label} className="stripe-card" style={{ background: "var(--srf)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 14, padding: "16px 18px", position: "relative", overflow: "hidden", animation: `stripe-in 0.4s ${i * 0.07}s ease both` }}>
                <div style={{ position: "absolute", inset: 0, background: `radial-gradient(ellipse at 110% 110%,${k.color}18 0%,transparent 65%)`, pointerEvents: "none" }} />
                <div style={{ position: "relative", zIndex: 1 }}>
                  <div style={{ fontSize: 20, marginBottom: 6 }}>{k.icon}</div>
                  <div style={{ fontSize: 24, fontWeight: 800, color: k.color, letterSpacing: "-0.02em" }}>{k.value}</div>
                  <div style={{ fontSize: 11.5, color: "var(--t2)", marginTop: 3 }}>{k.label}</div>
                  <div style={{ fontSize: 10.5, color: "var(--t3)", marginTop: 4, display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                    {k.sub}{k.trend !== undefined && k.trend !== null && <TrendBadge value={k.trend} />}
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1.4fr 1fr", gap: 12, marginBottom: 16 }}>
            <div style={{ background: "var(--srf)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 14, padding: "18px 20px" }}>
              <p style={{ margin: "0 0 4px", fontSize: 10, color: "var(--t3)", textTransform: "uppercase", letterSpacing: "0.1em" }}>Cobros diarios — 30 días</p>
              <p style={{ margin: "0 0 12px", fontSize: 22, fontWeight: 800, color: STRIPE_INDIGO }}>{loading ? "—" : money(data?.volume30, cur)}</p>
              <MiniChart data={data?.dailyChart ?? []} color={STRIPE_INDIGO} />
            </div>
            <div style={{ background: "var(--srf)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 14, padding: "18px 20px" }}>
              <p style={{ margin: "0 0 10px", fontSize: 10, color: "var(--t3)", textTransform: "uppercase", letterSpacing: "0.1em" }}>Alertas</p>
              {loading ? <div style={{ color: "var(--t3)", fontSize: 12 }}>Cargando…</div>
                : alerts.length === 0 ? <div style={{ color: "#34d399", fontSize: 12 }}>✅ Todo en orden: sin pagos fallidos, impagos ni facturas abiertas.</div>
                : alerts.map((a, i) => (
                  <div key={i} style={{ display: "flex", gap: 8, alignItems: "center", padding: "6px 0", borderBottom: i < alerts.length - 1 ? "1px solid rgba(255,255,255,0.04)" : "none", fontSize: 12, color: a.color }}>
                    <span>{a.icon}</span><span>{a.text}</span>
                  </div>
                ))}
              {(data?.nextPayouts?.length ?? 0) > 0 && (
                <div style={{ marginTop: 12, paddingTop: 10, borderTop: "1px solid rgba(255,255,255,0.06)" }}>
                  <p style={{ margin: "0 0 6px", fontSize: 10, color: "var(--t3)", textTransform: "uppercase", letterSpacing: "0.1em" }}>Últimas transferencias</p>
                  {data!.nextPayouts.slice(0, 3).map(p => (
                    <div key={p.id} style={{ display: "flex", justifyContent: "space-between", fontSize: 11.5, padding: "3px 0", color: "var(--t2)" }}>
                      <span>{fmtDate(p.arrivalDate)}</span>
                      <span style={{ display: "flex", gap: 6, alignItems: "center" }}>{money(p.amount, p.currency)} <StatusPill status={p.status} /></span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div style={{ background: "var(--srf)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 14, padding: "18px 20px", marginBottom: 16 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
              <p style={{ margin: 0, fontSize: 10, color: "var(--t3)", textTransform: "uppercase", letterSpacing: "0.1em" }}>Últimos pagos</p>
              <Link href="/client/stripe"><span style={{ fontSize: 11.5, color: STRIPE_LIGHT, fontWeight: 700, cursor: "pointer" }}>Ver toda la actividad →</span></Link>
            </div>
            {loading ? <div style={{ color: "var(--t3)", fontSize: 12 }}>Cargando…</div>
              : (data?.recentCharges.length ?? 0) === 0 ? (
                <div style={{ color: "var(--t3)", fontSize: 12, textAlign: "center", padding: "12px 0" }}>Todavía no hay pagos en esta cuenta.</div>
              ) : data!.recentCharges.map((c, i) => (
                <div key={c.id} className="stripe-row" style={{ display: "grid", gridTemplateColumns: "1fr auto auto", gap: 12, alignItems: "center", padding: "8px 6px", borderRadius: 8, borderBottom: i < data!.recentCharges.length - 1 ? "1px solid rgba(255,255,255,0.04)" : "none" }}>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: 12, color: "#fff", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{c.description || c.receiptEmail || c.id}</div>
                    <div style={{ fontSize: 10, color: "var(--t3)", marginTop: 2 }}>{fmtDate(c.created, true)}{c.paymentMethod ? ` · ${c.paymentMethod}` : ""}{c.refunded ? " · reembolsado" : ""}</div>
                  </div>
                  <StatusPill status={c.status} />
                  <div style={{ fontSize: 13, fontWeight: 700, color: c.status === "succeeded" ? "#fff" : "var(--t3)", textAlign: "right" }}>{money(c.amount, c.currency)}</div>
                </div>
              ))}
          </div>

          {(data?.warnings?.length ?? 0) > 0 && (
            <p style={{ fontSize: 10.5, color: "var(--t3)" }}>Algunos datos no se pudieron cargar de Stripe: {data!.warnings.join(" · ")}</p>
          )}
        </>
      )}
    </div>
  );
}
