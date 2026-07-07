import { useState, useEffect, useRef, useCallback } from "react";
import { useLocation } from "wouter";
import { AppLayout } from "../../components/layout/AppLayout";
import { Send, Loader2, MessageSquare, Search, Paperclip, X, Download, Video, VideoOff, Users } from "lucide-react";

function renderMsgContent(content: string, isAdmin: boolean, onProductNav?: (handle: string) => void) {
  const parts = content.split(/(\[Producto: [^\]]+\]\([^)]+\)|\[Producto: [^\]]+\])/g);
  return parts.map((part, i) => {
    const full   = part.match(/^\[Producto: ([^\]]+)\]\(([^)]+)\)$/);
    const simple = part.match(/^\[Producto: ([^\]]+)\]$/);
    if (full) {
      const handle = full[2].includes("/products/") ? full[2].split("/products/")[1]?.split("?")[0] : null;
      if (onProductNav && handle) {
        return (
          <button key={i} onClick={() => onProductNav(handle)}
            style={{ display: "inline-flex", alignItems: "center", gap: 5, padding: "2px 8px 2px 6px", borderRadius: 6, background: isAdmin ? "rgba(0,0,0,0.18)" : "rgba(201,169,97,0.12)", border: `1px solid ${isAdmin ? "rgba(0,0,0,0.22)" : "rgba(201,169,97,0.3)"}`, color: isAdmin ? "#0a0a14" : "var(--gold)", fontSize: 12, fontWeight: 700, verticalAlign: "middle", marginInline: 2, cursor: "pointer" }}>
            🛍️ {full[1]} <span style={{ fontSize: 10, opacity: 0.7 }}>→ Auditoría</span>
          </button>
        );
      }
      return (
        <a key={i} href={full[2]} target="_blank" rel="noopener noreferrer"
          style={{ display: "inline-flex", alignItems: "center", gap: 5, padding: "2px 8px 2px 6px", borderRadius: 6, background: isAdmin ? "rgba(0,0,0,0.18)" : "rgba(201,169,97,0.12)", border: `1px solid ${isAdmin ? "rgba(0,0,0,0.22)" : "rgba(201,169,97,0.3)"}`, color: isAdmin ? "#0a0a14" : "var(--gold)", textDecoration: "none", fontSize: 12, fontWeight: 700, verticalAlign: "middle", marginInline: 2 }}>
          🛍️ {full[1]}
        </a>
      );
    }
    if (simple) return (
      <span key={i} style={{ display: "inline-flex", alignItems: "center", gap: 5, padding: "2px 8px 2px 6px", borderRadius: 6, background: isAdmin ? "rgba(0,0,0,0.12)" : "rgba(201,169,97,0.08)", color: isAdmin ? "rgba(10,10,20,0.7)" : "var(--t2)", fontSize: 12, fontWeight: 600, verticalAlign: "middle", marginInline: 2 }}>
        🛍️ {simple[1]}
      </span>
    );
    return <span key={i} style={{ whiteSpace: "pre-wrap" }}>{part}</span>;
  });
}

const API = import.meta.env.BASE_URL.replace(/\/$/, "") + "/api";

interface Project { id: number; name: string; shopDomain: string; clientId: string | null; }
interface UnreadEntry { projectId: string; count: number; }
interface FileRef { fileUrl: string; fileName: string; fileType: string; fileSize: number; }

interface Msg {
  id: string; projectId: string; fromRole: "admin" | "client"; fromName: string; content: string; createdAt: string; isRead: number;
  fileUrl?: string; fileName?: string; fileType?: string; fileSize?: number;
  filesJson?: FileRef[] | null;
}
interface PendingFile { fileUrl: string; fileName: string; fileType: string; fileSize: number; previewUrl?: string; }

