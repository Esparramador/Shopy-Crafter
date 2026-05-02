import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { useRoute } from "wouter";
import { Sparkles, Wand2, Video, Mic, Volume2, Music, Layers, Download, Loader2, Palette, Maximize2, X, CheckCircle2, AlertCircle, Film, UserSquare, Zap, RefreshCw, Copy } from "lucide-react";
import { LiveOperation } from "@/components/LiveOperation";

const API_BASE = import.meta.env.BASE_URL?.replace(/\/$/, "") ?? "";

type Tab = "generate" | "edit" | "background" | "enhance" | "video" | "multishot" | "uploadconcat" | "avatars" | "audio" | "compose" | "protools" | "promptlab" | "downloads";

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
  background: Array<{ key: string; label: string; description: string }>;
  audio: Array<{ key: string; label: string; description: string }>;
  composition: Array<{ key: string; label: string; description: string }>;
  voiceModels: Array<{ key: string; label: string; description: string }>;
  cameraPresets?: Array<{ key: string; label: string; description: string }>;
  transitionPresets?: Array<{ key: string; label: string; xfade: string; defaultDurationSec: number }>;
  pollopaParity?: Array<{ key: string; label: string; description: string }>;
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

const TABS: Array<{ id: Tab; label: string; icon: React.ReactNode; desc: string }> = [
  { id: "generate",   label: "Generar imagen",  icon: <Sparkles size={15} />, desc: "Flux, Recraft, Ideogram, Imagen 4, Nano Banana" },
  { id: "edit",       label: "Editar imagen",   icon: <Wand2 size={15} />,    desc: "Nano Banana, Flux Kontext, Runway Aleph" },
  { id: "background", label: "Fondo",           icon: <Layers size={15} />,   desc: "Quitar / reemplazar fondo profesional" },
  { id: "enhance",    label: "Mejorar",         icon: <Maximize2 size={15} />,desc: "Upscale 4K, mejora de caras, detalle creativo" },
  { id: "video",      label: "Video",           icon: <Video size={15} />,    desc: "Runway Gen-4, Kling, Seedance, Hailuo" },
  { id: "multishot",  label: "Multi-shot",      icon: <Film size={15} />,     desc: "Anuncios cinematográficos por escenas (orquestador propio sobre Seedance Pro / Kling / Veo)" },
  { id: "uploadconcat", label: "Concat propio", icon: <Film size={15} />,     desc: "Sube tus propios clips MP4 y los concatena con voz/música" },
  { id: "avatars",    label: "Avatares",        icon: <UserSquare size={15} />, desc: "Talking heads y product avatars por nicho" },
  { id: "audio",      label: "Voz & Música",    icon: <Mic size={15} />,      desc: "TTS, voice clone, SFX, música original" },
  { id: "compose",    label: "Componer",        icon: <Palette size={15} />,  desc: "Mezcla video + voz + música + texto en MP4" },
  { id: "protools",   label: "Pro tools",       icon: <Mic size={15} />,      desc: "Lip-sync, subtítulos auto, motion transfer" },
  { id: "promptlab",  label: "Prompt Lab",      icon: <Zap size={15} />,      desc: "Construye prompts cinematográficos estilo pollo.ai con presets" },
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
        {tab === "enhance"    && <EnhanceTab    projectId={projectId} onSuccess={(it) => { addItem(it); showToast("Imagen mejorada", true); }} onError={(m) => showToast(m, false)} />}
        {tab === "video"      && <VideoTab    caps={caps} health={health} projectId={projectId} onSuccess={(it) => { addItem(it); showToast("Video generado", true); }} onError={(m) => showToast(m, false)} onCreditError={() => refreshHealth(true)} />}
        {tab === "multishot"  && <MultiShotTab caps={caps} projectId={projectId} onSuccess={(it) => { addItem(it); showToast("Multi-shot listo", true); }} onError={(m) => showToast(m, false)} />}
        {tab === "uploadconcat" && <UploadConcatTab projectId={projectId} onSuccess={(it) => { addItem(it); showToast("Concat listo", true); }} onError={(m) => showToast(m, false)} />}
        {tab === "avatars"    && <AvatarsTab   caps={caps} projectId={projectId} onSuccess={(it) => { addItem(it); showToast("Avatar listo", true); }} onError={(m) => showToast(m, false)} />}
        {tab === "audio"      && <AudioTab    caps={caps} projectId={projectId} onSuccess={(it) => { addItem(it); showToast("Audio listo", true); }} onError={(m) => showToast(m, false)} onInfo={(m) => showToast(m, true)} />}
        {tab === "compose"    && <ComposeTab projectId={projectId} sessionItems={sessionItems} onSuccess={(it) => { addItem(it); showToast("Compose listo", true); }} onError={(m) => showToast(m, false)} />}
        {tab === "protools"   && <ProToolsTab caps={caps} projectId={projectId} sessionItems={sessionItems} onSuccess={(it) => { addItem(it); showToast("Listo", true); }} onError={(m) => showToast(m, false)} />}
        {tab === "promptlab"  && <PromptLabTab onInfo={(m) => showToast(m, true)} onError={(m) => showToast(m, false)} />}
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
                  .filter(m => /kling|seedance|hailuo|veo/i.test(m.key))
                  .map(m => (<option key={m.key} value={m.key}>{m.label} · €{m.costPerSec}/s</option>))}
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

