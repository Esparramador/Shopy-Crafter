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
                    {item.label}
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
