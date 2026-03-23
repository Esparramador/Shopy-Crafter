import { useEffect, useRef, useState } from "react";
import { Link } from "wouter";
import "./landing.css";

type CMSContent = {
  site: { name: string; tagline: string; logo: { type: string; value: string; imageUrl: string | null }; primaryColor: string; accentColor: string; font_heading: string; font_body: string };
  nav: { links: { id: string; label: string; href: string }[]; ctaPrimary: { label: string; href: string }; ctaSecondary: { label: string; href: string } };
  hero: { pill: { text: string; visible: boolean }; headline: string; headlineHighlight: string; subheadline: string; ctaPrimary: { label: string; href: string }; ctaSecondary: { label: string; href: string }; trustItems: string[] };
  features: { pill: string; headline: string; subheadline: string; items: { id: string; num: string; icon: string; iconBg: string; title: string; description: string; tags: string[] }[] };
  stats: { id: string; num: string; label: string }[];
  how: { pill: string; headline: string; headlineHighlight: string; steps: { num: string; title: string; desc: string }[] };
  pricing: { pill: string; headline: string; subheadline: string; plans: { id: string; name: string; price: string; currency: string; period: string; featured: boolean; badge: string | null; features: { text: string; included: boolean }[]; cta: { label: string; style: string } }[] };
  testimonials: { pill: string; headline: string; headlineHighlight: string; items: { id: string; stars: number; text: string; metric: string; author: string; role: string; initials: string; avatarColor: string; avatarTextColor: string }[] };
  cta: { pill: string; headline: string; headlineHighlight: string; subheadline: string; placeholder: string; buttonLabel: string; finePrint: string };
  footer: { tagline: string; columns: { title: string; links: { label: string; href: string }[] }[]; copyright: string; badges: string[] };
};

const BASE_URL = import.meta.env.BASE_URL.replace(/\/$/, "");

