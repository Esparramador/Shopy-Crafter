import PublicLayout from "@/components/PublicLayout";

const RELEASES = [
  {
    version: "3.8.0",
    date: "2026-04-30",
    tag: "Major",
    title: "ShopyBrain OmniCore v3",
    changes: [
      "Nuevo motor de aprendizaje continuo con 46.890+ insights acumulados",
      "Brain Sync: sincronización automática de conocimiento entre proyectos",
      "Sistema de dominios de conocimiento (43 dominios activos)",
      "Dashboard de memorias con búsqueda semántica avanzada",
    ],
  },
  {
    version: "3.7.0",
    date: "2026-04-12",
    tag: "Feature",
    title: "Ad Studio + Campaign Kit",
    changes: [
      "Nuevo motor Ad Studio para creación de anuncios multi-plataforma",
      "Campaign Kit para planificación integral de campañas",
      "Soporte para Meta Ads, Google Ads y TikTok Ads",
      "Generación automática de variantes por audiencia objetivo",
    ],
  },
  {
    version: "3.6.0",
    date: "2026-03-28",
    tag: "Feature",
    title: "Economista IA (Pricing COGS)",
    changes: [
      "9 categorías de COGS con 30+ campos de coste detallados",
      "Estimación automática dual (Claude + Gemini) de costes",
      "Cálculo de precio óptimo con análisis de competencia",
      "Waterfall de margen y análisis break-even integrado",
      "Simulador LTV/CAC con proyecciones a 12 meses",
    ],
  },
  {
    version: "3.5.0",
    date: "2026-03-10",
    tag: "Feature",
    title: "A/B Testing con predicción IA",
    changes: [
      "Predicción de resultados antes de ejecutar el test (revenue, margen, conversión)",
      "Auto-winner con 95% de confianza estadística",
      "Soporte para tests de imagen, precio y descripción",
      "Dashboard con métricas en tiempo real y reportes exportables",
    ],
  },
  {
    version: "3.4.0",
    date: "2026-02-20",
    tag: "Feature",
    title: "Fusion Studio + Exploded View",
    changes: [
      "Editor creativo multi-capa con canvas interactivo",
      "Fusion Studio Pro para composiciones avanzadas",
      "Exploded View: visualización desglosada de productos",
      "Export a PNG/JPG/WebP en alta resolución",
    ],
  },
  {
    version: "3.3.0",
    date: "2026-02-05",
    tag: "Mejora",
    title: "Sistema de Logros y Gamificación",
    changes: [
      "10 logros con XP y niveles de progreso",
      "Roadmap personalizado 30-60-90 días por proyecto",
      "Notificaciones de hitos alcanzados",
      "Panel de automatizaciones con scheduling",
    ],
  },
  {
    version: "3.2.0",
    date: "2026-01-15",
    tag: "Mejora",
    title: "Command Center + Universal Search",
    changes: [
      "Centro de control unificado con overview del sistema",
      "Búsqueda universal cross-project y cross-módulo",
      "Vault mejorado con 7 categorías y 95+ archivos",
      "Inteligencia competitiva con 24 competidores trackeados",
    ],
  },
];

export default function Changelog() {
  return (
    <PublicLayout>
      <div style={{ padding: "80px 24px", maxWidth: 820, margin: "0 auto" }}>
        <div style={{ display: "inline-block", padding: "6px 14px", borderRadius: 999, background: "rgba(200,168,75,0.12)", color: "#e6c668", border: "1px solid rgba(200,168,75,0.2)", fontSize: 12, fontWeight: 700, letterSpacing: "0.5px", textTransform: "uppercase", marginBottom: 16 }}>Changelog</div>
        <h1 style={{ fontSize: "clamp(32px, 5vw, 48px)", fontWeight: 800, color: "var(--t, #eee)", marginBottom: 16, lineHeight: 1.1 }}>
          Novedades y actualizaciones
        </h1>
        <p style={{ fontSize: 16, color: "var(--t3, #999)", lineHeight: 1.7, marginBottom: 48 }}>
          Historial de cambios, nuevas funcionalidades y mejoras de la plataforma.
        </p>

        <div style={{ position: "relative", paddingLeft: 28 }}>
          <div style={{ position: "absolute", left: 8, top: 0, bottom: 0, width: 2, background: "var(--ink3, #1e1e22)" }} />
          {RELEASES.map(release => (
            <div key={release.version} style={{ marginBottom: 32, position: "relative" }}>
              <div style={{
                position: "absolute", left: -24, top: 6, width: 12, height: 12,
                borderRadius: "50%", background: release.tag === "Major" ? "#e6c668" : "var(--jade, #2dd49f)",
                border: "2px solid var(--ink, #0a0a0c)",
              }} />
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8, flexWrap: "wrap" }}>
                <span style={{ fontSize: 13, fontWeight: 700, color: "#e6c668" }}>v{release.version}</span>
                <span style={{
                  fontSize: 10, padding: "2px 8px", borderRadius: 4, fontWeight: 600,
                  background: release.tag === "Major" ? "rgba(200,168,75,0.15)" : release.tag === "Feature" ? "rgba(45,212,159,0.12)" : "rgba(100,149,237,0.12)",
                  color: release.tag === "Major" ? "#e6c668" : release.tag === "Feature" ? "var(--jade, #2dd49f)" : "#6495ed",
                }}>{release.tag}</span>
                <span style={{ fontSize: 12, color: "var(--t4, #666)" }}>{new Date(release.date).toLocaleDateString("es-ES", { day: "numeric", month: "long", year: "numeric" })}</span>
              </div>
              <h3 style={{ fontSize: 17, fontWeight: 700, color: "var(--t, #eee)", marginBottom: 10 }}>{release.title}</h3>
              <ul style={{ margin: 0, paddingLeft: 18, display: "flex", flexDirection: "column", gap: 4 }}>
                {release.changes.map((ch, i) => (
                  <li key={i} style={{ fontSize: 13, color: "var(--t3, #999)", lineHeight: 1.6 }}>{ch}</li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>
    </PublicLayout>
  );
}
