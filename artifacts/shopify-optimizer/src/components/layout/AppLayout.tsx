import { ReactNode, useState, useEffect } from "react";
import { Link, useRoute, useLocation } from "wouter";
import { LogOut, Settings, Bell, Sun, Moon, Menu, X } from "lucide-react";
import { useListProjects } from "@workspace/api-client-react";
import { useAuth } from "@/contexts/AuthContext";

interface AppLayoutProps {
  children: ReactNode;
}

const MODULE_NAV = [
  { id: "audit",       label: "Auditoría",    icon: "📊" },
  { id: "redesign",    label: "Rediseño IA",  icon: "✏️" },
  { id: "images",      label: "Imágenes",     icon: "🖼" },
  { id: "consistency", label: "Consistencia", icon: "🎨" },
  { id: "ab-testing",  label: "A/B Testing",  icon: "📈" },
  { id: "pricing",     label: "Pricing",      icon: "💰" },
  { id: "seo",         label: "SEO Engine",   icon: "🔍" },
  { id: "vault",       label: "Repositorio",  icon: "🗄️" },
];

const SHOPYBRAIN_NAV = [
  { label: "Shopy Brain", icon: "🧠", href: "/admin/shopybrain" },
  { label: "Memorias", icon: "💾", href: "/admin/shopybrain/memories" },
  { label: "Knowledge Domains", icon: "⚡", href: "/admin/shopybrain/insights" },
  { label: "Sesiones Estudio", icon: "📚", href: "/admin/shopybrain/study" },
  { label: "Mi Pricing CFO", icon: "💰", href: "/admin/my-pricing" },
  { label: "Email Marketing", icon: "📧", href: "/admin/emails" },
  { label: "Editor Landing", icon: "✏️", href: "/admin/cms" },
];

const ADMIN_NAV = [
  { label: "CRM Clientes", icon: "👥", href: "/admin/clients" },
  { label: "Revenue & CRM", icon: "💰", href: "/admin/revenue" },
  { label: "Revenue Intel", icon: "📊", href: "/admin/intelligence" },
  { label: "M7 Inventario", icon: "📦", href: "/admin/inventory" },
  { label: "Competitor Intel", icon: "🎯", href: "/admin/competitors" },
  { label: "Predicciones ML", icon: "🔮", href: "/admin/forecast" },
  { label: "Logros", icon: "🏆", href: "/admin/achievements" },
  { label: "Plan 30-60-90", icon: "🗺", href: "/admin/roadmap" },
  { label: "Tienda / Store", icon: "🛒", href: "/tienda" },
  { label: "System Health", icon: "🖥", href: "/admin/system" },
];

const PAGE_LABELS: Record<string, string> = {
  audit: "Auditoría",
  redesign: "Rediseño IA",
  images: "Imágenes",
  consistency: "Consistencia",
  "ab-testing": "A/B Testing",
  pricing: "Pricing",
  seo: "SEO Engine",
  settings: "Configuración",
  vault: "Repositorio",
};

