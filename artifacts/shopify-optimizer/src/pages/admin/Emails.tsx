import { useState, useEffect } from "react";
import { Plus, Zap, RefreshCw, Trash2, Eye, Send, ChevronRight, CheckCircle, AlertCircle, Clock, Loader2 } from "lucide-react";
import GenerationProgress from "@/components/GenerationProgress";
import ReferenceMediaPanel from "@/components/ReferenceMediaPanel";

const API = import.meta.env.BASE_URL.replace(/\/$/, "");

type FlowType = "checkout_abandoned" | "order_placed" | "welcome" | "win_back" | "review_requested" | "vip_upgrade" | "stock_back" | "price_drop";
type Tone = "urgente" | "amigable" | "premium" | "casual" | "formal";
type Delay = "immediate" | "1h" | "3h" | "24h" | "3d" | "7d";
type KlaviyoStatus = "draft" | "live" | "error";

interface EmailFlow {
  id: number;
  project_id: number;
  name: string;
  flow_type: FlowType;
  trigger_type: FlowType;
  send_delay: Delay;
  subject_a: string;
  subject_b: string;
  preview_text: string;
  tone: Tone;
  language: string;
  html_content: string;
  text_content: string;
  variables_used: string;
  from_email: string;
  from_name: string;
  reply_email: string;
  klaviyo_template_id: string;
  klaviyo_flow_id: string;
  klaviyo_status: KlaviyoStatus;
  klaviyo_error: string;
  open_rate: number;
  click_rate: number;
  pushed_at: string;
  created_at: string;
}

interface Project { id: number; name: string; shop_domain: string; }

const FLOW_TYPES: Record<FlowType, { label: string; icon: string; description: string }> = {
  checkout_abandoned: { label: "Carrito abandonado", icon: "🛒", description: "Recupera ventas perdidas" },
  order_placed: { label: "Confirmación pedido", icon: "✅", description: "Confirmación y upsell" },
  welcome: { label: "Bienvenida", icon: "👋", description: "Primera impresión perfecta" },
  win_back: { label: "Reactivación", icon: "💫", description: "Clientes inactivos 30+ días" },
  review_requested: { label: "Solicitar reseña", icon: "⭐", description: "Prueba social automatizada" },
  vip_upgrade: { label: "VIP Upgrade", icon: "👑", description: "Clientes >€200 gastados" },
  stock_back: { label: "Restock", icon: "📦", description: "Aviso de disponibilidad" },
  price_drop: { label: "Bajada de precio", icon: "💸", description: "Conversión de indecisos" },
};

const TONES: Record<Tone, string> = {
  urgente: "Urgente / Escasez",
  amigable: "Amigable / Cercano",
  premium: "Premium / Exclusivo",
  casual: "Casual / Informal",
  formal: "Formal / Profesional",
};

const DELAYS: Record<Delay, string> = {
  immediate: "Inmediato",
  "1h": "1 hora después",
  "3h": "3 horas después",
  "24h": "24 horas después",
  "3d": "3 días después",
  "7d": "7 días después",
};

const STATUS_CONFIG: Record<KlaviyoStatus, { label: string; color: string; icon: React.ReactNode }> = {
  draft: { label: "Borrador", color: "#6b7280", icon: <Clock size={13} /> },
  live: { label: "Live en Klaviyo", color: "#10b981", icon: <CheckCircle size={13} /> },
  error: { label: "Error", color: "#ef4444", icon: <AlertCircle size={13} /> },
};

function TickIcon({ size, style }: { size: number; style?: React.CSSProperties }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={style}>
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}

function FlowCard({ flow, selected, onSelect, onDelete }: { flow: EmailFlow; selected: boolean; onSelect: () => void; onDelete: () => void }) {
  const ft = FLOW_TYPES[flow.flow_type] || FLOW_TYPES[flow.trigger_type];
  const status = STATUS_CONFIG[(flow.klaviyo_status || "draft") as KlaviyoStatus];

  return (
    <div
      style={{
        background: selected ? "rgba(200,168,75,0.08)" : "var(--ink2)",
        border: `1px solid ${selected ? "rgba(200,168,75,0.35)" : "var(--bdr)"}`,
        borderRadius: 12, padding: "14px 16px", cursor: "pointer", transition: "all 0.2s",
      }}
      onClick={onSelect}
      onMouseEnter={e => { if (!selected) (e.currentTarget as HTMLDivElement).style.borderColor = "rgba(200,168,75,0.2)"; }}
      onMouseLeave={e => { if (!selected) (e.currentTarget as HTMLDivElement).style.borderColor = "var(--bdr)"; }}
    >
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 8 }}>
        <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
          <span style={{ fontSize: 18 }}>{ft?.icon || "📧"}</span>
          <div>
            <div style={{ fontWeight: 600, color: "var(--t1)", fontSize: 13, marginBottom: 2 }}>{flow.name}</div>
            <div style={{ fontSize: 11, color: "var(--t2)" }}>{ft?.label}</div>
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 10, color: status.color, flexShrink: 0 }}>
          {status.icon} {status.label}
        </div>
      </div>
      {flow.subject_a && (
        <div style={{ marginTop: 8, fontSize: 11, color: "var(--t3)", borderTop: "1px solid var(--bdr)", paddingTop: 8, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
          💬 {flow.subject_a}
        </div>
      )}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 8 }}>
        <span style={{ fontSize: 10, color: "var(--t3)" }}>{DELAYS[flow.send_delay] || flow.send_delay}</span>
        <button
          onClick={e => { e.stopPropagation(); onDelete(); }}
          style={{ background: "none", border: "none", cursor: "pointer", color: "var(--t3)", padding: 2, transition: "color 0.2s" }}
          onMouseEnter={e => (e.currentTarget.style.color = "#ef4444")}
          onMouseLeave={e => (e.currentTarget.style.color = "var(--t3)")}>
          <Trash2 size={12} />
        </button>
      </div>
    </div>
  );
}

