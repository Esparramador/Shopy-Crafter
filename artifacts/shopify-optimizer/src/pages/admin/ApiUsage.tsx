import { useState, useEffect, useCallback } from "react";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend,
} from "recharts";
import {
  TrendingUp, TrendingDown, Minus, RefreshCw, ChevronLeft, ChevronRight,
  DollarSign, Zap, Activity, BarChart2,
} from "lucide-react";

const API_BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

const PROVIDERS = ["all", "gemini", "claude", "replicate", "runway", "elevenlabs", "openai", "pagespeed", "shopify", "other"] as const;
type Provider = (typeof PROVIDERS)[number];

const PROVIDER_COLORS: Record<string, string> = {
  gemini:      "#4285F4",
  claude:      "#D97706",
  replicate:   "#7C3AED",
  runway:      "#059669",
  elevenlabs:  "#DB2777",
  openai:      "#10B981",
  pagespeed:   "#6B7280",
  shopify:     "#96bf48",
  other:       "#8B5CF6",
};

function fmt(n: number | null | undefined, decimals = 4) {
  if (n == null || !isFinite(n)) return "$0.0000";
  return `$${Number(n).toFixed(decimals)}`;
}
function fmtEur(n: number | null | undefined, decimals = 4) {
  if (n == null || !isFinite(n)) return "€0.0000";
  return `€${Number(n).toFixed(decimals)}`;
}
function fmtNum(n: number | null | undefined) {
  if (n == null) return "0";
  return Number(n).toLocaleString("es-ES");
}
function today() {
  return new Date().toISOString().split("T")[0];
}
function monthStart() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
}

interface StatsData {
  daily: Array<{ day: string; provider: string; costUsd: number; costEur: number; calls: number }>;
  totals: {
    current:       { costUsd: number; costEur: number; calls: number; inputTokens: number; outputTokens: number };
    previousMonth: { costUsd: number; costEur: number; calls: number };
    pctChange:     number | null;
  };
  byProvider: Array<{ provider: string; costUsd: number; costEur: number; calls: number }>;
}

interface LogRow {
  id: string;
  provider: string;
  operation: string;
  model: string | null;
  projectId: number | null;
  projectName: string | null;
  shopDomain:  string | null;
  inputUnits: number;
  outputUnits: number;
  unitsLabel: string | null;
  costUsd: number;
  costEur: number;
  success: number;
  createdAt: string;
}

