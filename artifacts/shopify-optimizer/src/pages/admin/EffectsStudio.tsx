/**
 * Effects Studio — Unified Creative Library
 * Combina: librería maestra de prompts + 101 efectos CSS/JS + 594 plantillas de diseño (prompts propios por categoría)
 * Features: Brand DNA Adapter · AI Generator · Live Preview · Copy/Export
 */
import { useState, useEffect, useCallback, useRef } from "react";
import { useLocation } from "wouter";
import { ModalOverlay } from "@/components/ModalOverlay";
import { Search, Copy, Check, Zap, Filter, ChevronDown, BookOpen,
         Sparkles, Star, Hash, Wand2, Play, Download, X, ChevronRight,
         Code2, Eye, RefreshCw, ExternalLink } from "lucide-react";

const API = import.meta.env.BASE_URL.replace(/\/$/, "") + "/api";

// ── Types ─────────────────────────────────────────────────────────────────────
type Source = "prompts" | "effects" | "visme";
type OutputType = "copy" | "html" | "image" | "video" | "social" | "email";

interface MasterItem {
  id?: string; name: string; description?: string; prompt?: string;
  category?: string; engine?: string; useCase?: string; style?: string; tags?: string[];
  source: "prompts";
}
interface EffectItem {
  id: string; name: string; category: string; description: string;
  source: "effects"; libs?: string[]; hasJs?: boolean; previewCss?: string;
}
interface VismeItem {
  id: string; name: string; icon: string; category: string;
  tags: string[]; description: string; prompt: string; source: "visme";
}
type AnyItem = MasterItem | EffectItem | VismeItem;

interface SnippetDetail {
  id: string; name: string; html: string; css: string; js: string; previewHtml: string;
}
interface Project { id: number; name: string; }
interface StatsResponse {
  builtinSnippets: number; vismeTemplates: number; categories: number;
  snippetCategories: string[]; vismeCategories: string[];
}

// ── Constants ─────────────────────────────────────────────────────────────────
const SNIPPET_CAT_LABELS: Record<string, string> = {
  particle_effects: "Partículas", background_effects: "Fondos", micro_interactions: "Microinteracciones",
  text_effects: "Texto", cards: "Tarjetas", "3d_effects": "Efectos 3D", typography_effects: "Tipografía",
  logo_animations: "Logos", celebration_effects: "Celebración", animated_icons: "Iconos",
  loaders: "Loaders", scroll_indicators: "Scroll", charts: "Contadores",
  transition_effects: "Transiciones", interactive_effects: "Interactivo", parallax_effects: "Parallax",
  forms_surveys: "Formularios", cards_banners: "Tarjetas y banners", navigation_menus: "Navegación",
};
const VISME_CAT_LABELS: Record<string, string> = {
  "3d_effects": "Efectos 3D", animated_characters: "Personajes", animated_icons: "Iconos",
  background_effects: "Fondos", charts: "Gráficos", data_viz: "Data Viz",
  forms_surveys: "Formularios", infographics: "Infografías", landing_pages: "Landings",
  micro_interactions: "Micro-Interactions", motion_graphics: "Motion Graphics",
  particle_effects: "Partículas", presentations: "Presentaciones", social_media: "Social Media",
  text_effects: "Texto", transition_effects: "Transiciones", typography_effects: "Tipografía",
  ui_components: "Componentes UI", video_effects: "Video", web_graphics: "Web Graphics",
};
const ENGINE_COLORS: Record<string, string> = {
  claude: "#fbbf24", gpt: "#4ade80", gemini: "#60a5fa",
  midjourney: "#a78bfa", flux: "#f87171", default: "rgba(255,255,255,.4)",
};
const OUTPUT_TYPES: { key: OutputType; label: string; icon: string; color: string }[] = [
  { key: "copy", label: "Copy/Texto", icon: "✍️", color: "#c9a961" },
  { key: "html", label: "HTML", icon: "💻", color: "#60a5fa" },
  { key: "image", label: "Imagen IA", icon: "🎨", color: "#a78bfa" },
  { key: "video", label: "Video", icon: "🎬", color: "#f87171" },
  { key: "social", label: "Social", icon: "📱", color: "#4ade80" },
  { key: "email", label: "Email", icon: "📧", color: "#f59e0b" },
];

// ── Small helpers ─────────────────────────────────────────────────────────────
function EngineTag({ engine }: { engine?: string }) {
  if (!engine) return null;
  const c = ENGINE_COLORS[engine.toLowerCase()] ?? ENGINE_COLORS.default;
  return (
    <span style={{ fontSize: 9, padding: "1px 6px", borderRadius: 3,
      background: `${c}18`, color: c, fontWeight: 700, letterSpacing: ".3px",
      textTransform: "uppercase", flexShrink: 0 }}>
      {engine}
    </span>
  );
}

