import { Link, useLocation } from "wouter";
import { Plus, Brain, Zap, Users, TrendingUp, TrendingDown, ShoppingCart, DollarSign, BarChart3, RefreshCw, Globe, Activity, Package, Eye, MessageSquare } from "lucide-react";
import { useListProjects } from "@workspace/api-client-react";
import { useAuth } from "@/contexts/AuthContext";
import { useCmsSection } from "@/contexts/CmsContext";
import { useEffect, useState, useCallback } from "react";

const API_BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

interface StoreSummary {
  projectId: number;
  storeName: string;
  domain: string;
  niche: string;
  platformType: string;
  revenue30: number;
  orders30: number;
  aov: number;
  trend: number;
  totalAttributed: number;
  sparkline: number[];
  loading: boolean;
}

const PLATFORM_COLORS_HOME: Record<string, string> = {
  shopify:     "#95bf47",
  woocommerce: "#96588a",
  prestashop:  "#df0067",
  universal:   "#5b9bd5",
  stripe:      "#635bff",
  tiendanube:  "#00a0e3",
};
const PLATFORM_ICONS_HOME: Record<string, string> = {
  shopify:     "🟢",
  woocommerce: "🟣",
  prestashop:  "🔴",
  universal:   "🌐",
  stripe:      "💳",
  tiendanube:  "☁️",
};

interface BrainStatus {
  totalMemories: number;
  totalInsights: number;
  brainHealth: number;
}

interface ChatSummary {
  sessions: number;
  messages: number;
  costEur: number;
  avgTokens: number;
  avgCostEur: number;
}

function Sparkline({ data, color = "var(--gold)" }: { data: number[]; color?: string }) {
  if (!data || data.length < 2) return <div style={{ width: 80, height: 28 }} />;
  const max = Math.max(...data, 1);
  const min = Math.min(...data);
  const range = max - min || 1;
  const W = 80, H = 28, pad = 2;
  const pts = data.map((v, i) => {
    const x = pad + (i / (data.length - 1)) * (W - pad * 2);
    const y = H - pad - ((v - min) / range) * (H - pad * 2);
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(" ");
  const areaBot = `${W - pad},${H - pad} ${pad},${H - pad}`;
  return (
    <svg width={W} height={H} style={{ overflow: "visible", flexShrink: 0 }}>
      <defs>
        <linearGradient id={`sg-${color.replace(/[^a-z]/gi, "")}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.25" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <polygon points={`${pts.split(" ")[0].split(",")[0]},${H - pad} ${pts} ${areaBot}`}
        fill={`url(#sg-${color.replace(/[^a-z]/gi, "")})`} />
      <polyline points={pts} fill="none" stroke={color} strokeWidth="1.5" strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}

function TrendBadge({ value }: { value: number }) {
  const isPos = value >= 0;
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 3,
      fontSize: 11, fontWeight: 700,
      color: isPos ? "#4ade80" : "#f87171",
      background: isPos ? "rgba(74,222,128,0.1)" : "rgba(248,113,113,0.1)",
      padding: "2px 7px", borderRadius: 20,
    }}>
      {isPos ? <TrendingUp size={10} /> : <TrendingDown size={10} />}
      {isPos ? "+" : ""}{value.toFixed(1)}%
    </span>
  );
}

function KpiCard({ icon, label, value, sub, color = "var(--gold)", trend }: {
  icon: React.ReactNode; label: string; value: string | number;
  sub?: string; color?: string; trend?: number;
}) {
  return (
    <div className="glass-card" style={{ padding: "18px 20px" }}>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 10 }}>
        <div style={{
          width: 38, height: 38, borderRadius: 10,
          background: `${color}18`, display: "flex", alignItems: "center",
          justifyContent: "center", flexShrink: 0, color,
        }}>
          {icon}
        </div>
        {trend !== undefined && <TrendBadge value={trend} />}
      </div>
      <p style={{ fontSize: 24, fontWeight: 900, color: "var(--t)", lineHeight: 1, letterSpacing: "-0.5px", marginBottom: 4 }}>{value}</p>
      <p style={{ fontSize: 11, color: "var(--t3)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.8px" }}>{label}</p>
      {sub && <p style={{ fontSize: 11, color: "var(--t4)", marginTop: 3 }}>{sub}</p>}
    </div>
  );
}

