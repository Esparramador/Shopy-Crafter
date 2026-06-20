import { useState, useEffect, useCallback } from "react";
import { useLocation } from "wouter";
import {
  FolderOpen, Download, Trash2, Image, FileText, RefreshCw,
  ArrowLeft, Package, BarChart2, Search, Building2,
  ExternalLink, Grid, List, Folder, Eye, ChevronRight,
  DollarSign, Palette, Wand2, SplitSquareHorizontal,
  ShieldCheck, FileSpreadsheet, Mail, Globe, Archive,
  CheckSquare, Square, ChevronDown, Film, Music, Mic,
  Video, Box, CreditCard, Zap, Layers, Sparkles, Camera,
  Maximize2, Target, Megaphone, Play, Copy, Check, MonitorPlay,
} from "lucide-react";

const API_BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

const CHARACTERS_3D = [
  { id: "alec_monopoly",    name: "Alec Monopoly",    emoji: "🎩", anims: 134, rigged: true,  textured: true,  size: "8.2MB" },
  { id: "chico_casual",     name: "Chico Casual",      emoji: "👕", anims: 22,  rigged: true,  textured: true,  size: "6.8MB" },
  { id: "chico_formal",     name: "Chico Formal",      emoji: "👔", anims: 22,  rigged: true,  textured: true,  size: "5.2MB" },
  { id: "ted",              name: "Ted (Oso)",          emoji: "🧸", anims: 3,   rigged: true,  textured: true,  size: "7.3MB" },
  { id: "payaso_plim_plim", name: "Payaso Plim Plim",   emoji: "🤡", anims: 21,  rigged: true,  textured: false, size: "1.5MB" },
  { id: "chica_ejecutiva",  name: "Chica Ejecutiva",    emoji: "💼", anims: 21,  rigged: true,  textured: false, size: "1.4MB" },
  { id: "chica_creativa",   name: "Chica Creativa",     emoji: "🎨", anims: 0,   rigged: false, textured: false, size: "1.3MB" },
];

const FOLDER_META: Record<string, { label: string; icon: typeof Image; color: string; group: string; description: string }> = {
  image:                  { label: "Imágenes",                icon: Image,               color: "#5b4eff", group: "📸 Imágenes & Fotos", description: "Imágenes generadas y optimizadas" },
  "fs-pro-image":         { label: "Fotografía IA",           icon: Camera,              color: "#8b5cf6", group: "🎬 Studio Multimedia", description: "Fotos generadas con Studio Pro" },
  "fs-pro-image-edit":    { label: "Edición Imagen IA",       icon: Wand2,               color: "#7c3aed", group: "🎬 Studio Multimedia", description: "Imágenes editadas con IA" },
  "fs-pro-bg-removed":    { label: "Fondo Removido",          icon: Layers,              color: "#a78bfa", group: "🎬 Studio Multimedia", description: "Fondos eliminados con IA" },
  "fs-pro-bg-replaced":   { label: "Fondo Reemplazado",       icon: Palette,             color: "#9333ea", group: "🎬 Studio Multimedia", description: "Fondos cambiados por IA" },
  "fs-pro-upscaled":      { label: "Imagen Mejorada",         icon: Maximize2,           color: "#6d28d9", group: "🎬 Studio Multimedia", description: "Imágenes escaladas a alta resolución" },
  "fs-pro-video":         { label: "Video Generado IA",       icon: Film,                color: "#f44336", group: "🎬 Studio Multimedia", description: "Videos creados con IA" },
  "fs-pro-video-upscaled":{ label: "Video Mejorado",          icon: Video,               color: "#ef4444", group: "🎬 Studio Multimedia", description: "Videos escalados y mejorados" },
  "fs-pro-tts":           { label: "Texto a Voz",             icon: Mic,                 color: "#ff5722", group: "🎵 Audio", description: "Audios generados desde texto" },
  "fs-pro-sfx":           { label: "Efectos de Sonido",       icon: Music,               color: "#ff9800", group: "🎵 Audio", description: "Efectos de sonido con IA" },
  "fs-pro-music":         { label: "Música IA",               icon: Music,               color: "#e91e63", group: "🎵 Audio", description: "Pistas musicales generadas" },
  "fs-pro-avatar":        { label: "Avatar IA",               icon: Building2,           color: "#06b6d4", group: "🎬 Studio Multimedia", description: "Avatares y presentadores IA" },
  "fs-pro-lipsync":       { label: "Lip Sync Video",          icon: Mic,                 color: "#0ea5e9", group: "🎬 Studio Multimedia", description: "Videos con labios sincronizados" },
  "fs-pro-multishot":     { label: "Multi-Shot Cinematico",   icon: Film,                color: "#f97316", group: "🎬 Studio Multimedia", description: "Videos multi-escena cinematográficos" },
  "fs-pro-composed":      { label: "Video Compuesto",         icon: Layers,              color: "#f59e0b", group: "🎬 Studio Multimedia", description: "Videos con imagen+audio compuestos" },
  "fs-pro-concat":        { label: "Video Concatenado",       icon: Film,                color: "#d97706", group: "🎬 Studio Multimedia", description: "Videos unidos en secuencia" },
  "fs-pro-subbed":        { label: "Video con Subtítulos",    icon: Film,                color: "#b45309", group: "🎬 Studio Multimedia", description: "Videos con subtítulos incrustados" },
  "fs-pro-motion":        { label: "Animación en Movimiento", icon: Zap,                 color: "#ec4899", group: "🎬 Studio Multimedia", description: "Imágenes animadas" },
  "fs-pro-mimic":         { label: "Mimic / Talking Head",    icon: Building2,           color: "#db2777", group: "🎬 Studio Multimedia", description: "Videos de personas hablando" },
  "fs-pro-script":        { label: "Script de Video",         icon: FileText,            color: "#9d174d", group: "📄 Documentos", description: "Guiones generados por IA" },
  "fs-pro-srt":           { label: "Archivo SRT",             icon: FileText,            color: "#be185d", group: "📄 Documentos", description: "Subtítulos en formato SRT" },
  "ad-studio-video":      { label: "Video Publicitario",      icon: Target,              color: "#f43f5e", group: "📢 Publicidad", description: "Anuncios en video" },
  "ad-studio-hero":       { label: "Hero Ad (Imagen)",        icon: Camera,              color: "#e11d48", group: "📢 Publicidad", description: "Imágenes hero para anuncios" },
  "ad-studio-voice":      { label: "Voz Publicitaria",        icon: Mic,                 color: "#be123c", group: "📢 Publicidad", description: "Locución para anuncios" },
  "ad-final":             { label: "Anuncio Final",           icon: Megaphone,           color: "#9f1239", group: "📢 Publicidad", description: "Creativos publicitarios finales" },
  "viral-source":         { label: "Fuente Viral",            icon: Zap,                 color: "#fb7185", group: "📢 Publicidad", description: "Clips fuente para anuncios virales" },
  "3d_model":             { label: "Modelo 3D (Tripo)",       icon: Box,                 color: "#00bcd4", group: "🧊 3D Studio", description: "Modelos 3D generados por Tripo" },
  seo_report:             { label: "Informe SEO",             icon: Search,              color: "#2ecc71", group: "🔍 SEO & Auditoría", description: "Análisis SEO completo" },
  seo_audit:              { label: "Auditoría SEO",           icon: Search,              color: "#22c55e", group: "🔍 SEO & Auditoría", description: "Auditoría técnica SEO" },
  redesign:               { label: "Rediseño IA",             icon: Wand2,               color: "#c8a84b", group: "🎨 Diseño IA", description: "Rediseños generados por IA" },
  ab_test:                { label: "Test A/B",                icon: SplitSquareHorizontal, color: "#ff6b35", group: "📈 Experimentos", description: "Tests de variantes A/B" },
  ab_testing:             { label: "Test A/B",                icon: SplitSquareHorizontal, color: "#ff6b35", group: "📈 Experimentos", description: "Tests de variantes A/B" },
  email:                  { label: "Email Marketing",         icon: Mail,                color: "#e040fb", group: "📧 Email", description: "Emails y flujos de marketing" },
  pricing_report:         { label: "Informe de Pricing",      icon: DollarSign,          color: "#00bcd4", group: "💰 Finanzas", description: "Análisis de precios y márgenes" },
  financial:              { label: "Informe Financiero",      icon: DollarSign,          color: "#06b6d4", group: "💰 Finanzas", description: "Datos financieros de la tienda" },
  audit:                  { label: "Auditoría General",       icon: ShieldCheck,         color: "#ff9800", group: "🔍 SEO & Auditoría", description: "Auditoría completa de la tienda" },
  consistency:            { label: "Consistencia Visual",     icon: Palette,             color: "#9c27b0", group: "🎨 Diseño IA", description: "Análisis de coherencia visual" },
  bulk_export:            { label: "Exportación Masiva",      icon: FileSpreadsheet,     color: "#607d8b", group: "📄 Documentos", description: "Exportaciones bulk de datos" },
  product_card:           { label: "Cards de Producto",       icon: Package,             color: "#c8a84b", group: "📦 Productos", description: "Cards visuales para productos" },
  research:               { label: "Investigación de Mercado",icon: Globe,               color: "#3498db", group: "🔬 Análisis", description: "Research y análisis de mercado" },
  competitor:             { label: "Análisis Competencia",    icon: BarChart2,           color: "#e74c3c", group: "🔬 Análisis", description: "Datos de competidores" },
  report:                 { label: "Informe IA",              icon: FileText,            color: "#c4956a", group: "📄 Documentos", description: "Informes generados por IA" },
  lead_prereport:         { label: "Pre-Informe Lead",        icon: FileText,            color: "#c4956a", group: "📄 Documentos", description: "Pre-informes de clientes potenciales" },
  generator:              { label: "Generador IA",            icon: Sparkles,            color: "#8e44ad", group: "✨ Generadores IA", description: "Contenido del Generador IA" },
  web_lab:                { label: "Lab Web IA",              icon: Globe,               color: "#16a085", group: "🌐 Web & Diseño", description: "Experimentos del Lab Web" },
  web_designer:           { label: "Diseño Web IA",           icon: Globe,               color: "#009688", group: "🌐 Web & Diseño", description: "Diseños web generados por IA" },
  effects_studio:         { label: "Studio de Efectos",       icon: Sparkles,            color: "#3f51b5", group: "🎨 Diseño IA", description: "Efectos visuales para la web" },
};

