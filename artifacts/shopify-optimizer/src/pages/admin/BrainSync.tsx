import { useState, useEffect, useRef, useCallback } from "react";
import { Brain, Download, Upload, RefreshCw, Activity, Database, Zap, ChevronRight, AlertCircle, CheckCircle2, X, Loader2, FileText, Sparkles, BarChart3, Cpu, Network } from "lucide-react";

const API_BASE = import.meta.env.BASE_URL?.replace(/\/$/, "") ?? "";

type Tab = "overview" | "export" | "import" | "tools";
type ExportKind = "knowledge" | "domains" | "prompts";

interface BrainStats {
  totalMemories?: number;
  totalInsights?: number;
  totalDomains?: number;
  totalPrompts?: number;
  totalNicheProfiles?: number;
  totalCrossConnections?: number;
  memorySources?: Record<string, number>;
  insightsByDomain?: Record<string, number>;
}

const TAB_DEFS: Array<{ id: Tab; label: string; icon: React.ReactNode; desc: string }> = [
  { id: "overview", label: "Vista General", icon: <Activity size={16} />, desc: "Estado del cerebro y métricas en tiempo real" },
  { id: "export",   label: "Exportar",      icon: <Download size={16} />, desc: "Descarga conocimiento, dominios o prompts" },
  { id: "import",   label: "Importar",      icon: <Upload size={16} />,   desc: "Restaura backups o inyecta conocimiento externo" },
  { id: "tools",    label: "Herramientas",  icon: <Cpu size={16} />,      desc: "Sync, inyección self-knowledge, Shopify services" },
];

export default function BrainSync() {
  const [tab, setTab] = useState<Tab>("overview");
  const [stats, setStats] = useState<BrainStats | null>(null);
  const [statsLoading, setStatsLoading] = useState(true);
  const [statsError, setStatsError] = useState("");
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null);

  const showToast = (msg: string, ok: boolean) => {
    setToast({ msg, ok });
    setTimeout(() => setToast(null), 4000);
  };

  const loadStats = useCallback(async () => {
    setStatsLoading(true);
    setStatsError("");
    try {
      const r = await fetch(`${API_BASE}/api/admin/brain-stats`, { credentials: "include" });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const d = await r.json();
      setStats(d);
    } catch (e: any) {
      setStatsError(e?.message || "Error cargando stats");
    } finally {
      setStatsLoading(false);
    }
  }, []);

  useEffect(() => { loadStats(); }, [loadStats]);

  // Auto refresh stats every 60s while overview is open
  useEffect(() => {
    if (tab !== "overview") return;
    const id = setInterval(loadStats, 60_000);
    return () => clearInterval(id);
  }, [tab, loadStats]);

  return (
    <div style={{ padding: "24px 32px", maxWidth: 1300, margin: "0 auto" }}>
      {/* HEADER */}
      <div style={{ marginBottom: 24, display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 16 }}>
        <div>
          <h1 style={{ fontSize: 28, fontWeight: 800, color: "var(--gold, #c8a84b)", marginBottom: 4, display: "flex", alignItems: "center", gap: 12 }}>
            <Brain size={28} />
            ShopyBrain Sync
          </h1>
          <p style={{ color: "var(--t2, #aaa)", fontSize: 14, maxWidth: 700 }}>
            Centro de mantenimiento del cerebro IA: backups, restauración, inyección de conocimiento y sincronización entre entornos.
          </p>
        </div>
        <button onClick={loadStats} disabled={statsLoading} className="btn btn-ghost" style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <RefreshCw size={14} className={statsLoading ? "animate-spin" : ""} />
          Actualizar
        </button>
      </div>

      {/* TOAST */}
      {toast && (
        <div style={{ position: "fixed", bottom: 24, right: 24, zIndex: 100, padding: "12px 18px", borderRadius: 10, background: toast.ok ? "rgba(45,212,159,0.15)" : "rgba(239,68,68,0.15)", border: `1px solid ${toast.ok ? "rgba(45,212,159,0.4)" : "rgba(239,68,68,0.4)"}`, color: toast.ok ? "#2dd49f" : "#ef4444", fontSize: 13, fontWeight: 600, display: "flex", alignItems: "center", gap: 10, maxWidth: 420, boxShadow: "0 8px 32px rgba(0,0,0,0.4)" }}>
          {toast.ok ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
          {toast.msg}
          <button onClick={() => setToast(null)} style={{ background: "none", border: "none", color: "inherit", cursor: "pointer", padding: 0, marginLeft: 6, opacity: 0.7 }}><X size={14} /></button>
        </div>
      )}

      {/* TABS */}
      <div style={{ display: "flex", gap: 4, marginBottom: 20, padding: 4, background: "var(--ink2, #14141d)", borderRadius: 12, border: "1px solid var(--bdr, #22222e)", overflowX: "auto" }}>
        {TAB_DEFS.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            style={{
              padding: "10px 18px", borderRadius: 8, fontSize: 13, fontWeight: 600,
              background: tab === t.id ? "linear-gradient(135deg, rgba(200,168,75,0.15), rgba(200,168,75,0.05))" : "transparent",
              border: tab === t.id ? "1px solid rgba(200,168,75,0.3)" : "1px solid transparent",
              color: tab === t.id ? "var(--gold)" : "var(--t2)",
              cursor: "pointer", display: "flex", alignItems: "center", gap: 8, whiteSpace: "nowrap", flex: "0 0 auto",
            }}>
            {t.icon} {t.label}
          </button>
        ))}
      </div>

      {tab === "overview" && <OverviewTab stats={stats} loading={statsLoading} error={statsError} />}
      {tab === "export"   && <ExportTab onError={(m) => showToast(m, false)} onSuccess={(m) => showToast(m, true)} />}
      {tab === "import"   && <ImportTab onError={(m) => showToast(m, false)} onSuccess={(m) => showToast(m, true)} reloadStats={loadStats} />}
      {tab === "tools"    && <ToolsTab onError={(m) => showToast(m, false)} onSuccess={(m) => showToast(m, true)} reloadStats={loadStats} />}
    </div>
  );
}

