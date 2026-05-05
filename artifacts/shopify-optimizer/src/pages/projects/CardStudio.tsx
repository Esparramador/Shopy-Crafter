/**
 * Card Studio — UI para crear tarjetas de presentación profesionales.
 *
 * Flujo:
 *  1. Lista de tarjetas del proyecto (sidebar izquierda)
 *  2. Editor de la tarjeta seleccionada (centro): datos, paleta, fonts, layout, fondo
 *  3. Preview live de FRONT + BACK (derecha) + acciones (Generar, Descargar PNG/PDF/SVG)
 */
import { useState, useEffect, useCallback, useMemo } from "react";
import { useRoute } from "wouter";
import {
  Loader2, Sparkles, Plus, Trash2, Download, Wand2, Save,
  CreditCard, RefreshCw, AlertCircle, CheckCircle2, Upload,
  Image as ImageIcon, FileText, QrCode, Palette, Move,
} from "lucide-react";
import CardStudioEditor, { type LayoutOverrides } from "./CardStudioEditor";

const API_BASE = import.meta.env.BASE_URL?.replace(/\/$/, "") ?? "";

type Palette = { bg: string; primary: string; secondary: string; accent: string; text: string };
type Fonts = { heading: string; body: string; weights?: { heading?: number; body?: number } };
type BackgroundConfig = { kind: "solid" | "gradient" | "ai-texture"; prompt?: string; hex?: string; gradientAngle?: number };

interface CardTemplate {
  id: string;
  name: string;
  description: string;
  category: string;
  palette: Palette;
  fonts: Fonts;
  layout: "centered" | "left" | "grid";
  background: BackgroundConfig;
  qrStyle: { fgColor: string; bgColor: string; margin: number; cornerRadius?: number };
}

interface BusinessCard {
  id: number;
  projectId: number;
  name: string;
  templateId: string;
  fullName: string;
  jobTitle?: string | null;
  companyName?: string | null;
  tagline?: string | null;
  email?: string | null;
  phone?: string | null;
  website?: string | null;
  socialHandle?: string | null;
  address?: string | null;
  qrUrl?: string | null;
  palette: Palette;
  fonts: Fonts;
  layout: "centered" | "left" | "grid";
  backgroundConfig: BackgroundConfig;
  status: "draft" | "generating" | "ready" | "failed";
  lastError?: string | null;
  generationCost?: string | null;
  frontUrl?: string | null;
  backUrl?: string | null;
  pdfUrl?: string | null;
  logoUrl?: string | null;
  logoVaultFileId?: number | null;
  frontImageVaultFileId?: number | null;
  backImageVaultFileId?: number | null;
  pdfVaultFileId?: number | null;
  metadata?: any;
  layoutOverrides?: LayoutOverrides;
  updatedAt: string;
}

const BG_MODELS = [
  { id: "recraft-v3",          label: "Recraft v3 ($0.04)",          tier: "best" },
  { id: "ideogram-v3-turbo",   label: "Ideogram v3 Turbo ($0.03)",  tier: "fast" },
  { id: "imagen-4-ultra",      label: "Imagen 4 Ultra ($0.06)",     tier: "premium" },
  { id: "nano-banana",         label: "Gemini Flash Image ($0.04)", tier: "fast" },
  { id: "flux-1.1-pro-ultra",  label: "Flux Pro Ultra ($0.06)",     tier: "premium" },
  { id: "flux-1.1-pro",        label: "Flux Pro ($0.04)",           tier: "balanced" },
  { id: "flux-schnell",        label: "Flux Schnell ($0.003)",      tier: "economy" },
  { id: "flux-kontext-pro",    label: "Flux Kontext ($0.05)",       tier: "balanced" },
];

const LAYOUTS: Array<{ id: "centered" | "left" | "grid"; label: string; desc: string }> = [
  { id: "centered", label: "Centrado",   desc: "Texto centrado · estilo lujo / clásico" },
  { id: "left",     label: "Izquierda",  desc: "Alineado izq · estilo moderno / agency" },
  { id: "grid",     label: "Grid",       desc: "Estructura 2 col · estilo corporate" },
];

const POPULAR_FONTS = [
  "Inter", "Cinzel", "Playfair Display", "Montserrat", "Lato",
  "Source Serif Pro", "Source Sans Pro", "Space Grotesk", "JetBrains Mono",
  "Poppins", "Raleway", "Crimson Pro", "DM Sans", "DM Serif Display",
];

