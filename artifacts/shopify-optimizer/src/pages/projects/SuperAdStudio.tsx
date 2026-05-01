/**
 * Super Ad Studio — wizard 5 pasos para generar anuncios cinemáticos 9:16:
 *  1. Brief (marca, producto, objetivo, duración, idioma, voz, # clips)
 *  2. Referencias (sube imágenes — i2v opcional, t2v si no hay)
 *  3. Storyboard (Claude propone, usuario edita prompts/duración/refs)
 *  4. Voz + Música (review guion + prompts musicales)
 *  5. Run + Progreso (polling cada 3s del job, log en vivo, descarga final)
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { useRoute, Link } from "wouter";

const API_BASE = import.meta.env.BASE_URL?.replace(/\/$/, "") ?? "";

interface RefAsset { refKey: string; vaultId: number; description?: string; previewUrl?: string }
interface ClipSpec {
  key: string;
  model: string;
  duration: number;
  aspect: "9:16" | "16:9" | "1:1";
  prompt: string;
  refVaultId?: number;
  refKey?: string;
}
interface Storyboard {
  brand: string; niche?: string; language: string;
  voiceId: string; voiceText: string; voiceModelId?: string;
  musicPrompts: { intro?: string; body?: string; single?: string };
  voiceVolume?: number; musicVolume?: number;
  width?: number; height?: number; fps?: number; crossfadeSec?: number;
  clips: ClipSpec[];
}
interface JobInfo {
  jobId: string;
  status: "pending" | "running" | "completed" | "failed";
  totalItems: number;
  completedItems: number;
  log: string[];
  result?: any;
}

const VIDEO_MODELS = [
  { id: "seedance-pro", label: "Seedance Pro (cinemático, calidad alta)" },
  { id: "kling-v2.1-master", label: "Kling 2.1 Master (estilo film)" },
  { id: "kling-v2.0", label: "Kling 2.0 (rápido)" },
  { id: "hailuo-02", label: "Hailuo 02 (movimiento natural)" },
  { id: "luma-ray-flash-2", label: "Luma Ray Flash (rápido)" },
  { id: "runway-gen4", label: "Runway Gen-4 (premium)" },
  { id: "veo-3-fast", label: "Veo 3 Fast (Google, audio incluido)" },
];
const VOICE_MODELS = [
  { id: "eleven_multilingual_v2", label: "Multilingual v2 (estable, 30+ idiomas)" },
  { id: "eleven_v3", label: "v3 (más expresivo, beta)" },
  { id: "eleven_turbo_v2_5", label: "Turbo v2.5 (rápido)" },
  { id: "eleven_flash_v2_5", label: "Flash v2.5 (ultra rápido)" },
];

export default function SuperAdStudio() {
  const [, params] = useRoute("/projects/:id/super-ad");
  const projectId = params?.id ? parseInt(params.id, 10) : 0;
  const [step, setStep] = useState(1);

  // Step 1 — Brief
  const [brand, setBrand] = useState("");
  const [niche, setNiche] = useState("");
  const [productDescription, setProductDescription] = useState("");
  const [objective, setObjective] = useState("Awareness + tráfico web");
  const [language, setLanguage] = useState("es");
  const [voiceId, setVoiceId] = useState("21m00Tcm4TlvDq8ikWAM");
  const [voiceModelId, setVoiceModelId] = useState("eleven_multilingual_v2");
  const [totalDurationSec, setTotalDurationSec] = useState(75);
  const [clipCount, setClipCount] = useState(12);
  const [aspect, setAspect] = useState<"9:16" | "16:9" | "1:1">("9:16");
  const [brandTone, setBrandTone] = useState("");

  // Step 2 — Referencias
  const [refs, setRefs] = useState<RefAsset[]>([]);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Step 3/4 — Storyboard editable
  const [storyboard, setStoryboard] = useState<Storyboard | null>(null);
  const [generatingStoryboard, setGeneratingStoryboard] = useState(false);
  const [storyboardError, setStoryboardError] = useState<string | null>(null);

  // Step 5 — Job
  const [job, setJob] = useState<JobInfo | null>(null);
  const [running, setRunning] = useState(false);
  const [previousJobs, setPreviousJobs] = useState<any[]>([]);

  // Cargar voces ElevenLabs disponibles del proyecto
  const [voices, setVoices] = useState<Array<{ voice_id: string; name: string; labels?: any }>>([]);
  useEffect(() => {
    fetch(`${API_BASE}/api/ad-studio/voices`, { credentials: "include" })
      .then(r => r.ok ? r.json() : { voices: [] })
      .then(d => setVoices(d.voices || []))
      .catch(() => {});
  }, []);

  // Cargar historial de jobs
  useEffect(() => {
    if (!projectId) return;
    fetch(`${API_BASE}/api/super-ad/jobs?projectId=${projectId}`, { credentials: "include" })
      .then(r => r.ok ? r.json() : { jobs: [] })
      .then(d => setPreviousJobs(d.jobs || []))
      .catch(() => {});
  }, [projectId, job?.status]);

  // Polling job en vivo (con inflight guard para evitar solapamientos si el API tarda)
  useEffect(() => {
    if (!job || !["pending", "running"].includes(job.status)) return;
    let inflight = false;
    let cancelled = false;
    const t = setInterval(async () => {
      if (inflight || cancelled) return;
      inflight = true;
      try {
        const r = await fetch(`${API_BASE}/api/super-ad/jobs/${job.jobId}`, { credentials: "include" });
        if (!r.ok || cancelled) return;
        const d = await r.json();
        if (cancelled) return;
        setJob({
          jobId: d.jobId, status: d.status,
          totalItems: d.totalItems, completedItems: d.completedItems,
          log: d.log || [], result: d.result,
        });
      } catch {} finally { inflight = false; }
    }, 3000);
    return () => { cancelled = true; clearInterval(t); };
  }, [job?.jobId, job?.status]);

  // Cleanup ObjectURLs al desmontar/cambiar refs
  useEffect(() => {
    return () => {
      refs.forEach(r => { if (r.previewUrl) URL.revokeObjectURL(r.previewUrl); });
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleUploadRef(file: File) {
    if (!projectId) return;
    setUploading(true);
    try {
      const refKey = `ref-${refs.length + 1}-${file.name.replace(/\W/g, "_").slice(0, 20)}`;
      const fd = new FormData();
      fd.append("file", file);
      fd.append("projectId", String(projectId));
      fd.append("refKey", refKey);
      const r = await fetch(`${API_BASE}/api/super-ad/upload-ref`, { method: "POST", credentials: "include", body: fd });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const d = await r.json();
      const previewUrl = URL.createObjectURL(file);
      setRefs(prev => [...prev, { refKey: d.refKey, vaultId: d.vaultId, previewUrl }]);
    } catch (err: any) {
      alert(`Error subiendo: ${err?.message || err}`);
    } finally {
      setUploading(false);
    }
  }

  async function generateStoryboard() {
    if (!projectId || !brand || !productDescription) {
      alert("Marca y descripción del producto son obligatorios");
      return;
    }
    setGeneratingStoryboard(true);
    setStoryboardError(null);
    try {
      const r = await fetch(`${API_BASE}/api/super-ad/storyboard`, {
        method: "POST",
        credentials: "include",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          projectId, brand, niche, productDescription, objective,
          language, totalDurationSec, clipCount, aspect,
          refs: refs.map(r => ({ refKey: r.refKey, vaultId: r.vaultId, description: r.description })),
          voiceId, brandTone,
        }),
      });
      if (!r.ok) throw new Error((await r.json()).error || `HTTP ${r.status}`);
      const d = await r.json();
      // Normaliza: añade refKey legible para edición visual
      const sb: Storyboard = d.storyboard;
      const refMap = new Map(refs.map(rr => [rr.vaultId, rr.refKey]));
      sb.clips = sb.clips.map(c => ({ ...c, refKey: c.refVaultId ? refMap.get(c.refVaultId) : undefined }));
      setStoryboard(sb);
      setStep(3);
    } catch (err: any) {
      setStoryboardError(err?.message || String(err));
    } finally {
      setGeneratingStoryboard(false);
    }
  }

  async function runJob() {
    if (!storyboard || !projectId) return;
    setRunning(true);
    try {
      const sbToSend = { ...storyboard, clips: storyboard.clips.map(c => ({ ...c, refKey: undefined })) };
      const r = await fetch(`${API_BASE}/api/super-ad/run`, {
        method: "POST",
        credentials: "include",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ projectId, storyboard: sbToSend }),
      });
      if (!r.ok) throw new Error((await r.json()).error || `HTTP ${r.status}`);
      const d = await r.json();
      setJob({ jobId: d.jobId, status: "pending", totalItems: d.totalSteps, completedItems: 0, log: [] });
      setStep(5);
    } catch (err: any) {
      alert(`Error arrancando job: ${err?.message || err}`);
    } finally {
      setRunning(false);
    }
  }

  function updateClip(idx: number, patch: Partial<ClipSpec>) {
    if (!storyboard) return;
    const clips = [...storyboard.clips];
    clips[idx] = { ...clips[idx], ...patch };
    if (patch.refKey !== undefined) {
      const ref = refs.find(r => r.refKey === patch.refKey);
      clips[idx].refVaultId = ref?.vaultId;
    }
    setStoryboard({ ...storyboard, clips });
  }

  function removeClip(idx: number) {
    if (!storyboard) return;
    setStoryboard({ ...storyboard, clips: storyboard.clips.filter((_, i) => i !== idx) });
  }

  function addClip() {
    if (!storyboard) return;
    setStoryboard({
      ...storyboard,
      clips: [...storyboard.clips, {
        key: `c-extra-${Date.now()}`, model: "seedance-pro", duration: 5, aspect,
        prompt: "Cinematic 9:16 close-up shot, professional lighting, high quality",
      }],
    });
  }

  const totalSb = useMemo(() => storyboard?.clips.reduce((a, c) => a + c.duration, 0) || 0, [storyboard]);
  const finalVaultId = job?.result?.finalVaultId;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-purple-950/40 to-slate-950 text-white p-6">
      <div className="max-w-6xl mx-auto">
        <header className="mb-6">
          <h1 className="text-3xl font-bold flex items-center gap-3">
            🎬 Super Ad Studio
            <span className="text-xs px-2 py-1 rounded-full bg-purple-600/40 border border-purple-400">Beta</span>
          </h1>
          <p className="text-slate-400 mt-1">Anuncios cinemáticos 9:16 con N clips video + voz + música, end-to-end.</p>
        </header>

        {/* STEP TABS */}
        <nav className="flex gap-2 mb-8 overflow-x-auto">
          {[
            { n: 1, l: "Brief" }, { n: 2, l: "Referencias" }, { n: 3, l: "Storyboard" },
            { n: 4, l: "Voz + Música" }, { n: 5, l: "Generar" },
          ].map(s => (
            <button
              key={s.n}
              onClick={() => setStep(s.n)}
              disabled={s.n > 2 && !storyboard && s.n !== 2 && s.n !== 1}
              className={`px-4 py-2 rounded-lg text-sm whitespace-nowrap transition ${
                step === s.n ? "bg-purple-600 text-white" : "bg-slate-800/60 text-slate-400 hover:bg-slate-700"
              } disabled:opacity-30 disabled:cursor-not-allowed`}
            >
              {s.n}. {s.l}
            </button>
          ))}
        </nav>

        {/* STEP 1: BRIEF */}
        {step === 1 && (
          <section className="bg-slate-900/60 border border-slate-700 rounded-xl p-6 space-y-4">
            <h2 className="text-xl font-semibold mb-3">1️⃣ Brief de la campaña</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Field label="Marca *">
                <input value={brand} onChange={e => setBrand(e.target.value)} className={INP} placeholder="Ej. Hanakaze" />
              </Field>
              <Field label="Nicho">
                <input value={niche} onChange={e => setNiche(e.target.value)} className={INP} placeholder="Ej. fashion, beauty, tech" />
              </Field>
              <Field label="Producto / Colección *" full>
                <textarea value={productDescription} onChange={e => setProductDescription(e.target.value)}
                  rows={3} className={INP} placeholder="Describe brevemente el producto, materiales, USP, target..." />
              </Field>
              <Field label="Objetivo del anuncio">
                <input value={objective} onChange={e => setObjective(e.target.value)} className={INP} />
              </Field>
              <Field label="Tono de marca">
                <input value={brandTone} onChange={e => setBrandTone(e.target.value)} className={INP}
                  placeholder="Ej. lujo, casual, irreverente, técnico" />
              </Field>
              <Field label="Idioma voz">
                <select value={language} onChange={e => setLanguage(e.target.value)} className={INP}>
                  <option value="es">Español</option><option value="en">English</option>
                  <option value="pt">Portugués</option><option value="fr">Francés</option>
                  <option value="de">Alemán</option><option value="it">Italiano</option>
                </select>
              </Field>
              <Field label="Aspect">
                <select value={aspect} onChange={e => setAspect(e.target.value as any)} className={INP}>
                  <option value="9:16">9:16 (vertical / Reels)</option>
                  <option value="16:9">16:9 (horizontal / YouTube)</option>
                  <option value="1:1">1:1 (cuadrado / feed)</option>
                </select>
              </Field>
              <Field label="Duración total (s)">
                <input type="number" min={15} max={180} value={totalDurationSec}
                  onChange={e => setTotalDurationSec(parseInt(e.target.value || "75", 10))} className={INP} />
              </Field>
              <Field label="Número de clips">
                <input type="number" min={3} max={15} value={clipCount}
                  onChange={e => setClipCount(parseInt(e.target.value || "12", 10))} className={INP} />
              </Field>
              <Field label="Voz (ElevenLabs)">
                <select value={voiceId} onChange={e => setVoiceId(e.target.value)} className={INP}>
                  <option value="21m00Tcm4TlvDq8ikWAM">Rachel (default)</option>
                  {voices.map(v => <option key={v.voice_id} value={v.voice_id}>{v.name}</option>)}
                </select>
              </Field>
              <Field label="Modelo TTS">
                <select value={voiceModelId} onChange={e => setVoiceModelId(e.target.value)} className={INP}>
                  {VOICE_MODELS.map(m => <option key={m.id} value={m.id}>{m.label}</option>)}
                </select>
              </Field>
            </div>
            <div className="flex justify-end pt-4">
              <button onClick={() => setStep(2)} className={BTN_PRIMARY} disabled={!brand || !productDescription}>
                Siguiente: Referencias →
              </button>
            </div>
          </section>
        )}

        {/* STEP 2: REFERENCIAS */}
        {step === 2 && (
          <section className="bg-slate-900/60 border border-slate-700 rounded-xl p-6 space-y-4">
            <h2 className="text-xl font-semibold">2️⃣ Referencias visuales (opcional)</h2>
            <p className="text-sm text-slate-400">
              Sube fotos de producto/modelos/escenas para usar <strong>image-to-video</strong> en clips específicos.
              Si no subes nada, se usará text-to-video puro. <strong>Recomendado: 3-8 imágenes</strong> de tu producto en distintos ángulos.
            </p>
            <div
              onDragOver={e => e.preventDefault()}
              onDrop={async e => {
                e.preventDefault();
                const files = Array.from(e.dataTransfer.files).filter(f => f.type.startsWith("image/"));
                for (const f of files) await handleUploadRef(f);
              }}
              className="border-2 border-dashed border-slate-600 rounded-xl p-10 text-center hover:border-purple-500 transition cursor-pointer"
              onClick={() => fileInputRef.current?.click()}
            >
              <input ref={fileInputRef} type="file" accept="image/*" multiple className="hidden"
                onChange={async e => {
                  const files = Array.from(e.target.files || []);
                  for (const f of files) await handleUploadRef(f);
                  if (fileInputRef.current) fileInputRef.current.value = "";
                }} />
              <p className="text-3xl mb-2">📤</p>
              <p>{uploading ? "Subiendo..." : "Arrastra imágenes aquí o haz click"}</p>
            </div>
            {refs.length > 0 && (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {refs.map((r, i) => (
                  <div key={r.vaultId} className="bg-slate-800/60 border border-slate-700 rounded-lg p-2 text-xs">
                    {r.previewUrl && <img src={r.previewUrl} alt="" className="w-full h-32 object-cover rounded mb-2" />}
                    <p className="font-mono text-purple-300 truncate">{r.refKey}</p>
                    <input
                      placeholder="Descripción opcional..."
                      value={r.description || ""}
                      onChange={e => {
                        const upd = [...refs]; upd[i] = { ...upd[i], description: e.target.value };
                        setRefs(upd);
                      }}
                      className="w-full mt-1 px-2 py-1 bg-slate-900 border border-slate-700 rounded text-xs"
                    />
                  </div>
                ))}
              </div>
            )}
            <div className="flex justify-between pt-4">
              <button onClick={() => setStep(1)} className={BTN_SECONDARY}>← Atrás</button>
              <button onClick={generateStoryboard} disabled={generatingStoryboard} className={BTN_PRIMARY}>
                {generatingStoryboard ? "Claude generando storyboard..." : "Generar storyboard con IA →"}
              </button>
            </div>
            {storyboardError && <p className="text-red-400 text-sm mt-2">⚠ {storyboardError}</p>}
          </section>
        )}

        {/* STEP 3: STORYBOARD EDITABLE */}
        {step === 3 && storyboard && (
          <section className="bg-slate-900/60 border border-slate-700 rounded-xl p-6 space-y-4">
            <div className="flex justify-between items-center">
              <h2 className="text-xl font-semibold">3️⃣ Storyboard ({storyboard.clips.length} clips · {totalSb}s totales)</h2>
              <button onClick={addClip} className={BTN_SECONDARY}>+ Añadir clip</button>
            </div>
            <div className="space-y-3">
              {storyboard.clips.map((c, i) => (
                <div key={c.key + i} className="bg-slate-800/60 border border-slate-700 rounded-lg p-4">
                  <div className="flex gap-3 mb-2 items-center">
                    <span className="font-mono text-xs bg-purple-600/40 px-2 py-1 rounded">#{i + 1}</span>
                    <input value={c.key} onChange={e => updateClip(i, { key: e.target.value })}
                      className={`${INP} max-w-xs text-xs`} />
                    <select value={c.model} onChange={e => updateClip(i, { model: e.target.value })} className={`${INP} text-xs`}>
                      {VIDEO_MODELS.map(m => <option key={m.id} value={m.id}>{m.label}</option>)}
                    </select>
                    <input type="number" min={2} max={10} value={c.duration}
                      onChange={e => updateClip(i, { duration: parseInt(e.target.value || "5", 10) })}
                      className={`${INP} max-w-[80px] text-xs`} />
                    <span className="text-xs text-slate-400">s</span>
                    <select value={c.refKey || ""} onChange={e => updateClip(i, { refKey: e.target.value || undefined })}
                      className={`${INP} text-xs`}>
                      <option value="">— sin ref (t2v) —</option>
                      {refs.map(r => <option key={r.refKey} value={r.refKey}>🖼 {r.refKey}</option>)}
                    </select>
                    <button onClick={() => removeClip(i)} className="text-red-400 hover:text-red-300 px-2">🗑</button>
                  </div>
                  <textarea value={c.prompt} onChange={e => updateClip(i, { prompt: e.target.value })}
                    rows={3} className={`${INP} text-xs font-mono`}
                    placeholder="Prompt cinemático en INGLÉS (60+ palabras: encuadre, modelo, ropa, luz, estilo)" />
                </div>
              ))}
            </div>
            <div className="flex justify-between pt-4">
              <button onClick={() => setStep(2)} className={BTN_SECONDARY}>← Atrás</button>
              <button onClick={() => setStep(4)} className={BTN_PRIMARY}>Siguiente: Voz + Música →</button>
            </div>
          </section>
        )}

        {/* STEP 4: VOZ + MÚSICA */}
        {step === 4 && storyboard && (
          <section className="bg-slate-900/60 border border-slate-700 rounded-xl p-6 space-y-4">
            <h2 className="text-xl font-semibold">4️⃣ Voz off + Música</h2>
            <Field label={`Guion completo (voz off — ${storyboard.voiceText.length} chars)`} full>
              <textarea value={storyboard.voiceText}
                onChange={e => setStoryboard({ ...storyboard, voiceText: e.target.value })}
                rows={8} className={`${INP} text-sm`} />
            </Field>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Field label="Música — INTRO prompt (inglés)">
                <textarea value={storyboard.musicPrompts.intro || ""}
                  onChange={e => setStoryboard({ ...storyboard, musicPrompts: { ...storyboard.musicPrompts, intro: e.target.value } })}
                  rows={3} className={`${INP} text-xs`} placeholder="Cinematic ambient with soft piano, 60 BPM..." />
              </Field>
              <Field label="Música — BODY prompt (inglés)">
                <textarea value={storyboard.musicPrompts.body || ""}
                  onChange={e => setStoryboard({ ...storyboard, musicPrompts: { ...storyboard.musicPrompts, body: e.target.value } })}
                  rows={3} className={`${INP} text-xs`} placeholder="Uplifting electronic with drums, 110 BPM..." />
              </Field>
              <Field label="O bien: música SINGLE (sin intro/body)">
                <textarea value={storyboard.musicPrompts.single || ""}
                  onChange={e => setStoryboard({ ...storyboard, musicPrompts: { ...storyboard.musicPrompts, single: e.target.value, intro: undefined, body: undefined } })}
                  rows={2} className={`${INP} text-xs`} placeholder="Si rellenas esto, ignora intro+body" />
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Vol voz (0-1)">
                  <input type="number" step="0.05" min="0" max="2" value={storyboard.voiceVolume ?? 1.0}
                    onChange={e => setStoryboard({ ...storyboard, voiceVolume: parseFloat(e.target.value) })} className={INP} />
                </Field>
                <Field label="Vol música (0-1)">
                  <input type="number" step="0.02" min="0" max="1" value={storyboard.musicVolume ?? 0.18}
                    onChange={e => setStoryboard({ ...storyboard, musicVolume: parseFloat(e.target.value) })} className={INP} />
                </Field>
              </div>
            </div>
            <div className="flex justify-between pt-4">
              <button onClick={() => setStep(3)} className={BTN_SECONDARY}>← Atrás</button>
              <button onClick={runJob} disabled={running} className={BTN_PRIMARY + " bg-gradient-to-r from-purple-600 to-pink-600"}>
                {running ? "Arrancando..." : "🚀 GENERAR ANUNCIO →"}
              </button>
            </div>
          </section>
        )}

        {/* STEP 5: PROGRESO */}
        {step === 5 && job && (
          <section className="bg-slate-900/60 border border-slate-700 rounded-xl p-6 space-y-4">
            <h2 className="text-xl font-semibold flex items-center gap-3">
              5️⃣ Generación en curso
              <span className={`text-xs px-2 py-1 rounded ${
                job.status === "completed" ? "bg-green-600" :
                job.status === "failed" ? "bg-red-600" :
                "bg-purple-600 animate-pulse"
              }`}>{job.status}</span>
            </h2>

            <div className="bg-slate-800/60 rounded-lg p-4">
              <div className="flex justify-between text-sm mb-2">
                <span>Progreso · {job.completedItems} / {job.totalItems} pasos</span>
                <span className="font-mono">{job.totalItems > 0 ? Math.round((job.completedItems / job.totalItems) * 100) : 0}%</span>
              </div>
              <div className="h-3 bg-slate-700 rounded-full overflow-hidden">
                <div className="h-full bg-gradient-to-r from-purple-500 to-pink-500 transition-all"
                  style={{ width: `${job.totalItems > 0 ? (job.completedItems / job.totalItems) * 100 : 0}%` }} />
              </div>
              <p className="text-xs text-slate-400 mt-2 font-mono">jobId: {job.jobId}</p>
            </div>

            <div className="bg-black/40 rounded-lg p-4 max-h-96 overflow-y-auto font-mono text-xs">
              {job.log.length === 0 ? (
                <p className="text-slate-500">Esperando primer log...</p>
              ) : job.log.map((l, i) => (
                <div key={i} className={l.includes("✗") || l.includes("FATAL") ? "text-red-400" :
                                       l.includes("✔") || l.includes("COMPLETADO") ? "text-green-400" :
                                       l.includes("▶") ? "text-purple-300" : "text-slate-400"}>
                  {l}
                </div>
              ))}
            </div>

            {job.status === "completed" && finalVaultId && (
              <div className="bg-green-900/30 border border-green-600 rounded-lg p-6 text-center space-y-3">
                <p className="text-2xl">✅ ¡Anuncio generado!</p>
                <p className="text-sm text-slate-300">
                  Vault ID: <strong>{finalVaultId}</strong> · {job.result?.totalDurationSec}s · {job.result?.elapsedSec}s de proceso
                </p>
                <div className="flex gap-3 justify-center flex-wrap">
                  <a href={`${API_BASE}/api/projects/${projectId}/vault/${finalVaultId}/download`}
                    className={BTN_PRIMARY} download>📥 Descargar MP4</a>
                  <Link href={`/projects/${projectId}/super-ad`} className={BTN_SECONDARY}>
                    <span onClick={() => { setJob(null); setStoryboard(null); setStep(1); setRefs([]); }}>+ Generar otro</span>
                  </Link>
                </div>
              </div>
            )}

            {job.status === "failed" && (
              <div className="bg-red-900/30 border border-red-600 rounded-lg p-4">
                <p className="font-semibold text-red-300">❌ Falló la generación</p>
                <p className="text-xs text-slate-400 mt-1">{job.result?.error || "Ver log para detalles"}</p>
                <button onClick={() => setStep(3)} className={BTN_SECONDARY + " mt-3"}>← Volver al storyboard</button>
              </div>
            )}
          </section>
        )}

        {/* HISTORIAL */}
        {previousJobs.length > 0 && step === 1 && (
          <section className="mt-10 bg-slate-900/40 border border-slate-700 rounded-xl p-4">
            <h3 className="text-sm font-semibold mb-3 text-slate-300">📜 Anuncios anteriores</h3>
            <div className="space-y-2">
              {previousJobs.slice(0, 10).map(j => (
                <div key={j.jobId} className="flex items-center justify-between bg-slate-800/40 rounded px-3 py-2 text-xs">
                  <div className="flex items-center gap-3">
                    <span className={`px-2 py-0.5 rounded ${
                      j.status === "completed" ? "bg-green-600" :
                      j.status === "failed" ? "bg-red-600" : "bg-yellow-600"
                    }`}>{j.status}</span>
                    <span className="font-mono text-slate-400">{j.jobId}</span>
                    {j.result?.brand && <span className="text-purple-300">{j.result.brand}</span>}
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-slate-500">{j.completedItems}/{j.totalItems}</span>
                    {j.result?.finalVaultId && (
                      <a href={`${API_BASE}/api/projects/${projectId}/vault/${j.result.finalVaultId}/download`}
                        className="text-purple-400 hover:underline" download>📥</a>
                    )}
                    <button onClick={() => {
                      setJob({
                        jobId: j.jobId, status: j.status,
                        totalItems: j.totalItems, completedItems: j.completedItems,
                        log: [], result: j.result,
                      });
                      setStep(5);
                    }} className="text-slate-400 hover:text-white">Ver →</button>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}
      </div>
    </div>
  );
}

const INP = "w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white focus:border-purple-500 focus:outline-none";
const BTN_PRIMARY = "px-5 py-2.5 bg-purple-600 hover:bg-purple-700 rounded-lg font-medium disabled:opacity-50 disabled:cursor-not-allowed transition";
const BTN_SECONDARY = "px-5 py-2.5 bg-slate-700 hover:bg-slate-600 rounded-lg font-medium transition";

function Field({ label, full, children }: { label: string; full?: boolean; children: React.ReactNode }) {
  return (
    <div className={full ? "md:col-span-2" : ""}>
      <label className="block text-sm font-medium text-slate-300 mb-1">{label}</label>
      {children}
    </div>
  );
}
