import { useState, useEffect, useRef } from "react";
import { useLocation } from "wouter";
import { Search, Sparkles, MessageSquare, CornerDownLeft } from "lucide-react";
import { askBrain, type BrainAnswer as Answer } from "@/lib/brain-ask";
import { BrainAnswer, BrainAnswerSkeleton } from "@/components/brain/BrainAnswer";
import "@/components/brain/brain.css";

const COMMANDS = [
  { id: "home", label: "Panel Admin", icon: "🏠", path: "/home", category: "Admin" },
  { id: "clients", label: "Gestión de Clientes", icon: "👥", path: "/admin/clients", category: "Admin" },
  { id: "messages", label: "Mensajes", icon: "💬", path: "/admin/messages", category: "Admin" },
  { id: "cms", label: "Editor Landing (CMS)", icon: "✏️", path: "/admin/cms", category: "Admin" },
  { id: "intelligence", label: "Revenue Intelligence", icon: "📊", path: "/admin/intelligence", category: "IA" },
  { id: "inventory", label: "Inventario M7", icon: "📦", path: "/admin/inventory", category: "IA" },
  { id: "competitors", label: "Competitor Intel", icon: "🎯", path: "/admin/competitors", category: "IA" },
  { id: "forecast", label: "Predicciones ML", icon: "🔮", path: "/admin/forecast", category: "IA" },
  { id: "prompt-library", label: "Librería de Prompts", icon: "📝", path: "/admin/prompt-library", category: "IA" },
  { id: "shopybrain-memories", label: "ShopyBrain Memorias", icon: "🧠", path: "/admin/shopybrain/memories", category: "IA" },
  { id: "cerebro", label: "Cerebro: lo que entra por cada puerta", icon: "✦", path: "/admin/cerebro", category: "IA" },
  { id: "shopybrain-insights", label: "ShopyBrain Insights", icon: "💡", path: "/admin/shopybrain/insights", category: "IA" },
  { id: "achievements", label: "Logros", icon: "🏆", path: "/admin/achievements", category: "Herramientas" },
  { id: "roadmap", label: "Plan 30-60-90", icon: "🗺", path: "/admin/roadmap", category: "Herramientas" },
  { id: "command-center", label: "Command Center", icon: "⚡", path: "/admin/command-center", category: "Herramientas" },
  { id: "automations", label: "Automatizaciones", icon: "🤖", path: "/admin/automations", category: "Herramientas" },
  { id: "abtests", label: "Tests A/B", icon: "🧪", path: "/admin/abtests", category: "Herramientas" },
  { id: "revenue", label: "Revenue", icon: "💰", path: "/admin/revenue", category: "Herramientas" },
  { id: "emails", label: "Email Flows", icon: "📧", path: "/admin/emails", category: "Herramientas" },
  { id: "vault", label: "Vault de Archivos", icon: "🗄️", path: "/admin/vault", category: "Herramientas" },
  { id: "products", label: "Productos Admin", icon: "🛍️", path: "/admin/products", category: "Herramientas" },
  { id: "fusion-studio", label: "Fusion Studio", icon: "🎬", path: "/admin/avatar-studio", category: "Creatividad" },
  { id: "meshy-studio", label: "Meshy 3D Studio", icon: "🧊", path: "/admin/meshy-studio", category: "Creatividad" },
  { id: "template-studio", label: "Template Studio", icon: "🎨", path: "/admin/template-studio", category: "Creatividad" },
  { id: "deck-builder", label: "Deck Builder", icon: "📑", path: "/admin/deck-builder", category: "Creatividad" },
  { id: "system", label: "System Health", icon: "🖥", path: "/admin/system", category: "Sistema" },
  { id: "apk", label: "APK Manager", icon: "📱", path: "/admin/apk", category: "Sistema" },
  { id: "billing", label: "Facturación", icon: "💳", path: "/admin/billing", category: "Sistema" },
  { id: "settings", label: "Configuración", icon: "⚙️", path: "/admin/settings", category: "Sistema" },
  { id: "help-connections", label: "Conexiones Shopify", icon: "🔗", path: "/help/connections", category: "Sistema" },
];

