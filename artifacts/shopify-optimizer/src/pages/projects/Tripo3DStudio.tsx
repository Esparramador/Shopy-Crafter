import React, { useState, useRef, useCallback, useEffect } from "react";
import { useRoute } from "wouter";
import {
  Loader2, Upload, Box, Wand2, Image, Layers, Play, Download, RefreshCw,
  ChevronRight, CheckCircle2, AlertCircle, Zap, Info, Cpu, Grid3x3,
  Film, FolderOpen, Sparkles, RotateCcw, Eye, Package, Settings2,
  Maximize2, ArrowRight, Clock, ChevronDown,
} from "lucide-react";

const API = import.meta.env.BASE_URL?.replace(/\/$/, "") ?? "";

type Tab = "text" | "image" | "multiview" | "batch" | "animate" | "stylize" | "gallery";
type GenStatus = "idle" | "uploading" | "running" | "done" | "error";

interface TaskResult {
  task_id: string;
  output?: { model?: string; rendered_image?: string; base_model?: string; pbr_model?: string };
  animation?: string;
  out_format?: string;
  error?: string;
}

interface AnimPreset {
  id: string;
  label: string;
  category: string;
  description: string;
  looping: boolean;
  tags: string[];
}

interface BatchItem {
  file: File;
  preview: string;
  task_id?: string;
  progress: number;
  status: "pending" | "uploading" | "running" | "done" | "error";
  output?: TaskResult["output"];
  error?: string;
}

const MODEL_VERSIONS = [
  { value: "default",         label: "Última (recomendado)", badge: "⚡" },
  { value: "v2.5-20250123",  label: "v2.5 — Alta fidelidad", badge: "🏆" },
  { value: "v2.0-20240919",  label: "v2.0 — Estable",        badge: "🛡️" },
  { value: "v1.4-20240625",  label: "v1.4 — Ultra rápido",   badge: "🚀" },
];

const STYLIZE_PRESETS = [
  { id: "lego",      label: "LEGO",      icon: "🧱", desc: "Estilo bloques LEGO" },
  { id: "voxel",     label: "Voxel",     icon: "🎮", desc: "Arte pixel 3D" },
  { id: "voronoi",   label: "Voronoi",   icon: "💎", desc: "Fracturas orgánicas" },
  { id: "minecraft", label: "Minecraft", icon: "⛏️", desc: "Bloques pixel" },
];

const ANIM_CATS = ["locomotion", "idle", "gesture", "dance", "emote", "combat", "sit", "activity"] as const;
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

const PROMPT_SUGGESTIONS = [
  "a cute low-poly cartoon fox with fluffy tail, game-ready style",
  "a futuristic sci-fi robot with glowing blue accents, metallic surface",
  "a medieval wooden treasure chest with golden lock and worn leather straps",
  "a magical crystal potion bottle with swirling purple liquid inside",
  "a detailed sneaker shoe with white and red colorway, photorealistic",
  "a minimalist modern armchair, light grey fabric, scandinavian design",
  "a powerful dragon head with sharp scales and fiery eyes",
  "a beautiful orchid flower with detailed petals, botanical style",
];

// ── Shared style helpers ────────────────────────────────────────────────────
const card: React.CSSProperties = {
  background: "var(--ink2,#0e0e1a)", border: "1px solid var(--ink3,#1c1c2e)",
  borderRadius: 14, padding: "20px 22px",
};

const inputSt: React.CSSProperties = {
  width: "100%", padding: "10px 14px", borderRadius: 9,
  background: "var(--ink3,#1c1c2e)", border: "1px solid var(--ink4,#2a2a40)",
  color: "var(--t,#fff)", fontSize: 13, fontFamily: "inherit", boxSizing: "border-box",
};

const btnPrimary: React.CSSProperties = {
  padding: "11px 20px", borderRadius: 10, border: "none",
  background: "linear-gradient(135deg,#3b80e4,#1a56c8)", color: "#fff",
  fontWeight: 700, fontSize: 13, cursor: "pointer", display: "flex",
  alignItems: "center", justifyContent: "center", gap: 7,
  boxShadow: "0 4px 14px rgba(59,128,228,0.35)",
};

const btnSecondary: React.CSSProperties = {
  padding: "9px 16px", borderRadius: 9, background: "var(--ink3,#1c1c2e)",
  border: "1px solid var(--ink4,#2a2a40)", color: "var(--t3,#888)",
  fontSize: 12, cursor: "pointer", display: "flex", alignItems: "center", gap: 6,
};

// ── Progress bar ────────────────────────────────────────────────────────────
function ProgressBar({ value, label }: { value: number; label?: string }) {
  return (
    <div>
      {label && <div style={{ fontSize: 11, color: "var(--t3)", marginBottom: 5 }}>{label}</div>}
      <div style={{ height: 6, borderRadius: 3, background: "var(--ink3,#1c1c2e)", overflow: "hidden" }}>
        <div style={{ height: "100%", width: `${value}%`, background: "linear-gradient(90deg,#3b80e4,#4af0c8)", borderRadius: 3, transition: "width 0.4s ease" }} />
      </div>
      <div style={{ textAlign: "right", fontSize: 11, color: "#3b80e4", marginTop: 3, fontWeight: 700 }}>{value}%</div>
    </div>
  );
}

