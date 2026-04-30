import { useState, useEffect, useCallback } from "react";
import { useRoute } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Loader2, Download, ExternalLink, Search, Brain, CheckCircle, FolderOpen, Sparkles, RotateCcw } from "lucide-react";
import { useDebounce } from "@/hooks/use-debounce";

interface GeneratorType {
  id: string;
  label: string;
  category: string;
  description: string;
  icon: string;
  requiresProject: boolean;
  acceptsUrl: boolean;
  outputFormats: string[];
}

interface CategoryGroup {
  label: string;
  icon: string;
  types: GeneratorType[];
}

interface GenerationResult {
  success: boolean;
  type: string;
  format: string;
  content?: string;
  contentLength?: number;
  downloadUrl?: string;
  redirect?: string;
  vaultId?: number;
  brainLearned?: boolean;
  vaultSaved?: boolean;
  message: string;
}

interface HistoryItem {
  id: number;
  fileType: string;
  title: string;
  description: string;
  createdAt: string;
}

const BASE = import.meta.env.BASE_URL || "/";
const api = (path: string) => `${BASE}api${path}`;

export default function UniversalGenerator() {
  const [, params] = useRoute("/projects/:id/generator");
  const projectId = params?.id || "2";

  const [categories, setCategories] = useState<Record<string, CategoryGroup>>({});
  const [totalTypes, setTotalTypes] = useState(0);
  const [search, setSearch] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [externalUrl, setExternalUrl] = useState("");
  const [generating, setGenerating] = useState<string | null>(null);
  const [generatingPhase, setGeneratingPhase] = useState(0);
  const [generatingElapsed, setGeneratingElapsed] = useState(0);
  const [results, setResults] = useState<Record<string, GenerationResult>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const [template, setTemplate] = useState<"classic" | "elegance" | "prestige">("prestige");
  const [reportLevel, setReportLevel] = useState(1);

  useEffect(() => {
    fetch(api("/generator/types"), { credentials: "include" })
      .then(r => r.json())
      .then(d => {
        if (d.success) {
          setCategories(d.categories);
          setTotalTypes(d.total);
        }
      })
      .catch(() => {});
  }, []);

  const loadHistory = useCallback(() => {
    fetch(api(`/generator/history/${projectId}`), { credentials: "include" })
      .then(r => r.json())
      .then(d => {
        if (d.success) setHistory(d.files);
      })
      .catch(() => {});
  }, [projectId]);

  useEffect(() => { loadHistory(); }, [loadHistory]);

  const GENERATION_PHASES = [
    { label: "Preparando datos del proyecto...", icon: "📦" },
    { label: "Investigando con ShopyBrain...", icon: "🧠" },
    { label: "Analizando con IA (puede tardar 30-90s)...", icon: "🤖" },
    { label: "Generando contenido profesional...", icon: "✍️" },
    { label: "Guardando en Vault...", icon: "💾" },
  ];

  const runGeneration = async (typeId: string, genType: GeneratorType) => {
    setGenerating(typeId);
    setGeneratingPhase(0);
    setGeneratingElapsed(0);
    setErrors(prev => { const n = { ...prev }; delete n[typeId]; return n; });

    const phaseTimer = setInterval(() => {
      setGeneratingPhase(p => (p < GENERATION_PHASES.length - 1 ? p + 1 : p));
    }, 12000);

    const elapsedTimer = setInterval(() => {
      setGeneratingElapsed(e => e + 1);
    }, 1000);

    const controller = new AbortController();
    const fetchTimeout = setTimeout(() => controller.abort(), 300000);

    try {
      const body: Record<string, unknown> = { type: typeId, projectId: parseInt(projectId), template, level: reportLevel };
      if (genType.acceptsUrl && externalUrl) body.url = externalUrl;
      if (!genType.requiresProject && genType.acceptsUrl && externalUrl) body.url = externalUrl;

      const res = await fetch(api("/generator/run"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(body),
        signal: controller.signal,
      });

      const rawText = await res.text();
      let data;
      try {
        data = JSON.parse(rawText.trim());
      } catch {
        throw new Error(`Respuesta inválida del servidor (status ${res.status})`);
      }

      if (!res.ok || data.error) {
        throw new Error(data.error || `Error del servidor (${res.status})`);
      }

      setResults(prev => ({ ...prev, [typeId]: data }));

      if (data.redirect && typeof data.redirect === "string") {
        // M9: validar que sea un path interno (evitar open redirect a hosts externos)
        const r = data.redirect.trim();
        const isSafeInternalPath =
          r.startsWith("/") &&
          !r.startsWith("//") &&
          !r.startsWith("/\\") &&
          (r.startsWith("/api/") || r.startsWith("/vault/") || r.startsWith("/generator/") || r.startsWith("/exports/") || r.startsWith("/projects/"));
        if (isSafeInternalPath) {
          const redirectUrl = r.startsWith("/api")
            ? api(r.replace("/api", ""))
            : api(r);
          window.open(redirectUrl, "_blank", "noopener,noreferrer");
        }
      }

      loadHistory();
    } catch (err: any) {
      const msg = err.name === "AbortError"
        ? "Tiempo de espera agotado (5 min). Intenta con un nivel menor."
        : (err.message || "Error de conexión");
      setErrors(prev => ({ ...prev, [typeId]: msg }));
      setResults(prev => ({ ...prev, [typeId]: { success: false, type: typeId, format: "", message: msg } }));
    } finally {
      clearTimeout(fetchTimeout);
      clearInterval(phaseTimer);
      clearInterval(elapsedTimer);
      setGenerating(null);
      setGeneratingPhase(0);
      setGeneratingElapsed(0);
    }
  };

  const filteredCategories = Object.entries(categories).filter(([catId]) => {
    if (selectedCategory && selectedCategory !== catId) return false;
    return true;
  });

  const debouncedSearch = useDebounce(search, 250);
  const matchesSearch = (t: GeneratorType) => {
    if (!debouncedSearch) return true;
    const q = debouncedSearch.toLowerCase();
    return t.label.toLowerCase().includes(q) || t.description.toLowerCase().includes(q) || t.id.includes(q);
  };

  return (
    <div style={{ padding: "24px", maxWidth: 1400, margin: "0 auto" }}>
      <div style={{
        background: "linear-gradient(135deg, #0f172a 0%, #1e293b 50%, #334155 100%)",
        borderRadius: 16, padding: "32px 40px", marginBottom: 24, color: "white", position: "relative", overflow: "hidden"
      }}>
        <div style={{
          position: "absolute", top: 0, left: 0, right: 0, bottom: 0,
          background: "radial-gradient(circle at 20% 50%, rgba(99,102,241,0.2) 0%, transparent 50%), radial-gradient(circle at 80% 20%, rgba(168,85,247,0.15) 0%, transparent 50%)"
        }} />
        <div style={{ position: "relative", zIndex: 1 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 8 }}>
            <Sparkles size={28} />
            <h1 style={{ fontSize: 28, fontWeight: 800, letterSpacing: -0.5 }}>Generador Universal</h1>
            <Badge variant="secondary" style={{ background: "rgba(99,102,241,0.3)", color: "white", fontSize: 13 }}>
              {totalTypes} herramientas
            </Badge>
          </div>
          <p style={{ opacity: 0.7, fontSize: 14, maxWidth: 700 }}>
            Genera, descarga y guarda cualquier tipo de contenido profesional. Informes, CSS de marca, SEO, análisis de competencia, presupuestos, y mucho más. Todo impulsado por IA y adaptado a tu marca.
          </p>
        </div>
      </div>
      <div style={{
        display: "flex", gap: 10, marginBottom: 16, alignItems: "center",
        background: "linear-gradient(90deg, #0f172a, #1e293b)", padding: "10px 16px", borderRadius: 10, border: "1px solid #334155"
      }}>
        <span style={{ fontSize: 13, color: "#94a3b8", fontWeight: 500, whiteSpace: "nowrap" }}>Plantilla:</span>
        {([
          { id: "classic" as const, label: "Classic", color: "#c8a84b", desc: "Oro / Negro" },
          { id: "elegance" as const, label: "Elegance", color: "#4a90d9", desc: "Plata / Azul" },
          { id: "prestige" as const, label: "Prestige", color: "#c4956a", desc: "Cobre / Lujo" },
        ]).map(t => (
          <button
            key={t.id}
            onClick={() => setTemplate(t.id)}
            style={{
              padding: "6px 16px", borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: "pointer",
              border: template === t.id ? `2px solid ${t.color}` : "1px solid #475569",
              background: template === t.id ? `${t.color}22` : "transparent",
              color: template === t.id ? t.color : "#94a3b8",
              transition: "all 0.2s",
              display: "flex", flexDirection: "column" as const, alignItems: "center", gap: 1,
            }}
          >
            <span>{t.label}</span>
            <span style={{ fontSize: 9, opacity: 0.7 }}>{t.desc}</span>
          </button>
        ))}
        <span style={{ fontSize: 11, color: "#64748b", marginLeft: "auto" }}>
          Aplica a todos los informes y contenidos generados
        </span>
      </div>
      <div style={{
        display: "flex", gap: 10, marginBottom: 16, alignItems: "center", flexWrap: "wrap",
        background: "linear-gradient(90deg, #0f172a, #1e293b)", padding: "10px 16px", borderRadius: 10, border: "1px solid #334155"
      }}>
        <span style={{ fontSize: 13, color: "#94a3b8", fontWeight: 500, whiteSpace: "nowrap" }}>Nivel:</span>
        {([
          { lvl: 1, name: "Diagnóstico", color: "#c8a84b", price: "Base" },
          { lvl: 2, name: "Guía Implementación", color: "#60a5fa", price: "+Guía paso a paso" },
          { lvl: 3, name: "Contenido Producido", color: "#c084fc", price: "+Contenido listo" },
          { lvl: 4, name: "Premium Full", color: "#f472b6", price: "+CSS, código, emails" },
          { lvl: 5, name: "Enterprise", color: "#fbbf24", price: "+Roadmap 12 meses" },
        ] as const).map(({ lvl, name, color, price }) => (
          <button
            key={lvl}
            onClick={() => setReportLevel(lvl)}
            style={{
              padding: "6px 14px", borderRadius: 10, cursor: "pointer", fontSize: 11, fontWeight: reportLevel === lvl ? 700 : 500,
              border: reportLevel === lvl ? `2px solid ${color}` : "1px solid #475569",
              background: reportLevel === lvl ? `${color}15` : "transparent",
              color: reportLevel === lvl ? color : "#94a3b8",
              transition: "all 0.2s", display: "flex", flexDirection: "column" as const, alignItems: "center", gap: 1,
            }}
          >
            <span style={{ fontWeight: 700 }}>Nivel {lvl}</span>
            <span style={{ fontSize: 9, opacity: 0.8 }}>{name}</span>
            <span style={{ fontSize: 8, marginTop: 1 }}>{price}</span>
          </button>
        ))}
        {reportLevel > 1 && (
          <span style={{ fontSize: 10, color: "#64748b", marginLeft: 8 }}>
            Se generarán {reportLevel >= 5 ? "5" : reportLevel >= 4 ? "4" : reportLevel >= 3 ? "3" : "2"} archivos separados
          </span>
        )}
      </div>
      <div style={{ display: "flex", gap: 12, marginBottom: 20, flexWrap: "wrap", alignItems: "center" }}>
        <div style={{ position: "relative", flex: "1 1 300px" }}>
          <Search size={16} style={{ position: "absolute", left: 12, top: 10, color: "#94a3b8" }} />
          <Input
            placeholder="Buscar herramienta... (ej: SEO, CSS, pricing, blog)"
            value={search}
            onChange={e => setSearch(e.target.value)}
            style={{ paddingLeft: 36 }}
          />
        </div>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          <Button
            variant={selectedCategory === null ? "default" : "outline"}
            size="sm"
            onClick={() => setSelectedCategory(null)}
          >
            Todas
          </Button>
          {Object.entries(categories).map(([catId, cat]) => (
            <Button
              key={catId}
              variant={selectedCategory === catId ? "default" : "outline"}
              size="sm"
              onClick={() => setSelectedCategory(catId === selectedCategory ? null : catId)}
            >
              {cat.icon} {cat.label.split(" ")[0]}
            </Button>
          ))}
        </div>
        <Button variant="outline" size="sm" onClick={() => { setShowHistory(!showHistory); loadHistory(); }}>
          <FolderOpen size={14} style={{ marginRight: 4 }} /> Historial
        </Button>
      </div>
      <div style={{ display: "flex", gap: 12, marginBottom: 20, alignItems: "center", background: "rgba(79,70,229,.08)", padding: "12px 16px", borderRadius: 10, border: "1px solid rgba(99,102,241,.25)" }}>
        <ExternalLink size={16} style={{ color: "#818cf8", flexShrink: 0 }} />
        <span style={{ fontSize: 13, color: "#a5b4fc", fontWeight: 500, whiteSpace: "nowrap" }}>URL externa:</span>
        <Input
          placeholder="https://tienda-competidor.myshopify.com"
          value={externalUrl}
          onChange={e => setExternalUrl(e.target.value)}
          style={{ flex: 1, fontSize: 13, background: "#0c0c14", color: "#f5f5f7", border: "1px solid #2a2a3a" }}
        />
        <span style={{ fontSize: 11, color: "#818cf8", whiteSpace: "nowrap" }}>Para analizar cualquier tienda</span>
      </div>
      {showHistory && history.length > 0 && (
        <Card style={{ marginBottom: 20 }}>
          <CardHeader>
            <CardTitle style={{ fontSize: 16 }}>
              <FolderOpen size={16} style={{ display: "inline", marginRight: 6 }} />
              Historial de generaciones ({history.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div style={{ maxHeight: 300, overflowY: "auto" }}>
              {history.map(h => (
                <div key={h.id} style={{
                  display: "flex", justifyContent: "space-between", alignItems: "center",
                  padding: "8px 12px", borderBottom: "1px solid #f1f5f9", fontSize: 13
                }}>
                  <div>
                    <strong>{h.title}</strong>
                    <span style={{ color: "#94a3b8", marginLeft: 8 }}>{h.fileType}</span>
                  </div>
                  <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                    <span style={{ color: "#94a3b8", fontSize: 11 }}>
                      {new Date(h.createdAt).toLocaleDateString("es-ES")}
                    </span>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => window.open(api(`/generator/download/${h.id}`), "_blank")}
                    >
                      <Download size={12} />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
      {filteredCategories.map(([catId, cat]) => {
        const visibleTypes = cat.types.filter(matchesSearch);
        if (visibleTypes.length === 0) return null;

        return (
          <div key={catId} style={{ marginBottom: 28 }}>
            <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 12, display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ fontSize: 22 }}>{cat.icon}</span> {cat.label}
              <Badge variant="outline" style={{ fontSize: 11 }}>{visibleTypes.length}</Badge>
            </h2>
            <div style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))",
              gap: 12,
            }}>
              {visibleTypes.map(genType => {
                const result = results[genType.id];
                const isGenerating = generating === genType.id;

                return (
                  <Card key={genType.id} style={{
                    border: result?.success ? "1px solid #86efac" : "1px solid #e2e8f0",
                    background: result?.success ? "#f0fdf4" : "white",
                    transition: "all 0.2s",
                  }}>
                    <CardContent style={{ padding: 16 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          <span style={{ fontSize: 24 }}>{genType.icon}</span>
                          <div>
                            <h3
                              style={{ fontSize: 14, fontWeight: 600, lineHeight: 1.3 }}
                              className="text-[#0c81f5]">{genType.label}</h3>
                            <div style={{ display: "flex", gap: 4, marginTop: 2 }}>
                              {genType.outputFormats.map(f => (
                                <Badge key={f} variant="outline" className="text-[#0a4b8c]" style={{ fontSize: 9, padding: "0 4px", textTransform: "uppercase" }}>
                                  {f}
                                </Badge>
                              ))}
                              {genType.acceptsUrl && (
                                <Badge variant="outline" style={{ fontSize: 9, padding: "0 4px", background: "#ede9fe", color: "#7c3aed" }}>
                                  URL
                                </Badge>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>

                      <p style={{ fontSize: 12, color: "#64748b", marginBottom: 12, lineHeight: 1.5 }}>
                        {genType.description}
                      </p>

                      {isGenerating && (
                        <div style={{
                          background: "linear-gradient(135deg, #1e1b4b, #312e81)", border: "1px solid #4338ca", borderRadius: 8,
                          padding: "12px 14px", marginBottom: 10, fontSize: 12, color: "#c7d2fe",
                        }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                            <span style={{ fontSize: 18, animation: "pulse 1.5s ease-in-out infinite" }}>
                              {GENERATION_PHASES[generatingPhase]?.icon || "🤖"}
                            </span>
                            <div>
                              <div style={{ fontWeight: 600, color: "#e0e7ff" }}>
                                {GENERATION_PHASES[generatingPhase]?.label || "Procesando..."}
                              </div>
                              <div style={{ fontSize: 10, color: "#818cf8", marginTop: 2 }}>
                                Paso {generatingPhase + 1}/{GENERATION_PHASES.length} · {generatingElapsed}s transcurridos
                                {reportLevel >= 3 && " · Nivel alto = más tiempo"}
                              </div>
                            </div>
                          </div>
                          <div style={{
                            height: 4, background: "#1e1b4b", borderRadius: 2, overflow: "hidden",
                          }}>
                            <div style={{
                              height: "100%", background: "linear-gradient(90deg, #6366f1, #a78bfa)",
                              width: `${Math.min(95, ((generatingPhase + 1) / GENERATION_PHASES.length) * 100)}%`,
                              transition: "width 1s ease-out", borderRadius: 2,
                            }} />
                          </div>
                        </div>
                      )}

                      {errors[genType.id] && !isGenerating && (
                        <div style={{
                          background: "#fef2f2", border: "1px solid #fca5a5", borderRadius: 8,
                          padding: "10px 14px", marginBottom: 10, fontSize: 12, color: "#991b1b",
                        }}>
                          <div style={{ fontWeight: 600, marginBottom: 4, display: "flex", alignItems: "center", gap: 6 }}>
                            ❌ Error en la generación
                          </div>
                          <p style={{ fontSize: 11, color: "#b91c1c" }}>{errors[genType.id]}</p>
                          <p style={{ fontSize: 10, color: "#dc2626", marginTop: 4 }}>
                            Puedes intentar de nuevo o bajar el nivel de detalle.
                          </p>
                        </div>
                      )}

                      {result?.success && (
                        <div style={{
                          background: "#ecfdf5", border: "1px solid #a7f3d0", borderRadius: 8,
                          padding: "8px 12px", marginBottom: 10, fontSize: 12
                        }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
                            <CheckCircle size={14} color="#10b981" />
                            <strong style={{ color: "#065f46" }}>Generado</strong>
                            {result.brainLearned && (
                              <span style={{ display: "flex", alignItems: "center", gap: 2, color: "#7c3aed", fontSize: 10 }}>
                                <Brain size={10} /> Aprendido
                              </span>
                            )}
                            {result.vaultSaved && (
                              <span style={{ display: "flex", alignItems: "center", gap: 2, color: "#2563eb", fontSize: 10 }}>
                                <FolderOpen size={10} /> Vault
                              </span>
                            )}
                          </div>
                          <p style={{ color: "#047857", fontSize: 11 }}>{result.message}</p>
                          {result.downloadUrl && !result.redirect && (
                            <Button
                              size="sm"
                              variant="outline"
                              style={{ marginTop: 6, fontSize: 11 }}
                              onClick={() => window.open(api(result.downloadUrl!.replace("/api", "")), "_blank")}
                            >
                              <Download size={12} style={{ marginRight: 4 }} /> Descargar
                            </Button>
                          )}
                          {result.vaultId && (
                            <Button
                              size="sm"
                              variant="outline"
                              style={{ marginTop: 6, marginLeft: 6, fontSize: 11 }}
                              onClick={() => window.open(api(`/generator/download/${result.vaultId}`), "_blank")}
                            >
                              <Download size={12} style={{ marginRight: 4 }} /> Desde Vault
                            </Button>
                          )}
                        </div>
                      )}

                      <div style={{ display: "flex", gap: 6 }}>
                        <Button
                          size="sm"
                          disabled={isGenerating || generating !== null}
                          onClick={() => runGeneration(genType.id, genType)}
                          style={{ flex: 1, fontSize: 12 }}
                        >
                          {isGenerating ? (
                            <><Loader2 size={14} className="animate-spin" style={{ marginRight: 4 }} /> Generando...</>
                          ) : result?.success ? (
                            <><RotateCcw size={14} style={{ marginRight: 4 }} /> Regenerar</>
                          ) : (
                            <><Sparkles size={14} style={{ marginRight: 4 }} /> Generar</>
                          )}
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </div>
        );
      })}
      {totalTypes === 0 && (
        <div style={{ textAlign: "center", padding: 60, color: "#94a3b8" }}>
          <Loader2 size={32} className="animate-spin" style={{ margin: "0 auto 16px" }} />
          <p>Cargando herramientas...</p>
        </div>
      )}
    </div>
  );
}
