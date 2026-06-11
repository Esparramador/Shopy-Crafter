import { useState, useRef, useCallback, useEffect } from "react";
import { useRoute } from "wouter";
import { Loader2, Upload, Box, Wand2, Image, Layers, Play, Download, RefreshCw, ChevronRight, CheckCircle2, AlertCircle, Zap, Info } from "lucide-react";

const API = import.meta.env.BASE_URL?.replace(/\/$/, "") ?? "";

type Tab = "text" | "image" | "multiview" | "batch" | "animate" | "gallery";
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
  { value: "default", label: "Última (recomendado)" },
  { value: "v2.5-20250123", label: "v2.5 — Alta fidelidad" },
  { value: "v2.0-20240919", label: "v2.0 — Estable" },
  { value: "v1.4-20240625", label: "v1.4 — Rápido" },
];

const STYLIZE_PRESETS = [
  { id: "lego", label: "LEGO" },
  { id: "voxel", label: "Voxel" },
  { id: "voronoi", label: "Voronoi" },
  { id: "minecraft", label: "Minecraft" },
];

const ANIM_TABS = ["locomotion", "idle", "gesture", "dance", "emote", "combat", "sit", "activity"] as const;
const ANIM_TAB_LABELS: Record<string, string> = {
  locomotion: "🚶 Locomoción",
  idle: "🧍 Reposo",
  gesture: "👋 Gestos",
  dance: "💃 Baile",
  emote: "😄 Emociones",
  combat: "⚔️ Combate",
  sit: "🪑 Sentarse",
  activity: "💻 Actividad",
};

