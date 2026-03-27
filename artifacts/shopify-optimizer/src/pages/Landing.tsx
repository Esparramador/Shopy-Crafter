import { useEffect, useRef, useState, useCallback } from "react";
import { Link } from "wouter";
import { useAuth } from "@/contexts/AuthContext";
import "./landing.css";

const API_BASE_LANDING = import.meta.env.BASE_URL?.replace(/\/$/, "") ?? "";

function ApkDownloadButton({ labels }: { labels?: { idle: string; checking: string; downloading: string; building: string; unavailable: string } }) {
  const [status, setStatus] = useState<"idle" | "checking" | "downloading" | "unavailable">("idle");
  const [apkAvailable, setApkAvailable] = useState<boolean | null>(null);
  const lb = labels ?? { idle: "📱 Descargar App Android", checking: "Verificando...", downloading: "⬇ Descargando...", building: "🔜 Disponible próximamente", unavailable: "No disponible" };

  const handleClick = async () => {
    if (status === "downloading") return;
    setStatus("checking");
    try {
      const r = await fetch(`${API_BASE_LANDING}/api/apk/status`);
      const data = await r.json() as { available: boolean; building?: boolean };
      if (data.available) {
        setApkAvailable(true);
        setStatus("downloading");
        const a = document.createElement("a");
        a.href = `${API_BASE_LANDING}/api/apk/download`;
        a.download = "ShopyCrafter.apk";
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        setTimeout(() => setStatus("idle"), 3000);
      } else if (data.building) {
        setApkAvailable(false);
        setStatus("unavailable");
        setTimeout(() => setStatus("idle"), 4000);
      } else {
        setApkAvailable(false);
        setStatus("unavailable");
        setTimeout(() => setStatus("idle"), 4000);
      }
    } catch {
      setStatus("idle");
    }
  };

  const label = status === "checking" ? lb.checking
    : status === "downloading" ? lb.downloading
    : status === "unavailable" ? (apkAvailable === false ? lb.building : lb.unavailable)
    : lb.idle;

  return (
    <button
      onClick={handleClick}
      disabled={status !== "idle"}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 8,
        marginTop: 14,
        padding: "10px 22px",
        borderRadius: 10,
        background: status === "downloading" ? "rgba(45,212,159,0.15)" : "rgba(200,168,75,0.08)",
        border: `1px solid ${status === "downloading" ? "rgba(45,212,159,0.5)" : "rgba(200,168,75,0.35)"}`,
        color: status === "downloading" ? "#2dd49f" : "#c8a84b",
        fontSize: 13,
        fontWeight: 600,
        cursor: status !== "idle" ? "not-allowed" : "pointer",
        transition: "all 0.2s",
        letterSpacing: 0.2,
        opacity: status !== "idle" && status !== "downloading" ? 0.75 : 1,
      }}
    >
      {label}
    </button>
  );
}

type CMSContent = {
  site: { name: string; tagline: string; logo: { type: string; value: string; imageUrl: string | null }; primaryColor: string; accentColor: string; font_heading: string; font_body: string };
  nav: { links: { id: string; label: string; href: string }[]; ctaPrimary: { label: string; href: string }; ctaSecondary: { label: string; href: string } };
  hero: { pill: { text: string; visible: boolean }; headline: string; headlineHighlight: string; subheadline: string; ctaPrimary: { label: string; href: string }; ctaSecondary: { label: string; href: string }; trustItems: string[]; imageUrl?: string | null; ctaApk?: { label: string; href: string }; scrollHint?: string; demo?: { url: string; status: string; navItems: string[]; metrics: { label: string; value: string; change: string }[]; stores: { name: string; score: string }[]; activity: string[] } };
  features: { pill: string; headline: string; subheadline: string; items: { id: string; num: string; icon: string; iconBg: string; title: string; description: string; tags: string[]; imageUrl?: string | null; stats?: { label: string; value: string }[] }[] };
  stats: { id: string; num: string; label: string }[];
  how: { pill: string; headline: string; headlineHighlight: string; steps: { num: string; title: string; desc: string }[] };
  results?: { pill: string; headline: string; headlineHighlight: string; stats: { prefix: string; num: string; suffix: string; label: string; color: string }[]; techBadges: { icon: string; label: string }[] };
  pricing: { pill: string; headline: string; subheadline: string; plans: { id: string; name: string; price: string; currency: string; period: string; featured: boolean; badge: string | null; features: { text: string; included: boolean }[]; cta: { label: string; style: string } }[] };
  testimonials: { pill: string; headline: string; headlineHighlight: string; items: { id: string; stars: number; text: string; metric: string; author: string; role: string; initials: string; avatarColor: string; avatarTextColor: string; avatarUrl?: string | null }[] };
  contact?: { pill: string; headline: string; headlineHighlight: string; subheadline: string; buttonLabel: string; successTitle: string; successText: string; successSubtext: string; finePrint: string; labels: Record<string, string>; placeholders: Record<string, string>; nicheOptions: string[]; revenueOptions: string[]; socialLabel?: string; socialPlaceholder?: string; servicesLabel?: string; serviceOptions?: string[] };
  cta: { pill: string; headline: string; headlineHighlight: string; subheadline: string; placeholder: string; buttonLabel: string; finePrint: string };
  howCards?: { icon: string; title: string; sub: string; barPercent: string }[];
  howImpact?: { icon: string; title: string; sub: string };
  sectionNav?: string[];
  adminBackLabel?: string;
  apkLabels?: { idle: string; checking: string; downloading: string; building: string; unavailable: string };
  errorMessages?: { sendFail: string; unexpected: string };
  heroDemoTitles?: { storeHealth: string; recentActivity: string };
  footer: { tagline: string; columns: { title: string; links: { label: string; href: string }[] }[]; copyright: string; badges: string[] };
};

