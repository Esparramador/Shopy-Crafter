import { ReactNode, useState, useEffect, useRef, useCallback } from "react";
import { Link, useRoute, useLocation } from "wouter";
import { LogOut, Settings, Sun, Moon, Menu, X, WifiOff } from "lucide-react";
import { useListProjects } from "@workspace/api-client-react";
import { useAuth } from "@/contexts/AuthContext";
import { useCms } from "@/contexts/CmsContext";

interface AppLayoutProps {
  children: ReactNode;
}

const BASE_URL = import.meta.env.BASE_URL?.replace(/\/$/, "") ?? "";

const DEFAULT_MODULE_NAV = [
  { id: "audit",       label: "Auditoría",    icon: "📊" },
  { id: "redesign",    label: "Rediseño IA",  icon: "✏️" },
  { id: "images",      label: "Imágenes",     icon: "🖼" },
  { id: "consistency", label: "Consistencia", icon: "🎨" },
  { id: "ab-testing",  label: "A/B Testing",  icon: "📈" },
  { id: "pricing",     label: "Pricing",      icon: "💰" },
  { id: "seo",         label: "SEO Engine",   icon: "🔍" },
  { id: "vault",       label: "Repositorio",  icon: "🗄️" },
  { id: "tripo3d",     label: "Tripo 3D Studio", icon: "🧊" },
  { id: "meshy",       label: "Meshy Characters", icon: "🧊✨" },
];

const STRIPE_MODULE_NAV = [
  { id: "stripe-hub",     label: "Stripe Hub",      icon: "💳" },
  { id: "audit",          label: "Auditoría Web",   icon: "📊" },
  { id: "vault",          label: "Repositorio",     icon: "🗄️" },
  { id: "fusion-studio",  label: "Studio Foto",     icon: "🧬" },
  { id: "ad-studio",      label: "Studio Anuncios", icon: "📺" },
];

const WOO_MODULE_NAV = [
  { id: "woo-hub",        label: "WooCommerce Hub", icon: "🟣" },
  { id: "audit",          label: "Auditoría",       icon: "📊" },
  { id: "redesign",       label: "Rediseño IA",     icon: "✏️" },
  { id: "images",         label: "Imágenes IA",     icon: "🖼" },
  { id: "consistency",    label: "Consistencia",    icon: "🎨" },
  { id: "ab-testing",     label: "A/B Testing",     icon: "📈" },
  { id: "pricing",        label: "Pricing Engine",  icon: "💰" },
  { id: "seo",            label: "SEO Engine",      icon: "🔍" },
  { id: "vault",          label: "Repositorio",     icon: "🗄️" },
  { id: "fusion-studio",  label: "Studio Foto",     icon: "🧬" },
  { id: "ad-studio",      label: "Studio Anuncios", icon: "📺" },
];

const PS_MODULE_NAV = [
  { id: "ps-hub",         label: "PrestaShop Hub",  icon: "🔴" },
  { id: "audit",          label: "Auditoría",       icon: "📊" },
  { id: "redesign",       label: "Rediseño IA",     icon: "✏️" },
  { id: "images",         label: "Imágenes IA",     icon: "🖼" },
  { id: "consistency",    label: "Consistencia",    icon: "🎨" },
  { id: "ab-testing",     label: "A/B Testing",     icon: "📈" },
  { id: "pricing",        label: "Pricing Engine",  icon: "💰" },
  { id: "seo",            label: "SEO Engine",      icon: "🔍" },
  { id: "vault",          label: "Repositorio",     icon: "🗄️" },
  { id: "fusion-studio",  label: "Studio Foto",     icon: "🧬" },
  { id: "ad-studio",      label: "Studio Anuncios", icon: "📺" },
];

const DEFAULT_SHOPYBRAIN_NAV = [
  { label: "Centro Shopy Crafter", icon: "🧠", href: "/admin/shopybrain" },
  { label: "Centro de Comando", icon: "⚡", href: "/admin/command-center" },
  { label: "Memorias", icon: "💾", href: "/admin/shopybrain/memories" },
  { label: "Knowledge Domains", icon: "🔬", href: "/admin/shopybrain/insights" },
  { label: "Brain Sync", icon: "🔄", href: "/admin/brain-sync" },
  { label: "Sesiones Estudio", icon: "📚", href: "/admin/shopybrain/study" },
  { label: "Mi Pricing CFO", icon: "💰", href: "/admin/my-pricing" },
  { label: "Email Marketing", icon: "📧", href: "/admin/emails" },
  { label: "Flujos de Email", icon: "🔁", href: "/admin/email-flows" },
  { label: "CMS Editor", icon: "✏️", href: "/admin/cms" },
  { label: "Librería de Prompts", icon: "🏛", href: "/admin/prompt-library" },

  { label: "Lab Web IA", icon: "🔬", href: "/web-lab" },
  { label: "AI Web Designer", icon: "🎨", href: "/web-designer" },
  { label: "Effects Studio", icon: "✦", href: "/effects-studio" },

  { label: "Studio Fotografía IA", icon: "🧬", href: "/fusion-studio" },
  { label: "Studio Multimedia Pro", icon: "⚡", href: "/fusion-studio-pro" },
  { label: "Studio de Anuncios", icon: "📺", href: "/ad-studio" },
  { label: "Studio de Cards", icon: "💳", href: "/cards" },
  { label: "Kit de Campañas", icon: "🎬", href: "/campaign-kit" },
  { label: "Vista Explosionada", icon: "💥", href: "/exploded-view" },

  { label: "Generador IA", icon: "✨", href: "/generator" },
  { label: "Exportar", icon: "📥", href: "/exports" },
  { label: "Proveedores", icon: "🏭", href: "/suppliers" },

  { label: "Bóveda Global", icon: "🏦", href: "/admin/vault" },
  { label: "Buscador Universal", icon: "🔎", href: "/admin/search" },
  { label: "Template Studio", icon: "🎨", href: "/admin/template-studio" },
  { label: "Avatar Studio", icon: "🎬", href: "/admin/avatar-studio" },
  { label: "YouTube Studio", icon: "▶️", href: "/admin/youtube-studio" },
  { label: "Calendario CRM", icon: "📅", href: "/admin/calendar" },
  { label: "Meshy Character Lab", icon: "🧊", href: "/admin/meshy-studio" },
  { label: "Tripo3D Studio", icon: "🧊✨", href: "/tripo3d" },
  { label: "MCP Manager", icon: "🔌", href: "/admin/mcp-manager" },
  { label: "Security Lab", icon: "🔐", href: "/admin/security-lab" },

  { label: "── STUDIO IA ──", icon: "", href: "#", divider: true },
  { label: "AMR Studio", icon: "🤖", href: "/admin/amr-studio" },
  { label: "Librería de Skills", icon: "📚", href: "/admin/skills-library" },
  { label: "Design Systems", icon: "🎨", href: "/admin/design-systems" },
  { label: "Catálogo de Plugins", icon: "🔌", href: "/admin/plugins-catalog" },
  { label: "HyperFrames Studio", icon: "🖼", href: "/admin/hyperframes" },
  { label: "Deck Builder", icon: "📊", href: "/admin/deck-builder" },
];

