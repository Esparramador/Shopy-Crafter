/**
 * VideoStudio — Editor de vídeo profesional multi-pista
 * Final Cut Pro / CapCut / Canva style
 * Integrado con toda la IA de Shopy Crafter
 */
import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { Loader2, Film, Mic, Music, Type, Sparkles, Download, Play, Pause, SkipBack, SkipForward, Volume2, VolumeX, Scissors, Trash2, Plus, ChevronDown, ChevronRight, Zap, RefreshCw, X, Settings, Monitor, Smartphone, Square, Upload, Eye, EyeOff, Lock, Unlock } from "lucide-react";

const API_BASE = import.meta.env.BASE_URL?.replace(/\/$/, "") ?? "";

// ─── Types ───────────────────────────────────────────────────────────────────
type TrackType = "video" | "audio" | "text";
type ClipType = "video" | "audio" | "text" | "image";
type AspectRatio = "9:16" | "16:9" | "1:1" | "4:5";

interface TextProps {
  content: string;
  fontSize: number;
  color: string;
  bgColor: string;
  position: "top" | "center" | "bottom";
  bold: boolean;
  italic: boolean;
}

interface ClipItem {
  id: string;
  trackId: string;
  type: ClipType;
  name: string;
  file?: File;
  blobUrl?: string;
  aiUrl?: string;
  durationSec: number;
  startSec: number;
  trimStart: number;
  trimEnd: number;
  volume: number;
  speed: number;
  muted: boolean;
  effect?: string;
  textProps?: TextProps;
  aiGenerated?: boolean;
  thumbnail?: string;
}

interface Track {
  id: string;
  type: TrackType;
  label: string;
  color: string;
  muted: boolean;
  locked: boolean;
}

interface FormatPreset {
  id: string;
  label: string;
  aspect: AspectRatio;
  icon: string;
  w: number;
  h: number;
  maxDuration: number;
  platform: string;
}

interface AIGenerating {
  type: "clip" | "voice" | "music";
  prompt: string;
  busy: boolean;
}

// ─── Constants ────────────────────────────────────────────────────────────────
const PX_PER_SEC = 60;
const TRACK_HEIGHT = 48;
const RULER_HEIGHT = 28;
const LABEL_WIDTH = 110;

const DEFAULT_TRACKS: Track[] = [
  { id: "video1", type: "video", label: "Video 1", color: "#4fa3e2", muted: false, locked: false },
  { id: "video2", type: "video", label: "Video 2", color: "#7e6dd6", muted: false, locked: false },
  { id: "text1", type: "text", label: "Texto", color: "#c8a84b", muted: false, locked: false },
  { id: "voice", type: "audio", label: "Voz over", color: "#e2664f", muted: false, locked: false },
  { id: "music", type: "audio", label: "Música", color: "#7fb38a", muted: false, locked: false },
];

const FORMAT_PRESETS: FormatPreset[] = [
  { id: "shorts",  label: "YT Shorts", aspect: "9:16", icon: "📱", w: 1080, h: 1920, maxDuration: 60,  platform: "YouTube" },
  { id: "reels",   label: "Reels",     aspect: "9:16", icon: "🎬", w: 1080, h: 1920, maxDuration: 90,  platform: "Instagram" },
  { id: "tiktok",  label: "TikTok",    aspect: "9:16", icon: "🎵", w: 1080, h: 1920, maxDuration: 180, platform: "TikTok" },
  { id: "youtube", label: "YouTube",   aspect: "16:9", icon: "🖥️", w: 1920, h: 1080, maxDuration: 600, platform: "YouTube" },
  { id: "square",  label: "Feed",      aspect: "1:1",  icon: "⬜", w: 1080, h: 1080, maxDuration: 60,  platform: "Instagram" },
  { id: "story",   label: "Story",     aspect: "9:16", icon: "📸", w: 1080, h: 1920, maxDuration: 15,  platform: "Instagram" },
];

const VIDEO_FX = ["Ninguno", "Blur suave", "Vignette", "Grain cinematográfico", "Color cine", "Vintage", "Neon glow", "B&W", "Sepia", "Saturado", "High contrast", "HDR look"];

const TRANSITION_FX = ["Ninguno", "Crossfade", "Fade negro", "Deslizar izq.", "Deslizar der.", "Zoom in", "Zoom out", "Wipe", "Dissolve", "Flash"];

const TEXT_PRESETS = [
  { label: "Título Grande", fontSize: 56, bold: true, position: "center" as const },
  { label: "Subtítulo", fontSize: 36, bold: false, position: "bottom" as const },
  { label: "Caption social", fontSize: 28, bold: false, position: "bottom" as const },
  { label: "CTA (llamada a acción)", fontSize: 42, bold: true, position: "bottom" as const },
  { label: "Lower third", fontSize: 26, bold: false, position: "bottom" as const },
];