// ── 3D Model Viewer ─────────────────────────────────────────────────────────
function ModelViewer({ url, previewImg }: { url?: string; previewImg?: string }) {
  const [mode, setMode] = useState<"3d" | "img">(url ? "3d" : "img");
  if (!url && !previewImg) return null;

  return (
    <div style={{ ...card, padding: 0, overflow: "hidden" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 16px", borderBottom: "1px solid var(--ink3)" }}>
        <span style={{ fontWeight: 700, fontSize: 13, color: "var(--t)" }}>👁️ Vista previa del modelo</span>
        <div style={{ display: "flex", gap: 4 }}>
          {url && <button onClick={() => setMode("3d")} style={{ ...btnSecondary, padding: "4px 10px", background: mode === "3d" ? "#3b80e420" : "transparent", color: mode === "3d" ? "#3b80e4" : "var(--t3)", border: mode === "3d" ? "1px solid #3b80e430" : "1px solid transparent" }}>🎯 3D</button>}
          {previewImg && <button onClick={() => setMode("img")} style={{ ...btnSecondary, padding: "4px 10px", background: mode === "img" ? "#3b80e420" : "transparent", color: mode === "img" ? "#3b80e4" : "var(--t3)", border: mode === "img" ? "1px solid #3b80e430" : "1px solid transparent" }}>🖼️ Render</button>}
        </div>
      </div>
      <div style={{ padding: 16 }}>
        {mode === "3d" && url ? (
          <model-viewer
            src={url}
            auto-rotate
            camera-controls
            style={{ width: "100%", height: 320, borderRadius: 10, background: "var(--ink3)" } as any}
          />
        ) : previewImg ? (
          <img src={previewImg} alt="render" style={{ width: "100%", maxHeight: 320, objectFit: "contain", borderRadius: 10 }} />
        ) : null}
        <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
          {url && (
            <a href={url} download style={{ ...btnPrimary, flex: 1, textDecoration: "none", fontSize: 12 }}>
              <Download size={14} /> Descargar GLB
            </a>
          )}
          {previewImg && (
            <a href={previewImg} download style={{ ...btnSecondary, textDecoration: "none", fontSize: 12 }}>
              <Image size={13} /> PNG
            </a>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Result card ─────────────────────────────────────────────────────────────
function ResultCard({ result, onSaveToGallery }: { result: TaskResult; onSaveToGallery?: () => void }) {
  const modelUrl = result.output?.model || result.output?.pbr_model;
  const previewImg = result.output?.rendered_image;
  if (!modelUrl && !previewImg) return null;

  return (
    <div style={{ ...card, border: "1px solid rgba(74,240,200,0.25)" }}>
      <div style={{ display: "flex", align: "center", gap: 8, marginBottom: 12 }}>
        <CheckCircle2 size={16} color="#4af0c8" />
        <span style={{ fontWeight: 700, color: "#4af0c8", fontSize: 14 }}>¡Modelo 3D generado!</span>
        <span style={{ marginLeft: "auto", fontSize: 11, color: "var(--t3)" }}>ID: {result.task_id?.slice(0, 12)}…</span>
      </div>
      <ModelViewer url={modelUrl} previewImg={previewImg} />
    </div>
  );
}

// ── Status log ──────────────────────────────────────────────────────────────
function StatusLog({ status, progress, log, error }: { status: GenStatus; progress: number; log: string; error: string }) {
  if (status === "idle") return null;
  const isRunning = status === "uploading" || status === "running";
  return (
    <div style={{ ...card, borderColor: status === "error" ? "rgba(248,113,113,0.3)" : status === "done" ? "rgba(74,240,200,0.25)" : "rgba(59,128,228,0.25)", padding: "14px 16px" }}>
      <div style={{ display: "flex", align: "center", gap: 8, marginBottom: isRunning ? 10 : 0 }}>
        {isRunning && <Loader2 size={15} style={{ animation: "spin 0.8s linear infinite", color: "#3b80e4" }} />}
        {status === "done" && <CheckCircle2 size={15} color="#4af0c8" />}
        {status === "error" && <AlertCircle size={15} color="#f87171" />}
        <span style={{ fontSize: 13, color: status === "error" ? "#f87171" : status === "done" ? "#4af0c8" : "var(--t)", fontWeight: 600 }}>
          {status === "error" ? error : log}
        </span>
      </div>
      {isRunning && <ProgressBar value={progress} />}
    </div>
  );
}

// ── Drop zone ───────────────────────────────────────────────────────────────
function DropZone({ preview, label, subLabel, onFile, accept = "image/*" }: { preview?: string; label: string; subLabel?: string; onFile: (f: File) => void; accept?: string }) {
  const ref = useRef<HTMLInputElement>(null);
  const [drag, setDrag] = useState(false);
  return (
    <div
      onClick={() => ref.current?.click()}
      onDragOver={e => { e.preventDefault(); setDrag(true); }}
      onDragLeave={() => setDrag(false)}
      onDrop={e => { e.preventDefault(); setDrag(false); const f = e.dataTransfer.files[0]; if (f) onFile(f); }}
      style={{
        border: `2px dashed ${drag ? "#3b80e4" : "rgba(59,128,228,0.3)"}`, borderRadius: 12,
        padding: preview ? 12 : 28, textAlign: "center", cursor: "pointer",
        background: drag ? "rgba(59,128,228,0.06)" : "rgba(59,128,228,0.02)",
        transition: "all 0.2s",
      }}
    >
      {preview
        ? <img src={preview} alt="" style={{ maxHeight: 140, maxWidth: "100%", borderRadius: 8, objectFit: "contain" }} />
        : <>
            <Upload size={26} style={{ color: "#3b80e4", margin: "0 auto 10px" }} />
            <div style={{ fontWeight: 600, fontSize: 13, color: "var(--t)", marginBottom: 4 }}>{label}</div>
            {subLabel && <div style={{ fontSize: 11, color: "var(--t3)" }}>{subLabel}</div>}
          </>
      }
      <input ref={ref} type="file" accept={accept} className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) onFile(f); }} />
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════════
export default function Tripo3DStudio() {
  const [, params] = useRoute("/projects/:id/*");
  const projectId = params?.id;

  const [tab, setTab] = useState<Tab>("text");
  const [status, setStatus] = useState<GenStatus>("idle");
  const [progress, setProgress] = useState(0);
  const [log, setLog] = useState("");
  const [result, setResult] = useState<TaskResult | null>(null);
  const [error, setError] = useState("");

  // Shared model options
  const [modelVersion, setModelVersion] = useState("default");
  const [withTexture, setWithTexture] = useState(true);
  const [withPbr, setWithPbr] = useState(true);

  // Text-to-3D
  const [prompt, setPrompt] = useState("");
  const [negPrompt, setNegPrompt] = useState("");
  const [showSuggestions, setShowSuggestions] = useState(false);

  // Image-to-3D
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState("");

  // Multi-view
  const [views, setViews] = useState<{ front?: File; left?: File; back?: File; right?: File }>({});
  const [viewPreviews, setViewPreviews] = useState<Record<string, string>>({});
  const [mvAutoPrompt, setMvAutoPrompt] = useState("");
  const [mvAutoGenerating, setMvAutoGenerating] = useState(false);
  const [mvAutoError, setMvAutoError] = useState("");

  // Batch
  const [batchFiles, setBatchFiles] = useState<BatchItem[]>([]);
  const batchRef = useRef<HTMLInputElement>(null);

  // Animate
  const [animations, setAnimations] = useState<AnimPreset[]>([]);
  const [animCat, setAnimCat] = useState("locomotion");
  const [selectedAnim, setSelectedAnim] = useState("");
  const [rigTaskId, setRigTaskId] = useState("");
  const [animOutFormat, setAnimOutFormat] = useState<"glb" | "fbx" | "mp4">("glb");
  const [animStatus, setAnimStatus] = useState<GenStatus>("idle");
  const [animResult, setAnimResult] = useState<TaskResult | null>(null);
  const [animLog, setAnimLog] = useState("");
  const [riggedTaskId, setRiggedTaskId] = useState("");

  // Stylize
  const [stylizeTaskId, setStylizeTaskId] = useState("");
  const [stylizePreset, setStylizePreset] = useState("lego");
  const [stylizeStatus, setStylizeStatus] = useState<GenStatus>("idle");
  const [stylizeLog, setStylizeLog] = useState("");
  const [stylizeResult, setStylizeResult] = useState<TaskResult | null>(null);

  // Gallery
  const [gallery, setGallery] = useState<TaskResult[]>([]);

  // ── Load animations ─────────────────────────────────────────────────────
  useEffect(() => {
    fetch(`${API}/api/tripo3d/animations`, { credentials: "include" })
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d?.animations) setAnimations(d.animations); })
      .catch(() => {});
  }, []);

  // Load model-viewer web component
  useEffect(() => {
    if (document.getElementById("model-viewer-script")) return;
    const s = document.createElement("script");
    s.id = "model-viewer-script";
    s.type = "module";
    s.src = "https://unpkg.com/@google/model-viewer/dist/model-viewer.min.js";
    document.head.appendChild(s);
  }, []);

  // ── SSE helper ───────────────────────────────────────────────────────────
  const streamSSE = useCallback((url: string, body: BodyInit | undefined, onEvent: (e: any) => void, ct = "application/json") => {
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

  function handleSseEvents(e: any, onDone: (r: TaskResult) => void) {
    if (e.event === "started")  { setStatus("running"); setLog(`Tarea ${e.task_id} iniciada...`); }
    if (e.event === "progress") { setProgress(e.progress ?? 0); setLog(`${e.status || "Procesando"} — ${e.progress}%`); }
    if (e.event === "done")     { setStatus("done"); setProgress(100); onDone(e); setLog("¡Modelo 3D listo!"); }
    if (e.event === "error")    { setStatus("error"); setError(e.error ?? "Error desconocido"); }
  }

  function reset() { setStatus("idle"); setProgress(0); setLog(""); setError(""); setResult(null); }

  // ── Generators ───────────────────────────────────────────────────────────
  const generateText = () => {
    if (!prompt.trim()) return;
    reset(); setStatus("uploading"); setLog("Enviando a Tripo3D...");
    streamSSE(`${API}/api/tripo3d/text-to-model`,
      JSON.stringify({ prompt, negative_prompt: negPrompt || undefined, model_version: modelVersion, texture: withTexture, pbr: withPbr }),
      (e) => handleSseEvents(e, r => { setResult(r); setGallery(g => [r, ...g]); }));
  };

  const generateImage = () => {
    if (!imageFile) return;
    const fd = new FormData();
    fd.append("image", imageFile);
    fd.append("model_version", modelVersion);
    fd.append("texture", String(withTexture));
    fd.append("pbr", String(withPbr));
    reset(); setStatus("uploading"); setLog("Subiendo imagen...");
    streamSSE(`${API}/api/tripo3d/image-to-model`, fd,
      (e) => handleSseEvents(e, r => { setResult(r); setGallery(g => [r, ...g]); }), "multipart");
  };

  const generateMultiview = () => {
    if (!views.front) return;
    const fd = new FormData();
    (["front", "left", "back", "right"] as const).forEach(k => views[k] && fd.append(k, views[k]!));
    fd.append("model_version", modelVersion);
    fd.append("texture", String(withTexture));
    fd.append("pbr", String(withPbr));
    reset(); setStatus("uploading"); setLog("Subiendo vistas...");
    streamSSE(`${API}/api/tripo3d/multiview-to-model`, fd,
      (e) => handleSseEvents(e, r => { setResult(r); setGallery(g => [r, ...g]); }), "multipart");
  };

  const generateBatch = () => {
    if (!batchFiles.length) return;
    const fd = new FormData();
    batchFiles.forEach(b => fd.append("images", b.file));
    fd.append("model_version", modelVersion);
    fd.append("texture", String(withTexture));
    fd.append("pbr", String(withPbr));
    setBatchFiles(prev => prev.map(b => ({ ...b, status: "uploading" as const, progress: 0 })));
    streamSSE(`${API}/api/tripo3d/batch`, fd, (e) => {
      if (e.event === "batch_started") setLog(`Lote de ${e.total} modelos iniciado...`);
      if (e.event === "task_created")  setBatchFiles(prev => prev.map((b, i) => i === e.index ? { ...b, task_id: e.task_id, status: "running" as const } : b));
      if (e.event === "progress")      setBatchFiles(prev => prev.map((b, i) => i === e.index ? { ...b, progress: e.progress ?? 0 } : b));
      if (e.event === "task_done")     { setBatchFiles(prev => prev.map((b, i) => i === e.index ? { ...b, status: "done" as const, progress: 100, output: e.output } : b)); setGallery(g => [{ task_id: e.task_id, output: e.output }, ...g]); }
      if (e.event === "task_error")    setBatchFiles(prev => prev.map((b, i) => i === e.index ? { ...b, status: "error" as const, error: e.error } : b));
      if (e.event === "batch_done")    setLog(`Lote completado: ${e.succeeded}/${e.total} exitosos`);
    }, "multipart");
  };

  const rigModel = () => {
    if (!rigTaskId.trim()) return;
    setAnimStatus("running"); setAnimLog("Aplicando rigging con skeleton IA..."); setAnimResult(null);
    streamSSE(`${API}/api/tripo3d/rig`, JSON.stringify({ original_model_task_id: rigTaskId }), (e) => {
      if (e.event === "progress") setAnimLog(`Rigging — ${e.progress}%`);
      if (e.event === "done")     { setAnimStatus("done"); setRiggedTaskId(e.task_id); setAnimResult(e); setAnimLog("✓ Rigging completado. Selecciona una animación."); }
      if (e.event === "error")    { setAnimStatus("error"); setAnimLog(`Error: ${e.error}`); }
    });
  };

  const retargetAnim = () => {
    const modelId = riggedTaskId || rigTaskId;
    if (!modelId || !selectedAnim) return;
    setAnimStatus("running"); setAnimLog(`Aplicando animación "${selectedAnim}"...`); setAnimResult(null);
    streamSSE(`${API}/api/tripo3d/retarget`, JSON.stringify({ original_model_task_id: modelId, animation: selectedAnim, out_format: animOutFormat }), (e) => {
      if (e.event === "progress") setAnimLog(`Retargeting — ${e.progress}%`);
      if (e.event === "done")     { setAnimStatus("done"); setAnimResult(e); setGallery(g => [e, ...g]); setAnimLog(`✓ Animación "${selectedAnim}" en ${animOutFormat.toUpperCase()}`); }
      if (e.event === "error")    { setAnimStatus("error"); setAnimLog(`Error: ${e.error}`); }
    });
  };

  const stylizeModel = () => {
    if (!stylizeTaskId.trim()) return;
    setStylizeStatus("running"); setStylizeLog(`Aplicando estilo ${stylizePreset}...`); setStylizeResult(null);
    streamSSE(`${API}/api/tripo3d/stylize`, JSON.stringify({ original_model_task_id: stylizeTaskId, style: stylizePreset }), (e) => {
      if (e.event === "progress") setStylizeLog(`Estilizando — ${e.progress}%`);
      if (e.event === "done")     { setStylizeStatus("done"); setStylizeResult(e); setGallery(g => [e, ...g]); setStylizeLog("✓ Estilo aplicado"); }
      if (e.event === "error")    { setStylizeStatus("error"); setStylizeLog(`Error: ${e.error}`); }
    });
  };

  const autoGenerateViews = async () => {
    if (!mvAutoPrompt.trim()) return;
    setMvAutoGenerating(true); setMvAutoError("");
    try {
      const r = await fetch(`${API}/api/tripo3d/generate-views`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        credentials: "include", body: JSON.stringify({ prompt: mvAutoPrompt.trim() }),
      });
      const d = await r.json();
      if (!r.ok) { setMvAutoError(d.error ?? "Error generando vistas"); return; }
      const { views: gen } = d as { views: Record<string, string> };
      const newPreviews: Record<string, string> = {};
      const newViews: typeof views = {};
      await Promise.all((["front", "left", "back", "right"] as const).map(async key => {
        const url = gen[key]; if (!url) return;
        newPreviews[key] = url;
        try {
          const blob = await (await fetch(url)).blob();
          const ext = blob.type.includes("png") ? "png" : "jpg";
          newViews[key] = new File([blob], `${key}.${ext}`, { type: blob.type });
        } catch { }
      }));
      setViewPreviews(p => ({ ...p, ...newPreviews }));
      setViews(v => ({ ...v, ...newViews }));
    } catch (e: any) { setMvAutoError(e.message ?? "Error"); }
    setMvAutoGenerating(false);
  };

  const handleViewFile = (k: "front" | "left" | "back" | "right", f: File) => {
    setViews(v => ({ ...v, [k]: f }));
    setViewPreviews(p => ({ ...p, [k]: URL.createObjectURL(f) }));
  };

  const filteredAnims = animations.filter(a => a.category === animCat);
  const isRunning = status === "uploading" || status === "running";

  // ── Options panel (shared) ───────────────────────────────────────────────
  const OptionsPanel = () => (
    <div style={{ ...card, padding: "16px 18px" }}>
      <div style={{ display: "flex", align: "center", gap: 6, marginBottom: 14 }}>
        <Settings2 size={14} style={{ color: "var(--t3)" }} />
        <span style={{ fontSize: 12, fontWeight: 700, color: "var(--t3)", textTransform: "uppercase", letterSpacing: 0.5 }}>Opciones del modelo</span>
      </div>
      <div style={{ marginBottom: 14 }}>
        <label style={{ fontSize: 11, color: "var(--t3)", display: "block", marginBottom: 8 }}>Versión de Tripo3D</label>
        <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
          {MODEL_VERSIONS.map(v => (
            <button key={v.value} onClick={() => setModelVersion(v.value)} style={{
              padding: "8px 12px", borderRadius: 8, border: `1px solid ${modelVersion === v.value ? "#3b80e4" : "var(--ink4)"}`,
              background: modelVersion === v.value ? "rgba(59,128,228,0.12)" : "transparent",
              color: modelVersion === v.value ? "#3b80e4" : "var(--t3)", fontSize: 12, cursor: "pointer",
              display: "flex", alignItems: "center", gap: 8, fontWeight: modelVersion === v.value ? 700 : 400,
              textAlign: "left",
            }}>
              <span>{v.badge}</span> {v.label}
            </button>
          ))}
        </div>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {[
          { val: withTexture, set: setWithTexture, label: "Textura (color maps)", desc: "Genera mapas de color UV" },
          { val: withPbr,     set: setWithPbr,     label: "PBR Materials",        desc: "Roughness, metalness, AO" },
        ].map(opt => (
          <label key={opt.label} style={{ display: "flex", alignItems: "flex-start", gap: 10, cursor: "pointer" }}>
            <div onClick={() => opt.set(!opt.val)} style={{
              width: 20, height: 20, borderRadius: 5, border: `2px solid ${opt.val ? "#3b80e4" : "var(--ink4)"}`,
              background: opt.val ? "#3b80e4" : "transparent", flexShrink: 0, marginTop: 1,
              display: "flex", alignItems: "center", justifyContent: "center",
            }}>
              {opt.val && <CheckCircle2 size={12} color="#fff" />}
            </div>
            <div>
              <div style={{ fontSize: 13, color: "var(--t)", fontWeight: 600 }}>{opt.label}</div>
              <div style={{ fontSize: 11, color: "var(--t3)" }}>{opt.desc}</div>
            </div>
          </label>
        ))}
      </div>
    </div>
  );

  const TABS: { id: Tab; icon: string; label: string; tip: string }[] = [
    { id: "text",      icon: "✍️",  label: "Texto → 3D",     tip: "Describe y genera en segundos" },
    { id: "image",     icon: "📷",  label: "Imagen → 3D",    tip: "Una foto, un modelo" },
    { id: "multiview", icon: "🔄",  label: "Multi-Vista",    tip: "4 ángulos = mayor precisión" },
    { id: "batch",     icon: "⚡",  label: "Lote",           tip: "Hasta 10 modelos en paralelo" },
    { id: "animate",   icon: "💃",  label: "Animar",         tip: "Rigging + 134 animaciones" },
    { id: "stylize",   icon: "🎨",  label: "Estilizar",      tip: "LEGO, Voxel, Voronoi…" },
    { id: "gallery",   icon: "🗄️",  label: "Galería",        tip: "Modelos generados" },
  ];

  return (
    <div style={{ minHeight: "100vh", padding: "20px 16px 40px" }}>
      {/* ── Header ─────────────────────────────────────────────────────── */}
      <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 24 }}>
        <div style={{ width: 52, height: 52, borderRadius: 16, background: "linear-gradient(135deg,#3b80e4,#1a56c8)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 26, boxShadow: "0 6px 24px rgba(59,128,228,0.4)" }}>
          🧊
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 3 }}>
            <h1 style={{ margin: 0, fontSize: 22, fontWeight: 900, color: "var(--t)" }}>Tripo 3D Studio</h1>
            <span style={{ fontSize: 10, padding: "3px 9px", borderRadius: 20, background: "rgba(59,128,228,0.15)", color: "#3b80e4", border: "1px solid rgba(59,128,228,0.3)", fontWeight: 700 }}>API v2</span>
          </div>
          <p style={{ margin: 0, fontSize: 12, color: "var(--t3)" }}>Genera, texturiza, anima y exporta modelos 3D profesionales con IA — rigging automático, 134 animaciones, lote, multi-vista</p>
        </div>
      </div>

      {/* ── Tab bar ────────────────────────────────────────────────────── */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: 5, marginBottom: 22, padding: "6px", background: "var(--ink2)", borderRadius: 14, border: "1px solid var(--ink3)" }}>
        {TABS.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)} title={t.tip} style={{
            padding: "8px 15px", borderRadius: 10, border: "none", fontSize: 12, fontWeight: tab === t.id ? 700 : 400,
            background: tab === t.id ? "linear-gradient(135deg,#3b80e4,#1a56c8)" : "transparent",
            color: tab === t.id ? "#fff" : "var(--t3)", cursor: "pointer",
            boxShadow: tab === t.id ? "0 3px 10px rgba(59,128,228,0.4)" : "none",
            display: "flex", alignItems: "center", gap: 5, whiteSpace: "nowrap",
          }}>
            <span>{t.icon}</span> {t.label}
          </button>
        ))}
      </div>

      {/* ── Main layout ─────────────────────────────────────────────────── */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 280px", gap: 16, alignItems: "start" }}>

        {/* LEFT: Tab content */}
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>

          {/* ── TEXT TO 3D ─────────────────────────────────────────── */}
          {tab === "text" && (
            <div style={card}>
              <div style={{ display: "flex", align: "center", gap: 8, marginBottom: 14 }}>
                <Wand2 size={16} color="#3b80e4" />
                <h3 style={{ margin: 0, fontSize: 14, fontWeight: 700, color: "var(--t)" }}>Texto → Modelo 3D</h3>
                <span style={{ fontSize: 10, color: "var(--t3)", marginLeft: "auto" }}>~30–90 seg</span>
              </div>

              <div style={{ position: "relative" }}>
                <textarea
                  rows={3}
                  value={prompt}
                  onChange={e => setPrompt(e.target.value)}
                  onFocus={() => setShowSuggestions(true)}
                  placeholder="Describe el objeto 3D en inglés: 'a cute low-poly robot with blue metallic body, glowing eyes, game-ready style'"
                  style={{ ...inputSt, minHeight: 90, resize: "vertical" }}
                />
                {showSuggestions && !prompt && (
                  <div style={{ position: "absolute", left: 0, right: 0, top: "calc(100% + 4px)", background: "var(--ink2)", border: "1px solid var(--ink4)", borderRadius: 10, zIndex: 10, overflow: "hidden", boxShadow: "0 8px 30px rgba(0,0,0,0.4)" }}>
                    <div style={{ padding: "8px 12px", fontSize: 10, color: "var(--t3)", borderBottom: "1px solid var(--ink4)", fontWeight: 700, textTransform: "uppercase" }}>Sugerencias de prompt</div>
                    {PROMPT_SUGGESTIONS.map((s, i) => (
                      <button key={i} onClick={() => { setPrompt(s); setShowSuggestions(false); }} style={{ width: "100%", textAlign: "left", padding: "9px 12px", background: "none", border: "none", color: "var(--t)", fontSize: 12, cursor: "pointer", borderBottom: i < PROMPT_SUGGESTIONS.length - 1 ? "1px solid var(--ink3)" : "none" }}
                        onMouseEnter={e => (e.currentTarget.style.background = "var(--ink3)")}
                        onMouseLeave={e => (e.currentTarget.style.background = "none")}>
                        💡 {s}
                      </button>
                    ))}
                  </div>
                )}
              </div>
              {showSuggestions && <div style={{ position: "fixed", inset: 0, zIndex: 9 }} onClick={() => setShowSuggestions(false)} />}

              <input
                type="text"
                placeholder="Prompt negativo (opcional): 'low quality, broken, deformed'"
                value={negPrompt}
                onChange={e => setNegPrompt(e.target.value)}
                style={{ ...inputSt, marginTop: 10 }}
              />

              <button onClick={generateText} disabled={!prompt.trim() || isRunning} style={{ ...btnPrimary, width: "100%", marginTop: 14, opacity: !prompt.trim() ? 0.5 : 1 }}>
                {isRunning ? <><Loader2 size={15} style={{ animation: "spin 0.8s linear infinite" }} /> Generando modelo…</> : <><Box size={15} /> Generar Modelo 3D</>}
              </button>
            </div>
          )}

          {/* ── IMAGE TO 3D ────────────────────────────────────────── */}
          {tab === "image" && (
            <div style={card}>
              <div style={{ display: "flex", align: "center", gap: 8, marginBottom: 14 }}>
                <Image size={16} color="#3b80e4" />
                <h3 style={{ margin: 0, fontSize: 14, fontWeight: 700, color: "var(--t)" }}>Imagen → Modelo 3D</h3>
                <span style={{ fontSize: 10, color: "var(--t3)", marginLeft: "auto" }}>Fondo limpio recomendado</span>
              </div>
              <DropZone preview={imagePreview} label="Arrastra o haz clic para subir imagen" subLabel="PNG, JPG, WEBP — fondo limpio da mejores resultados" onFile={f => { setImageFile(f); setImagePreview(URL.createObjectURL(f)); }} />
              {imagePreview && (
                <button onClick={() => { setImageFile(null); setImagePreview(""); }} style={{ ...btnSecondary, marginTop: 8, fontSize: 11 }}>
                  <RotateCcw size={11} /> Cambiar imagen
                </button>
              )}
              <button onClick={generateImage} disabled={!imageFile || isRunning} style={{ ...btnPrimary, width: "100%", marginTop: 14, opacity: !imageFile ? 0.5 : 1 }}>
                {isRunning ? <><Loader2 size={15} style={{ animation: "spin 0.8s linear infinite" }} /> Generando…</> : <><Box size={15} /> Generar desde Imagen</>}
              </button>
            </div>
          )}

          {/* ── MULTI-VIEW ─────────────────────────────────────────── */}
          {tab === "multiview" && (
            <div style={card}>
              <div style={{ display: "flex", align: "center", gap: 8, marginBottom: 14 }}>
                <Layers size={16} color="#3b80e4" />
                <h3 style={{ margin: 0, fontSize: 14, fontWeight: 700, color: "var(--t)" }}>Multi-Vista → Modelo 3D</h3>
              </div>
              <div style={{ ...card, background: "rgba(59,128,228,0.06)", borderColor: "rgba(59,128,228,0.2)", padding: "12px 14px", marginBottom: 14 }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: "#3b80e4", marginBottom: 6 }}>⚡ Generación automática de vistas con IA</div>
                <div style={{ display: "flex", gap: 8 }}>
                  <input value={mvAutoPrompt} onChange={e => setMvAutoPrompt(e.target.value)} placeholder="Describe el objeto para generar las 4 vistas automáticamente..." style={{ ...inputSt, flex: 1 }} />
                  <button onClick={autoGenerateViews} disabled={mvAutoGenerating || !mvAutoPrompt.trim()} style={{ ...btnPrimary, padding: "10px 16px", opacity: !mvAutoPrompt.trim() ? 0.5 : 1 }}>
                    {mvAutoGenerating ? <Loader2 size={14} style={{ animation: "spin 0.8s linear infinite" }} /> : <Sparkles size={14} />}
                  </button>
                </div>
                {mvAutoError && <div style={{ fontSize: 11, color: "#f87171", marginTop: 6 }}>{mvAutoError}</div>}
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                {(["front", "left", "back", "right"] as const).map(v => (
                  <div key={v}>
                    <label style={{ fontSize: 11, color: "var(--t3)", display: "block", marginBottom: 5, textTransform: "uppercase", fontWeight: 700, letterSpacing: 0.5 }}>
                      {v === "front" ? "🔵 Frente *" : v === "left" ? "🟡 Izquierda" : v === "back" ? "🟠 Atrás" : "🟢 Derecha"}
                    </label>
                    <DropZone preview={viewPreviews[v]} label={`Vista ${v}`} subLabel="Click para subir" onFile={f => handleViewFile(v, f)} />
                  </div>
                ))}
              </div>
              <button onClick={generateMultiview} disabled={!views.front || isRunning} style={{ ...btnPrimary, width: "100%", marginTop: 14, opacity: !views.front ? 0.5 : 1 }}>
                {isRunning ? <><Loader2 size={15} style={{ animation: "spin 0.8s linear infinite" }} /> Generando…</> : <><Layers size={15} /> Generar Multi-Vista 3D</>}
              </button>
            </div>
          )}

          {/* ── BATCH ──────────────────────────────────────────────── */}
          {tab === "batch" && (
            <div style={card}>
              <div style={{ display: "flex", align: "center", gap: 8, marginBottom: 14 }}>
                <Zap size={16} color="#3b80e4" />
                <h3 style={{ margin: 0, fontSize: 14, fontWeight: 700, color: "var(--t)" }}>Generación en lote</h3>
                <span style={{ fontSize: 10, color: "var(--t3)", marginLeft: "auto" }}>Máx. 10 modelos</span>
              </div>
              <div
                onClick={() => batchRef.current?.click()}
                style={{ border: "2px dashed rgba(59,128,228,0.3)", borderRadius: 10, padding: 20, textAlign: "center", cursor: "pointer" }}
              >
                <Upload size={22} style={{ color: "#3b80e4", margin: "0 auto 8px" }} />
                <div style={{ fontSize: 13, color: "var(--t)", fontWeight: 600 }}>Arrastra hasta 10 imágenes</div>
                <div style={{ fontSize: 11, color: "var(--t3)", marginTop: 4 }}>PNG, JPG, WEBP — cada imagen genera un modelo 3D</div>
              </div>
              <input ref={batchRef} type="file" accept="image/*" multiple className="hidden"
                onChange={e => {
                  if (!e.target.files) return;
                  const items: BatchItem[] = Array.from(e.target.files).slice(0, 10).map(f => ({ file: f, preview: URL.createObjectURL(f), progress: 0, status: "pending" as const }));
                  setBatchFiles(prev => [...prev, ...items].slice(0, 10));
                }} />
              {batchFiles.length > 0 && (
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(100px, 1fr))", gap: 8, marginTop: 12 }}>
                  {batchFiles.map((b, i) => (
                    <div key={i} style={{ position: "relative", borderRadius: 8, overflow: "hidden", border: `1px solid ${b.status === "done" ? "#4af0c8" : b.status === "error" ? "#f87171" : "var(--ink4)"}` }}>
                      <img src={b.preview} alt="" style={{ width: "100%", height: 80, objectFit: "cover" }} />
                      <div style={{ padding: "4px 6px", fontSize: 10, color: b.status === "done" ? "#4af0c8" : b.status === "error" ? "#f87171" : "var(--t3)", background: "var(--ink2)" }}>
                        {b.status === "done" ? "✓ Listo" : b.status === "error" ? "✗ Error" : b.status === "running" ? `${b.progress}%` : "Pendiente"}
                      </div>
                    </div>
                  ))}
                </div>
              )}
              <div style={{ display: "flex", gap: 8, marginTop: 14 }}>
                <button onClick={generateBatch} disabled={!batchFiles.length} style={{ ...btnPrimary, flex: 1, opacity: !batchFiles.length ? 0.5 : 1 }}>
                  <Zap size={15} /> Generar {batchFiles.length} modelo{batchFiles.length !== 1 ? "s" : ""}
                </button>
                {batchFiles.length > 0 && (
                  <button onClick={() => setBatchFiles([])} style={btnSecondary}>
                    <RotateCcw size={13} /> Limpiar
                  </button>
                )}
              </div>
            </div>
          )}

          {/* ── ANIMATE ────────────────────────────────────────────── */}
          {tab === "animate" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              {/* Step 1: Rig */}
              <div style={card}>
                <div style={{ display: "flex", align: "center", gap: 8, marginBottom: 14 }}>
                  <div style={{ width: 22, height: 22, borderRadius: "50%", background: riggedTaskId ? "#4af0c820" : "#3b80e420", border: `2px solid ${riggedTaskId ? "#4af0c8" : "#3b80e4"}`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 800, color: riggedTaskId ? "#4af0c8" : "#3b80e4", flexShrink: 0 }}>
                    {riggedTaskId ? "✓" : "1"}
                  </div>
                  <h3 style={{ margin: 0, fontSize: 14, fontWeight: 700, color: "var(--t)" }}>Aplicar Rigging</h3>
                </div>
                <label style={{ fontSize: 11, color: "var(--t3)", display: "block", marginBottom: 6 }}>Task ID del modelo a animar (de tu galería)</label>
                <input value={rigTaskId} onChange={e => setRigTaskId(e.target.value)} placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx" style={inputSt} />
                <button onClick={rigModel} disabled={!rigTaskId.trim() || animStatus === "running"} style={{ ...btnPrimary, width: "100%", marginTop: 12, opacity: !rigTaskId.trim() ? 0.5 : 1 }}>
                  {animStatus === "running" && !riggedTaskId ? <><Loader2 size={15} style={{ animation: "spin 0.8s linear infinite" }} /> Aplicando rigging…</> : <><Cpu size={15} /> Aplicar Skeleton + Rigging</>}
                </button>
                {animLog && (
                  <div style={{ marginTop: 10, padding: "8px 12px", borderRadius: 8, background: animStatus === "error" ? "rgba(248,113,113,0.1)" : "rgba(74,240,200,0.08)", fontSize: 12, color: animStatus === "error" ? "#f87171" : "#4af0c8" }}>
                    {animLog}
                  </div>
                )}
              </div>

              {/* Step 2: Animation */}
              <div style={{ ...card, opacity: !rigTaskId.trim() ? 0.5 : 1 }}>
                <div style={{ display: "flex", align: "center", gap: 8, marginBottom: 14 }}>
                  <div style={{ width: 22, height: 22, borderRadius: "50%", background: "#3b80e420", border: "2px solid #3b80e4", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 800, color: "#3b80e4", flexShrink: 0 }}>2</div>
                  <h3 style={{ margin: 0, fontSize: 14, fontWeight: 700, color: "var(--t)" }}>Seleccionar animación</h3>
                  <span style={{ fontSize: 10, color: "var(--t3)", marginLeft: "auto" }}>{animations.length} disponibles</span>
                </div>
                {/* Category tabs */}
                <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginBottom: 12 }}>
                  {ANIM_CATS.map(cat => (
                    <button key={cat} onClick={() => setAnimCat(cat)} style={{
                      padding: "4px 10px", borderRadius: 20, border: `1px solid ${animCat === cat ? "#3b80e4" : "var(--ink4)"}`,
                      background: animCat === cat ? "rgba(59,128,228,0.15)" : "transparent",
                      color: animCat === cat ? "#3b80e4" : "var(--t3)", fontSize: 11, cursor: "pointer",
                    }}>
                      {ANIM_CAT_META[cat].icon} {ANIM_CAT_META[cat].label}
                    </button>
                  ))}
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(130px, 1fr))", gap: 5, maxHeight: 200, overflowY: "auto", paddingRight: 4 }}>
                  {filteredAnims.map(a => (
                    <button key={a.id} onClick={() => setSelectedAnim(a.id)} style={{
                      padding: "7px 10px", borderRadius: 8, border: `1px solid ${selectedAnim === a.id ? "#3b80e4" : "var(--ink4)"}`,
                      background: selectedAnim === a.id ? "rgba(59,128,228,0.15)" : "var(--ink3)",
                      color: selectedAnim === a.id ? "#3b80e4" : "var(--t)", fontSize: 11, cursor: "pointer", textAlign: "left",
                      fontWeight: selectedAnim === a.id ? 700 : 400,
                    }}>
                      {a.label}
                    </button>
                  ))}
                  {filteredAnims.length === 0 && <div style={{ fontSize: 11, color: "var(--t3)", gridColumn: "1/-1", padding: "10px 0" }}>No hay animaciones en esta categoría</div>}
                </div>
                <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
                  <select value={animOutFormat} onChange={e => setAnimOutFormat(e.target.value as any)} style={{ ...inputSt, width: "auto", padding: "8px 12px" }}>
                    {["glb", "fbx", "mp4"].map(f => <option key={f} value={f}>{f.toUpperCase()}</option>)}
                  </select>
                  <button onClick={retargetAnim} disabled={!selectedAnim || !rigTaskId.trim() || animStatus === "running"} style={{ ...btnPrimary, flex: 1, opacity: !selectedAnim ? 0.5 : 1 }}>
                    {animStatus === "running" && riggedTaskId ? <><Loader2 size={15} style={{ animation: "spin 0.8s linear infinite" }} /> Animando…</> : <><Play size={15} /> Aplicar animación</>}
                  </button>
                </div>
              </div>

              {animResult && <ResultCard result={animResult} />}
            </div>
          )}

          {/* ── STYLIZE ────────────────────────────────────────────── */}
          {tab === "stylize" && (
            <div style={card}>
              <div style={{ display: "flex", align: "center", gap: 8, marginBottom: 14 }}>
                <Sparkles size={16} color="#3b80e4" />
                <h3 style={{ margin: 0, fontSize: 14, fontWeight: 700, color: "var(--t)" }}>Estilizar modelo 3D</h3>
              </div>
              <label style={{ fontSize: 11, color: "var(--t3)", display: "block", marginBottom: 6 }}>Task ID del modelo a estilizar</label>
              <input value={stylizeTaskId} onChange={e => setStylizeTaskId(e.target.value)} placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx" style={inputSt} />
              <div style={{ marginTop: 14 }}>
                <label style={{ fontSize: 11, color: "var(--t3)", display: "block", marginBottom: 8 }}>Estilo visual</label>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 8 }}>
                  {STYLIZE_PRESETS.map(p => (
                    <button key={p.id} onClick={() => setStylizePreset(p.id)} style={{
                      padding: "14px 16px", borderRadius: 10, border: `2px solid ${stylizePreset === p.id ? "#3b80e4" : "var(--ink4)"}`,
                      background: stylizePreset === p.id ? "rgba(59,128,228,0.12)" : "var(--ink3)",
                      cursor: "pointer", textAlign: "left",
                    }}>
                      <div style={{ fontSize: 22, marginBottom: 4 }}>{p.icon}</div>
                      <div style={{ fontWeight: 700, fontSize: 13, color: stylizePreset === p.id ? "#3b80e4" : "var(--t)" }}>{p.label}</div>
                      <div style={{ fontSize: 11, color: "var(--t3)" }}>{p.desc}</div>
                    </button>
                  ))}
                </div>
              </div>
              <button onClick={stylizeModel} disabled={!stylizeTaskId.trim() || stylizeStatus === "running"} style={{ ...btnPrimary, width: "100%", marginTop: 14, opacity: !stylizeTaskId.trim() ? 0.5 : 1 }}>
                {stylizeStatus === "running" ? <><Loader2 size={15} style={{ animation: "spin 0.8s linear infinite" }} /> Estilizando…</> : <><Sparkles size={15} /> Aplicar estilo {STYLIZE_PRESETS.find(p => p.id === stylizePreset)?.label}</>}
              </button>
              {stylizeLog && (
                <div style={{ marginTop: 10, padding: "8px 12px", borderRadius: 8, background: stylizeStatus === "error" ? "rgba(248,113,113,0.1)" : "rgba(74,240,200,0.08)", fontSize: 12, color: stylizeStatus === "error" ? "#f87171" : "#4af0c8" }}>
                  {stylizeLog}
                </div>
              )}
              {stylizeResult && <div style={{ marginTop: 12 }}><ResultCard result={stylizeResult} /></div>}
            </div>
          )}

          {/* ── GALLERY ────────────────────────────────────────────── */}
          {tab === "gallery" && (
            <div style={card}>
              <div style={{ display: "flex", align: "center", gap: 8, marginBottom: 14 }}>
                <FolderOpen size={16} color="#3b80e4" />
                <h3 style={{ margin: 0, fontSize: 14, fontWeight: 700, color: "var(--t)" }}>Modelos generados</h3>
                <span style={{ marginLeft: "auto", fontSize: 12, color: "var(--t3)" }}>{gallery.length} modelo{gallery.length !== 1 ? "s" : ""}</span>
              </div>
              {gallery.length === 0 ? (
                <div style={{ textAlign: "center", padding: "40px 20px", color: "var(--t3)" }}>
                  <Box size={36} style={{ opacity: 0.2, margin: "0 auto 12px" }} />
                  <div>Todavía no has generado ningún modelo en esta sesión</div>
                </div>
              ) : (
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))", gap: 10 }}>
                  {gallery.map((r, i) => {
                    const thumb = r.output?.rendered_image;
                    const url = r.output?.model || r.output?.pbr_model;
                    return (
                      <div key={i} style={{ background: "var(--ink3)", border: "1px solid var(--ink4)", borderRadius: 10, overflow: "hidden" }}>
                        {thumb ? <img src={thumb} alt="" style={{ width: "100%", height: 120, objectFit: "cover" }} /> : <div style={{ height: 120, display: "flex", alignItems: "center", justifyContent: "center", color: "var(--t3)", fontSize: 32 }}>🧊</div>}
                        <div style={{ padding: "8px 10px" }}>
                          <div style={{ fontSize: 10, color: "var(--t3)", fontFamily: "monospace", marginBottom: 6, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                            {r.task_id?.slice(0, 16)}…
                          </div>
                          {url && (
                            <a href={url} download style={{ fontSize: 11, color: "#3b80e4", textDecoration: "none", display: "flex", alignItems: "center", gap: 4 }}>
                              <Download size={11} /> Descargar
                            </a>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* Status log (all tabs except animate/stylize/gallery) */}
          {!["animate", "stylize", "gallery"].includes(tab) && (
            <StatusLog status={status} progress={progress} log={log} error={error} />
          )}

          {/* Result viewer */}
          {result && !["animate", "stylize", "gallery"].includes(tab) && (
            <ResultCard result={result} />
          )}
        </div>

        {/* RIGHT: Options sidebar */}
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          {!["animate", "stylize", "gallery"].includes(tab) && <OptionsPanel />}

          {/* Quick stats */}
          <div style={{ ...card, padding: "14px 16px" }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: "var(--t3)", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 10 }}>Capacidades</div>
            {[
              { icon: "🎨", label: "Texturas PBR", val: "Automáticas" },
              { icon: "💃", label: "Animaciones", val: `${animations.length || "134"}` },
              { icon: "📦", label: "Formatos export", val: "GLB, FBX, OBJ, STL, MP4" },
              { icon: "⚡", label: "Generación batch", val: "Hasta 10 modelos" },
              { icon: "🔄", label: "Multi-vista", val: "4 ángulos → 3D" },
              { icon: "🎮", label: "Estilización", val: "LEGO, Voxel, +2" },
            ].map(s => (
              <div key={s.label} style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", borderBottom: "1px solid var(--ink3)", fontSize: 12 }}>
                <span style={{ color: "var(--t3)" }}>{s.icon} {s.label}</span>
                <span style={{ color: "var(--t)", fontWeight: 600, textAlign: "right", maxWidth: "55%", fontSize: 11 }}>{s.val}</span>
              </div>
            ))}
          </div>

          {/* Tips */}
          <div style={{ ...card, padding: "14px 16px", background: "rgba(59,128,228,0.05)", borderColor: "rgba(59,128,228,0.2)" }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: "#3b80e4", marginBottom: 8 }}>💡 Tips para mejores resultados</div>
            {[
              "Usa prompts en inglés para mejor calidad",
              "Fondo blanco o transparente en imágenes",
              "Activa PBR para materiales más realistas",
              "Multi-vista da más precisión que una sola foto",
              "v2.5 es más detallada pero tarda más",
            ].map((tip, i) => (
              <div key={i} style={{ fontSize: 11, color: "var(--t3)", marginBottom: 5, display: "flex", gap: 6 }}>
                <span style={{ color: "#3b80e4", flexShrink: 0 }}>→</span> {tip}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
