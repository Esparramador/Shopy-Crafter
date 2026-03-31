import { useState, useEffect, useCallback } from "react";
import { useLocation } from "wouter";
import {
  FolderOpen, Download, Trash2, Image, FileText, RefreshCw,
  ArrowLeft, Package, BarChart2, Search, Building2,
  ExternalLink, Grid, List, Folder, Eye, ChevronRight,
  DollarSign, Palette, Wand2, SplitSquareHorizontal,
  ShieldCheck, FileSpreadsheet, Mail, Globe, Archive,
  CheckSquare, Square, ChevronDown, Filter,
} from "lucide-react";

const API_BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

const FILE_TYPE_CONFIG: Record<string, { label: string; icon: typeof Image; color: string }> = {
  image:          { label: "Imágenes",           icon: Image,                 color: "#5b4eff" },
  seo_report:     { label: "SEO",               icon: Search,                color: "#2ecc71" },
  seo_audit:      { label: "SEO",               icon: Search,                color: "#2ecc71" },
  redesign:       { label: "Rediseños",          icon: Wand2,                 color: "#c8a84b" },
  ab_test:        { label: "Tests A/B",          icon: SplitSquareHorizontal, color: "#ff6b35" },
  ab_testing:     { label: "Tests A/B",          icon: SplitSquareHorizontal, color: "#ff6b35" },
  email:          { label: "Emails",             icon: Mail,                  color: "#e040fb" },
  pricing_report: { label: "Financiero",         icon: DollarSign,            color: "#00bcd4" },
  financial:      { label: "Financiero",         icon: DollarSign,            color: "#00bcd4" },
  audit:          { label: "Auditorías",         icon: ShieldCheck,           color: "#ff9800" },
  consistency:    { label: "Consistencia Visual", icon: Palette,              color: "#9c27b0" },
  bulk_export:    { label: "Exportaciones",      icon: FileSpreadsheet,       color: "#607d8b" },
  product_card:   { label: "Productos",          icon: Package,               color: "#c8a84b" },
  research:       { label: "Investigación",      icon: Globe,                 color: "#3498db" },
  competitor:     { label: "Competencia",        icon: BarChart2,             color: "#e74c3c" },
};

const FOLDER_ORDER = [
  "audit", "seo_report", "seo_audit", "image", "redesign", "research",
  "competitor", "ab_test", "ab_testing", "consistency", "pricing_report",
  "financial", "product_card", "email", "bulk_export",
];

interface Entity {
  name: string;
  url: string | null;
  projectId: number | null;
  fileCount: number;
  source: "project" | "external";
}

interface VaultFile {
  id: number;
  projectId: number | null;
  fileType: string;
  category?: string;
  title: string;
  description?: string;
  originalUrl?: string;
  objectPath?: string;
  mimeType?: string;
  fileSizeBytes?: number;
  productId?: string;
  productTitle?: string;
  generatedBy?: string;
  metadata?: string;
  entityName?: string;
  entityUrl?: string;
  createdAt: string;
  downloadUrl?: string;
}