// ─── OVERVIEW TAB ───────────────────────────────────────────────────────────
function OverviewTab({ stats, loading, error }: { stats: BrainStats | null; loading: boolean; error: string }) {
  if (loading && !stats) return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 12 }}>
      {[1,2,3,4,5,6].map(i => <div key={i} className="skeleton" style={{ height: 110, borderRadius: 12 }} />)}
    </div>
  );
  if (error && !stats) return (
    <div style={{ padding: 40, textAlign: "center", borderRadius: 12, background: "rgba(239,68,68,0.05)", border: "1px solid rgba(239,68,68,0.2)" }}>
      <AlertCircle size={32} style={{ color: "#ef4444", margin: "0 auto 12px" }} />
      <p style={{ fontSize: 14, color: "#ef4444", margin: 0 }}>Error cargando stats: {error}</p>
    </div>
  );

  const metrics = [
    { label: "Memorias",          value: stats?.totalMemories,          icon: <Brain size={18} />,    color: "#5b4eff" },
    { label: "Insights",          value: stats?.totalInsights,          icon: <Sparkles size={18} />, color: "#2dd49f" },
    { label: "Dominios",          value: stats?.totalDomains,           icon: <Database size={18} />, color: "#c8a84b" },
    { label: "Prompts",           value: stats?.totalPrompts,           icon: <FileText size={18} />, color: "#06b6d4" },
    { label: "Nichos perfilados", value: stats?.totalNicheProfiles,     icon: <Network size={18} />,  color: "#a855f7" },
    { label: "Cross-conexiones",  value: stats?.totalCrossConnections,  icon: <Activity size={18} />, color: "#f59e0b" },
  ];

  // Compute "brain health" derived from totals
  const total = (stats?.totalMemories || 0) + (stats?.totalInsights || 0);
  const brainHealth = Math.min(100, Math.round((total / 1000) * 100));

  return (
    <div>
      {/* HEALTH BAR (derived) */}
      <div style={{ marginBottom: 20, padding: 18, borderRadius: 12, background: "linear-gradient(135deg, rgba(200,168,75,0.08), transparent)", border: "1px solid rgba(200,168,75,0.2)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
          <div>
            <div style={{ fontSize: 11, color: "var(--t3)", textTransform: "uppercase", letterSpacing: 0.5 }}>Salud del cerebro (derivada)</div>
            <div style={{ fontSize: 28, fontWeight: 800, color: brainHealth >= 80 ? "#2dd49f" : brainHealth >= 50 ? "#f59e0b" : "#ef4444" }}>
              {brainHealth}<span style={{ fontSize: 16, color: "var(--t3)", fontWeight: 500 }}>/100</span>
            </div>
            <div style={{ fontSize: 10, color: "var(--t3)", marginTop: 2 }}>Basado en total de memorias + insights / 1000</div>
          </div>
          <Zap size={32} style={{ color: brainHealth >= 80 ? "#2dd49f" : "#f59e0b" }} />
        </div>
        <div style={{ height: 8, borderRadius: 4, background: "var(--ink2)", overflow: "hidden" }}>
          <div style={{ height: "100%", width: `${brainHealth}%`, background: brainHealth >= 80 ? "linear-gradient(90deg, #2dd49f, #10b981)" : brainHealth >= 50 ? "linear-gradient(90deg, #f59e0b, #d97706)" : "linear-gradient(90deg, #ef4444, #dc2626)", transition: "width 0.6s" }} />
        </div>
      </div>

      {/* METRICS GRID */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 12, marginBottom: 24 }}>
        {metrics.map(m => (
          <div key={m.label} style={{ padding: 16, borderRadius: 12, background: `${m.color}08`, border: `1px solid ${m.color}30` }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 }}>
              <span style={{ color: m.color }}>{m.icon}</span>
            </div>
            <div style={{ fontSize: 24, fontWeight: 800, color: "var(--t1, #fff)", lineHeight: 1 }}>
              {m.value !== undefined ? m.value.toLocaleString() : "—"}
            </div>
            <div style={{ fontSize: 11, color: "var(--t3)", marginTop: 6, textTransform: "uppercase", letterSpacing: 0.5 }}>{m.label}</div>
          </div>
        ))}
      </div>

      {/* INSIGHTS BY DOMAIN + MEMORY SOURCES */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
        {stats?.insightsByDomain && Object.keys(stats.insightsByDomain).length > 0 && (
          <div style={{ padding: 18, borderRadius: 12, background: "var(--ink2, #14141d)", border: "1px solid var(--bdr)" }}>
            <h3 style={{ fontSize: 14, fontWeight: 700, color: "var(--t1)", marginBottom: 12, display: "flex", alignItems: "center", gap: 8 }}>
              <BarChart3 size={16} /> Insights por dominio
            </h3>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {Object.entries(stats.insightsByDomain).slice(0, 12).map(([dom, n]) => {
                const max = Math.max(...Object.values(stats.insightsByDomain!));
                const pct = max > 0 ? (n / max) * 100 : 0;
                return (
                  <div key={dom}>
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: "var(--t2)", marginBottom: 4 }}>
                      <span>{dom}</span>
                      <strong style={{ color: "var(--t1)" }}>{n}</strong>
                    </div>
                    <div style={{ height: 4, borderRadius: 2, background: "var(--ink)", overflow: "hidden" }}>
                      <div style={{ height: "100%", width: `${pct}%`, background: "var(--gold)" }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {stats?.memorySources && Object.keys(stats.memorySources).length > 0 && (
          <div style={{ padding: 18, borderRadius: 12, background: "var(--ink2)", border: "1px solid var(--bdr)" }}>
            <h3 style={{ fontSize: 14, fontWeight: 700, color: "var(--t1)", marginBottom: 12, display: "flex", alignItems: "center", gap: 8 }}>
              <Activity size={16} /> Fuentes de memorias
            </h3>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {Object.entries(stats.memorySources).slice(0, 12).map(([src, n]) => {
                const max = Math.max(...Object.values(stats.memorySources!));
                const pct = max > 0 ? (n / max) * 100 : 0;
                return (
                  <div key={src}>
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: "var(--t2)", marginBottom: 4 }}>
                      <span>{src}</span>
                      <strong style={{ color: "var(--t1)" }}>{n}</strong>
                    </div>
                    <div style={{ height: 4, borderRadius: 2, background: "var(--ink)", overflow: "hidden" }}>
                      <div style={{ height: "100%", width: `${pct}%`, background: "#2dd49f" }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── EXPORT TAB ────────────────────────────────────────────────────────────
function ExportTab({ onSuccess, onError }: { onSuccess: (m: string) => void; onError: (m: string) => void }) {
  const [downloading, setDownloading] = useState<ExportKind | null>(null);

  const download = async (kind: ExportKind) => {
    setDownloading(kind);
    try {
      const r = await fetch(`${API_BASE}/api/admin/brain-export/${kind}`, { credentials: "include" });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const blob = await r.blob();
      const ts = new Date().toISOString().split("T")[0];
      const filename = `shopybrain-${kind}-${ts}.json`;
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url; a.download = filename;
      document.body.appendChild(a); a.click(); document.body.removeChild(a);
      URL.revokeObjectURL(url);
      onSuccess(`Descargado: ${filename}`);
    } catch (e: any) {
      onError(e?.message || "Error al exportar");
    } finally {
      setDownloading(null);
    }
  };

  const cards: Array<{ kind: ExportKind; label: string; desc: string; color: string; icon: React.ReactNode }> = [
    { kind: "knowledge", label: "Knowledge",    desc: "Memorias completas + insights + relaciones del knowledge graph", color: "#5b4eff", icon: <Brain size={20} /> },
    { kind: "domains",   label: "Domains",      desc: "10 dominios de expertise: copywriting, SEO, pricing, etc.",      color: "#c8a84b", icon: <Database size={20} /> },
    { kind: "prompts",   label: "Prompts",      desc: "Biblioteca de prompts especializados aprendidos por el brain",   color: "#2dd49f", icon: <Sparkles size={20} /> },
  ];

  return (
    <div>
      <div style={{ marginBottom: 16, padding: "12px 16px", borderRadius: 10, background: "rgba(99,102,241,0.06)", border: "1px solid rgba(99,102,241,0.2)", fontSize: 13, color: "var(--t2)", display: "flex", alignItems: "center", gap: 10 }}>
        <ChevronRight size={16} style={{ color: "#6366f1" }} />
        Los exports son archivos JSON descargables. Útiles para hacer backup antes de un cambio mayor o para migrar a otro entorno.
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 16 }}>
        {cards.map(c => (
          <div key={c.kind} style={{ padding: 20, borderRadius: 12, background: `${c.color}06`, border: `1px solid ${c.color}30` }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
              <span style={{ color: c.color }}>{c.icon}</span>
              <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: "var(--t1)" }}>{c.label}</h3>
            </div>
            <p style={{ fontSize: 12, color: "var(--t2)", marginBottom: 16, lineHeight: 1.5, minHeight: 36 }}>{c.desc}</p>
            <button onClick={() => download(c.kind)} disabled={downloading === c.kind}
              style={{ width: "100%", padding: "10px 14px", borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: downloading === c.kind ? "not-allowed" : "pointer", background: c.color, color: "#000", border: "none", display: "flex", alignItems: "center", justifyContent: "center", gap: 8, opacity: downloading === c.kind ? 0.7 : 1 }}>
              {downloading === c.kind ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />}
              {downloading === c.kind ? "Descargando..." : "Descargar"}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── IMPORT TAB ────────────────────────────────────────────────────────────
function ImportTab({ onSuccess, onError, reloadStats }: { onSuccess: (m: string) => void; onError: (m: string) => void; reloadStats: () => void }) {
  const [mode, setMode] = useState<"json" | "ndjson">("json");
  const [pasteContent, setPasteContent] = useState("");
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const submitJson = async (text: string) => {
    if (!text.trim()) { onError("Vacío. Pega o sube contenido."); return; }
    if (!confirm("⚠ Esto AÑADE conocimiento al brain. ¿Continuar?")) return;
    setUploading(true);
    try {
      let body: any;
      try { body = JSON.parse(text); } catch { onError("JSON inválido"); setUploading(false); return; }
      const r = await fetch(`${API_BASE}/api/admin/brain-import`, {
        method: "POST", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || `HTTP ${r.status}`);
      onSuccess(d.message || `Importadas ${d.imported || "?"} entradas`);
      setPasteContent("");
      reloadStats();
    } catch (e: any) {
      onError(e?.message || "Error en import");
    } finally {
      setUploading(false);
    }
  };

  const submitNdjson = async (text: string) => {
    if (!text.trim()) { onError("Vacío. Pega o sube contenido NDJSON."); return; }
    if (!confirm("⚠ Esto procesa cada línea como un memory. ¿Continuar?")) return;
    setUploading(true);
    try {
      // FIX: Express only parses application/json. Send as JSON with `ndjson` field.
      const r = await fetch(`${API_BASE}/api/admin/brain-import/ndjson`, {
        method: "POST", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ndjson: text }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || `HTTP ${r.status}`);
      onSuccess(d.message || `Procesadas ${d.processed || "?"} líneas`);
      setPasteContent("");
      reloadStats();
    } catch (e: any) {
      onError(e?.message || "Error en NDJSON import");
    } finally {
      setUploading(false);
    }
  };

  const onFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    const text = await f.text();
    setPasteContent(text);
    e.target.value = "";
  };

  return (
    <div>
      <div style={{ marginBottom: 16, padding: "12px 16px", borderRadius: 10, background: "rgba(239,68,68,0.06)", border: "1px solid rgba(239,68,68,0.2)", fontSize: 13, color: "#fca5a5", display: "flex", alignItems: "center", gap: 10 }}>
        <AlertCircle size={16} />
        <strong>Atención:</strong> Importar añade contenido al cerebro. Haz un export antes de cambios grandes.
      </div>

      <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
        <button onClick={() => setMode("json")} style={{ padding: "8px 14px", borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: "pointer", background: mode === "json" ? "var(--gold)" : "var(--ink2)", color: mode === "json" ? "#000" : "var(--t2)", border: "1px solid var(--bdr)" }}>JSON estructurado</button>
        <button onClick={() => setMode("ndjson")} style={{ padding: "8px 14px", borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: "pointer", background: mode === "ndjson" ? "var(--gold)" : "var(--ink2)", color: mode === "ndjson" ? "#000" : "var(--t2)", border: "1px solid var(--bdr)" }}>NDJSON (1 line = 1 memory)</button>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
        {/* PASTE AREA */}
        <div>
          <label style={{ fontSize: 11, color: "var(--t3)", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 6, display: "block" }}>Pegar contenido</label>
          <textarea value={pasteContent} onChange={e => setPasteContent(e.target.value)}
            placeholder={mode === "json" ? '{"memories":[...],"domains":[...]}' : '{"title":"...","content":"...","tags":["..."]}\n{"title":"...",...}'}
            style={{ width: "100%", minHeight: 280, padding: 12, borderRadius: 8, background: "var(--ink2)", border: "1px solid var(--bdr)", color: "var(--t1)", fontSize: 11, fontFamily: "var(--fm, monospace)", resize: "vertical" }} />
          <button onClick={() => mode === "json" ? submitJson(pasteContent) : submitNdjson(pasteContent)} disabled={uploading || !pasteContent.trim()}
            className="btn btn-gold" style={{ marginTop: 10, width: "100%", justifyContent: "center" }}>
            {uploading ? <><Loader2 size={14} className="animate-spin" /> Importando...</> : <><Upload size={14} /> Importar {mode.toUpperCase()}</>}
          </button>
        </div>

        {/* UPLOAD AREA */}
        <div>
          <label style={{ fontSize: 11, color: "var(--t3)", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 6, display: "block" }}>O subir archivo</label>
          <div onClick={() => fileRef.current?.click()}
            style={{ minHeight: 280, padding: 24, borderRadius: 8, border: "2px dashed var(--bdr)", background: "var(--ink2)", cursor: "pointer", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 12, textAlign: "center" }}>
            <Upload size={36} style={{ color: "var(--t3)" }} />
            <div style={{ fontSize: 13, color: "var(--t2)", fontWeight: 600 }}>Click para subir archivo</div>
            <div style={{ fontSize: 11, color: "var(--t3)" }}>{mode === "json" ? ".json" : ".ndjson · 1 entrada por línea"}</div>
            <input ref={fileRef} type="file" accept={mode === "json" ? ".json,application/json" : ".ndjson,.jsonl,text/plain"} onChange={onFileChange} style={{ display: "none" }} />
          </div>
          <p style={{ fontSize: 11, color: "var(--t3)", marginTop: 8, lineHeight: 1.5 }}>
            Carga el contenido al área de pegado. Revísalo antes de importar.
          </p>
        </div>
      </div>
    </div>
  );
}

// ─── TOOLS TAB ─────────────────────────────────────────────────────────────
function ToolsTab({ onSuccess, onError, reloadStats }: { onSuccess: (m: string) => void; onError: (m: string) => void; reloadStats: () => void }) {
  const [busy, setBusy] = useState<string | null>(null);

  const fire = async (label: string, url: string, method: "POST" | "GET" = "POST", body?: any) => {
    if (!confirm(`¿Ejecutar "${label}"?`)) return;
    setBusy(label);
    try {
      const r = await fetch(`${API_BASE}${url}`, {
        method, credentials: "include",
        headers: body ? { "Content-Type": "application/json" } : undefined,
        body: body ? JSON.stringify(body) : undefined,
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || `HTTP ${r.status}`);
      onSuccess(d.message || `${label} completado`);
      reloadStats();
    } catch (e: any) {
      onError(e?.message || `Error en ${label}`);
    } finally {
      setBusy(null);
    }
  };

  const tools: Array<{ key: string; label: string; desc: string; url: string; method?: "POST" | "GET"; color: string; icon: React.ReactNode; danger?: boolean }> = [
    { key: "sync",          label: "Sincronizar con brain externo", desc: "Pull de cambios desde sandbox/staging", url: "/api/admin/brain-sync", color: "#5b4eff", icon: <RefreshCw size={18} /> },
    { key: "self",          label: "Inyectar self-knowledge",       desc: "El brain aprende sobre Shopy Crafter mismo (bootstrap)", url: "/api/admin/brain-inject-self-knowledge", color: "#c8a84b", icon: <Sparkles size={18} /> },
    { key: "shopify-srv",   label: "Crear servicios en Shopify",    desc: "Genera productos servicio en tu tienda admin (packs)",   url: "/api/admin/create-shopify-services", color: "#2dd49f", icon: <Database size={18} /> },
    { key: "shopify-prices", label: "Sync precios Shopify",         desc: "Push de PACK_DEFINITIONS a tus servicios Shopify",       url: "/api/admin/shopify-update-prices", color: "#06b6d4", icon: <BarChart3 size={18} /> },
  ];

  return (
    <div>
      <div style={{ marginBottom: 16, padding: "12px 16px", borderRadius: 10, background: "rgba(245,158,11,0.06)", border: "1px solid rgba(245,158,11,0.2)", fontSize: 13, color: "var(--t2)", display: "flex", alignItems: "center", gap: 10 }}>
        <AlertCircle size={16} style={{ color: "#f59e0b" }} />
        Acciones de mantenimiento. Cada una pide confirmación antes de ejecutarse.
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: 14 }}>
        {tools.map(t => (
          <div key={t.key} style={{ padding: 18, borderRadius: 12, background: `${t.color}06`, border: `1px solid ${t.color}30` }}>
            <div style={{ display: "flex", gap: 12, alignItems: "flex-start", marginBottom: 14 }}>
              <div style={{ flexShrink: 0, padding: 10, borderRadius: 8, background: `${t.color}15`, color: t.color }}>{t.icon}</div>
              <div>
                <h3 style={{ margin: "0 0 4px", fontSize: 14, fontWeight: 700, color: "var(--t1)" }}>{t.label}</h3>
                <p style={{ margin: 0, fontSize: 12, color: "var(--t2)", lineHeight: 1.5 }}>{t.desc}</p>
              </div>
            </div>
            <button onClick={() => fire(t.label, t.url, t.method)} disabled={busy === t.label}
              style={{ width: "100%", padding: "9px 14px", borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: busy === t.label ? "not-allowed" : "pointer", background: `${t.color}15`, color: t.color, border: `1px solid ${t.color}40`, display: "flex", alignItems: "center", justifyContent: "center", gap: 8, opacity: busy === t.label ? 0.7 : 1 }}>
              {busy === t.label ? <Loader2 size={13} className="animate-spin" /> : <Zap size={13} />}
              {busy === t.label ? "Ejecutando..." : "Ejecutar"}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
