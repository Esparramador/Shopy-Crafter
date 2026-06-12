import { useState, useRef, useCallback } from "react";
import { useRoute } from "wouter";
import {
  Loader2, Upload, Box, Wand2, Image, Play, Download,
  CheckCircle2, AlertCircle, Zap, RefreshCw, Cpu, Film,
  Layers, ChevronRight, Star, Lock,
} from "lucide-react";
import { MODELS, MODELS_BY_CATEGORY, type CharacterModel } from "@/lib/modelsConfig";
import { ANIMATIONS, ANIMATION_CATEGORIES, ANIMATIONS_BY_CATEGORY, getFormAnimationDefaults } from "@/lib/animationsLibrary";

const API = import.meta.env.BASE_URL?.replace(/\/$/, "") ?? "";

type Tab = "catalog" | "text" | "image" | "factory" | "animations";
type GenStatus = "idle" | "uploading" | "running" | "done" | "error";

interface MeshyOutput {
  task_id: string;
  model_urls?: { glb?: string; fbx?: string; usdz?: string; obj?: string };
  thumbnail_url?: string;
  video_url?: string;
  progress?: number;
}

interface FactoryItem {
  model: CharacterModel;
  file?: File;
  preview?: string;
  status: "idle" | "running" | "done" | "error";
  progress: number;
  taskId?: string;
  glbPath?: string;
  thumbnailUrl?: string;
  error?: string;
}

const ART_STYLES = [
  { value: "realistic",   label: "🔬 Realista"  },
  { value: "cartoon",     label: "🎨 Cartoon"   },
  { value: "low-poly",    label: "💎 Low-Poly"  },
  { value: "sculpture",   label: "🗿 Escultura"  },
  { value: "pbr",         label: "✨ PBR Max"   },
];

const TOPOLOGY_OPTS = [
  { value: "quad",     label: "Quad (game-ready)" },
  { value: "triangle", label: "Triangle (scan)"   },
];

// ── helpers ──────────────────────────────────────────────────────────────────

