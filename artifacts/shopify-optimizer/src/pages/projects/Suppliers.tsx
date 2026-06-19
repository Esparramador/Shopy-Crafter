import { useEffect, useState, useMemo } from "react";
import { useRoute } from "wouter";
import { Loader2, Search, Star, Trash2, Download, ExternalLink, Mail, Phone, Globe, Award, Sparkles, Settings, X } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { LiveOperation } from "@/components/LiveOperation";

const API_BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

function safeHttpUrl(raw: string | null | undefined): string | null {
  if (!raw || typeof raw !== "string") return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;
  try {
    const u = new URL(trimmed);
    if (u.protocol !== "http:" && u.protocol !== "https:") return null;
    return u.toString();
  } catch {
    if (/^[\w.-]+\.[a-z]{2,}(\/.*)?$/i.test(trimmed)) {
      try { return new URL(`https://${trimmed}`).toString(); } catch { return null; }
    }
    return null;
  }
}

function timeAgo(dateStr: string | null): string {
  if (!dateStr) return "—";
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "hace un momento";
  if (mins < 60) return `hace ${mins} min`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `hace ${hours}h`;
  const days = Math.floor(hours / 24);
  return `hace ${days} día${days > 1 ? "s" : ""}`;
}

function scoreColor(score: number): string {
  if (score >= 80) return "#14b8a6";
  if (score >= 60) return "#38bdf8";
  if (score >= 40) return "#f59e0b";
  return "#ef4444";
}

function scoreBg(score: number): string {
  if (score >= 80) return "#14b8a6";
  if (score >= 60) return "#38bdf8";
  if (score >= 40) return "#f59e0b";
  return "#ef4444";
}

type Entry = {
  id: string;
  researchId: string;
  name: string;
  category: string | null;
  country: string | null;
  region: string | null;
  website: string | null;
  contactEmail: string | null;
  contactPhone: string | null;
  productsOffered: string | null;
  priceRangeMin: number | null;
  priceRangeMax: number | null;
  currency: string | null;
  moq: string | null;
  leadDays: string | null;
  paymentTerms: string | null;
  shipsInternationally: number | null;
  certifications: string | null;
  score: number | null;
  source: string | null;
  sourceUrl: string | null;
  notes: string | null;
  starred: number | null;
  createdAt: string | null;
};

type Research = {
  id: string;
  niche: string | null;
  query: string | null;
  totalFound: number | null;
  status: string | null;
  createdAt: string | null;
};

const SEARCH_ENGINES = [
  { label: "Google Search (Gemini)", active: true },
  { label: "Claude IA (fallback)", active: true },
];

