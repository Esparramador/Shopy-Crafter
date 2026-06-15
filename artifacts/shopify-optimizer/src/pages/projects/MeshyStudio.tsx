import { useState, useRef, useCallback, useEffect } from "react";
import { useRoute } from "wouter";
import {
  Loader2, Upload, Box, Wand2, Image,
  CheckCircle2, AlertCircle, Zap, Film, Star, Lock, Cpu,
  Search, Download, FolderOpen, TriangleAlert, RefreshCw,
} from "lucide-react";
import ModelViewer3D from "@/components/ModelViewer3D";
import AnimationFlowPicker from "@/components/AnimationFlowPicker";
import { MESHY_CHARACTERS, RIGGED_CHARACTERS, ANIM_CATEGORIES, type MeshyCharacter } from "@/lib/meshyModels";

const API = import.meta.env.BASE_URL?.replace(/\/$/, "") ?? "";

type Tab = "viewer" | "flows" | "catalog" | "text" | "image" | "factory";
type GenStatus = "idle" | "running" | "done" | "error";

interface MeshyOutput {
  task_id: string;
  model_urls?: { glb?: string; fbx?: string; usdz?: string; obj?: string };
  thumbnail_url?: string;
  video_url?: string;
}

interface FactoryItem {
  char: MeshyCharacter;
  file?: File;
  preview?: string;
  status: "idle" | "running" | "done" | "error";
  progress: number;
  glbPath?: string;
  thumbnailUrl?: string;
  error?: string;
}

interface ApiClip {
  action_id: number;
  id: string;
  label: string;
  category: string;
  looping: boolean;
}

interface ApiCategory {
  id: string;
  label: string;
  icon: string;
  count: number;
}

interface CustomModel {
  url: string;
  name: string;
  isRigged: boolean | null;
  boneCount: number;
}

const ART_STYLES = [
  { value: "realistic", label: "🔬 Realista" },
  { value: "cartoon",   label: "🎨 Cartoon"  },
  { value: "low-poly",  label: "💎 Low-Poly"  },
  { value: "sculpture", label: "🗿 Escultura" },
];

function streamSSE(
  url: string, body: FormData | string, headers: Record<string, string>,
  onEvent: (e: any) => void, onDone: () => void
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
          if (line.startsWith("data: ")) { try { onEvent(JSON.parse(line.slice(6))); } catch {} }
        }
      }
    } catch (e: any) {
      if (e?.name !== "AbortError") onEvent({ event: "error", error: e?.message ?? "Stream error" });
    } finally { onDone(); }
  })();
  return () => ctrl.abort();
}