const FOLDER_GROUP_ORDER = [
  "📸 Imágenes & Fotos",
  "🎬 Studio Multimedia",
  "🎵 Audio",
  "📢 Publicidad",
  "🧊 3D Studio",
  "🔍 SEO & Auditoría",
  "🎨 Diseño IA",
  "📈 Experimentos",
  "📧 Email",
  "💰 Finanzas",
  "📦 Productos",
  "🔬 Análisis",
  "📄 Documentos",
  "✨ Generadores IA",
  "🌐 Web & Diseño",
];

function getFolderMeta(type: string) {
  if (FOLDER_META[type]) return FOLDER_META[type];
  const clean = type.replace(/-/g, "_").replace(/\s+/g, "_").toLowerCase();
  if (FOLDER_META[clean]) return FOLDER_META[clean];
  return { label: type.replace(/[-_]/g, " ").replace(/\b\w/g, c => c.toUpperCase()), icon: Folder, color: "#888", group: "📁 Otros", description: "" };
}

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
  previewUrl?: string;
}

function getExt(mime?: string) {
  if (!mime) return "";
  const m: Record<string, string> = {
    "image/png": ".png", "image/jpeg": ".jpg", "image/webp": ".webp",
    "image/gif": ".gif", "video/mp4": ".mp4", "audio/mpeg": ".mp3",
    "audio/wav": ".wav", "text/html": ".html",
  };
  return m[mime] || "";
}

function fmtSize(b?: number) {
  if (!b) return "";
  if (b > 1024 * 1024) return `${(b / 1024 / 1024).toFixed(1)} MB`;
  if (b > 1024) return `${(b / 1024).toFixed(0)} KB`;
  return `${b} B`;
}

type MainTab = "archivos" | "personajes3d" | "demos";

