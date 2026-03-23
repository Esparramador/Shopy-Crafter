import { useEffect, useRef, useState, useCallback } from "react";
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

const FP_SECTIONS = [
  { id: "fp-hero",    nav: "Inicio" },
  { id: "fp-engines", nav: "Motores" },
  { id: "fp-demo",   nav: "Demo" },
  { id: "fp-results", nav: "Resultados" },
  { id: "fp-pricing", nav: "Precios" },
  { id: "fp-clients", nav: "Clientes" },
  { id: "fp-cta",    nav: "Empezar" },
];

function AnimatedCounter({ target, duration = 2000 }: { target: number; duration?: number }) {
  const [val, setVal] = useState(0);
  const [started, setStarted] = useState(false);
  const ref = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const obs = new IntersectionObserver(entries => {
      if (entries[0].isIntersecting && !started) {
        setStarted(true);
        const start = Date.now();
        const tick = () => {
          const elapsed = Date.now() - start;
          const progress = Math.min(elapsed / duration, 1);
          const eased = 1 - Math.pow(1 - progress, 3);
          setVal(Math.round(target * eased));
          if (progress < 1) requestAnimationFrame(tick);
        };
        requestAnimationFrame(tick);
      }
    }, { threshold: 0.5 });
    if (ref.current) obs.observe(ref.current);
    return () => obs.disconnect();
  }, [target, duration, started]);

  return <span ref={ref}>{val}</span>;
}

