import { useState, useEffect, useRef } from "react";
import { Youtube, Upload, Trash2, ExternalLink, Search, CheckCircle, AlertCircle, RefreshCw, Link2, Users, Video, Eye, ThumbsUp, MessageSquare, X } from "lucide-react";

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
  const [tab, setTab] = useState<"upload" | "videos" | "search">("upload");
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadResult, setUploadResult] = useState<{ watchUrl: string; title: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [activeEmbed, setActiveEmbed] = useState<string | null>(null);

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
      <div style={{ display: "flex", gap: 4, background: "var(--ink2)", borderRadius: 10, padding: 4, marginBottom: 20 }}>
        {[
          { id: "upload", label: "Subir Vídeo", icon: <Upload size={14} /> },
          { id: "videos", label: "Mis Vídeos", icon: <Video size={14} /> },
          { id: "search", label: "Buscar en YouTube", icon: <Search size={14} /> },
        ].map(t => (
          <button key={t.id} onClick={() => setTab(t.id as any)}
            style={{ flex: 1, padding: "8px 12px", borderRadius: 8, border: "none", cursor: "pointer", fontSize: 13, fontWeight: 600, display: "flex", alignItems: "center", justifyContent: "center", gap: 6, transition: "all .15s",
              background: tab === t.id ? "var(--gold)" : "transparent",
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
    </div>
  );
}