export default function Tripo3DStudio() {
  const [, params] = useRoute("/projects/:id/*");
  const projectId = params?.id;

  const [tab, setTab] = useState<Tab>("text");
  const [status, setStatus] = useState<GenStatus>("idle");
  const [progress, setProgress] = useState(0);
  const [log, setLog] = useState<string>("");
  const [result, setResult] = useState<TaskResult | null>(null);
  const [error, setError] = useState("");

  // Text-to-3D
  const [prompt, setPrompt] = useState("");
  const [negPrompt, setNegPrompt] = useState("");
  const [modelVersion, setModelVersion] = useState("default");
  const [withTexture, setWithTexture] = useState(true);
  const [withPbr, setWithPbr] = useState(true);

  // Image-to-3D
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState("");
  const imageRef = useRef<HTMLInputElement>(null);

  // Multi-view
  const [views, setViews] = useState<{ front?: File; left?: File; back?: File; right?: File }>({});
  const [viewPreviews, setViewPreviews] = useState<Record<string, string>>({});

  // Batch
  const [batchFiles, setBatchFiles] = useState<BatchItem[]>([]);
  const batchRef = useRef<HTMLInputElement>(null);

  // Animate
  const [animations, setAnimations] = useState<AnimPreset[]>([]);
  const [animCat, setAnimCat] = useState<string>("locomotion");
  const [selectedAnim, setSelectedAnim] = useState("");
  const [rigTaskId, setRigTaskId] = useState("");
  const [animOutFormat, setAnimOutFormat] = useState<"glb" | "fbx" | "mp4">("glb");
  const [animStatus, setAnimStatus] = useState<GenStatus>("idle");
  const [animResult, setAnimResult] = useState<TaskResult | null>(null);
  const [animLog, setAnimLog] = useState("");
  const [riggedTaskId, setRiggedTaskId] = useState("");

  // Gallery
  const [gallery, setGallery] = useState<TaskResult[]>([]);

  // ── Load animations ────────────────────────────────────────────────────────
  useEffect(() => {
    fetch(`${API}/api/tripo3d/animations`, { credentials: "include" })
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d?.animations) setAnimations(d.animations); })
      .catch(() => {});
  }, []);

  // ── SSE helper ─────────────────────────────────────────────────────────────
  const streamSSE = useCallback((url: string, body: BodyInit | undefined, onEvent: (e: any) => void, contentType = "application/json") => {
    fetch(url, {
      method: "POST",
      credentials: "include",
      headers: contentType === "application/json" ? { "Content-Type": "application/json" } : undefined,
      body,
    }).then(async res => {
      if (!res.ok) {
        const txt = await res.text();
        onEvent({ event: "error", error: txt.slice(0, 200) });
        return;
      }
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

  // ── Text-to-3D ─────────────────────────────────────────────────────────────
  const generateText = () => {
    if (!prompt.trim()) return;
    setStatus("uploading"); setProgress(0); setLog("Enviando a Tripo3D..."); setError(""); setResult(null);
    streamSSE(`${API}/api/tripo3d/text-to-model`, JSON.stringify({ prompt, negative_prompt: negPrompt || undefined, model_version: modelVersion, texture: withTexture, pbr: withPbr }), (e) => {
      if (e.event === "started") { setStatus("running"); setLog(`Tarea ${e.task_id} iniciada`); }
      if (e.event === "progress") { setProgress(e.progress ?? 0); setLog(`${e.status} — ${e.progress}%`); }
      if (e.event === "done") { setStatus("done"); setProgress(100); setResult(e); setGallery(g => [e, ...g]); setLog("¡Modelo 3D generado!"); }
      if (e.event === "error") { setStatus("error"); setError(e.error ?? "Error desconocido"); }
    });
  };

  // ── Image-to-3D ────────────────────────────────────────────────────────────
  const generateImage = () => {
    if (!imageFile) return;
    const fd = new FormData();
    fd.append("image", imageFile);
    fd.append("model_version", modelVersion);
    fd.append("texture", String(withTexture));
    fd.append("pbr", String(withPbr));
    setStatus("uploading"); setProgress(0); setLog("Subiendo imagen..."); setError(""); setResult(null);
    streamSSE(`${API}/api/tripo3d/image-to-model`, fd, (e) => {
      if (e.event === "started") { setStatus("running"); setLog(`Tarea ${e.task_id} iniciada`); }
      if (e.event === "progress") { setProgress(e.progress ?? 0); setLog(`${e.status} — ${e.progress}%`); }
      if (e.event === "done") { setStatus("done"); setProgress(100); setResult(e); setGallery(g => [e, ...g]); setLog("¡Modelo 3D generado!"); }
      if (e.event === "error") { setStatus("error"); setError(e.error ?? "Error desconocido"); }
    }, "multipart");
  };

  // ── Multi-view ─────────────────────────────────────────────────────────────
  const generateMultiview = () => {
    if (!views.front) return;
    const fd = new FormData();
    if (views.front)  fd.append("front",  views.front);
    if (views.left)   fd.append("left",   views.left);
    if (views.back)   fd.append("back",   views.back);
    if (views.right)  fd.append("right",  views.right);
    fd.append("model_version", modelVersion);
    fd.append("texture", String(withTexture));
    fd.append("pbr", String(withPbr));
    setStatus("uploading"); setProgress(0); setLog("Subiendo vistas..."); setError(""); setResult(null);
    streamSSE(`${API}/api/tripo3d/multiview-to-model`, fd, (e) => {
      if (e.event === "started") { setStatus("running"); setLog(`Tarea ${e.task_id} iniciada`); }
      if (e.event === "progress") { setProgress(e.progress ?? 0); setLog(`${e.status} — ${e.progress}%`); }
      if (e.event === "done") { setStatus("done"); setProgress(100); setResult(e); setGallery(g => [e, ...g]); setLog("¡Modelo 3D generado desde múltiples vistas!"); }
      if (e.event === "error") { setStatus("error"); setError(e.error ?? "Error desconocido"); }
    }, "multipart");
  };

  // ── Batch ──────────────────────────────────────────────────────────────────
  const generateBatch = () => {
    if (batchFiles.length === 0) return;
    const fd = new FormData();
    batchFiles.forEach(b => fd.append("images", b.file));
    fd.append("model_version", modelVersion);
    fd.append("texture", String(withTexture));
    fd.append("pbr", String(withPbr));
    setBatchFiles(prev => prev.map(b => ({ ...b, status: "uploading" as const, progress: 0 })));
    streamSSE(`${API}/api/tripo3d/batch`, fd, (e) => {
      if (e.event === "batch_started") setLog(`Lote de ${e.total} modelos iniciado...`);
      if (e.event === "task_created") {
        setBatchFiles(prev => prev.map((b, i) => i === e.index ? { ...b, task_id: e.task_id, status: "running" as const } : b));
      }
      if (e.event === "progress") {
        setBatchFiles(prev => prev.map((b, i) => i === e.index ? { ...b, progress: e.progress ?? 0 } : b));
      }
      if (e.event === "task_done") {
        setBatchFiles(prev => prev.map((b, i) => i === e.index ? { ...b, status: "done" as const, progress: 100, output: e.output } : b));
        setGallery(g => [{ task_id: e.task_id, output: e.output }, ...g]);
      }
      if (e.event === "task_error") {
        setBatchFiles(prev => prev.map((b, i) => i === e.index ? { ...b, status: "error" as const, error: e.error } : b));
      }
      if (e.event === "batch_done") setLog(`Lote completado: ${e.succeeded}/${e.total} exitosos`);
    }, "multipart");
  };

  // ── Rig ────────────────────────────────────────────────────────────────────
  const rigModel = () => {
    if (!rigTaskId.trim()) return;
    setAnimStatus("running"); setAnimLog("Aplicando skeleton y rigging..."); setAnimResult(null);
    streamSSE(`${API}/api/tripo3d/rig`, JSON.stringify({ original_model_task_id: rigTaskId }), (e) => {
      if (e.event === "progress") setAnimLog(`Rigging — ${e.progress}%`);
      if (e.event === "done") {
        setAnimStatus("done"); setRiggedTaskId(e.task_id); setAnimResult(e); setAnimLog("¡Rigging completado! Ahora elige una animación.");
      }
      if (e.event === "error") { setAnimStatus("error"); setAnimLog(`Error: ${e.error}`); }
    });
  };

  // ── Retarget ───────────────────────────────────────────────────────────────
  const retargetAnim = () => {
    const modelId = riggedTaskId || rigTaskId;
    if (!modelId || !selectedAnim) return;
    setAnimStatus("running"); setAnimLog(`Aplicando animación "${selectedAnim}"...`); setAnimResult(null);
    streamSSE(`${API}/api/tripo3d/retarget`, JSON.stringify({ original_model_task_id: modelId, animation: selectedAnim, out_format: animOutFormat }), (e) => {
      if (e.event === "progress") setAnimLog(`Retargeting — ${e.progress}%`);
      if (e.event === "done") {
        setAnimStatus("done"); setAnimResult(e); setGallery(g => [e, ...g]); setAnimLog(`¡Animación "${selectedAnim}" aplicada en ${animOutFormat.toUpperCase()}!`);
      }
      if (e.event === "error") { setAnimStatus("error"); setAnimLog(`Error: ${e.error}`); }
    });
  };

  // ── Helpers ────────────────────────────────────────────────────────────────
  const handleViewFile = (view: "front" | "left" | "back" | "right", file: File) => {
    setViews(v => ({ ...v, [view]: file }));
    const url = URL.createObjectURL(file);
    setViewPreviews(p => ({ ...p, [view]: url }));
  };

  const handleBatchFiles = (files: FileList) => {
    const items: BatchItem[] = Array.from(files).slice(0, 10).map(f => ({
      file: f, preview: URL.createObjectURL(f), progress: 0, status: "pending" as const,
    }));
    setBatchFiles(prev => [...prev, ...items].slice(0, 10));
  };

  const modelUrl = result?.output?.model || result?.output?.pbr_model;
  const previewImg = result?.output?.rendered_image;
  const animModelUrl = animResult?.output?.model;
  const animPreviewImg = animResult?.output?.rendered_image;

  const filteredAnims = animations.filter(a => a.category === animCat);

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen p-4 md:p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-1">
        <div className="flex items-center gap-3">
          <div style={{ width: 44, height: 44, borderRadius: 12, background: "var(--sc-ai-azure-light)", border: "1px solid var(--sc-ai-azure)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22 }}>
            🧊
          </div>
          <div>
            <h1 className="font-display text-2xl font-bold text-foreground">Tripo 3D Studio</h1>
            <p className="text-sm text-muted-foreground">Genera, anima y exporta modelos 3D con IA — rigging, skeleton, multi-vista y lote</p>
          </div>
          <div className="ml-auto hidden md:flex items-center gap-2">
            <span style={{ fontSize: 11, padding: "3px 10px", borderRadius: 20, background: "var(--sc-ai-azure-light)", color: "var(--sc-ai-azure)", border: "1px solid var(--sc-ai-azure)", fontWeight: 600 }}>
              Tripo3D API v2
            </span>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex flex-wrap gap-1 p-1 rounded-xl" style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)" }}>
        {([ ["text","✍️ Texto","Texto → 3D"], ["image","📷 Imagen","Imagen → 3D"], ["multiview","🔄 Multi-Vista","4 vistas → 3D"], ["batch","⚡ Lote","Hasta 10 modelos"], ["animate","💃 Animar","Rigging + Animación"], ["gallery","🗄️ Galería","Modelos generados"] ] as [Tab,string,string][]).map(([id, icon, tip]) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            title={tip}
            style={{
              padding: "7px 14px", borderRadius: 9, border: "none", fontSize: 13, fontWeight: tab === id ? 600 : 400,
              background: tab === id ? "var(--sc-ai-azure)" : "transparent",
              color: tab === id ? "#fff" : "rgba(255,255,255,0.55)",
              cursor: "pointer", transition: "all 0.2s ease",
            }}
          >
            {icon}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        {/* LEFT: Controls */}
        <div className="lg:col-span-3 space-y-4">

          {/* ── Text to 3D ── */}
          {tab === "text" && (
            <div className="sc-form-card p-5 space-y-4">
              <div className="flex items-center gap-2 mb-1">
                <Wand2 size={16} style={{ color: "var(--sc-ai-azure)" }} />
                <h3 className="font-semibold text-sm text-foreground">Texto → Modelo 3D</h3>
              </div>
              <textarea
                rows={3}
                placeholder="Describe el objeto 3D: 'a low-poly cartoon robot with blue metallic body, round head, glowing eyes, game-ready style'"
                value={prompt}
                onChange={e => setPrompt(e.target.value)}
                className="sc-form-input text-sm resize-none"
              />
              <input
                type="text"
                placeholder="Prompt negativo (opcional): 'low quality, broken, deformed'"
                value={negPrompt}
                onChange={e => setNegPrompt(e.target.value)}
                className="sc-form-input text-sm"
              />
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-muted-foreground block mb-1">Versión del modelo</label>
                  <select value={modelVersion} onChange={e => setModelVersion(e.target.value)} className="sc-form-input text-sm" style={{ cursor: "pointer" }}>
                    {MODEL_VERSIONS.map(v => <option key={v.value} value={v.value}>{v.label}</option>)}
                  </select>
                </div>
                <div className="space-y-2 pt-4">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" checked={withTexture} onChange={e => setWithTexture(e.target.checked)} style={{ accentColor: "var(--sc-ai-azure)" }} />
                    <span className="text-sm text-foreground">Textura</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" checked={withPbr} onChange={e => setWithPbr(e.target.checked)} style={{ accentColor: "var(--sc-ai-azure)" }} />
                    <span className="text-sm text-foreground">PBR Materials</span>
                  </label>
                </div>
              </div>
              <button onClick={generateText} disabled={!prompt.trim() || status === "running" || status === "uploading"} className="sc-form-button w-full flex items-center justify-center gap-2" style={{ opacity: !prompt.trim() ? 0.5 : 1 }}>
                {status === "running" ? <><Loader2 size={15} className="animate-spin" /> Generando...</> : <><Box size={15} /> Generar Modelo 3D</>}
              </button>
            </div>
          )}

          {/* ── Image to 3D ── */}
          {tab === "image" && (
            <div className="sc-form-card p-5 space-y-4">
              <div className="flex items-center gap-2 mb-1">
                <Image size={16} style={{ color: "var(--sc-ai-azure)" }} />
                <h3 className="font-semibold text-sm text-foreground">Imagen → Modelo 3D</h3>
              </div>
              <div
                onClick={() => imageRef.current?.click()}
                style={{ border: "2px dashed rgba(59,128,228,0.35)", borderRadius: 12, padding: 20, textAlign: "center", cursor: "pointer", transition: "border-color 0.2s", background: imagePreview ? "transparent" : "rgba(59,128,228,0.04)" }}
                onMouseEnter={e => (e.currentTarget.style.borderColor = "var(--sc-ai-azure)")}
                onMouseLeave={e => (e.currentTarget.style.borderColor = "rgba(59,128,228,0.35)")}
              >
                {imagePreview
                  ? <img src={imagePreview} alt="preview" style={{ maxHeight: 160, margin: "0 auto", borderRadius: 8, objectFit: "contain" }} />
                  : <><Upload size={28} style={{ color: "var(--sc-ai-azure)", margin: "0 auto 8px" }} /><p className="text-sm text-muted-foreground">Haz clic o arrastra una imagen del objeto</p><p className="text-xs text-muted-foreground/60 mt-1">PNG, JPG, WEBP — fondo limpio recomendado</p></>
                }
              </div>
              <input ref={imageRef} type="file" accept="image/*" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) { setImageFile(f); setImagePreview(URL.createObjectURL(f)); } }} />
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-muted-foreground block mb-1">Versión del modelo</label>
                  <select value={modelVersion} onChange={e => setModelVersion(e.target.value)} className="sc-form-input text-sm">
                    {MODEL_VERSIONS.map(v => <option key={v.value} value={v.value}>{v.label}</option>)}
                  </select>
                </div>
                <div className="space-y-2 pt-4">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" checked={withTexture} onChange={e => setWithTexture(e.target.checked)} style={{ accentColor: "var(--sc-ai-azure)" }} />
                    <span className="text-sm">Textura</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" checked={withPbr} onChange={e => setWithPbr(e.target.checked)} style={{ accentColor: "var(--sc-ai-azure)" }} />
                    <span className="text-sm">PBR Materials</span>
                  </label>
                </div>
              </div>
              <button onClick={generateImage} disabled={!imageFile || status === "running"} className="sc-form-button w-full flex items-center justify-center gap-2" style={{ opacity: !imageFile ? 0.5 : 1 }}>
                {status === "running" ? <><Loader2 size={15} className="animate-spin" /> Generando...</> : <><Box size={15} /> Generar desde Imagen</>}
              </button>
            </div>
          )}

          {/* ── Multi-view ── */}
          {tab === "multiview" && (
            <div className="sc-form-card p-5 space-y-4">
              <div className="flex items-center gap-2 mb-1">
                <Layers size={16} style={{ color: "var(--sc-ai-azure)" }} />
                <h3 className="font-semibold text-sm text-foreground">Multi-Vista → Modelo 3D (4 fotos)</h3>
              </div>
              <p className="text-xs text-muted-foreground">Sube hasta 4 vistas del mismo objeto (frontal + lateral + trasera + ¾) para mayor precisión geométrica</p>
              <div className="grid grid-cols-2 gap-3">
                {(["front","left","back","right"] as const).map(v => {
                  const labels = { front: "Frontal *", left: "Lateral izq.", back: "Trasera", right: "Lateral der." };
                  const icons = { front: "⬆️", left: "⬅️", back: "⬇️", right: "➡️" };
                  return (
                    <label key={v} style={{ border: "1.5px dashed rgba(59,128,228,0.3)", borderRadius: 10, padding: "12px 8px", cursor: "pointer", textAlign: "center", display: "block", background: viewPreviews[v] ? "transparent" : "rgba(59,128,228,0.03)", transition: "border-color 0.2s" }}>
                      {viewPreviews[v]
                        ? <img src={viewPreviews[v]} alt={v} style={{ height: 64, margin: "0 auto 4px", objectFit: "contain", borderRadius: 6 }} />
                        : <div style={{ fontSize: 24, marginBottom: 4 }}>{icons[v]}</div>
                      }
                      <div className="text-xs text-muted-foreground">{labels[v]}</div>
                      <input type="file" accept="image/*" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) handleViewFile(v, f); }} />
                    </label>
                  );
                })}
              </div>
              <button onClick={generateMultiview} disabled={!views.front || status === "running"} className="sc-form-button w-full flex items-center justify-center gap-2" style={{ opacity: !views.front ? 0.5 : 1 }}>
                {status === "running" ? <><Loader2 size={15} className="animate-spin" /> Generando...</> : <><Box size={15} /> Generar 3D Multi-Vista</>}
              </button>
            </div>
          )}

          {/* ── Batch ── */}
          {tab === "batch" && (
            <div className="sc-form-card p-5 space-y-4">
              <div className="flex items-center gap-2 mb-1">
                <Zap size={16} style={{ color: "var(--sc-ai-gold)" }} />
                <h3 className="font-semibold text-sm text-foreground">PoliCreación en Lote — hasta 10 modelos</h3>
              </div>
              <p className="text-xs text-muted-foreground">Genera hasta 10 modelos 3D en paralelo desde distintas imágenes. Ideal para catálogos de productos.</p>
              <div
                onClick={() => batchRef.current?.click()}
                style={{ border: "2px dashed rgba(212,168,67,0.3)", borderRadius: 12, padding: 16, textAlign: "center", cursor: "pointer", background: "rgba(212,168,67,0.03)" }}
              >
                <Upload size={24} style={{ color: "var(--sc-ai-gold)", margin: "0 auto 6px" }} />
                <p className="text-sm text-muted-foreground">Selecciona hasta 10 imágenes</p>
                <p className="text-xs text-muted-foreground/60 mt-1">{batchFiles.length}/10 seleccionadas</p>
              </div>
              <input ref={batchRef} type="file" accept="image/*" multiple className="hidden" onChange={e => { if (e.target.files) handleBatchFiles(e.target.files); }} />
              {batchFiles.length > 0 && (
                <div className="grid grid-cols-5 gap-2">
                  {batchFiles.map((b, i) => (
                    <div key={i} style={{ position: "relative", borderRadius: 8, overflow: "hidden", border: `1.5px solid ${b.status === "done" ? "var(--sc-ai-emerald)" : b.status === "error" ? "#ff4757" : "rgba(255,255,255,0.10)"}` }}>
                      <img src={b.preview} alt="" style={{ width: "100%", aspectRatio: "1", objectFit: "cover" }} />
                      {b.status === "running" && (
                        <div style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.55)", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 4 }}>
                          <Loader2 size={14} className="animate-spin" style={{ color: "var(--sc-ai-azure)" }} />
                          <span style={{ fontSize: 10, color: "#fff" }}>{b.progress}%</span>
                        </div>
                      )}
                      {b.status === "done" && <CheckCircle2 size={14} style={{ position: "absolute", top: 4, right: 4, color: "var(--sc-ai-emerald)", background: "#000", borderRadius: "50%" }} />}
                      {b.status === "error" && <AlertCircle size={14} style={{ position: "absolute", top: 4, right: 4, color: "#ff4757" }} />}
                    </div>
                  ))}
                </div>
              )}
              <button onClick={generateBatch} disabled={batchFiles.length === 0} className="sc-form-button w-full flex items-center justify-center gap-2" style={{ opacity: batchFiles.length === 0 ? 0.5 : 1, background: "var(--sc-ai-gold)" }}>
                <Zap size={15} /> Generar Lote ({batchFiles.length})
              </button>
            </div>
          )}

          {/* ── Animate ── */}
          {tab === "animate" && (
            <div className="space-y-4">
              {/* Step 1: Rig */}
              <div className="sc-form-card p-5 space-y-3">
                <div className="flex items-center gap-2">
                  <div style={{ width: 24, height: 24, borderRadius: "50%", background: "var(--sc-ai-purple-light)", border: "1.5px solid var(--sc-ai-purple)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 700, color: "var(--sc-ai-purple)", flexShrink: 0 }}>1</div>
                  <h3 className="font-semibold text-sm text-foreground">Rigging + Skeleton Automático</h3>
                </div>
                <p className="text-xs text-muted-foreground">Pega el Task ID de un modelo generado (texto/imagen). Tripo3D creará el esqueleto y ligará los huesos automáticamente.</p>
                <input
                  type="text"
                  placeholder="Task ID del modelo 3D (ej: 6b3a1c9d-...)"
                  value={rigTaskId}
                  onChange={e => setRigTaskId(e.target.value)}
                  className="sc-form-input text-sm font-mono"
                />
                {result?.task_id && (
                  <button onClick={() => setRigTaskId(result.task_id)} className="text-xs" style={{ color: "var(--sc-ai-azure)", background: "none", border: "none", cursor: "pointer", textDecoration: "underline" }}>
                    ← Usar último generado ({result.task_id.slice(0,8)}...)
                  </button>
                )}
                <button onClick={rigModel} disabled={!rigTaskId.trim() || animStatus === "running"} className="sc-form-button w-full flex items-center justify-center gap-2" style={{ background: "var(--sc-ai-purple)", opacity: !rigTaskId.trim() ? 0.5 : 1 }}>
                  {animStatus === "running" && !riggedTaskId ? <><Loader2 size={15} className="animate-spin" /> Rigueando...</> : <><ChevronRight size={15} /> Aplicar Rigging</>}
                </button>
                {riggedTaskId && (
                  <div style={{ fontSize: 12, color: "var(--sc-ai-emerald)", display: "flex", alignItems: "center", gap: 6 }}>
                    <CheckCircle2 size={13} /> Rigging listo: <code style={{ fontFamily: "monospace" }}>{riggedTaskId.slice(0,16)}...</code>
                  </div>
                )}
              </div>

              {/* Step 2: Select animation */}
              <div className="sc-form-card p-5 space-y-3">
                <div className="flex items-center gap-2">
                  <div style={{ width: 24, height: 24, borderRadius: "50%", background: "rgba(16,185,129,0.12)", border: "1.5px solid var(--sc-ai-emerald)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 700, color: "var(--sc-ai-emerald)", flexShrink: 0 }}>2</div>
                  <h3 className="font-semibold text-sm text-foreground">Seleccionar Animación</h3>
                </div>
                {/* Category tabs */}
                <div className="flex flex-wrap gap-1">
                  {ANIM_TABS.map(cat => (
                    <button
                      key={cat}
                      onClick={() => setAnimCat(cat)}
                      style={{
                        padding: "4px 10px", borderRadius: 6, border: "none", fontSize: 11, cursor: "pointer",
                        background: animCat === cat ? "var(--sc-ai-emerald)" : "rgba(255,255,255,0.06)",
                        color: animCat === cat ? "#fff" : "rgba(255,255,255,0.5)",
                        transition: "all 0.15s",
                      }}
                    >
                      {ANIM_TAB_LABELS[cat]}
                    </button>
                  ))}
                </div>
                {/* Animation grid */}
                <div className="grid grid-cols-2 gap-2 max-h-56 overflow-y-auto pr-1">
                  {filteredAnims.map(anim => (
                    <button
                      key={anim.id}
                      onClick={() => setSelectedAnim(anim.id)}
                      style={{
                        padding: "8px 10px", borderRadius: 8, border: `1.5px solid ${selectedAnim === anim.id ? "var(--sc-ai-emerald)" : "rgba(255,255,255,0.08)"}`,
                        background: selectedAnim === anim.id ? "rgba(16,185,129,0.08)" : "rgba(255,255,255,0.03)",
                        cursor: "pointer", textAlign: "left", transition: "all 0.15s",
                      }}
                    >
                      <div style={{ fontSize: 12, fontWeight: selectedAnim === anim.id ? 600 : 400, color: selectedAnim === anim.id ? "var(--sc-ai-emerald)" : "#fff" }}>
                        {anim.label}
                      </div>
                      <div style={{ fontSize: 10, color: "rgba(255,255,255,0.4)", marginTop: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {anim.description.slice(0, 40)}...
                      </div>
                      {anim.looping && (
                        <div style={{ fontSize: 9, color: "var(--sc-ai-azure)", marginTop: 3 }}>🔄 Loop</div>
                      )}
                    </button>
                  ))}
                  {filteredAnims.length === 0 && animations.length === 0 && (
                    <div className="col-span-2 text-center text-xs text-muted-foreground py-4">
                      <Loader2 size={14} className="animate-spin mx-auto mb-2" />
                      Cargando animaciones...
                    </div>
                  )}
                </div>
                {selectedAnim && (
                  <div style={{ padding: "8px 12px", borderRadius: 8, background: "rgba(16,185,129,0.06)", border: "1px solid rgba(16,185,129,0.2)", fontSize: 12, color: "rgba(255,255,255,0.7)" }}>
                    <Info size={11} style={{ display: "inline", marginRight: 5, color: "var(--sc-ai-emerald)" }} />
                    {animations.find(a => a.id === selectedAnim)?.description}
                  </div>
                )}
                <div className="flex gap-2 items-center">
                  <label className="text-xs text-muted-foreground whitespace-nowrap">Formato:</label>
                  {(["glb","fbx","mp4"] as const).map(fmt => (
                    <button key={fmt} onClick={() => setAnimOutFormat(fmt)} style={{ padding: "3px 10px", borderRadius: 5, border: `1px solid ${animOutFormat === fmt ? "var(--sc-ai-azure)" : "rgba(255,255,255,0.1)"}`, background: animOutFormat === fmt ? "var(--sc-ai-azure-light)" : "transparent", color: animOutFormat === fmt ? "var(--sc-ai-azure)" : "rgba(255,255,255,0.5)", fontSize: 11, cursor: "pointer" }}>
                      {fmt.toUpperCase()}
                    </button>
                  ))}
                </div>
                <button onClick={retargetAnim} disabled={!selectedAnim || (!riggedTaskId && !rigTaskId) || animStatus === "running"} className="sc-form-button w-full flex items-center justify-center gap-2" style={{ background: "var(--sc-ai-emerald)", opacity: !selectedAnim ? 0.5 : 1 }}>
                  {animStatus === "running" && riggedTaskId ? <><Loader2 size={15} className="animate-spin" /> Aplicando animación...</> : <><Play size={15} /> Aplicar Animación</>}
                </button>
              </div>
            </div>
          )}

          {/* ── Gallery ── */}
          {tab === "gallery" && (
            <div className="sc-form-card p-5 space-y-4">
              <div className="flex items-center gap-2">
                <h3 className="font-semibold text-sm text-foreground">Galería de Modelos Generados ({gallery.length})</h3>
              </div>
              {gallery.length === 0
                ? <div className="text-center py-10 text-muted-foreground text-sm">Aún no has generado modelos en esta sesión</div>
                : (
                  <div className="grid grid-cols-2 gap-3">
                    {gallery.map((g, i) => (
                      <div key={i} style={{ borderRadius: 10, border: "1px solid rgba(255,255,255,0.08)", overflow: "hidden", background: "rgba(255,255,255,0.02)" }}>
                        {g.output?.rendered_image
                          ? <img src={g.output.rendered_image} alt="model" style={{ width: "100%", aspectRatio: "1", objectFit: "contain", background: "#111" }} />
                          : <div style={{ aspectRatio: "1", display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(255,255,255,0.03)", fontSize: 32 }}>🧊</div>
                        }
                        <div style={{ padding: "8px 10px" }}>
                          <div className="text-xs font-mono text-muted-foreground truncate">{g.task_id?.slice(0,16)}...</div>
                          {g.animation && <div className="text-xs" style={{ color: "var(--sc-ai-emerald)" }}>🎭 {g.animation}</div>}
                          {g.output?.model && (
                            <a href={g.output.model} target="_blank" rel="noreferrer" style={{ display: "inline-flex", alignItems: "center", gap: 4, marginTop: 6, fontSize: 11, color: "var(--sc-ai-azure)", textDecoration: "none" }}>
                              <Download size={10} /> Descargar GLB
                            </a>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )
              }
            </div>
          )}

          {/* Common options (not on animate/gallery tabs) */}
          {!["animate","gallery","batch"].includes(tab) && (
            <div className="sc-form-card p-4" style={{ background: "rgba(59,128,228,0.03)" }}>
              <div className="flex items-start gap-2">
                <Info size={13} style={{ color: "var(--sc-ai-azure)", flexShrink: 0, marginTop: 1 }} />
                <p className="text-xs text-muted-foreground">
                  Los modelos generados aparecerán en la <strong className="text-foreground">Galería</strong> y podrás aplicar <strong className="text-foreground">Rigging + Animación</strong> desde la pestaña Animar usando el Task ID devuelto.
                </p>
              </div>
            </div>
          )}
        </div>

        {/* RIGHT: Progress + Result */}
        <div className="lg:col-span-2 space-y-4">

          {/* Progress panel (text/image/multiview tabs) */}
          {!["animate","gallery"].includes(tab) && (
            <div className="sc-form-card p-4 space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Estado</h4>
                {status === "running" && <Loader2 size={13} className="animate-spin" style={{ color: "var(--sc-ai-azure)" }} />}
                {status === "done" && <CheckCircle2 size={13} style={{ color: "var(--sc-ai-emerald)" }} />}
                {status === "error" && <AlertCircle size={13} style={{ color: "#ff4757" }} />}
              </div>
              {status !== "idle" && (
                <>
                  <div style={{ height: 4, background: "rgba(255,255,255,0.06)", borderRadius: 2, overflow: "hidden" }}>
                    <div style={{ height: "100%", width: `${status === "done" ? 100 : progress}%`, background: status === "error" ? "#ff4757" : "linear-gradient(90deg, var(--sc-ai-azure), var(--sc-ai-purple))", borderRadius: 2, transition: "width 0.5s ease" }} />
                  </div>
                  <p className="text-xs text-muted-foreground">{log}</p>
                  {error && <p className="text-xs" style={{ color: "#ff4757" }}>{error}</p>}
                </>
              )}
              {status === "idle" && <p className="text-xs text-muted-foreground/50">Listo para generar</p>}

              {/* Result preview */}
              {status === "done" && result && (
                <div className="space-y-2 pt-2 border-t border-white/5">
                  {previewImg && <img src={previewImg} alt="preview" style={{ width: "100%", borderRadius: 8, objectFit: "contain", background: "#0a0a12" }} />}
                  {modelUrl && (
                    <a href={modelUrl} target="_blank" rel="noreferrer" className="sc-form-button flex items-center justify-center gap-2" style={{ textDecoration: "none", fontSize: 13, padding: "8px 14px" }}>
                      <Download size={13} /> Descargar modelo 3D
                    </a>
                  )}
                  <div style={{ fontSize: 10, color: "rgba(255,255,255,0.3)", fontFamily: "monospace", wordBreak: "break-all" }}>
                    Task ID: {result.task_id}
                  </div>
                  <button onClick={() => { setRigTaskId(result.task_id); setTab("animate"); }} style={{ fontSize: 11, color: "var(--sc-ai-purple)", background: "none", border: "none", cursor: "pointer", textDecoration: "underline" }}>
                    → Animar este modelo
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Animation result panel */}
          {tab === "animate" && (
            <div className="sc-form-card p-4 space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Animación</h4>
                {animStatus === "running" && <Loader2 size={13} className="animate-spin" style={{ color: "var(--sc-ai-emerald)" }} />}
                {animStatus === "done" && <CheckCircle2 size={13} style={{ color: "var(--sc-ai-emerald)" }} />}
              </div>
              {animLog && <p className="text-xs text-muted-foreground">{animLog}</p>}
              {animStatus === "done" && animResult && (
                <div className="space-y-2 pt-2 border-t border-white/5">
                  {animPreviewImg && <img src={animPreviewImg} alt="anim preview" style={{ width: "100%", borderRadius: 8, objectFit: "contain", background: "#0a0a12" }} />}
                  {animModelUrl && (
                    <a href={animModelUrl} target="_blank" rel="noreferrer" className="sc-form-button flex items-center justify-center gap-2" style={{ textDecoration: "none", fontSize: 13, padding: "8px 14px", background: "var(--sc-ai-emerald)" }}>
                      <Download size={13} /> Descargar {animOutFormat.toUpperCase()} Animado
                    </a>
                  )}
                  {animResult.task_id && (
                    <div style={{ fontSize: 10, color: "rgba(255,255,255,0.3)", fontFamily: "monospace" }}>Task: {animResult.task_id}</div>
                  )}
                </div>
              )}
              {animStatus === "idle" && <p className="text-xs text-muted-foreground/50">Completa los pasos de Rigging y Animación</p>}
            </div>
          )}

          {/* Info card */}
          <div className="sc-form-card p-4" style={{ background: "rgba(151,71,255,0.04)" }}>
            <p className="text-xs font-semibold" style={{ color: "var(--sc-ai-purple)", marginBottom: 8 }}>🧊 Capacidades Tripo3D</p>
            <ul className="space-y-1 text-xs text-muted-foreground">
              {["✍️ Texto → 3D (cualquier prompt)", "📷 Imagen → 3D (1 foto)", "🔄 Multi-Vista → 3D (4 ángulos, +precisión)", "⚡ Lote: hasta 10 modelos simultáneos", "🦴 Rigging + Skeleton automático", "💃 58 animaciones predefinidas", "🎨 Estilos: LEGO, Voxel, Voronoi", "📦 Exportar: GLB, FBX, OBJ, STL, USDZ"].map(item => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
