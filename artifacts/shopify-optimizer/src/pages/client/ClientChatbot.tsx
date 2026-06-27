import { useState, useRef, useEffect, useCallback } from "react";

const API = import.meta.env.BASE_URL.replace(/\/$/, "") + "/api";

interface UploadedFile {
  fileUrl: string;
  fileName: string;
  fileType: string;
  fileSize: number;
}

interface VaultFile {
  id: number;
  title: string;
  fileType: string;
  category: string;
  description: string;
  downloadUrl: string;
  createdAt: string;
}

interface ChatMsg {
  role: "user" | "assistant" | "system";
  content: string;
  files?: UploadedFile[];
  vaultFiles?: VaultFile[];
  forwarded?: boolean;
  ts?: number;
}

const FORWARD_WORDS = /\b(manda|envía|envíale|pasa|comparte|dile|mándalo|mándale|reenvía)\b.*\b(joan|shopy\s*crafter|agencia|equipo|admin|vosotros|os)/i;
const LIST_FILES_WORDS = /\b(lista|muéstrame|dame|descarga|descárgame|archivos?|fotos?|vídeos?|imágenes?|documentos?|generados?|mis archivos?|mis fotos?|mis vídeos?)\b/i;
const LIST_PRODUCTS_WORDS = /\b(lista|muéstrame|cuántos|mis productos?|catálogo|tienda|productos)\b/i;

const SUGGESTIONS = [
  "📁 Lista mis archivos generados",
  "🛍️ Muéstrame mis productos",
  "💡 Ideas para monetizar mi tienda",
  "📊 ¿Cómo está mi score SEO?",
  "🚀 ¿Qué puedo mejorar primero?",
  "📩 Quiero enviar un archivo al equipo",
];

function fileIcon(type: string): string {
  if (type.startsWith("image/")) return "🖼️";
  if (type.startsWith("video/")) return "🎬";
  if (type.startsWith("audio/")) return "🎵";
  if (type.includes("pdf")) return "📄";
  if (type.includes("zip") || type.includes("rar") || type.includes("7z")) return "🗜️";
  if (type.includes("text")) return "📝";
  if (type.includes("word") || type.includes("document")) return "📃";
  return "📎";
}

