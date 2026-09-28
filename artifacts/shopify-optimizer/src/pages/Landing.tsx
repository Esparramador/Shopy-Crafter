import { useEffect, useRef, useState, useCallback, useMemo } from "react";
import { Link } from "wouter";
import { useAuth } from "@/contexts/AuthContext";
import PageMeta from "@/components/PageMeta";
import { VismeFormHero } from "@/components/VismeFormHero";
import { CANONICAL_PLANS, type CanonicalPlan } from "@/lib/pricing-plans";
import ApkDownloadButton from "@/components/ApkDownloadButton";
import SiteLinks from "@/components/SiteLinks";
import { metaFor } from "@/components/PageMeta";
import { HERO, SERVICES, PLATFORMS, PROCESS, PORTAL_FEATURES, FEATURED_DEMOS } from "@/lib/landing-content";
import { WEB_DEMOS } from "@/lib/portfolio-data";
import "./landing-2026.css";

function SectionVideoBg({ src }: { src: string }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  useEffect(() => {
    const el = videoRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          el.play().catch(() => {});
        } else {
          el.pause();
        }
      },
      { threshold: 0.1 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [src]);
  return (
    <video
      ref={videoRef}
      className="fp-video-bg"
      muted
      loop
      playsInline
      preload="none"
    >
      <source src={src} />
    </video>
  );
}

function MagnetStoreButton() {
  const btnRef = useRef<HTMLAnchorElement>(null);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [hovered, setHovered] = useState(false);
  const animRef = useRef<number>(0);
  const targetRef = useRef({ x: 0, y: 0 });
  const currentRef = useRef({ x: 0, y: 0 });

  useEffect(() => {
    const el = btnRef.current;
    if (!el) return;

    const RADIUS = 130;
    const STRENGTH = 0.38;

    const onMove = (e: MouseEvent) => {
      const r = el.getBoundingClientRect();
      const cx = r.left + r.width / 2;
      const cy = r.top + r.height / 2;
      const dx = e.clientX - cx;
      const dy = e.clientY - cy;
      const dist = Math.hypot(dx, dy);
      if (dist < RADIUS) {
        const pull = (1 - dist / RADIUS) * STRENGTH * 60;
        targetRef.current = { x: (dx / dist) * pull, y: (dy / dist) * pull };
        setHovered(true);
      } else {
        targetRef.current = { x: 0, y: 0 };
        setHovered(false);
      }
    };

    const loop = () => {
      const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
      currentRef.current.x = lerp(currentRef.current.x, targetRef.current.x, 0.14);
      currentRef.current.y = lerp(currentRef.current.y, targetRef.current.y, 0.14);
      setOffset({ x: currentRef.current.x, y: currentRef.current.y });
      animRef.current = requestAnimationFrame(loop);
    };

    window.addEventListener("mousemove", onMove);
    animRef.current = requestAnimationFrame(loop);
    return () => {
      window.removeEventListener("mousemove", onMove);
      cancelAnimationFrame(animRef.current);
    };
  }, []);

  return (
    <a
      ref={btnRef}
      href="https://comic-crafter.myshopify.com"
      target="_blank"
      rel="noopener noreferrer"
      style={{
        position: "absolute",
        bottom: 30,
        right: 72,
        zIndex: 30,
        display: "inline-flex",
        alignItems: "center",
        gap: 10,
        padding: "13px 22px",
        borderRadius: 50,
        background: hovered
          ? "linear-gradient(135deg,#e6c668,#d4a843)"
          : "linear-gradient(135deg,#d4a843,#b8902e)",
        color: "#0a0800",
        fontWeight: 800,
        fontSize: 13,
        letterSpacing: "0.02em",
        textDecoration: "none",
        boxShadow: hovered
          ? "0 0 0 4px rgba(212,168,67,0.35), 0 0 40px 12px rgba(212,168,67,0.55), 0 8px 32px rgba(0,0,0,0.5)"
          : "0 0 0 2px rgba(212,168,67,0.2), 0 0 24px 6px rgba(212,168,67,0.35), 0 6px 24px rgba(0,0,0,0.4)",
        transform: `translate(${offset.x}px, ${offset.y}px)`,
        transition: "background 0.2s, box-shadow 0.2s",
        cursor: "pointer",
        animation: "magnetBlink 2.4s ease-in-out infinite",
        willChange: "transform",
        userSelect: "none",
        whiteSpace: "nowrap",
      }}
      className="lx-magnet justify-start items-center text-center">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" style={{ flexShrink: 0 }}>
        <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" fill="currentColor" fillOpacity="0.15" stroke="currentColor" strokeWidth="2" strokeLinejoin="round"/>
        <polyline points="9 22 9 12 15 12 15 22" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>Visitar Comic Crafter
            <span style={{
        display: "inline-block",
        width: 8, height: 8,
        borderRadius: "50%",
        background: "#0a0800",
        animation: "magnetDot 1.1s ease-in-out infinite",
        marginLeft: 2,
      }} />
    </a>
  );
}

const API_BASE_LANDING = import.meta.env.BASE_URL?.replace(/\/$/, "") ?? "";
/** Logo de la app (el mismo que el icono de la app Android y la PWA). */
const APP_LOGO = `${API_BASE_LANDING}/images/logo-sc-default.png`;

type CMSContent = {
  site: { name: string; tagline: string; logo: { type: string; value: string; imageUrl: string | null }; primaryColor: string; accentColor: string; font_heading: string; font_body: string };
  nav: { links: { id: string; label: string; href: string }[]; ctaPrimary: { label: string; href: string }; ctaSecondary: { label: string; href: string } };
  hero: { pill: { text: string; visible: boolean }; headline: string; headlineHighlight: string; subheadline: string; ctaPrimary: { label: string; href: string }; ctaSecondary: { label: string; href: string }; trustItems: string[]; imageUrl?: string | null; ctaApk?: { label: string; href: string }; scrollHint?: string; demo?: { url: string; status: string; navItems: string[]; metrics: { label: string; value: string; change: string }[]; stores: { name: string; score: string }[]; activity: string[] } };
  features: { pill: string; headline: string; subheadline: string; items: { id: string; num: string; icon: string; iconBg: string; title: string; description: string; tags: string[]; imageUrl?: string | null; stats?: { label: string; value: string }[] }[] };
  stats: { id: string; num: string; label: string }[];
  how: { pill: string; headline: string; headlineHighlight: string; steps: { num: string; title: string; desc: string }[] };
  results?: { pill: string; headline: string; headlineHighlight: string; stats: { prefix: string; num: string; suffix: string; label: string; color: string }[]; techBadges: { icon: string; label: string }[] };
  pricing: { pill: string; headline: string; subheadline: string; plans: { id: string; name: string; price: string; currency: string; period: string; featured: boolean; badge: string | null; features: { text: string; included: boolean }[]; cta: { label: string; style: string; href?: string } }[] };
  testimonials: { pill: string; headline: string; headlineHighlight: string; items: { id: string; stars: number; text: string; metric: string; author: string; role: string; initials: string; avatarColor: string; avatarTextColor: string; avatarUrl?: string | null }[] };
  contact?: { pill: string; headline: string; headlineHighlight: string; subheadline: string; buttonLabel: string; successTitle: string; successText: string; successSubtext: string; finePrint: string; labels: Record<string, string>; placeholders: Record<string, string>; nicheOptions: string[]; revenueOptions: string[]; socialLabel?: string; socialPlaceholder?: string; servicesLabel?: string; serviceOptions?: string[] };
  cta: { pill: string; headline: string; headlineHighlight: string; subheadline: string; placeholder: string; buttonLabel: string; finePrint: string };
  calculator?: {
    pill: string; headline: string; headlineHighlight: string; subheadline: string; disclaimer: string;
    resultLabel: string; oneTimeLabel: string; recurringLabel: string; ctaLabel: string; emptyLabel: string;
    oneTimeServices: { id: string; name: string; description: string; price: number; icon: string }[];
    recurringServices: { id: string; name: string; description: string; price: number; period: string; icon: string }[];
  };
  howCards?: { icon: string; title: string; sub: string; barPercent: string }[];
  howImpact?: { icon: string; title: string; sub: string };
  sectionNav?: string[];
  adminBackLabel?: string;
  apkLabels?: { idle: string; checking: string; downloading: string; building: string; unavailable: string };
  errorMessages?: { sendFail: string; unexpected: string };
  heroDemoTitles?: { storeHealth: string; recentActivity: string };
  backgrounds?: Record<string, { type: string; videoUrl?: string; galleryImages?: string[]; particleColor?: string }>;
  footer: { tagline: string; columns: { title: string; links: { label: string; href: string }[] }[]; copyright: string; badges: string[] };
};

const BASE_URL = import.meta.env.BASE_URL.replace(/\/$/, "");