function fmtTime(d: string) {
  const dt = new Date(d);
  const now = new Date();
  const diffMin = Math.floor((now.getTime() - dt.getTime()) / 60000);
  if (diffMin < 1) return "ahora";
  if (diffMin < 60) return `${diffMin}m`;
  const diffH = Math.floor(diffMin / 60);
  if (diffH < 24) return `${diffH}h`;
  return dt.toLocaleDateString("es-ES", { day: "2-digit", month: "short" });
}

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function fileIcon(fileType: string, fileName: string) {
  const ext = fileName?.split(".").pop()?.toLowerCase() ?? "";
  if (fileType.startsWith("image/")) return "🖼️";
  if (fileType.startsWith("video/")) return "🎬";
  if (fileType.startsWith("audio/")) return "🎵";
  if (["zip", "rar", "7z", "tar", "gz"].includes(ext)) return "🗜️";
  if (["glb", "gltf", "fbx", "obj", "stl"].includes(ext)) return "🧊";
  if (["html", "htm"].includes(ext)) return "🌐";
  if (["txt", "md", "csv"].includes(ext)) return "📝";
  if (["doc", "docx"].includes(ext)) return "📃";
  if (["xls", "xlsx"].includes(ext)) return "📊";
  if (["pdf"].includes(ext)) return "📄";
  return "📎";
}

function FileAttachment({ fileUrl, fileName, fileType, fileSize, isAdmin }: {
  fileUrl: string; fileName: string; fileType: string; fileSize?: number; isAdmin: boolean;
}) {
  const url = fileUrl.startsWith("http") ? fileUrl : `${API.replace("/api", "")}${fileUrl}`;
  const isImage = fileType.startsWith("image/");
  const isVideo = fileType.startsWith("video/");
  const ext = fileName?.split(".").pop()?.toLowerCase() ?? "";
  const isText = ["txt", "md", "html", "htm", "csv"].includes(ext);
  const adminBg = "rgba(201,169,97,0.12)";
  const clientBg = "rgba(255,255,255,0.05)";
  const textColor = isAdmin ? "var(--t1)" : "var(--t1)";
  const mutedColor = "var(--t3)";

  if (isImage) {
    return (
      <div style={{ marginBottom: 4 }}>
        <img src={url} alt={fileName} style={{ maxWidth: 240, maxHeight: 200, borderRadius: 8, display: "block", cursor: "pointer" }} onClick={() => window.open(url, "_blank")} />
        <a href={url} download={fileName} style={{ display: "flex", alignItems: "center", gap: 4, marginTop: 5, fontSize: 11, color: mutedColor, textDecoration: "none" }}>
          <Download size={10} /> {fileName} {fileSize ? `· ${formatBytes(fileSize)}` : ""}
        </a>
      </div>
    );
  }

  if (isVideo) {
    return (
      <div style={{ marginBottom: 4 }}>
        <video src={url} controls style={{ maxWidth: 260, maxHeight: 180, borderRadius: 8, display: "block" }} />
        <a href={url} download={fileName} style={{ display: "flex", alignItems: "center", gap: 4, marginTop: 5, fontSize: 11, color: mutedColor, textDecoration: "none" }}>
          <Download size={10} /> {fileName} {fileSize ? `· ${formatBytes(fileSize)}` : ""}
        </a>
      </div>
    );
  }

  return (
    <a href={isText ? url : url} target={isText ? "_blank" : undefined} rel="noopener noreferrer"
      download={!isText ? fileName : undefined}
      style={{ display: "flex", alignItems: "center", gap: 9, padding: "9px 12px", borderRadius: 9, background: isAdmin ? adminBg : clientBg, textDecoration: "none", marginBottom: 4, border: `1px solid ${isAdmin ? "rgba(201,169,97,0.2)" : "rgba(255,255,255,0.06)"}` }}>
      <span style={{ fontSize: 22, flexShrink: 0 }}>{fileIcon(fileType, fileName)}</span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 12.5, fontWeight: 600, color: textColor, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{fileName}</div>
        <div style={{ fontSize: 10.5, color: mutedColor, marginTop: 1 }}>{fileSize ? formatBytes(fileSize) : ""} · {isText ? "Abrir" : "Descargar"}</div>
      </div>
      <Download size={13} style={{ color: mutedColor, flexShrink: 0 }} />
    </a>
  );
}