const DEFAULT_ADMIN_NAV = [
  { label: "Home / Inicio", icon: "🏠", href: "/home" },
  { label: "── MÓDULOS ──", icon: "", href: "#", divider: true },
  { label: "Auditoría Web", icon: "📊", href: "/audit" },
  { label: "Rediseño IA", icon: "✏️", href: "/redesign" },
  { label: "Imágenes IA", icon: "🖼", href: "/images" },
  { label: "Consistencia", icon: "🎨", href: "/consistency" },
  { label: "A/B Testing", icon: "📈", href: "/ab-testing" },
  { label: "Pricing Engine", icon: "💰", href: "/pricing" },
  { label: "SEO Engine", icon: "🔍", href: "/seo" },
  { label: "Repositorio", icon: "🗄️", href: "/vault" },
  { label: "── CRM & ADMIN ──", icon: "", href: "#", divider: true },
  { label: "Panel Cliente", icon: "👤", href: "/client" },
  { label: "CRM Clientes", icon: "👥", href: "/admin/clients" },
  { label: "Mensajes Clientes", icon: "💬", href: "/admin/messages" },
  { label: "Chat Grupal", icon: "👥", href: "/admin/group-chat" },
  { label: "Productos Global", icon: "📦", href: "/admin/products" },
  { label: "A/B Tests Global", icon: "📈", href: "/admin/abtests" },
  { label: "Automaciones", icon: "⚡", href: "/admin/automations" },
  { label: "Revenue & CRM", icon: "💰", href: "/admin/revenue" },
  { label: "Facturación & Plan", icon: "💳", href: "/admin/billing" },
  { label: "Planes & Servicios", icon: "📦", href: "/admin/tienda" },
  { label: "── GOD MODE ──", icon: "", href: "#", divider: true },
  { label: "Stripe Manager", icon: "💳", href: "/admin/stripe" },
  { label: "Stripe Master Hub", icon: "👑", href: "/admin/stripe-master" },
  { label: "API Keys Manager", icon: "🔑", href: "/admin/api-keys" },
  { label: "Facturación de Agencia", icon: "📄", href: "/admin/agency-billing" },
  { label: "Revenue Intel", icon: "📊", href: "/admin/intelligence" },
  { label: "Gemini Research", icon: "🔬", href: "/admin/gemini-intel" },
  { label: "M7 Inventario", icon: "🗄", href: "/admin/inventory" },
  { label: "Competitor Intel", icon: "🎯", href: "/admin/competitors" },
  { label: "Predicciones ML", icon: "🔮", href: "/admin/forecast" },
  { label: "Logros", icon: "🏆", href: "/admin/achievements" },
  { label: "Plan 30-60-90", icon: "🗺", href: "/admin/roadmap" },
  { label: "APK Android", icon: "📱", href: "/admin/apk" },
  { label: "Tienda / Store", icon: "🛒", href: "/tienda" },
  { label: "Catálogo IA AMIS", icon: "🧠", href: "/admin/ai-catalog" },
  { label: "Costes IA por sesión", icon: "💸", href: "/admin/api-usage" },
  { label: "System Health", icon: "🖥", href: "/admin/system" },
  { label: "Conexiones / Integraciones", icon: "🔗", href: "/help/connections" },
];

