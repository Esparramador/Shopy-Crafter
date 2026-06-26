import { useState, useRef, useCallback } from "react";
import { useEffect } from "react";

const API_BASE = import.meta.env.BASE_URL?.replace(/\/$/, "") ?? "";

// ── Helpers ───────────────────────────────────────────────────────────────────
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

// ── Shopify Checkout ──────────────────────────────────────────────────────────
async function openShopifyCheckout(planId: string, fallbackUrl: string) {
  try {
    const res = await fetch(`${API_BASE}/api/tienda/create-checkout`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ planId }),
    });
    if (res.ok) {
      const { checkoutUrl } = await res.json();
      if (checkoutUrl) {
        window.open(checkoutUrl, "_blank", "noopener,noreferrer");
        return;
      }
    }
  } catch { /* fallback below */ }
  if (fallbackUrl.startsWith("http")) {
    window.open(fallbackUrl, "_blank", "noopener,noreferrer");
  } else {
    window.location.href = fallbackUrl;
  }
}

// ── Plan Card ─────────────────────────────────────────────────────────────────
function PlanCard({ plan, annual }: { plan: any; annual: boolean }) {
  const tiltRef = useRef<HTMLDivElement>(null);
  const [loading, setLoading] = useState(false);

  const onMove = useCallback((e: React.MouseEvent) => {
    const el = tiltRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const x = (e.clientX - r.left) / r.width - 0.5;
    const y = (e.clientY - r.top) / r.height - 0.5;
    el.style.transform = `perspective(1100px) rotateX(${-y * 14}deg) rotateY(${x * 14}deg) translateZ(12px)`;
    const shine = el.querySelector<HTMLElement>(".ts-shine");
    if (shine) shine.style.background = `radial-gradient(circle at ${(x + 0.5) * 100}% ${(y + 0.5) * 100}%, rgba(200,168,75,0.22) 0%, rgba(255,255,255,0.04) 35%, transparent 70%)`;
  }, []);

  const onLeave = useCallback(() => {
    const el = tiltRef.current;
    if (!el) return;
    el.style.transform = "perspective(1100px) rotateX(0) rotateY(0) translateZ(0)";
    const shine = el.querySelector<HTMLElement>(".ts-shine");
    if (shine) shine.style.background = "transparent";
  }, []);

  const price = annual ? (plan.price_annual ?? Math.round(plan.price * 10)) : plan.price;
  const period = annual ? "/año" : "/mes";
  const savings = annual && plan.price
    ? Math.round((plan.price * 12 - (plan.price_annual ?? plan.price * 10)) / (plan.price * 12) * 100) : 0;
  const features = safeFeatures(plan.features);
  const isFeatured = !!plan.featured;
  const hasShopify = !!plan.shopify_checkout_url;
  const fallback = plan.shopify_checkout_url || plan.cta_href || "/client/messages";

  async function handleBuy(e: React.MouseEvent) {
    e.preventDefault();
    if (loading) return;
    setLoading(true);
    await openShopifyCheckout(plan.id, fallback);
    setLoading(false);
  }

  return (
    <div ref={tiltRef} className={`ts-card-tilt${isFeatured ? " ts-feat-card" : ""}`} onMouseMove={onMove} onMouseLeave={onLeave}>
      <div className="ts-card-wrap">
        <div className="ts-border-spin" />
        <div className="ts-card-body">
          <div className="ts-shine" />
          {(plan.badge || isFeatured) && <div className="ts-badge-top">{plan.badge ?? "MÁS POPULAR"}</div>}
          <div className="ts-card-icon">{planIcon(plan.name)}</div>
          <h3 className="ts-card-name">{plan.name}</h3>
          <div className="ts-price-row">
            <span className="ts-price-cur">{plan.currency ?? "€"}</span>
            <span className="ts-price-amt">{price}</span>
            <span className="ts-price-per">{period}</span>
          </div>
          {annual && savings > 0 && <div className="ts-save-badge">✓ Ahorras {savings}% vs mensual</div>}
          <div className="ts-divider" />
          <ul className="ts-features">
            {features.map((f, i) => (
              <li key={i} className={f.included !== false ? "ts-fi" : "ts-fo"}>
                <span>{f.included !== false ? "✓" : "✕"}</span>{f.text}
              </li>
            ))}
          </ul>
          <button
            onClick={handleBuy}
            disabled={loading}
            className={`ts-card-cta${isFeatured ? " ts-cta-gold" : " ts-cta-ghost"}${loading ? " ts-cta-loading" : ""}`}
          >
            {loading ? "Redirigiendo…" : (hasShopify ? (plan.cta_label ?? "Comprar ahora →") : (plan.cta_label ?? "Contactar →"))}
          </button>
          {hasShopify && <p className="ts-secure-note">🔒 Pago seguro vía Shopify</p>}
        </div>
      </div>
    </div>
  );
}

