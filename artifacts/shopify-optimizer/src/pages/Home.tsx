import { Link, useLocation } from "wouter";
import { ArrowRight, Plus, Brain, BarChart3, Mail, TrendingUp, Zap, Users, ShieldCheck } from "lucide-react";
import { useListProjects } from "@workspace/api-client-react";
import { useAuth } from "@/contexts/AuthContext";
import { useEffect, useState } from "react";

function StatBubble({ icon, label, value, color = "var(--gold)" }: { icon: React.ReactNode; label: string; value: string | number; color?: string }) {
  return (
    <div className="glass-card" style={{ padding: "18px 20px", display: "flex", alignItems: "center", gap: 14 }}>
      <div style={{ width: 40, height: 40, borderRadius: 10, background: `${color}18`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, color }}>
        {icon}
      </div>
      <div>
        <p style={{ fontSize: 22, fontWeight: 800, color: "var(--t)", lineHeight: 1 }}>{value}</p>
        <p style={{ fontSize: 11, color: "var(--t3)", marginTop: 3 }}>{label}</p>
      </div>
    </div>
  );
}

const QUICK_ACTIONS = [
  { icon: "🧠", label: "Shopy Crafter", desc: "IA central · memorias activas", href: "/admin/shopybrain", color: "var(--gold)" },
  { icon: "📊", label: "Revenue", desc: "Métricas de ingresos y KPIs", href: "/admin/revenue", color: "var(--jade)" },
  { icon: "📧", label: "Email Marketing", desc: "Flujos y campañas automatizadas", href: "/admin/emails", color: "#8b5cf6" },
  { icon: "🔍", label: "Competitors", desc: "Análisis de competencia", href: "/admin/competitors", color: "#f59e0b" },
  { icon: "📈", label: "Forecast", desc: "Predicciones de revenue ML", href: "/admin/forecast", color: "var(--jade)" },
  { icon: "💰", label: "Mi Pricing CFO", desc: "Estructura de costes · propuestas", href: "/admin/my-pricing", color: "var(--gold)" },
  { icon: "🗺️", label: "Roadmap", desc: "Fases de implementación", href: "/admin/roadmap", color: "#60a5fa" },
  { icon: "⚙️", label: "Configuración", desc: "Ajustes del sistema", href: "/admin/settings", color: "var(--t3)" },
];

