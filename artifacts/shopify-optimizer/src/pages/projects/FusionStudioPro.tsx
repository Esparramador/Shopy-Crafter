import { useState, useEffect, useCallback } from "react";
import { useRoute } from "wouter";
import { Sparkles, Wand2, Video, Mic, Volume2, Music, Layers, Download, Loader2, Palette, Maximize2, X, CheckCircle2, AlertCircle } from "lucide-react";

const API_BASE = import.meta.env.BASE_URL?.replace(/\/$/, "") ?? "";

type Tab = "generate" | "edit" | "background" | "enhance" | "video" | "audio" | "compose" | "downloads";

interface Capabilities {
  imageGeneration: Array<{ key: string; label: string; description: string; costPerImage: number; aspectRatios: string[]; maxResolution: string }>;
  videoGeneration: Array<{ key: string; label: string; description: string; costPerSec: number; quality: number; maxDuration: number }>;
  imageEdit: Array<{ key: string; label: string; description: string }>;
  enhance: Array<{ key: string; label: string; description: string }>;
  background: Array<{ key: string; label: string; description: string }>;
  audio: Array<{ key: string; label: string; description: string }>;
  composition: Array<{ key: string; label: string; description: string }>;
  voiceModels: Array<{ key: string; label: string; description: string }>;
}

interface VaultItem {
  vaultId: number;
  type: string;
  label: string;
  dataUrl?: string;
  mimeType?: string;
}

const TABS: Array<{ id: Tab; label: string; icon: React.ReactNode; desc: string }> = [
  { id: "generate",   label: "Generar imagen",  icon: <Sparkles size={15} />, desc: "Flux, Recraft, Ideogram, Imagen 4, Nano Banana" },
  { id: "edit",       label: "Editar imagen",   icon: <Wand2 size={15} />,    desc: "Nano Banana, Flux Kontext, Runway Aleph" },
  { id: "background", label: "Fondo",           icon: <Layers size={15} />,   desc: "Quitar / reemplazar fondo profesional" },
  { id: "enhance",    label: "Mejorar",         icon: <Maximize2 size={15} />,desc: "Upscale 4K, mejora de caras, detalle creativo" },
  { id: "video",      label: "Video",           icon: <Video size={15} />,    desc: "Runway Gen-4, Kling, Seedance, Hailuo" },
  { id: "audio",      label: "Voz & Música",    icon: <Mic size={15} />,      desc: "TTS, voice clone, SFX, música original" },
  { id: "compose",    label: "Componer",        icon: <Palette size={15} />,  desc: "Mezcla video + voz + música + texto en MP4" },
  { id: "downloads",  label: "Descargas",       icon: <Download size={15} />, desc: "Exportar todos los assets en ZIP" },
];

export default function FusionStudioPro() {
  const [, params] = useRoute("/projects/:id/fusion-studio-pro");
  const projectId = params?.id ? parseInt(params.id) : 0;

  const [tab, setTab] = useState<Tab>("generate");
  const [caps, setCaps] = useState<Capabilities | null>(null);
  const [sessionItems, setSessionItems] = useState<VaultItem[]>([]);
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null);

  const showToast = (msg: string, ok: boolean) => {
    setToast({ msg, ok });
    setTimeout(() => setToast(null), 3500);
  };

  const addItem = (item: VaultItem) => setSessionItems(prev => [item, ...prev].slice(0, 50));

  useEffect(() => {
    fetch(`${API_BASE}/api/fs-pro/capabilities`, { credentials: "include" })
      .then(r => r.ok ? r.json() : null)
      .then(d => setCaps(d))
      .catch(() => {});
  }, []);

  return (
    <div style={{ padding: "24px 32px", maxWidth: 1400, margin: "0 auto" }}>
      <div style={{ marginBottom: 24, display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 16 }}>
        <div>
          <h1 style={{ fontSize: 28, fontWeight: 800, color: "var(--gold, #c8a84b)", marginBottom: 4, display: "flex", alignItems: "center", gap: 12 }}>
            <Sparkles size={28} /> Fusion Studio Pro
          </h1>
          <p style={{ color: "var(--t2, #aaa)", fontSize: 14, maxWidth: 800 }}>
            Suite completa de IA generativa: <strong style={{ color: "#fff" }}>imagen, edición, video, voz clonada, música, composición</strong>. Todos los modelos top-tier de Replicate, Gemini, Runway y ElevenLabs en un solo lugar. Cada generación se guarda en el Vault y alimenta el ShopyBrain.
          </p>
        </div>
      </div>

      {toast && (
        <div style={{ position: "fixed", bottom: 24, right: 24, zIndex: 100, padding: "12px 18px", borderRadius: 10, background: toast.ok ? "rgba(45,212,159,0.15)" : "rgba(239,68,68,0.15)", border: `1px solid ${toast.ok ? "rgba(45,212,159,0.4)" : "rgba(239,68,68,0.4)"}`, color: toast.ok ? "#2dd49f" : "#ef4444", fontSize: 13, fontWeight: 600, display: "flex", alignItems: "center", gap: 10, maxWidth: 480, boxShadow: "0 8px 32px rgba(0,0,0,0.4)" }}>
          {toast.ok ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
          {toast.msg}
        </div>
      )}

      {/* TABS */}
      <div style={{ display: "flex", gap: 4, marginBottom: 20, padding: 4, background: "var(--ink2, #14141d)", borderRadius: 12, border: "1px solid var(--bdr, #22222e)", overflowX: "auto" }}>
        {TABS.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            title={t.desc}
            style={{
              padding: "10px 16px", borderRadius: 8, fontSize: 12, fontWeight: 600,
              background: tab === t.id ? "linear-gradient(135deg, rgba(200,168,75,0.18), rgba(200,168,75,0.05))" : "transparent",
              border: tab === t.id ? "1px solid rgba(200,168,75,0.35)" : "1px solid transparent",
              color: tab === t.id ? "var(--gold)" : "var(--t2)",
              cursor: "pointer", display: "flex", alignItems: "center", gap: 6, whiteSpace: "nowrap", flex: "0 0 auto",
            }}>
            {t.icon} {t.label}
          </button>
        ))}
      </div>

      {/* SESSION GALLERY (always visible above tab content) */}
      {sessionItems.length > 0 && (
        <SessionGallery items={sessionItems} projectId={projectId} onToast={showToast} />
      )}

      <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: 20, marginTop: 16 }}>
        {tab === "generate"   && <GenerateTab caps={caps} projectId={projectId} onSuccess={(it) => { addItem(it); showToast("Imagen generada y guardada", true); }} onError={(m) => showToast(m, false)} />}
        {tab === "edit"       && <EditTab     caps={caps} projectId={projectId} onSuccess={(it) => { addItem(it); showToast("Edición guardada", true); }} onError={(m) => showToast(m, false)} />}
        {tab === "background" && <BackgroundTab projectId={projectId} onSuccess={(it) => { addItem(it); showToast("Listo", true); }} onError={(m) => showToast(m, false)} />}
        {tab === "enhance"    && <EnhanceTab    projectId={projectId} onSuccess={(it) => { addItem(it); showToast("Imagen mejorada", true); }} onError={(m) => showToast(m, false)} />}
        {tab === "video"      && <VideoTab    caps={caps} projectId={projectId} onSuccess={(it) => { addItem(it); showToast("Video generado", true); }} onError={(m) => showToast(m, false)} />}
        {tab === "audio"      && <AudioTab    caps={caps} projectId={projectId} onSuccess={(it) => { addItem(it); showToast("Audio listo", true); }} onError={(m) => showToast(m, false)} onInfo={(m) => showToast(m, true)} />}
        {tab === "compose"    && <ComposeTab projectId={projectId} sessionItems={sessionItems} onSuccess={(it) => { addItem(it); showToast("Compose listo", true); }} onError={(m) => showToast(m, false)} />}
        {tab === "downloads"  && <DownloadsTab projectId={projectId} sessionItems={sessionItems} onError={(m) => showToast(m, false)} />}
      </div>
    </div>
  );
}

