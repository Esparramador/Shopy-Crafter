import { useState, useEffect } from "react";

const API = import.meta.env.BASE_URL.replace(/\/$/, "") + "/api";

interface PlatformData {
  platformType: string;
  revenue: { total30d: number; orders30d: number; aov: number; trend: number; dailyChart: Array<{ date: string; revenue: number; orders: number }> };
  topProducts: Array<{ title: string; price: string; audit_score: number; audit_grade: string }>;
  events: Array<{ event_type: string; payload: string; created_at: string }>;
  inventoryAlerts: Array<{ product_title: string; variant_title: string; current_stock: number; days_remaining: number; status: string }>;
  cogsData: Array<{ title: string; total_cogs: number }>;
}

const STRIPE_INDIGO = "#635bff";
const STRIPE_LIGHT = "#897eff";

function MiniChart({ data, color }: { data: Array<{ revenue: number }>; color: string }) {
  if (!data || data.length < 2) return <div style={{ height: 48, display: "flex", alignItems: "center", justifyContent: "center", color: "rgba(255,255,255,0.2)", fontSize: 11 }}>Sin datos aún</div>;
  const max = Math.max(...data.map(d => d.revenue), 1);
  const w = 100, h = 48;
  const pts = data.map((d, i) => `${(i / (data.length - 1)) * w},${h - (d.revenue / max) * (h - 4) - 2}`).join(" ");
  return (
    <svg viewBox={`0 0 ${w} ${h}`} style={{ width: "100%", height: h, overflow: "visible" }}>
      <defs>
        <linearGradient id="sg2" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.35" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <polygon points={`0,${h} ${pts} ${w},${h}`} fill="url(#sg2)" />
      <polyline points={pts} fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function TrendBadge({ value }: { value: number }) {
  const up = value >= 0;
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 3, fontSize: 11, fontWeight: 700, padding: "2px 8px", borderRadius: 100, background: up ? "rgba(52,211,153,0.12)" : "rgba(244,63,94,0.12)", color: up ? "#34d399" : "#f43f5e", border: `1px solid ${up ? "rgba(52,211,153,0.25)" : "rgba(244,63,94,0.25)"}` }}>
      {up ? "↑" : "↓"} {Math.abs(value).toFixed(1)}%
    </span>
  );
}

