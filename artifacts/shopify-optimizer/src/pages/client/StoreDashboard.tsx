import { useState, useEffect } from "react";

const API = import.meta.env.BASE_URL.replace(/\/$/, "") + "/api";

interface PlatformData {
  platformType: string;
  revenue: { total30d: number; orders30d: number; aov: number; trend: number | null; dailyChart: Array<{ date: string; revenue: number; orders: number }> };
  lastDataDate?: string | null;
  topProducts: Array<{ title: string; price: string; audit_score: number; audit_grade: string }>;
  events: Array<{ event_type: string; payload: string; created_at: string }>;
  inventoryAlerts: Array<{ product_title: string; variant_title: string; current_stock: number; days_remaining: number; status: string; sku: string }>;
  cogsData: Array<{ title: string; total_cogs: number; unit_cost: number; shopify_payment_fee: number; shipping_cost_domestic: number }>;
}

/** Lo que cambia entre WooCommerce y PrestaShop: colores, iconos y la guía de webhooks. */
export interface StoreDashboardTheme {
  name: string;          // "WooCommerce"
  key: string;           // prefijo de clases CSS y del degradado
  c1: string; c2: string; c3: string;
  rgb: string;           // c1 en "r,g,b" para sombras y fondos translúcidos
  headerBg: string;
  headerIcon: string;
  kpiIcons: [string, string, string];
  /** Texto en event_type que marca un evento como pedido de esta plataforma. */
  orderEventTag: string;
  webhookIntro: string;
  webhookSteps: string[];
}

export const WOO_THEME: StoreDashboardTheme = {
  name: "WooCommerce", key: "woo", c1: "#96588a", c2: "#b97ab5", c3: "#c084fc", rgb: "150,88,138",
  headerBg: "linear-gradient(135deg,#1a0d1a 0%,#1e0f1e 40%,#130f1a 100%)", headerIcon: "🟣",
  kpiIcons: ["💜", "🛒", "📊"], orderEventTag: "woo",
  webhookIntro: "Activa los webhooks de WooCommerce para recibir pedidos en tiempo real:",
  webhookSteps: ["WC Admin → Ajustes → Avanzado → Webhooks → Nuevo", "URL: .../api/webhooks/woocommerce/[ID_PROYECTO]", "Tópico: Order created + Order updated"],
};

export const PRESTA_THEME: StoreDashboardTheme = {
  name: "PrestaShop", key: "presta", c1: "#df0067", c2: "#ff4d9e", c3: "#ff8ec7", rgb: "223,0,103",
  headerBg: "linear-gradient(135deg,#1a0010 0%,#1e0014 40%,#130010 100%)", headerIcon: "🔴",
  kpiIcons: ["🔴", "📦", "💳"], orderEventTag: "presta",
  webhookIntro: "Conecta tu tienda PrestaShop para recibir pedidos automáticamente:",
  webhookSteps: ["Módulo ps_eventbus (o módulo custom)", "URL: .../api/webhooks/prestashop/[ID_PROYECTO]", "Header: X-PrestaShop-Secret: [API_KEY_PROYECTO]"],
};

