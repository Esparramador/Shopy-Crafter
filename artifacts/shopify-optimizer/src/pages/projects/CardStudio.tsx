/**
 * Card Studio — UI para crear tarjetas de presentación profesionales.
 *
 * Flujo:
 *  1. Lista de tarjetas del proyecto (sidebar izquierda)
 *  2. Editor de la tarjeta seleccionada (centro): datos, paleta, fonts, layout, fondo, QR
 *  3. Preview LIVE en CSS (derecha) + preview PNG generado + acciones
 */
import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { useRoute } from "wouter";
import {
  Loader2, Sparkles, Plus, Trash2, Download, Wand2,
  CreditCard, RefreshCw, AlertCircle, CheckCircle2, Upload,
  Image as ImageIcon, FileText, QrCode, Move,
  Link2, Video, Frame, Smartphone, Copy, ExternalLink,
} from "lucide-react";
import CardStudioEditor, { type LayoutOverrides } from "./CardStudioEditor";

const API_BASE = import.meta.env.BASE_URL?.replace(/\/$/, "") ?? "";

type Palette = { bg: string; primary: string; secondary: string; accent: string; text: string };
type Fonts = { heading: string; body: string; weights?: { heading?: number; body?: number } };
type BackgroundConfig = { kind: "solid" | "gradient" | "ai-texture" | "custom-image"; prompt?: string; hex?: string; gradientAngle?: number; vaultFileId?: number };

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
  qrType?: string | null;
  qrContentUrl?: string | null;
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
  backgroundImageUrl?: string | null;
  frontImageVaultFileId?: number | null;
  backImageVaultFileId?: number | null;
  pdfVaultFileId?: number | null;
  metadata?: any;
  layoutOverrides?: LayoutOverrides;
  updatedAt: string;
}

const BG_MODELS = [
  { id: "recraft-v4",             label: "Recraft v4 · recomendado ($0.05)",         tier: "best" },
  { id: "recraft-v3",             label: "Recraft v3 · texto en imagen ($0.04)",      tier: "best" },
  { id: "ideogram-v3-quality",    label: "Ideogram v3 Quality · texto max ($0.06)",   tier: "premium" },
  { id: "imagen-4-ultra",         label: "Imagen 4 Ultra · 2K ($0.06)",               tier: "premium" },
  { id: "flux-1.1-pro-ultra",     label: "Flux 1.1 Pro Ultra · 4MP ($0.06)",          tier: "premium" },
  { id: "flux-kontext-max",       label: "Flux Kontext Max · premium ($0.07)",        tier: "balanced" },
  { id: "flux-1.1-pro",           label: "Flux 1.1 Pro ($0.04)",                      tier: "balanced" },
  { id: "nano-banana",            label: "Gemini 2.5 Flash Image ($0.04)",            tier: "balanced" },
  { id: "imagen-4",               label: "Imagen 4 · estándar ($0.04)",               tier: "balanced" },
  { id: "gpt-image-2",            label: "OpenAI gpt-image-2 ($0.05)",                tier: "balanced" },
  { id: "seedream-4",             label: "Seedream 4 · ByteDance ($0.04)",            tier: "balanced" },
  { id: "imagen-4-fast",          label: "Imagen 4 Fast ($0.02)",                     tier: "economy" },
  { id: "flux-schnell",           label: "Flux Schnell · rápido ($0.003)",            tier: "economy" },
];

const QR_TYPES = [
  { id: "vcard",     label: "vCard",     icon: <Smartphone size={13}/>, desc: "Añade el contacto directo a la agenda" },
  { id: "url",       label: "URL",       icon: <Link2 size={13}/>,      desc: "Redirige a un sitio web" },
  { id: "video",     label: "Video",     icon: <Video size={13}/>,      desc: "Reproduce un video (YouTube o MP4)" },
  { id: "image",     label: "Imagen",    icon: <ImageIcon size={13}/>,  desc: "Muestra una imagen en pantalla completa" },
  { id: "animation", label: "Animación", icon: <Frame size={13}/>,      desc: "Tarjeta animada premium" },
];

