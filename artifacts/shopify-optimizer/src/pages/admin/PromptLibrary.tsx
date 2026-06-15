import { useState, useEffect, useCallback, useRef } from "react";
import { Search, Copy, Check, Zap, Filter, ChevronDown, BookOpen, Sparkles, Star, Clock, Hash, Play, X, ChevronRight, AlertCircle, Loader2, Brain, Code2 } from "lucide-react";

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

interface Project {
  id: number;
  name: string;
  shopDomain?: string;
}

interface PromptVar {
  name: string;
  value: string | null;
  resolved: boolean;
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
  { key: "trail_of_bits_security", label: "Seguridad (Trail of Bits)", icon: "🛡️", color: "#ef4444", desc: "27 skills profesionales de auditoría y seguridad — código, supply chain, criptografía" },
  { key: "claude_code_agents_ecc", label: "Agentes Claude Code", icon: "🤖", color: "#8b5cf6", desc: "64 agentes especializados — reviewers, architects, resolvers, optimizers para cada lenguaje" },
  { key: "dev_workflow_skills", label: "Skills de Desarrollo", icon: "⚙️", color: "#0ea5e9", desc: "19 skills de workflow — API design, backend patterns, DB migrations, git workflow" },
  { key: "animate_css_library", label: "Animaciones CSS (97)", icon: "✨", color: "#f59e0b", desc: "97 animaciones de animate.css — bounce, fade, flip, rotate, zoom. CDN + JS patterns" },
  { key: "hover_css_library", label: "Hover Effects CSS (80)", icon: "🖱️", color: "#10b981", desc: "80 efectos hover de hover.css — 2D/3D transitions, underlines, backgrounds, bubbles" },
  { key: "awesome_claude_code", label: "Awesome Claude Code", icon: "⭐", color: "#f97316", desc: "30 recursos curados del registry — top agent skills, workflows, MCP servers y templates" },
];

const ENGINE_COLORS: Record<string, string> = {
  claude: "#fbbf24",
  gpt: "#4ade80",
  gemini: "#60a5fa",
  midjourney: "#a78bfa",
  flux: "#f87171",
  default: "var(--t3)",
};

function highlightVars(text: string): React.ReactNode[] {
  const parts = text.split(/(\{\{[A-Z_]+\}\})/g);
  return parts.map((part, i) =>
    /^\{\{[A-Z_]+\}\}$/.test(part)
      ? <mark key={i} style={{ background: "rgba(200,168,75,0.2)", color: "var(--gold)", borderRadius: 3, padding: "0 3px", fontWeight: 700 }}>{part}</mark>
      : <span key={i}>{part}</span>
  );
}

function VarBadge({ v }: { v: PromptVar }) {
  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 6,
      padding: "4px 8px", borderRadius: 6,
      background: v.resolved ? "rgba(74,222,128,0.08)" : "rgba(248,113,113,0.08)",
      border: `1px solid ${v.resolved ? "rgba(74,222,128,0.2)" : "rgba(248,113,113,0.2)"}`,
      fontSize: 11,
    }}>
      <span style={{ color: v.resolved ? "#4ade80" : "#f87171", fontWeight: 700, fontFamily: "monospace" }}>
        {`{{${v.name}}}`}
      </span>
      {v.resolved
        ? <span style={{ color: "var(--t3)", maxWidth: 140, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>→ {v.value}</span>
        : <span style={{ color: "#f87171" }}>sin resolver</span>
      }
    </div>
  );
}

