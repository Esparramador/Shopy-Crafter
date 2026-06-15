import { type ReactNode, useState, useEffect } from "react";
import { Link, useLocation } from "wouter";
import { useAuth } from "@/contexts/AuthContext";
import { useCms } from "@/contexts/CmsContext";
import { LogOut, Menu, X } from "lucide-react";
import { ClientChatbot } from "./ClientChatbot";
import { useClientPreview } from "./ClientPreviewContext";

const _BASE_URL = import.meta.env.BASE_URL?.replace(/\/$/, "") ?? "";
const API_BASE = import.meta.env.BASE_URL?.replace(/\/$/, "") ?? "";

const DEFAULT_NAV_ITEMS = [
  { href: "/client",           label: "Dashboard",    icon: "📊" },
  { href: "/client/products",  label: "Productos",    icon: "📦" },
  { href: "/client/approvals", label: "Aprobaciones", icon: "✅" },
  { href: "/client/messages",  label: "Mensajes",     icon: "💬" },
  { href: "/client/reports",   label: "Reportes",     icon: "📈" },
];

interface ClientCmsPanel {
  navItems?: { label: string; icon: string }[];
  sidebar?: { yourStore?: string; defaultName?: string; storePanel?: string; managedBy?: string; agency?: string; enginesActive?: string; navigation?: string; aiOptimizations?: string };
  topbar?: string;
  logoBadge?: string;
  statusOnline?: string;
  tooltips?: { logout?: string };
}

