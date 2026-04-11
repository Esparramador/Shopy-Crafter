import { useState, useEffect, useCallback, useMemo } from "react";
import {
  Plus, Zap, RefreshCw, Trash2, Eye, Send, Star, Copy, Loader2, CheckCircle,
  AlertCircle, Clock, ChevronDown, Sparkles, Palette, Type, Mail, Monitor, Smartphone,
  ArrowLeft, X, EyeOff, WifiOff,
} from "lucide-react";
import GenerationProgress from "@/components/GenerationProgress";
import { useDraftPersistence, useBeforeUnload, useOnlineStatus } from "@/hooks/use-draft-persistence";

const API = import.meta.env.BASE_URL.replace(/\/$/, "");

interface TemplateType {
  label: string;
  category: string;
  description: string;
}

interface EmailTemplate {
  id: number;
  project_id: number;
  name: string;
  template_type: string;
  category: string;
  subject_a: string;
  subject_b: string;
  preview_text: string;
  html_content: string;
  text_content: string;
  tone: string;
  language: string;
  brand_name: string;
  brand_logo_url: string;
  brand_colors: Record<string, string>;
  brand_tagline: string;
  variables_used: string;
  from_email: string;
  from_name: string;
  reply_email: string;
  klaviyo_template_id: string;
  klaviyo_status: string;
  klaviyo_error: string;
  pushed_at: string;
  is_favorite: boolean;
  version: number;
  created_at: string;
  updated_at: string;
}

interface Project { id: number; name: string; shop_domain: string; store_niche: string; brand_tone: string; }

const TONES = [
  { value: "profesional", label: "Profesional", icon: "💼" },
  { value: "premium", label: "Premium / Exclusivo", icon: "👑" },
  { value: "amigable", label: "Amigable / Cercano", icon: "😊" },
  { value: "urgente", label: "Urgente / Escasez", icon: "⚡" },
  { value: "casual", label: "Casual / Moderno", icon: "🎯" },
  { value: "inspiracional", label: "Inspiracional", icon: "✨" },
  { value: "formal", label: "Formal / Corporativo", icon: "📋" },
  { value: "divertido", label: "Divertido / Creativo", icon: "🎨" },
];

const CATEGORIES = [
  { value: "agency", label: "Agencia", icon: "🏢", color: "#c8a84b" },
  { value: "ecommerce", label: "eCommerce", icon: "🛒", color: "#2dd49f" },
  { value: "transactional", label: "Transaccional", icon: "📬", color: "#60a5fa" },
  { value: "campaign", label: "Campaña", icon: "📣", color: "#f472b6" },
];

const STATUS_MAP: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
  draft: { label: "Borrador", color: "#6b7280", icon: <Clock size={12} /> },
  live: { label: "En Klaviyo", color: "#10b981", icon: <CheckCircle size={12} /> },
  error: { label: "Error", color: "#ef4444", icon: <AlertCircle size={12} /> },
};