// ── Service Card ──────────────────────────────────────────────────────────────
function ServiceCard({ svc }: { svc: any }) {
  const feats = safeFeatures(svc.features);
  const isJade = svc.color_accent === "jade";
  return (
    <div className={`ts-svc${isJade ? " ts-svc-jade" : ""}`}>
      <div className="ts-svc-icon">{svc.icon}</div>
      {svc.badge && <div className="ts-svc-badge">{svc.badge}</div>}
      <h3 className="ts-svc-name">{svc.name}</h3>
      <p className="ts-svc-short">{svc.short_desc || svc.description}</p>
      <div className="ts-svc-price">{svc.price_display}</div>
      <ul className="ts-svc-feats">
        {feats.slice(0, 5).map((f, i) => <li key={i}><span>✓</span>{f.text}</li>)}
        {feats.length > 5 && <li className="ts-svc-more">+{feats.length - 5} más incluido</li>}
      </ul>
      <a href={svc.cta_url || "/client/messages"} className="ts-svc-cta">{svc.cta_label}</a>
    </div>
  );
}

function Skeleton({ h = 420 }: { h?: number }) {
  return <div className="ts-skeleton" style={{ height: h }} />;
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function ClientTienda() {
  const [tab, setTab] = useState<"planes" | "servicios">("planes");
  const [annual, setAnnual] = useState(false);
  const [plans, setPlans] = useState<any[]>([]);
  const [services, setServices] = useState<any[]>([]);
  const [plansLoading, setPlansLoading] = useState(true);
  const [svcsLoading, setSvcsLoading] = useState(true);

  useEffect(() => {
    fetch(`${API_BASE}/api/tienda/plans`, { credentials: "include" })
      .then(r => r.ok ? r.json() : [])
      .then(d => { setPlans(Array.isArray(d) ? d : []); setPlansLoading(false); })
      .catch(() => setPlansLoading(false));

    fetch(`${API_BASE}/api/tienda/services`, { credentials: "include" })
      .then(r => r.ok ? r.json() : [])
      .then(d => { setServices(Array.isArray(d) ? d : []); setSvcsLoading(false); })
      .catch(() => setSvcsLoading(false));
  }, []);

  return (
    <div className="ts-root ct-client-tienda">
      <style>{CSS}</style>

      <div className="ts-bg" aria-hidden>
        <div className="ts-orb ts-orb-gold" />
        <div className="ts-orb ts-orb-jade" />
        <div className="ts-bg-grid" />
      </div>

      <div className="ts-content">

        <header className="ts-hero ct-hero">
          <a href="/client" className="ct-back-btn">← Volver al panel</a>
          <div className="ts-pill"><span className="ts-pill-dot" />PLANES Y SERVICIOS</div>
          <h1>Tu plan de<br /><span className="ts-gradient-text">crecimiento.</span></h1>
          <p className="ts-hero-sub">Planes IA para tu tienda Shopify o servicios a medida. Sin permanencia. Actívalo hoy.</p>
        </header>

        <nav className="ts-tabs" aria-label="Secciones">
          <button className={`ts-tab${tab === "planes" ? " ts-tab-on" : ""}`} onClick={() => setTab("planes")}>📦 Planes</button>
          <button className={`ts-tab${tab === "servicios" ? " ts-tab-on" : ""}`} onClick={() => setTab("servicios")}>⚡ Servicios</button>
        </nav>

        {tab === "planes" && (
          <section className="ts-section">
            <div className="ts-toggle-wrap">
              <span className={`ts-tog-label${!annual ? " ts-tog-on" : ""}`}>Mensual</span>
              <button className={`ts-switch${annual ? " ts-switch-on" : ""}`} onClick={() => setAnnual(a => !a)} aria-pressed={annual} aria-label="Cambiar a pago anual">
                <span className="ts-thumb" />
              </button>
              <span className={`ts-tog-label${annual ? " ts-tog-on" : ""}`}>Anual</span>
              {annual && <span className="ts-save-pill">Ahorra hasta 17%</span>}
            </div>
            <div className="ts-plans-grid">
              {plansLoading ? [1,2,3,4].map(i => <Skeleton key={i} />) : plans.map(p => <PlanCard key={p.id} plan={p} annual={annual} />)}
            </div>
            <div className="ts-trust-strip">
              {["🔒 Pago seguro via Shopify","🔄 Sin permanencia","⚡ Activación en 48h","💬 Soporte dedicado"].map(t => (
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
              {svcsLoading ? [1,2,3,4,5,6].map(i => <Skeleton key={i} h={380} />) : services.map(s => <ServiceCard key={s.id} svc={s} />)}
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
    </div>
  );
}

// ── CSS ───────────────────────────────────────────────────────────────────────
const CSS = `
.ct-client-tienda { min-height: calc(100vh - 60px); }
.ct-client-tienda .ts-content { padding-top: 0; }
.ct-hero { padding: 32px 0 36px; }
.ct-hero h1 { font-size: clamp(32px, 4.5vw, 58px); }
.ct-back-btn {
  display: inline-flex; align-items: center; gap: 6px;
  margin-bottom: 20px; padding: 7px 16px; border-radius: 8px;
  border: 1px solid rgba(255,255,255,0.1); background: rgba(255,255,255,0.04);
  color: rgba(255,255,255,0.5); font-size: 12.5px; font-weight: 600;
  text-decoration: none; transition: all .2s; font-family: var(--fb,'Geist',sans-serif);
}
.ct-back-btn:hover { border-color: rgba(200,168,75,0.3); color: rgba(200,168,75,0.9); background: rgba(200,168,75,0.06); }

.ts-root { background: var(--ink,#0a0a0c); position: relative; overflow-x: hidden; }
.ts-bg { position: fixed; inset: 0; z-index: 0; pointer-events: none; overflow: hidden; }
.ts-orb { position: absolute; border-radius: 50%; filter: blur(80px); animation: tsOrb 12s ease-in-out infinite; }
.ts-orb-gold { top: -15%; right: -10%; width: 600px; height: 600px; background: radial-gradient(circle, rgba(200,168,75,0.14), transparent 65%); animation-duration: 9s; }
.ts-orb-jade { bottom: -10%; left: -12%; width: 700px; height: 700px; background: radial-gradient(circle, rgba(45,212,159,0.08), transparent 65%); animation-duration: 13s; animation-direction: reverse; }
@keyframes tsOrb { 0%,100%{transform:translate(0,0) scale(1)} 50%{transform:translate(24px,-24px) scale(1.12)} }
.ts-bg-grid { position: absolute; inset: 0; background-image: radial-gradient(circle, rgba(200,168,75,0.055) 1px, transparent 1px); background-size: 52px 52px; mask-image: radial-gradient(ellipse 80% 80% at 50% 40%, rgba(0,0,0,.35) 0%, transparent 100%); }

.ts-content { position: relative; z-index: 5; max-width: 1280px; margin: 0 auto; padding: 0 24px 96px; }
.ts-hero { text-align: center; padding: 72px 0 52px; }
.ts-pill { display: inline-flex; align-items: center; gap: 8px; padding: 7px 20px; border-radius: 99px; border: 1px solid rgba(200,168,75,0.28); background: rgba(200,168,75,0.07); font-size: 10.5px; font-weight: 800; letter-spacing: 2px; text-transform: uppercase; color: rgba(200,168,75,0.9); margin-bottom: 28px; }
.ts-pill-dot { width: 6px; height: 6px; border-radius: 50%; background: #d4a843; animation: tsPulse 1.8s ease-in-out infinite; }
@keyframes tsPulse { 0%,100%{opacity:1;transform:scale(1)} 50%{opacity:0.5;transform:scale(0.7)} }
.ts-hero h1 { font-family: var(--fh,'Instrument Serif',serif); font-size: clamp(44px,6.5vw,80px); font-weight: 400; line-height: 1.05; color: #eee; margin: 0 0 20px; letter-spacing: -1px; }
.ts-gradient-text { background: linear-gradient(130deg,#d4a843 0%,#f0d070 40%,#c8a84b 80%); -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text; }
.ts-hero-sub { font-size: 16px; color: rgba(255,255,255,0.48); max-width: 520px; margin: 0 auto; line-height: 1.72; }

.ts-tabs { display: flex; align-items: center; justify-content: center; gap: 4px; margin-bottom: 44px; background: rgba(255,255,255,0.035); border: 1px solid rgba(255,255,255,0.07); border-radius: 14px; padding: 4px; width: fit-content; margin-left: auto; margin-right: auto; }
.ts-tab { padding: 11px 32px; border-radius: 11px; font-size: 12.5px; font-weight: 700; letter-spacing: 1px; cursor: pointer; border: none; background: transparent; color: rgba(255,255,255,0.4); transition: all .22s; font-family: inherit; white-space: nowrap; }
.ts-tab.ts-tab-on { background: linear-gradient(135deg,rgba(200,168,75,0.2),rgba(200,168,75,0.08)); border: 1px solid rgba(200,168,75,0.32); color: rgba(200,168,75,1); box-shadow: 0 2px 16px rgba(200,168,75,0.1); }

.ts-toggle-wrap { display: flex; align-items: center; justify-content: center; gap: 14px; margin-bottom: 44px; }
.ts-tog-label { font-size: 13px; color: rgba(255,255,255,0.35); transition: color .2s; }
.ts-tog-label.ts-tog-on { color: rgba(200,168,75,0.9); font-weight: 600; }
.ts-switch { width: 48px; height: 26px; border-radius: 13px; background: rgba(255,255,255,0.08); border: 1px solid rgba(200,168,75,0.25); cursor: pointer; position: relative; transition: all .2s; padding: 0; }
.ts-switch.ts-switch-on { background: rgba(200,168,75,0.22); border-color: rgba(200,168,75,0.5); }
.ts-thumb { position: absolute; top: 4px; left: 4px; width: 16px; height: 16px; border-radius: 50%; background: linear-gradient(135deg,#d4a843,#b8860b); transition: transform .22s cubic-bezier(.34,1.56,.64,1); box-shadow: 0 2px 8px rgba(200,168,75,0.4); }
.ts-switch.ts-switch-on .ts-thumb { transform: translateX(22px); }
.ts-save-pill { padding: 4px 12px; border-radius: 99px; background: rgba(45,212,159,0.1); border: 1px solid rgba(45,212,159,0.25); font-size: 11px; font-weight: 700; color: #2dd49f; letter-spacing: .5px; }

.ts-plans-grid { display: grid; grid-template-columns: repeat(auto-fit,minmax(min(270px,100%),1fr)); gap: 20px; align-items: stretch; }
.ts-card-tilt { will-change: transform; transition: transform .18s ease; position: relative; cursor: default; }
.ts-card-wrap { position: relative; border-radius: 22px; padding: 1px; overflow: hidden; height: 100%; }
.ts-border-spin { position: absolute; top: -100%; left: -100%; width: 300%; height: 300%; background: conic-gradient(from 0deg,transparent 0%,transparent 58%,rgba(200,168,75,.4) 63%,rgba(200,168,75,.85) 68%,rgba(200,168,75,.4) 73%,transparent 78%); animation: tsBorderSpin 6s linear infinite; }
.ts-feat-card .ts-border-spin { background: conic-gradient(from 0deg,transparent 0%,transparent 40%,rgba(200,168,75,.35) 47%,rgba(200,168,75,1) 52%,rgba(200,168,75,1) 60%,rgba(200,168,75,.35) 67%,transparent 73%); animation-duration: 3.8s; }
@keyframes tsBorderSpin { to{transform:rotate(360deg)} }
.ts-card-body { position: relative; border-radius: 21px; background: rgba(7,7,13,0.94); backdrop-filter: blur(24px); -webkit-backdrop-filter: blur(24px); padding: 28px 22px 22px; height: 100%; display: flex; flex-direction: column; overflow: hidden; }
.ts-feat-card .ts-card-body { background: rgba(10,8,18,0.96); }
.ts-shine { position: absolute; inset: 0; border-radius: inherit; pointer-events: none; transition: background .12s; z-index: 1; }
.ts-badge-top { position: absolute; top: 0; right: 22px; padding: 5px 14px; border-radius: 0 0 12px 12px; background: linear-gradient(135deg,#d4a843,#b8860b); font-size: 9px; font-weight: 900; letter-spacing: 1.5px; text-transform: uppercase; color: #000; z-index: 3; }
.ts-card-icon { font-size: 30px; margin-bottom: 14px; position: relative; z-index: 2; }
.ts-card-name { font-family: var(--fh,'Instrument Serif',serif); font-size: 26px; font-weight: 400; color: #eee; margin: 0 0 18px; position: relative; z-index: 2; }
.ts-feat-card .ts-card-name { color: #d4a843; }
.ts-price-row { display: flex; align-items: baseline; gap: 3px; margin-bottom: 6px; position: relative; z-index: 2; }
.ts-price-cur { font-size: 20px; color: rgba(255,255,255,0.6); font-weight: 700; }
.ts-price-amt { font-size: 56px; font-weight: 900; color: #eee; line-height: 1; font-family: var(--fb,'Geist',sans-serif); }
.ts-feat-card .ts-price-amt { color: #d4a843; }
.ts-price-per { font-size: 13px; color: rgba(255,255,255,0.35); align-self: flex-end; margin-bottom: 5px; padding-left: 2px; }
.ts-save-badge { font-size: 11px; color: #2dd49f; font-weight: 700; margin-bottom: 12px; letter-spacing: .3px; position: relative; z-index: 2; }
.ts-divider { height: 1px; background: rgba(255,255,255,0.06); margin: 14px 0; }
.ts-features { list-style: none; margin: 0 0 20px; padding: 0; display: flex; flex-direction: column; gap: 9px; flex: 1; position: relative; z-index: 2; }
.ts-fi,.ts-fo { display: flex; align-items: flex-start; gap: 9px; font-size: 13px; line-height: 1.45; }
.ts-fi { color: rgba(255,255,255,0.82); }
.ts-fo { color: rgba(255,255,255,0.22); text-decoration: line-through; }
.ts-fi>span { color: #2dd49f; font-weight: 700; flex-shrink: 0; }
.ts-fo>span { color: rgba(255,255,255,0.2); flex-shrink: 0; }
.ts-card-cta { display: block; width: 100%; padding: 13px 20px; text-align: center; border-radius: 11px; font-size: 13.5px; font-weight: 700; text-decoration: none; cursor: pointer; transition: all .2s; position: relative; z-index: 2; font-family: var(--fb,'Geist',sans-serif); letter-spacing: .3px; border: none; }
.ts-cta-gold { background: linear-gradient(135deg,#d4a843,#b8860b); color: #000; box-shadow: 0 4px 24px rgba(200,168,75,0.35); }
.ts-cta-gold:hover:not(:disabled) { box-shadow: 0 8px 32px rgba(200,168,75,0.5); transform: translateY(-1px); }
.ts-cta-ghost { background: rgba(200,168,75,0.07); border: 1px solid rgba(200,168,75,0.28); color: rgba(200,168,75,0.92); }
.ts-cta-ghost:hover:not(:disabled) { background: rgba(200,168,75,0.14); border-color: rgba(200,168,75,0.5); }
.ts-cta-loading { opacity: 0.6; cursor: wait; }
.ts-secure-note { text-align: center; font-size: 10.5px; color: rgba(255,255,255,0.25); margin: 8px 0 0; position: relative; z-index: 2; }
.ts-feat-card { filter: drop-shadow(0 0 32px rgba(200,168,75,0.14)); }

.ts-trust-strip { display: flex; flex-wrap: wrap; justify-content: center; gap: 12px 28px; margin-top: 40px; padding-top: 28px; border-top: 1px solid rgba(255,255,255,0.05); }
.ts-trust-item { font-size: 12px; color: rgba(255,255,255,0.35); font-weight: 500; }

.ts-section { width: 100%; }
.ts-svc-header { text-align: center; margin-bottom: 40px; }
.ts-svc-title { font-family: var(--fh,'Instrument Serif',serif); font-size: clamp(30px,4vw,48px); font-weight: 400; color: #eee; margin: 0 0 10px; }
.ts-svc-sub { font-size: 15px; color: rgba(255,255,255,0.4); margin: 0; }
.ts-svcs-grid { display: grid; grid-template-columns: repeat(auto-fit,minmax(min(300px,100%),1fr)); gap: 20px; }
.ts-svc { border-radius: 20px; background: rgba(255,255,255,0.025); border: 1px solid rgba(200,168,75,0.12); backdrop-filter: blur(18px); -webkit-backdrop-filter: blur(18px); padding: 26px 22px 22px; transition: all .28s cubic-bezier(.22,1,.36,1); cursor: default; position: relative; overflow: hidden; display: flex; flex-direction: column; }
.ts-svc::before { content: ''; position: absolute; top: 0; left: 0; right: 0; height: 1px; background: linear-gradient(90deg,transparent 0%,rgba(200,168,75,0.5) 50%,transparent 100%); opacity: 0; transition: opacity .3s; }
.ts-svc:hover { border-color: rgba(200,168,75,0.3); transform: translateY(-5px); box-shadow: 0 24px 64px rgba(0,0,0,0.55); }
.ts-svc:hover::before { opacity: 1; }
.ts-svc.ts-svc-jade { border-color: rgba(45,212,159,0.12); }
.ts-svc-jade::before { background: linear-gradient(90deg,transparent 0%,rgba(45,212,159,0.5) 50%,transparent 100%); }
.ts-svc-jade:hover { border-color: rgba(45,212,159,0.3); }
.ts-svc-icon { display: inline-flex; align-items: center; justify-content: center; width: 48px; height: 48px; border-radius: 14px; background: rgba(200,168,75,0.08); border: 1px solid rgba(200,168,75,0.18); font-size: 22px; margin-bottom: 16px; }
.ts-svc.ts-svc-jade .ts-svc-icon { background: rgba(45,212,159,0.07); border-color: rgba(45,212,159,0.18); }
.ts-svc-badge { position: absolute; top: 14px; right: 14px; padding: 3px 10px; border-radius: 99px; background: rgba(45,212,159,0.1); border: 1px solid rgba(45,212,159,0.25); font-size: 10px; font-weight: 700; color: #2dd49f; letter-spacing: .5px; }
.ts-svc-name { font-family: var(--fh,'Instrument Serif',serif); font-size: 22px; font-weight: 400; color: #eee; margin: 0 0 10px; }
.ts-svc-short { font-size: 13px; color: rgba(255,255,255,0.42); line-height: 1.65; margin: 0 0 16px; flex: 1; }
.ts-svc-price { font-size: 18px; font-weight: 800; color: rgba(200,168,75,0.9); margin-bottom: 14px; }
.ts-svc-feats { list-style: none; margin: 0 0 20px; padding: 0; display: flex; flex-direction: column; gap: 7px; }
.ts-svc-feats li { display: flex; align-items: flex-start; gap: 8px; font-size: 12.5px; color: rgba(255,255,255,0.65); line-height: 1.4; }
.ts-svc-feats li>span { color: #2dd49f; font-weight: 700; flex-shrink: 0; font-size: 11px; }
.ts-svc-more { font-size: 11.5px; color: rgba(200,168,75,0.6) !important; font-style: italic; }
.ts-svc-cta { display: block; width: 100%; padding: 11px 18px; text-align: center; border-radius: 10px; text-decoration: none; font-size: 13px; font-weight: 700; letter-spacing: .3px; background: rgba(200,168,75,0.07); border: 1px solid rgba(200,168,75,0.28); color: rgba(200,168,75,0.92); transition: all .2s; font-family: inherit; }
.ts-svc-cta:hover { background: rgba(200,168,75,0.14); border-color: rgba(200,168,75,0.5); }

.ts-bottom-cta { margin-top: 72px; padding: 32px 28px; border-radius: 20px; background: rgba(200,168,75,0.04); border: 1px solid rgba(200,168,75,0.12); }
.ts-bottom-inner { display: flex; align-items: center; gap: 24px; flex-wrap: wrap; max-width: 900px; margin: 0 auto; }
.ts-bottom-icon { font-size: 32px; flex-shrink: 0; }
.ts-bottom-inner>div { flex: 1; min-width: 200px; }
.ts-bottom-title { font-family: var(--fh,'Instrument Serif',serif); font-size: 22px; font-weight: 400; color: #eee; margin: 0 0 6px; }
.ts-bottom-sub { font-size: 13px; color: rgba(255,255,255,0.38); margin: 0; line-height: 1.6; }
.ts-bottom-btn { padding: 13px 28px; border-radius: 11px; text-decoration: none; background: linear-gradient(135deg,#d4a843,#b8860b); color: #000; font-size: 13.5px; font-weight: 800; white-space: nowrap; transition: all .2s; box-shadow: 0 4px 20px rgba(200,168,75,0.3); }
.ts-bottom-btn:hover { box-shadow: 0 8px 32px rgba(200,168,75,0.45); transform: translateY(-1px); }

.ts-skeleton { border-radius: 22px; background: linear-gradient(90deg,rgba(255,255,255,0.04) 25%,rgba(255,255,255,0.07) 50%,rgba(255,255,255,0.04) 75%); background-size: 200% 100%; animation: tsSkel 1.4s ease-in-out infinite; }
@keyframes tsSkel { 0%{background-position:200% 0} 100%{background-position:-200% 0} }

@media(max-width:600px){
  .ts-hero{padding:48px 0 36px}
  .ts-bottom-inner{flex-direction:column;text-align:center}
  .ts-bottom-btn{width:100%;text-align:center}
}
`;