// ─── SESSION GALLERY ─────────────────────────────────────────────────────
function SessionGallery({ items, projectId, onToast }: { items: VaultItem[]; projectId: number; onToast: (m: string, ok: boolean) => void }) {
  return (
    <div style={{ padding: 14, borderRadius: 12, background: "var(--ink2, #14141d)", border: "1px solid var(--bdr, #22222e)" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
        <h3 style={{ margin: 0, fontSize: 12, fontWeight: 700, color: "var(--t3)", textTransform: "uppercase", letterSpacing: 0.6 }}>
          Generados en esta sesión ({items.length})
        </h3>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(120px, 1fr))", gap: 8 }}>
        {items.map((it, i) => (
          <div key={i} style={{ position: "relative", borderRadius: 8, overflow: "hidden", background: "var(--ink)", border: "1px solid var(--bdr)", aspectRatio: "1 / 1" }}>
            {it.dataUrl?.startsWith("data:image") || (it.mimeType?.startsWith("image")) ? (
              <img src={it.dataUrl} style={{ width: "100%", height: "100%", objectFit: "cover" }} alt={it.label} />
            ) : it.mimeType?.startsWith("video") ? (
              <div style={{ display: "flex", alignItems: "center", justifyContent: "center", width: "100%", height: "100%" }}><Video size={28} style={{ color: "var(--gold)" }} /></div>
            ) : it.mimeType?.startsWith("audio") ? (
              <div style={{ display: "flex", alignItems: "center", justifyContent: "center", width: "100%", height: "100%" }}><Volume2 size={28} style={{ color: "#a5b4fc" }} /></div>
            ) : (
              <div style={{ display: "flex", alignItems: "center", justifyContent: "center", width: "100%", height: "100%", fontSize: 10, color: "var(--t3)" }}>{it.type}</div>
            )}
            {it.dataUrl && (
              <a href={it.dataUrl} download={`${it.label.replace(/[^a-z0-9-_]/gi, "_")}.${(it.mimeType || "").split("/")[1] || "bin"}`}
                 style={{ position: "absolute", bottom: 4, right: 4, padding: 4, borderRadius: 4, background: "rgba(0,0,0,0.6)", color: "#fff", textDecoration: "none" }}
                 title="Descargar">
                <Download size={11} />
              </a>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── TAB: GENERATE IMAGE ─────────────────────────────────────────────────
function GenerateTab({ caps, projectId, onSuccess, onError }: { caps: Capabilities | null; projectId: number; onSuccess: (it: VaultItem) => void; onError: (m: string) => void }) {
  const [model, setModel] = useState("flux-1.1-pro");
  const [prompt, setPrompt] = useState("");
  const [aspectRatio, setAspectRatio] = useState("1:1");
  const [negativePrompt, setNegativePrompt] = useState("");
  const [referenceImageUrl, setReferenceImageUrl] = useState("");
  const [busy, setBusy] = useState(false);

  const modelCfg = caps?.imageGeneration.find(m => m.key === model);

  const generate = async () => {
    if (!prompt.trim()) { onError("Prompt requerido"); return; }
    setBusy(true);
    try {
      const res = await fetch(`${API_BASE}/api/fs-pro/generate-image`, {
        method: "POST", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId, model, prompt, aspectRatio, negativePrompt: negativePrompt || undefined, referenceImageUrl: referenceImageUrl || undefined }),
      });
      const d = await res.json();
      if (!res.ok) { onError(d.error || `Error ${res.status}`); return; }
      onSuccess({ vaultId: d.vaultId, type: "image", label: prompt.slice(0, 40), dataUrl: d.dataUrl, mimeType: "image/png" });
    } catch (e: any) {
      onError(e?.message || "Error de red");
    } finally { setBusy(false); }
  };

  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
      <div>
        <Section title="Modelo">
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 6 }}>
            {caps?.imageGeneration.map(m => (
              <button key={m.key} onClick={() => setModel(m.key)} style={cardButton(model === m.key)}>
                <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 2 }}>{m.label}</div>
                <div style={{ fontSize: 9, color: "var(--t3)", lineHeight: 1.3 }}>{m.description}</div>
                <div style={{ fontSize: 9, color: "var(--gold)", marginTop: 4 }}>~€{m.costPerImage} · {m.maxResolution}</div>
              </button>
            ))}
          </div>
        </Section>
        <Section title="Aspecto">
          <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
            {(modelCfg?.aspectRatios || ["1:1", "16:9", "9:16"]).map(a => (
              <button key={a} onClick={() => setAspectRatio(a)} style={pillButton(aspectRatio === a)}>{a}</button>
            ))}
          </div>
        </Section>
      </div>
      <div>
        <Section title="Prompt">
          <textarea value={prompt} onChange={e => setPrompt(e.target.value)} placeholder="Hyper-realistic luxury watch on black marble, dramatic side lighting, magazine photography..." style={{ ...inputStyle, minHeight: 120 }} />
        </Section>
        <Section title="Negative prompt (opcional)">
          <textarea value={negativePrompt} onChange={e => setNegativePrompt(e.target.value)} placeholder="blurry, low-quality, watermark, text, logo..." style={{ ...inputStyle, minHeight: 60 }} />
        </Section>
        <Section title="Imagen de referencia URL (opcional, solo Flux Kontext / Nano Banana)">
          <input value={referenceImageUrl} onChange={e => setReferenceImageUrl(e.target.value)} placeholder="https://..." style={inputStyle} />
        </Section>
        <button onClick={generate} disabled={busy || !prompt.trim()} className="btn btn-gold" style={{ width: "100%", justifyContent: "center", padding: "12px 20px", marginTop: 8 }}>
          {busy ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} />} {busy ? "Generando..." : "Generar imagen"}
        </button>
      </div>
    </div>
  );
}

