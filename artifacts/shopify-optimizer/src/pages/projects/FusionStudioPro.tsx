import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { useRoute } from "wouter";
import { Sparkles, Wand2, Video, Mic, Volume2, Music, Layers, Download, Loader2, Palette, Maximize2, X, CheckCircle2, AlertCircle, Film, UserSquare, Zap, RefreshCw, Copy, FileText, Scissors, Bot, BookOpen, Plus, Trash2, UploadCloud, PlayCircle } from "lucide-react";
import { LiveOperation } from "@/components/LiveOperation";
import VideoStudio from "./VideoStudio";

const API_BASE = import.meta.env.BASE_URL?.replace(/\/$/, "") ?? "";

type Tab = "generate" | "edit" | "background" | "enhance" | "video" | "multishot" | "uploadconcat" | "avatars" | "audio" | "audiotools" | "compose" | "protools" | "promptlab" | "cinematic-templates" | "openart" | "downloads";

type ProviderId = "replicate" | "runway" | "gemini" | "elevenlabs" | "xai";
type ProviderStatus = "ok" | "missing_key" | "out_of_credits" | "rate_limited" | "down" | "unknown";
interface ProviderHealth { provider: ProviderId; status: ProviderStatus; hasKey: boolean; detail?: string; checkedAt: number }
type HealthMap = Record<ProviderId, ProviderHealth>;

