import { useState, useEffect, useRef } from "react";
import { Youtube, Upload, Trash2, ExternalLink, Search, CheckCircle, AlertCircle, RefreshCw, Link2, Users, Video, Eye, ThumbsUp, MessageSquare, X, TrendingUp, Mic, Copy, Play, Zap, ChevronDown, ChevronUp } from "lucide-react";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

interface Channel {
  connected: boolean;
  channelId?: string;
  channelName?: string;
  channelThumbnail?: string;
  channelUrl?: string;
  subscriberCount?: string;
  videoCount?: string;
}

interface YtVideo {
  videoId: string;
  title: string;
  description?: string;
  thumbnail?: string;
  publishedAt?: string;
  viewCount?: string;
  likeCount?: string;
  commentCount?: string;
  privacy?: string;
  watchUrl: string;
}

interface SearchResult {
  videoId: string;
  title: string;
  thumbnail?: string;
  channelTitle?: string;
  watchUrl: string;
  embedUrl: string;
}

const privacy_labels: Record<string, string> = { public: "Público", private: "Privado", unlisted: "Sin listar" };
const category_options = [
  { id: "1", label: "Cine y animación" }, { id: "2", label: "Autos" },
  { id: "10", label: "Música" }, { id: "17", label: "Deportes" },
  { id: "19", label: "Viajes" }, { id: "20", label: "Gaming" },
  { id: "22", label: "Personas y blogs" }, { id: "23", label: "Comedia" },
  { id: "24", label: "Entretenimiento" }, { id: "25", label: "Noticias" },
  { id: "26", label: "Cómo hacer" }, { id: "27", label: "Educación" },
  { id: "28", label: "Ciencia y tecnología" }, { id: "29", label: "Sin ánimo de lucro" },
];

