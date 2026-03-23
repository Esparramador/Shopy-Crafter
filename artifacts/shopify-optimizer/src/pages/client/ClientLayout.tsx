import { type ReactNode } from "react";
import { Link, useLocation } from "wouter";
import { useAuth } from "@/contexts/AuthContext";
import {
  LayoutDashboard, Package, CheckSquare, MessageSquare,
  LogOut, Bell, Store, Zap,
} from "lucide-react";

const NAV_ITEMS = [
  { href: "/client", label: "Dashboard", icon: LayoutDashboard },
  { href: "/client/products", label: "Productos", icon: Package },
  { href: "/client/approvals", label: "Aprobaciones", icon: CheckSquare },
  { href: "/client/messages", label: "Mensajes", icon: MessageSquare },
];

export function ClientLayout({ children }: { children: ReactNode }) {
  const { user, logout } = useAuth();
  const [location] = useLocation();

  const initials = user?.name
    ? user.name.split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase()
    : "CL";

  return (
    <div className="min-h-screen bg-[#08080f] flex">
      {/* Sidebar */}
      <aside className="w-64 flex-shrink-0 border-r border-white/5 flex flex-col">
        <div className="p-5 border-b border-white/5">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-[#5b4eff]/20 border border-[#5b4eff]/30 flex items-center justify-center">
              <Store className="w-4 h-4 text-[#5b4eff]" />
            </div>
            <div className="min-w-0">
              <p className="text-xs font-semibold text-white truncate">{user?.name ?? "Cliente"}</p>
              <p className="text-xs text-white/30 truncate">Panel de tienda</p>
            </div>
          </div>
        </div>

        {/* Agency Banner */}
        <div className="mx-3 mt-3 px-3 py-2 bg-[#5b4eff]/10 border border-[#5b4eff]/20 rounded-xl">
          <div className="flex items-center gap-2">
            <div className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
            <p className="text-xs text-white/60">Gestionado por <span className="text-[#5b4eff] font-semibold">tu agencia</span></p>
          </div>
          <p className="text-xs text-white/30 mt-0.5">6 motores IA activos</p>
        </div>

        <nav className="flex-1 p-3 space-y-1 mt-2">
          {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
            const active = href === "/client" ? location === "/client" : location.startsWith(href);
            return (
              <Link key={href} href={href}>
                <a className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm transition-all cursor-pointer ${
                  active
                    ? "bg-[#5b4eff]/15 text-[#5b4eff] border border-[#5b4eff]/20"
                    : "text-white/50 hover:text-white hover:bg-white/5"
                }`}>
                  <Icon className="w-4 h-4 flex-shrink-0" />
                  {label}
                </a>
              </Link>
            );
          })}
        </nav>

        <div className="p-3 border-t border-white/5">
          <div className="flex items-center gap-3 px-3 py-2 mb-1">
            <div
              className="w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold text-white flex-shrink-0"
              style={{ backgroundColor: user?.avatarColor ?? "#5b4eff" }}
            >
              {initials}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-white truncate">{user?.name}</p>
              <p className="text-xs text-white/30 truncate">{user?.email}</p>
            </div>
          </div>
          <button
            onClick={() => logout().then(() => window.location.href = "/login")}
            className="w-full flex items-center gap-2 px-3 py-2 text-sm text-white/40 hover:text-red-400 hover:bg-red-500/5 rounded-xl transition-all"
          >
            <LogOut className="w-4 h-4" />
            Cerrar sesión
          </button>
        </div>
      </aside>

      {/* Main */}
      <div className="flex-1 flex flex-col min-w-0">
        <header className="h-14 border-b border-white/5 flex items-center justify-between px-6">
          <div className="flex items-center gap-2">
            <Zap className="w-4 h-4 text-[#5b4eff]" />
            <span className="text-sm text-white/40">Tu agencia trabaja para ti 24/7</span>
          </div>
          <div className="flex items-center gap-3">
            <button className="relative w-8 h-8 flex items-center justify-center rounded-lg hover:bg-white/5 text-white/40 hover:text-white transition-all">
              <Bell className="w-4 h-4" />
            </button>
          </div>
        </header>
        <main className="flex-1 overflow-y-auto p-6">
          {children}
        </main>
      </div>
    </div>
  );
}