function MiniChart({ data, color, gradId }: { data: Array<{ revenue: number }>; color: string; gradId: string }) {
  if (!data || data.length < 2) return <div style={{ height: 48, display: "flex", alignItems: "center", justifyContent: "center", color: "rgba(255,255,255,0.2)", fontSize: 11 }}>Sin datos aún</div>;
  const max = Math.max(...data.map(d => d.revenue), 1);
  const w = 100, h = 48;
  const pts = data.map((d, i) => `${(i / (data.length - 1)) * w},${h - (d.revenue / max) * (h - 4) - 2}`).join(" ");
  return (
    <svg viewBox={`0 0 ${w} ${h}`} style={{ width: "100%", height: h, overflow: "visible" }}>
      <defs>
        <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.35" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <polygon points={`0,${h} ${pts} ${w},${h}`} fill={`url(#${gradId})`} />
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

/** Panel del cliente para tiendas WooCommerce y PrestaShop (antes dos archivos casi iguales). */
export default function StoreDashboard({ apid, theme }: { apid: (url: string) => string; theme: StoreDashboardTheme }) {
  const t = theme;
  const [data, setData] = useState<PlatformData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(apid(`${API}/client/platform-data`), { credentials: "include" })
      // Si el API falla, sin datos (antes se guardaba el cuerpo de error y la
      // página se caía al leer data.revenue).
      .then(async r => { const d = await r.json().catch(() => null); setData(r.ok && d?.revenue ? d : null); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  const kpis = [
    { label: "Revenue 30d", value: loading ? "—" : `€${(data?.revenue.total30d ?? 0).toLocaleString("es-ES", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`, icon: t.kpiIcons[0], color: t.c1, trend: data?.revenue.trend },
    { label: "Pedidos 30d", value: loading ? "—" : String(data?.revenue.orders30d ?? 0), icon: t.kpiIcons[1], color: t.c2, trend: null },
    { label: "Ticket Medio", value: loading ? "—" : `€${(data?.revenue.aov ?? 0).toFixed(2)}`, icon: t.kpiIcons[2], color: t.c3, trend: null },
    { label: "Alertas Stock", value: loading ? "—" : String(data?.inventoryAlerts.length ?? 0), icon: "⚠️", color: (data?.inventoryAlerts.length ?? 0) > 0 ? "#f59e0b" : "#34d399", trend: null },
  ];

  return (
    <div>
      <style>{`
        @keyframes ${t.key}-in{from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:translateY(0)}}
        .${t.key}-card{transition:transform 0.2s,box-shadow 0.2s!important;}
        .${t.key}-card:hover{transform:translateY(-3px)!important;box-shadow:0 14px 40px rgba(${t.rgb},0.25)!important;}
        .${t.key}-row:hover{background:rgba(${t.rgb},0.07)!important;}
      `}</style>

      {/* ── PLATFORM HEADER ── */}
      <div style={{ background: t.headerBg, border: `1px solid ${t.c1}30`, borderRadius: 16, padding: "22px 24px 18px", marginBottom: 16, position: "relative", overflow: "hidden", animation: `${t.key}-in 0.4s ease` }}>
        <div style={{ position: "absolute", top: -60, right: -60, width: 200, height: 200, borderRadius: "50%", background: `radial-gradient(circle,${t.c1}18 0%,transparent 70%)`, pointerEvents: "none" }} />
        <div style={{ display: "flex", alignItems: "center", gap: 12, position: "relative", zIndex: 1 }}>
          <div style={{ width: 42, height: 42, borderRadius: 12, background: `linear-gradient(135deg,${t.c1},${t.c2})`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22, boxShadow: `0 4px 16px ${t.c1}40` }}>{t.headerIcon}</div>
          <div>
            <h2 style={{ margin: 0, fontSize: 20, fontWeight: 800, color: "#fff" }}>{t.name} Analytics</h2>
            <p style={{ margin: 0, fontSize: 11.5, color: "rgba(255,255,255,0.45)", marginTop: 2 }}>Motor financiero real · últimos 30 días</p>
          </div>
          <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 6 }}>
            <div style={{ width: 6, height: 6, borderRadius: "50%", background: data?.lastDataDate ? "#34d399" : "#6b7280", boxShadow: data?.lastDataDate ? "0 0 8px #34d399" : "none" }} />
            <span style={{ fontSize: 10.5, color: data?.lastDataDate ? "#34d399" : "#9ca3af", fontWeight: 600, letterSpacing: "0.05em", textTransform: "uppercase" }}>
              {loading ? "…" : data?.lastDataDate ? `Datos al ${data.lastDataDate.slice(8, 10)}/${data.lastDataDate.slice(5, 7)}` : "Sin datos sincronizados"}
            </span>
          </div>
        </div>
      </div>

      {/* ── KPI GRID ── */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(200px,1fr))", gap: 12, marginBottom: 16 }}>
        {kpis.map((k, i) => (
          <div key={k.label} className={`${t.key}-card`} style={{ background: "var(--srf)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 14, padding: "16px 18px", position: "relative", overflow: "hidden", animation: `${t.key}-in 0.4s ${i * 0.07}s ease both` }}>
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

      {/* ── REVENUE CHART + COGS ── */}
      <div style={{ display: "grid", gridTemplateColumns: "1.4fr 1fr", gap: 12, marginBottom: 16 }}>
        <div style={{ background: "var(--srf)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 14, padding: "18px 20px" }}>
          <p style={{ margin: "0 0 4px", fontSize: 10, color: "var(--t3)", textTransform: "uppercase", letterSpacing: "0.1em" }}>Revenue Diario — 30 días</p>
          <p style={{ margin: "0 0 12px", fontSize: 22, fontWeight: 800, color: t.c1 }}>
            €{(data?.revenue.total30d ?? 0).toLocaleString("es-ES")}
            <span style={{ marginLeft: 8 }}>{data && data.revenue.trend !== null && <TrendBadge value={data.revenue.trend} />}</span>
          </p>
          <MiniChart data={data?.revenue.dailyChart ?? []} color={t.c1} gradId={`${t.key}-g1`} />
        </div>
        <div style={{ background: "var(--srf)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 14, padding: "18px 20px" }}>
          <p style={{ margin: "0 0 12px", fontSize: 10, color: "var(--t3)", textTransform: "uppercase", letterSpacing: "0.1em" }}>COGS Real — Top Productos</p>
          {loading ? <div style={{ color: "var(--t3)", fontSize: 12 }}>Cargando...</div> : (data?.cogsData.length ?? 0) === 0 ? (
            <div style={{ color: "var(--t3)", fontSize: 12, textAlign: "center", padding: "16px 0" }}>
              <div style={{ fontSize: 22, marginBottom: 6 }}>📊</div>
              Sin datos COGS aún.<br />
              <span style={{ fontSize: 10.5 }}>Agrega costes desde Productos → COGS</span>
            </div>
          ) : data?.cogsData.slice(0, 4).map((c, i) => (
            <div key={i} className={`${t.key}-row`} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "7px 6px", borderRadius: 8, borderBottom: i < 3 ? "1px solid rgba(255,255,255,0.04)" : "none" }}>
              <span style={{ fontSize: 11.5, color: "var(--t1)", flex: 1, minWidth: 0, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{c.title}</span>
              <span style={{ fontSize: 12, fontWeight: 700, color: t.c1, marginLeft: 8, flexShrink: 0 }}>€{parseFloat(String(c.total_cogs)).toFixed(2)}</span>
            </div>
          ))}
        </div>
      </div>

      {/* ── INVENTORY ALERTS + TOP PRODUCTS ── */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 16 }}>
        <div style={{ background: "var(--srf)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 14, padding: "18px 20px" }}>
          <p style={{ margin: "0 0 12px", fontSize: 10, color: "var(--t3)", textTransform: "uppercase", letterSpacing: "0.1em" }}>⚠️ Alertas de Inventario</p>
          {loading ? <div style={{ color: "var(--t3)", fontSize: 12 }}>Cargando...</div>
            : (data?.inventoryAlerts.length ?? 0) === 0 ? (
              <div style={{ color: "#34d399", fontSize: 12, display: "flex", alignItems: "center", gap: 6, padding: "8px 0" }}>✅ Stock saludable en todos los productos</div>
            ) : data?.inventoryAlerts.map((a, i) => (
              <div key={i} className={`${t.key}-row`} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 6px", borderRadius: 8, borderBottom: i < (data.inventoryAlerts.length - 1) ? "1px solid rgba(255,255,255,0.04)" : "none" }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 12, color: "var(--t1)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{a.product_title}</div>
                  <div style={{ fontSize: 10.5, color: "var(--t3)" }}>{a.variant_title} · SKU: {a.sku || "—"}</div>
                </div>
                <div style={{ textAlign: "right", flexShrink: 0, marginLeft: 8 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: a.status === "critical" ? "#f43f5e" : "#f59e0b" }}>{a.current_stock} uds</div>
                  <div style={{ fontSize: 10, color: "var(--t3)" }}>{a.days_remaining ? `${a.days_remaining}d` : "0d"} restante</div>
                </div>
              </div>
            ))}
        </div>
        <div style={{ background: "var(--srf)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 14, padding: "18px 20px" }}>
          <p style={{ margin: "0 0 12px", fontSize: 10, color: "var(--t3)", textTransform: "uppercase", letterSpacing: "0.1em" }}>🏆 Top Productos por Score IA</p>
          {loading ? <div style={{ color: "var(--t3)", fontSize: 12 }}>Cargando...</div>
            : (data?.topProducts.length ?? 0) === 0 ? (
              <div style={{ color: "var(--t3)", fontSize: 12, textAlign: "center", padding: "12px 0" }}>Sin auditorías aún</div>
            ) : data?.topProducts.map((p, i) => (
              <div key={i} className={`${t.key}-row`} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 6px", borderRadius: 8, borderBottom: i < (data.topProducts.length - 1) ? "1px solid rgba(255,255,255,0.04)" : "none" }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 12, color: "var(--t1)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{p.title}</div>
                  <div style={{ fontSize: 10.5, color: "var(--t3)" }}>€{parseFloat(String(p.price ?? 0)).toFixed(2)}</div>
                </div>
                <div style={{ textAlign: "right", flexShrink: 0, marginLeft: 8 }}>
                  <div style={{ fontSize: 13, fontWeight: 800, color: (p.audit_score ?? 0) >= 80 ? "#34d399" : (p.audit_score ?? 0) >= 60 ? "#f59e0b" : "#f43f5e" }}>{p.audit_score ?? "—"}</div>
                  <div style={{ fontSize: 10, color: "var(--t3)" }}>Grado {p.audit_grade ?? "—"}</div>
                </div>
              </div>
            ))}
        </div>
      </div>

      {/* ── RECENT EVENTS ── */}
      <div style={{ background: "var(--srf)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 14, padding: "18px 20px" }}>
        <p style={{ margin: "0 0 12px", fontSize: 10, color: "var(--t3)", textTransform: "uppercase", letterSpacing: "0.1em" }}>📋 Actividad en Tiempo Real</p>
        {loading ? <div style={{ color: "var(--t3)", fontSize: 12 }}>Cargando...</div>
          : (data?.events.length ?? 0) === 0 ? (
            <div style={{ color: "var(--t3)", fontSize: 12, textAlign: "center", padding: "12px 0" }}>Sin eventos recientes. Los webhooks aparecerán aquí en tiempo real.</div>
          ) : data?.events.slice(0, 8).map((e, i) => {
            const isOrder = e.event_type?.includes("order") || e.event_type?.includes(t.orderEventTag);
            const isRefund = e.event_type?.includes("refund") || e.event_type?.includes("cancel");
            const icon = isRefund ? "↩️" : isOrder ? "🛒" : "📋";
            const color = isRefund ? "#f43f5e" : isOrder ? t.c1 : "var(--t2)";
            return (
              <div key={i} className={`${t.key}-row`} style={{ display: "flex", alignItems: "flex-start", gap: 10, padding: "8px 6px", borderRadius: 8, borderBottom: i < 7 ? "1px solid rgba(255,255,255,0.04)" : "none" }}>
                <span style={{ fontSize: 14, flexShrink: 0, marginTop: 1 }}>{icon}</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 12, color, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{e.payload}</div>
                  <div style={{ fontSize: 10, color: "var(--t3)", marginTop: 2 }}>{new Date(e.created_at).toLocaleString("es-ES", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}</div>
                </div>
              </div>
            );
          })}
      </div>

      {/* ── WEBHOOK SETUP GUIDE ── */}
      <div style={{ background: `rgba(${t.rgb},0.06)`, border: `1px solid ${t.c1}25`, borderRadius: 14, padding: "16px 20px", marginTop: 12 }}>
        <p style={{ margin: "0 0 8px", fontSize: 11, fontWeight: 700, color: t.c2, textTransform: "uppercase", letterSpacing: "0.08em" }}>⚙️ Configurar Webhooks en Tiempo Real</p>
        <p style={{ margin: "0 0 6px", fontSize: 11.5, color: "var(--t2)" }}>{t.webhookIntro}</p>
        <p style={{ margin: 0, fontSize: 11, color: "var(--t3)", fontFamily: "monospace", background: "rgba(0,0,0,0.3)", padding: "6px 10px", borderRadius: 6 }}>
          {t.webhookSteps.map((line, i) => <span key={i}>{line}{i < t.webhookSteps.length - 1 && <br />}</span>)}
        </p>
      </div>
    </div>
  );
}
