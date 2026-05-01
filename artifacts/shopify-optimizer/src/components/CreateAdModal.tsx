import { useEffect, useMemo, useRef, useState } from "react";
import { X, Wand2, Film, Shirt, Loader2, Volume2, CheckCircle2, AlertCircle, Download, RefreshCw, Upload, UserCircle2, Plus } from "lucide-react";

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
interface CharacterItem {
  id: number; name: string; gender?: string | null; ageRange?: string | null;
  identityDescription?: string | null;
  voiceId?: string | null; voiceGender?: string | null; voiceLanguage?: string | null;
  refMimeType?: string | null;
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
  // LONG-FORM: ad de 30s a 20min con director cinematográfico, paralelización y composición pro
  const [longForm, setLongForm] = useState(false);
  const [totalDurationSec, setTotalDurationSec] = useState(180); // 3 min default cuando longForm
  const [compositionMode, setCompositionMode] = useState<"narrative" | "explainer-locked" | "composite-pro">("narrative");
  // Progreso por escena (poll-friendly más adelante)
  const [sceneProgress, setSceneProgress] = useState<{ done: number; total: number } | null>(null);

  // Tryon
  const [tryonProvider, setTryonProvider] = useState<TryonProvider>("kling");
  const [effectStyle, setEffectStyle] = useState<EffectStyle>("natural_wear");
  const [tryonPremium, setTryonPremium] = useState(false);
  const [tryonWithVoice, setTryonWithVoice] = useState(false);
  const [tryonLipSync, setTryonLipSync] = useState(false);
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

  // Character Lock
  const [characters, setCharacters] = useState<CharacterItem[]>([]);
  const [charactersLoading, setCharactersLoading] = useState(false);
  const [characterId, setCharacterId] = useState<string>("");
  const [showCharCreate, setShowCharCreate] = useState(false);
  const [charForm, setCharForm] = useState<{
    name: string;
    gender: string;
    ageRange: string;
    identityDescription: string;
  }>({ name: "", gender: "female", ageRange: "", identityDescription: "" });
  const charRefImageRef = useRef<HTMLInputElement | null>(null);
  const [charRefFile, setCharRefFile] = useState<File | null>(null);
  const [charSaving, setCharSaving] = useState(false);
  const [charError, setCharError] = useState<string>("");

