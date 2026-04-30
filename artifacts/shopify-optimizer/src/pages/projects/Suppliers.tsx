import { useEffect, useState } from "react";
import { useRoute } from "wouter";
import { Loader2, Search, Star, Trash2, Download, ExternalLink, Mail, Phone, Globe, Award, Sparkles } from "lucide-react";
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

export default function Suppliers() {
  const [, params] = useRoute<{ id: string }>("/projects/:id/suppliers");
  const projectId = params?.id ?? "";
  const { toast } = useToast();

  const [niche, setNiche] = useState("");
  const [customQuery, setCustomQuery] = useState("");
  const [country, setCountry] = useState("");
  const [running, setRunning] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [onlyStarred, setOnlyStarred] = useState(false);
  const [filterCat, setFilterCat] = useState<string>("all");

  const [researches, setResearches] = useState<Research[]>([]);
  const [entries, setEntries] = useState<Entry[]>([]);
  const [loading, setLoading] = useState(false);
  const [lastSummary, setLastSummary] = useState<string | null>(null);
  const [lastSources, setLastSources] = useState<string[]>([]);

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

  useEffect(() => { load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [projectId]);

  const runSearch = async () => {
    if (!projectId) return;
    if (!niche.trim() && !customQuery.trim()) {
      toast({ title: "Indica un nicho o búsqueda", variant: "destructive" });
      return;
    }
    setRunning(true);
    setLastSummary(null);
    setLastSources([]);
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
      toast({ title: `${j.totalFound} proveedores reales encontrados`, description: `Búsqueda completada en ${Math.round((j.elapsedMs ?? 0) / 1000)}s` });
      await load();
    } catch (err: any) {
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
      // revert
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

  const categories = Array.from(new Set(entries.map(e => e.category || "General"))).sort();
  const visible = entries.filter(e => {
    if (onlyStarred && !e.starred) return false;
    if (filterCat !== "all" && (e.category || "General") !== filterCat) return false;
    return true;
  });

  return (
    <div style={{ padding: "20px 24px", maxWidth: 1400, margin: "0 auto" }}>
      <div style={{ marginBottom: 20 }}>
        <h1 style={{ fontSize: 26, fontWeight: 700, color: "#0a4b8c", margin: 0, display: "flex", alignItems: "center", gap: 10 }}>
          <Sparkles size={26} /> Catálogo de Proveedores Reales
        </h1>
        <p style={{ fontSize: 13, color: "#64748b", marginTop: 6 }}>
          Investigación profunda en Google con IA. Encuentra proveedores reales del nicho de tu tienda con sus precios, contacto, MOQ y plazos.
        </p>
      </div>

      {/* Buscador */}
      <div style={{
        background: "linear-gradient(135deg, #0c4a6e, #075985)",
        border: "1px solid #0369a1", borderRadius: 12, padding: 18, marginBottom: 20, color: "#e0f2fe",
      }}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10, marginBottom: 12 }}>
          <input
            value={niche}
            onChange={e => setNiche(e.target.value)}
            placeholder="Nicho (ej: serigrafía textil, mobiliario bar...)"
            disabled={running}
            style={{ padding: "10px 12px", borderRadius: 8, border: "1px solid #0284c7", background: "#082f49", color: "#e0f2fe", fontSize: 13 }}
          />
          <input
            value={country}
            onChange={e => setCountry(e.target.value)}
            placeholder="País / región (opcional)"
            disabled={running}
            style={{ padding: "10px 12px", borderRadius: 8, border: "1px solid #0284c7", background: "#082f49", color: "#e0f2fe", fontSize: 13 }}
          />
          <input
            value={customQuery}
            onChange={e => setCustomQuery(e.target.value)}
            placeholder="Búsqueda libre (ej: tinta plastisol GOTS)"
            disabled={running}
            style={{ padding: "10px 12px", borderRadius: 8, border: "1px solid #0284c7", background: "#082f49", color: "#e0f2fe", fontSize: 13 }}
          />
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button
            onClick={runSearch}
            disabled={running}
            style={{
              padding: "10px 18px", borderRadius: 8, border: "none", cursor: running ? "wait" : "pointer",
              background: running ? "#475569" : "linear-gradient(135deg, #0ea5e9, #0284c7)",
              color: "#fff", fontWeight: 600, fontSize: 13, display: "flex", alignItems: "center", gap: 8,
            }}
          >
            {running ? <><Loader2 size={14} className="animate-spin" /> Buscando proveedores reales en Google…</> : <><Search size={14} /> Buscar proveedores reales</>}
          </button>
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
          {entries.length > 0 && (
            <>
              <button
                onClick={downloadReport}
                disabled={downloading}
                style={{
                  padding: "10px 16px", borderRadius: 8, border: "1px solid #38bdf8", cursor: "pointer",
                  background: "transparent", color: "#bae6fd", fontWeight: 600, fontSize: 13,
                  display: "flex", alignItems: "center", gap: 6,
                }}
              >
                {downloading ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />} Descargar informe HTML
              </button>
              <LiveOperation
                active={downloading}
                title="Generando informe de proveedores"
                estimatedSec={20}
                messages={[
                  "Compilando datos de proveedores seleccionados…",
                  "Renderizando tabla con contactos y categorías…",
                  "Aplicando estilo del informe HTML…",
                  "Empaquetando archivo descargable…",
                ]}
                className="w-full"
              />
              <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: "#bae6fd", cursor: "pointer" }}>
                <input type="checkbox" checked={onlyStarred} onChange={e => setOnlyStarred(e.target.checked)} />
                Solo favoritos en informe
              </label>
            </>
          )}
        </div>
        {lastSummary && (
          <div style={{ marginTop: 12, padding: 10, background: "#082f49", borderRadius: 6, fontSize: 12, lineHeight: 1.5 }}>
            <strong style={{ color: "#7dd3fc" }}>Resumen IA:</strong> {lastSummary}
          </div>
        )}
        {lastSources.length > 0 && (
          <div style={{ marginTop: 8, fontSize: 11, color: "#7dd3fc" }}>
            🔗 {lastSources.length} fuentes reales verificadas en Google
          </div>
        )}
      </div>

      {/* Filtros + lista */}
      {loading ? (
        <div style={{ textAlign: "center", padding: 60 }}>
          <Loader2 size={28} className="animate-spin" style={{ margin: "0 auto", color: "#0a4b8c" }} />
        </div>
      ) : entries.length === 0 ? (
        <div style={{ textAlign: "center", padding: 60, background: "#f8fafc", borderRadius: 12, border: "1px dashed #cbd5e1" }}>
          <p style={{ color: "#64748b", fontSize: 14 }}>
            No hay proveedores aún. Lanza tu primera búsqueda con el nicho de tu tienda.
          </p>
        </div>
      ) : (
        <>
          <div style={{ display: "flex", gap: 8, marginBottom: 12, flexWrap: "wrap" }}>
            <button
              onClick={() => setFilterCat("all")}
              style={{
                padding: "6px 12px", borderRadius: 999, border: "1px solid #cbd5e1", cursor: "pointer",
                background: filterCat === "all" ? "#0a4b8c" : "#fff", color: filterCat === "all" ? "#fff" : "#0a4b8c",
                fontSize: 11, fontWeight: 600,
              }}
            >Todos ({entries.length})</button>
            {categories.map(c => {
              const count = entries.filter(e => (e.category || "General") === c).length;
              return (
                <button
                  key={c}
                  onClick={() => setFilterCat(c)}
                  style={{
                    padding: "6px 12px", borderRadius: 999, border: "1px solid #cbd5e1", cursor: "pointer",
                    background: filterCat === c ? "#0a4b8c" : "#fff", color: filterCat === c ? "#fff" : "#0a4b8c",
                    fontSize: 11, fontWeight: 600,
                  }}
                >{c} ({count})</button>
              );
            })}
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(380px, 1fr))", gap: 14 }}>
            {visible.map(e => (
              <div key={e.id} style={{
                background: "#fff", border: "1px solid #e2e8f0", borderRadius: 12, padding: 14,
                boxShadow: "0 1px 3px rgba(0,0,0,0.04)", display: "flex", flexDirection: "column", gap: 8,
              }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
                  <div style={{ flex: 1 }}>
                    <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: "#0a4b8c" }}>{e.name}</h3>
                    <div style={{ fontSize: 11, color: "#64748b", marginTop: 2 }}>
                      {[e.category, e.country, e.region].filter(Boolean).join(" · ")}
                    </div>
                  </div>
                  <div style={{ display: "flex", gap: 4 }}>
                    {e.score != null && (
                      <span style={{
                        padding: "2px 8px", borderRadius: 999, fontSize: 11, fontWeight: 700,
                        background: e.score >= 75 ? "#dcfce7" : e.score >= 50 ? "#fef9c3" : "#fee2e2",
                        color: e.score >= 75 ? "#166534" : e.score >= 50 ? "#854d0e" : "#991b1b",
                      }}>{e.score}/100</span>
                    )}
                    <button
                      onClick={() => toggleStar(e)}
                      title={e.starred ? "Quitar favorito" : "Marcar favorito"}
                      style={{ background: "transparent", border: "none", cursor: "pointer", padding: 2 }}
                    >
                      <Star size={16} fill={e.starred ? "#facc15" : "none"} color={e.starred ? "#eab308" : "#94a3b8"} />
                    </button>
                    <button onClick={() => removeEntry(e.id)} title="Eliminar"
                      style={{ background: "transparent", border: "none", cursor: "pointer", padding: 2 }}>
                      <Trash2 size={14} color="#ef4444" />
                    </button>
                  </div>
                </div>

                {e.productsOffered && (
                  <div style={{ fontSize: 12, color: "#475569", lineHeight: 1.5 }}>
                    {e.productsOffered}
                  </div>
                )}

                <div style={{ display: "flex", flexWrap: "wrap", gap: 6, fontSize: 11 }}>
                  {(e.priceRangeMin != null || e.priceRangeMax != null) && (
                    <span style={{ background: "#f0f9ff", color: "#0369a1", padding: "3px 8px", borderRadius: 6, fontWeight: 600 }}>
                      💶 {e.priceRangeMin ?? "?"}–{e.priceRangeMax ?? "?"} {e.currency || "EUR"}
                    </span>
                  )}
                  {e.moq && <span style={{ background: "#f5f3ff", color: "#6d28d9", padding: "3px 8px", borderRadius: 6 }}>MOQ: {e.moq}</span>}
                  {e.leadDays && <span style={{ background: "#fef3c7", color: "#92400e", padding: "3px 8px", borderRadius: 6 }}>⏱ {e.leadDays}</span>}
                  {e.shipsInternationally === 1 && <span style={{ background: "#dcfce7", color: "#166534", padding: "3px 8px", borderRadius: 6 }}>🌍 Internacional</span>}
                </div>

                {e.certifications && (
                  <div style={{ fontSize: 11, color: "#64748b", display: "flex", alignItems: "center", gap: 4 }}>
                    <Award size={11} /> {e.certifications}
                  </div>
                )}

                <div style={{ display: "flex", flexWrap: "wrap", gap: 8, fontSize: 11, color: "#475569", marginTop: 4 }}>
                  {(() => {
                    const w = safeHttpUrl(e.website);
                    return w ? (
                      <a href={w} target="_blank" rel="noopener noreferrer"
                        style={{ display: "flex", alignItems: "center", gap: 3, color: "#0a4b8c", textDecoration: "none" }}>
                        <Globe size={11} /> Web <ExternalLink size={9} />
                      </a>
                    ) : null;
                  })()}
                  {e.contactEmail && (
                    <a href={`mailto:${e.contactEmail}`} style={{ display: "flex", alignItems: "center", gap: 3, color: "#0a4b8c", textDecoration: "none" }}>
                      <Mail size={11} /> {e.contactEmail}
                    </a>
                  )}
                  {e.contactPhone && (
                    <a href={`tel:${e.contactPhone}`} style={{ display: "flex", alignItems: "center", gap: 3, color: "#0a4b8c", textDecoration: "none" }}>
                      <Phone size={11} /> {e.contactPhone}
                    </a>
                  )}
                </div>

                {e.notes && (
                  <div style={{ fontSize: 11, color: "#64748b", fontStyle: "italic", borderTop: "1px solid #f1f5f9", paddingTop: 6, marginTop: 4 }}>
                    {e.notes}
                  </div>
                )}
                {(() => {
                  const s = safeHttpUrl(e.sourceUrl);
                  return s ? (
                    <a href={s} target="_blank" rel="noopener noreferrer"
                      style={{ fontSize: 10, color: "#94a3b8", textDecoration: "none" }}>
                      🔗 Fuente verificada
                    </a>
                  ) : null;
                })()}
              </div>
            ))}
          </div>
        </>
      )}

      {researches.length > 0 && (
        <div style={{ marginTop: 30, padding: 12, background: "#f8fafc", borderRadius: 8, fontSize: 11, color: "#64748b" }}>
          📊 Histórico: {researches.length} búsquedas realizadas. Última: {researches[0].createdAt ? new Date(researches[0].createdAt).toLocaleString("es-ES") : "—"}
        </div>
      )}
    </div>
  );
}
