import { useCallback, useEffect, useState } from "react";
import { Activity, BarChart2, ChevronLeft, ChevronRight, DollarSign, Download, Loader2, Minus, TrendingDown, TrendingUp, Zap } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend } from "recharts";
import { getModelShortName } from "@/lib/model-aliases";
import { useModalLock } from "@/hooks/use-modal-lock";
import { filenameFromDisposition } from "@/lib/api-usage-ui";

const API_BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

// ─── ProjectCostModal ─────────────────────────────────────────────────────────
interface ProjectCostModalProps { projectId: string | number | null; name: string; onClose: () => void; }

const PROVIDER_COLORS: Record<string, string> = {
  gemini: "#2dd49f", claude: "#c8a84b", openai: "#10a37f",
  replicate: "#6366f1", runway: "#e779c1", elevenlabs: "#f97316",
  pagespeed: "#60a5fa", shopify: "#95bf47", other: "#888",
};

function buildChartData(daily: Array<{ day: string; provider: string; costUsd: number }>) {
  const map: Record<string, Record<string, number>> = {};
  const providers = new Set<string>();
  for (const r of daily) {
    if (!map[r.day]) map[r.day] = {};
    map[r.day][r.provider] = (map[r.day][r.provider] ?? 0) + Number(r.costUsd);
    providers.add(r.provider);
  }
  return {
    data: Object.entries(map).sort(([a], [b]) => a.localeCompare(b)).map(([day, vals]) => ({
      day: day.slice(5),
      ...Object.fromEntries([...providers].map(p => [p, +(vals[p] ?? 0).toFixed(6)])),
    })),
    providers: [...providers],
  };
}

