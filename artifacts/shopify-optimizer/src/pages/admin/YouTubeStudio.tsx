import { useState, useEffect, useRef } from "react";
import { Youtube, Upload, Trash2, ExternalLink, Search, CheckCircle, AlertCircle, RefreshCw, Link2, Users, Video, Eye, ThumbsUp, MessageSquare, X, TrendingUp, Mic, Copy, Play, Zap, ChevronDown, ChevronUp, UserSquare, Clapperboard, Download } from "lucide-react";

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
  const [tab, setTab] = useState<"upload" | "videos" | "search" | "trends" | "satirico" | "modelo">("upload");
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
  const [trendsData, setTrendsData] = useState<{ news: any[]; formats?: any[]; youtubeVideos: any[]; aiYoutubeVideos?: any[]; aiVideoAnalysis?: any[]; timestamp?: string } | null>(null);
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
  const [satiricoProjects, setSatiricoProjects] = useState<{ id: number; storeName: string }[]>([]);
  const [satiricoModel, setSatiricoModel] = useState("grok-video-1");
  const [scriptEngine, setScriptEngine] = useState<"grok" | "claude" | "gemini">("grok");
  const [videoFormat, setVideoFormat] = useState("product-demo");
  const [comedyPromptId, setComedyPromptId] = useState<string | null>(null);
  const [templateId, setTemplateId] = useState<string | null>(null);
  const [trendsSector, setTrendsSector] = useState("ecommerce_shopify");
  const [studioCategory, setStudioCategory] = useState("entretenimiento");
  const [viralScore, setViralScore] = useState<{ score: number; breakdown: Record<string, number>; recommendations: string[] } | null>(null);
  const [showFormats, setShowFormats] = useState(false);
  const [engines, setEngines] = useState<{ grok: boolean; claude: boolean; gemini: boolean } | null>(null);
  // ── TTS + Voice cloning ──────────────────────────────────────────────────────
  const [studioVoiceId, setStudioVoiceId] = useState<string>("");
  const [generatingVoice, setGeneratingVoice] = useState(false);
  const [voiceAudioUrl, setVoiceAudioUrl] = useState<string | null>(null);
  const [cloningVoice, setCloningVoice] = useState(false);
  const [clonedVoices, setClonedVoices] = useState<Array<{voice_id: string; name: string}>>([
    { voice_id: "8m4O8qoFLrKBzbmsuL5T", name: "Sevillano" },
  ]);
  const [voiceCloneFile, setVoiceCloneFile] = useState<File | null>(null);
  const [voiceCloneName, setVoiceCloneName] = useState("");
  const [showVoiceCloner, setShowVoiceCloner] = useState(false);
  const voiceFileRef = useRef<HTMLInputElement>(null);
  // ── Avatar / referencia visual ───────────────────────────────────────────
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const avatarFileRef = useRef<HTMLInputElement>(null);

  // ── Modelo IA tab state ───────────────────────────────────────────────────
  const [modeloContentType, setModeloContentType] = useState("monologo");
  const [modeloScript, setModeloScript] = useState("");
  const [modeloVoiceId, setModeloVoiceId] = useState("8m4O8qoFLrKBzbmsuL5T");
  const [modeloVoices, setModeloVoices] = useState<Array<{voice_id:string;name:string;category?:string}>>([
    { voice_id: "8m4O8qoFLrKBzbmsuL5T", name: "Sevillano (clonada)", category: "cloned" },
  ]);
  const [modeloFaceFile, setModeloFaceFile] = useState<File | null>(null);
  const [modeloFacePreview, setModeloFacePreview] = useState<string | null>(null);
  const modeloFaceRef = useRef<HTMLInputElement>(null);
  // Reference source
  const [modeloRefMode, setModeloRefMode] = useState<"search" | "generate">("search");
  const [modeloRefQuery, setModeloRefQuery] = useState("");
  const [modeloRefResults, setModeloRefResults] = useState<SearchResult[]>([]);
  const [modeloRefSearching, setModeloRefSearching] = useState(false);
  const [modeloSelectedVideo, setModeloSelectedVideo] = useState<SearchResult | null>(null);
  const [modeloStartSec, setModeloStartSec] = useState(10);
  const [modeloDurSec, setModeloDurSec] = useState(30);
  // Pipeline state
  const [modeloStep, setModeloStep] = useState<"idle"|"extracting"|"dubbing"|"faceswap"|"done"|"error">("idle");
  const [modeloLog, setModeloLog] = useState<string[]>([]);
  const [modeloClipB64, setModeloClipB64] = useState<string | null>(null);
  const [modeloDubbedB64, setModeloDubbedB64] = useState<string | null>(null);
  const [modeloFinalUrl, setModeloFinalUrl] = useState<string | null>(null);
  const [modeloError, setModeloError] = useState<string | null>(null);
  const [modeloGenPrompt, setModeloGenPrompt] = useState("");
  const [modeloLoadingVoices, setModeloLoadingVoices] = useState(false);

  const [form, setForm] = useState({
    title: "", description: "", tags: "", privacy: "public", categoryId: "22",
  });
  const videoRef = useRef<HTMLInputElement>(null);
  const thumbRef = useRef<HTMLInputElement>(null);
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [thumbFile, setThumbFile] = useState<File | null>(null);

  // Carga voces clonadas al montar — para que "Sevillano" aparezca de inmediato
  useEffect(() => {
    loadClonedVoices();
    setStudioVoiceId("8m4O8qoFLrKBzbmsuL5T"); // Sevillano por defecto
  }, []);

  useEffect(() => {
    loadChannel();
    // Cargar proyectos para el selector de vídeo
    fetch(`${BASE}/api/projects`, { credentials: "include" })
      .then(r => r.ok ? r.json() : [])
      .then((list: any[]) => {
        const ps = list.map((p: any) => ({ id: p.id, storeName: p.storeName || p.store_name || `Proyecto ${p.id}` }));
        setSatiricoProjects(ps);
        if (ps.length > 0) setSatiricoProjectId(String(ps[0].id));
      })
      .catch(() => {});
    fetch(`${BASE}/api/viral/engines`, { credentials: "include" })
      .then(r => r.ok ? r.json() : null)
      .then(d => {
        if (d) {
          setEngines(d);
          if (!d.grok && d.claude) setScriptEngine("claude");
          else if (!d.grok && !d.claude && d.gemini) setScriptEngine("gemini");
        }
      }).catch(() => {});
  }, []);

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

  // ── Modelo IA — pre-load Sevillano photo on mount ────────────────────────
  useEffect(() => {
    // Auto-load the saved Sevillano model photo
    fetch(`${BASE}/images/sevillano-model.png`)
      .then(r => { if (!r.ok) return; return r.blob(); })
      .then(blob => {
        if (!blob) return;
        const file = new File([blob], "sevillano-model.png", { type: "image/png" });
        setModeloFaceFile(file);
        setModeloFacePreview(`${BASE}/images/sevillano-model.png`);
      }).catch(() => {});
  }, []);

  // ── Modelo IA — load voices on tab open ──────────────────────────────────
  useEffect(() => {
    if (tab !== "modelo") return;
    setModeloLoadingVoices(true);
    fetch(`${BASE}/api/youtube/modelo/voices`, { credentials: "include" })
      .then(r => r.ok ? r.json() : null)
      .then(d => {
        if (d?.voices?.length) setModeloVoices(d.voices);
      }).catch(() => {})
      .finally(() => setModeloLoadingVoices(false));
    // Auto-suggest query for current content type
    fetch(`${BASE}/api/youtube/modelo/suggest-query?tipo=${modeloContentType}`, { credentials: "include" })
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d?.query) setModeloRefQuery(d.query); }).catch(() => {});
  }, [tab]);

  useEffect(() => {
    if (tab !== "modelo") return;
    fetch(`${BASE}/api/youtube/modelo/suggest-query?tipo=${modeloContentType}`, { credentials: "include" })
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d?.query) setModeloRefQuery(d.query); }).catch(() => {});
  }, [modeloContentType]);

  async function modeloSearchRef() {
    if (!modeloRefQuery.trim()) return;
    setModeloRefSearching(true);
    setModeloRefResults([]);
    try {
      const r = await fetch(`${BASE}/api/youtube/search?q=${encodeURIComponent(modeloRefQuery)}&max=6`, { credentials: "include" });
      const d = await r.json();
      setModeloRefResults(d.results || []);
    } catch {}
    setModeloRefSearching(false);
  }

  function modeloAddLog(msg: string) {
    setModeloLog(prev => [...prev, `${new Date().toLocaleTimeString()} — ${msg}`]);
  }

  async function modeloRunPipeline() {
    if (!modeloScript.trim()) { setModeloError("Escribe el guión primero"); return; }
    if (!modeloVoiceId) { setModeloError("Selecciona una voz"); return; }
    if (modeloRefMode === "search" && !modeloSelectedVideo) { setModeloError("Selecciona un vídeo de referencia"); return; }

    setModeloStep("extracting");
    setModeloError(null);
    setModeloLog([]);
    setModeloClipB64(null);
    setModeloDubbedB64(null);
    setModeloFinalUrl(null);

    try {
      // STEP 1: extract clip or generate reference
      let clipB64: string | null = null;

      if (modeloRefMode === "search" && modeloSelectedVideo) {
        modeloAddLog(`📥 Descargando clip de "${modeloSelectedVideo.title}" (${modeloStartSec}s → +${modeloDurSec}s)…`);
        const r = await fetch(`${BASE}/api/youtube/modelo/extract-clip`, {
          method: "POST", credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ videoId: modeloSelectedVideo.videoId, startSec: modeloStartSec, durationSec: modeloDurSec }),
        });
        const d = await r.json();
        if (!r.ok) throw new Error(d.error || "Error descargando clip");
        clipB64 = d.clipBase64;
        modeloAddLog(`✅ Clip extraído (${d.sizeKb} KB, ${d.durationSec}s)`);
      } else {
        modeloAddLog(`🤖 Generando referencia IA (${modeloContentType}) con Kling…`);
        const r = await fetch(`${BASE}/api/youtube/modelo/generate-reference`, {
          method: "POST", credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ contentType: modeloContentType, prompt: modeloGenPrompt }),
        });
        const d = await r.json();
        if (!r.ok) throw new Error(d.error || "Error generando referencia");
        // Download video URL to base64
        const vidRes = await fetch(d.videoUrl);
        const vidBuf = await vidRes.arrayBuffer();
        clipB64 = btoa(String.fromCharCode(...new Uint8Array(vidBuf)));
        modeloAddLog(`✅ Referencia IA generada`);
      }

      setModeloClipB64(clipB64);
      setModeloStep("dubbing");

      // STEP 2: ElevenLabs dubbing
      modeloAddLog(`🎙️ Enviando a ElevenLabs Dubbing con voz ${modeloVoices.find(v => v.voice_id === modeloVoiceId)?.name || modeloVoiceId}…`);
      const dubR = await fetch(`${BASE}/api/youtube/modelo/dub`, {
        method: "POST", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clipBase64: clipB64, voiceId: modeloVoiceId, script: modeloScript }),
      });
      const dubD = await dubR.json();
      if (!dubR.ok) throw new Error(dubD.error || "Error en dubbing");
      modeloAddLog(`✅ Dubbing completado (id: ${dubD.dubbingId})`);

      // STEP 3: face-swap (optional)
      if (modeloFaceFile) {
        setModeloStep("faceswap");
        modeloAddLog(`🔄 Aplicando face-swap con tu foto…`);
        const fd = new FormData();
        fd.append("videoBase64", dubD.dubbedBase64);
        fd.append("facePhoto", modeloFaceFile);
        const fsR = await fetch(`${BASE}/api/youtube/modelo/face-swap`, {
          method: "POST", credentials: "include", body: fd,
        });
        const fsD = await fsR.json();
        if (!fsR.ok) throw new Error(fsD.error || "Error en face-swap");
        setModeloFinalUrl(Array.isArray(fsD.outputUrl) ? fsD.outputUrl[0] : fsD.outputUrl);
        modeloAddLog(`✅ Face-swap completado`);
      } else {
        // No face-swap: use dubbed video directly
        setModeloDubbedB64(dubD.dubbedBase64);
        modeloAddLog(`ℹ️ Sin face-swap — usando vídeo doblado directamente`);
      }

      setModeloStep("done");
      modeloAddLog(`🎬 ¡Pipeline completado!`);
    } catch (err: any) {
      setModeloStep("error");
      setModeloError(err.message);
      modeloAddLog(`❌ Error: ${err.message}`);
    }
  }

  function modeloDownload() {
    if (modeloFinalUrl) {
      window.open(modeloFinalUrl, "_blank");
      return;
    }
    if (modeloDubbedB64) {
      const a = document.createElement("a");
      a.href = `data:video/mp4;base64,${modeloDubbedB64}`;
      a.download = "modelo_ia.mp4";
      a.click();
    }
  }

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
      const r = await fetch(
        `${BASE}/api/viral/trends?country=${encodeURIComponent(trendsCountry)}&sector=${encodeURIComponent(trendsSector)}`,
        { credentials: "include" }
      );
      if (r.ok) setTrendsData(await r.json());
      else setError("Error obteniendo tendencias");
    } catch (e: any) { setError(e.message); }
    setLoadingTrends(false);
  }

  // Mapea sector de tendencias → categoría del Creador IA
  const SECTOR_TO_CAT: Record<string, string> = {
    ecommerce_shopify:    "entretenimiento",
    dropshipping:         "entretenimiento",
    moda_shopify:         "lifestyle",
    belleza_shopify:      "lifestyle",
    gadgets_shopify:      "entretenimiento",
    hogar_shopify:        "lifestyle",
    alimentacion_shopify: "lifestyle",
    politica_satira:      "politica",
    tecnologia:           "ia-tech",
    fitness_salud:        "lifestyle",
    moda_belleza:         "lifestyle",
    educacion_cursos:     "educativo",
    general:              "entretenimiento",
  };

  const isEcommerceSector = ["ecommerce_shopify","dropshipping","moda_shopify","belleza_shopify",
    "gadgets_shopify","hogar_shopify","alimentacion_shopify"].includes(trendsSector);

  function selectNewsForScript(item: any) {
    setSelectedNews(item);
    const text = typeof item === "object" ? `${item.headline || item.title || ""}: ${item.summary || ""}` : String(item);
    setScriptForm(f => ({ ...f, newsText: text }));
    // pre-seleccionar categoría coherente con el sector de tendencias elegido
    const mappedCat = SECTOR_TO_CAT[trendsSector] || "politica";
    setStudioCategory(mappedCat);
    setTemplateId(null);
    setTab("satirico");
    setScriptResult(null); setVideoResult(null);
  }

  // ── Voice cloning ──────────────────────────────────────────────────────────
  async function loadClonedVoices() {
    try {
      const r = await fetch(`${BASE}/api/voice/cloned`, { credentials: "include" });
      if (r.ok) {
        const d = await r.json();
        const apiVoices: Array<{voice_id: string; name: string}> = d.voices || [];
        // Fusionar: garantizar que las voces conocidas siempre aparecen
        const known = [{ voice_id: "8m4O8qoFLrKBzbmsuL5T", name: "Sevillano" }];
        const merged = [...known];
        for (const v of apiVoices) {
          if (!merged.find(m => m.voice_id === v.voice_id)) merged.push(v);
        }
        setClonedVoices(merged);
      }
    } catch {}
  }

  async function handleCloneVoice() {
    if (!voiceCloneFile || !voiceCloneName.trim()) return;
    setCloningVoice(true);
    try {
      const fd = new FormData();
      fd.append("files", voiceCloneFile, voiceCloneFile.name);
      fd.append("name", voiceCloneName.trim());
      fd.append("description", "Voz clonada desde Creador IA — Acento andaluz");
      const r = await fetch(`${BASE}/api/voice/clone`, { method: "POST", credentials: "include", body: fd });
      if (!r.ok) { const d = await r.json(); throw new Error(d.error || "Error clonando voz"); }
      const d = await r.json();
      setClonedVoices(v => [...v, { voice_id: d.voiceId, name: voiceCloneName.trim() }]);
      setStudioVoiceId(d.voiceId);
      setVoiceCloneName(""); setVoiceCloneFile(null); setShowVoiceCloner(false);
    } catch (err: any) { setError(err.message); }
    finally { setCloningVoice(false); }
  }

  async function generateVoice() {
    const text = scriptResult?.voiceoverText || scriptResult?.script;
    if (!text) return;
    setGeneratingVoice(true); setVoiceAudioUrl(null);
    try {
      const r = await fetch(`${BASE}/api/voice/tts`, {
        method: "POST", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text,
          voiceId: studioVoiceId || undefined,
          modelId: "eleven_v3",
          languageCode: "es",
          voiceSettings: studioCategory === "monologuista"
            ? { stability: 0.30, similarity_boost: 0.90, style: 0.70, use_speaker_boost: true }
            : { stability: 0.40, similarity_boost: 0.85, style: 0.40, use_speaker_boost: true },
        }),
      });
      if (!r.ok) { const d = await r.json(); throw new Error(d.error || "Error generando voz"); }
      const blob = await r.blob();
      if (voiceAudioUrl) URL.revokeObjectURL(voiceAudioUrl);
      setVoiceAudioUrl(URL.createObjectURL(blob));
    } catch (err: any) { setError(err.message); }
    finally { setGeneratingVoice(false); }
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
          format: videoFormat || undefined,
          sector: trendsSector !== "general" ? trendsSector : undefined,
          comedyPromptId: comedyPromptId || undefined,
          templateId: templateId || undefined,
          category: studioCategory,
        }),
      });
      if (!r.ok) { const d = await r.json(); throw new Error(d.error); }
      const d = await r.json();
      setScriptResult(d.script);
      setViralScore(d.viralScore || null);
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
          { id: "satirico", label: "Creador IA 🎬",   icon: <Mic size={13} /> },
          { id: "modelo",   label: "Modelo IA 🎭",   icon: <UserSquare size={13} /> },
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
          <div style={{ marginBottom: 20 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 12, flexWrap: "wrap" }}>
              <div style={{ flex: 1 }}>
                <h2 style={{ margin: 0, fontSize: 18, fontWeight: 800, color: "var(--t)" }}>📰 Tendencias Virales del Día</h2>
                <p style={{ margin: "4px 0 0", fontSize: 12, color: "var(--t3)" }}>Selecciona categoría y país · {trendsData?.timestamp ? new Date(trendsData.timestamp).toLocaleTimeString("es") : "Sin cargar"}</p>
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

            {/* Selector de categoría — Shopify first */}
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              {/* ── Nichos Shopify ── */}
              {([
                { id: "ecommerce_shopify",    emoji: "🏪", label: "Shopify / General" },
                { id: "dropshipping",         emoji: "📦", label: "Dropshipping" },
                { id: "moda_shopify",         emoji: "👗", label: "Moda & Ropa" },
                { id: "belleza_shopify",      emoji: "💄", label: "Belleza & Skincare" },
                { id: "gadgets_shopify",      emoji: "📱", label: "Gadgets & Tech" },
                { id: "hogar_shopify",        emoji: "🏠", label: "Hogar & Deco" },
                { id: "alimentacion_shopify", emoji: "🍃", label: "Alimentación" },
              ]).map(s => (
                <button key={s.id} type="button"
                  onClick={() => { setTrendsSector(s.id); setTrendsData(null); }}
                  style={{
                    padding: "6px 12px", borderRadius: 20, fontSize: 12, fontWeight: 600, cursor: "pointer",
                    border: trendsSector === s.id ? "2px solid var(--gold)" : "1px solid var(--ink4)",
                    background: trendsSector === s.id ? "rgba(251,191,36,0.15)" : "var(--ink2)",
                    color: trendsSector === s.id ? "var(--gold)" : "var(--t3)",
                    transition: "all .15s",
                  }}>
                  {s.emoji} {s.label}
                </button>
              ))}
              {/* ── Separador ── */}
              <span style={{ borderLeft: "1px solid var(--ink4)", margin: "0 4px" }} />
              {/* ── Otros géneros ── */}
              {([
                { id: "politica_satira", emoji: "🏛️", label: "Sátira" },
                { id: "tecnologia",      emoji: "💻", label: "Tech / IA" },
                { id: "educacion_cursos",emoji: "🎓", label: "Educación" },
              ]).map(s => (
                <button key={s.id} type="button"
                  onClick={() => { setTrendsSector(s.id); setTrendsData(null); }}
                  style={{
                    padding: "6px 12px", borderRadius: 20, fontSize: 12, fontWeight: 600, cursor: "pointer",
                    border: trendsSector === s.id ? "2px solid rgba(99,102,241,0.6)" : "1px solid var(--ink4)",
                    background: trendsSector === s.id ? "rgba(99,102,241,0.12)" : "var(--ink2)",
                    color: trendsSector === s.id ? "#818cf8" : "var(--t3)",
                    transition: "all .15s",
                  }}>
                  {s.emoji} {s.label}
                </button>
              ))}
            </div>
          </div>

          {!trendsData && !loadingTrends && (
            <div style={{ textAlign: "center", padding: 60, color: "var(--t3)" }}>
              <TrendingUp size={40} style={{ marginBottom: 12, opacity: 0.25 }} /><br />
              <div style={{ fontWeight: 600, color: "var(--t2)", marginBottom: 6 }}>
                {isEcommerceSector ? "🛍️ Detector de Nichos Shopify con IA" : "🎬 Viral Content Studio"}
              </div>
              <div style={{ fontSize: 12, maxWidth: 420, margin: "0 auto 20px", lineHeight: 1.6 }}>
                {isEcommerceSector
                  ? <>Pulsa <strong>Obtener Tendencias</strong> para descubrir los <strong>productos y nichos más virales</strong> del momento con Gemini Search — adaptado a tu tienda Shopify.</>
                  : <>Pulsa <strong>Obtener Tendencias</strong> para analizar con Gemini Search las tendencias con mayor potencial viral del día.</>}
              </div>
              <div style={{ display: "flex", gap: 10, justifyContent: "center", flexWrap: "wrap" }}>
                {(isEcommerceSector
                  ? ["1️⃣ Elige nicho Shopify", "2️⃣ Elige país", "3️⃣ Obtener Tendencias", "4️⃣ Crear Vídeo de Producto →"]
                  : ["1️⃣ Elige categoría", "2️⃣ Elige país", "3️⃣ Obtener Tendencias", "4️⃣ Usar Tendencia →"]
                ).map(t => (
                  <span key={t} style={{ padding: "4px 12px", background: "var(--ink2)", borderRadius: 20, fontSize: 12, color: "var(--t3)" }}>{t}</span>
                ))}
              </div>
            </div>
          )}

          {loadingTrends && (
            <div style={{ textAlign: "center", padding: 60, color: "var(--t3)" }}>
              <RefreshCw size={32} className="spin" style={{ marginBottom: 12, color: "var(--gold)" }} /><br />
              <div style={{ fontWeight: 600, color: "var(--t2)", marginBottom: 4 }}>
                {isEcommerceSector ? "Detectando nichos y productos virales con Gemini…" : "Analizando tendencias con Gemini Search…"}
              </div>
              <div style={{ fontSize: 12 }}>
                {isEcommerceSector
                  ? "Analizando TikTok Shop, Amazon, YouTube y Shopify para encontrar los nichos del momento"
                  : "Buscando tendencias virales, formatos exitosos y vídeos trending"}
              </div>
            </div>
          )}

          {trendsData && !loadingTrends && (
            <div>
              {/* Noticias / Productos Trending */}
              {trendsData.news.length > 0 && (
                <div style={{ marginBottom: 28 }}>
                  <div style={{ fontWeight: 700, color: "var(--t)", fontSize: 14, marginBottom: 12, display: "flex", alignItems: "center", gap: 6 }}>
                    <span style={{ background: "rgba(251,191,36,0.15)", border: "1px solid var(--gold)", borderRadius: 6, padding: "2px 8px", fontSize: 11 }}>
                      {isEcommerceSector ? `🛍️ ${trendsData.news.length} NICHOS` : `🔥 ${trendsData.news.length} TENDENCIAS`}
                    </span>
                    {isEcommerceSector ? "Nichos & Productos Virales para tu Shopify" : "Tendencias con Mayor Potencial Viral"}
                  </div>
                  <div style={{ display: "grid", gap: 10 }}>
                    {trendsData.news.map((item: any, i: number) => (
                      <div key={i} style={{ background: "var(--ink2)", borderRadius: 12, padding: 14, border: "1px solid var(--ink3)", display: "flex", gap: 14, alignItems: "flex-start" }}>
                        {/* Score badge */}
                        <div style={{ flexShrink: 0, width: 48, height: 48, borderRadius: 10, background: (item.comedyScore || 5) >= 8 ? "rgba(251,191,36,0.2)" : "var(--ink3)", border: `1px solid ${(item.comedyScore || 5) >= 8 ? "var(--gold)" : "var(--ink4)"}`, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 1 }}>
                          <div style={{ fontSize: 15, fontWeight: 900, color: (item.comedyScore || 5) >= 8 ? "var(--gold)" : "var(--t2)" }}>{item.comedyScore || "?"}</div>
                          <div style={{ fontSize: 9, color: "var(--t3)" }}>{isEcommerceSector ? "📈 viral" : "🎭 cómico"}</div>
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontWeight: 700, color: "var(--t)", fontSize: 13, marginBottom: 4, lineHeight: 1.35 }}>{item.headline || item.title}</div>
                          {item.summary && <div style={{ fontSize: 12, color: "var(--t3)", marginBottom: 6, lineHeight: 1.5 }}>{item.summary}</div>}
                          <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
                            {item.protagonists && (
                              <span style={{ fontSize: 11, color: isEcommerceSector ? "var(--jade)" : "var(--t3)", padding: "2px 8px", background: isEcommerceSector ? "rgba(16,185,129,0.1)" : "var(--ink3)", borderRadius: 6 }}>
                                {isEcommerceSector ? "💰" : "👤"} {Array.isArray(item.protagonists) ? item.protagonists.join(", ") : item.protagonists}
                              </span>
                            )}
                            {item.virality && (
                              <span style={{ fontSize: 11, color: "var(--jade)", padding: "2px 8px", background: "rgba(16,185,129,0.1)", borderRadius: 6 }}>
                                {isEcommerceSector ? `🏪 Competencia: ${item.virality}` : `📈 Virality: ${item.virality}`}
                              </span>
                            )}
                            {item.recommendedFormat && (
                              <span style={{ fontSize: 11, color: "var(--t3)", padding: "2px 8px", background: "var(--ink3)", borderRadius: 6 }}>
                                🎬 {item.recommendedFormat}
                              </span>
                            )}
                            <button onClick={() => selectNewsForScript(item)}
                              style={{ marginLeft: "auto", padding: "5px 12px", background: "var(--gold)", color: "#000", border: "none", borderRadius: 7, fontSize: 11, fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", gap: 4 }}>
                              <Mic size={11} /> {isEcommerceSector ? "Crear Vídeo →" : "Usar →"}
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* ── 🤖 Laboratorio de Vídeos IA Virales ── */}
              {(trendsData.aiVideoAnalysis?.length ?? 0) > 0 && (
                <div style={{ marginBottom: 28 }}>
                  <div style={{ fontWeight: 700, color: "var(--t)", fontSize: 14, marginBottom: 6, display: "flex", alignItems: "center", gap: 6 }}>
                    <span style={{ background: "rgba(99,102,241,0.15)", border: "1px solid rgba(99,102,241,0.4)", borderRadius: 6, padding: "2px 8px", fontSize: 11, color: "#818cf8" }}>🤖 {trendsData.aiVideoAnalysis!.length} VÍDEOS IA</span>
                    Laboratorio — Ingeniería Inversa de Virales IA
                  </div>
                  <p style={{ fontSize: 11, color: "var(--t3)", marginBottom: 12, marginTop: 0 }}>Vídeos reales ya publicados, analizados capa por capa. Pulsa <strong style={{ color: "var(--gold)" }}>Replicar →</strong> para copiar la fórmula al Creador IA.</p>
                  <div style={{ display: "grid", gap: 14 }}>
                    {trendsData.aiVideoAnalysis!.map((v: any, i: number) => (
                      <div key={i} style={{ background: "var(--ink2)", borderRadius: 14, border: "1px solid rgba(99,102,241,0.25)", overflow: "hidden" }}>
                        {/* Header */}
                        <div style={{ padding: "12px 14px 10px", display: "flex", gap: 12, alignItems: "flex-start", borderBottom: "1px solid var(--ink3)" }}>
                          <div style={{ flexShrink: 0, width: 36, height: 36, borderRadius: 8, background: "rgba(99,102,241,0.2)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18 }}>🤖</div>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontWeight: 700, color: "var(--t)", fontSize: 13, lineHeight: 1.3, marginBottom: 3 }}>{v.title}</div>
                            <div style={{ fontSize: 11, color: "var(--t3)" }}>
                              {v.channel && <span style={{ marginRight: 8 }}>📺 {v.channel}</span>}
                              {v.estimatedViews && <span style={{ color: "var(--jade)" }}>👁 {v.estimatedViews}</span>}
                            </div>
                          </div>
                          <button onClick={() => {
                            const prompt = [
                              v.replicationFormula || v.replicationPrompt || "",
                              v.hook ? `Hook: ${v.hook}` : "",
                              v.structure ? `Estructura: ${v.structure}` : "",
                            ].filter(Boolean).join("\n\n");
                            selectNewsForScript({ headline: v.title, summary: prompt });
                          }} style={{ flexShrink: 0, padding: "6px 12px", background: "var(--gold)", color: "#000", border: "none", borderRadius: 8, fontSize: 11, fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", gap: 4 }}>
                            <Mic size={11} /> Replicar →
                          </button>
                        </div>
                        {/* Analysis grid */}
                        <div style={{ padding: 14, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                          {v.hook && (
                            <div style={{ background: "rgba(251,191,36,0.07)", borderRadius: 9, padding: "8px 10px", borderLeft: "3px solid var(--gold)" }}>
                              <div style={{ fontSize: 10, fontWeight: 700, color: "var(--gold)", marginBottom: 3, textTransform: "uppercase", letterSpacing: 0.8 }}>⚡ Hook (primeros 5s)</div>
                              <div style={{ fontSize: 11, color: "var(--t2)", lineHeight: 1.45 }}>{v.hook}</div>
                            </div>
                          )}
                          {v.structure && (
                            <div style={{ background: "rgba(16,185,129,0.07)", borderRadius: 9, padding: "8px 10px", borderLeft: "3px solid var(--jade)" }}>
                              <div style={{ fontSize: 10, fontWeight: 700, color: "var(--jade)", marginBottom: 3, textTransform: "uppercase", letterSpacing: 0.8 }}>🏗 Estructura</div>
                              <div style={{ fontSize: 11, color: "var(--t2)", lineHeight: 1.45 }}>{v.structure}</div>
                            </div>
                          )}
                          {v.visualStyle && (
                            <div style={{ background: "rgba(99,102,241,0.07)", borderRadius: 9, padding: "8px 10px", borderLeft: "3px solid #818cf8" }}>
                              <div style={{ fontSize: 10, fontWeight: 700, color: "#818cf8", marginBottom: 3, textTransform: "uppercase", letterSpacing: 0.8 }}>🎨 Estilo Visual IA</div>
                              <div style={{ fontSize: 11, color: "var(--t2)", lineHeight: 1.45 }}>{v.visualStyle}</div>
                            </div>
                          )}
                          {v.whyViral && (
                            <div style={{ background: "rgba(239,68,68,0.07)", borderRadius: 9, padding: "8px 10px", borderLeft: "3px solid #ef4444" }}>
                              <div style={{ fontSize: 10, fontWeight: 700, color: "#ef4444", marginBottom: 3, textTransform: "uppercase", letterSpacing: 0.8 }}>🔥 Por qué fue viral</div>
                              <div style={{ fontSize: 11, color: "var(--t2)", lineHeight: 1.45 }}>{v.whyViral}</div>
                            </div>
                          )}
                          {v.replicationPrompt && (
                            <div style={{ gridColumn: "1/-1", background: "rgba(0,0,0,0.25)", borderRadius: 9, padding: "8px 10px", border: "1px dashed rgba(251,191,36,0.3)" }}>
                              <div style={{ fontSize: 10, fontWeight: 700, color: "var(--gold)", marginBottom: 4, textTransform: "uppercase", letterSpacing: 0.8 }}>🎯 Prompt Visual Replicable</div>
                              <div style={{ fontSize: 11, color: "var(--t3)", lineHeight: 1.5, fontFamily: "monospace" }}>{v.replicationPrompt}</div>
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* ── Vídeos IA reales en YouTube ── */}
              {(trendsData.aiYoutubeVideos?.length ?? 0) > 0 && (
                <div style={{ marginBottom: 28 }}>
                  <div style={{ fontWeight: 700, color: "var(--t)", fontSize: 14, marginBottom: 12, display: "flex", alignItems: "center", gap: 6 }}>
                    <span style={{ background: "rgba(99,102,241,0.1)", border: "1px solid rgba(99,102,241,0.3)", borderRadius: 6, padding: "2px 8px", fontSize: 11, color: "#818cf8" }}>🤖 {trendsData.aiYoutubeVideos!.length} REALES</span>
                    Vídeos IA Virales — Encontrados en YouTube
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(260px,1fr))", gap: 10 }}>
                    {trendsData.aiYoutubeVideos!.map((v: any) => (
                      <div key={v.videoId} style={{ background: "var(--ink2)", borderRadius: 10, overflow: "hidden", border: "1px solid rgba(99,102,241,0.2)" }}>
                        {v.thumbnail && <img src={v.thumbnail} alt={v.title} style={{ width: "100%", height: 130, objectFit: "cover" }} />}
                        <div style={{ padding: 10 }}>
                          <div style={{ fontSize: 12, fontWeight: 600, color: "var(--t)", marginBottom: 4, lineHeight: 1.35, overflow: "hidden", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" }}>{v.title}</div>
                          <div style={{ fontSize: 10, color: "var(--t3)", marginBottom: 8 }}>{v.channelTitle} · {Number(v.viewCount || 0).toLocaleString("es")} views</div>
                          <div style={{ display: "flex", gap: 6 }}>
                            <a href={v.watchUrl} target="_blank" rel="noreferrer"
                              style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 5, padding: "5px 0", background: "rgba(99,102,241,0.15)", borderRadius: 7, fontSize: 11, color: "#818cf8", textDecoration: "none", fontWeight: 600 }}>
                              <Play size={10} /> Ver
                            </a>
                            <button onClick={() => selectNewsForScript({ headline: v.title, summary: `Analiza este vídeo viral de YouTube y crea uno similar: ${v.title} (canal: ${v.channelTitle})` })}
                              style={{ flex: 1, padding: "5px 0", background: "rgba(251,191,36,0.15)", borderRadius: 7, fontSize: 11, color: "var(--gold)", fontWeight: 700, cursor: "pointer", border: "none" }}>
                              <Mic size={10} /> Replicar
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* ── Trending general en YouTube ── */}
              {trendsData.youtubeVideos.length > 0 && (
                <div style={{ marginBottom: 28 }}>
                  <div style={{ fontWeight: 700, color: "var(--t)", fontSize: 14, marginBottom: 12, display: "flex", alignItems: "center", gap: 6 }}>
                    <span style={{ background: "rgba(255,0,0,0.1)", border: "1px solid rgba(255,0,0,0.3)", borderRadius: 6, padding: "2px 8px", fontSize: 11, color: "#ff4444" }}>▶ {trendsData.youtubeVideos.length} TRENDING</span>
                    Más Vistos en YouTube — Categoría Seleccionada
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(260px,1fr))", gap: 10 }}>
                    {trendsData.youtubeVideos.map((v: any) => (
                      <div key={v.videoId} style={{ background: "var(--ink2)", borderRadius: 10, overflow: "hidden", border: "1px solid var(--ink3)" }}>
                        {v.thumbnail && <img src={v.thumbnail} alt={v.title} style={{ width: "100%", height: 130, objectFit: "cover" }} />}
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
            </div>
          )}
        </div>
      )}

      {/* ── TAB: CREADOR IA ── */}
      {tab === "satirico" && (() => {
        // ── Inline category definitions (no extra API call) ──────────────────
        const CATS = [
          { id: "politica",       emoji: "🏛️", name: "Sátira Política",      desc: "Análisis político con humor", inputLabel: "Noticia o tema político", placeholder: "Ej: Feijóo vs Pedro Sánchez en el debate de las saunas..." },
          { id: "historia",       emoji: "🏺", name: "Historia",              desc: "Relatos históricos épicos",   inputLabel: "Período, personaje o evento histórico", placeholder: "Ej: Por qué Cleopatra no era egipcia, Los piratas reales..." },
          { id: "ia-tech",        emoji: "🤖", name: "IA & Tecnología",       desc: "Divulgación tech viral",     inputLabel: "Tema de IA o tecnología", placeholder: "Ej: Claude vs ChatGPT, Cómo funciona un LLM con patatas..." },
          { id: "personajes",     emoji: "🍋", name: "Personajes & Objetos",  desc: "Frutas/objetos que explican", inputLabel: "Concepto + personaje narrador", placeholder: "Ej: Una manzana explica la inflación, Tipos de jefes como frutas..." },
          { id: "educativo",      emoji: "🎓", name: "Educativo con Personaje",desc: "Un narrador enseña conceptos", inputLabel: "Concepto + narrador", placeholder: "Ej: Un detective explica la psicología, Una bruja explica la química..." },
          { id: "lifestyle",      emoji: "✨", name: "Lifestyle & Bienestar", desc: "Hábitos, rutinas, bienestar", inputLabel: "Hábito, rutina o transformación", placeholder: "Ej: Mi rutina de 5am, Cómo dejé de procrastinar para siempre..." },
          { id: "finanzas",       emoji: "💰", name: "Finanzas & Emprendimiento", desc: "Dinero y negocios sin filtros", inputLabel: "Estrategia financiera o error", placeholder: "Ej: Cómo invertir con 100€, El error que te hace pobre..." },
          { id: "ciencia",        emoji: "🔬", name: "Ciencia & Naturaleza",  desc: "Divulgación científica viral", inputLabel: "Fenómeno o paradoja científica", placeholder: "Ej: Por qué el espacio huele a bistec, El animal que no muere..." },
          { id: "entretenimiento",emoji: "😂", name: "Entretenimiento",       desc: "Humor, memes y cultura pop", inputLabel: "Tendencia, meme o fenómeno viral", placeholder: "Ej: Los peores anuncios del año, React a los TikToks más absurdos..." },
          { id: "monologuista",   emoji: "🎤", name: "Monologuista IA",       desc: "Stand-up con acento andaluz", inputLabel: "Tema del monólogo (cotidiano, político, generacional…)", placeholder: "Ej: Las apps de citas en Sevilla, Los turistas en agosto en Málaga, La cuesta de enero siendo autónomo..." },
        ];
        const activeCat = CATS.find(c => c.id === studioCategory) || CATS[0];

        // Templates per category
        const TEMPLATES: Record<string, Array<{id:string;emoji:string;name:string;desc:string}>> = {
          monologuista: [{ id:"monologuista-cotidiano", emoji:"☀️", name:"Lo Cotidiano Andaluz", desc:"Día a día exagerado" }, { id:"monologuista-millennial", emoji:"📱", name:"Millennial Andaluz", desc:"Humor generacional" }, { id:"monologuista-turistas", emoji:"🏖️", name:"Los Turistas", desc:"Turistas en el Sur" }, { id:"monologuista-trabajo", emoji:"💼", name:"El Trabajo en Andalucía", desc:"Cultura laboral" }],
          politica:  [{ id:"satirico-politico", emoji:"🎙️", name:"Analista Sarcástico", desc:"Estilo El Intermedio" }, { id:"entrevistador-incomodo", emoji:"🎤", name:"Entrevistador Incómodo", desc:"Vox Pop absurdo" }, { id:"detector-hipocresia", emoji:"🔍", name:"Detector Hipocresía", desc:"Fact-checker cómico" }],
          historia:  [{ id:"historia-dato-secreto", emoji:"🕵️", name:"El Dato Secreto", desc:"Revelación que cambia todo" }, { id:"historia-personaje-olvidado", emoji:"🎖️", name:"El Genio Olvidado", desc:"Personaje histórico olvidado" }],
          "ia-tech": [{ id:"ia-explica-simple", emoji:"🧩", name:"IA Sin Tecnicismos", desc:"Explicación con analogía" }, { id:"ia-vs-humano", emoji:"⚔️", name:"IA vs Humano", desc:"Experimento comparativo" }],
          personajes:[{ id:"fruta-explica", emoji:"🍊", name:"La Fruta que Explica", desc:"Objeto/fruta con personalidad" }, { id:"tipos-como-frutas", emoji:"🫐", name:"Tipos como Frutas", desc:"Clasificación viral de arquetipos" }],
          educativo: [{ id:"detective-explica", emoji:"🔍", name:"El Detective Investiga", desc:"Narrador tipo noir" }],
          lifestyle: [{ id:"rutina-secreta", emoji:"⏰", name:"La Rutina Inesperada", desc:"Hábito con giro honesto" }],
          finanzas:  [{ id:"secreto-rico", emoji:"💎", name:"Lo Que Los Ricos Hacen", desc:"Revelación financiera" }],
          ciencia:   [{ id:"pregunta-vsauce", emoji:"🌌", name:"La Pregunta Que Rompe", desc:"Pregunta estilo Vsauce" }],
          entretenimiento:[{ id:"ranking-polemico", emoji:"🏆", name:"El Ranking Polémico", desc:"Divide los comentarios" }],
        };
        const catTemplates = TEMPLATES[studioCategory] || [];
        const activeTemplate = templateId ? catTemplates.find(t => t.id === templateId) : null;

        return (
        <div>
          <div style={{ marginBottom: 16 }}>
            <h2 style={{ margin: 0, fontSize: 18, fontWeight: 800, color: "var(--t)" }}>🎬 Creador de Vídeos con IA</h2>
            <p style={{ margin: "4px 0 0", fontSize: 12, color: "var(--t3)" }}>Sin tienda requerida · Genera cualquier tipo de vídeo viral · Los archivos se guardan en tu Shopy Crafter</p>
          </div>

          {selectedNews && (
            <div style={{ background: "rgba(251,191,36,0.08)", border: "1px solid rgba(251,191,36,0.25)", borderRadius: 10, padding: 12, marginBottom: 16, display: "flex", gap: 10, alignItems: "flex-start" }}>
              <TrendingUp size={14} style={{ color: "var(--gold)", flexShrink: 0, marginTop: 2 }} />
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 11, color: "var(--gold)", fontWeight: 600, marginBottom: 2 }}>CONTENIDO SELECCIONADO</div>
                <div style={{ fontSize: 12, color: "var(--t2)" }}>{selectedNews.headline || selectedNews.title}</div>
              </div>
              <button onClick={() => setSelectedNews(null)} style={{ background: "none", border: "none", color: "var(--t3)", cursor: "pointer" }}><X size={14} /></button>
            </div>
          )}

          {/* ── Category Picker ─────────────────────────────────────────────── */}
          <div style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: "var(--t3)", marginBottom: 8, textTransform: "uppercase", letterSpacing: 1 }}>🎯 Tipo de contenido</div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(120px, 1fr))", gap: 7 }}>
              {CATS.map(cat => (
                <button key={cat.id} type="button"
                  onClick={() => { setStudioCategory(cat.id); setTemplateId(null); setComedyPromptId(null); setVideoFormat(cat.id === "politica" ? "satira-politica" : "short-hook"); }}
                  style={{
                    padding: "8px 10px", borderRadius: 10, cursor: "pointer", textAlign: "left",
                    border: studioCategory === cat.id ? "2px solid var(--gold)" : "1px solid var(--ink4)",
                    background: studioCategory === cat.id ? "rgba(251,191,36,0.12)" : "var(--ink2)",
                    transition: "all .15s",
                  }}>
                  <div style={{ fontSize: 18, marginBottom: 2 }}>{cat.emoji}</div>
                  <div style={{ fontSize: 11, fontWeight: 700, color: studioCategory === cat.id ? "var(--gold)" : "var(--t2)", lineHeight: 1.2 }}>{cat.name}</div>
                  <div style={{ fontSize: 9, color: "var(--t3)", marginTop: 2, lineHeight: 1.3 }}>{cat.desc}</div>
                </button>
              ))}
            </div>
          </div>

          {/* ── Templates for selected category ─────────────────────────────── */}
          {catTemplates.length > 0 && (
            <div style={{ background: "rgba(251,191,36,0.05)", border: "1px solid rgba(251,191,36,0.18)", borderRadius: 12, padding: 12, marginBottom: 16 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: "var(--gold)", marginBottom: 8 }}>📋 PLANTILLAS — elige una estructura o escribe libre</div>
              <div style={{ display: "flex", gap: 7, flexWrap: "wrap" }}>
                {catTemplates.map(p => (
                  <button key={p.id} type="button"
                    onClick={() => setTemplateId(templateId === p.id ? null : p.id)}
                  style={{
                    flex: 1, minWidth: 150, padding: "10px 12px", borderRadius: 10, cursor: "pointer", textAlign: "left",
                    border: templateId === p.id ? "2px solid var(--gold)" : "1px solid var(--ink4)",
                    background: templateId === p.id ? "rgba(251,191,36,0.12)" : "var(--ink2)",
                    transition: "all .15s",
                  }}>
                  <div style={{ fontSize: 18, marginBottom: 2 }}>{p.emoji}</div>
                  <div style={{ fontSize: 12, fontWeight: 700, color: templateId === p.id ? "var(--gold)" : "var(--t2)" }}>{p.name}</div>
                  <div style={{ fontSize: 10, color: "var(--t3)" }}>{p.desc}</div>
                  {templateId === p.id && <div style={{ fontSize: 9, color: "var(--gold)", marginTop: 4 }}>✓ ACTIVA</div>}
                </button>
              ))}
            </div>
          </div>
          )}

          {/* ── Video Format Selector ─────────────────────────────────────────── */}
          <div style={{ background: "var(--ink2)", border: "1px solid var(--ink4)", borderRadius: 12, marginBottom: 16, overflow: "hidden" }}>
            <button type="button" onClick={() => setShowFormats(f => !f)}
              style={{ width: "100%", padding: "12px 16px", background: "none", border: "none", color: "var(--t)", cursor: "pointer", display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 13, fontWeight: 700 }}>
              <span>🎬 Formato de vídeo — <span style={{ color: "var(--gold)" }}>{videoFormat}</span></span>
              <ChevronDown size={14} style={{ transform: showFormats ? "rotate(180deg)" : "none", transition: "transform .2s" }} />
            </button>
            {showFormats && (
              <div style={{ padding: "0 14px 14px", display: "grid", gap: 6, maxHeight: 320, overflowY: "auto" }}>
                {[
                  { cat: "⚡ Shorts / Vertical",    ids: ["short-hook","short-tutorial","short-poc"] },
                  { cat: "📱 UGC",                   ids: ["ugc-review","ugc-testimonial","ugc-unboxing"] },
                  { cat: "🎓 Educativo",              ids: ["explainer-animated","how-to-step","listicle"] },
                  { cat: "🛍️ Producto / Ecommerce",  ids: ["product-demo","explode-view","disassemble-assemble","comparison","ecommerce-haul","shopify-tutorial"] },
                  { cat: "🎙️ Podcast",               ids: ["podcast-full","podcast-clip"] },
                  { cat: "🎥 Trailer",               ids: ["channel-trailer","video-trailer","product-launch-trailer"] },
                  { cat: "📹 Storytelling",           ids: ["vlog-day","story-transformation","mini-documentary","behind-scenes"] },
                  { cat: "😱 Reacción",               ids: ["reaction"] },
                  { cat: "🎭 Sátira / Comedia",       ids: ["satira-politica","satira-sketch","vox-pop","fact-check-comico"] },
                ].map(group => (
                  <div key={group.cat}>
                    <div style={{ fontSize: 10, fontWeight: 700, color: "var(--t3)", padding: "6px 0 4px", textTransform: "uppercase", letterSpacing: 1 }}>{group.cat}</div>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
                      {group.ids.map(id => (
                        <button key={id} type="button" onClick={() => { setVideoFormat(id); setShowFormats(false); }}
                          style={{
                            padding: "4px 10px", borderRadius: 20, fontSize: 11, cursor: "pointer",
                            border: videoFormat === id ? "1px solid var(--gold)" : "1px solid var(--ink4)",
                            background: videoFormat === id ? "rgba(251,191,36,0.15)" : "var(--ink3)",
                            color: videoFormat === id ? "var(--gold)" : "var(--t3)",
                            fontWeight: videoFormat === id ? 700 : 400,
                          }}>{id}</button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <form onSubmit={generateScript} style={{ display: "grid", gap: 14, marginBottom: 24 }}>
            {/* Noticia input */}
            <div>
              <label style={{ fontSize: 12, fontWeight: 600, color: "var(--t2)", marginBottom: 6, display: "block" }}>
                {activeCat.inputLabel} *
                {activeTemplate && <span style={{ marginLeft: 8, fontSize: 10, color: "var(--gold)", fontWeight: 400 }}>— Plantilla: {catTemplates.find(t => t.id === templateId)?.name}</span>}
              </label>
              <textarea value={scriptForm.newsText} onChange={e => setScriptForm(f => ({ ...f, newsText: e.target.value }))}
                placeholder={selectedNews ? (selectedNews.headline || selectedNews.title) : activeCat.placeholder}
                rows={3} style={{ width: "100%", background: "var(--ink2)", border: "1px solid var(--ink4)", borderRadius: 10, padding: "10px 14px", color: "var(--t)", fontSize: 13, resize: "vertical", boxSizing: "border-box" }} />
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 12 }}>
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: "var(--t2)", marginBottom: 6, display: "block" }}>Tono</label>
                <select value={scriptForm.tone} onChange={e => setScriptForm(f => ({ ...f, tone: e.target.value }))}
                  style={{ width: "100%", background: "var(--ink2)", border: "1px solid var(--ink4)", borderRadius: 9, padding: "9px 12px", color: "var(--t)", fontSize: 13 }}>
                  {["ácido","absurdo","irónico","sarcástico","educativo","épico","emotivo","tierno","urgente","inspirador"].map(t => <option key={t}>{t}</option>)}
                </select>
              </div>
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: "var(--t2)", marginBottom: 6, display: "block" }}>Estilo</label>
                <select value={scriptForm.style} onChange={e => setScriptForm(f => ({ ...f, style: e.target.value }))}
                  style={{ width: "100%", background: "var(--ink2)", border: "1px solid var(--ink4)", borderRadius: 9, padding: "9px 12px", color: "var(--t)", fontSize: 13 }}>
                  {["monólogo","sketch","reportaje falso","entrevista imaginaria","tutorial","listicle","storytelling","documental","reacción","vox pop"].map(s => <option key={s}>{s}</option>)}
                </select>
              </div>
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: "var(--t2)", marginBottom: 6, display: "block" }}>Duración (seg)</label>
                <select value={scriptForm.duration} onChange={e => setScriptForm(f => ({ ...f, duration: e.target.value }))}
                  style={{ width: "100%", background: "var(--ink2)", border: "1px solid var(--ink4)", borderRadius: 9, padding: "9px 12px", color: "var(--t)", fontSize: 13 }}>
                  {["30","60","90","120","180","300","600"].map(d => <option key={d} value={d}>{d}s {d === "60" ? "(Short)" : d === "300" ? "(5min)" : d === "600" ? "(10min)" : ""}</option>)}
                </select>
              </div>
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: "var(--t2)", marginBottom: 6, display: "block" }}>Sector</label>
                <select value={trendsSector} onChange={e => setTrendsSector(e.target.value)}
                  style={{ width: "100%", background: "var(--ink2)", border: "1px solid var(--ink4)", borderRadius: 9, padding: "9px 12px", color: "var(--t)", fontSize: 13 }}>
                  <option value="general">General</option>
                  <option value="ecommerce_shopify">🏪 Ecommerce / Shopify</option>
                  <option value="politica_satira">🎭 Política / Sátira</option>
                  <option value="tecnologia">💻 Tecnología / IA</option>
                  <option value="fitness_salud">💪 Fitness / Salud</option>
                  <option value="moda_belleza">👗 Moda / Belleza</option>
                  <option value="educacion_cursos">🎓 Educación / Cursos</option>
                </select>
              </div>
            </div>

            {/* Engine selector */}
            <div>
              <label style={{ fontSize: 12, fontWeight: 600, color: "var(--t2)", marginBottom: 8, display: "block" }}>Motor IA para el guión</label>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                {([
                  { id: "grok",   label: "Grok 3",   icon: "⚡", desc: "xAI",       color: "#00b4d8" },
                  { id: "claude", label: "Claude",    icon: "🧠", desc: "Anthropic", color: "#f59e0b" },
                  { id: "gemini", label: "Gemini",    icon: "♊", desc: "Google",    color: "#34d399" },
                ] as const).map(eng => {
                  const available = engines ? engines[eng.id] : true;
                  const active = scriptEngine === eng.id;
                  return (
                    <button key={eng.id} type="button"
                      onClick={() => available && setScriptEngine(eng.id)}
                      title={available ? undefined : `${eng.label}: API key no configurada`}
                      style={{
                        flex: 1, minWidth: 110, padding: "10px 14px", borderRadius: 10,
                        cursor: available ? "pointer" : "not-allowed", textAlign: "left",
                        opacity: available ? 1 : 0.45,
                        border: active ? `2px solid ${eng.color}` : "2px solid var(--ink4)",
                        background: active ? `color-mix(in srgb, ${eng.color} 12%, transparent)` : "var(--ink2)",
                        transition: "all .15s", position: "relative",
                      }}>
                      <div style={{ fontSize: 16, marginBottom: 2 }}>{eng.icon}</div>
                      <div style={{ fontSize: 13, fontWeight: 700, color: active ? eng.color : "var(--t2)" }}>{eng.label}</div>
                      <div style={{ fontSize: 10, color: "var(--t3)" }}>{eng.desc}</div>
                      {engines && (
                        <div style={{ position: "absolute", top: 6, right: 8, fontSize: 10, fontWeight: 700,
                          color: available ? "#10b981" : "#ef4444" }}>
                          {available ? "✓" : "✗"}
                        </div>
                      )}
                    </button>
                  );
                })}
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
                {(scriptResult.contentTechniques || scriptResult.comedyTechniques)?.length > 0 && (
                  <div style={{ display: "flex", gap: 5, flexWrap: "wrap" }}>
                    {(scriptResult.contentTechniques || scriptResult.comedyTechniques).map((t: string) => (
                      <span key={t} style={{ fontSize: 10, padding: "2px 8px", background: "rgba(251,191,36,0.1)", border: "1px solid rgba(251,191,36,0.2)", borderRadius: 20, color: "var(--gold)" }}>✨ {t}</span>
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

              {/* Voiceover + visual prompt + new fields */}
              <div style={{ padding: "12px 18px", display: "grid", gap: 10 }}>

                {/* Virality Score */}
                {viralScore && (
                  <div style={{ background: "var(--ink3)", borderRadius: 9, padding: 12, border: "1px solid rgba(251,191,36,0.2)" }}>
                    <div style={{ fontSize: 10, fontWeight: 700, color: "var(--gold)", marginBottom: 8 }}>📊 PUNTUACIÓN DE VIRALIDAD</div>
                    <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 8 }}>
                      <div style={{
                        width: 56, height: 56, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center",
                        background: `conic-gradient(${viralScore.score >= 70 ? "#10b981" : viralScore.score >= 50 ? "#f59e0b" : "#ef4444"} ${viralScore.score * 3.6}deg, var(--ink4) 0deg)`,
                        flexShrink: 0,
                      }}>
                        <div style={{ width: 44, height: 44, borderRadius: "50%", background: "var(--ink3)", display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column" }}>
                          <span style={{ fontSize: 16, fontWeight: 900, color: viralScore.score >= 70 ? "#10b981" : viralScore.score >= 50 ? "#f59e0b" : "#ef4444" }}>{viralScore.score}</span>
                          <span style={{ fontSize: 8, color: "var(--t3)" }}>/ 100</span>
                        </div>
                      </div>
                      <div style={{ flex: 1 }}>
                        <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginBottom: 6 }}>
                          {Object.entries(viralScore.breakdown).filter(([,v]) => (v as number) > 0).map(([k,v]) => (
                            <span key={k} style={{ fontSize: 9, padding: "2px 7px", background: "rgba(16,185,129,0.15)", borderRadius: 20, color: "#10b981" }}>+{v as number} {k}</span>
                          ))}
                        </div>
                        {viralScore.recommendations?.length > 0 && (
                          <div style={{ fontSize: 10, color: "var(--t3)", lineHeight: 1.6 }}>
                            ⚡ {viralScore.recommendations[0]}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                {/* Title alternatives */}
                {scriptResult.titleAlternatives?.length > 0 && (
                  <div style={{ background: "var(--ink3)", borderRadius: 9, padding: 12 }}>
                    <div style={{ fontSize: 10, fontWeight: 700, color: "var(--t3)", marginBottom: 6 }}>🅰️ TÍTULOS A/B TEST</div>
                    {scriptResult.titleAlternatives.map((t: string, i: number) => (
                      <div key={i} style={{ fontSize: 12, color: "var(--t2)", padding: "4px 0", borderBottom: i < scriptResult.titleAlternatives.length - 1 ? "1px solid var(--ink4)" : "none", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <span>{t}</span>
                        <button onClick={() => navigator.clipboard.writeText(t)} style={{ background: "none", border: "none", color: "var(--t3)", cursor: "pointer", padding: "0 4px" }}><Copy size={10} /></button>
                      </div>
                    ))}
                  </div>
                )}

                {/* Thumbnail prompt */}
                {scriptResult.thumbnailPrompt && (
                  <div style={{ background: "var(--ink3)", borderRadius: 9, padding: 12 }}>
                    <div style={{ fontSize: 10, fontWeight: 700, color: "var(--t3)", marginBottom: 6 }}>🖼️ THUMBNAIL (descripción para diseñar)</div>
                    <div style={{ fontSize: 12, color: "var(--t2)", lineHeight: 1.7 }}>{scriptResult.thumbnailPrompt}</div>
                    <button onClick={() => navigator.clipboard.writeText(scriptResult.thumbnailPrompt)}
                      style={{ marginTop: 8, padding: "4px 10px", background: "var(--ink4)", border: "none", borderRadius: 6, fontSize: 11, color: "var(--t3)", cursor: "pointer", display: "flex", alignItems: "center", gap: 4 }}>
                      <Copy size={10} /> Copiar
                    </button>
                  </div>
                )}

                {/* Shorts version */}
                {scriptResult.shortsVersion && (
                  <div style={{ background: "rgba(239,68,68,0.05)", border: "1px solid rgba(239,68,68,0.2)", borderRadius: 9, padding: 12 }}>
                    <div style={{ fontSize: 10, fontWeight: 700, color: "#f87171", marginBottom: 6 }}>⚡ VERSIÓN SHORT (60s)</div>
                    <div style={{ fontSize: 12, color: "var(--t2)", lineHeight: 1.7, whiteSpace: "pre-wrap" }}>{scriptResult.shortsVersion}</div>
                    <button onClick={() => navigator.clipboard.writeText(scriptResult.shortsVersion)}
                      style={{ marginTop: 8, padding: "4px 10px", background: "var(--ink4)", border: "none", borderRadius: 6, fontSize: 11, color: "var(--t3)", cursor: "pointer", display: "flex", alignItems: "center", gap: 4 }}>
                      <Copy size={10} /> Copiar versión Short
                    </button>
                  </div>
                )}

                {/* Voiceover */}
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

                {/* ── Avatar / Referencia Visual ────────────────────────────── */}
                <div style={{ background: "linear-gradient(135deg,rgba(251,191,36,0.06),rgba(16,185,129,0.06))", border: "1px solid rgba(251,191,36,0.25)", borderRadius: 12, padding: 14, marginBottom: 10 }}>
                  <div style={{ fontWeight: 700, color: "var(--gold)", fontSize: 13, marginBottom: 10, display: "flex", alignItems: "center", gap: 6 }}>
                    🎭 Avatar / Imagen de referencia
                    <span style={{ fontSize: 10, background: "rgba(251,191,36,0.12)", padding: "2px 8px", borderRadius: 20, color: "var(--gold)" }}>
                      {studioCategory === "monologuista" ? "Monologuista visual · se usará como portada y prompt de vídeo" : "Referencia visual para el personaje / presentador"}
                    </span>
                  </div>
                  <div style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
                    {/* Preview */}
                    <div
                      onClick={() => avatarFileRef.current?.click()}
                      style={{
                        width: 100, height: 100, borderRadius: 12, flexShrink: 0, cursor: "pointer",
                        border: avatarPreview ? "2px solid var(--gold)" : "2px dashed rgba(251,191,36,0.4)",
                        background: avatarPreview ? "transparent" : "rgba(251,191,36,0.04)",
                        display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden",
                        position: "relative",
                      }}
                    >
                      {avatarPreview
                        ? <img src={avatarPreview} alt="avatar" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                        : <div style={{ textAlign: "center", color: "rgba(251,191,36,0.6)", fontSize: 11 }}>
                            <div style={{ fontSize: 28, marginBottom: 4 }}>🎭</div>
                            <div>Subir foto</div>
                          </div>
                      }
                      {avatarPreview && (
                        <div style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.4)", display: "flex", alignItems: "center", justifyContent: "center", opacity: 0, transition: "opacity .2s" }}
                          onMouseEnter={e => (e.currentTarget.style.opacity = "1")}
                          onMouseLeave={e => (e.currentTarget.style.opacity = "0")}>
                          <span style={{ color: "#fff", fontSize: 11, fontWeight: 700 }}>Cambiar</span>
                        </div>
                      )}
                    </div>
                    <input ref={avatarFileRef} type="file" accept="image/*" style={{ display: "none" }}
                      onChange={e => {
                        const f = e.target.files?.[0];
                        if (!f) return;
                        setAvatarFile(f);
                        const url = URL.createObjectURL(f);
                        setAvatarPreview(url);
                      }}
                    />
                    {/* Info + acciones */}
                    <div style={{ flex: 1, fontSize: 12, color: "var(--t2)", lineHeight: 1.6 }}>
                      {avatarFile ? (
                        <div>
                          <div style={{ fontWeight: 700, color: "var(--t1)", marginBottom: 4 }}>✅ {avatarFile.name}</div>
                          <div style={{ color: "var(--t3)", fontSize: 11, marginBottom: 8 }}>{(avatarFile.size / 1024).toFixed(0)} KB · Se usará como imagen de portada y referencia para generar el vídeo con tu monologuista</div>
                          {studioCategory === "monologuista" && (
                            <div style={{ background: "rgba(251,191,36,0.08)", border: "1px solid rgba(251,191,36,0.2)", borderRadius: 8, padding: "8px 10px", fontSize: 11, color: "var(--t2)" }}>
                              💡 <strong>Tip:</strong> Usa una foto tuya, un personaje diseñado en Tripo3D, o cualquier imagen que represente al monologuista. Cuanto más expresiva, mejor capturará la IA el estilo.
                            </div>
                          )}
                          <button type="button" onClick={() => { setAvatarFile(null); setAvatarPreview(null); if (avatarFileRef.current) avatarFileRef.current.value = ""; }}
                            style={{ marginTop: 8, background: "none", border: "1px solid rgba(239,68,68,0.4)", borderRadius: 6, padding: "4px 10px", fontSize: 11, color: "#f87171", cursor: "pointer" }}>
                            🗑 Quitar imagen
                          </button>
                        </div>
                      ) : (
                        <div>
                          <div style={{ marginBottom: 6 }}>Sube una foto de tu avatar/monologuista para:</div>
                          <ul style={{ margin: 0, paddingLeft: 16, color: "var(--t3)", fontSize: 11 }}>
                            <li>Usarla como portada del vídeo en YouTube</li>
                            <li>Dar contexto visual al generador de vídeo IA</li>
                            {studioCategory === "monologuista" && <li>Referenciar el personaje en el prompt del monólogo</li>}
                          </ul>
                          <button type="button" onClick={() => avatarFileRef.current?.click()}
                            style={{ marginTop: 10, background: "rgba(251,191,36,0.1)", border: "1px solid rgba(251,191,36,0.3)", borderRadius: 8, padding: "7px 14px", fontSize: 12, color: "var(--gold)", cursor: "pointer", fontWeight: 600 }}>
                            📁 Seleccionar imagen
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* ── TTS Panel ─────────────────────────────────────────────── */}
                <div style={{ background: "linear-gradient(135deg,rgba(139,92,246,0.08),rgba(251,191,36,0.06))", border: "1px solid rgba(139,92,246,0.3)", borderRadius: 12, padding: 14 }}>
                  <div style={{ fontWeight: 700, color: "#a78bfa", fontSize: 13, marginBottom: 10, display: "flex", alignItems: "center", gap: 6 }}>
                    🎙️ Generar Voz con IA
                    {studioCategory === "monologuista" && <span style={{ fontSize: 10, background: "rgba(139,92,246,0.2)", padding: "2px 8px", borderRadius: 20, color: "#c4b5fd" }}>Ajustado para stand-up / acento andaluz</span>}
                  </div>

                  {/* Voice selector */}
                  <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 10, flexWrap: "wrap" }}>
                    <select value={studioVoiceId} onChange={e => setStudioVoiceId(e.target.value)}
                      style={{ flex: 1, minWidth: 180, background: "var(--ink2)", border: "1px solid rgba(139,92,246,0.4)", borderRadius: 8, padding: "8px 12px", color: "var(--t)", fontSize: 12 }}>
                      <option value="">🤖 Voz automática (español)</option>
                      <optgroup label="— Voces clonadas tuyas —">
                        {clonedVoices.map(v => (
                          <option key={v.voice_id} value={v.voice_id}>🎤 {v.name} (clonada)</option>
                        ))}
                        {clonedVoices.length === 0 && <option disabled>Ninguna — sube un audio abajo para clonar</option>}
                      </optgroup>
                      <optgroup label="— Voces ElevenLabs disponibles —">
                        <option value="IKne3meq5aSn9XLyUdCD">Charlie (multilingüe)</option>
                        <option value="N2lVS1w4EtoT3dr4eOWO">Callum (expresivo)</option>
                        <option value="TX3LPaxmHKxFdv7VOQHJ">Liam (natural)</option>
                        <option value="XB0fDUnXU5powFXDhCwa">Charlotte (femenina)</option>
                        <option value="pqHfZKP75CvOlQylNhV4">Bill (grave)</option>
                      </optgroup>
                    </select>

                    <button onClick={generateVoice} disabled={generatingVoice}
                      style={{ padding: "9px 18px", background: generatingVoice ? "var(--ink3)" : "linear-gradient(135deg,#7c3aed,#a78bfa)", color: generatingVoice ? "var(--t3)" : "#fff", border: "none", borderRadius: 9, fontSize: 13, fontWeight: 700, cursor: generatingVoice ? "not-allowed" : "pointer", display: "flex", alignItems: "center", gap: 6, whiteSpace: "nowrap" }}>
                      {generatingVoice ? <><RefreshCw size={14} className="spin" /> Generando…</> : <><Mic size={14} /> Generar voz</>}
                    </button>
                  </div>

                  {voiceAudioUrl && (
                    <div style={{ background: "rgba(139,92,246,0.1)", borderRadius: 9, padding: 10 }}>
                      <div style={{ fontSize: 10, fontWeight: 700, color: "#a78bfa", marginBottom: 6 }}>✅ AUDIO GENERADO — Escúchalo y descárgalo</div>
                      <audio controls src={voiceAudioUrl} style={{ width: "100%" }} />
                      <a href={voiceAudioUrl} download={`monologuista_${Date.now()}.mp3`}
                        style={{ marginTop: 8, display: "inline-flex", alignItems: "center", gap: 4, padding: "4px 12px", background: "rgba(139,92,246,0.2)", border: "1px solid rgba(139,92,246,0.4)", borderRadius: 6, fontSize: 11, color: "#a78bfa", textDecoration: "none" }}>
                        ⬇️ Descargar MP3
                      </a>
                    </div>
                  )}

                  {/* Voice cloner toggle */}
                  <button type="button" onClick={() => { setShowVoiceCloner(v => !v); if (!showVoiceCloner) loadClonedVoices(); }}
                    style={{ marginTop: 10, background: "none", border: "1px dashed rgba(139,92,246,0.4)", color: "#a78bfa", borderRadius: 8, padding: "6px 14px", fontSize: 11, cursor: "pointer", width: "100%" }}>
                    {showVoiceCloner ? "▲ Ocultar clonar voz" : "🧬 Clonar mi voz (sube un audio en andaluz)"}
                  </button>

                  {showVoiceCloner && (
                    <div style={{ marginTop: 10, padding: 12, background: "var(--ink2)", borderRadius: 10, border: "1px solid rgba(139,92,246,0.25)" }}>
                      <div style={{ fontSize: 11, fontWeight: 700, color: "#a78bfa", marginBottom: 8 }}>🧬 CLONAR VOZ — ElevenLabs Instant Voice Cloning</div>
                      <div style={{ fontSize: 10, color: "var(--t3)", marginBottom: 10, lineHeight: 1.5 }}>
                        Sube 1-3 minutos de audio limpio (sin música de fondo). Cuanto más claro y expresivo, mejor resultado.
                        Formatos: MP3, WAV, M4A, OGG, FLAC. Máx 25 MB.
                      </div>
                      <div style={{ display: "grid", gap: 8 }}>
                        <input
                          type="text" value={voiceCloneName} onChange={e => setVoiceCloneName(e.target.value)}
                          placeholder="Nombre para la voz (ej: Manolo Andaluz, Pepa Sevillana…)"
                          style={{ width: "100%", background: "var(--ink3)", border: "1px solid var(--ink4)", borderRadius: 8, padding: "8px 12px", color: "var(--t)", fontSize: 12, boxSizing: "border-box" }}
                        />
                        <input ref={voiceFileRef} type="file" accept="audio/*" style={{ display: "none" }}
                          onChange={e => setVoiceCloneFile(e.target.files?.[0] || null)} />
                        <button type="button" onClick={() => voiceFileRef.current?.click()}
                          style={{ padding: "8px 14px", background: "var(--ink3)", border: "1px dashed var(--ink4)", borderRadius: 8, color: "var(--t2)", fontSize: 12, cursor: "pointer", textAlign: "left" }}>
                          {voiceCloneFile ? `✅ ${voiceCloneFile.name} (${(voiceCloneFile.size/1024/1024).toFixed(1)} MB)` : "📎 Seleccionar archivo de audio…"}
                        </button>
                        <button type="button" onClick={handleCloneVoice}
                          disabled={cloningVoice || !voiceCloneFile || !voiceCloneName.trim()}
                          style={{ padding: "9px 18px", background: (!voiceCloneFile || !voiceCloneName.trim() || cloningVoice) ? "var(--ink3)" : "linear-gradient(135deg,#7c3aed,#a78bfa)", color: (!voiceCloneFile || !voiceCloneName.trim() || cloningVoice) ? "var(--t3)" : "#fff", border: "none", borderRadius: 9, fontSize: 13, fontWeight: 700, cursor: (!voiceCloneFile || !voiceCloneName.trim() || cloningVoice) ? "not-allowed" : "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
                          {cloningVoice ? <><RefreshCw size={14} className="spin" /> Clonando voz en ElevenLabs…</> : "🧬 Clonar esta voz"}
                        </button>
                      </div>
                    </div>
                  )}
                </div>

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

                {/* Posting recommendation */}
                {scriptResult.postingRecommendation && (
                  <div style={{ fontSize: 12, color: "#60a5fa", padding: "8px 12px", background: "rgba(96,165,250,0.08)", borderRadius: 8, border: "1px solid rgba(96,165,250,0.2)" }}>
                    📅 Mejor momento para publicar: <strong>{scriptResult.postingRecommendation}</strong>
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
                    <label style={{ fontSize: 11, color: "var(--t3)", marginBottom: 5, display: "block" }}>Proyecto</label>
                    {satiricoProjects.length > 0 ? (
                      <select value={satiricoProjectId} onChange={e => setSatiricoProjectId(e.target.value)}
                        style={{ width: "100%", background: "var(--ink3)", border: "1px solid var(--ink4)", borderRadius: 8, padding: "8px 12px", color: "var(--t)", fontSize: 13 }}>
                        {satiricoProjects.map(p => (
                          <option key={p.id} value={String(p.id)}>{p.storeName}</option>
                        ))}
                      </select>
                    ) : (
                      <input value={satiricoProjectId} onChange={e => setSatiricoProjectId(e.target.value)}
                        placeholder="ID del proyecto"
                        style={{ width: "100%", background: "var(--ink3)", border: "1px solid var(--ink4)", borderRadius: 8, padding: "8px 12px", color: "var(--t)", fontSize: 13, boxSizing: "border-box" }} />
                    )}
                  </div>
                  <div>
                    <label style={{ fontSize: 11, color: "var(--t3)", marginBottom: 5, display: "block" }}>Modelo de vídeo</label>
                    <select value={satiricoModel} onChange={e => setSatiricoModel(e.target.value)}
                      style={{ width: "100%", background: "var(--ink3)", border: "1px solid var(--ink4)", borderRadius: 8, padding: "8px 12px", color: "var(--t)", fontSize: 13 }}>
                      <optgroup label="⚡ xAI / Grok">
                        <option value="grok-video-1">Grok Video 1 — flagship T2V/I2V, hasta 15s ★★★★★</option>
                        <option value="grok-imagine-video-1.5">Grok Imagine Video 1.5 Preview — max calidad 720p ★★★★★</option>
                        <option value="grok-imagine-video">Grok Imagine Video — T2V/I2V 720p económico ★★★★☆</option>
                      </optgroup>
                      <optgroup label="🏃 Runway">
                        <option value="runway-gen4.5">Runway Gen 4.5 — última gen Jun-2026, 4K + audio ★★★★★</option>
                        <option value="runway-gen4.5-turbo">Runway Gen 4.5 Turbo — rápido 1080p + audio ★★★★★</option>
                        <option value="runway-seedance2">Runway Seedance 2 — cinematográfico ★★★★★</option>
                        <option value="runway-seedance2-fast">Runway Seedance 2 Fast — rápido y barato ★★★★☆</option>
                        <option value="runway-gen4-turbo">Runway Gen 4 Turbo — control fino 5/10s ★★★★★</option>
                      </optgroup>
                      <optgroup label="🔵 Google / Veo">
                        <option value="veo-4">Veo 4 — nueva generación 2026, coherencia máxima ★★★★★</option>
                        <option value="veo-4-fast">Veo 4 Fast — rápido + audio nativo ★★★★★</option>
                        <option value="veo-3.1">Veo 3.1 — última gen + audio nativo (8s) ★★★★★</option>
                        <option value="veo-3.1-fast">Veo 3.1 Fast — rápido + audio ★★★★★</option>
                        <option value="veo-3">Veo 3 — max calidad + audio (8s) ★★★★★</option>
                        <option value="veo-3-fast">Veo 3 Fast — rápido + audio ★★★★★</option>
                        <option value="veo-2">Veo 2 — 9:16/16:9, hasta 8s ★★★★☆</option>
                      </optgroup>
                      <optgroup label="🌀 Kling (Replicate)">
                        <option value="kling-3.0-master">Kling V3.0 Omni — multimodal, audio, hasta 15s ★★★★★</option>
                        <option value="kling-3.0-omni">Kling V3.0 Omni (alias) — refs+audio+style ★★★★★</option>
                        <option value="kling-3.0-turbo">Kling V3.0 Turbo — cinematic T2V+I2V 1080p ★★★★★</option>
                        <option value="kling-v1.6-pro">Kling v1.6 Pro — alta calidad profesional ★★★★★</option>
                        <option value="kling-v1.6-standard">Kling v1.6 Standard — balanceado ★★★★☆</option>
                      </optgroup>
                      <optgroup label="🌱 Seedance (Replicate)">
                        <option value="seedance-1-pro">Seedance 1 Pro — calidad profesional ByteDance ★★★★★</option>
                        <option value="seedance-pro">Seedance Pro — cinema-quality, multi-ref ★★★★★</option>
                        <option value="seedance-fast">Seedance Fast — rápido y barato ★★★★☆</option>
                        <option value="seedance-1-lite">Seedance 1 Lite — económico ★★★☆☆</option>
                      </optgroup>
                      <optgroup label="🌊 Hailuo / MiniMax (Replicate)">
                        <option value="hailuo-2.3">Hailuo 2.3 — última gen, 1080p T2V+I2V ★★★★☆</option>
                        <option value="hailuo-02-master">Hailuo 02 Master — max calidad cinematográfica ★★★★★</option>
                        <option value="hailuo-02">Hailuo 02 — buen balance velocidad/calidad ★★★★☆</option>
                        <option value="hailuo-02-fast">Hailuo 02 Fast — rápido y barato ★★★☆☆</option>
                        <option value="minimax-video-01">MiniMax Video-01 — modelo base MiniMax ★★★★☆</option>
                      </optgroup>
                      <optgroup label="🐉 Wan (Replicate / Open-source)">
                        <option value="wan-2.7">Wan 2.7 — última gen open-source, hasta 1080p 15s ★★★★☆</option>
                        <option value="wan-2.5-t2v-720p">Wan 2.5 T2V 720p — alta calidad solo texto ★★★★☆</option>
                        <option value="wan-2.5-t2v">Wan 2.5 T2V — solo texto open-source ★★★☆☆</option>
                        <option value="wan-2.5">Wan 2.5 — image-to-video open-source ★★★★☆</option>
                        <option value="wan-2.5-i2v-480p">Wan 2.5 I2V 480p — animación imagen rápida ★★★☆☆</option>
                        <option value="wan-2.5-t2v-480p">Wan 2.5 T2V 480p — económico texto ★★★☆☆</option>
                      </optgroup>
                      <optgroup label="🤖 OpenAI (Replicate)">
                        <option value="sora-2">Sora 2 — narrativa cinematográfica, hasta 12s ★★★★★</option>
                      </optgroup>
                    </select>
                  </div>
                  <button onClick={generateViralVideo} disabled={generatingVideo}
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
              <div style={{ fontSize: 13, color: "var(--t2)", marginBottom: 4 }}>Elige un tipo de contenido, introduce tu tema y pulsa Generar</div>
              <div style={{ fontSize: 12 }}>O vete a Tendencias 🔥 y pulsa <strong>Satirizar →</strong> en cualquier noticia</div>
            </div>
          )}
        </div>
      ); })()}

      {/* ══════════════════════════════════════════════════════════════════
          TAB: MODELO IA
          Pipeline: buscar/generar referencia → ElevenLabs Dubbing → face-swap
      ══════════════════════════════════════════════════════════════════ */}
      {tab === "modelo" && (() => {
        const S = { label: { fontSize: 11, color: "var(--t3)", fontWeight: 600, textTransform: "uppercase" as const, letterSpacing: "0.5px", marginBottom: 5, display: "block" } };
        const CONTENT_TYPES = [
          { id: "monologo",    label: "🎤 Monólogo" },
          { id: "ugc",         label: "📱 UGC" },
          { id: "podcast",     label: "🎙️ Podcast" },
          { id: "educativo",   label: "📚 Educativo" },
          { id: "publicitario",label: "📣 Publicitario" },
          { id: "entrevista",  label: "🎬 Entrevista" },
          { id: "testimonio",  label: "⭐ Testimonio" },
          { id: "tutorial",    label: "🛠️ Tutorial" },
        ];
        const isRunning = ["extracting","dubbing","faceswap"].includes(modeloStep);
        const isDone = modeloStep === "done";

        return (
          <div>
            {/* Header */}
            <div style={{ background: "linear-gradient(135deg,rgba(251,191,36,0.08),rgba(16,185,129,0.05))", border: "1px solid rgba(251,191,36,0.2)", borderRadius: 12, padding: "14px 18px", marginBottom: 20 }}>
              <div style={{ fontWeight: 700, fontSize: 14, color: "var(--gold)", marginBottom: 4, display: "flex", alignItems: "center", gap: 6 }}>
                <Clapperboard size={16} /> Modelo IA — Pipeline de vídeo con personaje real
              </div>
              <div style={{ fontSize: 12, color: "var(--t3)", lineHeight: 1.6 }}>
                Busca un vídeo de referencia en YouTube (gestos, ritmo, escenario) → ElevenLabs redubla con tu voz clonada → face-swap opcional con tu foto.<br />
                Funciona para <strong>monólogos, UGC, podcasts, publicidad, tutoriales</strong> — cualquier formato que necesite un modelo hablando.
              </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>

              {/* LEFT COLUMN */}
              <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>

                {/* 1. Content type */}
                <div style={{ background: "var(--ink2)", borderRadius: 10, padding: 14 }}>
                  <span style={S.label}>1. Tipo de contenido</span>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                    {CONTENT_TYPES.map(ct => (
                      <button key={ct.id} onClick={() => setModeloContentType(ct.id)}
                        style={{ padding: "5px 11px", borderRadius: 20, border: "none", cursor: "pointer", fontSize: 12, fontWeight: 600,
                          background: modeloContentType === ct.id ? "var(--gold)" : "var(--ink3)",
                          color: modeloContentType === ct.id ? "#000" : "var(--t3)" }}>
                        {ct.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* 2. Script */}
                <div style={{ background: "var(--ink2)", borderRadius: 10, padding: 14 }}>
                  <span style={S.label}>2. Guión / script</span>
                  <textarea value={modeloScript} onChange={e => setModeloScript(e.target.value)}
                    placeholder={"Escribe el guión que dirá el modelo.\nEjemplo: ¡Buenas noches Sevilla! Oye, que los turistas en la playa de Torremolinos son como los pulpos…"}
                    rows={6}
                    style={{ width: "100%", background: "var(--ink3)", border: "1px solid var(--ink4)", borderRadius: 8, padding: "10px 12px", fontSize: 12, color: "var(--t)", resize: "vertical", lineHeight: 1.6 }} />
                  <div style={{ fontSize: 11, color: "var(--t3)", marginTop: 4 }}>{modeloScript.length} caracteres · ~{Math.round(modeloScript.length / 14)} segundos de audio</div>
                </div>

                {/* 3. Voice */}
                <div style={{ background: "var(--ink2)", borderRadius: 10, padding: 14 }}>
                  <span style={S.label}>3. Voz {modeloLoadingVoices && <RefreshCw size={10} className="spin" style={{ display: "inline", marginLeft: 4 }} />}</span>
                  <select value={modeloVoiceId} onChange={e => setModeloVoiceId(e.target.value)}
                    style={{ width: "100%", background: "var(--ink3)", border: "1px solid var(--ink4)", borderRadius: 8, padding: "8px 10px", fontSize: 12, color: "var(--t)" }}>
                    {modeloVoices.map(v => (
                      <option key={v.voice_id} value={v.voice_id}>
                        {v.name}{v.category === "cloned" ? " ★" : ""}
                      </option>
                    ))}
                  </select>
                  <div style={{ fontSize: 11, color: "var(--t3)", marginTop: 4 }}>★ = voz clonada · ElevenLabs substituirá la voz del vídeo de referencia</div>
                </div>

                {/* 4. Face photo (optional) */}
                <div style={{ background: "var(--ink2)", borderRadius: 10, padding: 14 }}>
                  <span style={S.label}>4. Foto del modelo (opcional — face-swap)</span>
                  <input type="file" accept="image/*" ref={modeloFaceRef} style={{ display: "none" }}
                    onChange={e => {
                      const f = e.target.files?.[0];
                      if (!f) return;
                      setModeloFaceFile(f);
                      const reader = new FileReader();
                      reader.onload = ev => setModeloFacePreview(ev.target?.result as string);
                      reader.readAsDataURL(f);
                    }} />
                  <div onClick={() => modeloFaceRef.current?.click()}
                    style={{ border: `2px dashed ${modeloFaceFile ? "var(--jade)" : "var(--ink4)"}`, borderRadius: 8, padding: 14, cursor: "pointer", textAlign: "center",
                      background: modeloFaceFile ? "rgba(16,185,129,0.05)" : "var(--ink3)", display: "flex", alignItems: "center", gap: 10 }}>
                    {modeloFacePreview
                      ? <img src={modeloFacePreview} style={{ width: 56, height: 56, borderRadius: 8, objectFit: "cover" }} />
                      : <UserSquare size={32} style={{ opacity: 0.25 }} />}
                    <div style={{ textAlign: "left" }}>
                      <div style={{ fontSize: 12, fontWeight: 600, color: modeloFaceFile ? "var(--jade)" : "var(--t)" }}>
                        {modeloFaceFile ? modeloFaceFile.name : "Adjunta tu foto aquí"}
                      </div>
                      <div style={{ fontSize: 11, color: "var(--t3)" }}>
                        {modeloFaceFile ? "Replicate sustituirá la cara del modelo" : "JPG/PNG · tu cara se implantará en el vídeo"}
                      </div>
                    </div>
                    {modeloFaceFile && (
                      <button onClick={e => { e.stopPropagation(); setModeloFaceFile(null); setModeloFacePreview(null); }}
                        style={{ marginLeft: "auto", background: "none", border: "none", cursor: "pointer", color: "var(--t3)" }}>
                        <X size={14} />
                      </button>
                    )}
                  </div>
                </div>
              </div>

              {/* RIGHT COLUMN */}
              <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>

                {/* 5. Reference source */}
                <div style={{ background: "var(--ink2)", borderRadius: 10, padding: 14 }}>
                  <span style={S.label}>5. Vídeo de referencia (gestos y movimientos)</span>
                  <div style={{ display: "flex", gap: 6, marginBottom: 10 }}>
                    {(["search","generate"] as const).map(m => (
                      <button key={m} onClick={() => setModeloRefMode(m)}
                        style={{ flex: 1, padding: "6px 10px", borderRadius: 8, border: "none", cursor: "pointer", fontSize: 12, fontWeight: 600,
                          background: modeloRefMode === m ? "var(--gold)" : "var(--ink3)",
                          color: modeloRefMode === m ? "#000" : "var(--t3)" }}>
                        {m === "search" ? "🔍 Buscar en YouTube" : "🤖 Generar con IA"}
                      </button>
                    ))}
                  </div>

                  {modeloRefMode === "search" ? (
                    <>
                      <form onSubmit={e => { e.preventDefault(); modeloSearchRef(); }} style={{ display: "flex", gap: 6, marginBottom: 10 }}>
                        <input value={modeloRefQuery} onChange={e => setModeloRefQuery(e.target.value)}
                          placeholder="Busca un monologuista, actor, presenter…"
                          style={{ flex: 1, background: "var(--ink3)", border: "1px solid var(--ink4)", borderRadius: 8, padding: "7px 10px", fontSize: 12, color: "var(--t)" }} />
                        <button type="submit" disabled={modeloRefSearching}
                          style={{ padding: "7px 12px", background: "var(--gold)", color: "#000", border: "none", borderRadius: 8, fontWeight: 700, cursor: "pointer", fontSize: 12 }}>
                          {modeloRefSearching ? <RefreshCw size={12} className="spin" /> : <Search size={12} />}
                        </button>
                      </form>

                      {modeloRefResults.map(r => (
                        <div key={r.videoId} onClick={() => setModeloSelectedVideo(r)}
                          style={{ display: "flex", gap: 8, padding: 8, borderRadius: 8, cursor: "pointer", marginBottom: 4, border: `1px solid ${modeloSelectedVideo?.videoId === r.videoId ? "var(--gold)" : "transparent"}`,
                            background: modeloSelectedVideo?.videoId === r.videoId ? "rgba(251,191,36,0.08)" : "var(--ink3)" }}>
                          {r.thumbnail && <img src={r.thumbnail} style={{ width: 72, height: 50, objectFit: "cover", borderRadius: 4, flexShrink: 0 }} />}
                          <div style={{ minWidth: 0 }}>
                            <div style={{ fontSize: 11, fontWeight: 600, color: modeloSelectedVideo?.videoId === r.videoId ? "var(--gold)" : "var(--t)", lineClamp: 2, overflow: "hidden" }}>{r.title}</div>
                            <div style={{ fontSize: 10, color: "var(--t3)" }}>{r.channelTitle}</div>
                          </div>
                          {modeloSelectedVideo?.videoId === r.videoId && <CheckCircle size={14} style={{ marginLeft: "auto", flexShrink: 0, color: "var(--gold)" }} />}
                        </div>
                      ))}

                      {modeloSelectedVideo && (
                        <div style={{ marginTop: 10, padding: 10, background: "rgba(251,191,36,0.06)", borderRadius: 8, border: "1px solid rgba(251,191,36,0.2)" }}>
                          <div style={{ fontSize: 11, color: "var(--gold)", fontWeight: 600, marginBottom: 6 }}>⏱ Segmento a extraer</div>
                          <div style={{ display: "flex", gap: 8 }}>
                            <div style={{ flex: 1 }}>
                              <label style={{ fontSize: 10, color: "var(--t3)" }}>Inicio (seg)</label>
                              <input type="number" value={modeloStartSec} onChange={e => setModeloStartSec(Number(e.target.value))} min={0}
                                style={{ width: "100%", background: "var(--ink3)", border: "1px solid var(--ink4)", borderRadius: 6, padding: "5px 8px", fontSize: 12, color: "var(--t)" }} />
                            </div>
                            <div style={{ flex: 1 }}>
                              <label style={{ fontSize: 10, color: "var(--t3)" }}>Duración (seg)</label>
                              <input type="number" value={modeloDurSec} onChange={e => setModeloDurSec(Number(e.target.value))} min={5} max={120}
                                style={{ width: "100%", background: "var(--ink3)", border: "1px solid var(--ink4)", borderRadius: 6, padding: "5px 8px", fontSize: 12, color: "var(--t)" }} />
                            </div>
                          </div>
                        </div>
                      )}
                    </>
                  ) : (
                    <div>
                      <textarea value={modeloGenPrompt} onChange={e => setModeloGenPrompt(e.target.value)}
                        placeholder={`Prompt para Kling (se auto-rellena según tipo).\nEj: A charismatic Spanish comedian on a comedy club stage, gesturing with hands…`}
                        rows={4}
                        style={{ width: "100%", background: "var(--ink3)", border: "1px solid var(--ink4)", borderRadius: 8, padding: "10px 12px", fontSize: 12, color: "var(--t)", resize: "vertical" }} />
                      <div style={{ fontSize: 11, color: "var(--t3)", marginTop: 4 }}>Se generará un vídeo de ~5s con Kling v2.1 que usarás como referencia de movimientos</div>
                    </div>
                  )}
                </div>

                {/* Pipeline status / log */}
                {(modeloStep !== "idle" || modeloLog.length > 0) && (
                  <div style={{ background: "var(--ink2)", borderRadius: 10, padding: 14 }}>
                    <div style={{ fontWeight: 700, fontSize: 12, color: "var(--t)", marginBottom: 8, display: "flex", alignItems: "center", gap: 6 }}>
                      <Clapperboard size={13} />
                      {modeloStep === "extracting" && <><RefreshCw size={12} className="spin" /> Descargando referencia…</>}
                      {modeloStep === "dubbing"    && <><RefreshCw size={12} className="spin" /> ElevenLabs doblando vídeo… (puede tardar 2-3 min)</>}
                      {modeloStep === "faceswap"   && <><RefreshCw size={12} className="spin" /> Aplicando face-swap…</>}
                      {modeloStep === "done"       && <><CheckCircle size={12} style={{ color: "var(--jade)" }} /> ¡Pipeline completado!</>}
                      {modeloStep === "error"      && <><AlertCircle size={12} style={{ color: "#ef4444" }} /> Error</>}
                    </div>
                    <div style={{ fontFamily: "monospace", fontSize: 10, color: "var(--t3)", maxHeight: 120, overflowY: "auto", lineHeight: 1.8 }}>
                      {modeloLog.map((l, i) => <div key={i}>{l}</div>)}
                    </div>
                    {modeloError && (
                      <div style={{ marginTop: 8, padding: "8px 10px", background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.25)", borderRadius: 8, fontSize: 11, color: "#fca5a5" }}>
                        {modeloError}
                      </div>
                    )}
                  </div>
                )}

                {/* Result */}
                {isDone && (modeloFinalUrl || modeloDubbedB64) && (
                  <div style={{ background: "rgba(16,185,129,0.06)", border: "1px solid var(--jade)", borderRadius: 12, padding: 14 }}>
                    <div style={{ fontWeight: 700, color: "var(--jade)", marginBottom: 10, display: "flex", alignItems: "center", gap: 6 }}>
                      <CheckCircle size={14} /> Vídeo listo
                    </div>
                    {modeloFinalUrl && (
                      <video src={modeloFinalUrl} controls style={{ width: "100%", borderRadius: 8, marginBottom: 10 }} />
                    )}
                    <div style={{ display: "flex", gap: 8 }}>
                      <button onClick={modeloDownload}
                        style={{ flex: 1, padding: "9px 14px", background: "linear-gradient(135deg,var(--gold),#f59e0b)", color: "#000", border: "none", borderRadius: 8, fontWeight: 700, cursor: "pointer", fontSize: 12, display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
                        <Download size={13} /> Descargar MP4
                      </button>
                      {channel.connected && (
                        <button onClick={() => setTab("upload")}
                          style={{ flex: 1, padding: "9px 14px", background: "transparent", color: "var(--jade)", border: "1px solid var(--jade)", borderRadius: 8, fontWeight: 700, cursor: "pointer", fontSize: 12, display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
                          <Youtube size={13} /> Subir a YouTube
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* RUN BUTTON */}
            <div style={{ marginTop: 16 }}>
              {modeloError && <div style={{ marginBottom: 10, fontSize: 12, color: "#f87171", padding: "8px 12px", background: "rgba(239,68,68,0.08)", borderRadius: 8 }}>{modeloError}</div>}
              <button onClick={modeloRunPipeline} disabled={isRunning}
                style={{ width: "100%", padding: "14px 20px", background: isRunning ? "var(--ink3)" : "linear-gradient(135deg,var(--gold),#f59e0b)", color: isRunning ? "var(--t3)" : "#000",
                  border: "none", borderRadius: 10, fontWeight: 800, cursor: isRunning ? "not-allowed" : "pointer", fontSize: 14, display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
                {isRunning
                  ? <><RefreshCw size={16} className="spin" />
                    {modeloStep === "extracting" ? "Descargando referencia…" : modeloStep === "dubbing" ? "Doblando con ElevenLabs…" : "Aplicando face-swap…"}
                    </>
                  : <><Clapperboard size={16} /> Generar vídeo con modelo</>}
              </button>
              <div style={{ marginTop: 8, fontSize: 11, color: "var(--t3)", textAlign: "center" }}>
                Paso 1: Extrae referencia (~30s) · Paso 2: ElevenLabs Dubbing (~2-3 min) · Paso 3: Face-swap opcional (~1 min)
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}
