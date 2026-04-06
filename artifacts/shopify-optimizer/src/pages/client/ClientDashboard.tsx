import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useCmsSection } from "@/contexts/CmsContext";
import { ClientLayout } from "./ClientLayout";
import { Clock, Loader2 } from "lucide-react";

const API_BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

const DEFAULT_ENGINE_NAMES: Record<string, string> = {
  M1: "Auditoría de Productos",
  M2: "Rediseño IA",
  M3: "Generación de Imágenes",
  M4: "Consistencia Visual",
  M5: "A/B Testing",
  M6: "SEO & Contenido",
  M7: "Precios Inteligentes",
};
const ENGINE_ICONS = ["🔍", "✏️", "🖼", "🎨", "📊", "🔎", "💰"];

interface DashboardData {
  totalProducts: number;
  avgScore: number | null;
  pendingApprovals: number;
  enginesActive: number;
  lastOptimized: string | null;
  recentActivity: Array<{ id: string; action: string; details: string; createdAt: string }>;
}

function timeSince(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "hace un momento";
  if (mins < 60) return `hace ${mins}min`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `hace ${hrs}h`;
  return `hace ${Math.floor(hrs / 24)}d`;
}

function ScoreCircle({ score }: { score: number }) {
  const color = score >= 80 ? "var(--jade)" : score >= 60 ? "var(--amber)" : "var(--crim)";
  const grade = score >= 90 ? "A" : score >= 75 ? "B" : score >= 60 ? "C" : score >= 45 ? "D" : "F";
  return (
    <div style={{ position: "relative", width: 80, height: 80, flexShrink: 0 }}>
      <svg viewBox="0 0 36 36" style={{ width: "100%", height: "100%", transform: "rotate(-90deg)" }}>
        <circle cx="18" cy="18" r="15.9" fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="3" />
        <circle cx="18" cy="18" r="15.9" fill="none" stroke={color} strokeWidth="3"
          strokeLinecap="round" strokeDasharray={`${score} 100`} />
      </svg>
      <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
        <span style={{ fontSize: 20, fontWeight: 800, color }}>{grade}</span>
        <span style={{ fontSize: 9, color: "var(--t3)" }}>{score}/100</span>
      </div>
    </div>
  );
}