export default function StripeDashboard({ apid }: { apid: (url: string) => string }) {
  const [data, setData] = useState<PlatformData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(apid(`${API}/client/platform-data`), { credentials: "include" })
      .then(r => r.json()).then(d => { setData(d); setLoading(false); }).catch(() => setLoading(false));
  }, []);

  const kpis = [
    { label: "Volumen 30d", value: loading ? "—" : `€${(data?.revenue.total30d ?? 0).toLocaleString("es-ES", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`, icon: "💳", color: STRIPE_INDIGO, trend: data?.revenue.trend },
    { label: "Transacciones", value: loading ? "—" : String(data?.revenue.orders30d ?? 0), icon: "⚡", color: STRIPE_LIGHT, trend: null },
    { label: "Ticket Medio", value: loading ? "—" : `€${(data?.revenue.aov ?? 0).toFixed(2)}`, icon: "📊", color: "#a78bfa", trend: null },
    { label: "Fee Stripe (est.)", value: loading ? "—" : `€${((data?.revenue.total30d ?? 0) * 0.029 + (data?.revenue.orders30d ?? 0) * 0.30).toFixed(2)}`, icon: "🔁", color: "#f59e0b", trend: null },
  ];

  const stripeFeeRate = 2.9;
  const stripeFixed = 0.30;
  const netRevenue = (data?.revenue.total30d ?? 0) - ((data?.revenue.total30d ?? 0) * stripeFeeRate / 100) - ((data?.revenue.orders30d ?? 0) * stripeFixed);

  return (
    <div>
      <style>{`
        @keyframes stripe-in{from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:translateY(0)}}
        .stripe-card{transition:transform 0.2s,box-shadow 0.2s!important;}
        .stripe-card:hover{transform:translateY(-3px)!important;box-shadow:0 14px 40px rgba(99,91,255,0.25)!important;}
        .stripe-row:hover{background:rgba(99,91,255,0.07)!important;}
      `}</style>

      {/* ── PLATFORM HEADER ── */}
      <div style={{ background: "linear-gradient(135deg,#0d0d1f 0%,#10102a 40%,#0a0a1f 100%)", border: `1px solid ${STRIPE_INDIGO}35`, borderRadius: 16, padding: "22px 24px 18px", marginBottom: 16, position: "relative", overflow: "hidden", animation: "stripe-in 0.4s ease" }}>
        <div style={{ position: "absolute", top: -60, right: -60, width: 200, height: 200, borderRadius: "50%", background: `radial-gradient(circle,${STRIPE_INDIGO}20 0%,transparent 70%)`, pointerEvents: "none" }} />
        <div style={{ display: "flex", alignItems: "center", gap: 12, position: "relative", zIndex: 1 }}>
          <div style={{ width: 42, height: 42, borderRadius: 12, background: `linear-gradient(135deg,${STRIPE_INDIGO},${STRIPE_LIGHT})`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22, boxShadow: `0 4px 16px ${STRIPE_INDIGO}50` }}>💳</div>
          <div>
            <h2 style={{ margin: 0, fontSize: 20, fontWeight: 800, color: "#fff" }}>Stripe Analytics</h2>
            <p style={{ margin: 0, fontSize: 11.5, color: "rgba(255,255,255,0.45)", marginTop: 2 }}>Pagos en tiempo real · revenue neto · fees reales</p>
          </div>
          <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 6 }}>
            <div style={{ width: 6, height: 6, borderRadius: "50%", background: "#34d399", boxShadow: "0 0 8px #34d399" }} />
            <span style={{ fontSize: 10.5, color: "#34d399", fontWeight: 600, letterSpacing: "0.05em", textTransform: "uppercase" }}>Conectado</span>
          </div>
        </div>
      </div>

      {/* ── KPI GRID ── */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(200px,1fr))", gap: 12, marginBottom: 16 }}>
        {kpis.map((k, i) => (
          <div key={k.label} className="stripe-card" style={{ background: "var(--srf)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 14, padding: "16px 18px", position: "relative", overflow: "hidden", animation: `stripe-in 0.4s ${i * 0.07}s ease both` }}>
            <div style={{ position: "absolute", inset: 0, background: `radial-gradient(ellipse at 110% 110%,${k.color}18 0%,transparent 65%)`, pointerEvents: "none" }} />
            <div style={{ position: "relative", zIndex: 1 }}>
              <div style={{ fontSize: 20, marginBottom: 6 }}>{k.icon}</div>
              <div style={{ fontSize: 26, fontWeight: 800, color: k.color, letterSpacing: "-0.02em" }}>{k.value}</div>
              <div style={{ fontSize: 11.5, color: "var(--t2)", marginTop: 3, display: "flex", alignItems: "center", gap: 6 }}>
                {k.label} {k.trend !== undefined && k.trend !== null && <TrendBadge value={k.trend} />}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* ── REVENUE NETO + FEE BREAKDOWN ── */}
      <div style={{ display: "grid", gridTemplateColumns: "1.4fr 1fr", gap: 12, marginBottom: 16 }}>
        <div style={{ background: "var(--srf)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 14, padding: "18px 20px" }}>
          <p style={{ margin: "0 0 4px", fontSize: 10, color: "var(--t3)", textTransform: "uppercase", letterSpacing: "0.1em" }}>Volumen de Pagos — 30 días</p>
          <p style={{ margin: "0 0 12px", fontSize: 22, fontWeight: 800, color: STRIPE_INDIGO }}>
            €{(data?.revenue.total30d ?? 0).toLocaleString("es-ES")}
            <span style={{ marginLeft: 8 }}>{data && <TrendBadge value={data.revenue.trend} />}</span>
          </p>
          <MiniChart data={data?.revenue.dailyChart ?? []} color={STRIPE_INDIGO} />
        </div>
        <div style={{ background: "var(--srf)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 14, padding: "18px 20px" }}>
          <p style={{ margin: "0 0 12px", fontSize: 10, color: "var(--t3)", textTransform: "uppercase", letterSpacing: "0.1em" }}>💡 Desglose Revenue Neto</p>
          {[
            { label: "Revenue Bruto", value: data?.revenue.total30d ?? 0, color: "#34d399" },
            { label: `Fee Stripe (2.9% + 0.30€ × ${data?.revenue.orders30d ?? 0})`, value: -((data?.revenue.total30d ?? 0) * 0.029 + (data?.revenue.orders30d ?? 0) * 0.30), color: "#f43f5e" },
            { label: "Revenue Neto Estimado", value: netRevenue, color: STRIPE_LIGHT, bold: true },
          ].map((row, i) => (
            <div key={i} className="stripe-row" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "9px 6px", borderRadius: 8, borderBottom: i < 2 ? "1px solid rgba(255,255,255,0.04)" : "none" }}>
              <span style={{ fontSize: i === 2 ? 12 : 11, color: i === 2 ? "var(--t1)" : "var(--t2)", fontWeight: row.bold ? 700 : 400 }}>{row.label}</span>
              <span style={{ fontSize: i === 2 ? 14 : 12, fontWeight: row.bold ? 800 : 600, color: row.color }}>
                {row.value >= 0 ? "" : "-"}€{Math.abs(row.value).toFixed(2)}
              </span>
            </div>
          ))}
          <div style={{ marginTop: 10, padding: "8px 10px", background: `${STRIPE_INDIGO}15`, borderRadius: 8, border: `1px solid ${STRIPE_INDIGO}30` }}>
            <p style={{ margin: 0, fontSize: 10.5, color: "var(--t3)" }}>Tarifa Stripe estándar UE: 2.9% + €0.30 por transacción. Para tarifas personalizadas, consulta tu cuenta Stripe.</p>
          </div>
        </div>
      </div>

      {/* ── EVENTOS DE PAGO ── */}
      <div style={{ background: "var(--srf)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 14, padding: "18px 20px", marginBottom: 12 }}>
        <p style={{ margin: "0 0 12px", fontSize: 10, color: "var(--t3)", textTransform: "uppercase", letterSpacing: "0.1em" }}>⚡ Eventos de Pago en Tiempo Real</p>
        {loading ? <div style={{ color: "var(--t3)", fontSize: 12 }}>Cargando...</div>
          : (data?.events.length ?? 0) === 0 ? (
            <div style={{ color: "var(--t3)", fontSize: 12, textAlign: "center", padding: "12px 0" }}>
              Sin eventos aún. Los pagos aparecerán aquí cuando configures el webhook de Stripe.
            </div>
          ) : data?.events.slice(0, 10).map((e, i) => {
            const isPayment = e.event_type?.includes("stripe") || e.event_type?.includes("payment");
            const isRefund = e.event_type?.includes("refund");
            const icon = isRefund ? "↩️" : isPayment ? "💳" : "📋";
            const color = isRefund ? "#f43f5e" : isPayment ? STRIPE_INDIGO : "var(--t2)";
            return (
              <div key={i} className="stripe-row" style={{ display: "flex", alignItems: "flex-start", gap: 10, padding: "8px 6px", borderRadius: 8, borderBottom: i < 9 ? "1px solid rgba(255,255,255,0.04)" : "none" }}>
                <span style={{ fontSize: 14, flexShrink: 0, marginTop: 1 }}>{icon}</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 12, color, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{e.payload}</div>
                  <div style={{ fontSize: 10, color: "var(--t3)", marginTop: 2 }}>{new Date(e.created_at).toLocaleString("es-ES", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}</div>
                </div>
              </div>
            );
          })}
      </div>

      {/* ── STRIPE WEBHOOK SETUP ── */}
      <div style={{ background: "rgba(99,91,255,0.05)", border: `1px solid ${STRIPE_INDIGO}25`, borderRadius: 14, padding: "16px 20px" }}>
        <p style={{ margin: "0 0 8px", fontSize: 11, fontWeight: 700, color: STRIPE_LIGHT, textTransform: "uppercase", letterSpacing: "0.08em" }}>⚙️ Configurar Webhooks Stripe</p>
        <p style={{ margin: "0 0 6px", fontSize: 11.5, color: "var(--t2)" }}>Conecta tu cuenta Stripe para recibir eventos de pago automáticamente:</p>
        <p style={{ margin: 0, fontSize: 11, color: "var(--t3)", fontFamily: "monospace", background: "rgba(0,0,0,0.3)", padding: "6px 10px", borderRadius: 6 }}>
          Stripe Dashboard → Developers → Webhooks → Add endpoint<br />
          URL: .../api/webhooks/stripe<br />
          Eventos: invoice.paid · charge.succeeded · customer.subscription.deleted
        </p>
      </div>
    </div>
  );
}
