import { useState, useEffect, useCallback, useRef } from "react";
import { useRoute } from "wouter";
import { Sparkles, Film, Download, AlertCircle, CheckCircle2, Loader2, Zap, Target, Users, TrendingUp, Globe, Wand2 } from "lucide-react";

const API_BASE = import.meta.env.BASE_URL?.replace(/\/$/, "") ?? "";

type Aspect = "9:16" | "16:9" | "1:1" | "4:5";
type Objective = "awareness" | "conversion" | "retargeting" | "ugc" | "story";

interface VideoProvider {
  key: string;
  label: string;
  tier: "economy" | "standard" | "premium";
  costPerAd: number;
  quality: number;
  description: string;
}

interface ElevenVoice {
  voice_id: string;
  name: string;
  labels: Record<string, string>;
  preview_url?: string;
  category?: string;
}

interface CopyVariant {
  hook: string;
  body: string;
  cta: string;
  tone: string;
}

interface SavedVariant {
  copy: CopyVariant;
  variantIndex: number;
  error?: string;
  saveError?: string;
  finalMp4VaultId?: number;
  heroImageVaultId?: number;
  voiceVaultId?: number;
}

const OBJECTIVE_META: Record<Objective, { label: string; icon: React.ReactNode; desc: string }> = {
  awareness:    { label: "Awareness",    icon: <Globe size={14} />,    desc: "Dar a conocer marca/producto" },
  conversion:   { label: "Conversion",   icon: <Target size={14} />,   desc: "Impulsar compra directa" },
  retargeting:  { label: "Retargeting",  icon: <TrendingUp size={14} />, desc: "Reimpactar visitantes previos" },
  ugc:          { label: "UGC Style",    icon: <Users size={14} />,    desc: "Estilo user-generated content" },
  story:        { label: "Brand Story",  icon: <Sparkles size={14} />, desc: "Narrativa emocional" },
};

const ASPECT_META: Record<Aspect, { label: string; desc: string }> = {
  "9:16": { label: "9:16", desc: "Reels · TikTok · Shorts" },
  "16:9": { label: "16:9", desc: "YouTube · Landing · TV" },
  "1:1":  { label: "1:1",  desc: "Feed Instagram · Facebook" },
  "4:5":  { label: "4:5",  desc: "Portrait Feed (óptimo IG)" },
};