function StoreRevenueRow({ store, rank }: { store: StoreSummary; rank: number }) {
  const [, navigate] = useLocation();
  const pColor = PLATFORM_COLORS_HOME[store.platformType] ?? "#95bf47";
  const pIcon  = PLATFORM_ICONS_HOME[store.platformType] ?? "🟢";
  return (
    <div
      onClick={() => navigate(`/projects/${store.projectId}/audit`)}
      className="glass-card card-hover"
      style={{
        padding: "14px 18px", cursor: "pointer", display: "flex", alignItems: "center", gap: 14,
        borderLeft: `3px solid ${pColor}`,
      }}
    >
      <div style={{
        width: 36, height: 36, borderRadius: 10, background: `${pColor}18`,
        display: "flex", alignItems: "center", justifyContent: "center",
        flexShrink: 0, fontSize: 18,
        border: `1px solid ${pColor}30`,
      }}>
        {pIcon}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 2 }}>
          <p style={{ fontSize: 13, fontWeight: 700, color: "var(--t)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{store.storeName}</p>
          <span style={{ fontSize: 9, padding: "1px 6px", borderRadius: 10, background: `${pColor}20`, color: pColor, fontWeight: 700, flexShrink: 0 }}>
            #{rank + 1}
          </span>
        </div>
        <p style={{ fontSize: 11, color: "var(--t4)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {store.domain || "—"}{store.niche ? ` · ${store.niche}` : ""}
        </p>
      </div>

      <div style={{ textAlign: "right", flexShrink: 0 }}>
        {store.loading ? (
          <div className="skeleton" style={{ width: 80, height: 18, borderRadius: 4, marginBottom: 4 }} />
        ) : (
          <>
            <p style={{ fontSize: 16, fontWeight: 800, color: "var(--t)", letterSpacing: "-0.3px" }}>
              €{store.revenue30.toLocaleString("es-ES", { maximumFractionDigits: 0 })}
            </p>
            <p style={{ fontSize: 10, color: "var(--t4)" }}>{store.orders30} pedidos · AOV €{store.aov.toFixed(0)}</p>
          </>
        )}
      </div>

      <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 4, flexShrink: 0 }}>
        <Sparkline data={store.sparkline} color={pColor} />
        {!store.loading && <TrendBadge value={store.trend} />}
      </div>
    </div>
  );
}

const QUICK_ACTIONS = [
  { icon: "🧠", label: "Shopy Brain", desc: "IA central · memorias", href: "/admin/shopybrain", color: "var(--gold)" },
  { icon: "📊", label: "Revenue Intel", desc: "Métricas & KPIs", href: "/admin/revenue", color: "var(--jade)" },
  { icon: "📧", label: "Email Marketing", desc: "Flujos automáticos", href: "/admin/emails", color: "#8b5cf6" },
  { icon: "🔍", label: "Competidores", desc: "Análisis de mercado", href: "/admin/competitors", color: "#f59e0b" },
  { icon: "🔮", label: "Forecast ML", desc: "Predicciones revenue", href: "/admin/forecast", color: "#06b6d4" },
  { icon: "💰", label: "Pricing CFO", desc: "Costes & propuestas", href: "/admin/my-pricing", color: "var(--gold)" },
  { icon: "🏛", label: "Librería Prompts", desc: "6,000+ templates IA", href: "/admin/prompt-library", color: "#a78bfa" },
  { icon: "⚡", label: "Centro de Mando", desc: "Control total", href: "/admin/command-center", color: "var(--jade)" },
  { icon: "🗺️", label: "Roadmap 90d", desc: "Fases de escala", href: "/admin/roadmap", color: "#60a5fa" },
  { icon: "🎯", label: "A/B Tests", desc: "Tests globales", href: "/admin/abtests", color: "#f87171" },
  { icon: "🔄", label: "Brain Sync", desc: "Sincronizar IA", href: "/admin/brain-sync", color: "#4ade80" },
  { icon: "📈", label: "Predicciones", desc: "Analytics avanzado", href: "/admin/intelligence", color: "#fbbf24" },
];

