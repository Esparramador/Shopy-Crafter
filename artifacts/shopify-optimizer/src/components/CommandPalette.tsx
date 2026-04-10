import { useState, useEffect, useRef } from "react";
import { useLocation } from "wouter";
import { Search } from "lucide-react";

const COMMANDS = [
  { id: "intelligence", label: "Revenue Intelligence", icon: "📊", path: "/admin/intelligence", category: "Páginas" },
  { id: "inventory", label: "Inventario M7", icon: "📦", path: "/admin/inventory", category: "Páginas" },
  { id: "competitors", label: "Competitor Intel", icon: "🎯", path: "/admin/competitors", category: "Páginas" },
  { id: "forecast", label: "Predicciones ML", icon: "🔮", path: "/admin/forecast", category: "Páginas" },

  { id: "achievements", label: "Logros", icon: "🏆", path: "/admin/achievements", category: "Páginas" },
  { id: "roadmap", label: "Plan 30-60-90", icon: "🗺", path: "/admin/roadmap", category: "Páginas" },
  { id: "clients", label: "Gestión de Clientes", icon: "👥", path: "/admin/clients", category: "Páginas" },
  { id: "cms", label: "Editor Landing", icon: "⚡", path: "/admin/cms", category: "Páginas" },
  { id: "system", label: "System Health", icon: "🖥", path: "/admin/system", category: "Páginas" },
];

export function CommandPalette() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState(0);
  const [, navigate] = useLocation();
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setOpen(o => !o);
        setQuery("");
        setSelected(0);
      }
      if (e.key === "Escape") setOpen(false);
      if (e.key === "?" && !["INPUT", "TEXTAREA"].includes((e.target as HTMLElement).tagName)) {
        setOpen(o => !o);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 50);
  }, [open]);

  const filtered = COMMANDS.filter(c =>
    c.label.toLowerCase().includes(query.toLowerCase()) ||
    c.path.toLowerCase().includes(query.toLowerCase())
  );

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") { e.preventDefault(); setSelected(s => Math.min(s + 1, filtered.length - 1)); }
    if (e.key === "ArrowUp") { e.preventDefault(); setSelected(s => Math.max(s - 1, 0)); }
    if (e.key === "Enter" && filtered[selected]) {
      navigate(filtered[selected].path);
      setOpen(false);
    }
  };

  if (!open) return null;

  return (
    <div
      style={{
        position: "fixed", inset: 0, zIndex: 10000,
        background: "rgba(8,8,16,0.8)", backdropFilter: "blur(4px)",
        display: "flex", alignItems: "flex-start", justifyContent: "center",
        paddingTop: "15vh",
      }}
      onClick={() => setOpen(false)}
    >
      <div
        style={{
          background: "var(--ink2)", borderRadius: 16,
          border: "1px solid var(--gold)", width: "100%", maxWidth: 560,
          boxShadow: "0 24px 80px rgba(0,0,0,0.6), 0 0 40px rgba(200,168,75,0.1)",
          overflow: "hidden",
        }}
        onClick={e => e.stopPropagation()}
      >
        <div style={{ display: "flex", alignItems: "center", padding: "14px 18px", borderBottom: "1px solid var(--ink3)", gap: 10 }}>
          <Search size={18} style={{ color: "var(--t3)", flexShrink: 0 }} />
          <input
            ref={inputRef}
            value={query}
            onChange={e => { setQuery(e.target.value); setSelected(0); }}
            onKeyDown={handleKeyDown}
            placeholder="Buscar páginas, acciones..."
            style={{
              flex: 1, background: "none", border: "none", outline: "none",
              fontSize: 16, color: "var(--t)", caretColor: "var(--gold)",
            }}
            aria-label="Buscar comandos"
          />
          <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
            <kbd style={{
              padding: "2px 6px", borderRadius: 4, fontSize: 10,
              background: "var(--ink3)", border: "1px solid var(--ink4)", color: "var(--t3)",
            }}>ESC</kbd>
          </div>
        </div>

        <div style={{ maxHeight: 360, overflowY: "auto" }}>
          {filtered.length === 0 ? (
            <div style={{ padding: "32px", textAlign: "center", color: "var(--t3)", fontSize: 14 }}>
              Sin resultados para "{query}"
            </div>
          ) : (
            filtered.map((cmd, i) => (
              <div
                key={cmd.id}
                onClick={() => { navigate(cmd.path); setOpen(false); }}
                style={{
                  padding: "12px 18px",
                  display: "flex", alignItems: "center", gap: 12,
                  cursor: "pointer",
                  background: selected === i ? "var(--ink3)" : "transparent",
                  borderLeft: selected === i ? "2px solid var(--gold)" : "2px solid transparent",
                  transition: "all 0.1s",
                }}
                onMouseEnter={() => setSelected(i)}
              >
                <span style={{ fontSize: 18, flexShrink: 0 }}>{cmd.icon}</span>
                <div style={{ flex: 1 }}>
                  <p style={{ fontSize: 14, color: "var(--t)", fontWeight: selected === i ? 600 : 400 }}>{cmd.label}</p>
                  <p style={{ fontSize: 11, color: "var(--t4)", marginTop: 2 }}>{cmd.path}</p>
                </div>
                <span style={{ fontSize: 10, color: "var(--t4)", padding: "2px 6px", background: "var(--ink3)", borderRadius: 4 }}>
                  {cmd.category}
                </span>
              </div>
            ))
          )}
        </div>

        <div style={{ padding: "10px 18px", borderTop: "1px solid var(--ink3)", display: "flex", gap: 16 }}>
          {[
            { key: "↑↓", label: "Navegar" },
            { key: "↵", label: "Abrir" },
            { key: "ESC", label: "Cerrar" },
            { key: "?", label: "Abrir con ?" },
          ].map(k => (
            <div key={k.key} style={{ display: "flex", alignItems: "center", gap: 4 }}>
              <kbd style={{ padding: "2px 6px", borderRadius: 4, fontSize: 10, background: "var(--ink3)", border: "1px solid var(--ink4)", color: "var(--t3)" }}>
                {k.key}
              </kbd>
              <span style={{ fontSize: 11, color: "var(--t4)" }}>{k.label}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