export default function ClientDashboard() {
  const { user } = useAuth();
  const { t, data: cmsData } = useCmsSection("labels.clientDashboard");
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const ENGINE_NAMES = { ...DEFAULT_ENGINE_NAMES, ...((cmsData as any)?.engineNames ?? {}) };

  useEffect(() => {
    fetch(`${API_BASE}/api/client/dashboard`, { credentials: "include" })
      .then((r) => r.json())
      .then((d) => { setData(d); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  const kpis = [
    { label: t("products", "Productos"), value: data?.totalProducts ?? 0, icon: "📦", color: "var(--sky)", sub: t("inCatalog", "en tu catálogo") },
    { label: t("avgScore", "Score promedio"), value: data?.avgScore != null ? `${data.avgScore}` : "–", icon: "📊", color: "var(--jade)", sub: t("aiQuality", "calidad IA") },
    { label: t("approvals", "Aprobaciones"), value: data?.pendingApprovals ?? 0, icon: "✅", color: "var(--amber)", sub: t("pending", "pendientes") },
    { label: t("enginesActive", "Motores activos"), value: data?.enginesActive ?? 7, icon: "⚡", color: "var(--gold)", sub: t("optimizing", "optimizando") },
  ];

  return (
    <ClientLayout>
      <div style={{ maxWidth: 900 }}>
        {/* Header */}
        <div style={{ marginBottom: 24 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
            <div className="status-pulse" style={{ width: 6, height: 6, background: "var(--jade)" }} />
            <p style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: "1.2px", color: "var(--t3)" }}>
              {t("optimizingNote", "Tu tienda está siendo optimizada activamente")}
            </p>
          </div>
          <h1 style={{ fontFamily: "var(--fh)", fontStyle: "italic", fontSize: 28, fontWeight: 400 }}>
            {t("welcome", "Bienvenido,")} <em style={{ color: "var(--gold2)" }}>{user?.name?.split(" ")[0]}</em>
          </h1>
          {data?.lastOptimized && (
            <p style={{ fontSize: 12, color: "var(--t3)", display: "flex", alignItems: "center", gap: 5, marginTop: 4 }}>
              <Clock size={12} />
              Última optimización {timeSince(data.lastOptimized)}
            </p>
          )}
        </div>

        {/* KPI Cards */}
        {loading ? (
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: 120 }}>
            <Loader2 size={24} style={{ color: "var(--gold)", animation: "spin 0.6s linear infinite" }} />
          </div>
        ) : (
          <div className="grid-4" style={{ marginBottom: 24 }}>
            {kpis.map(({ label, value, icon, color, sub }) => (
              <div key={label} className="metric-card">
                <div style={{ fontSize: 20, marginBottom: 8 }}>{icon}</div>
                <p className="metric-value" style={{ fontSize: 24, color }}>{value}</p>
                <p className="metric-label" style={{ marginBottom: 2 }}>{label}</p>
                <p style={{ fontSize: 10, color: "var(--t3)" }}>{sub}</p>
              </div>
            ))}
          </div>
        )}

        <div className="grid-2" style={{ marginBottom: 24 }}>
          {/* AI Engines */}
          <div className="card">
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16, paddingBottom: 12, borderBottom: "1px solid var(--bdr)" }}>
              <span style={{ fontSize: 15 }}>⚡</span>
              <span style={{ fontWeight: 700, fontSize: 14 }}>{t("engineStatus", "Motores IA — Estado")}</span>
            </div>
            <div>
              {Object.entries(ENGINE_NAMES).map(([key, name]: [string, any], i) => (
                <div key={key} className="feed-item">
                  <div className="feed-icon" style={{ background: "rgba(200,168,75,0.08)", fontSize: 13 }}>
                    {ENGINE_ICONS[i]}
                  </div>
                  <div className="feed-body">
                    <p className="feed-title">{name}</p>
                    <p className="feed-desc">{t("engineOptimizing", "Optimizando tu tienda")}</p>
                  </div>
                  <div className="engine-pip engine-on">{t("engineActive", "Activo")}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Activity */}
          <div className="card">
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16, paddingBottom: 12, borderBottom: "1px solid var(--bdr)" }}>
              <span style={{ fontSize: 15 }}>📈</span>
              <span style={{ fontWeight: 700, fontSize: 14 }}>{t("recentActivity", "Actividad Reciente")}</span>
            </div>
            {data?.recentActivity && data.recentActivity.length > 0 ? (
              <div>
                {data.recentActivity.slice(0, 8).map((item) => (
                  <div key={item.id} className="feed-item">
                    <div className="feed-icon" style={{ background: "rgba(200,168,75,0.06)", color: "var(--gold)" }}>⚡</div>
                    <div className="feed-body">
                      <p className="feed-title">{item.details || item.action}</p>
                    </div>
                    <span className="feed-time">{timeSince(item.createdAt)}</span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="empty-state" style={{ padding: "32px 12px" }}>
                <div className="empty-icon" style={{ fontSize: 28 }}>📋</div>
                <p className="empty-desc" style={{ fontSize: 12 }}>
                  {t("emptyActivity", "La actividad aparecerá aquí cuando tu agencia realice optimizaciones.")}
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Score panel */}
        {data?.avgScore != null && (
          <div className="card" style={{ display: "flex", alignItems: "center", gap: 20 }}>
            <ScoreCircle score={data.avgScore} />
            <div>
              <p style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: "1px", color: "var(--t3)", marginBottom: 5 }}>
                {t("catalogScore", "Score promedio de tu catálogo")}
              </p>
              <p style={{ fontFamily: "var(--fh)", fontSize: 26, fontStyle: "italic" }}>{data.avgScore}/100</p>
              <p style={{ fontSize: 13, color: "var(--t2)", marginTop: 4 }}>
                {data.avgScore >= 80
                  ? "Tu catálogo está en excelente estado."
                  : data.avgScore >= 60
                  ? "Tu catálogo tiene margen de mejora. Tu agencia ya está trabajando en ello."
                  : "Tu agencia está priorizando mejoras en tu catálogo."}
              </p>
            </div>
          </div>
        )}
      </div>
    </ClientLayout>
  );
}
