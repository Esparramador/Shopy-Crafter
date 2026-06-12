import { useState, useRef, useCallback, Suspense } from "react";
import { useRoute } from "wouter";
import {
  Loader2, Upload, Box, Wand2, Image, Play, Download,
  CheckCircle2, AlertCircle, Zap, RefreshCw, Film,
  ChevronRight, Star, Lock, Sparkles, Cpu, Eye,
} from "lucide-react";
import ModelViewer3D from "@/components/ModelViewer3D";
import { MESHY_CHARACTERS, RIGGED_CHARACTERS, type MeshyCharacter } from "@/lib/meshyModels";

const API = import.meta.env.BASE_URL?.replace(/\/$/, "") ?? "";

type Tab = "viewer" | "catalog" | "text" | "image" | "factory";
type GenStatus = "idle" | "uploading" | "running" | "done" | "error";

interface MeshyOutput {
  task_id: string;
  model_urls?: { glb?: string; fbx?: string; usdz?: string; obj?: string };
  thumbnail_url?: string;
  video_url?: string;
  progress?: number;
}

interface FactoryItem {
  char: MeshyCharacter;
  file?: File;
  preview?: string;
  status: "idle" | "running" | "done" | "error";
  progress: number;
  taskId?: string;
  glbPath?: string;
  thumbnailUrl?: string;
  error?: string;
  rigTaskId?: string;
  rigStatus?: "rigging" | "rigged" | "failed";
}

const ART_STYLES = [
  { value: "realistic", label: "🔬 Realista" },
  { value: "cartoon",   label: "🎨 Cartoon"  },
  { value: "low-poly",  label: "💎 Low-Poly"  },
  { value: "sculpture", label: "🗿 Escultura" },
];

// ── SSE streaming helper ──────────────────────────────────────────────────────

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
      const res = await fetch(url, { method: "POST", headers, body, signal: ctrl.signal, credentials: "include" });
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

// ── Main Component ────────────────────────────────────────────────────────────

