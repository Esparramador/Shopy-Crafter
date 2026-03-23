import { useState, useEffect } from "react";
import { useRoute, useLocation } from "wouter";
import {
  FolderOpen, Download, Trash2, Image, FileText, RefreshCw,
  ArrowLeft, Package, BarChart2, Mail, Search,
  Archive, ExternalLink, AlertTriangle,
} from "lucide-react";

const API_BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

const FILE_TYPE_CONFIG: Record<string, { label: string; icon: typeof Image; color: string }> = {
  image:          { label: "Imágenes",       icon: Image,     color: "#5b4eff" },
  seo_report:     { label: "SEO",            icon: Search,    color: "var(--jade)" },
  redesign:       { label: "Rediseños",      icon: FileText,  color: "var(--gold)" },
  ab_test:        { label: "Tests A/B",      icon: BarChart2, color: "#ff6b35" },
  email:          { label: "Emails",         icon: Mail,      color: "#e040fb" },
  pricing_report: { label: "Pricing",        icon: Package,   color: "#00bcd4" },
  audit:          { label: "Auditorías",     icon: FileText,  color: "#ff9800" },
  bulk_export:    { label: "Exportaciones",  icon: Archive,   color: "#607d8b" },
};

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

  const pid = parseInt(projectId ?? "0");

  useEffect(() => {
    if (!pid) return;
    loadData();
    loadStats();
    // Load project name
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
      const params = new URLSearchParams({ limit: "200" });
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
      a.href = url; a.download = `${projectName || "tienda"}_vault.zip`; a.click();
    } catch {}
    setTimeout(() => setZipping(false), 3000);
  };

  const deleteFile = async (file: VaultFile) => {
    if (!confirm(`¿Eliminar "${file.title}"?`)) return;
    setDeleting(file.id);
    try {
      await fetch(`${API_BASE}/api/projects/${pid}/vault/${file.id}`, {
        method: "DELETE", credentials: "include",
      });
      setFiles(prev => prev.filter(f => f.id !== file.id));
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

  if (error) return (
    <div style={{ maxWidth: 800, margin: "0 auto", padding: "40px 0", textAlign: "center" }}>
      <AlertTriangle size={40} color="var(--t3)" style={{ marginBottom: 12 }} />
      <p style={{ color: "var(--t2)", marginBottom: 20 }}>{error}</p>
      <button onClick={() => navigate("/admin")} className="btn-secondary">← Volver</button>
    </div>
  );

  return (
    <div className="page-inner">
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 24 }}>
        <button onClick={() => navigate("/admin")} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--t3)", display: "flex", alignItems: "center", gap: 4, fontSize: 13 }}>
          <ArrowLeft size={14} /> Volver
        </button>
        <div style={{ flex: 1 }}>
          <h1 style={{ fontSize: 22, fontWeight: 800, display: "flex", alignItems: "center", gap: 8 }}>
            <FolderOpen size={22} color="var(--gold)" /> Repositorio — {projectName || `Proyecto #${pid}`}
          </h1>
          <p style={{ fontSize: 12, color: "var(--t3)", marginTop: 2 }}>
            Todo el contenido generado para esta tienda · Solo accesible por admin + dueño de la tienda
          </p>
        </div>
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

      {/* Stats */}
      {stats && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 12, marginBottom: 20 }}>
          <div className="glass-card" style={{ padding: "14px 16px" }}>
            <div style={{ fontSize: 24, fontWeight: 800, color: "var(--gold)" }}>{stats.totalFiles}</div>
            <div style={{ fontSize: 11, color: "var(--t3)" }}>Archivos totales</div>
          </div>
          {stats.byType.map(t => {
            const cfg = FILE_TYPE_CONFIG[t.fileType];
            const Icon = cfg?.icon ?? FileText;
            return (
              <div key={t.fileType} className="glass-card" style={{ padding: "14px 16px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
                  <Icon size={12} color={cfg?.color ?? "var(--t3)"} />
                  <span style={{ fontSize: 10, color: "var(--t3)" }}>{cfg?.label ?? t.fileType}</span>
                </div>
                <div style={{ fontSize: 20, fontWeight: 800, color: cfg?.color ?? "var(--t)" }}>{t.count}</div>
              </div>
            );
          })}
        </div>
      )}

      {/* Filters */}
      <div style={{ display: "flex", gap: 10, marginBottom: 16, flexWrap: "wrap" }}>
        <select
          value={filterType}
          onChange={e => setFilterType(e.target.value)}
          style={{ padding: "8px 12px", borderRadius: 8, border: "1px solid var(--bdr)", background: "var(--ink3)", color: "var(--t)", fontSize: 13, cursor: "pointer" }}
        >
          <option value="">Todos los tipos</option>
          {Object.entries(FILE_TYPE_CONFIG).map(([k, v]) => (
            <option key={k} value={k}>{v.label}</option>
          ))}
        </select>
        {filterType === "image" && (
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

      {/* Files grid */}
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
            Los archivos se guardan automáticamente cuando generas imágenes, optimizas SEO, o haces rediseños
          </p>
        </div>
      ) : (
        <>
          {/* Image files — grid */}
          {files.some(f => f.fileType === "image") && (!filterType || filterType === "image") && (
            <div style={{ marginBottom: 24 }}>
              <h3 style={{ fontSize: 13, fontWeight: 700, color: "var(--t2)", marginBottom: 12, display: "flex", alignItems: "center", gap: 6 }}>
                <Image size={13} color="#5b4eff" /> Imágenes ({files.filter(f => f.fileType === "image").length})
              </h3>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: 12 }}>
                {files.filter(f => f.fileType === "image").map(file => (
                  <div key={file.id} style={{ position: "relative", borderRadius: 10, overflow: "hidden", border: "1px solid var(--bdr)", background: "var(--ink3)" }}>
                    {imageUrl(file) ? (
                      <img
                        src={imageUrl(file)!}
                        alt={file.title}
                        style={{ width: "100%", aspectRatio: "1", objectFit: "cover", display: "block" }}
                        loading="lazy"
                        onError={e => { (e.target as HTMLImageElement).style.display = "none"; }}
                      />
                    ) : (
                      <div style={{ width: "100%", aspectRatio: "1", background: "var(--ink4)", display: "flex", alignItems: "center", justifyContent: "center" }}>
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

          {/* Non-image files — list */}
          {files.filter(f => f.fileType !== "image").length > 0 && (
            <div>
              <h3 style={{ fontSize: 13, fontWeight: 700, color: "var(--t2)", marginBottom: 12 }}>
                Otros archivos ({files.filter(f => f.fileType !== "image").length})
              </h3>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {files.filter(f => f.fileType !== "image").map(file => {
                  const cfg = FILE_TYPE_CONFIG[file.fileType];
                  const Icon = cfg?.icon ?? FileText;
                  return (
                    <div key={file.id} style={{ padding: "14px 16px", background: "var(--ink3)", borderRadius: 10, border: "1px solid var(--bdr)", display: "flex", alignItems: "center", gap: 14 }}>
                      <div style={{ width: 36, height: 36, borderRadius: 8, background: `${cfg?.color ?? "var(--t3)"}15`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                        <Icon size={16} color={cfg?.color ?? "var(--t3)"} />
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
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
      )}
    </div>
  );
}
