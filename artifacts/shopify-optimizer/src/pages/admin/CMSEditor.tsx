import { useState, useEffect, useRef, useCallback } from "react";
import { useLocation } from "wouter";
import {
  Monitor, Tablet, Smartphone, Save, Loader2,
  ArrowLeft, RefreshCw, RotateCcw, ExternalLink,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const BASE_URL = import.meta.env.BASE_URL.replace(/\/$/, "");

type DeviceMode = "desktop" | "tablet" | "mobile";
type ActiveTab = "Fondos" | "Gold" | "Jade" | "Estados" | "Texto" | "CSS Libre";

const CSS_VAR_DEFS: { group: ActiveTab; vars: { name: string; label: string; hint: string }[] }[] = [
  {
    group: "Fondos",
    vars: [
      { name: "--ink",  label: "Fondo base",       hint: "Fondo principal de la app" },
      { name: "--ink2", label: "Fondo medio",       hint: "Cards, paneles" },
      { name: "--ink3", label: "Fondo elevado",     hint: "Inputs, tooltips" },
      { name: "--ink4", label: "Fondo alto",        hint: "Modales, popovers" },
      { name: "--ink5", label: "Fondo máximo",      hint: "Elementos más elevados" },
    ],
  },
  {
    group: "Gold",
    vars: [
      { name: "--gold",  label: "Gold principal",  hint: "#c8a84b por defecto" },
      { name: "--gold2", label: "Gold claro",       hint: "Variante más clara" },
      { name: "--gold3", label: "Gold muy claro",   hint: "Variante muy clara" },
      { name: "--bdr",   label: "Borde tenue",      hint: "rgba(200,168,75,0.10)" },
      { name: "--bdr2",  label: "Borde medio",      hint: "rgba(200,168,75,0.25)" },
      { name: "--bdr3",  label: "Borde fuerte",     hint: "rgba(200,168,75,0.50)" },
    ],
  },
  {
    group: "Jade",
    vars: [
      { name: "--jade",  label: "Jade principal",  hint: "#2dd49f por defecto" },
      { name: "--jade2", label: "Jade claro",       hint: "Variante más clara" },
    ],
  },
  {
    group: "Estados",
    vars: [
      { name: "--sky",   label: "Sky (info)",       hint: "Azul informativo" },
      { name: "--crim",  label: "Crim (error)",     hint: "Rojo de errores" },
      { name: "--amber", label: "Amber (aviso)",    hint: "Amarillo de advertencia" },
    ],
  },
  {
    group: "Texto",
    vars: [
      { name: "--t",  label: "Texto principal",     hint: "#f2f0ff" },
      { name: "--t2", label: "Texto secundario",    hint: "#9896ba" },
      { name: "--t3", label: "Texto tenue",         hint: "#58567a" },
      { name: "--t4", label: "Texto muy tenue",     hint: "#35334f" },
    ],
  },
];

const ALL_TABS: ActiveTab[] = ["Fondos", "Gold", "Jade", "Estados", "Texto", "CSS Libre"];

function parseCssVarsFromRoot(css: string): Record<string, string> {
  const vars: Record<string, string> = {};
  const rootMatch = css.match(/:root\s*\{([^}]*)\}/);
  if (!rootMatch) return vars;
  const matches = [...rootMatch[1].matchAll(/(--[\w-]+)\s*:\s*([^;]+);/g)];
  for (const [, name, value] of matches) {
    vars[name.trim()] = value.trim();
  }
  return vars;
}

function parseCustomCss(css: string): string {
  const marker = "/* ── CMS CUSTOM CSS ── */";
  const idx = css.indexOf(marker);
  if (idx === -1) return "";
  return css.slice(idx + marker.length).trim();
}

function rebuildCss(original: string, cssVars: Record<string, string>, customCss: string): string {
  const rootBlock = `:root {\n${Object.entries(cssVars).map(([k, v]) => `  ${k}: ${v};`).join("\n")}\n}`;
  let updated = original.replace(/:root\s*\{[^}]*\}/, rootBlock);
  const marker = "/* ── CMS CUSTOM CSS ── */";
  updated = updated.replace(new RegExp(`\\/\\* ── CMS CUSTOM CSS ── \\*\\/[\\s\\S]*$`), "").trimEnd();
  if (customCss.trim()) {
    updated += `\n\n${marker}\n${customCss}`;
  }
  return updated;
}