export default function Home() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const { data: projects, isLoading } = useListProjects();
  const [brainStatus, setBrainStatus] = useState<{ status: string; memoriesCount: number } | null>(null);
  const API_BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

  useEffect(() => {
    fetch(`${API_BASE}/api/shopybrain/status`, { credentials: "include" })
      .then(r => r.json())
      .then(d => setBrainStatus(d))
      .catch(() => {});
  }, [API_BASE]);

  const projectCount = projects?.length ?? 0;
  const firstName = user?.name?.split(" ")[0] ?? user?.email?.split("@")[0] ?? "Admin";

  return (
    <div className="page-inner">

      {/* Welcome */}
      <div style={{ marginBottom: 28 }}>
        <h1 style={{ fontFamily: "var(--fh)", fontStyle: "italic", fontSize: 26, fontWeight: 800, marginBottom: 4 }}>
          Bienvenida, {firstName} 👋
        </h1>
        <p style={{ fontSize: 13, color: "var(--t2)" }}>
          Shopy Crafter · Panel de control · {new Date().toLocaleDateString("es-ES", { weekday: "long", day: "numeric", month: "long" })}
        </p>
      </div>

      {/* Stats row */}
      <div className="grid-r4" style={{ marginBottom: 28 }}>
        <StatBubble icon={<Users size={18} />} label="Tiendas activas" value={isLoading ? "—" : projectCount} />
        <StatBubble icon={<Brain size={18} />} label="Memorias IA" value={brainStatus?.memoriesCount ?? "—"} color="var(--gold)" />
        <StatBubble icon={<ShieldCheck size={18} />} label="Estado del sistema" value="Operativo" color="var(--jade)" />
        <StatBubble icon={<Zap size={18} />} label="Motores IA activos" value="7" color="#8b5cf6" />
      </div>

      {/* Projects */}
      <div style={{ marginBottom: 28 }}>
        <div className="flex-header" style={{ marginBottom: 14 }}>
          <div>
            <p style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "1.5px", color: "var(--t3)" }}>Tiendas conectadas</p>
          </div>
          <button
            onClick={() => setLocation("/new-project")}
            className="btn-primary"
            style={{ padding: "6px 14px", fontSize: 12, display: "flex", alignItems: "center", gap: 6 }}
          >
            <Plus size={13} /> Nueva tienda
          </button>
        </div>

        {isLoading ? (
          <div className="grid-r3">
            {[1, 2, 3].map(i => <div key={i} className="skeleton" style={{ height: 72, borderRadius: 12 }} />)}
          </div>
        ) : projectCount === 0 ? (
          <div className="glass-card" style={{ padding: "36px 24px", textAlign: "center" }}>
            <p style={{ fontSize: 32, marginBottom: 12 }}>🛍️</p>
            <p style={{ fontSize: 15, fontWeight: 700, color: "var(--t)", marginBottom: 6 }}>Sin tiendas conectadas</p>
            <p style={{ fontSize: 13, color: "var(--t3)", marginBottom: 20 }}>Conecta tu primera tienda Shopify para empezar a optimizar con IA.</p>
            <button onClick={() => setLocation("/new-project")} className="btn-primary">
              <Plus size={14} /> Conectar primera tienda
            </button>
          </div>
        ) : (
          <div className="grid-r3">
            {projects!.map((p: { id: number; name: string; shopDomain?: string | null; storeNiche?: string | null }) => (
              <Link key={p.id} href={`/projects/${p.id}/audit`}>
                <div className="glass-card card-hover" style={{ padding: "14px 16px", display: "flex", alignItems: "center", justifyContent: "space-between", cursor: "pointer" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <div style={{ position: "relative", flexShrink: 0 }}>
                      <div className="logo-gem" style={{ width: 30, height: 30, fontSize: 13, background: "rgba(200,168,75,0.1)", color: "var(--gold2)" }}>🛍</div>
                      <span style={{
                        position: "absolute", top: -6, right: -8,
                        background: "var(--ink3)", border: "1px solid var(--bdr)",
                        borderRadius: 6, padding: "1px 5px",
                        fontSize: 9, fontWeight: 800, color: "var(--t3)", letterSpacing: "0.5px",
                        lineHeight: "14px",
                      }}>#{p.id}</span>
                    </div>
                    <div>
                      <p style={{ fontSize: 13, fontWeight: 700, color: "var(--t)" }}>{p.name}</p>
                      <p style={{ fontSize: 11, color: "var(--t3)" }}>{p.shopDomain ?? "—"}{p.storeNiche ? ` · ${p.storeNiche}` : ""}</p>
                    </div>
                  </div>
                  <ArrowRight size={14} style={{ color: "var(--t4)", flexShrink: 0 }} />
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>

      {/* Quick actions */}
      <div>
        <p style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "1.5px", color: "var(--t3)", marginBottom: 14 }}>Acciones rápidas</p>
        <div className="grid-r4">
          {QUICK_ACTIONS.map(action => (
            <Link key={action.href} href={action.href}>
              <div className="glass-card card-hover" style={{ padding: "16px", cursor: "pointer", height: "100%", boxSizing: "border-box" }}>
                <div style={{ fontSize: 22, marginBottom: 10 }}>{action.icon}</div>
                <p style={{ fontSize: 13, fontWeight: 700, color: "var(--t)", marginBottom: 3 }}>{action.label}</p>
                <p style={{ fontSize: 11, color: "var(--t3)", lineHeight: 1.4 }}>{action.desc}</p>
              </div>
            </Link>
          ))}
        </div>
      </div>

    </div>
  );
}