function streamSSE(
  url: string,
  body: FormData | string,
  headers: Record<string, string>,
  onEvent: (e: any) => void,
  onDone: () => void
): () => void {
  const ctrl = new AbortController();
  (async () => {
    try {
      const res = await fetch(url, {
        method: "POST",
        headers,
        body,
        signal: ctrl.signal,
        credentials: "include",
      });
      const reader = res.body!.getReader();
      const dec = new TextDecoder();
      let buf = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += dec.decode(value, { stream: true });
        const parts = buf.split("\n\n");
        buf = parts.pop() ?? "";
        for (const part of parts) {
          const line = part.trim();
          if (line.startsWith("data: ")) {
            try { onEvent(JSON.parse(line.slice(6))); } catch {}
          }
        }
      }
    } catch (e: any) {
      if (e?.name !== "AbortError") onEvent({ event: "error", error: e?.message ?? "Stream error" });
    } finally {
      onDone();
    }
  })();
  return () => ctrl.abort();
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function MeshyStudio() {
  const [, params] = useRoute("/projects/:id/*");
  const projectId = params?.id;

  const [tab, setTab] = useState<Tab>("catalog");

  // ── Catalog tab ──
  const [selectedModel, setSelectedModel] = useState<string>("spiderman");
  const [catFilter, setCatFilter] = useState<"all" | "cartoon" | "realistic">("all");

  // ── Text-to-3D tab ──
  const [txtPrompt, setTxtPrompt] = useState("");
  const [txtNeg, setTxtNeg]       = useState("");
  const [txtStyle, setTxtStyle]   = useState("realistic");
  const [txtTopology, setTxtTopology] = useState("quad");
  const [txtPolycount, setTxtPolycount] = useState(30000);
  const [txtStatus, setTxtStatus] = useState<GenStatus>("idle");
  const [txtProgress, setTxtProgress] = useState(0);
  const [txtResult, setTxtResult] = useState<MeshyOutput | null>(null);
  const [txtError, setTxtError]   = useState("");
  const [txtLog, setTxtLog]       = useState("");
  const [txtPreviewTaskId, setTxtPreviewTaskId] = useState("");
  const stopTxtRef = useRef<(() => void) | null>(null);

  // ── Image-to-3D tab ──
  const [imgFile, setImgFile]     = useState<File | null>(null);
  const [imgPreview, setImgPreview] = useState("");
  const [imgPbr, setImgPbr]       = useState(true);
  const [imgTopology, setImgTopology] = useState("quad");
  const [imgStatus, setImgStatus] = useState<GenStatus>("idle");
  const [imgProgress, setImgProgress] = useState(0);
  const [imgResult, setImgResult] = useState<MeshyOutput | null>(null);
  const [imgError, setImgError]   = useState("");
  const [imgLog, setImgLog]       = useState("");
  const imgRef = useRef<HTMLInputElement>(null);
  const stopImgRef = useRef<(() => void) | null>(null);

  // ── Factory tab ──
  const [factoryItems, setFactoryItems] = useState<FactoryItem[]>(() =>
    MODELS.map(m => ({ model: m, status: "idle", progress: 0 }))
  );
  const [factoryArtStyle, setFactoryArtStyle] = useState("realistic");

  // ── Animations tab ──
  const [animCat, setAnimCat] = useState("entrance");
  const [formAnims, setFormAnims] = useState(getFormAnimationDefaults());

  // ── Text-to-3D logic ─────────────────────────────────────────────────────

  const generateText = useCallback(() => {
    if (!txtPrompt.trim()) return;
    stopTxtRef.current?.();
    setTxtStatus("running"); setTxtProgress(0); setTxtResult(null); setTxtError(""); setTxtLog("Iniciando generación 3D...");
    const fd = new FormData();
    const cancel = streamSSE(
      `${API}/api/meshy/text-to-3d`,
      JSON.stringify({ prompt: txtPrompt, negative_prompt: txtNeg, art_style: txtStyle, topology: txtTopology, target_polycount: txtPolycount }),
      { "Content-Type": "application/json" },
      (e) => {
        if (e.event === "started") { setTxtLog(`Task iniciada: ${e.task_id}`); setTxtPreviewTaskId(e.task_id); }
        else if (e.event === "progress") { setTxtProgress(e.progress ?? 0); setTxtLog(`Generando… ${e.progress ?? 0}% [${e.status}]`); }
        else if (e.event === "done") { setTxtStatus("done"); setTxtResult(e.output); setTxtProgress(100); setTxtLog("✅ Modelo generado (preview)"); }
        else if (e.event === "error") { setTxtStatus("error"); setTxtError(e.error ?? "Error desconocido"); }
        else if (e.event === "timeout") { setTxtStatus("error"); setTxtError("Tiempo de espera superado"); }
      },
      () => { if (txtStatus === "running") setTxtStatus("idle"); }
    );
    stopTxtRef.current = cancel;
  }, [txtPrompt, txtNeg, txtStyle, txtTopology, txtPolycount]);

  const refineText = useCallback(() => {
    if (!txtPreviewTaskId) return;
    stopTxtRef.current?.();
    setTxtStatus("running"); setTxtProgress(0); setTxtLog("Refinando modelo a alta calidad...");
    const cancel = streamSSE(
      `${API}/api/meshy/text-to-3d/refine`,
      JSON.stringify({ preview_task_id: txtPreviewTaskId, texture_richness: "high" }),
      { "Content-Type": "application/json" },
      (e) => {
        if (e.event === "progress") { setTxtProgress(e.progress ?? 0); setTxtLog(`Refinando… ${e.progress ?? 0}%`); }
        else if (e.event === "done") { setTxtStatus("done"); setTxtResult(e.output); setTxtProgress(100); setTxtLog("✅ Modelo refinado (alta calidad)"); }
        else if (e.event === "error") { setTxtStatus("error"); setTxtError(e.error ?? "Error"); }
      },
      () => {}
    );
    stopTxtRef.current = cancel;
  }, [txtPreviewTaskId]);

  // ── Image-to-3D logic ──────────────────────────────────────────────────────

  const handleImgFile = (f: File) => {
    setImgFile(f);
    const reader = new FileReader();
    reader.onload = e => setImgPreview(e.target?.result as string);
    reader.readAsDataURL(f);
    setImgResult(null); setImgError("");
  };

  const generateImage = useCallback(() => {
    if (!imgFile) return;
    stopImgRef.current?.();
    setImgStatus("running"); setImgProgress(0); setImgResult(null); setImgError(""); setImgLog("Subiendo imagen...");

    const fd = new FormData();
    fd.append("image", imgFile);
    fd.append("enable_pbr", String(imgPbr));
    fd.append("topology", imgTopology);

    const cancel = streamSSE(
      `${API}/api/meshy/image-to-3d`,
      fd,
      {},
      (e) => {
        if (e.event === "started") setImgLog(`Task: ${e.task_id}`);
        else if (e.event === "progress") { setImgProgress(e.progress ?? 0); setImgLog(`Procesando… ${e.progress ?? 0}%`); }
        else if (e.event === "done") { setImgStatus("done"); setImgResult(e.output); setImgProgress(100); setImgLog("✅ Modelo listo"); }
        else if (e.event === "error") { setImgStatus("error"); setImgError(e.error ?? "Error"); }
        else if (e.event === "timeout") { setImgStatus("error"); setImgError("Tiempo de espera superado"); }
      },
      () => { if (imgStatus === "running") setImgStatus("idle"); }
    );
    stopImgRef.current = cancel;
  }, [imgFile, imgPbr, imgTopology]);

  // ── Factory logic ──────────────────────────────────────────────────────────

  const handleFactoryFile = (modelId: string, f: File) => {
    const reader = new FileReader();
    reader.onload = e => {
      setFactoryItems(prev => prev.map(item =>
        item.model.id === modelId ? { ...item, file: f, preview: e.target?.result as string } : item
      ));
    };
    reader.readAsDataURL(f);
  };

  const generateCharacter = useCallback((modelId: string) => {
    const item = factoryItems.find(i => i.model.id === modelId);
    if (!item?.file) return;

    setFactoryItems(prev => prev.map(i =>
      i.model.id === modelId ? { ...i, status: "running", progress: 0, error: undefined } : i
    ));

    const fd = new FormData();
    fd.append("image", item.file);
    fd.append("characterId", modelId);
    fd.append("art_style", factoryArtStyle);

    streamSSE(
      `${API}/api/meshy/generate-character`,
      fd,
      {},
      (e) => {
        if (e.event === "progress") {
          setFactoryItems(prev => prev.map(i =>
            i.model.id === modelId ? { ...i, progress: e.progress ?? i.progress } : i
          ));
        } else if (e.event === "done") {
          setFactoryItems(prev => prev.map(i =>
            i.model.id === modelId ? { ...i, status: "done", progress: 100, glbPath: e.glb_path, thumbnailUrl: e.thumbnail_url, taskId: e.task_id } : i
          ));
        } else if (e.event === "error") {
          setFactoryItems(prev => prev.map(i =>
            i.model.id === modelId ? { ...i, status: "error", error: e.error ?? "Error desconocido" } : i
          ));
        }
      },
      () => {}
    );
  }, [factoryItems, factoryArtStyle]);

  const generateAllReady = () => {
    const withFiles = factoryItems.filter(i => i.file && i.status === "idle");
    withFiles.forEach(i => generateCharacter(i.model.id));
  };

  // ── Render ────────────────────────────────────────────────────────────────

  const filteredModels = catFilter === "all"
    ? MODELS
    : MODELS.filter(m => m.category === catFilter);

  const tabs: { id: Tab; label: string; icon: string }[] = [
    { id: "catalog",    label: "Catálogo",    icon: "🎭" },
    { id: "text",       label: "Texto → 3D",  icon: "✏️" },
    { id: "image",      label: "Imagen → 3D", icon: "📷" },
    { id: "factory",    label: "Fábrica",     icon: "🏭" },
    { id: "animations", label: "Animaciones", icon: "💃" },
  ];

  const factoryDone  = factoryItems.filter(i => i.status === "done").length;
  const factoryReady = factoryItems.filter(i => i.file && i.status === "idle").length;

  return (
    <div style={{ padding: "24px 28px", maxWidth: 960, margin: "0 auto" }}>
      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 6 }}>
          <div style={{ fontSize: 28 }}>🧊</div>
          <div>
            <h1 style={{ margin: 0, fontSize: 20, fontWeight: 700, color: "var(--l-t)" }}>
              Meshy Studio — Character Lab
            </h1>
            <p style={{ margin: 0, fontSize: 12, color: "var(--l-t3)" }}>
              Generación 3D con auto-rigging y 500+ animaciones · Proyecto #{projectId}
            </p>
          </div>
          <div style={{ marginLeft: "auto", display: "flex", gap: 8 }}>
            <div style={{ fontSize: 11, padding: "3px 10px", borderRadius: 20, background: "rgba(212,168,67,0.12)", color: "var(--l-gold)", border: "1px solid rgba(212,168,67,0.3)" }}>
              {factoryDone}/14 modelos listos
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: "flex", gap: 4, marginBottom: 20, borderBottom: "1px solid rgba(255,255,255,0.07)", paddingBottom: 2 }}>
        {tabs.map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            style={{
              padding: "7px 14px", border: "none", cursor: "pointer", borderRadius: "6px 6px 0 0",
              fontSize: 13, fontWeight: tab === t.id ? 600 : 400,
              background: tab === t.id ? "rgba(212,168,67,0.15)" : "transparent",
              color: tab === t.id ? "var(--l-gold)" : "var(--l-t3)",
              borderBottom: tab === t.id ? "2px solid var(--l-gold)" : "2px solid transparent",
            }}
          >
            {t.icon} {t.label}
          </button>
        ))}
      </div>

      {/* ── CATÁLOGO ────────────────────────────────────────────── */}
      {tab === "catalog" && (
        <div>
          <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
            {(["all", "cartoon", "realistic"] as const).map(c => (
              <button key={c} onClick={() => setCatFilter(c)} style={{
                padding: "5px 14px", borderRadius: 20, fontSize: 12, cursor: "pointer", border: "1px solid",
                borderColor: catFilter === c ? "var(--l-gold)" : "rgba(255,255,255,0.1)",
                background: catFilter === c ? "rgba(212,168,67,0.15)" : "transparent",
                color: catFilter === c ? "var(--l-gold)" : "var(--l-t3)",
              }}>
                {c === "all" ? "Todos (14)" : c === "cartoon" ? "🎨 Cartoon (10)" : "👤 Realista (4)"}
              </button>
            ))}
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(130px, 1fr))", gap: 12 }}>
            {filteredModels.map(m => {
              const factItem = factoryItems.find(f => f.model.id === m.id);
              const isReady = factItem?.status === "done";
              const isRunning = factItem?.status === "running";
              const isSelected = selectedModel === m.id;
              return (
                <div
                  key={m.id}
                  onClick={() => setSelectedModel(m.id)}
                  style={{
                    border: `2px solid ${isSelected ? "var(--l-gold)" : isReady ? "rgba(0,200,100,0.4)" : "rgba(255,255,255,0.08)"}`,
                    borderRadius: 12, padding: 12, cursor: "pointer", textAlign: "center",
                    background: isSelected ? "rgba(212,168,67,0.08)" : "rgba(255,255,255,0.02)",
                    transition: "all 0.15s",
                    position: "relative",
                  }}
                >
                  {isReady && (
                    <div style={{ position: "absolute", top: 6, right: 6 }}>
                      <CheckCircle2 size={14} style={{ color: "#00c864" }} />
                    </div>
                  )}
                  {isRunning && (
                    <div style={{ position: "absolute", top: 6, right: 6 }}>
                      <Loader2 size={14} className="animate-spin" style={{ color: "var(--l-gold)" }} />
                    </div>
                  )}
                  {!isReady && !isRunning && (
                    <div style={{ position: "absolute", top: 6, right: 6 }}>
                      <Lock size={12} style={{ color: "var(--l-t4)" }} />
                    </div>
                  )}
                  <div style={{ fontSize: 32, marginBottom: 6 }}>{m.emoji}</div>
                  <div style={{ fontSize: 11, fontWeight: 600, color: "var(--l-t)", lineHeight: 1.3 }}>{m.name}</div>
                  <div style={{ fontSize: 10, color: "var(--l-t4)", marginTop: 3 }}>
                    {m.category === "cartoon" ? "Cartoon" : "Realista"}
                  </div>
                  {isRunning && (
                    <div style={{ marginTop: 6, height: 3, borderRadius: 2, background: "rgba(255,255,255,0.1)", overflow: "hidden" }}>
                      <div style={{ width: `${factItem?.progress ?? 0}%`, height: "100%", background: "var(--l-gold)", transition: "width 0.5s" }} />
                    </div>
                  )}
                  {isReady && factItem?.thumbnailUrl && (
                    <img src={factItem.thumbnailUrl} alt={m.name} style={{ width: "100%", borderRadius: 6, marginTop: 6, aspectRatio: "1", objectFit: "cover" }} />
                  )}
                </div>
              );
            })}
          </div>

          {/* Selected model details */}
          {selectedModel && (() => {
            const m = MODELS.find(x => x.id === selectedModel)!;
            const fi = factoryItems.find(f => f.model.id === selectedModel);
            return (
              <div style={{ marginTop: 20, padding: 16, border: "1px solid rgba(212,168,67,0.2)", borderRadius: 12, background: "rgba(212,168,67,0.04)" }}>
                <div style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
                  <div style={{ fontSize: 40 }}>{m.emoji}</div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 700, fontSize: 15, color: "var(--l-t)" }}>{m.name}</div>
                    <div style={{ fontSize: 12, color: "var(--l-t3)", marginTop: 2 }}>{m.description}</div>
                    <div style={{ display: "flex", gap: 6, marginTop: 8, flexWrap: "wrap" }}>
                      {m.tags.map(t => (
                        <span key={t} style={{ fontSize: 10, padding: "2px 8px", borderRadius: 10, background: "rgba(255,255,255,0.06)", color: "var(--l-t4)" }}>{t}</span>
                      ))}
                    </div>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <div style={{ fontSize: 11, color: fi?.status === "done" ? "#00c864" : "var(--l-t4)" }}>
                      {fi?.status === "done" ? "✅ GLB listo" : "⏳ Pendiente"}
                    </div>
                    {fi?.status !== "done" && (
                      <button onClick={() => setTab("factory")} style={{
                        marginTop: 8, padding: "5px 12px", borderRadius: 6, fontSize: 11,
                        background: "rgba(212,168,67,0.15)", border: "1px solid rgba(212,168,67,0.3)",
                        color: "var(--l-gold)", cursor: "pointer",
                      }}>
                        Generar → Fábrica
                      </button>
                    )}
                    {fi?.status === "done" && fi.glbPath && (
                      <a href={fi.glbPath} download style={{
                        marginTop: 8, display: "inline-block", padding: "5px 12px", borderRadius: 6, fontSize: 11,
                        background: "rgba(0,200,100,0.12)", border: "1px solid rgba(0,200,100,0.3)",
                        color: "#00c864", cursor: "pointer", textDecoration: "none",
                      }}>
                        ⬇ Descargar GLB
                      </a>
                    )}
                  </div>
                </div>
              </div>
            );
          })()}
        </div>
      )}

      {/* ── TEXTO → 3D ─────────────────────────────────────────── */}
      {tab === "text" && (
        <div className="sc-form-card p-5 space-y-4">
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
            <Wand2 size={16} style={{ color: "var(--l-gold)" }} />
            <h3 style={{ margin: 0, fontSize: 14, fontWeight: 600, color: "var(--l-t)" }}>Texto → Modelo 3D (Meshy)</h3>
          </div>
          <p style={{ fontSize: 12, color: "var(--l-t3)", margin: 0 }}>Genera un modelo 3D con texturas PBR desde una descripción. Pipeline: Preview (60s) → Refine (2min).</p>

          <div>
            <label style={{ fontSize: 12, color: "var(--l-t3)", display: "block", marginBottom: 4 }}>Prompt *</label>
            <textarea
              value={txtPrompt}
              onChange={e => setTxtPrompt(e.target.value)}
              rows={3}
              placeholder="Ej: Spider-Man in iconic pose, full body, A-pose for rigging, wearing red and blue suit with web details..."
              style={{ width: "100%", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8, padding: "8px 12px", color: "var(--l-t)", fontSize: 13, resize: "vertical", boxSizing: "border-box" }}
            />
          </div>
          <div>
            <label style={{ fontSize: 12, color: "var(--l-t3)", display: "block", marginBottom: 4 }}>Negative Prompt</label>
            <input
              value={txtNeg}
              onChange={e => setTxtNeg(e.target.value)}
              placeholder="blurry, low quality, deformed..."
              style={{ width: "100%", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8, padding: "8px 12px", color: "var(--l-t)", fontSize: 13, boxSizing: "border-box" }}
            />
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
            <div>
              <label style={{ fontSize: 11, color: "var(--l-t3)", display: "block", marginBottom: 4 }}>Estilo</label>
              <select value={txtStyle} onChange={e => setTxtStyle(e.target.value)} style={{ width: "100%", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8, padding: "6px 10px", color: "var(--l-t)", fontSize: 12 }}>
                {ART_STYLES.map(s => <option key={s.value} value={s.value} style={{ background: "#1a1a2e" }}>{s.label}</option>)}
              </select>
            </div>
            <div>
              <label style={{ fontSize: 11, color: "var(--l-t3)", display: "block", marginBottom: 4 }}>Topología</label>
              <select value={txtTopology} onChange={e => setTxtTopology(e.target.value)} style={{ width: "100%", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8, padding: "6px 10px", color: "var(--l-t)", fontSize: 12 }}>
                {TOPOLOGY_OPTS.map(o => <option key={o.value} value={o.value} style={{ background: "#1a1a2e" }}>{o.label}</option>)}
              </select>
            </div>
            <div>
              <label style={{ fontSize: 11, color: "var(--l-t3)", display: "block", marginBottom: 4 }}>Polígonos</label>
              <select value={txtPolycount} onChange={e => setTxtPolycount(Number(e.target.value))} style={{ width: "100%", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8, padding: "6px 10px", color: "var(--l-t)", fontSize: 12 }}>
                <option value={10000} style={{ background: "#1a1a2e" }}>10k (móvil)</option>
                <option value={30000} style={{ background: "#1a1a2e" }}>30k (web)</option>
                <option value={100000} style={{ background: "#1a1a2e" }}>100k (HD)</option>
              </select>
            </div>
          </div>

          {/* Progress */}
          {txtStatus === "running" && (
            <div>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6, fontSize: 12, color: "var(--l-t3)" }}>
                <span>{txtLog}</span><span>{txtProgress}%</span>
              </div>
              <div style={{ height: 6, borderRadius: 3, background: "rgba(255,255,255,0.08)", overflow: "hidden" }}>
                <div style={{ width: `${txtProgress}%`, height: "100%", background: "var(--l-gold)", transition: "width 0.5s", borderRadius: 3 }} />
              </div>
            </div>
          )}
          {txtStatus === "error" && (
            <div style={{ padding: "10px 12px", borderRadius: 8, background: "rgba(255,71,87,0.1)", border: "1px solid rgba(255,71,87,0.2)", color: "#ff4757", fontSize: 12 }}>
              <AlertCircle size={13} style={{ display: "inline", marginRight: 6 }} />{txtError}
            </div>
          )}

          <div style={{ display: "flex", gap: 8 }}>
            <button
              onClick={generateText}
              disabled={!txtPrompt.trim() || txtStatus === "running"}
              className="sc-form-button"
              style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 6, opacity: !txtPrompt.trim() ? 0.5 : 1 }}
            >
              {txtStatus === "running" ? <><Loader2 size={14} className="animate-spin" /> Generando preview...</> : <><Wand2 size={14} /> Generar Preview (60s)</>}
            </button>
            {txtPreviewTaskId && txtStatus !== "running" && (
              <button
                onClick={refineText}
                disabled={txtStatus === "running"}
                style={{ padding: "0 16px", borderRadius: 8, border: "1px solid rgba(212,168,67,0.4)", background: "rgba(212,168,67,0.1)", color: "var(--l-gold)", fontSize: 13, cursor: "pointer" }}
              >
                <Star size={13} style={{ marginRight: 4, display: "inline" }} /> Refinar
              </button>
            )}
          </div>

          {/* Result */}
          {txtResult && txtStatus === "done" && (
            <ModelResultCard output={txtResult} />
          )}
        </div>
      )}

      {/* ── IMAGEN → 3D ────────────────────────────────────────── */}
      {tab === "image" && (
        <div className="sc-form-card p-5 space-y-4">
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
            <Image size={16} style={{ color: "var(--l-jade)" }} />
            <h3 style={{ margin: 0, fontSize: 14, fontWeight: 600, color: "var(--l-t)" }}>Imagen → Modelo 3D</h3>
          </div>
          <p style={{ fontSize: 12, color: "var(--l-t3)", margin: 0 }}>Sube una foto de referencia y Meshy generará el modelo 3D con texturas PBR automáticamente.</p>

          {/* Upload zone */}
          <div
            onClick={() => imgRef.current?.click()}
            style={{
              border: "2px dashed rgba(100,220,160,0.3)", borderRadius: 12, padding: 24,
              textAlign: "center", cursor: "pointer", background: "rgba(100,220,160,0.03)",
              transition: "border-color 0.2s",
            }}
          >
            {imgPreview
              ? <img src={imgPreview} alt="preview" style={{ maxHeight: 200, margin: "0 auto", borderRadius: 8, objectFit: "contain" }} />
              : <>
                  <Upload size={28} style={{ color: "var(--l-jade)", margin: "0 auto 8px" }} />
                  <p style={{ fontSize: 13, color: "var(--l-t3)", margin: 0 }}>Haz clic o arrastra tu imagen de referencia</p>
                  <p style={{ fontSize: 11, color: "var(--l-t4)", marginTop: 4 }}>PNG, JPG, WEBP · máx 30MB</p>
                </>
            }
          </div>
          <input ref={imgRef} type="file" accept="image/*" style={{ display: "none" }} onChange={e => { const f = e.target.files?.[0]; if (f) handleImgFile(f); }} />

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: "var(--l-t3)", cursor: "pointer" }}>
              <input type="checkbox" checked={imgPbr} onChange={e => setImgPbr(e.target.checked)} />
              Texturas PBR (Diffuse, Roughness, Metal, Normal)
            </label>
            <div>
              <select value={imgTopology} onChange={e => setImgTopology(e.target.value)} style={{ width: "100%", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8, padding: "6px 10px", color: "var(--l-t)", fontSize: 12 }}>
                {TOPOLOGY_OPTS.map(o => <option key={o.value} value={o.value} style={{ background: "#1a1a2e" }}>{o.label}</option>)}
              </select>
            </div>
          </div>

          {imgStatus === "running" && (
            <div>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6, fontSize: 12, color: "var(--l-t3)" }}>
                <span>{imgLog}</span><span>{imgProgress}%</span>
              </div>
              <div style={{ height: 6, borderRadius: 3, background: "rgba(255,255,255,0.08)", overflow: "hidden" }}>
                <div style={{ width: `${imgProgress}%`, height: "100%", background: "var(--l-jade)", transition: "width 0.5s", borderRadius: 3 }} />
              </div>
            </div>
          )}
          {imgStatus === "error" && (
            <div style={{ padding: "10px 12px", borderRadius: 8, background: "rgba(255,71,87,0.1)", border: "1px solid rgba(255,71,87,0.2)", color: "#ff4757", fontSize: 12 }}>
              <AlertCircle size={13} style={{ display: "inline", marginRight: 6 }} />{imgError}
            </div>
          )}

          <button
            onClick={generateImage}
            disabled={!imgFile || imgStatus === "running"}
            className="sc-form-button"
            style={{ width: "100%", display: "flex", alignItems: "center", justifyContent: "center", gap: 6, opacity: !imgFile ? 0.5 : 1, background: "var(--l-jade)" }}
          >
            {imgStatus === "running" ? <><Loader2 size={14} className="animate-spin" /> Procesando...</> : <><Box size={14} /> Generar Modelo 3D</>}
          </button>

          {imgResult && imgStatus === "done" && <ModelResultCard output={imgResult} />}
        </div>
      )}

      {/* ── FÁBRICA ─────────────────────────────────────────────── */}
      {tab === "factory" && (
        <div className="space-y-4">
          <div className="sc-form-card p-5">
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
              <Zap size={16} style={{ color: "var(--l-gold)" }} />
              <h3 style={{ margin: 0, fontSize: 14, fontWeight: 600, color: "var(--l-t)" }}>Fábrica de Personajes — Pipeline Admin</h3>
              <div style={{ marginLeft: "auto", fontSize: 12, color: "var(--l-t3)" }}>{factoryDone}/14 completados</div>
            </div>
            <p style={{ fontSize: 12, color: "var(--l-t3)", margin: "0 0 12px" }}>
              Sube una imagen de referencia para cada personaje. Meshy la convierte en .glb y lo guarda en <code style={{ background: "rgba(255,255,255,0.07)", padding: "1px 5px", borderRadius: 4 }}>/assets/3d/models/</code>
            </p>
            <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
              <div>
                <label style={{ fontSize: 11, color: "var(--l-t3)", marginRight: 6 }}>Estilo:</label>
                <select value={factoryArtStyle} onChange={e => setFactoryArtStyle(e.target.value)} style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 6, padding: "4px 8px", color: "var(--l-t)", fontSize: 12 }}>
                  {ART_STYLES.map(s => <option key={s.value} value={s.value} style={{ background: "#1a1a2e" }}>{s.label}</option>)}
                </select>
              </div>
              {factoryReady > 0 && (
                <button onClick={generateAllReady} style={{
                  padding: "6px 16px", borderRadius: 8, fontSize: 12, cursor: "pointer",
                  background: "rgba(212,168,67,0.15)", border: "1px solid rgba(212,168,67,0.3)", color: "var(--l-gold)", fontWeight: 600,
                }}>
                  <Zap size={12} style={{ display: "inline", marginRight: 4 }} />
                  Generar todos ({factoryReady}) listos
                </button>
              )}
            </div>
          </div>

          {/* Character grid */}
          {(["cartoon", "realistic"] as const).map(cat => (
            <div key={cat}>
              <div style={{ fontSize: 12, fontWeight: 600, color: "var(--l-t3)", marginBottom: 10, letterSpacing: "0.08em", textTransform: "uppercase" }}>
                {cat === "cartoon" ? "🎨 Cartoon / Pop-Culture" : "👤 Realista Humanoide"}
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: 12 }}>
                {factoryItems.filter(i => i.model.category === cat).map(item => (
                  <FactoryCard
                    key={item.model.id}
                    item={item}
                    onFileSelect={(f) => handleFactoryFile(item.model.id, f)}
                    onGenerate={() => generateCharacter(item.model.id)}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── ANIMACIONES ────────────────────────────────────────── */}
      {tab === "animations" && (
        <div className="space-y-4">
          <div className="sc-form-card p-5">
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
              <Film size={16} style={{ color: "var(--l-gold)" }} />
              <h3 style={{ margin: 0, fontSize: 14, fontWeight: 600 }}>Librería Maestra de Animaciones Meshy</h3>
              <span style={{ marginLeft: "auto", fontSize: 11, color: "var(--l-t4)" }}>{ANIMATIONS.length} clips disponibles</span>
            </div>

            {/* Form animation selector */}
            <div style={{ padding: 12, border: "1px solid rgba(212,168,67,0.2)", borderRadius: 10, background: "rgba(212,168,67,0.04)", marginBottom: 16 }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: "var(--l-gold)", marginBottom: 10, letterSpacing: "0.06em" }}>CONFIGURACIÓN DEL FORMULARIO 3D</div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 10 }}>
                {(["entrance", "waiting", "action", "celebration"] as const).map(phase => {
                  const clips = ANIMATIONS.filter(a => a.category === phase);
                  const labels = { entrance: "🎬 Entrada", waiting: "🧍 Espera (idle)", action: "👆 Acción", celebration: "🎉 Celebración" };
                  return (
                    <div key={phase}>
                      <label style={{ fontSize: 11, color: "var(--l-t3)", display: "block", marginBottom: 3 }}>{labels[phase]}</label>
                      <select
                        value={(formAnims as any)[phase]}
                        onChange={e => setFormAnims(prev => ({ ...prev, [phase]: e.target.value }))}
                        style={{ width: "100%", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 6, padding: "5px 8px", color: "var(--l-t)", fontSize: 12 }}
                      >
                        {clips.map(c => <option key={c.id} value={c.id} style={{ background: "#1a1a2e" }}>{c.label}</option>)}
                      </select>
                    </div>
                  );
                })}
              </div>
              <div style={{ marginTop: 10, display: "flex", gap: 6 }}>
                {(["entrance", "waiting", "action", "celebration"] as const).map(p => {
                  const clip = ANIMATIONS.find(a => a.id === (formAnims as any)[p]);
                  return clip ? (
                    <div key={p} style={{ fontSize: 10, padding: "2px 8px", borderRadius: 10, background: "rgba(212,168,67,0.1)", color: "var(--l-gold)" }}>
                      {clip.name}
                    </div>
                  ) : null;
                })}
              </div>
            </div>

            {/* Category tabs */}
            <div style={{ display: "flex", gap: 4, marginBottom: 12, flexWrap: "wrap" }}>
              {ANIMATION_CATEGORIES.map(c => (
                <button key={c.id} onClick={() => setAnimCat(c.id)} style={{
                  padding: "4px 12px", borderRadius: 16, fontSize: 11, cursor: "pointer", border: "1px solid",
                  borderColor: animCat === c.id ? "var(--l-gold)" : "rgba(255,255,255,0.1)",
                  background: animCat === c.id ? "rgba(212,168,67,0.15)" : "transparent",
                  color: animCat === c.id ? "var(--l-gold)" : "var(--l-t4)",
                }}>
                  {c.icon} {c.label}
                </button>
              ))}
            </div>

            {/* Clips list */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: 8 }}>
              {ANIMATIONS.filter(a => a.category === animCat).map(clip => (
                <div key={clip.id} style={{ padding: "10px 12px", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 10, background: "rgba(255,255,255,0.02)" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 4 }}>
                    <div style={{ fontWeight: 600, fontSize: 12, color: "var(--l-t)" }}>{clip.label}</div>
                    <div style={{ fontSize: 10, color: "var(--l-t4)", background: "rgba(255,255,255,0.06)", padding: "1px 6px", borderRadius: 8 }}>
                      {clip.looping ? "🔄 Loop" : `${(clip.durationMs / 1000).toFixed(1)}s`}
                    </div>
                  </div>
                  <div style={{ fontSize: 10, color: "var(--l-jade)", marginBottom: 3 }}>
                    <code>{clip.name}</code>
                  </div>
                  <div style={{ fontSize: 11, color: "var(--l-t4)", lineHeight: 1.4 }}>{clip.description}</div>
                  {clip.formContext && (
                    <div style={{ fontSize: 10, color: "var(--l-t4)", marginTop: 4, fontStyle: "italic", borderTop: "1px solid rgba(255,255,255,0.05)", paddingTop: 4 }}>
                      💡 {clip.formContext}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Sub-components ────────────────────────────────────────────────────────────

function ModelResultCard({ output }: { output: MeshyOutput }) {
  const urls = output.model_urls ?? {};
  return (
    <div style={{ border: "1px solid rgba(0,200,100,0.3)", borderRadius: 10, padding: 12, background: "rgba(0,200,100,0.04)" }}>
      <div style={{ display: "flex", gap: 10, marginBottom: 8 }}>
        {output.thumbnail_url && (
          <img src={output.thumbnail_url} alt="thumb" style={{ width: 80, height: 80, borderRadius: 8, objectFit: "cover", border: "1px solid rgba(255,255,255,0.1)" }} />
        )}
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: "#00c864", marginBottom: 4 }}>✅ Modelo generado</div>
          <div style={{ fontSize: 11, color: "var(--l-t4)" }}>Task: {output.task_id}</div>
          <div style={{ display: "flex", gap: 6, marginTop: 8, flexWrap: "wrap" }}>
            {urls.glb  && <a href={urls.glb}  target="_blank" rel="noreferrer" style={{ fontSize: 11, padding: "3px 10px", borderRadius: 6, background: "rgba(212,168,67,0.15)", color: "var(--l-gold)", textDecoration: "none" }}>⬇ GLB</a>}
            {urls.fbx  && <a href={urls.fbx}  target="_blank" rel="noreferrer" style={{ fontSize: 11, padding: "3px 10px", borderRadius: 6, background: "rgba(255,255,255,0.06)", color: "var(--l-t3)", textDecoration: "none" }}>⬇ FBX</a>}
            {urls.usdz && <a href={urls.usdz} target="_blank" rel="noreferrer" style={{ fontSize: 11, padding: "3px 10px", borderRadius: 6, background: "rgba(255,255,255,0.06)", color: "var(--l-t3)", textDecoration: "none" }}>⬇ USDZ</a>}
            {urls.obj  && <a href={urls.obj}  target="_blank" rel="noreferrer" style={{ fontSize: 11, padding: "3px 10px", borderRadius: 6, background: "rgba(255,255,255,0.06)", color: "var(--l-t3)", textDecoration: "none" }}>⬇ OBJ</a>}
          </div>
        </div>
      </div>
      {output.video_url && (
        <video src={output.video_url} autoPlay loop muted playsInline style={{ width: "100%", borderRadius: 8, marginTop: 4, maxHeight: 200 }} />
      )}
    </div>
  );
}

function FactoryCard({ item, onFileSelect, onGenerate }: {
  item: FactoryItem;
  onFileSelect: (f: File) => void;
  onGenerate: () => void;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const { model, status, progress, error, thumbnailUrl, glbPath } = item;

  return (
    <div style={{
      border: `1.5px solid ${status === "done" ? "rgba(0,200,100,0.4)" : status === "error" ? "rgba(255,71,87,0.3)" : "rgba(255,255,255,0.08)"}`,
      borderRadius: 12, padding: 12, background: "rgba(255,255,255,0.02)",
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
        <span style={{ fontSize: 22 }}>{model.emoji}</span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: "var(--l-t)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{model.name}</div>
          <div style={{ fontSize: 10, color: "var(--l-t4)" }}>{model.category === "cartoon" ? "Cartoon" : "Realista"}</div>
        </div>
        {status === "done" && <CheckCircle2 size={16} style={{ color: "#00c864", flexShrink: 0 }} />}
        {status === "error" && <AlertCircle size={16} style={{ color: "#ff4757", flexShrink: 0 }} />}
        {status === "running" && <Loader2 size={16} className="animate-spin" style={{ color: "var(--l-gold)", flexShrink: 0 }} />}
      </div>

      {/* Preview / Thumbnail */}
      {(thumbnailUrl || item.preview) && (
        <img src={thumbnailUrl ?? item.preview} alt={model.name} style={{ width: "100%", height: 80, objectFit: "cover", borderRadius: 8, marginBottom: 8 }} />
      )}

      {status === "running" && (
        <div style={{ marginBottom: 8 }}>
          <div style={{ height: 4, borderRadius: 2, background: "rgba(255,255,255,0.08)", overflow: "hidden" }}>
            <div style={{ width: `${progress}%`, height: "100%", background: "var(--l-gold)", transition: "width 0.5s" }} />
          </div>
          <div style={{ fontSize: 10, color: "var(--l-t4)", marginTop: 3, textAlign: "right" }}>{progress}%</div>
        </div>
      )}
      {error && <div style={{ fontSize: 10, color: "#ff4757", marginBottom: 6 }}>{error.slice(0, 80)}</div>}

      {status === "done" && glbPath ? (
        <a href={glbPath} download style={{ display: "block", textAlign: "center", padding: "5px", borderRadius: 6, background: "rgba(0,200,100,0.1)", color: "#00c864", fontSize: 11, textDecoration: "none" }}>
          ⬇ Descargar GLB
        </a>
      ) : status !== "running" ? (
        <div style={{ display: "flex", gap: 6 }}>
          <button onClick={() => fileRef.current?.click()} style={{ flex: 1, padding: "5px", borderRadius: 6, border: "1px dashed rgba(255,255,255,0.15)", background: "transparent", color: "var(--l-t4)", fontSize: 11, cursor: "pointer" }}>
            {item.file ? "✅ Imagen" : "📷 Subir imagen"}
          </button>
          {item.file && (
            <button onClick={onGenerate} style={{ padding: "5px 10px", borderRadius: 6, border: "none", background: "rgba(212,168,67,0.2)", color: "var(--l-gold)", fontSize: 11, cursor: "pointer", fontWeight: 600 }}>
              <Zap size={11} />
            </button>
          )}
        </div>
      ) : null}
      <input ref={fileRef} type="file" accept="image/*" style={{ display: "none" }} onChange={e => { const f = e.target.files?.[0]; if (f) onFileSelect(f); }} />
    </div>
  );
}