export default function CardStudio() {
  const [, params] = useRoute("/projects/:id/cards");
  const projectId = params?.id ? parseInt(params.id) : 0;

  const [templates, setTemplates] = useState<CardTemplate[]>([]);
  const [cards, setCards] = useState<BusinessCard[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Editor visual de posiciones
  const [showEditor, setShowEditor] = useState(false);

  // Auto-design dialog state
  const [showAutoDesign, setShowAutoDesign] = useState(false);
  const [autoIndustry, setAutoIndustry] = useState("");
  const [autoVibe, setAutoVibe] = useState("");
  const [autoColor, setAutoColor] = useState("");
  const [autoBrand, setAutoBrand] = useState("");
  const [autoBusy, setAutoBusy] = useState(false);

  // ── Cargar catálogo y lista ──────────────────────────────────────────
  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const [tplRes, listRes] = await Promise.all([
          fetch(`${API_BASE}/api/cards/templates`, { credentials: "include" }),
          fetch(`${API_BASE}/api/projects/${projectId}/cards`, { credentials: "include" }),
        ]);
        if (cancelled) return;
        const tplData = await tplRes.json();
        const listData = await listRes.json();
        setTemplates(tplData.templates || []);
        setCards(listData.cards || []);
        if (listData.cards?.length && selectedId === null) {
          setSelectedId(listData.cards[0].id);
        }
      } catch (err: any) {
        setError(err?.message || "Error cargando datos");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId]);

  const selected = useMemo(
    () => cards.find((c) => c.id === selectedId) ?? null,
    [cards, selectedId],
  );

  // ── Crear nueva tarjeta ──────────────────────────────────────────────
  const createCard = useCallback(async (templateId: string) => {
    setError(null);
    try {
      const tpl = templates.find((t) => t.id === templateId);
      const res = await fetch(`${API_BASE}/api/projects/${projectId}/cards`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: `Nueva tarjeta · ${tpl?.name || templateId}`,
          templateId,
          fullName: "Nombre Apellido",
          jobTitle: "Cargo / Posición",
          companyName: "Tu Marca",
          tagline: "Descripción breve de tu propuesta de valor.",
          email: "hola@tumarca.com",
          phone: "+34 600 000 000",
          website: "tumarca.com",
          socialHandle: "@tumarca",
          qrUrl: "",
        }),
      });
      if (!res.ok) throw new Error((await res.json()).error || "Error creando tarjeta");
      const created: BusinessCard = await res.json();
      setCards((prev) => [created, ...prev]);
      setSelectedId(created.id);
    } catch (err: any) {
      setError(err?.message || "Error");
    }
  }, [projectId, templates]);

  // ── Guardar cambios ──────────────────────────────────────────────────
  const updateCard = useCallback(async (id: number, patch: Partial<BusinessCard>) => {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE}/api/cards/${id}`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      });
      if (!res.ok) throw new Error((await res.json()).error || "Error guardando");
      const updated: BusinessCard = await res.json();
      setCards((prev) => prev.map((c) => (c.id === id ? updated : c)));
    } catch (err: any) {
      setError(err?.message || "Error");
    } finally {
      setSaving(false);
    }
  }, []);

  const updateLocal = useCallback((patch: Partial<BusinessCard>) => {
    if (!selected) return;
    setCards((prev) => prev.map((c) => (c.id === selected.id ? { ...c, ...patch } : c)));
  }, [selected]);

  // ── Generar tarjeta ──────────────────────────────────────────────────
  const generateCard = useCallback(async (id: number, bgModel?: string) => {
    setGenerating(true);
    setError(null);
    setSuccess(null);
    try {
      // Primero guarda el estado actual (abortar si falla para no generar con datos viejos)
      const current = cards.find((c) => c.id === id);
      if (current) {
        const saveRes = await fetch(`${API_BASE}/api/cards/${id}`, {
          method: "PATCH",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: current.name,
            fullName: current.fullName,
            jobTitle: current.jobTitle,
            companyName: current.companyName,
            tagline: current.tagline,
            email: current.email,
            phone: current.phone,
            website: current.website,
            socialHandle: current.socialHandle,
            address: current.address,
            qrUrl: current.qrUrl,
            templateId: current.templateId,
            layout: current.layout,
            palette: current.palette,
            fonts: current.fonts,
            background: current.backgroundConfig,
          }),
        });
        if (!saveRes.ok) {
          const errBody = await saveRes.json().catch(() => ({}));
          throw new Error(`No se pudo autoguardar antes de generar: ${errBody.error || saveRes.statusText}`);
        }
      }

      const res = await fetch(`${API_BASE}/api/cards/${id}/generate`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ backgroundModel: bgModel }),
      });
      if (!res.ok) throw new Error((await res.json()).error || "Error generando");
      const data = await res.json();
      setCards((prev) => prev.map((c) => (c.id === id ? data.card : c)));
      setSuccess(`✓ Tarjeta generada (coste: $${data.cost?.toFixed(4) || "0.00"})`);
      setTimeout(() => setSuccess(null), 5000);
    } catch (err: any) {
      setError(err?.message || "Error generando");
    } finally {
      setGenerating(false);
    }
  }, [cards]);

  // ── Eliminar ─────────────────────────────────────────────────────────
  const deleteCard = useCallback(async (id: number) => {
    if (!confirm("¿Eliminar esta tarjeta?")) return;
    try {
      await fetch(`${API_BASE}/api/cards/${id}`, { method: "DELETE", credentials: "include" });
      setCards((prev) => prev.filter((c) => c.id !== id));
      if (selectedId === id) setSelectedId(null);
    } catch (err: any) {
      setError(err?.message || "Error eliminando");
    }
  }, [selectedId]);

  // ── Subir logo ───────────────────────────────────────────────────────
  const uploadLogo = useCallback(async (id: number, file: File) => {
    setError(null);
    try {
      const fd = new FormData();
      fd.append("logo", file);
      const res = await fetch(`${API_BASE}/api/cards/${id}/upload-logo`, {
        method: "POST",
        credentials: "include",
        body: fd,
      });
      if (!res.ok) throw new Error((await res.json()).error || "Error subiendo logo");
      const updated: BusinessCard = await res.json();
      setCards((prev) => prev.map((c) => (c.id === id ? updated : c)));
    } catch (err: any) {
      setError(err?.message || "Error");
    }
  }, []);

  // ── Auto-design ──────────────────────────────────────────────────────
  const runAutoDesign = useCallback(async () => {
    if (!selected) return;
    setAutoBusy(true);
    try {
      const res = await fetch(`${API_BASE}/api/cards/auto-design`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          industry: autoIndustry,
          vibe: autoVibe,
          preferredColor: autoColor,
          brandName: autoBrand,
        }),
      });
      if (!res.ok) throw new Error((await res.json()).error || "Error");
      const data = await res.json();
      // Aplica al estado local + persiste
      const patch: Partial<BusinessCard> = {
        templateId: data.templateId,
        palette: data.palette,
        fonts: data.fonts,
        backgroundConfig: data.background,
      };
      updateLocal(patch);
      await updateCard(selected.id, patch as any);
      setSuccess(`✓ Auto-design: ${data.rationale}`);
      setShowAutoDesign(false);
      setTimeout(() => setSuccess(null), 8000);
    } catch (err: any) {
      setError(err?.message || "Error en auto-design");
    } finally {
      setAutoBusy(false);
    }
  }, [autoIndustry, autoVibe, autoColor, autoBrand, selected, updateLocal, updateCard]);

  if (loading) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "60vh" }}>
        <Loader2 size={32} className="animate-spin" style={{ color: "var(--gold)" }} />
      </div>
    );
  }

  return (
    <div style={{ padding: "16px 20px 60px", maxWidth: 1600, margin: "0 auto" }}>
      {/* HEADER */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16, flexWrap: "wrap", gap: 12 }}>
        <div>
          <h1 style={{ fontSize: 22, margin: 0, display: "flex", alignItems: "center", gap: 10 }}>
            <CreditCard size={22} style={{ color: "var(--gold)" }} />
            Card Studio
          </h1>
          <p style={{ fontSize: 12, color: "var(--t3)", margin: "4px 0 0" }}>
            Tarjetas de presentación profesionales · 300 DPI · 85×55mm + 3mm sangrado · QR funcional · texto vectorial perfecto
          </p>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button
            onClick={() => setShowAutoDesign(true)}
            disabled={!selected}
            style={btnSecondary}
          >
            <Wand2 size={14} /> Auto-design IA
          </button>
        </div>
      </div>

      {error && (
        <div style={{ padding: 12, borderRadius: 8, background: "rgba(232,69,88,0.12)", color: "#e84558", border: "1px solid #e84558", marginBottom: 12, display: "flex", alignItems: "center", gap: 8, fontSize: 13 }}>
          <AlertCircle size={16} /> {error}
        </div>
      )}
      {success && (
        <div style={{ padding: 12, borderRadius: 8, background: "rgba(34,197,94,0.12)", color: "#22c55e", border: "1px solid #22c55e", marginBottom: 12, display: "flex", alignItems: "center", gap: 8, fontSize: 13 }}>
          <CheckCircle2 size={16} /> {success}
        </div>
      )}

      {/* GRID 3-col */}
      <div style={{ display: "grid", gridTemplateColumns: "260px 1fr 580px", gap: 16, alignItems: "start" }}>
        {/* ── COL 1: Lista de tarjetas + crear nueva ── */}
        <div style={panelStyle}>
          <h3 style={panelTitle}>Tarjetas ({cards.length})</h3>
          <div style={{ maxHeight: 360, overflowY: "auto", display: "flex", flexDirection: "column", gap: 6, marginBottom: 12 }}>
            {cards.length === 0 && (
              <p style={{ fontSize: 12, color: "var(--t3)", textAlign: "center", padding: 20 }}>
                Sin tarjetas todavía. Crea una abajo.
              </p>
            )}
            {cards.map((c) => (
              <div
                key={c.id}
                onClick={() => setSelectedId(c.id)}
                style={{
                  padding: 10, borderRadius: 6, cursor: "pointer",
                  background: selectedId === c.id ? "rgba(212,175,55,0.12)" : "rgba(255,255,255,0.02)",
                  border: selectedId === c.id ? "1px solid var(--gold)" : "1px solid transparent",
                  display: "flex", justifyContent: "space-between", alignItems: "center", gap: 6,
                }}
              >
                <div style={{ overflow: "hidden", flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: 500, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                    {c.name}
                  </div>
                  <div style={{ fontSize: 11, color: "var(--t3)", display: "flex", alignItems: "center", gap: 6 }}>
                    {c.fullName} · <StatusBadge status={c.status} />
                  </div>
                </div>
                <button
                  onClick={(e) => { e.stopPropagation(); deleteCard(c.id); }}
                  style={{ background: "none", border: "none", color: "var(--t3)", cursor: "pointer", padding: 4 }}
                  title="Eliminar"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
          </div>
          <h4 style={{ fontSize: 11, color: "var(--t3)", margin: "0 0 8px", letterSpacing: 1.4, textTransform: "uppercase" }}>
            Crear nueva con plantilla
          </h4>
          <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: 6 }}>
            {templates.map((t) => (
              <button
                key={t.id}
                onClick={() => createCard(t.id)}
                style={{
                  padding: "8px 10px", textAlign: "left", background: "rgba(255,255,255,0.03)",
                  border: "1px solid rgba(255,255,255,0.08)", borderRadius: 6, color: "var(--t1)",
                  cursor: "pointer", fontSize: 12,
                }}
                title={t.description}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <Plus size={12} />
                  <span style={{ fontWeight: 500 }}>{t.name}</span>
                </div>
                <div style={{ fontSize: 10, color: "var(--t3)", marginTop: 2 }}>
                  {t.category}
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* ── COL 2: Editor ── */}
        {selected ? (
          <div style={panelStyle}>
            <h3 style={panelTitle}>Editor</h3>

            <Section title="Identificación">
              <Field label="Nombre interno">
                <input value={selected.name} onChange={(e) => updateLocal({ name: e.target.value })} onBlur={() => updateCard(selected.id, { name: selected.name })} style={inputStyle} />
              </Field>
              <Field label="Plantilla base">
                <select value={selected.templateId} onChange={(e) => { const v = e.target.value; updateLocal({ templateId: v }); updateCard(selected.id, { templateId: v }); }} style={inputStyle}>
                  {templates.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
                </select>
              </Field>
            </Section>

            <Section title="Datos del titular">
              <Field label="Nombre completo *">
                <input value={selected.fullName} onChange={(e) => updateLocal({ fullName: e.target.value })} onBlur={() => updateCard(selected.id, { fullName: selected.fullName })} style={inputStyle} />
              </Field>
              <Field label="Cargo">
                <input value={selected.jobTitle ?? ""} onChange={(e) => updateLocal({ jobTitle: e.target.value })} onBlur={() => updateCard(selected.id, { jobTitle: selected.jobTitle })} style={inputStyle} />
              </Field>
              <Field label="Empresa / Marca">
                <input value={selected.companyName ?? ""} onChange={(e) => updateLocal({ companyName: e.target.value })} onBlur={() => updateCard(selected.id, { companyName: selected.companyName })} style={inputStyle} />
              </Field>
              <Field label="Tagline (frente)">
                <textarea value={selected.tagline ?? ""} onChange={(e) => updateLocal({ tagline: e.target.value })} onBlur={() => updateCard(selected.id, { tagline: selected.tagline })} style={{ ...inputStyle, minHeight: 50, resize: "vertical" }} />
              </Field>
            </Section>

            <Section title="Contacto (reverso)">
              <Field label="Email">
                <input value={selected.email ?? ""} onChange={(e) => updateLocal({ email: e.target.value })} onBlur={() => updateCard(selected.id, { email: selected.email })} style={inputStyle} />
              </Field>
              <Field label="Teléfono">
                <input value={selected.phone ?? ""} onChange={(e) => updateLocal({ phone: e.target.value })} onBlur={() => updateCard(selected.id, { phone: selected.phone })} style={inputStyle} />
              </Field>
              <Field label="Web">
                <input value={selected.website ?? ""} onChange={(e) => updateLocal({ website: e.target.value })} onBlur={() => updateCard(selected.id, { website: selected.website })} style={inputStyle} />
              </Field>
              <Field label="Social handle">
                <input value={selected.socialHandle ?? ""} onChange={(e) => updateLocal({ socialHandle: e.target.value })} onBlur={() => updateCard(selected.id, { socialHandle: selected.socialHandle })} style={inputStyle} />
              </Field>
              <Field label="Dirección">
                <input value={selected.address ?? ""} onChange={(e) => updateLocal({ address: e.target.value })} onBlur={() => updateCard(selected.id, { address: selected.address })} style={inputStyle} />
              </Field>
              <Field label={<>QR URL <span style={{ color: "var(--t3)" }}>(vacío → vCard auto)</span></>}>
                <input value={selected.qrUrl ?? ""} onChange={(e) => updateLocal({ qrUrl: e.target.value })} onBlur={() => updateCard(selected.id, { qrUrl: selected.qrUrl })} placeholder="https://… (opcional)" style={inputStyle} />
              </Field>
            </Section>

            <Section title="Diseño">
              <Field label="Layout">
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 6 }}>
                  {LAYOUTS.map((l) => (
                    <button
                      key={l.id}
                      onClick={() => { updateLocal({ layout: l.id }); updateCard(selected.id, { layout: l.id }); }}
                      style={{
                        padding: 8, fontSize: 11, borderRadius: 4,
                        background: selected.layout === l.id ? "rgba(212,175,55,0.18)" : "rgba(255,255,255,0.03)",
                        border: selected.layout === l.id ? "1px solid var(--gold)" : "1px solid rgba(255,255,255,0.08)",
                        color: "var(--t1)", cursor: "pointer", textAlign: "center",
                      }}
                      title={l.desc}
                    >
                      <div style={{ fontWeight: 600 }}>{l.label}</div>
                    </button>
                  ))}
                </div>
              </Field>
              <Field label="Paleta">
                <div style={{ display: "grid", gridTemplateColumns: "repeat(5,1fr)", gap: 6 }}>
                  {(["bg","primary","secondary","accent","text"] as const).map((k) => (
                    <div key={k} style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                      <label style={{ fontSize: 10, color: "var(--t3)" }}>{k}</label>
                      <input
                        type="color"
                        value={selected.palette?.[k] || "#000000"}
                        onChange={(e) => {
                          const newPal = { ...selected.palette, [k]: e.target.value };
                          updateLocal({ palette: newPal });
                        }}
                        onBlur={() => updateCard(selected.id, { palette: selected.palette as any })}
                        style={{ width: "100%", height: 32, border: "none", background: "transparent", padding: 0, cursor: "pointer" }}
                      />
                    </div>
                  ))}
                </div>
              </Field>
              <Field label="Tipografías (Google Fonts)">
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
                  <select
                    value={selected.fonts?.heading || "Inter"}
                    onChange={(e) => { const newF = { ...selected.fonts, heading: e.target.value }; updateLocal({ fonts: newF }); updateCard(selected.id, { fonts: newF as any }); }}
                    style={inputStyle}
                  >
                    {POPULAR_FONTS.map((f) => <option key={f} value={f}>{f}</option>)}
                  </select>
                  <select
                    value={selected.fonts?.body || "Inter"}
                    onChange={(e) => { const newF = { ...selected.fonts, body: e.target.value }; updateLocal({ fonts: newF }); updateCard(selected.id, { fonts: newF as any }); }}
                    style={inputStyle}
                  >
                    {POPULAR_FONTS.map((f) => <option key={f} value={f}>{f}</option>)}
                  </select>
                </div>
              </Field>
              <Field label="Fondo">
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 6, marginBottom: 6 }}>
                  {(["solid","gradient","ai-texture"] as const).map((k) => (
                    <button
                      key={k}
                      onClick={() => {
                        const newBg = { ...selected.backgroundConfig, kind: k };
                        updateLocal({ backgroundConfig: newBg });
                        updateCard(selected.id, { backgroundConfig: newBg as any });
                      }}
                      style={{
                        padding: 8, fontSize: 11, borderRadius: 4,
                        background: selected.backgroundConfig?.kind === k ? "rgba(212,175,55,0.18)" : "rgba(255,255,255,0.03)",
                        border: selected.backgroundConfig?.kind === k ? "1px solid var(--gold)" : "1px solid rgba(255,255,255,0.08)",
                        color: "var(--t1)", cursor: "pointer",
                      }}
                    >
                      {k === "solid" ? "Sólido" : k === "gradient" ? "Degradado" : "IA Textura"}
                    </button>
                  ))}
                </div>
                {selected.backgroundConfig?.kind === "ai-texture" && (
                  <textarea
                    value={selected.backgroundConfig?.prompt || ""}
                    onChange={(e) => {
                      const newBg = { ...selected.backgroundConfig, prompt: e.target.value };
                      updateLocal({ backgroundConfig: newBg });
                    }}
                    onBlur={() => updateCard(selected.id, { backgroundConfig: selected.backgroundConfig as any })}
                    placeholder="Prompt para IA (sin texto/letras): premium leather texture, fine grain, dramatic lighting…"
                    style={{ ...inputStyle, minHeight: 60, resize: "vertical" }}
                  />
                )}
              </Field>
              <Field label="Logo (opcional)">
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <label style={{ ...btnSecondary, cursor: "pointer" }}>
                    <Upload size={14} /> {selected.logoUrl ? "Cambiar logo" : "Subir logo"}
                    <input
                      type="file"
                      accept="image/png,image/jpeg,image/webp,image/svg+xml"
                      style={{ display: "none" }}
                      onChange={(e) => { if (e.target.files?.[0]) uploadLogo(selected.id, e.target.files[0]); }}
                    />
                  </label>
                  {selected.logoUrl && (
                    <img src={selected.logoUrl} alt="logo" style={{ height: 32, maxWidth: 80, objectFit: "contain", background: "#fff", padding: 2, borderRadius: 4 }} />
                  )}
                </div>
              </Field>
            </Section>

            {saving && <div style={{ fontSize: 11, color: "var(--t3)", display: "flex", alignItems: "center", gap: 6 }}><Loader2 size={12} className="animate-spin" /> guardando…</div>}
          </div>
        ) : (
          <div style={{ ...panelStyle, textAlign: "center", padding: 40 }}>
            <CreditCard size={32} style={{ color: "var(--t3)", marginBottom: 12 }} />
            <p style={{ color: "var(--t3)", fontSize: 13, margin: 0 }}>
              {cards.length === 0
                ? "Crea tu primera tarjeta seleccionando una plantilla a la izquierda."
                : "Selecciona una tarjeta de la lista o crea una nueva."}
            </p>
          </div>
        )}

        {/* ── COL 3: Preview + Acciones ── */}
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {selected && (
            <>
              <div style={panelStyle}>
                <h3 style={panelTitle}>Acciones</h3>
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  <select
                    id="bg-model-select"
                    defaultValue="recraft-v3"
                    style={inputStyle}
                  >
                    {BG_MODELS.map((m) => <option key={m.id} value={m.id}>{m.label}</option>)}
                  </select>
                  <button
                    onClick={() => {
                      const sel = document.getElementById("bg-model-select") as HTMLSelectElement | null;
                      generateCard(selected.id, sel?.value || "recraft-v3");
                    }}
                    disabled={generating}
                    style={{ ...btnPrimary, padding: "12px 16px" }}
                  >
                    {generating ? <><Loader2 size={14} className="animate-spin" /> Generando (1-2 min)…</> : <><Sparkles size={14} /> Generar tarjeta</>}
                  </button>
                  {selected.frontUrl && (
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6, marginTop: 8 }}>
                      <a href={selected.frontUrl} download={`${selected.name}-frente.png`} style={btnSmall}>
                        <Download size={12} /> Frente PNG
                      </a>
                      <a href={selected.backUrl || "#"} download={`${selected.name}-reverso.png`} style={btnSmall}>
                        <Download size={12} /> Reverso PNG
                      </a>
                      {selected.pdfUrl && (
                        <a href={selected.pdfUrl} download={`${selected.name}-print.pdf`} style={btnSmall}>
                          <FileText size={12} /> PDF Print
                        </a>
                      )}
                      <a
                        href={`${API_BASE}/api/cards/${selected.id}/qr.svg`}
                        download={`${selected.name}-qr.svg`}
                        style={btnSmall}
                      >
                        <QrCode size={12} /> QR SVG
                      </a>
                    </div>
                  )}
                  {selected.lastError && (
                    <div style={{ fontSize: 11, color: "#e84558", padding: 6, background: "rgba(232,69,88,0.08)", borderRadius: 4 }}>
                      {selected.lastError}
                    </div>
                  )}
                  {selected.generationCost && (
                    <div style={{ fontSize: 11, color: "var(--t3)" }}>
                      Coste última generación: ${selected.generationCost}
                    </div>
                  )}
                </div>
              </div>

              <div style={panelStyle}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
                  <h3 style={{ ...panelTitle, margin: 0 }}>Preview · 85×55mm @ 300 DPI</h3>
                  {(selected.frontUrl || selected.backUrl) && (
                    <button
                      onClick={() => setShowEditor(true)}
                      style={{ ...btnSmall, color: "var(--gold)", borderColor: "var(--gold)" }}
                      title="Reposicionar elementos / añadir textos"
                    >
                      <Move size={12} /> Editor
                    </button>
                  )}
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                  <PreviewSide label="Frente" url={selected.frontUrl} placeholder="Genera para ver el frente" />
                  <PreviewSide label="Reverso" url={selected.backUrl} placeholder="Genera para ver el reverso (con QR)" />
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      {/* EDITOR VISUAL DE POSICIONES */}
      {showEditor && selected && (
        <CardStudioEditor
          apiBase={API_BASE}
          cardId={selected.id}
          frontUrl={selected.frontUrl}
          backUrl={selected.backUrl}
          initialOverrides={(selected.layoutOverrides as LayoutOverrides) || {}}
          generating={generating}
          onSaveOverrides={async (ov) => {
            await updateCard(selected.id, { layoutOverrides: ov } as any);
          }}
          onRegenerate={async () => {
            const sel = document.getElementById("bg-model-select") as HTMLSelectElement | null;
            await generateCard(selected.id, sel?.value || "recraft-v3");
          }}
          onClose={() => setShowEditor(false)}
        />
      )}

      {/* AUTO-DESIGN MODAL */}
      {showAutoDesign && (
        <div style={modalBackdrop} onClick={() => setShowAutoDesign(false)}>
          <div style={modalContent} onClick={(e) => e.stopPropagation()}>
            <h3 style={{ margin: "0 0 14px", display: "flex", alignItems: "center", gap: 8 }}>
              <Wand2 size={18} style={{ color: "var(--gold)" }} /> Auto-design IA
            </h3>
            <p style={{ fontSize: 12, color: "var(--t3)", margin: "0 0 14px" }}>
              Claude propondrá la plantilla, paleta, tipografías y prompt de fondo a partir de estos inputs.
            </p>
            <Field label="Industria"><input value={autoIndustry} onChange={(e) => setAutoIndustry(e.target.value)} placeholder="ej: relojería de lujo, agencia creativa, abogacía" style={inputStyle} /></Field>
            <Field label="Vibe / Personalidad"><input value={autoVibe} onChange={(e) => setAutoVibe(e.target.value)} placeholder="ej: lujo discreto, audaz, minimalista" style={inputStyle} /></Field>
            <Field label="Color preferido"><input value={autoColor} onChange={(e) => setAutoColor(e.target.value)} placeholder="ej: oro, azul medianoche, verde bosque" style={inputStyle} /></Field>
            <Field label="Marca"><input value={autoBrand} onChange={(e) => setAutoBrand(e.target.value)} placeholder="nombre de marca" style={inputStyle} /></Field>
            <div style={{ display: "flex", gap: 8, marginTop: 14, justifyContent: "flex-end" }}>
              <button onClick={() => setShowAutoDesign(false)} style={btnSecondary}>Cancelar</button>
              <button onClick={runAutoDesign} disabled={autoBusy} style={btnPrimary}>
                {autoBusy ? <><Loader2 size={14} className="animate-spin" /> Pensando…</> : <><Wand2 size={14} /> Diseñar</>}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Subcomponents ──────────────────────────────────────────────────────

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, { bg: string; color: string; label: string }> = {
    draft: { bg: "rgba(150,150,150,0.2)", color: "#999", label: "borrador" },
    generating: { bg: "rgba(82,160,255,0.2)", color: "#52a0ff", label: "generando" },
    ready: { bg: "rgba(34,197,94,0.2)", color: "#22c55e", label: "lista" },
    failed: { bg: "rgba(232,69,88,0.2)", color: "#e84558", label: "error" },
  };
  const s = styles[status] || styles.draft;
  return (
    <span style={{ background: s.bg, color: s.color, padding: "1px 6px", borderRadius: 8, fontSize: 9, letterSpacing: 0.5 }}>
      {s.label}
    </span>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 16 }}>
      <h4 style={{ fontSize: 10, color: "var(--gold)", margin: "0 0 8px", letterSpacing: 1.4, textTransform: "uppercase" }}>{title}</h4>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>{children}</div>
    </div>
  );
}

function Field({ label, children }: { label: React.ReactNode; children: React.ReactNode }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
      <label style={{ fontSize: 11, color: "var(--t3)" }}>{label}</label>
      {children}
    </div>
  );
}

function PreviewSide({ label, url, placeholder }: { label: string; url?: string | null; placeholder: string }) {
  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
        <span style={{ fontSize: 11, color: "var(--t3)", letterSpacing: 1.2, textTransform: "uppercase" }}>{label}</span>
      </div>
      <div
        style={{
          aspectRatio: "1080/720",
          width: "100%",
          background: "rgba(255,255,255,0.04)",
          border: "1px solid rgba(255,255,255,0.08)",
          borderRadius: 8,
          overflow: "hidden",
          display: "flex", alignItems: "center", justifyContent: "center",
          backgroundImage: "linear-gradient(45deg, rgba(255,255,255,0.04) 25%, transparent 25%), linear-gradient(-45deg, rgba(255,255,255,0.04) 25%, transparent 25%)",
          backgroundSize: "20px 20px",
        }}
      >
        {url ? (
          <img src={url} alt={label} style={{ width: "100%", height: "100%", objectFit: "contain" }} />
        ) : (
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6, color: "var(--t3)", fontSize: 11 }}>
            <ImageIcon size={28} />
            {placeholder}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Estilos compartidos ─────────────────────────────────────────────────

const panelStyle: React.CSSProperties = {
  background: "rgba(255,255,255,0.02)",
  border: "1px solid rgba(255,255,255,0.06)",
  borderRadius: 10,
  padding: 14,
};

const panelTitle: React.CSSProperties = {
  fontSize: 12, color: "var(--t1)", margin: "0 0 12px",
  letterSpacing: 1.5, textTransform: "uppercase", fontWeight: 700,
};

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "8px 10px",
  fontSize: 12,
  background: "rgba(0,0,0,0.3)",
  border: "1px solid rgba(255,255,255,0.08)",
  borderRadius: 4,
  color: "var(--t1)",
  outline: "none",
  fontFamily: "inherit",
};

const btnPrimary: React.CSSProperties = {
  padding: "8px 12px",
  fontSize: 12,
  fontWeight: 600,
  background: "linear-gradient(135deg, var(--gold), #b8941e)",
  color: "#0a0a0a",
  border: "none",
  borderRadius: 6,
  cursor: "pointer",
  display: "inline-flex",
  alignItems: "center",
  gap: 6,
  justifyContent: "center",
};

const btnSecondary: React.CSSProperties = {
  padding: "8px 12px",
  fontSize: 12,
  background: "rgba(255,255,255,0.05)",
  color: "var(--t1)",
  border: "1px solid rgba(255,255,255,0.1)",
  borderRadius: 6,
  cursor: "pointer",
  display: "inline-flex",
  alignItems: "center",
  gap: 6,
};

const btnSmall: React.CSSProperties = {
  padding: "6px 8px",
  fontSize: 11,
  background: "rgba(255,255,255,0.04)",
  color: "var(--t1)",
  border: "1px solid rgba(255,255,255,0.08)",
  borderRadius: 4,
  cursor: "pointer",
  display: "inline-flex",
  alignItems: "center",
  gap: 4,
  textDecoration: "none",
  justifyContent: "center",
};

const modalBackdrop: React.CSSProperties = {
  position: "fixed", top: 0, left: 0, right: 0, bottom: 0,
  background: "rgba(0,0,0,0.7)", display: "flex", alignItems: "center", justifyContent: "center",
  zIndex: 1000, padding: 20,
};

const modalContent: React.CSSProperties = {
  background: "var(--ink)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 10,
  padding: 24, maxWidth: 480, width: "100%",
};
