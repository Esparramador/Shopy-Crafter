import { useEffect, useState, useRef } from "react";
import { ClientLayout } from "./ClientLayout";
import { useAuth } from "@/contexts/AuthContext";
import { useCmsSection } from "@/contexts/CmsContext";
import { Send, Loader2 } from "lucide-react";

const API_BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

interface Message {
  id: string;
  fromRole: "admin" | "client";
  fromName: string;
  content: string;
  isRead: number;
  createdAt: string;
}

function formatTime(dateStr: string) {
  const d = new Date(dateStr);
  return d.toLocaleString("es-ES", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
}

export default function ClientMessages() {
  const { user: _user } = useAuth();
  const { t } = useCmsSection("labels.clientMessages");
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  const load = () => {
    fetch(`${API_BASE}/api/client/messages`, { credentials: "include" })
      .then((r) => r.json())
      .then((d) => { setMessages(Array.isArray(d) ? d : []); setLoading(false); });
  };

  useEffect(() => { load(); const iv = setInterval(load, 15000); return () => clearInterval(iv); }, []);
  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);

  const send = async () => {
    if (!text.trim()) return;
    setSending(true);
    await fetch(`${API_BASE}/api/client/messages`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ content: text.trim() }),
    });
    setText("");
    setSending(false);
    load();
  };

  return (
    <ClientLayout>
      <div style={{ maxWidth: 680, display: "flex", flexDirection: "column", height: "calc(100vh - 8rem)" }}>
        <div style={{ marginBottom: 16 }}>
          <h1 style={{ fontFamily: "var(--fh)", fontStyle: "italic", fontSize: 24, fontWeight: 400, marginBottom: 4 }}>
            {t("title", "Mensajes")}
          </h1>
          <p style={{ fontSize: 12, color: "var(--t3)" }}>{t("subtitle", "Comunicación directa con tu agencia.")}</p>
        </div>

        <div style={{
          flex: 1, background: "var(--srf)", border: "1px solid var(--bdr)", borderRadius: 14,
          overflow: "hidden", display: "flex", flexDirection: "column",
        }}>
          <div style={{
            padding: "12px 16px", borderBottom: "1px solid var(--bdr)",
            display: "flex", alignItems: "center", gap: 10,
          }}>
            <div style={{
              width: 34, height: 34, borderRadius: 10,
              background: "linear-gradient(135deg,var(--gold) 0%,var(--gold2) 100%)",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 14, fontWeight: 800, color: "#0a0a14", flexShrink: 0,
            }}>
              A
            </div>
            <div>
              <p style={{ fontSize: 13, fontWeight: 700 }}>{t("agencyName", "Tu Agencia")}</p>
              <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                <div className="status-pulse" style={{ width: 5, height: 5, background: "var(--jade)", flexShrink: 0 }} />
                <p style={{ fontSize: 11, color: "var(--t3)" }}>{t("agencyStatus", "En línea · Respuesta en <24h")}</p>
              </div>
            </div>
          </div>

          <div style={{ flex: 1, overflowY: "auto", padding: "16px 16px 8px" }}>
            {loading ? (
              <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: 120 }}>
                <Loader2 size={22} style={{ color: "var(--gold)", animation: "spin 0.6s linear infinite" }} />
              </div>
            ) : messages.length === 0 ? (
              <div style={{ textAlign: "center", padding: "40px 0" }}>
                <p style={{ fontSize: 28, marginBottom: 10 }}>💬</p>
                <p style={{ fontSize: 13, color: "var(--t3)" }}>{t("emptyTitle", "No hay mensajes aún. ¡Escribe a tu agencia!")}</p>
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {messages.map((msg) => {
                  const isOwn = msg.fromRole === "client";
                  return (
                    <div key={msg.id} style={{ display: "flex", justifyContent: isOwn ? "flex-end" : "flex-start" }}>
                      <div style={{ maxWidth: "72%" }}>
                        {!isOwn && (
                          <p style={{ fontSize: 10, color: "var(--t3)", marginBottom: 3, marginLeft: 2 }}>{msg.fromName}</p>
                        )}
                        <div style={{
                          padding: "9px 13px", borderRadius: isOwn ? "12px 12px 2px 12px" : "12px 12px 12px 2px",
                          background: isOwn
                            ? "linear-gradient(135deg,var(--gold) 0%,var(--gold2) 100%)"
                            : "var(--ink3)",
                          border: isOwn ? "none" : "1px solid var(--bdr)",
                          fontSize: 13.5,
                          color: isOwn ? "#0a0a14" : "var(--t1)",
                          fontWeight: isOwn ? 500 : 400,
                          lineHeight: 1.5,
                        }}>
                          {msg.content}
                        </div>
                        <p style={{
                          fontSize: 10, color: "var(--t3)", marginTop: 3,
                          textAlign: isOwn ? "right" : "left",
                          marginLeft: isOwn ? 0 : 2, marginRight: isOwn ? 2 : 0,
                        }}>
                          {formatTime(msg.createdAt)}
                        </p>
                      </div>
                    </div>
                  );
                })}
                <div ref={bottomRef} />
              </div>
            )}
          </div>

          <div style={{
            padding: "10px 12px", borderTop: "1px solid var(--bdr)",
            display: "flex", gap: 10, alignItems: "center",
          }}>
            <input
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && send()}
              placeholder={t("placeholder", "Escribe tu mensaje...")}
              style={{
                flex: 1, background: "rgba(255,255,255,0.03)", border: "1px solid var(--bdr)",
                borderRadius: 10, padding: "10px 14px", fontSize: 13.5, color: "var(--t1)",
                outline: "none", transition: "border-color 0.15s",
              }}
              onFocus={(e) => { e.target.style.borderColor = "var(--gold)"; }}
              onBlur={(e) => { e.target.style.borderColor = "var(--bdr)"; }}
            />
            <button
              onClick={send}
              disabled={sending || !text.trim()}
              style={{
                width: 40, height: 40, borderRadius: 10, border: "none",
                background: "linear-gradient(135deg,var(--gold) 0%,var(--gold2) 100%)",
                color: "#0a0a14", cursor: sending || !text.trim() ? "not-allowed" : "pointer",
                opacity: sending || !text.trim() ? 0.5 : 1,
                display: "flex", alignItems: "center", justifyContent: "center",
                flexShrink: 0, transition: "opacity 0.15s",
              }}
            >
              {sending ? <Loader2 size={15} style={{ animation: "spin 0.6s linear infinite" }} /> : <Send size={15} />}
            </button>
          </div>
        </div>
      </div>
    </ClientLayout>
  );
}
