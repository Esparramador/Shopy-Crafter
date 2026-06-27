import { type ReactNode, useState, useEffect, useRef } from "react";
import { Link, useLocation } from "wouter";
import { useAuth } from "@/contexts/AuthContext";
import { useCms } from "@/contexts/CmsContext";
import { LogOut, Menu, X } from "lucide-react";
import { ClientChatbot } from "./ClientChatbot";
import { useClientPreview } from "./ClientPreviewContext";
import { useNotifications } from "@/hooks/useNotifications";

const _BASE_URL = import.meta.env.BASE_URL?.replace(/\/$/, "") ?? "";
const API_BASE = import.meta.env.BASE_URL?.replace(/\/$/, "") ?? "";

const DEFAULT_NAV_ITEMS = [
  { href: "/client",           label: "Dashboard",    icon: "📊" },
  { href: "/client/products",  label: "Productos",    icon: "📦" },
  { href: "/client/approvals", label: "Aprobaciones", icon: "✅" },
  { href: "/client/messages",  label: "Mensajes",     icon: "💬" },
  { href: "/client/reports",   label: "Reportes",     icon: "📈" },
  { href: "/client/tienda",    label: "Mis Planes",   icon: "🛒" },
];

interface ClientCmsPanel {
  navItems?: { label: string; icon: string }[];
  sidebar?: { yourStore?: string; defaultName?: string; storePanel?: string; managedBy?: string; agency?: string; enginesActive?: string; navigation?: string; aiOptimizations?: string };
  topbar?: string;
  logoBadge?: string;
  statusOnline?: string;
  greetingName?: string;
  tooltips?: { logout?: string };
}

export function ClientLayout({ children }: { children: ReactNode }) {
  const { user, logout } = useAuth();
  useNotifications();
  const [location, navigate] = useLocation();
  const { content: cmsContent } = useCms();
  const cp: ClientCmsPanel = (cmsContent?.clientPanel as ClientCmsPanel) ?? {};
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [unreadMessages, setUnreadMessages] = useState(0);
  const prevUnreadClientRef = useRef(-1);
  const [clientToast, setClientToast] = useState<string | null>(null);
  const clientToastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const locationRef = useRef(location);
  useEffect(() => { locationRef.current = location; }, [location]);
  const { previewPid, setPreviewPid } = useClientPreview();
  const [projects, setProjects] = useState<Array<{ id: number; name: string; shopDomain: string }>>([]);
  const [clientProjectInfo, setClientProjectInfo] = useState<{ name: string | null; shopDomain: string | null } | null>(null);

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

  useEffect(() => {
    if (user?.role === "admin") return;
    fetch(`${API_BASE}/api/client/project-info`, { credentials: "include" })
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d) setClientProjectInfo(d); })
      .catch(() => {});
  }, [user?.role]);

  useEffect(() => { setSidebarOpen(false); }, [location]);

  useEffect(() => {
    const isAdmin = user?.role === "admin";
    function apid(url: string) {
      return isAdmin && previewPid
        ? `${url}${url.includes("?") ? "&" : "?"}pid=${encodeURIComponent(previewPid)}`
        : url;
    }
    const poll = () => {
      fetch(apid(`${API_BASE}/api/client/unread-count`), { credentials: "include" })
        .then(r => r.ok ? r.json() : null)
        .then(d => {
          if (d && typeof d.count === "number") {
            const newCount = d.count;
            if (prevUnreadClientRef.current === -1 && newCount > 0 && locationRef.current !== "/client/messages") {
              const diff = newCount;
              const msg = `💬 Tienes ${diff} mensaje${diff > 1 ? "s" : ""} pendiente${diff > 1 ? "s" : ""} sin leer`;
              setClientToast(msg);
              if (clientToastTimer.current) clearTimeout(clientToastTimer.current);
              clientToastTimer.current = setTimeout(() => setClientToast(null), 6000);
            } else if (prevUnreadClientRef.current >= 0 && newCount > prevUnreadClientRef.current && locationRef.current !== "/client/messages") {
              try {
                const ctx = new AudioContext();
                const osc = ctx.createOscillator();
                const gain = ctx.createGain();
                osc.connect(gain);
                gain.connect(ctx.destination);
                osc.frequency.setValueAtTime(660, ctx.currentTime);
                osc.frequency.setValueAtTime(880, ctx.currentTime + 0.1);
                gain.gain.setValueAtTime(0.2, ctx.currentTime);
                gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.5);
                osc.start(ctx.currentTime);
                osc.stop(ctx.currentTime + 0.5);
              } catch { /* ok */ }
              const diff = newCount - prevUnreadClientRef.current;
              const msg = `💬 Tienes ${diff} mensaje${diff > 1 ? "s" : ""} nuevo${diff > 1 ? "s" : ""} de tu agencia`;
              setClientToast(msg);
              if (clientToastTimer.current) clearTimeout(clientToastTimer.current);
              clientToastTimer.current = setTimeout(() => setClientToast(null), 6000);
            }
            prevUnreadClientRef.current = newCount;
            setUnreadMessages(newCount);
          }
        })
        .catch(() => {});
    };
    poll();
    const t = setInterval(poll, 15000);
    return () => clearInterval(t);
  }, [user?.role, previewPid]);

  useEffect(() => {
    if (location === "/client/messages") setUnreadMessages(0);
  }, [location]);

  const NAV_ITEMS = DEFAULT_NAV_ITEMS.map((item, i) => ({
    ...item,
    label: cp.navItems?.[i]?.label ?? item.label,
    icon: cp.navItems?.[i]?.icon ?? item.icon,
  }));

  const activeProject = user?.role === "admin"
    ? (projects.find(p => String(p.id) === previewPid) ?? null)
    : clientProjectInfo ? { name: clientProjectInfo.name, shopDomain: clientProjectInfo.shopDomain } : null;

  const displayName = activeProject?.name ?? cp.sidebar?.defaultName ?? "Cliente";
  const displayDomain = activeProject?.shopDomain ?? cp.sidebar?.storePanel ?? "Panel de tienda";

  const initials = displayName
    ? displayName.split(" ").map((w: string) => w[0]).join("").slice(0, 2).toUpperCase()
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
              <p className="client-name">{displayName}</p>
              <p className="client-domain">{displayDomain}</p>
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

      {/* In-app notification toast for client */}
      {clientToast && (
        <div
          onClick={() => { navigate("/client/messages"); setClientToast(null); }}
          style={{
            position: "fixed", bottom: 28, right: 28, zIndex: 99999,
            background: "linear-gradient(135deg, #1a6b4a 0%, #22c77e 100%)",
            color: "#fff",
            padding: "14px 20px", borderRadius: 14,
            boxShadow: "0 8px 36px rgba(0,0,0,0.55)",
            display: "flex", alignItems: "center", gap: 12,
            fontSize: 13, fontWeight: 700, cursor: "pointer",
            maxWidth: 320,
          }}
        >
          <span style={{ fontSize: 22, flexShrink: 0 }}>💬</span>
          <div style={{ flex: 1 }}>
            <div>{clientToast}</div>
            <div style={{ fontSize: 11, fontWeight: 500, opacity: 0.85, marginTop: 2 }}>
              Haz clic para ver
            </div>
          </div>
          <button
            onClick={e => { e.stopPropagation(); setClientToast(null); }}
            style={{
              background: "none", border: "none", cursor: "pointer",
              fontSize: 16, color: "#fff", opacity: 0.7, padding: "0 2px", flexShrink: 0,
            }}
          >✕</button>
        </div>
      )}
    </div>
  );
}
