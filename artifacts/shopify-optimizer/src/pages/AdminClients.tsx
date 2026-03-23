import { useEffect, useState, useRef } from "react";
import { UserPlus, UserCheck, UserX, Loader2, Mail, Copy, CheckCircle, MessageSquare, Send, X, ArrowLeft } from "lucide-react";

const API_BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

interface User {
  id: string;
  email: string;
  name: string;
  role: string;
  clientId: string | null;
  isActive: number;
  avatarColor: string;
  lastLogin: string | null;
  createdAt: string;
}

interface Message {
  id: string;
  fromRole: "admin" | "client";
  fromName: string;
  content: string;
  isRead: number;
  createdAt: string;
}

function timeSince(dateStr: string | null) {
  if (!dateStr) return "Nunca";
  const diff = Date.now() - new Date(dateStr).getTime();
  const days = Math.floor(diff / 86400000);
  if (days === 0) return "Hoy";
  if (days === 1) return "Ayer";
  return `Hace ${days} días`;
}

function formatTime(dateStr: string) {
  const d = new Date(dateStr);
  return d.toLocaleString("es-ES", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
}

// ─── Invite Modal ─────────────────────────────────────────────────────────────
interface InviteModalProps {
  onClose: () => void;
  onInvited: (link: string, email: string) => void;
}

function InviteModal({ onClose, onInvited }: InviteModalProps) {
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [projectId, setProjectId] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!projectId.trim()) { setError("El ID del proyecto es obligatorio"); return; }
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/admin/projects/${projectId.trim()}/invite`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ email, name }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      onInvited(data.inviteLink, email);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Error al invitar");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.80)", backdropFilter: "blur(8px)", zIndex: 500, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
      <div className="modal-box">
        <p className="modal-title">📨 Invitar Cliente</p>
        <p className="modal-subtitle">El cliente recibirá un enlace de acceso.</p>
        <form onSubmit={submit}>
          {[
            { label: "Nombre del cliente", value: name, onChange: setName, placeholder: "Ej: María García", type: "text" },
            { label: "Email del cliente", value: email, onChange: setEmail, placeholder: "cliente@tienda.com", type: "email" },
            { label: "ID del proyecto (numérico)", value: projectId, onChange: setProjectId, placeholder: "Ej: 1", type: "text" },
          ].map(({ label, value, onChange, placeholder, type }) => (
            <div className="form-group" key={label}>
              <label className="form-label">{label}</label>
              <input type={type} className="form-input" value={value} onChange={(e) => onChange(e.target.value)} required placeholder={placeholder} />
            </div>
          ))}
          {error && (
            <div style={{ background: "rgba(232,69,88,0.08)", border: "1px solid rgba(232,69,88,0.2)", borderRadius: 8, padding: "8px 12px", color: "var(--crim)", fontSize: 12.5, marginBottom: 14 }}>
              {error}
            </div>
          )}
          <div style={{ display: "flex", gap: 8 }}>
            <button type="button" onClick={onClose} className="btn btn-ghost" style={{ flex: 1, justifyContent: "center" }}>Cancelar</button>
            <button type="submit" disabled={loading} className={`btn btn-gold${loading ? " loading" : ""}`} style={{ flex: 1, justifyContent: "center" }}>
              {loading ? <Loader2 size={14} className="animate-spin" /> : <Mail size={14} />}
              Enviar invitación
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Chat Panel ───────────────────────────────────────────────────────────────
interface ChatPanelProps {
  client: User;
  onClose: () => void;
}

function ChatPanel({ client, onClose }: ChatPanelProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  const projectId = client.clientId;

  const load = () => {
    if (!projectId) return;
    fetch(`${API_BASE}/api/admin/projects/${projectId}/messages`, { credentials: "include" })
      .then((r) => r.json())
      .then((d) => { setMessages(Array.isArray(d) ? d : []); setLoading(false); });
  };

  useEffect(() => { load(); const t = setInterval(load, 10000); return () => clearInterval(t); }, [projectId]);
  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);

  const send = async () => {
    if (!text.trim() || !projectId) return;
    setSending(true);
    await fetch(`${API_BASE}/api/admin/projects/${projectId}/messages`, {
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
    <div style={{
      position: "fixed", inset: 0, background: "rgba(0,0,0,0.60)",
      backdropFilter: "blur(4px)", zIndex: 400,
      display: "flex", alignItems: "center", justifyContent: "center", padding: 20,
    }}>
      <div style={{
        width: "100%", maxWidth: 540, height: "80vh", maxHeight: 680,
        background: "var(--srf)", border: "1px solid var(--bdr)",
        borderRadius: 16, display: "flex", flexDirection: "column", overflow: "hidden",
      }}>
        {/* Header */}
        <div style={{
          padding: "14px 16px", borderBottom: "1px solid var(--bdr)",
          display: "flex", alignItems: "center", gap: 10,
        }}>
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--t3)", display: "flex", padding: 4 }}>
            <ArrowLeft size={16} />
          </button>
          <div style={{
            width: 34, height: 34, borderRadius: 10, flexShrink: 0,
            background: client.avatarColor ? `${client.avatarColor}22` : "rgba(200,168,75,0.1)",
            color: client.avatarColor ?? "var(--gold2)",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 12, fontWeight: 700,
          }}>
            {client.name.slice(0, 2).toUpperCase()}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <p style={{ fontSize: 13, fontWeight: 700, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{client.name}</p>
            <p style={{ fontSize: 11, color: "var(--t3)" }}>Proyecto #{projectId} · {client.email}</p>
          </div>
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--t3)", display: "flex", padding: 4 }}>
            <X size={16} />
          </button>
        </div>

        {/* Messages */}
        <div style={{ flex: 1, overflowY: "auto", padding: "14px 14px 8px" }}>
          {loading ? (
            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: 120 }}>
              <Loader2 size={20} style={{ color: "var(--gold)", animation: "spin 0.6s linear infinite" }} />
            </div>
          ) : !projectId ? (
            <div style={{ textAlign: "center", padding: 32, color: "var(--t3)", fontSize: 13 }}>
              Este cliente no tiene un proyecto asignado.
            </div>
          ) : messages.length === 0 ? (
            <div style={{ textAlign: "center", padding: "40px 0" }}>
              <p style={{ fontSize: 24, marginBottom: 8 }}>💬</p>
              <p style={{ fontSize: 13, color: "var(--t3)" }}>Sin mensajes aún. Escribe el primero.</p>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 9 }}>
              {messages.map((msg) => {
                const isAdmin = msg.fromRole === "admin";
                return (
                  <div key={msg.id} style={{ display: "flex", justifyContent: isAdmin ? "flex-end" : "flex-start" }}>
                    <div style={{ maxWidth: "74%" }}>
                      {!isAdmin && (
                        <p style={{ fontSize: 10, color: "var(--t3)", marginBottom: 3, marginLeft: 2 }}>{msg.fromName}</p>
                      )}
                      <div style={{
                        padding: "8px 12px",
                        borderRadius: isAdmin ? "12px 12px 2px 12px" : "12px 12px 12px 2px",
                        background: isAdmin
                          ? "linear-gradient(135deg,var(--gold) 0%,var(--gold2) 100%)"
                          : "var(--ink3)",
                        border: isAdmin ? "none" : "1px solid var(--bdr)",
                        fontSize: 13, color: isAdmin ? "#0a0a14" : "var(--t1)",
                        fontWeight: isAdmin ? 500 : 400, lineHeight: 1.5,
                      }}>
                        {msg.content}
                      </div>
                      <p style={{
                        fontSize: 10, color: "var(--t3)", marginTop: 2,
                        textAlign: isAdmin ? "right" : "left",
                        marginRight: isAdmin ? 2 : 0, marginLeft: isAdmin ? 0 : 2,
                      }}>
                        {formatTime(msg.createdAt)}
                        {isAdmin && <span style={{ marginLeft: 4, opacity: 0.7 }}>· Tú</span>}
                      </p>
                    </div>
                  </div>
                );
              })}
              <div ref={bottomRef} />
            </div>
          )}
        </div>

        {/* Input */}
        {projectId && (
          <div style={{ padding: "10px 12px", borderTop: "1px solid var(--bdr)", display: "flex", gap: 8, alignItems: "center" }}>
            <input
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && send()}
              placeholder={`Mensaje a ${client.name.split(" ")[0]}...`}
              style={{
                flex: 1, background: "rgba(255,255,255,0.03)", border: "1px solid var(--bdr)",
                borderRadius: 9, padding: "9px 13px", fontSize: 13, color: "var(--t1)", outline: "none",
              }}
              onFocus={(e) => { e.target.style.borderColor = "var(--gold)"; }}
              onBlur={(e) => { e.target.style.borderColor = "var(--bdr)"; }}
            />
            <button
              onClick={send}
              disabled={sending || !text.trim()}
              style={{
                width: 38, height: 38, borderRadius: 9, border: "none",
                background: "linear-gradient(135deg,var(--gold) 0%,var(--gold2) 100%)",
                color: "#0a0a14", cursor: sending || !text.trim() ? "not-allowed" : "pointer",
                opacity: sending || !text.trim() ? 0.5 : 1,
                display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
              }}
            >
              {sending ? <Loader2 size={13} style={{ animation: "spin 0.6s linear infinite" }} /> : <Send size={13} />}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function AdminClients() {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [showInvite, setShowInvite] = useState(false);
  const [inviteLink, setInviteLink] = useState<{ link: string; email: string } | null>(null);
  const [copied, setCopied] = useState(false);
  const [processing, setProcessing] = useState<string | null>(null);
  const [chatClient, setChatClient] = useState<User | null>(null);

  const load = () => {
    fetch(`${API_BASE}/api/admin/users`, { credentials: "include" })
      .then((r) => r.json())
      .then((d) => { setUsers(Array.isArray(d) ? d : []); setLoading(false); });
  };

  useEffect(() => { load(); }, []);

  const toggleActive = async (u: User) => {
    setProcessing(u.id);
    const action = u.isActive ? "deactivate" : "activate";
    await fetch(`${API_BASE}/api/admin/users/${u.id}/${action}`, { method: "POST", credentials: "include" });
    setProcessing(null);
    load();
  };

  const copyLink = async (link: string) => {
    await navigator.clipboard.writeText(link);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const clients = users.filter((u) => u.role === "client");

  return (
    <>
      {showInvite && (
        <InviteModal
          onClose={() => setShowInvite(false)}
          onInvited={(link, email) => { setShowInvite(false); setInviteLink({ link, email }); load(); }}
        />
      )}
      {chatClient && (
        <ChatPanel client={chatClient} onClose={() => setChatClient(null)} />
      )}

      <div style={{ maxWidth: 960, margin: "0 auto" }}>
        {/* Header */}
        <div className="section-header-row" style={{ marginBottom: 20 }}>
          <div>
            <h1 className="section-title">Gestión de Clientes</h1>
            <p className="section-subtitle">{clients.length} clientes registrados</p>
          </div>
          <button onClick={() => setShowInvite(true)} className="btn btn-gold">
            <UserPlus size={14} />
            Invitar Cliente
          </button>
        </div>

        {/* Invite link banner */}
        {inviteLink && (
          <div style={{
            background: "rgba(45,212,159,0.05)", border: "1px solid rgba(45,212,159,0.2)",
            borderRadius: "var(--r3)", padding: 16,
            display: "flex", alignItems: "flex-start", gap: 12, marginBottom: 20,
          }}>
            <CheckCircle size={18} style={{ color: "var(--jade)", flexShrink: 0, marginTop: 1 }} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{ fontSize: 13, fontWeight: 600, marginBottom: 4 }}>Invitación creada para {inviteLink.email}</p>
              <p style={{ fontSize: 11.5, color: "var(--jade)", marginBottom: 8 }}>Comparte este enlace (expira en 48h):</p>
              <div style={{ display: "flex", alignItems: "center", gap: 8, background: "var(--ink3)", borderRadius: 8, padding: "7px 10px", border: "1px solid var(--bdr)" }}>
                <code style={{ flex: 1, fontSize: 11, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", background: "none", border: "none", padding: 0, color: "var(--t2)" }}>
                  {inviteLink.link}
                </code>
                <button onClick={() => copyLink(inviteLink.link)} style={{ flexShrink: 0, background: "none", border: "none", cursor: "pointer", color: "var(--gold)", display: "flex" }}>
                  {copied ? <CheckCircle size={14} style={{ color: "var(--jade)" }} /> : <Copy size={14} />}
                </button>
              </div>
            </div>
            <button onClick={() => setInviteLink(null)} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--t3)", fontSize: 18, lineHeight: 1, flexShrink: 0 }}>×</button>
          </div>
        )}

        {/* Table */}
        {loading ? (
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: 240 }}>
            <Loader2 size={28} style={{ color: "var(--gold)", animation: "spin 0.6s linear infinite" }} />
          </div>
        ) : clients.length === 0 ? (
          <div className="card empty-state">
            <div className="empty-icon">👥</div>
            <p className="empty-title">Sin clientes aún</p>
            <p className="empty-desc">Invita tu primer cliente usando el botón de arriba.</p>
          </div>
        ) : (
          <div className="card" style={{ overflow: "hidden", padding: 0 }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Cliente</th>
                  <th>Proyecto</th>
                  <th>Último acceso</th>
                  <th>Estado</th>
                  <th style={{ textAlign: "right" }}>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {clients.map((u) => (
                  <tr key={u.id}>
                    <td>
                      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                        <div className="logo-gem" style={{ width: 34, height: 34, fontSize: 12, flexShrink: 0, background: u.avatarColor ? `${u.avatarColor}22` : "rgba(200,168,75,0.1)", color: u.avatarColor ?? "var(--gold2)" }}>
                          {u.name.slice(0, 2).toUpperCase()}
                        </div>
                        <div>
                          <p style={{ fontSize: 13, fontWeight: 600 }}>{u.name}</p>
                          <p style={{ fontSize: 11, color: "var(--t3)" }}>{u.email}</p>
                        </div>
                      </div>
                    </td>
                    <td>
                      <span style={{ fontFamily: "var(--fm)", fontSize: 12, color: "var(--t2)" }}>
                        {u.clientId ? `#${u.clientId}` : "–"}
                      </span>
                    </td>
                    <td>
                      <span style={{ fontSize: 12, color: "var(--t2)" }}>{timeSince(u.lastLogin)}</span>
                    </td>
                    <td>
                      <span className={`badge ${u.isActive ? "badge-jade" : "badge-crim"}`}>
                        {u.isActive ? "Activo" : "Inactivo"}
                      </span>
                    </td>
                    <td style={{ textAlign: "right" }}>
                      <div style={{ display: "flex", gap: 6, justifyContent: "flex-end" }}>
                        {u.clientId && (
                          <button
                            onClick={() => setChatClient(u)}
                            className="btn btn-sm btn-ghost"
                            title="Ver mensajes"
                          >
                            <MessageSquare size={11} />
                            Chat
                          </button>
                        )}
                        <button
                          onClick={() => toggleActive(u)}
                          disabled={processing === u.id}
                          className={`btn btn-sm ${u.isActive ? "btn-danger" : "btn-jade"}`}
                        >
                          {processing === u.id ? (
                            <Loader2 size={11} className="animate-spin" />
                          ) : u.isActive ? (
                            <UserX size={11} />
                          ) : (
                            <UserCheck size={11} />
                          )}
                          {u.isActive ? "Revocar" : "Activar"}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  );
}