const LANDING_FALLBACK: CMSContent = {
  site: { name: "Shopy Crafter", tagline: "Optimización IA para tu tienda Shopify", logo: { type: "text", value: "SC", imageUrl: null }, primaryColor: "#c8a84b", accentColor: "#2dd49f", font_heading: "Instrument Serif", font_body: "Geist" },
  nav: { links: [{ id: "n1", label: "Motores", href: "#fp-engines" }, { id: "n2", label: "Demo", href: "#fp-demo" }, { id: "n3", label: "Precios", href: "#fp-pricing" }, { id: "n4", label: "Contactar", href: "#fp-contact" }], ctaPrimary: { label: "Solicitar acceso →", href: "#fp-contact" }, ctaSecondary: { label: "Iniciar sesión", href: "/login" } },
  hero: { pill: { text: "6 motores de IA · Shopy Crafter", visible: true }, headline: "Optimizamos tu tienda\nShopify con IA\npor ti", headlineHighlight: "con IA", subheadline: "Shopy Crafter gestiona, optimiza y potencia tiendas Shopify con inteligencia artificial. Imágenes profesionales, pricing inteligente, SEO técnico y tests A/B — sin intervención manual.", ctaPrimary: { label: "Descubre nuestros servicios →", href: "#fp-pricing" }, ctaSecondary: { label: "▶ Ver en acción", href: "#fp-demo" }, trustItems: ["Setup en menos de 48h", "IA real con API Shopify", "RGPD compliant"], imageUrl: null, scrollHint: "Desliza para explorar" },
  features: { pill: "Motores IA", headline: "Seis motores. Una sola plataforma.", subheadline: "Cada motor trabaja de forma autónoma y coordinada para potenciar todos los aspectos de tu tienda.", items: [{ id: "f1", num: "M01", icon: "🖼️", iconBg: "rgba(45,212,159,0.1)", title: "Generación de Imágenes", description: "8 tipos de imagen profesional por producto usando flux-1.1-pro.", tags: ["flux-1.1-pro", "~€0.25/prod"], stats: [{ label: "Precisión", value: "94%" }] }, { id: "f2", num: "M02", icon: "🎨", iconBg: "rgba(200,168,75,0.1)", title: "Consistencia Visual", description: "Extrae el ADN visual de tu tienda y aplica StyleLock.", tags: ["StyleLock", "Visual DNA"], stats: [{ label: "Precisión", value: "97%" }] }, { id: "f3", num: "M03", icon: "⚗️", iconBg: "rgba(74,158,221,0.1)", title: "A/B Testing Automático", description: "Z-test estadístico al 95% de confianza, declaración automática de ganador.", tags: ["Z-test 95%", "Auto-winner"], stats: [{ label: "Confianza", value: "95%" }] }, { id: "f4", num: "M04", icon: "⚡", iconBg: "rgba(200,168,75,0.08)", title: "Auto-Pilot 24/7", description: "Webhook trigger en cada nuevo producto. Sin intervención manual.", tags: ["Webhook", "Cron jobs"], stats: [{ label: "Uptime", value: "99.9%" }] }, { id: "f5", num: "M05", icon: "📊", iconBg: "rgba(200,168,75,0.1)", title: "Pricing Financiero", description: "Motor COGS completo, análisis de competencia en tiempo real.", tags: ["COGS Engine", "P&L en vivo"], stats: [{ label: "Precisión", value: "92%" }] }, { id: "f6", num: "M06", icon: "🔍", iconBg: "rgba(45,212,159,0.08)", title: "SEO Técnico", description: "Schema JSON-LD, meta tags optimizados, Core Web Vitals y blog posts.", tags: ["Schema JSON-LD", "CWV"], stats: [{ label: "Precisión", value: "96%" }] }] },
  stats: [{ id: "s1", num: "3.4×", label: "Más conversión con 5+ imágenes" }, { id: "s2", num: "€0.25", label: "Coste por imagen generada con IA" }, { id: "s3", num: "95%", label: "Confianza estadística en A/B tests" }, { id: "s4", num: "24/7", label: "Auto-pilot autónomo" }],
  how: { pill: "Cómo funciona", headline: "De cero a piloto\nautomático", headlineHighlight: "piloto\nautomático", steps: [{ num: "01", title: "Conecta tu tienda", desc: "Vincula tu tienda Shopify en menos de 5 minutos." }, { num: "02", title: "Configura los motores", desc: "Activa los módulos que necesites según tu negocio." }, { num: "03", title: "Piloto automático", desc: "La IA trabaja 24/7 optimizando cada aspecto de tu tienda." }] },
  pricing: { pill: "Precios", headline: "Un plan para cada negocio.", subheadline: "Sin sorpresas. Precios claros por lo que realmente hacemos.", plans: [] },
  testimonials: { pill: "Clientes", headline: "Resultados\nreales", headlineHighlight: "reales", items: [] },
  cta: { pill: "Empieza hoy", headline: "¿Listo para optimizar\ntu tienda Shopify?", headlineHighlight: "optimizar", subheadline: "Cuéntanos tu caso y te preparamos una propuesta personalizada sin compromiso.", placeholder: "tu@email.com", buttonLabel: "Solicitar acceso →", finePrint: "Sin spam. Solo te contactamos para hablar de tu proyecto." },
  footer: { tagline: "Optimización IA para tiendas Shopify", columns: [], copyright: `© ${new Date().getFullYear()} Shopy Crafter`, badges: ["RGPD", "SSL", "Shopify Partner"] },
};

const FP_SECTION_IDS = ["fp-hero", "fp-services", "fp-platforms", "fp-portfolio", "fp-process", "fp-pricing", "fp-calculator", "fp-contact"];
const DEFAULT_SECTION_NAV = ["Inicio", "Servicios", "Plataformas", "Portfolio", "Proceso", "Precios", "Calculadora", "Contactar"];