// ─── Utilities ────────────────────────────────────────────────────────────────
function uid() { return Math.random().toString(36).slice(2, 9); }
function fmtTime(sec: number): string {
  const m = Math.floor(sec / 60).toString().padStart(2, "0");
  const s = Math.floor(sec % 60).toString().padStart(2, "0");
  return `${m}:${s}`;
}
function getVideoDuration(file: File): Promise<number> {
  return new Promise((resolve) => {
    const v = document.createElement("video");
    v.preload = "metadata";
    const url = URL.createObjectURL(file);
    v.onloadedmetadata = () => { URL.revokeObjectURL(url); resolve(v.duration || 5); };
    v.onerror = () => { URL.revokeObjectURL(url); resolve(5); };
    v.src = url;
  });
}
async function getVideoThumbnail(file: File): Promise<string> {
  return new Promise((resolve) => {
    const v = document.createElement("video");
    v.preload = "metadata";
    const url = URL.createObjectURL(file);
    v.onloadeddata = () => {
      v.currentTime = 0.1;
    };
    v.onseeked = () => {
      const canvas = document.createElement("canvas");
      canvas.width = 120; canvas.height = 68;
      const ctx = canvas.getContext("2d");
      if (ctx) ctx.drawImage(v, 0, 0, 120, 68);
      URL.revokeObjectURL(url);
      resolve(canvas.toDataURL("image/jpeg", 0.6));
    };
    v.onerror = () => { URL.revokeObjectURL(url); resolve(""); };
    v.src = url;
  });
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const S = {
  root: { display: "flex", flexDirection: "column" as const, height: "calc(100vh - 120px)", minHeight: 640, background: "#0d0d14", color: "#fff", fontFamily: "inherit", borderRadius: 12, overflow: "hidden", border: "1px solid #22222e" },
  topBar: { display: "flex", alignItems: "center", gap: 8, padding: "8px 12px", background: "#13131e", borderBottom: "1px solid #22222e", flexShrink: 0 },
  workArea: { display: "flex", flex: 1, overflow: "hidden", minHeight: 0 },
  sidebar: { width: 200, flexShrink: 0, background: "#10101a", borderRight: "1px solid #22222e", display: "flex", flexDirection: "column" as const, overflow: "hidden" },
  previewArea: { flex: 1, display: "flex", flexDirection: "column" as const, alignItems: "center", justifyContent: "center", background: "#080810", position: "relative" as const, overflow: "hidden" },
  inspector: { width: 240, flexShrink: 0, background: "#10101a", borderLeft: "1px solid #22222e", display: "flex", flexDirection: "column" as const, overflow: "hidden" },
  timelinePanel: { height: 220, flexShrink: 0, background: "#0a0a12", borderTop: "1px solid #22222e", display: "flex", flexDirection: "column" as const },
  sectionHead: { padding: "8px 10px", fontSize: 10, fontWeight: 700, letterSpacing: 1, color: "#6c6c7c", textTransform: "uppercase" as const, borderBottom: "1px solid #1a1a24" },
  btn: { background: "none", border: "1px solid #22222e", borderRadius: 6, color: "#aaa", cursor: "pointer", padding: "4px 8px", fontSize: 12, display: "flex", alignItems: "center", gap: 4 },
  btnGold: { background: "linear-gradient(135deg,#c8a84b,#e0c070)", border: "none", borderRadius: 6, color: "#0a0a12", cursor: "pointer", padding: "6px 14px", fontSize: 12, fontWeight: 700, display: "flex", alignItems: "center", gap: 6 },
  btnDanger: { background: "rgba(220,50,50,0.15)", border: "1px solid rgba(220,50,50,0.3)", borderRadius: 6, color: "#e06060", cursor: "pointer", padding: "4px 8px", fontSize: 12, display: "flex", alignItems: "center", gap: 4 },
  tag: { padding: "2px 6px", borderRadius: 4, fontSize: 9, fontWeight: 700, letterSpacing: 0.5 },
  input: { width: "100%", background: "#14141d", border: "1px solid #22222e", borderRadius: 6, color: "#fff", padding: "6px 8px", fontSize: 12, fontFamily: "inherit", boxSizing: "border-box" as const },
};

// ─── Sub-components ───────────────────────────────────────────────────────────

function SidebarSection({ title, children, collapsible }: { title: string; children: React.ReactNode; collapsible?: boolean }) {
  const [open, setOpen] = useState(true);
  return (
    <div style={{ borderBottom: "1px solid #1a1a24" }}>
      <div onClick={() => collapsible && setOpen(o => !o)} style={{ ...S.sectionHead, cursor: collapsible ? "pointer" : "default", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span>{title}</span>
        {collapsible && (open ? <ChevronDown size={10} /> : <ChevronRight size={10} />)}
      </div>
      {open && <div style={{ padding: "8px 10px" }}>{children}</div>}
    </div>
  );
}

function InspectorLabel({ label }: { label: string }) {
  return <div style={{ fontSize: 10, color: "#6c6c7c", fontWeight: 600, letterSpacing: 0.5, marginBottom: 3, marginTop: 8, textTransform: "uppercase" as const }}>{label}</div>;
}

function Slider({ label, value, min, max, step, onChange, unit }: { label: string; value: number; min: number; max: number; step: number; onChange: (v: number) => void; unit?: string }) {
  return (
    <div style={{ marginBottom: 6 }}>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10, color: "#6c6c7c", marginBottom: 2 }}>
        <span>{label}</span><span style={{ color: "#c8a84b" }}>{value.toFixed(step < 0.1 ? 2 : 1)}{unit}</span>
      </div>
      <input type="range" min={min} max={max} step={step} value={value} onChange={e => onChange(parseFloat(e.target.value))} style={{ width: "100%", accentColor: "#c8a84b" }} />
    </div>
  );
}

// ─── Timeline Ruler ──────────────────────────────────────────────────────────
function TimelineRuler({ totalSec, scale }: { totalSec: number; scale: number }) {
  const ticks = [];
  const step = scale < 40 ? 5 : scale < 80 ? 2 : 1;
  for (let s = 0; s <= totalSec + step; s += step) {
    ticks.push(
      <div key={s} style={{ position: "absolute", left: s * scale, top: 0, display: "flex", flexDirection: "column", alignItems: "flex-start" }}>
        <div style={{ width: 1, height: s % (step * 5) === 0 ? 10 : 5, background: s % (step * 5) === 0 ? "#44445a" : "#2a2a38" }} />
        {s % (step * 5) === 0 && <span style={{ fontSize: 9, color: "#44445a", marginTop: 1, whiteSpace: "nowrap", userSelect: "none" }}>{fmtTime(s)}</span>}
      </div>
    );
  }
  return (
    <div style={{ position: "relative", height: RULER_HEIGHT, background: "#0a0a12", borderBottom: "1px solid #1a1a24", flexShrink: 0, overflow: "hidden" }}>
      {ticks}
    </div>
  );
}

// ─── Single Clip on Timeline ─────────────────────────────────────────────────
function TimelineClip({
  clip, scale, selected, onSelect, onDelete, onDragEnd,
}: {
  clip: ClipItem; scale: number; selected: boolean; onSelect: () => void;
  onDelete: () => void; onDragEnd: (newStartSec: number) => void;
}) {
  const dragRef = useRef<{ startX: number; origStart: number } | null>(null);
  const [dragging, setDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState(0);

  const effectiveDuration = (clip.trimEnd - clip.trimStart) * clip.durationSec || clip.durationSec;
  const width = Math.max(8, effectiveDuration * scale);
  const left = clip.startSec * scale;

  const handleMouseDown = (e: React.MouseEvent) => {
    e.stopPropagation();
    onSelect();
    dragRef.current = { startX: e.clientX, origStart: clip.startSec };
    setDragging(true);

    const onMove = (ev: MouseEvent) => {
      if (!dragRef.current) return;
      const dx = ev.clientX - dragRef.current.startX;
      setDragOffset(dx);
    };
    const onUp = (ev: MouseEvent) => {
      if (!dragRef.current) return;
      const dx = ev.clientX - dragRef.current.startX;
      const newStart = Math.max(0, dragRef.current.origStart + dx / scale);
      onDragEnd(newStart);
      dragRef.current = null;
      setDragging(false);
      setDragOffset(0);
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  };

  const typeEmoji = clip.type === "video" ? "🎬" : clip.type === "audio" ? "🔊" : clip.type === "text" ? "✏️" : "🖼️";
  const bgColor = clip.type === "video" ? "#1a3d5a" : clip.type === "audio" ? "#2a1a1a" : clip.type === "text" ? "#2a2a10" : "#1a2a1a";
  const borderColor = selected ? "#c8a84b" : (clip.type === "video" ? "#4fa3e2" : clip.type === "audio" ? "#e2664f" : "#c8a84b");

  return (
    <div
      onMouseDown={handleMouseDown}
      style={{
        position: "absolute",
        left: left + (dragging ? dragOffset : 0),
        top: 4,
        width,
        height: TRACK_HEIGHT - 8,
        background: bgColor,
        border: `1.5px solid ${borderColor}`,
        borderRadius: 4,
        cursor: dragging ? "grabbing" : "grab",
        overflow: "hidden",
        display: "flex",
        alignItems: "center",
        padding: "0 6px",
        gap: 4,
        opacity: clip.muted ? 0.5 : 1,
        boxShadow: selected ? `0 0 0 2px ${borderColor}44` : "none",
        userSelect: "none",
        zIndex: dragging ? 100 : (selected ? 10 : 1),
        transition: dragging ? "none" : "box-shadow 0.15s",
      }}
    >
      {clip.thumbnail && (
        <img src={clip.thumbnail} alt="" style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", opacity: 0.25, borderRadius: 3 }} />
      )}
      <span style={{ fontSize: 10, zIndex: 1, flexShrink: 0 }}>{typeEmoji}</span>
      <span style={{ fontSize: 9, color: "#ddd", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", zIndex: 1, flex: 1 }}>
        {clip.textProps?.content || clip.name}
      </span>
      {clip.aiGenerated && <span style={{ ...S.tag, background: "rgba(200,168,75,0.25)", color: "#c8a84b", zIndex: 1 }}>IA</span>}
      {selected && (
        <button onMouseDown={e => { e.stopPropagation(); onDelete(); }}
          style={{ position: "absolute", top: 2, right: 2, background: "rgba(200,50,50,0.7)", border: "none", borderRadius: 3, color: "#fff", cursor: "pointer", padding: "1px 3px", fontSize: 9, zIndex: 20 }}>×</button>
      )}
    </div>
  );
}

// ─── Main VideoStudio Component ───────────────────────────────────────────────
export default function VideoStudio({
  projectId, onSuccess, onError,
}: {
  projectId: number;
  onSuccess: (it: { vaultId: number; type: string; label: string; mimeType: string }) => void;
  onError: (m: string) => void;
}) {
  // ── State
  const [tracks]    = useState<Track[]>(DEFAULT_TRACKS);
  const [clips, setClips] = useState<ClipItem[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [currentSec, setCurrentSec] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [format, setFormat] = useState<FormatPreset>(FORMAT_PRESETS[0]);
  const [scale, setScale] = useState(PX_PER_SEC);
  const [busy, setBusy] = useState(false);
  const [exportModal, setExportModal] = useState(false);
  const [aiPanel, setAiPanel] = useState<"generate" | "voice" | "music" | "templates" | null>(null);
  const [aiPrompt, setAiPrompt] = useState("");
  const [aiModel, setAiModel] = useState("seedance-fast");
  const [aiVoice, setAiVoice] = useState("EXAVITQu4vr4xnSDxMaL");
  const [aiText, setAiText] = useState("");
  const [aiBusy, setAiBusy] = useState(false);
  const [exportTitle, setExportTitle] = useState("Mi video");
  const [exportCrossfade, setExportCrossfade] = useState(0.4);
  const [exportBusy, setExportBusy] = useState(false);
  const [liveMsg, setLiveMsg] = useState("");
  const [resultUrl, setResultUrl] = useState("");
  const [trackMuted, setTrackMuted] = useState<Record<string, boolean>>({});
  const [trackLocked, setTrackLocked] = useState<Record<string, boolean>>({});
  const [expandedSidebar, setExpandedSidebar] = useState<"media" | "ai" | "formats">("media");
  const [sfxCatalog, setSfxCatalog] = useState<any[]>([]);
  const [showSfx, setShowSfx] = useState(false);

  const videoRef = useRef<HTMLVideoElement>(null);
  const timelineScrollRef = useRef<HTMLDivElement>(null);
  const playIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // ── Derived
  const selectedClip = useMemo(() => clips.find(c => c.id === selectedId) || null, [clips, selectedId]);
  const totalDuration = useMemo(() => {
    if (clips.length === 0) return 30;
    return Math.max(30, ...clips.map(c => c.startSec + c.durationSec));
  }, [clips]);
  const videoClipsInOrder = useMemo(() =>
    clips.filter(c => c.type === "video" && (c.trackId === "video1" || c.trackId === "video2"))
      .sort((a, b) => a.startSec - b.startSec),
    [clips]);

  // ── Playback simulation
  useEffect(() => {
    if (isPlaying) {
      playIntervalRef.current = setInterval(() => {
        setCurrentSec(s => {
          if (s >= totalDuration) { setIsPlaying(false); return 0; }
          return s + 0.1;
        });
      }, 100);
    } else {
      if (playIntervalRef.current) clearInterval(playIntervalRef.current);
    }
    return () => { if (playIntervalRef.current) clearInterval(playIntervalRef.current); };
  }, [isPlaying, totalDuration]);

  // Update video preview when scrubber moves
  useEffect(() => {
    const activeClip = videoClipsInOrder.find(c => currentSec >= c.startSec && currentSec < c.startSec + c.durationSec);
    if (activeClip && videoRef.current) {
      const relT = currentSec - activeClip.startSec;
      const src = activeClip.blobUrl || activeClip.aiUrl || "";
      if (videoRef.current.src !== src && src) {
        videoRef.current.src = src;
        videoRef.current.load();
      }
      if (Math.abs(videoRef.current.currentTime - relT) > 0.3) {
        videoRef.current.currentTime = relT;
      }
      if (isPlaying && videoRef.current.paused) videoRef.current.play().catch(() => {});
      if (!isPlaying && !videoRef.current.paused) videoRef.current.pause();
    }
  }, [currentSec, isPlaying, videoClipsInOrder]);

  // ── Clip operations
  const updateClip = useCallback((id: string, update: Partial<ClipItem>) => {
    setClips(prev => prev.map(c => c.id === id ? { ...c, ...update } : c));
  }, []);

  const deleteClip = useCallback((id: string) => {
    setClips(prev => prev.filter(c => c.id !== id));
    setSelectedId(s => s === id ? null : s);
  }, []);

  const addMediaFiles = useCallback(async (files: FileList | null, trackId = "video1") => {
    if (!files) return;
    const arr = Array.from(files);
    for (const file of arr) {
      const isVideo = file.type.startsWith("video/");
      const isAudio = file.type.startsWith("audio/");
      const isImage = file.type.startsWith("image/");
      if (!isVideo && !isAudio && !isImage) continue;

      const type: ClipType = isVideo ? "video" : isAudio ? "audio" : "image";
      const blobUrl = URL.createObjectURL(file);
      let duration = 5;
      let thumbnail = "";

      if (isVideo) {
        duration = await getVideoDuration(file);
        thumbnail = await getVideoThumbnail(file);
      } else if (isAudio) {
        duration = await new Promise<number>(res => {
          const a = document.createElement("audio");
          a.preload = "metadata";
          a.onloadedmetadata = () => res(a.duration || 30);
          a.onerror = () => res(30);
          a.src = blobUrl;
        });
        trackId = file.name.toLowerCase().includes("music") ? "music" : "voice";
      }

      const lastClipEnd = Math.max(0, ...clips.filter(c => c.trackId === trackId).map(c => c.startSec + c.durationSec));

      const clip: ClipItem = {
        id: uid(), trackId, type, name: file.name, file, blobUrl, duration,
        durationSec: duration, startSec: lastClipEnd,
        trimStart: 0, trimEnd: 1, volume: 1, speed: 1, muted: false, thumbnail,
      };
      setClips(prev => [...prev, clip]);
    }
  }, [clips]);

  const addTextClip = useCallback((preset: typeof TEXT_PRESETS[0]) => {
    const lastClipEnd = Math.max(0, ...clips.filter(c => c.trackId === "text1").map(c => c.startSec + c.durationSec));
    const clip: ClipItem = {
      id: uid(), trackId: "text1", type: "text", name: "Texto",
      durationSec: 5, startSec: lastClipEnd, trimStart: 0, trimEnd: 1,
      volume: 0, speed: 1, muted: false,
      textProps: {
        content: preset.label,
        fontSize: preset.fontSize,
        color: "#ffffff",
        bgColor: "rgba(0,0,0,0.5)",
        position: preset.position,
        bold: preset.bold,
        italic: false,
      },
    };
    setClips(prev => [...prev, clip]);
    setSelectedId(clip.id);
  }, [clips]);

  // ── AI Generate Clip
  const aiGenerateClip = useCallback(async () => {
    if (!aiPrompt.trim()) { onError("Escribe un prompt para generar el clip"); return; }
    setAiBusy(true);
    setLiveMsg("Generando clip de video con IA...");
    try {
      const fd = new FormData();
      fd.append("projectId", String(projectId));
      fd.append("prompt", aiPrompt);
      fd.append("model", aiModel);
      fd.append("aspect", format.aspect);
      const res = await fetch(`${API_BASE}/api/fs-pro/generate-video`, { method: "POST", credentials: "include", body: fd });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || `Error ${res.status}`);
      const url = d.url || `${API_BASE}/api/projects/${projectId}/vault/${d.vaultId}/download`;
      const lastEnd = Math.max(0, ...clips.filter(c => c.trackId === "video1").map(c => c.startSec + c.durationSec));
      const clip: ClipItem = {
        id: uid(), trackId: "video1", type: "video", name: `IA: ${aiPrompt.slice(0, 30)}`,
        aiUrl: url, durationSec: 6, startSec: lastEnd,
        trimStart: 0, trimEnd: 1, volume: 1, speed: 1, muted: false, aiGenerated: true,
      };
      setClips(prev => [...prev, clip]);
      setAiPanel(null);
      setLiveMsg("");
    } catch (e: any) { onError(e.message); } finally { setAiBusy(false); setLiveMsg(""); }
  }, [aiPrompt, aiModel, format, projectId, clips, onError]);

  const aiGenerateVoice = useCallback(async () => {
    if (!aiText.trim()) { onError("Escribe el texto para narrar"); return; }
    setAiBusy(true);
    setLiveMsg("Generando narración con IA...");
    try {
      const res = await fetch(`${API_BASE}/api/fs-pro/tts/advanced`, {
        method: "POST", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: aiText, voiceId: aiVoice, model: "eleven_v3", stability: 0.5, style: 0.5, projectId }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || `Error ${res.status}`);
      const url = d.url || `${API_BASE}/api/projects/${projectId}/vault/${d.vaultId}/download`;
      const resp2 = await fetch(url, { credentials: "include" });
      const blob = await resp2.blob();
      const blobUrl = URL.createObjectURL(blob);
      const audioEl = document.createElement("audio");
      audioEl.preload = "metadata";
      const dur = await new Promise<number>(res2 => {
        audioEl.onloadedmetadata = () => res2(audioEl.duration || 10);
        audioEl.onerror = () => res2(10);
        audioEl.src = blobUrl;
      });
      const lastEnd = Math.max(0, ...clips.filter(c => c.trackId === "voice").map(c => c.startSec + c.durationSec));
      const clip: ClipItem = {
        id: uid(), trackId: "voice", type: "audio", name: `Voz: ${aiText.slice(0, 25)}`,
        aiUrl: url, blobUrl, durationSec: dur, startSec: lastEnd,
        trimStart: 0, trimEnd: 1, volume: 1, speed: 1, muted: false, aiGenerated: true,
      };
      setClips(prev => [...prev, clip]);
      setAiPanel(null); setLiveMsg("");
    } catch (e: any) { onError(e.message); } finally { setAiBusy(false); setLiveMsg(""); }
  }, [aiText, aiVoice, projectId, clips, onError]);

  const aiGenerateMusic = useCallback(async () => {
    if (!aiPrompt.trim()) { onError("Escribe un prompt para la música"); return; }
    setAiBusy(true);
    setLiveMsg("Componiendo música con IA...");
    try {
      const fd = new FormData();
      fd.append("projectId", String(projectId));
      fd.append("prompt", aiPrompt);
      fd.append("duration", "30");
      const res = await fetch(`${API_BASE}/api/fs-pro/generate-music`, { method: "POST", credentials: "include", body: fd });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || `Error ${res.status}`);
      const url = d.url || `${API_BASE}/api/projects/${projectId}/vault/${d.vaultId}/download`;
      const lastEnd = Math.max(0, ...clips.filter(c => c.trackId === "music").map(c => c.startSec + c.durationSec));
      const clip: ClipItem = {
        id: uid(), trackId: "music", type: "audio", name: `Música: ${aiPrompt.slice(0, 25)}`,
        aiUrl: url, durationSec: 30, startSec: lastEnd,
        trimStart: 0, trimEnd: 1, volume: 0.25, speed: 1, muted: false, aiGenerated: true,
      };
      setClips(prev => [...prev, clip]);
      setAiPanel(null); setLiveMsg("");
    } catch (e: any) { onError(e.message); } finally { setAiBusy(false); setLiveMsg(""); }
  }, [aiPrompt, projectId, clips, onError]);

  // ── Load SFX catalog
  const loadSfxCatalog = useCallback(async () => {
    if (sfxCatalog.length > 0) { setShowSfx(true); return; }
    try {
      const res = await fetch(`${API_BASE}/api/fs-pro/audio/sfx-catalog`);
      const d = await res.json();
      setSfxCatalog(d.catalog || d || []);
      setShowSfx(true);
    } catch { setSfxCatalog([]); setShowSfx(true); }
  }, [sfxCatalog]);

  // ── Export
  const doExport = useCallback(async () => {
    const videoFiles = videoClipsInOrder.filter(c => c.file);
    if (videoFiles.length === 0) { onError("Añade al menos 1 clip de video para exportar"); return; }
    setExportBusy(true);
    const msgs = [
      "Validando clips y codecs…",
      "Aplicando crossfades y transiciones…",
      "Procesando pistas de audio…",
      "Codificando MP4 final en alta calidad…",
      "Guardando en bóveda del proyecto…",
    ];
    let mi = 0;
    setLiveMsg(msgs[0]);
    const msgInterval = setInterval(() => {
      mi = Math.min(mi + 1, msgs.length - 1);
      setLiveMsg(msgs[mi]);
    }, 6000);

    try {
      const fd = new FormData();
      fd.append("projectId", String(projectId));
      fd.append("title", exportTitle);
      fd.append("crossfadeSec", String(exportCrossfade));

      videoFiles.forEach(c => { if (c.file) fd.append("clips", c.file); });

      const voiceClips = clips.filter(c => c.trackId === "voice" && c.file);
      const musicClips = clips.filter(c => c.trackId === "music" && c.file);
      if (voiceClips.length > 0 && voiceClips[0].file) fd.append("voice", voiceClips[0].file);
      if (musicClips.length > 0 && musicClips[0].file) fd.append("music", musicClips[0].file);
      fd.append("voiceVolume", "1.0");
      fd.append("musicVolume", "0.25");

      const res = await fetch(`${API_BASE}/api/fs-pro/concat-uploaded`, { method: "POST", credentials: "include", body: fd });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || `Error ${res.status}`);
      const url = `${API_BASE}/api/projects/${projectId}/vault/${d.vaultId}/download`;
      setResultUrl(url);
      onSuccess({ vaultId: d.vaultId, type: "video", label: exportTitle, mimeType: "video/mp4" });
      setExportModal(false);
    } catch (e: any) { onError(e.message); } finally {
      clearInterval(msgInterval);
      setExportBusy(false); setLiveMsg("");
    }
  }, [videoClipsInOrder, clips, projectId, exportTitle, exportCrossfade, onSuccess, onError]);

  // ── Timeline scrubber click
  const handleTimelineClick = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left + (timelineScrollRef.current?.scrollLeft || 0) - LABEL_WIDTH;
    const sec = Math.max(0, x / scale);
    setCurrentSec(sec);
    setIsPlaying(false);
  }, [scale]);

  // ─── Preview aspect ratio CSS
  const previewStyle = useMemo(() => {
    const [wr, hr] = format.aspect.split(":").map(Number);
    const maxH = 320;
    const maxW = 480;
    let h = maxH, w = (maxH * wr) / hr;
    if (w > maxW) { w = maxW; h = (maxW * hr) / wr; }
    return { width: w, height: h };
  }, [format]);

  // ─── Social media template quick-apply
  const applyTemplate = useCallback((templateId: string) => {
    const tmpl = FORMAT_PRESETS.find(p => p.id === templateId);
    if (tmpl) setFormat(tmpl);
    setAiPanel(null);
    // Auto-set AI suggestions for this format
    if (templateId === "shorts" || templateId === "tiktok") {
      setAiPrompt("cinematic product reveal, vertical format, dynamic motion, vibrant colors");
    } else if (templateId === "reels") {
      setAiPrompt("lifestyle product shot, Instagram aesthetic, warm tones, smooth camera movement");
    } else if (templateId === "youtube") {
      setAiPrompt("professional product showcase, 16:9 cinematic, brand storytelling, high production value");
    }
  }, []);

  // ─── Render
  return (
    <div style={S.root}>
      {/* ── TOP BAR ── */}
      <div style={S.topBar}>
        {/* Format picker */}
        <div style={{ display: "flex", gap: 2, background: "#0a0a12", borderRadius: 6, padding: 2, border: "1px solid #22222e" }}>
          {FORMAT_PRESETS.map(p => (
            <button key={p.id} onClick={() => setFormat(p)} title={`${p.label} (${p.aspect})`} style={{
              background: format.id === p.id ? "rgba(200,168,75,0.2)" : "none",
              border: format.id === p.id ? "1px solid #c8a84b" : "1px solid transparent",
              borderRadius: 4, color: format.id === p.id ? "#c8a84b" : "#666",
              cursor: "pointer", padding: "3px 6px", fontSize: 11, fontWeight: 600,
            }}>{p.icon} {p.label}</button>
          ))}
        </div>

        <div style={{ width: 1, height: 20, background: "#22222e", margin: "0 4px" }} />

        {/* Project name */}
        <input value={exportTitle} onChange={e => setExportTitle(e.target.value)}
          style={{ ...S.input, width: 180, background: "transparent", border: "1px solid #22222e", fontSize: 12 }}
          placeholder="Nombre del proyecto" />

        <div style={{ marginLeft: "auto", display: "flex", gap: 6, alignItems: "center" }}>
          {/* Format info badge */}
          <span style={{ fontSize: 10, color: "#666", background: "#14141d", border: "1px solid #22222e", borderRadius: 4, padding: "3px 7px" }}>
            {format.w}×{format.h} · {format.aspect} · {format.platform}
          </span>

          {/* Scale */}
          <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
            <button onClick={() => setScale(s => Math.max(20, s - 20))} style={{ ...S.btn, padding: "2px 6px" }}>−</button>
            <span style={{ fontSize: 10, color: "#666", width: 40, textAlign: "center" }}>{scale}px/s</span>
            <button onClick={() => setScale(s => Math.min(200, s + 20))} style={{ ...S.btn, padding: "2px 6px" }}>+</button>
          </div>

          <button onClick={() => setExportModal(true)} style={S.btnGold}>
            <Download size={14} /> Exportar
          </button>
        </div>
      </div>

      {/* ── WORK AREA ── */}
      <div style={S.workArea}>
        {/* ── LEFT SIDEBAR ── */}
        <div style={S.sidebar}>
          {/* Sidebar tabs */}
          <div style={{ display: "flex", borderBottom: "1px solid #1a1a24" }}>
            {(["media", "ai", "formats"] as const).map(s => (
              <button key={s} onClick={() => setExpandedSidebar(s)} style={{
                flex: 1, padding: "7px 4px", fontSize: 9, fontWeight: 700, letterSpacing: 0.5,
                background: expandedSidebar === s ? "rgba(200,168,75,0.1)" : "none",
                border: "none", borderBottom: expandedSidebar === s ? "2px solid #c8a84b" : "2px solid transparent",
                color: expandedSidebar === s ? "#c8a84b" : "#666", cursor: "pointer", textTransform: "uppercase",
              }}>
                {s === "media" ? "Media" : s === "ai" ? "IA Studio" : "Formatos"}
              </button>
            ))}
          </div>

          <div style={{ flex: 1, overflowY: "auto" }}>
            {/* MEDIA tab */}
            {expandedSidebar === "media" && (
              <>
                <SidebarSection title="📂 Subir clips">
                  <label style={{ display: "flex", flexDirection: "column", gap: 4, cursor: "pointer" }}>
                    <div style={{ border: "1.5px dashed #44445a", borderRadius: 6, padding: "10px 6px", textAlign: "center", fontSize: 10, color: "#666" }}>
                      <Upload size={14} style={{ margin: "0 auto 4px" }} />
                      <div>Arrastra MP4/MOV/WebM</div>
                      <div style={{ color: "#444", marginTop: 2 }}>o haz clic aquí</div>
                    </div>
                    <input type="file" accept="video/*,audio/*,image/*" multiple onChange={e => addMediaFiles(e.target.files)} style={{ display: "none" }} />
                  </label>
                </SidebarSection>

                <SidebarSection title="📋 Clips en timeline" collapsible>
                  {clips.length === 0 ? (
                    <p style={{ fontSize: 10, color: "#444", margin: 0 }}>Sin clips. Sube archivos o genera con IA.</p>
                  ) : (
                    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                      {clips.map(c => (
                        <div key={c.id} onClick={() => setSelectedId(c.id)}
                          style={{ padding: "5px 6px", background: selectedId === c.id ? "rgba(200,168,75,0.12)" : "#14141d", border: `1px solid ${selectedId === c.id ? "#c8a84b" : "#22222e"}`, borderRadius: 5, cursor: "pointer", display: "flex", alignItems: "center", gap: 5 }}>
                          {c.thumbnail && <img src={c.thumbnail} alt="" style={{ width: 28, height: 18, objectFit: "cover", borderRadius: 3, flexShrink: 0 }} />}
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontSize: 9, fontWeight: 700, color: "#ccc", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{c.name}</div>
                            <div style={{ fontSize: 8, color: "#555" }}>{fmtTime(c.durationSec)} · {tracks.find(t => t.id === c.trackId)?.label}</div>
                          </div>
                          {c.aiGenerated && <span style={{ ...S.tag, background: "rgba(200,168,75,0.2)", color: "#c8a84b" }}>IA</span>}
                        </div>
                      ))}
                    </div>
                  )}
                </SidebarSection>

                <SidebarSection title="✏️ Añadir texto" collapsible>
                  {TEXT_PRESETS.map(p => (
                    <button key={p.label} onClick={() => addTextClip(p)} style={{ ...S.btn, width: "100%", justifyContent: "flex-start", marginBottom: 4, fontSize: 10 }}>
                      <Type size={10} /> {p.label}
                    </button>
                  ))}
                </SidebarSection>

                <SidebarSection title="🔊 SFX" collapsible>
                  <button onClick={loadSfxCatalog} style={{ ...S.btn, width: "100%", justifyContent: "center", fontSize: 10 }}>
                    <Music size={10} /> Ver catálogo SFX
                  </button>
                </SidebarSection>
              </>
            )}

            {/* AI STUDIO tab */}
            {expandedSidebar === "ai" && (
              <>
                <SidebarSection title="🎬 Generar clip IA">
                  <textarea value={aiPrompt} onChange={e => setAiPrompt(e.target.value)}
                    placeholder="Describe el clip a generar…"
                    style={{ ...S.input, height: 60, resize: "none", marginBottom: 6 }} />
                  <select value={aiModel} onChange={e => setAiModel(e.target.value)} style={{ ...S.input, marginBottom: 6 }}>
                    <option value="seedance-fast">Seedance Fast (rápido)</option>
                    <option value="seedance-pro">Seedance Pro (calidad)</option>
                    <option value="kling-2.1-standard">Kling 2.1</option>
                    <option value="wan-2.5-fast">Wan 2.5</option>
                    <option value="veo-3">Veo 3 (Google)</option>
                    <option value="runway-gen4-turbo">Runway Gen4 Turbo</option>
                    <option value="hailuo-02">Hailuo 02</option>
                  </select>
                  <button onClick={aiGenerateClip} disabled={aiBusy || !aiPrompt.trim()} style={{ ...S.btnGold, width: "100%", justifyContent: "center" }}>
                    {aiBusy ? <Loader2 size={12} className="animate-spin" /> : <Sparkles size={12} />}
                    {aiBusy ? "Generando…" : "Generar clip"}
                  </button>
                </SidebarSection>

                <SidebarSection title="🎙️ Narración IA" collapsible>
                  <textarea value={aiText} onChange={e => setAiText(e.target.value)}
                    placeholder="Texto para narrar con IA…"
                    style={{ ...S.input, height: 60, resize: "none", marginBottom: 6 }} />
                  <select value={aiVoice} onChange={e => setAiVoice(e.target.value)} style={{ ...S.input, marginBottom: 6 }}>
                    <option value="EXAVITQu4vr4xnSDxMaL">Rachel (EN)</option>
                    <option value="pNInz6obpgDQGcFmaJgB">Adam (EN)</option>
                    <option value="MF3mGyEYCl7XYWbV9V6O">Elli (EN)</option>
                    <option value="jsCqWAovK2LkecY7zXl4">Freya (EN)</option>
                    <option value="onwK4e9ZLuTAKqWW03F9">Daniel (EN)</option>
                  </select>
                  <button onClick={aiGenerateVoice} disabled={aiBusy || !aiText.trim()} style={{ ...S.btnGold, width: "100%", justifyContent: "center" }}>
                    {aiBusy ? <Loader2 size={12} className="animate-spin" /> : <Mic size={12} />}
                    {aiBusy ? "Narrando…" : "Generar narración"}
                  </button>
                </SidebarSection>

                <SidebarSection title="🎵 Música IA" collapsible>
                  <textarea value={aiPrompt} onChange={e => setAiPrompt(e.target.value)}
                    placeholder="Estilo de música: epic, chill, upbeat…"
                    style={{ ...S.input, height: 50, resize: "none", marginBottom: 6 }} />
                  <button onClick={aiGenerateMusic} disabled={aiBusy || !aiPrompt.trim()} style={{ ...S.btnGold, width: "100%", justifyContent: "center" }}>
                    {aiBusy ? <Loader2 size={12} className="animate-spin" /> : <Music size={12} />}
                    {aiBusy ? "Componiendo…" : "Generar música"}
                  </button>
                </SidebarSection>

                <SidebarSection title="⚡ Prompts rápidos" collapsible>
                  {[
                    "product reveal cinematic, slow motion, premium brand",
                    "lifestyle shot, golden hour, warm tones, smooth dolly",
                    "unboxing style, close-up hands, bright clean background",
                    "social media hook, fast cuts, dynamic energy, viral style",
                    "testimonial presenter, professional background, eye contact",
                    "drone overhead shot, epic scale, sunrise colors",
                  ].map(p => (
                    <button key={p} onClick={() => setAiPrompt(p)} style={{ ...S.btn, width: "100%", justifyContent: "flex-start", marginBottom: 3, fontSize: 9, textAlign: "left" }}>
                      {p.slice(0, 45)}…
                    </button>
                  ))}
                </SidebarSection>
              </>
            )}

            {/* FORMATS tab */}
            {expandedSidebar === "formats" && (
              <>
                <SidebarSection title="📱 Formatos sociales">
                  {FORMAT_PRESETS.map(p => (
                    <button key={p.id} onClick={() => applyTemplate(p.id)} style={{
                      ...S.btn, width: "100%", justifyContent: "flex-start", marginBottom: 5,
                      background: format.id === p.id ? "rgba(200,168,75,0.12)" : "rgba(255,255,255,0.03)",
                      border: `1px solid ${format.id === p.id ? "#c8a84b" : "#22222e"}`,
                      color: format.id === p.id ? "#c8a84b" : "#aaa",
                    }}>
                      <span style={{ fontSize: 14, flexShrink: 0 }}>{p.icon}</span>
                      <div style={{ textAlign: "left" }}>
                        <div style={{ fontSize: 11, fontWeight: 700 }}>{p.label}</div>
                        <div style={{ fontSize: 9, color: "#666" }}>{p.aspect} · {p.platform} · max {p.maxDuration}s</div>
                      </div>
                    </button>
                  ))}
                </SidebarSection>

                <SidebarSection title="📐 Guías de optimización" collapsible>
                  {format.id === "shorts" || format.id === "tiktok" ? (
                    <div style={{ fontSize: 10, color: "#888", lineHeight: 1.6 }}>
                      <div style={{ color: "#c8a84b", fontWeight: 700, marginBottom: 4 }}>✦ {format.platform} Tips</div>
                      <div>• Hook en los primeros 3s</div>
                      <div>• Texto visible en zona segura</div>
                      <div>• Subtítulos mejoran 40% retención</div>
                      <div>• Duración óptima: 30-60s</div>
                      <div>• Música trending = más alcance</div>
                    </div>
                  ) : format.id === "youtube" ? (
                    <div style={{ fontSize: 10, color: "#888", lineHeight: 1.6 }}>
                      <div style={{ color: "#c8a84b", fontWeight: 700, marginBottom: 4 }}>✦ YouTube Tips</div>
                      <div>• Thumbnail con cara + texto</div>
                      <div>• Primeros 30s = retención clave</div>
                      <div>• Capítulos para vídeos largos</div>
                      <div>• CTA antes del minuto 2</div>
                    </div>
                  ) : (
                    <div style={{ fontSize: 10, color: "#888", lineHeight: 1.6 }}>
                      <div style={{ color: "#c8a84b", fontWeight: 700, marginBottom: 4 }}>✦ Instagram Tips</div>
                      <div>• Paleta de marca consistente</div>
                      <div>• Primeras 3 palabras del caption</div>
                      <div>• Producto visible primeros 2s</div>
                      <div>• Stories max 15s por segmento</div>
                    </div>
                  )}
                </SidebarSection>
              </>
            )}
          </div>
        </div>

        {/* ── PREVIEW ── */}
        <div style={S.previewArea}>
          {/* Video Preview Canvas */}
          <div style={{ ...previewStyle, background: "#000", borderRadius: 6, overflow: "hidden", position: "relative", flexShrink: 0, boxShadow: "0 0 0 1px #22222e, 0 8px 32px rgba(0,0,0,0.6)" }}>
            {/* Format safe-zone guides */}
            {(format.id === "shorts" || format.id === "tiktok" || format.id === "reels") && (
              <>
                <div style={{ position: "absolute", top: "8%", left: "5%", right: "5%", height: 1, background: "rgba(200,168,75,0.15)", zIndex: 5 }} />
                <div style={{ position: "absolute", bottom: "20%", left: "5%", right: "5%", height: 1, background: "rgba(200,168,75,0.15)", zIndex: 5 }} />
                <div style={{ position: "absolute", top: "8%", left: "5%", right: "5%", bottom: "20%", border: "1px dashed rgba(200,168,75,0.08)", zIndex: 5, borderRadius: 2, pointerEvents: "none" }} />
              </>
            )}

            {/* Video element */}
            <video ref={videoRef} muted style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />

            {/* Text overlay preview */}
            {clips.filter(c => c.type === "text" && c.textProps && currentSec >= c.startSec && currentSec < c.startSec + c.durationSec).map(c => (
              <div key={c.id} style={{
                position: "absolute",
                left: "5%", right: "5%",
                ...(c.textProps!.position === "top" ? { top: "10%" } : c.textProps!.position === "bottom" ? { bottom: "22%" } : { top: "50%", transform: "translateY(-50%)" }),
                textAlign: "center",
                color: c.textProps!.color,
                fontSize: c.textProps!.fontSize * (previewStyle.height / 1080),
                fontWeight: c.textProps!.bold ? 700 : 400,
                fontStyle: c.textProps!.italic ? "italic" : "normal",
                background: c.textProps!.bgColor,
                padding: "4px 8px", borderRadius: 4, zIndex: 10,
              }}>
                {c.textProps!.content}
              </div>
            ))}

            {/* Empty state */}
            {videoClipsInOrder.length === 0 && (
              <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 8, color: "#333" }}>
                <Film size={28} />
                <div style={{ fontSize: 11, textAlign: "center" }}>
                  Sube clips o genera con IA<br/>
                  <span style={{ fontSize: 9, color: "#222" }}>{format.aspect} · {format.label}</span>
                </div>
              </div>
            )}

            {/* Current time overlay */}
            <div style={{ position: "absolute", top: 6, left: 6, background: "rgba(0,0,0,0.6)", borderRadius: 3, padding: "2px 6px", fontSize: 10, color: "#fff", fontFamily: "monospace" }}>
              {fmtTime(currentSec)} / {fmtTime(totalDuration)}
            </div>
          </div>

          {/* Playback controls */}
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 10 }}>
            <button onClick={() => { setCurrentSec(0); setIsPlaying(false); }} style={S.btn} title="Inicio">
              <SkipBack size={14} />
            </button>
            <button onClick={() => setIsPlaying(p => !p)} style={{ ...S.btn, padding: "6px 16px", color: isPlaying ? "#c8a84b" : "#fff" }}>
              {isPlaying ? <Pause size={16} /> : <Play size={16} />}
              {isPlaying ? "Pausa" : "Play"}
            </button>
            <button onClick={() => setCurrentSec(Math.min(totalDuration, currentSec + 5))} style={S.btn} title="Adelantar 5s">
              <SkipForward size={14} />
            </button>

            {/* Scrubber bar */}
            <div style={{ flex: 1, position: "relative", height: 4, background: "#22222e", borderRadius: 2, cursor: "pointer" }}
              onClick={e => {
                const rect = e.currentTarget.getBoundingClientRect();
                setCurrentSec((e.clientX - rect.left) / rect.width * totalDuration);
              }}>
              <div style={{ position: "absolute", left: 0, width: `${(currentSec / totalDuration) * 100}%`, height: "100%", background: "#c8a84b", borderRadius: 2 }} />
              <div style={{ position: "absolute", top: -4, width: 12, height: 12, background: "#c8a84b", borderRadius: "50%", transform: "translateX(-50%)", left: `${(currentSec / totalDuration) * 100}%`, cursor: "grab" }} />
            </div>
            <span style={{ fontSize: 10, color: "#555", width: 60, textAlign: "right" }}>{fmtTime(totalDuration)}</span>
          </div>

          {/* Live message */}
          {(liveMsg || aiBusy) && (
            <div style={{ marginTop: 8, display: "flex", alignItems: "center", gap: 6, fontSize: 11, color: "#c8a84b" }}>
              <Loader2 size={12} className="animate-spin" />
              {liveMsg || "Procesando con IA…"}
            </div>
          )}
        </div>

        {/* ── INSPECTOR ── */}
        <div style={S.inspector}>
          <div style={S.sectionHead}>Inspector</div>
          <div style={{ flex: 1, overflowY: "auto", padding: "8px 10px" }}>
            {!selectedClip ? (
              <div style={{ fontSize: 11, color: "#444", textAlign: "center", marginTop: 20 }}>
                <Settings size={20} style={{ margin: "0 auto 8px", display: "block", opacity: 0.3 }} />
                Selecciona un clip en el timeline
              </div>
            ) : (
              <>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                  <span style={{ fontSize: 11, fontWeight: 700, color: "#ddd", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 140 }}>{selectedClip.name}</span>
                  <button onClick={() => deleteClip(selectedClip.id)} style={S.btnDanger}><Trash2 size={11} /></button>
                </div>

                {/* Track selector */}
                <InspectorLabel label="Pista" />
                <select value={selectedClip.trackId} onChange={e => updateClip(selectedClip.id, { trackId: e.target.value })} style={S.input}>
                  {tracks.map(t => <option key={t.id} value={t.id}>{t.label}</option>)}
                </select>

                {/* Volume / Speed */}
                {selectedClip.type !== "text" && (
                  <>
                    <InspectorLabel label="Audio & velocidad" />
                    <Slider label="Volumen" value={selectedClip.volume} min={0} max={2} step={0.05} onChange={v => updateClip(selectedClip.id, { volume: v })} unit="x" />
                    <Slider label="Velocidad" value={selectedClip.speed} min={0.25} max={4} step={0.25} onChange={v => updateClip(selectedClip.id, { speed: v })} unit="x" />
                    <div style={{ display: "flex", gap: 4, marginBottom: 8 }}>
                      <button onClick={() => updateClip(selectedClip.id, { muted: !selectedClip.muted })} style={{ ...S.btn, flex: 1, justifyContent: "center", color: selectedClip.muted ? "#c8a84b" : "#aaa" }}>
                        {selectedClip.muted ? <VolumeX size={11} /> : <Volume2 size={11} />}
                        {selectedClip.muted ? "Silenciado" : "Con audio"}
                      </button>
                    </div>
                  </>
                )}

                {/* Trim */}
                {selectedClip.type === "video" && (
                  <>
                    <InspectorLabel label="Recorte (trim)" />
                    <Slider label="Inicio" value={selectedClip.trimStart} min={0} max={0.9} step={0.01} onChange={v => updateClip(selectedClip.id, { trimStart: v })} unit="" />
                    <Slider label="Fin" value={selectedClip.trimEnd} min={0.1} max={1} step={0.01} onChange={v => updateClip(selectedClip.id, { trimEnd: v })} unit="" />
                    <InspectorLabel label="Duración efectiva" />
                    <div style={{ fontSize: 11, color: "#c8a84b", marginBottom: 8 }}>{fmtTime((selectedClip.trimEnd - selectedClip.trimStart) * selectedClip.durationSec)}</div>
                  </>
                )}

                {/* Duration (for text/audio) */}
                {selectedClip.type !== "video" && (
                  <>
                    <InspectorLabel label="Duración (seg)" />
                    <input type="number" value={selectedClip.durationSec} min={1} max={300} step={0.5}
                      onChange={e => updateClip(selectedClip.id, { durationSec: parseFloat(e.target.value) })}
                      style={S.input} />
                  </>
                )}

                {/* Text editor */}
                {selectedClip.type === "text" && selectedClip.textProps && (
                  <>
                    <InspectorLabel label="Texto" />
                    <textarea value={selectedClip.textProps.content}
                      onChange={e => updateClip(selectedClip.id, { textProps: { ...selectedClip.textProps!, content: e.target.value } })}
                      style={{ ...S.input, height: 56, resize: "none", marginBottom: 6 }} />

                    <InspectorLabel label="Tamaño de fuente" />
                    <input type="number" value={selectedClip.textProps.fontSize} min={12} max={120}
                      onChange={e => updateClip(selectedClip.id, { textProps: { ...selectedClip.textProps!, fontSize: parseInt(e.target.value) } })}
                      style={S.input} />

                    <InspectorLabel label="Color" />
                    <input type="color" value={selectedClip.textProps.color}
                      onChange={e => updateClip(selectedClip.id, { textProps: { ...selectedClip.textProps!, color: e.target.value } })}
                      style={{ ...S.input, height: 32, padding: 2, cursor: "pointer" }} />

                    <InspectorLabel label="Posición" />
                    <select value={selectedClip.textProps.position}
                      onChange={e => updateClip(selectedClip.id, { textProps: { ...selectedClip.textProps!, position: e.target.value as any } })}
                      style={S.input}>
                      <option value="top">Superior</option>
                      <option value="center">Centro</option>
                      <option value="bottom">Inferior</option>
                    </select>

                    <div style={{ display: "flex", gap: 4, marginTop: 6 }}>
                      <button onClick={() => updateClip(selectedClip.id, { textProps: { ...selectedClip.textProps!, bold: !selectedClip.textProps!.bold } })}
                        style={{ ...S.btn, flex: 1, justifyContent: "center", fontWeight: 700, color: selectedClip.textProps.bold ? "#c8a84b" : "#aaa" }}>B</button>
                      <button onClick={() => updateClip(selectedClip.id, { textProps: { ...selectedClip.textProps!, italic: !selectedClip.textProps!.italic } })}
                        style={{ ...S.btn, flex: 1, justifyContent: "center", fontStyle: "italic", color: selectedClip.textProps.italic ? "#c8a84b" : "#aaa" }}>I</button>
                    </div>
                  </>
                )}

                {/* Video effects */}
                {selectedClip.type === "video" && (
                  <>
                    <InspectorLabel label="Efecto visual" />
                    <select value={selectedClip.effect || "Ninguno"} onChange={e => updateClip(selectedClip.id, { effect: e.target.value })} style={S.input}>
                      {VIDEO_FX.map(f => <option key={f} value={f}>{f}</option>)}
                    </select>
                  </>
                )}

                {/* Position on timeline */}
                <InspectorLabel label="Posición en timeline" />
                <div style={{ display: "flex", gap: 4 }}>
                  <input type="number" value={parseFloat(selectedClip.startSec.toFixed(1))} min={0} step={0.5}
                    onChange={e => updateClip(selectedClip.id, { startSec: parseFloat(e.target.value) })}
                    style={{ ...S.input, flex: 1 }} />
                  <span style={{ fontSize: 10, color: "#555", paddingTop: 8 }}>seg</span>
                </div>

                {/* Go to clip button */}
                <button onClick={() => setCurrentSec(selectedClip.startSec)} style={{ ...S.btn, width: "100%", justifyContent: "center", marginTop: 8, fontSize: 10 }}>
                  <Eye size={10} /> Ir a este clip
                </button>
              </>
            )}
          </div>
        </div>
      </div>

      {/* ── TIMELINE PANEL ── */}
      <div style={S.timelinePanel}>
        {/* Timeline toolbar */}
        <div style={{ display: "flex", alignItems: "center", gap: 6, padding: "4px 8px", borderBottom: "1px solid #1a1a24", flexShrink: 0 }}>
          <span style={{ fontSize: 9, color: "#555", fontWeight: 700, letterSpacing: 1, textTransform: "uppercase" }}>Timeline</span>
          <div style={{ marginLeft: "auto", display: "flex", gap: 4 }}>
            <button onClick={() => { setClips([]); setSelectedId(null); setCurrentSec(0); }} style={{ ...S.btn, fontSize: 9, color: "#555" }}>
              <RefreshCw size={9} /> Limpiar
            </button>
          </div>
        </div>

        {/* Timeline scroll area */}
        <div style={{ flex: 1, display: "flex", overflow: "hidden" }}>
          {/* Track labels */}
          <div style={{ width: LABEL_WIDTH, flexShrink: 0, borderRight: "1px solid #1a1a24" }}>
            <div style={{ height: RULER_HEIGHT, borderBottom: "1px solid #1a1a24", display: "flex", alignItems: "center", padding: "0 8px" }}>
              <span style={{ fontSize: 9, color: "#333" }}>Pistas</span>
            </div>
            {tracks.map(track => (
              <div key={track.id} style={{ height: TRACK_HEIGHT, borderBottom: "1px solid #1a1a24", display: "flex", alignItems: "center", padding: "0 6px", gap: 4 }}>
                <div style={{ width: 3, height: 24, borderRadius: 2, background: track.color, flexShrink: 0 }} />
                <span style={{ fontSize: 9, color: "#888", fontWeight: 600, flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{track.label}</span>
                <button onClick={() => setTrackMuted(m => ({ ...m, [track.id]: !m[track.id] }))}
                  style={{ background: "none", border: "none", cursor: "pointer", color: trackMuted[track.id] ? "#c8a84b" : "#333", padding: 2 }}>
                  {trackMuted[track.id] ? <VolumeX size={9} /> : <Volume2 size={9} />}
                </button>
                <button onClick={() => setTrackLocked(l => ({ ...l, [track.id]: !l[track.id] }))}
                  style={{ background: "none", border: "none", cursor: "pointer", color: trackLocked[track.id] ? "#c8a84b" : "#333", padding: 2 }}>
                  {trackLocked[track.id] ? <Lock size={9} /> : <Unlock size={9} />}
                </button>
              </div>
            ))}
          </div>

          {/* Timeline scrollable area */}
          <div ref={timelineScrollRef} style={{ flex: 1, overflowX: "auto", overflowY: "hidden", position: "relative" }} onClick={handleTimelineClick}>
            <div style={{ width: Math.max(800, totalDuration * scale + 200), position: "relative" }}>
              {/* Ruler */}
              <TimelineRuler totalSec={totalDuration} scale={scale} />

              {/* Tracks */}
              {tracks.map(track => (
                <div key={track.id} style={{ height: TRACK_HEIGHT, borderBottom: "1px solid #1a1a24", position: "relative", background: "#0a0a12" }}>
                  {/* Beat grid */}
                  {[...Array(Math.ceil(totalDuration / 5))].map((_, i) => (
                    <div key={i} style={{ position: "absolute", left: i * 5 * scale, top: 0, bottom: 0, width: 1, background: i % 2 === 0 ? "#111118" : "transparent", pointerEvents: "none" }} />
                  ))}
                  {/* Clips */}
                  {clips.filter(c => c.trackId === track.id).map(clip => (
                    <TimelineClip
                      key={clip.id}
                      clip={clip}
                      scale={scale}
                      selected={selectedId === clip.id}
                      onSelect={() => { if (!trackLocked[track.id]) setSelectedId(clip.id); }}
                      onDelete={() => deleteClip(clip.id)}
                      onDragEnd={newStart => { if (!trackLocked[track.id]) updateClip(clip.id, { startSec: newStart }); }}
                    />
                  ))}
                  {/* Drop zone hint */}
                  {clips.filter(c => c.trackId === track.id).length === 0 && (
                    <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", padding: "0 10px", pointerEvents: "none" }}>
                      <span style={{ fontSize: 9, color: "#2a2a38" }}>+ {track.label}</span>
                    </div>
                  )}
                </div>
              ))}

              {/* Scrubber line */}
              <div style={{ position: "absolute", left: currentSec * scale, top: 0, bottom: 0, width: 2, background: "#c8a84b", pointerEvents: "none", zIndex: 50, boxShadow: "0 0 6px rgba(200,168,75,0.5)" }}>
                <div style={{ width: 10, height: 10, background: "#c8a84b", borderRadius: "50%", position: "absolute", top: 0, left: -4 }} />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── SFX CATALOG MODAL ── */}
      {showSfx && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)", zIndex: 200, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div style={{ background: "#13131e", border: "1px solid #22222e", borderRadius: 12, width: 520, maxHeight: "70vh", overflow: "hidden", display: "flex", flexDirection: "column" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 16px", borderBottom: "1px solid #22222e" }}>
              <span style={{ fontWeight: 700, fontSize: 14 }}>🔊 Catálogo SFX</span>
              <button onClick={() => setShowSfx(false)} style={{ ...S.btn, padding: "4px 8px" }}><X size={14} /></button>
            </div>
            <div style={{ overflow: "auto", padding: 12, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
              {sfxCatalog.length === 0 ? (
                <div style={{ gridColumn: "1/-1", textAlign: "center", color: "#444", fontSize: 12, padding: 20 }}>Sin SFX disponibles. Verifica conexión al servidor.</div>
              ) : sfxCatalog.map((sfx: any) => (
                <button key={sfx.id} style={{ ...S.btn, justifyContent: "flex-start", flexDirection: "column", alignItems: "flex-start", padding: "8px 10px" }}
                  onClick={() => {
                    const clip: ClipItem = {
                      id: uid(), trackId: "voice", type: "audio", name: sfx.name,
                      aiUrl: sfx.url, durationSec: sfx.duration || 3,
                      startSec: Math.max(0, ...clips.filter(c => c.trackId === "voice").map(c => c.startSec + c.durationSec)),
                      trimStart: 0, trimEnd: 1, volume: 1, speed: 1, muted: false,
                    };
                    setClips(prev => [...prev, clip]);
                    setShowSfx(false);
                  }}>
                  <span style={{ fontSize: 11, fontWeight: 600, color: "#ccc" }}>{sfx.name}</span>
                  <span style={{ fontSize: 9, color: "#555" }}>{sfx.category} · {sfx.duration}s</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── EXPORT MODAL ── */}
      {exportModal && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.75)", zIndex: 200, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div style={{ background: "#13131e", border: "1px solid #22222e", borderRadius: 12, width: 440, overflow: "hidden" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "14px 16px", borderBottom: "1px solid #22222e" }}>
              <span style={{ fontWeight: 700, fontSize: 14 }}>🎬 Exportar video</span>
              <button onClick={() => setExportModal(false)} style={{ ...S.btn, padding: "4px 8px" }}><X size={14} /></button>
            </div>

            <div style={{ padding: 16, display: "flex", flexDirection: "column", gap: 12 }}>
              {/* Summary */}
              <div style={{ background: "#0d0d14", borderRadius: 8, padding: 12, fontSize: 11, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
                <div style={{ color: "#666" }}>Formato: <span style={{ color: "#c8a84b", fontWeight: 700 }}>{format.label} ({format.aspect})</span></div>
                <div style={{ color: "#666" }}>Resolución: <span style={{ color: "#fff" }}>{format.w}×{format.h}</span></div>
                <div style={{ color: "#666" }}>Clips video: <span style={{ color: "#fff" }}>{videoClipsInOrder.filter(c => c.file).length}</span></div>
                <div style={{ color: "#666" }}>Duración: <span style={{ color: "#fff" }}>{fmtTime(totalDuration)}</span></div>
                <div style={{ color: "#666" }}>Pista voz: <span style={{ color: clips.some(c => c.trackId === "voice" && c.file) ? "#7fb38a" : "#555" }}>{clips.some(c => c.trackId === "voice" && c.file) ? "✓" : "—"}</span></div>
                <div style={{ color: "#666" }}>Pista música: <span style={{ color: clips.some(c => c.trackId === "music" && c.file) ? "#7fb38a" : "#555" }}>{clips.some(c => c.trackId === "music" && c.file) ? "✓" : "—"}</span></div>
              </div>

              <div>
                <label style={{ fontSize: 10, color: "#666", display: "block", marginBottom: 4 }}>TÍTULO DEL PROYECTO</label>
                <input value={exportTitle} onChange={e => setExportTitle(e.target.value)} style={S.input} />
              </div>

              <Slider label="Crossfade entre clips" value={exportCrossfade} min={0} max={1.5} step={0.1} onChange={setExportCrossfade} unit="s" />

              {videoClipsInOrder.filter(c => c.file).length === 0 && (
                <div style={{ background: "rgba(220,80,80,0.1)", border: "1px solid rgba(220,80,80,0.3)", borderRadius: 6, padding: "8px 12px", fontSize: 11, color: "#e06060" }}>
                  ⚠️ Añade al menos 1 clip de video desde archivos locales para exportar. Los clips IA necesitan descargarse primero.
                </div>
              )}

              {liveMsg && exportBusy && (
                <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11, color: "#c8a84b" }}>
                  <Loader2 size={12} className="animate-spin" />
                  {liveMsg}
                </div>
              )}

              {resultUrl && (
                <div>
                  <video src={resultUrl} controls style={{ width: "100%", borderRadius: 8, background: "#000", maxHeight: 160 }} />
                  <a href={resultUrl} download={`${exportTitle}.mp4`} style={{ ...S.btnGold, marginTop: 6, justifyContent: "center", textDecoration: "none" }}>
                    <Download size={14} /> Descargar MP4
                  </a>
                </div>
              )}

              <button onClick={doExport} disabled={exportBusy || videoClipsInOrder.filter(c => c.file).length === 0}
                style={{ ...S.btnGold, width: "100%", justifyContent: "center", padding: "12px 20px", fontSize: 13, opacity: exportBusy || videoClipsInOrder.filter(c => c.file).length === 0 ? 0.5 : 1 }}>
                {exportBusy ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />}
                {exportBusy ? "Procesando con FFmpeg…" : "Exportar MP4 final"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
