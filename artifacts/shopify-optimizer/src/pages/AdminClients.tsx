import { useEffect, useState, useRef, useCallback } from "react";
import { UserPlus, UserCheck, UserX, Loader2, Mail, Copy, CheckCircle, MessageSquare, Send, X, ArrowLeft, ShoppingCart, ExternalLink, AlertCircle, ClipboardList, Eye, CreditCard, Sparkles, ChevronRight, ChevronLeft, RotateCcw, DollarSign, TrendingUp, TrendingDown, Minus, Activity, Zap, BarChart2, Trash2 } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend } from "recharts";
import { timeSince } from "@/lib/utils";
import { getModelShortName } from "@/lib/model-aliases";
import { useModalLock } from "@/hooks/use-modal-lock";

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

function formatTime(dateStr: string) {
  const d = new Date(dateStr);
  return d.toLocaleString("es-ES", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
}

// ─── Invite Modal ─────────────────────────────────────────────────────────────
interface InviteModalProps { onClose: () => void; onInvited: (link: string, email: string, storeName: string) => void; }

interface ProjectOption { id: number; name: string; shopDomain: string; storeNiche: string | null; }

function InviteModal({ onClose, onInvited }: InviteModalProps) {
  useModalLock();
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [projectId, setProjectId] = useState("");
  const [projects, setProjects] = useState<ProjectOption[]>([]);
  const [loadingProjects, setLoadingProjects] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [inviteResult, setInviteResult] = useState<{ link: string; storeName: string; shopDomain: string; emailSent: boolean; message: string } | null>(null);
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
    setError("");
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/admin/projects/${projectId}/invite`, {
        method: "POST", headers: { "Content-Type": "application/json" }, credentials: "include",
        body: JSON.stringify({ email, name }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setInviteResult({ link: data.inviteLink, storeName: data.storeName ?? name, shopDomain: data.shopDomain ?? "", emailSent: !!data.emailSent, message: String(data.message ?? "") });
      onInvited(data.inviteLink, email, data.storeName ?? name);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Error al invitar");
    } finally { setLoading(false); }
  };

  const selectedProject = projects.find(p => String(p.id) === projectId);

  return (
    <div className="modal-overlay" style={{ backdropFilter: "blur(8px)" }}>
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
              {inviteResult.emailSent ? (
                <p style={{ margin: "4px 0 0", fontSize: 10, color: "var(--jade)" }}>El cliente recibirá un email con su enlace de acceso exclusivo.</p>
              ) : inviteResult.message ? (
                <p style={{ margin: "4px 0 0", fontSize: 10, color: "var(--gold)" }}>{inviteResult.message}</p>
              ) : null}
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
  useModalLock();
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
      .then((d) => { setServices(Array.isArray(d) ? d : []); setLoadingServices(false); })
      .catch(() => setLoadingServices(false));
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
    <div className="modal-overlay" style={{ backdropFilter: "blur(8px)" }}>
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
              {generating ? "Generando..." : "Generar link de pago"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Chat Panel ───────────────────────────────────────────────────────────────
interface AiSuggestion {
  type: string; title: string; description: string;
  beforeValue?: string; afterValue?: string; reasoning?: string; estimatedImpact?: string;
}

interface SuggestionModalProps { client: User; onClose: () => void; }

function SuggestionModal({ client, onClose }: SuggestionModalProps) {
  useModalLock();
  const [mode, setMode] = useState<"choose" | "manual" | "ai">("choose");
  const [form, setForm] = useState({ type: "price_change", title: "", description: "", beforeValue: "", afterValue: "", reasoning: "", estimatedImpact: "" });
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");
  const [aiLoading, setAiLoading] = useState(false);
  const [aiSuggestions, setAiSuggestions] = useState<AiSuggestion[]>([]);
  const [aiError, setAiError] = useState("");
  const projectId = client.clientId;

  const types = [
    { value: "price_change", label: "Cambio de Precio" },
    { value: "seo_update", label: "Mejora SEO" },
    { value: "product_update", label: "Actualización Producto" },
    { value: "image_change", label: "Cambio de Imagen" },
    { value: "strategy", label: "Estrategia General" },
    { value: "other", label: "Otro" },
  ];

  const typeLabels: Record<string, string> = {
    price_change: "Precio", seo_update: "SEO", product_update: "Producto",
    strategy: "Estrategia", image_change: "Imagen", other: "Otro",
  };

  const analyzeWithAI = async () => {
    if (!projectId) return;
    setAiLoading(true); setAiError(""); setAiSuggestions([]);
    try {
      // El endpoint es POST (antes GET → 404 "Error 404").
      const r = await fetch(`${API_BASE}/api/admin/projects/${projectId}/ai-suggest`, { method: "POST", credentials: "include" });
      if (!r.ok) {
        const body = await r.json().catch(() => ({}));
        throw new Error(body.error || `Error ${r.status}`);
      }
      const data = await r.json();
      setAiSuggestions(data.suggestions ?? []);
      if (!data.suggestions?.length) setAiError("No se encontraron productos para analizar. Sincroniza la tienda primero.");
    } catch (e: any) {
      setAiError(e.message || "Error al analizar con IA");
    } finally {
      setAiLoading(false);
    }
  };

  const useSuggestion = (s: AiSuggestion) => {
    setForm({ type: s.type || "strategy", title: s.title || "", description: s.description || "",
      beforeValue: s.beforeValue || "", afterValue: s.afterValue || "",
      reasoning: s.reasoning || "", estimatedImpact: s.estimatedImpact || "" });
    setMode("manual");
  };

  const send = async () => {
    if (!form.title.trim() || !form.description.trim() || !projectId) return;
    setSending(true); setError("");
    try {
      const r = await fetch(`${API_BASE}/api/admin/projects/${projectId}/approvals`, {
        method: "POST", headers: { "Content-Type": "application/json" }, credentials: "include",
        body: JSON.stringify(form),
      });
      if (!r.ok) throw new Error(`Error ${r.status}`);
      setSent(true); setTimeout(onClose, 1500);
    } catch (e: any) {
      setError(e.message || "Error al enviar propuesta");
    } finally { setSending(false); }
  };

  const inputStyle: React.CSSProperties = {
    width: "100%", background: "rgba(255,255,255,0.03)", border: "1px solid var(--bdr)",
    borderRadius: 8, padding: "8px 11px", fontSize: 13, color: "var(--t1)", outline: "none", fontFamily: "inherit",
  };

  if (sent) {
    return (
      <div className="modal-overlay" style={{ backdropFilter: "blur(4px)" }}>
        <div className="card" style={{ maxWidth: 360, padding: "40px 32px", textAlign: "center" }}>
          <CheckCircle size={40} style={{ color: "var(--jade)", marginBottom: 12 }} />
          <p style={{ fontSize: 15, fontWeight: 600, marginBottom: 6 }}>Propuesta Enviada</p>
          <p style={{ fontSize: 12, color: "var(--t3)" }}>El cliente recibirá una notificación y la verá en Aprobaciones</p>
        </div>
      </div>
    );
  }

  return (
    <div className="modal-overlay" style={{ backdropFilter: "blur(4px)" }}>
      <div style={{ width: "100%", maxWidth: 560, background: "var(--srf)", border: "1px solid var(--bdr)", borderRadius: 16, overflow: "hidden" }}>
        {/* Header */}
        <div style={{ padding: "14px 16px", borderBottom: "1px solid var(--bdr)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div>
            <p style={{ fontSize: 14, fontWeight: 700 }}>
              {mode === "ai" ? "Análisis IA de Productos" : mode === "manual" ? "Nueva Propuesta" : "Enviar Propuesta"}
            </p>
            <p style={{ fontSize: 11, color: "var(--t3)" }}>Para {client.name} · Proyecto #{projectId}</p>
          </div>
          <div style={{ display: "flex", gap: 6 }}>
            {mode !== "choose" && (
              <button onClick={() => setMode("choose")} className="btn btn-ghost btn-sm" style={{ padding: "4px 10px", fontSize: 11 }}>
                <RotateCcw size={11} /> Volver
              </button>
            )}
            <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--t3)", display: "flex", padding: 8 }}><X size={16} /></button>
          </div>
        </div>

        {/* Mode: choose */}
        {mode === "choose" && (
          <div style={{ padding: 20, display: "flex", flexDirection: "column", gap: 10 }}>
            <p style={{ fontSize: 12, color: "var(--t3)", marginBottom: 2 }}>¿Cómo quieres crear la propuesta?</p>
            <button onClick={() => { setMode("ai"); analyzeWithAI(); }} disabled={!projectId}
              style={{ display: "flex", alignItems: "center", gap: 14, padding: "14px 16px", borderRadius: 12,
                background: "linear-gradient(135deg, rgba(200,168,75,0.1), rgba(200,168,75,0.04))",
                border: "1px solid rgba(200,168,75,0.3)", cursor: "pointer", textAlign: "left" as const }}>
              <div style={{ width: 38, height: 38, borderRadius: 10, background: "rgba(200,168,75,0.15)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                <Sparkles size={17} style={{ color: "var(--gold)" }} />
              </div>
              <div style={{ flex: 1 }}>
                <p style={{ fontSize: 13, fontWeight: 700, marginBottom: 2 }}>Analizar con IA ✨</p>
                <p style={{ fontSize: 11, color: "var(--t3)" }}>La IA analiza los productos con menor score y genera propuestas automáticas listas para enviar</p>
              </div>
              <ChevronRight size={15} style={{ color: "var(--gold)", flexShrink: 0 }} />
            </button>
            <button onClick={() => setMode("manual")}
              style={{ display: "flex", alignItems: "center", gap: 14, padding: "14px 16px", borderRadius: 12,
                background: "rgba(255,255,255,0.02)", border: "1px solid var(--bdr)", cursor: "pointer", textAlign: "left" as const }}>
              <div style={{ width: 38, height: 38, borderRadius: 10, background: "rgba(255,255,255,0.04)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                <ClipboardList size={17} style={{ color: "var(--t2)" }} />
              </div>
              <div style={{ flex: 1 }}>
                <p style={{ fontSize: 13, fontWeight: 700, marginBottom: 2 }}>Crear manualmente</p>
                <p style={{ fontSize: 11, color: "var(--t3)" }}>Escribe tú mismo el título, descripción e impacto estimado</p>
              </div>
              <ChevronRight size={15} style={{ color: "var(--t3)", flexShrink: 0 }} />
            </button>
          </div>
        )}

        {/* Mode: AI suggestions list */}
        {mode === "ai" && (
          <div style={{ maxHeight: "65vh", overflowY: "auto" }}>
            {aiLoading && (
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", padding: "44px 24px", gap: 12 }}>
                <Loader2 size={26} style={{ color: "var(--gold)", animation: "spin 0.6s linear infinite" }} />
                <p style={{ fontSize: 13, color: "var(--t2)", textAlign: "center" }}>
                  Analizando productos con IA…<br />
                  <span style={{ fontSize: 11, color: "var(--t3)" }}>Puede tardar unos segundos</span>
                </p>
              </div>
            )}
            {!aiLoading && aiError && (
              <div style={{ padding: 24, textAlign: "center" }}>
                <AlertCircle size={26} style={{ color: "var(--crim)", marginBottom: 10 }} />
                <p style={{ fontSize: 13, color: "var(--crim)", marginBottom: 14 }}>{aiError}</p>
                <button onClick={analyzeWithAI} className="btn btn-ghost btn-sm"><RotateCcw size={12} /> Reintentar</button>
              </div>
            )}
            {!aiLoading && !aiError && aiSuggestions.length > 0 && (
              <div style={{ padding: 14, display: "flex", flexDirection: "column", gap: 10 }}>
                <p style={{ fontSize: 11, color: "var(--t3)" }}>
                  {aiSuggestions.length} propuesta{aiSuggestions.length !== 1 ? "s" : ""} · Haz clic para revisar y enviar
                </p>
                {aiSuggestions.map((s, i) => (
                  <div key={i}
                    onClick={() => useSuggestion(s)}
                    style={{ background: "rgba(255,255,255,0.02)", border: "1px solid var(--bdr)", borderRadius: 12, padding: 14, cursor: "pointer", transition: "border-color 0.15s" }}
                    onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.borderColor = "rgba(200,168,75,0.4)"; }}
                    onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.borderColor = "var(--bdr)"; }}
                  >
                    <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 8, marginBottom: 6 }}>
                      <div>
                        <span style={{ fontSize: 10, fontWeight: 700, color: "var(--gold)", textTransform: "uppercase" as const, letterSpacing: "0.8px" }}>
                          {typeLabels[s.type] ?? s.type}
                        </span>
                        <p style={{ fontSize: 13, fontWeight: 700, marginTop: 2 }}>{s.title}</p>
                      </div>
                      <div className="btn btn-gold btn-sm" style={{ flexShrink: 0, pointerEvents: "none", fontSize: 11 }}>
                        <ChevronRight size={11} /> Usar
                      </div>
                    </div>
                    <p style={{ fontSize: 12, color: "var(--t2)", lineHeight: 1.5, marginBottom: s.estimatedImpact ? 8 : 0 }}>{s.description}</p>
                    {s.estimatedImpact && (
                      <div style={{ padding: "4px 9px", background: "rgba(45,212,159,0.06)", border: "1px solid rgba(45,212,159,0.15)", borderRadius: 8, display: "inline-flex", gap: 5, alignItems: "center" }}>
                        <span style={{ fontSize: 10, color: "var(--jade)", fontWeight: 700 }}>Impacto:</span>
                        <span style={{ fontSize: 11, color: "var(--t2)" }}>{s.estimatedImpact}</span>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Mode: manual form */}
        {mode === "manual" && (
          <>
            <div style={{ padding: 16, display: "flex", flexDirection: "column", gap: 12, maxHeight: "62vh", overflowY: "auto" }}>
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
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(180px, 100%), 1fr))", gap: 10 }}>
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
          </>
        )}
      </div>
    </div>
  );
}

interface ChatPanelProps { client: User; onClose: () => void; initialMessage?: string; }

function ChatPanel({ client, onClose, initialMessage }: ChatPanelProps) {
  useModalLock();
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
      .then((d) => { setMessages(Array.isArray(d) ? d : []); setLoading(false); })
      .catch(() => setLoading(false));
  };

  useEffect(() => { load(); const t = setInterval(load, 10000); return () => clearInterval(t); }, [projectId]);
  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);

  const send = async () => {
    if (!text.trim() || !projectId) return;
    setSending(true);
    try {
      await fetch(`${API_BASE}/api/admin/projects/${projectId}/messages`, {
        method: "POST", headers: { "Content-Type": "application/json" }, credentials: "include",
        body: JSON.stringify({ content: text.trim() }),
      });
      setText("");
    } catch {} finally {
      setSending(false); load();
    }
  };

  return (
    <div className="modal-overlay" style={{ backdropFilter: "blur(4px)" }}>
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
// ─── PLANS & CRÉDITOS MODAL ───────────────────────────────────────────────
// Lets admin manage plan + packs + usage for each project of a client
interface PlansModalProps { client: User; onClose: () => void; }

function PlansModal({ client, onClose }: PlansModalProps) {
  useModalLock();
  const [clientProjects, setClientProjects] = useState<any[]>([]);
  const [loadingProjects, setLoadingProjects] = useState(true);
  const [selectedProjectId, setSelectedProjectId] = useState<number | null>(null);
  const [planStatus, setPlanStatus] = useState<any>(null);
  const [definitions, setDefinitions] = useState<{ plans: any[]; packs: any[] } | null>(null);
  const [loadingStatus, setLoadingStatus] = useState(false);
  const [savingPlan, setSavingPlan] = useState(false);
  const [addingPack, setAddingPack] = useState<string | null>(null);
  const [resetting, setResetting] = useState(false);
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null);

  useEffect(() => {
    // FIX: /admin/users/:id/projects no existe — usamos projects-list y filtramos por clientId localmente
    if (!client.clientId) { setLoadingProjects(false); return; }
    Promise.all([
      fetch(`${API_BASE}/api/admin/projects-list`, { credentials: "include" })
        .then(r => r.ok ? r.json() : [])
        .catch(() => []),
      fetch(`${API_BASE}/api/plans/definitions`, { credentials: "include" })
        .then(r => r.ok ? r.json() : null)
        .catch(() => null),
    ]).then(([allProjects, defs]) => {
      const all = Array.isArray(allProjects) ? allProjects : (allProjects?.projects ?? []);
      // Filter to projects belonging to this client
      const list = all.filter((p: any) => String(p.id) === String(client.clientId));
      setClientProjects(list);
      if (list.length === 1) setSelectedProjectId(list[0].id);
      setDefinitions(defs);
      setLoadingProjects(false);
    });
  }, [client.id, client.clientId]);

  useEffect(() => {
    if (!selectedProjectId) { setPlanStatus(null); return; }
    setLoadingStatus(true);
    fetch(`${API_BASE}/api/projects/${selectedProjectId}/plan`, { credentials: "include" })
      .then(r => r.ok ? r.json() : null)
      .then(d => { setPlanStatus(d); setLoadingStatus(false); })
      .catch(() => setLoadingStatus(false));
  }, [selectedProjectId]);

  const refreshStatus = async () => {
    if (!selectedProjectId) return;
    const r = await fetch(`${API_BASE}/api/projects/${selectedProjectId}/plan`, { credentials: "include" });
    if (r.ok) setPlanStatus(await r.json());
  };

  const showToast = (msg: string, ok: boolean) => {
    setToast({ msg, ok });
    setTimeout(() => setToast(null), 3500);
  };

  const changePlan = async (newPlan: string) => {
    if (!selectedProjectId) return;
    if (!confirm(`¿Cambiar plan a "${newPlan}"? Se actualiza inmediatamente.`)) return;
    setSavingPlan(true);
    try {
      const res = await fetch(`${API_BASE}/api/projects/${selectedProjectId}/plan`, {
        method: "PUT", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan: newPlan }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || "Error");
      showToast(`Plan actualizado a "${newPlan}"`, true);
      await refreshStatus();
    } catch (e: any) {
      showToast(e?.message || "Error cambiando plan", false);
    } finally {
      setSavingPlan(false);
    }
  };

  const addPack = async (packKey: string) => {
    if (!selectedProjectId) return;
    const def = definitions?.packs?.find(p => p.key === packKey);
    if (!confirm(`¿Asignar "${def?.label || packKey}"? (+${def?.productsIncluded} productos, +${def?.imagesIncluded} imágenes)`)) return;
    setAddingPack(packKey);
    try {
      const res = await fetch(`${API_BASE}/api/projects/${selectedProjectId}/plan/credits`, {
        method: "POST", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ packType: packKey }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || "Error");
      showToast(`Pack "${def?.label}" asignado`, true);
      await refreshStatus();
    } catch (e: any) {
      showToast(e?.message || "Error asignando pack", false);
    } finally {
      setAddingPack(null);
    }
  };

  const resetUsage = async () => {
    if (!selectedProjectId) return;
    if (!confirm("¿Resetear el contador mensual de uso? Se pondrá a 0.")) return;
    setResetting(true);
    try {
      const res = await fetch(`${API_BASE}/api/projects/${selectedProjectId}/plan/reset-usage`, {
        method: "POST", credentials: "include",
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || "Error");
      showToast("Contador reseteado", true);
      await refreshStatus();
    } catch (e: any) {
      showToast(e?.message || "Error reseteando", false);
    } finally {
      setResetting(false);
    }
  };

  return (
    <div onClick={onClose} className="modal-overlay" style={{ padding: 20 }}>
      <div onClick={e => e.stopPropagation()} style={{ background: "var(--ink, #0a0a0f)", border: "1px solid var(--bdr, #22222e)", borderRadius: 16, maxWidth: 760, width: "100%", maxHeight: "90vh", overflow: "auto" }}>
        <div style={{ padding: "18px 22px", borderBottom: "1px solid var(--bdr)", display: "flex", justifyContent: "space-between", alignItems: "center", position: "sticky", top: 0, background: "var(--ink)", zIndex: 1 }}>
          <div>
            <h2 style={{ margin: 0, fontSize: 18, fontWeight: 800, color: "var(--gold, #c8a84b)", display: "flex", alignItems: "center", gap: 8 }}>
              💳 Plan & Créditos — {client.name}
            </h2>
            <p style={{ margin: "4px 0 0", fontSize: 12, color: "var(--t3, #888)" }}>{client.email}</p>
          </div>
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--t3)", padding: 6 }}><X size={18} /></button>
        </div>

        {toast && (
          <div style={{ margin: "12px 22px 0", padding: "10px 14px", borderRadius: 8, fontSize: 13, background: toast.ok ? "rgba(45,212,159,0.1)" : "rgba(239,68,68,0.1)", border: `1px solid ${toast.ok ? "rgba(45,212,159,0.3)" : "rgba(239,68,68,0.3)"}`, color: toast.ok ? "#2dd49f" : "#ef4444" }}>
            {toast.ok ? "✅ " : "⚠ "}{toast.msg}
          </div>
        )}

        <div style={{ padding: 22 }}>
          {loadingProjects && <p style={{ fontSize: 13, color: "var(--t2)" }}>Cargando proyectos...</p>}
          {!loadingProjects && clientProjects.length === 0 && (
            <p style={{ fontSize: 13, color: "var(--t2)" }}>Este cliente no tiene proyectos asignados.</p>
          )}

          {clientProjects.length > 1 && (
            <div style={{ marginBottom: 18 }}>
              <label style={{ fontSize: 11, color: "var(--t3)", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 6, display: "block" }}>Proyecto</label>
              <select value={selectedProjectId ?? ""} onChange={e => setSelectedProjectId(e.target.value ? parseInt(e.target.value) : null)} style={{ width: "100%", padding: "10px 12px", borderRadius: 8, background: "var(--ink2, #14141d)", border: "1px solid var(--bdr)", color: "var(--t1)", fontSize: 13 }}>
                <option value="">— Selecciona un proyecto —</option>
                {clientProjects.map(p => <option key={p.id} value={p.id}>{p.name || p.shopDomain || `Proyecto ${p.id}`}</option>)}
              </select>
            </div>
          )}

          {selectedProjectId && (
            <>
              {loadingStatus && <p style={{ fontSize: 13, color: "var(--t2)" }}>Cargando plan...</p>}

              {!loadingStatus && planStatus && (
                <>
                  {/* CURRENT PLAN STATUS */}
                  <div style={{ padding: 16, borderRadius: 10, background: "linear-gradient(135deg, rgba(200,168,75,0.06), transparent)", border: "1px solid rgba(200,168,75,0.2)", marginBottom: 18 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 }}>
                      <div>
                        <div style={{ fontSize: 11, color: "var(--t3)", textTransform: "uppercase", letterSpacing: 0.5 }}>Plan actual</div>
                        <div style={{ fontSize: 18, fontWeight: 700, color: "var(--gold)", marginTop: 2 }}>{planStatus.plan || "trial"}</div>
                      </div>
                      <button onClick={resetUsage} disabled={resetting} className="btn btn-sm btn-ghost" title="Resetear contador del mes">
                        {resetting ? "..." : "↻ Reset"}
                      </button>
                    </div>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginTop: 8 }}>
                      <div style={{ padding: 10, borderRadius: 8, background: "var(--ink2)", border: "1px solid var(--bdr)" }}>
                        <div style={{ fontSize: 10, color: "var(--t3)", textTransform: "uppercase" }}>Productos este mes</div>
                        <div style={{ fontSize: 16, fontWeight: 700, color: "var(--t1)" }}>{planStatus.usage?.products ?? 0} / {planStatus.limits?.productsPerMonth ?? "—"}</div>
                      </div>
                      <div style={{ padding: 10, borderRadius: 8, background: "var(--ink2)", border: "1px solid var(--bdr)" }}>
                        <div style={{ fontSize: 10, color: "var(--t3)", textTransform: "uppercase" }}>Imágenes este mes</div>
                        <div style={{ fontSize: 16, fontWeight: 700, color: "var(--t1)" }}>{planStatus.usage?.images ?? 0} / {planStatus.limits?.maxImagesPerMonth ?? "—"}</div>
                      </div>
                    </div>
                    {planStatus.activePacks && planStatus.activePacks.length > 0 && (
                      <div style={{ marginTop: 12, paddingTop: 12, borderTop: "1px solid var(--bdr)" }}>
                        <div style={{ fontSize: 11, color: "var(--t3)", marginBottom: 6 }}>Packs activos</div>
                        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                          {planStatus.activePacks.map((p: any, i: number) => (
                            <span key={i} style={{ fontSize: 11, padding: "3px 9px", borderRadius: 12, background: "rgba(45,212,159,0.1)", color: "#2dd49f", border: "1px solid rgba(45,212,159,0.3)" }}>
                              {p.label || p.packKey} ({p.imagesRemaining ?? "—"} imgs)
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* CHANGE PLAN */}
                  {definitions?.plans && (
                    <div style={{ marginBottom: 18 }}>
                      <h3 style={{ fontSize: 13, fontWeight: 700, color: "var(--t1)", marginBottom: 8 }}>Cambiar plan</h3>
                      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 8 }}>
                        {definitions.plans.map(p => (
                          <button key={p.key} onClick={() => changePlan(p.key)} disabled={savingPlan || p.key === planStatus.plan}
                            style={{
                              padding: "10px 12px", borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: p.key === planStatus.plan ? "default" : "pointer",
                              background: p.key === planStatus.plan ? "rgba(200,168,75,0.15)" : "var(--ink2)",
                              border: `1px solid ${p.key === planStatus.plan ? "var(--gold)" : "var(--bdr)"}`,
                              color: p.key === planStatus.plan ? "var(--gold)" : "var(--t2)",
                              textAlign: "left", lineHeight: 1.3,
                            }}>
                            <div style={{ fontWeight: 700, marginBottom: 2 }}>{p.label}</div>
                            <div style={{ fontSize: 10, color: "var(--t3)" }}>{p.productsPerMonth ?? "∞"}p · {p.maxImagesPerMonth ?? "∞"}img</div>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* ADD PACK */}
                  {definitions?.packs && (
                    <div>
                      <h3 style={{ fontSize: 13, fontWeight: 700, color: "var(--t1)", marginBottom: 8 }}>Asignar pack de créditos</h3>
                      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 8 }}>
                        {definitions.packs.map(p => (
                          <button key={p.key} onClick={() => addPack(p.key)} disabled={!!addingPack}
                            style={{
                              padding: "12px 14px", borderRadius: 8, fontSize: 12, cursor: addingPack ? "not-allowed" : "pointer",
                              background: addingPack === p.key ? "rgba(45,212,159,0.15)" : "var(--ink2)",
                              border: "1px solid var(--bdr)", color: "var(--t1)", textAlign: "left", lineHeight: 1.4,
                              opacity: addingPack && addingPack !== p.key ? 0.5 : 1,
                            }}>
                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
                              <strong style={{ fontSize: 13 }}>{p.label}</strong>
                              <span style={{ color: "var(--gold)", fontWeight: 700 }}>€{p.price}</span>
                            </div>
                            <div style={{ fontSize: 10, color: "var(--t3)" }}>+{p.productsIncluded} productos · +{p.imagesIncluded} imágenes</div>
                            {addingPack === p.key && <div style={{ fontSize: 10, color: "#2dd49f", marginTop: 4 }}>Asignando...</div>}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── ProjectCostModal ─────────────────────────────────────────────────────────
interface ProjectCostModalProps { client: User; onClose: () => void; }

const PROVIDER_COLORS: Record<string, string> = {
  gemini: "#2dd49f", claude: "#c8a84b", openai: "#10a37f",
  replicate: "#6366f1", runway: "#e779c1", elevenlabs: "#f97316",
  pagespeed: "#60a5fa", shopify: "#95bf47", other: "#888",
};

function buildChartData(daily: Array<{ day: string; provider: string; costUsd: number }>) {
  const map: Record<string, Record<string, number>> = {};
  const providers = new Set<string>();
  for (const r of daily) {
    if (!map[r.day]) map[r.day] = {};
    map[r.day][r.provider] = (map[r.day][r.provider] ?? 0) + Number(r.costUsd);
    providers.add(r.provider);
  }
  return {
    data: Object.entries(map).sort(([a], [b]) => a.localeCompare(b)).map(([day, vals]) => ({
      day: day.slice(5),
      ...Object.fromEntries([...providers].map(p => [p, +(vals[p] ?? 0).toFixed(6)])),
    })),
    providers: [...providers],
  };
}

function ProjectCostModal({ client, onClose }: ProjectCostModalProps) {
  useModalLock();
  const projectId = client.clientId;
  const [stats, setStats]         = useState<any>(null);
  const [logs, setLogs]           = useState<any>(null);
  const [page, setPage]           = useState(1);
  const [loading, setLoading]     = useState(true);
  const [logsLoading, setLogsLoading] = useState(false);

  const loadStats = useCallback(async () => {
    if (!projectId) return;
    setLoading(true);
    try {
      const r = await fetch(`${API_BASE}/api/api-usage/stats?projectId=${projectId}`, { credentials: "include" });
      if (r.ok) setStats(await r.json());
    } finally { setLoading(false); }
  }, [projectId]);

  const loadLogs = useCallback(async (p: number) => {
    if (!projectId) return;
    setLogsLoading(true);
    try {
      const r = await fetch(`${API_BASE}/api/api-usage/logs?projectId=${projectId}&page=${p}`, { credentials: "include" });
      if (r.ok) setLogs(await r.json());
    } finally { setLogsLoading(false); }
  }, [projectId]);

  useEffect(() => { loadStats(); loadLogs(1); }, [loadStats, loadLogs]);

  function handlePage(np: number) { setPage(np); loadLogs(np); }

  const now = new Date();
  const monthName = now.toLocaleString("es-ES", { month: "long", year: "numeric" });
  const cur  = stats?.totals?.current;
  const prev = stats?.totals?.previousMonth;
  const pct  = stats?.totals?.pctChange;
  const { data: chartData, providers: chartProviders } = stats?.daily
    ? buildChartData(stats.daily)
    : { data: [], providers: [] };

  const fmtN = (n: number | null | undefined) =>
    n == null ? "0" : Number(n).toLocaleString("es-ES");

  return (
    <div className="modal-overlay" style={{ padding: 20 }} onClick={onClose}>
      <div style={{ background: "var(--ink,#0f0f1a)", border: "1px solid var(--bdr,rgba(255,255,255,0.1))", borderRadius: 14, width: "100%", maxWidth: 900, maxHeight: "90vh", overflowY: "auto", boxShadow: "0 8px 48px rgba(0,0,0,0.7)" }} onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "18px 24px", borderBottom: "1px solid var(--bdr,rgba(255,255,255,0.08))", position: "sticky", top: 0, background: "var(--ink,#0f0f1a)", zIndex: 1 }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <DollarSign size={16} style={{ color: "var(--gold,#c8a84b)" }} />
              <h2 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: "var(--t,#fff)" }}>Costes IA — {client.name}</h2>
            </div>
            <p style={{ margin: "3px 0 0 24px", fontSize: 12, color: "var(--t3,#666)" }}>
              Proyecto #{projectId} · {monthName}
            </p>
          </div>
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--t3,#666)", fontSize: 22, lineHeight: 1, padding: 4 }}>×</button>
        </div>

        <div style={{ padding: "20px 24px" }}>
          {loading ? (
            <div style={{ display: "flex", justifyContent: "center", padding: 60 }}>
              <Loader2 size={28} style={{ color: "var(--gold,#c8a84b)", animation: "spin 0.6s linear infinite" }} />
            </div>
          ) : !projectId ? (
            <p style={{ textAlign: "center", color: "var(--t3)", padding: 40 }}>Este cliente no tiene proyecto asignado.</p>
          ) : (
            <>
              {/* KPI cards */}
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(180px,1fr))", gap: 14, marginBottom: 24 }}>
                {/* Cost this month */}
                <div style={{ background: "var(--ink2,#1a1a2e)", border: "1px solid var(--border,rgba(255,255,255,0.08))", borderRadius: 12, padding: "18px 20px" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
                    <DollarSign size={16} style={{ color: "var(--gold,#c8a84b)" }} />
                    <span style={{ fontSize: 11, color: "var(--t3,#666)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em" }}>Coste total (USD)</span>
                  </div>
                  <div style={{ fontSize: 26, fontWeight: 700, color: "var(--t,#fff)" }}>${Number(cur?.costUsd ?? 0).toFixed(4)}</div>
                  <div style={{ fontSize: 12, color: "var(--t3,#666)", marginTop: 4 }}>€{Number(cur?.costEur ?? 0).toFixed(4)} EUR</div>
                  {pct != null && (
                    <div style={{ display: "flex", alignItems: "center", gap: 4, marginTop: 8, fontSize: 12, fontWeight: 600, color: pct < 0 ? "var(--jade,#10b981)" : pct > 0 ? "var(--crim,#ef4444)" : "var(--t3,#666)" }}>
                      {pct > 0 ? <TrendingUp size={13} /> : pct < 0 ? <TrendingDown size={13} /> : <Minus size={13} />}
                      {pct > 0 ? "+" : ""}{pct.toFixed(1)}% vs mes anterior
                    </div>
                  )}
                </div>
                {/* Calls & tokens */}
                <div style={{ background: "var(--ink2,#1a1a2e)", border: "1px solid var(--border,rgba(255,255,255,0.08))", borderRadius: 12, padding: "18px 20px" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
                    <Activity size={16} style={{ color: "var(--gold,#c8a84b)" }} />
                    <span style={{ fontSize: 11, color: "var(--t3,#666)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em" }}>Llamadas API</span>
                  </div>
                  <div style={{ fontSize: 26, fontWeight: 700, color: "var(--t,#fff)" }}>{fmtN(cur?.calls)}</div>
                  <div style={{ fontSize: 12, color: "var(--t3,#666)", marginTop: 4 }}>Mes anterior: {fmtN(prev?.calls)}</div>
                </div>
                {/* Tokens */}
                <div style={{ background: "var(--ink2,#1a1a2e)", border: "1px solid var(--border,rgba(255,255,255,0.08))", borderRadius: 12, padding: "18px 20px" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
                    <Zap size={16} style={{ color: "var(--gold,#c8a84b)" }} />
                    <span style={{ fontSize: 11, color: "var(--t3,#666)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em" }}>Tokens entrada</span>
                  </div>
                  <div style={{ fontSize: 26, fontWeight: 700, color: "var(--t,#fff)" }}>{fmtN(cur?.inputTokens)}</div>
                  <div style={{ fontSize: 12, color: "var(--t3,#666)", marginTop: 4 }}>Salida: {fmtN(cur?.outputTokens)}</div>
                </div>
                {/* Previous month */}
                <div style={{ background: "var(--ink2,#1a1a2e)", border: "1px solid var(--border,rgba(255,255,255,0.08))", borderRadius: 12, padding: "18px 20px" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
                    <BarChart2 size={16} style={{ color: "var(--gold,#c8a84b)" }} />
                    <span style={{ fontSize: 11, color: "var(--t3,#666)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em" }}>Mes anterior (USD)</span>
                  </div>
                  <div style={{ fontSize: 26, fontWeight: 700, color: "var(--t,#fff)" }}>${Number(prev?.costUsd ?? 0).toFixed(4)}</div>
                  <div style={{ fontSize: 12, color: "var(--t3,#666)", marginTop: 4 }}>€{Number(prev?.costEur ?? 0).toFixed(4)} EUR</div>
                </div>
              </div>

              {/* Daily chart */}
              <div style={{ background: "var(--ink2,#1a1a2e)", border: "1px solid var(--border,rgba(255,255,255,0.08))", borderRadius: 12, padding: "18px 20px", marginBottom: 20 }}>
                <div style={{ marginBottom: 14, fontWeight: 600, color: "var(--t,#fff)", fontSize: 14 }}>Coste diario por motor (USD)</div>
                {chartData.length === 0 ? (
                  <div style={{ textAlign: "center", padding: "32px 0", color: "var(--t3,#666)", fontSize: 13 }}>Sin datos en este periodo</div>
                ) : (
                  <ResponsiveContainer width="100%" height={220}>
                    <BarChart data={chartData} barSize={10}>
                      <XAxis dataKey="day" tick={{ fill: "var(--t3,#666)", fontSize: 11 }} axisLine={false} tickLine={false} />
                      <YAxis tick={{ fill: "var(--t3,#666)", fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={v => v > 0 ? `$${v.toFixed(4)}` : "0"} width={72} />
                      <Tooltip
                        contentStyle={{ background: "#1a1a2e", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8, fontSize: 12 }}
                        formatter={(v: number, name: string) => [`$${v.toFixed(6)}`, name]}
                      />
                      <Legend iconSize={10} wrapperStyle={{ fontSize: 11 }} />
                      {chartProviders.map(p => (
                        <Bar key={p} dataKey={p} stackId="cost" fill={PROVIDER_COLORS[p] ?? "#888"} name={p} />
                      ))}
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </div>

              {/* Provider breakdown */}
              {stats?.byProvider && stats.byProvider.length > 0 && (
                <div style={{ background: "var(--ink2,#1a1a2e)", border: "1px solid var(--border,rgba(255,255,255,0.08))", borderRadius: 12, padding: "16px 20px", marginBottom: 20 }}>
                  <div style={{ fontSize: 14, fontWeight: 600, color: "var(--t,#fff)", marginBottom: 12 }}>Desglose por motor</div>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
                    {stats.byProvider.map((bp: any) => (
                      <div key={bp.provider} style={{ background: "var(--ink,#0f0f1a)", borderRadius: 8, padding: "10px 16px", border: `1px solid ${PROVIDER_COLORS[bp.provider] ?? "#444"}40`, minWidth: 130 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
                          <div style={{ width: 8, height: 8, borderRadius: "50%", background: PROVIDER_COLORS[bp.provider] ?? "#888" }} />
                          <span style={{ fontSize: 12, fontWeight: 700, color: "var(--t,#fff)", textTransform: "uppercase" }}>{bp.provider}</span>
                        </div>
                        <div style={{ fontSize: 15, fontWeight: 700, color: "var(--gold,#c8a84b)" }}>${Number(bp.costUsd).toFixed(4)}</div>
                        <div style={{ fontSize: 11, color: "var(--t3,#666)" }}>€{Number(bp.costEur).toFixed(4)} · {fmtN(bp.calls)} llamadas</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Logs table */}
              <div style={{ background: "var(--ink2,#1a1a2e)", border: "1px solid var(--border,rgba(255,255,255,0.08))", borderRadius: 12, padding: "16px 20px" }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
                  <div style={{ fontWeight: 600, color: "var(--t,#fff)", fontSize: 14 }}>
                    Registro de llamadas
                    {logs && <span style={{ marginLeft: 8, fontSize: 12, color: "var(--t3,#666)", fontWeight: 400 }}>({fmtN(logs.total)} total)</span>}
                  </div>
                </div>

                {logsLoading ? (
                  <div style={{ textAlign: "center", padding: "32px 0", color: "var(--t3,#666)", fontSize: 13 }}>Cargando...</div>
                ) : !logs || logs.rows?.length === 0 ? (
                  <div style={{ textAlign: "center", padding: "32px 0", color: "var(--t3,#666)", fontSize: 13 }}>Sin registros</div>
                ) : (
                  <>
                    <div style={{ overflowX: "auto" }}>
                      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                        <thead>
                          <tr>
                            {["Motor", "Modelo", "Operación", "Tokens (in/out)", "Coste USD", "Coste EUR", "Estado", "Fecha"].map(h => (
                              <th key={h} style={{ textAlign: "left", padding: "8px 10px", color: "var(--t3,#666)", fontWeight: 700, borderBottom: "1px solid var(--border,rgba(255,255,255,0.07))", whiteSpace: "nowrap", fontSize: 11, letterSpacing: "0.04em", textTransform: "uppercase" }}>{h}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {logs.rows.map((row: any) => (
                            <tr key={row.id} style={{ borderBottom: "1px solid var(--border,rgba(255,255,255,0.04))" }}>
                              <td style={{ padding: "9px 10px" }}>
                                <span style={{ display: "inline-flex", alignItems: "center", gap: 5, background: `${PROVIDER_COLORS[row.provider] ?? "#888"}22`, color: PROVIDER_COLORS[row.provider] ?? "#888", borderRadius: 5, padding: "2px 7px", fontWeight: 700, fontSize: 11 }}>
                                  {row.provider}
                                </span>
                              </td>
                              <td style={{ padding: "9px 10px", color: "var(--t3,#888)", fontSize: 11 }} title={row.model ?? undefined}>
                                {getModelShortName(row.model)}
                              </td>
                              <td style={{ padding: "9px 10px", color: "var(--t,#ccc)", maxWidth: 180, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={row.operation}>
                                {row.operation}
                              </td>
                              <td style={{ padding: "9px 10px", color: "var(--t3,#888)", fontFamily: "monospace", fontSize: 11 }}>
                                {fmtN(row.inputUnits)} / {fmtN(row.outputUnits)}
                                {row.unitsLabel && <span style={{ marginLeft: 3, fontSize: 10, color: "var(--t3,#555)" }}>{row.unitsLabel}</span>}
                              </td>
                              <td style={{ padding: "9px 10px", color: "var(--gold,#c8a84b)", fontWeight: 600, fontFamily: "monospace", fontSize: 11 }}>
                                ${Number(row.costUsd ?? 0).toFixed(6)}
                              </td>
                              <td style={{ padding: "9px 10px", color: "var(--jade,#10b981)", fontFamily: "monospace", fontSize: 11 }}>
                                €{Number(row.costEur ?? 0).toFixed(6)}
                              </td>
                              <td style={{ padding: "9px 10px" }}>
                                <span style={{ fontSize: 11, fontWeight: 700, color: row.success === 1 ? "var(--jade,#10b981)" : "var(--crim,#ef4444)" }}>
                                  {row.success === 1 ? "✓" : "✗"}
                                </span>
                              </td>
                              <td style={{ padding: "9px 10px", color: "var(--t3,#666)", whiteSpace: "nowrap", fontSize: 11 }}>
                                {new Date(row.createdAt).toLocaleString("es-ES", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    {logs.totalPages > 1 && (
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 12, marginTop: 18 }}>
                        <button onClick={() => handlePage(page - 1)} disabled={page <= 1} style={{ background: "none", border: "1px solid var(--border,rgba(255,255,255,0.1))", borderRadius: 6, padding: "5px 10px", color: page <= 1 ? "var(--t3,#555)" : "var(--t,#fff)", cursor: page <= 1 ? "not-allowed" : "pointer" }}>
                          <ChevronLeft size={14} />
                        </button>
                        <span style={{ fontSize: 12, color: "var(--t3,#666)" }}>Pág. {page} / {logs.totalPages}</span>
                        <button onClick={() => handlePage(page + 1)} disabled={page >= logs.totalPages} style={{ background: "none", border: "1px solid var(--border,rgba(255,255,255,0.1))", borderRadius: 6, padding: "5px 10px", color: page >= logs.totalPages ? "var(--t3,#555)" : "var(--t,#fff)", cursor: page >= logs.totalPages ? "not-allowed" : "pointer" }}>
                          <ChevronRight size={14} />
                        </button>
                      </div>
                    )}
                  </>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

type BlockingSubscription = { plan: string | null; status: string | null; stripeSubscriptionId: string; stripeDashboardUrl?: string };
function DeleteClientModal({ client, onClose, onDeleted }: { client: User; onClose: () => void; onDeleted: (id: string) => void }) {
  useModalLock();
  const [confirmText, setConfirmText] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState("");
  // Suscripción de Stripe que bloquea el borrado (409). Mientras exista, el modal ofrece cancelarla aquí mismo.
  const [blockingSub, setBlockingSub] = useState<BlockingSubscription | null>(null);
  const [confirmCancelSub, setConfirmCancelSub] = useState(false);
  const [cancelingSub, setCancelingSub] = useState(false);
  const canDelete = confirmText.trim().toLowerCase() === client.email.trim().toLowerCase();

  // Devuelve true si el usuario quedó borrado; si el API responde 409 con suscripción, la guarda para ofrecer cancelarla.
  const requestDelete = async (): Promise<boolean> => {
    const res = await fetch(`${API_BASE}/api/admin/users/${client.id}`, { method: "DELETE", credentials: "include" });
    const data = await res.json().catch(() => ({}));
    if (res.ok) return true;
    if (res.status === 409 && data?.subscription?.stripeSubscriptionId) {
      setBlockingSub(data.subscription as BlockingSubscription);
      setError("");
      return false;
    }
    let msg: string = data?.error || `Error ${res.status} al borrar el usuario`;
    if (data?.subscription?.plan || data?.subscription?.status) {
      msg += ` (plan: ${data.subscription.plan ?? "–"}, estado: ${data.subscription.status ?? "–"})`;
    }
    setError(msg);
    return false;
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canDelete || deleting || cancelingSub) return;
    setDeleting(true);
    setError("");
    try {
      if (await requestDelete()) onDeleted(client.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error de red al borrar el usuario");
    } finally {
      setDeleting(false);
    }
  };

  // Cancela la suscripción en Stripe y, si sale bien, reintenta el borrado automáticamente.
  const cancelSubscriptionAndDelete = async () => {
    if (!blockingSub || cancelingSub || deleting) return;
    setCancelingSub(true);
    setError("");
    try {
      const res = await fetch(`${API_BASE}/api/admin/users/${client.id}/cancel-subscription`, { method: "POST", credentials: "include" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data?.error || `Error ${res.status} al cancelar la suscripción`);
        return;
      }
      setBlockingSub(null);
      setConfirmCancelSub(false);
      setDeleting(true);
      if (await requestDelete()) onDeleted(client.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error de red al cancelar la suscripción");
    } finally {
      setCancelingSub(false);
      setDeleting(false);
    }
  };

  const busy = deleting || cancelingSub;

  return (
    <div
      data-testid="delete-client-modal"
      className="modal-overlay" style={{ backdropFilter: "blur(8px)" }}
    >
      <div className="modal-box" style={{ maxWidth: 460, borderColor: "rgba(239,68,68,0.35)" }}>
        <p className="modal-title" style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <Trash2 size={18} style={{ color: "var(--crim,#ef4444)" }} />
          Borrar cliente definitivamente
        </p>
        <p className="modal-subtitle">Esta acción no se puede deshacer.</p>

        <form onSubmit={submit}>
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <div style={{ padding: "12px 14px", background: "var(--ink3)", border: "1px solid var(--bdr)", borderRadius: 10, display: "flex", alignItems: "center", gap: 10 }}>
              <div className="logo-gem" style={{ width: 34, height: 34, fontSize: 12, flexShrink: 0, background: client.avatarColor ? `${client.avatarColor}22` : "rgba(200,168,75,0.1)", color: client.avatarColor ?? "var(--gold2)" }}>
                {client.name.slice(0, 2).toUpperCase()}
              </div>
              <div style={{ minWidth: 0 }}>
                <p style={{ margin: 0, fontSize: 13, fontWeight: 700 }}>{client.name}</p>
                <p style={{ margin: 0, fontSize: 11.5, color: "var(--t3)", overflow: "hidden", textOverflow: "ellipsis" }}>{client.email}</p>
                {client.clientId && <p style={{ margin: 0, fontSize: 11, color: "var(--t3)", fontFamily: "var(--fm)" }}>Proyecto #{client.clientId}</p>}
              </div>
            </div>

            <div style={{ padding: "10px 12px", background: "rgba(239,68,68,0.06)", border: "1px solid rgba(239,68,68,0.25)", borderRadius: 8 }}>
              <p style={{ margin: 0, fontSize: 11.5, color: "var(--crim,#ef4444)", lineHeight: 1.6 }}>
                ⚠️ <b>Irreversible.</b> Se eliminará el usuario junto con sus sesiones, tokens de acceso, progreso, suscripciones push y datos de afiliado. No podrá volver a iniciar sesión. Si solo quieres bloquear el acceso temporalmente, usa <b>Revocar</b>.
              </p>
            </div>

            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">Escribe el email <b style={{ color: "var(--t)" }}>{client.email}</b> para confirmar</label>
              <input
                type="text"
                className="form-input"
                value={confirmText}
                onChange={(e) => setConfirmText(e.target.value)}
                placeholder={client.email}
                autoComplete="off"
                autoFocus
                data-testid="delete-client-confirm-input"
              />
            </div>

            {blockingSub && (
              <div data-testid="delete-client-subscription-block" style={{ padding: "12px 14px", background: "rgba(245,158,11,0.08)", border: "1px solid rgba(245,158,11,0.35)", borderRadius: 10, display: "flex", flexDirection: "column", gap: 10 }}>
                <div style={{ display: "flex", alignItems: "flex-start", gap: 8 }}>
                  <CreditCard size={14} style={{ color: "#f59e0b", flexShrink: 0, marginTop: 2 }} />
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <p style={{ margin: 0, fontSize: 12.5, fontWeight: 700, color: "#f59e0b" }}>Suscripción de Stripe activa</p>
                    <p style={{ margin: "2px 0 0", fontSize: 11.5, color: "var(--t2)", lineHeight: 1.5 }}>
                      Stripe seguiría cobrando a este cliente tras borrarlo. Plan: <b>{blockingSub.plan ?? "–"}</b> · estado: <b>{blockingSub.status ?? "–"}</b>
                      {" · "}
                      <a
                        href={blockingSub.stripeDashboardUrl ?? `https://dashboard.stripe.com/subscriptions/${blockingSub.stripeSubscriptionId}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{ color: "var(--gold2)", display: "inline-flex", alignItems: "center", gap: 3 }}
                        data-testid="delete-client-stripe-link"
                      >
                        <span style={{ fontFamily: "var(--fm)" }}>{blockingSub.stripeSubscriptionId}</span>
                        <ExternalLink size={10} />
                      </a>
                    </p>
                  </div>
                </div>

                {!confirmCancelSub ? (
                  <button
                    type="button"
                    onClick={() => { setConfirmCancelSub(true); setError(""); }}
                    disabled={busy}
                    className="btn btn-danger"
                    style={{ justifyContent: "center", width: "100%" }}
                    data-testid="delete-client-cancel-sub-btn"
                  >
                    <CreditCard size={14} />
                    Cancelar suscripción y borrar
                  </button>
                ) : (
                  <div data-testid="delete-client-cancel-sub-confirm" style={{ padding: "10px 12px", background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.35)", borderRadius: 8, display: "flex", flexDirection: "column", gap: 8 }}>
                    <p style={{ margin: 0, fontSize: 11.5, color: "var(--crim,#ef4444)", lineHeight: 1.6 }}>
                      ⚠️ <b>Afecta a la facturación.</b> Se cancelará la suscripción <b>de inmediato</b> en Stripe (sin reembolso automático del periodo en curso) y acto seguido se borrará el usuario. ¿Confirmas?
                    </p>
                    <div style={{ display: "flex", gap: 8 }}>
                      <button type="button" onClick={() => setConfirmCancelSub(false)} disabled={busy} className="btn btn-ghost" style={{ flex: 1, justifyContent: "center" }} data-testid="delete-client-cancel-sub-back-btn">
                        Volver
                      </button>
                      <button
                        type="button"
                        onClick={cancelSubscriptionAndDelete}
                        disabled={busy}
                        className="btn btn-danger"
                        style={{ flex: 1, justifyContent: "center" }}
                        data-testid="delete-client-cancel-sub-confirm-btn"
                      >
                        {busy ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
                        {cancelingSub ? "Cancelando en Stripe…" : deleting ? "Borrando…" : "Sí, cancelar y borrar"}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {error && (
              <div data-testid="delete-client-error" style={{ display: "flex", alignItems: "flex-start", gap: 8, padding: "10px 12px", background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.3)", borderRadius: 8 }}>
                <AlertCircle size={14} style={{ color: "var(--crim,#ef4444)", flexShrink: 0, marginTop: 1 }} />
                <p style={{ margin: 0, fontSize: 12, color: "var(--crim,#ef4444)" }}>{error}</p>
              </div>
            )}

            <div style={{ display: "flex", gap: 8 }}>
              <button type="button" onClick={onClose} disabled={busy} className="btn btn-ghost" style={{ flex: 1, justifyContent: "center" }}>Cancelar</button>
              <button
                type="submit"
                disabled={!canDelete || busy || !!blockingSub}
                className="btn btn-danger"
                style={{ flex: 1, justifyContent: "center" }}
                data-testid="delete-client-confirm-btn"
                title={blockingSub ? "Cancela primero la suscripción de Stripe" : undefined}
              >
                {deleting ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
                {deleting ? "Borrando…" : "Borrar definitivamente"}
              </button>
            </div>
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
  const [inviteLink, setInviteLink] = useState<{ link: string; email: string; storeName?: string } | null>(null);
  const [copied, setCopied] = useState(false);
  const [processing, setProcessing] = useState<string | null>(null);
  const [chatClient, setChatClient] = useState<User | null>(null);
  const [chatInitialMsg, setChatInitialMsg] = useState<string | undefined>(undefined);
  const [paymentClient, setPaymentClient] = useState<User | null>(null);
  const [suggestionClient, setSuggestionClient] = useState<User | null>(null);
  const [plansClient, setPlansClient] = useState<User | null>(null);
  const [costsClient, setCostsClient] = useState<User | null>(null);
  const [deleteClient, setDeleteClient] = useState<User | null>(null);
  const [costByProject, setCostByProject] = useState<Record<string, { costUsd: number; calls: number }>>({});

  const load = () => {
    fetch(`${API_BASE}/api/admin/users`, { credentials: "include" })
      .then((r) => r.json())
      .then((d) => { setUsers(Array.isArray(d) ? d : []); setLoading(false); })
      .catch(() => setLoading(false));
  };

  const loadCosts = () => {
    fetch(`${API_BASE}/api/api-usage/by-project`, { credentials: "include" })
      .then(r => r.json())
      .then((rows: any[]) => {
        const map: Record<string, { costUsd: number; calls: number }> = {};
        rows.forEach(r => { if (r.projectId) map[String(r.projectId)] = { costUsd: Number(r.costUsd), calls: Number(r.calls) }; });
        setCostByProject(map);
      })
      .catch(() => {});
  };

  useEffect(() => { load(); loadCosts(); }, []);

  const toggleActive = async (u: User) => {
    setProcessing(u.id);
    try {
      const action = u.isActive ? "deactivate" : "activate";
      await fetch(`${API_BASE}/api/admin/users/${u.id}/${action}`, { method: "POST", credentials: "include" });
    } catch {} finally {
      setProcessing(null); load();
    }
  };

  const impersonate = async (u: User) => {
    if (!u.clientId) return;
    if (!confirm(`¿Suplantar a ${u.name} (${u.email})? Verás la app como cliente hasta que pulses "Salir" en el banner superior.`)) return;
    setProcessing(u.id);
    try {
      const res = await fetch(`${API_BASE}/api/admin/impersonate/${u.id}`, {
        method: "POST", credentials: "include",
      });
      const data = await res.json();
      if (!res.ok) { alert(data.error || "Error al suplantar"); setProcessing(null); return; }
      // Full reload forces AuthContext to pick up new session role
      window.location.href = "/client";
    } catch (e: any) {
      alert(e?.message || "Error de red");
      setProcessing(null);
    }
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
      {plansClient && (
        <PlansModal
          client={plansClient}
          onClose={() => setPlansClient(null)}
        />
      )}
      {costsClient && (
        <ProjectCostModal
          client={costsClient}
          onClose={() => setCostsClient(null)}
        />
      )}
      {deleteClient && (
        <DeleteClientModal
          client={deleteClient}
          onClose={() => setDeleteClient(null)}
          onDeleted={(id) => {
            setUsers((prev) => prev.filter((u) => u.id !== id));
            setDeleteClient(null);
          }}
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
          <div className="card table-wrap" style={{ padding: 0 }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Cliente</th>
                  <th>Proyecto</th>
                  <th>Coste IA (mes)</th>
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
                      {u.clientId && costByProject[u.clientId] ? (
                        <button
                          onClick={() => setCostsClient(u)}
                          style={{ background: "none", border: "none", cursor: "pointer", padding: 0, textAlign: "left" }}
                          title="Ver desglose de costes IA"
                        >
                          <span style={{ fontSize: 12, fontWeight: 700, color: "var(--gold,#c8a84b)", fontFamily: "monospace" }}>
                            ${Number(costByProject[u.clientId]!.costUsd).toFixed(4)}
                          </span>
                          <span style={{ fontSize: 10, color: "var(--t3,#666)", marginLeft: 4 }}>
                            ({costByProject[u.clientId]!.calls} calls)
                          </span>
                        </button>
                      ) : (
                        <span style={{ fontSize: 11, color: "var(--t3,#555)" }}>—</span>
                      )}
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
                          title="Generar link de pago"
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
                            <button
                              onClick={() => impersonate(u)}
                              disabled={processing === u.id || !u.isActive}
                              className="btn btn-sm btn-ghost"
                              title={u.isActive ? "Ver la app como este cliente" : "Activa al cliente primero"}
                              style={{ borderColor: "rgba(99,102,241,0.25)", color: "#6366f1" }}
                            >
                              <Eye size={11} />
                              Ver como
                            </button>
                            <button
                              onClick={() => setPlansClient(u)}
                              className="btn btn-sm btn-ghost"
                              title="Gestionar plan y créditos del proyecto"
                              style={{ borderColor: "rgba(200,168,75,0.3)", color: "var(--gold)" }}
                            >
                              <CreditCard size={11} />
                              Plan
                            </button>
                            <button
                              onClick={() => setCostsClient(u)}
                              className="btn btn-sm btn-ghost"
                              title="Ver costes de IA de este cliente"
                              style={{ borderColor: "rgba(200,168,75,0.2)", color: "var(--gold)" }}
                            >
                              <DollarSign size={11} />
                              Costes
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
                        {u.role === "client" && (
                          <button
                            onClick={() => setDeleteClient(u)}
                            disabled={processing === u.id}
                            className="btn btn-sm btn-ghost"
                            title="Borrar definitivamente este cliente"
                            style={{ borderColor: "rgba(239,68,68,0.35)", color: "var(--crim,#ef4444)" }}
                            data-testid={`delete-client-btn-${u.id}`}
                          >
                            <Trash2 size={11} />
                            Borrar
                          </button>
                        )}
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