export function AppLayout({ children }: AppLayoutProps) {
  const { data: projects, isLoading } = useListProjects();
  const [match, params] = useRoute("/projects/:id/*");
  const activeProjectId = match ? parseInt(params.id) : null;
  const activeProject = projects?.find((p: { id: number }) => p.id === activeProjectId);
  const { user, logout } = useAuth();
  const [location, navigate] = useLocation();
  const [darkMode, setDarkMode] = useState(true);
  const [notifOpen, setNotifOpen] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const currentPage = (params as Record<string, string> | null)?.["*"] ?? "";
  const pageLabel = PAGE_LABELS[currentPage] ?? "Dashboard";

  // Close sidebar when route changes (tablet)
  useEffect(() => { setSidebarOpen(false); }, [location]);

  const toggleDarkMode = () => {
    setDarkMode(d => !d);
    document.documentElement.setAttribute("data-theme", darkMode ? "light" : "dark");
  };

  return (
    <div className="app-shell">
      {/* ── TABLET SIDEBAR OVERLAY ── */}
      <div
        className={`sidebar-overlay${sidebarOpen ? " visible" : ""}`}
        onClick={() => setSidebarOpen(false)}
        aria-hidden="true"
      />

      {/* ── SIDEBAR ── */}
      <nav className={`sidebar${sidebarOpen ? " open" : ""}`} role="navigation" aria-label="Navegación principal">
        {/* Logo */}
        <div className="sidebar-logo">
          <div className="logo-gem">⚡</div>
          <span className="logo-text">Shopify<em>AI</em></span>
          <span className="logo-badge">PRO</span>
        </div>

        {/* Stores list */}
        <div className="sidebar-clients">
          <span className="sidebar-label">Tus Tiendas</span>

          {isLoading ? (
            <>
              <div className="skeleton" style={{ height: 36, marginBottom: 4, borderRadius: 8 }} />
              <div className="skeleton" style={{ height: 36, marginBottom: 4, borderRadius: 8 }} />
            </>
          ) : (
            projects?.map((project: { id: number; name: string; shopDomain?: string }) => {
              const isActive = activeProjectId === project.id;
              return (
                <Link key={project.id} href={`/projects/${project.id}/audit`}>
                  <div className={`client-pill${isActive ? " active" : ""}`} role="button" aria-current={isActive ? "page" : undefined}>
                    <div
                      className="client-dot"
                      style={{ background: isActive ? "var(--gold)" : "var(--t4)" }}
                    />
                    <div className="client-info">
                      <p className="client-name">{project.name}</p>
                      <p className="client-domain">{project.shopDomain ?? "—"}</p>
                    </div>
                  </div>
                </Link>
              );
            })
          )}

          {projects?.length === 0 && !isLoading && (
            <p style={{ fontSize: 11, color: "var(--t3)", padding: "4px 8px" }}>Sin tiendas aún</p>
          )}

          <Link href="/new-project">
            <div className="nav-item" style={{ marginTop: 4 }} role="button">
              <span className="nav-icon">＋</span>
              Nueva tienda
            </div>
          </Link>
        </div>

        {/* Shopy Brain nav */}
        <div className="sidebar-nav">
          <span className="sidebar-label" style={{ color: "var(--gold)", display: "flex", alignItems: "center", gap: 5 }}>
            🧠 Shopy Brain
          </span>
          {SHOPYBRAIN_NAV.map(item => (
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
          ))}
        </div>

        {/* Admin nav */}
        <div className="sidebar-nav">
          <span className="sidebar-label">Administración</span>

          {ADMIN_NAV.map(item => (
            <Link key={item.href} href={item.href}>
              <div
                className={`nav-item${location === item.href ? " active" : ""}`}
                role="button"
                aria-current={location === item.href ? "page" : undefined}
              >
                <span className="nav-icon">{item.icon}</span>
                {item.label}
              </div>
            </Link>
          ))}

          {activeProject && (
            <Link href={`/projects/${activeProject.id}/settings`}>
              <div className={`nav-item${currentPage === "settings" ? " active" : ""}`} role="button">
                <span className="nav-icon"><Settings size={13} /></span>
                Configuración
              </div>
            </Link>
          )}
        </div>

        {/* Comic Crafter — promotional links */}
        <div style={{
          padding: "10px 14px",
          borderTop: "1px solid var(--bdr)",
          display: "flex", flexDirection: "column", gap: 5,
        }}>
          <p style={{ fontSize: 9, fontWeight: 700, letterSpacing: "0.7px", color: "var(--t3)", textTransform: "uppercase", marginBottom: 2 }}>
            Hecho por
          </p>

          {/* Instagram */}
          <a
            href="https://www.instagram.com/comiccrafter_ai/"
            target="_blank"
            rel="noopener noreferrer"
            style={{
              display: "flex", alignItems: "center", gap: 7,
              padding: "5px 8px", borderRadius: 7,
              background: "rgba(255,255,255,0.025)",
              border: "1px solid var(--bdr)",
              textDecoration: "none", transition: "background 0.15s",
            }}
            onMouseOver={e => (e.currentTarget.style.background = "rgba(225,48,108,0.07)")}
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
            <span style={{ fontSize: 11, color: "var(--t2)", fontWeight: 500 }}>@comiccrafter_ai</span>
          </a>

          {/* Shopify Store */}
          <a
            href="https://comic-crafter.myshopify.com/"
            target="_blank"
            rel="noopener noreferrer"
            style={{
              display: "flex", alignItems: "center", gap: 7,
              padding: "5px 8px", borderRadius: 7,
              background: "rgba(255,255,255,0.025)",
              border: "1px solid var(--bdr)",
              textDecoration: "none", transition: "background 0.15s",
            }}
            onMouseOver={e => (e.currentTarget.style.background = "rgba(150,191,89,0.07)")}
            onMouseOut={e => (e.currentTarget.style.background = "rgba(255,255,255,0.025)")}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
              <path d="M15.5 3.5C15.5 3.5 15.1 3.5 14.8 3.7C14.6 2.5 13.9 1.5 12.7 1.5C12.4 1.5 12.1 1.6 11.8 1.8C11.5 1.4 11 1 10.3 1C8.1 1 7 3.7 6.7 5.1L5.1 5.6C4.6 5.8 4.6 5.8 4.5 6.3L3 18.3L14.5 20.5L20.5 19L18.5 5.5C18.4 5.5 15.5 3.5 15.5 3.5Z" fill="#96BF59"/>
              <path d="M14.8 3.7C14.5 3.9 14.3 4.2 14.1 4.6L9.8 5.9C10.1 4.7 10.8 2.5 12.5 2.5C13.4 2.5 14 3 14.8 3.7Z" fill="#5E8E3E"/>
              <path d="M12.5 7.5C12.5 7.5 12 7.5 11.5 7.7C11.3 7.2 10.9 7 10.5 7C9.5 7 9 8 9 8.5C9 9.7 12 10.5 12 12.5C12 14 11 14.5 10 14.5C8.6 14.5 7.9 13.5 7.9 13.5L8.3 12C8.3 12 9.1 12.8 10 12.8C10.5 12.8 10.7 12.5 10.7 12.2C10.7 10.5 8.2 10.4 8.2 8.6C8.2 7 9.3 5.5 11.3 5.5C12.1 5.5 12.5 5.8 12.5 5.8V7.5Z" fill="white"/>
            </svg>
            <span style={{ fontSize: 11, color: "var(--t2)", fontWeight: 500 }}>Tienda Shopify</span>
          </a>

          {/* Comic Crafter App */}
          <a
            href="https://comiccrafter.es/"
            target="_blank"
            rel="noopener noreferrer"
            style={{
              display: "flex", alignItems: "center", gap: 7,
              padding: "5px 8px", borderRadius: 7,
              background: "rgba(255,255,255,0.025)",
              border: "1px solid var(--bdr)",
              textDecoration: "none", transition: "background 0.15s",
            }}
            onMouseOver={e => (e.currentTarget.style.background = "rgba(147,51,234,0.07)")}
            onMouseOut={e => (e.currentTarget.style.background = "rgba(255,255,255,0.025)")}
          >
            <img
              src="https://comic-crafter.myshopify.com/cdn/shop/t/10/assets/logo-app.png"
              alt="Comic Crafter"
              width={14}
              height={14}
              style={{ borderRadius: 3, objectFit: "cover" }}
              onError={e => { e.currentTarget.style.display = "none"; }}
            />
            <span style={{ fontSize: 11, color: "var(--t2)", fontWeight: 500 }}>comiccrafter.es</span>
          </a>
        </div>

        {/* Bottom — credits + user */}
        <div className="sidebar-bottom">
          <div className="credits-bar-label">
            <span>IA Credits</span>
            <span style={{ color: "var(--jade)" }}>∞ Ilimitados</span>
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
                <p className="client-domain">Administrador</p>
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
                title={darkMode ? "Modo claro" : "Modo oscuro"}
                aria-label={darkMode ? "Activar modo claro" : "Activar modo oscuro"}
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
                title="Cerrar sesión"
                aria-label="Cerrar sesión"
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
                <span className="topbar-client">{activeProject.name}</span>
                <span className="topbar-sep">/</span>
                <span className="topbar-page">{pageLabel}</span>
              </>
            ) : (
              <span className="topbar-client">Dashboard</span>
            )}
          </div>
          <div className="topbar-right">
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <kbd style={{
                padding: "2px 6px", borderRadius: 4, fontSize: 10,
                background: "var(--ink3)", border: "1px solid var(--ink4)",
                color: "var(--t4)", cursor: "pointer",
              }}
                onClick={() => window.dispatchEvent(new KeyboardEvent("keydown", { key: "k", ctrlKey: true, bubbles: true }))}
              >⌘K</kbd>
              <span style={{ fontSize: 11, color: "var(--t4)" }}>Búsqueda</span>
            </div>
            <div className="status-chip">
              <div className="status-pulse" />
              Activo
            </div>
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
                    <span style={{ fontSize: 13, fontWeight: 600, color: "var(--t)" }}>Notificaciones</span>
                    <button onClick={() => setNotifOpen(false)} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--t4)", fontSize: 16 }}>×</button>
                  </div>
                  <div style={{ padding: "16px", textAlign: "center" }}>
                    <p style={{ fontSize: 13, color: "var(--t3)" }}>Sin notificaciones nuevas</p>
                    <p style={{ fontSize: 11, color: "var(--t4)", marginTop: 4 }}>Las alertas de stock, competidores y logros aparecerán aquí</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Module tab nav (only when a project is active) */}
        {activeProject && (
          <div className="module-tabs" role="tablist">
            {MODULE_NAV.map((item) => {
              const isActive = currentPage === item.id;
              return (
                <Link key={item.id} href={`/projects/${activeProjectId}/${item.id}`}>
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
        )}

        {/* Page content */}
        <div className="main-content" role="main">
          {children}
        </div>
      </div>
    </div>
  );
}
