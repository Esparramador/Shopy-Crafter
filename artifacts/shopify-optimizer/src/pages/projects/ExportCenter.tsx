import { useState } from "react";
import { GlassCard } from "../../components/ui/GlassCard";
import {
  FileText, Download, BarChart3, ShoppingBag, Palette, TestTubes, Image,
  FileSpreadsheet, Loader2, CheckCircle, AlertCircle, Package, Eye,
  Brain, Boxes, TrendingUp, Wand2, Archive, FileJson, Search, Camera, Table2
} from "lucide-react";

const API_BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

type ExportFormat = "HTML" | "CSV" | "JSON" | "ZIP" | "XLSX";

interface ExportOption {
  id: string;
  title: string;
  description: string;
  icon: React.ReactNode;
  endpoint: string;
  format: ExportFormat;
  color: string;
  category: "reports" | "data" | "bundle" | "images";
}

export default function ExportCenter({ projectId }: { projectId: number }) {
  const [downloading, setDownloading] = useState<string | null>(null);
  const [completed, setCompleted] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);

  const exports: ExportOption[] = [
    {
      id: "zip-all",
      title: "Exportación Completa (ZIP)",
      description: "TODO en un solo archivo: 13 informes HTML + CSV + JSON. Listo para entregar al cliente o archivar.",
      icon: <Archive className="w-6 h-6" />,
      endpoint: `/api/projects/${projectId}/exports/zip/all`,
      format: "ZIP",
      color: "#c8a84b",
      category: "bundle",
    },
    {
      id: "complete",
      title: "Informe Completo del Proyecto",
      description: "Resumen ejecutivo con todos los datos: productos, SEO, financiero, imágenes y A/B tests. Ideal para presentar a clientes.",
      icon: <Package className="w-6 h-6" />,
      endpoint: `/api/projects/${projectId}/exports/complete-report`,
      format: "HTML",
      color: "#c8a84b",
      category: "reports",
    },
    {
      id: "seo",
      title: "Informe SEO Técnico",
      description: "Auditoría SEO completa: scores por producto, Schema JSON-LD, alt texts, meta titles y recomendaciones estratégicas.",
      icon: <BarChart3 className="w-6 h-6" />,
      endpoint: `/api/projects/${projectId}/exports/seo-audit`,
      format: "HTML",
      color: "#2ecc71",
      category: "reports",
    },
    {
      id: "catalog",
      title: "Catálogo de Productos",
      description: "Inventario completo con precios, COGS, márgenes, estado de optimización, SEO grade e imágenes.",
      icon: <ShoppingBag className="w-6 h-6" />,
      endpoint: `/api/projects/${projectId}/exports/product-catalog`,
      format: "HTML",
      color: "#3498db",
      category: "reports",
    },
    {
      id: "financial",
      title: "Informe Financiero y COGS",
      description: "Análisis financiero: COGS por producto, márgenes, historial de cambios de precio y revenue potencial.",
      icon: <FileText className="w-6 h-6" />,
      endpoint: `/api/projects/${projectId}/exports/financial`,
      format: "HTML",
      color: "#e67e22",
      category: "reports",
    },
    {
      id: "brand",
      title: "Brand Brief & Estrategia",
      description: "Identidad de marca: nicho, tono, audiencia, catálogo, categorías, proveedores y estado de optimización.",
      icon: <Palette className="w-6 h-6" />,
      endpoint: `/api/projects/${projectId}/exports/brand-brief`,
      format: "HTML",
      color: "#9b59b6",
      category: "reports",
    },
    {
      id: "competitors",
      title: "Análisis de Competencia",
      description: "Competidores monitoreados, rangos de precios, snapshots de escaneos, alertas competitivas y acciones sugeridas.",
      icon: <Search className="w-6 h-6" />,
      endpoint: `/api/projects/${projectId}/exports/competitors`,
      format: "HTML",
      color: "#e84558",
      category: "reports",
    },
    {
      id: "consistency",
      title: "Consistencia y ADN de Marca",
      description: "ADN visual (iluminación, colores, composición, mood), ADN de marca (tipografía, layout, personalidad) y score de consistencia.",
      icon: <Eye className="w-6 h-6" />,
      endpoint: `/api/projects/${projectId}/exports/consistency`,
      format: "HTML",
      color: "#8e44ad",
      category: "reports",
    },
    {
      id: "inventory",
      title: "Informe de Inventario",
      description: "Stock por producto, ventas diarias, días restantes, alertas críticas, órdenes de reposición y proveedores.",
      icon: <Boxes className="w-6 h-6" />,
      endpoint: `/api/projects/${projectId}/exports/inventory`,
      format: "HTML",
      color: "#16a085",
      category: "reports",
    },
    {
      id: "redesigns",
      title: "Rediseños IA",
      description: "Historial de fichas rediseñadas por IA: títulos optimizados, descripciones SEO, precios recomendados y estado.",
      icon: <Wand2 className="w-6 h-6" />,
      endpoint: `/api/projects/${projectId}/exports/redesigns`,
      format: "HTML",
      color: "#2980b9",
      category: "reports",
    },
    {
      id: "revenue",
      title: "Revenue y Forecast",
      description: "Snapshots de ventas, pedidos, AOV, márgenes brutos, predicciones de forecast con niveles de confianza.",
      icon: <TrendingUp className="w-6 h-6" />,
      endpoint: `/api/projects/${projectId}/exports/revenue`,
      format: "HTML",
      color: "#27ae60",
      category: "reports",
    },
    {
      id: "abtests",
      title: "Informe A/B Testing",
      description: "Historial completo de tests A/B: tipos, estados, ganadores, porcentaje de mejora y conclusiones.",
      icon: <TestTubes className="w-6 h-6" />,
      endpoint: `/api/projects/${projectId}/exports/ab-tests`,
      format: "HTML",
      color: "#1abc9c",
      category: "reports",
    },
    {
      id: "images",
      title: "Galería de Imágenes IA",
      description: "Catálogo visual de todas las imágenes generadas: lifestyle, hero, packaging, con modelo y alt texts.",
      icon: <Image className="w-6 h-6" />,
      endpoint: `/api/projects/${projectId}/exports/images-gallery`,
      format: "HTML",
      color: "#e74c3c",
      category: "reports",
    },
    {
      id: "shopybrain",
      title: "Inteligencia ShopyBrain",
      description: "Estado completo del cerebro IA: dominios de conocimiento, memorias, insights, confianza y inteligencia de proveedores.",
      icon: <Brain className="w-6 h-6" />,
      endpoint: `/api/projects/${projectId}/exports/shopybrain`,
      format: "HTML",
      color: "#f39c12",
      category: "reports",
    },
    {
      id: "csv",
      title: "Productos (CSV)",
      description: "Hoja de cálculo con todos los productos: títulos, precios, COGS, márgenes, SEO. Compatible con Excel y Google Sheets.",
      icon: <FileSpreadsheet className="w-6 h-6" />,
      endpoint: `/api/projects/${projectId}/exports/csv/products`,
      format: "CSV",
      color: "#27ae60",
      category: "data",
    },
    {
      id: "json-products",
      title: "Productos (JSON)",
      description: "Datos estructurados de todos los productos con COGS, SEO scores y métricas. Para integraciones y análisis técnico.",
      icon: <FileJson className="w-6 h-6" />,
      endpoint: `/api/projects/${projectId}/exports/json/products`,
      format: "JSON",
      color: "#3498db",
      category: "data",
    },
    {
      id: "json-full",
      title: "Exportación Total (JSON)",
      description: "TODOS los datos del proyecto en un solo JSON: productos, SEO, COGS, tests, rediseños, imágenes, competidores, inventario, revenue.",
      icon: <FileJson className="w-6 h-6" />,
      endpoint: `/api/projects/${projectId}/exports/json/full`,
      format: "JSON",
      color: "#9b59b6",
      category: "data",
    },
    {
      id: "xlsx-products",
      title: "Productos (Excel)",
      description: "Hoja de cálculo Excel con todos los productos, COGS, márgenes, SEO scores. Colores condicionales y filtros automáticos.",
      icon: <Table2 className="w-6 h-6" />,
      endpoint: `/api/projects/${projectId}/exports/xlsx/products`,
      format: "XLSX",
      color: "#217346",
      category: "data",
    },
    {
      id: "xlsx-full",
      title: "Proyecto Completo (Excel)",
      description: "Multi-hoja Excel con productos, A/B tests, competidores, inventario y revenue. Dashboard completo en un archivo.",
      icon: <Table2 className="w-6 h-6" />,
      endpoint: `/api/projects/${projectId}/exports/xlsx/full`,
      format: "XLSX",
      color: "#1D6F42",
      category: "data",
    },
    {
      id: "img-png",
      title: "Imágenes (PNG)",
      description: "Descarga ZIP de todas las imágenes del proyecto convertidas a PNG. Alta calidad, sin pérdida.",
      icon: <Camera className="w-6 h-6" />,
      endpoint: `/api/projects/${projectId}/vault/download-images/png`,
      format: "ZIP",
      color: "#e74c3c",
      category: "images",
    },
    {
      id: "img-jpg",
      title: "Imágenes (JPG)",
      description: "Descarga ZIP de todas las imágenes en formato JPG. Ideal para web y redes sociales.",
      icon: <Camera className="w-6 h-6" />,
      endpoint: `/api/projects/${projectId}/vault/download-images/jpg`,
      format: "ZIP",
      color: "#e67e22",
      category: "images",
    },
    {
      id: "img-webp",
      title: "Imágenes (WebP)",
      description: "Formato WebP optimizado para la web. Mejor compresión y calidad. Recomendado por Google.",
      icon: <Camera className="w-6 h-6" />,
      endpoint: `/api/projects/${projectId}/vault/download-images/webp`,
      format: "ZIP",
      color: "#3498db",
      category: "images",
    },
    {
      id: "img-avif",
      title: "Imágenes (AVIF)",
      description: "Formato de última generación AVIF. Máxima compresión con calidad premium.",
      icon: <Camera className="w-6 h-6" />,
      endpoint: `/api/projects/${projectId}/vault/download-images/avif`,
      format: "ZIP",
      color: "#9b59b6",
      category: "images",
    },
    {
      id: "img-tiff",
      title: "Imágenes (TIFF)",
      description: "Formato TIFF profesional sin pérdida. Para impresión y uso editorial de máxima calidad.",
      icon: <Camera className="w-6 h-6" />,
      endpoint: `/api/projects/${projectId}/vault/download-images/tiff`,
      format: "ZIP",
      color: "#1abc9c",
      category: "images",
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

  const handleDownloadAllReports = async () => {
    for (const exp of exports.filter(e => e.category === "reports")) {
      await handleDownload(exp);
      await new Promise(r => setTimeout(r, 400));
    }
  };

  const formatBadge = (format: ExportFormat) => {
    const colors: Record<ExportFormat, string> = { HTML: "#c8a84b", CSV: "#27ae60", JSON: "#3498db", ZIP: "#e84558", XLSX: "#217346" };
    return (
      <span
        className="text-[10px] font-bold px-1.5 py-0.5 rounded"
        style={{ background: `${colors[format]}20`, color: colors[format] }}
      >
        {format}
      </span>
    );
  };

  const bundles = exports.filter(e => e.category === "bundle");
  const reports = exports.filter(e => e.category === "reports");
  const data = exports.filter(e => e.category === "data");
  const images = exports.filter(e => e.category === "images");

  const renderCard = (exp: ExportOption) => {
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
                {formatBadge(exp.format)}
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
              <><Download className="w-4 h-4" /> Descargar {exp.format}</>
            )}
          </button>
        </div>
      </GlassCard>
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Centro de Exportación Universal</h1>
          <p className="text-muted-foreground text-sm mt-1">Descarga informes profesionales, datos y contenidos en cualquier formato</p>
        </div>
        <button
          onClick={handleDownloadAllReports}
          disabled={downloading !== null}
          className="px-5 py-2.5 rounded-xl font-bold text-sm text-white flex items-center gap-2 transition-all hover:scale-105"
          style={{ background: "linear-gradient(135deg, #c8a84b 0%, #a08630 100%)" }}
        >
          <Download className="w-4 h-4" /> Descargar Todos los Informes
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
          <p className="text-sm font-medium text-foreground">Formatos: HTML, CSV, JSON, XLSX, ZIP, PNG, JPG, WebP, AVIF, TIFF</p>
          <p className="text-xs text-muted-foreground mt-0.5">Informes HTML con diseño profesional. Para PDF: <strong>Ctrl+P → Guardar como PDF</strong>. Excel con filtros y colores. Imágenes convertidas a cualquier formato.</p>
        </div>
      </div>

      {bundles.length > 0 && (
        <div>
          <h2 className="text-lg font-bold text-foreground mb-3 flex items-center gap-2">
            <Archive className="w-5 h-5" style={{ color: "#c8a84b" }} /> Paquete Completo
          </h2>
          <div className="grid grid-cols-1 gap-4">
            {bundles.map(renderCard)}
          </div>
        </div>
      )}

      <div>
        <h2 className="text-lg font-bold text-foreground mb-3 flex items-center gap-2">
          <FileText className="w-5 h-5" style={{ color: "#c8a84b" }} /> Informes Profesionales ({reports.length})
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {reports.map(renderCard)}
        </div>
      </div>

      <div>
        <h2 className="text-lg font-bold text-foreground mb-3 flex items-center gap-2">
          <FileSpreadsheet className="w-5 h-5" style={{ color: "#27ae60" }} /> Exportación de Datos ({data.length})
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {data.map(renderCard)}
        </div>
      </div>

      {images.length > 0 && (
        <div>
          <h2 className="text-lg font-bold text-foreground mb-3 flex items-center gap-2">
            <Camera className="w-5 h-5" style={{ color: "#e74c3c" }} /> Descarga de Imágenes ({images.length} formatos)
          </h2>
          <p className="text-xs text-muted-foreground mb-3">Descarga todas las imágenes del proyecto (vault + IA generadas) convertidas al formato que necesites. Calidad máxima 100%.</p>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {images.map(renderCard)}
          </div>
        </div>
      )}
    </div>
  );
}
