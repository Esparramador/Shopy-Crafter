import { useState, useEffect } from "react";
import { CheckCircle, Circle, Clock } from "lucide-react";

const API_BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

const ROADMAP_PHASES = [
  {
    phase: "30 días",
    color: "var(--crim)",
    tasks: [
      { key: "store_connected", label: "Conectar tienda Shopify", description: "Configura el acceso OAuth a tu tienda" },
      { key: "audit_run", label: "Ejecutar auditoría IA", description: "Análisis completo de todos tus productos" },
      { key: "image_generated", label: "Generar primeras imágenes", description: "Crea imágenes profesionales con IA" },
      { key: "price_optimized", label: "Optimizar precios", description: "Aplica estrategias de pricing inteligente" },
    ],
  },
  {
    phase: "60 días",
    color: "var(--gold)",
    tasks: [
      { key: "ab_test_active", label: "Lanzar A/B Tests", description: "Experimenta con variantes de productos" },
      { key: "seo_applied", label: "Aplicar SEO masivo", description: "Optimiza metadatos con IA" },
      { key: "client_invited", label: "Invitar al cliente", description: "Configura el acceso del cliente al portal" },
      { key: "competitors_analyzed", label: "Analizar competidores", description: "Scan de competidores y alertas de precios" },
    ],
  },
  {
    phase: "90 días",
    color: "var(--jade)",
    tasks: [
      { key: "revenue_1k", label: "€1K Revenue Atribuido", description: "Alcanza €1,000 en revenue atribuido a la plataforma" },
      { key: "boost_masivo", label: "Boost Masivo activado", description: "Automatiza todas las optimizaciones" },
      { key: "inventory_monitored", label: "Inventario monitoreado", description: "Alertas de stock y emails automáticos" },
      { key: "products_10", label: "10+ productos optimizados", description: "Escala a todo el catálogo" },
    ],
  },
];

export default function Roadmap() {
  const [progress, setProgress] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`${API_BASE}/api/onboarding/progress`, { credentials: "include" })
      .then(r => r.json())
      .then(d => { setProgress(d.progress); })
      .finally(() => setLoading(false));
  }, []);

  const isCompleted = (key: string) => {
    if (!progress) return false;
    const map: Record<string, string> = {
      store_connected: "stepStoreConnected",
      audit_run: "stepAuditRun",
      image_generated: "stepImageGenerated",
      price_optimized: "stepPriceOptimized",
      ab_test_active: "stepAbTestActive",
      seo_applied: "stepSeoApplied",
      client_invited: "stepClientInvited",
    };
    return progress[map[key]] === 1;
  };

  const completionPct = progress?.completionPct ?? 0;

  return (
    <div>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: "var(--t)" }}>Plan 30-60-90 Días</h1>
        <p style={{ fontSize: 13, color: "var(--t3)", marginTop: 4 }}>Tu hoja de ruta para maximizar el ROI en los primeros 3 meses</p>
      </div>

      <div className="glass-card" style={{ padding: "16px 20px", marginBottom: 24 }}>
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
          <span style={{ fontSize: 13, fontWeight: 600, color: "var(--t)" }}>Setup Completado</span>
          <span style={{ fontSize: 13, fontWeight: 700, color: "var(--gold)" }}>{completionPct}%</span>
        </div>
        <div style={{ height: 6, background: "var(--ink3)", borderRadius: 3 }}>
          <div style={{
            height: "100%", borderRadius: 3, width: `${completionPct}%`,
            background: "linear-gradient(90deg, var(--gold), var(--jade))",
            transition: "width 0.6s ease",
          }} />
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 20 }}>
        {ROADMAP_PHASES.map(phase => {
          const completedTasks = phase.tasks.filter(t => isCompleted(t.key)).length;
          const pct = Math.round((completedTasks / phase.tasks.length) * 100);
          return (
            <div key={phase.phase} className="glass-card" style={{ padding: 20, borderTop: `3px solid ${phase.color}` }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
                <h3 style={{ fontSize: 15, fontWeight: 700, color: phase.color }}>{phase.phase}</h3>
                <span style={{ fontSize: 12, color: "var(--t3)" }}>{completedTasks}/{phase.tasks.length}</span>
              </div>
              <div style={{ height: 4, background: "var(--ink3)", borderRadius: 2, marginBottom: 16 }}>
                <div style={{ height: "100%", background: phase.color, borderRadius: 2, width: `${pct}%` }} />
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                {phase.tasks.map(task => {
                  const done = isCompleted(task.key);
                  return (
                    <div key={task.key} style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
                      {done
                        ? <CheckCircle size={16} style={{ color: "var(--jade)", flexShrink: 0, marginTop: 2 }} />
                        : <Circle size={16} style={{ color: "var(--t4)", flexShrink: 0, marginTop: 2 }} />
                      }
                      <div>
                        <p style={{ fontSize: 13, fontWeight: done ? 600 : 400, color: done ? "var(--t)" : "var(--t2)", marginBottom: 2 }}>{task.label}</p>
                        <p style={{ fontSize: 11, color: "var(--t3)", lineHeight: 1.4 }}>{task.description}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      <div className="glass-card" style={{ padding: 24, marginTop: 20, background: "linear-gradient(135deg, rgba(200,168,75,0.08), rgba(80,200,120,0.08))" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <Clock size={24} style={{ color: "var(--gold)" }} />
          <div>
            <h3 style={{ fontSize: 14, fontWeight: 700, color: "var(--t)", marginBottom: 4 }}>
              Tiempo estimado hasta ROI positivo: <span style={{ color: "var(--gold)" }}>45-60 días</span>
            </h3>
            <p style={{ fontSize: 13, color: "var(--t3)" }}>
              Basado en datos de clientes anteriores: optimización media de +34% en conversión, +18% en AOV y -22% en coste de adquisición.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
