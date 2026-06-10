import { useState, useCallback } from "react";
import{ Search, Globe, Instagram, Store, ExternalLink, Loader2, Download, Clock, ChevronRight, Sparkles, Building2, ArrowRight, Eye }from "lucide-react";
import { useListProjects } from "@workspace/api-client-react";

const API_BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

interface ResearchResult {
  entity: { name: string; type: string; url?: string; instagramHandle?: string };
  sections: { title: string; content: string }[];
  savedFileId?: number;
  duration?: number;
}

interface RecentSearch {
  input: string;
  entityName: string;
  date: string;
  fileId?: number;
}

export default function UniversalSearch() {
  const { data: projects } = useListProjects();
  const activeProjectId = projects?.[0]?.id ?? 0;
  const [input, setInput] = useState("");
  const [niche, setNiche] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ResearchResult | null>(null);
  const [error, setError] = useState("");
  const [recentSearches, setRecentSearches] = useState<RecentSearch[]>(() => {
    try {
      return JSON.parse(localStorage.getItem("sc_recent_searches") || "[]");
    } catch { return []; }
  });

  const saveRecent = useCallback((search: RecentSearch) => {
    setRecentSearches(prev => {
      const updated = [search, ...prev.filter(s => s.input !== search.input)].slice(0, 20);
      localStorage.setItem("sc_recent_searches", JSON.stringify(updated));
      return updated;
    });
  }, []);

  const detectInputType = (val: string): { icon: typeof Globe; label: string; color: string } => {
    const v = val.trim().toLowerCase();
    if (v.startsWith("@") || v.includes("instagram.com")) return { icon: Instagram, label: "Instagram", color: "#e040fb" };
    if (v.includes(".myshopify.com") || v.includes("shopify")) return { icon: Store, label: "Shopify", color: "#95bf47" };
    if (v.includes("http") || v.includes(".com") || v.includes(".es") || v.includes(".")) return { icon: Globe, label: "URL / Web", color: "#3b82f6" };
    return { icon: Building2, label: "Marca / Empresa", color: "#c8a84b" };
  };

  const handleSearch = async () => {
    if (!input.trim()) return;
    setLoading(true);
    setError("");
    setResult(null);

    try {
      const res = await fetch(`${API_BASE}/api/shopybrain/research-entity-sync`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          input: input.trim(),
          niche: niche.trim() || undefined,
          market: "es",
          projectId: activeProjectId || undefined,
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || `Error ${res.status}`);
      }

      const data = await res.json();
      setResult(data);

      saveRecent({
        input: input.trim(),
        entityName: data.entity?.name || input.trim(),
        date: new Date().toISOString(),
        fileId: data.savedFileId,
      });
    } catch (err: any) {
      setError(err.message || "Error en la búsqueda");
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !loading) handleSearch();
  };

  const inputType = detectInputType(input);
  const InputIcon = inputType.icon;

  return (
    <div style={{ padding: "28px 32px", maxWidth: 1100, margin: "0 auto" }}>
      <div style={{ marginBottom: 28 }}>
        <h1 style={{ fontSize: 26, fontWeight: 800, color: "#f5f5f7", display: "flex", alignItems: "center", gap: 10, margin: 0 }}>
          <Search size={26} style={{ color: "#c4956a" }} />
          Buscador Universal
        </h1>
        <p style={{ fontSize: 14, color: "#8b8b9e", marginTop: 6 }}>
          Busca y analiza cualquier tienda, URL, Instagram o marca. Sin necesidad de tener un proyecto activo.
        </p>
      </div>

      <div style={{
        background: "linear-gradient(135deg, #111118 0%, #161622 100%)",
        border: "1px solid #1e1e2e", borderRadius: 16, padding: 24, marginBottom: 24,
      }}>
        <div style={{ display: "flex", gap: 12, marginBottom: 16, flexWrap: "wrap" }}>
          <div style={{
            flex: 1, minWidth: "min(250px, 100%)", display: "flex", alignItems: "center", gap: 10,
            background: "#0c0c14", border: "1px solid #2a2a3a", borderRadius: 12,
            padding: "0 16px",
          }}>
            <InputIcon size={20} style={{ color: inputType.color, flexShrink: 0 }} />
            <input
              type="text"
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="URL, tienda Shopify, @instagram, nombre de marca..."
              style={{
                flex: 1, background: "none", border: "none", color: "#f5f5f7",
                fontSize: 15, padding: "14px 0", outline: "none",
              }}
            />
            {input && (
              <span style={{
                fontSize: 11, fontWeight: 600, padding: "3px 8px", borderRadius: 6,
                background: `${inputType.color}18`, color: inputType.color,
                whiteSpace: "nowrap",
              }}>
                {inputType.label}
              </span>
            )}
          </div>
          <input
            type="text"
            value={niche}
            onChange={e => setNiche(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Nicho (opcional)"
            style={{
              width: "min(160px, 100%)", background: "#0c0c14", border: "1px solid #2a2a3a", borderRadius: 12,
              padding: "14px 16px", color: "#f5f5f7", fontSize: 14, outline: "none",
            }}
          />
          <button
            onClick={handleSearch}
            disabled={loading || !input.trim()}
            style={{
              background: loading ? "#333" : "linear-gradient(135deg, #c4956a, #a07850)",
              border: "none", borderRadius: 12, padding: "14px 24px", cursor: loading ? "default" : "pointer",
              color: "#fff", fontWeight: 700, fontSize: 15, display: "flex", alignItems: "center", gap: 8,
              opacity: !input.trim() ? 0.5 : 1, whiteSpace: "nowrap",
            }}
          >
            {loading ? <Loader2 size={18} style={{ animation: "spin 1s linear infinite" }} /> : <Search size={18} />}
            {loading ? "Analizando..." : "Buscar"}
          </button>
        </div>

        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {[
            { text: "comic-crafter.myshopify.com", icon: "🛒" },
            { text: "@tu-tienda", icon: "📸" },
            { text: "zara.com/es", icon: "🌐" },
            { text: "Nike España", icon: "🏢" },
          ].map(ex => (
            <button
              key={ex.text}
              onClick={() => setInput(ex.text)}
              style={{
                background: "#1a1a28", border: "1px solid #2a2a3a", borderRadius: 8,
                padding: "6px 12px", cursor: "pointer", color: "#8b8b9e",
                fontSize: 12, display: "flex", alignItems: "center", gap: 4,
                transition: "all 0.15s",
              }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = "#c4956a"; (e.currentTarget as HTMLElement).style.color = "#c4956a"; }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = "#2a2a3a"; (e.currentTarget as HTMLElement).style.color = "#8b8b9e"; }}
            >
              <span>{ex.icon}</span> {ex.text}
            </button>
          ))}
        </div>
      </div>

      {loading && (
        <div style={{
          background: "#111118", border: "1px solid #1e1e2e", borderRadius: 14,
          padding: 40, textAlign: "center", marginBottom: 24,
        }}>
          <Loader2 size={36} style={{ color: "#c4956a", animation: "spin 1s linear infinite", marginBottom: 14 }} />
          <p style={{ fontSize: 16, fontWeight: 600, color: "#f5f5f7", marginBottom: 6 }}>
            Investigación AI en curso...
          </p>
          <p style={{ fontSize: 13, color: "#8b8b9e" }}>
            Buscando en Google, analizando presencia digital, redes sociales, SEO, competencia...
          </p>
          <div style={{
            display: "flex", gap: 8, justifyContent: "center", marginTop: 16, flexWrap: "wrap",
          }}>
            {["SEO", "Redes Sociales", "Competencia", "Productos", "Branding", "Tecnología"].map(dim => (
              <span key={dim} style={{
                fontSize: 11, padding: "4px 10px", borderRadius: 6,
                background: "rgba(196,149,106,0.08)", color: "#c4956a",
                border: "1px solid rgba(196,149,106,0.15)",
              }}>
                {dim}
              </span>
            ))}
          </div>
        </div>
      )}

      {error && (
        <div style={{
          background: "rgba(232,69,88,0.08)", border: "1px solid rgba(232,69,88,0.2)",
          borderRadius: 12, padding: "16px 20px", color: "#e84558", marginBottom: 24,
        }}>
          {error}
        </div>
      )}

      {result && (
        <div style={{ marginBottom: 24 }}>
          <div style={{
            background: "linear-gradient(135deg, #111118, #161622)", border: "1px solid #1e1e2e",
            borderRadius: 14, padding: 20, marginBottom: 16,
            display: "flex", alignItems: "center", gap: 16,
          }}>
            <div style={{
              width: 52, height: 52, borderRadius: 14,
              background: "rgba(196,149,106,0.12)", display: "flex", alignItems: "center", justifyContent: "center",
            }}>
              <Sparkles size={24} style={{ color: "#c4956a" }} />
            </div>
            <div style={{ flex: 1 }}>
              <h2 style={{ fontSize: 18, fontWeight: 700, color: "#f5f5f7", margin: 0 }}>
                {result.entity?.name || "Resultado"}
              </h2>
              <div style={{ fontSize: 13, color: "#8b8b9e", marginTop: 3, display: "flex", gap: 8, flexWrap: "wrap" }}>
                {result.entity?.type && (
                  <span style={{
                    padding: "2px 8px", borderRadius: 4, background: "rgba(59,130,246,0.12)", color: "#3b82f6",
                    fontSize: 11, fontWeight: 600,
                  }}>
                    {result.entity.type}
                  </span>
                )}
                {result.entity?.url && (
                  <a
                    href={result.entity.url.startsWith("http") ? result.entity.url : `https://${result.entity.url}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{ color: "#8b8b9e", display: "flex", alignItems: "center", gap: 3, textDecoration: "none" }}
                  >
                    {result.entity.url} <ExternalLink size={12} />
                  </a>
                )}
                {result.duration && (
                  <span style={{ display: "flex", alignItems: "center", gap: 3 }}>
                    <Clock size={12} /> {(result.duration / 1000).toFixed(1)}s
                  </span>
                )}
              </div>
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              {result.savedFileId && (
                <>
                  <button
                    onClick={() => window.open(`${API_BASE}/api/vault/global/${result.savedFileId}/download`, "_blank")}
                    style={{
                      background: "rgba(59,130,246,0.1)", border: "1px solid rgba(59,130,246,0.2)",
                      borderRadius: 8, padding: "8px 14px", cursor: "pointer", color: "#3b82f6",
                      display: "flex", alignItems: "center", gap: 6, fontSize: 13, fontWeight: 600,
                    }}
                  >
                    <Eye size={14} /> Ver
                  </button>
                  <button
                    onClick={() => {
                      const a = document.createElement("a");
                      a.href = `${API_BASE}/api/vault/global/${result.savedFileId}/download`;
                      a.download = `${result.entity?.name || "research"}.html`;
                      a.click();
                    }}
                    style={{
                      background: "rgba(200,168,75,0.1)", border: "1px solid rgba(200,168,75,0.2)",
                      borderRadius: 8, padding: "8px 14px", cursor: "pointer", color: "#c8a84b",
                      display: "flex", alignItems: "center", gap: 6, fontSize: 13, fontWeight: 600,
                    }}
                  >
                    <Download size={14} /> Descargar
                  </button>
                </>
              )}
            </div>
          </div>

          {result.sections && result.sections.length > 0 && (
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {result.sections.map((section, i) => (
                <details
                  key={i}
                  open={i < 3}
                  style={{
                    background: "#111118", border: "1px solid #1e1e2e", borderRadius: 12,
                    overflow: "hidden",
                  }}
                >
                  <summary style={{
                    padding: "14px 18px", cursor: "pointer", color: "#f5f5f7",
                    fontSize: 14, fontWeight: 600, display: "flex", alignItems: "center", gap: 8,
                    listStyle: "none",
                  }}>
                    <ChevronRight size={16} style={{ color: "#c4956a", transition: "transform 0.2s" }} />
                    {section.title}
                  </summary>
                  <div style={{
                    padding: "4px 18px 18px", color: "#d1d1d6", fontSize: 13,
                    lineHeight: 1.7, whiteSpace: "pre-wrap",
                  }}>
                    {section.content}
                  </div>
                </details>
              ))}
            </div>
          )}

          {(!result.sections || result.sections.length === 0) && result.entity && (
            <div style={{
              background: "#111118", border: "1px solid #1e1e2e", borderRadius: 12,
              padding: 20, color: "#d1d1d6", fontSize: 13, lineHeight: 1.7,
            }}>
              <p>Investigación completada. Los resultados se han guardado en la Bóveda Global.</p>
              <button
                onClick={() => window.location.href = `${import.meta.env.BASE_URL}admin/vault`}
                style={{
                  marginTop: 12, background: "rgba(200,168,75,0.1)", border: "1px solid rgba(200,168,75,0.2)",
                  borderRadius: 8, padding: "8px 16px", cursor: "pointer", color: "#c8a84b",
                  fontSize: 13, fontWeight: 600, display: "flex", alignItems: "center", gap: 6,
                }}
              >
                <ArrowRight size={14} /> Ir a Bóveda Global
              </button>
            </div>
          )}
        </div>
      )}

      {!loading && !result && recentSearches.length > 0 && (
        <div style={{
          background: "#111118", border: "1px solid #1e1e2e", borderRadius: 14, padding: 20,
        }}>
          <h3 style={{ fontSize: 14, fontWeight: 700, color: "#f5f5f7", marginTop: 0, marginBottom: 14, display: "flex", alignItems: "center", gap: 8 }}>
            <Clock size={16} style={{ color: "#8b8b9e" }} />
            Búsquedas recientes
          </h3>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {recentSearches.slice(0, 10).map((s, i) => {
              const type = detectInputType(s.input);
              const TypeIcon = type.icon;
              return (
                <button
                  key={i}
                  onClick={() => setInput(s.input)}
                  style={{
                    background: "none", border: "1px solid transparent", borderRadius: 8,
                    padding: "8px 12px", cursor: "pointer", textAlign: "left",
                    display: "flex", alignItems: "center", gap: 10, color: "#d1d1d6",
                    transition: "all 0.15s",
                  }}
                  onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = "#1a1a28"; (e.currentTarget as HTMLElement).style.borderColor = "#2a2a3a"; }}
                  onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = "none"; (e.currentTarget as HTMLElement).style.borderColor = "transparent"; }}
                >
                  <TypeIcon size={16} style={{ color: type.color, flexShrink: 0 }} />
                  <div style={{ flex: 1 }}>
                    <span style={{ fontSize: 13, fontWeight: 600 }}>{s.entityName}</span>
                    <span style={{ fontSize: 12, color: "#8b8b9e", marginLeft: 8 }}>{s.input}</span>
                  </div>
                  <span style={{ fontSize: 11, color: "#666" }}>
                    {new Date(s.date).toLocaleDateString("es-ES")}
                  </span>
                  <ArrowRight size={14} style={{ color: "#555" }} />
                </button>
              );
            })}
          </div>
        </div>
      )}

      {!loading && !result && recentSearches.length === 0 && (
        <div style={{
          background: "#111118", border: "1px solid #1e1e2e", borderRadius: 14,
          padding: 40, textAlign: "center",
        }}>
          <Globe size={40} style={{ color: "#c4956a", marginBottom: 12, opacity: 0.4 }} />
          <p style={{ fontSize: 16, fontWeight: 600, color: "#f5f5f7", marginBottom: 6 }}>
            Analiza cualquier negocio
          </p>
          <p style={{ fontSize: 13, color: "#8b8b9e", maxWidth: 500, margin: "0 auto" }}>
            Introduce una URL, tienda Shopify, cuenta de Instagram o nombre de marca.
            La IA investigará en profundidad y guardará los resultados en tu Bóveda Global.
          </p>
        </div>
      )}

      <style>{`
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        details[open] > summary svg:first-child { transform: rotate(90deg); }
      `}</style>
    </div>
  );
}