// ─── Token Expired Banner ────────────────────────────────────────────────────
function TokenExpiredBanner({
  projectId, domain, tokenExpiresAt, onSettings,
}: {
  projectId: number;
  domain: string | null;
  tokenExpiresAt: string | null;
  onSettings: () => void;
}) {
  const [dismissed, setDismissed] = useState(false);
  if (dismissed) return null;

  const isExpired = tokenExpiresAt && new Date(tokenExpiresAt) < new Date();
  const expiredSince = isExpired
    ? new Date(tokenExpiresAt!).toLocaleDateString("es-ES", { day: "2-digit", month: "short", year: "numeric" })
    : null;

  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 10,
      padding: "9px 18px",
      background: "linear-gradient(90deg, rgba(220,60,60,0.13) 0%, rgba(220,60,60,0.07) 100%)",
      borderBottom: "1px solid rgba(220,60,60,0.30)",
      fontSize: 12.5,
      color: "var(--t)",
      flexWrap: "wrap",
    }}>
      <span style={{ fontSize: 16, flexShrink: 0 }}>🔑</span>
      <span style={{ flex: 1, minWidth: 200 }}>
        <strong style={{ color: "#f87171" }}>
          {isExpired ? `Token Shopify expirado${expiredSince ? ` (${expiredSince})` : ""}` : "Token Shopify no configurado"}
        </strong>
        {" — "}
        Las acciones que requieren la API de Shopify están pausadas.
        {" "}
        <span style={{ color: "var(--t3)" }}>
          El asistente usará los datos cacheados del último escaneo para análisis e informes.
        </span>
      </span>
      <button
        onClick={onSettings}
        style={{
          padding: "5px 14px", borderRadius: 6, border: "1px solid rgba(220,60,60,0.50)",
          background: "rgba(220,60,60,0.15)", color: "#f87171",
          fontSize: 12, fontWeight: 600, cursor: "pointer", flexShrink: 0,
          transition: "background 0.15s",
        }}
        onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = "rgba(220,60,60,0.28)"; }}
        onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = "rgba(220,60,60,0.15)"; }}
      >
        Renovar token →
      </button>
      <button
        onClick={() => setDismissed(true)}
        title="Cerrar aviso"
        style={{
          background: "none", border: "none", cursor: "pointer",
          color: "var(--t4)", fontSize: 16, padding: "0 2px", flexShrink: 0,
          lineHeight: 1,
        }}
      >×</button>
    </div>
  );
}

