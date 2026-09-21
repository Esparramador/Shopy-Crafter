/**
 * VideoStudio — Editor de vídeo profesional multi-pista
 * Diseño inspirado en designcombo/react-video-editor + CapCut + Final Cut Pro
 * Layout: MediaLibrary (izq) | Preview+Timeline (centro) | Inspector (der)
 * IA integrada: T2V, I2V, V2V, extend, edit, face-swap, inpaint, outpaint, audio-mix, SFX
 */
import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { useModalLock } from "@/hooks/use-modal-lock";
import { ModalOverlay } from "@/components/ModalOverlay";
import {
  Loader2, Film, Mic, Music, Type, Sparkles, Download, Play, Pause,
  SkipBack, SkipForward, Volume2, VolumeX, Scissors, Trash2, Plus,
  ChevronDown, ChevronRight, Zap, RefreshCw, X, Settings, Monitor,
  Smartphone, Square, Upload, Eye, Lock, Unlock, Wand2, ImageIcon,
  Layers, Maximize2, ZoomIn, ZoomOut, MoreHorizontal, Copy, AlignLeft,
  Blend, Radio, Star, Package, ChevronLeft, LayoutTemplate, AudioLines,
  Clapperboard, Palette, Grid3X3, Video
} from "lucide-react";

const API_BASE = import.meta.env.BASE_URL?.replace(/\/$/, "") ?? "";

// ─── Types ────────────────────────────────────────────────────────────────────
type TrackType = "video" | "audio" | "text" | "image";
type ClipType  = "video" | "audio" | "text" | "image";
type AspectRatio = "9:16" | "16:9" | "1:1" | "4:5";
type SidebarTab = "media" | "ai" | "effects" | "audio" | "text" | "formats" | "templates";

interface TextProps {
  content: string; fontSize: number; color: string; bgColor: string;
  position: "top" | "center" | "bottom"; bold: boolean; italic: boolean; shadow: boolean;
}

interface ClipItem {
  id: string; trackId: string; type: ClipType; name: string;
  file?: File; blobUrl?: string; aiUrl?: string;
  durationSec: number; startSec: number; trimStart: number; trimEnd: number;
  volume: number; speed: number; muted: boolean; effect?: string;
  textProps?: TextProps; aiGenerated?: boolean; thumbnail?: string;
  filterCss?: string; opacity?: number; brightness?: number; contrast?: number;
}

interface Track {
  id: string; type: TrackType; label: string; color: string; muted: boolean; locked: boolean;
}

interface FormatPreset {
  id: string; label: string; aspect: AspectRatio; icon: string; w: number; h: number;
  maxDuration: number; platform: string; fps: number;
}

interface SFXEntry { id: string; name: string; prompt: string; category: string; duration: number; url?: string }
interface TemplateEntry { id: string; label: string; desc: string; icon: string; tracks: Partial<Track>[]; duration: number }

// ─── Overlay types (canvas overlay system T003) ───────────────────────────────
type OverlayKind = "text" | "emoji" | "image";
interface CanvasOverlay {
  id: string;
  kind: OverlayKind;
  // Position & size — percent of preview (0–100)
  x: number; y: number; w: number; h: number;
  // Text
  text?: string; fontSize?: number; color?: string; bgColor?: string;
  bold?: boolean; italic?: boolean; shadow?: boolean;
  // Emoji
  emoji?: string;
  // Image sticker
  imageUrl?: string;
  // Timing
  startSec: number; endSec: number;
  // Rotation
  rotate?: number;
}

// ─── Constants ────────────────────────────────────────────────────────────────
const PX_PER_SEC  = 60;
const TRACK_HEIGHT = 50;
const RULER_HEIGHT = 28;
const LABEL_WIDTH  = 116;

const DEFAULT_TRACKS: Track[] = [
  { id: "video1", type: "video", label: "Video Principal", color: "#4fa3e2", muted: false, locked: false },
  { id: "video2", type: "video", label: "B-Roll",          color: "#7e6dd6", muted: false, locked: false },
  { id: "image1", type: "image", label: "Imágenes",        color: "#5db88a", muted: false, locked: false },
  { id: "text1",  type: "text",  label: "Subtítulos",      color: "#c8a84b", muted: false, locked: false },
  { id: "text2",  type: "text",  label: "Texto overlay",   color: "#e8b870", muted: false, locked: false },
  { id: "voice",  type: "audio", label: "Narración",       color: "#e2664f", muted: false, locked: false },
  { id: "music",  type: "audio", label: "Música",          color: "#7fb38a", muted: false, locked: false },
  { id: "sfx",    type: "audio", label: "SFX",             color: "#b36e6e", muted: false, locked: false },
];

const FORMAT_PRESETS: FormatPreset[] = [
  { id: "shorts",  label: "YT Shorts",  aspect: "9:16", icon: "📱", w: 1080, h: 1920, maxDuration: 60,  platform: "YouTube",   fps: 30 },
  { id: "reels",   label: "Reels",      aspect: "9:16", icon: "🎬", w: 1080, h: 1920, maxDuration: 90,  platform: "Instagram", fps: 30 },
  { id: "tiktok",  label: "TikTok",     aspect: "9:16", icon: "🎵", w: 1080, h: 1920, maxDuration: 180, platform: "TikTok",    fps: 30 },
  { id: "youtube", label: "YouTube",    aspect: "16:9", icon: "🖥️", w: 1920, h: 1080, maxDuration: 600, platform: "YouTube",   fps: 24 },
  { id: "square",  label: "Feed 1:1",   aspect: "1:1",  icon: "⬜", w: 1080, h: 1080, maxDuration: 60,  platform: "Instagram", fps: 30 },
  { id: "story",   label: "Story",      aspect: "9:16", icon: "📸", w: 1080, h: 1920, maxDuration: 15,  platform: "Instagram", fps: 30 },
  { id: "ad45",    label: "Anuncio 4:5",aspect: "4:5",  icon: "🛒", w: 1080, h: 1350, maxDuration: 60,  platform: "Meta",      fps: 30 },
];

const VIDEO_FX = ["Ninguno", "Blur suave", "Vignette", "Grain cinematic", "Color cine", "Vintage", "Neon glow", "B&W", "Sepia", "Saturado", "High contrast", "HDR look", "Duotone azul", "Glitch", "Bokeh"];
const TRANSITION_FX = ["Ninguno", "Crossfade", "Fade negro", "Deslizar izq.", "Deslizar der.", "Zoom in", "Zoom out", "Wipe", "Dissolve", "Flash", "Spin", "Blur transition"];
const TEXT_PRESETS = [
  { label: "Título Grande",         fontSize: 64, bold: true,  position: "center" as const, shadow: true  },
  { label: "Subtítulo clásico",     fontSize: 38, bold: false, position: "bottom" as const, shadow: true  },
  { label: "Caption social",        fontSize: 28, bold: false, position: "bottom" as const, shadow: false },
  { label: "CTA llamada a acción",  fontSize: 44, bold: true,  position: "bottom" as const, shadow: true  },
  { label: "Lower third",           fontSize: 26, bold: false, position: "bottom" as const, shadow: false },
  { label: "Precio/Oferta",         fontSize: 56, bold: true,  position: "center" as const, shadow: true  },
  { label: "Logo brand overlay",    fontSize: 20, bold: true,  position: "top"    as const, shadow: false },
];

const VIDEO_MODELS = [
  { key: "seedance-fast",    label: "Seedance Fast",    time: "~30s" },
  { key: "kling-v2.1-std",   label: "Kling 2.1 Std",   time: "~2m"  },
  { key: "hailuo-mini",      label: "Hailuo Mini",      time: "~45s" },
  { key: "runway-gen4.5",    label: "Runway Gen 4.5",   time: "~3m"  },
  { key: "veo-3-fast",       label: "Veo 3 Fast",       time: "~90s" },
  { key: "wan-2.5-t2v",      label: "Wan 2.5 T2V",      time: "~2m"  },
];

const TEMPLATE_PRESETS: TemplateEntry[] = [
  { id: "tpl-product",   label: "Showcase Producto",  desc: "Presenta tu producto con estilo",  icon: "🛍️", tracks: DEFAULT_TRACKS.slice(0,5), duration: 15 },
  { id: "tpl-testimonial",label: "Testimonio Cliente", desc: "Vídeo de reseña con narración",   icon: "⭐", tracks: DEFAULT_TRACKS.slice(0,5), duration: 30 },
  { id: "tpl-sale",      label: "Anuncio de Oferta",  desc: "Flash sale con urgencia visual",   icon: "🔥", tracks: DEFAULT_TRACKS.slice(0,5), duration: 10 },
  { id: "tpl-story",     label: "Story Brand",        desc: "Cuenta la historia de tu marca",   icon: "📖", tracks: DEFAULT_TRACKS.slice(0,5), duration: 45 },
  { id: "tpl-tutorial",  label: "Cómo se usa",        desc: "Demo de uso del producto",          icon: "🎓", tracks: DEFAULT_TRACKS.slice(0,5), duration: 60 },
  { id: "tpl-unboxing",  label: "Unboxing Premium",   desc: "Apertura de producto cinematográfica", icon: "📦", tracks: DEFAULT_TRACKS.slice(0,5), duration: 20 },
];

const SFX_CATALOG_STATIC: SFXEntry[] = [
  { id:"sfx-cash",       name:"Caja registradora",  prompt:"cash register ding",             category:"Comercio",  duration:2  },
  { id:"sfx-cart",       name:"Carrito de compras", prompt:"shopping cart wheels rolling",   category:"Comercio",  duration:3  },
  { id:"sfx-unbox",      name:"Abrir paquete",      prompt:"cardboard box opening unwrapping",category:"Comercio", duration:4  },
  { id:"sfx-ping",       name:"Notificación ping",  prompt:"soft notification ping",         category:"Comercio",  duration:1  },
  { id:"sfx-success",    name:"Fanfarria éxito",    prompt:"success celebration fanfare",    category:"Emociones", duration:3  },
  { id:"sfx-reveal",     name:"Reveal dramático",   prompt:"dramatic cinematic reveal sting",category:"Emociones", duration:4  },
  { id:"sfx-suspense",   name:"Suspenso build",     prompt:"suspense tension building",      category:"Emociones", duration:6  },
  { id:"sfx-happy",      name:"Jingle alegre",      prompt:"happy upbeat jingle short",      category:"Emociones", duration:5  },
  { id:"sfx-office",     name:"Ambiente oficina",   prompt:"office background ambience",     category:"Ambiente",  duration:10 },
  { id:"sfx-nature",     name:"Naturaleza",         prompt:"outdoor nature birds ambient",   category:"Ambiente",  duration:10 },
  { id:"sfx-city",       name:"Ciudad",             prompt:"city street traffic background", category:"Ambiente",  duration:10 },
  { id:"sfx-coffee",     name:"Cafetería",          prompt:"coffee shop background buzz",    category:"Ambiente",  duration:10 },
  { id:"sfx-click",      name:"Clic tech",          prompt:"technology ui click sound",      category:"Producto",  duration:1  },
  { id:"sfx-soft-close", name:"Cierre suave",       prompt:"soft lid click close",           category:"Producto",  duration:2  },
  { id:"sfx-fabric",     name:"Tejido",             prompt:"fabric cloth rustle",            category:"Producto",  duration:3  },
  { id:"sfx-liquid",     name:"Líquido",            prompt:"water liquid pour glass",        category:"Producto",  duration:4  },
  { id:"sfx-whoosh",     name:"Whoosh transición",  prompt:"fast whoosh swipe transition",   category:"Efecto",    duration:1  },
  { id:"sfx-glitch",     name:"Glitch digital",     prompt:"digital glitch electronic",      category:"Efecto",    duration:2  },
  { id:"sfx-logo",       name:"Logo reveal sting",  prompt:"logo reveal short sting",        category:"Efecto",    duration:3  },
  { id:"sfx-typewriter", name:"Máquina de escribir",prompt:"typewriter keyboard typing",     category:"Efecto",    duration:3  },
];

const VOICE_OPTIONS = [
  { id: "EXAVITQu4vr4xnSDxMaL", label: "Sarah (EN, femenina)" },
  { id: "onwK4e9ZLuTAKqWW03F9", label: "Daniel (EN, masculino)" },
  { id: "TX3LPaxmHKxFdv7VOQHJ", label: "Liam (EN, narrativo)" },
  { id: "XB0fDUnXU5powFXDhCwa", label: "Charlotte (EN, cálida)" },
  { id: "pNInz6obpgDQGcFmaJgB", label: "Adam (EN, profundo)" },
  { id: "jsCqWAovK2LkecY7zXl4", label: "Freya (EN, joven)" },
];

// ─── Utilities ────────────────────────────────────────────────────────────────
function uid() { return Math.random().toString(36).slice(2, 9); }
function fmtTime(sec: number): string {
  const m = Math.floor(sec / 60).toString().padStart(2, "0");
  const s = Math.floor(sec % 60).toString().padStart(2, "0");
  return `${m}:${s}`;
}
function getVideoDuration(file: File): Promise<number> {
  return new Promise(res => {
    const v = document.createElement("video");
    v.preload = "metadata";
    const url = URL.createObjectURL(file);
    v.onloadedmetadata = () => { URL.revokeObjectURL(url); res(v.duration || 5); };
    v.onerror = () => { URL.revokeObjectURL(url); res(5); };
    v.src = url;
  });
}
async function getVideoThumbnail(file: File): Promise<string> {
  return new Promise(res => {
    const v = document.createElement("video");
    v.preload = "metadata";
    const url = URL.createObjectURL(file);
    v.onloadeddata = () => { v.currentTime = 0.1; };
    v.onseeked = () => {
      const c = document.createElement("canvas");
      c.width = 160; c.height = 90;
      const ctx = c.getContext("2d");
      if (ctx) ctx.drawImage(v, 0, 0, 160, 90);
      URL.revokeObjectURL(url);
      res(c.toDataURL("image/jpeg", 0.7));
    };
    v.onerror = () => { URL.revokeObjectURL(url); res(""); };
    v.src = url;
  });
}

// ─── Design tokens ────────────────────────────────────────────────────────────
const C = {
  bg0: "#080810", bg1: "#0d0d18", bg2: "#10101c", bg3: "#13131f", bg4: "#17172a",
  border: "#1e1e2e", border2: "#252535",
  gold: "#c8a84b", goldDim: "rgba(200,168,75,0.15)", goldHover: "#e0c070",
  text: "#e8e8f0", textDim: "#7070a0", textFaint: "#404060",
  blue: "#4fa3e2", purple: "#7e6dd6", green: "#5db88a", red: "#e2664f",
  teal: "#4ecdc4",
};