export default function MeshyStudio() {
  const [, params] = useRoute("/projects/:id/*");
  const projectId = params?.id;

  const [tab, setTab] = useState<Tab>("viewer");

  // ── 3D Viewer state ──
  const [selectedChar, setSelectedChar] = useState<MeshyCharacter>(RIGGED_CHARACTERS[0]);

  // ── Text-to-3D ──
  const [txtPrompt, setTxtPrompt]   = useState("");
  const [txtNeg, setTxtNeg]         = useState("");
  const [txtStyle, setTxtStyle]     = useState("realistic");
  const [txtStatus, setTxtStatus]   = useState<GenStatus>("idle");
  const [txtProgress, setTxtProgress] = useState(0);
  const [txtResult, setTxtResult]   = useState<MeshyOutput | null>(null);
  const [txtError, setTxtError]     = useState("");
  const [txtLog, setTxtLog]         = useState("");
  const [txtPreviewTaskId, setTxtPreviewTaskId] = useState("");
  const stopTxtRef = useRef<(() => void) | null>(null);

  // ── Image-to-3D ──
  const [imgFile, setImgFile]       = useState<File | null>(null);
  const [imgPreview, setImgPreview] = useState("");
  const [imgStatus, setImgStatus]   = useState<GenStatus>("idle");
  const [imgProgress, setImgProgress] = useState(0);
  const [imgResult, setImgResult]   = useState<MeshyOutput | null>(null);
  const [imgError, setImgError]     = useState("");
  const [imgLog, setImgLog]         = useState("");
  const imgRef = useRef<HTMLInputElement>(null);
  const stopImgRef = useRef<(() => void) | null>(null);

  // ── Factory ──
  const [factoryItems, setFactoryItems] = useState<FactoryItem[]>(() =>
    MESHY_CHARACTERS.map(c => ({ char: c, status: "idle", progress: 0 }))
  );
  const [factoryArtStyle, setFactoryArtStyle] = useState("realistic");
  const [catFilter, setCatFilter] = useState<"all" | "cartoon" | "realistic">("all");

  // ── Text-to-3D logic ──────────────────────────────────────────────────────

  const generateText = useCallback(() => {
    if (!txtPrompt.trim()) return;
    stopTxtRef.current?.();
    setTxtStatus("running"); setTxtProgress(0); setTxtResult(null); setTxtError(""); setTxtLog("Iniciando…");
    const cancel = streamSSE(
      `${API}/api/meshy/text-to-3d`,
      JSON.stringify({ prompt: txtPrompt, negative_prompt: txtNeg, art_style: txtStyle }),
      { "Content-Type": "application/json" },
      (e) => {
        if (e.event === "started")   { setTxtPreviewTaskId(e.task_id); setTxtLog(`Task: ${e.task_id}`); }
        if (e.event === "progress")  { setTxtProgress(e.progress ?? 0); setTxtLog(`Generando… ${e.progress ?? 0}%`); }
        if (e.event === "done")      { setTxtStatus("done"); setTxtResult(e.output); setTxtProgress(100); }
        if (e.event === "error")     { setTxtStatus("error"); setTxtError(e.error ?? "Error desconocido"); }
        if (e.event === "timeout")   { setTxtStatus("error"); setTxtError("Tiempo de espera superado (8min)"); }
      },
      () => { if (txtStatus === "running") setTxtStatus("idle"); }
    );
    stopTxtRef.current = cancel;
  }, [txtPrompt, txtNeg, txtStyle]);

  const refineText = useCallback(() => {
    if (!txtPreviewTaskId) return;
    stopTxtRef.current?.();
    setTxtStatus("running"); setTxtProgress(0); setTxtLog("Refinando a alta calidad…");
    const cancel = streamSSE(
      `${API}/api/meshy/text-to-3d/refine`,
      JSON.stringify({ preview_task_id: txtPreviewTaskId, texture_richness: "high" }),
      { "Content-Type": "application/json" },
      (e) => {
        if (e.event === "progress")  { setTxtProgress(e.progress ?? 0); setTxtLog(`Refinando… ${e.progress ?? 0}%`); }
        if (e.event === "done")      { setTxtStatus("done"); setTxtResult(e.output); setTxtProgress(100); }
        if (e.event === "error")     { setTxtStatus("error"); setTxtError(e.error ?? "Error"); }
      },
      () => {}
    );
    stopTxtRef.current = cancel;
  }, [txtPreviewTaskId]);

  // ── Image-to-3D logic ─────────────────────────────────────────────────────

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
    setImgStatus("running"); setImgProgress(0); setImgResult(null); setImgError(""); setImgLog("Subiendo imagen…");
    const fd = new FormData();
    fd.append("image", imgFile);
    fd.append("topology", "quad");
    const cancel = streamSSE(
      `${API}/api/meshy/image-to-3d`, fd, {},
      (e) => {
        if (e.event === "started")  setImgLog(`Task: ${e.task_id}`);
        if (e.event === "progress") { setImgProgress(e.progress ?? 0); setImgLog(`Procesando… ${e.progress ?? 0}%`); }
        if (e.event === "done")     { setImgStatus("done"); setImgResult(e.output); setImgProgress(100); }
        if (e.event === "error")    { setImgStatus("error"); setImgError(e.error ?? "Error"); }
        if (e.event === "timeout")  { setImgStatus("error"); setImgError("Tiempo superado"); }
      },
      () => { if (imgStatus === "running") setImgStatus("idle"); }
    );
    stopImgRef.current = cancel;
  }, [imgFile]);

  // ── Factory logic ─────────────────────────────────────────────────────────

  const handleFactoryFile = (charId: string, f: File) => {
    const reader = new FileReader();
    reader.onload = e => {
      setFactoryItems(prev => prev.map(item =>
        item.char.id === charId ? { ...item, file: f, preview: e.target?.result as string } : item
      ));
    };
    reader.readAsDataURL(f);
  };

  const generateCharacter = useCallback((charId: string) => {
    const item = factoryItems.find(i => i.char.id === charId);
    if (!item?.file) return;
    setFactoryItems(prev => prev.map(i =>
      i.char.id === charId ? { ...i, status: "running", progress: 0, error: undefined } : i
    ));
    const fd = new FormData();
    fd.append("image", item.file);
    fd.append("characterId", charId);
    fd.append("art_style", factoryArtStyle);
    streamSSE(
      `${API}/api/meshy/generate-character`, fd, {},
      (e) => {
        if (e.event === "progress") {
          setFactoryItems(prev => prev.map(i =>
            i.char.id === charId ? { ...i, progress: e.progress ?? i.progress } : i
          ));
        } else if (e.event === "done") {
          setFactoryItems(prev => prev.map(i =>
            i.char.id === charId ? {
              ...i, status: "done", progress: 100,
              glbPath: e.glb_path, thumbnailUrl: e.thumbnail_url,
              taskId: e.task_id, rigTaskId: e.rig_task_id,
              rigStatus: e.rigged_glb_url ? "rigged" : "failed",
            } : i
          ));
        } else if (e.event === "error") {
          setFactoryItems(prev => prev.map(i =>
            i.char.id === charId ? { ...i, status: "error", error: e.error ?? "Error desconocido" } : i
          ));
        }
      },
      () => {}
    );
  }, [factoryItems, factoryArtStyle]);

  const generateAllReady = () => {
    factoryItems.filter(i => i.file && i.status === "idle").forEach(i => generateCharacter(i.char.id));
  };

  // ── Stats ─────────────────────────────────────────────────────────────────

  const factoryDone  = factoryItems.filter(i => i.status === "done").length;
  const factoryReady = factoryItems.filter(i => i.file && i.status === "idle").length;
  const riggedCount  = RIGGED_CHARACTERS.length;
  const totalModels  = MESHY_CHARACTERS.length;

  const filteredChars = catFilter === "all" ? MESHY_CHARACTERS
    : MESHY_CHARACTERS.filter(c => c.category === catFilter);

  const tabs: { id: Tab; label: string; icon: string; badge?: string }[] = [
    { id: "viewer",  label: "Viewer 3D",   icon: "🎮", badge: `${riggedCount} rigged` },
    { id: "catalog", label: "Catálogo",    icon: "🎭" },
    { id: "text",    label: "Texto → 3D",  icon: "✏️" },
    { id: "image",   label: "Imagen → 3D", icon: "📷" },
    { id: "factory", label: "Fábrica",     icon: "🏭", badge: `${factoryDone}/${totalModels}` },
  ];

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div style={{ padding: "24px 28px", maxWidth: 1100, margin: "0 auto" }}>

      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 20 }}>
        <div style={{ fontSize: 28 }}>🧊</div>
        <div>
          <h1 style={{ margin: 0, fontSize: 20, fontWeight: 700, color: "var(--l-t)" }}>
            Meshy Studio — Character Lab
          </h1>
          <p style={{ margin: 0, fontSize: 12, color: "var(--l-t3)" }}>
            {riggedCount} personajes rigged · {totalModels} modelos GLB · animaciones walk/run/jump reales
          </p>
        </div>
        <div style={{ marginLeft: "auto", display: "flex", gap: 8 }}>
          <StatPill label="Modelos GLB" value={`${totalModels}/14`} color="gold" />
          <StatPill label="Rigged" value={`${riggedCount}/14`} color="jade" />
          <StatPill label="Animaciones" value={`${riggedCount * 3}`} color="purple" />
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: "flex", gap: 2, marginBottom: 20, borderBottom: "1px solid rgba(255,255,255,0.07)", paddingBottom: 0 }}>
        {tabs.map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            style={{
              padding: "8px 14px", border: "none", cursor: "pointer", borderRadius: "6px 6px 0 0",
              fontSize: 13, fontWeight: tab === t.id ? 600 : 400, display: "flex", alignItems: "center", gap: 6,
              background: tab === t.id ? "rgba(212,168,67,0.15)" : "transparent",
              color: tab === t.id ? "var(--l-gold)" : "var(--l-t3)",
              borderBottom: tab === t.id ? "2px solid var(--l-gold)" : "2px solid transparent",
            }}
          >
            {t.icon} {t.label}
            {t.badge && (
              <span style={{ fontSize: 10, padding: "1px 6px", borderRadius: 10, background: "rgba(212,168,67,0.15)", color: "var(--l-gold)" }}>
                {t.badge}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* ═══ VIEWER 3D ═══════════════════════════════════════════════════════ */}
      {tab === "viewer" && (
        <div style={{ display: "grid", gridTemplateColumns: "260px 1fr", gap: 16 }}>

          {/* Character selector panel */}
          <div>
            <div style={{ fontSize: 11, fontWeight: 600, color: "var(--l-t4)", letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 10 }}>
              Personajes Rigged ({riggedCount})
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {RIGGED_CHARACTERS.map(c => (
                <button
                  key={c.id}
                  onClick={() => setSelectedChar(c)}
                  style={{
                    padding: "10px 12px", border: "1px solid", borderRadius: 10, cursor: "pointer",
                    textAlign: "left", display: "flex", alignItems: "center", gap: 10, transition: "all 0.15s",
                    borderColor: selectedChar.id === c.id ? "var(--l-gold)" : "rgba(255,255,255,0.08)",
                    background: selectedChar.id === c.id ? "rgba(212,168,67,0.08)" : "rgba(255,255,255,0.02)",
                  }}
                >
                  <span style={{ fontSize: 22 }}>{c.emoji}</span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 12, fontWeight: 600, color: "var(--l-t)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{c.name}</div>
                    <div style={{ fontSize: 10, color: "var(--l-t4)", marginTop: 1 }}>
                      {c.animations.length} animaciones · {c.category === "cartoon" ? "Cartoon" : "Realista"}
                    </div>
                  </div>
                  {selectedChar.id === c.id && <ChevronRight size={14} style={{ color: "var(--l-gold)", flexShrink: 0 }} />}
                </button>
              ))}
            </div>

            {/* Pending chars note */}
            <div style={{ marginTop: 14, padding: "10px 12px", borderRadius: 10, background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)" }}>
              <div style={{ fontSize: 10, fontWeight: 600, color: "var(--l-t4)", marginBottom: 6, letterSpacing: "0.06em" }}>
                SIN RIG ({MESHY_CHARACTERS.length - riggedCount})
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                {MESHY_CHARACTERS.filter(c => c.rigStatus === "pending").map(c => (
                  <span key={c.id} style={{ fontSize: 13 }} title={c.name}>{c.emoji}</span>
                ))}
              </div>
              <div style={{ fontSize: 10, color: "var(--l-t4)", marginTop: 6, lineHeight: 1.5 }}>
                Fallo en pose estimation. Necesitan postura A-pose. Usa la Fábrica para regenerar.
              </div>
            </div>
          </div>

          {/* 3D Viewer */}
          <div>
            <ModelViewer3D
              glbPath={selectedChar.glbPath}
              animations={selectedChar.animations}
              characterName={`${selectedChar.emoji} ${selectedChar.name}`}
              height={480}
              autoRotate
            />

            {/* Character info */}
            <div style={{ marginTop: 12, padding: "12px 16px", borderRadius: 10, background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)" }}>
              <div style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
                <span style={{ fontSize: 36 }}>{selectedChar.emoji}</span>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 15, fontWeight: 700, color: "var(--l-t)" }}>{selectedChar.name}</div>
                  <div style={{ fontSize: 12, color: "var(--l-t3)", marginTop: 2 }}>{selectedChar.description}</div>
                  <div style={{ display: "flex", gap: 5, marginTop: 8, flexWrap: "wrap" }}>
                    {selectedChar.tags.map(tag => (
                      <span key={tag} style={{ fontSize: 10, padding: "2px 8px", borderRadius: 10, background: "rgba(255,255,255,0.06)", color: "var(--l-t4)" }}>
                        {tag}
                      </span>
                    ))}
                  </div>
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 6, textAlign: "right" }}>
                  <div style={{ fontSize: 11, padding: "3px 10px", borderRadius: 20, background: "rgba(0,200,100,0.12)", color: "#00c864", border: "1px solid rgba(0,200,100,0.25)" }}>
                    ✅ GLB + Rigged
                  </div>
                  <a
                    href={selectedChar.glbPath}
                    download
                    style={{ fontSize: 11, padding: "3px 10px", borderRadius: 20, background: "rgba(212,168,67,0.12)", color: "var(--l-gold)", border: "1px solid rgba(212,168,67,0.3)", textDecoration: "none" }}
                  >
                    ⬇ Descargar GLB
                  </a>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ═══ CATÁLOGO ════════════════════════════════════════════════════════ */}
      {tab === "catalog" && (
        <div>
          {/* Filter pills */}
          <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
            {(["all", "cartoon", "realistic"] as const).map(c => (
              <button key={c} onClick={() => setCatFilter(c)} style={{
                padding: "5px 14px", borderRadius: 20, fontSize: 12, cursor: "pointer", border: "1px solid",
                borderColor: catFilter === c ? "var(--l-gold)" : "rgba(255,255,255,0.1)",
                background: catFilter === c ? "rgba(212,168,67,0.15)" : "transparent",
                color: catFilter === c ? "var(--l-gold)" : "var(--l-t3)",
              }}>
                {c === "all" ? `Todos (${MESHY_CHARACTERS.length})` : c === "cartoon" ? `🎨 Cartoon (${MESHY_CHARACTERS.filter(x => x.category === "cartoon").length})` : `👤 Realista (${MESHY_CHARACTERS.filter(x => x.category === "realistic").length})`}
              </button>
            ))}
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))", gap: 12 }}>
            {filteredChars.map(c => (
              <div
                key={c.id}
                onClick={() => { setSelectedChar(c); setTab("viewer"); }}
                style={{
                  padding: 12, borderRadius: 12, cursor: "pointer", textAlign: "center", transition: "all 0.15s",
                  border: `2px solid ${c.rigStatus === "rigged" ? "rgba(0,200,100,0.4)" : "rgba(255,255,255,0.08)"}`,
                  background: "rgba(255,255,255,0.02)", position: "relative",
                }}
              >
                <div style={{ position: "absolute", top: 6, right: 6 }}>
                  {c.rigStatus === "rigged"
                    ? <CheckCircle2 size={13} style={{ color: "#00c864" }} />
                    : <Lock size={11} style={{ color: "var(--l-t4)" }} />
                  }
                </div>
                <div style={{ fontSize: 34, marginBottom: 6 }}>{c.emoji}</div>
                <div style={{ fontSize: 11, fontWeight: 600, color: "var(--l-t)", lineHeight: 1.3 }}>{c.name}</div>
                <div style={{ fontSize: 10, color: "var(--l-t4)", marginTop: 3 }}>
                  {c.rigStatus === "rigged" ? `✨ ${c.animations.length} anim.` : "⏳ Sin rig"}
                </div>
                {c.rigStatus === "rigged" && (
                  <div style={{ marginTop: 6, fontSize: 10, padding: "2px 8px", borderRadius: 10, background: "rgba(0,200,100,0.1)", color: "#00c864", display: "inline-block" }}>
                    Ver en 3D →
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ═══ TEXTO → 3D ══════════════════════════════════════════════════════ */}
      {tab === "text" && (
        <div className="sc-form-card p-5 space-y-4" style={{ maxWidth: 640 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
            <Wand2 size={16} style={{ color: "var(--l-gold)" }} />
            <h3 style={{ margin: 0, fontSize: 14, fontWeight: 600, color: "var(--l-t)" }}>Texto → Modelo 3D</h3>
          </div>
          <p style={{ fontSize: 12, color: "var(--l-t3)", margin: 0 }}>
            Genera un modelo 3D con texturas PBR desde un prompt. Usa A-pose en el prompt para mejor rigging.
          </p>
          <div>
            <label style={{ fontSize: 12, color: "var(--l-t3)", display: "block", marginBottom: 4 }}>Prompt *</label>
            <textarea
              value={txtPrompt}
              onChange={e => setTxtPrompt(e.target.value)}
              rows={3}
              placeholder="Ej: Spider-Man in iconic A-pose, full body, wearing red and blue suit with web details, high detail..."
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
          <div>
            <label style={{ fontSize: 12, color: "var(--l-t3)", display: "block", marginBottom: 4 }}>Estilo</label>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              {ART_STYLES.map(s => (
                <button key={s.value} onClick={() => setTxtStyle(s.value)} style={{
                  padding: "5px 12px", borderRadius: 20, fontSize: 12, cursor: "pointer", border: "1px solid",
                  borderColor: txtStyle === s.value ? "var(--l-gold)" : "rgba(255,255,255,0.1)",
                  background: txtStyle === s.value ? "rgba(212,168,67,0.15)" : "transparent",
                  color: txtStyle === s.value ? "var(--l-gold)" : "var(--l-t3)",
                }}>
                  {s.label}
                </button>
              ))}
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
              {txtStatus === "running" ? <><Loader2 size={14} className="animate-spin" /> Generando (~60s)…</> : <><Wand2 size={14} /> Generar Preview</>}
            </button>
            {txtPreviewTaskId && txtStatus !== "running" && (
              <button onClick={refineText} style={{ padding: "0 16px", borderRadius: 8, border: "1px solid rgba(212,168,67,0.4)", background: "rgba(212,168,67,0.1)", color: "var(--l-gold)", fontSize: 13, cursor: "pointer" }}>
                <Star size={13} style={{ marginRight: 4, display: "inline" }} /> Refinar
              </button>
            )}
          </div>

          {txtResult && txtStatus === "done" && <ModelResultCard output={txtResult} />}
        </div>
      )}

      {/* ═══ IMAGEN → 3D ═════════════════════════════════════════════════════ */}
      {tab === "image" && (
        <div className="sc-form-card p-5 space-y-4" style={{ maxWidth: 640 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
            <Image size={16} style={{ color: "var(--l-jade)" }} />
            <h3 style={{ margin: 0, fontSize: 14, fontWeight: 600, color: "var(--l-t)" }}>Imagen → Modelo 3D</h3>
          </div>
          <p style={{ fontSize: 12, color: "var(--l-t3)", margin: 0 }}>
            Sube una foto y Meshy generará el GLB en ~4 minutos usando meshy-6.
          </p>

          {/* Dropzone */}
          <div
            onClick={() => imgRef.current?.click()}
            style={{ border: "2px dashed rgba(100,220,160,0.3)", borderRadius: 12, padding: 24, textAlign: "center", cursor: "pointer", background: "rgba(100,220,160,0.03)" }}
          >
            {imgPreview
              ? <img src={imgPreview} alt="preview" style={{ maxHeight: 200, margin: "0 auto", borderRadius: 8, objectFit: "contain" }} />
              : <>
                  <Upload size={28} style={{ color: "var(--l-jade)", margin: "0 auto 8px" }} />
                  <p style={{ fontSize: 13, color: "var(--l-t3)", margin: 0 }}>Haz clic o arrastra tu imagen</p>
                  <p style={{ fontSize: 11, color: "var(--l-t4)", marginTop: 4 }}>PNG, JPG, WEBP · máx 30MB</p>
                </>
            }
          </div>
          <input ref={imgRef} type="file" accept="image/*" style={{ display: "none" }} onChange={e => { const f = e.target.files?.[0]; if (f) handleImgFile(f); }} />

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
            style={{ width: "100%", display: "flex", alignItems: "center", justifyContent: "center", gap: 6, background: "var(--l-jade)", opacity: !imgFile ? 0.5 : 1 }}
          >
            {imgStatus === "running" ? <><Loader2 size={14} className="animate-spin" /> Procesando…</> : <><Box size={14} /> Generar Modelo 3D</>}
          </button>

          {imgResult && imgStatus === "done" && <ModelResultCard output={imgResult} />}
        </div>
      )}

      {/* ═══ FÁBRICA ═════════════════════════════════════════════════════════ */}
      {tab === "factory" && (
        <div className="space-y-4">
          <div className="sc-form-card p-5">
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
              <Zap size={16} style={{ color: "var(--l-gold)" }} />
              <h3 style={{ margin: 0, fontSize: 14, fontWeight: 600, color: "var(--l-t)" }}>Fábrica de Personajes</h3>
              <div style={{ marginLeft: "auto", fontSize: 12, color: "var(--l-t3)" }}>{factoryDone}/{totalModels} completados</div>
            </div>
            <p style={{ fontSize: 12, color: "var(--l-t3)", margin: "0 0 12px" }}>
              Pipeline completo: imagen → Meshy image-to-3D → GLB guardado + auto-rig (si humanoid).
            </p>
            <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
              <div>
                <label style={{ fontSize: 11, color: "var(--l-t3)", marginRight: 6 }}>Estilo:</label>
                <select value={factoryArtStyle} onChange={e => setFactoryArtStyle(e.target.value)} style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 6, padding: "4px 8px", color: "var(--l-t)", fontSize: 12 }}>
                  {ART_STYLES.map(s => <option key={s.value} value={s.value} style={{ background: "#1a1a2e" }}>{s.label}</option>)}
                </select>
              </div>
              {factoryReady > 0 && (
                <button onClick={generateAllReady} style={{ padding: "6px 16px", borderRadius: 8, fontSize: 12, cursor: "pointer", background: "rgba(212,168,67,0.15)", border: "1px solid rgba(212,168,67,0.3)", color: "var(--l-gold)", fontWeight: 600 }}>
                  <Zap size={12} style={{ display: "inline", marginRight: 4 }} />
                  Generar todos ({factoryReady}) listos
                </button>
              )}
            </div>
          </div>

          {(["cartoon", "realistic"] as const).map(cat => (
            <div key={cat}>
              <div style={{ fontSize: 12, fontWeight: 600, color: "var(--l-t3)", marginBottom: 10, letterSpacing: "0.08em", textTransform: "uppercase" }}>
                {cat === "cartoon" ? "🎨 Cartoon / Pop-Culture" : "👤 Realista Humanoide"}
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: 12 }}>
                {factoryItems.filter(i => i.char.category === cat).map(item => (
                  <FactoryCard
                    key={item.char.id}
                    item={item}
                    onFileSelect={f => handleFactoryFile(item.char.id, f)}
                    onGenerate={() => generateCharacter(item.char.id)}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Sub-components ────────────────────────────────────────────────────────────

function StatPill({ label, value, color }: { label: string; value: string; color: "gold" | "jade" | "purple" }) {
  const colors = {
    gold:   { bg: "rgba(212,168,67,0.12)",  border: "rgba(212,168,67,0.3)",  text: "var(--l-gold)" },
    jade:   { bg: "rgba(100,220,160,0.12)", border: "rgba(100,220,160,0.3)", text: "var(--l-jade)" },
    purple: { bg: "rgba(160,100,220,0.12)", border: "rgba(160,100,220,0.3)", text: "#c084fc" },
  }[color];
  return (
    <div style={{ fontSize: 11, padding: "4px 10px", borderRadius: 20, background: colors.bg, border: `1px solid ${colors.border}`, color: colors.text, textAlign: "center" }}>
      <span style={{ fontWeight: 700 }}>{value}</span>
      <span style={{ marginLeft: 4, opacity: 0.75 }}>{label}</span>
    </div>
  );
}

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
  const inputRef = useRef<HTMLInputElement>(null);
  const { char: c, status, progress, error, thumbnailUrl, glbPath } = item;

  return (
    <div style={{
      border: `1px solid ${status === "done" ? "rgba(0,200,100,0.35)" : status === "error" ? "rgba(255,71,87,0.3)" : c.rigStatus === "rigged" ? "rgba(212,168,67,0.3)" : "rgba(255,255,255,0.08)"}`,
      borderRadius: 12, padding: 14, background: "rgba(255,255,255,0.02)",
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
        <span style={{ fontSize: 24 }}>{c.emoji}</span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: "var(--l-t)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{c.name}</div>
          <div style={{ fontSize: 10, color: "var(--l-t4)" }}>
            {c.rigStatus === "rigged" ? "✅ Ya rigged" : "⏳ Necesita regenerar"}
          </div>
        </div>
        {status === "done" && <CheckCircle2 size={14} style={{ color: "#00c864", flexShrink: 0 }} />}
        {status === "error" && <AlertCircle size={14} style={{ color: "#ff4757", flexShrink: 0 }} />}
        {status === "running" && <Loader2 size={14} className="animate-spin" style={{ color: "var(--l-gold)", flexShrink: 0 }} />}
      </div>

      {/* File upload / thumbnail */}
      {status === "done" && thumbnailUrl
        ? <img src={thumbnailUrl} alt={c.name} style={{ width: "100%", borderRadius: 8, marginBottom: 8, aspectRatio: "1", objectFit: "cover" }} />
        : (
          <div
            onClick={() => inputRef.current?.click()}
            style={{ border: "1px dashed rgba(255,255,255,0.12)", borderRadius: 8, padding: 12, textAlign: "center", cursor: "pointer", marginBottom: 8, background: "rgba(255,255,255,0.01)" }}
          >
            {item.preview
              ? <img src={item.preview} alt="ref" style={{ maxHeight: 80, margin: "0 auto", borderRadius: 6 }} />
              : <div style={{ fontSize: 10, color: "var(--l-t4)" }}><Upload size={16} style={{ margin: "0 auto 4px" }} /><br/>Imagen referencia</div>
            }
          </div>
        )
      }
      <input ref={inputRef} type="file" accept="image/*" style={{ display: "none" }} onChange={e => { const f = e.target.files?.[0]; if (f) onFileSelect(f); }} />

      {/* Progress bar */}
      {status === "running" && (
        <div style={{ height: 4, borderRadius: 2, background: "rgba(255,255,255,0.08)", overflow: "hidden", marginBottom: 8 }}>
          <div style={{ width: `${progress}%`, height: "100%", background: "var(--l-gold)", transition: "width 0.5s" }} />
        </div>
      )}

      {/* Error */}
      {status === "error" && error && (
        <div style={{ fontSize: 10, color: "#ff4757", marginBottom: 8, lineHeight: 1.4 }}>{error}</div>
      )}

      {/* Actions */}
      <div style={{ display: "flex", gap: 6 }}>
        {status === "done" && glbPath && (
          <a href={glbPath} download style={{ flex: 1, fontSize: 11, padding: "5px 0", borderRadius: 6, background: "rgba(0,200,100,0.1)", border: "1px solid rgba(0,200,100,0.25)", color: "#00c864", textAlign: "center", textDecoration: "none" }}>
            ⬇ GLB
          </a>
        )}
        {(status === "idle" || status === "error") && (
          <button
            onClick={onGenerate}
            disabled={!item.file}
            style={{ flex: 1, fontSize: 11, padding: "5px 0", borderRadius: 6, background: item.file ? "rgba(212,168,67,0.15)" : "rgba(255,255,255,0.04)", border: "1px solid", borderColor: item.file ? "rgba(212,168,67,0.3)" : "rgba(255,255,255,0.08)", color: item.file ? "var(--l-gold)" : "var(--l-t4)", cursor: item.file ? "pointer" : "not-allowed" }}
          >
            {item.file ? <><Cpu size={10} style={{ display: "inline", marginRight: 3 }} />Generar</> : "Subir imagen"}
          </button>
        )}
        {status === "running" && (
          <div style={{ flex: 1, fontSize: 11, padding: "5px 0", textAlign: "center", color: "var(--l-t4)" }}>
            <Loader2 size={11} className="animate-spin" style={{ display: "inline", marginRight: 3 }} />{progress}%
          </div>
        )}
      </div>
    </div>
  );
}