export function AppLayout({ children }: AppLayoutProps) {
  const { data: projects, isLoading } = useListProjects();
  const [match, params] = useRoute("/projects/:id/*");
  const activeProjectId = match ? parseInt(params.id) : null;
  const activeProject = projects?.find((p: { id: number }) => p.id === activeProjectId);
  const { user, logout, isOnline } = useAuth();
  const [location, navigate] = useLocation();
  const [darkMode, setDarkMode] = useState(true);
  const [notifOpen, setNotifOpen] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const prevUnreadRef = useRef(-1);
  const [adminToast, setAdminToast] = useState<string | null>(null);
  const adminToastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const locationRef = useRef(location);
  useEffect(() => { locationRef.current = location; }, [location]);

  // SCROLL FIX: Cuando el admin panel está montado, forzar overflow:hidden
  // en html/body para que Android Chrome delegue el scroll a .main-content
  // y no intente scrollear el documento (que no se mueve).
  // Se restaura al desmontar (e.g. navegar a la landing pública).
  useEffect(() => {
    const html = document.documentElement;
    const body = document.body;
    const prevHtml = html.style.overflow;
    const prevBody = body.style.overflow;
    html.style.overflow = "hidden";
    body.style.overflow = "hidden";
    return () => {
      html.style.overflow = prevHtml;
      body.style.overflow = prevBody;
    };
  }, []);

  const playBeep = useCallback(() => {
    try {
      const ctx = new AudioContext();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.frequency.setValueAtTime(880, ctx.currentTime);
      osc.frequency.setValueAtTime(660, ctx.currentTime + 0.1);
      gain.gain.setValueAtTime(0.25, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.5);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.5);
    } catch { /* browser may block autoplay */ }
  }, []);

  const showAdminToast = useCallback((msg: string) => {
    setAdminToast(msg);
    if (adminToastTimer.current) clearTimeout(adminToastTimer.current);
    adminToastTimer.current = setTimeout(() => setAdminToast(null), 6000);
  }, []);
  const { content: cmsContent } = useCms();
  const cmsNav    = cmsContent?.adminNav ?? null;
  const cmsPanel  = cmsContent?.adminPanel ?? null;
  const cmsSite   = cmsContent?.site ?? null;
  const siteLogoImageUrl: string | null = cmsSite?.logo?.imageUrl ?? null;
  const siteLogoEmoji: string = cmsSite?.logo?.value ?? "💎";
  const siteName: string = cmsSite?.name ?? "Shopy Crafter";

  /**
   * mergeByKey — fusiona items del CMS (fuente de verdad) con los DEFAULTs del código.
   * - Si el CMS tiene datos: los usa tal cual + añade al final cualquier item del
   *   DEFAULT que falte (por href/id), para que funcionalidades nuevas aparezcan.
   * - Si el CMS está vacío: usa los DEFAULTs completos.
   * Así el CMS SIEMPRE controla el sidebar; el código nunca se impone.
   */
  function mergeByHref(dbItems: any[], defaults: any[]): any[] {
    if (!Array.isArray(dbItems) || dbItems.length === 0) return defaults;
    const existing = new Set(dbItems.map((i: any) => i.href).filter(Boolean));
    const missing = defaults.filter((d: any) => d.href && !existing.has(d.href));
    return [...dbItems, ...missing];
  }
  function mergeById(dbItems: any[], defaults: any[]): any[] {
    if (!Array.isArray(dbItems) || dbItems.length === 0) return defaults;
    const existing = new Set(dbItems.map((i: any) => i.id).filter(Boolean));
    const missing = defaults.filter((d: any) => d.id && !existing.has(d.id));
    return [...dbItems, ...missing];
  }

  // CMS es la fuente de verdad; merge garantiza que items nuevos del código aparezcan
  const activePlatformEarly: string = (activeProject as any)?.platformType ?? "shopify";
  const baseModuleNav =
    activePlatformEarly === "stripe"      ? STRIPE_MODULE_NAV :
    activePlatformEarly === "woocommerce" ? WOO_MODULE_NAV    :
    activePlatformEarly === "prestashop"  ? PS_MODULE_NAV     :
    DEFAULT_MODULE_NAV;
  const moduleNav    = mergeById(cmsNav?.modules ?? [], baseModuleNav);
  const shopybrainNav = mergeByHref(cmsNav?.shopybrain ?? [], DEFAULT_SHOPYBRAIN_NAV);
  const adminNav: any[] = mergeByHref(cmsNav?.admin ?? [], DEFAULT_ADMIN_NAV);
  const firstProjectId: number | null = projects?.[0]?.id ?? null;
  const ap = cmsPanel ?? {};

  const pageLabels: Record<string, string> = {};
  moduleNav.forEach((m: any) => { pageLabels[m.id] = m.label; });
  pageLabels["settings"] = "Configuración";

  const standaloneModule = !match ? location.replace(/^\//, "").split("/")[0] : "";
  const currentPage = match ? ((params as Record<string, string> | null)?.["*"] ?? "") : standaloneModule;
  const pageLabel = pageLabels[currentPage] ?? "Dashboard";

  useEffect(() => { setSidebarOpen(false); }, [location]);

  const API_BASE = BASE_URL;
  useEffect(() => {
    if (user?.role !== "admin") return;
    const poll = () => {
      fetch(`${API_BASE}/api/admin/unread-messages`, { credentials: "include" })
        .then(r => r.ok ? r.json() : null)
        .then(d => {
          if (d && typeof d.total === "number") {
            const newCount = d.total;
            if (prevUnreadRef.current === -1 && newCount > 0 && locationRef.current !== "/admin/messages") {
              // Primera carga: hay mensajes pendientes previos
              showAdminToast(`💬 Tienes ${newCount} mensaje${newCount > 1 ? "s" : ""} pendiente${newCount > 1 ? "s" : ""} sin leer`);
            } else if (prevUnreadRef.current >= 0 && newCount > prevUnreadRef.current && locationRef.current !== "/admin/messages") {
              // Nuevo mensaje llegó durante la sesión
              playBeep();
              showAdminToast(`💬 ${newCount - prevUnreadRef.current} mensaje${newCount - prevUnreadRef.current > 1 ? "s" : ""} nuevo${newCount - prevUnreadRef.current > 1 ? "s" : ""} de clientes`);
            }
            prevUnreadRef.current = newCount;
            setUnreadCount(newCount);
          }
        })
        .catch(() => {});
    };
    poll();
    const t = setInterval(poll, 8000);
    return () => clearInterval(t);
  }, [user?.role]);

  useEffect(() => {
    if (darkMode) {
      document.documentElement.removeAttribute("data-theme");
      try { localStorage.setItem("shopy-dark", "true"); } catch(e){}
    } else {
      document.documentElement.setAttribute("data-theme", "light");
      try { localStorage.setItem("shopy-dark", "false"); } catch(e){}
    }
    return () => {
      document.documentElement.removeAttribute("data-theme");
    };
  }, [darkMode]);

  // ── Platform accent injection ──────────────────────────────────────────────
  const PLATFORM_COLORS: Record<string, string> = {
    shopify:     "#95bf47",
    woocommerce: "#96588a",
    prestashop:  "#df0067",
    universal:   "#5b9bd5",
    stripe:      "#635bff",
    tiendanube:  "#00a0e3",
  };
  const PLATFORM_ICONS: Record<string, string> = {
    shopify:     "🟢",
    woocommerce: "🟣",
    prestashop:  "🔴",
    universal:   "🌐",
    stripe:      "💳",
    tiendanube:  "☁️",
  };
  const activePlatform: string = (activeProject as any)?.platformType ?? "shopify";
  const platformAccent = PLATFORM_COLORS[activePlatform] ?? "var(--gold)";
  const platformIcon   = PLATFORM_ICONS[activePlatform] ?? "🟢";

  useEffect(() => {
    const root = document.documentElement;
    root.style.setProperty("--platform-accent", platformAccent);
    root.setAttribute("data-platform", activePlatform);
    return () => {
      root.style.setProperty("--platform-accent", "var(--gold)");
      root.removeAttribute("data-platform");
    };
  }, [activePlatform, platformAccent]);

  const toggleDarkMode = () => setDarkMode(d => !d);

  return (
    <div className="app-shell">
      {!isOnline && (
        <div style={{
          position: "fixed", top: 0, left: 0, right: 0, zIndex: 9999,
          background: "linear-gradient(90deg, #e84558, #c73647)",
          color: "#fff", padding: "8px 16px",
          display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
          fontSize: 13, fontWeight: 600,
          boxShadow: "0 2px 12px rgba(232,69,88,0.4)",
        }}>
          <WifiOff size={14} />
          {ap.header?.offline ?? "Sin conexión — tus cambios se guardan localmente"}
        </div>
      )}
      {/* ── TABLET SIDEBAR OVERLAY ── */}
      <div
        className={`sidebar-overlay${sidebarOpen ? " visible" : ""}`}
        onClick={() => setSidebarOpen(false)}
        aria-hidden="true"
      />

      {/* ── SIDEBAR ── */}
      <nav className={`sidebar${sidebarOpen ? " open" : ""}`} role="navigation" aria-label="Navegación principal">
        {/* Logo — driven by CMS site.name / site.logo */}
        <Link href="/home" style={{ textDecoration: "none" }}>
          <div className="sidebar-logo" style={{ cursor: "pointer" }}>
            {siteLogoImageUrl ? (
              <img
                src={`${BASE_URL}${siteLogoImageUrl}`}
                alt={siteName}
                style={{ width: 38, height: 38, borderRadius: "50%", objectFit: "cover", flexShrink: 0 }}
              />
            ) : (
              <span style={{ fontSize: 26, flexShrink: 0, lineHeight: 1 }}>{siteLogoEmoji}</span>
            )}
            <span className="logo-text" style={{ maxWidth: 120, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {siteName}
            </span>
            <span className="logo-badge">PRO</span>
          </div>
        </Link>

        {/* Stores list */}
        <div className="sidebar-clients">
          <span className="sidebar-label">{ap.sidebarLabels?.yourStores ?? "Tus Tiendas"}</span>

          {isLoading ? (
            <>
              <div className="skeleton" style={{ height: 36, marginBottom: 4, borderRadius: 8 }} />
              <div className="skeleton" style={{ height: 36, marginBottom: 4, borderRadius: 8 }} />
            </>
          ) : (
            projects?.map((project: { id: number; name: string; shopDomain?: string; [k: string]: any }) => {
              const isActive = activeProjectId === project.id;
              const pType: string = project.platformType ?? "shopify";
              const pColor = PLATFORM_COLORS[pType] ?? "#95bf47";
              const pIcon  = PLATFORM_ICONS[pType] ?? "🟢";
              return (
                <Link key={project.id} href={`/projects/${project.id}/audit`}>
                  <div
                    className={`client-pill${isActive ? " active" : ""}`}
                    role="button"
                    aria-current={isActive ? "page" : undefined}
                    style={isActive ? { borderLeft: `2px solid ${pColor}`, borderRadius: 8 } : {}}
                  >
                    <div
                      className="client-dot"
                      style={{ background: isActive ? pColor : "var(--t4)", boxShadow: isActive ? `0 0 6px ${pColor}80` : "none" }}
                    />
                    <div className="client-info">
                      <p className="client-name">
                        <span style={{ marginRight: 4 }}>{pIcon}</span>
                        {project.name}
                        <span style={{ marginLeft: 5, fontSize: 9, fontWeight: 800, color: "var(--t4)", letterSpacing: "0.3px" }}>#{project.id}</span>
                      </p>
                      <p className="client-domain">{project.shopDomain ?? "—"}</p>
                    </div>
                  </div>
                </Link>
              );
            })
          )}

          {projects?.length === 0 && !isLoading && (
            <p style={{ fontSize: 11, color: "var(--t3)", padding: "4px 8px" }}>{ap.sidebarLabels?.noStores ?? "Sin tiendas aún"}</p>
          )}

          <Link href="/new-project">
            <div className="nav-item" style={{ marginTop: 4 }} role="button">
              <span className="nav-icon">＋</span>
              {ap.sidebarLabels?.newStore ?? "Nueva tienda"}
            </div>
          </Link>
        </div>

        {/* Shopy Brain nav */}
        <div className="sidebar-nav">
          <span className="sidebar-label" style={{ color: "var(--gold)", display: "flex", alignItems: "center", gap: 5 }}>
            🧠 {siteName}
          </span>
          {shopybrainNav.map((item: any) => (
            item.divider ? (
              <div key={item.label} style={{ padding: "10px 14px 4px", fontSize: 9, fontWeight: 800, color: "var(--t4)", textTransform: "uppercase", letterSpacing: "0.12em", pointerEvents: "none" }}>
                {item.label.replace(/^──\s*|\s*──$/g, "").trim()}
              </div>
            ) : (
              <Link key={item.href} href={item.href}>
                <div
                  className={`nav-item${location.startsWith(item.href) && (item.href !== "/admin/shopybrain" || location === "/admin/shopybrain") ? " active" : ""}`}
                  role="button"
                  aria-current={location === item.href ? "page" : undefined}
                >
                  <span className="nav-icon">{item.icon}</span>
                  {item.label}
                </div>
              </Link>
            )
          ))}
        </div>

        {/* Admin nav */}
        <div className="sidebar-nav">
          <span className="sidebar-label">{ap.sidebarLabels?.admin ?? "Administración"}</span>

          {adminNav.map(item => (
            <Link key={item.href} href={item.href}>
              <div
                className={`nav-item${location === item.href ? " active" : ""}`}
                role="button"
                aria-current={location === item.href ? "page" : undefined}
                style={{ position: "relative" }}
              >
                <span className="nav-icon">{item.icon}</span>
                {item.label}
                {(item.href === "/admin/clients" || item.href === "/admin/messages") && unreadCount > 0 && (
                  <span style={{
                    marginLeft: "auto", minWidth: 18, height: 18, borderRadius: 9,
                    background: "var(--crim)", color: "#fff", fontSize: 10, fontWeight: 700,
                    display: "flex", alignItems: "center", justifyContent: "center",
                    padding: "0 5px", lineHeight: 1, flexShrink: 0,
                  }}>
                    {unreadCount > 99 ? "99+" : unreadCount}
                  </span>
                )}
              </div>
            </Link>
          ))}

          {activeProject && (
            <Link href={`/projects/${activeProject.id}/settings`}>
              <div className={`nav-item${currentPage === "settings" ? " active" : ""}`} role="button">
                <span className="nav-icon"><Settings size={13} /></span>
                {ap.sidebarLabels?.config ?? "Configuración"}
              </div>
            </Link>
          )}
        </div>

        {/* Comic Crafter — promotional links (compact icon row) */}
        <div className="sidebar-promo" style={{
          padding: "8px 14px",
          borderTop: "1px solid var(--bdr)",
        }}>
          <p style={{ fontSize: 9, fontWeight: 700, letterSpacing: "0.7px", color: "var(--t3)", textTransform: "uppercase", marginBottom: 6 }}>
            {ap.sidebarLabels?.madeBy ?? "Hecho por"}
          </p>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            {/* Instagram */}
            <a
              href="https://www.instagram.com/comiccrafter_ai/"
              target="_blank"
              rel="noopener noreferrer"
              title="@comiccrafter_ai en Instagram"
              style={{
                display: "flex", alignItems: "center", justifyContent: "center",
                width: 30, height: 30, borderRadius: 7,
                background: "rgba(255,255,255,0.025)",
                border: "1px solid var(--bdr)",
                textDecoration: "none", transition: "background 0.15s", flexShrink: 0,
              }}
              onMouseOver={e => (e.currentTarget.style.background = "rgba(225,48,108,0.12)")}
              onMouseOut={e => (e.currentTarget.style.background = "rgba(255,255,255,0.025)")}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                <defs>
                  <linearGradient id="ig-grad" x1="0%" y1="100%" x2="100%" y2="0%">
                    <stop offset="0%" stopColor="#f09433"/>
                    <stop offset="25%" stopColor="#e6683c"/>
                    <stop offset="50%" stopColor="#dc2743"/>
                    <stop offset="75%" stopColor="#cc2366"/>
                    <stop offset="100%" stopColor="#bc1888"/>
                  </linearGradient>
                </defs>
                <rect x="2" y="2" width="20" height="20" rx="5" ry="5" stroke="url(#ig-grad)" strokeWidth="2" fill="none"/>
                <circle cx="12" cy="12" r="4" stroke="url(#ig-grad)" strokeWidth="2" fill="none"/>
                <circle cx="17.5" cy="6.5" r="1.2" fill="url(#ig-grad)"/>
              </svg>
            </a>

          </div>
        </div>

        {/* Bottom — credits + user */}
        <div className="sidebar-bottom">
          <div className="credits-bar-label">
            <span>IA Credits</span>
            <span style={{ color: "var(--jade)" }}>∞ {ap.user?.unlimited ?? "Ilimitados"}</span>
          </div>
          <div className="credits-bar">
            <div className="credits-bar-fill" style={{ width: "78%" }} />
          </div>

          {user && (
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 14 }}>
              <div
                className="logo-gem"
                style={{
                  width: 28, height: 28, fontSize: 11,
                  background: "rgba(200,168,75,0.12)",
                  color: "var(--gold2)",
                  flexShrink: 0,
                }}
                aria-label={`Usuario: ${user.name}`}
              >
                {user.name.slice(0, 2).toUpperCase()}
              </div>
              <div className="client-info">
                <p className="client-name">{user.name}</p>
                <p className="client-domain">{ap.user?.adminRole ?? "Administrador"}</p>
              </div>
              <Link href="/admin/settings" title="Ajustes de cuenta" aria-label="Ajustes de cuenta">
                <div style={{
                  background: "none", border: "none", cursor: "pointer",
                  color: location === "/admin/settings" ? "var(--gold2)" : "var(--t3)",
                  padding: 4, borderRadius: 4,
                  transition: "color 0.15s", flexShrink: 0,
                  display: "flex", alignItems: "center",
                }}>
                  <Settings size={13} />
                </div>
              </Link>
              <button
                onClick={toggleDarkMode}
                title={darkMode ? (ap.tooltips?.lightMode ?? "Modo claro") : (ap.tooltips?.darkMode ?? "Modo oscuro")}
                aria-label={darkMode ? `Activar ${ap.tooltips?.lightMode ?? "modo claro"}` : `Activar ${ap.tooltips?.darkMode ?? "modo oscuro"}`}
                style={{
                  background: "none", border: "none", cursor: "pointer",
                  color: "var(--t3)", padding: 4, borderRadius: 4,
                  transition: "color 0.15s", flexShrink: 0,
                  display: "flex", alignItems: "center",
                }}
              >
                {darkMode ? <Sun size={13} /> : <Moon size={13} />}
              </button>
              <button
                onClick={() => logout().then(() => navigate("/login"))}
                title={ap.tooltips?.logout ?? "Cerrar sesión"}
                aria-label={ap.tooltips?.logout ?? "Cerrar sesión"}
                style={{
                  background: "none", border: "none", cursor: "pointer",
                  color: "var(--t3)", padding: 4, borderRadius: 4,
                  transition: "color 0.15s", flexShrink: 0,
                  display: "flex", alignItems: "center",
                }}
                onMouseOver={(e) => { e.currentTarget.style.color = "var(--crim)"; }}
                onMouseOut={(e) => { e.currentTarget.style.color = "var(--t3)"; }}
              >
                <LogOut size={14} />
              </button>
            </div>
          )}
        </div>
      </nav>

      {/* ── MAIN AREA ── */}
      <div className="main-area">
        {/* Topbar */}
        <div className="topbar" role="banner">
          {/* Hamburger button — visible on tablet via CSS only */}
          <button
            className="hamburger-btn"
            onClick={() => setSidebarOpen(o => !o)}
            aria-label={sidebarOpen ? "Cerrar menú" : "Abrir menú"}
            aria-expanded={sidebarOpen}
          >
            {sidebarOpen ? <X size={16} /> : <Menu size={16} />}
          </button>
          <div className="topbar-breadcrumb">
            {activeProject ? (
              <>
                <span
                  style={{
                    display: "inline-flex", alignItems: "center", gap: 5,
                    padding: "2px 8px", borderRadius: 12, fontSize: 10, fontWeight: 700,
                    background: `${platformAccent}18`, border: `1px solid ${platformAccent}40`,
                    color: platformAccent, flexShrink: 0,
                  }}
                >
                  {platformIcon} {activePlatform.charAt(0).toUpperCase() + activePlatform.slice(1)}
                </span>
                <span className="topbar-client">{activeProject.name}</span>
                <span className="topbar-sep">/</span>
                <span className="topbar-page">{pageLabel}</span>
              </>
            ) : (
              <span className="topbar-client">Dashboard</span>
            )}
          </div>
          <div className="topbar-right">
            {/* Chat shortcut — always visible in topbar */}
            <Link href="/admin/messages">
              <div
                title="Mensajes Clientes"
                style={{
                  position: "relative", display: "flex", alignItems: "center", justifyContent: "center",
                  width: 32, height: 32, borderRadius: 8, cursor: "pointer",
                  background: unreadCount > 0
                    ? "linear-gradient(135deg,rgba(200,168,75,0.18) 0%,rgba(226,201,126,0.12) 100%)"
                    : "var(--ink3)",
                  border: unreadCount > 0 ? "1px solid rgba(200,168,75,0.45)" : "1px solid var(--bdr2)",
                  transition: "all 0.2s",
                  flexShrink: 0,
                }}
              >
                <span style={{ fontSize: 15, lineHeight: 1 }}>💬</span>
                {unreadCount > 0 && (
                  <span style={{
                    position: "absolute", top: -5, right: -5,
                    minWidth: 16, height: 16, borderRadius: 8,
                    background: "var(--crim)", color: "#fff",
                    fontSize: 9, fontWeight: 700,
                    display: "flex", alignItems: "center", justifyContent: "center",
                    padding: "0 4px", lineHeight: 1,
                    border: "1.5px solid var(--bg)",
                  }}>
                    {unreadCount > 99 ? "99+" : unreadCount}
                  </span>
                )}
              </div>
            </Link>

            <div className="tb-hide-sm" style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <kbd style={{
                padding: "2px 6px", borderRadius: 4, fontSize: 10,
                background: "var(--ink3)", border: "1px solid var(--ink4)",
                color: "var(--t4)", cursor: "pointer",
              }}
                onClick={() => window.dispatchEvent(new KeyboardEvent("keydown", { key: "k", ctrlKey: true, bubbles: true }))}
              >⌘K</kbd>
            </div>
            <a
              className="tb-hide-sm"
              href={`${BASE_URL}/landing`}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                display: "flex", alignItems: "center", gap: 5,
                padding: "4px 10px", borderRadius: 6, fontSize: 11, fontWeight: 500,
                background: "var(--ink3)", border: "1px solid var(--bdr2)",
                color: "var(--t2)", textDecoration: "none", whiteSpace: "nowrap",
                transition: "border-color 0.15s, color 0.15s",
              }}
              onMouseEnter={e => { (e.currentTarget as HTMLAnchorElement).style.borderColor = "var(--gold)"; (e.currentTarget as HTMLAnchorElement).style.color = "var(--gold)"; }}
              onMouseLeave={e => { (e.currentTarget as HTMLAnchorElement).style.borderColor = "var(--bdr2)"; (e.currentTarget as HTMLAnchorElement).style.color = "var(--t2)"; }}
              title="Ver Landing Page"
            >
              🌐 <span>Ver Landing</span>
            </a>
            <a
              href={`${BASE_URL}/client`}
              style={{
                display: "flex", alignItems: "center", gap: 5,
                padding: "4px 10px", borderRadius: 6, fontSize: 11, fontWeight: 500,
                background: "rgba(45,212,159,0.06)", border: "1px solid rgba(45,212,159,0.20)",
                color: "var(--jade)", textDecoration: "none", whiteSpace: "nowrap",
                transition: "border-color 0.15s, background 0.15s",
              }}
              onMouseEnter={e => { (e.currentTarget as HTMLAnchorElement).style.borderColor = "var(--jade)"; (e.currentTarget as HTMLAnchorElement).style.background = "rgba(45,212,159,0.12)"; }}
              onMouseLeave={e => { (e.currentTarget as HTMLAnchorElement).style.borderColor = "rgba(45,212,159,0.20)"; (e.currentTarget as HTMLAnchorElement).style.background = "rgba(45,212,159,0.06)"; }}
              title="Ver Panel Cliente (Vista Previa)"
            >
              👤 <span>Panel Cliente</span>
            </a>
            <div className="status-chip tb-hide-sm">
              <div className="status-pulse" />
              {ap.header?.active ?? "Activo"}
            </div>
            {/* Ajustes — visible solo en móvil */}
            <Link href="/admin/settings" className="tb-show-sm" title="Ajustes de cuenta" aria-label="Ajustes">
              <div style={{
                display: "flex", alignItems: "center", justifyContent: "center",
                width: 32, height: 32, borderRadius: 8,
                background: location === "/admin/settings" ? "rgba(200,168,75,0.15)" : "var(--ink3)",
                border: `1px solid ${location === "/admin/settings" ? "rgba(200,168,75,0.5)" : "var(--bdr2)"}`,
                color: location === "/admin/settings" ? "var(--gold2)" : "var(--t2)",
                transition: "all 0.15s", flexShrink: 0,
              }}>
                <Settings size={14} />
              </div>
            </Link>
            <div style={{ position: "relative" }}>
              <button
                className="notif-btn"
                title="Notificaciones"
                aria-label="Abrir notificaciones"
                onClick={() => setNotifOpen(o => !o)}
              >🔔</button>
              {notifOpen && (
                <div style={{
                  position: "absolute", right: 0, top: 36, zIndex: 200,
                  background: "var(--ink2)", border: "1px solid var(--ink3)",
                  borderRadius: 12, width: 280, boxShadow: "0 8px 32px rgba(0,0,0,0.4)",
                }}>
                  <div style={{ padding: "12px 16px", borderBottom: "1px solid var(--ink3)", display: "flex", justifyContent: "space-between" }}>
                    <span style={{ fontSize: 13, fontWeight: 600, color: "var(--t)" }}>{ap.notifications?.title ?? "Notificaciones"}</span>
                    <button onClick={() => setNotifOpen(false)} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--t4)", fontSize: 16 }}>×</button>
                  </div>
                  <div style={{ padding: "16px", textAlign: "center" }}>
                    <p style={{ fontSize: 13, color: "var(--t3)" }}>{ap.notifications?.empty ?? "Sin notificaciones nuevas"}</p>
                    <p style={{ fontSize: 11, color: "var(--t4)", marginTop: 4 }}>{ap.notifications?.emptyHint ?? "Las alertas de stock, competidores y logros aparecerán aquí"}</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Module tab nav */}
        <div className="module-tabs-wrap">
          <button
            className="module-tabs-arrow module-tabs-arrow-left"
            aria-label="Scroll tabs left"
            onClick={() => {
              const el = document.querySelector('.module-tabs');
              if (el) el.scrollBy({ left: -200, behavior: 'smooth' });
            }}
          >‹</button>
          <div className="module-tabs" role="tablist">
            {moduleNav.map((item: any) => {
              const isActive = currentPage === item.id;
              const tabHref = activeProjectId
                ? `/projects/${activeProjectId}/${item.id}`
                : firstProjectId
                  ? `/projects/${firstProjectId}/${item.id}`
                  : `/${item.id}`;
              return (
                <Link key={item.id} href={tabHref}>
                  <div
                    className={`module-tab${isActive ? " active" : ""}`}
                    role="tab"
                    aria-selected={isActive}
                  >
                    <span style={{ fontSize: 13 }}>{item.icon}</span>
                    <span className="module-tab-label">{item.label}</span>
                  </div>
                </Link>
              );
            })}
          </div>
          <button
            className="module-tabs-arrow module-tabs-arrow-right"
            aria-label="Scroll tabs right"
            onClick={() => {
              const el = document.querySelector('.module-tabs');
              if (el) el.scrollBy({ left: 200, behavior: 'smooth' });
            }}
          >›</button>
        </div>

        {/* Token expired banner */}
        {activeProject && match && (
          !activeProject.hasAccessToken ||
          (activeProject.tokenExpiresAt && new Date(activeProject.tokenExpiresAt) < new Date())
        ) && (
          <TokenExpiredBanner
            projectId={activeProjectId!}
            domain={activeProject.shopDomain}
            tokenExpiresAt={activeProject.tokenExpiresAt ?? null}
            onSettings={() => navigate(`/projects/${activeProjectId}/settings`)}
          />
        )}

        {/* Page content */}
        <div className="main-content" role="main">
          {children}
        </div>
      </div>

      {/* In-app notification toast for admin */}
      {adminToast && (
        <div
          onClick={() => { navigate("/admin/messages"); setAdminToast(null); }}
          style={{
            position: "fixed", bottom: 28, right: 28, zIndex: 99999,
            background: "linear-gradient(135deg, #c8a84b 0%, #e2c97e 100%)",
            color: "#0a0a14",
            padding: "14px 20px", borderRadius: 14,
            boxShadow: "0 8px 36px rgba(0,0,0,0.55)",
            display: "flex", alignItems: "center", gap: 12,
            fontSize: 13, fontWeight: 700, cursor: "pointer",
            maxWidth: 340,
            animation: "fadeInUp 0.3s ease",
          }}
        >
          <span style={{ fontSize: 22, flexShrink: 0 }}>💬</span>
          <div style={{ flex: 1 }}>
            <div>{adminToast}</div>
            <div style={{ fontSize: 11, fontWeight: 500, opacity: 0.75, marginTop: 2 }}>
              Haz clic para responder
            </div>
          </div>
          <button
            onClick={e => { e.stopPropagation(); setAdminToast(null); }}
            style={{
              background: "none", border: "none", cursor: "pointer",
              fontSize: 16, color: "#0a0a14", opacity: 0.6, padding: "0 2px", flexShrink: 0,
            }}
          >✕</button>
        </div>
      )}
    </div>
  );
}