export default function YouTubeStudio() {
  const [channel, setChannel] = useState<Channel>({ connected: false });
  const [videos, setVideos] = useState<YtVideo[]>([]);
  const [loadingChannel, setLoadingChannel] = useState(true);
  const [loadingVideos, setLoadingVideos] = useState(false);
  const [tab, setTab] = useState<"upload" | "videos" | "search" | "trends" | "satirico">("upload");
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadResult, setUploadResult] = useState<{ watchUrl: string; title: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [activeEmbed, setActiveEmbed] = useState<string | null>(null);

  // ── Trends tab state ──────────────────────────────────────────────────────
  const [trendsData, setTrendsData] = useState<{ news: any[]; formats: any[]; youtubeVideos: any[]; timestamp?: string } | null>(null);
  const [loadingTrends, setLoadingTrends] = useState(false);
  const [trendsCountry, setTrendsCountry] = useState("España");
  const [selectedNews, setSelectedNews] = useState<any | null>(null);

  // ── Satírico IA tab state ────────────────────────────────────────────────
  const [scriptForm, setScriptForm] = useState({ newsText: "", tone: "ácido", duration: "60", style: "monólogo" });
  const [generatingScript, setGeneratingScript] = useState(false);
  const [scriptResult, setScriptResult] = useState<any | null>(null);
  const [generatingVideo, setGeneratingVideo] = useState(false);
  const [videoResult, setVideoResult] = useState<{ vaultId: number; sizeBytes: number } | null>(null);
  const [scriptExpanded, setScriptExpanded] = useState(false);
  const [satiricoProjectId, setSatiricoProjectId] = useState<string>("");
  const [satiricoModel, setSatiricoModel] = useState("seedance-1-lite");
  const [scriptEngine, setScriptEngine] = useState<"grok" | "claude" | "gemini">("grok");

  const [form, setForm] = useState({
    title: "", description: "", tags: "", privacy: "public", categoryId: "22",
  });
  const videoRef = useRef<HTMLInputElement>(null);
  const thumbRef = useRef<HTMLInputElement>(null);
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [thumbFile, setThumbFile] = useState<File | null>(null);

  useEffect(() => { loadChannel(); }, []);

  async function loadChannel() {
    setLoadingChannel(true);
    try {
      const r = await fetch(`${BASE}/api/youtube/channel`, { credentials: "include" });
      if (r.ok) setChannel(await r.json());
    } catch {}
    setLoadingChannel(false);
  }

  async function loadVideos() {
    setLoadingVideos(true);
    try {
      const r = await fetch(`${BASE}/api/youtube/videos`, { credentials: "include" });
      if (r.ok) { const d = await r.json(); setVideos(d.videos || []); }
    } catch {}
    setLoadingVideos(false);
  }

  useEffect(() => { if (tab === "videos" && channel.connected) loadVideos(); }, [tab, channel.connected]);

  async function connectYouTube() {
    try {
      const r = await fetch(`${BASE}/api/youtube/oauth/url`, { credentials: "include" });
      if (!r.ok) { const d = await r.json(); return setError(d.error); }
      const { url } = await r.json();
      window.location.href = url;
    } catch (e: any) {
      setError(e.message);
    }
  }

  async function disconnect() {
    if (!confirm("¿Desconectar el canal de YouTube? Perderás acceso a subir vídeos.")) return;
    await fetch(`${BASE}/api/youtube/channel`, { method: "DELETE", credentials: "include" });
    setChannel({ connected: false });
    setVideos([]);
  }

  async function handleUpload(e: React.FormEvent) {
    e.preventDefault();
    setError(null); setUploadResult(null);
    if (!videoFile) return setError("Selecciona un archivo de vídeo");
    if (!form.title.trim()) return setError("El título es obligatorio");
    setUploading(true); setUploadProgress(0);

    try {
      const fd = new FormData();
      fd.append("video", videoFile);
      if (thumbFile) fd.append("thumbnail", thumbFile);
      fd.append("title", form.title);
      fd.append("description", form.description);
      fd.append("tags", form.tags);
      fd.append("privacy", form.privacy);
      fd.append("categoryId", form.categoryId);

      const simulateProgress = setInterval(() => {
        setUploadProgress(p => p < 85 ? p + Math.random() * 8 : p);
      }, 800);

      const r = await fetch(`${BASE}/api/youtube/upload`, {
        method: "POST", credentials: "include", body: fd,
      });
      clearInterval(simulateProgress);
      setUploadProgress(100);

      if (!r.ok) { const d = await r.json(); throw new Error(d.error); }
      const d = await r.json();
      setUploadResult({ watchUrl: d.watchUrl, title: d.title });
      setForm({ title: "", description: "", tags: "", privacy: "public", categoryId: "22" });
      setVideoFile(null); setThumbFile(null);
      if (videoRef.current) videoRef.current.value = "";
      if (thumbRef.current) thumbRef.current.value = "";
      await loadChannel();
    } catch (e: any) {
      setError(e.message);
    }
    setUploading(false);
  }

  async function deleteVideo(videoId: string) {
    if (!confirm("¿Eliminar este vídeo de YouTube? Esta acción no se puede deshacer.")) return;
    setDeleting(videoId);
    try {
      const r = await fetch(`${BASE}/api/youtube/videos/${videoId}`, { method: "DELETE", credentials: "include" });
      if (r.ok) setVideos(v => v.filter(x => x.videoId !== videoId));
      else setError("No se pudo eliminar el vídeo");
    } catch (e: any) { setError(e.message); }
    setDeleting(null);
  }

  async function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    if (!searchQuery.trim()) return;
    setSearching(true); setSearchResults([]);
    try {
      const r = await fetch(`${BASE}/api/youtube/search?q=${encodeURIComponent(searchQuery)}&max=8`, { credentials: "include" });
      if (r.ok) {
        const d = await r.json();
        if (d.results?.length) setSearchResults(d.results);
        else if (d.fallbackUrl) window.open(d.fallbackUrl, "_blank");
      }
    } catch {}
    setSearching(false);
  }

  // ── Trends functions ──────────────────────────────────────────────────────
  async function fetchTrends() {
    setLoadingTrends(true);
    try {
      const r = await fetch(`${BASE}/api/viral/trends?country=${encodeURIComponent(trendsCountry)}`, { credentials: "include" });
      if (r.ok) setTrendsData(await r.json());
      else setError("Error obteniendo tendencias");
    } catch (e: any) { setError(e.message); }
    setLoadingTrends(false);
  }

  function selectNewsForScript(item: any) {
    setSelectedNews(item);
    const text = typeof item === "object" ? `${item.headline || item.title || ""}: ${item.summary || ""}` : String(item);
    setScriptForm(f => ({ ...f, newsText: text }));
    setTab("satirico");
    setScriptResult(null); setVideoResult(null);
  }

  // ── Script generation ─────────────────────────────────────────────────────
  async function generateScript(e: React.FormEvent) {
    e.preventDefault();
    if (!scriptForm.newsText.trim()) return setError("Introduce la noticia a satirizar");
    setGeneratingScript(true); setScriptResult(null); setVideoResult(null); setError(null);
    try {
      const r = await fetch(`${BASE}/api/viral/script`, {
        method: "POST", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          newsItem: scriptForm.newsText,
          tone: scriptForm.tone,
          duration: parseInt(scriptForm.duration),
          style: scriptForm.style,
          engine: scriptEngine,
        }),
      });
      if (!r.ok) { const d = await r.json(); throw new Error(d.error); }
      const d = await r.json();
      setScriptResult(d.script);
      setScriptExpanded(false);
    } catch (e: any) { setError(e.message); }
    setGeneratingScript(false);
  }

  async function generateViralVideo() {
    if (!scriptResult?.visualPrompt) return;
    if (!satiricoProjectId) return setError("Introduce un Project ID para generar el vídeo");
    setGeneratingVideo(true); setVideoResult(null); setError(null);
    try {
      await fetch(`${BASE}/api/viral/log`, {
        method: "POST", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "video_generated", data: { title: scriptResult.title, model: satiricoModel } }),
      });
      const fd = new FormData();
      fd.append("projectId", satiricoProjectId);
      fd.append("model", satiricoModel);
      fd.append("prompt", scriptResult.visualPrompt);
      fd.append("duration", "5");
      fd.append("aspect", "9:16");
      const r = await fetch(`${BASE}/api/fs-pro/generate-video`, { method: "POST", credentials: "include", body: fd });
      if (!r.ok) { const d = await r.json(); throw new Error(d.error); }
      const d = await r.json();
      setVideoResult(d);
    } catch (e: any) { setError(e.message); }
    setGeneratingVideo(false);
  }

  const fmt = (n?: string) => n ? Number(n).toLocaleString("es") : "—";

  return (
    <div style={{ maxWidth: 1000, margin: "0 auto", padding: "24px 16px" }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 24 }}>
        <div style={{ width: 44, height: 44, borderRadius: 12, background: "linear-gradient(135deg,#ff0000,#cc0000)", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <Youtube size={24} color="#fff" />
        </div>
        <div>
          <h1 style={{ margin: 0, fontSize: 22, fontWeight: 800, color: "var(--t)" }}>YouTube Studio</h1>
          <p style={{ margin: 0, fontSize: 12, color: "var(--t3)" }}>Gestiona y sube vídeos directamente a tu canal</p>
        </div>
      </div>

      {/* Channel card */}
      {loadingChannel ? (
        <div style={{ padding: 24, background: "var(--ink2)", borderRadius: 12, textAlign: "center", color: "var(--t3)", marginBottom: 20 }}>
          Conectando con YouTube…
        </div>
      ) : channel.connected ? (
        <div style={{ background: "var(--ink2)", borderRadius: 12, padding: 16, marginBottom: 20, display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap" }}>
          {channel.channelThumbnail && (
            <img src={channel.channelThumbnail} alt={channel.channelName} style={{ width: 52, height: 52, borderRadius: "50%", border: "2px solid var(--jade)" }} />
          )}
          <div style={{ flex: 1, minWidth: 200 }}>
            <div style={{ fontWeight: 700, color: "var(--t)", fontSize: 15 }}>{channel.channelName}</div>
            <div style={{ fontSize: 12, color: "var(--t3)", marginTop: 2, display: "flex", gap: 16, flexWrap: "wrap" }}>
              <span><Users size={11} style={{ verticalAlign: "middle" }} /> {fmt(channel.subscriberCount)} suscriptores</span>
              <span><Video size={11} style={{ verticalAlign: "middle" }} /> {fmt(channel.videoCount)} vídeos</span>
            </div>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <a href={channel.channelUrl} target="_blank" rel="noreferrer"
               style={{ padding: "6px 12px", background: "rgba(255,0,0,0.15)", border: "1px solid rgba(255,0,0,0.3)", color: "#ff4444", borderRadius: 8, fontSize: 12, textDecoration: "none", display: "flex", alignItems: "center", gap: 5 }}>
              <ExternalLink size={12} /> Ver canal
            </a>
            <button onClick={disconnect}
              style={{ padding: "6px 12px", background: "none", border: "1px solid var(--ink4)", color: "var(--t3)", borderRadius: 8, fontSize: 12, cursor: "pointer" }}>
              Desconectar
            </button>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 5, background: "rgba(16,185,129,0.1)", border: "1px solid var(--jade)", borderRadius: 8, padding: "4px 10px", fontSize: 12, color: "var(--jade)" }}>
            <CheckCircle size={12} /> Canal conectado
          </div>
        </div>
      ) : (
        <div style={{ background: "var(--ink2)", borderRadius: 12, padding: 24, marginBottom: 20, textAlign: "center" }}>
          <Youtube size={40} color="#ff0000" style={{ marginBottom: 12 }} />
          <div style={{ fontWeight: 700, color: "var(--t)", fontSize: 16, marginBottom: 6 }}>Conecta tu canal de YouTube</div>
          <div style={{ fontSize: 13, color: "var(--t3)", marginBottom: 16, maxWidth: 420, margin: "0 auto 16px" }}>
            Autoriza el acceso para subir vídeos, gestionar tu canal y ver estadísticas directamente desde Shopy Crafter.
          </div>
          <div style={{ fontSize: 11, color: "var(--t3)", marginBottom: 16 }}>
            Requiere: <code style={{ background: "var(--ink3)", padding: "1px 5px", borderRadius: 4 }}>YOUTUBE_CLIENT_ID</code> y <code style={{ background: "var(--ink3)", padding: "1px 5px", borderRadius: 4 }}>YOUTUBE_CLIENT_SECRET</code> en variables de entorno
          </div>
          <button onClick={connectYouTube}
            style={{ padding: "10px 24px", background: "#ff0000", color: "#fff", border: "none", borderRadius: 10, fontSize: 14, fontWeight: 700, cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 8 }}>
            <Youtube size={16} /> Conectar con Google / YouTube
          </button>
        </div>
      )}

      {error && (
        <div style={{ background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.3)", borderRadius: 10, padding: "10px 14px", marginBottom: 16, color: "#f87171", display: "flex", gap: 8, alignItems: "flex-start" }}>
          <AlertCircle size={16} style={{ flexShrink: 0, marginTop: 1 }} />
          <span style={{ fontSize: 13 }}>{error}</span>
          <button onClick={() => setError(null)} style={{ marginLeft: "auto", background: "none", border: "none", color: "#f87171", cursor: "pointer" }}><X size={14} /></button>
        </div>
      )}

      {/* Tabs */}
      <div style={{ display: "flex", gap: 4, background: "var(--ink2)", borderRadius: 10, padding: 4, marginBottom: 20, flexWrap: "wrap" }}>
        {[
          { id: "upload",   label: "Subir Vídeo",     icon: <Upload size={13} /> },
          { id: "videos",   label: "Mis Vídeos",       icon: <Video size={13} /> },
          { id: "search",   label: "Buscar",           icon: <Search size={13} /> },
          { id: "trends",   label: "Tendencias 🔥",   icon: <TrendingUp size={13} /> },
          { id: "satirico", label: "Satírico IA 🎭",  icon: <Mic size={13} /> },
        ].map(t => (
          <button key={t.id} onClick={() => setTab(t.id as any)}
            style={{ flex: 1, minWidth: 100, padding: "8px 10px", borderRadius: 8, border: "none", cursor: "pointer", fontSize: 12, fontWeight: 600, display: "flex", alignItems: "center", justifyContent: "center", gap: 5, transition: "all .15s",
              background: tab === t.id ? (t.id === "trends" || t.id === "satirico" ? "linear-gradient(135deg,var(--gold),#f59e0b)" : "var(--gold)") : "transparent",
              color: tab === t.id ? "#000" : "var(--t3)" }}>
            {t.icon} {t.label}
          </button>
        ))}
      </div>

      {/* ── TAB: UPLOAD ── */}
      {tab === "upload" && (
        <div>
          {!channel.connected && (
            <div style={{ padding: 16, background: "rgba(251,191,36,0.1)", border: "1px solid rgba(251,191,36,0.3)", borderRadius: 10, marginBottom: 16, fontSize: 13, color: "var(--gold)" }}>
              ⚠️ Conecta tu canal de YouTube primero para poder subir vídeos
            </div>
          )}

          {uploadResult && (
            <div style={{ background: "rgba(16,185,129,0.1)", border: "1px solid var(--jade)", borderRadius: 12, padding: 16, marginBottom: 20 }}>
              <div style={{ fontWeight: 700, color: "var(--jade)", marginBottom: 6, display: "flex", alignItems: "center", gap: 6 }}>
                <CheckCircle size={16} /> ¡Vídeo subido con éxito!
              </div>
              <div style={{ fontSize: 13, color: "var(--t2)", marginBottom: 8 }}>"{uploadResult.title}"</div>
              <a href={uploadResult.watchUrl} target="_blank" rel="noreferrer"
                style={{ display: "inline-flex", alignItems: "center", gap: 5, padding: "6px 12px", background: "#ff0000", color: "#fff", borderRadius: 8, fontSize: 12, fontWeight: 600, textDecoration: "none" }}>
                <Youtube size={13} /> Ver en YouTube
              </a>
            </div>
          )}

          <form onSubmit={handleUpload}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
              {/* Video file */}
              <div style={{ gridColumn: "1/-1" }}>
                <label style={{ fontSize: 12, color: "var(--t3)", display: "block", marginBottom: 6 }}>Archivo de vídeo *</label>
                <div
                  onClick={() => videoRef.current?.click()}
                  style={{ border: `2px dashed ${videoFile ? "var(--jade)" : "var(--ink4)"}`, borderRadius: 10, padding: 24, textAlign: "center", cursor: "pointer", background: videoFile ? "rgba(16,185,129,0.05)" : "var(--ink2)", transition: "all .15s" }}>
                  {videoFile ? (
                    <div style={{ color: "var(--jade)", fontWeight: 600 }}>
                      <Video size={20} style={{ marginBottom: 4 }} /><br />
                      {videoFile.name} <span style={{ color: "var(--t3)", fontWeight: 400 }}>({(videoFile.size / 1024 / 1024).toFixed(1)} MB)</span>
                    </div>
                  ) : (
                    <div style={{ color: "var(--t3)" }}>
                      <Upload size={24} style={{ marginBottom: 6 }} /><br />
                      <span style={{ fontWeight: 600, color: "var(--t)" }}>Haz clic para seleccionar</span><br />
                      <span style={{ fontSize: 12 }}>MP4, WebM, MOV, AVI — hasta 256 MB</span>
                    </div>
                  )}
                </div>
                <input ref={videoRef} type="file" accept="video/*" style={{ display: "none" }} onChange={e => setVideoFile(e.target.files?.[0] || null)} />
              </div>

              {/* Title */}
              <div style={{ gridColumn: "1/-1" }}>
                <label style={{ fontSize: 12, color: "var(--t3)", display: "block", marginBottom: 6 }}>Título *</label>
                <input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} placeholder="Título del vídeo" maxLength={100}
                  style={{ width: "100%", background: "var(--ink2)", border: "1px solid var(--ink4)", borderRadius: 8, padding: "9px 12px", color: "var(--t)", fontSize: 13, boxSizing: "border-box" }} />
                <div style={{ fontSize: 11, color: "var(--t3)", textAlign: "right", marginTop: 3 }}>{form.title.length}/100</div>
              </div>

              {/* Description */}
              <div style={{ gridColumn: "1/-1" }}>
                <label style={{ fontSize: 12, color: "var(--t3)", display: "block", marginBottom: 6 }}>Descripción</label>
                <textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} placeholder="Descripción del vídeo..." rows={4} maxLength={5000}
                  style={{ width: "100%", background: "var(--ink2)", border: "1px solid var(--ink4)", borderRadius: 8, padding: "9px 12px", color: "var(--t)", fontSize: 13, boxSizing: "border-box", resize: "vertical" }} />
              </div>

              {/* Tags */}
              <div>
                <label style={{ fontSize: 12, color: "var(--t3)", display: "block", marginBottom: 6 }}>Etiquetas (separadas por coma)</label>
                <input value={form.tags} onChange={e => setForm(f => ({ ...f, tags: e.target.value }))} placeholder="moda, shopify, tienda online"
                  style={{ width: "100%", background: "var(--ink2)", border: "1px solid var(--ink4)", borderRadius: 8, padding: "9px 12px", color: "var(--t)", fontSize: 13, boxSizing: "border-box" }} />
              </div>

              {/* Category */}
              <div>
                <label style={{ fontSize: 12, color: "var(--t3)", display: "block", marginBottom: 6 }}>Categoría</label>
                <select value={form.categoryId} onChange={e => setForm(f => ({ ...f, categoryId: e.target.value }))}
                  style={{ width: "100%", background: "var(--ink2)", border: "1px solid var(--ink4)", borderRadius: 8, padding: "9px 12px", color: "var(--t)", fontSize: 13 }}>
                  {category_options.map(c => <option key={c.id} value={c.id}>{c.label}</option>)}
                </select>
              </div>

              {/* Privacy */}
              <div>
                <label style={{ fontSize: 12, color: "var(--t3)", display: "block", marginBottom: 6 }}>Privacidad</label>
                <select value={form.privacy} onChange={e => setForm(f => ({ ...f, privacy: e.target.value }))}
                  style={{ width: "100%", background: "var(--ink2)", border: "1px solid var(--ink4)", borderRadius: 8, padding: "9px 12px", color: "var(--t)", fontSize: 13 }}>
                  <option value="public">Público</option>
                  <option value="unlisted">Sin listar</option>
                  <option value="private">Privado</option>
                </select>
              </div>

              {/* Thumbnail */}
              <div>
                <label style={{ fontSize: 12, color: "var(--t3)", display: "block", marginBottom: 6 }}>Miniatura personalizada</label>
                <div onClick={() => thumbRef.current?.click()}
                  style={{ border: `1px dashed ${thumbFile ? "var(--jade)" : "var(--ink4)"}`, borderRadius: 8, padding: "10px 14px", cursor: "pointer", fontSize: 12, color: thumbFile ? "var(--jade)" : "var(--t3)", background: "var(--ink2)" }}>
                  {thumbFile ? `✓ ${thumbFile.name}` : "Clic para subir miniatura (JPG/PNG)"}
                </div>
                <input ref={thumbRef} type="file" accept="image/jpeg,image/png" style={{ display: "none" }} onChange={e => setThumbFile(e.target.files?.[0] || null)} />
              </div>
            </div>

            {uploading && (
              <div style={{ marginTop: 16 }}>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: "var(--t3)", marginBottom: 4 }}>
                  <span>Subiendo vídeo a YouTube…</span><span>{Math.round(uploadProgress)}%</span>
                </div>
                <div style={{ height: 6, background: "var(--ink3)", borderRadius: 3, overflow: "hidden" }}>
                  <div style={{ height: "100%", background: "#ff0000", borderRadius: 3, width: `${uploadProgress}%`, transition: "width .3s" }} />
                </div>
              </div>
            )}

            <button type="submit" disabled={uploading || !channel.connected}
              style={{ marginTop: 20, width: "100%", padding: "12px", background: channel.connected ? "#ff0000" : "var(--ink3)", color: "#fff", border: "none", borderRadius: 10, fontSize: 14, fontWeight: 700, cursor: channel.connected ? "pointer" : "not-allowed", display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
              {uploading ? <><RefreshCw size={16} className="spin" /> Subiendo…</> : <><Upload size={16} /> Subir vídeo a YouTube</>}
            </button>
          </form>
        </div>
      )}

      {/* ── TAB: MY VIDEOS ── */}
      {tab === "videos" && (
        <div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
            <div style={{ fontSize: 14, fontWeight: 600, color: "var(--t)" }}>Vídeos del canal</div>
            {channel.connected && (
              <button onClick={loadVideos} disabled={loadingVideos}
                style={{ padding: "6px 12px", background: "var(--ink2)", border: "1px solid var(--ink4)", color: "var(--t3)", borderRadius: 8, fontSize: 12, cursor: "pointer", display: "flex", alignItems: "center", gap: 5 }}>
                <RefreshCw size={12} className={loadingVideos ? "spin" : ""} /> Actualizar
              </button>
            )}
          </div>

          {!channel.connected ? (
            <div style={{ textAlign: "center", padding: 40, color: "var(--t3)", fontSize: 14 }}>
              Conecta tu canal para ver los vídeos
            </div>
          ) : loadingVideos ? (
            <div style={{ textAlign: "center", padding: 40, color: "var(--t3)" }}>Cargando vídeos…</div>
          ) : videos.length === 0 ? (
            <div style={{ textAlign: "center", padding: 40, color: "var(--t3)" }}>
              <Youtube size={32} color="var(--ink4)" style={{ marginBottom: 10 }} /><br />
              No hay vídeos en el canal todavía
            </div>
          ) : (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(280px,1fr))", gap: 16 }}>
              {videos.map(v => (
                <div key={v.videoId} style={{ background: "var(--ink2)", borderRadius: 12, overflow: "hidden", border: "1px solid var(--ink3)" }}>
                  {v.thumbnail && (
                    <div style={{ position: "relative" }}>
                      <img src={v.thumbnail} alt={v.title} style={{ width: "100%", aspectRatio: "16/9", objectFit: "cover", display: "block" }} />
                      <div style={{ position: "absolute", top: 6, right: 6, background: "rgba(0,0,0,0.7)", borderRadius: 6, padding: "2px 6px", fontSize: 10, color: "#fff", fontWeight: 600 }}>
                        {privacy_labels[v.privacy || "public"] || v.privacy}
                      </div>
                    </div>
                  )}
                  <div style={{ padding: 12 }}>
                    <div style={{ fontWeight: 600, fontSize: 13, color: "var(--t)", marginBottom: 4, lineHeight: 1.35, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
                      {v.title}
                    </div>
                    <div style={{ display: "flex", gap: 12, fontSize: 11, color: "var(--t3)", marginBottom: 10 }}>
                      <span><Eye size={10} style={{ verticalAlign: "middle" }} /> {fmt(v.viewCount)}</span>
                      <span><ThumbsUp size={10} style={{ verticalAlign: "middle" }} /> {fmt(v.likeCount)}</span>
                      <span><MessageSquare size={10} style={{ verticalAlign: "middle" }} /> {fmt(v.commentCount)}</span>
                    </div>
                    <div style={{ display: "flex", gap: 6 }}>
                      <a href={v.watchUrl} target="_blank" rel="noreferrer"
                        style={{ flex: 1, padding: "5px", background: "rgba(255,0,0,0.1)", border: "1px solid rgba(255,0,0,0.2)", color: "#ff4444", borderRadius: 7, fontSize: 11, fontWeight: 600, textDecoration: "none", display: "flex", alignItems: "center", justifyContent: "center", gap: 4 }}>
                        <ExternalLink size={11} /> Ver
                      </a>
                      <button onClick={() => deleteVideo(v.videoId)} disabled={deleting === v.videoId}
                        style={{ padding: "5px 8px", background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.2)", color: "#f87171", borderRadius: 7, fontSize: 11, cursor: "pointer" }}>
                        <Trash2 size={11} />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── TAB: SEARCH ── */}
      {tab === "search" && (
        <div>
          <form onSubmit={handleSearch} style={{ display: "flex", gap: 8, marginBottom: 20 }}>
            <input value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
              placeholder="Busca una canción, artista, vídeo en YouTube…"
              style={{ flex: 1, background: "var(--ink2)", border: "1px solid var(--ink4)", borderRadius: 10, padding: "10px 14px", color: "var(--t)", fontSize: 13 }} />
            <button type="submit" disabled={searching}
              style={{ padding: "10px 18px", background: "#ff0000", color: "#fff", border: "none", borderRadius: 10, fontSize: 13, fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", gap: 6 }}>
              {searching ? <RefreshCw size={14} className="spin" /> : <Search size={14} />} Buscar
            </button>
          </form>

          {activeEmbed && (
            <div style={{ marginBottom: 20, background: "var(--ink2)", borderRadius: 12, overflow: "hidden", position: "relative" }}>
              <button onClick={() => setActiveEmbed(null)}
                style={{ position: "absolute", top: 8, right: 8, zIndex: 1, background: "rgba(0,0,0,0.6)", border: "none", color: "#fff", borderRadius: "50%", width: 26, height: 26, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <X size={14} />
              </button>
              <iframe src={activeEmbed} width="100%" height="360" style={{ border: "none", display: "block" }}
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                allowFullScreen title="YouTube Player" />
            </div>
          )}

          {searchResults.length > 0 && (
            <div style={{ display: "grid", gap: 12 }}>
              {searchResults.map(r => (
                <div key={r.videoId} style={{ background: "var(--ink2)", borderRadius: 10, padding: 12, display: "flex", gap: 12, border: "1px solid var(--ink3)", alignItems: "center" }}>
                  {r.thumbnail && (
                    <img src={r.thumbnail} alt={r.title} style={{ width: 120, height: 68, objectFit: "cover", borderRadius: 7, flexShrink: 0, cursor: "pointer" }}
                      onClick={() => setActiveEmbed(r.embedUrl)} />
                  )}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 600, fontSize: 13, color: "var(--t)", marginBottom: 3, lineHeight: 1.3 }}>{r.title}</div>
                    {r.channelTitle && <div style={{ fontSize: 11, color: "var(--t3)", marginBottom: 6 }}>{r.channelTitle}</div>}
                    <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                      <button onClick={() => setActiveEmbed(r.embedUrl)}
                        style={{ padding: "4px 10px", background: "#ff0000", color: "#fff", border: "none", borderRadius: 7, fontSize: 11, fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", gap: 4 }}>
                        ▶ Reproducir
                      </button>
                      <a href={r.watchUrl} target="_blank" rel="noreferrer"
                        style={{ padding: "4px 10px", background: "var(--ink3)", border: "1px solid var(--ink4)", color: "var(--t2)", borderRadius: 7, fontSize: 11, textDecoration: "none", display: "flex", alignItems: "center", gap: 4 }}>
                        <ExternalLink size={10} /> Abrir en YouTube
                      </a>
                      <button onClick={() => navigator.clipboard.writeText(r.watchUrl).then(() => {})}
                        style={{ padding: "4px 10px", background: "var(--ink3)", border: "1px solid var(--ink4)", color: "var(--t3)", borderRadius: 7, fontSize: 11, cursor: "pointer", display: "flex", alignItems: "center", gap: 4 }}>
                        <Link2 size={10} /> Copiar link
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {!searching && searchResults.length === 0 && searchQuery && (
            <div style={{ textAlign: "center", padding: 40, color: "var(--t3)" }}>
              <Search size={28} style={{ marginBottom: 10, opacity: 0.3 }} /><br />
              Introduce una búsqueda y pulsa Buscar
            </div>
          )}

          {!searchQuery && !searching && (
            <div style={{ textAlign: "center", padding: 40, color: "var(--t3)" }}>
              <Youtube size={36} color="#ff0000" style={{ marginBottom: 10, opacity: 0.6 }} /><br />
              <div style={{ fontWeight: 600, color: "var(--t2)", marginBottom: 6 }}>Busca cualquier vídeo de YouTube</div>
              <div style={{ fontSize: 12 }}>Canciones, tutoriales, música de fondo para tus anuncios…</div>
            </div>
          )}
        </div>
      )}

      {/* ── TAB: TENDENCIAS ── */}
      {tab === "trends" && (
        <div>
          {/* Header + fetch button */}
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 20, flexWrap: "wrap" }}>
            <div style={{ flex: 1 }}>
              <h2 style={{ margin: 0, fontSize: 18, fontWeight: 800, color: "var(--t)" }}>📰 Tendencias Virales del Día</h2>
              <p style={{ margin: "4px 0 0", fontSize: 12, color: "var(--t3)" }}>Noticias políticas con mayor potencial satírico · {trendsData?.timestamp ? new Date(trendsData.timestamp).toLocaleTimeString("es") : "Sin cargar"}</p>
            </div>
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <select value={trendsCountry} onChange={e => setTrendsCountry(e.target.value)}
                style={{ background: "var(--ink2)", border: "1px solid var(--ink4)", borderRadius: 8, padding: "6px 10px", color: "var(--t)", fontSize: 12 }}>
                {["España", "México", "Argentina", "Colombia", "Chile", "EEUU"].map(c => <option key={c}>{c}</option>)}
              </select>
              <button onClick={fetchTrends} disabled={loadingTrends}
                style={{ padding: "8px 16px", background: "var(--gold)", color: "#000", border: "none", borderRadius: 9, fontSize: 13, fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", gap: 6 }}>
                {loadingTrends ? <RefreshCw size={14} className="spin" /> : <TrendingUp size={14} />}
                {loadingTrends ? "Analizando…" : "Obtener Tendencias"}
              </button>
            </div>
          </div>

          {!trendsData && !loadingTrends && (
            <div style={{ textAlign: "center", padding: 60, color: "var(--t3)" }}>
              <TrendingUp size={40} style={{ marginBottom: 12, opacity: 0.25 }} /><br />
              <div style={{ fontWeight: 600, color: "var(--t2)", marginBottom: 6 }}>Viral Comedy Studio</div>
              <div style={{ fontSize: 12, maxWidth: 380, margin: "0 auto 20px" }}>
                Pulsa <strong>Obtener Tendencias</strong> para analizar con Gemini Search las noticias políticas con mayor potencial satírico del día.
              </div>
              <div style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap" }}>
                {["🎭 Sátira política", "📰 Noticias virales", "🎬 Formatos YouTube", "🔥 Tendencias TikTok"].map(t => (
                  <span key={t} style={{ padding: "4px 12px", background: "var(--ink2)", borderRadius: 20, fontSize: 12, color: "var(--t3)" }}>{t}</span>
                ))}
              </div>
            </div>
          )}

          {loadingTrends && (
            <div style={{ textAlign: "center", padding: 60, color: "var(--t3)" }}>
              <RefreshCw size={32} className="spin" style={{ marginBottom: 12, color: "var(--gold)" }} /><br />
              <div style={{ fontWeight: 600, color: "var(--t2)", marginBottom: 4 }}>Analizando tendencias con Gemini Search…</div>
              <div style={{ fontSize: 12 }}>Buscando noticias virales, formatos exitosos y vídeos trending</div>
            </div>
          )}

          {trendsData && !loadingTrends && (
            <div>
              {/* Noticias */}
              {trendsData.news.length > 0 && (
                <div style={{ marginBottom: 28 }}>
                  <div style={{ fontWeight: 700, color: "var(--t)", fontSize: 14, marginBottom: 12, display: "flex", alignItems: "center", gap: 6 }}>
                    <span style={{ background: "rgba(251,191,36,0.15)", border: "1px solid var(--gold)", borderRadius: 6, padding: "2px 8px", fontSize: 11 }}>🔥 {trendsData.news.length} NOTICIAS</span>
                    Potencial Satírico Político
                  </div>
                  <div style={{ display: "grid", gap: 10 }}>
                    {trendsData.news.map((item: any, i: number) => (
                      <div key={i} style={{ background: "var(--ink2)", borderRadius: 12, padding: 14, border: "1px solid var(--ink3)", display: "flex", gap: 14, alignItems: "flex-start" }}>
                        {/* Comedy score badge */}
                        <div style={{ flexShrink: 0, width: 44, height: 44, borderRadius: 10, background: (item.comedyScore || 5) >= 8 ? "rgba(251,191,36,0.2)" : "var(--ink3)", border: `1px solid ${(item.comedyScore || 5) >= 8 ? "var(--gold)" : "var(--ink4)"}`, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
                          <div style={{ fontSize: 16, fontWeight: 900, color: (item.comedyScore || 5) >= 8 ? "var(--gold)" : "var(--t2)" }}>{item.comedyScore || "?"}</div>
                          <div style={{ fontSize: 9, color: "var(--t3)" }}>🎭</div>
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontWeight: 700, color: "var(--t)", fontSize: 13, marginBottom: 4, lineHeight: 1.35 }}>{item.headline || item.title}</div>
                          {item.summary && <div style={{ fontSize: 12, color: "var(--t3)", marginBottom: 6, lineHeight: 1.5 }}>{item.summary}</div>}
                          <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
                            {item.protagonists && <span style={{ fontSize: 11, color: "var(--t3)", padding: "2px 8px", background: "var(--ink3)", borderRadius: 6 }}>👤 {Array.isArray(item.protagonists) ? item.protagonists.join(", ") : item.protagonists}</span>}
                            {item.virality && <span style={{ fontSize: 11, color: "var(--jade)", padding: "2px 8px", background: "rgba(16,185,129,0.1)", borderRadius: 6 }}>📈 Virality: {item.virality}</span>}
                            <button onClick={() => selectNewsForScript(item)}
                              style={{ marginLeft: "auto", padding: "5px 12px", background: "var(--gold)", color: "#000", border: "none", borderRadius: 7, fontSize: 11, fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", gap: 4 }}>
                              <Mic size={11} /> Satirizar →
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* YouTube trending videos */}
              {trendsData.youtubeVideos.length > 0 && (
                <div style={{ marginBottom: 28 }}>
                  <div style={{ fontWeight: 700, color: "var(--t)", fontSize: 14, marginBottom: 12, display: "flex", alignItems: "center", gap: 6 }}>
                    <span style={{ background: "rgba(255,0,0,0.1)", border: "1px solid rgba(255,0,0,0.3)", borderRadius: 6, padding: "2px 8px", fontSize: 11, color: "#ff4444" }}>▶ {trendsData.youtubeVideos.length} VÍDEOS</span>
                    Trending en YouTube — Sátira Política
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(280px,1fr))", gap: 10 }}>
                    {trendsData.youtubeVideos.map((v: any) => (
                      <div key={v.videoId} style={{ background: "var(--ink2)", borderRadius: 10, overflow: "hidden", border: "1px solid var(--ink3)" }}>
                        {v.thumbnail && <img src={v.thumbnail} alt={v.title} style={{ width: "100%", height: 140, objectFit: "cover" }} />}
                        <div style={{ padding: 10 }}>
                          <div style={{ fontSize: 12, fontWeight: 600, color: "var(--t)", marginBottom: 4, lineHeight: 1.35, overflow: "hidden", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" }}>{v.title}</div>
                          <div style={{ fontSize: 10, color: "var(--t3)", marginBottom: 8 }}>{v.channelTitle} · {Number(v.viewCount || 0).toLocaleString("es")} views</div>
                          <a href={v.watchUrl} target="_blank" rel="noreferrer"
                            style={{ display: "flex", alignItems: "center", gap: 5, padding: "5px 10px", background: "rgba(255,0,0,0.15)", borderRadius: 7, fontSize: 11, color: "#ff4444", textDecoration: "none", fontWeight: 600 }}>
                            <Play size={10} /> Ver vídeo
                          </a>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Viral formats */}
              {trendsData.formats.length > 0 && (
                <div>
                  <div style={{ fontWeight: 700, color: "var(--t)", fontSize: 14, marginBottom: 12, display: "flex", alignItems: "center", gap: 6 }}>
                    <span style={{ background: "rgba(16,185,129,0.1)", border: "1px solid var(--jade)", borderRadius: 6, padding: "2px 8px", fontSize: 11, color: "var(--jade)" }}>🎬 {trendsData.formats.length} FORMATOS</span>
                    Formatos Virales Más Efectivos Ahora
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(260px,1fr))", gap: 10 }}>
                    {trendsData.formats.map((f: any, i: number) => (
                      <div key={i} style={{ background: "var(--ink2)", borderRadius: 10, padding: 14, border: "1px solid var(--ink3)" }}>
                        <div style={{ fontWeight: 700, color: "var(--jade)", fontSize: 13, marginBottom: 6 }}>{f.name}</div>
                        {f.description && <div style={{ fontSize: 12, color: "var(--t3)", marginBottom: 8, lineHeight: 1.5 }}>{f.description}</div>}
                        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                          {f.avgDuration && <span style={{ fontSize: 10, padding: "2px 7px", background: "var(--ink3)", borderRadius: 5, color: "var(--t3)" }}>⏱ {f.avgDuration}</span>}
                          {f.engagement && <span style={{ fontSize: 10, padding: "2px 7px", background: "rgba(251,191,36,0.1)", borderRadius: 5, color: "var(--gold)" }}>📈 {f.engagement}</span>}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ── TAB: SATÍRICO IA ── */}
      {tab === "satirico" && (
        <div>
          <div style={{ marginBottom: 20 }}>
            <h2 style={{ margin: 0, fontSize: 18, fontWeight: 800, color: "var(--t)" }}>🎭 Generador de Guiones Satíricos</h2>
            <p style={{ margin: "4px 0 0", fontSize: 12, color: "var(--t3)" }}>Convierte una noticia política en guión viral · Estilo El Intermedio · La Resistencia · Wyoming</p>
          </div>

          {selectedNews && (
            <div style={{ background: "rgba(251,191,36,0.08)", border: "1px solid rgba(251,191,36,0.25)", borderRadius: 10, padding: 12, marginBottom: 16, display: "flex", gap: 10, alignItems: "flex-start" }}>
              <TrendingUp size={14} style={{ color: "var(--gold)", flexShrink: 0, marginTop: 2 }} />
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 11, color: "var(--gold)", fontWeight: 600, marginBottom: 2 }}>NOTICIA SELECCIONADA</div>
                <div style={{ fontSize: 12, color: "var(--t2)" }}>{selectedNews.headline || selectedNews.title}</div>
              </div>
              <button onClick={() => setSelectedNews(null)} style={{ background: "none", border: "none", color: "var(--t3)", cursor: "pointer" }}><X size={14} /></button>
            </div>
          )}

          <form onSubmit={generateScript} style={{ display: "grid", gap: 14, marginBottom: 24 }}>
            {/* Noticia input */}
            <div>
              <label style={{ fontSize: 12, fontWeight: 600, color: "var(--t2)", marginBottom: 6, display: "block" }}>Noticia a satirizar *</label>
              <textarea value={scriptForm.newsText} onChange={e => setScriptForm(f => ({ ...f, newsText: e.target.value }))}
                placeholder="Pega el titular o describe la noticia que quieres convertir en sátira política…"
                rows={3} style={{ width: "100%", background: "var(--ink2)", border: "1px solid var(--ink4)", borderRadius: 10, padding: "10px 14px", color: "var(--t)", fontSize: 13, resize: "vertical", boxSizing: "border-box" }} />
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: "var(--t2)", marginBottom: 6, display: "block" }}>Tono</label>
                <select value={scriptForm.tone} onChange={e => setScriptForm(f => ({ ...f, tone: e.target.value }))}
                  style={{ width: "100%", background: "var(--ink2)", border: "1px solid var(--ink4)", borderRadius: 9, padding: "9px 12px", color: "var(--t)", fontSize: 13 }}>
                  {["ácido", "absurdo", "irónico", "sarcástico", "tierno"].map(t => <option key={t}>{t}</option>)}
                </select>
              </div>
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: "var(--t2)", marginBottom: 6, display: "block" }}>Formato</label>
                <select value={scriptForm.style} onChange={e => setScriptForm(f => ({ ...f, style: e.target.value }))}
                  style={{ width: "100%", background: "var(--ink2)", border: "1px solid var(--ink4)", borderRadius: 9, padding: "9px 12px", color: "var(--t)", fontSize: 13 }}>
                  {["monólogo", "sketch", "reportaje falso", "entrevista imaginaria"].map(s => <option key={s}>{s}</option>)}
                </select>
              </div>
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: "var(--t2)", marginBottom: 6, display: "block" }}>Duración (seg)</label>
                <select value={scriptForm.duration} onChange={e => setScriptForm(f => ({ ...f, duration: e.target.value }))}
                  style={{ width: "100%", background: "var(--ink2)", border: "1px solid var(--ink4)", borderRadius: 9, padding: "9px 12px", color: "var(--t)", fontSize: 13 }}>
                  {["30", "60", "90", "120", "180"].map(d => <option key={d}>{d}s</option>)}
                </select>
              </div>
            </div>

            {/* Engine selector */}
            <div>
              <label style={{ fontSize: 12, fontWeight: 600, color: "var(--t2)", marginBottom: 8, display: "block" }}>Motor IA para el guión</label>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                {([
                  { id: "grok",   label: "Grok 3",   icon: "⚡", desc: "xAI · recomendado",  color: "#00b4d8" },
                  { id: "claude", label: "Claude",    icon: "🧠", desc: "Anthropic",          color: "#f59e0b" },
                  { id: "gemini", label: "Gemini",    icon: "♊", desc: "Google",              color: "#34d399" },
                ] as const).map(eng => (
                  <button key={eng.id} type="button" onClick={() => setScriptEngine(eng.id)}
                    style={{
                      flex: 1, minWidth: 110, padding: "10px 14px", borderRadius: 10, cursor: "pointer", textAlign: "left",
                      border: scriptEngine === eng.id ? `2px solid ${eng.color}` : "2px solid var(--ink4)",
                      background: scriptEngine === eng.id ? `color-mix(in srgb, ${eng.color} 12%, transparent)` : "var(--ink2)",
                      transition: "all .15s",
                    }}>
                    <div style={{ fontSize: 16, marginBottom: 2 }}>{eng.icon}</div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: scriptEngine === eng.id ? eng.color : "var(--t2)" }}>{eng.label}</div>
                    <div style={{ fontSize: 10, color: "var(--t3)" }}>{eng.desc}</div>
                  </button>
                ))}
              </div>
            </div>

            <button type="submit" disabled={generatingScript || !scriptForm.newsText.trim()}
              style={{ padding: "12px 24px", background: generatingScript ? "var(--ink3)" : "linear-gradient(135deg,var(--gold),#f59e0b)", color: "#000", border: "none", borderRadius: 10, fontSize: 14, fontWeight: 800, cursor: generatingScript ? "not-allowed" : "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
              {generatingScript
                ? <><RefreshCw size={16} className="spin" /> Generando con {scriptEngine === "grok" ? "Grok 3" : scriptEngine === "gemini" ? "Gemini" : "Claude"}…</>
                : <><Zap size={16} /> Generar con {scriptEngine === "grok" ? "⚡ Grok 3" : scriptEngine === "gemini" ? "♊ Gemini" : "🧠 Claude"}</>}
            </button>
          </form>

          {/* Script result */}
          {scriptResult && (
            <div style={{ background: "var(--ink2)", borderRadius: 14, border: "1px solid var(--ink3)", overflow: "hidden", marginBottom: 20 }}>
              {/* Title + meta */}
              <div style={{ padding: "16px 18px", borderBottom: "1px solid var(--ink3)", background: "rgba(251,191,36,0.05)" }}>
                <div style={{ fontWeight: 800, color: "var(--gold)", fontSize: 15, marginBottom: 6 }}>{scriptResult.title}</div>
                {scriptResult.comedyTechniques?.length > 0 && (
                  <div style={{ display: "flex", gap: 5, flexWrap: "wrap" }}>
                    {scriptResult.comedyTechniques.map((t: string) => (
                      <span key={t} style={{ fontSize: 10, padding: "2px 8px", background: "rgba(251,191,36,0.1)", border: "1px solid rgba(251,191,36,0.2)", borderRadius: 20, color: "var(--gold)" }}>🎭 {t}</span>
                    ))}
                  </div>
                )}
              </div>

              {/* Hook */}
              {scriptResult.hook && (
                <div style={{ padding: "12px 18px", borderBottom: "1px solid var(--ink3)", background: "rgba(239,68,68,0.05)" }}>
                  <div style={{ fontSize: 10, fontWeight: 700, color: "#f87171", marginBottom: 4 }}>🎯 HOOK — primeros 5 segundos</div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: "var(--t)", fontStyle: "italic" }}>"{scriptResult.hook}"</div>
                </div>
              )}

              {/* Script toggle */}
              <div style={{ padding: "12px 18px", borderBottom: "1px solid var(--ink3)" }}>
                <button onClick={() => setScriptExpanded(x => !x)}
                  style={{ background: "none", border: "none", color: "var(--t2)", cursor: "pointer", display: "flex", alignItems: "center", gap: 6, fontSize: 13, fontWeight: 600, padding: 0 }}>
                  {scriptExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                  {scriptExpanded ? "Ocultar" : "Ver"} guión completo
                </button>
                {scriptExpanded && (
                  <div style={{ marginTop: 12, fontSize: 12, color: "var(--t2)", lineHeight: 1.8, whiteSpace: "pre-wrap", background: "var(--ink3)", borderRadius: 8, padding: 14 }}>
                    {scriptResult.script}
                  </div>
                )}
              </div>

              {/* Voiceover + visual prompt + copy actions */}
              <div style={{ padding: "12px 18px", display: "grid", gap: 10 }}>
                {scriptResult.voiceoverText && (
                  <div style={{ background: "var(--ink3)", borderRadius: 9, padding: 12 }}>
                    <div style={{ fontSize: 10, fontWeight: 700, color: "var(--t3)", marginBottom: 6 }}>🎙 VOZ EN OFF (para TTS)</div>
                    <div style={{ fontSize: 12, color: "var(--t2)", lineHeight: 1.7 }}>{scriptResult.voiceoverText}</div>
                    <button onClick={() => navigator.clipboard.writeText(scriptResult.voiceoverText)}
                      style={{ marginTop: 8, padding: "4px 10px", background: "var(--ink4)", border: "none", borderRadius: 6, fontSize: 11, color: "var(--t3)", cursor: "pointer", display: "flex", alignItems: "center", gap: 4 }}>
                      <Copy size={10} /> Copiar texto
                    </button>
                  </div>
                )}
                {scriptResult.visualPrompt && (
                  <div style={{ background: "var(--ink3)", borderRadius: 9, padding: 12 }}>
                    <div style={{ fontSize: 10, fontWeight: 700, color: "var(--t3)", marginBottom: 6 }}>🎬 PROMPT VISUAL (para vídeo IA)</div>
                    <div style={{ fontSize: 12, color: "var(--t2)", fontFamily: "monospace", lineHeight: 1.7 }}>{scriptResult.visualPrompt}</div>
                    <button onClick={() => navigator.clipboard.writeText(scriptResult.visualPrompt)}
                      style={{ marginTop: 8, padding: "4px 10px", background: "var(--ink4)", border: "none", borderRadius: 6, fontSize: 11, color: "var(--t3)", cursor: "pointer", display: "flex", alignItems: "center", gap: 4 }}>
                      <Copy size={10} /> Copiar prompt
                    </button>
                  </div>
                )}
                {scriptResult.callToAction && (
                  <div style={{ fontSize: 12, color: "var(--jade)", padding: "8px 12px", background: "rgba(16,185,129,0.08)", borderRadius: 8, border: "1px solid rgba(16,185,129,0.2)" }}>
                    📣 CTA: <strong>{scriptResult.callToAction}</strong>
                  </div>
                )}
                {scriptResult.tags?.length > 0 && (
                  <div style={{ display: "flex", gap: 5, flexWrap: "wrap" }}>
                    {scriptResult.tags.map((tag: string) => (
                      <span key={tag} style={{ fontSize: 10, padding: "2px 8px", background: "var(--ink3)", borderRadius: 20, color: "var(--t3)" }}>#{tag}</span>
                    ))}
                  </div>
                )}
              </div>

              {/* Generate video section */}
              <div style={{ padding: "14px 18px", borderTop: "1px solid var(--ink3)", background: "rgba(16,185,129,0.03)" }}>
                <div style={{ fontWeight: 700, color: "var(--t)", fontSize: 13, marginBottom: 10 }}>🎬 Generar Vídeo IA con este prompt</div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr auto", gap: 10, alignItems: "end" }}>
                  <div>
                    <label style={{ fontSize: 11, color: "var(--t3)", marginBottom: 5, display: "block" }}>Project ID</label>
                    <input value={satiricoProjectId} onChange={e => setSatiricoProjectId(e.target.value)}
                      placeholder="ID del proyecto (número)"
                      style={{ width: "100%", background: "var(--ink3)", border: "1px solid var(--ink4)", borderRadius: 8, padding: "8px 12px", color: "var(--t)", fontSize: 13, boxSizing: "border-box" }} />
                  </div>
                  <div>
                    <label style={{ fontSize: 11, color: "var(--t3)", marginBottom: 5, display: "block" }}>Modelo de vídeo</label>
                    <select value={satiricoModel} onChange={e => setSatiricoModel(e.target.value)}
                      style={{ width: "100%", background: "var(--ink3)", border: "1px solid var(--ink4)", borderRadius: 8, padding: "8px 12px", color: "var(--t)", fontSize: 13 }}>
                      <option value="seedance-1-lite">Seedance 1 Lite ⚡</option>
                      <option value="runway-gen4">Runway Gen4</option>
                      <option value="kling-2.1">Kling 2.1</option>
                      <option value="hailuo-02">Hailuo 02</option>
                      <option value="veo-3">Veo 3 (Google)</option>
                    </select>
                  </div>
                  <button onClick={generateViralVideo} disabled={generatingVideo || !satiricoProjectId}
                    style={{ padding: "8px 16px", background: generatingVideo ? "var(--ink3)" : "var(--jade)", color: generatingVideo ? "var(--t3)" : "#000", border: "none", borderRadius: 9, fontSize: 13, fontWeight: 700, cursor: generatingVideo ? "not-allowed" : "pointer", display: "flex", alignItems: "center", gap: 6, whiteSpace: "nowrap" }}>
                    {generatingVideo ? <RefreshCw size={14} className="spin" /> : <Play size={14} />}
                    {generatingVideo ? "Generando…" : "Generar Vídeo"}
                  </button>
                </div>

                {videoResult && (
                  <div style={{ marginTop: 12, padding: 12, background: "rgba(16,185,129,0.1)", border: "1px solid var(--jade)", borderRadius: 9, display: "flex", alignItems: "center", gap: 10 }}>
                    <CheckCircle size={18} color="var(--jade)" />
                    <div>
                      <div style={{ fontWeight: 700, color: "var(--jade)", fontSize: 13 }}>¡Vídeo generado! Guardado en Vault #{videoResult.vaultId}</div>
                      <div style={{ fontSize: 11, color: "var(--t3)" }}>{((videoResult.sizeBytes || 0) / 1024 / 1024).toFixed(1)} MB · Ahora puedes subírselo a YouTube desde la pestaña <strong>Subir Vídeo</strong></div>
                    </div>
                  </div>
                )}
              </div>

              {/* Description for YouTube */}
              {scriptResult.description && (
                <div style={{ padding: "10px 18px", borderTop: "1px solid var(--ink3)" }}>
                  <div style={{ fontSize: 10, fontWeight: 700, color: "var(--t3)", marginBottom: 6 }}>📝 DESCRIPCIÓN YOUTUBE (SEO)</div>
                  <div style={{ fontSize: 12, color: "var(--t3)", lineHeight: 1.6 }}>{scriptResult.description}</div>
                  <button onClick={() => navigator.clipboard.writeText(scriptResult.description)}
                    style={{ marginTop: 6, padding: "4px 10px", background: "var(--ink3)", border: "none", borderRadius: 6, fontSize: 11, color: "var(--t3)", cursor: "pointer", display: "flex", alignItems: "center", gap: 4 }}>
                    <Copy size={10} /> Copiar descripción
                  </button>
                </div>
              )}
            </div>
          )}

          {!scriptResult && !generatingScript && (
            <div style={{ textAlign: "center", padding: 40, color: "var(--t3)" }}>
              <Mic size={32} style={{ marginBottom: 10, opacity: 0.25 }} /><br />
              <div style={{ fontSize: 13, color: "var(--t2)", marginBottom: 4 }}>Introduce una noticia y pulsa Generar</div>
              <div style={{ fontSize: 12 }}>O vete a Tendencias 🔥 y pulsa <strong>Satirizar →</strong> en cualquier noticia</div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