const S: Record<string, React.CSSProperties> = {
  root:         { display:"flex", flexDirection:"column", background:C.bg0, color:C.text, fontFamily:"inherit", overflow:"hidden", border:`1px solid ${C.border}` },
  topBar:       { display:"flex", alignItems:"center", gap:6, padding:"0 10px", height:46, background:C.bg3, borderBottom:`1px solid ${C.border}`, flexShrink:0, userSelect:"none" },
  body:         { display:"flex", flex:1, overflow:"hidden", minHeight:0 },
  leftPanel:    { width:220, flexShrink:0, background:C.bg2, borderRight:`1px solid ${C.border}`, display:"flex", flexDirection:"column", overflow:"hidden" },
  centerPanel:  { flex:1, display:"flex", flexDirection:"column", overflow:"hidden", minWidth:0 },
  rightPanel:   { width:238, flexShrink:0, background:C.bg2, borderLeft:`1px solid ${C.border}`, display:"flex", flexDirection:"column", overflow:"hidden" },
  previewWrap:  { flex:1, display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", background:C.bg0, position:"relative", overflow:"hidden", minHeight:0 },
  timelineWrap: { height:238, flexShrink:0, background:"#09091a", borderTop:`1px solid ${C.border}`, display:"flex", flexDirection:"column" },
  tabBar:       { display:"flex", borderBottom:`1px solid ${C.border}`, flexShrink:0 },
  tab:          { flex:1, padding:"7px 4px", fontSize:9.5, fontWeight:600, letterSpacing:0.4, textAlign:"center" as const, cursor:"pointer", color:C.textDim, border:"none", background:"none", textTransform:"uppercase" as const, transition:"color 0.15s" },
  tabActive:    { color:C.gold, borderBottom:`2px solid ${C.gold}` },
  sHead:        { padding:"8px 10px", fontSize:9.5, fontWeight:700, letterSpacing:1, color:C.textDim, textTransform:"uppercase" as const, borderBottom:`1px solid ${C.border}` },
  btn:          { background:"none", border:`1px solid ${C.border2}`, borderRadius:5, color:"#9090b0", cursor:"pointer", padding:"4px 8px", fontSize:11, display:"flex", alignItems:"center", gap:4, transition:"all 0.15s" },
  btnGold:      { background:`linear-gradient(135deg,${C.gold},${C.goldHover})`, border:"none", borderRadius:6, color:"#08080f", cursor:"pointer", padding:"6px 14px", fontSize:12, fontWeight:700, display:"flex", alignItems:"center", gap:6 },
  btnDanger:    { background:"rgba(220,50,50,0.1)", border:"1px solid rgba(220,50,50,0.3)", borderRadius:5, color:"#d06060", cursor:"pointer", padding:"4px 8px", fontSize:11, display:"flex", alignItems:"center", gap:4 },
  btnIcon:      { background:"none", border:"none", cursor:"pointer", color:C.textDim, padding:"3px 5px", display:"flex", alignItems:"center", borderRadius:4, transition:"color 0.15s" },
  tag:          { padding:"2px 6px", borderRadius:4, fontSize:9, fontWeight:700, letterSpacing:0.5 },
  input:        { width:"100%", background:C.bg3, border:`1px solid ${C.border2}`, borderRadius:5, color:C.text, padding:"5px 8px", fontSize:11, fontFamily:"inherit", boxSizing:"border-box" as const },
  textarea:     { width:"100%", background:C.bg3, border:`1px solid ${C.border2}`, borderRadius:5, color:C.text, padding:"6px 8px", fontSize:11, fontFamily:"inherit", boxSizing:"border-box" as const, resize:"none" as const },
};

// ─── Sub-components ───────────────────────────────────────────────────────────
function SLabel({ label }: { label: string }) {
  return <div style={{ fontSize:9.5, color:C.textDim, fontWeight:600, letterSpacing:0.5, marginBottom:3, marginTop:8, textTransform:"uppercase" }}>{label}</div>;
}

function SSection({ title, children, defaultOpen = true }: { title: string; children: React.ReactNode; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div style={{ borderBottom:`1px solid ${C.border}` }}>
      <div onClick={() => setOpen(o=>!o)} style={{ ...S.sHead, cursor:"pointer", display:"flex", justifyContent:"space-between", alignItems:"center" }}>
        <span>{title}</span>
        {open ? <ChevronDown size={10}/> : <ChevronRight size={10}/>}
      </div>
      {open && <div style={{ padding:"8px 10px" }}>{children}</div>}
    </div>
  );
}

function SliderProp({ label, value, min, max, step, onChange, unit = "" }: { label: string; value: number; min: number; max: number; step: number; onChange: (v: number) => void; unit?: string }) {
  return (
    <div style={{ marginBottom:6 }}>
      <div style={{ display:"flex", justifyContent:"space-between", fontSize:10, color:C.textDim, marginBottom:2 }}>
        <span>{label}</span><span style={{ color:C.gold }}>{value.toFixed(step<0.1?2:1)}{unit}</span>
      </div>
      <input type="range" min={min} max={max} step={step} value={value} onChange={e=>onChange(parseFloat(e.target.value))} style={{ width:"100%", accentColor:C.gold }} />
    </div>
  );
}

// ─── Timeline Ruler ──────────────────────────────────────────────────────────
function TimelineRuler({ totalSec, scale }: { totalSec: number; scale: number }) {
  const ticks = [];
  const step = scale < 35 ? 10 : scale < 55 ? 5 : scale < 80 ? 2 : 1;
  for (let s = 0; s <= totalSec + step; s += step) {
    const isMajor = s % (step * 5) === 0;
    ticks.push(
      <div key={s} style={{ position:"absolute", left:s*scale, top:0, display:"flex", flexDirection:"column", alignItems:"flex-start" }}>
        <div style={{ width:1, height:isMajor?12:6, background:isMajor?"#3a3a5a":"#1e1e3a" }} />
        {isMajor && <span style={{ fontSize:8.5, color:"#3a3a6a", marginTop:1, whiteSpace:"nowrap", userSelect:"none" }}>{fmtTime(s)}</span>}
      </div>
    );
  }
  return (
    <div style={{ position:"relative", height:RULER_HEIGHT, background:"#080810", borderBottom:`1px solid #111120`, flexShrink:0, overflow:"hidden" }}>
      {ticks}
    </div>
  );
}

// ─── Single Clip on Timeline ─────────────────────────────────────────────────
const CLIP_COLORS: Record<string, string> = {
  video: "#1a3054", audio: "#2a1520", text: "#1e1a08", image: "#0e2a1a",
};
const CLIP_BORDER: Record<string, string> = {
  video: C.blue, audio: C.red, text: C.gold, image: C.green,
};
const CLIP_EMOJI: Record<string, string> = {
  video: "🎬", audio: "🔊", text: "✏️", image: "🖼️",
};

function TimelineClip({ clip, scale, selected, onSelect, onDelete, onDragEnd }: {
  clip: ClipItem; scale: number; selected: boolean; onSelect: () => void;
  onDelete: () => void; onDragEnd: (newStart: number) => void;
}) {
  const dragRef = useRef<{ startX: number; origStart: number } | null>(null);
  const [dragging, setDragging] = useState(false);
  const [dragOff, setDragOff] = useState(0);

  const effectiveDur = (clip.trimEnd - clip.trimStart) * clip.durationSec || clip.durationSec;
  const width  = Math.max(10, effectiveDur * scale);
  const left   = clip.startSec * scale;
  const border = selected ? C.gold : CLIP_BORDER[clip.type] || "#555";

  const handleMouseDown = (e: React.MouseEvent) => {
    e.stopPropagation(); onSelect();
    dragRef.current = { startX: e.clientX, origStart: clip.startSec };
    setDragging(true);
    const onMove = (ev: MouseEvent) => { if (dragRef.current) setDragOff(ev.clientX - dragRef.current.startX); };
    const onUp   = (ev: MouseEvent) => {
      if (!dragRef.current) return;
      const dx = ev.clientX - dragRef.current.startX;
      onDragEnd(Math.max(0, dragRef.current.origStart + dx / scale));
      dragRef.current = null; setDragging(false); setDragOff(0);
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  };

  return (
    <div onMouseDown={handleMouseDown} style={{
      position:"absolute", left:left+(dragging?dragOff:0), top:5, width,
      height:TRACK_HEIGHT-10, background:CLIP_COLORS[clip.type]||"#1a1a2a",
      border:`1.5px solid ${border}`, borderRadius:5, cursor:dragging?"grabbing":"grab",
      overflow:"hidden", display:"flex", alignItems:"center", padding:"0 6px", gap:4,
      opacity:clip.muted?0.45:1, boxShadow:selected?`0 0 0 2px ${border}40`:"none",
      userSelect:"none", zIndex:dragging?100:(selected?10:1),
      transition:dragging?"none":"box-shadow 0.15s",
    }}>
      {clip.thumbnail && (
        <img src={clip.thumbnail} alt="" style={{ position:"absolute", inset:0, width:"100%", height:"100%", objectFit:"cover", opacity:0.2, borderRadius:4 }} />
      )}
      <span style={{ fontSize:10, zIndex:1, flexShrink:0 }}>{CLIP_EMOJI[clip.type]||"▪"}</span>
      <span style={{ fontSize:9, color:"#ccc", whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis", zIndex:1, flex:1 }}>
        {clip.textProps?.content || clip.name}
      </span>
      {clip.aiGenerated && <span style={{ ...S.tag, background:"rgba(200,168,75,0.2)", color:C.gold, zIndex:1, fontSize:8 }}>IA</span>}
      {selected && (
        <button onMouseDown={e=>{e.stopPropagation();onDelete();}} style={{
          position:"absolute", top:2, right:2, background:"rgba(220,50,50,0.8)", border:"none",
          borderRadius:3, color:"#fff", cursor:"pointer", padding:"1px 4px", fontSize:9, zIndex:20,
        }}>×</button>
      )}
    </div>
  );
}

// ─── AI Panel Modal ───────────────────────────────────────────────────────────
type AIMode = "t2v" | "i2v" | "v2v" | "voice" | "music" | "face-swap" | "inpaint" | "outpaint" | "variations" | "audio-mix" | "extend";

function AIGenerateModal({ mode, projectId, onClose, onClipReady, onError }: {
  mode: AIMode; projectId: number; onClose: () => void;
  onClipReady: (clip: Partial<ClipItem>) => void; onError: (m: string) => void;
}) {
  const [prompt, setPrompt] = useState("");
  const [model, setModel]   = useState("seedance-fast");
  const [file, setFile]     = useState<File|null>(null);
  const [file2, setFile2]   = useState<File|null>(null);
  const [voiceId, setVoiceId] = useState(VOICE_OPTIONS[0].id);
  const [stability, setStability] = useState(0.5);
  const [style, setStyle]   = useState(0.5);
  const [direction, setDir] = useState("all");
  const [busy, setBusy]     = useState(false);
  const [liveMsg, setLive]  = useState("");

  const TITLES: Record<AIMode, string> = {
    "t2v":"🎬 Texto → Video", "i2v":"🖼️ Imagen → Video", "v2v":"♻️ Video → Video",
    "voice":"🎙️ Narración TTS", "music":"🎵 Música IA", "face-swap":"👤 Face Swap",
    "inpaint":"🖌️ Inpainting", "outpaint":"↔️ Outpainting", "variations":"✨ Variaciones Imagen",
    "audio-mix":"🎚️ Mezclar Audio",
    "extend":"↔️ Extender Video",
  };

  const doGenerate = async () => {
    setBusy(true); setLive("Enviando a servidor IA...");
    try {
      let url = ""; let vaultId = 0; let type: ClipType = "video";
      const fd = new FormData();
      fd.append("projectId", String(projectId));

      if (mode === "t2v") {
        fd.append("prompt", prompt); fd.append("model", model);
        setLive("Generando video con IA (1-3 min)...");
        const r = await fetch(`${API_BASE}/api/fs-pro/generate-video`, { method:"POST", credentials:"include", body:fd });
        const d = await r.json(); if (!r.ok) throw new Error(d.error||"Error");
        vaultId = d.vaultId; url = d.url || `${API_BASE}/api/projects/${projectId}/vault/${vaultId}/download`;
        type = "video";
      } else if (mode === "i2v" || mode === "v2v") {
        if (!file) throw new Error("Sube un archivo primero");
        fd.append(mode==="v2v"?"video":"image", file);
        fd.append("prompt", prompt); fd.append("model", model);
        setLive(`Procesando ${mode==="v2v"?"video":"imagen"} con IA...`);
        const ep = mode==="v2v" ? "/api/fs-pro/video/v2v" : "/api/fs-pro/video/generate";
        const r = await fetch(`${API_BASE}${ep}`, { method:"POST", credentials:"include", body:fd });
        const d = await r.json(); if (!r.ok) throw new Error(d.error||"Error");
        vaultId = d.vaultId; url = d.url || `${API_BASE}/api/projects/${projectId}/vault/${vaultId}/download`;
        type = "video";
      } else if (mode === "voice") {
        setLive("Generando narración con ElevenLabs...");
        const r = await fetch(`${API_BASE}/api/fs-pro/tts/advanced`, {
          method:"POST", credentials:"include", headers:{"Content-Type":"application/json"},
          body: JSON.stringify({ text:prompt, voiceId, model:"eleven_v3", stability, style, similarityBoost:0.75, projectId }),
        });
        const d = await r.json(); if (!r.ok) throw new Error(d.error||"Error");
        vaultId = d.vaultId; url = d.url || `${API_BASE}/api/projects/${projectId}/vault/${vaultId}/download`;
        type = "audio";
      } else if (mode === "music") {
        setLive("Generando música con IA...");
        const r = await fetch(`${API_BASE}/api/fs-pro/generate-music`, {
          method:"POST", credentials:"include", headers:{"Content-Type":"application/json"},
          body: JSON.stringify({ prompt, projectId, duration: 30 }),
        });
        const d = await r.json(); if (!r.ok) throw new Error(d.error||"Error");
        vaultId = d.vaultId; url = d.url || `${API_BASE}/api/projects/${projectId}/vault/${vaultId}/download`;
        type = "audio";
      } else if (mode === "face-swap") {
        if (!file || !file2) throw new Error("Sube cara e imagen destino");
        fd.append("face", file); fd.append("target", file2);
        setLive("Realizando face swap..."); 
        const r = await fetch(`${API_BASE}/api/fs-pro/image/face-swap`, { method:"POST", credentials:"include", body:fd });
        const d = await r.json(); if (!r.ok) throw new Error(d.error||"Error");
        vaultId = d.vaultId; url = d.url || d.base64; type = "image";
      } else if (mode === "inpaint") {
        if (!file || !file2) throw new Error("Sube imagen e imagen de máscara");
        fd.append("image", file); fd.append("mask", file2); fd.append("prompt", prompt);
        setLive("Inpainting con Flux...");
        const r = await fetch(`${API_BASE}/api/fs-pro/image/inpaint`, { method:"POST", credentials:"include", body:fd });
        const d = await r.json(); if (!r.ok) throw new Error(d.error||"Error");
        vaultId = d.vaultId; url = d.url || d.base64; type = "image";
      } else if (mode === "outpaint") {
        if (!file) throw new Error("Sube una imagen primero");
        fd.append("image", file); fd.append("prompt", prompt); fd.append("direction", direction);
        setLive("Expandiendo canvas con IA...");
        const r = await fetch(`${API_BASE}/api/fs-pro/image/outpaint`, { method:"POST", credentials:"include", body:fd });
        const d = await r.json(); if (!r.ok) throw new Error(d.error||"Error");
        vaultId = d.vaultId; url = d.url || d.base64; type = "image";
      } else if (mode === "variations") {
        if (!file) throw new Error("Sube una imagen primero");
        fd.append("image", file); fd.append("prompt", prompt); fd.append("count", "4");
        setLive("Generando 4 variaciones...");
        const r = await fetch(`${API_BASE}/api/fs-pro/image/variations`, { method:"POST", credentials:"include", body:fd });
        const d = await r.json(); if (!r.ok) throw new Error(d.error||"Error");
        vaultId = d.vaultId; url = d.url || d.results?.[0]?.url; type = "image";
      } else if (mode === "audio-mix") {
        if (!file || !file2) throw new Error("Sube narración y música de fondo");
        fd.append("tts", file); fd.append("music", file2);
        fd.append("musicVolume", "0.15"); fd.append("duckingEnabled", "true");
        setLive("Mezclando narración con música...");
        const r = await fetch(`${API_BASE}/api/fs-pro/audio/mix`, { method:"POST", credentials:"include", body:fd });
        const d = await r.json(); if (!r.ok) throw new Error(d.error||"Error");
        vaultId = d.vaultId; url = d.url || `${API_BASE}/api/projects/${projectId}/vault/${vaultId}/download`;
        type = "audio";
      }

      onClipReady({ type, aiUrl: url, name: `${TITLES[mode]}: ${prompt.slice(0,25)||file?.name||""}`, aiGenerated: true, durationSec: type==="audio"?30:6, volume:1, speed:1, muted:false, trimStart:0, trimEnd:1 });
      onClose();
    } catch(e:any) { onError(e.message); }
    finally { setBusy(false); setLive(""); }
  };

  const needsPrompt   = ["t2v","v2v","i2v","voice","music","inpaint","outpaint","variations"].includes(mode);
  const needsFile1    = ["i2v","v2v","face-swap","inpaint","outpaint","variations","audio-mix"].includes(mode);
  const needsFile2    = ["face-swap","inpaint","audio-mix"].includes(mode);
  const needsModel    = ["t2v","v2v","i2v"].includes(mode);
  const file1Label    = mode==="v2v"?"Video origen":mode==="audio-mix"?"Narración (WAV/MP3)":mode==="face-swap"?"Imagen de cara":mode==="inpaint"?"Imagen a editar":"Imagen";
  const file2Label    = mode==="audio-mix"?"Música de fondo (WAV/MP3)":mode==="face-swap"?"Imagen destino":"Máscara (B&W)";

  return (
    <ModalOverlay style={{ background:"rgba(0,0,0,0.78)" }}>
      <div style={{ background:C.bg3, border:`1px solid ${C.border2}`, borderRadius:12, width:440, overflow:"hidden" }}>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", padding:"12px 16px", borderBottom:`1px solid ${C.border}` }}>
          <span style={{ fontWeight:700, fontSize:14 }}>{TITLES[mode]}</span>
          <button onClick={onClose} style={S.btnIcon}><X size={16}/></button>
        </div>
        <div style={{ padding:16, display:"flex", flexDirection:"column", gap:10 }}>
          {needsFile1 && (
            <div>
              <SLabel label={file1Label}/>
              <label style={{ ...S.btn, justifyContent:"center", cursor:"pointer", borderStyle:"dashed" }}>
                <Upload size={13}/> {file ? file.name : `Subir ${file1Label}`}
                <input type="file" style={{ display:"none" }} onChange={e=>setFile(e.target.files?.[0]||null)} accept={mode==="v2v"?"video/*":mode==="audio-mix"?"audio/*":"image/*,audio/*"} />
              </label>
            </div>
          )}
          {needsFile2 && (
            <div>
              <SLabel label={file2Label}/>
              <label style={{ ...S.btn, justifyContent:"center", cursor:"pointer", borderStyle:"dashed" }}>
                <Upload size={13}/> {file2 ? file2.name : `Subir ${file2Label}`}
                <input type="file" style={{ display:"none" }} onChange={e=>setFile2(e.target.files?.[0]||null)} accept={mode==="audio-mix"?"audio/*":"image/*"} />
              </label>
            </div>
          )}
          {needsPrompt && (
            <div>
              <SLabel label={mode==="voice"?"Texto a narrar":"Prompt / descripción"}/>
              <textarea rows={3} value={prompt} onChange={e=>setPrompt(e.target.value)} placeholder={
                mode==="voice"?"Bienvenido a nuestra tienda. Descubre nuestra colección...":
                mode==="music"?"Música alegre de fondo para vídeo de producto, estilo pop positivo...":
                "Producto flotando en agua cristalina, iluminación dramática..."
              } style={S.textarea}/>
            </div>
          )}
          {mode === "voice" && (
            <>
              <div><SLabel label="Voz"/>
                <select value={voiceId} onChange={e=>setVoiceId(e.target.value)} style={S.input}>
                  {VOICE_OPTIONS.map(v=><option key={v.id} value={v.id}>{v.label}</option>)}
                </select>
              </div>
              <SliderProp label="Estabilidad" value={stability} min={0} max={1} step={0.05} onChange={setStability}/>
              <SliderProp label="Estilo" value={style} min={0} max={1} step={0.05} onChange={setStyle}/>
            </>
          )}
          {needsModel && (
            <div><SLabel label="Modelo"/>
              <select value={model} onChange={e=>setModel(e.target.value)} style={S.input}>
                {VIDEO_MODELS.map(m=><option key={m.key} value={m.key}>{m.label} ({m.time})</option>)}
              </select>
            </div>
          )}
          {mode === "outpaint" && (
            <div><SLabel label="Dirección de expansión"/>
              <select value={direction} onChange={e=>setDir(e.target.value)} style={S.input}>
                {["all","left","right","top","bottom"].map(d=><option key={d} value={d}>{d}</option>)}
              </select>
            </div>
          )}
          {busy && liveMsg && (
            <div style={{ display:"flex", alignItems:"center", gap:6, fontSize:11, color:C.gold }}>
              <Loader2 size={12} className="animate-spin"/> {liveMsg}
            </div>
          )}
          <div style={{ display:"flex", gap:8, marginTop:4 }}>
            <button onClick={onClose} style={{ ...S.btn, flex:1, justifyContent:"center" }}>Cancelar</button>
            <button onClick={doGenerate} disabled={busy} style={{ ...S.btnGold, flex:2, justifyContent:"center", opacity:busy?0.6:1 }}>
              {busy ? <Loader2 size={13} className="animate-spin"/> : <Sparkles size={13}/>}
              {busy ? "Generando..." : "Generar"}
            </button>
          </div>
        </div>
      </div>
    </ModalOverlay>
  );
}

// ─── SFX Modal ────────────────────────────────────────────────────────────────
function SFXModal({ catalog, onSelect, onClose }: {
  catalog: SFXEntry[]; onSelect: (sfx: SFXEntry) => void; onClose: () => void;
}) {
  const [filter, setFilter] = useState("Todos");
  const cats = ["Todos", ...Array.from(new Set(catalog.map(s=>s.category)))];
  const visible = filter==="Todos" ? catalog : catalog.filter(s=>s.category===filter);
  return (
    <ModalOverlay style={{ background:"rgba(0,0,0,0.78)" }}>
      <div style={{ background:C.bg3, border:`1px solid ${C.border2}`, borderRadius:12, width:540, maxHeight:"72vh", display:"flex", flexDirection:"column" }}>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", padding:"12px 16px", borderBottom:`1px solid ${C.border}` }}>
          <span style={{ fontWeight:700, fontSize:14 }}>🔊 Catálogo SFX — {catalog.length} efectos</span>
          <button onClick={onClose} style={S.btnIcon}><X size={16}/></button>
        </div>
        <div style={{ display:"flex", gap:6, padding:"8px 12px", borderBottom:`1px solid ${C.border}`, flexShrink:0, flexWrap:"wrap" }}>
          {cats.map(c=>(
            <button key={c} onClick={()=>setFilter(c)} style={{ ...S.btn, background:filter===c?C.goldDim:"none", color:filter===c?C.gold:C.textDim, borderColor:filter===c?C.gold:C.border2, fontSize:10 }}>{c}</button>
          ))}
        </div>
        <div style={{ overflow:"auto", padding:10, display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:6 }}>
          {visible.map(sfx=>(
            <button key={sfx.id} onClick={()=>{onSelect(sfx);onClose();}} style={{ ...S.btn, justifyContent:"flex-start", flexDirection:"column", alignItems:"flex-start", padding:"8px 10px", cursor:"pointer" }}>
              <span style={{ fontSize:11, fontWeight:600, color:C.text }}>{sfx.name}</span>
              <span style={{ fontSize:9, color:C.textDim }}>{sfx.category} · {sfx.duration}s</span>
            </button>
          ))}
        </div>
      </div>
    </ModalOverlay>
  );
}

// ─── Export Modal ─────────────────────────────────────────────────────────────
function ExportModal({ clips, format, projectId, totalDuration, onClose, onSuccess, onError }: {
  clips: ClipItem[]; format: FormatPreset; projectId: number; totalDuration: number;
  onClose: () => void; onSuccess: (vaultId: number, url: string) => void; onError: (m: string) => void;
}) {
  const [title, setTitle]       = useState("Mi video");
  const [crossfade, setCf]      = useState(0.4);
  const [busy, setBusy]         = useState(false);
  const [liveMsg, setLive]      = useState("");
  const [resultUrl, setResult]  = useState("");
  const videoClips = clips.filter(c=>c.type==="video"&&c.file).sort((a,b)=>a.startSec-b.startSec);
  const hasVoice   = clips.some(c=>c.trackId==="voice"&&c.file);
  const hasMusic   = clips.some(c=>c.trackId==="music"&&c.file);

  const doExport = async () => {
    if (videoClips.length===0) { onError("Añade al menos 1 clip de video local"); return; }
    setBusy(true); setLive("Preparando archivos...");
    try {
      const fd = new FormData();
      fd.append("projectId", String(projectId));
      fd.append("title", title);
      fd.append("format", format.id);
      fd.append("width", String(format.w));
      fd.append("height", String(format.h));
      fd.append("fps", String(format.fps));
      fd.append("crossfadeDuration", String(crossfade));
      fd.append("totalDuration", String(totalDuration));
      videoClips.forEach((c,i) => { if(c.file) fd.append(`video_${i}`, c.file); });
      const voiceClip = clips.find(c=>c.trackId==="voice"&&c.file);
      const musicClip = clips.find(c=>c.trackId==="music"&&c.file);
      if (voiceClip?.file) fd.append("voice", voiceClip.file);
      if (musicClip?.file) fd.append("music", musicClip.file);
      setLive("Procesando con FFmpeg en servidor...");
      const r = await fetch(`${API_BASE}/api/fs-pro/concat-export`, { method:"POST", credentials:"include", body:fd });
      const d = await r.json(); if (!r.ok) throw new Error(d.error||"Error");
      setResult(d.url || `${API_BASE}/api/projects/${projectId}/vault/${d.vaultId}/download`);
      onSuccess(d.vaultId, d.url);
      setLive("✅ Exportado correctamente");
    } catch(e:any) { onError(e.message); }
    finally { setBusy(false); }
  };

  return (
    <ModalOverlay style={{ background:"rgba(0,0,0,0.78)" }}>
      <div style={{ background:C.bg3, border:`1px solid ${C.border2}`, borderRadius:12, width:440, overflow:"hidden" }}>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", padding:"12px 16px", borderBottom:`1px solid ${C.border}` }}>
          <span style={{ fontWeight:700, fontSize:14 }}>🎬 Exportar video final</span>
          <button onClick={onClose} style={S.btnIcon}><X size={16}/></button>
        </div>
        <div style={{ padding:16, display:"flex", flexDirection:"column", gap:10 }}>
          <div style={{ background:C.bg1, borderRadius:8, padding:12, fontSize:11, display:"grid", gridTemplateColumns:"1fr 1fr", gap:6 }}>
            <div style={{ color:C.textDim }}>Formato: <span style={{ color:C.gold, fontWeight:700 }}>{format.label} ({format.aspect})</span></div>
            <div style={{ color:C.textDim }}>Resolución: <span style={{ color:C.text }}>{format.w}×{format.h}@{format.fps}fps</span></div>
            <div style={{ color:C.textDim }}>Clips video: <span style={{ color:C.text }}>{videoClips.length}</span></div>
            <div style={{ color:C.textDim }}>Duración: <span style={{ color:C.text }}>{fmtTime(totalDuration)}</span></div>
            <div style={{ color:C.textDim }}>Voz: <span style={{ color:hasVoice?"#7fb38a":C.textFaint }}>{hasVoice?"✓":"—"}</span></div>
            <div style={{ color:C.textDim }}>Música: <span style={{ color:hasMusic?"#7fb38a":C.textFaint }}>{hasMusic?"✓":"—"}</span></div>
          </div>
          <div><SLabel label="Título del proyecto"/><input value={title} onChange={e=>setTitle(e.target.value)} style={S.input}/></div>
          <SliderProp label="Crossfade entre clips" value={crossfade} min={0} max={1.5} step={0.1} onChange={setCf} unit="s"/>
          {videoClips.length===0 && (
            <div style={{ background:"rgba(220,80,80,0.1)", border:"1px solid rgba(220,80,80,0.3)", borderRadius:6, padding:"8px 12px", fontSize:11, color:"#e06060" }}>
              ⚠️ Necesitas al menos 1 clip de video local para exportar.
            </div>
          )}
          {liveMsg && <div style={{ display:"flex", alignItems:"center", gap:6, fontSize:11, color:C.gold }}><Loader2 size={12} className={busy?"animate-spin":""}/>  {liveMsg}</div>}
          {resultUrl && (
            <div>
              <video src={resultUrl} controls style={{ width:"100%", borderRadius:8, background:"#000", maxHeight:160 }}/>
              <a href={resultUrl} download={`${title}.mp4`} style={{ ...S.btnGold, marginTop:6, justifyContent:"center", textDecoration:"none", display:"flex" }}>
                <Download size={14}/> Descargar MP4
              </a>
            </div>
          )}
          <button onClick={doExport} disabled={busy||videoClips.length===0} style={{ ...S.btnGold, justifyContent:"center", padding:"11px 20px", fontSize:13, opacity:(busy||videoClips.length===0)?0.5:1 }}>
            {busy?<Loader2 size={14} className="animate-spin"/>:<Download size={14}/>}
            {busy?"Procesando con FFmpeg…":"Exportar MP4 final"}
          </button>
        </div>
      </div>
    </ModalOverlay>
  );
}

// ─── TrimPanel — recorte rápido en inspector ──────────────────────────────────
function TrimPanel({ clip, updateClip }: { clip: ClipItem; updateClip: (id:string, u:Partial<ClipItem>)=>void }) {
  const [start, setStart] = useState(clip.trimStart ?? 0);
  const [end,   setEnd]   = useState(clip.trimEnd   ?? 1);
  const apply = () => {
    const dur = clip.durationSec;
    updateClip(clip.id, { trimStart: start, trimEnd: end, durationSec: (end - start) * dur });
  };
  return (
    <div style={{ fontSize:10 }}>
      <div style={{ color:"#aaa", marginBottom:6 }}>
        Ajusta el rango de reproducción (0–1 = inicio–fin del clip)
      </div>
      <div style={{ display:"flex", flexDirection:"column", gap:5 }}>
        <label style={{ color:"#aaa" }}>Inicio: {(start * clip.durationSec).toFixed(1)}s</label>
        <input type="range" min={0} max={0.99} step={0.01} value={start}
          onChange={e=>setStart(parseFloat(e.target.value))} style={{ accentColor:"#c8a84b", width:"100%" }}/>
        <label style={{ color:"#aaa" }}>Fin: {(end * clip.durationSec).toFixed(1)}s</label>
        <input type="range" min={0.01} max={1} step={0.01} value={end}
          onChange={e=>setEnd(parseFloat(e.target.value))} style={{ accentColor:"#c8a84b", width:"100%" }}/>
        <div style={{ fontSize:9, color:"#888" }}>
          Duración recortada: {((end - start) * clip.durationSec).toFixed(1)}s
        </div>
        <button onClick={apply} style={{ background:"#1a3a2a", border:"1px solid #2d6a4f", color:"#5db88a", borderRadius:4, padding:"4px 10px", cursor:"pointer", fontSize:10 }}>
          ✂️ Aplicar recorte
        </button>
      </div>
    </div>
  );
}

// ─── VoicePanel — añadir narración IA sincronizada ───────────────────────────
function VoicePanel({ clip, projectId, onError, onSuccess }: {
  clip: ClipItem; projectId: number;
  onError: (m:string)=>void; onSuccess: (vaultId:number)=>void;
}) {
  const [script, setScript] = useState("");
  const [voiceId, setVoiceId] = useState("21m00Tcm4TlvDq8ikWAM");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  const VOICES = [
    { id:"21m00Tcm4TlvDq8ikWAM", label:"Rachel (ES)" },
    { id:"EXAVITQu4vr4xnSDxMaL", label:"Bella (ES)" },
    { id:"AZnzlk1XvdvUeBnXmlld", label:"Domi (ES)" },
    { id:"D38z5RcWu1voky8WS1ja", label:"Fin (EN)" },
    { id:"ThT5KcBeYPX3keUQqHPh", label:"Dorothy (EN)" },
  ];

  const go = async () => {
    if (!script.trim()) { onError("Escribe el texto de la narración"); return; }
    const vaultId = clip.aiUrl ? null : null; // We need vaultId from clip
    // Extract vault ID from aiUrl if it looks like /vault/123/download
    const match = (clip.aiUrl||"").match(/\/vault\/(\d+)\//);
    if (!match) { onError("El clip necesita estar guardado en la bóveda primero"); return; }
    setBusy(true); setDone(false);
    try {
      const r = await fetch(`${API_BASE}/api/fs-pro/add-voice`, {
        method:"POST", credentials:"include", headers:{"Content-Type":"application/json"},
        body: JSON.stringify({ projectId, vaultId: parseInt(match[1]), script, voiceId }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error||"Error");
      setDone(true);
      onSuccess(d.vaultId);
    } catch(e:any) { onError(e.message); }
    finally { setBusy(false); }
  };

  return (
    <div style={{ fontSize:10 }}>
      <textarea value={script} onChange={e=>setScript(e.target.value)} rows={3}
        placeholder="Texto de la narración que sincronizará exactamente con la duración del vídeo…"
        style={{ width:"100%", background:"#111", border:"1px solid #333", color:"#fff", borderRadius:4, padding:6, fontSize:10, resize:"vertical", boxSizing:"border-box" }}/>
      <select value={voiceId} onChange={e=>setVoiceId(e.target.value)}
        style={{ width:"100%", background:"#111", border:"1px solid #333", color:"#fff", borderRadius:4, padding:5, marginTop:5, fontSize:10 }}>
        {VOICES.map(v=><option key={v.id} value={v.id}>{v.label}</option>)}
      </select>
      <button onClick={go} disabled={busy} style={{ marginTop:6, width:"100%", background:"#1a3a2a", border:"1px solid #2d6a4f", color:done?"#5db88a":"#c8a84b", borderRadius:4, padding:"5px 0", cursor:"pointer", fontSize:10 }}>
        {busy ? <>{<Loader2 size={10}/>} Generando…</> : done ? "✅ Narración añadida" : "🎙️ Generar narración sincronizada"}
      </button>
    </div>
  );
}

// ─── BurnTextPanel — quemar texto/subtítulos/caption ─────────────────────────
function BurnTextPanel({ clip, projectId, onError, onSuccess }: {
  clip: ClipItem; projectId: number;
  onError: (m:string)=>void; onSuccess: (vaultId:number)=>void;
}) {
  const [mode, setMode] = useState<"text"|"auto-subtitles"|"watermark"|"tiktok-caption"|"intro"|"outro">("text");
  const [text, setText] = useState("");
  const [fontSize, setFontSize] = useState(48);
  const [color, setColor] = useState("#FFFFFF");
  const [position, setPosition] = useState<"top"|"center"|"bottom">("bottom");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  const MODES: {key:typeof mode; label:string}[] = [
    {key:"text",          label:"📝 Texto libre"},
    {key:"auto-subtitles",label:"🤖 Subtítulos auto (IA)"},
    {key:"tiktok-caption",label:"🎵 Caption TikTok"},
    {key:"watermark",     label:"💧 Marca de agua"},
    {key:"intro",         label:"▶️ Intro"},
    {key:"outro",         label:"⏹ Outro"},
  ];

  const go = async () => {
    const match = (clip.aiUrl||"").match(/\/vault\/(\d+)\//);
    if (!match) { onError("El clip necesita estar guardado en la bóveda primero"); return; }
    if (mode!=="auto-subtitles" && !text.trim()) { onError("Escribe el texto"); return; }
    setBusy(true); setDone(false);
    try {
      const r = await fetch(`${API_BASE}/api/fs-pro/burn-text`, {
        method:"POST", credentials:"include", headers:{"Content-Type":"application/json"},
        body: JSON.stringify({ projectId, vaultId: parseInt(match[1]), mode, text: text||undefined,
          style: { fontSize, color: color.replace("#",""), position } }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error||"Error");
      setDone(true);
      onSuccess(d.vaultId);
    } catch(e:any) { onError(e.message); }
    finally { setBusy(false); }
  };

  return (
    <div style={{ fontSize:10 }}>
      <div style={{ display:"flex", flexWrap:"wrap", gap:3, marginBottom:7 }}>
        {MODES.map(m=>(
          <button key={m.key} onClick={()=>setMode(m.key)}
            style={{ background:mode===m.key?"#2a2a00":"#111", border:`1px solid ${mode===m.key?"#c8a84b":"#333"}`,
              color:mode===m.key?"#c8a84b":"#888", borderRadius:4, padding:"3px 6px", cursor:"pointer", fontSize:9 }}>
            {m.label}
          </button>
        ))}
      </div>
      {mode!=="auto-subtitles" && (
        <textarea value={text} onChange={e=>setText(e.target.value)} rows={2}
          placeholder="Texto a quemar en el vídeo…"
          style={{ width:"100%", background:"#111", border:"1px solid #333", color:"#fff", borderRadius:4, padding:6, fontSize:10, resize:"vertical", boxSizing:"border-box", marginBottom:5 }}/>
      )}
      {mode==="auto-subtitles" && (
        <div style={{ color:"#888", fontSize:9, marginBottom:5 }}>
          🤖 Whisper transcribirá el audio y generará subtítulos automáticamente
        </div>
      )}
      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:5, marginBottom:5 }}>
        <div>
          <div style={{ color:"#888", marginBottom:2 }}>Tamaño</div>
          <input type="number" value={fontSize} min={12} max={120} onChange={e=>setFontSize(parseInt(e.target.value))}
            style={{ width:"100%", background:"#111", border:"1px solid #333", color:"#fff", borderRadius:4, padding:"3px 6px", fontSize:10 }}/>
        </div>
        <div>
          <div style={{ color:"#888", marginBottom:2 }}>Color</div>
          <input type="color" value={color} onChange={e=>setColor(e.target.value)}
            style={{ width:"100%", background:"#111", border:"1px solid #333", borderRadius:4, padding:2, height:26, cursor:"pointer" }}/>
        </div>
      </div>
      <select value={position} onChange={e=>setPosition(e.target.value as any)}
        style={{ width:"100%", background:"#111", border:"1px solid #333", color:"#fff", borderRadius:4, padding:5, marginBottom:5, fontSize:10 }}>
        <option value="top">Superior</option>
        <option value="center">Centro</option>
        <option value="bottom">Inferior</option>
      </select>
      <button onClick={go} disabled={busy} style={{ width:"100%", background:"#1a3a2a", border:"1px solid #2d6a4f",
        color:done?"#5db88a":"#c8a84b", borderRadius:4, padding:"5px 0", cursor:"pointer", fontSize:10 }}>
        {busy ? "Procesando…" : done ? "✅ Texto quemado" : "🔥 Quemar en vídeo"}
      </button>
    </div>
  );
}

// ─── Main VideoStudio ─────────────────────────────────────────────────────────
export default function VideoStudio({ projectId, onSuccess, onError }: {
  projectId: number;
  onSuccess: (it: { vaultId: number; type: string; label: string; mimeType: string }) => void;
  onError:   (m: string) => void;
}) {
  const [tracks]        = useState<Track[]>(DEFAULT_TRACKS);
  const [clips, setClips] = useState<ClipItem[]>([]);
  const [selectedId, setSelectedId] = useState<string|null>(null);
  const [currentSec, setCurrentSec] = useState(0);
  const [isPlaying, setIsPlaying]   = useState(false);
  const [format, setFormat]         = useState<FormatPreset>(FORMAT_PRESETS[0]);
  const [scale, setScale]           = useState(PX_PER_SEC);
  const [sideTab, setSideTab]       = useState<SidebarTab>("media");
  const [aiMode, setAiMode]         = useState<AIMode|null>(null);
  const [showSfx, setShowSfx]       = useState(false);
  const [showExport, setShowExport] = useState(false);
  const [sfxCatalog, setSfxCatalog] = useState<SFXEntry[]>(SFX_CATALOG_STATIC);
  const [trackMuted, setTrackMuted] = useState<Record<string,boolean>>({});
  const [trackLocked, setTrackLocked] = useState<Record<string,boolean>>({});
  const [previewFit, setPreviewFit] = useState<"fill"|"fit">("fit");
  const [showGrid, setShowGrid]     = useState(false);
  const [sfxLoaded, setSfxLoaded]   = useState(false);
  const [fullScreen, setFullScreen] = useState(false);
  // En pantalla completa el estudio tapa toda la página; ocultar los widgets flotantes igual que un modal.
  useModalLock(fullScreen);

  // ── Canvas overlay system (T003) ──────────────────────────────────────────
  const [overlays, setOverlays]           = useState<CanvasOverlay[]>([]);
  const [selectedOverlayId, setSelOvId]   = useState<string|null>(null);
  const [overlayMode, setOverlayMode]     = useState<"select"|"add-text"|"add-emoji"|"add-image">("select");
  const [showOverlayPanel, setShowOvPanel]= useState(false);
  const [dragOvId, setDragOvId]           = useState<string|null>(null);
  const [dragStart, setDragStart]         = useState<{mx:number;my:number;ox:number;oy:number}|null>(null);
  const previewRef = useRef<HTMLDivElement>(null);

  const videoRef          = useRef<HTMLVideoElement>(null);
  const playIntervalRef   = useRef<ReturnType<typeof setInterval>|null>(null);
  const timelineScrollRef = useRef<HTMLDivElement>(null);
  const fileInputRef      = useRef<HTMLInputElement>(null);
  const uploadTrackRef    = useRef<string>("video1");

  // ── Derived
  const selectedClip = useMemo(()=>clips.find(c=>c.id===selectedId)||null, [clips, selectedId]);
  const totalDuration = useMemo(()=>{
    if (clips.length===0) return 30;
    return Math.max(30, ...clips.map(c=>c.startSec+c.durationSec));
  }, [clips]);
  const videoClipsInOrder = useMemo(()=>
    clips.filter(c=>c.type==="video"&&(c.trackId==="video1"||c.trackId==="video2"))
      .sort((a,b)=>a.startSec-b.startSec),
  [clips]);

  // ── Playback
  useEffect(()=>{
    if (isPlaying) {
      playIntervalRef.current = setInterval(()=>{
        setCurrentSec(s=>{ if(s>=totalDuration){setIsPlaying(false);return 0;} return s+0.1; });
      }, 100);
    } else {
      if (playIntervalRef.current) clearInterval(playIntervalRef.current);
    }
    return ()=>{ if(playIntervalRef.current) clearInterval(playIntervalRef.current); };
  }, [isPlaying, totalDuration]);

  useEffect(()=>{
    const ac = videoClipsInOrder.find(c=>currentSec>=c.startSec&&currentSec<c.startSec+c.durationSec);
    if (ac&&videoRef.current) {
      const relT = currentSec-ac.startSec;
      const src  = ac.blobUrl||ac.aiUrl||"";
      if (videoRef.current.src!==src&&src) { videoRef.current.src=src; videoRef.current.load(); }
      if (Math.abs(videoRef.current.currentTime-relT)>0.3) videoRef.current.currentTime=relT;
      if (isPlaying&&videoRef.current.paused) videoRef.current.play().catch(()=>{});
      if (!isPlaying&&!videoRef.current.paused) videoRef.current.pause();
    }
  }, [currentSec, isPlaying, videoClipsInOrder]);

  // ── Keyboard shortcuts
  useEffect(()=>{
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement||e.target instanceof HTMLTextAreaElement) return;
      if (e.code==="Space") { e.preventDefault(); setIsPlaying(p=>!p); }
      if (e.code==="Delete"||e.code==="Backspace") { if(selectedId) deleteClip(selectedId); }
      if (e.code==="KeyJ") setCurrentSec(0);
      if (e.code==="ArrowLeft") setCurrentSec(s=>Math.max(0,s-1));
      if (e.code==="ArrowRight") setCurrentSec(s=>Math.min(totalDuration,s+1));
      if (e.code==="Escape") setFullScreen(false);
      if (e.code==="KeyF"&&e.ctrlKey) { e.preventDefault(); setFullScreen(fs=>!fs); }
    };
    window.addEventListener("keydown",onKey);
    return ()=>window.removeEventListener("keydown",onKey);
  }, [selectedId, totalDuration]);

  // ── Load live SFX catalog from server
  const loadSfxCatalog = useCallback(async()=>{
    if (sfxLoaded) { setShowSfx(true); return; }
    try {
      const r = await fetch(`${API_BASE}/api/fs-pro/audio/sfx-catalog`);
      if (r.ok) { const d = await r.json(); setSfxCatalog(d.catalog||SFX_CATALOG_STATIC); setSfxLoaded(true); }
    } catch { /* use static */ }
    setShowSfx(true);
  }, [sfxLoaded]);

  // ── Clip operations
  const updateClip = useCallback((id:string, update:Partial<ClipItem>)=>{
    setClips(prev=>prev.map(c=>c.id===id?{...c,...update}:c));
  }, []);
  const deleteClip = useCallback((id:string)=>{
    setClips(prev=>prev.filter(c=>c.id!==id));
    setSelectedId(s=>s===id?null:s);
  }, []);
  const duplicateClip = useCallback((id:string)=>{
    const clip = clips.find(c=>c.id===id); if(!clip) return;
    setClips(prev=>[...prev, { ...clip, id:uid(), startSec:clip.startSec+clip.durationSec+0.1 }]);
  }, [clips]);

  const addMediaFiles = useCallback(async(files:FileList|null, targetTrack="video1")=>{
    if (!files) return;
    for (const file of Array.from(files)) {
      const isV=file.type.startsWith("video/"), isA=file.type.startsWith("audio/"), isI=file.type.startsWith("image/");
      if (!isV&&!isA&&!isI) continue;
      const type:ClipType = isV?"video":isA?"audio":"image";
      const blobUrl = URL.createObjectURL(file);
      let duration=5, thumbnail="";
      const trackId = isA?(file.name.toLowerCase().includes("music")?"music":"voice"):
                      isI?"image1":targetTrack;
      if (isV) { duration=await getVideoDuration(file); thumbnail=await getVideoThumbnail(file); }
      else if (isA) {
        duration=await new Promise<number>(res=>{
          const a=document.createElement("audio"); a.preload="metadata";
          a.onloadedmetadata=()=>res(a.duration||30); a.onerror=()=>res(30); a.src=blobUrl;
        });
      }
      const lastEnd = Math.max(0,...clips.filter(c=>c.trackId===trackId).map(c=>c.startSec+c.durationSec));
      setClips(prev=>[...prev, { id:uid(), trackId, type, name:file.name, file, blobUrl, durationSec:duration, startSec:lastEnd, trimStart:0, trimEnd:1, volume:1, speed:1, muted:false, thumbnail, opacity:1, brightness:1, contrast:1 }]);
    }
  }, [clips]);

  const addTextClip = useCallback((preset:typeof TEXT_PRESETS[0])=>{
    const lastEnd = Math.max(0,...clips.filter(c=>c.trackId==="text1").map(c=>c.startSec+c.durationSec));
    setClips(prev=>[...prev, { id:uid(), trackId:"text1", type:"text", name:preset.label, durationSec:5, startSec:lastEnd, trimStart:0, trimEnd:1, volume:0, speed:1, muted:false,
      textProps:{ content:preset.label, fontSize:preset.fontSize, color:"#ffffff", bgColor:"rgba(0,0,0,0.55)", position:preset.position, bold:preset.bold, italic:false, shadow:preset.shadow } }]);
  }, [clips]);

  const addSFXClip = useCallback((sfx:SFXEntry)=>{
    const lastEnd = Math.max(0,...clips.filter(c=>c.trackId==="sfx").map(c=>c.startSec+c.durationSec));
    setClips(prev=>[...prev, { id:uid(), trackId:"sfx", type:"audio", name:sfx.name, aiUrl:sfx.url, durationSec:sfx.duration, startSec:lastEnd, trimStart:0, trimEnd:1, volume:0.8, speed:1, muted:false }]);
  }, [clips]);

  const addAIClip = useCallback((partial:Partial<ClipItem>)=>{
    const trackId = partial.type==="audio"?(partial.name?.toLowerCase().includes("narra")||partial.name?.toLowerCase().includes("tts")?"voice":"music"):"video1";
    const lastEnd  = Math.max(0,...clips.filter(c=>c.trackId===trackId).map(c=>c.startSec+c.durationSec));
    setClips(prev=>[...prev, { id:uid(), trackId, startSec:lastEnd, trimStart:0, trimEnd:1, volume:1, speed:1, muted:false, durationSec:6, ...partial, name:partial.name||"IA clip" } as ClipItem]);
  }, [clips]);

  const handleTimelineClick = (e: React.MouseEvent<HTMLDivElement>)=>{
    const rect = e.currentTarget.getBoundingClientRect();
    const x    = e.clientX-rect.left;
    const t    = Math.max(0, x/scale);
    setCurrentSec(t);
  };

  // ─── LEFT PANEL: Media Library ────────────────────────────────────────────
  const LeftPanel = ()=>(
    <div style={S.leftPanel}>
      {/* Tab bar */}
      <div style={{ display:"flex", borderBottom:`1px solid ${C.border}`, flexShrink:0, overflowX:"auto" }}>
        {([
          ["media",    "📁", "Media"],
          ["ai",       "🤖", "IA Gen"],
          ["effects",  "✨", "Efectos"],
          ["audio",    "🔊", "Audio"],
          ["text",     "✏️", "Texto"],
          ["templates","📐", "Plantillas"],
        ] as [SidebarTab,string,string][]).map(([id,icon,label])=>(
          <button key={id} onClick={()=>setSideTab(id)} style={{
            flex:"0 0 auto", padding:"7px 9px", fontSize:9, fontWeight:600, letterSpacing:0.3,
            textAlign:"center", cursor:"pointer", background:"none", border:"none",
            color:sideTab===id?C.gold:C.textDim, borderBottom:sideTab===id?`2px solid ${C.gold}`:"2px solid transparent",
            textTransform:"uppercase", transition:"color 0.15s", whiteSpace:"nowrap",
          }}>
            <div style={{ fontSize:13 }}>{icon}</div>
            <div>{label}</div>
          </button>
        ))}
      </div>

      <div style={{ flex:1, overflowY:"auto" }}>

        {/* ── MEDIA TAB */}
        {sideTab==="media" && (
          <div>
            <SSection title="📤 Importar archivos" defaultOpen>
              <label style={{ ...S.btnGold, justifyContent:"center", cursor:"pointer", marginBottom:6, display:"flex", width:"100%", boxSizing:"border-box" }}>
                <Upload size={12}/> Subir video/imagen/audio
                <input ref={fileInputRef} type="file" multiple accept="video/*,audio/*,image/*" style={{ display:"none" }}
                  onChange={e=>{ addMediaFiles(e.target.files, uploadTrackRef.current); e.target.value=""; }}/>
              </label>
              <div style={{ fontSize:9, color:C.textFaint, textAlign:"center", marginBottom:4 }}>
                Selecciona varios archivos a la vez (Ctrl/Cmd+click)
              </div>
              <div style={{ fontSize:9, color:C.textFaint, textAlign:"center" }}>
                Arrastra archivos a las pistas
              </div>
            </SSection>
            <SSection title="🎬 Media en proyecto" defaultOpen>
              {clips.length===0
                ? <div style={{ fontSize:10, color:C.textFaint, textAlign:"center", padding:"10px 0" }}>Sin clips aún</div>
                : clips.filter(c=>c.file||c.blobUrl).map(c=>(
                  <div key={c.id} onClick={()=>setSelectedId(c.id)} style={{
                    display:"flex", alignItems:"center", gap:6, padding:"5px 4px", borderRadius:4, cursor:"pointer",
                    background:selectedId===c.id?C.goldDim:"none", marginBottom:2,
                  }}>
                    {c.thumbnail && <img src={c.thumbnail} alt="" style={{ width:40, height:24, objectFit:"cover", borderRadius:3, flexShrink:0 }}/>}
                    {!c.thumbnail && <div style={{ width:40, height:24, background:CLIP_COLORS[c.type], borderRadius:3, flexShrink:0, display:"flex", alignItems:"center", justifyContent:"center", fontSize:11 }}>{CLIP_EMOJI[c.type]}</div>}
                    <div style={{ minWidth:0 }}>
                      <div style={{ fontSize:9.5, color:C.text, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{c.name}</div>
                      <div style={{ fontSize:8.5, color:C.textDim }}>{fmtTime(c.durationSec)} · {c.type}</div>
                    </div>
                  </div>
                ))
              }
            </SSection>
          </div>
        )}

        {/* ── AI GEN TAB */}
        {sideTab==="ai" && (
          <div>
            <SSection title="🎬 Generar video" defaultOpen>
              {([["t2v","Texto → Video","Genera desde un prompt"],["i2v","Imagen → Video","Anima una imagen"],["v2v","Video → Video","Transforma el estilo"]] as [AIMode,string,string][]).map(([m,lbl,desc])=>(
                <button key={m} onClick={()=>setAiMode(m)} style={{ ...S.btn, width:"100%", justifyContent:"flex-start", marginBottom:4, flexDirection:"column", alignItems:"flex-start", padding:"8px 10px" }}>
                  <span style={{ fontWeight:700, color:C.text, fontSize:11 }}>{lbl}</span>
                  <span style={{ fontSize:9, color:C.textDim }}>{desc}</span>
                </button>
              ))}
            </SSection>
            <SSection title="🖼️ Editar imagen" defaultOpen>
              {([["face-swap","👤 Face Swap","Intercambia caras"],["inpaint","🖌️ Inpaint","Rellena con IA"],["outpaint","↔️ Outpaint","Expande el canvas"],["variations","✨ Variaciones","4 variantes de imagen"]] as [AIMode,string,string][]).map(([m,lbl,desc])=>(
                <button key={m} onClick={()=>setAiMode(m)} style={{ ...S.btn, width:"100%", justifyContent:"flex-start", marginBottom:4, flexDirection:"column", alignItems:"flex-start", padding:"7px 10px" }}>
                  <span style={{ fontWeight:700, color:C.text, fontSize:10.5 }}>{lbl}</span>
                  <span style={{ fontSize:9, color:C.textDim }}>{desc}</span>
                </button>
              ))}
            </SSection>
            <SSection title="🎙️ Generar audio" defaultOpen>
              {([["voice","Narración TTS","ElevenLabs v3, 74 idiomas"],["music","Música de fondo","IA generativa"],["audio-mix","Mezclar TTS + Música","Ducking automático"]] as [AIMode,string,string][]).map(([m,lbl,desc])=>(
                <button key={m} onClick={()=>setAiMode(m)} style={{ ...S.btn, width:"100%", justifyContent:"flex-start", marginBottom:4, flexDirection:"column", alignItems:"flex-start", padding:"7px 10px" }}>
                  <span style={{ fontWeight:700, color:C.text, fontSize:10.5 }}>{lbl}</span>
                  <span style={{ fontSize:9, color:C.textDim }}>{desc}</span>
                </button>
              ))}
            </SSection>
          </div>
        )}

        {/* ── EFFECTS TAB */}
        {sideTab==="effects" && (
          <div>
            <SSection title="🎨 Efectos de video" defaultOpen>
              <div style={{ fontSize:9.5, color:C.textDim, marginBottom:6 }}>Selecciona un clip de video primero</div>
              {VIDEO_FX.map(fx=>(
                <button key={fx} onClick={()=>{ if(selectedClip?.type==="video") updateClip(selectedClip.id,{effect:fx}); }} style={{
                  ...S.btn, width:"100%", justifyContent:"flex-start", marginBottom:3, fontSize:10,
                  color:selectedClip?.effect===fx?C.gold:C.textDim, borderColor:selectedClip?.effect===fx?C.gold:C.border2,
                }}>{fx}</button>
              ))}
            </SSection>
            <SSection title="🔄 Transiciones" defaultOpen>
              {TRANSITION_FX.map(fx=>(
                <button key={fx} style={{ ...S.btn, width:"100%", justifyContent:"flex-start", marginBottom:3, fontSize:10, color:C.textDim }}>{fx}</button>
              ))}
            </SSection>
          </div>
        )}

        {/* ── AUDIO TAB */}
        {sideTab==="audio" && (
          <div>
            <SSection title="🔊 SFX Catalog" defaultOpen>
              <button onClick={loadSfxCatalog} style={{ ...S.btnGold, width:"100%", justifyContent:"center", marginBottom:6 }}>
                <AudioLines size={12}/> Abrir catálogo ({sfxCatalog.length} efectos)
              </button>
              <div style={{ fontSize:9, color:C.textDim, textAlign:"center" }}>Efectos de sonido de e-commerce</div>
            </SSection>
            <SSection title="🎙️ Narración TTS" defaultOpen>
              <button onClick={()=>setAiMode("voice")} style={{ ...S.btn, width:"100%", justifyContent:"center", marginBottom:4 }}>
                <Mic size={12}/> Generar narración
              </button>
            </SSection>
            <SSection title="🎵 Música IA" defaultOpen>
              <button onClick={()=>setAiMode("music")} style={{ ...S.btn, width:"100%", justifyContent:"center", marginBottom:4 }}>
                <Music size={12}/> Generar música de fondo
              </button>
            </SSection>
            <SSection title="🎚️ Mezcla" defaultOpen>
              <button onClick={()=>setAiMode("audio-mix")} style={{ ...S.btn, width:"100%", justifyContent:"center", marginBottom:4 }}>
                <Blend size={12}/> Mezclar narración + música
              </button>
            </SSection>
          </div>
        )}

        {/* ── TEXT TAB */}
        {sideTab==="text" && (
          <div>
            <SSection title="✏️ Presets de texto" defaultOpen>
              {TEXT_PRESETS.map(p=>(
                <button key={p.label} onClick={()=>addTextClip(p)} style={{ ...S.btn, width:"100%", justifyContent:"flex-start", marginBottom:4, flexDirection:"column", alignItems:"flex-start", padding:"8px 10px" }}>
                  <span style={{ fontWeight:700, fontSize:p.fontSize/4, color:C.text, lineHeight:1 }}>{p.label}</span>
                  <span style={{ fontSize:8.5, color:C.textDim }}>{p.fontSize}px · {p.position} · {p.bold?"bold":""}</span>
                </button>
              ))}
            </SSection>
          </div>
        )}

        {/* ── TEMPLATES TAB */}
        {sideTab==="templates" && (
          <div>
            <SSection title="📐 Plantillas de proyecto" defaultOpen>
              {TEMPLATE_PRESETS.map(t=>(
                <button key={t.id} style={{ ...S.btn, width:"100%", justifyContent:"flex-start", marginBottom:4, flexDirection:"column", alignItems:"flex-start", padding:"9px 10px" }}>
                  <div style={{ display:"flex", alignItems:"center", gap:6 }}>
                    <span style={{ fontSize:18 }}>{t.icon}</span>
                    <div>
                      <div style={{ fontWeight:700, fontSize:11, color:C.text }}>{t.label}</div>
                      <div style={{ fontSize:9, color:C.textDim }}>{t.desc} · {t.duration}s</div>
                    </div>
                  </div>
                </button>
              ))}
            </SSection>
            <SSection title="📱 Formatos de exportación" defaultOpen>
              {FORMAT_PRESETS.map(f=>(
                <button key={f.id} onClick={()=>setFormat(f)} style={{
                  ...S.btn, width:"100%", justifyContent:"flex-start", marginBottom:3,
                  background:format.id===f.id?C.goldDim:"none",
                  borderColor:format.id===f.id?C.gold:C.border2, color:format.id===f.id?C.gold:C.textDim, fontSize:10,
                }}>
                  <span style={{ fontSize:13 }}>{f.icon}</span> {f.label} ({f.aspect})
                </button>
              ))}
            </SSection>
          </div>
        )}
      </div>
    </div>
  );

  // ─── RIGHT PANEL: Inspector ───────────────────────────────────────────────
  const RightPanel = ()=>(
    <div style={S.rightPanel}>
      <div style={S.sHead}>⚙️ Inspector</div>
      <div style={{ flex:1, overflowY:"auto" }}>
        {!selectedClip
          ? (
            <div style={{ padding:14 }}>
              <div style={{ fontSize:10, color:C.textDim, textAlign:"center", marginBottom:12 }}>
                Selecciona un clip para editar sus propiedades
              </div>
              {/* Project info */}
              <SSection title="📐 Formato del proyecto" defaultOpen>
                <div style={{ fontSize:10, color:C.text, marginBottom:6 }}>
                  <span style={{ color:C.gold, fontWeight:700 }}>{format.icon} {format.label}</span>
                  <br/><span style={{ color:C.textDim }}>{format.w}×{format.h} · {format.fps}fps · {format.aspect}</span>
                  <br/><span style={{ color:C.textDim }}>{format.platform} · máx {fmtTime(format.maxDuration)}</span>
                </div>
                <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:4 }}>
                  {FORMAT_PRESETS.slice(0,4).map(f=>(
                    <button key={f.id} onClick={()=>setFormat(f)} style={{ ...S.btn, justifyContent:"center", fontSize:9, background:format.id===f.id?C.goldDim:"none", borderColor:format.id===f.id?C.gold:C.border2, color:format.id===f.id?C.gold:C.textDim }}>
                      {f.icon} {f.label}
                    </button>
                  ))}
                </div>
              </SSection>
              <SSection title="📊 Timeline" defaultOpen>
                <div style={{ fontSize:10, color:C.textDim }}>
                  <div>Pistas: <span style={{ color:C.text }}>{tracks.length}</span></div>
                  <div>Clips: <span style={{ color:C.text }}>{clips.length}</span></div>
                  <div>Duración total: <span style={{ color:C.gold }}>{fmtTime(totalDuration)}</span></div>
                  <div style={{ marginTop:6 }}>
                    <SliderProp label="Zoom timeline" value={scale} min={20} max={150} step={5} onChange={setScale}/>
                  </div>
                </div>
              </SSection>
            </div>
          )
          : (
            <div style={{ padding:10 }}>
              {/* Header */}
              <div style={{ background:C.bg3, borderRadius:6, padding:"7px 10px", marginBottom:8, border:`1px solid ${C.border}` }}>
                <div style={{ fontSize:10, fontWeight:700, color:C.text, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{CLIP_EMOJI[selectedClip.type]} {selectedClip.name}</div>
                <div style={{ fontSize:9, color:C.textDim }}>{selectedClip.type} · {fmtTime(selectedClip.durationSec)}</div>
              </div>

              {/* Actions */}
              <div style={{ display:"flex", gap:4, marginBottom:8 }}>
                <button onClick={()=>duplicateClip(selectedClip.id)} style={{ ...S.btn, flex:1, justifyContent:"center", fontSize:9 }}><Copy size={10}/> Duplicar</button>
                <button onClick={()=>deleteClip(selectedClip.id)} style={{ ...S.btnDanger, flex:1, justifyContent:"center", fontSize:9 }}><Trash2 size={10}/> Eliminar</button>
              </div>

              <SSection title="⏱ Posición y duración" defaultOpen>
                <SLabel label="Inicio (seg)"/>
                <input type="number" value={parseFloat(selectedClip.startSec.toFixed(1))} min={0} step={0.5}
                  onChange={e=>updateClip(selectedClip.id,{startSec:parseFloat(e.target.value)})} style={{ ...S.input, marginBottom:6 }}/>
                <SLabel label="Duración (seg)"/>
                <input type="number" value={parseFloat(selectedClip.durationSec.toFixed(1))} min={0.5} step={0.5}
                  onChange={e=>updateClip(selectedClip.id,{durationSec:parseFloat(e.target.value)})} style={S.input}/>
              </SSection>

              {selectedClip.type!=="text" && (
                <SSection title="🔊 Audio" defaultOpen>
                  <SliderProp label="Volumen" value={selectedClip.volume} min={0} max={2} step={0.05} onChange={v=>updateClip(selectedClip.id,{volume:v})}/>
                  <SliderProp label="Velocidad" value={selectedClip.speed} min={0.25} max={4} step={0.25} onChange={v=>updateClip(selectedClip.id,{speed:v})} unit="×"/>
                  <button onClick={()=>updateClip(selectedClip.id,{muted:!selectedClip.muted})} style={{ ...S.btn, width:"100%", justifyContent:"center", fontSize:9, color:selectedClip.muted?"#e06060":C.textDim }}>
                    {selectedClip.muted?<VolumeX size={10}/>:<Volume2 size={10}/>} {selectedClip.muted?"Silenciado":"Silenciar"}
                  </button>
                </SSection>
              )}

              {(selectedClip.type==="video"||selectedClip.type==="image") && (
                <SSection title="🎨 Visual" defaultOpen>
                  <SliderProp label="Opacidad" value={selectedClip.opacity??1} min={0} max={1} step={0.05} onChange={v=>updateClip(selectedClip.id,{opacity:v})}/>
                  <SliderProp label="Brillo" value={selectedClip.brightness??1} min={0.2} max={2} step={0.05} onChange={v=>updateClip(selectedClip.id,{brightness:v})}/>
                  <SliderProp label="Contraste" value={selectedClip.contrast??1} min={0.2} max={2} step={0.05} onChange={v=>updateClip(selectedClip.id,{contrast:v})}/>
                  <SLabel label="Filtro cinemático"/>
                  <select value={selectedClip.effect||"Ninguno"} onChange={e=>updateClip(selectedClip.id,{effect:e.target.value})} style={S.input}>
                    {VIDEO_FX.map(f=><option key={f} value={f}>{f}</option>)}
                  </select>
                </SSection>
              )}

              {selectedClip.type==="text"&&selectedClip.textProps && (
                <SSection title="✏️ Texto" defaultOpen>
                  <SLabel label="Contenido"/>
                  <textarea rows={3} value={selectedClip.textProps.content} style={{ ...S.textarea, marginBottom:6 }}
                    onChange={e=>updateClip(selectedClip.id,{textProps:{...selectedClip.textProps!,content:e.target.value}})}/>
                  <SLabel label="Tamaño"/>
                  <input type="number" value={selectedClip.textProps.fontSize} min={8} max={120} style={{ ...S.input, marginBottom:6 }}
                    onChange={e=>updateClip(selectedClip.id,{textProps:{...selectedClip.textProps!,fontSize:parseInt(e.target.value)}})}/>
                  <SLabel label="Color del texto"/>
                  <input type="color" value={selectedClip.textProps.color} style={{ ...S.input, height:30, padding:2, cursor:"pointer", marginBottom:6 }}
                    onChange={e=>updateClip(selectedClip.id,{textProps:{...selectedClip.textProps!,color:e.target.value}})}/>
                  <SLabel label="Posición"/>
                  <select value={selectedClip.textProps.position} style={{ ...S.input, marginBottom:6 }}
                    onChange={e=>updateClip(selectedClip.id,{textProps:{...selectedClip.textProps!,position:e.target.value as any}})}>
                    <option value="top">Superior</option>
                    <option value="center">Centro</option>
                    <option value="bottom">Inferior</option>
                  </select>
                  <div style={{ display:"flex", gap:4 }}>
                    <button onClick={()=>updateClip(selectedClip.id,{textProps:{...selectedClip.textProps!,bold:!selectedClip.textProps!.bold}})}
                      style={{ ...S.btn, flex:1, justifyContent:"center", fontWeight:700, color:selectedClip.textProps.bold?C.gold:C.textDim, borderColor:selectedClip.textProps.bold?C.gold:C.border2 }}>B</button>
                    <button onClick={()=>updateClip(selectedClip.id,{textProps:{...selectedClip.textProps!,italic:!selectedClip.textProps!.italic}})}
                      style={{ ...S.btn, flex:1, justifyContent:"center", fontStyle:"italic", color:selectedClip.textProps.italic?C.gold:C.textDim, borderColor:selectedClip.textProps.italic?C.gold:C.border2 }}>I</button>
                    <button onClick={()=>updateClip(selectedClip.id,{textProps:{...selectedClip.textProps!,shadow:!selectedClip.textProps!.shadow}})}
                      style={{ ...S.btn, flex:1, justifyContent:"center", color:selectedClip.textProps.shadow?C.gold:C.textDim, borderColor:selectedClip.textProps.shadow?C.gold:C.border2 }}>🌑</button>
                  </div>
                </SSection>
              )}

              {selectedClip.type==="video" && (
                <SSection title="🤖 IA — Edición inteligente" defaultOpen>
                  <button onClick={()=>setAiMode("v2v")} style={{ ...S.btn, width:"100%", justifyContent:"center", marginBottom:3, fontSize:10 }}>
                    <Wand2 size={11}/> Transformar estilo (V2V)
                  </button>
                  <button onClick={()=>setAiMode("face-swap")} style={{ ...S.btn, width:"100%", justifyContent:"center", marginBottom:3, fontSize:10 }}>
                    <Sparkles size={11}/> Face Swap
                  </button>
                  <button onClick={()=>setAiMode("extend")} style={{ ...S.btn, width:"100%", justifyContent:"center", marginBottom:3, fontSize:10 }}>
                    <Film size={11}/> Extender vídeo
                  </button>
                </SSection>
              )}
              {selectedClip.type==="video" && (
                <SSection title="✂️ Recorte rápido" defaultOpen={false}>
                  <TrimPanel clip={selectedClip} updateClip={updateClip}/>
                </SSection>
              )}
              {selectedClip.type==="video" && (
                <SSection title="🎙️ Añadir narración IA" defaultOpen={false}>
                  <VoicePanel clip={selectedClip} projectId={projectId} onError={onError}
                    onSuccess={(newVaultId)=>{ onSuccess({ vaultId:newVaultId, type:"video", label:`${selectedClip.name} [con voz]`, mimeType:"video/mp4" }); }}/>
                </SSection>
              )}
              {selectedClip.type==="video" && (
                <SSection title="📝 Texto / Subtítulos / Caption" defaultOpen={false}>
                  <BurnTextPanel clip={selectedClip} projectId={projectId} onError={onError}
                    onSuccess={(newVaultId)=>{ onSuccess({ vaultId:newVaultId, type:"video", label:`${selectedClip.name} [texto]`, mimeType:"video/mp4" }); }}/>
                </SSection>
              )}
              {(selectedClip.type==="image") && (
                <SSection title="🤖 IA sobre esta imagen" defaultOpen>
                  {([["outpaint","Expandir canvas"],["inpaint","Inpainting"],["variations","Generar variaciones"],["face-swap","Face Swap"]] as [AIMode,string][]).map(([m,lbl])=>(
                    <button key={m} onClick={()=>setAiMode(m)} style={{ ...S.btn, width:"100%", justifyContent:"center", marginBottom:3, fontSize:10 }}>
                      <Wand2 size={10}/> {lbl}
                    </button>
                  ))}
                </SSection>
              )}
            </div>
          )
        }
      </div>
    </div>
  );

  const openTrackUpload = (trackId: string) => {
    uploadTrackRef.current = trackId;
    fileInputRef.current?.click();
  };

  // ─── RENDER ───────────────────────────────────────────────────────────────
  const rootStyle: React.CSSProperties = fullScreen
    ? { ...S.root, position:"fixed", inset:0, zIndex:500, borderRadius:0, height:"100dvh" }
    : { ...S.root, height:"calc(100dvh - 118px)", minHeight:560, borderRadius:12 };

  return (
    <div style={rootStyle}>

      {/* ── TOP BAR ── */}
      <div style={S.topBar}>
        {/* Format badge */}
        <div style={{ display:"flex", alignItems:"center", gap:4, padding:"3px 8px", background:C.bg4, borderRadius:5, border:`1px solid ${C.border2}`, cursor:"pointer" }}
          onClick={()=>setSideTab("templates")}>
          <span style={{ fontSize:12 }}>{format.icon}</span>
          <span style={{ fontSize:10, color:C.text, fontWeight:600 }}>{format.label}</span>
          <span style={{ fontSize:9, color:C.textDim }}>({format.aspect})</span>
        </div>

        <div style={{ width:1, height:20, background:C.border2, margin:"0 2px" }}/>

        {/* Playback */}
        <button onClick={()=>setCurrentSec(0)} style={S.btnIcon}><SkipBack size={14}/></button>
        <button onClick={()=>setIsPlaying(p=>!p)} style={{ ...S.btnIcon, color:isPlaying?C.gold:C.textDim }}>
          {isPlaying?<Pause size={18}/>:<Play size={18}/>}
        </button>
        <button onClick={()=>setCurrentSec(totalDuration)} style={S.btnIcon}><SkipForward size={14}/></button>
        <span style={{ fontSize:11, color:C.gold, fontFamily:"monospace", minWidth:80, textAlign:"center" }}>
          {fmtTime(currentSec)} / {fmtTime(totalDuration)}
        </span>

        <div style={{ width:1, height:20, background:C.border2, margin:"0 2px" }}/>

        {/* Zoom */}
        <button onClick={()=>setScale(s=>Math.max(20,s-10))} style={S.btnIcon}><ZoomOut size={13}/></button>
        <div style={{ width:80, position:"relative" }}>
          <input type="range" min={20} max={150} step={5} value={scale} onChange={e=>setScale(parseInt(e.target.value))}
            style={{ width:"100%", accentColor:C.gold }}/>
        </div>
        <button onClick={()=>setScale(s=>Math.min(150,s+10))} style={S.btnIcon}><ZoomIn size={13}/></button>

        <div style={{ width:1, height:20, background:C.border2, margin:"0 2px" }}/>

        {/* Grid toggle */}
        <button onClick={()=>setShowGrid(g=>!g)} style={{ ...S.btnIcon, color:showGrid?C.gold:C.textDim }} title="Cuadrícula">
          <Grid3X3 size={14}/>
        </button>
        <button onClick={()=>setPreviewFit(f=>f==="fit"?"fill":"fit")} style={S.btnIcon} title="Ajuste preview">
          <Maximize2 size={14}/>
        </button>

        <div style={{ flex:1 }}/>

        {/* AI quick access */}
        <button onClick={()=>setAiMode("t2v")} style={{ ...S.btn, fontSize:10, color:C.teal, borderColor:C.teal }}>
          <Zap size={11}/> Generar clip IA
        </button>
        <button onClick={()=>setShowExport(true)} style={S.btnGold}>
          <Download size={13}/> Exportar MP4
        </button>
        <button
          onClick={()=>setFullScreen(fs=>!fs)}
          style={{ ...S.btnIcon, color:fullScreen?C.gold:C.textDim, border:`1px solid ${fullScreen?C.gold:C.border2}`, borderRadius:4, padding:"3px 7px" }}
          title={fullScreen?"Salir de pantalla completa (Esc)":"Pantalla completa"}>
          <Maximize2 size={14}/>
        </button>
      </div>

      {/* ── BODY ── */}
      <div style={S.body}>
        <LeftPanel/>

        {/* ── CENTER PANEL ── */}
        <div style={S.centerPanel}>
          {/* Preview */}
          <div style={S.previewWrap}>
            {/* Grid overlay */}
            {showGrid && (
              <div style={{ position:"absolute", inset:0, backgroundImage:"linear-gradient(rgba(255,255,255,0.03) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,0.03) 1px,transparent 1px)", backgroundSize:"40px 40px", pointerEvents:"none", zIndex:10 }}/>
            )}

            {/* Overlay toolbar (Canva-style) */}
            <div style={{ position:"absolute", top:8, left:"50%", transform:"translateX(-50%)", zIndex:50,
              display:"flex", gap:4, background:"rgba(10,10,20,0.85)", borderRadius:8, padding:"4px 8px",
              border:"1px solid rgba(200,168,75,0.3)", boxShadow:"0 2px 12px rgba(0,0,0,0.6)", backdropFilter:"blur(6px)" }}>
              <button title="Seleccionar overlay" onClick={()=>setOverlayMode("select")}
                style={{ ...S.btnIcon, background:overlayMode==="select"?"#2a2a00":"transparent", color:overlayMode==="select"?C.gold:C.textDim, borderRadius:4, padding:"3px 7px" }}>
                <Layers size={12}/>
              </button>
              <button title="Añadir texto" onClick={()=>{
                const ov:CanvasOverlay={id:uid(),kind:"text",x:20,y:40,w:60,h:12,text:"Texto",fontSize:36,color:"#ffffff",bgColor:"transparent",bold:false,italic:false,shadow:true,startSec:currentSec,endSec:Math.min(totalDuration,currentSec+5),rotate:0};
                setOverlays(prev=>[...prev,ov]); setSelOvId(ov.id); setOverlayMode("select"); setShowOvPanel(true);
              }} style={{ ...S.btnIcon, background:overlayMode==="add-text"?"#2a2a00":"transparent", color:C.textDim, borderRadius:4, padding:"3px 7px" }}>
                <Type size={12}/>
              </button>
              <button title="Añadir emoji" onClick={()=>{
                const EMOJIS=["🔥","⭐","💥","✨","🎯","💰","🛒","🎉","💎","🚀","❤️","👋"];
                const e=EMOJIS[Math.floor(Math.random()*EMOJIS.length)];
                const ov:CanvasOverlay={id:uid(),kind:"emoji",x:40,y:40,w:15,h:15,emoji:e,startSec:currentSec,endSec:Math.min(totalDuration,currentSec+5)};
                setOverlays(prev=>[...prev,ov]); setSelOvId(ov.id); setOverlayMode("select"); setShowOvPanel(true);
              }} style={{ ...S.btnIcon, color:C.textDim, borderRadius:4, padding:"3px 7px" }}>
                <span style={{fontSize:12}}>😀</span>
              </button>
              <button title="Eliminar overlay seleccionado" onClick={()=>{
                if (selectedOverlayId) { setOverlays(prev=>prev.filter(o=>o.id!==selectedOverlayId)); setSelOvId(null); }
              }} disabled={!selectedOverlayId}
                style={{ ...S.btnIcon, color:selectedOverlayId?"#e06060":C.textFaint, borderRadius:4, padding:"3px 7px", opacity:selectedOverlayId?1:0.4 }}>
                <Trash2 size={12}/>
              </button>
              <div style={{width:1,background:C.border2,margin:"0 2px"}}/>
              <button title={showOverlayPanel?"Ocultar panel":"Panel de overlays"} onClick={()=>setShowOvPanel(p=>!p)}
                style={{ ...S.btnIcon, color:showOverlayPanel?C.gold:C.textDim, borderRadius:4, padding:"3px 7px" }}>
                <Settings size={12}/>
              </button>
            </div>

            {/* Canvas placeholder / video */}
            <div ref={previewRef} style={{
              position:"relative", aspectRatio:
                format.aspect==="9:16"?"9/16":format.aspect==="16:9"?"16/9":format.aspect==="1:1"?"1/1":"4/5",
              maxHeight:"100%", maxWidth:"100%", background:"#000",
              boxShadow:"0 0 40px rgba(0,0,0,0.8)", borderRadius:4, overflow:"hidden",
              cursor: overlayMode==="select" ? "default" : "crosshair",
            }}>
              {videoClipsInOrder.length>0
                ? <video ref={videoRef} style={{ width:"100%", height:"100%", objectFit:previewFit==="fit"?"contain":"cover" }}/>
                : (
                  <div style={{ position:"absolute", inset:0, display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", gap:10, color:C.textFaint }}>
                    <Clapperboard size={40} strokeWidth={1}/>
                    <div style={{ fontSize:11 }}>Arrastra archivos o genera con IA</div>
                    <div style={{ display:"flex", gap:8 }}>
                      <button onClick={()=>fileInputRef.current?.click()} style={{ ...S.btn, fontSize:10 }}><Upload size={11}/> Importar media</button>
                      <button onClick={()=>setAiMode("t2v")} style={{ ...S.btn, fontSize:10, color:C.teal, borderColor:C.teal }}><Sparkles size={11}/> Generar con IA</button>
                    </div>
                  </div>
                )
              }

              {/* Timeline text clips preview */}
              {clips.filter(c=>c.type==="text"&&c.textProps&&currentSec>=c.startSec&&currentSec<c.startSec+c.durationSec).map(c=>{
                const tp = c.textProps!;
                const topPos = tp.position==="top"?"8%" : tp.position==="center"?"50%" : undefined;
                const botPos = tp.position==="bottom"?"8%" : undefined;
                const xform  = tp.position==="center"?"translate(-50%,-50%)":"translateX(-50%)";
                return (
                  <div key={c.id} style={{
                    position:"absolute", top:topPos, bottom:botPos, left:"50%", transform:xform,
                    fontWeight:tp.bold?"700":"400", fontStyle:tp.italic?"italic":"normal",
                    fontSize:`clamp(14px,${tp.fontSize/5}vw,${tp.fontSize}px)`,
                    color:tp.color, background:tp.bgColor, padding:"4px 12px",
                    borderRadius:4, textAlign:"center", whiteSpace:"pre-wrap",
                    textShadow:tp.shadow?"1px 2px 6px rgba(0,0,0,0.8)":"none", zIndex:20, pointerEvents:"none",
                  }}>{tp.content}</div>
                );
              })}

              {/* ── CANVAS OVERLAYS (T003) ── */}
              {overlays.filter(o=>currentSec>=o.startSec&&currentSec<=o.endSec).map(ov=>{
                const isSelected = ov.id===selectedOverlayId;
                return (
                  <div key={ov.id}
                    onMouseDown={e=>{
                      e.stopPropagation();
                      setSelOvId(ov.id);
                      setOverlayMode("select");
                      const rect = previewRef.current?.getBoundingClientRect();
                      if (rect) setDragStart({ mx:e.clientX, my:e.clientY, ox:ov.x, oy:ov.y });
                      setDragOvId(ov.id);
                    }}
                    onMouseMove={e=>{
                      if (dragOvId!==ov.id||!dragStart) return;
                      const rect = previewRef.current?.getBoundingClientRect();
                      if (!rect) return;
                      const dx = ((e.clientX-dragStart.mx)/rect.width)*100;
                      const dy = ((e.clientY-dragStart.my)/rect.height)*100;
                      setOverlays(prev=>prev.map(o=>o.id===ov.id?{...o,x:Math.max(0,Math.min(100-o.w,dragStart.ox+dx)),y:Math.max(0,Math.min(100-o.h,dragStart.oy+dy))}:o));
                    }}
                    onMouseUp={()=>{ setDragOvId(null); setDragStart(null); }}
                    style={{
                      position:"absolute",
                      left:`${ov.x}%`, top:`${ov.y}%`,
                      width:`${ov.w}%`, height:`${ov.h}%`,
                      transform:`rotate(${ov.rotate||0}deg)`,
                      cursor:"move", userSelect:"none",
                      border: isSelected ? "2px dashed #c8a84b" : "2px solid transparent",
                      borderRadius:4,
                      display:"flex", alignItems:"center", justifyContent:"center",
                      zIndex:30,
                    }}>
                    {ov.kind==="text" && (
                      <div style={{
                        fontSize:`clamp(10px,${(ov.fontSize||36)/10}vw,${ov.fontSize||36}px)`,
                        color: ov.color||"#fff",
                        background: ov.bgColor||"transparent",
                        fontWeight: ov.bold?"700":"400",
                        fontStyle: ov.italic?"italic":"normal",
                        textShadow: ov.shadow?"1px 2px 6px rgba(0,0,0,0.8)":"none",
                        padding:"2px 6px", borderRadius:3, whiteSpace:"pre-wrap", textAlign:"center", lineHeight:1.2,
                        pointerEvents:"none", width:"100%",
                      }}>{ov.text}</div>
                    )}
                    {ov.kind==="emoji" && (
                      <span style={{ fontSize:`clamp(16px,${ov.w/2}vw,96px)`, lineHeight:1, pointerEvents:"none", userSelect:"none" }}>{ov.emoji}</span>
                    )}
                    {ov.kind==="image" && ov.imageUrl && (
                      <img src={ov.imageUrl} alt="" style={{ width:"100%", height:"100%", objectFit:"contain", pointerEvents:"none" }}/>
                    )}
                    {isSelected && (
                      <div style={{ position:"absolute", top:-18, right:0, display:"flex", gap:3, background:"rgba(10,10,20,0.9)", borderRadius:4, padding:"2px 4px" }}>
                        <button onClick={e=>{e.stopPropagation();setOverlays(prev=>prev.filter(o=>o.id!==ov.id));setSelOvId(null);}}
                          style={{background:"none",border:"none",color:"#e06060",cursor:"pointer",fontSize:10,padding:"1px 4px"}}>✕</button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* ── OVERLAY INSPECTOR PANEL (Canva-style) ── */}
            {showOverlayPanel && (
              <div style={{
                position:"absolute", right:8, top:52, bottom:8, width:200, zIndex:60,
                background:"rgba(10,10,22,0.95)", border:`1px solid ${C.border}`, borderRadius:8,
                overflowY:"auto", padding:10, backdropFilter:"blur(8px)",
                boxShadow:"0 4px 24px rgba(0,0,0,0.7)",
              }}>
                <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:10 }}>
                  <span style={{ fontSize:10, fontWeight:700, color:C.gold }}>🎨 Overlays</span>
                  <button onClick={()=>setShowOvPanel(false)} style={{ background:"none", border:"none", color:C.textDim, cursor:"pointer", fontSize:14 }}>×</button>
                </div>

                {/* Overlay list */}
                <div style={{ marginBottom:8 }}>
                  {overlays.length===0
                    ? <div style={{ fontSize:9, color:C.textFaint, textAlign:"center" }}>Sin overlays. Usa la barra de arriba para añadir texto o emojis.</div>
                    : overlays.map(ov=>(
                      <div key={ov.id} onClick={()=>setSelOvId(ov.id)}
                        style={{ display:"flex", alignItems:"center", gap:6, padding:"4px 6px", borderRadius:4, marginBottom:2, cursor:"pointer",
                          background:ov.id===selectedOverlayId?"#1a1a00":"#111", border:`1px solid ${ov.id===selectedOverlayId?C.gold:C.border2}` }}>
                        <span style={{fontSize:13}}>{ov.kind==="emoji"?ov.emoji:ov.kind==="text"?"T":"🖼"}</span>
                        <span style={{fontSize:9,color:C.text,flex:1,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{ov.text||ov.emoji||"Imagen"}</span>
                        <span style={{fontSize:8,color:C.textFaint}}>{ov.startSec.toFixed(0)}s–{ov.endSec.toFixed(0)}s</span>
                      </div>
                    ))
                  }
                </div>

                {/* Selected overlay controls */}
                {selectedOverlayId && (()=>{
                  const ov = overlays.find(o=>o.id===selectedOverlayId);
                  if (!ov) return null;
                  const upd = (u:Partial<CanvasOverlay>)=>setOverlays(prev=>prev.map(o=>o.id===ov.id?{...o,...u}:o));
                  return (
                    <div style={{ borderTop:`1px solid ${C.border}`, paddingTop:8 }}>
                      <div style={{ fontSize:9, fontWeight:700, color:C.gold, marginBottom:6 }}>
                        {ov.kind==="text"?"✏️ Editar texto":ov.kind==="emoji"?"😀 Emoji":"🖼 Imagen"}
                      </div>
                      {ov.kind==="text" && <>
                        <textarea value={ov.text||""} rows={2} onChange={e=>upd({text:e.target.value})}
                          style={{width:"100%",background:"#111",border:`1px solid ${C.border2}`,color:"#fff",borderRadius:4,padding:5,fontSize:10,resize:"vertical",boxSizing:"border-box",marginBottom:5}}/>
                        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:4,marginBottom:5}}>
                          <div>
                            <div style={{fontSize:8,color:"#888",marginBottom:2}}>Tamaño</div>
                            <input type="number" value={ov.fontSize||36} min={8} max={200} onChange={e=>upd({fontSize:parseInt(e.target.value)})}
                              style={{width:"100%",background:"#111",border:`1px solid ${C.border2}`,color:"#fff",borderRadius:4,padding:"3px 5px",fontSize:10}}/>
                          </div>
                          <div>
                            <div style={{fontSize:8,color:"#888",marginBottom:2}}>Color</div>
                            <input type="color" value={ov.color||"#ffffff"} onChange={e=>upd({color:e.target.value})}
                              style={{width:"100%",background:"#111",border:`1px solid ${C.border2}`,borderRadius:4,padding:2,height:26,cursor:"pointer"}}/>
                          </div>
                        </div>
                        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:4,marginBottom:5}}>
                          <div>
                            <div style={{fontSize:8,color:"#888",marginBottom:2}}>Fondo</div>
                            <input type="color" value={ov.bgColor==="transparent"?"#000000":ov.bgColor||"#000000"} onChange={e=>upd({bgColor:e.target.value})}
                              style={{width:"100%",background:"#111",border:`1px solid ${C.border2}`,borderRadius:4,padding:2,height:26,cursor:"pointer"}}/>
                          </div>
                          <div>
                            <div style={{fontSize:8,color:"#888",marginBottom:2}}>Rotación</div>
                            <input type="number" value={ov.rotate||0} min={-180} max={180} onChange={e=>upd({rotate:parseInt(e.target.value)})}
                              style={{width:"100%",background:"#111",border:`1px solid ${C.border2}`,color:"#fff",borderRadius:4,padding:"3px 5px",fontSize:10}}/>
                          </div>
                        </div>
                        <div style={{display:"flex",gap:4,marginBottom:5}}>
                          <button onClick={()=>upd({bold:!ov.bold})} style={{flex:1,...S.btn,justifyContent:"center",fontWeight:700,fontSize:10,color:ov.bold?C.gold:C.textDim,borderColor:ov.bold?C.gold:C.border2}}>B</button>
                          <button onClick={()=>upd({italic:!ov.italic})} style={{flex:1,...S.btn,justifyContent:"center",fontStyle:"italic",fontSize:10,color:ov.italic?C.gold:C.textDim,borderColor:ov.italic?C.gold:C.border2}}>I</button>
                          <button onClick={()=>upd({shadow:!ov.shadow})} style={{flex:1,...S.btn,justifyContent:"center",fontSize:10,color:ov.shadow?C.gold:C.textDim,borderColor:ov.shadow?C.gold:C.border2}}>🌑</button>
                        </div>
                        <div style={{marginBottom:5}}>
                          <div style={{fontSize:8,color:"#888",marginBottom:3}}>Fondo transparente</div>
                          <button onClick={()=>upd({bgColor:"transparent"})} style={{...S.btn,width:"100%",justifyContent:"center",fontSize:9}}>Sin fondo</button>
                        </div>
                      </>}
                      {ov.kind==="emoji" && (
                        <div>
                          <div style={{fontSize:8,color:"#888",marginBottom:4}}>Elige emoji</div>
                          <div style={{display:"flex",flexWrap:"wrap",gap:4,marginBottom:5}}>
                            {["🔥","⭐","💥","✨","🎯","💰","🛒","🎉","💎","🚀","❤️","👋","🙌","💯","🏆","🎁","🛍️","📱","🌟","⚡","🎶","🍀"].map(em=>(
                              <button key={em} onClick={()=>upd({emoji:em})}
                                style={{background:ov.emoji===em?"#2a2a00":"#111",border:`1px solid ${ov.emoji===em?C.gold:C.border2}`,borderRadius:4,padding:"3px 5px",cursor:"pointer",fontSize:16}}>
                                {em}
                              </button>
                            ))}
                          </div>
                          <div style={{marginBottom:5}}>
                            <div style={{fontSize:8,color:"#888",marginBottom:2}}>Rotación</div>
                            <input type="number" value={ov.rotate||0} min={-180} max={180} onChange={e=>upd({rotate:parseInt(e.target.value)})}
                              style={{width:"100%",background:"#111",border:`1px solid ${C.border2}`,color:"#fff",borderRadius:4,padding:"3px 5px",fontSize:10}}/>
                          </div>
                        </div>
                      )}
                      {/* Timing controls (shared) */}
                      <div style={{borderTop:`1px solid ${C.border}`,paddingTop:6,marginTop:4}}>
                        <div style={{fontSize:8,color:"#888",marginBottom:4}}>⏱ Temporización</div>
                        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:4,marginBottom:4}}>
                          <div>
                            <div style={{fontSize:8,color:"#888",marginBottom:2}}>Inicio (s)</div>
                            <input type="number" value={ov.startSec} min={0} max={totalDuration} step={0.5} onChange={e=>upd({startSec:parseFloat(e.target.value)})}
                              style={{width:"100%",background:"#111",border:`1px solid ${C.border2}`,color:"#fff",borderRadius:4,padding:"3px 5px",fontSize:10}}/>
                          </div>
                          <div>
                            <div style={{fontSize:8,color:"#888",marginBottom:2}}>Fin (s)</div>
                            <input type="number" value={ov.endSec} min={0} max={totalDuration} step={0.5} onChange={e=>upd({endSec:parseFloat(e.target.value)})}
                              style={{width:"100%",background:"#111",border:`1px solid ${C.border2}`,color:"#fff",borderRadius:4,padding:"3px 5px",fontSize:10}}/>
                          </div>
                        </div>
                        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:4}}>
                          <div>
                            <div style={{fontSize:8,color:"#888",marginBottom:2}}>X (%)</div>
                            <input type="number" value={Math.round(ov.x)} min={0} max={100} onChange={e=>upd({x:parseInt(e.target.value)})}
                              style={{width:"100%",background:"#111",border:`1px solid ${C.border2}`,color:"#fff",borderRadius:4,padding:"3px 5px",fontSize:10}}/>
                          </div>
                          <div>
                            <div style={{fontSize:8,color:"#888",marginBottom:2}}>Y (%)</div>
                            <input type="number" value={Math.round(ov.y)} min={0} max={100} onChange={e=>upd({y:parseInt(e.target.value)})}
                              style={{width:"100%",background:"#111",border:`1px solid ${C.border2}`,color:"#fff",borderRadius:4,padding:"3px 5px",fontSize:10}}/>
                          </div>
                        </div>
                      </div>
                      <button onClick={()=>{setOverlays(prev=>prev.filter(o=>o.id!==ov.id));setSelOvId(null);}}
                        style={{...S.btnDanger,width:"100%",justifyContent:"center",marginTop:8,fontSize:9}}>
                        <Trash2 size={10}/> Eliminar overlay
                      </button>
                    </div>
                  );
                })()}

                {/* Add overlay buttons */}
                <div style={{ borderTop:`1px solid ${C.border}`, paddingTop:8, marginTop:4 }}>
                  <div style={{ fontSize:9, color:C.textDim, marginBottom:5 }}>+ Añadir nuevo</div>
                  <button onClick={()=>{
                    const ov:CanvasOverlay={id:uid(),kind:"text",x:20,y:40,w:60,h:12,text:"Nuevo texto",fontSize:36,color:"#ffffff",bgColor:"transparent",bold:false,italic:false,shadow:true,startSec:currentSec,endSec:Math.min(totalDuration,currentSec+5)};
                    setOverlays(prev=>[...prev,ov]); setSelOvId(ov.id);
                  }} style={{...S.btn,width:"100%",justifyContent:"center",marginBottom:4,fontSize:9}}>
                    <Type size={10}/> Texto
                  </button>
                  <div style={{ display:"flex", flexWrap:"wrap", gap:3 }}>
                    {["🔥","⭐","💥","✨","🎯","💰","🛒","🎉"].map(em=>(
                      <button key={em} onClick={()=>{
                        const ov:CanvasOverlay={id:uid(),kind:"emoji",x:35+Math.random()*30,y:30+Math.random()*30,w:12,h:12,emoji:em,startSec:currentSec,endSec:Math.min(totalDuration,currentSec+5)};
                        setOverlays(prev=>[...prev,ov]); setSelOvId(ov.id);
                      }} style={{background:"#111",border:`1px solid ${C.border2}`,borderRadius:4,padding:"3px 6px",cursor:"pointer",fontSize:15}}>
                        {em}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Scrubber time tooltip */}
            <div style={{ position:"absolute", bottom:8, right:12, fontSize:10, color:C.textDim, background:C.bg3, padding:"2px 8px", borderRadius:4, zIndex:5 }}>
              ⌨ Espacio=play · ←→=seek · Del=eliminar
            </div>
          </div>

          {/* ── TIMELINE ── */}
          <div style={S.timelineWrap}>
            {/* Timeline toolbar */}
            <div style={{ display:"flex", alignItems:"center", gap:6, padding:"4px 10px", borderBottom:`1px solid ${C.border}`, flexShrink:0, height:34 }}>
              <span style={{ fontSize:9, color:C.textDim, fontWeight:700, letterSpacing:1, textTransform:"uppercase" }}>Timeline</span>
              <span style={{ fontSize:9, color:C.textFaint }}>{clips.length} clips · {fmtTime(totalDuration)}</span>
              <div style={{ marginLeft:"auto", display:"flex", gap:4 }}>
                <button onClick={()=>{setClips([]);setSelectedId(null);setCurrentSec(0);}} style={{ ...S.btn, fontSize:9, color:C.textFaint }}>
                  <RefreshCw size={9}/> Limpiar
                </button>
              </div>
            </div>

            {/* Track area */}
            <div style={{ flex:1, display:"flex", overflowX:"hidden", overflowY:"auto" }}>
              {/* Track labels */}
              <div style={{ width:LABEL_WIDTH, flexShrink:0, borderRight:`1px solid ${C.border}`, background:"#080810" }}>
                <div style={{ height:RULER_HEIGHT, borderBottom:`1px solid ${C.border}`, display:"flex", alignItems:"center", padding:"0 8px" }}>
                  <span style={{ fontSize:8.5, color:C.textFaint }}>Pistas</span>
                </div>
                {tracks.map(track=>(
                  <div key={track.id} style={{ height:TRACK_HEIGHT, borderBottom:`1px solid ${C.border}`, display:"flex", alignItems:"center", padding:"0 4px", gap:2 }}>
                    <div style={{ width:3, height:28, borderRadius:2, background:track.color, flexShrink:0 }}/>
                    <span style={{ fontSize:8, color:"#8080a0", fontWeight:600, flex:1, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap", marginLeft:3 }}>{track.label}</span>
                    {(track.type==="video"||track.type==="image"||track.type==="audio") && !trackLocked[track.id] && (
                      <button
                        onClick={e=>{ e.stopPropagation(); openTrackUpload(track.id); }}
                        title={`Añadir archivo a ${track.label}`}
                        style={{ ...S.btnIcon, color:C.teal, padding:"1px 3px", fontSize:9, fontWeight:700, flexShrink:0 }}>
                        <Plus size={10}/>
                      </button>
                    )}
                    <button onClick={()=>setTrackMuted(m=>({...m,[track.id]:!m[track.id]}))}
                      style={{ ...S.btnIcon, color:trackMuted[track.id]?"#e06060":C.textFaint, padding:2, flexShrink:0 }}>
                      {trackMuted[track.id]?<VolumeX size={9}/>:<Volume2 size={9}/>}
                    </button>
                    <button onClick={()=>setTrackLocked(l=>({...l,[track.id]:!l[track.id]}))}
                      style={{ ...S.btnIcon, color:trackLocked[track.id]?C.gold:C.textFaint, padding:2, flexShrink:0 }}>
                      {trackLocked[track.id]?<Lock size={9}/>:<Unlock size={9}/>}
                    </button>
                  </div>
                ))}
              </div>

              {/* Timeline scrollable */}
              <div ref={timelineScrollRef} style={{ flex:1, overflowX:"auto", overflowY:"visible", position:"relative" }} onClick={handleTimelineClick}>
                <div style={{ width:Math.max(900, totalDuration*scale+250), position:"relative" }}>
                  <TimelineRuler totalSec={totalDuration} scale={scale}/>
                  {tracks.map(track=>(
                    <div key={track.id} style={{ height:TRACK_HEIGHT, borderBottom:`1px solid ${C.border}`, position:"relative", background:"#09091a" }}>
                      {/* Grid lines */}
                      {Array.from({length:Math.ceil(totalDuration/5)}).map((_,i)=>(
                        <div key={i} style={{ position:"absolute", left:i*5*scale, top:0, bottom:0, width:1, background:"#0f0f1e", pointerEvents:"none" }}/>
                      ))}
                      {clips.filter(c=>c.trackId===track.id).map(clip=>(
                        <TimelineClip key={clip.id} clip={clip} scale={scale} selected={selectedId===clip.id}
                          onSelect={()=>{ if(!trackLocked[track.id]) setSelectedId(clip.id); }}
                          onDelete={()=>deleteClip(clip.id)}
                          onDragEnd={ns=>{ if(!trackLocked[track.id]) updateClip(clip.id,{startSec:ns}); }}/>
                      ))}
                      {clips.filter(c=>c.trackId===track.id).length===0 && (
                        <div style={{ position:"absolute", inset:0, display:"flex", alignItems:"center", padding:"0 12px", pointerEvents:"none" }}>
                          <span style={{ fontSize:8.5, color:C.textFaint }}>+ {track.label}</span>
                        </div>
                      )}
                    </div>
                  ))}
                  {/* Playhead */}
                  <div style={{ position:"absolute", left:currentSec*scale, top:0, bottom:0, width:2, background:C.gold, pointerEvents:"none", zIndex:50, boxShadow:`0 0 8px rgba(200,168,75,0.6)` }}>
                    <div style={{ width:10, height:10, background:C.gold, borderRadius:"50%", position:"absolute", top:0, left:-4 }}/>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <RightPanel/>
      </div>

      {/* ── MODALS ── */}
      {aiMode && (
        <AIGenerateModal
          mode={aiMode} projectId={projectId}
          onClose={()=>setAiMode(null)}
          onClipReady={addAIClip}
          onError={m=>{onError(m);setAiMode(null);}}
        />
      )}

      {showSfx && (
        <SFXModal
          catalog={sfxCatalog}
          onSelect={addSFXClip}
          onClose={()=>setShowSfx(false)}
        />
      )}

      {showExport && (
        <ExportModal
          clips={clips} format={format} projectId={projectId} totalDuration={totalDuration}
          onClose={()=>setShowExport(false)}
          onSuccess={(vaultId, url)=>{
            onSuccess({ vaultId, type:"video", label:`${format.label} — ${fmtTime(totalDuration)}`, mimeType:"video/mp4" });
          }}
          onError={m=>onError(m)}
        />
      )}
    </div>
  );
}