// ─── TAB: EDIT IMAGE ─────────────────────────────────────────────────────
function EditTab({ caps, projectId, onSuccess, onError }: { caps: Capabilities | null; projectId: number; onSuccess: (it: VaultItem) => void; onError: (m: string) => void }) {
  const [model, setModel] = useState("nano-banana");
  const [prompt, setPrompt] = useState("");
  const [sourceFile, setSourceFile] = useState<File | null>(null);
  const [sourceUrl, setSourceUrl] = useState("");
  const [busy, setBusy] = useState(false);

  const edit = async () => {
    if (!prompt.trim()) { onError("Prompt requerido"); return; }
    if (!sourceFile && !sourceUrl) { onError("Imagen origen requerida"); return; }
    setBusy(true);
    try {
      const fd = new FormData();
      fd.append("projectId", String(projectId));
      fd.append("model", model);
      fd.append("prompt", prompt);
      if (sourceFile) fd.append("image", sourceFile);
      if (sourceUrl) fd.append("sourceImageUrl", sourceUrl);
      const res = await fetch(`${API_BASE}/api/fs-pro/edit-image`, { method: "POST", credentials: "include", body: fd });
      const d = await res.json();
      if (!res.ok) { onError(d.error || `Error ${res.status}`); return; }
      onSuccess({ vaultId: d.vaultId, type: "image-edit", label: prompt.slice(0, 40), dataUrl: d.dataUrl, mimeType: "image/png" });
    } catch (e: any) { onError(e?.message || "Error de red"); } finally { setBusy(false); }
  };

  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
      <div>
        <Section title="Modelo de edición">
          {caps?.imageEdit.map(m => (
            <button key={m.key} onClick={() => setModel(m.key)} style={{ ...cardButton(model === m.key), display: "block", width: "100%", textAlign: "left", marginBottom: 6 }}>
              <strong style={{ fontSize: 12 }}>{m.label}</strong>
              <div style={{ fontSize: 10, color: "var(--t3)", marginTop: 2 }}>{m.description}</div>
            </button>
          ))}
        </Section>
        <Section title="Imagen origen">
          <input type="file" accept="image/*" onChange={e => setSourceFile(e.target.files?.[0] || null)} />
          <p style={{ fontSize: 10, color: "var(--t3)", margin: "6px 0" }}>O URL pública:</p>
          <input value={sourceUrl} onChange={e => setSourceUrl(e.target.value)} placeholder="https://..." style={inputStyle} />
        </Section>
      </div>
      <div>
        <Section title="Instrucción de edición">
          <textarea value={prompt} onChange={e => setPrompt(e.target.value)} placeholder="Cambia el fondo a una playa al atardecer / añade gafas de sol al modelo / quita la persona del fondo..." style={{ ...inputStyle, minHeight: 200 }} />
        </Section>
        <button onClick={edit} disabled={busy} className="btn btn-gold" style={{ width: "100%", justifyContent: "center", padding: "12px 20px" }}>
          {busy ? <Loader2 size={16} className="animate-spin" /> : <Wand2 size={16} />} {busy ? "Editando..." : "Editar imagen"}
        </button>
      </div>
    </div>
  );
}

