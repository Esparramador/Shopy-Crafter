import { useState, useEffect, useCallback, useRef } from "react";
import { Search, Copy, Check, Zap, Filter, ChevronDown, BookOpen, Sparkles, Star, Clock, Hash } from "lucide-react";

const API_BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

interface MasterItem {
  id?: string;
  name: string;
  description?: string;
  prompt?: string;
  category?: string;
  engine?: string;
  useCase?: string;
  style?: string;
  tags?: string[];
}

interface LibIndex {
  key: string;
  count: number;
}

const EFFECT_CATEGORIES = [
  { key: "", label: "Todas", icon: "🌐", color: "var(--gold)", desc: "Explorar toda la librería" },
  { key: "product_photography", label: "Fotografía de Producto", icon: "📸", color: "#f59e0b", desc: "Composiciones profesionales para e-commerce" },
  { key: "lifestyle", label: "Lifestyle", icon: "🌿", color: "#4ade80", desc: "Escenas de vida real y contexto emocional" },
  { key: "seo_copy", label: "SEO & Copy", icon: "🔍", color: "#60a5fa", desc: "Textos optimizados para buscadores" },
  { key: "email", label: "Email Marketing", icon: "📧", color: "#a78bfa", desc: "Campañas y flujos automatizados" },
  { key: "ad_creative", label: "Ad Creatives", icon: "📺", color: "#f87171", desc: "Creatividades para Facebook, Instagram, TikTok" },
  { key: "brand_voice", label: "Brand Voice", icon: "🎯", color: "#fbbf24", desc: "Tono y personalidad de marca" },
  { key: "product_description", label: "Descripción Producto", icon: "📦", color: "var(--jade)", desc: "Fichas y textos de producto persuasivos" },
  { key: "storytelling", label: "Storytelling", icon: "📖", color: "#ec4899", desc: "Narrativas de marca con impacto emocional" },
  { key: "video_script", label: "Vídeo & Script", icon: "🎬", color: "#06b6d4", desc: "Guiones para UGC, reels y anuncios" },
  { key: "social_media", label: "Social Media", icon: "📱", color: "#f97316", desc: "Posts, captions y hashtags" },
  { key: "upsell", label: "Upsell & CRO", icon: "📈", color: "#34d399", desc: "Estrategias de conversión y venta cruzada" },
];

const ENGINE_COLORS: Record<string, string> = {
  claude: "#fbbf24",
  gpt: "#4ade80",
  gemini: "#60a5fa",
  midjourney: "#a78bfa",
  flux: "#f87171",
  default: "var(--t3)",
};

