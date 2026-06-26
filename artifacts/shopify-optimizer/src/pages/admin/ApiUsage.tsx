import { useState, useEffect, useCallback } from "react";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend,
} from "recharts";
import {
  TrendingUp, TrendingDown, Minus, RefreshCw, ChevronLeft, ChevronRight,
  DollarSign, Zap, Activity, BarChart2, Download, Mail, CheckCircle, AlertCircle,
  Bell, BellOff, Save, MessageSquare, X,
} from "lucide-react";

import { getModelShortName } from "../../lib/model-aliases";

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

interface ChatSession {
  sessionId: string;
  provider: string;
  model: string | null;
  projectId: number | null;
  projectName: string | null;
  messages: number;
  inputTokens: number;
  outputTokens: number;
  costUsd: number;
  costEur: number;
  firstAt: string;
  lastAt: string;
}

interface ChatSessionDetail {
  id: string;
  model: string | null;
  provider: string;
  inputUnits: number;
  outputUnits: number;
  costUsd: number;
  costEur: number;
  metadata: string | null;
  createdAt: string;
}

interface ChatSessionsData {
  sessions: ChatSession[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

interface LogsData {
  rows: LogRow[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

function Card({ children, style, id }: { children: React.ReactNode; style?: React.CSSProperties; id?: string }) {
  return (
    <div id={id} style={{
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

interface AlertSettings {
  thresholdUsd: number;
  alertEmail:   string;
  enabled:      boolean;
  lastSent:     string | null;
}

export default function ApiUsage() {
  const [from,     setFrom]     = useState(monthStart());
  const [to,       setTo]       = useState(today());
  const [provider, setProvider] = useState<Provider>("all");
  const [stats,    setStats]    = useState<StatsData | null>(null);
  const [logs,     setLogs]     = useState<LogsData | null>(null);
  const [page,        setPage]        = useState(1);
  const [loading,     setLoading]     = useState(false);
  const [logsLoading, setLogsLoading] = useState(false);
  const [exporting,   setExporting]   = useState(false);
  const [sending,     setSending]     = useState(false);
  const [toast,       setToast]       = useState<{ type: "ok" | "err"; msg: string } | null>(null);

  const [alertSettings,     setAlertSettings]     = useState<AlertSettings | null>(null);
  const [alertThreshold,    setAlertThreshold]    = useState("");
  const [alertEmail,        setAlertEmail]        = useState("");
  const [alertEnabled,      setAlertEnabled]      = useState(true);
  const [savingAlert,       setSavingAlert]       = useState(false);

  const [chatSessions,      setChatSessions]      = useState<ChatSessionsData | null>(null);
  const [chatSessionsPage,  setChatSessionsPage]  = useState(1);
  const [chatSessionsLoad,  setChatSessionsLoad]  = useState(false);
  const [expandedSession,   setExpandedSession]   = useState<string | null>(null);
  const [sessionDetail,     setSessionDetail]     = useState<ChatSessionDetail[] | null>(null);
  const [sessionDetailLoad, setSessionDetailLoad] = useState(false);
  const [logsSessionId,     setLogsSessionId]     = useState<string | null>(null);

  const loadChatSessions = useCallback(async (p: number) => {
    setChatSessionsLoad(true);
    try {
      const qs = new URLSearchParams({ from, to, page: String(p) }).toString();
      const r = await fetch(`${API_BASE}/api/api-usage/chat-sessions?${qs}`, { credentials: "include" });
      if (r.ok) setChatSessions(await r.json());
    } finally {
      setChatSessionsLoad(false);
    }
  }, [from, to]);

  const loadSessionDetail = useCallback(async (sid: string) => {
    if (expandedSession === sid) { setExpandedSession(null); setSessionDetail(null); return; }
    setExpandedSession(sid);
    setSessionDetail(null);
    setSessionDetailLoad(true);
    try {
      const r = await fetch(`${API_BASE}/api/api-usage/chat-session/${encodeURIComponent(sid)}`, { credentials: "include" });
      if (r.ok) { const d = await r.json(); setSessionDetail(d.rows ?? []); }
    } finally {
      setSessionDetailLoad(false);
    }
  }, [expandedSession]);

  const loadAlertSettings = useCallback(async () => {
    try {
      const r = await fetch(`${API_BASE}/api/api-usage/alert-settings`, { credentials: "include" });
      if (r.ok) {
        const data: AlertSettings = await r.json();
        setAlertSettings(data);
        setAlertThreshold(data.thresholdUsd > 0 ? String(data.thresholdUsd) : "");
        setAlertEmail(data.alertEmail);
        setAlertEnabled(data.enabled);
      }
    } catch { /* ignore */ }
  }, []);

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

  const loadLogs = useCallback(async (p: number, sid?: string | null) => {
    setLogsLoading(true);
    try {
      const params: Record<string, string> = { from, to, provider, page: String(p) };
      const effectiveSid = sid !== undefined ? sid : logsSessionId;
      if (effectiveSid) params.sessionId = effectiveSid;
      const qs = new URLSearchParams(params).toString();
      const r = await fetch(`${API_BASE}/api/api-usage/logs?${qs}`, { credentials: "include" });
      if (r.ok) setLogs(await r.json());
    } finally {
      setLogsLoading(false);
    }
  }, [from, to, provider, logsSessionId]);

  function jumpToLogsForSession(sid: string) {
    setLogsSessionId(sid);
    setPage(1);
    loadLogs(1, sid);
    setTimeout(() => {
      document.getElementById("logs-table-card")?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 80);
  }

  function clearSessionFilter() {
    setLogsSessionId(null);
    setPage(1);
    loadLogs(1, null);
  }

  useEffect(() => {
    setPage(1);
    setChatSessionsPage(1);
    loadStats();
    loadLogs(1);
    loadChatSessions(1);
    loadAlertSettings();
  }, [loadStats, loadLogs, loadChatSessions, loadAlertSettings]);

  function handlePageChange(np: number) {
    setPage(np);
    loadLogs(np);
  }

  async function handleSaveAlert() {
    setSavingAlert(true);
    setToast(null);
    try {
      const thresholdVal = parseFloat(alertThreshold) || 0;
      const r = await fetch(`${API_BASE}/api/api-usage/alert-settings`, {
        method: "PUT",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ thresholdUsd: thresholdVal, alertEmail, enabled: alertEnabled }),
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data?.error ?? `Error ${r.status}`);
      await loadAlertSettings();
      setToast({ type: "ok", msg: "✅ Configuración de alerta guardada" });
    } catch (err) {
      setToast({ type: "err", msg: `❌ ${err instanceof Error ? err.message : String(err)}` });
    } finally {
      setSavingAlert(false);
      setTimeout(() => setToast(null), 5000);
    }
  }

  async function handleExport() {
    setExporting(true);
    try {
      const qs = new URLSearchParams({ from, to, provider }).toString();
      const r = await fetch(`${API_BASE}/api/api-usage/export?${qs}`, { credentials: "include" });
      if (!r.ok) throw new Error(`Error ${r.status}`);
      const blob = await r.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `costes-ia-${from}_${to}.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      alert(`No se pudo exportar: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setExporting(false);
    }
  }

  async function handleSendEmail() {
    setSending(true);
    setToast(null);
    try {
      const r = await fetch(`${API_BASE}/api/api-usage/send-email`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ from, to, provider }),
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data?.error ?? `Error ${r.status}`);
      setToast({ type: "ok", msg: `✅ Informe enviado a craftershopy@gmail.com (${data.rows} registros)` });
    } catch (err) {
      setToast({ type: "err", msg: `❌ ${err instanceof Error ? err.message : String(err)}` });
    } finally {
      setSending(false);
      setTimeout(() => setToast(null), 6000);
    }
  }

  const providers = stats ? [...new Set(stats.daily.map(d => d.provider))] : [];
  const chartData = stats ? buildChartData(stats.daily, provider) : [];

  return (
    <div style={{ padding: "24px 28px", minHeight: "100vh", background: "var(--ink,#0f0f1a)" }}>
      {/* Toast */}
      {toast && (
        <div style={{
          position: "fixed", top: 20, right: 24, zIndex: 9999,
          display: "flex", alignItems: "center", gap: 10,
          background: toast.type === "ok" ? "rgba(45,212,159,0.12)" : "rgba(239,68,68,0.12)",
          border: `1px solid ${toast.type === "ok" ? "rgba(45,212,159,0.35)" : "rgba(239,68,68,0.35)"}`,
          borderRadius: 10, padding: "12px 18px", maxWidth: 460,
          boxShadow: "0 4px 24px rgba(0,0,0,0.4)",
          color: toast.type === "ok" ? "#2dd49f" : "#ef4444",
          fontSize: 13, fontWeight: 500,
          animation: "fadeInRight 0.25s ease",
        }}>
          {toast.type === "ok"
            ? <CheckCircle size={16} style={{ flexShrink: 0 }} />
            : <AlertCircle size={16} style={{ flexShrink: 0 }} />}
          {toast.msg}
          <button onClick={() => setToast(null)} style={{ marginLeft: 8, background: "none", border: "none", cursor: "pointer", color: "inherit", fontSize: 16, lineHeight: 1, padding: 0, opacity: 0.7 }}>×</button>
        </div>
      )}

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
        <div style={{ display: "flex", gap: 8 }}>
          <button
            onClick={handleExport}
            disabled={exporting}
            style={{
              display: "flex", alignItems: "center", gap: 6,
              background: exporting ? "rgba(200,168,75,0.08)" : "rgba(200,168,75,0.12)",
              border: "1px solid rgba(200,168,75,0.35)",
              borderRadius: 8, padding: "7px 14px",
              color: exporting ? "rgba(200,168,75,0.5)" : "var(--gold,#f59e0b)",
              cursor: exporting ? "not-allowed" : "pointer", fontSize: 13, fontWeight: 600,
              transition: "all 0.2s",
            }}
          >
            <Download size={14} style={{ animation: exporting ? "spin 0.6s linear infinite" : "none" }} />
            {exporting ? "Exportando…" : "Exportar CSV"}
          </button>
          <button
            onClick={handleSendEmail}
            disabled={sending}
            title="Enviar el informe CSV del período seleccionado por email"
            style={{
              display: "flex", alignItems: "center", gap: 6,
              background: sending ? "rgba(45,212,159,0.04)" : "rgba(45,212,159,0.08)",
              border: "1px solid rgba(45,212,159,0.28)",
              borderRadius: 8, padding: "7px 14px",
              color: sending ? "rgba(45,212,159,0.4)" : "#2dd49f",
              cursor: sending ? "not-allowed" : "pointer", fontSize: 13, fontWeight: 600,
              transition: "all 0.2s",
            }}
          >
            <Mail size={14} style={{ animation: sending ? "spin 0.6s linear infinite" : "none" }} />
            {sending ? "Enviando…" : "Enviar por email"}
          </button>
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

      {/* Budget Alert Panel */}
      <Card style={{ marginBottom: 28 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{
              width: 34, height: 34, borderRadius: "50%",
              background: alertEnabled ? "rgba(239,68,68,0.12)" : "rgba(100,100,100,0.1)",
              border: `1px solid ${alertEnabled ? "rgba(239,68,68,0.3)" : "rgba(100,100,100,0.2)"}`,
              display: "flex", alignItems: "center", justifyContent: "center",
              color: alertEnabled ? "#ef4444" : "#666",
            }}>
              {alertEnabled ? <Bell size={15} /> : <BellOff size={15} />}
            </div>
            <div>
              <div style={{ fontWeight: 700, color: "var(--t,#fff)", fontSize: 14 }}>Alerta de Presupuesto Mensual</div>
              <div style={{ fontSize: 11, color: "var(--t3,#666)", marginTop: 2 }}>
                Email automático cuando el gasto IA supera el umbral · revisión diaria 8am
              </div>
            </div>
          </div>
          {alertSettings && stats && alertSettings.thresholdUsd > 0 && (() => {
            const spent = stats.totals.current.costUsd;
            const pct   = (spent / alertSettings.thresholdUsd) * 100;
            const over  = spent >= alertSettings.thresholdUsd;
            return (
              <div style={{
                background: over ? "rgba(239,68,68,0.08)" : "rgba(45,212,159,0.06)",
                border: `1px solid ${over ? "rgba(239,68,68,0.25)" : "rgba(45,212,159,0.2)"}`,
                borderRadius: 8, padding: "8px 14px", textAlign: "center",
              }}>
                <div style={{ fontSize: 18, fontWeight: 700, color: over ? "#ef4444" : "#2dd49f" }}>
                  {pct.toFixed(1)}%
                </div>
                <div style={{ fontSize: 10, color: "var(--t3,#666)", marginTop: 1 }}>
                  {over ? "⚠️ UMBRAL SUPERADO" : "del umbral usado"}
                </div>
              </div>
            );
          })()}
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr auto auto", gap: 12, alignItems: "end" }}>
          <div>
            <label style={{ fontSize: 11, color: "var(--t3,#666)", fontWeight: 600, letterSpacing: "0.04em", textTransform: "uppercase", display: "block", marginBottom: 6 }}>
              Umbral mensual (USD)
            </label>
            <div style={{ position: "relative" }}>
              <span style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: "var(--gold,#f59e0b)", fontSize: 14, fontWeight: 700 }}>$</span>
              <input
                type="number"
                min="0"
                step="0.01"
                value={alertThreshold}
                onChange={e => setAlertThreshold(e.target.value)}
                placeholder="ej. 10.00"
                style={{
                  width: "100%", boxSizing: "border-box",
                  background: "var(--ink,#0f0f1a)", border: "1px solid var(--border,rgba(255,255,255,0.1))",
                  borderRadius: 8, padding: "9px 10px 9px 26px", color: "var(--t,#fff)", fontSize: 14,
                  fontWeight: 600,
                }}
              />
            </div>
          </div>

          <div>
            <label style={{ fontSize: 11, color: "var(--t3,#666)", fontWeight: 600, letterSpacing: "0.04em", textTransform: "uppercase", display: "block", marginBottom: 6 }}>
              Email de destino
            </label>
            <input
              type="email"
              value={alertEmail}
              onChange={e => setAlertEmail(e.target.value)}
              placeholder="admin@ejemplo.com"
              style={{
                width: "100%", boxSizing: "border-box",
                background: "var(--ink,#0f0f1a)", border: "1px solid var(--border,rgba(255,255,255,0.1))",
                borderRadius: 8, padding: "9px 12px", color: "var(--t,#fff)", fontSize: 13,
              }}
            />
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 8, paddingBottom: 2 }}>
            <button
              onClick={() => setAlertEnabled(v => !v)}
              style={{
                display: "flex", alignItems: "center", gap: 6,
                background: alertEnabled ? "rgba(45,212,159,0.08)" : "rgba(100,100,100,0.08)",
                border: `1px solid ${alertEnabled ? "rgba(45,212,159,0.28)" : "rgba(100,100,100,0.2)"}`,
                borderRadius: 8, padding: "9px 14px",
                color: alertEnabled ? "#2dd49f" : "#888",
                cursor: "pointer", fontSize: 13, fontWeight: 600, whiteSpace: "nowrap",
                transition: "all 0.2s",
              }}
            >
              {alertEnabled ? <Bell size={13} /> : <BellOff size={13} />}
              {alertEnabled ? "Activa" : "Inactiva"}
            </button>
          </div>

          <div style={{ paddingBottom: 2 }}>
            <button
              onClick={handleSaveAlert}
              disabled={savingAlert}
              style={{
                display: "flex", alignItems: "center", gap: 6,
                background: savingAlert ? "rgba(200,168,75,0.06)" : "rgba(200,168,75,0.12)",
                border: "1px solid rgba(200,168,75,0.35)",
                borderRadius: 8, padding: "9px 16px",
                color: savingAlert ? "rgba(200,168,75,0.5)" : "var(--gold,#f59e0b)",
                cursor: savingAlert ? "not-allowed" : "pointer", fontSize: 13, fontWeight: 600,
                whiteSpace: "nowrap", transition: "all 0.2s",
              }}
            >
              <Save size={13} style={{ animation: savingAlert ? "spin 0.6s linear infinite" : "none" }} />
              {savingAlert ? "Guardando…" : "Guardar"}
            </button>
          </div>
        </div>

        {alertSettings?.lastSent && (
          <div style={{ marginTop: 12, fontSize: 11, color: "var(--t3,#555)" }}>
            Última alerta enviada: <span style={{ color: "var(--t3,#777)" }}>{alertSettings.lastSent}</span>
          </div>
        )}

        {alertSettings && alertSettings.thresholdUsd > 0 && stats && (
          <div style={{ marginTop: 14 }}>
            <div style={{ height: 6, borderRadius: 3, background: "rgba(255,255,255,0.06)", overflow: "hidden" }}>
              <div style={{
                height: "100%", borderRadius: 3, transition: "width 0.5s ease",
                width: `${Math.min(100, (stats.totals.current.costUsd / alertSettings.thresholdUsd) * 100)}%`,
                background: stats.totals.current.costUsd >= alertSettings.thresholdUsd
                  ? "linear-gradient(90deg,#ef4444,#dc2626)"
                  : stats.totals.current.costUsd >= alertSettings.thresholdUsd * 0.8
                    ? "linear-gradient(90deg,#f59e0b,#d97706)"
                    : "linear-gradient(90deg,#2dd49f,#10b981)",
              }} />
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", marginTop: 4, fontSize: 10, color: "var(--t3,#555)" }}>
              <span>$0</span>
              <span style={{ color: stats.totals.current.costUsd >= alertSettings.thresholdUsd ? "#ef4444" : "var(--t3,#555)" }}>
                ${fmt(stats.totals.current.costUsd, 4)} / ${alertSettings.thresholdUsd.toFixed(2)}
              </span>
              <span>${alertSettings.thresholdUsd.toFixed(2)}</span>
            </div>
          </div>
        )}
      </Card>

      {/* Chat Sessions History */}
      <Card id="chat-sessions" style={{ marginBottom: 28 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <MessageSquare size={16} style={{ color: "var(--gold,#f59e0b)" }} />
            <div style={{ fontWeight: 600, color: "var(--t,#fff)", fontSize: 14 }}>
              Historial de Conversaciones del Chatbot
              {chatSessions && <span style={{ marginLeft: 8, fontSize: 12, color: "var(--t3,#666)", fontWeight: 400 }}>({fmtNum(chatSessions.total)} sesiones)</span>}
            </div>
          </div>
          <button
            onClick={() => loadChatSessions(chatSessionsPage)}
            disabled={chatSessionsLoad}
            style={{ background: "none", border: "1px solid var(--border,rgba(255,255,255,0.12))", borderRadius: 7, padding: "5px 10px", color: "var(--t3,#888)", cursor: "pointer", fontSize: 12 }}
          >
            <RefreshCw size={12} style={{ animation: chatSessionsLoad ? "spin 0.6s linear infinite" : "none" }} />
          </button>
        </div>

        {chatSessionsLoad ? (
          <div style={{ textAlign: "center", padding: "30px 0", color: "var(--t3,#666)", fontSize: 13 }}>Cargando...</div>
        ) : !chatSessions || chatSessions.sessions.length === 0 ? (
          <div style={{ textAlign: "center", padding: "30px 0", color: "var(--t3,#666)", fontSize: 13 }}>
            <MessageSquare size={28} style={{ opacity: 0.2, display: "block", margin: "0 auto 8px" }} />
            Sin conversaciones registradas en el período. Las próximas respuestas del chatbot admin quedarán guardadas aquí.
          </div>
        ) : (
          <>
            <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
              {chatSessions.sessions.map((sess) => {
                const isExpanded = expandedSession === sess.sessionId;
                const dur = sess.firstAt && sess.lastAt
                  ? Math.round((new Date(sess.lastAt).getTime() - new Date(sess.firstAt).getTime()) / 60000)
                  : 0;
                return (
                  <div key={sess.sessionId}>
                    <div
                      onClick={() => loadSessionDetail(sess.sessionId)}
                      style={{
                        display: "grid",
                        gridTemplateColumns: "1fr auto auto auto auto auto",
                        gap: 10, alignItems: "center",
                        padding: "10px 12px",
                        borderRadius: 8,
                        background: isExpanded ? "rgba(200,168,75,0.07)" : "transparent",
                        border: `1px solid ${isExpanded ? "rgba(200,168,75,0.2)" : "rgba(255,255,255,0.04)"}`,
                        cursor: "pointer",
                        transition: "all 0.15s",
                      }}
                      onMouseEnter={e => { if (!isExpanded) e.currentTarget.style.background = "rgba(255,255,255,0.03)"; }}
                      onMouseLeave={e => { if (!isExpanded) e.currentTarget.style.background = "transparent"; }}
                    >
                      <div style={{ minWidth: 0 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 2 }}>
                          <span style={{
                            display: "inline-flex", alignItems: "center",
                            background: `${PROVIDER_COLORS[sess.provider] ?? "#888"}22`,
                            color: PROVIDER_COLORS[sess.provider] ?? "#888",
                            borderRadius: 4, padding: "1px 6px", fontSize: 10, fontWeight: 700,
                          }}>{sess.provider}</span>
                          {sess.projectName && (
                            <span style={{ fontSize: 11, color: "var(--t3,#777)" }}>{sess.projectName}</span>
                          )}
                        </div>
                        <div style={{ fontSize: 10, color: "var(--t3,#555)", fontFamily: "monospace" }}>
                          {sess.sessionId.slice(0, 16)}…
                        </div>
                      </div>
                      <div style={{ textAlign: "center" }}>
                        <div style={{ fontSize: 14, fontWeight: 700, color: "var(--t,#fff)" }}>{fmtNum(sess.messages)}</div>
                        <div style={{ fontSize: 9, color: "var(--t3,#555)", textTransform: "uppercase" }}>msgs</div>
                      </div>
                      <div style={{ textAlign: "right" }}>
                        <div style={{ fontSize: 12, fontWeight: 600, color: "var(--t3,#888)", fontFamily: "monospace" }}>
                          {fmtNum(Number(sess.inputTokens) + Number(sess.outputTokens))}
                        </div>
                        <div style={{ fontSize: 9, color: "var(--t3,#555)", textTransform: "uppercase" }}>tokens</div>
                      </div>
                      <div style={{ textAlign: "right" }}>
                        <div style={{ fontSize: 13, fontWeight: 700, color: "var(--gold,#f59e0b)", fontFamily: "monospace" }}>
                          {fmt(sess.costUsd, 4)}
                        </div>
                        <div style={{ fontSize: 9, color: "var(--t3,#555)", textTransform: "uppercase" }}>coste</div>
                      </div>
                      <div style={{ textAlign: "right", whiteSpace: "nowrap" }}>
                        <div style={{ fontSize: 11, color: "var(--t3,#777)" }}>
                          {new Date(sess.lastAt).toLocaleString("es-ES", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}
                        </div>
                        {dur > 0 && <div style={{ fontSize: 9, color: "var(--t3,#555)" }}>{dur} min</div>}
                      </div>
                      <div style={{ color: "var(--t3,#666)", fontSize: 12 }}>
                        {isExpanded ? <X size={12} /> : <span style={{ opacity: 0.5 }}>▶</span>}
                      </div>
                    </div>

                    {isExpanded && (
                      <div style={{
                        marginLeft: 12, marginBottom: 4,
                        borderLeft: "2px solid rgba(200,168,75,0.2)",
                        paddingLeft: 12,
                      }}>
                        {sessionDetailLoad ? (
                          <div style={{ padding: "12px 0", color: "var(--t3,#666)", fontSize: 12 }}>Cargando detalle...</div>
                        ) : sessionDetail && sessionDetail.length === 0 ? (
                          <div style={{ padding: "12px 0", color: "var(--t3,#666)", fontSize: 12 }}>Sin detalle disponible</div>
                        ) : sessionDetail ? (
                          <div style={{ display: "flex", flexDirection: "column", gap: 4, padding: "6px 0" }}>
                            {sessionDetail.map((row, i) => {
                              let querySnippet = "";
                              try { querySnippet = JSON.parse(row.metadata ?? "{}").querySnippet ?? ""; } catch {}
                              return (
                                <div key={row.id} style={{
                                  display: "grid", gridTemplateColumns: "auto 1fr auto auto auto",
                                  gap: 10, alignItems: "center",
                                  padding: "7px 10px",
                                  background: "rgba(255,255,255,0.02)", borderRadius: 6,
                                  border: "1px solid rgba(255,255,255,0.04)",
                                }}>
                                  <div style={{ fontSize: 10, color: "var(--t3,#555)", fontWeight: 700, minWidth: 20, textAlign: "center" }}>
                                    #{i + 1}
                                  </div>
                                  <div style={{ minWidth: 0 }}>
                                    {querySnippet && (
                                      <div style={{ fontSize: 11, color: "var(--t3,#888)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                                        {querySnippet}
                                      </div>
                                    )}
                                    <div style={{ fontSize: 10, color: "var(--t3,#555)" }}>
                                      {getModelShortName(row.model)}
                                    </div>
                                  </div>
                                  <div style={{ fontSize: 11, fontFamily: "monospace", color: "var(--t3,#777)", whiteSpace: "nowrap" }}>
                                    {fmtNum(row.inputUnits)}/{fmtNum(row.outputUnits)} tok
                                  </div>
                                  <div style={{ fontSize: 11, fontWeight: 600, color: "var(--gold,#f59e0b)", fontFamily: "monospace", whiteSpace: "nowrap" }}>
                                    {fmt(row.costUsd, 5)}
                                  </div>
                                  <div style={{ fontSize: 10, color: "var(--t3,#555)", whiteSpace: "nowrap" }}>
                                    {new Date(row.createdAt).toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" })}
                                  </div>
                                </div>
                              );
                            })}
                            <div style={{
                              display: "flex", justifyContent: "space-between", alignItems: "center", gap: 16,
                              padding: "6px 10px 2px",
                              borderTop: "1px solid rgba(255,255,255,0.04)",
                              fontSize: 11, color: "var(--t3,#666)",
                            }}>
                              <div style={{ display: "flex", gap: 16 }}>
                                <span>Total: <strong style={{ color: "var(--gold,#f59e0b)" }}>{fmt(sess.costUsd, 4)}</strong></span>
                                <span>{fmtNum(Number(sess.inputTokens) + Number(sess.outputTokens))} tokens totales</span>
                                <span>{fmtEur(sess.costEur, 4)}</span>
                              </div>
                              <button
                                onClick={() => jumpToLogsForSession(sess.sessionId)}
                                title="Filtrar el registro de llamadas por esta sesión"
                                style={{
                                  display: "flex", alignItems: "center", gap: 5,
                                  background: "rgba(200,168,75,0.1)", border: "1px solid rgba(200,168,75,0.3)",
                                  borderRadius: 6, padding: "4px 10px",
                                  color: "var(--gold,#f59e0b)", cursor: "pointer", fontSize: 11, fontWeight: 600,
                                  whiteSpace: "nowrap",
                                }}
                              >
                                Ver en registro ↓
                              </button>
                            </div>
                          </div>
                        ) : null}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {chatSessions.totalPages > 1 && (
              <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 12, marginTop: 16 }}>
                <button
                  onClick={() => { setChatSessionsPage(p => { const np = p - 1; loadChatSessions(np); return np; }); }}
                  disabled={chatSessionsPage <= 1}
                  style={{ background: "none", border: "1px solid var(--border,rgba(255,255,255,0.1))", borderRadius: 6, padding: "5px 10px", color: chatSessionsPage <= 1 ? "var(--t3,#555)" : "var(--t,#fff)", cursor: chatSessionsPage <= 1 ? "not-allowed" : "pointer" }}
                >
                  <ChevronLeft size={14} />
                </button>
                <span style={{ fontSize: 12, color: "var(--t3,#666)" }}>
                  Pág. {chatSessionsPage} / {chatSessions.totalPages}
                </span>
                <button
                  onClick={() => { setChatSessionsPage(p => { const np = p + 1; loadChatSessions(np); return np; }); }}
                  disabled={chatSessionsPage >= chatSessions.totalPages}
                  style={{ background: "none", border: "1px solid var(--border,rgba(255,255,255,0.1))", borderRadius: 6, padding: "5px 10px", color: chatSessionsPage >= chatSessions.totalPages ? "var(--t3,#555)" : "var(--t,#fff)", cursor: chatSessionsPage >= chatSessions.totalPages ? "not-allowed" : "pointer" }}
                >
                  <ChevronRight size={14} />
                </button>
              </div>
            )}
          </>
        )}
      </Card>

      {/* Logs table */}
      <Card id="logs-table-card">
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16, flexWrap: "wrap", gap: 10 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
            <div style={{ fontWeight: 600, color: "var(--t,#fff)", fontSize: 14 }}>
              Registro de llamadas
              {logs && <span style={{ marginLeft: 8, fontSize: 12, color: "var(--t3,#666)", fontWeight: 400 }}>({fmtNum(logs.total)} total)</span>}
            </div>
            {logsSessionId && (
              <div style={{
                display: "flex", alignItems: "center", gap: 6,
                background: "rgba(200,168,75,0.1)", border: "1px solid rgba(200,168,75,0.3)",
                borderRadius: 6, padding: "3px 8px 3px 10px",
              }}>
                <span style={{ fontSize: 11, color: "var(--gold,#f59e0b)", fontFamily: "monospace" }}>
                  sesión: {logsSessionId.slice(0, 16)}…
                </span>
                <button
                  onClick={clearSessionFilter}
                  title="Quitar filtro de sesión"
                  style={{
                    background: "none", border: "none", cursor: "pointer",
                    color: "rgba(200,168,75,0.7)", padding: "0 2px", lineHeight: 1, fontSize: 13,
                  }}
                >×</button>
              </div>
            )}
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
                      <td style={{ padding: "9px 10px", color: "var(--t3,#888)", fontSize: 11 }} title={row.model ?? undefined}>
                        {getModelShortName(row.model)}
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