function ExecutionPanel({
  item,
  projects,
  onClose,
}: {
  item: MasterItem;
  projects: Project[];
  onClose: () => void;
}) {
  const [selectedProjectId, setSelectedProjectId] = useState<number | "">(projects[0]?.id ?? "");
  const [vars, setVars] = useState<PromptVar[]>([]);
  const [loadingVars, setLoadingVars] = useState(false);
  const [executing, setExecuting] = useState(false);
  const [result, setResult] = useState("");
  const [error, setError] = useState("");
  const [customVars, setCustomVars] = useState<Record<string, string>>({});
  const [copied, setCopied] = useState(false);
  const resultRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  const template = item.prompt ?? item.description ?? item.name;

  const loadVars = useCallback(async (projectId: number | "") => {
    if (!template) return;
    setLoadingVars(true);
    setVars([]);
    try {
      const r = await fetch(`${API_BASE}/api/prompt-library/preview-vars`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ template, projectId: projectId || undefined }),
      });
      if (r.ok) {
        const d = await r.json();
        setVars(d.vars ?? []);
      }
    } catch {}
    setLoadingVars(false);
  }, [template]);

  useEffect(() => {
    loadVars(selectedProjectId);
  }, [selectedProjectId, loadVars]);

  const handleExecute = async () => {
    if (!template) return;
    setExecuting(true);
    setResult("");
    setError("");
    abortRef.current = new AbortController();

    try {
      const response = await fetch(`${API_BASE}/api/prompt-library/execute`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        signal: abortRef.current.signal,
        body: JSON.stringify({
          template,
          projectId: selectedProjectId || undefined,
          customVars,
          saveToMemory: false,
        }),
      });

      if (!response.ok) {
        const err = await response.json().catch(() => ({ error: "Error desconocido" }));
        setError(err.error ?? "Error ejecutando prompt");
        setExecuting(false);
        return;
      }

      const reader = response.body?.getReader();
      if (!reader) { setError("Sin stream"); setExecuting(false); return; }
      const decoder = new TextDecoder();
      let buffer = "";
      let fullText = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";
        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          try {
            const msg = JSON.parse(line.slice(6));
            if (msg.type === "delta") {
              fullText += msg.text;
              setResult(fullText);
              if (resultRef.current) {
                resultRef.current.scrollTop = resultRef.current.scrollHeight;
              }
            } else if (msg.type === "error") {
              setError(msg.message ?? "Error");
            } else if (msg.type === "meta") {
              if (msg.unresolvedVars?.length > 0) {
                setVars(prev => prev.map(v =>
                  msg.unresolvedVars.includes(v.name) ? { ...v, resolved: false } : v
                ));
              }
            }
          } catch {}
        }
      }
    } catch (err: any) {
      if (err.name !== "AbortError") setError(err.message ?? "Error");
    }
    setExecuting(false);
  };

  const handleStop = () => {
    abortRef.current?.abort();
    setExecuting(false);
  };

  const handleCopyResult = () => {
    navigator.clipboard.writeText(result).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };

  const resolvedCount = vars.filter(v => v.resolved).length;
  const totalVars = vars.length;

  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 1000,
      display: "flex", alignItems: "stretch",
      background: "rgba(0,0,0,0.7)", backdropFilter: "blur(4px)",
    }} onClick={e => { if (e.target === e.currentTarget) onClose(); }}>

      <div style={{
        marginLeft: "auto",
        width: "min(680px, 96vw)",
        background: "var(--ink)",
        borderLeft: "1px solid var(--bdr)",
        display: "flex", flexDirection: "column",
        overflow: "hidden",
        animation: "slideInRight 0.2s ease-out",
      }}>

        {/* Header */}
        <div style={{
          padding: "18px 20px", borderBottom: "1px solid var(--bdr)",
          display: "flex", alignItems: "flex-start", gap: 12,
        }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
              <span style={{
                fontSize: 9, padding: "2px 7px", borderRadius: 4,
                background: "rgba(200,168,75,0.12)", color: "var(--gold)",
                fontWeight: 700, textTransform: "uppercase",
              }}>
                Ejecutar con DNA ✨
              </span>
              {item.engine && (
                <span style={{
                  fontSize: 9, padding: "1px 6px", borderRadius: 3,
                  background: `${ENGINE_COLORS[item.engine?.toLowerCase() ?? ""] ?? ENGINE_COLORS.default}18`,
                  color: ENGINE_COLORS[item.engine?.toLowerCase() ?? ""] ?? ENGINE_COLORS.default,
                  fontWeight: 700, textTransform: "uppercase",
                }}>
                  {item.engine}
                </span>
              )}
            </div>
            <h2 style={{ fontSize: 15, fontWeight: 800, color: "var(--t)", lineHeight: 1.3 }}>
              {item.name}
            </h2>
          </div>
          <button onClick={onClose} style={{ background: "none", border: "none", color: "var(--t3)", cursor: "pointer", padding: 4, flexShrink: 0 }}>
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div style={{ flex: 1, overflow: "auto", padding: "18px 20px", display: "flex", flexDirection: "column", gap: 16 }}>

          {/* Project Selector */}
          <div>
            <label style={{ fontSize: 11, fontWeight: 700, color: "var(--t3)", textTransform: "uppercase", letterSpacing: "0.8px", display: "block", marginBottom: 6 }}>
              Proyecto cliente
            </label>
            {projects.length === 0 ? (
              <p style={{ fontSize: 12, color: "var(--t4)" }}>Sin proyectos. El prompt se ejecutará sin DNA de marca.</p>
            ) : (
              <select
                value={selectedProjectId}
                onChange={e => setSelectedProjectId(e.target.value ? Number(e.target.value) : "")}
                className="form-input"
                style={{ width: "100%", fontSize: 13 }}
              >
                <option value="">— Sin proyecto (prompt genérico) —</option>
                {projects.map(p => (
                  <option key={p.id} value={p.id}>{p.name} {p.shopDomain ? `(${p.shopDomain})` : ""}</option>
                ))}
              </select>
            )}
          </div>

          {/* Variable Resolution Status */}
          {(loadingVars || vars.length > 0) && (
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 8 }}>
                <label style={{ fontSize: 11, fontWeight: 700, color: "var(--t3)", textTransform: "uppercase", letterSpacing: "0.8px" }}>
                  Variables DNA
                </label>
                {!loadingVars && totalVars > 0 && (
                  <span style={{
                    fontSize: 10, padding: "1px 7px", borderRadius: 10,
                    background: resolvedCount === totalVars ? "rgba(74,222,128,0.1)" : "rgba(248,113,113,0.1)",
                    color: resolvedCount === totalVars ? "#4ade80" : "#f87171",
                    fontWeight: 700,
                  }}>
                    {resolvedCount}/{totalVars} resueltas
                  </span>
                )}
              </div>
              {loadingVars ? (
                <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: "var(--t4)" }}>
                  <Loader2 size={12} style={{ animation: "spin 0.8s linear infinite" }} />
                  Analizando DNA del proyecto…
                </div>
              ) : (
                <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
                  {vars.map(v => <VarBadge key={v.name} v={v} />)}
                </div>
              )}
              {vars.some(v => !v.resolved) && (
                <div style={{ marginTop: 10 }}>
                  <p style={{ fontSize: 11, color: "var(--t4)", marginBottom: 6 }}>
                    Variables sin resolver — completa manualmente:
                  </p>
                  <div style={{ display: "grid", gap: 5 }}>
                    {vars.filter(v => !v.resolved).map(v => (
                      <div key={v.name} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <span style={{ fontSize: 11, fontFamily: "monospace", color: "var(--gold)", width: 140, flexShrink: 0 }}>
                          {`{{${v.name}}}`}
                        </span>
                        <input
                          value={customVars[v.name] ?? ""}
                          onChange={e => setCustomVars(prev => ({ ...prev, [v.name]: e.target.value }))}
                          placeholder={`Valor para ${v.name}…`}
                          className="form-input"
                          style={{ flex: 1, fontSize: 11, padding: "5px 10px" }}
                        />
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Prompt Preview */}
          <div>
            <label style={{ fontSize: 11, fontWeight: 700, color: "var(--t3)", textTransform: "uppercase", letterSpacing: "0.8px", display: "block", marginBottom: 6 }}>
              Template
            </label>
            <div style={{
              padding: "12px 14px", borderRadius: 8,
              background: "var(--ink2)", border: "1px solid var(--bdr)",
              fontSize: 12, color: "var(--t2)", lineHeight: 1.7,
              fontFamily: "monospace", whiteSpace: "pre-wrap", wordBreak: "break-word",
              maxHeight: 200, overflow: "auto",
            }}>
              {highlightVars(template)}
            </div>
          </div>

          {/* Result */}
          {(result || executing) && (
            <div>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
                <label style={{ fontSize: 11, fontWeight: 700, color: "var(--t3)", textTransform: "uppercase", letterSpacing: "0.8px" }}>
                  Resultado IA
                  {executing && <span style={{ marginLeft: 6, fontSize: 9, color: "var(--gold)", animation: "pulse 1s infinite" }}>• GENERANDO</span>}
                </label>
                {result && !executing && (
                  <button
                    onClick={handleCopyResult}
                    className="btn"
                    style={{ fontSize: 10, padding: "3px 10px", display: "flex", alignItems: "center", gap: 4 }}
                  >
                    {copied ? <Check size={11} /> : <Copy size={11} />}
                    {copied ? "Copiado" : "Copiar"}
                  </button>
                )}
              </div>
              <div
                ref={resultRef}
                style={{
                  padding: "14px 16px", borderRadius: 8,
                  background: "var(--ink2)", border: "1px solid rgba(200,168,75,0.2)",
                  fontSize: 13, color: "var(--t)", lineHeight: 1.75,
                  whiteSpace: "pre-wrap", wordBreak: "break-word",
                  maxHeight: 340, overflow: "auto",
                  minHeight: 80,
                }}
              >
                {result}
                {executing && <span style={{ display: "inline-block", width: 8, height: 14, background: "var(--gold)", borderRadius: 1, marginLeft: 2, animation: "blink 0.7s infinite" }} />}
              </div>
            </div>
          )}

          {error && (
            <div style={{
              display: "flex", alignItems: "flex-start", gap: 8,
              padding: "10px 12px", borderRadius: 8,
              background: "rgba(248,113,113,0.08)", border: "1px solid rgba(248,113,113,0.2)",
            }}>
              <AlertCircle size={14} style={{ color: "#f87171", flexShrink: 0, marginTop: 1 }} />
              <p style={{ fontSize: 12, color: "#f87171" }}>{error}</p>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div style={{
          padding: "14px 20px", borderTop: "1px solid var(--bdr)",
          display: "flex", gap: 8, alignItems: "center",
        }}>
          {executing ? (
            <button
              onClick={handleStop}
              className="btn"
              style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 6, color: "#f87171", borderColor: "rgba(248,113,113,0.3)" }}
            >
              <X size={13} /> Detener
            </button>
          ) : (
            <button
              onClick={handleExecute}
              className="btn-primary"
              disabled={!template}
              style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 7, fontSize: 13, padding: "10px" }}
            >
              <Zap size={14} />
              {selectedProjectId ? "Ejecutar con DNA del cliente" : "Ejecutar prompt"}
            </button>
          )}
          <button onClick={onClose} className="btn" style={{ padding: "10px 16px" }}>
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
}

function EffectPreviewCard({
  item,
  onCopy,
  onExecute,
  dnaMode,
}: {
  item: MasterItem;
  onCopy: (text: string) => void;
  onExecute: (item: MasterItem) => void;
  dnaMode: boolean;
}) {
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

  const handleExecute = (e: React.MouseEvent) => {
    e.stopPropagation();
    onExecute(item);
  };

  const hasVars = /\{\{[A-Z_]+\}\}/.test(item.prompt ?? item.description ?? "");

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
            {hasVars && dnaMode && (
              <span style={{
                fontSize: 9, padding: "1px 6px", borderRadius: 3,
                background: "rgba(200,168,75,0.1)", color: "var(--gold)",
                fontWeight: 700, flexShrink: 0,
              }}>
                DNA ✨
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
              {dnaMode ? highlightVars(item.prompt) : item.prompt}
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

        <div style={{ display: "flex", flexDirection: "column", gap: 4, flexShrink: 0 }}>
          {dnaMode && (
            <button
              onClick={handleExecute}
              title="Ejecutar con DNA del cliente"
              style={{
                background: "rgba(200,168,75,0.1)",
                border: "1px solid rgba(200,168,75,0.3)",
                borderRadius: 7, padding: "6px 8px", cursor: "pointer",
                color: "var(--gold)", transition: "all 0.15s",
                display: "flex", alignItems: "center", gap: 4, fontSize: 11, fontWeight: 700,
              }}
              onMouseOver={e => { e.currentTarget.style.background = "rgba(200,168,75,0.2)"; }}
              onMouseOut={e => { e.currentTarget.style.background = "rgba(200,168,75,0.1)"; }}
            >
              <Zap size={12} />
            </button>
          )}
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
  const [dnaMode, setDnaMode] = useState(false);
  const [projects, setProjects] = useState<Project[]>([]);
  const [executingItem, setExecutingItem] = useState<MasterItem | null>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const LIMIT = 24;

  const loadItems = useCallback(async (key: string, q: string, off: number, append = false) => {
    if (!key && !q.trim()) {
      if (!append) setItems([]);
      setHasMore(false);
      setTotalInLib(0);
      return;
    }
    setLoading(true);
    try {
      const params = new URLSearchParams({ limit: String(LIMIT), offset: String(off) });
      if (key) params.set("library", key);
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
      const r = await fetch(`${API_BASE}/api/fs-pro/prompt-library-master?indexOnly=1`, { credentials: "include" });
      if (r.ok) {
        const d = await r.json();
        let idx: LibIndex[] = [];
        if (Array.isArray(d)) {
          idx = d;
        } else if (Array.isArray(d.libraries)) {
          idx = d.libraries.map((l: any) => ({ key: l.key ?? l.name ?? "", count: l.count ?? l.total ?? 0 }));
        } else if (d.libraries && typeof d.libraries === "object") {
          idx = Object.entries(d.libraries).map(([k, v]: [string, any]) => ({
            key: k,
            count: Array.isArray(v?.templates) ? v.templates.length : (v?.count ?? 0),
          }));
        }
        setLibIndex(idx);
      }
    } catch {}
  }, []);

  const loadProjects = useCallback(async () => {
    try {
      const r = await fetch(`${API_BASE}/api/projects`, { credentials: "include" });
      if (r.ok) {
        const d = await r.json();
        setProjects(Array.isArray(d) ? d : (d.projects ?? []));
      }
    } catch {}
  }, []);

  useEffect(() => {
    loadIndex();
    loadProjects();
  }, [loadIndex, loadProjects]);

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

  const totalTemplates = libIndex.reduce((s, l) => s + l.count, 0) || 6677;

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
          <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
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

            {/* DNA MODE TOGGLE */}
            <button
              onClick={() => setDnaMode(m => !m)}
              style={{
                display: "flex", alignItems: "center", gap: 6,
                padding: "6px 14px", borderRadius: 20, cursor: "pointer",
                background: dnaMode ? "rgba(200,168,75,0.15)" : "var(--ink2)",
                border: dnaMode ? "1px solid rgba(200,168,75,0.4)" : "1px solid var(--bdr)",
                color: dnaMode ? "var(--gold)" : "var(--t3)",
                fontWeight: 700, fontSize: 12,
                transition: "all 0.15s",
                boxShadow: dnaMode ? "0 0 12px rgba(200,168,75,0.15)" : "none",
              }}
            >
              <Brain size={13} />
              {dnaMode ? "Modo DNA ✦ Activo" : "Modo DNA"}
            </button>
          </div>
        </div>
        <p style={{ fontSize: 13, color: "var(--t3)" }}>
          {dnaMode
            ? "🧬 Modo DNA activo — pulsa ⚡ en cualquier template para ejecutarlo con el ADN del cliente."
            : "Explora y copia templates de IA para producto, copy, SEO, email, ads y mucho más."}
        </p>
      </div>

      {/* ── DNA MODE BANNER ── */}
      {dnaMode && (
        <div style={{
          padding: "14px 18px", borderRadius: 12, marginBottom: 20,
          background: "linear-gradient(135deg, rgba(200,168,75,0.08), rgba(200,168,75,0.04))",
          border: "1px solid rgba(200,168,75,0.25)",
          display: "flex", alignItems: "center", gap: 12,
        }}>
          <div style={{ fontSize: 28 }}>🧬</div>
          <div style={{ flex: 1 }}>
            <p style={{ fontSize: 13, fontWeight: 700, color: "var(--gold)", marginBottom: 3 }}>
              Ejecución con DNA de Marca activada
            </p>
            <p style={{ fontSize: 12, color: "var(--t3)", lineHeight: 1.5 }}>
              Todas las variables <code style={{ fontSize: 11, background: "rgba(200,168,75,0.15)", padding: "1px 4px", borderRadius: 3 }}>{"{{VARIABLE}}"}</code> se resuelven automáticamente con el ADN del cliente seleccionado (nombre, sector, tono, colores, UVP, audiencia, redes sociales…). El resultado es contenido 100% personalizado, no genérico.
              {projects.length > 0 && <> Tienes <strong style={{ color: "var(--t)" }}>{projects.length} proyectos</strong> disponibles.</>}
            </p>
          </div>
          <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
            <span style={{ fontSize: 11, padding: "4px 10px", borderRadius: 8, background: "rgba(74,222,128,0.1)", color: "#4ade80", fontWeight: 700 }}>
              ⚡ = Ejecutar
            </span>
            <span style={{ fontSize: 11, padding: "4px 10px", borderRadius: 8, background: "rgba(200,168,75,0.1)", color: "var(--gold)", fontWeight: 700 }}>
              DNA ✨ = Con variables
            </span>
          </div>
        </div>
      )}

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
              <EffectPreviewCard
                key={item.id ?? i}
                item={item}
                onCopy={handleCopy}
                onExecute={setExecutingItem}
                dnaMode={dnaMode}
              />
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
          { icon: <Brain size={16} />, label: "Modo DNA", value: dnaMode ? "✦ Activo" : "Inactivo", color: dnaMode ? "var(--gold)" : "var(--t4)" },
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

      {/* ── EXECUTION PANEL ── */}
      {executingItem && (
        <ExecutionPanel
          item={executingItem}
          projects={projects}
          onClose={() => setExecutingItem(null)}
        />
      )}

      <style>{`
        @keyframes fadeSlideUp {
          from { opacity: 0; transform: translateX(-50%) translateY(8px); }
          to   { opacity: 1; transform: translateX(-50%) translateY(0); }
        }
        @keyframes slideInRight {
          from { transform: translateX(100%); opacity: 0; }
          to   { transform: translateX(0); opacity: 1; }
        }
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
        @keyframes blink {
          0%, 100% { opacity: 1; }
          50% { opacity: 0; }
        }
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.4; }
        }
      `}</style>
    </div>
  );
}
