import { useState, useEffect, useCallback } from "react";
import { useRoute } from "wouter";
import {
  Copy, Check, ChevronDown, ChevronRight, Cpu, Camera, Layers, Wand2,
  Loader2, Settings, Play, Zap, Shield, Film, Monitor, Sparkles,
  LayoutGrid, Box, AlertTriangle, Info, Star,
} from "lucide-react";

const API = import.meta.env.BASE_URL?.replace(/\/$/, "") ?? "";

interface PlatformProfile {
  id: string; name: string; developer: string; type: string;
  maxDurationSec: number; maxResolution: string; fps: number;
  apiModes: string[]; strengths: string[]; explodedViewRating: number;
  promptTips: string[]; cameraControlMethod: string; pricingNote: string;
}
interface GlobalStateDNA {
  id: string; name: string; description: string;
  cameraSpec: string; lightingSpec: string; physicsSpec: string;
  qualitySpec: string; fullTemplate: string;
}
interface ClipPrompt {
  clipIndex: number; clipName: string; timelineSec: string;
  phase: string; logicDescription: string; startingState: string;
  action: string; endingState: string; motionCurve: string;
  prompt: string; parallelSafe: boolean; sequentialTip: string;
}
interface PromptSequence {
  id: string; productName: string; productCategory: string;
  totalDurationSec: number; clipCount: number; globalStateId: string;
  globalStatePrefix: string; generationMode: string;
  clips: ClipPrompt[]; postProductionNotes: string[];
}
interface ProductComponent {
  name: string; material: string; separationAxis: string;
  separationDistance: string; detachOrder: number; visualNote: string;
}
interface ProductPreset {
  id: string; category: string; displayName: string; exampleProduct: string;
  components: ProductComponent[]; recommendedGlobalState: string;
  recommendedPlatforms: string[]; specialEffects: string[]; promptSuffix: string;
}
interface GenerationStrategy {
  id: string; name: string; mode: string; description: string;
  howItWorks: string[]; pros: string[]; cons: string[];
  bestPlatforms: string[]; criticalRule: string;
}
interface PostProductionStep {
  id: string; order: number; name: string; description: string;
  toolSuggestions: string[]; parameters: string; criticalNote: string;
}
interface QualityRule {
  id: string; category: string; rule: string; rationale: string; severity: string;
}

type Tab = "platforms" | "sequences" | "presets" | "architecture" | "generate";

function CopyBtn({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  const copy = useCallback(() => {
    navigator.clipboard.writeText(text).then(() => { setCopied(true); setTimeout(() => setCopied(false), 2000); });
  }, [text]);
  return (
    <button onClick={copy} className="inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-medium bg-zinc-800 hover:bg-zinc-700 text-zinc-300 transition-colors" title="Copiar al portapapeles">
      {copied ? <><Check size={12} className="text-emerald-400" /> Copiado</> : <><Copy size={12} /> Copiar</>}
    </button>
  );
}

function RatingBadge({ rating }: { rating: number }) {
  const color = rating >= 90 ? "text-emerald-400 border-emerald-500/30 bg-emerald-500/10" : rating >= 85 ? "text-amber-400 border-amber-500/30 bg-amber-500/10" : "text-zinc-400 border-zinc-500/30 bg-zinc-500/10";
  return <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold border ${color}`}><Star size={10} />{rating}/100</span>;
}

function SeverityBadge({ severity }: { severity: string }) {
  const styles: Record<string, string> = {
    critical: "bg-red-500/20 text-red-400 border-red-500/30",
    important: "bg-amber-500/20 text-amber-400 border-amber-500/30",
    recommended: "bg-blue-500/20 text-blue-400 border-blue-500/30",
  };
  return <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-bold border ${styles[severity] || styles.recommended}`}>{severity.toUpperCase()}</span>;
}

function PhaseBadge({ phase }: { phase: string }) {
  const styles: Record<string, string> = {
    deconstruction: "bg-orange-500/20 text-orange-400",
    suspension: "bg-purple-500/20 text-purple-400",
    assembly: "bg-emerald-500/20 text-emerald-400",
  };
  return <span className={`px-2 py-0.5 rounded text-xs font-bold ${styles[phase] || "bg-zinc-700 text-zinc-300"}`}>{phase.toUpperCase()}</span>;
}