// ── Main component ────────────────────────────────────────────────────────────
export default function EffectsStudio() {
  const [, navigate] = useLocation();

  // Source & category
  const [source, setSource] = useState<Source>("prompts");
  const [category, setCategory] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState<"default" | "name" | "engine">("default");
  const [showFilters, setShowFilters] = useState(false);

  // Data
  const [stats, setStats] = useState<StatsResponse | null>(null);
  const [libIndex, setLibIndex] = useState<Array<{ key: string; count: number }>>([]);
  const [items, setItems] = useState<AnyItem[]>([]);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [offset, setOffset] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [totalCount, setTotalCount] = useState(0);
  const [vismePage, setVismePage] = useState(1);
  const [vismePages, setVismePages] = useState(1);

  // Projects
  const [projects, setProjects] = useState<Project[]>([]);
  const [projectId, setProjectId] = useState<number | undefined>();

  // Selected item & detail panel
  const [selected, setSelected] = useState<AnyItem | null>(null);
  const [snippetDetail, setSnippetDetail] = useState<SnippetDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  // DNA Adapter
  const [outputType, setOutputType] = useState<OutputType>("copy");
  const [clientContext, setClientContext] = useState("");
  const [isAdapting, setIsAdapting] = useState(false);
  const [adaptedPrompt, setAdaptedPrompt] = useState("");

  // Generator
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedOutput, setGeneratedOutput] = useState("");
  const [outputMode, setOutputMode] = useState<"preview" | "code">("preview");

  // Custom generator (bottom of main area)
  const [customPrompt, setCustomPrompt] = useState("");
  const [customOutputType, setCustomOutputType] = useState<OutputType>("html");
  const [customIsGenerating, setCustomIsGenerating] = useState(false);
  const [customOutput, setCustomOutput] = useState("");

  // UI
  const [copied, setCopied] = useState("");
  const [toast, setToast] = useState("");
  const searchRef = useRef<HTMLInputElement>(null);
  const LIMIT = 24;

  // Compose mode
  const [composeMode, setComposeMode] = useState(false);
  const [composeSelected, setComposeSelected] = useState<string[]>([]);
  const [composeLoading, setComposeLoading] = useState(false);
  const [composeHtml, setComposeHtml] = useState("");
  const [showComposePrev, setShowComposePrev] = useState(false);
  const [composePrevMode, setComposePrevMode] = useState<"preview" | "code">("preview");
  // Compose DNA fields
  const [cdName, setCdName] = useState("Mi Marca");
  const [cdSector, setCdSector] = useState("Agency");
  const [cdFont, setCdFont] = useState("Inter");
  const [cdPrimary, setCdPrimary] = useState("#6366f1");
  const [cdSecondary, setCdSecondary] = useState("#ec4899");
  const [cdBg, setCdBg] = useState("#0d0d1a");
  const [cdHeadline, setCdHeadline] = useState("Construye algo extraordinario");
  const [cdTagline, setCdTagline] = useState("La agencia que convierte ideas en experiencias");
  const [cdCta, setCdCta] = useState("Empezar ahora");
  const [showComposeDna, setShowComposeDna] = useState(false);

  // ── Load data on mount ──────────────────────────────────────────────────────
  useEffect(() => {
    fetch(`${API}/visme/stats`, { credentials: "include" })
      .then(r => r.json()).then(setStats).catch(() => {});
    fetch(`${API}/fs-pro/prompt-library-master?indexOnly=1`, { credentials: "include" })
      .then(r => r.json()).then((d: any) => {
        let idx: Array<{ key: string; count: number }> = [];
        if (Array.isArray(d)) { idx = d; }
        else if (Array.isArray(d.libraries)) {
          idx = d.libraries.map((l: any) => ({ key: l.key ?? l.name ?? "", count: l.count ?? 0 }));
        } else if (d.libraries && typeof d.libraries === "object") {
          idx = Object.entries(d.libraries).map(([k, v]: [string, any]) => ({
            key: k, count: Array.isArray(v?.templates) ? v.templates.length : (v?.count ?? 0),
          }));
        }
        setLibIndex(idx);
      }).catch(() => {});
    fetch(`${API}/projects`, { credentials: "include" })
      .then(r => r.json()).then((d: any) => setProjects(Array.isArray(d) ? d : (d.projects ?? []))).catch(() => {});
  }, []);

  // ── Load items per source ───────────────────────────────────────────────────
  const loadPrompts = useCallback(async (cat: string, q: string, off: number, append = false) => {
    setLoading(true);
    setFetchError(null);
    try {
      const p = new URLSearchParams({ limit: String(LIMIT), offset: String(off) });
      if (cat) p.set("library", cat);
      if (q.trim()) p.set("search", q.trim());
      const r = await fetch(`${API}/fs-pro/prompt-library-master?${p}`, { credentials: "include" });
      if (!r.ok) {
        const msg = r.status === 401 ? "Sesión expirada. Recarga la página." : r.status === 403 ? "Sin acceso. Inicia sesión." : `Error ${r.status} al cargar prompts.`;
        setFetchError(msg);
        if (!append) setItems([]);
        setLoading(false);
        return;
      }
      const d = await r.json();
      const list: MasterItem[] = (Array.isArray(d) ? d : (d.items ?? [])).map((x: any) => ({ ...x, source: "prompts" as const }));
      const total = d.total ?? list.length;
      setTotalCount(total);
      setHasMore(off + list.length < total);
      setItems(prev => append ? [...prev, ...list] : list);
    } catch (e: any) {
      setFetchError("Error de red al cargar prompts. Revisa tu conexión.");
      if (!append) setItems([]);
    }
    setLoading(false);
  }, []);

  const loadEffects = useCallback(async (cat: string, q: string) => {
    setLoading(true);
    try {
      const p = new URLSearchParams({ category: cat || "all", search: q, ...(projectId ? { projectId: String(projectId) } : {}) });
      const d = await fetch(`${API}/visme/snippets?${p}`, { credentials: "include" }).then(r => r.json());
      const list: EffectItem[] = (d.items ?? []).map((x: any) => ({ ...x, source: "effects" as const }));
      setItems(list); setTotalCount(list.length); setHasMore(false);
    } catch { setItems([]); }
    setLoading(false);
  }, [projectId]);

  const loadVisme = useCallback(async (cat: string, q: string, page: number) => {
    setLoading(true);
    try {
      const p = new URLSearchParams({ category: cat || "all", search: q, page: String(page), limit: "36" });
      const d = await fetch(`${API}/visme/templates?${p}`, { credentials: "include" }).then(r => r.json());
      const list: VismeItem[] = (d.items ?? []).map((x: any) => ({ ...x, source: "visme" as const }));
      setItems(list); setTotalCount(d.total ?? list.length);
      setVismePages(d.pages ?? 1); setHasMore(page < (d.pages ?? 1));
    } catch { setItems([]); }
    setLoading(false);
  }, []);

  const reloadItems = useCallback(() => {
    setOffset(0); setItems([]);
    if (source === "prompts") void loadPrompts(category, search, 0);
    else if (source === "effects") void loadEffects(category, search);
    else void loadVisme(category, search, 1);
  }, [source, category, search, loadPrompts, loadEffects, loadVisme]);

  useEffect(() => { reloadItems(); }, [source, category, search, projectId]); // eslint-disable-line

  // ── Event handlers ──────────────────────────────────────────────────────────
  function switchSource(s: Source) {
    setSource(s); setCategory(""); setSearchInput(""); setSearch(""); setSelected(null);
    setSnippetDetail(null); setAdaptedPrompt(""); setGeneratedOutput(""); setItems([]);
    setOffset(0); setVismePage(1); setFetchError(null);
  }

  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    setSearch(searchInput.trim());
    setOffset(0);
  }

  function handleCategoryClick(key: string) {
    setCategory(key); setSearch(""); setSearchInput(""); setOffset(0); setSelected(null);
  }

  async function selectItem(item: AnyItem) {
    setSelected(item); setAdaptedPrompt(""); setGeneratedOutput("");
    if (item.source === "effects") {
      setDetailLoading(true);
      try {
        const p = new URLSearchParams(projectId ? { projectId: String(projectId) } : {});
        const d = await fetch(`${API}/visme/snippets/${item.id}?${p}`, { credentials: "include" }).then(r => r.json());
        setSnippetDetail(d);
      } catch {}
      setDetailLoading(false);
    } else {
      setSnippetDetail(null);
    }
  }

  function closeDetail() { setSelected(null); setSnippetDetail(null); setAdaptedPrompt(""); setGeneratedOutput(""); }

  async function adaptPrompt() {
    const rawPrompt = selected?.source === "prompts"
      ? ((selected as MasterItem).prompt ?? selected.name)
      : selected?.source === "visme"
        ? (selected as VismeItem).prompt
        : selected?.name ?? "";
    if (!rawPrompt) return;
    setIsAdapting(true); setAdaptedPrompt("");
    try {
      const res = await fetch(`${API}/visme/adapt`, {
        method: "POST", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: rawPrompt, projectId, outputType, clientContext }),
      });
      const reader = res.body!.getReader();
      const dec = new TextDecoder();
      let buf = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += dec.decode(value, { stream: true });
        const parts = buf.split("\n\n"); buf = parts.pop() ?? "";
        for (const p of parts) {
          if (!p.startsWith("data: ")) continue;
          try {
            const ev = JSON.parse(p.slice(6));
            if (ev.chunk) setAdaptedPrompt(prev => prev + ev.chunk);
          } catch {}
        }
      }
    } catch (e: any) { showToast("Error al adaptar: " + e.message); }
    setIsAdapting(false);
  }

  async function generateFromAdapted() {
    const prompt = adaptedPrompt || getItemPrompt(selected);
    if (!prompt || isGenerating) return;
    setIsGenerating(true); setGeneratedOutput("");
    try {
      if (outputType === "html" || selected?.source === "effects") {
        await streamGenerate(`${API}/visme/generate`, { prompt, projectId }, (chunk: string) => {
          setGeneratedOutput(prev => prev + chunk);
        }, (ev: any) => { if (ev.done && ev.html) setGeneratedOutput(ev.html); });
      } else {
        // Text generation via visme/adapt with generate flag
        await streamGenerate(`${API}/visme/adapt`, { prompt, projectId, outputType, clientContext, generate: true }, (chunk: string) => {
          setGeneratedOutput(prev => prev + chunk);
        });
      }
    } catch (e: any) { showToast("Error al generar: " + e.message); }
    setIsGenerating(false);
  }

  async function runCustomGenerator() {
    if (!customPrompt.trim() || customIsGenerating) return;
    setCustomIsGenerating(true); setCustomOutput("");
    try {
      const endpoint = customOutputType === "html" ? `${API}/visme/generate` : `${API}/visme/adapt`;
      await streamGenerate(endpoint, { prompt: customPrompt, projectId, outputType: customOutputType }, (chunk: string) => {
        setCustomOutput(prev => prev + chunk);
      }, (ev: any) => { if (ev.done && ev.html) setCustomOutput(ev.html); });
    } catch {}
    setCustomIsGenerating(false);
  }

  async function streamGenerate(
    url: string, body: object,
    onChunk: (t: string) => void,
    onEvent?: (ev: any) => void
  ) {
    const res = await fetch(url, {
      method: "POST", credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const reader = res.body!.getReader();
    const dec = new TextDecoder();
    let buf = "";
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buf += dec.decode(value, { stream: true });
      const parts = buf.split("\n\n"); buf = parts.pop() ?? "";
      for (const p of parts) {
        if (!p.startsWith("data: ")) continue;
        try {
          const ev = JSON.parse(p.slice(6));
          if (ev.chunk) onChunk(ev.chunk);
          onEvent?.(ev);
        } catch {}
      }
    }
  }

  function getItemPrompt(item: AnyItem | null): string {
    if (!item) return "";
    if (item.source === "prompts") return (item as MasterItem).prompt ?? item.name;
    if (item.source === "visme") return (item as VismeItem).prompt;
    return item.name;
  }

  function copyText(text: string, key: string) {
    navigator.clipboard.writeText(text).catch(() => {});
    setCopied(key);
    setTimeout(() => setCopied(""), 2000);
    showToast("Copiado al portapapeles ✓");
  }

  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(""), 2800);
  }

  function downloadHtml(html: string, filename = "output.html") {
    const b = new Blob([html], { type: "text/html" });
    const u = URL.createObjectURL(b);
    const a = document.createElement("a"); a.href = u; a.download = filename; a.click();
    URL.revokeObjectURL(u);
  }

  function openInDesigner(html: string, name?: string) {
    try {
      sessionStorage.setItem("designer_preload", JSON.stringify({ html, name: name ?? selected?.name ?? "Efecto" }));
    } catch {}
    navigate("/web-designer");
  }

  function openPromptInDesigner(prompt: string, name?: string) {
    try {
      sessionStorage.setItem("designer_preload", JSON.stringify({ prompt, name: name ?? selected?.name ?? "Efecto" }));
    } catch {}
    navigate("/web-designer");
  }

  function toggleComposeMode() {
    const next = !composeMode;
    setComposeMode(next);
    if (!next) {
      setComposeSelected([]);
      setShowComposePrev(false);
    } else {
      if (source !== "effects") switchSource("effects");
      setSelected(null);
    }
  }

  function toggleComposeEffect(id: string) {
    setComposeSelected(prev => {
      if (prev.includes(id)) return prev.filter(x => x !== id);
      if (prev.length >= 8) { showToast("Máximo 8 efectos por composición"); return prev; }
      return [...prev, id];
    });
  }

  async function runCompose() {
    if (!composeSelected.length || composeLoading) return;
    setComposeLoading(true);
    setComposeHtml("");
    try {
      const dna = {
        name: cdName, sector: cdSector, font: cdFont,
        primary_color: cdPrimary, secondary_color: cdSecondary, bg_color: cdBg,
        headline: cdHeadline, tagline: cdTagline, cta: cdCta,
      };
      const r = await fetch(`${API}/visme/compose`, {
        method: "POST", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ effect_ids: composeSelected, dna, page_type: "landing", projectId }),
      });
      const d = await r.json();
      if (!d.ok || !d.html) throw new Error(d.error ?? "Sin respuesta HTML");
      setComposeHtml(d.html);
      setShowComposePrev(true);
      setComposePrevMode("preview");
    } catch (e: any) { showToast("Error componiendo: " + e.message); }
    setComposeLoading(false);
  }

  // ── Derived state ───────────────────────────────────────────────────────────
  const sortedItems = [...items].sort((a, b) => {
    if (sortBy === "name") return a.name.localeCompare(b.name);
    if (sortBy === "engine" && a.source === "prompts" && b.source === "prompts")
      return ((a as MasterItem).engine ?? "").localeCompare((b as MasterItem).engine ?? "");
    return 0;
  });

  const totalTemplates = libIndex.reduce((s, l) => s + l.count, 0) || 6132;
  const showCategoryGrid = source === "prompts" && items.length === 0 && !loading && !search && !fetchError;
  const currentCats = source === "effects"
    ? (stats?.snippetCategories ?? [])
    : source === "visme"
      ? (stats?.vismeCategories ?? []).slice(0, 50)
      : libIndex.map(l => l.key);

  // ── Styles ──────────────────────────────────────────────────────────────────
  const S = {
    bg: "#0a0a0f", surf: "#111118", surf2: "#16161f", surf3: "#1e1e2a",
    bdr: "rgba(255,255,255,.06)", gold: "#c9a961", jade: "#2a7a4b",
    t1: "#e2e2ec", t2: "rgba(255,255,255,.65)", t3: "rgba(255,255,255,.38)", t4: "rgba(255,255,255,.2)",
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100vh", background: S.bg, color: S.t1, fontFamily: "Inter,sans-serif", overflow: "hidden" }}>

      {/* ══ TOP BAR ══════════════════════════════════════════════════════════════ */}
      <div style={{ height: 52, background: S.surf, borderBottom: `1px solid ${S.bdr}`, display: "flex", alignItems: "center", gap: 10, padding: "0 14px", flexShrink: 0, zIndex: 10 }}>
        {/* Logo */}
        <div style={{ display: "flex", alignItems: "center", gap: 6, fontWeight: 800, fontSize: 13, whiteSpace: "nowrap" }}>
          <Sparkles size={15} style={{ color: S.gold }} />
          <span>Effects <span style={{ color: S.gold }}>Studio</span></span>
        </div>

        {/* Source tabs */}
        <div style={{ display: "flex", gap: 3, marginLeft: 8, background: S.surf2, borderRadius: 8, padding: 3 }}>
          {([
            { s: "prompts" as Source, label: `📚 Prompts`, count: totalTemplates.toLocaleString("es-ES") },
            { s: "effects" as Source, label: `⚡ Efectos`, count: stats?.builtinSnippets ?? 30 },
            { s: "visme" as Source, label: `✦ Plantillas`, count: stats?.vismeTemplates ?? 594 },
          ] as const).map(t => (
            <button key={t.s} onClick={() => switchSource(t.s)} style={{
              padding: "4px 12px", borderRadius: 6, border: "none",
              background: source === t.s ? "rgba(201,169,97,.15)" : "transparent",
              color: source === t.s ? S.gold : S.t3,
              fontSize: 11, fontWeight: source === t.s ? 700 : 400, cursor: "pointer",
              display: "flex", alignItems: "center", gap: 5, transition: "all .15s",
            }}>
              {t.label}
              <span style={{ fontSize: 10, background: source === t.s ? "rgba(201,169,97,.2)" : S.surf3, padding: "0 5px", borderRadius: 10, color: source === t.s ? S.gold : S.t4 }}>
                {t.count}
              </span>
            </button>
          ))}
        </div>

        {/* Search */}
        <form onSubmit={handleSearch} style={{ flex: 1, maxWidth: 380, position: "relative" }}>
          <Search size={12} style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: S.t4, pointerEvents: "none" }} />
          <input
            ref={searchRef}
            value={searchInput}
            onChange={e => setSearchInput(e.target.value)}
            placeholder={source === "prompts" ? "Buscar en 6.2K prompts…" : source === "effects" ? "Buscar efectos…" : "Buscar plantillas de diseño…"}
            style={{ width: "100%", background: S.surf2, border: `1px solid ${S.bdr}`, borderRadius: 7, padding: "6px 10px 6px 28px", color: S.t1, fontSize: 11, outline: "none", boxSizing: "border-box" }}
          />
        </form>

        {/* Filters toggle */}
        <button onClick={() => setShowFilters(f => !f)} style={{ display: "flex", alignItems: "center", gap: 4, padding: "5px 10px", background: showFilters ? "rgba(201,169,97,.1)" : "transparent", border: `1px solid ${showFilters ? "rgba(201,169,97,.3)" : S.bdr}`, borderRadius: 6, color: showFilters ? S.gold : S.t3, fontSize: 11, cursor: "pointer" }}>
          <Filter size={11} /> Filtros
        </button>

        {/* Stats pills */}
        <div style={{ display: "flex", gap: 5, marginLeft: 4 }}>
          {source === "prompts" && <span style={{ fontSize: 10, padding: "3px 10px", borderRadius: 20, background: "rgba(201,169,97,.08)", color: S.gold, border: "1px solid rgba(201,169,97,.2)", fontWeight: 700, whiteSpace: "nowrap" }}>{totalTemplates.toLocaleString("es-ES")} prompts</span>}
          {source === "effects" && <span style={{ fontSize: 10, padding: "3px 10px", borderRadius: 20, background: "rgba(34,197,94,.08)", color: "#22c55e", border: "1px solid rgba(34,197,94,.2)", fontWeight: 700 }}>{stats?.builtinSnippets ?? 101} efectos CSS/JS</span>}
          {source === "visme" && <span style={{ fontSize: 10, padding: "3px 10px", borderRadius: 20, background: "rgba(99,102,241,.08)", color: "#a5b4fc", border: "1px solid rgba(99,102,241,.2)", fontWeight: 700 }}>594 templates</span>}
        </div>

        {/* Mode tabs */}
        <div style={{ display: "flex", gap: 3, marginLeft: "auto", background: S.surf2, borderRadius: 8, padding: 3 }}>
          {([
            { mode: false, label: "Explorar", icon: "🔍" },
            { mode: true,  label: "Componer", icon: "🎛️" },
          ] as const).map(t => (
            <button key={String(t.mode)} onClick={() => { if (composeMode !== t.mode) toggleComposeMode(); }} style={{
              padding: "4px 12px", borderRadius: 6, border: "none",
              background: composeMode === t.mode ? (t.mode ? "rgba(99,102,241,.25)" : "rgba(201,169,97,.15)") : "transparent",
              color: composeMode === t.mode ? (t.mode ? "#818cf8" : S.gold) : S.t3,
              fontSize: 11, fontWeight: composeMode === t.mode ? 700 : 400, cursor: "pointer",
            }}>
              {t.icon} {t.label}
            </button>
          ))}
        </div>

        {/* Project selector */}
        <select value={projectId ?? ""} onChange={e => setProjectId(e.target.value ? Number(e.target.value) : undefined)} style={{ background: S.surf2, border: `1px solid ${S.bdr}`, borderRadius: 6, padding: "5px 8px", color: projectId ? S.t1 : S.t3, fontSize: 11, outline: "none", cursor: "pointer", maxWidth: 180 }}>
          <option value="">🏪 Sin proyecto</option>
          {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
      </div>

      {/* ══ COMPOSE BAR ══════════════════════════════════════════════════════ */}
      {composeMode && (
        <div style={{ background: "rgba(99,102,241,.1)", borderBottom: "1px solid rgba(99,102,241,.25)", flexShrink: 0 }}>
          {/* Selection bar */}
          <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 14px", flexWrap: "wrap" }}>
            <div style={{ width: 22, height: 22, background: "#6366f1", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 700, color: "#fff", flexShrink: 0 }}>
              {composeSelected.length}
            </div>
            <span style={{ fontSize: 12, color: "#a5b4fc" }}>
              {composeSelected.length === 0
                ? "Selecciona hasta 8 efectos para componer una página completa"
                : composeSelected.length === 1
                  ? "1 efecto seleccionado"
                  : `${composeSelected.length} efectos seleccionados`}
            </span>
            {composeSelected.length > 0 && (
              <button onClick={() => setComposeSelected([])} style={{ padding: "2px 8px", background: "transparent", border: "none", color: "#6366f1", fontSize: 11, cursor: "pointer", marginLeft: 2 }}>✕ Limpiar</button>
            )}
            <div style={{ marginLeft: "auto", display: "flex", gap: 6, alignItems: "center" }}>
              <button onClick={() => setShowComposeDna(d => !d)} style={{ padding: "5px 10px", background: showComposeDna ? "rgba(99,102,241,.3)" : "rgba(99,102,241,.1)", border: "1px solid rgba(99,102,241,.3)", borderRadius: 6, color: "#a5b4fc", fontSize: 11, cursor: "pointer" }}>
                🧬 DNA {showComposeDna ? "▴" : "▾"}
              </button>
              <button
                onClick={() => void runCompose()}
                disabled={composeSelected.length === 0 || composeLoading}
                style={{ padding: "6px 18px", background: composeSelected.length === 0 || composeLoading ? "#1a1a2e" : "linear-gradient(135deg,#6366f1,#4f46e5)", border: "none", borderRadius: 6, color: composeSelected.length === 0 || composeLoading ? "#4a4a6a" : "#fff", fontSize: 12, fontWeight: 700, cursor: composeSelected.length === 0 || composeLoading ? "not-allowed" : "pointer", whiteSpace: "nowrap" }}>
                {composeLoading ? "⏳ Componiendo…" : `🎛️ Componer página ${composeSelected.length > 0 ? `(${composeSelected.length})` : ""} →`}
              </button>
            </div>
          </div>

          {/* DNA fields (collapsible) */}
          {showComposeDna && (
            <div style={{ padding: "0 14px 12px", display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(160px,1fr))", gap: 8, borderTop: "1px solid rgba(99,102,241,.15)", paddingTop: 10 }}>
              {[
                { label: "Nombre de marca", val: cdName, set: setCdName, ph: "Mi Marca" },
                { label: "Sector", val: cdSector, set: setCdSector, ph: "moda, SaaS…" },
                { label: "Google Font", val: cdFont, set: setCdFont, ph: "Inter" },
                { label: "Headline", val: cdHeadline, set: setCdHeadline, ph: "Tu propuesta de valor" },
                { label: "Tagline", val: cdTagline, set: setCdTagline, ph: "Tu slogan" },
                { label: "CTA", val: cdCta, set: setCdCta, ph: "Empezar ahora" },
              ].map(f => (
                <div key={f.label}>
                  <div style={{ fontSize: 9, color: "#6366f1", textTransform: "uppercase", letterSpacing: ".08em", fontWeight: 700, marginBottom: 3 }}>{f.label}</div>
                  <input value={f.val} onChange={e => f.set(e.target.value)} placeholder={f.ph} style={{ width: "100%", background: "#0d0d1a", border: "1px solid rgba(99,102,241,.25)", borderRadius: 5, padding: "5px 8px", color: "#e2e2ec", fontSize: 11, outline: "none", boxSizing: "border-box" }} />
                </div>
              ))}
              <div>
                <div style={{ fontSize: 9, color: "#6366f1", textTransform: "uppercase", letterSpacing: ".08em", fontWeight: 700, marginBottom: 3 }}>Color primario</div>
                <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
                  <input type="color" value={cdPrimary} onChange={e => setCdPrimary(e.target.value)} style={{ width: 28, height: 28, border: "none", background: "none", cursor: "pointer", padding: 0, flexShrink: 0 }} />
                  <input value={cdPrimary} onChange={e => setCdPrimary(e.target.value)} style={{ flex: 1, background: "#0d0d1a", border: "1px solid rgba(99,102,241,.25)", borderRadius: 5, padding: "5px 6px", color: "#e2e2ec", fontSize: 10, outline: "none", fontFamily: "monospace" }} />
                </div>
              </div>
              <div>
                <div style={{ fontSize: 9, color: "#6366f1", textTransform: "uppercase", letterSpacing: ".08em", fontWeight: 700, marginBottom: 3 }}>Color secundario</div>
                <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
                  <input type="color" value={cdSecondary} onChange={e => setCdSecondary(e.target.value)} style={{ width: 28, height: 28, border: "none", background: "none", cursor: "pointer", padding: 0, flexShrink: 0 }} />
                  <input value={cdSecondary} onChange={e => setCdSecondary(e.target.value)} style={{ flex: 1, background: "#0d0d1a", border: "1px solid rgba(99,102,241,.25)", borderRadius: 5, padding: "5px 6px", color: "#e2e2ec", fontSize: 10, outline: "none", fontFamily: "monospace" }} />
                </div>
              </div>
              <div>
                <div style={{ fontSize: 9, color: "#6366f1", textTransform: "uppercase", letterSpacing: ".08em", fontWeight: 700, marginBottom: 3 }}>Fondo</div>
                <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
                  <input type="color" value={cdBg} onChange={e => setCdBg(e.target.value)} style={{ width: 28, height: 28, border: "none", background: "none", cursor: "pointer", padding: 0, flexShrink: 0 }} />
                  <input value={cdBg} onChange={e => setCdBg(e.target.value)} style={{ flex: 1, background: "#0d0d1a", border: "1px solid rgba(99,102,241,.25)", borderRadius: 5, padding: "5px 6px", color: "#e2e2ec", fontSize: 10, outline: "none", fontFamily: "monospace" }} />
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Filters bar */}
      {showFilters && (
        <div style={{ padding: "8px 14px", background: S.surf2, borderBottom: `1px solid ${S.bdr}`, display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap", flexShrink: 0 }}>
          <span style={{ fontSize: 10, color: S.t3, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".1em" }}>Ordenar</span>
          {(["default", "name", "engine"] as const).map(opt => (
            <button key={opt} onClick={() => setSortBy(opt)} style={{ padding: "3px 10px", background: sortBy === opt ? "rgba(201,169,97,.12)" : "transparent", border: `1px solid ${sortBy === opt ? "rgba(201,169,97,.4)" : S.bdr}`, borderRadius: 5, color: sortBy === opt ? S.gold : S.t3, fontSize: 10, cursor: "pointer" }}>
              {opt === "default" ? "Relevancia" : opt === "name" ? "Nombre A-Z" : "Motor IA"}
            </button>
          ))}
          {libIndex.length > 0 && source === "prompts" && (
            <>
              <span style={{ width: 1, height: 16, background: S.bdr }} />
              <span style={{ fontSize: 10, color: S.t3, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".1em" }}>Librería</span>
              <select value={category} onChange={e => handleCategoryClick(e.target.value)} style={{ background: S.surf3, border: `1px solid ${S.bdr}`, borderRadius: 5, padding: "3px 8px", color: S.t2, fontSize: 10, outline: "none" }}>
                <option value="">— Todas —</option>
                {libIndex.map(l => <option key={l.key} value={l.key}>{l.key.replace(/_/g, " ")} ({l.count})</option>)}
              </select>
            </>
          )}
        </div>
      )}

      <div style={{ flex: 1, display: "flex", overflow: "hidden" }}>

        {/* ══ SIDEBAR ══════════════════════════════════════════════════════════ */}
        <div style={{ width: 180, flexShrink: 0, background: S.surf, borderRight: `1px solid ${S.bdr}`, overflowY: "auto", padding: "8px 0" }}>
          <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: ".12em", textTransform: "uppercase", color: S.t4, padding: "6px 12px 4px" }}>Categorías</div>

          {/* "Todos" button */}
          <button onClick={() => handleCategoryClick("")} style={{ width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between", padding: "6px 12px", border: "none", background: category === "" ? "rgba(201,169,97,.1)" : "transparent", color: category === "" ? S.gold : S.t3, fontSize: 11, cursor: "pointer", textAlign: "left" }}>
            <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
              {source === "prompts" ? "🌐" : source === "effects" ? "⚡" : "✦"}
              <span>Todos</span>
            </span>
            <span style={{ fontSize: 10, background: "rgba(255,255,255,.05)", padding: "0 5px", borderRadius: 8, color: S.t4 }}>
              {source === "prompts" ? totalTemplates.toLocaleString("es-ES") : source === "effects" ? (stats?.builtinSnippets ?? 101) : (stats?.vismeTemplates ?? 594)}
            </span>
          </button>

          {/* Category list */}
          {source === "prompts" && libIndex.map((lib, i) => {
            const PALETTE = ["#f59e0b","#4ade80","#60a5fa","#a78bfa","#f87171","#fbbf24","#06b6d4","#e879f9","#22d3ee","#34d399","#fb923c","#67e8f9","#c084fc","#38bdf8","#f97316","#86efac"];
            const col = PALETTE[i % PALETTE.length];
            return (
              <button key={lib.key} onClick={() => handleCategoryClick(lib.key)} style={{ width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 6, padding: "6px 12px", border: "none", background: category === lib.key ? `${col}10` : "transparent", color: category === lib.key ? col : S.t3, fontSize: 11, cursor: "pointer", textAlign: "left", transition: "all .1s" }}>
                <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flex: 1 }}>{lib.key.replace(/_/g, " ")}</span>
                <span style={{ fontSize: 9, background: "rgba(255,255,255,.05)", padding: "0 4px", borderRadius: 6, color: S.t4, flexShrink: 0 }}>{lib.count}</span>
              </button>
            );
          })}
          {source === "effects" && (stats?.snippetCategories ?? []).map(cat => (
            <button key={cat} onClick={() => handleCategoryClick(cat)} style={{ width: "100%", display: "flex", alignItems: "center", padding: "6px 12px", border: "none", background: category === cat ? "rgba(201,169,97,.1)" : "transparent", color: category === cat ? S.gold : S.t3, fontSize: 11, cursor: "pointer", textAlign: "left" }}>
              <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{SNIPPET_CAT_LABELS[cat] ?? cat.replace(/_/g, " ")}</span>
            </button>
          ))}
          {source === "visme" && (stats?.vismeCategories ?? []).slice(0, 50).map(cat => (
            <button key={cat} onClick={() => handleCategoryClick(cat)} style={{ width: "100%", display: "flex", alignItems: "center", padding: "6px 12px", border: "none", background: category === cat ? "rgba(99,102,241,.12)" : "transparent", color: category === cat ? "#a5b4fc" : S.t3, fontSize: 11, cursor: "pointer", textAlign: "left" }}>
              <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{VISME_CAT_LABELS[cat] ?? cat.replace(/_/g, " ")}</span>
            </button>
          ))}
        </div>

        {/* ══ MAIN CONTENT ═════════════════════════════════════════════════════ */}
        <div style={{ flex: 1, overflowY: "auto", padding: "16px 16px 40px" }}>

          {/* Results header */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ fontSize: 13, fontWeight: 700 }}>
                {search ? `"${search}"` : category
                  ? (source === "prompts" ? category.replace(/_/g, " ") : source === "effects" ? (SNIPPET_CAT_LABELS[category] ?? category) : (VISME_CAT_LABELS[category] ?? category.replace(/_/g, " ")))
                  : source === "prompts" ? "Librería Maestra de Prompts" : source === "effects" ? "Efectos CSS/JS" : "Plantillas de diseño"
                }
              </span>
              {totalCount > 0 && !showCategoryGrid && (
                <span style={{ fontSize: 10, padding: "1px 7px", borderRadius: 10, background: "rgba(201,169,97,.1)", color: S.gold }}>{totalCount.toLocaleString("es-ES")}</span>
              )}
            </div>
            <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
              {search && <button onClick={() => { setSearch(""); setSearchInput(""); }} style={{ fontSize: 10, padding: "3px 8px", background: "transparent", border: `1px solid ${S.bdr}`, borderRadius: 4, color: S.t3, cursor: "pointer" }}>✕ Limpiar</button>}
              {source === "visme" && vismePages > 1 && (
                <div style={{ display: "flex", gap: 3, alignItems: "center" }}>
                  <button onClick={() => { const p = Math.max(1, vismePage - 1); setVismePage(p); void loadVisme(category, search, p); }} disabled={vismePage === 1} style={{ padding: "3px 8px", background: "transparent", border: `1px solid ${S.bdr}`, borderRadius: 4, color: S.t2, fontSize: 11, cursor: "pointer" }}>‹</button>
                  <span style={{ fontSize: 10, color: S.t4 }}>{vismePage}/{vismePages}</span>
                  <button onClick={() => { const p = Math.min(vismePages, vismePage + 1); setVismePage(p); void loadVisme(category, search, p); }} disabled={vismePage === vismePages} style={{ padding: "3px 8px", background: "transparent", border: `1px solid ${S.bdr}`, borderRadius: 4, color: S.t2, fontSize: 11, cursor: "pointer" }}>›</button>
                </div>
              )}
            </div>
          </div>

          {/* ── Category grid (Prompts, no search active) ── */}
          {showCategoryGrid && (
            <div style={{ marginBottom: 24 }}>
              <p style={{ fontSize: 9, fontWeight: 700, textTransform: "uppercase", letterSpacing: "1.5px", color: S.t4, marginBottom: 10 }}>CATEGORÍAS</p>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(155px,1fr))", gap: 8, marginBottom: 20 }}>
                {libIndex.map((lib, i) => {
                  const PALETTE = ["#f59e0b","#4ade80","#60a5fa","#a78bfa","#f87171","#fbbf24","#06b6d4","#e879f9","#22d3ee","#34d399","#fb923c","#67e8f9","#c084fc","#38bdf8","#f97316","#86efac"];
                  const col = PALETTE[i % PALETTE.length];
                  const isAct = category === lib.key;
                  return (
                    <button key={lib.key} onClick={() => handleCategoryClick(lib.key)} style={{ padding: "14px 12px", borderRadius: 12, cursor: "pointer", background: isAct ? `${col}12` : S.surf2, border: `1px solid ${isAct ? col + "50" : S.bdr}`, textAlign: "left", transition: "all .15s" }}
                      onMouseOver={e => { if (!isAct) { e.currentTarget.style.borderColor = `${col}35`; e.currentTarget.style.background = `${col}08`; } }}
                      onMouseOut={e => { if (!isAct) { e.currentTarget.style.borderColor = S.bdr; e.currentTarget.style.background = S.surf2; } }}>
                      <div style={{ fontSize: 9, fontFamily: "monospace", color: col, fontWeight: 700, marginBottom: 8, letterSpacing: ".04em", textTransform: "uppercase" }}>{lib.key.split("_").slice(0, 2).join("_")}</div>
                      <p style={{ fontSize: 12, fontWeight: 700, color: isAct ? col : S.t1, marginBottom: 3 }}>{lib.key.replace(/_/g, " ")}</p>
                      <span style={{ fontSize: 9, padding: "1px 6px", borderRadius: 10, background: `${col}15`, color: col, fontWeight: 700 }}>{lib.count} templates</span>
                    </button>
                  );
                })}
              </div>
              {/* Info stats row */}
              <div style={{ display: "flex", gap: 20, padding: "14px 18px", background: S.surf, borderRadius: 12, border: `1px solid ${S.bdr}`, flexWrap: "wrap" }}>
                {[
                  { icon: <BookOpen size={14} />, label: "Total prompts", value: `${totalTemplates.toLocaleString("es-ES")}`, color: S.gold },
                  { icon: <Zap size={14} />, label: "Effects snippets", value: `${stats?.builtinSnippets ?? 30} CSS/JS`, color: "#22c55e" },
                  { icon: <Sparkles size={14} />, label: "Plantillas de diseño", value: `${stats?.vismeTemplates ?? 594}`, color: "#a5b4fc" },
                  { icon: <Star size={14} />, label: "Motores IA", value: "Claude · GPT · Gemini · Flux", color: S.jade },
                  { icon: <Hash size={14} />, label: "Con DNA Adapter", value: "Cualquier cliente", color: "#f59e0b" },
                ].map(item => (
                  <div key={item.label} style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 140 }}>
                    <div style={{ color: item.color }}>{item.icon}</div>
                    <div>
                      <p style={{ fontSize: 9, color: S.t4, marginBottom: 1 }}>{item.label}</p>
                      <p style={{ fontSize: 11, fontWeight: 700 }}>{item.value}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ── Error banner ── */}
          {fetchError && (
            <div style={{ margin: "12px 0", padding: "14px 18px", borderRadius: 12, background: "rgba(239,68,68,.08)", border: "1px solid rgba(239,68,68,.25)", display: "flex", alignItems: "center", gap: 10 }}>
              <span style={{ fontSize: 18 }}>⚠️</span>
              <div style={{ flex: 1 }}>
                <p style={{ fontSize: 12, fontWeight: 700, color: "#f87171", marginBottom: 2 }}>Error al cargar prompts</p>
                <p style={{ fontSize: 11, color: "rgba(248,113,113,.75)" }}>{fetchError}</p>
              </div>
              <button onClick={() => { setFetchError(null); void loadPrompts(category, search, 0); }}
                style={{ padding: "5px 12px", borderRadius: 8, border: "1px solid rgba(239,68,68,.3)", background: "rgba(239,68,68,.1)", color: "#f87171", fontSize: 11, fontWeight: 700, cursor: "pointer" }}>
                Reintentar
              </button>
            </div>
          )}

          {/* ── Skeleton loaders ── */}
          {loading && items.length === 0 && (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(300px,1fr))", gap: 10 }}>
              {Array.from({ length: 12 }).map((_, i) => (
                <div key={i} className="skeleton" style={{ height: 86, borderRadius: 12 }} />
              ))}
            </div>
          )}

          {/* ── Empty state ── */}
          {!loading && items.length === 0 && !showCategoryGrid && (
            <div style={{ padding: 48, textAlign: "center", color: S.t3 }}>
              <p style={{ fontSize: 32, marginBottom: 10 }}>🔍</p>
              <p style={{ fontSize: 14, fontWeight: 700, marginBottom: 6 }}>Sin resultados</p>
              <p style={{ fontSize: 12 }}>{search ? `No hay resultados para "${search}".` : "Selecciona una categoría o busca."}</p>
            </div>
          )}

          {/* ── Items grid ── */}
          {sortedItems.length > 0 && (
            <div style={{ display: "grid", gridTemplateColumns: source === "effects" ? "repeat(auto-fill,minmax(200px,1fr))" : "repeat(auto-fill,minmax(300px,1fr))", gap: 10, marginBottom: 20 }}>
              {sortedItems.map((item, i) => {
                const isSelected = selected?.source === item.source && selected?.id === item.id && (selected as any)?.name === item.name;
                const itemId = (item as any).id as string | undefined;
                const isComposeSelected = composeMode && !!itemId && composeSelected.includes(itemId);
                const cardBorder = composeMode
                  ? (isComposeSelected ? "1px solid #6366f1" : `1px solid ${S.bdr}`)
                  : (isSelected ? "1px solid rgba(201,169,97,.45)" : `1px solid ${S.bdr}`);
                const cardBg = composeMode
                  ? (isComposeSelected ? "rgba(99,102,241,.12)" : S.surf)
                  : (isSelected ? "rgba(201,169,97,.06)" : S.surf);
                const onCardActivate = () => {
                  if (composeMode && item.source === "effects" && itemId) {
                    toggleComposeEffect(itemId);
                  } else if (!composeMode) {
                    void selectItem(item);
                  }
                };
                return (
                  // div (no <button>): la tarjeta contiene botones "Copiar"/"Adaptar" y HTML no permite anidarlos.
                  <div key={`${item.source}-${(item as any).id ?? i}`}
                    role="button" tabIndex={0}
                    onClick={() => onCardActivate()}
                    onKeyDown={e => { if (e.target === e.currentTarget && (e.key === "Enter" || e.key === " ")) { e.preventDefault(); onCardActivate(); } }}
                    style={{ background: cardBg, border: cardBorder, borderRadius: 12, padding: "13px 15px", cursor: "pointer", textAlign: "left", transition: "all .15s", position: "relative" }}
                    onMouseOver={e => { if (!isSelected && !isComposeSelected) e.currentTarget.style.borderColor = composeMode ? "rgba(99,102,241,.4)" : "rgba(201,169,97,.25)"; }}
                    onMouseOut={e => { if (!isSelected && !isComposeSelected) e.currentTarget.style.borderColor = S.bdr; }}>

                    {/* Compose checkmark */}
                    {composeMode && isComposeSelected && (
                      <div style={{ position: "absolute", top: 8, left: 8, width: 20, height: 20, background: "#6366f1", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, color: "#fff", fontWeight: 700, zIndex: 2 }}>✓</div>
                    )}
                    {composeMode && !isComposeSelected && item.source === "effects" && (
                      <div style={{ position: "absolute", top: 8, left: 8, width: 20, height: 20, background: "rgba(99,102,241,.15)", border: "1.5px solid rgba(99,102,241,.4)", borderRadius: "50%", zIndex: 2 }} />
                    )}

                    {/* Source badge */}
                    <span style={{ position: "absolute", top: 8, right: 8, fontSize: 8, fontWeight: 700, textTransform: "uppercase", padding: "2px 5px", borderRadius: 4,
                      background: item.source === "prompts" ? "rgba(201,169,97,.12)" : item.source === "effects" ? "rgba(34,197,94,.12)" : "rgba(99,102,241,.12)",
                      color: item.source === "prompts" ? S.gold : item.source === "effects" ? "#22c55e" : "#818cf8",
                    }}>
                      {item.source === "prompts" ? "prompt" : item.source === "effects" ? "snippet" : "visme"}
                    </span>

                    {/* Icon for Visme */}
                    {item.source === "visme" && (item as VismeItem).icon && (
                      <span style={{ fontSize: 18, marginBottom: 5, display: "block" }}>{(item as VismeItem).icon}</span>
                    )}

                    {/* Header row */}
                    <div style={{ display: "flex", alignItems: "flex-start", gap: 8, marginBottom: 5, paddingRight: 40 }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: "flex", gap: 4, flexWrap: "wrap", marginBottom: 3 }}>
                          {item.source === "prompts" && <EngineTag engine={(item as MasterItem).engine} />}
                          {item.category && (
                            <span style={{ fontSize: 9, padding: "1px 6px", borderRadius: 3, background: "rgba(99,102,241,.1)", color: "#a5b4fc", fontWeight: 600 }}>
                              {SNIPPET_CAT_LABELS[item.category] ?? VISME_CAT_LABELS[item.category] ?? item.category.replace(/_/g, " ")}
                            </span>
                          )}
                        </div>
                        <p style={{ fontSize: 12, fontWeight: 700, color: S.t1, lineHeight: 1.3, marginBottom: 3 }}>{item.name}</p>
                        {item.description && (
                          <p style={{ fontSize: 10, color: S.t3, lineHeight: 1.5, overflow: "hidden", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" as any }}>
                            {item.description}
                          </p>
                        )}
                      </div>
                    </div>

                    {/* Tags for Visme */}
                    {item.source === "visme" && (item as VismeItem).tags?.length > 0 && (
                      <div style={{ display: "flex", flexWrap: "wrap", gap: 3, marginTop: 5 }}>
                        {(item as VismeItem).tags.slice(0, 4).map(tag => (
                          <span key={tag} style={{ fontSize: 9, background: "rgba(255,255,255,.04)", color: S.t4, padding: "1px 5px", borderRadius: 3 }}>{tag}</span>
                        ))}
                      </div>
                    )}

                    {/* Quick copy for prompts */}
                    {item.source === "prompts" && (
                      <div style={{ marginTop: 8, display: "flex", gap: 5 }}>
                        <button onClick={e => { e.stopPropagation(); copyText((item as MasterItem).prompt ?? item.name, `q-${i}`); }} style={{ fontSize: 10, padding: "3px 8px", background: "rgba(255,255,255,.04)", border: `1px solid ${S.bdr}`, borderRadius: 4, color: S.t3, cursor: "pointer", display: "flex", alignItems: "center", gap: 3 }}>
                          {copied === `q-${i}` ? <Check size={10} /> : <Copy size={10} />} Copiar
                        </button>
                        <button onClick={e => { e.stopPropagation(); void selectItem(item); }} style={{ fontSize: 10, padding: "3px 8px", background: "rgba(201,169,97,.06)", border: "1px solid rgba(201,169,97,.2)", borderRadius: 4, color: S.gold, cursor: "pointer", display: "flex", alignItems: "center", gap: 3 }}>
                          <Wand2 size={10} /> Adaptar
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* Load more */}
          {hasMore && source === "prompts" && (
            <div style={{ textAlign: "center", marginBottom: 24 }}>
              <button onClick={() => { const next = offset + LIMIT; setOffset(next); void loadPrompts(category, search, next, true); }} disabled={loading} style={{ padding: "10px 28px", background: "transparent", border: `1px solid ${S.bdr}`, borderRadius: 8, color: S.t2, fontSize: 12, cursor: "pointer", opacity: loading ? .5 : 1 }}>
                {loading ? "Cargando…" : `Cargar más (${items.length.toLocaleString("es-ES")} de ${totalCount.toLocaleString("es-ES")})`}
              </button>
            </div>
          )}

          {/* ══ CUSTOM AI GENERATOR ═══════════════════════════════════════════ */}
          <div style={{ marginTop: 32, padding: 20, background: S.surf, border: "1px solid rgba(201,169,97,.2)", borderRadius: 16 }}>
            <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 12 }}>
              <div>
                <p style={{ fontSize: 12, fontWeight: 800, color: S.gold, marginBottom: 3, display: "flex", alignItems: "center", gap: 6 }}><Wand2 size={13} /> Generador Personalizado</p>
                <p style={{ fontSize: 11, color: S.t3 }}>Describe lo que quieres. Claude lo genera con el DNA de tu cliente aplicado.</p>
              </div>
              {/* Output type */}
              <div style={{ display: "flex", gap: 4 }}>
                {OUTPUT_TYPES.map(ot => (
                  <button key={ot.key} onClick={() => setCustomOutputType(ot.key)} title={ot.label} style={{ padding: "4px 8px", background: customOutputType === ot.key ? `${ot.color}18` : "transparent", border: `1px solid ${customOutputType === ot.key ? ot.color + "50" : S.bdr}`, borderRadius: 6, color: customOutputType === ot.key ? ot.color : S.t4, fontSize: 11, cursor: "pointer" }}>
                    {ot.icon}
                  </button>
                ))}
              </div>
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <input value={customPrompt} onChange={e => setCustomPrompt(e.target.value)} onKeyDown={e => e.key === "Enter" && !e.shiftKey && void runCustomGenerator()} placeholder={customOutputType === "html" ? "Ej: hero animado con partículas doradas y CTA de la marca…" : customOutputType === "image" ? "Ej: foto producto flotando con fondo degradado marca…" : "Ej: email de recuperación de carrito con oferta 15% descuento…"} style={{ flex: 1, background: S.surf2, border: `1px solid ${S.bdr}`, borderRadius: 8, padding: "10px 13px", color: S.t1, fontSize: 11, outline: "none", fontFamily: "inherit" }} />
              <button onClick={() => void runCustomGenerator()} disabled={customIsGenerating || !customPrompt.trim()} style={{ padding: "10px 18px", background: !customIsGenerating && customPrompt.trim() ? "linear-gradient(135deg,#c9a961,#b8860b)" : S.surf2, border: "none", borderRadius: 8, color: !customIsGenerating && customPrompt.trim() ? "#000" : S.t4, fontWeight: 700, fontSize: 12, cursor: !customIsGenerating && customPrompt.trim() ? "pointer" : "not-allowed", whiteSpace: "nowrap", display: "flex", alignItems: "center", gap: 5 }}>
                {customIsGenerating ? <><RefreshCw size={12} style={{ animation: "spin 1s linear infinite" }} /> Generando…</> : <><Play size={12} /> Generar</>}
              </button>
            </div>
            {customOutput && (
              <div style={{ marginTop: 14, borderRadius: 10, overflow: "hidden", border: "1px solid rgba(34,197,94,.25)" }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "7px 12px", background: "rgba(34,197,94,.07)", borderBottom: "1px solid rgba(34,197,94,.15)" }}>
                  <span style={{ fontSize: 11, color: "#22c55e", fontWeight: 600, display: "flex", alignItems: "center", gap: 5 }}><Check size={12} /> Output generado</span>
                  <div style={{ display: "flex", gap: 5, flexWrap: "wrap" }}>
                    {(customOutputType === "html") && (
                      <button onClick={() => setOutputMode(m => m === "preview" ? "code" : "preview")} style={{ padding: "2px 8px", background: "transparent", border: `1px solid ${S.bdr}`, borderRadius: 4, color: S.t2, fontSize: 10, cursor: "pointer", display: "flex", alignItems: "center", gap: 3 }}>
                        {outputMode === "preview" ? <Code2 size={10} /> : <Eye size={10} />} {outputMode === "preview" ? "Código" : "Preview"}
                      </button>
                    )}
                    <button onClick={() => copyText(customOutput, "custom-out")} style={{ padding: "2px 8px", background: "transparent", border: `1px solid ${S.bdr}`, borderRadius: 4, color: S.t2, fontSize: 10, cursor: "pointer" }}>{copied === "custom-out" ? "✓" : "📋"} Copiar</button>
                    {customOutputType === "html" && <button onClick={() => downloadHtml(customOutput)} style={{ padding: "2px 8px", background: "transparent", border: `1px solid ${S.bdr}`, borderRadius: 4, color: S.t2, fontSize: 10, cursor: "pointer", display: "flex", alignItems: "center", gap: 3 }}><Download size={10} /> HTML</button>}
                    {customOutputType === "html" && <button onClick={() => openInDesigner(customOutput, customPrompt.slice(0, 40))} style={{ padding: "2px 8px", background: "rgba(201,169,97,.12)", border: "1px solid rgba(201,169,97,.3)", borderRadius: 4, color: S.gold, fontSize: 10, fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", gap: 3 }}><ExternalLink size={10} /> Designer</button>}
                  </div>
                </div>
                {customOutputType === "html" && outputMode === "preview"
                  ? <iframe srcDoc={customOutput} sandbox="allow-scripts allow-same-origin" style={{ width: "100%", height: 300, border: "none" }} title="Preview" />
                  : <pre style={{ margin: 0, padding: 12, background: S.surf3, color: "#a8b4d8", fontSize: 10, fontFamily: "monospace", whiteSpace: "pre-wrap", wordBreak: "break-word", maxHeight: 300, overflowY: "auto", lineHeight: 1.6 }}>{customOutput}</pre>
                }
              </div>
            )}
          </div>
        </div>

        {/* ══ DETAIL PANEL (DNA ADAPTER + GENERATOR) ═══════════════════════════ */}
        {selected && (
          <div style={{ width: 380, flexShrink: 0, background: S.surf, borderLeft: `1px solid ${S.bdr}`, display: "flex", flexDirection: "column", overflow: "hidden" }}>

            {/* Panel header */}
            <div style={{ padding: "14px 16px", borderBottom: `1px solid ${S.bdr}`, flexShrink: 0 }}>
              <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 8 }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  {selected.source === "visme" && (selected as VismeItem).icon && (
                    <span style={{ fontSize: 22, display: "block", marginBottom: 4 }}>{(selected as VismeItem).icon}</span>
                  )}
                  <div style={{ display: "flex", gap: 4, flexWrap: "wrap", marginBottom: 4 }}>
                    {selected.source === "prompts" && <EngineTag engine={(selected as MasterItem).engine} />}
                    <span style={{ fontSize: 9, padding: "1px 6px", borderRadius: 3, background: selected.source === "effects" ? "rgba(34,197,94,.1)" : selected.source === "visme" ? "rgba(99,102,241,.1)" : "rgba(201,169,97,.1)", color: selected.source === "effects" ? "#22c55e" : selected.source === "visme" ? "#a5b4fc" : S.gold, fontWeight: 700, textTransform: "uppercase" }}>
                      {selected.source}
                    </span>
                  </div>
                  <p style={{ fontSize: 13, fontWeight: 700, lineHeight: 1.3 }}>{selected.name}</p>
                  {selected.description && <p style={{ fontSize: 11, color: S.t3, marginTop: 4, lineHeight: 1.5 }}>{selected.description}</p>}
                </div>
                <button onClick={closeDetail} style={{ background: "transparent", border: "none", color: S.t4, cursor: "pointer", padding: 2, flexShrink: 0 }}><X size={15} /></button>
              </div>
            </div>

            <div style={{ flex: 1, overflowY: "auto" }}>

              {/* ── Effects snippet: live preview + code ── */}
              {selected.source === "effects" && (
                <>
                  {detailLoading && <p style={{ padding: 16, fontSize: 12, color: S.t3 }}>⏳ Cargando preview…</p>}
                  {snippetDetail?.previewHtml && (
                    <>
                      <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: ".1em", textTransform: "uppercase", color: S.t4, padding: "10px 14px 4px" }}>PREVIEW EN VIVO</div>
                      <iframe srcDoc={snippetDetail.previewHtml} sandbox="allow-scripts allow-same-origin" style={{ width: "100%", height: 200, border: "none", borderBottom: `1px solid ${S.bdr}` }} title="Effect preview" />
                    </>
                  )}
                  {snippetDetail && (
                    <div style={{ padding: 14 }}>
                      {[
                        { label: "HTML", code: snippetDetail.html, key: "d-html", color: "#f59e0b" },
                        { label: "CSS", code: snippetDetail.css, key: "d-css", color: "#60a5fa" },
                        ...(snippetDetail.js ? [{ label: "JS", code: snippetDetail.js, key: "d-js", color: "#22c55e" }] : []),
                      ].filter(c => c.code?.trim()).map(c => (
                        <div key={c.key} style={{ marginBottom: 10 }}>
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 3 }}>
                            <span style={{ fontSize: 9, fontWeight: 700, color: c.color, letterSpacing: ".1em" }}>{c.label}</span>
                            <button onClick={() => copyText(c.code, c.key)} style={{ padding: "1px 7px", background: "transparent", border: `1px solid ${S.bdr}`, borderRadius: 3, color: S.t3, fontSize: 9, cursor: "pointer" }}>{copied === c.key ? "✓" : "📋"}</button>
                          </div>
                          <textarea readOnly value={c.code} style={{ width: "100%", height: 80, padding: 8, background: S.surf3, border: `1px solid ${S.bdr}`, borderRadius: 6, color: "#a8b4d8", fontSize: 9.5, fontFamily: "monospace", resize: "vertical", boxSizing: "border-box", outline: "none", lineHeight: 1.5 }} />
                        </div>
                      ))}
                    </div>
                  )}
                </>
              )}

              {/* ── Prompt / Visme: show full prompt ── */}
              {(selected.source === "prompts" || selected.source === "visme") && (
                <div style={{ padding: "10px 14px" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 5 }}>
                    <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: ".1em", textTransform: "uppercase", color: S.t4 }}>PROMPT ORIGINAL</span>
                    <button onClick={() => copyText(getItemPrompt(selected), "orig-p")} style={{ padding: "1px 8px", background: "transparent", border: `1px solid ${S.bdr}`, borderRadius: 3, color: S.t3, fontSize: 9, cursor: "pointer" }}>{copied === "orig-p" ? "✓ Copiado" : "📋 Copiar"}</button>
                  </div>
                  <div style={{ fontSize: 11, color: S.t2, lineHeight: 1.6, padding: 10, background: S.surf3, borderRadius: 8, border: `1px solid ${S.bdr}`, maxHeight: 140, overflowY: "auto", wordBreak: "break-word" }}>
                    {getItemPrompt(selected)}
                  </div>
                  {/* Tags */}
                  {selected.source === "visme" && (selected as VismeItem).tags?.length > 0 && (
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 3, marginTop: 8 }}>
                      {(selected as VismeItem).tags.map(tag => (
                        <span key={tag} style={{ fontSize: 9, background: "rgba(255,255,255,.04)", color: S.t4, padding: "1px 5px", borderRadius: 3 }}>{tag}</span>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* ══ DNA ADAPTER SECTION ════════════════════════════════════════ */}
              <div style={{ margin: "0 14px 14px", padding: 14, background: "rgba(201,169,97,.04)", border: "1px solid rgba(201,169,97,.15)", borderRadius: 12 }}>
                <p style={{ fontSize: 11, fontWeight: 700, color: S.gold, marginBottom: 10, display: "flex", alignItems: "center", gap: 5 }}>
                  <Wand2 size={12} /> Adaptar con Brand DNA
                  {!projectId && <span style={{ fontSize: 9, color: S.t4, fontWeight: 400 }}>— selecciona un proyecto arriba</span>}
                </p>

                {/* Output type */}
                <div style={{ marginBottom: 10 }}>
                  <p style={{ fontSize: 9, color: S.t4, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".1em", marginBottom: 6 }}>Tipo de output</p>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                    {OUTPUT_TYPES.map(ot => (
                      <button key={ot.key} onClick={() => setOutputType(ot.key)} style={{ padding: "4px 9px", background: outputType === ot.key ? `${ot.color}18` : "transparent", border: `1px solid ${outputType === ot.key ? ot.color + "50" : S.bdr}`, borderRadius: 6, color: outputType === ot.key ? ot.color : S.t3, fontSize: 10, cursor: "pointer", display: "flex", alignItems: "center", gap: 3 }}>
                        {ot.icon} {ot.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Extra context */}
                <div style={{ marginBottom: 10 }}>
                  <p style={{ fontSize: 9, color: S.t4, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".1em", marginBottom: 4 }}>Contexto extra (opcional)</p>
                  <textarea value={clientContext} onChange={e => setClientContext(e.target.value)} placeholder="Ej: campaña Black Friday, tono urgente, descuento 30%…" rows={2} style={{ width: "100%", background: S.surf3, border: `1px solid ${S.bdr}`, borderRadius: 6, padding: "7px 9px", color: S.t1, fontSize: 10, fontFamily: "inherit", resize: "none", outline: "none", boxSizing: "border-box", lineHeight: 1.5 }} />
                </div>

                {/* Adapt button */}
                <button onClick={() => void adaptPrompt()} disabled={isAdapting} style={{ width: "100%", padding: "9px", background: isAdapting ? S.surf3 : "linear-gradient(135deg,rgba(201,169,97,.25),rgba(201,169,97,.12))", border: `1px solid ${isAdapting ? S.bdr : "rgba(201,169,97,.4)"}`, borderRadius: 8, color: isAdapting ? S.t4 : S.gold, fontWeight: 700, fontSize: 11, cursor: isAdapting ? "not-allowed" : "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
                  {isAdapting ? <><RefreshCw size={12} style={{ animation: "spin 1s linear infinite" }} /> Adaptando con Claude…</> : <><Wand2 size={12} /> Adaptar Prompt para {projects.find(p => p.id === projectId)?.name ?? "cliente"}</>}
                </button>
              </div>

              {/* ── Adapted prompt result ── */}
              {(adaptedPrompt || isAdapting) && (
                <div style={{ margin: "0 14px 14px", padding: 12, background: S.surf3, border: "1px solid rgba(201,169,97,.2)", borderRadius: 10 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                    <span style={{ fontSize: 9, fontWeight: 700, color: S.gold, letterSpacing: ".1em", textTransform: "uppercase" }}>PROMPT ADAPTADO</span>
                    {adaptedPrompt && (
                      <button onClick={() => copyText(adaptedPrompt, "adapted")} style={{ padding: "1px 8px", background: "transparent", border: `1px solid ${S.bdr}`, borderRadius: 3, color: S.t3, fontSize: 9, cursor: "pointer" }}>{copied === "adapted" ? "✓" : "📋"}</button>
                    )}
                  </div>
                  <div style={{ fontSize: 11, color: S.t1, lineHeight: 1.6, maxHeight: 180, overflowY: "auto", wordBreak: "break-word" }}>
                    {adaptedPrompt || <span style={{ color: S.t4 }}>Generando adaptación…</span>}
                  </div>
                  {adaptedPrompt && (
                    <button onClick={() => void generateFromAdapted()} disabled={isGenerating} style={{ width: "100%", marginTop: 10, padding: "9px", background: isGenerating ? S.surf2 : "linear-gradient(135deg,#c9a961,#b8860b)", border: "none", borderRadius: 7, color: isGenerating ? S.t4 : "#000", fontWeight: 800, fontSize: 11, cursor: isGenerating ? "not-allowed" : "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
                      {isGenerating ? <><RefreshCw size={12} style={{ animation: "spin 1s linear infinite" }} /> Generando…</> : <><Play size={12} /> {outputType === "image" || outputType === "video" ? `Generar prompt de ${OUTPUT_TYPES.find(o => o.key === outputType)?.label?.toLowerCase()}` : `Generar ${OUTPUT_TYPES.find(o => o.key === outputType)?.label}`}</>}
                    </button>
                  )}
                </div>
              )}

              {/* ── Generated output ── */}
              {generatedOutput && (
                <div style={{ margin: "0 14px 14px" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6, flexWrap: "wrap", gap: 4 }}>
                    <span style={{ fontSize: 9, fontWeight: 700, color: "#22c55e", letterSpacing: ".1em", textTransform: "uppercase" }}>OUTPUT GENERADO</span>
                    <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                      {outputType === "html" && <button onClick={() => setOutputMode(m => m === "preview" ? "code" : "preview")} style={{ padding: "1px 7px", background: "transparent", border: `1px solid ${S.bdr}`, borderRadius: 3, color: S.t3, fontSize: 9, cursor: "pointer" }}>{outputMode === "preview" ? "Código" : "Preview"}</button>}
                      <button onClick={() => copyText(generatedOutput, "gen-out")} style={{ padding: "1px 7px", background: "transparent", border: `1px solid ${S.bdr}`, borderRadius: 3, color: S.t3, fontSize: 9, cursor: "pointer" }}>{copied === "gen-out" ? "✓" : "📋"}</button>
                      {outputType === "html" && <button onClick={() => downloadHtml(generatedOutput, `${selected?.name ?? "output"}.html`)} style={{ padding: "1px 7px", background: "transparent", border: `1px solid ${S.bdr}`, borderRadius: 3, color: S.t3, fontSize: 9, cursor: "pointer", display: "flex", alignItems: "center", gap: 2 }}><Download size={9} /></button>}
                      {outputType === "html" && <button onClick={() => openInDesigner(generatedOutput, selected?.name)} style={{ padding: "1px 7px", background: "rgba(201,169,97,.12)", border: "1px solid rgba(201,169,97,.3)", borderRadius: 3, color: S.gold, fontSize: 9, fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", gap: 2 }}><ExternalLink size={8} /> Designer</button>}
                    </div>
                  </div>
                  <div style={{ border: `1px solid rgba(34,197,94,.2)`, borderRadius: 8, overflow: "hidden" }}>
                    {outputType === "html" && outputMode === "preview"
                      ? <iframe srcDoc={generatedOutput} sandbox="allow-scripts allow-same-origin" style={{ width: "100%", height: 260, border: "none" }} title="Generated preview" />
                      : <pre style={{ margin: 0, padding: 10, background: S.surf3, color: "#a8b4d8", fontSize: 9.5, fontFamily: "monospace", whiteSpace: "pre-wrap", wordBreak: "break-word", maxHeight: 260, overflowY: "auto", lineHeight: 1.5 }}>{generatedOutput}</pre>
                    }
                  </div>
                </div>
              )}
            </div>

            {/* Panel footer actions */}
            <div style={{ padding: 10, borderTop: `1px solid ${S.bdr}`, flexShrink: 0, display: "flex", flexWrap: "wrap", gap: 5 }}>
              {selected.source === "prompts" && (
                <>
                  <button onClick={() => copyText(getItemPrompt(selected), "footer-copy")} style={{ flex: 1, minWidth: 90, padding: "7px", background: "transparent", border: `1px solid ${S.bdr}`, borderRadius: 6, color: S.t2, fontSize: 10, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 4 }}>
                    {copied === "footer-copy" ? <Check size={11} /> : <Copy size={11} />} Copiar
                  </button>
                  <button onClick={() => openPromptInDesigner(getItemPrompt(selected), selected.name)} style={{ flex: 1, minWidth: 110, padding: "7px", background: "rgba(201,169,97,.1)", border: "1px solid rgba(201,169,97,.3)", borderRadius: 6, color: S.gold, fontSize: 10, fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 4 }}>
                    <ExternalLink size={10} /> Abrir en Designer
                  </button>
                </>
              )}
              {selected.source === "effects" && snippetDetail && (
                <>
                  <button onClick={() => copyText(snippetDetail.html + (snippetDetail.css ? `\n<style>${snippetDetail.css}</style>` : "") + (snippetDetail.js ? `\n<script>${snippetDetail.js}</script>` : ""), "eff-copy")} style={{ flex: 1, minWidth: 90, padding: "7px", background: "transparent", border: `1px solid ${S.bdr}`, borderRadius: 6, color: S.t2, fontSize: 10, cursor: "pointer" }}>
                    {copied === "eff-copy" ? "✓ Copiado" : "📋 Copiar"}
                  </button>
                  <button onClick={() => { const fullHtml = `<!DOCTYPE html><html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>${snippetDetail.css || ""}</style></head><body>${snippetDetail.html || ""}<script>${snippetDetail.js || ""}<\/script></body></html>`; openInDesigner(fullHtml, selected.name); }} style={{ flex: 1, minWidth: 110, padding: "7px", background: "rgba(201,169,97,.12)", border: "1px solid rgba(201,169,97,.35)", borderRadius: 6, color: S.gold, fontSize: 10, fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 4 }}>
                    <ExternalLink size={10} /> Abrir en Designer
                  </button>
                </>
              )}
              {selected.source === "visme" && (
                <>
                  <button onClick={() => { setCustomPrompt(`Generar componente web basado en "${selected.name}": ${getItemPrompt(selected).slice(0, 180)}`); setCustomOutputType("html"); closeDetail(); setTimeout(() => window.scrollTo(0, 99999), 100); }} style={{ flex: 1, minWidth: 90, padding: "7px", background: "rgba(99,102,241,.1)", border: "1px solid rgba(99,102,241,.3)", borderRadius: 6, color: "#a5b4fc", fontSize: 10, fontWeight: 600, cursor: "pointer" }}>
                    ⚡ Generar IA
                  </button>
                  <button onClick={() => openPromptInDesigner(`Generar landing completa basada en template "${selected.name}". ${getItemPrompt(selected).slice(0, 300)}`, selected.name)} style={{ flex: 1, minWidth: 110, padding: "7px", background: "rgba(201,169,97,.1)", border: "1px solid rgba(201,169,97,.3)", borderRadius: 6, color: S.gold, fontSize: 10, fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 4 }}>
                    <ExternalLink size={10} /> Abrir en Designer
                  </button>
                </>
              )}
              <button onClick={closeDetail} style={{ padding: "7px 10px", background: "transparent", border: `1px solid ${S.bdr}`, borderRadius: 6, color: S.t4, fontSize: 10, cursor: "pointer" }}>
                <X size={11} />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ══ COMPOSE FULLSCREEN PREVIEW ══════════════════════════════════════ */}
      {showComposePrev && composeHtml && (
        <ModalOverlay style={{ background: S.bg, flexDirection: "column", alignItems: "stretch", justifyContent: "flex-start", padding: 0 }}>
          {/* Preview topbar */}
          <div style={{ height: 50, background: S.surf, borderBottom: `1px solid ${S.bdr}`, display: "flex", alignItems: "center", gap: 10, padding: "0 14px", flexShrink: 0 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: "#a5b4fc", flex: 1 }}>
              🎛️ Composición de {composeSelected.length} efecto{composeSelected.length !== 1 ? "s" : ""} — preview
            </div>
            <div style={{ display: "flex", gap: 6 }}>
              <button onClick={() => setComposePrevMode(m => m === "preview" ? "code" : "preview")} style={{ padding: "5px 12px", background: "transparent", border: `1px solid ${S.bdr}`, borderRadius: 6, color: S.t2, fontSize: 11, cursor: "pointer", display: "flex", alignItems: "center", gap: 4 }}>
                {composePrevMode === "preview" ? <><Code2 size={11} /> Código</> : <><Eye size={11} /> Preview</>}
              </button>
              <button onClick={() => copyText(composeHtml, "compose-html")} style={{ padding: "5px 12px", background: "rgba(99,102,241,.1)", border: "1px solid rgba(99,102,241,.3)", borderRadius: 6, color: "#a5b4fc", fontSize: 11, cursor: "pointer", display: "flex", alignItems: "center", gap: 4 }}>
                {copied === "compose-html" ? <><Check size={11} /> Copiado</> : <><Copy size={11} /> Copiar HTML</>}
              </button>
              <button onClick={() => downloadHtml(composeHtml, `composicion-${composeSelected.length}efectos-${Date.now()}.html`)} style={{ padding: "5px 12px", background: "rgba(34,197,94,.08)", border: "1px solid rgba(34,197,94,.2)", borderRadius: 6, color: "#22c55e", fontSize: 11, cursor: "pointer", display: "flex", alignItems: "center", gap: 4 }}>
                <Download size={11} /> Descargar
              </button>
              <button onClick={() => { const url2 = "data:text/html;charset=utf-8;base64," + btoa(unescape(encodeURIComponent(composeHtml))); window.open(url2, "_blank", "noopener,noreferrer"); }} style={{ padding: "5px 12px", background: "transparent", border: `1px solid ${S.bdr}`, borderRadius: 6, color: S.t2, fontSize: 11, cursor: "pointer" }}>
                ↗ Nueva pestaña
              </button>
              <button onClick={() => openInDesigner(composeHtml, `Composición ${composeSelected.length} efectos`)} style={{ padding: "5px 12px", background: "rgba(201,169,97,.15)", border: "1px solid rgba(201,169,97,.4)", borderRadius: 6, color: S.gold, fontSize: 11, fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", gap: 4 }}>
                <ExternalLink size={11} /> Editar en Designer
              </button>
              <button onClick={() => setShowComposePrev(false)} style={{ padding: "5px 12px", background: "transparent", border: `1px solid ${S.bdr}`, borderRadius: 6, color: S.t3, fontSize: 11, cursor: "pointer", display: "flex", alignItems: "center", gap: 3 }}>
                <X size={12} /> Cerrar
              </button>
            </div>
          </div>
          {/* Preview body */}
          {composePrevMode === "preview"
            ? <iframe srcDoc={composeHtml} sandbox="allow-scripts allow-same-origin" style={{ flex: 1, border: "none", width: "100%", background: "#fff" }} title="Compose preview" />
            : <pre style={{ flex: 1, margin: 0, padding: 20, background: S.surf3, color: "#a8b4d8", fontSize: 11, fontFamily: "monospace", whiteSpace: "pre-wrap", wordBreak: "break-word", overflowY: "auto", lineHeight: 1.6 }}>{composeHtml}</pre>
          }
        </ModalOverlay>
      )}

      {/* ── Toast ── */}
      {toast && (
        <div style={{ position: "fixed", bottom: 24, left: "50%", transform: "translateX(-50%)", background: S.surf2, border: "1px solid rgba(74,222,128,.3)", borderRadius: 10, padding: "10px 18px", fontSize: 12, color: "#4ade80", fontWeight: 600, display: "flex", alignItems: "center", gap: 6, boxShadow: "0 8px 24px rgba(0,0,0,.5)", zIndex: 9999 }}>
          <Check size={14} /> {toast}
        </div>
      )}

      <style>{`
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        @keyframes fadeSlideUp { from { opacity: 0; transform: translateX(-50%) translateY(8px); } to { opacity: 1; transform: translateX(-50%) translateY(0); } }
        .skeleton { background: linear-gradient(90deg, #16161f 25%, #1e1e2a 50%, #16161f 75%); background-size: 200% 100%; animation: shimmer 1.4s infinite; }
        @keyframes shimmer { 0% { background-position: 200% 0; } 100% { background-position: -200% 0; } }
      `}</style>
    </div>
  );
}
