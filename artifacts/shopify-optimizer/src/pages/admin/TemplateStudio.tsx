import { useState, useEffect, useRef } from "react";
import { Palette, Save, Trash2, Share2, Sparkles, Plus, Eye, Loader2, ArrowLeft } from "lucide-react";

const API_BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

const GOOGLE_FONTS = [
  "Helvetica Neue", "Georgia", "Playfair Display", "Cormorant Garamond",
  "Montserrat", "Lora", "Raleway", "Merriweather", "Poppins", "Oswald",
  "Roboto Slab", "Source Serif 4", "DM Serif Display", "Crimson Text",
  "Libre Baskerville", "Work Sans", "Nunito", "Josefin Sans",
];

const COVER_STYLES = [
  { id: "centered", label: "Centrado" },
  { id: "left-aligned", label: "Alineado izquierda" },
  { id: "minimal", label: "Minimalista" },
];

const SECTION_STYLES = [
  { id: "card", label: "Cards" },
  { id: "accent-bar", label: "Barra lateral" },
  { id: "minimal", label: "Minimalista" },
];

interface Template {
  id?: number;
  name: string;
  companyName: string;
  tagline: string;
  logoBase64: string | null;
  primaryColor: string;
  secondaryColor: string;
  accentColor: string;
  textColor: string;
  bgColor: string;
  cardBg: string;
  borderColor: string;
  headingFont: string;
  bodyFont: string;
  headingWeight: string;
  coverStyle: string;
  sectionStyle: string;
  footerText: string;
  showPageNumbers: boolean;
  isPublic: boolean;
  shareToken?: string;
}

const DEFAULT_TEMPLATE: Template = {
  name: "", companyName: "", tagline: "", logoBase64: null,
  primaryColor: "#c8a84b", secondaryColor: "#08080e", accentColor: "#44cc88",
  textColor: "#f0f0f5", bgColor: "#08080e", cardBg: "#12121a", borderColor: "#1a1a22",
  headingFont: "Helvetica Neue", bodyFont: "Helvetica Neue", headingWeight: "700",
  coverStyle: "centered", sectionStyle: "card", footerText: "", showPageNumbers: true, isPublic: false,
};