export default function ExplodedViewStudio() {
  const [, params] = useRoute("/projects/:id/exploded-view");
  const projectId = params?.id ?? "0";

  const [tab, setTab] = useState<Tab>("platforms");
  const [platforms, setPlatforms] = useState<PlatformProfile[]>([]);
  const [globalStates, setGlobalStates] = useState<GlobalStateDNA[]>([]);
  const [sequences, setSequences] = useState<PromptSequence[]>([]);
  const [presets, setPresets] = useState<ProductPreset[]>([]);
  const [strategies, setStrategies] = useState<GenerationStrategy[]>([]);
  const [postProd, setPostProd] = useState<PostProductionStep[]>([]);
  const [rules, setRules] = useState<QualityRule[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [expandedPlatform, setExpandedPlatform] = useState<string | null>(null);
  const [expandedSeq, setExpandedSeq] = useState<string | null>(null);
  const [expandedPreset, setExpandedPreset] = useState<string | null>(null);
  const [expandedClip, setExpandedClip] = useState<string | null>(null);

  const [genForm, setGenForm] = useState({ productName: "", productCategory: "luxury_watch", materialDescription: "", components: "", format: "16:9", generationMode: "parallel", globalStateId: "gs:studio_black" });
  const [generating, setGenerating] = useState(false);
  const [genResult, setGenResult] = useState<any>(null);
  const [genError, setGenError] = useState("");

  useEffect(() => {
    setLoading(true);
    setError("");
    fetch(`${API}/api/fs-pro/exploded-view/full`, { credentials: "include" })
      .then(r => r.json())
      .then(d => {
        if (!d.ok) throw new Error(d.error || "Error loading data");
        setPlatforms(d.platforms || []);
        setGlobalStates(d.globalStates || []);
        setSequences(d.sequences || []);
        setPresets(d.productPresets || []);
        setStrategies(d.strategies || []);
        setPostProd(d.postProduction || []);
        setRules(d.qualityRules || []);
      })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  const handleGenerate = async () => {
    setGenerating(true); setGenError(""); setGenResult(null);
    try {
      const comps = genForm.components.split("\n").map(s => s.trim()).filter(Boolean);
      const res = await fetch(`${API}/api/fs-pro/exploded-view/generate-sequence`, {
        method: "POST", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...genForm, components: comps.length > 0 ? comps : undefined, projectId }),
      });
      const d = await res.json();
      if (!res.ok || !d.ok) throw new Error(d.error || "Error generating sequence");
      setGenResult(d.sequence);
    } catch (e: any) { setGenError(e.message); }
    finally { setGenerating(false); }
  };

  const tabs: { id: Tab; label: string; icon: React.ReactNode }[] = [
    { id: "platforms", label: "Plataformas IA", icon: <Cpu size={16} /> },
    { id: "sequences", label: "Secuencias", icon: <Film size={16} /> },
    { id: "presets", label: "Presets Producto", icon: <Box size={16} /> },
    { id: "architecture", label: "Arquitectura", icon: <Layers size={16} /> },
    { id: "generate", label: "Generador IA", icon: <Wand2 size={16} /> },
  ];

  if (loading) return (
    <div className="flex items-center justify-center h-full">
      <Loader2 className="w-8 h-8 animate-spin text-amber-400" />
      <span className="ml-3 text-zinc-400">Cargando Exploded View Studio...</span>
    </div>
  );

  if (error) return (
    <div className="flex items-center justify-center h-full">
      <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-6 max-w-md text-center">
        <AlertTriangle className="w-8 h-8 text-red-400 mx-auto mb-2" />
        <p className="text-red-300">{error}</p>
      </div>
    </div>
  );

  return (
    <div className="flex flex-col bg-zinc-950 text-zinc-100">
      <div className="flex items-center gap-3 px-4 py-3 border-b border-zinc-800 bg-zinc-900/80 backdrop-blur shrink-0">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-orange-500 to-red-600 flex items-center justify-center"><Layers size={18} className="text-white" /></div>
          <div>
            <h1 className="text-sm font-bold text-zinc-100">Exploded View Studio</h1>
            <p className="text-xs text-zinc-500">Deconstrucción & Ensamblaje Profesional</p>
          </div>
        </div>
        <div className="ml-auto flex items-center gap-2 text-xs text-zinc-500">
          <span>{platforms.length} plataformas</span>
          <span className="text-zinc-700">|</span>
          <span>{presets.length} presets</span>
          <span className="text-zinc-700">|</span>
          <span>{rules.length} reglas</span>
        </div>
      </div>

      <div className="flex gap-1 px-4 pt-2 border-b border-zinc-800 bg-zinc-900/50 shrink-0 overflow-x-auto">
        {tabs.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={`flex items-center gap-1.5 px-3 py-2 text-xs font-medium rounded-t-lg transition-all whitespace-nowrap ${
              tab === t.id ? "bg-zinc-800 text-amber-400 border-b-2 border-amber-400" : "text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800/50"
            }`}>
            {t.icon}{t.label}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">

        {tab === "platforms" && (
          <>
            <div className="grid gap-3">
              {platforms.map(p => {
                const expanded = expandedPlatform === p.id;
                return (
                  <div key={p.id} className="bg-zinc-900 border border-zinc-800 rounded-lg overflow-hidden hover:border-zinc-700 transition-colors">
                    <button onClick={() => setExpandedPlatform(expanded ? null : p.id)} className="w-full flex items-center gap-3 p-3 text-left">
                      <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-amber-500/20 to-orange-600/20 border border-amber-500/30 flex items-center justify-center text-amber-400 shrink-0"><Monitor size={20} /></div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-bold text-sm">{p.name}</span>
                          <span className="text-xs text-zinc-500">{p.developer}</span>
                          <RatingBadge rating={p.explodedViewRating} />
                          <span className="text-xs px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-400">{p.type}</span>
                        </div>
                        <div className="flex items-center gap-3 mt-1 text-xs text-zinc-500">
                          <span>{p.maxResolution}</span>
                          <span>{p.fps}fps</span>
                          <span>Max {p.maxDurationSec}s</span>
                          <span>{p.apiModes.length} modos API</span>
                        </div>
                      </div>
                      {expanded ? <ChevronDown size={16} className="text-zinc-500 shrink-0" /> : <ChevronRight size={16} className="text-zinc-500 shrink-0" />}
                    </button>
                    {expanded && (
                      <div className="border-t border-zinc-800 p-3 space-y-3">
                        <div>
                          <h4 className="text-xs font-bold text-amber-400 mb-1 flex items-center gap-1"><Zap size={12} /> Fortalezas</h4>
                          <ul className="space-y-1">{p.strengths.map((s, i) => <li key={i} className="text-xs text-zinc-300 pl-3 relative before:content-['▸'] before:absolute before:left-0 before:text-amber-500">{s}</li>)}</ul>
                        </div>
                        <div>
                          <h4 className="text-xs font-bold text-emerald-400 mb-1 flex items-center gap-1"><Info size={12} /> Tips para Exploded View</h4>
                          <ul className="space-y-1">{p.promptTips.map((t, i) => <li key={i} className="text-xs text-zinc-300 pl-3 relative before:content-['▸'] before:absolute before:left-0 before:text-emerald-500">{t}</li>)}</ul>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          <div className="bg-zinc-800/50 rounded p-2">
                            <span className="text-xs font-bold text-zinc-400 block mb-1">Control de Cámara</span>
                            <p className="text-xs text-zinc-300">{p.cameraControlMethod}</p>
                          </div>
                          <div className="bg-zinc-800/50 rounded p-2">
                            <span className="text-xs font-bold text-zinc-400 block mb-1">Precio</span>
                            <p className="text-xs text-zinc-300">{p.pricingNote}</p>
                          </div>
                        </div>
                        <div>
                          <span className="text-xs font-bold text-zinc-400 block mb-1">Modos API</span>
                          <div className="flex flex-wrap gap-1">{p.apiModes.map(m => <span key={m} className="px-2 py-0.5 rounded text-xs bg-zinc-800 text-zinc-300 border border-zinc-700">{m}</span>)}</div>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </>
        )}

        {tab === "sequences" && (
          <>
            <div className="grid gap-2 mb-4">
              <h3 className="text-xs font-bold text-zinc-400 uppercase tracking-wider">Global State DNA Templates</h3>
              {globalStates.map(gs => (
                <div key={gs.id} className="bg-zinc-900 border border-zinc-800 rounded-lg p-3">
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-bold text-sm text-amber-400">{gs.name}</span>
                    <CopyBtn text={gs.fullTemplate} />
                  </div>
                  <p className="text-xs text-zinc-400 mb-2">{gs.description}</p>
                  <pre className="text-xs text-zinc-500 bg-zinc-800/50 rounded p-2 whitespace-pre-wrap font-mono leading-relaxed max-h-24 overflow-y-auto">{gs.fullTemplate}</pre>
                </div>
              ))}
            </div>

            <h3 className="text-xs font-bold text-zinc-400 uppercase tracking-wider">Secuencias de Prompts (5 Clips)</h3>
            {sequences.map(seq => {
              const expanded = expandedSeq === seq.id;
              return (
                <div key={seq.id} className="bg-zinc-900 border border-zinc-800 rounded-lg overflow-hidden">
                  <button onClick={() => setExpandedSeq(expanded ? null : seq.id)} className="w-full flex items-center gap-3 p-3 text-left">
                    <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-purple-500/20 to-pink-600/20 border border-purple-500/30 flex items-center justify-center text-purple-400 shrink-0"><Film size={20} /></div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-bold text-sm">{seq.productName}</span>
                        <span className={`text-xs px-1.5 py-0.5 rounded font-bold ${seq.generationMode === "parallel" ? "bg-blue-500/20 text-blue-400" : "bg-green-500/20 text-green-400"}`}>
                          {seq.generationMode === "parallel" ? "PARALELO" : "SECUENCIAL"}
                        </span>
                      </div>
                      <p className="text-xs text-zinc-500 mt-0.5">{seq.clipCount} clips · {seq.totalDurationSec}s total</p>
                    </div>
                    {expanded ? <ChevronDown size={16} className="text-zinc-500 shrink-0" /> : <ChevronRight size={16} className="text-zinc-500 shrink-0" />}
                  </button>
                  {expanded && (
                    <div className="border-t border-zinc-800 p-3 space-y-3">
                      <div className="bg-zinc-800/50 rounded p-2">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-xs font-bold text-zinc-400">Global State Prefix</span>
                          <CopyBtn text={seq.globalStatePrefix} />
                        </div>
                        <pre className="text-xs text-zinc-500 font-mono whitespace-pre-wrap max-h-20 overflow-y-auto">{seq.globalStatePrefix}</pre>
                      </div>
                      {seq.clips.map(clip => {
                        const clipKey = `${seq.id}:${clip.clipIndex}`;
                        const clipExpanded = expandedClip === clipKey;
                        return (
                          <div key={clip.clipIndex} className="bg-zinc-800/30 border border-zinc-800 rounded-lg overflow-hidden">
                            <button onClick={() => setExpandedClip(clipExpanded ? null : clipKey)} className="w-full flex items-center gap-2 p-2 text-left">
                              <span className="w-7 h-7 rounded-full bg-zinc-800 flex items-center justify-center text-xs font-bold text-amber-400 shrink-0">{clip.clipIndex}</span>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <span className="text-sm font-bold">{clip.clipName}</span>
                                  <PhaseBadge phase={clip.phase} />
                                  <span className="text-xs text-zinc-500">{clip.timelineSec}</span>
                                </div>
                                <p className="text-xs text-zinc-500 truncate">{clip.logicDescription}</p>
                              </div>
                              {clipExpanded ? <ChevronDown size={14} className="text-zinc-500 shrink-0" /> : <ChevronRight size={14} className="text-zinc-500 shrink-0" />}
                            </button>
                            {clipExpanded && (
                              <div className="border-t border-zinc-800 p-2 space-y-2">
                                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs">
                                  <div className="bg-zinc-900 rounded p-2"><span className="text-zinc-500 block mb-0.5">Estado Inicial</span><span className="text-zinc-300">{clip.startingState}</span></div>
                                  <div className="bg-zinc-900 rounded p-2"><span className="text-zinc-500 block mb-0.5">Acción</span><span className="text-zinc-300">{clip.action}</span></div>
                                  <div className="bg-zinc-900 rounded p-2"><span className="text-zinc-500 block mb-0.5">Estado Final</span><span className="text-zinc-300">{clip.endingState}</span></div>
                                </div>
                                <div className="flex items-center gap-2 text-xs">
                                  <span className="text-zinc-500">Curva:</span><span className="text-zinc-300 font-mono">{clip.motionCurve}</span>
                                  <span className="text-zinc-500 ml-2">Parallel-safe:</span><span className={clip.parallelSafe ? "text-emerald-400" : "text-red-400"}>{clip.parallelSafe ? "Si" : "No"}</span>
                                </div>
                                <div>
                                  <div className="flex items-center justify-between mb-1">
                                    <span className="text-xs font-bold text-amber-400">Prompt Completo</span>
                                    <CopyBtn text={clip.prompt} />
                                  </div>
                                  <pre className="text-xs text-zinc-400 bg-zinc-900 rounded p-2 whitespace-pre-wrap font-mono leading-relaxed max-h-32 overflow-y-auto">{clip.prompt}</pre>
                                </div>
                                <p className="text-xs text-zinc-500 italic"><Play size={10} className="inline mr-1" />{clip.sequentialTip}</p>
                              </div>
                            )}
                          </div>
                        );
                      })}
                      {seq.postProductionNotes.length > 0 && (
                        <div className="bg-amber-500/10 border border-amber-500/20 rounded p-2">
                          <span className="text-xs font-bold text-amber-400 block mb-1">Notas de Post-Producción</span>
                          {seq.postProductionNotes.map((n, i) => <p key={i} className="text-xs text-amber-300/80 pl-3 relative before:content-['▸'] before:absolute before:left-0 before:text-amber-500">{n}</p>)}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </>
        )}

        {tab === "presets" && (
          <div className="grid gap-3">
            {presets.map(p => {
              const expanded = expandedPreset === p.id;
              return (
                <div key={p.id} className="bg-zinc-900 border border-zinc-800 rounded-lg overflow-hidden hover:border-zinc-700 transition-colors">
                  <button onClick={() => setExpandedPreset(expanded ? null : p.id)} className="w-full flex items-center gap-3 p-3 text-left">
                    <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-cyan-500/20 to-blue-600/20 border border-cyan-500/30 flex items-center justify-center text-cyan-400 shrink-0"><Box size={20} /></div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-bold text-sm">{p.displayName}</span>
                        <span className="text-xs px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-400">{p.components.length} componentes</span>
                      </div>
                      <p className="text-xs text-zinc-500 truncate mt-0.5">{p.exampleProduct}</p>
                    </div>
                    {expanded ? <ChevronDown size={16} className="text-zinc-500 shrink-0" /> : <ChevronRight size={16} className="text-zinc-500 shrink-0" />}
                  </button>
                  {expanded && (
                    <div className="border-t border-zinc-800 p-3 space-y-3">
                      <div>
                        <h4 className="text-xs font-bold text-cyan-400 mb-2">Mapa de Componentes</h4>
                        <div className="grid gap-1.5">
                          {p.components.sort((a, b) => a.detachOrder - b.detachOrder).map((c, i) => (
                            <div key={i} className="bg-zinc-800/50 rounded p-2 flex items-start gap-2">
                              <span className="w-5 h-5 rounded-full bg-zinc-700 flex items-center justify-center text-xs font-bold text-amber-400 shrink-0 mt-0.5">{c.detachOrder}</span>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <span className="text-xs font-bold text-zinc-200">{c.name}</span>
                                  <span className="text-xs text-zinc-500">Eje: {c.separationAxis}</span>
                                  <span className="text-xs text-zinc-500">{c.separationDistance}</span>
                                </div>
                                <p className="text-xs text-zinc-400 mt-0.5">{c.material}</p>
                                <p className="text-xs text-zinc-500 italic">{c.visualNote}</p>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        <div>
                          <span className="text-xs font-bold text-zinc-400 block mb-1">Plataformas Recomendadas</span>
                          <div className="flex flex-wrap gap-1">{p.recommendedPlatforms.map(r => <span key={r} className="px-2 py-0.5 rounded text-xs bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">{r}</span>)}</div>
                        </div>
                        <div>
                          <span className="text-xs font-bold text-zinc-400 block mb-1">Efectos Especiales</span>
                          <div className="flex flex-wrap gap-1">{p.specialEffects.map(e => <span key={e} className="px-2 py-0.5 rounded text-xs bg-purple-500/10 text-purple-400 border border-purple-500/20">{e}</span>)}</div>
                        </div>
                      </div>
                      <div className="bg-zinc-800/50 rounded p-2">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-xs font-bold text-zinc-400">Prompt Suffix (Objeto)</span>
                          <CopyBtn text={p.promptSuffix} />
                        </div>
                        <p className="text-xs text-zinc-300 font-mono">{p.promptSuffix}</p>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {tab === "architecture" && (
          <div className="space-y-4">
            <h3 className="text-xs font-bold text-zinc-400 uppercase tracking-wider">Estrategias de Generación</h3>
            {strategies.map(s => (
              <div key={s.id} className="bg-zinc-900 border border-zinc-800 rounded-lg p-4 space-y-3">
                <div className="flex items-center gap-2">
                  <span className={`w-8 h-8 rounded-lg flex items-center justify-center ${s.mode === "parallel" ? "bg-blue-500/20 text-blue-400" : "bg-green-500/20 text-green-400"}`}>
                    {s.mode === "parallel" ? <LayoutGrid size={18} /> : <Play size={18} />}
                  </span>
                  <div>
                    <span className="font-bold text-sm">{s.name}</span>
                    <p className="text-xs text-zinc-500">{s.description}</p>
                  </div>
                </div>
                <div>
                  <h4 className="text-xs font-bold text-amber-400 mb-1">Cómo funciona</h4>
                  {s.howItWorks.map((h, i) => <p key={i} className="text-xs text-zinc-300 pl-2">{h}</p>)}
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <h4 className="text-xs font-bold text-emerald-400 mb-1">Ventajas</h4>
                    {s.pros.map((p, i) => <p key={i} className="text-xs text-zinc-300 pl-3 relative before:content-['✓'] before:absolute before:left-0 before:text-emerald-500">{p}</p>)}
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-red-400 mb-1">Desventajas</h4>
                    {s.cons.map((c, i) => <p key={i} className="text-xs text-zinc-300 pl-3 relative before:content-['✗'] before:absolute before:left-0 before:text-red-500">{c}</p>)}
                  </div>
                </div>
                <div className="bg-red-500/10 border border-red-500/20 rounded p-2">
                  <span className="text-xs font-bold text-red-400 flex items-center gap-1"><Shield size={12} /> Regla Crítica</span>
                  <p className="text-xs text-red-300 mt-0.5">{s.criticalRule}</p>
                </div>
                <div>
                  <span className="text-xs font-bold text-zinc-400 block mb-1">Mejores Plataformas</span>
                  <div className="flex flex-wrap gap-1">{s.bestPlatforms.map(p => <span key={p} className="px-2 py-0.5 rounded text-xs bg-zinc-800 text-zinc-300">{p}</span>)}</div>
                </div>
              </div>
            ))}

            <h3 className="text-xs font-bold text-zinc-400 uppercase tracking-wider mt-6">Pipeline de Post-Producción</h3>
            <div className="space-y-2">
              {postProd.map(step => (
                <div key={step.id} className="bg-zinc-900 border border-zinc-800 rounded-lg p-3">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="w-6 h-6 rounded-full bg-amber-500/20 flex items-center justify-center text-xs font-bold text-amber-400">{step.order}</span>
                    <span className="font-bold text-sm">{step.name}</span>
                  </div>
                  <p className="text-xs text-zinc-400 mb-2">{step.description}</p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                    <div className="bg-zinc-800/50 rounded p-2">
                      <span className="text-zinc-500 block mb-0.5">Herramientas</span>
                      <span className="text-zinc-300">{step.toolSuggestions.join(", ")}</span>
                    </div>
                    <div className="bg-zinc-800/50 rounded p-2">
                      <span className="text-zinc-500 block mb-0.5">Parámetros</span>
                      <span className="text-zinc-300">{step.parameters}</span>
                    </div>
                  </div>
                  <div className="bg-amber-500/10 border border-amber-500/20 rounded p-1.5 mt-2">
                    <p className="text-xs text-amber-300"><AlertTriangle size={10} className="inline mr-1" />{step.criticalNote}</p>
                  </div>
                </div>
              ))}
            </div>

            <h3 className="text-xs font-bold text-zinc-400 uppercase tracking-wider mt-6">Reglas de Calidad</h3>
            <div className="space-y-1.5">
              {rules.map(r => (
                <div key={r.id} className="bg-zinc-900 border border-zinc-800 rounded-lg p-2.5 flex items-start gap-2">
                  <SeverityBadge severity={r.severity} />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-zinc-200 font-medium">{r.rule}</p>
                    <p className="text-xs text-zinc-500 mt-0.5 italic">{r.rationale}</p>
                  </div>
                  <span className="text-xs text-zinc-600 shrink-0">{r.category}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {tab === "generate" && (
          <div className="max-w-2xl mx-auto space-y-4">
            <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-4 space-y-4">
              <div className="flex items-center gap-2 mb-2">
                <Sparkles size={18} className="text-amber-400" />
                <h3 className="font-bold text-sm">Generar Secuencia Personalizada con IA</h3>
              </div>
              <p className="text-xs text-zinc-500">ShopyBrain generará una secuencia completa de 5 clips con prompts listos para producción, adaptada a tu producto específico.</p>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-zinc-400 block mb-1">Nombre del Producto *</label>
                  <input value={genForm.productName} onChange={e => setGenForm(f => ({ ...f, productName: e.target.value }))}
                    className="w-full bg-zinc-800 border border-zinc-700 rounded px-3 py-2 text-sm text-zinc-100 focus:border-amber-500 focus:outline-none"
                    placeholder="Ej: iPhone 16 Pro Max" />
                </div>
                <div>
                  <label className="text-xs text-zinc-400 block mb-1">Categoría del Producto *</label>
                  <select value={genForm.productCategory} onChange={e => setGenForm(f => ({ ...f, productCategory: e.target.value }))}
                    className="w-full bg-zinc-800 border border-zinc-700 rounded px-3 py-2 text-sm text-zinc-100 focus:border-amber-500 focus:outline-none">
                    {presets.map(p => <option key={p.category} value={p.category}>{p.displayName}</option>)}
                    <option value="electronics">Electrónica</option>
                    <option value="jewelry">Joyería</option>
                    <option value="cosmetics">Cosmética</option>
                    <option value="automotive">Automotriz</option>
                    <option value="custom">Otro (Personalizado)</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="text-xs text-zinc-400 block mb-1">Descripción de Materiales</label>
                <input value={genForm.materialDescription} onChange={e => setGenForm(f => ({ ...f, materialDescription: e.target.value }))}
                  className="w-full bg-zinc-800 border border-zinc-700 rounded px-3 py-2 text-sm text-zinc-100 focus:border-amber-500 focus:outline-none"
                  placeholder="Ej: Titanio grado 5, cristal de zafiro, cuero italiano" />
              </div>

              <div>
                <label className="text-xs text-zinc-400 block mb-1">Componentes (uno por línea, opcional)</label>
                <textarea value={genForm.components} onChange={e => setGenForm(f => ({ ...f, components: e.target.value }))}
                  className="w-full bg-zinc-800 border border-zinc-700 rounded px-3 py-2 text-sm text-zinc-100 focus:border-amber-500 focus:outline-none h-20 resize-none"
                  placeholder={"Cristal frontal\nProcesador A18 Pro\nBatería interna\nCámara trasera triple"} />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="text-xs text-zinc-400 block mb-1">Formato</label>
                  <select value={genForm.format} onChange={e => setGenForm(f => ({ ...f, format: e.target.value }))}
                    className="w-full bg-zinc-800 border border-zinc-700 rounded px-3 py-2 text-sm text-zinc-100 focus:border-amber-500 focus:outline-none">
                    <option value="16:9">16:9 (Landscape)</option>
                    <option value="9:16">9:16 (Vertical)</option>
                    <option value="1:1">1:1 (Cuadrado)</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs text-zinc-400 block mb-1">Modo de Generación</label>
                  <select value={genForm.generationMode} onChange={e => setGenForm(f => ({ ...f, generationMode: e.target.value }))}
                    className="w-full bg-zinc-800 border border-zinc-700 rounded px-3 py-2 text-sm text-zinc-100 focus:border-amber-500 focus:outline-none">
                    <option value="parallel">Paralelo (5x más rápido)</option>
                    <option value="sequential">Secuencial (máxima coherencia)</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs text-zinc-400 block mb-1">Global State</label>
                  <select value={genForm.globalStateId} onChange={e => setGenForm(f => ({ ...f, globalStateId: e.target.value }))}
                    className="w-full bg-zinc-800 border border-zinc-700 rounded px-3 py-2 text-sm text-zinc-100 focus:border-amber-500 focus:outline-none">
                    {globalStates.map(gs => <option key={gs.id} value={gs.id}>{gs.name}</option>)}
                  </select>
                </div>
              </div>

              <button onClick={handleGenerate} disabled={generating || !genForm.productName.trim()}
                className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg font-bold text-sm bg-gradient-to-r from-amber-500 to-orange-600 text-black hover:from-amber-400 hover:to-orange-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all">
                {generating ? <><Loader2 size={16} className="animate-spin" /> Generando secuencia con ShopyBrain...</> : <><Wand2 size={16} /> Generar Secuencia Exploded View</>}
              </button>

              {genError && <div className="bg-red-500/10 border border-red-500/30 rounded p-3 text-xs text-red-300">{genError}</div>}
            </div>

            {genResult && (
              <div className="bg-zinc-900 border border-emerald-500/30 rounded-lg p-4 space-y-3">
                <div className="flex items-center gap-2">
                  <Sparkles size={16} className="text-emerald-400" />
                  <h3 className="font-bold text-sm text-emerald-400">Secuencia Generada: {genResult.productName}</h3>
                  <span className={`text-xs px-1.5 py-0.5 rounded font-bold ${genResult.generationMode === "parallel" ? "bg-blue-500/20 text-blue-400" : "bg-green-500/20 text-green-400"}`}>
                    {genResult.generationMode === "parallel" ? "PARALELO" : "SECUENCIAL"}
                  </span>
                </div>
                <p className="text-xs text-zinc-500">{genResult.clipCount} clips · {genResult.totalDurationSec}s</p>

                {genResult.globalStatePrefix && (
                  <div className="bg-zinc-800/50 rounded p-2">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-bold text-zinc-400">Global State Prefix</span>
                      <CopyBtn text={genResult.globalStatePrefix} />
                    </div>
                    <pre className="text-xs text-zinc-500 font-mono whitespace-pre-wrap max-h-16 overflow-y-auto">{genResult.globalStatePrefix}</pre>
                  </div>
                )}

                {Array.isArray(genResult.clips) && genResult.clips.map((clip: any) => (
                  <div key={clip.clipIndex} className="bg-zinc-800/30 border border-zinc-800 rounded-lg p-3 space-y-2">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="w-6 h-6 rounded-full bg-zinc-700 flex items-center justify-center text-xs font-bold text-amber-400">{clip.clipIndex}</span>
                      <span className="font-bold text-sm">{clip.clipName}</span>
                      <PhaseBadge phase={clip.phase} />
                      <span className="text-xs text-zinc-500">{clip.timelineSec}</span>
                      <span className="text-xs text-zinc-500 font-mono">({clip.motionCurve})</span>
                    </div>
                    <p className="text-xs text-zinc-400">{clip.logicDescription}</p>
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs font-bold text-amber-400">Prompt</span>
                        <CopyBtn text={clip.prompt} />
                      </div>
                      <pre className="text-xs text-zinc-400 bg-zinc-900 rounded p-2 whitespace-pre-wrap font-mono leading-relaxed max-h-32 overflow-y-auto">{clip.prompt}</pre>
                    </div>
                  </div>
                ))}

                {Array.isArray(genResult.postProductionNotes) && genResult.postProductionNotes.length > 0 && (
                  <div className="bg-amber-500/10 border border-amber-500/20 rounded p-2">
                    <span className="text-xs font-bold text-amber-400 block mb-1">Post-Producción</span>
                    {genResult.postProductionNotes.map((n: string, i: number) => <p key={i} className="text-xs text-amber-300/80">{n}</p>)}
                  </div>
                )}

                {Array.isArray(genResult.recommendedPlatforms) && genResult.recommendedPlatforms.length > 0 && (
                  <div>
                    <span className="text-xs font-bold text-zinc-400 block mb-1">Plataformas Recomendadas</span>
                    <div className="flex flex-wrap gap-1">{genResult.recommendedPlatforms.map((p: string) => <span key={p} className="px-2 py-0.5 rounded text-xs bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">{p}</span>)}</div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