export default function AdStudio() {
  const [, params] = useRoute("/projects/:id/ad-studio");
  const projectId = params?.id ? parseInt(params.id) : 0;

  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);

  // Form state
  const [productTitle, setProductTitle] = useState("");
  const [productCategory, setProductCategory] = useState("");
  const [brandName, setBrandName] = useState("");
  const [brandTone, setBrandTone] = useState("");
  const [targetAudience, setTargetAudience] = useState("");
  const [customPrompt, setCustomPrompt] = useState("");
  const [objective, setObjective] = useState<Objective>("conversion");
  const [aspect, setAspect] = useState<Aspect>("9:16");
  const [videoProvider, setVideoProvider] = useState<string>("replicate-seedance-fast");
  const [videoDurationSec, setVideoDurationSec] = useState(5);
  const [variantsCount, setVariantsCount] = useState(3);
  const [voiceId, setVoiceId] = useState<string>("");
  const [voiceStability, setVoiceStability] = useState(0.5);
  const [voiceStyle, setVoiceStyle] = useState(0.3);
  const [addMusic, setAddMusic] = useState(true);
  const [sourceImageUrl, setSourceImageUrl] = useState("");

  // Catalogs
  const [providers, setProviders] = useState<VideoProvider[]>([]);
  const [voices, setVoices] = useState<ElevenVoice[]>([]);
  const [creditCostPerAd, setCreditCostPerAd] = useState(6);
  const [templates, setTemplates] = useState<Array<{ key: string; label: string; description: string; defaultAspect?: string; defaultDurationSec?: number }>>([]);
  const [templateKey, setTemplateKey] = useState<string>("");
  const [burnSubs, setBurnSubs] = useState<boolean>(false);
  const [subsLanguage, setSubsLanguage] = useState<string>("auto");
  const [showClone, setShowClone] = useState<boolean>(false);
  const [cloneUrl, setCloneUrl] = useState<string>("");
  const [cloneFile, setCloneFile] = useState<File | null>(null);
  const [cloneAnalyzing, setCloneAnalyzing] = useState(false);
  const [cloneBrief, setCloneBrief] = useState<any>(null);

  // Generation state
  const [generating, setGenerating] = useState(false);
  const [progressEvents, setProgressEvents] = useState<Array<{ stage: string; variantIndex?: number; message: string; ts: number }>>([]);
  const [variants, setVariants] = useState<SavedVariant[] | null>(null);
  const [globalError, setGlobalError] = useState<string>("");
  const abortRef = useRef<AbortController | null>(null);

  // Load catalogs
  useEffect(() => {
    Promise.all([
      fetch(`${API_BASE}/api/ad-studio/providers`, { credentials: "include" }).then(r => r.ok ? r.json() : null),
      fetch(`${API_BASE}/api/ad-studio/voices`, { credentials: "include" }).then(r => r.ok ? r.json() : null),
      fetch(`${API_BASE}/api/ad-studio/templates`, { credentials: "include" }).then(r => r.ok ? r.json() : null),
    ]).then(([provData, voiceData, tplData]) => {
      if (tplData?.templates) setTemplates(tplData.templates);
      if (provData?.videoProviders) {
        setProviders(provData.videoProviders);
        setCreditCostPerAd(provData.creditCostPerAd || 6);
      }
      if (voiceData?.voices) {
        setVoices(voiceData.voices);
        // Default to first Spanish voice if available
        const spanishDefault = voiceData.voices.find((v: ElevenVoice) =>
          v.labels?.language === "spanish" || v.name?.toLowerCase().includes("daniel"),
        );
        if (spanishDefault) setVoiceId(spanishDefault.voice_id);
      }
    }).catch(() => {});
  }, []);

  const totalCredits = creditCostPerAd * variantsCount;

  const canGenerate = productTitle.trim() && productCategory.trim() && objective && aspect && videoProvider;

  const generateCampaign = useCallback(async () => {
    if (!canGenerate) { setGlobalError("Completa título y categoría primero"); return; }
    setGenerating(true);
    setGlobalError("");
    setProgressEvents([]);
    setVariants(null);
    setStep(4);

    const payload = {
      projectId,
      productTitle, productCategory, brandName, brandTone, targetAudience, customPrompt,
      objective, aspect, videoProvider, videoDurationSec, variantsCount,
      voiceId: voiceId || undefined, voiceStability, voiceStyle, addMusic,
      sourceImageUrl: sourceImageUrl || undefined,
      template: templateKey || undefined,
      burnSubs: burnSubs || undefined,
      subsLanguage: burnSubs && subsLanguage !== "auto" ? subsLanguage : undefined,
    };

    const ctrl = new AbortController();
    abortRef.current = ctrl;

    try {
      const res = await fetch(`${API_BASE}/api/ad-studio/generate-campaign`, {
        method: "POST", credentials: "include",
        headers: { "Content-Type": "application/json", "Accept": "text/event-stream" },
        body: JSON.stringify(payload),
        signal: ctrl.signal,
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || `HTTP ${res.status}`);
      }

      if (!res.body) throw new Error("No response body");

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buf = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        const events = buf.split("\n\n");
        buf = events.pop() || "";
        for (const raw of events) {
          if (!raw.trim()) continue;
          const lines = raw.split("\n");
          let eventName = "message"; let dataStr = "";
          for (const ln of lines) {
            if (ln.startsWith("event:")) eventName = ln.slice(6).trim();
            else if (ln.startsWith("data:")) dataStr += ln.slice(5).trim();
          }
          try {
            const parsed = JSON.parse(dataStr);
            if (eventName === "progress") {
              setProgressEvents(prev => [...prev, { ...parsed, ts: Date.now() }]);
            } else if (eventName === "complete") {
              setVariants(parsed.variants || []);
              setGenerating(false);
            } else if (eventName === "error") {
              setGlobalError(parsed.error || "Error desconocido");
              setGenerating(false);
            }
          } catch {}
        }
      }
    } catch (err: any) {
      if (err?.name === "AbortError") {
        setGlobalError("Generación cancelada");
      } else {
        setGlobalError(err?.message || "Error de red");
      }
      setGenerating(false);
    } finally {
      abortRef.current = null;
    }
  }, [projectId, productTitle, productCategory, brandName, brandTone, targetAudience, customPrompt, objective, aspect, videoProvider, videoDurationSec, variantsCount, voiceId, voiceStability, voiceStyle, addMusic, sourceImageUrl, canGenerate]);

  const cancel = () => {
    abortRef.current?.abort();
    setGenerating(false);
  };

  return (
    <div style={{ padding: "24px 32px", maxWidth: 1200, margin: "0 auto" }}>
      {/* HEADER */}
      <div style={{ marginBottom: 28 }}>
        <h1 style={{ fontSize: 28, fontWeight: 800, color: "var(--gold, #c8a84b)", marginBottom: 4, display: "flex", alignItems: "center", gap: 12 }}>
          <Film size={28} /> Ad Studio Pro
        </h1>
        <p style={{ color: "var(--t2, #aaa)", fontSize: 14, maxWidth: 780 }}>
          Genera anuncios publicitarios completos con IA: <strong style={{ color: "#fff" }}>copy + imagen hero (Nano Banana) + video (Runway/Replicate) + voiceover y música (ElevenLabs)</strong>, todo montado en un MP4 listo para Meta Ads / TikTok Ads / YouTube Shorts.
        </p>
      </div>

      {/* CLONE VIRAL PANEL */}
      <div style={{ marginBottom: 16, padding: 14, borderRadius: 12, background: "var(--ink2, #14141d)", border: "1px solid var(--bdr, #22222e)" }}>
        <button onClick={() => setShowClone(s => !s)}
          style={{ background: "transparent", border: "none", color: "var(--gold)", fontSize: 13, fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", gap: 8, padding: 0 }}>
          <Film size={14} /> Clonar formato viral desde URL/video {showClone ? "▾" : "▸"}
        </button>
        {showClone && (
          <div style={{ marginTop: 12, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <div>
              <Field label="URL del video viral (TikTok / Instagram / YouTube)">
                <input value={cloneUrl} onChange={e => setCloneUrl(e.target.value)} placeholder="https://www.tiktok.com/@..." style={inputStyle} />
              </Field>
              <Field label="O sube un archivo de video">
                <input type="file" accept="video/*" onChange={e => setCloneFile(e.target.files?.[0] || null)} />
              </Field>
              <button
                onClick={async () => {
                  if (!cloneUrl && !cloneFile) { setGlobalError("Pega URL o sube video"); return; }
                  setCloneAnalyzing(true); setGlobalError(""); setCloneBrief(null);
                  try {
                    let res: Response;
                    if (cloneFile) {
                      const fd = new FormData();
                      fd.append("projectId", String(projectId));
                      fd.append("video", cloneFile);
                      fd.append("dryRun", "1");
                      res = await fetch(`${API_BASE}/api/ad-studio/clone-viral`, { method: "POST", credentials: "include", body: fd });
                    } else {
                      res = await fetch(`${API_BASE}/api/ad-studio/clone-viral`, {
                        method: "POST", credentials: "include",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ projectId, videoUrl: cloneUrl, dryRun: true }),
                      });
                    }
                    const d = await res.json();
                    if (!res.ok) { setGlobalError(d.error || `HTTP ${res.status}`); return; }
                    const brief = d.brief || d;
                    setCloneBrief(brief);
                    if (brief?.template) setTemplateKey(brief.template);
                    if (brief?.aspect) setAspect(brief.aspect as Aspect);
                    if (brief?.durationSec) setVideoDurationSec(Math.min(Math.max(Number(brief.durationSec), 3), 10));
                    if (brief?.hook) setCustomPrompt(String(brief.hook));
                  } catch (e: any) { setGlobalError(e?.message || "Error analizando"); } finally { setCloneAnalyzing(false); }
                }}
                disabled={cloneAnalyzing || (!cloneUrl && !cloneFile)}
                className="btn btn-gold" style={{ width: "100%", padding: "10px 14px", justifyContent: "center" }}>
                {cloneAnalyzing ? <Loader2 size={14} className="animate-spin" /> : <Wand2 size={14} />}
                {cloneAnalyzing ? "Analizando viral..." : "Analizar y aplicar brief"}
              </button>
              <p style={{ fontSize: 10, color: "var(--t3)", marginTop: 8 }}>
                Auto-detecta formato, hook, plantilla recomendada y duración. Después rellena Producto y genera.
              </p>
            </div>
            <div>
              {cloneBrief ? (
                <div style={{ padding: 12, background: "var(--ink, #0d0d14)", borderRadius: 8, border: "1px solid var(--bdr)", maxHeight: 260, overflowY: "auto", fontSize: 11, fontFamily: "monospace", color: "var(--t2)", whiteSpace: "pre-wrap" }}>
                  {JSON.stringify(cloneBrief, null, 2)}
                </div>
              ) : (
                <div style={{ padding: 12, background: "var(--ink, #0d0d14)", borderRadius: 8, border: "1px dashed var(--bdr)", color: "var(--t3)", fontSize: 11, textAlign: "center", height: "100%", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  El brief extraído aparecerá aquí
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* STEPS INDICATOR */}
      <div style={{ display: "flex", gap: 8, marginBottom: 24, padding: 4, background: "var(--ink2, #14141d)", borderRadius: 12, border: "1px solid var(--bdr, #22222e)" }}>
        {[
          { n: 1, label: "Producto" },
          { n: 2, label: "Estilo" },
          { n: 3, label: "Voz & Música" },
          { n: 4, label: "Generar" },
        ].map(s => (
          <button key={s.n} onClick={() => !generating && setStep(s.n as 1 | 2 | 3 | 4)} disabled={generating}
            style={{
              flex: 1, padding: "10px 14px", borderRadius: 8, fontSize: 13, fontWeight: 600,
              background: step === s.n ? "linear-gradient(135deg, rgba(200,168,75,0.18), rgba(200,168,75,0.05))" : "transparent",
              border: step === s.n ? "1px solid rgba(200,168,75,0.35)" : "1px solid transparent",
              color: step === s.n ? "var(--gold)" : "var(--t2)",
              cursor: generating ? "not-allowed" : "pointer",
              opacity: generating && step !== s.n ? 0.5 : 1,
            }}>
            <span style={{ fontSize: 10, color: "var(--t3)", textTransform: "uppercase", letterSpacing: 0.5 }}>Paso {s.n}</span>
            <div>{s.label}</div>
          </button>
        ))}
      </div>

      {globalError && (
        <div style={{ marginBottom: 16, padding: "12px 16px", borderRadius: 10, background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.3)", color: "#fca5a5", fontSize: 13, display: "flex", gap: 10, alignItems: "center" }}>
          <AlertCircle size={16} /> {globalError}
        </div>
      )}

      {/* STEP 1 — Product */}
      {step === 1 && (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
          <div>
            <Field label="Producto *">
              <input value={productTitle} onChange={e => setProductTitle(e.target.value)} placeholder="Collar de plata minimalista" style={inputStyle} />
            </Field>
            <Field label="Categoría *">
              <input value={productCategory} onChange={e => setProductCategory(e.target.value)} placeholder="joyería, ropa, cosmética..." style={inputStyle} />
            </Field>
            <Field label="Marca">
              <input value={brandName} onChange={e => setBrandName(e.target.value)} placeholder="Luna Silver" style={inputStyle} />
            </Field>
            <Field label="Tono de marca">
              <input value={brandTone} onChange={e => setBrandTone(e.target.value)} placeholder="minimalista, elegante, joven..." style={inputStyle} />
            </Field>
          </div>
          <div>
            <Field label="Público objetivo">
              <textarea value={targetAudience} onChange={e => setTargetAudience(e.target.value)} placeholder="Mujeres 25-40, interés en joyería sostenible, ingresos medio-alto" style={{ ...inputStyle, minHeight: 70, resize: "vertical" }} />
            </Field>
            <Field label="Contexto adicional">
              <textarea value={customPrompt} onChange={e => setCustomPrompt(e.target.value)} placeholder="Black Friday, nueva colección verano, lanzamiento..." style={{ ...inputStyle, minHeight: 70, resize: "vertical" }} />
            </Field>
            <Field label="URL imagen origen (opcional)">
              <input value={sourceImageUrl} onChange={e => setSourceImageUrl(e.target.value)} placeholder="https://... (si vacío, Nano Banana genera hero shot)" style={inputStyle} />
              <p style={{ fontSize: 11, color: "var(--t3)", marginTop: 6 }}>Si dejas vacío, Gemini Nano Banana genera una imagen hero cinemática para cada variante.</p>
            </Field>
          </div>
          <div style={{ gridColumn: "1 / -1", display: "flex", justifyContent: "flex-end", marginTop: 8 }}>
            <button onClick={() => setStep(2)} disabled={!productTitle.trim() || !productCategory.trim()} className="btn btn-gold">
              Siguiente → Estilo
            </button>
          </div>
        </div>
      )}

      {/* STEP 2 — Style (objective, aspect, provider, duration, variants) */}
      {step === 2 && (
        <div>
          {templates.length > 0 && (
            <Section title="Plantilla de género (opcional)">
              <p style={{ fontSize: 11, color: "var(--t3)", marginBottom: 10 }}>
                Las plantillas curadas combinan tono de copy + estilo visual + voz + música óptimos para cada formato.
              </p>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 8 }}>
                <button onClick={() => setTemplateKey("")} style={cardButton(templateKey === "")}>
                  <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 2 }}>Sin plantilla</div>
                  <div style={{ fontSize: 10, color: "var(--t3)" }}>Generación libre</div>
                </button>
                {templates.map(t => (
                  <button key={t.key} onClick={() => {
                    setTemplateKey(t.key);
                    if (t.defaultAspect) setAspect(t.defaultAspect as Aspect);
                    if (t.defaultDurationSec) setVideoDurationSec(t.defaultDurationSec);
                  }} style={cardButton(templateKey === t.key)}>
                    <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 2 }}>{t.label}</div>
                    <div style={{ fontSize: 10, color: "var(--t3)" }}>{t.description}</div>
                  </button>
                ))}
              </div>
            </Section>
          )}

          <Section title="Objetivo de campaña">
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 8 }}>
              {Object.entries(OBJECTIVE_META).map(([k, m]) => (
                <button key={k} onClick={() => setObjective(k as Objective)}
                  style={cardButton(objective === k)}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>{m.icon}<strong>{m.label}</strong></div>
                  <div style={{ fontSize: 11, color: "var(--t3)" }}>{m.desc}</div>
                </button>
              ))}
            </div>
          </Section>

          <Section title="Formato">
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 8 }}>
              {Object.entries(ASPECT_META).map(([k, m]) => (
                <button key={k} onClick={() => setAspect(k as Aspect)} style={cardButton(aspect === k)}>
                  <div style={{ fontSize: 16, fontWeight: 800, marginBottom: 2 }}>{m.label}</div>
                  <div style={{ fontSize: 10, color: "var(--t3)" }}>{m.desc}</div>
                </button>
              ))}
            </div>
          </Section>

          <Section title="Proveedor de video">
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 10 }}>
              {providers.map(p => (
                <button key={p.key} onClick={() => setVideoProvider(p.key)} style={{ ...cardButton(videoProvider === p.key), textAlign: "left", padding: 14 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
                    <strong style={{ fontSize: 13 }}>{p.label}</strong>
                    <span style={{ fontSize: 10, padding: "2px 6px", borderRadius: 4, background: p.tier === "premium" ? "rgba(200,168,75,0.15)" : p.tier === "standard" ? "rgba(99,102,241,0.15)" : "rgba(45,212,159,0.15)", color: p.tier === "premium" ? "var(--gold)" : p.tier === "standard" ? "#a5b4fc" : "#2dd49f", textTransform: "uppercase", fontWeight: 700 }}>{p.tier}</span>
                  </div>
                  <div style={{ fontSize: 10, color: "var(--t3)", marginBottom: 6 }}>{p.description}</div>
                  <div style={{ fontSize: 10, color: "var(--t2)" }}>~€{p.costPerAd.toFixed(2)}/ad · Calidad {p.quality}/10</div>
                </button>
              ))}
            </div>
          </Section>

          <Section title="Parámetros">
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
              <Field label={`Duración: ${videoDurationSec}s`}>
                <input type="range" min={3} max={10} step={1} value={videoDurationSec} onChange={e => setVideoDurationSec(parseInt(e.target.value))} style={{ width: "100%" }} />
              </Field>
              <Field label={`Variantes A/B: ${variantsCount}`}>
                <input type="range" min={1} max={5} step={1} value={variantsCount} onChange={e => setVariantsCount(parseInt(e.target.value))} style={{ width: "100%" }} />
              </Field>
            </div>
          </Section>

          <div style={{ display: "flex", justifyContent: "space-between", marginTop: 16 }}>
            <button onClick={() => setStep(1)} className="btn btn-ghost">← Volver</button>
            <button onClick={() => setStep(3)} className="btn btn-gold">Siguiente → Voz & Música</button>
          </div>
        </div>
      )}

      {/* STEP 3 — Voice & Music */}
      {step === 3 && (
        <div>
          <Section title="Voz narradora (ElevenLabs)">
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 8, maxHeight: 320, overflowY: "auto", padding: 4 }}>
              {voices.length === 0 ? (
                <div style={{ padding: 20, textAlign: "center", fontSize: 12, color: "var(--t3)", gridColumn: "1 / -1" }}>
                  Cargando voces... Si no aparecen, verifica que <code>ELEVENLABS_API_KEY</code> esté configurada.
                </div>
              ) : voices.map(v => (
                <button key={v.voice_id} onClick={() => setVoiceId(v.voice_id)}
                  style={{ ...cardButton(voiceId === v.voice_id), textAlign: "left", padding: 12 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
                    <strong style={{ fontSize: 12 }}>{v.name}</strong>
                    {v.preview_url && (
                      <a onClick={e => { e.stopPropagation(); new Audio(v.preview_url).play().catch(()=>{}); }}
                        style={{ cursor: "pointer", color: "var(--gold)", fontSize: 10 }}>▶ Preview</a>
                    )}
                  </div>
                  <div style={{ fontSize: 10, color: "var(--t3)" }}>
                    {[v.labels?.gender, v.labels?.age, v.labels?.accent, v.labels?.use_case].filter(Boolean).join(" · ")}
                  </div>
                </button>
              ))}
            </div>
          </Section>

          <Section title="Ajustes de voz">
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
              <Field label={`Estabilidad: ${voiceStability.toFixed(2)}`}>
                <input type="range" min={0} max={1} step={0.05} value={voiceStability} onChange={e => setVoiceStability(parseFloat(e.target.value))} style={{ width: "100%" }} />
                <p style={{ fontSize: 10, color: "var(--t3)" }}>Bajo = más expresivo · Alto = más consistente</p>
              </Field>
              <Field label={`Estilo: ${voiceStyle.toFixed(2)}`}>
                <input type="range" min={0} max={1} step={0.05} value={voiceStyle} onChange={e => setVoiceStyle(parseFloat(e.target.value))} style={{ width: "100%" }} />
                <p style={{ fontSize: 10, color: "var(--t3)" }}>Bajo = natural · Alto = dramático</p>
              </Field>
            </div>
          </Section>

          <Section title="Música & SFX ambiental">
            <label style={{ display: "flex", alignItems: "center", gap: 10, padding: 12, borderRadius: 8, background: "var(--ink2)", border: "1px solid var(--bdr)", cursor: "pointer" }}>
              <input type="checkbox" checked={addMusic} onChange={e => setAddMusic(e.target.checked)} />
              <div>
                <div style={{ fontSize: 13, fontWeight: 600, color: "var(--t1)" }}>Añadir música/ambiente (ElevenLabs Sound Effects)</div>
                <div style={{ fontSize: 11, color: "var(--t3)" }}>Se genera SFX automático según el tono de cada variante. +€0.02/ad.</div>
              </div>
            </label>
          </Section>

          <div style={{ display: "flex", justifyContent: "space-between", marginTop: 16 }}>
            <button onClick={() => setStep(2)} className="btn btn-ghost">← Volver</button>
            <button onClick={() => setStep(4)} className="btn btn-gold">Revisar & Generar →</button>
          </div>
        </div>
      )}

      {/* STEP 4 — Generate + Progress + Results */}
      {step === 4 && (
        <div>
          {!generating && !variants && (
            <div style={{ padding: 20, borderRadius: 12, background: "linear-gradient(135deg, rgba(200,168,75,0.08), transparent)", border: "1px solid rgba(200,168,75,0.25)", marginBottom: 16 }}>
              <h3 style={{ margin: "0 0 12px", fontSize: 15, fontWeight: 700, color: "var(--gold)" }}>Resumen de la campaña</h3>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 10, fontSize: 12, color: "var(--t2)" }}>
                <div><strong style={{ color: "var(--t1)" }}>Producto:</strong> {productTitle || "—"}</div>
                <div><strong style={{ color: "var(--t1)" }}>Objetivo:</strong> {OBJECTIVE_META[objective].label}</div>
                <div><strong style={{ color: "var(--t1)" }}>Formato:</strong> {aspect} ({ASPECT_META[aspect].desc})</div>
                <div><strong style={{ color: "var(--t1)" }}>Video:</strong> {providers.find(p => p.key === videoProvider)?.label || videoProvider}</div>
                <div><strong style={{ color: "var(--t1)" }}>Duración:</strong> {videoDurationSec}s</div>
                <div><strong style={{ color: "var(--t1)" }}>Variantes:</strong> {variantsCount}</div>
                <div><strong style={{ color: "var(--t1)" }}>Música:</strong> {addMusic ? "Sí" : "No"}</div>
                <div><strong style={{ color: "var(--t1)" }}>Créditos a usar:</strong> {totalCredits}</div>
              </div>
              <button onClick={generateCampaign} disabled={!canGenerate}
                style={{ marginTop: 16, width: "100%", padding: "14px 20px", borderRadius: 10, fontSize: 15, fontWeight: 800, cursor: canGenerate ? "pointer" : "not-allowed", background: "linear-gradient(135deg, #c8a84b, #a88b3a)", color: "#000", border: "none", display: "flex", alignItems: "center", justifyContent: "center", gap: 10, opacity: canGenerate ? 1 : 0.5 }}>
                <Zap size={18} /> Generar {variantsCount} {variantsCount === 1 ? "anuncio" : "anuncios"} ahora
              </button>
            </div>
          )}

          {generating && (
            <div style={{ padding: 20, borderRadius: 12, background: "var(--ink2, #14141d)", border: "1px solid var(--bdr)" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <Loader2 size={20} className="animate-spin" style={{ color: "var(--gold)" }} />
                  <strong style={{ color: "var(--t1)" }}>Generando campaña…</strong>
                </div>
                <button onClick={cancel} className="btn btn-ghost btn-sm">Cancelar</button>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 6, maxHeight: 340, overflowY: "auto", fontFamily: "var(--fm, monospace)", fontSize: 12 }}>
                {progressEvents.map((e, i) => (
                  <div key={i} style={{ padding: "6px 10px", borderRadius: 6, background: "var(--ink)", border: "1px solid var(--bdr)", color: "var(--t2)", display: "flex", gap: 8 }}>
                    <span style={{ color: stageColor(e.stage), minWidth: 70, fontWeight: 600 }}>[{e.stage}]</span>
                    <span>{e.message}</span>
                  </div>
                ))}
                {progressEvents.length === 0 && <div style={{ color: "var(--t3)" }}>Iniciando…</div>}
              </div>
            </div>
          )}

          {variants && (
            <div>
              <div style={{ padding: "14px 18px", borderRadius: 10, background: "rgba(45,212,159,0.08)", border: "1px solid rgba(45,212,159,0.3)", marginBottom: 16, display: "flex", alignItems: "center", gap: 12 }}>
                <CheckCircle2 size={20} style={{ color: "#2dd49f" }} />
                <div>
                  <strong style={{ color: "#2dd49f", fontSize: 14 }}>Campaña generada</strong>
                  <div style={{ fontSize: 11, color: "var(--t2)", marginTop: 2 }}>{variants.length} variantes · guardadas en el Vault del proyecto · el brain ha aprendido de este set</div>
                </div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(340px, 1fr))", gap: 14 }}>
                {variants.map((v, i) => (
                  <VariantCard key={i} variant={v} projectId={projectId} />
                ))}
              </div>

              <div style={{ marginTop: 20, display: "flex", gap: 10 }}>
                <button onClick={() => { setVariants(null); setProgressEvents([]); setStep(1); }} className="btn btn-gold">Nueva campaña</button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Subcomponents ─────────────────────────────────────────────────────────

function VariantCard({ variant, projectId }: { variant: SavedVariant; projectId: number }) {
  const hasError = !!variant.error;
  const videoUrl = variant.finalMp4VaultId ? `${API_BASE}/api/projects/${projectId}/vault/${variant.finalMp4VaultId}/preview` : null;
  const heroUrl = variant.heroImageVaultId ? `${API_BASE}/api/projects/${projectId}/vault/${variant.heroImageVaultId}/preview` : null;

  return (
    <div style={{ padding: 16, borderRadius: 12, background: "var(--ink2, #14141d)", border: `1px solid ${hasError ? "rgba(239,68,68,0.35)" : "var(--bdr)"}` }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
        <span style={{ fontSize: 10, fontWeight: 700, color: "var(--gold)", textTransform: "uppercase", letterSpacing: 0.5 }}>
          Variante {variant.variantIndex + 1} · {variant.copy.tone}
        </span>
        {!hasError && videoUrl && (
          <a href={videoUrl} download target="_blank" rel="noopener noreferrer"
             style={{ fontSize: 11, color: "#2dd49f", textDecoration: "none", display: "flex", alignItems: "center", gap: 4 }}>
            <Download size={11} /> MP4
          </a>
        )}
      </div>

      {hasError ? (
        <div style={{ padding: 12, borderRadius: 8, background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.25)", fontSize: 12, color: "#fca5a5", marginBottom: 10 }}>
          <AlertCircle size={14} style={{ display: "inline", verticalAlign: -2, marginRight: 6 }} />
          {variant.error}
        </div>
      ) : videoUrl ? (
        <video src={videoUrl} controls style={{ width: "100%", borderRadius: 8, background: "#000", marginBottom: 10, maxHeight: 480 }} />
      ) : heroUrl ? (
        <img src={heroUrl} style={{ width: "100%", borderRadius: 8, marginBottom: 10 }} alt="Hero" />
      ) : null}

      <div style={{ fontSize: 12, color: "var(--t1)", fontWeight: 700, marginBottom: 4, lineHeight: 1.3 }}>
        {variant.copy.hook}
      </div>
      <div style={{ fontSize: 11, color: "var(--t2)", marginBottom: 6, lineHeight: 1.4 }}>
        {variant.copy.body}
      </div>
      <div style={{ fontSize: 11, color: "var(--gold)", fontWeight: 600 }}>
        → {variant.copy.cta}
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 20 }}>
      <h3 style={{ fontSize: 12, fontWeight: 700, color: "var(--t3)", textTransform: "uppercase", letterSpacing: 0.8, marginBottom: 10 }}>{title}</h3>
      {children}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 12 }}>
      <label style={{ fontSize: 11, color: "var(--t3)", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 6, display: "block" }}>{label}</label>
      {children}
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  width: "100%", padding: "10px 12px", borderRadius: 8, background: "var(--ink2, #14141d)",
  border: "1px solid var(--bdr, #22222e)", color: "var(--t1, #fff)", fontSize: 13, fontFamily: "inherit",
};

const cardButton = (active: boolean): React.CSSProperties => ({
  padding: "10px 12px", borderRadius: 8, fontSize: 12, cursor: "pointer", textAlign: "center", lineHeight: 1.3,
  background: active ? "rgba(200,168,75,0.12)" : "var(--ink2, #14141d)",
  border: `1px solid ${active ? "var(--gold)" : "var(--bdr, #22222e)"}`,
  color: active ? "var(--gold)" : "var(--t2)",
});

function stageColor(stage: string): string {
  switch (stage) {
    case "copy": return "#a5b4fc";
    case "image": return "#2dd49f";
    case "video": return "#c8a84b";
    case "voice": return "#ec4899";
    case "compose": return "#06b6d4";
    default: return "#888";
  }
}
