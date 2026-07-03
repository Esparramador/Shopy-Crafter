/**
 * Tripo 3D Studio — COMPLETO
 * Expone TODAS las capacidades del backend:
 *   text-to-model (avanzado: style/quality/seed)
 *   image-to-model + image-to-multiview (4 vistas desde imagen)
 *   multiview-to-model (manual 4 vistas)
 *   batch (hasta 10 imágenes simultáneas)
 *   refine (mejorar borrador)
 *   convert (GLB/FBX/OBJ/STL/USDZ + opciones quad/face_limit)
 *   text-to-texture (texturizar modelo con prompt)
 *   segment (segmentar modelo en partes semánticas)
 *   animate_prerigcheck + animate_rig + animate_retarget (134 anim)
 *   stylize (LEGO / Voxel / Voronoi / Minecraft)
 *   galería de sesión
 */
import React, { useState, useRef, useCallback, useEffect } from "react";
import {
  Loader2, Upload, Box, Wand2, Image, Layers, Play, Download, RefreshCw,
  CheckCircle2, AlertCircle, Zap, Cpu, Sparkles, RotateCcw,
  Settings2, Package, Scissors, Palette, Film, FolderOpen,
  ArrowRight, ChevronRight, Maximize2, Plus, Info,
} from "lucide-react";

const API = import.meta.env.BASE_URL?.replace(/\/$/, "") ?? "";

// ─── Types ────────────────────────────────────────────────────────────────────
type Tab = "text" | "image" | "multiview" | "batch" | "process" | "segment" | "animate" | "stylize" | "gallery";
type GenStatus = "idle" | "uploading" | "running" | "done" | "error";

interface TaskResult {
  task_id: string;
  output?: {
    model?: string; rendered_image?: string;
    base_model?: string; pbr_model?: string;
    segments?: { label: string; model: string }[];
  };
  animation?: string; out_format?: string; segments?: any[];
}

interface AnimPreset { id: string; label: string; category: string; looping: boolean; }

interface BatchItem {
  file: File; preview: string; task_id?: string;
  progress: number; status: "pending" | "uploading" | "running" | "done" | "error";
  output?: TaskResult["output"]; error?: string;
}

// ─── Metadata ─────────────────────────────────────────────────────────────────
const MODEL_VERSIONS = [
  { value: "default",       label: "Última (auto)",         badge: "⚡" },
  { value: "v2.5-20250123", label: "v2.5 — Alta fidelidad", badge: "🏆" },
  { value: "v2.0-20240919", label: "v2.0 — Estable",        badge: "🛡️" },
  { value: "v1.4-20240625", label: "v1.4 — Rápido",         badge: "🚀" },
];

const TEXT_STYLES = [
  { value: "", label: "Sin estilo (por defecto)" },
  { value: "realistic", label: "Fotorrealista" },
  { value: "cartoon",   label: "Cartoon / Estilizado" },
  { value: "low-poly",  label: "Low-poly" },
  { value: "sculpture", label: "Escultura / Orgánico" },
];

const STYLIZE_PRESETS = [
  { id: "lego",      label: "LEGO",      icon: "🧱", desc: "Bloques LEGO clásicos" },
  { id: "voxel",     label: "Voxel",     icon: "🎮", desc: "Arte pixel 3D (Minecraft-like)" },
  { id: "voronoi",   label: "Voronoi",   icon: "💎", desc: "Fracturas geométricas orgánicas" },
  { id: "minecraft", label: "Minecraft", icon: "⛏️", desc: "Mundo cúbico de bloques" },
];

const ANIM_CATS = ["locomotion","idle","gesture","dance","emote","combat","sit","activity"] as const;
const ANIM_CAT_META: Record<string, { label: string; icon: string }> = {
  locomotion: { label: "Locomoción", icon: "🚶" },
  idle:       { label: "Reposo",     icon: "🧍" },
  gesture:    { label: "Gestos",     icon: "👋" },
  dance:      { label: "Baile",      icon: "💃" },
  emote:      { label: "Emociones",  icon: "😄" },
  combat:     { label: "Combate",    icon: "⚔️" },
  sit:        { label: "Sentarse",   icon: "🪑" },
  activity:   { label: "Actividad",  icon: "💻" },
};

const CONVERT_FORMATS = [
  { value: "glb",  label: "GLB  — Universal web/game" },
  { value: "fbx",  label: "FBX  — Unreal / Maya / 3ds Max" },
  { value: "obj",  label: "OBJ  — Blender / cualquier DCC" },
  { value: "stl",  label: "STL  — Impresión 3D" },
  { value: "usdz", label: "USDZ — AR en iOS (Quick Look)" },
];

const PROMPT_SUGGESTIONS = [
  "a cute low-poly cartoon fox with fluffy tail, game-ready style",
  "a futuristic sci-fi robot with glowing blue accents, metallic surface",
  "a medieval wooden treasure chest with golden lock, worn leather straps",
  "a magical crystal potion bottle with swirling purple liquid inside",
  "a detailed white sneaker shoe with red colorway, photorealistic",
  "a minimalist modern armchair, light grey fabric, Scandinavian design",
  "a powerful dragon head with sharp scales and fiery orange eyes",
  "a beautiful orchid flower with detailed petals, botanical illustration style",
  "a retro VHS cassette tape with faded label, 80s aesthetic",
  "a golden trophy cup with star engravings, shiny metallic finish",
];

// ─── Style helpers ────────────────────────────────────────────────────────────
const cardSt: React.CSSProperties = {
  background: "var(--ink2,#0e0e1a)", border: "1px solid var(--ink3,#1c1c2e)",
  borderRadius: 14, padding: "20px 22px",
};
const inputSt: React.CSSProperties = {
  width: "100%", padding: "10px 14px", borderRadius: 9,
  background: "var(--ink3,#1c1c2e)", border: "1px solid var(--ink4,#2a2a40)",
  color: "var(--t,#fff)", fontSize: 13, fontFamily: "inherit", boxSizing: "border-box",
};
const btnPri: React.CSSProperties = {
  padding: "11px 20px", borderRadius: 10, border: "none",
  background: "linear-gradient(135deg,#3b80e4,#1a56c8)", color: "#fff",
  fontWeight: 700, fontSize: 13, cursor: "pointer",
  display: "flex", alignItems: "center", justifyContent: "center", gap: 7,
  boxShadow: "0 4px 14px rgba(59,128,228,0.35)",
};
const btnSec: React.CSSProperties = {
  padding: "9px 16px", borderRadius: 9, background: "var(--ink3,#1c1c2e)",
  border: "1px solid var(--ink4,#2a2a40)", color: "var(--t3,#888)",
  fontSize: 12, cursor: "pointer", display: "flex", alignItems: "center", gap: 6,
};

// ─── Shared components ────────────────────────────────────────────────────────
function ProgressBar({ value }: { value: number }) {
  return (
    <div>
      <div style={{ height: 6, borderRadius: 3, background: "var(--ink3)", overflow: "hidden" }}>
        <div style={{ height: "100%", width: `${value}%`, background: "linear-gradient(90deg,#3b80e4,#4af0c8)", borderRadius: 3, transition: "width 0.4s" }} />
      </div>
      <div style={{ textAlign: "right", fontSize: 11, color: "#3b80e4", marginTop: 3, fontWeight: 700 }}>{value}%</div>
    </div>
  );
}