const BASE_URL = import.meta.env.BASE_URL.replace(/\/$/, "");

const FP_SECTION_IDS = ["fp-hero", "fp-engines", "fp-demo", "fp-results", "fp-pricing", "fp-clients", "fp-contact", "fp-cta"];
const DEFAULT_SECTION_NAV = ["Inicio", "Motores", "Demo", "Resultados", "Precios", "Clientes", "Contactar", "Empezar"];

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
  const { user } = useAuth();
  const isPreview = new URLSearchParams(window.location.search).get("preview") === "true";
  const isAdmin = !isPreview && user?.role === "admin";
  const [content, setContent] = useState<CMSContent | null>(null);
  const [currentSection, setCurrentSection] = useState(0);
  const [activeEngine, setActiveEngine] = useState(0);
  const [activeTestimonial, setActiveTestimonial] = useState(0);
  const [animatedSections, setAnimatedSections] = useState<Set<string>>(new Set());
  const [testimonialPaused, setTestimonialPaused] = useState(false);
  const [contactForm, setContactForm] = useState({ name: "", email: "", phone: "", storeUrl: "", niche: "", revenue: "", socialMedia: "", message: "" });
  const [contactServices, setContactServices] = useState<string[]>([]);
  const [contactStatus, setContactStatus] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [contactError, setContactError] = useState("");

  const sectionNavLabels = content?.sectionNav ?? DEFAULT_SECTION_NAV;
  const FP_SECTIONS = FP_SECTION_IDS.map((id, i) => ({ id, nav: sectionNavLabels[i] ?? DEFAULT_SECTION_NAV[i] }));

  const CF = (field: keyof typeof contactForm) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
    setContactForm(f => ({ ...f, [field]: e.target.value }));

  const toggleService = (s: string) =>
    setContactServices(p => p.includes(s) ? p.filter(x => x !== s) : [...p, s]);

  const submitContact = async (e: React.FormEvent) => {
    e.preventDefault();
    if (contactStatus === "sending") return;
    setContactStatus("sending");
    setContactError("");
    try {
      const res = await fetch(`${BASE_URL}/api/contact`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...contactForm, services: contactServices }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? (content?.errorMessages?.sendFail ?? "Error al enviar"));
      setContactStatus("sent");
    } catch (err: unknown) {
      setContactStatus("error");
      setContactError(err instanceof Error ? err.message : (content?.errorMessages?.unexpected ?? "Error inesperado. Inténtalo de nuevo."));
    }
  };

  const fpRef = useRef<HTMLDivElement>(null);
  const currentRef = useRef(0);

  useEffect(() => {
    fetch(`${BASE_URL}/api/cms/content`).then(r => r.json()).then(setContent).catch(() => {});
  }, []);


  const isAnimatingRef = useRef(false);

  const goToSection = useCallback((index: number) => {
    const container = fpRef.current;
    if (!container) return;
    if (window.innerWidth <= 900) {
      currentRef.current = index;
      setCurrentSection(index);
      const sections = container.querySelectorAll<HTMLElement>(".fp-section");
      const section = sections[index];
      if (section) section.scrollIntoView({ behavior: "smooth", block: "start" });
      return;
    }
    if (index === currentRef.current) return;
    if (isAnimatingRef.current) return;
    const clamped = Math.max(0, Math.min(index, FP_SECTION_IDS.length - 1));
    isAnimatingRef.current = true;
    currentRef.current = clamped;
    setCurrentSection(clamped);
    setAnimatedSections(prev => new Set([...prev, FP_SECTION_IDS[clamped]]));
    const sectionHeight = container.clientHeight;
    const wrapper = container.querySelector<HTMLElement>(".fp-wrapper");
    if (wrapper) {
      wrapper.style.transition = "transform 0.7s cubic-bezier(0.25, 0.46, 0.45, 0.94)";
      wrapper.style.transform = `translateY(-${clamped * sectionHeight}px)`;
    }
    setTimeout(() => { isAnimatingRef.current = false; }, 800);
  }, []);

  useEffect(() => {
    if (!content) return;
    setAnimatedSections(prev => new Set([...prev, FP_SECTION_IDS[0]]));
    setCurrentSection(0);
    currentRef.current = 0;

    const container = fpRef.current;
    if (!container) return;

    if (window.innerWidth > 900) {
      const wrapper = container.querySelector<HTMLElement>(".fp-wrapper");
      if (wrapper) {
        wrapper.style.transform = "translateY(0px)";
      }
      return;
    }

    const sections = [...container.querySelectorAll<HTMLElement>(".fp-section")];
    const obs = new IntersectionObserver(entries => {
      let best: { idx: number; ratio: number } | null = null;
      entries.forEach(e => {
        if (e.isIntersecting) {
          const idx = sections.indexOf(e.target as HTMLElement);
          if (idx !== -1 && (!best || e.intersectionRatio > best.ratio)) {
            best = { idx, ratio: e.intersectionRatio };
          }
        }
      });
      if (best) {
        currentRef.current = best.idx;
        setCurrentSection(best.idx);
        setAnimatedSections(prev => new Set([...prev, sections[best!.idx].id]));
      }
    }, { threshold: [0.3, 0.5, 0.7] });

    sections.forEach(s => obs.observe(s));
    return () => obs.disconnect();
  }, [content]);

  useEffect(() => {
    if (!content) return;
    const hash = window.location.hash;
    if (!hash) return;
    const idx = FP_SECTIONS.findIndex(s => `#${s.id}` === hash);
    if (idx >= 0) setTimeout(() => goToSection(idx), 350);
  }, [content, goToSection]);

  useEffect(() => {
    if (!isPreview) return;
    const handler = (e: MessageEvent) => {
      if (e.origin !== window.location.origin) return;
      if (e.data?.type === "cms-go-to-section") {
        const idx = FP_SECTIONS.findIndex(s => s.id === e.data.sectionId);
        if (idx >= 0) goToSection(idx);
      }
    };
    window.addEventListener("message", handler);
    return () => window.removeEventListener("message", handler);
  }, [isPreview, goToSection]);

  // Lock body scroll ONLY on desktop — mobile uses native scroll
  useEffect(() => {
    const isMobile = () => window.innerWidth <= 900;
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
        const container = fpRef.current;
        if (container) {
          const wrapper = container.querySelector<HTMLElement>(".fp-wrapper");
          if (wrapper) {
            wrapper.style.transition = "none";
            wrapper.style.transform = `translateY(-${currentRef.current * container.clientHeight}px)`;
          }
        }
      }
    };
    window.addEventListener("resize", onResize);
    return () => {
      window.removeEventListener("resize", onResize);
      document.body.style.overflow = "";
      document.documentElement.style.overflow = "";
    };
  }, []);

  useEffect(() => {
    if (window.innerWidth <= 900) return;
    const container = fpRef.current;
    if (!container) return;

    let accumulated = 0;
    const THRESHOLD = 60;
    let resetTimer: ReturnType<typeof setTimeout> | null = null;

    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      if (isAnimatingRef.current) return;

      accumulated += e.deltaY;

      if (resetTimer) clearTimeout(resetTimer);
      resetTimer = setTimeout(() => { accumulated = 0; }, 200);

      if (Math.abs(accumulated) >= THRESHOLD) {
        if (accumulated > 0) {
          goToSection(currentRef.current + 1);
        } else {
          goToSection(currentRef.current - 1);
        }
        accumulated = 0;
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
    if (!content || testimonialPaused) return;
    const timer = setInterval(() => {
      setActiveTestimonial(t => (t + 1) % (content.testimonials?.items?.length || 1));
    }, 4000);
    return () => clearInterval(timer);
  }, [content, testimonialPaused]);

  const pad = (n: number) => String(n).padStart(2, "0");
  const isAnimated = (id: string) => animatedSections.has(id);

  const parentOrigin = isPreview ? window.location.origin : "";

  const cmsClick = useCallback((path: string) => {
    if (!isPreview) return undefined;
    return (e: React.MouseEvent) => {
      e.stopPropagation();
      window.parent.postMessage({ type: "cms-click-to-edit", path }, parentOrigin || "*");
    };
  }, [isPreview, parentOrigin]);

  const cmsProps = useCallback((path: string) => {
    if (!isPreview) return {};
    return {
      onClick: (e: React.MouseEvent) => {
        e.stopPropagation();
        window.parent.postMessage({ type: "cms-click-to-edit", path }, parentOrigin || "*");
      },
      style: { cursor: "pointer" } as React.CSSProperties,
      title: `Editar: ${path}`,
      "data-cms-path": path,
    };
  }, [isPreview, parentOrigin]);

  if (!content?.hero) {
    return (
      <div className="l-loading">
        <div className="l-loader"></div>
      </div>
    );
  }

  const hLines = content.hero.headline.split("\n");
  const progressPct = FP_SECTIONS.length > 1 ? (currentSection / (FP_SECTIONS.length - 1)) * 100 : 0;

  return (
    <div className={`l-root${isPreview ? " cms-preview-mode" : ""}`}>
      {/* ── FIXED NAV ── */}
      <nav className="l-nav l-nav-fp">
        <a href="#" className="l-nav-logo" onClick={e => { e.preventDefault(); goToSection(0); }}>
          {content.site.logo.imageUrl ? (
            <img src={`${API_BASE_LANDING}${content.site.logo.imageUrl}`} alt={content.site.name} style={{ height: 32, width: "auto", borderRadius: 6 }} />
          ) : (
            <div className="l-nav-gem">{content.site.logo.value}</div>
          )}
          <div className="l-nav-logo-text">{content.site.name}</div>
        </a>
        <ul className="l-nav-links">
          {FP_SECTIONS.map((sec, i) => (
            <li key={sec.id}>
              <a href={`#${sec.id}`} className={currentSection === i ? "l-nav-active" : ""} onClick={e => { e.preventDefault(); goToSection(i); }}>{sec.nav}</a>
            </li>
          ))}
        </ul>
        <div className="l-nav-ctas">
          {isAdmin ? (
            <Link href="/admin/clients" className="l-btn-gold">{content.adminBackLabel ?? "← Volver al panel"}</Link>
          ) : (
            <>
              <Link href="/login" className="l-btn-ghost">{content.nav.ctaSecondary.label}</Link>
              <a href="#fp-pricing" className="l-btn-gold" onClick={e => { e.preventDefault(); goToSection(4); }}>{content.nav.ctaPrimary.label}</a>
            </>
          )}
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
        <div className="fp-wrapper">

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
                <div className={`l-hero-pill ${!isAnimated("fp-hero") ? "fp-animate" : "fp-animated"}`} style={{ animationDelay: "0s" }} {...cmsProps("hero.pill.text")}>
                  <div className="l-pill-dot"></div>
                  {content.hero.pill.text}
                </div>
              )}
              <h1 className={`l-hero-h1 ${!isAnimated("fp-hero") ? "fp-animate" : "fp-animated"}`} style={{ animationDelay: "0.1s" }} onClick={cmsClick("hero.headline")}>
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
              <p className={`l-hero-sub ${!isAnimated("fp-hero") ? "fp-animate" : "fp-animated"}`} style={{ animationDelay: "0.22s" }} onClick={cmsClick("hero.subheadline")}>{content.hero.subheadline}</p>
              <div className={`l-hero-ctas ${!isAnimated("fp-hero") ? "fp-animate" : "fp-animated"}`} style={{ animationDelay: "0.34s" }}>
                <a href="#fp-pricing" className="l-btn-primary" onClick={e => { e.preventDefault(); goToSection(4); }}>{content.hero.ctaPrimary.label}</a>
                <a href="#fp-demo" className="l-btn-secondary" onClick={e => { e.preventDefault(); goToSection(2); }}>{content.hero.ctaSecondary.label}</a>
              </div>
              <ApkDownloadButton labels={content.apkLabels} />
              <div className={`l-hero-trust ${!isAnimated("fp-hero") ? "fp-animate" : "fp-animated"}`} style={{ animationDelay: "0.46s" }}>
                {content.hero.trustItems.map((item, i) => (
                  <div key={i} className="l-trust-item"><div className="l-trust-check">✓</div>{item}</div>
                ))}
              </div>
            </div>

            <div className={`fp-hero-right ${!isAnimated("fp-hero") ? "fp-animate" : "fp-animated"}`} style={{ animationDelay: "0.2s" }}>
              <div className="l-preview-glow"></div>
              {content.hero.imageUrl ? (
                <div className="l-preview-frame" style={{ padding: 0, overflow: "hidden" }}>
                  <img src={`${API_BASE_LANDING}${content.hero.imageUrl}`} alt="Hero" style={{ width: "100%", height: "100%", objectFit: "cover", borderRadius: 16 }} />
                </div>
              ) : (
                <div className="l-preview-frame">
                  <div className="l-preview-topbar">
                    <div className="l-preview-dots">
                      <div className="l-dot" style={{ background: "#ff5f57" }}></div>
                      <div className="l-dot" style={{ background: "#ffbd2e" }}></div>
                      <div className="l-dot" style={{ background: "#28ca41" }}></div>
                    </div>
                    <div className="l-preview-url">{content.hero.demo?.url ?? "app.shopifyai.pro/admin — Moda Urbana"}</div>
                    <div className="l-preview-status"><div className="l-status-dot"></div>{content.hero.demo?.status ?? "6 motores activos"}</div>
                  </div>
                  <div className="l-preview-body">
                    <div className="l-preview-sb">
                      <div className="l-psb-logo"><div className="l-psb-gem"></div><div className="l-psb-name">{content.site.name}</div></div>
                      {(Array.isArray(content.hero.demo?.navItems) ? content.hero.demo!.navItems : ["Overview", "Productos", "Imágenes IA", "Pricing + P&L", "SEO Técnico", "A/B Tests"]).map((item, i) => (
                        <div key={i} className={`l-psb-item${i === 0 ? " l-psb-on" : ""}`}><div className="l-psb-dot"></div>{item}</div>
                      ))}
                    </div>
                    <div className="l-preview-main">
                      <div className="l-pm-row">
                        {(content.hero.demo?.metrics ?? [{ label: "Revenue", value: "€32.4K", change: "↑ 22%" }, { label: "Conversión", value: "4.2%", change: "↑ 0.9pp" }, { label: "Margen", value: "61%", change: "↑ 8pts" }, { label: "SEO", value: "88", change: "↑ 23pts" }]).map((m, i) => ({ lbl: m.label, val: m.value, ch: m.change, color: ["#e6c668", "#2dd49f", "#f2f0ff", "#4a9edd"][i] ?? "#e6c668" })).map((c, i) => (
                          <div key={i} className="l-pm-card">
                            <div className="l-pm-lbl">{c.lbl}</div>
                            <div className="l-pm-val" style={{ color: c.color }}>{c.val}</div>
                            <div className="l-pm-ch" style={{ color: c.color }}>{c.ch}</div>
                          </div>
                        ))}
                      </div>
                      <div className="l-pm-row2">
                        <div className="l-pm-card2">
                          <div className="l-pm-c2-title">{content.heroDemoTitles?.storeHealth ?? "Salud de tiendas"}</div>
                          {(content.hero.demo?.stores ?? [{ name: "Moda Urbana", score: "88" }, { name: "TechGadgets", score: "71" }, { name: "Casa & Arte", score: "42" }]).map((s, i) => {
                            const v = parseInt(String(s.score), 10) || 0;
                            const color = v >= 80 ? "#2dd49f" : v >= 60 ? "#4a9edd" : "#e84558";
                            return (
                              <div key={i}>
                                <div className="l-pm-bar-row"><span>{s.name}</span><span style={{ color }}>{v}</span></div>
                                <div className="l-pm-bar"><div className="l-pm-bar-f" style={{ width: `${v}%`, background: `linear-gradient(90deg,${color},${color}88)` }}></div></div>
                              </div>
                            );
                          })}
                        </div>
                        <div className="l-pm-card2">
                          <div className="l-pm-c2-title">{content.heroDemoTitles?.recentActivity ?? "Actividad reciente"}</div>
                          {(content.hero.demo?.activity ?? ["A/B Test ganador · +28% conv.", "48 imágenes · €13.44", "Schema SEO · 234 productos"]).map((txt, i) => {
                            const icons = [{ ico: "✓", bg: "rgba(45,212,159,.1)", color: "#2dd49f" }, { ico: "★", bg: "rgba(200,168,75,.1)", color: "#e6c668" }, { ico: "◎", bg: "rgba(74,158,221,.1)", color: "#4a9edd" }];
                            const ic = icons[i % icons.length];
                            return (
                              <div key={i} className="l-feed-row">
                                <div className="l-feed-ico" style={{ background: ic.bg, color: ic.color }}>{ic.ico}</div>
                                <div className="l-feed-txt">{txt}</div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="fp-scroll-hint">
            <div className="fp-scroll-hint-text">{content.hero.scrollHint ?? "Desliza para explorar"}</div>
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
              <h2 className="l-h2" onClick={cmsClick("features.headline")}>{content.features.headline.split(".")[0]}. <em>{content.features.headline.split(".").slice(1).join(".")}</em></h2>
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
                    {(Array.isArray(content.features.items[activeEngine].tags)
                      ? content.features.items[activeEngine].tags
                      : String(content.features.items[activeEngine].tags ?? "").split(",").map((s: string) => s.trim()).filter(Boolean)
                    ).map((tag: string, ti: number) => (
                      <span key={ti} className="fp-engine-tag">{tag}</span>
                    ))}
                  </div>
                </div>
                <div className="fp-engine-stats">
                  {(content.features.items[activeEngine].stats ?? [
                    { label: "Precisión", value: "94%" },
                    { label: "Velocidad", value: "<2s" },
                    { label: "Uptime", value: "99.9%" },
                  ]).map((stat, si) => (
                    <div key={si} className="fp-engine-stat">
                      <div className="fp-engine-stat-val" style={{ color: ["var(--l-jade)", "var(--l-gold)", "var(--l-sky)"][si] ?? "var(--l-jade)" }}>{stat.value}</div>
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
              <h2 className="l-h2" onClick={cmsClick("how.headline")}>
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
              {(content.howCards ?? [
                { icon: "✓", title: "Auditoría completada", sub: "234 productos analizados · 12 acciones urgentes", barPercent: "88" },
                { icon: "🎨", title: "Imágenes generándose", sub: "flux-1.1-pro · 48/234 productos", barPercent: "21" },
                { icon: "⚗️", title: "A/B Test activo", sub: "Bomber Hero · 342 visitas · 67% confianza", barPercent: "67" },
              ]).map((c, i) => {
                const colors = ["#2dd49f", "#e6c668", "#4a9edd"];
                const cl = colors[i % colors.length];
                return (
                  <div key={i} className="l-how-card">
                    <div className="l-how-card-h">
                      <div className="l-how-card-ico" style={{ background: `${cl}18`, color: cl }}>{c.icon}</div>
                      <div><div className="l-how-card-title">{c.title}</div><div className="l-how-card-sub">{c.sub}</div></div>
                    </div>
                    <div className="l-how-bar"><div className="l-how-bar-f" style={{ width: `${c.barPercent}%`, background: `linear-gradient(90deg,${cl},${cl}88)`, transition: "width 3s ease" }}></div></div>
                  </div>
                );
              })}
              {(() => {
                const imp = content.howImpact ?? { icon: "💰", title: "Impacto estimado", sub: "+€8,400/mes proyectados este mes" };
                return (
                  <div className="l-how-card l-how-card-green">
                    <div className="l-how-card-h">
                      <div className="l-how-card-ico" style={{ background: "rgba(45,212,159,.1)", color: "#2dd49f" }}>{imp.icon}</div>
                      <div><div className="l-how-card-title">{imp.title}</div><div className="l-how-card-sub" style={{ color: "#2dd49f" }}>{imp.sub}</div></div>
                    </div>
                  </div>
                );
              })()}
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
              <div className="l-pill">{content.results?.pill ?? "Resultados probados"}</div>
              <h2 className="l-h2">{(() => {
                const hl = content.results?.headline ?? "Números que hablan solos";
                const hlHighlight = content.results?.headlineHighlight ?? "hablan solos";
                if (hl.includes(hlHighlight)) {
                  const parts = hl.split(hlHighlight);
                  return <>{parts[0]}<em>{hlHighlight}</em>{parts.slice(1).join(hlHighlight)}</>;
                }
                return hl;
              })()}</h2>
            </div>
            <div className={`fp-stats-grid ${!isAnimated("fp-results") ? "fp-animate" : "fp-animated"}`} style={{ animationDelay: "0.1s" }}>
              {(content.results?.stats ?? [
                { prefix: "+", num: "234", suffix: "%", label: "Incremento medio en conversión", color: "var(--l-jade)" },
                { prefix: "€", num: "8400", suffix: "/mes", label: "Ingresos adicionales promedio", color: "var(--l-gold)" },
                { prefix: "", num: "99", suffix: ".9%", label: "Uptime garantizado de la plataforma", color: "var(--l-sky)" },
                { prefix: "", num: "6", suffix: " motores", label: "Optimizando tu tienda 24/7", color: "#8b5cf6" },
              ]).map((stat, i) => (
                <div key={i} className="fp-stat-card">
                  <div className="fp-stat-val" style={{ color: stat.color }}>
                    {stat.prefix}<AnimatedCounter target={parseInt(String(stat.num), 10) || 0} />{stat.suffix}
                  </div>
                  <div className="fp-stat-label">{stat.label}</div>
                </div>
              ))}
            </div>
            <div className={`fp-tech-logos ${!isAnimated("fp-results") ? "fp-animate" : "fp-animated"}`} style={{ animationDelay: "0.25s" }}>
              {(content.results?.techBadges ?? [{ icon: "🛍️", label: "Shopify API" }, { icon: "🤖", label: "Claude AI" }, { icon: "🎨", label: "Replicate" }, { icon: "🔍", label: "GSC" }, { icon: "📧", label: "Klaviyo" }, { icon: "🔐", label: "AES-256" }, { icon: "⚡", label: "Shopify Flow" }]).map((badge, i) => (
                <div key={i} className="fp-tech-badge">
                  <span>{badge.icon}</span>
                  <span>{badge.label}</span>
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
              <h2 className="l-h2" onClick={cmsClick("pricing.headline")}>{content.pricing.headline.split(".")[0]}. <em>{content.pricing.headline.split(".").slice(1).join(".")}</em></h2>
              <p className="l-sub">{content.pricing.subheadline}</p>
            </div>
            <div className={`fp-pricing-row ${!isAnimated("fp-pricing") ? "fp-animate" : "fp-animated"}`} style={{ animationDelay: "0.1s" }}>
              {content.pricing.plans.map(plan => (
                <div key={plan.id} className={`l-pricing-card fp-pricing-card${plan.featured === true || plan.featured === "true" ? " l-pricing-featured" : ""}`}>
                  {plan.badge && <div className="l-pricing-badge">{plan.badge}</div>}
                  <div className="l-pricing-plan">{plan.name}</div>
                  <div className="l-pricing-price"><span>{plan.currency}</span>{plan.price}</div>
                  <div className="l-pricing-period">{plan.period}</div>
                  <div className="l-pricing-divider"></div>
                  <ul className="l-pricing-features">
                    {plan.features.map((f, fi) => (
                      <li key={fi} className="l-pricing-feature">
                        <div className={(f.included === true || f.included === "true") ? "l-pricing-check" : "l-pricing-x"}>{(f.included === true || f.included === "true") ? "✓" : "✕"}</div>
                        <span style={(f.included === true || f.included === "true") ? undefined : { color: "var(--l-t3)", fontSize: 12 }}>{f.text}</span>
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
              <h2 className="l-h2" onClick={cmsClick("testimonials.headline")}>
                {content.testimonials.headline.includes(content.testimonials.headlineHighlight)
                  ? content.testimonials.headline.split(content.testimonials.headlineHighlight).flatMap((p, i, arr) =>
                      i < arr.length - 1 ? [p, <em key={i}>{content.testimonials.headlineHighlight}</em>] : [p]
                    )
                  : content.testimonials.headline}
              </h2>
            </div>

            <div className={`fp-testi-carousel ${!isAnimated("fp-clients") ? "fp-animate" : "fp-animated"}`} style={{ animationDelay: "0.1s" }} onMouseEnter={() => setTestimonialPaused(true)} onMouseLeave={() => setTestimonialPaused(false)}>
              {content.testimonials.items.map((t, i) => (
                <div key={t.id} className={`fp-testi-card${i === activeTestimonial ? " active" : i === (activeTestimonial - 1 + content.testimonials.items.length) % content.testimonials.items.length ? " prev" : " next"}`}>
                  <div className="l-testi-stars">{Array.from({ length: t.stars }).map((_, si) => <span key={si} className="l-star">★</span>)}</div>
                  <div className="l-testi-quote">"</div>
                  <p className="fp-testi-text">{t.text}</p>
                  <div className="l-testi-metric">{t.metric}</div>
                  <div className="l-testi-author">
                    {t.avatarUrl ? (
                      <img src={t.avatarUrl} alt={t.author} className="l-testi-avatar" style={{ width: 40, height: 40, borderRadius: "50%", objectFit: "cover" }} />
                    ) : (
                      <div className="l-testi-avatar" style={{ background: t.avatarColor, color: t.avatarTextColor }}>{t.initials}</div>
                    )}
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
            SECTION 06 — FORMULARIO DE CONTACTO
        ══════════════════════════════════════ */}
        <section className="fp-section fp-section-dark" id="fp-contact" data-nav="Contactar">
          <div className="fp-bg">
            <div className="l-contact-bg" style={{
              position: "absolute", inset: 0,
              background: "radial-gradient(ellipse 80% 60% at 50% 50%, rgba(200,168,75,0.06) 0%, transparent 70%)",
            }} />
          </div>
          <div className="fp-content" style={{ maxWidth: 900, padding: "0 24px" }}>
            <div className={`fp-section-header ${!isAnimated("fp-contact") ? "fp-animate" : "fp-animated"}`} style={{ animationDelay: "0s" }}>
              <div className="l-pill" style={{ background: "rgba(200,168,75,0.12)", color: "#e6c668", border: "1px solid rgba(200,168,75,0.2)" }}>{content.contact?.pill ?? "Trabaja con nosotros"}</div>
              <h2 className="l-h2">{content.contact?.headline ?? "Cuéntanos sobre tu negocio."}<br /><em>{content.contact?.headlineHighlight ?? "Te contactamos en menos de 24h."}</em></h2>
              <p className="l-sub">{content.contact?.subheadline ?? "Necesitamos conocer tu tienda para personalizar cada motor de IA a tu nicho, ticket medio y modelo de negocio."}</p>
            </div>

            <div className={`${!isAnimated("fp-contact") ? "fp-animate" : "fp-animated"}`} style={{ animationDelay: "0.12s" }}>
              {contactStatus === "sent" ? (
                <div style={{
                  background: "rgba(45,212,159,0.08)", border: "1px solid rgba(45,212,159,0.3)",
                  borderRadius: 16, padding: "48px 32px", textAlign: "center",
                }}>
                  <div style={{ fontSize: 48, marginBottom: 16 }}>✅</div>
                  <h3 style={{ fontSize: 22, fontWeight: 700, color: "var(--jade)", marginBottom: 8 }}>{content.contact?.successTitle ?? "¡Solicitud recibida!"}</h3>
                  <p style={{ color: "var(--t3)", fontSize: 15, marginBottom: 12 }}>{content.contact?.successText ?? "Nuestra IA ya está analizando tu negocio, mercado, competencia y SEO."}</p>
                  <p style={{ color: "var(--t4)", fontSize: 13 }}>{content.contact?.successSubtext ?? "Te contactaremos con un informe detallado en menos de 24h. Revisa también tu carpeta de spam."}</p>
                </div>
              ) : (
                <form onSubmit={submitContact} className="fp-contact-form" style={{
                  background: "var(--ink2)", border: "1px solid var(--ink3)",
                  borderRadius: 20, padding: "40px 36px",
                  display: "grid", gap: 24,
                }}>
                  {/* Row 1: Nombre + Email */}
                  <div className="fp-contact-row" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(220px, 100%), 1fr))", gap: 16 }}>
                    <div>
                      <label style={{ display: "block", fontSize: 11, fontWeight: 700, letterSpacing: "0.7px", color: "var(--t3)", textTransform: "uppercase", marginBottom: 8 }}>{content.contact?.labels?.name ?? "Nombre completo *"}</label>
                      <input
                        type="text" required value={contactForm.name} onChange={CF("name")}
                        placeholder={content.contact?.placeholders?.name ?? "Tu nombre y apellidos"}
                        style={{ width: "100%", padding: "11px 14px", background: "var(--ink)", border: "1px solid var(--ink3)", borderRadius: 10, color: "var(--t)", fontSize: 14, outline: "none", boxSizing: "border-box" }}
                        onFocus={e => e.target.style.borderColor = "rgba(200,168,75,0.5)"}
                        onBlur={e => e.target.style.borderColor = "var(--ink3)"}
                      />
                    </div>
                    <div>
                      <label style={{ display: "block", fontSize: 11, fontWeight: 700, letterSpacing: "0.7px", color: "var(--t3)", textTransform: "uppercase", marginBottom: 8 }}>{content.contact?.labels?.email ?? "Email de contacto *"}</label>
                      <input
                        type="email" required value={contactForm.email} onChange={CF("email")}
                        placeholder={content.contact?.placeholders?.email ?? "tu@email.com"}
                        style={{ width: "100%", padding: "11px 14px", background: "var(--ink)", border: "1px solid var(--ink3)", borderRadius: 10, color: "var(--t)", fontSize: 14, outline: "none", boxSizing: "border-box" }}
                        onFocus={e => e.target.style.borderColor = "rgba(200,168,75,0.5)"}
                        onBlur={e => e.target.style.borderColor = "var(--ink3)"}
                      />
                    </div>
                  </div>

                  {/* Row 2: Teléfono + URL tienda */}
                  <div className="fp-contact-row" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(220px, 100%), 1fr))", gap: 16 }}>
                    <div>
                      <label style={{ display: "block", fontSize: 11, fontWeight: 700, letterSpacing: "0.7px", color: "var(--t3)", textTransform: "uppercase", marginBottom: 8 }}>{content.contact?.labels?.phone ?? "Teléfono"}</label>
                      <input
                        type="tel" value={contactForm.phone} onChange={CF("phone")}
                        placeholder={content.contact?.placeholders?.phone ?? "+34 600 000 000"}
                        style={{ width: "100%", padding: "11px 14px", background: "var(--ink)", border: "1px solid var(--ink3)", borderRadius: 10, color: "var(--t)", fontSize: 14, outline: "none", boxSizing: "border-box" }}
                        onFocus={e => e.target.style.borderColor = "rgba(200,168,75,0.5)"}
                        onBlur={e => e.target.style.borderColor = "var(--ink3)"}
                      />
                    </div>
                    <div>
                      <label style={{ display: "block", fontSize: 11, fontWeight: 700, letterSpacing: "0.7px", color: "var(--t3)", textTransform: "uppercase", marginBottom: 8 }}>{content.contact?.labels?.storeUrl ?? "URL de tu tienda Shopify"}</label>
                      <input
                        type="text" value={contactForm.storeUrl} onChange={CF("storeUrl")}
                        placeholder={content.contact?.placeholders?.storeUrl ?? "mitienda.myshopify.com"}
                        style={{ width: "100%", padding: "11px 14px", background: "var(--ink)", border: "1px solid var(--ink3)", borderRadius: 10, color: "var(--t)", fontSize: 14, outline: "none", boxSizing: "border-box" }}
                        onFocus={e => e.target.style.borderColor = "rgba(200,168,75,0.5)"}
                        onBlur={e => e.target.style.borderColor = "var(--ink3)"}
                      />
                    </div>
                  </div>

                  {/* Row 3: Nicho + Facturación */}
                  <div className="fp-contact-row" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(220px, 100%), 1fr))", gap: 16 }}>
                    <div>
                      <label style={{ display: "block", fontSize: 11, fontWeight: 700, letterSpacing: "0.7px", color: "var(--t3)", textTransform: "uppercase", marginBottom: 8 }}>{content.contact?.labels?.niche ?? "Nicho / tipo de productos"}</label>
                      <select
                        value={contactForm.niche} onChange={CF("niche")}
                        style={{ width: "100%", padding: "11px 14px", background: "var(--ink)", border: "1px solid var(--ink3)", borderRadius: 10, color: contactForm.niche ? "var(--t)" : "var(--t4)", fontSize: 14, outline: "none", boxSizing: "border-box", cursor: "pointer" }}
                      >
                        <option value="">{content.contact?.placeholders?.niche ?? "Selecciona tu nicho"}</option>
                        {(Array.isArray(content.contact?.nicheOptions) ? content.contact!.nicheOptions : ["Moda y ropa", "Electrónica y gadgets", "Hogar y decoración", "Belleza y cosmética", "Deporte y fitness", "Alimentación y gourmet", "Arte y coleccionismo", "Mascotas", "Joyería y accesorios", "Otro"]).map(o => (
                          <option key={o}>{o}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label style={{ display: "block", fontSize: 11, fontWeight: 700, letterSpacing: "0.7px", color: "var(--t3)", textTransform: "uppercase", marginBottom: 8 }}>{content.contact?.labels?.revenue ?? "Facturación mensual aprox."}</label>
                      <select
                        value={contactForm.revenue} onChange={CF("revenue")}
                        style={{ width: "100%", padding: "11px 14px", background: "var(--ink)", border: "1px solid var(--ink3)", borderRadius: 10, color: contactForm.revenue ? "var(--t)" : "var(--t4)", fontSize: 14, outline: "none", boxSizing: "border-box", cursor: "pointer" }}
                      >
                        <option value="">{content.contact?.placeholders?.revenue ?? "Selecciona rango"}</option>
                        {(Array.isArray(content.contact?.revenueOptions) ? content.contact!.revenueOptions : ["Menos de €1.000", "€1.000 – €5.000", "€5.000 – €15.000", "€15.000 – €50.000", "Más de €50.000"]).map(o => (
                          <option key={o}>{o}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {/* Row 4: Redes sociales */}
                  <div>
                    <label style={{ display: "block", fontSize: 11, fontWeight: 700, letterSpacing: "0.7px", color: "var(--t3)", textTransform: "uppercase", marginBottom: 8 }}>{content.contact?.socialLabel ?? "Redes sociales / Instagram"}</label>
                    <input
                      type="text" value={contactForm.socialMedia} onChange={CF("socialMedia")}
                      placeholder={content.contact?.socialPlaceholder ?? "@tutienda o https://instagram.com/tutienda"}
                      style={{ width: "100%", padding: "11px 14px", background: "var(--ink)", border: "1px solid var(--ink3)", borderRadius: 10, color: "var(--t)", fontSize: 14, outline: "none", boxSizing: "border-box" }}
                      onFocus={e => e.target.style.borderColor = "rgba(200,168,75,0.5)"}
                      onBlur={e => e.target.style.borderColor = "var(--ink3)"}
                    />
                  </div>

                  {/* Servicios */}
                  <div>
                    <label style={{ display: "block", fontSize: 11, fontWeight: 700, letterSpacing: "0.7px", color: "var(--t3)", textTransform: "uppercase", marginBottom: 12 }}>{content.contact?.servicesLabel ?? "Servicios que necesitas"}</label>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                      {(Array.isArray(content.contact?.serviceOptions) ? content.contact!.serviceOptions : ["SEO y contenido", "Rediseño de producto", "Imágenes IA", "Pricing y márgenes", "Email marketing", "A/B Testing", "Auditoría completa"]).map(s => {
                        const active = contactServices.includes(s);
                        return (
                          <button
                            key={s} type="button" onClick={() => toggleService(s)}
                            style={{
                              padding: "7px 14px", borderRadius: 20, fontSize: 13, cursor: "pointer",
                              border: `1px solid ${active ? "rgba(200,168,75,0.5)" : "var(--ink3)"}`,
                              background: active ? "rgba(200,168,75,0.1)" : "transparent",
                              color: active ? "#e6c668" : "var(--t3)",
                              transition: "all 0.15s",
                            }}
                          >{s}</button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Mensaje */}
                  <div>
                    <label style={{ display: "block", fontSize: 11, fontWeight: 700, letterSpacing: "0.7px", color: "var(--t3)", textTransform: "uppercase", marginBottom: 8 }}>{content.contact?.labels?.message ?? "Mensaje adicional"}</label>
                    <textarea
                      rows={3} value={contactForm.message} onChange={CF("message")}
                      placeholder={content.contact?.placeholders?.message ?? "Cuéntanos más sobre tu tienda, tus retos actuales o lo que quieres conseguir…"}
                      style={{ width: "100%", padding: "11px 14px", background: "var(--ink)", border: "1px solid var(--ink3)", borderRadius: 10, color: "var(--t)", fontSize: 14, outline: "none", resize: "vertical", fontFamily: "inherit", boxSizing: "border-box" }}
                      onFocus={e => e.target.style.borderColor = "rgba(200,168,75,0.5)"}
                      onBlur={e => e.target.style.borderColor = "var(--ink3)"}
                    />
                  </div>

                  {contactStatus === "error" && (
                    <div style={{ padding: "10px 14px", background: "rgba(232,69,88,0.1)", border: "1px solid rgba(232,69,88,0.3)", borderRadius: 8, color: "#e84558", fontSize: 13 }}>
                      {contactError}
                    </div>
                  )}

                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
                    <p style={{ fontSize: 12, color: "var(--t4)", flex: 1 }}>{content.contact?.finePrint ?? "Sin spam. Solo te contactamos para hablar de tu proyecto."}</p>
                    <button
                      type="submit" disabled={contactStatus === "sending"}
                      className="l-btn-gold"
                      style={{ opacity: contactStatus === "sending" ? 0.7 : 1, minWidth: 200, padding: "13px 28px", fontSize: 14 }}
                    >
                      {contactStatus === "sending" ? "Enviando…" : (content.contact?.buttonLabel ?? "Solicitar acceso gratuito →")}
                    </button>
                  </div>
                </form>
              )}
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
              <h2 className="l-cta-h2" onClick={cmsClick("cta.headline")}>
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
                    {content.site.logo.imageUrl ? (
                      <img src={`${API_BASE_LANDING}${content.site.logo.imageUrl}`} alt={content.site.name} style={{ height: 28, width: "auto", borderRadius: 6 }} />
                    ) : (
                      <div className="l-nav-gem">{content.site.logo.value}</div>
                    )}
                    <div className="l-nav-logo-text">{content.site.name}</div>
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

        </div>{/* /fp-wrapper */}
      </div>{/* /fp-container */}
    </div>
  );
}