export default function Landing() {
  const [content, setContent] = useState<CMSContent | null>(null);
  const [currentSection, setCurrentSection] = useState(0);
  const [activeEngine, setActiveEngine] = useState(0);
  const [activeTestimonial, setActiveTestimonial] = useState(0);
  const [animatedSections, setAnimatedSections] = useState<Set<string>>(new Set());
  const cursorRef = useRef<HTMLDivElement>(null);
  const ringRef = useRef<HTMLDivElement>(null);
  const fpRef = useRef<HTMLDivElement>(null);
  const mx = useRef(0), my = useRef(0), rx = useRef(0), ry = useRef(0);
  const currentRef = useRef(0);

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

  const goToSection = useCallback((index: number) => {
    const container = fpRef.current;
    if (!container) return;
    currentRef.current = index;
    setCurrentSection(index);
    if (window.innerWidth <= 768) {
      // Mobile: sections are auto-height, scroll the body via scrollIntoView
      const sections = container.querySelectorAll<HTMLElement>(".fp-section");
      const section = sections[index];
      if (section) section.scrollIntoView({ behavior: "smooth", block: "start" });
    } else {
      // Desktop: fp-container is fixed-height scroll box, use direct scrollTo
      container.scrollTo({ top: index * container.clientHeight, behavior: "smooth" });
    }
  }, []);

  useEffect(() => {
    const container = fpRef.current;
    if (!container) return;
    const sections = [...container.querySelectorAll<HTMLElement>(".fp-section")];

    const obs = new IntersectionObserver(entries => {
      entries.forEach(e => {
        if (e.isIntersecting && (e.intersectionRatio ?? 0) > 0.3) {
          const idx = sections.indexOf(e.target as HTMLElement);
          if (idx !== -1) {
            currentRef.current = idx;
            setCurrentSection(idx);
            setAnimatedSections(prev => new Set([...prev, e.target.id]));
          }
        }
      });
    }, { threshold: [0.3, 0.5], root: container });

    sections.forEach(s => obs.observe(s));

    // Trigger first section immediately — don't wait for scroll
    const firstId = sections[0]?.id;
    if (firstId) {
      setAnimatedSections(prev => new Set([...prev, firstId]));
      setCurrentSection(0);
      currentRef.current = 0;
    }

    return () => obs.disconnect();
  }, [content]);

  // Lock body scroll ONLY on desktop — mobile uses native scroll
  useEffect(() => {
    const isMobile = () => window.innerWidth <= 768;
    if (isMobile()) return;
    const prev = document.body.style.overflow;
    const prevHtml = document.documentElement.style.overflow;
    document.body.style.overflow = "hidden";
    document.documentElement.style.overflow = "hidden";
    const onResize = () => {
      if (isMobile()) {
        document.body.style.overflow = prev;
        document.documentElement.style.overflow = prevHtml;
      } else {
        document.body.style.overflow = "hidden";
        document.documentElement.style.overflow = "hidden";
      }
    };
    window.addEventListener("resize", onResize);
    return () => {
      window.removeEventListener("resize", onResize);
      document.body.style.overflow = prev;
      document.documentElement.style.overflow = prevHtml;
    };
  }, []);

  // Wheel → section scroll (desktop only, re-runs when content loads)
  useEffect(() => {
    if (window.innerWidth <= 768) return;
    const container = fpRef.current;
    if (!container) return;
    let lastWheel = 0;
    const THROTTLE = 900;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const now = Date.now();
      if (now - lastWheel < THROTTLE) return;
      lastWheel = now;
      if (e.deltaY > 0) {
        goToSection(Math.min(currentRef.current + 1, FP_SECTIONS.length - 1));
      } else if (e.deltaY < 0) {
        goToSection(Math.max(currentRef.current - 1, 0));
      }
    };
    container.addEventListener("wheel", onWheel, { passive: false });
    return () => container.removeEventListener("wheel", onWheel);
  }, [goToSection, content]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowDown" || e.key === "PageDown") {
        e.preventDefault();
        goToSection(Math.min(currentRef.current + 1, FP_SECTIONS.length - 1));
      }
      if (e.key === "ArrowUp" || e.key === "PageUp") {
        e.preventDefault();
        goToSection(Math.max(currentRef.current - 1, 0));
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [goToSection]);

  useEffect(() => {
    if (!content) return;
    const timer = setInterval(() => {
      setActiveTestimonial(t => (t + 1) % (content.testimonials.items.length || 1));
    }, 4500);
    return () => clearInterval(timer);
  }, [content]);

  const pad = (n: number) => String(n).padStart(2, "0");
  const isAnimated = (id: string) => animatedSections.has(id);

  if (!content) {
    return (
      <div className="l-loading">
        <div className="l-loader"></div>
      </div>
    );
  }

  const hLines = content.hero.headline.split("\n");
  const progressPct = FP_SECTIONS.length > 1 ? (currentSection / (FP_SECTIONS.length - 1)) * 100 : 0;

  return (
    <div className="l-root">
      <div className="l-cursor" ref={cursorRef}></div>
      <div className="l-cursor-ring" ref={ringRef}></div>

      {/* ── FIXED NAV ── */}
      <nav className="l-nav l-nav-fp">
        <a href="#" className="l-nav-logo" onClick={e => { e.preventDefault(); goToSection(0); }}>
          <div className="l-nav-gem">{content.site.logo.value}</div>
          <div className="l-nav-logo-text">Shopify<em>AI</em></div>
        </a>
        <ul className="l-nav-links">
          {FP_SECTIONS.map((sec, i) => (
            <li key={sec.id}>
              <a href={`#${sec.id}`} className={currentSection === i ? "l-nav-active" : ""} onClick={e => { e.preventDefault(); goToSection(i); }}>{sec.nav}</a>
            </li>
          ))}
        </ul>
        <div className="l-nav-ctas">
          <Link href="/login" className="l-btn-ghost">{content.nav.ctaSecondary.label}</Link>
          <a href="#fp-pricing" className="l-btn-gold" onClick={e => { e.preventDefault(); goToSection(4); }}>{content.nav.ctaPrimary.label}</a>
        </div>
      </nav>

      {/* ── SIDE NAV DOTS (right) ── */}
      <nav className="fp-sidenav" aria-label="Secciones">
        {FP_SECTIONS.map((sec, i) => (
          <button key={sec.id} className={`fp-nav-dot${currentSection === i ? " active" : ""}`} onClick={() => goToSection(i)} title={sec.nav}>
            <span className="fp-nav-dot-label">{sec.nav}</span>
            <div className="fp-nav-dot-circle"></div>
          </button>
        ))}
      </nav>

      {/* ── PROGRESS BAR (left) ── */}
      <div className="fp-progress">
        <div className="fp-progress-fill" style={{ height: `${progressPct}%` }}></div>
      </div>

      {/* ── SECTION COUNTER (bottom center) ── */}
      <div className="fp-counter">
        <span className="fp-counter-current">{pad(currentSection + 1)}</span>
        <span className="fp-counter-sep">/</span>
        <span>{pad(FP_SECTIONS.length)}</span>
      </div>

      {/* ── FULLPAGE CONTAINER ── */}
      <div className="fp-container" ref={fpRef} id="fullpage">

        {/* ══════════════════════════════════════
            SECTION 01 — HERO
        ══════════════════════════════════════ */}
        <section className="fp-section" id="fp-hero" data-nav="Inicio">
          <div className="fp-bg">
            <div className="l-hero-grid"></div>
            <div className="l-hero-glow"></div>
            <div className="l-hero-glow2"></div>
            <div className="l-hero-glow3"></div>
            <div className="fp-particles">
              {Array.from({ length: 20 }).map((_, i) => (
                <div key={i} className="fp-particle" style={{
                  left: `${Math.random() * 100}%`,
                  width: `${2 + Math.random() * 3}px`,
                  height: `${2 + Math.random() * 3}px`,
                  animationDuration: `${6 + Math.random() * 8}s`,
                  animationDelay: `${Math.random() * 8}s`,
                  opacity: 0.3 + Math.random() * 0.4,
                }}></div>
              ))}
            </div>
          </div>
          <div className="fp-bg-overlay" style={{ background: "rgba(8,8,16,0.55)" }}></div>

          <div className="fp-content fp-hero-layout">
            <div className="fp-hero-left">
              {content.hero.pill.visible && (
                <div className={`l-hero-pill ${!isAnimated("fp-hero") ? "fp-animate" : "fp-animated"}`} style={{ animationDelay: "0s" }}>
                  <div className="l-pill-dot"></div>
                  {content.hero.pill.text}
                </div>
              )}
              <h1 className={`l-hero-h1 ${!isAnimated("fp-hero") ? "fp-animate" : "fp-animated"}`} style={{ animationDelay: "0.1s" }}>
                {hLines.map((line, i) => (
                  <span key={i} className={i > 0 ? "l-block" : undefined}>
                    {line.includes(content.hero.headlineHighlight)
                      ? line.split(content.hero.headlineHighlight).flatMap((part, pi, arr) =>
                          pi < arr.length - 1 ? [part, <span key={pi}>{content.hero.headlineHighlight}</span>] : [part]
                        )
                      : line}
                  </span>
                ))}
              </h1>
              <p className={`l-hero-sub ${!isAnimated("fp-hero") ? "fp-animate" : "fp-animated"}`} style={{ animationDelay: "0.22s" }}>{content.hero.subheadline}</p>
              <div className={`l-hero-ctas ${!isAnimated("fp-hero") ? "fp-animate" : "fp-animated"}`} style={{ animationDelay: "0.34s" }}>
                <a href="#fp-pricing" className="l-btn-primary" onClick={e => { e.preventDefault(); goToSection(4); }}>{content.hero.ctaPrimary.label}</a>
                <a href="#fp-demo" className="l-btn-secondary" onClick={e => { e.preventDefault(); goToSection(2); }}>{content.hero.ctaSecondary.label}</a>
              </div>
              <div className={`l-hero-trust ${!isAnimated("fp-hero") ? "fp-animate" : "fp-animated"}`} style={{ animationDelay: "0.46s" }}>
                {content.hero.trustItems.map((item, i) => (
                  <div key={i} className="l-trust-item"><div className="l-trust-check">✓</div>{item}</div>
                ))}
              </div>
            </div>

            <div className={`fp-hero-right ${!isAnimated("fp-hero") ? "fp-animate" : "fp-animated"}`} style={{ animationDelay: "0.2s" }}>
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
                    {["Overview", "Productos", "Imágenes IA", "Pricing + P&L", "SEO Técnico", "A/B Tests"].map((item, i) => (
                      <div key={i} className={`l-psb-item${i === 0 ? " l-psb-on" : ""}`}><div className="l-psb-dot"></div>{item}</div>
                    ))}
                  </div>
                  <div className="l-preview-main">
                    <div className="l-pm-row">
                      {[{ lbl: "Revenue", val: "€32.4K", ch: "↑ 22%", color: "#e6c668" }, { lbl: "Conversión", val: "4.2%", ch: "↑ 0.9pp", color: "#2dd49f" }, { lbl: "Margen", val: "61%", ch: "↑ 8pts", color: "#f2f0ff" }, { lbl: "SEO", val: "88", ch: "↑ 23pts", color: "#4a9edd" }].map((c, i) => (
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
                        {[{ ico: "✓", bg: "rgba(45,212,159,.1)", color: "#2dd49f", txt: "A/B Test ganador · +28% conv." }, { ico: "★", bg: "rgba(200,168,75,.1)", color: "#e6c668", txt: "48 imágenes · €13.44" }, { ico: "◎", bg: "rgba(74,158,221,.1)", color: "#4a9edd", txt: "Schema SEO · 234 productos" }].map((f, i) => (
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
          </div>

          <div className="fp-scroll-hint">
            <div className="fp-scroll-hint-text">Desliza para explorar</div>
            <div className="fp-scroll-hint-arrow">↓</div>
          </div>
        </section>

        {/* ══════════════════════════════════════
            SECTION 02 — ENGINES (6 motors)
        ══════════════════════════════════════ */}
        <section className="fp-section fp-section-dark" id="fp-engines" data-nav="Motores">
          <div className="fp-bg-solid"></div>
          <div className="fp-content fp-engines-layout">
            <div className={`fp-section-header ${!isAnimated("fp-engines") ? "fp-animate" : "fp-animated"}`} style={{ animationDelay: "0s" }}>
              <div className="l-pill">{content.features.pill}</div>
              <h2 className="l-h2">{content.features.headline.split(".")[0]}. <em>{content.features.headline.split(".").slice(1).join(".")}</em></h2>
              <p className="l-sub">{content.features.subheadline}</p>
            </div>

            <div className={`fp-engine-tabs ${!isAnimated("fp-engines") ? "fp-animate" : "fp-animated"}`} style={{ animationDelay: "0.1s" }}>
              {content.features.items.map((feat, i) => (
                <button key={feat.id} className={`fp-etab${activeEngine === i ? " active" : ""}`} onClick={() => setActiveEngine(i)}>
                  <span className="fp-etab-num">{feat.num}</span>
                  <span className="fp-etab-icon">{feat.icon}</span>
                  <span className="fp-etab-name">{feat.title.split(" ")[0]}</span>
                </button>
              ))}
            </div>

            {content.features.items[activeEngine] && (
              <div className={`fp-engine-panel${!isAnimated("fp-engines") ? " fp-animate" : " fp-animated"}`} style={{ animationDelay: "0.2s" }} key={activeEngine}>
                <div className="fp-engine-icon-wrap">
                  <div className="fp-engine-icon-large" style={{ background: content.features.items[activeEngine].iconBg }}>
                    {content.features.items[activeEngine].icon}
                  </div>
                  <div className="fp-engine-num-badge">{content.features.items[activeEngine].num}</div>
                </div>
                <div className="fp-engine-info">
                  <h3 className="fp-engine-title">{content.features.items[activeEngine].title}</h3>
                  <p className="fp-engine-desc">{content.features.items[activeEngine].description}</p>
                  <div className="fp-engine-tags">
                    {content.features.items[activeEngine].tags.map((tag, ti) => (
                      <span key={ti} className="fp-engine-tag">{tag}</span>
                    ))}
                  </div>
                </div>
                <div className="fp-engine-stats">
                  {[
                    { label: "Precisión", value: "94%", color: "var(--l-jade)" },
                    { label: "Velocidad", value: "<2s", color: "var(--l-gold)" },
                    { label: "Uptime", value: "99.9%", color: "var(--l-sky)" },
                  ].map((stat, si) => (
                    <div key={si} className="fp-engine-stat">
                      <div className="fp-engine-stat-val" style={{ color: stat.color }}>{stat.value}</div>
                      <div className="fp-engine-stat-lbl">{stat.label}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </section>

        {/* ══════════════════════════════════════
            SECTION 03 — DEMO (split layout)
        ══════════════════════════════════════ */}
        <section className="fp-section" id="fp-demo" data-nav="Demo">
          <div className="fp-bg">
            <div className="l-hero-grid" style={{ opacity: 0.3 }}></div>
          </div>
          <div className="fp-bg-overlay" style={{ background: "rgba(8,8,16,0.8)" }}></div>
          <div className="fp-content fp-split-layout">
            <div className={`fp-split-left ${!isAnimated("fp-demo") ? "fp-animate" : "fp-animated"}`} style={{ animationDelay: "0s" }}>
              <div className="l-pill">{content.how.pill}</div>
              <h2 className="l-h2">
                {content.how.headline.split("\n").map((line, i) => (
                  <span key={i} className={i > 0 ? "l-block" : undefined}>
                    {line.includes(content.how.headlineHighlight)
                      ? line.split(content.how.headlineHighlight).flatMap((p, pi, arr) =>
                          pi < arr.length - 1 ? [p, <em key={pi}>{content.how.headlineHighlight}</em>] : [p]
                        )
                      : line}
                  </span>
                ))}
              </h2>
              <div className="fp-demo-steps">
                {content.how.steps.map((step, si) => (
                  <div key={step.num} className="fp-demo-step">
                    <div className="fp-demo-step-num">{step.num}</div>
                    <div className="fp-demo-step-content">
                      <div className="fp-demo-step-title">{step.title}</div>
                      <div className="fp-demo-step-desc">{step.desc}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <div className={`fp-split-right ${!isAnimated("fp-demo") ? "fp-animate" : "fp-animated"}`} style={{ animationDelay: "0.15s" }}>
              {[
                { ico: "✓", bg: "rgba(45,212,159,.1)", color: "#2dd49f", title: "Auditoría completada", sub: "234 productos analizados · 12 acciones urgentes", barW: "88%", barColor: "linear-gradient(90deg,#2dd49f,#5ee8bc)" },
                { ico: "🎨", bg: "rgba(200,168,75,.1)", color: "#e6c668", title: "Imágenes generándose", sub: "flux-1.1-pro · 48/234 productos", barW: "21%", barColor: "linear-gradient(90deg,#c8a84b,#e6c668)", animate: true },
                { ico: "⚗️", bg: "rgba(74,158,221,.1)", color: "#4a9edd", title: "A/B Test activo", sub: "Bomber Hero · 342 visitas · 67% confianza", barW: "67%", barColor: "linear-gradient(90deg,#4a9edd,#7ec0f0)" },
              ].map((c, i) => (
                <div key={i} className="l-how-card">
                  <div className="l-how-card-h">
                    <div className="l-how-card-ico" style={{ background: c.bg, color: c.color }}>{c.ico}</div>
                    <div><div className="l-how-card-title">{c.title}</div><div className="l-how-card-sub">{c.sub}</div></div>
                  </div>
                  <div className="l-how-bar"><div className="l-how-bar-f" style={{ width: c.barW, background: c.barColor, transition: "width 3s ease" }}></div></div>
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
        </section>

        {/* ══════════════════════════════════════
            SECTION 04 — RESULTS (counters)
        ══════════════════════════════════════ */}
        <section className="fp-section fp-results-section" id="fp-results" data-nav="Resultados">
          <div className="fp-bg">
            <div className="fp-results-bg-pattern"></div>
          </div>
          <div className="fp-bg-overlay" style={{ background: "rgba(8,8,16,0.72)" }}></div>
          <div className="fp-content fp-results-layout">
            <div className={`fp-section-header ${!isAnimated("fp-results") ? "fp-animate" : "fp-animated"}`} style={{ animationDelay: "0s" }}>
              <div className="l-pill">Resultados probados</div>
              <h2 className="l-h2">Números que <em>hablan solos</em></h2>
            </div>
            <div className={`fp-stats-grid ${!isAnimated("fp-results") ? "fp-animate" : "fp-animated"}`} style={{ animationDelay: "0.1s" }}>
              {[
                { prefix: "+", num: 234, suffix: "%", label: "Incremento medio en conversión", color: "var(--l-jade)" },
                { prefix: "€", num: 8400, suffix: "/mes", label: "Ingresos adicionales promedio", color: "var(--l-gold)" },
                { prefix: "", num: 99, suffix: ".9%", label: "Uptime garantizado de la plataforma", color: "var(--l-sky)" },
                { prefix: "", num: 6, suffix: " motores", label: "Optimizando tu tienda 24/7", color: "#8b5cf6" },
              ].map((stat, i) => (
                <div key={i} className="fp-stat-card">
                  <div className="fp-stat-val" style={{ color: stat.color }}>
                    {stat.prefix}<AnimatedCounter target={stat.num} />{stat.suffix}
                  </div>
                  <div className="fp-stat-label">{stat.label}</div>
                </div>
              ))}
            </div>
            <div className={`fp-tech-logos ${!isAnimated("fp-results") ? "fp-animate" : "fp-animated"}`} style={{ animationDelay: "0.25s" }}>
              {[["🛍️","Shopify API"],["🤖","Claude AI"],["🎨","Replicate"],["🔍","GSC"],["📧","Klaviyo"],["🔐","AES-256"],["⚡","Shopify Flow"]].map(([icon, label], i) => (
                <div key={i} className="fp-tech-badge">
                  <span>{icon}</span>
                  <span>{label}</span>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ══════════════════════════════════════
            SECTION 05 — PRICING (3 cards)
        ══════════════════════════════════════ */}
        <section className="fp-section fp-section-dark" id="fp-pricing" data-nav="Precios">
          <div className="fp-bg-solid"></div>
          <div className="fp-content fp-pricing-layout">
            <div className={`fp-section-header ${!isAnimated("fp-pricing") ? "fp-animate" : "fp-animated"}`} style={{ animationDelay: "0s" }}>
              <div className="l-pill">{content.pricing.pill}</div>
              <h2 className="l-h2">{content.pricing.headline.split(".")[0]}. <em>{content.pricing.headline.split(".").slice(1).join(".")}</em></h2>
              <p className="l-sub">{content.pricing.subheadline}</p>
            </div>
            <div className={`fp-pricing-row ${!isAnimated("fp-pricing") ? "fp-animate" : "fp-animated"}`} style={{ animationDelay: "0.1s" }}>
              {content.pricing.plans.map(plan => (
                <div key={plan.id} className={`l-pricing-card fp-pricing-card${plan.featured ? " l-pricing-featured" : ""}`}>
                  {plan.badge && <div className="l-pricing-badge">{plan.badge}</div>}
                  <div className="l-pricing-plan">{plan.name}</div>
                  <div className="l-pricing-price"><span>{plan.currency}</span>{plan.price}</div>
                  <div className="l-pricing-period">{plan.period}</div>
                  <div className="l-pricing-divider"></div>
                  <ul className="l-pricing-features">
                    {plan.features.slice(0, 6).map((f, fi) => (
                      <li key={fi} className="l-pricing-feature">
                        <div className={f.included ? "l-pricing-check" : "l-pricing-x"}>{f.included ? "✓" : "✕"}</div>
                        <span style={f.included ? undefined : { color: "var(--l-t3)", fontSize: 12 }}>{f.text}</span>
                      </li>
                    ))}
                  </ul>
                  <Link href="/login" className={`l-pricing-cta ${plan.cta.style}`}>{plan.cta.label}</Link>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ══════════════════════════════════════
            SECTION 06 — CLIENTS (testimonials)
        ══════════════════════════════════════ */}
        <section className="fp-section" id="fp-clients" data-nav="Clientes">
          <div className="fp-bg">
            <div className="l-hero-grid" style={{ opacity: 0.2 }}></div>
          </div>
          <div className="fp-bg-overlay" style={{ background: "rgba(8,8,16,0.75)" }}></div>
          <div className="fp-content fp-clients-layout">
            <div className={`fp-section-header ${!isAnimated("fp-clients") ? "fp-animate" : "fp-animated"}`} style={{ animationDelay: "0s" }}>
              <div className="l-pill">{content.testimonials.pill}</div>
              <h2 className="l-h2">
                {content.testimonials.headline.includes(content.testimonials.headlineHighlight)
                  ? content.testimonials.headline.split(content.testimonials.headlineHighlight).flatMap((p, i, arr) =>
                      i < arr.length - 1 ? [p, <em key={i}>{content.testimonials.headlineHighlight}</em>] : [p]
                    )
                  : content.testimonials.headline}
              </h2>
            </div>

            <div className={`fp-testi-carousel ${!isAnimated("fp-clients") ? "fp-animate" : "fp-animated"}`} style={{ animationDelay: "0.1s" }}>
              {content.testimonials.items.map((t, i) => (
                <div key={t.id} className={`fp-testi-card${i === activeTestimonial ? " active" : i === (activeTestimonial - 1 + content.testimonials.items.length) % content.testimonials.items.length ? " prev" : " next"}`}>
                  <div className="l-testi-stars">{Array.from({ length: t.stars }).map((_, si) => <span key={si} className="l-star">★</span>)}</div>
                  <div className="l-testi-quote">"</div>
                  <p className="fp-testi-text">{t.text}</p>
                  <div className="l-testi-metric">{t.metric}</div>
                  <div className="l-testi-author">
                    <div className="l-testi-avatar" style={{ background: t.avatarColor, color: t.avatarTextColor }}>{t.initials}</div>
                    <div><div className="l-testi-name">{t.author}</div><div className="l-testi-role">{t.role}</div></div>
                  </div>
                </div>
              ))}
            </div>

            <div className="fp-testi-dots">
              {content.testimonials.items.map((_, i) => (
                <button key={i} className={`fp-testi-dot${i === activeTestimonial ? " active" : ""}`} onClick={() => setActiveTestimonial(i)}></button>
              ))}
            </div>
          </div>
        </section>

        {/* ══════════════════════════════════════
            SECTION 07 — CTA FINAL + FOOTER
        ══════════════════════════════════════ */}
        <section className="fp-section fp-cta-section" id="fp-cta" data-nav="Empezar">
          <div className="fp-bg">
            <div className="l-cta-bg"></div>
          </div>
          <div className="fp-bg-overlay" style={{ background: "rgba(8,8,16,0.6)" }}></div>
          <div className="fp-content fp-cta-layout">
            <div className={`fp-cta-content ${!isAnimated("fp-cta") ? "fp-animate" : "fp-animated"}`} style={{ animationDelay: "0s" }}>
              <div className="l-pill" style={{ margin: "0 auto 24px" }}>{content.cta.pill}</div>
              <h2 className="l-cta-h2">
                {content.cta.headline.split("\n").map((line, i) => (
                  <span key={i} className={i > 0 ? "l-block" : undefined}>
                    {line.includes(content.cta.headlineHighlight)
                      ? line.split(content.cta.headlineHighlight).flatMap((p, pi, arr) =>
                          pi < arr.length - 1 ? [p, <em key={pi}>{content.cta.headlineHighlight}</em>] : [p]
                        )
                      : line}
                  </span>
                ))}
              </h2>
              <p className="l-cta-sub">{content.cta.subheadline}</p>
              <div className="l-cta-form">
                <input type="email" className="l-cta-input" placeholder={content.cta.placeholder} />
                <Link href="/login" className="l-btn-primary" style={{ padding: "13px 24px", fontSize: 14 }}>{content.cta.buttonLabel}</Link>
              </div>
              <p className="l-cta-fine">{content.cta.finePrint}</p>
            </div>

            <footer className={`fp-footer ${!isAnimated("fp-cta") ? "fp-animate" : "fp-animated"}`} style={{ animationDelay: "0.2s" }}>
              <div className="fp-footer-inner">
                <div className="fp-footer-brand">
                  <a href="#" className="l-nav-logo" onClick={e => { e.preventDefault(); goToSection(0); }}>
                    <div className="l-nav-gem">{content.site.logo.value}</div>
                    <div className="l-nav-logo-text">Shopify<em>AI</em></div>
                  </a>
                  <p className="l-footer-desc">{content.footer.tagline}</p>
                </div>
                {content.footer.columns.slice(0, 3).map((col, i) => (
                  <div key={i} className="fp-footer-col">
                    <div className="l-footer-col-title">{col.title}</div>
                    <ul className="l-footer-links">
                      {col.links.slice(0, 4).map((l, li) => <li key={li}><a href={l.href}>{l.label}</a></li>)}
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
        </section>

      </div>{/* /fp-container */}
    </div>
  );
}
