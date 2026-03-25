import { useState } from "react";
import { GlassCard } from "../../components/ui/GlassCard";
import {
  FileText, Download, BarChart3, ShoppingBag, Palette, TestTubes, Image,
  FileSpreadsheet, Loader2, CheckCircle, AlertCircle, Package
} from "lucide-react";

const API_BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

interface ExportOption {
  id: string;
  title: string;
  description: string;
  icon: React.ReactNode;
  endpoint: string;
  format: string;
  color: string;
}

export default function ExportCenter({ projectId }: { projectId: number }) {
  const [downloading, setDownloading] = useState<string | null>(null);
  const [completed, setCompleted] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);

  const exports: ExportOption[] = [
    {
      id: "complete",
      title: "Informe Completo del Proyecto",
      description: "Resumen ejecutivo con todos los datos: productos, SEO, financiero, imágenes y A/B tests. Ideal para presentar a clientes.",
      icon: <Package className="w-6 h-6" />,
      endpoint: `/api/projects/${projectId}/exports/complete-report`,
      format: "HTML",
      color: "#c8a84b",
    },
    {
      id: "seo",
      title: "Informe SEO Técnico",
      description: "Auditoría SEO completa: scores por producto, distribución de grados, Schema JSON-LD, alt texts, meta titles y recomendaciones estratégicas.",
      icon: <BarChart3 className="w-6 h-6" />,
      endpoint: `/api/projects/${projectId}/exports/seo-audit`,
      format: "HTML",
      color: "#2ecc71",
    },
    {
      id: "catalog",
      title: "Catálogo de Productos",
      description: "Inventario completo con precios, COGS, márgenes, estado de optimización, SEO grade e imágenes de cada producto.",
      icon: <ShoppingBag className="w-6 h-6" />,
      endpoint: `/api/projects/${projectId}/exports/product-catalog`,
      format: "HTML",
      color: "#3498db",
    },
    {
      id: "financial",
      title: "Informe Financiero y COGS",
      description: "Análisis financiero detallado: COGS por producto, márgenes de beneficio, historial de cambios de precio y revenue potencial.",
      icon: <FileText className="w-6 h-6" />,
      endpoint: `/api/projects/${projectId}/exports/financial`,
      format: "HTML",
      color: "#e67e22",
    },
    {
      id: "brand",
      title: "Brand Brief & Estrategia",
      description: "Documento de identidad de marca: nicho, tono, audiencia, catálogo, categorías, proveedores y estado de optimización.",
      icon: <Palette className="w-6 h-6" />,
      endpoint: `/api/projects/${projectId}/exports/brand-brief`,
      format: "HTML",
      color: "#9b59b6",
    },
    {
      id: "abtests",
      title: "Informe A/B Testing",
      description: "Historial completo de tests A/B: tipos, estados, ganadores, porcentaje de mejora y conclusiones.",
      icon: <TestTubes className="w-6 h-6" />,
      endpoint: `/api/projects/${projectId}/exports/ab-tests`,
      format: "HTML",
      color: "#1abc9c",
    },
    {
      id: "images",
      title: "Galería de Imágenes IA",
      description: "Catálogo visual de todas las imágenes generadas con IA: lifestyle, hero, packaging, con modelo y alt texts.",
      icon: <Image className="w-6 h-6" />,
      endpoint: `/api/projects/${projectId}/exports/images-gallery`,
      format: "HTML",
      color: "#e84558",
    },
    {
      id: "csv",
      title: "Exportar Productos (CSV)",
      description: "Hoja de cálculo con todos los productos: títulos, precios, COGS, márgenes, SEO scores, variantes. Compatible con Excel y Google Sheets.",
      icon: <FileSpreadsheet className="w-6 h-6" />,
      endpoint: `/api/projects/${projectId}/exports/csv/products`,
      format: "CSV",
      color: "#27ae60",
    },
  ];

  const handleDownload = async (exp: ExportOption) => {
    setDownloading(exp.id);
    setError(null);
    try {
      const res = await fetch(`${API_BASE}${exp.endpoint}`, { credentials: "include" });
      if (!res.ok) throw new Error(`Error ${res.status}`);
      const blob = await res.blob();
      const disposition = res.headers.get("Content-Disposition");
      const filenameMatch = disposition?.match(/filename="?(.+?)"?$/);
      const filename = filenameMatch?.[1] ?? `export.${exp.format.toLowerCase()}`;

      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
      setCompleted(prev => new Set(prev).add(exp.id));
    } catch (e: any) {
      setError(`Error descargando ${exp.title}: ${e.message}`);
    } finally {
      setDownloading(null);
    }
  };

  const handleDownloadAll = async () => {
    for (const exp of exports) {
      await handleDownload(exp);
      await new Promise(r => setTimeout(r, 500));
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Centro de Exportación</h1>
          <p className="text-muted-foreground text-sm mt-1">Descarga informes profesionales, datos y contenidos para tus clientes</p>
        </div>
        <button
          onClick={handleDownloadAll}
          disabled={downloading !== null}
          className="px-5 py-2.5 rounded-xl font-bold text-sm text-white flex items-center gap-2 transition-all hover:scale-105"
          style={{ background: "linear-gradient(135deg, #c8a84b 0%, #a08630 100%)" }}
        >
          <Download className="w-4 h-4" /> Descargar Todo
        </button>
      </div>

      {error && (
        <div className="p-3 rounded-xl flex items-center gap-2 text-sm" style={{ background: "rgba(232,69,88,.1)", border: "1px solid rgba(232,69,88,.2)", color: "#e84558" }}>
          <AlertCircle className="w-4 h-4 shrink-0" /> {error}
        </div>
      )}

      <div className="flex items-center gap-3 p-4 rounded-xl" style={{ background: "rgba(200,168,75,.06)", border: "1px solid rgba(200,168,75,.15)" }}>
        <FileText className="w-5 h-5" style={{ color: "#c8a84b" }} />
        <div>
          <p className="text-sm font-medium text-foreground">Informes profesionales en HTML</p>
          <p className="text-xs text-muted-foreground mt-0.5">Los informes se descargan como HTML con diseño profesional. Para convertirlos a PDF, ábrelos en tu navegador y usa <strong>Ctrl+P → Guardar como PDF</strong>.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {exports.map(exp => {
          const isDownloading = downloading === exp.id;
          const isCompleted = completed.has(exp.id);

          return (
            <GlassCard key={exp.id} className="p-0 overflow-hidden">
              <div className="p-5">
                <div className="flex items-start gap-4">
                  <div
                    className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0"
                    style={{ background: `${exp.color}15`, color: exp.color }}
                  >
                    {exp.icon}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold text-foreground text-sm">{exp.title}</h3>
                      <span
                        className="text-[10px] font-bold px-1.5 py-0.5 rounded"
                        style={{ background: `${exp.color}20`, color: exp.color }}
                      >
                        {exp.format}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1 leading-relaxed">{exp.description}</p>
                  </div>
                </div>
              </div>
              <div className="px-5 pb-4">
                <button
                  onClick={() => handleDownload(exp)}
                  disabled={isDownloading}
                  className="w-full py-2.5 rounded-xl font-semibold text-sm flex items-center justify-center gap-2 transition-all"
                  style={{
                    background: isCompleted ? "rgba(46,204,113,.1)" : `${exp.color}12`,
                    border: `1px solid ${isCompleted ? "rgba(46,204,113,.3)" : exp.color + "30"}`,
                    color: isCompleted ? "#2ecc71" : exp.color,
                  }}
                >
                  {isDownloading ? (
                    <><Loader2 className="w-4 h-4 animate-spin" /> Generando...</>
                  ) : isCompleted ? (
                    <><CheckCircle className="w-4 h-4" /> Descargado</>
                  ) : (
                    <><Download className="w-4 h-4" /> Descargar</>
                  )}
                </button>
              </div>
            </GlassCard>
          );
        })}
      </div>
    </div>
  );
}