export default function Landing() {
  const { user } = useAuth();
  const isPreview = new URLSearchParams(window.location.search).get("preview") === "true";
  const isAdmin = !isPreview && user?.role === "admin";
  const [content, setContent] = useState<CMSContent>(LANDING_FALLBACK);
  const [currentSection, setCurrentSection] = useState(0);
  const [calcQuantities, setCalcQuantities] = useState<Record<string, number>>({});
  const [calcSelectedRecurring, setCalcSelectedRecurring] = useState<string | null>(null);
  const [calcCategory, setCalcCategory] = useState("all");
  const [animatedSections, setAnimatedSections] = useState<Set<string>>(new Set(["fp-hero"]));
  const pricingRowRef = useRef<HTMLDivElement>(null);
  const [pricingIdx, setPricingIdx] = useState(0);
  const [billingPeriod, setBillingPeriod] = useState<"monthly" | "annual">("monthly");
  // "loading" while the fetch is in flight; CanonicalPlan[] once resolved (may be empty)
  const [apiPlansState, setApiPlansState] = useState<CanonicalPlan[] | "loading">("loading");
  const [logoError, setLogoError] = useState(false);

  useEffect(() => {
    const base = (import.meta.env.BASE_URL ?? "").replace(/\/$/, "");
    fetch(`${base}/api/billing/plans`)
      .then(r => r.ok ? r.json() : [])
      .then((plans: any[]) => {
        setApiPlansState(
          Array.isArray(plans) && plans.length > 0
            ? plans.map(p => ({
                id: String(p.id),
                name: String(p.name),
                priceMonthly: Number(p.price ?? 0),
                priceAnnual: Number(p.priceAnnual ?? (p.price ?? 0) * 10),
                currency: p.currency ?? "€",
                featured: !!p.featured,
                badge: p.badge ?? null,
                features: Array.isArray(p.features)
                  ? p.features.map((f: any) => typeof f === "string" ? { text: f, included: true } : f)
                  : [],
                cta: { label: p.ctaLabel ?? "Contactar →", style: p.ctaStyle ?? "ghost", href: p.ctaHref ?? "#fp-contact" },
              }))
            : []
        );
      })
      .catch(() => setApiPlansState([]));
  }, []);

  // Priority: API plans (admin-managed) → CMS plans → CANONICAL_PLANS
  const displayPlans = useMemo<CanonicalPlan[]>(() => {
    // While loading, show CANONICAL_PLANS so nothing flickers
    if (apiPlansState === "loading") return CANONICAL_PLANS;
    // Admin has plans configured in billing admin → use those exclusively
    if (apiPlansState.length > 0) return apiPlansState;
    // API is empty → try CMS plans
    const cmsRaw = content?.pricing?.plans;
    if (Array.isArray(cmsRaw) && cmsRaw.length > 0) {
      return cmsRaw.map((p: any) => {
        const monthly = Number(p.price ?? p.priceMonthly ?? 0);
        return {
          id: String(p.id ?? p.name),
          name: String(p.name),
          priceMonthly: monthly,
          priceAnnual: Number(p.priceAnnual ?? monthly * 10),
          currency: p.currency ?? "€",
          featured: !!p.featured,
          badge: p.badge ?? null,
          features: Array.isArray(p.features)
            ? p.features.map((f: any) => typeof f === "string" ? { text: f, included: true } : f)
            : [],
          cta: { label: p.cta?.label ?? "Contactar →", style: p.cta?.style ?? "ghost", href: p.cta?.href ?? "#fp-contact" },
        } as CanonicalPlan;
      });
    }
    // Final fallback
    return CANONICAL_PLANS;
  }, [apiPlansState, content?.pricing?.plans]);
  // Ahorro anual real (antes "17%" fijo): el mayor de los planes de pago.
  const annualSavingPct = useMemo(() => Math.max(0, ...displayPlans
    .filter(p => p.priceMonthly > 0 && p.priceAnnual > 0)
    .map(p => Math.round((1 - p.priceAnnual / (p.priceMonthly * 12)) * 100))), [displayPlans]);
  const [contactForm, setContactForm] = useState({ name: "", email: "", phone: "", storeUrl: "", niche: "", customNiche: "", revenue: "", socialMedia: "", message: "", extraInfo: "", productImageUrl: "", suppliers: "" });
  const [contactServices, setContactServices] = useState<string[]>([]);
  const [contactStatus, setContactStatus] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [contactError, setContactError] = useState("");

  const [refImageFile, setRefImageFile] = useState<File | null>(null);
  const [refImagePreview, setRefImagePreview] = useState<string | null>(null);

  const [formProgress, setFormProgress] = useState(0);
  const contactSectionRef = useRef<HTMLElement>(null);
  const heroSectionRef = useRef<HTMLElement>(null);
  const [heroTilt, setHeroTilt] = useState({ x: 0, y: 0 });

  // Las etiquetas del CMS iban por índice de las secciones antiguas: con la nueva
  // estructura se usan las propias.
  const sectionNavLabels = DEFAULT_SECTION_NAV;
  const FP_SECTIONS = FP_SECTION_IDS.map((id, i) => ({ id, nav: sectionNavLabels[i] ?? DEFAULT_SECTION_NAV[i] }));

  const CF = (field: keyof typeof contactForm) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
    setContactForm(f => ({ ...f, [field]: e.target.value }));

  // Live progress counter: % of form filled
  useEffect(() => {
    const vals = Object.values(contactForm);
    const filled = vals.filter(v => String(v).trim() !== "").length;
    setFormProgress(Math.round((filled / vals.length) * 100));
  }, [contactForm]);

  const toggleService = (s: string) =>
    setContactServices(p => p.includes(s) ? p.filter(x => x !== s) : [...p, s]);

  const scrollPricing = useCallback((dir: 1 | -1) => {
    const row = pricingRowRef.current;
    if (!row) return;
    const cards = row.querySelectorAll<HTMLElement>(".fp-pricing-card");
    if (!cards.length) return;
    const next = Math.max(0, Math.min(pricingIdx + dir, cards.length - 1));
    cards[next].scrollIntoView({ behavior: "smooth", block: "nearest", inline: "center" });
    setPricingIdx(next);
  }, [pricingIdx]);

  const handleHeroMouseMove = useCallback((e: React.MouseEvent<HTMLElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width - 0.5) * 12;
    const y = ((e.clientY - rect.top) / rect.height - 0.5) * 8;
    setHeroTilt({ x, y });
  }, []);

  const handleHeroMouseLeave = useCallback(() => {
    setHeroTilt({ x: 0, y: 0 });
  }, []);

  const handleCardMouseLeave = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const card = e.currentTarget;
    card.style.transition = "transform 0.35s ease, box-shadow 0.35s ease";
    card.style.transform = "";
    card.style.boxShadow = "";
  }, []);

  useEffect(() => {
    const row = pricingRowRef.current;
    if (!row) return;
    const applyScrollDepth = () => {
      const cards = row.querySelectorAll<HTMLElement>(".fp-pricing-card");
      if (!cards.length) return;
      const rowCenter = row.getBoundingClientRect().left + row.getBoundingClientRect().width / 2;
      let closest = 0, minDist = Infinity;
      cards.forEach((c, i) => {
        const dist = Math.abs(c.getBoundingClientRect().left + c.getBoundingClientRect().width / 2 - rowCenter);
        if (dist < minDist) { minDist = dist; closest = i; }
      });
      setPricingIdx(closest);
    };
    applyScrollDepth();
    row.addEventListener("scroll", applyScrollDepth, { passive: true });
    return () => row.removeEventListener("scroll", applyScrollDepth);
  }, [content]);

  const submitContact = async (e: React.FormEvent) => {
    e.preventDefault();
    if (contactStatus === "sending") return;
    setContactStatus("sending");
    setContactError("");
    try {
      let res: Response;
      if (refImageFile) {
        const fd = new FormData();
        Object.entries(contactForm).forEach(([k, v]) => fd.append(k, v));
        fd.append("services", JSON.stringify(contactServices));
        fd.append("referenceImage", refImageFile);
        res = await fetch(`${BASE_URL}/api/contact`, { method: "POST", credentials: "include", body: fd });
      } else {
        res = await fetch(`${BASE_URL}/api/contact`, {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ...contactForm, services: contactServices }),
        });
      }
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? (content?.errorMessages?.sendFail ?? "Error al enviar"));
      setContactStatus("sent");
    } catch (err: unknown) {
      setContactStatus("error");
      setContactError(err instanceof Error ? err.message : (content?.errorMessages?.unexpected ?? "Error inesperado. Inténtalo de nuevo."));
    }
  };

  const currentRef = useRef(0);

  useEffect(() => {
    let mounted = true;
    const load = (attempt = 1) => {
      fetch(`${BASE_URL}/api/cms/content`, { credentials: "include" })
        .then(r => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json(); })
        .then(data => { if (mounted && data?.hero) setContent({ ...LANDING_FALLBACK, ...data }); })
        .catch(() => {
          if (!mounted) return;
          if (attempt < 4) setTimeout(() => load(attempt + 1), 1500 * attempt);
        });
    };
    load();
    return () => { mounted = false; };
  }, []);



  // Actualiza window.location.hash sin recargar (URL absoluta + reaplicado tras 50ms
  // para sobrevivir a cualquier re-render disparado por goToSection).
  const setHashRobust = useCallback((id: string) => {
    const apply = () => {
      try {
        const url = `${window.location.pathname}${window.location.search}#${id}`;
        window.history.replaceState(null, "", url);
      } catch {
        try { window.location.hash = id; } catch {}
      }
    };
    apply();
    setTimeout(apply, 50);
  }, []);

  const goToSection = useCallback((index: number) => {
    const clamped = Math.max(0, Math.min(index, FP_SECTION_IDS.length - 1));
    currentRef.current = clamped;
    setCurrentSection(clamped);
    setAnimatedSections(prev => new Set([...prev, FP_SECTION_IDS[clamped]]));
    const section = document.getElementById(FP_SECTION_IDS[clamped]);
    if (section) section.scrollIntoView({ behavior: "smooth", block: "start" });
  }, []);

  // Resolve a CMS href (e.g. "#cta", "#contact", "#fp-pricing", "planes") to a
  // real landing section id. Returns null when it can't be mapped to a section.
  const resolveSectionId = useCallback((href?: string): string | null => {
    if (!href) return null;
    const id = href.trim().replace(/^#/, "").toLowerCase();
    if (!id) return null;
    const alias: Record<string, string> = {
      cta: "fp-contact", "fp-cta": "fp-contact",
      contact: "fp-contact", contacto: "fp-contact", contacta: "fp-contact", contactar: "fp-contact",
      how: "fp-process", "fp-how": "fp-process", como: "fp-process", "cómo": "fp-process", proceso: "fp-process",
      planes: "fp-pricing", precios: "fp-pricing", pricing: "fp-pricing",
      demo: "fp-portfolio", "fp-demo": "fp-portfolio", resultados: "fp-portfolio", results: "fp-portfolio", "fp-results": "fp-portfolio", portfolio: "fp-portfolio",
      motores: "fp-services", engines: "fp-services", "fp-engines": "fp-services", servicios: "fp-services", services: "fp-services",
      plataformas: "fp-platforms", platforms: "fp-platforms",
      calculadora: "fp-calculator", calculator: "fp-calculator",
      inicio: "fp-hero", home: "fp-hero",
    };
    if (alias[id]) return alias[id];
    if (FP_SECTION_IDS.includes(id)) return id;
    if (FP_SECTION_IDS.includes(`fp-${id}`)) return `fp-${id}`;
    return null;
  }, []);

  // Navigate based on a CMS-configured href, honoring its target instead of a
  // hardcoded section index. Falls back to the given index when unmappable.
  const goToHref = useCallback((href: string | undefined, fallbackIndex: number) => {
    const id = resolveSectionId(href);
    if (id) {
      const idx = FP_SECTION_IDS.indexOf(id);
      if (idx !== -1) { goToSection(idx); setHashRobust(id); return; }
    }
    if (href && /^https?:\/\//i.test(href)) { window.open(href, "_blank", "noopener"); return; }
    if (href && href.startsWith("/")) { window.location.assign(href); return; }
    goToSection(fallbackIndex);
  }, [resolveSectionId, goToSection, setHashRobust]);

  useEffect(() => {
    if (!content) return;
    setAnimatedSections(prev => new Set([...prev, FP_SECTION_IDS[0]]));
    setCurrentSection(0);
    currentRef.current = 0;

    const sections = [...document.querySelectorAll<HTMLElement>(".fp-section")];
    const obs = new IntersectionObserver(entries => {
      entries.forEach(e => {
        if (e.isIntersecting) {
          const idx = sections.indexOf(e.target as HTMLElement);
          if (idx !== -1) {
            currentRef.current = idx;
            setCurrentSection(idx);
            setAnimatedSections(prev => new Set([...prev, FP_SECTION_IDS[idx]]));
          }
        }
      });
    }, { root: null, threshold: 0.15 });

    sections.forEach(s => obs.observe(s));
    return () => obs.disconnect();
  }, [content]);

  // ── WHEEL / KEYBOARD / TOUCH scroll entre secciones ──────────────────────
  useEffect(() => {
    if (!content) return;

    const THROTTLE = 700; // ms entre saltos de sección
    let lastNav = 0;

    // Solo activar snap en desktop real: ancho > 900px Y alto > 600px.
    // En landscape de phone (ej. Pixel ~915×412) el alto < 600, así que
    // el scroll nativo funciona sin interferencia.
    const isFullpageMode = () => window.innerWidth > 900 && window.innerHeight > 600;

    // Comprueba si el elemento o algún ancestro es scrollable (excluyendo window/body)
    const isInsideScrollable = (el: EventTarget | null): boolean => {
      let node = el as HTMLElement | null;
      while (node && node !== document.body) {
        const st = window.getComputedStyle(node);
        const oy = st.overflowY;
        if ((oy === "auto" || oy === "scroll") && node.scrollHeight > node.clientHeight + 2) return true;
        node = node.parentElement;
      }
      return false;
    };

    const navigate = (delta: 1 | -1) => {
      const now = Date.now();
      if (now - lastNav < THROTTLE) return;
      lastNav = now;
      const next = Math.max(0, Math.min(currentRef.current + delta, FP_SECTION_IDS.length - 1));
      if (next === currentRef.current) return;
      goToSection(next);
      setHashRobust(FP_SECTION_IDS[next]);
    };

    // Wheel — solo en desktop
    const onWheel = (e: WheelEvent) => {
      if (!isFullpageMode()) return;
      if (isInsideScrollable(e.target)) return;
      if (Math.abs(e.deltaY) < 30) return; // ignorar trackpad fino
      const delta = e.deltaY > 0 ? 1 : -1;
      const next = Math.max(0, Math.min(currentRef.current + delta, FP_SECTION_IDS.length - 1));
      // En el límite (primera/última sección) dejamos el scroll nativo para
      // que el usuario pueda llegar al footer sin que el fullpage lo bloquee.
      if (next === currentRef.current) return;
      e.preventDefault();
      navigate(delta);
    };

    // Teclado — solo en desktop
    const onKey = (e: KeyboardEvent) => {
      if (!isFullpageMode()) return;
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement || e.target instanceof HTMLSelectElement) return;
      if (e.key === "ArrowDown" || e.key === "PageDown" || e.key === " ") { e.preventDefault(); navigate(1); }
      if (e.key === "ArrowUp"   || e.key === "PageUp")                    { e.preventDefault(); navigate(-1); }
    };

    // Touch swipe — solo en desktop (tablets grandes > 900×600)
    // En phone (portrait o landscape) el scroll nativo es libre.
    let touchStartY = 0;
    const onTouchStart = (e: TouchEvent) => { touchStartY = e.touches[0].clientY; };
    const onTouchEnd   = (e: TouchEvent) => {
      if (!isFullpageMode()) return;
      if (isInsideScrollable(e.target)) return;
      const dy = touchStartY - e.changedTouches[0].clientY;
      if (Math.abs(dy) < 50) return; // swipe mínimo de 50px
      navigate(dy > 0 ? 1 : -1);
    };

    window.addEventListener("wheel",      onWheel,      { passive: false });
    window.addEventListener("keydown",    onKey);
    window.addEventListener("touchstart", onTouchStart, { passive: true  });
    window.addEventListener("touchend",   onTouchEnd,   { passive: true  });

    return () => {
      window.removeEventListener("wheel",      onWheel);
      window.removeEventListener("keydown",    onKey);
      window.removeEventListener("touchstart", onTouchStart);
      window.removeEventListener("touchend",   onTouchEnd);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [content, goToSection, setHashRobust]);

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
      if (e.data?.type === "cms-update-field" && e.data.path) {
        const path = e.data.path as string;
        if (!/^[a-zA-Z0-9._]+$/.test(path)) return;
        const el = document.querySelector(`[data-cms-path="${CSS.escape(path)}"]`) as HTMLElement;
        if (el && typeof e.data.value === "string") {
          el.textContent = e.data.value;
        }
        setContent(prev => {
          if (!prev) return prev;
          const updated = JSON.parse(JSON.stringify(prev));
          const keys = path.split(".");
          let cur: any = updated;
          for (let i = 0; i < keys.length - 1; i++) {
            const nxt = cur[keys[i]];
            if (typeof nxt === "object" && nxt !== null) cur = nxt;
            else return prev;
          }
          cur[keys[keys.length - 1]] = e.data.value;
          return updated as typeof prev;
        });
      }
    };
    window.addEventListener("message", handler);
    return () => window.removeEventListener("message", handler);
  }, [isPreview, goToSection]);


  const pad = (n: number) => String(n).padStart(2, "0");
  const isAnimated = (id: string) => animatedSections.has(id);
  const eff = (sectionKey: string) => (content as any)?.effects?.[sectionKey] ?? "fadeUp";

  const parentOrigin = isPreview ? window.location.origin : "";

  const cmsNotify = useCallback((path: string, e: React.MouseEvent) => {
    if (!isPreview) return;
    e.stopPropagation();
    window.parent.postMessage({ type: "cms-click-to-edit", path }, parentOrigin || "*");
  }, [isPreview, parentOrigin]);

  const cmsClick = useCallback((path: string) => {
    if (!isPreview) return undefined;
    return (e: React.MouseEvent) => cmsNotify(path, e);
  }, [isPreview, cmsNotify]);

  const cmsProps = useCallback((path: string) => {
    if (!isPreview) return {};
    return {
      onClick: (e: React.MouseEvent) => cmsNotify(path, e),
      title: `Editar: ${path}`,
      "data-cms-path": path,
      contentEditable: true,
      suppressContentEditableWarning: true,
      onBlur: (e: React.FocusEvent<HTMLElement>) => {
        const newText = e.currentTarget.innerText;
        window.parent.postMessage({
          type: "cms-inline-edit",
          path,
          value: newText,
        }, parentOrigin || "*");
      },
    };
  }, [isPreview, cmsNotify, parentOrigin]);

  const cmsData = useCallback((path: string) => {
    if (!isPreview) return {};
    return {
      title: `Editar: ${path}`,
      "data-cms-path": path,
    };
  }, [isPreview]);

  const progressPct = FP_SECTIONS.length > 1 ? (currentSection / (FP_SECTIONS.length - 1)) * 100 : 0;

  const bgFor = (section: string) => content.backgrounds?.[section] ?? { type: "none" };
  const videoBg = (section: string) => {
    const bg = bgFor(section);
    if (bg.type !== "video" || !bg.videoUrl) return null;
    const src = bg.videoUrl.startsWith("/") ? `${API_BASE_LANDING}${bg.videoUrl}` : bg.videoUrl;
    return <SectionVideoBg src={src} />;
  };

  const calcDefaults = { pill: "Calcula tu precio", headline: "¿Cuánto cuesta optimizar tu tienda?", headlineHighlight: "optimizar tu tienda", subheadline: "Selecciona los servicios que necesitas.", disclaimer: "* Precios orientativos.", resultLabel: "Precio estimado", oneTimeLabel: "Pago único", recurringLabel: "Suscripción mensual", ctaLabel: "Solicitar presupuesto →", emptyLabel: "Selecciona al menos un servicio", oneTimeServices: [] as { id: string; name: string; description: string; price: number; icon: string }[], recurringServices: [] as { id: string; name: string; description: string; price: number; period: string; icon: string }[] };
  const calc = content.calculator ?? calcDefaults;
  const calcOneTimeTotal = calc.oneTimeServices.reduce((sum, s) => sum + (Number(s.price) || 0) * (calcQuantities[s.id] || 0), 0);
  const calcRecurringService = calcSelectedRecurring ? calc.recurringServices.find(s => s.id === calcSelectedRecurring) : null;
  const calcRecurringTotal = calcRecurringService ? (Number(calcRecurringService.price) || 0) : 0;
  const calcActiveServices = calc.oneTimeServices.filter(s => (calcQuantities[s.id] || 0) > 0);

  const calcCategories: { key: string; label: string; icon: string; ids: string[] }[] = (calc as Record<string,unknown>).categories && Array.isArray((calc as Record<string,unknown>).categories) && ((calc as Record<string,unknown>).categories as unknown[]).length > 0
    ? (calc as Record<string,unknown>).categories as { key: string; label: string; icon: string; ids: string[] }[]
    : [
    { key: "all", label: "Todos", icon: "🔥", ids: [] },
    { key: "products", label: "Productos", icon: "📦", ids: ["calc-product-1", "calc-redesign-1", "calc-redesign-partial", "calc-images-product", "calc-seo-product"] },
    { key: "packs", label: "Packs", icon: "🎁", ids: ["calc-pack-5", "calc-pack-10", "calc-pack-20", "calc-pack-30", "calc-images-30", "calc-photoshoot"] },
    { key: "design", label: "Diseño", icon: "🎨", ids: ["calc-theme-css", "calc-theme-section", "calc-homepage", "calc-product-page", "calc-responsive", "calc-brand-kit", "calc-brand-guide", "calc-lab-web"] },
    { key: "seo", label: "SEO", icon: "🔍", ids: ["calc-seo-full", "calc-blog-5"] },
    { key: "reports", label: "Informes", icon: "📊", ids: ["calc-audit", "calc-pricing-report", "calc-competitor", "calc-projection", "calc-consistency", "calc-ab-testing"] },
    { key: "tools", label: "Herramientas", icon: "🛠️", ids: ["calc-generator", "calc-inventory", "calc-email-setup", "calc-supplier", "calc-session", "calc-posts-30", "calc-app-install"] },
  ];
  const filteredOneTimeServices = calcCategory === "all"
    ? calc.oneTimeServices
    : calc.oneTimeServices.filter(s => calcCategories.find(c => c.key === calcCategory)?.ids.includes(s.id));

  return (
    <div className={`l-root${isPreview ? " cms-preview-mode" : ""}`}>
      {/* ── CURSOR GLOW SPOTLIGHT ── */}
      <div
        className="fp-cursor-glow"
        ref={(el) => {
          if (!el) return;
          const move = (e: MouseEvent) => {
            el.style.transform = `translate(calc(${e.clientX}px - 50%), calc(${e.clientY}px - 50%))`;
          };
          window.addEventListener("mousemove", move, { passive: true });
          (el as any).__cleanup = () => window.removeEventListener("mousemove", move);
        }}
      />
      <PageMeta {...metaFor("/")} />
      {/* ── FIXED NAV ── */}
      <nav className="l-nav l-nav-fp">
        <a href="#" className="l-nav-logo" onClick={e => { e.preventDefault(); goToSection(0); }}>
          {content.site.logo.imageUrl && !logoError ? (
            <img src={`${API_BASE_LANDING}${content.site.logo.imageUrl}`} alt="" width={32} height={32} style={{ height: 32, width: 32, borderRadius: 6 }} onError={() => setLogoError(true)} />
          ) : (
            <img src={APP_LOGO} alt="" width={34} height={34} className="lx-logo-img" />
          )}
          <div className="l-nav-logo-text">{content.site.name}</div>
        </a>
        <ul className="l-nav-links">
          {FP_SECTIONS.map((sec, i) => (
            <li key={sec.id}>
              <a href={`#${sec.id}`} className={currentSection === i ? "l-nav-active" : ""} onClick={e => { e.preventDefault(); goToSection(i); setHashRobust(sec.id); }}>{sec.nav}</a>
            </li>
          ))}
        </ul>
        <div className="l-nav-ctas">
          {isAdmin ? (
            <Link href="/admin/clients" className="l-btn-gold">{content.adminBackLabel ?? "← Volver al panel"}</Link>
          ) : (
            <>
              <Link href="/login" className="l-btn-ghost" {...cmsData("nav.ctaSecondary.label")}>{content.nav.ctaSecondary.label}</Link>
              <a href="#fp-contact" className="l-btn-gold" onClick={e => { e.preventDefault(); if (isPreview) { cmsNotify("nav.ctaPrimary.label", e); } else { goToSection(FP_SECTION_IDS.indexOf("fp-contact")); setHashRobust("fp-contact"); } }} {...cmsData("nav.ctaPrimary.label")}>{content.nav.ctaPrimary.label}</a>
            </>
          )}
        </div>
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
      <div className="fp-container" id="fullpage">
        <div className="fp-wrapper">

        {/* ══════════════════════════════════════
            SECTION 01 — HERO
        ══════════════════════════════════════ */}
        <section ref={heroSectionRef} className="fp-section" id="fp-hero" data-nav="Inicio" data-effect={eff("hero")}
          onMouseMove={handleHeroMouseMove} onMouseLeave={handleHeroMouseLeave}>
          <div className="fp-bg">
            {videoBg("hero")}
            {/* ── Aurora (21st.dev style) — gold/jade conic gradients rotating ── */}
            <div className="hero-aurora" aria-hidden="true"><div className="hero-aurora-inner" /></div>
            {/* ── Lamp cone — golden cone of light from top ── */}
            <div className="hero-lamp-cone" style={{ transform: `translateX(calc(-50% + ${heroTilt.x * 0.3}px))` }} aria-hidden="true" />
            <div className="hero-lamp-line" aria-hidden="true" />
            {/* ── Falling light beams ── */}
            <div className="hero-beams" aria-hidden="true">
              {[
                { left: "8%",  dur: "4.2s", delay: "0s",   opacity: 0.45 },
                { left: "22%", dur: "6.1s", delay: "1.4s",  opacity: 0.30 },
                { left: "38%", dur: "3.8s", delay: "0.5s",  opacity: 0.55 },
                { left: "55%", dur: "5.5s", delay: "2.2s",  opacity: 0.35 },
                { left: "68%", dur: "4.0s", delay: "0.9s",  opacity: 0.50 },
                { left: "80%", dur: "7.0s", delay: "3.1s",  opacity: 0.25 },
                { left: "92%", dur: "3.5s", delay: "1.8s",  opacity: 0.40 },
              ].map((b, i) => (
                <div key={i} className="hero-beam" style={{ left: b.left, animationDuration: b.dur, animationDelay: b.delay, opacity: b.opacity }} />
              ))}
            </div>
            {/* ── Subtle dot grid ── */}
            <div className="l-hero-grid" />
            {/* ── Parallax orbs ── */}
            <div className="fp-hero-orb fp-orb-gold" style={{ transform: `translate(${heroTilt.x * -2}px, ${heroTilt.y * -1.5}px)` }} />
            <div className="fp-hero-orb fp-orb-jade" style={{ transform: `translate(${heroTilt.x * 1.5}px, ${heroTilt.y * 2}px)` }} />
          </div>
          <div className="fp-bg-overlay" style={{ background: "rgba(8,8,16,0.48)" }}></div>

          <div className="fp-content fp-hero-layout">
            <div className="fp-hero-left">
              <div className={`l-hero-pill ${!isAnimated("fp-hero") ? "fp-animate" : "fp-animated"}`} style={{ animationDelay: "0s" }}>
                <div className="l-pill-dot"></div>
                {HERO.pill}
              </div>
              <h1 className={`l-hero-h1 ${!isAnimated("fp-hero") ? "fp-animate" : "fp-animated"}`} style={{ animationDelay: "0.1s" }}>
                {HERO.headline.map((line, i) => (
                  <span key={i} className={i > 0 ? "l-block" : undefined}>
                    {line.includes(HERO.highlight)
                      ? <>{line.split(HERO.highlight)[0]}<span>{HERO.highlight}</span>{line.split(HERO.highlight)[1]}</>
                      : line}
                  </span>
                ))}
              </h1>
              <p className={`l-hero-sub ${!isAnimated("fp-hero") ? "fp-animate" : "fp-animated"}`} style={{ animationDelay: "0.22s" }}>{HERO.sub}</p>
              <div className={`l-hero-ctas ${!isAnimated("fp-hero") ? "fp-animate" : "fp-animated"}`} style={{ animationDelay: "0.34s" }}>
                <a href="#fp-contact" className="l-btn-primary btn-jelly" onClick={e => { e.preventDefault(); goToSection(FP_SECTION_IDS.indexOf("fp-contact")); setHashRobust("fp-contact"); }}>Solicitar propuesta →</a>
                <a href="#fp-portfolio" className="l-btn-secondary btn-jelly" onClick={e => { e.preventDefault(); goToSection(FP_SECTION_IDS.indexOf("fp-portfolio")); setHashRobust("fp-portfolio"); }}>Ver portfolio</a>
              </div>
              <div className={`l-hero-trust ${!isAnimated("fp-hero") ? "fp-animate" : "fp-animated"}`} style={{ animationDelay: "0.46s" }}>
                {HERO.trust.map(item => (
                  <div key={item} className="l-trust-item"><div className="l-trust-check">✓</div>{item}</div>
                ))}
              </div>
            </div>

            <div className={`fp-hero-right ${!isAnimated("fp-hero") ? "fp-animate" : "fp-animated"}`} style={{ animationDelay: "0.2s", position: "relative" }}>
              <div className="l-preview-glow"></div>
              <div className="lx-facts" style={{ transform: `perspective(1200px) rotateY(${heroTilt.x * 0.4}deg) rotateX(${-heroTilt.y * 0.4}deg)` }}>
                {HERO.facts.map((f, i) => (
                  <div key={f.label} className={`lx-fact lx-fact-${i}`}>
                    <div className="lx-fact-val">{f.value}</div>
                    <div className="lx-fact-lbl">{f.label}</div>
                    <div className="lx-fact-sub">{f.sub}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <MagnetStoreButton />

          <div className="fp-scroll-hint">
            <div className="fp-scroll-hint-text">Desliza para explorar</div>
            <div className="fp-scroll-hint-arrow">↓</div>
          </div>
        </section>

        {/* ══════════════════════════════════════
            SECTION 02 — SERVICIOS
        ══════════════════════════════════════ */}
        <section className="fp-section fp-section-dark" id="fp-services" data-nav="Servicios" data-effect={eff("engines")}>
          <div className="fp-bg-solid">{videoBg("features")}</div>
          <div className="fp-content lx-wrap">
            <div className={`fp-section-header ${!isAnimated("fp-services") ? "fp-animate" : "fp-animated"}`}>
              <div className="l-pill">Qué hacemos</div>
              <h2 className="l-h2">Un solo equipo para tu tienda, <em>tu web y tu app.</em></h2>
              <p className="l-sub lx-sub">Plataforma de IA propia y personas que la operan para ti.</p>
            </div>
            <div className={`lx-services ${!isAnimated("fp-services") ? "fp-animate" : "fp-animated"}`} style={{ animationDelay: "0.1s" }}>
              {SERVICES.map(svc => (
                <article key={svc.id} className="lx-service" style={{ ["--lx-accent" as string]: svc.accent }}>
                  <div className="lx-service-icon" aria-hidden="true">{svc.icon}</div>
                  <h3 className="lx-service-title">{svc.title}</h3>
                  <p className="lx-service-text">{svc.text}</p>
                  <ul className="lx-tags">
                    {svc.items.map(it => <li key={it}>{it}</li>)}
                  </ul>
                  <Link href={svc.href} className="lx-link">{svc.cta} →</Link>
                </article>
              ))}
            </div>
          </div>
        </section>

        {/* ══════════════════════════════════════
            SECTION 03 — PLATAFORMAS
        ══════════════════════════════════════ */}
        <section className="fp-section" id="fp-platforms" data-nav="Plataformas" data-effect={eff("demo")}>
          <div className="fp-bg">
            {videoBg("how")}
            <div className="l-hero-grid" style={{ opacity: 0.25 }}></div>
          </div>
          <div className="fp-bg-overlay" style={{ background: "rgba(8,8,16,0.82)" }}></div>
          <div className="fp-content lx-wrap">
            <div className={`fp-section-header ${!isAnimated("fp-platforms") ? "fp-animate" : "fp-animated"}`}>
              <div className="l-pill">Conexión nativa</div>
              <h2 className="l-h2">Trabajamos donde ya <em>vende tu negocio.</em></h2>
              <p className="l-sub lx-sub">Sin migraciones obligatorias: nos conectamos a tu plataforma por su API oficial.</p>
            </div>
            <div className={`lx-platforms ${!isAnimated("fp-platforms") ? "fp-animate" : "fp-animated"}`} style={{ animationDelay: "0.1s" }}>
              {PLATFORMS.map(p => (
                <Link key={p.key} href={p.href} className="lx-platform" style={{ ["--lx-brand" as string]: p.color }}>
                  <div className="lx-platform-head">
                    <span className="lx-platform-dot" aria-hidden="true" />
                    <h3>{p.name}</h3>
                  </div>
                  <div className="lx-platform-conn">{p.connection}</div>
                  <ul>
                    {p.capabilities.map(c => <li key={c}>{c}</li>)}
                  </ul>
                  <span className="lx-link">Ver {p.name} →</span>
                </Link>
              ))}
            </div>
            <p className="lx-note">¿Otra plataforma? Auditamos cualquier web a partir de su URL pública.</p>
          </div>
        </section>

        {/* ══════════════════════════════════════
            SECTION 04 — PORTFOLIO
        ══════════════════════════════════════ */}
        <section className="fp-section fp-section-dark" id="fp-portfolio" data-nav="Portfolio" data-effect={eff("results")}>
          <div className="fp-bg-solid">{videoBg("results")}</div>
          <div className="fp-content lx-wrap">
            <div className={`fp-section-header ${!isAnimated("fp-portfolio") ? "fp-animate" : "fp-animated"}`}>
              <div className="l-pill">Portfolio</div>
              <h2 className="l-h2">Lo que construimos, <em>abierto para que lo pruebes.</em></h2>
              <p className="l-sub lx-sub">{WEB_DEMOS.length} demos web interactivas y nuestra propia app Android.</p>
            </div>
            <div className={`lx-portfolio ${!isAnimated("fp-portfolio") ? "fp-animate" : "fp-animated"}`} style={{ animationDelay: "0.1s" }}>
              <ul className="lx-demos">
                {FEATURED_DEMOS.map(i => WEB_DEMOS[i]).filter(Boolean).map(d => (
                  <li key={d.file}>
                    <a href={`/web-demos/${d.file}`} target="_blank" rel="noopener" className="lx-demo">
                      <span className="lx-demo-num">{d.file.slice(0, 2)}</span>
                      <span className="lx-demo-title">{d.title}</span>
                      <span className="lx-demo-tags">{d.tags.join(" · ")}</span>
                    </a>
                  </li>
                ))}
              </ul>
              <div className="lx-app">
                <div className="lx-app-phone" aria-hidden="true">
                  <div className="lx-app-notch" />
                  <div className="lx-app-screen"><img src={APP_LOGO} alt="" width={46} height={46} /></div>
                </div>
                <div>
                  <h3>App Android de Shopy Crafter</h3>
                  <p>Construida con Capacitor sobre la misma base de código que la web. Así convertimos webs y tiendas en apps nativas.</p>
                  <ApkDownloadButton labels={content.apkLabels} />
                </div>
              </div>
            </div>
            <div className="lx-center">
              <Link href="/portfolio" className="l-btn-secondary btn-jelly">Ver las {WEB_DEMOS.length} demos →</Link>
            </div>
          </div>
        </section>

        {/* ══════════════════════════════════════
            SECTION 05 — PROCESO + PORTAL
        ══════════════════════════════════════ */}
        <section className="fp-section" id="fp-process" data-nav="Proceso" data-effect={eff("demo")}>
          <div className="fp-bg">
            <div className="l-hero-grid" style={{ opacity: 0.2 }}></div>
          </div>
          <div className="fp-bg-overlay" style={{ background: "rgba(8,8,16,0.85)" }}></div>
          <div className="fp-content fp-split-layout">
            <div className={`fp-split-left ${!isAnimated("fp-process") ? "fp-animate" : "fp-animated"}`}>
              <div className="l-pill">Cómo trabajamos</div>
              <h2 className="l-h2">Nada se publica <em>sin tu visto bueno.</em></h2>
              <ol className="lx-steps">
                {PROCESS.map(step => (
                  <li key={step.num}>
                    <span className="lx-step-num">{step.num}</span>
                    <div>
                      <div className="lx-step-title">{step.title}</div>
                      <div className="lx-step-text">{step.text}</div>
                    </div>
                  </li>
                ))}
              </ol>
            </div>
            <div className={`fp-split-right ${!isAnimated("fp-process") ? "fp-animate" : "fp-animated"}`} style={{ animationDelay: "0.15s" }}>
              <div className="lx-portal">
                <div className="lx-portal-head">Tu portal de cliente</div>
                <p className="lx-portal-sub">Privado: cada cliente ve solo su proyecto.</p>
                <ul>
                  {PORTAL_FEATURES.map(f => (
                    <li key={f.title}>
                      <span className="lx-portal-ico" aria-hidden="true">{f.icon}</span>
                      <div><strong>{f.title}</strong><span>{f.text}</span></div>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        </section>

        {/* ══════════════════════════════════════
            SECTION 05 — PRICING (3 cards)
        ══════════════════════════════════════ */}
        <section className="fp-section fp-section-dark" id="fp-pricing" data-nav="Precios" data-effect={eff("pricing")}>
          <div className="fp-bg-solid">{videoBg("pricing")}</div>
          <div className="fp-content fp-pricing-layout">
            <div className={`fp-section-header ${!isAnimated("fp-pricing") ? "fp-animate" : "fp-animated"}`} style={{ animationDelay: "0s" }}>
              <div className="l-pill" {...cmsProps("pricing.pill")}>{content.pricing.pill}</div>
              <h2 className="l-h2" onClick={cmsClick("pricing.headline")} {...cmsData("pricing.headline")}>{String(content.pricing.headline ?? "").split(".")[0]}. <em>{String(content.pricing.headline ?? "").split(".").slice(1).join(".")}</em></h2>
              <p className="l-sub" {...cmsProps("pricing.subheadline")}>{content.pricing.subheadline}</p>
            </div>
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8, marginBottom: 18 }}>
              <div className="fp-billing-toggle" data-period={billingPeriod}>
                <div className={`fp-bt-pill${billingPeriod === "annual" ? " fp-bt-pill-right" : ""}`} />
                <button type="button" className={`fp-bt-btn${billingPeriod === "monthly" ? " active" : ""}`} onClick={() => { setBillingPeriod("monthly"); setPricingIdx(0); }}>
                  Mensual
                </button>
                <button type="button" className={`fp-bt-btn${billingPeriod === "annual" ? " active" : ""}`} onClick={() => { setBillingPeriod("annual"); setPricingIdx(0); }}>
                  Anual
                </button>
              </div>
              {annualSavingPct > 0 && <span className={`fp-bt-save-ext${billingPeriod === "annual" ? " active" : ""}`} style={{ opacity: billingPeriod === "annual" ? 1 : 0.38 }}>🎁 Ahorra {annualSavingPct}% con el plan anual</span>}
            </div>
            <div className="fp-pricing-carousel-wrap">
              {pricingIdx > 0 && (
                <button type="button" className="fp-pricing-arrow fp-pricing-arrow-left" onClick={() => scrollPricing(-1)} aria-label="Plan anterior">‹</button>
              )}
              <div ref={pricingRowRef} className={`fp-pricing-row ${!isAnimated("fp-pricing") ? "fp-animate" : "fp-animated"}`} style={{ animationDelay: "0.1s" }}>
                {displayPlans.map((plan, planIdx) => (
                  <div
                    key={plan.id}
                    className={`l-pricing-card fp-pricing-card${plan.featured ? " l-pricing-featured" : ""}`}
                    onMouseLeave={handleCardMouseLeave}
                  >
                    <div className="l-pricing-body">
                      <div className="pc-glare" />
                      {plan.badge && <div className="l-pricing-badge" {...cmsProps(`pricing.plans.${planIdx}.badge`)}>{plan.badge}</div>}
                      {plan.featured && <div className="pc-savings-tag">✨ MÁS POPULAR</div>}
                      <div className="l-pricing-plan" style={{ position: "relative", zIndex: 2 }} {...cmsProps(`pricing.plans.${planIdx}.name`)}>{plan.name}</div>
                      <div style={{ position: "relative", zIndex: 2 }}>
                        <div className="l-pricing-price">{plan.priceMonthly === 0 ? <span style={{ fontSize: "0.55em", letterSpacing: "-1px" }}>A medida</span> : <>{plan.currency}{billingPeriod === "monthly" ? plan.priceMonthly : Math.round(plan.priceAnnual / 12)}</>}</div>
                        <div className={`pc-annual-pill${billingPeriod === "annual" && plan.priceMonthly > 0 ? " visible" : ""}`}>
                          {plan.priceMonthly * 12 > plan.priceAnnual && <span className="pc-annual-pill-pct">−{Math.round((1 - plan.priceAnnual / (plan.priceMonthly * 12)) * 100)}%</span>}
                          <span className="pc-annual-pill-txt">{plan.currency}{plan.priceAnnual > 0 ? plan.priceAnnual : "—"}/año{plan.priceMonthly * 12 > plan.priceAnnual ? <> · ahorras {plan.currency}{plan.priceMonthly * 12 - plan.priceAnnual}</> : null}</span>
                        </div>
                      </div>
                      <div className="l-pricing-period" style={{ position: "relative", zIndex: 2 }}>{billingPeriod === "monthly" ? "/mes · sin permanencia" : "/mes · facturado anual"}</div>
                      <div className="l-pricing-divider" style={{ position: "relative", zIndex: 2 }}></div>
                      <ul className="l-pricing-features" style={{ position: "relative", zIndex: 2 }}>
                        {plan.features.map((f, fi) => (
                          <li key={fi} className="l-pricing-feature">
                            <div className={f.included ? "l-pricing-check" : "l-pricing-x"}>{f.included ? "✓" : "✕"}</div>
                            <span style={f.included ? undefined : { color: "var(--l-t3)", fontSize: 12 }}>{f.text}</span>
                          </li>
                        ))}
                      </ul>
                      <a
                        href="#fp-contact"
                        className={`l-pricing-cta btn-jelly ${plan.cta.style}`}
                        style={{ position: "relative", zIndex: 2 }}
                        onClick={e => { e.preventDefault(); const idx = FP_SECTION_IDS.indexOf("fp-contact"); if (idx >= 0) goToSection(idx); setHashRobust("fp-contact"); }}
                        {...cmsProps(`pricing.plans.${planIdx}.cta.label`)}
                      >{plan.cta.label}</a>
                      <p style={{ textAlign: "center", fontSize: 10.5, color: "rgba(255,255,255,0.3)", marginTop: 10, position: "relative", zIndex: 2 }}>{billingPeriod === "monthly" ? "Sin permanencia · Cancela cuando quieras" : "Renovación anual · Cancela antes del vencimiento"}</p>
                    </div>
                  </div>
                ))}
              </div>
              {pricingIdx < (displayPlans.length - 1) && (
                <button type="button" className="fp-pricing-arrow fp-pricing-arrow-right" onClick={() => scrollPricing(1)} aria-label="Plan siguiente">›</button>
              )}
            </div>
            <div className="fp-pricing-dots">
              {displayPlans.map((plan, i) => (
                <button key={plan.id} type="button" className={`fp-pricing-dot${i === pricingIdx ? " active" : ""}`}
                  onClick={() => { const row = pricingRowRef.current; if (row) { const cards = row.querySelectorAll<HTMLElement>(".fp-pricing-card"); if (cards[i]) { cards[i].scrollIntoView({ behavior: "smooth", block: "nearest", inline: "center" }); setPricingIdx(i); } } }}
                  aria-label={plan.name} />
              ))}
            </div>
          </div>
        </section>

        {/* ══════════════════════════════════════
            SECTION 06 — CALCULADORA DE PRECIOS
        ══════════════════════════════════════ */}
        <section className="fp-section" id="fp-calculator" data-nav="Calculadora" data-effect={eff("calculator")}>
          <div className="fp-bg">
            {videoBg("calculator")}
            <div className="l-hero-grid" style={{ opacity: 0.2 }}></div>
          </div>
          <div className="fp-bg-overlay" style={{ background: "rgba(8,8,16,0.75)" }}></div>
          <div className="fp-content" style={{ maxWidth: 1100, padding: "0 24px" }}>
            <div className={`fp-section-header ${!isAnimated("fp-calculator") ? "fp-animate" : "fp-animated"}`} style={{ animationDelay: "0s" }}>
              <div className="l-pill" {...cmsProps("calculator.pill")}>{calc.pill}</div>
              <h2 className="l-h2" onClick={cmsClick("calculator.headline")} {...cmsData("calculator.headline")}>
                {calc.headlineHighlight && String(calc.headline ?? "").includes(calc.headlineHighlight)
                  ? String(calc.headline ?? "").split(calc.headlineHighlight).flatMap((p, i, arr) =>
                      i < arr.length - 1 ? [p, <em key={i}>{calc.headlineHighlight}</em>] : [p]
                    )
                  : (calc.headline ?? "")}
              </h2>
              <p className="l-sub" {...cmsProps("calculator.subheadline")}>{calc.subheadline}</p>
            </div>

            <div className={`fp-calc-grid ${!isAnimated("fp-calculator") ? "fp-animate" : "fp-animated"}`} style={{ animationDelay: "0.1s" }}>
              <div className="fp-calc-services">
                <div className="fp-calc-group">
                  <h3 className="fp-calc-group-title">{calc.oneTimeLabel}</h3>
                  <div className="fp-calc-tabs">
                    {calcCategories.map(cat => (
                      <button key={cat.key} type="button" className={`fp-calc-tab${calcCategory === cat.key ? " active" : ""}`}
                        onClick={() => setCalcCategory(cat.key)}>
                        <span>{cat.icon}</span> {cat.label}
                        {cat.key !== "all" && (() => {
                          const count = cat.ids.reduce((n, id) => n + (calcQuantities[id] || 0), 0);
                          return count > 0 ? <span className="fp-calc-tab-badge">{count}</span> : null;
                        })()}
                      </button>
                    ))}
                  </div>
                  <div className="fp-calc-items">
                    {filteredOneTimeServices.map(s => {
                      const qty = calcQuantities[s.id] || 0;
                      return (
                        <div key={s.id} className={`fp-calc-item${qty > 0 ? " selected" : ""}`}>
                          <span className="fp-calc-item-icon">{s.icon}</span>
                          <div className="fp-calc-item-info">
                            <span className="fp-calc-item-name">{s.name}</span>
                            <span className="fp-calc-item-desc">{s.description}</span>
                          </div>
                          <span className="fp-calc-item-price">{s.price}€<small>/ud</small></span>
                          <div className="fp-calc-qty">
                            <button type="button" className="fp-calc-qty-btn" onClick={() => setCalcQuantities(prev => {
                              const n = Math.max(0, (prev[s.id] || 0) - 1);
                              return { ...prev, [s.id]: n };
                            })}>−</button>
                            <span className="fp-calc-qty-val">{qty}</span>
                            <button type="button" className="fp-calc-qty-btn" onClick={() => setCalcQuantities(prev => ({
                              ...prev, [s.id]: Math.min(50, (prev[s.id] || 0) + 1)
                            }))}>+</button>
                          </div>
                          {qty > 0 && <span className="fp-calc-line-total">{(Number(s.price) || 0) * qty}€</span>}
                        </div>
                      );
                    })}
                  </div>
                </div>

                <div className="fp-calc-group">
                  <h3 className="fp-calc-group-title">{calc.recurringLabel}</h3>
                  <div className="fp-calc-items">
                    {calc.recurringServices.map(s => {
                      const selected = calcSelectedRecurring === s.id;
                      return (
                        <button key={s.id} type="button" className={`fp-calc-item fp-calc-item-recurring${selected ? " selected" : ""}`} onClick={() => {
                          setCalcSelectedRecurring(prev => prev === s.id ? null : s.id);
                        }}>
                          <span className="fp-calc-item-icon">{s.icon}</span>
                          <div className="fp-calc-item-info">
                            <span className="fp-calc-item-name">{s.name}</span>
                            <span className="fp-calc-item-desc">{s.description}</span>
                          </div>
                          <span className="fp-calc-item-price">{s.price}€<small>{s.period}</small></span>
                          <span className="fp-calc-item-check">{selected ? "✓" : "○"}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>

              <div className="fp-calc-summary">
                <div className="fp-calc-summary-inner">
                  <h3 className="fp-calc-summary-title">{calc.resultLabel}</h3>
                  {calcOneTimeTotal === 0 && !calcSelectedRecurring ? (
                    <p className="fp-calc-empty">{calc.emptyLabel}</p>
                  ) : (
                    <>
                      {calcActiveServices.length > 0 && (
                        <div className="fp-calc-breakdown">
                          <div className="fp-calc-breakdown-header">
                            <span>Servicio</span><span>Cant.</span><span>Subtotal</span>
                          </div>
                          {calcActiveServices.map(s => (
                            <div key={s.id} className="fp-calc-breakdown-row">
                              <span className="fp-calc-breakdown-name">{s.icon} {s.name}</span>
                              <span className="fp-calc-breakdown-qty">×{calcQuantities[s.id]}</span>
                              <span className="fp-calc-breakdown-price">{(Number(s.price) || 0) * (calcQuantities[s.id] || 0)}€</span>
                            </div>
                          ))}
                        </div>
                      )}
                      {calcOneTimeTotal > 0 && (
                        <div className="fp-calc-total-row">
                          <span className="fp-calc-total-label">{calc.oneTimeLabel}</span>
                          <span className="fp-calc-total-value">{calcOneTimeTotal}€</span>
                        </div>
                      )}
                      {calcRecurringTotal > 0 && (
                        <div className="fp-calc-total-row fp-calc-total-recurring">
                          <span className="fp-calc-total-label">{calc.recurringLabel}</span>
                          <span className="fp-calc-total-value">{calcRecurringTotal}€<small>/mes</small></span>
                        </div>
                      )}
                      <div className="fp-calc-divider" />
                      <div className="fp-calc-total-row fp-calc-grand-total">
                        <span className="fp-calc-total-label">Total</span>
                        <div style={{ textAlign: "right" }}>
                          {calcOneTimeTotal > 0 && <div className="fp-calc-grand-value">{calcOneTimeTotal}€ <small>pago único</small></div>}
                          {calcRecurringTotal > 0 && <div className="fp-calc-grand-value fp-calc-grand-recurring">+ {calcRecurringTotal}€<small>/mes</small></div>}
                        </div>
                      </div>
                      {calcActiveServices.length >= 3 && (
                        <div className="fp-calc-discount-hint">💡 ¿Necesitas más de 3 servicios? Solicita presupuesto personalizado con descuento por volumen.</div>
                      )}
                    </>
                  )}
                  <a href="#fp-contact" className="l-btn-gold fp-calc-cta" onClick={e => { e.preventDefault(); goToSection(FP_SECTION_IDS.indexOf("fp-contact")); setHashRobust("fp-contact"); }}>{calc.ctaLabel}</a>
                  <p className="fp-calc-disclaimer">{calc.disclaimer}</p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ══════════════════════════════════════
            SECTION 06 — FORMULARIO DE CONTACTO
        ══════════════════════════════════════ */}
        <section ref={contactSectionRef} className="fp-section fp-section-dark" id="fp-contact" data-nav="Contactar" data-effect={eff("contact")}>
          <div className="fp-bg">
            {videoBg("contact")}
            <div className="l-contact-bg" style={{
              position: "absolute", inset: 0,
              background: "radial-gradient(ellipse 80% 60% at 50% 50%, rgba(200,168,75,0.06) 0%, transparent 70%)",
            }} />
          </div>
          <div className="fp-content fp-contact-visme" style={{ position: "absolute", inset: 0, maxWidth: "none", padding: 0, overflow: "hidden auto" }}>
            {/* ── Video + form: fixed full-section height, footer scrolls below ── */}
            <div className="fp-contact-visme-wrapper" style={{ position: "relative", height: "calc(100dvh - 64px)", flexShrink: 0, overflow: "hidden" }}>
              <VismeFormHero isActive={isAnimated("fp-contact")} />
            </div>

            {/* ── Legacy form (preserved, hidden) ── */}
            <div style={{ display: "none" }}>
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
                <form onSubmit={submitContact} className={`fp-contact-form-v2${isAnimated("fp-contact") ? " fields-in" : ""}`}>
                  {/* Row 1: Nombre + Email */}
                  <div className="fp-contact-row" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(220px, 100%), 1fr))", gap: 16 }}>
                    <div>
                      <label className="fp-field-label">{content.contact?.labels?.name ?? "Nombre completo *"}</label>
                      <input type="text" required value={contactForm.name} onChange={CF("name")}
                        placeholder={content.contact?.placeholders?.name ?? "Tu nombre y apellidos"}
                        className="fp-input-v2" />
                    </div>
                    <div>
                      <label className="fp-field-label">{content.contact?.labels?.email ?? "Email de contacto *"}</label>
                      <input type="email" required value={contactForm.email} onChange={CF("email")}
                        placeholder={content.contact?.placeholders?.email ?? "tu@email.com"}
                        className="fp-input-v2" />
                    </div>
                  </div>

                  {/* Row 2: Teléfono + URL tienda */}
                  <div className="fp-contact-row" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(220px, 100%), 1fr))", gap: 16 }}>
                    <div>
                      <label className="fp-field-label">{content.contact?.labels?.phone ?? "Teléfono"}</label>
                      <input
                        type="tel" value={contactForm.phone} onChange={CF("phone")}
                        placeholder={content.contact?.placeholders?.phone ?? "+34 600 000 000"}
                        className="fp-input-v2"
                      />
                    </div>
                    <div>
                      <label className="fp-field-label">{content.contact?.labels?.storeUrl ?? "URL de tu tienda online"}</label>
                      <input
                        type="text" value={contactForm.storeUrl} onChange={CF("storeUrl")}
                        placeholder={content.contact?.placeholders?.storeUrl ?? "mitienda.com"}
                        className="fp-input-v2"
                      />
                    </div>
                  </div>

                  {/* Row 3: Nicho + Facturación */}
                  <div className="fp-contact-row" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(220px, 100%), 1fr))", gap: 16 }}>
                    <div>
                      <label className="fp-field-label">{content.contact?.labels?.niche ?? "Nicho / tipo de productos"}</label>
                      <select
                        value={contactForm.niche} onChange={CF("niche")}
                        className="fp-input-v2"
                      >
                        <option value="">{content.contact?.placeholders?.niche ?? "Selecciona tu nicho"}</option>
                        {(Array.isArray(content.contact?.nicheOptions) ? content.contact!.nicheOptions : ["Moda y ropa", "Electrónica y gadgets", "Hogar y decoración", "Belleza y cosmética", "Deporte y fitness", "Alimentación y gourmet", "Arte y coleccionismo", "Mascotas", "Joyería y accesorios", "Otro"]).map(o => (
                          <option key={o}>{o}</option>
                        ))}
                      </select>
                      {contactForm.niche === "Otro" && (
                        <input
                          type="text"
                          value={contactForm.customNiche}
                          onChange={CF("customNiche")}
                          placeholder="Describe tu nicho de negocio..."
                          className="fp-input-v2" style={{ marginTop: 8 }}
                          autoFocus
                        />
                      )}
                    </div>
                    <div>
                      <label className="fp-field-label">{content.contact?.labels?.revenue ?? "Facturación mensual aprox."}</label>
                      <select
                        value={contactForm.revenue} onChange={CF("revenue")}
                        className="fp-input-v2"
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
                    <label className="fp-field-label">{content.contact?.socialLabel ?? "Redes sociales / Instagram"}</label>
                    <input
                      type="text" value={contactForm.socialMedia} onChange={CF("socialMedia")}
                      placeholder={content.contact?.socialPlaceholder ?? "@tutienda o https://instagram.com/tutienda"}
                      className="fp-input-v2"
                    />
                  </div>

                  {/* Extra info */}
                  <div>
                    <label className="fp-field-label">{"Información extra sobre tu negocio"}</label>
                    <textarea
                      rows={3} value={contactForm.extraInfo} onChange={CF("extraInfo")}
                      placeholder={"Numero de productos, tipos (tallas, colores, materiales...), plataformas que usas, retos actuales, objetivos a corto plazo, cualquier detalle relevante..."}
                      className="fp-input-v2"
                    />
                  </div>

                  {/* Proveedores (opcional) */}
                  <div>
                    <label className="fp-field-label">
                      {"Proveedores actuales"}
                      <span style={{ fontWeight: 400, color: "var(--t4)", marginLeft: 6, textTransform: "none", letterSpacing: 0 }}>(opcional)</span>
                    </label>
                    <textarea
                      rows={2} value={contactForm.suppliers} onChange={CF("suppliers")}
                      placeholder={"Ej: Alibaba, BigBuy, Printful, proveedor local de Barcelona... Separa con comas si son varios"}
                      className="fp-input-v2"
                    />
                    <p style={{ fontSize: 10, color: "var(--t4)", marginTop: 4 }}>Si nos indicas tus proveedores, compararemos sus precios con alternativas y estimaremos el revenue potencial</p>
                  </div>

                  {/* Product image: URL or file upload */}
                  <div>
                    <label className="fp-field-label">{"Imagen de referencia de tu producto (para muestra gratuita)"}</label>
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(200px, 100%), 1fr))", gap: 12 }}>
                      <div>
                        <input
                          type="url" value={contactForm.productImageUrl} onChange={CF("productImageUrl")}
                          placeholder={"https://tu-tienda.com/imagen-producto.jpg"}
                          className="fp-input-v2"
                        />
                        <p style={{ fontSize: 10, color: "var(--t4)", marginTop: 4 }}>Pega la URL de una imagen</p>
                      </div>
                      <div>
                        <label style={{
                          display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                          width: "100%", padding: "11px 14px", background: "var(--ink)", border: `1px solid ${refImageFile ? "rgba(200,168,75,0.5)" : "var(--ink3)"}`,
                          borderRadius: 10, color: refImageFile ? "#e6c668" : "var(--t3)", fontSize: 14, cursor: "pointer", boxSizing: "border-box", transition: "all 0.15s",
                        }}>
                          {refImageFile ? `📎 ${refImageFile.name.slice(0, 25)}${refImageFile.name.length > 25 ? "..." : ""}` : "📷 O sube una imagen"}
                          <input type="file" accept="image/*" style={{ display: "none" }} onChange={e => {
                            const file = e.target.files?.[0];
                            if (file) {
                              setRefImageFile(file);
                              const reader = new FileReader();
                              reader.onload = () => setRefImagePreview(reader.result as string);
                              reader.readAsDataURL(file);
                            }
                          }} />
                        </label>
                        <p style={{ fontSize: 10, color: "var(--t4)", marginTop: 4 }}>JPG, PNG, WebP (máx. 5MB)</p>
                      </div>
                    </div>
                    {refImagePreview && (
                      <div style={{ marginTop: 8, display: "flex", alignItems: "center", gap: 10 }}>
                        <img src={refImagePreview} alt="Referencia" style={{ width: 60, height: 60, objectFit: "cover", borderRadius: 8, border: "1px solid var(--ink3)" }} />
                        <button type="button" onClick={() => { setRefImageFile(null); setRefImagePreview(null); }}
                          style={{ background: "transparent", border: "none", color: "var(--t4)", cursor: "pointer", fontSize: 11, textDecoration: "underline" }}>
                          Quitar imagen
                        </button>
                      </div>
                    )}
                    <p style={{ fontSize: 11, color: "var(--t4)", marginTop: 6 }}>Sube o pega la URL de 1 imagen y te mostramos cómo quedaría tu producto optimizado por nuestra IA (SEO, descripciones, metas, título...)</p>
                  </div>

                  {/* Servicios */}
                  <div>
                    <label className="fp-field-label">{content.contact?.servicesLabel ?? "Servicios que necesitas"}</label>
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
                    <label className="fp-field-label">{content.contact?.labels?.message ?? "Mensaje adicional"}</label>
                    <textarea
                      rows={3} value={contactForm.message} onChange={CF("message")}
                      placeholder={content.contact?.placeholders?.message ?? "Cuéntanos más sobre tu tienda, tus retos actuales o lo que quieres conseguir…"}
                      className="fp-input-v2"
                    />
                  </div>

                  {contactStatus === "error" && (
                    <div style={{ padding: "10px 14px", background: "rgba(232,69,88,0.1)", border: "1px solid rgba(232,69,88,0.3)", borderRadius: 8, color: "#e84558", fontSize: 13 }}>
                      {contactError}
                    </div>
                  )}

                  <div style={{ padding: "12px 16px", background: "rgba(200,168,75,0.06)", border: "1px solid rgba(200,168,75,0.15)", borderRadius: 10, display: "flex", gap: 10, alignItems: "flex-start" }}>
                    <span style={{ fontSize: 16, flexShrink: 0, marginTop: 1 }}>ℹ️</span>
                    <p style={{ margin: 0, fontSize: 12, color: "var(--t3)", lineHeight: 1.5 }}>
                      Tus datos se usan exclusivamente para contactarte sobre tu proyecto. No compartimos información con terceros. Si subes una imagen de producto, nuestro equipo la analizará manualmente para preparar tu muestra gratuita personalizada.
                    </p>
                  </div>

                  {/* ── Progress bar ── */}
                  <div className="fp-progress-wrap">
                    <div className="fp-progress-header">
                      <span className="fp-progress-label">Formulario completado</span>
                      <span className="fp-progress-pct">{formProgress}%</span>
                    </div>
                    <div className="fp-progress-track">
                      <div className="fp-progress-fill" style={{ width: `${formProgress}%` }} />
                    </div>
                  </div>

                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
                    <p style={{ fontSize: 11.5, color: "rgba(255,255,255,0.3)", flex: 1 }}>{content.contact?.finePrint ?? "Sin spam. Solo te contactamos para hablar de tu proyecto."}</p>
                    <button
                      type="submit" disabled={contactStatus === "sending"}
                      className="btn-submit-3d btn-jelly"
                    >
                      {contactStatus === "sending" ? "⏳ Enviando…" : "🚀 CONTACTANOS AHORA"}
                    </button>
                  </div>
                </form>
              )}
            </div>

          </div>
        </section>

        </div>{/* /fp-wrapper */}
      </div>{/* /fp-container */}

        {/* ── FOOTER — fuera del fp-wrapper para que no se vea afectado por transforms ── */}
        <footer className="fp-footer fp-footer-standalone">
              <div className="fp-footer-inner">
                <div className="fp-footer-brand">
                  <a href="#" className="l-nav-logo" onClick={e => { e.preventDefault(); goToSection(0); }}>
                    {content.site.logo.imageUrl && !logoError ? (
                      <img src={`${API_BASE_LANDING}${content.site.logo.imageUrl}`} alt="" width={28} height={28} style={{ height: 28, width: 28, borderRadius: 6 }} onError={() => setLogoError(true)} />
                    ) : (
                      <img src={APP_LOGO} alt="" width={30} height={30} className="lx-logo-img" style={{ width: 30, height: 30 }} />
                    )}
                    <div className="l-nav-logo-text">{content.site.name}</div>
                  </a>
                  <p className="l-footer-desc">IA para tiendas Shopify, WooCommerce y PrestaShop, gestión de Stripe, diseño web y apps nativas.</p>
                </div>
                <div className="fp-footer-cols lx-footer-links">
                  <SiteLinks />
                </div>
              </div>
              <div className="l-footer-bottom">
                <div className="l-footer-copy" {...cmsProps("footer.copyright")}>{content.footer.copyright}</div>
                <a href="mailto:craftershopy@gmail.com" className="l-footer-copy" style={{ textDecoration: "none" }}>craftershopy@gmail.com</a>
              </div>
            </footer>

    </div>
  );
}
