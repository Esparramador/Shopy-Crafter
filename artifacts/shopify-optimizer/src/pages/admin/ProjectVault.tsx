import { useState, useEffect, useCallback } from "react";
import { useRoute, useLocation } from "wouter";
import {
  FolderOpen, Download, Trash2, Image, FileText, RefreshCw,
  ArrowLeft, Package, BarChart2, Mail, Search,
  Archive, ExternalLink, AlertTriangle, Grid, List,
  Folder, Eye, ChevronRight, DollarSign, Palette, Wand2,
  SplitSquareHorizontal, ShieldCheck, FileSpreadsheet,
  CheckSquare, Square, XCircle, CheckCircle,
} from "lucide-react";

const API_BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

const FILE_TYPE_CONFIG: Record<string, { label: string; icon: typeof Image; color: string }> = {
  image:          { label: "Imágenes",            icon: Image,                 color: "#5b4eff" },
  seo_report:     { label: "SEO",                 icon: Search,                color: "var(--jade)" },
  seo_audit:      { label: "SEO",                 icon: Search,                color: "var(--jade)" },
  redesign:       { label: "Rediseños",           icon: Wand2,                 color: "var(--gold)" },
  ab_test:        { label: "Tests A/B",           icon: SplitSquareHorizontal, color: "#ff6b35" },
  ab_testing:     { label: "Tests A/B",           icon: SplitSquareHorizontal, color: "#ff6b35" },
  email:          { label: "Emails",              icon: Mail,                  color: "#e040fb" },
  pricing_report: { label: "Financiero",          icon: DollarSign,            color: "#00bcd4" },
  financial:      { label: "Financiero",          icon: DollarSign,            color: "#00bcd4" },
  audit:          { label: "Auditorías",          icon: ShieldCheck,           color: "#ff9800" },
  consistency:    { label: "Consistencia Visual",  icon: Palette,               color: "#9c27b0" },
  bulk_export:    { label: "Exportaciones",       icon: FileSpreadsheet,       color: "#607d8b" },
  product_card:   { label: "Productos",           icon: Package,               color: "var(--gold)" },
};

const FOLDER_CONFIG: Array<{
  id: string;
  label: string;
  icon: typeof Image;
  color: string;
  matchTypes: string[];
}> = [
  { id: "images",       label: "Imágenes",           icon: Image,                 color: "#5b4eff",     matchTypes: ["image"] },
  { id: "audit",        label: "Auditorías",         icon: ShieldCheck,           color: "#ff9800",     matchTypes: ["audit"] },
  { id: "seo",          label: "Informes SEO",       icon: Search,                color: "var(--jade)", matchTypes: ["seo_report", "seo_audit"] },
  { id: "redesign",     label: "Rediseños",          icon: Wand2,                 color: "var(--gold)", matchTypes: ["redesign"] },
  { id: "consistency",  label: "Consistencia Visual", icon: Palette,               color: "#9c27b0",     matchTypes: ["consistency"] },
  { id: "abtesting",    label: "Tests A/B",          icon: SplitSquareHorizontal, color: "#ff6b35",     matchTypes: ["ab_test", "ab_testing"] },
  { id: "financial",    label: "Financiero",         icon: DollarSign,            color: "#00bcd4",     matchTypes: ["pricing_report", "financial"] },
  { id: "products",     label: "Productos",          icon: Package,               color: "var(--gold)", matchTypes: ["product_card"] },
  { id: "exports",      label: "Exportaciones",      icon: FileSpreadsheet,       color: "#607d8b",     matchTypes: ["bulk_export"] },
  { id: "email",        label: "Emails",             icon: Mail,                  color: "#e040fb",     matchTypes: ["email"] },
];

const CATEGORY_CONFIG: Record<string, string> = {
  hero: "🎯 Hero", lifestyle: "🌅 Lifestyle", detail: "🔍 Detalle",
  bundle: "📦 Bundle", ugc: "👤 UGC", scale: "📏 Escala", packaging: "🎁 Packaging",
};

interface VaultFile {
  id: number; fileType: string; category?: string; title: string;
  description?: string; originalUrl?: string; objectPath?: string;
  mimeType?: string; fileSizeBytes?: number; productId?: string;
  productTitle?: string; generatedBy?: string; metadata?: string;
  createdAt: string; downloadUrl?: string;
}