export default function ProjectCostModal({ projectId, name, onClose }: ProjectCostModalProps) {
  useModalLock();
  const [stats, setStats]         = useState<any>(null);
  const [logs, setLogs]           = useState<any>(null);
  const [page, setPage]           = useState(1);
  const [loading, setLoading]     = useState(true);
  const [logsLoading, setLogsLoading] = useState(false);

  const loadStats = useCallback(async () => {
    if (!projectId) return;
    setLoading(true);
    try {
      const r = await fetch(`${API_BASE}/api/api-usage/stats?projectId=${projectId}`, { credentials: "include" });
      if (r.ok) setStats(await r.json());
    } finally { setLoading(false); }
  }, [projectId]);

  const loadLogs = useCallback(async (p: number) => {
    if (!projectId) return;
    setLogsLoading(true);
    try {
      const r = await fetch(`${API_BASE}/api/api-usage/logs?projectId=${projectId}&page=${p}`, { credentials: "include" });
      if (r.ok) setLogs(await r.json());
    } finally { setLogsLoading(false); }
  }, [projectId]);

  useEffect(() => { loadStats(); loadLogs(1); }, [loadStats, loadLogs]);

  function handlePage(np: number) { setPage(np); loadLogs(np); }

  // Mismo período que muestra el modal: del día 1 del mes a hoy.
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);
  async function handleExport() {
    if (!projectId) return;
    setExporting(true);
    setExportError(null);
    try {
      const d = new Date();
      const pad = (n: number) => String(n).padStart(2, "0");
      const from = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-01`;
      const to = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
      const qs = new URLSearchParams({ from, to, projectId: String(projectId) }).toString();
      const r = await fetch(`${API_BASE}/api/api-usage/export?${qs}`, { credentials: "include" });
      if (!r.ok) throw new Error(`Error ${r.status}`);
      const blob = await r.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filenameFromDisposition(r.headers.get("Content-Disposition"), `costes-ia-proyecto-${projectId}-${from}_${to}.csv`);
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      setExportError(`No se pudo exportar: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setExporting(false);
    }
  }

  const now = new Date();
  const monthName = now.toLocaleString("es-ES", { month: "long", year: "numeric" });
  const cur  = stats?.totals?.current;
  const prev = stats?.totals?.previousMonth;
  const pct  = stats?.totals?.pctChange;
  const { data: chartData, providers: chartProviders } = stats?.daily
    ? buildChartData(stats.daily)
    : { data: [], providers: [] };

  const fmtN = (n: number | null | undefined) =>
    n == null ? "0" : Number(n).toLocaleString("es-ES");

  return (
    <div className="modal-overlay" style={{ padding: 20 }} onClick={onClose}>
      <div style={{ background: "var(--ink,#0f0f1a)", border: "1px solid var(--bdr,rgba(255,255,255,0.1))", borderRadius: 14, width: "100%", maxWidth: 900, maxHeight: "90vh", overflowY: "auto", boxShadow: "0 8px 48px rgba(0,0,0,0.7)" }} onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "18px 24px", borderBottom: "1px solid var(--bdr,rgba(255,255,255,0.08))", position: "sticky", top: 0, background: "var(--ink,#0f0f1a)", zIndex: 1 }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <DollarSign size={16} style={{ color: "var(--gold,#c8a84b)" }} />
              <h2 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: "var(--t,#fff)" }}>Costes IA — {name}</h2>
            </div>
            <p style={{ margin: "3px 0 0 24px", fontSize: 12, color: "var(--t3,#666)" }}>
              Proyecto #{projectId} · {monthName}
            </p>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            {exportError && <span role="alert" style={{ fontSize: 12, color: "var(--crim,#ef4444)" }}>{exportError}</span>}
            {projectId && (
              <button
                onClick={handleExport}
                disabled={exporting}
                title="Descargar en CSV los costes de este proyecto en el mes en curso"
                style={{
                  display: "flex", alignItems: "center", gap: 6,
                  background: exporting ? "rgba(200,168,75,0.06)" : "rgba(200,168,75,0.12)",
                  border: "1px solid rgba(200,168,75,0.35)", borderRadius: 8, padding: "6px 12px",
                  color: exporting ? "rgba(200,168,75,0.5)" : "var(--gold,#c8a84b)",
                  cursor: exporting ? "not-allowed" : "pointer", fontSize: 12, fontWeight: 600, transition: "all 0.2s",
                }}
              >
                <Download size={13} style={{ animation: exporting ? "spin 0.6s linear infinite" : "none" }} />
                {exporting ? "Exportando…" : "Exportar CSV"}
              </button>
            )}
            <button onClick={onClose} aria-label="Cerrar" style={{ background: "none", border: "none", cursor: "pointer", color: "var(--t3,#666)", fontSize: 22, lineHeight: 1, padding: 4 }}>×</button>
          </div>
        </div>

        <div style={{ padding: "20px 24px" }}>
          {loading ? (
            <div style={{ display: "flex", justifyContent: "center", padding: 60 }}>
              <Loader2 size={28} style={{ color: "var(--gold,#c8a84b)", animation: "spin 0.6s linear infinite" }} />
            </div>
          ) : !projectId ? (
            <p style={{ textAlign: "center", color: "var(--t3)", padding: 40 }}>Este cliente no tiene proyecto asignado.</p>
          ) : (
            <>
              {/* KPI cards */}
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(180px,1fr))", gap: 14, marginBottom: 24 }}>
                {/* Cost this month */}
                <div style={{ background: "var(--ink2,#1a1a2e)", border: "1px solid var(--border,rgba(255,255,255,0.08))", borderRadius: 12, padding: "18px 20px" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
                    <DollarSign size={16} style={{ color: "var(--gold,#c8a84b)" }} />
                    <span style={{ fontSize: 11, color: "var(--t3,#666)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em" }}>Coste total (USD)</span>
                  </div>
                  <div style={{ fontSize: 26, fontWeight: 700, color: "var(--t,#fff)" }}>${Number(cur?.costUsd ?? 0).toFixed(4)}</div>
                  <div style={{ fontSize: 12, color: "var(--t3,#666)", marginTop: 4 }}>€{Number(cur?.costEur ?? 0).toFixed(4)} EUR</div>
                  {pct != null && (
                    <div style={{ display: "flex", alignItems: "center", gap: 4, marginTop: 8, fontSize: 12, fontWeight: 600, color: pct < 0 ? "var(--jade,#10b981)" : pct > 0 ? "var(--crim,#ef4444)" : "var(--t3,#666)" }}>
                      {pct > 0 ? <TrendingUp size={13} /> : pct < 0 ? <TrendingDown size={13} /> : <Minus size={13} />}
                      {pct > 0 ? "+" : ""}{pct.toFixed(1)}% vs mes anterior
                    </div>
                  )}
                </div>
                {/* Calls & tokens */}
                <div style={{ background: "var(--ink2,#1a1a2e)", border: "1px solid var(--border,rgba(255,255,255,0.08))", borderRadius: 12, padding: "18px 20px" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
                    <Activity size={16} style={{ color: "var(--gold,#c8a84b)" }} />
                    <span style={{ fontSize: 11, color: "var(--t3,#666)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em" }}>Llamadas API</span>
                  </div>
                  <div style={{ fontSize: 26, fontWeight: 700, color: "var(--t,#fff)" }}>{fmtN(cur?.calls)}</div>
                  <div style={{ fontSize: 12, color: "var(--t3,#666)", marginTop: 4 }}>Mes anterior: {fmtN(prev?.calls)}</div>
                </div>
                {/* Tokens */}
                <div style={{ background: "var(--ink2,#1a1a2e)", border: "1px solid var(--border,rgba(255,255,255,0.08))", borderRadius: 12, padding: "18px 20px" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
                    <Zap size={16} style={{ color: "var(--gold,#c8a84b)" }} />
                    <span style={{ fontSize: 11, color: "var(--t3,#666)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em" }}>Tokens entrada</span>
                  </div>
                  <div style={{ fontSize: 26, fontWeight: 700, color: "var(--t,#fff)" }}>{fmtN(cur?.inputTokens)}</div>
                  <div style={{ fontSize: 12, color: "var(--t3,#666)", marginTop: 4 }}>Salida: {fmtN(cur?.outputTokens)}</div>
                </div>
                {/* Previous month */}
                <div style={{ background: "var(--ink2,#1a1a2e)", border: "1px solid var(--border,rgba(255,255,255,0.08))", borderRadius: 12, padding: "18px 20px" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
                    <BarChart2 size={16} style={{ color: "var(--gold,#c8a84b)" }} />
                    <span style={{ fontSize: 11, color: "var(--t3,#666)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em" }}>Mes anterior (USD)</span>
                  </div>
                  <div style={{ fontSize: 26, fontWeight: 700, color: "var(--t,#fff)" }}>${Number(prev?.costUsd ?? 0).toFixed(4)}</div>
                  <div style={{ fontSize: 12, color: "var(--t3,#666)", marginTop: 4 }}>€{Number(prev?.costEur ?? 0).toFixed(4)} EUR</div>
                </div>
              </div>

              {/* Daily chart */}
              <div style={{ background: "var(--ink2,#1a1a2e)", border: "1px solid var(--border,rgba(255,255,255,0.08))", borderRadius: 12, padding: "18px 20px", marginBottom: 20 }}>
                <div style={{ marginBottom: 14, fontWeight: 600, color: "var(--t,#fff)", fontSize: 14 }}>Coste diario por motor (USD)</div>
                {chartData.length === 0 ? (
                  <div style={{ textAlign: "center", padding: "32px 0", color: "var(--t3,#666)", fontSize: 13 }}>Sin datos en este periodo</div>
                ) : (
                  <ResponsiveContainer width="100%" height={220}>
                    <BarChart data={chartData} barSize={10}>
                      <XAxis dataKey="day" tick={{ fill: "var(--t3,#666)", fontSize: 11 }} axisLine={false} tickLine={false} />
                      <YAxis tick={{ fill: "var(--t3,#666)", fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={v => v > 0 ? `$${v.toFixed(4)}` : "0"} width={72} />
                      <Tooltip
                        contentStyle={{ background: "#1a1a2e", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8, fontSize: 12 }}
                        formatter={(v: number, name: string) => [`$${v.toFixed(6)}`, name]}
                      />
                      <Legend iconSize={10} wrapperStyle={{ fontSize: 11 }} />
                      {chartProviders.map(p => (
                        <Bar key={p} dataKey={p} stackId="cost" fill={PROVIDER_COLORS[p] ?? "#888"} name={p} />
                      ))}
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </div>

              {/* Provider breakdown */}
              {stats?.byProvider && stats.byProvider.length > 0 && (
                <div style={{ background: "var(--ink2,#1a1a2e)", border: "1px solid var(--border,rgba(255,255,255,0.08))", borderRadius: 12, padding: "16px 20px", marginBottom: 20 }}>
                  <div style={{ fontSize: 14, fontWeight: 600, color: "var(--t,#fff)", marginBottom: 12 }}>Desglose por motor</div>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
                    {stats.byProvider.map((bp: any) => (
                      <div key={bp.provider} style={{ background: "var(--ink,#0f0f1a)", borderRadius: 8, padding: "10px 16px", border: `1px solid ${PROVIDER_COLORS[bp.provider] ?? "#444"}40`, minWidth: 130 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
                          <div style={{ width: 8, height: 8, borderRadius: "50%", background: PROVIDER_COLORS[bp.provider] ?? "#888" }} />
                          <span style={{ fontSize: 12, fontWeight: 700, color: "var(--t,#fff)", textTransform: "uppercase" }}>{bp.provider}</span>
                        </div>
                        <div style={{ fontSize: 15, fontWeight: 700, color: "var(--gold,#c8a84b)" }}>${Number(bp.costUsd).toFixed(4)}</div>
                        <div style={{ fontSize: 11, color: "var(--t3,#666)" }}>€{Number(bp.costEur).toFixed(4)} · {fmtN(bp.calls)} llamadas</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Logs table */}
              <div style={{ background: "var(--ink2,#1a1a2e)", border: "1px solid var(--border,rgba(255,255,255,0.08))", borderRadius: 12, padding: "16px 20px" }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
                  <div style={{ fontWeight: 600, color: "var(--t,#fff)", fontSize: 14 }}>
                    Registro de llamadas
                    {logs && <span style={{ marginLeft: 8, fontSize: 12, color: "var(--t3,#666)", fontWeight: 400 }}>({fmtN(logs.total)} total)</span>}
                  </div>
                </div>

                {logsLoading ? (
                  <div style={{ textAlign: "center", padding: "32px 0", color: "var(--t3,#666)", fontSize: 13 }}>Cargando...</div>
                ) : !logs || logs.rows?.length === 0 ? (
                  <div style={{ textAlign: "center", padding: "32px 0", color: "var(--t3,#666)", fontSize: 13 }}>Sin registros</div>
                ) : (
                  <>
                    <div style={{ overflowX: "auto" }}>
                      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                        <thead>
                          <tr>
                            {["Motor", "Modelo", "Operación", "Tokens (in/out)", "Coste USD", "Coste EUR", "Estado", "Fecha"].map(h => (
                              <th key={h} style={{ textAlign: "left", padding: "8px 10px", color: "var(--t3,#666)", fontWeight: 700, borderBottom: "1px solid var(--border,rgba(255,255,255,0.07))", whiteSpace: "nowrap", fontSize: 11, letterSpacing: "0.04em", textTransform: "uppercase" }}>{h}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {logs.rows.map((row: any) => (
                            <tr key={row.id} style={{ borderBottom: "1px solid var(--border,rgba(255,255,255,0.04))" }}>
                              <td style={{ padding: "9px 10px" }}>
                                <span style={{ display: "inline-flex", alignItems: "center", gap: 5, background: `${PROVIDER_COLORS[row.provider] ?? "#888"}22`, color: PROVIDER_COLORS[row.provider] ?? "#888", borderRadius: 5, padding: "2px 7px", fontWeight: 700, fontSize: 11 }}>
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
                                {fmtN(row.inputUnits)} / {fmtN(row.outputUnits)}
                                {row.unitsLabel && <span style={{ marginLeft: 3, fontSize: 10, color: "var(--t3,#555)" }}>{row.unitsLabel}</span>}
                              </td>
                              <td style={{ padding: "9px 10px", color: "var(--gold,#c8a84b)", fontWeight: 600, fontFamily: "monospace", fontSize: 11 }}>
                                ${Number(row.costUsd ?? 0).toFixed(6)}
                              </td>
                              <td style={{ padding: "9px 10px", color: "var(--jade,#10b981)", fontFamily: "monospace", fontSize: 11 }}>
                                €{Number(row.costEur ?? 0).toFixed(6)}
                              </td>
                              <td style={{ padding: "9px 10px" }}>
                                <span style={{ fontSize: 11, fontWeight: 700, color: row.success === 1 ? "var(--jade,#10b981)" : "var(--crim,#ef4444)" }}>
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
                    {logs.totalPages > 1 && (
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 12, marginTop: 18 }}>
                        <button onClick={() => handlePage(page - 1)} disabled={page <= 1} style={{ background: "none", border: "1px solid var(--border,rgba(255,255,255,0.1))", borderRadius: 6, padding: "5px 10px", color: page <= 1 ? "var(--t3,#555)" : "var(--t,#fff)", cursor: page <= 1 ? "not-allowed" : "pointer" }}>
                          <ChevronLeft size={14} />
                        </button>
                        <span style={{ fontSize: 12, color: "var(--t3,#666)" }}>Pág. {page} / {logs.totalPages}</span>
                        <button onClick={() => handlePage(page + 1)} disabled={page >= logs.totalPages} style={{ background: "none", border: "1px solid var(--border,rgba(255,255,255,0.1))", borderRadius: 6, padding: "5px 10px", color: page >= logs.totalPages ? "var(--t3,#555)" : "var(--t,#fff)", cursor: page >= logs.totalPages ? "not-allowed" : "pointer" }}>
                          <ChevronRight size={14} />
                        </button>
                      </div>
                    )}
                  </>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
