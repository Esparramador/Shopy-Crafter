import { useEffect, useMemo, useRef, useState } from "react";
import { X, Wand2, Film, Shirt, Loader2, Volume2, CheckCircle2, AlertCircle, Download, RefreshCw, Upload } from "lucide-react";

const API = import.meta.env.BASE_URL.replace(/\/$/, "");

type TabKey = "quick" | "cinematic" | "tryon";
type Lang = "auto" | "es" | "en" | "fr" | "de" | "it" | "pt";
type VoiceGender = "auto" | "female" | "male" | "young";
type CharacterGender = "female" | "male" | "neutral";
type TryonProvider = "kling" | "hailuo" | "runway";
type EffectStyle = "natural_wear" | "magical_dress" | "multishot_outfit_change" | "lifestyle_use";

const SUPPORTED_LANGS: { code: Lang; label: string }[] = [
  { code: "auto", label: "Auto (detectar)" },
  { code: "es", label: "Español" },
  { code: "en", label: "English" },
  { code: "fr", label: "Français" },
  { code: "de", label: "Deutsch" },
  { code: "it", label: "Italiano" },
  { code: "pt", label: "Português" },
];

const VOICE_GENDERS: { value: VoiceGender; label: string }[] = [
  { value: "auto",   label: "Auto (recomendar)" },
  { value: "female", label: "Mujer" },
  { value: "male",   label: "Hombre" },
  { value: "young",  label: "Joven / Juvenil" },
];

const TRYON_EFFECTS: { value: EffectStyle; label: string; hint: string }[] = [
  { value: "natural_wear",            label: "Natural — pasarela",   hint: "Modelo orbita 360°, soft lighting" },
  { value: "magical_dress",           label: "Mágico — prenda al aire", hint: "La prenda vuela y se adhiere al cuerpo" },
  { value: "multishot_outfit_change", label: "Multi-toma cambio outfit", hint: "Cortes multi-ángulo (Kling Master)" },
  { value: "lifestyle_use",           label: "Lifestyle — usándolo",  hint: "Modelo usa el producto en escena real" },
];

interface VoiceOption { voice_id: string; name: string; labels?: { gender?: string; age?: string; description?: string } }
interface VoiceRecommendation {
  voiceId: string; voiceName: string; gender: string; age?: string;
  tone: string; reason: string; stability: number; style: number;
  characterGender: CharacterGender;
}

interface Props {
  projectId: number;
  productId: string;
  productTitle: string;
  onClose: () => void;
}