interface VaultStats {
  totalFiles: number; totalSizeBytes: number;
  byType: Array<{ fileType: string; count: number; sizeBytes: number }>;
}

export default function ProjectVault() {
  const [, params] = useRoute<{ id: string }>("/projects/:id/vault");
  const projectId = params?.id;
  const [, navigate] = useLocation();
  const [files, setFiles] = useState<VaultFile[]>([]);
  const [stats, setStats] = useState<VaultStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [filterType, setFilterType] = useState<string>("");
  const [filterCategory, setFilterCategory] = useState<string>("");
  const [downloading, setDownloading] = useState<number | null>(null);
  const [zipping, setZipping] = useState(false);
  const [deleting, setDeleting] = useState<number | null>(null);
  const [projectName, setProjectName] = useState<string>("");
  const [error, setError] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<"folders" | "list">("folders");
  const [activeFolder, setActiveFolder] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [selectMode, setSelectMode] = useState(false);
  const [zippingSelected, setZippingSelected] = useState(false);
  const [zippingFolder, setZippingFolder] = useState<string | null>(null);

  const pid = parseInt(projectId ?? "0");

  useEffect(() => {
    if (!pid) return;
    loadData();
    loadStats();
    fetch(`${API_BASE}/api/projects`, { credentials: "include" })
      .then(r => r.json())
      .then((projects: Array<{ id: number; name: string }>) => {
        const p = projects.find(p => p.id === pid);
        if (p) setProjectName(p.name);
      }).catch(() => {});
  }, [pid]);

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ limit: "500" });
      if (filterType) params.set("fileType", filterType);
      if (filterCategory) params.set("category", filterCategory);
      const res = await fetch(`${API_BASE}/api/projects/${pid}/vault?${params}`, { credentials: "include" });
      if (res.status === 403) { setError("Sin acceso a este proyecto"); setLoading(false); return; }
      const data = await res.json();
      setFiles(data.files ?? []);
    } catch { setError("Error cargando el vault"); }
    setLoading(false);
  };

  const loadStats = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/projects/${pid}/vault/stats`, { credentials: "include" });
      if (res.ok) setStats(await res.json());
    } catch {}
  };

  useEffect(() => { if (pid) loadData(); }, [filterType, filterCategory]);

  const downloadFile = async (file: VaultFile) => {
    setDownloading(file.id);
    try {
      const url = `${API_BASE}/api/projects/${pid}/vault/${file.id}/download`;
      const a = document.createElement("a");
      a.href = url; a.download = file.title; a.click();
    } catch {}
    setTimeout(() => setDownloading(null), 1500);
  };

  const downloadAll = async () => {
    setZipping(true);
    try {
      const url = `${API_BASE}/api/projects/${pid}/vault/download-all`;
      const a = document.createElement("a");
      a.href = url; a.download = `${projectName || "tienda"}_vault_completo.zip`; a.click();
    } catch {}
    setTimeout(() => setZipping(false), 3000);
  };

  const downloadSelected = async () => {
    if (selectedIds.size === 0) return;
    setZippingSelected(true);
    try {
      const res = await fetch(`${API_BASE}/api/projects/${pid}/vault/download-selected`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ fileIds: Array.from(selectedIds) }),
      });
      if (res.ok) {
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `${projectName || "tienda"}_seleccion_${selectedIds.size}.zip`;
        a.click();
        URL.revokeObjectURL(url);
      }
    } catch {}
    setZippingSelected(false);
  };

  const downloadFolder = async (folderId: string) => {
    const folder = FOLDER_CONFIG.find(f => f.id === folderId);
    if (!folder) return;
    setZippingFolder(folderId);
    try {
      const res = await fetch(`${API_BASE}/api/projects/${pid}/vault/download-selected`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ folderTypes: folder.matchTypes }),
      });
      if (res.ok) {
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `${projectName || "tienda"}_${folder.label.replace(/\s+/g, "_")}.zip`;
        a.click();
        URL.revokeObjectURL(url);
      }
    } catch {}
    setZippingFolder(null);
  };

  const deleteFile = async (file: VaultFile) => {
    if (!confirm(`¿Eliminar "${file.title}"?`)) return;
    setDeleting(file.id);
    try {
      await fetch(`${API_BASE}/api/projects/${pid}/vault/${file.id}`, {
        method: "DELETE", credentials: "include",
      });
      setFiles(prev => prev.filter(f => f.id !== file.id));
      setSelectedIds(prev => { const n = new Set(prev); n.delete(file.id); return n; });
      loadStats();
    } catch {}
    setDeleting(null);
  };

  const formatBytes = (bytes: number) => {
    if (bytes < 1024) return `${bytes}B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
  };

  const formatDate = (iso: string) => new Date(iso).toLocaleDateString("es-ES", {
    day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit",
  });

  const isImage = (file: VaultFile) => file.fileType === "image" || file.mimeType?.startsWith("image/");
  const imageUrl = (file: VaultFile) => file.originalUrl ?? null;

  const getFolderFiles = (folderId: string) => {
    const folder = FOLDER_CONFIG.find(f => f.id === folderId);
    if (!folder) return [];
    return files.filter(f => folder.matchTypes.includes(f.fileType));
  };

  const getDisplayFiles = () => {
    if (!activeFolder) return files;
    const folder = FOLDER_CONFIG.find(f => f.id === activeFolder);
    if (!folder) return files;
    return files.filter(f => folder.matchTypes.includes(f.fileType));
  };

  const toggleSelect = (id: number) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const selectAllVisible = () => {
    const visible = getDisplayFiles();
    setSelectedIds(new Set(visible.map(f => f.id)));
  };

  const clearSelection = () => {
    setSelectedIds(new Set());
    setSelectMode(false);
  };

  const openFolder = (folderId: string) => {
    setActiveFolder(folderId);
    setFilterType("");
    setFilterCategory("");
  };

  const closeFolder = () => {
    setActiveFolder(null);
    setFilterType("");
    setFilterCategory("");
  };

  if (error) return (
    <div style={{ maxWidth: 800, margin: "0 auto", padding: "40px 0", textAlign: "center" }}>
      <AlertTriangle size={40} color="var(--t3)" style={{ marginBottom: 12 }} />
      <p style={{ color: "var(--t2)", marginBottom: 20 }}>{error}</p>
      <button onClick={() => navigate("/admin")} className="btn-secondary">← Volver</button>
    </div>
  );

  const displayFiles = getDisplayFiles();
  const visibleSelected = displayFiles.filter(f => selectedIds.has(f.id)).length;

  return (
    <div className="page-inner">
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 24 }}>
        <button onClick={() => navigate("/admin")} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--t3)", display: "flex", alignItems: "center", gap: 4, fontSize: 13 }}>
          <ArrowLeft size={14} /> Volver
        </button>
        <div style={{ flex: 1 }}>
          <h1 style={{ fontSize: 22, fontWeight: 800, display: "flex", alignItems: "center", gap: 8 }}>
            <FolderOpen size={22} color="var(--gold)" /> Repositorio — {projectName || `Proyecto #${pid}`}
          </h1>
          <p style={{ fontSize: 12, color: "var(--t3)", marginTop: 2 }}>
            Todo el contenido generado para esta tienda · Descarga individual, por carpeta o todo
          </p>
        </div>
        <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
          <div style={{ display: "flex", borderRadius: 8, border: "1px solid var(--bdr)", overflow: "hidden" }}>
            <button
              onClick={() => { setViewMode("folders"); closeFolder(); }}
              style={{
                padding: "6px 10px", border: "none", cursor: "pointer", display: "flex", alignItems: "center", gap: 4, fontSize: 11, fontWeight: 600,
                background: viewMode === "folders" ? "rgba(200,168,75,0.15)" : "transparent",
                color: viewMode === "folders" ? "var(--gold)" : "var(--t3)",
              }}
            >
              <Grid size={12} /> Carpetas
            </button>
            <button
              onClick={() => { setViewMode("list"); closeFolder(); }}
              style={{
                padding: "6px 10px", border: "none", borderLeft: "1px solid var(--bdr)", cursor: "pointer", display: "flex", alignItems: "center", gap: 4, fontSize: 11, fontWeight: 600,
                background: viewMode === "list" ? "rgba(200,168,75,0.15)" : "transparent",
                color: viewMode === "list" ? "var(--gold)" : "var(--t3)",
              }}
            >
              <List size={12} /> Lista
            </button>
          </div>
          <button
            onClick={() => { setSelectMode(!selectMode); if (selectMode) clearSelection(); }}
            style={{
              padding: "6px 12px", borderRadius: 8, cursor: "pointer", display: "flex", alignItems: "center", gap: 5, fontSize: 11, fontWeight: 600,
              border: selectMode ? "1px solid var(--jade)" : "1px solid var(--bdr)",
              background: selectMode ? "rgba(45,212,159,0.12)" : "transparent",
              color: selectMode ? "var(--jade)" : "var(--t3)",
            }}
          >
            <CheckSquare size={12} /> Seleccionar
          </button>
          <button
            onClick={downloadAll}
            disabled={zipping || files.length === 0}
            className="btn-primary"
            style={{ display: "flex", alignItems: "center", gap: 7, flexShrink: 0 }}
          >
            {zipping
              ? <><RefreshCw size={14} style={{ animation: "spin 1s linear infinite" }} /> Preparando ZIP...</>
              : <><Archive size={14} /> Descargar todo ({files.length})</>}
          </button>
        </div>
      </div>

      {selectMode && selectedIds.size > 0 && (
        <div style={{
          position: "sticky", top: 0, zIndex: 50, marginBottom: 16,
          padding: "12px 18px", borderRadius: 12,
          background: "linear-gradient(135deg, rgba(45,212,159,0.12), rgba(91,78,255,0.08))",
          border: "1px solid var(--jade)",
          display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap",
        }}>
          <CheckCircle size={18} color="var(--jade)" />
          <span style={{ fontSize: 14, fontWeight: 700, color: "var(--t)" }}>
            {selectedIds.size} archivo{selectedIds.size !== 1 ? "s" : ""} seleccionado{selectedIds.size !== 1 ? "s" : ""}
          </span>
          <div style={{ flex: 1 }} />
          <button
            onClick={selectAllVisible}
            style={{ padding: "6px 14px", borderRadius: 7, border: "1px solid var(--bdr)", background: "rgba(200,168,75,0.08)", color: "var(--gold)", cursor: "pointer", fontSize: 12, fontWeight: 600, display: "flex", alignItems: "center", gap: 5 }}
          >
            <CheckSquare size={12} /> Seleccionar todos ({displayFiles.length})
          </button>
          <button
            onClick={downloadSelected}
            disabled={zippingSelected}
            style={{ padding: "6px 14px", borderRadius: 7, border: "1px solid var(--jade)", background: "rgba(45,212,159,0.12)", color: "var(--jade)", cursor: "pointer", fontSize: 12, fontWeight: 700, display: "flex", alignItems: "center", gap: 5 }}
          >
            {zippingSelected
              ? <><RefreshCw size={12} style={{ animation: "spin 1s linear infinite" }} /> Generando ZIP...</>
              : <><Archive size={12} /> Descargar selección ({selectedIds.size})</>}
          </button>
          <button
            onClick={clearSelection}
            style={{ padding: "6px 10px", borderRadius: 7, border: "1px solid rgba(255,75,75,0.3)", background: "rgba(255,75,75,0.06)", color: "#ff4b4b", cursor: "pointer", fontSize: 12, display: "flex", alignItems: "center", gap: 4 }}
          >
            <XCircle size={12} /> Limpiar
          </button>
        </div>
      )}

      {stats && (
        <div style={{ display: "flex", gap: 12, marginBottom: 20, flexWrap: "wrap" }}>
          <div className="glass-card" style={{ padding: "12px 16px", minWidth: 120 }}>
            <div style={{ fontSize: 22, fontWeight: 800, color: "var(--gold)" }}>{stats.totalFiles}</div>
            <div style={{ fontSize: 10, color: "var(--t3)" }}>Total archivos</div>
          </div>
          <div className="glass-card" style={{ padding: "12px 16px", minWidth: 120 }}>
            <div style={{ fontSize: 22, fontWeight: 800, color: "var(--jade)" }}>{formatBytes(stats.totalSizeBytes)}</div>
            <div style={{ fontSize: 10, color: "var(--t3)" }}>Espacio usado</div>
          </div>
        </div>
      )}

      {loading ? (
        <div style={{ textAlign: "center", padding: "60px 0", color: "var(--t3)" }}>
          <RefreshCw size={24} style={{ animation: "spin 1s linear infinite", marginBottom: 12 }} />
          <p>Cargando repositorio...</p>
        </div>
      ) : files.length === 0 ? (
        <div className="glass-card" style={{ textAlign: "center", padding: "60px 20px" }}>
          <FolderOpen size={48} style={{ opacity: 0.2, marginBottom: 12 }} />
          <p style={{ color: "var(--t2)", marginBottom: 6 }}>El repositorio está vacío</p>
          <p style={{ fontSize: 12, color: "var(--t3)" }}>
            Los archivos se guardan automáticamente cuando generas imágenes, optimizas SEO, o haces rediseños.
          </p>
        </div>
      ) : viewMode === "folders" && !activeFolder ? (
        <FolderGrid files={files} onOpenFolder={openFolder} onDownloadFolder={downloadFolder} zippingFolder={zippingFolder} />
      ) : (() => {
        const imageFiles = displayFiles.filter(f => f.fileType === "image" || f.mimeType?.startsWith("image/"));
        const nonImageFiles = displayFiles.filter(f => f.fileType !== "image" && !f.mimeType?.startsWith("image/"));
        return (
        <>
          {activeFolder && (
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
              <button
                onClick={closeFolder}
                style={{ background: "none", border: "none", cursor: "pointer", color: "var(--gold)", fontSize: 12, fontWeight: 600, display: "flex", alignItems: "center", gap: 4 }}
              >
                <FolderOpen size={12} /> Repositorio
              </button>
              <ChevronRight size={12} style={{ color: "var(--t3)" }} />
              <span style={{ fontSize: 12, fontWeight: 700, color: "var(--t)" }}>
                {FOLDER_CONFIG.find(f => f.id === activeFolder)?.label ?? activeFolder}
              </span>
              <span style={{ fontSize: 11, color: "var(--t3)", marginLeft: 4 }}>
                ({displayFiles.length} archivos)
              </span>
              <div style={{ flex: 1 }} />
              <button
                onClick={() => downloadFolder(activeFolder)}
                disabled={zippingFolder === activeFolder}
                style={{ padding: "6px 14px", borderRadius: 7, border: "1px solid var(--gold)", background: "rgba(200,168,75,0.08)", color: "var(--gold)", cursor: "pointer", fontSize: 12, fontWeight: 600, display: "flex", alignItems: "center", gap: 5 }}
              >
                {zippingFolder === activeFolder
                  ? <><RefreshCw size={12} style={{ animation: "spin 1s linear infinite" }} /> ZIP...</>
                  : <><Archive size={12} /> Descargar carpeta ({displayFiles.length})</>}
              </button>
            </div>
          )}

          {viewMode === "list" && !activeFolder && (
            <div style={{ display: "flex", gap: 10, marginBottom: 16, flexWrap: "wrap" }}>
              <select
                value={filterType}
                onChange={e => { setFilterType(e.target.value); if (e.target.value !== "image") setFilterCategory(""); }}
                style={{ padding: "8px 12px", borderRadius: 8, border: "1px solid var(--bdr)", background: "var(--ink3)", color: "var(--t)", fontSize: 13, cursor: "pointer" }}
              >
                <option value="">Todos los tipos</option>
                {Object.entries(FILE_TYPE_CONFIG).map(([k, v]) => (
                  <option key={k} value={k}>{v.label}</option>
                ))}
              </select>
              {(filterType === "image") && (
                <select
                  value={filterCategory}
                  onChange={e => setFilterCategory(e.target.value)}
                  style={{ padding: "8px 12px", borderRadius: 8, border: "1px solid var(--bdr)", background: "var(--ink3)", color: "var(--t)", fontSize: 13, cursor: "pointer" }}
                >
                  <option value="">Todas las categorías</option>
                  {Object.entries(CATEGORY_CONFIG).map(([k, v]) => (
                    <option key={k} value={k}>{v}</option>
                  ))}
                </select>
              )}
              <button onClick={() => loadData()} style={{ padding: "8px 12px", borderRadius: 8, border: "1px solid var(--bdr)", background: "var(--ink3)", color: "var(--t3)", cursor: "pointer", display: "flex", alignItems: "center", gap: 5, fontSize: 12 }}>
                <RefreshCw size={12} /> Actualizar
              </button>
              {(filterType || filterCategory) && (
                <button onClick={() => { setFilterType(""); setFilterCategory(""); }} style={{ padding: "8px 12px", borderRadius: 8, border: "1px solid var(--bdr)", background: "none", color: "var(--t3)", cursor: "pointer", fontSize: 12 }}>
                  ✕ Limpiar filtros
                </button>
              )}
            </div>
          )}

          {imageFiles.length > 0 && (
            <div style={{ marginBottom: 24 }}>
              {!activeFolder && (
                <h3 style={{ fontSize: 13, fontWeight: 700, color: "var(--t2)", marginBottom: 12, display: "flex", alignItems: "center", gap: 6 }}>
                  <Image size={13} color="#5b4eff" /> Imágenes ({imageFiles.length})
                </h3>
              )}
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: 12 }}>
                {imageFiles.map(file => (
                  <div key={file.id} style={{
                    position: "relative", borderRadius: 10, overflow: "hidden",
                    border: selectedIds.has(file.id) ? "2px solid var(--jade)" : "1px solid var(--bdr)",
                    background: "var(--ink3)",
                    boxShadow: selectedIds.has(file.id) ? "0 0 12px rgba(45,212,159,0.15)" : "none",
                  }}>
                    {selectMode && (
                      <button
                        onClick={() => toggleSelect(file.id)}
                        style={{
                          position: "absolute", top: 8, left: 8, zIndex: 5,
                          width: 28, height: 28, borderRadius: 6,
                          border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
                          background: selectedIds.has(file.id) ? "var(--jade)" : "rgba(0,0,0,0.6)",
                          color: selectedIds.has(file.id) ? "#fff" : "var(--t3)",
                        }}
                      >
                        {selectedIds.has(file.id) ? <CheckSquare size={14} /> : <Square size={14} />}
                      </button>
                    )}
                    {imageUrl(file) ? (
                      <img
                        src={imageUrl(file)!}
                        alt={file.title}
                        style={{ width: "100%", aspectRatio: "1", objectFit: "cover", display: "block", cursor: selectMode ? "pointer" : "default" }}
                        loading="lazy"
                        onClick={() => selectMode && toggleSelect(file.id)}
                        onError={e => { (e.target as HTMLImageElement).style.display = "none"; }}
                      />
                    ) : (
                      <div
                        style={{ width: "100%", aspectRatio: "1", background: "var(--ink4)", display: "flex", alignItems: "center", justifyContent: "center", cursor: selectMode ? "pointer" : "default" }}
                        onClick={() => selectMode && toggleSelect(file.id)}
                      >
                        <Image size={32} style={{ opacity: 0.2 }} />
                      </div>
                    )}
                    <div style={{ padding: "10px 12px" }}>
                      <div style={{ fontSize: 10, color: "#5b4eff", fontWeight: 600, marginBottom: 3 }}>
                        {CATEGORY_CONFIG[file.category ?? ""] ?? file.category ?? "imagen"}
                      </div>
                      <p style={{ fontSize: 12, fontWeight: 600, color: "var(--t)", marginBottom: 2, lineClamp: 2, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
                        {file.productTitle ?? file.title}
                      </p>
                      <p style={{ fontSize: 10, color: "var(--t3)", marginBottom: 10 }}>{formatDate(file.createdAt)}</p>
                      <div style={{ display: "flex", gap: 6 }}>
                        <button
                          onClick={() => downloadFile(file)}
                          disabled={downloading === file.id}
                          style={{ flex: 1, padding: "6px 0", borderRadius: 6, border: "1px solid #5b4eff", background: "rgba(91,78,255,0.1)", color: "#5b4eff", cursor: "pointer", fontSize: 11, display: "flex", alignItems: "center", justifyContent: "center", gap: 4 }}
                        >
                          {downloading === file.id ? <RefreshCw size={10} style={{ animation: "spin 1s linear infinite" }} /> : <Download size={10} />}
                          Descargar
                        </button>
                        {file.originalUrl && (
                          <a href={file.originalUrl} target="_blank" rel="noreferrer" style={{ padding: "6px 8px", borderRadius: 6, border: "1px solid var(--bdr)", color: "var(--t3)", display: "flex", alignItems: "center" }}>
                            <ExternalLink size={10} />
                          </a>
                        )}
                        <button onClick={() => deleteFile(file)} disabled={deleting === file.id} style={{ padding: "6px 8px", borderRadius: 6, border: "1px solid rgba(255,75,75,0.2)", background: "rgba(255,75,75,0.06)", color: "#ff4b4b", cursor: "pointer", display: "flex", alignItems: "center" }}>
                          <Trash2 size={10} />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {nonImageFiles.length > 0 && (
            <div>
              {!activeFolder && (
                <h3 style={{ fontSize: 13, fontWeight: 700, color: "var(--t2)", marginBottom: 12 }}>
                  Informes y documentos ({nonImageFiles.length})
                </h3>
              )}
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {nonImageFiles.map(file => {
                  const cfg = FILE_TYPE_CONFIG[file.fileType];
                  const Icon = cfg?.icon ?? FileText;
                  return (
                    <div key={file.id} style={{
                      padding: "14px 16px", background: "var(--ink3)", borderRadius: 10,
                      border: selectedIds.has(file.id) ? "2px solid var(--jade)" : "1px solid var(--bdr)",
                      display: "flex", alignItems: "center", gap: 14,
                      boxShadow: selectedIds.has(file.id) ? "0 0 12px rgba(45,212,159,0.15)" : "none",
                    }}>
                      {selectMode && (
                        <button
                          onClick={() => toggleSelect(file.id)}
                          style={{
                            width: 28, height: 28, borderRadius: 6, flexShrink: 0,
                            border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
                            background: selectedIds.has(file.id) ? "var(--jade)" : "rgba(100,100,100,0.2)",
                            color: selectedIds.has(file.id) ? "#fff" : "var(--t3)",
                          }}
                        >
                          {selectedIds.has(file.id) ? <CheckSquare size={14} /> : <Square size={14} />}
                        </button>
                      )}
                      <div style={{ width: 36, height: 36, borderRadius: 8, background: `${cfg?.color ?? "var(--t3)"}15`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                        <Icon size={16} color={cfg?.color ?? "var(--t3)"} />
                      </div>
                      <div style={{ flex: 1, minWidth: 0, cursor: selectMode ? "pointer" : "default" }} onClick={() => selectMode && toggleSelect(file.id)}>
                        <p style={{ fontSize: 13, fontWeight: 600, color: "var(--t)", marginBottom: 2 }}>{file.title}</p>
                        {file.description && <p style={{ fontSize: 11, color: "var(--t3)", marginBottom: 2 }}>{file.description}</p>}
                        <p style={{ fontSize: 10, color: "var(--t3)" }}>
                          {cfg?.label ?? file.fileType}
                          {file.productTitle && ` · ${file.productTitle}`}
                          {" · "}{formatDate(file.createdAt)}
                          {file.fileSizeBytes && ` · ${formatBytes(file.fileSizeBytes)}`}
                        </p>
                      </div>
                      <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
                        <button onClick={() => downloadFile(file)} disabled={downloading === file.id} style={{ padding: "7px 12px", borderRadius: 7, border: `1px solid ${cfg?.color ?? "var(--bdr)"}`, background: `${cfg?.color ?? "var(--t3)"}15`, color: cfg?.color ?? "var(--t)", cursor: "pointer", fontSize: 12, display: "flex", alignItems: "center", gap: 5 }}>
                          {downloading === file.id ? <RefreshCw size={12} style={{ animation: "spin 1s linear infinite" }} /> : <Download size={12} />} Descargar
                        </button>
                        <button onClick={() => deleteFile(file)} disabled={deleting === file.id} style={{ padding: "7px 10px", borderRadius: 7, border: "1px solid rgba(255,75,75,0.2)", background: "rgba(255,75,75,0.06)", color: "#ff4b4b", cursor: "pointer", display: "flex", alignItems: "center" }}>
                          <Trash2 size={12} />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </>
        );
      })()}
    </div>
  );
}

function FolderGrid({ files, onOpenFolder, onDownloadFolder, zippingFolder }: {
  files: VaultFile[];
  onOpenFolder: (id: string) => void;
  onDownloadFolder: (id: string) => void;
  zippingFolder: string | null;
}) {
  const getFolderCount = (folder: typeof FOLDER_CONFIG[0]) =>
    files.filter(f => folder.matchTypes.includes(f.fileType)).length;

  const allMatchTypes = FOLDER_CONFIG.flatMap(f => f.matchTypes);
  const uncategorized = files.filter(f => !allMatchTypes.includes(f.fileType));

  const nonEmptyFolders = FOLDER_CONFIG.filter(f => getFolderCount(f) > 0);

  return (
    <div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: 14 }}>
        {nonEmptyFolders.map(folder => {
          const count = getFolderCount(folder);
          const Icon = folder.icon;
          const latestFile = files
            .filter(f => folder.matchTypes.includes(f.fileType))
            .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0];

          return (
            <div
              key={folder.id}
              style={{
                border: "1px solid var(--bdr)", borderRadius: 14, background: "var(--ink3)",
                overflow: "hidden", transition: "all 0.2s",
              }}
              onMouseEnter={e => {
                (e.currentTarget as HTMLElement).style.borderColor = folder.color;
                (e.currentTarget as HTMLElement).style.transform = "translateY(-2px)";
              }}
              onMouseLeave={e => {
                (e.currentTarget as HTMLElement).style.borderColor = "var(--bdr)";
                (e.currentTarget as HTMLElement).style.transform = "translateY(0)";
              }}
            >
              <button
                onClick={() => onOpenFolder(folder.id)}
                style={{
                  padding: "20px 18px 12px", border: "none", background: "transparent",
                  cursor: "pointer", textAlign: "left", width: "100%", display: "block",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
                  <div style={{
                    width: 44, height: 44, borderRadius: 12,
                    background: `${folder.color}15`,
                    display: "flex", alignItems: "center", justifyContent: "center",
                  }}>
                    <Icon size={22} color={folder.color} />
                  </div>
                  <ChevronRight size={16} style={{ color: "var(--t3)" }} />
                </div>
                <p style={{ fontSize: 14, fontWeight: 700, color: "var(--t)", marginBottom: 4 }}>{folder.label}</p>
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <span style={{ fontSize: 20, fontWeight: 800, color: folder.color }}>{count}</span>
                  <span style={{ fontSize: 11, color: "var(--t3)" }}>archivo{count !== 1 ? "s" : ""}</span>
                </div>
                {latestFile && (
                  <p style={{ fontSize: 10, color: "var(--t3)", marginTop: 8, opacity: 0.7 }}>
                    Último: {new Date(latestFile.createdAt).toLocaleDateString("es-ES", { day: "numeric", month: "short" })}
                  </p>
                )}
              </button>
              <div style={{ padding: "0 18px 16px", display: "flex", gap: 6 }}>
                <button
                  onClick={(e) => { e.stopPropagation(); onDownloadFolder(folder.id); }}
                  disabled={zippingFolder === folder.id}
                  style={{
                    flex: 1, padding: "7px 0", borderRadius: 8, cursor: "pointer", fontSize: 11, fontWeight: 600,
                    border: `1px solid ${folder.color}40`, background: `${folder.color}10`, color: folder.color,
                    display: "flex", alignItems: "center", justifyContent: "center", gap: 5,
                  }}
                >
                  {zippingFolder === folder.id
                    ? <><RefreshCw size={11} style={{ animation: "spin 1s linear infinite" }} /> ZIP...</>
                    : <><Archive size={11} /> Descargar ZIP</>}
                </button>
              </div>
            </div>
          );
        })}

        {uncategorized.length > 0 && (
          <div
            style={{
              padding: "20px 18px 16px", border: "1px solid var(--bdr)", borderRadius: 14,
              background: "var(--ink3)",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
              <div style={{ width: 44, height: 44, borderRadius: 12, background: "rgba(150,150,150,0.1)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <FileText size={22} color="var(--t3)" />
              </div>
            </div>
            <p style={{ fontSize: 14, fontWeight: 700, color: "var(--t)", marginBottom: 4 }}>Otros</p>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <span style={{ fontSize: 20, fontWeight: 800, color: "var(--t3)" }}>{uncategorized.length}</span>
              <span style={{ fontSize: 11, color: "var(--t3)" }}>archivo{uncategorized.length !== 1 ? "s" : ""}</span>
            </div>
          </div>
        )}
      </div>

      {nonEmptyFolders.length === 0 && uncategorized.length === 0 && (
        <div className="glass-card" style={{ textAlign: "center", padding: "60px 20px" }}>
          <FolderOpen size={48} style={{ opacity: 0.2, marginBottom: 12 }} />
          <p style={{ color: "var(--t2)" }}>El repositorio está vacío</p>
        </div>
      )}
    </div>
  );
}
