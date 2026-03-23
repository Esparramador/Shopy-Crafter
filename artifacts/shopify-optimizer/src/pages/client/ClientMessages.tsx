import { useEffect, useState, useRef } from "react";
import { ClientLayout } from "./ClientLayout";
import { useAuth } from "@/contexts/AuthContext";
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
  const { user } = useAuth();
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  const load = () => {
    fetch(`${API_BASE}/api/client/messages`, { credentials: "include" })
      .then((r) => r.json())
      .then((d) => { setMessages(d); setLoading(false); });
  };

  useEffect(() => { load(); }, []);
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
      <div className="max-w-2xl flex flex-col h-[calc(100vh-8rem)]">
        <div className="mb-4">
          <h1 className="text-2xl font-bold text-white">Mensajes</h1>
          <p className="text-white/40 text-sm mt-1">Comunicación directa con tu agencia.</p>
        </div>

        <div className="flex-1 bg-white/5 border border-white/8 rounded-2xl overflow-hidden flex flex-col">
          {/* Agency header */}
          <div className="px-5 py-3 border-b border-white/5 flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-[#5b4eff]/20 border border-[#5b4eff]/30 flex items-center justify-center text-sm font-bold text-[#5b4eff]">A</div>
            <div>
              <p className="text-sm font-semibold text-white">Tu Agencia</p>
              <div className="flex items-center gap-1.5">
                <div className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
                <p className="text-xs text-white/40">En línea</p>
              </div>
            </div>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {loading ? (
              <div className="flex items-center justify-center h-32">
                <Loader2 className="w-6 h-6 animate-spin text-[#5b4eff]" />
              </div>
            ) : messages.length === 0 ? (
              <div className="text-center py-12 text-white/30 text-sm">
                No hay mensajes aún. ¡Escribe a tu agencia!
              </div>
            ) : (
              messages.map((msg) => {
                const isOwn = msg.fromRole === "client";
                return (
                  <div key={msg.id} className={`flex ${isOwn ? "justify-end" : "justify-start"}`}>
                    <div className={`max-w-xs md:max-w-sm ${isOwn ? "order-2" : "order-1"}`}>
                      {!isOwn && (
                        <p className="text-xs text-white/30 mb-1 ml-1">{msg.fromName}</p>
                      )}
                      <div className={`rounded-2xl px-4 py-2.5 text-sm ${isOwn ? "bg-[#5b4eff] text-white rounded-tr-md" : "bg-white/10 text-white/80 rounded-tl-md"}`}>
                        {msg.content}
                      </div>
                      <p className={`text-xs text-white/20 mt-1 ${isOwn ? "text-right" : "text-left"} mx-1`}>
                        {formatTime(msg.createdAt)}
                      </p>
                    </div>
                  </div>
                );
              })
            )}
            <div ref={bottomRef} />
          </div>

          {/* Input */}
          <div className="px-4 py-3 border-t border-white/5 flex gap-3">
            <input
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && send()}
              placeholder="Escribe tu mensaje..."
              className="flex-1 bg-black/30 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-white/20 transition-colors"
            />
            <button
              onClick={send}
              disabled={sending || !text.trim()}
              className="w-10 h-10 bg-[#5b4eff] text-white rounded-xl flex items-center justify-center hover:bg-[#4a3ef0] disabled:opacity-60 transition-all flex-shrink-0"
            >
              {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            </button>
          </div>
        </div>
      </div>
    </ClientLayout>
  );
}
