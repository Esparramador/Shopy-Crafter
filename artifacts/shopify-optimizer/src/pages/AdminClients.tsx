import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import {
  Users, UserPlus, UserCheck, UserX, Loader2,
  Mail, Copy, CheckCircle, MoreVertical,
} from "lucide-react";

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
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-[#0e0e1a] border border-white/10 rounded-2xl p-6 w-full max-w-md">
        <h2 className="text-lg font-bold text-white mb-5 flex items-center gap-2">
          <Mail className="w-5 h-5 text-[#5b4eff]" /> Invitar Cliente
        </h2>
        <form onSubmit={submit} className="space-y-4">
          {[
            { label: "Nombre del cliente", value: name, onChange: setName, placeholder: "Ej: María García" },
            { label: "Email del cliente", value: email, onChange: setEmail, placeholder: "cliente@tienda.com", type: "email" },
            { label: "ID del proyecto (numérico)", value: projectId, onChange: setProjectId, placeholder: "Ej: 1" },
          ].map(({ label, value, onChange, placeholder, type }) => (
            <div key={label}>
              <label className="text-xs text-white/50 uppercase tracking-wider block mb-1.5">{label}</label>
              <input
                type={type ?? "text"} value={value}
                onChange={(e) => onChange(e.target.value)} required
                className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-[#5b4eff]/40"
                placeholder={placeholder}
              />
            </div>
          ))}
          {error && <p className="text-red-400 text-sm">{error}</p>}
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="flex-1 bg-white/5 border border-white/10 text-white py-2.5 rounded-xl text-sm hover:bg-white/10 transition-all">
              Cancelar
            </button>
            <button type="submit" disabled={loading} className="flex-1 bg-[#5b4eff] text-white py-2.5 rounded-xl text-sm font-semibold hover:bg-[#4a3ef0] disabled:opacity-60 flex items-center justify-center gap-2 transition-all">
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Mail className="w-4 h-4" />}
              Enviar invitación
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function AdminClients() {
  const { user } = useAuth();
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
    <div className="min-h-screen bg-[#08080f] p-6">
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

      <div className="max-w-5xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-white flex items-center gap-3">
              <Users className="w-6 h-6 text-[#5b4eff]" /> Gestión de Clientes
            </h1>
            <p className="text-white/40 text-sm mt-1">{clients.length} clientes registrados</p>
          </div>
          <button
            onClick={() => setShowInvite(true)}
            className="bg-[#5b4eff] text-white px-5 py-2.5 rounded-xl font-semibold text-sm flex items-center gap-2 hover:bg-[#4a3ef0] transition-all shadow-[0_0_20px_rgba(91,78,255,0.3)]"
          >
            <UserPlus className="w-4 h-4" /> Invitar Cliente
          </button>
        </div>

        {inviteLink && (
          <div className="bg-green-500/10 border border-green-500/20 rounded-2xl p-4">
            <div className="flex items-start gap-3">
              <CheckCircle className="w-5 h-5 text-green-400 flex-shrink-0 mt-0.5" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-white mb-1">Invitación creada para {inviteLink.email}</p>
                <p className="text-xs text-green-400 mb-2">Comparte este enlace con el cliente (expira en 48h):</p>
                <div className="flex items-center gap-2 bg-black/30 rounded-xl px-3 py-2 border border-white/10">
                  <code className="text-xs text-white/70 flex-1 truncate">{inviteLink.link}</code>
                  <button
                    onClick={() => copyLink(inviteLink.link)}
                    className="flex-shrink-0 text-[#5b4eff] hover:text-[#7b6eff] transition-colors"
                  >
                    {copied ? <CheckCircle className="w-4 h-4 text-green-400" /> : <Copy className="w-4 h-4" />}
                  </button>
                </div>
              </div>
              <button onClick={() => setInviteLink(null)} className="text-white/30 hover:text-white/60 text-lg leading-none">×</button>
            </div>
          </div>
        )}

        {loading ? (
          <div className="flex items-center justify-center h-64">
            <Loader2 className="w-8 h-8 animate-spin text-[#5b4eff]" />
          </div>
        ) : clients.length === 0 ? (
          <div className="bg-white/5 border border-white/8 rounded-2xl p-12 text-center">
            <Users className="w-12 h-12 text-white/20 mx-auto mb-3" />
            <p className="text-white font-semibold">Sin clientes aún</p>
            <p className="text-white/40 text-sm mt-1">Invita tu primer cliente usando el botón de arriba.</p>
          </div>
        ) : (
          <div className="bg-white/5 border border-white/8 rounded-2xl overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="border-b border-white/5">
                  <th className="px-5 py-3 text-left text-xs text-white/40 uppercase tracking-wider">Cliente</th>
                  <th className="px-5 py-3 text-left text-xs text-white/40 uppercase tracking-wider">Proyecto</th>
                  <th className="px-5 py-3 text-left text-xs text-white/40 uppercase tracking-wider">Último acceso</th>
                  <th className="px-5 py-3 text-left text-xs text-white/40 uppercase tracking-wider">Estado</th>
                  <th className="px-5 py-3 text-right text-xs text-white/40 uppercase tracking-wider">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {clients.map((u) => (
                  <tr key={u.id} className="hover:bg-white/3 transition-colors">
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-3">
                        <div
                          className="w-9 h-9 rounded-xl flex items-center justify-center text-sm font-bold text-white flex-shrink-0"
                          style={{ backgroundColor: u.avatarColor ?? "#5b4eff" }}
                        >
                          {u.name.slice(0, 2).toUpperCase()}
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-white">{u.name}</p>
                          <p className="text-xs text-white/40">{u.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-4">
                      <span className="text-sm text-white/60 font-mono">
                        {u.clientId ? `#${u.clientId}` : "–"}
                      </span>
                    </td>
                    <td className="px-5 py-4">
                      <span className="text-sm text-white/50">{timeSince(u.lastLogin)}</span>
                    </td>
                    <td className="px-5 py-4">
                      <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${u.isActive ? "bg-green-500/15 text-green-400" : "bg-red-500/15 text-red-400"}`}>
                        {u.isActive ? "Activo" : "Inactivo"}
                      </span>
                    </td>
                    <td className="px-5 py-4 text-right">
                      <button
                        onClick={() => toggleActive(u)}
                        disabled={processing === u.id}
                        className={`text-xs px-3 py-1.5 rounded-lg border transition-all flex items-center gap-1.5 ml-auto ${
                          u.isActive
                            ? "border-red-500/20 text-red-400 hover:bg-red-500/10"
                            : "border-green-500/20 text-green-400 hover:bg-green-500/10"
                        }`}
                      >
                        {processing === u.id ? (
                          <Loader2 className="w-3 h-3 animate-spin" />
                        ) : u.isActive ? (
                          <UserX className="w-3 h-3" />
                        ) : (
                          <UserCheck className="w-3 h-3" />
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
    </div>
  );
}
