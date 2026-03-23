import { useState, useEffect, useRef, useCallback } from "react";
import { Link } from "wouter";
import { Monitor, Tablet, Smartphone, Undo2, Redo2, Save, Upload, ChevronDown, ChevronRight, Loader2, Sparkles, RotateCcw, Eye, X, Check, RefreshCw } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const BASE_URL = import.meta.env.BASE_URL.replace(/\/$/, "");

type DeviceMode = "desktop" | "tablet" | "mobile";

const DEVICE_WIDTHS: Record<DeviceMode, string> = {
  desktop: "100%",
  tablet: "768px",
  mobile: "390px",
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
      { label: "Nombre", path: "site.name", type: "text", placeholder: "ShopifyAI Pro" },
      { label: "Tagline", path: "site.tagline", type: "text", placeholder: "La agencia Shopify del futuro" },
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
      { label: "Stat 1 — Label", path: "stats.0.label", type: "text" },
      { label: "Stat 2 — Número", path: "stats.1.num", type: "text" },
      { label: "Stat 2 — Label", path: "stats.1.label", type: "text" },
      { label: "Stat 3 — Número", path: "stats.2.num", type: "text" },
      { label: "Stat 3 — Label", path: "stats.2.label", type: "text" },
      { label: "Stat 4 — Número", path: "stats.3.num", type: "text" },
      { label: "Stat 4 — Label", path: "stats.3.label", type: "text" },
    ],
  },
  {
    id: "how", icon: "❓", label: "Cómo funciona",
    fields: [
      { label: "Pill", path: "how.pill", type: "text" },
      { label: "Titular", path: "how.headline", type: "textarea" },
      { label: "Paso 1 — Título", path: "how.steps.0.title", type: "text" },
      { label: "Paso 1 — Desc.", path: "how.steps.0.desc", type: "textarea" },
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
      { label: "Plan 1 — CTA", path: "pricing.plans.0.cta.label", type: "text" },
      { label: "Plan 2 — Nombre", path: "pricing.plans.1.name", type: "text" },
      { label: "Plan 2 — Precio", path: "pricing.plans.1.price", type: "text" },
      { label: "Plan 2 — Badge", path: "pricing.plans.1.badge", type: "text" },
      { label: "Plan 3 — Nombre", path: "pricing.plans.2.name", type: "text" },
      { label: "Plan 3 — Precio", path: "pricing.plans.2.price", type: "text" },
    ],
  },
  {
    id: "testimonials", icon: "💬", label: "Testimonios",
    fields: [
      { label: "Titular", path: "testimonials.headline", type: "text" },
      { label: "T1 — Texto", path: "testimonials.items.0.text", type: "textarea" },
      { label: "T1 — Métrica", path: "testimonials.items.0.metric", type: "text" },
      { label: "T1 — Autor", path: "testimonials.items.0.author", type: "text" },
      { label: "T1 — Rol", path: "testimonials.items.0.role", type: "text" },
      { label: "T2 — Texto", path: "testimonials.items.1.text", type: "textarea" },
      { label: "T2 — Métrica", path: "testimonials.items.1.metric", type: "text" },
      { label: "T2 — Autor", path: "testimonials.items.1.author", type: "text" },
      { label: "T3 — Texto", path: "testimonials.items.2.text", type: "textarea" },
      { label: "T3 — Métrica", path: "testimonials.items.2.metric", type: "text" },
      { label: "T3 — Autor", path: "testimonials.items.2.author", type: "text" },
    ],
  },
  {
    id: "cta", icon: "📣", label: "CTA Final",
    fields: [
      { label: "Titular", path: "cta.headline", type: "textarea" },
      { label: "Highlight", path: "cta.headlineHighlight", type: "text" },
      { label: "Subtítulo", path: "cta.subheadline", type: "textarea" },
      { label: "Placeholder email", path: "cta.placeholder", type: "text" },
      { label: "Botón", path: "cta.buttonLabel", type: "text" },
      { label: "Pie de página", path: "cta.finePrint", type: "text" },
    ],
  },
  {
    id: "footer", icon: "🔗", label: "Footer",
    fields: [
      { label: "Tagline", path: "footer.tagline", type: "textarea" },
      { label: "Copyright", path: "footer.copyright", type: "text" },
    ],
  },
];