export default function GlobalVault() {
  const [, navigate] = useLocation();
  const [tab, setTab] = useState<MainTab>("archivos");
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
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set(FOLDER_GROUP_ORDER));
  const [char3dSearch, setChar3dSearch] = useState("");
  const [texturizingId, setTexturizingId] = useState<string | null>(null);
  const [texturizingProgress, setTexturizingProgress] = useState(0);
  const [texturizingMsg, setTexturizingMsg] = useState("");
  const [texturedNow, setTexturedNow] = useState<Set<string>>(new Set());
  const [texturizeError, setTexturizeError] = useState<string | null>(null);
  const [recordingDemo, setRecordingDemo] = useState<string | null>(null);
  const [copiedCaption, setCopiedCaption] = useState<string | null>(null);
  const [loadedPreviews, setLoadedPreviews] = useState<Set<string>>(new Set());

  const handleRecord = useCallback(async (demoId: string, demoName: string) => {
    try {
      const stream = await (navigator.mediaDevices as any).getDisplayMedia({ video: { width: 1280, height: 800 }, audio: false });
      const mimeType = MediaRecorder.isTypeSupported("video/webm;codecs=vp9") ? "video/webm;codecs=vp9" : "video/webm";
      const recorder = new MediaRecorder(stream, { mimeType });
      const chunks: Blob[] = [];
      recorder.ondataavailable = (e: BlobEvent) => { if (e.data.size > 0) chunks.push(e.data); };
      recorder.onstop = () => {
        const blob = new Blob(chunks, { type: "video/webm" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url; a.download = `shopy-crafter-demo-${demoId}.webm`; a.click();
        URL.revokeObjectURL(url);
        stream.getTracks().forEach((t: MediaStreamTrack) => t.stop());
        setRecordingDemo(null);
      };
      recorder.start();
      setRecordingDemo(demoId);
      setTimeout(() => { if (recorder.state === "recording") recorder.stop(); }, 10000);
    } catch { setRecordingDemo(null); }
  }, []);

  const handleCopyCaption = useCallback((id: string, text: string) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopiedCaption(id);
      setTimeout(() => setCopiedCaption(null), 2500);
    });
  }, []);

  const handleTexturize = useCallback(async (charId: string) => {
    setTexturizingId(charId);
    setTexturizingProgress(0);
    setTexturizingMsg("Conectando con Meshy…");
    setTexturizeError(null);
    try {
      const res = await fetch(`${API_BASE}/api/meshy/texturize`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ char_id: charId }),
      });
      if (!res.ok || !res.body) {
        setTexturizeError(`Error HTTP ${res.status}`);
        setTexturizingId(null);
        return;
      }
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buf = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        const lines = buf.split("\n");
        buf = lines.pop() ?? "";
        for (const line of lines) {
          if (!line.startsWith("data:")) continue;
          try {
            const evt = JSON.parse(line.slice(5).trim());
            if (evt.event === "phase")     setTexturizingMsg(evt.message ?? evt.phase);
            if (evt.event === "started")   setTexturizingMsg("Tarea iniciada — generando texturas PBR…");
            if (evt.event === "progress")  { setTexturizingProgress(evt.progress ?? 0); setTexturizingMsg(`Texturizando… ${evt.progress ?? 0}%`); }
            if (evt.event === "done")      { setTexturedNow(prev => new Set([...prev, charId])); setTexturizingId(null); setTexturizingMsg(""); setTexturizingProgress(0); }
            if (evt.event === "error")     { setTexturizeError(evt.error ?? "Error desconocido"); setTexturizingId(null); }
            if (evt.event === "timeout")   { setTexturizeError("Tiempo de espera agotado"); setTexturizingId(null); }
          } catch { /* ignore malformed SSE line */ }
        }
      }
    } catch (err: any) {
      setTexturizeError(err.message ?? "Error de red");
      setTexturizingId(null);
    }
  }, []);

  const loadEntities = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/vault/global/entities`, { credentials: "include" });
      if (res.ok) {
        const data = await res.json();
        setEntities(data.entities);
      }
    } catch { }
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
    } catch { }
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
    } catch { }
    setDownloading(null);
  };

  const handleDelete = async (file: VaultFile) => {
    if (!confirm(`¿Eliminar "${file.title}"?`)) return;
    setDeleting(file.id);
    try {
      const res = await fetch(`${API_BASE}/api/vault/global/${file.id}`, {
        method: "DELETE", credentials: "include",
      });
      if (res.ok) setFiles(f => f.filter(x => x.id !== file.id));
    } catch { }
    setDeleting(null);
  };

  const handleDownloadSelected = async () => {
    if (selectedFiles.size === 0) return;
    setZipping(true);
    try {
      const res = await fetch(`${API_BASE}/api/vault/global/download-selected`, {
        method: "POST", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fileIds: Array.from(selectedFiles), entityName: selectedEntity?.name }),
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
    } catch { }
    setZipping(false);
  };

  const toggleSelect = (id: number) => {
    setSelectedFiles(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const displayFiles = files.filter(f => {
    if (filterType && f.fileType !== filterType) return false;
    if (searchQuery && !f.title.toLowerCase().includes(searchQuery.toLowerCase())) return false;
    return true;
  });

  const selectAll = () => {
    if (selectedFiles.size === displayFiles.length) setSelectedFiles(new Set());
    else setSelectedFiles(new Set(displayFiles.map(f => f.id)));
  };

  const fileTypeGroups = files.reduce<Record<string, VaultFile[]>>((acc, f) => {
    const key = f.fileType;
    if (!acc[key]) acc[key] = [];
    acc[key].push(f);
    return acc;
  }, {});

  const groupedFolders = Object.keys(fileTypeGroups).reduce<Record<string, string[]>>((acc, type) => {
    const meta = getFolderMeta(type);
    if (!acc[meta.group]) acc[meta.group] = [];
    acc[meta.group].push(type);
    return acc;
  }, {});

  const filteredEntities = entities.filter(e =>
    !searchQuery || e.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (e.url && e.url.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  const filteredChars = CHARACTERS_3D.filter(c =>
    !char3dSearch || c.name.toLowerCase().includes(char3dSearch.toLowerCase())
  );

  const totalFiles = entities.reduce((s, e) => s + e.fileCount, 0);

  const breadcrumb = selectedEntity
    ? [
        { label: "Bóveda Global", onClick: () => { setSelectedEntity(null); setFiles([]); } },
        { label: selectedEntity.name, onClick: activeFolderType ? handleBack : undefined },
        ...(activeFolderType ? [{ label: getFolderMeta(activeFolderType).label }] : []),
      ]
    : [{ label: "Bóveda Global" }];

  return (
    <div style={{ padding: "24px 28px", maxWidth: 1200, margin: "0 auto" }}>
      <style>{`
        @keyframes vaultPulse {
          0%, 100% { opacity: 0.6; } 50% { opacity: 1; }
        }
        .vault-entity-card:hover { border-color: rgba(200,168,75,0.5) !important; transform: translateY(-3px); box-shadow: 0 8px 32px rgba(0,0,0,0.4); }
        .vault-folder-card:hover { transform: translateY(-2px); box-shadow: 0 6px 20px rgba(0,0,0,0.3); }
        .vault-file-row:hover { background: rgba(255,255,255,0.03) !important; }
        .vault-char-card:hover { border-color: rgba(200,168,75,0.4) !important; transform: translateY(-2px); }
        .vault-tab-btn:hover { background: rgba(255,255,255,0.06) !important; }
      `}</style>

      {/* ── Header ── */}
      <div style={{ marginBottom: 24 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8, fontSize: 13, color: "#8b8b9e" }}>
          {breadcrumb.map((b, i) => (
            <span key={i} style={{ display: "flex", alignItems: "center", gap: 6 }}>
              {i > 0 && <ChevronRight size={14} />}
              {b.onClick
                ? <button onClick={b.onClick} style={{ background: "none", border: "none", color: "#c8a84b", cursor: "pointer", fontSize: 13, padding: 0 }}>{b.label}</button>
                : <span style={{ color: i === breadcrumb.length - 1 ? "#f5f5f7" : "#8b8b9e" }}>{b.label}</span>
              }
            </span>
          ))}
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap" }}>
          <div style={{ flex: 1 }}>
            <h1 style={{ fontSize: 22, fontWeight: 800, color: "#f5f5f7", margin: 0, display: "flex", alignItems: "center", gap: 10 }}>
              <div style={{
                width: 40, height: 40, borderRadius: 12,
                background: "linear-gradient(135deg, rgba(200,168,75,0.25), rgba(200,168,75,0.08))",
                border: "1px solid rgba(200,168,75,0.25)",
                display: "flex", alignItems: "center", justifyContent: "center",
              }}>
                <Archive size={20} style={{ color: "#c8a84b" }} />
              </div>
              Bóveda Global
            </h1>
            <p style={{ fontSize: 13, color: "#8b8b9e", margin: "4px 0 0" }}>
              {entities.length} empresas · {totalFiles.toLocaleString()} archivos · 14 personajes 3D
            </p>
          </div>

          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <div style={{ position: "relative" }}>
              <Search size={14} style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: "#8b8b9e" }} />
              <input
                value={tab === "personajes3d" ? char3dSearch : searchQuery}
                onChange={e => tab === "personajes3d" ? setChar3dSearch(e.target.value) : setSearchQuery(e.target.value)}
                placeholder={selectedEntity ? "Buscar archivos..." : "Buscar..."}
                style={{
                  background: "#111118", border: "1px solid #1e1e2e", borderRadius: 8,
                  padding: "8px 12px 8px 32px", color: "#f5f5f7", fontSize: 13,
                  width: "min(180px, 100%)", outline: "none",
                }}
              />
            </div>
            {selectedEntity && (
              <>
                <button onClick={() => setViewMode(v => v === "folders" ? "list" : "folders")}
                  style={{ background: "#111118", border: "1px solid #1e1e2e", borderRadius: 8, padding: "8px 12px", color: "#8b8b9e", cursor: "pointer", display: "flex", alignItems: "center", gap: 4 }}>
                  {viewMode === "folders" ? <List size={15} /> : <Grid size={15} />}
                </button>
                <button onClick={loadEntities}
                  style={{ background: "#111118", border: "1px solid #1e1e2e", borderRadius: 8, padding: "8px 12px", color: "#8b8b9e", cursor: "pointer" }}>
                  <RefreshCw size={15} />
                </button>
              </>
            )}
          </div>
        </div>
      </div>

      {/* ── Top Tabs (only on root level) ── */}
      {!selectedEntity && (
        <div style={{ display: "flex", gap: 4, marginBottom: 20, background: "#0d0d14", borderRadius: 10, padding: 4, border: "1px solid #1e1e2e", width: "fit-content" }}>
          {([
            { id: "archivos", label: "📁 Archivos", count: totalFiles },
            { id: "personajes3d", label: "🧊 Personajes 3D", count: 14 },
            { id: "demos", label: "🎬 Demo Kit IG", count: 4 },
          ] as const).map(t => (
            <button
              key={t.id}
              className="vault-tab-btn"
              onClick={() => setTab(t.id)}
              style={{
                padding: "8px 18px", borderRadius: 7, fontSize: 13, fontWeight: 600,
                cursor: "pointer", border: "none", transition: "all 0.15s",
                background: tab === t.id ? "rgba(200,168,75,0.15)" : "transparent",
                color: tab === t.id ? "#c8a84b" : "#8b8b9e",
                outline: tab === t.id ? "1px solid rgba(200,168,75,0.2)" : "none",
              }}
            >
              {t.label}
              <span style={{
                marginLeft: 6, fontSize: 11, fontWeight: 700,
                padding: "1px 6px", borderRadius: 10,
                background: tab === t.id ? "rgba(200,168,75,0.2)" : "rgba(255,255,255,0.06)",
                color: tab === t.id ? "#c8a84b" : "#6b6b7e",
              }}>{t.count}</span>
            </button>
          ))}
        </div>
      )}

      {/* ════════════════════════════════
          TAB: PERSONAJES 3D
      ════════════════════════════════ */}
      {!selectedEntity && tab === "personajes3d" && (
        <div>
          {/* Texturize error banner */}
          {texturizeError && (
            <div style={{
              display: "flex", alignItems: "center", gap: 10, marginBottom: 14,
              padding: "10px 14px", borderRadius: 10,
              background: "rgba(244,67,54,0.08)", border: "1px solid rgba(244,67,54,0.25)",
            }}>
              <span style={{ fontSize: 18 }}>⚠️</span>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: "#ef5350" }}>Error al texturizar</div>
                <div style={{ fontSize: 11, color: "#8b8b9e", marginTop: 1 }}>{texturizeError}</div>
              </div>
              <button
                onClick={() => setTexturizeError(null)}
                style={{ background: "none", border: "none", color: "#8b8b9e", cursor: "pointer", padding: 4, fontSize: 16, lineHeight: 1 }}
              >×</button>
            </div>
          )}

          <div style={{
            display: "flex", alignItems: "center", gap: 10, marginBottom: 20,
            padding: "14px 18px", borderRadius: 12,
            background: "linear-gradient(135deg, rgba(0,188,212,0.08), rgba(76,175,80,0.06))",
            border: "1px solid rgba(0,188,212,0.15)",
          }}>
            <Box size={18} style={{ color: "#00bcd4", flexShrink: 0 }} />
            <div>
              <div style={{ fontSize: 13, fontWeight: 700, color: "#f5f5f7" }}>14 Personajes 3D listos para usar</div>
              <div style={{ fontSize: 12, color: "#8b8b9e" }}>Modelos GLB reales en disco · 1.7GB total · 9 sin textura</div>
            </div>
            <div style={{ marginLeft: "auto", display: "flex", gap: 8 }}>
              <button onClick={() => navigate("/admin/meshy-studio")}
                style={{
                  background: "rgba(0,188,212,0.12)", border: "1px solid rgba(0,188,212,0.25)",
                  borderRadius: 8, padding: "7px 14px", fontSize: 12, fontWeight: 600,
                  color: "#00bcd4", cursor: "pointer", display: "flex", alignItems: "center", gap: 5,
                }}>
                <Sparkles size={13} /> Meshy Studio
              </button>
              <button onClick={() => navigate("/projects/1/tripo3d")}
                style={{
                  background: "rgba(76,175,80,0.12)", border: "1px solid rgba(76,175,80,0.25)",
                  borderRadius: 8, padding: "7px 14px", fontSize: 12, fontWeight: 600,
                  color: "#4caf50", cursor: "pointer", display: "flex", alignItems: "center", gap: 5,
                }}>
                <Box size={13} /> Tripo 3D Studio
              </button>
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: 14 }}>
            {filteredChars.map(char => (
              <div
                key={char.id}
                className="vault-char-card"
                style={{
                  background: "#111118", border: "1px solid #1e1e2e", borderRadius: 14,
                  padding: 16, transition: "all 0.2s", cursor: "default",
                }}
              >
                <div style={{ textAlign: "center", marginBottom: 12 }}>
                  <div style={{
                    width: 64, height: 64, borderRadius: 16, margin: "0 auto 8px",
                    background: char.rigged
                      ? "linear-gradient(135deg, rgba(0,188,212,0.15), rgba(76,175,80,0.1))"
                      : "rgba(255,255,255,0.04)",
                    border: `1px solid ${char.rigged ? "rgba(0,188,212,0.2)" : "rgba(255,255,255,0.08)"}`,
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontSize: 30,
                  }}>
                    {char.emoji}
                  </div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: "#f5f5f7" }}>{char.name}</div>
                  <div style={{ fontSize: 11, color: "#8b8b9e", marginTop: 2 }}>{char.size}</div>
                </div>

                {/* ── Badges ── */}
                <div style={{ display: "flex", gap: 5, flexWrap: "wrap", marginBottom: 10 }}>
                  <span style={{
                    fontSize: 10, fontWeight: 700, padding: "2px 7px", borderRadius: 6,
                    background: char.rigged ? "rgba(0,188,212,0.12)" : "rgba(255,165,0,0.12)",
                    color: char.rigged ? "#00bcd4" : "#ff9800",
                    border: `1px solid ${char.rigged ? "rgba(0,188,212,0.2)" : "rgba(255,165,0,0.2)"}`,
                  }}>
                    {char.rigged ? "✦ Rigged" : "⏳ Pending"}
                  </span>
                  {/* Texture status badge */}
                  {(() => {
                    const isDone = texturedNow.has(char.id) || char.textured;
                    const isActive = texturizingId === char.id;
                    if (isActive) return (
                      <span style={{
                        fontSize: 10, fontWeight: 700, padding: "2px 7px", borderRadius: 6,
                        background: "rgba(200,168,75,0.15)", color: "#c8a84b",
                        border: "1px solid rgba(200,168,75,0.3)",
                        display: "flex", alignItems: "center", gap: 3,
                      }}>
                        <RefreshCw size={9} style={{ animation: "spin 1s linear infinite" }} /> Texturizando…
                      </span>
                    );
                    if (isDone) return (
                      <span style={{
                        fontSize: 10, fontWeight: 700, padding: "2px 7px", borderRadius: 6,
                        background: "rgba(76,175,80,0.12)", color: "#4caf50",
                        border: "1px solid rgba(76,175,80,0.2)",
                      }}>
                        🎨 Texturizado
                      </span>
                    );
                    return (
                      <span style={{
                        fontSize: 10, fontWeight: 700, padding: "2px 7px", borderRadius: 6,
                        background: "rgba(255,255,255,0.04)", color: "#8b8b9e",
                        border: "1px solid rgba(255,255,255,0.08)",
                      }}>
                        ⬜ Sin textura
                      </span>
                    );
                  })()}
                  {char.anims > 0 && (
                    <span style={{
                      fontSize: 10, fontWeight: 700, padding: "2px 7px", borderRadius: 6,
                      background: "rgba(200,168,75,0.1)", color: "#c8a84b",
                      border: "1px solid rgba(200,168,75,0.15)",
                    }}>
                      {char.anims} anims
                    </span>
                  )}
                </div>

                {/* ── Progress bar (active texturize) ── */}
                {texturizingId === char.id && (
                  <div style={{ marginBottom: 10 }}>
                    <div style={{
                      height: 4, borderRadius: 3,
                      background: "rgba(255,255,255,0.06)",
                      overflow: "hidden",
                    }}>
                      <div style={{
                        height: "100%",
                        width: `${texturizingProgress}%`,
                        background: "linear-gradient(90deg, #c8a84b, #e8c86b)",
                        borderRadius: 3,
                        transition: "width 0.4s ease",
                      }} />
                    </div>
                    <div style={{ fontSize: 10, color: "#8b8b9e", marginTop: 3, textAlign: "center" }}>
                      {texturizingMsg}
                    </div>
                  </div>
                )}

                {/* ── Buttons ── */}
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                  <a
                    href={`${API_BASE}/assets/3d/models/${char.id}.glb`}
                    download={`${char.id}.glb`}
                    style={{
                      flex: 1, minWidth: 50,
                      background: "rgba(200,168,75,0.08)", border: "1px solid rgba(200,168,75,0.15)",
                      borderRadius: 8, padding: "6px 0", fontSize: 11, fontWeight: 600,
                      color: "#c8a84b", textDecoration: "none", textAlign: "center",
                      display: "flex", alignItems: "center", justifyContent: "center", gap: 4,
                    }}
                  >
                    <Download size={11} /> GLB
                  </a>
                  {char.rigged && (
                    <button
                      onClick={() => navigate("/admin/meshy-studio")}
                      style={{
                        flex: 1, minWidth: 50,
                        background: "rgba(0,188,212,0.08)", border: "1px solid rgba(0,188,212,0.15)",
                        borderRadius: 8, padding: "6px 0", fontSize: 11, fontWeight: 600,
                        color: "#00bcd4", cursor: "pointer",
                        display: "flex", alignItems: "center", justifyContent: "center", gap: 4,
                      }}
                    >
                      <Play size={11} /> Ver
                    </button>
                  )}
                  {/* Texturizar button — only for untextured chars not currently processing */}
                  {!char.textured && !texturedNow.has(char.id) && texturizingId !== char.id && (
                    <button
                      onClick={() => handleTexturize(char.id)}
                      disabled={texturizingId !== null}
                      style={{
                        flex: "0 0 100%",
                        background: texturizingId !== null
                          ? "rgba(255,255,255,0.03)"
                          : "linear-gradient(135deg, rgba(200,168,75,0.15), rgba(255,200,80,0.1))",
                        border: `1px solid ${texturizingId !== null ? "rgba(255,255,255,0.07)" : "rgba(200,168,75,0.3)"}`,
                        borderRadius: 8, padding: "7px 0", fontSize: 11, fontWeight: 700,
                        color: texturizingId !== null ? "#555" : "#c8a84b",
                        cursor: texturizingId !== null ? "not-allowed" : "pointer",
                        display: "flex", alignItems: "center", justifyContent: "center", gap: 5,
                        transition: "all 0.2s",
                      }}
                    >
                      <Wand2 size={11} />
                      {texturizingId !== null ? "Texturizando otro…" : "Texturizar con Meshy"}
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ════════════════════════════════
          TAB: DEMO KIT IG
      ════════════════════════════════ */}
      {!selectedEntity && tab === "demos" && (() => {
        const MOCKUP_BASE = window.location.origin + "/__mockup";
        const DEMOS = [
          {
            id: "original",
            name: "① Original — Slide Producción",
            emoji: "📋",
            path: "/preview/bag-form/OriginalSlide",
            color: "#3b82f6",
            ig: `🔥 Esto es lo que hace la diferencia entre una tienda que vende y una que no.

