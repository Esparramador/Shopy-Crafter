import { useState, useEffect, useRef, useCallback } from "react";
import { AppLayout } from "../../components/layout/AppLayout";
import { ModalOverlay } from "@/components/ModalOverlay";
import { Send, Loader2, Plus, X, Users, Trash2, UserPlus, MessageSquare } from "lucide-react";

const API = import.meta.env.BASE_URL.replace(/\/$/, "") + "/api";

interface ChatGroup { id: number; name: string; description?: string; members: { projectId: number }[] | null; unread_count: number; created_at: string; }
interface Project { id: number; name: string; shopDomain: string; }
interface GroupMsg { id: string; group_id: number; project_id?: string; from_role: "admin" | "client"; from_name: string; content: string; created_at: string; }

function fmtTime(d: string) {
  const dt = new Date(d);
  const now = new Date();
  const diffMin = Math.floor((now.getTime() - dt.getTime()) / 60000);
  if (diffMin < 1) return "ahora";
  if (diffMin < 60) return `${diffMin}m`;
  if (diffMin < 1440) return `${Math.floor(diffMin / 60)}h`;
  return dt.toLocaleDateString("es-ES", { day: "2-digit", month: "short" });
}

export default function GroupChat() {
  const [groups, setGroups] = useState<ChatGroup[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [selected, setSelected] = useState<ChatGroup | null>(null);
  const [msgs, setMsgs] = useState<GroupMsg[]>([]);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [showAddMember, setShowAddMember] = useState(false);
  const [newGroup, setNewGroup] = useState({ name: "", description: "", projectIds: [] as number[] });
  const bottomRef = useRef<HTMLDivElement>(null);

  const loadGroups = useCallback(() => {
    fetch(`${API}/admin/chat-groups`, { credentials: "include" })
      .then(r => r.json())
      .then(d => { if (d.groups) setGroups(d.groups); })
      .catch(() => {});
  }, []);

  const loadProjects = useCallback(() => {
    fetch(`${API}/admin/projects-list`, { credentials: "include" })
      .then(r => r.json())
      .then(d => { if (Array.isArray(d)) setProjects(d); })
      .catch(() => {});
  }, []);

  useEffect(() => {
    loadGroups();
    loadProjects();
    const t = setInterval(loadGroups, 8000);
    return () => clearInterval(t);
  }, [loadGroups, loadProjects]);

  const loadMsgs = useCallback((groupId: number) => {
    fetch(`${API}/admin/chat-groups/${groupId}/messages`, { credentials: "include" })
      .then(r => r.json())
      .then(d => { if (Array.isArray(d)) setMsgs(d); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!selected) return;
    setLoading(true);
    loadMsgs(selected.id);
    const t = setInterval(() => loadMsgs(selected.id), 5000);
    return () => clearInterval(t);
  }, [selected, loadMsgs]);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, [msgs]);

  const send = async () => {
    if (!text.trim() || !selected || sending) return;
    setSending(true);
    await fetch(`${API}/admin/chat-groups/${selected.id}/messages`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ content: text.trim() }),
    }).catch(() => {});
    setText("");
    setSending(false);
    loadMsgs(selected.id);
  };

  const createGroup = async () => {
    if (!newGroup.name.trim()) return;
    await fetch(`${API}/admin/chat-groups`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify(newGroup),
    }).catch(() => {});
    setShowCreate(false);
    setNewGroup({ name: "", description: "", projectIds: [] });
    loadGroups();
  };

  const deleteGroup = async (id: number) => {
    if (!confirm("¿Eliminar este grupo?")) return;
    await fetch(`${API}/admin/chat-groups/${id}`, { method: "DELETE", credentials: "include" }).catch(() => {});
    if (selected?.id === id) setSelected(null);
    loadGroups();
  };

  const addMember = async (projectId: number) => {
    if (!selected) return;
    await fetch(`${API}/admin/chat-groups/${selected.id}/members`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ projectId }),
    }).catch(() => {});
    loadGroups();
    setShowAddMember(false);
  };

  const removeMember = async (projectId: number) => {
    if (!selected) return;
    await fetch(`${API}/admin/chat-groups/${selected.id}/members/${projectId}`, {
      method: "DELETE", credentials: "include"
    }).catch(() => {});
    loadGroups();
  };

  const totalUnread = groups.reduce((s, g) => s + (g.unread_count || 0), 0);
  const memberIds = new Set((selected?.members ?? []).map(m => m.projectId));
  const availableToAdd = projects.filter(p => !memberIds.has(p.id));
  const memberProjects = projects.filter(p => memberIds.has(p.id));

  return (
    <AppLayout>
      <div style={{ display: "flex", height: "calc(100vh - 6rem)", gap: 0, background: "var(--srf)", border: "1px solid var(--bdr)", borderRadius: 16, overflow: "hidden", boxShadow: "0 4px 24px rgba(0,0,0,0.3)" }}>

        {/* ── LEFT: Groups list ── */}
        <div style={{ width: 280, flexShrink: 0, borderRight: "1px solid var(--bdr)", display: "flex", flexDirection: "column" }}>
          <div style={{ padding: "16px 16px 10px", borderBottom: "1px solid var(--bdr)" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
              <Users size={16} style={{ color: "var(--gold)" }} />
              <span style={{ fontSize: 14, fontWeight: 700, color: "var(--t1)" }}>Grupos</span>
              {totalUnread > 0 && (
                <span style={{ marginLeft: "auto", minWidth: 20, height: 20, background: "var(--gold)", color: "#0a0a14", borderRadius: 10, fontSize: 10, fontWeight: 800, display: "flex", alignItems: "center", justifyContent: "center", padding: "0 5px" }}>
                  {totalUnread}
                </span>
              )}
            </div>
            <button onClick={() => setShowCreate(true)}
              style={{ width: "100%", display: "flex", alignItems: "center", gap: 6, padding: "7px 10px", borderRadius: 8, border: "1px dashed rgba(201,169,97,0.4)", background: "rgba(201,169,97,0.04)", color: "var(--gold)", fontSize: 12, fontWeight: 600, cursor: "pointer" }}>
              <Plus size={13} /> Nuevo grupo
            </button>
          </div>
          <div style={{ flex: 1, overflowY: "auto" }}>
            {groups.length === 0 ? (
              <div style={{ padding: 24, textAlign: "center", color: "var(--t3)", fontSize: 12 }}>
                <Users size={28} style={{ opacity: 0.3, display: "block", margin: "0 auto 8px" }} />
                Sin grupos aún
              </div>
            ) : groups.map(g => {
              const isActive = selected?.id === g.id;
              const memberCount = g.members?.length ?? 0;
              return (
                <div key={g.id} onClick={() => setSelected(g)}
                  style={{ display: "flex", alignItems: "center", gap: 10, padding: "12px 14px", background: isActive ? "rgba(201,169,97,0.07)" : "transparent", borderLeft: isActive ? "3px solid var(--gold)" : "3px solid transparent", borderBottom: "1px solid rgba(255,255,255,0.03)", cursor: "pointer", transition: "all 0.12s" }}>
                  <div style={{ width: 36, height: 36, borderRadius: 10, background: isActive ? "linear-gradient(135deg,rgba(201,169,97,0.25),rgba(201,169,97,0.12))" : "rgba(255,255,255,0.06)", border: `1px solid ${isActive ? "rgba(201,169,97,0.3)" : "rgba(255,255,255,0.08)"}`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16, flexShrink: 0 }}>
                    👥
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ fontSize: 12.5, fontWeight: g.unread_count > 0 ? 700 : 500, color: g.unread_count > 0 ? "var(--t1)" : "var(--t2)", margin: 0, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{g.name}</p>
                    <p style={{ fontSize: 10.5, color: "var(--t3)", margin: 0 }}>{memberCount} miembro{memberCount !== 1 ? "s" : ""}</p>
                  </div>
                  {g.unread_count > 0 && (
                    <span style={{ minWidth: 18, height: 18, background: "var(--gold)", color: "#0a0a14", borderRadius: 9, fontSize: 10, fontWeight: 800, display: "flex", alignItems: "center", justifyContent: "center", padding: "0 4px", flexShrink: 0 }}>
                      {g.unread_count > 9 ? "9+" : g.unread_count}
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
              <div style={{ fontSize: 48, marginBottom: 14, opacity: 0.4 }}>👥</div>
              <p style={{ fontSize: 14, fontWeight: 600, color: "var(--t2)" }}>Selecciona un grupo</p>
              <p style={{ fontSize: 12, color: "var(--t3)", marginTop: 4 }}>O crea uno nuevo con el botón de la izquierda</p>
            </div>
          ) : (
            <>
              {/* Header */}
              <div style={{ padding: "14px 20px", borderBottom: "1px solid var(--bdr)", display: "flex", alignItems: "center", gap: 12, flexShrink: 0 }}>
                <div style={{ fontSize: 26 }}>👥</div>
                <div style={{ flex: 1 }}>
                  <p style={{ fontSize: 14, fontWeight: 700, color: "var(--t1)", margin: 0 }}>{selected.name}</p>
                  <p style={{ fontSize: 11, color: "var(--t3)", margin: 0 }}>{memberProjects.map(p => p.name).join(", ") || "Sin miembros"}</p>
                </div>
                <button onClick={() => setShowAddMember(true)} title="Añadir miembro"
                  style={{ display: "flex", alignItems: "center", gap: 5, padding: "6px 11px", borderRadius: 8, border: "1px solid rgba(201,169,97,0.3)", background: "rgba(201,169,97,0.06)", color: "var(--gold)", fontSize: 12, cursor: "pointer" }}>
                  <UserPlus size={13} /> Añadir
                </button>
                <button onClick={() => deleteGroup(selected.id)} title="Eliminar grupo"
                  style={{ display: "flex", alignItems: "center", gap: 5, padding: "6px 11px", borderRadius: 8, border: "1px solid rgba(220,60,60,0.3)", background: "rgba(220,60,60,0.06)", color: "#e84558", fontSize: 12, cursor: "pointer" }}>
                  <Trash2 size={13} />
                </button>
              </div>

              {/* Members chips */}
              {memberProjects.length > 0 && (
                <div style={{ padding: "8px 20px", borderBottom: "1px solid var(--bdr)", display: "flex", gap: 6, flexWrap: "wrap", background: "rgba(255,255,255,0.02)" }}>
                  {memberProjects.map(p => (
                    <div key={p.id} style={{ display: "flex", alignItems: "center", gap: 4, padding: "3px 8px 3px 6px", borderRadius: 20, background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.08)", fontSize: 11, color: "var(--t2)" }}>
                      <span style={{ width: 18, height: 18, borderRadius: "50%", background: "rgba(201,169,97,0.15)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 9, fontWeight: 700, color: "var(--gold)" }}>{p.name[0]?.toUpperCase()}</span>
                      {p.name}
                      <button onClick={() => removeMember(p.id)} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--t3)", padding: 0, display: "flex", alignItems: "center", marginLeft: 2 }}>
                        <X size={10} />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {/* Messages */}
              <div style={{ flex: 1, overflowY: "auto", padding: "18px 20px", display: "flex", flexDirection: "column", gap: 10 }}>
                {loading && msgs.length === 0 ? (
                  <div style={{ display: "flex", justifyContent: "center", alignItems: "center", height: 80 }}>
                    <Loader2 size={20} style={{ color: "var(--gold)", animation: "spin 0.6s linear infinite" }} />
                  </div>
                ) : msgs.length === 0 ? (
                  <div style={{ textAlign: "center", padding: "40px 0" }}>
                    <MessageSquare size={36} style={{ color: "var(--t3)", opacity: 0.3, marginBottom: 12, display: "block", margin: "0 auto 12px" }} />
                    <p style={{ fontSize: 13, color: "var(--t3)" }}>No hay mensajes en este grupo. ¡Di algo!</p>
                  </div>
                ) : msgs.map(msg => {
                  const isAdmin = msg.from_role === "admin";
                  const clientProject = !isAdmin ? projects.find(p => String(p.id) === msg.project_id) : null;
                  return (
                    <div key={msg.id} style={{ display: "flex", justifyContent: isAdmin ? "flex-end" : "flex-start", gap: 8, alignItems: "flex-end" }}>
                      {!isAdmin && (
                        <div style={{ width: 26, height: 26, borderRadius: 7, background: "rgba(45,212,159,0.15)", border: "1px solid rgba(45,212,159,0.2)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 700, color: "var(--jade)", flexShrink: 0 }}>
                          {(msg.from_name ?? "C")[0]?.toUpperCase()}
                        </div>
                      )}
                      <div style={{ maxWidth: "65%" }}>
                        {!isAdmin && <p style={{ fontSize: 10, color: "var(--t3)", margin: "0 0 3px 4px", fontWeight: 500 }}>{clientProject?.name ?? msg.from_name}</p>}
                        <div style={{ padding: "9px 13px", borderRadius: isAdmin ? "14px 14px 4px 14px" : "14px 14px 14px 4px", background: isAdmin ? "linear-gradient(135deg,rgba(201,169,97,0.18),rgba(201,169,97,0.10))" : "rgba(255,255,255,0.05)", border: isAdmin ? "1px solid rgba(201,169,97,0.25)" : "1px solid rgba(255,255,255,0.07)", color: "var(--t1)", fontSize: 13, lineHeight: 1.5, wordBreak: "break-word" }}>
                          <span style={{ whiteSpace: "pre-wrap" }}>{msg.content}</span>
                        </div>
                        <p style={{ fontSize: 10, color: "var(--t3)", margin: "3px 4px 0", textAlign: isAdmin ? "right" : "left" }}>{fmtTime(msg.created_at)}</p>
                      </div>
                      {isAdmin && (
                        <div style={{ width: 26, height: 26, borderRadius: 7, background: "linear-gradient(135deg,rgba(201,169,97,0.2),rgba(201,169,97,0.1))", border: "1px solid rgba(201,169,97,0.3)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 800, color: "var(--gold)", flexShrink: 0 }}>A</div>
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
                  placeholder={`Escribe a todos en "${selected.name}"…`}
                  rows={1}
                  style={{ flex: 1, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 10, color: "var(--t1)", fontSize: 13, padding: "10px 12px", resize: "none", outline: "none", fontFamily: "inherit", lineHeight: 1.5, maxHeight: 120, overflowY: "auto" }}
                />
                <button onClick={send} disabled={!text.trim() || sending}
                  style={{ width: 40, height: 40, borderRadius: 10, background: text.trim() ? "var(--gold)" : "rgba(255,255,255,0.06)", border: "none", cursor: text.trim() ? "pointer" : "not-allowed", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, transition: "all 0.15s" }}>
                  {sending ? <Loader2 size={16} style={{ color: "#0a0a14", animation: "spin 0.6s linear infinite" }} /> : <Send size={15} style={{ color: text.trim() ? "#0a0a14" : "var(--t3)" }} />}
                </button>
              </div>
            </>
          )}
        </div>
      </div>

      {/* ── Create Group Modal ── */}
      {showCreate && (
        <ModalOverlay style={{ background: "rgba(0,0,0,0.6)", backdropFilter: "blur(4px)" }}>
          <div style={{ background: "var(--srf)", border: "1px solid var(--bdr)", borderRadius: 16, padding: 28, width: 440, maxHeight: "80vh", overflowY: "auto" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
              <h3 style={{ fontSize: 16, fontWeight: 700, color: "var(--t1)", margin: 0 }}>Nuevo grupo de chat</h3>
              <button onClick={() => setShowCreate(false)} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--t3)" }}><X size={18} /></button>
            </div>
            <div className="form-group" style={{ marginBottom: 14 }}>
              <label className="form-label">Nombre del grupo *</label>
              <input className="form-input" value={newGroup.name} onChange={e => setNewGroup(prev => ({ ...prev, name: e.target.value }))} placeholder="Ej: Presentación Comic Crafter + Hanakaze" />
            </div>
            <div className="form-group" style={{ marginBottom: 14 }}>
              <label className="form-label">Descripción (opcional)</label>
              <input className="form-input" value={newGroup.description} onChange={e => setNewGroup(prev => ({ ...prev, description: e.target.value }))} placeholder="Conferencia de presentación..." />
            </div>
            <div className="form-group" style={{ marginBottom: 20 }}>
              <label className="form-label">Añadir clientes al grupo</label>
              <div style={{ display: "flex", flexDirection: "column", gap: 6, maxHeight: 200, overflowY: "auto" }}>
                {projects.map(p => {
                  const checked = newGroup.projectIds.includes(p.id);
                  return (
                    <label key={p.id} style={{ display: "flex", alignItems: "center", gap: 8, padding: "7px 10px", borderRadius: 8, border: `1px solid ${checked ? "rgba(201,169,97,0.4)" : "rgba(255,255,255,0.08)"}`, background: checked ? "rgba(201,169,97,0.06)" : "transparent", cursor: "pointer" }}>
                      <input type="checkbox" checked={checked} onChange={e => setNewGroup(prev => ({ ...prev, projectIds: e.target.checked ? [...prev.projectIds, p.id] : prev.projectIds.filter(id => id !== p.id) }))} style={{ accentColor: "var(--gold)" }} />
                      <span style={{ fontSize: 12.5, fontWeight: 500, color: checked ? "var(--gold)" : "var(--t2)" }}>{p.name}</span>
                      <span style={{ fontSize: 11, color: "var(--t3)", marginLeft: "auto" }}>{p.shopDomain}</span>
                    </label>
                  );
                })}
              </div>
            </div>
            <div style={{ display: "flex", gap: 10 }}>
              <button onClick={() => setShowCreate(false)} style={{ flex: 1, padding: "9px 0", borderRadius: 9, border: "1px solid var(--bdr)", background: "transparent", color: "var(--t2)", fontSize: 13, cursor: "pointer" }}>Cancelar</button>
              <button onClick={createGroup} disabled={!newGroup.name.trim()} style={{ flex: 2, padding: "9px 0", borderRadius: 9, border: "none", background: newGroup.name.trim() ? "var(--gold)" : "rgba(255,255,255,0.06)", color: newGroup.name.trim() ? "#0a0a14" : "var(--t3)", fontSize: 13, fontWeight: 700, cursor: newGroup.name.trim() ? "pointer" : "not-allowed" }}>Crear grupo</button>
            </div>
          </div>
        </ModalOverlay>
      )}

      {/* ── Add Member Modal ── */}
      {showAddMember && selected && (
        <ModalOverlay style={{ background: "rgba(0,0,0,0.6)", backdropFilter: "blur(4px)" }}>
          <div style={{ background: "var(--srf)", border: "1px solid var(--bdr)", borderRadius: 16, padding: 28, width: 380, maxHeight: "70vh", overflowY: "auto" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
              <h3 style={{ fontSize: 15, fontWeight: 700, color: "var(--t1)", margin: 0 }}>Añadir cliente al grupo</h3>
              <button onClick={() => setShowAddMember(false)} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--t3)" }}><X size={18} /></button>
            </div>
            {availableToAdd.length === 0 ? (
              <p style={{ fontSize: 13, color: "var(--t3)", textAlign: "center", padding: "20px 0" }}>Todos los clientes ya están en el grupo</p>
            ) : availableToAdd.map(p => (
              <button key={p.id} onClick={() => addMember(p.id)}
                style={{ width: "100%", display: "flex", alignItems: "center", gap: 10, padding: "10px 12px", borderRadius: 9, border: "1px solid rgba(255,255,255,0.08)", background: "transparent", color: "var(--t1)", cursor: "pointer", marginBottom: 6, textAlign: "left" }}>
                <div style={{ width: 32, height: 32, borderRadius: 9, background: "rgba(201,169,97,0.12)", border: "1px solid rgba(201,169,97,0.2)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, fontWeight: 800, color: "var(--gold)" }}>{p.name[0]?.toUpperCase()}</div>
                <div>
                  <p style={{ margin: 0, fontSize: 13, fontWeight: 600 }}>{p.name}</p>
                  <p style={{ margin: 0, fontSize: 11, color: "var(--t3)" }}>{p.shopDomain}</p>
                </div>
                <UserPlus size={14} style={{ marginLeft: "auto", color: "var(--gold)" }} />
              </button>
            ))}
          </div>
        </ModalOverlay>
      )}
    </AppLayout>
  );
}
