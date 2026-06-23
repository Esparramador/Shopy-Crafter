import { useState, useEffect, useRef, useCallback } from "react";

const API_BASE = import.meta.env.BASE_URL?.replace(/\/$/, "") ?? "";

function safeFeatures(f: unknown): { text: string; included: boolean }[] {
  if (!f) return [];
  const arr = typeof f === "string" ? JSON.parse(f) : f;
  if (!Array.isArray(arr)) return [];
  return arr.map((x: unknown) =>
    typeof x === "string" ? { text: x, included: true } : (x as { text: string; included: boolean })
  );
}

function planIcon(name: string) {
  if (/emprendedor/i.test(name)) return "🌱";
  if (/starter/i.test(name)) return "🚀";
  if (/growth/i.test(name)) return "⚡";
  if (/enterprise/i.test(name)) return "🏆";
  return "✦";
}

function PlanCard({ plan, annual }: { plan: any; annual: boolean }) {
  const tiltRef = useRef<HTMLDivElement>(null);

  const onMove = useCallback((e: React.MouseEvent) => {
    const el = tiltRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const x = (e.clientX - r.left) / r.width - 0.5;
    const y = (e.clientY - r.top) / r.height - 0.5;
    el.style.transform = `perspective(1100px) rotateX(${-y * 14}deg) rotateY(${x * 14}deg) translateZ(12px)`;
    const shine = el.querySelector<HTMLElement>(".ts-shine");
    if (shine) {
      shine.style.background = `radial-gradient(circle at ${(x + 0.5) * 100}% ${(y + 0.5) * 100}%, rgba(200,168,75,0.22) 0%, rgba(255,255,255,0.04) 35%, transparent 70%)`;
    }
  }, []);

  const onLeave = useCallback(() => {
    const el = tiltRef.current;
    if (!el) return;
    el.style.transform = "perspective(1100px) rotateX(0) rotateY(0) translateZ(0)";
    const shine = el.querySelector<HTMLElement>(".ts-shine");
    if (shine) shine.style.background = "transparent";
  }, []);

  const price = annual
    ? (plan.price_annual ?? plan.priceAnnual ?? Math.round(plan.price * 10))
    : plan.price;
  const period = annual ? "/año" : "/mes";
  const savings = annual && plan.price
    ? Math.round((plan.price * 12 - (plan.price_annual ?? plan.price * 10)) / (plan.price * 12) * 100)
    : 0;
  const features = safeFeatures(plan.features);
  const isFeatured = !!plan.featured;
  const checkoutUrl = plan.shopify_checkout_url || plan.cta_href || "/client/messages";
  const isExternal = checkoutUrl.startsWith("http");

  return (
    <div
      ref={tiltRef}
      className={`ts-card-tilt${isFeatured ? " ts-feat-card" : ""}`}
      onMouseMove={onMove}
      onMouseLeave={onLeave}
    >
      <div className="ts-card-wrap">
        <div className="ts-border-spin" />
        <div className="ts-card-body">
          <div className="ts-shine" />
          {(plan.badge || isFeatured) && (
            <div className="ts-badge-top">{plan.badge ?? "MÁS POPULAR"}</div>
          )}
          <div className="ts-card-icon">{planIcon(plan.name)}</div>
          <h3 className="ts-card-name">{plan.name}</h3>
          <div className="ts-price-row">
            <span className="ts-price-cur">{plan.currency ?? "€"}</span>
            <span className="ts-price-amt">{price}</span>
            <span className="ts-price-per">{period}</span>
          </div>
          {annual && savings > 0 && (
            <div className="ts-save-badge">✓ Ahorras {savings}% vs mensual</div>
          )}
          <div className="ts-divider" />
          <ul className="ts-features">
            {features.map((f, i) => (
              <li key={i} className={f.included !== false ? "ts-fi" : "ts-fo"}>
                <span>{f.included !== false ? "✓" : "✕"}</span>
                {f.text}
              </li>
            ))}
          </ul>
          <a
            href={checkoutUrl}
            target={isExternal ? "_blank" : undefined}
            rel="noreferrer"
            className={`ts-card-cta${isFeatured ? " ts-cta-gold" : " ts-cta-ghost"}`}
          >
            {plan.cta_label ?? (isExternal ? "Comprar ahora →" : "Contactar con tu agencia →")}
          </a>
          {isExternal && (
            <p className="ts-secure-note">🔒 Pago seguro vía Shopify</p>
          )}
        </div>
      </div>
    </div>
  );
}

