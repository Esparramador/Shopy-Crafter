import { useState, useRef, useEffect } from "react";
import { Cpu, Zap, BarChart3, Play, StopCircle, Copy, Check, ChevronDown, Sparkles, Brain, RefreshCw, Settings, AlertCircle, Loader2 } from "lucide-react";

const API_BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

interface AIModel {
  id: string;
  name: string;
  provider: string;
  category: string;
  contextWindow: number;
  maxOutput: number;
  strengths: string[];
  speed: "ultra-fast" | "fast" | "medium" | "slow";
  costTier: "free" | "low" | "medium" | "high" | "very-high";
  supportsStreaming: boolean;
  supportsVision: boolean;
  supportsTools: boolean;
  description: string;
}

interface GenerationResult {
  modelId: string;
  modelName: string;
  provider: string;
  content: string;
  tokensUsed?: number;
  latencyMs?: number;
  error?: string;
}

const PROVIDER_COLORS: Record<string, string> = {
  anthropic: "#f59e0b",
  openai: "#4ade80",
  google: "#60a5fa",
  deepseek: "#a78bfa",
  xai: "#f87171",
  mistral: "#fb923c",
  groq: "#34d399",
};

const SPEED_LABELS: Record<string, { label: string; color: string }> = {
  "ultra-fast": { label: "Ultra Rápido", color: "#4ade80" },
  fast: { label: "Rápido", color: "#86efac" },
  medium: { label: "Medio", color: "#fbbf24" },
  slow: { label: "Lento", color: "#f87171" },
};

const COST_LABELS: Record<string, { label: string; color: string }> = {
  free: { label: "Gratis", color: "#4ade80" },
  low: { label: "Bajo", color: "#86efac" },
  medium: { label: "Medio", color: "#fbbf24" },
  high: { label: "Alto", color: "#fb923c" },
  "very-high": { label: "Muy Alto", color: "#f87171" },
};

