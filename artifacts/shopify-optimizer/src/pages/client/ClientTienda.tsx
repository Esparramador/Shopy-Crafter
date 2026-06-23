import { useState } from "react";
import { PlanCard, ServiceCard, Skeleton, useTiendaData } from "@/pages/Tienda";

export default function ClientTienda() {
  const [tab, setTab] = useState<"planes" | "servicios">("planes");
  const [annual, setAnnual] = useState(false);
  const { plans, services, plansLoading, svcsLoading } = useTiendaData();

  return (
    <div className="ts-root ct-client-tienda">

      <div className="ts-bg" aria-hidden>
        <div className="ts-orb ts-orb-gold" />
        <div className="ts-orb ts-orb-jade" />
        <div className="ts-bg-grid" />
      </div>

      <div className="ts-content">

        <header className="ts-hero ct-hero">
          <div className="ts-pill">
            <span className="ts-pill-dot" />
            PLANES Y SERVICIOS
          </div>
          <h1>
            Tu plan de<br />
            <span className="ts-gradient-text">crecimiento.</span>
          </h1>
          <p className="ts-hero-sub">
            Planes IA para tu tienda Shopify o servicios a medida para escalar.
            Sin permanencia. Actívalo hoy.
          </p>
        </header>

        <nav className="ts-tabs" aria-label="Secciones">
          <button
            className={`ts-tab${tab === "planes" ? " ts-tab-on" : ""}`}
            onClick={() => setTab("planes")}
          >
            📦 Planes
          </button>
          <button
            className={`ts-tab${tab === "servicios" ? " ts-tab-on" : ""}`}
            onClick={() => setTab("servicios")}
          >
            ⚡ Servicios
          </button>
        </nav>

        {tab === "planes" && (
          <section className="ts-section">
            <div className="ts-toggle-wrap">
              <span className={`ts-tog-label${!annual ? " ts-tog-on" : ""}`}>Mensual</span>
              <button
                className={`ts-switch${annual ? " ts-switch-on" : ""}`}
                onClick={() => setAnnual(a => !a)}
                aria-pressed={annual}
                aria-label="Cambiar a pago anual"
              >
                <span className="ts-thumb" />
              </button>
              <span className={`ts-tog-label${annual ? " ts-tog-on" : ""}`}>Anual</span>
              {annual && <span className="ts-save-pill">Ahorra hasta 17%</span>}
            </div>

            <div className="ts-plans-grid">
              {plansLoading
                ? [1, 2, 3, 4].map(i => <Skeleton key={i} />)
                : plans.map(p => (
                    <PlanCard
                      key={p.id}
                      plan={p}
                      annual={annual}
                      fallbackHref="/client/messages"
                    />
                  ))
              }
            </div>

            <div className="ts-trust-strip">
              {["🔒 Pago seguro via Shopify", "🔄 Sin permanencia", "⚡ Activación en 48h", "💬 Soporte dedicado"].map(t => (
                <span key={t} className="ts-trust-item">{t}</span>
              ))}
            </div>
          </section>
        )}

        {tab === "servicios" && (
          <section className="ts-section">
            <div className="ts-svc-header">
              <h2 className="ts-svc-title">Servicios especializados</h2>
              <p className="ts-svc-sub">Servicios puntuales para potenciar tu tienda cuando los necesitas.</p>
            </div>
            <div className="ts-svcs-grid">
              {svcsLoading
                ? [1, 2, 3, 4, 5, 6].map(i => <Skeleton key={i} h={380} />)
                : services.map(s => (
                    <ServiceCard
                      key={s.id}
                      svc={s}
                      fallbackHref="/client/messages"
                    />
                  ))
              }
            </div>
          </section>
        )}

        <div className="ts-bottom-cta">
          <div className="ts-bottom-inner">
            <span className="ts-bottom-icon">💬</span>
            <div>
              <h3 className="ts-bottom-title">¿Necesitas algo personalizado?</h3>
              <p className="ts-bottom-sub">Tu agencia diseña soluciones a medida. Escríbeles directamente desde aquí.</p>
            </div>
            <a href="/client/messages" className="ts-bottom-btn">Hablar con tu agencia →</a>
          </div>
        </div>

      </div>

      <style>{`
        .ct-client-tienda { min-height: calc(100vh - 60px); }
        .ct-client-tienda .ts-content { padding-top: 0; }
        .ct-hero { padding: 32px 0 36px; }
        .ct-hero h1 { font-size: clamp(32px, 4.5vw, 58px); }
      `}</style>
    </div>
  );
}