function getNestedValue(obj: Record<string, unknown>, path: string): unknown {
  const keys = path.split(".");
  let current: unknown = obj;
  for (const k of keys) {
    if (current === null || current === undefined) return "";
    if (typeof current === "object" && !Array.isArray(current)) {
      current = (current as Record<string, unknown>)[k];
    } else if (Array.isArray(current)) {
      current = (current as unknown[])[parseInt(k)];
    } else return "";
  }
  return current;
}

interface AIImprovePopoverProps {
  text: string;
  onApply: (improved: string) => void;
  onClose: () => void;
}

function AIImprovePopover({ text, onApply, onClose }: AIImprovePopoverProps) {
  const [instruction, setInstruction] = useState("");
  const [result, setResult] = useState("");
  const [loading, setLoading] = useState(false);
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
      const res = await fetch(`${BASE_URL}/api/cms/ai/improve`, {
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={onClose}>
      <div className="bg-[#0e0e1a] border border-[#35334f] rounded-2xl w-full max-w-lg p-6 shadow-2xl" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2 text-[#c8a84b] font-semibold"><Sparkles className="w-4 h-4" />Mejorar con IA</div>
          <button onClick={onClose} className="text-[#58567a] hover:text-white"><X className="w-4 h-4" /></button>
        </div>
        <div className="bg-[#151524] rounded-xl p-3 mb-4 text-xs text-[#9896ba] font-mono max-h-20 overflow-auto">"{text}"</div>
        <div className="flex flex-wrap gap-2 mb-3">
          {presets.map(p => (
            <button key={p} onClick={() => run(p)} className="px-3 py-1.5 bg-[#1c1c2e] border border-[#35334f] rounded-lg text-xs text-[#9896ba] hover:border-[#c8a84b] hover:text-[#c8a84b] transition-all">
              {p}
            </button>
          ))}
        </div>
        <div className="flex gap-2 mb-4">
          <input
            className="flex-1 bg-[#1c1c2e] border border-[#35334f] rounded-lg px-3 py-2 text-sm text-white focus:border-[#c8a84b] outline-none"
            placeholder="Instrucción personalizada..."
            value={instruction}
            onChange={e => setInstruction(e.target.value)}
            onKeyDown={e => e.key === "Enter" && run(instruction)}
          />
          <button onClick={() => run(instruction)} disabled={loading || !instruction} className="px-4 py-2 bg-gradient-to-r from-[#c8a84b] to-[#e6c668] text-[#060500] rounded-lg font-bold text-sm disabled:opacity-50">
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : "→"}
          </button>
        </div>
        {result && (
          <div className="mt-2">
            <div className="text-xs text-[#58567a] mb-2">Resultado:</div>
            <div className="bg-[#151524] border border-[#2dd49f]/20 rounded-xl p-3 text-sm text-white mb-3">{result}</div>
            <div className="flex gap-2">
              <button onClick={() => onApply(result)} className="flex items-center gap-1.5 px-4 py-2 bg-[#2dd49f]/10 border border-[#2dd49f]/30 text-[#2dd49f] rounded-lg text-sm font-semibold hover:bg-[#2dd49f]/20 transition-all">
                <Check className="w-3.5 h-3.5" />Aplicar
              </button>
              <button onClick={() => setResult("")} className="px-4 py-2 bg-[#1c1c2e] border border-[#35334f] text-[#9896ba] rounded-lg text-sm hover:border-[#58567a] transition-all">Descartar</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

interface FieldEditorProps {
  field: FieldDef;
  value: string;
  onChange: (path: string, value: string) => void;
}

function FieldEditor({ field, value, onChange }: FieldEditorProps) {
  const [aiTarget, setAiTarget] = useState<string | null>(null);

  const handleAI = () => setAiTarget(value);

  return (
    <div className="mb-4">
      <div className="flex items-center justify-between mb-1.5">
        <label className="text-xs text-[#58567a] uppercase tracking-wider font-semibold">{field.label}</label>
        {(field.type === "text" || field.type === "textarea") && (
          <button onClick={handleAI} className="flex items-center gap-1 text-xs text-[#c8a84b]/60 hover:text-[#c8a84b] transition-colors">
            <Sparkles className="w-3 h-3" />IA
          </button>
        )}
      </div>
      {field.hint && <p className="text-xs text-[#35334f] mb-1.5">{field.hint}</p>}

      {field.type === "textarea" ? (
        <textarea
          className="w-full bg-[#0e0e1a] border border-[#1c1c2e] rounded-lg px-3 py-2 text-sm text-white focus:border-[#c8a84b]/50 outline-none resize-none leading-relaxed"
          rows={3}
          value={value}
          onChange={e => onChange(field.path, e.target.value)}
        />
      ) : field.type === "color" ? (
        <div className="flex items-center gap-2">
          <input type="color" value={value || "#c8a84b"} onChange={e => onChange(field.path, e.target.value)} className="w-10 h-10 rounded-lg cursor-pointer border-0 bg-transparent" />
          <input
            className="flex-1 bg-[#0e0e1a] border border-[#1c1c2e] rounded-lg px-3 py-2 text-sm text-white focus:border-[#c8a84b]/50 outline-none font-mono"
            value={value}
            onChange={e => onChange(field.path, e.target.value)}
          />
        </div>
      ) : field.type === "boolean" ? (
        <button
          onClick={() => onChange(field.path, value === "true" ? "false" : "true")}
          className={`w-10 h-6 rounded-full transition-colors ${value === "true" ? "bg-[#2dd49f]" : "bg-[#1c1c2e]"}`}
        >
          <div className={`w-4 h-4 bg-white rounded-full transition-transform mx-1 ${value === "true" ? "translate-x-4" : ""}`}></div>
        </button>
      ) : (
        <input
          className="w-full bg-[#0e0e1a] border border-[#1c1c2e] rounded-lg px-3 py-2 text-sm text-white focus:border-[#c8a84b]/50 outline-none"
          value={value}
          placeholder={field.placeholder}
          onChange={e => onChange(field.path, e.target.value)}
        />
      )}

      {aiTarget !== null && (
        <AIImprovePopover
          text={aiTarget}
          onApply={improved => { onChange(field.path, improved); setAiTarget(null); }}
          onClose={() => setAiTarget(null)}
        />
      )}
    </div>
  );
}

interface VersionEntry {
  id: number;
  version: number;
  savedAt: string;
  savedBy: string | null;
  label: string | null;
}

export default function CMSEditor() {
  const [content, setContent] = useState<Record<string, unknown> | null>(null);
  const [pendingChanges, setPendingChanges] = useState<Map<string, unknown>>(new Map());
  const [saving, setSaving] = useState(false);
  const [device, setDevice] = useState<DeviceMode>("desktop");
  const [openSections, setOpenSections] = useState<Set<string>>(new Set(["hero"]));
  const [versions, setVersions] = useState<VersionEntry[]>([]);
  const [showVersions, setShowVersions] = useState(false);
  const [history, setHistory] = useState<Map<string, unknown>[]>([]);
  const [historyIdx, setHistoryIdx] = useState(-1);
  const [iframeKey, setIframeKey] = useState(0);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const { toast } = useToast();

  const changeCount = pendingChanges.size;

  useEffect(() => {
    loadContent();
    loadVersions();
    const es = new EventSource(`${BASE_URL}/api/cms/events`);
    es.addEventListener("content_updated", () => { loadContent(); setIframeKey(k => k + 1); });
    return () => es.close();
  }, []);

  const loadContent = async () => {
    const res = await fetch(`${BASE_URL}/api/cms/content`);
    const data = await res.json() as Record<string, unknown>;
    setContent(data);
  };

  const loadVersions = async () => {
    const res = await fetch(`${BASE_URL}/api/cms/versions`, { credentials: "include" });
    const data = await res.json() as VersionEntry[];
    setVersions(data);
  };

  const handleFieldChange = useCallback((path: string, value: string) => {
    setPendingChanges(prev => {
      const next = new Map(prev);
      next.set(path, value);
      return next;
    });
    setContent(prev => {
      if (!prev) return prev;
      const keys = path.split(".");
      const updated = JSON.parse(JSON.stringify(prev)) as Record<string, unknown>;
      let cur: Record<string, unknown> | unknown[] = updated;
      for (let i = 0; i < keys.length - 1; i++) {
        const k = keys[i];
        const next_: unknown = Array.isArray(cur) ? (cur as unknown[])[parseInt(k)] : (cur as Record<string, unknown>)[k];
        if (typeof next_ === "object" && next_ !== null) cur = next_ as Record<string, unknown>;
      }
      const lastKey = keys[keys.length - 1];
      if (Array.isArray(cur)) (cur as unknown[])[parseInt(lastKey)] = value;
      else (cur as Record<string, unknown>)[lastKey] = value;
      return updated;
    });
  }, []);

  const save = async () => {
    if (changeCount === 0) return;
    setSaving(true);
    try {
      const changes = Array.from(pendingChanges.entries()).map(([path, value]) => ({ path, value }));
      const res = await fetch(`${BASE_URL}/api/cms/content/batch`, {
        method: "POST", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ changes }),
      });
      if (res.ok) {
        setPendingChanges(new Map());
        setIframeKey(k => k + 1);
        await loadVersions();
        toast({ title: "Guardado", description: `${changes.length} cambios guardados correctamente` });
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
    setPendingChanges(new Map());
    setIframeKey(k => k + 1);
    toast({ title: "Contenido restaurado" });
  };

  const toggleSection = (id: string) => {
    setOpenSections(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const previewUrl = `${window.location.origin}${BASE_URL === "" ? "" : BASE_URL}/`;

  if (!content) {
    return (
      <div className="min-h-screen bg-[#080810] flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-[#c8a84b] animate-spin" />
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col bg-[#080810] text-white overflow-hidden">
      {/* TOP BAR */}
      <div className="flex-shrink-0 border-b border-[#1c1c2e] bg-[#0e0e1a] px-4 h-14 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Link href="/" className="flex items-center gap-2 text-[#c8a84b] hover:text-[#e6c668] transition-colors">
            <div className="w-7 h-7 bg-gradient-to-br from-[#c8a84b] to-[#e6c668] rounded-lg flex items-center justify-center text-sm">⚡</div>
            <span className="font-semibold text-sm">CMS</span>
          </Link>
          <div className="w-px h-5 bg-[#1c1c2e]"></div>
          {changeCount > 0 ? (
            <span className="text-xs text-[#c8a84b] bg-[#c8a84b]/10 px-2 py-1 rounded-full">{changeCount} cambio{changeCount > 1 ? "s" : ""} sin guardar</span>
          ) : (
            <span className="text-xs text-[#58567a]">Sin cambios pendientes</span>
          )}
        </div>

        <div className="flex items-center gap-1 bg-[#151524] rounded-xl p-1">
          {(["desktop", "tablet", "mobile"] as DeviceMode[]).map(d => (
            <button key={d} onClick={() => setDevice(d)} className={`p-2 rounded-lg transition-all ${device === d ? "bg-[#1c1c2e] text-[#c8a84b]" : "text-[#58567a] hover:text-[#9896ba]"}`}>
              {d === "desktop" ? <Monitor className="w-4 h-4" /> : d === "tablet" ? <Tablet className="w-4 h-4" /> : <Smartphone className="w-4 h-4" />}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2">
          <button onClick={() => setShowVersions(v => !v)} className="flex items-center gap-1.5 px-3 py-1.5 bg-[#151524] border border-[#1c1c2e] rounded-lg text-xs text-[#9896ba] hover:text-white hover:border-[#35334f] transition-all">
            <RefreshCw className="w-3.5 h-3.5" />Historial
          </button>
          <button onClick={resetToDefaults} className="flex items-center gap-1.5 px-3 py-1.5 bg-[#151524] border border-[#1c1c2e] rounded-lg text-xs text-[#9896ba] hover:text-white hover:border-[#35334f] transition-all">
            <RotateCcw className="w-3.5 h-3.5" />Reset
          </button>
          <button onClick={save} disabled={saving || changeCount === 0} className="flex items-center gap-1.5 px-4 py-1.5 bg-gradient-to-r from-[#c8a84b] to-[#e6c668] text-[#060500] rounded-lg text-xs font-bold disabled:opacity-40 hover:shadow-lg hover:shadow-[#c8a84b]/20 transition-all">
            {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
            {saving ? "Guardando..." : "Guardar"}
          </button>
        </div>
      </div>

      <div className="flex-1 flex overflow-hidden">
        {/* LEFT PANEL — Content Tree */}
        <div className="w-80 flex-shrink-0 border-r border-[#1c1c2e] bg-[#0a0a14] flex flex-col overflow-hidden">
          <div className="px-4 py-3 border-b border-[#1c1c2e]">
            <p className="text-xs text-[#58567a] uppercase tracking-wider font-semibold">Árbol de contenido</p>
          </div>
          <div className="flex-1 overflow-y-auto">
            {SECTIONS.map(section => {
              const isOpen = openSections.has(section.id);
              return (
                <div key={section.id} className="border-b border-[#1c1c2e]/50">
                  <button
                    onClick={() => toggleSection(section.id)}
                    className="w-full flex items-center justify-between px-4 py-3 text-sm hover:bg-[#0e0e1a] transition-colors"
                  >
                    <span className="flex items-center gap-2.5">
                      <span className="text-base">{section.icon}</span>
                      <span className="font-medium text-[#f2f0ff]">{section.label}</span>
                    </span>
                    {isOpen ? <ChevronDown className="w-3.5 h-3.5 text-[#58567a]" /> : <ChevronRight className="w-3.5 h-3.5 text-[#58567a]" />}
                  </button>
                  {isOpen && (
                    <div className="px-4 pb-4 pt-1 bg-[#080810]">
                      {section.fields.map(field => {
                        const raw = getNestedValue(content, field.path);
                        const value = typeof raw === "string" ? raw : typeof raw === "number" ? String(raw) : typeof raw === "boolean" ? String(raw) : "";
                        return (
                          <FieldEditor
                            key={field.path}
                            field={field}
                            value={value}
                            onChange={handleFieldChange}
                          />
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* RIGHT PANEL — Live Preview */}
        <div className="flex-1 bg-[#05050d] flex flex-col overflow-hidden">
          <div className="flex-shrink-0 border-b border-[#1c1c2e] px-4 h-10 flex items-center justify-between">
            <div className="flex items-center gap-2 text-xs text-[#58567a]">
              <Eye className="w-3.5 h-3.5" />
              <span>Vista previa en vivo</span>
              <span className="text-[#35334f]">·</span>
              <span className="font-mono text-[#35334f]">{device} · {DEVICE_WIDTHS[device]}</span>
            </div>
            <button onClick={() => setIframeKey(k => k + 1)} className="flex items-center gap-1 text-xs text-[#58567a] hover:text-white transition-colors">
              <RefreshCw className="w-3 h-3" />Recargar
            </button>
          </div>
          <div className="flex-1 overflow-auto flex items-start justify-center p-4">
            <div style={{ width: DEVICE_WIDTHS[device], maxWidth: "100%", height: "100%", minHeight: 600 }} className="relative transition-all duration-300">
              <iframe
                key={iframeKey}
                ref={iframeRef}
                src={previewUrl}
                className="w-full rounded-xl border border-[#1c1c2e] shadow-2xl"
                style={{ height: "100%", minHeight: 600, background: "#080810" }}
                title="Landing page preview"
              />
            </div>
          </div>
        </div>
      </div>

      {/* VERSION HISTORY PANEL */}
      {showVersions && (
        <div className="fixed right-0 top-14 bottom-0 w-72 bg-[#0a0a14] border-l border-[#1c1c2e] z-40 flex flex-col shadow-2xl">
          <div className="px-4 py-3 border-b border-[#1c1c2e] flex items-center justify-between">
            <span className="text-sm font-semibold text-white">Historial de versiones</span>
            <button onClick={() => setShowVersions(false)} className="text-[#58567a] hover:text-white"><X className="w-4 h-4" /></button>
          </div>
          <div className="flex-1 overflow-y-auto p-3 space-y-2">
            {versions.length === 0 && <p className="text-xs text-[#58567a] text-center py-4">Sin versiones guardadas</p>}
            {versions.map(v => (
              <div key={v.id} className="bg-[#0e0e1a] border border-[#1c1c2e] rounded-xl p-3">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-mono text-[#c8a84b]">v{v.version}</span>
                  <span className="text-xs text-[#58567a]">{new Date(v.savedAt).toLocaleString("es-ES", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}</span>
                </div>
                {v.savedBy && <p className="text-xs text-[#58567a] mb-2">por {v.savedBy}</p>}
                <button onClick={() => restoreVersion(v.id)} className="w-full py-1.5 bg-[#1c1c2e] border border-[#35334f] rounded-lg text-xs text-[#9896ba] hover:text-[#c8a84b] hover:border-[#c8a84b]/30 transition-all">
                  Restaurar esta versión
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