export default function TemplateStudio() {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [current, setCurrent] = useState<Template>({ ...DEFAULT_TEMPLATE });
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiUrl, setAiUrl] = useState("");
  const [aiInstagram, setAiInstagram] = useState("");
  const [aiCompany, setAiCompany] = useState("");
  const [msg, setMsg] = useState("");
  const [tab, setTab] = useState<"colors" | "fonts" | "layout" | "brand">("brand");
  const logoRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetch(`${API_BASE}/api/report-templates`, { credentials: "include" })
      .then(r => r.json())
      .then(data => { if (Array.isArray(data)) setTemplates(data); })
      .catch(() => {});
  }, []);

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) { setMsg("Logo máximo 2MB"); return; }
    if (!file.type.startsWith("image/")) { setMsg("Solo imágenes"); return; }
    const reader = new FileReader();
    reader.onload = () => setCurrent(p => ({ ...p, logoBase64: reader.result as string }));
    reader.readAsDataURL(file);
  };

  const handleAiSuggest = async () => {
    if (!aiUrl && !aiInstagram && !aiCompany) return;
    setAiLoading(true);
    setMsg("");
    try {
      const res = await fetch(`${API_BASE}/api/report-templates/ai-suggest`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ url: aiUrl, instagram: aiInstagram, companyName: aiCompany }),
      });
      const data = await res.json();
      if (data.suggestion) {
        const s = data.suggestion as Record<string, string>;
        setCurrent(p => ({
          ...p,
          companyName: s.companyName || p.companyName || aiCompany,
          tagline: s.tagline || p.tagline,
          primaryColor: s.primaryColor || p.primaryColor,
          secondaryColor: s.secondaryColor || p.secondaryColor,
          accentColor: s.accentColor || p.accentColor,
          textColor: s.textColor || p.textColor,
          bgColor: s.bgColor || p.bgColor,
          cardBg: s.cardBg || p.cardBg,
          borderColor: s.borderColor || p.borderColor,
          headingFont: s.headingFont || p.headingFont,
          bodyFont: s.bodyFont || p.bodyFont,
          coverStyle: s.coverStyle || p.coverStyle,
          sectionStyle: s.sectionStyle || p.sectionStyle,
        }));
        setMsg(`Diseño sugerido${s.reasoning ? `: ${(s.reasoning as string).slice(0, 100)}` : ""}`);
      } else {
        setMsg(data.error || "No se pudo obtener una sugerencia");
      }
    } catch { setMsg("Error en sugerencia IA"); }
    setAiLoading(false);
  };

  const handleSave = async () => {
    if (!current.name) { setMsg("Nombre requerido"); return; }
    setSaving(true);
    setMsg("");
    try {
      const method = current.id ? "PUT" : "POST";
      const url = current.id ? `${API_BASE}/api/report-templates/${current.id}` : `${API_BASE}/api/report-templates`;
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(current),
      });
      const data = await res.json();
      if (data.success) {
        setMsg("Plantilla guardada");
        if (!current.id && data.template?.id) setCurrent(p => ({ ...p, id: data.template.id, shareToken: data.template.shareToken }));
        const list = await fetch(`${API_BASE}/api/report-templates`, { credentials: "include" }).then(r => r.json());
        if (Array.isArray(list)) setTemplates(list);
      } else {
        setMsg(data.error || "Error guardando");
      }
    } catch { setMsg("Error de conexión"); }
    setSaving(false);
  };

  const handleDelete = async (id: number) => {
    if (!confirm("¿Eliminar esta plantilla?")) return;
    await fetch(`${API_BASE}/api/report-templates/${id}`, { method: "DELETE", credentials: "include" });
    setTemplates(p => p.filter(t => t.id !== id));
    if (current.id === id) setCurrent({ ...DEFAULT_TEMPLATE });
  };

  const handleCopyShareLink = (token: string) => {
    const link = `${window.location.origin}${API_BASE}/api/report-templates/${token}`;
    navigator.clipboard.writeText(link);
    setMsg("Link copiado al portapapeles");
  };

  const loadTemplate = (t: Template) => { setCurrent({ ...t }); setEditing(true); setTab("brand"); };
  const newTemplate = () => { setCurrent({ ...DEFAULT_TEMPLATE }); setEditing(true); setTab("brand"); };

  const C = current;

  const ColorField = ({ label, field }: { label: string; field: keyof Template }) => (
    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
      <input type="color" value={(C[field] as string) || "#000000"}
        onChange={e => setCurrent(p => ({ ...p, [field]: e.target.value }))}
        style={{ width: 32, height: 32, borderRadius: 6, border: "1px solid var(--ink3)", cursor: "pointer", padding: 0 }} />
      <div>
        <div style={{ fontSize: 11, fontWeight: 600, color: "var(--t)" }}>{label}</div>
        <div style={{ fontSize: 10, color: "var(--t4)", fontFamily: "monospace" }}>{C[field] as string}</div>
      </div>
    </div>
  );

  return (
    <div style={{ padding: 24 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24, flexWrap: "wrap", gap: 12 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          {editing && (
            <button onClick={() => setEditing(false)} style={{ width: 32, height: 32, borderRadius: 8, border: "1px solid var(--ink3)", background: "none", color: "var(--t3)", cursor: "pointer", display: "grid", placeItems: "center" }}>
              <ArrowLeft size={16} />
            </button>
          )}
          <div>
            <h1 style={{ fontSize: 22, fontWeight: 800, color: "var(--t)", margin: 0 }}>Template Studio</h1>
            <p style={{ fontSize: 13, color: "var(--t3)", margin: "4px 0 0" }}>Diseña plantillas de informe con branding personalizado</p>
          </div>
        </div>
        {!editing && (
          <button onClick={newTemplate} style={{ display: "flex", alignItems: "center", gap: 6, padding: "10px 18px", borderRadius: 10, border: "none", background: "var(--gold, #c8a84b)", color: "#000", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>
            <Plus size={16} /> Nueva Plantilla
          </button>
        )}
      </div>

      {!editing && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(min(280px, 100%), 1fr))", gap: 16 }}>
          {templates.map(t => (
            <div key={t.id} className="glass-card" style={{ padding: 16, cursor: "pointer" }} onClick={() => loadTemplate(t)}>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
                {t.logoBase64 ? <img src={t.logoBase64} alt="" style={{ width: 36, height: 36, borderRadius: 8, objectFit: "contain" }} /> : <div style={{ width: 36, height: 36, borderRadius: 8, background: t.primaryColor || "#c8a84b", display: "grid", placeItems: "center", fontSize: 16, fontWeight: 800, color: "#000", flexShrink: 0 }}>{(t.name || "T")[0]}</div>}
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 14, fontWeight: 700, color: "var(--t)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{t.name}</div>
                  <div style={{ fontSize: 11, color: "var(--t4)" }}>{t.companyName || "Sin marca"}</div>
                </div>
              </div>
              <div style={{ display: "flex", gap: 4 }}>
                {[t.primaryColor, t.secondaryColor, t.accentColor, t.textColor, t.bgColor].filter(Boolean).map((c, i) => (
                  <div key={i} style={{ width: 20, height: 20, borderRadius: 4, background: c || "#333", border: "1px solid var(--ink3)" }} />
                ))}
              </div>
              <div style={{ display: "flex", gap: 6, marginTop: 12 }}>
                <button onClick={e => { e.stopPropagation(); handleDelete(t.id!); }} style={{ padding: "4px 8px", borderRadius: 6, border: "1px solid var(--ink3)", background: "none", color: "var(--t4)", fontSize: 10, cursor: "pointer", display: "flex", alignItems: "center", gap: 4 }}>
                  <Trash2 size={12} /> Eliminar
                </button>
                {t.shareToken && (
                  <button onClick={e => { e.stopPropagation(); handleCopyShareLink(t.shareToken!); }} style={{ padding: "4px 8px", borderRadius: 6, border: "1px solid var(--ink3)", background: "none", color: "var(--t4)", fontSize: 10, cursor: "pointer", display: "flex", alignItems: "center", gap: 4 }}>
                    <Share2 size={12} /> Compartir
                  </button>
                )}
              </div>
            </div>
          ))}
          {templates.length === 0 && (
            <div className="glass-card" style={{ padding: 40, textAlign: "center", gridColumn: "1 / -1" }}>
              <Palette size={32} style={{ color: "var(--t4)", marginBottom: 8 }} />
              <div style={{ fontSize: 14, fontWeight: 600, color: "var(--t3)" }}>Sin plantillas aún</div>
              <div style={{ fontSize: 12, color: "var(--t4)", marginTop: 4 }}>Crea tu primera plantilla personalizada</div>
            </div>
          )}
        </div>
      )}

      {editing && (
        <div style={{ display: "grid", gridTemplateColumns: "min(360px, 100%) 1fr", gap: 20 }}>
          <div>
            <div className="glass-card" style={{ padding: 16, marginBottom: 12 }}>
              <input value={C.name} onChange={e => setCurrent(p => ({ ...p, name: e.target.value }))} placeholder="Nombre de la plantilla *" style={{ width: "100%", padding: "10px 12px", borderRadius: 8, border: "1px solid var(--ink3)", background: "var(--ink1, #08080e)", color: "var(--t)", fontSize: 14, fontWeight: 600, fontFamily: "inherit", marginBottom: 8 }} />
              <input value={C.companyName} onChange={e => setCurrent(p => ({ ...p, companyName: e.target.value }))} placeholder="Nombre empresa / marca" style={{ width: "100%", padding: "8px 12px", borderRadius: 8, border: "1px solid var(--ink3)", background: "var(--ink1, #08080e)", color: "var(--t)", fontSize: 12, fontFamily: "inherit", marginBottom: 6 }} />
              <input value={C.tagline} onChange={e => setCurrent(p => ({ ...p, tagline: e.target.value }))} placeholder="Tagline / eslogan" style={{ width: "100%", padding: "8px 12px", borderRadius: 8, border: "1px solid var(--ink3)", background: "var(--ink1, #08080e)", color: "var(--t)", fontSize: 12, fontFamily: "inherit" }} />
            </div>

            <div className="glass-card" style={{ padding: 16, marginBottom: 12 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: "var(--gold, #c8a84b)", marginBottom: 8, letterSpacing: "0.1em", textTransform: "uppercase" }}>IA — Auto-diseño desde marca</div>
              <input value={aiUrl} onChange={e => setAiUrl(e.target.value)} placeholder="https://web-de-la-marca.com" style={{ width: "100%", padding: "7px 10px", borderRadius: 6, border: "1px solid var(--ink3)", background: "var(--ink1, #08080e)", color: "var(--t)", fontSize: 11, fontFamily: "inherit", marginBottom: 4 }} />
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 4, marginBottom: 8 }}>
                <input value={aiInstagram} onChange={e => setAiInstagram(e.target.value)} placeholder="@instagram" style={{ padding: "7px 10px", borderRadius: 6, border: "1px solid var(--ink3)", background: "var(--ink1, #08080e)", color: "var(--t)", fontSize: 11, fontFamily: "inherit" }} />
                <input value={aiCompany} onChange={e => setAiCompany(e.target.value)} placeholder="Nombre marca" style={{ padding: "7px 10px", borderRadius: 6, border: "1px solid var(--ink3)", background: "var(--ink1, #08080e)", color: "var(--t)", fontSize: 11, fontFamily: "inherit" }} />
              </div>
              <button onClick={handleAiSuggest} disabled={aiLoading || (!aiUrl && !aiInstagram && !aiCompany)} style={{ width: "100%", padding: "8px", borderRadius: 8, border: "none", background: aiLoading ? "var(--ink3)" : "var(--gold, #c8a84b)", color: "#000", fontSize: 12, fontWeight: 700, cursor: aiLoading ? "wait" : "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
                {aiLoading ? <><Loader2 size={14} className="animate-spin" /> Investigando marca...</> : <><Sparkles size={14} /> Auto-diseñar desde marca</>}
              </button>
            </div>

            <div style={{ display: "flex", gap: 2, marginBottom: 12, background: "var(--ink2)", borderRadius: 8, padding: 2 }}>
              {([["brand", "Marca"], ["colors", "Colores"], ["fonts", "Fuentes"], ["layout", "Layout"]] as [string, string][]).map(([id, label]) => (
                <button key={id} onClick={() => setTab(id as typeof tab)} style={{ flex: 1, padding: "7px 0", borderRadius: 6, border: "none", background: tab === id ? "var(--ink3)" : "transparent", color: tab === id ? "var(--t)" : "var(--t4)", fontSize: 12, cursor: "pointer", fontWeight: tab === id ? 600 : 400 }}>{label}</button>
              ))}
            </div>

            <div className="glass-card" style={{ padding: 16 }}>
              {tab === "brand" && (
                <>
                  <div style={{ fontSize: 11, fontWeight: 700, color: "var(--t3)", marginBottom: 10 }}>LOGO</div>
                  <div onClick={() => logoRef.current?.click()} style={{ width: "100%", height: 80, borderRadius: 10, border: C.logoBase64 ? "2px solid var(--gold, #c8a84b)" : "2px dashed var(--ink3)", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", overflow: "hidden", marginBottom: 12, background: "var(--ink1, #08080e)" }}>
                    {C.logoBase64 ? <img src={C.logoBase64} alt="" style={{ maxWidth: "100%", maxHeight: "100%", objectFit: "contain" }} /> : <span style={{ fontSize: 12, color: "var(--t4)" }}>Click para subir logo</span>}
                    <input ref={logoRef} type="file" accept="image/*" hidden onChange={handleLogoUpload} />
                  </div>
                  <div style={{ fontSize: 11, fontWeight: 700, color: "var(--t3)", marginBottom: 8 }}>FOOTER</div>
                  <input value={C.footerText} onChange={e => setCurrent(p => ({ ...p, footerText: e.target.value }))} placeholder="Texto del pie de página" style={{ width: "100%", padding: "8px 10px", borderRadius: 6, border: "1px solid var(--ink3)", background: "var(--ink1, #08080e)", color: "var(--t)", fontSize: 11, fontFamily: "inherit", marginBottom: 8 }} />
                  <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 11, color: "var(--t3)", cursor: "pointer" }}>
                    <input type="checkbox" checked={C.isPublic} onChange={e => setCurrent(p => ({ ...p, isPublic: e.target.checked }))} />
                    Plantilla pública (compartible por link)
                  </label>
                </>
              )}
              {tab === "colors" && (
                <>
                  <ColorField label="Principal (títulos, acentos)" field="primaryColor" />
                  <ColorField label="Secundario (fondo cover)" field="secondaryColor" />
                  <ColorField label="Acento (positivo, badges)" field="accentColor" />
                  <ColorField label="Texto" field="textColor" />
                  <ColorField label="Fondo página" field="bgColor" />
                  <ColorField label="Fondo cards" field="cardBg" />
                  <ColorField label="Bordes" field="borderColor" />
                </>
              )}
              {tab === "fonts" && (
                <>
                  <div style={{ fontSize: 11, fontWeight: 700, color: "var(--t3)", marginBottom: 8 }}>FUENTE TÍTULOS</div>
                  <select value={C.headingFont} onChange={e => setCurrent(p => ({ ...p, headingFont: e.target.value }))} style={{ width: "100%", padding: "8px 10px", borderRadius: 6, border: "1px solid var(--ink3)", background: "var(--ink1, #08080e)", color: "var(--t)", fontSize: 12, marginBottom: 12 }}>
                    {GOOGLE_FONTS.map(f => <option key={f} value={f}>{f}</option>)}
                  </select>
                  <div style={{ fontSize: 11, fontWeight: 700, color: "var(--t3)", marginBottom: 8 }}>FUENTE CUERPO</div>
                  <select value={C.bodyFont} onChange={e => setCurrent(p => ({ ...p, bodyFont: e.target.value }))} style={{ width: "100%", padding: "8px 10px", borderRadius: 6, border: "1px solid var(--ink3)", background: "var(--ink1, #08080e)", color: "var(--t)", fontSize: 12, marginBottom: 12 }}>
                    {GOOGLE_FONTS.map(f => <option key={f} value={f}>{f}</option>)}
                  </select>
                  <div style={{ padding: 12, borderRadius: 8, background: "var(--ink1, #08080e)", border: "1px solid var(--ink3)" }}>
                    <div style={{ fontFamily: C.headingFont, fontSize: 16, fontWeight: Number(C.headingWeight), color: "var(--t)", marginBottom: 4 }}>Vista previa de título</div>
                    <div style={{ fontFamily: C.bodyFont, fontSize: 12, color: "var(--t3)" }}>Este es un ejemplo de texto de cuerpo con la fuente seleccionada.</div>
                  </div>
                </>
              )}
              {tab === "layout" && (
                <>
                  <div style={{ fontSize: 11, fontWeight: 700, color: "var(--t3)", marginBottom: 8 }}>ESTILO COVER</div>
                  <div style={{ display: "flex", gap: 4, marginBottom: 12, flexWrap: "wrap" }}>
                    {COVER_STYLES.map(s => (
                      <button key={s.id} onClick={() => setCurrent(p => ({ ...p, coverStyle: s.id }))} style={{ flex: 1, minWidth: 80, padding: "8px 4px", borderRadius: 6, border: C.coverStyle === s.id ? `1.5px solid ${C.primaryColor}` : "1px solid var(--ink3)", background: C.coverStyle === s.id ? `${C.primaryColor}15` : "transparent", color: C.coverStyle === s.id ? C.primaryColor : "var(--t4)", fontSize: 10, fontWeight: 600, cursor: "pointer" }}>{s.label}</button>
                    ))}
                  </div>
                  <div style={{ fontSize: 11, fontWeight: 700, color: "var(--t3)", marginBottom: 8 }}>ESTILO SECCIONES</div>
                  <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                    {SECTION_STYLES.map(s => (
                      <button key={s.id} onClick={() => setCurrent(p => ({ ...p, sectionStyle: s.id }))} style={{ flex: 1, minWidth: 80, padding: "8px 4px", borderRadius: 6, border: C.sectionStyle === s.id ? `1.5px solid ${C.primaryColor}` : "1px solid var(--ink3)", background: C.sectionStyle === s.id ? `${C.primaryColor}15` : "transparent", color: C.sectionStyle === s.id ? C.primaryColor : "var(--t4)", fontSize: 10, fontWeight: 600, cursor: "pointer" }}>{s.label}</button>
                    ))}
                  </div>
                </>
              )}
            </div>

            <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
              <button onClick={handleSave} disabled={saving} style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 6, padding: "10px", borderRadius: 10, border: "none", background: "var(--gold, #c8a84b)", color: "#000", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>
                {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />} Guardar
              </button>
              <button onClick={() => setEditing(false)} style={{ padding: "10px 16px", borderRadius: 10, border: "1px solid var(--ink3)", background: "none", color: "var(--t4)", fontSize: 12, cursor: "pointer" }}>Cerrar</button>
            </div>

            {current.shareToken && current.isPublic && (
              <div style={{ marginTop: 8, padding: 8, borderRadius: 8, background: "var(--ink2)", display: "flex", alignItems: "center", gap: 8 }}>
                <Share2 size={12} style={{ color: "var(--t4)", flexShrink: 0 }} />
                <span style={{ fontSize: 10, color: "var(--t4)", flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>Link público disponible</span>
                <button onClick={() => handleCopyShareLink(current.shareToken!)} style={{ padding: "3px 8px", borderRadius: 4, border: "1px solid var(--ink3)", background: "none", color: "var(--gold, #c8a84b)", fontSize: 10, cursor: "pointer", whiteSpace: "nowrap" }}>Copiar</button>
              </div>
            )}

            {msg && <div style={{ marginTop: 8, fontSize: 12, color: msg.includes("guardada") || msg.includes("copiado") || msg.includes("sugerido") ? "var(--accent, #44cc88)" : "#ff6666", textAlign: "center" }}>{msg}</div>}
          </div>

          <div className="glass-card" style={{ padding: 0, overflow: "hidden", maxHeight: "calc(100vh - 140px)", display: "flex", flexDirection: "column" }}>
            <div style={{ padding: 8, borderBottom: "1px solid var(--ink3)", display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
              <Eye size={14} style={{ color: "var(--t4)" }} />
              <span style={{ fontSize: 11, fontWeight: 600, color: "var(--t3)" }}>Preview en tiempo real</span>
            </div>
            <iframe
              srcDoc={buildPreviewHtml(C)}
              sandbox="allow-same-origin"
              style={{ width: "100%", flex: 1, border: "none", minHeight: 400 }}
              title="Template Preview"
            />
          </div>
        </div>
      )}
    </div>
  );
}

function escHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}
const HEX_OK = /^#[0-9a-fA-F]{3,8}$/;
function safeHex(v: string, fb: string): string { return HEX_OK.test(v) ? v : fb; }
function safeFont(v: string): string { return v.replace(/[^a-zA-Z0-9 ]/g, ""); }

function buildPreviewHtml(t: Template): string {
  const pc = safeHex(t.primaryColor, "#c8a84b");
  const sc = safeHex(t.secondaryColor, "#08080e");
  const ac = safeHex(t.accentColor, "#44cc88");
  const tc = safeHex(t.textColor, "#f0f0f5");
  const bg = safeHex(t.bgColor, "#08080e");
  const cb = safeHex(t.cardBg, "#12121a");
  const bc = safeHex(t.borderColor, "#1a1a22");
  const hf = safeFont(t.headingFont);
  const bf = safeFont(t.bodyFont);
  const hw = /^[0-9]{3}$/.test(t.headingWeight) ? t.headingWeight : "700";

  const company = escHtml(t.companyName || "Nombre de Empresa");
  const tagline = t.tagline ? escHtml(t.tagline) : "";
  const footer = escHtml(t.footerText || t.companyName || "Generado con ShopyCrafter");
  const dateStr = new Date().toLocaleDateString("es-ES", { day: "2-digit", month: "long", year: "numeric" });

  return `<!DOCTYPE html><html><head><meta charset="UTF-8">
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=${encodeURIComponent(hf)}:wght@400;600;700&family=${encodeURIComponent(bf)}:wght@300;400;500;600&display=swap">
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:'${bf}',sans-serif;background:${bg};color:${tc};font-size:13px}
.page{min-height:45vh;position:relative}
.cover{background:${sc};padding:60px 40px;text-align:${t.coverStyle === "left-aligned" ? "left" : "center"};min-height:50vh;display:flex;flex-direction:column;justify-content:center;border-bottom:1px solid ${bc}}
.cover-logo{max-width:80px;max-height:80px;border-radius:12px;margin-bottom:16px;${t.coverStyle === "centered" ? "margin-left:auto;margin-right:auto;" : ""}}
.cover h1{font-family:'${hf}',serif;font-size:24px;font-weight:${hw};color:${pc};letter-spacing:2px;text-transform:uppercase;margin-bottom:6px}
.cover p{font-size:13px;color:${tc}80}
.cover .company{font-size:12px;color:${pc}60;letter-spacing:2px;text-transform:uppercase;margin-top:12px}
.body{padding:32px}
.section{margin-bottom:24px}
.section-title{font-family:'${hf}',serif;font-size:16px;font-weight:${hw};color:${pc};margin-bottom:12px;${t.sectionStyle === "accent-bar" ? `border-left:3px solid ${pc};padding-left:12px` : ""}}
.card{background:${cb};border:1px solid ${bc};border-radius:10px;padding:16px;margin-bottom:10px}
.metrics{display:flex;gap:12px;margin-bottom:20px;flex-wrap:wrap}
.metric{flex:1;min-width:60px;text-align:center;background:${cb};border:1px solid ${bc};border-radius:10px;padding:16px}
.metric .val{font-size:28px;font-weight:800;color:${pc}}
.metric .lbl{font-size:10px;color:${tc}60;margin-top:2px}
.rec{background:${cb};border-left:3px solid ${ac};padding:12px;margin-bottom:6px;border-radius:0 8px 8px 0;font-size:12px}
.grade{display:inline-block;padding:3px 10px;border-radius:5px;font-weight:700;font-size:12px;background:${ac}20;color:${ac}}
.footer{text-align:center;padding:20px;border-top:1px solid ${bc};font-size:11px;color:${tc}40}
.backcover{background:${sc};padding:60px 40px;text-align:center;min-height:40vh;display:flex;flex-direction:column;justify-content:center;align-items:center;border-top:3px solid ${pc}}
.backcover .logo-back{max-width:60px;max-height:60px;border-radius:10px;margin-bottom:16px;opacity:0.9}
.backcover .company-name{font-family:'${hf}',serif;font-size:18px;font-weight:${hw};color:${pc};letter-spacing:3px;text-transform:uppercase;margin-bottom:6px}
.backcover .tagline-back{font-size:12px;color:${tc}60;margin-bottom:20px}
.backcover .contact-line{font-size:11px;color:${tc}40;margin-bottom:4px}
.placeholder{border:1.5px dashed ${pc}40;border-radius:8px;padding:10px 14px;color:${tc}40;font-size:11px;font-style:italic;text-align:center;margin-bottom:8px}
.page-divider{border:none;border-top:1px dashed ${bc};margin:32px 0;position:relative}
.page-divider::after{content:'nueva pagina';position:absolute;top:-8px;left:50%;transform:translateX(-50%);background:${bg};padding:0 12px;font-size:9px;color:${tc}25;text-transform:uppercase;letter-spacing:2px}
.toc-item{display:flex;justify-content:space-between;align-items:baseline;padding:8px 0;border-bottom:1px dotted ${bc};font-size:12px}
.toc-item .toc-title{color:${tc}}
.toc-item .toc-page{color:${pc};font-weight:600}
</style></head><body>

<!-- PORTADA -->
<div class="cover page">
${t.logoBase64 && t.logoBase64.startsWith("data:image/") ? `<img class="cover-logo" src="${t.logoBase64}" alt="Logo">` : ""}
<h1 style="color:${pc}">Titulo del Informe</h1>
<p>Subtitulo o descripcion del informe</p>
<div class="company">${company}</div>
${tagline ? `<p style="font-size:11px;color:${tc}40;margin-top:6px">${tagline}</p>` : ""}
<p style="font-size:10px;color:${tc}30;margin-top:12px">${dateStr}</p>
</div>

<hr class="page-divider">

<!-- INDICE -->
<div class="body page">
<div class="section">
<div class="section-title">Indice</div>
<div class="card">
<div class="toc-item"><span class="toc-title">1. Resumen Ejecutivo</span><span class="toc-page">3</span></div>
<div class="toc-item"><span class="toc-title">2. Metricas Principales</span><span class="toc-page">4</span></div>
<div class="toc-item"><span class="toc-title">3. Analisis Detallado</span><span class="toc-page">5</span></div>
<div class="toc-item"><span class="toc-title">4. Distribucion y Resultados</span><span class="toc-page">6</span></div>
<div class="toc-item"><span class="toc-title">5. Recomendaciones</span><span class="toc-page">7</span></div>
<div class="toc-item"><span class="toc-title">6. Conclusiones</span><span class="toc-page">8</span></div>
</div>
</div>
</div>

<hr class="page-divider">

<!-- RESUMEN EJECUTIVO -->
<div class="body page">
<div class="section">
<div class="section-title">1. Resumen Ejecutivo</div>
<div class="card">
<p style="color:${tc}80;line-height:1.6;margin-bottom:8px">Este espacio contendra un resumen general del informe adaptado al tipo de analisis realizado. Se rellenara automaticamente con los datos reales del proyecto.</p>
<div class="placeholder">Contenido dinamico del resumen</div>
</div>
</div>
</div>

<hr class="page-divider">

<!-- METRICAS -->
<div class="body page">
<div class="section">
<div class="section-title">2. Metricas Principales</div>
<div class="metrics">
<div class="metric"><div class="val">--</div><div class="lbl">Metrica 1</div></div>
<div class="metric"><div class="val">--</div><div class="lbl">Metrica 2</div></div>
<div class="metric"><div class="val">--</div><div class="lbl">Metrica 3</div></div>
<div class="metric"><div class="val">--</div><div class="lbl">Metrica 4</div></div>
</div>
<div class="placeholder">Las metricas se adaptan al tipo de informe: SEO, ventas, inventario, competencia, etc.</div>
</div>
</div>

<hr class="page-divider">

<!-- ANALISIS DETALLADO -->
<div class="body page">
<div class="section">
<div class="section-title">3. Analisis Detallado</div>
<div class="card">
<p style="font-weight:600;color:${pc};margin-bottom:4px">Seccion de datos</p>
<p style="color:${tc}60;font-size:12px;line-height:1.5;margin-bottom:8px">Aqui se mostraran tablas, graficos o listas con el desglose detallado de los datos analizados.</p>
<div class="placeholder">Tablas / graficos / listas dinamicas</div>
</div>
<div class="card">
<p style="font-weight:600;color:${pc};margin-bottom:4px">Observaciones</p>
<p style="color:${tc}60;font-size:12px;line-height:1.5">Notas y observaciones generadas a partir del analisis de los datos.</p>
</div>
</div>
</div>

<hr class="page-divider">

<!-- DISTRIBUCION -->
<div class="body page">
<div class="section">
<div class="section-title">4. Distribucion y Resultados</div>
<div class="card">
<div style="display:flex;align-items:center;gap:8px;margin-bottom:6px"><span class="grade">A</span><div style="flex:1;height:6px;background:${bc};border-radius:3px;overflow:hidden"><div style="width:35%;height:100%;background:${ac};border-radius:3px"></div></div><span style="font-size:11px">Excelente</span></div>
<div style="display:flex;align-items:center;gap:8px;margin-bottom:6px"><span class="grade" style="background:${pc}20;color:${pc}">B</span><div style="flex:1;height:6px;background:${bc};border-radius:3px;overflow:hidden"><div style="width:45%;height:100%;background:${pc};border-radius:3px"></div></div><span style="font-size:11px">Bueno</span></div>
<div style="display:flex;align-items:center;gap:8px"><span class="grade" style="background:#ffa50020;color:#ffa500">C</span><div style="flex:1;height:6px;background:${bc};border-radius:3px;overflow:hidden"><div style="width:20%;height:100%;background:#ffa500;border-radius:3px"></div></div><span style="font-size:11px">Mejorable</span></div>
</div>
</div>
</div>

<hr class="page-divider">

<!-- RECOMENDACIONES -->
<div class="body page">
<div class="section">
<div class="section-title">5. Recomendaciones</div>
<div class="rec">Recomendacion prioritaria 1 — se generara automaticamente</div>
<div class="rec">Recomendacion prioritaria 2 — basada en los datos analizados</div>
<div class="rec">Recomendacion prioritaria 3 — con impacto estimado</div>
<div class="placeholder">Las recomendaciones se generan con IA segun el tipo de informe</div>
</div>
</div>

<hr class="page-divider">

<!-- CONCLUSIONES -->
<div class="body page">
<div class="section">
<div class="section-title">6. Conclusiones</div>
<div class="card">
<p style="color:${tc}80;line-height:1.6">Seccion de conclusiones finales con un resumen de los hallazgos principales y proximos pasos recomendados para el cliente.</p>
<div class="placeholder">Conclusiones generadas automaticamente</div>
</div>
</div>
</div>

<hr class="page-divider">

<!-- CONTRAPORTADA -->
<div class="backcover page">
${t.logoBase64 && t.logoBase64.startsWith("data:image/") ? `<img class="logo-back" src="${t.logoBase64}" alt="Logo">` : `<div style="width:50px;height:50px;border-radius:10px;background:${pc};margin-bottom:16px;display:grid;place-items:center;font-size:20px;font-weight:800;color:${sc}">${(t.companyName || "E")[0].toUpperCase()}</div>`}
<div class="company-name">${company}</div>
${tagline ? `<div class="tagline-back">${tagline}</div>` : ""}
<div style="width:40px;height:2px;background:${pc};margin:16px auto"></div>
<div class="contact-line">www.ejemplo.com</div>
<div class="contact-line">contacto@ejemplo.com</div>
<div class="contact-line" style="margin-top:12px;font-size:10px;color:${tc}25">Documento confidencial · ${dateStr}</div>
</div>

<div class="footer">${footer}${t.showPageNumbers ? " · Pagina 1 de 8" : ""}</div>
</body></html>`;
}