  // ── Load voices once ─────────────────────────────────────────────────────
  useEffect(() => {
    setVoicesLoading(true);
    fetch(`${API}/api/voice/voices`, { credentials: "include" })
      .then(r => r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`)))
      .then(data => setVoices(Array.isArray(data?.voices) ? data.voices.slice(0, 50) : []))
      .catch(() => setVoices([]))
      .finally(() => setVoicesLoading(false));
  }, []);

  // ── Load characters (Character Lock) ─────────────────────────────────────
  const reloadCharacters = () => {
    setCharactersLoading(true);
    fetch(`${API}/api/projects/${projectId}/characters`, { credentials: "include" })
      .then(r => r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`)))
      .then(data => {
        const list = Array.isArray(data?.characters)
          ? data.characters
          : Array.isArray(data?.items)
            ? data.items
            : [];
        setCharacters(list);
      })
      .catch(() => setCharacters([]))
      .finally(() => setCharactersLoading(false));
  };
  useEffect(() => { reloadCharacters(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [projectId]);

  // Sync gender + voice when character is chosen
  useEffect(() => {
    if (!characterId) return;
    const c = characters.find(c => String(c.id) === characterId);
    if (!c) return;
    if (c.gender === "female" || c.gender === "male") {
      setCharacterGender(c.gender);
    }
    if (c.voiceId) setVoiceId(c.voiceId);
    if (c.voiceGender === "female" || c.voiceGender === "male") {
      setVoiceGender(c.voiceGender as VoiceGender);
    }
  }, [characterId, characters]);

  const saveCharacter = async () => {
    if (!charForm.name.trim()) { setCharError("Pon un nombre al personaje"); return; }
    if (!charRefFile) { setCharError("Sube una foto de referencia"); return; }
    setCharSaving(true);
    setCharError("");
    try {
      const fd = new FormData();
      fd.append("refImage", charRefFile);
      fd.append("name", charForm.name.trim());
      if (charForm.gender) fd.append("gender", charForm.gender);
      if (charForm.ageRange.trim()) fd.append("ageRange", charForm.ageRange.trim());
      // Backend exige identityDescription. Si el usuario lo deja vacío,
      // generamos una descripción mínima coherente con el resto de campos.
      const idDescRaw = charForm.identityDescription.trim();
      const idDesc = idDescRaw.length > 0
        ? idDescRaw
        : `Modelo${charForm.gender ? ` ${charForm.gender === "male" ? "masculino" : charForm.gender === "female" ? "femenino" : "neutral"}` : ""}${charForm.ageRange.trim() ? ` de ${charForm.ageRange.trim()} años` : ""}, identidad capturada en la foto de referencia adjunta. Mantener mismos rasgos faciales, peinado, color y tono de piel en todas las generaciones.`;
      fd.append("identityDescription", idDesc);
      // Hereda la voz actual elegida en el modal (si la hay)
      if (voiceId) fd.append("voiceId", voiceId);
      if (voiceGender && voiceGender !== "auto") fd.append("voiceGender", voiceGender);
      if (language && language !== "auto") fd.append("voiceLanguage", language);
      const res = await fetch(`${API}/api/projects/${projectId}/characters`, {
        method: "POST", credentials: "include", body: fd,
      });
      const text = await res.text();
      let data: any; try { data = JSON.parse(text); } catch { data = { error: text.slice(0, 300) }; }
      if (!res.ok) throw new Error(data?.error || `Error ${res.status}`);
      const created: CharacterItem | null = data?.character || null;
      if (created) {
        setCharacters(prev => [created, ...prev]);
        setCharacterId(String(created.id));
      } else {
        reloadCharacters();
      }
      setCharForm({ name: "", gender: "female", ageRange: "", identityDescription: "" });
      setCharRefFile(null);
      setShowCharCreate(false);
    } catch (e: any) {
      setCharError(e?.message || "No se pudo guardar el personaje");
    } finally {
      setCharSaving(false);
    }
  };

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
        if (characterId) body.characterId = parseInt(characterId, 10);
        if (longForm) {
          body.totalDurationSec = totalDurationSec;
          body.compositionMode = compositionMode;
          body.longForm = true;
        }
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
    if (!modelFile && !characterId) {
      setError("Sube una imagen del modelo o elige un personaje guardado");
      return;
    }
    setSubmitting(true);
    setError("");
    setResult(null);
    const steps: string[] = [
      "1/4 · Fusionando modelo + producto…",
      "2/4 · Generando vídeo con " + tryonProvider + " (puede tardar 1-3 min)…",
    ];
    if (tryonWithVoice || tryonLipSync) steps.push("3/4 · Generando guión + voz…");
    if (tryonLipSync) steps.push("4/4 · Sincronizando labios (lip-sync)…");
    setProgress(steps[0]);
    // Rotación visual de pasos para feedback al usuario (UX)
    let stepIdx = 0;
    const stepTimer = setInterval(() => {
      stepIdx = Math.min(stepIdx + 1, steps.length - 1);
      setProgress(steps[stepIdx]);
    }, 25_000);
    try {
      const fd = new FormData();
      if (modelFile) fd.append("modelImage", modelFile);
      if (characterId) fd.append("characterId", characterId);
      fd.append("provider", tryonProvider);
      fd.append("effectStyle", effectStyle);
      fd.append("characterGender", characterGender);
      fd.append("language", language === "auto" ? "es" : language);
      fd.append("duration", String(duration));
      fd.append("aspect", aspect === "4:5" ? "9:16" : aspect);
      fd.append("premium", String(tryonPremium));
      // Talking-head profesional: voiceover + lip-sync
      fd.append("withVoiceover", String(tryonWithVoice || tryonLipSync));
      fd.append("applyLipSync", String(tryonLipSync));
      fd.append("voiceGender", voiceGender);
      if (voiceId) fd.append("voiceId", voiceId);
      if (ctaText) fd.append("ctaText", ctaText);
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
      clearInterval(stepTimer);
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

          {/* ── Character Lock — disponible en cinematic + tryon ── */}
          {(tab === "cinematic" || tab === "tryon") && (
            <div className="rounded-xl border-2 border-emerald-500/30 bg-emerald-500/5 p-4 space-y-3">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <UserCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                  <h4 className="text-sm font-bold text-foreground">Personaje (Character Lock)</h4>
                </div>
                <button
                  type="button"
                  onClick={() => { setShowCharCreate(s => !s); setCharError(""); }}
                  className="px-2.5 py-1 text-xs bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-300 rounded-md font-medium flex items-center gap-1">
                  <Plus className="w-3.5 h-3.5" />{showCharCreate ? "Cancelar" : "Crear nuevo"}
                </button>
              </div>
              <p className="text-xs text-muted-foreground">
                Bloquea la <strong>identidad visual</strong> del presentador/modelo entre generaciones (mismo rostro, peinado, voz). Opcional.
              </p>
              <div className="flex gap-2">
                <select
                  value={characterId}
                  onChange={e => setCharacterId(e.target.value)}
                  disabled={charactersLoading}
                  className="flex-1 bg-background border border-border rounded-lg px-3 py-2 text-sm">
                  <option value="">— Sin personaje (libre) —</option>
                  {characters.map(c => (
                    <option key={c.id} value={String(c.id)}>
                      {c.name}{c.gender ? ` · ${c.gender}` : ""}{c.ageRange ? ` · ${c.ageRange}` : ""}
                    </option>
                  ))}
                </select>
                {characterId && (
                  <img
                    src={`${API}/api/projects/${projectId}/characters/${characterId}/image`}
                    alt="ref"
                    className="w-10 h-10 rounded-lg object-cover border border-border" />
                )}
              </div>
              {showCharCreate && (
                <div className="space-y-2 pt-2 border-t border-emerald-500/20">
                  <div className="grid grid-cols-2 gap-2">
                    <input
                      type="text"
                      placeholder="Nombre (ej. Sofía)"
                      value={charForm.name}
                      onChange={e => setCharForm(f => ({ ...f, name: e.target.value }))}
                      className="bg-background border border-border rounded-lg px-3 py-2 text-sm" />
                    <select
                      value={charForm.gender}
                      onChange={e => setCharForm(f => ({ ...f, gender: e.target.value }))}
                      className="bg-background border border-border rounded-lg px-3 py-2 text-sm">
                      <option value="female">Mujer</option>
                      <option value="male">Hombre</option>
                      <option value="neutral">Neutral</option>
                    </select>
                  </div>
                  <input
                    type="text"
                    placeholder="Rango edad (ej. 25-30)"
                    value={charForm.ageRange}
                    onChange={e => setCharForm(f => ({ ...f, ageRange: e.target.value }))}
                    className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm" />
                  <textarea
                    rows={2}
                    placeholder="Descripción identidad (rasgos faciales, peinado, estilo). Opcional."
                    value={charForm.identityDescription}
                    onChange={e => setCharForm(f => ({ ...f, identityDescription: e.target.value }))}
                    className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm resize-none" />
                  <input
                    type="file"
                    accept="image/png,image/jpeg,image/webp"
                    className="hidden"
                    ref={charRefImageRef}
                    onChange={e => setCharRefFile(e.target.files?.[0] || null)} />
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => charRefImageRef.current?.click()}
                      className="flex-1 px-3 py-2 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-300 rounded-lg text-sm font-medium flex items-center justify-center gap-2">
                      <Upload className="w-4 h-4" />{charRefFile ? `${charRefFile.name.slice(0, 22)}…` : "Foto referencia"}
                    </button>
                    <button
                      type="button"
                      onClick={saveCharacter}
                      disabled={charSaving}
                      className="px-4 py-2 bg-emerald-500/30 hover:bg-emerald-500/40 text-emerald-100 rounded-lg text-sm font-bold disabled:opacity-40 flex items-center gap-2">
                      {charSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}Guardar
                    </button>
                  </div>
                  {charError && (
                    <p className="text-xs text-red-300">{charError}</p>
                  )}
                </div>
              )}
            </div>
          )}

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
                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-3 p-3 rounded-lg border border-dashed border-amber-500/30 bg-amber-500/5">
                    <label className="block">
                      <span className="text-xs font-semibold text-amber-300 mb-1 block">Escenas {longForm ? "(2-240)" : "(2-12)"}</span>
                      <input
                        type="number"
                        min={2}
                        max={longForm ? 240 : 12}
                        value={scenesCount}
                        onChange={e => setScenesCount(Math.max(2, Math.min(longForm ? 240 : 12, parseInt(e.target.value) || 5)))}
                        className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm"
                      />
                    </label>
                    <label className="block">
                      <span className="text-xs font-semibold text-amber-300 mb-1 block">Modelo de video</span>
                      <select value={videoModel} onChange={e => setVideoModel(e.target.value)} className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm">
                        <option value="kling-2.1">Kling 2.1 (1080p)</option>
                        <option value="kling-master">Kling Master (premium)</option>
                        <option value="seedance-pro">Seedance Pro</option>
                        <option value="seedance-fast">Seedance Fast (barato)</option>
                        <option value="runway-gen4-turbo">Runway Gen-4 Turbo</option>
                        <option value="hailuo-02">Hailuo 02 (rápido)</option>
                        <option value="veo-3-fast">Veo 3 Fast (audio nativo)</option>
                        <option value="wan-2.5-fast">Wan 2.5 (low-cost)</option>
                      </select>
                    </label>
                  </div>

                  {/* LONG-FORM: trailers, explainers, discursos, gameplay */}
                  <div className="rounded-xl border-2 border-purple-500/40 bg-purple-500/5 p-4 space-y-3">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input type="checkbox" checked={longForm} onChange={e => {
                        const v = e.target.checked;
                        setLongForm(v);
                        if (v) {
                          setScenesCount(Math.max(scenesCount, Math.ceil(totalDurationSec / 5)));
                        } else {
                          setScenesCount(Math.min(scenesCount, 8));
                        }
                      }} />
                      <span className="text-sm font-bold text-purple-300">🎬 Modo LONG-FORM (3-20 min)</span>
                    </label>
                    <p className="text-xs text-muted-foreground">
                      Para <strong>trailers</strong> de gameplay, <strong>explainers extensos</strong>, <strong>discursos de empresa</strong> o <strong>storytelling profesional</strong>. El director cinematográfico planifica un <strong>arco narrativo coherente</strong>, paraleliza la generación, mantiene el personaje y producto consistentes en todas las escenas y monta transiciones profesionales.
                    </p>
                    {longForm && (
                      <>
                        <div className="grid grid-cols-2 gap-3">
                          <label className="block">
                            <span className="text-xs font-semibold text-purple-200 mb-1 block">Duración total (segundos)</span>
                            <input
                              type="number"
                              min={30}
                              max={1200}
                              step={30}
                              value={totalDurationSec}
                              onChange={e => {
                                const v = Math.max(30, Math.min(1200, parseInt(e.target.value) || 180));
                                setTotalDurationSec(v);
                                setScenesCount(Math.max(2, Math.ceil(v / 5)));
                              }}
                              className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm"
                            />
                            <span className="text-[10px] text-muted-foreground">≈ {(totalDurationSec / 60).toFixed(1)} min · {scenesCount} escenas</span>
                          </label>
                          <label className="block">
                            <span className="text-xs font-semibold text-purple-200 mb-1 block">Composición</span>
                            <select value={compositionMode} onChange={e => setCompositionMode(e.target.value as any)} className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm">
                              <option value="narrative">Narrativa libre (cámara y escena cambian)</option>
                              <option value="explainer-locked">Explainer-locked (personaje fijo, fondo cambia)</option>
                              <option value="composite-pro">Composite-pro (capa modelo + capa fondo)</option>
                            </select>
                          </label>
                        </div>
                        <div className="grid grid-cols-3 gap-2 text-[10px]">
                          <div className="rounded p-2 bg-background/40 border border-border">
                            <strong className="text-purple-300">Narrativa</strong><br/>
                            Cinematográfico, cámaras varían, ideal trailers
                          </div>
                          <div className="rounded p-2 bg-background/40 border border-border">
                            <strong className="text-purple-300">Explainer-locked</strong><br/>
                            Modelo siempre visible al frente, fondo dinámico (deconstrucciones, infografías)
                          </div>
                          <div className="rounded p-2 bg-background/40 border border-border">
                            <strong className="text-purple-300">Composite-pro</strong><br/>
                            Dos capas separadas + chroma-key (máxima preservación de identidad)
                          </div>
                        </div>
                        <p className="text-[10px] text-amber-300 bg-amber-500/10 rounded p-2 border border-amber-500/20">
                          💡 Estimación: {(totalDurationSec / 60).toFixed(1)} min con {videoModel} ≈ ${(totalDurationSec * (videoModel.includes("master") ? 0.18 : videoModel.includes("seedance-fast") || videoModel.includes("hailuo") ? 0.05 : videoModel.includes("kling-2.1") ? 0.09 : 0.07)).toFixed(2)} en API providers · Tiempo wall-clock estimado: {Math.ceil(scenesCount / 5 * 1.5)}-{Math.ceil(scenesCount / 5 * 3)} min (5 clips en paralelo).
                        </p>
                      </>
                    )}
                  </div>
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

              {/* Talking-head: voiceover + lip-sync profesional */}
              <div className="rounded-xl border-2 border-pink-500/30 bg-pink-500/5 p-4 space-y-3">
                <div className="flex items-center gap-2">
                  <Volume2 className="w-4 h-4 text-pink-400" />
                  <h4 className="text-sm font-bold text-foreground">Talking-head profesional (opcional)</h4>
                </div>
                <p className="text-xs text-muted-foreground">
                  Activa para que el modelo del vídeo <strong>hable del producto</strong> con la voz inteligente.
                  Lip-sync sincroniza los labios con el audio (tarda 2-4 min extra, +costo).
                </p>
                <div className="grid grid-cols-2 gap-3">
                  <label htmlFor="tryon-with-voice" className="flex items-center gap-2 cursor-pointer p-2 rounded-lg hover:bg-white/5">
                    <input
                      id="tryon-with-voice"
                      type="checkbox"
                      checked={tryonWithVoice}
                      onChange={e => {
                        const v = e.target.checked;
                        setTryonWithVoice(v);
                        if (!v) setTryonLipSync(false);
                      }} />
                    <span className="text-sm">🎙️ Añadir voz hablando</span>
                  </label>
                  <label htmlFor="tryon-lip-sync" className="flex items-center gap-2 cursor-pointer p-2 rounded-lg hover:bg-white/5">
                    <input
                      id="tryon-lip-sync"
                      type="checkbox"
                      checked={tryonLipSync}
                      onChange={e => {
                        const v = e.target.checked;
                        setTryonLipSync(v);
                        // Auto-activa voz si no estaba activada (lip-sync requiere voz)
                        if (v && !tryonWithVoice) setTryonWithVoice(true);
                      }} />
                    <span className="text-sm">👄 Lip-sync (sincronizar labios)</span>
                  </label>
                </div>
                {(tryonWithVoice || tryonLipSync) && (
                  <input
                    type="text"
                    value={ctaText}
                    onChange={e => setCtaText(e.target.value)}
                    placeholder='CTA al final (opcional). Ej: "¡Pruébalo hoy!"'
                    className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm" />
                )}
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
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-green-300 text-sm font-medium">
                  <CheckCircle2 className="w-4 h-4" />Anuncio listo {result.vaultId ? `· bóveda #${result.vaultId}` : ""}
                </div>
                <div className="flex items-center gap-2 text-xs">
                  {result.meta?.fusedFromProduct && (
                    <span className="px-2 py-0.5 rounded bg-purple-500/20 text-purple-300">producto fusionado</span>
                  )}
                  {result.meta?.withVoiceover && (
                    <span className="px-2 py-0.5 rounded bg-pink-500/20 text-pink-300">🎙️ voz</span>
                  )}
                  {result.meta?.lipSyncApplied && (
                    <span className="px-2 py-0.5 rounded bg-amber-500/20 text-amber-300">👄 lip-sync</span>
                  )}
                </div>
              </div>
              {result.meta?.script && (
                <p className="text-xs italic text-muted-foreground">"{result.meta.script}"</p>
              )}
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
              disabled={submitting || (tab === "tryon" && !modelFile && !characterId)}
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