const LAYOUTS: Array<{ id: "centered" | "left" | "grid"; label: string; desc: string }> = [
  { id: "centered", label: "Centrado",  desc: "Texto centrado · estilo lujo / clásico" },
  { id: "left",     label: "Izquierda", desc: "Alineado izq · estilo moderno / agency" },
  { id: "grid",     label: "Grid",      desc: "Estructura 2 col · estilo corporate" },
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
  const [showAutoDesign, setShowAutoDesign] = useState(false);
  const importFileRef = useRef<HTMLInputElement>(null);
  const [autoIndustry, setAutoIndustry] = useState("");
  const [autoVibe, setAutoVibe] = useState("");
  const [autoColor, setAutoColor] = useState("");
  const [autoBrand, setAutoBrand] = useState("");
  const [autoBusy, setAutoBusy] = useState(false);
  const [bgModel, setBgModel] = useState("recraft-v4");
  const [copiedUrl, setCopiedUrl] = useState(false);
  const [bgWarning, setBgWarning] = useState<string | null>(null);

  const selected = useMemo(() => cards.find((c) => c.id === selectedId) ?? null, [cards, selectedId]);

  useEffect(() => {
    if (!projectId) { setLoading(false); return; }
    const load = async () => {
      try {
        const [tRes, cRes] = await Promise.all([
          fetch(`${API_BASE}/api/cards/templates`, { credentials: "include" }),
          fetch(`${API_BASE}/api/projects/${projectId}/cards`, { credentials: "include" }),
        ]);
        if (tRes.ok) { const d = await tRes.json(); setTemplates(d.templates || []); }
        if (cRes.ok) { const d = await cRes.json(); setCards(d.cards || []); }
      } catch (err: any) {
        setError(err?.message || "Error cargando datos");
      } finally { setLoading(false); }
    };
    load();
  }, [projectId]);

  const createCard = useCallback(async (templateId: string) => {
    setError(null);
    try {
      const res = await fetch(`${API_BASE}/api/projects/${projectId}/cards`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          templateId,
          fullName: "Tu Nombre Aquí",
          name: "Nueva tarjeta",
          qrType: "vcard",
          qrContentUrl: "",
          qrUrl: "",
        }),
      });
      if (!res.ok) throw new Error((await res.json()).error || "Error creando tarjeta");
      const card: BusinessCard = await res.json();
      setCards((prev) => [...prev, card]);
      setSelectedId(card.id);
    } catch (err: any) {
      setError(err?.message || "Error");
    }
  }, [projectId]);

  const updateCard = useCallback(async (id: number, patch: Partial<BusinessCard> & Record<string, any>) => {
    setSaving(true);
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
    } finally { setSaving(false); }
  }, []);

  const updateLocal = useCallback((patch: Partial<BusinessCard>) => {
    if (!selected) return;
    setCards((prev) => prev.map((c) => (c.id === selected.id ? { ...c, ...patch } : c)));
  }, [selected]);

  const generateCard = useCallback(async (id: number) => {
    setGenerating(true);
    setError(null);
    setSuccess(null);
    try {
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
            qrType: current.qrType || "vcard",
            qrContentUrl: current.qrContentUrl || null,
            templateId: current.templateId,
            layout: current.layout,
            palette: current.palette,
            fonts: current.fonts,
            background: current.backgroundConfig,
          }),
        });
        if (!saveRes.ok) {
          const errBody = await saveRes.json().catch(() => ({}));
          throw new Error(`No se pudo guardar antes de generar: ${errBody.error || saveRes.statusText}`);
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
      if (data.bgGenFailed) {
        setBgWarning(`⚠️ El fondo IA no se pudo generar (${data.bgGenError || "error desconocido"}) — se usó fondo sólido. Prueba otro modelo.`);
      } else {
        setBgWarning(null);
      }
      setSuccess(`✓ Tarjeta generada (coste: $${data.cost?.toFixed(4) || "0.00"})`);
      setTimeout(() => setSuccess(null), 5000);
    } catch (err: any) {
      setError(err?.message || "Error generando");
    } finally { setGenerating(false); }
  }, [cards, bgModel]);

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

  const uploadBackground = useCallback(async (id: number, file: File) => {
    setError(null);
    try {
      const fd = new FormData();
      fd.append("background", file);
      const res = await fetch(`${API_BASE}/api/cards/${id}/upload-background`, {
        method: "POST",
        credentials: "include",
        body: fd,
      });
      if (!res.ok) throw new Error((await res.json()).error || "Error subiendo fondo");
      const updated: BusinessCard = await res.json();
      setCards((prev) => prev.map((c) => (c.id === id ? updated : c)));
    } catch (err: any) {
      setError(err?.message || "Error");
    }
  }, []);

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

  const runAutoDesign = useCallback(async () => {
    if (!selected) return;
    setAutoBusy(true);
    try {
      const res = await fetch(`${API_BASE}/api/cards/auto-design`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ industry: autoIndustry, vibe: autoVibe, preferredColor: autoColor, brandName: autoBrand }),
      });
      if (!res.ok) throw new Error((await res.json()).error || "Error");
      const data = await res.json();
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
    } finally { setAutoBusy(false); }
  }, [autoIndustry, autoVibe, autoColor, autoBrand, selected, updateLocal, updateCard]);

  const copyLandingUrl = useCallback(() => {
    if (!selected) return;
    const url = `${window.location.origin}${API_BASE}/api/public/qr/${selected.id}`;
    navigator.clipboard.writeText(url).then(() => {
      setCopiedUrl(true);
      setTimeout(() => setCopiedUrl(false), 2000);
    });
  }, [selected]);

  if (loading) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "60vh" }}>
        <Loader2 size={32} className="animate-spin" style={{ color: "var(--gold)" }} />
      </div>
    );
  }

  const qrTypeLandingNeeded = selected && ["video", "image", "animation"].includes(selected.qrType || "vcard");
  const qrContentNeeded = selected && ["url", "video", "image"].includes(selected.qrType || "vcard");

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
            Tarjetas profesionales · 300 DPI · 85×55mm · QR inteligente · live preview
          </p>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={() => setShowAutoDesign(true)} disabled={!selected} style={btnSecondary}>
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
      {bgWarning && (
        <div style={{ padding: 10, borderRadius: 8, background: "rgba(234,179,8,0.12)", color: "#ca8a04", border: "1px solid rgba(234,179,8,0.35)", marginBottom: 12, display: "flex", alignItems: "flex-start", gap: 8, fontSize: 12 }}>
          <AlertCircle size={15} style={{ flexShrink: 0, marginTop: 1 }} />
          <span>{bgWarning}</span>
          <button onClick={() => setBgWarning(null)} style={{ marginLeft: "auto", background: "none", border: "none", color: "inherit", cursor: "pointer", padding: 0, flexShrink: 0 }}>✕</button>
        </div>
      )}

      {/* GRID: 3 cols — lista · formulario · editor inline */}
      <div style={{ display: "grid", gridTemplateColumns: "260px minmax(280px,1fr) minmax(480px,1.2fr)", gap: 16, alignItems: "start" }}>

        {/* ── COL 1: Lista + crear ── */}
        <div style={panelStyle}>
          <h3 style={panelTitle}>Tarjetas ({cards.length})</h3>
          <div style={{ maxHeight: 360, overflowY: "auto", display: "flex", flexDirection: "column", gap: 6, marginBottom: 12 }}>
            {cards.length === 0 && (
              <p style={{ fontSize: 12, color: "var(--t3)", textAlign: "center", padding: 20 }}>Sin tarjetas. Crea una abajo.</p>
            )}
            {cards.map((c) => (
              <div
                key={c.id}
                onClick={() => { setSelectedId(c.id); }}
                style={{
                  padding: 10, borderRadius: 6, cursor: "pointer",
                  background: selectedId === c.id ? "rgba(212,175,55,0.12)" : "rgba(255,255,255,0.02)",
                  border: selectedId === c.id ? "1px solid var(--gold)" : "1px solid transparent",
                  display: "flex", justifyContent: "space-between", alignItems: "center", gap: 6,
                }}
              >
                <div style={{ overflow: "hidden", flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: 500, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{c.name}</div>
                  <div style={{ fontSize: 11, color: "var(--t3)", display: "flex", alignItems: "center", gap: 6 }}>
                    {c.fullName} · <StatusBadge status={c.status} />
                  </div>
                </div>
                <button
                  onClick={(e) => { e.stopPropagation(); deleteCard(c.id); }}
                  style={{ background: "none", border: "none", color: "var(--t3)", cursor: "pointer", padding: 4 }}
                  title="Eliminar"
                ><Trash2 size={14} /></button>
              </div>
            ))}
          </div>
          <h4 style={{ fontSize: 11, color: "var(--t3)", margin: "0 0 8px", letterSpacing: 1.4, textTransform: "uppercase" }}>
            Nueva con plantilla
          </h4>
          <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: 6 }}>
            {templates.map((t) => (
              <button
                key={t.id}
                onClick={() => createCard(t.id)}
                style={{ padding: "8px 10px", textAlign: "left", background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 6, color: "var(--t1)", cursor: "pointer", fontSize: 12 }}
                title={t.description}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <Plus size={12} /><span style={{ fontWeight: 500 }}>{t.name}</span>
                </div>
                <div style={{ fontSize: 10, color: "var(--t3)", marginTop: 2 }}>{t.category}</div>
              </button>
            ))}
          </div>
        </div>

        {/* ── COL 2: Form editor (siempre visible cuando hay tarjeta seleccionada) ── */}
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
            </Section>

            {/* ── QR DESTINATION ── */}
            <Section title="QR Destination">
              <Field label="Qué hace el QR al escanearse:">
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 5 }}>
                  {QR_TYPES.map((qt) => (
                    <button
                      key={qt.id}
                      onClick={() => {
                        updateLocal({ qrType: qt.id, qrContentUrl: selected.qrContentUrl });
                        updateCard(selected.id, { qrType: qt.id, qrContentUrl: selected.qrContentUrl || null });
                      }}
                      title={qt.desc}
                      style={{
                        padding: "7px 8px", fontSize: 11, borderRadius: 5, display: "flex", alignItems: "center", gap: 6,
                        background: (selected.qrType || "vcard") === qt.id ? "rgba(212,175,55,0.18)" : "rgba(255,255,255,0.03)",
                        border: (selected.qrType || "vcard") === qt.id ? "1px solid var(--gold)" : "1px solid rgba(255,255,255,0.08)",
                        color: "var(--t1)", cursor: "pointer", fontWeight: (selected.qrType || "vcard") === qt.id ? 600 : 400,
                      }}
                    >
                      {qt.icon} {qt.label}
                    </button>
                  ))}
                </div>
              </Field>

              {qrContentNeeded && (
                <Field label={
                  selected.qrType === "url" ? "URL de destino" :
                  selected.qrType === "video" ? "URL del video (YouTube, MP4, etc.)" :
                  "URL de la imagen"
                }>
                  <input
                    value={selected.qrContentUrl ?? ""}
                    onChange={(e) => updateLocal({ qrContentUrl: e.target.value })}
                    onBlur={() => updateCard(selected.id, { qrType: selected.qrType || "vcard", qrContentUrl: selected.qrContentUrl || null })}
                    placeholder={
                      selected.qrType === "url" ? "https://tuwebsite.com" :
                      selected.qrType === "video" ? "https://youtube.com/watch?v=… o URL de .mp4" :
                      "https://… (imagen PNG/JPG/WebP)"
                    }
                    style={inputStyle}
                  />
                </Field>
              )}

              {qrTypeLandingNeeded && (
                <div style={{ background: "rgba(212,175,55,0.06)", border: "1px solid rgba(212,175,55,0.2)", borderRadius: 6, padding: 10, fontSize: 11 }}>
                  <div style={{ color: "var(--gold)", marginBottom: 6, fontWeight: 600, display: "flex", alignItems: "center", gap: 6 }}>
                    <QrCode size={12} /> Landing page del QR
                  </div>
                  <div style={{ color: "var(--t3)", marginBottom: 8, wordBreak: "break-all" }}>
                    {`${window.location.origin}${API_BASE}/api/public/qr/${selected.id}`}
                  </div>
                  <div style={{ display: "flex", gap: 6 }}>
                    <button onClick={copyLandingUrl} style={{ ...btnSmall, fontSize: 10 }}>
                      <Copy size={10} /> {copiedUrl ? "¡Copiado!" : "Copiar URL"}
                    </button>
                    <a
                      href={`${window.location.origin}${API_BASE}/api/public/qr/${selected.id}`}
                      target="_blank"
                      rel="noopener"
                      style={{ ...btnSmall, textDecoration: "none", fontSize: 10 }}
                    >
                      <ExternalLink size={10} /> Vista previa
                    </a>
                  </div>
                </div>
              )}

              {(selected.qrType === "vcard" || !selected.qrType) && (
                <div style={{ fontSize: 11, color: "var(--t3)", padding: "6px 10px", background: "rgba(255,255,255,0.03)", borderRadius: 5 }}>
                  El QR contendrá tu contacto completo (vCard 3.0) para añadir directamente a la agenda.
                </div>
              )}

              {/* QR Download (only when generated) */}
              {selected.status === "ready" && (
                <a href={`${API_BASE}/api/cards/${selected.id}/qr.svg`} download={`${selected.name}-qr.svg`} style={{ ...btnSmall, textDecoration: "none" }}>
                  <QrCode size={12} /> Descargar QR SVG
                </a>
              )}
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
                        onChange={(e) => updateLocal({ palette: { ...selected.palette, [k]: e.target.value } })}
                        onBlur={() => updateCard(selected.id, { palette: selected.palette as any })}
                        style={{ width: "100%", height: 32, border: "none", background: "transparent", padding: 0, cursor: "pointer" }}
                      />
                    </div>
                  ))}
                </div>
              </Field>
              <Field label="Tipografías">
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
                  <select value={selected.fonts?.heading || "Inter"} onChange={(e) => { const f = { ...selected.fonts, heading: e.target.value }; updateLocal({ fonts: f }); updateCard(selected.id, { fonts: f as any }); }} style={inputStyle}>
                    {POPULAR_FONTS.map((f) => <option key={f} value={f}>{f}</option>)}
                  </select>
                  <select value={selected.fonts?.body || "Inter"} onChange={(e) => { const f = { ...selected.fonts, body: e.target.value }; updateLocal({ fonts: f }); updateCard(selected.id, { fonts: f as any }); }} style={inputStyle}>
                    {POPULAR_FONTS.map((f) => <option key={f} value={f}>{f}</option>)}
                  </select>
                </div>
              </Field>
              <Field label="Fondo">
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 5, marginBottom: 6 }}>
                  {(["solid","gradient","ai-texture","custom-image"] as const).map((k) => (
                    <button key={k} onClick={() => { const b = { ...selected.backgroundConfig, kind: k }; updateLocal({ backgroundConfig: b }); updateCard(selected.id, { backgroundConfig: b as any }); }}
                      style={{ padding: "7px 4px", fontSize: 10, borderRadius: 4, background: selected.backgroundConfig?.kind === k ? "rgba(212,175,55,0.18)" : "rgba(255,255,255,0.03)", border: selected.backgroundConfig?.kind === k ? "1px solid var(--gold)" : "1px solid rgba(255,255,255,0.08)", color: "var(--t1)", cursor: "pointer", textAlign: "center" }}>
                      {k === "solid" ? "Sólido" : k === "gradient" ? "Degradado" : k === "ai-texture" ? "IA Textura" : "📷 Foto"}
                    </button>
                  ))}
                </div>
                {selected.backgroundConfig?.kind === "ai-texture" && (
                  <textarea
                    value={selected.backgroundConfig?.prompt || ""}
                    onChange={(e) => updateLocal({ backgroundConfig: { ...selected.backgroundConfig, prompt: e.target.value } })}
                    onBlur={() => updateCard(selected.id, { backgroundConfig: selected.backgroundConfig as any })}
                    placeholder="Prompt IA: premium leather texture, fine grain, dramatic lighting…"
                    style={{ ...inputStyle, minHeight: 60, resize: "vertical" }}
                  />
                )}
                {selected.backgroundConfig?.kind === "custom-image" && (
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 4 }}>
                    <label style={{ ...btnSecondary, cursor: "pointer", fontSize: 11 }}>
                      <Upload size={13} /> {selected.backgroundImageUrl ? "Cambiar foto" : "Subir foto"}
                      <input type="file" accept="image/png,image/jpeg,image/webp,image/jpg" style={{ display: "none" }} onChange={(e) => { if (e.target.files?.[0]) uploadBackground(selected.id, e.target.files[0]); }} />
                    </label>
                    {selected.backgroundImageUrl && (
                      <img src={selected.backgroundImageUrl} alt="fondo" style={{ height: 36, width: 60, objectFit: "cover", borderRadius: 4, border: "1px solid rgba(255,255,255,0.12)" }} />
                    )}
                  </div>
                )}
              </Field>
              <Field label="Logo (opcional)">
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <label style={{ ...btnSecondary, cursor: "pointer" }}>
                    <Upload size={14} /> {selected.logoUrl ? "Cambiar logo" : "Subir logo"}
                    <input type="file" accept="image/png,image/jpeg,image/webp" style={{ display: "none" }} onChange={(e) => { if (e.target.files?.[0]) uploadLogo(selected.id, e.target.files[0]); }} />
                  </label>
                  {selected.logoUrl && (
                    <img src={selected.logoUrl} alt="logo" style={{ height: 32, maxWidth: 80, objectFit: "contain", background: "#fff", padding: 2, borderRadius: 4 }} />
                  )}
                </div>
              </Field>
            </Section>

            {/* ── Generar + Descargar (en Col2) ── */}
            <Section title="Generar tarjeta">
              <Field label="Modelo IA para el fondo:">
                <select value={bgModel} onChange={(e) => setBgModel(e.target.value)} style={inputStyle}>
                  {BG_MODELS.map((m) => <option key={m.id} value={m.id}>{m.label}</option>)}
                </select>
              </Field>
              <div style={{ display: "flex", gap: 6, marginTop: 4 }}>
                <button
                  onClick={() => generateCard(selected.id)}
                  disabled={generating}
                  style={{ ...btnPrimary, flex: 1, padding: "11px 16px" }}
                >
                  {generating ? <><Loader2 size={14} className="animate-spin" /> Generando…</> : <><Sparkles size={14} /> Generar</>}
                </button>
                <label style={{ ...btnSmall, cursor: "pointer", padding: "11px 10px" }} title="Importar imagen de tarjeta ya generada como fondo del editor">
                  <Upload size={13} /> Importar
                  <input
                    ref={importFileRef}
                    type="file"
                    accept="image/png,image/jpeg,image/webp"
                    style={{ display: "none" }}
                    onChange={async (e) => {
                      const file = e.target.files?.[0];
                      if (!file) return;
                      const fd = new FormData();
                      fd.append("front", file);
                      try {
                        const res = await fetch(`${API_BASE}/api/cards/${selected.id}/import-front`, { method: "POST", credentials: "include", body: fd });
                        const data = await res.json().catch(() => ({}));
                        if (!res.ok) throw new Error(data.error || `Error ${res.status}`);
                        setCards(prev => prev.map(c => c.id === selected.id ? data : c));
                        setSuccess("✓ Imagen importada como frente de la tarjeta");
                        setTimeout(() => setSuccess(null), 4000);
                      } catch (err: any) {
                        setError(err.message || "Error importando imagen");
                      }
                      e.target.value = "";
                    }}
                  />
                </label>
              </div>
              {selected.lastError && (
                <div style={{ fontSize: 11, color: "#e84558", padding: 8, background: "rgba(232,69,88,0.08)", borderRadius: 4, marginTop: 8 }}>
                  {selected.lastError}
                </div>
              )}
              {selected.generationCost && (
                <div style={{ fontSize: 11, color: "var(--t3)", marginTop: 4 }}>
                  Coste: ${selected.generationCost}
                </div>
              )}
            </Section>

            {/* ── Descargas (visible cuando hay tarjeta generada) ── */}
            {selected.frontUrl && (
              <Section title="Descargar">
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
                  <a href={`${API_BASE}${selected.frontUrl}`} download={`${selected.name}-frente.png`} style={{ ...btnSmall, textDecoration: "none" }}>
                    <Download size={12} /> Frente PNG
                  </a>
                  {selected.backUrl ? (
                    <a href={`${API_BASE}${selected.backUrl}`} download={`${selected.name}-reverso.png`} style={{ ...btnSmall, textDecoration: "none" }}>
                      <Download size={12} /> Reverso PNG
                    </a>
                  ) : <span />}
                  {selected.pdfUrl && (
                    <a href={selected.pdfUrl} download={`${selected.name}-print.pdf`} style={{ ...btnSmall, textDecoration: "none" }}>
                      <FileText size={12} /> PDF Print
                    </a>
                  )}
                  <a href={`${API_BASE}/api/cards/${selected.id}/qr.svg`} download={`${selected.name}-qr.svg`} style={{ ...btnSmall, textDecoration: "none" }}>
                    <QrCode size={12} /> QR SVG
                  </a>
                </div>
              </Section>
            )}

            {saving && <div style={{ fontSize: 11, color: "var(--t3)", display: "flex", alignItems: "center", gap: 6 }}><Loader2 size={12} className="animate-spin" /> guardando…</div>}
          </div>
        ) : (
          <div style={{ ...panelStyle, textAlign: "center", padding: 40 }}>
            <CreditCard size={32} style={{ color: "var(--t3)", marginBottom: 12 }} />
            <p style={{ color: "var(--t3)", fontSize: 13, margin: 0 }}>
              {cards.length === 0 ? "Crea tu primera tarjeta seleccionando una plantilla." : "Selecciona una tarjeta."}
            </p>
          </div>
        )}

        {/* ── COL 3: Smart Editor Area (3 estados: vacío / cargando / editor) ── */}
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {!selected ? (
            <div style={{ ...panelStyle, textAlign: "center", padding: 60, minHeight: 440, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
              <CreditCard size={40} style={{ color: "rgba(212,175,55,0.15)", marginBottom: 16 }} />
              <p style={{ color: "var(--t3)", fontSize: 13, margin: 0 }}>Selecciona una tarjeta para empezar</p>
            </div>
          ) : generating ? (
            <GenerationLoadingScreen card={selected} />
          ) : !selected.frontUrl ? (
            <PreGenerationView card={selected} onGenerate={() => generateCard(selected.id)} />
          ) : (
            <div style={{ ...panelStyle, minHeight: 580 }}>
              <CardStudioEditor
                key={selected.id}
                apiBase={API_BASE}
                cardId={selected.id}
                frontUrl={selected.frontUrl.startsWith("http") ? selected.frontUrl : `${API_BASE}${selected.frontUrl}`}
                backUrl={selected.backUrl ? (selected.backUrl.startsWith("http") ? selected.backUrl : `${API_BASE}${selected.backUrl}`) : null}
                logoUrl={selected.logoUrl ? (selected.logoUrl.startsWith("http") ? selected.logoUrl : `${API_BASE}${selected.logoUrl}`) : null}
                initialOverrides={(selected.layoutOverrides as LayoutOverrides) || {}}
                generating={false}
                onSaveOverrides={async (ov) => { await updateCard(selected.id, { layoutOverrides: ov } as any); }}
                onRegenerate={async () => { await generateCard(selected.id); }}
              />
            </div>
          )}
        </div>
      </div>

      {/* AUTO-DESIGN MODAL */}
      {showAutoDesign && (
        <div style={modalBackdrop} onClick={() => setShowAutoDesign(false)}>
          <div style={modalContent} onClick={(e) => e.stopPropagation()}>
            <h3 style={{ margin: "0 0 14px", display: "flex", alignItems: "center", gap: 8 }}>
              <Wand2 size={18} style={{ color: "var(--gold)" }} /> Auto-design IA
            </h3>
            <p style={{ fontSize: 12, color: "var(--t3)", margin: "0 0 14px" }}>
              Claude propondrá la plantilla, paleta, tipografías y prompt de fondo.
            </p>
            <Field label="Industria"><input value={autoIndustry} onChange={(e) => setAutoIndustry(e.target.value)} placeholder="ej: relojería de lujo, agencia creativa" style={inputStyle} /></Field>
            <Field label="Vibe"><input value={autoVibe} onChange={(e) => setAutoVibe(e.target.value)} placeholder="ej: lujo discreto, audaz, minimalista" style={inputStyle} /></Field>
            <Field label="Color preferido"><input value={autoColor} onChange={(e) => setAutoColor(e.target.value)} placeholder="ej: oro, azul medianoche" style={inputStyle} /></Field>
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

// ── Pasos y tiempos estimados del pipeline de generación ─────────────────────
const GEN_STEPS = [
  { emoji: "💾", label: "Procesando configuración" },
  { emoji: "🤖", label: "Generando fondo con IA" },
  { emoji: "🎨", label: "Pintando cara frontal" },
  { emoji: "🔄", label: "Diseñando el reverso" },
  { emoji: "📄", label: "Generando PDF de impresión" },
  { emoji: "✨", label: "Finalizando tu tarjeta" },
];
const GEN_TARGETS = [8, 38, 60, 76, 89, 96];

function GenerationLoadingScreen({ card }: { card: BusinessCard }) {
  const [step, setStep] = useState(0);
  const [progress, setProgress] = useState(0);

  const pal = (card.palette || {}) as Palette;
  const accent = pal.accent || "#d4a843";
  const cardBg = pal.bg || "#141414";
  const primary = pal.primary || "#c9a227";

  useEffect(() => {
    let prog = 0;
    let cur = 0;
    const id = setInterval(() => {
      if (cur >= GEN_TARGETS.length) {
        prog = Math.min(prog + 0.04, 99);
        setProgress(prog);
        return;
      }
      const target = GEN_TARGETS[cur];
      const speed = Math.max((target - prog) * 0.012, 0.18);
      prog = Math.min(prog + speed, target);
      setProgress(prog);
      if (prog >= target - 0.3) { cur++; setStep(cur); }
    }, 100);
    return () => clearInterval(id);
  }, []);

  const activeStep = GEN_STEPS[Math.min(step, GEN_STEPS.length - 1)];

  return (
    <div style={{
      ...panelStyle,
      minHeight: 520,
      display: "flex", flexDirection: "column",
      alignItems: "center", justifyContent: "center",
      gap: 24, position: "relative", overflow: "hidden",
    }}>
      <style>{`
        @keyframes cg-shimmer { 0%{transform:translateX(-100%)} 100%{transform:translateX(250%)} }
        @keyframes cg-glow { 0%,100%{box-shadow:0 0 22px ${accent}22,0 0 55px ${accent}0d} 50%{box-shadow:0 0 44px ${accent}44,0 0 80px ${accent}20} }
        @keyframes cg-breathe { 0%,100%{opacity:.35} 50%{opacity:.75} }
        @keyframes cg-bar { 0%{background-position:-200% 0} 100%{background-position:200% 0} }
        @keyframes cg-spin { from{transform:rotate(0deg)} to{transform:rotate(360deg)} }
        @keyframes cg-dot { 0%,80%,100%{transform:scaleY(.45);opacity:.3} 40%{transform:scaleY(1);opacity:1} }
      `}</style>

      {/* Blob de fondo */}
      <div style={{
        position:"absolute", top:"15%", left:"50%", transform:"translateX(-50%)",
        width:320, height:220,
        background:`radial-gradient(ellipse, ${accent}14 0%, transparent 70%)`,
        animation:"cg-breathe 3.2s ease-in-out infinite",
        pointerEvents:"none",
      }}/>

      {/* Encabezado */}
      <div style={{ textAlign:"center", position:"relative" }}>
        <div style={{
          display:"inline-flex", alignItems:"center", gap:7,
          fontSize:10, letterSpacing:3, textTransform:"uppercase",
          color:accent, fontWeight:700, marginBottom:8,
          padding:"3px 14px", borderRadius:20,
          border:`1px solid ${accent}30`, background:`${accent}0a`,
        }}>✦ Creando con IA ✦</div>
        <h3 style={{ margin:0, fontSize:16, fontWeight:700, color:"var(--t1)" }}>
          {card.fullName || "Tu tarjeta de presentación"}
        </h3>
        {card.companyName && <div style={{ fontSize:11, color:"var(--t3)", marginTop:3 }}>{card.companyName}</div>}
      </div>

      {/* Tarjeta animada */}
      <div style={{ position:"relative" }}>
        <div style={{
          position:"absolute", top:10, left:-4,
          width:220, height:147, borderRadius:10,
          background:accent, opacity:.07, filter:"blur(16px)",
        }}/>
        <div style={{
          width:220, height:147, borderRadius:10,
          background:`linear-gradient(135deg, ${cardBg} 0%, ${cardBg} 45%, ${primary}22 100%)`,
          border:`1px solid ${accent}30`,
          animation:"cg-glow 2.6s ease-in-out infinite",
          position:"relative", overflow:"hidden",
          display:"flex", flexDirection:"column",
          alignItems:"center", justifyContent:"center", gap:7,
        }}>
          <div style={{ position:"absolute", top:0, left:0, right:0, height:2,
            background:`linear-gradient(90deg, transparent, ${accent}, transparent)` }}/>
          <div style={{
            position:"absolute", top:0, bottom:0, width:"45%",
            background:`linear-gradient(90deg, transparent, ${accent}10, transparent)`,
            animation:"cg-shimmer 2.2s ease-in-out infinite",
          }}/>
          {card.logoUrl
            ? <img src={card.logoUrl.startsWith("http") ? card.logoUrl : `${API_BASE}${card.logoUrl}`}
                alt="" style={{ height:20, maxWidth:55, objectFit:"contain", opacity:.9 }}
                onError={(e)=>{ (e.target as HTMLImageElement).style.display="none"; }}/>
            : <div style={{ width:38, height:13, borderRadius:3, background:`${accent}28` }}/>
          }
          <div style={{ width:88, height:8, borderRadius:2, background:"rgba(255,255,255,0.58)" }}/>
          <div style={{ width:58, height:5, borderRadius:2, background:`${accent}65` }}/>
          <div style={{ width:72, height:4, borderRadius:2, background:"rgba(255,255,255,0.14)" }}/>
          <div style={{ display:"flex", gap:5, marginTop:2 }}>
            <div style={{ width:28, height:3, borderRadius:2, background:"rgba(255,255,255,0.09)" }}/>
            <div style={{ width:44, height:3, borderRadius:2, background:"rgba(255,255,255,0.09)" }}/>
          </div>
          <div style={{ position:"absolute", bottom:0, left:0, right:0, height:1, background:`${accent}22` }}/>
        </div>
      </div>

      {/* Badge paso activo */}
      <div style={{
        display:"flex", alignItems:"center", gap:10,
        padding:"9px 20px",
        background:`${accent}0c`, border:`1px solid ${accent}22`,
        borderRadius:28, fontSize:12, color:accent, fontWeight:600,
        maxWidth:"92%",
      }}>
        <span style={{ fontSize:15 }}>{activeStep?.emoji}</span>
        {activeStep?.label}
        <div style={{ display:"flex", gap:3, alignItems:"flex-end", height:12 }}>
          {[0,1,2].map(i => (
            <div key={i} style={{
              width:3, height:"100%", borderRadius:2,
              background:accent,
              animation:`cg-dot 1.2s ease-in-out ${i * 0.2}s infinite`,
            }}/>
          ))}
        </div>
      </div>

      {/* Lista de pasos */}
      <div style={{ width:"100%", maxWidth:360, display:"flex", flexDirection:"column", gap:2 }}>
        {GEN_STEPS.map((s, i) => {
          const isDone = i < step;
          const isActive = i === step;
          return (
            <div key={i} style={{
              display:"flex", alignItems:"center", gap:10,
              padding:"4px 10px", borderRadius:5,
              opacity: i > step ? 0.22 : 1,
              background: isActive ? `${accent}07` : "transparent",
              transition:"opacity 0.4s ease",
            }}>
              <span style={{
                fontSize:13, flexShrink:0, fontWeight:700,
                color: isDone ? "#22c55e" : isActive ? accent : "var(--t3)",
                display:"inline-block",
                animation: isActive ? "cg-spin 1.8s linear infinite" : "none",
              }}>
                {isDone ? "✓" : isActive ? "◐" : "○"}
              </span>
              <span style={{
                fontSize:11,
                color: isDone ? "#22c55e" : isActive ? "var(--t1)" : "var(--t3)",
                fontWeight: isActive ? 600 : 400,
              }}>
                {s.emoji} {s.label}
              </span>
              {isDone && <span style={{ marginLeft:"auto", fontSize:9, color:"#22c55e40" }}>listo</span>}
            </div>
          );
        })}
      </div>

      {/* Barra de progreso */}
      <div style={{ width:"100%", maxWidth:360 }}>
        <div style={{
          width:"100%", height:5,
          background:"rgba(255,255,255,0.05)", borderRadius:3, overflow:"hidden",
        }}>
          <div style={{
            height:"100%", borderRadius:3,
            width:`${progress}%`,
            background:`linear-gradient(90deg, ${primary}, ${accent}, ${primary})`,
            backgroundSize:"200% 100%",
            animation:"cg-bar 2s linear infinite",
            transition:"width 0.25s ease",
          }}/>
        </div>
        <div style={{
          display:"flex", justifyContent:"space-between",
          fontSize:10, color:"var(--t3)", marginTop:5,
        }}>
          <span>Calidad imprenta · 300 DPI · 85×55mm</span>
          <span style={{ color:accent, fontWeight:600 }}>{Math.round(progress)}%</span>
        </div>
      </div>

    </div>
  );
}

function PreGenerationView({ card, onGenerate }: { card: BusinessCard; onGenerate: () => void }) {
  const [side, setSide] = useState<"front" | "back">("front");
  const pal = (card.palette || {}) as Palette;
  const accent = pal.accent || "#d4a843";

  return (
    <div style={{ ...panelStyle, display:"flex", flexDirection:"column", gap:12 }}>
      {/* Header */}
      <div style={{ display:"flex", alignItems:"center", gap:8 }}>
        <span style={{ fontSize:11, fontWeight:700, letterSpacing:1.5, textTransform:"uppercase", color:"var(--gold)" }}>
          Vista Previa
        </span>
        <div style={{
          display:"flex", gap:2, marginLeft:"auto",
          background:"rgba(0,0,0,0.3)", padding:"2px", borderRadius:5,
        }}>
          {(["front","back"] as const).map(s => (
            <button key={s} onClick={() => setSide(s)} style={{
              padding:"4px 11px", fontSize:11, borderRadius:3, border:"none", cursor:"pointer",
              background: side === s ? accent : "transparent",
              color: side === s ? "#0a0a0a" : "var(--t3)",
              fontWeight: side === s ? 700 : 400,
              transition:"all 0.15s ease",
            }}>
              {s === "front" ? "Frente" : "Reverso"}
            </button>
          ))}
        </div>
      </div>

      {/* CSS preview + overlay */}
      <div style={{ position:"relative" }}>
        <CardLivePreview card={card} side={side} />
        <div style={{
          position:"absolute", inset:0,
          background:"linear-gradient(180deg, rgba(0,0,0,0.08) 0%, rgba(0,0,0,0.62) 100%)",
          borderRadius:8,
          display:"flex", flexDirection:"column",
          alignItems:"center", justifyContent:"flex-end",
          padding:20,
        }}>
          <div style={{ textAlign:"center", marginBottom:12 }}>
            <div style={{ fontSize:10, letterSpacing:2, textTransform:"uppercase", color:`${accent}cc`, marginBottom:4 }}>
              Aproximación visual CSS
            </div>
            <div style={{ fontSize:11, color:"rgba(255,255,255,0.75)", lineHeight:1.4 }}>
              Genera con IA para obtener el diseño real en 300 DPI
            </div>
          </div>
          <button onClick={onGenerate} style={{
            padding:"11px 28px", fontSize:13, fontWeight:700,
            background:`linear-gradient(135deg, ${accent}, #b8941e)`,
            color:"#0a0a0a", border:"none", borderRadius:8, cursor:"pointer",
            display:"flex", alignItems:"center", gap:8,
            boxShadow:`0 4px 24px ${accent}50`,
          }}>
            <Sparkles size={15}/> Generar tarjeta con IA
          </button>
        </div>
      </div>

      <div style={{
        fontSize:10, color:"var(--t3)", textAlign:"center",
        padding:"5px 12px",
        background:"rgba(255,255,255,0.018)", borderRadius:4,
        border:"1px solid rgba(255,255,255,0.04)",
      }}>
        💡 Rellena tus datos en el panel central · el fondo IA real se genera al hacer clic
      </div>
    </div>
  );
}

function CardLivePreview({ card, side }: { card: BusinessCard; side: "front" | "back" }) {
  const pal = card.palette || {} as Palette;
  const bg = pal.bg || "#141414";
  const primary = pal.primary || "#c9a227";
  const accent = pal.accent || "#d4af37";
  const textColor = pal.text || "#f0f0f0";
  const secondary = pal.secondary || "#888";
  const bgCfg = card.backgroundConfig || { kind: "solid" } as BackgroundConfig;
  const layout = card.layout || "centered";
  const headFont = card.fonts?.heading || "Inter";
  const bodyFont = card.fonts?.body || "Inter";

  const bgStyle: React.CSSProperties = bgCfg.kind === "gradient"
    ? { background: `linear-gradient(135deg, ${bg} 0%, ${accent}55 100%)` }
    : bgCfg.kind === "ai-texture"
    ? { background: `linear-gradient(160deg, ${bg} 0%, ${primary}30 60%, ${accent}18 100%)` }
    : bgCfg.kind === "custom-image" && (card as any).backgroundImageUrl
    ? { backgroundImage: `url(${(card as any).backgroundImageUrl})`, backgroundSize: "cover", backgroundPosition: "center" }
    : { background: bg };

  const isLeft = layout === "left";
  const isGrid = layout === "grid";
  const textAlign = isLeft || isGrid ? "left" : "center";

  const containerStyle: React.CSSProperties = {
    ...bgStyle,
    aspectRatio: "1080/720",
    width: "100%",
    borderRadius: 8,
    overflow: "hidden",
    position: "relative",
    display: "flex",
    flexDirection: isGrid ? "row" : "column",
    alignItems: isGrid ? "stretch" : (isLeft ? "flex-start" : "center"),
    justifyContent: isGrid ? "stretch" : "center",
    padding: isGrid ? 0 : "8% 8%",
    gap: 6,
    fontFamily: `'${bodyFont}', sans-serif`,
    boxSizing: "border-box",
  };

  const accentLineStyle: React.CSSProperties = {
    position: "absolute",
    top: 0, left: 0, right: 0,
    height: "3px",
    background: `linear-gradient(90deg, transparent, ${accent}, transparent)`,
  };

  const bottomLineStyle: React.CSSProperties = {
    position: "absolute",
    bottom: 0, left: 0, right: 0,
    height: "2px",
    background: `linear-gradient(90deg, transparent, ${accent}44, transparent)`,
  };

  if (side === "front") {
    return (
      <div style={containerStyle}>
        <div style={accentLineStyle} />
        <div style={bottomLineStyle} />

        {isGrid ? (
          <>
            {/* Grid: left column accent bar */}
            <div style={{ width: "30%", background: `${accent}18`, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "8% 5%", borderRight: `1px solid ${accent}22` }}>
              {card.logoUrl ? (
                <img src={card.logoUrl.startsWith("http") ? card.logoUrl : `${API_BASE}${card.logoUrl}`} alt="logo" style={{ maxWidth: "80%", maxHeight: 48, objectFit: "contain", marginBottom: 12 }} onError={(e)=>{ (e.target as HTMLImageElement).style.display="none"; }} />
              ) : (
                <div style={{ width: 40, height: 40, borderRadius: "50%", background: `${accent}25`, border: `2px solid ${accent}44`, marginBottom: 12 }} />
              )}
              <div style={{ fontSize: "clamp(7px,1.5vw,10px)", color: accent, letterSpacing: 2, textTransform: "uppercase", textAlign: "center", fontWeight: 600 }}>
                {card.companyName || "EMPRESA"}
              </div>
            </div>
            {/* Right column: text */}
            <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "center", padding: "8% 6%", gap: 4 }}>
              <div style={{ fontFamily: `'${headFont}', serif`, fontSize: "clamp(12px,2.5vw,18px)", fontWeight: 700, color: textColor, lineHeight: 1.2 }}>
                {card.fullName || "Tu Nombre"}
              </div>
              {card.jobTitle && <div style={{ fontSize: "clamp(8px,1.5vw,11px)", color: accent, letterSpacing: 0.5 }}>{card.jobTitle}</div>}
              {card.tagline && <div style={{ fontSize: "clamp(7px,1.3vw,10px)", color: secondary, marginTop: 4, lineHeight: 1.4 }}>{card.tagline}</div>}
            </div>
          </>
        ) : (
          <>
            {/* Centered or Left layout */}
            {card.logoUrl ? (
              <img src={card.logoUrl.startsWith("http") ? card.logoUrl : `${API_BASE}${card.logoUrl}`} alt="logo" style={{ maxWidth: isLeft ? 80 : 60, maxHeight: isLeft ? 36 : 28, objectFit: "contain", marginBottom: 8 }} onError={(e)=>{ (e.target as HTMLImageElement).style.display="none"; }} />
            ) : null}
            {card.companyName && (
              <div style={{ fontSize: "clamp(6px,1.2vw,9px)", color: accent, letterSpacing: 2.5, textTransform: "uppercase", fontWeight: 700, textAlign, marginBottom: 4 }}>
                {card.companyName}
              </div>
            )}
            <div style={{ fontFamily: `'${headFont}', serif`, fontSize: "clamp(13px,2.8vw,20px)", fontWeight: 700, color: textColor, lineHeight: 1.2, textAlign }}>
              {card.fullName || "Tu Nombre"}
            </div>
            {card.jobTitle && (
              <div style={{ fontSize: "clamp(8px,1.6vw,12px)", color: accent, letterSpacing: 0.5, textAlign, marginTop: 2 }}>
                {card.jobTitle}
              </div>
            )}
            {card.tagline && (
              <div style={{ fontSize: "clamp(7px,1.3vw,10px)", color: `${textColor}80`, lineHeight: 1.5, textAlign, marginTop: 6, maxWidth: "80%" }}>
                {card.tagline}
              </div>
            )}
          </>
        )}
      </div>
    );
  }

  // Back side
  const contactItems = [
    { icon: "✉", val: card.email },
    { icon: "✆", val: card.phone },
    { icon: "🌐", val: card.website },
    { icon: "@", val: card.socialHandle },
    { icon: "📍", val: card.address },
  ].filter((x) => x.val);

  const qrType = card.qrType || "vcard";

  return (
    <div style={{ ...containerStyle, flexDirection: "row", alignItems: "stretch", padding: 0 }}>
      <div style={accentLineStyle} />
      <div style={bottomLineStyle} />

      {/* Contact info */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "center", padding: "6% 7%", gap: 5 }}>
        <div style={{ fontFamily: `'${headFont}', serif`, fontSize: "clamp(9px,1.8vw,13px)", fontWeight: 700, color: textColor, marginBottom: 6 }}>
          {card.fullName || "Tu Nombre"}
        </div>
        {card.companyName && (
          <div style={{ fontSize: "clamp(6px,1.1vw,9px)", color: accent, letterSpacing: 1.5, textTransform: "uppercase", marginBottom: 4, fontWeight: 600 }}>
            {card.companyName}
          </div>
        )}
        {contactItems.map((item, i) => (
          <div key={i} style={{ display: "flex", alignItems: "center", gap: 5, fontSize: "clamp(6px,1.2vw,9px)", color: `${textColor}90` }}>
            <span style={{ color: accent, fontSize: "0.9em" }}>{item.icon}</span>
            <span style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", maxWidth: "100%" }}>{item.val}</span>
          </div>
        ))}
      </div>

      {/* QR placeholder */}
      <div style={{ width: "32%", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "4%", gap: 4 }}>
        <QrPlaceholder accentColor={accent} bg={bg} qrType={qrType} size={70} />
        <div style={{ fontSize: "clamp(5px,0.9vw,7px)", color: `${textColor}55`, letterSpacing: 0.5, textTransform: "uppercase", textAlign: "center", marginTop: 4 }}>
          {qrType === "vcard" ? "Escanea · Contacto" :
           qrType === "url" ? "Escanea · Web" :
           qrType === "video" ? "Escanea · Video" :
           qrType === "image" ? "Escanea · Imagen" :
           "Escanea · Animación"}
        </div>
      </div>
    </div>
  );
}

const QR_PATTERN = [
  1,1,1,1,0, 1,0,0,1,1, 1,0,1,0,1,
  1,0,0,0,1, 0,1,0,1,0, 1,1,0,0,1,
  0,1,1,0,1, 1,0,1,1,0, 1,0,0,1,1,
  1,0,0,0,1, 0,0,1,0,1, 1,1,0,1,0,
  1,1,1,1,0, 1,0,1,1,0, 0,0,1,0,1,
];

function QrPlaceholder({ accentColor, bg, qrType, size = 60 }: { accentColor: string; bg: string; qrType: string; size?: number }) {
  const icons: Record<string, string> = {
    vcard: "👤", url: "🔗", video: "▶", image: "🖼", animation: "✨",
  };
  const iconChar = icons[qrType] || "⬛";
  return (
    <div style={{
      width: size, height: size, background: "#fff", borderRadius: 4, padding: 4,
      display: "grid", gridTemplateColumns: "repeat(5,1fr)", gap: 2, boxSizing: "border-box",
      position: "relative", overflow: "hidden",
    }}>
      {QR_PATTERN.map((on, i) => {
        const r = Math.floor(i / 5);
        const c = i % 5;
        const isCorner = (r < 2 && c < 2) || (r < 2 && c > 2) || (r > 2 && c < 2);
        return (
          <div key={i} style={{
            background: isCorner ? accentColor : (on ? "#111" : "transparent"),
            borderRadius: 1,
          }} />
        );
      })}
      <div style={{
        position: "absolute", top: "50%", left: "50%", transform: "translate(-50%,-50%)",
        fontSize: size * 0.28, lineHeight: 1,
      }}>
        {iconChar}
      </div>
    </div>
  );
}

// ── Sub-components ──────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, { bg: string; color: string; label: string }> = {
    draft:      { bg: "rgba(150,150,150,0.2)", color: "#999",    label: "borrador" },
    generating: { bg: "rgba(82,160,255,0.2)",  color: "#52a0ff", label: "generando" },
    ready:      { bg: "rgba(34,197,94,0.2)",   color: "#22c55e", label: "lista" },
    failed:     { bg: "rgba(232,69,88,0.2)",   color: "#e84558", label: "error" },
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

// ── Estilos ─────────────────────────────────────────────────────────────────

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
  width: "100%", padding: "8px 10px", fontSize: 12,
  background: "rgba(0,0,0,0.3)", border: "1px solid rgba(255,255,255,0.08)",
  borderRadius: 4, color: "var(--t1)", outline: "none", fontFamily: "inherit",
};