export default function EmailTemplates() {
  const [templates, setTemplates] = useState<EmailTemplate[]>([]);
  const [templateTypes, setTemplateTypes] = useState<Record<string, TemplateType>>({});
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<number | null>(null);
  const [selectedTemplate, setSelectedTemplate] = useState<EmailTemplate | null>(null);
  const [filterCategory, setFilterCategory] = useState<string | null>(null);

  const [view, setView] = useState<"gallery" | "editor">("gallery");
  const [editorTab, setEditorTab] = useState<"brand" | "generate" | "preview" | "activate">("brand");
  const [generating, setGenerating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [pushing, setPushing] = useState(false);
  const [previewDevice, setPreviewDevice] = useState<"desktop" | "mobile">("desktop");
  const [showHtmlEditor, setShowHtmlEditor] = useState(false);
  const [_loading, setLoading] = useState(true);
  const [copywritingNotes, setCopywritingNotes] = useState("");

  const [form, setForm] = useState({
    name: "",
    template_type: "welcome-client",
    category: "agency",
    tone: "profesional",
    language: "es",
    subject_a: "",
    subject_b: "",
    preview_text: "",
    html_content: "",
    text_content: "",
    variables_used: "",
    brand_name: "",
    brand_logo_url: "",
    brand_tagline: "",
    brand_colors: { primary: "#c8a84b", accent: "#2dd49f", dark: "#0a0a0f", light: "#f0eefc" } as Record<string, string>,
    from_email: "craftershopy@gmail.com",
    from_name: "Shopy Crafter",
    reply_email: "craftershopy@gmail.com",
    customInstructions: "",
  });

  const hasEditorChanges = view === "editor" && (form.html_content.length > 0 || form.subject_a.length > 0);
  useBeforeUnload(hasEditorChanges);

  const draftData = useMemo(() => view === "editor" ? form : null, [view, form]);
  const { clear: clearEmailDraft } = useDraftPersistence(
    "email-template-draft",
    draftData,
    (restored) => {
      if (restored && typeof restored === "object" && (restored as typeof form).html_content) {
        setForm(restored as typeof form);
        setView("editor");
        setEditorTab((restored as typeof form).html_content ? "preview" : "brand");
      }
    },
    { enabled: view === "editor" }
  );

  const { isOnline: _isOnline } = useOnlineStatus(useCallback(() => {
    if (selectedProjectId) fetchTemplates();
  }, [selectedProjectId]));

  useEffect(() => {
    fetchProjects();
    fetchTypes();
  }, []);

  useEffect(() => { if (selectedProjectId) fetchTemplates(); }, [selectedProjectId, filterCategory]);

  function applyProjectBrand(project: Project) {
    setForm(p => ({
      ...p,
      brand_name: project.name,
      from_name: project.name,
    }));
  }

  async function fetchProjects() {
    try {
      const res = await fetch(`${API}/api/projects`, { credentials: "include" });
      const data = await res.json();
      const list: Project[] = data.projects || data || [];
      setProjects(list);
      if (list.length) {
        setSelectedProjectId(list[0].id);
        applyProjectBrand(list[0]);
      }
    } catch {}
    setLoading(false);
  }

  async function fetchTypes() {
    try {
      const res = await fetch(`${API}/api/email-templates/types`, { credentials: "include" });
      if (res.ok) setTemplateTypes(await res.json());
    } catch {}
  }

  async function fetchTemplates() {
    try {
      let url = `${API}/api/email-templates?projectId=${selectedProjectId}`;
      if (filterCategory) url += `&category=${filterCategory}`;
      const res = await fetch(url, { credentials: "include" });
      if (res.ok) setTemplates(await res.json());
    } catch {}
  }

  function openNewTemplate(typeKey?: string) {
    const project = projects.find(p => p.id === selectedProjectId);
    if (!project) return;
    setSelectedTemplate(null);
    const tmplType = typeKey || "welcome-client";
    const meta = templateTypes[tmplType];
    setForm({
      name: "",
      template_type: tmplType,
      category: meta?.category || "agency",
      tone: "profesional",
      language: "es",
      subject_a: "", subject_b: "", preview_text: "",
      html_content: "", text_content: "", variables_used: "",
      brand_name: project.name,
      brand_logo_url: "",
      brand_tagline: "",
      brand_colors: { primary: "#c8a84b", accent: "#2dd49f", dark: "#0a0a0f", light: "#f0eefc" },
      from_email: "craftershopy@gmail.com", from_name: project.name || "Shopy Crafter", reply_email: "craftershopy@gmail.com",
      customInstructions: "",
    });
    setCopywritingNotes("");
    setEditorTab("brand");
    setView("editor");
  }

  function openTemplate(tmpl: EmailTemplate) {
    setSelectedTemplate(tmpl);
    setForm({
      name: tmpl.name,
      template_type: tmpl.template_type,
      category: tmpl.category,
      tone: tmpl.tone || "profesional",
      language: tmpl.language || "es",
      subject_a: tmpl.subject_a || "", subject_b: tmpl.subject_b || "",
      preview_text: tmpl.preview_text || "",
      html_content: tmpl.html_content || "", text_content: tmpl.text_content || "",
      variables_used: tmpl.variables_used || "",
      brand_name: tmpl.brand_name || "",
      brand_logo_url: tmpl.brand_logo_url || "",
      brand_tagline: tmpl.brand_tagline || "",
      brand_colors: (tmpl.brand_colors && typeof tmpl.brand_colors === "object") ? tmpl.brand_colors : { primary: "#c8a84b", accent: "#2dd49f", dark: "#0a0a0f", light: "#f0eefc" },
      from_email: tmpl.from_email || "craftershopy@gmail.com", from_name: tmpl.from_name || "Shopy Crafter",
      reply_email: tmpl.reply_email || "craftershopy@gmail.com",
      customInstructions: "",
    });
    setCopywritingNotes("");
    setEditorTab(tmpl.html_content ? "preview" : "brand");
    setView("editor");
  }

  async function saveTemplate(): Promise<EmailTemplate | null> {
    setSaving(true);
    try {
      const body = {
        project_id: selectedProjectId,
        name: form.name || `${templateTypes[form.template_type]?.label || form.template_type}`,
        template_type: form.template_type, category: form.category,
        subject_a: form.subject_a, subject_b: form.subject_b, preview_text: form.preview_text,
        tone: form.tone, language: form.language,
        html_content: form.html_content, text_content: form.text_content,
        variables_used: form.variables_used,
        brand_name: form.brand_name, brand_logo_url: form.brand_logo_url,
        brand_tagline: form.brand_tagline, brand_colors: form.brand_colors,
        from_email: form.from_email, from_name: form.from_name, reply_email: form.reply_email,
      };
      let saved: EmailTemplate;
      if (selectedTemplate) {
        const res = await fetch(`${API}/api/email-templates/${selectedTemplate.id}`, {
          method: "PUT", credentials: "include",
          headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
        });
        saved = await res.json();
      } else {
        const res = await fetch(`${API}/api/email-templates`, {
          method: "POST", credentials: "include",
          headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
        });
        saved = await res.json();
        setSelectedTemplate(saved);
      }
      await fetchTemplates();
      clearEmailDraft();
      return saved;
    } catch { return null; }
    finally { setSaving(false); }
  }

  async function generateTemplate() {
    setGenerating(true);
    setCopywritingNotes("");
    try {
      const res = await fetch(`${API}/api/email-templates/generate`, {
        method: "POST", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          templateType: form.template_type,
          projectId: selectedProjectId,
          tone: form.tone,
          language: form.language,
          brandName: form.brand_name,
          brandLogoUrl: form.brand_logo_url,
          brandTagline: form.brand_tagline,
          brandColors: form.brand_colors,
          customInstructions: form.customInstructions,
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
      setCopywritingNotes(data.copywriting_notes || "");
      setEditorTab("preview");
    } catch (e: any) {
      alert("Error generando: " + e.message);
    }
    setGenerating(false);
  }

  async function deleteTemplate(id: number) {
    if (!confirm("¿Eliminar esta plantilla?")) return;
    try {
      await fetch(`${API}/api/email-templates/${id}`, { method: "DELETE", credentials: "include" });
      await fetchTemplates();
      if (selectedTemplate?.id === id) { setSelectedTemplate(null); setView("gallery"); }
    } catch {}
  }

  async function duplicateTemplate(id: number) {
    try {
      const res = await fetch(`${API}/api/email-templates/${id}/duplicate`, {
        method: "POST", credentials: "include",
      });
      if (res.ok) { await fetchTemplates(); }
    } catch {}
  }

  async function toggleFavorite(id: number, current: boolean) {
    try {
      await fetch(`${API}/api/email-templates/${id}`, {
        method: "PUT", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ is_favorite: !current }),
      });
      await fetchTemplates();
    } catch {}
  }

  async function pushToKlaviyo() {
    let tmpl = selectedTemplate;
    if (!tmpl) tmpl = await saveTemplate();
    if (!tmpl) return;
    if (!form.html_content) { alert("Genera el contenido primero"); return; }

    setPushing(true);
    try {
      await saveTemplate();
      const res = await fetch(`${API}/api/email-templates/${tmpl.id}/push-klaviyo`, {
        method: "POST", credentials: "include",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      await fetchTemplates();
      alert("Plantilla enviada a Klaviyo correctamente");
    } catch (e: any) {
      alert("Error: " + e.message);
    }
    setPushing(false);
  }

  const filteredTemplates = templates;
  const groupedTypes = Object.entries(templateTypes).reduce((acc, [key, val]) => {
    if (!acc[val.category]) acc[val.category] = [];
    acc[val.category].push({ key, ...val });
    return acc;
  }, {} as Record<string, Array<{ key: string } & TemplateType>>);

  const inputStyle = {
    width: "100%", background: "var(--ink2)", border: "1px solid var(--bdr)",
    borderRadius: 10, padding: "10px 14px", color: "var(--t1)", fontSize: 13,
  } as const;

  const labelStyle = {
    fontSize: 11, color: "var(--t3)", fontWeight: 700 as const, display: "block" as const,
    marginBottom: 6, textTransform: "uppercase" as const, letterSpacing: "0.5px",
  };

  if (view === "gallery") {
    return (
      <div style={{ padding: "24px 28px", maxWidth: 1200, margin: "0 auto" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 24 }}>
          <div>
            <h1 style={{ margin: 0, fontSize: 22, fontWeight: 800, color: "var(--t1)" }}>
              <Mail size={22} style={{ verticalAlign: "middle", marginRight: 10, color: "#c8a84b" }} />
              Email Template Studio
            </h1>
            <p style={{ margin: "6px 0 0", fontSize: 13, color: "var(--t2)" }}>
              Diseña emails de nivel agencia con Shopy Crafter — copy, diseño y marca integrados
            </p>
          </div>
          {projects.length > 1 && (
            <select value={selectedProjectId || ""} onChange={e => {
              const pid = Number(e.target.value);
              setSelectedProjectId(pid);
              const proj = projects.find(p => p.id === pid);
              if (proj) applyProjectBrand(proj);
            }}
              style={{ ...inputStyle, width: "auto", minWidth: 180 }}>
              {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          )}
        </div>

        <div style={{ display: "flex", gap: 8, marginBottom: 20, flexWrap: "wrap" }}>
          <button onClick={() => setFilterCategory(null)}
            style={{ padding: "7px 16px", borderRadius: 20, border: `1px solid ${!filterCategory ? "#c8a84b" : "var(--bdr)"}`, background: !filterCategory ? "rgba(200,168,75,0.12)" : "transparent", color: !filterCategory ? "#c8a84b" : "var(--t2)", fontSize: 12, fontWeight: 600, cursor: "pointer" }}>
            Todas
          </button>
          {CATEGORIES.map(cat => (
            <button key={cat.value} onClick={() => setFilterCategory(cat.value)}
              style={{ padding: "7px 16px", borderRadius: 20, border: `1px solid ${filterCategory === cat.value ? cat.color : "var(--bdr)"}`, background: filterCategory === cat.value ? `${cat.color}18` : "transparent", color: filterCategory === cat.value ? cat.color : "var(--t2)", fontSize: 12, fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", gap: 5 }}>
              {cat.icon} {cat.label}
            </button>
          ))}
        </div>

        {filteredTemplates.length > 0 && (
          <div style={{ marginBottom: 28 }}>
            <h2 style={{ fontSize: 14, fontWeight: 700, color: "var(--t1)", marginBottom: 14 }}>
              Tus plantillas ({filteredTemplates.length})
            </h2>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 14 }}>
              {filteredTemplates.map(t => {
                const meta = templateTypes[t.template_type];
                const cat = CATEGORIES.find(c => c.value === t.category);
                const status = STATUS_MAP[t.klaviyo_status || "draft"];
                return (
                  <div key={t.id} onClick={() => openTemplate(t)}
                    style={{ background: "var(--ink2)", border: "1px solid var(--bdr)", borderRadius: 14, padding: 18, cursor: "pointer", transition: "all 0.2s", position: "relative" }}
                    onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.borderColor = "rgba(200,168,75,0.35)"; }}
                    onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.borderColor = "var(--bdr)"; }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 10 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <span style={{ fontSize: 10, padding: "3px 8px", borderRadius: 12, background: `${cat?.color || "#888"}18`, color: cat?.color || "#888", fontWeight: 700 }}>
                          {cat?.icon} {cat?.label}
                        </span>
                        <span style={{ fontSize: 10, display: "flex", alignItems: "center", gap: 3, color: status.color }}>
                          {status.icon} {status.label}
                        </span>
                      </div>
                      <div style={{ display: "flex", gap: 4 }}>
                        <button onClick={e => { e.stopPropagation(); toggleFavorite(t.id, t.is_favorite); }}
                          style={{ background: "none", border: "none", cursor: "pointer", padding: 2, color: t.is_favorite ? "#c8a84b" : "var(--t3)" }}>
                          <Star size={13} fill={t.is_favorite ? "#c8a84b" : "none"} />
                        </button>
                        <button onClick={e => { e.stopPropagation(); duplicateTemplate(t.id); }}
                          style={{ background: "none", border: "none", cursor: "pointer", padding: 2, color: "var(--t3)" }}>
                          <Copy size={12} />
                        </button>
                        <button onClick={e => { e.stopPropagation(); deleteTemplate(t.id); }}
                          style={{ background: "none", border: "none", cursor: "pointer", padding: 2, color: "var(--t3)" }}
                          onMouseEnter={e => (e.currentTarget.style.color = "#ef4444")}
                          onMouseLeave={e => (e.currentTarget.style.color = "var(--t3)")}>
                          <Trash2 size={12} />
                        </button>
                      </div>
                    </div>
                    <h3 style={{ margin: "0 0 4px", fontSize: 14, fontWeight: 700, color: "var(--t1)" }}>{t.name || meta?.label || t.template_type}</h3>
                    <p style={{ margin: 0, fontSize: 11, color: "var(--t3)", lineHeight: 1.4 }}>{meta?.description || t.template_type}</p>
                    {t.subject_a && (
                      <div style={{ marginTop: 10, padding: "7px 10px", background: "rgba(255,255,255,0.03)", borderRadius: 7, fontSize: 11, color: "var(--t2)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                        💬 {t.subject_a}
                      </div>
                    )}
                    {t.html_content && (
                      <div style={{ marginTop: 8, fontSize: 10, color: "#10b981", display: "flex", alignItems: "center", gap: 4 }}>
                        <CheckCircle size={10} /> HTML generado · v{t.version}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        <div>
          <h2 style={{ fontSize: 14, fontWeight: 700, color: "var(--t1)", marginBottom: 6 }}>Crear nueva plantilla</h2>
          <p style={{ fontSize: 12, color: "var(--t3)", marginBottom: 16 }}>Selecciona un tipo y Shopy Crafter generará copy y diseño profesional con tu marca</p>
          {Object.entries(groupedTypes).map(([catKey, types]) => {
            if (filterCategory && catKey !== filterCategory) return null;
            const cat = CATEGORIES.find(c => c.value === catKey);
            return (
              <div key={catKey} style={{ marginBottom: 20 }}>
                <h3 style={{ fontSize: 12, fontWeight: 700, color: cat?.color || "var(--t2)", marginBottom: 10, display: "flex", alignItems: "center", gap: 6 }}>
                  {cat?.icon} {cat?.label}
                </h3>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(230px, 1fr))", gap: 10 }}>
                  {types.map(t => (
                    <button key={t.key} onClick={() => openNewTemplate(t.key)}
                      style={{ background: "var(--ink2)", border: "1px solid var(--bdr)", borderRadius: 12, padding: "14px 16px", cursor: "pointer", textAlign: "left", transition: "all 0.2s", display: "flex", alignItems: "flex-start", gap: 12 }}
                      onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.borderColor = cat?.color || "#c8a84b"; }}
                      onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.borderColor = "var(--bdr)"; }}>
                      <div style={{ width: 32, height: 32, borderRadius: 8, background: `${cat?.color || "#888"}18`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                        <Plus size={14} style={{ color: cat?.color || "#888" }} />
                      </div>
                      <div>
                        <div style={{ fontSize: 13, fontWeight: 600, color: "var(--t1)", marginBottom: 2 }}>{t.label}</div>
                        <div style={{ fontSize: 11, color: "var(--t3)", lineHeight: 1.4 }}>{t.description}</div>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  const typeMeta = templateTypes[form.template_type];
  const editorTabs = [
    { key: "brand", label: "Marca", icon: <Palette size={13} />, done: !!form.brand_name },
    { key: "generate", label: "Generar", icon: <Sparkles size={13} />, done: false },
    { key: "preview", label: "Preview", icon: <Eye size={13} />, done: !!form.html_content },
    { key: "activate", label: "Activar", icon: <Send size={13} />, done: false },
  ] as const;

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "calc(100vh - 56px)", overflow: "hidden" }}>
      <div style={{ borderBottom: "1px solid var(--bdr)", padding: "0 24px", display: "flex", alignItems: "center", background: "var(--ink2)" }}>
        <button onClick={() => { setView("gallery"); }}
          style={{ background: "none", border: "none", cursor: "pointer", color: "var(--t2)", padding: "12px 12px 12px 0", display: "flex", alignItems: "center", gap: 6, fontSize: 12 }}>
          <ArrowLeft size={14} /> Plantillas
        </button>
        <div style={{ width: 1, height: 20, background: "var(--bdr)", margin: "0 8px" }} />
        {(() => {
          const project = projects.find(p => p.id === selectedProjectId);
          return project ? (
            <div style={{ display: "flex", alignItems: "center", gap: 6, padding: "4px 10px", background: "rgba(200,168,75,0.08)", border: "1px solid rgba(200,168,75,0.2)", borderRadius: 8, marginRight: 8 }}>
              <div style={{ width: 8, height: 8, borderRadius: "50%", background: "#2dd49f" }} />
              <span style={{ fontSize: 11, fontWeight: 700, color: "#c8a84b" }}>{project.name}</span>
            </div>
          ) : null;
        })()}

        <div style={{ display: "flex", alignItems: "center", gap: 4, flex: 1 }}>
          {editorTabs.map(t => (
            <button key={t.key} onClick={() => setEditorTab(t.key)}
              style={{
                background: "none", border: "none", padding: "13px 16px", cursor: "pointer",
                color: editorTab === t.key ? "#c8a84b" : "var(--t2)",
                fontWeight: editorTab === t.key ? 700 : 400, fontSize: 12,
                borderBottom: editorTab === t.key ? "2px solid #c8a84b" : "2px solid transparent",
                display: "flex", alignItems: "center", gap: 6, transition: "all 0.2s",
              }}>
              {t.icon} {t.label}
              {t.done && <CheckCircle size={10} style={{ color: "#10b981" }} />}
            </button>
          ))}
        </div>

        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={() => saveTemplate()} disabled={saving}
            style={{ background: "rgba(200,168,75,0.12)", border: "1px solid rgba(200,168,75,0.25)", borderRadius: 8, padding: "6px 14px", cursor: "pointer", color: "#c8a84b", fontSize: 11, fontWeight: 700 }}>
            {saving ? "Guardando..." : "Guardar"}
          </button>
        </div>
      </div>

      <div style={{ flex: 1, overflowY: "auto", padding: "24px 28px" }}>

        {editorTab === "brand" && (
          <div style={{ maxWidth: 700, display: "flex", flexDirection: "column", gap: 20 }}>
            <div style={{ background: "linear-gradient(135deg, rgba(200,168,75,0.08), rgba(45,212,159,0.04))", border: "1px solid rgba(200,168,75,0.2)", borderRadius: 16, padding: 24 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 20 }}>
                <div style={{ width: 44, height: 44, borderRadius: 12, background: "linear-gradient(135deg, #c8a84b, #e8c87b)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <Palette size={22} color="#000" />
                </div>
                <div style={{ flex: 1 }}>
                  <h2 style={{ margin: 0, fontSize: 18, fontWeight: 800, color: "var(--t1)" }}>Identidad de Marca</h2>
                  <p style={{ margin: 0, fontSize: 12, color: "var(--t2)" }}>Shopy Crafter usará esta información para crear emails 100% on-brand</p>
                </div>
                {(() => {
                  const project = projects.find(p => p.id === selectedProjectId);
                  return project ? (
                    <div style={{ padding: "8px 14px", background: "rgba(45,212,159,0.08)", border: "1px solid rgba(45,212,159,0.2)", borderRadius: 10, textAlign: "right" }}>
                      <div style={{ fontSize: 10, color: "var(--t3)", textTransform: "uppercase", fontWeight: 700 }}>Proyecto activo</div>
                      <div style={{ fontSize: 13, fontWeight: 700, color: "#2dd49f" }}>{project.name}</div>
                      {project.store_niche && <div style={{ fontSize: 10, color: "var(--t3)" }}>{project.store_niche}</div>}
                    </div>
                  ) : null;
                })()}
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(200px, 100%), 1fr))", gap: 16 }}>
                <div>
                  <label style={labelStyle}>Nombre de la marca</label>
                  <input value={form.brand_name} onChange={e => setForm(p => ({ ...p, brand_name: e.target.value }))}
                    placeholder="Comic Crafter" style={inputStyle} />
                </div>
                <div>
                  <label style={labelStyle}>Tagline / Slogan</label>
                  <input value={form.brand_tagline} onChange={e => setForm(p => ({ ...p, brand_tagline: e.target.value }))}
                    placeholder="Tu frase de marca..." style={inputStyle} />
                </div>
              </div>

              <div style={{ marginTop: 16 }}>
                <label style={labelStyle}>URL del Logo (se incluye en el header del email)</label>
                <input value={form.brand_logo_url} onChange={e => setForm(p => ({ ...p, brand_logo_url: e.target.value }))}
                  placeholder="https://tutienda.com/logo.png" style={inputStyle} />
                {form.brand_logo_url && (
                  <div style={{ marginTop: 8, padding: 12, background: "#0a0a0f", borderRadius: 8, display: "flex", justifyContent: "center" }}>
                    <img src={form.brand_logo_url} alt="Logo preview" style={{ maxHeight: 48, maxWidth: 200 }}
                      onError={e => { (e.target as HTMLImageElement).style.display = "none"; }} />
                  </div>
                )}
              </div>

              <div style={{ marginTop: 16 }}>
                <label style={labelStyle}>Colores de marca</label>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(140px, 100%), 1fr))", gap: 10 }}>
                  {[
                    { key: "primary", label: "Principal" },
                    { key: "accent", label: "Acento" },
                    { key: "dark", label: "Oscuro" },
                    { key: "light", label: "Claro" },
                  ].map(c => (
                    <div key={c.key}>
                      <div style={{ fontSize: 10, color: "var(--t3)", marginBottom: 4 }}>{c.label}</div>
                      <div style={{ display: "flex", alignItems: "center", gap: 6, background: "var(--ink2)", border: "1px solid var(--bdr)", borderRadius: 8, padding: "4px 8px" }}>
                        <input type="color" value={form.brand_colors[c.key] || "#c8a84b"}
                          onChange={e => setForm(p => ({ ...p, brand_colors: { ...p.brand_colors, [c.key]: e.target.value } }))}
                          style={{ width: 24, height: 24, border: "none", background: "none", cursor: "pointer", padding: 0 }} />
                        <input value={form.brand_colors[c.key] || ""}
                          onChange={e => setForm(p => ({ ...p, brand_colors: { ...p.brand_colors, [c.key]: e.target.value } }))}
                          style={{ background: "transparent", border: "none", color: "var(--t2)", fontSize: 11, width: "100%", fontFamily: "monospace" }} />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div style={{ background: "var(--ink2)", border: "1px solid var(--bdr)", borderRadius: 16, padding: 24 }}>
              <h3 style={{ margin: "0 0 16px", fontSize: 15, fontWeight: 700, color: "var(--t1)", display: "flex", alignItems: "center", gap: 8 }}>
                <Type size={16} style={{ color: "#c8a84b" }} /> Configuración del email
              </h3>

              <div style={{ marginBottom: 16 }}>
                <label style={labelStyle}>Nombre de la plantilla</label>
                <input value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
                  placeholder={`${typeMeta?.label || form.template_type} — ${form.brand_name || "Mi Marca"}`}
                  style={inputStyle} />
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(200px, 100%), 1fr))", gap: 16, marginBottom: 16 }}>
                <div>
                  <label style={labelStyle}>Tipo de plantilla</label>
                  <select value={form.template_type}
                    onChange={e => {
                      const v = e.target.value;
                      const meta = templateTypes[v];
                      setForm(p => ({ ...p, template_type: v, category: meta?.category || p.category }));
                    }}
                    style={inputStyle}>
                    {Object.entries(templateTypes).map(([k, v]) => (
                      <option key={k} value={k}>{v.label} ({CATEGORIES.find(c => c.value === v.category)?.label})</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label style={labelStyle}>Idioma</label>
                  <select value={form.language} onChange={e => setForm(p => ({ ...p, language: e.target.value }))} style={inputStyle}>
                    <option value="es">Español</option>
                    <option value="en">English</option>
                    <option value="fr">Français</option>
                    <option value="pt">Português</option>
                    <option value="de">Deutsch</option>
                  </select>
                </div>
              </div>

              <div style={{ marginBottom: 16 }}>
                <label style={labelStyle}>Tono del email</label>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(120px, 100%), 1fr))", gap: 6 }}>
                  {TONES.map(t => (
                    <button key={t.value} onClick={() => setForm(p => ({ ...p, tone: t.value }))}
                      style={{
                        background: form.tone === t.value ? "rgba(200,168,75,0.12)" : "var(--ink)",
                        border: `1px solid ${form.tone === t.value ? "rgba(200,168,75,0.35)" : "var(--bdr)"}`,
                        borderRadius: 8, padding: "8px 10px", cursor: "pointer",
                        color: form.tone === t.value ? "#c8a84b" : "var(--t2)",
                        fontSize: 11, fontWeight: form.tone === t.value ? 700 : 400, transition: "all 0.15s",
                      }}>
                      {t.icon} {t.label}
                    </button>
                  ))}
                </div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(150px, 100%), 1fr))", gap: 12 }}>
                <div>
                  <label style={labelStyle}>Remitente</label>
                  <input value={form.from_name} onChange={e => setForm(p => ({ ...p, from_name: e.target.value }))}
                    placeholder="Nombre" style={inputStyle} />
                </div>
                <div>
                  <label style={labelStyle}>Email remitente</label>
                  <input value={form.from_email} onChange={e => setForm(p => ({ ...p, from_email: e.target.value }))}
                    placeholder="craftershopy@gmail.com" style={inputStyle} />
                </div>
                <div>
                  <label style={labelStyle}>Reply-to</label>
                  <input value={form.reply_email} onChange={e => setForm(p => ({ ...p, reply_email: e.target.value }))}
                    placeholder="craftershopy@gmail.com" style={inputStyle} />
                </div>
              </div>
            </div>

            <button onClick={() => { saveTemplate(); setEditorTab("generate"); }}
              style={{ background: "linear-gradient(135deg, #c8a84b, #e8c87b)", border: "none", borderRadius: 10, padding: "12px 24px", cursor: "pointer", fontWeight: 700, color: "#000", fontSize: 14, alignSelf: "flex-start", display: "flex", alignItems: "center", gap: 8 }}>
              Siguiente: Generar con IA <Sparkles size={15} />
            </button>
          </div>
        )}

        {editorTab === "generate" && (
          <div style={{ maxWidth: 700, display: "flex", flexDirection: "column", gap: 20 }}>
            <GenerationProgress
              active={generating}
              operation="email"
              title="Shopy Crafter diseñando tu email..."
              subtitle="Combinando BrandDNA + IA Brain + copy profesional para crear una plantilla de nivel agencia"
            />

            <div style={{ background: "linear-gradient(135deg, rgba(139,92,246,0.08), rgba(200,168,75,0.06))", border: "1px solid rgba(139,92,246,0.2)", borderRadius: 16, padding: 24 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 20 }}>
                <div style={{ width: 44, height: 44, borderRadius: 12, background: "linear-gradient(135deg, #8b5cf6, #c8a84b)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <Sparkles size={22} color="#fff" />
                </div>
                <div>
                  <h2 style={{ margin: 0, fontSize: 18, fontWeight: 800, color: "var(--t1)" }}>Shopy Crafter Copywriter</h2>
                  <p style={{ margin: 0, fontSize: 12, color: "var(--t2)" }}>
                    IA de nivel agencia: copy persuasivo + diseño visual + tu identidad de marca
                  </p>
                </div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(140px, 100%), 1fr))", gap: 10, marginBottom: 16 }}>
                {[
                  { l: "Plantilla", v: typeMeta?.label || form.template_type },
                  { l: "Tono", v: TONES.find(t => t.value === form.tone)?.label || form.tone },
                  { l: "Marca", v: form.brand_name || "Sin definir" },
                ].map(({ l, v }) => (
                  <div key={l} style={{ padding: "10px 14px", background: "rgba(255,255,255,0.04)", borderRadius: 10 }}>
                    <div style={{ fontSize: 10, color: "var(--t3)", marginBottom: 3, textTransform: "uppercase" }}>{l}</div>
                    <div style={{ fontSize: 12, color: "var(--t1)", fontWeight: 600 }}>{v}</div>
                  </div>
                ))}
              </div>

              <div style={{ marginBottom: 16 }}>
                <label style={labelStyle}>Instrucciones especiales (opcional)</label>
                <textarea value={form.customInstructions}
                  onChange={e => setForm(p => ({ ...p, customInstructions: e.target.value }))}
                  placeholder={"Ej: Incluir un cupón del 15% para el primer pedido. Mencionar envío gratis. Destacar que somos artesanales. Añadir sección de productos destacados..."}
                  style={{ ...inputStyle, height: 80, resize: "vertical" }} />
              </div>

              <div style={{ marginBottom: 16, padding: "12px 14px", background: "rgba(200,168,75,0.06)", borderRadius: 10, border: "1px solid rgba(200,168,75,0.12)" }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: "#c8a84b", marginBottom: 6 }}>Shopy Crafter incluirá automáticamente:</div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                  {[
                    form.brand_logo_url && "Logo de marca",
                    form.brand_name && "Nombre de marca",
                    "Colores corporativos",
                    "BrandDNA visual",
                    "Copy persuasivo profesional",
                    "HTML responsive para email",
                    "Variables Klaviyo",
                    "Subject lines A/B",
                    "Preheader optimizado",
                  ].filter(Boolean).map(item => (
                    <span key={item} style={{ padding: "3px 10px", background: "rgba(200,168,75,0.1)", borderRadius: 12, fontSize: 10, color: "#c8a84b", fontWeight: 600 }}>
                      {item}
                    </span>
                  ))}
                </div>
              </div>

              <button onClick={generateTemplate} disabled={generating}
                style={{
                  width: "100%", padding: "14px", borderRadius: 12, border: "none",
                  background: generating ? "rgba(200,168,75,0.3)" : "linear-gradient(135deg, #c8a84b, #e8c87b)",
                  color: "#000", fontWeight: 800, fontSize: 15, cursor: generating ? "wait" : "pointer",
                  display: "flex", alignItems: "center", justifyContent: "center", gap: 10,
                  transition: "all 0.2s",
                }}>
                {generating
                  ? <><Loader2 size={16} style={{ animation: "spin 0.6s linear infinite" }} /> Shopy Crafter generando...</>
                  : <><Zap size={16} /> {form.html_content ? "Regenerar plantilla completa" : "Generar plantilla profesional"}</>}
              </button>
            </div>

            {form.subject_a && (
              <div style={{ background: "var(--ink2)", border: "1px solid var(--bdr)", borderRadius: 14, padding: 20 }}>
                <h3 style={{ margin: "0 0 12px", fontSize: 14, fontWeight: 700, color: "var(--t1)" }}>Subject Lines (A/B Test)</h3>
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  <div style={{ display: "flex", gap: 10 }}>
                    <span style={{ fontSize: 10, fontWeight: 800, color: "#c8a84b", minWidth: 14, paddingTop: 2 }}>A</span>
                    <input value={form.subject_a} onChange={e => setForm(p => ({ ...p, subject_a: e.target.value }))}
                      style={{ ...inputStyle, fontSize: 14, fontWeight: 600 }} />
                  </div>
                  <div style={{ display: "flex", gap: 10 }}>
                    <span style={{ fontSize: 10, fontWeight: 800, color: "#c8a84b", minWidth: 14, paddingTop: 2 }}>B</span>
                    <input value={form.subject_b} onChange={e => setForm(p => ({ ...p, subject_b: e.target.value }))}
                      style={{ ...inputStyle, fontSize: 14, fontWeight: 600 }} />
                  </div>
                </div>
                <div style={{ marginTop: 10 }}>
                  <label style={labelStyle}>Preview text</label>
                  <input value={form.preview_text} onChange={e => setForm(p => ({ ...p, preview_text: e.target.value }))}
                    style={inputStyle} />
                </div>
              </div>
            )}

            {copywritingNotes && (
              <div style={{ background: "rgba(139,92,246,0.06)", border: "1px solid rgba(139,92,246,0.15)", borderRadius: 12, padding: 16 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: "#a78bfa", marginBottom: 6 }}>Notas del copywriter Shopy Crafter</div>
                <p style={{ margin: 0, fontSize: 12, color: "var(--t2)", lineHeight: 1.6 }}>{copywritingNotes}</p>
              </div>
            )}

            {form.html_content && (
              <button onClick={() => setEditorTab("preview")}
                style={{ background: "linear-gradient(135deg, #c8a84b, #e8c87b)", border: "none", borderRadius: 10, padding: "12px 24px", cursor: "pointer", fontWeight: 700, color: "#000", fontSize: 14, alignSelf: "flex-start", display: "flex", alignItems: "center", gap: 8 }}>
                Ver preview del email <Eye size={15} />
              </button>
            )}
          </div>
        )}

        {editorTab === "preview" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 16, maxWidth: 900 }}>
            {!form.html_content ? (
              <div style={{ padding: "60px 24px", textAlign: "center", border: "2px dashed var(--bdr)", borderRadius: 16 }}>
                <div style={{ fontSize: 48, marginBottom: 12 }}>✉️</div>
                <p style={{ fontSize: 15, fontWeight: 600, color: "var(--t1)", margin: "0 0 6px" }}>Aún no hay contenido</p>
                <p style={{ fontSize: 12, color: "var(--t3)", margin: "0 0 16px" }}>Ve a la pestaña "Generar" para que Shopy Crafter cree tu email</p>
                <button onClick={() => setEditorTab("generate")}
                  style={{ background: "linear-gradient(135deg, #c8a84b, #e8c87b)", border: "none", borderRadius: 10, padding: "10px 20px", cursor: "pointer", fontWeight: 700, color: "#000", fontSize: 13 }}>
                  <Sparkles size={14} style={{ verticalAlign: "middle", marginRight: 6 }} /> Generar con Shopy Crafter
                </button>
              </div>
            ) : (
              <>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <span style={{ fontSize: 13, fontWeight: 700, color: "var(--t1)" }}>Vista previa</span>
                    <span style={{ fontSize: 10, color: "var(--t3)" }}>— variables se sustituyen al enviar</span>
                  </div>
                  <div style={{ display: "flex", gap: 6 }}>
                    <button onClick={() => setPreviewDevice("desktop")}
                      style={{ background: previewDevice === "desktop" ? "rgba(200,168,75,0.12)" : "var(--ink2)", border: `1px solid ${previewDevice === "desktop" ? "rgba(200,168,75,0.3)" : "var(--bdr)"}`, borderRadius: 7, padding: "5px 10px", cursor: "pointer", color: previewDevice === "desktop" ? "#c8a84b" : "var(--t3)", fontSize: 11, display: "flex", alignItems: "center", gap: 4 }}>
                      <Monitor size={12} /> Desktop
                    </button>
                    <button onClick={() => setPreviewDevice("mobile")}
                      style={{ background: previewDevice === "mobile" ? "rgba(200,168,75,0.12)" : "var(--ink2)", border: `1px solid ${previewDevice === "mobile" ? "rgba(200,168,75,0.3)" : "var(--bdr)"}`, borderRadius: 7, padding: "5px 10px", cursor: "pointer", color: previewDevice === "mobile" ? "#c8a84b" : "var(--t3)", fontSize: 11, display: "flex", alignItems: "center", gap: 4 }}>
                      <Smartphone size={12} /> Mobile
                    </button>
                    <button onClick={() => setShowHtmlEditor(!showHtmlEditor)}
                      style={{ background: "var(--ink2)", border: "1px solid var(--bdr)", borderRadius: 7, padding: "5px 10px", cursor: "pointer", color: "var(--t3)", fontSize: 11, display: "flex", alignItems: "center", gap: 4 }}>
                      {showHtmlEditor ? <EyeOff size={12} /> : <Eye size={12} />} HTML
                    </button>
                    <button onClick={() => generateTemplate()} disabled={generating}
                      style={{ background: "var(--ink2)", border: "1px solid var(--bdr)", borderRadius: 7, padding: "5px 10px", cursor: "pointer", color: "var(--t3)", fontSize: 11, display: "flex", alignItems: "center", gap: 4 }}>
                      <RefreshCw size={12} /> Regenerar
                    </button>
                  </div>
                </div>

                {form.subject_a && (
                  <div style={{ background: "var(--ink2)", border: "1px solid var(--bdr)", borderRadius: 10, padding: "12px 16px" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                      <div style={{ width: 28, height: 28, borderRadius: "50%", background: "linear-gradient(135deg, #c8a84b, #e8c87b)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 800, color: "#000" }}>
                        {(form.brand_name || "M")[0]}
                      </div>
                      <div>
                        <div style={{ fontSize: 13, fontWeight: 700, color: "var(--t1)" }}>{form.from_name || form.brand_name || "Tu Marca"}</div>
                        <div style={{ fontSize: 11, color: "var(--t3)" }}>{form.from_email || "craftershopy@gmail.com"}</div>
                      </div>
                    </div>
                    <div style={{ fontSize: 14, fontWeight: 600, color: "var(--t1)", marginLeft: 36 }}>{form.subject_a}</div>
                    {form.preview_text && (
                      <div style={{ fontSize: 12, color: "var(--t3)", marginLeft: 36, marginTop: 2 }}>{form.preview_text}</div>
                    )}
                  </div>
                )}

                <div style={{ border: "1px solid var(--bdr)", borderRadius: 12, overflow: "hidden", background: "#0a0a0f", display: "flex", justifyContent: "center" }}>
                  <iframe
                    srcDoc={form.html_content}
                    style={{
                      width: previewDevice === "mobile" ? 375 : "100%",
                      height: 600, border: "none",
                      transition: "width 0.3s ease",
                    }}
                    title="Email preview" />
                </div>

                {showHtmlEditor && (
                  <div>
                    <label style={labelStyle}>HTML del email (editable)</label>
                    <textarea value={form.html_content}
                      onChange={e => setForm(p => ({ ...p, html_content: e.target.value }))}
                      style={{
                        width: "100%", height: 300, background: "#0a0a0f", border: "1px solid var(--bdr)",
                        borderRadius: 10, padding: "12px 14px", color: "#8888aa",
                        fontSize: 11, fontFamily: "'Geist Mono', monospace", resize: "vertical",
                      }} />
                  </div>
                )}

                <div style={{ display: "flex", gap: 10 }}>
                  <button onClick={() => { saveTemplate(); setEditorTab("activate"); }}
                    style={{ background: "linear-gradient(135deg, #c8a84b, #e8c87b)", border: "none", borderRadius: 10, padding: "12px 24px", cursor: "pointer", fontWeight: 700, color: "#000", fontSize: 14, display: "flex", alignItems: "center", gap: 8 }}>
                    Guardar y activar <Send size={15} />
                  </button>
                  <button onClick={() => saveTemplate()}
                    style={{ background: "var(--ink2)", border: "1px solid var(--bdr)", borderRadius: 10, padding: "12px 24px", cursor: "pointer", fontWeight: 600, color: "var(--t2)", fontSize: 13 }}>
                    Solo guardar
                  </button>
                </div>
              </>
            )}
          </div>
        )}

        {editorTab === "activate" && (
          <div style={{ maxWidth: 540 }}>
            <div style={{ background: "var(--ink2)", border: "1px solid var(--bdr)", borderRadius: 16, padding: 28 }}>
              <h2 style={{ margin: "0 0 20px", fontSize: 18, fontWeight: 800, color: "var(--t1)", display: "flex", alignItems: "center", gap: 10 }}>
                <Send size={20} style={{ color: "#c8a84b" }} /> Enviar a Klaviyo
              </h2>

              <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 20, padding: 16, background: "rgba(255,255,255,0.03)", borderRadius: 12 }}>
                {[
                  ["Plantilla", `${typeMeta?.label || form.template_type}`],
                  ["Marca", form.brand_name || "—"],
                  ["Tono", TONES.find(t => t.value === form.tone)?.label || form.tone],
                  ["Subject A", form.subject_a || "—"],
                  ["HTML", form.html_content ? `${Math.round(form.html_content.length / 1000)}k chars` : "Pendiente"],
                ].map(([l, v]) => (
                  <div key={l} style={{ display: "flex", gap: 12, fontSize: 13 }}>
                    <span style={{ color: "var(--t3)", minWidth: 85 }}>{l}:</span>
                    <span style={{ color: "var(--t1)", fontWeight: 600 }}>{v}</span>
                  </div>
                ))}
              </div>

              {!form.html_content ? (
                <div style={{ padding: 16, background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.2)", borderRadius: 10, fontSize: 13, color: "#ef4444", marginBottom: 16 }}>
                  Genera el contenido del email primero en la pestaña "Generar"
                </div>
              ) : (
                <div style={{ padding: 14, background: "rgba(16,185,129,0.08)", border: "1px solid rgba(16,185,129,0.2)", borderRadius: 10, marginBottom: 16 }}>
                  <div style={{ fontSize: 11, color: "#10b981", fontWeight: 700, marginBottom: 8 }}>Se creará en Klaviyo:</div>
                  {["Template HTML completo", "Listo para usar en cualquier flow", "Variables Klaviyo configuradas"].map(item => (
                    <div key={item} style={{ display: "flex", alignItems: "center", gap: 7, fontSize: 12, color: "var(--t2)", marginBottom: 4 }}>
                      <CheckCircle size={11} style={{ color: "#10b981" }} /> {item}
                    </div>
                  ))}
                </div>
              )}

              <button onClick={pushToKlaviyo} disabled={pushing || !form.html_content}
                style={{
                  width: "100%", padding: "14px", borderRadius: 12, border: "none",
                  background: !form.html_content ? "rgba(255,255,255,0.05)" : "linear-gradient(135deg, #c8a84b, #e8c87b)",
                  color: !form.html_content ? "var(--t3)" : "#000",
                  fontWeight: 800, fontSize: 15, cursor: pushing || !form.html_content ? "not-allowed" : "pointer",
                  display: "flex", alignItems: "center", justifyContent: "center", gap: 10,
                  opacity: pushing ? 0.75 : 1, transition: "all 0.2s",
                }}>
                {pushing
                  ? <><Loader2 size={16} style={{ animation: "spin 0.6s linear infinite" }} /> Enviando a Klaviyo...</>
                  : <><Send size={16} /> Crear template en Klaviyo</>}
              </button>

              <p style={{ textAlign: "center", fontSize: 11, color: "var(--t3)", marginTop: 14, lineHeight: 1.5 }}>
                Shopy Crafter controla el contenido · Klaviyo solo entrega
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