export default function Suppliers() {
  const [, params] = useRoute<{ id: string }>("/projects/:id/suppliers");
  const projectId = params?.id ?? "0";
  const { toast } = useToast();

  const [niche, setNiche] = useState("");
  const [customQuery, setCustomQuery] = useState("");
  const [country, setCountry] = useState("");
  const [running, setRunning] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [onlyStarred, setOnlyStarred] = useState(false);
  const [filterCat, setFilterCat] = useState<string>("all");
  const [sortBy, setSortBy] = useState<"score" | "price" | "name">("score");

  const [researches, setResearches] = useState<Research[]>([]);
  const [entries, setEntries] = useState<Entry[]>([]);
  const [loading, setLoading] = useState(false);
  const [lastSummary, setLastSummary] = useState<string | null>(null);
  const [lastSources, setLastSources] = useState<string[]>([]);
  const [lastEngine, setLastEngine] = useState<string | null>(null);
  const [searchError, setSearchError] = useState<string | null>(null);

  const load = async () => {
    if (!projectId) return;
    setLoading(true);
    try {
      const r = await fetch(`${API_BASE}/api/projects/${projectId}/suppliers`, { credentials: "include" });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const j = await r.json();
      setResearches(j.researches ?? []);
      setEntries(j.entries ?? []);
    } catch (err: any) {
      toast({ title: "Error cargando proveedores", description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [projectId]);

  const runSearch = async () => {
    if (!projectId) return;
    if (!niche.trim() && !customQuery.trim()) {
      toast({ title: "Indica un nicho o búsqueda", variant: "destructive" });
      return;
    }
    setRunning(true);
    setLastSummary(null);
    setLastSources([]);
    setLastEngine(null);
    setSearchError(null);
    try {
      const r = await fetch(`${API_BASE}/api/projects/${projectId}/suppliers/research`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ niche, customQuery, country }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || `HTTP ${r.status}`);
      setLastSummary(j.summary ?? null);
      setLastSources(j.sources ?? []);
      setLastEngine(j.engine ?? null);
      const engineLabel = j.engine === "claude-fallback" ? " (vía Claude IA)" : " (vía Google Search)";
      toast({ title: `${j.totalFound} proveedores encontrados${engineLabel}`, description: `Búsqueda completada en ${Math.round((j.elapsedMs ?? 0) / 1000)}s` });
      await load();
    } catch (err: any) {
      setSearchError(err.message);
      toast({ title: "Error en la búsqueda", description: err.message, variant: "destructive" });
    } finally {
      setRunning(false);
    }
  };

  const removeEntry = async (id: string) => {
    if (!confirm("¿Eliminar este proveedor del catálogo?")) return;
    try {
      const r = await fetch(`${API_BASE}/api/projects/${projectId}/suppliers/entry/${id}`, {
        method: "DELETE", credentials: "include",
      });
      if (!r.ok) throw new Error("delete failed");
      setEntries(prev => prev.filter(e => e.id !== id));
    } catch (err: any) {
      toast({ title: "No se pudo eliminar", description: err.message, variant: "destructive" });
    }
  };

  const toggleStar = async (entry: Entry) => {
    const next = entry.starred ? 0 : 1;
    setEntries(prev => prev.map(e => e.id === entry.id ? { ...e, starred: next } : e));
    try {
      await fetch(`${API_BASE}/api/projects/${projectId}/suppliers/entry/${entry.id}/star`, {
        method: "PATCH", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ starred: next === 1 }),
      });
    } catch {
      setEntries(prev => prev.map(e => e.id === entry.id ? { ...e, starred: entry.starred } : e));
    }
  };

  const downloadReport = async () => {
    if (!projectId) return;
    setDownloading(true);
    try {
      const r = await fetch(`${API_BASE}/api/projects/${projectId}/suppliers/report`, {
        method: "POST", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ onlyStarred }),
      });
      if (!r.ok) {
        const j = await r.json().catch(() => ({}));
        throw new Error(j.error || `HTTP ${r.status}`);
      }
      const blob = await r.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `proveedores-${projectId}.html`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err: any) {
      toast({ title: "Error descargando informe", description: err.message, variant: "destructive" });
    } finally {
      setDownloading(false);
    }
  };

  const categories = useMemo(() => Array.from(new Set(entries.map(e => e.category || "General"))).sort(), [entries]);

  const visible = useMemo(() => {
    let filtered = entries.filter(e => {
      if (onlyStarred && !e.starred) return false;
      if (filterCat !== "all" && (e.category || "General") !== filterCat) return false;
      return true;
    });
    filtered.sort((a, b) => {
      if (sortBy === "score") return (b.score ?? 0) - (a.score ?? 0);
      if (sortBy === "price") return (a.priceRangeMin ?? 999999) - (b.priceRangeMin ?? 999999);
      return (a.name ?? "").localeCompare(b.name ?? "");
    });
    return filtered;
  }, [entries, onlyStarred, filterCat, sortBy]);

  const kpis = useMemo(() => {
    const total = entries.length;
    const starred = entries.filter(e => e.starred).length;
    const withPrice = entries.filter(e => e.priceRangeMin != null);
    const avgPrice = withPrice.length > 0
      ? withPrice.reduce((s, e) => s + (e.priceRangeMin ?? 0), 0) / withPrice.length
      : 0;
    const minPrice = withPrice.length > 0
      ? Math.min(...withPrice.map(e => e.priceRangeMin ?? Infinity))
      : 0;
    const maxPrice = withPrice.length > 0
      ? Math.max(...withPrice.map(e => e.priceRangeMax ?? e.priceRangeMin ?? 0))
      : 0;
    const avgScore = entries.length > 0
      ? entries.reduce((s, e) => s + (e.score ?? 0), 0) / entries.length
      : 0;
    const uniqueSources = new Set(entries.map(e => e.source).filter(Boolean)).size;
    return { total, starred, avgPrice, minPrice, maxPrice, avgScore, uniqueSources };
  }, [entries]);

  const topSuppliers = useMemo(() => {
    return [...entries]
      .sort((a, b) => (b.score ?? 0) - (a.score ?? 0))
      .slice(0, 5);
  }, [entries]);

  const latestResearch = researches.length > 0 ? researches[0] : null;

  return (
    <div style={{ fontFamily: "-apple-system, system-ui, 'Segoe UI', sans-serif", background: "#0a0e1a", color: "#e2e8f0", padding: 24, borderRadius: 12, minHeight: "100vh" }}>

      {/* HEADER */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", paddingBottom: 20, borderBottom: "1px solid #1e293b", marginBottom: 24 }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
            <div style={{ width: 8, height: 8, background: "#14b8a6", borderRadius: "50%" }} />
            <span style={{ fontSize: 11, color: "#14b8a6", letterSpacing: 1.5, fontWeight: 600 }}>SUPPLIER INTELLIGENCE · v2.0</span>
          </div>
          <h1 style={{ fontSize: 22, fontWeight: 600, color: "#f1f5f9", margin: "0 0 4px", letterSpacing: -0.4 }}>Análisis Comparativo de Proveedores</h1>
          <p style={{ fontSize: 13, color: "#64748b", margin: 0 }}>
            {entries.length > 0
              ? `${entries.length} proveedores indexados · ${categories.length} categorías · ${kpis.uniqueSources} fuentes`
              : "Investigación profunda multi-fuente con IA"
            }
          </p>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button
            onClick={() => {
              const el = document.getElementById("supplier-search");
              el?.scrollIntoView({ behavior: "smooth" });
              el?.querySelector("input")?.focus();
            }}
            style={{ background: "#14b8a6", color: "#0a0e1a", border: "none", padding: "8px 14px", borderRadius: 6, fontSize: 12, fontWeight: 600, cursor: "pointer" }}
          >+ Nueva búsqueda</button>
          <button
            onClick={() => setSortBy(prev => prev === "score" ? "price" : prev === "price" ? "name" : "score")}
            style={{ background: "transparent", color: "#cbd5e1", border: "1px solid #334155", padding: "8px 14px", borderRadius: 6, fontSize: 12, fontWeight: 500, cursor: "pointer" }}
          >
            <Settings size={12} style={{ display: "inline", verticalAlign: -1, marginRight: 4 }} />
            Orden: {sortBy === "score" ? "Score" : sortBy === "price" ? "Precio" : "Nombre"}
          </button>
        </div>
      </div>

      {/* BÚSQUEDA MULTI-FUENTE */}
      <div id="supplier-search" style={{ background: "#0f172a", border: "1px solid #1e293b", borderRadius: 10, padding: 16, marginBottom: 20 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
          <span style={{ fontSize: 12, color: "#94a3b8", fontWeight: 600, letterSpacing: 0.5 }}>BÚSQUEDA MULTI-FUENTE</span>
          {latestResearch && (
            <span style={{ fontSize: 11, color: "#64748b" }}>
              Última ejecución: {timeAgo(latestResearch.createdAt)} · {latestResearch.totalFound ?? 0} proveedores indexados
            </span>
          )}
        </div>
        <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
          <input
            type="text"
            value={niche || customQuery}
            onChange={e => { setNiche(e.target.value); setCustomQuery(""); }}
            placeholder="Buscar proveedores por nicho, producto, región..."
            disabled={running}
            style={{ flex: 1, background: "#1e293b", border: "1px solid #334155", borderRadius: 6, padding: "10px 12px", color: "#e2e8f0", fontSize: 13, outline: "none" }}
          />
          <input
            type="text"
            value={country}
            onChange={e => setCountry(e.target.value)}
            placeholder="País (opcional)"
            disabled={running}
            style={{ width: 140, background: "#1e293b", border: "1px solid #334155", borderRadius: 6, padding: "10px 12px", color: "#e2e8f0", fontSize: 13, outline: "none" }}
          />
          <button
            onClick={runSearch}
            disabled={running}
            style={{
              background: running ? "#475569" : "#14b8a6", color: "#0a0e1a", border: "none", padding: "0 18px",
              borderRadius: 6, fontSize: 12, fontWeight: 600, cursor: running ? "wait" : "pointer",
              display: "flex", alignItems: "center", gap: 6,
            }}
          >
            {running ? <Loader2 size={14} className="animate-spin" /> : <Search size={14} />}
            {running ? "Buscando…" : "Buscar →"}
          </button>
        </div>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
          {SEARCH_ENGINES.map(s => (
            <span key={s.label} style={{
              background: s.active ? "#14b8a620" : "#1e293b",
              color: s.active ? "#14b8a6" : "#64748b",
              padding: "4px 10px", borderRadius: 4, fontSize: 11,
              border: s.active ? "1px solid #14b8a640" : "1px solid #334155",
              fontWeight: 500,
            }}>
              {s.active ? "\u2713" : "+"} {s.label}
            </span>
          ))}
          {lastEngine && (
            <span style={{
              background: lastEngine === "gemini-search" ? "#14b8a615" : "#f59e0b15",
              color: lastEngine === "gemini-search" ? "#14b8a6" : "#f59e0b",
              padding: "4px 10px", borderRadius: 4, fontSize: 11,
              border: `1px solid ${lastEngine === "gemini-search" ? "#14b8a640" : "#f59e0b40"}`,
              fontWeight: 600,
            }}>
              Motor usado: {lastEngine === "gemini-search" ? "Google Search" : "Claude IA"}
            </span>
          )}
        </div>
        {searchError && (
          <div style={{ marginTop: 8, padding: 10, background: "#ef444415", border: "1px solid #ef444440", borderRadius: 6, fontSize: 12, color: "#fca5a5" }}>
            {searchError}
          </div>
        )}
        <LiveOperation
          active={running}
          title="Buscando proveedores reales en internet"
          estimatedSec={45}
          messages={[
            "Consultando Google con tu nicho/búsqueda…",
            "Filtrando resultados con dominios reales y datos de contacto…",
            "Extrayendo email/teléfono/web/categoría con IA…",
            "Eliminando duplicados y marketplaces genéricos…",
            "Guardando proveedores nuevos en tu catálogo…",
          ]}
          className="w-full"
        />
        {lastSummary && (
          <div style={{ marginTop: 12, padding: 10, background: "#1e293b", borderRadius: 6, fontSize: 12, lineHeight: 1.5, color: "#cbd5e1" }}>
            <strong style={{ color: "#14b8a6" }}>Resumen IA:</strong> {lastSummary}
          </div>
        )}
        {lastSources.length > 0 && (
          <div style={{ marginTop: 8, fontSize: 11, color: "#14b8a6" }}>
            🔗 {lastSources.length} fuentes reales verificadas
          </div>
        )}
      </div>

      {loading ? (
        <div style={{ textAlign: "center", padding: 80 }}>
          <Loader2 size={28} className="animate-spin" style={{ margin: "0 auto", color: "#14b8a6" }} />
          <p style={{ color: "#64748b", fontSize: 13, marginTop: 12 }}>Cargando catálogo de proveedores…</p>
        </div>
      ) : entries.length === 0 ? (
        <div style={{ textAlign: "center", padding: 80, background: "#0f172a", borderRadius: 12, border: "1px solid #1e293b" }}>
          <Sparkles size={32} style={{ color: "#14b8a6", margin: "0 auto 12px" }} />
          <p style={{ color: "#94a3b8", fontSize: 14, marginBottom: 4 }}>
            No hay proveedores indexados aún
          </p>
          <p style={{ color: "#475569", fontSize: 12 }}>
            Lanza tu primera búsqueda multi-fuente para descubrir proveedores reales
          </p>
        </div>
      ) : (
        <>
          {/* KPIs */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12, marginBottom: 24 }}>
            <div style={{ background: "#0f172a", border: "1px solid #1e293b", borderLeft: "3px solid #14b8a6", borderRadius: 8, padding: 14 }}>
              <div style={{ fontSize: 10, color: "#64748b", letterSpacing: 1, marginBottom: 6, fontWeight: 600 }}>PROVEEDORES INDEXADOS</div>
              <div style={{ fontSize: 24, fontWeight: 600, color: "#f1f5f9" }}>{kpis.total}</div>
              <div style={{ fontSize: 11, color: "#14b8a6", marginTop: 4 }}>
                {kpis.starred > 0 ? `★ ${kpis.starred} favoritos` : `${categories.length} categorías`}
              </div>
            </div>
            <div style={{ background: "#0f172a", border: "1px solid #1e293b", borderLeft: "3px solid #38bdf8", borderRadius: 8, padding: 14 }}>
              <div style={{ fontSize: 10, color: "#64748b", letterSpacing: 1, marginBottom: 6, fontWeight: 600 }}>PRECIO PROMEDIO</div>
              <div style={{ fontSize: 24, fontWeight: 600, color: "#f1f5f9" }}>
                {kpis.avgPrice > 0 ? `€${kpis.avgPrice.toFixed(2)}` : "—"}
              </div>
              <div style={{ fontSize: 11, color: "#38bdf8", marginTop: 4 }}>
                {kpis.minPrice > 0 ? `Rango: €${kpis.minPrice.toFixed(2)} — €${kpis.maxPrice.toFixed(2)}` : "Sin datos de precio"}
              </div>
            </div>
            <div style={{ background: "#0f172a", border: "1px solid #1e293b", borderLeft: "3px solid #f59e0b", borderRadius: 8, padding: 14 }}>
              <div style={{ fontSize: 10, color: "#64748b", letterSpacing: 1, marginBottom: 6, fontWeight: 600 }}>SCORE PROMEDIO</div>
              <div style={{ fontSize: 24, fontWeight: 600, color: "#f1f5f9" }}>
                {kpis.avgScore > 0 ? kpis.avgScore.toFixed(1) : "—"}
              </div>
              <div style={{ fontSize: 11, color: "#f59e0b", marginTop: 4 }}>
                {topSuppliers[0]?.name ? `Top: ${topSuppliers[0].name.slice(0, 20)}` : "Sin proveedores"}
              </div>
            </div>
            <div style={{ background: "#0f172a", border: "1px solid #1e293b", borderLeft: "3px solid #a78bfa", borderRadius: 8, padding: 14 }}>
              <div style={{ fontSize: 10, color: "#64748b", letterSpacing: 1, marginBottom: 6, fontWeight: 600 }}>BÚSQUEDAS REALIZADAS</div>
              <div style={{ fontSize: 24, fontWeight: 600, color: "#f1f5f9" }}>{researches.length}</div>
              <div style={{ fontSize: 11, color: "#a78bfa", marginTop: 4 }}>
                {kpis.uniqueSources} fuentes únicas
              </div>
            </div>
          </div>

          {/* FILTROS */}
          <div style={{ display: "flex", gap: 6, marginBottom: 16, flexWrap: "wrap", alignItems: "center" }}>
            <button
              onClick={() => setFilterCat("all")}
              style={{
                padding: "5px 12px", borderRadius: 4, border: "1px solid " + (filterCat === "all" ? "#14b8a640" : "#334155"),
                background: filterCat === "all" ? "#14b8a620" : "#1e293b",
                color: filterCat === "all" ? "#14b8a6" : "#94a3b8",
                fontSize: 11, fontWeight: 600, cursor: "pointer",
              }}
            >Todos ({entries.length})</button>
            {categories.map(c => {
              const count = entries.filter(e => (e.category || "General") === c).length;
              return (
                <button
                  key={c}
                  onClick={() => setFilterCat(c)}
                  style={{
                    padding: "5px 12px", borderRadius: 4, border: "1px solid " + (filterCat === c ? "#14b8a640" : "#334155"),
                    background: filterCat === c ? "#14b8a620" : "#1e293b",
                    color: filterCat === c ? "#14b8a6" : "#94a3b8",
                    fontSize: 11, fontWeight: 600, cursor: "pointer",
                  }}
                >{c} ({count})</button>
              );
            })}
            <div style={{ marginLeft: "auto", display: "flex", gap: 8, alignItems: "center" }}>
              <label style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 11, color: "#94a3b8", cursor: "pointer" }}>
                <input
                  type="checkbox"
                  checked={onlyStarred}
                  onChange={e => setOnlyStarred(e.target.checked)}
                  style={{ accentColor: "#14b8a6" }}
                />
                Solo favoritos
              </label>
              <span style={{ fontSize: 11, color: "#334155" }}>|</span>
              <span style={{ fontSize: 11, color: "#64748b" }}>
                Ordenar: <button onClick={() => setSortBy("score")} style={{ background: "none", border: "none", color: sortBy === "score" ? "#14b8a6" : "#64748b", fontSize: 11, cursor: "pointer", fontWeight: sortBy === "score" ? 600 : 400, padding: 0 }}>Score</button>
                {" · "}
                <button onClick={() => setSortBy("price")} style={{ background: "none", border: "none", color: sortBy === "price" ? "#14b8a6" : "#64748b", fontSize: 11, cursor: "pointer", fontWeight: sortBy === "price" ? 600 : 400, padding: 0 }}>Precio</button>
                {" · "}
                <button onClick={() => setSortBy("name")} style={{ background: "none", border: "none", color: sortBy === "name" ? "#14b8a6" : "#64748b", fontSize: 11, cursor: "pointer", fontWeight: sortBy === "name" ? 600 : 400, padding: 0 }}>Nombre</button>
              </span>
            </div>
          </div>

          {/* TABLA COMPARATIVA */}
          <div style={{ background: "#0f172a", border: "1px solid #1e293b", borderRadius: 10, padding: 16, marginBottom: 20 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
              <div>
                <div style={{ fontSize: 12, color: "#94a3b8", fontWeight: 600, letterSpacing: 0.5 }}>COMPARATIVA DE PROVEEDORES</div>
                <div style={{ fontSize: 11, color: "#64748b", marginTop: 2 }}>{visible.length} proveedores{filterCat !== "all" ? ` · ${filterCat}` : ""}</div>
              </div>
              <div style={{ display: "flex", gap: 6 }}>
                <span style={{ background: "#1e293b", color: "#cbd5e1", padding: "4px 8px", borderRadius: 4, fontSize: 10, border: "1px solid #334155" }}>Top {Math.min(visible.length, entries.length)}</span>
              </div>
            </div>
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                <thead>
                  <tr style={{ background: "#1e293b" }}>
                    <th style={{ textAlign: "left", padding: "10px 8px", color: "#94a3b8", fontWeight: 600, fontSize: 10, letterSpacing: 0.5 }}>PROVEEDOR</th>
                    <th style={{ textAlign: "left", padding: "10px 8px", color: "#94a3b8", fontWeight: 600, fontSize: 10, letterSpacing: 0.5 }}>CATEGORÍA</th>
                    <th style={{ textAlign: "right", padding: "10px 8px", color: "#94a3b8", fontWeight: 600, fontSize: 10, letterSpacing: 0.5 }}>PRECIO</th>
                    <th style={{ textAlign: "center", padding: "10px 8px", color: "#94a3b8", fontWeight: 600, fontSize: 10, letterSpacing: 0.5 }}>MOQ</th>
                    <th style={{ textAlign: "center", padding: "10px 8px", color: "#94a3b8", fontWeight: 600, fontSize: 10, letterSpacing: 0.5 }}>PLAZO</th>
                    <th style={{ textAlign: "center", padding: "10px 8px", color: "#94a3b8", fontWeight: 600, fontSize: 10, letterSpacing: 0.5 }}>SCORE</th>
                    <th style={{ textAlign: "center", padding: "10px 8px", color: "#94a3b8", fontWeight: 600, fontSize: 10, letterSpacing: 0.5 }}>CONTACTO</th>
                    <th style={{ textAlign: "center", padding: "10px 8px", color: "#94a3b8", fontWeight: 600, fontSize: 10, letterSpacing: 0.5 }}>ACC.</th>
                  </tr>
                </thead>
                <tbody>
                  {visible.map((e, i) => {
                    const isTop = i === 0 && (e.score ?? 0) >= 70;
                    return (
                      <tr
                        key={e.id}
                        style={{
                          background: isTop ? "#14b8a610" : "transparent",
                          borderLeft: isTop ? "3px solid #14b8a6" : "3px solid transparent",
                          borderBottom: i < visible.length - 1 ? "1px solid #1e293b" : "none",
                        }}
                      >
                        <td style={{ padding: "12px 8px", color: "#f1f5f9" }}>
                          <div style={{ fontWeight: 600 }}>{e.name}</div>
                          <div style={{ fontSize: 10, color: "#64748b" }}>
                            {[e.country, e.region].filter(Boolean).join(" · ") || "—"}
                          </div>
                        </td>
                        <td style={{ padding: "12px 8px", color: "#94a3b8", fontSize: 11 }}>
                          {e.category || "General"}
                        </td>
                        <td style={{ textAlign: "right", padding: "12px 8px", color: isTop ? "#14b8a6" : "#f1f5f9", fontWeight: isTop ? 700 : 400, fontSize: isTop ? 13 : 12 }}>
                          {e.priceRangeMin != null
                            ? `€${e.priceRangeMin}${e.priceRangeMax && e.priceRangeMax !== e.priceRangeMin ? `–${e.priceRangeMax}` : ""}`
                            : "—"}
                        </td>
                        <td style={{ textAlign: "center", padding: "12px 8px", color: "#cbd5e1", fontSize: 11 }}>{e.moq || "—"}</td>
                        <td style={{ textAlign: "center", padding: "12px 8px", color: "#cbd5e1", fontSize: 11 }}>{e.leadDays || "—"}</td>
                        <td style={{ textAlign: "center", padding: "12px 8px" }}>
                          {e.score != null ? (
                            <span style={{
                              background: scoreBg(e.score), color: e.score >= 40 ? "#0a0e1a" : "#fff",
                              padding: "3px 8px", borderRadius: 3, fontWeight: 600, fontSize: 11,
                            }}>{e.score}</span>
                          ) : <span style={{ color: "#475569" }}>—</span>}
                        </td>
                        <td style={{ textAlign: "center", padding: "12px 8px" }}>
                          <div style={{ display: "flex", gap: 6, justifyContent: "center" }}>
                            {(() => {
                              const w = safeHttpUrl(e.website);
                              return w ? (
                                <a href={w} target="_blank" rel="noopener noreferrer" title="Web" style={{ color: "#38bdf8" }}>
                                  <Globe size={13} />
                                </a>
                              ) : null;
                            })()}
                            {e.contactEmail && (
                              <a href={`mailto:${e.contactEmail}`} title={e.contactEmail} style={{ color: "#14b8a6" }}>
                                <Mail size={13} />
                              </a>
                            )}
                            {e.contactPhone && (
                              <a href={`tel:${e.contactPhone}`} title={e.contactPhone} style={{ color: "#a78bfa" }}>
                                <Phone size={13} />
                              </a>
                            )}
                          </div>
                        </td>
                        <td style={{ textAlign: "center", padding: "12px 8px" }}>
                          <div style={{ display: "flex", gap: 4, justifyContent: "center" }}>
                            <button onClick={() => toggleStar(e)} title={e.starred ? "Quitar favorito" : "Favorito"}
                              style={{ background: "none", border: "none", cursor: "pointer", padding: 2, lineHeight: 1 }}>
                              <Star size={14} fill={e.starred ? "#facc15" : "none"} color={e.starred ? "#eab308" : "#475569"} />
                            </button>
                            <button onClick={() => removeEntry(e.id)} title="Eliminar"
                              style={{ background: "none", border: "none", cursor: "pointer", padding: 2, lineHeight: 1 }}>
                              <Trash2 size={13} color="#475569" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* BOTTOM ROW: TOP 5 BREAKDOWN + AI INSIGHT */}
          {topSuppliers.length > 0 && (
            <div style={{ display: "grid", gridTemplateColumns: "1.4fr 1fr", gap: 16, marginBottom: 20 }}>
              {/* BARRAS DE SCORE */}
              <div style={{ background: "#0f172a", border: "1px solid #1e293b", borderRadius: 10, padding: 16 }}>
                <div style={{ fontSize: 12, color: "#94a3b8", fontWeight: 600, letterSpacing: 0.5, marginBottom: 4 }}>RANKING TOP PROVEEDORES</div>
                <div style={{ fontSize: 11, color: "#64748b", marginBottom: 16 }}>Score comparativo · Top {topSuppliers.length}</div>

                <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                  {topSuppliers.map((e, i) => {
                    const sc = e.score ?? 0;
                    const barWidth = sc > 0 ? Math.max(sc, 5) : 0;
                    return (
                      <div key={e.id}>
                        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, marginBottom: 4 }}>
                          <span style={{ color: "#f1f5f9" }}>{e.name}</span>
                          <span style={{ color: scoreColor(sc), fontWeight: 600 }}>{sc}/100</span>
                        </div>
                        <div style={{ display: "flex", height: 18, borderRadius: 4, overflow: "hidden", background: "#1e293b" }}>
                          <div style={{
                            background: `linear-gradient(90deg, ${scoreColor(sc)}, ${scoreColor(sc)}88)`,
                            width: `${barWidth}%`,
                            transition: "width 0.5s ease",
                          }} />
                        </div>
                        <div style={{ fontSize: 10, color: "#475569", marginTop: 2 }}>
                          {[e.category, e.country].filter(Boolean).join(" · ") || "—"}
                          {e.priceRangeMin != null && ` · €${e.priceRangeMin}`}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* AI INSIGHT */}
              <div style={{ background: "linear-gradient(135deg, #0f172a 0%, #14b8a608 100%)", border: "1px solid #14b8a640", borderRadius: 10, padding: 16 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                  <span style={{ fontSize: 12, color: "#14b8a6", fontWeight: 600, letterSpacing: 0.5 }}>⚡ AI INSIGHT</span>
                </div>
                <div style={{ fontSize: 11, color: "#64748b", marginBottom: 14 }}>Análisis basado en datos indexados</div>

                {topSuppliers[0] && (
                  <div style={{ background: "#14b8a615", border: "1px solid #14b8a640", borderRadius: 8, padding: 12, marginBottom: 12 }}>
                    <div style={{ fontSize: 10, color: "#94a3b8", letterSpacing: 0.5, marginBottom: 4 }}>MEJOR PROVEEDOR</div>
                    <div style={{ fontSize: 14, color: "#f1f5f9", fontWeight: 600 }}>{topSuppliers[0].name}</div>
                    <div style={{ fontSize: 11, color: "#14b8a6", marginTop: 2 }}>
                      Score {topSuppliers[0].score ?? "—"}/100
                      {topSuppliers[0].priceRangeMin != null && ` · desde €${topSuppliers[0].priceRangeMin}`}
                    </div>
                  </div>
                )}

                <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 8, marginBottom: 14 }}>
                  <div style={{ background: "#1e293b", borderRadius: 6, padding: 10 }}>
                    <div style={{ fontSize: 9, color: "#94a3b8", letterSpacing: 0.5 }}>TOTAL</div>
                    <div style={{ fontSize: 16, color: "#f1f5f9", fontWeight: 600, marginTop: 2 }}>{kpis.total}</div>
                    <div style={{ fontSize: 9, color: "#14b8a6" }}>proveedores</div>
                  </div>
                  <div style={{ background: "#1e293b", borderRadius: 6, padding: 10 }}>
                    <div style={{ fontSize: 9, color: "#94a3b8", letterSpacing: 0.5 }}>FAVORITOS</div>
                    <div style={{ fontSize: 16, color: "#f1f5f9", fontWeight: 600, marginTop: 2 }}>{kpis.starred}</div>
                    <div style={{ fontSize: 9, color: "#f59e0b" }}>seleccionados</div>
                  </div>
                </div>

                {kpis.avgPrice > 0 && (
                  <div style={{ borderTop: "1px solid #1e293b", paddingTop: 10 }}>
                    <div style={{ fontSize: 10, color: "#94a3b8", marginBottom: 6, fontWeight: 600 }}>RANGO DE PRECIOS</div>
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, marginBottom: 4 }}>
                      <span style={{ color: "#cbd5e1" }}>Mínimo:</span>
                      <span style={{ color: "#14b8a6", fontWeight: 600 }}>€{kpis.minPrice.toFixed(2)}</span>
                    </div>
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, marginBottom: 4 }}>
                      <span style={{ color: "#cbd5e1" }}>Promedio:</span>
                      <span style={{ color: "#f1f5f9", fontWeight: 600 }}>€{kpis.avgPrice.toFixed(2)}</span>
                    </div>
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11 }}>
                      <span style={{ color: "#cbd5e1" }}>Máximo:</span>
                      <span style={{ color: "#ef4444", fontWeight: 600 }}>€{kpis.maxPrice.toFixed(2)}</span>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* GENERAR INFORMES */}
          <div style={{ background: "#0f172a", border: "1px solid #1e293b", borderRadius: 10, padding: 16, marginBottom: 20 }}>
            <div style={{ fontSize: 12, color: "#94a3b8", fontWeight: 600, letterSpacing: 0.5, marginBottom: 12 }}>GENERAR INFORMES PROFESIONALES</div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 10 }}>
              <button
                onClick={downloadReport}
                disabled={downloading}
                style={{ background: "#1e293b", border: "1px solid #334155", borderRadius: 8, padding: 14, textAlign: "left", cursor: "pointer" }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                  <div style={{ width: 24, height: 24, background: "#14b8a620", borderRadius: 4, display: "flex", alignItems: "center", justifyContent: "center", color: "#14b8a6", fontSize: 11, fontWeight: 700 }}>
                    {downloading ? <Loader2 size={12} className="animate-spin" /> : "HTML"}
                  </div>
                  <span style={{ fontSize: 12, color: "#f1f5f9", fontWeight: 600 }}>Informe HTML</span>
                </div>
                <div style={{ fontSize: 10, color: "#64748b" }}>
                  {onlyStarred ? "Solo favoritos" : "Todos los proveedores"}
                </div>
              </button>
              <LiveOperation
                active={downloading}
                title="Generando análisis comparativo profesional"
                estimatedSec={75}
                messages={[
                  "Cargando datos de todos los proveedores escaneados…",
                  "Calculando estadísticas comparativas reales…",
                  "Analizando márgenes y revenue por proveedor con IA…",
                  "Cruzando datos: precios, scores, MOQ, lead times…",
                  "Generando matriz comparativa completa…",
                  "Calculando planes de contratación Starter/Growth/Scale…",
                  "Elaborando plan de recursos humanos y contratación…",
                  "Evaluando riesgos geográficos y financieros del portfolio…",
                  "Redactando recomendaciones estratégicas accionables…",
                  "Renderizando informe HTML con gráficos y tablas…",
                ]}
                className="w-full"
              />
              <button style={{ background: "#1e293b", border: "1px solid #334155", borderRadius: 8, padding: 14, textAlign: "left", cursor: "not-allowed", opacity: 0.5 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                  <div style={{ width: 24, height: 24, background: "#10b98120", borderRadius: 4, display: "flex", alignItems: "center", justifyContent: "center", color: "#10b981", fontSize: 11, fontWeight: 700 }}>XL</div>
                  <span style={{ fontSize: 12, color: "#f1f5f9", fontWeight: 600 }}>Excel COGS</span>
                </div>
                <div style={{ fontSize: 10, color: "#64748b" }}>Próximamente</div>
              </button>
              <button style={{ background: "#1e293b", border: "1px solid #334155", borderRadius: 8, padding: 14, textAlign: "left", cursor: "not-allowed", opacity: 0.5 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                  <div style={{ width: 24, height: 24, background: "#ef444420", borderRadius: 4, display: "flex", alignItems: "center", justifyContent: "center", color: "#ef4444", fontSize: 11, fontWeight: 700 }}>PPT</div>
                  <span style={{ fontSize: 12, color: "#f1f5f9", fontWeight: 600 }}>PowerPoint</span>
                </div>
                <div style={{ fontSize: 10, color: "#64748b" }}>Próximamente</div>
              </button>
              <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11, color: "#94a3b8", cursor: "pointer", padding: "0 14px" }}>
                <input type="checkbox" checked={onlyStarred} onChange={e => setOnlyStarred(e.target.checked)} style={{ accentColor: "#14b8a6" }} />
                Solo favoritos en informe
              </label>
            </div>
          </div>

          {/* HISTORIAL DE BÚSQUEDAS */}
          {researches.length > 0 && (
            <div style={{ background: "#0f172a", border: "1px solid #1e293b", borderRadius: 10, padding: 16 }}>
              <div style={{ fontSize: 12, color: "#94a3b8", fontWeight: 600, letterSpacing: 0.5, marginBottom: 12 }}>HISTORIAL DE BÚSQUEDAS · Memoria persistente</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {researches.map((r, i) => (
                  <div
                    key={r.id}
                    style={{
                      display: "flex", justifyContent: "space-between", alignItems: "center",
                      padding: 10, background: "#1e293b", borderRadius: 6,
                      borderLeft: i === 0 ? "3px solid #14b8a6" : "3px solid transparent",
                    }}
                  >
                    <div>
                      <div style={{ fontSize: 12, color: "#f1f5f9", fontWeight: 500 }}>
                        {r.query || r.niche || "Búsqueda"}
                      </div>
                      <div style={{ fontSize: 10, color: "#64748b", marginTop: 2 }}>
                        {r.totalFound ?? 0} proveedores · {timeAgo(r.createdAt)}
                      </div>
                    </div>
                    <div style={{ display: "flex", gap: 6 }}>
                      {i === 0 && r.totalFound != null && r.totalFound > 0 && (
                        <span style={{ fontSize: 10, color: "#14b8a6", padding: "3px 8px", background: "#14b8a615", borderRadius: 3 }}>
                          +{r.totalFound} nuevos
                        </span>
                      )}
                      {i > 0 && (
                        <span style={{ fontSize: 10, color: "#64748b", padding: "3px 8px", background: "#0f172a", borderRadius: 3 }}>indexado</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