function EffectPreviewCard({ item, onCopy }: { item: MasterItem; onCopy: (text: string) => void }) {
  const [copied, setCopied] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const engineColor = ENGINE_COLORS[item.engine?.toLowerCase() ?? ""] ?? ENGINE_COLORS.default;

  const handleCopy = (e: React.MouseEvent) => {
    e.stopPropagation();
    const text = item.prompt ?? item.description ?? item.name;
    navigator.clipboard.writeText(text).catch(() => {});
    onCopy(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };

  return (
    <div
      onClick={() => setExpanded(e => !e)}
      className="glass-card"
      style={{
        padding: "14px 16px", cursor: "pointer",
        border: expanded ? "1px solid rgba(200,168,75,0.35)" : "1px solid var(--bdr)",
        transition: "border-color 0.15s, box-shadow 0.15s",
        boxShadow: expanded ? "0 0 0 1px rgba(200,168,75,0.12)" : "none",
      }}
      onMouseOver={e => { if (!expanded) e.currentTarget.style.borderColor = "rgba(255,255,255,0.1)"; }}
      onMouseOut={e => { if (!expanded) e.currentTarget.style.borderColor = "var(--bdr)"; }}
    >
      <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4, flexWrap: "wrap" }}>
            {item.engine && (
              <span style={{
                fontSize: 9, padding: "1px 6px", borderRadius: 3,
                background: `${engineColor}18`, color: engineColor,
                fontWeight: 700, letterSpacing: "0.3px", textTransform: "uppercase", flexShrink: 0,
              }}>
                {item.engine}
              </span>
            )}
            {item.category && (
              <span style={{
                fontSize: 9, padding: "1px 6px", borderRadius: 3,
                background: "rgba(99,102,241,0.12)", color: "#a5b4fc",
                fontWeight: 600, flexShrink: 0,
              }}>
                {item.category}
              </span>
            )}
          </div>
          <p style={{ fontSize: 13, fontWeight: 700, color: "var(--t)", lineHeight: 1.3, marginBottom: 4 }}>
            {item.name}
          </p>
          {item.description && (
            <p style={{
              fontSize: 11, color: "var(--t3)", lineHeight: 1.5,
              overflow: expanded ? "visible" : "hidden",
              display: "-webkit-box",
              WebkitLineClamp: expanded ? "unset" : "2",
              WebkitBoxOrient: "vertical" as any,
            }}>
              {item.description}
            </p>
          )}
          {expanded && item.prompt && (
            <div style={{
              marginTop: 10, padding: "10px 12px", borderRadius: 8,
              background: "var(--ink2)", border: "1px solid var(--bdr)",
              fontSize: 11, color: "var(--t2)", lineHeight: 1.6,
              fontFamily: "monospace", whiteSpace: "pre-wrap", wordBreak: "break-word",
            }}>
              {item.prompt}
            </div>
          )}
          {item.tags && item.tags.length > 0 && expanded && (
            <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginTop: 8 }}>
              {item.tags.slice(0, 5).map(tag => (
                <span key={tag} style={{
                  fontSize: 9, padding: "2px 6px", borderRadius: 20,
                  background: "var(--ink3)", color: "var(--t4)",
                }}>#{tag}</span>
              ))}
            </div>
          )}
        </div>
        <button
          onClick={handleCopy}
          title="Copiar prompt"
          style={{
            flexShrink: 0, background: copied ? "rgba(74,222,128,0.1)" : "var(--ink3)",
            border: `1px solid ${copied ? "rgba(74,222,128,0.3)" : "var(--bdr)"}`,
            borderRadius: 7, padding: "6px 8px", cursor: "pointer",
            color: copied ? "#4ade80" : "var(--t3)", transition: "all 0.15s",
            display: "flex", alignItems: "center", gap: 4, fontSize: 11,
          }}
        >
          {copied ? <Check size={13} /> : <Copy size={13} />}
        </button>
      </div>
    </div>
  );
}

