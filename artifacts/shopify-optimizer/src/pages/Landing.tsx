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

const FP_SECTION_IDS = ["fp-hero", "fp-engines", "fp-demo", "fp-results", "fp-pricing", "fp-calculator", "fp-contact"];
const DEFAULT_SECTION_NAV = ["Inicio", "Motores", "Demo", "Resultados", "Precios", "Calculadora", "Contactar"];

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
  const [calcQuantities, setCalcQuantities] = useState<Record<string, number>>({});
  const [calcSelectedRecurring, setCalcSelectedRecurring] = useState<string | null>(null);
  const [calcCategory, setCalcCategory] = useState("all");
  const [animatedSections, setAnimatedSections] = useState<Set<string>>(new Set());
  const pricingRowRef = useRef<HTMLDivElement>(null);
  const [pricingIdx, setPricingIdx] = useState(0);
  const [contactForm, setContactForm] = useState({ name: "", email: "", phone: "", storeUrl: "", niche: "", customNiche: "", revenue: "", socialMedia: "", message: "", extraInfo: "", productImageUrl: "" });
  const [contactServices, setContactServices] = useState<string[]>([]);
  const [contactStatus, setContactStatus] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [contactError, setContactError] = useState("");
  const [refImageFile, setRefImageFile] = useState<File | null>(null);
  const [refImagePreview, setRefImagePreview] = useState<string | null>(null);
  const [legalModal, setLegalModal] = useState<null | "privacy" | "terms" | "cookies" | "gdpr">(null);
  const [comingSoon, setComingSoon] = useState<string | null>(null);

  // Escape + body-scroll lock para el modal "Próximamente" (mismo patrón que LegalModal)
  useEffect(() => {
    if (!comingSoon) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setComingSoon(null); };
    document.addEventListener("keydown", onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [comingSoon]);

  const sectionNavLabels = content?.sectionNav ?? DEFAULT_SECTION_NAV;
  const FP_SECTIONS = FP_SECTION_IDS.map((id, i) => ({ id, nav: sectionNavLabels[i] ?? DEFAULT_SECTION_NAV[i] }));

  const CF = (field: keyof typeof contactForm) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
    setContactForm(f => ({ ...f, [field]: e.target.value }));

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

  useEffect(() => {
    const row = pricingRowRef.current;
    if (!row) return;
    const onScroll = () => {
      const cards = row.querySelectorAll<HTMLElement>(".fp-pricing-card");
      if (!cards.length) return;
      const rowRect = row.getBoundingClientRect();
      const center = rowRect.left + rowRect.width / 2;
      let closest = 0;
      let minDist = Infinity;
      cards.forEach((c, i) => {
        const cRect = c.getBoundingClientRect();
        const dist = Math.abs(cRect.left + cRect.width / 2 - center);
        if (dist < minDist) { minDist = dist; closest = i; }
      });
      setPricingIdx(closest);
    };
    row.addEventListener("scroll", onScroll, { passive: true });
    return () => row.removeEventListener("scroll", onScroll);
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

  const fpRef = useRef<HTMLDivElement>(null);
  const currentRef = useRef(0);

  useEffect(() => {
    fetch(`${BASE_URL}/api/cms/content`, { credentials: "include" }).then(r => r.json()).then(setContent).catch(() => {});
  }, []);


  const isAnimatingRef = useRef(false);

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
    const container = fpRef.current;
    if (!container) return;
    const fpActive = window.innerWidth > 900 && window.innerHeight > 500;
    if (!fpActive) {
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
    const sections = container.querySelectorAll<HTMLElement>(".fp-section");
    const targetSection = sections[clamped];
    if (targetSection) targetSection.scrollTop = 0;
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
    setAnimatedSections(new Set(FP_SECTION_IDS));
    const obs = new IntersectionObserver(entries => {
      let bestIdx = -1;
      let bestRatio = 0;
      entries.forEach(e => {
        if (e.isIntersecting) {
          const idx = sections.indexOf(e.target as HTMLElement);
          if (idx !== -1 && e.intersectionRatio > bestRatio) {
            bestIdx = idx;
            bestRatio = e.intersectionRatio;
          }
        }
      });
      if (bestIdx >= 0) {
        currentRef.current = bestIdx;
        setCurrentSection(bestIdx);
      }
    }, { threshold: [0.05, 0.1, 0.3] });

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

  const _isFpActive = useCallback(() => {
    return window.innerWidth > 900 && window.innerHeight > 500;
  }, []);

  const [fpMode, setFpMode] = useState(() => typeof window !== "undefined" && window.innerWidth > 900 && window.innerHeight > 500);

  useEffect(() => {
    const check = () => {
      const active = window.innerWidth > 900 && window.innerHeight > 500;
      setFpMode(active);
      if (active) {
        document.body.style.overflow = "hidden";
        document.documentElement.style.overflow = "hidden";
        const container = fpRef.current;
        if (container) {
          const wrapper = container.querySelector<HTMLElement>(".fp-wrapper");
          if (wrapper) {
            wrapper.style.transition = "none";
            wrapper.style.transform = `translateY(-${currentRef.current * container.clientHeight}px)`;
            requestAnimationFrame(() => { wrapper.style.transition = ""; });
          }
        }
      } else {
        document.body.style.overflow = "";
        document.documentElement.style.overflow = "";
      }
    };
    check();
    window.addEventListener("resize", check);
    return () => {
      window.removeEventListener("resize", check);
      document.body.style.overflow = "";
      document.documentElement.style.overflow = "";
    };
  }, []);

  useEffect(() => {
    if (!content || !fpMode) return;
    const container = fpRef.current;
    if (!container) return;

    let accumulated = 0;
    const THRESHOLD = 60;
    let resetTimer: ReturnType<typeof setTimeout> | null = null;
    let touchStartY = 0;
    let touchStartX = 0;
    let touchActive = false;
    let touchBypassed = false;

    const canBypassSectionScroll = (e: WheelEvent | TouchEvent, deltaY: number) => {
      const target = (e instanceof TouchEvent ? e.target : e.target) as HTMLElement;
      const hScrollParent = target.closest<HTMLElement>(".fp-pricing-row, .fp-calc-tabs, .fp-calc-items");
      if (hScrollParent) {
        const canScrollH = hScrollParent.scrollWidth > hScrollParent.clientWidth + 2;
        if (e instanceof WheelEvent && canScrollH && Math.abs(e.deltaX) > Math.abs(e.deltaY)) {
          return true;
        }
        const canScrollV = hScrollParent.scrollHeight > hScrollParent.clientHeight + 2;
        if (canScrollV) {
          const atTop = hScrollParent.scrollTop <= 0;
          const atBottom = hScrollParent.scrollTop + hScrollParent.clientHeight >= hScrollParent.scrollHeight - 2;
          if ((deltaY < 0 && !atTop) || (deltaY > 0 && !atBottom)) return true;
        }
      }
      const sections = container.querySelectorAll<HTMLElement>(".fp-section");
      const currentEl = sections[currentRef.current];
      if (currentEl && currentEl.scrollHeight > currentEl.clientHeight + 2) {
        const atTop = currentEl.scrollTop <= 0;
        const atBottom = currentEl.scrollTop + currentEl.clientHeight >= currentEl.scrollHeight - 2;
        if ((deltaY < 0 && !atTop) || (deltaY > 0 && !atBottom)) return true;
      }
      return false;
    };

    const onWheel = (e: WheelEvent) => {
      if (isAnimatingRef.current) { e.preventDefault(); return; }
      if (canBypassSectionScroll(e, e.deltaY)) return;

      e.preventDefault();
      accumulated += e.deltaY;
      if (resetTimer) clearTimeout(resetTimer);
      resetTimer = setTimeout(() => { accumulated = 0; }, 200);

      if (Math.abs(accumulated) >= THRESHOLD) {
        if (accumulated > 0) goToSection(currentRef.current + 1);
        else goToSection(currentRef.current - 1);
        accumulated = 0;
      }
    };

    const onTouchStart = (e: TouchEvent) => {
      if (e.touches.length !== 1) return;
      touchStartY = e.touches[0].clientY;
      touchStartX = e.touches[0].clientX;
      touchActive = true;
      touchBypassed = false;
    };

    const onTouchMove = (e: TouchEvent) => {
      if (!touchActive) return;
      if (e.touches.length !== 1) return;
      const dy = touchStartY - e.touches[0].clientY;
      const dx = touchStartX - e.touches[0].clientX;
      if (Math.abs(dx) > Math.abs(dy)) { touchBypassed = true; return; }
      if (canBypassSectionScroll(e, dy)) { touchBypassed = true; return; }
      e.preventDefault();
    };

    const onTouchEnd = (e: TouchEvent) => {
      if (!touchActive) return;
      touchActive = false;
      if (touchBypassed) return;
      if (e.changedTouches.length !== 1) return;
      const dy = touchStartY - e.changedTouches[0].clientY;
      const SWIPE_THRESHOLD = 50;
      if (isAnimatingRef.current) return;
      if (Math.abs(dy) >= SWIPE_THRESHOLD) {
        if (dy > 0) goToSection(currentRef.current + 1);
        else goToSection(currentRef.current - 1);
      }
    };

    container.addEventListener("wheel", onWheel, { passive: false });
    container.addEventListener("touchstart", onTouchStart, { passive: true });
    container.addEventListener("touchmove", onTouchMove, { passive: false });
    container.addEventListener("touchend", onTouchEnd, { passive: true });
    return () => {
      container.removeEventListener("wheel", onWheel);
      container.removeEventListener("touchstart", onTouchStart);
      container.removeEventListener("touchmove", onTouchMove);
      container.removeEventListener("touchend", onTouchEnd);
    };
  }, [goToSection, content, fpMode]);

  useEffect(() => {
    if (!fpMode) return;
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
  }, [goToSection, fpMode]);

  const pad = (n: number) => String(n).padStart(2, "0");
  const isAnimated = (id: string) => animatedSections.has(id);

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

  if (!content?.hero) {
    return (
      <div className="l-loading">
        <div className="l-loader"></div>
      </div>
    );
  }

  const hLines = String(content.hero.headline ?? "").split("\n");
  const progressPct = FP_SECTIONS.length > 1 ? (currentSection / (FP_SECTIONS.length - 1)) * 100 : 0;

  const bgFor = (section: string) => content.backgrounds?.[section] ?? { type: "none" };
  const videoBg = (section: string) => {
    const bg = bgFor(section);
    if (bg.type !== "video" || !bg.videoUrl) return null;
    const src = bg.videoUrl.startsWith("/") ? `${API_BASE_LANDING}${bg.videoUrl}` : bg.videoUrl;
    return (
      <video className="fp-video-bg" autoPlay muted loop playsInline preload="auto" key={src}>
        <source src={src} />
      </video>
    );
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

      {/* ── SIDE NAV DOTS (right) ── */}
      <nav className="fp-sidenav" aria-label="Secciones">
        {FP_SECTIONS.map((sec, i) => (
          <button key={sec.id} className={`fp-nav-dot${currentSection === i ? " active" : ""}`} onClick={() => { goToSection(i); setHashRobust(sec.id); }} title={sec.nav}>
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
            {videoBg("hero")}
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
              <h1 className={`l-hero-h1 ${!isAnimated("fp-hero") ? "fp-animate" : "fp-animated"}`} style={{ animationDelay: "0.1s" }} onClick={cmsClick("hero.headline")} {...cmsData("hero.headline")}>
                {hLines.map((line, i) => (
                  <span key={i} className={i > 0 ? "l-block" : undefined}>
                    {content.hero.headlineHighlight && line.includes(content.hero.headlineHighlight)
                      ? line.split(content.hero.headlineHighlight).flatMap((part, pi, arr) =>
                          pi < arr.length - 1 ? [part, <span key={pi}>{content.hero.headlineHighlight}</span>] : [part]
                        )
                      : line}
                  </span>
                ))}
              </h1>
              <p className={`l-hero-sub ${!isAnimated("fp-hero") ? "fp-animate" : "fp-animated"}`} style={{ animationDelay: "0.22s" }} onClick={cmsClick("hero.subheadline")} {...cmsData("hero.subheadline")}>{content.hero.subheadline}</p>
              <div className={`l-hero-ctas ${!isAnimated("fp-hero") ? "fp-animate" : "fp-animated"}`} style={{ animationDelay: "0.34s" }}>
                <a href="#fp-pricing" className="l-btn-primary" onClick={e => { e.preventDefault(); isPreview ? cmsNotify("hero.ctaPrimary.label", e) : goToSection(4); }} {...cmsData("hero.ctaPrimary.label")}>{content.hero.ctaPrimary?.label ?? "Descubre nuestros planes→"}</a>
                <a href="#fp-demo" className="l-btn-secondary" onClick={e => { e.preventDefault(); isPreview ? cmsNotify("hero.ctaSecondary.label", e) : goToSection(2); }} {...cmsData("hero.ctaSecondary.label")}>{content.hero.ctaSecondary.label}</a>
              </div>
              
              <div className={`l-hero-trust ${!isAnimated("fp-hero") ? "fp-animate" : "fp-animated"}`} style={{ animationDelay: "0.46s" }}>
                {content.hero.trustItems.map((item, i) => (
                  <div key={i} className="l-trust-item" {...cmsProps(`hero.trustItems.${i}`)}><div className="l-trust-check">✓</div>{item}</div>
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
                    <div className="l-preview-url">{content.hero.demo?.url ?? "app.shopycrafter.com/admin — Moda Urbana"}</div>
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
            <div className="fp-scroll-hint-text" {...cmsProps("hero.scrollHint")}>{content.hero.scrollHint ?? "Desliza para explorar"}</div>
            <div className="fp-scroll-hint-arrow">↓</div>
          </div>
        </section>

        {/* ══════════════════════════════════════
            SECTION 02 — ENGINES (6 motors)
        ══════════════════════════════════════ */}
        <section className="fp-section fp-section-dark" id="fp-engines" data-nav="Motores">
          <div className="fp-bg-solid">{videoBg("features")}</div>
          <div className="fp-content fp-engines-layout">
            <div className={`fp-section-header ${!isAnimated("fp-engines") ? "fp-animate" : "fp-animated"}`} style={{ animationDelay: "0s" }}>
              <div className="l-pill" {...cmsProps("features.pill")}>{content.features.pill}</div>
              <h2 className="l-h2" onClick={cmsClick("features.headline")} {...cmsData("features.headline")}>{String(content.features.headline ?? "").split(".")[0]}. <em>{String(content.features.headline ?? "").split(".").slice(1).join(".")}</em></h2>
              <p className="l-sub" {...cmsProps("features.subheadline")}>{content.features.subheadline}</p>
            </div>

            <div className={`fp-engine-tabs ${!isAnimated("fp-engines") ? "fp-animate" : "fp-animated"}`} style={{ animationDelay: "0.1s" }}>
              {content.features.items.map((feat, i) => (
                <button key={feat.id} className={`fp-etab${activeEngine === i ? " active" : ""}`} onClick={() => setActiveEngine(i)}>
                  <span className="fp-etab-num">{feat.num}</span>
                  <span className="fp-etab-icon">{feat.icon}</span>
                  <span className="fp-etab-name" {...cmsProps(`features.items.${i}.title`)}>{String(feat.title ?? "").split(" ")[0]}</span>
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
                  <h3 className="fp-engine-title" {...cmsProps(`features.items.${activeEngine}.title`)}>{content.features.items[activeEngine].title}</h3>
                  <p className="fp-engine-desc" {...cmsProps(`features.items.${activeEngine}.description`)}>{content.features.items[activeEngine].description}</p>
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
            {videoBg("how")}
            <div className="l-hero-grid" style={{ opacity: 0.3 }}></div>
          </div>
          <div className="fp-bg-overlay" style={{ background: "rgba(8,8,16,0.8)" }}></div>
          <div className="fp-content fp-split-layout">
            <div className={`fp-split-left ${!isAnimated("fp-demo") ? "fp-animate" : "fp-animated"}`} style={{ animationDelay: "0s" }}>
              <div className="l-pill" {...cmsProps("how.pill")}>{content.how.pill}</div>
              <h2 className="l-h2" onClick={cmsClick("how.headline")} {...cmsData("how.headline")}>
                {String(content.how.headline ?? "").split("\n").map((line, i) => (
                  <span key={i} className={i > 0 ? "l-block" : undefined}>
                    {content.how.headlineHighlight && line.includes(content.how.headlineHighlight)
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
                      <div className="fp-demo-step-title" {...cmsProps(`how.steps.${si}.title`)}>{step.title}</div>
                      <div className="fp-demo-step-desc" {...cmsProps(`how.steps.${si}.desc`)}>{step.desc}</div>
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
                      <div><div className="l-how-card-title" {...cmsProps(`howCards.${i}.title`)}>{c.title}</div><div className="l-how-card-sub" {...cmsProps(`howCards.${i}.sub`)}>{c.sub}</div></div>
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
            {videoBg("results")}
            <div className="fp-results-bg-pattern"></div>
          </div>
          <div className="fp-bg-overlay" style={{ background: "rgba(8,8,16,0.72)" }}></div>
          <div className="fp-content fp-results-layout">
            <div className={`fp-section-header ${!isAnimated("fp-results") ? "fp-animate" : "fp-animated"}`} style={{ animationDelay: "0s" }}>
              <div className="l-pill" {...cmsProps("results.pill")}>{content.results?.pill ?? "Resultados probados"}</div>
              <h2 className="l-h2" onClick={cmsClick("results.headline")} {...cmsData("results.headline")}>{(() => {
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
              {(content.results?.techBadges ?? [{ icon: "🛍️", label: "eCommerce API" }, { icon: "🤖", label: "Claude AI" }, { icon: "🎨", label: "Replicate" }, { icon: "🔍", label: "GSC" }, { icon: "📧", label: "Klaviyo" }, { icon: "🔐", label: "AES-256" }, { icon: "⚡", label: "Automation" }]).map((badge, i) => (
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
          <div className="fp-bg-solid">{videoBg("pricing")}</div>
          <div className="fp-content fp-pricing-layout">
            <div className={`fp-section-header ${!isAnimated("fp-pricing") ? "fp-animate" : "fp-animated"}`} style={{ animationDelay: "0s" }}>
              <div className="l-pill" {...cmsProps("pricing.pill")}>{content.pricing.pill}</div>
              <h2 className="l-h2" onClick={cmsClick("pricing.headline")} {...cmsData("pricing.headline")}>{String(content.pricing.headline ?? "").split(".")[0]}. <em>{String(content.pricing.headline ?? "").split(".").slice(1).join(".")}</em></h2>
              <p className="l-sub" {...cmsProps("pricing.subheadline")}>{content.pricing.subheadline}</p>
            </div>
            <div className="fp-pricing-carousel-wrap">
              {pricingIdx > 0 && (
                <button type="button" className="fp-pricing-arrow fp-pricing-arrow-left" onClick={() => scrollPricing(-1)} aria-label="Plan anterior">‹</button>
              )}
              <div ref={pricingRowRef} className={`fp-pricing-row ${!isAnimated("fp-pricing") ? "fp-animate" : "fp-animated"}`} style={{ animationDelay: "0.1s" }}>
                {content.pricing.plans.map((plan, planIdx) => (
                  <div key={plan.id} className={`l-pricing-card fp-pricing-card${plan.featured ? " l-pricing-featured" : ""}`}>
                    {plan.badge && <div className="l-pricing-badge" {...cmsProps(`pricing.plans.${planIdx}.badge`)}>{plan.badge}</div>}
                    <div className="l-pricing-plan" {...cmsProps(`pricing.plans.${planIdx}.name`)}>{plan.name}</div>
                    <div className="l-pricing-price" {...cmsProps(`pricing.plans.${planIdx}.price`)}><span>{plan.currency}</span>{plan.price}</div>
                    <div className="l-pricing-period" {...cmsProps(`pricing.plans.${planIdx}.period`)}>{plan.period}</div>
                    <div className="l-pricing-divider"></div>
                    <ul className="l-pricing-features">
                      {plan.features.map((f, fi) => (
                        <li key={fi} className="l-pricing-feature">
                          <div className={f.included ? "l-pricing-check" : "l-pricing-x"}>{f.included ? "✓" : "✕"}</div>
                          <span style={f.included ? undefined : { color: "var(--l-t3)", fontSize: 12 }}>{f.text}</span>
                        </li>
                      ))}
                    </ul>
                    <a href={plan.cta.href || "#fp-contact"} className={`l-pricing-cta ${plan.cta.style}`} onClick={e => { const href = plan.cta.href || "#fp-contact"; if (href.startsWith("#")) { e.preventDefault(); const idx = FP_SECTION_IDS.indexOf(href.replace("#", "")); if (idx >= 0) goToSection(idx); } }} {...cmsProps(`pricing.plans.${planIdx}.cta.label`)}>{plan.cta.label}</a>
                  </div>
                ))}
              </div>
              {pricingIdx < (content.pricing.plans.length - 1) && (
                <button type="button" className="fp-pricing-arrow fp-pricing-arrow-right" onClick={() => scrollPricing(1)} aria-label="Plan siguiente">›</button>
              )}
            </div>
            <div className="fp-pricing-dots">
              {content.pricing.plans.map((plan, i) => (
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
        <section className="fp-section" id="fp-calculator" data-nav="Calculadora">
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
        <section className="fp-section fp-section-dark" id="fp-contact" data-nav="Contactar">
          <div className="fp-bg">
            {videoBg("contact")}
            <div className="l-contact-bg" style={{
              position: "absolute", inset: 0,
              background: "radial-gradient(ellipse 80% 60% at 50% 50%, rgba(200,168,75,0.06) 0%, transparent 70%)",
            }} />
          </div>
          <div className="fp-content" style={{ maxWidth: 900, padding: "0 24px" }}>
            <div className={`fp-section-header ${!isAnimated("fp-contact") ? "fp-animate" : "fp-animated"}`} style={{ animationDelay: "0s" }}>
              <div className="l-pill" style={{ background: "rgba(200,168,75,0.12)", color: "#e6c668", border: "1px solid rgba(200,168,75,0.2)" }} onClick={cmsClick("contact.pill")} {...cmsData("contact.pill")}>{content.contact?.pill ?? "Trabaja con nosotros"}</div>
              <h2 className="l-h2" onClick={cmsClick("contact.headline")} {...cmsData("contact.headline")}>{content.contact?.headline ?? "Cuéntanos sobre tu negocio."}<br /><em>{content.contact?.headlineHighlight ?? "Te contactamos en menos de 24h."}</em></h2>
              <p className="l-sub" {...cmsProps("contact.subheadline")}>{content.contact?.subheadline ?? "Necesitamos conocer tu tienda para personalizar cada motor de IA a tu nicho, ticket medio y modelo de negocio."}</p>
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
                      <label style={{ display: "block", fontSize: 11, fontWeight: 700, letterSpacing: "0.7px", color: "var(--t3)", textTransform: "uppercase", marginBottom: 8 }}>{content.contact?.labels?.storeUrl ?? "URL de tu tienda online"}</label>
                      <input
                        type="text" value={contactForm.storeUrl} onChange={CF("storeUrl")}
                        placeholder={content.contact?.placeholders?.storeUrl ?? "mitienda.com"}
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
                      {contactForm.niche === "Otro" && (
                        <input
                          type="text"
                          value={contactForm.customNiche}
                          onChange={CF("customNiche")}
                          placeholder="Describe tu nicho de negocio..."
                          style={{ width: "100%", padding: "11px 14px", background: "var(--ink)", border: "1px solid var(--ink3)", borderRadius: 10, color: "var(--t)", fontSize: 14, outline: "none", boxSizing: "border-box", marginTop: 8 }}
                          onFocus={e => e.target.style.borderColor = "rgba(200,168,75,0.5)"}
                          onBlur={e => e.target.style.borderColor = "var(--ink3)"}
                          autoFocus
                        />
                      )}
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

                  {/* Extra info */}
                  <div>
                    <label style={{ display: "block", fontSize: 11, fontWeight: 700, letterSpacing: "0.7px", color: "var(--t3)", textTransform: "uppercase", marginBottom: 8 }}>{"Información extra sobre tu negocio"}</label>
                    <textarea
                      rows={3} value={contactForm.extraInfo} onChange={CF("extraInfo")}
                      placeholder={"Numero de productos, tipos (tallas, colores, materiales...), proveedores, plataformas que usas, retos actuales, objetivos a corto plazo, cualquier detalle relevante..."}
                      style={{ width: "100%", padding: "11px 14px", background: "var(--ink)", border: "1px solid var(--ink3)", borderRadius: 10, color: "var(--t)", fontSize: 14, outline: "none", resize: "vertical", fontFamily: "inherit", boxSizing: "border-box" }}
                      onFocus={e => e.target.style.borderColor = "rgba(200,168,75,0.5)"}
                      onBlur={e => e.target.style.borderColor = "var(--ink3)"}
                    />
                  </div>

                  {/* Product image: URL or file upload */}
                  <div>
                    <label style={{ display: "block", fontSize: 11, fontWeight: 700, letterSpacing: "0.7px", color: "var(--t3)", textTransform: "uppercase", marginBottom: 8 }}>{"Imagen de referencia de tu producto (para muestra gratuita)"}</label>
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(200px, 100%), 1fr))", gap: 12 }}>
                      <div>
                        <input
                          type="url" value={contactForm.productImageUrl} onChange={CF("productImageUrl")}
                          placeholder={"https://tu-tienda.com/imagen-producto.jpg"}
                          style={{ width: "100%", padding: "11px 14px", background: "var(--ink)", border: "1px solid var(--ink3)", borderRadius: 10, color: "var(--t)", fontSize: 14, outline: "none", boxSizing: "border-box" }}
                          onFocus={e => e.target.style.borderColor = "rgba(200,168,75,0.5)"}
                          onBlur={e => e.target.style.borderColor = "var(--ink3)"}
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

                  <div style={{ padding: "12px 16px", background: "rgba(200,168,75,0.06)", border: "1px solid rgba(200,168,75,0.15)", borderRadius: 10, display: "flex", gap: 10, alignItems: "flex-start" }}>
                    <span style={{ fontSize: 16, flexShrink: 0, marginTop: 1 }}>ℹ️</span>
                    <p style={{ margin: 0, fontSize: 12, color: "var(--t3)", lineHeight: 1.5 }}>
                      Tus datos se usan exclusivamente para contactarte sobre tu proyecto. No compartimos información con terceros. Si subes una imagen de producto, nuestro equipo la analizará manualmente para preparar tu muestra gratuita personalizada.
                    </p>
                  </div>

                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
                    <p style={{ fontSize: 12, color: "var(--t4)", flex: 1 }}>{content.contact?.finePrint ?? "Sin spam. Solo te contactamos para hablar de tu proyecto."}</p>
                    <button
                      type="submit" disabled={contactStatus === "sending"}
                      className="l-btn-gold"
                      style={{ opacity: contactStatus === "sending" ? 0.7 : 1, minWidth: 200, padding: "13px 28px", fontSize: 14 }}
                    >
                      {contactStatus === "sending" ? "Enviando…" : "CONTACTANOS"}
                    </button>
                  </div>
                </form>
              )}
            </div>

            {/* ── FOOTER ── */}
            <footer className={`fp-footer ${!isAnimated("fp-contact") ? "fp-animate" : "fp-animated"}`} style={{ animationDelay: "0.3s", marginTop: 40 }}>
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
                  <p className="l-footer-desc" {...cmsProps("footer.tagline")}>{content.footer.tagline}</p>
                </div>
                {content.footer.columns.slice(0, 4).map((col, i) => (
                  <div key={i} className="fp-footer-col">
                    <div className="l-footer-col-title" {...cmsProps(`footer.columns.${i}.title`)}>{col.title}</div>
                    <ul className="l-footer-links">
                      {col.links.slice(0, 4).map((l, li) => {
                        const href = (l.href || "#").trim();
                        // Href vacío o "#" → modal "Próximamente" (defensivo si admin
                        // añade un link sin destino aún, p.ej. Blog/Changelog/Doc/API)
                        if (href === "" || href === "#") {
                          return (
                            <li key={li}>
                              <a href="#" onClick={(e) => { e.preventDefault(); setComingSoon(l.label || "Esta sección"); }}>
                                {l.label}
                              </a>
                            </li>
                          );
                        }
                        // Modales legales: "#legal:privacy" | "#legal:terms" | "#legal:cookies" | "#legal:gdpr"
                        if (href.startsWith("#legal:")) {
                          const key = href.split(":")[1] as "privacy" | "terms" | "cookies" | "gdpr";
                          return (
                            <li key={li}>
                              <a href={href} onClick={(e) => {
                                e.preventDefault();
                                if (["privacy","terms","cookies","gdpr"].includes(key)) setLegalModal(key);
                              }}>{l.label}</a>
                            </li>
                          );
                        }
                        // Página externa /p/slug o ruta interna SPA → wouter Link
                        if (href.startsWith("/") && !href.startsWith("//")) {
                          return <li key={li}><Link href={href}>{l.label}</Link></li>;
                        }
                        // Email / Teléfono → no nueva pestaña
                        if (href.startsWith("mailto:") || href.startsWith("tel:")) {
                          return <li key={li}><a href={href}>{l.label}</a></li>;
                        }
                        // URL externa → nueva pestaña con seguridad
                        if (href.startsWith("http://") || href.startsWith("https://")) {
                          return <li key={li}><a href={href} target="_blank" rel="noopener noreferrer">{l.label}</a></li>;
                        }
                        // Anchor: secciones fullpage o ids dentro del DOM.
                        // Actualizamos window.location.hash sin recargar para reflejar
                        // la sección activa (deep linking). Usamos URL absoluta y un
                        // timeout de respaldo para que el hash sobreviva a cualquier
                        // re-render disparado por goToSection (fullpage cambia state).
                        const setHashRobust = (id: string) => {
                          const apply = () => {
                            try {
                              const url = `${window.location.pathname}${window.location.search}#${id}`;
                              window.history.replaceState(null, "", url);
                            } catch {
                              // Fallback nativo si replaceState está bloqueado
                              try { window.location.hash = id; } catch {}
                            }
                          };
                          apply();
                          // Reaplica tras el próximo paint por si goToSection lo borró
                          setTimeout(apply, 50);
                        };
                        const onAnchor = (e: React.MouseEvent<HTMLAnchorElement>) => {
                          if (!href.startsWith("#")) return;
                          const id = href.slice(1);
                          const fpIdx = FP_SECTION_IDS.indexOf(id);
                          if (fpIdx >= 0) {
                            e.preventDefault();
                            goToSection(fpIdx);
                            setHashRobust(id);
                            return;
                          }
                          const target = document.getElementById(id);
                          if (target) {
                            e.preventDefault();
                            target.scrollIntoView({ behavior: "smooth", block: "start" });
                            setHashRobust(id);
                          }
                        };
                        return <li key={li}><a href={href} onClick={onAnchor}>{l.label}</a></li>;
                      })}
                    </ul>
                  </div>
                ))}
              </div>
              <div className="l-footer-bottom">
                <div className="l-footer-copy" {...cmsProps("footer.copyright")}>{content.footer.copyright}</div>
                <div className="l-footer-badges">{content.footer.badges.map((b, i) => <span key={i} className="l-footer-badge">{b}</span>)}</div>
              </div>
            </footer>
          </div>
        </section>

        {/* ══════════════════════════════════════
            EXTRA SECTIONS — about / case studies / affiliates
            (no fp-section: scrollables tradicionales para que los enlaces
            del footer apunten a contenido REAL en lugar de #)
        ══════════════════════════════════════ */}
        <section id="about-us" style={{ scrollMarginTop: 80, padding: "80px 24px", background: "var(--ink2)", borderTop: "1px solid var(--ink3)" }}>
          <div style={{ maxWidth: 980, margin: "0 auto" }}>
            <div style={{ display: "inline-block", padding: "6px 14px", borderRadius: 999, background: "rgba(200,168,75,0.12)", color: "#e6c668", border: "1px solid rgba(200,168,75,0.2)", fontSize: 12, fontWeight: 700, letterSpacing: "0.5px", textTransform: "uppercase", marginBottom: 16 }}>Sobre nosotros</div>
            <h2 style={{ fontSize: "clamp(28px, 4vw, 44px)", fontWeight: 800, color: "var(--t)", marginBottom: 16, lineHeight: 1.15 }}>Una agencia donde la IA hace el trabajo pesado.</h2>
            <p style={{ fontSize: 16, color: "var(--t3)", lineHeight: 1.7, marginBottom: 28, maxWidth: 760 }}>Shopy Crafter nació en 2024 cuando vimos que los e-commerce pequeños perdían horas al mes en tareas que la IA podía hacer en minutos: generar imágenes de producto, escribir SEO, diseñar landings, comparar competidores, encontrar proveedores. Construimos los motores propios y los pusimos en una plataforma que cualquier agencia o tienda puede usar sin ser técnico.</p>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 20, marginTop: 32 }}>
              {[
                { icon: "🎯", title: "Misión", text: "Hacer que cualquier eCommerce pueda competir como una marca grande sin contratar 8 personas." },
                { icon: "⚙️", title: "Cómo trabajamos", text: "Motores reales con Claude, Gemini y modelos de imagen propios. Sin plantillas. Cada salida es única para tu marca." },
                { icon: "🤝", title: "Quiénes somos", text: "Equipo pequeño y técnico: ingenieros de IA, diseñadores y operadores de tiendas reales con cicatrices propias." },
              ].map(c => (
                <div key={c.title} style={{ padding: 24, background: "var(--ink)", border: "1px solid var(--ink3)", borderRadius: 16 }}>
                  <div style={{ fontSize: 28, marginBottom: 10 }}>{c.icon}</div>
                  <h3 style={{ fontSize: 17, fontWeight: 700, color: "var(--t)", marginBottom: 8 }}>{c.title}</h3>
                  <p style={{ fontSize: 14, color: "var(--t3)", lineHeight: 1.6, margin: 0 }}>{c.text}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section id="case-studies" style={{ scrollMarginTop: 80, padding: "80px 24px", borderTop: "1px solid var(--ink3)" }}>
          <div style={{ maxWidth: 980, margin: "0 auto" }}>
            <div style={{ display: "inline-block", padding: "6px 14px", borderRadius: 999, background: "rgba(45,212,159,0.12)", color: "var(--jade)", border: "1px solid rgba(45,212,159,0.25)", fontSize: 12, fontWeight: 700, letterSpacing: "0.5px", textTransform: "uppercase", marginBottom: 16 }}>Casos de éxito</div>
            <h2 style={{ fontSize: "clamp(28px, 4vw, 44px)", fontWeight: 800, color: "var(--t)", marginBottom: 16, lineHeight: 1.15 }}>Resultados reales de tiendas que ya usan Shopy Crafter.</h2>
            <p style={{ fontSize: 15, color: "var(--t3)", lineHeight: 1.7, marginBottom: 32, maxWidth: 720 }}>Cifras verificadas con permiso de los clientes. Cada caso usa nuestros motores estándar — sin trucos, sin tráfico pagado adicional.</p>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 20 }}>
              {[
                { name: "Comic Crafter", niche: "Cómics e ilustración personalizada", before: "12 ventas/mes, fichas sin SEO", after: "+340% ventas en 90 días, 47 fichas optimizadas, 6 imágenes IA por producto", time: "3 meses" },
                { name: "Hanakaze Serigrafía", niche: "Camisetas estampadas Japón-inspired", before: "Web sin tráfico orgánico", after: "Top 3 Google para 18 keywords del nicho, +210% sesiones, 4× conversión", time: "5 meses" },
                { name: "Audit Multipart", niche: "Repuestos automoción B2B", before: "Catálogo manual, sin descripciones", after: "1.200 productos auto-descritos en 2 semanas, +180% leads cualificados", time: "2 meses" },
              ].map(c => (
                <div key={c.name} style={{ padding: 24, background: "var(--ink2)", border: "1px solid var(--ink3)", borderRadius: 16, display: "flex", flexDirection: "column", gap: 10 }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
                    <h3 style={{ fontSize: 17, fontWeight: 700, color: "var(--t)", margin: 0 }}>{c.name}</h3>
                    <span style={{ fontSize: 11, color: "var(--t4)" }}>⏱ {c.time}</span>
                  </div>
                  <div style={{ fontSize: 12, color: "#e6c668" }}>{c.niche}</div>
                  <div style={{ fontSize: 13, color: "var(--t3)", lineHeight: 1.5 }}><b style={{ color: "var(--t4)" }}>Antes:</b> {c.before}</div>
                  <div style={{ fontSize: 13, color: "var(--jade)", lineHeight: 1.5 }}><b>Después:</b> {c.after}</div>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section id="affiliates" style={{ scrollMarginTop: 80, padding: "80px 24px", background: "var(--ink2)", borderTop: "1px solid var(--ink3)" }}>
          <div style={{ maxWidth: 980, margin: "0 auto" }}>
            <div style={{ display: "inline-block", padding: "6px 14px", borderRadius: 999, background: "rgba(200,168,75,0.12)", color: "#e6c668", border: "1px solid rgba(200,168,75,0.2)", fontSize: 12, fontWeight: 700, letterSpacing: "0.5px", textTransform: "uppercase", marginBottom: 16 }}>Programa de afiliados</div>
            <h2 style={{ fontSize: "clamp(28px, 4vw, 44px)", fontWeight: 800, color: "var(--t)", marginBottom: 16, lineHeight: 1.15 }}>Recomienda Shopy Crafter y gana <em style={{ color: "#e6c668", fontStyle: "normal" }}>30% recurrente</em>.</h2>
            <p style={{ fontSize: 15, color: "var(--t3)", lineHeight: 1.7, marginBottom: 28, maxWidth: 720 }}>Nuestro programa está pensado para freelancers, agencias y consultores que ya trabajan con eCommerce. Cobra por cada cliente que recomiendes mientras siga activo.</p>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 20, marginBottom: 32 }}>
              {[
                { v: "30%", l: "Comisión recurrente sobre cada cuota mensual" },
                { v: "90 días", l: "Ventana de cookie de atribución" },
                { v: "60€", l: "Mínimo de retiro (Stripe / transferencia)" },
                { v: "24h", l: "Tiempo medio de aprobación de la solicitud" },
              ].map(s => (
                <div key={s.l} style={{ padding: 20, background: "var(--ink)", border: "1px solid var(--ink3)", borderRadius: 12, textAlign: "center" }}>
                  <div style={{ fontSize: 28, fontWeight: 800, color: "#e6c668", marginBottom: 6 }}>{s.v}</div>
                  <div style={{ fontSize: 12, color: "var(--t3)", lineHeight: 1.4 }}>{s.l}</div>
                </div>
              ))}
            </div>
            <a
              href="#fp-contact"
              className="l-btn-gold"
              onClick={e => { e.preventDefault(); goToSection(FP_SECTION_IDS.indexOf("fp-contact")); setHashRobust("fp-contact"); }}
              style={{ display: "inline-block", padding: "14px 28px", fontSize: 14 }}
            >Solicitar acceso al programa →</a>
          </div>
        </section>

        </div>{/* /fp-wrapper */}
      </div>{/* /fp-container */}

      {/* ── LEGAL MODAL (privacidad / términos / cookies / RGPD) ── */}
      {legalModal && (
        <LegalModal kind={legalModal} onClose={() => setLegalModal(null)} siteName={content.site.name} />
      )}
      {comingSoon && (
        <div
          role="dialog" aria-modal="true"
          onClick={() => setComingSoon(null)}
          style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)", zIndex: 10000, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}
        >
          <div onClick={(e) => e.stopPropagation()} style={{ background: "#0c0c0e", border: "1px solid #2a2a30", borderRadius: 16, maxWidth: 460, padding: 32, textAlign: "center", color: "#eee" }}>
            <div style={{ fontSize: 42, marginBottom: 12 }}>🚧</div>
            <h3 style={{ fontSize: "1.4rem", margin: "0 0 10px", color: "#e6c668" }}>{comingSoon}</h3>
            <p style={{ fontSize: "0.95rem", opacity: 0.85, margin: "0 0 20px", lineHeight: 1.5 }}>
              Estamos preparando esta sección. Vuelve pronto o contáctanos por email si necesitas información ahora.
            </p>
            <button
              onClick={() => setComingSoon(null)}
              style={{ padding: "10px 22px", borderRadius: 10, background: "linear-gradient(135deg, #d4a843, #b8860b)", color: "#000", border: "none", cursor: "pointer", fontWeight: 700 }}
            >
              Entendido
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ───────────── Legal modal con contenido real ─────────────
const LEGAL_CONTENT: Record<"privacy" | "terms" | "cookies" | "gdpr", { title: string; body: { h: string; p: string }[] }> = {
  privacy: {
    title: "Política de Privacidad",
    body: [
      { h: "1. Responsable del tratamiento", p: "El responsable del tratamiento de los datos es Shopy Crafter, con domicilio en España. Puedes contactarnos en sadiagiljoan@gmail.com para cualquier asunto relativo a tus datos personales." },
      { h: "2. Datos que recogemos", p: "Recopilamos los datos que tú nos facilitas (nombre, email, teléfono, URL de tienda, nicho, facturación aproximada) y datos técnicos básicos de navegación (IP anonimizada, navegador, páginas visitadas) para operar el servicio y mejorar la experiencia." },
      { h: "3. Finalidad", p: "Usamos tus datos exclusivamente para responder a tus solicitudes, prestar los servicios contratados, facturar, enviarte información sobre tu cuenta y, sólo si nos lo autorizas, comunicaciones comerciales sobre nuestros propios servicios." },
      { h: "4. Base legal", p: "Tratamos los datos con base en la ejecución del contrato (servicios contratados), tu consentimiento (formulario de contacto, newsletter) y nuestro interés legítimo en mantener la seguridad y mejorar el producto." },
      { h: "5. Conservación", p: "Conservamos tus datos mientras tengas una cuenta activa y, una vez cerrada, durante los plazos legales aplicables (fiscal, contable, defensa de reclamaciones). Después se eliminan o anonimizan." },
      { h: "6. Tus derechos", p: "Puedes ejercer tus derechos de acceso, rectificación, supresión, oposición, limitación y portabilidad escribiéndonos a sadiagiljoan@gmail.com. Si no quedas satisfecho, puedes presentar reclamación ante la Agencia Española de Protección de Datos (aepd.es)." },
      { h: "7. Terceros", p: "No vendemos ni cedemos tus datos. Trabajamos con proveedores tecnológicos (hosting, IA, pagos) que actúan como encargados del tratamiento bajo contratos que cumplen con el RGPD." },
    ],
  },
  terms: {
    title: "Términos y Condiciones",
    body: [
      { h: "1. Objeto", p: "Estos términos regulan el uso de la plataforma Shopy Crafter, una suite de herramientas con IA para optimización de eCommerce. Al usar el servicio aceptas estos términos en su totalidad." },
      { h: "2. Cuentas y acceso", p: "Eres responsable de mantener la confidencialidad de tus credenciales y de toda actividad realizada desde tu cuenta. Avísanos inmediatamente si detectas un acceso no autorizado." },
      { h: "3. Planes y pago", p: "Los planes y precios vigentes están publicados en la sección de Precios. Los pagos son por adelantado, no reembolsables salvo error imputable a Shopy Crafter o lo previsto por la normativa de consumidores." },
      { h: "4. Uso aceptable", p: "Está prohibido usar el servicio para actividades ilegales, generar contenido que infrinja derechos de terceros, hacer ingeniería inversa, abusar de los créditos de IA o intentar comprometer la seguridad de la plataforma." },
      { h: "5. Propiedad intelectual", p: "El código, diseño y motores de IA propios pertenecen a Shopy Crafter. El contenido que generes con la plataforma (textos, imágenes, informes) es tuyo, sin perjuicio de las licencias de los modelos subyacentes." },
      { h: "6. Limitación de responsabilidad", p: "El servicio se presta «tal cual». No garantizamos resultados comerciales concretos. Nuestra responsabilidad máxima por cualquier reclamación se limita al importe pagado por ti en los últimos 12 meses." },
      { h: "7. Ley aplicable", p: "Estos términos se rigen por la ley española. Para cualquier controversia las partes se someten a los Juzgados y Tribunales del domicilio del consumidor cuando sea aplicable." },
    ],
  },
  cookies: {
    title: "Política de Cookies",
    body: [
      { h: "1. Qué son las cookies", p: "Las cookies son pequeños archivos de texto que se almacenan en tu navegador cuando visitas un sitio web. Se usan para hacer funcionar la web, recordar tus preferencias y, en algunos casos, medir el uso." },
      { h: "2. Cookies técnicas (necesarias)", p: "Usamos cookies de sesión para mantenerte autenticado y proteger tu cuenta (CSRF). Estas cookies son imprescindibles para el funcionamiento del servicio y no requieren consentimiento." },
      { h: "3. Cookies de preferencias", p: "Almacenamos preferencias de interfaz (modo claro/oscuro, idioma, último proyecto abierto) localmente para mejorar tu experiencia. Puedes borrarlas desde la configuración de tu navegador." },
      { h: "4. Cookies de medición", p: "No usamos por defecto cookies publicitarias de terceros. Si en algún momento se incorporan, te lo informaremos previamente y podrás aceptarlas o rechazarlas con un banner de consentimiento." },
      { h: "5. Cómo gestionarlas", p: "Puedes configurar o eliminar las cookies desde tu navegador (Chrome, Firefox, Safari, Edge). Ten en cuenta que desactivar las cookies técnicas impedirá iniciar sesión." },
    ],
  },
  gdpr: {
    title: "Cumplimiento RGPD",
    body: [
      { h: "1. Compromiso con el RGPD", p: "Shopy Crafter cumple con el Reglamento (UE) 2016/679 (RGPD) y con la LOPDGDD 3/2018. Tratamos los datos personales con confidencialidad, integridad y disponibilidad." },
      { h: "2. Encargados del tratamiento", p: "Trabajamos con proveedores cualificados (infraestructura cloud en la UE/EEE siempre que es posible, proveedores de IA bajo acuerdos DPA) y mantenemos un registro de actividades de tratamiento conforme al art. 30 RGPD." },
      { h: "3. Medidas de seguridad", p: "Aplicamos cifrado en tránsito (TLS) y en reposo (AES-256), control de accesos por rol, copias de seguridad periódicas, registro de auditoría y revisiones de seguridad recurrentes." },
      { h: "4. Notificación de incidentes", p: "En caso de brecha de seguridad que pueda suponer riesgo para tus derechos, te lo notificaremos sin dilación y, cuando proceda, en un plazo máximo de 72 horas a la AEPD." },
      { h: "5. Transferencias internacionales", p: "Cuando algún proveedor opere fuera del EEE, nos aseguramos de que existan garantías adecuadas (cláusulas contractuales tipo aprobadas por la Comisión Europea o decisión de adecuación)." },
      { h: "6. Derechos ARCO+", p: "Puedes ejercer tus derechos de acceso, rectificación, supresión, oposición, limitación, portabilidad y a no ser objeto de decisiones automatizadas escribiendo a sadiagiljoan@gmail.com." },
    ],
  },
};

function LegalModal({ kind, onClose, siteName }: { kind: "privacy" | "terms" | "cookies" | "gdpr"; onClose: () => void; siteName: string }) {
  const data = LEGAL_CONTENT[kind];
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [onClose]);
  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed", inset: 0, zIndex: 9999,
        background: "rgba(0,0,0,0.75)", backdropFilter: "blur(6px)",
        display: "flex", alignItems: "center", justifyContent: "center", padding: 20,
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        role="dialog" aria-modal="true" aria-label={data.title}
        style={{
          background: "var(--ink2)", color: "var(--t)",
          borderRadius: 18, border: "1px solid var(--ink3)",
          maxWidth: 760, width: "100%", maxHeight: "85vh",
          display: "flex", flexDirection: "column",
          boxShadow: "0 20px 60px rgba(0,0,0,0.6)",
        }}
      >
        <div style={{ padding: "20px 28px", borderBottom: "1px solid var(--ink3)", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
          <div>
            <div style={{ fontSize: 11, color: "var(--t4)", textTransform: "uppercase", letterSpacing: "0.7px" }}>{siteName}</div>
            <h2 style={{ fontSize: 22, fontWeight: 700, margin: "4px 0 0" }}>{data.title}</h2>
          </div>
          <button
            type="button" onClick={onClose} aria-label="Cerrar"
            style={{
              background: "var(--ink)", border: "1px solid var(--ink3)",
              borderRadius: 8, color: "var(--t3)", width: 36, height: 36,
              fontSize: 18, cursor: "pointer", lineHeight: 1,
            }}
          >×</button>
        </div>
        <div style={{ padding: "20px 28px", overflowY: "auto", flex: 1 }}>
          {data.body.map(s => (
            <div key={s.h} style={{ marginBottom: 22 }}>
              <h3 style={{ fontSize: 15, fontWeight: 700, color: "#e6c668", marginBottom: 6 }}>{s.h}</h3>
              <p style={{ fontSize: 14, color: "var(--t3)", lineHeight: 1.65, margin: 0 }}>{s.p}</p>
            </div>
          ))}
          <p style={{ fontSize: 12, color: "var(--t4)", marginTop: 28, paddingTop: 16, borderTop: "1px solid var(--ink3)" }}>
            Última actualización: {new Date().toLocaleDateString("es-ES", { year: "numeric", month: "long" })}. Si tienes cualquier duda, escríbenos a <a href="mailto:sadiagiljoan@gmail.com" style={{ color: "#e6c668" }}>sadiagiljoan@gmail.com</a>.
          </p>
        </div>
      </div>
    </div>
  );
}