function ServiceCard({ svc }: { svc: any }) {
  const feats = safeFeatures(svc.features);
  const isJade = svc.color_accent === "jade";
  const href = svc.cta_url || "/client/messages";

  return (
    <div className={`ts-svc${isJade ? " ts-svc-jade" : ""}`}>
      <div className="ts-svc-icon">{svc.icon}</div>
      {svc.badge && <div className="ts-svc-badge">{svc.badge}</div>}
      <h3 className="ts-svc-name">{svc.name}</h3>
      <p className="ts-svc-short">{svc.short_desc || svc.description}</p>
      <div className="ts-svc-price">{svc.price_display}</div>
      <ul className="ts-svc-feats">
        {feats.slice(0, 5).map((f, i) => (
          <li key={i}><span>✓</span>{f.text}</li>
        ))}
        {feats.length > 5 && (
          <li className="ts-svc-more">+{feats.length - 5} más incluido</li>
        )}
      </ul>
      <a href={href} className="ts-svc-cta">{svc.cta_label}</a>
    </div>
  );
}

function Skeleton({ h = 420 }: { h?: number }) {
  return <div className="ts-skeleton" style={{ height: h }} />;
}

export default function ClientTienda() {
  const [tab, setTab] = useState<"planes" | "servicios">("planes");
  const [annual, setAnnual] = useState(false);
  const [plans, setPlans] = useState<any[]>([]);
  const [services, setServices] = useState<any[]>([]);
  const [plansLoading, setPlansLoading] = useState(true);
  const [svcsLoading, setSvcsLoading] = useState(true);

  useEffect(() => {
    fetch(`${API_BASE}/api/tienda/plans`)
      .then(r => r.ok ? r.json() : [])
      .then(d => { setPlans(Array.isArray(d) ? d : []); setPlansLoading(false); })
      .catch(() => setPlansLoading(false));

    fetch(`${API_BASE}/api/tienda/services`)
      .then(r => r.ok ? r.json() : [])
      .then(d => { setServices(Array.isArray(d) ? d : []); setSvcsLoading(false); })
      .catch(() => setSvcsLoading(false));
  }, []);

  return (
    <div className="ts-root ct-client-tienda">

      {/* Background */}
      <div className="ts-bg" aria-hidden>
        <div className="ts-orb ts-orb-gold" />
        <div className="ts-orb ts-orb-jade" />
        <div className="ts-bg-grid" />
      </div>

      <div className="ts-content">

        {/* Hero compacto para dashboard */}
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

        {/* Tab Nav */}
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

        {/* PLANES */}
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
                : plans.map(p => <PlanCard key={p.id} plan={p} annual={annual} />)
              }
            </div>

            <div className="ts-trust-strip">
              {["🔒 Pago seguro via Shopify", "🔄 Sin permanencia", "⚡ Activación en 48h", "💬 Soporte dedicado"].map(t => (
                <span key={t} className="ts-trust-item">{t}</span>
              ))}
            </div>
          </section>
        )}

        {/* SERVICIOS */}
        {tab === "servicios" && (
          <section className="ts-section">
            <div className="ts-svc-header">
              <h2 className="ts-svc-title">Servicios especializados</h2>
              <p className="ts-svc-sub">Servicios puntuales para potenciar tu tienda cuando los necesitas.</p>
            </div>
            <div className="ts-svcs-grid">
              {svcsLoading
                ? [1, 2, 3, 4, 5, 6].map(i => <Skeleton key={i} h={380} />)
                : services.map(s => <ServiceCard key={s.id} svc={s} />)
              }
            </div>
          </section>
        )}

        {/* Bottom CTA */}
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