export default function GlobalVault() {
  const [, navigate] = useLocation();
  const [entities, setEntities] = useState<Entity[]>([]);
  const [selectedEntity, setSelectedEntity] = useState<Entity | null>(null);
  const [files, setFiles] = useState<VaultFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingFiles, setLoadingFiles] = useState(false);
  const [filterType, setFilterType] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedFiles, setSelectedFiles] = useState<Set<number>>(new Set());
  const [viewMode, setViewMode] = useState<"folders" | "list">("folders");
  const [downloading, setDownloading] = useState<number | null>(null);
  const [zipping, setZipping] = useState(false);
  const [deleting, setDeleting] = useState<number | null>(null);
  const [activeFolderType, setActiveFolderType] = useState<string | null>(null);

  const loadEntities = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/vault/global/entities`, { credentials: "include" });
      if (res.ok) {
        const data = await res.json();
        setEntities(data.entities);
      }
    } catch { /* ignore */ }
    setLoading(false);
  }, []);

  useEffect(() => { loadEntities(); }, [loadEntities]);

  const loadEntityFiles = useCallback(async (entity: Entity, fileType?: string) => {
    setLoadingFiles(true);
    try {
      const params = new URLSearchParams();
      params.set("entityName", entity.name);
      if (entity.projectId) params.set("projectId", String(entity.projectId));
      if (fileType) params.set("fileType", fileType);
      params.set("limit", "200");

      const res = await fetch(`${API_BASE}/api/vault/global?${params}`, { credentials: "include" });
      if (res.ok) {
        const data = await res.json();
        setFiles(data.files);
      }
    } catch { /* ignore */ }
    setLoadingFiles(false);
  }, []);

  const handleEntityClick = (entity: Entity) => {
    setSelectedEntity(entity);
    setActiveFolderType(null);
    setFilterType("");
    setSelectedFiles(new Set());
    loadEntityFiles(entity);
  };

  const handleFolderClick = (type: string) => {
    setActiveFolderType(type);
    setFilterType(type);
    if (selectedEntity) loadEntityFiles(selectedEntity, type);
  };

  const handleBack = () => {
    if (activeFolderType) {
      setActiveFolderType(null);
      setFilterType("");
      if (selectedEntity) loadEntityFiles(selectedEntity);
    } else {
      setSelectedEntity(null);
      setFiles([]);
    }
  };

  const handleDownload = async (file: VaultFile) => {
    if (!file.downloadUrl) return;
    setDownloading(file.id);
    try {
      const res = await fetch(`${API_BASE}${file.downloadUrl}`, { credentials: "include" });
      if (res.ok) {
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = file.title.replace(/[^a-zA-Z0-9._-]/g, "_") + getExt(file.mimeType);
        a.click();
        URL.revokeObjectURL(url);
      }
    } catch { /* ignore */ }
    setDownloading(null);
  };

  const handleDelete = async (file: VaultFile) => {
    if (!confirm(`¿Eliminar "${file.title}"?`)) return;
    setDeleting(file.id);
    try {
      const res = await fetch(`${API_BASE}/api/vault/global/${file.id}`, {
        method: "DELETE", credentials: "include",
      });
      if (res.ok) {
        setFiles(f => f.filter(x => x.id !== file.id));
      }
    } catch { /* ignore */ }
    setDeleting(null);
  };

  const handleDownloadSelected = async () => {
    if (selectedFiles.size === 0) return;
    setZipping(true);
    try {
      const res = await fetch(`${API_BASE}/api/vault/global/download-selected`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fileIds: Array.from(selectedFiles),
          entityName: selectedEntity?.name,
        }),
      });
      if (res.ok) {
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `${selectedEntity?.name?.replace(/[^a-zA-Z0-9._-]/g, "_") || "vault"}_selection.zip`;
        a.click();
        URL.revokeObjectURL(url);
      }
    } catch { /* ignore */ }
    setZipping(false);
  };

  const toggleSelect = (id: number) => {
    setSelectedFiles(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const selectAll = () => {
    if (selectedFiles.size === displayFiles.length) {
      setSelectedFiles(new Set());
    } else {
      setSelectedFiles(new Set(displayFiles.map(f => f.id)));
    }
  };

  const displayFiles = files.filter(f => {
    if (filterType && f.fileType !== filterType) return false;
    if (searchQuery && !f.title.toLowerCase().includes(searchQuery.toLowerCase())) return false;
    return true;
  });

  const fileTypeGroups = files.reduce<Record<string, VaultFile[]>>((acc, f) => {
    const key = f.fileType;
    if (!acc[key]) acc[key] = [];
    acc[key].push(f);
    return acc;
  }, {});

  const sortedFolderTypes = Object.keys(fileTypeGroups).sort((a, b) => {
    const ai = FOLDER_ORDER.indexOf(a);
    const bi = FOLDER_ORDER.indexOf(b);
    return (ai === -1 ? 999 : ai) - (bi === -1 ? 999 : bi);
  });

  const filteredEntities = entities.filter(e =>
    !searchQuery || e.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (e.url && e.url.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  if (loading) {
    return (
      <div style={{ padding: 40, textAlign: "center", color: "#8b8b9e" }}>
        <RefreshCw size={28} style={{ animation: "spin 1s linear infinite" }} />
        <p style={{ marginTop: 12 }}>Cargando Bóveda Global...</p>
      </div>
    );
  }

  return (
    <div style={{ padding: "24px 28px", maxWidth: 1200, margin: "0 auto" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 24 }}>
        {selectedEntity && (
          <button onClick={handleBack} style={{
            background: "none", border: "none", color: "#c8a84b", cursor: "pointer",
            display: "flex", alignItems: "center", gap: 4, fontSize: 14,
          }}>
            <ArrowLeft size={18} /> Volver
          </button>
        )}
        <div style={{ flex: 1 }}>
          <h1 style={{ fontSize: 22, fontWeight: 800, color: "#f5f5f7", margin: 0, display: "flex", alignItems: "center", gap: 8 }}>
            <Archive size={24} style={{ color: "#c8a84b" }} />
            {selectedEntity
              ? activeFolderType
                ? `${selectedEntity.name} / ${FILE_TYPE_CONFIG[activeFolderType]?.label || activeFolderType}`
                : selectedEntity.name
              : "Bóveda Global"
            }
          </h1>
          <p style={{ fontSize: 13, color: "#8b8b9e", margin: "4px 0 0" }}>
            {selectedEntity
              ? `${selectedEntity.url || "Sin URL"} — ${selectedEntity.source === "project" ? "Proyecto registrado" : "Búsqueda externa"}`
              : `${entities.length} empresas · Informes, auditorías, imágenes y más`
            }
          </p>
        </div>

        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <div style={{ position: "relative" }}>
            <Search size={16} style={{ position: "absolute", left: 10, top: 10, color: "#8b8b9e" }} />
            <input
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder={selectedEntity ? "Buscar archivos..." : "Buscar empresas..."}
              style={{
                background: "#111118", border: "1px solid #1e1e2e", borderRadius: 8,
                padding: "8px 12px 8px 34px", color: "#f5f5f7", fontSize: 13, width: 200,
                outline: "none",
              }}
            />
          </div>
          {selectedEntity && (
            <>
              <button
                onClick={() => setViewMode(v => v === "folders" ? "list" : "folders")}
                style={{
                  background: "#111118", border: "1px solid #1e1e2e", borderRadius: 8,
                  padding: "8px 12px", color: "#8b8b9e", cursor: "pointer",
                  display: "flex", alignItems: "center", gap: 4,
                }}
              >
                {viewMode === "folders" ? <List size={16} /> : <Grid size={16} />}
              </button>
              <button onClick={loadEntities} style={{
                background: "#111118", border: "1px solid #1e1e2e", borderRadius: 8,
                padding: "8px 12px", color: "#8b8b9e", cursor: "pointer",
              }}>
                <RefreshCw size={16} />
              </button>
            </>
          )}
        </div>
      </div>

      {!selectedEntity ? (
        <div>
          <div style={{
            display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
            gap: 16,
          }}>
            {filteredEntities.map((entity, i) => (
              <button
                key={`${entity.source}-${entity.projectId || entity.name}-${i}`}
                onClick={() => handleEntityClick(entity)}
                style={{
                  background: "#111118", border: "1px solid #1e1e2e", borderRadius: 14,
                  padding: 20, cursor: "pointer", textAlign: "left",
                  transition: "all 0.2s", position: "relative", overflow: "hidden",
                }}
                onMouseEnter={e => {
                  (e.currentTarget as HTMLElement).style.borderColor = "#c8a84b";
                  (e.currentTarget as HTMLElement).style.transform = "translateY(-2px)";
                }}
                onMouseLeave={e => {
                  (e.currentTarget as HTMLElement).style.borderColor = "#1e1e2e";
                  (e.currentTarget as HTMLElement).style.transform = "translateY(0)";
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 12 }}>
                  <div style={{
                    width: 44, height: 44, borderRadius: 12,
                    background: entity.source === "project" ? "rgba(200,168,75,0.12)" : "rgba(59,130,246,0.12)",
                    display: "flex", alignItems: "center", justifyContent: "center",
                  }}>
                    {entity.source === "project"
                      ? <Building2 size={22} style={{ color: "#c8a84b" }} />
                      : <Globe size={22} style={{ color: "#3b82f6" }} />
                    }
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 15, fontWeight: 700, color: "#f5f5f7" }}>{entity.name}</div>
                    {entity.url && (
                      <div style={{ fontSize: 12, color: "#8b8b9e", marginTop: 2 }}>{entity.url}</div>
                    )}
                  </div>
                  <ChevronRight size={18} style={{ color: "#8b8b9e" }} />
                </div>
                <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                  <span style={{
                    fontSize: 11, fontWeight: 700,
                    padding: "3px 8px", borderRadius: 6,
                    background: entity.source === "project" ? "rgba(200,168,75,0.15)" : "rgba(59,130,246,0.15)",
                    color: entity.source === "project" ? "#c8a84b" : "#3b82f6",
                    textTransform: "uppercase",
                  }}>
                    {entity.source === "project" ? "Proyecto" : "Externa"}
                  </span>
                  <span style={{ fontSize: 12, color: "#8b8b9e" }}>
                    {entity.fileCount} {entity.fileCount === 1 ? "archivo" : "archivos"}
                  </span>
                </div>
              </button>
            ))}
          </div>

          {filteredEntities.length === 0 && (
            <div style={{
              textAlign: "center", padding: 60, color: "#8b8b9e",
              background: "#111118", borderRadius: 14, border: "1px solid #1e1e2e",
            }}>
              <Archive size={40} style={{ marginBottom: 12, opacity: 0.4 }} />
              <p style={{ fontSize: 15, fontWeight: 600, color: "#f5f5f7" }}>
                {searchQuery ? "No se encontraron empresas" : "Bóveda vacía"}
              </p>
              <p style={{ fontSize: 13, marginTop: 4 }}>
                {searchQuery
                  ? "Prueba con otro término de búsqueda"
                  : "Guarda informes desde cualquier herramienta para verlos aquí"
                }
              </p>
            </div>
          )}
        </div>
      ) : viewMode === "folders" && !activeFolderType ? (
        <div>
          {loadingFiles ? (
            <div style={{ padding: 40, textAlign: "center", color: "#8b8b9e" }}>
              <RefreshCw size={24} style={{ animation: "spin 1s linear infinite" }} />
            </div>
          ) : (
            <div style={{
              display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))",
              gap: 14,
            }}>
              {sortedFolderTypes.map(type => {
                const config = FILE_TYPE_CONFIG[type];
                const Icon = config?.icon || FileText;
                const count = fileTypeGroups[type].length;
                return (
                  <button
                    key={type}
                    onClick={() => handleFolderClick(type)}
                    style={{
                      background: "#111118", border: "1px solid #1e1e2e", borderRadius: 12,
                      padding: 18, cursor: "pointer", textAlign: "left",
                      transition: "all 0.2s",
                    }}
                    onMouseEnter={e => {
                      (e.currentTarget as HTMLElement).style.borderColor = config?.color || "#c8a84b";
                    }}
                    onMouseLeave={e => {
                      (e.currentTarget as HTMLElement).style.borderColor = "#1e1e2e";
                    }}
                  >
                    <div style={{
                      width: 40, height: 40, borderRadius: 10,
                      background: `${config?.color || "#c8a84b"}18`,
                      display: "flex", alignItems: "center", justifyContent: "center",
                      marginBottom: 10,
                    }}>
                      <Icon size={20} style={{ color: config?.color || "#c8a84b" }} />
                    </div>
                    <div style={{ fontSize: 14, fontWeight: 600, color: "#f5f5f7" }}>
                      {config?.label || type}
                    </div>
                    <div style={{ fontSize: 12, color: "#8b8b9e", marginTop: 2 }}>
                      {count} {count === 1 ? "archivo" : "archivos"}
                    </div>
                  </button>
                );
              })}
              {sortedFolderTypes.length === 0 && (
                <div style={{
                  gridColumn: "1 / -1", textAlign: "center", padding: 40, color: "#8b8b9e",
                }}>
                  <FolderOpen size={32} style={{ marginBottom: 8, opacity: 0.4 }} />
                  <p style={{ fontSize: 14 }}>Sin archivos guardados para esta empresa</p>
                </div>
              )}
            </div>
          )}
        </div>
      ) : (
        <div>
          {selectedFiles.size > 0 && (
            <div style={{
              display: "flex", gap: 10, alignItems: "center", marginBottom: 16,
              padding: "10px 16px", background: "rgba(200,168,75,0.08)",
              border: "1px solid rgba(200,168,75,0.2)", borderRadius: 10,
            }}>
              <button onClick={selectAll} style={{
                background: "none", border: "none", color: "#c8a84b", cursor: "pointer",
                display: "flex", alignItems: "center", gap: 4, fontSize: 13,
              }}>
                <CheckSquare size={16} />
                {selectedFiles.size} seleccionados
              </button>
              <button
                onClick={handleDownloadSelected}
                disabled={zipping}
                style={{
                  background: "#c8a84b", color: "#000", border: "none", borderRadius: 8,
                  padding: "6px 14px", cursor: "pointer", fontSize: 13, fontWeight: 600,
                  display: "flex", alignItems: "center", gap: 4, opacity: zipping ? 0.6 : 1,
                }}
              >
                <Download size={14} /> {zipping ? "Creando ZIP..." : "Descargar ZIP"}
              </button>
              <button onClick={() => setSelectedFiles(new Set())} style={{
                background: "none", border: "none", color: "#8b8b9e", cursor: "pointer",
              }}>
                Deseleccionar
              </button>
            </div>
          )}

          {loadingFiles ? (
            <div style={{ padding: 40, textAlign: "center", color: "#8b8b9e" }}>
              <RefreshCw size={24} style={{ animation: "spin 1s linear infinite" }} />
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {displayFiles.map(file => {
                const config = FILE_TYPE_CONFIG[file.fileType];
                const Icon = config?.icon || FileText;
                const isSelected = selectedFiles.has(file.id);
                const isImage = file.mimeType?.startsWith("image/");

                return (
                  <div
                    key={file.id}
                    style={{
                      display: "flex", alignItems: "center", gap: 12,
                      padding: "12px 16px", background: isSelected ? "rgba(200,168,75,0.06)" : "#111118",
                      border: `1px solid ${isSelected ? "rgba(200,168,75,0.3)" : "#1e1e2e"}`,
                      borderRadius: 10, transition: "all 0.15s",
                    }}
                  >
                    <button
                      onClick={() => toggleSelect(file.id)}
                      style={{ background: "none", border: "none", cursor: "pointer", padding: 0 }}
                    >
                      {isSelected
                        ? <CheckSquare size={18} style={{ color: "#c8a84b" }} />
                        : <Square size={18} style={{ color: "#3a3a4a" }} />
                      }
                    </button>

                    <div style={{
                      width: 36, height: 36, borderRadius: 8,
                      background: `${config?.color || "#888"}15`,
                      display: "flex", alignItems: "center", justifyContent: "center",
                      flexShrink: 0,
                    }}>
                      {isImage && file.downloadUrl ? (
                        <img
                          src={`${API_BASE}${file.downloadUrl}`}
                          alt=""
                          style={{ width: 36, height: 36, borderRadius: 8, objectFit: "cover" }}
                          onError={e => { (e.target as HTMLImageElement).style.display = "none"; }}
                        />
                      ) : (
                        <Icon size={18} style={{ color: config?.color || "#888" }} />
                      )}
                    </div>

                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{
                        fontSize: 14, fontWeight: 600, color: "#f5f5f7",
                        overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                      }}>
                        {file.title}
                      </div>
                      <div style={{ fontSize: 12, color: "#8b8b9e", marginTop: 2 }}>
                        {config?.label || file.fileType}
                        {file.fileSizeBytes ? ` · ${formatSize(file.fileSizeBytes)}` : ""}
                        {file.createdAt ? ` · ${new Date(file.createdAt).toLocaleDateString("es-ES")}` : ""}
                      </div>
                    </div>

                    <div style={{ display: "flex", gap: 6 }}>
                      {file.downloadUrl && (
                        <button
                          onClick={() => handleDownload(file)}
                          disabled={downloading === file.id}
                          title="Descargar"
                          style={{
                            background: "rgba(200,168,75,0.1)", border: "1px solid rgba(200,168,75,0.2)",
                            borderRadius: 8, padding: 7, cursor: "pointer", color: "#c8a84b",
                            opacity: downloading === file.id ? 0.5 : 1,
                          }}
                        >
                          <Download size={15} />
                        </button>
                      )}
                      <button
                        onClick={() => handleDelete(file)}
                        disabled={deleting === file.id}
                        title="Eliminar"
                        style={{
                          background: "rgba(232,69,88,0.08)", border: "1px solid rgba(232,69,88,0.15)",
                          borderRadius: 8, padding: 7, cursor: "pointer", color: "#e84558",
                          opacity: deleting === file.id ? 0.5 : 1,
                        }}
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                  </div>
                );
              })}
              {displayFiles.length === 0 && (
                <div style={{
                  textAlign: "center", padding: 40, color: "#8b8b9e",
                  background: "#111118", borderRadius: 12, border: "1px solid #1e1e2e",
                }}>
                  <FolderOpen size={28} style={{ marginBottom: 8, opacity: 0.4 }} />
                  <p style={{ fontSize: 14 }}>No hay archivos en esta carpeta</p>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      <style>{`
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function getExt(mimeType?: string): string {
  if (!mimeType) return ".html";
  const map: Record<string, string> = {
    "text/html": ".html", "image/webp": ".webp", "image/png": ".png",
    "image/jpeg": ".jpg", "application/json": ".json", "text/csv": ".csv",
    "application/pdf": ".pdf",
  };
  return map[mimeType] || ".html";
}