// ─── TAB: BACKGROUND ─────────────────────────────────────────────────────
function BackgroundTab({ projectId, onSuccess, onError }: { projectId: number; onSuccess: (it: VaultItem) => void; onError: (m: string) => void }) {
  const [mode, setMode] = useState<"remove" | "replace">("remove");
  const [scenePrompt, setScenePrompt] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);

  const run = async () => {
    if (!file) { onError("Imagen requerida"); return; }
    if (mode === "replace" && !scenePrompt.trim()) { onError("scenePrompt requerido"); return; }
    setBusy(true);
    try {
      const fd = new FormData();
      fd.append("projectId", String(projectId));
      fd.append("image", file);
      if (mode === "replace") fd.append("scenePrompt", scenePrompt);
      const res = await fetch(`${API_BASE}/api/fs-pro/${mode === "remove" ? "remove-bg" : "replace-bg"}`, {
        method: "POST", credentials: "include", body: fd,
      });
      const d = await res.json();
      if (!res.ok) { onError(d.error || `Error ${res.status}`); return; }
      onSuccess({ vaultId: d.vaultId, type: "bg", label: mode === "remove" ? "BG removed" : `BG: ${scenePrompt.slice(0, 30)}`, dataUrl: d.dataUrl, mimeType: "image/png" });
    } catch (e: any) { onError(e?.message || "Error"); } finally { setBusy(false); }
  };

  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
      <div>
        <Section title="Modo">
          <div style={{ display: "flex", gap: 8 }}>
            <button onClick={() => setMode("remove")} style={pillButton(mode === "remove")}>Eliminar fondo</button>
            <button onClick={() => setMode("replace")} style={pillButton(mode === "replace")}>Reemplazar fondo</button>
          </div>
        </Section>
        <Section title="Imagen origen">
          <input type="file" accept="image/*" onChange={e => setFile(e.target.files?.[0] || null)} />
        </Section>
        {mode === "replace" && (
          <Section title="Escena nueva (prompt)">
            <textarea value={scenePrompt} onChange={e => setScenePrompt(e.target.value)} placeholder="luxurious marble surface with soft window light from the left, depth of field..." style={{ ...inputStyle, minHeight: 100 }} />
          </Section>
        )}
      </div>
      <div>
        <button onClick={run} disabled={busy || !file} className="btn btn-gold" style={{ width: "100%", justifyContent: "center", padding: "12px 20px" }}>
          {busy ? <Loader2 size={16} className="animate-spin" /> : <Layers size={16} />}
          {busy ? "Procesando..." : mode === "remove" ? "Quitar fondo" : "Reemplazar fondo"}
        </button>
      </div>
    </div>
  );
}

// ─── TAB: ENHANCE ────────────────────────────────────────────────────────
function EnhanceTab({ projectId, onSuccess, onError }: { projectId: number; onSuccess: (it: VaultItem) => void; onError: (m: string) => void }) {
  const [mode, setMode] = useState<"esrgan" | "clarity" | "faces">("esrgan");
  const [scale, setScale] = useState<2 | 4>(2);
  const [prompt, setPrompt] = useState("high detail photograph");
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);

  const run = async () => {
    if (!file) { onError("Imagen requerida"); return; }
    setBusy(true);
    try {
      const fd = new FormData();
      fd.append("projectId", String(projectId));
      fd.append("image", file);
      fd.append("mode", mode);
      fd.append("scale", String(scale));
      if (mode === "clarity") fd.append("prompt", prompt);
      const res = await fetch(`${API_BASE}/api/fs-pro/upscale`, { method: "POST", credentials: "include", body: fd });
      const d = await res.json();
      if (!res.ok) { onError(d.error || `Error ${res.status}`); return; }
      onSuccess({ vaultId: d.vaultId, type: "enhance", label: `${mode} x${scale}`, dataUrl: d.dataUrl, mimeType: "image/png" });
    } catch (e: any) { onError(e?.message || "Error"); } finally { setBusy(false); }
  };

  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
      <div>
        <Section title="Modo">
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            <button onClick={() => setMode("esrgan")} style={pillButton(mode === "esrgan")}>Real-ESRGAN</button>
            <button onClick={() => setMode("clarity")} style={pillButton(mode === "clarity")}>Clarity (creativo)</button>
            <button onClick={() => setMode("faces")} style={pillButton(mode === "faces")}>Caras (GFPGAN)</button>
          </div>
        </Section>
        {mode !== "faces" && (
          <Section title="Escala">
            <div style={{ display: "flex", gap: 6 }}>
              <button onClick={() => setScale(2)} style={pillButton(scale === 2)}>x2</button>
              <button onClick={() => setScale(4)} style={pillButton(scale === 4)}>x4</button>
            </div>
          </Section>
        )}
        {mode === "clarity" && (
          <Section title="Prompt creativo (Clarity)">
            <input value={prompt} onChange={e => setPrompt(e.target.value)} style={inputStyle} />
          </Section>
        )}
        <Section title="Imagen origen">
          <input type="file" accept="image/*" onChange={e => setFile(e.target.files?.[0] || null)} />
        </Section>
      </div>
      <div>
        <button onClick={run} disabled={busy || !file} className="btn btn-gold" style={{ width: "100%", justifyContent: "center", padding: "12px 20px" }}>
          {busy ? <Loader2 size={16} className="animate-spin" /> : <Maximize2 size={16} />} {busy ? "Mejorando..." : "Mejorar imagen"}
        </button>
      </div>
    </div>
  );
}