export default function Emails() {
  const [flows, setFlows] = useState<EmailFlow[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<number | null>(null);
  const [selectedFlow, setSelectedFlow] = useState<EmailFlow | null>(null);
  const [tab, setTab] = useState<"disenar" | "contenido" | "activar">("disenar");
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [referenceIntelligence, setReferenceIntelligence] = useState<string | null>(null);
  const [pushing, setPushing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [showBuilder, setShowBuilder] = useState(false);
  const [mobilePanel, setMobilePanel] = useState<"flows" | "editor">("flows");

  const [form, setForm] = useState({
    name: "", flow_type: "checkout_abandoned" as FlowType, send_delay: "1h" as Delay,
    subject_a: "", subject_b: "", preview_text: "",
    tone: "urgente" as Tone, language: "es",
    include_image: true, include_discount: true, include_urgency: true, include_reviews: false,
    from_email: "craftershopy@gmail.com", from_name: "ShopyBrain", reply_email: "craftershopy@gmail.com",
    html_content: "", text_content: "", variables_used: "",
  });

  useEffect(() => { fetchProjects(); fetchFlows(); }, []);

  async function fetchProjects() {
    try {
      const res = await fetch(`${API}/api/projects`, { credentials: "include" });
      const data = await res.json();
      const list: Project[] = data.projects || data || [];
      setProjects(list);
      if (list.length) setSelectedProjectId(list[0].id);
    } catch { }
  }

  async function fetchFlows(pid?: number) {
    setLoading(true);
    try {
      const id = pid ?? selectedProjectId;
      const url = id ? `${API}/api/emails/flows?projectId=${id}` : `${API}/api/emails/flows`;
      const res = await fetch(url, { credentials: "include" });
      if (res.ok) setFlows(await res.json());
    } catch { }
    setLoading(false);
  }

  function openNew() {
    setSelectedFlow(null);
    setForm({
      name: "", flow_type: "checkout_abandoned", send_delay: "1h",
      subject_a: "", subject_b: "", preview_text: "",
      tone: "urgente", language: "es",
      include_image: true, include_discount: true, include_urgency: true, include_reviews: false,
      from_email: "craftershopy@gmail.com", from_name: "ShopyBrain", reply_email: "craftershopy@gmail.com",
      html_content: "", text_content: "", variables_used: "",
    });
    setTab("disenar");
    setShowBuilder(true);
  }

  function openFlow(flow: EmailFlow) {
    setSelectedFlow(flow);
    setForm({
      name: flow.name || "",
      flow_type: (flow.flow_type || flow.trigger_type) as FlowType,
      send_delay: (flow.send_delay as Delay) || "1h",
      subject_a: flow.subject_a || "", subject_b: flow.subject_b || "",
      preview_text: flow.preview_text || "", tone: (flow.tone || "urgente") as Tone,
      language: flow.language || "es",
      include_image: true, include_discount: true, include_urgency: true, include_reviews: false,
      from_email: flow.from_email || "craftershopy@gmail.com", from_name: flow.from_name || "ShopyBrain", reply_email: flow.reply_email || "craftershopy@gmail.com",
      html_content: flow.html_content || "", text_content: flow.text_content || "",
      variables_used: flow.variables_used || "",
    });
    setTab("disenar");
    setShowBuilder(true);
  }

  async function saveFlow(): Promise<EmailFlow | null> {
    setSaving(true);
    try {
      const body = {
        project_id: selectedProjectId,
        name: form.name || `Flow ${form.flow_type}`,
        flow_type: form.flow_type, trigger_type: form.flow_type,
        send_delay: form.send_delay, subject_a: form.subject_a,
        subject_b: form.subject_b, preview_text: form.preview_text,
        tone: form.tone, language: form.language,
        from_email: form.from_email, from_name: form.from_name, reply_email: form.reply_email,
        html_content: form.html_content, text_content: form.text_content, variables_used: form.variables_used,
      };
      let saved: EmailFlow;
      if (selectedFlow) {
        const res = await fetch(`${API}/api/emails/flows/${selectedFlow.id}`, {
          method: "PUT", credentials: "include",
          headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
        });
        saved = await res.json();
      } else {
        const res = await fetch(`${API}/api/emails/flows`, {
          method: "POST", credentials: "include",
          headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
        });
        saved = await res.json();
        setSelectedFlow(saved);
      }
      await fetchFlows();
      setSaving(false);
      return saved;
    } catch { setSaving(false); return null; }
  }

  async function generateEmail() {
    setGenerating(true);
    try {
      const includeOptions = [
        form.include_image && "foto producto",
        form.include_discount && "código de descuento",
        form.include_urgency && "urgencia y escasez",
        form.include_reviews && "reseñas de clientes",
      ].filter(Boolean) as string[];

      const res = await fetch(`${API}/api/emails/generate`, {
        method: "POST", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          flowType: FLOW_TYPES[form.flow_type]?.label || form.flow_type,
          tone: form.tone, projectId: selectedProjectId,
          includeOptions, language: form.language,
          referenceContext: referenceIntelligence ?? undefined,
        }),
      });
      if (!res.ok) throw new Error(await res.text());
      const data = await res.json();

      setForm(prev => ({
        ...prev,
        subject_a: data.subject_a || prev.subject_a,
        subject_b: data.subject_b || prev.subject_b,
        preview_text: data.preview_text || prev.preview_text,
        html_content: data.html || "",
        text_content: data.text || "",
        variables_used: (data.variables_used || []).join(", "),
      }));

      if (selectedFlow) {
        await fetch(`${API}/api/emails/flows/${selectedFlow.id}`, {
          method: "PUT", credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            html_content: data.html, text_content: data.text,
            subject_a: data.subject_a, subject_b: data.subject_b,
            preview_text: data.preview_text,
            variables_used: (data.variables_used || []).join(", "),
          }),
        });
      }
      setTab("contenido");
    } catch (e: any) {
      alert("Error: " + e.message);
    }
    setGenerating(false);
  }

  async function pushToKlaviyo() {
    let flow = selectedFlow;
    if (!flow) { flow = await saveFlow(); }
    if (!flow) { alert("Error guardando flow"); return; }
    if (!form.html_content) { alert("Genera el contenido del email primero"); return; }

    setPushing(true);
    try {
      const res = await fetch(`${API}/api/emails/flows/${flow.id}/push`, {
        method: "POST", credentials: "include",
        headers: { "Content-Type": "application/json" },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Push failed");
      await fetchFlows();
      alert("✅ Flow activado en Klaviyo exitosamente");
    } catch (e: any) {
      alert("Error al enviar a Klaviyo: " + e.message);
    }
    setPushing(false);
  }

  async function deleteFlow(id: number) {
    if (!confirm("¿Eliminar este flow?")) return;
    await fetch(`${API}/api/emails/flows/${id}`, { method: "DELETE", credentials: "include" });
    await fetchFlows();
    if (selectedFlow?.id === id) { setSelectedFlow(null); setShowBuilder(false); }
  }

  const liveFlow = selectedFlow ? flows.find(f => f.id === selectedFlow.id) : null;
  const currentStatus = (liveFlow?.klaviyo_status || "draft") as KlaviyoStatus;

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "calc(100vh - 56px)", overflow: "hidden" }}>
      {/* Mobile tab bar — only visible on mobile via CSS */}
      <div className="emails-mobile-tabs" style={{ borderBottom: "1px solid var(--bdr)", background: "var(--ink)" }}>
        {(["flows", "editor"] as const).map(panel => (
          <button key={panel} onClick={() => { setMobilePanel(panel); if (panel === "editor" && !showBuilder) openNew(); }}
            style={{
              flex: 1, padding: "11px 0", fontSize: 13, fontWeight: 600,
              border: "none", cursor: "pointer", background: "transparent",
              color: mobilePanel === panel ? "var(--gold)" : "var(--t3)",
              borderBottom: mobilePanel === panel ? "2px solid var(--gold)" : "2px solid transparent",
              display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
            }}
          >
            {panel === "flows" ? "📋 Flows" : "✏️ Editor"}
          </button>
        ))}
      </div>

      <div style={{ display: "flex", flex: 1, overflow: "hidden" }}>
      {/* Left sidebar */}
      <div className={`emails-sidebar${mobilePanel === "flows" ? " mobile-visible" : ""}`}
        style={{ width: 260, borderRight: "1px solid var(--bdr)", display: "flex", flexDirection: "column", overflow: "hidden", flexShrink: 0 }}>
        <div style={{ padding: "14px 14px 10px", borderBottom: "1px solid var(--bdr)" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
            <span style={{ fontSize: 13, fontWeight: 700, color: "var(--t1)" }}>Email Flows</span>
            <button onClick={openNew}
              style={{ background: "var(--gold)", border: "none", borderRadius: 7, padding: "4px 10px", cursor: "pointer", fontSize: 11, fontWeight: 700, color: "#000", display: "flex", alignItems: "center", gap: 3 }}>
              <Plus size={11} /> Nuevo
            </button>
          </div>
          {projects.length > 1 && (
            <select value={selectedProjectId || ""}
              onChange={e => { const v = Number(e.target.value); setSelectedProjectId(v); fetchFlows(v); }}
              style={{ width: "100%", background: "var(--ink)", border: "1px solid var(--bdr)", borderRadius: 7, padding: "5px 8px", color: "var(--t1)", fontSize: 11 }}>
              {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          )}
        </div>

        <div style={{ flex: 1, overflowY: "auto", padding: 10, display: "flex", flexDirection: "column", gap: 7 }}>
          {loading ? (
            <div style={{ textAlign: "center", padding: 32 }}>
              <Loader2 size={16} style={{ color: "var(--t3)", animation: "spin 0.6s linear infinite" }} />
            </div>
          ) : flows.length === 0 ? (
            <div style={{ textAlign: "center", padding: "40px 12px", color: "var(--t3)", fontSize: 12 }}>
              <div style={{ fontSize: 28, marginBottom: 10 }}>📧</div>
              <p>Crea tu primer email flow</p>
            </div>
          ) : flows.map(f => (
            <FlowCard key={f.id} flow={f} selected={selectedFlow?.id === f.id}
              onSelect={() => openFlow(f)} onDelete={() => deleteFlow(f.id)} />
          ))}
        </div>

        <div style={{ padding: "10px 14px", borderTop: "1px solid var(--bdr)", background: "rgba(200,168,75,0.04)" }}>
          <p style={{ fontSize: 10, color: "var(--t3)", margin: 0, lineHeight: 1.5 }}>
            <strong style={{ color: "#c8a84b" }}>OmniCore</strong> escribe · Tu app controla · <strong style={{ color: "#c8a84b" }}>Klaviyo</strong> solo entrega
          </p>
        </div>
      </div>

      {/* Main */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
        {!showBuilder ? (
          <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", gap: 16, color: "var(--t3)" }}>
            <div style={{ fontSize: 56 }}>🤖</div>
            <div style={{ textAlign: "center" }}>
              <p style={{ fontSize: 18, fontWeight: 700, color: "var(--t1)", margin: "0 0 6px" }}>Constructor de Email Flows</p>
              <p style={{ fontSize: 13, color: "var(--t2)" }}>OmniCore genera el HTML · Tú defines la lógica · Klaviyo entrega</p>
            </div>
            <div style={{ display: "flex", gap: 12, marginTop: 8 }}>
              {["Tu app en la app", "OmniCore escribe", "Klaviyo envía"].map((step, i) => (
                <div key={i} style={{ background: "var(--ink2)", border: "1px solid var(--bdr)", borderRadius: 10, padding: "12px 18px", textAlign: "center", fontSize: 12, color: "var(--t2)" }}>
                  <div style={{ fontSize: 20, marginBottom: 6 }}>{"🎯🤖📩"[i]}</div>
                  {step}
                </div>
              ))}
            </div>
            <button onClick={openNew}
              style={{ marginTop: 8, background: "linear-gradient(135deg, #c8a84b, #e8c87b)", border: "none", borderRadius: 10, padding: "11px 28px", cursor: "pointer", fontWeight: 700, color: "#000", fontSize: 14 }}>
              + Crear primer flow
            </button>
          </div>
        ) : (
          <>
            {/* Tab bar */}
            <div style={{ borderBottom: "1px solid var(--bdr)", padding: "0 24px", display: "flex", alignItems: "center", background: "var(--ink2)" }}>
              {(["disenar", "contenido", "activar"] as const).map((t, i) => {
                const labels = ["1. Diseñar", "2. Contenido", "3. Activar"];
                const done = [!!form.subject_a, !!form.html_content, false];
                return (
                  <button key={t} onClick={() => setTab(t)}
                    style={{
                      background: "none", border: "none", padding: "13px 18px", cursor: "pointer",
                      color: tab === t ? "var(--gold)" : "var(--t2)",
                      fontWeight: tab === t ? 700 : 400, fontSize: 12,
                      borderBottom: tab === t ? "2px solid var(--gold)" : "2px solid transparent",
                      transition: "all 0.2s", display: "flex", alignItems: "center", gap: 5,
                    }}>
                    {labels[i]}
                    {done[i] && <CheckCircle size={11} style={{ color: "#10b981" }} />}
                  </button>
                );
              })}
              <div style={{ flex: 1 }} />
              <button onClick={() => saveFlow()} disabled={saving}
                style={{ background: "rgba(200,168,75,0.12)", border: "1px solid rgba(200,168,75,0.25)", borderRadius: 7, padding: "5px 12px", cursor: "pointer", color: "#c8a84b", fontSize: 11, fontWeight: 600 }}>
                {saving ? "..." : "Guardar"}
              </button>
            </div>

            <div style={{ flex: 1, overflowY: "auto", padding: "24px" }}>

              {/* TAB 1: Diseñar */}
              {tab === "disenar" && (
                <div style={{ maxWidth: 640, display: "flex", flexDirection: "column", gap: 18 }}>
                  <div>
                    <label style={{ fontSize: 11, color: "var(--t3)", fontWeight: 700, display: "block", marginBottom: 5, textTransform: "uppercase" }}>Nombre del flow</label>
                    <input value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
                      placeholder="Ej: Carrito abandonado — Fashion Store"
                      style={{ width: "100%", background: "var(--ink2)", border: "1px solid var(--bdr)", borderRadius: 10, padding: "10px 14px", color: "var(--t1)", fontSize: 14 }} />
                  </div>

                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(200px, 100%), 1fr))", gap: 14 }}>
                    <div>
                      <label style={{ fontSize: 11, color: "var(--t3)", fontWeight: 700, display: "block", marginBottom: 5, textTransform: "uppercase" }}>Tipo de flow</label>
                      <select value={form.flow_type} onChange={e => setForm(p => ({ ...p, flow_type: e.target.value as FlowType }))}
                        style={{ width: "100%", background: "var(--ink2)", border: "1px solid var(--bdr)", borderRadius: 10, padding: "9px 12px", color: "var(--t1)", fontSize: 13 }}>
                        {Object.entries(FLOW_TYPES).map(([v, d]) => (
                          <option key={v} value={v}>{d.icon} {d.label}</option>
                        ))}
                      </select>
                      {form.flow_type && <p style={{ fontSize: 11, color: "var(--t3)", marginTop: 4, margin: "4px 0 0" }}>{FLOW_TYPES[form.flow_type]?.description}</p>}
                    </div>
                    <div>
                      <label style={{ fontSize: 11, color: "var(--t3)", fontWeight: 700, display: "block", marginBottom: 5, textTransform: "uppercase" }}>Delay de envío</label>
                      <select value={form.send_delay} onChange={e => setForm(p => ({ ...p, send_delay: e.target.value as Delay }))}
                        style={{ width: "100%", background: "var(--ink2)", border: "1px solid var(--bdr)", borderRadius: 10, padding: "9px 12px", color: "var(--t1)", fontSize: 13 }}>
                        {Object.entries(DELAYS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                      </select>
                    </div>
                  </div>

                  <div>
                    <label style={{ fontSize: 11, color: "var(--t3)", fontWeight: 700, display: "block", marginBottom: 5, textTransform: "uppercase" }}>Asuntos A/B (OmniCore los genera en el siguiente paso)</label>
                    <input value={form.subject_a} onChange={e => setForm(p => ({ ...p, subject_a: e.target.value }))}
                      placeholder="A: Tu carrito te espera — solo por hoy"
                      style={{ width: "100%", background: "var(--ink2)", border: "1px solid var(--bdr)", borderRadius: 9, padding: "9px 12px", color: "var(--t1)", fontSize: 13, marginBottom: 7 }} />
                    <input value={form.subject_b} onChange={e => setForm(p => ({ ...p, subject_b: e.target.value }))}
                      placeholder="B: ¿Olvidaste algo, {{ first_name }}?"
                      style={{ width: "100%", background: "var(--ink2)", border: "1px solid var(--bdr)", borderRadius: 9, padding: "9px 12px", color: "var(--t1)", fontSize: 13 }} />
                  </div>

                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(200px, 100%), 1fr))", gap: 14 }}>
                    <div>
                      <label style={{ fontSize: 11, color: "var(--t3)", fontWeight: 700, display: "block", marginBottom: 5, textTransform: "uppercase" }}>Tono del email</label>
                      <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
                        {Object.entries(TONES).map(([v, l]) => (
                          <button key={v} onClick={() => setForm(p => ({ ...p, tone: v as Tone }))}
                            style={{ background: form.tone === v ? "rgba(200,168,75,0.12)" : "var(--ink2)", border: `1px solid ${form.tone === v ? "rgba(200,168,75,0.35)" : "var(--bdr)"}`, borderRadius: 8, padding: "7px 12px", cursor: "pointer", color: form.tone === v ? "#c8a84b" : "var(--t2)", fontSize: 12, textAlign: "left", fontWeight: form.tone === v ? 700 : 400, transition: "all 0.15s" }}>
                            {l}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div>
                      <label style={{ fontSize: 11, color: "var(--t3)", fontWeight: 700, display: "block", marginBottom: 5, textTransform: "uppercase" }}>Incluir en el email</label>
                      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                        {[
                          { k: "include_image", l: "📷 Foto del producto" },
                          { k: "include_discount", l: "🏷️ Código de descuento" },
                          { k: "include_urgency", l: "⏰ Urgencia / escasez" },
                          { k: "include_reviews", l: "⭐ Reseñas de clientes" },
                        ].map(({ k, l }) => (
                          <label key={k} style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", fontSize: 12, color: "var(--t2)" }}>
                            <input type="checkbox" checked={(form as any)[k]} onChange={e => setForm(p => ({ ...p, [k]: e.target.checked }))}
                              style={{ accentColor: "#c8a84b", width: 14, height: 14 }} />
                            {l}
                          </label>
                        ))}
                      </div>

                      <div style={{ marginTop: 16 }}>
                        <label style={{ fontSize: 11, color: "var(--t3)", fontWeight: 700, display: "block", marginBottom: 5, textTransform: "uppercase" }}>Remitente</label>
                        <input value={form.from_name} onChange={e => setForm(p => ({ ...p, from_name: e.target.value }))}
                          placeholder="Nombre" style={{ width: "100%", background: "var(--ink2)", border: "1px solid var(--bdr)", borderRadius: 7, padding: "6px 10px", color: "var(--t1)", fontSize: 12, marginBottom: 5 }} />
                        <input value={form.from_email} onChange={e => setForm(p => ({ ...p, from_email: e.target.value }))}
                          placeholder="craftershopy@gmail.com" style={{ width: "100%", background: "var(--ink2)", border: "1px solid var(--bdr)", borderRadius: 7, padding: "6px 10px", color: "var(--t1)", fontSize: 12 }} />
                      </div>
                    </div>
                  </div>

                  <button onClick={() => { saveFlow(); setTab("contenido"); }}
                    style={{ background: "linear-gradient(135deg, #c8a84b, #e8c87b)", border: "none", borderRadius: 10, padding: "11px 22px", cursor: "pointer", fontWeight: 700, color: "#000", fontSize: 13, alignSelf: "flex-start", display: "flex", alignItems: "center", gap: 8 }}>
                    Siguiente → Contenido <ChevronRight size={15} />
                  </button>
                </div>
              )}

              {/* TAB 2: Contenido */}
              {tab === "contenido" && (
                <div style={{ maxWidth: 780, display: "flex", flexDirection: "column", gap: 18 }}>
                  <ReferenceMediaPanel
                    projectId={selectedProjectId ?? undefined}
                    onIntelligenceReady={setReferenceIntelligence}
                    context="Email marketing de ecommerce Shopify"
                    collapsed
                  />
                  <GenerationProgress
                    active={generating}
                    operation="email"
                    title="OmniCore escribiendo tu email..."
                    subtitle="ShopyBrain genera copy persuasivo, subject lines A/B y HTML para Klaviyo"
                  />
                  <div style={{ background: "var(--ink2)", border: "1px solid var(--bdr)", borderRadius: 14, padding: 20 }}>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
                      <div>
                        <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: "var(--t1)" }}>Generador OmniCore</h3>
                        <p style={{ margin: "4px 0 0", fontSize: 12, color: "var(--t2)" }}>Genera el HTML completo del email — listo para Klaviyo</p>
                      </div>
                      <button onClick={generateEmail} disabled={generating}
                        style={{ background: "linear-gradient(135deg, #c8a84b, #e8c87b)", border: "none", borderRadius: 9, padding: "9px 18px", cursor: generating ? "wait" : "pointer", fontWeight: 700, color: "#000", fontSize: 12, display: "flex", alignItems: "center", gap: 7, opacity: generating ? 0.75 : 1 }}>
                        {generating ? <><Loader2 size={13} style={{ animation: "spin 0.6s linear infinite" }} /> Generando...</> : <><Zap size={13} /> Generar email completo</>}
                      </button>
                    </div>

                    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(160px, 100%), 1fr))", gap: 10, marginBottom: 16 }}>
                      {[
                        { l: "Flow", v: `${FLOW_TYPES[form.flow_type]?.icon} ${FLOW_TYPES[form.flow_type]?.label}` },
                        { l: "Tono", v: TONES[form.tone] },
                        { l: "Delay", v: DELAYS[form.send_delay] },
                        { l: "Idioma", v: form.language === "es" ? "Español" : form.language },
                      ].map(({ l, v }) => (
                        <div key={l} style={{ padding: "8px 12px", background: "rgba(255,255,255,0.03)", borderRadius: 8 }}>
                          <div style={{ fontSize: 10, color: "var(--t3)", marginBottom: 3, textTransform: "uppercase" }}>{l}</div>
                          <div style={{ fontSize: 12, color: "var(--t1)", fontWeight: 600 }}>{v}</div>
                        </div>
                      ))}
                    </div>

                    {form.subject_a && (
                      <div style={{ marginBottom: 16, display: "flex", flexDirection: "column", gap: 6 }}>
                        <div style={{ padding: "9px 14px", background: "rgba(200,168,75,0.08)", border: "1px solid rgba(200,168,75,0.2)", borderRadius: 8 }}>
                          <span style={{ fontSize: 10, color: "#c8a84b", fontWeight: 800, textTransform: "uppercase" }}>A · </span>
                          <span style={{ fontSize: 13, color: "var(--t1)" }}>{form.subject_a}</span>
                        </div>
                        {form.subject_b && (
                          <div style={{ padding: "9px 14px", background: "rgba(200,168,75,0.05)", border: "1px solid rgba(200,168,75,0.12)", borderRadius: 8 }}>
                            <span style={{ fontSize: 10, color: "#c8a84b", fontWeight: 800, textTransform: "uppercase" }}>B · </span>
                            <span style={{ fontSize: 13, color: "var(--t1)" }}>{form.subject_b}</span>
                          </div>
                        )}
                        {form.preview_text && <p style={{ fontSize: 11, color: "var(--t3)", margin: "2px 14px 0" }}>Preview: {form.preview_text}</p>}
                      </div>
                    )}

                    {form.variables_used && (
                      <div style={{ padding: "7px 12px", background: "rgba(167,139,250,0.08)", border: "1px solid rgba(167,139,250,0.2)", borderRadius: 7, marginBottom: 14, fontSize: 11 }}>
                        <span style={{ color: "#a78bfa", fontWeight: 700 }}>VARIABLES KLAVIYO: </span>
                        <span style={{ color: "var(--t2)" }}>{form.variables_used}</span>
                      </div>
                    )}

                    {!form.html_content ? (
                      <div style={{ padding: "40px 24px", textAlign: "center", border: "2px dashed var(--bdr)", borderRadius: 12 }}>
                        <div style={{ fontSize: 36, marginBottom: 10 }}>🤖</div>
                        <p style={{ fontSize: 13, color: "var(--t2)", margin: 0 }}>Pulsa "Generar email completo" para que OmniCore escriba el HTML profesional</p>
                      </div>
                    ) : (
                      <div>
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
                          <span style={{ fontSize: 12, color: "#10b981", display: "flex", alignItems: "center", gap: 6, fontWeight: 600 }}>
                            <CheckCircle size={13} /> Email generado correctamente
                          </span>
                          <div style={{ display: "flex", gap: 8 }}>
                            <button onClick={() => setShowPreview(!showPreview)}
                              style={{ background: "var(--ink)", border: "1px solid var(--bdr)", borderRadius: 7, padding: "5px 11px", cursor: "pointer", color: "var(--t2)", fontSize: 11, display: "flex", alignItems: "center", gap: 5 }}>
                              <Eye size={11} /> {showPreview ? "Ocultar" : "Preview"}
                            </button>
                            <button onClick={generateEmail} disabled={generating}
                              style={{ background: "var(--ink)", border: "1px solid var(--bdr)", borderRadius: 7, padding: "5px 11px", cursor: "pointer", color: "var(--t2)", fontSize: 11, display: "flex", alignItems: "center", gap: 5 }}>
                              <RefreshCw size={11} /> Regenerar
                            </button>
                          </div>
                        </div>

                        {showPreview && (
                          <div style={{ border: "1px solid var(--bdr)", borderRadius: 10, overflow: "hidden", marginBottom: 12 }}>
                            <div style={{ background: "#111", padding: "7px 12px", fontSize: 10, color: "#555", borderBottom: "1px solid #222" }}>
                              Vista previa — las variables Klaviyo se sustituyen al enviar
                            </div>
                            <iframe srcDoc={form.html_content} style={{ width: "100%", height: 440, border: "none" }} title="Email preview" />
                          </div>
                        )}

                        <label style={{ fontSize: 10, color: "var(--t3)", fontWeight: 700, display: "block", marginBottom: 5, textTransform: "uppercase" }}>HTML del email (editable)</label>
                        <textarea value={form.html_content} onChange={e => setForm(p => ({ ...p, html_content: e.target.value }))}
                          style={{ width: "100%", height: 180, background: "#0a0a0f", border: "1px solid var(--bdr)", borderRadius: 9, padding: "9px 12px", color: "#8888aa", fontSize: 11, fontFamily: "monospace", resize: "vertical" }} />
                      </div>
                    )}
                  </div>

                  {form.html_content && (
                    <button onClick={() => { saveFlow(); setTab("activar"); }}
                      style={{ background: "linear-gradient(135deg, #c8a84b, #e8c87b)", border: "none", borderRadius: 10, padding: "11px 22px", cursor: "pointer", fontWeight: 700, color: "#000", fontSize: 13, alignSelf: "flex-start", display: "flex", alignItems: "center", gap: 8 }}>
                      Siguiente → Activar en Klaviyo <ChevronRight size={15} />
                    </button>
                  )}
                </div>
              )}

              {/* TAB 3: Activar */}
              {tab === "activar" && (
                <div style={{ maxWidth: 540 }}>
                  <div style={{ background: "var(--ink2)", border: "1px solid var(--bdr)", borderRadius: 16, padding: 24 }}>
                    <h3 style={{ margin: "0 0 18px", fontSize: 16, fontWeight: 700, color: "var(--t1)" }}>Activar en Klaviyo</h3>

                    {/* Summary */}
                    <div style={{ display: "flex", flexDirection: "column", gap: 9, marginBottom: 20, padding: "14px 16px", background: "rgba(255,255,255,0.03)", borderRadius: 10 }}>
                      {[
                        ["Flow", `${FLOW_TYPES[form.flow_type]?.icon} ${FLOW_TYPES[form.flow_type]?.label || form.flow_type}`],
                        ["Trigger", form.flow_type],
                        ["Delay", DELAYS[form.send_delay] || form.send_delay],
                        ["Tono", TONES[form.tone] || form.tone],
                        ["Asunto A", form.subject_a || "—"],
                        ["HTML", form.html_content ? `${Math.round(form.html_content.length / 1000)}k chars` : "❌ Pendiente"],
                      ].map(([l, v]) => (
                        <div key={l} style={{ display: "flex", gap: 12, fontSize: 13 }}>
                          <span style={{ color: "var(--t3)", minWidth: 80 }}>{l}:</span>
                          <span style={{ color: "var(--t1)", fontWeight: 600 }}>{v}</span>
                        </div>
                      ))}
                    </div>

                    {/* Klaviyo status */}
                    <div style={{ padding: "12px 14px", background: "rgba(255,255,255,0.03)", borderRadius: 10, marginBottom: 18 }}>
                      <div style={{ fontSize: 11, color: "var(--t3)", fontWeight: 700, textTransform: "uppercase", marginBottom: 6 }}>Estado en Klaviyo</div>
                      <div style={{ display: "flex", alignItems: "center", gap: 7, fontSize: 13 }}>
                        {STATUS_CONFIG[currentStatus].icon}
                        <span style={{ color: STATUS_CONFIG[currentStatus].color, fontWeight: 700 }}>{STATUS_CONFIG[currentStatus].label}</span>
                      </div>
                      {liveFlow?.klaviyo_flow_id && (
                        <div style={{ marginTop: 6, fontSize: 10, color: "var(--t3)" }}>
                          Template ID: {liveFlow.klaviyo_template_id} · Flow ID: {liveFlow.klaviyo_flow_id}
                        </div>
                      )}
                      {liveFlow?.klaviyo_error && (
                        <div style={{ marginTop: 6, fontSize: 11, color: "#ef4444" }}>{liveFlow.klaviyo_error}</div>
                      )}
                    </div>

                    {!form.html_content ? (
                      <div style={{ padding: "14px", background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.25)", borderRadius: 9, fontSize: 13, color: "#ef4444", marginBottom: 16 }}>
                        ⚠️ Debes generar el contenido del email primero (tab "Contenido")
                      </div>
                    ) : (
                      <div style={{ padding: "12px 14px", background: "rgba(16,185,129,0.08)", border: "1px solid rgba(16,185,129,0.2)", borderRadius: 9, marginBottom: 16 }}>
                        <p style={{ fontSize: 11, color: "#10b981", fontWeight: 700, margin: "0 0 7px" }}>Klaviyo creará automáticamente:</p>
                        {["Template HTML en Klaviyo", "Flow con trigger configurado", "A/B test de asuntos activado", "Smart sending habilitado"].map(item => (
                          <div key={item} style={{ display: "flex", alignItems: "center", gap: 7, fontSize: 12, color: "var(--t2)", marginBottom: 5 }}>
                            <TickIcon size={11} style={{ color: "#10b981" }} /> {item}
                          </div>
                        ))}
                      </div>
                    )}

                    <button onClick={pushToKlaviyo} disabled={pushing || !form.html_content}
                      style={{
                        width: "100%", padding: "13px 24px", borderRadius: 11, border: "none",
                        background: !form.html_content ? "rgba(255,255,255,0.05)" : "linear-gradient(135deg, #c8a84b, #e8c87b)",
                        color: !form.html_content ? "var(--t3)" : "#000",
                        fontWeight: 700, fontSize: 14, cursor: pushing || !form.html_content ? "not-allowed" : "pointer",
                        display: "flex", alignItems: "center", justifyContent: "center", gap: 9, opacity: pushing ? 0.75 : 1,
                        transition: "all 0.2s",
                      }}>
                      {pushing
                        ? <><Loader2 size={15} style={{ animation: "spin 0.6s linear infinite" }} /> Creando en Klaviyo...</>
                        : <><Send size={15} /> {currentStatus === "live" ? "Re-activar en Klaviyo" : "Crear y activar en Klaviyo"}</>
                      }
                    </button>

                    <p style={{ textAlign: "center", fontSize: 11, color: "var(--t3)", marginTop: 12, lineHeight: 1.5 }}>
                      Nunca necesitas abrir Klaviyo · ShopyBrain controla todo el contenido y la lógica
                    </p>
                  </div>
                </div>
              )}
            </div>
          </>
        )}
      </div>
      </div>
    </div>
  );
}
