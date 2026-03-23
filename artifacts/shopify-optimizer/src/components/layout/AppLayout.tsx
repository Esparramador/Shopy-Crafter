import { ReactNode } from "react";
import { Link, useRoute, useLocation } from "wouter";
import { LogOut, Settings } from "lucide-react";
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
};

export function AppLayout({ children }: AppLayoutProps) {
  const { data: projects, isLoading } = useListProjects();
  const [match, params] = useRoute("/projects/:id/*");
  const activeProjectId = match ? parseInt(params.id) : null;
  const activeProject = projects?.find((p: { id: number }) => p.id === activeProjectId);
  const { user, logout } = useAuth();
  const [location, navigate] = useLocation();

  const currentPage = (params as Record<string, string> | null)?.["*"] ?? "";
  const pageLabel = PAGE_LABELS[currentPage] ?? "Dashboard";

  return (
    <div className="app-shell">
      {/* ── SIDEBAR ── */}
      <nav className="sidebar">
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
                  <div className={`client-pill${isActive ? " active" : ""}`}>
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

          <Link href="/">
            <div className="nav-item" style={{ marginTop: 4 }}>
              <span className="nav-icon">＋</span>
              Nueva tienda
            </div>
          </Link>
        </div>

        {/* Admin nav */}
        <div className="sidebar-nav">
          <span className="sidebar-label">Administración</span>

          <Link href="/admin/clients">
            <div className={`nav-item${location === "/admin/clients" ? " active" : ""}`}>
              <span className="nav-icon">👥</span>
              Gestión de Clientes
            </div>
          </Link>

          <Link href="/admin/cms">
            <div className={`nav-item${location === "/admin/cms" ? " active" : ""}`}>
              <span className="nav-icon">⚡</span>
              Editor Landing
            </div>
          </Link>

          {activeProject && (
            <Link href={`/projects/${activeProject.id}/settings`}>
              <div className={`nav-item${currentPage === "settings" ? " active" : ""}`}>
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
              >
                {user.name.slice(0, 2).toUpperCase()}
              </div>
              <div className="client-info">
                <p className="client-name">{user.name}</p>
                <p className="client-domain">Administrador</p>
              </div>
              <button
                onClick={() => logout().then(() => navigate("/login"))}
                title="Cerrar sesión"
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
        <div className="topbar">
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
            <div className="status-chip">
              <div className="status-pulse" />
              Activo
            </div>
            <button className="notif-btn" title="Notificaciones">🔔</button>
          </div>
        </div>

        {/* Module tab nav (only when a project is active) */}
        {activeProject && (
          <div className="module-tabs">
            {MODULE_NAV.map((item) => {
              const isActive = currentPage === item.id;
              return (
                <Link key={item.id} href={`/projects/${activeProjectId}/${item.id}`}>
                  <div className={`module-tab${isActive ? " active" : ""}`}>
                    <span style={{ fontSize: 13 }}>{item.icon}</span>
                    {item.label}
                  </div>
                </Link>
              );
            })}
          </div>
        )}

        {/* Page content */}
        <div className="main-content">
          {children}
        </div>
      </div>
    </div>
  );
}
