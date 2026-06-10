import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { useRoute } from "wouter";
import { Sparkles, Wand2, Video, Mic, Volume2, Music, Layers, Download, Loader2, Palette, Maximize2, X, CheckCircle2, AlertCircle, Film, UserSquare, Zap, RefreshCw, Copy } from "lucide-react";
import { LiveOperation } from "@/components/LiveOperation";

const API_BASE = import.meta.env.BASE_URL?.replace(/\/$/, "") ?? "";

type Tab = "generate" | "edit" | "background" | "enhance" | "video" | "multishot" | "uploadconcat" | "avatars" | "audio" | "compose" | "protools" | "promptlab" | "cinematic-templates" | "downloads";

type ProviderId = "replicate" | "runway" | "gemini" | "elevenlabs";
type ProviderStatus = "ok" | "missing_key" | "out_of_credits" | "rate_limited" | "down" | "unknown";
interface ProviderHealth { provider: ProviderId; status: ProviderStatus; hasKey: boolean; detail?: string; checkedAt: number }
type HealthMap = Record<ProviderId, ProviderHealth>;

interface ModelWithProvider {
  key: string; label: string; description: string;
  provider?: ProviderId;
  costPerImage?: number; aspectRatios?: string[]; maxResolution?: string;
  costPerSec?: number; quality?: number; maxDuration?: number;
}
interface Capabilities {
  imageGeneration: ModelWithProvider[];
  videoGeneration: ModelWithProvider[];
  imageEdit: ModelWithProvider[];
  enhance: Array<{ key: string; label: string; description: string }>;
  videoUpscaling?: Array<{ key: string; label: string; description: string; resolutions: string[]; defaultResolution: string }>;
  background: Array<{ key: string; label: string; description: string }>;
  audio: Array<{ key: string; label: string; description: string }>;
  composition: Array<{ key: string; label: string; description: string }>;
  voiceModels: Array<{ key: string; label: string; description: string }>;
  cameraPresets?: Array<{ key: string; label: string; description: string }>;
  transitionPresets?: Array<{ key: string; label: string; xfade: string; defaultDurationSec: number }>;
  proTools?: Array<{ key: string; label: string; description: string }>;
  adTemplates?: Array<{ key: string; label: string; description: string; cameraPreset: string; transitionPreset: string; defaultAspect: string; defaultDurationSec: number }>;
}

// ── Hook & helpers para health de proveedores
function useProviderHealth(): { health: HealthMap | null; loading: boolean; refresh: (force?: boolean) => Promise<void> } {
  const [health, setHealth] = useState<HealthMap | null>(null);
  const [loading, setLoading] = useState(false);
  const refresh = useCallback(async (force = false) => {
    setLoading(true);
    try {
      const r = await fetch(`${API_BASE}/api/fs-pro/providers/health${force ? "?fresh=1" : ""}`, { credentials: "include" });
      if (r.ok) { const j = await r.json(); setHealth(j.providers); }
    } finally { setLoading(false); }
  }, []);
  useEffect(() => { refresh(false); }, [refresh]);
  return { health, loading, refresh };
}

const PROVIDER_LABEL: Record<ProviderId, string> = {
  replicate: "Replicate", runway: "Runway", gemini: "Gemini", elevenlabs: "ElevenLabs",
};
const STATUS_COLOR: Record<ProviderStatus, { bg: string; fg: string; border: string; emoji: string }> = {
  ok:              { bg: "rgba(45,212,159,0.15)", fg: "#2dd49f", border: "rgba(45,212,159,0.4)", emoji: "🟢" },
  rate_limited:    { bg: "rgba(251,191,36,0.15)", fg: "#fbbf24", border: "rgba(251,191,36,0.4)", emoji: "🟡" },
  out_of_credits:  { bg: "rgba(239,68,68,0.15)",  fg: "#ef4444", border: "rgba(239,68,68,0.4)",  emoji: "🔴" },
  missing_key:     { bg: "rgba(148,163,184,0.15)",fg: "#94a3b8", border: "rgba(148,163,184,0.4)",emoji: "⚪" },
  down:            { bg: "rgba(239,68,68,0.15)",  fg: "#ef4444", border: "rgba(239,68,68,0.4)",  emoji: "🔴" },
  unknown:         { bg: "rgba(148,163,184,0.10)",fg: "#94a3b8", border: "rgba(148,163,184,0.3)",emoji: "❔" },
};
function statusLabel(s: ProviderStatus): string {
  return s === "ok" ? "operativo"
    : s === "rate_limited" ? "rate limit"
    : s === "out_of_credits" ? "sin saldo (402)"
    : s === "missing_key" ? "sin API key"
    : s === "down" ? "caído"
    : "desconocido";
}

function ProviderBadge({ provider, health, compact = false }: { provider?: ProviderId; health: HealthMap | null; compact?: boolean }) {
  if (!provider) return null;
  const h = health?.[provider];
  const status = h?.status || "unknown";
  const c = STATUS_COLOR[status];
  return (
    <span title={h?.detail ? `${PROVIDER_LABEL[provider]} · ${statusLabel(status)} (${h.detail})` : `${PROVIDER_LABEL[provider]} · ${statusLabel(status)}`}
      style={{
        display: "inline-flex", alignItems: "center", gap: 4,
        padding: compact ? "1px 6px" : "2px 8px",
        borderRadius: 999, background: c.bg, color: c.fg, border: `1px solid ${c.border}`,
        fontSize: compact ? 9 : 10, fontWeight: 700, letterSpacing: 0.3, textTransform: "uppercase",
      }}>
      <span style={{ fontSize: compact ? 8 : 9 }}>{c.emoji}</span>{PROVIDER_LABEL[provider]}
    </span>
  );
}

// Devuelve modelo alternativo cuyo provider esté OK, mismo array de modelos.
function suggestFallback(models: ModelWithProvider[], failedKey: string, health: HealthMap | null): ModelWithProvider | null {
  if (!health) return null;
  const failed = models.find(m => m.key === failedKey);
  // Prefer modelos con provider distinto al que falló y status ok
  const candidates = models.filter(m =>
    m.key !== failedKey &&
    m.provider &&
    health[m.provider]?.status === "ok"
  );
  // Mayor prioridad: provider distinto al fallido
  candidates.sort((a, b) => {
    if (a.provider === failed?.provider) return 1;
    if (b.provider === failed?.provider) return -1;
    return 0;
  });
  return candidates[0] || null;
}

// Detecta error 402/credit en respuesta y mensaje
function isCreditError(httpStatus: number | undefined, message: string | undefined): boolean {
  if (httpStatus === 402) return true;
  const m = (message || "").toLowerCase();
  return /402|out of credits|insufficient|payment required|sin saldo|saldo insuficiente|billing/i.test(m);
}

interface VaultItem {
  vaultId: number;
  type: string;
  label: string;
  dataUrl?: string;
  mimeType?: string;
}

function VideoPromptEnhanceBtn({ prompt, setPrompt, projectId, subject }: { prompt: string; setPrompt: (v: string) => void; projectId: number; subject?: string }) {
  const [busy, setBusy] = useState(false);
  const run = async () => {
    if (busy || prompt.trim().length < 3) return;
    setBusy(true);
    try {
      const res = await fetch(`${API_BASE}/api/fs-pro/prompt/enhance`, {
        method: "POST", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ intent: "video", baselinePrompt: prompt.trim(), subject: subject || "premium product", language: "es", projectId }),
      });
      if (res.ok) { const d = await res.json(); if (d.ok && d.enhanced) setPrompt(d.enhanced); }
    } catch {} finally { setBusy(false); }
  };
  return (
    <button onClick={run} disabled={busy}
      style={{ position: "absolute", bottom: 8, right: 8, padding: "4px 10px", borderRadius: 6, border: "1px solid var(--gold, #c8a84b44)", background: busy ? "rgba(200,168,75,0.13)" : "linear-gradient(135deg,rgba(200,168,75,0.13),rgba(200,168,75,0.06))", color: "var(--gold, #f0d68a)", fontSize: 9, fontWeight: 700, cursor: busy ? "wait" : "pointer" }}>
      {busy ? "⟳ Potenciando..." : "✦ Potenciar con IA"}
    </button>
  );
}

function ImagePromptEnhanceBtn({ prompt, setPrompt, projectId, subject }: { prompt: string; setPrompt: (v: string) => void; projectId: number; subject?: string }) {
  const [busy, setBusy] = useState(false);
  const run = async () => {
    if (busy || prompt.trim().length < 3) return;
    setBusy(true);
    try {
      const res = await fetch(`${API_BASE}/api/fs-pro/prompt/enhance`, {
        method: "POST", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ intent: "image", baselinePrompt: prompt.trim(), subject: subject || "premium product", language: "es", projectId }),
      });
      if (res.ok) { const d = await res.json(); if (d.ok && d.enhanced) setPrompt(d.enhanced); }
    } catch {} finally { setBusy(false); }
  };
  return (
    <button onClick={run} disabled={busy}
      style={{ position: "absolute", bottom: 8, right: 8, padding: "4px 10px", borderRadius: 6, border: "1px solid var(--gold, #c8a84b44)", background: busy ? "rgba(200,168,75,0.13)" : "linear-gradient(135deg,rgba(200,168,75,0.13),rgba(200,168,75,0.06))", color: "var(--gold, #f0d68a)", fontSize: 9, fontWeight: 700, cursor: busy ? "wait" : "pointer" }}>
      {busy ? "⟳ Potenciando..." : "✦ Potenciar con IA"}
    </button>
  );
}

const TABS: Array<{ id: Tab; label: string; icon: React.ReactNode; desc: string }> = [
  { id: "generate",   label: "Generar imagen",  icon: <Sparkles size={15} />, desc: "Flux Ultra, Recraft, Ideogram v3, Imagen 4, Kontext, Nano Banana" },
  { id: "edit",       label: "Editar imagen",   icon: <Wand2 size={15} />,    desc: "Nano Banana (Gemini), Flux Kontext, Runway Gen4 Edit" },
  { id: "background", label: "Fondo",           icon: <Layers size={15} />,   desc: "Quitar / reemplazar fondo profesional (Bria RMBG)" },
  { id: "enhance",    label: "Mejorar",         icon: <Maximize2 size={15} />,desc: "Imágenes (Real-ESRGAN, Clarity, GFPGAN) y vídeo (Topaz, Real-ESRGAN Video) hasta 4K" },
  { id: "video",      label: "Video",           icon: <Video size={15} />,    desc: "Runway Gen-4, Kling 2.1, Seedance, Hailuo, Veo 3" },
  { id: "multishot",  label: "Multi-shot",      icon: <Film size={15} />,     desc: "Anuncios cinematográficos por escenas (Seedance / Kling / Veo / Runway)" },
  { id: "uploadconcat", label: "Concat propio", icon: <Film size={15} />,     desc: "Sube tus propios clips MP4 y los concatena con voz/música" },
  { id: "avatars",    label: "Avatares",        icon: <UserSquare size={15} />, desc: "Talking heads y product avatars por nicho" },
  { id: "audio",      label: "Voz & Música",    icon: <Mic size={15} />,      desc: "TTS, voice clone, SFX, música original" },
  { id: "compose",    label: "Componer",        icon: <Palette size={15} />,  desc: "Mezcla video + voz + música + texto en MP4" },
  { id: "protools",   label: "Pro tools",       icon: <Mic size={15} />,      desc: "Lip-sync, subtítulos auto, motion transfer" },
  { id: "promptlab",  label: "Prompt Lab",      icon: <Zap size={15} />,      desc: "Construye prompts cinematográficos profesionales con presets" },
  { id: "cinematic-templates", label: "Cinematic Templates", icon: <Film size={15} />, desc: "Plantillas masterpiece: Anatomía / Deconstrucción / Construcción / Exploded View / Apple-Porsche" },
  { id: "downloads",  label: "Descargas",       icon: <Download size={15} />, desc: "Exportar todos los assets en ZIP" },
];

interface FusionStudioProProps {
  /** Cuando se embebe dentro de FusionStudio se pasa el projectId vía prop;
   * si no, se obtiene del path (/projects/:id/fusion-studio-pro). */
  projectId?: number;
}

export default function FusionStudioPro({ projectId: projectIdProp }: FusionStudioProProps = {}) {
  const [, params] = useRoute("/projects/:id/fusion-studio-pro");
  const [, paramsFs] = useRoute("/projects/:id/fusion-studio");
  const projectId = projectIdProp
    ?? (params?.id ? parseInt(params.id) : (paramsFs?.id ? parseInt(paramsFs.id) : 0));

  const [tab, setTab] = useState<Tab>("generate");
  const [caps, setCaps] = useState<Capabilities | null>(null);
  const [sessionItems, setSessionItems] = useState<VaultItem[]>([]);
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null);
  const { health, loading: healthLoading, refresh: refreshHealth } = useProviderHealth();

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

      {/* HEALTH BAR — estado de los 4 motores en tiempo real */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", padding: "10px 14px", marginBottom: 16, borderRadius: 10, background: "var(--ink2, #14141d)", border: "1px solid var(--bdr, #22222e)" }}>
        <span style={{ fontSize: 11, fontWeight: 700, color: "var(--t3, #6c6c7c)", textTransform: "uppercase", letterSpacing: 0.6, marginRight: 6 }}>
          Motores IA
        </span>
        {(["replicate","runway","gemini","elevenlabs"] as ProviderId[]).map(p => (
          <ProviderBadge key={p} provider={p} health={health} />
        ))}
        <button onClick={() => refreshHealth(true)} disabled={healthLoading}
          title="Refrescar estado (sin cache)"
          style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 5, padding: "4px 10px", borderRadius: 6, background: "transparent", color: "var(--t2, #aaa)", border: "1px solid var(--bdr, #22222e)", fontSize: 11, cursor: healthLoading ? "wait" : "pointer" }}>
          <RefreshCw size={12} className={healthLoading ? "animate-spin" : ""} /> {healthLoading ? "Comprobando..." : "Refrescar"}
        </button>
      </div>

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
        {tab === "generate"   && <GenerateTab caps={caps} health={health} projectId={projectId} onSuccess={(it) => { addItem(it); showToast("Imagen generada y guardada", true); }} onError={(m) => showToast(m, false)} onCreditError={() => refreshHealth(true)} />}
        {tab === "edit"       && <EditTab     caps={caps} health={health} projectId={projectId} onSuccess={(it) => { addItem(it); showToast("Edición guardada", true); }} onError={(m) => showToast(m, false)} onCreditError={() => refreshHealth(true)} />}
        {tab === "background" && <BackgroundTab projectId={projectId} onSuccess={(it) => { addItem(it); showToast("Listo", true); }} onError={(m) => showToast(m, false)} />}
        {tab === "enhance"    && <EnhanceTab    caps={caps} projectId={projectId} onSuccess={(it) => { addItem(it); showToast(it.type === "video" ? "Vídeo mejorado" : "Imagen mejorada", true); }} onError={(m) => showToast(m, false)} />}
        {tab === "video"      && <VideoTab    caps={caps} health={health} projectId={projectId} onSuccess={(it) => { addItem(it); showToast("Video generado", true); }} onError={(m) => showToast(m, false)} onCreditError={() => refreshHealth(true)} />}
        {tab === "multishot"  && <MultiShotTab caps={caps} projectId={projectId} onSuccess={(it) => { addItem(it); showToast("Multi-shot listo", true); }} onError={(m) => showToast(m, false)} />}
        {tab === "uploadconcat" && <UploadConcatTab projectId={projectId} onSuccess={(it) => { addItem(it); showToast("Concat listo", true); }} onError={(m) => showToast(m, false)} />}
        {tab === "avatars"    && <AvatarsTab   caps={caps} projectId={projectId} onSuccess={(it) => { addItem(it); showToast("Avatar listo", true); }} onError={(m) => showToast(m, false)} />}
        {tab === "audio"      && <AudioTab    caps={caps} projectId={projectId} onSuccess={(it) => { addItem(it); showToast("Audio listo", true); }} onError={(m) => showToast(m, false)} onInfo={(m) => showToast(m, true)} />}
        {tab === "compose"    && <ComposeTab projectId={projectId} sessionItems={sessionItems} onSuccess={(it) => { addItem(it); showToast("Compose listo", true); }} onError={(m) => showToast(m, false)} />}
        {tab === "protools"   && <ProToolsTab caps={caps} projectId={projectId} sessionItems={sessionItems} onSuccess={(it) => { addItem(it); showToast("Listo", true); }} onError={(m) => showToast(m, false)} />}
        {tab === "promptlab"  && <PromptLabTab onInfo={(m) => showToast(m, true)} onError={(m) => showToast(m, false)} />}
        {tab === "cinematic-templates" && <CinematicTemplatesTab projectId={projectId} onSuccess={(it) => { addItem(it); showToast("Anuncio cinematográfico generado y guardado en Vault", true); }} onInfo={(m) => showToast(m, true)} onError={(m) => showToast(m, false)} onCreditError={() => refreshHealth(true)} />}
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
function GenerateTab({ caps, health, projectId, onSuccess, onError, onCreditError }: { caps: Capabilities | null; health: HealthMap | null; projectId: number; onSuccess: (it: VaultItem) => void; onError: (m: string) => void; onCreditError?: () => void }) {
  const [model, setModel] = useState("flux-1.1-pro");
  const [prompt, setPrompt] = useState("");
  const [aspectRatio, setAspectRatio] = useState("1:1");
  const [negativePrompt, setNegativePrompt] = useState("");
  const [referenceImageUrl, setReferenceImageUrl] = useState("");
  const [busy, setBusy] = useState(false);

  const modelCfg = caps?.imageGeneration.find(m => m.key === model);
  const currentProvider = modelCfg?.provider;
  const providerStatus = currentProvider ? health?.[currentProvider]?.status : undefined;
  const providerDown = providerStatus === "out_of_credits" || providerStatus === "down" || providerStatus === "missing_key";
  const fallback = useMemo(
    () => providerDown && caps ? suggestFallback(caps.imageGeneration, model, health) : null,
    [providerDown, caps, model, health],
  );

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
      if (!res.ok) {
        if (isCreditError(res.status, d?.error)) {
          onCreditError?.();
          const alt = caps ? suggestFallback(caps.imageGeneration, model, health) : null;
          if (alt) onError(`${PROVIDER_LABEL[currentProvider!]} sin saldo. Cambia a "${alt.label}" (${PROVIDER_LABEL[alt.provider!]}) y reintenta.`);
          else     onError(`${PROVIDER_LABEL[currentProvider!]} sin saldo y no hay otro motor con créditos. Recarga alguna API.`);
          return;
        }
        onError(d.error || `Error ${res.status}`); return;
      }
      onSuccess({ vaultId: d.vaultId, type: "image", label: prompt.slice(0, 40), dataUrl: d.dataUrl, mimeType: "image/png" });
    } catch (e: any) {
      onError(e?.message || "Error de red");
    } finally { setBusy(false); }
  };

  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
      <div>
        <Section title="Modelo">
          {providerDown && (
            <div style={{ marginBottom: 8, padding: "8px 12px", borderRadius: 8, background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.35)", color: "#ef4444", fontSize: 11, lineHeight: 1.4 }}>
              ⚠️ <strong>{PROVIDER_LABEL[currentProvider!]}</strong> está {statusLabel(providerStatus!)}.
              {fallback && <> Sugerencia: cambia a <button onClick={() => setModel(fallback.key)} style={{ background: "transparent", border: "none", color: "#fbbf24", textDecoration: "underline", cursor: "pointer", padding: 0, fontSize: 11, fontWeight: 700 }}>{fallback.label}</button> ({PROVIDER_LABEL[fallback.provider!]}).</>}
            </div>
          )}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 6 }}>
            {caps?.imageGeneration.map(m => (
              <button key={m.key} onClick={() => setModel(m.key)} style={cardButton(model === m.key)}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 2, gap: 4 }}>
                  <span style={{ fontSize: 12, fontWeight: 700 }}>{m.label}</span>
                  <ProviderBadge provider={m.provider} health={health} compact />
                </div>
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
          <div style={{ position: "relative" }}>
            <textarea value={prompt} onChange={e => setPrompt(e.target.value)} placeholder="Hyper-realistic luxury watch on black marble, dramatic side lighting, magazine photography..." style={{ ...inputStyle, minHeight: 120 }} />
            {prompt.trim().length >= 3 && (
              <ImagePromptEnhanceBtn prompt={prompt} setPrompt={setPrompt} projectId={projectId} />
            )}
          </div>
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
        <LiveOperation
          active={busy}
          title="Generando imagen profesional con IA"
          estimatedSec={25}
          messages={[
            "Enviando prompt y referencias al modelo seleccionado…",
            "Flux/SDXL generando 25-50 pasos de difusión…",
            "Aplicando post-procesado y validación de calidad…",
            "Subiendo el resultado al Vault del proyecto…",
          ]}
          className="w-full mt-3"
        />
      </div>
    </div>
  );
}

