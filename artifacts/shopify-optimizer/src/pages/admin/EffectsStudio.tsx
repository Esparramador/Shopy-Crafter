import { useState, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { useParams } from "wouter";

const API = import.meta.env.BASE_URL.replace(/\/$/, "") + "/api";

interface EffectItem {
  id: string; name: string; category: string; description: string;
  source: "builtin" | "visme"; libs?: string[]; hasJs?: boolean; previewCss?: string;
  icon?: string; tags?: string[]; prompt?: string;
}
interface VismeTemplate {
  id: string; name: string; icon: string; category: string;
  tags: string[]; description: string; prompt: string;
}
interface DnaVars {
  name: string; sector: string; font: string; primary: string; secondary: string;
  bg: string; surface: string; text: string; headline: string; tagline: string; cta: string;
}
interface SnippetDetail {
  id: string; name: string; html: string; css: string; js: string; previewHtml: string; dna: DnaVars;
}
interface Project { id: number; name: string; }
interface StatsResponse { builtinSnippets: number; vismeTemplates: number; categories: number; snippetCategories: string[]; vismeCategories: string[]; }

type ActiveSource = "builtin" | "visme";

const VISME_CAT_LABELS: Record<string, string> = {
  "3d_effects": "Efectos 3D", "animated_characters": "Personajes", "animated_icons": "Iconos",
  "background_effects": "Fondos", "charts": "Gráficos", "data_viz": "Data Viz",
  "forms_surveys": "Formularios", "infographics": "Infografías", "landing_pages": "Landings",
  "micro_interactions": "Micro-Interactions", "motion_graphics": "Motion Graphics",
  "particle_effects": "Partículas", "presentations": "Presentaciones", "social_media": "Social Media",
  "text_effects": "Texto", "transition_effects": "Transiciones", "typography_effects": "Tipografía",
  "ui_components": "Componentes UI", "video_effects": "Video", "web_graphics": "Web Graphics",
};
const SNIPPET_CAT_LABELS: Record<string, string> = {
  "particle_effects": "Partículas", "background_effects": "Fondos", "micro_interactions": "Micro-Interactions",
  "text_effects": "Texto", "cards": "Tarjetas", "3d_effects": "Efectos 3D",
  "typography_effects": "Tipografía", "logo_animations": "Logos", "celebration_effects": "Celebración",
  "animated_icons": "Iconos", "loaders": "Loaders", "scroll_indicators": "Scroll",
  "charts": "Contadores", "transition_effects": "Transiciones", "interactive_effects": "Interactivo",
  "parallax_effects": "Parallax",
};

export default function EffectsStudio() {
  const params = useParams<{ id?: string }>();
  const urlProjectId = params.id ? Number(params.id) : undefined;

  const [projectId, setProjectId] = useState<number | undefined>(urlProjectId);
  const [source, setSource] = useState<ActiveSource>("builtin");
  const [category, setCategory] = useState("all");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<EffectItem | null>(null);
  const [snippetDetail, setSnippetDetail] = useState<SnippetDetail | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [generatePrompt, setGeneratePrompt] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedHtml, setGeneratedHtml] = useState("");
  const [copied, setCopied] = useState("");
  const [composing, setComposing] = useState<EffectItem[]>([]);

  const { data: stats } = useQuery<StatsResponse>({
    queryKey: ["visme-stats"],
    queryFn: () => fetch(`${API}/visme/stats`, { credentials: "include" }).then(r => r.json()),
  });
  const { data: projects = [] } = useQuery<Project[]>({
    queryKey: ["projects-list-effects"],
    queryFn: () => fetch(`${API}/projects`, { credentials: "include" }).then(r => r.json()).then(d => Array.isArray(d) ? d : d.projects ?? []),
  });

  const { data: snippetsData } = useQuery({
    queryKey: ["visme-snippets", category, search, projectId],
    queryFn: () => {
      const p = new URLSearchParams({ category, search, ...(projectId ? { projectId: String(projectId) } : {}) });
      return fetch(`${API}/visme/snippets?${p}`, { credentials: "include" }).then(r => r.json());
    },
    enabled: source === "builtin",
  });
  const { data: templatesData, isLoading: loadingTemplates } = useQuery({
    queryKey: ["visme-templates", category, search, page],
    queryFn: () => {
      const p = new URLSearchParams({ category, search, page: String(page), limit: "24" });
      return fetch(`${API}/visme/templates?${p}`, { credentials: "include" }).then(r => r.json());
    },
    enabled: source === "visme",
  });

  const snippets: EffectItem[] = (snippetsData?.items ?? []).map((s: any) => ({ ...s, source: "builtin" as const }));
  const vismeItems: EffectItem[] = (templatesData?.items ?? []).map((t: VismeTemplate) => ({
    id: t.id, name: t.name, icon: t.icon, category: t.category, description: t.description, source: "visme" as const, tags: t.tags, prompt: t.prompt,
  }));
  const items = source === "builtin" ? snippets : vismeItems;

  const loadSnippetDetail = useCallback(async (item: EffectItem) => {
    if (item.source !== "builtin") { setSnippetDetail(null); return; }
    setLoadingDetail(true);
    try {
      const p = new URLSearchParams(projectId ? { projectId: String(projectId) } : {});
      const d = await fetch(`${API}/visme/snippets/${item.id}?${p}`, { credentials: "include" }).then(r => r.json());
      setSnippetDetail(d);
    } catch { /* ignore */ }
    setLoadingDetail(false);
  }, [projectId]);

  async function generateEffect() {
    if (!generatePrompt.trim() || isGenerating) return;
    setIsGenerating(true);
    setGeneratedHtml("");
    try {
      const res = await fetch(`${API}/visme/generate`, {
        method: "POST", credentials: "include", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: generatePrompt, projectId }),
      });
      const reader = res.body!.getReader();
      const dec = new TextDecoder();
      let buf = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += dec.decode(value, { stream: true });
        const parts = buf.split("\n\n");
        buf = parts.pop() ?? "";
        for (const p of parts) {
          if (!p.startsWith("data: ")) continue;
          try {
            const ev = JSON.parse(p.slice(6));
            if (ev.done && ev.html) setGeneratedHtml(ev.html);
          } catch {}
        }
      }
    } catch (e: any) { console.error(e); }
    setIsGenerating(false);
  }

  function copyCode(code: string, key: string) {
    navigator.clipboard.writeText(code);
    setCopied(key);
    setTimeout(() => setCopied(""), 2000);
  }

  const st = { bg: "#0a0a0f", surface: "#111118", surface2: "#1a1a26", border: "rgba(255,255,255,.07)", gold: "#c9a961", jade: "#2a7a4b", t1: "#e2e2ec", t2: "rgba(255,255,255,.5)", t3: "rgba(255,255,255,.25)" };

  const cats = source === "builtin"
    ? (stats?.snippetCategories ?? [])
    : (stats?.vismeCategories ?? []).slice(0, 40);

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100vh", background: st.bg, color: st.t1, fontFamily: "Inter,sans-serif", overflow: "hidden" }}>
      {/* ── Top bar ── */}
      <div style={{ height: 48, background: st.surface, borderBottom: `1px solid ${st.border}`, display: "flex", alignItems: "center", gap: 12, padding: "0 16px", flexShrink: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, fontWeight: 700, fontSize: 14 }}>
          <span style={{ fontSize: 18 }}>✦</span>
          <span>Effects <span style={{ color: st.gold }}>Studio</span></span>
        </div>
        <div style={{ display: "flex", gap: 4, marginLeft: 8 }}>
          {(["builtin", "visme"] as const).map(s => (
            <button key={s} onClick={() => { setSource(s); setCategory("all"); setSearch(""); setPage(1); setSelected(null); setSnippetDetail(null); }} style={{ padding: "4px 14px", borderRadius: 100, border: `1px solid ${source === s ? "rgba(201,169,97,.5)" : st.border}`, background: source === s ? "rgba(201,169,97,.12)" : "transparent", color: source === s ? st.gold : st.t2, fontSize: 12, fontWeight: source === s ? 600 : 400, cursor: "pointer" }}>
              {s === "builtin" ? `⚡ 30 Snippets` : `✦ ${stats?.vismeTemplates ?? 594} Visme`}
            </button>
          ))}
        </div>
        <div style={{ position: "relative", flex: 1, maxWidth: 280 }}>
          <input value={search} onChange={e => { setSearch(e.target.value); setPage(1); }} placeholder="Buscar efectos…" style={{ width: "100%", background: st.surface2, border: `1px solid ${st.border}`, borderRadius: 6, padding: "5px 10px 5px 28px", color: st.t1, fontSize: 12, outline: "none", boxSizing: "border-box" }} />
          <span style={{ position: "absolute", left: 9, top: "50%", transform: "translateY(-50%)", color: st.t3, fontSize: 13 }}>⌕</span>
        </div>
        {composing.length > 0 && (
          <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "4px 12px", background: "rgba(201,169,97,.1)", border: "1px solid rgba(201,169,97,.3)", borderRadius: 20, fontSize: 12, color: st.gold }}>
            <span style={{ width: 20, height: 20, background: st.gold, color: "#000", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, fontSize: 11, flexShrink: 0 }}>{composing.length}</span>
            <span>seleccionados</span>
            <button onClick={() => setComposing([])} style={{ background: "transparent", border: "none", color: st.t3, cursor: "pointer", padding: "0 2px", fontSize: 12 }}>✕</button>
          </div>
        )}
        <div style={{ marginLeft: "auto", display: "flex", gap: 8, alignItems: "center" }}>
          <select value={projectId ?? ""} onChange={e => setProjectId(e.target.value ? Number(e.target.value) : undefined)} style={{ background: st.surface2, border: `1px solid ${st.border}`, borderRadius: 6, padding: "4px 8px", color: projectId ? st.t1 : st.t2, fontSize: 12, outline: "none", cursor: "pointer" }}>
            <option value="">Sin proyecto (DNA genérico)</option>
            {projects.map((p: Project) => <option key={p.id} value={p.id}>🏪 {p.name}</option>)}
          </select>
        </div>
      </div>

      <div style={{ flex: 1, display: "flex", overflow: "hidden" }}>
        {/* ── Sidebar: categories ── */}
        <div style={{ width: 200, flexShrink: 0, background: st.surface, borderRight: `1px solid ${st.border}`, overflowY: "auto", padding: "8px 0" }}>
          <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: ".12em", textTransform: "uppercase", color: st.t3, padding: "6px 14px 4px" }}>Categorías</div>
          <button onClick={() => { setCategory("all"); setPage(1); }} style={{ width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between", padding: "6px 14px", border: "none", background: category === "all" ? "rgba(201,169,97,.1)" : "transparent", color: category === "all" ? st.gold : st.t2, fontSize: 12, cursor: "pointer", textAlign: "left" }}>
            <span>Todos</span>
            <span style={{ fontSize: 10, background: "rgba(255,255,255,.06)", padding: "1px 6px", borderRadius: 100, color: st.t3 }}>
              {source === "builtin" ? stats?.builtinSnippets : stats?.vismeTemplates}
            </span>
          </button>
          {cats.map((cat: string) => (
            <button key={cat} onClick={() => { setCategory(cat); setPage(1); }} style={{ width: "100%", display: "flex", alignItems: "center", padding: "6px 14px", border: "none", background: category === cat ? "rgba(201,169,97,.1)" : "transparent", color: category === cat ? st.gold : st.t2, fontSize: 12, cursor: "pointer", textAlign: "left" }}>
              <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {source === "builtin" ? (SNIPPET_CAT_LABELS[cat] ?? cat) : (VISME_CAT_LABELS[cat] ?? cat.replace(/_/g, " "))}
              </span>
            </button>
          ))}
        </div>

        {/* ── Main grid ── */}
        <div style={{ flex: 1, overflowY: "auto", padding: 16 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
            <div>
              <span style={{ fontSize: 13, fontWeight: 600 }}>
                {category === "all" ? (source === "builtin" ? "Todos los snippets" : "Todos los templates") : (source === "builtin" ? SNIPPET_CAT_LABELS[category] ?? category : VISME_CAT_LABELS[category] ?? category.replace(/_/g, " "))}
              </span>
              <span style={{ fontSize: 12, color: st.t3, marginLeft: 8 }}>
                {source === "builtin" ? `${snippets.length} efectos` : `${templatesData?.total ?? 0} templates`}
              </span>
            </div>
            {source === "visme" && templatesData && templatesData.pages > 1 && (
              <div style={{ display: "flex", gap: 4 }}>
                <button onClick={() => setPage(p => Math.max(1, p-1))} disabled={page === 1} style={{ padding: "3px 10px", background: "transparent", border: `1px solid ${st.border}`, borderRadius: 4, color: st.t2, fontSize: 11, cursor: "pointer" }}>‹</button>
                <span style={{ fontSize: 11, color: st.t3, padding: "4px 8px" }}>{page}/{templatesData.pages}</span>
                <button onClick={() => setPage(p => Math.min(templatesData.pages, p+1))} disabled={page === templatesData.pages} style={{ padding: "3px 10px", background: "transparent", border: `1px solid ${st.border}`, borderRadius: 4, color: st.t2, fontSize: 11, cursor: "pointer" }}>›</button>
              </div>
            )}
          </div>

          {loadingTemplates && <div style={{ color: st.t3, fontSize: 13, padding: "20px 0" }}>⏳ Cargando templates…</div>}

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(200px,1fr))", gap: 12 }}>
            {items.map(item => {
              const isSelected = selected?.id === item.id;
              const isComposing = composing.some(c => c.id === item.id);
              return (
                <div key={item.id} onClick={() => { setSelected(isSelected ? null : item); if (!isSelected) void loadSnippetDetail(item); setGeneratedHtml(""); }} style={{ background: st.surface, border: `1px solid ${isSelected ? "rgba(201,169,97,.5)" : isComposing ? "rgba(42,122,75,.5)" : st.border}`, borderRadius: 12, padding: 16, cursor: "pointer", transition: "all .2s", position: "relative", ...(isSelected ? { background: "rgba(201,169,97,.06)" } : {}) }}
                  onMouseEnter={e => { if (!isSelected) e.currentTarget.style.borderColor = "rgba(201,169,97,.3)"; e.currentTarget.style.transform = "translateY(-2px)"; }}
                  onMouseLeave={e => { if (!isSelected) e.currentTarget.style.borderColor = isComposing ? "rgba(42,122,75,.5)" : st.border; e.currentTarget.style.transform = "translateY(0)"; }}
                >
                  <div style={{ position: "absolute", top: 8, right: 8, fontSize: 9, fontWeight: 700, textTransform: "uppercase", padding: "2px 6px", borderRadius: 100, background: item.source === "builtin" ? "rgba(34,197,94,.15)" : "rgba(99,102,241,.15)", color: item.source === "builtin" ? "#22c55e" : "#818cf8" }}>
                    {item.source === "builtin" ? "snippet" : "visme"}
                  </div>
                  {item.icon && <div style={{ fontSize: 20, marginBottom: 8 }}>{item.icon}</div>}
                  <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 4, lineHeight: 1.3, paddingRight: 40 }}>{item.name}</div>
                  <div style={{ fontSize: 11, color: st.t3, lineHeight: 1.4, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>{item.description}</div>
                  {item.tags && item.tags.length > 0 && (
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 3, marginTop: 8 }}>
                      {item.tags.slice(0, 3).map(tag => (
                        <span key={tag} style={{ fontSize: 10, background: "rgba(255,255,255,.05)", color: st.t3, padding: "1px 6px", borderRadius: 4 }}>{tag}</span>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* ── AI Custom Generator ── */}
          <div style={{ marginTop: 32, padding: 24, background: st.surface, border: `1px solid rgba(201,169,97,.2)`, borderRadius: 16 }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: st.gold, marginBottom: 4 }}>⚡ Generar Efecto Personalizado con IA</div>
            <div style={{ fontSize: 12, color: st.t3, marginBottom: 14 }}>Describe el efecto que quieres y Claude lo generará con tu Brand DNA aplicado automáticamente</div>
            <div style={{ display: "flex", gap: 8 }}>
              <input value={generatePrompt} onChange={e => setGeneratePrompt(e.target.value)} onKeyDown={e => e.key === "Enter" && void generateEffect()} placeholder="Ej: partículas de oro flotando que reaccionan al cursor, tarjeta de producto 3D con vidrio, marquee con logos de clientes…" style={{ flex: 1, background: st.surface2, border: `1px solid ${st.border}`, borderRadius: 8, padding: "10px 14px", color: st.t1, fontSize: 12, outline: "none", fontFamily: "inherit" }} />
              <button onClick={() => void generateEffect()} disabled={isGenerating || !generatePrompt.trim()} style={{ padding: "10px 20px", background: !isGenerating && generatePrompt.trim() ? "linear-gradient(135deg,#c9a961,#b8860b)" : st.surface2, border: "none", borderRadius: 8, color: !isGenerating && generatePrompt.trim() ? "#000" : st.t3, fontWeight: 700, fontSize: 12, cursor: !isGenerating && generatePrompt.trim() ? "pointer" : "not-allowed", whiteSpace: "nowrap" }}>
                {isGenerating ? "⏳ Generando…" : "✦ Generar"}
              </button>
            </div>
            {generatedHtml && (
              <div style={{ marginTop: 16, borderRadius: 10, overflow: "hidden", border: `1px solid rgba(34,197,94,.3)` }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "8px 12px", background: "rgba(34,197,94,.08)", borderBottom: `1px solid rgba(34,197,94,.2)` }}>
                  <span style={{ fontSize: 12, color: "#22c55e", fontWeight: 600 }}>✓ Efecto generado</span>
                  <div style={{ display: "flex", gap: 6 }}>
                    <button onClick={() => copyCode(generatedHtml, "gen")} style={{ padding: "3px 10px", background: "transparent", border: `1px solid rgba(255,255,255,.15)`, borderRadius: 4, color: st.t1, fontSize: 11, cursor: "pointer" }}>{copied === "gen" ? "✓ Copiado" : "📋 Copiar"}</button>
                    <button onClick={() => { const b = new Blob([generatedHtml], { type: "text/html" }); const u = URL.createObjectURL(b); const a = document.createElement("a"); a.href = u; a.download = "effect.html"; a.click(); URL.revokeObjectURL(u); }} style={{ padding: "3px 10px", background: "transparent", border: `1px solid rgba(255,255,255,.15)`, borderRadius: 4, color: st.t1, fontSize: 11, cursor: "pointer" }}>⬇ HTML</button>
                  </div>
                </div>
                <iframe srcDoc={generatedHtml} sandbox="allow-scripts allow-same-origin" style={{ width: "100%", height: 320, border: "none" }} title="Generated Effect Preview" />
              </div>
            )}
          </div>
        </div>

        {/* ── Detail panel ── */}
        {selected && (
          <div style={{ width: 360, flexShrink: 0, background: st.surface, borderLeft: `1px solid ${st.border}`, display: "flex", flexDirection: "column", overflow: "hidden" }}>
            <div style={{ padding: "14px 16px", borderBottom: `1px solid ${st.border}`, display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 8, flexShrink: 0 }}>
              <div>
                {selected.icon && <span style={{ fontSize: 20, marginRight: 6 }}>{selected.icon}</span>}
                <span style={{ fontSize: 13, fontWeight: 700 }}>{selected.name}</span>
                <div style={{ fontSize: 11, color: st.t3, marginTop: 4, lineHeight: 1.5 }}>{selected.description}</div>
              </div>
              <button onClick={() => { setSelected(null); setSnippetDetail(null); }} style={{ background: "transparent", border: "none", color: st.t3, cursor: "pointer", fontSize: 16, flexShrink: 0, lineHeight: 1 }}>✕</button>
            </div>

            <div style={{ flex: 1, overflowY: "auto" }}>
              {/* Preview */}
              {loadingDetail && <div style={{ padding: 20, color: st.t3, fontSize: 12 }}>⏳ Cargando preview…</div>}
              {snippetDetail && snippetDetail.previewHtml && (
                <div>
                  <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: ".1em", textTransform: "uppercase", color: st.t3, padding: "10px 14px 4px" }}>PREVIEW (DNA aplicado)</div>
                  <iframe srcDoc={snippetDetail.previewHtml} sandbox="allow-scripts allow-same-origin" style={{ width: "100%", height: 220, border: "none", borderBottom: `1px solid ${st.border}` }} title="Effect Preview" />
                </div>
              )}

              {/* Visme prompt */}
              {selected.source === "visme" && selected.prompt && (
                <div style={{ padding: 14 }}>
                  <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: ".1em", textTransform: "uppercase", color: st.t3, marginBottom: 6 }}>PROMPT VISME</div>
                  <div style={{ fontSize: 11, color: st.t2, lineHeight: 1.6, padding: 12, background: st.surface2, borderRadius: 8, border: `1px solid ${st.border}` }}>{selected.prompt}</div>
                  <button onClick={() => copyCode(selected.prompt ?? "", "prompt")} style={{ marginTop: 8, width: "100%", padding: "7px", background: "transparent", border: `1px solid ${st.border}`, borderRadius: 6, color: st.t2, fontSize: 11, cursor: "pointer" }}>
                    {copied === "prompt" ? "✓ Copiado" : "📋 Copiar prompt"}
                  </button>
                </div>
              )}

              {/* Code sections for builtin snippets */}
              {snippetDetail && (
                <div style={{ padding: "0 14px 14px" }}>
                  {[
                    { label: "HTML", code: snippetDetail.html, key: "html", color: "#f59e0b" },
                    { label: "CSS", code: snippetDetail.css, key: "css", color: "#3b82f6" },
                    ...(snippetDetail.js ? [{ label: "JavaScript", code: snippetDetail.js, key: "js", color: "#22c55e" }] : []),
                  ].filter(c => c.code.trim()).map(c => (
                    <div key={c.key} style={{ marginBottom: 10 }}>
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 4 }}>
                        <span style={{ fontSize: 10, fontWeight: 700, color: c.color, letterSpacing: ".1em" }}>{c.label}</span>
                        <button onClick={() => copyCode(c.code, c.key)} style={{ padding: "2px 8px", background: "transparent", border: `1px solid ${st.border}`, borderRadius: 4, color: st.t2, fontSize: 10, cursor: "pointer" }}>
                          {copied === c.key ? "✓" : "📋 Copiar"}
                        </button>
                      </div>
                      <textarea readOnly value={c.code} style={{ width: "100%", height: 90, padding: 8, background: st.surface2, border: `1px solid ${st.border}`, borderRadius: 6, color: "#a8b4d8", fontSize: 10, fontFamily: "JetBrains Mono,monospace", resize: "vertical", boxSizing: "border-box", lineHeight: 1.5, outline: "none" }} />
                    </div>
                  ))}
                </div>
              )}

              {/* Tags */}
              {selected.tags && selected.tags.length > 0 && (
                <div style={{ padding: "0 14px 14px" }}>
                  <div style={{ fontSize: 10, fontWeight: 700, color: st.t3, letterSpacing: ".1em", marginBottom: 6, textTransform: "uppercase" }}>Tags</div>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                    {selected.tags.map(tag => (
                      <span key={tag} style={{ fontSize: 11, background: "rgba(255,255,255,.05)", color: st.t3, padding: "2px 8px", borderRadius: 4 }}>{tag}</span>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Actions */}
            <div style={{ padding: 12, borderTop: `1px solid ${st.border}`, display: "flex", gap: 6, flexShrink: 0 }}>
              {selected.source === "builtin" && snippetDetail && (
                <>
                  <button onClick={() => copyCode(snippetDetail.html + (snippetDetail.css ? `\n<style>${snippetDetail.css}</style>` : "") + (snippetDetail.js ? `\n<script>${snippetDetail.js}</script>` : ""), "all")} style={{ flex: 1, padding: "7px", background: "rgba(201,169,97,.12)", border: "1px solid rgba(201,169,97,.3)", borderRadius: 6, color: st.gold, fontSize: 11, fontWeight: 600, cursor: "pointer" }}>
                    {copied === "all" ? "✓ Copiado" : "📋 Copiar todo"}
                  </button>
                  <button onClick={() => {
                    const b = new Blob([snippetDetail.previewHtml], { type: "text/html" });
                    const u = URL.createObjectURL(b); const a = document.createElement("a"); a.href = u; a.download = `${selected.id}.html`; a.click(); URL.revokeObjectURL(u);
                  }} style={{ padding: "7px 12px", background: st.surface2, border: `1px solid ${st.border}`, borderRadius: 6, color: st.t2, fontSize: 11, cursor: "pointer" }}>⬇</button>
                </>
              )}
              {selected.source === "visme" && (
                <button onClick={() => {
                  setGeneratePrompt(`Generar un componente web usando este concepto de Visme "${selected.name}": ${selected.prompt?.slice(0, 200)}`);
                  setSelected(null);
                }} style={{ flex: 1, padding: "7px", background: "rgba(201,169,97,.12)", border: "1px solid rgba(201,169,97,.3)", borderRadius: 6, color: st.gold, fontSize: 11, fontWeight: 600, cursor: "pointer" }}>
                  ⚡ Generar con IA
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
