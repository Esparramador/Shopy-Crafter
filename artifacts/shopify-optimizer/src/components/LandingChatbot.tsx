import { useState, useRef, useEffect } from "react";
import { MessageCircle, X, Send, Loader2, Sparkles, ChevronDown, Phone, PhoneOff } from "lucide-react";

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
  const [voiceOpen, setVoiceOpen] = useState(false);
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
    const botId = uuid();
    const botMsg: Message = { id: botId, role: "assistant", content: "" };

    setMessages(m => [...m, userMsg, botMsg]);
    setInput("");
    setShowSuggestions(false);
    setLoading(true);

    const history = [...messages, userMsg]
      .filter(m => m.id !== "welcome")
      .map(m => ({ role: m.role, content: m.content }));

    try {
      const res = await fetch(`${API}/api/public/landing-chat/stream`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: history }),
      });

      if (!res.ok || !res.body) throw new Error("stream_failed");

      const reader = res.body.getReader();
      const dec = new TextDecoder();
      let buf = "";
      let acc = "";
      let streamErrored = false;

      outer: while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += dec.decode(value, { stream: true });
        const parts = buf.split("\n\n");
        buf = parts.pop() ?? "";
        for (const part of parts) {
          if (!part.startsWith("data: ")) continue;
          try {
            const d = JSON.parse(part.slice(6));
            if (d.error) { streamErrored = true; break outer; }
            if (d.text) {
              acc += d.text;
              setMessages(m => m.map(msg => msg.id === botId ? { ...msg, content: acc } : msg));
            }
            if (d.done) break outer;
          } catch {}
        }
      }

      if (streamErrored && !acc) {
        // No partial content was shown yet — retry via the non-streaming endpoint
        // (which has its own Claude fallback), instead of leaving a blank bubble.
        throw new Error("stream_error");
      }

      if (!acc) {
        setMessages(m => m.map(msg => msg.id === botId ? { ...msg, content: "No pude generar una respuesta. Inténtalo de nuevo." } : msg));
      }
    } catch {
      // Fallback: try JSON endpoint
      try {
        const history2 = [...messages, userMsg].filter(m => m.id !== "welcome").map(m => ({ role: m.role, content: m.content }));
        const r2 = await fetch(`${API}/api/public/landing-chat`, {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ messages: history2 }),
        });
        const data = await r2.json();
        const reply = data.content || data.error || "Error de conexión. Inténtalo de nuevo.";
        setMessages(m => m.map(msg => msg.id === botId ? { ...msg, content: reply } : msg));
      } catch {
        setMessages(m => m.map(msg => msg.id === botId ? { ...msg, content: "Error de conexión. Inténtalo de nuevo." } : msg));
      }
    } finally {
      setLoading(false);
    }
  };

  const handleKey = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); }
  };

  const panelStyle: React.CSSProperties = {
    position: "fixed",
    bottom: "max(88px, env(safe-area-inset-bottom, 0px) + 88px)",
    right: "max(12px, env(safe-area-inset-right, 0px) + 12px)",
    width: 360,
    maxWidth: "calc(100vw - 24px)",
    maxHeight: "min(560px, calc(100dvh - 112px))",
    minHeight: 0,
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
      <div
        style={panelStyle}
        className="lc-panel"
        role="dialog"
        aria-modal="true"
        aria-hidden={!open}
        aria-label="Asesor virtual Shopy Crafter"
      >
        <div style={{
          padding: "14px 16px 12px",
          background: "linear-gradient(135deg, rgba(200,168,75,0.12) 0%, rgba(200,168,75,0.04) 100%)",
          borderBottom: "1px solid rgba(200,168,75,0.15)",
          display: "flex",
          alignItems: "center",
          gap: 10,
          flexShrink: 0,
        }}>
          <div aria-hidden="true" style={{
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
              <span aria-hidden="true" style={{ width: 6, height: 6, borderRadius: "50%", background: "#2dd49f", flexShrink: 0, boxShadow: "0 0 6px rgba(45,212,159,0.6)" }} />
              <span style={{ fontSize: 10, color: "rgba(240,232,204,0.6)" }}>Disponible ahora · responde al instante</span>
            </div>
          </div>
          <button onClick={() => setVoiceOpen(true)} aria-label="Llamada con IA" title="Hablar con el asistente de voz" style={{
            width: 28, height: 28, borderRadius: "50%", border: "none",
            background: "rgba(45,212,159,0.12)", cursor: "pointer",
            display: "flex", alignItems: "center", justifyContent: "center",
            color: "#2dd49f", transition: "all 0.15s", flexShrink: 0,
          }}
            onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = "rgba(45,212,159,0.22)"; }}
            onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = "rgba(45,212,159,0.12)"; }}
          >
            <Phone size={12} aria-hidden="true" />
          </button>
          <button onClick={() => setOpen(false)} aria-label="Minimizar chat" style={{
            width: 28, height: 28, borderRadius: "50%", border: "none",
            background: "rgba(255,255,255,0.06)", cursor: "pointer",
            display: "flex", alignItems: "center", justifyContent: "center",
            color: "rgba(240,232,204,0.5)", transition: "all 0.15s",
          }}
            onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = "rgba(255,255,255,0.12)"; (e.currentTarget as HTMLButtonElement).style.color = "#f0e8cc"; }}
            onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = "rgba(255,255,255,0.06)"; (e.currentTarget as HTMLButtonElement).style.color = "rgba(240,232,204,0.5)"; }}
          >
            <ChevronDown size={14} aria-hidden="true" />
          </button>
        </div>

        <div
          role="log"
          aria-live="polite"
          aria-relevant="additions text"
          className="lc-scroll"
          style={{
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
                <div aria-hidden="true" style={{
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
              aria-label="Escribe tu pregunta para el asesor virtual"
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
              📩 Contactar
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

      {voiceOpen && <LandingVoiceModal onClose={() => setVoiceOpen(false)} />}

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

        /* Foldables unfolded in landscape (e.g. Z Fold 7 ~ 1812x2176 CSS px
           reported as a short, very wide viewport) and other short-height
           screens: the header/tab chrome eats vertical space, so shrink
           margins and let the panel use as much height as is actually
           available instead of clipping. */
        @media (max-height: 500px) {
          .lc-panel {
            bottom: 8px !important;
            top: 8px !important;
            max-height: calc(100dvh - 16px) !important;
          }
        }
        @media (max-width: 420px) {
          .lc-panel {
            right: 8px !important;
            width: calc(100vw - 16px) !important;
          }
        }
        .lc-scroll::-webkit-scrollbar { width: 6px; }
        .lc-scroll::-webkit-scrollbar-thumb { background: rgba(200,168,75,0.2); border-radius: 3px; }
      `}</style>
    </>
  );
}

// ── Voice call modal for landing page (public, no auth required) ──────────────
function LandingVoiceModal({ onClose }: { onClose: () => void }) {
  const [status, setStatus] = useState<"idle" | "provisioning" | "connecting" | "connected" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState("");
  const [transcript, setTranscript] = useState<Array<{ role: "user" | "agent"; text: string }>>([]);
  const wsRef = useRef<WebSocket | null>(null);
  const mediaRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const queueRef = useRef<AudioBuffer[]>([]);
  const playingRef = useRef(false);
  const endingRef = useRef(false);

  const safeCloseCtx = () => {
    const ctx = audioCtxRef.current;
    if (ctx && ctx.state !== "closed") ctx.close().catch(() => {});
    audioCtxRef.current = null;
  };

  const playNext = async () => {
    const ctx = audioCtxRef.current;
    if (playingRef.current || queueRef.current.length === 0 || !ctx || ctx.state === "closed") return;
    playingRef.current = true;
    const buf = queueRef.current.shift()!;
    try {
      const src = ctx.createBufferSource();
      src.buffer = buf;
      src.connect(ctx.destination);
      src.onended = () => { playingRef.current = false; playNext(); };
      src.start();
    } catch { playingRef.current = false; }
  };

  const startCall = async () => {
    endingRef.current = false;
    setStatus("provisioning"); setErrorMsg("");
    try {
      const r = await fetch(`${API}/api/voice/public-call-url`);
      if (!r.ok) { const e = await r.json().catch(() => ({})) as any; throw new Error(e.error ?? "Error iniciando llamada"); }
      const { signed_url } = await r.json() as { signed_url: string };
      setStatus("connecting");
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      if (audioCtxRef.current && audioCtxRef.current.state !== "closed") safeCloseCtx();
      const ctx = new AudioContext();
      audioCtxRef.current = ctx;
      if (ctx.state === "suspended") await ctx.resume();
      const ws = new WebSocket(signed_url);
      wsRef.current = ws;
      ws.onopen = () => {
        setStatus("connected");
        ws.send(JSON.stringify({
          type: "conversation_initiation_client_data",
          conversation_config_override: {
            tts: { output_format: "mp3_44100_128" },
          },
        }));
        const rec = new MediaRecorder(stream, { mimeType: "audio/webm;codecs=opus" });
        mediaRef.current = rec;
        rec.ondataavailable = (e) => {
          if (ws.readyState === WebSocket.OPEN && e.data.size > 0) {
            const reader = new FileReader();
            reader.onload = () => { const b64 = (reader.result as string).split(",")[1]; if (b64) ws.send(JSON.stringify({ user_audio_chunk: b64 })); };
            reader.readAsDataURL(e.data);
          }
        };
        rec.start(250);
      };
      ws.onmessage = async (evt) => {
        try {
          const msg = JSON.parse(evt.data) as Record<string, any>;
          // ElevenLabs requires ping/pong to keep session alive
          if (msg.type === "ping") {
            ws.send(JSON.stringify({ type: "pong", event_id: msg.ping_event?.event_id }));
            return;
          }
          if (msg.type === "audio" && msg.audio_event?.audio_base_64) {
            const currentCtx = audioCtxRef.current;
            if (!currentCtx || currentCtx.state === "closed") return;
            const raw = atob(msg.audio_event.audio_base_64);
            const bytes = new Uint8Array(raw.length).map((_, i) => raw.charCodeAt(i));
            try {
              const decoded = await currentCtx.decodeAudioData(bytes.buffer.slice(0));
              if (audioCtxRef.current === currentCtx && currentCtx.state !== "closed") {
                queueRef.current.push(decoded);
                playNext();
              }
            } catch { /* skip bad chunk */ }
          } else if (msg.type === "transcript" || msg.type === "user_transcript") {
            const text = msg.transcript ?? msg.user_transcript ?? "";
            if (text) setTranscript(p => [...p, { role: "user", text }]);
          } else if (msg.type === "agent_response") {
            const text = msg.agent_response ?? "";
            if (text) setTranscript(p => [...p, { role: "agent", text }]);
          }
        } catch { /* ignore */ }
      };
      ws.onerror = () => { if (!endingRef.current) { setStatus("error"); setErrorMsg("Error de conexión WebSocket"); } };
      ws.onclose = () => {
        streamRef.current?.getTracks().forEach(t => t.stop());
        streamRef.current = null;
        if (!endingRef.current) setStatus("idle");
      };
    } catch (err: any) {
      setStatus("error");
      setErrorMsg(err.message ?? "Error iniciando llamada");
    }
  };

  const endCall = (opts?: { unmounting?: boolean }) => {
    if (endingRef.current) return;
    endingRef.current = true;
    const ws = wsRef.current;
    wsRef.current = null;
    if (ws && ws.readyState !== WebSocket.CLOSED && ws.readyState !== WebSocket.CLOSING) ws.close();
    if (mediaRef.current?.state !== "inactive") { try { mediaRef.current?.stop(); } catch { /* ignore */ } }
    mediaRef.current = null;
    streamRef.current?.getTracks().forEach(t => t.stop());
    streamRef.current = null;
    queueRef.current = [];
    playingRef.current = false;
    safeCloseCtx();
    if (!opts?.unmounting) setStatus("idle");
  };

  useEffect(() => { return () => endCall({ unmounting: true }); }, []);

  const isActive = status === "connected";
  const isBusy = status === "provisioning" || status === "connecting";

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 10000, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(0,0,0,0.8)", backdropFilter: "blur(8px)" }}
      onClick={e => { if (e.target === e.currentTarget) { endCall(); onClose(); } }}>
      <div style={{ background: "linear-gradient(160deg,#111010,#0d0d0d)", border: "1px solid rgba(200,168,75,0.25)", borderRadius: 24, padding: "32px 28px", width: "min(380px,92vw)", display: "flex", flexDirection: "column", alignItems: "center", gap: 18 }}>
        <div style={{ width: 80, height: 80, borderRadius: "50%", background: "linear-gradient(135deg,#c8a84b,#2dd49f)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 32, animation: (isActive || isBusy) ? "voicePulseL 1.5s ease-in-out infinite" : "none" }}>🤖</div>
        <div style={{ textAlign: "center" }}>
          <div style={{ fontSize: 16, fontWeight: 700, color: "#f0e8cc", marginBottom: 4 }}>Asesor Shopy Crafter — Voz</div>
          <div style={{ fontSize: 12, color: status === "error" ? "#e84558" : status === "connected" ? "#2dd49f" : "#c8a84b", fontWeight: 600 }}>
            {{ idle: "Listo para hablar", provisioning: "Preparando asistente...", connecting: "Conectando...", connected: "En llamada", error: errorMsg }[status]}
          </div>
        </div>
        {transcript.length > 0 && (
          <div style={{ width: "100%", maxHeight: 140, overflowY: "auto", display: "flex", flexDirection: "column", gap: 5, background: "rgba(255,255,255,0.04)", borderRadius: 10, padding: "8px 10px" }}>
            {transcript.slice(-5).map((t, i) => (
              <div key={i} style={{ display: "flex", justifyContent: t.role === "user" ? "flex-end" : "flex-start" }}>
                <div style={{ background: t.role === "user" ? "rgba(200,168,75,0.15)" : "rgba(45,212,159,0.12)", border: `1px solid ${t.role === "user" ? "rgba(200,168,75,0.3)" : "rgba(45,212,159,0.3)"}`, borderRadius: 8, padding: "4px 8px", fontSize: 11, color: "#f0e8cc", maxWidth: "85%" }}>
                  <span style={{ fontSize: 9, color: "rgba(240,232,204,0.5)", display: "block", marginBottom: 1 }}>{t.role === "user" ? "Tú" : "IA"}</span>
                  {t.text}
                </div>
              </div>
            ))}
          </div>
        )}
        <div style={{ display: "flex", gap: 10 }}>
          {status === "idle" ? (
            <button onClick={startCall} style={{ display: "flex", alignItems: "center", gap: 6, padding: "10px 24px", background: "linear-gradient(135deg,#c8a84b,#a07830)", color: "#fff", borderRadius: 30, border: "none", fontSize: 14, fontWeight: 700, cursor: "pointer" }}>
              <Phone size={16} /> Hablar con IA
            </button>
          ) : isBusy ? (
            <button disabled style={{ display: "flex", alignItems: "center", gap: 6, padding: "10px 24px", background: "rgba(255,255,255,0.08)", color: "rgba(240,232,204,0.5)", borderRadius: 30, border: "none", fontSize: 14, fontWeight: 700, cursor: "not-allowed" }}>
              <Loader2 size={16} style={{ animation: "spin 1s linear infinite" }} /> Conectando...
            </button>
          ) : status === "connected" ? (
            <button onClick={endCall} style={{ display: "flex", alignItems: "center", gap: 6, padding: "10px 24px", background: "#e84558", color: "#fff", borderRadius: 30, border: "none", fontSize: 14, fontWeight: 700, cursor: "pointer" }}>
              <PhoneOff size={16} /> Colgar
            </button>
          ) : (
            <button onClick={startCall} style={{ display: "flex", alignItems: "center", gap: 6, padding: "10px 24px", background: "linear-gradient(135deg,#c8a84b,#a07830)", color: "#fff", borderRadius: 30, border: "none", fontSize: 14, fontWeight: 700, cursor: "pointer" }}>
              Reintentar
            </button>
          )}
          <button onClick={() => { endCall(); onClose(); }} style={{ padding: "10px 16px", background: "rgba(255,255,255,0.06)", color: "rgba(240,232,204,0.6)", borderRadius: 30, border: "1px solid rgba(255,255,255,0.1)", fontSize: 13, cursor: "pointer" }}>Cerrar</button>
        </div>
        <p style={{ fontSize: 10, color: "rgba(240,232,204,0.35)", textAlign: "center", maxWidth: 280 }}>Asesor virtual disponible 24/7 · puede resolver dudas y tomar nota de tus mensajes · no genera contenido</p>
      </div>
      <style>{`@keyframes voicePulseL { 0%,100%{box-shadow:0 0 0 0 rgba(200,168,75,0.4)} 50%{box-shadow:0 0 0 12px rgba(200,168,75,0)} }`}</style>
    </div>
  );
}
