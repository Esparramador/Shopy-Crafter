import { useEffect, useState } from "react";
import { Loader2, Download, Play, RefreshCw, CheckCircle, AlertCircle, Clock, Smartphone, Github, ExternalLink, Copy } from "lucide-react";

const API_BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

interface ApkStatus {
  available: boolean;
  building: boolean;
  error?: string;
  lastBuild?: {
    number: number;
    status: string;
    date: string;
  } | null;
}

interface BuildStep {
  title: string;
  detail: string;
  done: boolean;
}

function timeSince(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const min = Math.floor(diff / 60000);
  const h = Math.floor(min / 60);
  const d = Math.floor(h / 24);
  if (d > 0) return `hace ${d} día${d > 1 ? "s" : ""}`;
  if (h > 0) return `hace ${h}h`;
  if (min > 0) return `hace ${min}min`;
  return "ahora mismo";
}

export default function ApkManager() {
  const [status, setStatus] = useState<ApkStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [triggering, setTriggering] = useState(false);
  const [triggerMsg, setTriggerMsg] = useState<{ ok: boolean; msg: string } | null>(null);
  const [copied, setCopied] = useState(false);
  const [downloading, setDownloading] = useState(false);

  const WORKFLOW_FILE = ".github/workflows/build-apk.yml";
  const REPO = "Esparramador/Shopy-Crafter";

  const fetchStatus = async () => {
    try {
      const r = await fetch(`${API_BASE}/api/apk/status`, { credentials: "include" });
      const d = await r.json() as ApkStatus;
      setStatus(d);
    } catch {
      setStatus({ available: false, building: false, error: "Error al consultar estado" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStatus();
    const interval = setInterval(fetchStatus, 15000);
    return () => clearInterval(interval);
  }, []);

  const triggerBuild = async () => {
    setTriggering(true);
    setTriggerMsg(null);
    try {
      const r = await fetch(`${API_BASE}/api/apk/build`, {
        method: "POST",
        credentials: "include",
      });
      const d = await r.json() as { success: boolean; message?: string; error?: string };
      if (d.success) {
        setTriggerMsg({ ok: true, msg: d.message ?? "Build lanzado — tardará ~5 minutos" });
        setTimeout(fetchStatus, 3000);
      } else {
        setTriggerMsg({ ok: false, msg: d.error ?? "Error al lanzar build" });
      }
    } catch {
      setTriggerMsg({ ok: false, msg: "Error de conexión" });
    } finally {
      setTriggering(false);
    }
  };

  const downloadApk = async () => {
    setDownloading(true);
    try {
      const a = document.createElement("a");
      a.href = `${API_BASE}/api/apk/download`;
      a.download = "ShopyCrafter.apk";
      a.click();
      setTimeout(() => setDownloading(false), 3000);
    } catch {
      setDownloading(false);
    }
  };

  const copyWorkflowPath = () => {
    navigator.clipboard.writeText(WORKFLOW_FILE).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const steps: BuildStep[] = [
    { title: "Repo GitHub configurado", detail: `Esparramador/Shopy-Crafter con el código fuente`, done: true },
    { title: "GitHub Actions workflow", detail: `${WORKFLOW_FILE} ya existe en este proyecto`, done: true },
    { title: "GITHUB_API_TOKEN en Replit", detail: "PAT con scope 'repo' — añadir en Secrets del proyecto", done: !status?.error?.includes("GITHUB_API_TOKEN") },
    { title: "APK publicado como Release", detail: "Tag: apk-latest — visible al pulsar 'Lanzar Build'", done: status?.available ?? false },
  ];

  return (
    <div style={{ maxWidth: 800, margin: "0 auto" }}>
      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 6 }}>
          <div style={{
            width: 40, height: 40, borderRadius: 10,
            background: "linear-gradient(135deg,var(--gold),var(--gold2))",
            display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20,
          }}>📱</div>
          <div>
            <h1 className="section-title" style={{ marginBottom: 0 }}>Shopy Crafter APK</h1>
            <p className="section-subtitle" style={{ marginBottom: 0 }}>Gestión del build Android + distribución</p>
          </div>
        </div>
      </div>

      {/* Status Card */}
      <div style={{
        padding: "20px 24px", borderRadius: 12, marginBottom: 20,
        background: status?.building
          ? "rgba(200,168,75,0.06)"
          : status?.available
            ? "rgba(45,212,159,0.06)"
            : "rgba(255,255,255,0.02)",
        border: `1px solid ${status?.building ? "rgba(200,168,75,0.3)" : status?.available ? "rgba(45,212,159,0.2)" : "var(--bdr)"}`,
      }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            {loading ? (
              <Loader2 size={24} style={{ color: "var(--gold)", animation: "spin 0.6s linear infinite" }} />
            ) : status?.building ? (
              <RefreshCw size={24} style={{ color: "var(--gold)", animation: "spin 1s linear infinite" }} />
            ) : status?.available ? (
              <CheckCircle size={24} style={{ color: "var(--jade)" }} />
            ) : (
              <Smartphone size={24} style={{ color: "var(--t3)" }} />
            )}
            <div>
              <p style={{ margin: 0, fontWeight: 700, fontSize: 15, color: loading ? "var(--t3)" : status?.building ? "var(--gold)" : status?.available ? "var(--jade)" : "var(--t)" }}>
                {loading ? "Consultando..." : status?.building ? "⚙️ Build en progreso..." : status?.available ? "✅ APK disponible" : "⏸ Sin APK publicado"}
              </p>
              {status?.lastBuild && (
                <p style={{ margin: "2px 0 0", fontSize: 11, color: "var(--t3)" }}>
                  Build #{status.lastBuild.number} · {status.lastBuild.status} · {timeSince(status.lastBuild.date)}
                </p>
              )}
              {status?.error && (
                <p style={{ margin: "2px 0 0", fontSize: 11, color: "var(--crim)" }}>⚠️ {status.error}</p>
              )}
            </div>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button onClick={fetchStatus} style={{ background: "none", border: "1px solid var(--bdr)", borderRadius: 8, padding: "8px 12px", cursor: "pointer", color: "var(--t3)", display: "flex", alignItems: "center", gap: 6, fontSize: 12 }}>
              <RefreshCw size={13} />
              Actualizar
            </button>
            {status?.available && (
              <button onClick={downloadApk} disabled={downloading}
                style={{ background: "linear-gradient(135deg,var(--jade),#1a9e6e)", border: "none", borderRadius: 8, padding: "8px 16px", cursor: "pointer", color: "#080810", fontWeight: 700, display: "flex", alignItems: "center", gap: 6, fontSize: 12 }}>
                {downloading ? <Loader2 size={13} style={{ animation: "spin 0.6s linear infinite" }} /> : <Download size={13} />}
                Descargar APK
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Build Trigger */}
      <div style={{ padding: "20px 24px", borderRadius: 12, marginBottom: 20, background: "var(--srf)", border: "1px solid var(--bdr)" }}>
        <p style={{ margin: "0 0 6px", fontWeight: 700, fontSize: 14 }}>🚀 Lanzar nuevo build</p>
        <p style={{ margin: "0 0 16px", fontSize: 12, color: "var(--t3)", lineHeight: 1.6 }}>
          Dispara el GitHub Actions workflow que compila la APK y la publica como Release en <code style={{ color: "var(--gold)" }}>{REPO}</code>. Tarda ~5 minutos.
        </p>
        {triggerMsg && (
          <div style={{
            padding: "10px 14px", borderRadius: 8, marginBottom: 14, fontSize: 12,
            background: triggerMsg.ok ? "rgba(45,212,159,0.08)" : "rgba(220,53,69,0.08)",
            border: `1px solid ${triggerMsg.ok ? "rgba(45,212,159,0.25)" : "rgba(220,53,69,0.25)"}`,
            color: triggerMsg.ok ? "var(--jade)" : "var(--crim)",
            display: "flex", alignItems: "center", gap: 8,
          }}>
            {triggerMsg.ok ? <CheckCircle size={14} /> : <AlertCircle size={14} />}
            {triggerMsg.msg}
          </div>
        )}
        <button
          onClick={triggerBuild}
          disabled={triggering || status?.building}
          style={{
            background: triggering || status?.building ? "rgba(200,168,75,0.2)" : "linear-gradient(135deg,var(--gold),var(--gold2))",
            border: "none", borderRadius: 8, padding: "10px 20px",
            cursor: triggering || status?.building ? "not-allowed" : "pointer",
            color: triggering || status?.building ? "var(--gold)" : "#080810",
            fontWeight: 700, fontSize: 13, display: "flex", alignItems: "center", gap: 8,
          }}
        >
          {triggering ? <Loader2 size={14} style={{ animation: "spin 0.6s linear infinite" }} /> : <Play size={14} />}
          {triggering ? "Lanzando..." : status?.building ? "Build en progreso..." : "Lanzar Build APK"}
        </button>
      </div>

      {/* Setup checklist */}
      <div style={{ padding: "20px 24px", borderRadius: 12, marginBottom: 20, background: "var(--srf)", border: "1px solid var(--bdr)" }}>
        <p style={{ margin: "0 0 16px", fontWeight: 700, fontSize: 14 }}>📋 Estado de configuración</p>
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {steps.map((step, i) => (
            <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
              <div style={{
                width: 22, height: 22, borderRadius: "50%", flexShrink: 0,
                background: step.done ? "rgba(45,212,159,0.15)" : "rgba(255,255,255,0.05)",
                border: `1px solid ${step.done ? "rgba(45,212,159,0.3)" : "var(--bdr)"}`,
                display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11,
                color: step.done ? "var(--jade)" : "var(--t4)",
              }}>
                {step.done ? "✓" : i + 1}
              </div>
              <div>
                <p style={{ margin: 0, fontSize: 12, fontWeight: step.done ? 600 : 400, color: step.done ? "var(--t)" : "var(--t3)" }}>{step.title}</p>
                <p style={{ margin: "1px 0 0", fontSize: 11, color: "var(--t4)" }}>{step.detail}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Installation guide */}
      <div style={{ padding: "20px 24px", borderRadius: 12, marginBottom: 20, background: "var(--srf)", border: "1px solid var(--bdr)" }}>
        <p style={{ margin: "0 0 16px", fontWeight: 700, fontSize: 14 }}>📱 Cómo instalar en Android</p>
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {[
            { n: "1", t: "Descarga el APK", d: 'Pulsa "Descargar APK" o el botón en la Landing page' },
            { n: "2", t: "Activa fuentes desconocidas", d: "Android → Ajustes → Seguridad → Instalar apps desconocidas → activar para el navegador" },
            { n: "3", t: "Instala el APK", d: "Abre el archivo ShopyCrafter.apk desde la carpeta de descargas" },
            { n: "4", t: "Abre Shopy Crafter", d: "La app carga directamente la versión de producción — siempre actualizada sin necesidad de actualizaciones manuales" },
          ].map(s => (
            <div key={s.n} style={{ display: "flex", gap: 12 }}>
              <span style={{ width: 22, height: 22, borderRadius: "50%", background: "rgba(200,168,75,0.12)", border: "1px solid rgba(200,168,75,0.25)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, fontSize: 10, fontWeight: 800, color: "var(--gold)" }}>{s.n}</span>
              <div>
                <p style={{ margin: 0, fontSize: 12, fontWeight: 600, color: "var(--t)" }}>{s.t}</p>
                <p style={{ margin: "1px 0 0", fontSize: 11, color: "var(--t3)" }}>{s.d}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* GitHub config */}
      <div style={{ padding: "20px 24px", borderRadius: 12, background: "rgba(200,168,75,0.04)", border: "1px solid rgba(200,168,75,0.15)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
          <Github size={16} style={{ color: "var(--gold)" }} />
          <p style={{ margin: 0, fontWeight: 700, fontSize: 14, color: "var(--gold)" }}>Configuración GitHub Actions</p>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <div style={{ padding: "10px 12px", background: "rgba(0,0,0,0.2)", borderRadius: 8 }}>
            <p style={{ margin: "0 0 4px", fontSize: 11, fontWeight: 700, color: "var(--t3)", textTransform: "uppercase", letterSpacing: "0.8px" }}>Repo</p>
            <a href={`https://github.com/${REPO}`} target="_blank" rel="noreferrer"
              style={{ display: "flex", alignItems: "center", gap: 6, color: "var(--jade)", fontSize: 13, textDecoration: "none", fontWeight: 600 }}>
              github.com/{REPO} <ExternalLink size={12} />
            </a>
          </div>
          <div style={{ padding: "10px 12px", background: "rgba(0,0,0,0.2)", borderRadius: 8 }}>
            <p style={{ margin: "0 0 4px", fontSize: 11, fontWeight: 700, color: "var(--t3)", textTransform: "uppercase", letterSpacing: "0.8px" }}>Workflow file</p>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <code style={{ fontSize: 12, color: "var(--t2)" }}>{WORKFLOW_FILE}</code>
              <button onClick={copyWorkflowPath} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--t3)", padding: 4 }}>
                {copied ? <CheckCircle size={13} style={{ color: "var(--jade)" }} /> : <Copy size={13} />}
              </button>
            </div>
          </div>
          <div style={{ padding: "10px 12px", background: "rgba(220,53,69,0.06)", borderRadius: 8, border: "1px solid rgba(220,53,69,0.15)" }}>
            <p style={{ margin: "0 0 6px", fontSize: 11, fontWeight: 700, color: "var(--crim)", textTransform: "uppercase", letterSpacing: "0.8px" }}>Secret requerido en Replit</p>
            <code style={{ fontSize: 12, color: "var(--t2)" }}>GITHUB_API_TOKEN</code>
            <p style={{ margin: "4px 0 0", fontSize: 11, color: "var(--t3)" }}>GitHub PAT con scope <code>repo</code> + <code>workflow</code> → Replit → Tools → Secrets</p>
          </div>
          <div style={{ padding: "10px 12px", background: "rgba(0,0,0,0.2)", borderRadius: 8 }}>
            <p style={{ margin: "0 0 6px", fontSize: 11, fontWeight: 700, color: "var(--t3)", textTransform: "uppercase", letterSpacing: "0.8px" }}>Secrets opcionales en GitHub (para APK firmado)</p>
            {["KEYSTORE_BASE64 — Keystore codificado en base64", "KEYSTORE_PASSWORD — Contraseña del keystore", "KEY_ALIAS — Alias de la clave", "KEY_PASSWORD — Contraseña de la clave", "APP_URL — URL de producción (ej: https://shopycrafter.com)"].map(s => (
              <p key={s} style={{ margin: "3px 0", fontSize: 11, color: "var(--t3)" }}>· <code style={{ color: "var(--t2)" }}>{s}</code></p>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
