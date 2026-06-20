import { useState, useRef, useEffect } from "react";
import { MessageCircle, X, Send, Loader2, Sparkles, ChevronDown } from "lucide-react";

const API = import.meta.env.BASE_URL.replace(/\/$/, "");

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
}

function uuid() { return Math.random().toString(36).slice(2) + Date.now().toString(36); }

function formatText(content: string): React.ReactNode {
  return content.split(/(\*\*[^*]+\*\*|`[^`]+`|\n)/g).map((part, i) => {
    if (part.startsWith("**") && part.endsWith("**"))
      return <strong key={i} style={{ color: "var(--l-gold, #c8a84b)", fontWeight: 700 }}>{part.slice(2, -2)}</strong>;
    if (part.startsWith("`") && part.endsWith("`"))
      return <code key={i} style={{ background: "rgba(255,255,255,0.08)", padding: "1px 5px", borderRadius: 4, fontSize: 11, fontFamily: "monospace", color: "#2dd49f" }}>{part.slice(1, -1)}</code>;
    if (part === "\n") return <br key={i} />;
    return part;
  });
}

const SUGGESTIONS = [
  { icon: "🚀", text: "¿Qué hace Shopy Crafter?" },
  { icon: "💰", text: "¿Cuánto cuesta?" },
  { icon: "📈", text: "¿Cómo mejora mis ventas?" },
  { icon: "⚙️", text: "¿Cómo funciona?" },
  { icon: "🆓", text: "¿Hay prueba gratuita?" },
  { icon: "🏪", text: "¿Para qué tipo de tiendas?" },
];

const WELCOME: Message = {
  id: "welcome",
  role: "assistant",
  content: `¡Hola! 👋 Soy el asesor virtual de **Shopy Crafter**.\n\nEstoy aquí para resolver todas tus dudas sobre cómo podemos hacer crecer y escalar tu tienda Shopify con IA.\n\n¿En qué puedo ayudarte?`,
};

export default function LandingChatbot() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([WELCOME]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(true);
  const [pulse, setPulse] = useState(true);
  const endRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (open) {
      endRef.current?.scrollIntoView({ behavior: "smooth" });
      setTimeout(() => inputRef.current?.focus(), 200);
    }
  }, [messages, open]);

  useEffect(() => {
    const t = setTimeout(() => setPulse(false), 6000);
    return () => clearTimeout(t);
  }, []);

  const send = async (text?: string) => {
    const content = (text ?? input).trim();
    if (!content || loading) return;

    const userMsg: Message = { id: uuid(), role: "user", content };
    const thinkingMsg: Message = { id: uuid(), role: "assistant", content: "…" };

    setMessages(m => [...m, userMsg, thinkingMsg]);
    setInput("");
    setShowSuggestions(false);
    setLoading(true);

    const history = [...messages, userMsg]
      .filter(m => m.id !== "welcome")
      .map(m => ({ role: m.role, content: m.content }));

    try {
      const res = await fetch(`${API}/api/public/landing-chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: history }),
      });
      const data = await res.json();
      const reply = data.content || data.error || "Ha ocurrido un error. Inténtalo de nuevo.";
      setMessages(m => m.map(msg => msg.id === thinkingMsg.id ? { ...msg, content: reply } : msg));
    } catch {
      setMessages(m => m.map(msg => msg.id === thinkingMsg.id ? { ...msg, content: "Error de conexión. Inténtalo de nuevo." } : msg));
    } finally {
      setLoading(false);
    }
  };

  const handleKey = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); }
  };

  const panelStyle: React.CSSProperties = {
    position: "fixed",
    bottom: 96,
    right: 24,
    width: 360,
    maxWidth: "calc(100vw - 48px)",
    maxHeight: "min(560px, calc(100vh - 140px))",
    display: "flex",
    flexDirection: "column",
    background: "linear-gradient(160deg, #111010 0%, #0d0d0d 100%)",
    border: "1px solid rgba(200,168,75,0.25)",
    borderRadius: 20,
    boxShadow: "0 24px 80px rgba(0,0,0,0.7), 0 0 0 1px rgba(200,168,75,0.08), 0 0 40px rgba(200,168,75,0.06)",
    overflow: "hidden",
    zIndex: 9998,
    transform: open ? "scale(1) translateY(0)" : "scale(0.9) translateY(16px)",
    opacity: open ? 1 : 0,
    pointerEvents: open ? "auto" : "none",
    transition: "transform 0.25s cubic-bezier(0.34,1.56,0.64,1), opacity 0.2s ease",
    transformOrigin: "bottom right",
  };

  return (
    <>
      <div style={panelStyle}>
        <div style={{
          padding: "14px 16px 12px",
          background: "linear-gradient(135deg, rgba(200,168,75,0.12) 0%, rgba(200,168,75,0.04) 100%)",
          borderBottom: "1px solid rgba(200,168,75,0.15)",
          display: "flex",
          alignItems: "center",
          gap: 10,
          flexShrink: 0,
        }}>
          <div style={{
            width: 36, height: 36, borderRadius: "50%",
            background: "linear-gradient(135deg, #c8a84b, #8b6f35)",
            display: "flex", alignItems: "center", justifyContent: "center",
            flexShrink: 0, boxShadow: "0 2px 12px rgba(200,168,75,0.35)",
          }}>
            <Sparkles size={16} color="#fff" />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: "#f0e8cc", letterSpacing: "0.01em" }}>Asesor Shopy Crafter</div>
            <div style={{ display: "flex", alignItems: "center", gap: 5, marginTop: 1 }}>
              <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#2dd49f", flexShrink: 0, boxShadow: "0 0 6px rgba(45,212,159,0.6)" }} />
              <span style={{ fontSize: 10, color: "rgba(240,232,204,0.6)" }}>Disponible ahora · responde al instante</span>
            </div>
          </div>
          <button onClick={() => setOpen(false)} style={{
            width: 28, height: 28, borderRadius: "50%", border: "none",
            background: "rgba(255,255,255,0.06)", cursor: "pointer",
            display: "flex", alignItems: "center", justifyContent: "center",
            color: "rgba(240,232,204,0.5)", transition: "all 0.15s",
          }}
            onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = "rgba(255,255,255,0.12)"; (e.currentTarget as HTMLButtonElement).style.color = "#f0e8cc"; }}
            onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = "rgba(255,255,255,0.06)"; (e.currentTarget as HTMLButtonElement).style.color = "rgba(240,232,204,0.5)"; }}
          >
            <ChevronDown size={14} />
          </button>
        </div>

        <div style={{
          flex: 1,
          overflowY: "auto",
          padding: "14px 14px 6px",
          display: "flex",
          flexDirection: "column",
          gap: 10,
          scrollbarWidth: "thin",
          scrollbarColor: "rgba(200,168,75,0.2) transparent",
        }}>
          {messages.map(msg => (
            <div key={msg.id} style={{
              display: "flex",
              justifyContent: msg.role === "user" ? "flex-end" : "flex-start",
              gap: 8,
              alignItems: "flex-end",
            }}>
              {msg.role === "assistant" && (
                <div style={{
                  width: 24, height: 24, borderRadius: "50%", flexShrink: 0,
                  background: "linear-gradient(135deg, #c8a84b, #8b6f35)",
                  display: "flex", alignItems: "center", justifyContent: "center",
                }}>
                  <Sparkles size={11} color="#fff" />
                </div>
              )}
              <div style={{
                maxWidth: "80%",
                padding: msg.content === "…" ? "12px 16px" : "10px 14px",
                borderRadius: msg.role === "user" ? "16px 16px 4px 16px" : "4px 16px 16px 16px",
                background: msg.role === "user"
                  ? "linear-gradient(135deg, #c8a84b, #a07830)"
                  : "rgba(255,255,255,0.06)",
                border: msg.role === "user"
                  ? "none"
                  : "1px solid rgba(255,255,255,0.08)",
                color: msg.role === "user" ? "#fff" : "rgba(240,232,204,0.9)",
                fontSize: 13,
                lineHeight: 1.55,
                wordBreak: "break-word",
              }}>
                {msg.content === "…" ? (
                  <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
                    {[0, 1, 2].map(i => (
                      <span key={i} style={{
                        width: 6, height: 6, borderRadius: "50%",
                        background: "rgba(200,168,75,0.5)",
                        animation: "bounce 1.2s infinite",
                        animationDelay: `${i * 0.2}s`,
                      }} />
                    ))}
                  </div>
                ) : formatText(msg.content)}
              </div>
            </div>
          ))}

          {showSuggestions && (
            <div style={{ paddingTop: 4 }}>
              <div style={{ fontSize: 10, color: "rgba(240,232,204,0.35)", marginBottom: 8, textAlign: "center", textTransform: "uppercase", letterSpacing: "0.08em" }}>Preguntas frecuentes</div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                {SUGGESTIONS.map((s, i) => (
                  <button key={i} onClick={() => send(s.text)} style={{
                    padding: "6px 11px",
                    borderRadius: 20,
                    border: "1px solid rgba(200,168,75,0.2)",
                    background: "rgba(200,168,75,0.06)",
                    color: "rgba(240,232,204,0.75)",
                    fontSize: 11,
                    cursor: "pointer",
                    transition: "all 0.15s",
                    display: "flex", alignItems: "center", gap: 5,
                    whiteSpace: "nowrap",
                  }}
                    onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = "rgba(200,168,75,0.14)"; (e.currentTarget as HTMLButtonElement).style.borderColor = "rgba(200,168,75,0.4)"; (e.currentTarget as HTMLButtonElement).style.color = "#f0e8cc"; }}
                    onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = "rgba(200,168,75,0.06)"; (e.currentTarget as HTMLButtonElement).style.borderColor = "rgba(200,168,75,0.2)"; (e.currentTarget as HTMLButtonElement).style.color = "rgba(240,232,204,0.75)"; }}
                  >
                    <span>{s.icon}</span> {s.text}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div ref={endRef} />
        </div>

        <div style={{
          padding: "10px 12px 12px",
          borderTop: "1px solid rgba(200,168,75,0.1)",
          background: "rgba(0,0,0,0.3)",
          flexShrink: 0,
        }}>
          <div style={{
            display: "flex",
            gap: 8,
            alignItems: "flex-end",
            background: "rgba(255,255,255,0.05)",
            border: "1px solid rgba(200,168,75,0.15)",
            borderRadius: 14,
            padding: "8px 10px 8px 14px",
            transition: "border-color 0.2s",
          }}>
            <textarea
              ref={inputRef}
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={handleKey}
              placeholder="Escribe tu pregunta..."
              rows={1}
              style={{
                flex: 1,
                background: "none",
                border: "none",
                outline: "none",
                color: "rgba(240,232,204,0.9)",
                fontSize: 13,
                lineHeight: 1.5,
                resize: "none",
                fontFamily: "inherit",
                maxHeight: 100,
                overflowY: "auto",
              }}
            />
            <button
              onClick={() => send()}
              disabled={loading || !input.trim()}
              style={{
                width: 32, height: 32, borderRadius: 10, border: "none", flexShrink: 0,
                background: input.trim() && !loading
                  ? "linear-gradient(135deg, #c8a84b, #a07830)"
                  : "rgba(255,255,255,0.08)",
                cursor: input.trim() && !loading ? "pointer" : "default",
                display: "flex", alignItems: "center", justifyContent: "center",
                transition: "all 0.2s",
                boxShadow: input.trim() && !loading ? "0 2px 12px rgba(200,168,75,0.35)" : "none",
              }}
            >
              {loading
                ? <Loader2 size={14} color="rgba(240,232,204,0.5)" style={{ animation: "spin 1s linear infinite" }} />
                : <Send size={14} color={input.trim() ? "#fff" : "rgba(240,232,204,0.3)"} />
              }
            </button>
          </div>
          <div style={{ display: "flex", gap: 8, marginTop: 10, justifyContent: "center" }}>
            <a
              href="#fp-pricing"
              onClick={() => setOpen(false)}
              style={{
                flex: 1, textAlign: "center", padding: "8px 0",
                borderRadius: 10, border: "1px solid rgba(200,168,75,0.3)",
                background: "rgba(200,168,75,0.08)",
                color: "#c8a84b", fontSize: 11, fontWeight: 600,
                textDecoration: "none", transition: "all 0.15s",
              }}
              onMouseEnter={e => { (e.currentTarget as HTMLAnchorElement).style.background = "rgba(200,168,75,0.16)"; }}
              onMouseLeave={e => { (e.currentTarget as HTMLAnchorElement).style.background = "rgba(200,168,75,0.08)"; }}
            >
              💰 Ver precios
            </a>
            <a
              href="/contacto"
              style={{
                flex: 1, textAlign: "center", padding: "8px 0",
                borderRadius: 10, border: "none",
                background: "linear-gradient(135deg, #c8a84b, #a07830)",
                color: "#fff", fontSize: 11, fontWeight: 700,
                textDecoration: "none", transition: "all 0.15s",
                boxShadow: "0 2px 12px rgba(200,168,75,0.3)",
              }}
              onMouseEnter={e => { (e.currentTarget as HTMLAnchorElement).style.opacity = "0.9"; }}
              onMouseLeave={e => { (e.currentTarget as HTMLAnchorElement).style.opacity = "1"; }}
            >
              🚀 Empezar gratis
            </a>
          </div>
        </div>
      </div>

      <button
        onClick={() => setOpen(o => !o)}
        style={{
          position: "fixed",
          bottom: 24,
          right: 24,
          width: 56,
          height: 56,
          borderRadius: "50%",
          border: "none",
          background: open
            ? "linear-gradient(135deg, #1a1a1a, #111)"
            : "linear-gradient(135deg, #c8a84b, #a07830)",
          cursor: "pointer",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          boxShadow: open
            ? "0 4px 20px rgba(0,0,0,0.5), 0 0 0 1px rgba(200,168,75,0.3)"
            : "0 4px 20px rgba(200,168,75,0.4), 0 2px 8px rgba(0,0,0,0.3)",
          zIndex: 9999,
          transition: "all 0.3s cubic-bezier(0.34,1.56,0.64,1)",
          transform: open ? "rotate(0deg) scale(1)" : "rotate(0deg) scale(1)",
        }}
        onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.transform = "scale(1.1)"; }}
        onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.transform = "scale(1)"; }}
        aria-label={open ? "Cerrar asistente" : "Abrir asistente de ventas"}
      >
        {open
          ? <X size={22} color="rgba(200,168,75,0.9)" />
          : <MessageCircle size={22} color="#fff" />
        }
        {!open && pulse && (
          <span style={{
            position: "absolute",
            top: -2, right: -2,
            width: 14, height: 14,
            borderRadius: "50%",
            background: "#2dd49f",
            border: "2px solid #0d0d0d",
            animation: "pulse-dot 2s infinite",
          }} />
        )}
        {!open && (
          <>
            <span style={{
              position: "absolute",
              width: "100%", height: "100%",
              borderRadius: "50%",
              border: "2px solid rgba(200,168,75,0.4)",
              animation: "ping-ring 2s cubic-bezier(0,0,0.2,1) infinite",
            }} />
            <span style={{
              position: "absolute",
              width: "100%", height: "100%",
              borderRadius: "50%",
              border: "2px solid rgba(200,168,75,0.2)",
              animation: "ping-ring 2s cubic-bezier(0,0,0.2,1) infinite",
              animationDelay: "0.5s",
            }} />
          </>
        )}
      </button>

      <style>{`
        @keyframes bounce {
          0%, 80%, 100% { transform: translateY(0); opacity: 0.5; }
          40% { transform: translateY(-5px); opacity: 1; }
        }
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        @keyframes ping-ring {
          0% { transform: scale(1); opacity: 0.6; }
          100% { transform: scale(1.8); opacity: 0; }
        }
        @keyframes pulse-dot {
          0%, 100% { transform: scale(1); opacity: 1; }
          50% { transform: scale(1.3); opacity: 0.7; }
        }
      `}</style>
    </>
  );
}