// ─── TAB: PROMPT LAB (PRO PRESETS) ───────────────────────────────────────
type PromptCategory = "lens" | "lighting" | "palette" | "mood" | "composition" | "cameraMovement" | "style" | "apps" | "transitions";
type PromptCatalog = Record<PromptCategory, Array<{ key: string; label: string; description?: string; value?: string }>>;

function PromptLabTab({ onInfo, onError }: { onInfo: (m: string) => void; onError: (m: string) => void }) {
  const [catalog, setCatalog] = useState<PromptCatalog | null>(null);
  const [kind, setKind] = useState<"image" | "video">("image");
  const [subject, setSubject] = useState("");
  const [brand, setBrand] = useState("");
  const [picks, setPicks] = useState<Partial<Record<PromptCategory, string>>>({});
  const [busy, setBusy] = useState(false);
  const [output, setOutput] = useState<string>("");

  useEffect(() => {
    let cancelled = false;
    fetch(`${API_BASE}/api/fs-pro/prompt/catalog`, { credentials: "include" })
      .then(r => r.json())
      .then(d => { if (!cancelled && d?.catalog) setCatalog(d.catalog); })
      .catch(() => onError("No se pudo cargar el catálogo de prompts"));
    return () => { cancelled = true; };
  }, []);

  const build = async () => {
    if (subject.trim().length < 3) { onError("Describe el sujeto (mínimo 3 caracteres)"); return; }
    setBusy(true);
    try {
      const res = await fetch(`${API_BASE}/api/fs-pro/prompt/build`, {
        method: "POST", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind, subject: subject.trim(), brand: brand.trim() || undefined, picks }),
      });
      const d = await res.json();
      if (!res.ok) { onError(d.error || `Error ${res.status}`); return; }
      setOutput(d.prompt || "");
      onInfo("Prompt construido");
    } catch (e: any) {
      onError(e?.message || "Error de red");
    } finally { setBusy(false); }
  };

  const copy = async () => {
    if (!output) return;
    try { await navigator.clipboard.writeText(output); onInfo("Prompt copiado al portapapeles"); }
    catch { onError("No se pudo copiar"); }
  };

  const reset = () => { setPicks({}); setOutput(""); };

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

  const visibleCategories: PromptCategory[] = kind === "image"
    ? ["lens","lighting","palette","mood","composition","style","apps"]
    : ["lens","lighting","palette","mood","composition","cameraMovement","style","apps","transitions"];

  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
      <div>
        <Section title="Tipo">
          <div style={{ display: "flex", gap: 6 }}>
            <button onClick={() => setKind("image")} style={pillButton(kind === "image")}>📸 Imagen</button>
            <button onClick={() => setKind("video")} style={pillButton(kind === "video")}>🎬 Vídeo</button>
          </div>
        </Section>
        <Section title="Sujeto principal">
          <textarea
            value={subject}
            onChange={e => setSubject(e.target.value)}
            placeholder="reloj de oro sobre mármol negro / modelo joven con auriculares en azotea / botella de perfume premium en estudio…"
            style={{ ...inputStyle, minHeight: 80 }}
          />
        </Section>
        <Section title="Marca (opcional)">
          <input value={brand} onChange={e => setBrand(e.target.value)} placeholder="Ej: Hanakaze, Nike, Apple…" style={inputStyle} />
        </Section>
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
                    {it.label}{it.description ? ` · ${it.description}` : ""}
                  </option>
                ))}
              </select>
            </Section>
          );
        })}
        <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
          <button onClick={build} disabled={busy || subject.trim().length < 3} className="btn btn-gold" style={{ flex: 1, justifyContent: "center", padding: "12px 16px" }}>
            {busy ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} />} {busy ? "Construyendo…" : "Construir prompt PRO"}
          </button>
          <button onClick={reset} disabled={busy} className="btn" style={{ padding: "12px 16px" }}>
            <RefreshCw size={14} /> Reset
          </button>
        </div>
      </div>
      <div>
        <Section title="Prompt cinematográfico generado">
          <textarea
            value={output}
            readOnly
            placeholder="Tu prompt profesional aparecerá aquí. Cópialo y pégalo en la pestaña Generar / Editar / Vídeo."
            style={{ ...inputStyle, minHeight: 320, fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace", fontSize: 12, lineHeight: 1.5 }}
          />
        </Section>
        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={copy} disabled={!output} className="btn" style={{ flex: 1, justifyContent: "center", padding: "10px 14px" }}>
            <Copy size={14} /> Copiar prompt
          </button>
        </div>
        <div style={{ marginTop: 14, padding: "10px 14px", borderRadius: 8, background: "var(--ink2, #14141d)", border: "1px solid var(--bdr, #22222e)", fontSize: 11, color: "var(--t3, #6c6c7c)", lineHeight: 1.5 }}>
          <strong style={{ color: "var(--gold, #fbbf24)" }}>💡 Tip:</strong> combina <em>lente + iluminación + paleta + mood</em> para fotos editoriales.
          Para vídeo, añade <em>movimiento de cámara + transición</em>. Sin elecciones devuelve un baseline cinematográfico.
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
      const url = `${API_BASE}/api/projects/${projectId}/vault/${d.vaultId}/raw`;
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