// ─── TAB: EDIT IMAGE ─────────────────────────────────────────────────────
function EditTab({ caps, health, projectId, onSuccess, onError, onCreditError }: { caps: Capabilities | null; health: HealthMap | null; projectId: number; onSuccess: (it: VaultItem) => void; onError: (m: string) => void; onCreditError?: () => void }) {
  const [model, setModel] = useState("nano-banana");
  const [prompt, setPrompt] = useState("");
  const [sourceFile, setSourceFile] = useState<File | null>(null);
  const [sourceUrl, setSourceUrl] = useState("");
  const [busy, setBusy] = useState(false);

  const modelCfg = caps?.imageEdit.find(m => m.key === model);
  const currentProvider = modelCfg?.provider;
  const providerStatus = currentProvider ? health?.[currentProvider]?.status : undefined;
  const providerDown = providerStatus === "out_of_credits" || providerStatus === "down" || providerStatus === "missing_key";
  const fallback = useMemo(
    () => providerDown && caps ? suggestFallback(caps.imageEdit, model, health) : null,
    [providerDown, caps, model, health],
  );

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
      if (!res.ok) {
        if (isCreditError(res.status, d?.error)) {
          onCreditError?.();
          const alt = caps ? suggestFallback(caps.imageEdit, model, health) : null;
          if (alt) onError(`${PROVIDER_LABEL[currentProvider!]} sin saldo. Cambia a "${alt.label}" (${PROVIDER_LABEL[alt.provider!]}) y reintenta.`);
          else     onError(`${PROVIDER_LABEL[currentProvider!]} sin saldo y no hay otro motor disponible.`);
          return;
        }
        onError(d.error || `Error ${res.status}`); return;
      }
      onSuccess({ vaultId: d.vaultId, type: "image-edit", label: prompt.slice(0, 40), dataUrl: d.dataUrl, mimeType: "image/png" });
    } catch (e: any) { onError(e?.message || "Error de red"); } finally { setBusy(false); }
  };

  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
      <div>
        <Section title="Modelo de edición">
          {providerDown && (
            <div style={{ marginBottom: 8, padding: "8px 12px", borderRadius: 8, background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.35)", color: "#ef4444", fontSize: 11, lineHeight: 1.4 }}>
              ⚠️ <strong>{PROVIDER_LABEL[currentProvider!]}</strong> está {statusLabel(providerStatus!)}.
              {fallback && <> Sugerencia: <button onClick={() => setModel(fallback.key)} style={{ background: "transparent", border: "none", color: "#fbbf24", textDecoration: "underline", cursor: "pointer", padding: 0, fontSize: 11, fontWeight: 700 }}>{fallback.label}</button> ({PROVIDER_LABEL[fallback.provider!]}).</>}
            </div>
          )}
          {caps?.imageEdit.map(m => (
            <button key={m.key} onClick={() => setModel(m.key)} style={{ ...cardButton(model === m.key), display: "block", width: "100%", textAlign: "left", marginBottom: 6 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 6 }}>
                <strong style={{ fontSize: 12 }}>{m.label}</strong>
                <ProviderBadge provider={m.provider} health={health} compact />
              </div>
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
        <LiveOperation
          active={busy}
          title="Editando imagen con IA"
          estimatedSec={20}
          messages={[
            "Subiendo imagen original al motor de edición…",
            "Aplicando el cambio descrito sin alterar el resto…",
            "Refinando bordes y consistencia de iluminación…",
            "Validando que el resultado mantenga calidad profesional…",
          ]}
          className="w-full mt-3"
        />
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
        <LiveOperation
          active={busy}
          title={mode === "remove" ? "Quitando fondo de la imagen" : "Reemplazando fondo con escena IA"}
          estimatedSec={mode === "remove" ? 12 : 25}
          messages={
            mode === "remove"
              ? [
                  "Subiendo imagen al motor de segmentación…",
                  "Detectando bordes del producto con precisión…",
                  "Generando alpha mask y exportando PNG transparente…",
                ]
              : [
                  "Subiendo imagen y prompt de escena…",
                  "Recortando producto y generando nuevo escenario…",
                  "Integrando iluminación y sombras coherentes…",
                  "Validando calidad antes de subir al Vault…",
                ]
          }
          className="w-full mt-3"
        />
      </div>
    </div>
  );
}

// ─── TAB: ENHANCE ────────────────────────────────────────────────────────
function EnhanceTab({ caps, projectId, onSuccess, onError }: { caps: Capabilities | null; projectId: number; onSuccess: (it: VaultItem) => void; onError: (m: string) => void }) {
  const [target, setTarget] = useState<"image" | "video">("image");
  // ── Imagen
  const [mode, setMode] = useState<"esrgan" | "clarity" | "faces">("esrgan");
  const [scale, setScale] = useState<2 | 4>(2);
  const [prompt, setPrompt] = useState("high detail photograph");
  const [file, setFile] = useState<File | null>(null);
  // ── Vídeo (motores reales desde capabilities, sin hardcode)
  const vEngines = caps?.videoUpscaling ?? [];
  const [vEngine, setVEngine] = useState<string>("");
  const vCfg = vEngines.find(e => e.key === vEngine) ?? vEngines[0];
  const [vResolution, setVResolution] = useState<string>("");
  const [vFile, setVFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);

  // Selecciona el primer motor disponible en cuanto cargan las capabilities.
  useEffect(() => {
    if (vCfg && vEngine !== vCfg.key) setVEngine(vCfg.key);
  }, [vCfg, vEngine]);

  // Mantén la resolución válida para el motor seleccionado.
  useEffect(() => {
    if (vCfg && !vCfg.resolutions.includes(vResolution)) setVResolution(vCfg.defaultResolution);
  }, [vCfg, vResolution]);

  const runImage = async () => {
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

  const runVideo = async () => {
    if (!vFile) { onError("Vídeo requerido"); return; }
    if (!vCfg) { onError("Motor de upscaling de vídeo no disponible"); return; }
    setBusy(true);
    try {
      const fd = new FormData();
      fd.append("projectId", String(projectId));
      fd.append("video", vFile);
      fd.append("engine", vCfg.key);
      if (vResolution) fd.append("resolution", vResolution);
      const res = await fetch(`${API_BASE}/api/fs-pro/upscale-video`, { method: "POST", credentials: "include", body: fd });
      const d = await res.json();
      if (!res.ok) { onError(d.error || `Error ${res.status}`); return; }
      onSuccess({ vaultId: d.vaultId, type: "video", label: `Upscale ${vCfg.key} ${vResolution}`, mimeType: "video/mp4" });
    } catch (e: any) { onError(e?.message || "Error"); } finally { setBusy(false); }
  };

  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
      <div>
        <Section title="Tipo de archivo">
          <div style={{ display: "flex", gap: 6 }}>
            <button onClick={() => setTarget("image")} style={pillButton(target === "image")}>Imagen</button>
            <button onClick={() => setTarget("video")} style={pillButton(target === "video")}>Vídeo</button>
          </div>
        </Section>

        {target === "image" ? (
          <>
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
          </>
        ) : (
          <>
            <Section title="Motor de upscaling de vídeo">
              {vEngines.length === 0 ? (
                <p style={{ fontSize: 11, color: "var(--t3)" }}>Cargando motores…</p>
              ) : (
                vEngines.map(e => (
                  <button key={e.key} onClick={() => setVEngine(e.key)} style={{ ...cardButton(vCfg?.key === e.key), display: "block", width: "100%", textAlign: "left", marginBottom: 6 }}>
                    <strong style={{ fontSize: 12 }}>{e.label}</strong>
                    <div style={{ fontSize: 10, color: "var(--t3)", marginTop: 2 }}>{e.description}</div>
                  </button>
                ))
              )}
            </Section>
            {vCfg && (
              <Section title="Resolución objetivo">
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                  {vCfg.resolutions.map(r => (
                    <button key={r} onClick={() => setVResolution(r)} style={pillButton(vResolution === r)}>{r}</button>
                  ))}
                </div>
              </Section>
            )}
            <Section title="Vídeo origen (MP4 / MOV / WebM)">
              <input type="file" accept="video/*" onChange={e => setVFile(e.target.files?.[0] || null)} />
            </Section>
          </>
        )}
      </div>
      <div>
        {target === "image" ? (
          <>
            <button onClick={runImage} disabled={busy || !file} className="btn btn-gold" style={{ width: "100%", justifyContent: "center", padding: "12px 20px" }}>
              {busy ? <Loader2 size={16} className="animate-spin" /> : <Maximize2 size={16} />} {busy ? "Mejorando..." : "Mejorar imagen"}
            </button>
            <LiveOperation
              active={busy}
              title="Mejorando resolución y calidad"
              estimatedSec={20}
              messages={[
                "Subiendo imagen al motor de upscaling…",
                "Reconstruyendo detalles a alta resolución…",
                "Refinando texturas, bordes y rostros…",
                "Exportando versión mejorada al Vault…",
              ]}
              className="w-full mt-3"
            />
          </>
        ) : (
          <>
            <button onClick={runVideo} disabled={busy || !vFile || vEngines.length === 0} className="btn btn-gold" style={{ width: "100%", justifyContent: "center", padding: "12px 20px" }}>
              {busy ? <Loader2 size={16} className="animate-spin" /> : <Maximize2 size={16} />} {busy ? "Escalando vídeo..." : "Escalar resolución del vídeo"}
            </button>
            <p style={{ fontSize: 10, color: "var(--t3)", margin: "8px 0 0", lineHeight: 1.4 }}>
              El upscaling de vídeo es un proceso pesado: puede tardar varios minutos según la duración y la resolución objetivo.
            </p>
            <LiveOperation
              active={busy}
              title="Escalando resolución del vídeo"
              estimatedSec={180}
              messages={[
                "Subiendo vídeo al motor de super-resolución…",
                "Analizando fotogramas y movimiento…",
                "Reconstruyendo detalle a alta resolución…",
                "Re-codificando el vídeo final en MP4…",
                "Guardando versión escalada en el Vault…",
              ]}
              className="w-full mt-3"
            />
          </>
        )}
      </div>
    </div>
  );
}

// ─── TAB: VIDEO ──────────────────────────────────────────────────────────
// Modelos que NO soportan text-to-video puro → exigen imagen origen.
const I2V_ONLY_MODELS = new Set(["runway-gen4-turbo", "runway-gen3-alpha", "wan-2.5-fast"]);

type VideoMode = "t2v" | "i2v" | "v2v";

function VideoTab({ caps, health, projectId, onSuccess, onError, onCreditError }: { caps: Capabilities | null; health: HealthMap | null; projectId: number; onSuccess: (it: VaultItem) => void; onError: (m: string) => void; onCreditError?: () => void }) {
  const [mode, setMode] = useState<VideoMode>("i2v");
  const [model, setModel] = useState("seedance-fast");
  const [prompt, setPrompt] = useState("");
  const [duration, setDuration] = useState(5);
  const [aspect, setAspect] = useState("9:16");
  const [file, setFile] = useState<File | null>(null);
  const [sourceUrl, setSourceUrl] = useState("");
  const [cameraPreset, setCameraPreset] = useState<string>("");
  const [busy, setBusy] = useState(false);

  const modelCfg = caps?.videoGeneration.find(m => m.key === model);
  const currentProvider = modelCfg?.provider;
  const providerStatus = currentProvider ? health?.[currentProvider]?.status : undefined;
  const providerDown = providerStatus === "out_of_credits" || providerStatus === "down" || providerStatus === "missing_key";
  const fallback = useMemo(
    () => providerDown && caps ? suggestFallback(caps.videoGeneration, model, health) : null,
    [providerDown, caps, model, health],
  );

  // Si el modelo seleccionado no soporta T2V, fuerza I2V automáticamente.
  useEffect(() => {
    if (mode === "t2v" && I2V_ONLY_MODELS.has(model)) setMode("i2v");
  }, [model, mode]);

  const run = async () => {
    if (!prompt.trim()) { onError("Prompt requerido"); return; }
    if (mode === "i2v" && !file && !sourceUrl) { onError("Imagen origen requerida en modo Imagen → Vídeo"); return; }
    if (mode === "v2v") { onError("Vídeo → Vídeo aún no disponible. Usa ProTools → Motion transfer como alternativa."); return; }
    setBusy(true);
    try {
      const fd = new FormData();
      fd.append("projectId", String(projectId));
      fd.append("model", model); fd.append("prompt", prompt);
      fd.append("duration", String(duration)); fd.append("aspect", aspect);
      if (cameraPreset) fd.append("cameraPreset", cameraPreset);
      // En T2V puro NO se envía imagen aunque haya quedado seleccionada.
      if (mode === "i2v") {
        if (file) fd.append("image", file);
        if (sourceUrl) fd.append("sourceImageUrl", sourceUrl);
      }
      const res = await fetch(`${API_BASE}/api/fs-pro/generate-video`, { method: "POST", credentials: "include", body: fd });
      const d = await res.json();
      if (!res.ok) {
        if (isCreditError(res.status, d?.error)) {
          onCreditError?.();
          const alt = caps ? suggestFallback(caps.videoGeneration, model, health) : null;
          if (alt) onError(`${PROVIDER_LABEL[currentProvider!]} sin saldo. Cambia a "${alt.label}" (${PROVIDER_LABEL[alt.provider!]}) y reintenta.`);
          else     onError(`${PROVIDER_LABEL[currentProvider!]} sin saldo y no hay otro motor de vídeo con créditos.`);
          return;
        }
        onError(d.error || `Error ${res.status}`); return;
      }
      onSuccess({ vaultId: d.vaultId, type: "video", label: prompt.slice(0, 30), mimeType: "video/mp4" });
    } catch (e: any) { onError(e?.message || "Error"); } finally { setBusy(false); }
  };

  const modelSupportsT2V = !I2V_ONLY_MODELS.has(model);

  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
      <div>
        <Section title="Modo de generación">
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 6 }}>
            <button
              onClick={() => setMode("t2v")}
              disabled={!modelSupportsT2V}
              title={!modelSupportsT2V ? `${model} sólo soporta Imagen → Vídeo` : "Texto → Vídeo (sin imagen origen)"}
              style={{ ...cardButton(mode === "t2v"), opacity: modelSupportsT2V ? 1 : 0.4, cursor: modelSupportsT2V ? "pointer" : "not-allowed", padding: "10px 8px" }}>
              <div style={{ fontSize: 11, fontWeight: 700 }}>Texto → Vídeo</div>
              <div style={{ fontSize: 9, color: "var(--t3)", marginTop: 2 }}>Sólo prompt</div>
            </button>
            <button
              onClick={() => setMode("i2v")}
              style={{ ...cardButton(mode === "i2v"), padding: "10px 8px" }}>
              <div style={{ fontSize: 11, fontWeight: 700 }}>Imagen → Vídeo</div>
              <div style={{ fontSize: 9, color: "var(--t3)", marginTop: 2 }}>Animar foto</div>
            </button>
            <button
              onClick={() => setMode("v2v")}
              disabled
              title="Próximamente — usa ProTools → Motion transfer"
              style={{ ...cardButton(false), opacity: 0.45, cursor: "not-allowed", padding: "10px 8px" }}>
              <div style={{ fontSize: 11, fontWeight: 700 }}>Vídeo → Vídeo</div>
              <div style={{ fontSize: 9, color: "var(--t3)", marginTop: 2 }}>Próximamente</div>
            </button>
          </div>
          {mode === "t2v" && (
            <p style={{ fontSize: 10, color: "var(--t3)", margin: "8px 0 0", lineHeight: 1.4 }}>
              Modo Texto → Vídeo: el modelo genera el clip a partir del prompt sin imagen origen. Disponible en Veo, Kling, Seedance y Hailuo.
            </p>
          )}
        </Section>
        <Section title="Modelo">
          {providerDown && (
            <div style={{ marginBottom: 8, padding: "8px 12px", borderRadius: 8, background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.35)", color: "#ef4444", fontSize: 11, lineHeight: 1.4 }}>
              ⚠️ <strong>{PROVIDER_LABEL[currentProvider!]}</strong> está {statusLabel(providerStatus!)}.
              {fallback && <> Sugerencia: <button onClick={() => setModel(fallback.key)} style={{ background: "transparent", border: "none", color: "#fbbf24", textDecoration: "underline", cursor: "pointer", padding: 0, fontSize: 11, fontWeight: 700 }}>{fallback.label}</button> ({PROVIDER_LABEL[fallback.provider!]}).</>}
            </div>
          )}
          {caps?.videoGeneration.map(m => (
            <button key={m.key} onClick={() => setModel(m.key)} style={{ ...cardButton(model === m.key), display: "block", width: "100%", textAlign: "left", marginBottom: 6 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 6 }}>
                <strong style={{ fontSize: 12 }}>{m.label}</strong>
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <ProviderBadge provider={m.provider} health={health} compact />
                  <span style={{ fontSize: 10, color: "var(--gold)" }}>~€{m.costPerSec}/s · Q{m.quality}/10</span>
                </div>
              </div>
              <div style={{ fontSize: 10, color: "var(--t3)", marginTop: 2 }}>{m.description}</div>
            </button>
          ))}
        </Section>
      </div>
      <div>
        <Section title="Prompt">
          <div style={{ position: "relative" }}>
            <textarea value={prompt} onChange={e => setPrompt(e.target.value)} placeholder="Cinematic dolly-in product reveal, soft golden lighting, slow motion at 30fps..." style={{ ...inputStyle, minHeight: 100 }} />
            {prompt.trim().length >= 3 && (
              <VideoPromptEnhanceBtn prompt={prompt} setPrompt={setPrompt} projectId={projectId} />
            )}
          </div>
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
        {mode === "i2v" && (
          <Section title="Imagen origen (requerida)">
            <input type="file" accept="image/*" onChange={e => setFile(e.target.files?.[0] || null)} />
            <p style={{ fontSize: 10, color: "var(--t3)", margin: "6px 0" }}>O URL pública:</p>
            <input value={sourceUrl} onChange={e => setSourceUrl(e.target.value)} placeholder="https://..." style={inputStyle} />
          </Section>
        )}
        {mode === "t2v" && (
          <Section title="Imagen origen">
            <p style={{ fontSize: 11, color: "var(--t3)", lineHeight: 1.4, margin: 0 }}>
              No se usa imagen en modo Texto → Vídeo. Cambia a "Imagen → Vídeo" si quieres animar una foto concreta.
            </p>
          </Section>
        )}
        {caps?.cameraPresets && caps.cameraPresets.length > 0 && (
          <Section title="Movimiento de cámara (preset)">
            <select value={cameraPreset} onChange={e => setCameraPreset(e.target.value)} style={inputStyle}>
              <option value="">Sin preset (libre)</option>
              {caps.cameraPresets.map(p => (
                <option key={p.key} value={p.key}>{p.label}</option>
              ))}
            </select>
            {cameraPreset && (
              <p style={{ fontSize: 10, color: "var(--t3)", margin: "6px 0 0" }}>
                {caps.cameraPresets.find(p => p.key === cameraPreset)?.description}
              </p>
            )}
          </Section>
        )}
        <button onClick={run} disabled={busy} className="btn btn-gold" style={{ width: "100%", justifyContent: "center", padding: "12px 20px" }}>
          {busy ? <Loader2 size={16} className="animate-spin" /> : <Video size={16} />} {busy ? "Generando video..." : "Generar video (1-3 min)"}
        </button>
        <LiveOperation
          active={busy}
          title="Generando video con IA"
          estimatedSec={150}
          messages={[
            "Enviando prompt y frame de origen al modelo de video…",
            "Renderizando 24-30 fps por segundo de salida…",
            "El proceso completo tarda 1-3 minutos según duración.",
            "El servidor sigue trabajando aunque cierres la pestaña.",
            "Codificando MP4 final y subiendo al Vault…",
          ]}
          className="w-full mt-3"
        />
      </div>
    </div>
  );
}

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

      <div style={{ marginTop: 14 }}>
        <LiveOperation
          active={busy}
          title={
            mode === "tts" ? "Sintetizando voz con ElevenLabs" :
            mode === "clone" ? "Clonando voz desde tu muestra" :
            mode === "sfx" ? `Generando SFX (${duration}s)` :
            `Generando música (${musicDuration}s)`
          }
          estimatedSec={
            mode === "tts" ? 12 :
            mode === "clone" ? 30 :
            mode === "sfx" ? Math.max(15, duration * 2) :
            Math.max(45, musicDuration * 1.5)
          }
          messages={
            mode === "tts" ? [
              "Procesando texto y aplicando configuración de voz…",
              "Sintetizando audio con el modelo seleccionado…",
              "Subiendo MP3 al Vault del proyecto…",
            ] : mode === "clone" ? [
              "Subiendo muestra de audio a ElevenLabs…",
              "Entrenando huella vocal con tu sample…",
              "Validando calidad del clon — proceso pesado.",
              "El servidor sigue trabajando aunque cierres la pestaña.",
            ] : mode === "sfx" ? [
              "Generando efecto de sonido con IA…",
              "Refinando textura y dinámicas…",
              "Exportando MP3 al Vault…",
            ] : [
              "Componiendo música con IA generativa…",
              "Ajustando BPM, instrumentos y arreglos…",
              "El renderizado puede tardar más en pistas largas.",
              "Subiendo WAV al Vault del proyecto…",
            ]
          }
          className="w-full"
        />
      </div>
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
        <LiveOperation
          active={busy}
          title="Componiendo MP4 final con FFmpeg"
          estimatedSec={90}
          messages={[
            "Descargando video, voz y música del Vault…",
            "Mezclando pistas de audio según niveles configurados…",
            "Aplicando overlays de texto si los hay…",
            "Re-encodeando a H.264 + AAC para compatibilidad universal…",
            "Subiendo el resultado final al Vault — proceso pesado.",
          ]}
          className="w-full mt-3"
        />
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
        {sessionItems.map((it, i) => {
          // El backend sirve el binario en este endpoint con cookie de sesión.
          const previewSrc = `${API_BASE}/api/projects/${projectId}/vault/${it.vaultId}/preview`;
          const downloadSrc = `${API_BASE}/api/projects/${projectId}/vault/${it.vaultId}/download`;
          const isVideo = it.mimeType?.startsWith("video");
          const isAudio = it.mimeType?.startsWith("audio");
          const isImage = it.mimeType?.startsWith("image");
          return (
            <div key={i} style={{ position: "relative", borderRadius: 10, overflow: "hidden", background: "var(--ink2)", border: `1px solid ${selected.has(it.vaultId) ? "var(--gold)" : "var(--bdr)"}`, aspectRatio: "1 / 1" }}>
              <input
                type="checkbox"
                checked={selected.has(it.vaultId)}
                onChange={() => toggle(it.vaultId)}
                style={{ position: "absolute", top: 8, left: 8, zIndex: 3, accentColor: "var(--gold)", width: 18, height: 18 }}
                title="Seleccionar para descarga ZIP"
              />
              <a
                href={previewSrc}
                target="_blank"
                rel="noreferrer"
                title={`#${it.vaultId} · abrir a tamaño real`}
                style={{ position: "absolute", top: 6, right: 6, zIndex: 3, padding: "2px 6px", borderRadius: 4, background: "rgba(0,0,0,0.6)", color: "#fff", fontSize: 9, fontWeight: 700, textDecoration: "none" }}>
                #{it.vaultId} ↗
              </a>
              {isImage ? (
                <img src={it.dataUrl || previewSrc} style={{ width: "100%", height: "100%", objectFit: "cover" }} alt={it.label} />
              ) : isVideo ? (
                <video
                  src={previewSrc}
                  controls
                  preload="metadata"
                  playsInline
                  style={{ width: "100%", height: "100%", objectFit: "cover", background: "#0b0b14" }}
                  onError={(e) => { (e.currentTarget as HTMLVideoElement).style.display = "none"; }}
                />
              ) : isAudio ? (
                <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", width: "100%", height: "100%", background: "linear-gradient(135deg, #1f2a3d, #14141d)", padding: 12 }}>
                  <Volume2 size={28} style={{ color: "#a5b4fc", marginBottom: 8 }} />
                  <audio src={previewSrc} controls style={{ width: "100%", maxWidth: 160 }} />
                </div>
              ) : (
                <a href={downloadSrc} target="_blank" rel="noreferrer" style={{ display: "flex", alignItems: "center", justifyContent: "center", width: "100%", height: "100%", color: "var(--t2)", fontSize: 11, textDecoration: "underline" }}>
                  Descargar
                </a>
              )}
              <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, padding: "6px 8px", background: "rgba(0,0,0,0.75)", color: "#fff", fontSize: 10, pointerEvents: "none" }}>
                {it.label}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── TAB: PRO TOOLS (lip-sync · auto-subs · motion-transfer · concat) ───
function ProToolsTab({ caps, projectId, sessionItems, onSuccess, onError }: { caps: Capabilities | null; projectId: number; sessionItems: VaultItem[]; onSuccess: (it: VaultItem) => void; onError: (m: string) => void }) {
  const [mode, setMode] = useState<"lipsync" | "subs" | "motion" | "concat">("lipsync");
  const [busy, setBusy] = useState(false);

  // Lip-sync state
  const [lsVideo, setLsVideo] = useState<number | "">("");
  const [lsAudio, setLsAudio] = useState<number | "">("");

  // Subs state
  const [subVideo, setSubVideo] = useState<number | "">("");
  const [subLang, setSubLang] = useState<string>("auto");
  const [subFontSize, setSubFontSize] = useState<number>(32);

  // Motion transfer state
  const [mtImage, setMtImage] = useState<File | null>(null);
  const [mtRef, setMtRef] = useState<File | null>(null);

  // Concat state
  const [concatIds, setConcatIds] = useState<number[]>([]);
  const [transitionPreset, setTransitionPreset] = useState<string>("");
  const [transitionDuration, setTransitionDuration] = useState<number>(0.5);

  const videoVaultItems = sessionItems.filter(it => it.mimeType?.startsWith("video"));
  const audioVaultItems = sessionItems.filter(it => it.mimeType?.startsWith("audio"));

  const runLipSync = async () => {
    if (!lsVideo || !lsAudio) { onError("Selecciona video + audio"); return; }
    setBusy(true);
    try {
      const res = await fetch(`${API_BASE}/api/fs-pro/lip-sync`, {
        method: "POST", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId, videoVaultId: lsVideo, audioVaultId: lsAudio }),
      });
      const d = await res.json();
      if (!res.ok) { onError(d.error || `HTTP ${res.status}`); return; }
      onSuccess({ vaultId: d.vaultId, type: "video", label: `Lip-sync ${lsVideo}`, mimeType: "video/mp4" });
    } catch (e: any) { onError(e?.message || "Error"); } finally { setBusy(false); }
  };

  const runBurnSubs = async () => {
    if (!subVideo) { onError("Selecciona un video"); return; }
    setBusy(true);
    try {
      const res = await fetch(`${API_BASE}/api/fs-pro/burn-subs`, {
        method: "POST", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId, videoVaultId: subVideo,
          language: subLang === "auto" ? undefined : subLang,
          style: { fontSizePx: subFontSize, alignment: 2, marginVPx: 80, primaryColorHex: "FFFFFF", outlineColorHex: "000000", outlinePx: 3 },
        }),
      });
      const d = await res.json();
      if (!res.ok) { onError(d.error || `HTTP ${res.status}`); return; }
      onSuccess({ vaultId: d.vaultId, type: "video", label: `Subs ${subVideo}`, mimeType: "video/mp4" });
    } catch (e: any) { onError(e?.message || "Error"); } finally { setBusy(false); }
  };

  const runMotion = async () => {
    if (!mtImage || !mtRef) { onError("Sube imagen + video referencia"); return; }
    setBusy(true);
    try {
      const fd = new FormData();
      fd.append("projectId", String(projectId));
      fd.append("image", mtImage);
      fd.append("refVideo", mtRef);
      const res = await fetch(`${API_BASE}/api/fs-pro/motion-transfer`, { method: "POST", credentials: "include", body: fd });
      const d = await res.json();
      if (!res.ok) { onError(d.error || `HTTP ${res.status}`); return; }
      onSuccess({ vaultId: d.vaultId, type: "video", label: "Motion transfer", mimeType: "video/mp4" });
    } catch (e: any) { onError(e?.message || "Error"); } finally { setBusy(false); }
  };

  return (
    <div style={{ display: "grid", gridTemplateColumns: "200px 1fr", gap: 16 }}>
      <div>
        {[
          { k: "lipsync", l: "Lip-sync" },
          { k: "subs",    l: "Subtítulos auto" },
          { k: "motion",  l: "Motion transfer" },
          { k: "concat",  l: "Concat + transitions" },
        ].map(o => (
          <button key={o.k} onClick={() => setMode(o.k as any)} style={{ ...cardButton(mode === o.k), display: "block", width: "100%", textAlign: "left", marginBottom: 6 }}>
            {o.l}
          </button>
        ))}
        <p style={{ fontSize: 10, color: "var(--t3)", marginTop: 12, lineHeight: 1.5 }}>
          Estas operaciones consumen créditos de video. Lip-sync ≈ 4, Subs ≈ 2, Motion ≈ 6.
        </p>
      </div>
      <div>
        {mode === "lipsync" && (
          <>
            <Section title="Video (de la sesión)">
              <select value={lsVideo} onChange={e => setLsVideo(e.target.value ? parseInt(e.target.value) : "")} style={inputStyle}>
                <option value="">— Elige un video —</option>
                {videoVaultItems.map(v => (<option key={v.vaultId} value={v.vaultId}>#{v.vaultId} · {v.label}</option>))}
              </select>
            </Section>
            <Section title="Audio (de la sesión)">
              <select value={lsAudio} onChange={e => setLsAudio(e.target.value ? parseInt(e.target.value) : "")} style={inputStyle}>
                <option value="">— Elige un audio —</option>
                {audioVaultItems.map(v => (<option key={v.vaultId} value={v.vaultId}>#{v.vaultId} · {v.label}</option>))}
              </select>
            </Section>
            <button onClick={runLipSync} disabled={busy} className="btn btn-gold" style={{ width: "100%", padding: "12px 20px", justifyContent: "center" }}>
              {busy ? <Loader2 size={16} className="animate-spin" /> : <Mic size={16} />} {busy ? "Sincronizando..." : "Sincronizar labios"}
            </button>
          </>
        )}
        {mode === "subs" && (
          <>
            <Section title="Video (de la sesión)">
              <select value={subVideo} onChange={e => setSubVideo(e.target.value ? parseInt(e.target.value) : "")} style={inputStyle}>
                <option value="">— Elige un video —</option>
                {videoVaultItems.map(v => (<option key={v.vaultId} value={v.vaultId}>#{v.vaultId} · {v.label}</option>))}
              </select>
            </Section>
            <Section title="Idioma">
              <select value={subLang} onChange={e => setSubLang(e.target.value)} style={inputStyle}>
                <option value="auto">Auto-detectar</option>
                <option value="es">Español</option>
                <option value="en">English</option>
                <option value="pt">Português</option>
                <option value="fr">Français</option>
                <option value="de">Deutsch</option>
                <option value="it">Italiano</option>
              </select>
            </Section>
            <Section title="Tamaño de fuente (px)">
              <input type="range" min={18} max={48} value={subFontSize} onChange={e => setSubFontSize(parseInt(e.target.value))} style={{ width: "100%" }} />
              <p style={{ fontSize: 11, color: "var(--t3)" }}>{subFontSize}px</p>
            </Section>
            <button onClick={runBurnSubs} disabled={busy} className="btn btn-gold" style={{ width: "100%", padding: "12px 20px", justifyContent: "center" }}>
              {busy ? <Loader2 size={16} className="animate-spin" /> : <Wand2 size={16} />} {busy ? "Transcribiendo y quemando..." : "Quemar subtítulos"}
            </button>
          </>
        )}
        {mode === "motion" && (
          <>
            <Section title="Imagen origen (sujeto)">
              <input type="file" accept="image/*" onChange={e => setMtImage(e.target.files?.[0] || null)} />
            </Section>
            <Section title="Video referencia (movimiento)">
              <input type="file" accept="video/*" onChange={e => setMtRef(e.target.files?.[0] || null)} />
              <p style={{ fontSize: 10, color: "var(--t3)", margin: "6px 0 0" }}>
                El movimiento del video se transfiere al sujeto de la imagen.
              </p>
            </Section>
            <button onClick={runMotion} disabled={busy || !mtImage || !mtRef} className="btn btn-gold" style={{ width: "100%", padding: "12px 20px", justifyContent: "center" }}>
              {busy ? <Loader2 size={16} className="animate-spin" /> : <Video size={16} />} {busy ? "Transfiriendo movimiento..." : "Generar (2-4 min)"}
            </button>
          </>
        )}
        {mode === "concat" && (
          <>
            <Section title="Disponibles">
              {videoVaultItems.length === 0 ? (
                <p style={{ fontSize: 11, color: "var(--t3)" }}>Genera primero al menos 2 videos.</p>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                  {videoVaultItems.filter(v => !concatIds.includes(v.vaultId)).map(v => (
                    <button
                      key={v.vaultId}
                      onClick={() => setConcatIds(prev => [...prev, v.vaultId])}
                      style={{ display: "flex", alignItems: "center", gap: 8, padding: 8, borderRadius: 6, background: "var(--ink2)", border: "1px solid var(--bdr)", cursor: "pointer", textAlign: "left", color: "var(--t2)", fontSize: 12 }}>
                      <span style={{ flex: 1 }}>#{v.vaultId} · {v.label}</span>
                      <span style={{ fontSize: 10, color: "var(--gold)" }}>+ añadir</span>
                    </button>
                  ))}
                  {videoVaultItems.length > 0 && videoVaultItems.every(v => concatIds.includes(v.vaultId)) && (
                    <p style={{ fontSize: 11, color: "var(--t3)", fontStyle: "italic" }}>Todos los videos ya están en el timeline.</p>
                  )}
                </div>
              )}
            </Section>
            <Section title={`Timeline (${concatIds.length} clips · arrastra el orden con ↑↓)`}>
              {concatIds.length === 0 ? (
                <p style={{ fontSize: 11, color: "var(--t3)" }}>Añade clips desde la lista superior para construir tu secuencia.</p>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  {concatIds.map((vaultId, idx) => {
                    const v = videoVaultItems.find(x => x.vaultId === vaultId);
                    const moveUp = () => setConcatIds(prev => {
                      if (idx === 0) return prev;
                      const next = [...prev]; [next[idx - 1], next[idx]] = [next[idx], next[idx - 1]]; return next;
                    });
                    const moveDown = () => setConcatIds(prev => {
                      if (idx === prev.length - 1) return prev;
                      const next = [...prev]; [next[idx], next[idx + 1]] = [next[idx + 1], next[idx]]; return next;
                    });
                    const remove = () => setConcatIds(prev => prev.filter(i => i !== vaultId));
                    return (
                      <div key={vaultId} style={{ display: "flex", alignItems: "center", gap: 8, padding: 8, borderRadius: 8, background: "linear-gradient(90deg, rgba(200,168,75,0.10), rgba(200,168,75,0.02))", border: "1px solid rgba(200,168,75,0.35)" }}>
                        <span style={{ fontSize: 11, fontWeight: 800, color: "var(--gold)", minWidth: 28, textAlign: "center", padding: "4px 6px", borderRadius: 4, background: "rgba(0,0,0,0.3)" }}>#{idx + 1}</span>
                        <span style={{ fontSize: 12, flex: 1, color: "var(--t1)" }}>#{vaultId} · {v?.label ?? "(?)"}</span>
                        <button onClick={moveUp} disabled={idx === 0} title="Subir" style={{ ...pillButton(false), opacity: idx === 0 ? 0.3 : 1, cursor: idx === 0 ? "not-allowed" : "pointer", padding: "4px 8px" }}>↑</button>
                        <button onClick={moveDown} disabled={idx === concatIds.length - 1} title="Bajar" style={{ ...pillButton(false), opacity: idx === concatIds.length - 1 ? 0.3 : 1, cursor: idx === concatIds.length - 1 ? "not-allowed" : "pointer", padding: "4px 8px" }}>↓</button>
                        <button onClick={remove} title="Quitar" style={{ ...pillButton(false), padding: "4px 8px", color: "#ef4444", borderColor: "rgba(239,68,68,0.35)" }}>×</button>
                      </div>
                    );
                  })}
                  {concatIds.length >= 2 && (
                    <p style={{ fontSize: 10, color: "var(--t3)", margin: "6px 0 0", lineHeight: 1.4 }}>
                      Resultado: secuencia de {concatIds.length} clips
                      {transitionPreset ? ` con transición "${caps?.transitionPresets?.find(t => t.key === transitionPreset)?.label || transitionPreset}" (${transitionDuration.toFixed(1)}s)` : " unidos por corte directo"}.
                    </p>
                  )}
                </div>
              )}
            </Section>
            {caps?.transitionPresets && caps.transitionPresets.length > 0 && (
              <Section title="Transición temática">
                <select value={transitionPreset} onChange={e => setTransitionPreset(e.target.value)} style={inputStyle}>
                  <option value="">Sin transición (corte directo)</option>
                  {caps.transitionPresets.map(t => (
                    <option key={t.key} value={t.key}>{t.label} ({t.xfade})</option>
                  ))}
                </select>
                {transitionPreset && (
                  <div style={{ marginTop: 10 }}>
                    <label style={{ fontSize: 11, color: "var(--t3)" }}>Duración transición: {transitionDuration.toFixed(2)}s</label>
                    <input type="range" min={0.2} max={2.0} step={0.1} value={transitionDuration} onChange={e => setTransitionDuration(parseFloat(e.target.value))} style={{ width: "100%" }} />
                  </div>
                )}
              </Section>
            )}
            <button
              onClick={async () => {
                if (concatIds.length < 2) { onError("Selecciona al menos 2 videos"); return; }
                setBusy(true);
                try {
                  const res = await fetch(`${API_BASE}/api/fs-pro/concat`, {
                    method: "POST", credentials: "include",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                      projectId, videoVaultIds: concatIds,
                      transitionPreset: transitionPreset || undefined,
                      crossfadeSec: transitionPreset ? transitionDuration : undefined,
                    }),
                  });
                  const d = await res.json();
                  if (!res.ok) { onError(d.error || `HTTP ${res.status}`); return; }
                  onSuccess({ vaultId: d.vaultId, type: "video", label: `Concat ${concatIds.length} clips`, mimeType: "video/mp4" });
                } catch (e: any) { onError(e?.message || "Error"); } finally { setBusy(false); }
              }}
              disabled={busy || concatIds.length < 2}
              className="btn btn-gold" style={{ width: "100%", padding: "12px 20px", justifyContent: "center" }}>
              {busy ? <Loader2 size={16} className="animate-spin" /> : <Palette size={16} />} {busy ? "Concatenando..." : `Concatenar ${concatIds.length} videos`}
            </button>
          </>
        )}

        <div style={{ marginTop: 14 }}>
          <LiveOperation
            active={busy}
            title={
              mode === "lipsync" ? "Sincronizando labios con audio (lip-sync)" :
              mode === "subs" ? "Quemando subtítulos en el video" :
              mode === "motion" ? "Transfiriendo movimiento entre clips" :
              "Concatenando videos con FFmpeg"
            }
            estimatedSec={
              mode === "lipsync" ? 180 :
              mode === "subs" ? 60 :
              mode === "motion" ? 240 :
              45
            }
            messages={
              mode === "lipsync" ? [
                "Analizando fonemas del audio…",
                "Mapeando movimientos labiales frame a frame…",
                "Lip-sync es una operación pesada — 2 a 4 minutos.",
                "El servidor sigue trabajando aunque cierres la pestaña.",
              ] : mode === "subs" ? [
                "Extrayendo audio del video…",
                "Transcribiendo con Whisper en el idioma seleccionado…",
                "Renderizando subtítulos con tu estilo configurado…",
                "Re-encodeando MP4 final con subs quemados…",
              ] : mode === "motion" ? [
                "Subiendo imagen base y video referencia…",
                "Extrayendo trayectoria de movimiento del clip…",
                "Aplicando movimiento sobre tu imagen — proceso muy pesado.",
                "Puede tardar 3 a 5 minutos según resolución.",
              ] : [
                "Descargando los videos seleccionados del Vault…",
                "Aplicando transición temática si la configuraste…",
                "Re-encodeando concat final con FFmpeg…",
              ]
            }
            className="w-full"
          />
        </div>
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

// ─── TAB: MULTI-SHOT (orquesta Seedance Pro / Kling / Veo) ────────────────
function MultiShotTab({ caps, projectId, onSuccess, onError }: { caps: Capabilities | null; projectId: number; onSuccess: (it: VaultItem) => void; onError: (m: string) => void }) {
  const [brand, setBrand] = useState("");
  const [productName, setProductName] = useState("");
  const [niche, setNiche] = useState("");
  const [audience, setAudience] = useState("");
  const [language, setLanguage] = useState("es");
  const [scenesCount, setScenesCount] = useState(4);
  const [totalDurationSec, setTotalDurationSec] = useState(20);
  const [aspect, setAspect] = useState<"9:16" | "16:9" | "1:1">("9:16");
  const [videoModel, setVideoModel] = useState("seedance-fast");
  const [imageModel, setImageModel] = useState("nano-banana");
  const [style, setStyle] = useState("cinematic");
  const [customBrief, setCustomBrief] = useState("");
  const [productFile, setProductFile] = useState<File | null>(null);
  const [narrationEnabled, setNarrationEnabled] = useState(true);
  const [narrationVoiceId, setNarrationVoiceId] = useState("");
  const [musicEnabled, setMusicEnabled] = useState(true);
  const [musicPrompt, setMusicPrompt] = useState("");
  const [busy, setBusy] = useState(false);
  const [busyMode, setBusyMode] = useState<"script" | "render" | "save" | null>(null);
  const [editableScript, setEditableScript] = useState<any | null>(null);
  const editableScriptRef = useRef<any | null>(null);
  useEffect(() => { editableScriptRef.current = editableScript; }, [editableScript]);
  const [activeTemplateId, setActiveTemplateId] = useState<string>("");
  const [templates, setTemplates] = useState<Array<{ id: string; name: string; description: string | null; useCount: number | null; isPublic: number | null; niche: string | null }>>([]);

  const styles = (caps as any)?.cinematicMultiShot?.styles ?? [
    { key: "cinematic", label: "Cinematic", description: "Look anamórfico" },
    { key: "ugc", label: "UGC", description: "Estilo creador" },
    { key: "luxury", label: "Luxury", description: "Premium reveal" },
  ];

  // ─── Templates: load on mount + after save ────────────────────────────
  const refreshTemplates = async () => {
    try {
      const r = await fetch(`${API_BASE}/api/fs-pro/cinematic-prompts?projectId=${projectId}&limit=100`, { credentials: "include" });
      const d = await r.json();
      if (r.ok && Array.isArray(d.items)) setTemplates(d.items);
    } catch {/* silent */}
  };
  useEffect(() => { refreshTemplates(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [projectId]);

  const loadTemplate = async (id: string) => {
    if (!id) { setActiveTemplateId(""); setEditableScript(null); return; }
    try {
      const r = await fetch(`${API_BASE}/api/fs-pro/cinematic-prompts/${id}`, { credentials: "include" });
      const d = await r.json();
      if (!r.ok) { onError(d.error || "No se pudo cargar plantilla"); return; }
      setActiveTemplateId(id);
      setEditableScript(d.script);
      // Auto-rellenar config base si la plantilla la trae
      const cfg = d.config || {};
      if (cfg.brand) setBrand(cfg.brand);
      if (cfg.productName) setProductName(cfg.productName);
      if (cfg.niche) setNiche(cfg.niche);
      if (cfg.audience) setAudience(cfg.audience);
      if (cfg.language) setLanguage(cfg.language);
      if (cfg.scenesCount) setScenesCount(cfg.scenesCount);
      if (cfg.totalDurationSec) setTotalDurationSec(cfg.totalDurationSec);
      if (cfg.aspect) setAspect(cfg.aspect);
      if (cfg.videoModel) setVideoModel(cfg.videoModel);
      if (cfg.imageModel) setImageModel(cfg.imageModel);
      if (cfg.style) setStyle(cfg.style);
      if (cfg.customBrief) setCustomBrief(cfg.customBrief);
    } catch (e: any) { onError(e?.message || "Error cargando plantilla"); }
  };

  const deleteTemplate = async (id: string) => {
    if (!confirm("¿Borrar esta plantilla? No se puede deshacer.")) return;
    try {
      const r = await fetch(`${API_BASE}/api/fs-pro/cinematic-prompts/${id}`, { method: "DELETE", credentials: "include" });
      if (!r.ok) { const d = await r.json(); onError(d.error || "No se pudo borrar"); return; }
      if (activeTemplateId === id) { setActiveTemplateId(""); setEditableScript(null); }
      await refreshTemplates();
    } catch (e: any) { onError(e?.message || "Error borrando"); }
  };

  // ─── Phase 1: generate script-only (preview + edit) ───────────────────
  const generateScriptPreview = async () => {
    if (!brand.trim() || !productName.trim()) { onError("Marca y producto requeridos"); return; }
    setBusy(true); setBusyMode("script");
    try {
      const body = {
        projectId, brand, productName,
        niche: niche || undefined, audience: audience || undefined,
        language, scenesCount, totalDurationSec, aspect, videoModel, imageModel, style,
        customBrief: customBrief || undefined,
        narration: { enabled: narrationEnabled, voiceId: narrationVoiceId || undefined },
        music: { enabled: musicEnabled, prompt: musicPrompt || undefined },
      };
      const r = await fetch(`${API_BASE}/api/fs-pro/cinematic-script`, {
        method: "POST", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const d = await r.json();
      if (!r.ok) { onError(d.error || `Error ${r.status}`); return; }
      setEditableScript(d.script);
      setActiveTemplateId(d.savedPromptId || "");
      await refreshTemplates();
    } catch (e: any) { onError(e?.message || "Error generando guion"); } finally { setBusy(false); setBusyMode(null); }
  };

  // ─── Phase 2: render with the (edited) script ─────────────────────────
  const renderEditedScript = async () => {
    if (!editableScript) { onError("Genera o carga un guion primero"); return; }
    if (!productFile) { onError("Imagen del producto requerida para renderizar"); return; }
    setBusy(true); setBusyMode("render");
    try {
      const fd = new FormData();
      fd.append("projectId", String(projectId));
      fd.append("brand", brand);
      fd.append("productName", productName);
      if (niche) fd.append("niche", niche);
      if (audience) fd.append("audience", audience);
      fd.append("language", language);
      fd.append("scenesCount", String(scenesCount));
      fd.append("totalDurationSec", String(totalDurationSec));
      fd.append("aspect", aspect);
      fd.append("videoModel", videoModel);
      fd.append("imageModel", imageModel);
      fd.append("style", style);
      if (customBrief) fd.append("customBrief", customBrief);
      fd.append("narrationEnabled", String(narrationEnabled));
      if (narrationEnabled) fd.append("narrationVoiceId", narrationVoiceId);
      fd.append("musicEnabled", String(musicEnabled));
      if (musicEnabled && musicPrompt) fd.append("musicPrompt", musicPrompt);
      fd.append("product", productFile);
      // Pasamos el script editado: prevalece sobre el savedPromptId.
      fd.append("script", JSON.stringify(editableScript));
      if (activeTemplateId) fd.append("savedPromptId", activeTemplateId);

      const res = await fetch(`${API_BASE}/api/fs-pro/cinematic-multishot`, { method: "POST", credentials: "include", body: fd });
      const d = await res.json();
      if (!res.ok) { onError(d.error || `Error ${res.status}`); return; }
      onSuccess({ vaultId: d.vaultId, type: "video", label: `Multishot: ${productName.slice(0, 30)}`, mimeType: "video/mp4" });
      await refreshTemplates();
    } catch (e: any) { onError(e?.message || "Error en render"); } finally { setBusy(false); setBusyMode(null); }
  };

  // ─── One-shot legacy: generate script + render in one call ────────────
  const runOneShot = async () => {
    if (!brand.trim() || !productName.trim()) { onError("Marca y producto requeridos"); return; }
    if (!productFile) { onError("Imagen del producto requerida"); return; }
    setBusy(true); setBusyMode("render"); setEditableScript(null);
    try {
      const fd = new FormData();
      fd.append("projectId", String(projectId));
      fd.append("brand", brand);
      fd.append("productName", productName);
      if (niche) fd.append("niche", niche);
      if (audience) fd.append("audience", audience);
      fd.append("language", language);
      fd.append("scenesCount", String(scenesCount));
      fd.append("totalDurationSec", String(totalDurationSec));
      fd.append("aspect", aspect);
      fd.append("videoModel", videoModel);
      fd.append("imageModel", imageModel);
      fd.append("style", style);
      if (customBrief) fd.append("customBrief", customBrief);
      fd.append("narrationEnabled", String(narrationEnabled));
      if (narrationEnabled) fd.append("narrationVoiceId", narrationVoiceId);
      fd.append("musicEnabled", String(musicEnabled));
      if (musicEnabled && musicPrompt) fd.append("musicPrompt", musicPrompt);
      fd.append("product", productFile);

      const res = await fetch(`${API_BASE}/api/fs-pro/cinematic-multishot`, { method: "POST", credentials: "include", body: fd });
      const d = await res.json();
      if (!res.ok) { onError(d.error || `Error ${res.status}`); return; }
      setEditableScript(d.script);
      setActiveTemplateId(d.savedPromptId || "");
      onSuccess({ vaultId: d.vaultId, type: "video", label: `Multishot: ${productName.slice(0, 30)}`, mimeType: "video/mp4" });
      await refreshTemplates();
    } catch (e: any) { onError(e?.message || "Error en multi-shot"); } finally { setBusy(false); setBusyMode(null); }
  };

  const updateScene = (idx: number, patch: Record<string, any>) => {
    setEditableScript((s: any) => {
      if (!s) return s;
      const scenes = s.scenes.map((sc: any, i: number) => i === idx ? { ...sc, ...patch } : sc);
      return { ...s, scenes };
    });
  };

  const saveAsTemplate = async () => {
    // Use ref to ALWAYS read the most recent edited script (avoid stale closure).
    const scriptToSave = editableScriptRef.current ?? editableScript;
    if (!scriptToSave) { onError("No hay guion para guardar"); return; }
    setBusy(true); setBusyMode("save");
    try {
      // If we have an active template id → PUT (overwrite with exact edits).
      // Otherwise → POST cinematic-script (creates a fresh draft via Claude),
      //             then PUT the EXACT edited JSON to overwrite its content.
      let targetId = activeTemplateId;
      if (!targetId) {
        const body = {
          projectId, brand, productName,
          niche: niche || undefined, audience: audience || undefined,
          language, scenesCount, totalDurationSec, aspect, videoModel, imageModel, style,
          customBrief: customBrief || undefined,
        };
        const r = await fetch(`${API_BASE}/api/fs-pro/cinematic-script`, {
          method: "POST", credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        const d = await r.json();
        if (!r.ok) { onError(d.error || "No se pudo crear plantilla"); return; }
        targetId = d.savedPromptId;
        setActiveTemplateId(targetId);
      }
      const r2 = await fetch(`${API_BASE}/api/fs-pro/cinematic-prompts/${targetId}`, {
        method: "PUT", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ script: scriptToSave }),
      });
      const d2 = await r2.json();
      if (!r2.ok) { onError(d2.error || "No se pudo guardar las ediciones"); return; }
      await refreshTemplates();
    } catch (e: any) { onError(e?.message || "Error guardando"); } finally { setBusy(false); setBusyMode(null); }
  };

  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
      <div>
        <Section title="📚 Plantillas guardadas">
          <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
            <select value={activeTemplateId} onChange={e => loadTemplate(e.target.value)} style={{ ...inputStyle, flex: 1 }}>
              <option value="">— Sin plantilla (crear nueva) —</option>
              {templates.map(t => (
                <option key={t.id} value={t.id}>
                  {t.isPublic === 0 ? "🔒 " : "★ "}{t.name} {t.useCount ? `· ${t.useCount} uso${t.useCount > 1 ? "s" : ""}` : ""}
                </option>
              ))}
            </select>
            {activeTemplateId && (
              <button onClick={() => deleteTemplate(activeTemplateId)} style={{ ...pillButton(false), color: "#f87171", padding: "4px 10px" }} title="Borrar plantilla">🗑️</button>
            )}
          </div>
          <p style={{ fontSize: 10, color: "var(--t3)", margin: "6px 0 0" }}>
            Selecciona una plantilla para reusar su guion completo (hooks, voicelines, prompts), o genera una nueva abajo.
          </p>
        </Section>
        <Section title="Producto y marca">
          <input value={brand} onChange={e => setBrand(e.target.value)} placeholder="Marca (ej: Behrens)" style={inputStyle} />
          <div style={{ height: 6 }} />
          <input value={productName} onChange={e => setProductName(e.target.value)} placeholder="Nombre del producto (ej: Reloj S-2 Skeleton)" style={inputStyle} />
          <div style={{ height: 6 }} />
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
            <input value={niche} onChange={e => setNiche(e.target.value)} placeholder="Nicho (opcional)" style={inputStyle} />
            <input value={audience} onChange={e => setAudience(e.target.value)} placeholder="Audiencia (opcional)" style={inputStyle} />
          </div>
        </Section>
        <Section title="Imagen del producto (referencia)">
          <input type="file" accept="image/*" onChange={e => setProductFile(e.target.files?.[0] || null)} />
          <p style={{ fontSize: 10, color: "var(--t3)", margin: "6px 0" }}>El producto aparecerá consistente en todas las escenas usando esta imagen como referencia.</p>
        </Section>
        <Section title="Estilo cinematográfico">
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
            {styles.map((s: any) => (
              <button key={s.key} onClick={() => setStyle(s.key)} style={{ ...cardButton(style === s.key), textAlign: "left" }}>
                <strong style={{ fontSize: 12 }}>{s.label}</strong>
                <div style={{ fontSize: 10, color: "var(--t3)", marginTop: 2 }}>{s.description}</div>
              </button>
            ))}
          </div>
        </Section>
        <Section title="Brief adicional (opcional)">
          <textarea value={customBrief} onChange={e => setCustomBrief(e.target.value)} placeholder="Ej: Mostrar mecanismo interno en la escena 2, color principal negro mate…" style={{ ...inputStyle, minHeight: 60 }} />
        </Section>
      </div>
      <div>
        <Section title="Modelo de video">
          <select value={videoModel} onChange={e => setVideoModel(e.target.value)} style={inputStyle}>
            {caps?.videoGeneration.map(m => (
              <option key={m.key} value={m.key}>{m.label} · €{m.costPerSec}/s · Q{m.quality}/10</option>
            ))}
          </select>
          <div style={{ height: 6 }} />
          <select value={imageModel} onChange={e => setImageModel(e.target.value)} style={inputStyle}>
            {caps?.imageGeneration.map(m => (
              <option key={m.key} value={m.key}>Keyframes: {m.label} · €{m.costPerImage}/img</option>
            ))}
          </select>
        </Section>
        <Section title="Escenas / Duración / Aspecto">
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            <div>
              <div style={{ fontSize: 11, color: "var(--t3)", marginBottom: 4 }}>{scenesCount} escenas</div>
              <input type="range" min={2} max={8} value={scenesCount} onChange={e => setScenesCount(parseInt(e.target.value))} style={{ width: "100%" }} />
            </div>
            <div>
              <div style={{ fontSize: 11, color: "var(--t3)", marginBottom: 4 }}>{totalDurationSec}s totales</div>
              <input type="range" min={6} max={60} step={2} value={totalDurationSec} onChange={e => setTotalDurationSec(parseInt(e.target.value))} style={{ width: "100%" }} />
            </div>
          </div>
          <div style={{ display: "flex", gap: 4, marginTop: 8 }}>
            {(["9:16", "16:9", "1:1"] as const).map(a => (
              <button key={a} onClick={() => setAspect(a)} style={pillButton(aspect === a)}>{a}</button>
            ))}
            <select value={language} onChange={e => setLanguage(e.target.value)} style={{ ...inputStyle, width: 90, padding: "4px 8px", fontSize: 11 }}>
              <option value="es">ES</option><option value="en">EN</option><option value="pt">PT</option><option value="fr">FR</option><option value="it">IT</option><option value="de">DE</option>
            </select>
          </div>
        </Section>
        <Section title="Voiceover (ElevenLabs)">
          <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12, color: "var(--t2)", marginBottom: 6 }}>
            <input type="checkbox" checked={narrationEnabled} onChange={e => setNarrationEnabled(e.target.checked)} /> Generar voiceover
          </label>
          {narrationEnabled && (
            <input value={narrationVoiceId} onChange={e => setNarrationVoiceId(e.target.value)} placeholder="ElevenLabs voiceId (default: Rachel)" style={inputStyle} />
          )}
        </Section>
        <Section title="Música de fondo">
          <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12, color: "var(--t2)", marginBottom: 6 }}>
            <input type="checkbox" checked={musicEnabled} onChange={e => setMusicEnabled(e.target.checked)} /> Generar música
          </label>
          {musicEnabled && (
            <input value={musicPrompt} onChange={e => setMusicPrompt(e.target.value)} placeholder="Prompt música (vacío = automático)" style={inputStyle} />
          )}
        </Section>
        {/* ─── 2-PHASE WORKFLOW: phase 1 = script preview ─────────────────── */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginTop: 4 }}>
          <button onClick={generateScriptPreview} disabled={busy} className="btn btn-ghost" style={{ width: "100%", justifyContent: "center", padding: "10px 12px" }}>
            {busy && busyMode === "script" ? <Loader2 size={14} className="animate-spin" /> : <span>🪄</span>} {busy && busyMode === "script" ? "Escribiendo guion…" : "Generar guion (vista previa)"}
          </button>
          <button onClick={renderEditedScript} disabled={busy || !editableScript || !productFile} className="btn btn-gold" style={{ width: "100%", justifyContent: "center", padding: "10px 12px" }}>
            {busy && busyMode === "render" ? <Loader2 size={14} className="animate-spin" /> : <Film size={14} />} {busy && busyMode === "render" ? "Renderizando…" : "🎬 Renderizar este guion"}
          </button>
        </div>
        <button onClick={runOneShot} disabled={busy} className="btn btn-ghost" style={{ width: "100%", justifyContent: "center", padding: "8px 12px", marginTop: 6, fontSize: 11 }}>
          {busy && busyMode === "render" && !editableScript ? <Loader2 size={12} className="animate-spin" /> : null} O en un solo paso (script + render automáticos)
        </button>
        <LiveOperation
          active={busy && busyMode === "render"}
          title={editableScript ? "Renderizando guion editado" : "Generando anuncio multi-shot"}
          estimatedSec={scenesCount * 90}
          messages={[
            !editableScript ? "Claude está escribiendo el guion por escenas…" : "Usando guion editado…",
            "Generando keyframes consistentes con tu producto…",
            `Renderizando ${scenesCount} clips de video con ${videoModel}…`,
            "Concatenando con crossfade cinematográfico…",
            narrationEnabled ? "Sintetizando voiceover con ElevenLabs…" : "",
            musicEnabled ? "Generando música original…" : "",
            "Mezclando MP4 final…",
          ].filter(Boolean)}
          className="w-full mt-3"
        />

        {/* ─── Phase 1.5: editable script ───────────────────────────────── */}
        {editableScript && (
          <div style={{ marginTop: 16, padding: 12, borderRadius: 8, background: "var(--ink2)", border: "1px solid var(--bdr)", fontSize: 11 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
              <div style={{ flex: 1 }}>
                <input
                  value={editableScript.title || ""}
                  onChange={e => setEditableScript((s: any) => ({ ...s, title: e.target.value }))}
                  style={{ ...inputStyle, color: "var(--gold)", fontWeight: 600, fontSize: 13 }}
                  placeholder="Título del anuncio"
                />
              </div>
              <button onClick={saveAsTemplate} disabled={busy} className="btn btn-ghost" style={{ padding: "6px 10px", fontSize: 11 }}>
                {busy && busyMode === "save" ? <Loader2 size={12} className="animate-spin" /> : "💾"} Guardar plantilla
              </button>
            </div>
            <div style={{ marginTop: 8, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
              <input value={editableScript.hook || ""} onChange={e => setEditableScript((s: any) => ({ ...s, hook: e.target.value }))} placeholder="Hook inicial" style={{ ...inputStyle, fontStyle: "italic" }} />
              <input value={editableScript.cta || ""} onChange={e => setEditableScript((s: any) => ({ ...s, cta: e.target.value }))} placeholder="Call to action" style={inputStyle} />
            </div>
            <div style={{ maxHeight: 360, overflow: "auto", marginTop: 8 }}>
              {editableScript.scenes?.map((sc: any, idx: number) => (
                <details key={sc.idx ?? idx} open={idx === 0} style={{ marginBottom: 8, padding: 8, borderRadius: 6, background: "var(--ink)", border: "1px solid var(--bdr)" }}>
                  <summary style={{ cursor: "pointer", color: "var(--gold)", fontWeight: 600 }}>
                    Escena {sc.idx ?? idx + 1} · {sc.timeStartSec}s → {sc.timeEndSec}s · {sc.cameraMovement || "—"}
                  </summary>
                  <div style={{ marginTop: 8 }}>
                    <label style={{ fontSize: 10, color: "var(--t3)" }}>Voice line ({language})</label>
                    <input
                      value={sc.voiceoverLine || ""}
                      onChange={e => updateScene(idx, { voiceoverLine: e.target.value })}
                      placeholder="Frase narrada para esta escena"
                      style={inputStyle}
                    />
                    <label style={{ fontSize: 10, color: "var(--t3)", marginTop: 6, display: "block" }}>Movimiento de cámara</label>
                    <input
                      value={sc.cameraMovement || ""}
                      onChange={e => updateScene(idx, { cameraMovement: e.target.value })}
                      placeholder="ej: slow dolly-in, orbit 360°…"
                      style={inputStyle}
                    />
                    <label style={{ fontSize: 10, color: "var(--t3)", marginTop: 6, display: "block" }}>Keyframe prompt (image · EN)</label>
                    <textarea
                      value={sc.keyframePrompt || ""}
                      onChange={e => updateScene(idx, { keyframePrompt: e.target.value })}
                      style={{ ...inputStyle, minHeight: 80, fontFamily: "monospace", fontSize: 10 }}
                    />
                    <label style={{ fontSize: 10, color: "var(--t3)", marginTop: 6, display: "block" }}>Video prompt (motion · EN)</label>
                    <textarea
                      value={sc.videoPrompt || ""}
                      onChange={e => updateScene(idx, { videoPrompt: e.target.value })}
                      style={{ ...inputStyle, minHeight: 60, fontFamily: "monospace", fontSize: 10 }}
                    />
                  </div>
                </details>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── TAB: AVATARS (Pollo Avatar Studio) ───────────────────────────────────
function AvatarsTab({ caps, projectId, onSuccess, onError }: { caps: Capabilities | null; projectId: number; onSuccess: (it: VaultItem) => void; onError: (m: string) => void }) {
  const [mode, setMode] = useState<"talking" | "product" | "mimic">("talking");
  const [niche, setNiche] = useState<string>("beauty");
  const [avatarId, setAvatarId] = useState<string>("");
  const [script, setScript] = useState("");
  const [voiceId, setVoiceId] = useState("");
  const [language, setLanguage] = useState("es");
  const [aspect, setAspect] = useState<"9:16" | "16:9" | "1:1">("9:16");
  const [videoModel, setVideoModel] = useState("kling-master");
  const [applyLipSync, setApplyLipSync] = useState(true);
  const [productFile, setProductFile] = useState<File | null>(null);
  const [presenterFile, setPresenterFile] = useState<File | null>(null);
  const [customAvatarFile, setCustomAvatarFile] = useState<File | null>(null);
  const [targetFile, setTargetFile] = useState<File | null>(null);
  const [sourceVideoUrl, setSourceVideoUrl] = useState("");
  const [busy, setBusy] = useState(false);

  const avatars = (caps as any)?.avatarStudio?.avatars ?? [];
  const niches: string[] = (caps as any)?.avatarStudio?.niches ?? ["beauty", "health", "fashion", "tech", "food", "home", "fitness", "finance"];
  const filtered = avatars.filter((a: any) => a.niche === niche);

  // auto-pick first avatar of niche
  useEffect(() => {
    if (filtered.length > 0 && !filtered.find((a: any) => a.id === avatarId)) {
      setAvatarId(filtered[0].id);
      setVoiceId(filtered[0].defaultVoiceId);
      setLanguage(filtered[0].defaultLanguage);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [niche, avatars.length]);

  const runTalking = async () => {
    if (!script.trim()) { onError("Script requerido"); return; }
    if (!avatarId && !customAvatarFile) { onError("Selecciona avatar o sube foto custom"); return; }
    setBusy(true);
    try {
      const fd = new FormData();
      fd.append("projectId", String(projectId));
      if (avatarId) fd.append("avatarId", avatarId);
      fd.append("script", script);
      if (voiceId) fd.append("voiceId", voiceId);
      fd.append("language", language);
      fd.append("aspect", aspect);
      fd.append("videoModel", videoModel);
      fd.append("applyLipSync", String(applyLipSync));
      if (customAvatarFile) fd.append("customAvatar", customAvatarFile);
      const res = await fetch(`${API_BASE}/api/fs-pro/avatar/talking`, { method: "POST", credentials: "include", body: fd });
      const d = await res.json();
      if (!res.ok) { onError(d.error || `Error ${res.status}`); return; }
      onSuccess({ vaultId: d.vaultId, type: "video", label: `Avatar: ${avatarId || "custom"}`, mimeType: "video/mp4" });
    } catch (e: any) { onError(e?.message || "Error"); } finally { setBusy(false); }
  };

  const runProduct = async () => {
    if (!script.trim()) { onError("Script requerido"); return; }
    if (!productFile) { onError("Imagen del producto requerida"); return; }
    if (!avatarId && !presenterFile) { onError("Selecciona avatar o sube foto presenter"); return; }
    setBusy(true);
    try {
      const fd = new FormData();
      fd.append("projectId", String(projectId));
      if (avatarId) fd.append("avatarId", avatarId);
      fd.append("script", script);
      if (voiceId) fd.append("voiceId", voiceId);
      fd.append("language", language);
      fd.append("aspect", aspect);
      fd.append("videoModel", videoModel);
      fd.append("applyLipSync", String(applyLipSync));
      fd.append("product", productFile);
      if (presenterFile) fd.append("customPresenter", presenterFile);
      const res = await fetch(`${API_BASE}/api/fs-pro/avatar/product`, { method: "POST", credentials: "include", body: fd });
      const d = await res.json();
      if (!res.ok) { onError(d.error || `Error ${res.status}`); return; }
      onSuccess({ vaultId: d.vaultId, type: "video", label: `Product Avatar`, mimeType: "video/mp4" });
    } catch (e: any) { onError(e?.message || "Error"); } finally { setBusy(false); }
  };

  const runMimic = async () => {
    if (!sourceVideoUrl.trim()) { onError("URL de video origen requerida (https)"); return; }
    if (!targetFile) { onError("Imagen target requerida"); return; }
    setBusy(true);
    try {
      const fd = new FormData();
      fd.append("projectId", String(projectId));
      fd.append("sourceVideoUrl", sourceVideoUrl);
      fd.append("target", targetFile);
      const res = await fetch(`${API_BASE}/api/fs-pro/avatar/mimic-motion`, { method: "POST", credentials: "include", body: fd });
      const d = await res.json();
      if (!res.ok) { onError(d.error || `Error ${res.status}`); return; }
      onSuccess({ vaultId: d.vaultId, type: "video", label: `Mimic Motion`, mimeType: "video/mp4" });
    } catch (e: any) { onError(e?.message || "Error"); } finally { setBusy(false); }
  };

  return (
    <div>
      <Section title="Modo">
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 6 }}>
          <button onClick={() => setMode("talking")} style={{ ...cardButton(mode === "talking"), textAlign: "left" }}>
            <strong style={{ fontSize: 12 }}>🎤 Talking Avatar</strong>
            <div style={{ fontSize: 10, color: "var(--t3)", marginTop: 2 }}>Cabeza parlante de un preset por nicho</div>
          </button>
          <button onClick={() => setMode("product")} style={{ ...cardButton(mode === "product"), textAlign: "left" }}>
            <strong style={{ fontSize: 12 }}>🛍️ Product Avatar</strong>
            <div style={{ fontSize: 10, color: "var(--t3)", marginTop: 2 }}>Presenter mostrando tu producto</div>
          </button>
          <button onClick={() => setMode("mimic")} style={{ ...cardButton(mode === "mimic"), textAlign: "left" }}>
            <strong style={{ fontSize: 12 }}>🪄 Mimic Motion</strong>
            <div style={{ fontSize: 10, color: "var(--t3)", marginTop: 2 }}>Anima foto con movimiento de un video referencia</div>
          </button>
        </div>
      </Section>

      {mode !== "mimic" && (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
          <div>
            <Section title="Nicho">
              <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                {niches.map(n => (
                  <button key={n} onClick={() => setNiche(n)} style={pillButton(niche === n)}>{n}</button>
                ))}
              </div>
            </Section>
            <Section title={`Avatar (${filtered.length} disponibles en ${niche})`}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6, maxHeight: 280, overflowY: "auto" }}>
                {filtered.map((a: any) => (
                  <button key={a.id} onClick={() => { setAvatarId(a.id); setVoiceId(a.defaultVoiceId); setLanguage(a.defaultLanguage); }}
                    style={{ ...cardButton(avatarId === a.id), textAlign: "left" }}>
                    <strong style={{ fontSize: 12 }}>{a.name}</strong>
                    <div style={{ fontSize: 10, color: "var(--t3)", marginTop: 2 }}>{a.gender} · {a.defaultLanguage.toUpperCase()}</div>
                    <div style={{ fontSize: 10, color: "var(--t3)", marginTop: 2 }}>{a.personaPrompt?.slice(0, 60)}…</div>
                  </button>
                ))}
              </div>
            </Section>
            <Section title={mode === "talking" ? "O sube foto custom (opcional)" : "Foto presenter custom (opcional, anula el preset)"}>
              <input type="file" accept="image/*" onChange={e => mode === "talking" ? setCustomAvatarFile(e.target.files?.[0] || null) : setPresenterFile(e.target.files?.[0] || null)} />
            </Section>
            {mode === "product" && (
              <Section title="Imagen del producto (requerida)">
                <input type="file" accept="image/*" onChange={e => setProductFile(e.target.files?.[0] || null)} />
              </Section>
            )}
          </div>
          <div>
            <Section title="Script (lo que el avatar dirá)">
              <textarea value={script} onChange={e => setScript(e.target.value)} placeholder="¡Hola! Te presento el nuevo Behrens S-2 Skeleton, donde la ingeniería se convierte en arte…" style={{ ...inputStyle, minHeight: 100 }} maxLength={1500} />
              <div style={{ fontSize: 10, color: "var(--t3)", marginTop: 4 }}>{script.length}/1500 caracteres</div>
            </Section>
            <Section title="Voz (ElevenLabs ID)">
              <input value={voiceId} onChange={e => setVoiceId(e.target.value)} placeholder="VoiceId (default según preset)" style={inputStyle} />
            </Section>
            <Section title="Modelo de video">
              <select value={videoModel} onChange={e => setVideoModel(e.target.value)} style={inputStyle}>
                {caps?.videoGeneration
                  .map(m => (<option key={m.key} value={m.key}>{m.label} · €{m.costPerSec}/s · Q{m.quality}/10</option>))}
              </select>
            </Section>
            <Section title="Aspecto / Idioma / Lip-sync">
              <div style={{ display: "flex", gap: 4 }}>
                {(["9:16", "16:9", "1:1"] as const).map(a => (
                  <button key={a} onClick={() => setAspect(a)} style={pillButton(aspect === a)}>{a}</button>
                ))}
                <select value={language} onChange={e => setLanguage(e.target.value)} style={{ ...inputStyle, width: 80, padding: "4px 8px", fontSize: 11 }}>
                  <option value="es">ES</option><option value="en">EN</option><option value="pt">PT</option><option value="fr">FR</option><option value="it">IT</option><option value="de">DE</option>
                </select>
              </div>
              <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12, color: "var(--t2)", marginTop: 8 }}>
                <input type="checkbox" checked={applyLipSync} onChange={e => setApplyLipSync(e.target.checked)} /> Aplicar lip-sync (mejora sincronía labial)
              </label>
            </Section>
            <button onClick={mode === "talking" ? runTalking : runProduct} disabled={busy} className="btn btn-gold" style={{ width: "100%", justifyContent: "center", padding: "12px 20px" }}>
              {busy ? <Loader2 size={16} className="animate-spin" /> : <UserSquare size={16} />} {busy ? "Generando avatar..." : (mode === "talking" ? "Generar Talking Avatar" : "Generar Product Avatar")}
            </button>
            <LiveOperation
              active={busy}
              title={mode === "talking" ? "Generando talking avatar" : "Generando product avatar"}
              estimatedSec={180}
              messages={[
                mode === "talking" ? "Renderizando headshot del avatar…" : "Fusionando presenter + producto en una imagen…",
                "Animando el avatar con movimiento natural…",
                "Sintetizando voz con ElevenLabs…",
                applyLipSync ? "Aplicando lip-sync para sincronizar labios…" : "Mezclando audio + video…",
                "Codificando MP4 final y guardando en Vault…",
              ]}
              className="w-full mt-3"
            />
          </div>
        </div>
      )}

      {mode === "mimic" && (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
          <div>
            <Section title="Imagen target (la que será animada)">
              <input type="file" accept="image/*" onChange={e => setTargetFile(e.target.files?.[0] || null)} />
              <p style={{ fontSize: 10, color: "var(--t3)", marginTop: 6 }}>Una foto estática de una persona. Sus movimientos serán reemplazados por los del video origen.</p>
            </Section>
          </div>
          <div>
            <Section title="URL del video origen (motion driver)">
              <input value={sourceVideoUrl} onChange={e => setSourceVideoUrl(e.target.value)} placeholder="https://...mp4" style={inputStyle} />
              <p style={{ fontSize: 10, color: "var(--t3)", marginTop: 6 }}>Video público con la persona haciendo el movimiento que quieres copiar.</p>
            </Section>
            <button onClick={runMimic} disabled={busy} className="btn btn-gold" style={{ width: "100%", justifyContent: "center", padding: "12px 20px" }}>
              {busy ? <Loader2 size={16} className="animate-spin" /> : <Video size={16} />} {busy ? "Procesando..." : "Generar Mimic Motion"}
            </button>
            <LiveOperation
              active={busy}
              title="Transfiriendo movimiento"
              estimatedSec={240}
              messages={[
                "Descargando video de referencia…",
                "Extrayendo trayectoria de movimiento…",
                "Aplicando el movimiento sobre tu imagen target…",
                "Codificando MP4 final…",
              ]}
              className="w-full mt-3"
            />
          </div>
        </div>
      )}
    </div>
  );
}

// ─── TAB: PROMPT LAB (PRO PRESETS + IA ENHANCE + LIBRARY) ────────────────
type PromptCategory = "lens" | "lighting" | "palette" | "mood" | "composition" | "cameraMovement" | "style" | "apps" | "transitions";
type PromptCatalog = Record<PromptCategory, Array<{ key: string; label: string; description?: string; value?: string }>>;

type PromptIntent =
  | "image" | "video"
  | "ad_cinematic" | "multishot_director"
  | "image_hero_product" | "ugc_video"
  | "ad_copy_meta" | "infographic_html"
  | "seo_product_100" | "email_marketing"
  | "landing_hero" | "brand_kit_ocr";

const INTENT_LABELS: Record<PromptIntent, { label: string; emoji: string; visual: boolean }> = {
  image:               { label: "Imagen libre",                 emoji: "📸", visual: true  },
  video:               { label: "Vídeo libre",                  emoji: "🎬", visual: true  },
  image_hero_product:  { label: "Hero shot producto",           emoji: "✨", visual: true  },
  ad_cinematic:        { label: "Anuncio cinematográfico",      emoji: "🎥", visual: true  },
  multishot_director:  { label: "Anuncio largo (showrunner)",   emoji: "🎞️", visual: true  },
  ugc_video:           { label: "UGC creator",                  emoji: "📱", visual: true  },
  ad_copy_meta:        { label: "Copy Meta/TikTok",             emoji: "✍️", visual: false },
  infographic_html:    { label: "Infografía HTML",              emoji: "📊", visual: false },
  seo_product_100:     { label: "Descripción SEO 100/100",      emoji: "🔍", visual: false },
  email_marketing:     { label: "Email marketing",              emoji: "📧", visual: false },
  landing_hero:        { label: "Landing hero",                 emoji: "🚀", visual: false },
  brand_kit_ocr:       { label: "Brand kit OCR",                emoji: "🎨", visual: false },
};

interface LibraryItem {
  id: string;
  name: string;
  description?: string | null;
  useCase: string;
  niche?: string | null;
  promptTemplate: { systemPrompt?: string; userTemplate?: string } | string;
  variables: string[];
  avgQualityScore?: number | null;
  useCount?: number | null;
  isSeed: boolean;
}

function PromptLabTab({ onInfo, onError }: { onInfo: (m: string) => void; onError: (m: string) => void }) {
  const [catalog, setCatalog] = useState<PromptCatalog | null>(null);
  const [intent, setIntent] = useState<PromptIntent>("image_hero_product");
  const [subject, setSubject] = useState("");
  const [brand, setBrand] = useState("");
  const [extraContext, setExtraContext] = useState("");
  const [picks, setPicks] = useState<Partial<Record<PromptCategory, string>>>({});
  const [busy, setBusy] = useState(false);
  const [enhancing, setEnhancing] = useState(false);
  const [baseline, setBaseline] = useState<string>("");
  const [output, setOutput] = useState<string>("");
  const [negativePrompt, setNegativePrompt] = useState<string>("");
  const [enhancedModel, setEnhancedModel] = useState<"claude" | "fallback" | "">("");

  // Library state
  const [library, setLibrary] = useState<LibraryItem[]>([]);
  const [libraryFilter, setLibraryFilter] = useState<"all" | PromptIntent>("all");
  const [libraryOpen, setLibraryOpen] = useState(true);
  const [libraryLoading, setLibraryLoading] = useState(false);
  const [savingToLib, setSavingToLib] = useState(false);

  // Master Library (agencia) state
  const [masterOpen, setMasterOpen] = useState(false);
  const [masterIndex, setMasterIndex] = useState<Array<{ key: string; description: string; count: number }>>([]);
  const [masterLibKey, setMasterLibKey] = useState("shopy_crafter_seeds");
  const [masterSearch, setMasterSearch] = useState("");
  const [masterItems, setMasterItems] = useState<any[]>([]);
  const [masterTotal, setMasterTotal] = useState(0);
  const [masterOffset, setMasterOffset] = useState(0);
  const [masterLoading, setMasterLoading] = useState(false);
  const MASTER_LIMIT = 15;

  const isVisualIntent = INTENT_LABELS[intent]?.visual ?? true;
  const presetKind: "image" | "video" = intent === "video" || intent === "ad_cinematic" || intent === "multishot_director" || intent === "ugc_video" ? "video" : "image";

  useEffect(() => {
    let cancelled = false;
    fetch(`${API_BASE}/api/fs-pro/prompt/catalog`, { credentials: "include" })
      .then(r => r.json())
      .then(d => { if (!cancelled && d?.catalog) setCatalog(d.catalog); })
      .catch(() => onError("No se pudo cargar el catálogo de prompts"));
    return () => { cancelled = true; };
  }, []);

  const loadLibrary = async (filter: "all" | PromptIntent = libraryFilter) => {
    setLibraryLoading(true);
    try {
      const url = filter === "all"
        ? `${API_BASE}/api/fs-pro/prompt-library`
        : `${API_BASE}/api/fs-pro/prompt-library?useCase=${encodeURIComponent(filter)}`;
      const res = await fetch(url, { credentials: "include" });
      const d = await res.json();
      if (!res.ok) { onError(d.error || `Error ${res.status}`); return; }
      setLibrary(d.items || []);
    } catch (e: any) {
      onError(e?.message || "Error cargando biblioteca");
    } finally { setLibraryLoading(false); }
  };

  useEffect(() => { loadLibrary(libraryFilter); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [libraryFilter]);

  const build = async () => {
    if (subject.trim().length < 3) { onError("Describe el sujeto (mínimo 3 caracteres)"); return; }
    setBusy(true);
    try {
      const res = await fetch(`${API_BASE}/api/fs-pro/prompt/build`, {
        method: "POST", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind: presetKind, subject: subject.trim(), brand: brand.trim() || undefined, picks }),
      });
      const d = await res.json();
      if (!res.ok) { onError(d.error || `Error ${res.status}`); return; }
      const builtPrompt = d.prompt || "";
      setBaseline(builtPrompt);
      setOutput(builtPrompt);
      setNegativePrompt(d.negativePrompt || "");
      setEnhancedModel("");
      onInfo("Baseline construido — pulsa 🪄 Potenciar con IA para refinarlo");
    } catch (e: any) {
      onError(e?.message || "Error de red");
    } finally { setBusy(false); }
  };

  const enhance = async () => {
    const baseToUse = output || baseline;
    if (!baseToUse || baseToUse.trim().length < 10) {
      onError("Construye primero un baseline (Construir prompt) o pega texto en el output"); return;
    }
    if (subject.trim().length < 3) { onError("Describe el sujeto (mínimo 3 caracteres)"); return; }
    setEnhancing(true);
    try {
      const res = await fetch(`${API_BASE}/api/fs-pro/prompt/enhance`, {
        method: "POST", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          intent,
          baselinePrompt: baseToUse,
          subject: subject.trim(),
          brand: brand.trim() || null,
          language: "es",
          extraContext: extraContext.trim() || undefined,
        }),
      });
      const d = await res.json();
      if (!res.ok) { onError(d.error || `Error ${res.status}`); return; }
      setOutput(d.enhanced || baseToUse);
      setNegativePrompt(d.negativePrompt || negativePrompt);
      setEnhancedModel(d.model || "claude");
      if (d.model === "fallback") {
        onError("Claude no respondió — manteniendo baseline (revisa GEMINI_API_KEY/ANTHROPIC_API_KEY)");
      } else {
        onInfo(`Prompt potenciado con IA (${d.model})`);
      }
    } catch (e: any) {
      onError(e?.message || "Error de red");
    } finally { setEnhancing(false); }
  };

  const copy = async (text: string, label = "Texto") => {
    if (!text) return;
    try { await navigator.clipboard.writeText(text); onInfo(`${label} copiado al portapapeles`); }
    catch { onError("No se pudo copiar"); }
  };

  const saveToLibrary = async () => {
    if (!output || output.trim().length < 10) { onError("Necesitas un prompt en el output para guardar"); return; }
    const name = window.prompt("Nombre para esta plantilla en tu biblioteca:", `${INTENT_LABELS[intent].label} · ${subject.slice(0, 30)}`);
    if (!name || name.trim().length < 3) return;
    setSavingToLib(true);
    try {
      const res = await fetch(`${API_BASE}/api/fs-pro/prompt-library`, {
        method: "POST", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          description: `Custom · ${INTENT_LABELS[intent].label}${brand ? " · " + brand : ""}`,
          useCase: intent,
          systemPrompt: "",
          userTemplate: output,
          variables: ["SUBJECT", "BRAND"],
        }),
      });
      const d = await res.json();
      if (!res.ok) { onError(d.error || `Error ${res.status}`); return; }
      onInfo("Plantilla guardada en biblioteca");
      loadLibrary(libraryFilter);
    } catch (e: any) {
      onError(e?.message || "Error de red");
    } finally { setSavingToLib(false); }
  };

  const loadMasterLib = async (libKey = masterLibKey, search = masterSearch, off = 0) => {
    setMasterLoading(true);
    try {
      const params = new URLSearchParams();
      if (libKey) params.set("library", libKey);
      if (search.trim()) params.set("search", search.trim());
      params.set("limit", String(MASTER_LIMIT));
      params.set("offset", String(off));
      const res = await fetch(`${API_BASE}/api/fs-pro/prompt-library-master?${params}`, { credentials: "include" });
      const d = await res.json();
      if (!res.ok) { onError(d.error || `Error ${res.status}`); return; }
      setMasterItems(d.items || []);
      setMasterTotal(d.total || 0);
      setMasterOffset(off);
    } catch (e: any) { onError(e?.message || "Error cargando biblioteca maestra"); }
    finally { setMasterLoading(false); }
  };

  const loadMasterIndex = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/fs-pro/prompt-library-master?indexOnly=1`, { credentials: "include" });
      const d = await res.json();
      if (res.ok && d.libraries) setMasterIndex(d.libraries);
    } catch { /* non-fatal */ }
  };

  const useMasterTemplate = (item: any) => {
    const raw = item._raw || item;
    const tpl = raw.user_template || raw.userTemplate || raw.prompt || raw.description || raw.name || "";
    setOutput(tpl);
    setBaseline(tpl);
    onInfo(`Plantilla "${item.name}" cargada en el editor`);
  };

  const loadFromLibrary = async (item: LibraryItem) => {
    const tpl = typeof item.promptTemplate === "object" && item.promptTemplate !== null
      ? (item.promptTemplate.userTemplate || item.promptTemplate.systemPrompt || "")
      : String(item.promptTemplate || "");
    setOutput(tpl);
    setBaseline(tpl);
    if (item.useCase && (INTENT_LABELS as any)[item.useCase]) setIntent(item.useCase as PromptIntent);
    onInfo(`Plantilla "${item.name}" cargada en el editor`);
    fetch(`${API_BASE}/api/fs-pro/prompt-library/${encodeURIComponent(item.id)}/use`, {
      method: "POST", credentials: "include",
    }).catch(() => { /* non-fatal */ });
  };

  const deleteFromLibrary = async (item: LibraryItem) => {
    if (item.isSeed) { onError("Las plantillas pre-cargadas no se pueden eliminar"); return; }
    if (!window.confirm(`¿Eliminar "${item.name}" de tu biblioteca?`)) return;
    try {
      const res = await fetch(`${API_BASE}/api/fs-pro/prompt-library/${encodeURIComponent(item.id)}`, {
        method: "DELETE", credentials: "include",
      });
      const d = await res.json();
      if (!res.ok) { onError(d.error || `Error ${res.status}`); return; }
      onInfo("Plantilla eliminada");
      loadLibrary(libraryFilter);
    } catch (e: any) { onError(e?.message || "Error de red"); }
  };

  const reset = () => { setPicks({}); setOutput(""); setBaseline(""); setNegativePrompt(""); setEnhancedModel(""); };

  const CATEGORY_TITLES: Record<PromptCategory, string> = {
    lens: "🔭 Óptica / Lente",
    lighting: "💡 Iluminación",
    palette: "🎨 Paleta",
    mood: "🎭 Atmósfera",
    composition: "📐 Composición",
    cameraMovement: "🎥 Movimiento de cámara (vídeo)",
    style: "🖌️ Estilo visual",
    apps: "🧩 Aplicación",
    transitions: "✂️ Transiciones (vídeo)",
  };

  const visibleCategories: PromptCategory[] = presetKind === "image"
    ? ["lens","lighting","palette","mood","composition","style","apps"]
    : ["lens","lighting","palette","mood","composition","cameraMovement","style","apps","transitions"];

  const filteredLibrary = library;

  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
      <div>
        <Section title="🎯 Tipo de creación">
          <select value={intent} onChange={e => setIntent(e.target.value as PromptIntent)} style={inputStyle}>
            {(Object.entries(INTENT_LABELS) as Array<[PromptIntent, typeof INTENT_LABELS[PromptIntent]]>).map(([k, v]) => (
              <option key={k} value={k}>{v.emoji} {v.label}</option>
            ))}
          </select>
          <p style={{ fontSize: 11, color: "var(--t3)", marginTop: 6 }}>
            Selecciona el tipo. La IA usará el system prompt PREMIUM correspondiente para refinar.
          </p>
        </Section>
        <Section title="Sujeto / tema principal">
          <textarea
            value={subject}
            onChange={e => setSubject(e.target.value)}
            placeholder="reloj de oro sobre mármol negro / producto X para audiencia Y / email para abandono carrito de Brand Z / landing para SaaS de…"
            style={{ ...inputStyle, minHeight: 70 }}
          />
        </Section>
        <Section title="Marca (opcional)">
          <input value={brand} onChange={e => setBrand(e.target.value)} placeholder="Ej: Hanakaze, Nike, Apple…" style={inputStyle} />
        </Section>
        <Section title="Contexto extra (audiencia, USP, restricciones)">
          <textarea
            value={extraContext}
            onChange={e => setExtraContext(e.target.value)}
            placeholder="audiencia: mujeres 30-45 urbanas / USP: único reloj con cristal de zafiro real / evitar lenguaje pomposo…"
            style={{ ...inputStyle, minHeight: 50 }}
          />
        </Section>
        {isVisualIntent && (
          <>
            {!catalog && <p style={{ fontSize: 11, color: "var(--t3)" }}>Cargando catálogo de presets…</p>}
            {catalog && visibleCategories.map(cat => {
              const items = catalog[cat] || [];
              if (items.length === 0) return null;
              return (
                <Section key={cat} title={CATEGORY_TITLES[cat]}>
                  <select
                    value={picks[cat] || ""}
                    onChange={e => setPicks(p => ({ ...p, [cat]: e.target.value || undefined }))}
                    style={inputStyle}
                  >
                    <option value="">— Sin elección —</option>
                    {items.map(it => (
                      <option key={it.key} value={it.key}>
                        {it.label}{it.description ? ` · ${it.description.slice(0, 80)}` : ""}
                      </option>
                    ))}
                  </select>
                </Section>
              );
            })}
          </>
        )}
        {!isVisualIntent && (
          <div style={{ marginTop: 8, padding: "10px 14px", borderRadius: 8, background: "var(--ink2, #14141d)", border: "1px solid var(--bdr, #22222e)", fontSize: 11, color: "var(--t3, #6c6c7c)", lineHeight: 1.5 }}>
            <strong style={{ color: "var(--gold, #fbbf24)" }}>ℹ Modo texto / copy:</strong> los presets visuales no aplican aquí. Construye un baseline (opcional) y pulsa <em>🪄 Potenciar con IA</em> — se aplicará el system prompt PREMIUM de {INTENT_LABELS[intent].label}.
          </div>
        )}
        <div style={{ display: "flex", gap: 8, marginTop: 12, flexWrap: "wrap" }}>
          <button onClick={build} disabled={busy || enhancing || subject.trim().length < 3} className="btn" style={{ flex: 1, justifyContent: "center", padding: "12px 16px", minWidth: 180 }}>
            {busy ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} />} {busy ? "Construyendo…" : "Construir baseline"}
          </button>
          <button onClick={enhance} disabled={busy || enhancing || subject.trim().length < 3 || !(output || baseline)} className="btn btn-gold" style={{ flex: 1, justifyContent: "center", padding: "12px 16px", minWidth: 180 }}>
            {enhancing ? <Loader2 size={16} className="animate-spin" /> : <Zap size={16} />} {enhancing ? "Refinando…" : "🪄 Potenciar con IA"}
          </button>
          <button onClick={reset} disabled={busy || enhancing} className="btn" style={{ padding: "12px 16px" }}>
            <RefreshCw size={14} /> Reset
          </button>
        </div>
      </div>
      <div>
        <Section title={`Output · ${INTENT_LABELS[intent].emoji} ${INTENT_LABELS[intent].label}${enhancedModel === "claude" ? " · ✨ potenciado" : enhancedModel === "fallback" ? " · ⚠ baseline (Claude offline)" : ""}`}>
          <textarea
            value={output}
            onChange={e => setOutput(e.target.value)}
            placeholder="Tu prompt profesional aparecerá aquí. Es editable: ajusta lo que necesites antes de copiar/guardar."
            style={{ ...inputStyle, minHeight: 280, fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace", fontSize: 12, lineHeight: 1.5 }}
          />
        </Section>
        {negativePrompt && (
          <Section title="🚫 Negative prompt (para Flux/SDXL/Nano Banana)">
            <textarea
              value={negativePrompt}
              onChange={e => setNegativePrompt(e.target.value)}
              style={{ ...inputStyle, minHeight: 60, fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace", fontSize: 11 }}
            />
          </Section>
        )}
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 8 }}>
          <button onClick={() => copy(output, "Prompt")} disabled={!output} className="btn" style={{ flex: 1, justifyContent: "center", padding: "10px 14px", minWidth: 130 }}>
            <Copy size={14} /> Copiar prompt
          </button>
          {negativePrompt && (
            <button onClick={() => copy(negativePrompt, "Negative")} disabled={!negativePrompt} className="btn" style={{ padding: "10px 14px" }}>
              <Copy size={14} /> Negative
            </button>
          )}
          <button onClick={saveToLibrary} disabled={!output || savingToLib} className="btn" style={{ padding: "10px 14px" }}>
            {savingToLib ? <Loader2 size={14} className="animate-spin" /> : <span>💾</span>} Guardar en biblioteca
          </button>
        </div>

        {/* ─── BIBLIOTECA ─────────────────────────────────────────── */}
        <div style={{ marginTop: 16, borderRadius: 10, background: "var(--ink2, #14141d)", border: "1px solid var(--bdr, #22222e)" }}>
          <button
            onClick={() => setLibraryOpen(o => !o)}
            style={{ width: "100%", textAlign: "left", padding: "12px 14px", background: "transparent", border: "none", color: "var(--t1)", fontWeight: 600, cursor: "pointer", display: "flex", justifyContent: "space-between", alignItems: "center" }}
          >
            <span>📚 Biblioteca de Prompts Pro <span style={{ color: "var(--t3)", fontWeight: 400, fontSize: 12 }}>({filteredLibrary.length})</span></span>
            <span style={{ color: "var(--t3)" }}>{libraryOpen ? "▾" : "▸"}</span>
          </button>
          {libraryOpen && (
            <div style={{ padding: "0 14px 14px 14px" }}>
              <select value={libraryFilter} onChange={e => setLibraryFilter(e.target.value as any)} style={{ ...inputStyle, marginBottom: 10 }}>
                <option value="all">— Todas las plantillas —</option>
                {(Object.entries(INTENT_LABELS) as Array<[PromptIntent, typeof INTENT_LABELS[PromptIntent]]>).map(([k, v]) => (
                  <option key={k} value={k}>{v.emoji} {v.label}</option>
                ))}
              </select>
              {libraryLoading && <p style={{ fontSize: 11, color: "var(--t3)", margin: 0 }}>Cargando…</p>}
              {!libraryLoading && filteredLibrary.length === 0 && (
                <p style={{ fontSize: 11, color: "var(--t3)", margin: 0 }}>
                  No hay plantillas para este tipo. Cambia el filtro a "Todas".
                </p>
              )}
              <div style={{ display: "flex", flexDirection: "column", gap: 6, maxHeight: 320, overflowY: "auto" }}>
                {filteredLibrary.map(item => {
                  const intentMeta = (INTENT_LABELS as any)[item.useCase] as { emoji: string; label: string } | undefined;
                  return (
                    <div key={item.id} style={{ padding: 10, borderRadius: 6, background: "var(--ink, #0d0d14)", border: "1px solid var(--bdr, #22222e)" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontWeight: 600, fontSize: 12, color: "var(--t1)", display: "flex", alignItems: "center", gap: 6 }}>
                            {item.isSeed && <span style={{ fontSize: 9, padding: "1px 5px", borderRadius: 3, background: "rgba(200,168,75,0.15)", color: "var(--gold, #fbbf24)" }}>SEED</span>}
                            <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{item.name}</span>
                          </div>
                          {item.description && (
                            <div style={{ fontSize: 10, color: "var(--t3)", marginTop: 2, lineHeight: 1.3 }}>{item.description}</div>
                          )}
                          <div style={{ fontSize: 10, color: "var(--t3)", marginTop: 4 }}>
                            {intentMeta ? `${intentMeta.emoji} ${intentMeta.label}` : item.useCase}
                            {typeof item.useCount === "number" && item.useCount > 0 && ` · usado ${item.useCount}×`}
                          </div>
                        </div>
                        <div style={{ display: "flex", gap: 4, flexShrink: 0 }}>
                          <button onClick={() => loadFromLibrary(item)} className="btn" style={{ padding: "4px 8px", fontSize: 11 }} title="Cargar al editor">
                            📥
                          </button>
                          {!item.isSeed && (
                            <button onClick={() => deleteFromLibrary(item)} className="btn" style={{ padding: "4px 8px", fontSize: 11 }} title="Eliminar">
                              🗑
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* ─── BIBLIOTECA MAESTRA AGENCIA (5000+ templates) ─────────────── */}
        <div style={{ marginTop: 12, borderRadius: 10, background: "var(--ink2, #14141d)", border: "1px solid rgba(200,168,75,0.25)" }}>
          <button
            onClick={() => {
              const next = !masterOpen;
              setMasterOpen(next);
              if (next && masterIndex.length === 0) {
                loadMasterIndex();
                loadMasterLib(masterLibKey, masterSearch, 0);
              }
            }}
            style={{ width: "100%", textAlign: "left", padding: "12px 14px", background: "transparent", border: "none", color: "var(--t1)", fontWeight: 600, cursor: "pointer", display: "flex", justifyContent: "space-between", alignItems: "center" }}
          >
            <span>
              🏛 Biblioteca Maestra de la Agencia{" "}
              <span style={{ fontSize: 10, padding: "2px 6px", borderRadius: 4, background: "rgba(200,168,75,0.15)", color: "var(--gold, #fbbf24)", fontWeight: 700 }}>6,110 templates</span>
            </span>
            <span style={{ color: "var(--t3)" }}>{masterOpen ? "▾" : "▸"}</span>
          </button>
          {masterOpen && (
            <div style={{ padding: "0 14px 14px 14px" }}>
              <div style={{ display: "flex", gap: 6, marginBottom: 8, flexWrap: "wrap" }}>
                <select
                  value={masterLibKey}
                  onChange={e => { setMasterLibKey(e.target.value); loadMasterLib(e.target.value, masterSearch, 0); }}
                  style={{ ...inputStyle, flex: 2, minWidth: 160 }}
                >
                  {masterIndex.length === 0 && <option value="">Cargando librerías…</option>}
                  {masterIndex.map(lib => (
                    <option key={lib.key} value={lib.key}>{lib.key.replace(/_/g, " ")} ({lib.count})</option>
                  ))}
                </select>
                <input
                  value={masterSearch}
                  onChange={e => setMasterSearch(e.target.value)}
                  onKeyDown={e => { if (e.key === "Enter") { loadMasterLib(masterLibKey, masterSearch, 0); } }}
                  placeholder="🔍 Buscar en librería…"
                  style={{ ...inputStyle, flex: 3, minWidth: 140 }}
                />
                <button onClick={() => loadMasterLib(masterLibKey, masterSearch, 0)} className="btn" style={{ padding: "6px 10px", fontSize: 11 }}>
                  Buscar
                </button>
              </div>
              {masterLoading && <p style={{ fontSize: 11, color: "var(--t3)", margin: "6px 0" }}>Cargando…</p>}
              {!masterLoading && masterItems.length === 0 && (
                <p style={{ fontSize: 11, color: "var(--t3)", margin: "6px 0" }}>Sin resultados. Cambia la librería o el término de búsqueda.</p>
              )}
              <div style={{ display: "flex", flexDirection: "column", gap: 5, maxHeight: 300, overflowY: "auto" }}>
                {masterItems.map((item, i) => (
                  <div key={item.id || i} style={{ padding: "8px 10px", borderRadius: 6, background: "var(--ink, #0d0d14)", border: "1px solid var(--bdr, #22222e)" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontWeight: 600, fontSize: 12, color: "var(--t1)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {item.name}
                        </div>
                        {item.description && (
                          <div style={{ fontSize: 10, color: "var(--t3)", marginTop: 2, lineHeight: 1.3, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                            {item.description}
                          </div>
                        )}
                        <div style={{ fontSize: 10, color: "var(--t3)", marginTop: 3, display: "flex", gap: 8 }}>
                          {item.category && <span style={{ padding: "1px 5px", borderRadius: 3, background: "rgba(99,102,241,0.15)", color: "#a5b4fc" }}>{item.category}</span>}
                          {item.engine && <span style={{ padding: "1px 5px", borderRadius: 3, background: "rgba(16,185,129,0.1)", color: "#6ee7b7" }}>{item.engine}</span>}
                          {Array.isArray(item.variables) && item.variables.length > 0 && (
                            <span style={{ color: "var(--t3)" }}>{item.variables.slice(0, 4).map((v: string) => `{{${v}}}`).join(" ")}{item.variables.length > 4 ? ` +${item.variables.length - 4}` : ""}</span>
                          )}
                        </div>
                      </div>
                      <button onClick={() => useMasterTemplate(item)} className="btn" style={{ padding: "4px 8px", fontSize: 11, flexShrink: 0 }} title="Cargar al editor">
                        📥
                      </button>
                    </div>
                  </div>
                ))}
              </div>
              {masterTotal > MASTER_LIMIT && (
                <div style={{ display: "flex", gap: 8, marginTop: 8, alignItems: "center" }}>
                  <button onClick={() => loadMasterLib(masterLibKey, masterSearch, Math.max(0, masterOffset - MASTER_LIMIT))} disabled={masterOffset === 0 || masterLoading} className="btn" style={{ padding: "4px 10px", fontSize: 11 }}>
                    ← Anterior
                  </button>
                  <span style={{ fontSize: 11, color: "var(--t3)", flex: 1, textAlign: "center" }}>
                    {masterOffset + 1}–{Math.min(masterOffset + MASTER_LIMIT, masterTotal)} de {masterTotal}
                  </span>
                  <button onClick={() => loadMasterLib(masterLibKey, masterSearch, masterOffset + MASTER_LIMIT)} disabled={masterOffset + MASTER_LIMIT >= masterTotal || masterLoading} className="btn" style={{ padding: "4px 10px", fontSize: 11 }}>
                    Siguiente →
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        <div style={{ marginTop: 14, padding: "10px 14px", borderRadius: 8, background: "var(--ink2, #14141d)", border: "1px solid var(--bdr, #22222e)", fontSize: 11, color: "var(--t3, #6c6c7c)", lineHeight: 1.5 }}>
          <strong style={{ color: "var(--gold, #fbbf24)" }}>💡 Flujo recomendado:</strong> 1) Escoge tipo y describe el sujeto. 2) (Visual) Combina presets y "Construir baseline". 3) Pulsa <em>🪄 Potenciar con IA</em> para refinarlo. 4) Edita el output. 5) <em>💾 Guardar en biblioteca</em> si te gusta para reutilizarlo.
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// UploadConcatTab — sube tus propios clips MP4 (hasta 20) y los concatena
// con voz/música opcional. Reutiliza POST /api/fs-pro/concat-uploaded (T001).
// ─────────────────────────────────────────────────────────────────────────────
function UploadConcatTab({
  projectId, onSuccess, onError,
}: {
  projectId: number;
  onSuccess: (it: VaultItem) => void;
  onError: (m: string) => void;
}) {
  const [clips, setClips] = useState<File[]>([]);
  const [voice, setVoice] = useState<File | null>(null);
  const [music, setMusic] = useState<File | null>(null);
  const [title, setTitle] = useState("Concat propio");
  const [crossfade, setCrossfade] = useState(0.4);
  const [voiceVol, setVoiceVol] = useState(1.0);
  const [musicVol, setMusicVol] = useState(0.25);
  const [busy, setBusy] = useState(false);
  const [resultUrl, setResultUrl] = useState<string>("");

  const addClips = (files: FileList | null) => {
    if (!files) return;
    const arr = Array.from(files).filter(f => f.type.startsWith("video/"));
    setClips(prev => [...prev, ...arr].slice(0, 20));
  };
  const move = (i: number, dir: -1 | 1) => {
    setClips(prev => {
      const copy = [...prev];
      const j = i + dir;
      if (j < 0 || j >= copy.length) return prev;
      [copy[i], copy[j]] = [copy[j], copy[i]];
      return copy;
    });
  };
  const remove = (i: number) => setClips(prev => prev.filter((_, idx) => idx !== i));

  const run = async () => {
    if (clips.length < 2) {
      onError("Sube al menos 2 clips para concatenar");
      return;
    }
    setBusy(true);
    setResultUrl("");
    try {
      const fd = new FormData();
      fd.append("projectId", String(projectId));
      fd.append("title", title);
      fd.append("crossfadeSec", String(crossfade));
      fd.append("voiceVolume", String(voiceVol));
      fd.append("musicVolume", String(musicVol));
      clips.forEach((c) => fd.append("clips", c));
      if (voice) fd.append("voice", voice);
      if (music) fd.append("music", music);

      const res = await fetch(`${API_BASE}/api/fs-pro/concat-uploaded`, {
        method: "POST", credentials: "include", body: fd,
      });
      const text = await res.text();
      let d: any;
      try { d = JSON.parse(text); } catch { d = { error: text.slice(0, 300) }; }
      if (!res.ok) { onError(d?.error || `Error ${res.status}`); return; }
      const url = `${API_BASE}/api/projects/${projectId}/vault/${d.vaultId}/download`;
      setResultUrl(url);
      onSuccess({ vaultId: d.vaultId, type: "video", label: title, dataUrl: url, mimeType: "video/mp4" });
    } catch (e: any) {
      onError(e?.message || "Error en concatenación");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
      <div>
        <Section title="Clips de video (hasta 20, MP4 ≤200MB cada uno)">
          <input type="file" accept="video/*" multiple onChange={e => addClips(e.target.files)} />
          {clips.length > 0 && (
            <ul style={{ marginTop: 8, padding: 0, listStyle: "none", display: "flex", flexDirection: "column", gap: 4 }}>
              {clips.map((c, i) => (
                <li key={i} style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 10px", background: "var(--ink2, #14141d)", border: "1px solid var(--bdr, #22222e)", borderRadius: 8, fontSize: 12 }}>
                  <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    #{i + 1} · {c.name} · {(c.size / 1024 / 1024).toFixed(1)} MB
                  </span>
                  <button onClick={() => move(i, -1)} disabled={i === 0} className="btn" style={{ padding: "2px 6px" }}>↑</button>
                  <button onClick={() => move(i, 1)} disabled={i === clips.length - 1} className="btn" style={{ padding: "2px 6px" }}>↓</button>
                  <button onClick={() => remove(i)} className="btn" style={{ padding: "2px 6px" }}>×</button>
                </li>
              ))}
            </ul>
          )}
        </Section>
        <Section title="Voz over (MP3/WAV opcional)">
          <input type="file" accept="audio/*" onChange={e => setVoice(e.target.files?.[0] || null)} />
        </Section>
        <Section title="Música de fondo (opcional)">
          <input type="file" accept="audio/*" onChange={e => setMusic(e.target.files?.[0] || null)} />
        </Section>
      </div>
      <div>
        <Section title="Título">
          <input type="text" value={title} onChange={e => setTitle(e.target.value)} style={inputStyle} />
        </Section>
        <Section title="Ajustes">
          <label style={{ display: "block", fontSize: 12, color: "var(--t3, #6c6c7c)", marginBottom: 4 }}>Crossfade entre clips: {crossfade.toFixed(2)}s</label>
          <input type="range" min={0} max={1.5} step={0.05} value={crossfade} onChange={e => setCrossfade(parseFloat(e.target.value))} style={{ width: "100%" }} />
          <label style={{ display: "block", fontSize: 12, color: "var(--t3, #6c6c7c)", marginTop: 8, marginBottom: 4 }}>Volumen voz: {voiceVol.toFixed(2)}</label>
          <input type="range" min={0} max={1.5} step={0.05} value={voiceVol} onChange={e => setVoiceVol(parseFloat(e.target.value))} style={{ width: "100%" }} />
          <label style={{ display: "block", fontSize: 12, color: "var(--t3, #6c6c7c)", marginTop: 8, marginBottom: 4 }}>Volumen música: {musicVol.toFixed(2)}</label>
          <input type="range" min={0} max={1} step={0.05} value={musicVol} onChange={e => setMusicVol(parseFloat(e.target.value))} style={{ width: "100%" }} />
        </Section>
        <button onClick={run} disabled={busy || clips.length < 2} className="btn btn-gold" style={{ width: "100%", justifyContent: "center", padding: "12px 20px" }}>
          {busy ? <Loader2 size={16} className="animate-spin" /> : <Film size={16} />}
          {busy ? "Concatenando…" : `Concatenar ${clips.length} clips y guardar en bóveda`}
        </button>
        <LiveOperation
          active={busy}
          title="Concatenando clips con FFmpeg"
          estimatedSec={Math.max(20, clips.length * 8)}
          messages={[
            "Validando codecs y resoluciones de cada clip…",
            "Aplicando crossfades y normalizando audio…",
            "Mezclando voz over y música de fondo…",
            "Codificando MP4 final con calidad alta…",
            "Subiendo a la bóveda del proyecto…",
          ]}
        />
        {resultUrl && (
          <div style={{ marginTop: 12 }}>
            <video src={resultUrl} controls style={{ width: "100%", borderRadius: 8, background: "#000" }} />
          </div>
        )}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// TAB: CINEMATIC TEMPLATES — Plantillas masterpiece multi-segmento
// (Anatomía / Deconstrucción / Construcción / Exploded View / Apple-Porsche)
// ═══════════════════════════════════════════════════════════════════════════
interface CinematicTplListItem {
  id: string;
  category: "anatomy" | "deconstruction" | "construction" | "exploded_view" | "apple_porsche" | "presenter_hybrid" | "lifestyle" | "personal_brand" | "action_pulse";
  name: string;
  shortDescription: string;
  longDescription: string;
  conceptName: string;
  totalDurationSec: number;
  segmentsCount: number;
  inspirationReference?: string;
  estimatedCreditsHint?: number;
  masterConfig: {
    recommendedVideoModel: string;
    recommendedImageModel: string;
    defaultAspect: "9:16" | "16:9" | "1:1";
    motionScore: number;
    negativePrompt: string;
    styleTag: string;
    requiresPresenter?: boolean;
    defaultPresenterPrompt?: string;
  };
  variables: string[];
  segmentsPreview: Array<{
    idx: number;
    name: string;
    startSec: number;
    endSec: number;
    effectDescription: string;
    screenText: string;
    audioCue: string;
    shotType?: "presenter" | "b_roll" | "product";
  }>;
}

interface ComposedScript {
  templateId: string;
  templateName: string;
  conceptName: string;
  totalDurationSec: number;
  aspect: "9:16" | "16:9" | "1:1";
  recommendedVideoModel: string;
  recommendedImageModel: string;
  motionScore: number;
  negativePrompt: string;
  styleTag: string;
  requiresPresenter?: boolean;
  defaultPresenterPrompt?: string;
  segments: Array<{
    idx: number;
    name: string;
    startSec: number;
    endSec: number;
    effectDescription: string;
    keyframePrompt: string;
    videoPrompt: string;
    screenText: string;
    audioCue: string;
    shotType?: "presenter" | "b_roll" | "product";
    voiceoverLine?: string;
  }>;
  cinematicScriptForRenderer: any;
}

const CINEMATIC_CATEGORY_BADGE: Record<CinematicTplListItem["category"], { label: string; color: string }> = {
  anatomy:          { label: "Anatomía",          color: "#c8a84b" },
  deconstruction:   { label: "Deconstrucción",    color: "#e2664f" },
  construction:     { label: "Construcción",      color: "#4fa3e2" },
  presenter_hybrid: { label: "Presentador",       color: "#c8a84b" },
  exploded_view:    { label: "Exploded View",     color: "#7e6dd6" },
  apple_porsche:    { label: "Apple/Porsche",     color: "#9aa0a6" },
  lifestyle:        { label: "Lifestyle",         color: "#7fb38a" },
  personal_brand:   { label: "Marca Personal",    color: "#d68fb3" },
  action_pulse:     { label: "Action / Sport",    color: "#e74c3c" },
};

function CinematicTemplatesTab({ projectId, onSuccess, onInfo, onError, onCreditError }: {
  projectId: number;
  onSuccess: (it: VaultItem) => void;
  onInfo: (m: string) => void;
  onError: (m: string) => void;
  onCreditError?: () => void;
}) {
  const [templates, setTemplates] = useState<CinematicTplListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string>("");

  // Variables del producto / marca
  const [productName, setProductName] = useState("");
  const [brand, setBrand] = useState("");
  const [productMaterials, setProductMaterials] = useState("");
  const [productColors, setProductColors] = useState("");
  const [industry, setIndustry] = useState("");
  // Variables de marca personal / servicio / educator (plantillas no-producto)
  const [painPoint, setPainPoint] = useState("");
  const [coreBenefit, setCoreBenefit] = useState("");
  const [targetAudience, setTargetAudience] = useState("");
  const [callToAction, setCallToAction] = useState("");
  const [aspect, setAspect] = useState<"9:16" | "16:9" | "1:1">("9:16");

  // Composición / render
  const [composing, setComposing] = useState(false);
  const [composed, setComposed] = useState<ComposedScript | null>(null);
  const [productFile, setProductFile] = useState<File | null>(null);
  const [rendering, setRendering] = useState(false);
  const [renderResult, setRenderResult] = useState<{ vaultId: number; durationSec: number; scenesCount: number } | null>(null);

  // Presenter (host avatar) — solo se usa cuando la plantilla tiene requiresPresenter=true
  const [presenterFile, setPresenterFile] = useState<File | null>(null);
  const [presenterIdentity, setPresenterIdentity] = useState("");
  const [narrationVoiceId, setNarrationVoiceId] = useState("");
  const [enableNarration, setEnableNarration] = useState(true);

  const selected = useMemo(() => templates.find(t => t.id === selectedId) || null, [templates, selectedId]);
  const requiresPresenter = Boolean(selected?.masterConfig?.requiresPresenter);

  // Variables-aware UI: solo mostramos inputs que la plantilla declara en
  // `variables[]`. Esto da soporte universal a plantillas de marca personal
  // / educator (que no necesitan materiales/colores pero sí pain-point/CTA).
  const tplVars = useMemo(() => new Set(selected?.variables || []), [selected]);
  const wants = (key: string) => tplVars.size === 0 || tplVars.has(key);
  // El producto físico es opcional para plantillas talking-head / personal-brand
  // que no usan {{PRODUCT_NAME}}. Si la plantilla no lo declara, no exigimos
  // ni el nombre de producto ni el upload de imagen.
  const requiresPhysicalProduct = wants("PRODUCT_NAME");

  // Pre-rellena identityPrompt cuando la plantilla tiene defaultPresenterPrompt.
  // Se ejecuta cuando cambia la plantilla seleccionada (no cuando cambia
  // presenterIdentity, para no luchar contra ediciones del usuario).
  useEffect(() => {
    if (selected?.masterConfig?.defaultPresenterPrompt) {
      setPresenterIdentity(selected.masterConfig.defaultPresenterPrompt);
    } else {
      setPresenterIdentity("");
    }
    if (selected?.masterConfig?.requiresPresenter) setEnableNarration(true);
    // Reset presenter file when changing template — the previous presenter
    // photo may not match the new template's needs.
    setPresenterFile(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId]);

  // Carga inicial del catálogo
  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const r = await fetch(`${API_BASE}/api/fs-pro/cinematic-templates`, { credentials: "include" });
        const d = await r.json();
        if (!r.ok) { onError(d.error || `Error ${r.status}`); return; }
        if (!cancelled) {
          setTemplates(d.items || []);
          if (!selectedId && d.items?.length) {
            setSelectedId(d.items[0].id);
            setAspect(d.items[0].masterConfig.defaultAspect);
          }
        }
      } catch (e: any) {
        if (!cancelled) onError(e?.message || "No se pudo cargar el catálogo de plantillas");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Cuando el usuario cambia de template, ajusta el aspect por defecto y limpia composición
  useEffect(() => {
    if (selected) {
      setAspect(selected.masterConfig.defaultAspect);
      setComposed(null);
      setRenderResult(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId]);

  const compose = async () => {
    if (!selected) { onError("Selecciona una plantilla primero"); return; }
    if (requiresPhysicalProduct && productName.trim().length < 2) {
      onError("Nombre del producto requerido (mín 2 caracteres)"); return;
    }
    if (brand.trim().length < 2) { onError("Marca requerida (mín 2 caracteres)"); return; }
    // Validación específica para plantillas marca personal: pedimos al
    // menos el beneficio principal y el CTA, las dos variables que dan
    // sentido al guion talking-head.
    if (wants("CORE_BENEFIT") && coreBenefit.trim().length < 2) {
      onError("Beneficio principal requerido (mín 2 caracteres)"); return;
    }
    if (wants("CALL_TO_ACTION") && callToAction.trim().length < 2) {
      onError("Llamado a la acción requerido (mín 2 caracteres)"); return;
    }
    setComposing(true);
    try {
      const r = await fetch(`${API_BASE}/api/fs-pro/cinematic-templates/${encodeURIComponent(selected.id)}/compose`, {
        method: "POST", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          productName: productName.trim() || brand.trim(),
          brand: brand.trim(),
          productMaterials: productMaterials.trim() || undefined,
          productColors: productColors.trim() || undefined,
          industry: industry.trim() || undefined,
          painPoint:      painPoint.trim()      || undefined,
          coreBenefit:    coreBenefit.trim()    || undefined,
          targetAudience: targetAudience.trim() || undefined,
          callToAction:   callToAction.trim()   || undefined,
          aspect,
        }),
      });
      const d = await r.json();
      if (!r.ok) { onError(d.error || `Error ${r.status}`); return; }
      setComposed(d.composed);
      setRenderResult(null);
      onInfo(`Guion compuesto: "${d.composed.conceptName}" — ${d.composed.segments.length} segmentos · ${d.composed.totalDurationSec}s`);
    } catch (e: any) {
      onError(e?.message || "Error componiendo el guion");
    } finally {
      setComposing(false);
    }
  };

  const launchRender = async () => {
    if (!composed) { onError("Componer el guion primero"); return; }
    if (!selected) return;
    if (!productFile) { onError("Sube una imagen del producto para renderizar"); return; }
    if (requiresPresenter && !presenterFile) {
      onError("Esta plantilla requiere un presentador: sube una foto del host antes de generar");
      return;
    }
    if (requiresPresenter && presenterIdentity.trim().length < 10) {
      onError("Describe brevemente al presentador (mín 10 caracteres) para el character lock");
      return;
    }
    const credits = selected.estimatedCreditsHint ?? (2 + composed.segments.length * 3);
    const ok = window.confirm(
      `Vas a generar un anuncio cinematográfico real:\n\n` +
      `• Plantilla: ${selected.name}\n` +
      `• Producto: ${productName} (${brand})\n` +
      `• Duración: ${composed.totalDurationSec}s · ${composed.segments.length} segmentos\n` +
      `• Modelo: ${composed.recommendedVideoModel}\n` +
      (requiresPresenter ? `• Presentador: ${presenterFile?.name} (${(presenterFile!.size / 1024).toFixed(1)} KB)\n` : ``) +
      (enableNarration ? `• Narración: ElevenLabs${narrationVoiceId ? ` (voz ${narrationVoiceId})` : " (Rachel default)"}\n` : ``) +
      `• Coste estimado: ${credits} créditos${enableNarration ? " + ~0.5 narración" : ""}\n\n` +
      `¿Continuar?`,
    );
    if (!ok) return;
    setRendering(true);
    try {
      const fd = new FormData();
      fd.append("projectId", String(projectId));
      fd.append("brand", brand.trim());
      fd.append("productName", productName.trim());
      fd.append("language", "es");
      fd.append("scenesCount", String(composed.segments.length));
      fd.append("totalDurationSec", String(composed.totalDurationSec));
      fd.append("aspect", composed.aspect);
      fd.append("videoModel", composed.recommendedVideoModel);
      fd.append("imageModel", composed.recommendedImageModel);
      fd.append("style", composed.styleTag);
      if (industry.trim()) fd.append("niche", industry.trim());
      fd.append("narrationEnabled", String(enableNarration));
      if (enableNarration && narrationVoiceId.trim()) fd.append("narrationVoiceId", narrationVoiceId.trim());
      fd.append("musicEnabled", "false");
      fd.append("product", productFile);
      // Presenter (character lock) — sólo cuando la plantilla lo requiere
      if (requiresPresenter && presenterFile) {
        fd.append("character", presenterFile);
        fd.append("characterName", "Presentador");
        fd.append("characterIdentityPrompt", presenterIdentity.trim());
      }
      // Pasamos el guion compuesto como presetScript — el motor saltará la generación con Claude
      fd.append("script", JSON.stringify(composed.cinematicScriptForRenderer));
      const r = await fetch(`${API_BASE}/api/fs-pro/cinematic-multishot`, {
        method: "POST", credentials: "include", body: fd,
      });
      const d = await r.json();
      if (r.status === 402) { onCreditError?.(); onError(d.error || "Sin créditos suficientes"); return; }
      if (!r.ok) { onError(d.error || `Error ${r.status}`); return; }
      setRenderResult({ vaultId: d.vaultId, durationSec: d.durationSec, scenesCount: d.scenesCount });
      onSuccess({
        vaultId: d.vaultId,
        type: "fs-pro-multishot",
        label: `Cinematic: ${productName}`,
        mimeType: "video/mp4",
      } as VaultItem);
    } catch (e: any) {
      onError(e?.message || "Error generando el anuncio cinematográfico");
    } finally {
      setRendering(false);
    }
  };

  if (loading) {
    return (
      <div style={{ padding: 32, textAlign: "center", color: "var(--t3)" }}>
        <Loader2 size={20} className="animate-spin" style={{ marginBottom: 8 }} />
        <div>Cargando biblioteca de plantillas cinematográficas…</div>
      </div>
    );
  }

  return (
    <div style={{ display: "grid", gridTemplateColumns: "320px 1fr", gap: 16 }}>
      {/* ─── COLUMNA IZQUIERDA: Catálogo de templates ─── */}
      <div>
        <Section title="🎬 Biblioteca de plantillas">
          <p style={{ fontSize: 11, color: "var(--t3)", marginTop: 0, marginBottom: 12, lineHeight: 1.5 }}>
            Plantillas cinematográficas profesionales (estilo Pollo / Kling / Seedance) que la plataforma usa
            como conocimiento permanente. Cada una rellena las variables con datos reales del producto.
          </p>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {templates.map(t => {
              const badge = CINEMATIC_CATEGORY_BADGE[t.category];
              const isActive = t.id === selectedId;
              return (
                <button
                  key={t.id}
                  onClick={() => setSelectedId(t.id)}
                  style={{
                    textAlign: "left",
                    padding: "12px 14px",
                    borderRadius: 10,
                    background: isActive
                      ? "linear-gradient(135deg, rgba(200,168,75,0.18), rgba(200,168,75,0.05))"
                      : "var(--ink2, #14141d)",
                    border: isActive
                      ? "1px solid rgba(200,168,75,0.45)"
                      : "1px solid var(--bdr, #22222e)",
                    color: "var(--t1, #fff)",
                    cursor: "pointer",
                    fontFamily: "inherit",
                    transition: "all 0.15s ease",
                  }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
                    <span style={{ fontSize: 13, fontWeight: 700 }}>{t.name}</span>
                  </div>
                  <div style={{ display: "flex", gap: 6, marginBottom: 6, flexWrap: "wrap" }}>
                    <span style={{
                      fontSize: 9, fontWeight: 700, padding: "2px 6px", borderRadius: 4,
                      background: `${badge.color}22`, color: badge.color, textTransform: "uppercase", letterSpacing: 0.4,
                    }}>{badge.label}</span>
                    <span style={{
                      fontSize: 9, fontWeight: 600, padding: "2px 6px", borderRadius: 4,
                      background: "var(--ink, #0a0a14)", color: "var(--t3)",
                    }}>{t.totalDurationSec}s · {t.segmentsCount} seg</span>
                  </div>
                  <div style={{ fontSize: 11, color: "var(--t3, #6c6c7c)", lineHeight: 1.4 }}>
                    {t.shortDescription}
                  </div>
                </button>
              );
            })}
          </div>
        </Section>
      </div>

      {/* ─── COLUMNA DERECHA: Detalle + form + preview + render ─── */}
      <div>
        {!selected ? (
          <div style={{ padding: 32, textAlign: "center", color: "var(--t3)" }}>
            Selecciona una plantilla para verla en detalle
          </div>
        ) : (
          <>
            <Section title={`✨ ${selected.conceptName}`}>
              <p style={{ fontSize: 12, color: "var(--t2)", lineHeight: 1.6, marginTop: 0 }}>
                {selected.longDescription}
              </p>
              {selected.inspirationReference && (
                <div style={{ fontSize: 11, color: "var(--gold, #c8a84b)", fontStyle: "italic", marginTop: 8 }}>
                  Inspiración: {selected.inspirationReference}
                </div>
              )}
              <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 8, marginTop: 12, fontSize: 11 }}>
                <div style={{ padding: 8, background: "var(--ink2)", borderRadius: 6, border: "1px solid var(--bdr)" }}>
                  <div style={{ color: "var(--t3)", fontSize: 10, marginBottom: 2 }}>Modelo IA</div>
                  <div style={{ fontWeight: 700 }}>{selected.masterConfig.recommendedVideoModel}</div>
                </div>
                <div style={{ padding: 8, background: "var(--ink2)", borderRadius: 6, border: "1px solid var(--bdr)" }}>
                  <div style={{ color: "var(--t3)", fontSize: 10, marginBottom: 2 }}>Aspecto</div>
                  <div style={{ fontWeight: 700 }}>{selected.masterConfig.defaultAspect}</div>
                </div>
                <div style={{ padding: 8, background: "var(--ink2)", borderRadius: 6, border: "1px solid var(--bdr)" }}>
                  <div style={{ color: "var(--t3)", fontSize: 10, marginBottom: 2 }}>Motion score</div>
                  <div style={{ fontWeight: 700 }}>{selected.masterConfig.motionScore}/10</div>
                </div>
                <div style={{ padding: 8, background: "var(--ink2)", borderRadius: 6, border: "1px solid var(--bdr)" }}>
                  <div style={{ color: "var(--t3)", fontSize: 10, marginBottom: 2 }}>Coste estimado</div>
                  <div style={{ fontWeight: 700, color: "var(--gold)" }}>~{selected.estimatedCreditsHint ?? 8} créd.</div>
                </div>
              </div>
            </Section>

            <Section title="🧬 Estructura de segmentos (sin rellenar)">
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {selected.segmentsPreview.map((seg: any) => (
                  <div key={seg.idx} style={{
                    padding: 10, background: "var(--ink2)", borderRadius: 8,
                    border: "1px solid var(--bdr)", fontSize: 12,
                  }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 4 }}>
                      <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
                        <strong style={{ color: "var(--gold)" }}>Segmento {seg.idx}: {seg.name}</strong>
                        {seg.shotType && (
                          <span style={{
                            fontSize: 9, fontWeight: 700, padding: "2px 6px", borderRadius: 4,
                            textTransform: "uppercase", letterSpacing: 0.4,
                            background: seg.shotType === "presenter" ? "rgba(200,168,75,0.18)" : "rgba(120,140,200,0.15)",
                            color: seg.shotType === "presenter" ? "var(--gold, #c8a84b)" : "#8aa4ff",
                          }}>
                            {seg.shotType === "presenter" ? "Presentador" : seg.shotType === "b_roll" ? "B-Roll" : "Producto"}
                          </span>
                        )}
                      </span>
                      <span style={{ fontSize: 10, color: "var(--t3)" }}>{seg.startSec}s → {seg.endSec}s</span>
                    </div>
                    <div style={{ color: "var(--t2)", marginBottom: 4 }}>{seg.effectDescription}</div>
                    {seg.screenText && (
                      <div style={{ fontSize: 11, color: "var(--t3)", marginTop: 4 }}>
                        <strong>Texto en pantalla:</strong> {seg.screenText}
                      </div>
                    )}
                    <div style={{ fontSize: 11, color: "var(--t3)", marginTop: 2 }}>
                      <strong>Audio:</strong> {seg.audioCue}
                    </div>
                  </div>
                ))}
              </div>
            </Section>

            <Section title="📦 Datos del producto (variables a rellenar)">
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                {wants("PRODUCT_NAME") && (
                  <div>
                    <label style={{ fontSize: 11, color: "var(--t3)", display: "block", marginBottom: 4 }}>Producto *</label>
                    <input type="text" value={productName} onChange={e => setProductName(e.target.value)}
                      placeholder="Ej. Day-Date 40mm KAWS Edition"
                      style={inputStyle} />
                  </div>
                )}
                <div>
                  <label style={{ fontSize: 11, color: "var(--t3)", display: "block", marginBottom: 4 }}>Marca *</label>
                  <input type="text" value={brand} onChange={e => setBrand(e.target.value)}
                    placeholder={requiresPhysicalProduct ? "Ej. Rolex" : "Ej. Tu nombre o marca personal"}
                    style={inputStyle} />
                </div>
                {wants("PRODUCT_MATERIALS") && (
                  <div>
                    <label style={{ fontSize: 11, color: "var(--t3)", display: "block", marginBottom: 4 }}>Materiales</label>
                    <input type="text" value={productMaterials} onChange={e => setProductMaterials(e.target.value)}
                      placeholder="Ej. 18kt yellow gold, ceramic, sapphire crystal"
                      style={inputStyle} />
                  </div>
                )}
                {wants("PRODUCT_COLORS") && (
                  <div>
                    <label style={{ fontSize: 11, color: "var(--t3)", display: "block", marginBottom: 4 }}>Colores</label>
                    <input type="text" value={productColors} onChange={e => setProductColors(e.target.value)}
                      placeholder="Ej. champagne gold, deep black, ivory white"
                      style={inputStyle} />
                  </div>
                )}
                {wants("INDUSTRY") && (
                  <div>
                    <label style={{ fontSize: 11, color: "var(--t3)", display: "block", marginBottom: 4 }}>Industria / Contexto</label>
                    <input type="text" value={industry} onChange={e => setIndustry(e.target.value)}
                      placeholder="Ej. luxury watchmaking, fitness, beauty, fashion, home decor, automotive, food, tech"
                      style={inputStyle} />
                  </div>
                )}
                {wants("TARGET_AUDIENCE") && (
                  <div>
                    <label style={{ fontSize: 11, color: "var(--t3)", display: "block", marginBottom: 4 }}>Audiencia objetivo</label>
                    <input type="text" value={targetAudience} onChange={e => setTargetAudience(e.target.value)}
                      placeholder="Ej. emprendedores que escalan su negocio digital"
                      style={inputStyle} />
                  </div>
                )}
                {wants("PAIN_POINT") && (
                  <div>
                    <label style={{ fontSize: 11, color: "var(--t3)", display: "block", marginBottom: 4 }}>Punto de dolor</label>
                    <input type="text" value={painPoint} onChange={e => setPainPoint(e.target.value)}
                      placeholder="Ej. la dificultad de captar clientes premium"
                      style={inputStyle} />
                  </div>
                )}
                {wants("CORE_BENEFIT") && (
                  <div>
                    <label style={{ fontSize: 11, color: "var(--t3)", display: "block", marginBottom: 4 }}>Beneficio principal *</label>
                    <input type="text" value={coreBenefit} onChange={e => setCoreBenefit(e.target.value)}
                      placeholder="Ej. libertad financiera real en 90 días"
                      style={inputStyle} />
                  </div>
                )}
                {wants("CALL_TO_ACTION") && (
                  <div>
                    <label style={{ fontSize: 11, color: "var(--t3)", display: "block", marginBottom: 4 }}>Llamado a la acción *</label>
                    <input type="text" value={callToAction} onChange={e => setCallToAction(e.target.value)}
                      placeholder="Ej. Reserva tu sesión gratuita en el link"
                      style={inputStyle} />
                  </div>
                )}
                <div>
                  <label style={{ fontSize: 11, color: "var(--t3)", display: "block", marginBottom: 4 }}>Aspecto</label>
                  <select value={aspect} onChange={e => setAspect(e.target.value as any)} style={inputStyle}>
                    <option value="9:16">9:16 (vertical · Reels/TikTok)</option>
                    <option value="16:9">16:9 (cinematográfico)</option>
                    <option value="1:1">1:1 (cuadrado · feed)</option>
                  </select>
                </div>
              </div>
              <button
                onClick={compose}
                disabled={composing}
                className="btn btn-gold"
                style={{ width: "100%", justifyContent: "center", marginTop: 12, padding: "10px 18px" }}>
                {composing ? <Loader2 size={14} className="animate-spin" /> : <Wand2 size={14} />}
                {composing ? "Componiendo guion…" : "Componer guion con datos del producto"}
              </button>
            </Section>

            {composed && (
              <Section title={`🎯 Guion compuesto: "${composed.conceptName}"`}>
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  {composed.segments.map(seg => (
                    <div key={seg.idx} style={{
                      padding: 12, background: "var(--ink2)", borderRadius: 8,
                      border: "1px solid var(--bdr)",
                    }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 8 }}>
                        <strong style={{ color: "var(--gold)", fontSize: 13 }}>
                          Segmento {seg.idx}: {seg.name}
                        </strong>
                        <span style={{ fontSize: 10, color: "var(--t3)" }}>{seg.startSec}s → {seg.endSec}s</span>
                      </div>
                      <div style={{ fontSize: 11, color: "var(--t3)", marginBottom: 6 }}>
                        <strong style={{ color: "var(--t2)" }}>Keyframe prompt (image model):</strong>
                        <div style={{ marginTop: 4, fontFamily: "monospace", fontSize: 10, lineHeight: 1.5,
                          padding: 8, background: "var(--ink, #0a0a14)", borderRadius: 4, color: "var(--t1)",
                        }}>{seg.keyframePrompt}</div>
                      </div>
                      <div style={{ fontSize: 11, color: "var(--t3)", marginBottom: 6 }}>
                        <strong style={{ color: "var(--t2)" }}>Video prompt (motion model):</strong>
                        <div style={{ marginTop: 4, fontFamily: "monospace", fontSize: 10, lineHeight: 1.5,
                          padding: 8, background: "var(--ink, #0a0a14)", borderRadius: 4, color: "var(--t1)",
                        }}>{seg.videoPrompt}</div>
                      </div>
                      {seg.screenText && (
                        <div style={{ fontSize: 11, color: "var(--t3)", marginBottom: 4 }}>
                          <strong style={{ color: "var(--t2)" }}>Texto en pantalla:</strong> {seg.screenText}
                        </div>
                      )}
                      <div style={{ fontSize: 11, color: "var(--t3)" }}>
                        <strong style={{ color: "var(--t2)" }}>Audio:</strong> {seg.audioCue}
                      </div>
                    </div>
                  ))}
                </div>
                <div style={{ marginTop: 10, padding: 10, background: "var(--ink2)", borderRadius: 8,
                  border: "1px solid var(--bdr)", fontSize: 11, color: "var(--t3)",
                }}>
                  <strong style={{ color: "var(--t2)" }}>Negative prompt (aplicado a cada keyframe):</strong>
                  <div style={{ marginTop: 4, fontFamily: "monospace", fontSize: 10, lineHeight: 1.5 }}>
                    {composed.negativePrompt}
                  </div>
                  <div style={{ marginTop: 8, fontSize: 10, color: "var(--t3)", fontStyle: "italic" }}>
                    Nota: motionScore y audioCue del template son orientativos (sound design y
                    motion strength se gestionan por modelo). El render real respetará la estructura
                    de segmentos, los prompts compuestos y este negative prompt.
                  </div>
                </div>
              </Section>
            )}

            {composed && requiresPresenter && (
              <Section title="🎙️ Presentador (host avatar) — requerido por esta plantilla">
                <div style={{ padding: 10, background: "rgba(200,168,75,0.08)",
                  border: "1px solid rgba(200,168,75,0.25)", borderRadius: 8, marginBottom: 12, fontSize: 11, color: "var(--t2)", lineHeight: 1.5,
                }}>
                  Esta plantilla combina escenas con presentador (idx 1, 5) y B-roll del producto (idx 2-4).
                  El motor aplica <strong>character lock</strong> SÓLO en los planos del presentador; las B-roll
                  son del producto puro sin la cara del host. Sube una foto frontal nítida del presentador.
                </div>
                <label style={{ fontSize: 11, color: "var(--t3)", display: "block", marginBottom: 4 }}>
                  Foto del presentador * (frontal, buena iluminación, fondo neutro recomendado)
                </label>
                <input
                  type="file"
                  accept="image/*"
                  onChange={e => setPresenterFile(e.target.files?.[0] || null)}
                  style={{ marginBottom: 10, color: "var(--t2)" }}
                />
                {presenterFile && (
                  <div style={{ fontSize: 11, color: "var(--t3)", marginBottom: 10 }}>
                    Foto lista: <strong>{presenterFile.name}</strong> ({(presenterFile.size / 1024).toFixed(1)} KB)
                  </div>
                )}
                <label style={{ fontSize: 11, color: "var(--t3)", display: "block", marginBottom: 4 }}>
                  Descripción del presentador (identity-lock — el motor lo concatenará a cada keyframe del host)
                </label>
                <textarea
                  value={presenterIdentity}
                  onChange={e => setPresenterIdentity(e.target.value)}
                  placeholder="Ej. A charismatic 30-year-old male executive in tailored charcoal suit, intelligent confident gaze..."
                  rows={3}
                  style={{ ...inputStyle, fontFamily: "inherit", resize: "vertical", marginBottom: 12 }}
                />
                <div style={{ display: "grid", gridTemplateColumns: "auto 1fr", gap: 10, alignItems: "center", marginBottom: 8 }}>
                  <label style={{ fontSize: 12, color: "var(--t2)", display: "flex", alignItems: "center", gap: 6 }}>
                    <input type="checkbox" checked={enableNarration} onChange={e => setEnableNarration(e.target.checked)} />
                    Narrar voiceover con ElevenLabs
                  </label>
                  <input
                    type="text"
                    value={narrationVoiceId}
                    onChange={e => setNarrationVoiceId(e.target.value)}
                    placeholder="VoiceID (opcional · default Rachel)"
                    style={inputStyle}
                    disabled={!enableNarration}
                  />
                </div>
                <div style={{ fontSize: 10, color: "var(--t3)", fontStyle: "italic" }}>
                  El motor concatenará todas las líneas <code>voiceoverLine</code> del guion en un solo TTS
                  alineado con la duración total. Las escenas sin línea quedan como pausas naturales.
                </div>
              </Section>
            )}

            {composed && (
              <Section title="🎬 Lanzar generación real">
                <p style={{ fontSize: 11, color: "var(--t3)", marginTop: 0, lineHeight: 1.5, marginBottom: 10 }}>
                  Sube la imagen del producto y lanza la generación. El motor usará el guion compuesto
                  directamente (sin pasar por Claude para escribir prompts) y producirá un MP4 final
                  guardado en la bóveda del proyecto.
                </p>
                <input
                  type="file"
                  accept="image/*"
                  onChange={e => setProductFile(e.target.files?.[0] || null)}
                  style={{ marginBottom: 10, color: "var(--t2)" }}
                />
                {productFile && (
                  <div style={{ fontSize: 11, color: "var(--t3)", marginBottom: 10 }}>
                    Imagen lista: <strong>{productFile.name}</strong> ({(productFile.size / 1024).toFixed(1)} KB)
                  </div>
                )}
                <button
                  onClick={launchRender}
                  disabled={rendering || !productFile || (requiresPresenter && !presenterFile)}
                  className="btn btn-gold"
                  style={{ width: "100%", justifyContent: "center", padding: "12px 20px" }}>
                  {rendering ? <Loader2 size={16} className="animate-spin" /> : <Film size={16} />}
                  {rendering
                    ? "Generando anuncio cinematográfico…"
                    : `Generar anuncio (~${selected.estimatedCreditsHint ?? (2 + composed.segments.length * 3)} créditos)`}
                </button>
                <LiveOperation
                  active={rendering}
                  title={`Generando "${composed.conceptName}"`}
                  estimatedSec={Math.max(60, composed.segments.length * 35)}
                  messages={[
                    "Generando keyframes con el modelo de imagen…",
                    "Animando cada segmento con el modelo de vídeo…",
                    "Concatenando los clips con cross-fade cinematográfico…",
                    "Aplicando negative prompt del template a cada keyframe…",
                    "Subiendo MP4 final a la bóveda del proyecto…",
                  ]}
                />
                {renderResult && (
                  <div style={{ marginTop: 12, padding: 12, background: "rgba(200,168,75,0.10)",
                    border: "1px solid rgba(200,168,75,0.35)", borderRadius: 8, fontSize: 12,
                  }}>
                    <CheckCircle2 size={14} style={{ color: "var(--gold)", marginRight: 6, verticalAlign: "middle" }} />
                    Anuncio generado: <strong>{renderResult.scenesCount} segmentos · {renderResult.durationSec}s</strong>
                    {" "}· Vault #{renderResult.vaultId}
                  </div>
                )}
              </Section>
            )}
          </>
        )}
      </div>
    </div>
  );
}
