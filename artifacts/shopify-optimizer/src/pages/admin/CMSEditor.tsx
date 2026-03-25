import { useState, useEffect, useRef, useCallback } from "react";
import { Link } from "wouter";
import {
  Monitor, Tablet, Smartphone, Save, Loader2, Sparkles,
  RotateCcw, Eye, X, Check, RefreshCw, ChevronDown, ChevronRight,
  PenLine, LayoutTemplate,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const BASE_URL = import.meta.env.BASE_URL.replace(/\/$/, "");

type DeviceMode = "desktop" | "tablet" | "mobile";
type MobileTab  = "edit" | "preview";

const DEVICE_WIDTHS: Record<DeviceMode, string> = {
  desktop: "100%",
  tablet:  "768px",
  mobile:  "390px",
};

type FieldType = "text" | "textarea" | "color" | "boolean" | "url";

interface FieldDef {
  label: string;
  path: string;
  type: FieldType;
  placeholder?: string;
  hint?: string;
}

interface SectionDef {
  id: string;
  icon: string;
  label: string;
  fields: FieldDef[];
}

const SECTIONS: SectionDef[] = [
  {
    id: "site", icon: "🌐", label: "Sitio",
    fields: [
      { label: "Nombre", path: "site.name", type: "text", placeholder: "ShopyBrain" },
      { label: "Tagline", path: "site.tagline", type: "text", placeholder: "La plataforma de agencia Shopify más completa" },
      { label: "Emoji/Logo", path: "site.logo.value", type: "text", placeholder: "⚡" },
      { label: "Color primario", path: "site.primaryColor", type: "color" },
      { label: "Color acento", path: "site.accentColor", type: "color" },
    ],
  },
  {
    id: "hero", icon: "🦸", label: "Hero",
    fields: [
      { label: "Pill (texto)", path: "hero.pill.text", type: "text", placeholder: "Nuevo · 6 motores activos" },
      { label: "Titular", path: "hero.headline", type: "textarea", placeholder: "La agencia Shopify\nque trabaja 24/7\npor ti" },
      { label: "Highlight", path: "hero.headlineHighlight", type: "text", placeholder: "24/7", hint: "Texto que se muestra en dorado" },
      { label: "Subtítulo", path: "hero.subheadline", type: "textarea", placeholder: "Descripción..." },
      { label: "CTA primario", path: "hero.ctaPrimary.label", type: "text" },
      { label: "CTA secundario", path: "hero.ctaSecondary.label", type: "text" },
    ],
  },
  {
    id: "features", icon: "⭐", label: "Motores",
    fields: [
      { label: "Pill", path: "features.pill", type: "text" },
      { label: "Titular", path: "features.headline", type: "text" },
      { label: "Subtítulo", path: "features.subheadline", type: "textarea" },
      { label: "M01 Título", path: "features.items.0.title", type: "text" },
      { label: "M01 Descripción", path: "features.items.0.description", type: "textarea" },
      { label: "M02 Título", path: "features.items.1.title", type: "text" },
      { label: "M02 Descripción", path: "features.items.1.description", type: "textarea" },
      { label: "M03 Título", path: "features.items.2.title", type: "text" },
      { label: "M04 Título", path: "features.items.3.title", type: "text" },
      { label: "M05 Título", path: "features.items.4.title", type: "text" },
      { label: "M06 Título", path: "features.items.5.title", type: "text" },
    ],
  },
  {
    id: "stats", icon: "📊", label: "Estadísticas",
    fields: [
      { label: "Stat 1 — Número", path: "stats.0.num", type: "text" },
      { label: "Stat 1 — Label",  path: "stats.0.label", type: "text" },
      { label: "Stat 2 — Número", path: "stats.1.num", type: "text" },
      { label: "Stat 2 — Label",  path: "stats.1.label", type: "text" },
      { label: "Stat 3 — Número", path: "stats.2.num", type: "text" },
      { label: "Stat 3 — Label",  path: "stats.2.label", type: "text" },
      { label: "Stat 4 — Número", path: "stats.3.num", type: "text" },
      { label: "Stat 4 — Label",  path: "stats.3.label", type: "text" },
    ],
  },
  {
    id: "how", icon: "❓", label: "Cómo funciona",
    fields: [
      { label: "Pill", path: "how.pill", type: "text" },
      { label: "Titular", path: "how.headline", type: "textarea" },
      { label: "Paso 1 — Título", path: "how.steps.0.title", type: "text" },
      { label: "Paso 1 — Desc.",  path: "how.steps.0.desc", type: "textarea" },
      { label: "Paso 2 — Título", path: "how.steps.1.title", type: "text" },
      { label: "Paso 3 — Título", path: "how.steps.2.title", type: "text" },
      { label: "Paso 4 — Título", path: "how.steps.3.title", type: "text" },
    ],
  },
  {
    id: "pricing", icon: "💰", label: "Precios",
    fields: [
      { label: "Titular", path: "pricing.headline", type: "text" },
      { label: "Subtítulo", path: "pricing.subheadline", type: "text" },
      { label: "Plan 1 — Nombre", path: "pricing.plans.0.name", type: "text" },
      { label: "Plan 1 — Precio", path: "pricing.plans.0.price", type: "text" },
      { label: "Plan 1 — Periodo", path: "pricing.plans.0.period", type: "text" },
      { label: "Plan 1 — CTA",    path: "pricing.plans.0.cta.label", type: "text" },
      { label: "Plan 2 — Nombre", path: "pricing.plans.1.name", type: "text" },
      { label: "Plan 2 — Precio", path: "pricing.plans.1.price", type: "text" },
      { label: "Plan 2 — Badge",  path: "pricing.plans.1.badge", type: "text" },
      { label: "Plan 3 — Nombre", path: "pricing.plans.2.name", type: "text" },
      { label: "Plan 3 — Precio", path: "pricing.plans.2.price", type: "text" },
    ],
  },
  {
    id: "testimonials", icon: "💬", label: "Testimonios",
    fields: [
      { label: "Titular", path: "testimonials.headline", type: "text" },
      { label: "T1 — Texto",   path: "testimonials.items.0.text", type: "textarea" },
      { label: "T1 — Métrica", path: "testimonials.items.0.metric", type: "text" },
      { label: "T1 — Autor",   path: "testimonials.items.0.author", type: "text" },
      { label: "T1 — Rol",     path: "testimonials.items.0.role", type: "text" },
      { label: "T2 — Texto",   path: "testimonials.items.1.text", type: "textarea" },
      { label: "T2 — Métrica", path: "testimonials.items.1.metric", type: "text" },
      { label: "T2 — Autor",   path: "testimonials.items.1.author", type: "text" },
      { label: "T3 — Texto",   path: "testimonials.items.2.text", type: "textarea" },
      { label: "T3 — Métrica", path: "testimonials.items.2.metric", type: "text" },
      { label: "T3 — Autor",   path: "testimonials.items.2.author", type: "text" },
    ],
  },
  {
    id: "cta", icon: "📣", label: "CTA Final",
    fields: [
      { label: "Titular",          path: "cta.headline", type: "textarea" },
      { label: "Highlight",        path: "cta.headlineHighlight", type: "text" },
      { label: "Subtítulo",        path: "cta.subheadline", type: "textarea" },
      { label: "Placeholder email",path: "cta.placeholder", type: "text" },
      { label: "Botón",            path: "cta.buttonLabel", type: "text" },
      { label: "Pie de página",    path: "cta.finePrint", type: "text" },
    ],
  },
  {
    id: "footer", icon: "🔗", label: "Footer",
    fields: [
      { label: "Tagline",   path: "footer.tagline", type: "textarea" },
      { label: "Copyright", path: "footer.copyright", type: "text" },
    ],
  },
];

function getNestedValue(obj: Record<string, unknown>, path: string): unknown {
  const keys = path.split(".");
  let cur: unknown = obj;
  for (const k of keys) {
    if (cur === null || cur === undefined) return "";
    if (Array.isArray(cur)) cur = (cur as unknown[])[parseInt(k)];
    else if (typeof cur === "object") cur = (cur as Record<string, unknown>)[k];
    else return "";
  }
  return cur;
}

/* ── AI POPOVER ─────────────────────────────────────────────────────────── */
function AIImprovePopover({ text, onApply, onClose }: { text: string; onApply: (v: string) => void; onClose: () => void }) {
  const [instruction, setInstruction] = useState("");
  const [result, setResult]           = useState("");
  const [loading, setLoading]         = useState(false);
  const { toast } = useToast();

  const presets = [
    "Más persuasivo y urgente",
    "Más corto y directo",
    "Optimizado para SEO",
    "Tono más profesional",
    "Genera 3 alternativas",
  ];

  const run = async (inst: string) => {
    setLoading(true);
    setInstruction(inst);
    try {
      const res  = await fetch(`${BASE_URL}/api/cms/ai/improve`, {
        method: "POST", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text, instruction: inst }),
      });
      const data = await res.json() as { improved?: string; error?: string };
      if (data.improved) setResult(data.improved);
      else toast({ title: "Error IA", description: data.error, variant: "destructive" });
    } finally { setLoading(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: "rgba(0,0,0,.65)" }} onClick={onClose}>
      <div className="glass-card w-full max-w-lg p-6 shadow-2xl mx-4" style={{ border: "1px solid var(--gold)", borderRadius: 20 }} onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2 font-semibold" style={{ color: "var(--gold)" }}>
            <Sparkles className="w-4 h-4" />Mejorar con IA
          </div>
          <button onClick={onClose} className="nav-item" style={{ padding: "4px 6px", borderRadius: 8, minWidth: "auto" }}>
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="mb-4 p-3 text-xs font-mono" style={{ background: "var(--ink2)", borderRadius: 12, color: "var(--t2)", maxHeight: 80, overflowY: "auto" }}>
          "{text}"
        </div>

        <div className="flex flex-wrap gap-2 mb-3">
          {presets.map(p => (
            <button key={p} onClick={() => run(p)}
              className="text-xs px-3 py-1.5 transition-all"
              style={{ background: "var(--ink3)", border: "1px solid var(--bdr)", borderRadius: 8, color: "var(--t2)" }}
            >{p}</button>
          ))}
        </div>

        <div className="flex gap-2 mb-2">
          <input
            className="flex-1 px-3 py-2 text-sm outline-none"
            style={{ background: "var(--ink2)", border: "1px solid var(--bdr2)", borderRadius: 10, color: "var(--t)" }}
            placeholder="Instrucción personalizada..."
            value={instruction}
            onChange={e => setInstruction(e.target.value)}
            onKeyDown={e => e.key === "Enter" && run(instruction)}
          />
          <button onClick={() => run(instruction)} disabled={loading || !instruction} className="btn-primary px-4 py-2 text-sm" style={{ opacity: loading || !instruction ? 0.45 : 1 }}>
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : "→"}
          </button>
        </div>

        {result && (
          <div className="mt-3">
            <p className="text-xs mb-1.5" style={{ color: "var(--t3)" }}>Resultado:</p>
            <div className="p-3 text-sm mb-3" style={{ background: "var(--ink2)", border: "1px solid rgba(45,212,159,.25)", borderRadius: 12, color: "var(--t)" }}>{result}</div>
            <div className="flex gap-2">
              <button onClick={() => onApply(result)}
                className="flex items-center gap-1.5 px-4 py-2 text-sm font-semibold transition-all"
                style={{ background: "rgba(45,212,159,.12)", border: "1px solid rgba(45,212,159,.3)", color: "#2dd49f", borderRadius: 10 }}
              ><Check className="w-3.5 h-3.5" />Aplicar</button>
              <button onClick={() => setResult("")}
                className="px-4 py-2 text-sm transition-all"
                style={{ background: "var(--ink3)", border: "1px solid var(--bdr)", color: "var(--t2)", borderRadius: 10 }}
              >Descartar</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/* ── FIELD EDITOR ────────────────────────────────────────────────────────── */
function FieldEditor({ field, value, onChange }: { field: FieldDef; value: string; onChange: (path: string, value: string) => void }) {
  const [aiTarget, setAiTarget] = useState<string | null>(null);

  return (
    <div style={{ marginBottom: 16 }}>
      <div className="flex items-center justify-between" style={{ marginBottom: 6 }}>
        <label style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: "0.07em", fontWeight: 600, color: "var(--t3)" }}>
          {field.label}
        </label>
        {(field.type === "text" || field.type === "textarea") && (
          <button onClick={() => setAiTarget(value)}
            className="flex items-center gap-1 text-xs transition-colors"
            style={{ color: "var(--gold)", opacity: 0.7 }}
            onMouseEnter={e => (e.currentTarget.style.opacity = "1")}
            onMouseLeave={e => (e.currentTarget.style.opacity = "0.7")}
          >
            <Sparkles className="w-3 h-3" />IA
          </button>
        )}
      </div>

      {field.hint && <p style={{ fontSize: 11, color: "var(--t4)", marginBottom: 6 }}>{field.hint}</p>}

      {field.type === "textarea" ? (
        <textarea
          rows={3}
          value={value}
          onChange={e => onChange(field.path, e.target.value)}
          style={{ width: "100%", background: "var(--ink2)", border: "1px solid var(--bdr)", borderRadius: 10, padding: "8px 12px", fontSize: 13, color: "var(--t)", outline: "none", resize: "none", lineHeight: 1.55, boxSizing: "border-box" }}
          onFocus={e => (e.currentTarget.style.borderColor = "var(--gold)")}
          onBlur={e  => (e.currentTarget.style.borderColor = "var(--bdr)")}
        />
      ) : field.type === "color" ? (
        <div className="flex items-center gap-2">
          <input type="color" value={value || "#c8a84b"} onChange={e => onChange(field.path, e.target.value)}
            style={{ width: 40, height: 40, borderRadius: 10, cursor: "pointer", border: "none", background: "transparent" }} />
          <input
            value={value}
            onChange={e => onChange(field.path, e.target.value)}
            style={{ flex: 1, background: "var(--ink2)", border: "1px solid var(--bdr)", borderRadius: 10, padding: "8px 12px", fontSize: 13, color: "var(--t)", outline: "none", fontFamily: "monospace" }}
            onFocus={e => (e.currentTarget.style.borderColor = "var(--gold)")}
            onBlur={e  => (e.currentTarget.style.borderColor = "var(--bdr)")}
          />
        </div>
      ) : field.type === "boolean" ? (
        <button
          onClick={() => onChange(field.path, value === "true" ? "false" : "true")}
          style={{ width: 44, height: 26, borderRadius: 13, background: value === "true" ? "#2dd49f" : "var(--ink3)", transition: "background .2s", position: "relative", border: "none", cursor: "pointer" }}
        >
          <div style={{ width: 18, height: 18, background: "white", borderRadius: "50%", position: "absolute", top: 4, left: value === "true" ? 22 : 4, transition: "left .2s" }} />
        </button>
      ) : (
        <input
          value={value}
          placeholder={field.placeholder}
          onChange={e => onChange(field.path, e.target.value)}
          style={{ width: "100%", background: "var(--ink2)", border: "1px solid var(--bdr)", borderRadius: 10, padding: "8px 12px", fontSize: 13, color: "var(--t)", outline: "none", boxSizing: "border-box" }}
          onFocus={e => (e.currentTarget.style.borderColor = "var(--gold)")}
          onBlur={e  => (e.currentTarget.style.borderColor = "var(--bdr)")}
        />
      )}

      {aiTarget !== null && (
        <AIImprovePopover
          text={aiTarget}
          onApply={v => { onChange(field.path, v); setAiTarget(null); }}
          onClose={() => setAiTarget(null)}
        />
      )}
    </div>
  );
}

