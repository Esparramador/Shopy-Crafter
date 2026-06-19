import { useState, useRef, useEffect } from "react";

const API = import.meta.env.BASE_URL.replace(/\/$/, "") + "/api";

interface ChatMsg { role: "user" | "assistant"; content: string; }

const SUGGESTIONS = [
  "¿Cuántos productos tengo optimizados?",
  "¿Cuál es mi score SEO actual?",
  "¿Qué trabajos realizó mi agencia?",
  "¿Cómo puedo mejorar mis ventas?",
  "¿Cuándo fue la última optimización?",
];

export function ClientChatbot() {
  const [open, setOpen] = useState(false);
  const [msgs, setMsgs] = useState<ChatMsg[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [showDot, setShowDot] = useState(true);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open && msgs.length === 0) {
      setMsgs([{ role: "assistant", content: "¡Hola! Soy tu asistente IA de Shopy Crafter. Puedo responderte sobre el estado de tu tienda, las optimizaciones en curso, tu catálogo, scores SEO, y todo lo que necesites saber. ¿En qué te ayudo hoy?" }]);
      setShowDot(false);
    }
  }, [open]);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, [msgs, loading]);
  useEffect(() => { if (open) setTimeout(() => inputRef.current?.focus(), 120); }, [open]);

  const abortRef = useRef<AbortController | null>(null);

  const send = async (text: string) => {
    const t = text.trim();
    if (!t || loading) return;
    setMsgs(m => [...m, { role: "user", content: t }]);
    setInput("");
    setLoading(true);

    if (abortRef.current) abortRef.current.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    const timer = setTimeout(() => ctrl.abort(), 20000);

    try {
      const res = await fetch(`${API}/client/ai-chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        signal: ctrl.signal,
        body: JSON.stringify({ message: t, history: msgs.slice(-8) }),
      });
      const d = await res.json();
      if (!res.ok) {
        setMsgs(m => [...m, { role: "assistant", content: d.error ?? `Error ${res.status}. Por favor inténtalo de nuevo.` }]);
      } else {
        setMsgs(m => [...m, { role: "assistant", content: d.reply ?? "No pude procesar tu consulta en este momento." }]);
      }
    } catch (e: any) {
      const isAbort = e?.name === "AbortError";
      setMsgs(m => [...m, { role: "assistant", content: isAbort ? "La consulta tardó demasiado. Por favor inténtalo de nuevo." : "No pude conectar. Por favor inténtalo de nuevo." }]);
    } finally {
      clearTimeout(timer);
      abortRef.current = null;
      setLoading(false);
    }
  };

  return (
    <>
      <style>{`
        @keyframes cb-bounce { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-4px)} }
        @keyframes cb-up { from{opacity:0;transform:translateY(18px) scale(0.95)} to{opacity:1;transform:translateY(0) scale(1)} }
        @keyframes cb-dot { 0%,60%,100%{transform:translateY(0);opacity:0.5} 30%{transform:translateY(-5px);opacity:1} }
        @keyframes cb-ring { 0%{transform:scale(1);opacity:0.7} 100%{transform:scale(1.9);opacity:0} }
        .cb-fab { animation: cb-bounce 3s ease infinite; transition: transform 0.15s, box-shadow 0.15s !important; }
        .cb-fab:hover { animation: none !important; transform: scale(1.1) !important; box-shadow: 0 12px 40px rgba(201,169,97,0.5) !important; }
        .cb-panel { animation: cb-up 0.25s cubic-bezier(0.34,1.56,0.64,1); }
        .cb-chip:hover { background: rgba(201,169,97,0.14) !important; color: var(--gold) !important; border-color: rgba(201,169,97,0.35) !important; }
        .cb-send:hover:not(:disabled) { background: linear-gradient(135deg,#d4a830,#8b6914) !important; }
      `}</style>

      {/* FAB button */}
      {!open && (
        <div style={{ position: "fixed", bottom: 24, right: 24, zIndex: 9999 }}>
          <button className="cb-fab" onClick={() => setOpen(true)} title="Asistente IA" style={{
            width: 56, height: 56, borderRadius: "50%",
            background: "linear-gradient(135deg, #c9a961 0%, #8b6914 100%)",
            border: "2px solid rgba(201,169,97,0.35)",
            cursor: "pointer", fontSize: 24,
            display: "flex", alignItems: "center", justifyContent: "center",
            boxShadow: "0 8px 30px rgba(201,169,97,0.4)",
            color: "#0a0a0f",
          }}>
            🤖
            {showDot && (
              <span style={{ position: "absolute", top: 6, right: 6, width: 10, height: 10, borderRadius: "50%", background: "var(--jade)", border: "2px solid #0a0a14" }} />
            )}
          </button>
          <div style={{ position: "absolute", inset: -8, borderRadius: "50%", border: "1.5px solid rgba(201,169,97,0.3)", animation: "cb-ring 2s ease infinite", pointerEvents: "none" }} />
        </div>
      )}

      {/* Chat panel */}
      {open && (
        <div className="cb-panel" style={{
          position: "fixed", bottom: 20, right: 20, zIndex: 9999,
          width: 340, height: 500,
          borderRadius: 20,
          background: "linear-gradient(160deg, #0d0d1a 0%, #111120 100%)",
          border: "1px solid rgba(201,169,97,0.18)",
          boxShadow: "0 24px 80px rgba(0,0,0,0.7), 0 0 0 1px rgba(255,255,255,0.04)",
          display: "flex", flexDirection: "column", overflow: "hidden",
        }}>
          {/* Header */}
          <div style={{ padding: "13px 14px", background: "rgba(201,169,97,0.07)", borderBottom: "1px solid rgba(201,169,97,0.14)", display: "flex", alignItems: "center", gap: 10, flexShrink: 0 }}>
            <div style={{ width: 36, height: 36, borderRadius: 11, background: "linear-gradient(135deg,rgba(201,169,97,0.22),rgba(201,169,97,0.08))", border: "1px solid rgba(201,169,97,0.2)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, flexShrink: 0 }}>
              🤖
            </div>
            <div style={{ flex: 1 }}>
              <p style={{ fontSize: 13, fontWeight: 700, color: "var(--t1)", margin: 0 }}>Asistente IA</p>
              <div style={{ display: "flex", alignItems: "center", gap: 4, marginTop: 1 }}>
                <div style={{ width: 5, height: 5, borderRadius: "50%", background: "var(--jade)" }} />
                <p style={{ fontSize: 10, color: "var(--jade)", margin: 0, fontWeight: 600 }}>En línea · Shopy Crafter AI</p>
              </div>
            </div>
            <button onClick={() => setOpen(false)} style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)", color: "var(--t3)", cursor: "pointer", fontSize: 13, padding: "4px 8px", borderRadius: 8, transition: "all 0.12s" }}
              onMouseEnter={e => { e.currentTarget.style.background = "rgba(255,255,255,0.1)"; e.currentTarget.style.color = "var(--t1)"; }}
              onMouseLeave={e => { e.currentTarget.style.background = "rgba(255,255,255,0.04)"; e.currentTarget.style.color = "var(--t3)"; }}
            >✕</button>
          </div>

          {/* Messages */}
          <div style={{ flex: 1, overflowY: "auto", padding: "12px 12px 4px", display: "flex", flexDirection: "column", gap: 8 }}>
            {msgs.map((m, i) => (
              <div key={i} style={{ display: "flex", justifyContent: m.role === "user" ? "flex-end" : "flex-start" }}>
                {m.role === "assistant" && (
                  <div style={{ width: 22, height: 22, borderRadius: 7, background: "rgba(201,169,97,0.12)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, flexShrink: 0, marginRight: 6, alignSelf: "flex-end", marginBottom: 2 }}>🤖</div>
                )}
                <div style={{
                  maxWidth: "78%", padding: "9px 12px", lineHeight: 1.55,
                  borderRadius: m.role === "user" ? "13px 13px 3px 13px" : "13px 13px 13px 3px",
                  background: m.role === "user"
                    ? "linear-gradient(135deg, rgba(201,169,97,0.22) 0%, rgba(139,105,20,0.18) 100%)"
                    : "rgba(255,255,255,0.05)",
                  border: m.role === "user" ? "1px solid rgba(201,169,97,0.2)" : "1px solid rgba(255,255,255,0.07)",
                  fontSize: 12.5, color: "var(--t1)",
                }}>
                  {m.content}
                </div>
              </div>
            ))}
            {loading && (
              <div style={{ display: "flex", justifyContent: "flex-start", alignItems: "center", gap: 6 }}>
                <div style={{ width: 22, height: 22, borderRadius: 7, background: "rgba(201,169,97,0.12)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, flexShrink: 0 }}>🤖</div>
                <div style={{ padding: "10px 14px", borderRadius: "13px 13px 13px 3px", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.07)", display: "flex", gap: 4 }}>
                  {[0,1,2].map(i => <div key={i} style={{ width: 5, height: 5, borderRadius: "50%", background: "var(--gold)", animation: `cb-dot 1.2s ${i*0.16}s ease infinite` }} />)}
                </div>
              </div>
            )}
            <div ref={bottomRef} />
          </div>

          {/* Suggestion chips */}
          {msgs.length <= 1 && (
            <div style={{ padding: "6px 12px 4px", display: "flex", flexWrap: "wrap", gap: 5, flexShrink: 0 }}>
              {SUGGESTIONS.map(s => (
                <button key={s} className="cb-chip" onClick={() => send(s)} style={{ padding: "4px 9px", borderRadius: 100, border: "1px solid rgba(255,255,255,0.09)", background: "transparent", color: "var(--t3)", fontSize: 10.5, cursor: "pointer", transition: "all 0.12s" }}>
                  {s}
                </button>
              ))}
            </div>
          )}

          {/* Input */}
          <div style={{ padding: "8px 10px 10px", borderTop: "1px solid rgba(255,255,255,0.06)", display: "flex", gap: 7, flexShrink: 0 }}>
            <input ref={inputRef} value={input} onChange={e => setInput(e.target.value)} onKeyDown={e => e.key === "Enter" && void send(input)}
              placeholder="Pregunta sobre tu tienda…" disabled={loading}
              style={{ flex: 1, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.09)", borderRadius: 11, padding: "9px 12px", fontSize: 12.5, color: "var(--t1)", outline: "none", transition: "border-color 0.15s" }}
              onFocus={e => e.target.style.borderColor = "rgba(201,169,97,0.45)"}
              onBlur={e => e.target.style.borderColor = "rgba(255,255,255,0.09)"}
            />
            <button className="cb-send" onClick={() => send(input)} disabled={loading || !input.trim()} style={{ width: 38, height: 38, borderRadius: 11, background: input.trim() ? "linear-gradient(135deg,#c9a961,#8b6914)" : "rgba(255,255,255,0.04)", border: "none", cursor: input.trim() ? "pointer" : "not-allowed", color: input.trim() ? "#0a0a0f" : "var(--t3)", fontSize: 16, fontWeight: 700, flexShrink: 0, transition: "all 0.15s" }}>
              {loading ? "…" : "↑"}
            </button>
          </div>
        </div>
      )}
    </>
  );
}
