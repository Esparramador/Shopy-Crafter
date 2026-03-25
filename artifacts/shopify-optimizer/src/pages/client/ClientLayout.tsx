import { type ReactNode } from "react";
import { Link, useLocation } from "wouter";
import { useAuth } from "@/contexts/AuthContext";
import { LogOut } from "lucide-react";

const NAV_ITEMS = [
  { href: "/client",           label: "Dashboard",    icon: "📊" },
  { href: "/client/products",  label: "Productos",    icon: "📦" },
  { href: "/client/approvals", label: "Aprobaciones", icon: "✅" },
  { href: "/client/messages",  label: "Mensajes",     icon: "💬" },
];

export function ClientLayout({ children }: { children: ReactNode }) {
  const { user, logout } = useAuth();
  const [location] = useLocation();

  const initials = user?.name
    ? user.name.split(" ").map((w: string) => w[0]).join("").slice(0, 2).toUpperCase()
    : "CL";

  return (
    <div className="app-shell">
      {/* ── SIDEBAR ── */}
      <nav className="sidebar">
        {/* Logo */}
        <div className="sidebar-logo">
          <div className="logo-gem">⚡</div>
          <span className="logo-text">Shopy<em>Crafter</em></span>
          <span className="logo-badge">CLIENT</span>
        </div>

        {/* Client identity */}
        <div className="sidebar-clients">
          <span className="sidebar-label">Tu Tienda</span>
          <div className="client-pill active">
            <div className="client-dot" style={{ background: "var(--gold)" }} />
            <div className="client-info">
              <p className="client-name">{user?.name ?? "Cliente"}</p>
              <p className="client-domain">Panel de tienda</p>
            </div>
          </div>

          {/* Agency status pill */}
          <div
            style={{
              margin: "8px 0 4px",
              padding: "8px 10px",
              background: "rgba(45,212,159,0.04)",
              border: "1px solid rgba(45,212,159,0.12)",
              borderRadius: 8,
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 2 }}>
              <div className="status-pulse" style={{ width: 5, height: 5, background: "var(--jade)" }} />
              <span style={{ fontSize: 10.5, color: "var(--t2)" }}>
                Gestionado por <span style={{ color: "var(--jade)", fontWeight: 600 }}>tu agencia</span>
              </span>
            </div>
            <p style={{ fontSize: 10, color: "var(--t3)" }}>6 motores IA activos</p>
          </div>
        </div>

        {/* Nav items */}
        <div className="sidebar-nav">
          <span className="sidebar-label">Navegación</span>
          {NAV_ITEMS.map(({ href, label, icon }) => {
            const active = href === "/client" ? location === "/client" : location.startsWith(href);
            return (
              <Link key={href} href={href}>
                <div className={`nav-item${active ? " active" : ""}`}>
                  <span className="nav-icon">{icon}</span>
                  {label}
                </div>
              </Link>
            );
          })}
        </div>

        {/* Bottom */}
        <div className="sidebar-bottom">
          <div className="credits-bar-label">
            <span>Optimizaciones IA</span>
            <span style={{ color: "var(--jade)" }}>∞</span>
          </div>
          <div className="credits-bar">
            <div className="credits-bar-fill" style={{ width: "62%" }} />
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 14 }}>
            <div
              className="logo-gem"
              style={{
                width: 28, height: 28, fontSize: 11,
                background: user?.avatarColor ? `${user.avatarColor}22` : "rgba(200,168,75,0.12)",
                color: user?.avatarColor ?? "var(--gold2)",
                flexShrink: 0,
              }}
            >
              {initials}
            </div>
            <div className="client-info">
              <p className="client-name">{user?.name}</p>
              <p className="client-domain">{user?.email}</p>
            </div>
            <button
              onClick={() => logout().then(() => { window.location.href = "/login"; })}
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
        </div>
      </nav>

      {/* ── MAIN AREA ── */}
      <div className="main-area">
        {/* Topbar */}
        <div className="topbar">
          <div className="topbar-breadcrumb">
            <span style={{ fontSize: 13, color: "var(--t2)" }}>⚡</span>
            <span className="topbar-page">Tu agencia trabaja para ti 24/7</span>
          </div>
          <div className="topbar-right">
            <div className="status-chip">
              <div className="status-pulse" />
              Online
            </div>
            <button className="notif-btn" title="Notificaciones">🔔</button>
          </div>
        </div>

        {/* Page content */}
        <div className="main-content">
          {children}
        </div>
      </div>
    </div>
  );
}