export default function MeshyStudio() {
  const [, params] = useRoute("/projects/:id/*");
  const projectId = params?.id;

  const [tab, setTab] = useState<Tab>("viewer");
  const [selectedChar, setSelectedChar] = useState<MeshyCharacter>(RIGGED_CHARACTERS[0]);
  const [catFilter, setCatFilter] = useState<"all" | "cartoon" | "realistic">("all");

  // ── Enhanced Viewer state ──────────────────────────────────────────────────
  const [selectedAnimPath, setSelectedAnimPath] = useState<string | null>(null);
  const [animSearch, setAnimSearch] = useState("");
  const [animCategory, setAnimCategory] = useState("all");
  const [apiClips, setApiClips] = useState<ApiClip[]>([]);
  const [apiCats, setApiCats] = useState<ApiCategory[]>([]);
  const [animsLoaded, setAnimsLoaded] = useState(false);
  const [customModel, setCustomModel] = useState<CustomModel | null>(null);
  const importRef = useRef<HTMLInputElement>(null);

  // ── Text-to-3D ─────────────────────────────────────────────────────────────
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

  // ── Image-to-3D ────────────────────────────────────────────────────────────
  const [imgFile, setImgFile]       = useState<File | null>(null);
  const [imgPreview, setImgPreview] = useState("");
  const [imgStatus, setImgStatus]   = useState<GenStatus>("idle");
  const [imgProgress, setImgProgress] = useState(0);
  const [imgResult, setImgResult]   = useState<MeshyOutput | null>(null);
  const [imgError, setImgError]     = useState("");
  const [imgLog, setImgLog]         = useState("");
  const imgRef = useRef<HTMLInputElement>(null);
  const stopImgRef = useRef<(() => void) | null>(null);

  // ── Factory ────────────────────────────────────────────────────────────────
  const [factoryItems, setFactoryItems] = useState<FactoryItem[]>(() =>
    MESHY_CHARACTERS.map(c => ({ char: c, status: "idle", progress: 0 }))
  );
  const [factoryArtStyle, setFactoryArtStyle] = useState("realistic");

  // ── Fetch API animations on mount ─────────────────────────────────────────
  useEffect(() => {
    fetch(`${API}/api/meshy/animations`, { credentials: "include" })
      .then(r => r.ok ? r.json() : null)
      .then(d => {
        if (d && d.clips) {
          setApiClips(d.clips);
          setApiCats(d.categories ?? []);
          setAnimsLoaded(true);
        }
      })
      .catch(() => {});
  }, []);

  // ── Custom model import ────────────────────────────────────────────────────
  const handleImportModel = useCallback((f: File) => {
    const url = URL.createObjectURL(f);
    setCustomModel({ url, name: f.name, isRigged: null, boneCount: 0 });
    setSelectedAnimPath(null);
  }, []);

  const handleRigStatus = useCallback((isRigged: boolean, boneCount: number) => {
    setCustomModel(prev => prev ? { ...prev, isRigged, boneCount } : null);
  }, []);

  // ── Text-to-3D handlers ────────────────────────────────────────────────────
  const generateText = useCallback(() => {
    if (!txtPrompt.trim()) return;
    stopTxtRef.current?.();
    setTxtStatus("running"); setTxtProgress(0); setTxtResult(null); setTxtError(""); setTxtLog("Iniciando…");
    const cancel = streamSSE(
      `${API}/api/meshy/text-to-3d`,
      JSON.stringify({ prompt: txtPrompt, negative_prompt: txtNeg, art_style: txtStyle }),
      { "Content-Type": "application/json" },
      (e) => {
        if (e.event === "started")  { setTxtPreviewTaskId(e.task_id); setTxtLog(`Task: ${e.task_id}`); }
        if (e.event === "progress") { setTxtProgress(e.progress ?? 0); setTxtLog(`Generando… ${e.progress ?? 0}%`); }
        if (e.event === "done")     { setTxtStatus("done"); setTxtResult(e.output); setTxtProgress(100); }
        if (e.event === "error")    { setTxtStatus("error"); setTxtError(e.error ?? "Error"); }
        if (e.event === "timeout")  { setTxtStatus("error"); setTxtError("Tiempo superado"); }
      },
      () => { if (txtStatus === "running") setTxtStatus("idle"); }
    );
    stopTxtRef.current = cancel;
  }, [txtPrompt, txtNeg, txtStyle]);

  const refineText = useCallback(() => {
    if (!txtPreviewTaskId) return;
    stopTxtRef.current?.();
    setTxtStatus("running"); setTxtProgress(0); setTxtLog("Refinando…");
    const cancel = streamSSE(
      `${API}/api/meshy/text-to-3d/refine`,
      JSON.stringify({ preview_task_id: txtPreviewTaskId, texture_richness: "high" }),
      { "Content-Type": "application/json" },
      (e) => {
        if (e.event === "progress") { setTxtProgress(e.progress ?? 0); setTxtLog(`Refinando… ${e.progress ?? 0}%`); }
        if (e.event === "done")     { setTxtStatus("done"); setTxtResult(e.output); setTxtProgress(100); }
        if (e.event === "error")    { setTxtStatus("error"); setTxtError(e.error ?? "Error"); }
      },
      () => {}
    );
    stopTxtRef.current = cancel;
  }, [txtPreviewTaskId]);

  // ── Image-to-3D ────────────────────────────────────────────────────────────
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
    setImgStatus("running"); setImgProgress(0); setImgResult(null); setImgError(""); setImgLog("Subiendo…");
    const fd = new FormData();
    fd.append("image", imgFile);
    fd.append("topology", "quad");
    const cancel = streamSSE(`${API}/api/meshy/image-to-3d`, fd, {},
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

  // ── Factory ────────────────────────────────────────────────────────────────
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
    streamSSE(`${API}/api/meshy/generate-character`, fd, {},
      (e) => {
        if (e.event === "progress") {
          setFactoryItems(prev => prev.map(i =>
            i.char.id === charId ? { ...i, progress: e.progress ?? i.progress } : i
          ));
        } else if (e.event === "done") {
          setFactoryItems(prev => prev.map(i =>
            i.char.id === charId ? { ...i, status: "done", progress: 100, glbPath: e.glb_path, thumbnailUrl: e.thumbnail_url } : i
          ));
        } else if (e.event === "error") {
          setFactoryItems(prev => prev.map(i =>
            i.char.id === charId ? { ...i, status: "error", error: e.error ?? "Error" } : i
          ));
        }
      },
      () => {}
    );
  }, [factoryItems, factoryArtStyle]);

  // ── Derived ────────────────────────────────────────────────────────────────
  const riggedCount  = RIGGED_CHARACTERS.length;
  const totalModels  = MESHY_CHARACTERS.length;
  const factoryDone  = factoryItems.filter(i => i.status === "done").length;
  const factoryReady = factoryItems.filter(i => i.file && i.status === "idle").length;
  const totalAnims   = animsLoaded ? apiClips.length : 134;

  const filteredChars = catFilter === "all" ? MESHY_CHARACTERS
    : MESHY_CHARACTERS.filter(c => c.category === catFilter);

  const activeGlbPath   = customModel?.url ?? selectedChar.glbPath;
  const activeModelName = customModel
    ? `📁 ${customModel.name}`
    : `${selectedChar.emoji} ${selectedChar.name}`;

  const browserAnims = customModel
    ? apiClips.map(c => ({
        id: c.id, label: c.label, category: c.category, looping: c.looping, action_id: c.action_id,
        glbPath: `/assets/3d/animations/alec_monopoly/${c.id}.glb`,
      }))
    : selectedChar.animations
        .filter(a => a.name !== "rigged")
        .map(a => {
          const meta = apiClips.find(c => c.id === a.name);
          return { id: a.name, label: a.label, category: meta?.category ?? "general", looping: a.looping ?? true, glbPath: a.glbPath, action_id: meta?.action_id ?? 0 };
        });

  const filteredClips = browserAnims.filter(c => {
    const matchCat = animCategory === "all" || c.category === animCategory;
    const q = animSearch.toLowerCase();
    const matchSearch = !q || c.label.toLowerCase().includes(q) || c.id.toLowerCase().includes(q) || c.category.includes(q);
    return matchCat && matchSearch;
  });

  const tabs: { id: Tab; label: string; icon: string; badge?: string }[] = [
    { id: "viewer",  label: "Studio 3D",     icon: "🎮", badge: `${riggedCount} modelos` },
    { id: "flows",   label: "Animaciones",   icon: "💃", badge: `${totalAnims} clips` },
    { id: "catalog", label: "Catálogo",      icon: "🎭" },
    { id: "text",    label: "Texto → 3D",    icon: "✏️" },
    { id: "image",   label: "Imagen → 3D",   icon: "📷" },
    { id: "factory", label: "Fábrica",        icon: "🏭", badge: `${factoryDone}/${totalModels}` },
  ];

  return (
    <div style={{ padding: "20px 24px", maxWidth: 1400, margin: "0 auto" }}>

      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
        <div style={{ fontSize: 28 }}>🧊</div>
        <div>
          <h1 style={{ margin: 0, fontSize: 20, fontWeight: 700, color: "var(--l-t)" }}>Meshy Studio — Character Lab</h1>
          <p style={{ margin: 0, fontSize: 12, color: "var(--l-t3)" }}>
            {riggedCount} personajes rigged · {totalAnims} animaciones · {totalModels} modelos · sin créditos para animar
          </p>
        </div>
        <div style={{ marginLeft: "auto", display: "flex", gap: 8 }}>
          <StatPill label="GLBs"      value={`${totalModels}`}  color="gold"   />
          <StatPill label="Rigged"    value={`${riggedCount}`}  color="jade"   />
          <StatPill label="Anims"     value={`${totalAnims}`}   color="purple" />
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: "flex", gap: 2, marginBottom: 20, borderBottom: "1px solid rgba(255,255,255,0.07)" }}>
        {tabs.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)} style={{
            padding: "8px 14px", border: "none", cursor: "pointer", borderRadius: "6px 6px 0 0",
            fontSize: 12, fontWeight: tab === t.id ? 600 : 400, display: "flex", alignItems: "center", gap: 5,
            background: tab === t.id ? "rgba(212,168,67,0.15)" : "transparent",
            color: tab === t.id ? "var(--l-gold)" : "var(--l-t3)",
            borderBottom: tab === t.id ? "2px solid var(--l-gold)" : "2px solid transparent",
          }}>
            {t.icon} {t.label}
            {t.badge && <span style={{ fontSize: 10, padding: "1px 6px", borderRadius: 10, background: "rgba(212,168,67,0.15)", color: "var(--l-gold)" }}>{t.badge}</span>}
          </button>
        ))}
      </div>

      {/* ═══ STUDIO 3D VIEWER ══════════════════════════════════════════════════ */}
      {tab === "viewer" && (
        <div style={{ display: "grid", gridTemplateColumns: "210px 1fr 290px", gap: 14 }}>

          {/* LEFT: Model Selector */}
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: "var(--l-t4)", letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 4 }}>
              Modelos Rigged
            </div>

            {RIGGED_CHARACTERS.map(c => (
              <button key={c.id} onClick={() => { setSelectedChar(c); setCustomModel(null); setSelectedAnimPath(null); }} style={{
                padding: "8px 10px", border: "1px solid", borderRadius: 8, cursor: "pointer",
                textAlign: "left", display: "flex", alignItems: "center", gap: 8, transition: "all 0.12s",
                borderColor: !customModel && selectedChar.id === c.id ? "var(--l-gold)" : "rgba(255,255,255,0.07)",
                background: !customModel && selectedChar.id === c.id ? "rgba(212,168,67,0.08)" : "rgba(255,255,255,0.02)",
              }}>
                <span style={{ fontSize: 20 }}>{c.emoji}</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 11, fontWeight: 600, color: "var(--l-t)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{c.name}</div>
                  <div style={{ fontSize: 9, color: "var(--l-t4)" }}>✅ {c.animations.length} anim.</div>
                </div>
              </button>
            ))}

            {/* Separator */}
            <div style={{ borderTop: "1px solid rgba(255,255,255,0.06)", margin: "4px 0" }} />

            {/* Import custom model */}
            <div style={{ padding: "10px", borderRadius: 9, background: "rgba(255,255,255,0.02)", border: "1px dashed rgba(212,168,67,0.25)" }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: "var(--l-t4)", marginBottom: 6, letterSpacing: "0.06em" }}>IMPORTAR MODELO</div>
              <button
                onClick={() => importRef.current?.click()}
                style={{
                  width: "100%", padding: "8px", borderRadius: 7, border: "1px solid rgba(212,168,67,0.3)",
                  background: customModel ? "rgba(212,168,67,0.1)" : "rgba(255,255,255,0.03)",
                  color: "var(--l-gold)", fontSize: 11, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 5,
                }}
              >
                <FolderOpen size={12} />
                {customModel ? customModel.name.slice(0, 16) + "…" : "GLB / GLTF"}
              </button>
              <input
                ref={importRef}
                type="file"
                accept=".glb,.gltf"
                style={{ display: "none" }}
                onChange={e => { const f = e.target.files?.[0]; if (f) handleImportModel(f); e.target.value = ""; }}
              />
              {customModel && (
                <div style={{ marginTop: 6 }}>
                  {customModel.isRigged === null && (
                    <div style={{ fontSize: 9, color: "var(--l-t4)" }}>Detectando esqueleto…</div>
                  )}
                  {customModel.isRigged === true && (
                    <div style={{ fontSize: 9, color: "#00c864" }}>✅ Rigged ({customModel.boneCount} huesos)</div>
                  )}
                  {customModel.isRigged === false && (
                    <div style={{ fontSize: 9, color: "#f59e0b", lineHeight: 1.4, marginTop: 2 }}>
                      ⚠ Sin esqueleto. Las animaciones requieren rig.<br />
                      <span style={{ color: "var(--l-t4)" }}>Genera rig en "Fábrica" o usa Text→3D con A-pose.</span>
                    </div>
                  )}
                  <button
                    onClick={() => { setCustomModel(null); setSelectedAnimPath(null); }}
                    style={{ marginTop: 5, fontSize: 9, color: "var(--l-t4)", background: "none", border: "none", cursor: "pointer", textDecoration: "underline", padding: 0 }}
                  >
                    Quitar modelo
                  </button>
                </div>
              )}
              <div style={{ fontSize: 9, color: "var(--l-t4)", marginTop: 6, lineHeight: 1.5 }}>
                FBX/STL/OBJ: convierte primero a GLB con Blender o Meshy.
              </div>
            </div>

            {/* Unrigged models info */}
            <div style={{ padding: "8px 10px", borderRadius: 8, background: "rgba(255,255,255,0.01)", border: "1px solid rgba(255,255,255,0.05)" }}>
              <div style={{ fontSize: 9, fontWeight: 700, color: "var(--l-t4)", marginBottom: 4 }}>SIN RIG ({MESHY_CHARACTERS.length - riggedCount})</div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 2 }}>
                {MESHY_CHARACTERS.filter(c => c.rigStatus === "pending").map(c => (
                  <span key={c.id} style={{ fontSize: 13 }} title={c.name}>{c.emoji}</span>
                ))}
              </div>
              <div style={{ fontSize: 9, color: "var(--l-t4)", marginTop: 4, lineHeight: 1.4 }}>
                Usa Fábrica → A-pose para auto-rig.
              </div>
            </div>
          </div>

          {/* CENTER: 3D Viewer */}
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <ModelViewer3D
              glbPath={activeGlbPath}
              characterName={activeModelName}
              overrideAnimPath={selectedAnimPath}
              hideAnimPills={true}
              onRigStatus={customModel ? handleRigStatus : undefined}
              height={460}
              autoRotate={!selectedAnimPath}
            />

            {/* Model info bar */}
            <div style={{ padding: "10px 14px", borderRadius: 9, background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)", display: "flex", gap: 10, alignItems: "center" }}>
              <span style={{ fontSize: 28 }}>{customModel ? "📁" : selectedChar.emoji}</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: "var(--l-t)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {customModel ? customModel.name : selectedChar.name}
                </div>
                <div style={{ fontSize: 11, color: "var(--l-t3)", marginTop: 1 }}>
                  {selectedAnimPath
                    ? `▶ ${selectedAnimPath.split("/").pop()?.replace(".glb", "")}`
                    : "Pose base · sin animación"}
                </div>
              </div>
              <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                {selectedAnimPath && (
                  <button
                    onClick={() => setSelectedAnimPath(null)}
                    style={{ fontSize: 10, padding: "4px 10px", borderRadius: 14, background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", color: "var(--l-t3)", cursor: "pointer" }}
                  >
                    ⏹ Pose base
                  </button>
                )}
                {!customModel && (
                  <a
                    href={selectedChar.glbPath}
                    download
                    style={{ fontSize: 10, padding: "4px 10px", borderRadius: 14, background: "rgba(212,168,67,0.1)", border: "1px solid rgba(212,168,67,0.3)", color: "var(--l-gold)", textDecoration: "none", display: "flex", alignItems: "center", gap: 4 }}
                  >
                    <Download size={10} /> GLB
                  </a>
                )}
                {!customModel && (
                  <span style={{ fontSize: 9, padding: "3px 9px", borderRadius: 12, background: "rgba(0,200,100,0.1)", color: "#00c864", border: "1px solid rgba(0,200,100,0.2)" }}>
                    ✅ Rigged
                  </span>
                )}
              </div>
            </div>

            {/* Free animations notice */}
            <div style={{ padding: "8px 12px", borderRadius: 8, background: "rgba(212,168,67,0.05)", border: "1px solid rgba(212,168,67,0.15)", display: "flex", alignItems: "center", gap: 8 }}>
              <Zap size={12} style={{ color: "var(--l-gold)", flexShrink: 0 }} />
              <span style={{ fontSize: 10, color: "var(--l-t3)", lineHeight: 1.5 }}>
                <strong style={{ color: "var(--l-gold)" }}>{totalAnims} animaciones sin coste</strong> — GLBs descargados localmente.
                Aplica cualquiera a cualquier modelo rigged humanoid. Solo cambias el mesh, la animación es la misma.
              </span>
            </div>
          </div>

          {/* RIGHT: Animation Browser */}
          <div style={{ display: "flex", flexDirection: "column", gap: 8, height: 580 }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: "var(--l-t4)", letterSpacing: "0.08em", textTransform: "uppercase" }}>
              Librería de Animaciones
            </div>

            {/* Search */}
            <div style={{ position: "relative" }}>
              <Search size={12} style={{ position: "absolute", left: 9, top: "50%", transform: "translateY(-50%)", color: "var(--l-t4)" }} />
              <input
                value={animSearch}
                onChange={e => setAnimSearch(e.target.value)}
                placeholder="Buscar animación…"
                style={{
                  width: "100%", padding: "7px 9px 7px 27px", borderRadius: 8,
                  background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)",
                  color: "var(--l-t)", fontSize: 11, boxSizing: "border-box",
                }}
              />
            </div>

            {/* Category filter */}
            <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
              <button
                onClick={() => setAnimCategory("all")}
                style={{
                  padding: "3px 9px", borderRadius: 12, fontSize: 10, cursor: "pointer", border: "1px solid",
                  borderColor: animCategory === "all" ? "var(--l-gold)" : "rgba(255,255,255,0.1)",
                  background: animCategory === "all" ? "rgba(212,168,67,0.15)" : "transparent",
                  color: animCategory === "all" ? "var(--l-gold)" : "var(--l-t4)",
                }}
              >
                Todas ({browserAnims.length})
              </button>
              {ANIM_CATEGORIES.map(cat => {
                const count = browserAnims.filter(c => c.category === cat.id).length;
                return (
                  <button
                    key={cat.id}
                    onClick={() => setAnimCategory(cat.id)}
                    style={{
                      padding: "3px 9px", borderRadius: 12, fontSize: 10, cursor: "pointer", border: "1px solid",
                      borderColor: animCategory === cat.id ? "var(--l-gold)" : "rgba(255,255,255,0.1)",
                      background: animCategory === cat.id ? "rgba(212,168,67,0.15)" : "transparent",
                      color: animCategory === cat.id ? "var(--l-gold)" : "var(--l-t4)",
                    }}
                  >
                    {cat.label} {count > 0 ? `(${count})` : ""}
                  </button>
                );
              })}
            </div>

            {/* Rigging warning for custom model */}
            {customModel && customModel.isRigged === false && (
              <div style={{ padding: "8px 10px", borderRadius: 8, background: "rgba(245,158,11,0.08)", border: "1px solid rgba(245,158,11,0.3)", display: "flex", gap: 7, alignItems: "flex-start" }}>
                <TriangleAlert size={12} style={{ color: "#f59e0b", flexShrink: 0, marginTop: 1 }} />
                <span style={{ fontSize: 10, color: "#f59e0b", lineHeight: 1.5 }}>
                  Modelo sin esqueleto. Las animaciones no funcionarán. Genera rig con Meshy desde la pestaña Fábrica o texto→3D con A-pose.
                </span>
              </div>
            )}

            {/* Loading state */}
            {!animsLoaded && (
              <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "12px", color: "var(--l-t4)", fontSize: 11 }}>
                <RefreshCw size={12} className="animate-spin" />
                Cargando catálogo de animaciones…
              </div>
            )}

            {/* Animation list */}
            <div style={{ flex: 1, overflowY: "auto", display: "flex", flexDirection: "column", gap: 3 }}>
              {/* Pose base option */}
              <button
                onClick={() => setSelectedAnimPath(null)}
                style={{
                  padding: "8px 10px", borderRadius: 8, border: "1px solid", cursor: "pointer", textAlign: "left",
                  borderColor: selectedAnimPath === null ? "var(--l-gold)" : "rgba(255,255,255,0.07)",
                  background: selectedAnimPath === null ? "rgba(212,168,67,0.1)" : "rgba(255,255,255,0.02)",
                  display: "flex", alignItems: "center", gap: 8,
                }}
              >
                <span style={{ fontSize: 14 }}>🧍</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 11, fontWeight: 600, color: selectedAnimPath === null ? "var(--l-gold)" : "var(--l-t)" }}>Pose base</div>
                  <div style={{ fontSize: 9, color: "var(--l-t4)" }}>Sin animación · estático</div>
                </div>
                {selectedAnimPath === null && <span style={{ fontSize: 9, color: "var(--l-gold)" }}>▶</span>}
              </button>

              {filteredClips.map(clip => {
                const animPath = clip.glbPath;
                const isActive = selectedAnimPath === animPath;
                return (
                  <button
                    key={clip.id}
                    onClick={() => setSelectedAnimPath(animPath)}
                    style={{
                      padding: "8px 10px", borderRadius: 8, border: "1px solid", cursor: "pointer", textAlign: "left",
                      borderColor: isActive ? "var(--l-gold)" : "rgba(255,255,255,0.06)",
                      background: isActive ? "rgba(212,168,67,0.1)" : "rgba(255,255,255,0.01)",
                      display: "flex", alignItems: "center", gap: 8, transition: "all 0.1s",
                    }}
                  >
                    <div style={{
                      width: 28, height: 28, borderRadius: 6, flexShrink: 0,
                      background: isActive ? "rgba(212,168,67,0.2)" : "rgba(255,255,255,0.04)",
                      border: `1px solid ${isActive ? "rgba(212,168,67,0.4)" : "rgba(255,255,255,0.08)"}`,
                      display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13,
                    }}>
                      {isActive ? "▶" : clip.label.split(" ")[0]}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{
                        fontSize: 11, fontWeight: isActive ? 600 : 400,
                        color: isActive ? "var(--l-gold)" : "var(--l-t)",
                        overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                      }}>
                        {clip.label.replace(/^[^\s]+\s/, "")}
                      </div>
                      <div style={{ fontSize: 9, color: "var(--l-t4)", display: "flex", gap: 5, marginTop: 1 }}>
                        <span>#{clip.action_id}</span>
                        <span>·</span>
                        <span>{clip.category}</span>
                        <span>·</span>
                        <span style={{ color: clip.looping ? "#60a5fa" : "#a78bfa" }}>{clip.looping ? "🔄 loop" : "▶ once"}</span>
                      </div>
                    </div>
                  </button>
                );
              })}

              {animsLoaded && filteredClips.length === 0 && (
                <div style={{ textAlign: "center", padding: "20px", color: "var(--l-t4)", fontSize: 11 }}>
                  Sin resultados para "{animSearch}"
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ═══ FLUJOS / ANIMACIONES ════════════════════════════════════════ */}
      {tab === "flows" && <AnimationFlowPicker />}

      {/* ═══ CATÁLOGO ════════════════════════════════════════════════════ */}
      {tab === "catalog" && (
        <div>
          <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
            {(["all", "cartoon", "realistic"] as const).map(c => (
              <button key={c} onClick={() => setCatFilter(c)} style={{
                padding: "5px 13px", borderRadius: 20, fontSize: 11, cursor: "pointer", border: "1px solid",
                borderColor: catFilter === c ? "var(--l-gold)" : "rgba(255,255,255,0.1)",
                background: catFilter === c ? "rgba(212,168,67,0.15)" : "transparent",
                color: catFilter === c ? "var(--l-gold)" : "var(--l-t3)",
              }}>
                {c === "all" ? `Todos (${MESHY_CHARACTERS.length})` : c === "cartoon" ? `🎨 Cartoon (${MESHY_CHARACTERS.filter(x => x.category === "cartoon").length})` : `👤 Realista (${MESHY_CHARACTERS.filter(x => x.category === "realistic").length})`}
              </button>
            ))}
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(135px, 1fr))", gap: 10 }}>
            {filteredChars.map(c => (
              <div key={c.id} onClick={() => { setSelectedChar(c); setTab(c.rigStatus === "rigged" ? "viewer" : "factory"); }}
                style={{ padding: 12, borderRadius: 12, cursor: "pointer", textAlign: "center", transition: "all 0.14s",
                  border: `2px solid ${c.rigStatus === "rigged" ? "rgba(0,200,100,0.4)" : "rgba(255,255,255,0.07)"}`,
                  background: "rgba(255,255,255,0.02)", position: "relative" }}>
                <div style={{ position: "absolute", top: 6, right: 6 }}>
                  {c.rigStatus === "rigged" ? <CheckCircle2 size={12} style={{ color: "#00c864" }} /> : <Lock size={10} style={{ color: "var(--l-t4)" }} />}
                </div>
                <div style={{ fontSize: 32, marginBottom: 5 }}>{c.emoji}</div>
                <div style={{ fontSize: 11, fontWeight: 600, color: "var(--l-t)", lineHeight: 1.3 }}>{c.name}</div>
                <div style={{ fontSize: 9, color: "var(--l-t4)", marginTop: 2 }}>
                  {c.rigStatus === "rigged" ? `✨ ${c.animations.length} anim.` : "⏳ Sin rig"}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ═══ TEXTO → 3D ══════════════════════════════════════════════════ */}
      {tab === "text" && (
        <div className="sc-form-card p-5 space-y-4" style={{ maxWidth: 640 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
            <Wand2 size={15} style={{ color: "var(--l-gold)" }} />
            <h3 style={{ margin: 0, fontSize: 13, fontWeight: 600, color: "var(--l-t)" }}>Texto → Modelo 3D</h3>
          </div>
          <p style={{ fontSize: 11, color: "var(--l-t3)", margin: 0 }}>Genera desde un prompt. Para rigging usa A-pose. Ve a Animaciones → Prompts IA para plantillas.</p>
          <div>
            <label style={{ fontSize: 11, color: "var(--l-t3)", display: "block", marginBottom: 3 }}>Prompt *</label>
            <textarea value={txtPrompt} onChange={e => setTxtPrompt(e.target.value)} rows={3}
              placeholder="Ej: full body humanoid character, A-pose, realistic proportions, professional look..."
              style={{ width: "100%", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8, padding: "7px 11px", color: "var(--l-t)", fontSize: 12, resize: "vertical", boxSizing: "border-box" }} />
          </div>
          <div>
            <label style={{ fontSize: 11, color: "var(--l-t3)", display: "block", marginBottom: 3 }}>Negative</label>
            <input value={txtNeg} onChange={e => setTxtNeg(e.target.value)} placeholder="deformed, merged limbs, floating accessories..."
              style={{ width: "100%", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8, padding: "7px 11px", color: "var(--l-t)", fontSize: 12, boxSizing: "border-box" }} />
          </div>
          <div style={{ display: "flex", gap: 5, flexWrap: "wrap" }}>
            {ART_STYLES.map(s => (
              <button key={s.value} onClick={() => setTxtStyle(s.value)} style={{
                padding: "4px 11px", borderRadius: 20, fontSize: 11, cursor: "pointer", border: "1px solid",
                borderColor: txtStyle === s.value ? "var(--l-gold)" : "rgba(255,255,255,0.1)",
                background: txtStyle === s.value ? "rgba(212,168,67,0.15)" : "transparent",
                color: txtStyle === s.value ? "var(--l-gold)" : "var(--l-t3)",
              }}>{s.label}</button>
            ))}
          </div>
          {txtStatus === "running" && (
            <div>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 5, fontSize: 11, color: "var(--l-t3)" }}>
                <span>{txtLog}</span><span>{txtProgress}%</span>
              </div>
              <div style={{ height: 5, borderRadius: 3, background: "rgba(255,255,255,0.08)", overflow: "hidden" }}>
                <div style={{ width: `${txtProgress}%`, height: "100%", background: "var(--l-gold)", transition: "width 0.5s" }} />
              </div>
            </div>
          )}
          {txtStatus === "error" && <ErrBox msg={txtError} />}
          <div style={{ display: "flex", gap: 7 }}>
            <button onClick={generateText} disabled={!txtPrompt.trim() || txtStatus === "running"} className="sc-form-button"
              style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 5, opacity: !txtPrompt.trim() ? 0.5 : 1 }}>
              {txtStatus === "running" ? <><Loader2 size={13} className="animate-spin" />Generando…</> : <><Wand2 size={13} />Generar Preview</>}
            </button>
            {txtPreviewTaskId && txtStatus !== "running" && (
              <button onClick={refineText} style={{ padding: "0 14px", borderRadius: 8, border: "1px solid rgba(212,168,67,0.4)", background: "rgba(212,168,67,0.1)", color: "var(--l-gold)", fontSize: 12, cursor: "pointer" }}>
                <Star size={12} style={{ marginRight: 4, display: "inline" }} />Refinar
              </button>
            )}
          </div>
          {txtResult && txtStatus === "done" && <ModelResultCard output={txtResult} />}
        </div>
      )}

      {/* ═══ IMAGEN → 3D ═════════════════════════════════════════════════ */}
      {tab === "image" && (
        <div className="sc-form-card p-5 space-y-4" style={{ maxWidth: 600 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
            <Image size={15} style={{ color: "var(--l-jade)" }} />
            <h3 style={{ margin: 0, fontSize: 13, fontWeight: 600, color: "var(--l-t)" }}>Imagen → Modelo 3D</h3>
          </div>
          <p style={{ fontSize: 11, color: "var(--l-t3)", margin: 0 }}>Sube una foto → Meshy genera GLB (~4min) con meshy-6.</p>
          <div onClick={() => imgRef.current?.click()} style={{ border: "2px dashed rgba(100,220,160,0.3)", borderRadius: 11, padding: 22, textAlign: "center", cursor: "pointer", background: "rgba(100,220,160,0.03)" }}>
            {imgPreview
              ? <img src={imgPreview} alt="preview" style={{ maxHeight: 180, margin: "0 auto", borderRadius: 7, objectFit: "contain" }} />
              : <><Upload size={26} style={{ color: "var(--l-jade)", margin: "0 auto 7px" }} /><p style={{ fontSize: 12, color: "var(--l-t3)", margin: 0 }}>Clic o arrastra imagen</p><p style={{ fontSize: 10, color: "var(--l-t4)", marginTop: 3 }}>PNG, JPG, WEBP · máx 30MB</p></>
            }
          </div>
          <input ref={imgRef} type="file" accept="image/*" style={{ display: "none" }} onChange={e => { const f = e.target.files?.[0]; if (f) handleImgFile(f); }} />
          {imgStatus === "running" && (
            <div>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 5, fontSize: 11, color: "var(--l-t3)" }}>
                <span>{imgLog}</span><span>{imgProgress}%</span>
              </div>
              <div style={{ height: 5, borderRadius: 3, background: "rgba(255,255,255,0.08)", overflow: "hidden" }}>
                <div style={{ width: `${imgProgress}%`, height: "100%", background: "var(--l-jade)", transition: "width 0.5s" }} />
              </div>
            </div>
          )}
          {imgStatus === "error" && <ErrBox msg={imgError} />}
          <button onClick={generateImage} disabled={!imgFile || imgStatus === "running"} className="sc-form-button"
            style={{ width: "100%", display: "flex", alignItems: "center", justifyContent: "center", gap: 5, background: "var(--l-jade)", opacity: !imgFile ? 0.5 : 1 }}>
            {imgStatus === "running" ? <><Loader2 size={13} className="animate-spin" />Procesando…</> : <><Box size={13} />Generar Modelo 3D</>}
          </button>
          {imgResult && imgStatus === "done" && <ModelResultCard output={imgResult} />}
        </div>
      )}

      {/* ═══ FÁBRICA ═════════════════════════════════════════════════════ */}
      {tab === "factory" && (
        <div className="space-y-4">
          <div className="sc-form-card p-5">
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 7 }}>
              <Zap size={15} style={{ color: "var(--l-gold)" }} />
              <h3 style={{ margin: 0, fontSize: 13, fontWeight: 600 }}>Fábrica de Personajes</h3>
              <span style={{ marginLeft: "auto", fontSize: 11, color: "var(--l-t3)" }}>{factoryDone}/{totalModels} completados</span>
            </div>
            <p style={{ fontSize: 11, color: "var(--l-t3)", margin: "0 0 10px" }}>Pipeline: imagen → GLB + auto-rig. Usa los prompts de la tab Animaciones para generar personajes riggables.</p>
            <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
              <div>
                <select value={factoryArtStyle} onChange={e => setFactoryArtStyle(e.target.value)} style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 6, padding: "4px 8px", color: "var(--l-t)", fontSize: 11 }}>
                  {ART_STYLES.map(s => <option key={s.value} value={s.value} style={{ background: "#1a1a2e" }}>{s.label}</option>)}
                </select>
              </div>
              {factoryReady > 0 && (
                <button onClick={() => factoryItems.filter(i => i.file && i.status === "idle").forEach(i => generateCharacter(i.char.id))} style={{ padding: "5px 14px", borderRadius: 7, fontSize: 11, cursor: "pointer", background: "rgba(212,168,67,0.15)", border: "1px solid rgba(212,168,67,0.3)", color: "var(--l-gold)", fontWeight: 600 }}>
                  <Zap size={11} style={{ display: "inline", marginRight: 3 }} />Generar todos ({factoryReady})
                </button>
              )}
            </div>
          </div>
          {(["cartoon", "realistic"] as const).map(cat => (
            <div key={cat}>
              <div style={{ fontSize: 11, fontWeight: 600, color: "var(--l-t3)", marginBottom: 8, letterSpacing: "0.07em", textTransform: "uppercase" }}>
                {cat === "cartoon" ? "🎨 Cartoon / Pop-Culture" : "👤 Realista Humanoide"}
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(195px, 1fr))", gap: 10 }}>
                {factoryItems.filter(i => i.char.category === cat).map(item => (
                  <FactoryCard key={item.char.id} item={item}
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
  const c = { gold: ["rgba(212,168,67,0.12)","rgba(212,168,67,0.3)","var(--l-gold)"], jade: ["rgba(100,220,160,0.12)","rgba(100,220,160,0.3)","var(--l-jade)"], purple: ["rgba(160,100,220,0.12)","rgba(160,100,220,0.3)","#c084fc"] }[color];
  return (
    <div style={{ fontSize: 10, padding: "4px 9px", borderRadius: 18, background: c[0], border: `1px solid ${c[1]}`, color: c[2] }}>
      <span style={{ fontWeight: 700 }}>{value}</span>
      <span style={{ marginLeft: 4, opacity: 0.75 }}>{label}</span>
    </div>
  );
}

function ErrBox({ msg }: { msg: string }) {
  return (
    <div style={{ padding: "9px 11px", borderRadius: 7, background: "rgba(255,71,87,0.08)", border: "1px solid rgba(255,71,87,0.2)", color: "#ff4757", fontSize: 11 }}>
      <AlertCircle size={12} style={{ display: "inline", marginRight: 5 }} />{msg}
    </div>
  );
}

function ModelResultCard({ output }: { output: MeshyOutput }) {
  const urls = output.model_urls ?? {};
  return (
    <div style={{ border: "1px solid rgba(0,200,100,0.3)", borderRadius: 9, padding: 11, background: "rgba(0,200,100,0.04)" }}>
      <div style={{ display: "flex", gap: 9, marginBottom: 7 }}>
        {output.thumbnail_url && <img src={output.thumbnail_url} alt="thumb" style={{ width: 72, height: 72, borderRadius: 7, objectFit: "cover", border: "1px solid rgba(255,255,255,0.1)" }} />}
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: "#00c864", marginBottom: 3 }}>✅ Modelo generado</div>
          <div style={{ fontSize: 10, color: "var(--l-t4)" }}>Task: {output.task_id}</div>
          <div style={{ display: "flex", gap: 5, marginTop: 7, flexWrap: "wrap" }}>
            {urls.glb  && <a href={urls.glb}  target="_blank" rel="noreferrer" style={{ fontSize: 10, padding: "2px 9px", borderRadius: 5, background: "rgba(212,168,67,0.15)", color: "var(--l-gold)", textDecoration: "none" }}>⬇ GLB</a>}
            {urls.fbx  && <a href={urls.fbx}  target="_blank" rel="noreferrer" style={{ fontSize: 10, padding: "2px 9px", borderRadius: 5, background: "rgba(255,255,255,0.06)", color: "var(--l-t3)", textDecoration: "none" }}>⬇ FBX</a>}
            {urls.usdz && <a href={urls.usdz} target="_blank" rel="noreferrer" style={{ fontSize: 10, padding: "2px 9px", borderRadius: 5, background: "rgba(255,255,255,0.06)", color: "var(--l-t3)", textDecoration: "none" }}>⬇ USDZ</a>}
          </div>
        </div>
      </div>
      {output.video_url && <video src={output.video_url} autoPlay loop muted playsInline style={{ width: "100%", borderRadius: 7, maxHeight: 180 }} />}
    </div>
  );
}

function FactoryCard({ item, onFileSelect, onGenerate }: {
  item: FactoryItem; onFileSelect: (f: File) => void; onGenerate: () => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const { char: c, status, progress, error, thumbnailUrl, glbPath } = item;
  return (
    <div style={{
      border: `1px solid ${status === "done" ? "rgba(0,200,100,0.3)" : status === "error" ? "rgba(255,71,87,0.25)" : c.rigStatus === "rigged" ? "rgba(212,168,67,0.25)" : "rgba(255,255,255,0.07)"}`,
      borderRadius: 11, padding: 12, background: "rgba(255,255,255,0.02)",
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 8 }}>
        <span style={{ fontSize: 22 }}>{c.emoji}</span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: "var(--l-t)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{c.name}</div>
          <div style={{ fontSize: 9, color: "var(--l-t4)" }}>{c.rigStatus === "rigged" ? "✅ Ya rigged" : "⏳ Regenerar en A-pose"}</div>
        </div>
      </div>
      {status === "done" && thumbnailUrl && (
        <img src={thumbnailUrl} alt="" style={{ width: "100%", height: 100, objectFit: "cover", borderRadius: 7, marginBottom: 7, border: "1px solid rgba(0,200,100,0.2)" }} />
      )}
      {status === "running" && (
        <div style={{ marginBottom: 8 }}>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10, color: "var(--l-t3)", marginBottom: 3 }}>
            <span><Cpu size={10} style={{ display: "inline", marginRight: 3 }} />Generando…</span>
            <span>{progress}%</span>
          </div>
          <div style={{ height: 4, borderRadius: 2, background: "rgba(255,255,255,0.08)", overflow: "hidden" }}>
            <div style={{ width: `${progress}%`, height: "100%", background: "var(--l-gold)", transition: "width 0.5s" }} />
          </div>
        </div>
      )}
      {status === "error" && error && (
        <div style={{ fontSize: 10, color: "#ff4757", marginBottom: 7, background: "rgba(255,71,87,0.08)", padding: "4px 7px", borderRadius: 5, border: "1px solid rgba(255,71,87,0.2)" }}>
          {error.slice(0, 80)}
        </div>
      )}
      {status !== "running" && status !== "done" && (
        <>
          <div onClick={() => inputRef.current?.click()}
            style={{ border: "1px dashed rgba(255,255,255,0.12)", borderRadius: 7, padding: "10px 8px", textAlign: "center", cursor: "pointer", background: item.preview ? "none" : "rgba(255,255,255,0.02)", marginBottom: 7 }}>
            {item.preview
              ? <img src={item.preview} alt="" style={{ maxHeight: 70, margin: "0 auto", borderRadius: 5, objectFit: "contain" }} />
              : <><Upload size={14} style={{ color: "var(--l-t4)", margin: "0 auto 3px" }} /><p style={{ fontSize: 9, color: "var(--l-t4)", margin: 0 }}>Foto del personaje</p></>
            }
          </div>
          <input ref={inputRef} type="file" accept="image/*" style={{ display: "none" }} onChange={e => { const f = e.target.files?.[0]; if (f) onFileSelect(f); }} />
        </>
      )}
      <div style={{ display: "flex", gap: 5 }}>
        {status === "done" && glbPath && (
          <a href={glbPath} download style={{ flex: 1, textAlign: "center", fontSize: 10, padding: "5px 8px", borderRadius: 6, background: "rgba(0,200,100,0.1)", border: "1px solid rgba(0,200,100,0.3)", color: "#00c864", textDecoration: "none" }}>
            ⬇ GLB
          </a>
        )}
        {status !== "running" && status !== "done" && (
          <button onClick={onGenerate} disabled={!item.file} style={{
            flex: 1, padding: "5px 8px", borderRadius: 6, fontSize: 10, cursor: item.file ? "pointer" : "not-allowed",
            background: item.file ? "rgba(212,168,67,0.15)" : "rgba(255,255,255,0.03)", border: "1px solid",
            borderColor: item.file ? "rgba(212,168,67,0.3)" : "rgba(255,255,255,0.07)",
            color: item.file ? "var(--l-gold)" : "var(--l-t4)", fontWeight: 600,
          }}>
            <Film size={10} style={{ display: "inline", marginRight: 3 }} />Generar
          </button>
        )}
      </div>
    </div>
  );
}
