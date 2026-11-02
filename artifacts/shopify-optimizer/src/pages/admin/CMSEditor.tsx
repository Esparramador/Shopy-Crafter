import { useState, useEffect, useRef, useCallback } from "react";
import { useLocation } from "wouter";
import {
  Monitor, Tablet, Smartphone, Save, Loader2,
  ArrowLeft, RefreshCw, RotateCcw, ExternalLink, History,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const BASE_URL = import.meta.env.BASE_URL.replace(/\/$/, "");

type DeviceMode = "desktop" | "tablet" | "mobile";
type ActiveTab = "Fondos" | "Gold" | "Jade" | "Estados" | "Texto" | "CSS Libre" | "Historial";
interface CmsVersion { id: number; version: number; savedAt: string; savedBy: string | null; label: string | null }

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

const ALL_TABS: ActiveTab[] = ["Fondos", "Gold", "Jade", "Estados", "Texto", "CSS Libre", "Historial"];
const ALL_VAR_NAMES = CSS_VAR_DEFS.flatMap(g => g.vars.map(v => v.name));

// El tema se guarda en el CMS (BD): site.cssVars y customCss. Antes se escribía
// design-system.css en el disco del servidor: en producción la web es el build
// compilado, así que el cambio no llegaba nunca. CmsContext aplica ambos campos
// en todas las páginas y se actualiza al momento por SSE.
export default function CMSEditor() {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const iframeRef = useRef<HTMLIFrameElement>(null);

  const [savedVars, setSavedVars] = useState<Record<string, string>>({});
  const [savedCustomCss, setSavedCustomCss] = useState("");
  const [cssVars, setCssVars] = useState<Record<string, string>>({});
  const [customCss, setCustomCss] = useState("");
  const [device, setDevice] = useState<DeviceMode>("desktop");
  const [activeTab, setActiveTab] = useState<ActiveTab>("Fondos");
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [dirty, setDirty] = useState(false);
  const [iframeKey, setIframeKey] = useState(0);
  const [versions, setVersions] = useState<CmsVersion[] | null>(null);
  const [restoring, setRestoring] = useState<number | null>(null);

  const loadCss = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`${BASE_URL}/api/cms/content`, { credentials: "include" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const content = await res.json() as { site?: { cssVars?: Record<string, string> }; customCss?: string };
      const overrides = content.site?.cssVars ?? {};
      setSavedVars(overrides);
      setCssVars(overrides);
      setSavedCustomCss(content.customCss ?? "");
      setCustomCss(content.customCss ?? "");
      setDirty(false);
    } catch (e: any) {
      toast({ title: "Error cargando el tema", description: e.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => { loadCss(); }, [loadCss]);

  const loadVersions = useCallback(async () => {
    try {
      const res = await fetch(`${BASE_URL}/api/cms/versions`, { credentials: "include" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setVersions(await res.json() as CmsVersion[]);
    } catch (e: any) {
      setVersions([]);
      toast({ title: "Error cargando el historial", description: e.message, variant: "destructive" });
    }
  }, [toast]);

  useEffect(() => { if (activeTab === "Historial" && versions === null) loadVersions(); }, [activeTab, versions, loadVersions]);

  async function restoreVersion(v: CmsVersion) {
    if (!confirm(`¿Restaurar la versión ${v.label ?? v.version}? Se guarda antes una copia del estado actual.`)) return;
    setRestoring(v.id);
    try {
      const res = await fetch(`${BASE_URL}/api/cms/versions/${v.id}/restore`, { method: "POST", credentials: "include" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      for (const n of ALL_VAR_NAMES) document.documentElement.style.removeProperty(n);
      await loadCss();
      await loadVersions();
      setIframeKey(k => k + 1);
      toast({ title: "Versión restaurada" });
    } catch (e: any) {
      toast({ title: "No se pudo restaurar", description: e.message, variant: "destructive" });
    } finally {
      setRestoring(null);
    }
  }

  function applyVarChange(varName: string, value: string) {
    setCssVars(prev => ({ ...prev, [varName]: value }));
    document.documentElement.style.setProperty(varName, value);
    setDirty(true);
  }

  async function save() {
    if (!dirty) return;
    setSaving(true);
    try {
      const res = await fetch(`${BASE_URL}/api/cms/content/batch`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ changes: [
          { path: "site.cssVars", value: cssVars },
          { path: "customCss", value: customCss },
        ] }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setSavedVars(cssVars);
      setSavedCustomCss(customCss);
      setDirty(false);
      setVersions(null);
      setIframeKey(k => k + 1);
      toast({ title: "✅ Tema guardado", description: "Se aplica al momento en toda la web." });
    } catch (e: any) {
      toast({ title: "Error al guardar", description: e.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  }

  function resetToOriginal() {
    if (!confirm("¿Descartar los cambios sin guardar?")) return;
    for (const n of ALL_VAR_NAMES) {
      if (savedVars[n]) document.documentElement.style.setProperty(n, savedVars[n]);
      else document.documentElement.style.removeProperty(n);
    }
    setCssVars(savedVars);
    setCustomCss(savedCustomCss);
    setDirty(false);
    toast({ title: "Cambios descartados" });
  }

  async function clearOverride(name: string) {
    const next = { ...cssVars }; delete next[name];
    setCssVars(next);
    document.documentElement.style.removeProperty(name);
    setDirty(true);
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
        <p style={{ fontSize: 13, color: "var(--t3)" }}>Cargando tema…</p>
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
            {saving ? "Guardando…" : "Guardar"}
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

            {activeTab === "Historial" ? (
              <div>
                <p style={{ fontSize: 11, color: "var(--t3)", marginBottom: 10, lineHeight: 1.6 }}>
                  Últimas 30 versiones del contenido del CMS (textos y tema). Restaurar guarda antes una copia del estado actual.
                </p>
                {versions === null ? (
                  <Loader2 size={16} className="animate-spin" style={{ color: "var(--gold)" }} />
                ) : versions.length === 0 ? (
                  <p style={{ fontSize: 11, color: "var(--t4)" }}>Sin versiones guardadas todavía.</p>
                ) : versions.map(v => (
                  <div key={v.id} style={{ display: "flex", alignItems: "center", gap: 8, background: "var(--ink2)", border: "1px solid var(--bdr)", borderRadius: 10, padding: "8px 10px", marginBottom: 6 }}>
                    <History size={13} style={{ color: "var(--t3)", flexShrink: 0 }} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 12, fontWeight: 600, color: "var(--t)" }}>{v.label ?? `v${v.version}`}</div>
                      <div style={{ fontSize: 10, color: "var(--t4)" }}>{new Date(v.savedAt).toLocaleString("es-ES")}</div>
                    </div>
                    <button onClick={() => restoreVersion(v)} disabled={restoring !== null}
                      style={{ padding: "4px 9px", fontSize: 11, background: "var(--ink3)", border: "1px solid var(--bdr2)", borderRadius: 8, color: "var(--gold)", cursor: restoring !== null ? "default" : "pointer" }}>
                      {restoring === v.id ? "…" : "Restaurar"}
                    </button>
                  </div>
                ))}
              </div>
            ) : activeTab === "CSS Libre" ? (
              <div>
                <p style={{ fontSize: 11, color: "var(--t3)", marginBottom: 10, lineHeight: 1.6 }}>
                  CSS adicional que se carga después de todos los estilos de la web. Máxima prioridad: puede sobreescribir cualquier regla.
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
                  Se aplica a toda la web al pulsar <strong style={{ color: "var(--gold)" }}>Guardar</strong>.
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
                          {cssVars[v.name] && (
                            <button type="button" title="Volver al valor por defecto" onClick={e => { e.preventDefault(); clearOverride(v.name); }}
                              style={{ background: "none", border: "none", color: "var(--t3)", cursor: "pointer", padding: 2, flexShrink: 0 }}>
                              <RotateCcw size={12} />
                            </button>
                          )}
                          {/* Live preview swatch */}
                          <div style={{ width: 14, height: 14, borderRadius: 4, background: isHex ? current.trim() : v.hint, flexShrink: 0, border: "1px solid rgba(255,255,255,0.08)" }} />
                        </label>
                      );
                    })}
                  </div>
                ))}
                <p style={{ fontSize: 10, color: "var(--t4)", marginTop: 8, lineHeight: 1.6 }}>
                  Los colores se ven <strong style={{ color: "var(--jade)" }}>en tiempo real</strong>. Pulsa <strong style={{ color: "var(--gold)" }}>Guardar</strong> para aplicarlos a toda la web.
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