export function ClientLayout({ children }: { children: ReactNode }) {
  const { user, logout } = useAuth();
  const [location, navigate] = useLocation();
  const { content: cmsContent } = useCms();
  const cp: ClientCmsPanel = (cmsContent?.clientPanel as ClientCmsPanel) ?? {};
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [unreadMessages, setUnreadMessages] = useState(0);
  const { previewPid, setPreviewPid } = useClientPreview();
  const [projects, setProjects] = useState<Array<{ id: number; name: string; shopDomain: string }>>([]);

  useEffect(() => {
    if (user?.role !== "admin") return;
    fetch(`${API_BASE}/api/admin/projects-list`, { credentials: "include" })
      .then(r => r.json())
      .then((d: Array<{ id: number; name: string; shopDomain: string }>) => {
        if (!Array.isArray(d)) return;
        setProjects(d);
        if (!previewPid && d.length > 0) setPreviewPid(String(d[0].id));
      })
      .catch(() => {});
  }, [user?.role]);

  useEffect(() => { setSidebarOpen(false); }, [location]);

  useEffect(() => {
    const poll = () => {
      fetch(`${API_BASE}/api/client/unread-count`, { credentials: "include" })
        .then(r => r.ok ? r.json() : null)
        .then(d => { if (d && typeof d.count === "number") setUnreadMessages(d.count); })
        .catch(() => {});
    };
    poll();
    const t = setInterval(poll, 20000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    if (location === "/client/messages") setUnreadMessages(0);
  }, [location]);

  const NAV_ITEMS = DEFAULT_NAV_ITEMS.map((item, i) => ({
    ...item,
    label: cp.navItems?.[i]?.label ?? item.label,
    icon: cp.navItems?.[i]?.icon ?? item.icon,
  }));

  const initials = user?.name
    ? user.name.split(" ").map((w: string) => w[0]).join("").slice(0, 2).toUpperCase()
    : "CL";

  return (
    <div className="app-shell">
      {/* ── TABLET SIDEBAR OVERLAY ── */}
      <div
        className={`sidebar-overlay${sidebarOpen ? " visible" : ""}`}
        onClick={() => setSidebarOpen(false)}
        aria-hidden="true"
      />

      {/* ── SIDEBAR ── */}
      <nav className={`sidebar${sidebarOpen ? " open" : ""}`} role="navigation" aria-label="Navegación cliente">
        {/* Logo */}
        <div className="sidebar-logo">
          <div className="logo-gem">⚡</div>
          <span className="logo-text">Shopy<em>Crafter</em></span>
          <span className="logo-badge">{cp.logoBadge ?? "CLIENT"}</span>
        </div>

        {/* Client identity */}
        <div className="sidebar-clients">
          <span className="sidebar-label">{cp.sidebar?.yourStore ?? "Tu Tienda"}</span>
          <div className="client-pill active">
            <div className="client-dot" style={{ background: "var(--gold)" }} />
            <div className="client-info">
              <p className="client-name">{user?.name ?? (cp.sidebar?.defaultName ?? "Cliente")}</p>
              <p className="client-domain">{cp.sidebar?.storePanel ?? "Panel de tienda"}</p>
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
                {cp.sidebar?.managedBy ?? "Gestionado por"} <span style={{ color: "var(--jade)", fontWeight: 600 }}>{cp.sidebar?.agency ?? "tu agencia"}</span>
              </span>
            </div>
            <p style={{ fontSize: 10, color: "var(--t3)" }}>{cp.sidebar?.enginesActive ?? "6 motores IA activos"}</p>
          </div>
        </div>

        {/* Nav items */}
        <div className="sidebar-nav">
          <span className="sidebar-label">{cp.sidebar?.navigation ?? "Navegación"}</span>
          {NAV_ITEMS.map(({ href, label, icon }) => {
            const active = href === "/client" ? location === "/client" : location.startsWith(href);
            const isMessages = href === "/client/messages";
            const badge = isMessages && unreadMessages > 0;
            return (
              <Link key={href} href={href}>
                <div className={`nav-item${active ? " active" : ""}`} style={{ position: "relative" }}>
                  <span className="nav-icon">{icon}</span>
                  {label}
                  {badge && (
                    <span style={{
                      marginLeft: "auto",
                      minWidth: 18, height: 18,
                      background: "var(--gold)",
                      color: "#0a0a14",
                      borderRadius: 9,
                      fontSize: 10,
                      fontWeight: 800,
                      display: "flex", alignItems: "center", justifyContent: "center",
                      padding: "0 5px",
                    }}>
                      {unreadMessages > 9 ? "9+" : unreadMessages}
                    </span>
                  )}
                </div>
              </Link>
            );
          })}
        </div>

        {/* Bottom */}
        <div className="sidebar-bottom">
          <div className="credits-bar-label">
            <span>{cp.sidebar?.aiOptimizations ?? "Optimizaciones IA"}</span>
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
              title={cp.tooltips?.logout ?? "Cerrar sesión"}
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
        {/* Admin preview banner */}
        {user?.role === "admin" && !user?.impersonating && (
          <div style={{
            display: "flex", alignItems: "center", justifyContent: "space-between",
            padding: "7px 16px", fontSize: 11.5, fontWeight: 500,
            background: "rgba(200,168,75,0.08)", borderBottom: "1px solid rgba(200,168,75,0.20)",
            color: "var(--gold)", gap: 8, flexWrap: "wrap",
          }}>
            <span style={{ flexShrink: 0 }}>👁 Vista previa — ves como Admin</span>
            <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
              {projects.length > 0 && (
                <select
                  value={previewPid}
                  onChange={e => setPreviewPid(e.target.value)}
                  style={{
                    background: "rgba(200,168,75,0.10)", border: "1px solid rgba(200,168,75,0.30)",
                    borderRadius: 5, color: "var(--gold)", fontSize: 11, fontWeight: 600,
                    padding: "2px 7px", cursor: "pointer", outline: "none",
                  }}
                >
                  <option value="">— Selecciona tienda —</option>
                  {projects.map(p => (
                    <option key={p.id} value={String(p.id)}>
                      {p.name}{p.shopDomain ? ` · ${p.shopDomain}` : ""}
                    </option>
                  ))}
                </select>
              )}
              <a
                href={`${_BASE_URL}/admin/cms`}
                style={{
                  padding: "2px 9px", borderRadius: 5, fontSize: 11, fontWeight: 600,
                  background: "rgba(200,168,75,0.12)", border: "1px solid rgba(200,168,75,0.30)",
                  color: "var(--gold)", textDecoration: "none",
                }}
              >✏️ CMS</a>
              <a
                href={`${_BASE_URL}/home`}
                style={{
                  padding: "2px 9px", borderRadius: 5, fontSize: 11, fontWeight: 600,
                  background: "var(--ink3)", border: "1px solid var(--bdr2)",
                  color: "var(--t2)", textDecoration: "none",
                }}
              >← Admin</a>
            </div>
          </div>
        )}
        {/* Topbar */}
        <div className="topbar">
          <button
            className="hamburger-btn"
            onClick={() => setSidebarOpen(o => !o)}
            aria-label={sidebarOpen ? "Cerrar menú" : "Abrir menú"}
            aria-expanded={sidebarOpen}
          >
            {sidebarOpen ? <X size={16} /> : <Menu size={16} />}
          </button>
          <div className="topbar-breadcrumb">
            <span style={{ fontSize: 13, color: "var(--t2)" }}>⚡</span>
            <span className="topbar-page">{cp.topbar ?? "Tu agencia trabaja para ti 24/7"}</span>
          </div>
          <div className="topbar-right">
            <div className="status-chip">
              <div className="status-pulse" />
              {cp.statusOnline ?? "Online"}
            </div>
            <button className="notif-btn" title="Notificaciones" onClick={() => { navigate("/client/messages"); }}>🔔</button>
          </div>
        </div>

        {/* Page content */}
        <div className="main-content">
          {children}
        </div>
      </div>

      {/* Floating AI Chatbot del cliente — siempre visible (experto en su tienda) */}
      <ClientChatbot />
    </div>
  );
}