export default function Home() {
  const { user } = useAuth();
  const [, navigate] = useLocation();
  const { data: projects, isLoading } = useListProjects();
  const [brainStatus, setBrainStatus] = useState<BrainStatus | null>(null);
  const [chatSummary, setChatSummary] = useState<ChatSummary | null>(null);
  const [stores, setStores] = useState<StoreSummary[]>([]);
  const [syncingAll, setSyncingAll] = useState(false);
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());
  const { t } = useCmsSection("labels.home");

  const firstName = user?.name?.split(" ")[0] ?? user?.email?.split("@")[0] ?? "Admin";
  const greeting = (() => {
    const h = new Date().getHours();
    if (h < 12) return "Buenos días";
    if (h < 20) return "Buenas tardes";
    return "Buenas noches";
  })();

  useEffect(() => {
    fetch(`${API_BASE}/api/shopybrain/status`, { credentials: "include" })
      .then(r => r.json()).then(setBrainStatus).catch(() => {});
  }, []);

  useEffect(() => {
    fetch(`${API_BASE}/api/api-usage/chat-summary`, { credentials: "include" })
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d) setChatSummary(d); })
      .catch(() => {});
  }, []);

  const loadStoreSummaries = useCallback(async () => {
    if (!projects || projects.length === 0) return;
    const initial: StoreSummary[] = projects.map((p: any) => ({
      projectId: p.id, storeName: p.name, domain: p.shopDomain ?? "",
      niche: p.storeNiche ?? "", platformType: p.platformType ?? "shopify",
      revenue30: 0, orders30: 0, aov: 0,
      trend: 0, totalAttributed: 0, sparkline: [], loading: true,
    }));
    setStores(initial);

    await Promise.all(projects.map(async (p: any) => {
      try {
        const r = await fetch(`${API_BASE}/api/intelligence/summary?projectId=${p.id}`, { credentials: "include" });
        if (!r.ok) throw new Error("failed");
        const d = await r.json();
        const snaps: any[] = d.recentSnapshots ?? [];
        const rev30 = snaps.reduce((s: number, x: any) => s + (x.revenue ?? 0), 0);
        const ord30 = snaps.reduce((s: number, x: any) => s + (x.orders ?? 0), 0);
        const aov = ord30 > 0 ? rev30 / ord30 : 0;
        const sparkline = [...snaps].reverse().map((x: any) => x.revenue ?? 0);
        setStores(prev => prev.map(s => s.projectId === p.id ? {
          ...s, storeName: d.storeName ?? p.name,
          revenue30: rev30, orders30: ord30, aov,
          trend: d.trend ?? 0, totalAttributed: d.totalAttributedRevenue ?? 0,
          sparkline, loading: false,
        } : s));
      } catch {
        setStores(prev => prev.map(s => s.projectId === p.id ? { ...s, loading: false } : s));
      }
    }));
    setLastRefresh(new Date());
  }, [projects]);

  useEffect(() => { loadStoreSummaries(); }, [loadStoreSummaries]);

  const syncAll = async () => {
    if (!projects || projects.length === 0) return;
    setSyncingAll(true);
    await Promise.all(projects.map(async (p: any) => {
      try {
        await fetch(`${API_BASE}/api/intelligence/sync-revenue`, {
          method: "POST", credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ projectId: p.id, days: 30 }),
        });
      } catch {}
    }));
    await loadStoreSummaries();
    setSyncingAll(false);
  };

  const totalRevenue = stores.reduce((s, x) => s + x.revenue30, 0);
  const totalOrders = stores.reduce((s, x) => s + x.orders30, 0);
  const totalAov = totalOrders > 0 ? totalRevenue / totalOrders : 0;
  const avgTrend = stores.length > 0 ? stores.reduce((s, x) => s + x.trend, 0) / stores.length : 0;
  const totalAttributedAll = stores.reduce((s, x) => s + x.totalAttributed, 0);
  const projectCount = projects?.length ?? 0;

  const storesSorted = [...stores].sort((a, b) => b.revenue30 - a.revenue30);

  return (
    <div className="page-inner" style={{ maxWidth: 1200 }}>

      {/* ── HEADER ── */}
      <div style={{ marginBottom: 24, display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
        <div>
          <p style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "1.5px", color: "var(--gold)", marginBottom: 4 }}>
            Panel de Control
          </p>
          <h1 style={{ fontFamily: "var(--fh)", fontStyle: "italic", fontSize: 28, fontWeight: 900, marginBottom: 4, lineHeight: 1 }}>
            {greeting}, {firstName} 👋
          </h1>
          <p style={{ fontSize: 12, color: "var(--t3)" }}>
            {new Date().toLocaleDateString("es-ES", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
            {lastRefresh && <span style={{ marginLeft: 10, opacity: 0.6 }}>· actualizado {lastRefresh.toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" })}</span>}
          </p>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button
            onClick={syncAll}
            disabled={syncingAll || isLoading}
            className="btn"
            style={{ display: "flex", alignItems: "center", gap: 6, padding: "8px 14px", fontSize: 12, opacity: syncingAll ? 0.6 : 1 }}
          >
            <RefreshCw size={13} style={{ animation: syncingAll ? "spin 1s linear infinite" : "none" }} />
            {syncingAll ? "Sincronizando..." : "Sincronizar Shopify"}
          </button>
          <button onClick={() => navigate("/new-project")} className="btn-primary" style={{ padding: "8px 14px", fontSize: 12, display: "flex", alignItems: "center", gap: 6 }}>
            <Plus size={13} /> Nueva Tienda
          </button>
        </div>
      </div>

      {/* ── KPI STRIP ── */}
      <div className="grid-r4" style={{ marginBottom: 24 }}>
        <KpiCard
          icon={<DollarSign size={18} />}
          label="Revenue Total (30d)"
          value={isLoading ? "—" : `€${totalRevenue.toLocaleString("es-ES", { maximumFractionDigits: 0 })}`}
          sub={`${projectCount} tiendas combinadas`}
          color="var(--gold)"
          trend={isLoading ? undefined : avgTrend}
        />
        <KpiCard
          icon={<ShoppingCart size={18} />}
          label="Pedidos Totales (30d)"
          value={isLoading ? "—" : totalOrders.toLocaleString("es-ES")}
          sub={`AOV €${totalAov.toFixed(0)} promedio`}
          color="var(--jade)"
        />
        <KpiCard
          icon={<TrendingUp size={18} />}
          label="Revenue Atribuido IA"
          value={isLoading ? "—" : `€${totalAttributedAll.toLocaleString("es-ES", { maximumFractionDigits: 0 })}`}
          sub="Generado por Shopy Crafter"
          color="#8b5cf6"
        />
        <KpiCard
          icon={<Brain size={18} />}
          label="Cerebro IA"
          value={brainStatus ? `${(brainStatus.totalMemories / 1000).toFixed(1)}K` : "—"}
          sub={brainStatus ? `${(brainStatus.totalInsights / 1000).toFixed(0)}K insights · ${Math.round(brainStatus.brainHealth ?? 98)}% salud` : "Cargando..."}
          color="var(--gold)"
        />
      </div>

      {/* ── SECOND KPI ROW ── */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12, marginBottom: 24 }}>
        <div className="glass-card" style={{ padding: "14px 16px", gridColumn: "span 1" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
            <Users size={14} style={{ color: "var(--jade)" }} />
            <span style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.8px", color: "var(--t3)" }}>Tiendas</span>
          </div>
          <div style={{ display: "flex", gap: 12, alignItems: "flex-end" }}>
            <div>
              <p style={{ fontSize: 22, fontWeight: 900, color: "var(--t)" }}>{projectCount}</p>
              <p style={{ fontSize: 10, color: "var(--t4)" }}>Conectadas</p>
            </div>
            <div style={{ paddingBottom: 2 }}>
              <p style={{ fontSize: 16, fontWeight: 800, color: "var(--jade)" }}>{projectCount > 0 ? projectCount : 0}</p>
              <p style={{ fontSize: 10, color: "var(--t4)" }}>Activas</p>
            </div>
          </div>
        </div>

        <div className="glass-card" style={{ padding: "14px 16px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
            <Zap size={14} style={{ color: "#f59e0b" }} />
            <span style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.8px", color: "var(--t3)" }}>Motores IA</span>
          </div>
          <p style={{ fontSize: 22, fontWeight: 900, color: "var(--t)" }}>7 <span style={{ fontSize: 13, fontWeight: 500, color: "#4ade80" }}>activos</span></p>
          <p style={{ fontSize: 10, color: "var(--t4)" }}>24h/7d continuo</p>
        </div>

        <div className="glass-card" style={{ padding: "14px 16px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
            <Activity size={14} style={{ color: "#06b6d4" }} />
            <span style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.8px", color: "var(--t3)" }}>Estado</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <div style={{ width: 8, height: 8, borderRadius: "50%", background: "#4ade80", boxShadow: "0 0 6px #4ade80" }} />
            <p style={{ fontSize: 16, fontWeight: 800, color: "#4ade80" }}>Operativo</p>
          </div>
          <p style={{ fontSize: 10, color: "var(--t4)" }}>Todos los sistemas OK</p>
        </div>

        <div className="glass-card" style={{ padding: "14px 16px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
            <Package size={14} style={{ color: "#a78bfa" }} />
            <span style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.8px", color: "var(--t3)" }}>Prompts</span>
          </div>
          <p style={{ fontSize: 22, fontWeight: 900, color: "var(--t)" }}>6.2K</p>
          <p style={{ fontSize: 10, color: "var(--t4)" }}>Templates en librería</p>
        </div>
      </div>

      {/* ── REVENUE POR TIENDA + TOTALES ── */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 280px", gap: 18, marginBottom: 24, alignItems: "start" }}>

        {/* Left: per-store list */}
        <div>
          <div className="flex-header" style={{ marginBottom: 14 }}>
            <div>
              <p style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "1.5px", color: "var(--t3)" }}>Revenue por Tienda · últimos 30d</p>
            </div>
            <Link href="/admin/revenue">
              <span style={{ fontSize: 11, color: "var(--gold)", cursor: "pointer", fontWeight: 600, textDecoration: "none" }}>Ver Revenue Intel →</span>
            </Link>
          </div>

          {isLoading ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {[1, 2, 3].map(i => <div key={i} className="skeleton" style={{ height: 68, borderRadius: 12 }} />)}
            </div>
          ) : storesSorted.length === 0 ? (
            <div className="glass-card" style={{ padding: "32px 24px", textAlign: "center" }}>
              <p style={{ fontSize: 28, marginBottom: 10 }}>🛍️</p>
              <p style={{ fontSize: 15, fontWeight: 700, color: "var(--t)", marginBottom: 6 }}>Sin tiendas conectadas</p>
              <p style={{ fontSize: 13, color: "var(--t3)", marginBottom: 18 }}>Conecta tu primera tienda Shopify para ver métricas en tiempo real.</p>
              <button onClick={() => navigate("/new-project")} className="btn-primary">
                <Plus size={14} /> Conectar primera tienda
              </button>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {storesSorted.map((store, i) => (
                <StoreRevenueRow key={store.projectId} store={store} rank={i} />
              ))}
            </div>
          )}
        </div>

        {/* Right: aggregate totals panel */}
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <div className="glass-card" style={{
            padding: "20px", background: "linear-gradient(135deg, rgba(200,168,75,0.08) 0%, rgba(0,0,0,0) 100%)",
            border: "1px solid rgba(200,168,75,0.2)",
          }}>
            <p style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "1px", color: "var(--gold)", marginBottom: 16 }}>
              📊 Consolidado Global
            </p>
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              {[
                { label: "Revenue total", value: `€${totalRevenue.toLocaleString("es-ES", { maximumFractionDigits: 0 })}`, color: "var(--gold)" },
                { label: "Pedidos totales", value: totalOrders.toLocaleString("es-ES"), color: "var(--jade)" },
                { label: "AOV promedio", value: `€${totalAov.toFixed(2)}`, color: "#8b5cf6" },
                { label: "Revenue atribuido IA", value: `€${totalAttributedAll.toLocaleString("es-ES", { maximumFractionDigits: 0 })}`, color: "#06b6d4" },
                { label: "Tiendas gestionadas", value: String(projectCount), color: "#f59e0b" },
              ].map(row => (
                <div key={row.label} style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span style={{ fontSize: 12, color: "var(--t3)" }}>{row.label}</span>
                  <span style={{ fontSize: 14, fontWeight: 800, color: row.color }}>{isLoading ? "—" : row.value}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="glass-card" style={{ padding: "16px" }}>
            <p style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "1px", color: "var(--t3)", marginBottom: 12 }}>
              🧠 Shopy Brain
            </p>
            {brainStatus ? (
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {[
                  { label: "Memorias", value: brainStatus.totalMemories.toLocaleString("es-ES"), color: "var(--gold)" },
                  { label: "Insights", value: brainStatus.totalInsights.toLocaleString("es-ES"), color: "var(--jade)" },
                  { label: "Salud IA", value: `${Math.round(brainStatus.brainHealth ?? 98)}%`, color: "#4ade80" },
                ].map(row => (
                  <div key={row.label} style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <span style={{ fontSize: 11, color: "var(--t3)" }}>{row.label}</span>
                    <span style={{ fontSize: 13, fontWeight: 800, color: row.color }}>{row.value}</span>
                  </div>
                ))}
                <div style={{ marginTop: 4 }}>
                  <div style={{ height: 4, borderRadius: 4, background: "var(--ink3)", overflow: "hidden" }}>
                    <div style={{ height: "100%", width: `${Math.round(brainStatus.brainHealth ?? 98)}%`, background: "linear-gradient(90deg, var(--jade), #4ade80)", borderRadius: 4 }} />
                  </div>
                </div>
              </div>
            ) : (
              <div className="skeleton" style={{ height: 80, borderRadius: 8 }} />
            )}
          </div>

          {/* Chatbot cost summary card */}
          <Link href="/admin/api-usage#chat-sessions">
            <div className="glass-card card-hover" style={{
              padding: "16px", cursor: "pointer",
              background: "linear-gradient(135deg, rgba(45,212,159,0.07) 0%, rgba(0,0,0,0) 100%)",
              border: "1px solid rgba(45,212,159,0.18)",
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
                <MessageSquare size={13} style={{ color: "var(--jade)", flexShrink: 0 }} />
                <span style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "1px", color: "var(--jade)" }}>
                  Chatbot IA · este mes
                </span>
              </div>
              {chatSummary ? (
                <div style={{ display: "flex", flexDirection: "column", gap: 9 }}>
                  {[
                    { label: "Coste total", value: `€${chatSummary.costEur.toFixed(4)}`, color: "var(--jade)" },
                    { label: "Conversaciones", value: chatSummary.sessions.toLocaleString("es-ES"), color: "var(--t)" },
                    { label: "Tokens / msg", value: chatSummary.avgTokens > 0 ? chatSummary.avgTokens.toLocaleString("es-ES") : "—", color: "var(--t3)" },
                    { label: "Coste / sesión", value: chatSummary.sessions > 0 ? `€${chatSummary.avgCostEur.toFixed(4)}` : "—", color: "var(--t3)" },
                  ].map(row => (
                    <div key={row.label} style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <span style={{ fontSize: 11, color: "var(--t4)" }}>{row.label}</span>
                      <span style={{ fontSize: 13, fontWeight: 800, color: row.color }}>{row.value}</span>
                    </div>
                  ))}
                  <p style={{ fontSize: 10, color: "var(--jade)", fontWeight: 600, marginTop: 2, textAlign: "right" }}>
                    Ver sesiones completas →
                  </p>
                </div>
              ) : (
                <div className="skeleton" style={{ height: 72, borderRadius: 8 }} />
              )}
            </div>
          </Link>

          <Link href="/admin/revenue">
            <div className="glass-card card-hover" style={{ padding: "12px 16px", cursor: "pointer", textAlign: "center", border: "1px solid rgba(200,168,75,0.2)" }}>
              <p style={{ fontSize: 12, fontWeight: 700, color: "var(--gold)" }}>
                <BarChart3 size={13} style={{ display: "inline", marginRight: 5, verticalAlign: "middle" }} />
                Revenue Intel Completo →
              </p>
            </div>
          </Link>
        </div>
      </div>

      {/* ── ACCIONES RÁPIDAS ── */}
      <div style={{ marginBottom: 24 }}>
        <p style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "1.5px", color: "var(--t3)", marginBottom: 14 }}>
          Acciones Rápidas
        </p>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))", gap: 10 }}>
          {QUICK_ACTIONS.map(action => (
            <Link key={action.href} href={action.href}>
              <div className="glass-card card-hover" style={{ padding: "14px 14px", cursor: "pointer", height: "100%", boxSizing: "border-box" }}>
                <div style={{ fontSize: 20, marginBottom: 8 }}>{action.icon}</div>
                <p style={{ fontSize: 12, fontWeight: 700, color: "var(--t)", marginBottom: 2 }}>{action.label}</p>
                <p style={{ fontSize: 10, color: "var(--t3)", lineHeight: 1.4 }}>{action.desc}</p>
              </div>
            </Link>
          ))}
        </div>
      </div>

      {/* ── TIENDAS GRID ── */}
      {!isLoading && projectCount > 0 && (
        <div>
          <div className="flex-header" style={{ marginBottom: 14 }}>
            <p style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "1.5px", color: "var(--t3)" }}>
              Todas las Tiendas
            </p>
            <button onClick={() => navigate("/new-project")} className="btn" style={{ padding: "5px 12px", fontSize: 11, display: "flex", alignItems: "center", gap: 5 }}>
              <Plus size={12} /> Nueva
            </button>
          </div>
          <div className="grid-r3">
            {projects!.map((p: any) => {
              const storeData = stores.find(s => s.projectId === p.id);
              const isUniversal = p.platformType === "universal";
              return (
                <Link key={p.id} href={`/projects/${p.id}/audit`}>
                  <div className="glass-card card-hover" style={{ padding: "16px", cursor: "pointer" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
                      <div className="logo-gem" style={{
                        width: 32, height: 32, fontSize: 13,
                        background: isUniversal ? "rgba(91,155,213,0.1)" : "rgba(200,168,75,0.1)",
                        color: isUniversal ? "#5b9bd5" : "var(--gold2)",
                      }}>
                        {isUniversal ? <Globe size={14} /> : "🛍"}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <p style={{ fontSize: 13, fontWeight: 700, color: "var(--t)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.name}</p>
                        <p style={{ fontSize: 10, color: "var(--t4)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.shopDomain ?? "—"}</p>
                      </div>
                    </div>
                    {storeData && !storeData.loading ? (
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <div>
                          <p style={{ fontSize: 14, fontWeight: 800, color: "var(--t)" }}>€{storeData.revenue30.toLocaleString("es-ES", { maximumFractionDigits: 0 })}</p>
                          <p style={{ fontSize: 10, color: "var(--t4)" }}>{storeData.orders30} pedidos</p>
                        </div>
                        <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 4 }}>
                          <Sparkline data={storeData.sparkline} color="var(--gold)" />
                          <TrendBadge value={storeData.trend} />
                        </div>
                      </div>
                    ) : (
                      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                        <Eye size={11} style={{ color: "var(--t4)" }} />
                        <span style={{ fontSize: 11, color: "var(--t4)" }}>
                          {p.storeNiche ? p.storeNiche : "Sincroniza para ver métricas"}
                        </span>
                      </div>
                    )}
                  </div>
                </Link>
              );
            })}
            <div onClick={() => navigate("/new-project")} className="glass-card card-hover" style={{ padding: "16px", cursor: "pointer", borderStyle: "dashed", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 6, minHeight: 100, opacity: 0.6 }}>
              <Plus size={18} style={{ color: "var(--t3)" }} />
              <p style={{ fontSize: 12, color: "var(--t3)", fontWeight: 600 }}>Añadir tienda</p>
            </div>
          </div>
        </div>
      )}

      <style>{`
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}
