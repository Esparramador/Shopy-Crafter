import { useEffect, useState } from "react";
import { UserPlus, UserCheck, UserX, Loader2, Mail, Copy, CheckCircle } from "lucide-react";

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

function timeSince(dateStr: string | null) {
  if (!dateStr) return "Nunca";
  const diff = Date.now() - new Date(dateStr).getTime();
  const days = Math.floor(diff / 86400000);
  if (days === 0) return "Hoy";
  if (days === 1) return "Ayer";
  return `Hace ${days} días`;
}

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
    <div
      style={{
        position: "fixed", inset: 0,
        background: "rgba(0,0,0,0.80)",
        backdropFilter: "blur(8px)",
        zIndex: 500,
        display: "flex", alignItems: "center", justifyContent: "center",
        padding: 16,
      }}
    >
      <div className="modal-box">
        <p className="modal-title">📨 Invitar Cliente</p>
        <p className="modal-subtitle">El cliente recibirá un enlace de acceso por email.</p>

        <form onSubmit={submit}>
          {[
            { label: "Nombre del cliente", value: name, onChange: setName, placeholder: "Ej: María García", type: "text" },
            { label: "Email del cliente", value: email, onChange: setEmail, placeholder: "cliente@tienda.com", type: "email" },
            { label: "ID del proyecto (numérico)", value: projectId, onChange: setProjectId, placeholder: "Ej: 1", type: "text" },
          ].map(({ label, value, onChange, placeholder, type }) => (
            <div className="form-group" key={label}>
              <label className="form-label">{label}</label>
              <input
                type={type}
                className="form-input"
                value={value}
                onChange={(e) => onChange(e.target.value)}
                required
                placeholder={placeholder}
              />
            </div>
          ))}

          {error && (
            <div style={{ background: "rgba(232,69,88,0.08)", border: "1px solid rgba(232,69,88,0.2)", borderRadius: 8, padding: "8px 12px", color: "var(--crim)", fontSize: 12.5, marginBottom: 14 }}>
              {error}
            </div>
          )}

          <div style={{ display: "flex", gap: 8 }}>
            <button type="button" onClick={onClose} className="btn btn-ghost" style={{ flex: 1, justifyContent: "center" }}>
              Cancelar
            </button>
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

export default function AdminClients() {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [showInvite, setShowInvite] = useState(false);
  const [inviteLink, setInviteLink] = useState<{ link: string; email: string } | null>(null);
  const [copied, setCopied] = useState(false);
  const [processing, setProcessing] = useState<string | null>(null);

  const load = () => {
    fetch(`${API_BASE}/api/admin/users`, { credentials: "include" })
      .then((r) => r.json())
      .then((d) => { setUsers(d); setLoading(false); });
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
          onInvited={(link, email) => {
            setShowInvite(false);
            setInviteLink({ link, email });
            load();
          }}
        />
      )}

      <div style={{ maxWidth: 960, margin: "0 auto" }}>
        {/* Header row */}
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
          <div
            style={{
              background: "rgba(45,212,159,0.05)",
              border: "1px solid rgba(45,212,159,0.2)",
              borderRadius: "var(--r3)",
              padding: 16,
              display: "flex",
              alignItems: "flex-start",
              gap: 12,
              marginBottom: 20,
            }}
          >
            <CheckCircle size={18} style={{ color: "var(--jade)", flexShrink: 0, marginTop: 1 }} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{ fontSize: 13, fontWeight: 600, marginBottom: 4 }}>Invitación creada para {inviteLink.email}</p>
              <p style={{ fontSize: 11.5, color: "var(--jade)", marginBottom: 8 }}>Comparte este enlace con el cliente (expira en 48h):</p>
              <div style={{ display: "flex", alignItems: "center", gap: 8, background: "var(--ink3)", borderRadius: 8, padding: "7px 10px", border: "1px solid var(--bdr)" }}>
                <code style={{ flex: 1, fontSize: 11, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", background: "none", border: "none", padding: 0, color: "var(--t2)" }}>
                  {inviteLink.link}
                </code>
                <button
                  onClick={() => copyLink(inviteLink.link)}
                  style={{ flexShrink: 0, background: "none", border: "none", cursor: "pointer", color: "var(--gold)", display: "flex" }}
                >
                  {copied ? <CheckCircle size={14} style={{ color: "var(--jade)" }} /> : <Copy size={14} />}
                </button>
              </div>
            </div>
            <button onClick={() => setInviteLink(null)} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--t3)", fontSize: 18, lineHeight: 1, flexShrink: 0 }}>×</button>
          </div>
        )}

        {/* Content */}
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
                        <div
                          className="logo-gem"
                          style={{
                            width: 34, height: 34, fontSize: 12, flexShrink: 0,
                            background: u.avatarColor ? `${u.avatarColor}22` : "rgba(200,168,75,0.1)",
                            color: u.avatarColor ?? "var(--gold2)",
                          }}
                        >
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