export function CommandPalette() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState(0);
  const [location, navigate] = useLocation();
  const inputRef = useRef<HTMLInputElement>(null);
  // Lo que no es una página va al cerebro: «Preguntar a ShopyBrain».
  const [brain, setBrain] = useState<{ query: string; loading: boolean; answer: Answer | null; error: string } | null>(null);
  const brainAbort = useRef<AbortController | null>(null);

  const closePalette = () => {
    brainAbort.current?.abort();
    setOpen(false);
  };

  const ask = async (q: string) => {
    const text = q.trim();
    if (!text) return;
    brainAbort.current?.abort();
    const ctrl = new AbortController();
    brainAbort.current = ctrl;
    setBrain({ query: text, loading: true, answer: null, error: "" });
    try {
      const projectId = location.match(/\/projects\/(\d+)/)?.[1];
      const answer = await askBrain(text, { channel: "command_palette", currentRoute: location, activeProjectId: projectId, signal: ctrl.signal });
      if (!ctrl.signal.aborted) setBrain({ query: text, loading: false, answer, error: "" });
    } catch (e) {
      if (ctrl.signal.aborted) return;
      setBrain({ query: text, loading: false, answer: null, error: e instanceof Error ? e.message : "ShopyBrain no ha podido responder" });
    }
  };

  const continueInChat = (text: string) => {
    window.dispatchEvent(new CustomEvent("shopycrafter:chatbot", { detail: { message: text } }));
    closePalette();
  };

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setOpen(o => !o);
        setQuery("");
        setSelected(0);
        setBrain(null);
      }
      if (e.key === "Escape") { brainAbort.current?.abort(); setOpen(false); }
      if (e.key === "?" && !["INPUT", "TEXTAREA"].includes((e.target as HTMLElement).tagName) && !(e.target as HTMLElement).isContentEditable) {
        setOpen(o => !o);
        setBrain(null);
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

  // La última opción, si hay texto, es preguntar al cerebro.
  const canAsk = query.trim().length > 1;
  const total = filtered.length + (canAsk ? 1 : 0);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") { e.preventDefault(); setSelected(s => Math.min(s + 1, total - 1)); }
    if (e.key === "ArrowUp") { e.preventDefault(); setSelected(s => Math.max(s - 1, 0)); }
    if (e.key === "Enter") {
      e.preventDefault();
      if (filtered[selected]) {
        navigate(filtered[selected].path);
        closePalette();
      } else if (canAsk) {
        void ask(query);
      }
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
      onClick={closePalette}
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
            onChange={e => { setQuery(e.target.value); setSelected(0); setBrain(null); }}
            onKeyDown={handleKeyDown}
            placeholder="Busca una página o pregunta a ShopyBrain…"
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

        {brain ? (
          <div className="brain-palette-body">
            {brain.loading && <BrainAnswerSkeleton label={`Preguntando a ShopyBrain: «${brain.query}»`} />}
            {brain.error && (
              <div className="brain-answer">
                <div className="brain-ev-detail is-err">{brain.error}</div>
                <div className="brain-palette-foot">
                  <button type="button" className="btn btn-sm btn-gold" onClick={() => ask(brain.query)}>Reintentar</button>
                  <button type="button" className="btn btn-sm btn-ghost" onClick={() => continueInChat(brain.query)}><MessageSquare size={13} /> Llevar al chat</button>
                </div>
              </div>
            )}
            {brain.answer && (
              <BrainAnswer
                answer={brain.answer}
                extra={(
                  <div className="brain-palette-foot">
                    <button type="button" className="btn btn-sm btn-ghost" onClick={() => continueInChat(brain.query)}><MessageSquare size={13} /> Seguir en el chat</button>
                    <button type="button" className="btn btn-sm btn-ghost" onClick={() => { setBrain(null); inputRef.current?.focus(); }}>Volver a la lista</button>
                  </div>
                )}
              />
            )}
          </div>
        ) : (
        <div style={{ maxHeight: 360, overflowY: "auto" }} role="listbox" aria-label="Resultados">
          {filtered.length === 0 && !canAsk ? (
            <div style={{ padding: "32px", textAlign: "center", color: "var(--t3)", fontSize: 14 }}>
              Escribe para buscar una página o preguntar a ShopyBrain
            </div>
          ) : (
            filtered.map((cmd, i) => (
              <div
                key={cmd.id}
                role="option"
                aria-selected={selected === i}
                onClick={() => { navigate(cmd.path); closePalette(); }}
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
          {canAsk && (
            <div
              role="option"
              aria-selected={selected === filtered.length}
              className={`brain-palette-ask${selected === filtered.length ? " is-selected" : ""}`}
              onClick={() => ask(query)}
              onMouseEnter={() => setSelected(filtered.length)}
            >
              <span className="brain-answer-orb" aria-hidden="true"><Sparkles size={13} /></span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <p className="brain-palette-ask-q">Preguntar a <strong>ShopyBrain</strong>: «{query.trim()}»</p>
                <p style={{ fontSize: 11, color: "var(--t4)", marginTop: 2 }}>
                  {filtered.length === 0 ? "No es ninguna página: el cerebro responde o lo hace" : "Responde, busca o ejecuta una acción"}
                </p>
              </div>
              <CornerDownLeft size={14} style={{ color: "var(--t3)", flexShrink: 0 }} />
            </div>
          )}
        </div>
        )}

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
