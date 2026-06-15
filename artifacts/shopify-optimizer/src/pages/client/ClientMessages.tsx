import { useEffect, useState, useRef, useCallback } from "react";
import { ClientLayout } from "./ClientLayout";
import { useAuth } from "@/contexts/AuthContext";
import { useCmsSection } from "@/contexts/CmsContext";
import { useClientPreview } from "./ClientPreviewContext";
import { Send, Loader2, Paperclip, X, Download, Package, Search } from "lucide-react";

const API_BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

interface Message {
  id: string;
  fromRole: "admin" | "client";
  fromName: string;
  content: string;
  isRead: number;
  createdAt: string;
  fileUrl?: string;
  fileName?: string;
  fileType?: string;
  fileSize?: number;
}

interface Product {
  id: number;
  title: string;
  price: string | null;
  auditScore: number | null;
}

interface PendingFile {
  fileUrl: string;
  fileName: string;
  fileType: string;
  fileSize: number;
  previewUrl?: string;
}

function formatTime(dateStr: string) {
  const d = new Date(dateStr);
  return d.toLocaleString("es-ES", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
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
  if (fileType === "application/pdf" || ext === "pdf") return "📄";
  if (["zip", "rar", "7z", "tar", "gz"].includes(ext)) return "🗜️";
  if (["glb", "gltf", "fbx", "obj", "stl"].includes(ext)) return "🧊";
  if (["html", "htm"].includes(ext)) return "🌐";
  if (["txt", "md"].includes(ext)) return "📝";
  if (["doc", "docx"].includes(ext)) return "📝";
  if (["xls", "xlsx", "csv"].includes(ext)) return "📊";
  return "📎";
}

function FileAttachment({ fileUrl, fileName, fileType, fileSize, isOwn }: {
  fileUrl: string; fileName: string; fileType: string; fileSize?: number; isOwn: boolean;
}) {
  const url = fileUrl.startsWith("http") ? fileUrl : `${API_BASE}${fileUrl}`;
  const isImage = fileType.startsWith("image/");
  const isVideo = fileType.startsWith("video/");
  const ext = fileName?.split(".").pop()?.toLowerCase() ?? "";
  const isText = ["txt", "md", "html", "htm", "csv"].includes(ext);
  const textColor = isOwn ? "#0a0a14" : "var(--t1)";
  const mutedColor = isOwn ? "rgba(10,10,20,0.6)" : "var(--t3)";

  if (isImage) {
    return (
      <div style={{ marginBottom: 4 }}>
        <img
          src={url}
          alt={fileName}
          style={{ maxWidth: 240, maxHeight: 200, borderRadius: 8, display: "block", cursor: "pointer" }}
          onClick={() => window.open(url, "_blank")}
        />
        <a href={url} download={fileName}
          style={{ display: "flex", alignItems: "center", gap: 4, marginTop: 5, fontSize: 11, color: mutedColor, textDecoration: "none" }}>
          <Download size={10} /> {fileName} {fileSize ? `· ${formatBytes(fileSize)}` : ""}
        </a>
      </div>
    );
  }

  if (isVideo) {
    return (
      <div style={{ marginBottom: 4 }}>
        <video src={url} controls style={{ maxWidth: 260, maxHeight: 180, borderRadius: 8, display: "block" }} />
        <a href={url} download={fileName}
          style={{ display: "flex", alignItems: "center", gap: 4, marginTop: 5, fontSize: 11, color: mutedColor, textDecoration: "none" }}>
          <Download size={10} /> {fileName} {fileSize ? `· ${formatBytes(fileSize)}` : ""}
        </a>
      </div>
    );
  }

  if (isText) {
    return (
      <a href={url} target="_blank" rel="noopener noreferrer"
        style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 10px", borderRadius: 8, background: isOwn ? "rgba(0,0,0,0.15)" : "rgba(255,255,255,0.05)", textDecoration: "none", marginBottom: 4 }}>
        <span style={{ fontSize: 20 }}>{fileIcon(fileType, fileName)}</span>
        <div>
          <div style={{ fontSize: 12, fontWeight: 600, color: textColor }}>{fileName}</div>
          <div style={{ fontSize: 10, color: mutedColor }}>{fileSize ? formatBytes(fileSize) : ""} · Abrir</div>
        </div>
      </a>
    );
  }

  return (
    <a href={url} download={fileName}
      style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 10px", borderRadius: 8, background: isOwn ? "rgba(0,0,0,0.15)" : "rgba(255,255,255,0.05)", textDecoration: "none", marginBottom: 4 }}>
      <span style={{ fontSize: 20 }}>{fileIcon(fileType, fileName)}</span>
      <div>
        <div style={{ fontSize: 12, fontWeight: 600, color: textColor }}>{fileName}</div>
        <div style={{ fontSize: 10, color: mutedColor }}>{fileSize ? formatBytes(fileSize) : ""} · Descargar</div>
      </div>
      <Download size={13} style={{ marginLeft: "auto", color: mutedColor, flexShrink: 0 }} />
    </a>
  );
}

export default function ClientMessages() {
  const { user } = useAuth();
  const { previewPid } = useClientPreview();
  const isAdmin = user?.role === "admin";
  const apid = useCallback((url: string) =>
    isAdmin && previewPid ? `${url}${url.includes("?") ? "&" : "?"}pid=${encodeURIComponent(previewPid)}` : url,
    [isAdmin, previewPid]);

  const { t } = useCmsSection("labels.clientMessages");
  const [messages, setMessages] = useState<Message[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [productSearch, setProductSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [pendingFile, setPendingFile] = useState<PendingFile | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const textInputRef = useRef<HTMLInputElement>(null);

  const loadMessages = useCallback(() => {
    fetch(apid(`${API_BASE}/api/client/messages`), { credentials: "include" })
      .then(r => r.json())
      .then(d => { setMessages(Array.isArray(d) ? d : []); setLoading(false); });
  }, [apid]);

  const loadProducts = useCallback(() => {
    fetch(apid(`${API_BASE}/api/client/products`), { credentials: "include" })
      .then(r => r.json())
      .then(d => { if (Array.isArray(d)) setProducts(d); })
      .catch(() => {});
  }, [apid]);

  useEffect(() => {
    loadMessages();
    loadProducts();
    const iv = setInterval(loadMessages, 15000);
    return () => clearInterval(iv);
  }, [loadMessages, loadProducts]);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!e.target.files) return;
    const files = Array.from(e.target.files);
    if (!files.length) return;
    const f = files[0];
    if (!f) return;
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", f);
      const res = await fetch(apid(`${API_BASE}/api/client/messages/upload`), {
        method: "POST",
        credentials: "include",
        body: fd,
      });
      if (!res.ok) throw new Error("Upload failed");
      const data = await res.json();
      let previewUrl: string | undefined;
      if (f.type.startsWith("image/") || f.type.startsWith("video/")) {
        previewUrl = URL.createObjectURL(f);
      }
      setPendingFile({ ...data, previewUrl });
    } catch {
      alert("Error al subir el archivo. Inténtalo de nuevo.");
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const send = async () => {
    if ((!text.trim() && !pendingFile) || sending) return;
    setSending(true);
    await fetch(apid(`${API_BASE}/api/client/messages`), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({
        content: text.trim() || undefined,
        fileUrl: pendingFile?.fileUrl,
        fileName: pendingFile?.fileName,
        fileType: pendingFile?.fileType,
        fileSize: pendingFile?.fileSize,
      }),
    });
    setText("");
    if (pendingFile?.previewUrl) URL.revokeObjectURL(pendingFile.previewUrl);
    setPendingFile(null);
    setSending(false);
    loadMessages();
  };

  const insertProduct = (p: Product) => {
    const ref = `[Producto: ${p.title}]`;
    setText(prev => prev ? `${prev} ${ref}` : ref);
    textInputRef.current?.focus();
  };

  const filteredProducts = products.filter(p =>
    p.title?.toLowerCase().includes(productSearch.toLowerCase())
  );

  const scoreColor = (s: number | null) => {
    if (s === null) return "var(--t4)";
    if (s >= 70) return "var(--jade)";
    if (s >= 40) return "#f59e0b";
    return "#ef4444";
  };

  return (
    <ClientLayout>
      <div style={{ marginBottom: 16 }}>
        <h1 style={{ fontFamily: "var(--fh)", fontStyle: "italic", fontSize: 24, fontWeight: 400, marginBottom: 2 }}>
          {t("title", "Mensajes")}
        </h1>
        <p style={{ fontSize: 12, color: "var(--t3)" }}>{t("subtitle", "Comunicación directa con tu agencia.")}</p>
      </div>

      <div style={{ display: "flex", gap: 0, height: "calc(100vh - 10rem)", width: "100%", maxWidth: "100%" }}>

        {/* ── LEFT: Product Selector ── */}
        <div style={{
          width: 272, flexShrink: 0,
          background: "var(--srf)", border: "1px solid var(--bdr)",
          borderRadius: "14px 0 0 14px", borderRight: "none",
          display: "flex", flexDirection: "column", overflow: "hidden",
        }}>
          <div style={{ padding: "14px 14px 10px", borderBottom: "1px solid var(--bdr)" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 10 }}>
              <Package size={14} style={{ color: "var(--gold)" }} />
              <span style={{ fontSize: 12.5, fontWeight: 700, color: "var(--t1)" }}>Productos</span>
              <span style={{ marginLeft: "auto", fontSize: 10, color: "var(--t3)" }}>Clic para referenciar</span>
            </div>
            <div style={{ position: "relative" }}>
              <Search size={11} style={{ position: "absolute", left: 8, top: "50%", transform: "translateY(-50%)", color: "var(--t3)" }} />
              <input
                value={productSearch}
                onChange={e => setProductSearch(e.target.value)}
                placeholder="Buscar producto..."
                style={{
                  width: "100%", paddingLeft: 26, paddingRight: 8, paddingTop: 6, paddingBottom: 6,
                  background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)",
                  borderRadius: 7, color: "var(--t1)", fontSize: 11.5, outline: "none", boxSizing: "border-box",
                }}
              />
            </div>
          </div>

          <div style={{ flex: 1, overflowY: "auto", padding: "6px 8px" }}>
            {filteredProducts.length === 0 ? (
              <div style={{ padding: "24px 8px", textAlign: "center", color: "var(--t3)", fontSize: 11.5 }}>
                {products.length === 0 ? "Sin productos aún" : "Sin coincidencias"}
              </div>
            ) : filteredProducts.map(p => (
              <button
                key={p.id}
                onClick={() => insertProduct(p)}
                style={{
                  width: "100%", display: "flex", alignItems: "center", gap: 9,
                  padding: "9px 10px", borderRadius: 9, border: "none",
                  background: "transparent", cursor: "pointer", textAlign: "left",
                  transition: "background 0.12s", marginBottom: 2,
                }}
                onMouseEnter={e => { e.currentTarget.style.background = "rgba(201,169,97,0.07)"; }}
                onMouseLeave={e => { e.currentTarget.style.background = "transparent"; }}
              >
                <div style={{
                  width: 32, height: 32, borderRadius: 8, flexShrink: 0,
                  background: "rgba(201,169,97,0.1)", border: "1px solid rgba(201,169,97,0.2)",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: 13,
                }}>🛍️</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{
                    fontSize: 11.5, fontWeight: 600, color: "var(--t1)",
                    whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
                  }}>{p.title}</div>
                  <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 1 }}>
                    {p.price && <span style={{ fontSize: 10, color: "var(--t3)" }}>{p.price}€</span>}
                    {p.auditScore !== null && (
                      <span style={{ fontSize: 9.5, fontWeight: 700, color: scoreColor(p.auditScore) }}>
                        ● {p.auditScore}
                      </span>
                    )}
                  </div>
                </div>
              </button>
            ))}
          </div>

          <div style={{ padding: "10px 12px", borderTop: "1px solid var(--bdr)" }}>
            <p style={{ fontSize: 10, color: "var(--t4)", lineHeight: 1.5 }}>
              💡 Selecciona un producto para incluirlo en tu mensaje y que la agencia sepa a cuál te refieres.
            </p>
          </div>
        </div>

        {/* ── RIGHT: Chat ── */}
        <div style={{
          flex: 1, background: "var(--srf)", border: "1px solid var(--bdr)",
          borderRadius: "0 14px 14px 0", overflow: "hidden",
          display: "flex", flexDirection: "column", minWidth: 0,
        }}>
          {/* Chat header */}
          <div style={{
            padding: "12px 16px", borderBottom: "1px solid var(--bdr)",
            display: "flex", alignItems: "center", gap: 10, flexShrink: 0,
          }}>
            <div style={{
              width: 34, height: 34, borderRadius: 10,
              background: "linear-gradient(135deg,var(--gold) 0%,var(--gold2) 100%)",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 14, fontWeight: 800, color: "#0a0a14", flexShrink: 0,
            }}>A</div>
            <div>
              <p style={{ fontSize: 13, fontWeight: 700 }}>{t("agencyName", "Tu Agencia")}</p>
              <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                <div className="status-pulse" style={{ width: 5, height: 5, background: "var(--jade)", flexShrink: 0 }} />
                <p style={{ fontSize: 11, color: "var(--t3)" }}>{t("agencyStatus", "En línea · Respuesta en <24h")}</p>
              </div>
            </div>
          </div>

          {/* Messages */}
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
                {messages.map(msg => {
                  const isOwn = msg.fromRole === "client";
                  return (
                    <div key={msg.id} style={{ display: "flex", justifyContent: isOwn ? "flex-end" : "flex-start" }}>
                      <div style={{ maxWidth: "72%" }}>
                        {!isOwn && (
                          <p style={{ fontSize: 10, color: "var(--t3)", marginBottom: 3, marginLeft: 2 }}>{msg.fromName}</p>
                        )}
                        <div style={{
                          padding: msg.fileUrl && !msg.content?.trim() ? "8px 10px" : "9px 13px",
                          borderRadius: isOwn ? "12px 12px 2px 12px" : "12px 12px 12px 2px",
                          background: isOwn
                            ? "linear-gradient(135deg,var(--gold) 0%,var(--gold2) 100%)"
                            : "var(--ink3)",
                          border: isOwn ? "none" : "1px solid var(--bdr)",
                          fontSize: 13.5,
                          color: isOwn ? "#0a0a14" : "var(--t1)",
                          fontWeight: isOwn ? 500 : 400,
                          lineHeight: 1.5,
                        }}>
                          {msg.fileUrl && (
                            <FileAttachment
                              fileUrl={msg.fileUrl}
                              fileName={msg.fileName ?? "archivo"}
                              fileType={msg.fileType ?? "application/octet-stream"}
                              fileSize={msg.fileSize}
                              isOwn={isOwn}
                            />
                          )}
                          {msg.content?.trim() && <span>{msg.content}</span>}
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

          {/* Pending file preview */}
          {pendingFile && (
            <div style={{
              margin: "0 12px 6px", padding: "8px 12px",
              background: "rgba(201,169,97,0.08)", border: "1px solid rgba(201,169,97,0.2)",
              borderRadius: 10, display: "flex", alignItems: "center", gap: 10,
            }}>
              {pendingFile.previewUrl && pendingFile.fileType.startsWith("image/") && (
                <img src={pendingFile.previewUrl} alt="" style={{ width: 44, height: 44, borderRadius: 6, objectFit: "cover", flexShrink: 0 }} />
              )}
              {!pendingFile.previewUrl || !pendingFile.fileType.startsWith("image/") ? (
                <span style={{ fontSize: 24, flexShrink: 0 }}>{fileIcon(pendingFile.fileType, pendingFile.fileName)}</span>
              ) : null}
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ fontSize: 12, fontWeight: 600, color: "var(--t1)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{pendingFile.fileName}</p>
                <p style={{ fontSize: 10, color: "var(--t3)" }}>{formatBytes(pendingFile.fileSize)}</p>
              </div>
              <button onClick={() => { if (pendingFile.previewUrl) URL.revokeObjectURL(pendingFile.previewUrl); setPendingFile(null); }}
                style={{ background: "none", border: "none", cursor: "pointer", color: "var(--t3)", padding: 2 }}>
                <X size={14} />
              </button>
            </div>
          )}

          {/* Input area */}
          <div style={{
            padding: "10px 12px", borderTop: "1px solid var(--bdr)",
            display: "flex", gap: 8, alignItems: "center", flexShrink: 0,
          }}>
            <input
              ref={fileInputRef}
              type="file"
              multiple={false}
              style={{ display: "none" }}
              onChange={handleFileSelect}
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              title="Adjuntar archivo"
              style={{
                width: 36, height: 36, borderRadius: 9, border: "1px solid var(--bdr)",
                background: pendingFile ? "rgba(201,169,97,0.12)" : "rgba(255,255,255,0.04)",
                color: pendingFile ? "var(--gold)" : "var(--t3)",
                cursor: uploading ? "not-allowed" : "pointer",
                display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
                transition: "all 0.15s",
              }}
            >
              {uploading
                ? <Loader2 size={14} style={{ animation: "spin 0.6s linear infinite" }} />
                : <Paperclip size={14} />}
            </button>
            <input
              ref={textInputRef}
              value={text}
              onChange={e => setText(e.target.value)}
              onKeyDown={e => e.key === "Enter" && !e.shiftKey && send()}
              placeholder={pendingFile ? "Añade un comentario al archivo..." : t("placeholder", "Escribe tu mensaje...")}
              style={{
                flex: 1, background: "rgba(255,255,255,0.03)", border: "1px solid var(--bdr)",
                borderRadius: 10, padding: "10px 14px", fontSize: 13.5, color: "var(--t1)",
                outline: "none", transition: "border-color 0.15s",
              }}
              onFocus={e => { e.target.style.borderColor = "var(--gold)"; }}
              onBlur={e => { e.target.style.borderColor = "var(--bdr)"; }}
            />
            <button
              onClick={send}
              disabled={sending || uploading || (!text.trim() && !pendingFile)}
              style={{
                width: 40, height: 40, borderRadius: 10, border: "none",
                background: "linear-gradient(135deg,var(--gold) 0%,var(--gold2) 100%)",
                color: "#0a0a14",
                cursor: (sending || uploading || (!text.trim() && !pendingFile)) ? "not-allowed" : "pointer",
                opacity: (sending || uploading || (!text.trim() && !pendingFile)) ? 0.5 : 1,
                display: "flex", alignItems: "center", justifyContent: "center",
                flexShrink: 0, transition: "opacity 0.15s",
              }}
            >
              {sending
                ? <Loader2 size={15} style={{ animation: "spin 0.6s linear infinite" }} />
                : <Send size={15} />}
            </button>
          </div>
        </div>
      </div>
    </ClientLayout>
  );
}
