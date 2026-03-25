import { useEffect, useState, useRef } from "react";
import { UserPlus, UserCheck, UserX, Loader2, Mail, Copy, CheckCircle, MessageSquare, Send, X, ArrowLeft, ShoppingCart, ExternalLink, AlertCircle, ClipboardList } from "lucide-react";

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

interface Service {
  id: string;
  serviceName: string;
  serviceType: string;
  priceCurrent: number | null;
  priceSuggested: number | null;
  shopifyVariantId: string | null;
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
interface InviteModalProps { onClose: () => void; onInvited: (link: string, email: string, storeName: string) => void; }

interface ProjectOption { id: number; name: string; shopDomain: string; storeNiche: string | null; }

function InviteModal({ onClose, onInvited }: InviteModalProps) {
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [projectId, setProjectId] = useState("");
  const [projects, setProjects] = useState<ProjectOption[]>([]);
  const [loadingProjects, setLoadingProjects] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [inviteResult, setInviteResult] = useState<{ link: string; storeName: string; shopDomain: string; emailSent: boolean } | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    fetch(`${API_BASE}/api/admin/projects-list`, { credentials: "include" })
      .then(r => r.json())
      .then((data: ProjectOption[]) => { setProjects(data); setLoadingProjects(false); })
      .catch(() => setLoadingProjects(false));
  }, []);

  const copyLink = () => {
    if (!inviteResult) return;
    navigator.clipboard.writeText(inviteResult.link).then(() => { setCopied(true); setTimeout(() => setCopied(false), 2500); });
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!projectId) { setError("Selecciona la tienda del cliente"); return; }
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/admin/projects/${projectId}/invite`, {
        method: "POST", headers: { "Content-Type": "application/json" }, credentials: "include",
        body: JSON.stringify({ email, name }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setInviteResult({ link: data.inviteLink, storeName: data.storeName ?? name, shopDomain: data.shopDomain ?? "", emailSent: !!data.emailSent });
      onInvited(data.inviteLink, email, data.storeName ?? name);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Error al invitar");
    } finally { setLoading(false); }
  };

  const selectedProject = projects.find(p => String(p.id) === projectId);

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.80)", backdropFilter: "blur(8px)", zIndex: 500, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
      <div className="modal-box" style={{ maxWidth: 480 }}>
        <p className="modal-title">📨 Invitar Cliente</p>
        <p className="modal-subtitle">El enlace generado es exclusivo e intransferible para esa tienda.</p>

        {inviteResult ? (
          /* ─── Success: show link to copy ─── */
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <div style={{ padding: "12px 14px", background: "rgba(45,212,159,0.08)", border: "1px solid rgba(45,212,159,0.25)", borderRadius: 10 }}>
              <p style={{ margin: "0 0 4px", fontSize: 12, fontWeight: 700, color: "var(--jade)" }}>
                {inviteResult.emailSent ? "📧 Invitación enviada por email a" : "✅ Enlace creado para"} {email}
              </p>
              <p style={{ margin: 0, fontSize: 11, color: "var(--t3)" }}>Tienda: {inviteResult.storeName} · {inviteResult.shopDomain}</p>
              {inviteResult.emailSent && (
                <p style={{ margin: "4px 0 0", fontSize: 10, color: "var(--jade)" }}>El cliente recibirá un email con su enlace de acceso exclusivo.</p>
              )}
            </div>
            <div style={{ padding: "10px 12px", background: "var(--ink2)", borderRadius: 8, border: "1px solid var(--ink3)", wordBreak: "break-all", fontSize: 11, color: "var(--t2)", fontFamily: "monospace" }}>
              {inviteResult.link}
            </div>
            <div style={{ padding: "10px 12px", background: "rgba(255,200,0,0.05)", border: "1px solid rgba(255,200,0,0.15)", borderRadius: 8 }}>
              <p style={{ margin: 0, fontSize: 11, color: "var(--gold)", lineHeight: 1.6 }}>
                ⚠️ <b>Importante:</b> Envía este enlace <b>únicamente</b> al cliente <b>{name}</b> ({email}). Es personal e intransferible — expira en 48 horas y solo funciona para esta tienda.
              </p>
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <button onClick={copyLink} className="btn btn-gold" style={{ flex: 1, justifyContent: "center" }}>
                {copied ? <CheckCircle size={14} /> : <Copy size={14} />}
                {copied ? "¡Copiado!" : "Copiar enlace"}
              </button>
              <button onClick={onClose} className="btn btn-ghost" style={{ flex: 1, justifyContent: "center" }}>Cerrar</button>
            </div>
          </div>
        ) : (
          /* ─── Form ─── */
          <form onSubmit={submit}>
            <div className="form-group">
              <label className="form-label">Nombre del cliente</label>
              <input type="text" className="form-input" value={name} onChange={(e) => setName(e.target.value)} required placeholder="Ej: María García" />
            </div>
            <div className="form-group">
              <label className="form-label">Email del cliente</label>
              <input type="email" className="form-input" value={email} onChange={(e) => setEmail(e.target.value)} required placeholder="cliente@tienda.com" />
            </div>
            <div className="form-group">
              <label className="form-label">Tienda (proyecto)</label>
              {loadingProjects ? (
                <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 14px", background: "var(--ink2)", borderRadius: 8, border: "1px solid var(--bdr)", fontSize: 13, color: "var(--t3)" }}>
                  <Loader2 size={14} style={{ animation: "spin 0.6s linear infinite" }} /> Cargando tiendas...
                </div>
              ) : projects.length === 0 ? (
                <div style={{ padding: "10px 14px", background: "rgba(232,69,88,0.06)", borderRadius: 8, border: "1px solid rgba(232,69,88,0.2)", fontSize: 12, color: "var(--crim)" }}>
                  No hay tiendas creadas aún. Crea un proyecto primero.
                </div>
              ) : (
                <select
                  className="form-input"
                  value={projectId}
                  onChange={(e) => setProjectId(e.target.value)}
                  required
                  style={{ cursor: "pointer" }}
                >
                  <option value="">— Selecciona la tienda —</option>
                  {projects.map(p => (
                    <option key={p.id} value={String(p.id)}>
                      {p.name} · {p.shopDomain}{p.storeNiche ? ` · ${p.storeNiche}` : ""}
                    </option>
                  ))}
                </select>
              )}
            </div>

            {/* Selected project preview */}
            {selectedProject && (
              <div style={{ marginBottom: 14, padding: "8px 12px", background: "rgba(200,168,75,0.06)", border: "1px solid rgba(200,168,75,0.2)", borderRadius: 8, fontSize: 11, color: "var(--t2)" }}>
                <ShoppingCart size={11} style={{ marginRight: 6, verticalAlign: "middle", color: "var(--gold)" }} />
                <b style={{ color: "var(--gold)" }}>{selectedProject.name}</b> · {selectedProject.shopDomain}
                <span style={{ marginLeft: 8, padding: "1px 6px", background: "rgba(200,168,75,0.1)", borderRadius: 10, fontSize: 9, color: "var(--gold)", fontWeight: 700 }}>EXCLUSIVO</span>
              </div>
            )}

            {error && <div style={{ background: "rgba(232,69,88,0.08)", border: "1px solid rgba(232,69,88,0.2)", borderRadius: 8, padding: "8px 12px", color: "var(--crim)", fontSize: 12.5, marginBottom: 14 }}>{error}</div>}

            <div style={{ display: "flex", gap: 8 }}>
              <button type="button" onClick={onClose} className="btn btn-ghost" style={{ flex: 1, justifyContent: "center" }}>Cancelar</button>
              <button type="submit" disabled={loading || projects.length === 0} className={`btn btn-gold${loading ? " loading" : ""}`} style={{ flex: 1, justifyContent: "center" }}>
                {loading ? <Loader2 size={14} className="animate-spin" /> : <Mail size={14} />}
                Generar enlace
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

// ─── Payment Link Modal ───────────────────────────────────────────────────────
interface PaymentLinkModalProps { client: User; onClose: () => void; onSendToChat?: (msg: string) => void; }

function PaymentLinkModal({ client, onClose, onSendToChat }: PaymentLinkModalProps) {
  const [services, setServices] = useState<Service[]>([]);
  const [loadingServices, setLoadingServices] = useState(true);
  const [selectedServiceId, setSelectedServiceId] = useState("");
  const [note, setNote] = useState("");
  const [generating, setGenerating] = useState(false);
  const [result, setResult] = useState<{ checkoutUrl?: string | null; error?: string; requiresMapping?: boolean; service?: { name: string; price: number } } | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    fetch(`${API_BASE}/api/agency/services`, { credentials: "include" })
      .then((r) => r.json())
      .then((d) => { setServices(Array.isArray(d) ? d : []); setLoadingServices(false); });
  }, []);

  const generate = async () => {
    if (!selectedServiceId) return;
    setGenerating(true);
    setResult(null);
    try {
      const res = await fetch(`${API_BASE}/api/agency/payment-link`, {
        method: "POST", headers: { "Content-Type": "application/json" }, credentials: "include",
        body: JSON.stringify({ serviceId: selectedServiceId, clientName: client.name, note }),
      });
      const data = await res.json();
      setResult(data);
    } catch {
      setResult({ error: "Error de red al generar el link" });
    } finally { setGenerating(false); }
  };

  const copy = async (text: string) => {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  const sendViaChat = () => {
    if (!result?.checkoutUrl || !onSendToChat) return;
    const svc = services.find((s) => s.id === selectedServiceId);
    const msg = `💳 Link de pago para ${svc?.serviceName ?? "servicio"} — €${(svc?.priceSuggested ?? svc?.priceCurrent ?? 0).toFixed(0)}/mes:\n${result.checkoutUrl}`;
    onSendToChat(msg);
    onClose();
  };

  const price = (svc: Service) => (svc.priceSuggested ?? svc.priceCurrent ?? 0).toFixed(0);

  const typeLabel: Record<string, string> = {
    setup: "Setup único", retainer: "Retainer/mes", extra: "Extra/único", consultation: "Consultoría",
  };

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.80)", backdropFilter: "blur(8px)", zIndex: 500, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
      <div style={{ width: "100%", maxWidth: 520, background: "var(--srf)", border: "1px solid var(--bdr)", borderRadius: 16, overflow: "hidden" }}>
        {/* Header */}
        <div style={{ padding: "16px 20px", borderBottom: "1px solid var(--bdr)", display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ width: 36, height: 36, borderRadius: 10, background: "rgba(200,168,75,0.12)", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <ShoppingCart size={17} style={{ color: "var(--gold)" }} />
          </div>
          <div style={{ flex: 1 }}>
            <p style={{ fontSize: 14, fontWeight: 700, color: "var(--t)" }}>Generar Link de Pago</p>
            <p style={{ fontSize: 12, color: "var(--t3)" }}>{client.name} · {client.email}</p>
          </div>
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--t3)", display: "flex", padding: 4 }}>
            <X size={16} />
          </button>
        </div>

        <div style={{ padding: 20 }}>
          {/* Service selector */}
          {loadingServices ? (
            <div style={{ display: "flex", alignItems: "center", gap: 8, padding: 16, color: "var(--t3)", fontSize: 13 }}>
              <Loader2 size={16} style={{ animation: "spin 0.6s linear infinite", color: "var(--gold)" }} />
              Cargando servicios...
            </div>
          ) : (
            <div className="form-group" style={{ marginBottom: 14 }}>
              <label className="form-label">Servicio a cobrar</label>
              <select
                className="form-input"
                value={selectedServiceId}
                onChange={(e) => { setSelectedServiceId(e.target.value); setResult(null); }}
              >
                <option value="">— Selecciona un servicio —</option>
                {services.map((svc) => (
                  <option key={svc.id} value={svc.id}>
                    {svc.serviceName} — €{price(svc)} {typeLabel[svc.serviceType] ?? ""}{!svc.shopifyVariantId ? " ⚠ sin vincular" : ""}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div className="form-group" style={{ marginBottom: 18 }}>
            <label className="form-label">Nota interna (opcional)</label>
            <input
              type="text"
              className="form-input"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Ej: Pago mes de abril, 2 tiendas..."
            />
          </div>

          {/* Result */}
          {result && (
            <div style={{
              borderRadius: 10, padding: 14, marginBottom: 16,
              background: result.checkoutUrl ? "rgba(45,212,159,0.06)" : "rgba(200,168,75,0.06)",
              border: `1px solid ${result.checkoutUrl ? "rgba(45,212,159,0.25)" : result.requiresMapping ? "rgba(200,168,75,0.25)" : "rgba(232,69,88,0.25)"}`,
            }}>
              {result.checkoutUrl ? (
                <>
                  <p style={{ fontSize: 12, fontWeight: 600, color: "var(--jade)", marginBottom: 8 }}>
                    ✅ Link generado — {result.service?.name} · €{result.service?.price?.toFixed(0)}
                  </p>
                  <div style={{ display: "flex", alignItems: "center", gap: 6, background: "var(--ink3)", borderRadius: 8, padding: "8px 10px", border: "1px solid var(--bdr)", marginBottom: 10 }}>
                    <code style={{ flex: 1, fontSize: 11, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", color: "var(--t2)" }}>
                      {result.checkoutUrl}
                    </code>
                    <button onClick={() => copy(result.checkoutUrl!)} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--gold)", display: "flex", flexShrink: 0 }}>
                      {copied ? <CheckCircle size={13} style={{ color: "var(--jade)" }} /> : <Copy size={13} />}
                    </button>
                    <a href={result.checkoutUrl} target="_blank" rel="noreferrer" style={{ color: "var(--t3)", display: "flex", flexShrink: 0 }}>
                      <ExternalLink size={13} />
                    </a>
                  </div>
                  <div style={{ display: "flex", gap: 6 }}>
                    <button onClick={() => copy(result.checkoutUrl!)} className="btn btn-jade btn-sm" style={{ flex: 1, justifyContent: "center" }}>
                      {copied ? <CheckCircle size={12} /> : <Copy size={12} />}
                      {copied ? "¡Copiado!" : "Copiar link"}
                    </button>
                    {onSendToChat && client.clientId && (
                      <button onClick={sendViaChat} className="btn btn-gold btn-sm" style={{ flex: 1, justifyContent: "center" }}>
                        <Send size={12} />
                        Enviar por chat
                      </button>
                    )}
                  </div>
                </>
              ) : (
                <div style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
                  <AlertCircle size={16} style={{ color: result.requiresMapping ? "var(--gold)" : "var(--crim)", flexShrink: 0, marginTop: 1 }} />
                  <p style={{ fontSize: 12.5, color: result.requiresMapping ? "var(--gold)" : "var(--crim)", lineHeight: 1.5 }}>
                    {result.error}
                  </p>
                </div>
              )}
            </div>
          )}

          <div style={{ display: "flex", gap: 8 }}>
            <button onClick={onClose} className="btn btn-ghost" style={{ flex: 1, justifyContent: "center" }}>Cerrar</button>
            <button
              onClick={generate}
              disabled={!selectedServiceId || generating}
              className={`btn btn-gold${generating ? " loading" : ""}`}
              style={{ flex: 2, justifyContent: "center" }}
            >
              {generating ? <Loader2 size={14} className="animate-spin" /> : <ShoppingCart size={14} />}
              {generating ? "Generando..." : "Generar link Shopify"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Chat Panel ───────────────────────────────────────────────────────────────
interface SuggestionModalProps { client: User; onClose: () => void; }

function SuggestionModal({ client, onClose }: SuggestionModalProps) {
  const [form, setForm] = useState({ type: "price_change", title: "", description: "", beforeValue: "", afterValue: "", reasoning: "", estimatedImpact: "" });
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const projectId = client.clientId;

  const types = [
    { value: "price_change", label: "Cambio de Precio" },
    { value: "seo_update", label: "Mejora SEO" },
    { value: "product_update", label: "Actualización Producto" },
    { value: "image_change", label: "Cambio de Imagen" },
    { value: "strategy", label: "Estrategia General" },
    { value: "other", label: "Otro" },
  ];

  const [error, setError] = useState("");

  const send = async () => {
    if (!form.title.trim() || !form.description.trim() || !projectId) return;
    setSending(true);
    setError("");
    try {
      const r = await fetch(`${API_BASE}/api/admin/projects/${projectId}/approvals`, {
        method: "POST", headers: { "Content-Type": "application/json" }, credentials: "include",
        body: JSON.stringify(form),
      });
      if (!r.ok) throw new Error(`Error ${r.status}`);
      setSending(false);
      setSent(true);
      setTimeout(onClose, 1500);
    } catch (e: any) {
      setSending(false);
      setError(e.message || "Error al enviar propuesta");
    }
  };

  const inputStyle: React.CSSProperties = {
    width: "100%", background: "rgba(255,255,255,0.03)", border: "1px solid var(--bdr)",
    borderRadius: 8, padding: "8px 11px", fontSize: 13, color: "var(--t1)", outline: "none", fontFamily: "inherit",
  };

  if (sent) {
    return (
      <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.60)", backdropFilter: "blur(4px)", zIndex: 400, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div className="card" style={{ maxWidth: 360, padding: "40px 32px", textAlign: "center" }}>
          <CheckCircle size={40} style={{ color: "var(--jade)", marginBottom: 12 }} />
          <p style={{ fontSize: 15, fontWeight: 600, marginBottom: 6 }}>Propuesta Enviada</p>
          <p style={{ fontSize: 12, color: "var(--t3)" }}>El cliente la verá en su panel de Aprobaciones</p>
        </div>
      </div>
    );
  }

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.60)", backdropFilter: "blur(4px)", zIndex: 400, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
      <div style={{ width: "100%", maxWidth: 520, background: "var(--srf)", border: "1px solid var(--bdr)", borderRadius: 16, overflow: "hidden" }}>
        <div style={{ padding: "14px 16px", borderBottom: "1px solid var(--bdr)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div>
            <p style={{ fontSize: 14, fontWeight: 700 }}>Nueva Propuesta</p>
            <p style={{ fontSize: 11, color: "var(--t3)" }}>Para {client.name} · Proyecto #{projectId}</p>
          </div>
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--t3)", display: "flex" }}><X size={16} /></button>
        </div>

        <div style={{ padding: 16, display: "flex", flexDirection: "column", gap: 12, maxHeight: "65vh", overflowY: "auto" }}>
          <div>
            <label style={{ fontSize: 11, color: "var(--t3)", marginBottom: 4, display: "block" }}>Tipo de propuesta</label>
            <select value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value }))} style={{ ...inputStyle, cursor: "pointer" }}>
              {types.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
          </div>
          <div>
            <label style={{ fontSize: 11, color: "var(--t3)", marginBottom: 4, display: "block" }}>Título *</label>
            <input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} placeholder="Ej: Subir precio del Pack Premium" style={inputStyle} />
          </div>
          <div>
            <label style={{ fontSize: 11, color: "var(--t3)", marginBottom: 4, display: "block" }}>Descripción *</label>
            <textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} rows={3} placeholder="Detalle de la propuesta…" style={{ ...inputStyle, resize: "vertical" }} />
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            <div>
              <label style={{ fontSize: 11, color: "var(--t3)", marginBottom: 4, display: "block" }}>Valor Actual</label>
              <input value={form.beforeValue} onChange={e => setForm(f => ({ ...f, beforeValue: e.target.value }))} placeholder="Ej: $24.99" style={inputStyle} />
            </div>
            <div>
              <label style={{ fontSize: 11, color: "var(--t3)", marginBottom: 4, display: "block" }}>Valor Propuesto</label>
              <input value={form.afterValue} onChange={e => setForm(f => ({ ...f, afterValue: e.target.value }))} placeholder="Ej: $29.99" style={inputStyle} />
            </div>
          </div>
          <div>
            <label style={{ fontSize: 11, color: "var(--t3)", marginBottom: 4, display: "block" }}>Razonamiento</label>
            <textarea value={form.reasoning} onChange={e => setForm(f => ({ ...f, reasoning: e.target.value }))} rows={2} placeholder="¿Por qué recomiendas este cambio?" style={{ ...inputStyle, resize: "vertical" }} />
          </div>
          <div>
            <label style={{ fontSize: 11, color: "var(--t3)", marginBottom: 4, display: "block" }}>Impacto Estimado</label>
            <input value={form.estimatedImpact} onChange={e => setForm(f => ({ ...f, estimatedImpact: e.target.value }))} placeholder="Ej: +12% margen, ~$500/mes adicional" style={inputStyle} />
          </div>
        </div>

        <div style={{ padding: "12px 16px", borderTop: "1px solid var(--bdr)", display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 8 }}>
          {error && <p style={{ fontSize: 11, color: "var(--crim)", marginRight: "auto" }}>{error}</p>}
          <button onClick={onClose} className="btn btn-ghost btn-sm">Cancelar</button>
          <button onClick={send} disabled={sending || !form.title.trim() || !form.description.trim()} className="btn btn-gold btn-sm" style={{ opacity: sending || !form.title.trim() || !form.description.trim() ? 0.5 : 1 }}>
            {sending ? <Loader2 size={12} style={{ animation: "spin 0.6s linear infinite" }} /> : <ClipboardList size={12} />}
            Enviar Propuesta
          </button>
        </div>
      </div>
    </div>
  );
}

interface ChatPanelProps { client: User; onClose: () => void; initialMessage?: string; }

function ChatPanel({ client, onClose, initialMessage }: ChatPanelProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [text, setText] = useState(initialMessage ?? "");
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
      method: "POST", headers: { "Content-Type": "application/json" }, credentials: "include",
      body: JSON.stringify({ content: text.trim() }),
    });
    setText(""); setSending(false); load();
  };

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.60)", backdropFilter: "blur(4px)", zIndex: 400, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
      <div style={{ width: "100%", maxWidth: 540, height: "80vh", maxHeight: 680, background: "var(--srf)", border: "1px solid var(--bdr)", borderRadius: 16, display: "flex", flexDirection: "column", overflow: "hidden" }}>
        {/* Header */}
        <div style={{ padding: "14px 16px", borderBottom: "1px solid var(--bdr)", display: "flex", alignItems: "center", gap: 10 }}>
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--t3)", display: "flex", padding: 4 }}>
            <ArrowLeft size={16} />
          </button>
          <div style={{ width: 34, height: 34, borderRadius: 10, flexShrink: 0, background: client.avatarColor ? `${client.avatarColor}22` : "rgba(200,168,75,0.1)", color: client.avatarColor ?? "var(--gold2)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 700 }}>
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
            <div style={{ textAlign: "center", padding: 32, color: "var(--t3)", fontSize: 13 }}>Este cliente no tiene un proyecto asignado.</div>
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
                      {!isAdmin && <p style={{ fontSize: 10, color: "var(--t3)", marginBottom: 3, marginLeft: 2 }}>{msg.fromName}</p>}
                      <div style={{
                        padding: "8px 12px",
                        borderRadius: isAdmin ? "12px 12px 2px 12px" : "12px 12px 12px 2px",
                        background: isAdmin ? "linear-gradient(135deg,var(--gold) 0%,var(--gold2) 100%)" : "var(--ink3)",
                        border: isAdmin ? "none" : "1px solid var(--bdr)",
                        fontSize: 13, color: isAdmin ? "#0a0a14" : "var(--t1)", fontWeight: isAdmin ? 500 : 400, lineHeight: 1.5,
                        whiteSpace: "pre-wrap", wordBreak: "break-word",
                      }}>
                        {msg.content}
                      </div>
                      <p style={{ fontSize: 10, color: "var(--t3)", marginTop: 2, textAlign: isAdmin ? "right" : "left", marginRight: isAdmin ? 2 : 0, marginLeft: isAdmin ? 0 : 2 }}>
                        {formatTime(msg.createdAt)}{isAdmin && <span style={{ marginLeft: 4, opacity: 0.7 }}>· Tú</span>}
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
          <div style={{ padding: "10px 12px", borderTop: "1px solid var(--bdr)", display: "flex", gap: 8, alignItems: "flex-end" }}>
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && (e.preventDefault(), send())}
              placeholder={`Mensaje a ${client.name.split(" ")[0]}...`}
              rows={text.split("\n").length > 2 ? 3 : 1}
              style={{
                flex: 1, background: "rgba(255,255,255,0.03)", border: "1px solid var(--bdr)",
                borderRadius: 9, padding: "9px 13px", fontSize: 13, color: "var(--t1)", outline: "none",
                resize: "none", lineHeight: 1.5, fontFamily: "inherit",
              }}
              onFocus={(e) => { e.target.style.borderColor = "var(--gold)"; }}
              onBlur={(e) => { e.target.style.borderColor = "var(--bdr)"; }}
            />
            <button onClick={send} disabled={sending || !text.trim()} style={{
              width: 38, height: 38, borderRadius: 9, border: "none",
              background: "linear-gradient(135deg,var(--gold) 0%,var(--gold2) 100%)",
              color: "#0a0a14", cursor: sending || !text.trim() ? "not-allowed" : "pointer",
              opacity: sending || !text.trim() ? 0.5 : 1, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
            }}>
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
  const [inviteLink, setInviteLink] = useState<{ link: string; email: string; storeName?: string } | null>(null);
  const [copied, setCopied] = useState(false);
  const [processing, setProcessing] = useState<string | null>(null);
  const [chatClient, setChatClient] = useState<User | null>(null);
  const [chatInitialMsg, setChatInitialMsg] = useState<string | undefined>(undefined);
  const [paymentClient, setPaymentClient] = useState<User | null>(null);
  const [suggestionClient, setSuggestionClient] = useState<User | null>(null);

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
    setProcessing(null); load();
  };

  const copyLink = async (link: string) => {
    await navigator.clipboard.writeText(link);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const openPaymentForChat = (client: User, msg: string) => {
    setChatInitialMsg(msg);
    setChatClient(client);
  };

  const clients = users.filter((u) => u.role === "client");

  return (
    <>
      {showInvite && (
        <InviteModal
          onClose={() => setShowInvite(false)}
          onInvited={(link, email, storeName) => { setShowInvite(false); setInviteLink({ link, email, storeName }); load(); }}
        />
      )}
      {paymentClient && (
        <PaymentLinkModal
          client={paymentClient}
          onClose={() => setPaymentClient(null)}
          onSendToChat={paymentClient.clientId ? (msg) => openPaymentForChat(paymentClient, msg) : undefined}
        />
      )}
      {chatClient && (
        <ChatPanel
          client={chatClient}
          onClose={() => { setChatClient(null); setChatInitialMsg(undefined); }}
          initialMessage={chatInitialMsg}
        />
      )}
      {suggestionClient && (
        <SuggestionModal
          client={suggestionClient}
          onClose={() => setSuggestionClient(null)}
        />
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
          <div style={{ background: "rgba(45,212,159,0.05)", border: "1px solid rgba(45,212,159,0.2)", borderRadius: "var(--r3)", padding: 16, display: "flex", alignItems: "flex-start", gap: 12, marginBottom: 20 }}>
            <CheckCircle size={18} style={{ color: "var(--jade)", flexShrink: 0, marginTop: 1 }} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{ fontSize: 13, fontWeight: 600, marginBottom: 4 }}>Invitación creada para {inviteLink.email}{inviteLink.storeName ? ` — ${inviteLink.storeName}` : ""}</p>
              <p style={{ fontSize: 11.5, color: "var(--jade)", marginBottom: 8 }}>Enlace exclusivo e intransferible (expira en 48h):</p>
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
                      <div style={{ display: "flex", gap: 5, justifyContent: "flex-end", flexWrap: "wrap" }}>
                        <button
                          onClick={() => setPaymentClient(u)}
                          className="btn btn-sm btn-ghost"
                          title="Generar link de pago Shopify"
                          style={{ borderColor: "rgba(200,168,75,0.25)", color: "var(--gold)" }}
                        >
                          <ShoppingCart size={11} />
                          Cobrar
                        </button>
                        {u.clientId && (
                          <>
                            <button onClick={() => { setChatInitialMsg(undefined); setChatClient(u); }} className="btn btn-sm btn-ghost" title="Ver mensajes">
                              <MessageSquare size={11} />
                              Chat
                            </button>
                            <button onClick={() => setSuggestionClient(u)} className="btn btn-sm btn-ghost" title="Enviar propuesta al cliente" style={{ borderColor: "rgba(45,212,159,0.25)", color: "var(--jade)" }}>
                              <ClipboardList size={11} />
                              Propuesta
                            </button>
                          </>
                        )}
                        <button
                          onClick={() => toggleActive(u)}
                          disabled={processing === u.id}
                          className={`btn btn-sm ${u.isActive ? "btn-danger" : "btn-jade"}`}
                        >
                          {processing === u.id ? <Loader2 size={11} className="animate-spin" /> : u.isActive ? <UserX size={11} /> : <UserCheck size={11} />}
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
