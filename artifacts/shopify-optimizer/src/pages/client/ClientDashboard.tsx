import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { ClientLayout } from "./ClientLayout";
import {
  Package, TrendingUp, CheckSquare, Zap, Clock,
  Activity, BarChart2, Star,
} from "lucide-react";

const API_BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

const ENGINE_NAMES: Record<string, string> = {
  M1: "Auditoría de Productos",
  M2: "Rediseño IA",
  M3: "Generación de Imágenes",
  M4: "Consistencia Visual",
  M5: "A/B Testing",
  M6: "SEO & Contenido",
  M7: "Precios Inteligentes",
};

const ENGINE_ICONS = ["🔍", "✏️", "🖼️", "🎨", "📊", "🔎", "💰"];

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
  const color = score >= 80 ? "#00d68f" : score >= 60 ? "#ffd32a" : "#ff4757";
  const grade = score >= 90 ? "A" : score >= 75 ? "B" : score >= 60 ? "C" : score >= 45 ? "D" : "F";
  return (
    <div className="relative w-20 h-20">
      <svg viewBox="0 0 36 36" className="w-full h-full -rotate-90">
        <circle cx="18" cy="18" r="15.9" fill="none" stroke="#ffffff10" strokeWidth="3" />
        <circle cx="18" cy="18" r="15.9" fill="none" stroke={color} strokeWidth="3"
          strokeLinecap="round" strokeDasharray={`${score} 100`} />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-xl font-bold" style={{ color }}>{grade}</span>
        <span className="text-xs text-white/40">{score}/100</span>
      </div>
    </div>
  );
}

export default function ClientDashboard() {
  const { user } = useAuth();
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`${API_BASE}/api/client/dashboard`, { credentials: "include" })
      .then((r) => r.json())
      .then((d) => { setData(d); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  const kpis = [
    { label: "Productos", value: data?.totalProducts ?? 0, icon: Package, color: "#5b4eff", sub: "en tu catálogo" },
    { label: "Score promedio", value: data?.avgScore ? `${data.avgScore}` : "–", icon: BarChart2, color: "#00d68f", sub: "calidad IA" },
    { label: "Aprobaciones", value: data?.pendingApprovals ?? 0, icon: CheckSquare, color: "#ffd32a", sub: "pendientes" },
    { label: "Motores activos", value: data?.enginesActive ?? 7, icon: Zap, color: "#00b4d8", sub: "optimizando" },
  ];

  return (
    <ClientLayout>
      <div className="space-y-8 max-w-5xl">
        {/* Header */}
        <div>
          <div className="flex items-center gap-3 mb-1">
            <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
            <p className="text-xs text-white/40 uppercase tracking-wider">Tu tienda está siendo optimizada activamente</p>
          </div>
          <h1 className="text-3xl font-bold text-white">
            Bienvenido, <span className="text-[#5b4eff]">{user?.name?.split(" ")[0]}</span>
          </h1>
          {data?.lastOptimized && (
            <p className="text-white/30 text-sm mt-1 flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5" />
              Última optimización {timeSince(data.lastOptimized)}
            </p>
          )}
        </div>

        {/* KPI Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {kpis.map(({ label, value, icon: Icon, color, sub }) => (
            <div key={label} className="bg-white/5 border border-white/8 rounded-2xl p-5">
              <div className="flex items-start justify-between mb-3">
                <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ backgroundColor: `${color}20`, border: `1px solid ${color}30` }}>
                  <Icon className="w-4 h-4" style={{ color }} />
                </div>
              </div>
              <p className="text-2xl font-bold text-white">{loading ? "–" : value}</p>
              <p className="text-xs font-semibold text-white/60 mt-0.5">{label}</p>
              <p className="text-xs text-white/30 mt-0.5">{sub}</p>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* AI Engines Panel */}
          <div className="bg-white/5 border border-white/8 rounded-2xl p-6">
            <div className="flex items-center gap-2 mb-5">
              <Activity className="w-4 h-4 text-[#5b4eff]" />
              <h2 className="font-bold text-white">Motores IA — Estado</h2>
            </div>
            <div className="space-y-2.5">
              {Object.entries(ENGINE_NAMES).map(([key, name], i) => (
                <div key={key} className="flex items-center justify-between py-2 border-b border-white/5 last:border-0">
                  <div className="flex items-center gap-3">
                    <span className="text-lg">{ENGINE_ICONS[i]}</span>
                    <div>
                      <p className="text-sm font-medium text-white">{name}</p>
                      <p className="text-xs text-white/30">Optimizando tu tienda</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 bg-green-500/10 border border-green-500/20 px-2.5 py-1 rounded-full">
                    <div className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
                    <span className="text-xs text-green-400 font-medium">Activo</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Activity Timeline */}
          <div className="bg-white/5 border border-white/8 rounded-2xl p-6">
            <div className="flex items-center gap-2 mb-5">
              <TrendingUp className="w-4 h-4 text-[#5b4eff]" />
              <h2 className="font-bold text-white">Actividad Reciente</h2>
            </div>
            {data?.recentActivity && data.recentActivity.length > 0 ? (
              <div className="space-y-3">
                {data.recentActivity.slice(0, 8).map((item) => (
                  <div key={item.id} className="flex gap-3">
                    <div className="mt-1.5">
                      <div className="w-1.5 h-1.5 rounded-full bg-[#5b4eff]" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-white/80 truncate">{item.details || item.action}</p>
                      <p className="text-xs text-white/30">{timeSince(item.createdAt)}</p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8">
                <Clock className="w-8 h-8 text-white/20 mx-auto mb-2" />
                <p className="text-sm text-white/40">La actividad aparecerá aquí cuando tu agencia realice optimizaciones.</p>
              </div>
            )}
          </div>
        </div>

        {/* Score preview if available */}
        {data?.avgScore != null && (
          <div className="bg-white/5 border border-white/8 rounded-2xl p-6">
            <div className="flex items-center gap-4">
              <ScoreCircle score={data.avgScore} />
              <div>
                <p className="text-xs text-white/40 uppercase tracking-wider mb-1">Score promedio de tu catálogo</p>
                <p className="text-2xl font-bold text-white">{data.avgScore}/100</p>
                <p className="text-sm text-white/50 mt-1">
                  {data.avgScore >= 80
                    ? "Tu catálogo está en excelente estado."
                    : data.avgScore >= 60
                    ? "Tu catálogo tiene margen de mejora. Tu agencia ya está trabajando en ello."
                    : "Tu agencia está priorizando mejoras en tu catálogo."}
                </p>
              </div>
            </div>
          </div>
        )}
      </div>
    </ClientLayout>
  );
}
