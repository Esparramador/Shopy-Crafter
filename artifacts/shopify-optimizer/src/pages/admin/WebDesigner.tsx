import { useState, useRef, useEffect, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { useParams } from "wouter";

const API = import.meta.env.BASE_URL.replace(/\/$/, "") + "/api";

interface DesignerTemplate { id: string; name: string; icon: string; category: string; prompt: string; }
interface EffectTemplate { id: string; name: string; icon?: string; category: string; tags?: string[]; description?: string; prompt: string; }
interface DemoItem { id: string; name: string; category: string; file: string; }
interface DesignSession { id: string; title: string; currentHtml: string; history: Array<{role:string;content:string}>; model: string; updatedAt: string; }
interface Project { id: number; name: string; }

type ViewportSize = "desktop" | "tablet" | "mobile";
const VIEWPORT_WIDTHS = { desktop: "100%", tablet: "768px", mobile: "390px" };
const MODELS = [
  { id: "claude-haiku-4-5",  label: "Claude Haiku (Rápido)", provider: "claude" },
  { id: "claude-sonnet-4-5", label: "Claude Sonnet (Balanceado)", provider: "claude" },
  { id: "claude-opus-4-5",   label: "Claude Opus (Mejor)", provider: "claude" },
  { id: "gemini-2.5-flash",  label: "Gemini Flash", provider: "gemini" },
  { id: "gemini-2.5-pro",    label: "Gemini Pro", provider: "gemini" },
  { id: "gpt-4.1",           label: "GPT-4.1", provider: "openai" },
];

export default function WebDesigner() {
  const params = useParams<{ id?: string }>();
  const urlProjectId = params.id ? Number(params.id) : undefined;

  const [sessionId, setSessionId] = useState<string>("");
  const [currentHtml, setCurrentHtml] = useState("");
  const [history, setHistory] = useState<Array<{role:string;content:string}>>([]);
  const [prompt, setPrompt] = useState("");
  const [model, setModel] = useState("claude-sonnet-4-5");
  const [projectId, setProjectId] = useState<number | undefined>(urlProjectId);

  useEffect(() => { if (urlProjectId) setProjectId(urlProjectId); }, [urlProjectId]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState("");
  const [viewport, setViewport] = useState<ViewportSize>("desktop");
  const [rightPanel, setRightPanel] = useState<"chat" | "code">("chat");
  const [leftTab, setLeftTab] = useState<"templates" | "sessions" | "demos" | "effects">("templates");
  const [deployMsg, setDeployMsg] = useState("");
  const [streamText, setStreamText] = useState("");

  // Import URL modal
  const [showImportModal, setShowImportModal] = useState(false);
  const [importUrl, setImportUrl] = useState("");
  const [importLoading, setImportLoading] = useState(false);
  const [importError, setImportError] = useState("");

  const iframeRef = useRef<HTMLIFrameElement>(null);
  const promptRef = useRef<HTMLTextAreaElement>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  const { data: templates = [] } = useQuery<DesignerTemplate[]>({
    queryKey: ["web-designer-templates"],
    queryFn: () => fetch(`${API}/web-designer/templates`, { credentials: "include" }).then(r => r.json()),
  });

  const { data: effects = [] } = useQuery<EffectTemplate[]>({
    queryKey: ["web-designer-effects"],
    queryFn: () => fetch(`${API}/prompts/effects`, { credentials: "include" }).then(r => r.json()).then(d => d.templates ?? []),
  });

  const { data: demos = [] } = useQuery<DemoItem[]>({
    queryKey: ["web-designer-demos"],
    queryFn: () => fetch(`${API}/web-designer/demos`, { credentials: "include" }).then(r => r.json()),
  });

  const { data: sessions = [], refetch: refetchSessions } = useQuery<DesignSession[]>({
    queryKey: ["web-designer-sessions"],
    queryFn: () => fetch(`${API}/web-designer/sessions`, { credentials: "include" }).then(r => r.json()),
  });

  const { data: projects = [] } = useQuery<Project[]>({
    queryKey: ["projects-list-designer"],
    queryFn: () => fetch(`${API}/projects`, { credentials: "include" }).then(d => d.json()).then(d => Array.isArray(d) ? d : d.projects ?? []),
  });

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [history, streamText]);

  const updateIframe = useCallback((html: string) => {
    if (!iframeRef.current) return;
    try { iframeRef.current.srcdoc = html; } catch { }
  }, []);

  useEffect(() => { if (currentHtml) updateIframe(currentHtml); }, [currentHtml, updateIframe]);

  async function generate(promptText: string) {
    if (!promptText.trim() || isGenerating) return;
    setIsGenerating(true);
    setError("");
    setStreamText("");

    const newHistory = [...history, { role: "user", content: promptText }];
    setHistory(newHistory);
    setPrompt("");

    const ctrl = new AbortController();
    abortRef.current = ctrl;

    try {
      const res = await fetch(`${API}/web-designer/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        signal: ctrl.signal,
        body: JSON.stringify({
          prompt: promptText,
          currentHtml,
          model,
          history: newHistory.slice(-8),
          sessionId: sessionId || undefined,
          projectId,
        }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const reader = res.body!.getReader();
      const dec = new TextDecoder();
      let buf = "";
      let accumulated = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += dec.decode(value, { stream: true });
        const parts = buf.split("\n\n");
        buf = parts.pop() ?? "";
        for (const part of parts) {
          if (!part.startsWith("data: ")) continue;
          try {
            const ev = JSON.parse(part.slice(6));
            if (ev.chunk) {
              accumulated += ev.chunk;
              setStreamText(accumulated);
              if (accumulated.includes("</html>")) updateIframe(accumulated);
            }
            if (ev.done && ev.html) {
              setCurrentHtml(ev.html);
              updateIframe(ev.html);
              if (ev.sessionId) setSessionId(ev.sessionId);
              setStreamText("");
              setHistory(h => [...h, { role: "assistant", content: "✓ Página generada (" + ev.html.length.toLocaleString() + " chars)" }]);
              void refetchSessions();
            }
            if (ev.error) setError(ev.error);
          } catch {}
        }
      }
    } catch (e: any) {
      if (e.name !== "AbortError") setError(e.message ?? "Error generando");
    } finally {
      setIsGenerating(false);
      abortRef.current = null;
      setStreamText("");
    }
  }

  function loadTemplate(t: DesignerTemplate | EffectTemplate) {
    setPrompt(t.prompt);
    setRightPanel("chat");
    promptRef.current?.focus();
  }

  function loadSession(s: DesignSession) {
    setSessionId(s.id);
    setCurrentHtml(s.currentHtml);
    setHistory(s.history);
    setModel(s.model);
    updateIframe(s.currentHtml);
  }

  function loadDemo(d: DemoItem) {
    setPrompt(`Recrear esta página de demo: "${d.name}". Estilo: ${d.category}. Genera una página similar con HTML/CSS/JS completo, misma categoría visual pero con el DNA de marca aplicado.`);
    setRightPanel("chat");
    promptRef.current?.focus();
  }

  async function deployHtml() {
    if (!currentHtml || !projectId) { setDeployMsg("Selecciona un proyecto primero"); return; }
    setDeployMsg("Desplegando…");
    try {
      const res = await fetch(`${API}/web-designer/deploy`, {
        method: "POST", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ html: currentHtml, projectId, pageName: "design", sessionId }),
      });
      const d = await res.json();
      setDeployMsg(d.success ? "✓ " + d.message : "✗ " + (d.error ?? "Error"));
    } catch (e: any) { setDeployMsg("✗ " + e.message); }
    setTimeout(() => setDeployMsg(""), 4000);
  }

  async function handleImportUrl() {
    if (!importUrl.trim()) return;
    setImportLoading(true);
    setImportError("");
    try {
      const res = await fetch(`${API}/web-designer/import-url`, {
        method: "POST", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: importUrl }),
      });
      const d = await res.json();
      if (!d.ok) throw new Error(d.error ?? "Error al importar");
      setCurrentHtml(d.html);
      updateIframe(d.html);
      setShowImportModal(false);
      setImportUrl("");
      setPrompt(`Esta es la página importada de ${importUrl}. ¿Cómo quieres modificarla?`);
      setRightPanel("chat");
    } catch (e: any) {
      setImportError(e.message);
    } finally {
      setImportLoading(false);
    }
  }

  const st = {
    bg: "#0a0a0f", surface: "#111118", surface2: "#1a1a26",
    border: "rgba(255,255,255,.07)", gold: "#c9a961", jade: "#2a7a4b",
    t1: "#e2e2ec", t2: "rgba(255,255,255,.5)", t3: "rgba(255,255,255,.25)",
  };

  const LEFT_TABS = [
    { id: "templates", label: "Plantillas" },
    { id: "effects", label: "FX" },
    { id: "sessions", label: "Historial" },
    { id: "demos", label: "Demos" },
  ] as const;

  // Group effects by category
  const effectsByCategory = effects.reduce<Record<string, EffectTemplate[]>>((acc, e) => {
    const cat = e.category ?? "otros";
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(e);
    return acc;
  }, {});

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100vh", background: st.bg, color: st.t1, fontFamily: "Inter,sans-serif", overflow: "hidden" }}>

      {/* ── Import URL Modal ── */}
      {showImportModal && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.7)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100 }} onClick={e => { if (e.target === e.currentTarget) setShowImportModal(false); }}>
          <div style={{ background: st.surface, border: `1px solid ${st.border}`, borderRadius: 12, padding: 24, width: 440, maxWidth: "90vw" }}>
            <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 4 }}>🔗 Importar URL</div>
            <div style={{ fontSize: 12, color: st.t3, marginBottom: 16 }}>Importa cualquier página web para editarla con IA</div>
            <input
              value={importUrl}
              onChange={e => setImportUrl(e.target.value)}
              onKeyDown={e => e.key === "Enter" && void handleImportUrl()}
              placeholder="https://ejemplo.com"
              autoFocus
              style={{ width: "100%", padding: "10px 12px", background: st.surface2, border: `1px solid ${st.border}`, borderRadius: 8, color: st.t1, fontSize: 13, outline: "none", boxSizing: "border-box", marginBottom: 8 }}
            />
            {importError && <div style={{ color: "#fca5a5", fontSize: 12, marginBottom: 8 }}>✗ {importError}</div>}
            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
              <button onClick={() => { setShowImportModal(false); setImportError(""); }} style={{ padding: "8px 16px", background: "transparent", border: `1px solid ${st.border}`, borderRadius: 6, color: st.t2, fontSize: 12, cursor: "pointer" }}>Cancelar</button>
              <button onClick={() => void handleImportUrl()} disabled={importLoading || !importUrl.trim()} style={{ padding: "8px 16px", background: importUrl.trim() ? "rgba(201,169,97,.2)" : "transparent", border: `1px solid ${importUrl.trim() ? "rgba(201,169,97,.5)" : st.border}`, borderRadius: 6, color: importUrl.trim() ? st.gold : st.t3, fontSize: 12, fontWeight: 600, cursor: importUrl.trim() ? "pointer" : "not-allowed" }}>
                {importLoading ? "Importando…" : "↗ Importar"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Top bar ── */}
      <div style={{ height: 48, background: st.surface, borderBottom: `1px solid ${st.border}`, display: "flex", alignItems: "center", gap: 10, padding: "0 14px", flexShrink: 0, zIndex: 10 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, fontWeight: 700, fontSize: 14 }}>
          <span style={{ fontSize: 18 }}>🎨</span>
          <span>AI Web <span style={{ color: st.gold }}>Designer</span></span>
        </div>
        <div style={{ width: 1, height: 20, background: st.border }} />
        <select value={model} onChange={e => setModel(e.target.value)} style={{ background: st.surface2, border: `1px solid ${st.border}`, borderRadius: 6, padding: "4px 8px", color: st.t1, fontSize: 12, outline: "none", cursor: "pointer" }}>
          {MODELS.map(m => <option key={m.id} value={m.id}>{m.label}</option>)}
        </select>
        <select value={projectId ?? ""} onChange={e => setProjectId(e.target.value ? Number(e.target.value) : undefined)} style={{ background: st.surface2, border: `1px solid ${st.border}`, borderRadius: 6, padding: "4px 8px", color: projectId ? st.t1 : st.t2, fontSize: 12, outline: "none", cursor: "pointer" }}>
          <option value="">Sin proyecto (DNA genérico)</option>
          {projects.map((p: Project) => <option key={p.id} value={p.id}>🏪 {p.name}</option>)}
        </select>
        <button onClick={() => setShowImportModal(true)} title="Importar página desde URL" style={{ padding: "5px 10px", background: "transparent", border: `1px solid ${st.border}`, borderRadius: 6, color: st.t2, fontSize: 11, cursor: "pointer", whiteSpace: "nowrap" }}>
          🔗 Import URL
        </button>
        <div style={{ marginLeft: "auto", display: "flex", gap: 8, alignItems: "center" }}>
          {deployMsg && <span style={{ fontSize: 12, color: deployMsg.startsWith("✓") ? "#22c55e" : deployMsg.startsWith("✗") ? "#ef4444" : st.t2 }}>{deployMsg}</span>}
          <button onClick={deployHtml} disabled={!currentHtml} style={{ padding: "5px 14px", background: currentHtml ? `rgba(201,169,97,.15)` : "transparent", border: `1px solid ${currentHtml ? "rgba(201,169,97,.4)" : st.border}`, borderRadius: 6, color: currentHtml ? st.gold : st.t3, fontSize: 12, fontWeight: 600, cursor: currentHtml ? "pointer" : "not-allowed" }}>
            ↗ Bóveda
          </button>
          {currentHtml && (
            <button onClick={() => { const b = new Blob([currentHtml], { type: "text/html" }); const u = URL.createObjectURL(b); const a = document.createElement("a"); a.href = u; a.download = "design.html"; a.click(); URL.revokeObjectURL(u); }} style={{ padding: "5px 10px", background: st.surface2, border: `1px solid ${st.border}`, borderRadius: 6, color: st.t1, fontSize: 12, cursor: "pointer" }}>
              ⬇ HTML
            </button>
          )}
        </div>
      </div>

      <div style={{ flex: 1, display: "flex", overflow: "hidden" }}>
        {/* ── Left sidebar ── */}
        <div style={{ width: 240, flexShrink: 0, background: st.surface, borderRight: `1px solid ${st.border}`, display: "flex", flexDirection: "column", overflow: "hidden" }}>
          <div style={{ display: "flex", borderBottom: `1px solid ${st.border}`, flexShrink: 0 }}>
            {LEFT_TABS.map(tab => (
              <button key={tab.id} onClick={() => setLeftTab(tab.id)} style={{ flex: 1, padding: "9px 2px", background: leftTab === tab.id ? `rgba(201,169,97,.1)` : "transparent", border: "none", borderBottom: leftTab === tab.id ? `2px solid ${st.gold}` : "2px solid transparent", color: leftTab === tab.id ? st.gold : st.t2, fontSize: 10, fontWeight: leftTab === tab.id ? 600 : 400, cursor: "pointer", transition: "all .15s" }}>
                {tab.label}
              </button>
            ))}
          </div>
          <div style={{ flex: 1, overflowY: "auto", padding: 8 }}>

            {/* Templates tab */}
            {leftTab === "templates" && (
              <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                {["landing", "dashboard", "3d", "form", "app"].map(cat => {
                  const catTemplates = templates.filter(t => t.category === cat);
                  if (!catTemplates.length) return null;
                  return (
                    <div key={cat}>
                      <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: ".1em", textTransform: "uppercase", color: st.t3, padding: "8px 6px 4px" }}>{cat}</div>
                      {catTemplates.map(t => (
                        <button key={t.id} onClick={() => loadTemplate(t)} style={{ width: "100%", display: "flex", alignItems: "center", gap: 8, padding: "7px 8px", borderRadius: 6, border: "none", background: "transparent", color: st.t1, fontSize: 12, cursor: "pointer", textAlign: "left", transition: "background .12s" }}
                          onMouseEnter={e => e.currentTarget.style.background = "rgba(255,255,255,.05)"}
                          onMouseLeave={e => e.currentTarget.style.background = "transparent"}
                        >
                          <span style={{ fontSize: 16 }}>{t.icon}</span>
                          <span style={{ lineHeight: 1.3 }}>{t.name}</span>
                        </button>
                      ))}
                    </div>
                  );
                })}
              </div>
            )}

            {/* Effects tab */}
            {leftTab === "effects" && (
              <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                <div style={{ fontSize: 11, color: st.t3, padding: "4px 6px 8px", lineHeight: 1.5 }}>
                  {effects.length} plantillas FX — efectos visuales, 3D y animaciones premium
                </div>
                {Object.keys(effectsByCategory).sort().map(cat => (
                  <div key={cat}>
                    <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: ".1em", textTransform: "uppercase", color: st.t3, padding: "8px 6px 4px" }}>{cat}</div>
                    {effectsByCategory[cat].map(e => (
                      <button key={e.id} onClick={() => loadTemplate(e)} style={{ width: "100%", display: "flex", alignItems: "flex-start", gap: 8, padding: "7px 8px", borderRadius: 6, border: "none", background: "transparent", color: st.t1, fontSize: 12, cursor: "pointer", textAlign: "left", transition: "background .12s" }}
                        onMouseEnter={el => el.currentTarget.style.background = "rgba(255,255,255,.05)"}
                        onMouseLeave={el => el.currentTarget.style.background = "transparent"}
                      >
                        <span style={{ fontSize: 16, flexShrink: 0 }}>{e.icon ?? "✨"}</span>
                        <div>
                          <div style={{ lineHeight: 1.3 }}>{e.name}</div>
                          {e.description && <div style={{ fontSize: 10, color: st.t3, marginTop: 1, lineHeight: 1.4 }}>{e.description}</div>}
                        </div>
                      </button>
                    ))}
                  </div>
                ))}
                {effects.length === 0 && <div style={{ fontSize: 12, color: st.t3, padding: "8px 0" }}>Cargando efectos…</div>}
              </div>
            )}

            {/* Sessions tab */}
            {leftTab === "sessions" && (
              <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                <button onClick={() => { setSessionId(""); setCurrentHtml(""); setHistory([]); updateIframe(""); }} style={{ width: "100%", padding: "7px 8px", borderRadius: 6, border: `1px dashed ${st.border}`, background: "transparent", color: st.t2, fontSize: 12, cursor: "pointer", textAlign: "left", marginBottom: 6 }}>
                  ＋ Nueva sesión
                </button>
                {sessions.length === 0 && <div style={{ fontSize: 12, color: st.t3, padding: "8px 0" }}>Sin sesiones aún. Genera tu primera página.</div>}
                {sessions.map(s => (
                  <button key={s.id} onClick={() => loadSession(s)} style={{ width: "100%", padding: "8px", borderRadius: 6, border: `1px solid ${s.id === sessionId ? "rgba(201,169,97,.4)" : st.border}`, background: s.id === sessionId ? "rgba(201,169,97,.08)" : "transparent", color: st.t1, fontSize: 12, cursor: "pointer", textAlign: "left", transition: "all .12s" }}
                    onMouseEnter={e => { if (s.id !== sessionId) e.currentTarget.style.background = "rgba(255,255,255,.04)"; }}
                    onMouseLeave={e => { if (s.id !== sessionId) e.currentTarget.style.background = "transparent"; }}
                  >
                    <div style={{ fontWeight: 600, marginBottom: 2, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{s.title || "Sin título"}</div>
                    <div style={{ fontSize: 10, color: st.t3 }}>{new Date(s.updatedAt).toLocaleDateString("es-ES")}</div>
                  </button>
                ))}
              </div>
            )}

            {/* Demos tab */}
            {leftTab === "demos" && (
              <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                <div style={{ fontSize: 11, color: st.t3, padding: "4px 6px 8px" }}>26 páginas de referencia generadas con IA — úsalas como inspiración</div>
                {demos.map(d => (
                  <button key={d.id} onClick={() => loadDemo(d)} style={{ width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between", padding: "7px 8px", borderRadius: 6, border: "none", background: "transparent", color: st.t1, fontSize: 12, cursor: "pointer", textAlign: "left", transition: "background .12s" }}
                    onMouseEnter={e => e.currentTarget.style.background = "rgba(255,255,255,.05)"}
                    onMouseLeave={e => e.currentTarget.style.background = "transparent"}
                  >
                    <span>{d.id}. {d.name}</span>
                    <span style={{ fontSize: 10, background: "rgba(255,255,255,.07)", padding: "1px 6px", borderRadius: 100, color: st.t3, flexShrink: 0 }}>{d.category}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* ── Center: Preview ── */}
        <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden", background: "#111" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 12px", background: st.surface, borderBottom: `1px solid ${st.border}`, flexShrink: 0 }}>
            <span style={{ fontSize: 12, color: st.t2, fontWeight: 600 }}>PREVIEW</span>
            <div style={{ display: "flex", gap: 4, marginLeft: 8 }}>
              {(["desktop", "tablet", "mobile"] as const).map(v => (
                <button key={v} onClick={() => setViewport(v)} style={{ padding: "4px 10px", borderRadius: 6, border: `1px solid ${viewport === v ? `rgba(201,169,97,.5)` : st.border}`, background: viewport === v ? `rgba(201,169,97,.12)` : "transparent", color: viewport === v ? st.gold : st.t2, fontSize: 11, cursor: "pointer" }}>
                  {v === "desktop" ? "🖥" : v === "tablet" ? "📲" : "📱"}
                </button>
              ))}
            </div>
            {currentHtml && (
              <button onClick={() => { const w = window.open(); if (w) { w.document.write(currentHtml); w.document.close(); } }} style={{ marginLeft: "auto", padding: "4px 10px", borderRadius: 6, border: `1px solid ${st.border}`, background: "transparent", color: st.t2, fontSize: 11, cursor: "pointer" }}>
                ↗ Abrir
              </button>
            )}
            {isGenerating && <div style={{ marginLeft: currentHtml ? 0 : "auto", fontSize: 12, color: st.gold }}>⚡ Generando…</div>}
          </div>
          <div style={{ flex: 1, display: "flex", alignItems: "flex-start", justifyContent: "center", overflow: "hidden", background: "#0a0a0a", padding: viewport === "desktop" ? 0 : "16px 0" }}>
            {currentHtml || streamText ? (
              <iframe
                ref={iframeRef}
                sandbox="allow-scripts allow-same-origin allow-forms"
                style={{ width: VIEWPORT_WIDTHS[viewport], height: "100%", border: "none", transition: "width .3s ease", background: "#fff" }}
                title="AI Web Designer Preview"
              />
            ) : (
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "100%", gap: 16, color: st.t3 }}>
                <div style={{ fontSize: 48 }}>🎨</div>
                <div style={{ fontSize: 16, fontWeight: 600, color: st.t2 }}>AI Web Designer</div>
                <div style={{ fontSize: 13, textAlign: "center", maxWidth: 360, lineHeight: 1.6 }}>
                  Selecciona una plantilla o efecto en la izquierda, o escribe un prompt en el chat para generar tu primera página web.
                </div>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap", justifyContent: "center", marginTop: 8 }}>
                  {templates.slice(0, 4).map(t => (
                    <button key={t.id} onClick={() => loadTemplate(t)} style={{ padding: "8px 14px", background: "rgba(201,169,97,.1)", border: "1px solid rgba(201,169,97,.3)", borderRadius: 8, color: st.gold, fontSize: 12, cursor: "pointer" }}>
                      {t.icon} {t.name}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* ── Right panel: Chat or Code ── */}
        <div style={{ width: 340, flexShrink: 0, background: st.surface, borderLeft: `1px solid ${st.border}`, display: "flex", flexDirection: "column", overflow: "hidden" }}>
          <div style={{ display: "flex", borderBottom: `1px solid ${st.border}`, flexShrink: 0 }}>
            {(["chat", "code"] as const).map(tab => (
              <button key={tab} onClick={() => setRightPanel(tab)} style={{ flex: 1, padding: "10px 4px", background: rightPanel === tab ? `rgba(201,169,97,.1)` : "transparent", border: "none", borderBottom: rightPanel === tab ? `2px solid ${st.gold}` : "2px solid transparent", color: rightPanel === tab ? st.gold : st.t2, fontSize: 12, fontWeight: rightPanel === tab ? 600 : 400, cursor: "pointer" }}>
                {tab === "chat" ? "💬 Chat" : "💻 Código"}
              </button>
            ))}
          </div>

          {rightPanel === "chat" && (
            <>
              <div style={{ flex: 1, overflowY: "auto", padding: 12, display: "flex", flexDirection: "column", gap: 10 }}>
                {history.length === 0 && !streamText && (
                  <div style={{ fontSize: 12, color: st.t3, textAlign: "center", padding: "20px 0" }}>
                    Escribe un prompt para generar tu página web con IA.<br />
                    Puedes hacer preguntas, pedir ediciones o modificar partes específicas.
                  </div>
                )}
                {history.map((m, i) => (
                  <div key={i} style={{ display: "flex", justifyContent: m.role === "user" ? "flex-end" : "flex-start" }}>
                    <div style={{ maxWidth: "85%", padding: "8px 12px", borderRadius: m.role === "user" ? "12px 12px 2px 12px" : "12px 12px 12px 2px", background: m.role === "user" ? "rgba(201,169,97,.2)" : st.surface2, border: `1px solid ${m.role === "user" ? "rgba(201,169,97,.3)" : st.border}`, fontSize: 12, lineHeight: 1.5, color: st.t1 }}>
                      {m.content}
                    </div>
                  </div>
                ))}
                {streamText && (
                  <div style={{ display: "flex", justifyContent: "flex-start" }}>
                    <div style={{ maxWidth: "85%", padding: "8px 12px", borderRadius: "12px 12px 12px 2px", background: st.surface2, border: `1px solid ${st.border}`, fontSize: 12, lineHeight: 1.5, color: st.t2 }}>
                      ⚡ Generando… ({streamText.length.toLocaleString()} chars)
                    </div>
                  </div>
                )}
                {error && <div style={{ padding: "8px 12px", borderRadius: 8, background: "rgba(239,68,68,.12)", border: "1px solid rgba(239,68,68,.3)", color: "#fca5a5", fontSize: 12 }}>✗ {error}</div>}
                <div ref={chatEndRef} />
              </div>
              <div style={{ padding: 12, borderTop: `1px solid ${st.border}`, flexShrink: 0 }}>
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 8 }}>
                  {["Hacer más premium", "Añadir 3D", "Dark/light toggle", "Sección precios", "Micro-interacciones", "Animaciones GSAP"].map(q => (
                    <button key={q} onClick={() => setPrompt(q)} style={{ padding: "3px 8px", borderRadius: 100, border: `1px solid ${st.border}`, background: "transparent", color: st.t3, fontSize: 10, cursor: "pointer" }}
                      onMouseEnter={e => e.currentTarget.style.color = st.t1}
                      onMouseLeave={e => e.currentTarget.style.color = st.t3}
                    >{q}</button>
                  ))}
                </div>
                <textarea
                  ref={promptRef}
                  value={prompt}
                  onChange={e => setPrompt(e.target.value)}
                  onKeyDown={e => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) { e.preventDefault(); void generate(prompt); } }}
                  placeholder="Describe la página que quieres crear, o pide editar algo específico…"
                  disabled={isGenerating}
                  style={{ width: "100%", minHeight: 80, padding: "10px 12px", background: st.surface2, border: `1px solid ${st.border}`, borderRadius: 8, color: st.t1, fontSize: 12, resize: "vertical", outline: "none", fontFamily: "inherit", lineHeight: 1.5, boxSizing: "border-box" }}
                />
                <div style={{ display: "flex", gap: 6, marginTop: 6 }}>
                  {isGenerating ? (
                    <button onClick={() => abortRef.current?.abort()} style={{ flex: 1, padding: "8px", background: "rgba(239,68,68,.15)", border: "1px solid rgba(239,68,68,.3)", borderRadius: 6, color: "#fca5a5", fontSize: 12, fontWeight: 600, cursor: "pointer" }}>
                      ⏹ Detener
                    </button>
                  ) : (
                    <button onClick={() => void generate(prompt)} disabled={!prompt.trim()} style={{ flex: 1, padding: "8px", background: prompt.trim() ? "linear-gradient(135deg,#c9a961,#b8860b)" : st.surface2, border: "none", borderRadius: 6, color: prompt.trim() ? "#000" : st.t3, fontSize: 12, fontWeight: 700, cursor: prompt.trim() ? "pointer" : "not-allowed" }}>
                      ⚡ Generar (⌘↵)
                    </button>
                  )}
                </div>
              </div>
            </>
          )}

          {rightPanel === "code" && (
            <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
              <div style={{ display: "flex", gap: 6, padding: "8px 12px", borderBottom: `1px solid ${st.border}`, flexShrink: 0 }}>
                <button onClick={() => { if (currentHtml) navigator.clipboard.writeText(currentHtml); }} disabled={!currentHtml} style={{ padding: "4px 12px", background: "transparent", border: `1px solid ${st.border}`, borderRadius: 6, color: currentHtml ? st.t1 : st.t3, fontSize: 11, cursor: currentHtml ? "pointer" : "not-allowed" }}>
                  📋 Copiar
                </button>
                <span style={{ fontSize: 11, color: st.t3, marginLeft: "auto", alignSelf: "center" }}>
                  {currentHtml ? `${currentHtml.length.toLocaleString()} chars` : "Sin código aún"}
                </span>
              </div>
              <textarea
                value={currentHtml}
                onChange={e => setCurrentHtml(e.target.value)}
                onBlur={() => updateIframe(currentHtml)}
                placeholder="El HTML generado aparecerá aquí. Puedes editarlo directamente."
                style={{ flex: 1, padding: 12, background: st.surface2, border: "none", color: "#a8b4d8", fontSize: 11, fontFamily: "JetBrains Mono, monospace", resize: "none", outline: "none", lineHeight: 1.6 }}
              />
              {currentHtml && (
                <div style={{ padding: "8px 12px", borderTop: `1px solid ${st.border}`, flexShrink: 0 }}>
                  <button onClick={() => updateIframe(currentHtml)} style={{ width: "100%", padding: "8px", background: "rgba(34,197,94,.12)", border: "1px solid rgba(34,197,94,.3)", borderRadius: 6, color: "#22c55e", fontSize: 12, fontWeight: 600, cursor: "pointer" }}>
                    👁 Actualizar Preview
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