export default function AdminMessages() {
  const [, navigate] = useLocation();
  const [projects, setProjects] = useState<Project[]>([]);
  const [unread, setUnread] = useState<Record<string, number>>({});
  const [selected, setSelected] = useState<Project | null>(null);
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [loadingMsgs, setLoadingMsgs] = useState(false);
  const [search, setSearch] = useState("");
  const [pendingFiles, setPendingFiles] = useState<PendingFile[]>([]);
  const [jitsiActive, setJitsiActive] = useState(false);
  const [jitsiRoom, setJitsiRoom] = useState("");
  const [activeCallId, setActiveCallId] = useState<string | null>(null);

  const handleProductNav = useCallback((handle: string) => {
    if (selected) {
      navigate(`/projects/${selected.id}/audit?product=${encodeURIComponent(handle)}`);
    } else {
      navigate(`/admin/products?search=${encodeURIComponent(handle)}`);
    }
  }, [navigate, selected]);
  const bottomRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

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

  useEffect(() => { loadProjects(); const t = setInterval(loadProjects, 10000); return () => clearInterval(t); }, [loadProjects]);

  const loadMsgs = useCallback((projectId: string) => {
    fetch(`${API}/admin/projects/${projectId}/messages`, { credentials: "include" })
      .then(r => r.json())
      .then(d => {
        if (Array.isArray(d)) { setMsgs(d); setUnread(prev => ({ ...prev, [projectId]: 0 })); }
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

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!selected || !e.target.files?.length) return;
    const files = Array.from(e.target.files);
    setUploading(true);
    try {
      const uploaded = await Promise.all(
        files.map(async (f) => {
          const fd = new FormData();
          fd.append("file", f);
          const res = await fetch(`${API}/admin/projects/${selected.id}/messages/upload`, {
            method: "POST", credentials: "include", body: fd,
          });
          if (!res.ok) throw new Error("Upload failed");
          const data = await res.json();
          let previewUrl: string | undefined;
          if (f.type.startsWith("image/") || f.type.startsWith("video/")) previewUrl = URL.createObjectURL(f);
          return { ...data, previewUrl } as PendingFile;
        })
      );
      setPendingFiles(prev => [...prev, ...uploaded]);
    } catch {
      alert("Error al subir uno o más archivos.");
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const send = async () => {
    if ((!text.trim() && pendingFiles.length === 0) || !selected || sending) return;
    setSending(true);
    const filePayload = pendingFiles.length === 1
      ? { fileUrl: pendingFiles[0].fileUrl, fileName: pendingFiles[0].fileName, fileType: pendingFiles[0].fileType, fileSize: pendingFiles[0].fileSize }
      : pendingFiles.length > 1
        ? { filesJson: pendingFiles.map(f => ({ fileUrl: f.fileUrl, fileName: f.fileName, fileType: f.fileType, fileSize: f.fileSize })) }
        : {};
    await fetch(`${API}/admin/projects/${selected.id}/messages`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ content: text.trim() || undefined, ...filePayload }),
    }).catch(() => {});
    setText("");
    pendingFiles.forEach(f => { if (f.previewUrl) URL.revokeObjectURL(f.previewUrl); });
    setPendingFiles([]);
    setSending(false);
    loadMsgs(String(selected.id));
  };

  const filteredProjects = projects.filter(p =>
    p.name?.toLowerCase().includes(search.toLowerCase()) ||
    p.shopDomain?.toLowerCase().includes(search.toLowerCase())
  );

  const startVideoCall = useCallback(async () => {
    if (!selected) return;
    try {
      const res = await fetch(`${API}/admin/video-call/initiate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ projectId: selected.id }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Error iniciando llamada");
      setJitsiRoom(data.jitsiRoom);
      setJitsiActive(true);
      setActiveCallId(data.callId);
      // Open Jitsi in new tab — nested iframe blocks camera/mic in dev preview
      window.open(data.roomUrl, "_blank", "noopener,noreferrer");
      await fetch(`${API}/admin/projects/${selected.id}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ content: `📹 Videollamada iniciada — únete aquí: https://meet.jit.si/${data.jitsiRoom}` }),
      }).catch(() => {});
      loadMsgs(String(selected.id));
    } catch (err: any) {
      alert(err?.message || "Error al iniciar la videollamada");
    }
  }, [selected, loadMsgs]);

  const endVideoCall = useCallback(async () => {
    if (activeCallId) {
      await fetch(`${API}/admin/video-call/${activeCallId}`, { method: "DELETE", credentials: "include" }).catch(() => {});
    }
    setJitsiActive(false);
    setJitsiRoom("");
    setActiveCallId(null);
  }, [activeCallId]);

  return (
    <AppLayout>
      <div style={{ display: "flex", height: "calc(100vh - 6rem)", gap: 0, background: "var(--srf)", border: "1px solid var(--bdr)", borderRadius: 16, overflow: "hidden", boxShadow: "0 4px 24px rgba(0,0,0,0.3)" }}>

        {/* ── LEFT: Client list ── */}
        <div style={{ width: 280, flexShrink: 0, borderRight: "1px solid var(--bdr)", display: "flex", flexDirection: "column" }}>
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
              <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar cliente..."
                style={{ width: "100%", paddingLeft: 28, paddingRight: 10, paddingTop: 7, paddingBottom: 7, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 8, color: "var(--t1)", fontSize: 12, outline: "none", boxSizing: "border-box" }} />
            </div>
          </div>

          <div style={{ flex: 1, overflowY: "auto" }}>
            {filteredProjects.length === 0 ? (
              <div style={{ padding: 24, textAlign: "center", color: "var(--t3)", fontSize: 12 }}>Sin clientes</div>
            ) : filteredProjects.map(p => {
              const unreadN = unread[String(p.id)] ?? 0;
              const isActive = selected?.id === p.id;
              return (
                <div key={p.id} onClick={() => setSelected(p)}
                  style={{ display: "flex", alignItems: "center", gap: 10, padding: "12px 14px", background: isActive ? "rgba(201,169,97,0.07)" : "transparent", borderLeft: isActive ? "3px solid var(--gold)" : "3px solid transparent", borderBottom: "1px solid rgba(255,255,255,0.03)", cursor: "pointer", transition: "all 0.12s" }}
                  onMouseEnter={e => { if (!isActive) e.currentTarget.style.background = "rgba(255,255,255,0.03)"; }}
                  onMouseLeave={e => { if (!isActive) e.currentTarget.style.background = "transparent"; }}>
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
                <div style={{ flex: 1 }}>
                  <p style={{ fontSize: 14, fontWeight: 700, color: "var(--t1)", margin: 0 }}>{selected.name ?? "Tienda sin nombre"}</p>
                  <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                    <div style={{ width: 5, height: 5, borderRadius: "50%", background: "var(--jade)", animation: "pulse 2s infinite" }} />
                    <p style={{ fontSize: 11, color: "var(--t3)", margin: 0 }}>{selected.shopDomain || "Sin dominio"} · Actualiza cada 5s</p>
                  </div>
                </div>
                <button
                  onClick={jitsiActive ? endVideoCall : startVideoCall}
                  title={jitsiActive ? "Finalizar videollamada" : "Iniciar videollamada"}
                  style={{ display: "flex", alignItems: "center", gap: 6, padding: "7px 13px", borderRadius: 9, border: `1px solid ${jitsiActive ? "rgba(220,60,60,0.4)" : "rgba(45,212,159,0.35)"}`, background: jitsiActive ? "rgba(220,60,60,0.08)" : "rgba(45,212,159,0.07)", color: jitsiActive ? "#e84558" : "var(--jade)", fontSize: 12, fontWeight: 600, cursor: "pointer", transition: "all 0.15s" }}>
                  {jitsiActive ? <VideoOff size={14} /> : <Video size={14} />}
                  {jitsiActive ? "Finalizar" : "Videollamada"}
                </button>
              </div>

              {/* Active call status bar */}
              {jitsiActive && jitsiRoom && (
                <div style={{ flexShrink: 0, borderBottom: "1px solid rgba(45,212,159,0.2)", background: "rgba(45,212,159,0.05)", padding: "10px 20px", display: "flex", alignItems: "center", gap: 12 }}>
                  <div style={{ width: 8, height: 8, borderRadius: "50%", background: "#2dd4a0", boxShadow: "0 0 6px #2dd4a0", animation: "pulse 1.5s infinite", flexShrink: 0 }} />
                  <span style={{ fontSize: 13, fontWeight: 600, color: "var(--jade)", flex: 1 }}>Videollamada en curso — el cliente recibió la notificación</span>
                  <a href={`https://meet.jit.si/${jitsiRoom}`} target="_blank" rel="noopener noreferrer"
                    style={{ display: "flex", alignItems: "center", gap: 5, padding: "5px 12px", borderRadius: 20, background: "rgba(45,212,159,0.12)", border: "1px solid rgba(45,212,159,0.35)", color: "#2dd4a0", fontSize: 12, fontWeight: 700, textDecoration: "none" }}>
                    🔗 Reabrir sala
                  </a>
                </div>
              )}

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
                  const isAdminMsg = msg.fromRole === "admin";
                  return (
                    <div key={msg.id} style={{ display: "flex", justifyContent: isAdminMsg ? "flex-end" : "flex-start", gap: 8, alignItems: "flex-end" }}>
                      {!isAdminMsg && (
                        <div style={{ width: 26, height: 26, borderRadius: 7, background: "rgba(45,212,159,0.15)", border: "1px solid rgba(45,212,159,0.2)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 700, color: "var(--jade)", flexShrink: 0 }}>
                          {(msg.fromName ?? "C")[0]?.toUpperCase()}
                        </div>
                      )}
                      <div style={{ maxWidth: "65%" }}>
                        {!isAdminMsg && <p style={{ fontSize: 10, color: "var(--t3)", margin: "0 0 3px 4px", fontWeight: 500 }}>{msg.fromName ?? "Cliente"}</p>}
                        <div style={{
                          padding: msg.fileUrl && !msg.content?.trim() ? "8px 10px" : "9px 13px",
                          borderRadius: isAdminMsg ? "14px 14px 4px 14px" : "14px 14px 14px 4px",
                          background: isAdminMsg ? "linear-gradient(135deg,rgba(201,169,97,0.18),rgba(201,169,97,0.10))" : "rgba(255,255,255,0.05)",
                          border: isAdminMsg ? "1px solid rgba(201,169,97,0.25)" : "1px solid rgba(255,255,255,0.07)",
                          color: "var(--t1)", fontSize: 13, lineHeight: 1.5, wordBreak: "break-word",
                        }}>
                          {(msg.filesJson && msg.filesJson.length > 0) ? (
                            <div style={{ display: "flex", flexDirection: "column", gap: 4, marginBottom: msg.content?.trim() ? 6 : 0 }}>
                              {msg.filesJson.map((f, i) => (
                                <FileAttachment key={i} fileUrl={f.fileUrl} fileName={f.fileName} fileType={f.fileType} fileSize={f.fileSize} isAdmin={isAdminMsg} />
                              ))}
                            </div>
                          ) : msg.fileUrl ? (
                            <FileAttachment fileUrl={msg.fileUrl} fileName={msg.fileName ?? "archivo"} fileType={msg.fileType ?? "application/octet-stream"} fileSize={msg.fileSize} isAdmin={isAdminMsg} />
                          ) : null}
                          {msg.content?.trim() && <span>{renderMsgContent(msg.content, isAdminMsg, handleProductNav)}</span>}
                        </div>
                        <p style={{ fontSize: 10, color: "var(--t3)", margin: "3px 4px 0", textAlign: isAdminMsg ? "right" : "left" }}>{fmtTime(msg.createdAt)}</p>
                      </div>
                      {isAdminMsg && (
                        <div style={{ width: 26, height: 26, borderRadius: 7, background: "linear-gradient(135deg,rgba(201,169,97,0.2),rgba(201,169,97,0.1))", border: "1px solid rgba(201,169,97,0.3)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 800, color: "var(--gold)", flexShrink: 0 }}>
                          A
                        </div>
                      )}
                    </div>
                  );
                })}
                <div ref={bottomRef} />
              </div>

              {/* Pending files preview */}
              {pendingFiles.length > 0 && (
                <div style={{ margin: "0 16px 8px", padding: "8px 10px", background: "rgba(201,169,97,0.06)", border: "1px solid rgba(201,169,97,0.2)", borderRadius: 10 }}>
                  <div style={{ display: "flex", gap: 8, overflowX: "auto", flexWrap: "nowrap" }}>
                    {pendingFiles.map((f, i) => (
                      <div key={i} style={{ position: "relative", flexShrink: 0 }}>
                        {f.previewUrl && f.fileType.startsWith("image/") ? (
                          <img src={f.previewUrl} alt="" style={{ width: 56, height: 56, borderRadius: 8, objectFit: "cover", display: "block", border: "1px solid rgba(201,169,97,0.3)" }} />
                        ) : (
                          <div style={{ width: 56, height: 56, borderRadius: 8, background: "rgba(201,169,97,0.1)", border: "1px solid rgba(201,169,97,0.2)", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 1 }}>
                            <span style={{ fontSize: 20 }}>{fileIcon(f.fileType, f.fileName)}</span>
                            <span style={{ fontSize: 8, color: "var(--t3)", maxWidth: 50, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{f.fileName.split(".").pop()?.toUpperCase()}</span>
                          </div>
                        )}
                        <button onClick={() => { if (f.previewUrl) URL.revokeObjectURL(f.previewUrl); setPendingFiles(prev => prev.filter((_, idx) => idx !== i)); }}
                          style={{ position: "absolute", top: -5, right: -5, width: 17, height: 17, borderRadius: "50%", background: "#e84558", border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", padding: 0 }}>
                          <X size={9} style={{ color: "#fff" }} />
                        </button>
                      </div>
                    ))}
                  </div>
                  <p style={{ fontSize: 10, color: "var(--t3)", marginTop: 5 }}>
                    {pendingFiles.length} archivo{pendingFiles.length !== 1 ? "s" : ""} · {formatBytes(pendingFiles.reduce((a, f) => a + f.fileSize, 0))} total
                  </p>
                </div>
              )}

              {/* Input */}
              <div style={{ padding: "12px 16px", borderTop: "1px solid var(--bdr)", display: "flex", gap: 8, alignItems: "flex-end", flexShrink: 0 }}>
                <input ref={fileInputRef} type="file" multiple style={{ display: "none" }} onChange={handleFileSelect} />
                <button
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploading}
                  title="Adjuntar archivos (máx. 20, ZIP hasta 500MB)"
                  style={{ width: 38, height: 38, borderRadius: 9, border: "1px solid rgba(255,255,255,0.1)", background: pendingFiles.length > 0 ? "rgba(201,169,97,0.12)" : "rgba(255,255,255,0.04)", color: pendingFiles.length > 0 ? "var(--gold)" : "var(--t3)", cursor: uploading ? "not-allowed" : "pointer", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, transition: "all 0.15s", position: "relative" }}>
                  {uploading ? <Loader2 size={14} style={{ animation: "spin 0.6s linear infinite" }} /> : <Paperclip size={14} />}
                  {pendingFiles.length > 0 && (
                    <span style={{ position: "absolute", top: -5, right: -5, width: 16, height: 16, borderRadius: "50%", background: "var(--gold)", color: "#0a0a14", fontSize: 9, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center" }}>
                      {pendingFiles.length}
                    </span>
                  )}
                </button>
                <textarea
                  value={text}
                  onChange={e => setText(e.target.value)}
                  onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }}
                  placeholder={pendingFiles.length > 0 ? "Añade un comentario a los archivos..." : `Escribe a ${selected.name ?? "el cliente"}…`}
                  rows={1}
                  style={{ flex: 1, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 10, color: "var(--t1)", fontSize: 13, padding: "10px 12px", resize: "none", outline: "none", fontFamily: "inherit", lineHeight: 1.5, maxHeight: 120, overflowY: "auto" }}
                />
                <button
                  onClick={send}
                  disabled={(!text.trim() && pendingFiles.length === 0) || sending || uploading}
                  style={{ width: 40, height: 40, borderRadius: 10, background: (text.trim() || pendingFiles.length > 0) ? "var(--gold)" : "rgba(255,255,255,0.06)", border: "none", cursor: (text.trim() || pendingFiles.length > 0) ? "pointer" : "not-allowed", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, transition: "all 0.15s" }}>
                  {sending ? <Loader2 size={16} style={{ color: "#0a0a14", animation: "spin 0.6s linear infinite" }} /> : <Send size={15} style={{ color: (text.trim() || pendingFiles.length > 0) ? "#0a0a14" : "var(--t3)" }} />}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </AppLayout>
  );
}