interface ModelWithProvider {
  key: string; label: string; description: string;
  provider?: ProviderId;
  costPerImage?: number; aspectRatios?: string[]; maxResolution?: string;
  costPerSec?: number; quality?: number; maxDuration?: number;
}
interface CinematicStyle { key: string; label: string; description: string }
interface AvatarEntry { id: string; name: string; niche: string; gender: string; defaultLanguage: string; defaultVoiceId: string; personaPrompt?: string }
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
  cinematicMultiShot?: { description: string; styles: CinematicStyle[]; scenesRange: { min: number; max: number }; durationRange: { min: number; max: number }; aspects: string[] };
  longAd?: { description: string; scenesRange: { min: number; max: number }; durationRange: { min: number; max: number }; compositionModes: string[]; aspects: string[] };
  avatarStudio?: { description: string; niches: string[]; avatars: AvatarEntry[] };
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
  replicate: "Replicate", runway: "Runway", gemini: "Gemini", elevenlabs: "ElevenLabs", xai: "xAI (Grok)",
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
  { id: "background", label: "Fondo",           icon: <Layers size={15} />,   desc: "Quitar / reemplazar fondo profesional, Variaciones, Face Swap, Inpainting, Outpainting" },
  { id: "enhance",    label: "Mejorar",         icon: <Maximize2 size={15} />,desc: "Imágenes (Real-ESRGAN, Clarity, GFPGAN) y vídeo (Topaz, Real-ESRGAN Video) hasta 4K" },
  { id: "video",      label: "Video",           icon: <Video size={15} />,    desc: "Runway Gen-4, Kling 2.1, Seedance, Hailuo, Veo 3" },
  { id: "multishot",  label: "Multi-shot",      icon: <Film size={15} />,     desc: "Anuncios cinematográficos por escenas (Seedance / Kling / Veo / Runway)" },
  { id: "uploadconcat", label: "Video Studio", icon: <Film size={15} />,      desc: "Editor de vídeo profesional multi-pista: timeline, AI clips, narración, música, texto, efectos y exportación" },
  { id: "avatars",    label: "Avatares",        icon: <UserSquare size={15} />, desc: "Talking heads y product avatars por nicho" },
  { id: "audio",      label: "Voz & Música",    icon: <Mic size={15} />,       desc: "TTS, voice clone, SFX, música original" },
  { id: "audiotools", label: "Audio AI Tools",  icon: <FileText size={15} />, desc: "Transcripción, aislamiento de voz, agentes ConvAI y diccionarios de pronunciación" },
  { id: "compose",    label: "Componer",        icon: <Palette size={15} />,  desc: "Mezcla video + voz + música + texto en MP4" },
  { id: "protools",   label: "Pro tools",       icon: <Mic size={15} />,      desc: "Lip-sync, subtítulos auto, motion transfer" },
  { id: "promptlab",  label: "Prompt Lab",      icon: <Zap size={15} />,      desc: "Construye prompts profesionales: imagen, vídeo, podcast, testimonial, Reels, unboxing, narrativa de marca" },
  { id: "cinematic-templates", label: "Cinematic Templates", icon: <Film size={15} />, desc: "Plantillas masterpiece: Anatomía / Deconstrucción / Construcción / Exploded View / Apple-Porsche" },
  { id: "openart",    label: "🎨 OpenArt Engine", icon: <Sparkles size={15} />, desc: "Motor de prompts OpenArt: 40+ estilos, fórmula maestra, libro de prompts, 100+ plantillas, enhancer IA" },
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
        {(["replicate","runway","gemini","elevenlabs","xai"] as ProviderId[]).map(p => (
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
        {tab === "uploadconcat" && <VideoStudio projectId={projectId} onSuccess={(it) => { addItem(it); showToast("Video exportado y guardado en bóveda ✓", true); }} onError={(m) => showToast(m, false)} />}
        {tab === "avatars"    && <AvatarsTab   caps={caps} projectId={projectId} onSuccess={(it) => { addItem(it); showToast("Avatar listo", true); }} onError={(m) => showToast(m, false)} />}
        {tab === "audio"      && <AudioTab    caps={caps} projectId={projectId} onSuccess={(it) => { addItem(it); showToast("Audio listo", true); }} onError={(m) => showToast(m, false)} onInfo={(m) => showToast(m, true)} />}
        {tab === "audiotools" && <AudioToolsTab projectId={projectId} onInfo={(m) => showToast(m, true)} onError={(m) => showToast(m, false)} />}
        {tab === "compose"    && <ComposeTab projectId={projectId} sessionItems={sessionItems} onSuccess={(it) => { addItem(it); showToast("Compose listo", true); }} onError={(m) => showToast(m, false)} />}
        {tab === "protools"   && <ProToolsTab caps={caps} projectId={projectId} sessionItems={sessionItems} onSuccess={(it) => { addItem(it); showToast("Listo", true); }} onError={(m) => showToast(m, false)} />}
        {tab === "promptlab"  && <PromptLabTab onInfo={(m) => showToast(m, true)} onError={(m) => showToast(m, false)} />}
        {tab === "cinematic-templates" && <CinematicTemplatesTab projectId={projectId} onSuccess={(it) => { addItem(it); showToast("Anuncio cinematográfico generado y guardado en Vault", true); }} onInfo={(m) => showToast(m, true)} onError={(m) => showToast(m, false)} onCreditError={() => refreshHealth(true)} />}
        {tab === "openart"    && <OpenArtEngineTab onInfo={(m) => showToast(m, true)} onError={(m) => showToast(m, false)} />}
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

  // Reset aspect ratio when model changes if current ratio not supported
  useEffect(() => {
    const ratios = modelCfg?.aspectRatios;
    if (ratios && ratios.length > 0 && !ratios.includes(aspectRatio)) {
      setAspectRatio(ratios[0]);
    }
  }, [model, modelCfg]);

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
        <Section title={`Aspecto · ${modelCfg?.maxResolution ?? ""}`}>
          <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
            {(modelCfg?.aspectRatios || ["1:1", "16:9", "9:16"]).map(a => (
              <button key={a} onClick={() => setAspectRatio(a)} style={pillButton(aspectRatio === a)}>{a}</button>
            ))}
          </div>
          {modelCfg && (
            <div style={{ fontSize: 9, color: "var(--t3)", marginTop: 4 }}>
              {modelCfg.aspectRatios?.length ?? 0} formatos · máx {modelCfg.maxResolution}
            </div>
          )}
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
        <Section title="Plantillas de prompt (Character Design Sheet / Storyboard)">
          <div style={{ display: "flex", gap: 4, flexWrap: "wrap", marginBottom: 4 }}>
            {[
              {
                label: "👤 Character Turnaround",
                prompt: "Goal: Create a polished character design sheet. Canvas: Wide horizontal character design board, 16:9, lots of white space and small handwritten annotation labels. Layout: exactly 1 large central hero pose, exactly 3 turnaround views (Front, Back, Profile), exactly 3 action pose studies, exactly 2 black silhouette studies. Constraints: Do not add extra poses, watermarks, or unrelated props. Style: ultra-detailed, cinematic character design, masterpiece, 8k. Character: ",
              },
              {
                label: "📋 Storyboard 6 paneles",
                prompt: "Main layout: Use exactly 6 storyboard panels arranged in a 3-column by 2-row grid. Each panel has a narrow caption strip along its top edge with a panel number from P01 to P06, lens/camera note, and action title. Style: production storyboard, clean line art, cinematic composition, professional presentation. Constraints: Do not add extra panels, no watermarks. Scene: ",
              },
              {
                label: "📋 Storyboard 20 paneles",
                prompt: "Main layout: Use exactly 20 storyboard panels arranged in a 5-column by 4-row grid. Each panel has a narrow caption strip along its top edge with an orange panel number from P01 to P20, lens/camera note, and action title. Style: production animation storyboard, clean line art, masterpiece, ultra detailed, 8k. ASPECT RATIO: 16:9. Constraints: Do not add extra panels. Scene: ",
              },
              {
                label: "🎭 Influencer Sheet",
                prompt: "Goal: Create a photorealistic AI influencer character sheet. Canvas: 16:9 horizontal board. Layout: exactly 1 full-body front pose (hero), exactly 2 expression close-ups (smile, neutral), exactly 2 outfit variants, exactly 1 side profile. Style: hyper-realistic, editorial photography, soft studio lighting, 8k. No watermarks. Character: ",
              },
              {
                label: "⌚ Watch Character Sheet",
                prompt: `Technical luxury watch character design sheet, wide horizontal board 16:9, cream off-white background, fine serif typography labels.
Layout — CENTER: 1 large hero shot of Rolex Datejust 41 two-tone Rolesor, 3/4 view, dramatic studio lighting, champagne diamond dial, 18k yellow gold fluted bezel.
LEFT COLUMN: 3 component close-ups — (1) fluted 18k gold bezel extreme macro, 72 ridges catching studio light; (2) Five-link Jubilee bracelet showing polished gold + brushed steel; (3) Oyster crown with Rolex crown logo in relief.
RIGHT COLUMN: 3 component close-ups — (1) champagne sunray dial macro with 10 diamond indices; (2) Calibre 3235 movement exposed from caseback — rotor, blue Parachrom hairspring, Chronergy escapement; (3) Oystersteel 904L case profile showing polished lugs + brushed flanks.
BOTTOM ROW: 5 views — dial face, case side profile, caseback (Oyster screwback), bezel top-down showing 72 ridges, Jubilee clasp open showing Easylink system.
ANNOTATIONS: fine thin serif labels — "72-ridge 18k fluted bezel", "Chromalight indices", "Calibre 3235 — 28,800 vph — 31 rubies", "Oystersteel 904L", "Jubilee Ref 62613", "2.5x Cyclops sapphire crystal", "Oysterclasp + Easylink".
Style: luxury editorial technical illustration, 8K precision, photorealistic. No watermarks. Watch model: Rolex Datejust 41 Ref 126333`,
              },
              {
                label: "⌚ Watch Storyboard 6P",
                prompt: `Production storyboard for Rolex Datejust 41 explode view video. Exactly 6 panels in 3-column × 2-row grid. Each panel has caption strip with panel number, camera note, timestamp, and action title. Style: luxury cinematic storyboard, clean detailed illustration, black marker on cream paper aesthetic.
P01 [100mm macro / 45° iso / 00:00-02s / HERO ASSEMBLED]: Rolex Datejust 41 fully assembled rotating on matte black pedestal. Champagne diamond dial, gold fluted bezel.
P02 [Extreme macro / 200mm / 02-04s / BEZEL REVEAL]: 18k gold fluted bezel extreme close-up — 72 ridges, alternating light/shadow, each facet visible.
P03 [45° iso / Slow-mo 0.3x / 04-08s / DISASSEMBLY BEGINS]: Fluted bezel lifts, sapphire crystal rises, three gold hands separate radially. Case body remains center anchor.
P04 [90° overhead / 08-13s / FULL EXPLODE]: All components floating in perfect formation — dial, bezel, crystal, hands, bracelet links cascading. Oysterclasp unfolded.
P05 [Tight 3/4 / movement visible / 13-18s / CALIBRE 3235]: Caseback open, movement exposed — blue Parachrom hairspring, tungsten rotor, Chronergy escapement, 31 ruby jewels.
P06 [Hero / 100mm / 18-25s / REASSEMBLY + CTA]: All components magnetically snap back. Watch assembled, 3/4 rotation. Rolex crown logo sharp. Fade to black.
No extra panels, no watermarks.`,
              },
              {
                label: "💥 Explode View (auriculares)",
                prompt: "Cinematic exploded view of wireless earbuds on a clean white studio background. Silicone tips, internal speaker drivers, battery casing, and PCB board float apart vertically and outward, perfectly separated in 3D space. Engineering manual aesthetic, ultra-detailed components, soft rim lighting, 8k. No text, no watermarks. Brand: ",
              },
              {
                label: "💥 Explode View (sneakers)",
                prompt: "Hyper-realistic teardown of a performance running shoe on matte black background. Outsole, foam midsole, carbon fiber plate, insole, and knit upper separate in clean horizontal layers, showing internal construction. Technical engineering style, studio lighting, ultra-detailed, 8k. No text, no watermarks. Model: ",
              },
              {
                label: "💥 Explode View (tech/phone)",
                prompt: "Cinematic exploded view animation still of a flagship smartphone on deep black background. Glass back panel, aluminum chassis, camera module lenses, battery, PCB, and screws drift outward symmetrically with glowing blue technical callout lines. Sci-fi holographic aesthetic, ultra-detailed, 8k. No text, no watermarks. Product: ",
              },
              {
                label: "🔩 Assembled (reverso)",
                prompt: "Product assembly shot. All individual components converge inward and snap together in perfect mechanical order — satisfying assembly sequence final frame. Clean white studio background, soft directional lighting, hyper-realistic, 8k. No text, no watermarks. Product: ",
              },
              {
                label: "⌚ Reloj Lujo Explode",
                prompt: "Cinematic exploded view of a luxury mechanical watch, individual components floating symmetrically in precise 3D space on matte black background. Separated components visible: fluted 18k gold bezel (72 ridges, mirror-polished facets), flat sapphire crystal with cyclops magnifier lens, champagne sunray brushed dial with brilliant-cut diamond hour indices in gold bezels, applied gold crown logo at 12, gold baton hands (Chromalight luminescent fill), Oystersteel 904L case body (41mm, polished lugs), screw-down 18k gold crown with logo engraving, five-link Jubilee bracelet links separating in cascade (polished gold center links + brushed steel outer links), Oysterclasp butterfly clasp open, mechanical movement exposed showing oscillating rotor, blue Parachrom hairspring coils, Chronergy escapement wheel, 31 ruby jewels. Soft diffused studio boxes, warm specular on 18k gold, prismatic light from diamond indices. Ultra-sharp 8K macro photography. Brand: ",
              },
              {
                label: "⌚ Mecanismo Calibre",
                prompt: "Ultra-close-up technical exploded view of a Swiss mechanical watch movement floating on dark background. Components separated in precise formation: main plate with perlage decoration, barrel bridge with Côtes de Genève stripes, mainspring barrel (open showing coiled spring), center wheel, third wheel, Chronergy escape wheel (nickel-phosphorus), pallet fork lever with two ruby pallet stones, GLUCYDUR beryllium-bronze balance wheel, blue Parachrom hairspring (8 spiral coils), Paraflex shock absorbers, tungsten perpetual rotor (semi-circular oscillating weight), 31 ruby jewels highlighted in gold settings, white date disc with star wheel jumper. All 201 components organized in technical isometric layout. Studio lighting, ultra-sharp 8K macro. Movement caliber: ",
              },
            ].map(t => (
              <button
                key={t.label}
                onClick={() => setPrompt(t.prompt)}
                style={{ ...pillButton(false), fontSize: 10 }}>
                {t.label}
              </button>
            ))}
          </div>
          <p style={{ fontSize: 9, color: "var(--t3)", margin: "2px 0 0" }}>Character sheets / storyboard → completa al final la descripción. Explode View → completa con el nombre del producto.</p>
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
  const [mode, setMode] = useState<"remove" | "replace" | "variations" | "faceswap" | "inpaint" | "outpaint" | "clarity">("remove");
  const [prompt, setPrompt] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [maskFile, setMaskFile] = useState<File | null>(null);
  const [faceFile, setFaceFile] = useState<File | null>(null);
  const [targetFile, setTargetFile] = useState<File | null>(null);
  const [count, setCount] = useState(1);
  const [direction, setDirection] = useState<"all" | "left" | "right" | "top" | "bottom">("all");
  const [paddingPct, setPaddingPct] = useState(20);
  const [busy, setBusy] = useState(false);

  const run = async () => {
    if (mode === "faceswap") {
      if (!faceFile || !targetFile) { onError("Imagen de cara y destino requeridas"); return; }
    } else if (mode === "inpaint") {
      if (!file || !maskFile) { onError("Imagen y máscara requeridas"); return; }
      if (!prompt.trim()) { onError("Prompt requerido para inpaint"); return; }
    } else {
      if (!file) { onError("Imagen requerida"); return; }
      if (mode !== "remove" && !prompt.trim()) { onError("Prompt requerido"); return; }
    }

    setBusy(true);
    try {
      const fd = new FormData();
      fd.append("projectId", String(projectId));
      
      let endpoint = mode as string;
      if (mode === "remove") endpoint = "image/remove-bg";
      else if (mode === "replace") endpoint = "image/replace-bg";
      else if (mode === "variations") endpoint = "image/variations";
      else if (mode === "faceswap") endpoint = "image/face-swap";
      else if (mode === "inpaint") endpoint = "image/inpaint";
      else if (mode === "outpaint") endpoint = "image/outpaint";
      else if (mode === "clarity") endpoint = "image/clarity-upscale";

      if (mode === "faceswap") {
        fd.append("face", faceFile!);
        fd.append("target", targetFile!);
      } else if (mode === "inpaint") {
        fd.append("image", file!);
        fd.append("mask", maskFile!);
        fd.append("prompt", prompt);
      } else {
        fd.append("image", file!);
        if (prompt) fd.append("prompt", prompt);
        if (mode === "variations") fd.append("count", String(count));
        if (mode === "outpaint") {
          fd.append("direction", direction);
          fd.append("paddingPct", String(paddingPct));
        }
      }

      const res = await fetch(`${API_BASE}/api/fs-pro/${endpoint}`, {
        method: "POST", credentials: "include", body: fd,
      });
      const d = await res.json();
      if (!res.ok) { onError(d.error || `Error ${res.status}`); return; }

      if (mode === "variations" && d.results) {
        d.results.forEach((r: any, idx: number) => {
          onSuccess({ vaultId: r.vaultId, type: "image", label: `Var ${idx+1}: ${prompt.slice(0, 20)}`, dataUrl: r.dataUrl, mimeType: "image/png" });
        });
      } else {
        onSuccess({ vaultId: d.vaultId, type: "image", label: `${mode}: ${prompt.slice(0, 30)}`, dataUrl: d.dataUrl, mimeType: "image/png" });
      }
    } catch (e: any) { onError(e?.message || "Error"); } finally { setBusy(false); }
  };

  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
      <div>
        <Section title="Modo Avanzado de Imagen">
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            <button onClick={() => setMode("remove")} style={pillButton(mode === "remove")}>Quitar fondo</button>
            <button onClick={() => setMode("replace")} style={pillButton(mode === "replace")}>Cambiar fondo</button>
            <button onClick={() => setMode("variations")} style={pillButton(mode === "variations")}>Variaciones</button>
            <button onClick={() => setMode("faceswap")} style={pillButton(mode === "faceswap")}>Face Swap</button>
            <button onClick={() => setMode("inpaint")} style={pillButton(mode === "inpaint")}>Inpainting</button>
            <button onClick={() => setMode("outpaint")} style={pillButton(mode === "outpaint")}>Outpainting</button>
            <button onClick={() => setMode("clarity")} style={pillButton(mode === "clarity")}>Upscale Calidad</button>
          </div>
        </Section>

        {mode === "faceswap" ? (
          <>
            <Section title="Imagen de cara (Source)">
              <input type="file" accept="image/*" onChange={e => setFaceFile(e.target.files?.[0] || null)} />
            </Section>
            <Section title="Imagen destino (Target)">
              <input type="file" accept="image/*" onChange={e => setTargetFile(e.target.files?.[0] || null)} />
            </Section>
          </>
        ) : (
          <>
            <Section title="Imagen origen">
              <input type="file" accept="image/*" onChange={e => setFile(e.target.files?.[0] || null)} />
            </Section>
            {mode === "inpaint" && (
              <Section title="Máscara (B&W: blanco=zona a rellenar)">
                <input type="file" accept="image/*" onChange={e => setMaskFile(e.target.files?.[0] || null)} />
              </Section>
            )}
            {mode !== "remove" && mode !== "clarity" && (
              <Section title="Instrucción (Prompt)">
                <textarea value={prompt} onChange={e => setPrompt(e.target.value)} placeholder="Describe el cambio o escena..." style={{ ...inputStyle, minHeight: 80 }} />
              </Section>
            )}
            {mode === "variations" && (
              <Section title={`Cantidad: ${count}`}>
                <input type="range" min={1} max={4} value={count} onChange={e => setCount(+e.target.value)} style={{ width: "100%" }} />
              </Section>
            )}
            {mode === "outpaint" && (
              <>
                <Section title="Dirección">
                  <select value={direction} onChange={e => setDirection(e.target.value as any)} style={inputStyle}>
                    <option value="all">Todas direcciones</option>
                    <option value="left">Izquierda</option>
                    <option value="right">Derecha</option>
                    <option value="top">Arriba</option>
                    <option value="bottom">Abajo</option>
                  </select>
                </Section>
                <Section title={`Padding: ${paddingPct}%`}>
                  <input type="range" min={10} max={100} step={5} value={paddingPct} onChange={e => setPaddingPct(+e.target.value)} style={{ width: "100%" }} />
                </Section>
              </>
            )}
          </>
        )}
      </div>
      <div>
        <button onClick={run} disabled={busy || (mode !== "faceswap" && !file) || (mode === "faceswap" && (!faceFile || !targetFile))} className="btn btn-gold" style={{ width: "100%", justifyContent: "center", padding: "12px 20px" }}>
          {busy ? <Loader2 size={16} className="animate-spin" /> : <Layers size={16} />}
          {busy ? "Procesando..." : "Ejecutar Operación"}
        </button>
        <LiveOperation
          active={busy}
          title={`Procesando ${mode} con IA`}
          estimatedSec={30}
          messages={[
            "Subiendo activos al motor de IA…",
            "Calculando transformación espacial y semántica…",
            "Refinando detalles y coherencia visual…",
            "Exportando resultado al Vault…",
          ]}
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
const I2V_ONLY_MODELS = new Set(["runway-gen4-turbo", "runway-gen4.5", "runway-gen3-alpha", "wan-2.5", "wan-2.5-fast"]);

type VideoMode = "t2v" | "i2v" | "storyboard-video" | "v2v" | "extend" | "edit-video";

const RENOISE_NEG_PRESETS: { label: string; key: string; value: string }[] = [
  {
    key: "anatomy",
    label: "🧍 Realismo / Anatomía",
    value: "Cartoon, anime, CGI-looking textures, fake skin, extra limbs, distorted faces, exaggerated fantasy armor, unrealistic physics, low quality, blurry faces, overexposed lighting, comedic tone, childish style, bad anatomy, unrealistic body proportions, supernatural effects, glowing eyes, energy auras, magic.",
  },
  {
    key: "action",
    label: "⚡ Alta Acción / Danza",
    value: "horror, dark tone, realistic style, grotesque face, body deformation, extra limbs, broken hands, scary expressions, dull colors, muddy palette, slow motion, empty background, overly realistic physics, unreadable face, low energy, depressing mood.",
  },
  {
    key: "cinema",
    label: "🎬 Drama Cinemático",
    value: "no dialogue, no subtitles, no text, no watermark, no logo, no extra characters, no inconsistent face, no changing outfit, no distorted hands, no overexposed glow, no fast chaotic cuts, no modern sci-fi armor, no comedic style.",
  },
];

const STORYBOARD_VIDEO_WRAPPER = `Use the storyboard sheet as the exact sequential visual keyframe reference for the video. Treat every panel as an independent cinematic shot, not as a single image. Follow the storyboard shot by shot. No text, no label, no watermark, no logo. `;

// ─── WATCH EXPLODE SEQUENCE ─────────────────────────────────────────────────
// Duraciones verificadas: Grok=15s+extend, Runway Gen-4.5=15s+I2V, Seedance=10s(4slots), Flow=10s, Kling=8s, Hailuo=5s
const WATCH_EXPLODE_CLIPS: {
  id: string;
  clip: string;
  engine: string;
  engineKey: string;
  maxDuration: number;
  chainMethod: string;
  chainMethodNote: string;
  prompt: string;
  tip: string;
}[] = [
  {
    id: "clip1",
    clip: "CLIP 1 / 3",
    engine: "Seedance 2.0",
    engineKey: "seedance-1-pro",
    maxDuration: 10,
    chainMethod: "T2V (texto → vídeo)",
    chainMethodNote: "No necesita imagen origen. Guarda el ÚLTIMO FRAME para el Clip 2.",
    tip: "⏱ 10s · 4 timestamps · Modo T2V → guarda último frame para Clip 2",
    prompt: `CAMERA: Static locked-off 45° isometric, 100mm macro equivalent. Zero camera movement. STYLE: Luxury watch product film, photorealistic, ARRI Alexa Mini LF, matte black background, soft diffused studio boxes, warm specular on 18k yellow gold.
[0-1.5s] Rolex Datejust 41 two-tone Rolesor fully assembled, rotating slowly 360° on matte black pedestal. Champagne sunray diamond dial, 18k yellow gold fluted bezel (72 ridges) catching studio specular highlights. Jubilee bracelet two-tone links glinting.
[1.5-3.5s] Watch stops rotating, faces dial directly to lens. EXTREME CLOSE-UP. 72 fluted gold ridges create alternating specular highlights and deep shadows. 10 brilliant-cut diamond hour indices catch prismatic light. Applied Rolex crown logo at 12 o'clock razor sharp.
[3.5-6s] DISASSEMBLY BEGINS — SLOW MOTION 0.3x. The 18k yellow gold fluted bezel lifts vertically away from case. Flat sapphire crystal rises above dial. Three gold hands (hour baton / minute baton / slim seconds) separate radially outward simultaneously, each rotating to reveal Chromalight blue luminescent fill.
[6-8s] Champagne sunray dial detaches and floats upward, revealing empty case interior. Oystersteel 904L case body (41mm, polished lugs) remains as anchor center. 18k gold Oyster screw-down crown slides out to the right. Case back unseals and descends below. All components simultaneously rotating to show all surfaces.`,
  },
  {
    id: "clip2",
    clip: "CLIP 2 / 3",
    engine: "Grok Aurora 1.5",
    engineKey: "grok-imagine-video-1.5",
    maxDuration: 15,
    chainMethod: "I2V (imagen → vídeo)",
    chainMethodNote: "Usa el ÚLTIMO FRAME del Clip 1 como imagen origen (@Image1). Modo I2V.",
    tip: "⏱ 15s · I2V desde último frame Clip 1 · Puede extenderse +2-10s adicionales",
    prompt: `@Image1 Continuing from previous frame — all exterior watch components now in full 3D exploded formation floating in matte black space. SLOW MOTION. Studio boxes warm specular on gold.
[0-4s] Five-link Jubilee bracelet (Ref 62613) links cascade apart sequentially from Oysterclasp clasp toward case — each link group separates revealing 3 polished 18k gold center links + 2 brushed Oystersteel outer links. Butterfly Oysterclasp unfolds showing Easylink 5mm extension mechanism in detail. Each bracelet link rotates 360° showing both polished gold and brushed steel surfaces.
[4s transition] Smash cut to overhead 90° top view.
[4-9s] ALL EXTERIOR COMPONENTS in perfect exploded formation from above: fluted bezel, sapphire crystal, champagne diamond dial (sunray lines visible from above), 3 gold hands, Oystersteel case body, gold crown, caseback, all 22 Jubilee bracelet link groups arranged in arc. Every component slowly rotating. Prismatic diamond light refractions visible. Camera orbits slowly 45° around the formation.
[9-15s] Camera tilts to 3/4 view revealing inside of case — CALIBRE 3235 MOVEMENT exposed from below through open caseback. Tungsten perpetual rotor (semi-circular oscillating weight) sweeps slowly. Blue Parachrom hairspring (8 coils, oxidized niobium-zirconium) oscillates at 4Hz. Chronergy escape wheel (nickel-phosphorus) advances rhythmically. 31 ruby jewels glow in their gold settings. Perlage decoration on main plate visible. Côtes de Genève stripes on barrel bridge. EXTREME MACRO detail.`,
  },
  {
    id: "clip3",
    clip: "CLIP 3 / 3",
    engine: "Runway Gen-4.5",
    engineKey: "runway-gen4.5",
    maxDuration: 15,
    chainMethod: "I2V (imagen → vídeo)",
    chainMethodNote: "Usa el ÚLTIMO FRAME del Clip 2 como imagen origen. Modo I2V. Runway Gen-4.5 (15s máx).",
    tip: "⏱ 15s · I2V desde último frame Clip 2 · 4K nativo · Audio nativo activado",
    prompt: `Continuing from previous frame — Calibre 3235 movement fully exposed in exploded view.
[0-5s] EXTREME MACRO orbit around floating Calibre 3235 components: GLUCYDUR beryllium-bronze balance wheel oscillating, blue Parachrom hairspring (8 spiral coils) flexing rhythmically, Chronergy escape wheel advancing tooth by tooth, pallet fork lever clicking with two ruby stones, mainspring barrel (open showing coiled NIVAFLEX spring), barrel bridge (Côtes de Genève stripes), main plate (perlage decoration), 31 ruby jewels highlighted in gold polished settings. All 201 components in technical floating formation. Slow camera dolly through the movement components.
[5-8s] 18k gold Oyster crown with Rolex five-point crown logo engraving orbits into foreground extreme macro. Logo crisp and sharp. Then caseback with Oyster engraving rises into frame. SFX: single precise watch tick at 7s.
[8-13s] REVERSE ASSEMBLY — magnetic attraction. All components begin converging inward simultaneously: caseback seals first (rising from below), movement drops into case, Jubilee bracelet links reconnect sequentially (cascade in reverse, link by link snapping together with satisfying click sounds), champagne dial descends onto case, hands return to 10:10:31 position, sapphire crystal seals, fluted 18k bezel locks onto case with audible snap. SLOW MOTION → REAL SPEED transition at 11s.
[13-15s] Fully assembled Rolex Datejust 41 in hero 3/4 position, slow 30° rotation. Rolex crown logo at 12 o'clock razor sharp in foreground. Diamond indices catching light. FADE TO MATTE BLACK. Text on screen: elegant thin white serif — "DATEJUST 41 · CALIBRE 3235".`,
  },
];

// ─── Generic Explode View Sequence Generator (SSE, 35 s, Grok Aurora) ────────
function ExplodeViewSequenceGenerator({ projectId }: { projectId: number }) {
  const [open, setOpen] = React.useState(false);
  const [objectName, setObjectName] = React.useState("Rolex Datejust 41");
  const [objectDescription, setObjectDescription] = React.useState("Swiss luxury automatic watch. Oystersteel 904L case 41mm, sapphire crystal, Calibre 3235 movement with 201 parts and 31 jewels, 70h power reserve, 18k gold fluted bezel with 72 grooves, Jubilee bracelet Ref 62613.");
  const [materials, setMaterials] = React.useState("Oystersteel 904L, 18k yellow gold, sapphire crystal, rhodium-plated gold");
  const [components, setComponents] = React.useState("Oystersteel case, sapphire crystal, dial with date window, Calibre 3235 movement, rotor, mainspring, 31 jewels, 18k fluted bezel, Jubilee bracelet, Oysterlock clasp");
  const [style, setStyle] = React.useState("ultra-luxury cinematic, black studio background, dramatic volumetric lighting, macro lens, 4K");
  const [aspect, setAspect] = React.useState("9:16");
  const [running, setRunning] = React.useState(false);
  const [steps, setSteps] = React.useState<Array<{ step: string; message: string; pct: number }>>([]);
  const [prompts, setPrompts] = React.useState<{ clip1: string; clip2: string; clip3: string } | null>(null);
  const [vaultId, setVaultId] = React.useState<number | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const esRef = React.useRef<EventSource | null>(null);

  const currentPct = steps.length ? steps[steps.length - 1].pct : 0;

  const start = () => {
    if (running) return;
    setRunning(true);
    setSteps([]);
    setPrompts(null);
    setVaultId(null);
    setError(null);

    fetch(`${API_BASE}/api/fs-pro/explode-view-sequence`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ projectId, objectName, objectDescription, materials, components, style, aspect }),
    }).then(async (res) => {
      if (!res.body) { setError("Sin respuesta del servidor"); setRunning(false); return; }
      const reader = res.body.getReader();
      const dec = new TextDecoder();
      let buf = "";
      const parse = (chunk: string) => {
        buf += chunk;
        const parts = buf.split("\n\n");
        buf = parts.pop() ?? "";
        for (const part of parts) {
          const lines = part.split("\n");
          let event = "message";
          let data = "";
          for (const line of lines) {
            if (line.startsWith("event: ")) event = line.slice(7).trim();
            else if (line.startsWith("data: ")) data = line.slice(6);
          }
          if (!data) continue;
          try {
            const payload = JSON.parse(data);
            if (event === "progress") setSteps(s => [...s, payload]);
            else if (event === "prompts") setPrompts(payload);
            else if (event === "done") { setVaultId(payload.vaultId); setRunning(false); }
            else if (event === "error") { setError(payload.message); setRunning(false); }
          } catch { /* ignore parse errors */ }
        }
      };
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        parse(dec.decode(value, { stream: true }));
      }
      setRunning(false);
    }).catch(e => { setError(e?.message || "Error de red"); setRunning(false); });
  };

  const stop = () => {
    esRef.current?.close();
    setRunning(false);
  };

  const stepIcons: Record<string, string> = {
    prompts: "✍️", clip1: "🎬", clip1_done: "✅", frame1: "🖼️",
    clip2: "🎬", clip2_done: "✅", frame2: "🖼️",
    clip3: "🎬", clip3_done: "✅", concat: "🔗", save: "💾",
  };

  const inputStyle2: React.CSSProperties = {
    width: "100%", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.12)",
    borderRadius: 6, padding: "7px 10px", fontSize: 11, color: "var(--ink)", outline: "none",
    boxSizing: "border-box",
  };
  const labelStyle: React.CSSProperties = { fontSize: 10, color: "var(--t3)", marginBottom: 3, display: "block", fontWeight: 600 };

  return (
    <div style={{ marginBottom: 14 }}>
      <button
        onClick={() => setOpen(v => !v)}
        style={{
          width: "100%",
          background: running
            ? "linear-gradient(135deg, rgba(59,130,246,0.2), rgba(99,102,241,0.12))"
            : "linear-gradient(135deg, rgba(59,130,246,0.12), rgba(99,102,241,0.08))",
          border: `1px solid ${running ? "rgba(99,102,241,0.6)" : "rgba(99,102,241,0.35)"}`,
          borderRadius: 8, padding: "10px 14px", cursor: "pointer",
          display: "flex", alignItems: "center", justifyContent: "space-between",
          color: "#818cf8",
        }}>
        <span style={{ fontSize: 11, fontWeight: 700 }}>
          {running ? "⏳" : "🚀"} Explode View Generator — 35 s con Grok Aurora
          {running && ` (${currentPct}%)`}
        </span>
        <span style={{ fontSize: 10 }}>{open ? "▲ Cerrar" : "▼ Configurar"}</span>
      </button>

      {open && (
        <div style={{ marginTop: 8, display: "flex", flexDirection: "column", gap: 8, padding: "12px 10px", background: "rgba(10,10,20,0.6)", border: "1px solid rgba(99,102,241,0.2)", borderRadius: 8 }}>

          <div style={{ fontSize: 10, color: "#818cf8", padding: "6px 10px", background: "rgba(99,102,241,0.08)", borderRadius: 6, lineHeight: 1.6, border: "1px solid rgba(99,102,241,0.15)" }}>
            <strong>Pipeline 100% Grok Aurora:</strong> Claude genera prompts adaptativos → <strong>Clip 1</strong> Grok T2V 15s → último frame → <strong>Clip 2</strong> Grok I2V 10s → último frame → <strong>Clip 3</strong> Grok I2V 10s → ffmpeg concat = <strong>35s</strong>. Tiempo estimado: 12-18 min.
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
            <div>
              <label style={labelStyle}>Nombre del objeto *</label>
              <input value={objectName} onChange={e => setObjectName(e.target.value)} placeholder="Rolex Datejust 41" style={inputStyle2} disabled={running} />
            </div>
            <div>
              <label style={labelStyle}>Estilo visual</label>
              <select value={style} onChange={e => setStyle(e.target.value)} style={{ ...inputStyle2, height: 32 }} disabled={running}>
                <option value="ultra-luxury cinematic, black studio background, dramatic volumetric lighting, macro lens, 4K">Ultra Luxury</option>
                <option value="minimalist tech, white studio, clean lines, product photography, soft shadows">Tech Minimal</option>
                <option value="dark moody, cinematic, teal and orange color grade, dramatic shadows">Dark Cinematic</option>
                <option value="futuristic, neon accents, holographic overlay, sci-fi aesthetic">Futuristic</option>
                <option value="editorial luxury, warm gold tones, premium lifestyle">Editorial Gold</option>
                <option value="industrial engineering, blueprint aesthetic, technical precision">Industrial Tech</option>
              </select>
            </div>
          </div>

          <div>
            <label style={labelStyle}>Descripción detallada del objeto *</label>
            <textarea
              value={objectDescription}
              onChange={e => setObjectDescription(e.target.value)}
              placeholder="Swiss luxury automatic watch, 41mm case..."
              rows={3}
              style={{ ...inputStyle2, resize: "vertical", lineHeight: 1.5 }}
              disabled={running}
            />
          </div>

          <div>
            <label style={labelStyle}>Materiales (separados por coma)</label>
            <input value={materials} onChange={e => setMaterials(e.target.value)} placeholder="Oystersteel 904L, 18k yellow gold, sapphire crystal" style={inputStyle2} disabled={running} />
          </div>

          <div>
            <label style={labelStyle}>Componentes clave (separados por coma)</label>
            <textarea
              value={components}
              onChange={e => setComponents(e.target.value)}
              placeholder="Case, crystal, dial, movement, bezel, bracelet, clasp..."
              rows={2}
              style={{ ...inputStyle2, resize: "vertical", lineHeight: 1.5 }}
              disabled={running}
            />
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
            <div>
              <label style={labelStyle}>Aspect Ratio</label>
              <select value={aspect} onChange={e => setAspect(e.target.value)} style={{ ...inputStyle2, height: 32 }} disabled={running}>
                <option value="9:16">9:16 (Vertical — Reels/TikTok)</option>
                <option value="16:9">16:9 (Horizontal — YouTube)</option>
                <option value="1:1">1:1 (Cuadrado)</option>
              </select>
            </div>
            <div style={{ display: "flex", alignItems: "flex-end" }}>
              <button
                onClick={running ? stop : start}
                disabled={!objectName.trim() || !objectDescription.trim()}
                style={{
                  width: "100%", padding: "8px 14px", borderRadius: 7, fontSize: 11, fontWeight: 800,
                  cursor: (!objectName.trim() || !objectDescription.trim()) ? "not-allowed" : "pointer",
                  background: running
                    ? "linear-gradient(135deg, #ef4444, #dc2626)"
                    : "linear-gradient(135deg, #4f46e5, #6366f1)",
                  border: "none", color: "#fff",
                  opacity: (!objectName.trim() || !objectDescription.trim()) ? 0.5 : 1,
                }}>
                {running ? "⏹ Detener" : "🚀 Generar 35s con Grok"}
              </button>
            </div>
          </div>

          {/* Progress tracker */}
          {(running || steps.length > 0) && (
            <div style={{ marginTop: 4 }}>
              <div style={{ height: 4, background: "rgba(255,255,255,0.08)", borderRadius: 2, overflow: "hidden", marginBottom: 8 }}>
                <div style={{
                  height: "100%", borderRadius: 2,
                  background: "linear-gradient(90deg, #4f46e5, #818cf8)",
                  width: `${currentPct}%`,
                  transition: "width 0.5s ease",
                }} />
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 3, maxHeight: 160, overflowY: "auto" }}>
                {steps.map((s, i) => (
                  <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: 6, fontSize: 10, color: i === steps.length - 1 ? "#e2e8f0" : "var(--t3)" }}>
                    <span>{stepIcons[s.step] || "•"}</span>
                    <span style={{ flex: 1 }}>{s.message}</span>
                    <span style={{ color: "#4f46e5", fontWeight: 700 }}>{s.pct}%</span>
                  </div>
                ))}
                {running && <div style={{ fontSize: 10, color: "#818cf8", animation: "pulse 1.5s infinite" }}>⏳ Procesando…</div>}
              </div>
            </div>
          )}

          {/* Generated prompts preview */}
          {prompts && (
            <div style={{ background: "rgba(0,0,0,0.4)", borderRadius: 6, padding: "8px 10px", border: "1px solid rgba(99,102,241,0.15)" }}>
              <div style={{ fontSize: 9, fontWeight: 700, color: "#818cf8", marginBottom: 6 }}>📝 Prompts generados por IA</div>
              {(["clip1", "clip2", "clip3"] as const).map((k, i) => (
                <div key={k} style={{ marginBottom: 6 }}>
                  <div style={{ fontSize: 9, color: "#4ade80", fontWeight: 600, marginBottom: 2 }}>
                    {i === 0 ? "Clip 1 — Ensamblado + Inicio despiece (15s)" : i === 1 ? "Clip 2 — Despiece completo + flotando (10s)" : "Clip 3 — Detalle + Reensamblaje + Cierre (10s)"}
                  </div>
                  <div style={{ fontSize: 9, color: "var(--t3)", fontFamily: "monospace", lineHeight: 1.5, background: "rgba(255,255,255,0.03)", borderRadius: 4, padding: "4px 8px", maxHeight: 60, overflowY: "auto" }}>
                    {prompts[k]}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Error */}
          {error && (
            <div style={{ padding: "8px 10px", background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.3)", borderRadius: 6, fontSize: 10, color: "#fca5a5" }}>
              ❌ {error}
            </div>
          )}

          {/* Result */}
          {vaultId && !running && (
            <div style={{ padding: "10px 12px", background: "rgba(74,222,128,0.08)", border: "1px solid rgba(74,222,128,0.3)", borderRadius: 8 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: "#4ade80", marginBottom: 8 }}>🎬 ¡Vídeo de 35s generado con Grok Aurora!</div>
              <video
                src={`${API_BASE}/api/vault/${vaultId}/file`}
                controls
                style={{ width: "100%", borderRadius: 6, maxHeight: 300, background: "#000" }}
              />
              <a
                href={`${API_BASE}/api/vault/${vaultId}/file`}
                download={`explode-view-${objectName.replace(/\s+/g, "-")}.mp4`}
                style={{
                  display: "block", marginTop: 8, padding: "8px 12px", textAlign: "center",
                  background: "rgba(74,222,128,0.15)", border: "1px solid rgba(74,222,128,0.4)",
                  borderRadius: 6, fontSize: 11, color: "#4ade80", fontWeight: 700, textDecoration: "none",
                }}>
                ⬇️ Descargar MP4 (35 s)
              </a>
            </div>
          )}

        </div>
      )}
    </div>
  );
}

function WatchExplodeSequenceBuilder({ setPrompt, setMode }: { setPrompt: (p: string) => void; setMode: (m: VideoMode) => void }) {
  const [open, setOpen] = React.useState(false);
  const [copied, setCopied] = React.useState<string | null>(null);

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(id);
      setTimeout(() => setCopied(null), 2000);
    });
  };

  return (
    <div style={{ marginBottom: 12 }}>
      <button
        onClick={() => setOpen(v => !v)}
        style={{ width: "100%", background: "linear-gradient(135deg, rgba(180,140,60,0.15), rgba(251,191,36,0.08))", border: "1px solid rgba(251,191,36,0.35)", borderRadius: 8, padding: "10px 14px", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "space-between", color: "var(--gold)" }}>
        <span style={{ fontSize: 11, fontWeight: 700 }}>⌚ Rolex Explode View — Secuencia 3 Clips (40s total)</span>
        <span style={{ fontSize: 10 }}>{open ? "▲ Cerrar" : "▼ Ver secuencia"}</span>
      </button>
      {open && (
        <div style={{ marginTop: 8, display: "flex", flexDirection: "column", gap: 10 }}>
          <div style={{ padding: "8px 10px", background: "rgba(251,191,36,0.06)", border: "1px solid rgba(251,191,36,0.2)", borderRadius: 6, fontSize: 9, color: "var(--t3)", lineHeight: 1.6 }}>
            <strong style={{ color: "var(--gold)" }}>📐 Duraciones verificadas:</strong> Grok Aurora=15s+extend · Runway Gen-4.5=15s+I2V · Seedance=10s(4slots) · Google Flow=10s · Kling=8s · Hailuo=5s<br />
            <strong style={{ color: "var(--gold)" }}>🔗 Encadenamiento:</strong> Genera Clip 1 → descarga último frame → súbelo como imagen origen en Clip 2 (modo I2V) → repite para Clip 3. Cada clip comienza exactamente donde terminó el anterior.
          </div>
          {WATCH_EXPLODE_CLIPS.map((clip) => (
            <div key={clip.id} style={{ border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8, overflow: "hidden" }}>
              <div style={{ background: "rgba(30,30,30,0.8)", padding: "8px 12px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <div>
                  <span style={{ fontSize: 10, fontWeight: 800, color: "var(--gold)" }}>{clip.clip}</span>
                  <span style={{ fontSize: 9, color: "var(--t3)", marginLeft: 8 }}>Motor: <strong style={{ color: "#e0d4b4" }}>{clip.engine}</strong></span>
                  <span style={{ fontSize: 9, color: "#4ade80", marginLeft: 8 }}>⏱ {clip.maxDuration}s máx</span>
                </div>
                <span style={{ fontSize: 9, color: "#94a3b8", background: "rgba(255,255,255,0.07)", padding: "2px 7px", borderRadius: 4 }}>{clip.chainMethod}</span>
              </div>
              <div style={{ padding: "8px 12px", background: "rgba(15,15,15,0.5)" }}>
                <div style={{ fontSize: 9, color: "#60a5fa", marginBottom: 6, lineHeight: 1.5, padding: "4px 8px", background: "rgba(96,165,250,0.08)", borderRadius: 4, border: "1px solid rgba(96,165,250,0.15)" }}>
                  🔗 <strong>Encadenamiento:</strong> {clip.chainMethodNote}
                </div>
                <div style={{ fontSize: 9, color: "var(--t3)", fontFamily: "monospace", background: "rgba(0,0,0,0.4)", borderRadius: 6, padding: "8px 10px", maxHeight: 120, overflowY: "auto", lineHeight: 1.5, whiteSpace: "pre-wrap", wordBreak: "break-word" }}>
                  {clip.prompt.slice(0, 400)}{clip.prompt.length > 400 ? "…" : ""}
                </div>
                <div style={{ display: "flex", gap: 6, marginTop: 8 }}>
                  <button
                    onClick={() => { setPrompt(clip.prompt); setMode(clip.id === "clip1" ? "t2v" : "i2v"); }}
                    style={{ flex: 1, fontSize: 9, padding: "6px 8px", background: "rgba(251,191,36,0.15)", border: "1px solid rgba(251,191,36,0.4)", borderRadius: 5, cursor: "pointer", color: "var(--gold)", fontWeight: 700 }}>
                    ⚡ Cargar en VideoTab
                  </button>
                  <button
                    onClick={() => copyToClipboard(clip.prompt, clip.id)}
                    style={{ fontSize: 9, padding: "6px 10px", background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 5, cursor: "pointer", color: "var(--t3)" }}>
                    {copied === clip.id ? "✓ Copiado" : "📋 Copiar"}
                  </button>
                </div>
                <p style={{ fontSize: 9, color: "var(--t3)", margin: "6px 0 0", fontStyle: "italic" }}>{clip.tip}</p>
              </div>
            </div>
          ))}
          <div style={{ padding: "8px 10px", background: "rgba(74,222,128,0.06)", border: "1px solid rgba(74,222,128,0.2)", borderRadius: 6, fontSize: 9, color: "#86efac", lineHeight: 1.6 }}>
            <strong>💡 Workflow completo:</strong><br />
            1. Clip 1 → Seedance 2.0 (T2V, 10s) → descarga último frame<br />
            2. Clip 2 → Grok Aurora (I2V, 15s) → sube último frame de Clip 1 como imagen origen<br />
            3. Clip 3 → Runway Gen-4.5 (I2V, 15s) → sube último frame de Clip 2<br />
            4. Exporta los 3 clips (10s+15s+15s=40s) y únelos en DaVinci/Premiere con cortes en el último frame de cada clip
          </div>
        </div>
      )}
    </div>
  );
}

function VideoTab({ caps, health, projectId, onSuccess, onError, onCreditError }: { caps: Capabilities | null; health: HealthMap | null; projectId: number; onSuccess: (it: VaultItem) => void; onError: (m: string) => void; onCreditError?: () => void }) {
  const [mode, setMode] = useState<VideoMode>("i2v");
  const [model, setModel] = useState("seedance-fast");
  const [xaiModel, setXaiModel] = useState<string>("grok-imagine-video");
  const [prompt, setPrompt] = useState("");
  const [negativePrompt, setNegativePrompt] = useState("");
  const [negPreset, setNegPreset] = useState<string>("");
  const [duration, setDuration] = useState(5);
  const [extendDuration, setExtendDuration] = useState(6);
  const [aspect, setAspect] = useState("9:16");
  const [file, setFile] = useState<File | null>(null);
  const [sourceUrl, setSourceUrl] = useState("");
  const [videoUrl, setVideoUrl] = useState("");
  const [cameraPreset, setCameraPreset] = useState<string>("");
  const [busy, setBusy] = useState(false);
  const [showTsBuilder, setShowTsBuilder] = useState(false);
  const [tsSlots, setTsSlots] = useState(["", "", "", ""]);
  const [tsCameraSetup, setTsCameraSetup] = useState("");

  const modelCfg = caps?.videoGeneration.find(m => m.key === model);
  const currentProvider = (mode === "extend" || mode === "edit-video") ? "xai" as ProviderId : modelCfg?.provider;
  const providerStatus = currentProvider ? health?.[currentProvider]?.status : undefined;
  const providerDown = providerStatus === "out_of_credits" || providerStatus === "down" || providerStatus === "missing_key";
  const fallback = useMemo(
    () => providerDown && caps && mode !== "extend" && mode !== "edit-video" ? suggestFallback(caps.videoGeneration, model, health) : null,
    [providerDown, caps, model, health, mode],
  );

  // Si el modelo seleccionado no soporta T2V, fuerza I2V automáticamente.
  useEffect(() => {
    if (mode === "t2v" && I2V_ONLY_MODELS.has(model)) setMode("i2v");
  }, [model, mode]);

  // Al entrar en storyboard-video, pre-inyectar el wrapper crítico de Renoise en el prompt
  useEffect(() => {
    if (mode === "storyboard-video" && !prompt.startsWith(STORYBOARD_VIDEO_WRAPPER)) {
      setPrompt(STORYBOARD_VIDEO_WRAPPER + prompt);
    }
    // Al salir del modo, no borramos el prompt por si el usuario lo editó ya
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode]);

  const run = async () => {
    if (!prompt.trim() && mode !== "extend" && mode !== "edit-video") { onError("Prompt requerido"); return; }
    if (mode === "i2v" && !file && !sourceUrl) { onError("Imagen origen requerida en modo Imagen → Vídeo"); return; }
    if (mode === "storyboard-video" && !file && !sourceUrl) { onError("Imagen del storyboard requerida en modo Storyboard → Vídeo"); return; }
    if (mode === "v2v" && !file) { onError("Video origen requerido para V2V"); return; }
    if ((mode === "extend" || mode === "edit-video") && !videoUrl.trim()) {
      onError("URL del vídeo origen requerida"); return;
    }
    setBusy(true);
    try {
      if (mode === "extend") {
        const res = await fetch(`${API_BASE}/api/fs-pro/video/extend`, {
          method: "POST", credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ projectId, videoUrl, duration: extendDuration, model: model }),
        });
        const d = await res.json();
        if (!res.ok) { onError(d.error || `Error ${res.status}`); return; }
        onSuccess({ vaultId: d.vaultId, type: "video", label: `Ext: ${videoUrl.slice(-10)}`, mimeType: "video/mp4" });
        return;
      }
      if (mode === "edit-video") {
        const res = await fetch(`${API_BASE}/api/fs-pro/video/edit`, {
          method: "POST", credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ projectId, videoUrl, prompt, model: model }),
        });
        const d = await res.json();
        if (!res.ok) { onError(d.error || `Error ${res.status}`); return; }
        onSuccess({ vaultId: d.vaultId, type: "video", label: `Edit: ${prompt.slice(0, 30)}`, mimeType: "video/mp4" });
        return;
      }
      if (mode === "v2v") {
        const fd = new FormData();
        fd.append("projectId", String(projectId));
        fd.append("video", file!);
        fd.append("prompt", prompt);
        fd.append("model", model);
        const res = await fetch(`${API_BASE}/api/fs-pro/video/v2v`, { method: "POST", credentials: "include", body: fd });
        const d = await res.json();
        if (!res.ok) { onError(d.error || `Error ${res.status}`); return; }
        onSuccess({ vaultId: d.vaultId, type: "video", label: `V2V: ${prompt.slice(0, 30)}`, mimeType: "video/mp4" });
        return;
      }
      const fd = new FormData();
      fd.append("projectId", String(projectId));
      fd.append("model", model); fd.append("prompt", prompt);
      fd.append("duration", String(duration)); fd.append("aspect", aspect);
      if (cameraPreset) fd.append("cameraPreset", cameraPreset);
      if (negativePrompt.trim()) fd.append("negativePrompt", negativePrompt.trim());
      if (mode === "i2v" || mode === "storyboard-video") {
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
  const isXaiMode = mode === "extend" || mode === "edit-video";

  const xaiHealthStatus = health?.["xai"]?.status;
  const xaiDown = xaiHealthStatus === "out_of_credits" || xaiHealthStatus === "down" || xaiHealthStatus === "missing_key";

  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(270px, 1fr))", gap: 16 }}>
      <div>
        <Section title="Modo de generación">
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6, marginBottom: 6 }}>
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
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6, marginBottom: 6 }}>
            <button
              onClick={() => setMode("v2v")}
              style={{ ...cardButton(mode === "v2v"), padding: "10px 8px" }}>
              <div style={{ fontSize: 11, fontWeight: 700 }}>Video → Video</div>
              <div style={{ fontSize: 9, color: "var(--t3)", marginTop: 2 }}>Estilizar video</div>
            </button>
            <button
              onClick={() => setMode("extend")}
              style={{ ...cardButton(mode === "extend"), padding: "10px 8px" }}>
              <div style={{ fontSize: 11, fontWeight: 700 }}>⟳ Extender</div>
              <div style={{ fontSize: 9, color: "var(--t3)", marginTop: 2 }}>Añadir segundos</div>
            </button>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
            <button
              onClick={() => setMode("edit-video")}
              style={{ ...cardButton(mode === "edit-video"), padding: "10px 8px" }}>
              <div style={{ fontSize: 11, fontWeight: 700 }}>✏️ Editar IA</div>
              <div style={{ fontSize: 9, color: "var(--t3)", marginTop: 2 }}>Transformar</div>
            </button>
            <button
              onClick={() => setMode("storyboard-video")}
              style={{ ...cardButton(mode === "storyboard-video"), padding: "10px 8px", border: mode === "storyboard-video" ? "1px solid var(--gold)" : undefined }}>
              <div style={{ fontSize: 11, fontWeight: 700 }}>📋 Storyboard</div>
              <div style={{ fontSize: 9, color: "var(--t3)", marginTop: 2 }}>Panel → Vídeo</div>
            </button>
          </div>
          {mode === "t2v" && (
            <p style={{ fontSize: 10, color: "var(--t3)", margin: "8px 0 0", lineHeight: 1.4 }}>
              Modo Texto → Vídeo: el modelo genera el clip a partir del prompt sin imagen origen. Disponible en Veo, Kling, Seedance y Hailuo.
            </p>
          )}
          {mode === "storyboard-video" && (
            <div style={{ margin: "8px 0 0", padding: "8px 10px", borderRadius: 6, background: "rgba(251,191,36,0.07)", border: "1px solid rgba(251,191,36,0.2)" }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: "var(--gold)", marginBottom: 4 }}>📋 Modo Storyboard → Vídeo</div>
              <p style={{ fontSize: 10, color: "var(--t3)", margin: 0, lineHeight: 1.5 }}>
                Convierte una hoja de storyboard en un clip. El modelo tratará <strong>cada panel como un plano cinemático independiente</strong>, no como imagen unificada — crítico para evitar que el modelo intente animar los bordes negros del grid.<br />
                Sube la imagen del storyboard abajo y añade la descripción de tu escena en el prompt.
              </p>
            </div>
          )}
          {mode === "extend" && (
            <p style={{ fontSize: 10, color: "var(--t3)", margin: "8px 0 0", lineHeight: 1.4 }}>
              xAI Grok Imagine Video extiende el vídeo por la cola. El resultado combina el original + la extensión. Requiere URL pública del vídeo origen (2-15s MP4).
            </p>
          )}
          {mode === "edit-video" && (
            <p style={{ fontSize: 10, color: "var(--t3)", margin: "8px 0 0", lineHeight: 1.4 }}>
              xAI Grok edita el contenido del vídeo siguiendo instrucciones en lenguaje natural. El output mantiene la resolución original (máx 720p). Requiere URL pública del vídeo (máx 8.7s MP4).
            </p>
          )}
        </Section>

        {isXaiMode ? (
          <Section title="Modelo xAI">
            {xaiDown && (
              <div style={{ marginBottom: 8, padding: "8px 12px", borderRadius: 8, background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.35)", color: "#ef4444", fontSize: 11, lineHeight: 1.4 }}>
                ⚠️ <strong>xAI (Grok)</strong> está {statusLabel(xaiHealthStatus!)}. Verifica que XAI_API_KEY está configurada.
              </div>
            )}
            <ProviderBadge provider="xai" health={health} />
            <div style={{ marginTop: 8 }}>
              {[
                { key: "grok-imagine-video", label: "Grok Imagine Video", desc: "Estándar — 720p, hasta 15s, $0.07/s" },
                { key: "grok-imagine-video-1.5-preview", label: "Grok Imagine Video 1.5 Preview", desc: "Mayor calidad — 720p, hasta 15s, $0.14/s" },
              ].map(m => (
                <button key={m.key} onClick={() => setXaiModel(m.key)} style={{ ...cardButton(xaiModel === m.key), display: "block", width: "100%", textAlign: "left", marginBottom: 6 }}>
                  <strong style={{ fontSize: 12 }}>{m.label}</strong>
                  <div style={{ fontSize: 10, color: "var(--t3)", marginTop: 2 }}>{m.desc}</div>
                </button>
              ))}
            </div>
          </Section>
        ) : (
          <Section title="Modelo">
            {providerDown && (
              <div style={{ marginBottom: 8, padding: "8px 12px", borderRadius: 8, background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.35)", color: "#ef4444", fontSize: 11, lineHeight: 1.4 }}>
                ⚠️ <strong>{PROVIDER_LABEL[currentProvider!]}</strong> está {statusLabel(providerStatus!)}.
                {fallback && <> Sugerencia: <button onClick={() => setModel(fallback.key)} style={{ background: "transparent", border: "none", color: "#fbbf24", textDecoration: "underline", cursor: "pointer", padding: 0, fontSize: 11, fontWeight: 700 }}>{fallback.label}</button> ({PROVIDER_LABEL[fallback.provider!]}).</>}
              </div>
            )}
            {caps?.videoGeneration.filter(m => m.provider !== "xai").map(m => (
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
            {caps?.videoGeneration.filter(m => m.provider === "xai").length! > 0 && (
              <div style={{ marginTop: 10, paddingTop: 10, borderTop: "1px solid var(--bdr)" }}>
                <div style={{ fontSize: 10, color: "var(--t3)", marginBottom: 6 }}>xAI Grok (T2V/I2V):</div>
                {caps?.videoGeneration.filter(m => m.provider === "xai").map(m => (
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
              </div>
            )}
          </Section>
        )}
      </div>
      <div>
        <Section title="Prompt">
          <div style={{ position: "relative" }}>
            <textarea value={prompt} onChange={e => setPrompt(e.target.value)}
              placeholder={
                mode === "extend" ? "Continúa con la escena: el producto emerge del agua..." :
                mode === "edit-video" ? "Cambia el fondo a blanco, elimina el logotipo..." :
                "Cinematic dolly-in product reveal, soft golden lighting, slow motion at 30fps..."
              }
              style={{ ...inputStyle, minHeight: 100 }} />
            {prompt.trim().length >= 3 && (
              <VideoPromptEnhanceBtn prompt={prompt} setPrompt={setPrompt} projectId={projectId} />
            )}
          </div>
        </Section>

        {!isXaiMode && (
          <Section title="🎬 Timestamp Narration Builder (Seedance 2.0)">
            <button
              onClick={() => setShowTsBuilder(v => !v)}
              style={{ ...pillButton(showTsBuilder), marginBottom: showTsBuilder ? 10 : 0, width: "100%", justifyContent: "center" }}>
              {showTsBuilder ? "▲ Ocultar Builder" : "▼ Construir prompt por timestamps [0-1.5s] [1.5-3.5s]…"}
            </button>
            {showTsBuilder && (
              <div>
                <div style={{ fontSize: 9, color: "var(--t3)", marginBottom: 8, lineHeight: 1.5, padding: "6px 8px", background: "rgba(251,191,36,0.06)", borderRadius: 6, border: "1px solid rgba(251,191,36,0.15)" }}>
                  <strong style={{ color: "var(--gold)" }}>Sintaxis por modelo</strong> — Seedance 2.0: <code style={{ fontSize: 9 }}>[0-1.5s] acción</code> · Grok Aurora: <code style={{ fontSize: 9 }}>[0-4s] acción · [4s transition] Smash cut</code><br />
                  Refs: <code style={{ fontSize: 9 }}>@Image1</code>–<code style={{ fontSize: 9 }}>@Image9</code> (Seedance/Grok) · SFX: <code style={{ fontSize: 9 }}>SFX: thunder at 2s</code> · Cámara global ↓ (fuera de timestamps) · Grok: no soporta negative prompts, usar lenguaje afirmativo
                </div>
                <div style={{ marginBottom: 8 }}>
                  <label style={{ fontSize: 10, color: "var(--t3)", display: "block", marginBottom: 3 }}>📷 Global Setup (cámara + estilo — se pone ANTES de los timestamps):</label>
                  <div style={{ display: "flex", gap: 4, flexWrap: "wrap", marginBottom: 4 }}>
                    {["CAMERA: Dolly push-in, 50mm prime. STYLE: Cinematic, golden hour.", "CAMERA: 360 orbit, 14mm wide-angle. STYLE: Cyberpunk neon glow.", "CAMERA: Slow dolly out, 35mm anamorphic. STYLE: Film grain, ARRI Alexa Mini LF.", "CAMERA: Low-angle tracking. STYLE: High-key commercial, clean white."].map(p => (
                      <button key={p} onClick={() => setTsCameraSetup(p)} style={{ ...pillButton(tsCameraSetup === p), fontSize: 9, padding: "3px 7px" }}>{p.split(".")[0].replace("CAMERA: ", "")}</button>
                    ))}
                  </div>
                  <input value={tsCameraSetup} onChange={e => setTsCameraSetup(e.target.value)} placeholder="CAMERA: Dolly push-in, 50mm prime. STYLE: Cinematic, golden hour." style={{ ...inputStyle, fontSize: 10 }} />
                </div>
                {[
                  { label: "[0–1.5s]", hint: "Plano de apertura / establecimiento" },
                  { label: "[1.5–3.5s]", hint: "Acción principal / punto de giro" },
                  { label: "[3.5–6s]", hint: "Desarrollo / close-up / detalle" },
                  { label: "[6–8s]", hint: "Cierre / CTA / QUICK CUT" },
                ].map((slot, i) => (
                  <div key={i} style={{ marginBottom: 8 }}>
                    <label style={{ fontSize: 10, fontWeight: 700, color: "var(--gold)", display: "block", marginBottom: 3 }}>
                      {slot.label} <span style={{ fontWeight: 400, color: "var(--t3)" }}>— {slot.hint}</span>
                    </label>
                    <textarea
                      value={tsSlots[i]}
                      onChange={e => { const n = [...tsSlots]; n[i] = e.target.value; setTsSlots(n); }}
                      placeholder={`Describe la acción de este plano… ej: "Character from @Image1 walks through rain. SFX: thunder at ${i === 0 ? "0.5" : i === 1 ? "2" : i === 2 ? "4.5" : "7"}s"`}
                      style={{ ...inputStyle, minHeight: 44, fontSize: 10 }}
                    />
                  </div>
                ))}
                <button
                  onClick={() => {
                    const parts: string[] = [];
                    if (tsCameraSetup.trim()) parts.push(tsCameraSetup.trim());
                    const labels = ["[0-1.5s]", "[1.5-3.5s]", "[3.5-6s]", "[6-8s]"];
                    tsSlots.forEach((s, i) => { if (s.trim()) parts.push(`${labels[i]} ${s.trim()}`); });
                    if (parts.length) setPrompt(parts.join("\n"));
                  }}
                  className="btn btn-gold"
                  style={{ width: "100%", justifyContent: "center", fontSize: 11, padding: "9px 16px", marginTop: 4 }}>
                  ⚡ Ensamblar en Prompt
                </button>
              </div>
            )}
          </Section>
        )}

        <Section title="🚀 Explode View Generator — 35 s con Grok Aurora (automático)">
          <ExplodeViewSequenceGenerator projectId={projectId} />
        </Section>

        {!isXaiMode && (
          <Section title="⌚ Secuencia Explode View — Prompts Manuales Multi-Clip">
            <WatchExplodeSequenceBuilder setPrompt={setPrompt} setMode={setMode} />
          </Section>
        )}

        {isXaiMode ? (
          <>
            <Section title="Vídeo origen (URL pública)">
              <input
                value={videoUrl}
                onChange={e => setVideoUrl(e.target.value)}
                placeholder="https://cdn.example.com/video.mp4"
                style={inputStyle}
              />
              <p style={{ fontSize: 10, color: "var(--t3)", margin: "6px 0 0", lineHeight: 1.4 }}>
                {mode === "extend"
                  ? "MP4 de 2-15s. El resultado será el vídeo original + la extensión concatenados."
                  : "MP4 de máx 8.7s. El output mantiene la resolución del original (capado a 720p)."}
              </p>
            </Section>
            {mode === "extend" && (
              <Section title={`Duración extensión: ${extendDuration}s`}>
                <input
                  type="range" min={2} max={10} value={extendDuration}
                  onChange={e => setExtendDuration(parseInt(e.target.value))}
                  style={{ width: "100%" }}
                />
                <p style={{ fontSize: 10, color: "var(--t3)", margin: "4px 0 0" }}>
                  Duración de la parte añadida (2-10s). El original se mantiene intacto.
                </p>
              </Section>
            )}
          </>
        ) : (
          <>
            <Section title={`Duración / Aspecto · máx ${modelCfg?.maxDuration ?? 15}s`}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                <div>
                  <div style={{ fontSize: 11, color: "var(--t3)", marginBottom: 4 }}>
                    {duration}s <span style={{ color: "var(--gold)", fontSize: 9 }}>(máx {modelCfg?.maxDuration ?? 15}s)</span>
                  </div>
                  <input
                    type="range"
                    min={3}
                    max={modelCfg?.maxDuration ?? 15}
                    value={Math.min(duration, modelCfg?.maxDuration ?? 15)}
                    onChange={e => setDuration(parseInt(e.target.value))}
                    style={{ width: "100%" }}
                  />
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 9, color: "var(--t3)", marginTop: 2 }}>
                    <span>3s</span><span>{modelCfg?.maxDuration ?? 15}s</span>
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: 10, color: "var(--t3)", marginBottom: 4 }}>Aspecto</div>
                  <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                    {(modelCfg?.aspectRatios?.length
                      ? modelCfg.aspectRatios.filter(a => ["9:16","16:9","1:1","4:5","4:3","3:4"].includes(a))
                      : ["9:16", "16:9", "1:1"]
                    ).map(a => (
                      <button key={a} onClick={() => setAspect(a)} style={pillButton(aspect === a)}>{a}</button>
                    ))}
                  </div>
                </div>
              </div>
            </Section>
            {(mode === "i2v" || mode === "storyboard-video") && (
              <Section title={mode === "storyboard-video" ? "Imagen del storyboard (requerida)" : "Imagen origen (requerida)"}>
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
          </>
        )}

        {!isXaiMode && (
          <Section title="Negative Prompt (presets Renoise)">
            <div style={{ display: "flex", gap: 4, flexWrap: "wrap", marginBottom: 6 }}>
              <button
                onClick={() => { setNegPreset(""); setNegativePrompt(""); }}
                style={pillButton(negPreset === "")}>Ninguno</button>
              {RENOISE_NEG_PRESETS.map(p => (
                <button
                  key={p.key}
                  onClick={() => { setNegPreset(p.key); setNegativePrompt(p.value); }}
                  style={pillButton(negPreset === p.key)}>{p.label}</button>
              ))}
            </div>
            <textarea
              value={negativePrompt}
              onChange={e => { setNegativePrompt(e.target.value); setNegPreset("custom"); }}
              placeholder="Opcional — keywords de exclusión para restringir el espacio latente…"
              style={{ ...inputStyle, minHeight: 54, fontSize: 10 }}
            />
            {negPreset && negPreset !== "custom" && (
              <p style={{ fontSize: 9, color: "var(--t3)", margin: "4px 0 0", lineHeight: 1.4 }}>
                {RENOISE_NEG_PRESETS.find(p => p.key === negPreset)?.key === "anatomy" && "Previene texturas CGI, miembros extra y distorsiones faciales en sujetos fotorrealistas."}
                {RENOISE_NEG_PRESETS.find(p => p.key === negPreset)?.key === "action" && "Permite cortes rápidos sin deformidad estructural — ideal para música y danza."}
                {RENOISE_NEG_PRESETS.find(p => p.key === negPreset)?.key === "cinema" && "Estabiliza narrativa seria: bloquea cambios de ropa, cara inconsistente y texto superpuesto."}
              </p>
            )}
          </Section>
        )}

        <button onClick={run} disabled={busy} className="btn btn-gold" style={{ width: "100%", justifyContent: "center", padding: "12px 20px" }}>
          {busy ? <Loader2 size={16} className="animate-spin" /> : <Video size={16} />}
          {busy
            ? (mode === "extend" ? "Extendiendo vídeo..." : mode === "edit-video" ? "Editando vídeo..." : mode === "storyboard-video" ? "Animando storyboard..." : "Generando video...")
            : (mode === "extend" ? "Extender vídeo (xAI, 2-4 min)" : mode === "edit-video" ? "Editar vídeo (xAI, 2-4 min)" : mode === "storyboard-video" ? "Storyboard → Vídeo (1-3 min)" : "Generar video (1-3 min)")}
        </button>
        <LiveOperation
          active={busy}
          title={mode === "extend" ? "Extendiendo vídeo con xAI Grok" : mode === "edit-video" ? "Editando vídeo con xAI Grok" : "Generando video con IA"}
          estimatedSec={mode === "extend" || mode === "edit-video" ? 180 : 150}
          messages={
            mode === "extend" ? [
              "Enviando vídeo origen y prompt a xAI Grok Imagine Video…",
              "Generando la extensión (nuevas escenas por la cola)…",
              "Concatenando original + extensión en un solo MP4…",
              "El servidor sigue trabajando aunque cierres la pestaña.",
              "Subiendo vídeo extendido al Vault…",
            ] : mode === "edit-video" ? [
              "Enviando vídeo y prompt de edición a xAI Grok Imagine Video…",
              "Aplicando cambios: reencuadre, fondo, objetos, estilo…",
              "El output mantiene la resolución del original (máx 720p).",
              "El servidor sigue trabajando aunque cierres la pestaña.",
              "Subiendo vídeo editado al Vault…",
            ] : [
              "Enviando prompt y frame de origen al modelo de video…",
              "Renderizando 24-30 fps por segundo de salida…",
              "El proceso completo tarda 1-3 minutos según duración.",
              "El servidor sigue trabajando aunque cierres la pestaña.",
              "Codificando MP4 final y subiendo al Vault…",
            ]
          }
          className="w-full mt-3"
        />
      </div>
    </div>
  );
}

const SFX_CAT_LABELS: Record<string, string> = { comercio: "🛒 Comercio", ambiente: "🌿 Ambiente", emociones: "🎭 Emociones", productos: "📦 Productos" };

function AudioTab({ caps, projectId, onSuccess, onError, onInfo }: { caps: Capabilities | null; projectId: number; onSuccess: (it: VaultItem) => void; onError: (m: string) => void; onInfo: (m: string) => void }) {
  const [mode, setMode] = useState<"tts" | "clone" | "sfx" | "music" | "mix">("tts");
  const [voices, setVoices] = useState<any[]>([]);
  const [voiceId, setVoiceId] = useState<string>("");
  const [text, setText] = useState("");
  const [modelId, setModelId] = useState("eleven_v3");
  const [stability, setStability] = useState(0.5);
  const [similarity, setSimilarity] = useState(0.75);
  const [style, setStyle] = useState(0.3);
  const [speed, setSpeed] = useState(1.0);
  const [duration, setDuration] = useState(5);
  const [musicDuration, setMusicDuration] = useState(30);
  const [cloneName, setCloneName] = useState("");
  const [cloneFile, setCloneFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [sfxCatalog, setSfxCatalog] = useState<any[] | null>(null);
  const [showSfxPanel, setShowSfxPanel] = useState(false);
  const [sfxCatFilter, setSfxCatFilter] = useState<string>("all");

  // Mix state
  const [ttsFile, setTtsFile] = useState<File | null>(null);
  const [musicFile, setMusicFile] = useState<File | null>(null);
  const [musicVolume, setMusicVolume] = useState(0.15);
  const [duckingEnabled, setDuckingEnabled] = useState(true);

  useEffect(() => {
    fetch(`${API_BASE}/api/ad-studio/voices`, { credentials: "include" })
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d?.voices) { setVoices(d.voices); if (d.voices[0]) setVoiceId(d.voices[0].voice_id); } });
  }, []);

  const runMix = async () => {
    if (!ttsFile || !musicFile) { onError("Sube TTS y Música"); return; }
    setBusy(true);
    try {
      const fd = new FormData();
      fd.append("projectId", String(projectId));
      fd.append("tts", ttsFile);
      fd.append("music", musicFile);
      fd.append("musicVolume", String(musicVolume));
      fd.append("duckingEnabled", String(duckingEnabled));
      const res = await fetch(`${API_BASE}/api/fs-pro/audio/mix`, { method: "POST", credentials: "include", body: fd });
      const d = await res.json();
      if (!res.ok) { onError(d.error || "Error"); return; }
      onSuccess({ vaultId: d.vaultId, type: "audio", label: "Mix final", dataUrl: d.dataUrl, mimeType: "audio/mpeg" });
    } catch (e: any) { onError(e?.message || "Error"); } finally { setBusy(false); }
  };

  const toggleSfxPanel = async () => {
    if (showSfxPanel) { setShowSfxPanel(false); return; }
    if (!sfxCatalog) {
      try {
        const res = await fetch(`${API_BASE}/api/fs-pro/audio/sfx-catalog`);
        const d = await res.json();
        setSfxCatalog(Array.isArray(d) ? d : []);
      } catch { onError("Error cargando catálogo SFX"); return; }
    }
    setShowSfxPanel(true);
  };

  const runTTS = async () => {
    if (!voiceId || !text.trim()) { onError("Voz y texto requeridos"); return; }
    setBusy(true);
    try {
      const res = await fetch(`${API_BASE}/api/fs-pro/tts/advanced`, {
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
        <button onClick={() => setMode("mix")} style={pillButton(mode === "mix")}>Mezclar</button>
        <button onClick={toggleSfxPanel} className="btn btn-ghost btn-sm" style={{ marginLeft: "auto", border: showSfxPanel ? "1px solid var(--gold)" : undefined }}>
          {showSfxPanel ? "✕ Cerrar catálogo" : "📋 Catálogo SFX"}
        </button>
      </div>

      {showSfxPanel && sfxCatalog && (
        <div style={{ background: "var(--surface2)", borderRadius: 10, padding: 14, marginBottom: 14, border: "1px solid var(--border)" }}>
          <div style={{ display: "flex", gap: 6, marginBottom: 10, flexWrap: "wrap" }}>
            <button onClick={() => setSfxCatFilter("all")} style={pillButton(sfxCatFilter === "all")}>Todos</button>
            {Object.entries(SFX_CAT_LABELS).map(([key, label]) => (
              <button key={key} onClick={() => setSfxCatFilter(key)} style={pillButton(sfxCatFilter === key)}>{label}</button>
            ))}
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: 6 }}>
            {sfxCatalog
              .filter(s => sfxCatFilter === "all" || s.category === sfxCatFilter)
              .map((sfx: any) => (
                <button
                  key={sfx.id}
                  onClick={() => { setText(sfx.prompt); setDuration(sfx.duration); setMode("sfx"); setShowSfxPanel(false); }}
                  style={{ background: "var(--surface3)", border: "1px solid var(--border)", borderRadius: 8, padding: "8px 10px", textAlign: "left", cursor: "pointer", color: "var(--t1)", transition: "border-color 0.15s" }}
                  onMouseEnter={e => (e.currentTarget.style.borderColor = "var(--gold)")}
                  onMouseLeave={e => (e.currentTarget.style.borderColor = "var(--border)")}
                >
                  <div style={{ fontSize: 11, fontWeight: 600 }}>{sfx.name}</div>
                  <div style={{ fontSize: 9, color: "var(--t3)", marginTop: 2 }}>{SFX_CAT_LABELS[sfx.category]} · {sfx.duration}s</div>
                </button>
              ))}
          </div>
          <p style={{ fontSize: 9, color: "var(--t3)", marginTop: 8 }}>Haz clic en un efecto para usarlo como prompt en modo SFX.</p>
        </div>
      )}

      {mode === "mix" && (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
          <div>
            <Section title="Voz (TTS)">
              <input type="file" accept="audio/*" onChange={e => setTtsFile(e.target.files?.[0] || null)} />
            </Section>
            <Section title="Música de fondo">
              <input type="file" accept="audio/*" onChange={e => setMusicFile(e.target.files?.[0] || null)} />
            </Section>
          </div>
          <div>
            <Section title={`Volumen música: ${musicVolume.toFixed(2)}`}><input type="range" min={0} max={0.5} step={0.05} value={musicVolume} onChange={e => setMusicVolume(+e.target.value)} style={{ width: "100%" }} /></Section>
            <Section title="Ducking (bajar música al hablar)">
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <input type="checkbox" checked={duckingEnabled} onChange={e => setDuckingEnabled(e.target.checked)} />
                <span style={{ fontSize: 11, color: "var(--t3)" }}>Atenuar música automáticamente</span>
              </div>
            </Section>
            <button onClick={runMix} disabled={busy || !ttsFile || !musicFile} className="btn btn-gold" style={{ width: "100%", justifyContent: "center", padding: "12px 20px" }}>
              {busy ? <Loader2 size={16} className="animate-spin" /> : <Volume2 size={16} />} {busy ? "Mezclando..." : "Mezclar Audio"}
            </button>
          </div>
        </div>
      )}

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
                <>
                  <input type="range" min={5} max={600} step={5} value={musicDuration} onChange={e => setMusicDuration(+e.target.value)} style={{ width: "100%" }} />
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 6, gap: 8 }}>
                    <div style={{ fontSize: 9, color: "var(--t3)" }}>5s · 47s · 120s · 300s · 600s</div>
                    <input
                      type="number" min={5} max={600} value={musicDuration}
                      onChange={e => setMusicDuration(Math.max(5, Math.min(600, +e.target.value)))}
                      style={{ ...inputStyle, width: 64, padding: "4px 6px", fontSize: 11, textAlign: "center" }}
                    />
                  </div>
                  {musicDuration > 47 && (
                    <div style={{ fontSize: 9, color: "var(--jade)", marginTop: 4, lineHeight: 1.4 }}>
                      ✓ Canción larga: se generan {Math.ceil(musicDuration / 45)} bloques de 45s y se unen con crossfade.
                      {musicDuration > 120 && " Puede tardar varios minutos."}
                    </div>
                  )}
                </>
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

// ─── TAB: AUDIO AI TOOLS ─────────────────────────────────────────────────────
// Sub-tabs: Transcripción · Aislamiento de voz · ConvAI Agents · Diccionarios
type AudioSubTab = "transcribe" | "isolate" | "convai" | "pron";

function AudioToolsTab({ onInfo, onError }: { projectId: number; onInfo: (m: string) => void; onError: (m: string) => void }) {
  const [sub, setSub] = useState<AudioSubTab>("transcribe");

  // ── Transcripción ──
  const [tFile, setTFile] = useState<File | null>(null);
  const [tLang, setTLang] = useState("es");
  const [tDiarize, setTDiarize] = useState(false);
  const [tBusy, setTBusy] = useState(false);
  const [tResult, setTResult] = useState<{ text: string; language_code?: string; words?: any[] } | null>(null);

  async function runTranscribe() {
    if (!tFile) { onError("Selecciona un archivo de audio o vídeo"); return; }
    setTBusy(true); setTResult(null);
    try {
      const fd = new FormData();
      fd.append("file", tFile);
      fd.append("language_code", tLang);
      fd.append("diarize", String(tDiarize));
      fd.append("timestamps_granularity", "word");
      const r = await fetch(`${API_BASE}/api/voice/transcribe`, { method: "POST", body: fd, credentials: "include" });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || "Error transcribiendo");
      setTResult(j);
      onInfo("Transcripción completada");
    } catch (e: any) { onError(e.message); }
    finally { setTBusy(false); }
  }

  // ── Aislamiento de voz ──
  const [iFile, setIFile] = useState<File | null>(null);
  const [iBusy, setIBusy] = useState(false);
  const [iUrl, setIUrl] = useState<string | null>(null);

  async function runIsolate() {
    if (!iFile) { onError("Selecciona un archivo de audio"); return; }
    setIBusy(true); setIUrl(null);
    try {
      const fd = new FormData();
      fd.append("audio", iFile);
      const r = await fetch(`${API_BASE}/api/voice/audio-isolation`, { method: "POST", body: fd, credentials: "include" });
      if (!r.ok) { const j = await r.json().catch(() => ({})); throw new Error(j.error || "Error aislando audio"); }
      const blob = await r.blob();
      setIUrl(URL.createObjectURL(blob));
      onInfo("Audio aislado correctamente");
    } catch (e: any) { onError(e.message); }
    finally { setIBusy(false); }
  }

  // ── ConvAI Agents ──
  const [agents, setAgents] = useState<any[]>([]);
  const [agentsBusy, setAgentsBusy] = useState(false);
  const [newAgent, setNewAgent] = useState({ name: "", prompt: "", first_message: "", language: "es" });
  const [convaiLoaded, setConvaiLoaded] = useState(false);

  async function loadAgents() {
    setAgentsBusy(true);
    try {
      const r = await fetch(`${API_BASE}/api/voice/convai/agents`, { credentials: "include" });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || "Error cargando agentes");
      setAgents(j.agents ?? []);
      setConvaiLoaded(true);
    } catch (e: any) { onError(e.message); }
    finally { setAgentsBusy(false); }
  }

  async function createAgent() {
    if (!newAgent.name.trim()) { onError("Nombre del agente requerido"); return; }
    setAgentsBusy(true);
    try {
      const r = await fetch(`${API_BASE}/api/voice/convai/agents`, {
        method: "POST", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newAgent),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || "Error creando agente");
      onInfo(`Agente "${newAgent.name}" creado`);
      setNewAgent({ name: "", prompt: "", first_message: "", language: "es" });
      loadAgents();
    } catch (e: any) { onError(e.message); }
    finally { setAgentsBusy(false); }
  }

  async function deleteAgent(id: string) {
    setAgentsBusy(true);
    try {
      const r = await fetch(`${API_BASE}/api/voice/convai/agents/${id}`, { method: "DELETE", credentials: "include" });
      if (!r.ok) { const j = await r.json().catch(() => ({})); throw new Error(j.error || "Error eliminando"); }
      onInfo("Agente eliminado");
      setAgents(prev => prev.filter(a => a.agent_id !== id));
    } catch (e: any) { onError(e.message); }
    finally { setAgentsBusy(false); }
  }

  useEffect(() => { if (sub === "convai" && !convaiLoaded) loadAgents(); }, [sub]);

  // ── Diccionarios de Pronunciación ──
  const [dicts, setDicts] = useState<any[]>([]);
  const [dictsBusy, setDictsBusy] = useState(false);
  const [dictsLoaded, setDictsLoaded] = useState(false);
  const [newDict, setNewDict] = useState({ name: "", description: "" });
  const [newRules, setNewRules] = useState([{ type: "alias" as const, string_to_replace: "", alias: "" }]);

  async function loadDicts() {
    setDictsBusy(true);
    try {
      const r = await fetch(`${API_BASE}/api/voice/pronunciation-dicts`, { credentials: "include" });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || "Error cargando diccionarios");
      setDicts(j.dictionaries ?? []);
      setDictsLoaded(true);
    } catch (e: any) { onError(e.message); }
    finally { setDictsBusy(false); }
  }

  async function createDict() {
    if (!newDict.name.trim()) { onError("Nombre del diccionario requerido"); return; }
    const validRules = newRules.filter(r => r.string_to_replace.trim() && (r.alias?.trim()));
    if (!validRules.length) { onError("Al menos una regla con palabra y alias requerida"); return; }
    setDictsBusy(true);
    try {
      const r = await fetch(`${API_BASE}/api/voice/pronunciation-dicts`, {
        method: "POST", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newDict.name.trim(), description: newDict.description.trim(), rules: validRules }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || "Error creando diccionario");
      onInfo(`Diccionario "${newDict.name}" creado`);
      setNewDict({ name: "", description: "" });
      setNewRules([{ type: "alias", string_to_replace: "", alias: "" }]);
      loadDicts();
    } catch (e: any) { onError(e.message); }
    finally { setDictsBusy(false); }
  }

  async function deleteDict(id: string) {
    setDictsBusy(true);
    try {
      const r = await fetch(`${API_BASE}/api/voice/pronunciation-dicts/${id}`, { method: "DELETE", credentials: "include" });
      if (!r.ok) { const j = await r.json().catch(() => ({})); throw new Error(j.error || "Error eliminando"); }
      onInfo("Diccionario eliminado");
      setDicts(prev => prev.filter(d => d.id !== id));
    } catch (e: any) { onError(e.message); }
    finally { setDictsBusy(false); }
  }

  useEffect(() => { if (sub === "pron" && !dictsLoaded) loadDicts(); }, [sub]);

  const SUB_TABS: { id: AudioSubTab; label: string; icon: React.ReactNode }[] = [
    { id: "transcribe", label: "Transcripción", icon: <FileText size={13} /> },
    { id: "isolate",    label: "Aislar voz",    icon: <Scissors size={13} /> },
    { id: "convai",     label: "ConvAI Agents", icon: <Bot size={13} /> },
    { id: "pron",       label: "Pronunciación", icon: <BookOpen size={13} /> },
  ];

  const inp: React.CSSProperties = {
    width: "100%", padding: "8px 10px", borderRadius: 6,
    border: "1px solid rgba(200,168,75,0.25)", background: "rgba(255,255,255,0.04)",
    color: "var(--t1)", fontSize: 13, outline: "none",
  };
  const label: React.CSSProperties = { fontSize: 12, color: "var(--t2)", marginBottom: 4, display: "block" };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {/* Sub-tab bar */}
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
        {SUB_TABS.map(t => (
          <button key={t.id} onClick={() => setSub(t.id)} style={{
            display: "flex", alignItems: "center", gap: 6, padding: "6px 14px",
            borderRadius: 20, fontSize: 12, cursor: "pointer", transition: "all 0.15s",
            background: sub === t.id ? "rgba(200,168,75,0.18)" : "rgba(255,255,255,0.04)",
            border: sub === t.id ? "1px solid rgba(200,168,75,0.45)" : "1px solid rgba(255,255,255,0.08)",
            color: sub === t.id ? "var(--gold)" : "var(--t2)",
          }}>{t.icon}{t.label}</button>
        ))}
      </div>

      {/* ── TRANSCRIPCIÓN ── */}
      {sub === "transcribe" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <div style={{ padding: 14, background: "rgba(200,168,75,0.06)", borderRadius: 8, border: "1px solid rgba(200,168,75,0.15)", fontSize: 12, color: "var(--t2)" }}>
            <strong style={{ color: "var(--gold)" }}>ElevenLabs Scribe v1</strong> — Transcribe audio y vídeo a texto con timestamps por palabra. Admite mp3, wav, m4a, ogg, flac, webm, mp4 (máx. 100 MB).
          </div>
          <div>
            <span style={label}>Archivo de audio / vídeo</span>
            <label style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 14px", border: "2px dashed rgba(200,168,75,0.3)", borderRadius: 8, cursor: "pointer", color: "var(--t2)", fontSize: 13 }}>
              <UploadCloud size={16} style={{ color: "var(--gold)" }} />
              {tFile ? tFile.name : "Arrastra o haz clic para seleccionar"}
              <input type="file" accept="audio/*,video/*" style={{ display: "none" }} onChange={e => setTFile(e.target.files?.[0] ?? null)} />
            </label>
          </div>
          <div style={{ display: "flex", gap: 10 }}>
            <div style={{ flex: 1 }}>
              <span style={label}>Idioma</span>
              <select value={tLang} onChange={e => setTLang(e.target.value)} style={{ ...inp }}>
                <option value="es">Español</option>
                <option value="en">English</option>
                <option value="fr">Français</option>
                <option value="de">Deutsch</option>
                <option value="it">Italiano</option>
                <option value="pt">Português</option>
                <option value="zh">中文</option>
                <option value="ja">日本語</option>
              </select>
            </div>
            <div style={{ display: "flex", alignItems: "flex-end", paddingBottom: 0, gap: 6 }}>
              <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: "var(--t2)", cursor: "pointer" }}>
                <input type="checkbox" checked={tDiarize} onChange={e => setTDiarize(e.target.checked)} />
                Identificar hablantes
              </label>
            </div>
          </div>
          <button onClick={runTranscribe} disabled={!tFile || tBusy} className="btn btn-gold" style={{ alignSelf: "flex-start" }}>
            {tBusy ? <Loader2 size={14} className="animate-spin" /> : <FileText size={14} />}
            {tBusy ? "Transcribiendo…" : "Transcribir"}
          </button>
          {tResult && (
            <div style={{ background: "rgba(0,0,0,0.3)", borderRadius: 8, border: "1px solid rgba(200,168,75,0.2)", padding: 14 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                <span style={{ fontSize: 12, color: "var(--gold)" }}>
                  <CheckCircle2 size={13} style={{ verticalAlign: "middle", marginRight: 4 }} />
                  Transcripción completada {tResult.language_code ? `(${tResult.language_code})` : ""}
                </span>
                <button onClick={() => navigator.clipboard.writeText(tResult.text)} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--t2)" }}>
                  <Copy size={13} />
                </button>
              </div>
              <p style={{ fontSize: 13, color: "var(--t1)", margin: 0, lineHeight: 1.6, whiteSpace: "pre-wrap" }}>{tResult.text}</p>
              {tResult.words && tResult.words.length > 0 && (
                <details style={{ marginTop: 10 }}>
                  <summary style={{ fontSize: 11, color: "var(--t3)", cursor: "pointer" }}>Ver timestamps ({tResult.words.length} palabras)</summary>
                  <div style={{ maxHeight: 160, overflowY: "auto", marginTop: 6, fontSize: 11, color: "var(--t2)" }}>
                    {tResult.words.slice(0, 50).map((w: any, i: number) => (
                      <span key={i} style={{ marginRight: 8 }}>[{w.start?.toFixed(1)}s] {w.text}</span>
                    ))}
                  </div>
                </details>
              )}
            </div>
          )}
        </div>
      )}

      {/* ── AISLAR VOZ ── */}
      {sub === "isolate" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <div style={{ padding: 14, background: "rgba(200,168,75,0.06)", borderRadius: 8, border: "1px solid rgba(200,168,75,0.15)", fontSize: 12, color: "var(--t2)" }}>
            <strong style={{ color: "var(--gold)" }}>Audio Isolation</strong> — Separa la voz de la música y el ruido de fondo. Perfecto para limpiar voiceovers antes de hacer face-swap o doblaje.
          </div>
          <div>
            <span style={label}>Archivo de audio</span>
            <label style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 14px", border: "2px dashed rgba(200,168,75,0.3)", borderRadius: 8, cursor: "pointer", color: "var(--t2)", fontSize: 13 }}>
              <Scissors size={16} style={{ color: "var(--gold)" }} />
              {iFile ? iFile.name : "Arrastra o haz clic para seleccionar (mp3, wav, m4a, ogg)"}
              <input type="file" accept="audio/*" style={{ display: "none" }} onChange={e => setIFile(e.target.files?.[0] ?? null)} />
            </label>
          </div>
          <button onClick={runIsolate} disabled={!iFile || iBusy} className="btn btn-gold" style={{ alignSelf: "flex-start" }}>
            {iBusy ? <Loader2 size={14} className="animate-spin" /> : <Scissors size={14} />}
            {iBusy ? "Aislando voz…" : "Aislar voz"}
          </button>
          {iUrl && (
            <div style={{ background: "rgba(0,0,0,0.3)", borderRadius: 8, border: "1px solid rgba(200,168,75,0.2)", padding: 14 }}>
              <p style={{ fontSize: 12, color: "var(--gold)", marginBottom: 10 }}>
                <CheckCircle2 size={13} style={{ verticalAlign: "middle", marginRight: 4 }} />
                Voz aislada lista
              </p>
              <audio controls src={iUrl} style={{ width: "100%", borderRadius: 6 }} />
              <a href={iUrl} download={`isolated_${iFile?.name || "audio.mp3"}`} className="btn" style={{ marginTop: 10, display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12, padding: "6px 14px" }}>
                <Download size={13} /> Descargar
              </a>
            </div>
          )}
        </div>
      )}

      {/* ── CONVAI AGENTS ── */}
      {sub === "convai" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div style={{ padding: 14, background: "rgba(200,168,75,0.06)", borderRadius: 8, border: "1px solid rgba(200,168,75,0.15)", fontSize: 12, color: "var(--t2)" }}>
            <strong style={{ color: "var(--gold)" }}>ConvAI Agents</strong> — Crea agentes conversacionales con voz en tiempo real. Cada agente tiene su propia personalidad, prompt y voz. Ideal para chatbots de atención al cliente de tus tiendas Shopify.
          </div>

          {/* Crear agente */}
          <div style={{ background: "rgba(0,0,0,0.2)", borderRadius: 8, padding: 14, border: "1px solid rgba(255,255,255,0.07)" }}>
            <p style={{ fontSize: 12, color: "var(--gold)", marginBottom: 12, fontWeight: 600 }}>+ Nuevo agente</p>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <div>
                <span style={label}>Nombre del agente *</span>
                <input value={newAgent.name} onChange={e => setNewAgent(p => ({ ...p, name: e.target.value }))} placeholder="Ej: Asistente Tienda Zara" style={inp} />
              </div>
              <div>
                <span style={label}>Prompt del sistema</span>
                <textarea value={newAgent.prompt} onChange={e => setNewAgent(p => ({ ...p, prompt: e.target.value }))}
                  placeholder="Eres un asistente de atención al cliente amable y profesional de [nombre de tienda]. Ayudas con pedidos, productos y devoluciones en español."
                  rows={3} style={{ ...inp, resize: "vertical" }} />
              </div>
              <div>
                <span style={label}>Mensaje inicial</span>
                <input value={newAgent.first_message} onChange={e => setNewAgent(p => ({ ...p, first_message: e.target.value }))}
                  placeholder="Hola, ¿en qué puedo ayudarte hoy?" style={inp} />
              </div>
              <div>
                <span style={label}>Idioma</span>
                <select value={newAgent.language} onChange={e => setNewAgent(p => ({ ...p, language: e.target.value }))} style={inp}>
                  <option value="es">Español</option>
                  <option value="en">English</option>
                  <option value="fr">Français</option>
                  <option value="de">Deutsch</option>
                  <option value="pt">Português</option>
                </select>
              </div>
              <button onClick={createAgent} disabled={agentsBusy || !newAgent.name.trim()} className="btn btn-gold" style={{ alignSelf: "flex-start" }}>
                {agentsBusy ? <Loader2 size={13} className="animate-spin" /> : <Plus size={13} />}
                Crear agente
              </button>
            </div>
          </div>

          {/* Lista de agentes */}
          <div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
              <p style={{ fontSize: 12, color: "var(--t2)", fontWeight: 600 }}>Agentes activos ({agents.length})</p>
              <button onClick={loadAgents} disabled={agentsBusy} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--t3)" }}>
                <RefreshCw size={13} className={agentsBusy ? "animate-spin" : ""} />
              </button>
            </div>
            {agents.length === 0 && !agentsBusy && (
              <p style={{ fontSize: 12, color: "var(--t3)", padding: "12px 0" }}>No hay agentes creados aún.</p>
            )}
            {agents.map(a => (
              <div key={a.agent_id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 12px", background: "rgba(255,255,255,0.03)", borderRadius: 6, border: "1px solid rgba(255,255,255,0.07)", marginBottom: 6 }}>
                <div>
                  <p style={{ fontSize: 13, color: "var(--t1)", margin: 0 }}><Bot size={12} style={{ marginRight: 6, verticalAlign: "middle", color: "var(--gold)" }} />{a.name}</p>
                  <p style={{ fontSize: 11, color: "var(--t3)", margin: "2px 0 0" }}>ID: {a.agent_id}</p>
                </div>
                <button onClick={() => deleteAgent(a.agent_id)} disabled={agentsBusy} style={{ background: "none", border: "none", cursor: "pointer", color: "#e05252" }}>
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── DICCIONARIOS DE PRONUNCIACIÓN ── */}
      {sub === "pron" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div style={{ padding: 14, background: "rgba(200,168,75,0.06)", borderRadius: 8, border: "1px solid rgba(200,168,75,0.15)", fontSize: 12, color: "var(--t2)" }}>
            <strong style={{ color: "var(--gold)" }}>Diccionarios de Pronunciación</strong> — Corrige cómo el TTS pronuncia nombres de marca, productos o términos técnicos. Ej: "Nike" → "Naiki", "Zara" → "Zará".
          </div>

          {/* Crear diccionario */}
          <div style={{ background: "rgba(0,0,0,0.2)", borderRadius: 8, padding: 14, border: "1px solid rgba(255,255,255,0.07)" }}>
            <p style={{ fontSize: 12, color: "var(--gold)", marginBottom: 12, fontWeight: 600 }}>+ Nuevo diccionario</p>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <div style={{ display: "flex", gap: 10 }}>
                <div style={{ flex: 1 }}>
                  <span style={label}>Nombre *</span>
                  <input value={newDict.name} onChange={e => setNewDict(p => ({ ...p, name: e.target.value }))} placeholder="Ej: Marcas de moda" style={inp} />
                </div>
                <div style={{ flex: 1 }}>
                  <span style={label}>Descripción</span>
                  <input value={newDict.description} onChange={e => setNewDict(p => ({ ...p, description: e.target.value }))} placeholder="Correcciones para TTS" style={inp} />
                </div>
              </div>
              <div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                  <span style={label}>Reglas de pronunciación</span>
                  <button onClick={() => setNewRules(p => [...p, { type: "alias", string_to_replace: "", alias: "" }])}
                    style={{ background: "none", border: "none", cursor: "pointer", color: "var(--gold)", fontSize: 11, display: "flex", alignItems: "center", gap: 4 }}>
                    <Plus size={12} /> Añadir regla
                  </button>
                </div>
                {newRules.map((rule, i) => (
                  <div key={i} style={{ display: "flex", gap: 8, marginBottom: 6, alignItems: "center" }}>
                    <input value={rule.string_to_replace} onChange={e => setNewRules(p => p.map((r, j) => j === i ? { ...r, string_to_replace: e.target.value } : r))}
                      placeholder="Palabra original" style={{ ...inp, flex: 1 }} />
                    <span style={{ color: "var(--t3)", fontSize: 14 }}>→</span>
                    <input value={rule.alias || ""} onChange={e => setNewRules(p => p.map((r, j) => j === i ? { ...r, alias: e.target.value } : r))}
                      placeholder="Pronunciar como" style={{ ...inp, flex: 1 }} />
                    {newRules.length > 1 && (
                      <button onClick={() => setNewRules(p => p.filter((_, j) => j !== i))} style={{ background: "none", border: "none", cursor: "pointer", color: "#e05252" }}>
                        <X size={13} />
                      </button>
                    )}
                  </div>
                ))}
              </div>
              <button onClick={createDict} disabled={dictsBusy || !newDict.name.trim()} className="btn btn-gold" style={{ alignSelf: "flex-start" }}>
                {dictsBusy ? <Loader2 size={13} className="animate-spin" /> : <BookOpen size={13} />}
                Crear diccionario
              </button>
            </div>
          </div>

          {/* Lista de diccionarios */}
          <div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
              <p style={{ fontSize: 12, color: "var(--t2)", fontWeight: 600 }}>Diccionarios ({dicts.length})</p>
              <button onClick={loadDicts} disabled={dictsBusy} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--t3)" }}>
                <RefreshCw size={13} className={dictsBusy ? "animate-spin" : ""} />
              </button>
            </div>
            {dicts.length === 0 && !dictsBusy && (
              <p style={{ fontSize: 12, color: "var(--t3)", padding: "12px 0" }}>No hay diccionarios creados aún.</p>
            )}
            {dicts.map(d => (
              <div key={d.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 12px", background: "rgba(255,255,255,0.03)", borderRadius: 6, border: "1px solid rgba(255,255,255,0.07)", marginBottom: 6 }}>
                <div>
                  <p style={{ fontSize: 13, color: "var(--t1)", margin: 0 }}><BookOpen size={12} style={{ marginRight: 6, verticalAlign: "middle", color: "var(--gold)" }} />{d.name}</p>
                  {d.description && <p style={{ fontSize: 11, color: "var(--t3)", margin: "2px 0 0" }}>{d.description}</p>}
                  <p style={{ fontSize: 10, color: "var(--t3)", margin: "2px 0 0", fontFamily: "monospace" }}>ID: {d.id} · v{d.version_id}</p>
                </div>
                <button onClick={() => deleteDict(d.id)} disabled={dictsBusy} style={{ background: "none", border: "none", cursor: "pointer", color: "#e05252" }}>
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
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

// ─── TAB: OPENART ENGINE ──────────────────────────────────────────────────
interface OAStyle { id: string; name: string; category: string; emoji: string; description: string; promptSuffix: string; negativePrompt: string; recommendedModel: string; examplePrompt: string; tags: string[] }
interface OATemplate { id: string; name: string; category: string; prompt: string; variables: string[]; tags: string[] }
interface OABookChapter { id: string; title: string; icon: string; content: string }

type OASubTab = "styles" | "builder" | "enhancer" | "templates" | "book" | "analyzer";

function OpenArtEngineTab({ onInfo, onError }: { onInfo: (m: string) => void; onError: (m: string) => void }) {
  const [sub, setSub] = useState<OASubTab>("styles");
  const [styles, setStyles] = useState<OAStyle[]>([]);
  const [templates, setTemplates] = useState<OATemplate[]>([]);
  const [chapters, setChapters] = useState<OABookChapter[]>([]);
  const [loading, setLoading] = useState(false);

  // Style selector state
  const [selectedStyle, setSelectedStyle] = useState<OAStyle | null>(null);
  const [catFilter, setCatFilter] = useState("all");
  const [searchQ, setSearchQ] = useState("");

  // Builder state
  const [bSubject, setBSubject] = useState("");
  const [bComposition, setBComposition] = useState("professional composition, rule of thirds");
  const [bLighting, setBLighting] = useState("professional studio lighting");
  const [bMood, setBMood] = useState("high quality professional");
  const [bQuality, setBQuality] = useState<"standard"|"premium"|"ultra">("premium");
  const [builtPrompt, setBuiltPrompt] = useState<{full:string;negative:string;stylePreset?:{name:string}} | null>(null);
  const [building, setBuilding] = useState(false);

  // Enhancer state
  const [enhInput, setEnhInput] = useState("");
  const [enhMode, setEnhMode] = useState<"enhance"|"rewrite"|"translate"|"variations"|"negative">("enhance");
  const [enhResult, setEnhResult] = useState("");
  const [enhancing, setEnhancing] = useState(false);

  // Analyzer state
  const [analyzeInput, setAnalyzeInput] = useState("");
  const [analyzeResult, setAnalyzeResult] = useState<any>(null);
  const [analyzing, setAnalyzing] = useState(false);

  // Template state
  const [tmplSearch, setTmplSearch] = useState("");
  const [tmplCat, setTmplCat] = useState("all");
  const [selectedTmpl, setSelectedTmpl] = useState<OATemplate | null>(null);
  const [tmplVars, setTmplVars] = useState<Record<string,string>>({});
  const [tmplResult, setTmplResult] = useState("");

  // Book state
  const [bookChapter, setBookChapter] = useState<OABookChapter | null>(null);

  const card: React.CSSProperties = { background: "var(--ink)", border: "1px solid var(--bdr)", borderRadius: 10, padding: 14 };
  const inp: React.CSSProperties = { width: "100%", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 6, padding: "7px 10px", fontSize: 11, color: "var(--ink)", outline: "none", boxSizing: "border-box" };
  const btn = (active = false, accent = false): React.CSSProperties => ({
    padding: "7px 14px", borderRadius: 6, fontSize: 11, fontWeight: 700, cursor: "pointer", border: "none",
    background: accent ? "linear-gradient(135deg,#c8a84b,#f0d68a)" : active ? "rgba(200,168,75,0.18)" : "rgba(255,255,255,0.06)",
    color: accent ? "#000" : active ? "var(--gold)" : "var(--t2)",
  });
  const gold: React.CSSProperties = { color: "var(--gold)" };
  const label: React.CSSProperties = { fontSize: 10, color: "var(--t3)", marginBottom: 3, display: "block", fontWeight: 600 };

  const copyToClipboard = (text: string) => { navigator.clipboard.writeText(text).then(() => onInfo("✅ Copiado al portapapeles")); };

  useEffect(() => {
    setLoading(true);
    Promise.all([
      fetch(`${API_BASE}/api/openart/styles`, { credentials: "include" }).then(r => r.json()),
      fetch(`${API_BASE}/api/openart/templates`, { credentials: "include" }).then(r => r.json()),
      fetch(`${API_BASE}/api/openart/prompt-book`, { credentials: "include" }).then(r => r.json()),
    ]).then(([s, t, b]) => {
      setStyles(s.styles || []);
      setTemplates(t.templates || []);
      setChapters(b.chapters || []);
    }).catch(e => onError(e.message)).finally(() => setLoading(false));
  }, []);

  const filteredStyles = styles.filter(s => {
    const matchCat = catFilter === "all" || s.category === catFilter;
    const matchQ = !searchQ || s.name.toLowerCase().includes(searchQ.toLowerCase()) || s.tags.some(t => t.includes(searchQ.toLowerCase()));
    return matchCat && matchQ;
  });
  const categories = ["all", ...Array.from(new Set(styles.map(s => s.category)))];

  const filteredTemplates = templates.filter(t => {
    const matchCat = tmplCat === "all" || t.category === tmplCat;
    const matchQ = !tmplSearch || t.name.toLowerCase().includes(tmplSearch.toLowerCase()) || t.tags.some(x => x.includes(tmplSearch.toLowerCase()));
    return matchCat && matchQ;
  });
  const tmplCategories = ["all", ...Array.from(new Set(templates.map(t => t.category)))];

  const buildPrompt = async () => {
    if (!bSubject.trim()) { onError("Escribe un sujeto"); return; }
    setBuilding(true);
    try {
      const r = await fetch(`${API_BASE}/api/openart/build-prompt`, {
        method: "POST", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subject: bSubject, styleId: selectedStyle?.id, composition: bComposition, lighting: bLighting, mood: bMood, qualityTier: bQuality }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error);
      setBuiltPrompt(d.prompt);
    } catch (e: any) { onError(e.message); }
    setBuilding(false);
  };

  const enhancePrompt = async () => {
    if (!enhInput.trim()) { onError("Escribe un prompt"); return; }
    setEnhancing(true); setEnhResult("");
    try {
      const r = await fetch(`${API_BASE}/api/openart/enhance-prompt`, {
        method: "POST", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: enhInput, styleId: selectedStyle?.id, mode: enhMode }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error);
      setEnhResult(d.enhanced || "");
    } catch (e: any) { onError(e.message); }
    setEnhancing(false);
  };

  const analyzePrompt = async () => {
    if (!analyzeInput.trim()) { onError("Escribe un prompt"); return; }
    setAnalyzing(true); setAnalyzeResult(null);
    try {
      const r = await fetch(`${API_BASE}/api/openart/analyze-prompt`, {
        method: "POST", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: analyzeInput }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error);
      setAnalyzeResult(d);
    } catch (e: any) { onError(e.message); }
    setAnalyzing(false);
  };

  const fillTemplate = async () => {
    if (!selectedTmpl) return;
    try {
      const r = await fetch(`${API_BASE}/api/openart/template-fill`, {
        method: "POST", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ templateId: selectedTmpl.id, variables: tmplVars, styleId: selectedStyle?.id }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error);
      setTmplResult(d.prompt);
    } catch (e: any) { onError(e.message); }
  };

  const SUBTABS: Array<{id: OASubTab; label: string; icon: string}> = [
    { id: "styles",   label: "Estilos",    icon: "🎨" },
    { id: "builder",  label: "Constructor", icon: "🧪" },
    { id: "enhancer", label: "Enhancer IA", icon: "⚡" },
    { id: "templates",label: "Plantillas",  icon: "📋" },
    { id: "book",     label: "Libro",       icon: "📖" },
    { id: "analyzer", label: "Analizador",  icon: "🔬" },
  ];

  return (
    <div style={{ padding: "0 0 32px" }}>
      {/* Hero Header */}
      <div style={{ background: "linear-gradient(135deg, rgba(200,168,75,0.12), rgba(120,80,200,0.08))", border: "1px solid rgba(200,168,75,0.25)", borderRadius: 12, padding: "18px 20px", marginBottom: 18 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ fontSize: 36 }}>🎨</div>
          <div>
            <div style={{ fontSize: 17, fontWeight: 800, color: "var(--gold)" }}>OpenArt Engine</div>
            <div style={{ fontSize: 11, color: "var(--t2)", marginTop: 2 }}>
              Motor de prompts de nivel profesional · {styles.length} estilos · {templates.length} plantillas · Fórmula maestra · Enhancer IA · Libro de prompts
            </div>
          </div>
          {selectedStyle && (
            <div style={{ marginLeft: "auto", background: "rgba(200,168,75,0.15)", border: "1px solid rgba(200,168,75,0.4)", borderRadius: 8, padding: "6px 12px", display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ fontSize: 18 }}>{selectedStyle.emoji}</span>
              <div>
                <div style={{ fontSize: 10, color: "var(--t3)" }}>Estilo activo</div>
                <div style={{ fontSize: 12, fontWeight: 700, color: "var(--gold)" }}>{selectedStyle.name}</div>
              </div>
              <button onClick={() => setSelectedStyle(null)} style={{ background: "none", border: "none", color: "var(--t3)", cursor: "pointer", fontSize: 14 }}>×</button>
            </div>
          )}
        </div>
      </div>

      {/* Sub-tabs */}
      <div style={{ display: "flex", gap: 6, marginBottom: 18, flexWrap: "wrap" }}>
        {SUBTABS.map(s => (
          <button key={s.id} onClick={() => setSub(s.id)} style={{
            ...btn(sub === s.id),
            padding: "8px 14px", fontSize: 12,
            border: sub === s.id ? "1px solid rgba(200,168,75,0.5)" : "1px solid rgba(255,255,255,0.08)",
          }}>
            {s.icon} {s.label}
          </button>
        ))}
      </div>

      {loading && <div style={{ textAlign: "center", padding: 40, color: "var(--t3)" }}>⏳ Cargando motor OpenArt…</div>}

      {/* ── STYLES ─────────────────────────────────────────────────────────── */}
      {!loading && sub === "styles" && (
        <div>
          <div style={{ display: "flex", gap: 8, marginBottom: 14, flexWrap: "wrap" }}>
            <input value={searchQ} onChange={e => setSearchQ(e.target.value)} placeholder="Buscar estilo…" style={{ ...inp, flex: 1, minWidth: 160 }} />
            <select value={catFilter} onChange={e => setCatFilter(e.target.value)} style={{ ...inp, width: "auto" }}>
              {categories.map(c => <option key={c} value={c}>{c === "all" ? "Todas las categorías" : c}</option>)}
            </select>
          </div>
          <div style={{ fontSize: 11, color: "var(--t3)", marginBottom: 12 }}>
            {filteredStyles.length} estilos · Haz clic para seleccionar el estilo activo (se usará en Builder, Enhancer y Plantillas)
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: 10 }}>
            {filteredStyles.map(s => (
              <div key={s.id} onClick={() => { setSelectedStyle(s === selectedStyle ? null : s); onInfo(`✅ Estilo "${s.name}" ${s === selectedStyle ? "deseleccionado" : "activado"}`); }}
                style={{ ...card, cursor: "pointer", transition: "all 0.15s", border: selectedStyle?.id === s.id ? "1px solid rgba(200,168,75,0.6)" : "1px solid var(--bdr)", background: selectedStyle?.id === s.id ? "linear-gradient(135deg, rgba(200,168,75,0.12), rgba(200,168,75,0.04))" : "var(--ink)" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                  <span style={{ fontSize: 22 }}>{s.emoji}</span>
                  <div>
                    <div style={{ fontSize: 12, fontWeight: 700, color: selectedStyle?.id === s.id ? "var(--gold)" : "var(--t1)" }}>{s.name}</div>
                    <div style={{ fontSize: 9, color: "var(--t3)", background: "rgba(255,255,255,0.06)", padding: "1px 6px", borderRadius: 10, display: "inline-block", marginTop: 2 }}>{s.category}</div>
                  </div>
                  {selectedStyle?.id === s.id && <span style={{ marginLeft: "auto", color: "var(--gold)", fontSize: 14 }}>✓</span>}
                </div>
                <div style={{ fontSize: 10, color: "var(--t2)", lineHeight: 1.4, marginBottom: 8 }}>{s.description}</div>
                <div style={{ fontSize: 9, color: "var(--t3)", fontStyle: "italic", lineHeight: 1.3, borderTop: "1px solid var(--bdr)", paddingTop: 6 }}>
                  Modelo: <span style={{ color: "var(--gold)", fontStyle: "normal" }}>{s.recommendedModel}</span>
                </div>
                <div style={{ display: "flex", gap: 4, marginTop: 6, flexWrap: "wrap" }}>
                  {s.tags.slice(0, 3).map(t => (
                    <span key={t} style={{ fontSize: 8, background: "rgba(200,168,75,0.1)", color: "var(--gold)", padding: "1px 5px", borderRadius: 8 }}>#{t}</span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── BUILDER ────────────────────────────────────────────────────────── */}
      {!loading && sub === "builder" && (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
          <div>
            <div style={{ ...card, marginBottom: 14 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: "var(--gold)", marginBottom: 12 }}>🧪 Constructor de Prompts — Fórmula OpenArt</div>
              <div style={{ fontSize: 10, color: "var(--t3)", marginBottom: 14, lineHeight: 1.4 }}>
                <strong style={gold}>Fórmula:</strong> Sujeto → Estilo → Composición → Iluminación → Ánimo → Calidad
              </div>

              <div style={{ marginBottom: 10 }}>
                <span style={label}>SUJETO * — ¿Qué aparece en la imagen?</span>
                <textarea value={bSubject} onChange={e => setBSubject(e.target.value)} placeholder="Luxury Swiss watch with diamond bezel on black marble surface" style={{ ...inp, minHeight: 60 }} />
              </div>

              <div style={{ marginBottom: 10 }}>
                <span style={label}>ESTILO — {selectedStyle ? `✓ ${selectedStyle.name}` : "Selecciona en pestaña Estilos"}</span>
                {selectedStyle ? (
                  <div style={{ background: "rgba(200,168,75,0.1)", border: "1px solid rgba(200,168,75,0.3)", borderRadius: 6, padding: "6px 10px", fontSize: 10, color: "var(--t2)", lineHeight: 1.4 }}>
                    {selectedStyle.emoji} {selectedStyle.name} · {selectedStyle.description}
                  </div>
                ) : (
                  <button onClick={() => setSub("styles")} style={{ ...btn(false, false), width: "100%", textAlign: "left" }}>
                    🎨 Ir a Estilos para seleccionar →
                  </button>
                )}
              </div>

              <div style={{ marginBottom: 10 }}>
                <span style={label}>COMPOSICIÓN</span>
                <select value={bComposition} onChange={e => setBComposition(e.target.value)} style={{ ...inp }}>
                  {["professional composition, rule of thirds","centered symmetrical composition","bird's eye view overhead shot","dramatic Dutch angle","close-up macro shot","wide establishing shot","leading lines composition","over-the-shoulder perspective"].map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>

              <div style={{ marginBottom: 10 }}>
                <span style={label}>ILUMINACIÓN</span>
                <select value={bLighting} onChange={e => setBLighting(e.target.value)} style={{ ...inp }}>
                  {["professional studio lighting","golden hour warm sunlight","dramatic side Rembrandt lighting","soft box diffused light","rim backlighting silhouette","neon colored lights","cinematic volumetric rays","candlelight warm glow","harsh high-noon sun","blue hour twilight"].map(l => <option key={l} value={l}>{l}</option>)}
                </select>
              </div>

              <div style={{ marginBottom: 10 }}>
                <span style={label}>ESTADO DE ÁNIMO</span>
                <select value={bMood} onChange={e => setBMood(e.target.value)} style={{ ...inp }}>
                  {["high quality professional","luxurious and refined","mysterious and atmospheric","epic and powerful","cheerful and energetic","romantic and tender","dark and threatening","serene and peaceful","dreamy and ethereal","raw and authentic"].map(m => <option key={m} value={m}>{m}</option>)}
                </select>
              </div>

              <div style={{ marginBottom: 14 }}>
                <span style={label}>TIER DE CALIDAD</span>
                <div style={{ display: "flex", gap: 6 }}>
                  {(["standard","premium","ultra"] as const).map(q => (
                    <button key={q} onClick={() => setBQuality(q)} style={{ ...btn(bQuality === q), flex: 1, textTransform: "capitalize" }}>{q}</button>
                  ))}
                </div>
              </div>

              <button onClick={buildPrompt} disabled={building || !bSubject.trim()} style={{ ...btn(false, true), width: "100%", opacity: building ? 0.6 : 1 }}>
                {building ? "🧪 Construyendo…" : "🧪 Construir Prompt"}
              </button>
            </div>
          </div>

          <div>
            {builtPrompt ? (
              <div style={card}>
                <div style={{ fontSize: 13, fontWeight: 700, color: "var(--gold)", marginBottom: 12 }}>✅ Prompt Construido</div>
                {builtPrompt.stylePreset && (
                  <div style={{ fontSize: 10, color: "var(--t3)", marginBottom: 8 }}>
                    Estilo aplicado: <span style={gold}>{builtPrompt.stylePreset.name}</span>
                  </div>
                )}
                <div style={{ marginBottom: 12 }}>
                  <div style={{ fontSize: 10, fontWeight: 700, color: "var(--gold)", marginBottom: 6 }}>✅ PROMPT PRINCIPAL:</div>
                  <div style={{ background: "rgba(255,255,255,0.04)", borderRadius: 6, padding: 10, fontSize: 10, color: "var(--t1)", lineHeight: 1.5, fontFamily: "monospace" }}>
                    {builtPrompt.full}
                  </div>
                  <button onClick={() => copyToClipboard(builtPrompt.full)} style={{ ...btn(false, true), marginTop: 8, fontSize: 10 }}>📋 Copiar Prompt</button>
                </div>
                <div>
                  <div style={{ fontSize: 10, fontWeight: 700, color: "#ef4444", marginBottom: 6 }}>🚫 NEGATIVE PROMPT:</div>
                  <div style={{ background: "rgba(239,68,68,0.06)", borderRadius: 6, padding: 10, fontSize: 10, color: "var(--t2)", lineHeight: 1.5, fontFamily: "monospace" }}>
                    {builtPrompt.negative}
                  </div>
                  <button onClick={() => copyToClipboard(builtPrompt.negative)} style={{ ...btn(), marginTop: 8, fontSize: 10 }}>📋 Copiar Negative</button>
                </div>
                <div style={{ marginTop: 14, padding: "10px", background: "rgba(200,168,75,0.07)", borderRadius: 8, fontSize: 10, color: "var(--t3)" }}>
                  💡 <strong style={gold}>Pro tip:</strong> Pega este prompt en la pestaña Generar imagen para ver el resultado
                </div>
              </div>
            ) : (
              <div style={{ ...card, textAlign: "center", padding: 40 }}>
                <div style={{ fontSize: 40, marginBottom: 12 }}>🧪</div>
                <div style={{ color: "var(--t3)", fontSize: 12 }}>Rellena los campos y pulsa "Construir Prompt"</div>
                <div style={{ color: "var(--t3)", fontSize: 10, marginTop: 8, lineHeight: 1.4 }}>
                  El constructor aplica automáticamente la fórmula maestra OpenArt con el estilo seleccionado
                </div>
              </div>
            )}

            {/* Quick Formula Reference */}
            <div style={{ ...card, marginTop: 14 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: "var(--gold)", marginBottom: 8 }}>📐 Fórmula Rápida OpenArt</div>
              {[
                ["🎯 Sujeto", "Qué aparece: objeto, persona, escena, concepto"],
                ["🎨 Estilo", "Arte fotorrealista, anime, 3D, pintura, etc."],
                ["📐 Composición", "Cómo está encuadrado: regla de tercios, macro, etc."],
                ["💡 Iluminación", "Golden hour, studio, Rembrandt, rim light, etc."],
                ["🌡️ Ánimo", "Lujoso, misterioso, épico, romántico, etc."],
                ["⭐ Calidad", "8K, masterpiece, ultra-detailed, etc."],
              ].map(([k, v]) => (
                <div key={k} style={{ display: "flex", gap: 8, marginBottom: 5, fontSize: 10 }}>
                  <span style={{ color: "var(--gold)", fontWeight: 700, minWidth: 100 }}>{k}</span>
                  <span style={{ color: "var(--t3)" }}>{v}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── ENHANCER ───────────────────────────────────────────────────────── */}
      {!loading && sub === "enhancer" && (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
          <div style={card}>
            <div style={{ fontSize: 13, fontWeight: 700, color: "var(--gold)", marginBottom: 12 }}>⚡ Enhancer de Prompts IA</div>
            <div style={{ marginBottom: 12 }}>
              <span style={label}>TU PROMPT ORIGINAL</span>
              <textarea value={enhInput} onChange={e => setEnhInput(e.target.value)} placeholder="Escribe tu prompt aquí, aunque sea sencillo o en español…" style={{ ...inp, minHeight: 100 }} />
            </div>
            <div style={{ marginBottom: 14 }}>
              <span style={label}>MODO DE MEJORA</span>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                {([
                  ["enhance","⚡ Mejorar"],
                  ["rewrite","✍️ Reescribir"],
                  ["translate","🌐 Traducir"],
                  ["variations","🎲 Variaciones (x3)"],
                  ["negative","🚫 Negative Prompt"],
                ] as const).map(([id, lbl]) => (
                  <button key={id} onClick={() => setEnhMode(id as any)} style={{ ...btn(enhMode === id), fontSize: 10 }}>{lbl}</button>
                ))}
              </div>
            </div>
            {selectedStyle && (
              <div style={{ fontSize: 10, color: "var(--t3)", marginBottom: 12, background: "rgba(200,168,75,0.08)", padding: "6px 10px", borderRadius: 6 }}>
                🎨 Estilo activo: <strong style={gold}>{selectedStyle.name}</strong> — se aplicará automáticamente
              </div>
            )}
            <button onClick={enhancePrompt} disabled={enhancing || !enhInput.trim()} style={{ ...btn(false, true), width: "100%", opacity: enhancing ? 0.6 : 1 }}>
              {enhancing ? "⚡ Mejorando con IA…" : "⚡ Mejorar Prompt"}
            </button>
            <div style={{ marginTop: 14, fontSize: 10, color: "var(--t3)", lineHeight: 1.4 }}>
              <strong style={gold}>Modos explicados:</strong><br />
              ⚡ <strong>Mejorar</strong> — Amplía y enriquece el prompt original<br />
              ✍️ <strong>Reescribir</strong> — Reformula con fórmula OpenArt completa<br />
              🌐 <strong>Traducir</strong> — Convierte al inglés técnico perfecto<br />
              🎲 <strong>Variaciones</strong> — 3 versiones alternativas creativas<br />
              🚫 <strong>Negative</strong> — Genera el negative prompt óptimo
            </div>
          </div>
          <div style={card}>
            <div style={{ fontSize: 13, fontWeight: 700, color: "var(--gold)", marginBottom: 12 }}>✨ Resultado</div>
            {enhancing && <div style={{ textAlign: "center", padding: 40, color: "var(--t3)" }}>⚡ Mejorando con Claude…</div>}
            {enhResult ? (
              <>
                <div style={{ background: "rgba(255,255,255,0.04)", borderRadius: 8, padding: 12, fontSize: 11, color: "var(--t1)", lineHeight: 1.6, fontFamily: "monospace", whiteSpace: "pre-wrap", marginBottom: 10 }}>
                  {enhResult}
                </div>
                <button onClick={() => copyToClipboard(enhResult)} style={{ ...btn(false, true), width: "100%" }}>📋 Copiar Resultado</button>
              </>
            ) : !enhancing && (
              <div style={{ textAlign: "center", padding: 40, color: "var(--t3)", fontSize: 11 }}>
                El prompt mejorado aparecerá aquí
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── TEMPLATES ──────────────────────────────────────────────────────── */}
      {!loading && sub === "templates" && (
        <div>
          <div style={{ display: "flex", gap: 8, marginBottom: 14, flexWrap: "wrap" }}>
            <input value={tmplSearch} onChange={e => setTmplSearch(e.target.value)} placeholder="Buscar plantilla…" style={{ ...inp, flex: 1, minWidth: 160 }} />
            <select value={tmplCat} onChange={e => setTmplCat(e.target.value)} style={{ ...inp, width: "auto" }}>
              {tmplCategories.map(c => <option key={c} value={c}>{c === "all" ? "Todas" : c}</option>)}
            </select>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
            {/* Template list */}
            <div style={{ maxHeight: 600, overflowY: "auto" }}>
              {filteredTemplates.map(t => (
                <div key={t.id} onClick={() => { setSelectedTmpl(t); setTmplVars({}); setTmplResult(""); }}
                  style={{ ...card, marginBottom: 8, cursor: "pointer", border: selectedTmpl?.id === t.id ? "1px solid rgba(200,168,75,0.6)" : "1px solid var(--bdr)" }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                    <div style={{ fontSize: 12, fontWeight: 700, color: selectedTmpl?.id === t.id ? "var(--gold)" : "var(--t1)" }}>{t.name}</div>
                    <span style={{ fontSize: 9, background: "rgba(200,168,75,0.12)", color: "var(--gold)", padding: "1px 6px", borderRadius: 8 }}>{t.category}</span>
                  </div>
                  <div style={{ fontSize: 10, color: "var(--t3)", marginTop: 4, lineHeight: 1.3 }}>{t.prompt.slice(0, 80)}…</div>
                  {t.variables.length > 0 && (
                    <div style={{ display: "flex", gap: 4, marginTop: 6 }}>
                      {t.variables.map(v => <span key={v} style={{ fontSize: 8, background: "rgba(100,200,100,0.1)", color: "#4ade80", padding: "1px 5px", borderRadius: 8 }}>{v}</span>)}
                    </div>
                  )}
                </div>
              ))}
            </div>
            {/* Fill template */}
            <div>
              {selectedTmpl ? (
                <div style={card}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: "var(--gold)", marginBottom: 10 }}>{selectedTmpl.name}</div>
                  <div style={{ fontSize: 10, color: "var(--t3)", marginBottom: 12, fontFamily: "monospace", background: "rgba(255,255,255,0.04)", padding: 8, borderRadius: 6, lineHeight: 1.5 }}>
                    {selectedTmpl.prompt}
                  </div>
                  {selectedTmpl.variables.length > 0 && (
                    <div style={{ marginBottom: 12 }}>
                      <div style={{ fontSize: 11, fontWeight: 700, color: "var(--gold)", marginBottom: 8 }}>Rellena las variables:</div>
                      {selectedTmpl.variables.map(v => (
                        <div key={v} style={{ marginBottom: 8 }}>
                          <span style={label}>{v.toUpperCase()}</span>
                          <input value={tmplVars[v] || ""} onChange={e => setTmplVars(prev => ({ ...prev, [v]: e.target.value }))}
                            placeholder={`Escribe ${v}…`} style={inp} />
                        </div>
                      ))}
                    </div>
                  )}
                  <button onClick={fillTemplate} style={{ ...btn(false, true), width: "100%" }}>📋 Generar Prompt</button>
                  {tmplResult && (
                    <div style={{ marginTop: 12 }}>
                      <div style={{ background: "rgba(255,255,255,0.04)", borderRadius: 6, padding: 10, fontSize: 10, color: "var(--t1)", lineHeight: 1.5, fontFamily: "monospace" }}>
                        {tmplResult}
                      </div>
                      <button onClick={() => copyToClipboard(tmplResult)} style={{ ...btn(false, true), marginTop: 8, width: "100%" }}>📋 Copiar</button>
                    </div>
                  )}
                </div>
              ) : (
                <div style={{ ...card, textAlign: "center", padding: 40 }}>
                  <div style={{ fontSize: 40, marginBottom: 12 }}>📋</div>
                  <div style={{ color: "var(--t3)", fontSize: 12 }}>Selecciona una plantilla a la izquierda</div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── PROMPT BOOK ────────────────────────────────────────────────────── */}
      {!loading && sub === "book" && (
        <div style={{ display: "grid", gridTemplateColumns: "240px 1fr", gap: 16 }}>
          <div>
            <div style={{ fontSize: 12, fontWeight: 700, color: "var(--gold)", marginBottom: 10 }}>📖 Capítulos</div>
            {chapters.map(ch => (
              <div key={ch.id} onClick={() => setBookChapter(ch)}
                style={{ ...card, marginBottom: 8, cursor: "pointer", border: bookChapter?.id === ch.id ? "1px solid rgba(200,168,75,0.6)" : "1px solid var(--bdr)" }}>
                <div style={{ fontSize: 18, marginBottom: 4 }}>{ch.icon}</div>
                <div style={{ fontSize: 11, fontWeight: 700, color: bookChapter?.id === ch.id ? "var(--gold)" : "var(--t1)" }}>{ch.title}</div>
              </div>
            ))}
          </div>
          <div style={card}>
            {bookChapter ? (
              <>
                <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
                  <span style={{ fontSize: 28 }}>{bookChapter.icon}</span>
                  <div style={{ fontSize: 16, fontWeight: 800, color: "var(--gold)" }}>{bookChapter.title}</div>
                </div>
                <div style={{ fontSize: 12, color: "var(--t1)", lineHeight: 1.7, whiteSpace: "pre-wrap" }}
                  dangerouslySetInnerHTML={{ __html: bookChapter.content
                    .replace(/\*\*(.*?)\*\*/g, '<strong style="color:var(--gold)">$1</strong>')
                    .replace(/`([^`]+)`/g, '<code style="background:rgba(200,168,75,0.1);padding:1px 5px;border-radius:3px;font-size:10px;color:var(--gold)">$1</code>')
                    .replace(/\n/g, '<br />')
                  }} />
              </>
            ) : (
              <div style={{ textAlign: "center", padding: 60 }}>
                <div style={{ fontSize: 50, marginBottom: 16 }}>📖</div>
                <div style={{ fontSize: 14, color: "var(--gold)", fontWeight: 700, marginBottom: 8 }}>Libro de Prompts OpenArt</div>
                <div style={{ fontSize: 12, color: "var(--t3)" }}>Selecciona un capítulo para aprender técnicas profesionales de prompt engineering</div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── ANALYZER ───────────────────────────────────────────────────────── */}
      {!loading && sub === "analyzer" && (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
          <div style={card}>
            <div style={{ fontSize: 13, fontWeight: 700, color: "var(--gold)", marginBottom: 12 }}>🔬 Analizador de Prompts IA</div>
            <div style={{ marginBottom: 12 }}>
              <span style={label}>PROMPT A ANALIZAR</span>
              <textarea value={analyzeInput} onChange={e => setAnalyzeInput(e.target.value)} placeholder="Pega cualquier prompt para que la IA lo analice y te dé feedback…" style={{ ...inp, minHeight: 120 }} />
            </div>
            <button onClick={analyzePrompt} disabled={analyzing || !analyzeInput.trim()} style={{ ...btn(false, true), width: "100%", opacity: analyzing ? 0.6 : 1 }}>
              {analyzing ? "🔬 Analizando…" : "🔬 Analizar Prompt"}
            </button>
            <div style={{ marginTop: 12, fontSize: 10, color: "var(--t3)", lineHeight: 1.4 }}>
              El analizador evalúa: score de calidad, bloques detectados (sujeto/estilo/iluminación/ánimo), fortalezas, debilidades y sugerencias de mejora.
            </div>
          </div>
          <div>
            {analyzing && <div style={{ ...card, textAlign: "center", padding: 40, color: "var(--t3)" }}>🔬 Analizando con IA…</div>}
            {analyzeResult && (
              <div style={card}>
                <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
                  <div style={{ width: 64, height: 64, borderRadius: "50%", background: `conic-gradient(var(--gold) ${analyzeResult.score * 3.6}deg, rgba(255,255,255,0.1) 0)`, display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <div style={{ width: 50, height: 50, borderRadius: "50%", background: "var(--ink)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                      <span style={{ fontSize: 16, fontWeight: 800, color: analyzeResult.score >= 80 ? "#4ade80" : analyzeResult.score >= 60 ? "var(--gold)" : "#f87171" }}>{analyzeResult.score}</span>
                    </div>
                  </div>
                  <div>
                    <div style={{ fontSize: 16, fontWeight: 800, color: "var(--gold)" }}>Score: {analyzeResult.score}/100</div>
                    <div style={{ fontSize: 10, color: "var(--t3)" }}>{analyzeResult.score >= 80 ? "🟢 Prompt excelente" : analyzeResult.score >= 60 ? "🟡 Prompt mejorable" : "🔴 Prompt débil"}</div>
                  </div>
                </div>
                {/* Detected blocks */}
                <div style={{ marginBottom: 12 }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: "var(--gold)", marginBottom: 6 }}>Bloques detectados:</div>
                  {[["Sujeto", analyzeResult.subject], ["Estilo", analyzeResult.style], ["Iluminación", analyzeResult.lighting], ["Ánimo", analyzeResult.mood]].map(([k, v]) => (
                    <div key={k} style={{ display: "flex", gap: 8, marginBottom: 4, fontSize: 10 }}>
                      <span style={{ color: "var(--t3)", minWidth: 70 }}>{k}:</span>
                      <span style={{ color: v ? "#4ade80" : "#f87171" }}>{v || "❌ No detectado"}</span>
                    </div>
                  ))}
                </div>
                {analyzeResult.strengths?.length > 0 && (
                  <div style={{ marginBottom: 10 }}>
                    <div style={{ fontSize: 10, fontWeight: 700, color: "#4ade80", marginBottom: 4 }}>✅ Fortalezas:</div>
                    {analyzeResult.strengths.map((s: string) => <div key={s} style={{ fontSize: 10, color: "var(--t2)", marginBottom: 3 }}>• {s}</div>)}
                  </div>
                )}
                {analyzeResult.weaknesses?.length > 0 && (
                  <div style={{ marginBottom: 10 }}>
                    <div style={{ fontSize: 10, fontWeight: 700, color: "#f87171", marginBottom: 4 }}>⚠️ Debilidades:</div>
                    {analyzeResult.weaknesses.map((s: string) => <div key={s} style={{ fontSize: 10, color: "var(--t2)", marginBottom: 3 }}>• {s}</div>)}
                  </div>
                )}
                {analyzeResult.suggestions?.length > 0 && (
                  <div style={{ marginBottom: 10 }}>
                    <div style={{ fontSize: 10, fontWeight: 700, color: "var(--gold)", marginBottom: 4 }}>💡 Sugerencias:</div>
                    {analyzeResult.suggestions.map((s: string) => <div key={s} style={{ fontSize: 10, color: "var(--t2)", marginBottom: 3 }}>• {s}</div>)}
                  </div>
                )}
                {analyzeResult.missingBlocks?.length > 0 && (
                  <div>
                    <div style={{ fontSize: 10, fontWeight: 700, color: "#fb923c", marginBottom: 4 }}>🔸 Bloques faltantes:</div>
                    <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                      {analyzeResult.missingBlocks.map((b: string) => (
                        <span key={b} style={{ fontSize: 9, background: "rgba(251,146,60,0.12)", color: "#fb923c", padding: "2px 7px", borderRadius: 10 }}>{b}</span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
            {!analyzeResult && !analyzing && (
              <div style={{ ...card, textAlign: "center", padding: 40 }}>
                <div style={{ fontSize: 40, marginBottom: 12 }}>🔬</div>
                <div style={{ color: "var(--t3)", fontSize: 12 }}>El análisis detallado de tu prompt aparecerá aquí</div>
              </div>
            )}
          </div>
        </div>
      )}
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

// ─── TAB: PRO TOOLS (lip-sync · auto-subs · motion-transfer) ───
function ProToolsTab({ caps, projectId, sessionItems, onSuccess, onError }: { caps: Capabilities | null; projectId: number; sessionItems: VaultItem[]; onSuccess: (it: VaultItem) => void; onError: (m: string) => void }) {
  const [mode, setMode] = useState<"lipsync" | "subs" | "motion">("lipsync");
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
        <div style={{ marginTop: 14 }}>
          <LiveOperation
            active={busy}
            title={
              mode === "lipsync" ? "Sincronizando labios con audio (lip-sync)" :
              mode === "subs" ? "Quemando subtítulos en el video" :
              "Transfiriendo movimiento entre clips"
            }
            estimatedSec={
              mode === "lipsync" ? 180 :
              mode === "subs" ? 60 :
              240
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
              ] : [
                "Subiendo imagen base y video referencia…",
                "Extrayendo trayectoria de movimiento del clip…",
                "Aplicando movimiento sobre tu imagen — proceso muy pesado.",
                "Puede tardar 3 a 5 minutos según resolución.",
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

  const styles: CinematicStyle[] = caps?.cinematicMultiShot?.styles ?? [
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

  const avatars: AvatarEntry[] = caps?.avatarStudio?.avatars ?? [];
  const niches: string[] = caps?.avatarStudio?.niches ?? ["beauty", "health", "fashion", "tech", "food", "home", "fitness", "finance"];
  const filtered = avatars.filter(a => a.niche === niche);

  // auto-pick first avatar of niche
  useEffect(() => {
    if (filtered.length > 0 && !filtered.find(a => a.id === avatarId)) {
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
  | "landing_hero" | "brand_kit_ocr"
  | "podcast_script" | "video_testimonial" | "reels_story" | "brand_narrative" | "product_reveal";

const INTENT_LABELS: Record<PromptIntent, { label: string; emoji: string; visual: boolean }> = {
  image:               { label: "Imagen libre",                   emoji: "📸", visual: true  },
  video:               { label: "Vídeo libre",                    emoji: "🎬", visual: true  },
  image_hero_product:  { label: "Hero shot producto",             emoji: "✨", visual: true  },
  ad_cinematic:        { label: "Anuncio cinematográfico",        emoji: "🎥", visual: true  },
  multishot_director:  { label: "Anuncio largo (showrunner)",     emoji: "🎞️", visual: true  },
  ugc_video:           { label: "UGC creator",                    emoji: "📱", visual: true  },
  ad_copy_meta:        { label: "Copy Meta/TikTok",               emoji: "✍️", visual: false },
  infographic_html:    { label: "Infografía HTML",                emoji: "📊", visual: false },
  seo_product_100:     { label: "Descripción SEO 100/100",        emoji: "🔍", visual: false },
  email_marketing:     { label: "Email marketing",                emoji: "📧", visual: false },
  landing_hero:        { label: "Landing hero",                   emoji: "🚀", visual: false },
  brand_kit_ocr:       { label: "Brand kit OCR",                  emoji: "🎨", visual: false },
  podcast_script:      { label: "Guión Podcast / Narración",      emoji: "🎙️", visual: false },
  video_testimonial:   { label: "Testimonial / Review UGC",       emoji: "💬", visual: true  },
  reels_story:         { label: "Reels / Story 9:16",             emoji: "📲", visual: true  },
  brand_narrative:     { label: "Narrativa de Marca (storytelling)", emoji: "📖", visual: false },
  product_reveal:      { label: "Product Reveal / Unboxing",      emoji: "📦", visual: true  },
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
          <input value={brand} onChange={e => setBrand(e.target.value)} placeholder="Ej: Zara, Nike, Apple…" style={inputStyle} />
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
              <span style={{ fontSize: 10, padding: "2px 6px", borderRadius: 4, background: "rgba(200,168,75,0.15)", color: "var(--gold, #fbbf24)", fontWeight: 700 }}>6,132 templates</span>
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
// UploadConcatTab replaced by VideoStudio (professional multi-track editor)

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
    // Para plantillas sin producto físico (personal_brand) el presenter sirve de referencia visual
    if (requiresPhysicalProduct && !productFile) { onError("Sube una imagen del producto para renderizar"); return; }
    if (!requiresPhysicalProduct && !productFile && !presenterFile) { onError("Sube al menos una imagen de referencia (del presentador o del contexto)"); return; }
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
      // Para plantillas sin producto físico (personal_brand), usar presenterFile como referencia visual
      const productRef = productFile ?? (requiresPresenter ? presenterFile : null);
      if (productRef) fd.append("product", productRef);
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
                  {requiresPhysicalProduct
                    ? "Sube la imagen del producto y lanza la generación."
                    : "Sube una imagen de referencia (fondo, ambiente o contexto visual) — opcional si ya subiste la foto del presentador arriba."
                  }{" "}El motor usará el guion compuesto directamente (sin pasar por Claude para escribir prompts) y producirá un MP4 final guardado en la bóveda del proyecto.
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
                  disabled={rendering || (requiresPhysicalProduct && !productFile) || (!requiresPhysicalProduct && !productFile && !presenterFile) || (requiresPresenter && !presenterFile)}
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