const btnPrimary: React.CSSProperties = {
  padding: "8px 12px", fontSize: 12, fontWeight: 600,
  background: "linear-gradient(135deg, var(--gold), #b8941e)",
  color: "#0a0a0a", border: "none", borderRadius: 6, cursor: "pointer",
  display: "inline-flex", alignItems: "center", gap: 6, justifyContent: "center",
};

const btnSecondary: React.CSSProperties = {
  padding: "8px 12px", fontSize: 12,
  background: "rgba(255,255,255,0.05)", color: "var(--t1)",
  border: "1px solid rgba(255,255,255,0.1)", borderRadius: 6, cursor: "pointer",
  display: "inline-flex", alignItems: "center", gap: 6,
};

const btnSmall: React.CSSProperties = {
  padding: "6px 8px", fontSize: 11,
  background: "rgba(255,255,255,0.04)", color: "var(--t1)",
  border: "1px solid rgba(255,255,255,0.08)", borderRadius: 4, cursor: "pointer",
  display: "inline-flex", alignItems: "center", gap: 4,
  textDecoration: "none", justifyContent: "center",
};

const modalBackdrop: React.CSSProperties = {
  position: "fixed", top: 0, left: 0, right: 0, bottom: 0,
  background: "rgba(0,0,0,0.7)", display: "flex", alignItems: "center", justifyContent: "center",
  zIndex: 1000, padding: 20,
};

const modalContent: React.CSSProperties = {
  background: "var(--ink)", border: "1px solid rgba(255,255,255,0.1)",
  borderRadius: 10, padding: 24, maxWidth: 480, width: "100%",
};