export default function CreateAdModal({ projectId, productId, productTitle, onClose }: Props) {
  const [tab, setTab] = useState<TabKey>("quick");
  const [language, setLanguage] = useState<Lang>("auto");
  const [voiceGender, setVoiceGender] = useState<VoiceGender>("auto");
  const [voiceId, setVoiceId] = useState<string>("");
  const [characterGender, setCharacterGender] = useState<CharacterGender>("female");
  const [ctaText, setCtaText] = useState("");
  const [duration, setDuration] = useState(6);
  const [aspect, setAspect] = useState<"9:16" | "16:9" | "1:1" | "4:5">("9:16");
  const [addMusic, setAddMusic] = useState(true);
  const [customNotes, setCustomNotes] = useState("");

  // Cinematic
  const [scenesCount, setScenesCount] = useState(5);
  const [videoModel, setVideoModel] = useState("kling-2.1");

  // Tryon
  const [tryonProvider, setTryonProvider] = useState<TryonProvider>("kling");
  const [effectStyle, setEffectStyle] = useState<EffectStyle>("natural_wear");
  const [tryonPremium, setTryonPremium] = useState(false);
  const modelImageRef = useRef<HTMLInputElement | null>(null);
  const [modelFile, setModelFile] = useState<File | null>(null);

  // Voice picker / preview
  const [voices, setVoices] = useState<VoiceOption[]>([]);
  const [voicesLoading, setVoicesLoading] = useState(false);
  const [recommendation, setRecommendation] = useState<VoiceRecommendation | null>(null);
  const [recoLoading, setRecoLoading] = useState(false);
  const [previewLoading, setPreviewLoading] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Submit state
  const [submitting, setSubmitting] = useState(false);
  const [progress, setProgress] = useState<string>("");
  const [error, setError] = useState<string>("");
  const [result, setResult] = useState<{ url?: string; vaultId?: number | null; meta?: any } | null>(null);

  // ── Load voices once ─────────────────────────────────────────────────────
  useEffect(() => {
    setVoicesLoading(true);
    fetch(`${API}/api/voice/voices`, { credentials: "include" })
      .then(r => r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`)))
      .then(data => setVoices(Array.isArray(data?.voices) ? data.voices.slice(0, 50) : []))
      .catch(() => setVoices([]))
      .finally(() => setVoicesLoading(false));
  }, []);

  // ── Auto-recommend voice when language/voiceGender changes ───────────────
  useEffect(() => {
    let cancelled = false;
    setRecoLoading(true);
    setError("");
    const params = new URLSearchParams({
      projectId: String(projectId),
      productId,
      language,
      gender: voiceGender,
      shortFormat: tab === "quick" ? "true" : "false",
    });
    fetch(`${API}/api/voice/recommend?${params}`, { credentials: "include" })
      .then(r => r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`)))
      .then(data => {
        if (cancelled) return;
        const reco: VoiceRecommendation | null = data?.recommendation || null;
        if (reco) {
          setRecommendation(reco);
          if (!voiceId) setVoiceId(reco.voiceId);
          // Coherence: derive characterGender from voice gender (hybrid)
          if (reco.characterGender) setCharacterGender(reco.characterGender);
        }
      })
      .catch(e => { if (!cancelled) setError(`No se pudo recomendar voz: ${e.message}`); })
      .finally(() => { if (!cancelled) setRecoLoading(false); });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId, productId, language, voiceGender, tab]);

  // ── Coherence: when user picks specific voice, sync characterGender ──────
  useEffect(() => {
    if (!voiceId) return;
    const v = voices.find(v => v.voice_id === voiceId);
    const g = (v?.labels?.gender || "").toLowerCase();
    if (g === "female") setCharacterGender("female");
    else if (g === "male") setCharacterGender("male");
  }, [voiceId, voices]);

  const previewVoice = async () => {
    if (!voiceId) return;
    setPreviewLoading(true);
    try {
      const sample = language === "en"
        ? "Discover the new collection. Quality and style for every moment."
        : language === "fr"
        ? "Découvrez la nouvelle collection. Qualité et style pour chaque instant."
        : "Descubre la nueva colección. Calidad y estilo para cada momento.";
      const res = await fetch(`${API}/api/voice/tts`, {
        method: "POST",
        credentials: "include",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          text: sample, voiceId,
          modelId: "eleven_turbo_v2_5", outputFormat: "mp3_44100_128",
          languageCode: language === "auto" ? "es" : language,
        }),
      });
      if (!res.ok) {
        let msg = `HTTP ${res.status}`;
        try { const j = await res.json(); if (j?.error) msg = j.error; } catch { /* ignore */ }
        throw new Error(msg);
      }
      const blob = await res.blob();
      const src = URL.createObjectURL(blob);
      if (audioRef.current) {
        audioRef.current.src = src;
        await audioRef.current.play();
      }
    } catch (e: any) {
      setError(`Preview falló: ${e?.message || "error"}`);
    } finally {
      setPreviewLoading(false);
    }
  };

  const grouped = useMemo(() => {
    const f = voices.filter(v => (v?.labels?.gender || "").toLowerCase() === "female");
    const m = voices.filter(v => (v?.labels?.gender || "").toLowerCase() === "male");
    const o = voices.filter(v => !["female","male"].includes((v?.labels?.gender || "").toLowerCase()));
    return { f, m, o };
  }, [voices]);

  const submitQuickOrCinematic = async () => {
    setSubmitting(true);
    setError("");
    setResult(null);
    setProgress(tab === "quick" ? "Generando anuncio rápido..." : "Generando anuncio cinematográfico (esto puede tardar 2-5 min)...");
    try {
      const endpoint = tab === "quick"
        ? `${API}/api/projects/${projectId}/products/${productId}/ads/smart-quick`
        : `${API}/api/projects/${projectId}/products/${productId}/ads/smart-cinematic`;
      const body: any = {
        language, voiceGender, voiceId: voiceId || undefined,
        characterGender, ctaText: ctaText || undefined,
        durationSec: duration, aspect, addMusic,
        customNotes: customNotes || undefined,
      };
      if (tab === "cinematic") {
        body.scenesCount = scenesCount;
        body.videoModel = videoModel;
      }
      const res = await fetch(endpoint, {
        method: "POST",
        credentials: "include",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      const text = await res.text();
      let data: any;
      try { data = JSON.parse(text); } catch { data = { error: text.slice(0, 300) }; }
      if (!res.ok) {
        throw new Error(data?.error || `Error ${res.status}`);
      }
      const videoUrl = data?.variant?.assets?.finalMp4Url
        || data?.variant?.assets?.videoUrl
        || data?.result?.finalVideoUrl
        || data?.result?.videoUrl;
      setResult({ url: videoUrl, vaultId: data?.variant?.vaultId ?? data?.result?.vaultId ?? null, meta: data });
      setProgress("¡Listo!");
    } catch (e: any) {
      setError(e?.message || "Error generando anuncio");
      setProgress("");
    } finally {
      setSubmitting(false);
    }
  };

  const submitTryon = async () => {
    if (!modelFile) {
      setError("Sube una imagen del modelo primero");
      return;
    }
    setSubmitting(true);
    setError("");
    setResult(null);
    setProgress(`Generando video try-on con ${tryonProvider}...`);
    try {
      const fd = new FormData();
      fd.append("modelImage", modelFile);
      fd.append("provider", tryonProvider);
      fd.append("effectStyle", effectStyle);
      fd.append("characterGender", characterGender);
      fd.append("language", language === "auto" ? "es" : language);
      fd.append("duration", String(duration));
      fd.append("aspect", aspect === "4:5" ? "9:16" : aspect);
      fd.append("premium", String(tryonPremium));
      if (customNotes) fd.append("customNotes", customNotes);

      const res = await fetch(
        `${API}/api/projects/${projectId}/products/${productId}/videos/tryon-video`,
        { method: "POST", credentials: "include", body: fd },
      );
      const text = await res.text();
      let data: any;
      try { data = JSON.parse(text); } catch { data = { error: text.slice(0, 300) }; }
      if (!res.ok) throw new Error(data?.error || `Error ${res.status}`);
      const tryonUrl = data?.videoUrl || data?.finalVideoUrl;
      setResult({ url: tryonUrl, vaultId: data?.vaultId ?? null, meta: data });
      setProgress("¡Listo!");
    } catch (e: any) {
      setError(e?.message || "Error generando try-on video");
      setProgress("");
    } finally {
      setSubmitting(false);
    }
  };

  const onSubmit = () => {
    if (tab === "tryon") submitTryon();
    else submitQuickOrCinematic();
  };

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-card border border-border rounded-2xl max-w-3xl w-full max-h-[92vh] overflow-y-auto shadow-2xl" onClick={e => e.stopPropagation()}>
        <div className="sticky top-0 bg-card border-b border-border p-5 flex items-center justify-between z-10">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center flex-shrink-0">
              <Film className="w-5 h-5 text-white" />
            </div>
            <div className="min-w-0">
              <h2 className="text-lg font-bold text-foreground truncate">Crear anuncio profesional</h2>
              <p className="text-xs text-muted-foreground truncate">{productTitle}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-white/5 rounded-lg flex-shrink-0">
            <X className="w-5 h-5 text-muted-foreground" />
          </button>
        </div>

        <div className="px-5 pt-4 flex gap-2 border-b border-border">
          {[
            { k: "quick" as TabKey,     label: "Rápido",         icon: Wand2 },
            { k: "cinematic" as TabKey, label: "Cinematográfico", icon: Film },
            { k: "tryon" as TabKey,     label: "Video Try-On",   icon: Shirt },
          ].map(t => {
            const Icon = t.icon;
            return (
              <button key={t.k}
                onClick={() => setTab(t.k)}
                className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 ${tab === t.k ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"}`}>
                <Icon className="w-4 h-4" />{t.label}
              </button>
            );
          })}
        </div>

        <div className="p-5 space-y-4">
          {/* ── Common: language + voice gender + voice picker ── */}
          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <span className="text-xs font-semibold text-muted-foreground mb-1 block">Idioma del voiceover</span>
              <select value={language} onChange={e => setLanguage(e.target.value as Lang)} className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm">
                {SUPPORTED_LANGS.map(l => <option key={l.code} value={l.code}>{l.label}</option>)}
              </select>
            </label>
            <label className="block">
              <span className="text-xs font-semibold text-muted-foreground mb-1 block">Género de la voz</span>
              <select value={voiceGender} onChange={e => { setVoiceGender(e.target.value as VoiceGender); setVoiceId(""); }} className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm">
                {VOICE_GENDERS.map(g => <option key={g.value} value={g.value}>{g.label}</option>)}
              </select>
            </label>
          </div>

          {/* Recommendation card + dropdown override */}
          <div className="rounded-xl border-2 border-purple-500/30 bg-purple-500/5 p-4 space-y-3">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 min-w-0">
                <Volume2 className="w-4 h-4 text-purple-400 flex-shrink-0" />
                <h4 className="text-sm font-bold text-foreground">Voz inteligente</h4>
              </div>
              {recoLoading && <Loader2 className="w-4 h-4 animate-spin text-purple-400" />}
            </div>
            {recommendation && (
              <div className="text-xs text-muted-foreground space-y-1">
                <p><strong className="text-foreground">{recommendation.voiceName}</strong> ({recommendation.gender}{recommendation.age ? `, ${recommendation.age}` : ""}) — tono <em>{recommendation.tone}</em></p>
                <p className="italic">"{recommendation.reason}"</p>
              </div>
            )}
            <div className="flex gap-2">
              <select
                value={voiceId}
                onChange={e => setVoiceId(e.target.value)}
                disabled={voicesLoading}
                className="flex-1 bg-background border border-border rounded-lg px-3 py-2 text-sm">
                <option value="">— Voz recomendada automáticamente —</option>
                {grouped.f.length > 0 && (
                  <optgroup label="Mujer">
                    {grouped.f.map(v => <option key={v.voice_id} value={v.voice_id}>{v.name}</option>)}
                  </optgroup>
                )}
                {grouped.m.length > 0 && (
                  <optgroup label="Hombre">
                    {grouped.m.map(v => <option key={v.voice_id} value={v.voice_id}>{v.name}</option>)}
                  </optgroup>
                )}
                {grouped.o.length > 0 && (
                  <optgroup label="Otras">
                    {grouped.o.map(v => <option key={v.voice_id} value={v.voice_id}>{v.name}</option>)}
                  </optgroup>
                )}
              </select>
              <button
                type="button"
                onClick={previewVoice}
                disabled={!voiceId || previewLoading}
                className="px-3 py-2 bg-purple-500/20 hover:bg-purple-500/30 text-purple-300 rounded-lg text-sm font-medium flex items-center gap-1 disabled:opacity-40">
                {previewLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Volume2 className="w-4 h-4" />}
                Probar
              </button>
            </div>
            <audio ref={audioRef} className="hidden" />
          </div>

          {/* Tab-specific fields */}
          {(tab === "quick" || tab === "cinematic") && (
            <>
              <label className="block">
                <span className="text-xs font-semibold text-muted-foreground mb-1 block">CTA al final (opcional)</span>
                <input type="text" value={ctaText} onChange={e => setCtaText(e.target.value)} placeholder='Ej: "¡Cómpralo ya con 20% off!"' className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm" />
              </label>
              <div className="grid grid-cols-3 gap-3">
                <label className="block">
                  <span className="text-xs font-semibold text-muted-foreground mb-1 block">Duración (seg)</span>
                  <input type="number" min={3} max={10} value={duration} onChange={e => setDuration(parseInt(e.target.value) || 6)} className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm" />
                </label>
                <label className="block">
                  <span className="text-xs font-semibold text-muted-foreground mb-1 block">Formato</span>
                  <select value={aspect} onChange={e => setAspect(e.target.value as any)} className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm">
                    <option value="9:16">9:16 vertical</option>
                    <option value="1:1">1:1 cuadrado</option>
                    <option value="4:5">4:5 feed</option>
                    <option value="16:9">16:9 horizontal</option>
                  </select>
                </label>
                <label className="flex items-end gap-2 pb-2">
                  <input type="checkbox" checked={addMusic} onChange={e => setAddMusic(e.target.checked)} />
                  <span className="text-sm">Música</span>
                </label>
              </div>
              {tab === "cinematic" && (
                <div className="grid grid-cols-2 gap-3 p-3 rounded-lg border border-dashed border-amber-500/30 bg-amber-500/5">
                  <label className="block">
                    <span className="text-xs font-semibold text-amber-300 mb-1 block">Escenas (3-8)</span>
                    <input type="number" min={3} max={8} value={scenesCount} onChange={e => setScenesCount(parseInt(e.target.value) || 5)} className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm" />
                  </label>
                  <label className="block">
                    <span className="text-xs font-semibold text-amber-300 mb-1 block">Modelo de video</span>
                    <select value={videoModel} onChange={e => setVideoModel(e.target.value)} className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm">
                      <option value="kling-2.1">Kling 2.1 (1080p)</option>
                      <option value="kling-master">Kling Master (premium)</option>
                      <option value="seedance-pro">Seedance Pro</option>
                      <option value="runway-gen4-turbo">Runway Gen-4 Turbo</option>
                      <option value="hailuo-02">Hailuo 02 (rápido)</option>
                    </select>
                  </label>
                </div>
              )}
            </>
          )}

          {tab === "tryon" && (
            <>
              <div className="grid grid-cols-2 gap-3">
                <label className="block">
                  <span className="text-xs font-semibold text-muted-foreground mb-1 block">Provider de video</span>
                  <select value={tryonProvider} onChange={e => setTryonProvider(e.target.value as TryonProvider)} className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm">
                    <option value="kling">Kling 2.1 / Master</option>
                    <option value="hailuo">Hailuo 02 (rápido)</option>
                    <option value="runway">Runway Gen-4 Turbo</option>
                  </select>
                </label>
                <label className="block">
                  <span className="text-xs font-semibold text-muted-foreground mb-1 block">Género del personaje</span>
                  <select value={characterGender} onChange={e => setCharacterGender(e.target.value as CharacterGender)} className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm">
                    <option value="female">Mujer</option>
                    <option value="male">Hombre</option>
                    <option value="neutral">Neutral</option>
                  </select>
                </label>
              </div>
              <label className="block">
                <span className="text-xs font-semibold text-muted-foreground mb-1 block">Estilo de efecto</span>
                <select value={effectStyle} onChange={e => setEffectStyle(e.target.value as EffectStyle)} className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm">
                  {TRYON_EFFECTS.map(e => <option key={e.value} value={e.value}>{e.label} — {e.hint}</option>)}
                </select>
              </label>
              <div className="grid grid-cols-3 gap-3">
                <label className="block">
                  <span className="text-xs font-semibold text-muted-foreground mb-1 block">Duración (seg)</span>
                  <input type="number" min={3} max={10} value={duration} onChange={e => setDuration(parseInt(e.target.value) || 5)} className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm" />
                </label>
                <label className="block">
                  <span className="text-xs font-semibold text-muted-foreground mb-1 block">Formato</span>
                  <select value={aspect} onChange={e => setAspect(e.target.value as any)} className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm">
                    <option value="9:16">9:16 vertical</option>
                    <option value="1:1">1:1 cuadrado</option>
                    <option value="16:9">16:9 horizontal</option>
                  </select>
                </label>
                <label className="flex items-end gap-2 pb-2">
                  <input type="checkbox" checked={tryonPremium} onChange={e => setTryonPremium(e.target.checked)} />
                  <span className="text-sm">Premium (calidad+)</span>
                </label>
              </div>
              <div className="border-2 border-dashed border-border rounded-lg p-4 text-center">
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  className="hidden"
                  ref={modelImageRef}
                  onChange={e => setModelFile(e.target.files?.[0] || null)} />
                <button type="button" onClick={() => modelImageRef.current?.click()} className="inline-flex items-center gap-2 px-4 py-2 bg-purple-500/10 hover:bg-purple-500/20 text-purple-300 rounded-lg text-sm font-medium">
                  <Upload className="w-4 h-4" />{modelFile ? "Cambiar imagen del modelo" : "Subir imagen del modelo"}
                </button>
                {modelFile && <p className="mt-2 text-xs text-muted-foreground truncate">{modelFile.name} — {(modelFile.size / 1024).toFixed(0)} KB</p>}
              </div>
            </>
          )}

          {/* Custom notes */}
          <label className="block">
            <span className="text-xs font-semibold text-muted-foreground mb-1 block">Notas creativas extra (opcional)</span>
            <textarea value={customNotes} onChange={e => setCustomNotes(e.target.value)} rows={2} placeholder="Ej: tono enérgico, paleta cálida, plano cenital, etc." className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm resize-none" />
          </label>

          {/* Status & result */}
          {error && (
            <div className="flex items-start gap-2 p-3 rounded-lg bg-red-500/10 border border-red-500/30 text-red-300 text-sm">
              <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" /><span>{error}</span>
            </div>
          )}
          {progress && !error && submitting && (
            <div className="flex items-center gap-2 p-3 rounded-lg bg-blue-500/10 border border-blue-500/30 text-blue-300 text-sm">
              <Loader2 className="w-4 h-4 animate-spin" /><span>{progress}</span>
            </div>
          )}
          {result && (
            <div className="p-3 rounded-lg bg-green-500/10 border border-green-500/30 space-y-2">
              <div className="flex items-center gap-2 text-green-300 text-sm font-medium">
                <CheckCircle2 className="w-4 h-4" />Anuncio listo {result.vaultId ? `· bóveda #${result.vaultId}` : ""}
              </div>
              {result.url && (
                <video src={result.url} controls className="w-full max-h-[300px] rounded-lg bg-black" />
              )}
              {result.url && (
                <a href={result.url} download={`anuncio-${productId}.mp4`} className="inline-flex items-center gap-2 px-3 py-1.5 bg-green-500/20 hover:bg-green-500/30 text-green-300 rounded-lg text-sm font-medium">
                  <Download className="w-4 h-4" />Descargar MP4
                </a>
              )}
            </div>
          )}

          <div className="flex gap-3 pt-2">
            <button onClick={onClose} className="flex-1 px-4 py-2.5 border border-border hover:bg-white/5 rounded-lg text-sm font-medium">
              Cerrar
            </button>
            <button
              onClick={onSubmit}
              disabled={submitting || (tab === "tryon" && !modelFile)}
              className="flex-[2] px-4 py-2.5 bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white rounded-lg text-sm font-bold disabled:opacity-50 flex items-center justify-center gap-2">
              {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
              {submitting ? "Generando..." : tab === "tryon" ? "Generar Video Try-On" : tab === "cinematic" ? "Crear Anuncio Cinematográfico" : "Crear Anuncio Rápido"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