export default function Landing() {
  const [content, setContent] = useState<CMSContent | null>(null);
  const [scrolled, setScrolled] = useState(false);
  const cursorRef = useRef<HTMLDivElement>(null);
  const ringRef = useRef<HTMLDivElement>(null);
  const genBarRef = useRef<HTMLDivElement>(null);
  const mx = useRef(0), my = useRef(0), rx = useRef(0), ry = useRef(0);

  useEffect(() => {
    fetch(`${BASE_URL}/api/cms/content`).then(r => r.json()).then(setContent).catch(() => {});
  }, []);

  useEffect(() => {
    const move = (e: MouseEvent) => { mx.current = e.clientX; my.current = e.clientY; };
    document.addEventListener("mousemove", move);
    let raf: number;
    const anim = () => {
      if (cursorRef.current) { cursorRef.current.style.left = (mx.current - 4) + "px"; cursorRef.current.style.top = (my.current - 4) + "px"; }
      if (ringRef.current) { rx.current += (mx.current - rx.current) * 0.12; ry.current += (my.current - ry.current) * 0.12; ringRef.current.style.left = (rx.current - 16) + "px"; ringRef.current.style.top = (ry.current - 16) + "px"; }
      raf = requestAnimationFrame(anim);
    };
    anim();
    return () => { document.removeEventListener("mousemove", move); cancelAnimationFrame(raf); };
  }, []);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 40);
    window.addEventListener("scroll", onScroll);
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    const reveals = document.querySelectorAll(".l-reveal");
    const obs = new IntersectionObserver(entries => { entries.forEach(e => { if (e.isIntersecting) e.target.classList.add("l-visible"); }); }, { threshold: 0.1, rootMargin: "0px 0px -40px 0px" });
    reveals.forEach(el => obs.observe(el));
    return () => obs.disconnect();
  }, [content]);

  useEffect(() => {
    if (!genBarRef.current) return;
    const obs = new IntersectionObserver(entries => { entries.forEach(e => { if (e.isIntersecting && genBarRef.current) setTimeout(() => { if (genBarRef.current) genBarRef.current.style.width = "78%"; }, 500); }); }, { threshold: 0.5 });
    obs.observe(genBarRef.current);
    return () => obs.disconnect();
  }, [content]);

  const scrollTo = (href: string) => {
    if (href.startsWith("#")) { const el = document.querySelector(href); if (el) el.scrollIntoView({ behavior: "smooth" }); }
  };

  if (!content) {
    return (
      <div className="l-loading">
        <div className="l-loader"></div>
      </div>
    );
  }

  const hLines = content.hero.headline.split("\n");

  return (
    <div className="l-root">
      <div className="l-cursor" ref={cursorRef}></div>
      <div className="l-cursor-ring" ref={ringRef}></div>

      {/* NAV */}
      <nav className={`l-nav${scrolled ? " l-nav-scrolled" : ""}`}>
        <a href="#" className="l-nav-logo" onClick={e => { e.preventDefault(); window.scrollTo({ top: 0, behavior: "smooth" }); }}>
          <div className="l-nav-gem">{content.site.logo.value}</div>
          <div className="l-nav-logo-text">Shopify<em>AI</em></div>
        </a>
        <ul className="l-nav-links">
          {content.nav.links.map(l => (
            <li key={l.id}><a href={l.href} onClick={e => { e.preventDefault(); scrollTo(l.href); }}>{l.label}</a></li>
          ))}
        </ul>
        <div className="l-nav-ctas">
          <Link href="/login" className="l-btn-ghost">{content.nav.ctaSecondary.label}</Link>
          <a href={content.nav.ctaPrimary.href} onClick={e => { e.preventDefault(); scrollTo(content.nav.ctaPrimary.href); }} className="l-btn-gold">{content.nav.ctaPrimary.label}</a>
        </div>
      </nav>

      {/* HERO */}
      <section className="l-hero">
        <div className="l-hero-grid"></div>
        <div className="l-hero-glow"></div>
        <div className="l-hero-glow2"></div>
        <div className="l-hero-glow3"></div>
        <div className="l-orb" style={{ width: 180, height: 180, top: "15%", left: "5%", animationDuration: "18s", background: "radial-gradient(circle,rgba(200,168,75,0.04),transparent)" }}></div>
        <div className="l-orb" style={{ width: 120, height: 120, top: "70%", right: "8%", animationDuration: "22s", animationDelay: "-8s", background: "radial-gradient(circle,rgba(45,212,159,0.03),transparent)" }}></div>
        <div className="l-orb" style={{ width: 200, height: 200, bottom: "20%", left: "15%", animationDuration: "26s", animationDelay: "-12s", background: "radial-gradient(circle,rgba(74,158,221,0.03),transparent)" }}></div>

        <div className="l-hero-content">
          {content.hero.pill.visible && (
            <div className="l-hero-pill">
              <div className="l-pill-dot"></div>
              {content.hero.pill.text}
            </div>
          )}
          <h1 className="l-hero-h1">
            {hLines.map((line, i) => (
              <span key={i} className={i > 0 ? "l-block" : undefined}>
                {line.includes(content.hero.headlineHighlight)
                  ? line.split(content.hero.headlineHighlight).flatMap((part, pi, arr) =>
                      pi < arr.length - 1 ? [part, <span key={pi}>{content.hero.headlineHighlight}</span>] : [part]
                    )
                  : line
                }
              </span>
            ))}
          </h1>
          <p className="l-hero-sub">{content.hero.subheadline}</p>
          <div className="l-hero-ctas">
            <a href={content.hero.ctaPrimary.href} onClick={e => { e.preventDefault(); scrollTo(content.hero.ctaPrimary.href); }} className="l-btn-primary">{content.hero.ctaPrimary.label}</a>
            <a href={content.hero.ctaSecondary.href} onClick={e => { e.preventDefault(); scrollTo(content.hero.ctaSecondary.href); }} className="l-btn-secondary">{content.hero.ctaSecondary.label}</a>
          </div>
          <div className="l-hero-trust">
            {content.hero.trustItems.map((item, i) => (
              <div key={i} className="l-trust-item"><div className="l-trust-check">✓</div>{item}</div>
            ))}
          </div>
        </div>

        {/* Dashboard Preview */}
        <div className="l-preview l-reveal">
          <div className="l-preview-glow"></div>
          <div className="l-preview-frame">
            <div className="l-preview-topbar">
              <div className="l-preview-dots">
                <div className="l-dot" style={{ background: "#ff5f57" }}></div>
                <div className="l-dot" style={{ background: "#ffbd2e" }}></div>
                <div className="l-dot" style={{ background: "#28ca41" }}></div>
              </div>
              <div className="l-preview-url">app.shopifyai.pro/admin — Moda Urbana</div>
              <div className="l-preview-status"><div className="l-status-dot"></div>6 motores activos</div>
            </div>
            <div className="l-preview-body">
              <div className="l-preview-sb">
                <div className="l-psb-logo"><div className="l-psb-gem"></div><div className="l-psb-name">ShopifyAI</div></div>
                {["Overview", "Productos", "Imágenes IA", "Pricing + P&L", "SEO Técnico", "A/B Tests", "Reportes"].map((item, i) => (
                  <div key={i} className={`l-psb-item${i === 0 ? " l-psb-on" : ""}`}><div className="l-psb-dot"></div>{item}</div>
                ))}
              </div>
              <div className="l-preview-main">
                <div className="l-pm-row">
                  {[{ lbl: "Revenue", val: "€32.4K", ch: "↑ 22%", color: "#e6c668" }, { lbl: "Conversión", val: "4.2%", ch: "↑ 0.9pp", color: "#2dd49f" }, { lbl: "Margen", val: "61%", ch: "↑ 8pts", color: "#f2f0ff" }, { lbl: "SEO Score", val: "88", ch: "↑ 23pts", color: "#4a9edd" }].map((c, i) => (
                    <div key={i} className="l-pm-card">
                      <div className="l-pm-lbl">{c.lbl}</div>
                      <div className="l-pm-val" style={{ color: c.color }}>{c.val}</div>
                      <div className="l-pm-ch" style={{ color: c.color }}>{c.ch}</div>
                    </div>
                  ))}
                </div>
                <div className="l-pm-row2">
                  <div className="l-pm-card2">
                    <div className="l-pm-c2-title">Salud de tiendas</div>
                    {[{ name: "Moda Urbana", v: 88, color: "#2dd49f", w: "88%" }, { name: "TechGadgets", v: 71, color: "#4a9edd", w: "71%" }, { name: "Casa & Arte", v: 42, color: "#e84558", w: "42%" }].map((s, i) => (
                      <div key={i}>
                        <div className="l-pm-bar-row"><span>{s.name}</span><span style={{ color: s.color }}>{s.v}</span></div>
                        <div className="l-pm-bar"><div className="l-pm-bar-f" style={{ width: s.w, background: `linear-gradient(90deg,${s.color},${s.color}88)` }}></div></div>
                      </div>
                    ))}
                  </div>
                  <div className="l-pm-card2">
                    <div className="l-pm-c2-title">Actividad reciente</div>
                    {[{ ico: "✓", bg: "rgba(45,212,159,.1)", color: "#2dd49f", txt: "A/B Test ganador · +28% conv." }, { ico: "★", bg: "rgba(200,168,75,.1)", color: "#e6c668", txt: "48 imágenes generadas · €13.44" }, { ico: "◎", bg: "rgba(74,158,221,.1)", color: "#4a9edd", txt: "Schema SEO · 234 productos" }].map((f, i) => (
                      <div key={i} className="l-feed-row">
                        <div className="l-feed-ico" style={{ background: f.bg, color: f.color }}>{f.ico}</div>
                        <div className="l-feed-txt">{f.txt}</div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* MARQUEE */}
      <div className="l-marquee-section">
        <p className="l-marquee-label">Tecnología que potencia cada tienda</p>
        <div className="l-marquee-track">
          {[["🛍️","Shopify Admin API"],["🤖","Claude AI by Anthropic"],["🎨","Replicate · flux-1.1-pro"],["🔍","Google Search Console"],["📊","Shopify Analytics"],["⚡","Shopify Flow"],["📧","Klaviyo Integration"],["💳","Stripe Billing"],["🔐","AES-256 Encryption"],["🛍️","Shopify Admin API"],["🤖","Claude AI by Anthropic"],["🎨","Replicate · flux-1.1-pro"],["🔍","Google Search Console"],["📊","Shopify Analytics"],["⚡","Shopify Flow"],["📧","Klaviyo Integration"],["💳","Stripe Billing"],["🔐","AES-256 Encryption"]].map(([icon, label], i) => (
            <span key={i} className="l-marquee-item"><span className="l-marquee-icon">{icon}</span>{label}</span>
          ))}
        </div>
      </div>

      {/* FEATURES */}
      <section id="features" className="l-section">
        <div className="l-features-inner">
          <div className="l-section-header l-reveal">
            <div className="l-pill">{content.features.pill}</div>
            <h2 className="l-h2">{content.features.headline.split(".")[0]}. <em>{content.features.headline.split(".").slice(1).join(".")}</em></h2>
            <p className="l-sub l-text-center l-mx-auto">{content.features.subheadline}</p>
          </div>
          <div className="l-features-grid l-reveal">
            {content.features.items.map(feat => (
              <div key={feat.id} className="l-feature-card">
                <div className="l-feature-num">{feat.num}</div>
                <div className="l-feature-icon" style={{ background: feat.iconBg }}>{feat.icon}</div>
                <div className="l-feature-title">{feat.title}</div>
                <div className="l-feature-desc">{feat.description}</div>
                <div className="l-feature-tags">{feat.tags.map((t, i) => <span key={i} className="l-feature-tag">{t}</span>)}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* STATS */}
      <div className="l-stats-section">
        <div className="l-stats-inner">
          {content.stats.map((s, i) => (
            <div key={s.id} className={`l-stat-item l-reveal${i > 0 ? ` l-delay-${i}` : ""}`}>
              <div className="l-stat-num">{s.num}</div>
              <div className="l-stat-label">{s.label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* HOW IT WORKS */}
      <section id="how" className="l-section">
        <div className="l-how-inner">
          <div className="l-reveal">
            <div className="l-pill">{content.how.pill}</div>
            <h2 className="l-h2">
              {content.how.headline.split("\n").map((line, i) => (
                <span key={i} className={i > 0 ? "l-block" : undefined}>
                  {line.includes(content.how.headlineHighlight)
                    ? line.split(content.how.headlineHighlight).flatMap((p, pi, arr) =>
                        pi < arr.length - 1 ? [p, <em key={pi}>{content.how.headlineHighlight}</em>] : [p]
                      )
                    : line
                  }
                </span>
              ))}
            </h2>
          </div>
          <div className="l-how-grid">
            <div className="l-how-steps l-reveal">
              {content.how.steps.map(step => (
                <div key={step.num} className="l-how-step">
                  <div className="l-how-step-num">{step.num}</div>
                  <div className="l-how-step-content">
                    <div className="l-how-step-title">{step.title}</div>
                    <div className="l-how-step-desc">{step.desc}</div>
                  </div>
                </div>
              ))}
            </div>
            <div className="l-how-visual l-reveal l-delay-1">
              {[
                { ico: "✓", bg: "rgba(45,212,159,.1)", color: "#2dd49f", title: "Auditoría completada", sub: "234 productos analizados · 12×F → acción urgente", barW: "88%", barColor: "linear-gradient(90deg,#2dd49f,#5ee8bc)" },
                { ico: "🎨", bg: "rgba(200,168,75,.1)", color: "#e6c668", title: "Imágenes generándose", sub: "flux-1.1-pro · 48/234 productos · ~€67", barW: "20%", barColor: "linear-gradient(90deg,#c8a84b,#e6c668)", barRef: true },
                { ico: "⚗️", bg: "rgba(74,158,221,.1)", color: "#4a9edd", title: "A/B Test activo", sub: "Bomber Hero · 342 visitas · 67% confianza", barW: "67%", barColor: "linear-gradient(90deg,#4a9edd,#7ec0f0)" },
              ].map((c, i) => (
                <div key={i} className="l-how-card">
                  <div className="l-how-card-h">
                    <div className="l-how-card-ico" style={{ background: c.bg, color: c.color }}>{c.ico}</div>
                    <div><div className="l-how-card-title">{c.title}</div><div className="l-how-card-sub">{c.sub}</div></div>
                  </div>
                  <div className="l-how-bar"><div className={`l-how-bar-f`} ref={c.barRef ? genBarRef : undefined} style={{ width: c.barW, background: c.barColor, transition: "width 3s ease" }}></div></div>
                </div>
              ))}
              <div className="l-how-card l-how-card-green">
                <div className="l-how-card-h">
                  <div className="l-how-card-ico" style={{ background: "rgba(45,212,159,.1)", color: "#2dd49f" }}>💰</div>
                  <div><div className="l-how-card-title">Impacto estimado</div><div className="l-how-card-sub" style={{ color: "#2dd49f" }}>+€8,400/mes proyectados este mes</div></div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* PRICING */}
      <section id="pricing" className="l-section">
        <div className="l-pricing-inner">
          <div className="l-section-header l-reveal">
            <div className="l-pill">{content.pricing.pill}</div>
            <h2 className="l-h2">{content.pricing.headline.split(".")[0]}. <em>{content.pricing.headline.split(".").slice(1).join(".")}</em></h2>
            <p className="l-sub l-text-center l-mx-auto">{content.pricing.subheadline}</p>
          </div>
          <div className="l-pricing-grid">
            {content.pricing.plans.map((plan, i) => (
              <div key={plan.id} className={`l-pricing-card l-reveal${i > 0 ? ` l-delay-${i}` : ""}${plan.featured ? " l-pricing-featured" : ""}`}>
                {plan.badge && <div className="l-pricing-badge">{plan.badge}</div>}
                <div className="l-pricing-plan">{plan.name}</div>
                <div className="l-pricing-price"><span>{plan.currency}</span>{plan.price}</div>
                <div className="l-pricing-period">{plan.period}</div>
                <div className="l-pricing-divider"></div>
                <ul className="l-pricing-features">
                  {plan.features.map((f, fi) => (
                    <li key={fi} className="l-pricing-feature">
                      <div className={f.included ? "l-pricing-check" : "l-pricing-x"}>{f.included ? "✓" : "✕"}</div>
                      <span style={f.included ? undefined : { color: "var(--l-t3)" }}>{f.text}</span>
                    </li>
                  ))}
                </ul>
                <button className={`l-pricing-cta ${plan.cta.style}`}>{plan.cta.label}</button>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* TESTIMONIALS */}
      <section id="testimonials" className="l-section">
        <div className="l-testi-inner">
          <div className="l-section-header l-reveal">
            <div className="l-pill">{content.testimonials.pill}</div>
            <h2 className="l-h2">
              {content.testimonials.headline.includes(content.testimonials.headlineHighlight)
                ? content.testimonials.headline.split(content.testimonials.headlineHighlight).flatMap((p, i, arr) =>
                    i < arr.length - 1 ? [p, <em key={i}>{content.testimonials.headlineHighlight}</em>] : [p]
                  )
                : content.testimonials.headline
              }
            </h2>
          </div>
          <div className="l-testi-grid">
            {content.testimonials.items.map((t, i) => (
              <div key={t.id} className={`l-testi-card l-reveal${i > 0 ? ` l-delay-${i}` : ""}`}>
                <div className="l-testi-stars">{Array.from({ length: t.stars }).map((_, si) => <span key={si} className="l-star">★</span>)}</div>
                <div className="l-testi-quote">"</div>
                <p className="l-testi-text">{t.text}</p>
                <div className="l-testi-metric">{t.metric}</div>
                <div className="l-testi-author">
                  <div className="l-testi-avatar" style={{ background: t.avatarColor, color: t.avatarTextColor }}>{t.initials}</div>
                  <div><div className="l-testi-name">{t.author}</div><div className="l-testi-role">{t.role}</div></div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA FINAL */}
      <section id="cta" className="l-section l-cta-section">
        <div className="l-cta-bg"></div>
        <div className="l-cta-content l-reveal">
          <div className="l-pill" style={{ margin: "0 auto 24px" }}>{content.cta.pill}</div>
          <h2 className="l-cta-h2">
            {content.cta.headline.split("\n").map((line, i) => (
              <span key={i} className={i > 0 ? "l-block" : undefined}>
                {line.includes(content.cta.headlineHighlight)
                  ? line.split(content.cta.headlineHighlight).flatMap((p, pi, arr) =>
                      pi < arr.length - 1 ? [p, <em key={pi}>{content.cta.headlineHighlight}</em>] : [p]
                    )
                  : line
                }
              </span>
            ))}
          </h2>
          <p className="l-cta-sub">{content.cta.subheadline.split("\n").map((l, i) => <span key={i} className={i > 0 ? "l-block" : undefined}>{l}</span>)}</p>
          <div className="l-cta-form">
            <input type="email" className="l-cta-input" placeholder={content.cta.placeholder} />
            <Link href="/login" className="l-btn-primary" style={{ padding: "13px 24px", fontSize: 14 }}>{content.cta.buttonLabel}</Link>
          </div>
          <p className="l-cta-fine">{content.cta.finePrint}</p>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="l-footer">
        <div className="l-footer-top">
          <div>
            <a href="#" className="l-nav-logo" onClick={e => { e.preventDefault(); window.scrollTo({ top: 0, behavior: "smooth" }); }} style={{ display: "inline-flex", marginBottom: 14 }}>
              <div className="l-nav-gem">{content.site.logo.value}</div>
              <div className="l-nav-logo-text">Shopify<em>AI</em></div>
            </a>
            <p className="l-footer-desc">{content.footer.tagline}</p>
          </div>
          {content.footer.columns.map((col, i) => (
            <div key={i}>
              <div className="l-footer-col-title">{col.title}</div>
              <ul className="l-footer-links">
                {col.links.map((l, li) => <li key={li}><a href={l.href}>{l.label}</a></li>)}
              </ul>
            </div>
          ))}
        </div>
        <div className="l-footer-bottom">
          <div className="l-footer-copy">{content.footer.copyright}</div>
          <div className="l-footer-badges">{content.footer.badges.map((b, i) => <span key={i} className="l-footer-badge">{b}</span>)}</div>
        </div>
      </footer>
    </div>
  );
}