export default function AMRStudio() {
  const [models, setModels] = useState<AIModel[]>([]);
  const [loading, setLoading] = useState(true);
  const [prompt, setPrompt] = useState("");
  const [systemPrompt, setSystemPrompt] = useState("Eres un experto en e-commerce y Shopify. Responde siempre en español de forma concisa y práctica.");
  const [selectedModels, setSelectedModels] = useState<string[]>([]);
  const [results, setResults] = useState<GenerationResult[]>([]);
  const [generating, setGenerating] = useState(false);
  const [streamingResult, setStreamingResult] = useState<{ modelId: string; content: string } | null>(null);
  const [activeTab, setActiveTab] = useState<"catalog" | "compare" | "single">("catalog");
  const [filterProvider, setFilterProvider] = useState("");
  const [filterCategory, setFilterCategory] = useState("");
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const streamRef = useRef<EventSource | null>(null);

  useEffect(() => {
    fetchModels();
  }, []);

  async function fetchModels() {
    try {
      const r = await fetch(`${API_BASE}/api/amr/models`, { credentials: "include" });
      if (!r.ok) throw new Error("Error cargando modelos");
      const data = await r.json();
      setModels(data.models || []);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Error desconocido");
    } finally {
      setLoading(false);
    }
  }

  async function generateSingle(modelId: string) {
    if (!prompt.trim()) return;
    setGenerating(true);
    setStreamingResult({ modelId, content: "" });
    setActiveTab("single");

    try {
      const evtSource = new EventSource(
        `${API_BASE}/api/amr/stream?modelId=${encodeURIComponent(modelId)}&prompt=${encodeURIComponent(prompt)}&system=${encodeURIComponent(systemPrompt)}`
      );
      streamRef.current = evtSource;

      evtSource.onmessage = (e) => {
        const data = JSON.parse(e.data);
        if (data.done) {
          evtSource.close();
          setGenerating(false);
        } else if (data.chunk) {
          setStreamingResult(prev => prev ? { ...prev, content: prev.content + data.chunk } : null);
        }
      };
      evtSource.onerror = () => {
        evtSource.close();
        setGenerating(false);
      };
    } catch {
      setGenerating(false);
    }
  }

  async function compareModels() {
    if (!prompt.trim() || selectedModels.length === 0) return;
    setGenerating(true);
    setResults([]);
    setActiveTab("compare");

    try {
      const r = await fetch(`${API_BASE}/api/amr/compare`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ modelIds: selectedModels, prompt, systemPrompt }),
      });
      const data = await r.json();
      setResults(data.results || []);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Error en comparación");
    } finally {
      setGenerating(false);
    }
  }

  function copyText(text: string, id: string) {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  }

  function toggleModel(id: string) {
    setSelectedModels(prev =>
      prev.includes(id) ? prev.filter(m => m !== id) : [...prev, id]
    );
  }

  const providers = [...new Set(models.map(m => m.provider))];
  const categories = [...new Set(models.map(m => m.category))];
  const filtered = models.filter(m =>
    (!filterProvider || m.provider === filterProvider) &&
    (!filterCategory || m.category === filterCategory)
  );

  return (
    <div style={{ padding: "24px", maxWidth: 1400, margin: "0 auto" }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 24 }}>
        <div style={{
          width: 44, height: 44, borderRadius: 12,
          background: "linear-gradient(135deg, var(--gold), #b45309)",
          display: "flex", alignItems: "center", justifyContent: "center",
        }}>
          <Cpu size={22} color="#000" />
        </div>
        <div>
          <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700, color: "var(--t1)" }}>AMR Studio</h1>
          <p style={{ margin: 0, fontSize: 13, color: "var(--t3)" }}>AI Model Router — {models.length} modelos disponibles</p>
        </div>
        <button
          onClick={fetchModels}
          style={{ marginLeft: "auto", background: "var(--s2)", border: "1px solid var(--border)", borderRadius: 8, padding: "8px 14px", color: "var(--t2)", cursor: "pointer", display: "flex", alignItems: "center", gap: 6, fontSize: 13 }}
        >
          <RefreshCw size={14} /> Actualizar
        </button>
      </div>

      {error && (
        <div style={{ background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.3)", borderRadius: 10, padding: "12px 16px", marginBottom: 16, color: "#f87171", display: "flex", gap: 8, alignItems: "center" }}>
          <AlertCircle size={16} /> {error}
        </div>
      )}

      {/* Prompt area */}
      <div style={{ background: "var(--s1)", border: "1px solid var(--border)", borderRadius: 14, padding: 20, marginBottom: 20 }}>
        <div style={{ fontSize: 12, color: "var(--t3)", marginBottom: 6, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em" }}>PROMPT DEL SISTEMA</div>
        <textarea
          value={systemPrompt}
          onChange={e => setSystemPrompt(e.target.value)}
          style={{ width: "100%", background: "var(--s2)", border: "1px solid var(--border)", borderRadius: 8, padding: "10px 12px", color: "var(--t1)", fontSize: 13, resize: "vertical", minHeight: 60, boxSizing: "border-box" }}
        />
        <div style={{ fontSize: 12, color: "var(--t3)", marginTop: 12, marginBottom: 6, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em" }}>PROMPT DE USUARIO</div>
        <textarea
          value={prompt}
          onChange={e => setPrompt(e.target.value)}
          placeholder="Escribe tu prompt aquí... Ej: Dame 5 ideas de descripción de producto para zapatillas deportivas premium"
          style={{ width: "100%", background: "var(--s2)", border: "1px solid var(--border)", borderRadius: 8, padding: "10px 12px", color: "var(--t1)", fontSize: 13, resize: "vertical", minHeight: 100, boxSizing: "border-box" }}
        />
        <div style={{ display: "flex", gap: 10, marginTop: 12, flexWrap: "wrap" }}>
          <button
            onClick={compareModels}
            disabled={generating || selectedModels.length === 0 || !prompt.trim()}
            style={{
              background: selectedModels.length > 0 && prompt.trim() ? "var(--gold)" : "var(--s2)",
              color: selectedModels.length > 0 && prompt.trim() ? "#000" : "var(--t3)",
              border: "none", borderRadius: 8, padding: "10px 18px", fontSize: 13, fontWeight: 700,
              cursor: selectedModels.length > 0 && prompt.trim() ? "pointer" : "not-allowed",
              display: "flex", alignItems: "center", gap: 6,
            }}
          >
            {generating ? <Loader2 size={14} style={{ animation: "spin 0.6s linear infinite" }} /> : <BarChart3 size={14} />}
            Comparar ({selectedModels.length} seleccionados)
          </button>
          <span style={{ fontSize: 12, color: "var(--t3)", alignSelf: "center" }}>
            Selecciona modelos del catálogo para comparar, o usa el ▶ de cada modelo para generar individualmente.
          </span>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: "flex", gap: 2, marginBottom: 20 }}>
        {[
          { key: "catalog", label: "Catálogo de Modelos", icon: "🤖" },
          { key: "compare", label: `Comparativa (${results.length})`, icon: "⚖️" },
          { key: "single", label: "Generación Streaming", icon: "⚡" },
        ].map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key as typeof activeTab)}
            style={{
              padding: "9px 16px", borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: "pointer",
              background: activeTab === tab.key ? "var(--gold)" : "var(--s1)",
              color: activeTab === tab.key ? "#000" : "var(--t2)",
              border: activeTab === tab.key ? "none" : "1px solid var(--border)",
            }}
          >
            {tab.icon} {tab.label}
          </button>
        ))}
      </div>

      {/* Catalog Tab */}
      {activeTab === "catalog" && (
        <>
          {/* Filters */}
          <div style={{ display: "flex", gap: 10, marginBottom: 16, flexWrap: "wrap" }}>
            <select
              value={filterProvider}
              onChange={e => setFilterProvider(e.target.value)}
              style={{ background: "var(--s1)", border: "1px solid var(--border)", borderRadius: 8, padding: "8px 12px", color: "var(--t1)", fontSize: 13 }}
            >
              <option value="">Todos los proveedores</option>
              {providers.map(p => <option key={p} value={p}>{p}</option>)}
            </select>
            <select
              value={filterCategory}
              onChange={e => setFilterCategory(e.target.value)}
              style={{ background: "var(--s1)", border: "1px solid var(--border)", borderRadius: 8, padding: "8px 12px", color: "var(--t1)", fontSize: 13 }}
            >
              <option value="">Todas las categorías</option>
              {categories.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
            <span style={{ alignSelf: "center", fontSize: 12, color: "var(--t3)" }}>{filtered.length} modelos</span>
            {selectedModels.length > 0 && (
              <button
                onClick={() => setSelectedModels([])}
                style={{ background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.3)", borderRadius: 8, padding: "8px 12px", color: "#f87171", fontSize: 12, cursor: "pointer" }}
              >
                Limpiar selección ({selectedModels.length})
              </button>
            )}
          </div>

          {loading ? (
            <div style={{ textAlign: "center", padding: "60px 0", color: "var(--t3)" }}>
              <Loader2 size={28} style={{ animation: "spin 0.6s linear infinite", color: "var(--gold)" }} />
              <div style={{ marginTop: 12 }}>Cargando modelos...</div>
            </div>
          ) : (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(340px, 1fr))", gap: 14 }}>
              {filtered.map(model => {
                const isSelected = selectedModels.includes(model.id);
                const provColor = PROVIDER_COLORS[model.provider] || "var(--gold)";
                const speed = SPEED_LABELS[model.speed];
                const cost = COST_LABELS[model.costTier];
                return (
                  <div
                    key={model.id}
                    style={{
                      background: isSelected ? "rgba(212,175,55,0.06)" : "var(--s1)",
                      border: isSelected ? "1.5px solid var(--gold)" : "1px solid var(--border)",
                      borderRadius: 12, padding: 16,
                      cursor: "pointer", transition: "all 0.15s",
                    }}
                    onClick={() => toggleModel(model.id)}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
                      <div style={{
                        background: `${provColor}22`, border: `1px solid ${provColor}44`,
                        borderRadius: 8, padding: "4px 10px", fontSize: 11, fontWeight: 700, color: provColor,
                      }}>
                        {model.provider.toUpperCase()}
                      </div>
                      <div style={{ flex: 1, fontWeight: 700, fontSize: 14, color: "var(--t1)" }}>{model.name}</div>
                      {isSelected && <div style={{ width: 18, height: 18, borderRadius: "50%", background: "var(--gold)", display: "flex", alignItems: "center", justifyContent: "center" }}>✓</div>}
                    </div>
                    <div style={{ fontSize: 12, color: "var(--t3)", marginBottom: 10 }}>{model.description}</div>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 10 }}>
                      {model.strengths.slice(0, 3).map(s => (
                        <span key={s} style={{ background: "var(--s2)", borderRadius: 4, padding: "2px 7px", fontSize: 11, color: "var(--t2)" }}>{s}</span>
                      ))}
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 12, fontSize: 11 }}>
                      <span style={{ color: speed?.color }}>{speed?.label}</span>
                      <span style={{ color: "var(--t3)" }}>·</span>
                      <span style={{ color: cost?.color }}>{cost?.label}</span>
                      <span style={{ color: "var(--t3)" }}>·</span>
                      <span style={{ color: "var(--t3)" }}>{(model.contextWindow / 1000).toFixed(0)}k ctx</span>
                      <button
                        onClick={e => { e.stopPropagation(); generateSingle(model.id); }}
                        disabled={generating || !prompt.trim()}
                        style={{
                          marginLeft: "auto", background: prompt.trim() ? "var(--jade)" : "var(--s2)",
                          border: "none", borderRadius: 6, padding: "4px 10px", fontSize: 11,
                          color: prompt.trim() ? "#fff" : "var(--t3)", cursor: prompt.trim() ? "pointer" : "not-allowed",
                          display: "flex", alignItems: "center", gap: 4,
                        }}
                      >
                        <Play size={10} /> Stream
                      </button>
                    </div>
                    <div style={{ display: "flex", gap: 6, marginTop: 8 }}>
                      {model.supportsVision && <span title="Visión" style={{ fontSize: 10, background: "rgba(96,165,250,0.15)", color: "#60a5fa", padding: "2px 6px", borderRadius: 4 }}>👁 Vision</span>}
                      {model.supportsTools && <span title="Herramientas" style={{ fontSize: 10, background: "rgba(167,139,250,0.15)", color: "#a78bfa", padding: "2px 6px", borderRadius: 4 }}>🔧 Tools</span>}
                      {model.supportsStreaming && <span title="Streaming" style={{ fontSize: 10, background: "rgba(52,211,153,0.15)", color: "#34d399", padding: "2px 6px", borderRadius: 4 }}>⚡ Stream</span>}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}

      {/* Compare Tab */}
      {activeTab === "compare" && (
        <div>
          {results.length === 0 ? (
            <div style={{ textAlign: "center", padding: "60px 0", color: "var(--t3)" }}>
              {generating ? (
                <><Loader2 size={28} style={{ animation: "spin 0.6s linear infinite", color: "var(--gold)" }} /><div style={{ marginTop: 12 }}>Generando con {selectedModels.length} modelos...</div></>
              ) : (
                <><BarChart3 size={40} style={{ color: "var(--t4)", marginBottom: 12 }} /><div>Selecciona modelos en el catálogo y haz clic en "Comparar"</div></>
              )}
            </div>
          ) : (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(400px, 1fr))", gap: 16 }}>
              {results.map(res => (
                <div key={res.modelId} style={{ background: "var(--s1)", border: "1px solid var(--border)", borderRadius: 12, overflow: "hidden" }}>
                  <div style={{ padding: "12px 16px", borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center", gap: 10 }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 700, fontSize: 14, color: "var(--t1)" }}>{res.modelName}</div>
                      <div style={{ fontSize: 11, color: "var(--t3)" }}>{res.provider}</div>
                    </div>
                    {res.latencyMs && <span style={{ fontSize: 11, color: "var(--jade)" }}>{res.latencyMs}ms</span>}
                    {res.tokensUsed && <span style={{ fontSize: 11, color: "var(--t3)" }}>{res.tokensUsed} tokens</span>}
                    <button onClick={() => copyText(res.content, res.modelId)} style={{ background: "var(--s2)", border: "1px solid var(--border)", borderRadius: 6, padding: "4px 8px", cursor: "pointer", color: "var(--t2)" }}>
                      {copiedId === res.modelId ? <Check size={12} color="var(--jade)" /> : <Copy size={12} />}
                    </button>
                  </div>
                  <div style={{ padding: 16 }}>
                    {res.error ? (
                      <div style={{ color: "#f87171", fontSize: 13 }}>⚠ {res.error}</div>
                    ) : (
                      <pre style={{ margin: 0, fontSize: 13, color: "var(--t1)", whiteSpace: "pre-wrap", fontFamily: "inherit", lineHeight: 1.6 }}>{res.content}</pre>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Single Streaming Tab */}
      {activeTab === "single" && (
        <div style={{ background: "var(--s1)", border: "1px solid var(--border)", borderRadius: 14, padding: 20 }}>
          {!streamingResult ? (
            <div style={{ textAlign: "center", padding: "40px 0", color: "var(--t3)" }}>
              <Zap size={36} style={{ color: "var(--t4)", marginBottom: 12 }} />
              <div>Usa el botón "▶ Stream" en cualquier modelo del catálogo para ver la generación en tiempo real</div>
            </div>
          ) : (
            <>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                <div style={{ fontWeight: 700, color: "var(--t1)", display: "flex", alignItems: "center", gap: 8 }}>
                  <Sparkles size={16} color="var(--gold)" />
                  {models.find(m => m.id === streamingResult.modelId)?.name || streamingResult.modelId}
                  {generating && <Loader2 size={14} style={{ animation: "spin 0.6s linear infinite", color: "var(--gold)" }} />}
                </div>
                <button onClick={() => copyText(streamingResult.content, "stream")} style={{ background: "var(--s2)", border: "1px solid var(--border)", borderRadius: 6, padding: "6px 10px", cursor: "pointer", color: "var(--t2)", display: "flex", alignItems: "center", gap: 4, fontSize: 12 }}>
                  {copiedId === "stream" ? <><Check size={12} color="var(--jade)" /> Copiado</> : <><Copy size={12} /> Copiar</>}
                </button>
              </div>
              <pre style={{ margin: 0, fontSize: 13.5, color: "var(--t1)", whiteSpace: "pre-wrap", fontFamily: "inherit", lineHeight: 1.7, minHeight: 200 }}>
                {streamingResult.content}
                {generating && <span style={{ animation: "pulse 1s ease-in-out infinite", color: "var(--gold)" }}>▋</span>}
              </pre>
            </>
          )}
        </div>
      )}
    </div>
  );
}