export default function PromptLibrary() {
  const [libIndex, setLibIndex] = useState<LibIndex[]>([]);
  const [activeCategory, setActiveCategory] = useState("");
  const [search, setSearch] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [items, setItems] = useState<MasterItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [offset, setOffset] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [totalInLib, setTotalInLib] = useState(0);
  const [copiedMsg, setCopiedMsg] = useState("");
  const [showFilters, setShowFilters] = useState(false);
  const [sortBy, setSortBy] = useState<"default" | "name" | "engine">("default");
  const searchRef = useRef<HTMLInputElement>(null);
  const LIMIT = 24;

  const loadItems = useCallback(async (key: string, q: string, off: number, append = false) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ limit: String(LIMIT), offset: String(off) });
      if (key) params.set("key", key);
      if (q.trim()) params.set("search", q.trim());
      const r = await fetch(`${API_BASE}/api/fs-pro/prompt-library-master?${params}`, { credentials: "include" });
      if (!r.ok) throw new Error("failed");
      const data = await r.json();
      const list: MasterItem[] = Array.isArray(data) ? data : (data.items ?? []);
      const total: number = data.total ?? list.length;
      setTotalInLib(total);
      setHasMore(off + list.length < total);
      setItems(prev => append ? [...prev, ...list] : list);
    } catch {
      if (!append) setItems([]);
    } finally {
      setLoading(false);
    }
  }, []);

  const loadIndex = useCallback(async () => {
    try {
      const r = await fetch(`${API_BASE}/api/fs-pro/prompt-library-master/index`, { credentials: "include" });
      if (r.ok) {
        const d = await r.json();
        setLibIndex(Array.isArray(d) ? d : []);
      }
    } catch {}
  }, []);

  useEffect(() => {
    loadIndex();
    loadItems("", "", 0);
  }, [loadIndex, loadItems]);

  const handleCategorySelect = (key: string) => {
    setActiveCategory(key);
    setOffset(0);
    setSearch("");
    setSearchInput("");
    loadItems(key, "", 0);
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const q = searchInput.trim();
    setSearch(q);
    setOffset(0);
    loadItems(activeCategory, q, 0);
  };

  const loadMore = () => {
    const next = offset + LIMIT;
    setOffset(next);
    loadItems(activeCategory, search, next, true);
  };

  const handleCopy = (text: string) => {
    const preview = text.length > 40 ? text.slice(0, 40) + "…" : text;
    setCopiedMsg(`Copiado: "${preview}"`);
    setTimeout(() => setCopiedMsg(""), 2500);
  };

  const sortedItems = [...items].sort((a, b) => {
    if (sortBy === "name") return a.name.localeCompare(b.name);
    if (sortBy === "engine") return (a.engine ?? "").localeCompare(b.engine ?? "");
    return 0;
  });

  const totalTemplates = libIndex.reduce((s, l) => s + l.count, 0) || 6132;

  return (
    <div className="page-inner" style={{ maxWidth: 1100 }}>

      {/* ── HEADER ── */}
      <div style={{ marginBottom: 28 }}>
        <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 12, flexWrap: "wrap", marginBottom: 4 }}>
          <div>
            <p style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "1.5px", color: "var(--gold)", marginBottom: 6 }}>
              🏛 Biblioteca Maestra
            </p>
            <h1 style={{ fontFamily: "var(--fh)", fontStyle: "italic", fontSize: 26, fontWeight: 900, lineHeight: 1 }}>
              Librería de Prompts
            </h1>
          </div>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <span style={{
              fontSize: 12, padding: "5px 12px", borderRadius: 20,
              background: "rgba(200,168,75,0.1)", color: "var(--gold)",
              border: "1px solid rgba(200,168,75,0.25)", fontWeight: 700,
            }}>
              {totalTemplates.toLocaleString("es-ES")} templates
            </span>
            <span style={{
              fontSize: 12, padding: "5px 12px", borderRadius: 20,
              background: "rgba(99,102,241,0.1)", color: "#a5b4fc",
              border: "1px solid rgba(99,102,241,0.2)", fontWeight: 700,
            }}>
              {libIndex.length || "..."} categorías
            </span>
          </div>
        </div>
        <p style={{ fontSize: 13, color: "var(--t3)" }}>
          Explora y copia templates de IA para producto, copy, SEO, email, ads y mucho más.
        </p>
      </div>

      {/* ── SEARCH BAR ── */}
      <form onSubmit={handleSearch} style={{ display: "flex", gap: 8, marginBottom: 20 }}>
        <div style={{ flex: 1, position: "relative" }}>
          <Search size={15} style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: "var(--t4)", pointerEvents: "none" }} />
          <input
            ref={searchRef}
            value={searchInput}
            onChange={e => setSearchInput(e.target.value)}
            placeholder="Buscar prompts… (ej: fotografia producto, email recuperación carrito, SEO descripción…)"
            className="form-input"
            style={{ paddingLeft: 38, width: "100%", boxSizing: "border-box" }}
          />
        </div>
        <button type="submit" className="btn-primary" style={{ padding: "0 18px", flexShrink: 0 }}>
          Buscar
        </button>
        <button
          type="button"
          onClick={() => setShowFilters(f => !f)}
          className="btn"
          style={{ padding: "0 14px", flexShrink: 0, display: "flex", alignItems: "center", gap: 5 }}
        >
          <Filter size={13} />
          Filtros
          <ChevronDown size={11} style={{ transform: showFilters ? "rotate(180deg)" : "none", transition: "transform 0.15s" }} />
        </button>
      </form>

      {/* ── FILTERS PANEL ── */}
      {showFilters && (
        <div className="glass-card" style={{ padding: "14px 16px", marginBottom: 16, display: "flex", gap: 16, alignItems: "center", flexWrap: "wrap" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ fontSize: 11, color: "var(--t3)", fontWeight: 600 }}>Ordenar:</span>
            {(["default", "name", "engine"] as const).map(opt => (
              <button
                key={opt}
                onClick={() => setSortBy(opt)}
                className={sortBy === opt ? "btn-primary" : "btn"}
                style={{ padding: "4px 12px", fontSize: 11 }}
              >
                {opt === "default" ? "Por defecto" : opt === "name" ? "Nombre" : "Motor IA"}
              </button>
            ))}
          </div>
          {libIndex.length > 0 && (
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ fontSize: 11, color: "var(--t3)", fontWeight: 600 }}>Librería:</span>
              <select
                value={activeCategory}
                onChange={e => handleCategorySelect(e.target.value)}
                className="form-input"
                style={{ padding: "4px 10px", fontSize: 11, width: "auto" }}
              >
                <option value="">— Todas las librerías —</option>
                {libIndex.map(lib => (
                  <option key={lib.key} value={lib.key}>
                    {lib.key.replace(/_/g, " ")} ({lib.count})
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>
      )}

      {/* ── CATEGORY EFFECT GRID ── */}
      <div style={{ marginBottom: 24 }}>
        <p style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "1.5px", color: "var(--t3)", marginBottom: 12 }}>
          Efectos y Categorías
        </p>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))", gap: 8 }}>
          {EFFECT_CATEGORIES.map(cat => {
            const isActive = activeCategory === cat.key;
            const libInfo = libIndex.find(l => l.key === cat.key);
            return (
              <button
                key={cat.key}
                onClick={() => handleCategorySelect(cat.key)}
                style={{
                  padding: "14px 12px", borderRadius: 12, cursor: "pointer",
                  background: isActive ? `${cat.color}12` : "var(--ink2)",
                  border: isActive ? `1px solid ${cat.color}50` : "1px solid var(--bdr)",
                  textAlign: "left", transition: "all 0.15s",
                  boxShadow: isActive ? `0 0 0 1px ${cat.color}20` : "none",
                }}
                onMouseOver={e => { if (!isActive) { e.currentTarget.style.borderColor = `${cat.color}30`; e.currentTarget.style.background = `${cat.color}06`; } }}
                onMouseOut={e => { if (!isActive) { e.currentTarget.style.borderColor = "var(--bdr)"; e.currentTarget.style.background = "var(--ink2)"; } }}
              >
                <div style={{ fontSize: 22, marginBottom: 8 }}>{cat.icon}</div>
                <p style={{ fontSize: 12, fontWeight: 700, color: isActive ? cat.color : "var(--t)", marginBottom: 3 }}>
                  {cat.label}
                </p>
                <p style={{ fontSize: 10, color: "var(--t4)", lineHeight: 1.4, marginBottom: 6 }}>
                  {cat.desc}
                </p>
                {libInfo && (
                  <span style={{
                    fontSize: 9, padding: "1px 6px", borderRadius: 10,
                    background: `${cat.color}15`, color: cat.color, fontWeight: 700,
                  }}>
                    {libInfo.count} templates
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* ── RESULTS HEADER ── */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <p style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "1.5px", color: "var(--t3)" }}>
            {search ? `Resultados: "${search}"` : activeCategory ? EFFECT_CATEGORIES.find(c => c.key === activeCategory)?.label ?? "Templates" : "Todos los Templates"}
          </p>
          {!loading && (
            <span style={{
              fontSize: 10, padding: "1px 7px", borderRadius: 10,
              background: "rgba(200,168,75,0.1)", color: "var(--gold)",
            }}>
              {totalInLib.toLocaleString("es-ES")}
            </span>
          )}
        </div>
        {search && (
          <button
            onClick={() => { setSearch(""); setSearchInput(""); setOffset(0); loadItems(activeCategory, "", 0); }}
            className="btn"
            style={{ fontSize: 11, padding: "3px 10px" }}
          >
            × Limpiar búsqueda
          </button>
        )}
      </div>

      {/* ── ITEMS GRID ── */}
      {loading && items.length === 0 ? (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))", gap: 10 }}>
          {Array.from({ length: 12 }).map((_, i) => (
            <div key={i} className="skeleton" style={{ height: 90, borderRadius: 12 }} />
          ))}
        </div>
      ) : sortedItems.length === 0 ? (
        <div className="glass-card" style={{ padding: "40px", textAlign: "center" }}>
          <p style={{ fontSize: 28, marginBottom: 10 }}>🔍</p>
          <p style={{ fontSize: 15, fontWeight: 700, color: "var(--t)", marginBottom: 6 }}>Sin resultados</p>
          <p style={{ fontSize: 13, color: "var(--t3)" }}>
            {search ? `No hay templates para "${search}". Prueba con otro término.` : "Selecciona una categoría o realiza una búsqueda."}
          </p>
        </div>
      ) : (
        <>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))", gap: 10, marginBottom: 20 }}>
            {sortedItems.map((item, i) => (
              <EffectPreviewCard key={item.id ?? i} item={item} onCopy={handleCopy} />
            ))}
          </div>

          {hasMore && (
            <div style={{ textAlign: "center", marginBottom: 24 }}>
              <button
                onClick={loadMore}
                disabled={loading}
                className="btn"
                style={{ padding: "10px 28px", fontSize: 13, opacity: loading ? 0.6 : 1 }}
              >
                {loading ? (
                  <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <Zap size={13} style={{ animation: "pulseGold 0.8s ease-in-out infinite" }} />
                    Cargando…
                  </span>
                ) : (
                  `Cargar más (mostrando ${items.length} de ${totalInLib.toLocaleString("es-ES")})`
                )}
              </button>
            </div>
          )}
        </>
      )}

      {/* ── COPIED TOAST ── */}
      {copiedMsg && (
        <div style={{
          position: "fixed", bottom: 28, left: "50%", transform: "translateX(-50%)",
          background: "var(--ink2)", border: "1px solid rgba(74,222,128,0.3)",
          borderRadius: 10, padding: "10px 18px",
          fontSize: 12, color: "#4ade80", fontWeight: 600,
          display: "flex", alignItems: "center", gap: 7,
          boxShadow: "0 8px 24px rgba(0,0,0,0.4)", zIndex: 9999,
          animation: "fadeSlideUp 0.2s ease-out",
        }}>
          <Check size={14} />
          {copiedMsg}
        </div>
      )}

      {/* ── INFO PANEL ── */}
      <div className="glass-card" style={{ padding: "20px 24px", marginTop: 8, display: "flex", gap: 24, flexWrap: "wrap" }}>
        {[
          { icon: <BookOpen size={16} />, label: "Librería Maestra", value: `${totalTemplates.toLocaleString("es-ES")} prompts`, color: "var(--gold)" },
          { icon: <Sparkles size={16} />, label: "Categorías activas", value: `${libIndex.length || EFFECT_CATEGORIES.length - 1}`, color: "#a78bfa" },
          { icon: <Star size={16} />, label: "Motores IA", value: "Claude · GPT · Gemini · Flux", color: "var(--jade)" },
          { icon: <Hash size={16} />, label: "Casos de uso", value: "Copy · SEO · Imagen · Email · Ad", color: "#f59e0b" },
          { icon: <Clock size={16} />, label: "Actualización", value: "Continua · IA aprendiendo", color: "#06b6d4" },
        ].map(item => (
          <div key={item.label} style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 160 }}>
            <div style={{ color: item.color, flexShrink: 0 }}>{item.icon}</div>
            <div>
              <p style={{ fontSize: 11, color: "var(--t3)", marginBottom: 1 }}>{item.label}</p>
              <p style={{ fontSize: 12, fontWeight: 700, color: "var(--t)" }}>{item.value}</p>
            </div>
          </div>
        ))}
      </div>

      <style>{`
        @keyframes fadeSlideUp {
          from { opacity: 0; transform: translateX(-50%) translateY(8px); }
          to   { opacity: 1; transform: translateX(-50%) translateY(0); }
        }
      `}</style>
    </div>
  );
}