// ─── TAB: VIDEO ──────────────────────────────────────────────────────────
function VideoTab({ caps, projectId, onSuccess, onError }: { caps: Capabilities | null; projectId: number; onSuccess: (it: VaultItem) => void; onError: (m: string) => void }) {
  const [model, setModel] = useState("seedance-fast");
  const [prompt, setPrompt] = useState("");
  const [duration, setDuration] = useState(5);
  const [aspect, setAspect] = useState("9:16");
  const [file, setFile] = useState<File | null>(null);
  const [sourceUrl, setSourceUrl] = useState("");
  const [busy, setBusy] = useState(false);

  const run = async () => {
    if (!prompt.trim()) { onError("Prompt requerido"); return; }
    if (!file && !sourceUrl) { onError("Imagen origen requerida"); return; }
    setBusy(true);
    try {
      const fd = new FormData();
      fd.append("projectId", String(projectId));
      fd.append("model", model); fd.append("prompt", prompt);
      fd.append("duration", String(duration)); fd.append("aspect", aspect);
      if (file) fd.append("image", file);
      if (sourceUrl) fd.append("sourceImageUrl", sourceUrl);
      const res = await fetch(`${API_BASE}/api/fs-pro/generate-video`, { method: "POST", credentials: "include", body: fd });
      const d = await res.json();
      if (!res.ok) { onError(d.error || `Error ${res.status}`); return; }
      onSuccess({ vaultId: d.vaultId, type: "video", label: prompt.slice(0, 30), mimeType: "video/mp4" });
    } catch (e: any) { onError(e?.message || "Error"); } finally { setBusy(false); }
  };

  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
      <div>
        <Section title="Modelo">
          {caps?.videoGeneration.map(m => (
            <button key={m.key} onClick={() => setModel(m.key)} style={{ ...cardButton(model === m.key), display: "block", width: "100%", textAlign: "left", marginBottom: 6 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <strong style={{ fontSize: 12 }}>{m.label}</strong>
                <span style={{ fontSize: 10, color: "var(--gold)" }}>~€{m.costPerSec}/s · Q{m.quality}/10</span>
              </div>
              <div style={{ fontSize: 10, color: "var(--t3)", marginTop: 2 }}>{m.description}</div>
            </button>
          ))}
        </Section>
      </div>
      <div>
        <Section title="Prompt">
          <textarea value={prompt} onChange={e => setPrompt(e.target.value)} placeholder="Cinematic dolly-in product reveal, soft golden lighting, slow motion at 30fps..." style={{ ...inputStyle, minHeight: 100 }} />
        </Section>
        <Section title="Duración / Aspecto">
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            <div>
              <div style={{ fontSize: 11, color: "var(--t3)", marginBottom: 4 }}>{duration}s</div>
              <input type="range" min={3} max={10} value={duration} onChange={e => setDuration(parseInt(e.target.value))} style={{ width: "100%" }} />
            </div>
            <div style={{ display: "flex", gap: 4 }}>
              {["9:16", "16:9", "1:1", "4:5"].map(a => (
                <button key={a} onClick={() => setAspect(a)} style={pillButton(aspect === a)}>{a}</button>
              ))}
            </div>
          </div>
        </Section>
        <Section title="Imagen origen">
          <input type="file" accept="image/*" onChange={e => setFile(e.target.files?.[0] || null)} />
          <p style={{ fontSize: 10, color: "var(--t3)", margin: "6px 0" }}>O URL pública:</p>
          <input value={sourceUrl} onChange={e => setSourceUrl(e.target.value)} placeholder="https://..." style={inputStyle} />
        </Section>
        <button onClick={run} disabled={busy} className="btn btn-gold" style={{ width: "100%", justifyContent: "center", padding: "12px 20px" }}>
          {busy ? <Loader2 size={16} className="animate-spin" /> : <Video size={16} />} {busy ? "Generando video..." : "Generar video (1-3 min)"}
        </button>
      </div>
    </div>
  );
}

// ─── TAB: AUDIO ──────────────────────────────────────────────────────────
function AudioTab({ caps, projectId, onSuccess, onError, onInfo }: { caps: Capabilities | null; projectId: number; onSuccess: (it: VaultItem) => void; onError: (m: string) => void; onInfo: (m: string) => void }) {
  const [mode, setMode] = useState<"tts" | "clone" | "sfx" | "music">("tts");
  const [voices, setVoices] = useState<any[]>([]);
  const [voiceId, setVoiceId] = useState<string>("");
  const [text, setText] = useState("");
  const [modelId, setModelId] = useState("eleven_multilingual_v2");
  const [stability, setStability] = useState(0.5);
  const [similarity, setSimilarity] = useState(0.75);
  const [style, setStyle] = useState(0.3);
  const [speed, setSpeed] = useState(1.0);
  const [duration, setDuration] = useState(5);
  const [musicDuration, setMusicDuration] = useState(30);
  const [cloneName, setCloneName] = useState("");
  const [cloneFile, setCloneFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    fetch(`${API_BASE}/api/ad-studio/voices`, { credentials: "include" })
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d?.voices) { setVoices(d.voices); if (d.voices[0]) setVoiceId(d.voices[0].voice_id); } });
  }, []);

  const runTTS = async () => {
    if (!voiceId || !text.trim()) { onError("Voz y texto requeridos"); return; }
    setBusy(true);
    try {
      const res = await fetch(`${API_BASE}/api/fs-pro/tts`, {
        method: "POST", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId, voiceId, text, modelId, stability, similarity, style, speed }),
      });
      const d = await res.json();
      if (!res.ok) { onError(d.error || "Error"); return; }
      onSuccess({ vaultId: d.vaultId, type: "tts", label: text.slice(0, 30), dataUrl: d.dataUrl, mimeType: "audio/mpeg" });
    } catch (e: any) { onError(e?.message || "Error"); } finally { setBusy(false); }
  };

  const runClone = async () => {
    if (!cloneName || !cloneFile) { onError("Nombre y archivo de audio requeridos"); return; }
    setBusy(true);
    try {
      const fd = new FormData();
      fd.append("name", cloneName);
      fd.append("audio", cloneFile);
      const res = await fetch(`${API_BASE}/api/fs-pro/voice/clone`, { method: "POST", credentials: "include", body: fd });
      const d = await res.json();
      if (!res.ok) { onError(d.error || "Error"); return; }
      onInfo(`Voz "${d.name}" clonada. ID: ${d.voice_id}`);
      // Refresh voices list
      const v = await fetch(`${API_BASE}/api/ad-studio/voices`, { credentials: "include" }).then(r => r.json());
      if (v?.voices) setVoices(v.voices);
      setMode("tts"); setVoiceId(d.voice_id);
    } catch (e: any) { onError(e?.message || "Error"); } finally { setBusy(false); }
  };

  const runSFX = async () => {
    if (!text.trim()) { onError("Prompt requerido"); return; }
    setBusy(true);
    try {
      const res = await fetch(`${API_BASE}/api/fs-pro/sfx`, {
        method: "POST", credentials: "include", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId, prompt: text, duration }),
      });
      const d = await res.json();
      if (!res.ok) { onError(d.error || "Error"); return; }
      onSuccess({ vaultId: d.vaultId, type: "sfx", label: text.slice(0, 30), dataUrl: d.dataUrl, mimeType: "audio/mpeg" });
    } catch (e: any) { onError(e?.message || "Error"); } finally { setBusy(false); }
  };

  const runMusic = async () => {
    if (!text.trim()) { onError("Prompt requerido"); return; }
    setBusy(true);
    try {
      const res = await fetch(`${API_BASE}/api/fs-pro/music`, {
        method: "POST", credentials: "include", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId, prompt: text, duration: musicDuration }),
      });
      const d = await res.json();
      if (!res.ok) { onError(d.error || "Error"); return; }
      onSuccess({ vaultId: d.vaultId, type: "music", label: text.slice(0, 30), dataUrl: d.dataUrl, mimeType: "audio/wav" });
    } catch (e: any) { onError(e?.message || "Error"); } finally { setBusy(false); }
  };

  return (
    <div>
      <div style={{ display: "flex", gap: 6, marginBottom: 14, flexWrap: "wrap" }}>
        <button onClick={() => setMode("tts")} style={pillButton(mode === "tts")}>Voz (TTS)</button>
        <button onClick={() => setMode("clone")} style={pillButton(mode === "clone")}>Clonar voz</button>
        <button onClick={() => setMode("sfx")} style={pillButton(mode === "sfx")}>SFX</button>
        <button onClick={() => setMode("music")} style={pillButton(mode === "music")}>Música</button>
      </div>

      {mode === "tts" && (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
          <div>
            <Section title="Voz">
              <select value={voiceId} onChange={e => setVoiceId(e.target.value)} style={inputStyle}>
                {voices.map(v => <option key={v.voice_id} value={v.voice_id}>{v.name} ({Object.values(v.labels || {}).join("/")})</option>)}
              </select>
            </Section>
            <Section title="Modelo TTS">
              <select value={modelId} onChange={e => setModelId(e.target.value)} style={inputStyle}>
                <option value="eleven_v3">Eleven v3 (latest)</option>
                <option value="eleven_multilingual_v2">Multilingual v2 (estable)</option>
                <option value="eleven_turbo_v2_5">Turbo v2.5</option>
                <option value="eleven_flash_v2_5">Flash v2.5 (rápido)</option>
              </select>
            </Section>
            <Section title={`Stability: ${stability.toFixed(2)}`}><input type="range" min={0} max={1} step={0.05} value={stability} onChange={e => setStability(+e.target.value)} style={{ width: "100%" }} /></Section>
            <Section title={`Similarity: ${similarity.toFixed(2)}`}><input type="range" min={0} max={1} step={0.05} value={similarity} onChange={e => setSimilarity(+e.target.value)} style={{ width: "100%" }} /></Section>
            <Section title={`Style: ${style.toFixed(2)}`}><input type="range" min={0} max={1} step={0.05} value={style} onChange={e => setStyle(+e.target.value)} style={{ width: "100%" }} /></Section>
            <Section title={`Speed: ${speed.toFixed(2)}`}><input type="range" min={0.7} max={1.2} step={0.05} value={speed} onChange={e => setSpeed(+e.target.value)} style={{ width: "100%" }} /></Section>
          </div>
          <div>
            <Section title="Texto">
              <textarea value={text} onChange={e => setText(e.target.value)} placeholder="Texto a sintetizar..." style={{ ...inputStyle, minHeight: 200 }} />
            </Section>
            <button onClick={runTTS} disabled={busy} className="btn btn-gold" style={{ width: "100%", justifyContent: "center", padding: "12px 20px" }}>
              {busy ? <Loader2 size={16} className="animate-spin" /> : <Mic size={16} />} {busy ? "Generando..." : "Generar voz"}
            </button>
          </div>
        </div>
      )}

      {mode === "clone" && (
        <div style={{ maxWidth: 600 }}>
          <Section title="Nombre de la voz">
            <input value={cloneName} onChange={e => setCloneName(e.target.value)} placeholder="CEO de Marca X / Carlos / Founder" style={inputStyle} />
          </Section>
          <Section title="Muestra de audio (30s a 2 min)">
            <input type="file" accept="audio/*" onChange={e => setCloneFile(e.target.files?.[0] || null)} />
            <p style={{ fontSize: 10, color: "var(--t3)", marginTop: 6 }}>Audio limpio, sin música ni ruido. Una sola persona hablando.</p>
          </Section>
          <button onClick={runClone} disabled={busy || !cloneName || !cloneFile} className="btn btn-gold" style={{ width: "100%", justifyContent: "center", padding: "12px 20px" }}>
            {busy ? <Loader2 size={16} className="animate-spin" /> : <Mic size={16} />} {busy ? "Clonando..." : "Clonar voz"}
          </button>
        </div>
      )}

      {(mode === "sfx" || mode === "music") && (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
          <div>
            <Section title="Prompt">
              <textarea value={text} onChange={e => setText(e.target.value)}
                placeholder={mode === "sfx" ? "Cinematic riser with deep impact, building tension..." : "Upbeat electronic track with synths, 120bpm, energetic feel..."}
                style={{ ...inputStyle, minHeight: 120 }} />
            </Section>
            <Section title={mode === "sfx" ? `Duración SFX: ${duration}s` : `Duración música: ${musicDuration}s`}>
              {mode === "sfx" ? (
                <input type="range" min={1} max={22} value={duration} onChange={e => setDuration(+e.target.value)} style={{ width: "100%" }} />
              ) : (
                <input type="range" min={5} max={47} value={musicDuration} onChange={e => setMusicDuration(+e.target.value)} style={{ width: "100%" }} />
              )}
            </Section>
          </div>
          <div>
            <button onClick={mode === "sfx" ? runSFX : runMusic} disabled={busy} className="btn btn-gold" style={{ width: "100%", justifyContent: "center", padding: "12px 20px" }}>
              {busy ? <Loader2 size={16} className="animate-spin" /> : (mode === "sfx" ? <Volume2 size={16} /> : <Music size={16} />)}
              {busy ? "Generando..." : mode === "sfx" ? "Generar SFX" : "Generar música"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── TAB: COMPOSE ────────────────────────────────────────────────────────
function ComposeTab({ projectId, sessionItems, onSuccess, onError }: { projectId: number; sessionItems: VaultItem[]; onSuccess: (it: VaultItem) => void; onError: (m: string) => void }) {
  const videos = sessionItems.filter(i => i.mimeType?.startsWith("video"));
  const audios = sessionItems.filter(i => i.mimeType?.startsWith("audio"));

  const [videoVaultId, setVideoVaultId] = useState<number | null>(null);
  const [voiceVaultId, setVoiceVaultId] = useState<number | null>(null);
  const [musicVaultId, setMusicVaultId] = useState<number | null>(null);
  const [voiceVolume, setVoiceVolume] = useState(1.0);
  const [musicVolume, setMusicVolume] = useState(0.25);
  const [overlayText, setOverlayText] = useState("");
  const [overlayPosition, setOverlayPosition] = useState<"top" | "center" | "bottom">("bottom");
  const [busy, setBusy] = useState(false);

  const compose = async () => {
    if (!videoVaultId) { onError("Selecciona un video"); return; }
    setBusy(true);
    try {
      const res = await fetch(`${API_BASE}/api/fs-pro/compose`, {
        method: "POST", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId, videoVaultId, voiceVaultId, musicVaultId, voiceVolume, musicVolume,
          overlayText: overlayText ? { text: overlayText, position: overlayPosition, fontSize: 48, color: "white" } : undefined,
        }),
      });
      const d = await res.json();
      if (!res.ok) { onError(d.error || "Error"); return; }
      onSuccess({ vaultId: d.vaultId, type: "composed", label: "Compose final", mimeType: "video/mp4" });
    } catch (e: any) { onError(e?.message || "Error"); } finally { setBusy(false); }
  };

  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
      <div>
        <Section title="Video base">
          <select value={videoVaultId || ""} onChange={e => setVideoVaultId(e.target.value ? +e.target.value : null)} style={inputStyle}>
            <option value="">— Selecciona —</option>
            {videos.map(v => <option key={v.vaultId} value={v.vaultId}>{v.label} (#{v.vaultId})</option>)}
          </select>
        </Section>
        <Section title="Voz">
          <select value={voiceVaultId || ""} onChange={e => setVoiceVaultId(e.target.value ? +e.target.value : null)} style={inputStyle}>
            <option value="">— Sin voz —</option>
            {audios.map(a => <option key={a.vaultId} value={a.vaultId}>{a.label} (#{a.vaultId})</option>)}
          </select>
        </Section>
        <Section title="Música">
          <select value={musicVaultId || ""} onChange={e => setMusicVaultId(e.target.value ? +e.target.value : null)} style={inputStyle}>
            <option value="">— Sin música —</option>
            {audios.map(a => <option key={a.vaultId} value={a.vaultId}>{a.label} (#{a.vaultId})</option>)}
          </select>
        </Section>
        <Section title={`Vol. voz: ${voiceVolume.toFixed(2)}`}><input type="range" min={0} max={1.5} step={0.05} value={voiceVolume} onChange={e => setVoiceVolume(+e.target.value)} style={{ width: "100%" }} /></Section>
        <Section title={`Vol. música: ${musicVolume.toFixed(2)}`}><input type="range" min={0} max={1.0} step={0.05} value={musicVolume} onChange={e => setMusicVolume(+e.target.value)} style={{ width: "100%" }} /></Section>
      </div>
      <div>
        <Section title="Texto overlay (opcional)">
          <input value={overlayText} onChange={e => setOverlayText(e.target.value)} placeholder="Black Friday: 50% OFF" style={inputStyle} />
          <div style={{ display: "flex", gap: 4, marginTop: 8 }}>
            <button onClick={() => setOverlayPosition("top")} style={pillButton(overlayPosition === "top")}>Arriba</button>
            <button onClick={() => setOverlayPosition("center")} style={pillButton(overlayPosition === "center")}>Centro</button>
            <button onClick={() => setOverlayPosition("bottom")} style={pillButton(overlayPosition === "bottom")}>Abajo</button>
          </div>
        </Section>
        <button onClick={compose} disabled={busy || !videoVaultId} className="btn btn-gold" style={{ width: "100%", justifyContent: "center", padding: "12px 20px" }}>
          {busy ? <Loader2 size={16} className="animate-spin" /> : <Palette size={16} />}
          {busy ? "Componiendo..." : "Componer MP4 final"}
        </button>
        {videos.length === 0 && (
          <p style={{ fontSize: 11, color: "var(--t3)", marginTop: 12 }}>
            Genera primero un video y/o audio en las pestañas anteriores. Luego vuelves aquí para componer el final.
          </p>
        )}
      </div>
    </div>
  );
}

// ─── TAB: DOWNLOADS ──────────────────────────────────────────────────────
function DownloadsTab({ projectId, sessionItems, onError }: { projectId: number; sessionItems: VaultItem[]; onError: (m: string) => void }) {
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [busy, setBusy] = useState(false);

  const toggle = (id: number) => {
    setSelected(prev => {
      const ns = new Set(prev);
      ns.has(id) ? ns.delete(id) : ns.add(id);
      return ns;
    });
  };
  const selectAll = () => setSelected(new Set(sessionItems.map(i => i.vaultId)));
  const clearAll = () => setSelected(new Set());

  const downloadZip = async () => {
    if (selected.size === 0) { onError("Selecciona al menos 1 archivo"); return; }
    setBusy(true);
    try {
      const res = await fetch(`${API_BASE}/api/fs-pro/download-all`, {
        method: "POST", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId, vaultIds: Array.from(selected) }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        onError(d.error || `Error ${res.status}`);
        return;
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `fusion-studio-assets-${Date.now()}.zip`;
      document.body.appendChild(a); a.click(); document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (e: any) { onError(e?.message || "Error"); } finally { setBusy(false); }
  };

  return (
    <div>
      <div style={{ display: "flex", gap: 8, marginBottom: 14, flexWrap: "wrap" }}>
        <button onClick={selectAll} className="btn btn-ghost btn-sm">Seleccionar todo</button>
        <button onClick={clearAll} className="btn btn-ghost btn-sm">Limpiar</button>
        <div style={{ flex: 1 }} />
        <button onClick={downloadZip} disabled={busy || selected.size === 0} className="btn btn-gold">
          {busy ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />}
          {busy ? "Empaquetando..." : `Descargar ZIP (${selected.size})`}
        </button>
      </div>

      {sessionItems.length === 0 && (
        <div style={{ padding: 40, textAlign: "center", color: "var(--t3)", fontSize: 13 }}>
          Aún no has generado nada. Crea contenido en las pestañas anteriores.
        </div>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))", gap: 10 }}>
        {sessionItems.map((it, i) => (
          <label key={i} style={{ position: "relative", borderRadius: 10, overflow: "hidden", background: "var(--ink2)", border: `1px solid ${selected.has(it.vaultId) ? "var(--gold)" : "var(--bdr)"}`, aspectRatio: "1 / 1", cursor: "pointer" }}>
            <input type="checkbox" checked={selected.has(it.vaultId)} onChange={() => toggle(it.vaultId)} style={{ position: "absolute", top: 8, left: 8, zIndex: 2 }} />
            {it.mimeType?.startsWith("image") && it.dataUrl ? (
              <img src={it.dataUrl} style={{ width: "100%", height: "100%", objectFit: "cover" }} alt={it.label} />
            ) : it.mimeType?.startsWith("video") ? (
              <div style={{ display: "flex", alignItems: "center", justifyContent: "center", width: "100%", height: "100%", background: "linear-gradient(135deg, #2a1f3d, #14141d)" }}><Video size={36} style={{ color: "var(--gold)" }} /></div>
            ) : it.mimeType?.startsWith("audio") ? (
              <div style={{ display: "flex", alignItems: "center", justifyContent: "center", width: "100%", height: "100%", background: "linear-gradient(135deg, #1f2a3d, #14141d)" }}><Volume2 size={36} style={{ color: "#a5b4fc" }} /></div>
            ) : null}
            <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, padding: "6px 8px", background: "rgba(0,0,0,0.7)", color: "#fff", fontSize: 10 }}>
              {it.label}
            </div>
          </label>
        ))}
      </div>
    </div>
  );
}

// ─── Helpers ────────────────────────────────────────────────────────────
function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return <div style={{ marginBottom: 14 }}>
    <h3 style={{ fontSize: 11, fontWeight: 700, color: "var(--t3)", textTransform: "uppercase", letterSpacing: 0.6, marginBottom: 6 }}>{title}</h3>
    {children}
  </div>;
}

const inputStyle: React.CSSProperties = { width: "100%", padding: "10px 12px", borderRadius: 8, background: "var(--ink2, #14141d)", border: "1px solid var(--bdr, #22222e)", color: "var(--t1, #fff)", fontSize: 13, fontFamily: "inherit" };

const cardButton = (active: boolean): React.CSSProperties => ({
  padding: "10px 12px", borderRadius: 8, fontSize: 12, cursor: "pointer", textAlign: "center", lineHeight: 1.3,
  background: active ? "rgba(200,168,75,0.15)" : "var(--ink2, #14141d)",
  border: `1px solid ${active ? "var(--gold)" : "var(--bdr, #22222e)"}`,
  color: active ? "var(--gold)" : "var(--t2)",
});

const pillButton = (active: boolean): React.CSSProperties => ({
  padding: "6px 12px", borderRadius: 6, fontSize: 11, fontWeight: 600, cursor: "pointer",
  background: active ? "var(--gold)" : "var(--ink2)",
  color: active ? "#000" : "var(--t2)",
  border: `1px solid ${active ? "var(--gold)" : "var(--bdr)"}`,
});
