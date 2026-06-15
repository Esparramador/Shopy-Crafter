import { useState, useEffect, useRef, useCallback } from "react";
import { AppLayout } from "../../components/layout/AppLayout";
import { Send, Loader2, MessageSquare, Search } from "lucide-react";

const API = import.meta.env.BASE_URL.replace(/\/$/, "") + "/api";

interface Project { id: number; name: string; shopDomain: string; clientId: string | null; }
interface UnreadEntry { projectId: string; count: number; }
interface Msg { id: string; projectId: string; fromRole: "admin" | "client"; fromName: string; content: string; createdAt: string; isRead: number; }

function fmtTime(d: string) {
  const dt = new Date(d);
  const now = new Date();
  const diffMs = now.getTime() - dt.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1) return "ahora";
  if (diffMin < 60) return `${diffMin}m`;
  const diffH = Math.floor(diffMin / 60);
  if (diffH < 24) return `${diffH}h`;
  return dt.toLocaleDateString("es-ES", { day: "2-digit", month: "short" });
}

export default function AdminMessages() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [unread, setUnread] = useState<Record<string, number>>({});
  const [selected, setSelected] = useState<Project | null>(null);
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [loadingMsgs, setLoadingMsgs] = useState(false);
  const [search, setSearch] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);

  const loadProjects = useCallback(() => {
    Promise.all([
      fetch(`${API}/admin/projects-list`, { credentials: "include" }).then(r => r.json()),
      fetch(`${API}/admin/unread-messages`, { credentials: "include" }).then(r => r.json()),
    ]).then(([p, u]) => {
      if (Array.isArray(p)) setProjects(p);
      if (u?.byProject) {
        const map: Record<string, number> = {};
        for (const e of u.byProject as UnreadEntry[]) map[String(e.projectId)] = e.count;
        setUnread(map);
      }
    }).catch(() => {});
  }, []);

  useEffect(() => {
    loadProjects();
    const t = setInterval(loadProjects, 10000);
    return () => clearInterval(t);
  }, [loadProjects]);

  const loadMsgs = useCallback((projectId: string) => {
    fetch(`${API}/admin/projects/${projectId}/messages`, { credentials: "include" })
      .then(r => r.json())
      .then(d => {
        if (Array.isArray(d)) {
          setMsgs(d);
          setUnread(prev => ({ ...prev, [projectId]: 0 }));
        }
        setLoadingMsgs(false);
      }).catch(() => setLoadingMsgs(false));
  }, []);

  useEffect(() => {
    if (!selected) return;
    setLoadingMsgs(true);
    loadMsgs(String(selected.id));
    const t = setInterval(() => loadMsgs(String(selected.id)), 5000);
    return () => clearInterval(t);
  }, [selected, loadMsgs]);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, [msgs]);

  const send = async () => {
    if (!text.trim() || !selected || sending) return;
    setSending(true);
    await fetch(`${API}/admin/projects/${selected.id}/messages`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ content: text.trim() }),
    }).catch(() => {});
    setText("");
    setSending(false);
    loadMsgs(String(selected.id));
  };

  const filteredProjects = projects.filter(p =>
    p.name?.toLowerCase().includes(search.toLowerCase()) ||
    p.shopDomain?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <AppLayout>
      <div style={{ display: "flex", height: "calc(100vh - 6rem)", gap: 0, background: "var(--srf)", border: "1px solid var(--bdr)", borderRadius: 16, overflow: "hidden", boxShadow: "0 4px 24px rgba(0,0,0,0.3)" }}>

        {/* ── LEFT: Client list ── */}
        <div style={{ width: 280, flexShrink: 0, borderRight: "1px solid var(--bdr)", display: "flex", flexDirection: "column" }}>
          {/* Header */}
          <div style={{ padding: "16px 16px 10px", borderBottom: "1px solid var(--bdr)" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
              <MessageSquare size={16} style={{ color: "var(--gold)" }} />
              <span style={{ fontSize: 14, fontWeight: 700, color: "var(--t1)" }}>Mensajes</span>
              {Object.values(unread).reduce((s, c) => s + c, 0) > 0 && (
                <span style={{ marginLeft: "auto", minWidth: 20, height: 20, background: "var(--gold)", color: "#0a0a14", borderRadius: 10, fontSize: 10, fontWeight: 800, display: "flex", alignItems: "center", justifyContent: "center", padding: "0 5px" }}>
                  {Object.values(unread).reduce((s, c) => s + c, 0)}
                </span>
              )}
            </div>
            <div style={{ position: "relative" }}>
              <Search size={12} style={{ position: "absolute", left: 9, top: "50%", transform: "translateY(-50%)", color: "var(--t3)" }} />
              <input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Buscar cliente..."
                style={{ width: "100%", paddingLeft: 28, paddingRight: 10, paddingTop: 7, paddingBottom: 7, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 8, color: "var(--t1)", fontSize: 12, outline: "none", boxSizing: "border-box" }}
              />
            </div>
          </div>

          {/* Client list */}
          <div style={{ flex: 1, overflowY: "auto" }}>
            {filteredProjects.length === 0 ? (
              <div style={{ padding: 24, textAlign: "center", color: "var(--t3)", fontSize: 12 }}>Sin clientes</div>
            ) : filteredProjects.map(p => {
              const unreadN = unread[String(p.id)] ?? 0;
              const isActive = selected?.id === p.id;
              return (
                <div
                  key={p.id}
                  onClick={() => setSelected(p)}
                  style={{
                    display: "flex", alignItems: "center", gap: 10, padding: "12px 14px",
                    background: isActive ? "rgba(201,169,97,0.07)" : "transparent",
                    borderLeft: isActive ? "3px solid var(--gold)" : "3px solid transparent",
                    borderBottom: "1px solid rgba(255,255,255,0.03)",
                    cursor: "pointer", transition: "all 0.12s",
                  }}
                  onMouseEnter={e => { if (!isActive) e.currentTarget.style.background = "rgba(255,255,255,0.03)"; }}
                  onMouseLeave={e => { if (!isActive) e.currentTarget.style.background = "transparent"; }}
                >
                  <div style={{ width: 36, height: 36, borderRadius: 10, background: isActive ? "linear-gradient(135deg,rgba(201,169,97,0.25),rgba(201,169,97,0.12))" : "rgba(255,255,255,0.06)", border: `1px solid ${isActive ? "rgba(201,169,97,0.3)" : "rgba(255,255,255,0.08)"}`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, fontWeight: 800, color: isActive ? "var(--gold)" : "var(--t2)", flexShrink: 0 }}>
                    {(p.name ?? "?")[0]?.toUpperCase()}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ fontSize: 12.5, fontWeight: unreadN > 0 ? 700 : 500, color: unreadN > 0 ? "var(--t1)" : "var(--t2)", margin: 0, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{p.name ?? "Tienda sin nombre"}</p>
                    <p style={{ fontSize: 10.5, color: "var(--t3)", margin: 0, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{p.shopDomain || "Sin dominio"}</p>
                  </div>
                  {unreadN > 0 && (
                    <span style={{ minWidth: 18, height: 18, background: "var(--gold)", color: "#0a0a14", borderRadius: 9, fontSize: 10, fontWeight: 800, display: "flex", alignItems: "center", justifyContent: "center", padding: "0 4px", flexShrink: 0 }}>
                      {unreadN > 9 ? "9+" : unreadN}
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* ── RIGHT: Conversation ── */}
        <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0 }}>
          {!selected ? (
            <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", color: "var(--t3)" }}>
              <div style={{ fontSize: 48, marginBottom: 14, opacity: 0.4 }}>💬</div>
              <p style={{ fontSize: 14, fontWeight: 600, color: "var(--t2)" }}>Selecciona un cliente</p>
              <p style={{ fontSize: 12, color: "var(--t3)", marginTop: 4 }}>Elige una tienda del panel izquierdo para ver la conversación</p>
            </div>
          ) : (
            <>
              {/* Conversation header */}
              <div style={{ padding: "14px 20px", borderBottom: "1px solid var(--bdr)", display: "flex", alignItems: "center", gap: 12, flexShrink: 0 }}>
                <div style={{ width: 36, height: 36, borderRadius: 10, background: "linear-gradient(135deg,rgba(201,169,97,0.2),rgba(201,169,97,0.08))", border: "1px solid rgba(201,169,97,0.25)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 15, fontWeight: 800, color: "var(--gold)", flexShrink: 0 }}>
                  {(selected.name ?? "?")[0]?.toUpperCase()}
                </div>
                <div>
                  <p style={{ fontSize: 14, fontWeight: 700, color: "var(--t1)", margin: 0 }}>{selected.name ?? "Tienda sin nombre"}</p>
                  <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                    <div style={{ width: 5, height: 5, borderRadius: "50%", background: "var(--jade)", animation: "pulse 2s infinite" }} />
                    <p style={{ fontSize: 11, color: "var(--t3)", margin: 0 }}>{selected.shopDomain || "Sin dominio"} · Actualiza cada 5s</p>
                  </div>
                </div>
              </div>

              {/* Messages */}
              <div style={{ flex: 1, overflowY: "auto", padding: "18px 20px", display: "flex", flexDirection: "column", gap: 10 }}>
                {loadingMsgs && msgs.length === 0 ? (
                  <div style={{ display: "flex", justifyContent: "center", alignItems: "center", height: 80 }}>
                    <Loader2 size={20} style={{ color: "var(--gold)", animation: "spin 0.6s linear infinite" }} />
                  </div>
                ) : msgs.length === 0 ? (
                  <div style={{ textAlign: "center", padding: "40px 0" }}>
                    <p style={{ fontSize: 28, marginBottom: 10 }}>💬</p>
                    <p style={{ fontSize: 13, color: "var(--t3)" }}>No hay mensajes aún. Inicia la conversación.</p>
                  </div>
                ) : msgs.map(msg => {
                  const isAdmin = msg.fromRole === "admin";
                  return (
                    <div key={msg.id} style={{ display: "flex", justifyContent: isAdmin ? "flex-end" : "flex-start", gap: 8, alignItems: "flex-end" }}>
                      {!isAdmin && (
                        <div style={{ width: 26, height: 26, borderRadius: 7, background: "rgba(45,212,159,0.15)", border: "1px solid rgba(45,212,159,0.2)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 700, color: "var(--jade)", flexShrink: 0 }}>
                          {(msg.fromName ?? "C")[0]?.toUpperCase()}
                        </div>
                      )}
                      <div style={{ maxWidth: "62%" }}>
                        {!isAdmin && <p style={{ fontSize: 10, color: "var(--t3)", margin: "0 0 3px 4px", fontWeight: 500 }}>{msg.fromName ?? "Cliente"}</p>}
                        <div style={{
                          padding: "9px 13px", borderRadius: isAdmin ? "14px 14px 4px 14px" : "14px 14px 14px 4px",
                          background: isAdmin ? "linear-gradient(135deg,rgba(201,169,97,0.18),rgba(201,169,97,0.10))" : "rgba(255,255,255,0.05)",
                          border: isAdmin ? "1px solid rgba(201,169,97,0.25)" : "1px solid rgba(255,255,255,0.07)",
                          color: "var(--t1)", fontSize: 13, lineHeight: 1.5, wordBreak: "break-word",
                        }}>
                          {msg.content}
                        </div>
                        <p style={{ fontSize: 10, color: "var(--t3)", margin: "3px 4px 0", textAlign: isAdmin ? "right" : "left" }}>{fmtTime(msg.createdAt)}</p>
                      </div>
                      {isAdmin && (
                        <div style={{ width: 26, height: 26, borderRadius: 7, background: "linear-gradient(135deg,rgba(201,169,97,0.2),rgba(201,169,97,0.1))", border: "1px solid rgba(201,169,97,0.3)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 800, color: "var(--gold)", flexShrink: 0 }}>
                          A
                        </div>
                      )}
                    </div>
                  );
                })}
                <div ref={bottomRef} />
              </div>

              {/* Input */}
              <div style={{ padding: "12px 16px", borderTop: "1px solid var(--bdr)", display: "flex", gap: 8, alignItems: "flex-end", flexShrink: 0 }}>
                <textarea
                  value={text}
                  onChange={e => setText(e.target.value)}
                  onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }}
                  placeholder={`Escribe a ${selected.name ?? "el cliente"}…`}
                  rows={1}
                  style={{ flex: 1, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 10, color: "var(--t1)", fontSize: 13, padding: "10px 12px", resize: "none", outline: "none", fontFamily: "inherit", lineHeight: 1.5, maxHeight: 120, overflowY: "auto" }}
                />
                <button
                  onClick={send}
                  disabled={!text.trim() || sending}
                  style={{ width: 40, height: 40, borderRadius: 10, background: text.trim() ? "var(--gold)" : "rgba(255,255,255,0.06)", border: "none", cursor: text.trim() ? "pointer" : "not-allowed", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, transition: "all 0.15s" }}
                >
                  {sending ? <Loader2 size={16} style={{ color: "#0a0a14", animation: "spin 0.6s linear infinite" }} /> : <Send size={15} style={{ color: text.trim() ? "#0a0a14" : "var(--t3)" }} />}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </AppLayout>
  );
}