Llevamos años perfeccionando la experiencia de compra en Shopify — y cada detalle cuenta. Este formulario fue diseñado para guiar al usuario hacia la conversión sin que siquiera lo note.

🎯 En Shopy Crafter optimizamos tu tienda completa:
✅ Diseño UX premium
✅ SEO técnico avanzado  
✅ Copy que convierte
✅ Automatizaciones con IA
✅ A/B testing continuo

Si tienes una tienda Shopify y quieres resultados reales, nosotros somos tu equipo.

📲 Escríbenos por DM o haz clic en el link de bio 👇

#ShopyCrafter #ShopifyEspañol #TiendaOnline #EcommerceTips #DiseñoWeb #OptimizaciónShopify #ConversionRateOptimization #UIAnimation #WebDesign #Shopify2025 #VenderOnline #NegocioDigital #MarketingEcommerce #DiseñoUX #WebAnimation #TiendaShopify #ShopifyExpert #Ecommerce #CROMarketing #DigitalMarketing`,
          },
          {
            id: "burst",
            name: "② Burst — Sale de la Bolsa",
            emoji: "💥",
            path: "/preview/bag-form/BagFormEffect",
            color: "#f59e0b",
            ig: `✨ La animación que tus clientes no podrán ignorar.

Diseñamos este efecto para tiendas de moda y lifestyle — el formulario emerge directamente del producto, creando una conexión visual que aumenta el engagement hasta un 60%.

En Shopy Crafter sabemos que cada milisegundo y cada píxel cuentan cuando se trata de convertir visitas en ventas.

🚀 ¿Listo para transformar tu tienda Shopify?
👉 DM abierto · Consulta gratuita los lunes 👇

#ShopyCrafter #EcommerceDesign #ShopifyAnimation #TiendaModa #UIEffects #ShopifyEspañol #WebAnimation #DiseñoUX #EcommerceTips #Shopify2025 #TiendaOnline #NegocioOnline #MarketingDigital #ConversionOptimization #AnimacionWeb #DisenyoWeb #TiendaShopify #EcommerceLatinoamerica #ShopifyExperto #DigitalBusiness`,
          },
          {
            id: "flip3d",
            name: "③ Flip 3D desde Bolsa",
            emoji: "🃏",
            path: "/preview/bag-form/FlipCard3D",
            color: "#8b5cf6",
            ig: `🃏 El flip card que hace que tu formulario sea imposible de ignorar.

Mientras otros tienen formularios aburridos, nosotros diseñamos experiencias. Este efecto 3D aumentó el CTR del formulario de una de nuestras tiendas en un 34% en las primeras 2 semanas.

En Shopy Crafter cada elemento de tu web trabaja para ti 24/7.

💡 Lo que ofrecemos:
→ Optimización completa Shopify
→ Generación de contenido con IA
→ Diseño web premium
→ SEO + CRO + Analytics
→ Gestión de campañas

📩 Pide tu auditoría gratuita hoy · Link en bio 👇

#ShopyCrafter #FlipCard #WebEffect #Shopify #DiseñoWeb #3DAnimation #EcommerceTips #ShopifyEspañol #TiendaOnline #OptimizaciónWeb #ConversionRate #UIDesign #ShopifyExpert #MarketingDigital #WebDesign #NegocioDigital #EcommerceSpain #TiendaShopify #DigitalMarketing #CROExpert`,
          },
          {
            id: "golden",
            name: "④ Ola Dorada",
            emoji: "🌊",
            path: "/preview/bag-form/GoldenWave",
            color: "#c8a84b",
            ig: `🌊 Ola dorada. Formularios que hipnotizan.

Este es el tipo de animación que hace que un cliente piense: "wow, esta marca se toma en serio". En Shopy Crafter nos obsesionamos con cada detalle visual porque sabemos que la primera impresión lo es todo en el ecommerce.

✨ Nuestra filosofía: diseño bello + conversión real.
No tienes que elegir entre los dos.

Hemos trabajado con más de 50 tiendas Shopify en España y Latinoamérica — el resultado siempre es el mismo: más ventas, menos rebote, mejor marca.

🔥 ¿Quieres formar parte de nuestros casos de éxito?
👉 Link en bio para empezar

#ShopyCrafter #GoldenWave #WebAnimation #ShopifyEspañol #TiendaOnline #DiseñoWeb #EcommerceTips #UIAnimation #Shopify2025 #ConversionOptimization #WebDesign #NegocioOnline #MarketingEcommerce #ShopifyExpert #DiseñoUX #EcommerceLatin #TiendaShopify #DigitalMarketing #PremiumDesign #ShopifyStore`,
          },
        ];

        return (
          <div>
            {/* Banner info */}
            <div style={{
              display: "flex", alignItems: "center", gap: 12, marginBottom: 24,
              padding: "14px 18px", borderRadius: 12,
              background: "linear-gradient(135deg, rgba(200,168,75,0.1), rgba(200,168,75,0.04))",
              border: "1px solid rgba(200,168,75,0.2)",
            }}>
              <MonitorPlay size={20} style={{ color: "#c8a84b", flexShrink: 0 }} />
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: "#f5f5f7" }}>4 demos de efectos web · Kit Instagram profesional</div>
                <div style={{ fontSize: 12, color: "#8b8b9e", marginTop: 2 }}>
                  Haz clic en 🔴 Grabar, comparte la pestaña del demo y obtén un .webm listo para Instagram (10 seg).
                </div>
              </div>
            </div>

            {/* Demo cards grid */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(560px, 1fr))", gap: 24, marginBottom: 36 }}>
              {DEMOS.map(demo => (
                <div key={demo.id} style={{
                  background: "#111118", borderRadius: 16, border: "1px solid #1e1e2e",
                  overflow: "hidden",
                }}>
                  {/* Demo header */}
                  <div style={{ padding: "14px 18px", display: "flex", alignItems: "center", gap: 10, borderBottom: "1px solid #1e1e2e" }}>
                    <span style={{ fontSize: 20 }}>{demo.emoji}</span>
                    <span style={{ fontSize: 14, fontWeight: 700, color: "#f5f5f7", flex: 1 }}>{demo.name}</span>
                    <div style={{ display: "flex", gap: 6 }}>
                      <a
                        href={MOCKUP_BASE + demo.path}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{
                          display: "flex", alignItems: "center", gap: 5, padding: "6px 12px",
                          borderRadius: 8, fontSize: 12, fontWeight: 600, textDecoration: "none",
                          background: "rgba(255,255,255,0.04)", border: "1px solid #1e1e2e",
                          color: "#8b8b9e",
                        }}
                      >
                        <ExternalLink size={12} /> Abrir
                      </a>
                      <button
                        onClick={() => {
                          setLoadedPreviews(p => new Set([...p, demo.id]));
                          handleRecord(demo.id, demo.name);
                        }}
                        disabled={recordingDemo !== null}
                        style={{
                          display: "flex", alignItems: "center", gap: 5, padding: "6px 12px",
                          borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: recordingDemo !== null ? "not-allowed" : "pointer",
                          border: "none",
                          background: recordingDemo === demo.id
                            ? "rgba(239,68,68,0.2)"
                            : "rgba(239,68,68,0.1)",
                          color: recordingDemo === demo.id ? "#ef4444" : "#fca5a5",
                          outline: recordingDemo === demo.id ? "1px solid rgba(239,68,68,0.4)" : "none",
                          opacity: recordingDemo !== null && recordingDemo !== demo.id ? 0.4 : 1,
                        }}
                      >
                        {recordingDemo === demo.id
                          ? <><span style={{ display: "inline-block", width: 8, height: 8, borderRadius: "50%", background: "#ef4444", animation: "vaultPulse 1s infinite" }} /> Grabando 10s...</>
                          : <><span style={{ display: "inline-block", width: 8, height: 8, borderRadius: "50%", background: "#ef4444" }} /> Grabar Demo</>
                        }
                      </button>
                    </div>
                  </div>

                  {/* Iframe preview — solo carga al hacer clic */}
                  <div style={{ position: "relative", width: "100%", paddingBottom: "56.25%", background: "#0a0a10" }}>
                    {loadedPreviews.has(demo.id) ? (
                      <iframe
                        src={MOCKUP_BASE + demo.path}
                        style={{ position: "absolute", top: 0, left: 0, width: "100%", height: "100%", border: "none" }}
                        title={demo.name}
                        allow="autoplay"
                      />
                    ) : (
                      <div
                        onClick={() => setLoadedPreviews(p => new Set([...p, demo.id]))}
                        style={{
                          position: "absolute", top: 0, left: 0, width: "100%", height: "100%",
                          display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
                          cursor: "pointer", gap: 12,
                          background: "linear-gradient(135deg,#0d0d14,#111120)",
                        }}
                      >
                        <div style={{
                          width: 56, height: 56, borderRadius: "50%", display: "flex", alignItems: "center",
                          justifyContent: "center", fontSize: 24,
                          background: "rgba(200,168,75,0.12)", border: "1.5px solid rgba(200,168,75,0.3)",
                          transition: "transform .15s",
                        }}>▶</div>
                        <div style={{ fontSize: 13, color: "#8b8b9e", letterSpacing: ".02em" }}>Clic para cargar preview</div>
                        <div style={{ fontSize: 11, color: "#555", marginTop: -4 }}>o usa <strong style={{ color: "#fca5a5" }}>Grabar Demo</strong> para grabarlo directamente</div>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {/* ── Kit Instagram ── */}
            <div style={{
              padding: "18px 22px", borderRadius: 14, marginBottom: 20,
              background: "linear-gradient(135deg, rgba(200,168,75,0.08), rgba(200,168,75,0.03))",
              border: "1px solid rgba(200,168,75,0.18)",
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 20 }}>
                <span style={{ fontSize: 22 }}>📲</span>
                <div>
                  <div style={{ fontSize: 15, fontWeight: 800, color: "#f5f5f7" }}>Kit de Instagram Profesional</div>
                  <div style={{ fontSize: 12, color: "#8b8b9e" }}>4 captions listos para subir — copia, pega y publica</div>
                </div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(480px, 1fr))", gap: 16 }}>
                {DEMOS.map(demo => (
                  <div key={`ig-${demo.id}`} style={{
                    background: "#0d0d14", borderRadius: 12, border: "1px solid #1e1e2e",
                    overflow: "hidden",
                  }}>
                    <div style={{
                      padding: "10px 14px", display: "flex", alignItems: "center", gap: 8,
                      borderBottom: "1px solid #1e1e2e",
                      background: "rgba(255,255,255,0.02)",
                    }}>
                      <span style={{ fontSize: 16 }}>{demo.emoji}</span>
                      <span style={{ fontSize: 12, fontWeight: 700, color: "#f5f5f7", flex: 1 }}>{demo.name}</span>
                      <button
                        onClick={() => handleCopyCaption(`ig-${demo.id}`, demo.ig)}
                        style={{
                          display: "flex", alignItems: "center", gap: 5, padding: "5px 12px",
                          borderRadius: 7, fontSize: 11, fontWeight: 700, cursor: "pointer",
                          border: "none",
                          background: copiedCaption === `ig-${demo.id}`
                            ? "rgba(76,175,80,0.2)" : "rgba(200,168,75,0.12)",
                          color: copiedCaption === `ig-${demo.id}` ? "#4caf50" : "#c8a84b",
                          outline: copiedCaption === `ig-${demo.id}` ? "1px solid rgba(76,175,80,0.3)" : "1px solid rgba(200,168,75,0.2)",
                          transition: "all 0.2s",
                        }}
                      >
                        {copiedCaption === `ig-${demo.id}`
                          ? <><Check size={11} /> ¡Copiado!</>
                          : <><Copy size={11} /> Copiar caption</>
                        }
                      </button>
                    </div>
                    <div style={{
                      padding: "12px 14px", maxHeight: 200, overflowY: "auto",
                      fontSize: 12, lineHeight: 1.7, color: "#c8c8d8",
                      whiteSpace: "pre-wrap", fontFamily: "monospace",
                    }}>
                      {demo.ig}
                    </div>
                  </div>
                ))}
              </div>

              {/* Copy all button */}
              <div style={{ marginTop: 16, display: "flex", justifyContent: "center" }}>
                <button
                  onClick={() => handleCopyCaption("all", DEMOS.map(d => `━━━ ${d.name} ━━━\n${d.ig}`).join("\n\n"))}
                  style={{
                    display: "flex", alignItems: "center", gap: 8, padding: "10px 28px",
                    borderRadius: 10, fontSize: 13, fontWeight: 700, cursor: "pointer",
                    border: "1px solid rgba(200,168,75,0.3)",
                    background: copiedCaption === "all" ? "rgba(76,175,80,0.15)" : "rgba(200,168,75,0.1)",
                    color: copiedCaption === "all" ? "#4caf50" : "#c8a84b",
                    transition: "all 0.2s",
                  }}
                >
                  {copiedCaption === "all"
                    ? <><Check size={14} /> ¡Los 4 copiados!</>
                    : <><Copy size={14} /> Copiar los 4 captions de golpe</>
                  }
                </button>
              </div>
            </div>

            {/* Tips box */}
            <div style={{
              padding: "14px 18px", borderRadius: 12,
              background: "rgba(59,130,246,0.06)", border: "1px solid rgba(59,130,246,0.15)",
            }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: "#93c5fd", marginBottom: 8 }}>💡 Tips para maximizar visibilidad en Instagram</div>
              <ul style={{ margin: 0, padding: "0 0 0 18px", fontSize: 12, color: "#8b8b9e", lineHeight: 2 }}>
                <li>Sube los demos como <strong style={{ color: "#c8c8d8" }}>Reels de 10–15 seg</strong> con la portada en el primer frame del formulario animándose</li>
                <li>Publica <strong style={{ color: "#c8c8d8" }}>entre 18:00 y 20:00</strong> hora local para máximo alcance orgánico</li>
                <li>Añade en Stories el mismo video con un <strong style={{ color: "#c8c8d8" }}>sticker de encuesta</strong> ("¿Tu tienda tiene estas animaciones?")</li>
                <li>Los primeros <strong style={{ color: "#c8c8d8" }}>3 comentarios propios</strong> con emojis ayudan al algoritmo a clasificar el post</li>
                <li>Usa el caption completo en el post y solo los <strong style={{ color: "#c8c8d8" }}>5 hashtags más relevantes</strong> en el primer comentario</li>
              </ul>
            </div>
          </div>
        );
      })()}

      {/* ════════════════════════════════
          TAB: ARCHIVOS — Entity List
      ════════════════════════════════ */}
      {tab === "archivos" && !selectedEntity && (
        loading ? (
          <div style={{ padding: 60, textAlign: "center", color: "#8b8b9e" }}>
            <RefreshCw size={28} style={{ animation: "spin 1s linear infinite", marginBottom: 12 }} />
            <p>Cargando archivos...</p>
          </div>
        ) : (
          <div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 14 }}>
              {filteredEntities.map((entity, i) => (
                <button
                  key={`${entity.source}-${entity.projectId || entity.name}-${i}`}
                  className="vault-entity-card"
                  onClick={() => handleEntityClick(entity)}
                  style={{
                    background: "#111118", border: "1px solid #1e1e2e", borderRadius: 14,
                    padding: 20, cursor: "pointer", textAlign: "left",
                    transition: "all 0.2s", position: "relative", overflow: "hidden",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 12 }}>
                    <div style={{
                      width: 44, height: 44, borderRadius: 12,
                      background: entity.source === "project"
                        ? "linear-gradient(135deg, rgba(200,168,75,0.2), rgba(200,168,75,0.06))"
                        : "linear-gradient(135deg, rgba(59,130,246,0.2), rgba(59,130,246,0.06))",
                      display: "flex", alignItems: "center", justifyContent: "center",
                      border: `1px solid ${entity.source === "project" ? "rgba(200,168,75,0.2)" : "rgba(59,130,246,0.2)"}`,
                    }}>
                      {entity.source === "project"
                        ? <Building2 size={22} style={{ color: "#c8a84b" }} />
                        : <Globe size={22} style={{ color: "#3b82f6" }} />
                      }
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 15, fontWeight: 700, color: "#f5f5f7" }}>{entity.name}</div>
                      {entity.url && <div style={{ fontSize: 12, color: "#8b8b9e", marginTop: 2 }}>{entity.url}</div>}
                    </div>
                    <ChevronRight size={17} style={{ color: "#8b8b9e" }} />
                  </div>
                  <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                    <span style={{
                      fontSize: 10, fontWeight: 700, padding: "3px 8px", borderRadius: 6,
                      background: entity.source === "project" ? "rgba(200,168,75,0.12)" : "rgba(59,130,246,0.12)",
                      color: entity.source === "project" ? "#c8a84b" : "#3b82f6",
                      textTransform: "uppercase", letterSpacing: 0.5,
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
                  {searchQuery ? "Sin resultados" : "Bóveda vacía"}
                </p>
                <p style={{ fontSize: 13, marginTop: 4 }}>
                  {searchQuery ? "Prueba con otro término" : "Guarda informes desde cualquier herramienta para verlos aquí"}
                </p>
              </div>
            )}
          </div>
        )
      )}

      {/* ════════════════════════════════
          Entity selected → Folder view
      ════════════════════════════════ */}
      {selectedEntity && viewMode === "folders" && !activeFolderType && (
        <div>
          {loadingFiles ? (
            <div style={{ padding: 40, textAlign: "center", color: "#8b8b9e" }}>
              <RefreshCw size={24} style={{ animation: "spin 1s linear infinite" }} />
            </div>
          ) : Object.keys(fileTypeGroups).length === 0 ? (
            <div style={{ textAlign: "center", padding: 60, color: "#8b8b9e", background: "#111118", borderRadius: 14, border: "1px solid #1e1e2e" }}>
              <FolderOpen size={36} style={{ marginBottom: 10, opacity: 0.4 }} />
              <p style={{ fontSize: 14 }}>Sin archivos guardados para esta empresa</p>
            </div>
          ) : (
            <div>
              {FOLDER_GROUP_ORDER.filter(g => groupedFolders[g]).map(groupName => {
                const types = groupedFolders[groupName];
                const isExpanded = expandedGroups.has(groupName);
                const groupCount = types.reduce((s, t) => s + fileTypeGroups[t].length, 0);
                return (
                  <div key={groupName} style={{ marginBottom: 16 }}>
                    <button
                      onClick={() => setExpandedGroups(prev => {
                        const next = new Set(prev);
                        if (next.has(groupName)) next.delete(groupName); else next.add(groupName);
                        return next;
                      })}
                      style={{
                        display: "flex", alignItems: "center", gap: 8, width: "100%",
                        background: "none", border: "none", cursor: "pointer",
                        padding: "8px 0", marginBottom: isExpanded ? 10 : 0,
                      }}
                    >
                      <ChevronDown size={14} style={{ color: "#8b8b9e", transform: isExpanded ? "rotate(0deg)" : "rotate(-90deg)", transition: "0.2s" }} />
                      <span style={{ fontSize: 12, fontWeight: 700, color: "#8b8b9e", letterSpacing: "0.5px" }}>{groupName}</span>
                      <span style={{
                        fontSize: 10, fontWeight: 700, padding: "1px 6px", borderRadius: 8,
                        background: "rgba(255,255,255,0.06)", color: "#6b6b7e",
                      }}>{groupCount}</span>
                    </button>
                    {isExpanded && (
                      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))", gap: 10 }}>
                        {types.map(type => {
                          const meta = getFolderMeta(type);
                          const Icon = meta.icon;
                          const count = fileTypeGroups[type].length;
                          return (
                            <button
                              key={type}
                              className="vault-folder-card"
                              onClick={() => handleFolderClick(type)}
                              style={{
                                background: "#111118", border: "1px solid #1e1e2e", borderRadius: 12,
                                padding: 16, cursor: "pointer", textAlign: "left",
                                transition: "all 0.2s",
                              }}
                            >
                              <div style={{
                                width: 38, height: 38, borderRadius: 10, marginBottom: 10,
                                background: `${meta.color}18`,
                                border: `1px solid ${meta.color}22`,
                                display: "flex", alignItems: "center", justifyContent: "center",
                              }}>
                                <Icon size={18} style={{ color: meta.color }} />
                              </div>
                              <div style={{ fontSize: 13, fontWeight: 600, color: "#f5f5f7", marginBottom: 3 }}>
                                {meta.label}
                              </div>
                              {meta.description && (
                                <div style={{ fontSize: 11, color: "#6b6b7e", marginBottom: 6, lineHeight: 1.3 }}>
                                  {meta.description}
                                </div>
                              )}
                              <div style={{ fontSize: 11, color: "#8b8b9e" }}>
                                {count} {count === 1 ? "archivo" : "archivos"}
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
              {Object.keys(groupedFolders).filter(g => !FOLDER_GROUP_ORDER.includes(g)).map(groupName => {
                const types = groupedFolders[groupName];
                return (
                  <div key={groupName} style={{ marginBottom: 16 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 10 }}>
                      <span style={{ fontSize: 12, fontWeight: 700, color: "#8b8b9e" }}>{groupName}</span>
                    </div>
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))", gap: 10 }}>
                      {types.map(type => {
                        const meta = getFolderMeta(type);
                        const Icon = meta.icon;
                        const count = fileTypeGroups[type].length;
                        return (
                          <button key={type} onClick={() => handleFolderClick(type)}
                            className="vault-folder-card"
                            style={{
                              background: "#111118", border: "1px solid #1e1e2e", borderRadius: 12,
                              padding: 16, cursor: "pointer", textAlign: "left", transition: "all 0.2s",
                            }}
                          >
                            <div style={{ width: 38, height: 38, borderRadius: 10, marginBottom: 10, background: `${meta.color}18`, display: "flex", alignItems: "center", justifyContent: "center" }}>
                              <Icon size={18} style={{ color: meta.color }} />
                            </div>
                            <div style={{ fontSize: 13, fontWeight: 600, color: "#f5f5f7" }}>{meta.label}</div>
                            <div style={{ fontSize: 11, color: "#8b8b9e", marginTop: 2 }}>{count} archivos</div>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ════════════════════════════════
          File list view
      ════════════════════════════════ */}
      {selectedEntity && (viewMode === "list" || activeFolderType) && (
        <div>
          {selectedFiles.size > 0 && (
            <div style={{
              display: "flex", gap: 10, alignItems: "center", marginBottom: 14,
              padding: "10px 16px", background: "rgba(200,168,75,0.07)",
              border: "1px solid rgba(200,168,75,0.18)", borderRadius: 10,
            }}>
              <button onClick={selectAll} style={{ background: "none", border: "none", color: "#c8a84b", cursor: "pointer", display: "flex", alignItems: "center", gap: 4, fontSize: 13 }}>
                <CheckSquare size={15} /> {selectedFiles.size} seleccionados
              </button>
              <button onClick={handleDownloadSelected} disabled={zipping}
                style={{ background: "#c8a84b", color: "#000", border: "none", borderRadius: 8, padding: "6px 14px", cursor: "pointer", fontSize: 13, fontWeight: 600, display: "flex", alignItems: "center", gap: 4, opacity: zipping ? 0.6 : 1 }}>
                <Download size={13} /> {zipping ? "Creando ZIP..." : "Descargar ZIP"}
              </button>
              <button onClick={() => setSelectedFiles(new Set())} style={{ background: "none", border: "none", color: "#8b8b9e", cursor: "pointer", fontSize: 12 }}>
                Cancelar
              </button>
            </div>
          )}

          {loadingFiles ? (
            <div style={{ padding: 40, textAlign: "center", color: "#8b8b9e" }}>
              <RefreshCw size={24} style={{ animation: "spin 1s linear infinite" }} />
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {displayFiles.length === 0 ? (
                <div style={{ textAlign: "center", padding: 50, color: "#8b8b9e", background: "#111118", borderRadius: 12, border: "1px solid #1e1e2e" }}>
                  <FolderOpen size={32} style={{ marginBottom: 8, opacity: 0.4 }} />
                  <p style={{ fontSize: 14 }}>Sin archivos en esta categoría</p>
                </div>
              ) : displayFiles.map(file => {
                const meta = getFolderMeta(file.fileType);
                const Icon = meta.icon;
                const isSelected = selectedFiles.has(file.id);
                const isImage = file.mimeType?.startsWith("image/");
                const isVideo = file.mimeType?.startsWith("video/");

                return (
                  <div key={file.id} className="vault-file-row"
                    style={{
                      display: "flex", alignItems: "center", gap: 12,
                      padding: "11px 15px",
                      background: isSelected ? "rgba(200,168,75,0.06)" : "#0d0d14",
                      border: `1px solid ${isSelected ? "rgba(200,168,75,0.25)" : "#191924"}`,
                      borderRadius: 10, transition: "all 0.12s",
                    }}
                  >
                    <button onClick={() => toggleSelect(file.id)}
                      style={{ background: "none", border: "none", cursor: "pointer", padding: 0, flexShrink: 0 }}>
                      {isSelected
                        ? <CheckSquare size={17} style={{ color: "#c8a84b" }} />
                        : <Square size={17} style={{ color: "#3a3a4a" }} />
                      }
                    </button>

                    <div style={{
                      width: 38, height: 38, borderRadius: 8, background: `${meta.color}14`,
                      display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
                      overflow: "hidden",
                    }}>
                      {isImage && file.downloadUrl ? (
                        <img src={`${API_BASE}${file.downloadUrl}`} alt="" style={{ width: 38, height: 38, objectFit: "cover" }} onError={e => { (e.target as HTMLImageElement).style.display = "none"; }} />
                      ) : (
                        <Icon size={17} style={{ color: meta.color }} />
                      )}
                    </div>

                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 600, color: "#f5f5f7", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {file.title}
                      </div>
                      <div style={{ display: "flex", gap: 8, marginTop: 3, flexWrap: "wrap" }}>
                        <span style={{ fontSize: 11, padding: "1px 6px", borderRadius: 5, background: `${meta.color}15`, color: meta.color }}>
                          {meta.label}
                        </span>
                        {file.generatedBy && <span style={{ fontSize: 11, color: "#6b6b7e" }}>por {file.generatedBy}</span>}
                        {file.fileSizeBytes ? <span style={{ fontSize: 11, color: "#6b6b7e" }}>{fmtSize(file.fileSizeBytes)}</span> : null}
                        <span style={{ fontSize: 11, color: "#6b6b7e" }}>{new Date(file.createdAt).toLocaleDateString("es-ES")}</span>
                      </div>
                    </div>

                    <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
                      {file.previewUrl && (
                        <a href={`${API_BASE}${file.previewUrl}`} target="_blank" rel="noopener noreferrer"
                          style={{ background: "rgba(200,168,75,0.08)", border: "1px solid rgba(200,168,75,0.15)", borderRadius: 7, padding: "6px 9px", color: "#c8a84b", textDecoration: "none", display: "flex", alignItems: "center", gap: 4, fontSize: 11 }}>
                          <Eye size={13} />
                        </a>
                      )}
                      {file.downloadUrl && (
                        <button onClick={() => handleDownload(file)} disabled={downloading === file.id}
                          style={{ background: "rgba(255,255,255,0.05)", border: "1px solid #1e1e2e", borderRadius: 7, padding: "6px 9px", color: "#8b8b9e", cursor: "pointer", display: "flex", alignItems: "center", gap: 4, fontSize: 11 }}>
                          {downloading === file.id ? <RefreshCw size={13} style={{ animation: "spin 1s linear infinite" }} /> : <Download size={13} />}
                        </button>
                      )}
                      {file.originalUrl && (
                        <a href={file.originalUrl} target="_blank" rel="noopener noreferrer"
                          style={{ background: "rgba(255,255,255,0.03)", border: "1px solid #1e1e2e", borderRadius: 7, padding: "6px 9px", color: "#6b6b7e", textDecoration: "none", display: "flex" }}>
                          <ExternalLink size={13} />
                        </a>
                      )}
                      <button onClick={() => handleDelete(file)} disabled={deleting === file.id}
                        style={{ background: "rgba(232,69,88,0.07)", border: "1px solid rgba(232,69,88,0.12)", borderRadius: 7, padding: "6px 9px", color: "#e84558", cursor: "pointer", display: "flex" }}>
                        {deleting === file.id ? <RefreshCw size={13} style={{ animation: "spin 1s linear infinite" }} /> : <Trash2 size={13} />}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