interface LogsData {
  rows: LogRow[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

function Card({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <div style={{
      background: "var(--ink2,#1a1a2e)", border: "1px solid var(--border,rgba(255,255,255,0.08))",
      borderRadius: 12, padding: "20px 24px", ...style,
    }}>
      {children}
    </div>
  );
}

function KpiCard({
  icon, label, value, sub, trend, trendLabel,
}: {
  icon: React.ReactNode; label: string; value: string;
  sub?: string; trend?: number | null; trendLabel?: string;
}) {
  const isUp   = trend != null && trend > 0;
  const isDown = trend != null && trend < 0;
  return (
    <Card>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
        <div style={{ color: "var(--gold,#f59e0b)", fontSize: 20 }}>{icon}</div>
        <span style={{ fontSize: 12, color: "var(--t3,#666)", fontWeight: 600, letterSpacing: "0.06em", textTransform: "uppercase" }}>{label}</span>
      </div>
      <div style={{ fontSize: 28, fontWeight: 700, color: "var(--t,#fff)", letterSpacing: "-0.5px" }}>{value}</div>
      {sub && <div style={{ fontSize: 12, color: "var(--t3,#666)", marginTop: 4 }}>{sub}</div>}
      {trend != null && (
        <div style={{
          display: "flex", alignItems: "center", gap: 4, marginTop: 8,
          fontSize: 12, fontWeight: 600,
          color: isDown ? "var(--jade,#10b981)" : isUp ? "var(--crim,#ef4444)" : "var(--t3,#666)",
        }}>
          {isUp   ? <TrendingUp size={13} />  : null}
          {isDown ? <TrendingDown size={13} /> : null}
          {!isUp && !isDown ? <Minus size={13} /> : null}
          {trend > 0 ? "+" : ""}{trend.toFixed(1)}% {trendLabel}
        </div>
      )}
    </Card>
  );
}

function buildChartData(daily: StatsData["daily"], provider: Provider) {
  const map: Record<string, Record<string, number>> = {};
  for (const r of daily) {
    if (!map[r.day]) map[r.day] = {};
    map[r.day][r.provider] = (map[r.day][r.provider] ?? 0) + Number(r.costUsd);
  }
  const providers = provider === "all"
    ? [...new Set(daily.map(d => d.provider))]
    : [provider];
  return Object.entries(map)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([day, vals]) => ({ day: day.slice(5), ...Object.fromEntries(providers.map(p => [p, +(vals[p] ?? 0).toFixed(6)])) }));
}

export default function ApiUsage() {
  const [from,     setFrom]     = useState(monthStart());
  const [to,       setTo]       = useState(today());
  const [provider, setProvider] = useState<Provider>("all");
  const [stats,    setStats]    = useState<StatsData | null>(null);
  const [logs,     setLogs]     = useState<LogsData | null>(null);
  const [page,     setPage]     = useState(1);
  const [loading,  setLoading]  = useState(false);
  const [logsLoading, setLogsLoading] = useState(false);

  const loadStats = useCallback(async () => {
    setLoading(true);
    try {
      const qs = new URLSearchParams({ from, to, provider }).toString();
      const r = await fetch(`${API_BASE}/api/api-usage/stats?${qs}`, { credentials: "include" });
      if (r.ok) setStats(await r.json());
    } finally {
      setLoading(false);
    }
  }, [from, to, provider]);

  const loadLogs = useCallback(async (p: number) => {
    setLogsLoading(true);
    try {
      const qs = new URLSearchParams({ from, to, provider, page: String(p) }).toString();
      const r = await fetch(`${API_BASE}/api/api-usage/logs?${qs}`, { credentials: "include" });
      if (r.ok) setLogs(await r.json());
    } finally {
      setLogsLoading(false);
    }
  }, [from, to, provider]);

  useEffect(() => {
    setPage(1);
    loadStats();
    loadLogs(1);
  }, [loadStats, loadLogs]);

  function handlePageChange(np: number) {
    setPage(np);
    loadLogs(np);
  }

  const providers = stats ? [...new Set(stats.daily.map(d => d.provider))] : [];
  const chartData = stats ? buildChartData(stats.daily, provider) : [];

  return (
    <div style={{ padding: "24px 28px", minHeight: "100vh", background: "var(--ink,#0f0f1a)" }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 28 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700, color: "var(--t,#fff)" }}>
            💸 Panel de Costes IA
          </h1>
          <p style={{ margin: "4px 0 0", fontSize: 13, color: "var(--t3,#666)" }}>
            Uso real de APIs externas por proyecto · coste en USD y EUR
          </p>
        </div>
        <button
          onClick={() => { loadStats(); loadLogs(page); }}
          disabled={loading}
          style={{
            display: "flex", alignItems: "center", gap: 6,
            background: "none", border: "1px solid var(--border,rgba(255,255,255,0.12))",
            borderRadius: 8, padding: "7px 14px", color: "var(--t3,#888)", cursor: "pointer", fontSize: 13,
          }}
        >
          <RefreshCw size={14} style={{ animation: loading ? "spin 0.6s linear infinite" : "none" }} />
          Actualizar
        </button>
      </div>

      {/* Filters */}
      <Card style={{ marginBottom: 24, display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <label style={{ fontSize: 12, color: "var(--t3,#666)", fontWeight: 600 }}>DESDE</label>
          <input
            type="date" value={from} onChange={e => setFrom(e.target.value)}
            style={{
              background: "var(--ink,#0f0f1a)", border: "1px solid var(--border,rgba(255,255,255,0.1))",
              borderRadius: 7, padding: "6px 10px", color: "var(--t,#fff)", fontSize: 13,
            }}
          />
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <label style={{ fontSize: 12, color: "var(--t3,#666)", fontWeight: 600 }}>HASTA</label>
          <input
            type="date" value={to} onChange={e => setTo(e.target.value)}
            style={{
              background: "var(--ink,#0f0f1a)", border: "1px solid var(--border,rgba(255,255,255,0.1))",
              borderRadius: 7, padding: "6px 10px", color: "var(--t,#fff)", fontSize: 13,
            }}
          />
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <label style={{ fontSize: 12, color: "var(--t3,#666)", fontWeight: 600 }}>MOTOR</label>
          <select
            value={provider}
            onChange={e => setProvider(e.target.value as Provider)}
            style={{
              background: "var(--ink,#0f0f1a)", border: "1px solid var(--border,rgba(255,255,255,0.1))",
              borderRadius: 7, padding: "6px 10px", color: "var(--t,#fff)", fontSize: 13,
            }}
          >
            {PROVIDERS.map(p => (
              <option key={p} value={p}>{p === "all" ? "Todos los motores" : p}</option>
            ))}
          </select>
        </div>
      </Card>

      {/* KPI cards */}
      {stats && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(200px,1fr))", gap: 16, marginBottom: 28 }}>
          <KpiCard
            icon={<DollarSign size={18} />}
            label="Coste total (USD)"
            value={fmt(stats.totals.current.costUsd, 4)}
            sub={fmtEur(stats.totals.current.costEur, 4) + " EUR"}
            trend={stats.totals.pctChange}
            trendLabel="vs mes anterior"
          />
          <KpiCard
            icon={<Activity size={18} />}
            label="Llamadas API"
            value={fmtNum(stats.totals.current.calls)}
            sub={`Mes anterior: ${fmtNum(stats.totals.previousMonth.calls)}`}
          />
          <KpiCard
            icon={<Zap size={18} />}
            label="Tokens entrada"
            value={fmtNum(stats.totals.current.inputTokens)}
            sub={`Salida: ${fmtNum(stats.totals.current.outputTokens)}`}
          />
          <KpiCard
            icon={<BarChart2 size={18} />}
            label="Mes anterior (USD)"
            value={fmt(stats.totals.previousMonth.costUsd, 4)}
            sub={fmtEur(stats.totals.previousMonth.costEur, 4) + " EUR"}
          />
        </div>
      )}

      {/* Daily cost chart */}
      <Card style={{ marginBottom: 28 }}>
        <div style={{ marginBottom: 16, fontWeight: 600, color: "var(--t,#fff)", fontSize: 14 }}>
          Coste diario por motor (USD)
        </div>
        {chartData.length === 0 ? (
          <div style={{ textAlign: "center", padding: "40px 0", color: "var(--t3,#666)", fontSize: 13 }}>
            Sin datos en el rango seleccionado
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={chartData} barSize={provider === "all" ? 8 : 14}>
              <XAxis dataKey="day" tick={{ fill: "var(--t3,#666)", fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: "var(--t3,#666)", fontSize: 11 }} axisLine={false} tickLine={false}
                tickFormatter={v => v > 0 ? `$${v.toFixed(4)}` : "0"} width={70} />
              <Tooltip
                contentStyle={{ background: "#1a1a2e", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8, fontSize: 12 }}
                formatter={(v: number, name: string) => [`$${v.toFixed(6)}`, name]}
              />
              <Legend iconSize={10} wrapperStyle={{ fontSize: 11 }} />
              {(provider === "all" ? (stats ? [...new Set(stats.daily.map(d => d.provider))] : []) : [provider]).map(p => (
                <Bar key={p} dataKey={p} stackId="cost" fill={PROVIDER_COLORS[p] ?? "#888"} name={p} />
              ))}
            </BarChart>
          </ResponsiveContainer>
        )}
      </Card>

      {/* By-provider breakdown */}
      {stats && stats.byProvider.length > 0 && (
        <Card style={{ marginBottom: 28 }}>
          <div style={{ marginBottom: 16, fontWeight: 600, color: "var(--t,#fff)", fontSize: 14 }}>
            Desglose por motor
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 12 }}>
            {stats.byProvider.map(bp => (
              <div key={bp.provider} style={{
                background: "var(--ink,#0f0f1a)", borderRadius: 8, padding: "10px 16px",
                border: `1px solid ${PROVIDER_COLORS[bp.provider] ?? "#444"}40`,
                minWidth: 140,
              }}>
                <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
                  <div style={{ width: 8, height: 8, borderRadius: "50%", background: PROVIDER_COLORS[bp.provider] ?? "#888" }} />
                  <span style={{ fontSize: 12, fontWeight: 700, color: "var(--t,#fff)", textTransform: "uppercase" }}>{bp.provider}</span>
                </div>
                <div style={{ fontSize: 16, fontWeight: 700, color: "var(--gold,#f59e0b)" }}>{fmt(bp.costUsd, 4)}</div>
                <div style={{ fontSize: 11, color: "var(--t3,#666)" }}>{fmtEur(bp.costEur, 4)} · {fmtNum(bp.calls)} llamadas</div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Logs table */}
      <Card>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
          <div style={{ fontWeight: 600, color: "var(--t,#fff)", fontSize: 14 }}>
            Registro de llamadas
            {logs && <span style={{ marginLeft: 8, fontSize: 12, color: "var(--t3,#666)", fontWeight: 400 }}>({fmtNum(logs.total)} total)</span>}
          </div>
        </div>

        {logsLoading ? (
          <div style={{ textAlign: "center", padding: "40px 0", color: "var(--t3,#666)", fontSize: 13 }}>Cargando...</div>
        ) : !logs || logs.rows.length === 0 ? (
          <div style={{ textAlign: "center", padding: "40px 0", color: "var(--t3,#666)", fontSize: 13 }}>Sin registros</div>
        ) : (
          <>
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                <thead>
                  <tr>
                    {["Proyecto / Tienda", "Motor", "Modelo", "Operación", "Tokens (in/out)", "Coste USD", "Coste EUR", "Estado", "Fecha"].map(h => (
                      <th key={h} style={{
                        textAlign: "left", padding: "8px 10px", color: "var(--t3,#666)",
                        fontWeight: 700, borderBottom: "1px solid var(--border,rgba(255,255,255,0.07))",
                        whiteSpace: "nowrap", fontSize: 11, letterSpacing: "0.04em", textTransform: "uppercase",
                      }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {logs.rows.map(row => (
                    <tr key={row.id} style={{ borderBottom: "1px solid var(--border,rgba(255,255,255,0.04))" }}>
                      <td style={{ padding: "9px 10px", color: "var(--t,#fff)" }}>
                        {row.projectName
                          ? <span title={row.shopDomain ?? ""}>{row.projectName}</span>
                          : <span style={{ color: "var(--t3,#666)" }}>—</span>
                        }
                      </td>
                      <td style={{ padding: "9px 10px" }}>
                        <span style={{
                          display: "inline-flex", alignItems: "center", gap: 5,
                          background: `${PROVIDER_COLORS[row.provider] ?? "#888"}22`,
                          color: PROVIDER_COLORS[row.provider] ?? "#888",
                          borderRadius: 5, padding: "2px 7px", fontWeight: 700, fontSize: 11,
                        }}>
                          {row.provider}
                        </span>
                      </td>
                      <td style={{ padding: "9px 10px", color: "var(--t3,#888)", fontFamily: "monospace", fontSize: 11 }}>
                        {row.model ?? "—"}
                      </td>
                      <td style={{ padding: "9px 10px", color: "var(--t,#ccc)", maxWidth: 180, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={row.operation}>
                        {row.operation}
                      </td>
                      <td style={{ padding: "9px 10px", color: "var(--t3,#888)", fontFamily: "monospace", fontSize: 11 }}>
                        {fmtNum(row.inputUnits)} / {fmtNum(row.outputUnits)}
                        {row.unitsLabel && <span style={{ marginLeft: 3, fontSize: 10, color: "var(--t3,#555)" }}>{row.unitsLabel}</span>}
                      </td>
                      <td style={{ padding: "9px 10px", color: "var(--gold,#f59e0b)", fontWeight: 600, fontFamily: "monospace", fontSize: 11 }}>
                        {fmt(row.costUsd, 6)}
                      </td>
                      <td style={{ padding: "9px 10px", color: "var(--jade,#10b981)", fontFamily: "monospace", fontSize: 11 }}>
                        {fmtEur(row.costEur, 6)}
                      </td>
                      <td style={{ padding: "9px 10px" }}>
                        <span style={{
                          fontSize: 11, fontWeight: 700,
                          color: row.success === 1 ? "var(--jade,#10b981)" : "var(--crim,#ef4444)",
                        }}>
                          {row.success === 1 ? "✓" : "✗"}
                        </span>
                      </td>
                      <td style={{ padding: "9px 10px", color: "var(--t3,#666)", whiteSpace: "nowrap", fontSize: 11 }}>
                        {new Date(row.createdAt).toLocaleString("es-ES", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {logs.totalPages > 1 && (
              <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 12, marginTop: 18 }}>
                <button
                  onClick={() => handlePageChange(page - 1)}
                  disabled={page <= 1}
                  style={{
                    background: "none", border: "1px solid var(--border,rgba(255,255,255,0.1))",
                    borderRadius: 6, padding: "5px 10px", color: page <= 1 ? "var(--t3,#555)" : "var(--t,#fff)",
                    cursor: page <= 1 ? "not-allowed" : "pointer",
                  }}
                >
                  <ChevronLeft size={14} />
                </button>
                <span style={{ fontSize: 12, color: "var(--t3,#666)" }}>
                  Pág. {page} / {logs.totalPages}
                </span>
                <button
                  onClick={() => handlePageChange(page + 1)}
                  disabled={page >= logs.totalPages}
                  style={{
                    background: "none", border: "1px solid var(--border,rgba(255,255,255,0.1))",
                    borderRadius: 6, padding: "5px 10px", color: page >= logs.totalPages ? "var(--t3,#555)" : "var(--t,#fff)",
                    cursor: page >= logs.totalPages ? "not-allowed" : "pointer",
                  }}
                >
                  <ChevronRight size={14} />
                </button>
              </div>
            )}
          </>
        )}
      </Card>
    </div>
  );
}