function fmtSize(bytes: number): string {
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)}MB`;
}

function fmtDate(iso: string): string {
  try { return new Date(iso).toLocaleDateString("es-ES", { day: "2-digit", month: "short" }); }
  catch { return iso; }
}

const SR_API: any = typeof window !== "undefined"
  ? ((window as any).SpeechRecognition || (window as any).webkitSpeechRecognition)
  : null;

export function ClientChatbot() {
  const [open, setOpen]             = useState(false);
  const [msgs, setMsgs]             = useState<ChatMsg[]>([]);
  const [input, setInput]           = useState("");
  const [loading, setLoading]       = useState(false);
  const [showDot, setShowDot]       = useState(true);
  const [voiceOn, setVoiceOn]       = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [attachedFiles, setAttachedFiles] = useState<UploadedFile[]>([]);
  const [uploading, setUploading]   = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [expanded, setExpanded]     = useState(false);

  const bottomRef  = useRef<HTMLDivElement>(null);
  const inputRef   = useRef<HTMLInputElement>(null);
  const fileRef    = useRef<HTMLInputElement>(null);
  const abortRef   = useRef<AbortController | null>(null);
  const srRef      = useRef<any>(null);

  const panelW = expanded ? 540 : 400;
  const panelH = expanded ? 680 : 560;

  useEffect(() => {
    if (open && msgs.length === 0) {
      setMsgs([{
        role: "assistant",
        content: "¡Hola! Soy tu asistente IA de **Shopy Crafter** 🚀\n\nPuedo ayudarte a:\n• 📁 Listar y descargar archivos generados\n• 🛍️ Revisar y analizar tus productos\n• 💡 Darte ideas para monetizar más\n• 📩 Enviar archivos/mensajes al equipo\n• 🔍 Buscar información en Internet\n• 🎙️ Responder por voz si lo activas\n\n¿En qué te ayudo hoy?",
        ts: Date.now(),
      }]);
      setShowDot(false);
    }
  }, [open]);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, [msgs, loading]);
  useEffect(() => { if (open) setTimeout(() => inputRef.current?.focus(), 120); }, [open]);

  const speak = useCallback((text: string) => {
    if (!voiceOn || !window.speechSynthesis) return;
    window.speechSynthesis.cancel();
    const plain = text.replace(/[*_`#[\]()]/g, "").replace(/https?:\/\/\S+/g, "");
    const utter = new SpeechSynthesisUtterance(plain.slice(0, 400));
    utter.lang = "es-ES";
    utter.rate = 1.05;
    utter.pitch = 1.0;
    const voices = window.speechSynthesis.getVoices();
    const esVoice = voices.find(v => v.lang.startsWith("es")) || voices[0];
    if (esVoice) utter.voice = esVoice;
    window.speechSynthesis.speak(utter);
  }, [voiceOn]);

  function toggleMic() {
    if (!SR_API) {
      alert("Tu navegador no soporta reconocimiento de voz. Prueba Chrome.");
      return;
    }
    if (isListening) {
      srRef.current?.stop();
      setIsListening(false);
      return;
    }
    const sr = new SR_API();
    srRef.current = sr;
    sr.lang = "es-ES";
    sr.interimResults = false;
    sr.maxAlternatives = 1;
    sr.onresult = (e: any) => {
      const transcript = e.results[0][0].transcript;
      setInput(prev => prev ? prev + " " + transcript : transcript);
    };
    sr.onend = () => setIsListening(false);
    sr.onerror = () => setIsListening(false);
    sr.start();
    setIsListening(true);
  }

  async function handleFileSelect(files: FileList | null) {
    if (!files || files.length === 0) return;
    setUploading(true);
    try {
      const fd = new FormData();
      Array.from(files).forEach(f => fd.append("files", f));
      const r = await fetch(`${API}/client/messages/upload-multi`, {
        method: "POST", credentials: "include", body: fd,
      });
      if (!r.ok) throw new Error("Error subiendo archivos");
      const uploaded: UploadedFile[] = await r.json();
      setAttachedFiles(prev => [...prev, ...uploaded]);
    } catch (e: any) {
      addMsg({ role: "system", content: `⚠️ Error subiendo archivos: ${e.message}`, ts: Date.now() });
    }
    setUploading(false);
  }

  function addMsg(msg: ChatMsg) {
    setMsgs(m => [...m, msg]);
  }

  async function send(text: string, forcedFiles?: UploadedFile[]) {
    const t = text.trim();
    const filesToSend = forcedFiles ?? attachedFiles;
    if ((!t && filesToSend.length === 0) || loading) return;

    const userMsg: ChatMsg = {
      role: "user",
      content: t || "(archivos adjuntos)",
      files: filesToSend.length > 0 ? [...filesToSend] : undefined,
      ts: Date.now(),
    };
    addMsg(userMsg);
    setInput("");
    setAttachedFiles([]);
    setLoading(true);

    if (abortRef.current) abortRef.current.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    const timer = setTimeout(() => ctrl.abort(), 30000);

    try {
      const isForward = FORWARD_WORDS.test(t) && filesToSend.length > 0;
      const isListFiles = LIST_FILES_WORDS.test(t) && !t.includes("producto");
      const isListProducts = LIST_PRODUCTS_WORDS.test(t) && t.includes("producto");

      if (isListFiles && !t.includes("Joan") && !isForward) {
        await handleListFiles(t);
        return;
      }

      const res = await fetch(`${API}/client/ai-chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        signal: ctrl.signal,
        body: JSON.stringify({
          message: t,
          history: msgs.filter(m => m.role !== "system").slice(-10).map(m => ({ role: m.role, content: m.content })),
          attachedFiles: filesToSend,
          forwardToAdmin: isForward,
          intentHints: {
            listFiles: isListFiles,
            listProducts: isListProducts,
            forward: isForward,
          },
        }),
      });

      const d = await res.json();
      if (!res.ok) {
        addMsg({ role: "assistant", content: d.error ?? `Error ${res.status}. Inténtalo de nuevo.`, ts: Date.now() });
        return;
      }

      const reply = d.reply ?? "No pude procesar tu consulta.";
      const botMsg: ChatMsg = {
        role: "assistant",
        content: reply,
        vaultFiles: d.vaultFiles,
        forwarded: d.forwarded,
        ts: Date.now(),
      };
      addMsg(botMsg);
      speak(reply);

      if (d.forwarded) {
        addMsg({ role: "system", content: "✅ Mensaje enviado al equipo de Shopy Crafter. Te responderán pronto.", ts: Date.now() });
      }
    } catch (e: any) {
      if (e?.name !== "AbortError") {
        addMsg({ role: "assistant", content: "No pude conectar. Inténtalo de nuevo.", ts: Date.now() });
      }
    } finally {
      clearTimeout(timer);
      abortRef.current = null;
      setLoading(false);
    }
  }

  async function handleListFiles(query: string) {
    try {
      const r = await fetch(`${API}/client/vault-files`, { credentials: "include" });
      if (!r.ok) throw new Error("No se pudieron cargar los archivos");
      const files: VaultFile[] = await r.json();

      if (files.length === 0) {
        addMsg({ role: "assistant", content: "Aún no tienes archivos generados. Cuando el equipo cree fotos, vídeos o documentos para tu tienda, aparecerán aquí para descargarlos.", ts: Date.now() });
      } else {
        addMsg({
          role: "assistant",
          content: `Tienes **${files.length} archivos** generados para tu tienda. Aquí están todos para descargarlos:`,
          vaultFiles: files,
          ts: Date.now(),
        });
      }
    } catch (e: any) {
      addMsg({ role: "assistant", content: `Error cargando archivos: ${e.message}`, ts: Date.now() });
    } finally {
      setLoading(false);
    }
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setIsDragging(false);
    handleFileSelect(e.dataTransfer.files);
  }

  function renderContent(content: string) {
    const lines = content.split("\n");
    return lines.map((line, i) => {
      const bold = line.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>").replace(/\*(.+?)\*/g, "<em>$1</em>");
      return (
        <span key={i}>
          {i > 0 && <br />}
          <span dangerouslySetInnerHTML={{ __html: bold }} />
        </span>
      );
    });
  }

  const panelStyle: React.CSSProperties = {
    position: "fixed", bottom: 20, right: 20, zIndex: 9999,
    width: panelW, height: panelH,
    borderRadius: 20,
    background: "linear-gradient(160deg, #0c0c1a 0%, #10101f 60%, #0d0d18 100%)",
    border: "1px solid rgba(201,169,97,0.2)",
    boxShadow: "0 32px 100px rgba(0,0,0,0.8), 0 0 0 1px rgba(255,255,255,0.04), 0 0 60px rgba(201,169,97,0.04)",
    display: "flex", flexDirection: "column", overflow: "hidden",
    transition: "width 0.3s ease, height 0.3s ease",
  };

  return (
    <>
      <style>{`
        @keyframes cb-bounce { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-5px)} }
        @keyframes cb-up { from{opacity:0;transform:translateY(20px) scale(0.93)} to{opacity:1;transform:translateY(0) scale(1)} }
        @keyframes cb-dot { 0%,60%,100%{transform:translateY(0);opacity:0.4} 30%{transform:translateY(-5px);opacity:1} }
        @keyframes cb-ring { 0%{transform:scale(1);opacity:0.6} 100%{transform:scale(2);opacity:0} }
        @keyframes cb-pulse { 0%,100%{box-shadow:0 0 0 0 rgba(239,68,68,0.5)} 50%{box-shadow:0 0 0 8px rgba(239,68,68,0)} }
        @keyframes cb-drag-border { 0%,100%{border-color:rgba(201,169,97,0.5)} 50%{border-color:rgba(201,169,97,1)} }
        .cb-fab { animation: cb-bounce 3.5s ease infinite; }
        .cb-fab:hover { animation:none !important; transform:scale(1.12) !important; }
        .cb-panel { animation: cb-up 0.28s cubic-bezier(0.34,1.56,0.64,1); }
        .cb-chip:hover { background:rgba(201,169,97,0.12) !important; color:var(--gold) !important; }
        .cb-file-chip:hover { background:rgba(255,255,255,0.1) !important; }
        .cb-dl:hover { background:rgba(201,169,97,0.15) !important; }
        .cb-scroll::-webkit-scrollbar { width:3px }
        .cb-scroll::-webkit-scrollbar-track { background:transparent }
        .cb-scroll::-webkit-scrollbar-thumb { background:rgba(201,169,97,0.2); border-radius:2px }
      `}</style>

      {/* FAB */}
      {!open && (
        <div style={{ position: "fixed", bottom: 24, right: 24, zIndex: 9999 }}>
          <button className="cb-fab" onClick={() => setOpen(true)} style={{
            width: 58, height: 58, borderRadius: "50%",
            background: "linear-gradient(135deg,#c9a961,#8b6914)",
            border: "2px solid rgba(201,169,97,0.4)",
            cursor: "pointer", fontSize: 26,
            display: "flex", alignItems: "center", justifyContent: "center",
            boxShadow: "0 8px 32px rgba(201,169,97,0.45)",
            color: "#0a0a0f", position: "relative",
          }}>
            🤖
            {showDot && (
              <span style={{ position: "absolute", top: 5, right: 5, width: 11, height: 11, borderRadius: "50%", background: "#10b981", border: "2px solid #0a0a14" }} />
            )}
          </button>
          <div style={{ position: "absolute", inset: -9, borderRadius: "50%", border: "1.5px solid rgba(201,169,97,0.3)", animation: "cb-ring 2.2s ease infinite", pointerEvents: "none" }} />
        </div>
      )}

      {/* Panel */}
      {open && (
        <div
          className="cb-panel"
          style={panelStyle}
          onDragOver={e => { e.preventDefault(); setIsDragging(true); }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={handleDrop}
        >
          {/* Drag overlay */}
          {isDragging && (
            <div style={{ position: "absolute", inset: 0, zIndex: 10, background: "rgba(12,12,26,0.9)", display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", gap: 10, borderRadius: 20, border: "2px dashed rgba(201,169,97,0.7)", animation: "cb-drag-border 1s infinite" }}>
              <div style={{ fontSize: 40 }}>📂</div>
              <div style={{ fontSize: 14, fontWeight: 700, color: "var(--gold)" }}>Suelta para adjuntar</div>
            </div>
          )}

          {/* Header */}
          <div style={{ padding: "12px 14px", background: "rgba(201,169,97,0.06)", borderBottom: "1px solid rgba(201,169,97,0.12)", display: "flex", alignItems: "center", gap: 10, flexShrink: 0 }}>
            <div style={{ width: 38, height: 38, borderRadius: 11, background: "linear-gradient(135deg,rgba(201,169,97,0.2),rgba(201,169,97,0.07))", border: "1px solid rgba(201,169,97,0.18)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, flexShrink: 0 }}>🤖</div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{ fontSize: 13, fontWeight: 700, color: "var(--t1,#fff)", margin: 0, lineHeight: 1.2 }}>Asistente Shopy Crafter</p>
              <div style={{ display: "flex", alignItems: "center", gap: 4, marginTop: 2 }}>
                <div style={{ width: 5, height: 5, borderRadius: "50%", background: "#10b981" }} />
                <p style={{ fontSize: 10, color: "#10b981", margin: 0, fontWeight: 600 }}>En línea · IA + ShopyBrain</p>
              </div>
            </div>
            {/* Voice toggle */}
            <button
              onClick={() => { setVoiceOn(v => !v); if (!voiceOn) window.speechSynthesis?.cancel(); }}
              title={voiceOn ? "Desactivar voz" : "Activar respuesta por voz"}
              style={{ width: 32, height: 32, borderRadius: 9, border: voiceOn ? "1px solid rgba(201,169,97,0.5)" : "1px solid rgba(255,255,255,0.08)", background: voiceOn ? "rgba(201,169,97,0.15)" : "rgba(255,255,255,0.04)", color: voiceOn ? "var(--gold,#c9a961)" : "rgba(255,255,255,0.4)", cursor: "pointer", fontSize: 14, display: "flex", alignItems: "center", justifyContent: "center", transition: "all 0.15s", flexShrink: 0 }}
            >
              {voiceOn ? "🔊" : "🔇"}
            </button>
            {/* Expand */}
            <button
              onClick={() => setExpanded(e => !e)}
              title={expanded ? "Compactar" : "Expandir"}
              style={{ width: 32, height: 32, borderRadius: 9, border: "1px solid rgba(255,255,255,0.08)", background: "rgba(255,255,255,0.04)", color: "rgba(255,255,255,0.4)", cursor: "pointer", fontSize: 12, display: "flex", alignItems: "center", justifyContent: "center", transition: "all 0.15s", flexShrink: 0 }}
            >
              {expanded ? "⊡" : "⊞"}
            </button>
            <button
              onClick={() => setOpen(false)}
              style={{ width: 32, height: 32, borderRadius: 9, border: "1px solid rgba(255,255,255,0.08)", background: "rgba(255,255,255,0.04)", color: "rgba(255,255,255,0.4)", cursor: "pointer", fontSize: 13, display: "flex", alignItems: "center", justifyContent: "center", transition: "all 0.15s", flexShrink: 0 }}
              onMouseEnter={e => { e.currentTarget.style.background = "rgba(239,68,68,0.12)"; e.currentTarget.style.color = "#f87171"; }}
              onMouseLeave={e => { e.currentTarget.style.background = "rgba(255,255,255,0.04)"; e.currentTarget.style.color = "rgba(255,255,255,0.4)"; }}
            >✕</button>
          </div>

          {/* Messages */}
          <div className="cb-scroll" style={{ flex: 1, overflowY: "auto", padding: "12px 12px 4px", display: "flex", flexDirection: "column", gap: 8 }}>
            {msgs.map((m, i) => (
              <div key={i}>
                {/* System message */}
                {m.role === "system" && (
                  <div style={{ textAlign: "center", fontSize: 11, color: "rgba(255,255,255,0.35)", padding: "4px 0", fontStyle: "italic" }}>
                    {m.content}
                  </div>
                )}

                {/* User message */}
                {m.role === "user" && (
                  <div style={{ display: "flex", justifyContent: "flex-end", flexDirection: "column", alignItems: "flex-end", gap: 4 }}>
                    {m.files && m.files.length > 0 && (
                      <div style={{ display: "flex", gap: 5, flexWrap: "wrap", justifyContent: "flex-end" }}>
                        {m.files.map((f, fi) => (
                          <div key={fi} style={{ display: "flex", alignItems: "center", gap: 5, padding: "5px 9px", borderRadius: 10, background: "rgba(201,169,97,0.12)", border: "1px solid rgba(201,169,97,0.2)", fontSize: 11, color: "rgba(255,255,255,0.75)", maxWidth: 180 }}>
                            <span>{fileIcon(f.fileType)}</span>
                            <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{f.fileName}</span>
                            <span style={{ color: "rgba(255,255,255,0.35)", flexShrink: 0 }}>{fmtSize(f.fileSize)}</span>
                          </div>
                        ))}
                      </div>
                    )}
                    {m.content && m.content !== "(archivos adjuntos)" && (
                      <div style={{ maxWidth: "82%", padding: "9px 12px", lineHeight: 1.55, borderRadius: "14px 14px 3px 14px", background: "linear-gradient(135deg,rgba(201,169,97,0.22),rgba(139,105,20,0.16))", border: "1px solid rgba(201,169,97,0.18)", fontSize: 12.5, color: "#fff" }}>
                        {renderContent(m.content)}
                      </div>
                    )}
                  </div>
                )}

                {/* Assistant message */}
                {m.role === "assistant" && (
                  <div style={{ display: "flex", gap: 7, alignItems: "flex-start" }}>
                    <div style={{ width: 24, height: 24, borderRadius: 8, background: "rgba(201,169,97,0.1)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, flexShrink: 0, marginTop: 1 }}>🤖</div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ maxWidth: "92%", padding: "9px 12px", lineHeight: 1.6, borderRadius: "14px 14px 14px 3px", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)", fontSize: 12.5, color: "#e5e5e5" }}>
                        {renderContent(m.content)}
                      </div>
                      {/* Vault files listing */}
                      {m.vaultFiles && m.vaultFiles.length > 0 && (
                        <div style={{ marginTop: 8, display: "flex", flexDirection: "column", gap: 5 }}>
                          {m.vaultFiles.map((f, fi) => (
                            <div key={fi} style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 10px", borderRadius: 10, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)" }}>
                              <span style={{ fontSize: 16, flexShrink: 0 }}>{fileIcon(f.fileType)}</span>
                              <div style={{ flex: 1, minWidth: 0 }}>
                                <div style={{ fontSize: 12, fontWeight: 600, color: "#e5e5e5", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{f.title || f.fileType}</div>
                                <div style={{ fontSize: 10, color: "rgba(255,255,255,0.35)", marginTop: 1 }}>{f.category} · {fmtDate(f.createdAt)}</div>
                              </div>
                              <a
                                href={`${API.replace("/api", "")}${f.downloadUrl}`}
                                download target="_blank" rel="noreferrer"
                                className="cb-dl"
                                style={{ padding: "4px 9px", borderRadius: 7, background: "rgba(201,169,97,0.08)", border: "1px solid rgba(201,169,97,0.25)", color: "var(--gold,#c9a961)", fontSize: 11, fontWeight: 600, textDecoration: "none", whiteSpace: "nowrap", transition: "all 0.12s" }}
                              >
                                ↓ Descargar
                              </a>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            ))}

            {/* Loading dots */}
            {loading && (
              <div style={{ display: "flex", gap: 7, alignItems: "center" }}>
                <div style={{ width: 24, height: 24, borderRadius: 8, background: "rgba(201,169,97,0.1)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, flexShrink: 0 }}>🤖</div>
                <div style={{ padding: "10px 14px", borderRadius: "14px 14px 14px 3px", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)", display: "flex", gap: 5, alignItems: "center" }}>
                  {[0,1,2].map(i => (
                    <div key={i} style={{ width: 5, height: 5, borderRadius: "50%", background: "var(--gold,#c9a961)", animation: `cb-dot 1.3s ${i*0.18}s ease infinite` }} />
                  ))}
                </div>
              </div>
            )}
            <div ref={bottomRef} />
          </div>

          {/* Suggestions */}
          {msgs.length <= 1 && !loading && (
            <div style={{ padding: "5px 10px 3px", display: "flex", flexWrap: "wrap", gap: 5, flexShrink: 0 }}>
              {SUGGESTIONS.map(s => (
                <button key={s} className="cb-chip" onClick={() => send(s)}
                  style={{ padding: "4px 9px", borderRadius: 100, border: "1px solid rgba(255,255,255,0.08)", background: "transparent", color: "rgba(255,255,255,0.45)", fontSize: 10.5, cursor: "pointer", transition: "all 0.12s" }}>
                  {s}
                </button>
              ))}
            </div>
          )}

          {/* Attached files strip */}
          {attachedFiles.length > 0 && (
            <div style={{ padding: "6px 10px 0", display: "flex", gap: 5, flexWrap: "wrap", flexShrink: 0 }}>
              {attachedFiles.map((f, i) => (
                <div key={i} className="cb-file-chip" style={{ display: "flex", alignItems: "center", gap: 5, padding: "4px 8px", borderRadius: 8, background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", fontSize: 11, color: "rgba(255,255,255,0.7)", transition: "background 0.12s", cursor: "default" }}>
                  <span>{fileIcon(f.fileType)}</span>
                  <span style={{ maxWidth: 100, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{f.fileName}</span>
                  <button
                    onClick={() => setAttachedFiles(prev => prev.filter((_, j) => j !== i))}
                    style={{ background: "none", border: "none", color: "rgba(255,255,255,0.4)", cursor: "pointer", fontSize: 11, padding: "0 0 0 2px", lineHeight: 1 }}
                  >✕</button>
                </div>
              ))}
            </div>
          )}

          {/* Input bar */}
          <div style={{ padding: "8px 10px 12px", borderTop: "1px solid rgba(255,255,255,0.06)", display: "flex", gap: 6, flexShrink: 0, alignItems: "center" }}>
            {/* File attach */}
            <input ref={fileRef} type="file" multiple accept="*/*" style={{ display: "none" }} onChange={e => handleFileSelect(e.target.files)} />
            <button
              onClick={() => fileRef.current?.click()}
              disabled={uploading}
              title="Adjuntar archivos (imagen, vídeo, audio, PDF, ZIP...)"
              style={{ width: 35, height: 35, borderRadius: 9, border: "1px solid rgba(255,255,255,0.08)", background: uploading ? "rgba(201,169,97,0.1)" : "rgba(255,255,255,0.04)", color: uploading ? "var(--gold,#c9a961)" : "rgba(255,255,255,0.45)", cursor: uploading ? "not-allowed" : "pointer", fontSize: 15, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, transition: "all 0.15s" }}
            >
              {uploading ? "⏳" : "📎"}
            </button>

            {/* Mic */}
            <button
              onClick={toggleMic}
              title={isListening ? "Parar grabación" : "Hablar"}
              style={{ width: 35, height: 35, borderRadius: 9, border: isListening ? "1px solid rgba(239,68,68,0.5)" : "1px solid rgba(255,255,255,0.08)", background: isListening ? "rgba(239,68,68,0.12)" : "rgba(255,255,255,0.04)", color: isListening ? "#ef4444" : "rgba(255,255,255,0.45)", cursor: "pointer", fontSize: 15, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, transition: "all 0.15s", animation: isListening ? "cb-pulse 1s infinite" : "none" }}
            >
              {isListening ? "🔴" : "🎤"}
            </button>

            {/* Text input */}
            <input
              ref={inputRef}
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => e.key === "Enter" && !e.shiftKey && void send(input)}
              placeholder={isListening ? "Escuchando…" : attachedFiles.length > 0 ? "Mensaje con archivos… o di «manda a Joan»" : "Pregunta, pide archivos, envía al equipo…"}
              disabled={loading || isListening}
              style={{ flex: 1, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.09)", borderRadius: 11, padding: "9px 12px", fontSize: 12.5, color: "#fff", outline: "none", transition: "border-color 0.15s" }}
              onFocus={e => e.target.style.borderColor = "rgba(201,169,97,0.45)"}
              onBlur={e => e.target.style.borderColor = "rgba(255,255,255,0.09)"}
            />

            {/* Send */}
            <button
              onClick={() => send(input)}
              disabled={loading || (!input.trim() && attachedFiles.length === 0)}
              style={{ width: 35, height: 35, borderRadius: 11, background: (input.trim() || attachedFiles.length > 0) ? "linear-gradient(135deg,#c9a961,#8b6914)" : "rgba(255,255,255,0.04)", border: "none", cursor: (input.trim() || attachedFiles.length > 0) ? "pointer" : "not-allowed", color: (input.trim() || attachedFiles.length > 0) ? "#0a0a0f" : "rgba(255,255,255,0.25)", fontSize: 16, fontWeight: 700, flexShrink: 0, transition: "all 0.15s", display: "flex", alignItems: "center", justifyContent: "center" }}
            >
              {loading ? "…" : "↑"}
            </button>
          </div>
        </div>
      )}
    </>
  );
}