/* ── VERSION ENTRY ───────────────────────────────────────────────────────── */
interface VersionEntry {
  id: number;
  version: number;
  savedAt: string;
  savedBy: string | null;
  label: string | null;
}

/* ══════════════════════════════════════════════════════════════════════════
   MAIN COMPONENT
══════════════════════════════════════════════════════════════════════════ */
export default function CMSEditor() {
  const [content, setContent]           = useState<Record<string, unknown> | null>(null);
  const [pending, setPending]           = useState<Map<string, unknown>>(new Map());
  const [saving, setSaving]             = useState(false);
  const [device, setDevice]             = useState<DeviceMode>("desktop");
  const [openSections, setOpenSections] = useState<Set<string>>(new Set(["hero"]));
  const [versions, setVersions]         = useState<VersionEntry[]>([]);
  const [showVersions, setShowVersions] = useState(false);
  const [iframeKey, setIframeKey]       = useState(0);
  const [mobileTab, setMobileTab]       = useState<MobileTab>("edit");
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const { toast } = useToast();

  const changeCount = pending.size;

  useEffect(() => {
    loadContent();
    loadVersions();
    const es = new EventSource(`${BASE_URL}/api/cms/events`);
    es.addEventListener("content_updated", () => { loadContent(); setIframeKey(k => k + 1); });
    return () => es.close();
  }, []);

  const loadContent = async () => {
    const res  = await fetch(`${BASE_URL}/api/cms/content`);
    const data = await res.json() as Record<string, unknown>;
    setContent(data);
  };

  const loadVersions = async () => {
    const res  = await fetch(`${BASE_URL}/api/cms/versions`, { credentials: "include" });
    const data = await res.json() as VersionEntry[];
    setVersions(data);
  };

  const handleFieldChange = useCallback((path: string, value: string) => {
    setPending(prev => { const n = new Map(prev); n.set(path, value); return n; });
    setContent(prev => {
      if (!prev) return prev;
      const keys    = path.split(".");
      const updated = JSON.parse(JSON.stringify(prev)) as Record<string, unknown>;
      let cur: Record<string, unknown> | unknown[] = updated;
      for (let i = 0; i < keys.length - 1; i++) {
        const k = keys[i];
        const nxt: unknown = Array.isArray(cur) ? (cur as unknown[])[parseInt(k)] : (cur as Record<string, unknown>)[k];
        if (typeof nxt === "object" && nxt !== null) cur = nxt as Record<string, unknown>;
      }
      const last = keys[keys.length - 1];
      if (Array.isArray(cur)) (cur as unknown[])[parseInt(last)] = value;
      else (cur as Record<string, unknown>)[last] = value;
      return updated;
    });
  }, []);

  const save = async () => {
    if (changeCount === 0) return;
    setSaving(true);
    try {
      const changes = Array.from(pending.entries()).map(([path, value]) => ({ path, value }));
      const res = await fetch(`${BASE_URL}/api/cms/content/batch`, {
        method: "POST", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ changes }),
      });
      if (res.ok) {
        setPending(new Map());
        setIframeKey(k => k + 1);
        await loadVersions();
        toast({ title: "✅ Guardado", description: `${changes.length} cambios aplicados a la landing` });
      }
    } finally { setSaving(false); }
  };

  const restoreVersion = async (id: number) => {
    await fetch(`${BASE_URL}/api/cms/versions/${id}/restore`, { method: "POST", credentials: "include" });
    await loadContent();
    await loadVersions();
    setIframeKey(k => k + 1);
    setShowVersions(false);
    toast({ title: "Versión restaurada" });
  };

  const resetToDefaults = async () => {
    if (!confirm("¿Restaurar todo el contenido a los valores por defecto?")) return;
    await fetch(`${BASE_URL}/api/cms/content/reset`, { method: "POST", credentials: "include" });
    await loadContent();
    setPending(new Map());
    setIframeKey(k => k + 1);
    toast({ title: "Contenido restaurado" });
  };

  const toggleSection = (id: string) => setOpenSections(prev => {
    const n = new Set(prev);
    if (n.has(id)) n.delete(id); else n.add(id);
    return n;
  });

  const previewUrl = `${window.location.origin}${BASE_URL === "" ? "" : BASE_URL}/landing`;

  if (!content) {
    return (
      <div className="main-content flex items-center justify-center" style={{ minHeight: "60vh" }}>
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin mx-auto mb-3" style={{ color: "var(--gold)" }} />
          <p style={{ color: "var(--t3)", fontSize: 14 }}>Cargando editor...</p>
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", overflow: "hidden" }}>

      {/* ── TOPBAR ──────────────────────────────────────────────────────── */}
      <div className="topbar-cms" style={{
        flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "0 16px", height: 56, gap: 12,
        borderBottom: "1px solid var(--bdr)", background: "var(--ink)",
      }}>
        {/* Left: title + badge */}
        <div className="flex items-center gap-3" style={{ minWidth: 0 }}>
          <div className="flex items-center gap-2">
            <div style={{
              width: 32, height: 32, borderRadius: 10,
              background: "linear-gradient(135deg,var(--gold),#e6c668)",
              display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16,
            }}>✏️</div>
            <span style={{ fontWeight: 700, fontSize: 15, color: "var(--t)" }}>Editor Landing</span>
          </div>
          {changeCount > 0 ? (
            <span style={{
              fontSize: 11, background: "rgba(200,168,75,.15)", color: "var(--gold)",
              padding: "3px 10px", borderRadius: 20, border: "1px solid rgba(200,168,75,.3)", whiteSpace: "nowrap",
            }}>{changeCount} sin guardar</span>
          ) : (
            <span style={{ fontSize: 11, color: "var(--t4)", whiteSpace: "nowrap" }}>Sin cambios</span>
          )}
        </div>

        {/* Center: device switcher — hidden on mobile */}
        <div className="cms-device-switcher" style={{
          display: "flex", alignItems: "center", gap: 2,
          background: "var(--ink2)", borderRadius: 12, padding: "3px",
        }}>
          {(["desktop", "tablet", "mobile"] as DeviceMode[]).map(d => (
            <button key={d} onClick={() => setDevice(d)} title={d}
              style={{
                padding: "6px 10px", borderRadius: 9, border: "none", cursor: "pointer", transition: "all .15s",
                background: device === d ? "var(--ink3)" : "transparent",
                color: device === d ? "var(--gold)" : "var(--t3)",
              }}
            >
              {d === "desktop" ? <Monitor size={15} /> : d === "tablet" ? <Tablet size={15} /> : <Smartphone size={15} />}
            </button>
          ))}
        </div>

        {/* Right: actions */}
        <div className="flex items-center gap-2">
          <button onClick={() => setShowVersions(v => !v)}
            className="flex items-center gap-1.5"
            style={{
              padding: "6px 12px", background: "var(--ink2)", border: "1px solid var(--bdr)", borderRadius: 10,
              fontSize: 12, color: "var(--t2)", cursor: "pointer", whiteSpace: "nowrap",
            }}
          ><RefreshCw size={12} /><span className="cms-btn-label">Historial</span></button>

          <button onClick={resetToDefaults}
            className="flex items-center gap-1.5"
            style={{
              padding: "6px 12px", background: "var(--ink2)", border: "1px solid var(--bdr)", borderRadius: 10,
              fontSize: 12, color: "var(--t2)", cursor: "pointer",
            }}
          ><RotateCcw size={12} /><span className="cms-btn-label">Reset</span></button>

          <button onClick={save} disabled={saving || changeCount === 0}
            className="btn-primary flex items-center gap-1.5"
            style={{ padding: "6px 14px", fontSize: 12, opacity: saving || changeCount === 0 ? 0.45 : 1 }}
          >
            {saving ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />}
            {saving ? "Guardando..." : "Guardar"}
          </button>
        </div>
      </div>

      {/* ── MOBILE TAB BAR ──────────────────────────────────────────────── */}
      <div className="cms-mobile-tabs" style={{
        display: "none", flexShrink: 0,
        borderBottom: "1px solid var(--bdr)", background: "var(--ink)",
      }}>
        {(["edit", "preview"] as MobileTab[]).map(tab => (
          <button key={tab} onClick={() => setMobileTab(tab)}
            style={{
              flex: 1, padding: "10px 0", fontSize: 13, fontWeight: 600, border: "none",
              cursor: "pointer", background: "transparent",
              color: mobileTab === tab ? "var(--gold)" : "var(--t3)",
              borderBottom: mobileTab === tab ? "2px solid var(--gold)" : "2px solid transparent",
              display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
              transition: "all .15s",
            }}
          >
            {tab === "edit" ? <PenLine size={14} /> : <LayoutTemplate size={14} />}
            {tab === "edit" ? "Editar" : "Vista previa"}
          </button>
        ))}
      </div>

      {/* ── BODY ────────────────────────────────────────────────────────── */}
      <div style={{ flex: 1, display: "flex", overflow: "hidden" }}>

        {/* LEFT PANEL — content tree */}
        <div className="cms-left-panel" style={{
          width: 300, flexShrink: 0, display: "flex", flexDirection: "column",
          borderRight: "1px solid var(--bdr)", background: "var(--ink)", overflow: "hidden",
        }}>
          {/* panel header */}
          <div style={{ padding: "10px 16px", borderBottom: "1px solid var(--bdr)" }}>
            <p style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: "0.1em", fontWeight: 700, color: "var(--t3)" }}>
              Árbol de contenido
            </p>
          </div>

          {/* sections list */}
          <div style={{ flex: 1, overflowY: "auto" }}>
            {SECTIONS.map(section => {
              const isOpen = openSections.has(section.id);
              return (
                <div key={section.id} style={{ borderBottom: "1px solid var(--bdr)" }}>
                  <button onClick={() => toggleSection(section.id)}
                    style={{
                      width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between",
                      padding: "11px 16px", cursor: "pointer", border: "none",
                      background: isOpen ? "var(--ink2)" : "transparent",
                      transition: "background .15s",
                    }}
                  >
                    <span style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <span style={{ fontSize: 16 }}>{section.icon}</span>
                      <span style={{ fontSize: 13, fontWeight: 600, color: "var(--t)" }}>{section.label}</span>
                    </span>
                    {isOpen
                      ? <ChevronDown size={13} style={{ color: "var(--gold)" }} />
                      : <ChevronRight size={13} style={{ color: "var(--t4)" }} />}
                  </button>

                  {isOpen && (
                    <div style={{ padding: "12px 16px 16px", background: "var(--ink3)" }}>
                      {section.fields.map(field => {
                        const raw   = getNestedValue(content, field.path);
                        const value = typeof raw === "string" ? raw
                          : typeof raw === "number" ? String(raw)
                          : typeof raw === "boolean" ? String(raw) : "";
                        return (
                          <FieldEditor key={field.path} field={field} value={value} onChange={handleFieldChange} />
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* RIGHT PANEL — live preview */}
        <div className="cms-right-panel" style={{
          flex: 1, display: "flex", flexDirection: "column",
          background: "var(--ink3)", overflow: "hidden",
        }}>
          {/* preview topbar */}
          <div style={{
            flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "space-between",
            padding: "0 16px", height: 40, borderBottom: "1px solid var(--bdr)",
          }}>
            <div className="flex items-center gap-2" style={{ color: "var(--t3)", fontSize: 12 }}>
              <Eye size={13} />
              <span>Vista previa en vivo</span>
              <span style={{ color: "var(--bdr2)" }}>·</span>
              <span style={{ fontFamily: "monospace", fontSize: 11, color: "var(--t4)" }}>
                {device} · {DEVICE_WIDTHS[device]}
              </span>
            </div>
            <button onClick={() => setIframeKey(k => k + 1)}
              className="flex items-center gap-1"
              style={{ fontSize: 11, color: "var(--t3)", cursor: "pointer", background: "none", border: "none" }}
            ><RefreshCw size={12} />Recargar</button>
          </div>

          {/* iframe container */}
          <div style={{ flex: 1, overflow: "auto", display: "flex", alignItems: "flex-start", justifyContent: "center", padding: 16 }}>
            <div style={{ width: DEVICE_WIDTHS[device], maxWidth: "100%", height: "100%", minHeight: 500, transition: "width .3s" }}>
              <iframe
                key={iframeKey}
                ref={iframeRef}
                src={previewUrl}
                title="Landing page preview"
                style={{
                  width: "100%", height: "100%", minHeight: 500,
                  border: "1px solid var(--bdr2)", borderRadius: 16,
                  background: "var(--ink)", boxShadow: "var(--sh)",
                }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* ── VERSION HISTORY DRAWER ──────────────────────────────────────── */}
      {showVersions && (
        <div style={{
          position: "fixed", right: 0, top: 0, bottom: 0, width: 280, zIndex: 50,
          background: "var(--ink)", borderLeft: "1px solid var(--bdr2)",
          display: "flex", flexDirection: "column", boxShadow: "var(--sh)",
        }}>
          <div style={{ padding: "14px 16px", borderBottom: "1px solid var(--bdr)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <span style={{ fontSize: 14, fontWeight: 700, color: "var(--t)" }}>Historial de versiones</span>
            <button onClick={() => setShowVersions(false)} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--t3)" }}>
              <X size={16} />
            </button>
          </div>
          <div style={{ flex: 1, overflowY: "auto", padding: 12, display: "flex", flexDirection: "column", gap: 8 }}>
            {versions.length === 0 && (
              <p style={{ fontSize: 12, color: "var(--t4)", textAlign: "center", padding: "16px 0" }}>Sin versiones guardadas</p>
            )}
            {versions.map(v => (
              <div key={v.id} className="glass-card" style={{ padding: 12 }}>
                <div className="flex items-center justify-between" style={{ marginBottom: 4 }}>
                  <span style={{ fontSize: 12, fontFamily: "monospace", color: "var(--gold)", fontWeight: 700 }}>v{v.version}</span>
                  <span style={{ fontSize: 11, color: "var(--t4)" }}>
                    {new Date(v.savedAt).toLocaleString("es-ES", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}
                  </span>
                </div>
                {v.savedBy && <p style={{ fontSize: 11, color: "var(--t3)", marginBottom: 8 }}>por {v.savedBy}</p>}
                <button onClick={() => restoreVersion(v.id)} style={{
                  width: "100%", padding: "7px 0", fontSize: 12, borderRadius: 8, cursor: "pointer",
                  background: "var(--ink3)", border: "1px solid var(--bdr)", color: "var(--t2)",
                  transition: "all .15s",
                }}>Restaurar esta versión</button>
              </div>
            ))}
          </div>
        </div>
      )}

      <style>{`
        /* ── CMS responsive ──────────────────────────────────────── */
        @media (max-width: 768px) {
          .cms-device-switcher { display: none !important; }
          .cms-btn-label { display: none; }
          .cms-mobile-tabs { display: flex !important; }
          .cms-left-panel {
            width: 100% !important;
            border-right: none !important;
            display: ${mobileTab === "edit" ? "flex" : "none"} !important;
          }
          .cms-right-panel {
            display: ${mobileTab === "preview" ? "flex" : "none"} !important;
            width: 100% !important;
          }
        }
        @media (max-width: 480px) {
          .topbar-cms { padding: 0 10px; gap: 8px; }
        }
      `}</style>
    </div>
  );
}