function StatusLog({ status, progress, log, error }: { status: GenStatus; progress: number; log: string; error: string }) {
  if (status === "idle") return null;
  const running = status === "uploading" || status === "running";
  return (
    <div style={{ ...cardSt, borderColor: status === "error" ? "rgba(248,113,113,0.3)" : status === "done" ? "rgba(74,240,200,0.25)" : "rgba(59,128,228,0.25)", padding: "14px 16px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: running ? 10 : 0 }}>
        {running && <Loader2 size={15} style={{ animation: "spin 0.8s linear infinite", color: "#3b80e4", flexShrink: 0 }} />}
        {status === "done" && <CheckCircle2 size={15} color="#4af0c8" style={{ flexShrink: 0 }} />}
        {status === "error" && <AlertCircle size={15} color="#f87171" style={{ flexShrink: 0 }} />}
        <span style={{ fontSize: 13, color: status === "error" ? "#f87171" : status === "done" ? "#4af0c8" : "var(--t)", fontWeight: 600 }}>
          {status === "error" ? error : log}
        </span>
      </div>
      {running && <ProgressBar value={progress} />}
    </div>
  );
}

function DropZone({ preview, label, subLabel, onFile, accept = "image/*", height = 140 }: { preview?: string; label: string; subLabel?: string; onFile: (f: File) => void; accept?: string; height?: number }) {
  const ref = useRef<HTMLInputElement>(null);
  const [drag, setDrag] = useState(false);
  return (
    <div
      onClick={() => ref.current?.click()}
      onDragOver={e => { e.preventDefault(); setDrag(true); }}
      onDragLeave={() => setDrag(false)}
      onDrop={e => { e.preventDefault(); setDrag(false); const f = e.dataTransfer.files[0]; if (f) onFile(f); }}
      style={{ border: `2px dashed ${drag ? "#3b80e4" : "rgba(59,128,228,0.3)"}`, borderRadius: 12, padding: preview ? 10 : 22, textAlign: "center", cursor: "pointer", background: drag ? "rgba(59,128,228,0.06)" : "rgba(59,128,228,0.02)", transition: "all 0.2s", minHeight: height }}
    >
      {preview
        ? <img src={preview} alt="" style={{ maxHeight: height - 20, maxWidth: "100%", borderRadius: 8, objectFit: "contain" }} />
        : <>
            <Upload size={24} style={{ color: "#3b80e4", margin: "0 auto 10px" }} />
            <div style={{ fontWeight: 600, fontSize: 13, color: "var(--t)", marginBottom: 4 }}>{label}</div>
            {subLabel && <div style={{ fontSize: 11, color: "var(--t3)" }}>{subLabel}</div>}
          </>
      }
      <input ref={ref} type="file" accept={accept} style={{ display: "none" }} onChange={e => { const f = e.target.files?.[0]; if (f) onFile(f); }} />
    </div>
  );
}

function ModelViewer({ url, previewImg, compact = false }: { url?: string; previewImg?: string; compact?: boolean }) {
  const [mode, setMode] = useState<"3d" | "img">(url ? "3d" : "img");
  if (!url && !previewImg) return null;
  return (
    <div style={{ ...cardSt, padding: 0, overflow: "hidden", borderColor: "rgba(74,240,200,0.2)" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 14px", borderBottom: "1px solid var(--ink3)" }}>
        <span style={{ fontWeight: 700, fontSize: 13, color: "#4af0c8" }}>✅ Modelo generado</span>
        <div style={{ display: "flex", gap: 4 }}>
          {url && <button onClick={() => setMode("3d")} style={{ ...btnSec, padding: "4px 10px", background: mode === "3d" ? "#3b80e420" : "transparent", color: mode === "3d" ? "#3b80e4" : "var(--t3)", border: mode === "3d" ? "1px solid #3b80e430" : "1px solid transparent", fontSize: 11 }}>🎯 3D</button>}
          {previewImg && <button onClick={() => setMode("img")} style={{ ...btnSec, padding: "4px 10px", background: mode === "img" ? "#3b80e420" : "transparent", color: mode === "img" ? "#3b80e4" : "var(--t3)", border: mode === "img" ? "1px solid #3b80e430" : "1px solid transparent", fontSize: 11 }}>🖼️ Render</button>}
        </div>
      </div>
      <div style={{ padding: 12 }}>
        {mode === "3d" && url
          ? <model-viewer src={url} auto-rotate camera-controls style={{ width: "100%", height: compact ? 220 : 280, borderRadius: 10, background: "var(--ink3)" } as any} />
          : previewImg ? <img src={previewImg} alt="render" style={{ width: "100%", maxHeight: compact ? 220 : 280, objectFit: "contain", borderRadius: 10 }} /> : null
        }
        <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
          {url && <a href={url} download style={{ ...btnPri, flex: 1, textDecoration: "none", fontSize: 12 }}><Download size={13} /> Descargar GLB</a>}
          {previewImg && <a href={previewImg} download style={{ ...btnSec, textDecoration: "none", fontSize: 11 }}><Image size={12} /> PNG</a>}
        </div>
      </div>
    </div>
  );
}

function TaskIdInput({ value, onChange, label = "Task ID del modelo fuente", placeholder = "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx" }: { value: string; onChange: (v: string) => void; label?: string; placeholder?: string }) {
  return (
    <div>
      <label style={{ fontSize: 11, color: "var(--t3)", display: "block", marginBottom: 5 }}>{label}</label>
      <input value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} style={inputSt} />
      <div style={{ fontSize: 10, color: "var(--t3)", marginTop: 4 }}>Copia el Task ID desde la pestaña Galería tras generar un modelo</div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
export default function Tripo3DStudio() {
  const [tab, setTab] = useState<Tab>("text");

  // shared status
  const [status, setStatus] = useState<GenStatus>("idle");
  const [progress, setProgress] = useState(0);
  const [log, setLog] = useState("");
  const [error, setError] = useState("");
  const [result, setResult] = useState<TaskResult | null>(null);

  // shared model options
  const [modelVersion, setModelVersion] = useState("default");
  const [withTexture, setWithTexture] = useState(true);
  const [withPbr, setWithPbr] = useState(true);
  const [faceLimit, setFaceLimit] = useState("");

  // Text tab
  const [prompt, setPrompt] = useState("");
  const [negPrompt, setNegPrompt] = useState("");
  const [textStyle, setTextStyle] = useState("");
  const [textQuality, setTextQuality] = useState("");
  const [textSeed, setTextSeed] = useState("");
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [showAdvText, setShowAdvText] = useState(false);

  // Image tab
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState("");
  const [imgMultiviewLoading, setImgMultiviewLoading] = useState(false);
  const [imgMultiviewError, setImgMultiviewError] = useState("");
  const [imgMultiviewViews, setImgMultiviewViews] = useState<Record<string, string>>({});
  const [imgMultiviewFiles, setImgMultiviewFiles] = useState<Record<string, File>>({});
  const [imgMultiviewDesc, setImgMultiviewDesc] = useState("");
  const [imgMode, setImgMode] = useState<"direct" | "multiview">("direct");

  // Multiview tab
  const [views, setViews] = useState<{ front?: File; left?: File; back?: File; right?: File }>({});
  const [viewPreviews, setViewPreviews] = useState<Record<string, string>>({});
  const [mvAutoPrompt, setMvAutoPrompt] = useState("");
  const [mvAutoGenerating, setMvAutoGenerating] = useState(false);
  const [mvAutoError, setMvAutoError] = useState("");

  // Batch
  const [batchFiles, setBatchFiles] = useState<BatchItem[]>([]);
  const batchRef = useRef<HTMLInputElement>(null);

  // Process (refine, convert, texture)
  const [processMode, setProcessMode] = useState<"refine" | "convert" | "texture">("refine");
  const [processTaskId, setProcessTaskId] = useState("");
  const [convertFormat, setConvertFormat] = useState("glb");
  const [convertQuad, setConvertQuad] = useState(false);
  const [convertFaceLimit, setConvertFaceLimit] = useState("");
  const [convertTextureSize, setConvertTextureSize] = useState("");
  const [convertPivot, setConvertPivot] = useState(false);
  const [texturePrompt, setTexturePrompt] = useState("");
  const [textureQuality, setTextureQuality] = useState("standard");
  const [processStatus, setProcessStatus] = useState<GenStatus>("idle");
  const [processLog, setProcessLog] = useState("");
  const [processProgress, setProcessProgress] = useState(0);
  const [processResult, setProcessResult] = useState<TaskResult | null>(null);
  const [processError, setProcessError] = useState("");

  // Segment
  const [segmentTaskId, setSegmentTaskId] = useState("");
  const [segmentStatus, setSegmentStatus] = useState<GenStatus>("idle");
  const [segmentLog, setSegmentLog] = useState("");
  const [segmentProgress, setSegmentProgress] = useState(0);
  const [segmentResult, setSegmentResult] = useState<TaskResult | null>(null);
  const [segmentError, setSegmentError] = useState("");

  // Animate
  const [animations, setAnimations] = useState<AnimPreset[]>([]);
  const [animCat, setAnimCat] = useState("locomotion");
  const [selectedAnim, setSelectedAnim] = useState("");
  const [rigTaskId, setRigTaskId] = useState("");
  const [riggedTaskId, setRiggedTaskId] = useState("");
  const [animOutFormat, setAnimOutFormat] = useState<"glb" | "fbx" | "mp4">("glb");
  const [animStatus, setAnimStatus] = useState<GenStatus>("idle");
  const [animLog, setAnimLog] = useState("");
  const [animProgress, setAnimProgress] = useState(0);
  const [animResult, setAnimResult] = useState<TaskResult | null>(null);
  const [animError, setAnimError] = useState("");
  const [prerigResult, setPrerigResult] = useState<{ ok: boolean; msg: string } | null>(null);
  const [prerigLoading, setPrerigLoading] = useState(false);

  // Stylize
  const [stylizeTaskId, setStylizeTaskId] = useState("");
  const [stylizePreset, setStylizePreset] = useState("lego");
  const [stylizeStatus, setStylizeStatus] = useState<GenStatus>("idle");
  const [stylizeLog, setStylizeLog] = useState("");
  const [stylizeProgress, setStylizeProgress] = useState(0);
  const [stylizeResult, setStylizeResult] = useState<TaskResult | null>(null);
  const [stylizeError, setStylizeError] = useState("");

  // Gallery
  const [gallery, setGallery] = useState<(TaskResult & { label?: string })[]>([]);
  const [balance, setBalance] = useState<{ balance?: number; frozen?: number } | null>(null);

  // Load animations & model-viewer script & balance
  useEffect(() => {
    fetch(`${API}/api/tripo3d/animations`, { credentials: "include" })
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d?.animations) setAnimations(d.animations); })
      .catch(() => {});
    fetch(`${API}/api/tripo3d/balance`, { credentials: "include" })
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d) setBalance(d); })
      .catch(() => {});
    if (!document.getElementById("model-viewer-script")) {
      const s = document.createElement("script");
      s.id = "model-viewer-script"; s.type = "module";
      s.src = "https://unpkg.com/@google/model-viewer/dist/model-viewer.min.js";
      document.head.appendChild(s);
    }
  }, []);

  // ── SSE helpers ──────────────────────────────────────────────────────────
  const streamSSE = useCallback((
    url: string,
    body: BodyInit | undefined,
    onEvent: (e: any) => void,
    ct = "application/json",
  ) => {
    fetch(url, {
      method: "POST", credentials: "include",
      headers: ct === "application/json" ? { "Content-Type": "application/json" } : undefined,
      body,
    }).then(async res => {
      if (!res.ok) { onEvent({ event: "error", error: (await res.text()).slice(0, 200) }); return; }
      const reader = res.body?.getReader();
      if (!reader) return;
      const dec = new TextDecoder();
      let buf = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += dec.decode(value, { stream: true });
        const lines = buf.split("\n");
        buf = lines.pop() ?? "";
        for (const line of lines) {
          if (line.startsWith("data: ")) {
            try { onEvent(JSON.parse(line.slice(6))); } catch { }
          }
        }
      }
    }).catch(e => onEvent({ event: "error", error: e.message }));
  }, []);

  function mainHandleSse(e: any, label = "Modelo 3D") {
    if (e.event === "started")  { setStatus("running"); setLog(`Tarea ${e.task_id?.slice(0,8)}… iniciada`); }
    if (e.event === "progress") { setProgress(e.progress ?? 0); setLog(`${e.status || "Procesando"} — ${e.progress ?? 0}%`); }
    if (e.event === "done")     { setStatus("done"); setProgress(100); setLog("¡Modelo listo!"); setResult(e); addToGallery(e, label); }
    if (e.event === "error")    { setStatus("error"); setError(e.error ?? "Error desconocido"); }
  }

  function addToGallery(r: TaskResult, label?: string) {
    setGallery(g => [{ ...r, label }, ...g].slice(0, 50));
  }

  function resetMain() { setStatus("idle"); setProgress(0); setLog(""); setError(""); setResult(null); }

  // ── GENERATORS ──────────────────────────────────────────────────────────

  // 1. Text → 3D
  const generateText = () => {
    if (!prompt.trim()) return;
    resetMain(); setStatus("uploading"); setLog("Enviando a Tripo3D…");
    streamSSE(
      `${API}/api/tripo3d/text-to-model`,
      JSON.stringify({
        prompt, negative_prompt: negPrompt || undefined,
        model_version: modelVersion, texture: withTexture, pbr: withPbr,
        face_limit: faceLimit ? Number(faceLimit) : undefined,
        style: textStyle || undefined,
        quality: textQuality || undefined,
        seed: textSeed ? Number(textSeed) : undefined,
      }),
      e => mainHandleSse(e, "Texto → 3D"),
    );
  };

  // 2. Image → 3D (direct)
  const generateImage = () => {
    if (!imageFile) return;
    const fd = new FormData();
    fd.append("image", imageFile);
    fd.append("model_version", modelVersion);
    fd.append("texture", String(withTexture));
    fd.append("pbr", String(withPbr));
    if (faceLimit) fd.append("face_limit", faceLimit);
    resetMain(); setStatus("uploading"); setLog("Subiendo imagen…");
    streamSSE(`${API}/api/tripo3d/image-to-model`, fd, e => mainHandleSse(e, "Imagen → 3D"), "multipart");
  };

  // 3. Image → 4 views → multiview-to-3D
  const imageToMultiview = async () => {
    if (!imageFile) return;
    setImgMultiviewLoading(true); setImgMultiviewError(""); setImgMultiviewViews({}); setImgMultiviewFiles({}); setImgMultiviewDesc("");
    try {
      const fd = new FormData(); fd.append("image", imageFile);
      const r = await fetch(`${API}/api/tripo3d/image-to-multiview`, { method: "POST", credentials: "include", body: fd });
      const d = await r.json();
      if (!r.ok) { setImgMultiviewError(d.error ?? "Error generando vistas"); return; }
      const { views: gen, description } = d as { views: Record<string, string>; description: string };
      setImgMultiviewDesc(description);
      setImgMultiviewViews(gen);
      // Download blobs to use as Files for the multiview-to-model call
      const files: Record<string, File> = {};
      await Promise.all((["front","left","back","right"] as const).map(async k => {
        const url = gen[k]; if (!url) return;
        if (url.startsWith("data:")) {
          const res2 = await fetch(url);
          files[k] = new File([await res2.blob()], `${k}.jpg`, { type: "image/jpeg" });
        } else {
          const res2 = await fetch(url);
          files[k] = new File([await res2.blob()], `${k}.jpg`, { type: "image/jpeg" });
        }
      }));
      setImgMultiviewFiles(files);
      setImgMode("multiview");
    } catch (e: any) { setImgMultiviewError(e.message ?? "Error"); }
    setImgMultiviewLoading(false);
  };

  const generateMultiviewFromImage = () => {
    const mvFiles = imgMultiviewFiles;
    if (!mvFiles.front) return;
    const fd = new FormData();
    (["front","left","back","right"] as const).forEach(k => mvFiles[k] && fd.append(k, mvFiles[k]!));
    fd.append("model_version", modelVersion);
    fd.append("texture", String(withTexture));
    fd.append("pbr", String(withPbr));
    resetMain(); setStatus("uploading"); setLog("Enviando 4 vistas generadas…");
    streamSSE(`${API}/api/tripo3d/multiview-to-model`, fd, e => mainHandleSse(e, "Imagen → 4 vistas → 3D"), "multipart");
  };

  // 4. Multiview (manual)
  const generateMultiview = () => {
    if (!views.front) return;
    const fd = new FormData();
    (["front","left","back","right"] as const).forEach(k => views[k] && fd.append(k, views[k]!));
    fd.append("model_version", modelVersion);
    fd.append("texture", String(withTexture));
    fd.append("pbr", String(withPbr));
    resetMain(); setStatus("uploading"); setLog("Enviando 4 vistas…");
    streamSSE(`${API}/api/tripo3d/multiview-to-model`, fd, e => mainHandleSse(e, "Multi-Vista → 3D"), "multipart");
  };

  const autoGenViews = async () => {
    if (!mvAutoPrompt.trim()) return;
    setMvAutoGenerating(true); setMvAutoError("");
    try {
      const r = await fetch(`${API}/api/tripo3d/generate-views`, { method: "POST", headers: { "Content-Type": "application/json" }, credentials: "include", body: JSON.stringify({ prompt: mvAutoPrompt.trim() }) });
      const d = await r.json();
      if (!r.ok) { setMvAutoError(d.error ?? "Error"); return; }
      const { views: gen } = d as { views: Record<string, string> };
      const newViews: typeof views = {};
      const newPreviews: Record<string, string> = {};
      await Promise.all((["front","left","back","right"] as const).map(async k => {
        const url = gen[k]; if (!url) return;
        newPreviews[k] = url;
        const blob = await (await fetch(url)).blob();
        newViews[k] = new File([blob], `${k}.jpg`, { type: blob.type });
      }));
      setViewPreviews(p => ({ ...p, ...newPreviews }));
      setViews(v => ({ ...v, ...newViews }));
    } catch (e: any) { setMvAutoError(e.message ?? "Error"); }
    setMvAutoGenerating(false);
  };

  // 5. Batch
  const generateBatch = () => {
    if (!batchFiles.length) return;
    const fd = new FormData();
    batchFiles.forEach(b => fd.append("images", b.file));
    fd.append("model_version", modelVersion); fd.append("texture", String(withTexture)); fd.append("pbr", String(withPbr));
    setBatchFiles(prev => prev.map(b => ({ ...b, status: "uploading" as const, progress: 0 })));
    streamSSE(`${API}/api/tripo3d/batch`, fd, (e) => {
      if (e.event === "batch_started") setLog(`Lote de ${e.total} modelos…`);
      if (e.event === "task_created")  setBatchFiles(prev => prev.map((b, i) => i === e.index ? { ...b, task_id: e.task_id, status: "running" as const } : b));
      if (e.event === "progress")      setBatchFiles(prev => prev.map((b, i) => i === e.index ? { ...b, progress: e.progress ?? 0 } : b));
      if (e.event === "task_done")     { setBatchFiles(prev => prev.map((b, i) => i === e.index ? { ...b, status: "done" as const, progress: 100, output: e.output } : b)); addToGallery({ task_id: e.task_id, output: e.output }, "Batch"); }
      if (e.event === "task_error")    setBatchFiles(prev => prev.map((b, i) => i === e.index ? { ...b, status: "error" as const, error: e.error } : b));
      if (e.event === "batch_done")    setLog(`Lote completado: ${e.succeeded}/${e.total} exitosos`);
    }, "multipart");
  };

  // 6. Process tab
  function handleProcessSse(e: any, label: string) {
    if (e.event === "started")  { setProcessStatus("running"); setProcessLog(`${label} — iniciado`); }
    if (e.event === "progress") { setProcessProgress(e.progress ?? 0); setProcessLog(`${label} — ${e.progress ?? 0}%`); }
    if (e.event === "done")     { setProcessStatus("done"); setProcessProgress(100); setProcessLog(`✓ ${label} completado`); setProcessResult(e); addToGallery(e, label); }
    if (e.event === "error")    { setProcessStatus("error"); setProcessError(e.error ?? "Error"); }
  }

  const runRefine = () => {
    if (!processTaskId.trim()) return;
    setProcessStatus("uploading"); setProcessLog("Refinando modelo…"); setProcessResult(null); setProcessError("");
    streamSSE(`${API}/api/tripo3d/refine`, JSON.stringify({ draft_model_task_id: processTaskId, texture: withTexture, pbr: withPbr, face_limit: faceLimit ? Number(faceLimit) : undefined }), e => handleProcessSse(e, "Refinar"));
  };

  const runConvert = async () => {
    if (!processTaskId.trim()) return;
    setProcessStatus("running"); setProcessLog(`Convirtiendo a ${convertFormat.toUpperCase()}…`); setProcessResult(null); setProcessError("");
    try {
      const r = await fetch(`${API}/api/tripo3d/convert`, { method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ original_model_task_id: processTaskId, format: convertFormat, quad: convertQuad || undefined, face_limit: convertFaceLimit ? Number(convertFaceLimit) : undefined, texture_size: convertTextureSize ? Number(convertTextureSize) : undefined, pivot_to_center_bottom: convertPivot || undefined }) });
      const d = await r.json();
      if (!r.ok) { setProcessStatus("error"); setProcessError(d.error ?? "Error"); return; }
      setProcessStatus("done"); setProcessLog(`✓ Convertido a ${convertFormat.toUpperCase()}`);
      const converted: TaskResult = { task_id: d.task_id, output: d.output };
      setProcessResult(converted); addToGallery(converted, `Convertir → ${convertFormat.toUpperCase()}`);
    } catch (e: any) { setProcessStatus("error"); setProcessError(e.message); }
  };

  const runTexture = () => {
    if (!processTaskId.trim() || !texturePrompt.trim()) return;
    setProcessStatus("uploading"); setProcessLog("Aplicando textura…"); setProcessResult(null); setProcessError("");
    streamSSE(`${API}/api/tripo3d/text-to-texture`, JSON.stringify({ original_model_task_id: processTaskId, prompt: texturePrompt, texture_quality: textureQuality }), e => handleProcessSse(e, "Textura"));
  };

  // 7. Segment
  const runSegment = () => {
    if (!segmentTaskId.trim()) return;
    setSegmentStatus("running"); setSegmentLog("Segmentando modelo en partes…"); setSegmentResult(null); setSegmentError("");
    streamSSE(`${API}/api/tripo3d/segment`, JSON.stringify({ original_model_task_id: segmentTaskId }), (e) => {
      if (e.event === "progress") { setSegmentProgress(e.progress ?? 0); setSegmentLog(`Segmentando — ${e.progress ?? 0}%`); }
      if (e.event === "done")     { setSegmentStatus("done"); setSegmentProgress(100); setSegmentLog("✓ Segmentación completa"); setSegmentResult(e); }
      if (e.event === "error")    { setSegmentStatus("error"); setSegmentError(e.error ?? "Error"); }
    });
  };

  // 8. Animate
  const checkPrerig = async () => {
    if (!rigTaskId.trim()) return;
    setPrerigLoading(true); setPrerigResult(null);
    try {
      const r = await fetch(`${API}/api/tripo3d/prerig`, { method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ original_model_task_id: rigTaskId }) });
      const d = await r.json();
      if (!r.ok) { setPrerigResult({ ok: false, msg: d.error ?? "Error" }); }
      else { setPrerigResult({ ok: d.output?.is_rigable !== false, msg: d.output?.is_rigable !== false ? "✓ El modelo puede ser rigueado" : "✗ El modelo no es adecuado para rigging (necesita forma humanoide/animal)" }); }
    } catch (e: any) { setPrerigResult({ ok: false, msg: e.message }); }
    setPrerigLoading(false);
  };

  const runRig = () => {
    if (!rigTaskId.trim()) return;
    setAnimStatus("running"); setAnimLog("Aplicando skeleton + rigging…"); setAnimResult(null); setAnimError(""); setRiggedTaskId("");
    streamSSE(`${API}/api/tripo3d/rig`, JSON.stringify({ original_model_task_id: rigTaskId }), (e) => {
      if (e.event === "progress") { setAnimProgress(e.progress ?? 0); setAnimLog(`Rigging — ${e.progress ?? 0}%`); }
      if (e.event === "done")     { setAnimStatus("done"); setAnimProgress(100); setRiggedTaskId(e.task_id); setAnimLog(`✓ Rigging completado (task: ${e.task_id?.slice(0,8)}…)`); }
      if (e.event === "error")    { setAnimStatus("error"); setAnimError(e.error ?? "Error"); }
    });
  };

  const runRetarget = () => {
    const src = riggedTaskId || rigTaskId;
    if (!src || !selectedAnim) return;
    setAnimStatus("running"); setAnimLog(`Aplicando "${selectedAnim}"…`); setAnimResult(null); setAnimError("");
    streamSSE(`${API}/api/tripo3d/retarget`, JSON.stringify({ original_model_task_id: src, animation: selectedAnim, out_format: animOutFormat }), (e) => {
      if (e.event === "progress") { setAnimProgress(e.progress ?? 0); setAnimLog(`Animando — ${e.progress ?? 0}%`); }
      if (e.event === "done")     { setAnimStatus("done"); setAnimProgress(100); setAnimResult(e); addToGallery(e, `Animación: ${selectedAnim}`); setAnimLog(`✓ "${selectedAnim}" en ${animOutFormat.toUpperCase()}`); }
      if (e.event === "error")    { setAnimStatus("error"); setAnimError(e.error ?? "Error"); }
    });
  };

  // 9. Stylize
  const runStylize = () => {
    if (!stylizeTaskId.trim()) return;
    setStylizeStatus("running"); setStylizeLog(`Aplicando estilo ${stylizePreset}…`); setStylizeResult(null); setStylizeError("");
    streamSSE(`${API}/api/tripo3d/stylize`, JSON.stringify({ original_model_task_id: stylizeTaskId, style: stylizePreset }), (e) => {
      if (e.event === "progress") { setStylizeProgress(e.progress ?? 0); setStylizeLog(`Estilizando — ${e.progress ?? 0}%`); }
      if (e.event === "done")     { setStylizeStatus("done"); setStylizeProgress(100); setStylizeResult(e); addToGallery(e, `Estilo: ${stylizePreset}`); setStylizeLog("✓ Estilo aplicado"); }
      if (e.event === "error")    { setStylizeStatus("error"); setStylizeError(e.error ?? "Error"); }
    });
  };

  const filteredAnims = animations.filter(a => a.category === animCat);
  const isRunning = status === "uploading" || status === "running";

  // ── Options sidebar ──────────────────────────────────────────────────────
  const OptionsPanel = () => (
    <div style={{ ...cardSt, padding: "16px 18px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 14 }}>
        <Settings2 size={14} style={{ color: "var(--t3)" }} />
        <span style={{ fontSize: 12, fontWeight: 700, color: "var(--t3)", textTransform: "uppercase", letterSpacing: 0.5 }}>Parámetros del modelo</span>
      </div>

      <div style={{ marginBottom: 14 }}>
        <label style={{ fontSize: 11, color: "var(--t3)", display: "block", marginBottom: 7 }}>Versión Tripo3D</label>
        {MODEL_VERSIONS.map(v => (
          <button key={v.value} onClick={() => setModelVersion(v.value)} style={{
            width: "100%", marginBottom: 5, padding: "8px 12px", borderRadius: 8, textAlign: "left",
            border: `1px solid ${modelVersion === v.value ? "#3b80e4" : "var(--ink4)"}`,
            background: modelVersion === v.value ? "rgba(59,128,228,0.12)" : "transparent",
            color: modelVersion === v.value ? "#3b80e4" : "var(--t3)", fontSize: 12, cursor: "pointer",
            fontWeight: modelVersion === v.value ? 700 : 400, display: "flex", alignItems: "center", gap: 7,
          }}>
            {v.badge} {v.label}
          </button>
        ))}
      </div>

      {[
        { val: withTexture, set: setWithTexture, label: "Textura (UV color maps)", desc: "Genera mapas de color automáticos" },
        { val: withPbr,     set: setWithPbr,     label: "PBR Materials",           desc: "Roughness, metalness, ambient occlusion" },
      ].map(opt => (
        <label key={opt.label} style={{ display: "flex", alignItems: "flex-start", gap: 10, cursor: "pointer", marginBottom: 10 }}>
          <div onClick={() => opt.set(!opt.val)} style={{ width: 20, height: 20, borderRadius: 5, border: `2px solid ${opt.val ? "#3b80e4" : "var(--ink4)"}`, background: opt.val ? "#3b80e4" : "transparent", flexShrink: 0, marginTop: 1, display: "flex", alignItems: "center", justifyContent: "center" }}>
            {opt.val && <CheckCircle2 size={12} color="#fff" />}
          </div>
          <div>
            <div style={{ fontSize: 13, color: "var(--t)", fontWeight: 600 }}>{opt.label}</div>
            <div style={{ fontSize: 10, color: "var(--t3)" }}>{opt.desc}</div>
          </div>
        </label>
      ))}

      <div style={{ marginTop: 8 }}>
        <label style={{ fontSize: 11, color: "var(--t3)", display: "block", marginBottom: 5 }}>Límite de polígonos (face limit)</label>
        <input type="number" value={faceLimit} onChange={e => setFaceLimit(e.target.value)} placeholder="Vacío = sin límite" style={{ ...inputSt, fontSize: 12 }} />
        <div style={{ fontSize: 10, color: "var(--t3)", marginTop: 3 }}>10000–800000 recomendado</div>
      </div>

      {balance !== null && (
        <div style={{ marginTop: 14, padding: "10px 12px", borderRadius: 9, background: "rgba(59,128,228,0.07)", border: "1px solid rgba(59,128,228,0.2)" }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: "#3b80e4", marginBottom: 4 }}>💰 Créditos Tripo3D</div>
          <div style={{ fontSize: 14, fontWeight: 800, color: "var(--t)" }}>{balance.balance ?? "—"} <span style={{ fontSize: 11, fontWeight: 400, color: "var(--t3)" }}>disponibles</span></div>
          {balance.frozen != null && <div style={{ fontSize: 11, color: "var(--t3)" }}>{balance.frozen} en uso ahora</div>}
        </div>
      )}
    </div>
  );

  const TABS: { id: Tab; icon: string; label: string; tip: string }[] = [
    { id: "text",      icon: "✍️",  label: "Texto",      tip: "Describe y genera en segundos" },
    { id: "image",     icon: "📷",  label: "Imagen",     tip: "Una foto → modelo 3D (+ 4 vistas auto)" },
    { id: "multiview", icon: "🔄",  label: "Multi-Vista",tip: "4 ángulos manuales → 3D preciso" },
    { id: "batch",     icon: "⚡",  label: "Lote",       tip: "Hasta 10 modelos simultáneos" },
    { id: "process",   icon: "🔧",  label: "Procesar",   tip: "Refinar · Convertir · Texturizar" },
    { id: "segment",   icon: "✂️",  label: "Segmentar",  tip: "Dividir modelo en partes semánticas" },
    { id: "animate",   icon: "💃",  label: "Animar",     tip: "Prerig check → Rig → 134 animaciones" },
    { id: "stylize",   icon: "🎨",  label: "Estilizar",  tip: "LEGO · Voxel · Voronoi · Minecraft" },
    { id: "gallery",   icon: "🗄️",  label: "Galería",    tip: "Todos los modelos de esta sesión" },
  ];

  return (
    <div style={{ minHeight: "100vh", padding: "20px 16px 40px" }}>

      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 22 }}>
        <div style={{ width: 52, height: 52, borderRadius: 16, background: "linear-gradient(135deg,#3b80e4,#1a56c8)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 26, boxShadow: "0 6px 24px rgba(59,128,228,0.4)" }}>🧊</div>
        <div style={{ flex: 1 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <h1 style={{ margin: 0, fontSize: 22, fontWeight: 900, color: "var(--t)" }}>Tripo 3D Studio</h1>
            <span style={{ fontSize: 10, padding: "3px 9px", borderRadius: 20, background: "rgba(59,128,228,0.15)", color: "#3b80e4", border: "1px solid rgba(59,128,228,0.3)", fontWeight: 700 }}>API v2.5</span>
          </div>
          <p style={{ margin: "2px 0 0", fontSize: 12, color: "var(--t3)" }}>
            Texto · Imagen · Multi-Vista · Segmentar · Refinar · Convertir · Texturizar · Rigging · 134 Animaciones · Estilizar
          </p>
        </div>
      </div>

      {/* Tab bar */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginBottom: 20, padding: 5, background: "var(--ink2)", borderRadius: 14, border: "1px solid var(--ink3)" }}>
        {TABS.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)} title={t.tip} style={{
            padding: "7px 13px", borderRadius: 10, border: "none", fontSize: 12, fontWeight: tab === t.id ? 700 : 400,
            background: tab === t.id ? "linear-gradient(135deg,#3b80e4,#1a56c8)" : "transparent",
            color: tab === t.id ? "#fff" : "var(--t3)", cursor: "pointer",
            boxShadow: tab === t.id ? "0 3px 10px rgba(59,128,228,0.4)" : "none",
            display: "flex", alignItems: "center", gap: 5, whiteSpace: "nowrap",
          }}>
            <span>{t.icon}</span> {t.label}
          </button>
        ))}
      </div>

      {/* Main grid */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 270px", gap: 16, alignItems: "start" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>

          {/* ── TEXT TAB ──────────────────────────────────────────────────── */}
          {tab === "text" && (
            <div style={cardSt}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
                <Wand2 size={16} color="#3b80e4" />
                <h3 style={{ margin: 0, fontSize: 14, fontWeight: 700, color: "var(--t)" }}>Texto → Modelo 3D</h3>
                <span style={{ fontSize: 10, color: "var(--t3)", marginLeft: "auto" }}>~30–90 seg</span>
              </div>
              <div style={{ position: "relative" }}>
                <textarea rows={3} value={prompt} onChange={e => setPrompt(e.target.value)} onFocus={() => setShowSuggestions(true)}
                  placeholder="Describe el objeto en inglés: 'a cute low-poly robot with glowing blue eyes, metallic texture, game-ready style'"
                  style={{ ...inputSt, minHeight: 85, resize: "vertical" }} />
                {showSuggestions && !prompt && (
                  <div style={{ position: "absolute", left: 0, right: 0, top: "calc(100% + 4px)", background: "var(--ink2)", border: "1px solid var(--ink4)", borderRadius: 10, zIndex: 10, overflow: "hidden", boxShadow: "0 8px 30px rgba(0,0,0,0.5)" }}>
                    <div style={{ padding: "7px 12px", fontSize: 10, color: "var(--t3)", borderBottom: "1px solid var(--ink4)", fontWeight: 700, textTransform: "uppercase" }}>💡 Sugerencias</div>
                    {PROMPT_SUGGESTIONS.map((s, i) => (
                      <button key={i} onClick={() => { setPrompt(s); setShowSuggestions(false); }} style={{ width: "100%", textAlign: "left", padding: "8px 12px", background: "none", border: "none", color: "var(--t)", fontSize: 12, cursor: "pointer", borderBottom: i < PROMPT_SUGGESTIONS.length - 1 ? "1px solid var(--ink3)" : "none" }}
                        onMouseEnter={e => (e.currentTarget.style.background = "var(--ink3)")}
                        onMouseLeave={e => (e.currentTarget.style.background = "none")}>
                        {s}
                      </button>
                    ))}
                  </div>
                )}
                {showSuggestions && <div style={{ position: "fixed", inset: 0, zIndex: 9 }} onClick={() => setShowSuggestions(false)} />}
              </div>
              <input value={negPrompt} onChange={e => setNegPrompt(e.target.value)} placeholder="Prompt negativo: 'low quality, broken, deformed'" style={{ ...inputSt, marginTop: 8 }} />

              {/* Advanced toggle */}
              <button onClick={() => setShowAdvText(s => !s)} style={{ ...btnSec, marginTop: 10, fontSize: 11 }}>
                <Settings2 size={11} /> Opciones avanzadas {showAdvText ? "▾" : "▸"}
              </button>

              {showAdvText && (
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10, marginTop: 10, padding: "14px", background: "var(--ink3)", borderRadius: 10 }}>
                  <div>
                    <label style={{ fontSize: 10, color: "var(--t3)", display: "block", marginBottom: 4 }}>Estilo artístico</label>
                    <select value={textStyle} onChange={e => setTextStyle(e.target.value)} style={{ ...inputSt, fontSize: 11 }}>
                      {TEXT_STYLES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                    </select>
                  </div>
                  <div>
                    <label style={{ fontSize: 10, color: "var(--t3)", display: "block", marginBottom: 4 }}>Calidad</label>
                    <select value={textQuality} onChange={e => setTextQuality(e.target.value)} style={{ ...inputSt, fontSize: 11 }}>
                      <option value="">Por defecto</option>
                      <option value="draft">Draft (rápido)</option>
                      <option value="standard">Standard</option>
                      <option value="detailed">Detailed (lento)</option>
                    </select>
                  </div>
                  <div>
                    <label style={{ fontSize: 10, color: "var(--t3)", display: "block", marginBottom: 4 }}>Seed (reproducible)</label>
                    <input type="number" value={textSeed} onChange={e => setTextSeed(e.target.value)} placeholder="Aleatorio" style={{ ...inputSt, fontSize: 11 }} />
                  </div>
                </div>
              )}

              <button onClick={generateText} disabled={!prompt.trim() || isRunning} style={{ ...btnPri, width: "100%", marginTop: 14, opacity: !prompt.trim() ? 0.5 : 1 }}>
                {isRunning ? <><Loader2 size={14} style={{ animation: "spin 0.8s linear infinite" }} /> Generando…</> : <><Box size={14} /> Generar Modelo 3D</>}
              </button>
              <StatusLog status={status} progress={progress} log={log} error={error} />
              {result && tab === "text" && <div style={{ marginTop: 12 }}><ModelViewer url={result.output?.model || result.output?.pbr_model} previewImg={result.output?.rendered_image} /></div>}
            </div>
          )}

          {/* ── IMAGE TAB ─────────────────────────────────────────────────── */}
          {tab === "image" && (
            <div style={cardSt}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
                <Image size={16} color="#3b80e4" />
                <h3 style={{ margin: 0, fontSize: 14, fontWeight: 700, color: "var(--t)" }}>Imagen → Modelo 3D</h3>
              </div>

              <DropZone preview={imagePreview} label="Arrastra o sube una imagen" subLabel="PNG · JPG · WEBP — fondo limpio da mejores resultados" onFile={f => { setImageFile(f); setImagePreview(URL.createObjectURL(f)); setImgMode("direct"); setImgMultiviewViews({}); }} />

              {imageFile && (
                <>
                  {/* Mode selector */}
                  <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
                    <button onClick={() => setImgMode("direct")} style={{ flex: 1, padding: "9px", borderRadius: 9, border: `1px solid ${imgMode === "direct" ? "#3b80e4" : "var(--ink4)"}`, background: imgMode === "direct" ? "rgba(59,128,228,0.12)" : "transparent", color: imgMode === "direct" ? "#3b80e4" : "var(--t3)", fontSize: 12, cursor: "pointer", fontWeight: imgMode === "direct" ? 700 : 400 }}>
                      📷 Imagen directa → 3D
                    </button>
                    <button onClick={() => setImgMode("multiview")} style={{ flex: 1, padding: "9px", borderRadius: 9, border: `1px solid ${imgMode === "multiview" ? "#3b80e4" : "var(--ink4)"}`, background: imgMode === "multiview" ? "rgba(59,128,228,0.12)" : "transparent", color: imgMode === "multiview" ? "#3b80e4" : "var(--t3)", fontSize: 12, cursor: "pointer", fontWeight: imgMode === "multiview" ? 700 : 400 }}>
                      🔄 Generar 4 vistas → 3D
                    </button>
                  </div>

                  {imgMode === "direct" && (
                    <>
                      <button onClick={generateImage} disabled={isRunning} style={{ ...btnPri, width: "100%", marginTop: 12 }}>
                        {isRunning ? <><Loader2 size={14} style={{ animation: "spin 0.8s linear infinite" }} /> Generando…</> : <><Box size={14} /> Generar desde Imagen</>}
                      </button>
                      <StatusLog status={status} progress={progress} log={log} error={error} />
                      {result && <div style={{ marginTop: 12 }}><ModelViewer url={result.output?.model || result.output?.pbr_model} previewImg={result.output?.rendered_image} /></div>}
                    </>
                  )}

                  {imgMode === "multiview" && (
                    <div style={{ marginTop: 12 }}>
                      {/* Step 1: generate 4 views */}
                      <div style={{ ...cardSt, background: "rgba(59,128,228,0.05)", borderColor: "rgba(59,128,228,0.2)", marginBottom: 12, padding: "14px 16px" }}>
                        <div style={{ fontWeight: 700, fontSize: 13, color: "#3b80e4", marginBottom: 8 }}>Paso 1 — Generar 4 vistas con IA</div>
                        <div style={{ fontSize: 12, color: "var(--t3)", marginBottom: 10 }}>
                          Gemini describe el objeto de tu imagen, luego xAI Aurora genera renderizados desde 4 ángulos (frontal, izquierda, atrás, derecha) para una reconstrucción 3D más precisa.
                        </div>
                        <button onClick={imageToMultiview} disabled={imgMultiviewLoading} style={{ ...btnPri, width: "100%" }}>
                          {imgMultiviewLoading ? <><Loader2 size={14} style={{ animation: "spin 0.8s linear infinite" }} /> Analizando imagen y generando vistas…</> : <><Sparkles size={14} /> Generar 4 vistas desde esta imagen</>}
                        </button>
                        {imgMultiviewError && <div style={{ marginTop: 8, fontSize: 12, color: "#f87171" }}>{imgMultiviewError}</div>}
                        {imgMultiviewDesc && <div style={{ marginTop: 8, fontSize: 11, color: "var(--t3)", background: "var(--ink3)", padding: "8px 10px", borderRadius: 7 }}>🔍 Objeto detectado: <em>{imgMultiviewDesc}</em></div>}
                        {Object.keys(imgMultiviewViews).length > 0 && (
                          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginTop: 12 }}>
                            {(["front","left","back","right"] as const).map(k => imgMultiviewViews[k] && (
                              <div key={k}>
                                <div style={{ fontSize: 10, color: "var(--t3)", fontWeight: 700, textTransform: "uppercase", marginBottom: 4 }}>
                                  {k === "front" ? "🔵 Frente" : k === "left" ? "🟡 Izquierda" : k === "back" ? "🟠 Atrás" : "🟢 Derecha"}
                                </div>
                                <img src={imgMultiviewViews[k]} alt={k} style={{ width: "100%", height: 100, objectFit: "contain", borderRadius: 8, background: "var(--ink3)", border: "1px solid var(--ink4)" }} />
                              </div>
                            ))}
                          </div>
                        )}
                      </div>

                      {/* Step 2: generate 3D from 4 views */}
                      {Object.keys(imgMultiviewFiles).length > 0 && (
                        <div style={{ ...cardSt, background: "rgba(74,240,200,0.04)", borderColor: "rgba(74,240,200,0.2)", padding: "14px 16px" }}>
                          <div style={{ fontWeight: 700, fontSize: 13, color: "#4af0c8", marginBottom: 8 }}>Paso 2 — Generar Modelo 3D desde las 4 vistas</div>
                          <button onClick={generateMultiviewFromImage} disabled={isRunning} style={{ ...btnPri, width: "100%", background: "linear-gradient(135deg,#059669,#047857)" }}>
                            {isRunning ? <><Loader2 size={14} style={{ animation: "spin 0.8s linear infinite" }} /> Generando…</> : <><Layers size={14} /> Generar 3D de Alta Precisión (Multi-Vista)</>}
                          </button>
                          <StatusLog status={status} progress={progress} log={log} error={error} />
                          {result && <div style={{ marginTop: 12 }}><ModelViewer url={result.output?.model || result.output?.pbr_model} previewImg={result.output?.rendered_image} /></div>}
                        </div>
                      )}
                    </div>
                  )}

                  <button onClick={() => { setImageFile(null); setImagePreview(""); setImgMultiviewViews({}); setImgMultiviewFiles({}); }} style={{ ...btnSec, marginTop: 8, fontSize: 11 }}>
                    <RotateCcw size={11} /> Cambiar imagen
                  </button>
                </>
              )}
            </div>
          )}

          {/* ── MULTIVIEW TAB ─────────────────────────────────────────────── */}
          {tab === "multiview" && (
            <div style={cardSt}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
                <Layers size={16} color="#3b80e4" />
                <h3 style={{ margin: 0, fontSize: 14, fontWeight: 700, color: "var(--t)" }}>Multi-Vista Manual → 3D</h3>
                <span style={{ fontSize: 10, color: "var(--t3)", marginLeft: "auto" }}>Mayor precisión</span>
              </div>

              {/* Auto-generate from prompt */}
              <div style={{ ...cardSt, background: "rgba(59,128,228,0.06)", borderColor: "rgba(59,128,228,0.2)", padding: "12px 14px", marginBottom: 14 }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: "#3b80e4", marginBottom: 6 }}>⚡ Auto-generar vistas desde prompt (xAI Aurora)</div>
                <div style={{ display: "flex", gap: 8 }}>
                  <input value={mvAutoPrompt} onChange={e => setMvAutoPrompt(e.target.value)} placeholder="Describe el objeto para generar las 4 vistas automáticamente…" style={{ ...inputSt, flex: 1 }} />
                  <button onClick={autoGenViews} disabled={mvAutoGenerating || !mvAutoPrompt.trim()} style={{ ...btnPri, padding: "10px 14px", opacity: !mvAutoPrompt.trim() ? 0.5 : 1 }}>
                    {mvAutoGenerating ? <Loader2 size={14} style={{ animation: "spin 0.8s linear infinite" }} /> : <Sparkles size={14} />}
                  </button>
                </div>
                {mvAutoError && <div style={{ fontSize: 11, color: "#f87171", marginTop: 6 }}>{mvAutoError}</div>}
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                {(["front","left","back","right"] as const).map(k => (
                  <div key={k}>
                    <label style={{ fontSize: 11, color: "var(--t3)", display: "block", marginBottom: 5, fontWeight: 700 }}>
                      {k === "front" ? "🔵 Frente *" : k === "left" ? "🟡 Izquierda" : k === "back" ? "🟠 Atrás" : "🟢 Derecha"}
                    </label>
                    <DropZone preview={viewPreviews[k]} label={k === "front" ? "Vista frontal (requerida)" : `Vista ${k}`} subLabel="PNG/JPG — fondo limpio" height={120}
                      onFile={f => { setViews(v => ({ ...v, [k]: f })); setViewPreviews(p => ({ ...p, [k]: URL.createObjectURL(f) })); }} />
                  </div>
                ))}
              </div>

              <button onClick={generateMultiview} disabled={!views.front || isRunning} style={{ ...btnPri, width: "100%", marginTop: 14, opacity: !views.front ? 0.5 : 1 }}>
                {isRunning ? <><Loader2 size={14} style={{ animation: "spin 0.8s linear infinite" }} /> Generando…</> : <><Layers size={14} /> Generar 3D Multi-Vista</>}
              </button>
              <StatusLog status={status} progress={progress} log={log} error={error} />
              {result && tab === "multiview" && <div style={{ marginTop: 12 }}><ModelViewer url={result.output?.model || result.output?.pbr_model} previewImg={result.output?.rendered_image} /></div>}
            </div>
          )}

          {/* ── BATCH TAB ─────────────────────────────────────────────────── */}
          {tab === "batch" && (
            <div style={cardSt}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
                <Zap size={16} color="#3b80e4" />
                <h3 style={{ margin: 0, fontSize: 14, fontWeight: 700, color: "var(--t)" }}>Lote — Hasta 10 modelos simultáneos</h3>
              </div>
              <div onClick={() => batchRef.current?.click()} style={{ border: "2px dashed rgba(59,128,228,0.3)", borderRadius: 10, padding: 22, textAlign: "center", cursor: "pointer" }}>
                <Upload size={22} style={{ color: "#3b80e4", margin: "0 auto 8px" }} />
                <div style={{ fontSize: 13, color: "var(--t)", fontWeight: 600 }}>Arrastra hasta 10 imágenes</div>
                <div style={{ fontSize: 11, color: "var(--t3)", marginTop: 4 }}>Cada imagen genera un modelo 3D en paralelo</div>
              </div>
              <input ref={batchRef} type="file" accept="image/*" multiple style={{ display: "none" }}
                onChange={e => { if (!e.target.files) return; const items: BatchItem[] = Array.from(e.target.files).slice(0, 10).map(f => ({ file: f, preview: URL.createObjectURL(f), progress: 0, status: "pending" as const })); setBatchFiles(p => [...p, ...items].slice(0, 10)); }} />

              {batchFiles.length > 0 && (
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(90px, 1fr))", gap: 8, marginTop: 12 }}>
                  {batchFiles.map((b, i) => (
                    <div key={i} style={{ position: "relative", borderRadius: 8, overflow: "hidden", border: `1px solid ${b.status === "done" ? "#4af0c8" : b.status === "error" ? "#f87171" : "var(--ink4)"}` }}>
                      <img src={b.preview} alt="" style={{ width: "100%", height: 75, objectFit: "cover" }} />
                      <div style={{ padding: "3px 6px", fontSize: 9, color: b.status === "done" ? "#4af0c8" : b.status === "error" ? "#f87171" : "var(--t3)", background: "var(--ink2)" }}>
                        {b.status === "done" ? "✓" : b.status === "error" ? "✗" : b.status === "running" ? `${b.progress}%` : "…"}
                      </div>
                    </div>
                  ))}
                </div>
              )}
              <div style={{ display: "flex", gap: 8, marginTop: 14 }}>
                <button onClick={generateBatch} disabled={!batchFiles.length} style={{ ...btnPri, flex: 1, opacity: !batchFiles.length ? 0.5 : 1 }}>
                  <Zap size={14} /> Generar {batchFiles.length} modelo{batchFiles.length !== 1 ? "s" : ""}
                </button>
                {batchFiles.length > 0 && <button onClick={() => setBatchFiles([])} style={btnSec}><RotateCcw size={13} /> Limpiar</button>}
              </div>
            </div>
          )}

          {/* ── PROCESS TAB ───────────────────────────────────────────────── */}
          {tab === "process" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              {/* Mode selector */}
              <div style={{ display: "flex", gap: 6, padding: 4, background: "var(--ink2)", borderRadius: 10, border: "1px solid var(--ink3)" }}>
                {([
                  { id: "refine",  icon: "✨", label: "Refinar calidad" },
                  { id: "convert", icon: "🔁", label: "Convertir formato" },
                  { id: "texture", icon: "🎨", label: "Texturizar (texto)" },
                ] as const).map(m => (
                  <button key={m.id} onClick={() => setProcessMode(m.id)} style={{
                    flex: 1, padding: "8px", borderRadius: 8, border: "none", fontSize: 12, fontWeight: processMode === m.id ? 700 : 400,
                    background: processMode === m.id ? "var(--ink4)" : "transparent",
                    color: processMode === m.id ? "var(--t)" : "var(--t3)", cursor: "pointer",
                    display: "flex", alignItems: "center", justifyContent: "center", gap: 5,
                  }}>
                    {m.icon} {m.label}
                  </button>
                ))}
              </div>

              <div style={cardSt}>
                <TaskIdInput value={processTaskId} onChange={setProcessTaskId} />

                {/* REFINE */}
                {processMode === "refine" && (
                  <>
                    <div style={{ marginTop: 12, padding: "10px 12px", borderRadius: 8, background: "rgba(59,128,228,0.06)", border: "1px solid rgba(59,128,228,0.2)", fontSize: 12, color: "var(--t3)" }}>
                      ✨ <strong style={{ color: "#3b80e4" }}>Refinar</strong> toma un modelo borrador (draft) y lo reprocesa con mayor detalle — ideal tras una generación rápida. Útil cuando el resultado tiene artefactos o necesita más polígonos.
                    </div>
                    <button onClick={runRefine} disabled={!processTaskId.trim() || processStatus === "running"} style={{ ...btnPri, width: "100%", marginTop: 12, opacity: !processTaskId.trim() ? 0.5 : 1 }}>
                      {processStatus === "running" && processMode === "refine" ? <><Loader2 size={14} style={{ animation: "spin 0.8s linear infinite" }} /> Refinando…</> : <>✨ Refinar modelo</>}
                    </button>
                  </>
                )}

                {/* CONVERT */}
                {processMode === "convert" && (
                  <>
                    <div style={{ marginTop: 12 }}>
                      <label style={{ fontSize: 11, color: "var(--t3)", display: "block", marginBottom: 6 }}>Formato de destino</label>
                      <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
                        {CONVERT_FORMATS.map(f => (
                          <button key={f.value} onClick={() => setConvertFormat(f.value)} style={{ padding: "9px 12px", borderRadius: 8, border: `1px solid ${convertFormat === f.value ? "#3b80e4" : "var(--ink4)"}`, background: convertFormat === f.value ? "rgba(59,128,228,0.12)" : "var(--ink3)", color: convertFormat === f.value ? "#3b80e4" : "var(--t)", fontSize: 12, cursor: "pointer", textAlign: "left", fontWeight: convertFormat === f.value ? 700 : 400 }}>
                            {f.label}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginTop: 12 }}>
                      <div>
                        <label style={{ fontSize: 11, color: "var(--t3)", display: "block", marginBottom: 4 }}>Face limit</label>
                        <input type="number" value={convertFaceLimit} onChange={e => setConvertFaceLimit(e.target.value)} placeholder="Opcional" style={{ ...inputSt, fontSize: 12 }} />
                      </div>
                      <div>
                        <label style={{ fontSize: 11, color: "var(--t3)", display: "block", marginBottom: 4 }}>Texture size (px)</label>
                        <select value={convertTextureSize} onChange={e => setConvertTextureSize(e.target.value)} style={{ ...inputSt, fontSize: 12 }}>
                          <option value="">Por defecto</option>
                          {["512","1024","2048","4096"].map(s => <option key={s} value={s}>{s}×{s}</option>)}
                        </select>
                      </div>
                    </div>
                    <div style={{ display: "flex", gap: 16, marginTop: 10 }}>
                      <label style={{ display: "flex", alignItems: "center", gap: 6, cursor: "pointer", fontSize: 12, color: "var(--t3)" }}>
                        <input type="checkbox" checked={convertQuad} onChange={e => setConvertQuad(e.target.checked)} /> Quad mesh (cuadriláteros)
                      </label>
                      <label style={{ display: "flex", alignItems: "center", gap: 6, cursor: "pointer", fontSize: 12, color: "var(--t3)" }}>
                        <input type="checkbox" checked={convertPivot} onChange={e => setConvertPivot(e.target.checked)} /> Pivot → base del modelo
                      </label>
                    </div>
                    <button onClick={runConvert} disabled={!processTaskId.trim() || processStatus === "running"} style={{ ...btnPri, width: "100%", marginTop: 12, opacity: !processTaskId.trim() ? 0.5 : 1 }}>
                      {processStatus === "running" && processMode === "convert" ? <><Loader2 size={14} style={{ animation: "spin 0.8s linear infinite" }} /> Convirtiendo…</> : <>🔁 Convertir a {convertFormat.toUpperCase()}</>}
                    </button>
                  </>
                )}

                {/* TEXTURE */}
                {processMode === "texture" && (
                  <>
                    <div style={{ marginTop: 12 }}>
                      <label style={{ fontSize: 11, color: "var(--t3)", display: "block", marginBottom: 5 }}>Descripción de textura (prompt en inglés)</label>
                      <textarea rows={3} value={texturePrompt} onChange={e => setTexturePrompt(e.target.value)} placeholder="E.g.: 'dark weathered wood with metal hinges and rusty bolts, aged patina effect'" style={{ ...inputSt, resize: "vertical" }} />
                    </div>
                    <div style={{ marginTop: 10 }}>
                      <label style={{ fontSize: 11, color: "var(--t3)", display: "block", marginBottom: 5 }}>Calidad de textura</label>
                      <select value={textureQuality} onChange={e => setTextureQuality(e.target.value)} style={{ ...inputSt, fontSize: 12 }}>
                        <option value="standard">Standard</option>
                        <option value="detailed">Detailed (más tiempo)</option>
                      </select>
                    </div>
                    <button onClick={runTexture} disabled={!processTaskId.trim() || !texturePrompt.trim() || processStatus === "running"} style={{ ...btnPri, width: "100%", marginTop: 12, opacity: (!processTaskId.trim() || !texturePrompt.trim()) ? 0.5 : 1 }}>
                      {processStatus === "running" && processMode === "texture" ? <><Loader2 size={14} style={{ animation: "spin 0.8s linear infinite" }} /> Texturizando…</> : <>🎨 Aplicar textura</>}
                    </button>
                  </>
                )}

                {/* Process status */}
                {processStatus !== "idle" && (
                  <div style={{ marginTop: 10 }}>
                    <StatusLog status={processStatus} progress={processProgress} log={processLog} error={processError} />
                  </div>
                )}
                {processResult && <div style={{ marginTop: 12 }}><ModelViewer url={processResult.output?.model || processResult.output?.pbr_model} previewImg={processResult.output?.rendered_image} /></div>}
              </div>
            </div>
          )}

          {/* ── SEGMENT TAB ───────────────────────────────────────────────── */}
          {tab === "segment" && (
            <div style={cardSt}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
                <Scissors size={16} color="#3b80e4" />
                <h3 style={{ margin: 0, fontSize: 14, fontWeight: 700, color: "var(--t)" }}>Segmentar Modelo en Partes</h3>
              </div>

              <div style={{ padding: "12px 14px", borderRadius: 10, background: "rgba(139,92,246,0.06)", border: "1px solid rgba(139,92,246,0.2)", marginBottom: 14, fontSize: 12, color: "var(--t3)" }}>
                <strong style={{ color: "#8b5cf6" }}>✂️ Segmentación semántica</strong> divide el modelo 3D en componentes individuales separados (ej: un coche → carrocería, ruedas, ventanas; un personaje → cuerpo, ropa, cabello). Cada parte se puede editar, texturizar o animar de forma independiente.
              </div>

              <TaskIdInput value={segmentTaskId} onChange={setSegmentTaskId} label="Task ID del modelo a segmentar" />

              <button onClick={runSegment} disabled={!segmentTaskId.trim() || segmentStatus === "running"} style={{ ...btnPri, width: "100%", marginTop: 14, background: "linear-gradient(135deg,#7c3aed,#5b21b6)", boxShadow: "0 4px 14px rgba(124,58,237,0.35)", opacity: !segmentTaskId.trim() ? 0.5 : 1 }}>
                {segmentStatus === "running" ? <><Loader2 size={14} style={{ animation: "spin 0.8s linear infinite" }} /> Segmentando modelo…</> : <><Scissors size={14} /> Segmentar en partes</>}
              </button>

              {segmentStatus !== "idle" && (
                <div style={{ marginTop: 10 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 12px", borderRadius: 8, background: segmentStatus === "error" ? "rgba(248,113,113,0.1)" : segmentStatus === "done" ? "rgba(74,240,200,0.08)" : "rgba(59,128,228,0.08)", border: `1px solid ${segmentStatus === "error" ? "rgba(248,113,113,0.25)" : segmentStatus === "done" ? "rgba(74,240,200,0.2)" : "rgba(59,128,228,0.2)"}` }}>
                    {segmentStatus === "running" && <Loader2 size={14} style={{ animation: "spin 0.8s linear infinite", color: "#3b80e4", flexShrink: 0 }} />}
                    {segmentStatus === "done" && <CheckCircle2 size={14} color="#4af0c8" style={{ flexShrink: 0 }} />}
                    {segmentStatus === "error" && <AlertCircle size={14} color="#f87171" style={{ flexShrink: 0 }} />}
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 13, fontWeight: 600, color: segmentStatus === "error" ? "#f87171" : segmentStatus === "done" ? "#4af0c8" : "var(--t)" }}>
                        {segmentStatus === "error" ? segmentError : segmentLog}
                      </div>
                      {segmentStatus === "running" && <ProgressBar value={segmentProgress} />}
                    </div>
                  </div>
                </div>
              )}

              {segmentResult && (
                <div style={{ marginTop: 14 }}>
                  {segmentResult.output?.model && <ModelViewer url={segmentResult.output.model} previewImg={segmentResult.output.rendered_image} />}
                  {segmentResult.segments && segmentResult.segments.length > 0 && (
                    <div style={{ ...cardSt, marginTop: 12, padding: "14px 16px" }}>
                      <div style={{ fontWeight: 700, fontSize: 13, color: "var(--t)", marginBottom: 10 }}>🧩 Partes segmentadas ({segmentResult.segments.length})</div>
                      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                        {segmentResult.segments.map((seg: any, i: number) => (
                          <div key={i} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 12px", background: "var(--ink3)", borderRadius: 8 }}>
                            <div style={{ width: 32, height: 32, borderRadius: 8, background: `hsl(${i * 40}, 60%, 40%)`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14 }}>🧩</div>
                            <div style={{ flex: 1 }}>
                              <div style={{ fontSize: 13, fontWeight: 600, color: "var(--t)" }}>{seg.label || `Parte ${i + 1}`}</div>
                              {seg.model && <div style={{ fontSize: 10, color: "var(--t3)", fontFamily: "monospace" }}>Parte independiente disponible</div>}
                            </div>
                            {seg.model && <a href={seg.model} download style={{ ...btnSec, fontSize: 11, textDecoration: "none", padding: "5px 10px" }}><Download size={11} /> GLB</a>}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* ── ANIMATE TAB ───────────────────────────────────────────────── */}
          {tab === "animate" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              {/* Step 0: Prerig check */}
              <div style={cardSt}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
                  <div style={{ width: 24, height: 24, borderRadius: "50%", background: prerigResult?.ok ? "#4af0c820" : "#3b80e420", border: `2px solid ${prerigResult?.ok ? "#4af0c8" : "#3b80e4"}`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 800, color: prerigResult?.ok ? "#4af0c8" : "#3b80e4", flexShrink: 0 }}>0</div>
                  <h3 style={{ margin: 0, fontSize: 14, fontWeight: 700, color: "var(--t)" }}>Verificar compatibilidad (Prerig Check)</h3>
                  <span style={{ fontSize: 10, color: "var(--t3)", marginLeft: "auto" }}>Opcional pero recomendado</span>
                </div>
                <TaskIdInput value={rigTaskId} onChange={v => { setRigTaskId(v); setPrerigResult(null); setRiggedTaskId(""); }} label="Task ID del modelo a animar" />
                <button onClick={checkPrerig} disabled={!rigTaskId.trim() || prerigLoading} style={{ ...btnSec, marginTop: 10, width: "100%", justifyContent: "center" }}>
                  {prerigLoading ? <><Loader2 size={13} style={{ animation: "spin 0.8s linear infinite" }} /> Verificando…</> : <>🔍 Comprobar si puede animarse</>}
                </button>
                {prerigResult && (
                  <div style={{ marginTop: 8, padding: "8px 12px", borderRadius: 8, background: prerigResult.ok ? "rgba(74,240,200,0.08)" : "rgba(248,113,113,0.08)", border: `1px solid ${prerigResult.ok ? "rgba(74,240,200,0.25)" : "rgba(248,113,113,0.25)"}`, fontSize: 12, color: prerigResult.ok ? "#4af0c8" : "#f87171" }}>
                    {prerigResult.msg}
                  </div>
                )}
              </div>

              {/* Step 1: Rig */}
              <div style={{ ...cardSt, opacity: !rigTaskId.trim() ? 0.5 : 1 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
                  <div style={{ width: 24, height: 24, borderRadius: "50%", background: riggedTaskId ? "#4af0c820" : "#3b80e420", border: `2px solid ${riggedTaskId ? "#4af0c8" : "#3b80e4"}`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 800, color: riggedTaskId ? "#4af0c8" : "#3b80e4", flexShrink: 0 }}>
                    {riggedTaskId ? "✓" : "1"}
                  </div>
                  <h3 style={{ margin: 0, fontSize: 14, fontWeight: 700, color: "var(--t)" }}>Aplicar Skeleton + Rigging</h3>
                </div>
                <button onClick={runRig} disabled={!rigTaskId.trim() || (animStatus === "running" && !riggedTaskId)} style={{ ...btnPri, width: "100%", opacity: !rigTaskId.trim() ? 0.5 : 1 }}>
                  {animStatus === "running" && !riggedTaskId ? <><Loader2 size={14} style={{ animation: "spin 0.8s linear infinite" }} /> Aplicando rigging…</> : <><Cpu size={14} /> Aplicar Skeleton + Rigging</>}
                </button>
                {animLog && !riggedTaskId && (
                  <div style={{ marginTop: 8, padding: "8px 12px", borderRadius: 8, background: animStatus === "error" ? "rgba(248,113,113,0.1)" : "rgba(59,128,228,0.08)", fontSize: 12, color: animStatus === "error" ? "#f87171" : "#3b80e4" }}>
                    {animStatus === "error" ? animError : animLog}
                  </div>
                )}
                {riggedTaskId && (
                  <div style={{ marginTop: 8, padding: "8px 12px", borderRadius: 8, background: "rgba(74,240,200,0.08)", border: "1px solid rgba(74,240,200,0.25)", fontSize: 12, color: "#4af0c8" }}>
                    ✓ Rigging listo — Task rigged: <code style={{ fontSize: 11 }}>{riggedTaskId.slice(0, 16)}…</code>
                  </div>
                )}
              </div>

              {/* Step 2: Retarget */}
              <div style={{ ...cardSt, opacity: !rigTaskId.trim() ? 0.4 : 1 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
                  <div style={{ width: 24, height: 24, borderRadius: "50%", background: "#3b80e420", border: "2px solid #3b80e4", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 800, color: "#3b80e4", flexShrink: 0 }}>2</div>
                  <h3 style={{ margin: 0, fontSize: 14, fontWeight: 700, color: "var(--t)" }}>Seleccionar Animación</h3>
                  <span style={{ fontSize: 10, color: "var(--t3)", marginLeft: "auto" }}>{animations.length} disponibles</span>
                </div>

                <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginBottom: 12 }}>
                  {ANIM_CATS.map(cat => (
                    <button key={cat} onClick={() => setAnimCat(cat)} style={{ padding: "4px 10px", borderRadius: 20, border: `1px solid ${animCat === cat ? "#3b80e4" : "var(--ink4)"}`, background: animCat === cat ? "rgba(59,128,228,0.15)" : "transparent", color: animCat === cat ? "#3b80e4" : "var(--t3)", fontSize: 11, cursor: "pointer" }}>
                      {ANIM_CAT_META[cat].icon} {ANIM_CAT_META[cat].label}
                    </button>
                  ))}
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(130px, 1fr))", gap: 5, maxHeight: 200, overflowY: "auto", paddingRight: 4, marginBottom: 12 }}>
                  {filteredAnims.map(a => (
                    <button key={a.id} onClick={() => setSelectedAnim(a.id)} style={{ padding: "7px 10px", borderRadius: 8, border: `1px solid ${selectedAnim === a.id ? "#3b80e4" : "var(--ink4)"}`, background: selectedAnim === a.id ? "rgba(59,128,228,0.15)" : "var(--ink3)", color: selectedAnim === a.id ? "#3b80e4" : "var(--t)", fontSize: 11, cursor: "pointer", textAlign: "left", fontWeight: selectedAnim === a.id ? 700 : 400 }}>
                      {a.label}
                    </button>
                  ))}
                  {filteredAnims.length === 0 && <div style={{ fontSize: 11, color: "var(--t3)", gridColumn: "1/-1", padding: 10 }}>Sin animaciones en esta categoría</div>}
                </div>

                <div style={{ display: "flex", gap: 8 }}>
                  <select value={animOutFormat} onChange={e => setAnimOutFormat(e.target.value as any)} style={{ ...inputSt, width: "auto", padding: "9px 12px", flex: "0 0 auto" }}>
                    {["glb","fbx","mp4"].map(f => <option key={f} value={f}>{f.toUpperCase()}</option>)}
                  </select>
                  <button onClick={runRetarget} disabled={!selectedAnim || !rigTaskId.trim() || (animStatus === "running" && !!riggedTaskId)} style={{ ...btnPri, flex: 1, opacity: !selectedAnim ? 0.5 : 1 }}>
                    {animStatus === "running" && !!riggedTaskId ? <><Loader2 size={14} style={{ animation: "spin 0.8s linear infinite" }} /> Animando…</> : <><Play size={14} /> Aplicar "{selectedAnim || "—"}"</>}
                  </button>
                </div>

                {animStatus !== "idle" && riggedTaskId && (
                  <div style={{ marginTop: 10 }}>
                    {animStatus === "running" && <ProgressBar value={animProgress} />}
                    <div style={{ marginTop: 6, fontSize: 12, color: animStatus === "error" ? "#f87171" : animStatus === "done" ? "#4af0c8" : "var(--t)", fontWeight: 600 }}>
                      {animStatus === "error" ? animError : animLog}
                    </div>
                  </div>
                )}
                {animResult && <div style={{ marginTop: 12 }}><ModelViewer url={animResult.output?.model || animResult.animation} previewImg={animResult.output?.rendered_image} /></div>}
              </div>
            </div>
          )}

          {/* ── STYLIZE TAB ───────────────────────────────────────────────── */}
          {tab === "stylize" && (
            <div style={cardSt}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
                <Sparkles size={16} color="#3b80e4" />
                <h3 style={{ margin: 0, fontSize: 14, fontWeight: 700, color: "var(--t)" }}>Estilizar Modelo 3D</h3>
              </div>

              <TaskIdInput value={stylizeTaskId} onChange={setStylizeTaskId} />

              <div style={{ marginTop: 14 }}>
                <label style={{ fontSize: 11, color: "var(--t3)", display: "block", marginBottom: 10 }}>Estilo artístico</label>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                  {STYLIZE_PRESETS.map(p => (
                    <button key={p.id} onClick={() => setStylizePreset(p.id)} style={{ padding: "14px 16px", borderRadius: 10, border: `2px solid ${stylizePreset === p.id ? "#3b80e4" : "var(--ink4)"}`, background: stylizePreset === p.id ? "rgba(59,128,228,0.12)" : "var(--ink3)", cursor: "pointer", textAlign: "left" }}>
                      <div style={{ fontSize: 22, marginBottom: 4 }}>{p.icon}</div>
                      <div style={{ fontWeight: 700, fontSize: 13, color: stylizePreset === p.id ? "#3b80e4" : "var(--t)" }}>{p.label}</div>
                      <div style={{ fontSize: 11, color: "var(--t3)" }}>{p.desc}</div>
                    </button>
                  ))}
                </div>
              </div>

              <button onClick={runStylize} disabled={!stylizeTaskId.trim() || stylizeStatus === "running"} style={{ ...btnPri, width: "100%", marginTop: 14, opacity: !stylizeTaskId.trim() ? 0.5 : 1 }}>
                {stylizeStatus === "running" ? <><Loader2 size={14} style={{ animation: "spin 0.8s linear infinite" }} /> Estilizando…</> : <><Palette size={14} /> Aplicar estilo {STYLIZE_PRESETS.find(p => p.id === stylizePreset)?.label}</>}
              </button>

              {stylizeStatus !== "idle" && (
                <div style={{ marginTop: 10 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: stylizeStatus === "error" ? "#f87171" : stylizeStatus === "done" ? "#4af0c8" : "var(--t)", fontWeight: 600, marginBottom: stylizeStatus === "running" ? 8 : 0 }}>
                    {stylizeStatus === "running" && <Loader2 size={13} style={{ animation: "spin 0.8s linear infinite" }} />}
                    {stylizeStatus === "done" && <CheckCircle2 size={13} color="#4af0c8" />}
                    {stylizeStatus === "error" && <AlertCircle size={13} color="#f87171" />}
                    {stylizeStatus === "error" ? stylizeError : stylizeLog}
                  </div>
                  {stylizeStatus === "running" && <ProgressBar value={stylizeProgress} />}
                </div>
              )}
              {stylizeResult && <div style={{ marginTop: 12 }}><ModelViewer url={stylizeResult.output?.model || stylizeResult.output?.pbr_model} previewImg={stylizeResult.output?.rendered_image} /></div>}
            </div>
          )}

          {/* ── GALLERY TAB ───────────────────────────────────────────────── */}
          {tab === "gallery" && (
            <div style={cardSt}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
                <FolderOpen size={16} color="#3b80e4" />
                <h3 style={{ margin: 0, fontSize: 14, fontWeight: 700, color: "var(--t)" }}>Modelos de esta sesión</h3>
                <span style={{ marginLeft: "auto", fontSize: 12, color: "var(--t3)" }}>{gallery.length} modelo{gallery.length !== 1 ? "s" : ""}</span>
              </div>
              {gallery.length === 0 ? (
                <div style={{ textAlign: "center", padding: "40px 20px", color: "var(--t3)" }}>
                  <Box size={40} style={{ opacity: 0.15, margin: "0 auto 12px" }} />
                  <div style={{ fontSize: 14 }}>Todavía no has generado modelos</div>
                  <div style={{ fontSize: 12, marginTop: 4 }}>Usa las otras pestañas para crear modelos 3D</div>
                </div>
              ) : (
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(170px, 1fr))", gap: 10 }}>
                  {gallery.map((r, i) => {
                    const thumb = r.output?.rendered_image;
                    const url = r.output?.model || r.output?.pbr_model || r.output?.base_model;
                    return (
                      <div key={i} style={{ background: "var(--ink3)", border: "1px solid var(--ink4)", borderRadius: 10, overflow: "hidden" }}>
                        {thumb ? <img src={thumb} alt="" style={{ width: "100%", height: 110, objectFit: "cover" }} /> : <div style={{ height: 110, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 34 }}>🧊</div>}
                        <div style={{ padding: "8px 10px" }}>
                          {r.label && <div style={{ fontSize: 10, fontWeight: 700, color: "#3b80e4", marginBottom: 3 }}>{r.label}</div>}
                          <div style={{ fontSize: 9, color: "var(--t3)", fontFamily: "monospace", marginBottom: 6, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.task_id?.slice(0, 18)}…</div>
                          <div style={{ display: "flex", gap: 5 }}>
                            {url && <a href={url} download style={{ flex: 1, fontSize: 10, color: "#3b80e4", textDecoration: "none", display: "flex", alignItems: "center", gap: 3 }}><Download size={10} /> Descargar</a>}
                            <button onClick={() => navigator.clipboard.writeText(r.task_id)} style={{ fontSize: 9, background: "var(--ink4)", border: "none", borderRadius: 5, padding: "3px 7px", color: "var(--t3)", cursor: "pointer" }}>ID</button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

        </div>

        {/* RIGHT: Options sidebar */}
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          {["text","image","multiview","batch"].includes(tab) && <OptionsPanel />}

          {/* Capabilities */}
          <div style={{ ...cardSt, padding: "14px 16px" }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: "var(--t3)", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 10 }}>Capacidades completas</div>
            {[
              { icon: "✍️", label: "Texto → 3D",        val: "style/quality/seed" },
              { icon: "📷", label: "Imagen → 3D",        val: "directo o vía 4 vistas" },
              { icon: "🔄", label: "Multi-Vista",        val: "4 ángulos manuales/auto" },
              { icon: "⚡", label: "Lote",               val: "hasta 10 simultáneos" },
              { icon: "✨", label: "Refinar",            val: "mejora de calidad draft" },
              { icon: "🔁", label: "Convertir",          val: "GLB/FBX/OBJ/STL/USDZ" },
              { icon: "🎨", label: "Texturizar",         val: "texto → texture PBR" },
              { icon: "✂️", label: "Segmentar",          val: "partes semánticas" },
              { icon: "💃", label: "Animar",             val: `${animations.length || "134"} presets` },
              { icon: "🧱", label: "Estilizar",          val: "LEGO/Voxel/Voronoi/MC" },
            ].map(s => (
              <div key={s.label} style={{ display: "flex", justifyContent: "space-between", padding: "5px 0", borderBottom: "1px solid var(--ink3)", fontSize: 11 }}>
                <span style={{ color: "var(--t3)" }}>{s.icon} {s.label}</span>
                <span style={{ color: "var(--t)", fontWeight: 600, textAlign: "right", maxWidth: "55%" }}>{s.val}</span>
              </div>
            ))}
          </div>

          {/* Tips */}
          <div style={{ ...cardSt, padding: "14px 16px", background: "rgba(59,128,228,0.04)", borderColor: "rgba(59,128,228,0.15)" }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: "#3b80e4", marginBottom: 8 }}>💡 Tips de uso</div>
            {[
              "Prompts en inglés = mejor calidad",
              "Fondo blanco/transparente en imágenes",
              "Imagen → 4 vistas = más precisión 3D",
              "Prerig check antes de animar",
              "Segmentar → editar partes por separado",
              "Convertir a USDZ para AR en iPhone",
              "Usa el Task ID de galería para procesar",
            ].map((tip, i) => (
              <div key={i} style={{ fontSize: 11, color: "var(--t3)", marginBottom: 5, display: "flex", gap: 5 }}>
                <span style={{ color: "#3b80e4", flexShrink: 0 }}>→</span> {tip}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