export default function CMSEditor() {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const iframeRef = useRef<HTMLIFrameElement>(null);

  const [originalCss, setOriginalCss] = useState<string | null>(null);
  const [cssVars, setCssVars] = useState<Record<string, string>>({});
  const [customCss, setCustomCss] = useState("");
  const [device, setDevice] = useState<DeviceMode>("desktop");
  const [activeTab, setActiveTab] = useState<ActiveTab>("Fondos");
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [dirty, setDirty] = useState(false);
  const [iframeKey, setIframeKey] = useState(0);

  const loadCss = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`${BASE_URL}/api/studio/file?path=design-system.css`, {
        credentials: "include",
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json() as { content: string };
      setOriginalCss(data.content);
      setCssVars(parseCssVarsFromRoot(data.content));
      setCustomCss(parseCustomCss(data.content));
    } catch (e: any) {
      toast({ title: "Error cargando design-system.css", description: e.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => { loadCss(); }, [loadCss]);

  function applyVarChange(varName: string, value: string) {
    setCssVars(prev => ({ ...prev, [varName]: value }));
    document.documentElement.style.setProperty(varName, value);
    setDirty(true);
  }

  async function save() {
    if (!dirty || originalCss === null) return;
    setSaving(true);
    try {
      const updated = rebuildCss(originalCss, cssVars, customCss);
      const res = await fetch(`${BASE_URL}/api/studio/file`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ path: "design-system.css", content: updated }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setOriginalCss(updated);
      setDirty(false);
      setIframeKey(k => k + 1);
      toast({ title: "✅ design-system.css guardado", description: "Vite recargará la preview automáticamente." });
    } catch (e: any) {
      toast({ title: "Error al guardar", description: e.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  }

  async function resetToOriginal() {
    if (!confirm("¿Restaurar design-system.css al estado cargado? Perderás los cambios sin guardar.")) return;
    const reloaded = originalCss;
    if (!reloaded) return;
    setCssVars(parseCssVarsFromRoot(reloaded));
    setCustomCss(parseCustomCss(reloaded));
    const parsed = parseCssVarsFromRoot(reloaded);
    for (const [k, v] of Object.entries(parsed)) {
      document.documentElement.style.removeProperty(k);
    }
    setDirty(false);
    toast({ title: "Cambios descartados" });
  }

  function varValue(name: string): string {
    if (cssVars[name]) return cssVars[name];
    return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  }

  const previewUrl = `${window.location.origin}${BASE_URL || ""}/`;
  const iframeWidth = device === "desktop" ? "100%" : device === "tablet" ? "768px" : "390px";
  const isNarrow = device !== "desktop";

  if (loading) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100vh", flexDirection: "column", gap: 12, background: "var(--ink)" }}>
        <Loader2 size={28} className="animate-spin" style={{ color: "var(--gold)" }} />
        <p style={{ fontSize: 13, color: "var(--t3)" }}>Cargando design-system.css…</p>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100vh", overflow: "hidden", background: "var(--ink)" }}>

      {/* ── TOPBAR ── */}
      <div style={{
        height: 56, flexShrink: 0, display: "flex", alignItems: "center",
        justifyContent: "space-between", padding: "0 16px",
        borderBottom: "1px solid var(--bdr)", background: "var(--ink)", gap: 12,
      }}>
        {/* Left */}
        <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
          <button
            onClick={() => navigate("/home")}
            style={{ width: 32, height: 32, borderRadius: 9, background: "var(--ink2)", border: "1px solid var(--bdr)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--t3)", flexShrink: 0 }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = "var(--gold)"; e.currentTarget.style.color = "var(--gold)"; }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = "var(--bdr)"; e.currentTarget.style.color = "var(--t3)"; }}
          ><ArrowLeft size={15} /></button>

          <div style={{ width: 32, height: 32, borderRadius: 10, background: "linear-gradient(135deg,var(--gold),#e6c668)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16, flexShrink: 0 }}>🎨</div>
          <span style={{ fontWeight: 700, fontSize: 15, color: "var(--t)", whiteSpace: "nowrap" }}>CMS — Design System</span>
          <span style={{ fontSize: 10, color: "var(--t4)", fontFamily: "monospace", whiteSpace: "nowrap", display: "none" }}>design-system.css</span>

          {dirty && (
            <span style={{ fontSize: 11, background: "rgba(200,168,75,.12)", color: "var(--gold)", padding: "3px 10px", borderRadius: 20, border: "1px solid rgba(200,168,75,.25)", whiteSpace: "nowrap", flexShrink: 0 }}>
              Sin guardar
            </span>
          )}
        </div>

        {/* Center: device switcher */}
        <div style={{ display: "flex", alignItems: "center", gap: 2, background: "var(--ink2)", borderRadius: 12, padding: 3, flexShrink: 0 }}>
          {(["desktop", "tablet", "mobile"] as DeviceMode[]).map(d => (
            <button key={d} onClick={() => setDevice(d)} title={d} style={{
              padding: "6px 10px", borderRadius: 9, border: "none", cursor: "pointer", transition: "all .15s",
              background: device === d ? "var(--ink3)" : "transparent",
              color: device === d ? "var(--gold)" : "var(--t3)",
            }}>
              {d === "desktop" ? <Monitor size={15} /> : d === "tablet" ? <Tablet size={15} /> : <Smartphone size={15} />}
            </button>
          ))}
        </div>

        {/* Right: actions */}
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
          <a href={previewUrl} target="_blank" rel="noreferrer"
            style={{ padding: "6px 11px", background: "var(--ink2)", border: "1px solid var(--bdr)", borderRadius: 10, fontSize: 12, color: "var(--t2)", cursor: "pointer", display: "flex", alignItems: "center", gap: 5, textDecoration: "none" }}>
            <ExternalLink size={12} /><span>Abrir</span>
          </a>
          <button onClick={() => setIframeKey(k => k + 1)}
            style={{ padding: "6px 11px", background: "var(--ink2)", border: "1px solid var(--bdr)", borderRadius: 10, fontSize: 12, color: "var(--t2)", cursor: "pointer", display: "flex", alignItems: "center", gap: 5 }}>
            <RefreshCw size={12} />
          </button>
          {dirty && (
            <button onClick={resetToOriginal}
              style={{ padding: "6px 11px", background: "var(--ink2)", border: "1px solid var(--bdr)", borderRadius: 10, fontSize: 12, color: "var(--t3)", cursor: "pointer", display: "flex", alignItems: "center", gap: 5 }}>
              <RotateCcw size={12} /><span>Descartar</span>
            </button>
          )}
          <button onClick={save} disabled={saving || !dirty}
            style={{
              padding: "6px 16px", fontSize: 12, fontWeight: 700, border: "none", borderRadius: 10, cursor: dirty && !saving ? "pointer" : "default",
              background: dirty ? "var(--gold)" : "var(--ink3)",
              color: dirty ? "#000" : "var(--t4)",
              opacity: saving ? 0.65 : 1,
              display: "flex", alignItems: "center", gap: 6, transition: "all .2s",
            }}>
            {saving ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />}
            {saving ? "Guardando…" : "Guardar al disco"}
          </button>
        </div>
      </div>

      {/* ── BODY ── */}
      <div style={{ flex: 1, display: "flex", overflow: "hidden" }}>

        {/* LEFT: CSS editor panel */}
        <div style={{ width: 292, flexShrink: 0, display: "flex", flexDirection: "column", borderRight: "1px solid var(--bdr)", background: "var(--ink)", overflow: "hidden" }}>

          {/* Tab bar */}
          <div style={{ flexShrink: 0, display: "flex", overflowX: "auto", borderBottom: "1px solid var(--bdr)", background: "var(--ink)" }}>
            {ALL_TABS.map(tab => (
              <button key={tab} onClick={() => setActiveTab(tab)} style={{
                padding: "10px 12px", fontSize: 11, fontWeight: 700, border: "none",
                borderBottom: `2px solid ${activeTab === tab ? "var(--gold)" : "transparent"}`,
                background: "transparent", cursor: "pointer", whiteSpace: "nowrap", transition: "all .15s",
                color: activeTab === tab ? "var(--gold)" : "var(--t3)",
              }}>{tab}</button>
            ))}
          </div>

          {/* Content area */}
          <div style={{ flex: 1, overflowY: "auto", padding: 14 }}>

            {activeTab === "CSS Libre" ? (
              <div>
                <p style={{ fontSize: 11, color: "var(--t3)", marginBottom: 10, lineHeight: 1.6 }}>
                  CSS adicional inyectado al final de <code style={{ color: "var(--gold)", fontSize: 10 }}>design-system.css</code>. Máxima prioridad — puede sobreescribir cualquier regla.
                </p>
                <textarea
                  value={customCss}
                  onChange={e => { setCustomCss(e.target.value); setDirty(true); }}
                  rows={22}
                  placeholder={`/* Ejemplo: cambiar el color del sidebar */\n.sc-sidebar { background: #0a0a0f; }\n\n/* Ejemplo: override de variable en contexto */\n.admin-panel { --gold: #ff8c42; }\n\n/* Ejemplo: animación custom */\n@keyframes pulse-gold {\n  0%, 100% { opacity: 1; }\n  50% { opacity: 0.6; }\n}`}
                  spellCheck={false}
                  style={{
                    width: "100%", fontFamily: "monospace", fontSize: 11,
                    background: "#0a0a12", border: "1px solid var(--bdr2)",
                    borderRadius: 10, color: "#e2e0ff", padding: "10px 12px",
                    resize: "vertical", outline: "none", lineHeight: 1.7,
                    boxSizing: "border-box", transition: "border-color .15s",
                  }}
                  onFocus={e => (e.currentTarget.style.borderColor = "var(--gold)")}
                  onBlur={e => (e.currentTarget.style.borderColor = "var(--bdr2)")}
                />
                <p style={{ fontSize: 10, color: "var(--t4)", marginTop: 8 }}>
                  Los cambios se guardan en disco al pulsar <strong style={{ color: "var(--gold)" }}>Guardar al disco</strong>.
                </p>
              </div>
            ) : (
              <>
                {CSS_VAR_DEFS.filter(g => g.group === activeTab).map(group => (
                  <div key={group.group}>
                    {group.vars.map(v => {
                      const current = varValue(v.name);
                      const isHex = /^#[0-9a-fA-F]{3,8}$/.test(current.trim());
                      const displayVal = isHex ? current.trim() : "#c8a84b";
                      return (
                        <label key={v.name}
                          style={{ display: "flex", alignItems: "center", gap: 10, background: "var(--ink2)", border: "1px solid var(--bdr)", borderRadius: 10, padding: "9px 12px", cursor: "pointer", marginBottom: 8, transition: "border-color .15s" }}
                          onMouseEnter={e => (e.currentTarget.style.borderColor = "var(--bdr2)")}
                          onMouseLeave={e => (e.currentTarget.style.borderColor = "var(--bdr)")}
                        >
                          <input
                            type="color"
                            value={displayVal}
                            style={{ width: 34, height: 34, border: "none", borderRadius: 8, cursor: "pointer", background: "none", padding: 0, flexShrink: 0 }}
                            onChange={e => applyVarChange(v.name, e.target.value)}
                          />
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontSize: 12, fontWeight: 600, color: "var(--t)", lineHeight: 1.3 }}>{v.label}</div>
                            <div style={{ fontSize: 10, color: "var(--t4)", fontFamily: "monospace", marginTop: 2 }}>{v.name}</div>
                            <div style={{ fontSize: 10, color: "var(--t3)", marginTop: 1 }}>{isHex ? current.trim() : v.hint}</div>
                          </div>
                          {/* Live preview swatch */}
                          <div style={{ width: 14, height: 14, borderRadius: 4, background: isHex ? current.trim() : v.hint, flexShrink: 0, border: "1px solid rgba(255,255,255,0.08)" }} />
                        </label>
                      );
                    })}
                  </div>
                ))}
                <p style={{ fontSize: 10, color: "var(--t4)", marginTop: 8, lineHeight: 1.6 }}>
                  Los colores se aplican al DOM <strong style={{ color: "var(--jade)" }}>en tiempo real</strong>. Pulsa <strong style={{ color: "var(--gold)" }}>Guardar al disco</strong> para persistirlos en <code style={{ fontSize: 9 }}>design-system.css</code>.
                </p>
              </>
            )}
          </div>
        </div>

        {/* RIGHT: live preview */}
        <div style={{ flex: 1, display: "flex", flexDirection: "column", background: "#080810", alignItems: "center", overflow: "hidden" }}>
          <div style={{ flex: 1, width: "100%", display: "flex", alignItems: "flex-start", justifyContent: "center", overflow: isNarrow ? "auto" : "hidden", padding: isNarrow ? "16px 0" : 0 }}>
            <iframe
              key={iframeKey}
              ref={iframeRef}
              src={previewUrl}
              style={{
                width: iframeWidth,
                height: isNarrow ? "calc(100vh - 88px)" : "100%",
                border: "none",
                flexShrink: 0,
                ...(isNarrow ? { borderRadius: 16, border: "1px solid var(--bdr2)", boxShadow: "0 0 60px rgba(0,0,0,0.8)" } : {}),
              }}
              title="Vista previa en vivo"
            />
          </div>
        </div>
      </div>

      <style>{`
        @media (max-width: 768px) {
          .cms-left-panel-hidden { display: none !important; }
        }
      `}</style>
    </div>
  );
}
